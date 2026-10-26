#!/usr/bin/env bash
# PoC DEC-010 (ADR-024): sobe LGTM + gateway em containers descartaveis (127.0.0.1), mede RAM/disco
# com 5 tenants, prova isolamento/redacao e destroi tudo ao final (trap). Sem dados reais.
# Uso (na raiz do repo, com uv no PATH): infrastructure/docker/poc-telemetria/run-poc.sh
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
export POC_TMP
POC_TMP="$(mktemp -d)"
export POC_GATEWAY_PORT="${POC_GATEWAY_PORT:-13100}"
export POC_GRAFANA_PORT="${POC_GRAFANA_PORT:-13000}"
COMPOSE=(docker compose -f "$AQUI/compose.yml")

limpar() {
  local rc=$?
  "${COMPOSE[@]}" down -v --remove-orphans --timeout 5 >/dev/null 2>&1 || true
  rm -rf "$POC_TMP"
  echo "== limpeza: containers/volumes/rede removidos e segredos temporarios apagados (rc=$rc)"
  docker ps -a --filter label=com.docker.compose.project=poc-telemetria --format '{{.Names}}' | sed 's/^/RESTO: /' || true
  exit "$rc"
}
trap limpar EXIT

segredo() { openssl rand -hex 16; }
umask 077
python3 - "$POC_TMP" <<'PY'
import json, secrets, sys
tmp = sys.argv[1]
names = ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e", "admin"]
tokens = {n: secrets.token_hex(16) for n in names}
with open(f"{tmp}/tokens.json", "w", encoding="utf-8") as fh:
    json.dump(tokens, fh)
PY
python3 - "$AQUI/nginx.conf.tpl" "$POC_TMP" <<'PY'
import json, sys
tpl, tmp = sys.argv[1:3]
tokens = json.load(open(f"{tmp}/tokens.json", encoding="utf-8"))
text = open(tpl, encoding="utf-8").read()
for key in "ABCDE":
    text = text.replace(f"@TOKEN_{key}@", tokens[f"tenant-{key.lower()}"])
text = text.replace("@TOKEN_ADMIN@", tokens["admin"])
open(f"{tmp}/nginx.conf", "w", encoding="utf-8").write(text)
PY
segredo > "$POC_TMP/grafana-admin"
chmod 0644 "$POC_TMP/nginx.conf" "$POC_TMP/grafana-admin"   # leitura pelo usuario do container; efemeros

echo "== versoes (imagens fixadas)"
grep -h 'image:' "$AQUI/compose.yml" | sed 's/^ *//'
echo "== subindo (portas somente em 127.0.0.1)"
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 2>&1 | tail -n 12 || true
sleep 20
docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Names}} {{.Status}} {{.Ports}}'
echo "== portas publicadas (todas devem ser 127.0.0.1)"
docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Ports}}' | tr ',' '\n' | grep -- '->' | sed 's/^ *//' || true
if docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Ports}}' | tr ',' '\n' | grep -- '->' | grep -v '127.0.0.1'; then
  echo "FALHA: porta publicada fora de 127.0.0.1"; exit 1
fi

medir() {
  echo "== docker stats ($1)"
  docker stats --no-stream --format '{{.Name}} mem={{.MemUsage}} cpu={{.CPUPerc}}' \
    $(docker ps -q --filter label=com.docker.compose.project=poc-telemetria) | sort
}
medir "ocioso, antes da carga"

echo "== carga e verificacoes (driver Python usando nucleos_observability real)"
cd "$RAIZ"
rc=0
uv run --frozen --all-packages python "$AQUI/poc_telemetria.py" "http://127.0.0.1:$POC_GATEWAY_PORT" "$POC_TMP/tokens.json" || rc=$?
sleep 10
medir "apos carga de 5 tenants"

echo "== disco (KiB) por volume (leitura somente-leitura por container auxiliar efemero)"
for v in loki-data tempo-data prom-data; do
  docker run --rm -v "poc-telemetria_$v:/d:ro" nginx:1.28-alpine du -sk /d | sed "s|/d| $v|"
done
echo "== auditoria do gateway (consultas admin, sem tokens nem corpo de consulta)"
docker compose -f "$AQUI/compose.yml" logs --no-log-prefix gateway 2>/dev/null | grep 'role=admin' | sort | uniq -c | sort -rn | head -n 5
echo "== config de retencao aceita pelo Loki (verify-config) e valores efetivos"
docker compose -f "$AQUI/compose.yml" exec -T loki /usr/bin/loki -config.file=/etc/loki/loki.yaml -verify-config -print-config-stderr 2>&1 \
  | grep -E '^ *(retention_period|retention_enabled|- selector|period: (72h|8760h))' | head -n 12 || true
exit "$rc"
