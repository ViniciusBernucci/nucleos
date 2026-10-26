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

## Rodada de correcao 1 (review `866f07b`, auditoria `1951067`)

Commit de codigo: `6269603` (sem amend; o historico anterior, `8e5194d` e `93c7049`, permanece). Evidencia da rodada anterior preservada acima. Diff: secao "Rodada 1" do [arquivo de diffs](2026-10-26-fnd-006-configuracao-tipada-e-ambientes-diffs.md).

| ID | Decisao | O que foi feito | Teste que falha sem a correcao |
| --- | --- | --- | --- |
| REVIEW-001/010 | APLICAR | `deploy.sh`: `anterior` so muda se o digest difere; `if subir && aguardar_pronto` com rollback automatico (alvo = `atual` anterior, ou `anterior` em redeploy), sem gravar `atual` do digest falho; `flock` por ambiente | ensaio: A, B, B, `rollback` volta a A (mutante `anterior=atual` incondicional: 4 testes falham, executado); `compose up` com imagem inexistente reverte e preserva o estado; execucao concorrente recusada |
| REVIEW-002 | APLICAR | `EXTRA_COMPOSE` proibido em `prod`; em staging exige `FND006_ENSAIO=1`; aviso em stderr; runbook e ensaio ajustados | `deploy.sh prod` e staging sem flag saem com codigo 2 sem chamar `docker` (stub no `PATH`) |
| REVIEW-003 | APLICAR parcial | Python: esquema do banco `postgres`/`postgresql`, `PORT` so `^\d{1,5}$`; TS: `TextDecoder` fatal; tabela unica `packages/config/paridade-casos.json` (52 casos) consumida por um teste em cada pacote | tabela e mutantes (esquema, PORT, UTF-8) falham |
| REVIEW-004 | APLICAR reduzido | nome de segredo por token (`PASS`, `PASSWORD`, `PASSWD`, `PWD`, `SECRET`, `TOKEN`, `KEY`, `APIKEY`, `CREDENTIAL(S)`, `DSN`) ou sufixo colado, exceto `_FILE`/`_PATH` e `PWD`/`OLDPWD` exatos (variaveis POSIX; sem isso a API nao subia em nenhum shell), em `load.ts`, `settings.py`, `deploy-lib.mjs` (nomes e texto) | casos do review nos tres; `DB_PASS: hunter2` em Compose falha o verificador |
| REVIEW-005 | APLICAR subconjunto | `verifyRendered`: allowlist de `cap_add` por servico (API nenhuma; Postgres as 5 documentadas), `networks.interna.internal`, Postgres so em `interna`, `tmpfs` com `noexec,nosuid`, `*=unconfined`, qualquer bind mount | um caso `bad({...})` por regra |
| REVIEW-006 | APLICAR | testes de `dono-diferente` (TS `mock.method`, Python `monkeypatch`), nomes `*_TOKEN/_SECRET/_PASS`, `hide_input_in_errors`, limites de tamanho | mutantes reexecutados (abaixo) |
| REVIEW-007 | APLICAR parcial | leitura por `open(O_NOFOLLOW|O_NONBLOCK)` + `fstat(fd)` + leitura limitada a `MAX_SECRET_BYTES+1` nos dois pacotes (codigos de erro inalterados) | limite exato aceito e +1 recusado, nos dois pacotes |
| REVIEW-009 | APLICAR | `password`, `sslpassword`, `passfile`, `pass(wd)`, `pwd`, `token`, `apikey`, `secret`, `credential(s)` na query da URL recusados (case-insensitive); corrigido de passagem um defeito do TS: refinamentos encadeados faziam `new URL` lancar excecao nao-Zod para URL invalida (agora `superRefine` com retorno antecipado) | linhas da tabela compartilhada |
| REVIEW-011 | APLICAR parcial | diff dos blocos de `CLAUDE.md`/`AGENTS.md`/`.agents/rules` no arquivo de diffs; pendencias abaixo | n/a |
| REVIEW-012 | APLICAR | exemplo Python da lesson 11 anotado (`SettingsConfigDict`, assinatura completa); verificado com `mypy --strict`; data atualizada | n/a |

Mutantes do REVIEW-006 reexecutados nesta rodada (todos agora falham os testes): TS dono removido; TS `KEY` removido; TS UTF-8 nao fatal; TS verificacao de query removida; Python dono removido; Python `hide_input_in_errors=False`; Python esquema do banco; Python `PORT`; `TOKEN` removido do conjunto E do sufixo (2 falhas). Remover `TOKEN` so do conjunto de tokens sobrevive por ser equivalente (o sufixo colado `TOKEN` cobre o mesmo caso).

Validacoes da rodada (PATH com Node 24.22.1 e `uv`): `make lint` exit 0; `make test` exit 0 (config TS 14 testes; `pytest` 49 passed, 31 em `config-py`); `make build` exit 0; `make test-ambientes` exit 0, 21 testes (6 novos de deploy/guarda/hardening), com 0 containers, volumes e redes remanescentes.

### ADIAR (com destino e condicao de retomada)

| ID | Item adiado | Destino | Condicao |
| --- | --- | --- | --- |
| 003 | paridade ampla de mensagens, fuzz do esquema | tickets dos servicos Python de IA/dados | primeiro servico Python real que consuma `config-py` |
| 004 | allowlist de variaveis por servico (variavel fora do esquema e erro) e arquivo unico da lista de nomes (hoje replicada em 3 arquivos, com a tabela compartilhada como guarda de deriva) | FND-007 ou primeiro ticket que acrescente variavel ao esquema da API | nova variavel de ambiente |
| 005 | `ulimits`/`init` obrigatorios, `secrets.file` apontando so para `SECRETS_DIR`, seccomp/apparmor completos | ISO-002 | perfil de runtime do ticket |
| 007 | verificar o diretorio pai do segredo | runbook de deploy e ISO-001 | host de staging definido |
| 008 | limites (`REQUEST_TIMEOUT`, `MAX_BODY_SIZE`, `SHUTDOWN_TIMEOUT`) validados mas nao consumidos pelo servidor; `telemetryConfigFromEnv(process.env)` le o ambiente fora do esquema (`OTEL_EXPORTER_OTLP_HEADERS` pode carregar credencial; tratar `*_HEADERS` como `*_FILE`) | FND-007 (limites na borda) e ticket de observabilidade com exportador autenticado | consumo dos limites ou exportador OTLP autenticado |
| 011 | SOPS+age para segredos da plataforma; varredura do conteudo de volumes no ensaio e segredo em `tmpfs` (ensaio local nao tem `tmpfs` de segredo); `audit.log` com hash encadeado e persistencia atomica do broker | ISO-001/deploy real (SOPS), ISO-002/ISO-001 (volumes, tmpfs), PRV-004 (broker) | primeiro segredo versionado de plataforma; host real; consumo do broker |
| 011 | numeracao das lessons 11/12 | orquestrador, na integracao em `revisao/` | integracao do lote |
| lacuna 3 do auditor | falha de `docker pull` (rede) no `deploy.sh`: o codigo aborta antes de tocar no estado (`|| exit 1`), mas o ensaio pula o pull (`EXTRA_COMPOSE`), entao o caminho nao e exercitado; a falha de `compose up` por imagem inexistente e coberta | deploy real de staging | host de staging declarado |

Risco novo declarado: a regra de nome de segredo vale para todo o ambiente do processo, tambem em `local`; um shell de desenvolvimento com variavel como `GITHUB_TOKEN` ou `*_API_KEY` exportada impede `loadApiConfig` (ja ocorria com `TOKEN` na regra anterior; so `PWD`/`OLDPWD` foram liberados). Alternativa a decidir pelo humano: aplicar a regra apenas em `staging`/`production`/`ci`.

Commits da tarefa agora: `8e5194d` (codigo), `93c7049` (documentacao), `6269603` (correcoes da rodada 1) e um commit de documentacao da rodada (SHA em `git log`; nao pode constar dele mesmo).

## Rodada de correcao 2 (revalidacao `986e126`)

Commit de codigo: `d259238` (sem amend). Evidencia das rodadas anteriores preservada.

| ID | Decisao | O que foi feito | Prova |
| --- | --- | --- | --- |
| REV-001 | CORRIGIDO | teste sem `EXTRA_COMPOSE`: arquivo `0400` do usuario atual com `API_UID` diferente => `deploy.sh staging deploy` sai com codigo 1, "pertencer ao UID", sem chamar `docker` (stub no `PATH`); controle positivo com o UID certo nao emite a mensagem | mutante `[ "$dono" = ... ] \|\|` => `true \|\|` em `git clone --no-hardlinks` (scratchpad, descartado): o teste novo falha (antes sobrevivia 21/21) |
| REV-002 | CORRIGIDO | `deploy-lib.mjs` sem excecao para `PWD`/`OLDPWD` (a isencao fica so em `load.ts`/`settings.py`, o carregador do processo) | testes: `PWD: hunter2` em `environment:` e no texto do Compose e `DB_PWD` sao recusados |
| REV-003 | REGISTRADO | ordem `verificar_segredos`/`travar`/`verificar-deploy.mjs` nao uniforme, e `EXTRA_COMPOSE` ainda dispensa o dono em staging (so ensaio, com aviso e `FND006_ENSAIO=1`) | aceito; revisitar no deploy real de staging |
| REV-004 | REGISTRADO | falsos positivos `*_KEY_ID` (ex.: `AWS_ACCESS_KEY_ID`) e `PASSWORD_FILE_X`: fail-closed, coerente com a politica | acompanhar no primeiro ticket que acrescentar variavel (ADIAR da rodada 1, item 004) |

Validacoes: `make lint` exit 0; `make test` exit 0 (`pytest` 49 passed); `make build` exit 0; `make test-ambientes` exit 0, 22 testes, 0 containers/volumes/redes remanescentes. A decisao humana sobre a regra de nome de segredo em `local` (GITHUB_TOKEN etc.) segue aberta.

Commits da tarefa: `8e5194d`, `93c7049`, `6269603`, `d259238` e o commit de documentacao desta rodada (SHA em `git log`).
