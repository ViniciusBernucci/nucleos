#!/usr/bin/env bash
# Seed ficticio e deterministico do Redis (chaves dev:seed:*). Idempotente.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core exec -T redis sh -c '
  export REDISCLI_AUTH="$REDIS_PASSWORD"
  redis-cli set dev:seed:ambiente "desenvolvimento-ficticio" >/dev/null
  redis-cli set dev:seed:contador 42 >/dev/null'
echo "OK: seed do Redis aplicado"
