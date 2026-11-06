import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { ReceptorHotmart } from "./webhook.js";
function ambiente() {
  const chamadas: { sql: string; p: unknown[] }[] = [],
    eventos: unknown[] = [],
    ids = new Set<string>();
  const cliente = {
    query: async (sql: string, p: unknown[] = []) => {
      chamadas.push({ sql, p });
      if (sql.startsWith("INSERT")) {
        const id = String(p[0]),
          existe = ids.has(id);
        ids.add(id);
        return { rowCount: existe ? 0 : 1, rows: existe ? [] : [{ id }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const motor = {
    publicar: async (...args: unknown[]) => {
      eventos.push(args);
      return true;
    },
  } as unknown as MotorFuncionarios;
  return { pool, motor, chamadas, eventos };
}
test("webhook sem segredo ou HOTTOK errado nao consulta banco", async () => {
  const a = ambiente();
  await assert.rejects(new ReceptorHotmart(a.pool, a.motor, undefined).receber("x", {}), {
    status: 503,
  });
  await assert.rejects(
    new ReceptorHotmart(a.pool, a.motor, new Secret("segredo-ficticio-teste")).receber(
      "errado",
      {},
    ),
    { status: 401 },
  );
  assert.equal(a.chamadas.length, 0);
});
test("webhook valida limite e evento antes do banco", async () => {
  const a = ambiente(),
    r = new ReceptorHotmart(a.pool, a.motor, new Secret("teste-ficticio"));
  await assert.rejects(r.receber("teste-ficticio", { texto: "x".repeat(65536) }), { status: 400 });
  await assert.rejects(
    r.receber("teste-ficticio", {
      id: "a",
      event: "DESCONHECIDO",
      data: { purchase: { transaction: "t" } },
    }),
    { status: 400 },
  );
  assert.equal(a.chamadas.length, 0);
});
test("recebimento descarta PII, deduplica id e publica na mesma transacao", async () => {
  const a = ambiente(),
    r = new ReceptorHotmart(a.pool, a.motor, new Secret("teste-ficticio"));
  const p = {
    id: "evento-1",
    event: "PURCHASE_APPROVED",
    data: {
      purchase: { transaction: "T1" },
      buyer: { email: "pessoa@example.invalid", name: "Pessoa Ficticia" },
    },
  };
  await r.receber("teste-ficticio", p);
  await r.receber("teste-ficticio", p);
  assert.equal(a.eventos.length, 1);
  assert.equal(a.chamadas.filter((c) => c.sql === "COMMIT").length, 2);
  const persistido = JSON.stringify(a.chamadas.map((c) => c.p));
  assert.equal(persistido.includes("Pessoa Ficticia"), false);
  assert.equal(persistido.includes("pessoa@example.invalid"), false);
  assert.match(String(a.chamadas.find((c) => c.sql.startsWith("INSERT"))?.p[3]), /^[a-f0-9]{64}$/);
});
