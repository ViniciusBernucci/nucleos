#!/usr/bin/env bash
# Deploy e rollback por digest de staging/producao (FND-006). Runbook: documentacoes/runbooks/deploy-staging-producao.md
# Uso:  deploy.sh <staging|prod> deploy <repositorio@sha256:digest>
#       deploy.sh <staging|prod> rollback
#       deploy.sh <staging|prod> status
# Ambiente exigido: SECRETS_DIR (diretorio 0700 com database_password 0400, dono = UID do servico).
# Opcionais: API_HOST_PORT, STATE_DIR (padrao .run/deploy), EXTRA_COMPOSE (arquivo extra, SO para ensaio local),
#            READY_TIMEOUT (s, padrao 120). Nunca imprime segredos.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
env_name="${1:-}"; cmd="${2:-}"; ref="${3:-}"
case "$env_name" in staging|prod) ;; *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;; esac
STATE="${STATE_DIR:-$ROOT/.run/deploy}/$env_name"
mkdir -p "$STATE"
files=(-f "$DIR/compose.deploy.yml" -f "$DIR/compose.$env_name.yml")
[ -n "${EXTRA_COMPOSE:-}" ] && files+=(-f "$EXTRA_COMPOSE")
: "${SECRETS_DIR:?informe SECRETS_DIR}"
port="${API_HOST_PORT:-3001}"

verificar_segredos() {
  local f="$SECRETS_DIR/database_password" modo dono
  [ -f "$f" ] && [ ! -L "$f" ] || { echo "FALHA: segredo database_password ausente em SECRETS_DIR" >&2; exit 1; }
  modo="$(stat -c '%a' "$f")"; dono="$(stat -c '%u' "$f")"
  [ "$modo" = "400" ] || { echo "FALHA: database_password deve ter modo 0400 (atual $modo)" >&2; exit 1; }
  [ "$dono" = "${API_UID:-10001}" ] || [ -n "${EXTRA_COMPOSE:-}" ] || { echo "FALHA: database_password deve pertencer ao UID do servico" >&2; exit 1; }
}

subir() { # $1 = referencia com digest
  API_IMAGE="$1" docker compose "${files[@]}" up -d --remove-orphans
}

aguardar_pronto() {
  local i
  for i in $(seq 1 "${READY_TIMEOUT:-120}"); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$port/readyz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

case "$cmd" in
  deploy)
    [[ "$ref" =~ ^[a-z0-9][a-z0-9./_:-]*@sha256:[0-9a-f]{64}$ ]] || { echo "FALHA: informe a imagem como <repositorio>@sha256:<64 hex> (tag nao e aceita)" >&2; exit 2; }
    verificar_segredos
    # 1. configuracao renderizada obedece a politica (digest, hardening, sem segredo)
    node "$DIR/scripts/verificar-deploy.mjs"
    # 2. puxar o digest (ja verificado no CI: build-images/trivy). Assinatura (cosign) ainda nao adotada.
    if [ -z "${EXTRA_COMPOSE:-}" ]; then docker pull "$ref" >/dev/null; fi
    # 3. migrar controle: sem migracoes versionadas ainda (DAT-*); o passo falha fechado quando existir e falhar.
    if [ -x "$DIR/scripts/migrar-controle.sh" ]; then "$DIR/scripts/migrar-controle.sh" "$env_name"; else echo "NA: nenhuma migracao de controle versionada ate este ticket"; fi
    # 4. subir API (postgres antes, saudavel) e 5. verificar readyz
    [ -f "$STATE/atual" ] && cp "$STATE/atual" "$STATE/anterior"
    subir "$ref"
    if aguardar_pronto; then
      echo "$ref" >"$STATE/atual"
      echo "OK: $env_name em $ref"
    else
      echo "FALHA: /readyz nao respondeu em ${READY_TIMEOUT:-120}s; rollback automatico" >&2
      if [ -f "$STATE/anterior" ]; then
        subir "$(cat "$STATE/anterior")"; aguardar_pronto && echo "rollback concluido para $(cat "$STATE/anterior")" >&2 || echo "ALERTA: rollback tambem falhou" >&2
      else
        API_IMAGE="$ref" docker compose "${files[@]}" stop api
        echo "sem versao anterior: api parada" >&2
      fi
      exit 1
    fi ;;
  rollback)
    verificar_segredos
    [ -f "$STATE/anterior" ] || { echo "FALHA: nao ha digest anterior registrado em $STATE" >&2; exit 1; }
    prev="$(cat "$STATE/anterior")"; atual="$(cat "$STATE/atual" 2>/dev/null || true)"
    subir "$prev"
    aguardar_pronto || { echo "FALHA: /readyz nao respondeu apos rollback" >&2; exit 1; }
    echo "$prev" >"$STATE/atual"; [ -n "$atual" ] && echo "$atual" >"$STATE/anterior"
    echo "OK: rollback de $env_name para $prev" ;;
  status)
    echo "atual:    $(cat "$STATE/atual" 2>/dev/null || echo '-')"
    echo "anterior: $(cat "$STATE/anterior" 2>/dev/null || echo '-')" ;;
  *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;;
esac
