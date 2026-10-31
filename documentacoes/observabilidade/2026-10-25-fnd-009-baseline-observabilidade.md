# FND-009 - Baseline de observabilidade nos servicos (2026-10-25)

## Metadados

- **Dominio:** observabilidade
- **Tarefa:** ENT-FND-009, lote 2026-10-25-ep00-ep01-fundacao ([ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-009))
- **Branch:** `tarefa/fnd-009`; **base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, arvore limpa
- **Estado:** implementado, com correcoes da rodada 1 de review aplicadas e validadas; aguarda revalidacao independente do review e QA (nao revisado pelo executor)
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador; sessao retomada apos limite de uso
- **Diffs completos:** [2026-10-25-fnd-009-baseline-observabilidade-diffs.md](2026-10-25-fnd-009-baseline-observabilidade-diffs.md)

## Objetivo, contexto e escopo

Entregar a biblioteca compartilhada (TS e Python) de logging estruturado, redacao, correlation id, OpenTelemetry, sondas e metricas RED, integrada de forma minima aos hello-worlds existentes.

Fora do escopo: coletor/backend OTLP e dashboards (OBS-001), politica de labels por tenant (DEC-010), extracao de `traceparent` de entrada, borda/proxy que define `X-Request-Id` (FND-007), `JobEnvelope` oficial (FND-003), instrumentacao do `apps/web` (Next.js), dependencias reais em `/readyz` (nao ha banco ainda), Makefile/configs de raiz (nenhum bloco novo foi necessario).

## Resumo da implementacao

- `packages/observability` (`@nucleos/observability`, TS, pino 10.4.0) e `packages/observability-py` (`nucleos-observability`, Python, structlog 26.1.0), com a mesma semantica.
- **Campos fixos** em todo log JSON: `ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event` (ausentes = `null`) mais `data` redigido. `tenant_id` so entra via `setTrustedTenant`/`set_trusted_tenant` (fonte confiavel); o middleware nunca le tenant de header.
- **Redacao por allowlist** (regra final na secao "Correcao rodada 1"): so chaves permitidas passam; nomes sensiveis (`authorization, cookie, password, token, secret, prompt, content, api_key`, mais padrao amplo) viram `[REDACTED]` mesmo se permitidos; chaves desconhecidas sao descartadas (nome e valor) e contadas em `_dropped`; `Bearer ...`/JWT em strings sao removidos; Error vira so o nome; limites de profundidade (4), itens (20) e tamanho (256). Headers, query e corpo de requisicao nunca sao logados: o log HTTP contem so metodo, template de rota, status e duracao.
- **Correlation ID**: `X-Request-Id` so e aceito com `trustEdge`/`trust_edge` ligado explicitamente (padrao **false**, ate FND-007 definir a borda confiavel) e se casar `^[A-Za-z0-9._-]{8,128}$` por inteiro (`fullmatch`; evita injecao em log); senao UUID v4. *(Correcao rodada 1: o padrao original era `true`.)* Devolvido no response, propagado por `AsyncLocalStorage`/`contextvars`, `correlationHeaders()` para chamadas de saida, e `JobEnvelope.correlation_id` com `createJobEnvelope`/`runJob` (restaura o id no worker).
- **OpenTelemetry**: traces + metricas, OTLP/HTTP via `OTEL_EXPORTER_OTLP_ENDPOINT`; habilitado so com endpoint e sem `OTEL_SDK_DISABLED=true`; desabilitado usa implementacoes no-op (sem provider global). Shutdown tolera falha de exportacao.
- **Sondas**: `/healthz` (vivo) e `/readyz` (checagens com timeout de 2 s; 503 `not_ready`); corpo apenas `{status, service}`, sem versao nem nome de dependencia.
- **RED**: `http.server.requests`, `http.server.errors` (5xx), `http.server.request.duration` (s), labels apenas `method`, `route` (template; desconhecida = `unmatched`) e `status_class`. `createBusinessCounter` exige labels enumerados (valor fora vira `other`) e rejeita `tenant_id`, `user_id`, `correlation_id`, etc.
- **Integracao**: `apps/tenant-provisioner` (node:http), `apps/api` (middleware Nest/Express + `GET /readyz`), 4 servicos Python (`make_handler`).

### Correlacao log/metrica/trace (AC-1)

Log e span compartilham `correlation_id` (atributo `nucleos.correlation_id`) e `trace_id/span_id`. A metrica **nao** leva `correlation_id` (seria alta cardinalidade); ela e correlacionada pela mesma requisicao instrumentada (route/status_class) e por exemplars do SDK baseados em trace. O teste verifica log=span (ids) e a metrica da mesma rota; exemplars nao foram verificados.

## Mudancas por arquivo

- Novos: `packages/observability/**` (redact, context, logger, telemetry, red, http, index, testes), `packages/observability-py/**` (idem + testes), `apps/api/src/observability.ts`.
- TS alterados: `apps/tenant-provisioner/{package.json,src/server.ts,src/server.test.ts}`, `apps/api/{package.json,src/main.ts,src/health.controller.ts,src/health.test.ts}`, `pnpm-lock.yaml`.
- Python alterados: `services/*/pyproject.toml` (dependencia de workspace), `services/*/src/*/app.py`, `services/*/tests/test_health.py`, `pyproject.toml` raiz (membro do workspace e `testpaths`), `uv.lock`.
- Migracoes/banco: nenhuma. `Makefile`: sem alteracao.

## Dependencias novas (verificadas no registro em 2026-10-25)

| Pacote | Versao | Justificativa |
| --- | --- | --- |
| pino | 10.4.0 | logger JSON exigido pelo ticket |
| @opentelemetry/api | 1.10.0 | API de traces/metricas (no-op por padrao) |
| @opentelemetry/sdk-trace | 3.0.0 | SDK de traces (linha v3; `sdk-trace-node` 2.12 exige api <1.10, incompativel com sdk-metrics 3.0) |
| @opentelemetry/sdk-metrics | 3.0.0 | SDK de metricas |
| @opentelemetry/resources | 3.0.0 | atributos de servico |
| @opentelemetry/exporter-trace-otlp-http / exporter-metrics-otlp-http | 0.300.0 | exportacao OTLP/HTTP |
| structlog | 26.1.0 | logger JSON exigido pelo ticket |
| opentelemetry-api / -sdk / -exporter-otlp-proto-http | 1.45.1 | OTel Python (traz `requests`, `protobuf` transitivos) |

Todas fixadas exatamente, com `pnpm-lock.yaml` e `uv.lock` atualizados. Versoes consultadas com `npm view` e PyPI JSON.

## Decisoes tecnicas

1. Sem `sdk-node`/auto-instrumentacao: menos dependencias e controle de cardinalidade; span ativo mantido no proprio contexto (nao registra context manager global OTel). Consequencia: sem spans filhos automaticos nem extracao de `traceparent` (pendencia).
2. Allowlist com descarte de chaves desconhecidas (nao `[REDACTED]` por chave) porque o nome da chave tambem pode carregar dado.
3. Teste de propriedade com PRNG com semente fixa (sem fast-check/hypothesis): reproduzivel e sem dependencia; 500 casos por linguagem.
4. `JobEnvelope` minimo local ate FND-003.
5. Python continua em `http.server` (stdlib), como em FND-001; framework fica para ticket proprio.

## Validacoes (reais)

Ambiente: Node 24.22.1, uv 0.13.5, Python 3.13.17 (`PATH` de usuario).

| Comando | Resultado |
| --- | --- |
| `make setup && make lint && make test && make build` | rc 0; turbo lint 8/8, test 12/12 (observability 8 testes, tenant-provisioner 3, api 2), build 6/6; pytest `11 passed` (4 servicos + 7 da biblioteca) |
| `make up` / `make health` / `make down` | 7/7 `/healthz` 200; `GET /readyz` do provisioner 200 `{"status":"ready","service":"tenant-provisioner"}` com `x-request-id` gerado; processos encerrados |

Criterios: AC-1 ok (testes TS e Python: log, span, metrica da mesma requisicao, HTTP->job->log). AC-2: **a afirmacao original "ok" excedia a evidencia** (o gerador nao cobria string comum sob chave permitida, item de array, dado de topo escalar/lista nem `Error.name`; o auditor reproduziu vazamentos). Apos a rodada 1, o AC-2 e provado para essas classes (ver abaixo), no `redact` e na linha de log real, em TS e Python, alem do teste em cada um dos 4 servicos Python, provisioner e api. AC-3 ok (telemetria desabilitada e habilitada com endpoint `127.0.0.1:1` inalcancavel: respostas 200 inalteradas, shutdown sem erro).

Nao executado: lint de estilo/seguranca (FND-002), CI (FND-005), coletor OTLP real (nenhum servico externo usado).

## Correcao rodada 1 (review `documentacoes/reviews/2026-10-25-review-fnd-009.md`, auditoria `2026-10-25-auditoria-fnd-009.md`)

Executada sobre `e383f88` em um **segundo commit** (sem amend). Decisoes do auditor: APLICAR REVIEW-001 a 006 e "truncar antes do scrub"; ADIAR OTLP malformado e exemplars.

- **REVIEW-001 (MEDIO):** `trustEdge`/`trust_edge` agora e `false` por padrao em `resolveCorrelationId`, `observeRequest`/`ObserveOptions`, `resolve_correlation_id` e `make_handler`. Nenhuma integracao passava o parametro, entao todas passam a gerar UUID. Testes: padrao substitui `abcdefgh12` por UUID (funcao e servidor real, TS e Python); `true` aceita; id invalido segue UUID mesmo com a flag. Testes dos 6 hello-worlds ajustados (id do cliente ignorado; `correlation_id` do log = id devolvido).
- **REVIEW-002 (MEDIO, bloqueante do AC-2):** regra final de redacao: (1) dado de topo so objeto simples; escalar, lista, `Error`, `Map` etc. viram `{"_dropped":1}`; (2) allowlist e um mapa chave -> regra: string so passa sob chave com regra declarada (RegExp que casa o valor inteiro, ou `"free"`/`FREE` como opt-in explicito); chave sem regra (inclusive as passadas como lista de nomes) aceita apenas numero/booleano/null e string vira `[REDACTED]`; defaults da biblioteca: `method` `^[A-Z]{1,16}$`, `route` `unmatched` ou `^/[A-Za-z0-9_\-./:{}]*$` (sem `?`/`=`), `check`/`job_type` `^[A-Za-z0-9_.-]{1,64}$`; (3) `Error.name` so se casar `^[A-Za-z0-9_.$]{1,64}$` (senao `[REDACTED]`; em Python vem do nome da classe, tambem validado); objetos nao simples dentro de dados viram `[UNSUPPORTED]`; (4) scrub **antes** de truncar (item "truncar antes do scrub" da auditoria foi interpretado como a inversao recomendada: aplicar os padroes e depois cortar em 256) e novo padrao `(password|passwd|token|secret|api_key)\s*[=:]\s*\S+`; JWT agora casa `eyJ...(.x)*` mesmo incompleto; (5) falha ao redigir (ex.: getter que lanca) vira `"[REDACTION_ERROR]"` sem dados. Testes de propriedade (500 iteracoes, TS e Python) agora geram sentinela `SENTINEL-s3cr3t-*` em string sob chave permitida sem validador, em item de array, em dado de topo escalar/lista, em `Error.name`, em `route` com `?token=` e em `password=`; a verificacao e feita no `redact` **e** na linha real de `logger.log`. Testes negativos: valores validos (`/healthz`, `200`, `GET`) permanecem; JWT atravessando o limite de 256 nao deixa prefixo.
- **REVIEW-003 (BAIXO):** `_VALID_ID` sem ancoras e com `fullmatch` nos dois usos (`resolve_correlation_id` e `run_job`); testes `"abcdefgh\n"` e `"abcdefgh\r\nX: 1"` -> UUID, incluindo o caminho do envelope de job.
- **REVIEW-004 (BAIXO):** `Handler.server_version = "nucleos"`, `sys_version = ""` (header `Server` sem Python/versao); `do_HEAD/POST/PUT/PATCH/DELETE/OPTIONS` delegam ao mesmo fluxo: rota desconhecida -> 404, sonda com metodo != GET -> 405 (`Allow: GET`), sempre com `x-request-id`, span, RED (metodo fora do conjunto vira `OTHER`) e log.
- **REVIEW-005 (BAIXO/MEDIO-BAIXO):** (a) Python: checks de `/readyz` em `ThreadPoolExecutor` com prazo total de 2 s (paralelos; pior caso 2 s, nao N x 2 s) e os 4 servicos agora usam `ThreadingHTTPServer`, entao `/healthz` nao espera `/readyz`; TS: `Promise.all` com timeout por check. (b) TS: `try/catch/finally` no handler de `close` (fail-open sem dados; `span.end()` sempre); Python: `try/except/finally` com `span.end()` e status de erro. Testes: 2 checks de 4 s -> `/readyz` 503 em < 3,5 s e `/healthz` 200 em < 1 s durante a espera (Python); 3 checks pendurados -> 503 em < 3,5 s com `/healthz` concorrente (TS); `routeOf` que lanca nao derruba e o span e finalizado (TS); excecao em `_dispatch` encerra o span (Python). Limite conhecido: threads de checks pendurados continuam ate o check retornar (o executor nao as cancela).
- **REVIEW-006:** historia do commit documentada em "Commits e diffs".
- **ADIADOS (sem alteracao de codigo):** OTLP com URL malformada (retomar em FND-006, validacao tipada de `OTEL_*` e fail-fast no boot); exemplars/correlacao metrica-trace (retomar com coletor real, FND-006/infra de observabilidade).
- **Arquivos alterados na rodada:** `packages/observability/src/{redact,logger,context,http}.ts` e testes (`redact.test.ts`, `observability.test.ts`); `packages/observability-py/src/nucleos_observability/{redact,logger,context,http,__init__}.py` e `tests/test_observability.py`; `services/*/src/*/app.py` (`ThreadingHTTPServer`); `services/*/tests/test_health.py`, `apps/tenant-provisioner/src/server.test.ts`, `apps/api/src/health.test.ts`.
- **Consequencias:** servicos que precisarem logar strings livres devem declarar validador por chave (`allowlist: {chave: /re/}` / `"free"`); lista de nomes continua valida, mas so libera numero/booleano.

### Validacao da rodada 1 (reais)

Ambiente: Node 24.22.1, uv, Python 3.13.17 (`PATH` com `~/.local/opt/node-v24.22.1-linux-x64/bin` e `~/.local/bin`).

| Comando | Resultado |
| --- | --- |
| `make setup` | rc 0 |
| `make lint` | rc 0; turbo 8/8; `compileall` ok |
| `make test` | rc 0; turbo 12/12 (observability 14 testes, tenant-provisioner 3, api 2); pytest `18 passed` (4 servicos + 14 da biblioteca) |
| `make build` | rc 0; turbo 6/6; wheels Python gerados |
| `make up` / `make health` / `make down` | 7/7 `/healthz` OK em ambos; down rc 0 |

Correcao do AC-2: considerado provado somente nas classes listadas acima (e nas anteriores); nao ha afirmacao alem disso. Nao reexecutado por revisor independente.

## Correcao rodada 2 (BUG-001 do QA `documentacoes/reviews/2026-10-25-qa-fnd-009.md`)

**Sintoma:** a suite Python falhava de forma intermitente (4 de 20 execucoes no QA): `test_header_server_neutro_e_metodos_nao_get_com_red_e_log` (observability-py) e `test_healthz_readyz_correlation_e_sem_vazamento` (tenant-runtime).

**Causa raiz (reproduzida):** em `nucleos_observability/http.py` o handler enviava a resposta HTTP (`_send` dentro de `_dispatch`) ANTES de registrar metrica e log. O cliente de teste, ao receber a resposta, lia o stream de log imediatamente; a thread do handler (ThreadingHTTPServer) ainda nao tinha escrito o registro. O teste do observability-py mascarava a corrida com `time.sleep(0.05)` (insuficiente sob carga); o do tenant-runtime nao tinha espera alguma. Reproducao ANTES da correcao: suite `packages/observability-py` + `services/tenant-runtime` em loop com 4 processos de carga de CPU (nproc=4): **5 falhas em 30 execucoes**.

**Correcao (deterministica, sem enfraquecer assercoes):** `_dispatch` agora so decide `(status, corpo, cabecalhos)`; `_handle` registra RED/span/log e SO ENTAO chama `_send`. Assim, quando o cliente recebe a resposta, o registro ja foi escrito (happens-before). O `time.sleep(0.05)` foi removido do teste; nenhuma assercao foi alterada. Consequencia: `duration_ms` mede o processamento ate a decisao da resposta, sem o tempo de escrita no socket (aceitavel e documentado aqui). Alternativa descartada: polling/sleep no teste, que apenas esconderia a ordem real (log depois da resposta).

**Validacao da rodada 2 (reais):**

| Verificacao | Resultado |
|---|---|
| Reproducao antes (subset py, carga 4x CPU) | 5/30 falhas |
| Depois, subset py com carga 4x CPU | 0/60 falhas |
| Depois, `uv run --frozen --all-packages pytest` completo, 50 execucoes consecutivas, sem carga | 0/50 falhas |
| `make lint` / `make test` | OK; pytest 18 passed; turbo 12/12 |

Notas N1..N3 do QA permanecem conhecidas e nao tratadas aqui; itens ADIADOS inalterados. Lessons: nao aplicavel (mesma justificativa acima).

## Correcao rodada 3 (integracao com `revisao/2026-10-25-ep00-ep01-fundacao`)

**Motivo:** a branch de integracao (HEAD `c09f6fc8c7000090bbf12da543c8151ed2fe1001`) ja continha FND-002 (linters estritos) e FND-004; a FND-009 foi escrita antes dessas regras.

**Merge (`a49a167`, `merge: integra revisao em FND-009`, sem amend):** conflitos em `services/{ai-gateway,event-dispatcher,tenant-runtime,tool-gateway}/tests/test_health.py` (mantida a versao da FND-009, mais rica), `pnpm-lock.yaml` e `uv.lock` (regenerados com `pnpm install --no-frozen-lockfile` e `uv lock`; nao editados a mao). O auto-merge de `apps/api/src/health.test.ts` deixou um `AddressInfo` sem import (erro TS2304); corrigido no commit de correcao.

**Correcoes de lint (sem desligar regra, sem alterar config de FND-002, sem enfraquecer assercoes):**
- `no-confusing-void-expression`: arrows com corpo `{ ... }` em `apps/api/src/observability.ts`, `packages/observability/src/http.ts` e `observability.test.ts`; `res.writeHead(200); res.end("ok")` em instrucoes separadas.
- `no-useless-assignment`: `let ok: boolean;` (sem valor inicial inutil) em `handleProbe`.
- `restrict-plus-operands`: `(c: Buffer) => { body += c.toString(); }` no helper `get` do teste.
- `no-misused-promises`: o handler async passado a `observeHttp` virou handler sincrono com IIFE `void (async () => {...})().catch(...)`; a falha antes silenciosa agora destroi a resposta (o teste falha em vez de pendurar). `runJob` e sincrono, entao o `Promise.resolve(...).then(done)` foi trocado por chamada direta seguida de `done()` (mesma ordem de efeitos).
- `apps/api/src/health.test.ts`: `app.getUrl()` em vez de cast `as AddressInfo` (padrao da integracao).
- Python (ruff S310/PT017/PT018/E501/I001): os 4 `test_health.py` passaram a usar `http.client.HTTPConnection` (sem `urlopen` de URL dinamica, sem `try/except` com assert); assercoes equivalentes, `assert a and b` dividido em duas.
- mypy strict: adicionado `packages/observability-py/src/nucleos_observability/py.typed` (o pacote e tipado; sem isso `import-untyped` nos servicos).
- `pnpm run format` (prettier) reformatou arquivos da FND-009 (`apps/tenant-provisioner/src/server.ts`, `server.test.ts`, etc.), apenas quebras de linha.

**Validacao (reais, na worktree apos o merge):**

| Verificacao | Resultado |
|---|---|
| `make setup` (com `--frozen`) | rc 0 |
| `make lint` (tsc, eslint, depcruise, prettier, ruff, ruff format, mypy, lint-imports, gitleaks, regressao dos linters) | rc 0; 0 erros; 9 avisos `security/detect-object-injection`/`detect-unsafe-regex` (nivel warning da config de FND-002) em `packages/observability/src/{http,logger,red,redact}.ts`, nao tratados |
| `make test` | rc 0; pytest 18 passed; testes TS de todos os pacotes passam |
| `make build` | rc 0 (turbo + wheels/sdists) |
| `pytest --all-packages` em loop | 40 execucoes consecutivas, 0 falhas (flaky da rodada 2 continua corrigido) |

Lessons: nao aplicavel (mesma justificativa; correcoes de lint/integracao). Sem pendencias novas alem das ja listadas e dos 9 avisos acima.

## Impactos, riscos e rollback

- `GET /healthz` mantem o formato anterior; `/readyz` e novo. Log JSON agora vai a stdout nos servicos (probes em nivel `debug`, ocultos por padrao).
- Riscos: pinos exatos em linha nova do OTel (v3/0.300) a revisar em upgrades; `routeOf` do Express depende de `req.route` (rotas fora do Nest viram `unmatched`); redacao por padrao e conservadora (campos novos exigem entrada na allowlist).
- Rollback: reverter os dois commits (feature e correcao rodada 1); a rodada 1 sozinha pode ser revertida, mas restauraria `trustEdge=true` por padrao e a redacao anterior (inseguras).

## Commits e diffs

Base `4be3ce391a51b9e24cd85f7c894d841636dcd50f`.

1. `e383f8884006b8e3a0b4234476edd607388aad0d` - `feat(observabilidade): baseline de logging, redacao, OTel e sondas (FND-009)`. **Historia:** este commit e resultado de um `git commit --amend` de `b7ec5f3` (reflog: `b7ec5f3` -> `e383f88`); o amend alterou somente `documentacoes/` (o patch de codigo nao mudou). `b7ec5f3` nao esta mais na branch.
2. Commit da correcao rodada 1 (sem amend, sobre `e383f88`): mensagem `fix(observabilidade): correcoes da rodada 1 de review (FND-009)`; o SHA nao pode constar no proprio commit e e reportado ao coordenador (consulte `git log`).

3. Commit da correcao rodada 2 (sem amend, sobre `6217fd4`): mensagem `fix(observabilidade): resposta HTTP apos o log, elimina corrida nos testes (FND-009)`; SHA reportado ao coordenador (consulte `git log`).

4. Merge `a49a167` - `merge: integra revisao em FND-009` (resolucao de conflitos; os lock files e a historia vem da integracao).
5. Commit da correcao rodada 3 (sem amend, sobre `a49a167`): `fix(observabilidade): ajusta FND-009 ao lint estrito da integracao (FND-009)`; SHA reportado ao coordenador (consulte `git log`).

Patches (secoes "Correcao rodada 1", "Correcao rodada 2" e "Correcao rodada 3" para os commits 2, 3 e 5): [diffs](2026-10-25-fnd-009-baseline-observabilidade-diffs.md) (a secao "Correcao rodada 1" contem o diff do commit 2; a escrita em `documentacoes/` nao entra no patch).

## Lessons

Nao aplicavel nesta entrega (inclui a rodada 1): `lessons/README.md` (LOC-001, em paralelo) e o indice canonico e ainda nao tem lessons publicadas; criar arquivo numerado aqui conflitaria com a reorganizacao em curso. Conceitos candidatos para quando a trilha existir: redacao por allowlist, correlation id, cardinalidade de metricas.

## Pendencias

- Extracao de `traceparent`/propagacao de trace em chamadas de saida; instrumentacao do `apps/web`.
- `/readyz` sem dependencias reais ate existirem banco/fila; `JobEnvelope` oficial em FND-003; politica de labels por tenant em DEC-010; exemplars nao verificados.

## Atualizacao no fechamento do lote (2026-10-26)

Lesson criada na tarefa `tarefa/lessons-pendentes` ([registro](../engenharia/2026-10-26-lessons-pendentes.md)): [05 - Logs estruturados, correlation ID e redacao por allowlist](../../lessons/05%20-%20Logs%20estruturados%2C%20correlation%20ID%20e%20redacao%20por%20allowlist.md) (pino/structlog, correlation ID, `trustEdge`, redacao por allowlist; exemplos TypeScript e Python executados). As justificativas anteriores de "sem lesson" (secao "Lessons" acima) estao superadas; a pendencia de lesson foi encerrada. Indice: [lessons/README.md](../../lessons/README.md).
