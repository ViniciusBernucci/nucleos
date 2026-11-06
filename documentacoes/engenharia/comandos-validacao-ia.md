# Comandos e ambientes de validacao

Selecione comandos pertinentes no planejamento. Preparacao uma vez por worktree; checks direcionados durante a unidade; globais na integracao. Reexecucao depende de alteracao ou falha pertinente. Testes de tela sao manuais. Nenhum comando presume autorizacao para banco real.

Topologia local desde 2026-11-06: `make up`/`make health` e o perfil Compose `runtime`
abrangem web (3000), API (3001) e ai-gateway (8002). Os quatro esbocos sem negocio
foram retirados; veja a [arquitetura atual](../arquitetura/README.md). O core do Compose
e os servicos de apoio aos testes permanecem; comandos de subida nao autorizam
acesso ao banco de desenvolvimento. No Windows, `make` usa Git Bash e os shims em `.run/bin`.

- **Validacao:** comandos reais (ENT-FND-001, na raiz): `make setup`, `make lint`, `make test`,
  `make build`; `make up`/`make health`/`make down` sobem e checam `/healthz` em `127.0.0.1`.
  Exigem Node 24.22.1 e `uv` no `PATH` (instalados em escopo de usuario, ver
  `documentacoes/engenharia/2026-10-25-fnd-001-scaffolding-monorepo.md`). `make lint` inclui
  ESLint type-aware, ruff, mypy, regras de arquitetura e gitleaks (FND-002); `make hooks` instala
  os hooks. Ambiente local em Docker: `make compose-up`, `make compose-smoke` e
  `make compose-down` (FND-004; `PERFIS=runtime` exige `make setup && make build`). O CI
  (FND-005, `.github/workflows/ci.yml`; GitHub Actions) bloqueia merge em `main` e chama os mesmos
  alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
  seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
  branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
  Contratos TS/Python (FND-003): `make contracts-gen` (alias `make contracts`) regenera tipos TS,
  cliente do SDK, modelos Pydantic e a copia dos schemas a partir de `packages/contracts`;
  `make contracts-check` falha em drift ou mudanca incompativel de schema (job `contracts-drift`
  do CI); `make contracts-baseline` promove os schemas a baseline apos liberar a versao.
  Configuracao e ambientes (FND-006): `make lint` inclui `make lint-deploy` (overlays de staging/prod
  sem segredo literal, com digest e hardening); `make test-ambientes` (requer Docker e `make build`)
  ensaia config invalida, deploy/rollback e ausencia de segredo em `docker inspect`/env/logs em
  containers efemeros em `127.0.0.1`; ainda nao roda no CI. Nao ha ambiente de staging declarado:
  deploy real fica BLOCKED (ver `documentacoes/runbooks/deploy-staging-producao.md`).
  Entrega somente de documentacao registra NA com justificativa.
