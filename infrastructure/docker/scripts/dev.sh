#!/usr/bin/env bash
# Interface do Compose de desenvolvimento (FND-004).
# Uso: scripts/dev.sh up [perfil ...] | down | ps | logs [servico] | config
# Perfis: core (padrao, sempre incluido), runtime (apps em watch), observability.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
"$DIR/scripts/gerar-segredos.sh" >/dev/null
cmd="${1:-}"; shift || true
args=(--env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core)
case "$cmd" in
  up)
    for p in "$@"; do
      case "$p" in core) ;; runtime|observability) args+=(--profile "$p") ;; *) echo "perfil desconhecido: $p" >&2; exit 2 ;; esac
    done
    # `up --wait` trata os containers one-shot (minio-init/minio-seed) como falha; por isso o polling proprio.
    docker compose "${args[@]}" up -d
    for _ in $(seq 1 90); do
      st=$(docker ps -a --filter label=com.docker.compose.project=nucleos-dev --format '{{.Names}} {{.Status}}')
      if grep -q 'unhealthy' <<<"$st" || grep -Eq 'Exited \([1-9]' <<<"$st"; then echo "FALHA:"; echo "$st"; exit 1; fi
      if ! grep -Eq 'health: starting|Created|Restarting' <<<"$st"; then break; fi
      sleep 2
    done
    grep -Eq 'health: starting|Created|Restarting' <<<"$st" && { echo "FALHA: timeout aguardando healthy"; echo "$st"; exit 1; }
    echo "$st"
    "$DIR/scripts/seed-redis.sh" ;;
  down) exec docker compose "${args[@]}" --profile runtime --profile observability down --remove-orphans ;;
  ps) exec docker compose "${args[@]}" --profile runtime --profile observability ps ;;
  logs) exec docker compose "${args[@]}" --profile runtime --profile observability logs --tail 100 "$@" ;;
  config) exec docker compose "${args[@]}" --profile runtime --profile observability config ;;
  *) echo "uso: dev.sh up [core|runtime|observability ...] | down | ps | logs | config" >&2; exit 2 ;;
esac
