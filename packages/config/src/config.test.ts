import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConfigError, Secret, forbiddenSecretEnv, loadApiConfig, readSecretFile } from "./index.js";

const SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a";

function withDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function secretFile(dir: string, content = SENTINEL, mode = 0o400): string {
  const p = join(dir, "db_password");
  writeFileSync(p, `${content}\n`, { mode: 0o600 });
  chmodSync(p, mode);
  return p;
}

function failure(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ConfigError, "deveria lancar ConfigError");
    return e;
  }
  throw new Error("deveria falhar");
}

test("local: padroes seguros sem nenhuma variavel", () => {
  const c = loadApiConfig({});
  assert.equal(c.appEnv, "local");
  assert.equal(c.host, "127.0.0.1");
  assert.equal(c.port, 3001);
  assert.equal(c.requestTimeoutMs, 30_000);
  assert.equal(c.maxBodyBytes, 1024 * 1024);
  assert.equal(c.databasePassword, undefined);
});

test("converte duracao, tamanho e URL tipados", () => {
  withDir((dir) => {
    const c = loadApiConfig({
      APP_ENV: "staging",
      PORT: "8080",
      REQUEST_TIMEOUT: "5s",
      SHUTDOWN_TIMEOUT: "2m",
      MAX_BODY_SIZE: "512kb",
      DATABASE_URL: "postgres://nucleos@postgres:5432/nucleos",
      DATABASE_PASSWORD_FILE: secretFile(dir),
    });
    assert.equal(c.port, 8080);
    assert.equal(c.requestTimeoutMs, 5000);
    assert.equal(c.shutdownTimeoutMs, 120_000);
    assert.equal(c.maxBodyBytes, 512 * 1024);
    assert.equal(c.databasePassword?.reveal(), SENTINEL);
  });
});

test("staging/producao exigem banco e segredo (falha rapida, so nomes)", () => {
  for (const appEnv of ["staging", "production"]) {
    const e = failure(() => loadApiConfig({ APP_ENV: appEnv }));
    assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]);
  }
});

test("valores invalidos falham sem ecoar o valor recebido", () => {
  const e = failure(() =>
    loadApiConfig({
      APP_ENV: `prod-${SENTINEL}`,
      PORT: `99999${SENTINEL}`,
      REQUEST_TIMEOUT: `abc${SENTINEL}`,
      DATABASE_URL: `ftp://u:${SENTINEL}@h/db`,
    }),
  );
  const keys = e.issues.map((i) => i.key);
  for (const k of ["APP_ENV", "PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]) assert.ok(keys.includes(k), k);
  assert.ok(!e.message.includes(SENTINEL));
  assert.ok(!JSON.stringify(e.issues).includes(SENTINEL));
  assert.ok(!String(e.stack).includes(SENTINEL));
});

test("limites: porta 0, duracao fora da faixa e senha embutida na URL", () => {
  const e = failure(() =>
    loadApiConfig({
      PORT: "0",
      REQUEST_TIMEOUT: "1ms",
      DATABASE_URL: `postgres://u:${SENTINEL}@h/db`,
    }),
  );
  assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_URL", "PORT", "REQUEST_TIMEOUT"]);
  assert.ok(!e.message.includes(SENTINEL));
});

test("segredo literal por ambiente e proibido; vazio conta como ausente", () => {
  assert.deepEqual(
    forbiddenSecretEnv({ DATABASE_PASSWORD: "x", API_KEY: "y", DATABASE_PASSWORD_FILE: "/a", PORT: "1" }),
    ["API_KEY", "DATABASE_PASSWORD"],
  );
  const e = failure(() => loadApiConfig({ DATABASE_PASSWORD: SENTINEL }));
  assert.deepEqual(e.issues.map((i) => i.key), ["DATABASE_PASSWORD"]);
  assert.ok(!e.message.includes(SENTINEL));
  assert.equal(loadApiConfig({ DATABASE_PASSWORD: "", PORT: "" }).port, 3001);
});

test("arquivo de segredo: ausente, aberto, link simbolico, vazio e grande demais falham", () => {
  withDir((dir) => {
    const cfg = (path: string) =>
      failure(() => loadApiConfig({ APP_ENV: "local", DATABASE_PASSWORD_FILE: path }));
    assert.match(cfg(join(dir, "nao-existe")).message, /ausente/);
    assert.match(cfg(secretFile(dir, SENTINEL, 0o644)).message, /permissoes/);
    assert.ok(!cfg(secretFile(dir, SENTINEL, 0o640)).message.includes(SENTINEL));
    const real = secretFile(dir);
    const link = join(dir, "link");
    symlinkSync(real, link);
    assert.match(cfg(link).message, /link simbolico/);
    assert.match(cfg(dir).message, /arquivo regular/);
    const empty = join(dir, "vazio");
    writeFileSync(empty, "\n", { mode: 0o400 });
    assert.match(cfg(empty).message, /vazio/);
    const big = join(dir, "grande");
    writeFileSync(big, "a".repeat(20_000), { mode: 0o400 });
    assert.match(cfg(big).message, /grande demais/);
    assert.ok(!cfg(join(dir, "nao-existe")).message.includes(dir));
  });
});

test("Secret nunca se serializa", () => {
  withDir((dir) => {
    const s = readSecretFile(secretFile(dir));
    assert.ok(s instanceof Secret);
    for (const out of [String(s), JSON.stringify({ s })]) assert.ok(!out.includes(SENTINEL));
    assert.equal(s.reveal(), SENTINEL);
  });
});
