#!/usr/bin/env bash
# Gera segredos DESCARTAVEIS de desenvolvimento em infrastructure/docker/.env.local
# (ignorado pelo git via .gitignore ".env.*"). Idempotente: nao sobrescreve; use --force para renovar.
# Nunca imprime os valores.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$DIR/.env.local"
if [ -f "$OUT" ] && [ "${1:-}" != "--force" ]; then
  echo "OK: $OUT ja existe (use --force para regenerar; recrie volumes com reset.sh)"
  exit 0
fi
rand() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24; }
umask 077
cat >"$OUT" <<ENV
# GERADO por scripts/gerar-segredos.sh - descartavel, nao versionar.
POSTGRES_PASSWORD=$(rand)
REDIS_PASSWORD=$(rand)
MINIO_ROOT_USER=dev$(rand | head -c 8)
MINIO_ROOT_PASSWORD=$(rand)
DEV_UID=$(id -u)
DEV_GID=$(id -g)
ENV
echo "OK: segredos descartaveis gerados em $OUT (valores nao exibidos)"
