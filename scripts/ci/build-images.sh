#!/usr/bin/env bash
# Job build-images (ENT-FND-005): para cada Dockerfile versionado, docker build (hadolint roda no job
# security) -> trivy image (HIGH/CRITICAL bloqueiam) -> SBOM CycloneDX + SARIF em .run/ci-artefatos/.
# Sem Dockerfile no repositorio (estado atual) emite aviso e passa.
# Uso: scripts/ci/build-images.sh | scripts/ci/build-images.sh --nome <caminho/do/Dockerfile>
set -euo pipefail

# Nome unico e valido para tag/arquivo: caminho em minusculas + sufixo do Dockerfile + hash do caminho.
nome_artefato() {
  local df="$1" dir base sufixo="" slug hash
  dir="$(dirname "$df")"
  base="$(basename "$df")"
  base="${base,,}"
  case "$base" in
    dockerfile.*) sufixo="-${base#dockerfile.}" ;;
    *.dockerfile) sufixo="-${base%.dockerfile}" ;;
  esac
  slug="$(echo "${dir,,}" | tr -c 'a-z0-9\n' '-' | sed 's/^-*//; s/-*$//')"
  [ "$dir" = "." ] && slug="raiz"
  hash="$(printf '%s' "$df" | sha1sum | cut -c1-6)"
  echo "${slug:-raiz}$(echo "$sufixo" | tr -c 'a-z0-9\n-' '-')-$hash"
}

if [ "${1:-}" = "--nome" ]; then
  nome_artefato "$2"
  exit 0
fi

cd "$(dirname "$0")/../.."
saida=".run/ci-artefatos"
mkdir -p "$saida"
mapfile -t dockerfiles < <(git ls-files '*Dockerfile' '*Dockerfile.*' '*.Dockerfile' | grep -v '^tools/qualidade/regressao-ci/' || true)
if [ "${#dockerfiles[@]}" -eq 0 ]; then
  echo "::warning title=build-images::nenhum Dockerfile versionado; nada a construir/escanear"
  exit 0
fi
status=0
for df in "${dockerfiles[@]}"; do
  nome="$(nome_artefato "$df")"
  tag="nucleos-ci/$nome:${GITHUB_SHA:-local}"
  docker build -f "$df" -t "$tag" "$(dirname "$df")"
  trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
    --format sarif --output "$saida/$nome.sarif" "$tag" || status=1
  trivy image --format cyclonedx --output "$saida/$nome.cdx.json" "$tag"
done
exit "$status"
