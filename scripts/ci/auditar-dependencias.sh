#!/usr/bin/env bash
# Varredura de dependencias vulneraveis (ENT-FND-005): pnpm audit, osv-scanner (pnpm-lock + uv.lock)
# e pip-audit. Falha se QUALQUER ferramenta encontrar vulnerabilidade (severidade >= high no pnpm
# audit; qualquer severidade no osv-scanner/pip-audit). Excecoes: osv-scanner.toml, com prazo.
# Uso: scripts/ci/auditar-dependencias.sh [DIRETORIO_RAIZ_COM_LOCKS]   (padrao: raiz do repositorio)
set -uo pipefail
raiz="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$raiz"
status=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "== pnpm audit (>= high)"
pnpm audit --audit-level high || status=1

echo "== osv-scanner (pnpm-lock.yaml, uv.lock)"
osv-scanner scan source --config osv-scanner.toml -L pnpm-lock.yaml -L uv.lock || status=1

echo "== pip-audit (uv export)"
uv export --frozen --all-packages --no-hashes --no-emit-workspace -o "$tmp/requirements.txt" >/dev/null || status=1
# Versao do pip-audit fixada (PyPI, consulta 2026-10-26: 2.10.1, publicada em 2026-06-10).
uvx pip-audit==2.10.1 -r "$tmp/requirements.txt" --no-deps --disable-pip || status=1

exit "$status"
