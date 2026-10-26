# FND-006 — Configuracao tipada e ambientes staging/producao

Data: 2026-10-26

- **Dominio:** infraestrutura
- **Solicitacao:** [ENT-FND-006](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-006) (lote 2026-10-25-ep00-ep01-fundacao; perfil CRITICO, segredos e configuracao de producao)
- **Branch:** `tarefa/fnd-006`; **base/HEAD inicial:** `d00e8dff92f468044558d85d80bd464eef09d32a` (`d00e8df`); arvore limpa no inicio
- **Estado:** implementado e validado localmente; **aguardando review/QA independentes**. Deploy real de staging: **BLOCKED** (sem ambiente declarado).
- **Autores:** executor de IA (Claude Sonnet 5.5) sob demanda do coordenador do lote

## Objetivo, contexto, escopo

Objetivo: esquema de configuracao tipada com falha rapida, overlays `compose.staging.yml`/`compose.prod.yml` sem segredo e procedimento de deploy/rollback por digest, conforme ENT-FND-006 e ADR-020 (aceito). Contexto: FND-004 (Compose local) e DEC-006 (PoC do broker de segredos) ja entregues.

Dentro do escopo: pacotes de configuracao TS e Python; integracao no `apps/api`; base + overlays Compose; `deploy.sh`; verificador estatico no `make lint`; ensaio efemero (`make test-ambientes`); runbook; lessons 11 e 12 (numeracao provisoria).

Fora do escopo: deploy real de staging/producao (sem host, Q-03); Dockerfiles/imagem da API (ISO-007/RUN-002); proxy/TLS (FND-007); broker de segredos por tenant, rotacao da KEK, formato final de producao do ADR-020 (PRV-004); Redis/MinIO/demais servicos nos overlays; politica ISO-002 completa (seccomp/apparmor); assinatura de imagem (cosign); migracoes (nao existem).

## Resumo da implementacao

1. `packages/config` (`@nucleos/config`, zod 4.6.7): `loadApiConfig(env)` valida com tipos para porta, duracao (`30s`), tamanho (`1mb`) e URL sem senha embutida; `staging`/`production` exigem `DATABASE_URL` e `DATABASE_PASSWORD_FILE`; variavel com nome de segredo (`*PASSWORD`, `*TOKEN`, ...) fora do formato `*_FILE` e erro; `readSecretFile` exige arquivo regular, sem link simbolico (`O_NOFOLLOW`), modo sem grupo/outros (`0o077`), mesmo dono, nao vazio e <= 16 KiB; `Secret` nunca se serializa. `ConfigError` lista so nome da variavel e motivo fixo.
2. `packages/config-py` (`nucleos-config`, pydantic 2.14.1 + pydantic-settings 2.16.1): mesmo contrato em Python (`load_settings(env)`), fontes restritas ao mapa explicito (nao le `os.environ`/`.env`), `hide_input_in_errors` e `errors(include_input=False)`.
3. `apps/api/src/main.ts` carrega a configuracao antes de abrir a porta; `ConfigError` => mensagem em stderr e `exit 1`. `observability.ts` passa a receber `ApiConfig`.
4. `compose.deploy.yml` (base) + overlays: imagem da API por `${API_IMAGE}` (digest), Postgres por digest, `restart: unless-stopped`, `read_only`, `cap_drop: ALL` (Postgres com allowlist minima), `no-new-privileges`, `init`, usuario nao-root na API, `cpus`/`mem_limit`/`memswap_limit`/`pids_limit`/`ulimits`, log com rotacao, tmpfs `noexec,nosuid`, rede `interna` sem saida, porta so em `127.0.0.1`. Segredo: `secrets.database_password.file: ${SECRETS_DIR}/database_password` (so o caminho) e `*_FILE` no ambiente.
5. `scripts/deploy.sh <staging|prod> deploy|rollback|status`, `scripts/verificar-deploy.mjs` (estatico; entra em `make lint`), `tests/ambientes.test.mjs` + `tests/ensaio.override.yml` (ensaio efemero).

## Mudancas por arquivo

| Arquivo | Mudanca |
| --- | --- |
| `packages/config/**` | novo pacote TS (`secret.ts`, `primitives.ts`, `load.ts`, `api.ts`, `index.ts`, 8 testes) |
| `packages/config-py/**` | novo pacote Python (`secret.py`, `settings.py`, 12 testes) |
| `apps/api/src/main.ts`, `observability.ts`, `package.json` | usa `@nucleos/config`; falha rapida |
| `pnpm-lock.yaml`, `pyproject.toml`, `uv.lock` | dependencias novas e membro do workspace uv/pytest/mypy |
| `infrastructure/docker/compose.{deploy,staging,prod}.yml` | base e overlays |
| `infrastructure/docker/scripts/{deploy.sh,deploy-lib.mjs,verificar-deploy.mjs}` | deploy/rollback e politica estatica |
| `infrastructure/docker/tests/{ambientes.test.mjs,ensaio.override.yml}` | ensaio efemero |
| `Makefile` | alvos `lint-deploy` (dentro de `lint`) e `test-ambientes` |
| `.env.example`, `infrastructure/docker/README.md` | documentacao das variaveis e dos overlays |
| `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md` | bloco "Validacao" (CRLF preservado) |
| `documentacoes/runbooks/deploy-staging-producao.md` e `README.md` | runbook |
| `lessons/11`, `lessons/12`, `lessons/README.md` | lessons (numeracao provisoria) |

Sem migracao de banco. Sem alteracao em `osv-scanner.toml` nem em dependencias existentes (multer intocado). CI: `.github/workflows/ci.yml` nao mudou; o job `make-lint` ja executa `make lint`, que agora inclui `lint-deploy`.

## Decisoes tecnicas

- **zod/Pydantic Settings** como o ticket pede. Dependencias novas, com lock e versao exata: `zod` 4.6.7 (npm, MIT, publicada em 2026-10-12, consulta 2026-10-26; respeita `minimumReleaseAge` de 1 dia), `pydantic` 2.14.1, `pydantic-core` 2.50.1, `pydantic-settings` 2.16.1, `python-dotenv` 1.2.4, `typing-inspection` 0.4.4, `annotated-types` (PyPI, licencas MIT/BSD, datas 2026-07 a 2026-10, consulta 2026-10-26). `osv-scanner` sobre os locks aponta apenas o `multer` 2.4.0 ja existente (fora do escopo); nenhum achado nas novas.
- **Segredo por arquivo, dono = UID do processo.** A checagem de dono torna o deploy mais estrito (o operador faz `chown 10001`), mas impede arquivo legivel por outro usuario. Alternativa (aceitar root) rejeitada: um processo nao-root nao leria o arquivo `0400` de root.
- **Base + overlays**, em vez de dois arquivos completos: evita divergencia entre staging e producao. `API_IMAGE` sem padrao (`:?`) obriga informar digest; o verificador e o `deploy.sh` rejeitam tag.
- **Ensaio com imagem generica:** nao existe Dockerfile da API; o ensaio monta o `dist` real em `node:24.22.1` (digest do FND-004). O override de ensaio so e aceito por `EXTRA_COMPOSE` e nao faz parte do caminho de producao.
- **Redis/MinIO fora dos overlays:** a API ainda nao os usa; entram com o ticket que os consumir.
- **Postgres com `cap_add`** (CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID): necessario ao entrypoint oficial; excecao documentada, a ser reavaliada em ISO-002.
- **Verificacao do digest:** hoje = digest imutavel + `build-images`/trivy do CI; assinatura (cosign) nao adotada (pendencia).

## Validacoes (reais)

PATH com Node 24.22.1 e `uv`; Docker 29.8.1, Compose 5.5.1.

- AC-1 (recusa subir): `node --test packages/config` => 8/8; `pytest packages/config-py` => 12/12; `make test-ambientes` (processo real `apps/api/dist/main.js` em container `--network none`, `--read-only`, `--cap-drop ALL`): porta/duracao/URL invalidas, `staging` sem banco, segredo por variavel, arquivo `0644` e arquivo ausente => `exit 1`, mensagens citam so nomes/motivos e **nao** contem o valor sentinela.
- AC-2 (deploy e rollback exercitados): ensaio local efemero em `127.0.0.1:13901` com `compose.deploy.yml + compose.staging.yml`: deploy do digest A (`readyz` 200; Postgres aceita a senha do arquivo), deploy do digest B, `rollback` manual de volta ao A, deploy defeituoso (imagem sem a API) com **rollback automatico** ao A; recusa de tag e de segredo `0644`. **Deploy real de staging: BLOCKED** (nenhum ambiente de staging declarado em `CLAUDE.md`; sem VPS, Q-03). O ensaio local nao substitui a execucao no host.
- AC-3 (sem segredo literal): `make lint-deploy` renderiza staging e prod e falha por: tag sem digest, nome de segredo no ambiente, URL com senha, porta fora de `127.0.0.1`, `privileged`, root, sem `read_only`/`cap_drop`/limites; varre tambem o texto dos tres arquivos. No ensaio: sentinela ausente de `docker inspect` (API e Postgres), `Config.Env`, `Cmd/Entrypoint`, `/proc/*/environ`, `/proc/*/cmdline`, `env`, `docker logs`, `image inspect` e `compose config`; controle negativo (`-e`) e detectado; `HostConfig` mostra `Privileged=false`, `CapDrop=[ALL]`, `ReadonlyRootfs`, limites, `unless-stopped`, portas em `127.0.0.1`.
- Pos-ensaio: 0 containers, volumes e redes `fnd006` remanescentes (verificado com `docker ps -a`, `volume ls`, `network ls`).
- Repositorio: `make lint` => exit 0 (inclui ESLint type-aware, ruff, mypy, import-linter, gitleaks, regressao, `lint-deploy`); `make test` => TS (config 8, api 2, demais inalterados) e `pytest` 30 passed; `make build` => exit 0. `scripts/ci/auditar-dependencias.sh` completo **nao** executado (so `osv-scanner` isolado, ver acima); `pip-audit`/`pnpm audit`: NA nesta sessao. `make ci-regressao`, `lint-workflows`, trivy/hadolint: NA (nenhum workflow nem Dockerfile alterado).
- Observacao: o ESLint ficou com avisos `security/detect-non-literal-fs-filename` em `secret.ts` (intencional: o caminho vem da configuracao).

## Impactos, riscos, compatibilidade, observabilidade, rollback

- Compatibilidade: em `local`/`ci` nada e obrigatorio (padroes seguros; `HOST` padrao `127.0.0.1`); o runtime do Compose de desenvolvimento segue valido (APP_ENV ausente => `local`). `APP_VERSION`/`APP_ENV` agora passam pelo esquema (valor invalido impede subir, antes caia em padrao).
- Riscos: o ensaio nao exercita imagem real da API nem host real; o `deploy.sh` e script de shell sem teste de falha de `docker pull` (rede); permissoes de bind mount dependem do dono no host; `cap_add` do Postgres; sem assinatura de imagem; segredo em claro existe no host (limite ADR-020); `make test-ambientes` nao roda no CI (Docker + ~75 s; ver pendencias).
- Observabilidade: falha de configuracao vai a stderr com nomes de variaveis; `readyz` e o criterio de saude do deploy.
- Rollback da entrega: `git revert 8e5194d`; operacional: `deploy.sh <env> rollback` (nao desfaz migracoes; forward-only).

## Commits e diffs da branch que pertencem a tarefa

- `8e5194d` — `feat(infra): configuracao tipada, overlays de staging/prod e deploy por digest (FND-006)` (codigo, testes, configuracao e locks). Diff completo: [diffs](2026-10-26-fnd-006-configuracao-tipada-e-ambientes-diffs.md).
- Segundo commit local (documentacao: este documento, diffs, runbook, lessons 11/12, indices e bloco "Validacao"): sua SHA nao pode constar dele mesmo; consulte `git log tarefa/fnd-006`. Seus arquivos: `documentacoes/infraestrutura/2026-10-26-fnd-006-*` (2), `documentacoes/runbooks/deploy-staging-producao.md`, `documentacoes/runbooks/README.md`, `lessons/11 - ...`, `lessons/12 - ...`, `lessons/README.md`, `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md` (+5 linhas cada, CRLF).

## Lessons

- [11 - Configuracao tipada com falha rapida](../../lessons/11%20-%20Configuracao%20tipada%20com%20falha%20rapida.md) (provisoria)
- [12 - Segredos por arquivo e verificacao de vazamento](../../lessons/12%20-%20Segredos%20por%20arquivo%20e%20verificacao%20de%20vazamento.md) (provisoria)
- Indice: [lessons/README.md](../../lessons/README.md)

## Pendencias e decisoes humanas

- **BLOCKED:** deploy/rollback reais em staging (AC-2 completo) dependem de declarar um host/ambiente de staging (Q-03) e do operador.
- Decidir se `make test-ambientes` vira job de CI (exige `make build`, Docker e ~75 s) e, se sim, incluir na branch protection (mudanca coordenada com FND-005).
- Imagem da API (Dockerfile) e assinatura (cosign): ISO-007/RUN-002; hoje o digest vem do `build-images`.
- Tratar os itens do ADR-020 que apontam para este ticket e **nao** foram feitos aqui: formato de producao do broker (ID/versao da KEK, escrita atomica, lock, auditoria encadeada — REVIEW-005/008/009); permanecem com PRV-004.
- Reconciliar a numeracao das lessons 11 e 12 na trilha (coordenador).
- Politica do dono do arquivo de segredo (UID do servico, `chown 10001`) deve ser confirmada pelo operador.
