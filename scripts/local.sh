#!/usr/bin/env bash
# Sobe/derruba/verifica todos os componentes localmente (somente 127.0.0.1).
# Uso: scripts/local.sh up|down|health   (substituido por Docker Compose em FND-004)
set -euo pipefail
cd "$(dirname "$0")/.."
RUN=.run
HOST_ADDR=127.0.0.1
export PATH="$PWD/.run/bin:$PATH"
PNPM=${PNPM:-pnpm}
UV=${UV:-uv}

# nome:porta:comando
COMPONENTS=(
  "web:3000:$PNPM --filter @nucleos/web start"
  "api:3001:node apps/api/dist/main.js"
  "tenant-provisioner:3002:node apps/tenant-provisioner/dist/main.js"
  "tenant-runtime:8001:$UV run --frozen --package nucleos-tenant-runtime python -m tenant_runtime"
  "ai-gateway:8002:$UV run --frozen --package nucleos-ai-gateway python -m ai_gateway"
  "tool-gateway:8003:$UV run --frozen --package nucleos-tool-gateway python -m tool_gateway"
  "event-dispatcher:8004:$UV run --frozen --package nucleos-event-dispatcher python -m event_dispatcher"
)

up() {
  mkdir -p "$RUN"
  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port cmd <<<"$c"
    HOST=$HOST_ADDR PORT=$port setsid bash -c "exec $cmd" >"$RUN/$name.log" 2>&1 &
    echo $! >"$RUN/$name.pid"
  done
  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port _ <<<"$c"
    for _ in $(seq 1 60); do
      curl -fsS "http://$HOST_ADDR:$port/healthz" >/dev/null 2>&1 && break
      sleep 1
    done
  done
  health
}

down() {
  [ -d "$RUN" ] || exit 0
  for f in "$RUN"/*.pid; do
    [ -e "$f" ] || continue
    pid=$(cat "$f")
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    rm -f "$f"
  done
}

health() {
  rc=0
  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port _ <<<"$c"
    if out=$(curl -fsS "http://$HOST_ADDR:$port/healthz"); then
      echo "OK   $name :$port $out"
    else
      echo "FAIL $name :$port"; rc=1
    fi
  done
  return $rc
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  health) health ;;
  *) echo "uso: $0 up|down|health" >&2; exit 2 ;;
esac
