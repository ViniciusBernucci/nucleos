#!/usr/bin/env bash
# Job build-images (ENT-FND-005): para cada Dockerfile versionado, docker build (hadolint roda no job security) ->
# trivy image (HIGH/CRITICAL bloqueiam) -> SBOM CycloneDX + SARIF em .run/ci-artefatos/.
# Sem Dockerfile no repositorio (estado atual) emite aviso e passa.
set -euo pipefail
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
  nome="$(echo "${df%/*}" | tr '/.' '--' | tr -c 'a-z0-9-\n' '-')"
  tag="nucleos-ci/${nome:-raiz}:${GITHUB_SHA:-local}"
  docker build -f "$df" -t "$tag" "$(dirname "$df")"
  trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
    --format sarif --output "$saida/$nome.sarif" "$tag" || status=1
  trivy image --format cyclonedx --output "$saida/$nome.cdx.json" "$tag"
done
exit "$status"
