import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadVendasConfig } from "./index.js";

test("vendas: Client Token fica protegido e exige credenciais completas", () => {
  const base = { HOTMART_CLIENT_ID: "id", HOTMART_CLIENT_SECRET: "segredo" };
  const c = loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "token-sentinela" });
  assert.equal(c.hotmart?.clientToken?.reveal(), "token-sentinela");
  assert.ok(!JSON.stringify(c).includes("token-sentinela"));
  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_TOKEN: "token-sentinela" }), ConfigError);
  assert.throws(
    () =>
      loadVendasConfig({
        ...base,
        HOTMART_CLIENT_TOKEN: "token-sentinela",
        HOTMART_CLIENT_TOKEN_FILE: "/unused",
      }),
    ConfigError,
  );
  assert.throws(
    () => loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "token\ninvalido" }),
    (e: unknown) => e instanceof ConfigError && !e.message.includes("token\ninvalido"),
  );
  assert.doesNotThrow(() =>
    loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "Basic token-sentinela" }),
  );
});

test("vendas: sem nada configurado usa 30 min, 90 dias e fica sem Hotmart nem chave", () => {
  const c = loadVendasConfig({});
  assert.equal(c.syncIntervalMs, 30 * 60_000);
  assert.equal(c.backfillDays, 90);
  assert.equal(c.hotmartEnv, "production");
  assert.equal(c.hotmart, undefined);
  assert.equal(c.apiKey, undefined);
});

test("vendas: intervalo e janela configuraveis, com limites", () => {
  const c = loadVendasConfig({
    HOTMART_SYNC_INTERVAL: "15m",
    HOTMART_BACKFILL_DAYS: "30",
    HOTMART_ENV: "sandbox",
  });
  assert.equal(c.syncIntervalMs, 15 * 60_000);
  assert.equal(c.backfillDays, 30);
  assert.equal(c.hotmartEnv, "sandbox");
  for (const env of [
    { HOTMART_SYNC_INTERVAL: "30s" },
    { HOTMART_SYNC_INTERVAL: "25h" },
    { HOTMART_BACKFILL_DAYS: "0" },
    { HOTMART_ENV: "dev" },
  ]) {
    assert.throws(() => loadVendasConfig(env), ConfigError, JSON.stringify(env));
  }
});

test("vendas: credenciais por arquivo ou ambiente e sempre em par; erros nao ecoam valores", () => {
  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_ID_FILE: "/run/secrets/id" }), ConfigError);
  assert.throws(
    () =>
      loadVendasConfig({
        HOTMART_CLIENT_ID_FILE: "relativo/id",
        HOTMART_CLIENT_SECRET_FILE: "/run/secrets/s",
      }),
    ConfigError,
  );
  assert.throws(
    () => loadVendasConfig({ HOTMART_CLIENT_SECRET: "valor-literal-sentinela" }),
    (e: unknown) =>
      e instanceof ConfigError &&
      !e.message.includes("valor-literal-sentinela") &&
      /HOTMART_CLIENT_SECRET/.test(e.message),
  );
});

test("vendas: credenciais diretas protegidas e fontes conflitantes recusadas", () => {
  const c = loadVendasConfig({
    HOTMART_CLIENT_ID: "id-teste",
    HOTMART_CLIENT_SECRET: "sentinela-teste",
    VENDAS_API_KEY: "chave-teste",
  });
  assert.ok(c.hotmart);
  assert.equal(c.hotmart.clientId.reveal(), "id-teste");
  assert.equal(c.hotmart.clientSecret.reveal(), "sentinela-teste");
  assert.equal(c.apiKey?.reveal(), "chave-teste");
  assert.ok(!JSON.stringify(c).includes("sentinela-teste"));
  for (const key of ["HOTMART_CLIENT_ID", "HOTMART_CLIENT_SECRET", "VENDAS_API_KEY"]) {
    assert.throws(
      () =>
        loadVendasConfig({
          HOTMART_CLIENT_ID: "id",
          HOTMART_CLIENT_SECRET: "secret",
          VENDAS_API_KEY: "key",
          [key + "_FILE"]: "/unused",
        }),
      ConfigError,
    );
  }
  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_ID: "id" }), ConfigError);
});
