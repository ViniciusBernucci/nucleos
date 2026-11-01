import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarPainel } from "../lib/vendas-api.ts";

test("web usa chave do ambiente apenas no bearer e fecha acesso com fontes conflitantes", async (t) => {
  const original = { ...process.env };
  process.env["VENDAS_API_KEY"] = "sentinela-web";
  delete process.env["VENDAS_API_KEY_FILE"];
  let chamadas = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    chamadas++;
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sentinela-web");
    return new Response(JSON.stringify({ indicadores: {}, serieDiaria: [], sincronizacao: {} }));
  });
  try {
    const resultado = await carregarPainel({});
    assert.equal(resultado.tipo, "ok");
    assert.ok(!JSON.stringify(resultado).includes("sentinela-web"));
    process.env["VENDAS_API_KEY_FILE"] = "/unused";
    assert.equal((await carregarPainel({})).tipo, "nao-configurado");
    assert.equal(chamadas, 1);
  } finally {
    process.env = original;
  }
});
