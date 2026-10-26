# FND-004 - Diffs (Docker Compose de desenvolvimento)

Documento principal: [2026-10-25-fnd-004-ambiente-local-docker-compose.md](2026-10-25-fnd-004-ambiente-local-docker-compose.md). Diff unificado do unico commit da tarefa em `tarefa/fnd-004` (base `4be3ce391a51b9e24cd85f7c894d841636dcd50f`), sem `documentacoes/` e `lessons/` (recursao). Nenhum segredo: `.env.local` nunca foi versionado.

```diff
diff --git a/.env.example b/.env.example
index ce37ee1..3bb8b30 100644
--- a/.env.example
+++ b/.env.example
@@ -1,2 +1,17 @@
 # Exemplo SEM valores reais. Copie para .env (nao versionado).
 HOST=127.0.0.1
+
+# --- Docker Compose de desenvolvimento (FND-004) ---
+# Os segredos NAO ficam aqui: infrastructure/docker/scripts/gerar-segredos.sh gera
+# infrastructure/docker/.env.local (nao versionado) com valores descartaveis.
+# Portas de host (todas publicadas apenas em 127.0.0.1); valores abaixo sao os padroes.
+PG_HOST_PORT=15432
+REDIS_HOST_PORT=16379
+MINIO_HOST_PORT=19000
+MINIO_CONSOLE_HOST_PORT=19001
+MAILPIT_SMTP_HOST_PORT=11025
+MAILPIT_UI_HOST_PORT=18025
+PROXY_HOST_PORT=18080
+OTLP_GRPC_HOST_PORT=14317
+OTLP_HTTP_HOST_PORT=14318
+OTEL_HEALTH_HOST_PORT=13133
diff --git a/Makefile b/Makefile
index 82dab1d..3cba0c3 100644
--- a/Makefile
+++ b/Makefile
@@ -10,7 +10,7 @@ export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
 export TURBO_TELEMETRY_DISABLED=1
 export DO_NOT_TRACK=1
 
-.PHONY: setup lint test build up down health check-env
+.PHONY: setup lint test build up down health check-env compose-up compose-down compose-reset compose-smoke
 
 setup:
 	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
@@ -41,3 +41,17 @@ health:
 
 check-env:
 	./scripts/check-no-env.sh
+
+# --- Docker Compose de desenvolvimento (FND-004). PERFIS="runtime observability" (core sempre incluido).
+PERFIS ?=
+compose-up:
+	./infrastructure/docker/scripts/dev.sh up $(PERFIS)
+
+compose-down:
+	./infrastructure/docker/scripts/dev.sh down
+
+compose-reset:
+	./infrastructure/docker/scripts/reset.sh $(PERFIS)
+
+compose-smoke:
+	./infrastructure/docker/scripts/smoke.sh $(if $(findstring runtime,$(PERFIS)),--runtime) $(if $(findstring observability,$(PERFIS)),--observability)
diff --git a/infrastructure/docker/README.md b/infrastructure/docker/README.md
index 28f23de..50f7c6d 100644
--- a/infrastructure/docker/README.md
+++ b/infrastructure/docker/README.md
@@ -1,3 +1,8 @@
 # docker
 
-Compose de desenvolvimento e scripts: FND-004. Dockerfiles de producao: ISO-007/RUN-002.
+Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`. Dockerfiles de producao: ISO-007/RUN-002.
+
+- `make compose-up [PERFIS="runtime observability"]`, `make compose-smoke`, `make compose-down`, `make compose-reset`.
+- `make up` (FND-001) continua rodando os componentes localmente; nao use junto com o perfil `runtime` (portas de app distintas no host: o perfil runtime so publica o proxy).
+- Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
+- Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
diff --git a/infrastructure/docker/caddy/Caddyfile.dev b/infrastructure/docker/caddy/Caddyfile.dev
new file mode 100644
index 0000000..4fc7596
--- /dev/null
+++ b/infrastructure/docker/caddy/Caddyfile.dev
@@ -0,0 +1,32 @@
+# Proxy de desenvolvimento (FND-004). So HTTP, so loopback no host.
+# Hosts *.localhost resolvem para 127.0.0.1 nos navegadores; com curl use --resolve ou -H "Host: ...".
+{
+	auto_https off
+	admin 127.0.0.1:2019
+}
+
+:8080 {
+	handle /healthz {
+		respond "ok" 200
+	}
+	handle {
+		respond "proxy de desenvolvimento Nucleos: use app.localhost, mail.localhost ou minio.localhost" 404
+	}
+}
+
+http://app.localhost:8080 {
+	handle_path /api/* {
+		reverse_proxy api:3001
+	}
+	handle {
+		reverse_proxy web:3000
+	}
+}
+
+http://mail.localhost:8080 {
+	reverse_proxy mailpit:8025
+}
+
+http://minio.localhost:8080 {
+	reverse_proxy minio:9001
+}
diff --git a/infrastructure/docker/compose.dev.yml b/infrastructure/docker/compose.dev.yml
new file mode 100644
index 0000000..f8f1d2c
--- /dev/null
+++ b/infrastructure/docker/compose.dev.yml
@@ -0,0 +1,259 @@
+# Ambiente de desenvolvimento local (FND-004). NAO e producao (veja compose.staging/prod em FND-006).
+# Uso: scripts/dev.sh up [core|runtime|observability ...]  (gera segredos descartaveis em .env.local)
+# Imagens: tag fixa + digest (verificados em 2026-10-25; ver documentacoes/infraestrutura/).
+# Portas: SEMPRE "127.0.0.1:<host>:<container>"; nenhuma porta em 0.0.0.0.
+name: nucleos-dev
+
+x-seguro: &seguro
+  security_opt: ["no-new-privileges:true"]
+  restart: unless-stopped
+
+x-app-node: &app-node
+  <<: *seguro
+  image: node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
+  profiles: ["runtime"]
+  user: "${DEV_UID:?execute scripts/gerar-segredos.sh}:${DEV_GID:?}"
+  working_dir: /workspace
+  networks: [interna]
+  environment: &app-env
+    HOST: 0.0.0.0
+    HOME: /tmp
+    NEXT_TELEMETRY_DISABLED: "1"
+  depends_on: &app-deps
+    postgres: {condition: service_healthy}
+    redis: {condition: service_healthy}
+    minio: {condition: service_healthy}
+
+x-app-python: &app-python
+  <<: *seguro
+  image: python:3.13.17-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530
+  profiles: ["runtime"]
+  user: "${DEV_UID:?execute scripts/gerar-segredos.sh}:${DEV_GID:?}"
+  working_dir: /workspace
+  networks: [interna]
+  depends_on: *app-deps
+  volumes: ["../../:/workspace:ro"]
+
+services:
+  # ---------------------------------------------------------------- perfil core
+  postgres:
+    <<: *seguro
+    image: pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0
+    profiles: ["core"]
+    environment:
+      POSTGRES_USER: nucleos_dev
+      POSTGRES_DB: nucleos_dev
+      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?execute scripts/gerar-segredos.sh}
+    volumes:
+      - postgres-data:/var/lib/postgresql
+      - ./postgres/init:/docker-entrypoint-initdb.d:ro
+    ports: ["127.0.0.1:${PG_HOST_PORT:-15432}:5432"]
+    networks: [interna, publicada]
+    healthcheck:
+      test: ["CMD-SHELL", "pg_isready -U nucleos_dev -d nucleos_dev"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+      start_period: 10s
+
+  redis:
+    <<: *seguro
+    image: redis:8.8.3-alpine@sha256:dc95ea2fcf5d5c4253be0f967c28143d0f625846197eed2fd32c748eb99abfca
+    profiles: ["core"]
+    environment:
+      REDIS_PASSWORD: ${REDIS_PASSWORD:?execute scripts/gerar-segredos.sh}
+    command: ["sh", "-c", "exec redis-server --requirepass \"$$REDIS_PASSWORD\" --appendonly yes"]
+    volumes: [redis-data:/data]
+    ports: ["127.0.0.1:${REDIS_HOST_PORT:-16379}:6379"]
+    networks: [interna, publicada]
+    healthcheck:
+      test: ["CMD-SHELL", "REDISCLI_AUTH=\"$$REDIS_PASSWORD\" redis-cli ping | grep -q PONG"]
+      interval: 5s
+      timeout: 3s
+      retries: 20
+
+  minio:
+    <<: *seguro
+    # MinIO nao publica mais imagens oficiais (minio/minio e quay.io/minio/minio ausentes em 2026-10-25);
+    # usa-se a imagem Chainguard do mesmo software (RELEASE.2026-10-23T20-06-51Z). Decisao: DEC-009.
+    image: cgr.dev/chainguard/minio:latest@sha256:268d68a2a3b6fc65f905a61f84d7eab6345ce6bff14f551e2b028ec31e6a1341
+    profiles: ["core"]
+    environment:
+      MINIO_ROOT_USER: ${MINIO_ROOT_USER:?execute scripts/gerar-segredos.sh}
+      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:?execute scripts/gerar-segredos.sh}
+    command: ["server", "/data", "--address", ":9000", "--console-address", ":9001"]
+    volumes: [minio-data:/data]
+    ports:
+      - "127.0.0.1:${MINIO_HOST_PORT:-19000}:9000"
+      - "127.0.0.1:${MINIO_CONSOLE_HOST_PORT:-19001}:9001"
+    networks: [interna, publicada]
+    healthcheck:
+      test: ["CMD", "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /minio/health/live HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && read -r l <&3 && [[ $$l == *' 200'* ]]"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+
+  minio-init:
+    image: cgr.dev/chainguard/minio-client:latest@sha256:59f1924e417b6fcfdc0aca321e3bdebe8a56fd0efa7da80037d5eb65a203d687
+    profiles: ["core"]
+    restart: "no"
+    security_opt: ["no-new-privileges:true"]
+    # Imagem distroless (sem shell): MC_HOST_local define o alias; uma tarefa por container.
+    environment:
+      MC_HOST_local: http://${MINIO_ROOT_USER:?}:${MINIO_ROOT_PASSWORD:?}@minio:9000
+    entrypoint: ["mc"]
+    command: ["mb", "--ignore-existing", "local/nucleos-dev-seed"]
+    volumes: ["./seeds/minio:/seeds:ro"]
+    networks: [interna]
+    depends_on:
+      minio: {condition: service_healthy}
+
+  minio-seed:
+    image: cgr.dev/chainguard/minio-client:latest@sha256:59f1924e417b6fcfdc0aca321e3bdebe8a56fd0efa7da80037d5eb65a203d687
+    profiles: ["core"]
+    restart: "no"
+    security_opt: ["no-new-privileges:true"]
+    environment:
+      MC_HOST_local: http://${MINIO_ROOT_USER:?}:${MINIO_ROOT_PASSWORD:?}@minio:9000
+    entrypoint: ["mc"]
+    command: ["mirror", "--overwrite", "/seeds", "local/nucleos-dev-seed"]
+    volumes: ["./seeds/minio:/seeds:ro"]
+    networks: [interna]
+    depends_on:
+      minio-init: {condition: service_completed_successfully}
+
+  mailpit:
+    <<: *seguro
+    image: axllent/mailpit:v1.32.0@sha256:0790692be935ea4420d085694f7985b1f692ca6a8771ab0e0bd8ba75ac180498
+    profiles: ["core"]
+    ports:
+      - "127.0.0.1:${MAILPIT_SMTP_HOST_PORT:-11025}:1025"
+      - "127.0.0.1:${MAILPIT_UI_HOST_PORT:-18025}:8025"
+    networks: [interna, publicada]
+    healthcheck:
+      test: ["CMD", "/mailpit", "readyz"]
+      interval: 5s
+      timeout: 3s
+      retries: 20
+
+  proxy:
+    <<: *seguro
+    image: caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f
+    profiles: ["core"]
+    volumes:
+      - ./caddy/Caddyfile.dev:/etc/caddy/Caddyfile:ro
+    ports: ["127.0.0.1:${PROXY_HOST_PORT:-18080}:8080"]
+    networks: [interna, publicada]
+    depends_on:
+      mailpit: {condition: service_healthy}
+      minio: {condition: service_healthy}
+    healthcheck:
+      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
+      interval: 5s
+      timeout: 3s
+      retries: 20
+
+  # ------------------------------------------------------------- perfil runtime
+  # Modo watch: node --watch reinicia ao mudar dist/ (compile em paralelo com `pnpm --filter ... exec tsc -w`);
+  # web usa `next dev` (HMR). Servicos Python (stdlib) nao tem watcher: `docker compose restart <servico>`.
+  # Requer `make build` previo (dist/) e `make setup` (node_modules). Nao publicam portas: so via proxy.
+  web:
+    <<: *app-node
+    volumes: ["../../:/workspace"]
+    working_dir: /workspace/apps/web
+    environment: {<<: *app-env, PORT: "3000"}
+    command: ["node", "node_modules/next/dist/bin/next", "dev", "-H", "0.0.0.0", "-p", "3000"]
+    healthcheck: &hc-node3000
+      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
+      interval: 5s
+      timeout: 5s
+      retries: 30
+      start_period: 15s
+
+  api:
+    <<: *app-node
+    volumes: ["../../:/workspace:ro"]
+    environment: {<<: *app-env, PORT: "3001"}
+    command: ["node", "--watch", "apps/api/dist/main.js"]
+    healthcheck:
+      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
+      interval: 5s
+      timeout: 5s
+      retries: 30
+
+  tenant-provisioner:
+    <<: *app-node
+    volumes: ["../../:/workspace:ro"]
+    environment: {<<: *app-env, PORT: "3002"}
+    command: ["node", "--watch", "apps/tenant-provisioner/dist/main.js"]
+    healthcheck:
+      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3002/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
+      interval: 5s
+      timeout: 5s
+      retries: 30
+
+  tenant-runtime:
+    <<: *app-python
+    environment: {HOST: 0.0.0.0, PORT: "8001", PYTHONPATH: /workspace/services/tenant-runtime/src, PYTHONDONTWRITEBYTECODE: "1"}
+    command: ["python", "-m", "tenant_runtime"]
+    healthcheck:
+      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8001/healthz', timeout=3)"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+
+  ai-gateway:
+    <<: *app-python
+    environment: {HOST: 0.0.0.0, PORT: "8002", PYTHONPATH: /workspace/services/ai-gateway/src, PYTHONDONTWRITEBYTECODE: "1"}
+    command: ["python", "-m", "ai_gateway"]
+    healthcheck:
+      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8002/healthz', timeout=3)"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+
+  tool-gateway:
+    <<: *app-python
+    environment: {HOST: 0.0.0.0, PORT: "8003", PYTHONPATH: /workspace/services/tool-gateway/src, PYTHONDONTWRITEBYTECODE: "1"}
+    command: ["python", "-m", "tool_gateway"]
+    healthcheck:
+      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8003/healthz', timeout=3)"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+
+  event-dispatcher:
+    <<: *app-python
+    environment: {HOST: 0.0.0.0, PORT: "8004", PYTHONPATH: /workspace/services/event-dispatcher/src, PYTHONDONTWRITEBYTECODE: "1"}
+    command: ["python", "-m", "event_dispatcher"]
+    healthcheck:
+      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8004/healthz', timeout=3)"]
+      interval: 5s
+      timeout: 5s
+      retries: 20
+
+  # ------------------------------------------------------- perfil observability
+  # Imagem distroless (sem shell): sem healthcheck do Compose; o smoke consulta o health_check publicado.
+  otel-collector:
+    <<: *seguro
+    image: otel/opentelemetry-collector:0.163.2@sha256:63e5e8eccf4268be02388ba9f2dc36b80b5e47721291293411c0e83152d75bda
+    profiles: ["observability"]
+    command: ["--config=/etc/otelcol/config.yaml"]
+    volumes: ["./otel/collector.dev.yaml:/etc/otelcol/config.yaml:ro"]
+    ports:
+      - "127.0.0.1:${OTLP_GRPC_HOST_PORT:-14317}:4317"
+      - "127.0.0.1:${OTLP_HTTP_HOST_PORT:-14318}:4318"
+      - "127.0.0.1:${OTEL_HEALTH_HOST_PORT:-13133}:13133"
+    networks: [interna, publicada]
+
+networks:
+  # interna: trafego servico-a-servico, sem rota para fora (internal: true).
+  interna:
+    internal: true
+  # publicada: unica rede com saida/publicacao; so serve para os binds em 127.0.0.1.
+  publicada: {}
+
+volumes:
+  postgres-data: {}
+  redis-data: {}
+  minio-data: {}
diff --git a/infrastructure/docker/otel/collector.dev.yaml b/infrastructure/docker/otel/collector.dev.yaml
new file mode 100644
index 0000000..ca7a5da
--- /dev/null
+++ b/infrastructure/docker/otel/collector.dev.yaml
@@ -0,0 +1,32 @@
+# Coletor OTLP de desenvolvimento (perfil observability). Apenas descarta para o log (debug).
+# Pipelines reais de logs/metricas/traces: FND-009 / DEC-010.
+receivers:
+  otlp:
+    protocols:
+      grpc:
+        endpoint: 0.0.0.0:4317
+      http:
+        endpoint: 0.0.0.0:4318
+processors:
+  batch: {}
+exporters:
+  debug:
+    verbosity: basic
+extensions:
+  health_check:
+    endpoint: 0.0.0.0:13133
+service:
+  extensions: [health_check]
+  pipelines:
+    traces:
+      receivers: [otlp]
+      processors: [batch]
+      exporters: [debug]
+    metrics:
+      receivers: [otlp]
+      processors: [batch]
+      exporters: [debug]
+    logs:
+      receivers: [otlp]
+      processors: [batch]
+      exporters: [debug]
diff --git a/infrastructure/docker/postgres/init/01-seed-ficticio.sql b/infrastructure/docker/postgres/init/01-seed-ficticio.sql
new file mode 100644
index 0000000..f995ffd
--- /dev/null
+++ b/infrastructure/docker/postgres/init/01-seed-ficticio.sql
@@ -0,0 +1,18 @@
+-- Seed FICTICIO e DETERMINISTICO do ambiente de desenvolvimento (FND-004).
+-- Executado pelo entrypoint da imagem apenas em volume vazio (veja scripts/reset.sh).
+-- Nunca colocar dados reais aqui. Esquema definitivo/migracoes: DAT-001.
+CREATE EXTENSION IF NOT EXISTS vector;
+
+CREATE SCHEMA IF NOT EXISTS dev_seed;
+
+CREATE TABLE dev_seed.organizacoes (
+  id        uuid PRIMARY KEY,
+  slug      text NOT NULL UNIQUE,
+  nome      text NOT NULL,
+  embedding vector(3) NOT NULL
+);
+
+INSERT INTO dev_seed.organizacoes (id, slug, nome, embedding) VALUES
+  ('00000000-0000-4000-8000-000000000001', 'org-exemplo-a', 'Organizacao Ficticia A', '[0.1,0.2,0.3]'),
+  ('00000000-0000-4000-8000-000000000002', 'org-exemplo-b', 'Organizacao Ficticia B', '[0.3,0.2,0.1]'),
+  ('00000000-0000-4000-8000-000000000003', 'org-exemplo-c', 'Organizacao Ficticia C', '[0.9,0.0,0.1]');
diff --git a/infrastructure/docker/scripts/dev.sh b/infrastructure/docker/scripts/dev.sh
new file mode 100755
index 0000000..0a628bb
--- /dev/null
+++ b/infrastructure/docker/scripts/dev.sh
@@ -0,0 +1,31 @@
+#!/usr/bin/env bash
+# Interface do Compose de desenvolvimento (FND-004).
+# Uso: scripts/dev.sh up [perfil ...] | down | ps | logs [servico] | config
+# Perfis: core (padrao, sempre incluido), runtime (apps em watch), observability.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+"$DIR/scripts/gerar-segredos.sh" >/dev/null
+cmd="${1:-}"; shift || true
+args=(--env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core)
+case "$cmd" in
+  up)
+    for p in "$@"; do
+      case "$p" in core) ;; runtime|observability) args+=(--profile "$p") ;; *) echo "perfil desconhecido: $p" >&2; exit 2 ;; esac
+    done
+    # `up --wait` trata os containers one-shot (minio-init/minio-seed) como falha; por isso o polling proprio.
+    docker compose "${args[@]}" up -d
+    for _ in $(seq 1 90); do
+      st=$(docker ps -a --filter label=com.docker.compose.project=nucleos-dev --format '{{.Names}} {{.Status}}')
+      if grep -q 'unhealthy' <<<"$st" || grep -Eq 'Exited \([1-9]' <<<"$st"; then echo "FALHA:"; echo "$st"; exit 1; fi
+      if ! grep -Eq 'health: starting|Created|Restarting' <<<"$st"; then break; fi
+      sleep 2
+    done
+    grep -Eq 'health: starting|Created|Restarting' <<<"$st" && { echo "FALHA: timeout aguardando healthy"; echo "$st"; exit 1; }
+    echo "$st"
+    "$DIR/scripts/seed-redis.sh" ;;
+  down) exec docker compose "${args[@]}" --profile runtime --profile observability down --remove-orphans ;;
+  ps) exec docker compose "${args[@]}" --profile runtime --profile observability ps ;;
+  logs) exec docker compose "${args[@]}" --profile runtime --profile observability logs --tail 100 "$@" ;;
+  config) exec docker compose "${args[@]}" --profile runtime --profile observability config ;;
+  *) echo "uso: dev.sh up [core|runtime|observability ...] | down | ps | logs | config" >&2; exit 2 ;;
+esac
diff --git a/infrastructure/docker/scripts/gerar-segredos.sh b/infrastructure/docker/scripts/gerar-segredos.sh
new file mode 100755
index 0000000..83263a6
--- /dev/null
+++ b/infrastructure/docker/scripts/gerar-segredos.sh
@@ -0,0 +1,23 @@
+#!/usr/bin/env bash
+# Gera segredos DESCARTAVEIS de desenvolvimento em infrastructure/docker/.env.local
+# (ignorado pelo git via .gitignore ".env.*"). Idempotente: nao sobrescreve; use --force para renovar.
+# Nunca imprime os valores.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+OUT="$DIR/.env.local"
+if [ -f "$OUT" ] && [ "${1:-}" != "--force" ]; then
+  echo "OK: $OUT ja existe (use --force para regenerar; recrie volumes com reset.sh)"
+  exit 0
+fi
+rand() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24; }
+umask 077
+cat >"$OUT" <<ENV
+# GERADO por scripts/gerar-segredos.sh - descartavel, nao versionar.
+POSTGRES_PASSWORD=$(rand)
+REDIS_PASSWORD=$(rand)
+MINIO_ROOT_USER=dev$(rand | head -c 8)
+MINIO_ROOT_PASSWORD=$(rand)
+DEV_UID=$(id -u)
+DEV_GID=$(id -g)
+ENV
+echo "OK: segredos descartaveis gerados em $OUT (valores nao exibidos)"
diff --git a/infrastructure/docker/scripts/reset.sh b/infrastructure/docker/scripts/reset.sh
new file mode 100755
index 0000000..c4db9b5
--- /dev/null
+++ b/infrastructure/docker/scripts/reset.sh
@@ -0,0 +1,10 @@
+#!/usr/bin/env bash
+# Destroi containers E volumes do ambiente de desenvolvimento e recria (seeds reaplicados).
+# Uso: scripts/reset.sh [perfil ...]   (--destroy-only apenas destroi). Dados locais sao perdidos.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+"$DIR/scripts/gerar-segredos.sh" >/dev/null
+docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability down --volumes --remove-orphans
+[ "${1:-}" = "--destroy-only" ] && { echo "OK: containers e volumes destruidos"; exit 0; }
+"$DIR/scripts/dev.sh" up "$@"
+echo "OK: ambiente recriado com seeds"
diff --git a/infrastructure/docker/scripts/seed-redis.sh b/infrastructure/docker/scripts/seed-redis.sh
new file mode 100755
index 0000000..937482b
--- /dev/null
+++ b/infrastructure/docker/scripts/seed-redis.sh
@@ -0,0 +1,9 @@
+#!/usr/bin/env bash
+# Seed ficticio e deterministico do Redis (chaves dev:seed:*). Idempotente.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core exec -T redis sh -c '
+  export REDISCLI_AUTH="$REDIS_PASSWORD"
+  redis-cli set dev:seed:ambiente "desenvolvimento-ficticio" >/dev/null
+  redis-cli set dev:seed:contador 42 >/dev/null'
+echo "OK: seed do Redis aplicado"
diff --git a/infrastructure/docker/scripts/smoke.sh b/infrastructure/docker/scripts/smoke.sh
new file mode 100755
index 0000000..bcf6f75
--- /dev/null
+++ b/infrastructure/docker/scripts/smoke.sh
@@ -0,0 +1,42 @@
+#!/usr/bin/env bash
+# Smoke do ambiente de desenvolvimento (FND-004): pg_isready, redis-cli ping, mc ls, curl.
+# Uso: scripts/smoke.sh [--runtime] [--observability]   Falha (rc != 0) se algum item falhar.
+set -uo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+set -a; . "$DIR/.env.local"; set +a
+DC=(docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability)
+H=127.0.0.1
+fail=0
+ok() { echo "OK    $1"; }
+ko() { echo "FALHA $1"; fail=1; }
+chk() { local nome=$1; shift; if "$@" >/dev/null 2>&1; then ok "$nome"; else ko "$nome"; fi; }
+
+chk "postgres pg_isready" "${DC[@]}" exec -T postgres pg_isready -U nucleos_dev -d nucleos_dev
+n=$("${DC[@]}" exec -T postgres psql -U nucleos_dev -d nucleos_dev -Atc "select count(*) from dev_seed.organizacoes" 2>/dev/null)
+[ "$n" = "3" ] && ok "postgres seed (3 organizacoes)" || ko "postgres seed (obtido: '$n')"
+v=$("${DC[@]}" exec -T postgres psql -U nucleos_dev -d nucleos_dev -Atc "select slug from dev_seed.organizacoes order by embedding <-> '[0.1,0.2,0.3]' limit 1" 2>/dev/null)
+[ "$v" = "org-exemplo-a" ] && ok "pgvector (vizinho mais proximo deterministico)" || ko "pgvector (obtido: '$v')"
+p=$("${DC[@]}" exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping' 2>/dev/null | tr -d '\r')
+[ "$p" = "PONG" ] && ok "redis-cli ping" || ko "redis-cli ping ('$p')"
+r=$("${DC[@]}" exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli get dev:seed:contador' 2>/dev/null | tr -d '\r')
+[ "$r" = "42" ] && ok "redis seed" || ko "redis seed ('$r')"
+chk "redis exige senha" bash -c "! ( exec 3<>/dev/tcp/$H/${REDIS_HOST_PORT:-16379}; printf 'PING\r\n' >&3; timeout 2 head -n1 <&3 | grep -q PONG )"
+m=$("${DC[@]}" run --rm --no-deps minio-init ls local/nucleos-dev-seed 2>/dev/null)
+echo "$m" | grep -q bem-vindo.txt && ok "minio mc ls (bem-vindo.txt)" || ko "minio mc ls"
+chk "minio health (curl)" curl -fsS "http://$H:${MINIO_HOST_PORT:-19000}/minio/health/live"
+chk "minio console (curl)" curl -fsS -o /dev/null "http://$H:${MINIO_CONSOLE_HOST_PORT:-19001}/"
+chk "mailpit UI/API (curl)" curl -fsS "http://$H:${MAILPIT_UI_HOST_PORT:-18025}/api/v1/info"
+chk "proxy /healthz (curl)" curl -fsS "http://$H:${PROXY_HOST_PORT:-18080}/healthz"
+chk "proxy -> mailpit (Host mail.localhost)" curl -fsS -H "Host: mail.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/v1/info"
+chk "proxy -> minio console (Host minio.localhost)" curl -fsS -o /dev/null -H "Host: minio.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/"
+for a in "$@"; do
+  case "$a" in
+    --runtime)
+      chk "proxy -> api /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/healthz"
+      chk "proxy -> web /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/healthz" ;;
+    --observability) chk "otel-collector health_check" curl -fsS "http://$H:${OTEL_HEALTH_HOST_PORT:-13133}/" ;;
+  esac
+done
+"$DIR/scripts/verificar-lan.sh" || fail=1
+[ "$fail" -eq 0 ] && echo "SMOKE OK" || echo "SMOKE COM FALHAS"
+exit "$fail"
diff --git a/infrastructure/docker/scripts/verificar-lan.sh b/infrastructure/docker/scripts/verificar-lan.sh
new file mode 100755
index 0000000..2216542
--- /dev/null
+++ b/infrastructure/docker/scripts/verificar-lan.sh
@@ -0,0 +1,27 @@
+#!/usr/bin/env bash
+# AC-2 (FND-004): nenhuma porta publicada pelo Compose do projeto pode escutar fora de 127.0.0.1.
+# 1) lista as portas publicadas (docker) e exige bind 127.0.0.1 em cada uma (ss);
+# 2) tenta conectar (nc) pelo IP da LAN da maquina: deve ser recusado.
+set -uo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+DC=(docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability)
+fail=0
+mapfile -t pubs < <(docker ps --filter label=com.docker.compose.project=nucleos-dev --format '{{.Ports}}' | grep -oE '[^ ,]+:[0-9]+->' | sed -E 's/->$//' | sed -E 's/^(.*):([0-9]+)$/\1 \2/' | sort -u)
+[ "${#pubs[@]}" -gt 0 ] || { echo "FALHA lan: nenhuma porta publicada encontrada (ambiente no ar?)"; exit 1; }
+lan_ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.')
+for l in "${pubs[@]}"; do
+  addr=${l% *}; port=${l##* }
+  [ "$addr" = "127.0.0.1" ] || { echo "FALHA publicada em $addr:$port (esperado 127.0.0.1)"; fail=1; }
+  [ -n "$port" ] || continue
+  bind=$(ss -ltnH "sport = :$port" | awk '{print $4}' | sort -u | tr '\n' ' ')
+  case "$bind" in
+    "127.0.0.1:$port ") echo "OK    porta $port escuta so em 127.0.0.1" ;;
+    *) echo "FALHA porta $port escuta em: ${bind:-nada} (esperado 127.0.0.1)"; fail=1 ;;
+  esac
+  for lan_ip in $lan_ips; do
+    if nc -z -w 2 "$lan_ip" "$port" 2>/dev/null; then echo "FALHA $lan_ip:$port acessivel pela LAN"; fail=1
+    else echo "OK    $lan_ip:$port recusado"; fi
+  done
+done
+[ -n "$lan_ips" ] || echo "AVISO sem IPv4 nao-loopback; teste nc ignorado (ss ja prova o bind)"
+exit "$fail"
diff --git a/infrastructure/docker/seeds/minio/bem-vindo.txt b/infrastructure/docker/seeds/minio/bem-vindo.txt
new file mode 100644
index 0000000..ffbf867
--- /dev/null
+++ b/infrastructure/docker/seeds/minio/bem-vindo.txt
@@ -0,0 +1 @@
+Arquivo ficticio de seed (FND-004). Conteudo deterministico, sem dados reais.
```

## Correcao rodada 1 (2026-10-26)

Diff unificado do commit de correcao sobre `023da3dacb13ba8770b768bf6435419659eaf1aa` (README, compose, smoke.sh; sem `documentacoes/`). SHA no retorno ao coordenador.

```diff
diff --git a/infrastructure/docker/README.md b/infrastructure/docker/README.md
index 50f7c6d..9cdce90 100644
--- a/infrastructure/docker/README.md
+++ b/infrastructure/docker/README.md
@@ -3,6 +3,8 @@
 Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`. Dockerfiles de producao: ISO-007/RUN-002.
 
 - `make compose-up [PERFIS="runtime observability"]`, `make compose-smoke`, `make compose-down`, `make compose-reset`.
+- Equivalencia do AC-1 do ticket (decisao a registrar pelo coordenador): **AC-1 := `make compose-up`** (perfil core; `PERFIS=...` para runtime/observability). `make up` permanece o da FND-001.
 - `make up` (FND-001) continua rodando os componentes localmente; nao use junto com o perfil `runtime` (portas de app distintas no host: o perfil runtime so publica o proxy).
 - Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
 - Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
+- Apps do perfil `runtime`: repo montado somente leitura (web tem escrita so em `apps/web`) e `.env.local` mascarado por `/dev/null` (apps nao recebem segredos do Compose).
diff --git a/infrastructure/docker/compose.dev.yml b/infrastructure/docker/compose.dev.yml
index f8f1d2c..4e687fd 100644
--- a/infrastructure/docker/compose.dev.yml
+++ b/infrastructure/docker/compose.dev.yml
@@ -32,7 +32,7 @@ x-app-python: &app-python
   working_dir: /workspace
   networks: [interna]
   depends_on: *app-deps
-  volumes: ["../../:/workspace:ro"]
+  volumes: ["../../:/workspace:ro", "/dev/null:/workspace/infrastructure/docker/.env.local:ro"]
 
 services:
   # ---------------------------------------------------------------- perfil core
@@ -159,7 +159,7 @@ services:
   # Requer `make build` previo (dist/) e `make setup` (node_modules). Nao publicam portas: so via proxy.
   web:
     <<: *app-node
-    volumes: ["../../:/workspace"]
+    volumes: ["../../:/workspace:ro", "../../apps/web:/workspace/apps/web", "/dev/null:/workspace/infrastructure/docker/.env.local:ro"]
     working_dir: /workspace/apps/web
     environment: {<<: *app-env, PORT: "3000"}
     command: ["node", "node_modules/next/dist/bin/next", "dev", "-H", "0.0.0.0", "-p", "3000"]
@@ -172,7 +172,7 @@ services:
 
   api:
     <<: *app-node
-    volumes: ["../../:/workspace:ro"]
+    volumes: ["../../:/workspace:ro", "/dev/null:/workspace/infrastructure/docker/.env.local:ro"]
     environment: {<<: *app-env, PORT: "3001"}
     command: ["node", "--watch", "apps/api/dist/main.js"]
     healthcheck:
@@ -183,7 +183,7 @@ services:
 
   tenant-provisioner:
     <<: *app-node
-    volumes: ["../../:/workspace:ro"]
+    volumes: ["../../:/workspace:ro", "/dev/null:/workspace/infrastructure/docker/.env.local:ro"]
     environment: {<<: *app-env, PORT: "3002"}
     command: ["node", "--watch", "apps/tenant-provisioner/dist/main.js"]
     healthcheck:
diff --git a/infrastructure/docker/scripts/smoke.sh b/infrastructure/docker/scripts/smoke.sh
index bcf6f75..233245a 100755
--- a/infrastructure/docker/scripts/smoke.sh
+++ b/infrastructure/docker/scripts/smoke.sh
@@ -3,6 +3,7 @@
 # Uso: scripts/smoke.sh [--runtime] [--observability]   Falha (rc != 0) se algum item falhar.
 set -uo pipefail
 DIR="$(cd "$(dirname "$0")/.." && pwd)"
+[ -r "$DIR/.env.local" ] || { echo "FALHA: .env.local ausente; rode 'make compose-up'" >&2; exit 2; }
 set -a; . "$DIR/.env.local"; set +a
 DC=(docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability)
 H=127.0.0.1
```

## Correcao rodada 2 (integracao)

Commit `6b3251f` (merge `4bb1332` nao reproduzido: integra a revisao).

```diff
diff --git a/infrastructure/docker/compose.dev.yml b/infrastructure/docker/compose.dev.yml
index 4e687fd..0ae6fba 100644
--- a/infrastructure/docker/compose.dev.yml
+++ b/infrastructure/docker/compose.dev.yml
@@ -24,6 +24,8 @@ x-app-node: &app-node
     redis: {condition: service_healthy}
     minio: {condition: service_healthy}
 
+# PYTHONPATH comum dos servicos Python (INT-001): fonte de nucleos_observability + site-packages do .venv do uv
+# (make setup), montado ro em /workspace. Evita pip ad hoc na imagem slim; mesmas versoes travadas em uv.lock.
 x-app-python: &app-python
   <<: *seguro
   image: python:3.13.17-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530
@@ -194,7 +196,7 @@ services:
 
   tenant-runtime:
     <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8001", PYTHONPATH: /workspace/services/tenant-runtime/src, PYTHONDONTWRITEBYTECODE: "1"}
+    environment: {HOST: 0.0.0.0, PORT: "8001", PYTHONPATH: "/workspace/services/tenant-runtime/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
     command: ["python", "-m", "tenant_runtime"]
     healthcheck:
       test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8001/healthz', timeout=3)"]
@@ -204,7 +206,7 @@ services:
 
   ai-gateway:
     <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8002", PYTHONPATH: /workspace/services/ai-gateway/src, PYTHONDONTWRITEBYTECODE: "1"}
+    environment: {HOST: 0.0.0.0, PORT: "8002", PYTHONPATH: "/workspace/services/ai-gateway/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
     command: ["python", "-m", "ai_gateway"]
     healthcheck:
       test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8002/healthz', timeout=3)"]
@@ -214,7 +216,7 @@ services:
 
   tool-gateway:
     <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8003", PYTHONPATH: /workspace/services/tool-gateway/src, PYTHONDONTWRITEBYTECODE: "1"}
+    environment: {HOST: 0.0.0.0, PORT: "8003", PYTHONPATH: "/workspace/services/tool-gateway/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
     command: ["python", "-m", "tool_gateway"]
     healthcheck:
       test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8003/healthz', timeout=3)"]
@@ -224,7 +226,7 @@ services:
 
   event-dispatcher:
     <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8004", PYTHONPATH: /workspace/services/event-dispatcher/src, PYTHONDONTWRITEBYTECODE: "1"}
+    environment: {HOST: 0.0.0.0, PORT: "8004", PYTHONPATH: "/workspace/services/event-dispatcher/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
     command: ["python", "-m", "event_dispatcher"]
     healthcheck:
       test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8004/healthz', timeout=3)"]
diff --git a/infrastructure/docker/scripts/smoke.sh b/infrastructure/docker/scripts/smoke.sh
index 233245a..d18fa22 100755
--- a/infrastructure/docker/scripts/smoke.sh
+++ b/infrastructure/docker/scripts/smoke.sh
@@ -33,6 +33,13 @@ chk "proxy -> minio console (Host minio.localhost)" curl -fsS -o /dev/null -H "H
 for a in "$@"; do
   case "$a" in
     --runtime)
+      # INT-002: /healthz de CADA servico runtime, de dentro do container (nao publicam portas); falha se cair.
+      for sv in tenant-runtime:8001 ai-gateway:8002 tool-gateway:8003 event-dispatcher:8004; do
+        chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:${sv##*:}/healthz', timeout=3)"
+      done
+      for sv in api:3001 web:3000 tenant-provisioner:3002; do
+        chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" node -e "fetch('http://127.0.0.1:${sv##*:}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
+      done
       chk "proxy -> api /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/healthz"
       chk "proxy -> web /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/healthz" ;;
     --observability) chk "otel-collector health_check" curl -fsS "http://$H:${OTEL_HEALTH_HOST_PORT:-13133}/" ;;
```
