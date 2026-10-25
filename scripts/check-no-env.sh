#!/usr/bin/env bash
# Falha se algum arquivo .env* (exceto .env.example) estiver versionado.
set -euo pipefail
cd "$(dirname "$0")/.."
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
