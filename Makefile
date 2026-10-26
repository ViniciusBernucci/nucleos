# Interface unica de desenvolvimento (esconde pnpm/uv). Ver documentacoes/engenharia/.
# Pre-requisitos no PATH: Node (ver .nvmrc), corepack, uv (Python gerenciado pelo uv).
# O pnpm vem do corepack (versao fixada em package.json "packageManager"); os atalhos
# ficam em .run/bin (local, ignorado pelo git) para nao exigir instalacao global.
SHIMS := $(CURDIR)/.run/bin
export PATH := $(SHIMS):$(PATH)
PNPM ?= pnpm
UV ?= uv
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export TURBO_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows format hooks contracts contracts-gen contracts-check contracts-baseline

setup:
	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
	mkdir -p $(SHIMS) && corepack enable --install-directory $(SHIMS)
	$(PNPM) install --frozen-lockfile
	$(UV) sync --frozen --all-packages

# lint = lint-ts + lint-py + segredos + regressao. Os jobs do CI (FND-005) chamam estes mesmos alvos.
lint: lint-ts lint-py
	./scripts/check-secrets.sh
	$(MAKE) lint-regressao

lint-ts: check-env
	$(PNPM) run lint
	$(PNPM) run lint:quality

lint-py:
	$(UV) run --frozen python -m compileall -q services packages/contracts-py/src
	$(UV) lock --check
	$(UV) run --frozen ruff check services packages/contracts-py
	$(UV) run --frozen ruff format --check services packages/contracts-py
	$(UV) run --frozen mypy
	$(UV) run --frozen lint-imports

# Casos que DEVEM falhar (regressao dos proprios linters); ver tools/qualidade/regressao/.
lint-regressao:
	node tools/qualidade/regressao.mjs

# Sintaxe (actionlint) e politica (SHA, permissions, sem pull_request_target) dos workflows.
lint-workflows:
	actionlint .github/workflows/*.yml
	node scripts/ci/verificar-workflows.mjs

# Casos que DEVEM falhar nos gates do CI (FND-005); ver tools/qualidade/regressao-ci/.
ci-regressao:
	node tools/qualidade/regressao-ci.mjs

format:
	$(PNPM) run format
	$(UV) run --frozen ruff format services packages/contracts-py

# Instala os hooks do lefthook no .git (explicito: o diretorio de hooks e compartilhado por worktrees).
hooks:
	$(PNPM) exec lefthook install

test: test-ts test-py

test-ts: check-env
	$(PNPM) run test

test-py: check-env
	$(UV) run --frozen --all-packages pytest

build:
	$(PNPM) run build
	$(UV) build --all-packages --out-dir .run/py-dist

up: build
	./scripts/local.sh up

down:
	./scripts/local.sh down

health:
	./scripts/local.sh health

check-env:
	./scripts/check-no-env.sh

# --- Docker Compose de desenvolvimento (FND-004). PERFIS="runtime observability" (core sempre incluido).
PERFIS ?=
compose-up:
	./infrastructure/docker/scripts/dev.sh up $(PERFIS)

compose-down:
	./infrastructure/docker/scripts/dev.sh down

compose-reset:
	./infrastructure/docker/scripts/reset.sh $(PERFIS)

compose-smoke:
	./infrastructure/docker/scripts/smoke.sh $(if $(findstring runtime,$(PERFIS)),--runtime) $(if $(findstring observability,$(PERFIS)),--observability)

# --- Contratos TS/Python (FND-003). Fonte: packages/contracts/schemas e openapi; ver documentacoes/contratos/.
# contracts-gen regenera tipos TS, cliente do SDK, modelos Pydantic e a copia dos schemas (exige make setup).
# contracts-check NAO escreve nada: falha se algum gerado divergir da fonte (drift) ou se a mudanca de
# schema quebrar a compatibilidade com packages/contracts/baseline (usado pelo job contracts-drift do CI).
# contracts-baseline promove os schemas atuais a baseline: so apos liberar a versao.
contracts: contracts-gen

contracts-gen: check-env
	$(PNPM) --filter @nucleos/contracts run gerar

contracts-check: check-env
	$(PNPM) --filter @nucleos/contracts run verificar-gerados
	$(PNPM) --filter @nucleos/contracts run compat

contracts-baseline:
	node packages/contracts/scripts/compat.mjs --baseline
