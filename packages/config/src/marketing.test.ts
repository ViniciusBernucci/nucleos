import assert from "node:assert/strict";
import { test } from "node:test";
import { loadMarketingConfig } from "./marketing.js";

test("sem token ou conta não fabrica configuração; credencial não serializa segredo", () => {
  assert.equal(loadMarketingConfig({}).meta, undefined);
  assert.equal(loadMarketingConfig({ META_ADS_ACCESS_TOKEN: "sentinela-meta" }).meta, undefined);
  assert.equal(loadMarketingConfig({ META_ADS_ACCOUNT_ID: "123" }).meta, undefined);
  const config = loadMarketingConfig({
    META_ADS_ACCESS_TOKEN: "sentinela-meta",
    META_ADS_ACCOUNT_ID: "act_123",
  });
  assert.equal(config.meta?.contaId, "123");
  assert.doesNotMatch(JSON.stringify(config), /sentinela-meta/);
});
test("config rejeita conta arbitrária, segredo em valor+arquivo e token inválido sem valores no erro", () => {
  for (const env of [
    { META_ADS_ACCOUNT_ID: "https://evil.invalid" },
    { META_ADS_ACCESS_TOKEN: "segredo invalido", META_ADS_ACCOUNT_ID: "123" },
    { META_ADS_ACCESS_TOKEN: "sentinela", META_ADS_ACCESS_TOKEN_FILE: "C:/teste/secret" },
  ]) {
    assert.throws(
      () => loadMarketingConfig(env),
      (e: unknown) =>
        e instanceof Error &&
        !e.message.includes("sentinela") &&
        !e.message.includes("segredo invalido") &&
        !e.message.includes("evil.invalid"),
    );
  }
});
