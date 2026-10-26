#!/usr/bin/env bash
# Job contracts-drift (ENT-FND-005): falha se o codigo gerado a partir de packages/contracts
# estiver defasado. O alvo `make contracts-check` pertence a FND-003 (ainda nao entregue).
# Enquanto o alvo nao existir, o job emite aviso explicito (nao silencia) e passa; quando FND-003
# for integrada o job passa a bloquear sem mudar o workflow.
set -euo pipefail
cd "$(dirname "$0")/../.."
if make -n contracts-check >/dev/null 2>&1; then
  make contracts-check
  git diff --exit-code -- packages/ || {
    echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
    exit 1
  }
else
  echo "::warning title=contracts-drift::alvo 'make contracts-check' ausente (ENT-FND-003 pendente); gate inativo"
fi
