# FND-006 — Diffs da entrega

Data: 2026-10-26. Resumo e contexto: [documento principal](2026-10-26-fnd-006-configuracao-tipada-e-ambientes.md).

Commit de codigo da tarefa: `8e5194d` (`git show 8e5194d`, base `d00e8df`). Nenhum segredo real foi redigido: os unicos valores secretos nos arquivos sao sentinelas aleatorias geradas em tempo de execucao (nao estao no diff). Os arquivos de `documentacoes/` e `lessons/` e as linhas de `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` ficam fora deste patch para evitar recursao (ver lista no documento principal). `pnpm-lock.yaml` e `uv.lock` sao incluidos.

````diff
commit 8e5194d59a9fc7c5b18b9cc916d31bb837d2b4dd
feat(infra): configuracao tipada, overlays de staging/prod e deploy por digest (FND-006)


diff --git a/.env.example b/.env.example
index 3bb8b30..8d66aae 100644
--- a/.env.example
+++ b/.env.example
@@ -15,3 +15,10 @@ PROXY_HOST_PORT=18080
 OTLP_GRPC_HOST_PORT=14317
 OTLP_HTTP_HOST_PORT=14318
 OTEL_HEALTH_HOST_PORT=13133
+
+# --- Configuracao tipada (FND-006; packages/config e packages/config-py) ---
+# Validada na subida (falha rapida; a mensagem lista so nomes de variaveis, nunca valores).
+# APP_ENV=local|ci|staging|production (staging/production exigem DATABASE_URL e DATABASE_PASSWORD_FILE)
+# PORT=3001  REQUEST_TIMEOUT=30s  SHUTDOWN_TIMEOUT=10s  MAX_BODY_SIZE=1mb
+# DATABASE_URL=postgres://usuario@host:5432/banco   (SEM senha na URL)
+# DATABASE_PASSWORD_FILE=/run/secrets/database_password   (arquivo 0400; segredos NUNCA por variavel)
diff --git a/Makefile b/Makefile
index 19a0257..d2fb3b7 100644
--- a/Makefile
+++ b/Makefile
@@ -10,7 +10,7 @@ export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
 export TURBO_TELEMETRY_DISABLED=1
 export DO_NOT_TRACK=1
 
-.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows format hooks
+.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows lint-deploy test-ambientes format hooks
 
 setup:
 	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
@@ -22,6 +22,7 @@ setup:
 lint: lint-ts lint-py
 	./scripts/check-secrets.sh
 	$(MAKE) lint-regressao
+	$(MAKE) lint-deploy
 
 lint-ts: check-env
 	$(PNPM) run lint
@@ -39,6 +40,10 @@ lint-py:
 lint-regressao:
 	node tools/qualidade/regressao.mjs
 
+# Overlays de staging/producao (FND-006): sem segredo literal, digest, hardening, portas em 127.0.0.1.
+lint-deploy:
+	node infrastructure/docker/scripts/verificar-deploy.mjs
+
 # Sintaxe (actionlint) e politica (SHA, permissions, sem pull_request_target) dos workflows.
 lint-workflows:
 	actionlint .github/workflows/*.yml
@@ -93,3 +98,8 @@ compose-reset:
 
 compose-smoke:
 	./infrastructure/docker/scripts/smoke.sh $(if $(findstring runtime,$(PERFIS)),--runtime) $(if $(findstring observability,$(PERFIS)),--observability)
+
+# Ensaio efemero de config/deploy/rollback e ausencia de segredo em inspect/env/logs (FND-006).
+# Requer Docker e `make build`; containers descartaveis em 127.0.0.1, destruidos ao final.
+test-ambientes: build
+	node --test infrastructure/docker/tests/ambientes.test.mjs
diff --git a/apps/api/package.json b/apps/api/package.json
index f23b3f8..b2f33e3 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -13,6 +13,7 @@
     "@nestjs/common": "12.2.0",
     "@nestjs/core": "12.2.0",
     "@nestjs/platform-express": "12.2.0",
+    "@nucleos/config": "workspace:*",
     "@nucleos/contracts": "workspace:*",
     "@nucleos/observability": "workspace:*",
     "reflect-metadata": "0.2.2",
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index c0fb412..199aea7 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -1,11 +1,23 @@
 import "reflect-metadata";
+import { ConfigError, loadApiConfig } from "@nucleos/config";
 import { NestFactory } from "@nestjs/core";
 import { AppModule } from "./app.module.js";
 import { createApiObservability, observabilityMiddleware } from "./observability.js";
 
-const host = process.env["HOST"] ?? "127.0.0.1";
-const port = Number(process.env["PORT"] ?? 3001);
+// Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
+// nomes de variaveis e motivos, nunca valores.
+let config;
+try {
+  config = loadApiConfig();
+} catch (e) {
+  if (e instanceof ConfigError) {
+    console.error(`api: ${e.message}`);
+    process.exit(1);
+  }
+  throw e;
+}
+
 const app = await NestFactory.create(AppModule);
-app.use(observabilityMiddleware(createApiObservability()));
-await app.listen(port, host);
-console.log(`api em http://${host}:${port}`);
+app.use(observabilityMiddleware(createApiObservability(config)));
+await app.listen(config.port, config.host);
+console.log(`api em http://${config.host}:${String(config.port)} (${config.appEnv})`);
diff --git a/apps/api/src/observability.ts b/apps/api/src/observability.ts
index 62f9cc1..ebd39b9 100644
--- a/apps/api/src/observability.ts
+++ b/apps/api/src/observability.ts
@@ -1,4 +1,5 @@
 import type { IncomingMessage, ServerResponse } from "node:http";
+import type { ApiConfig } from "@nucleos/config";
 import {
   type Observability,
   createObservability,
@@ -9,12 +10,8 @@ import {
 /** `req.route` e preenchido pelo Express ao casar a rota (sem depender de @types/express). */
 type ExpressLike = IncomingMessage & { route?: { path?: string } };
 
-export function createApiObservability(): Observability {
-  const meta = {
-    service: "api",
-    version: process.env["APP_VERSION"] ?? "0.0.0",
-    env: process.env["APP_ENV"] ?? "local",
-  };
+export function createApiObservability(config: ApiConfig): Observability {
+  const meta = { service: "api", version: config.appVersion, env: config.appEnv };
   return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
 }
 
diff --git a/infrastructure/docker/README.md b/infrastructure/docker/README.md
index 9cdce90..e7c6422 100644
--- a/infrastructure/docker/README.md
+++ b/infrastructure/docker/README.md
@@ -8,3 +8,8 @@ Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`.
 - Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
 - Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
 - Apps do perfil `runtime`: repo montado somente leitura (web tem escrita so em `apps/web`) e `.env.local` mascarado por `/dev/null` (apps nao recebem segredos do Compose).
+
+## Staging e producao (FND-006)
+
+- `compose.deploy.yml` (base) + `compose.staging.yml` / `compose.prod.yml` (overlays): imagens por digest, segredos so por arquivo (`*_FILE`), hardening e limites. `scripts/deploy.sh` faz deploy/rollback por digest; `scripts/verificar-deploy.mjs` (`make lint`) valida a politica; `make test-ambientes` ensaia em containers efemeros.
+- Runbook: `documentacoes/runbooks/deploy-staging-producao.md`. Documento da entrega: `documentacoes/infraestrutura/2026-10-26-fnd-006-configuracao-tipada-e-ambientes.md`.
diff --git a/infrastructure/docker/compose.deploy.yml b/infrastructure/docker/compose.deploy.yml
new file mode 100644
index 0000000..2e34d2e
--- /dev/null
+++ b/infrastructure/docker/compose.deploy.yml
@@ -0,0 +1,78 @@
+# Base comum de staging e producao (FND-006). NAO usar sozinha: combine com um overlay.
+#   docker compose -f compose.deploy.yml -f compose.staging.yml ...   (ou compose.prod.yml)
+# Regras (ADR-020, ISO-002): imagens por digest; nenhum segredo em env, command, imagem ou repositorio
+# (apenas caminhos *_FILE; o conteudo vem de arquivos 0400 em SECRETS_DIR, montados em /run/secrets);
+# portas somente em 127.0.0.1 (a borda publica e o proxy de FND-007); rede interna sem saida.
+# Interpolacao so de NOMES/CAMINHOS/digests; verificado por scripts/verificar-deploy.mjs (make lint).
+
+x-endurecido: &endurecido
+  restart: unless-stopped
+  init: true
+  read_only: true
+  cap_drop: [ALL]
+  security_opt: ["no-new-privileges:true"]
+  stop_grace_period: 30s
+  logging:
+    driver: json-file
+    options: {max-size: "10m", max-file: "3"}
+
+services:
+  api:
+    <<: *endurecido
+    # Digest obrigatorio: <repositorio>@sha256:<64 hex>. A referencia verificada vem de scripts/deploy.sh.
+    image: ${API_IMAGE:?informe API_IMAGE=<repositorio>@sha256:<digest>}
+    user: "${API_UID:-10001}:${API_GID:-10001}"
+    environment:
+      HOST: 0.0.0.0
+      PORT: "3001"
+      APP_VERSION: ${APP_VERSION:-0.0.0}
+      DATABASE_URL: postgres://nucleos@postgres:5432/nucleos
+      DATABASE_PASSWORD_FILE: /run/secrets/database_password
+    secrets: [database_password]
+    tmpfs: ["/tmp:rw,noexec,nosuid,size=16m"]
+    ports: ["127.0.0.1:${API_HOST_PORT:-3001}:3001"]
+    networks: [interna, publicada]
+    depends_on:
+      postgres: {condition: service_healthy}
+    healthcheck:
+      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3001/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
+      interval: 10s
+      timeout: 5s
+      retries: 6
+      start_period: 15s
+
+  postgres:
+    <<: *endurecido
+    image: pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0
+    # O entrypoint oficial inicia como root, ajusta o dono do PGDATA e troca para o usuario postgres:
+    # allowlist minima de capacidades (nada alem disso), sem rede publicada.
+    cap_add: [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID]
+    environment:
+      POSTGRES_USER: nucleos
+      POSTGRES_DB: nucleos
+      POSTGRES_PASSWORD_FILE: /run/secrets/database_password
+    secrets: [database_password]
+    volumes: ["postgres-data:/var/lib/postgresql"]
+    tmpfs:
+      - /tmp:rw,noexec,nosuid,size=64m
+      - /run/postgresql:rw,noexec,nosuid,size=4m
+    networks: [interna]
+    healthcheck:
+      test: ["CMD-SHELL", "pg_isready -U nucleos -d nucleos"]
+      interval: 10s
+      timeout: 5s
+      retries: 12
+      start_period: 20s
+
+secrets:
+  # Somente o CAMINHO do arquivo; o conteudo nunca entra no Compose. Dono = UID do servico, modo 0400.
+  database_password:
+    file: ${SECRETS_DIR:?informe SECRETS_DIR (diretorio 0700 com os arquivos de segredo)}/database_password
+
+networks:
+  interna:
+    internal: true
+  publicada: {}
+
+volumes:
+  postgres-data: {}
diff --git a/infrastructure/docker/compose.prod.yml b/infrastructure/docker/compose.prod.yml
new file mode 100644
index 0000000..85e9f82
--- /dev/null
+++ b/infrastructure/docker/compose.prod.yml
@@ -0,0 +1,19 @@
+# Overlay de PRODUCAO (FND-006). Mesmas regras da base; limites maiores.
+# Uso: docker compose -f compose.deploy.yml -f compose.prod.yml up -d   (ver scripts/deploy.sh)
+name: nucleos-prod
+
+services:
+  api:
+    environment: {APP_ENV: production}
+    labels: {"nucleos.ambiente": "production"}
+    cpus: 1.0
+    mem_limit: 512m
+    memswap_limit: 512m
+    pids_limit: 256
+    ulimits: {nofile: {soft: 8192, hard: 8192}}
+  postgres:
+    labels: {"nucleos.ambiente": "production"}
+    cpus: 1.0
+    mem_limit: 1g
+    memswap_limit: 1g
+    pids_limit: 300
diff --git a/infrastructure/docker/compose.staging.yml b/infrastructure/docker/compose.staging.yml
new file mode 100644
index 0000000..f41295a
--- /dev/null
+++ b/infrastructure/docker/compose.staging.yml
@@ -0,0 +1,20 @@
+# Overlay de STAGING (FND-006): espelho reduzido da producao, SOMENTE dados sinteticos.
+# Staging nunca recebe dados reais nem segredos de producao (arquivos de segredo proprios).
+# Uso: docker compose -f compose.deploy.yml -f compose.staging.yml up -d   (ver scripts/deploy.sh)
+name: nucleos-staging
+
+services:
+  api:
+    environment: {APP_ENV: staging}
+    labels: {"nucleos.ambiente": "staging"}
+    cpus: 0.5
+    mem_limit: 256m
+    memswap_limit: 256m
+    pids_limit: 128
+    ulimits: {nofile: {soft: 4096, hard: 4096}}
+  postgres:
+    labels: {"nucleos.ambiente": "staging"}
+    cpus: 0.5
+    mem_limit: 512m
+    memswap_limit: 512m
+    pids_limit: 200
diff --git a/infrastructure/docker/scripts/deploy-lib.mjs b/infrastructure/docker/scripts/deploy-lib.mjs
new file mode 100644
index 0000000..d437762
--- /dev/null
+++ b/infrastructure/docker/scripts/deploy-lib.mjs
@@ -0,0 +1,92 @@
+// Verificacoes puras de staging/producao (FND-006): usadas por verificar-deploy.mjs (make lint)
+// e pelo teste efemero (tests/ambientes.test.mjs). Sem dependencias externas.
+
+/** Nome de variavel que indica segredo literal; `*_FILE` (caminho) e o formato permitido. */
+export const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$/i;
+
+const SECRET_VALUE_PATTERNS = [
+  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada PEM"],
+  [/[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i, "URL com senha embutida"],
+  [/\bAKIA[0-9A-Z]{16}\b/, "chave de acesso AWS"],
+  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "token GitHub"],
+  [/^[A-Za-z0-9+/=_-]{32,}$/, "valor opaco longo (possivel segredo)"],
+];
+
+/** Lista achados de segredo em um mapa de variaveis de ambiente (nomes e padroes, nunca valores). */
+export function secretFindingsInEnv(env) {
+  const findings = [];
+  for (const [name, value] of Object.entries(env)) {
+    const v = value ?? "";
+    if (v !== "" && SECRET_NAME.test(name)) findings.push(`${name}: nome de segredo no ambiente`);
+    for (const [re, label] of SECRET_VALUE_PATTERNS) {
+      if (re.test(v)) findings.push(`${name}: ${label}`);
+    }
+  }
+  return findings;
+}
+
+/** Converte `Config.Env` do docker inspect (["K=V"]) em objeto. */
+export function envListToObject(list) {
+  return Object.fromEntries((list ?? []).map((kv) => {
+    const i = kv.indexOf("=");
+    return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
+  }));
+}
+
+/** Padroes de segredo literal em TEXTO de arquivo (compose, scripts): `chave: valor-literal`. */
+export function secretFindingsInText(text) {
+  const out = [];
+  text.split("\n").forEach((line, i) => {
+    const code = line.replace(/\s+#.*$/, "");
+    const m = /^\s*([A-Za-z0-9_.-]*(?:password|passwd|secret|token|api_?key|private_?key|credential)s?)\s*[:=]\s*(.+)$/i.exec(code);
+    if (m) {
+      const key = m[1];
+      const val = m[2].trim().replace(/^["']|["']$/g, "");
+      const ok = /_file$/i.test(key) || key === "secrets" || val === "" || val.startsWith("$") || val.startsWith("/run/secrets/") || /^(\[\]|\{\})$/.test(val);
+      if (!ok) out.push(`linha ${i + 1}: valor literal para "${key}"`);
+    }
+    for (const [re, label] of SECRET_VALUE_PATTERNS.slice(0, 4)) {
+      if (re.test(code)) out.push(`linha ${i + 1}: ${label}`);
+    }
+  });
+  return out;
+}
+
+const DIGEST = /@sha256:[0-9a-f]{64}$/;
+const LOOPBACK = "127.0.0.1";
+
+/** Valida a configuracao renderizada (`docker compose config --format json`). Devolve violacoes. */
+export function verifyRendered(cfg, label) {
+  const v = [];
+  const add = (svc, msg) => v.push(`${label}/${svc}: ${msg}`);
+  for (const [name, s] of Object.entries(cfg.services ?? {})) {
+    if (!DIGEST.test(s.image ?? "")) add(name, "imagem sem digest @sha256");
+    if (s.restart !== "unless-stopped") add(name, "restart deve ser unless-stopped");
+    if (s.privileged) add(name, "privileged proibido");
+    if (s.network_mode === "host" || s.pid === "host" || s.ipc === "host") add(name, "namespace do host proibido");
+    if (!(s.cap_drop ?? []).includes("ALL")) add(name, "cap_drop deve conter ALL");
+    if (!(s.security_opt ?? []).includes("no-new-privileges:true")) add(name, "falta no-new-privileges");
+    if (s.read_only !== true) add(name, "read_only obrigatorio");
+    if (!s.mem_limit || !s.cpus || !s.pids_limit) add(name, "limites de memoria, CPU e PIDs obrigatorios");
+    if (s.user === undefined && name === "api") add(name, "usuario nao-root obrigatorio");
+    if (/^(0|root)(:|$)/.test(s.user ?? "")) add(name, "usuario root proibido");
+    for (const p of s.ports ?? []) {
+      if (p.host_ip !== LOOPBACK) add(name, "porta publicada fora de 127.0.0.1");
+    }
+    for (const vol of s.volumes ?? []) {
+      if (/docker\.sock|^\/(proc|sys|run\/containerd)?$/.test(vol.source ?? "")) add(name, "mount proibido");
+    }
+    for (const f of secretFindingsInEnv(s.environment ?? {})) {
+      // *_FILE contem so o caminho em /run/secrets: o valor nao e segredo.
+      if (/^[A-Z0-9_]+_FILE: /.test(f)) continue;
+      add(name, `ambiente: ${f}`);
+    }
+    for (const arg of [...(s.command ?? []), ...(s.entrypoint ?? [])]) {
+      for (const f of secretFindingsInText(String(arg))) add(name, `command: ${f}`);
+    }
+  }
+  for (const [n, sec] of Object.entries(cfg.secrets ?? {})) {
+    if (sec.environment !== undefined || sec.content !== undefined) add(n, "secret deve ser file:, nunca environment/content");
+  }
+  return v;
+}
diff --git a/infrastructure/docker/scripts/deploy.sh b/infrastructure/docker/scripts/deploy.sh
new file mode 100755
index 0000000..5389d62
--- /dev/null
+++ b/infrastructure/docker/scripts/deploy.sh
@@ -0,0 +1,80 @@
+#!/usr/bin/env bash
+# Deploy e rollback por digest de staging/producao (FND-006). Runbook: documentacoes/runbooks/deploy-staging-producao.md
+# Uso:  deploy.sh <staging|prod> deploy <repositorio@sha256:digest>
+#       deploy.sh <staging|prod> rollback
+#       deploy.sh <staging|prod> status
+# Ambiente exigido: SECRETS_DIR (diretorio 0700 com database_password 0400, dono = UID do servico).
+# Opcionais: API_HOST_PORT, STATE_DIR (padrao .run/deploy), EXTRA_COMPOSE (arquivo extra, SO para ensaio local),
+#            READY_TIMEOUT (s, padrao 120). Nunca imprime segredos.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+ROOT="$(cd "$DIR/../.." && pwd)"
+env_name="${1:-}"; cmd="${2:-}"; ref="${3:-}"
+case "$env_name" in staging|prod) ;; *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;; esac
+STATE="${STATE_DIR:-$ROOT/.run/deploy}/$env_name"
+mkdir -p "$STATE"
+files=(-f "$DIR/compose.deploy.yml" -f "$DIR/compose.$env_name.yml")
+[ -n "${EXTRA_COMPOSE:-}" ] && files+=(-f "$EXTRA_COMPOSE")
+: "${SECRETS_DIR:?informe SECRETS_DIR}"
+port="${API_HOST_PORT:-3001}"
+
+verificar_segredos() {
+  local f="$SECRETS_DIR/database_password" modo dono
+  [ -f "$f" ] && [ ! -L "$f" ] || { echo "FALHA: segredo database_password ausente em SECRETS_DIR" >&2; exit 1; }
+  modo="$(stat -c '%a' "$f")"; dono="$(stat -c '%u' "$f")"
+  [ "$modo" = "400" ] || { echo "FALHA: database_password deve ter modo 0400 (atual $modo)" >&2; exit 1; }
+  [ "$dono" = "${API_UID:-10001}" ] || [ -n "${EXTRA_COMPOSE:-}" ] || { echo "FALHA: database_password deve pertencer ao UID do servico" >&2; exit 1; }
+}
+
+subir() { # $1 = referencia com digest
+  API_IMAGE="$1" docker compose "${files[@]}" up -d --remove-orphans
+}
+
+aguardar_pronto() {
+  local i
+  for i in $(seq 1 "${READY_TIMEOUT:-120}"); do
+    if curl -fsS --max-time 3 "http://127.0.0.1:$port/readyz" >/dev/null 2>&1; then return 0; fi
+    sleep 1
+  done
+  return 1
+}
+
+case "$cmd" in
+  deploy)
+    [[ "$ref" =~ ^[a-z0-9][a-z0-9./_:-]*@sha256:[0-9a-f]{64}$ ]] || { echo "FALHA: informe a imagem como <repositorio>@sha256:<64 hex> (tag nao e aceita)" >&2; exit 2; }
+    verificar_segredos
+    # 1. configuracao renderizada obedece a politica (digest, hardening, sem segredo)
+    node "$DIR/scripts/verificar-deploy.mjs"
+    # 2. puxar o digest (ja verificado no CI: build-images/trivy). Assinatura (cosign) ainda nao adotada.
+    if [ -z "${EXTRA_COMPOSE:-}" ]; then docker pull "$ref" >/dev/null; fi
+    # 3. migrar controle: sem migracoes versionadas ainda (DAT-*); o passo falha fechado quando existir e falhar.
+    if [ -x "$DIR/scripts/migrar-controle.sh" ]; then "$DIR/scripts/migrar-controle.sh" "$env_name"; else echo "NA: nenhuma migracao de controle versionada ate este ticket"; fi
+    # 4. subir API (postgres antes, saudavel) e 5. verificar readyz
+    [ -f "$STATE/atual" ] && cp "$STATE/atual" "$STATE/anterior"
+    subir "$ref"
+    if aguardar_pronto; then
+      echo "$ref" >"$STATE/atual"
+      echo "OK: $env_name em $ref"
+    else
+      echo "FALHA: /readyz nao respondeu em ${READY_TIMEOUT:-120}s; rollback automatico" >&2
+      if [ -f "$STATE/anterior" ]; then
+        subir "$(cat "$STATE/anterior")"; aguardar_pronto && echo "rollback concluido para $(cat "$STATE/anterior")" >&2 || echo "ALERTA: rollback tambem falhou" >&2
+      else
+        API_IMAGE="$ref" docker compose "${files[@]}" stop api
+        echo "sem versao anterior: api parada" >&2
+      fi
+      exit 1
+    fi ;;
+  rollback)
+    verificar_segredos
+    [ -f "$STATE/anterior" ] || { echo "FALHA: nao ha digest anterior registrado em $STATE" >&2; exit 1; }
+    prev="$(cat "$STATE/anterior")"; atual="$(cat "$STATE/atual" 2>/dev/null || true)"
+    subir "$prev"
+    aguardar_pronto || { echo "FALHA: /readyz nao respondeu apos rollback" >&2; exit 1; }
+    echo "$prev" >"$STATE/atual"; [ -n "$atual" ] && echo "$atual" >"$STATE/anterior"
+    echo "OK: rollback de $env_name para $prev" ;;
+  status)
+    echo "atual:    $(cat "$STATE/atual" 2>/dev/null || echo '-')"
+    echo "anterior: $(cat "$STATE/anterior" 2>/dev/null || echo '-')" ;;
+  *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;;
+esac
diff --git a/infrastructure/docker/scripts/verificar-deploy.mjs b/infrastructure/docker/scripts/verificar-deploy.mjs
new file mode 100755
index 0000000..314578e
--- /dev/null
+++ b/infrastructure/docker/scripts/verificar-deploy.mjs
@@ -0,0 +1,41 @@
+#!/usr/bin/env node
+// Verificacao estatica de compose.deploy.yml + overlays staging/prod (FND-006, AC-3):
+// (1) texto dos arquivos sem segredo literal; (2) configuracao renderizada: digest, hardening,
+// limites, portas em 127.0.0.1, ambiente sem segredo. Roda em `make lint` (e no job make-lint do CI).
+// Interpolacao com valores ficticios: nenhum segredo e lido ou necessario.
+import { execFileSync } from "node:child_process";
+import { readFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { secretFindingsInText, verifyRendered } from "./deploy-lib.mjs";
+
+const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
+const FILES = ["compose.deploy.yml", "compose.staging.yml", "compose.prod.yml"];
+const violations = [];
+
+for (const f of FILES) {
+  for (const finding of secretFindingsInText(readFileSync(join(dir, f), "utf8"))) {
+    violations.push(`${f}: ${finding}`);
+  }
+}
+
+const env = {
+  ...process.env,
+  API_IMAGE: `registry.invalid/nucleos/api@sha256:${"0".repeat(64)}`,
+  SECRETS_DIR: "/nao-existe/segredos",
+};
+for (const overlay of ["compose.staging.yml", "compose.prod.yml"]) {
+  const out = execFileSync(
+    "docker",
+    ["compose", "-f", join(dir, "compose.deploy.yml"), "-f", join(dir, overlay), "config", "--format", "json"],
+    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
+  );
+  violations.push(...verifyRendered(JSON.parse(out), overlay));
+}
+
+if (violations.length > 0) {
+  console.error(`verificar-deploy: ${violations.length} violacao(oes)`);
+  for (const v of violations) console.error(`  - ${v}`);
+  process.exit(1);
+}
+console.log("verificar-deploy: OK (staging e producao sem segredo literal, com digest e hardening)");
diff --git a/infrastructure/docker/tests/ambientes.test.mjs b/infrastructure/docker/tests/ambientes.test.mjs
new file mode 100644
index 0000000..f7d0678
--- /dev/null
+++ b/infrastructure/docker/tests/ambientes.test.mjs
@@ -0,0 +1,193 @@
+// Testes de FND-006 (AC-1..3): esquema recusa configuracao invalida sem vazar valores; overlays sem
+// segredo literal; ausencia de segredo em `docker inspect`/env/argv/logs num ambiente EFEMERO
+// (127.0.0.1, containers descartaveis, destruidos ao final). Executar: make test-ambientes
+// Pre-requisitos: Docker, `make build` (apps/api/dist) e as imagens do compose (digest) locais ou puxaveis.
+import assert from "node:assert/strict";
+import { execFileSync, spawnSync } from "node:child_process";
+import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { randomBytes } from "node:crypto";
+import { tmpdir } from "node:os";
+import { dirname, join } from "node:path";
+import { after, before, describe, test } from "node:test";
+import { fileURLToPath } from "node:url";
+import { envListToObject, secretFindingsInEnv, secretFindingsInText, verifyRendered } from "../scripts/deploy-lib.mjs";
+
+const docker = join(dirname(fileURLToPath(import.meta.url)), "..");
+const root = join(docker, "..", "..");
+const NODE24 = "node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205";
+const NODE22 = "node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914";
+const PY = "python:3.13.17-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530";
+const PORT = "13901";
+const PROJECT = "nucleos-ensaio-fnd006";
+
+const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
+const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });
+
+// ---------------------------------------------------------------- verificador (sem Docker)
+describe("verificador de overlays", () => {
+  const ok = {
+    services: {
+      api: {
+        image: `r/a@sha256:${"a".repeat(64)}`, restart: "unless-stopped", cap_drop: ["ALL"],
+        security_opt: ["no-new-privileges:true"], read_only: true, mem_limit: "1", cpus: 1, pids_limit: 1,
+        user: "10001:10001", ports: [{ host_ip: "127.0.0.1" }], environment: { DATABASE_PASSWORD_FILE: "/run/secrets/x" },
+      },
+    },
+  };
+  const bad = (patch) => verifyRendered({ services: { api: { ...ok.services.api, ...patch } } }, "t");
+  test("configuracao correta passa", () => assert.deepEqual(bad({}), []));
+  test("cada regra e violada separadamente", () => {
+    assert.match(bad({ image: "r/a:latest" }).join(), /sem digest/);
+    assert.match(bad({ environment: { DB_PASSWORD: "x" } }).join(), /nome de segredo/);
+    assert.match(bad({ environment: { X: "postgres://u:p4ss@h/db" } }).join(), /senha embutida/);
+    assert.match(bad({ ports: [{ host_ip: "0.0.0.0" }] }).join(), /fora de 127\.0\.0\.1/);
+    assert.match(bad({ privileged: true }).join(), /privileged/);
+    assert.match(bad({ user: "0:0" }).join(), /root/);
+    assert.match(bad({ read_only: false }).join(), /read_only/);
+    assert.match(bad({ cap_drop: [] }).join(), /cap_drop/);
+    assert.match(bad({ mem_limit: undefined }).join(), /limites/);
+    assert.match(bad({ restart: "always" }).join(), /unless-stopped/);
+  });
+  test("texto de compose com segredo literal e detectado; *_FILE e ${} nao", () => {
+    assert.equal(secretFindingsInText("POSTGRES_PASSWORD: abc12345678\n").length, 1);
+    assert.equal(secretFindingsInText("POSTGRES_PASSWORD_FILE: /run/secrets/x\nA_TOKEN: ${TOKEN:?}\n").length, 0);
+  });
+});
+
+// ------------------------------------------------- esquema de configuracao (processo real)
+describe("api recusa subir com configuracao invalida (AC-1)", { skip: !dockerOk() }, () => {
+  const SENT = `S${randomBytes(12).toString("hex")}`;
+  const runApi = (env, extra = []) =>
+    sh("docker", ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "-u", `${process.getuid()}:${process.getgid()}`,
+      ...extra, "-v", `${root}:/workspace:ro`, "-w", "/workspace", ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
+      NODE24, "node", "apps/api/dist/main.js"]);
+  const dir = mkdtempSync(join(tmpdir(), "fnd006-cfg-"));
+  after(() => rmSync(dir, { recursive: true, force: true }));
+  const check = (r, keys) => {
+    assert.equal(r.status, 1, `esperado exit 1, obtido ${r.status}`);
+    for (const k of keys) assert.ok(r.stderr.includes(k), `stderr deve citar ${k}`);
+    assert.ok(!(r.stdout + r.stderr).includes(SENT), "valor vazou na saida");
+  };
+  test("porta/duracao/URL invalidas", () => {
+    check(runApi({ PORT: `x${SENT}`, REQUEST_TIMEOUT: SENT, DATABASE_URL: `postgres://u:${SENT}@h/db` }), ["PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]);
+  });
+  test("staging sem banco/segredo", () => check(runApi({ APP_ENV: "staging" }), ["DATABASE_URL", "DATABASE_PASSWORD_FILE"]));
+  test("segredo por variavel de ambiente", () => check(runApi({ DATABASE_PASSWORD: SENT }), ["DATABASE_PASSWORD"]));
+  test("arquivo de segredo com permissao aberta", () => {
+    const f = join(dir, "pw"); writeFileSync(f, `${SENT}\n`); chmodSync(f, 0o644);
+    check(runApi({ DATABASE_PASSWORD_FILE: "/run/pw" }, ["-v", `${f}:/run/pw:ro`]), ["DATABASE_PASSWORD_FILE", "permissoes"]);
+  });
+  test("arquivo de segredo ausente", () => check(runApi({ DATABASE_PASSWORD_FILE: "/run/nao-existe" }), ["ausente"]));
+});
+
+// -------------------------------------------- ambiente efemero: deploy, rollback e ausencia de segredo
+describe("staging efemero em 127.0.0.1 (AC-2, AC-3)", { skip: !dockerOk() }, () => {
+  const SENT = `Z${randomBytes(16).toString("hex")}`; // senha sentinela (so no arquivo 0400)
+  const tmp = mkdtempSync(join(tmpdir(), "fnd006-"));
+  const secrets = join(tmp, "segredos");
+  const state = join(tmp, "estado");
+  const env = {
+    ...process.env, SECRETS_DIR: secrets, STATE_DIR: state, API_HOST_PORT: PORT, READY_TIMEOUT: "90",
+    EXTRA_COMPOSE: join(docker, "tests", "ensaio.override.yml"), ENSAIO_UID: String(process.getuid()), ENSAIO_GID: String(process.getgid()),
+    API_UID: String(process.getuid()),
+  };
+  const deploy = (...a) => sh(join(docker, "scripts", "deploy.sh"), ["staging", ...a], { env });
+  const compose = (...a) => sh("docker", ["compose", "-p", PROJECT, "-f", join(docker, "compose.deploy.yml"), "-f", join(docker, "compose.staging.yml"),
+    "-f", env.EXTRA_COMPOSE, ...a], { env: { ...env, API_IMAGE: NODE24 } });
+  const cid = (svc) => out("docker", ["ps", "-aq", "--filter", `label=com.docker.compose.project=${PROJECT}`, "--filter", `label=com.docker.compose.service=${svc}`]).trim();
+
+  before(() => {
+    sh("mkdir", ["-p", secrets, state]); chmodSync(secrets, 0o700);
+    writeFileSync(join(secrets, "database_password"), `${SENT}\n`, { mode: 0o400 });
+    // O volume da rodada anterior nao pode existir (senha antiga no PGDATA).
+    sh("docker", ["volume", "rm", "-f", `${PROJECT}_postgres-data`]);
+  });
+  after(() => {
+    compose("down", "-v", "--remove-orphans", "-t", "5");
+    rmSync(tmp, { recursive: true, force: true });
+  });
+
+  test("deploy exige digest (tag e recusada) e segredo 0400", () => {
+    const r = deploy("deploy", "node:24");
+    assert.equal(r.status, 2);
+    chmodSync(join(secrets, "database_password"), 0o644);
+    assert.equal(deploy("deploy", NODE24).status, 1);
+    chmodSync(join(secrets, "database_password"), 0o400);
+  });
+
+  test("deploy do digest A sobe API e Postgres; /readyz responde", () => {
+    const r = deploy("deploy", NODE24);
+    assert.equal(r.status, 0, r.stdout + r.stderr);
+    const res = sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]);
+    assert.equal(res.status, 0);
+    assert.match(res.stdout, /"ready"/);
+  });
+
+  test("Postgres aceitou a senha vinda do arquivo (POSTGRES_PASSWORD_FILE)", () => {
+    const r = sh("docker", ["exec", cid("postgres"), "sh", "-c",
+      "PGPASSWORD=\"$(cat /run/secrets/database_password)\" psql -h 127.0.0.1 -U nucleos -d nucleos -tAc 'select 1'"]);
+    assert.equal(r.stdout.trim(), "1", r.stderr);
+  });
+
+  test("docker inspect/env/argv/logs sem segredo; hardening aplicado", () => {
+    for (const svc of ["api", "postgres"]) {
+      const id = cid(svc);
+      const insp = out("docker", ["inspect", id]);
+      assert.ok(!insp.includes(SENT), `${svc}: sentinela em docker inspect`);
+      const j = JSON.parse(insp)[0];
+      assert.deepEqual(secretFindingsInEnv(envListToObject(j.Config.Env)).filter((f) => !/_FILE: /.test(f)), [], `${svc}: env`);
+      assert.ok(!JSON.stringify([j.Config.Cmd, j.Config.Entrypoint]).includes(SENT));
+      assert.equal(j.HostConfig.Privileged, false);
+      assert.deepEqual(j.HostConfig.CapDrop, ["ALL"]);
+      assert.ok(j.HostConfig.SecurityOpt.includes("no-new-privileges:true"));
+      assert.equal(j.HostConfig.ReadonlyRootfs, true);
+      assert.ok(j.HostConfig.Memory > 0 && j.HostConfig.PidsLimit > 0 && j.HostConfig.NanoCpus > 0);
+      assert.equal(j.HostConfig.RestartPolicy.Name, "unless-stopped");
+      for (const binds of Object.values(j.NetworkSettings.Ports ?? {})) {
+        for (const b of binds ?? []) assert.equal(b.HostIp, "127.0.0.1");
+      }
+      const logs = sh("docker", ["logs", id]);
+      assert.ok(!(logs.stdout + logs.stderr).includes(SENT), `${svc}: sentinela em logs`);
+      // por dentro: /proc/*/environ e /proc/*/cmdline (o arquivo em /run/secrets e a unica copia)
+      const inside = sh("docker", ["exec", id, "sh", "-c",
+        "cat /proc/[0-9]*/environ /proc/[0-9]*/cmdline 2>/dev/null | tr '\\0' '\\n'"]);
+      assert.ok(!inside.stdout.includes(SENT), `${svc}: sentinela em environ/cmdline`);
+      assert.equal(sh("docker", ["exec", id, "sh", "-c", "env"]).stdout.includes(SENT), false);
+    }
+    assert.ok(!out("docker", ["image", "inspect", NODE24]).includes(SENT));
+    assert.ok(!out("docker", ["compose", "-p", PROJECT, "-f", join(docker, "compose.deploy.yml"), "-f", join(docker, "compose.staging.yml"), "-f", env.EXTRA_COMPOSE, "config"],
+      { env: { ...env, API_IMAGE: NODE24 } }).includes(SENT), "sentinela na configuracao renderizada");
+  });
+
+  test("controle negativo: a mesma deteccao acusa segredo passado por -e", () => {
+    const id = out("docker", ["run", "-d", "--rm", "--network", "none", "-e", `DATABASE_PASSWORD=${SENT}`, NODE24, "sleep", "30"]).trim();
+    try {
+      const insp = out("docker", ["inspect", id]);
+      assert.ok(insp.includes(SENT));
+      assert.ok(secretFindingsInEnv(envListToObject(JSON.parse(insp)[0].Config.Env)).length > 0);
+    } finally { sh("docker", ["rm", "-f", id]); }
+  });
+
+  test("deploy do digest B e rollback manual para A", () => {
+    assert.equal(deploy("deploy", NODE22).status, 0);
+    assert.match(deploy("status").stdout, new RegExp(`atual:\\s+${NODE22.replace(/[.]/g, "\\.")}`));
+    const imgB = out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim();
+    assert.equal(imgB, NODE22);
+    const r = deploy("rollback");
+    assert.equal(r.status, 0, r.stdout + r.stderr);
+    assert.equal(out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim(), NODE24);
+    assert.equal(sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status, 0);
+  });
+
+  test("deploy defeituoso reverte automaticamente para a versao anterior", () => {
+    const r = sh(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", PY], { env: { ...env, READY_TIMEOUT: "8" } });
+    assert.equal(r.status, 1);
+    assert.match(r.stderr, /rollback/);
+    assert.equal(out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim(), NODE24);
+    assert.equal(sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status, 0);
+  });
+});
+
+function dockerOk() {
+  return sh("docker", ["info"]).status === 0;
+}
diff --git a/infrastructure/docker/tests/ensaio.override.yml b/infrastructure/docker/tests/ensaio.override.yml
new file mode 100644
index 0000000..0f3731a
--- /dev/null
+++ b/infrastructure/docker/tests/ensaio.override.yml
@@ -0,0 +1,13 @@
+# SOMENTE ensaio local descartavel (tests/ambientes.test.mjs): nao existe imagem de producao da API
+# ainda (Dockerfiles: ISO-007/RUN-002), entao o ensaio executa o dist real montado somente-leitura.
+# Nunca usar fora do ensaio; deploy.sh so aceita EXTRA_COMPOSE para isso.
+name: nucleos-ensaio-fnd006
+
+services:
+  api:
+    user: "${ENSAIO_UID:?}:${ENSAIO_GID:?}"
+    working_dir: /workspace
+    volumes: ["../../:/workspace:ro"]
+    command: ["node", "apps/api/dist/main.js"]
+    environment:
+      HOME: /tmp
diff --git a/packages/config-py/pyproject.toml b/packages/config-py/pyproject.toml
new file mode 100644
index 0000000..ca80cbe
--- /dev/null
+++ b/packages/config-py/pyproject.toml
@@ -0,0 +1,16 @@
+[project]
+name = "nucleos-config"
+version = "0.0.0"
+description = "Configuracao tipada com falha rapida e segredos por arquivo (FND-006)"
+requires-python = ">=3.12"
+dependencies = [
+  "pydantic==2.14.1",
+  "pydantic-settings==2.16.1",
+]
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "nucleos_config"
diff --git a/packages/config-py/src/nucleos_config/__init__.py b/packages/config-py/src/nucleos_config/__init__.py
new file mode 100644
index 0000000..d7946e4
--- /dev/null
+++ b/packages/config-py/src/nucleos_config/__init__.py
@@ -0,0 +1,14 @@
+from .secret import MAX_SECRET_BYTES, Secret, SecretFileError, read_secret_file
+from .settings import ConfigError, ConfigIssue, ServiceSettings, forbidden_secret_env, load_settings
+
+__all__ = [
+    "MAX_SECRET_BYTES",
+    "ConfigError",
+    "ConfigIssue",
+    "Secret",
+    "SecretFileError",
+    "ServiceSettings",
+    "forbidden_secret_env",
+    "load_settings",
+    "read_secret_file",
+]
diff --git a/packages/config-py/src/nucleos_config/py.typed b/packages/config-py/src/nucleos_config/py.typed
new file mode 100644
index 0000000..e69de29
diff --git a/packages/config-py/src/nucleos_config/secret.py b/packages/config-py/src/nucleos_config/secret.py
new file mode 100644
index 0000000..ea58c9c
--- /dev/null
+++ b/packages/config-py/src/nucleos_config/secret.py
@@ -0,0 +1,67 @@
+"""Leitura de segredos por arquivo (ADR-020, item 1): nunca por variavel de ambiente."""
+
+from __future__ import annotations
+
+import os
+import stat
+
+MAX_SECRET_BYTES = 16 * 1024
+
+
+class SecretFileError(Exception):
+    """Falha ao ler segredo; `reason` e um codigo fixo (o caminho e o conteudo nunca entram)."""
+
+    def __init__(self, reason: str) -> None:
+        super().__init__(f"arquivo de segredo invalido: {reason}")
+        self.reason = reason
+
+
+class Secret:
+    """Valor sensivel. `repr`/`str` mostram `[REDACTED]`; use `reveal()` no ponto de uso."""
+
+    __slots__ = ("_value",)
+
+    def __init__(self, value: str) -> None:
+        self._value = value
+
+    def reveal(self) -> str:
+        return self._value
+
+    def __repr__(self) -> str:
+        return "Secret([REDACTED])"
+
+    __str__ = __repr__
+
+
+def read_secret_file(path: str) -> Secret:
+    """Le o segredo com as mesmas regras da biblioteca TypeScript.
+
+    Arquivo regular (sem link simbolico), sem permissoes para grupo/outros (0o077), do mesmo dono
+    do processo, nao vazio e com tamanho limitado. Remove um unico `\\n` final.
+    """
+    try:
+        st = os.lstat(path)
+    except OSError:
+        raise SecretFileError("ausente") from None
+    if stat.S_ISLNK(st.st_mode):
+        raise SecretFileError("link-simbolico")
+    if not stat.S_ISREG(st.st_mode):
+        raise SecretFileError("nao-e-arquivo-regular")
+    if st.st_mode & 0o077:
+        raise SecretFileError("permissoes-abertas")
+    if st.st_uid != os.getuid():
+        raise SecretFileError("dono-diferente")
+    if st.st_size == 0:
+        raise SecretFileError("vazio")
+    if st.st_size > MAX_SECRET_BYTES:
+        raise SecretFileError("grande-demais")
+    try:
+        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
+        with os.fdopen(fd, "r", encoding="utf-8") as fh:
+            raw = fh.read()
+    except (OSError, UnicodeDecodeError):
+        raise SecretFileError("ilegivel") from None
+    value = raw.removesuffix("\n")
+    if not value:
+        raise SecretFileError("vazio")
+    return Secret(value)
diff --git a/packages/config-py/src/nucleos_config/settings.py b/packages/config-py/src/nucleos_config/settings.py
new file mode 100644
index 0000000..ea6317e
--- /dev/null
+++ b/packages/config-py/src/nucleos_config/settings.py
@@ -0,0 +1,137 @@
+"""Esquema de configuracao dos servicos Python (Pydantic Settings), com falha rapida."""
+
+from __future__ import annotations
+
+import re
+from collections.abc import Mapping
+from typing import Annotated, Literal
+
+from pydantic import AfterValidator, AnyUrl, BaseModel, Field, ValidationError, field_validator
+from pydantic_settings import (
+    BaseSettings,
+    PydanticBaseSettingsSource,
+    SettingsConfigDict,
+)
+
+from .secret import Secret, SecretFileError, read_secret_file
+
+_SECRET_NAME = re.compile(
+    r"(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$", re.I
+)
+_UNITS_MS = {"ms": 1, "s": 1000, "m": 60_000, "h": 3_600_000}
+_STRICT = ("staging", "production")
+
+
+class ConfigIssue(BaseModel):
+    key: str
+    message: str
+
+
+class ConfigError(Exception):
+    """Configuracao invalida: lista nomes e motivos fixos, nunca o valor recebido."""
+
+    def __init__(self, issues: list[ConfigIssue]) -> None:
+        self.issues = issues
+        detail = "; ".join(f"{i.key}: {i.message}" for i in issues)
+        super().__init__(f"configuracao invalida ({len(issues)}): {detail}")
+
+
+def forbidden_secret_env(env: Mapping[str, str]) -> list[str]:
+    """Nomes de variaveis que parecem carregar segredo literal (so `*_FILE` e permitido)."""
+    return sorted(k for k, v in env.items() if v != "" and _SECRET_NAME.search(k))
+
+
+def _no_password(url: AnyUrl) -> AnyUrl:
+    if url.password:
+        raise ValueError("senha embutida na url e proibida (use *_FILE)")
+    return url
+
+
+def _absolute(path: str) -> str:
+    if not path.startswith("/") or "\0" in path or ".." in path.split("/"):
+        raise ValueError("caminho deve ser absoluto e sem '..'")
+    return path
+
+
+ServiceUrl = Annotated[AnyUrl, AfterValidator(_no_password)]
+AbsolutePath = Annotated[str, Field(max_length=4096), AfterValidator(_absolute)]
+
+
+class ServiceSettings(BaseSettings):
+    """Configuracao comum dos servicos Python. Campos mapeiam 1:1 as variaveis em MAIUSCULAS."""
+
+    model_config = SettingsConfigDict(
+        extra="ignore", case_sensitive=True, frozen=True, hide_input_in_errors=True
+    )
+
+    APP_ENV: Literal["local", "ci", "staging", "production"] = "local"
+    APP_VERSION: str = Field("0.0.0", pattern=r"^[0-9A-Za-z.+_-]{1,64}$")
+    HOST: str = Field("127.0.0.1", min_length=1, max_length=255)
+    PORT: int = Field(8000, ge=1, le=65535)
+    REQUEST_TIMEOUT: int = 30_000  # ms; do ambiente: "500ms", "30s", "5m", "1h"
+    DATABASE_URL: ServiceUrl | None = None
+    DATABASE_PASSWORD_FILE: AbsolutePath | None = None
+
+    @classmethod
+    def settings_customise_sources(
+        cls,
+        settings_cls: type[BaseSettings],
+        init_settings: PydanticBaseSettingsSource,
+        env_settings: PydanticBaseSettingsSource,
+        dotenv_settings: PydanticBaseSettingsSource,
+        file_secret_settings: PydanticBaseSettingsSource,
+    ) -> tuple[PydanticBaseSettingsSource, ...]:
+        # Somente o mapa explicito: nao le os.environ, .env nem /run/secrets por acidente.
+        return (init_settings,)
+
+    @field_validator("REQUEST_TIMEOUT", mode="before")
+    @classmethod
+    def _duration(cls, v: object) -> int:
+        if isinstance(v, int):  # padrao do codigo (ja em ms); o ambiente sempre chega como texto
+            return v
+        m = re.fullmatch(r"(\d{1,9})(ms|s|m|h)", str(v))
+        if not m:
+            raise ValueError("duracao invalida (use 500ms, 30s, 5m, 1h)")
+        ms = int(m.group(1)) * _UNITS_MS[m.group(2)]
+        if not 100 <= ms <= 300_000:
+            raise ValueError("duracao fora da faixa permitida")
+        return ms
+
+
+def load_settings(
+    env: Mapping[str, str], *, model: type[ServiceSettings] = ServiceSettings
+) -> tuple[ServiceSettings, Secret | None]:
+    """Valida `env` e le o segredo do banco. Levanta `ConfigError` (sem valores) se invalido."""
+    clean = {k: v for k, v in env.items() if v != ""}
+    issues = [
+        ConfigIssue(
+            key=k,
+            message="segredo por variavel de ambiente e proibido (use <NOME>_FILE)",
+        )
+        for k in forbidden_secret_env(clean)
+    ]
+    settings: ServiceSettings | None = None
+    try:
+        settings = model.model_validate(clean)
+    except ValidationError as exc:
+        for err in exc.errors(include_input=False, include_url=False, include_context=False):
+            issues.append(
+                ConfigIssue(
+                    key=".".join(str(p) for p in err["loc"]) or "(raiz)", message=err["msg"]
+                )
+            )
+    if settings is not None and settings.APP_ENV in _STRICT:
+        issues.extend(
+            ConfigIssue(key=k, message=f"obrigatoria em {settings.APP_ENV}")
+            for k in ("DATABASE_URL", "DATABASE_PASSWORD_FILE")
+            if getattr(settings, k) is None
+        )
+    secret: Secret | None = None
+    if settings is not None and settings.DATABASE_PASSWORD_FILE is not None and not issues:
+        try:
+            secret = read_secret_file(settings.DATABASE_PASSWORD_FILE)
+        except SecretFileError as exc:
+            issues.append(ConfigIssue(key="DATABASE_PASSWORD_FILE", message=exc.reason))
+    if issues or settings is None:
+        raise ConfigError(issues)
+    return settings, secret
diff --git a/packages/config-py/tests/test_config.py b/packages/config-py/tests/test_config.py
new file mode 100644
index 0000000..1341543
--- /dev/null
+++ b/packages/config-py/tests/test_config.py
@@ -0,0 +1,129 @@
+import os
+import stat
+from pathlib import Path
+
+import pytest
+from nucleos_config import (
+    ConfigError,
+    SecretFileError,
+    forbidden_secret_env,
+    load_settings,
+    read_secret_file,
+)
+
+SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a"
+
+
+def secret_file(
+    tmp_path: Path, content: str = SENTINEL, mode: int = 0o400, name: str = "pw"
+) -> str:
+    p = tmp_path / name
+    p.write_text(content + "\n")
+    p.chmod(mode)
+    return str(p)
+
+
+def keys(exc: ConfigError) -> list[str]:
+    return sorted(i.key for i in exc.issues)
+
+
+def test_local_defaults() -> None:
+    s, secret = load_settings({})
+    assert (s.APP_ENV, s.HOST, s.PORT, s.REQUEST_TIMEOUT) == ("local", "127.0.0.1", 8000, 30_000)
+    assert secret is None
+
+
+def test_typed_values_and_secret_from_file(tmp_path: Path) -> None:
+    s, secret = load_settings(
+        {
+            "APP_ENV": "staging",
+            "PORT": "8080",
+            "REQUEST_TIMEOUT": "5s",
+            "DATABASE_URL": "postgres://nucleos@postgres:5432/nucleos",
+            "DATABASE_PASSWORD_FILE": secret_file(tmp_path),
+        }
+    )
+    assert s.PORT == 8080
+    assert s.REQUEST_TIMEOUT == 5000
+    assert secret is not None
+    assert secret.reveal() == SENTINEL
+    assert SENTINEL not in repr(secret) + str(secret)
+
+
+@pytest.mark.parametrize("app_env", ["staging", "production"])
+def test_strict_envs_require_database(app_env: str) -> None:
+    with pytest.raises(ConfigError) as ei:
+        load_settings({"APP_ENV": app_env})
+    assert keys(ei.value) == ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]
+
+
+def test_invalid_values_never_echo_input() -> None:
+    with pytest.raises(ConfigError) as ei:
+        load_settings(
+            {
+                "APP_ENV": f"prod-{SENTINEL}",
+                "PORT": f"99999{SENTINEL}",
+                "REQUEST_TIMEOUT": f"abc{SENTINEL}",
+                "DATABASE_URL": f"postgres://u:{SENTINEL}@h/db",
+            }
+        )
+    assert keys(ei.value) == ["APP_ENV", "DATABASE_URL", "PORT", "REQUEST_TIMEOUT"]
+    assert SENTINEL not in str(ei.value)
+    assert SENTINEL not in repr(ei.value.issues)
+
+
+def test_secret_in_environment_is_forbidden() -> None:
+    assert forbidden_secret_env({"DATABASE_PASSWORD": "x", "DATABASE_PASSWORD_FILE": "/a"}) == [
+        "DATABASE_PASSWORD"
+    ]
+    with pytest.raises(ConfigError) as ei:
+        load_settings({"DATABASE_PASSWORD": SENTINEL})
+    assert keys(ei.value) == ["DATABASE_PASSWORD"]
+    assert SENTINEL not in str(ei.value)
+    assert load_settings({"DATABASE_PASSWORD": "", "PORT": ""})[0].PORT == 8000
+
+
+def test_does_not_read_process_environment(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.setenv("PORT", "1234")
+    assert load_settings({})[0].PORT == 8000
+
+
+@pytest.mark.parametrize(
+    ("mode", "reason"),
+    [(0o644, "permissoes-abertas"), (0o640, "permissoes-abertas"), (0o470, "permissoes-abertas")],
+)
+def test_open_permissions_rejected(tmp_path: Path, mode: int, reason: str) -> None:
+    with pytest.raises(SecretFileError) as ei:
+        read_secret_file(secret_file(tmp_path, mode=mode))
+    assert ei.value.reason == reason
+    assert SENTINEL not in str(ei.value)
+
+
+def test_missing_symlink_empty_big_and_dir(tmp_path: Path) -> None:
+    def reason(path: str) -> str:
+        with pytest.raises(SecretFileError) as ei:
+            read_secret_file(path)
+        return ei.value.reason
+
+    real = secret_file(tmp_path)
+    link = tmp_path / "ln"
+    link.symlink_to(real)
+    empty = tmp_path / "e"
+    empty.write_text("\n")
+    empty.chmod(0o400)
+    big = tmp_path / "b"
+    big.write_text("a" * 20_000)
+    big.chmod(0o400)
+    assert reason(str(tmp_path / "nao-existe")) == "ausente"
+    assert reason(str(link)) == "link-simbolico"
+    assert reason(str(tmp_path)) == "nao-e-arquivo-regular"
+    assert reason(str(empty)) == "vazio"
+    assert reason(str(big)) == "grande-demais"
+    assert stat.S_IMODE(os.lstat(real).st_mode) == 0o400
+
+
+def test_unreadable_secret_file_reports_without_path(tmp_path: Path) -> None:
+    with pytest.raises(ConfigError) as ei:
+        load_settings({"DATABASE_PASSWORD_FILE": secret_file(tmp_path, mode=0o666)})
+    assert keys(ei.value) == ["DATABASE_PASSWORD_FILE"]
+    assert str(tmp_path) not in str(ei.value)
diff --git a/packages/config/package.json b/packages/config/package.json
new file mode 100644
index 0000000..61e905a
--- /dev/null
+++ b/packages/config/package.json
@@ -0,0 +1,17 @@
+{
+  "name": "@nucleos/config",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "main": "./dist/index.js",
+  "types": "./dist/index.d.ts",
+  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\""
+  },
+  "dependencies": {
+    "zod": "4.6.7"
+  }
+}
diff --git a/packages/config/src/api.ts b/packages/config/src/api.ts
new file mode 100644
index 0000000..28fed8a
--- /dev/null
+++ b/packages/config/src/api.ts
@@ -0,0 +1,74 @@
+import { z } from "zod";
+import { ConfigError, loadSecret, parseConfig } from "./load.js";
+import type { Secret } from "./secret.js";
+import { absolutePathSchema, durationMs, portSchema, serviceUrl, sizeBytes } from "./primitives.js";
+
+export const APP_ENVS = ["local", "ci", "staging", "production"] as const;
+export type AppEnv = (typeof APP_ENVS)[number];
+
+/** Ambientes que exigem banco e segredo (nao ha valor padrao inseguro em staging/producao). */
+const STRICT_ENVS: readonly AppEnv[] = ["staging", "production"];
+
+const apiEnvSchema = z
+  .object({
+    APP_ENV: z.enum(APP_ENVS).default("local"),
+    APP_VERSION: z
+      .string()
+      .regex(/^[0-9A-Za-z.+_-]{1,64}$/, "versao invalida")
+      .default("0.0.0"),
+    HOST: z.string().min(1).max(255).default("127.0.0.1"),
+    PORT: portSchema.default(3001),
+    REQUEST_TIMEOUT: durationMs(100, 300_000).default(30_000),
+    SHUTDOWN_TIMEOUT: durationMs(100, 120_000).default(10_000),
+    MAX_BODY_SIZE: sizeBytes(1, 10 * 1024 * 1024).default(1024 * 1024),
+    DATABASE_URL: serviceUrl(["postgres", "postgresql"]).optional(),
+    DATABASE_PASSWORD_FILE: absolutePathSchema.optional(),
+  })
+  .superRefine((v, ctx) => {
+    if (!STRICT_ENVS.includes(v.APP_ENV)) return;
+    for (const key of ["DATABASE_URL", "DATABASE_PASSWORD_FILE"] as const) {
+      if (v[key] === undefined) {
+        ctx.addIssue({ code: "custom", path: [key], message: `obrigatoria em ${v.APP_ENV}` });
+      }
+    }
+  });
+
+export interface ApiConfig {
+  readonly appEnv: AppEnv;
+  readonly appVersion: string;
+  readonly host: string;
+  readonly port: number;
+  readonly requestTimeoutMs: number;
+  readonly shutdownTimeoutMs: number;
+  readonly maxBodyBytes: number;
+  readonly databaseUrl: string | undefined;
+  /** Senha do banco lida de arquivo; `undefined` apenas em local/ci. */
+  readonly databasePassword: Secret | undefined;
+}
+
+/**
+ * Carrega e valida a configuracao do `apps/api`. Lanca `ConfigError` (sem valores) se ausente ou
+ * invalida; segredos so por arquivo (`DATABASE_PASSWORD_FILE`), com checagem de permissoes.
+ */
+export function loadApiConfig(
+  env: Readonly<Record<string, string | undefined>> = process.env,
+): ApiConfig {
+  const e = parseConfig(apiEnvSchema, env);
+  const databasePassword =
+    e.DATABASE_PASSWORD_FILE === undefined
+      ? undefined
+      : loadSecret("DATABASE_PASSWORD_FILE", e.DATABASE_PASSWORD_FILE);
+  return {
+    appEnv: e.APP_ENV,
+    appVersion: e.APP_VERSION,
+    host: e.HOST,
+    port: e.PORT,
+    requestTimeoutMs: e.REQUEST_TIMEOUT,
+    shutdownTimeoutMs: e.SHUTDOWN_TIMEOUT,
+    maxBodyBytes: e.MAX_BODY_SIZE,
+    databaseUrl: e.DATABASE_URL,
+    databasePassword,
+  };
+}
+
+export { ConfigError };
diff --git a/packages/config/src/config.test.ts b/packages/config/src/config.test.ts
new file mode 100644
index 0000000..080c585
--- /dev/null
+++ b/packages/config/src/config.test.ts
@@ -0,0 +1,140 @@
+import assert from "node:assert/strict";
+import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { test } from "node:test";
+import { ConfigError, Secret, forbiddenSecretEnv, loadApiConfig, readSecretFile } from "./index.js";
+
+const SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a";
+
+function withDir<T>(fn: (dir: string) => T): T {
+  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
+  try {
+    return fn(dir);
+  } finally {
+    rmSync(dir, { recursive: true, force: true });
+  }
+}
+
+function secretFile(dir: string, content = SENTINEL, mode = 0o400): string {
+  const p = join(dir, "db_password");
+  writeFileSync(p, `${content}\n`, { mode: 0o600 });
+  chmodSync(p, mode);
+  return p;
+}
+
+function failure(fn: () => unknown): ConfigError {
+  try {
+    fn();
+  } catch (e) {
+    assert.ok(e instanceof ConfigError, "deveria lancar ConfigError");
+    return e;
+  }
+  throw new Error("deveria falhar");
+}
+
+test("local: padroes seguros sem nenhuma variavel", () => {
+  const c = loadApiConfig({});
+  assert.equal(c.appEnv, "local");
+  assert.equal(c.host, "127.0.0.1");
+  assert.equal(c.port, 3001);
+  assert.equal(c.requestTimeoutMs, 30_000);
+  assert.equal(c.maxBodyBytes, 1024 * 1024);
+  assert.equal(c.databasePassword, undefined);
+});
+
+test("converte duracao, tamanho e URL tipados", () => {
+  withDir((dir) => {
+    const c = loadApiConfig({
+      APP_ENV: "staging",
+      PORT: "8080",
+      REQUEST_TIMEOUT: "5s",
+      SHUTDOWN_TIMEOUT: "2m",
+      MAX_BODY_SIZE: "512kb",
+      DATABASE_URL: "postgres://nucleos@postgres:5432/nucleos",
+      DATABASE_PASSWORD_FILE: secretFile(dir),
+    });
+    assert.equal(c.port, 8080);
+    assert.equal(c.requestTimeoutMs, 5000);
+    assert.equal(c.shutdownTimeoutMs, 120_000);
+    assert.equal(c.maxBodyBytes, 512 * 1024);
+    assert.equal(c.databasePassword?.reveal(), SENTINEL);
+  });
+});
+
+test("staging/producao exigem banco e segredo (falha rapida, so nomes)", () => {
+  for (const appEnv of ["staging", "production"]) {
+    const e = failure(() => loadApiConfig({ APP_ENV: appEnv }));
+    assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]);
+  }
+});
+
+test("valores invalidos falham sem ecoar o valor recebido", () => {
+  const e = failure(() =>
+    loadApiConfig({
+      APP_ENV: `prod-${SENTINEL}`,
+      PORT: `99999${SENTINEL}`,
+      REQUEST_TIMEOUT: `abc${SENTINEL}`,
+      DATABASE_URL: `ftp://u:${SENTINEL}@h/db`,
+    }),
+  );
+  const keys = e.issues.map((i) => i.key);
+  for (const k of ["APP_ENV", "PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]) assert.ok(keys.includes(k), k);
+  assert.ok(!e.message.includes(SENTINEL));
+  assert.ok(!JSON.stringify(e.issues).includes(SENTINEL));
+  assert.ok(!String(e.stack).includes(SENTINEL));
+});
+
+test("limites: porta 0, duracao fora da faixa e senha embutida na URL", () => {
+  const e = failure(() =>
+    loadApiConfig({
+      PORT: "0",
+      REQUEST_TIMEOUT: "1ms",
+      DATABASE_URL: `postgres://u:${SENTINEL}@h/db`,
+    }),
+  );
+  assert.deepEqual(e.issues.map((i) => i.key).sort(), ["DATABASE_URL", "PORT", "REQUEST_TIMEOUT"]);
+  assert.ok(!e.message.includes(SENTINEL));
+});
+
+test("segredo literal por ambiente e proibido; vazio conta como ausente", () => {
+  assert.deepEqual(
+    forbiddenSecretEnv({ DATABASE_PASSWORD: "x", API_KEY: "y", DATABASE_PASSWORD_FILE: "/a", PORT: "1" }),
+    ["API_KEY", "DATABASE_PASSWORD"],
+  );
+  const e = failure(() => loadApiConfig({ DATABASE_PASSWORD: SENTINEL }));
+  assert.deepEqual(e.issues.map((i) => i.key), ["DATABASE_PASSWORD"]);
+  assert.ok(!e.message.includes(SENTINEL));
+  assert.equal(loadApiConfig({ DATABASE_PASSWORD: "", PORT: "" }).port, 3001);
+});
+
+test("arquivo de segredo: ausente, aberto, link simbolico, vazio e grande demais falham", () => {
+  withDir((dir) => {
+    const cfg = (path: string) =>
+      failure(() => loadApiConfig({ APP_ENV: "local", DATABASE_PASSWORD_FILE: path }));
+    assert.match(cfg(join(dir, "nao-existe")).message, /ausente/);
+    assert.match(cfg(secretFile(dir, SENTINEL, 0o644)).message, /permissoes/);
+    assert.ok(!cfg(secretFile(dir, SENTINEL, 0o640)).message.includes(SENTINEL));
+    const real = secretFile(dir);
+    const link = join(dir, "link");
+    symlinkSync(real, link);
+    assert.match(cfg(link).message, /link simbolico/);
+    assert.match(cfg(dir).message, /arquivo regular/);
+    const empty = join(dir, "vazio");
+    writeFileSync(empty, "\n", { mode: 0o400 });
+    assert.match(cfg(empty).message, /vazio/);
+    const big = join(dir, "grande");
+    writeFileSync(big, "a".repeat(20_000), { mode: 0o400 });
+    assert.match(cfg(big).message, /grande demais/);
+    assert.ok(!cfg(join(dir, "nao-existe")).message.includes(dir));
+  });
+});
+
+test("Secret nunca se serializa", () => {
+  withDir((dir) => {
+    const s = readSecretFile(secretFile(dir));
+    assert.ok(s instanceof Secret);
+    for (const out of [String(s), JSON.stringify({ s })]) assert.ok(!out.includes(SENTINEL));
+    assert.equal(s.reveal(), SENTINEL);
+  });
+});
diff --git a/packages/config/src/index.ts b/packages/config/src/index.ts
new file mode 100644
index 0000000..012e80c
--- /dev/null
+++ b/packages/config/src/index.ts
@@ -0,0 +1,10 @@
+export { ConfigError, type ConfigIssue, forbiddenSecretEnv, loadSecret, parseConfig } from "./load.js";
+export { APP_ENVS, type ApiConfig, type AppEnv, loadApiConfig } from "./api.js";
+export {
+  absolutePathSchema,
+  durationMs,
+  portSchema,
+  serviceUrl,
+  sizeBytes,
+} from "./primitives.js";
+export { MAX_SECRET_BYTES, Secret, SecretFileError, readSecretFile } from "./secret.js";
diff --git a/packages/config/src/load.ts b/packages/config/src/load.ts
new file mode 100644
index 0000000..afad7e0
--- /dev/null
+++ b/packages/config/src/load.ts
@@ -0,0 +1,84 @@
+import type { z } from "zod";
+import { type SecretFileReason, SecretFileError, readSecretFile } from "./secret.js";
+import type { Secret } from "./secret.js";
+
+export interface ConfigIssue {
+  /** Nome da variavel (ou do campo) com problema. Nunca o valor recebido. */
+  readonly key: string;
+  /** Mensagem fixa do esquema, sem eco do valor. */
+  readonly message: string;
+}
+
+/**
+ * Configuracao ausente ou invalida. A mensagem lista apenas nomes de variaveis e motivos fixos;
+ * o valor recebido nunca e incluido (nem no `message`, nem em `issues`, nem em `cause`).
+ */
+export class ConfigError extends Error {
+  constructor(readonly issues: readonly ConfigIssue[]) {
+    super(
+      `configuracao invalida (${String(issues.length)}): ` +
+        issues.map((i) => `${i.key}: ${i.message}`).join("; "),
+    );
+    this.name = "ConfigError";
+  }
+}
+
+/**
+ * Nomes que indicam segredo passado diretamente por ambiente (proibido pelo ADR-020 item 1).
+ * Variaveis terminadas em `_FILE` (caminho) sao o formato permitido.
+ */
+const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$/i;
+
+/** Devolve as variaveis do ambiente cujo NOME parece carregar um segredo literal. */
+export function forbiddenSecretEnv(env: Readonly<Record<string, string | undefined>>): string[] {
+  return Object.entries(env)
+    .filter(([k, v]) => v !== undefined && v !== "" && SECRET_NAME.test(k))
+    .map(([k]) => k)
+    .sort();
+}
+
+const SECRET_FILE_MESSAGES: Record<SecretFileReason, string> = {
+  ausente: "arquivo de segredo ausente",
+  "nao-e-arquivo-regular": "segredo deve ser arquivo regular",
+  "link-simbolico": "link simbolico nao permitido",
+  "permissoes-abertas": "permissoes do arquivo devem ser 0400/0600 (sem grupo/outros)",
+  "dono-diferente": "arquivo pertence a outro usuario",
+  vazio: "arquivo de segredo vazio",
+  "grande-demais": "arquivo de segredo grande demais",
+  ilegivel: "arquivo de segredo ilegivel",
+};
+
+type Env = Readonly<Record<string, string | undefined>>;
+
+/**
+ * Valida `env` com o esquema (zod) e falha rapido. Regras:
+ * - variavel com nome de segredo no ambiente => erro (so `*_FILE` e aceito);
+ * - erros do esquema viram `ConfigIssue` por chave, sem o valor recebido.
+ * Entradas vazias (`""`) contam como ausentes.
+ */
+export function parseConfig<S extends z.ZodType>(schema: S, env: Env): z.output<S> {
+  const issues: ConfigIssue[] = forbiddenSecretEnv(env).map((key) => ({
+    key,
+    message: "segredo por variavel de ambiente e proibido (use <NOME>_FILE com caminho de arquivo)",
+  }));
+  const input = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
+  const result = schema.safeParse(input);
+  if (!result.success) {
+    for (const issue of result.error.issues) {
+      // Mensagem do proprio esquema (fixa); `received`/`input` do zod nao sao usados.
+      issues.push({ key: issue.path.map(String).join(".") || "(raiz)", message: issue.message });
+    }
+  }
+  if (issues.length > 0 || !result.success) throw new ConfigError(issues);
+  return result.data;
+}
+
+/** Le o segredo apontado por `path`, convertendo falhas em `ConfigError` sem vazar o caminho. */
+export function loadSecret(key: string, path: string): Secret {
+  try {
+    return readSecretFile(path);
+  } catch (e) {
+    const reason = e instanceof SecretFileError ? e.reason : "ilegivel";
+    throw new ConfigError([{ key, message: SECRET_FILE_MESSAGES[reason] }]);
+  }
+}
diff --git a/packages/config/src/primitives.ts b/packages/config/src/primitives.ts
new file mode 100644
index 0000000..82074c0
--- /dev/null
+++ b/packages/config/src/primitives.ts
@@ -0,0 +1,58 @@
+import { z } from "zod";
+
+/** Porta TCP valida (1-65535), a partir de texto de variavel de ambiente. */
+export const portSchema = z
+  .string()
+  .regex(/^\d{1,5}$/, "porta invalida")
+  .transform(Number)
+  .pipe(z.number().int().min(1).max(65535));
+
+const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const;
+
+/** Duracao `<n>(ms|s|m|h)` convertida para milissegundos, entre `minMs` e `maxMs`. */
+export function durationMs(minMs: number, maxMs: number): z.ZodType<number, string> {
+  return z
+    .string()
+    .regex(/^\d{1,9}(ms|s|m|h)$/, "duracao invalida (use 500ms, 30s, 5m, 1h)")
+    .transform((v) => {
+      const m = /^(\d+)(ms|s|m|h)$/.exec(v);
+      return Number(m?.[1]) * UNIT_MS[m?.[2] as keyof typeof UNIT_MS];
+    })
+    .pipe(z.number().int().min(minMs).max(maxMs));
+}
+
+/** Tamanho `<n>(b|kb|mb)` convertido para bytes, entre `minBytes` e `maxBytes`. */
+export function sizeBytes(minBytes: number, maxBytes: number): z.ZodType<number, string> {
+  const mult = { b: 1, kb: 1024, mb: 1024 * 1024 } as const;
+  return z
+    .string()
+    .regex(/^\d{1,9}(b|kb|mb)$/, "tamanho invalido (use 512kb, 1mb)")
+    .transform((v) => {
+      const m = /^(\d+)(b|kb|mb)$/.exec(v);
+      return Number(m?.[1]) * mult[m?.[2] as keyof typeof mult];
+    })
+    .pipe(z.number().int().min(minBytes).max(maxBytes));
+}
+
+/**
+ * URL de servico (postgres://, redis://, http(s)://) SEM credenciais embutidas: usuario e permitido,
+ * senha nao (a senha vem de um arquivo de segredo). Devolve a URL normalizada.
+ */
+export function serviceUrl(protocols: readonly string[]): z.ZodType<string, string> {
+  return z
+    .string()
+    .max(2048)
+    .refine((v) => URL.canParse(v), "url invalida")
+    .refine((v) => {
+      const u = new URL(v);
+      return protocols.includes(u.protocol.replace(/:$/, ""));
+    }, "protocolo nao permitido")
+    .refine((v) => new URL(v).password === "", "senha embutida na url e proibida (use *_FILE)");
+}
+
+/** Caminho absoluto de arquivo (sem NUL nem `..`), para variaveis `*_FILE`. */
+export const absolutePathSchema = z
+  .string()
+  .max(4096)
+  .refine((v) => v.startsWith("/"), "caminho deve ser absoluto")
+  .refine((v) => !v.includes("\0") && !v.split("/").includes(".."), "caminho invalido");
diff --git a/packages/config/src/secret.ts b/packages/config/src/secret.ts
new file mode 100644
index 0000000..290d720
--- /dev/null
+++ b/packages/config/src/secret.ts
@@ -0,0 +1,82 @@
+import { constants, lstatSync, readFileSync } from "node:fs";
+
+/** Tamanho maximo aceito para um arquivo de segredo (evita ler arquivo arbitrario grande). */
+export const MAX_SECRET_BYTES = 16 * 1024;
+
+/**
+ * Segredo lido de arquivo. Nunca imprime o valor: `toString`, `toJSON` e `inspect` devolvem
+ * `[REDACTED]`. O valor so sai por `reveal()`, chamado no ponto de uso (ex.: abrir conexao).
+ */
+export class Secret {
+  readonly #value: string;
+
+  constructor(value: string) {
+    this.#value = value;
+  }
+
+  reveal(): string {
+    return this.#value;
+  }
+
+  toString(): string {
+    return "[REDACTED]";
+  }
+
+  toJSON(): string {
+    return "[REDACTED]";
+  }
+
+  [Symbol.for("nodejs.util.inspect.custom")](): string {
+    return "Secret([REDACTED])";
+  }
+}
+
+/** Falha de leitura de segredo: o motivo e um codigo fixo; o caminho e o conteudo nunca entram. */
+export class SecretFileError extends Error {
+  constructor(readonly reason: SecretFileReason) {
+    super(`arquivo de segredo invalido: ${reason}`);
+    this.name = "SecretFileError";
+  }
+}
+
+export type SecretFileReason =
+  | "ausente"
+  | "nao-e-arquivo-regular"
+  | "link-simbolico"
+  | "permissoes-abertas"
+  | "dono-diferente"
+  | "vazio"
+  | "grande-demais"
+  | "ilegivel";
+
+/**
+ * Le um segredo de arquivo com checagens (ADR-020, item 1): arquivo regular (sem link simbolico),
+ * sem nenhuma permissao para grupo/outros (mascara 0o077), do mesmo dono do processo, nao vazio
+ * e com tamanho limitado. Remove um unico `\n` final (formato comum de arquivos criados por shell).
+ */
+export function readSecretFile(path: string): Secret {
+  let st;
+  try {
+    st = lstatSync(path);
+  } catch {
+    throw new SecretFileError("ausente");
+  }
+  if (st.isSymbolicLink()) throw new SecretFileError("link-simbolico");
+  if (!st.isFile()) throw new SecretFileError("nao-e-arquivo-regular");
+  if ((st.mode & 0o077) !== 0) throw new SecretFileError("permissoes-abertas");
+  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
+    throw new SecretFileError("dono-diferente");
+  }
+  if (st.size === 0) throw new SecretFileError("vazio");
+  if (st.size > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
+  let raw: string;
+  try {
+    // O_NOFOLLOW fecha a janela entre lstat e leitura (troca por link simbolico).
+    raw = readFileSync(path, { encoding: "utf8", flag: constants.O_RDONLY | constants.O_NOFOLLOW });
+  } catch {
+    throw new SecretFileError("ilegivel");
+  }
+  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
+  if (value.length === 0) throw new SecretFileError("vazio");
+  return new Secret(value);
+}
diff --git a/packages/config/tsconfig.json b/packages/config/tsconfig.json
new file mode 100644
index 0000000..972facb
--- /dev/null
+++ b/packages/config/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
+  "include": ["src"]
+}
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 3bf4965..8696a5f 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -208,6 +208,9 @@ importers:
       '@nestjs/platform-express':
         specifier: 12.2.0
         version: 12.2.0(@nestjs/common@12.2.0(reflect-metadata@0.2.2)(rxjs@7.8.2)(supports-color@7.2.0))(@nestjs/core@12.2.0)(supports-color@7.2.0)
+      '@nucleos/config':
+        specifier: workspace:*
+        version: link:../../packages/config
       '@nucleos/contracts':
         specifier: workspace:*
         version: link:../../packages/contracts
@@ -249,6 +252,12 @@ importers:
         specifier: 19.3.0
         version: 19.3.0(@types/react@19.3.0)
 
+  packages/config:
+    dependencies:
+      zod:
+        specifier: 4.6.7
+        version: 4.6.7
+
   packages/contracts: {}
 
   packages/observability:
@@ -1751,6 +1760,9 @@ packages:
     resolution: {integrity: sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==}
     engines: {node: '>=10'}
 
+  zod@4.6.7:
+    resolution: {integrity: sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==}
+
 snapshots:
 
   '@borewit/text-codec@0.2.2': {}
@@ -3175,3 +3187,5 @@ snapshots:
   wrappy@1.0.2: {}
 
   yocto-queue@0.1.0: {}
+
+  zod@4.6.7: {}
diff --git a/pyproject.toml b/pyproject.toml
index 7dd26e1..f12afd2 100644
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -18,10 +18,10 @@ dev = [
 package = false
 
 [tool.uv.workspace]
-members = ["services/*", "packages/observability-py"]
+members = ["services/*", "packages/observability-py", "packages/config-py"]
 
 [tool.pytest.ini_options]
-testpaths = ["services", "packages/observability-py"]
+testpaths = ["services", "packages/observability-py", "packages/config-py"]
 addopts = "--import-mode=importlib"
 
 # --- Qualidade Python (ENT-FND-002) ---
@@ -47,8 +47,10 @@ mypy_path = [
   "services/tool-gateway/src",
   "services/event-dispatcher/src",
   "services/tenant-runtime/src",
+  "packages/config-py/src",
 ]
 files = [
+  "packages/config-py/src",
   "services/tool-gateway/src",
   "services/event-dispatcher/src",
   "services/tenant-runtime/src/tenant_runtime/policy",
diff --git a/uv.lock b/uv.lock
index 71f8941..7b21f91 100644
--- a/uv.lock
+++ b/uv.lock
@@ -9,6 +9,7 @@ resolution-markers = [
 [manifest]
 members = [
     "nucleos-ai-gateway",
+    "nucleos-config",
     "nucleos-enterprise-python",
     "nucleos-event-dispatcher",
     "nucleos-observability",
@@ -16,6 +17,15 @@ members = [
     "nucleos-tool-gateway",
 ]
 
+[[package]]
+name = "annotated-types"
+version = "0.8.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/5f/56/a8120250d128bed162cd73c76d45f6ef9991f3e068f62a8ee060afa3104a/annotated_types-0.8.0.tar.gz", hash = "sha256:13b2beaad985e05e2d6407ee4c4f35590b11f8d693a258a561055cac8f64cab7", size = 15893, upload-time = "2026-07-23T20:16:13.995Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/99/91/8acff4f5e50511b911bbccb72b8628a49c68ce14148cd9f6431094859a90/annotated_types-0.8.0-py3-none-any.whl", hash = "sha256:f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0", size = 13427, upload-time = "2026-07-23T20:16:12.938Z" },
+]
+
 [[package]]
 name = "ast-serialize"
 version = "0.13.1"
@@ -559,6 +569,21 @@ dependencies = [
 [package.metadata]
 requires-dist = [{ name = "nucleos-observability", editable = "packages/observability-py" }]
 
+[[package]]
+name = "nucleos-config"
+version = "0.0.0"
+source = { editable = "packages/config-py" }
+dependencies = [
+    { name = "pydantic" },
+    { name = "pydantic-settings" },
+]
+
+[package.metadata]
+requires-dist = [
+    { name = "pydantic", specifier = "==2.14.1" },
+    { name = "pydantic-settings", specifier = "==2.16.1" },
+]
+
 [[package]]
 name = "nucleos-enterprise-python"
 version = "0.0.0"
@@ -790,6 +815,142 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/e4/04/d52c7016b04b6c5108f26691f9d33ec82a9b65d041f1a9c771137693d618/protobuf-7.36.2-py3-none-any.whl", hash = "sha256:bdb3a345d48db958e6ce1f18e508beb0cc981d64f24088427549c866cd039f1e", size = 179806, upload-time = "2026-09-17T20:07:58.211Z" },
 ]
 
+[[package]]
+name = "pydantic"
+version = "2.14.1"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "annotated-types" },
+    { name = "pydantic-core" },
+    { name = "typing-extensions" },
+    { name = "typing-inspection" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/7c/0b/8e10b2e693af8ec54346a14caf36221334775975a747c9ceaa3f8371d96d/pydantic-2.14.1.tar.gz", hash = "sha256:94f478203dd03404682a1ada216965651dd74b1d2d5ffd62e00e0837caab5c26", size = 900362, upload-time = "2026-10-11T18:37:55.396Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/35/ea/a56b9fe5066f3537b7882f77e9c5dfb26d8c2eefdaed9b5fc73d57b4dc22/pydantic-2.14.1-py3-none-any.whl", hash = "sha256:9195d967ec791692a04438115466764fb8b9a27b31f14a760437694f40d6b454", size = 488106, upload-time = "2026-10-11T18:37:53.437Z" },
+]
+
+[[package]]
+name = "pydantic-core"
+version = "2.50.1"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "typing-extensions" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/a6/24/af4ec4be49fbc810f35b0bdcacc3d433b56bbfa469fd3bfd4ae116cd9bf1/pydantic_core-2.50.1.tar.gz", hash = "sha256:e50d7b94baac6c7d09927fa5ca5800a0c7ee5015c7fcff65beb3a1931b5a6e09", size = 513515, upload-time = "2026-10-11T18:35:44.82Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ee/94/101b49a6c63f99586755690696eae14532772587d9e39e93f7b8d28a49da/pydantic_core-2.50.1-cp312-cp312-macosx_10_12_x86_64.whl", hash = "sha256:704075d10b74f2f3c6e15407c696d88701df35fc8953f434a431add0d0074db0", size = 2222428, upload-time = "2026-10-11T18:32:20.228Z" },
+    { url = "https://files.pythonhosted.org/packages/db/a3/f8b1b39349c33037c73d7a1b794c9c29d8f07d5bd2b74399c1375a529cc6/pydantic_core-2.50.1-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:e8e1d6ce820aa23317e8209a86bd65a540973c12dc7552b48a4f6c8e9926815e", size = 2025779, upload-time = "2026-10-11T18:32:21.723Z" },
+    { url = "https://files.pythonhosted.org/packages/d2/2d/862a7d115305cc621358e51ba13f296e0ffdf4fbd984be9f63bc7862730b/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:c18db21573bd2c6489f9a544b7499f0df2853958c568e5e783536ee1f690af41", size = 2048429, upload-time = "2026-10-11T18:32:23.3Z" },
+    { url = "https://files.pythonhosted.org/packages/c0/7d/fed95d18bf2b5abe2d5ab2bbec4184bfc22b6805994a33ccdae8edffd25a/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:cb57f304525a5e3c13333b772bf9a473f36326e9c821b2e8e1b2fd36f80ae2c3", size = 2173274, upload-time = "2026-10-11T18:32:24.697Z" },
+    { url = "https://files.pythonhosted.org/packages/93/1e/c6f22ceac65dc3d291ff79bea0eb74cbd1de8b128f01fee48af03bcea1e1/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:a27c09d86600f1bf2fe3f37e1ae697faf3143931c09322cd799da94deee923b5", size = 2360403, upload-time = "2026-10-11T18:32:26.281Z" },
+    { url = "https://files.pythonhosted.org/packages/2c/97/190b5b6bfe4c72f265feb657913eb30749193927a5ad7b83cfa7866a25a2/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:46b3301d3b5c886f77de7546e47274a5842c622ea2020b8c6524c6b66913b4a6", size = 2439799, upload-time = "2026-10-11T18:32:27.844Z" },
+    { url = "https://files.pythonhosted.org/packages/90/24/48cd98388e4ac2c08d0800af36d15413db15e20387f1038123a2c86cb2f6/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:93ba4e9d8210d941c200431a56b2c0400b131865947903937ed3ec5404307d2e", size = 2160157, upload-time = "2026-10-11T18:32:29.553Z" },
+    { url = "https://files.pythonhosted.org/packages/00/86/d909133d0b9979ed14c20f110f21124a0e346caf071bd66ac5af3009062b/pydantic_core-2.50.1-cp312-cp312-manylinux_2_31_riscv64.whl", hash = "sha256:e5faeaee74a57d32b3ab3aebad2e348f06d3ba946fc5d28c1728455f00a3d13a", size = 2229523, upload-time = "2026-10-11T18:32:31.027Z" },
+    { url = "https://files.pythonhosted.org/packages/90/31/4b43f08131b2098e73a852fd932063385f3103b33839fd9d1abdb89e673d/pydantic_core-2.50.1-cp312-cp312-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:a3cda0e538208e5d722bbf3698b24f19c0a7d05bc8d5f8a7f9b121ea7fa243d9", size = 2242700, upload-time = "2026-10-11T18:32:32.622Z" },
+    { url = "https://files.pythonhosted.org/packages/88/77/de39658569dc7a4c293d110a89629f61145e7538f00d1e4280c28debefd3/pydantic_core-2.50.1-cp312-cp312-musllinux_1_1_aarch64.whl", hash = "sha256:57f51b31ff826e2859120cf4737c5a758a48d96f3e97da40ccee1796d58078ff", size = 2278452, upload-time = "2026-10-11T18:32:34.165Z" },
+    { url = "https://files.pythonhosted.org/packages/46/bd/1eeb9e4e791e81210ef9096f58080b32ba15b5b13c108d50aaa3f8ce9f73/pydantic_core-2.50.1-cp312-cp312-musllinux_1_1_armv7l.whl", hash = "sha256:8daa7ee75245d43ad7d747e5c9ecc1b1d06552f72b14887e9276f787d57375f4", size = 2450098, upload-time = "2026-10-11T18:32:35.547Z" },
+    { url = "https://files.pythonhosted.org/packages/1c/e6/b2accfdff17e5a88d6358536702146de00f9339adaa4d5bbe1ee93cb4832/pydantic_core-2.50.1-cp312-cp312-musllinux_1_1_x86_64.whl", hash = "sha256:acbf31f37c53a5ac0c34706c80b4f5107ba20b05fdd3816124bf236ef0c57dd2", size = 2476839, upload-time = "2026-10-11T18:32:37.119Z" },
+    { url = "https://files.pythonhosted.org/packages/3b/7e/c8a83eb5d2cd42c2e13507150fb777b1edea5a018adc9cbf2858a1d08285/pydantic_core-2.50.1-cp312-cp312-win32.whl", hash = "sha256:45b11cac094aa25725581d9304eee93c9028516b9ea80dd9e175e13a5a2c840e", size = 2101425, upload-time = "2026-10-11T18:32:38.593Z" },
+    { url = "https://files.pythonhosted.org/packages/c5/17/8bbd530b8659e9d963f5b16f6cb8e159f4cd174b4d6304e48969ab12dba8/pydantic_core-2.50.1-cp312-cp312-win_amd64.whl", hash = "sha256:132529c83901437ff642f585216831bf5fd7a91df66829907e155192ead62498", size = 2172522, upload-time = "2026-10-11T18:32:40.112Z" },
+    { url = "https://files.pythonhosted.org/packages/af/9f/a79d690b127e4e3cff143d031538ab9aa715f6b2fbeecbd07cd6f2bf9fb7/pydantic_core-2.50.1-cp312-cp312-win_arm64.whl", hash = "sha256:4e834f6a8e4ff772dcc34f58ef5504147a3ea5b0f4eeb13b0f8eb2ca75ac57f1", size = 2161366, upload-time = "2026-10-11T18:32:41.606Z" },
+    { url = "https://files.pythonhosted.org/packages/ae/57/0e237d7091d2cd44a35d243b7344227f90440166860469cd036afc23a04d/pydantic_core-2.50.1-cp313-cp313-macosx_10_12_x86_64.whl", hash = "sha256:d5e062c01286d861fd6a1c4ff6e063547b3e713067f2df033c0ff97ac2ca006b", size = 2222774, upload-time = "2026-10-11T18:32:43.103Z" },
+    { url = "https://files.pythonhosted.org/packages/f7/b9/c720e56858d4e1539503297ed37063e0c08e0f3541c41b777f6a800f75fa/pydantic_core-2.50.1-cp313-cp313-macosx_11_0_arm64.whl", hash = "sha256:0c003c3b7f49debb893d2d85ae099ac5959c9839e2f330fadb1fcdf7a6594482", size = 2024738, upload-time = "2026-10-11T18:32:44.587Z" },
+    { url = "https://files.pythonhosted.org/packages/4d/b8/fbfc25875219cc060e613170ff10e850c6d8924beb4910da57c2ee3ba1d2/pydantic_core-2.50.1-cp313-cp313-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:409e0ea40ec30d9158f33574fd758e689f6045a0f2596701828c27816ca9687d", size = 2047049, upload-time = "2026-10-11T18:32:46.164Z" },
+    { url = "https://files.pythonhosted.org/packages/d7/43/34210124d504c553688f2f04b48500b131237528ac545b445e0d6d30e0d5/pydantic_core-2.50.1-cp313-cp313-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:131059670f1d2444269b8585cb888963994871932447c08b39ac6a51fcfef658", size = 2173415, upload-time = "2026-10-11T18:32:47.722Z" },
+    { url = "https://files.pythonhosted.org/packages/65/cf/6e178e8fdc11da5965bef980983bf46326a42f436871dd51ba0a57f39df1/pydantic_core-2.50.1-cp313-cp313-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:6dbcbee53bf17196a7f745aa9bf5a9603953a1e365b1f020be3207c676a3e7c4", size = 2361719, upload-time = "2026-10-11T18:32:49.217Z" },
+    { url = "https://files.pythonhosted.org/packages/11/14/bd5169d356aa91bf777e28ba0b281c192d286d03c2812c9c9db023a2f00e/pydantic_core-2.50.1-cp313-cp313-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:325c23f3e35cfbf0fe3486fa5f7260d1e45885173002d30a28ca019994124255", size = 2439803, upload-time = "2026-10-11T18:32:51.025Z" },
+    { url = "https://files.pythonhosted.org/packages/1c/bc/d79d000e5203ebef39af839f2ce77a777fcad6e08ad26af9a2fcd114ffc8/pydantic_core-2.50.1-cp313-cp313-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:17e722e156d0444ecaefbe640bdb60928752bf2013e2b7a11cdb099aaae19bec", size = 2158402, upload-time = "2026-10-11T18:32:52.714Z" },
+    { url = "https://files.pythonhosted.org/packages/1b/a5/4902cb5fd599422c130bd3124ab31ee8b771199bd56662702eed07d3fec7/pydantic_core-2.50.1-cp313-cp313-manylinux_2_31_riscv64.whl", hash = "sha256:aa8224f10880d9bf1b5993988ba153d42a8b4f3f4f511f93b1f09c93ff613c72", size = 2229755, upload-time = "2026-10-11T18:32:54.126Z" },
+    { url = "https://files.pythonhosted.org/packages/1a/f5/c1481f8669f6060d89110c9b1374173fc8767ca276b84f4870bd8acd5e3f/pydantic_core-2.50.1-cp313-cp313-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:41bc8237121bd8dc8d888dfd6279fc166ffc88c1f1bf3a8bf00869680533ca4c", size = 2242303, upload-time = "2026-10-11T18:32:55.641Z" },
+    { url = "https://files.pythonhosted.org/packages/04/f9/77fc3c7653ba9b6e42049e17e96b25388187d4a7c274ab1cb07f58ac8419/pydantic_core-2.50.1-cp313-cp313-musllinux_1_1_aarch64.whl", hash = "sha256:45c6266d071c241f2a168d45bf8c54344f0effce35e7e6b73afdec11f3687568", size = 2278345, upload-time = "2026-10-11T18:32:57.38Z" },
+    { url = "https://files.pythonhosted.org/packages/95/9b/0579c5d12e7f2b16b27e6782427987341fcce07b0725e02ddb0b74add0c4/pydantic_core-2.50.1-cp313-cp313-musllinux_1_1_armv7l.whl", hash = "sha256:1deeacb112d14d3f4fcb16b165f7dbaf76c70ba6e82f37ba042bdab51970a0b8", size = 2449947, upload-time = "2026-10-11T18:32:58.896Z" },
+    { url = "https://files.pythonhosted.org/packages/a8/ac/1b677db91eba54cc5922f4de6edc46ba45c2bd712dfdc0130382d158e214/pydantic_core-2.50.1-cp313-cp313-musllinux_1_1_x86_64.whl", hash = "sha256:1c96fd793b73d1b92e65570132505498fe7b21eaef73cdf74e67e5dfba7ac9e4", size = 2476889, upload-time = "2026-10-11T18:33:00.665Z" },
+    { url = "https://files.pythonhosted.org/packages/4d/2a/3a9f6624ee3ea9ccba5249dde11418bb4c35780a7a92608f8768bd3fea39/pydantic_core-2.50.1-cp313-cp313-win32.whl", hash = "sha256:06ead20d39ffd6f2f6f2a8f8a6de67ff8bb1b4f14a8a30e058502514ee2ac685", size = 2101118, upload-time = "2026-10-11T18:33:02.329Z" },
+    { url = "https://files.pythonhosted.org/packages/2d/1f/323f78ddd9d9938aac420c1abb4e8ba799fc8bdab0acc67c0593b837c979/pydantic_core-2.50.1-cp313-cp313-win_amd64.whl", hash = "sha256:7816e98acc08119dc0f340ab167048ecc54126316330c1f0caf7c6756c88e28f", size = 2170840, upload-time = "2026-10-11T18:33:03.919Z" },
+    { url = "https://files.pythonhosted.org/packages/cb/09/8497c52a739ae425c3ac2f7f56414cbc711c67d374346174f40fe2062644/pydantic_core-2.50.1-cp313-cp313-win_arm64.whl", hash = "sha256:c17799a62c142d61b8a3c51752a7cbc87fe2ad4ccfab10e628a77b405075c662", size = 2161633, upload-time = "2026-10-11T18:33:05.518Z" },
+    { url = "https://files.pythonhosted.org/packages/49/33/28b96e81677153715e3eafb9f26663a80841e859fde282a380359b0d3fa1/pydantic_core-2.50.1-cp314-cp314-macosx_10_12_x86_64.whl", hash = "sha256:1cf41f1ae3fa155cf167a72689ad044bcc1e3c97e064123677149bdfb5dafc4a", size = 2224428, upload-time = "2026-10-11T18:33:07.153Z" },
+    { url = "https://files.pythonhosted.org/packages/94/40/15c06410c9b7b8da5805d27b64e09bd3f900e986728106db2689dbc51513/pydantic_core-2.50.1-cp314-cp314-macosx_11_0_arm64.whl", hash = "sha256:4df197990c15b5a37c5a277d131d9f2c67de6133f2e5dafd80d9bba4b99f46f9", size = 2023740, upload-time = "2026-10-11T18:33:08.763Z" },
+    { url = "https://files.pythonhosted.org/packages/a1/4e/5eb629f6efc2a27e421d789dd4bfacbb5f6d09c80c28b13d1e87d73163d5/pydantic_core-2.50.1-cp314-cp314-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:0036473f5583e6a60e50b8b21651511564277a3f05cc5dab8cf579f552cd5f6c", size = 2049435, upload-time = "2026-10-11T18:33:10.366Z" },
+    { url = "https://files.pythonhosted.org/packages/ba/8e/f195aebec49ad12318876ac2368c197a7939f5d52f8e156d2238ef8a4588/pydantic_core-2.50.1-cp314-cp314-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:992c3514ec891fa7858099183e4d64e6bd5a5d4ff452fae29df22faa77a006bb", size = 2172975, upload-time = "2026-10-11T18:33:12.368Z" },
+    { url = "https://files.pythonhosted.org/packages/e0/f5/7ad9fb83010cd5ea0948409db105676ed779c4e709e2d3d89b9fe2558794/pydantic_core-2.50.1-cp314-cp314-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:739dc730e6be3bd5ec2f4ab5cfc7eb047cc45fc1497b3bafec74ff2ed07df597", size = 2364197, upload-time = "2026-10-11T18:33:14.244Z" },
+    { url = "https://files.pythonhosted.org/packages/ca/fb/bf0aab3e78301d202b82a0322ec968cd703b11fc0623fde9a28708936f62/pydantic_core-2.50.1-cp314-cp314-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:32fad3a91e51b6d2039c572db04a5a873260b399f6bd62c3552671fa7a4a2899", size = 2444259, upload-time = "2026-10-11T18:33:15.79Z" },
+    { url = "https://files.pythonhosted.org/packages/45/35/38f6d6564fae57d9b12e5676dfa947e0e7d5c46dbeaa7eb3352261d6d299/pydantic_core-2.50.1-cp314-cp314-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:42b54c2c90ad348b5e3a85e03e715d572c1fde357ef104cdfe3b03b697a404ea", size = 2159857, upload-time = "2026-10-11T18:33:17.51Z" },
+    { url = "https://files.pythonhosted.org/packages/65/a0/fb0a3ca10f139dcf765b2d312d10cf0f65c57c59993229d00ad12b14ceff/pydantic_core-2.50.1-cp314-cp314-manylinux_2_31_riscv64.whl", hash = "sha256:2df1ff41884de2bc4b307bafd7c40a691094fad2ff8e767e5b45a319257bcf4e", size = 2233954, upload-time = "2026-10-11T18:33:19.591Z" },
+    { url = "https://files.pythonhosted.org/packages/8c/6a/e63842252702aa4ec6e6b7178ca85e541a77459076592c23ebe2d9840b33/pydantic_core-2.50.1-cp314-cp314-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:fe90228920fd8ff2be62622b6bb8a2b11acd65046d50c6b130614b5879605a20", size = 2243876, upload-time = "2026-10-11T18:33:21.393Z" },
+    { url = "https://files.pythonhosted.org/packages/39/25/5991cf8318b37e0dfab47b87541619a1df8501a793cba0d978846cba37a7/pydantic_core-2.50.1-cp314-cp314-musllinux_1_1_aarch64.whl", hash = "sha256:844b869f118e22a41a091bdcedda8a71bc1b0f62c38d1a0c3211cece47e1d8fc", size = 2277908, upload-time = "2026-10-11T18:33:23.324Z" },
+    { url = "https://files.pythonhosted.org/packages/a7/3e/3ee8baaa6cc25a6961c69168cf9ff0f002d56f4e0d541ad6724c18fb61f3/pydantic_core-2.50.1-cp314-cp314-musllinux_1_1_armv7l.whl", hash = "sha256:2eb75304506894a281d346220a4f7481a1b8729577c5ed2a05395991966a8396", size = 2449285, upload-time = "2026-10-11T18:33:24.942Z" },
+    { url = "https://files.pythonhosted.org/packages/c0/c7/acbec6deac13fe697a80c275a9b6661db62c4d323bac8a47347b1f39c7cd/pydantic_core-2.50.1-cp314-cp314-musllinux_1_1_x86_64.whl", hash = "sha256:6b20a4bffabdad0db2927ac034ae3b8a681b1f7a0182f3e60b479ad2fde21ebb", size = 2479013, upload-time = "2026-10-11T18:33:26.925Z" },
+    { url = "https://files.pythonhosted.org/packages/10/08/21a3f237b264389f6219d053ee78fc1b5c2fd402c1b1cb2b6cb8b85f9834/pydantic_core-2.50.1-cp314-cp314-pyemscripten_2026_0_wasm32.whl", hash = "sha256:99ba9bc2b8062ea0c326a990f7f00e6530c23579de66dd246e72c4cafef950a5", size = 1484400, upload-time = "2026-10-11T18:33:28.693Z" },
+    { url = "https://files.pythonhosted.org/packages/09/ce/077a6d262d12ef09108377ac0717f029f420d773ace63cafd6143af75568/pydantic_core-2.50.1-cp314-cp314-win32.whl", hash = "sha256:cf356f70551d40374eaffb1aa63f1eb6d2006681cbd7a9faea173ce0f4dd7cd2", size = 2103222, upload-time = "2026-10-11T18:33:30.326Z" },
+    { url = "https://files.pythonhosted.org/packages/14/4c/350a2415209c43d670eb71d3c040f332c04a30583d39e311b05c7ac15762/pydantic_core-2.50.1-cp314-cp314-win_amd64.whl", hash = "sha256:d32f3acc081cc3923386d88f422cde8892335e95f034e0104bb4cf9310d9915f", size = 2171586, upload-time = "2026-10-11T18:33:32.139Z" },
+    { url = "https://files.pythonhosted.org/packages/bf/92/9bea6ca96580a0902fed366f064f0829e404f41889b34543279a1162b888/pydantic_core-2.50.1-cp314-cp314-win_arm64.whl", hash = "sha256:bed5163e03b98bc1fa2eb05d74c63d9c5c95d8ed6254985481640fbf5e237dea", size = 2155773, upload-time = "2026-10-11T18:33:33.896Z" },
+    { url = "https://files.pythonhosted.org/packages/86/8c/f121f073cf32bdd5cba7e6230b1ce0ac845b0cf43e44dd597d95af272db2/pydantic_core-2.50.1-cp314-cp314t-macosx_10_12_x86_64.whl", hash = "sha256:9572c1369e9c9da2d64a7b7992c786d90ff295abc93964cfe3125e4290768070", size = 2234017, upload-time = "2026-10-11T18:33:35.588Z" },
+    { url = "https://files.pythonhosted.org/packages/a4/69/2bb2bcd6146cffe98d760a46c42ae71efd5151d9b2f9c9bf6619a3b32083/pydantic_core-2.50.1-cp314-cp314t-macosx_11_0_arm64.whl", hash = "sha256:2005207aafe1231315718bf6ed5d064a7300fb4772754af35ee72fc68159492e", size = 2001016, upload-time = "2026-10-11T18:33:37.57Z" },
+    { url = "https://files.pythonhosted.org/packages/20/b3/fbf854c7d07ec114260c26e9e2071a4381740f9ae09641dbfcbdf2a18c45/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:64f6047f62a6c5ae08d0a6afb035667aa2d97c3d20d69762e034c5ea144d92a5", size = 2023015, upload-time = "2026-10-11T18:33:39.433Z" },
+    { url = "https://files.pythonhosted.org/packages/65/20/6de55b2f92cdb614b745c6e9ced639fc4fd7e1e77604825a88bdece6fcbd/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:1ef800dd7d85bcdadf4c3076e4c94e43939493558a3b69a1ea830c706d4617bb", size = 2192543, upload-time = "2026-10-11T18:33:41.381Z" },
+    { url = "https://files.pythonhosted.org/packages/0c/d9/19e91c94bd5c405945ce2f15526808aea37e162c253160de8ed7bf70b406/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:b0135bcdcaa0f23573f286e4cb5e0fd2962700964ed13df085b85f2b97aeab9e", size = 2388704, upload-time = "2026-10-11T18:33:43.167Z" },
+    { url = "https://files.pythonhosted.org/packages/b6/bc/2e24c8415eae1a25ee5a5484946a917123bad2e9d01689a759236928175a/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:0b3a6f334c6a2345ca15318ff894502a90012536404b37c844a976c76c846e0b", size = 2464118, upload-time = "2026-10-11T18:33:44.856Z" },
+    { url = "https://files.pythonhosted.org/packages/bd/1f/945b8053cb061c64e102bcaf7bfb9ed740c0bd4349f9bb978a7d4ddff4ab/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:06e01fbbfdb9be777b316a71b6c49efaf4a08b615d0a98d678cda3023f79d019", size = 2150142, upload-time = "2026-10-11T18:33:46.661Z" },
+    { url = "https://files.pythonhosted.org/packages/2b/78/96a3e50bf0d64aaae781107eb9335b7529d05a85793ed6e7241c4cd1d931/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_31_riscv64.whl", hash = "sha256:a29a061fec0b4e2d714f277e70a3a18125ecff803f2fea6eade2f2e53711d112", size = 2245577, upload-time = "2026-10-11T18:33:48.574Z" },
+    { url = "https://files.pythonhosted.org/packages/7a/5d/a6038a0322232758a6ebfa709f4ca14a60bf5b93940cd0b345056a557da4/pydantic_core-2.50.1-cp314-cp314t-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:f5187624823423e1d1b82b1072ac41dc837389e18d3d0572cc19bbee46cd550a", size = 2263728, upload-time = "2026-10-11T18:33:50.527Z" },
+    { url = "https://files.pythonhosted.org/packages/0d/4b/76ded3333a457a9344c4f2d63f2d82d0101654b05178fa4ddfe7d3627674/pydantic_core-2.50.1-cp314-cp314t-musllinux_1_1_aarch64.whl", hash = "sha256:3e46a9eb0a0901dd6275e6b06ac3a464885ef350ec4121fe486869de8053e4bb", size = 2293630, upload-time = "2026-10-11T18:33:52.362Z" },
+    { url = "https://files.pythonhosted.org/packages/a9/00/9eca378335c9c1b72bc779bf6e4c2a82ce784f14ec48a0e87102c9870e05/pydantic_core-2.50.1-cp314-cp314t-musllinux_1_1_armv7l.whl", hash = "sha256:756d669f04e62ec4148ecfe22be6a4484d9b1181a6ef32e205ebfd200540858b", size = 2468048, upload-time = "2026-10-11T18:33:54.118Z" },
+    { url = "https://files.pythonhosted.org/packages/35/ca/e3832e9cf93651251de43c8c5c029ed680a3c1a0a1b17ee26c81bed08cbd/pydantic_core-2.50.1-cp314-cp314t-musllinux_1_1_x86_64.whl", hash = "sha256:c516cc5367ca3448995d42cb994bf3f4c9002d2a7c22eac9622551269ad1b807", size = 2512159, upload-time = "2026-10-11T18:33:55.99Z" },
+    { url = "https://files.pythonhosted.org/packages/4b/f2/773469b5a10a39116a2cb17edaf6d722f017dd8da07161b371465311c542/pydantic_core-2.50.1-cp314-cp314t-win32.whl", hash = "sha256:9d1bed94af6a63835461f3cf7502058eb166c58c4778e11d0f433cfb1bd69e19", size = 2098406, upload-time = "2026-10-11T18:33:58.043Z" },
+    { url = "https://files.pythonhosted.org/packages/ee/42/0bb74f8f25204b259b11ab7c12dc7f180893b6bd706118b385147fb6efd5/pydantic_core-2.50.1-cp314-cp314t-win_amd64.whl", hash = "sha256:c8dce1f1e0e5358b682a6ad3fa5e31b31d4560997b8e61417e9217c8d60f8a0c", size = 2148481, upload-time = "2026-10-11T18:33:59.913Z" },
+    { url = "https://files.pythonhosted.org/packages/47/0d/d801646c9679a4e630e15cf521d4108b93854b42a6e6e02391bd4c6b1095/pydantic_core-2.50.1-cp314-cp314t-win_arm64.whl", hash = "sha256:ceff0acc940be2715bd6ad17b24c0e5304abf44f6efd0f81ee8499e640f9dc86", size = 2174972, upload-time = "2026-10-11T18:34:01.875Z" },
+    { url = "https://files.pythonhosted.org/packages/b2/84/23984b763d8862a02a13d27a44b6e8169428fd85ecfed88f54c29108604d/pydantic_core-2.50.1-cp315-cp315-macosx_10_12_x86_64.whl", hash = "sha256:8a6791afa2245e6c6b180122d105941644f5bd410bb18623b408808cc41a3102", size = 2224599, upload-time = "2026-10-11T18:34:04.016Z" },
+    { url = "https://files.pythonhosted.org/packages/4d/90/a63cf8586abc1d1a3f6d9b18f0224789ebf003851f092ebda3c7c863fd32/pydantic_core-2.50.1-cp315-cp315-macosx_11_0_arm64.whl", hash = "sha256:84f34323a61a365b4e9295de6028474754829aaddd59c7bf1a040e7487ef8f3c", size = 2024191, upload-time = "2026-10-11T18:34:05.901Z" },
+    { url = "https://files.pythonhosted.org/packages/a6/6a/f34bff9808ffb4907fbf5f5040457d253cacf2da7fce9efbc99ca1b1a44d/pydantic_core-2.50.1-cp315-cp315-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:23edad659e8dbd8ca7e4e877fe6c81573abbdf215bd25a68b53e1272f58b80c7", size = 2048252, upload-time = "2026-10-11T18:34:07.757Z" },
+    { url = "https://files.pythonhosted.org/packages/b2/54/13f419bf1eb59852003818e25935aaf175687d978f4c4bca70e08fe40a3b/pydantic_core-2.50.1-cp315-cp315-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:3a5fce22f1e87d181e924e12da7d81cfe031fb3881a5ddf26ad28f141756ca43", size = 2173376, upload-time = "2026-10-11T18:34:09.592Z" },
+    { url = "https://files.pythonhosted.org/packages/6d/6c/b5a34d24cd0c81669d8f8339d74e6815abcf2f8fb48ab4b49b84c09be1d5/pydantic_core-2.50.1-cp315-cp315-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:c73622ef819328873b53109ee4f77ceb598bffedd02daf916102be3228866b78", size = 2364559, upload-time = "2026-10-11T18:34:11.534Z" },
+    { url = "https://files.pythonhosted.org/packages/eb/8d/d64d6216a8df365082665927ff923f183056f9049fee08e9777c9ac05296/pydantic_core-2.50.1-cp315-cp315-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:ce8c25ca38cc0e3d7753ba180808de2c0c8cb24eae0df64491e40921454e9831", size = 2444697, upload-time = "2026-10-11T18:34:13.535Z" },
+    { url = "https://files.pythonhosted.org/packages/b8/0d/1b1149f60a00ea21ba5f70e28acbd40feb4598af414f80f53c921fac07c9/pydantic_core-2.50.1-cp315-cp315-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:7689580e72a642ab5ec64d5f55b2e33636fa43b4ebe63c0c2c965ef307c7d1aa", size = 2159961, upload-time = "2026-10-11T18:34:15.56Z" },
+    { url = "https://files.pythonhosted.org/packages/1e/35/f236549299dcc78e71e945495d7ec67e78d20844d0999c60601685003031/pydantic_core-2.50.1-cp315-cp315-manylinux_2_31_riscv64.whl", hash = "sha256:d5c0e32fdbce7f1e8ef4d11f655694bf5f4175c757a9f1dc2be09b8864e5bcf5", size = 2234581, upload-time = "2026-10-11T18:34:17.502Z" },
+    { url = "https://files.pythonhosted.org/packages/6a/85/26901a490522b7f75ef9bb9a7afb73e5bb550f0e1cb5b99a0069183e2eb9/pydantic_core-2.50.1-cp315-cp315-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:40f523349960fa30f3ea51404308ff50f9997a90df639590f47a057c1f32b415", size = 2244090, upload-time = "2026-10-11T18:34:19.402Z" },
+    { url = "https://files.pythonhosted.org/packages/ca/2c/481bcfc70ceeb77a778ca6e5b705fe592cb64735c108157f81b7dd9c280e/pydantic_core-2.50.1-cp315-cp315-musllinux_1_1_aarch64.whl", hash = "sha256:d4193206b6587047437f6f11d7e776df23e1c1e23af2a54d9347275614791e10", size = 2277948, upload-time = "2026-10-11T18:34:21.317Z" },
+    { url = "https://files.pythonhosted.org/packages/24/eb/f1e09333faa7ba447cde967310f758430cc7c5e987bdab5228816c70030d/pydantic_core-2.50.1-cp315-cp315-musllinux_1_1_armv7l.whl", hash = "sha256:84bc765b282a9d5b7fe0348b8648904f25a6a04b2139da52b1dd30c8ac3a2c8f", size = 2449688, upload-time = "2026-10-11T18:34:23.321Z" },
+    { url = "https://files.pythonhosted.org/packages/d1/b3/036bde636db8f76d92996e81aefc75678ab5cec4a07eea1ad0c72a893fc3/pydantic_core-2.50.1-cp315-cp315-musllinux_1_1_x86_64.whl", hash = "sha256:ed1e728b39a383c81035b2459cfcb35d99dfb01f7d6ebe3a913bc1cc5b81e459", size = 2479286, upload-time = "2026-10-11T18:34:25.214Z" },
+    { url = "https://files.pythonhosted.org/packages/d0/a3/07f018294ee18d144afeb6df1a47d9e92960f014be45c5ed13519fa5af95/pydantic_core-2.50.1-cp315-cp315-win32.whl", hash = "sha256:bc94f474417604bd383d2cd445d071b07dd55fedceed3ce33407bf1fcc107290", size = 2103683, upload-time = "2026-10-11T18:34:27.42Z" },
+    { url = "https://files.pythonhosted.org/packages/5f/98/f9bd7e1f9b6709f155acb9ef826d9c3884fe925f811fd8e55b9b52280bad/pydantic_core-2.50.1-cp315-cp315-win_amd64.whl", hash = "sha256:983a662de2571cb2502fc8ff47b6770b03d025d2eb314c92f77b3f07c74720ed", size = 2171681, upload-time = "2026-10-11T18:34:29.508Z" },
+    { url = "https://files.pythonhosted.org/packages/10/87/4bb3e1e7f385c076ab5af4d6dd0571b22042cd8207eb810d5b9fef15ae31/pydantic_core-2.50.1-cp315-cp315-win_arm64.whl", hash = "sha256:94845ff54dc5193f228cab81b2662a04bfbb892e95bdc15edf7399000ce57d54", size = 2156251, upload-time = "2026-10-11T18:34:31.455Z" },
+    { url = "https://files.pythonhosted.org/packages/47/47/83643225b08f2aef6c8cc4bbe6e3f79c5e139c4364a6e450d0f399d87774/pydantic_core-2.50.1-cp315-cp315t-macosx_10_12_x86_64.whl", hash = "sha256:4a53d13cdfbedbfa87f08b83c1a0a5efcc767d785a4b41934fa9cb672670493a", size = 2234363, upload-time = "2026-10-11T18:34:33.65Z" },
+    { url = "https://files.pythonhosted.org/packages/5e/66/127ca649ba2f2462039dc1e694c6c01e00a3689f023a617364d3507e6d97/pydantic_core-2.50.1-cp315-cp315t-macosx_11_0_arm64.whl", hash = "sha256:efbecf43d321f7b9281441f1f213f7c21c66988b0e06c2730ba13ed47a46bb08", size = 2000972, upload-time = "2026-10-11T18:34:36.037Z" },
+    { url = "https://files.pythonhosted.org/packages/5e/4f/e421e0a5d653b1203b090b2e48745976988d7338a647940704b5b9c2b399/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:bc1f08f68dac9f9e83845a8039880aba2ab553eb9b2259c3243a313182c253fe", size = 2022925, upload-time = "2026-10-11T18:34:37.972Z" },
+    { url = "https://files.pythonhosted.org/packages/d5/4e/ea5568e2491e1a71100f15ae8c2d01ef52db42a184a2d4e716bc79e5eb8f/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:5dfe41f232befddb9c4377f6cfc702b51595e2d78ed082672adf8758d2c4619f", size = 2192867, upload-time = "2026-10-11T18:34:39.921Z" },
+    { url = "https://files.pythonhosted.org/packages/ae/5e/3b8c3a35acbe219909ada5defad5d7d9fed845fb2b37bd5ec518f453c119/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:adc06d218a1cadfd2ec4628424d7d79ce4eba69c2965e7e7b55106f0da5208c8", size = 2388687, upload-time = "2026-10-11T18:34:42.184Z" },
+    { url = "https://files.pythonhosted.org/packages/b6/aa/7889b4e515f91a2e8c0ae6b5081fec0feb30c4398d1434e14793c60f173a/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:2cf91809d0721ab81592ba67bea7694821679c10b1a2e3c3460082b286c1918a", size = 2464415, upload-time = "2026-10-11T18:34:44.384Z" },
+    { url = "https://files.pythonhosted.org/packages/08/78/93449e628eb8a6fdcce3eff9043081179d1bc7ce6f1bff32dc5006f41e00/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:23923ab9292c40da026330b1ecf4dc2618c8e86e0422e5d1fbf50d94d64ca4f8", size = 2150823, upload-time = "2026-10-11T18:34:46.392Z" },
+    { url = "https://files.pythonhosted.org/packages/f4/f1/72c5bc129fceb0d00f05dc1e67f518c1728de1928c55f81fc13d7690de39/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_31_riscv64.whl", hash = "sha256:f3377c8c2b3ce898423c5e5dd94c7982e30aa7717a7e6ab2470b9de364963709", size = 2245806, upload-time = "2026-10-11T18:34:48.805Z" },
+    { url = "https://files.pythonhosted.org/packages/28/2a/922a0e78f3aa6ab837b59f88190233fb8dad546c17995fde9bb3ed3b9b49/pydantic_core-2.50.1-cp315-cp315t-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:455a773617b5913bf5c20d0692e5787b119e52c4d40ea644ca31f5758fd31be2", size = 2264160, upload-time = "2026-10-11T18:34:50.876Z" },
+    { url = "https://files.pythonhosted.org/packages/52/a8/0f1449e3e1b20941c9372faa18e7b6a092e30cdfa841902473f7989532ac/pydantic_core-2.50.1-cp315-cp315t-musllinux_1_1_aarch64.whl", hash = "sha256:1a9006395dece0e32e704c315eff8a00bede494f6108546cfc5539c89fef4f9a", size = 2294031, upload-time = "2026-10-11T18:34:52.876Z" },
+    { url = "https://files.pythonhosted.org/packages/d1/d0/1031f492857de70355fb16524bbb03efce5fd34c93ed4a1ec60be07e0d4b/pydantic_core-2.50.1-cp315-cp315t-musllinux_1_1_armv7l.whl", hash = "sha256:d2d82aa62521c55ddfb000ae70f88cdd8de974078f6024e821dfe5addd0c818f", size = 2468423, upload-time = "2026-10-11T18:34:54.995Z" },
+    { url = "https://files.pythonhosted.org/packages/46/52/269ffffa645b8e47906395a39cf9db1151ae9fa4bcd7f47b960bc31baf37/pydantic_core-2.50.1-cp315-cp315t-musllinux_1_1_x86_64.whl", hash = "sha256:009634b83993777ddcd69cad0ffcace43dabde692109528e35f0fde91e386a8b", size = 2512598, upload-time = "2026-10-11T18:34:57.149Z" },
+    { url = "https://files.pythonhosted.org/packages/31/5c/e47e28281f20326ff6f3c31d626f0a83e615d2d94ba41bb0ad6ec237184a/pydantic_core-2.50.1-cp315-cp315t-win32.whl", hash = "sha256:3fde4fdc6487a58d944ca87cf5adc95d5f266e872c19599f5f4c0a8a1b1f9f9f", size = 2098535, upload-time = "2026-10-11T18:34:59.313Z" },
+    { url = "https://files.pythonhosted.org/packages/03/ad/759e181e69c1b472c60b2049e5f61d5da1deefdd5ce1df4bb2ebcf771f25/pydantic_core-2.50.1-cp315-cp315t-win_amd64.whl", hash = "sha256:1c8632d4ac04e6f91128fca584b3a8a507d81604c24eeaaad00d4be42765c32b", size = 2148645, upload-time = "2026-10-11T18:35:01.571Z" },
+    { url = "https://files.pythonhosted.org/packages/6d/56/8a702c27e5be9f47e5f19d8669227424290e4c024e7c370279cbaf244b4e/pydantic_core-2.50.1-cp315-cp315t-win_arm64.whl", hash = "sha256:c3ede305158e75510be50869b319550ab072008c13d64d4ab1e094fb286b6f44", size = 2175297, upload-time = "2026-10-11T18:35:04.079Z" },
+    { url = "https://files.pythonhosted.org/packages/a5/09/1bcf160f3cd6333e2a76982fae5963e5032de0bcaaba38464223dc266bfe/pydantic_core-2.50.1-graalpy312-graalpy250_312_native-macosx_10_12_x86_64.whl", hash = "sha256:76e2e83fa6ec8cdc972d438dafc2522b3a47bee4ec0ae668b29cfb1977ab5242", size = 2217070, upload-time = "2026-10-11T18:35:15.688Z" },
+    { url = "https://files.pythonhosted.org/packages/3d/81/f02de95eec7794dfc7a5bc69a834f0e834b31b3009014ce6de903855f775/pydantic_core-2.50.1-graalpy312-graalpy250_312_native-macosx_11_0_arm64.whl", hash = "sha256:a51eee75939cf811ac09b278745a6cee7dc873ccfbc8b9af3cc88fe4b7ce25b5", size = 2039027, upload-time = "2026-10-11T18:35:18.07Z" },
+    { url = "https://files.pythonhosted.org/packages/4d/16/227746ed3771d9bf2304568b55134849ece34e13b38b1d76de763015c77f/pydantic_core-2.50.1-graalpy312-graalpy250_312_native-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:ae28183297fb0d2b8dc46a1f01d51f5e45825fc5afe76a835a6cb7fb34821295", size = 2109009, upload-time = "2026-10-11T18:35:20.218Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/b9/7664d1592a0e5a74903f357cd5b28ceb7336f3473256c5a4e8c8432f1881/pydantic_core-2.50.1-graalpy312-graalpy250_312_native-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:88e492e8b9d0312e7dc13667c30222abf284dc3b79b5302b3607b41a5784ce61", size = 2269883, upload-time = "2026-10-11T18:35:22.48Z" },
+]
+
+[[package]]
+name = "pydantic-settings"
+version = "2.16.1"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "pydantic" },
+    { name = "python-dotenv" },
+    { name = "typing-extensions" },
+    { name = "typing-inspection" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/05/ca/7817b4bf0c4b15c6a6ab8cdf4cb96c268335a8ca2f525de93b6ebe4c7d28/pydantic_settings-2.16.1.tar.gz", hash = "sha256:aff602a1886338c2df3d1e958e2193a8dc33cec75b91f202e83fd98484b4b0da", size = 303436, upload-time = "2026-10-20T11:37:19.024Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/3c/74/fdf926afe145d8629c4b2ff57f4ea1d64ed7abc4d84d97463b2517a2547e/pydantic_settings-2.16.1-py3-none-any.whl", hash = "sha256:30f5313340da4e8f1b440d1910b92a5bc3ccbb6b4ba70ec2b8395bc921f418f5", size = 80771, upload-time = "2026-10-20T11:37:17.298Z" },
+]
+
 [[package]]
 name = "pygments"
 version = "2.21.0"
@@ -828,6 +989,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/03/e2/08a497ef684b88559c9cc5f4ad53a37e7b99e727094a86d6ea32536d5d3c/pytest_asyncio-1.4.0-py3-none-any.whl", hash = "sha256:933ca923a23075a87fb7070c0ec272a6848489824d887c85c812670932835aa1", size = 16930, upload-time = "2026-05-26T09:56:02.576Z" },
 ]
 
+[[package]]
+name = "python-dotenv"
+version = "1.2.4"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/74/26/2fbeedb218a787a5eea551c7532cac4e009f83d689dd2faa0d0353473f86/python_dotenv-1.2.4.tar.gz", hash = "sha256:f0d53e69935a851c0dcc78f3ab7aaccd8cabef0b92382b576b824212902873c0", size = 60824, upload-time = "2026-10-01T05:36:10Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/60/d1/38f3a3405989a89ac18390803e70c6ad7c7760da4f9b83cbeca0c44a0c72/python_dotenv-1.2.4-py3-none-any.whl", hash = "sha256:42269a8a5b3fd54ffa6f3d84b18abed50064717576b4ecf03dc4a55d8aa04fdc", size = 23266, upload-time = "2026-10-01T05:36:08.633Z" },
+]
+
 [[package]]
 name = "requests"
 version = "2.34.2"
@@ -899,6 +1069,18 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/49/d3/b8441a820a491ddfc024b0b0cf0393375b75ea13866d9c66727e54c2fc80/typing_extensions-4.16.0-py3-none-any.whl", hash = "sha256:481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8", size = 45571, upload-time = "2026-07-02T08:40:04.659Z" },
 ]
 
+[[package]]
+name = "typing-inspection"
+version = "0.4.4"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "typing-extensions" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/a3/26/b09b8010994eccc3c09092e6b34058f36a460eea2d4c3e8b910c695975a0/typing_inspection-0.4.4.tar.gz", hash = "sha256:547274fa6b0a561ccf549cc9524b999a578e737d015d8709d021f9d0d13bea47", size = 76928, upload-time = "2026-08-12T12:37:25.997Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/67/81/4add07e5172b7ac40d8ed5ff580409a7801a4fe26d529bdd915401dabfbe/typing_inspection-0.4.4-py3-none-any.whl", hash = "sha256:65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147", size = 14750, upload-time = "2026-08-12T12:37:24.648Z" },
+]
+
 [[package]]
 name = "urllib3"
 version = "2.8.0"
````

## Rodada 1 — diffs

Commit `6269603` (`fix(infra): corrige rollback, bloqueio de segredos e verificador do FND-006 (rodada 1)`), sobre `93c7049`/`1951067`. A evidencia da secao anterior permanece.

### Commit `6269603` (codigo, testes, tabela compartilhada)

````diff
commit 6269603fa95f7a8b89b3bc41e061704aaea563d0
fix(infra): corrige rollback, bloqueio de segredos e verificador do FND-006 (rodada 1)


diff --git a/infrastructure/docker/scripts/deploy-lib.mjs b/infrastructure/docker/scripts/deploy-lib.mjs
index d437762..5b2768a 100644
--- a/infrastructure/docker/scripts/deploy-lib.mjs
+++ b/infrastructure/docker/scripts/deploy-lib.mjs
@@ -1,8 +1,26 @@
 // Verificacoes puras de staging/producao (FND-006): usadas por verificar-deploy.mjs (make lint)
 // e pelo teste efemero (tests/ambientes.test.mjs). Sem dependencias externas.
 
-/** Nome de variavel que indica segredo literal; `*_FILE` (caminho) e o formato permitido. */
-export const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$/i;
+const SECRET_TOKENS = new Set([
+  "PASS", "PASSWORD", "PASSWD", "PWD", "SECRET", "TOKEN", "KEY", "APIKEY", "CREDENTIAL", "CREDENTIALS", "DSN",
+]);
+const SECRET_SUFFIXES = ["PASSWORD", "PASSWD", "SECRET", "TOKEN", "APIKEY", "PRIVATEKEY", "CREDENTIAL", "CREDENTIALS"];
+
+/**
+ * Nome de variavel que indica segredo literal (ADR-020 item 1): algum token separado por `_`
+ * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
+ * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de packages/config e config-py.
+ */
+const NOT_SECRET = new Set(["PWD", "OLDPWD"]); // variaveis POSIX/shell
+
+export function isSecretName(name) {
+  const up = name.toUpperCase().replace(/[.-]/g, "_");
+  if (NOT_SECRET.has(up)) return false;
+  if (/_(FILE|PATH)$/.test(up)) return false;
+  if (up.split("_").some((t) => SECRET_TOKENS.has(t))) return true;
+  const compact = up.replaceAll("_", "");
+  return SECRET_SUFFIXES.some((suf) => compact.endsWith(suf));
+}
 
 const SECRET_VALUE_PATTERNS = [
   [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada PEM"],
@@ -17,7 +35,7 @@ export function secretFindingsInEnv(env) {
   const findings = [];
   for (const [name, value] of Object.entries(env)) {
     const v = value ?? "";
-    if (v !== "" && SECRET_NAME.test(name)) findings.push(`${name}: nome de segredo no ambiente`);
+    if (v !== "" && isSecretName(name)) findings.push(`${name}: nome de segredo no ambiente`);
     for (const [re, label] of SECRET_VALUE_PATTERNS) {
       if (re.test(v)) findings.push(`${name}: ${label}`);
     }
@@ -38,11 +56,11 @@ export function secretFindingsInText(text) {
   const out = [];
   text.split("\n").forEach((line, i) => {
     const code = line.replace(/\s+#.*$/, "");
-    const m = /^\s*([A-Za-z0-9_.-]*(?:password|passwd|secret|token|api_?key|private_?key|credential)s?)\s*[:=]\s*(.+)$/i.exec(code);
-    if (m) {
+    const m = /^\s*([A-Za-z0-9_.-]+)\s*[:=]\s*(.+)$/.exec(code);
+    if (m?.[1] !== undefined && m[2] !== undefined && isSecretName(m[1])) {
       const key = m[1];
       const val = m[2].trim().replace(/^["']|["']$/g, "");
-      const ok = /_file$/i.test(key) || key === "secrets" || val === "" || val.startsWith("$") || val.startsWith("/run/secrets/") || /^(\[\]|\{\})$/.test(val);
+      const ok = key === "secrets" || val === "" || val.startsWith("$") || val.startsWith("/run/secrets/") || /^(\[\]|\{\})$/.test(val);
       if (!ok) out.push(`linha ${i + 1}: valor literal para "${key}"`);
     }
     for (const [re, label] of SECRET_VALUE_PATTERNS.slice(0, 4)) {
@@ -52,6 +70,9 @@ export function secretFindingsInText(text) {
   return out;
 }
 
+/** `cap_add` permitido por servico (excecoes documentadas; ISO-002 reavalia). */
+const CAP_ADD_ALLOW = { postgres: ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"] };
+
 const DIGEST = /@sha256:[0-9a-f]{64}$/;
 const LOOPBACK = "127.0.0.1";
 
@@ -70,11 +91,25 @@ export function verifyRendered(cfg, label) {
     if (!s.mem_limit || !s.cpus || !s.pids_limit) add(name, "limites de memoria, CPU e PIDs obrigatorios");
     if (s.user === undefined && name === "api") add(name, "usuario nao-root obrigatorio");
     if (/^(0|root)(:|$)/.test(s.user ?? "")) add(name, "usuario root proibido");
+    const allow = CAP_ADD_ALLOW[name] ?? [];
+    for (const cap of s.cap_add ?? []) {
+      if (!allow.includes(cap)) add(name, `cap_add ${cap} fora da allowlist`);
+    }
+    for (const opt of s.security_opt ?? []) {
+      if (/unconfined/i.test(opt)) add(name, `security_opt ${opt} proibido`);
+    }
+    for (const t of s.tmpfs ?? []) {
+      if (!/\bnoexec\b/.test(t) || !/\bnosuid\b/.test(t)) add(name, "tmpfs deve ter noexec e nosuid");
+    }
+    if (name === "postgres" && JSON.stringify(Object.keys(s.networks ?? {})) !== '["interna"]') {
+      add(name, "postgres deve estar somente na rede interna");
+    }
     for (const p of s.ports ?? []) {
       if (p.host_ip !== LOOPBACK) add(name, "porta publicada fora de 127.0.0.1");
     }
     for (const vol of s.volumes ?? []) {
-      if (/docker\.sock|^\/(proc|sys|run\/containerd)?$/.test(vol.source ?? "")) add(name, "mount proibido");
+      // Somente volumes nomeados; qualquer bind de caminho do host e proibido (segredos entram por `secrets`).
+      if (vol.type !== "volume") add(name, `mount ${String(vol.type)} proibido (${String(vol.source)})`);
     }
     for (const f of secretFindingsInEnv(s.environment ?? {})) {
       // *_FILE contem so o caminho em /run/secrets: o valor nao e segredo.
@@ -85,6 +120,7 @@ export function verifyRendered(cfg, label) {
       for (const f of secretFindingsInText(String(arg))) add(name, `command: ${f}`);
     }
   }
+  if (cfg.networks?.interna?.internal !== true) add("rede", "interna deve ter internal: true");
   for (const [n, sec] of Object.entries(cfg.secrets ?? {})) {
     if (sec.environment !== undefined || sec.content !== undefined) add(n, "secret deve ser file:, nunca environment/content");
   }
diff --git a/infrastructure/docker/scripts/deploy.sh b/infrastructure/docker/scripts/deploy.sh
index 5389d62..46a2b45 100755
--- a/infrastructure/docker/scripts/deploy.sh
+++ b/infrastructure/docker/scripts/deploy.sh
@@ -4,13 +4,20 @@
 #       deploy.sh <staging|prod> rollback
 #       deploy.sh <staging|prod> status
 # Ambiente exigido: SECRETS_DIR (diretorio 0700 com database_password 0400, dono = UID do servico).
-# Opcionais: API_HOST_PORT, STATE_DIR (padrao .run/deploy), EXTRA_COMPOSE (arquivo extra, SO para ensaio local),
+# Opcionais: API_HOST_PORT, STATE_DIR (padrao .run/deploy), EXTRA_COMPOSE (arquivo extra, SO ensaio local + FND006_ENSAIO=1),
 #            READY_TIMEOUT (s, padrao 120). Nunca imprime segredos.
+# EXTRA_COMPOSE (overlay de ENSAIO local) e proibido em prod e, em staging, exige FND006_ENSAIO=1.
 set -euo pipefail
 DIR="$(cd "$(dirname "$0")/.." && pwd)"
 ROOT="$(cd "$DIR/../.." && pwd)"
 env_name="${1:-}"; cmd="${2:-}"; ref="${3:-}"
 case "$env_name" in staging|prod) ;; *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;; esac
+# Overlay de ensaio nunca entra em producao nem por variavel herdada do shell (REVIEW-002).
+if [ -n "${EXTRA_COMPOSE:-}" ]; then
+  [ "$env_name" != prod ] || { echo "FALHA: EXTRA_COMPOSE e proibido em prod" >&2; exit 2; }
+  [ "${FND006_ENSAIO:-}" = 1 ] || { echo "FALHA: EXTRA_COMPOSE exige FND006_ENSAIO=1 (somente ensaio local)" >&2; exit 2; }
+  echo "AVISO: modo de ensaio local (EXTRA_COMPOSE); sem pull e sem exigir dono do segredo" >&2
+fi
 STATE="${STATE_DIR:-$ROOT/.run/deploy}/$env_name"
 mkdir -p "$STATE"
 files=(-f "$DIR/compose.deploy.yml" -f "$DIR/compose.$env_name.yml")
@@ -26,6 +33,11 @@ verificar_segredos() {
   [ "$dono" = "${API_UID:-10001}" ] || [ -n "${EXTRA_COMPOSE:-}" ] || { echo "FALHA: database_password deve pertencer ao UID do servico" >&2; exit 1; }
 }
 
+travar() { # um deploy/rollback por ambiente por vez (REVIEW-010)
+  exec 9>"$STATE/.lock"
+  flock -n 9 || { echo "FALHA: outro deploy/rollback de $env_name em andamento" >&2; exit 1; }
+}
+
 subir() { # $1 = referencia com digest
   API_IMAGE="$1" docker compose "${files[@]}" up -d --remove-orphans
 }
@@ -39,42 +51,53 @@ aguardar_pronto() {
   return 1
 }
 
+ler() { cat "$STATE/$1" 2>/dev/null || true; }
+
 case "$cmd" in
   deploy)
     [[ "$ref" =~ ^[a-z0-9][a-z0-9./_:-]*@sha256:[0-9a-f]{64}$ ]] || { echo "FALHA: informe a imagem como <repositorio>@sha256:<64 hex> (tag nao e aceita)" >&2; exit 2; }
     verificar_segredos
+    travar
     # 1. configuracao renderizada obedece a politica (digest, hardening, sem segredo)
     node "$DIR/scripts/verificar-deploy.mjs"
     # 2. puxar o digest (ja verificado no CI: build-images/trivy). Assinatura (cosign) ainda nao adotada.
-    if [ -z "${EXTRA_COMPOSE:-}" ]; then docker pull "$ref" >/dev/null; fi
+    if [ -z "${EXTRA_COMPOSE:-}" ]; then docker pull "$ref" >/dev/null || { echo "FALHA: docker pull falhou; estado preservado" >&2; exit 1; }; fi
     # 3. migrar controle: sem migracoes versionadas ainda (DAT-*); o passo falha fechado quando existir e falhar.
     if [ -x "$DIR/scripts/migrar-controle.sh" ]; then "$DIR/scripts/migrar-controle.sh" "$env_name"; else echo "NA: nenhuma migracao de controle versionada ate este ticket"; fi
-    # 4. subir API (postgres antes, saudavel) e 5. verificar readyz
-    [ -f "$STATE/atual" ] && cp "$STATE/atual" "$STATE/anterior"
-    subir "$ref"
-    if aguardar_pronto; then
+    atual_antes="$(ler atual)"; anterior_antes="$(ler anterior)"
+    # `anterior` so muda se a versao em producao difere da nova (redeploy do mesmo digest e idempotente).
+    if [ -n "$atual_antes" ] && [ "$atual_antes" != "$ref" ]; then anterior_novo="$atual_antes"; else anterior_novo="$anterior_antes"; fi
+    # 4. subir Postgres (saudavel) e API e 5. verificar readyz; qualquer falha reverte sem gravar `atual`.
+    if subir "$ref" && aguardar_pronto; then
       echo "$ref" >"$STATE/atual"
+      if [ -n "$anterior_novo" ]; then echo "$anterior_novo" >"$STATE/anterior"; fi
       echo "OK: $env_name em $ref"
     else
-      echo "FALHA: /readyz nao respondeu em ${READY_TIMEOUT:-120}s; rollback automatico" >&2
-      if [ -f "$STATE/anterior" ]; then
-        subir "$(cat "$STATE/anterior")"; aguardar_pronto && echo "rollback concluido para $(cat "$STATE/anterior")" >&2 || echo "ALERTA: rollback tambem falhou" >&2
+      echo "FALHA: subida de $ref ou /readyz falhou; rollback automatico" >&2
+      if [ -n "$atual_antes" ] && [ "$atual_antes" != "$ref" ]; then alvo="$atual_antes"; else alvo="$anterior_antes"; fi
+      if [ -n "$alvo" ]; then
+        if subir "$alvo" && aguardar_pronto; then
+          echo "rollback concluido para $alvo" >&2
+          if [ "$alvo" != "$atual_antes" ]; then echo "$alvo" >"$STATE/atual"; rm -f "$STATE/anterior"; fi
+        else
+          echo "ALERTA: rollback tambem falhou" >&2
+        fi
       else
-        API_IMAGE="$ref" docker compose "${files[@]}" stop api
+        API_IMAGE="$ref" docker compose "${files[@]}" stop api || true
         echo "sem versao anterior: api parada" >&2
       fi
       exit 1
     fi ;;
   rollback)
     verificar_segredos
-    [ -f "$STATE/anterior" ] || { echo "FALHA: nao ha digest anterior registrado em $STATE" >&2; exit 1; }
-    prev="$(cat "$STATE/anterior")"; atual="$(cat "$STATE/atual" 2>/dev/null || true)"
-    subir "$prev"
-    aguardar_pronto || { echo "FALHA: /readyz nao respondeu apos rollback" >&2; exit 1; }
-    echo "$prev" >"$STATE/atual"; [ -n "$atual" ] && echo "$atual" >"$STATE/anterior"
+    travar
+    prev="$(ler anterior)"; atual="$(ler atual)"
+    [ -n "$prev" ] || { echo "FALHA: nao ha digest anterior registrado em $STATE" >&2; exit 1; }
+    subir "$prev" && aguardar_pronto || { echo "FALHA: subida ou /readyz falhou apos rollback" >&2; exit 1; }
+    echo "$prev" >"$STATE/atual"; if [ -n "$atual" ]; then echo "$atual" >"$STATE/anterior"; fi
     echo "OK: rollback de $env_name para $prev" ;;
   status)
-    echo "atual:    $(cat "$STATE/atual" 2>/dev/null || echo '-')"
-    echo "anterior: $(cat "$STATE/anterior" 2>/dev/null || echo '-')" ;;
+    echo "atual:    $(ler atual | grep . || echo '-')"
+    echo "anterior: $(ler anterior | grep . || echo '-')" ;;
   *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;;
 esac
diff --git a/infrastructure/docker/tests/ambientes.test.mjs b/infrastructure/docker/tests/ambientes.test.mjs
index f7d0678..7993642 100644
--- a/infrastructure/docker/tests/ambientes.test.mjs
+++ b/infrastructure/docker/tests/ambientes.test.mjs
@@ -3,14 +3,14 @@
 // (127.0.0.1, containers descartaveis, destruidos ao final). Executar: make test-ambientes
 // Pre-requisitos: Docker, `make build` (apps/api/dist) e as imagens do compose (digest) locais ou puxaveis.
 import assert from "node:assert/strict";
-import { execFileSync, spawnSync } from "node:child_process";
-import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { execFileSync, spawn, spawnSync } from "node:child_process";
+import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
 import { randomBytes } from "node:crypto";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { after, before, describe, test } from "node:test";
 import { fileURLToPath } from "node:url";
-import { envListToObject, secretFindingsInEnv, secretFindingsInText, verifyRendered } from "../scripts/deploy-lib.mjs";
+import { envListToObject, isSecretName, secretFindingsInEnv, secretFindingsInText, verifyRendered } from "../scripts/deploy-lib.mjs";
 
 const docker = join(dirname(fileURLToPath(import.meta.url)), "..");
 const root = join(docker, "..", "..");
@@ -34,7 +34,11 @@ describe("verificador de overlays", () => {
       },
     },
   };
-  const bad = (patch) => verifyRendered({ services: { api: { ...ok.services.api, ...patch } } }, "t");
+  const interna = { interna: { internal: true } };
+  const bad = (patch, extra = {}) =>
+    verifyRendered({ networks: interna, services: { api: { ...ok.services.api, ...patch } }, ...extra }, "t");
+  const pg = (patch) =>
+    verifyRendered({ networks: interna, services: { postgres: { ...ok.services.api, networks: { interna: null }, ...patch } } }, "t");
   test("configuracao correta passa", () => assert.deepEqual(bad({}), []));
   test("cada regra e violada separadamente", () => {
     assert.match(bad({ image: "r/a:latest" }).join(), /sem digest/);
@@ -48,6 +52,33 @@ describe("verificador de overlays", () => {
     assert.match(bad({ mem_limit: undefined }).join(), /limites/);
     assert.match(bad({ restart: "always" }).join(), /unless-stopped/);
   });
+  test("regras de hardening adicionais (REVIEW-005), uma por regra", () => {
+    assert.match(bad({ cap_add: ["SYS_ADMIN"] }).join(), /cap_add SYS_ADMIN fora da allowlist/);
+    assert.deepEqual(pg({ cap_add: ["CHOWN", "SETUID"] }), []);
+    assert.match(pg({ cap_add: ["CHOWN", "SYS_ADMIN"] }).join(), /SYS_ADMIN/);
+    assert.match(bad({}, { networks: { interna: { internal: false } } }).join(), /internal: true/);
+    assert.match(bad({}, { networks: {} }).join(), /internal: true/);
+    assert.match(pg({ networks: { interna: null, publicada: null } }).join(), /somente na rede interna/);
+    assert.match(bad({ tmpfs: ["/tmp:rw,size=1m"] }).join(), /noexec e nosuid/);
+    assert.match(bad({ tmpfs: ["/tmp:rw,noexec,size=1m"] }).join(), /noexec e nosuid/);
+    assert.deepEqual(bad({ tmpfs: ["/tmp:rw,noexec,nosuid,size=1m"] }), []);
+    assert.match(bad({ security_opt: ["no-new-privileges:true", "seccomp=unconfined"] }).join(), /unconfined/);
+    assert.match(bad({ security_opt: ["no-new-privileges:true", "apparmor=unconfined"] }).join(), /unconfined/);
+    for (const source of ["/etc", "/var/run", "/home/x", "/var/run/docker.sock"]) {
+      assert.match(bad({ volumes: [{ type: "bind", source }] }).join(), /mount bind proibido/);
+    }
+    assert.deepEqual(bad({ volumes: [{ type: "volume", source: "postgres-data" }] }), []);
+  });
+  test("nomes de segredo por token no ambiente e no texto (REVIEW-004)", () => {
+    for (const n of ["DB_PASS", "SECRET_KEY", "JWT_SECRET_KEY", "AWS_SECRET_ACCESS_KEY", "ACCESS_KEY", "API_TOKEN", "DBPASSWORD"]) {
+      assert.ok(isSecretName(n), n);
+      assert.match(bad({ environment: { [n]: "hunter2" } }).join(), /nome de segredo/, n);
+    }
+    for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "KEYBOARD", "PASSTHROUGH"]) assert.ok(!isSecretName(n), n);
+    assert.equal(secretFindingsInText("      DB_PASS: hunter2\n").length, 1);
+    assert.equal(secretFindingsInText("      JWT_SECRET_KEY: abc\n").length, 1);
+    assert.equal(secretFindingsInText("      DB_PASS: ${DB_PASS:?}\n").length, 0);
+  });
   test("texto de compose com segredo literal e detectado; *_FILE e ${} nao", () => {
     assert.equal(secretFindingsInText("POSTGRES_PASSWORD: abc12345678\n").length, 1);
     assert.equal(secretFindingsInText("POSTGRES_PASSWORD_FILE: /run/secrets/x\nA_TOKEN: ${TOKEN:?}\n").length, 0);
@@ -89,7 +120,7 @@ describe("staging efemero em 127.0.0.1 (AC-2, AC-3)", { skip: !dockerOk() }, ()
   const env = {
     ...process.env, SECRETS_DIR: secrets, STATE_DIR: state, API_HOST_PORT: PORT, READY_TIMEOUT: "90",
     EXTRA_COMPOSE: join(docker, "tests", "ensaio.override.yml"), ENSAIO_UID: String(process.getuid()), ENSAIO_GID: String(process.getgid()),
-    API_UID: String(process.getuid()),
+    API_UID: String(process.getuid()), FND006_ENSAIO: "1",
   };
   const deploy = (...a) => sh(join(docker, "scripts", "deploy.sh"), ["staging", ...a], { env });
   const compose = (...a) => sh("docker", ["compose", "-p", PROJECT, "-f", join(docker, "compose.deploy.yml"), "-f", join(docker, "compose.staging.yml"),
@@ -168,23 +199,81 @@ describe("staging efemero em 127.0.0.1 (AC-2, AC-3)", { skip: !dockerOk() }, ()
     } finally { sh("docker", ["rm", "-f", id]); }
   });
 
-  test("deploy do digest B e rollback manual para A", () => {
+  const imagem = () => out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim();
+  const estado = () => deploy("status").stdout;
+  const pronto = () => sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status === 0;
+  const DESCONHECIDA = `registry.invalid/nucleos/nao-existe@sha256:${"0".repeat(64)}`;
+
+  test("deploy B, redeploy de B (idempotente) e rollback volta a A (REVIEW-001)", () => {
     assert.equal(deploy("deploy", NODE22).status, 0);
-    assert.match(deploy("status").stdout, new RegExp(`atual:\\s+${NODE22.replace(/[.]/g, "\\.")}`));
-    const imgB = out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim();
-    assert.equal(imgB, NODE22);
+    assert.equal(imagem(), NODE22);
+    assert.equal(deploy("deploy", NODE22).status, 0); // retentativa de pipeline
+    assert.match(estado(), new RegExp(`anterior: ${NODE24.replace(/[.]/g, "\\.")}`));
     const r = deploy("rollback");
     assert.equal(r.status, 0, r.stdout + r.stderr);
-    assert.equal(out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim(), NODE24);
-    assert.equal(sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status, 0);
+    assert.equal(imagem(), NODE24);
+    assert.ok(pronto());
+    assert.match(estado(), new RegExp(`atual:\\s+${NODE24.replace(/[.]/g, "\\.")}`));
   });
 
-  test("deploy defeituoso reverte automaticamente para a versao anterior", () => {
+  test("deploy defeituoso (readyz nunca responde) reverte e preserva o estado", () => {
+    const antes = estado();
     const r = sh(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", PY], { env: { ...env, READY_TIMEOUT: "8" } });
     assert.equal(r.status, 1);
-    assert.match(r.stderr, /rollback/);
-    assert.equal(out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim(), NODE24);
-    assert.equal(sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status, 0);
+    assert.match(r.stderr, /rollback concluido/);
+    assert.equal(imagem(), NODE24);
+    assert.ok(pronto());
+    assert.equal(estado(), antes);
+  });
+
+  test("falha em `compose up` (imagem inexistente) aciona rollback e preserva atual/anterior (REVIEW-010)", () => {
+    const antes = estado();
+    const r = deploy("deploy", DESCONHECIDA);
+    assert.equal(r.status, 1);
+    assert.match(r.stderr, /rollback concluido/);
+    assert.equal(imagem(), NODE24);
+    assert.ok(pronto());
+    assert.equal(estado(), antes);
+  });
+
+  test("segunda execucao concorrente e recusada (flock)", async () => {
+    const primeiro = spawn(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", NODE22], { env, stdio: "ignore" });
+    const fim = new Promise((res) => primeiro.on("close", res));
+    await new Promise((res) => setTimeout(res, 1500));
+    const r = deploy("deploy", NODE24);
+    assert.equal(r.status, 1);
+    assert.match(r.stderr, /em andamento/);
+    assert.equal(await fim, 0);
+    assert.equal(deploy("rollback").status, 0); // volta a A para os demais testes
+    assert.equal(imagem(), NODE24);
+  });
+});
+
+// ------------------------------------------- EXTRA_COMPOSE nunca em producao (REVIEW-002), sem Docker
+describe("EXTRA_COMPOSE e restrito ao ensaio", () => {
+  const stubDir = mkdtempSync(join(tmpdir(), "fnd006-stub-"));
+  const marker = join(stubDir, "docker-chamado");
+  writeFileSync(join(stubDir, "docker"), `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, { mode: 0o755 });
+  after(() => rmSync(stubDir, { recursive: true, force: true }));
+  const run = (envName, extra) => {
+    rmSync(marker, { force: true });
+    const r = sh(join(docker, "scripts", "deploy.sh"), [envName, "deploy", `r/a@sha256:${"a".repeat(64)}`], {
+      env: { PATH: `${stubDir}:/usr/bin:/bin`, SECRETS_DIR: stubDir, EXTRA_COMPOSE: "/tmp/x.yml", ...extra },
+    });
+    assert.ok(!existsSync(marker), "docker nao deve ser chamado");
+    return r;
+  };
+  test("prod recusa EXTRA_COMPOSE, mesmo com FND006_ENSAIO=1", () => {
+    for (const extra of [{}, { FND006_ENSAIO: "1" }]) {
+      const r = run("prod", extra);
+      assert.equal(r.status, 2);
+      assert.match(r.stderr, /proibido em prod/);
+    }
+  });
+  test("staging exige FND006_ENSAIO=1", () => {
+    const r = run("staging", {});
+    assert.equal(r.status, 2);
+    assert.match(r.stderr, /FND006_ENSAIO=1/);
   });
 });
 
diff --git a/packages/config-py/src/nucleos_config/__init__.py b/packages/config-py/src/nucleos_config/__init__.py
index d7946e4..2b150bb 100644
--- a/packages/config-py/src/nucleos_config/__init__.py
+++ b/packages/config-py/src/nucleos_config/__init__.py
@@ -1,5 +1,12 @@
 from .secret import MAX_SECRET_BYTES, Secret, SecretFileError, read_secret_file
-from .settings import ConfigError, ConfigIssue, ServiceSettings, forbidden_secret_env, load_settings
+from .settings import (
+    ConfigError,
+    ConfigIssue,
+    ServiceSettings,
+    forbidden_secret_env,
+    is_secret_name,
+    load_settings,
+)
 
 __all__ = [
     "MAX_SECRET_BYTES",
@@ -9,6 +16,7 @@ __all__ = [
     "SecretFileError",
     "ServiceSettings",
     "forbidden_secret_env",
+    "is_secret_name",
     "load_settings",
     "read_secret_file",
 ]
diff --git a/packages/config-py/src/nucleos_config/secret.py b/packages/config-py/src/nucleos_config/secret.py
index ea58c9c..5ffaee8 100644
--- a/packages/config-py/src/nucleos_config/secret.py
+++ b/packages/config-py/src/nucleos_config/secret.py
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import errno
 import os
 import stat
 
@@ -36,30 +37,49 @@ class Secret:
 def read_secret_file(path: str) -> Secret:
     """Le o segredo com as mesmas regras da biblioteca TypeScript.
 
-    Arquivo regular (sem link simbolico), sem permissoes para grupo/outros (0o077), do mesmo dono
-    do processo, nao vazio e com tamanho limitado. Remove um unico `\\n` final.
+    Abre com `O_NOFOLLOW` e confere tudo por `fstat` no descritor aberto (sem janela entre checagem
+    e leitura): arquivo regular, sem permissoes para grupo/outros (0o077), do mesmo dono do
+    processo, nao vazio, no maximo `MAX_SECRET_BYTES` (leitura limitada a esse tamanho + 1) e
+    UTF-8 valido. Remove um unico `\\n` final.
     """
     try:
-        st = os.lstat(path)
-    except OSError:
-        raise SecretFileError("ausente") from None
-    if stat.S_ISLNK(st.st_mode):
-        raise SecretFileError("link-simbolico")
-    if not stat.S_ISREG(st.st_mode):
-        raise SecretFileError("nao-e-arquivo-regular")
-    if st.st_mode & 0o077:
-        raise SecretFileError("permissoes-abertas")
-    if st.st_uid != os.getuid():
-        raise SecretFileError("dono-diferente")
-    if st.st_size == 0:
-        raise SecretFileError("vazio")
-    if st.st_size > MAX_SECRET_BYTES:
-        raise SecretFileError("grande-demais")
+        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
+    except OSError as exc:
+        if exc.errno == errno.ELOOP:
+            raise SecretFileError("link-simbolico") from None
+        if exc.errno in (errno.ENOENT, errno.ENOTDIR):
+            raise SecretFileError("ausente") from None
+        raise SecretFileError("ilegivel") from None
+    try:
+        st = os.fstat(fd)
+        if not stat.S_ISREG(st.st_mode):
+            raise SecretFileError("nao-e-arquivo-regular")
+        if st.st_mode & 0o077:
+            raise SecretFileError("permissoes-abertas")
+        if st.st_uid != os.getuid():
+            raise SecretFileError("dono-diferente")
+        if st.st_size == 0:
+            raise SecretFileError("vazio")
+        if st.st_size > MAX_SECRET_BYTES:
+            raise SecretFileError("grande-demais")
+        chunks: list[bytes] = []
+        total = 0
+        try:
+            while True:
+                chunk = os.read(fd, MAX_SECRET_BYTES + 1 - total)
+                if not chunk:
+                    break
+                chunks.append(chunk)
+                total += len(chunk)
+                if total > MAX_SECRET_BYTES:
+                    raise SecretFileError("grande-demais")
+        except OSError:
+            raise SecretFileError("ilegivel") from None
+    finally:
+        os.close(fd)
     try:
-        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
-        with os.fdopen(fd, "r", encoding="utf-8") as fh:
-            raw = fh.read()
-    except (OSError, UnicodeDecodeError):
+        raw = b"".join(chunks).decode("utf-8")
+    except UnicodeDecodeError:
         raise SecretFileError("ilegivel") from None
     value = raw.removesuffix("\n")
     if not value:
diff --git a/packages/config-py/src/nucleos_config/settings.py b/packages/config-py/src/nucleos_config/settings.py
index ea6317e..802b31a 100644
--- a/packages/config-py/src/nucleos_config/settings.py
+++ b/packages/config-py/src/nucleos_config/settings.py
@@ -5,6 +5,7 @@ from __future__ import annotations
 import re
 from collections.abc import Mapping
 from typing import Annotated, Literal
+from urllib.parse import parse_qsl
 
 from pydantic import AfterValidator, AnyUrl, BaseModel, Field, ValidationError, field_validator
 from pydantic_settings import (
@@ -15,9 +16,27 @@ from pydantic_settings import (
 
 from .secret import Secret, SecretFileError, read_secret_file
 
-_SECRET_NAME = re.compile(
-    r"(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$", re.I
+_SECRET_TOKENS = frozenset(
+    {"PASS", "PASSWORD", "PASSWD", "PWD", "SECRET", "TOKEN", "KEY", "APIKEY", "CREDENTIAL"}
+    | {"CREDENTIALS", "DSN"}
 )
+_SECRET_SUFFIXES = (
+    "PASSWORD",
+    "PASSWD",
+    "SECRET",
+    "TOKEN",
+    "APIKEY",
+    "PRIVATEKEY",
+    "CREDENTIAL",
+    "CREDENTIALS",
+)
+_SECRET_QUERY = frozenset(
+    {"password", "sslpassword", "passfile", "pass", "passwd", "pwd", "token", "apikey"}
+    | {"api_key", "secret", "credential", "credentials"}
+)
+# Variaveis POSIX/shell que nao carregam segredo e colidem com os tokens.
+_NOT_SECRET = frozenset({"PWD", "OLDPWD"})
+_DB_SCHEMES = ("postgres", "postgresql")
 _UNITS_MS = {"ms": 1, "s": 1000, "m": 60_000, "h": 3_600_000}
 _STRICT = ("staging", "production")
 
@@ -36,14 +55,36 @@ class ConfigError(Exception):
         super().__init__(f"configuracao invalida ({len(issues)}): {detail}")
 
 
+def is_secret_name(name: str) -> bool:
+    """Nome que indica segredo literal: token (PASS, SECRET, TOKEN, KEY, DSN...) ou sufixo colado.
+
+    Nomes terminados em `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de
+    packages/config (TypeScript) e deploy-lib.mjs.
+    """
+    up = re.sub(r"[.-]", "_", name.upper())
+    if up in _NOT_SECRET:
+        return False
+    if up.endswith(("_FILE", "_PATH")):
+        return False
+    if any(t in _SECRET_TOKENS for t in up.split("_")):
+        return True
+    return up.replace("_", "").endswith(_SECRET_SUFFIXES)
+
+
 def forbidden_secret_env(env: Mapping[str, str]) -> list[str]:
     """Nomes de variaveis que parecem carregar segredo literal (so `*_FILE` e permitido)."""
-    return sorted(k for k, v in env.items() if v != "" and _SECRET_NAME.search(k))
+    return sorted(k for k, v in env.items() if v != "" and is_secret_name(k))
 
 
 def _no_password(url: AnyUrl) -> AnyUrl:
+    if url.scheme not in _DB_SCHEMES:
+        raise ValueError("protocolo nao permitido")
     if url.password:
         raise ValueError("senha embutida na url e proibida (use *_FILE)")
+    if any(
+        k.lower() in _SECRET_QUERY for k, _ in parse_qsl(url.query or "", keep_blank_values=True)
+    ):
+        raise ValueError("credencial na query da url e proibida (use *_FILE)")
     return url
 
 
@@ -84,6 +125,14 @@ class ServiceSettings(BaseSettings):
         # Somente o mapa explicito: nao le os.environ, .env nem /run/secrets por acidente.
         return (init_settings,)
 
+    @field_validator("PORT", mode="before")
+    @classmethod
+    def _port_text(cls, v: object) -> object:
+        # Texto do ambiente so no formato canonico (paridade com o TS: ^\\d{1,5}$); o padrao e int.
+        if isinstance(v, str) and not re.fullmatch(r"\d{1,5}", v):
+            raise ValueError("porta invalida")
+        return v
+
     @field_validator("REQUEST_TIMEOUT", mode="before")
     @classmethod
     def _duration(cls, v: object) -> int:
diff --git a/packages/config-py/tests/test_config.py b/packages/config-py/tests/test_config.py
index 1341543..4a7ab2c 100644
--- a/packages/config-py/tests/test_config.py
+++ b/packages/config-py/tests/test_config.py
@@ -1,15 +1,20 @@
+import json
 import os
 import stat
 from pathlib import Path
 
 import pytest
 from nucleos_config import (
+    MAX_SECRET_BYTES,
     ConfigError,
     SecretFileError,
+    ServiceSettings,
     forbidden_secret_env,
+    is_secret_name,
     load_settings,
     read_secret_file,
 )
+from pydantic import ValidationError
 
 SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a"
 
@@ -127,3 +132,96 @@ def test_unreadable_secret_file_reports_without_path(tmp_path: Path) -> None:
         load_settings({"DATABASE_PASSWORD_FILE": secret_file(tmp_path, mode=0o666)})
     assert keys(ei.value) == ["DATABASE_PASSWORD_FILE"]
     assert str(tmp_path) not in str(ei.value)
+
+
+# ------------------------------------------------ REVIEW-003/004/006/007/009
+def test_other_owner_is_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
+    path = secret_file(tmp_path)
+    real = os.getuid()
+    monkeypatch.setattr(os, "getuid", lambda: real + 1)
+    with pytest.raises(SecretFileError) as ei:
+        read_secret_file(path)
+    assert ei.value.reason == "dono-diferente"
+
+
+def test_size_boundary(tmp_path: Path) -> None:
+    at = tmp_path / "no-limite"
+    at.write_text("a" * MAX_SECRET_BYTES)
+    at.chmod(0o400)
+    assert len(read_secret_file(str(at)).reveal()) == MAX_SECRET_BYTES
+    over = tmp_path / "acima"
+    over.write_text("a" * (MAX_SECRET_BYTES + 1))
+    over.chmod(0o400)
+    with pytest.raises(SecretFileError) as ei:
+        read_secret_file(str(over))
+    assert ei.value.reason == "grande-demais"
+
+
+def test_invalid_utf8_is_unreadable(tmp_path: Path) -> None:
+    p = tmp_path / "bin"
+    p.write_bytes(bytes([0x61, 0xFF, 0xFE, 0x62]))
+    p.chmod(0o400)
+    with pytest.raises(SecretFileError) as ei:
+        read_secret_file(str(p))
+    assert ei.value.reason == "ilegivel"
+
+
+@pytest.mark.parametrize(
+    "name",
+    [
+        "API_TOKEN",
+        "X_SECRET",
+        "DB_PASS",
+        "SECRET_KEY",
+        "AWS_SECRET_ACCESS_KEY",
+        "DBPASSWORD",
+        "A_DSN",
+    ],
+)
+def test_secret_names(name: str) -> None:
+    assert is_secret_name(name)
+
+
+@pytest.mark.parametrize(
+    "name",
+    [
+        "DATABASE_PASSWORD_FILE",
+        "SSH_KEY_PATH",
+        "OTEL_SERVICE_NAME",
+        "KEYBOARD",
+        "PORT",
+        "PASSTHROUGH",
+    ],
+)
+def test_non_secret_names(name: str) -> None:
+    assert not is_secret_name(name)
+
+
+def test_pydantic_errors_hide_input() -> None:
+    # Mutante: hide_input_in_errors removido. O erro cru do pydantic nao pode ecoar o valor.
+    with pytest.raises(ValidationError) as ei:
+        ServiceSettings.model_validate({"APP_ENV": f"x{SENTINEL}", "PORT": f"1{SENTINEL}"})
+    assert SENTINEL not in str(ei.value)
+    assert SENTINEL not in repr(ei.value)
+
+
+def test_shared_parity_table() -> None:
+    table = json.loads((Path(__file__).parents[2] / "config" / "paridade-casos.json").read_text())
+    assert len(table["casos"]) > 40
+    for case in table["casos"]:
+        message = ""
+        try:
+            load_settings(case["env"])
+        except ConfigError as exc:
+            message = str(exc)
+            accepted = False
+        else:
+            accepted = True
+        assert "SENT" not in message, case["caso"]
+        assert accepted == case["aceita"], case["caso"]
+
+
+def test_shell_pwd_is_not_a_secret() -> None:
+    assert not is_secret_name("PWD")
+    assert not is_secret_name("OLDPWD")
+    assert is_secret_name("X_PWD")
diff --git a/packages/config/paridade-casos.json b/packages/config/paridade-casos.json
new file mode 100644
index 0000000..405fbdd
--- /dev/null
+++ b/packages/config/paridade-casos.json
@@ -0,0 +1,311 @@
+{
+ "descricao": "Tabela unica de casos (env => aceita/recusa) consumida por packages/config e packages/config-py (REVIEW-003)",
+ "casos": [
+  {
+   "caso": "vazio usa padroes",
+   "env": {},
+   "aceita": true
+  },
+  {
+   "caso": "porta minima",
+   "env": {
+    "PORT": "1"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "porta maxima",
+   "env": {
+    "PORT": "65535"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "porta comum",
+   "env": {
+    "PORT": "8080"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "porta zero",
+   "env": {
+    "PORT": "0"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta acima do limite",
+   "env": {
+    "PORT": "65536"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta com espacos",
+   "env": {
+    "PORT": " 80 "
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta com sinal",
+   "env": {
+    "PORT": "+80"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta com underscore",
+   "env": {
+    "PORT": "1_000"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta decimal",
+   "env": {
+    "PORT": "80.0"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "porta texto",
+   "env": {
+    "PORT": "abc"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "duracao em segundos",
+   "env": {
+    "REQUEST_TIMEOUT": "30s"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "duracao sem unidade",
+   "env": {
+    "REQUEST_TIMEOUT": "30"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "duracao abaixo do minimo",
+   "env": {
+    "REQUEST_TIMEOUT": "1ms"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url postgres",
+   "env": {
+    "DATABASE_URL": "postgres://u@h:5432/db"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "url postgresql",
+   "env": {
+    "DATABASE_URL": "postgresql://u@h/db"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "url com sslmode",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?sslmode=require"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "url http",
+   "env": {
+    "DATABASE_URL": "http://h/db"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url ftp",
+   "env": {
+    "DATABASE_URL": "ftp://h/x"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com senha",
+   "env": {
+    "DATABASE_URL": "postgres://u:p@h/db"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com password na query",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?password=SENT"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com sslPassword na query",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?sslPassword=SENT"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com passfile na query",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?passfile=/x"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com token na query",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?sslmode=require&token=SENT"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url com apikey na query",
+   "env": {
+    "DATABASE_URL": "postgres://u@h/db?apikey=SENT"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "url invalida",
+   "env": {
+    "DATABASE_URL": "nao e url"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "APP_ENV desconhecido",
+   "env": {
+    "APP_ENV": "prod"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "staging sem banco",
+   "env": {
+    "APP_ENV": "staging"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo DB_PASS",
+   "env": {
+    "DB_PASS": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo SECRET_KEY",
+   "env": {
+    "SECRET_KEY": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo JWT_SECRET_KEY",
+   "env": {
+    "JWT_SECRET_KEY": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo AWS_SECRET_ACCESS_KEY",
+   "env": {
+    "AWS_SECRET_ACCESS_KEY": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo ACCESS_KEY",
+   "env": {
+    "ACCESS_KEY": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo API_TOKEN",
+   "env": {
+    "API_TOKEN": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo DB_PASSWORD",
+   "env": {
+    "DB_PASSWORD": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo STRIPE_SECRET",
+   "env": {
+    "STRIPE_SECRET": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo DB_DSN",
+   "env": {
+    "DB_DSN": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo DBPASSWORD",
+   "env": {
+    "DBPASSWORD": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo API_KEY",
+   "env": {
+    "API_KEY": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome de segredo X_PWD",
+   "env": {
+    "X_PWD": "valor"
+   },
+   "aceita": false
+  },
+  {
+   "caso": "nome legitimo SSH_KEY_PATH",
+   "env": {
+    "SSH_KEY_PATH": "x"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "nome legitimo OTEL_SERVICE_NAME",
+   "env": {
+    "OTEL_SERVICE_NAME": "x"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "nome legitimo KEYBOARD",
+   "env": {
+    "KEYBOARD": "x"
+   },
+   "aceita": true
+  },
+  {
+   "caso": "nome legitimo TOKENIZER_MODE",
+   "env": {
+    "TOKENIZER_MODE": "x"
+   },
+   "aceita": true
+  }
+ ]
+}
\ No newline at end of file
diff --git a/packages/config/src/config.test.ts b/packages/config/src/config.test.ts
index 080c585..a9a7022 100644
--- a/packages/config/src/config.test.ts
+++ b/packages/config/src/config.test.ts
@@ -1,9 +1,18 @@
 import assert from "node:assert/strict";
-import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
+import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
-import { test } from "node:test";
-import { ConfigError, Secret, forbiddenSecretEnv, loadApiConfig, readSecretFile } from "./index.js";
+import { mock, test } from "node:test";
+import {
+  ConfigError,
+  MAX_SECRET_BYTES,
+  Secret,
+  SecretFileError,
+  forbiddenSecretEnv,
+  isSecretName,
+  loadApiConfig,
+  readSecretFile,
+} from "./index.js";
 
 const SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a";
 
@@ -138,3 +147,69 @@ test("Secret nunca se serializa", () => {
     assert.equal(s.reveal(), SENTINEL);
   });
 });
+
+// ---------------------------------------------------------------- REVIEW-003/004/006/007/009
+test("dono diferente do processo e recusado (mutante: checagem de dono removida)", () => {
+  withDir((dir) => {
+    const p = secretFile(dir);
+    const real = process.getuid?.() ?? 0;
+    const m = mock.method(process as { getuid: () => number }, "getuid", () => real + 1);
+    try {
+      assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "dono-diferente");
+    } finally {
+      m.mock.restore();
+    }
+  });
+});
+
+test("limite exato de tamanho aceito; um byte a mais recusado", () => {
+  withDir((dir) => {
+    const at = join(dir, "no-limite");
+    writeFileSync(at, "a".repeat(MAX_SECRET_BYTES), { mode: 0o400 });
+    assert.equal(readSecretFile(at).reveal().length, MAX_SECRET_BYTES);
+    const over = join(dir, "acima");
+    writeFileSync(over, "a".repeat(MAX_SECRET_BYTES + 1), { mode: 0o400 });
+    assert.throws(() => readSecretFile(over), (e: unknown) => e instanceof SecretFileError && e.reason === "grande-demais");
+  });
+});
+
+test("arquivo com bytes UTF-8 invalidos e ilegivel (paridade com Python)", () => {
+  withDir((dir) => {
+    const p = join(dir, "bin");
+    writeFileSync(p, Buffer.from([0x61, 0xff, 0xfe, 0x62]), { mode: 0o400 });
+    assert.throws(() => readSecretFile(p), (e: unknown) => e instanceof SecretFileError && e.reason === "ilegivel");
+  });
+});
+
+test("nomes de segredo por token e sufixo; *_FILE e *_PATH permitidos", () => {
+  for (const n of ["API_TOKEN", "X_SECRET", "DB_PASS", "SECRET_KEY", "AWS_SECRET_ACCESS_KEY", "DBPASSWORD", "A_DSN"]) {
+    assert.ok(isSecretName(n), n);
+  }
+  for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "OTEL_SERVICE_NAME", "KEYBOARD", "PORT", "PASSTHROUGH"]) {
+    assert.ok(!isSecretName(n), n);
+  }
+});
+
+test("tabela de paridade compartilhada com config-py", () => {
+  const url = new URL("../paridade-casos.json", import.meta.url);
+  const { casos } = JSON.parse(readFileSync(url, "utf8")) as {
+    casos: { caso: string; env: Record<string, string>; aceita: boolean }[];
+  };
+  assert.ok(casos.length > 40);
+  for (const c of casos) {
+    let aceitou = true;
+    try {
+      loadApiConfig(c.env);
+    } catch (e) {
+      assert.ok(e instanceof ConfigError, c.caso);
+      aceitou = false;
+      assert.ok(!e.message.includes("SENT"), `${c.caso}: vazou`);
+    }
+    assert.equal(aceitou, c.aceita, c.caso);
+  }
+});
+
+test("PWD e OLDPWD do shell nao sao tratados como segredo", () => {
+  assert.ok(!isSecretName("PWD") && !isSecretName("OLDPWD") && isSecretName("X_PWD"));
+  assert.deepEqual(forbiddenSecretEnv({ PWD: "/home/x", OLDPWD: "/", DB_PWD: "x" }), ["DB_PWD"]);
+});
diff --git a/packages/config/src/index.ts b/packages/config/src/index.ts
index 012e80c..73e9572 100644
--- a/packages/config/src/index.ts
+++ b/packages/config/src/index.ts
@@ -1,4 +1,5 @@
-export { ConfigError, type ConfigIssue, forbiddenSecretEnv, loadSecret, parseConfig } from "./load.js";
+export { ConfigError, type ConfigIssue, forbiddenSecretEnv,
+  isSecretName, loadSecret, parseConfig } from "./load.js";
 export { APP_ENVS, type ApiConfig, type AppEnv, loadApiConfig } from "./api.js";
 export {
   absolutePathSchema,
diff --git a/packages/config/src/load.ts b/packages/config/src/load.ts
index afad7e0..6d990aa 100644
--- a/packages/config/src/load.ts
+++ b/packages/config/src/load.ts
@@ -23,16 +23,51 @@ export class ConfigError extends Error {
   }
 }
 
+const SECRET_TOKENS = new Set([
+  "PASS",
+  "PASSWORD",
+  "PASSWD",
+  "PWD",
+  "SECRET",
+  "TOKEN",
+  "KEY",
+  "APIKEY",
+  "CREDENTIAL",
+  "CREDENTIALS",
+  "DSN",
+]);
+const SECRET_SUFFIXES = [
+  "PASSWORD",
+  "PASSWD",
+  "SECRET",
+  "TOKEN",
+  "APIKEY",
+  "PRIVATEKEY",
+  "CREDENTIAL",
+  "CREDENTIALS",
+];
+
 /**
- * Nomes que indicam segredo passado diretamente por ambiente (proibido pelo ADR-020 item 1).
- * Variaveis terminadas em `_FILE` (caminho) sao o formato permitido.
+ * Nome de variavel que indica segredo literal (ADR-020 item 1): algum token separado por `_`
+ * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
+ * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de config-py e deploy-lib.mjs.
  */
-const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$/i;
+/** Variaveis POSIX/shell que nao carregam segredo e colidem com os tokens. */
+const NOT_SECRET = new Set(["PWD", "OLDPWD"]);
+
+export function isSecretName(name: string): boolean {
+  const up = name.toUpperCase().replace(/[.-]/g, "_");
+  if (NOT_SECRET.has(up)) return false;
+  if (/_(FILE|PATH)$/.test(up)) return false;
+  if (up.split("_").some((t) => SECRET_TOKENS.has(t))) return true;
+  const compact = up.replaceAll("_", "");
+  return SECRET_SUFFIXES.some((suf) => compact.endsWith(suf));
+}
 
 /** Devolve as variaveis do ambiente cujo NOME parece carregar um segredo literal. */
 export function forbiddenSecretEnv(env: Readonly<Record<string, string | undefined>>): string[] {
   return Object.entries(env)
-    .filter(([k, v]) => v !== undefined && v !== "" && SECRET_NAME.test(k))
+    .filter(([k, v]) => v !== undefined && v !== "" && isSecretName(k))
     .map(([k]) => k)
     .sort();
 }
diff --git a/packages/config/src/primitives.ts b/packages/config/src/primitives.ts
index 82074c0..60c4ac5 100644
--- a/packages/config/src/primitives.ts
+++ b/packages/config/src/primitives.ts
@@ -1,5 +1,12 @@
 import { z } from "zod";
 
+const SECRET_QUERY = new Set(["password", "sslpassword", "passfile", "pass", "passwd", "pwd", "token", "apikey", "api_key", "secret", "credential", "credentials"]);
+
+/** Parametro de query que carrega (ou aponta para) credencial: recusado em DATABASE_URL e similares. */
+function isSecretQueryParam(name: string): boolean {
+  return SECRET_QUERY.has(name.toLowerCase());
+}
+
 /** Porta TCP valida (1-65535), a partir de texto de variavel de ambiente. */
 export const portSchema = z
   .string()
@@ -42,12 +49,27 @@ export function serviceUrl(protocols: readonly string[]): z.ZodType<string, stri
   return z
     .string()
     .max(2048)
-    .refine((v) => URL.canParse(v), "url invalida")
-    .refine((v) => {
+    .superRefine((v, ctx) => {
+      // Uma unica passada com retorno antecipado: refinamentos encadeados continuariam rodando
+      // com URL invalida e `new URL` lancaria uma excecao que nao e ZodError.
+      if (!URL.canParse(v)) {
+        ctx.addIssue({ code: "custom", message: "url invalida" });
+        return;
+      }
       const u = new URL(v);
-      return protocols.includes(u.protocol.replace(/:$/, ""));
-    }, "protocolo nao permitido")
-    .refine((v) => new URL(v).password === "", "senha embutida na url e proibida (use *_FILE)");
+      if (!protocols.includes(u.protocol.replace(/:$/, ""))) {
+        ctx.addIssue({ code: "custom", message: "protocolo nao permitido" });
+        return;
+      }
+      if (u.password !== "") {
+        ctx.addIssue({ code: "custom", message: "senha embutida na url e proibida (use *_FILE)" });
+        return;
+      }
+      if ([...u.searchParams.keys()].some(isSecretQueryParam)) {
+        ctx.addIssue({ code: "custom", message: "credencial na query da url e proibida (use *_FILE)" });
+        return;
+      }
+    });
 }
 
 /** Caminho absoluto de arquivo (sem NUL nem `..`), para variaveis `*_FILE`. */
diff --git a/packages/config/src/secret.ts b/packages/config/src/secret.ts
index 290d720..8a955ab 100644
--- a/packages/config/src/secret.ts
+++ b/packages/config/src/secret.ts
@@ -1,4 +1,4 @@
-import { constants, lstatSync, readFileSync } from "node:fs";
+import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
 
 /** Tamanho maximo aceito para um arquivo de segredo (evita ler arquivo arbitrario grande). */
 export const MAX_SECRET_BYTES = 16 * 1024;
@@ -49,34 +49,62 @@ export type SecretFileReason =
   | "grande-demais"
   | "ilegivel";
 
+function openNoFollow(path: string): number {
+  try {
+    // O_NOFOLLOW: link simbolico no ultimo componente => ELOOP. O_NONBLOCK: nao trava em FIFO.
+    // (o Node ja abre com close-on-exec)
+    return openSync(
+      path,
+      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
+    );
+  } catch (e) {
+    const code = (e as NodeJS.ErrnoException).code;
+    if (code === "ELOOP") throw new SecretFileError("link-simbolico");
+    if (code === "ENOENT" || code === "ENOTDIR") throw new SecretFileError("ausente");
+    throw new SecretFileError("ilegivel");
+  }
+}
+
 /**
- * Le um segredo de arquivo com checagens (ADR-020, item 1): arquivo regular (sem link simbolico),
- * sem nenhuma permissao para grupo/outros (mascara 0o077), do mesmo dono do processo, nao vazio
- * e com tamanho limitado. Remove um unico `\n` final (formato comum de arquivos criados por shell).
+ * Le um segredo de arquivo (ADR-020, item 1). Abre primeiro (`O_NOFOLLOW`) e confere tudo por
+ * `fstat` no descritor aberto, sem janela entre checagem e leitura: arquivo regular, sem
+ * permissoes para grupo/outros (mascara 0o077), do mesmo dono do processo, nao vazio, no maximo
+ * `MAX_SECRET_BYTES` (a leitura e limitada a esse tamanho + 1), UTF-8 valido. Remove um `\n` final.
  */
 export function readSecretFile(path: string): Secret {
-  let st;
+  const fd = openNoFollow(path);
   try {
-    st = lstatSync(path);
-  } catch {
-    throw new SecretFileError("ausente");
-  }
-  if (st.isSymbolicLink()) throw new SecretFileError("link-simbolico");
-  if (!st.isFile()) throw new SecretFileError("nao-e-arquivo-regular");
-  if ((st.mode & 0o077) !== 0) throw new SecretFileError("permissoes-abertas");
-  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
-    throw new SecretFileError("dono-diferente");
-  }
-  if (st.size === 0) throw new SecretFileError("vazio");
-  if (st.size > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
-  let raw: string;
-  try {
-    // O_NOFOLLOW fecha a janela entre lstat e leitura (troca por link simbolico).
-    raw = readFileSync(path, { encoding: "utf8", flag: constants.O_RDONLY | constants.O_NOFOLLOW });
-  } catch {
-    throw new SecretFileError("ilegivel");
+    const st = fstatSync(fd);
+    if (!st.isFile()) throw new SecretFileError("nao-e-arquivo-regular");
+    if ((st.mode & 0o077) !== 0) throw new SecretFileError("permissoes-abertas");
+    if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
+      throw new SecretFileError("dono-diferente");
+    }
+    if (st.size === 0) throw new SecretFileError("vazio");
+    if (st.size > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
+    const buf = Buffer.alloc(MAX_SECRET_BYTES + 1);
+    let total = 0;
+    try {
+      for (;;) {
+        const n = readSync(fd, buf, total, buf.length - total, null);
+        if (n === 0) break;
+        total += n;
+        if (total > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
+      }
+    } catch (e) {
+      if (e instanceof SecretFileError) throw e;
+      throw new SecretFileError("ilegivel");
+    }
+    let raw: string;
+    try {
+      raw = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, total));
+    } catch {
+      throw new SecretFileError("ilegivel");
+    }
+    const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
+    if (value.length === 0) throw new SecretFileError("vazio");
+    return new Secret(value);
+  } finally {
+    closeSync(fd);
   }
-  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
-  if (value.length === 0) throw new SecretFileError("vazio");
-  return new Secret(value);
 }
````

### Blocos "Validacao" de `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` (commit `93c7049`, REVIEW-011)

Sao as mesmas 5 linhas nos tres arquivos (CRLF preservado); por serem de instrucoes e nao de `documentacoes/`/`lessons/`, seguem a regra de diffs:

````diff
diff --git a/.agents/rules/project-instructions.md b/.agents/rules/project-instructions.md
index 9977b14..28b2fd3 100755
--- a/.agents/rules/project-instructions.md
+++ b/.agents/rules/project-instructions.md
@@ -180,6 +180,11 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Configuracao e ambientes (FND-006): `make lint` inclui `make lint-deploy` (overlays de staging/prod
+  sem segredo literal, com digest e hardening); `make test-ambientes` (requer Docker e `make build`)
+  ensaia config invalida, deploy/rollback e ausencia de segredo em `docker inspect`/env/logs em
+  containers efemeros em `127.0.0.1`; ainda nao roda no CI. Nao ha ambiente de staging declarado:
+  deploy real fica BLOCKED (ver `documentacoes/runbooks/deploy-staging-producao.md`).
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
diff --git a/AGENTS.md b/AGENTS.md
index 2d3cbe4..3dbbc6a 100755
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -197,6 +197,11 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Configuracao e ambientes (FND-006): `make lint` inclui `make lint-deploy` (overlays de staging/prod
+  sem segredo literal, com digest e hardening); `make test-ambientes` (requer Docker e `make build`)
+  ensaia config invalida, deploy/rollback e ausencia de segredo em `docker inspect`/env/logs em
+  containers efemeros em `127.0.0.1`; ainda nao roda no CI. Nao ha ambiente de staging declarado:
+  deploy real fica BLOCKED (ver `documentacoes/runbooks/deploy-staging-producao.md`).
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
diff --git a/CLAUDE.md b/CLAUDE.md
index 5ca95c1..0b5f16c 100755
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -187,6 +187,11 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Configuracao e ambientes (FND-006): `make lint` inclui `make lint-deploy` (overlays de staging/prod
+  sem segredo literal, com digest e hardening); `make test-ambientes` (requer Docker e `make build`)
+  ensaia config invalida, deploy/rollback e ausencia de segredo em `docker inspect`/env/logs em
+  containers efemeros em `127.0.0.1`; ainda nao roda no CI. Nao ha ambiente de staging declarado:
+  deploy real fica BLOCKED (ver `documentacoes/runbooks/deploy-staging-producao.md`).
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
````

(Os `\r` foram removidos apenas desta exibicao.) Arquivos de `documentacoes/` e `lessons/` da rodada ficam fora do patch para evitar recursao: runbook, lesson 11 (exemplo Python tipado) e este documento.

## Rodada 2 — diffs

Commit `d259238` (REV-001 e REV-002). Evidencia anterior preservada.

````diff
commit d259238a6dda325c43d1239b7e5491f369a756e3
fix(infra): teste de dono do segredo no deploy e PWD nao isento em Compose (FND-006 rodada 2)


diff --git a/infrastructure/docker/scripts/deploy-lib.mjs b/infrastructure/docker/scripts/deploy-lib.mjs
index 5b2768a..b8f29b4 100644
--- a/infrastructure/docker/scripts/deploy-lib.mjs
+++ b/infrastructure/docker/scripts/deploy-lib.mjs
@@ -11,11 +11,10 @@ const SECRET_SUFFIXES = ["PASSWORD", "PASSWD", "SECRET", "TOKEN", "APIKEY", "PRI
  * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
  * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de packages/config e config-py.
  */
-const NOT_SECRET = new Set(["PWD", "OLDPWD"]); // variaveis POSIX/shell
-
+// Sem excecao para PWD/OLDPWD aqui: em Compose/inspect qualquer PWD e literal declarado (REV-002). A isencao
+// vale so no carregador do processo (packages/config e config-py), que le o ambiente do shell.
 export function isSecretName(name) {
   const up = name.toUpperCase().replace(/[.-]/g, "_");
-  if (NOT_SECRET.has(up)) return false;
   if (/_(FILE|PATH)$/.test(up)) return false;
   if (up.split("_").some((t) => SECRET_TOKENS.has(t))) return true;
   const compact = up.replaceAll("_", "");
diff --git a/infrastructure/docker/tests/ambientes.test.mjs b/infrastructure/docker/tests/ambientes.test.mjs
index 7993642..bd647a6 100644
--- a/infrastructure/docker/tests/ambientes.test.mjs
+++ b/infrastructure/docker/tests/ambientes.test.mjs
@@ -76,6 +76,11 @@ describe("verificador de overlays", () => {
     }
     for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "KEYBOARD", "PASSTHROUGH"]) assert.ok(!isSecretName(n), n);
     assert.equal(secretFindingsInText("      DB_PASS: hunter2\n").length, 1);
+    // REV-002: PWD/OLDPWD sao isentos so no carregador do processo, nunca em Compose.
+    assert.ok(isSecretName("PWD"));
+    assert.match(bad({ environment: { PWD: "hunter2" } }).join(), /nome de segredo/);
+    assert.equal(secretFindingsInText("      PWD: hunter2\n").length, 1);
+    assert.equal(secretFindingsInText("      DB_PWD: hunter2\n").length, 1);
     assert.equal(secretFindingsInText("      JWT_SECRET_KEY: abc\n").length, 1);
     assert.equal(secretFindingsInText("      DB_PASS: ${DB_PASS:?}\n").length, 0);
   });
@@ -270,6 +275,26 @@ describe("EXTRA_COMPOSE e restrito ao ensaio", () => {
       assert.match(r.stderr, /proibido em prod/);
     }
   });
+  test("dono do segredo != API_UID e recusado sem EXTRA_COMPOSE, sem chamar docker (REV-001)", () => {
+    const segredos = mkdtempSync(join(tmpdir(), "fnd006-dono-"));
+    try {
+      writeFileSync(join(segredos, "database_password"), "x\n", { mode: 0o400 });
+      rmSync(marker, { force: true });
+      const r = sh(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", `r/a@sha256:${"a".repeat(64)}`], {
+        env: { PATH: `${stubDir}:/usr/bin:/bin`, SECRETS_DIR: segredos, API_UID: String(process.getuid() + 1) },
+      });
+      assert.equal(r.status, 1, r.stderr);
+      assert.match(r.stderr, /pertencer ao UID/);
+      assert.ok(!existsSync(marker), "docker nao deve ser chamado");
+      // controle positivo: com o UID certo a checagem de dono passa (o script segue e falha adiante)
+      const ok = sh(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", `r/a@sha256:${"a".repeat(64)}`], {
+        env: { PATH: `${stubDir}:/usr/bin:/bin`, SECRETS_DIR: segredos, API_UID: String(process.getuid()) },
+      });
+      assert.doesNotMatch(ok.stderr, /pertencer ao UID/);
+    } finally {
+      rmSync(segredos, { recursive: true, force: true });
+    }
+  });
   test("staging exige FND006_ENSAIO=1", () => {
     const r = run("staging", {});
     assert.equal(r.status, 2);
````
