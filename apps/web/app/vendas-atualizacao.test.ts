import assert from "node:assert/strict";
import { test } from "node:test";
import { executarAtualizacao } from "../lib/vendas-atualizacao.ts";

test("atualizacao faz POST privado, aguarda resultado e distingue falhas", async (t) => {
  const original = { ...process.env };
  process.env["VENDAS_API_KEY"] = "sentinela-privada";
  process.env["VENDAS_API_URL"] = "http://127.0.0.1:39999";
  delete process.env["VENDAS_API_KEY_FILE"];
  let resposta: unknown = { resultado: "sucesso" };
  let status = 200;
  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "http://127.0.0.1:39999/v1/vendas/sincronizacao/atualizar");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sentinela-privada");
    assert.equal(init.cache, "no-store");
    return new Response(JSON.stringify(resposta), { status });
  });
  try {
    assert.equal((await executarAtualizacao()).erro, false);
    for (const resultado of ["parcial", "falha", "ocupada", "desabilitada"]) {
      resposta = { resultado };
      const r = await executarAtualizacao();
      assert.equal(r.erro, true);
      assert.ok(r.mensagem.length > 0);
      assert.ok(!r.mensagem.includes("sentinela-privada"));
    }
    resposta = { resultado: "desconhecido", segredo: "sentinela-privada" };
    assert.equal((await executarAtualizacao()).erro, true);
    status = 401;
    assert.match((await executarAtualizacao()).mensagem, /recusada/);
    status = 503;
    assert.equal((await executarAtualizacao()).erro, true);
    delete process.env["VENDAS_API_KEY"];
    assert.match((await executarAtualizacao()).mensagem, /conectado/);
  } finally {
    process.env = original;
  }
});
