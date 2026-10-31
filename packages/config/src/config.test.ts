import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";
import {
  ConfigError,
  MAX_SECRET_BYTES,
  Secret,
  SecretFileError,
  forbiddenSecretEnv,
  isSecretName,
  loadApiConfig,
  readSecretFile,
} from "./index.js";

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

// ---------------------------------------------------------------- REVIEW-003/004/006/007/009
test("dono diferente do processo e recusado (mutante: checagem de dono removida)", () => {
  withDir((dir) => {
    const p = secretFile(dir);
    const real = process.getuid?.() ?? 0;
    const m = mock.method(process as { getuid: () => number }, "getuid", () => real + 1);
    try {
      assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "dono-diferente");
    } finally {
      m.mock.restore();
    }
  });
});

test("limite exato de tamanho aceito; um byte a mais recusado", () => {
  withDir((dir) => {
    const at = join(dir, "no-limite");
    writeFileSync(at, "a".repeat(MAX_SECRET_BYTES), { mode: 0o400 });
    assert.equal(readSecretFile(at).reveal().length, MAX_SECRET_BYTES);
    const over = join(dir, "acima");
    writeFileSync(over, "a".repeat(MAX_SECRET_BYTES + 1), { mode: 0o400 });
    assert.throws(() => readSecretFile(over), (e: unknown) => e instanceof SecretFileError && e.reason === "grande-demais");
  });
});

test("arquivo com bytes UTF-8 invalidos e ilegivel (paridade com Python)", () => {
  withDir((dir) => {
    const p = join(dir, "bin");
    writeFileSync(p, Buffer.from([0x61, 0xff, 0xfe, 0x62]), { mode: 0o400 });
    assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "ilegivel");
  });
});

test("nomes de segredo por token e sufixo; *_FILE e *_PATH permitidos", () => {
  for (const n of ["API_TOKEN", "X_SECRET", "DB_PASS", "SECRET_KEY", "AWS_SECRET_ACCESS_KEY", "DBPASSWORD", "A_DSN"]) {
    assert.ok(isSecretName(n), n);
  }
  for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "OTEL_SERVICE_NAME", "KEYBOARD", "PORT", "PASSTHROUGH"]) {
    assert.ok(!isSecretName(n), n);
  }
});

test("tabela de paridade compartilhada com config-py", () => {
  const url = new URL("../paridade-casos.json", import.meta.url);
  const { casos } = JSON.parse(readFileSync(url, "utf8")) as {
    casos: { caso: string; env: Record<string, string>; aceita: boolean }[];
  };
  assert.ok(casos.length > 40);
  for (const c of casos) {
    let aceitou = true;
    try {
      loadApiConfig(c.env);
    } catch (e) {
      assert.ok(e instanceof ConfigError, c.caso);
      aceitou = false;
      assert.ok(!e.message.includes("SENT"), `${c.caso}: vazou`);
    }
    assert.equal(aceitou, c.aceita, c.caso);
  }
});

test("PWD e OLDPWD do shell nao sao tratados como segredo", () => {
  assert.ok(!isSecretName("PWD") && !isSecretName("OLDPWD") && isSecretName("X_PWD"));
  assert.deepEqual(forbiddenSecretEnv({ PWD: "/home/x", OLDPWD: "/", DB_PWD: "x" }), ["DB_PWD"]);
});
