#!/usr/bin/env bash
# Smoke do ambiente de desenvolvimento (FND-004): pg_isready, redis-cli ping, mc ls, curl.
# Uso: scripts/smoke.sh [--runtime] [--observability]   Falha (rc != 0) se algum item falhar.
set -uo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
[ -r "$DIR/.env.local" ] || { echo "FALHA: .env.local ausente; rode 'make compose-up'" >&2; exit 2; }
set -a; . "$DIR/.env.local"; set +a
DC=(docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability)
H=127.0.0.1
fail=0
ok() { echo "OK    $1"; }
ko() { echo "FALHA $1"; fail=1; }
chk() { local nome=$1; shift; if "$@" >/dev/null 2>&1; then ok "$nome"; else ko "$nome"; fi; }

chk "postgres pg_isready" "${DC[@]}" exec -T postgres pg_isready -U nucleos_dev -d nucleos_dev
n=$("${DC[@]}" exec -T postgres psql -U nucleos_dev -d nucleos_dev -Atc "select count(*) from dev_seed.organizacoes" 2>/dev/null)
[ "$n" = "3" ] && ok "postgres seed (3 organizacoes)" || ko "postgres seed (obtido: '$n')"
v=$("${DC[@]}" exec -T postgres psql -U nucleos_dev -d nucleos_dev -Atc "select slug from dev_seed.organizacoes order by embedding <-> '[0.1,0.2,0.3]' limit 1" 2>/dev/null)
[ "$v" = "org-exemplo-a" ] && ok "pgvector (vizinho mais proximo deterministico)" || ko "pgvector (obtido: '$v')"
p=$("${DC[@]}" exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping' 2>/dev/null | tr -d '\r')
[ "$p" = "PONG" ] && ok "redis-cli ping" || ko "redis-cli ping ('$p')"
r=$("${DC[@]}" exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli get dev:seed:contador' 2>/dev/null | tr -d '\r')
[ "$r" = "42" ] && ok "redis seed" || ko "redis seed ('$r')"
chk "redis exige senha" bash -c "! ( exec 3<>/dev/tcp/$H/${REDIS_HOST_PORT:-16379}; printf 'PING\r\n' >&3; timeout 2 head -n1 <&3 | grep -q PONG )"
m=$("${DC[@]}" run --rm --no-deps minio-init ls local/nucleos-dev-seed 2>/dev/null)
echo "$m" | grep -q bem-vindo.txt && ok "minio mc ls (bem-vindo.txt)" || ko "minio mc ls"
chk "minio health (curl)" curl -fsS "http://$H:${MINIO_HOST_PORT:-19000}/minio/health/live"
chk "minio console (curl)" curl -fsS -o /dev/null "http://$H:${MINIO_CONSOLE_HOST_PORT:-19001}/"
chk "mailpit UI/API (curl)" curl -fsS "http://$H:${MAILPIT_UI_HOST_PORT:-18025}/api/v1/info"
chk "proxy /healthz (curl)" curl -fsS "http://$H:${PROXY_HOST_PORT:-18080}/healthz"
chk "proxy -> mailpit (Host mail.localhost)" curl -fsS -H "Host: mail.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/v1/info"
chk "proxy -> minio console (Host minio.localhost)" curl -fsS -o /dev/null -H "Host: minio.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/"
for a in "$@"; do
  case "$a" in
    --runtime)
      # INT-002: /healthz de CADA servico runtime, de dentro do container (nao publicam portas); falha se cair.
      for sv in tenant-runtime:8001 ai-gateway:8002 tool-gateway:8003 event-dispatcher:8004; do
        chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:${sv##*:}/healthz', timeout=3)"
      done
      for sv in api:3001 web:3000 tenant-provisioner:3002; do
        chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" node -e "fetch('http://127.0.0.1:${sv##*:}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      done
      chk "proxy -> api /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/healthz"
      chk "proxy -> web /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/healthz" ;;
    --observability) chk "otel-collector health_check" curl -fsS "http://$H:${OTEL_HEALTH_HOST_PORT:-13133}/" ;;
  esac
done
"$DIR/scripts/verificar-lan.sh" || fail=1
[ "$fail" -eq 0 ] && echo "SMOKE OK" || echo "SMOKE COM FALHAS"
exit "$fail"
