# Revalidacao focal r1 — FND-005 (CI bloqueante), perfil CRITICO

Data: 2026-10-26. Revisor independente (sessao nova; nao implementou). Modo: revalidacao focal (skill revisor-de-codigo).

- Worktree/branch: `/home/vinicius/nucleos-worktrees/tarefa/fnd-005`, `tarefa/fnd-005`. Escopo: `git diff cb2e3da..HEAD` (HEAD = `8e7dfa7`; codigo em `808184b`, registro/diffs em `8e7dfa7`). Arvore limpa no inicio.
- IDs revisados (APLICADOS na auditoria `13cfc1b`): REVIEW-001, 002, 004, 005, 006. ADIAR/REJEITAR nao reavaliados, apenas checado que nao foram tocados.
- Veredito: **APPROVED WITH NOTES** (todos os IDs aplicados CORRIGIDOS; 1 nota BAIXA de registro).

## Verificacoes executadas

| Verificacao | Resultado |
| --- | --- |
| `make lint-workflows` | OK (actionlint + politica, 2 workflows) |
| `make ci-regressao` (com rede) | todos os casos falham como esperado, inclusive os novos |
| `CI_REGRESSAO_OFFLINE=1 make ci-regressao` | idem; casos de dependencia vulneravel em SKIP; os novos (PATH, drift, nomes, fixtures) rodam offline |
| `make lint`, `make test` | passaram (18 testes Python) |
| REVIEW-001 original: `PATH=/usr/bin:/bin:<node>` sem `.run/bin` | `auditar-dependencias.sh` e `check-licenses.mjs` saem rc=1 com `ERRO: ferramenta ausente no PATH: pnpm ...` (antes: `pnpm: command not found` / `undefined`) |
| Simulacao da action: `echo "$GITHUB_WORKSPACE/.run/bin" >> $GITHUB_PATH` em arquivo temporario | grava o caminho absoluto correto; com ele no PATH, `pnpm` resolve para `.run/bin/pnpm` (12.15.0) |
| Scripts com PATH completo | `pnpm audit` volta a executar e acusa `multer` (GHSA-q7qp-rjg7-q26m), rc=1; licencas: 183 pacotes OK |
| Diff vs. escopo protegido | `apps/`, `package.json`, `osv-scanner.toml`, lockfiles: sem alteracao em `cb2e3da..HEAD`; nenhum `ignore`/`multer` introduzido no script de auditoria |
| `uv 0.13.5` | e a versao local; a tag existe na API de releases de `astral-sh/uv` (consulta 2026-10-26) |
| Fidelidade dos diffs | `git diff 13cfc1b..808184b` (335 linhas) esta contido literalmente na secao final de `...-ci-bloqueante-diffs.md` (0 linhas ausentes) |
| CRLF | `CLAUDE.md` (212) e `AGENTS.md` (222) mantem CRLF; nenhum arquivo de codigo/CI da correcao tem CR; as 36 CR do arquivo de diffs sao identicas as de `cb2e3da` (patches de arquivos CRLF), nao nova |

Nao executado: workflow em runner GitHub (sem push/PR); `docker build`.

## Classificacao por ID

| ID | Classificacao | Evidencia |
| --- | --- | --- |
| REVIEW-001 | **CORRIGIDO** | Action `preparar` exporta `.run/bin` ao `GITHUB_PATH` (so `$GITHUB_WORKSPACE`, variavel de shell, sem `${{ }}` de dados do usuario: sem injecao; passo roda apos `make setup`, que cria o shim). Scripts falham de forma explicita sem a ferramenta; 2 casos de regressao novos (online e offline). `check-licenses` tambem trata erro de `coletar()` sem stack trace. |
| REVIEW-002 | **CORRIGIDO** (parte APLICAR) | `git status --porcelain -- packages/` cobre novos e modificados; 3 casos em repo descartavel (novo falha, modificado falha, limpo passa). Orientacao de nao marcar `contracts-drift`/`build-images` como required esta no registro. Inatividade segue ADIADA (declarada). |
| REVIEW-004 | **CORRIGIDO** (parte APLICAR) | `version: "0.13.5"` no `setup-uv`; tag confirmada; uso em runner nao exercitado (declarado). Hashes do pip-audit seguem adiados. |
| REVIEW-005 | **CORRIGIDO** (parte APLICAR) | Regex cobre `inputs.`, `steps.<id>.outputs.` e `secrets[`; 3 fixtures falham com a mensagem certa; `ci.yml` real segue conforme. Restante adiado, sem alteracao. |
| REVIEW-006 | **CORRIGIDO** (parte APLICAR) | `--nome Dockerfile` -> `raiz-6651dd`; `apps/api/Dockerfile.worker` -> `apps-api-worker-9c4b09`; caso valida 5 caminhos (raiz, subpasta, sufixo, extensao, maiuscula) unicos e `^[a-z0-9][a-z0-9-]*$`. Contexto de build segue adiado. |

Gate `multer` nao enfraquecido: o `pnpm audit` continua falhando por `multer` e nenhum ignore/excecao foi adicionado.

## Novos achados

### REV-001 — BAIXO — Registro superestima o numero de casos novos
- Local: `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`, secao "Validacoes da rodada 1" ("inclui os 11 novos").
- Evidencia: o diff do runner adiciona 9 casos (3 fixtures de workflow + 2 de PATH + 3 de drift + 1 de nomes). Nao ha impacto funcional; e imprecisao de contagem num registro que deve ser real.
- Correcao sugerida: trocar "11" por "9" (ou remover o numero).

### Observacoes (sem severidade)
- O caso de PATH cobre somente a ausencia de `pnpm` (primeira verificacao); `uv`, `uvx` e `osv-scanner` ausentes tem a mesma guarda mas sem teste proprio. Aceitavel.
- Nao ha mudanca em CLAUDE.md/AGENTS.md/lessons nesta rodada (nao havia conceito novo); coerente com o registro.

## Riscos residuais
- Workflow e action ainda nao executados em runner real (PATH via `GITHUB_PATH`, `setup-uv` fixado): provado apenas por simulacao local.
- `multer` continua como decisao humana (gate `security` falha ate la, por design).
