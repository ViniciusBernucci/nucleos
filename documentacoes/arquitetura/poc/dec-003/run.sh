#!/usr/bin/env bash
# Sobe PostgreSQL+pgvector descartavel em 127.0.0.1, roda a PoC e destroi o container (mesmo em erro).
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$HOME/.local/bin:$PATH"
IMAGE="pgvector/pgvector:pg16"
NAME="dec003-poc-pg"
export PGHOST=127.0.0.1 PGPORT="${POC_PORT:-55432}" PGUSER=postgres
PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"; export PGPASSWORD  # descartavel, nunca impresso
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "127.0.0.1:${PGPORT}:5432" -e POSTGRES_PASSWORD="$PGPASSWORD" \
  --tmpfs /var/lib/postgresql/data "$IMAGE" -c fsync=off >/dev/null
until docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; do sleep 0.5; done
sleep 2
node --version
npm ci --silent
node poc.mjs
(cd py && uv sync --frozen --quiet && uv run --frozen python check_tenant.py)
echo "container destruido ao sair"
