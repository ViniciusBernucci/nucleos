#!/usr/bin/env bash
# Aplica as migrations da API (apps/api/migrations) no banco UNICO do Nucleos em desenvolvimento:
# o Postgres do compose.dev (container nucleos-dev-postgres-1, 127.0.0.1, banco nucleos_dev).
# Cada assunto vive em um schema desse mesmo banco (ex.: financeiro); nao se cria banco por tarefa.
# Pre-requisitos: `scripts/dev.sh up core` (Postgres no ar), `make setup` e `make build`.
# A senha e lida de .env.local e entregue ao migrador pela entrada padrao: nunca vai para env,
# argumento de processo, arquivo temporario ou saida.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
RAIZ="$(cd "$DIR/../.." && pwd)"
ENV_FILE="$DIR/.env.local"
CONTAINER="${PG_CONTAINER:-nucleos-dev-postgres-1}"
[ -f "$RAIZ/apps/api/dist/migrar.js" ] || { echo "ERRO: apps/api/dist/migrar.js ausente (rode make build)" >&2; exit 1; }

# A senha valida e a do container em execucao (o volume pode ter sido criado por outro checkout
# com outro .env.local); sem o container, cai para o .env.local deste checkout.
senha="$(docker exec "$CONTAINER" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
if [ -z "$senha" ] && [ -f "$ENV_FILE" ]; then
  senha="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi
[ -n "$senha" ] || { echo "ERRO: senha do Postgres indisponivel (suba com scripts/dev.sh up core)" >&2; exit 1; }
senha="${senha%$'\r'}"

export DATABASE_URL="postgres://nucleos_dev@127.0.0.1:${PG_HOST_PORT:-15432}/nucleos_dev"
printf '%s' "$senha" | node "$RAIZ/apps/api/dist/migrar.js" --senha-stdin
