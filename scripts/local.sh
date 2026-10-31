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

porta_em_escuta() { # 0 se algo ja aceita conexao em 127.0.0.1:$1
  (exec 3<>"/dev/tcp/$HOST_ADDR/$1") 2>/dev/null
}

pgid_de() { ps -o pgid= -p "$1" 2>/dev/null | tr -d ' ' || true; }

up() {
  mkdir -p "$RUN"
  # (a) porta ocupada: falha antes de iniciar qualquer componente.
  ocupada=0
  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port _ <<<"$c"
    if porta_em_escuta "$port"; then
      echo "ERRO: porta $port ($name) ja esta em escuta; libere-a antes de 'up'." >&2
      ocupada=1
    fi
  done
  [ "$ocupada" -eq 0 ] || return 1

  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port cmd <<<"$c"
    HOST=$HOST_ADDR PORT=$port setsid bash -c "exec $cmd" >"$RUN/$name.log" 2>&1 &
    echo $! >"$RUN/$name.pid"
  done

  # (b) so e OK se o PID iniciado segue vivo e o /healthz responde (portas estavam livres).
  falha=0
  for c in "${COMPONENTS[@]}"; do
    IFS=: read -r name port _ <<<"$c"
    pid=$(cat "$RUN/$name.pid")
    ok=0
    for _ in $(seq 1 60); do
      kill -0 "$pid" 2>/dev/null || break
      if curl -fsS "http://$HOST_ADDR:$port/healthz" >/dev/null 2>&1; then ok=1; break; fi
      sleep 1
    done
    if [ "$ok" -eq 1 ] && kill -0 "$pid" 2>/dev/null; then
      continue
    fi
    echo "ERRO: $name (pid $pid) nao ficou saudavel na porta $port; veja $RUN/$name.log" >&2
    falha=1
  done
  if [ "$falha" -ne 0 ]; then down; return 1; fi
  health
}

down() {
  [ -d "$RUN" ] || return 0
  for f in "$RUN"/*.pid; do
    [ -e "$f" ] || continue
    pid=$(cat "$f")
    # (c) so mata se o PID existe e e lider do proprio grupo (criado por setsid).
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && [ "$(pgid_de "$pid")" = "$pid" ]; then
      kill -- "-$pid" 2>/dev/null || true
    fi
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
