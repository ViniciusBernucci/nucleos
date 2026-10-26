# Revalidacao focal r2 - FND-001 (BUG-001)

- Revisor/QA independente (nao implementou); sem edicao de codigo, sem commit.
- Branch `tarefa/fnd-001`, correcao `60d5e5ffe05db1ffc4d1330d3017d0f96e2a3763` (pai `54448cb`). Worktree `/home/vinicius/nucleos-worktrees/tarefa/fnd-001`.
- Origem: `2026-10-25-auditoria-qa-fnd-001.md` (BUG-001, APLICAR).

## Verificacoes proprias

| Item | Resultado |
| --- | --- |
| (a) `git archive 60d5e5f` extraido em dir novo do scratchpad (sem `.git`), `bash scripts/check-no-env.sh` | rc=2, so a mensagem nova "ERRO: check-env requer um repositorio git ...", sem `fatal:` |
| (b) worktree real | `OK: nenhum .env versionado e .env ignorado`, rc=0 |
| (c) `.env` com `git add -f` | rc=1, "arquivos .env versionados: .env"; revertido (`git rm --cached -f` + rm); `git status` limpo |
| (d) `make lint` / `make test` | rc=0 / rc=0; arvore limpa depois |
| (e) escopo do diff 54448cb..60d5e5f | 3 arquivos: `scripts/check-no-env.sh` (+5) e os dois documentos em `documentacoes/engenharia/` (so adicoes, 0 remocoes). Sem mudanca em Makefile, lockfiles ou codigo alheio. NOTA-2 e demais ADIADOS apenas listados como adiados no documento, sem implementacao. |
| (f) honestidade do documento | Registra rc, comandos e reversao do teste; achados adiados preservados com destino. |

## Observacoes menores (nao bloqueantes)

- O documento descreve o teste (a) como extracao via `git ls-files | tar` "incluindo a correcao ainda nao commitada"; a correcao ja esta commitada em 60d5e5f e eu reproduzi com `git archive`. Resultado equivalente, redacao ligeiramente desatualizada.
- O documento diz "SHA em git log" em vez de citar `60d5e5f`.
- A secao "Correcao rodada 2" aparece tanto no documento principal (resumo) quanto no de diffs (patch), coerente com a convencao do projeto.

## Veredito: RESOLVIDO

Sem regressao: caminho feliz e caso negativo (.env versionado) preservados; falha fechada com rc=2 e mensagem verdadeira sem git.
