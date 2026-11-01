# Diff da configuracao .env do MVP — 2026-11-01

[Registro da entrega](2026-11-01-configuracao-env-mvp.md).

Nenhum commit criado nesta tarefa. Nenhum diff staged desta tarefa.
Patch unstaged contra o snapshot de entrada da sessao (inclui apenas esta alteracao,
preservando o trabalho de vendas que ja existia, inclusive arquivos ainda untracked).
Arquivos de documentacao e lessons sao listados no registro, sem recursao no patch.
O .env local e deliberadamente excluido.

```diff
--- a/.env.example
+++ b/.env.example
@@ -2,8 +2,9 @@
 HOST=127.0.0.1
 
 # --- Docker Compose de desenvolvimento (FND-004) ---
-# Os segredos NAO ficam aqui: infrastructure/docker/scripts/gerar-segredos.sh gera
-# infrastructure/docker/.env.local (nao versionado) com valores descartaveis.
+# As credenciais dos servicos Compose continuam em infrastructure/docker/.env.local
+# (nao versionado), geradas por infrastructure/docker/scripts/gerar-segredos.sh.
+# A configuracao da API e da Hotmart fica na secao do MVP abaixo.
 # Portas de host (todas publicadas apenas em 127.0.0.1); valores abaixo sao os padroes.
 PG_HOST_PORT=15432
 REDIS_HOST_PORT=16379
@@ -16,9 +17,23 @@
 OTLP_HTTP_HOST_PORT=14318
 OTEL_HEALTH_HOST_PORT=13133
 
-# --- Configuracao tipada (FND-006; packages/config e packages/config-py) ---
-# Validada na subida (falha rapida; a mensagem lista so nomes de variaveis, nunca valores).
-# APP_ENV=local|ci|staging|production (staging/production exigem DATABASE_URL e DATABASE_PASSWORD_FILE)
-# PORT=3001  REQUEST_TIMEOUT=30s  SHUTDOWN_TIMEOUT=10s  MAX_BODY_SIZE=1mb
-# DATABASE_URL=postgres://usuario@host:5432/banco   (SEM senha na URL)
-# DATABASE_PASSWORD_FILE=/run/secrets/database_password   (arquivo 0400; segredos NUNCA por variavel)
+# --- Configuracao tradicional do MVP (ADR-020 revisado em 2026-11-01) ---
+# API e servidor web carregam este .env da raiz. Ambiente exportado tem precedencia.
+# Nunca versione o .env real nem use NEXT_PUBLIC_* para credenciais.
+APP_ENV=local
+DATABASE_URL=postgres://nucleos_dev@127.0.0.1:15432/nucleos_dev
+DATABASE_PASSWORD=
+# Use a senha do Postgres local ja criado; mudar este valor nao altera a senha no banco.
+HOTMART_ENV=production
+HOTMART_CLIENT_ID=
+HOTMART_CLIENT_SECRET=
+HOTMART_SYNC_INTERVAL=30m
+HOTMART_BACKFILL_DAYS=90
+# Mesma chave privada na API e no servidor web; vazia => vendas fechadas (503).
+VENDAS_API_KEY=
+VENDAS_API_URL=http://127.0.0.1:3001
+# APP_ENV=staging|production exige DATABASE_URL e DATABASE_PASSWORD (ou *_FILE).
+# PORT=3001 REQUEST_TIMEOUT=30s SHUTDOWN_TIMEOUT=10s MAX_BODY_SIZE=1mb
+# DATABASE_URL continua sem senha: use DATABASE_PASSWORD separadamente.
+# Alternativa compativel: <NOME>_FILE=/run/secrets/<nome>, arquivo 0400/0600.
+# Nao configure valor direto e *_FILE para a mesma credencial.

--- a/packages/config/src/load.ts
+++ b/packages/config/src/load.ts
@@ -1,6 +1,8 @@
 import type { z } from "zod";
 import { type SecretFileReason, SecretFileError, readSecretFile } from "./secret.js";
-import type { Secret } from "./secret.js";
+import { Secret, MAX_SECRET_BYTES } from "./secret.js";
+import { loadEnvFile } from "node:process";
+import { fileURLToPath } from "node:url";
 
 export interface ConfigIssue {
   /** Nome da variavel (ou do campo) com problema. Nunca o valor recebido. */
@@ -48,9 +50,9 @@
 ];
 
 /**
- * Nome de variavel que indica segredo literal (ADR-020 item 1): algum token separado por `_`
+ * Classificador legado de nomes de segredo (nao bloqueia o ambiente do MVP): algum token separado por `_`
  * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
- * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de config-py e deploy-lib.mjs.
+ * `_FILE`/`_PATH` (caminho) indicam caminhos. Mesma regra de config-py e deploy-lib.mjs.
  */
 /** Variaveis POSIX/shell que nao carregam segredo e colidem com os tokens. */
 const NOT_SECRET = new Set(["PWD", "OLDPWD"]);
@@ -87,16 +89,15 @@
 
 /**
  * Valida `env` com o esquema (zod) e falha rapido. Regras:
- * - variavel com nome de segredo no ambiente => erro (so `*_FILE` e aceito);
+ * - segredos no ambiente sao permitidos no MVP;
  * - erros do esquema viram `ConfigIssue` por chave, sem o valor recebido.
  * Entradas vazias (`""`) contam como ausentes.
  */
 export function parseConfig<S extends z.ZodType>(schema: S, env: Env): z.output<S> {
-  const issues: ConfigIssue[] = forbiddenSecretEnv(env).map((key) => ({
-    key,
-    message: "segredo por variavel de ambiente e proibido (use <NOME>_FILE com caminho de arquivo)",
-  }));
-  const input = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
+  const issues: ConfigIssue[] = [];
+  const input = Object.fromEntries(
+    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
+  );
   const result = schema.safeParse(input);
   if (!result.success) {
     for (const issue of result.error.issues) {
@@ -117,3 +118,35 @@
     throw new ConfigError([{ key, message: SECRET_FILE_MESSAGES[reason] }]);
   }
 }
+
+/** Carrega o .env da raiz sem sobrescrever variaveis ja exportadas pelo operador. */
+export function loadEnvironment(
+  path = fileURLToPath(new URL("../../../.env", import.meta.url)),
+): NodeJS.ProcessEnv {
+  try {
+    loadEnvFile(path);
+  } catch (e) {
+    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
+      throw new ConfigError([{ key: ".env", message: "arquivo de ambiente ilegivel" }]);
+    }
+  }
+  return process.env;
+}
+
+/** Valor direto ou arquivo: fontes simultaneas sao erro, sem precedencia silenciosa. */
+export function loadOptionalSecret(
+  key: string,
+  value: string | undefined,
+  path: string | undefined,
+): Secret | undefined {
+  if (value !== undefined && value !== "" && path !== undefined && path !== "") {
+    throw new ConfigError([{ key, message: "informe o valor ou o arquivo, nunca ambos" }]);
+  }
+  if (value !== undefined && value !== "") {
+    if (Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES) {
+      throw new ConfigError([{ key, message: "segredo grande demais" }]);
+    }
+    return new Secret(value);
+  }
+  return path === undefined || path === "" ? undefined : loadSecret(`${key}_FILE`, path);
+}

--- a/packages/config/src/api.ts
+++ b/packages/config/src/api.ts
@@ -1,5 +1,5 @@
 import { z } from "zod";
-import { ConfigError, loadSecret, parseConfig } from "./load.js";
+import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
 import type { Secret } from "./secret.js";
 import { absolutePathSchema, durationMs, portSchema, serviceUrl, sizeBytes } from "./primitives.js";
 
@@ -22,11 +22,13 @@
     SHUTDOWN_TIMEOUT: durationMs(100, 120_000).default(10_000),
     MAX_BODY_SIZE: sizeBytes(1, 10 * 1024 * 1024).default(1024 * 1024),
     DATABASE_URL: serviceUrl(["postgres", "postgresql"]).optional(),
+    DATABASE_PASSWORD: z.string().optional(),
     DATABASE_PASSWORD_FILE: absolutePathSchema.optional(),
   })
   .superRefine((v, ctx) => {
     if (!STRICT_ENVS.includes(v.APP_ENV)) return;
-    for (const key of ["DATABASE_URL", "DATABASE_PASSWORD_FILE"] as const) {
+    for (const key of ["DATABASE_URL", "DATABASE_PASSWORD"] as const) {
+      if (key === "DATABASE_PASSWORD" && v.DATABASE_PASSWORD_FILE !== undefined) continue;
       if (v[key] === undefined) {
         ctx.addIssue({ code: "custom", path: [key], message: `obrigatoria em ${v.APP_ENV}` });
       }
@@ -42,22 +44,23 @@
   readonly shutdownTimeoutMs: number;
   readonly maxBodyBytes: number;
   readonly databaseUrl: string | undefined;
-  /** Senha do banco lida de arquivo; `undefined` apenas em local/ci. */
+  /** Senha do banco do ambiente ou arquivo; `undefined` apenas em local/ci. */
   readonly databasePassword: Secret | undefined;
 }
 
 /**
  * Carrega e valida a configuracao do `apps/api`. Lanca `ConfigError` (sem valores) se ausente ou
- * invalida; segredos so por arquivo (`DATABASE_PASSWORD_FILE`), com checagem de permissoes.
+ * invalida; aceita DATABASE_PASSWORD ou DATABASE_PASSWORD_FILE (compatibilidade).
  */
 export function loadApiConfig(
-  env: Readonly<Record<string, string | undefined>> = process.env,
+  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
 ): ApiConfig {
   const e = parseConfig(apiEnvSchema, env);
-  const databasePassword =
-    e.DATABASE_PASSWORD_FILE === undefined
-      ? undefined
-      : loadSecret("DATABASE_PASSWORD_FILE", e.DATABASE_PASSWORD_FILE);
+  const databasePassword = loadOptionalSecret(
+    "DATABASE_PASSWORD",
+    e.DATABASE_PASSWORD,
+    e.DATABASE_PASSWORD_FILE,
+  );
   return {
     appEnv: e.APP_ENV,
     appVersion: e.APP_VERSION,

--- a/packages/config/src/secret.ts
+++ b/packages/config/src/secret.ts
@@ -4,7 +4,7 @@
 export const MAX_SECRET_BYTES = 16 * 1024;
 
 /**
- * Segredo lido de arquivo. Nunca imprime o valor: `toString`, `toJSON` e `inspect` devolvem
+ * Segredo do ambiente ou arquivo. Nunca imprime o valor: `toString`, `toJSON` e `inspect` devolvem
  * `[REDACTED]`. O valor so sai por `reveal()`, chamado no ponto de uso (ex.: abrir conexao).
  */
 export class Secret {

--- a/packages/config/src/config.test.ts
+++ b/packages/config/src/config.test.ts
@@ -3,6 +3,7 @@
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { mock, test } from "node:test";
+import { loadEnvironment } from "./load.js";
 import {
   ConfigError,
   MAX_SECRET_BYTES,
@@ -15,6 +16,25 @@
 } from "./index.js";
 
 const SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a";
+
+test("dotenv: carrega arquivo, preserva ambiente exportado e nao revela erro de leitura", () => {
+  withDir((dir) => {
+    const path = join(dir, ".env");
+    writeFileSync(path, "NUCLEOS_TEST_SECRET=sentinela-dotenv\nNUCLEOS_TEST_PORT=1234\n");
+    process.env["NUCLEOS_TEST_PORT"] = "4321";
+    try {
+      const env = loadEnvironment(path);
+      assert.equal(env["NUCLEOS_TEST_SECRET"], "sentinela-dotenv");
+      assert.equal(env["NUCLEOS_TEST_PORT"], "4321");
+      assert.doesNotThrow(() => loadEnvironment(join(dir, "ausente")));
+      const e = failure(() => loadEnvironment(dir));
+      assert.ok(!e.message.includes(dir));
+    } finally {
+      delete process.env["NUCLEOS_TEST_SECRET"];
+      delete process.env["NUCLEOS_TEST_PORT"];
+    }
+  });
+});
 
 function withDir<T>(fn: (dir: string) => T): T {
   const dir = mkdtempSync(join(tmpdir(), "cfg-"));
@@ -74,7 +94,7 @@
 test("staging/producao exigem banco e segredo (falha rapida, so nomes)", () => {
   for (const appEnv of ["staging", "production"]) {
     const e = failure(() => loadApiConfig({ APP_ENV: appEnv }));
-    assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]);
+    assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_PASSWORD", "DATABASE_URL"]);
   }
 });
 
@@ -88,7 +108,8 @@
     }),
   );
   const keys = e.issues.map((i) => i.key);
-  for (const k of ["APP_ENV", "PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]) assert.ok(keys.includes(k), k);
+  for (const k of ["APP_ENV", "PORT", "REQUEST_TIMEOUT", "DATABASE_URL"])
+    assert.ok(keys.includes(k), k);
   assert.ok(!e.message.includes(SENTINEL));
   assert.ok(!JSON.stringify(e.issues).includes(SENTINEL));
   assert.ok(!String(e.stack).includes(SENTINEL));
@@ -106,14 +127,27 @@
   assert.ok(!e.message.includes(SENTINEL));
 });
 
-test("segredo literal por ambiente e proibido; vazio conta como ausente", () => {
+test("segredo literal por ambiente e aceito; vazio conta como ausente", () => {
   assert.deepEqual(
-    forbiddenSecretEnv({ DATABASE_PASSWORD: "x", API_KEY: "y", DATABASE_PASSWORD_FILE: "/a", PORT: "1" }),
+    forbiddenSecretEnv({
+      DATABASE_PASSWORD: "x",
+      API_KEY: "y",
+      DATABASE_PASSWORD_FILE: "/a",
+      PORT: "1",
+    }),
     ["API_KEY", "DATABASE_PASSWORD"],
   );
-  const e = failure(() => loadApiConfig({ DATABASE_PASSWORD: SENTINEL }));
-  assert.deepEqual(e.issues.map((i) => i.key), ["DATABASE_PASSWORD"]);
+  const c = loadApiConfig({ DATABASE_PASSWORD: SENTINEL });
+  assert.equal(c.databasePassword?.reveal(), SENTINEL);
+  assert.ok(!JSON.stringify(c).includes(SENTINEL));
+  const e = failure(() =>
+    loadApiConfig({ DATABASE_PASSWORD: SENTINEL, DATABASE_PASSWORD_FILE: "/unused" }),
+  );
   assert.ok(!e.message.includes(SENTINEL));
+  assert.throws(
+    () => loadApiConfig({ DATABASE_PASSWORD: "a".repeat(MAX_SECRET_BYTES + 1) }),
+    ConfigError,
+  );
   assert.equal(loadApiConfig({ DATABASE_PASSWORD: "", PORT: "" }).port, 3001);
 });
 
@@ -155,7 +189,10 @@
     const real = process.getuid?.() ?? 0;
     const m = mock.method(process as { getuid: () => number }, "getuid", () => real + 1);
     try {
-      assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "dono-diferente");
+      assert.throws(
+        () => readSecretFile(p),
+        (e: unknown) => e instanceof SecretFileError && e.reason === "dono-diferente",
+      );
     } finally {
       m.mock.restore();
     }
@@ -169,7 +206,10 @@
     assert.equal(readSecretFile(at).reveal().length, MAX_SECRET_BYTES);
     const over = join(dir, "acima");
     writeFileSync(over, "a".repeat(MAX_SECRET_BYTES + 1), { mode: 0o400 });
-    assert.throws(() => readSecretFile(over), (e: unknown) => e instanceof SecretFileError && e.reason === "grande-demais");
+    assert.throws(
+      () => readSecretFile(over),
+      (e: unknown) => e instanceof SecretFileError && e.reason === "grande-demais",
+    );
   });
 });
 
@@ -177,15 +217,33 @@
   withDir((dir) => {
     const p = join(dir, "bin");
     writeFileSync(p, Buffer.from([0x61, 0xff, 0xfe, 0x62]), { mode: 0o400 });
-    assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "ilegivel");
+    assert.throws(
+      () => readSecretFile(p),
+      (e: unknown) => e instanceof SecretFileError && e.reason === "ilegivel",
+    );
   });
 });
 
 test("nomes de segredo por token e sufixo; *_FILE e *_PATH permitidos", () => {
-  for (const n of ["API_TOKEN", "X_SECRET", "DB_PASS", "SECRET_KEY", "AWS_SECRET_ACCESS_KEY", "DBPASSWORD", "A_DSN"]) {
+  for (const n of [
+    "API_TOKEN",
+    "X_SECRET",
+    "DB_PASS",
+    "SECRET_KEY",
+    "AWS_SECRET_ACCESS_KEY",
+    "DBPASSWORD",
+    "A_DSN",
+  ]) {
     assert.ok(isSecretName(n), n);
   }
-  for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "OTEL_SERVICE_NAME", "KEYBOARD", "PORT", "PASSTHROUGH"]) {
+  for (const n of [
+    "DATABASE_PASSWORD_FILE",
+    "SSH_KEY_PATH",
+    "OTEL_SERVICE_NAME",
+    "KEYBOARD",
+    "PORT",
+    "PASSTHROUGH",
+  ]) {
     assert.ok(!isSecretName(n), n);
   }
 });

--- a/packages/config/src/vendas.ts
+++ b/packages/config/src/vendas.ts
@@ -1,5 +1,5 @@
 import { z } from "zod";
-import { loadSecret, parseConfig } from "./load.js";
+import { loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
 import type { Secret } from "./secret.js";
 import { absolutePathSchema, durationMs } from "./primitives.js";
 
@@ -9,6 +9,8 @@
 const vendasEnvSchema = z
   .object({
     HOTMART_ENV: z.enum(HOTMART_ENVS).default("production"),
+    HOTMART_CLIENT_ID: z.string().optional(),
+    HOTMART_CLIENT_SECRET: z.string().optional(),
     HOTMART_CLIENT_ID_FILE: absolutePathSchema.optional(),
     HOTMART_CLIENT_SECRET_FILE: absolutePathSchema.optional(),
     /** Intervalo entre sincronizacoes; padrao de 30 minutos. */
@@ -20,16 +22,20 @@
       .transform(Number)
       .pipe(z.number().int().min(1).max(1825))
       .default(90),
-    /** Chave de servico exigida em `/v1/vendas/*` (bearer lido de arquivo). */
+    /** Chave de servico exigida em `/v1/vendas/*`. */
+    VENDAS_API_KEY: z.string().optional(),
     VENDAS_API_KEY_FILE: absolutePathSchema.optional(),
   })
   .superRefine((v, ctx) => {
-    const par = [v.HOTMART_CLIENT_ID_FILE, v.HOTMART_CLIENT_SECRET_FILE];
+    const par = [
+      v.HOTMART_CLIENT_ID ?? v.HOTMART_CLIENT_ID_FILE,
+      v.HOTMART_CLIENT_SECRET ?? v.HOTMART_CLIENT_SECRET_FILE,
+    ];
     if (par.some((p) => p === undefined) && par.some((p) => p !== undefined)) {
       ctx.addIssue({
         code: "custom",
-        path: ["HOTMART_CLIENT_SECRET_FILE"],
-        message: "informe HOTMART_CLIENT_ID_FILE e HOTMART_CLIENT_SECRET_FILE juntos",
+        path: ["HOTMART_CLIENT_SECRET"],
+        message: "informe HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET juntos (valor ou *_FILE)",
       });
     }
   });
@@ -51,24 +57,26 @@
 
 /** Configuracao do modulo de vendas (integracao Hotmart + chave de servico). Sem valores nos erros. */
 export function loadVendasConfig(
-  env: Readonly<Record<string, string | undefined>> = process.env,
+  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
 ): VendasConfig {
   const e = parseConfig(vendasEnvSchema, env);
+  const clientId = loadOptionalSecret(
+    "HOTMART_CLIENT_ID",
+    e.HOTMART_CLIENT_ID,
+    e.HOTMART_CLIENT_ID_FILE,
+  );
+  const clientSecret = loadOptionalSecret(
+    "HOTMART_CLIENT_SECRET",
+    e.HOTMART_CLIENT_SECRET,
+    e.HOTMART_CLIENT_SECRET_FILE,
+  );
   const hotmart =
-    e.HOTMART_CLIENT_ID_FILE !== undefined && e.HOTMART_CLIENT_SECRET_FILE !== undefined
-      ? {
-          clientId: loadSecret("HOTMART_CLIENT_ID_FILE", e.HOTMART_CLIENT_ID_FILE),
-          clientSecret: loadSecret("HOTMART_CLIENT_SECRET_FILE", e.HOTMART_CLIENT_SECRET_FILE),
-        }
-      : undefined;
+    clientId !== undefined && clientSecret !== undefined ? { clientId, clientSecret } : undefined;
   return {
     hotmartEnv: e.HOTMART_ENV,
     hotmart,
     syncIntervalMs: e.HOTMART_SYNC_INTERVAL,
     backfillDays: e.HOTMART_BACKFILL_DAYS,
-    apiKey:
-      e.VENDAS_API_KEY_FILE === undefined
-        ? undefined
-        : loadSecret("VENDAS_API_KEY_FILE", e.VENDAS_API_KEY_FILE),
+    apiKey: loadOptionalSecret("VENDAS_API_KEY", e.VENDAS_API_KEY, e.VENDAS_API_KEY_FILE),
   };
 }

--- a/packages/config/src/vendas.test.ts
+++ b/packages/config/src/vendas.test.ts
@@ -30,7 +30,7 @@
   }
 });
 
-test("vendas: credenciais so por arquivo e sempre em par; erros nao ecoam valores", () => {
+test("vendas: credenciais por arquivo ou ambiente e sempre em par; erros nao ecoam valores", () => {
   assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_ID_FILE: "/run/secrets/id" }), ConfigError);
   assert.throws(
     () =>
@@ -48,3 +48,29 @@
       /HOTMART_CLIENT_SECRET/.test(e.message),
   );
 });
+
+test("vendas: credenciais diretas protegidas e fontes conflitantes recusadas", () => {
+  const c = loadVendasConfig({
+    HOTMART_CLIENT_ID: "id-teste",
+    HOTMART_CLIENT_SECRET: "sentinela-teste",
+    VENDAS_API_KEY: "chave-teste",
+  });
+  assert.ok(c.hotmart);
+  assert.equal(c.hotmart.clientId.reveal(), "id-teste");
+  assert.equal(c.hotmart.clientSecret.reveal(), "sentinela-teste");
+  assert.equal(c.apiKey?.reveal(), "chave-teste");
+  assert.ok(!JSON.stringify(c).includes("sentinela-teste"));
+  for (const key of ["HOTMART_CLIENT_ID", "HOTMART_CLIENT_SECRET", "VENDAS_API_KEY"]) {
+    assert.throws(
+      () =>
+        loadVendasConfig({
+          HOTMART_CLIENT_ID: "id",
+          HOTMART_CLIENT_SECRET: "secret",
+          VENDAS_API_KEY: "key",
+          [key + "_FILE"]: "/unused",
+        }),
+      ConfigError,
+    );
+  }
+  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_ID: "id" }), ConfigError);
+});

--- a/packages/config/paridade-casos.json
+++ b/packages/config/paridade-casos.json
@@ -200,84 +200,84 @@
    "env": {
     "DB_PASS": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo SECRET_KEY",
    "env": {
     "SECRET_KEY": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo JWT_SECRET_KEY",
    "env": {
     "JWT_SECRET_KEY": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo AWS_SECRET_ACCESS_KEY",
    "env": {
     "AWS_SECRET_ACCESS_KEY": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo ACCESS_KEY",
    "env": {
     "ACCESS_KEY": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo API_TOKEN",
    "env": {
     "API_TOKEN": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo DB_PASSWORD",
    "env": {
     "DB_PASSWORD": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo STRIPE_SECRET",
    "env": {
     "STRIPE_SECRET": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo DB_DSN",
    "env": {
     "DB_DSN": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo DBPASSWORD",
    "env": {
     "DBPASSWORD": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo API_KEY",
    "env": {
     "API_KEY": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome de segredo X_PWD",
    "env": {
     "X_PWD": "valor"
    },
-   "aceita": false
+   "aceita": true
   },
   {
    "caso": "nome legitimo SSH_KEY_PATH",
@@ -306,6 +306,23 @@
     "TOKENIZER_MODE": "x"
    },
    "aceita": true
+  },
+  {
+   "caso": "senha direta em producao",
+   "env": {
+    "APP_ENV": "production",
+    "DATABASE_URL": "postgres://u@h/db",
+    "DATABASE_PASSWORD": "SENT"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "fontes conflitantes",
+   "env": {
+    "DATABASE_PASSWORD": "SENT",
+    "DATABASE_PASSWORD_FILE": "/unused"
+   },
+   "aceita": false
   }
  ]
-}+}

--- a/packages/config-py/src/nucleos_config/settings.py
+++ b/packages/config-py/src/nucleos_config/settings.py
@@ -7,14 +7,22 @@
 from typing import Annotated, Literal
 from urllib.parse import parse_qsl
 
-from pydantic import AfterValidator, AnyUrl, BaseModel, Field, ValidationError, field_validator
+from pydantic import (
+    AfterValidator,
+    AnyUrl,
+    BaseModel,
+    Field,
+    SecretStr,
+    ValidationError,
+    field_validator,
+)
 from pydantic_settings import (
     BaseSettings,
     PydanticBaseSettingsSource,
     SettingsConfigDict,
 )
 
-from .secret import Secret, SecretFileError, read_secret_file
+from .secret import MAX_SECRET_BYTES, Secret, SecretFileError, read_secret_file
 
 _SECRET_TOKENS = frozenset(
     {"PASS", "PASSWORD", "PASSWD", "PWD", "SECRET", "TOKEN", "KEY", "APIKEY", "CREDENTIAL"}
@@ -111,6 +119,7 @@
     PORT: int = Field(8000, ge=1, le=65535)
     REQUEST_TIMEOUT: int = 30_000  # ms; do ambiente: "500ms", "30s", "5m", "1h"
     DATABASE_URL: ServiceUrl | None = None
+    DATABASE_PASSWORD: SecretStr | None = None
     DATABASE_PASSWORD_FILE: AbsolutePath | None = None
 
     @classmethod
@@ -152,13 +161,7 @@
 ) -> tuple[ServiceSettings, Secret | None]:
     """Valida `env` e le o segredo do banco. Levanta `ConfigError` (sem valores) se invalido."""
     clean = {k: v for k, v in env.items() if v != ""}
-    issues = [
-        ConfigIssue(
-            key=k,
-            message="segredo por variavel de ambiente e proibido (use <NOME>_FILE)",
-        )
-        for k in forbidden_secret_env(clean)
-    ]
+    issues: list[ConfigIssue] = []
     settings: ServiceSettings | None = None
     try:
         settings = model.model_validate(clean)
@@ -172,10 +175,19 @@
     if settings is not None and settings.APP_ENV in _STRICT:
         issues.extend(
             ConfigIssue(key=k, message=f"obrigatoria em {settings.APP_ENV}")
-            for k in ("DATABASE_URL", "DATABASE_PASSWORD_FILE")
+            for k in ("DATABASE_URL", "DATABASE_PASSWORD")
             if getattr(settings, k) is None
+            and not (k == "DATABASE_PASSWORD" and settings.DATABASE_PASSWORD_FILE is not None)
         )
     secret: Secret | None = None
+    if settings is not None and settings.DATABASE_PASSWORD is not None:
+        value = settings.DATABASE_PASSWORD.get_secret_value()
+        if settings.DATABASE_PASSWORD_FILE is not None:
+            issues.append(ConfigIssue(key="DATABASE_PASSWORD", message="informe valor ou arquivo"))
+        elif len(value.encode("utf-8")) > MAX_SECRET_BYTES:
+            issues.append(ConfigIssue(key="DATABASE_PASSWORD", message="segredo grande demais"))
+        else:
+            secret = Secret(value)
     if settings is not None and settings.DATABASE_PASSWORD_FILE is not None and not issues:
         try:
             secret = read_secret_file(settings.DATABASE_PASSWORD_FILE)

--- a/packages/config-py/src/nucleos_config/secret.py
+++ b/packages/config-py/src/nucleos_config/secret.py
@@ -1,4 +1,4 @@
-"""Leitura de segredos por arquivo (ADR-020, item 1): nunca por variavel de ambiente."""
+"""Leitura de segredos por arquivo (ADR-020, item 1): alternativa ao ambiente no MVP."""
 
 from __future__ import annotations
 

--- a/packages/config-py/tests/test_config.py
+++ b/packages/config-py/tests/test_config.py
@@ -59,7 +59,7 @@
 def test_strict_envs_require_database(app_env: str) -> None:
     with pytest.raises(ConfigError) as ei:
         load_settings({"APP_ENV": app_env})
-    assert keys(ei.value) == ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]
+    assert keys(ei.value) == ["DATABASE_PASSWORD", "DATABASE_URL"]
 
 
 def test_invalid_values_never_echo_input() -> None:
@@ -77,13 +77,16 @@
     assert SENTINEL not in repr(ei.value.issues)
 
 
-def test_secret_in_environment_is_forbidden() -> None:
+def test_secret_in_environment_is_supported() -> None:
     assert forbidden_secret_env({"DATABASE_PASSWORD": "x", "DATABASE_PASSWORD_FILE": "/a"}) == [
         "DATABASE_PASSWORD"
     ]
-    with pytest.raises(ConfigError) as ei:
-        load_settings({"DATABASE_PASSWORD": SENTINEL})
-    assert keys(ei.value) == ["DATABASE_PASSWORD"]
+    settings, secret = load_settings({"DATABASE_PASSWORD": SENTINEL})
+    assert secret is not None
+    assert secret.reveal() == SENTINEL
+    assert SENTINEL not in repr(settings) + repr(secret)
+    with pytest.raises(ConfigError) as ei:
+        load_settings({"DATABASE_PASSWORD": SENTINEL, "DATABASE_PASSWORD_FILE": "/unused"})
     assert SENTINEL not in str(ei.value)
     assert load_settings({"DATABASE_PASSWORD": "", "PORT": ""})[0].PORT == 8000
 

--- a/apps/web/next.config.mjs
+++ b/apps/web/next.config.mjs
@@ -1,3 +1,13 @@
+import { loadEnvFile } from "node:process";
+import { fileURLToPath } from "node:url";
+
+// Segredos ficam no servidor: nao usar nextConfig.env nem NEXT_PUBLIC_*.
+try {
+  loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
+} catch (error) {
+  if (error.code !== "ENOENT") throw new Error("arquivo .env ilegivel");
+}
+
 /** @type {import('next').NextConfig} */
 const nextConfig = { reactStrictMode: true };
 export default nextConfig;

--- a/apps/web/lib/vendas-api.ts
+++ b/apps/web/lib/vendas-api.ts
@@ -1,6 +1,6 @@
 /**
  * Acesso do servidor Next.js a API de vendas. Roda somente no servidor: a chave de servico e lida
- * de arquivo (VENDAS_API_KEY_FILE) e nunca vai para o HTML, para o cliente ou para logs.
+ * do ambiente (VENDAS_API_KEY) ou arquivo e nunca vai para o HTML, cliente ou logs.
  */
 import { readFileSync } from "node:fs";
 import type { ListaVendas, PainelVendas } from "@nucleos/contracts";
@@ -17,9 +17,10 @@
 
 function configuracao(): { base: string; chave: string } | undefined {
   const arquivo = process.env["VENDAS_API_KEY_FILE"];
-  if (arquivo === undefined || arquivo === "") return undefined;
+  const direta = process.env["VENDAS_API_KEY"];
   try {
-    const chave = readFileSync(arquivo, "utf8").trim();
+    if (direta && arquivo) return undefined;
+    const chave = direta || (arquivo ? readFileSync(arquivo, "utf8").replace(/\n$/, "") : "");
     if (chave === "") return undefined;
     return { base: (process.env["VENDAS_API_URL"] ?? URL_PADRAO).replace(/\/+$/, ""), chave };
   } catch {

--- a/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
+++ b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
@@ -37,7 +37,7 @@
         <div className="state-box" role="status">
           <p>
             O painel ainda não está conectado à API de vendas. Defina{" "}
-            <code>VENDAS_API_KEY_FILE</code> (arquivo com a chave de serviço) e, se a API não
+            <code>VENDAS_API_KEY</code> (chave de serviço no .env) e, se a API não
             estiver em <code>http://127.0.0.1:3001</code>, <code>VENDAS_API_URL</code> no servidor
             web.
           </p>

--- a/apps/web/app/vendas-env.test.ts
+++ b/apps/web/app/vendas-env.test.ts
@@ -0,0 +1,25 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { carregarPainel } from "../lib/vendas-api.ts";
+
+test("web usa chave do ambiente apenas no bearer e fecha acesso com fontes conflitantes", async (t) => {
+  const original = { ...process.env };
+  process.env["VENDAS_API_KEY"] = "sentinela-web";
+  delete process.env["VENDAS_API_KEY_FILE"];
+  let chamadas = 0;
+  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
+    chamadas++;
+    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sentinela-web");
+    return new Response(JSON.stringify({ indicadores: {}, serieDiaria: [], sincronizacao: {} }));
+  });
+  try {
+    const resultado = await carregarPainel({});
+    assert.equal(resultado.tipo, "ok");
+    assert.ok(!JSON.stringify(resultado).includes("sentinela-web"));
+    process.env["VENDAS_API_KEY_FILE"] = "/unused";
+    assert.equal((await carregarPainel({})).tipo, "nao-configurado");
+    assert.equal(chamadas, 1);
+  } finally {
+    process.env = original;
+  }
+});

--- a/infrastructure/docker/tests/ambientes.test.mjs
+++ b/infrastructure/docker/tests/ambientes.test.mjs
@@ -107,8 +107,8 @@
   test("porta/duracao/URL invalidas", () => {
     check(runApi({ PORT: `x${SENT}`, REQUEST_TIMEOUT: SENT, DATABASE_URL: `postgres://u:${SENT}@h/db` }), ["PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]);
   });
-  test("staging sem banco/segredo", () => check(runApi({ APP_ENV: "staging" }), ["DATABASE_URL", "DATABASE_PASSWORD_FILE"]));
-  test("segredo por variavel de ambiente", () => check(runApi({ DATABASE_PASSWORD: SENT }), ["DATABASE_PASSWORD"]));
+  test("staging sem banco/segredo", () => check(runApi({ APP_ENV: "staging" }), ["DATABASE_URL", "DATABASE_PASSWORD"]));
+  test("fontes de segredo conflitantes", () => check(runApi({ DATABASE_PASSWORD: SENT, DATABASE_PASSWORD_FILE: "/unused" }), ["DATABASE_PASSWORD"]));
   test("arquivo de segredo com permissao aberta", () => {
     const f = join(dir, "pw"); writeFileSync(f, `${SENT}\n`); chmodSync(f, 0o644);
     check(runApi({ DATABASE_PASSWORD_FILE: "/run/pw" }, ["-v", `${f}:/run/pw:ro`]), ["DATABASE_PASSWORD_FILE", "permissoes"]);

--- a/apps/api/src/migrar.ts
+++ b/apps/api/src/migrar.ts
@@ -95,7 +95,7 @@
 if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
   try {
     // `--senha-stdin`: a senha vem da entrada padrao (nunca de env, argumento ou historico), para
-    // uso do operador em dev. Sem a flag, vale a regra do servico: DATABASE_PASSWORD_FILE.
+    // uso do operador em dev. Sem a flag, vale a regra do servico: DATABASE_PASSWORD ou DATABASE_PASSWORD_FILE.
     const porStdin = process.argv.includes("--senha-stdin");
     let url: string | undefined;
     let senha: string | undefined;
```
