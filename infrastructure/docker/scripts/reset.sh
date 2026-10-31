#!/usr/bin/env bash
# Destroi containers E volumes do ambiente de desenvolvimento e recria (seeds reaplicados).
# Uso: scripts/reset.sh [perfil ...]   (--destroy-only apenas destroi). Dados locais sao perdidos.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
"$DIR/scripts/gerar-segredos.sh" >/dev/null
docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability down --volumes --remove-orphans
[ "${1:-}" = "--destroy-only" ] && { echo "OK: containers e volumes destruidos"; exit 0; }
"$DIR/scripts/dev.sh" up "$@"
echo "OK: ambiente recriado com seeds"
