#!/usr/bin/env bash
# Job contracts-drift (ENT-FND-005 + ENT-FND-003): falha se o codigo gerado a partir de packages/contracts
# estiver defasado. `make contracts-check` (FND-003) regenera TS/SDK/Pydantic em diretorio temporario e
# compara com o versionado, e roda o teste de compatibilidade contra o baseline; aqui ha uma segunda
# barreira: apos o alvo, a arvore de packages/ nao pode ter nenhuma mudanca nem arquivo novo.
# O alvo AUSENTE e erro (o gate nao pode voltar a ser inativo em silencio).
set -euo pipefail
# CONTRACTS_DRIFT_RAIZ permite testar o script em um repositorio descartavel (regressao-ci).
cd "${CONTRACTS_DRIFT_RAIZ:-$(dirname "$0")/../..}"
if ! make -n contracts-check >/dev/null 2>&1; then
  echo "ERRO: alvo 'make contracts-check' ausente; o gate contracts-drift exige o alvo (ENT-FND-003)" >&2
  exit 1
fi
make contracts-check
# porcelain cobre modificados E arquivos novos nao rastreados (git diff nao veria estes).
if [ -n "$(git status --porcelain -- packages/)" ]; then
  git status --porcelain -- packages/ >&2
  echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
  exit 1
fi
