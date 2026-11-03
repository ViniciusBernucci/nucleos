import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { AlertasFinanceiros } from "./alertas.js";
import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
function ambiente(falhar = false) {
  const sqls: { sql: string; p: unknown[] }[] = [];
  let conta = 0;
  const c = {
    query: async (sql: string, p: unknown[] = []) => {
      sqls.push({ sql, p });
      if (sql.startsWith("SELECT id FROM financeiro.categorias"))
        return { rowCount: 1, rows: [{ id: "1" }] };
      if (sql.includes("INSERT INTO financeiro.contas_pagar")) {
        conta++;
        if (falhar && conta === 2) throw new Error("falha simulada");
        return { rowCount: 1, rows: [{ id: String(conta) }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const pool = { connect: async () => c } as unknown as Pool;
  const motor = { publicar: async () => true } as unknown as MotorFuncionarios;
  return {
    repo: new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor)),
    sqls,
  };
}
test("parcelamento distribui resto sem perda e confirma uma transacao", async () => {
  const a = ambiente();
  await a.repo.criarDespesa({
    descricao: "Serviço",
    categoria: "Serviços",
    valorCentavos: "10001",
    vencimento: "2026-11-30",
    parcelas: 3,
  });
  const inserts = a.sqls.filter((c) => c.sql.includes("INSERT INTO financeiro.contas_pagar"));
  assert.deepEqual(
    inserts.map((i) => i.p[4]),
    ["3334", "3334", "3333"],
  );
  assert.equal(
    inserts.reduce((s, i) => s + BigInt(String(i.p[4])), 0n),
    10001n,
  );
  assert.equal(a.sqls.at(-1)?.sql, "COMMIT");
});
test("falha durante parcelamento provoca rollback sem commit", async () => {
  const a = ambiente(true);
  await assert.rejects(
    a.repo.criarDespesa({
      descricao: "Serviço",
      categoria: "Serviços",
      valorCentavos: "10001",
      vencimento: "2026-11-30",
      parcelas: 3,
    }),
    /falha simulada/,
  );
  assert.equal(a.sqls.at(-1)?.sql, "ROLLBACK");
  assert.equal(
    a.sqls.some((c) => c.sql === "COMMIT"),
    false,
  );
});
test("previa CSV denuncia linha invalida e confirmacao nao inicia transacao", async () => {
  const a = ambiente(),
    csv =
      "data;descricao;valor;categoria;fornecedor;centro_custo;vencimento\n2026-11-03;Aluguel;100,00;Aluguel;;;2026-11-10\n2026-11-03;Inválida;1,005;Aluguel;;;2026-11-10";
  const previa = a.repo.previaDespesas(csv);
  assert.equal(previa.linhas.length, 1);
  assert.equal(previa.erros[0]?.linha, 3);
  await assert.rejects(a.repo.importarDespesas(csv, true));
  assert.equal(a.sqls.length, 0);
});
