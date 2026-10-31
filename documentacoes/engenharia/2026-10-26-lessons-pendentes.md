# Lessons pendentes de FND-002, FND-004 e FND-009 (2026-10-26)

## Metadados

- **Dominio:** engenharia (trilha didatica `lessons/`)
- **Solicitacao:** tarefa local de documentacao (perfil simples) do lote 2026-10-25-ep00-ep01-fundacao: criar as lessons pendentes de FND-002 (qualidade estatica), FND-004 (Docker Compose local) e FND-009 (observabilidade), reordenando a trilha por dependencia pedagogica.
- **Branch:** `tarefa/lessons-pendentes` (worktree `../nucleos-worktrees/tarefa/lessons-pendentes`); **base/HEAD inicial:** `9214e5bb63560f41af881c0227df951d353f9239` (arvore limpa; branch `revisao/2026-10-25-ep00-ep01-fundacao`).
- **Estado:** concluida; aguarda revisao independente (nao revisada pelo executor).
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador do lote.

## Objetivo, contexto e escopo

As entregas FND-002, FND-004 e FND-009 exercitam conceitos relevantes (ESLint type-aware/ruff/mypy/arquitetura de imports; Compose; logging estruturado e redacao) e o fechamento do lote deixou a criacao das lessons como pendencia real (secoes "Atualizacao no fechamento do lote" de cada registro). Escopo: criar as 3 lessons, renumerar as existentes quando a ordem pedagogica exigir, atualizar indice e links e encerrar as pendencias nos registros. Fora do escopo: qualquer alteracao de codigo, testes, configuracao, banco ou infraestrutura; revisao da propria entrega; push/PR.

## Resumo da implementacao

Nova ordem (dependencia de aprendizagem): 00 Migracoes, 01 Sessao opaca, **02 Qualidade estatica** (nova), **03 Docker Compose** (nova), 04 CI (era 02), **05 Logs estruturados/correlation ID/redacao** (nova), 06 Isolamento de telemetria (era 03). Justificativa: o CI repete os alvos `make lint*` (02) e sobe servicos com Compose (03), logo vem depois; a lesson de telemetria por tenant assume dado redigido na origem (05) e referencia Compose (03), logo vem por ultimo. Nenhum codigo foi tocado.

## Mudancas por arquivo

- Novas: `lessons/02 - Qualidade estatica em TypeScript e Python.md`, `lessons/03 - Docker Compose para ambiente local.md`, `lessons/05 - Logs estruturados, correlation ID e redacao por allowlist.md`.
- Renomeadas (`git mv`, conteudo conceitual preservado; so titulo, cabecalho de data e pre-requisitos): `lessons/02 - CI bloqueante e cadeia de suprimentos.md` -> `lessons/04 - CI bloqueante e cadeia de suprimentos.md`; `lessons/03 - Isolamento de telemetria por tenant.md` -> `lessons/06 - Isolamento de telemetria por tenant.md` (a nota "FND-009 sem lesson" agora aponta para as lessons 05 e 03).
- Indice: `lessons/README.md` (ordem, pre-requisitos por lesson, nota de renumeracao).
- Links atualizados para os nomes novos: `documentacoes/arquitetura/adr/0024-stack-de-telemetria-e-politica-de-reducao-retencao.md`, `documentacoes/observabilidade/2026-10-26-dec-010-telemetria.md` (inclui "Atualizacao" na secao Lessons), `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`, `documentacoes/reviews/2026-10-26-review-dec-010.md`, `documentacoes/reviews/2026-10-26-auditoria-dec-010.md` (apenas caminhos de arquivo citados).
- Pendencias encerradas ("Atualizacao no fechamento do lote" com link para a lesson): registros de FND-002, FND-004 e FND-009; nota equivalente em `documentacoes/planejamento-ia/revisao-humana-2026-10-26-ep00-ep01-fundacao.md`.
- Indice de engenharia: `documentacoes/engenharia/README.md`. Este documento.
- Testes/configuracoes/migracoes: nenhum.

## Decisoes tecnicas

- Renumerar em vez de apendar as novas lessons ao final: a regra do `CLAUDE.md` ordena por dependencia, nao por data. Consequencia: duas lessons mudam de numero; mitigada atualizando todos os links e deixando nota de renumeracao no indice e na dec-010.
- Relatorios de review/auditoria antigos tiveram so os caminhos citados atualizados, para nao deixar nomes antigos; as demais mencoes textuais a "lesson 03" nesses relatorios historicos permanecem como registro do estado revisado.
- Os exemplos que dependem de configuracao do repositorio (ESLint, ruff, depcruise, observabilidade) sao rodados dentro da raiz, com arquivos temporarios removidos ao final, em vez de reimplementar a configuracao em exemplos soltos.

## Validacoes (reais, 2026-10-26; PATH com Node 24.22.1 e `~/.local/bin`, shims do `pnpm` em `.run/bin`)

| Verificacao | Resultado |
| --- | --- |
| `make setup` e `make build` na worktree | OK |
| Lesson 02: ESLint em `packages/sdk/src/exemplo-lesson.ts` com `JSON.parse` | exit 1; `no-unsafe-assignment`, `no-unsafe-return`, `no-unsafe-member-access`; versao com `unknown` estreitado: exit 0 |
| Lesson 02: ruff/mypy em arquivo temporario de `tool-gateway` | ruff `S307` e `S602`; mypy `no-untyped-def`; versao corrigida: ruff, `ruff format --check` e mypy OK |
| Lesson 02: `pnpm run lint:arch` com import web->api | `web-nao-importa-api` e `apps-nao-importam-outros-apps`, exit 2 |
| Lesson 02: `uv run --frozen lint-imports` com `import ai_gateway` em `tool_gateway` | `1 kept, 1 broken` |
| Lesson 02: `gitleaks dir` com segredo sintetico gerado na hora; `check-commit-msg.mjs` | `leaks found: 1` (rc 1); `ajustes` rejeitado (rc 1), `feat(api): x` aceito (rc 0) |
| Lesson 02: `make lint-regressao` | 18 casos OK; "controles ativos" |
| Lesson 03: Compose descartavel (`redis:8.8.3-alpine`, projeto `licao-compose`, porta `127.0.0.1:19379`) | perfis, `${VAR:?}`, healthy, `ss` so em 127.0.0.1, `-NOAUTH` sem senha, `PONG` do cliente; `down -v` sem sobras |
| Lesson 03: `docker compose config --services` no `compose.dev.yml` real com env ficticio | `core` lista os 7 servicos; `observability` lista `otel-collector`; `runtime` sozinho invalido (depende de `redis`) |
| Lesson 05: exemplo TS (`node packages/observability/exemplo-lesson.ts`) e `tsc --strict` | `ok`; tsc rc 0 |
| Lesson 05: exemplo Python (`uv run --frozen python ...`) e `mypy --strict` | `ok`; mypy sem erros |
| Lesson 05: `pnpm --filter @nucleos/observability test`; `pytest packages/observability-py` | 14 pass / 0 fail; 14 passed |
| Links relativos de `lessons/*.md` e de `documentacoes/` para `lessons/` | todos resolvem; `grep` sem referencias aos nomes `02 - CI`, `03 - Isolamento` e variantes URL-encoded |

Nao executado: `make lint`/`make test` completos (nenhum codigo ou configuracao alterado); `make compose-up`/`compose-smoke` do projeto real (o exemplo da lesson usa Compose proprio; o arquivo real foi so validado com `config`); `lefthook install` (compartilha `.git` entre worktrees). Os exemplos criaram arquivos temporarios dentro do repositorio e todos foram removidos (`git status` so mostra os arquivos desta entrega).

## Impactos, riscos e rollback

Somente documentacao. Risco: links externos ao repositorio que apontem para os nomes antigos `02`/`03` (nao encontrados). Rollback: reverter o commit.

## Commits e diffs

Nenhum codigo, teste ou configuracao alterado, portanto nao ha diff de codigo a reproduzir. Pela regra anti-recursao, os diffs de `lessons/` e `documentacoes/` nao sao incluidos; os arquivos estao listados em "Mudancas por arquivo". Commit local unico em `tarefa/lessons-pendentes` sobre `9214e5b` (o SHA nao pode constar no proprio commit; consulte `git log --oneline -1 tarefa/lessons-pendentes`).

## Lessons

- [02 - Qualidade estatica em TypeScript e Python](../../lessons/02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md)
- [03 - Docker Compose para ambiente local](../../lessons/03%20-%20Docker%20Compose%20para%20ambiente%20local.md)
- [05 - Logs estruturados, correlation ID e redacao por allowlist](../../lessons/05%20-%20Logs%20estruturados%2C%20correlation%20ID%20e%20redacao%20por%20allowlist.md)
- Renumeradas: [04 - CI bloqueante e cadeia de suprimentos](../../lessons/04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md), [06 - Isolamento de telemetria por tenant](../../lessons/06%20-%20Isolamento%20de%20telemetria%20por%20tenant.md)
- [Indice](../../lessons/README.md)

## Pendencias

Nenhuma conhecida. Lacunas honestas: a lesson 03 nao exercita `make compose-up` do projeto real (so `config`); a lesson 02 nao exercita `lefthook install`; o exemplo de allowlist nao cobre `observeHttp` ponta a ponta (coberto pelos testes do pacote).
