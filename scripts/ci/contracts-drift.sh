#!/usr/bin/env bash
# Job contracts-drift (ENT-FND-005): falha se o codigo gerado a partir de packages/contracts
# estiver defasado. O alvo `make contracts-check` pertence a FND-003 (ainda nao entregue).
# Enquanto o alvo nao existir, o job emite aviso explicito (nao silencia) e passa; quando FND-003
# for integrada o job passa a bloquear sem mudar o workflow.
set -euo pipefail
# CONTRACTS_DRIFT_RAIZ permite testar o script em um repositorio descartavel (regressao-ci).
cd "${CONTRACTS_DRIFT_RAIZ:-$(dirname "$0")/../..}"
if make -n contracts-check >/dev/null 2>&1; then
  make contracts-check
  # porcelain cobre modificados E arquivos novos nao rastreados (git diff nao veria estes).
  if [ -n "$(git status --porcelain -- packages/)" ]; then
    git status --porcelain -- packages/ >&2
    echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
    exit 1
  fi
else
  echo "::warning title=contracts-drift::alvo 'make contracts-check' ausente (ENT-FND-003 pendente); gate inativo"
fi
