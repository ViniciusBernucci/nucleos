#!/usr/bin/env bash
# PoC DEC-002 reproduzivel. Requer Node 24 e Docker. Container descartavel em 127.0.0.1, sem dados reais.
set -euo pipefail
cd "$(dirname "$0")"
NAME=poc-dec002-pg; PORT=${POC_PG_PORT:-55432}
PGPASS=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')   # senha efemera, nao versionada
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=poc \
  -p 127.0.0.1:$PORT:5432 postgres:16-alpine >/dev/null
for _ in $(seq 1 40); do docker exec "$NAME" pg_isready -U postgres -q && break; sleep 0.5; done
sleep 1
npm ci --no-audit --no-fund --silent
DATABASE_URL="postgres://postgres:$PGPASS@127.0.0.1:$PORT/poc" node poc.mjs
echo "MEDIDA_RAM postgres_container: $(docker stats --no-stream --format '{{.MemUsage}}' "$NAME")"
