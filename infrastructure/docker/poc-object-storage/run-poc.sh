#!/usr/bin/env bash
# PoC DEC-009 (ADR-023): MinIO em container efemero (127.0.0.1), sem dados reais, destruido ao final.
# Prova isolamento entre tenants (bucket por tenant, prefixo, credencial temporaria), revogacao,
# versionamento/object lock e criptografia em repouso. Uso: infrastructure/docker/poc-object-storage/run-poc.sh
# Segredos do host em 0700/0600; o MinIO le uma copia 0400 (uid 65532) em volume proprio. Imagens so locais (--pull=never).
# Requer docker, node >= 24, openssl. Imagens: MINIO_IMAGE e MC_IMAGE (padrao: ja presentes localmente).
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export POC_TMP POC_PORT POC_CONTAINER POC_VOLUME POC_MC_IMAGE POC_HELPER_IMAGE
POC_TMP="$(mktemp -d)"
POC_CONTAINER="poc-object-storage-$$"
POC_VOLUME="poc-object-storage-vol-$$"
SEC_VOLUME="poc-object-storage-sec-$$"
POC_PORT="${POC_PORT:-19000}"
POC_MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"
POC_HELPER_IMAGE="${HELPER_IMAGE:-nginx:1.28-alpine}"
MINIO_IMAGE="${MINIO_IMAGE:-cgr.dev/chainguard/minio:latest}"
SAIDA="$POC_TMP/saida.txt"

limpar() {
  local rc=$?
  docker rm -f -v "$POC_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm -f "$POC_VOLUME" "$SEC_VOLUME" >/dev/null 2>&1 || true
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
printf '{"version":"10","aliases":{"local":{"url":"http://127.0.0.1:9000","accessKey":"%s","secretKey":"%s","api":"S3v4","path":"auto"}}}' \
  "$ROOT_USER" "$ROOT_SECRET" > "$POC_TMP/mc/config.json"
chmod 0700 "$POC_TMP" "$POC_TMP/secrets" "$POC_TMP/mc"; chmod 0600 "$POC_TMP"/secrets/* "$POC_TMP/mc/config.json"

echo "== imagens (sem pull: a imagem precisa existir localmente)"
for img in "$MINIO_IMAGE" "$POC_MC_IMAGE" "$POC_HELPER_IMAGE"; do
  docker image inspect --format '{{index .RepoTags 0}} {{.Id}}' "$img" 2>/dev/null \
    || { echo "FALHA: imagem ausente localmente: $img (este PoC usa --pull=never; faca o pull manualmente ou informe MINIO_IMAGE/MC_IMAGE/HELPER_IMAGE)"; exit 1; }
done
docker run --rm --pull=never "$MINIO_IMAGE" --version | head -n 1
echo "== preparando segredos para o usuario do container (volume proprio, 0400 para uid 65532; arquivos do host ficam 0600)"
docker volume create "$SEC_VOLUME" >/dev/null
docker run --rm --pull=never --user 0 -v "$SEC_VOLUME:/dst" -v "$POC_TMP/secrets:/src:ro" "$POC_HELPER_IMAGE" \
  sh -c 'cp /src/* /dst/ && chown 65532:65532 /dst /dst/* && chmod 0500 /dst && chmod 0400 /dst/*'
echo "== modos no host (nenhum legivel por 'outros'):"
ls -ld "$POC_TMP" "$POC_TMP/secrets" "$POC_TMP/mc" | awk '{print $1, "dir"}'
ls -l "$POC_TMP/secrets" "$POC_TMP/mc/config.json" | awk 'NR>1 && $1!="" {print $1}' | sort | uniq -c
if find "$POC_TMP" -perm /o+rwx | grep -q .; then echo "FALHA: arquivo/dir acessivel por outros em $POC_TMP"; exit 1; fi
echo "== subindo MinIO (porta somente em 127.0.0.1:$POC_PORT; segredos por arquivo, nao por ambiente)"
docker volume create "$POC_VOLUME" >/dev/null
docker run -d --pull=never --name "$POC_CONTAINER" -p "127.0.0.1:$POC_PORT:9000" \
  -v "$POC_VOLUME:/data" -v "$SEC_VOLUME:/run/poc:ro" \
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
KMS_VALOR="$(cut -d: -f2- "$POC_TMP/secrets/kms-key")"
SEGREDOS=("$ROOT_SECRET" "$KMS_VALOR" "$(cat "$POC_TMP/secrets/kms-key")")
while IFS= read -r s; do [ -n "$s" ] && SEGREDOS+=("$s"); done < "$POC_TMP/segredos.txt"
vazou=0
for s in "${SEGREDOS[@]}"; do grep -qF -- "$s" "$SAIDA" && vazou=1; done
echo "segredos verificados: ${#SEGREDOS[@]}; vazamento: $vazou"
[ "$vazou" -eq 0 ] || rc=1
exit "$rc"
