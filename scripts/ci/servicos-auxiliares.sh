#!/usr/bin/env bash
# Servicos auxiliares efemeros para testes de integracao (PostgreSQL+pgvector, Redis, MinIO).
# Mesmas imagens (digest) do compose de desenvolvimento. Portas SOMENTE em 127.0.0.1, senhas
# aleatorias geradas na hora (nunca versionadas), containers descartados por `down`.
# Uso: scripts/ci/servicos-auxiliares.sh up|down
# `up` exporta NUCLEOS_CI_* para $GITHUB_ENV (mascarados) ou, fora do CI, para .run/ci-servicos.env (0600).
set -euo pipefail
cd "$(dirname "$0")/../.."
PREFIXO="nucleos-ci"
PG_IMG="pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0"
REDIS_IMG="redis:8.8.3-alpine@sha256:dc95ea2fcf5d5c4253be0f967c28143d0f625846197eed2fd32c748eb99abfca"
MINIO_IMG="cgr.dev/chainguard/minio:latest@sha256:268d68a2a3b6fc65f905a61f84d7eab6345ce6bff14f551e2b028ec31e6a1341"

down() { docker rm -f "$PREFIXO-pg" "$PREFIXO-redis" "$PREFIXO-minio" >/dev/null 2>&1 || true; }

porta() { docker port "$1" "$2/tcp" | head -1 | sed 's/.*://'; }

aguardar() { # nome comando...
  local nome="$1"; shift
  for _ in $(seq 1 60); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "ERRO: $nome nao ficou pronto em 60s" >&2
  return 1
}

up() {
  down
  local pg_pw redis_pw minio_pw
  pg_pw="$(openssl rand -hex 16)"; redis_pw="$(openssl rand -hex 16)"; minio_pw="$(openssl rand -hex 16)"
  trap 'down' ERR
  docker run -d --name "$PREFIXO-pg" -p 127.0.0.1::5432 \
    -e POSTGRES_USER=nucleos_ci -e POSTGRES_DB=nucleos_ci -e POSTGRES_PASSWORD="$pg_pw" "$PG_IMG" >/dev/null
  docker run -d --name "$PREFIXO-redis" -p 127.0.0.1::6379 -e REDIS_PASSWORD="$redis_pw" "$REDIS_IMG" \
    sh -c 'exec redis-server --requirepass "$REDIS_PASSWORD"' >/dev/null
  docker run -d --name "$PREFIXO-minio" -p 127.0.0.1::9000 \
    -e MINIO_ROOT_USER=nucleosci -e MINIO_ROOT_PASSWORD="$minio_pw" "$MINIO_IMG" \
    server /data --address :9000 >/dev/null
  aguardar postgres docker exec "$PREFIXO-pg" pg_isready -U nucleos_ci -d nucleos_ci
  aguardar redis docker exec -e "REDISCLI_AUTH=$redis_pw" "$PREFIXO-redis" redis-cli ping
  aguardar minio curl -fsS "http://127.0.0.1:$(porta "$PREFIXO-minio" 9000)/minio/health/live"
  local saida="${GITHUB_ENV:-.run/ci-servicos.env}"
  if [ -z "${GITHUB_ENV:-}" ]; then mkdir -p .run; : > "$saida"; chmod 600 "$saida"; fi
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "::add-mask::$pg_pw"; echo "::add-mask::$redis_pw"; echo "::add-mask::$minio_pw"
  fi
  {
    echo "NUCLEOS_CI_PG_URL=postgresql://nucleos_ci:$pg_pw@127.0.0.1:$(porta "$PREFIXO-pg" 5432)/nucleos_ci"
    echo "NUCLEOS_CI_REDIS_URL=redis://:$redis_pw@127.0.0.1:$(porta "$PREFIXO-redis" 6379)/0"
    echo "NUCLEOS_CI_MINIO_ENDPOINT=http://127.0.0.1:$(porta "$PREFIXO-minio" 9000)"
    echo "NUCLEOS_CI_MINIO_USER=nucleosci"
    echo "NUCLEOS_CI_MINIO_PASSWORD=$minio_pw"
  } >> "$saida"
  trap - ERR
  echo "OK: postgres/redis/minio efemeros em 127.0.0.1 (variaveis NUCLEOS_CI_* em ${GITHUB_ENV:+GITHUB_ENV}${GITHUB_ENV:-$saida})"
}

case "${1:-}" in
  up) up ;;
  down) down; echo "OK: servicos auxiliares removidos" ;;
  *) echo "Uso: $0 up|down" >&2; exit 2 ;;
esac
