# FND-001 — Scaffolding do monorepo (2026-10-25)

## Metadados

- **Dominio:** engenharia
- **Tarefa:** ENT-FND-001, lote 2026-10-25-ep00-ep01-fundacao ([ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-001))
- **Branch:** `tarefa/fnd-001`; **base/HEAD inicial:** `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594` (arvore limpa; merge-base com `main`: `5774410e1466037bb9db00874e461e8836865e6f`)
- **Estado:** implementado e validado; aguarda review/QA independentes (nao revisado pelo executor)
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador do lote
- **Diffs completos:** [2026-10-25-fnd-001-scaffolding-monorepo-diffs.md](2026-10-25-fnd-001-scaffolding-monorepo-diffs.md)

## Objetivo, contexto e escopo

Criar a arvore da secao 14 do [ADR](../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md), tooling minimo e hello-world verde (teste trivial + `/healthz`) por componente, sem logica de negocio.

Fora do escopo (respeitado): codigo de dominio, Dockerfiles de producao (ISO-007/RUN-002), pipelines (FND-005), linters/hooks (FND-002), compose (FND-004), contratos reais (FND-003), alteracao de `CLAUDE.md`/`AGENTS.md`/README, `lessons/README.md` (LOC-001).

## Resumo da implementacao

- pnpm workspaces (`apps/*`, `packages/*`) + **Turborepo** para orquestrar `build/lint/test`; TypeScript estrito (`tsconfig.base.json`).
- `apps/web` (Next.js, `GET /healthz`), `apps/api` (NestJS, `GET /healthz`), `apps/tenant-provisioner` (worker TS com `node:http`, `GET /healthz`), `packages/contracts` (tipo/funcao `HealthResponse`), `packages/sdk` (cliente `checkHealth`).
- Workspace uv na raiz com 4 pacotes independentes em `services/*` (`tenant-runtime`, `ai-gateway`, `tool-gateway`, `event-dispatcher`), cada um com `pyproject.toml` proprio (backend `uv_build`), servidor stdlib com `/healthz` e teste pytest. `uv.lock` unico versionado. Framework HTTP Python fica para ticket proprio (evita dependencia sem decisao).
- `Makefile`: `setup | lint | test | build | up | down | health`. `up/down/health` executam todos os componentes em `127.0.0.1` via `scripts/local.sh` (portas web 3000, api 3001, provisioner 3002, tenant-runtime 8001, ai-gateway 8002, tool-gateway 8003, event-dispatcher 8004); FND-004 substituira por Docker Compose.
- Raiz: `.nvmrc`, `.python-version`, `.editorconfig`, `.gitignore` (inclui `.env*` exceto `.env.example`), `.dockerignore`, `CODEOWNERS`, `.env.example` (sem valores reais), `scripts/check-no-env.sh` (teste de que `git ls-files` nao contem `.env`; roda em `make lint` e `make test`).
- `infrastructure/{docker,ansible,terraform,kubernetes}` com README; `terraform/` e `kubernetes/` marcados "reservado". `lessons/.gitkeep`.

## Versoes verificadas em 2026-10-25 (registros reais)

| Item | Versao fixada | Fonte da verificacao |
| --- | --- | --- |
| Node.js LTS (Krypton, linha 24) | 24.22.1 (publicada 2026-10-20) | `https://nodejs.org/dist/index.json`; SHA256 do tarball conferido |
| pnpm | 12.15.0 | `npm view pnpm version` |
| Turborepo | 2.11.10 | `npm view turbo version` |
| Next.js | 16.4.3 | `npm view next version` |
| React / React DOM | 19.3.1 | `npm view react version` |
| NestJS (`@nestjs/core`, `common`, `platform-express`) | 12.2.0 | `npm view @nestjs/core version` |
| TypeScript | 5.9.3 (ultima 7.0.2 e 6.0.3 existem; ver decisoes) | `npm view typescript` |
| `@types/node` | 24.19.2 (alinhado a Node 24) | `npm view @types/node@24 version` |
| Python | 3.13.17 (`.python-version` = 3.13; `requires-python >=3.12`; 3.14.9 tambem disponivel) | `uv python list` |
| uv | 0.13.5 | `https://pypi.org/pypi/uv/json` e `uv --version` |
| pytest | 9.0.3 | resolvido por `uv lock` |
| corepack | 0.36.0 (embutido no Node 24) | `corepack --version` |

Node 26.12.1 e a linha Current (nao LTS) e foi descartada. A maquina tinha Node 22.23.3, Python 3.10.12, sem pnpm/uv (risco R-1 do manifesto).

### Toolchain obtida sem sudo (R-1)

- Node 24.22.1: tarball oficial extraido em `~/.local/opt/node-v24.22.1-linux-x64` (escopo de usuario; precisa estar no `PATH`).
- uv 0.13.5: instalador oficial com `UV_NO_MODIFY_PATH=1` em `~/.local/bin`; Python 3.13.17 via `uv python install 3.13` (tambem em `~/.local/bin`/`~/.local/share/uv`).
- pnpm: via corepack, versao de `packageManager`; `make setup` cria atalhos em `.run/bin` (ignorado pelo git) com `corepack enable --install-directory`. Nada global foi alterado; o Node/Python do sistema permanecem intactos.

## Mudancas por arquivo

Lista completa e diff em [diffs](2026-10-25-fnd-001-scaffolding-monorepo-diffs.md). Grupos:

- Raiz: `Makefile`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `pyproject.toml`, `.nvmrc`, `.python-version`, `.editorconfig`, `.gitignore`, `.dockerignore`, `CODEOWNERS`, `.env.example`, `pnpm-lock.yaml`, `uv.lock`.
- Scripts: `scripts/local.sh`, `scripts/check-no-env.sh`.
- TS: `apps/web/**`, `apps/api/**`, `apps/tenant-provisioner/**`, `packages/contracts/**`, `packages/sdk/**` (codigo + testes `node:test`).
- Python: `services/<nome>/{pyproject.toml,src/<modulo>/*.py,tests/test_health.py}` x4.
- Infra/lessons: READMEs em `infrastructure/*`, `lessons/.gitkeep`.
- Este documento e o de diffs (em `documentacoes/engenharia/`, fora do patch por recursao).
- Migracoes/banco: nenhuma.

## Decisoes tecnicas

1. **Turborepo em vez de Nx.** Motivos: o repo e poliglota e so a parte TS precisa de orquestracao (Python tem `uv`); Turborepo e uma camada fina sobre scripts do pnpm (um `turbo.json` de 15 linhas), nao impoe geradores/plugins nem estrutura, tem cache de tasks e grafo por dependencia de workspace, e nao exige novo modelo mental para o time. Nx entrega mais (geradores, grafo de projeto, plugins Python/Nest), mas com custo de configuracao e acoplamento a plugins que o ticket nao pede. Revisar se surgir necessidade de `affected` multi-linguagem ou geracao de codigo (FND-003/FND-005).
2. **Testes com `node:test`** (Node 24 nativo) em vez de Jest/Vitest: zero dependencia nova; testes dos pacotes rodam sobre `dist/` compilado, os do web usam remocao de tipos nativa. FND-002 pode padronizar outro runner.
3. **TypeScript 5.9.3** em vez de 6/7: Next 16 e Nest 12 foram validados nesta versao; subir major fica para ticket proprio com teste de compatibilidade.
4. **NestJS 12 e ESM**: `type: module`, `module: NodeNext`, decorators experimentais (`experimentalDecorators` + `emitDecoratorMetadata`) so em `apps/api`.
5. **Servicos Python em stdlib**: evita escolher FastAPI/Starlette antes de ADR; `uv_build` como backend de build.
6. **`engines` estrito**: `node >=24.22.1 <25`; `make setup` falha se o major do Node diferir de `.nvmrc`.
7. **`CODEOWNERS`** usa o unico dono conhecido (`@ViniciusBernucci`) para todos os caminhos; a exigencia de revisor adicional em `services/tool-gateway`, `apps/tenant-provisioner` e `infrastructure/` esta mapeada e depende de time de seguranca e branch protection (FND-005). Consequencia: hoje a protecao e nominal.

## Validacoes (reais)

Ambiente: `PATH` com `~/.local/opt/node-v24.22.1-linux-x64/bin:~/.local/bin`.

| Comando | Resultado |
| --- | --- |
| `make setup` (apos `rm -rf node_modules */*/node_modules .venv .run`) | rc 0 (`pnpm install --frozen-lockfile`, `uv sync --frozen --all-packages`) |
| `make lint` | rc 0 (`tsc --noEmit` em 5 workspaces via turbo, 6 tasks; `compileall` Python; checagem de `.env`) |
| `make test` | rc 0: turbo 10 tasks ok (build + 5 testes TS, incl. `next build`), pytest `4 passed` |
| `make build` | rc 0 (turbo build; `uv build --all-packages` gera 4 sdist + 4 wheel em `.run/py-dist`) |
| `make up` / `make health` / `make down` | 7/7 componentes responderam `/healthz` 200 em `127.0.0.1` (web, api, tenant-provisioner, tenant-runtime, ai-gateway, tool-gateway, event-dispatcher); apos `make down` nenhuma porta em escuta |
| Clone limpo: `git checkout-index` da arvore staged para diretorio vazio + `make setup && make test && make lint` | rc 0/0/0 (AC-1) |
| `.env` sintetico (`echo ... > .env`) | ignorado por `.gitignore` (`git check-ignore`), nao aparece em `git status`; `git ls-files` so contem `.env.example` (AC-3) |

Criterios de aceite: AC-1 ok (clone limpo). AC-2 ok (7 componentes `/healthz`; `packages/*` sao bibliotecas, sem endpoint). AC-3 ok (`.gitignore` e `CODEOWNERS`; ressalva da decisao 7). AC-4 ok (`pnpm-lock.yaml` e `uv.lock` versionados; instalacoes com `--frozen`).

Nao executado: lint de estilo/seguranca, hooks, gitleaks (FND-002/FND-005); Docker (fora do escopo).

## Impactos, riscos e rollback

- Compatibilidade: repositorio ganhou arquivos na raiz; nenhum existente foi alterado. `scripts/instalar-contexto.sh` teve o modo alterado acidentalmente e foi restaurado antes do commit.
- Risco: `up/down` locais usam portas fixas; conflito com outros servicos locais faz a subida falhar (logs em `.run/<nome>.log`). `make build` roda `next build`, que baixa o binario SWC.
- Observabilidade: apenas `/healthz`; logging estruturado e FND-009.
- Rollback: reverter o commit unico da branch (`git revert`) ou descartar a branch; nenhuma migracao nem estado externo.

## Commits e diffs

Um commit local em `tarefa/fnd-001` (mensagem em portugues, coautoria Claude). O SHA nao pode constar no proprio commit; consulte `git log tarefa/fnd-001` (reportado ao coordenador). Diff unificado do commit (sem `documentacoes/`, `lessons/` e lock files): [diffs](2026-10-25-fnd-001-scaffolding-monorepo-diffs.md). Lock files: hashes no arquivo de diffs.

## Lessons

Nao aplicavel nesta entrega: a trilha `lessons/` e do dominio C#/.NET e sera redefinida por LOC-001 (que cria `lessons/README.md`); a entrega usa TypeScript/Python e nenhum conceito .NET. Foi criado apenas `lessons/.gitkeep`. Reavaliar apos LOC-001 se a trilha cobrir TS/Python/monorepo.

## Pendencias

- Comandos reais de build/teste devem ser registrados em `CLAUDE.md` (secao "Validacao") pelo coordenador apos a onda 1 (LOC-001 detem o arquivo): `make setup`, `make lint`, `make test`, `make build`.
- Requisito de ambiente: Node 24.22.1 e uv no `PATH` (ver acima); CI (FND-005) deve usar `actions/setup-node` com `.nvmrc` e instalar uv.
- Revisor adicional de seguranca em `CODEOWNERS` depende de time/branch protection.

## Correcao rodada 1

Origem: auditoria `documentacoes/reviews/2026-10-25-auditoria-fnd-001.md` (veredito CORRECOES_NECESSARIAS; somente REVIEW-003 com decisao APLICAR). Base da rodada: HEAD `a995596c32a86b2b8448db92f342653566acfc58` na branch `tarefa/fnd-001`, arvore limpa. Arquivo alterado: `scripts/local.sh`.

### O que mudou (REVIEW-003)

- (a) `up` verifica, antes de iniciar qualquer componente, se alguma das 7 portas ja aceita conexao em `127.0.0.1` (`/dev/tcp`, sem depender de `ss`); se sim, imprime `ERRO: porta N (nome) ja esta em escuta` e retorna rc != 0 sem iniciar nada.
- (b) a espera por saude agora para se o PID iniciado morrer e so conta OK com `kill -0` verdadeiro mais `/healthz` respondendo (portas comprovadamente livres antes da subida, logo a resposta e do processo iniciado). Falha: mensagem com log, `down` e rc 1.
- (c) `down` so envia `kill -- -PID` se o PID e numerico, existe (`kill -0`) e `ps -o pgid=` e igual ao PID (lider de grupo criado por `setsid`); caso contrario apenas remove o pid-file. `down` sem `.run` retorna 0 sem encerrar o shell chamador.

### Validacoes reais (rodada 1)

| Teste | Resultado |
| --- | --- |
| `bash -n scripts/local.sh` | ok |
| Servidor trivial em 8001 respondendo 200 em `/healthz` + `make up` | rc 2 (make), `ERRO: porta 8001 (tenant-runtime) ja esta em escuta`; 0 pid-files; 0 processos nas demais portas |
| Fluxo normal `./scripts/local.sh up` / `make health` | 7/7 `OK`, rc 0 |
| `up` com tudo ja no ar | rc 1, `ERRO: porta 3000 ... 3001 ...` (comportamento esperado) |
| `down` com pid-file apontando para processo alheio (nao lider de grupo) | processo seguiu vivo; pid-file removido |
| Apos `down` | 0 portas em escuta (3000-3002, 8001-8004); 0 pid-files |
| `make lint` | rc 0 |
| `make test` | rc 0 (turbo 10/10 tasks; pytest `4 passed`) |

Observacao: uma primeira tentativa de teste rodou por engano contra o script antigo (edicao ainda nao aplicada) e os processos foram encerrados; nao e evidencia da correcao. Todos os resultados acima sao do script corrigido. Todos os processos de teste foram encerrados.

### Achados ADIADOS (nao tocados nesta rodada)

- REVIEW-001 (CODEOWNERS sem time / revisor adicional): ADIADO para FND-005 (branch protection, require review from Code Owners).
- REVIEW-002 (politica de scripts de instalacao pnpm / supply chain): ADIADO para FND-002 / FND-005; verificar semantica do pnpm antes de implementar.
- REVIEW-004 (pytest travado em 9.0.3; `apps/web/next-env.d.ts` versionado): ADIADO para FND-002, considerado informativo e nao defeito.

### Commit e diff da rodada

Commit unico novo (sem amend) em `tarefa/fnd-001` sobre `a995596c32a86b2b8448db92f342653566acfc58`; SHA em `git log tarefa/fnd-001` (nao pode constar no proprio commit). Diff de `scripts/local.sh`: ver secao "Correcao rodada 1" em [diffs](2026-10-25-fnd-001-scaffolding-monorepo-diffs.md).
