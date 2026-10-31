#!/usr/bin/env bash
# Varredura de segredos (gitleaks) na arvore de trabalho: arquivos versionados e nao
# ignorados. Falha fechado se o gitleaks nao estiver instalado.
# Uso: scripts/check-secrets.sh            (arvore inteira)
#      scripts/check-secrets.sh --staged   (somente o index; usado pelo hook pre-commit)
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "ERRO: gitleaks nao encontrado no PATH (ver documentacoes/engenharia/ para instalar)" >&2
  exit 2
fi
if [ "${1:-}" = "--staged" ]; then
  exec gitleaks git --pre-commit --staged --config .gitleaks.toml --redact --no-banner
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf - 2>/dev/null | tar -xf - -C "$tmp"
gitleaks dir "$tmp" --config .gitleaks.toml --redact --no-banner
