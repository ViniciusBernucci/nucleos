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

.PHONY: setup lint test build up down health check-env lint-regressao format hooks

setup:
	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
	mkdir -p $(SHIMS) && corepack enable --install-directory $(SHIMS)
	$(PNPM) install --frozen-lockfile
	$(UV) sync --frozen --all-packages

lint: check-env
	$(PNPM) run lint
	$(UV) run --frozen python -m compileall -q services
	$(PNPM) run lint:quality
	$(UV) lock --check
	$(UV) run --frozen ruff check services
	$(UV) run --frozen ruff format --check services
	$(UV) run --frozen mypy
	$(UV) run --frozen lint-imports
	./scripts/check-secrets.sh
	$(MAKE) lint-regressao

# Casos que DEVEM falhar (regressao dos proprios linters); ver tools/qualidade/regressao/.
lint-regressao:
	node tools/qualidade/regressao.mjs

format:
	$(PNPM) run format
	$(UV) run --frozen ruff format services

# Instala os hooks do lefthook no .git (explicito: o diretorio de hooks e compartilhado por worktrees).
hooks:
	$(PNPM) exec lefthook install

test: check-env
	$(PNPM) run test
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
