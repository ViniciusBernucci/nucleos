import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { RepositorioFluxoCaixaPg } from "./repositorio-pg.js";

test("exclusao legada recusa transferencia e conciliacao aceita antes de apagar", async () => {
  for (const vinculo of [
    { transferencia_id: "uuid", conciliado: false },
    { transferencia_id: null, conciliado: true },
  ]) {
    const passos: string[] = [];
    const c = {
      query: async (sql: string) => {
        passos.push(sql);
        if (sql.startsWith("SELECT id,transferencia_id"))
          return { rows: [{ id: "1", ...vinculo }], rowCount: 1 };
        return { rows: [], rowCount: sql.startsWith("DELETE") ? 1 : 0 };
      },
      release: () => {},
    };
    const pool = { query: c.query, connect: async () => c } as unknown as Pool;
    const motor = { publicar: async () => true } as unknown as MotorFuncionarios;
    await assert.rejects(
      new RepositorioFluxoCaixaPg(pool, motor).excluirLancamento("1"),
      /vinculado/,
    );
    assert.equal(
      passos.some((s) => s.startsWith("DELETE")),
      false,
    );
    assert.equal(passos.at(-1), "ROLLBACK");
  }
});
test("mutacao legada e evento financeiro compartilham commit e rollback", async () => {
  for (const falhar of [false, true]) {
    const passos: string[] = [];
    const c = {
      query: async (sql: string) => {
        passos.push(sql);
        return { rowCount: 1, rows: [{ id: "1", tipo: "saida", nome: "Serviços" }] };
      },
      release: () => {},
    };
    const pool = {
      connect: async () => c,
      query: () => {
        throw new Error("escrita fora da transacao");
      },
    } as unknown as Pool;
    const motor = {
      publicar: async (tipo: string, _chave: string, _p: unknown, cliente: unknown) => {
        assert.equal(cliente, c);
        assert.equal(tipo, "financeiro.dados.alterados");
        if (falhar) throw new Error("evento falhou");
        return true;
      },
    } as unknown as MotorFuncionarios;
    const r = new RepositorioFluxoCaixaPg(pool, motor);
    if (falhar) {
      await assert.rejects(
        r.inserirCategoria({ tipo: "saida", nome: "Serviços" }),
        /evento falhou/,
      );
      assert.equal(passos.at(-1), "ROLLBACK");
    } else {
      await r.inserirCategoria({ tipo: "saida", nome: "Serviços" });
      assert.equal(passos.at(-1), "COMMIT");
    }
  }
});
