#!/usr/bin/env bash
# Falha se algum arquivo .env* (exceto .env.example) estiver versionado.
set -euo pipefail
cd "$(dirname "$0")/.."
# Controle de seguranca: sem repositorio git nao ha como verificar; falha fechado.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERRO: check-env requer um repositorio git (git ls-files); arvore sem .git nao e verificavel" >&2
  exit 2
fi
bad=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)
if [ -n "$bad" ]; then
  echo "ERRO: arquivos .env versionados:" >&2
  echo "$bad" >&2
  exit 1
fi
if ! git check-ignore -q .env; then
  echo "ERRO: .env nao esta ignorado pelo .gitignore" >&2
  exit 1
fi
echo "OK: nenhum .env versionado e .env ignorado"
