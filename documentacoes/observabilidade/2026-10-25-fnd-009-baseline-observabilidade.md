# FND-009 - Baseline de observabilidade nos servicos (2026-10-25)

## Metadados

- **Dominio:** observabilidade
- **Tarefa:** ENT-FND-009, lote 2026-10-25-ep00-ep01-fundacao ([ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-009))
- **Branch:** `tarefa/fnd-009`; **base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, arvore limpa
- **Estado:** implementado e validado; aguarda review/QA independentes (nao revisado pelo executor)
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador; sessao retomada apos limite de uso
- **Diffs completos:** [2026-10-25-fnd-009-baseline-observabilidade-diffs.md](2026-10-25-fnd-009-baseline-observabilidade-diffs.md)

## Objetivo, contexto e escopo

Entregar a biblioteca compartilhada (TS e Python) de logging estruturado, redacao, correlation id, OpenTelemetry, sondas e metricas RED, integrada de forma minima aos hello-worlds existentes.

Fora do escopo: coletor/backend OTLP e dashboards (OBS-001), politica de labels por tenant (DEC-010), extracao de `traceparent` de entrada, borda/proxy que define `X-Request-Id` (FND-007), `JobEnvelope` oficial (FND-003), instrumentacao do `apps/web` (Next.js), dependencias reais em `/readyz` (nao ha banco ainda), Makefile/configs de raiz (nenhum bloco novo foi necessario).

## Resumo da implementacao

- `packages/observability` (`@nucleos/observability`, TS, pino 10.4.0) e `packages/observability-py` (`nucleos-observability`, Python, structlog 26.1.0), com a mesma semantica.
- **Campos fixos** em todo log JSON: `ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event` (ausentes = `null`) mais `data` redigido. `tenant_id` so entra via `setTrustedTenant`/`set_trusted_tenant` (fonte confiavel); o middleware nunca le tenant de header.
- **Redacao por allowlist**: so chaves permitidas passam; nomes sensiveis (`authorization, cookie, password, token, secret, prompt, content, api_key`, mais padrao amplo) viram `[REDACTED]` mesmo se permitidos; chaves desconhecidas sao descartadas (nome e valor) e contadas em `_dropped`; `Bearer ...`/JWT em strings sao removidos; Error vira so o nome; limites de profundidade (4), itens (20) e tamanho (256). Headers, query e corpo de requisicao nunca sao logados: o log HTTP contem so metodo, template de rota, status e duracao.
- **Correlation ID**: `X-Request-Id` aceito se `^[A-Za-z0-9._-]{8,128}$` (evita injecao em log) e a borda for confiavel; senao UUID v4. Devolvido no response, propagado por `AsyncLocalStorage`/`contextvars`, `correlationHeaders()` para chamadas de saida, e `JobEnvelope.correlation_id` com `createJobEnvelope`/`runJob` (restaura o id no worker).
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

Criterios: AC-1 ok (testes TS e Python: log, span, metrica da mesma requisicao, HTTP->job->log). AC-2 ok (sentinelas em header/query/cookie e propriedade aleatoria; teste em cada um dos 4 servicos Python, provisioner e api). AC-3 ok (telemetria desabilitada e habilitada com endpoint `127.0.0.1:1` inalcancavel: respostas 200 inalteradas, shutdown sem erro).

Nao executado: lint de estilo/seguranca (FND-002), CI (FND-005), coletor OTLP real (nenhum servico externo usado).

## Impactos, riscos e rollback

- `GET /healthz` mantem o formato anterior; `/readyz` e novo. Log JSON agora vai a stdout nos servicos (probes em nivel `debug`, ocultos por padrao).
- Riscos: pinos exatos em linha nova do OTel (v3/0.300) a revisar em upgrades; `routeOf` do Express depende de `req.route` (rotas fora do Nest viram `unmatched`); redacao por padrao e conservadora (campos novos exigem entrada na allowlist).
- Rollback: reverter o commit unico.

## Commits e diffs

Um commit local em `tarefa/fnd-009` (SHA reportado ao coordenador; nao pode constar no proprio commit). Patch: [diffs](2026-10-25-fnd-009-baseline-observabilidade-diffs.md).

## Lessons

Nao aplicavel nesta entrega: `lessons/README.md` (LOC-001, em paralelo) e o indice canonico e ainda nao tem lessons publicadas; criar arquivo numerado aqui conflitaria com a reorganizacao em curso. Conceitos candidatos para quando a trilha existir: redacao por allowlist, correlation id, cardinalidade de metricas.

## Pendencias

- Extracao de `traceparent`/propagacao de trace em chamadas de saida; instrumentacao do `apps/web`.
- `/readyz` sem dependencias reais ate existirem banco/fila; `JobEnvelope` oficial em FND-003; politica de labels por tenant em DEC-010; exemplars nao verificados.
