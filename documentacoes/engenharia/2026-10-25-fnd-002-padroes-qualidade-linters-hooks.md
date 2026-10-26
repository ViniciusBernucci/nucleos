# FND-002 — Padroes de qualidade, linters e hooks

Data: 2026-10-25

- **Dominio:** engenharia. **Tarefa:** ENT-FND-002 (lote 2026-10-25-ep00-ep01-fundacao), AC-1..2.
- **Branch:** `tarefa/fnd-002`. **Base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, arvore limpa.
- **Estado:** implementado, validado localmente, 1 commit local (SHA informado no retorno; sem push/merge).
- **Autoria:** Claude (executor, Claude Sonnet 5.5) a pedido do dono do repositorio.

## Objetivo, contexto e escopo

Adicionar controles automaticos de qualidade ao monorepo de FND-001: `make lint` falha ao
introduzir `any`, `eval`, import proibido ou segredo sintetico; convencoes documentadas e
referenciadas no README. Fora do escopo: CI (FND-005), lessons de C#/.NET (ver abaixo),
branch protection.

## Resumo da implementacao

- ESLint 10 type-aware (`strictTypeChecked`) + `eslint-plugin-security`; `no-explicit-any`,
  familia `no-unsafe-*`, `no-eval`, `no-new-func`, `no-implied-eval`. `any` implicito fica com o `tsc strict`.
- Prettier para codigo TS/JS; dependency-cruiser para imports TS; ruff (incl. bandit), `mypy --strict`
  nos pacotes de politica e import-linter para Python; `uv lock --check` no lint Python (NOTA-2).
- gitleaks (binario v8.30.1, checksum conferido) na arvore (`make lint`) e nos staged (hook).
- lefthook (`make hooks`): branch, gitleaks, prettier, eslint, ruff, e `commit-msg`.
- Runner de regressao `tools/qualidade/regressao.mjs` (`make lint-regressao`, chamado por `make lint`): 18 casos
  que DEVEM falhar, cada um com a regra esperada; o segredo sintetico e gerado em tempo de execucao.

## Mudancas por arquivo

- `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.dependency-cruiser.cjs`, `.importlinter`, `.gitleaks.toml`, `lefthook.yml`: configuracoes novas.
- `pyproject.toml`: grupo dev (ruff 0.17.2, mypy 2.4.0, pytest-asyncio 1.4.0, import-linter 2.15, todos fixados) e secoes `[tool.ruff]`/`[tool.mypy]`; `uv.lock` regenerado.
- `package.json`: devDependencies exatas (eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-plugin-security 4.2.0, prettier 3.9.10, dependency-cruiser 18.7.0, lefthook 2.2.2) e scripts `lint:eslint`, `lint:arch`, `lint:quality`, `format`, `format:check`; `pnpm-lock.yaml` atualizado.
- `pnpm-workspace.yaml`: politica de supply chain (REVIEW-002), abaixo.
- `Makefile`: blocos acrescentados em `lint`, alvos `lint-regressao`, `format`, `hooks` (sem reformatar o existente).
- `scripts/check-secrets.sh`, `scripts/check-commit-msg.mjs`, `scripts/check-branch-name.sh`: novos.
- `tools/qualidade/regressao.mjs` e `tools/qualidade/regressao/**`: runner e fixtures.
- `services/*/tests/test_health.py` (x4): `pytest.raises` no lugar de `try/except` (ruff PT017); `apps/api/src/health.test.ts`: `app.getUrl()` no lugar de `getHttpServer()` (que e `any`; achado legitimo do `no-unsafe-*`).
- `services/tenant-runtime/src/tenant_runtime/policy/__init__.py`: pacote vazio para ancorar o `mypy --strict` do caminho `tenant-runtime/policy` exigido pelo ticket.
- `README.md` (secao de convencoes), `documentacoes/engenharia/README.md`, `convencoes-commits-e-branches.md`: documentacao.

## Decisoes tecnicas

- **REVIEW-002 (verificado no pnpm 12.15.0, empiricamente):** scripts de instalacao sao negados por padrao e a
  dependencia nao aprovada FALHA o install (`ERR_PNPM_IGNORED_BUILDS`); a allowlist e `allowBuilds` (nome: bool) no
  `pnpm-workspace.yaml` (nao `onlyBuiltDependencies`). Definido `allowBuilds: { lefthook: false }`: lefthook funciona sem seu
  postinstall (binario vem de dependencia opcional por plataforma), logo nenhum pacote executa script. `minimumReleaseAge`
  e em MINUTOS e tambem valida o lockfile existente (rejeita entradas recentes); fixado em 1440 (24 h) porque `next@16.4.3`
  do lock tem ~2 dias; 4320 (3 dias) quebrou o `--frozen-lockfile`. Ajustar para valor maior quando o lock envelhecer.
- **REVIEW-004:** `pytest==9.0.3` mantido (fixado de proposito, compativel com pytest-asyncio 1.4.0; informativo). `apps/web/next-env.d.ts`
  continua versionado (gerado pelo Next) e passa a ser ignorado por ESLint/Prettier.
- ESLint precisa do `dist` de `packages/*` (tipos de `@nucleos/contracts`); `lint:eslint` roda `turbo build --filter=./packages/*` antes.
- Hooks: `make hooks` e explicito, nao em `make setup`, porque o diretorio de hooks do Git e compartilhado entre worktrees.
- Alternativas: husky (menos portavel, exige scripts de instalacao), `gitleaks protect` (depreciado). Prettier nao cobre Markdown/docs.
- `exclude-newer` do uv nao adotado (fora de escopo; registrar para FND-005).

## Validacoes (reais, em 2026-10-25)

- `make setup`: OK. `make lint`: exit 0 na arvore limpa (tsc, ESLint, depcruise "no dependency violations", Prettier, `uv lock --check`, ruff, `mypy --strict` "no issues in 7 source files", import-linter "2 kept, 0 broken", gitleaks "no leaks found", regressao 18/18).
- `make test`: pytest 4 passed; testes Node dos workspaces verdes (via turbo).
- AC-1, injecao real e remocao: `export const x: any = 1;` em `packages/sdk/src` => `make lint` exit 2 (`no-explicit-any`); import `apps/web` -> `apps/api` => `lint:arch` exit 2 (`web-nao-importa-api`); token `ghp_...` aleatorio => `make lint` exit 2 (`leaks found: 1`).
- AC-2: README raiz referencia `documentacoes/engenharia/convencoes-commits-e-branches.md`.
- Nao executado: `lefthook install`/hooks reais no `.git` (diretorio compartilhado com worktrees paralelas); os checks que o hook chama foram executados diretamente. Build completo (`make build`) nao reexecutado alem do build dos packages.

## Impactos, riscos e rollback

- Requer o binario `gitleaks` no PATH (falha fechado, exit 2). CI ainda inexistente (FND-005 deve rodar `make lint`).
- Novos pacotes de dev aumentam o lock (supply chain mitigada por versoes exatas, release-age e scripts negados).
- Rollback: reverter o commit; `pnpm install`/`uv sync --frozen` restauram o ambiente.

## Commits e diffs

Commit unico local em `tarefa/fnd-002` (SHA no retorno do executor). Diff completo: [diffs](2026-10-25-fnd-002-padroes-qualidade-linters-hooks-diffs.md). Arquivos de `documentacoes/` e de lockfiles nao entram no patch textual (lockfiles por hash).

## Lessons

Nenhuma criada: a trilha `lessons/` e de C#/.NET e esta sob a questao aberta Q-01 (divergencia de stack, FND-008); esta entrega
nao exercita C#/.NET. `lessons/README.md` nao alterado.

## Pendencias

- `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` ainda dizem "Linters, hooks e CI ainda nao existem": atualizar na integracao (arquivos espelhados, evitado por contencao). Incluir `make lint`, `make hooks` e gitleaks como pre-requisito.
- FND-005: rodar `make lint` no CI, `pnpm install --frozen-lockfile` e `uv lock --check`; avaliar `exclude-newer` do uv.

## Atualizacao no fechamento do lote (2026-10-26)

Lesson criada na tarefa `tarefa/lessons-pendentes` ([registro](2026-10-26-lessons-pendentes.md)): [02 - Qualidade estatica em TypeScript e Python](../../lessons/02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md) (ESLint type-aware, ruff, mypy, dependency-cruiser, import-linter, gitleaks e lefthook; exemplos executados). A justificativa anterior de "sem lesson" (secao "Lessons" acima) esta superada; a pendencia de lesson foi encerrada. Indice: [lessons/README.md](../../lessons/README.md).
