#!/usr/bin/env bash
# Deploy e rollback por digest de staging/producao (FND-006). Runbook: documentacoes/runbooks/deploy-staging-producao.md
# Uso:  deploy.sh <staging|prod> deploy <repositorio@sha256:digest>
#       deploy.sh <staging|prod> rollback
#       deploy.sh <staging|prod> status
# Ambiente exigido: SECRETS_DIR (diretorio 0700 com database_password 0400, dono = UID do servico).
# Opcionais: API_HOST_PORT, STATE_DIR (padrao .run/deploy), EXTRA_COMPOSE (arquivo extra, SO ensaio local + FND006_ENSAIO=1),
#            READY_TIMEOUT (s, padrao 120). Nunca imprime segredos.
# EXTRA_COMPOSE (overlay de ENSAIO local) e proibido em prod e, em staging, exige FND006_ENSAIO=1.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
env_name="${1:-}"; cmd="${2:-}"; ref="${3:-}"
case "$env_name" in staging|prod) ;; *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;; esac
# Overlay de ensaio nunca entra em producao nem por variavel herdada do shell (REVIEW-002).
if [ -n "${EXTRA_COMPOSE:-}" ]; then
  [ "$env_name" != prod ] || { echo "FALHA: EXTRA_COMPOSE e proibido em prod" >&2; exit 2; }
  [ "${FND006_ENSAIO:-}" = 1 ] || { echo "FALHA: EXTRA_COMPOSE exige FND006_ENSAIO=1 (somente ensaio local)" >&2; exit 2; }
  echo "AVISO: modo de ensaio local (EXTRA_COMPOSE); sem pull e sem exigir dono do segredo" >&2
fi
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

travar() { # um deploy/rollback por ambiente por vez (REVIEW-010)
  exec 9>"$STATE/.lock"
  flock -n 9 || { echo "FALHA: outro deploy/rollback de $env_name em andamento" >&2; exit 1; }
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

ler() { cat "$STATE/$1" 2>/dev/null || true; }

case "$cmd" in
  deploy)
    [[ "$ref" =~ ^[a-z0-9][a-z0-9./_:-]*@sha256:[0-9a-f]{64}$ ]] || { echo "FALHA: informe a imagem como <repositorio>@sha256:<64 hex> (tag nao e aceita)" >&2; exit 2; }
    verificar_segredos
    travar
    # 1. configuracao renderizada obedece a politica (digest, hardening, sem segredo)
    node "$DIR/scripts/verificar-deploy.mjs"
    # 2. puxar o digest (ja verificado no CI: build-images/trivy). Assinatura (cosign) ainda nao adotada.
    if [ -z "${EXTRA_COMPOSE:-}" ]; then docker pull "$ref" >/dev/null || { echo "FALHA: docker pull falhou; estado preservado" >&2; exit 1; }; fi
    # 3. migrar controle: sem migracoes versionadas ainda (DAT-*); o passo falha fechado quando existir e falhar.
    if [ -x "$DIR/scripts/migrar-controle.sh" ]; then "$DIR/scripts/migrar-controle.sh" "$env_name"; else echo "NA: nenhuma migracao de controle versionada ate este ticket"; fi
    atual_antes="$(ler atual)"; anterior_antes="$(ler anterior)"
    # `anterior` so muda se a versao em producao difere da nova (redeploy do mesmo digest e idempotente).
    if [ -n "$atual_antes" ] && [ "$atual_antes" != "$ref" ]; then anterior_novo="$atual_antes"; else anterior_novo="$anterior_antes"; fi
    # 4. subir Postgres (saudavel) e API e 5. verificar readyz; qualquer falha reverte sem gravar `atual`.
    if subir "$ref" && aguardar_pronto; then
      echo "$ref" >"$STATE/atual"
      if [ -n "$anterior_novo" ]; then echo "$anterior_novo" >"$STATE/anterior"; fi
      echo "OK: $env_name em $ref"
    else
      echo "FALHA: subida de $ref ou /readyz falhou; rollback automatico" >&2
      if [ -n "$atual_antes" ] && [ "$atual_antes" != "$ref" ]; then alvo="$atual_antes"; else alvo="$anterior_antes"; fi
      if [ -n "$alvo" ]; then
        if subir "$alvo" && aguardar_pronto; then
          echo "rollback concluido para $alvo" >&2
          if [ "$alvo" != "$atual_antes" ]; then echo "$alvo" >"$STATE/atual"; rm -f "$STATE/anterior"; fi
        else
          echo "ALERTA: rollback tambem falhou" >&2
        fi
      else
        API_IMAGE="$ref" docker compose "${files[@]}" stop api || true
        echo "sem versao anterior: api parada" >&2
      fi
      exit 1
    fi ;;
  rollback)
    verificar_segredos
    travar
    prev="$(ler anterior)"; atual="$(ler atual)"
    [ -n "$prev" ] || { echo "FALHA: nao ha digest anterior registrado em $STATE" >&2; exit 1; }
    subir "$prev" && aguardar_pronto || { echo "FALHA: subida ou /readyz falhou apos rollback" >&2; exit 1; }
    echo "$prev" >"$STATE/atual"; if [ -n "$atual" ]; then echo "$atual" >"$STATE/anterior"; fi
    echo "OK: rollback de $env_name para $prev" ;;
  status)
    echo "atual:    $(ler atual | grep . || echo '-')"
    echo "anterior: $(ler anterior | grep . || echo '-')" ;;
  *) echo "uso: deploy.sh <staging|prod> deploy <ref@sha256:...>|rollback|status" >&2; exit 2 ;;
esac
