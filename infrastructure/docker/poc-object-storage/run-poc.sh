#!/usr/bin/env bash
# PoC DEC-009 (ADR-023): MinIO em container efemero (127.0.0.1), sem dados reais, destruido ao final.
# Prova isolamento entre tenants (bucket por tenant, prefixo, credencial temporaria), revogacao,
# versionamento/object lock e criptografia em repouso. Uso: infrastructure/docker/poc-object-storage/run-poc.sh
# Requer docker, node >= 24, openssl. Imagens: MINIO_IMAGE e MC_IMAGE (padrao: ja presentes localmente).
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export POC_TMP POC_PORT POC_CONTAINER POC_VOLUME POC_MC_IMAGE POC_HELPER_IMAGE
POC_TMP="$(mktemp -d)"
POC_CONTAINER="poc-object-storage-$$"
POC_VOLUME="poc-object-storage-vol-$$"
POC_PORT="${POC_PORT:-19000}"
POC_MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"
POC_HELPER_IMAGE="${HELPER_IMAGE:-nginx:1.28-alpine}"
MINIO_IMAGE="${MINIO_IMAGE:-cgr.dev/chainguard/minio:latest}"
SAIDA="$POC_TMP/saida.txt"

limpar() {
  local rc=$?
  docker rm -f -v "$POC_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm -f "$POC_VOLUME" >/dev/null 2>&1 || true
  rm -rf "$POC_TMP"
  echo "== limpeza: container, volume e segredos temporarios removidos (rc=$rc)"
  docker ps -a --filter "name=poc-object-storage" --format 'RESTO: {{.Names}}' || true
  docker volume ls --filter "name=poc-object-storage" --format 'RESTO: {{.Name}}' || true
  exit "$rc"
}
trap limpar EXIT

umask 077
mkdir -p "$POC_TMP/mc" "$POC_TMP/secrets"
ROOT_USER="root$(openssl rand -hex 4)"
ROOT_SECRET="$(openssl rand -hex 20)"
printf '%s' "$ROOT_USER" > "$POC_TMP/secrets/root-user"
printf '%s' "$ROOT_SECRET" > "$POC_TMP/secrets/root-password"
printf 'poc-key:%s' "$(openssl rand -base64 32)" > "$POC_TMP/secrets/kms-key"
chmod 0755 "$POC_TMP" "$POC_TMP/secrets"; chmod 0644 "$POC_TMP"/secrets/*   # efemeros; leitura pelo usuario do container
printf '{"version":"10","aliases":{"local":{"url":"http://127.0.0.1:9000","accessKey":"%s","secretKey":"%s","api":"S3v4","path":"auto"}}}' \
  "$ROOT_USER" "$ROOT_SECRET" > "$POC_TMP/mc/config.json"
chmod 0755 "$POC_TMP/mc"; chmod 0644 "$POC_TMP/mc/config.json"

echo "== imagens"
docker image inspect --format '{{index .RepoTags 0}} {{.Id}}' "$MINIO_IMAGE" "$POC_MC_IMAGE"
docker run --rm "$MINIO_IMAGE" --version | head -n 1
echo "== subindo MinIO (porta somente em 127.0.0.1:$POC_PORT; segredos por arquivo, nao por ambiente)"
docker volume create "$POC_VOLUME" >/dev/null
docker run -d --name "$POC_CONTAINER" -p "127.0.0.1:$POC_PORT:9000" \
  -v "$POC_VOLUME:/data" -v "$POC_TMP/secrets:/run/poc:ro" \
  -e MINIO_ROOT_USER_FILE=/run/poc/root-user -e MINIO_ROOT_PASSWORD_FILE=/run/poc/root-password \
  -e MINIO_KMS_SECRET_KEY_FILE=/run/poc/kms-key -e MINIO_BROWSER=off \
  "$MINIO_IMAGE" server /data --address ":9000" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$POC_PORT/minio/health/ready" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$POC_PORT/minio/health/ready" >/dev/null
echo "== portas publicadas (todas devem ser 127.0.0.1)"
docker port "$POC_CONTAINER"
if docker port "$POC_CONTAINER" | grep -v '127.0.0.1'; then echo "FALHA: porta fora de 127.0.0.1"; exit 1; fi
echo "== env do container nao contem valor de segredo (somente caminhos *_FILE)"
docker inspect "$POC_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'MINIO_' | sed -E 's/=.*_?(\/run\/poc\/.*)$/=\1/'

echo "== PoC"
set +e
node "$AQUI/poc.mjs" 2>&1 | tee "$SAIDA"
rc=${PIPESTATUS[0]}
set -e

echo "== varredura de vazamento: nenhum segredo gerado aparece na saida"
SEGREDOS=("$ROOT_SECRET")
while IFS= read -r s; do [ -n "$s" ] && SEGREDOS+=("$s"); done < "$POC_TMP/segredos.txt"
vazou=0
for s in "${SEGREDOS[@]}"; do grep -qF -- "$s" "$SAIDA" && vazou=1; done
echo "segredos verificados: ${#SEGREDOS[@]}; vazamento: $vazou"
[ "$vazou" -eq 0 ] || rc=1
exit "$rc"
