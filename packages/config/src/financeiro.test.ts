import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFinanceiroConfig } from "./financeiro.js";
import { ConfigError } from "./load.js";
test("financeiro permanece desativado sem credenciais e nao ecoa segredo", () => {
  assert.equal(loadFinanceiroConfig({}).anexos, undefined);
  assert.equal(loadFinanceiroConfig({}).webhookHottok, undefined);
  const cfg = loadFinanceiroConfig({ HOTMART_WEBHOOK_HOTTOK: "somente-teste-ficticio" });
  assert.equal(JSON.stringify(cfg).includes("somente-teste-ficticio"), false);
});
test("MinIO exige conjunto completo e segredo usa Secret", () => {
  assert.throws(
    () => loadFinanceiroConfig({ MINIO_ENDPOINT: "http://127.0.0.1:19000" }),
    ConfigError,
  );
  const cfg = loadFinanceiroConfig({
    MINIO_ENDPOINT: "http://127.0.0.1:19000",
    MINIO_ACCESS_KEY: "teste-access-ficticio",
    MINIO_SECRET_KEY: "teste-secret-ficticio",
  });
  assert.equal(cfg.anexos?.bucket, "nucleos-financeiro");
  assert.equal(JSON.stringify(cfg).includes("teste-secret-ficticio"), false);
});
