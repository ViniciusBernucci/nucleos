#!/usr/bin/env bash
# Valida o nome da branch atual (ver documentacoes/engenharia/convencoes-commits-e-branches.md).
set -euo pipefail
branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
if [ "$branch" = "HEAD" ]; then exit 0; fi # HEAD destacado (rebase, CI)
if [[ "$branch" =~ ^(main|developer|tarefa/[a-z0-9][a-z0-9-]*|revisao/[a-z0-9][a-z0-9._-]*|hotfix/[a-z0-9][a-z0-9-]*)$ ]]; then
  exit 0
fi
echo "ERRO: nome de branch invalido: $branch" >&2
echo "Permitidos: main, developer, tarefa/<id-em-kebab>, revisao/<lote>, hotfix/<slug>" >&2
exit 1
