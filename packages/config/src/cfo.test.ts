import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCfoConfig } from "./cfo.js";
test("CFO desativado sem chaves; chaves independentes e URL fixa sem credencial", () => {
  assert.equal(loadCfoConfig({}).gateway, undefined);
  const config = loadCfoConfig({ AI_GATEWAY_API_KEY: "gateway", CFO_LEITURA_API_KEY: "leitura" });
  assert.ok(config.gateway);
  assert.equal(config.leitura?.reveal(), "leitura");
  for (const url of [
    "http://externo",
    "http://u:senha@127.0.0.1:8002",
    "file:///tmp/x",
    "http://127.0.0.1:8002/?token=x",
  ])
    assert.throws(() => loadCfoConfig({ AI_GATEWAY_URL: url }));
  assert.throws(() => loadCfoConfig({ AI_GATEWAY_API_KEY: "mesma", CFO_LEITURA_API_KEY: "mesma" }));
  assert.throws(() => loadCfoConfig({ CFO_LEITURA_API_KEY: "admin", VENDAS_API_KEY: "admin" }));
  assert.throws(() => loadCfoConfig({ AI_GATEWAY_API_KEY: "admin", VENDAS_API_KEY: "admin" }));
});
