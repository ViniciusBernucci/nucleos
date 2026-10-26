# Auditoria do review FND-009 (baseline de observabilidade) - 2026-10-25

- Papel: auditor independente (nao implementou, nao revisou). Sessao: subagente de auditoria do coordenador; sem edicao de codigo, sem commit.
- Relatorio de origem: `documentacoes/reviews/2026-10-25-review-fnd-009.md` (veredito original do revisor preservado: CHANGES REQUESTED).
- Tarefa: FND-009. Worktree: `/home/vinicius/nucleos-worktrees/tarefa/fnd-009` (leitura). Branch `tarefa/fnd-009`.
- Base revisada: `4be3ce391a51b9e24cd85f7c894d841636dcd50f`. HEAD revisado e HEAD atual: `e383f8884006b8e3a0b4234476edd607388aad0d` (sem mudanca desde a revisao; `git status` da worktree limpo).
- Especificacao: `documentacoes/backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-009`: "Redacao por allowlist: payloads sao registrados apenas por campos permitidos ... teste de propriedade com dados aleatorios"; "Correlation ID: aceita `X-Request-Id` da borda confiavel"; "/healthz e /readyz ... sem expor versoes internas a clientes externos"; AC-2: "nenhum valor sentinela de segredo aparece na saida de log de nenhum servico".
- Ambiente: Node 24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64/bin`), Python do `.venv` da worktree. Reproducoes por scripts no scratchpad, importando `dist/` (TS) e `src/` (Python) sem alterar a worktree.

## Resumo das decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
|---|---|---|---|
| REVIEW-001 | MEDIO | MEDIO | APLICAR |
| REVIEW-002 | MEDIO | MEDIO (bloqueante para AC-2) | APLICAR |
| REVIEW-003 | BAIXO | BAIXO | APLICAR |
| REVIEW-004 | BAIXO | BAIXO | APLICAR |
| REVIEW-005 | BAIXO | BAIXO (a: MEDIO-BAIXO pela cascata de liveness) | APLICAR |
| REVIEW-006 | BAIXO | BAIXO | APLICAR (somente documentacao) |
| Precisa de validacao 1 (truncar antes do scrub) | s/ sev. | BAIXO | APLICAR (junto de 002) |
| Precisa de validacao 2 (OTLP URL malformada) | s/ sev. | - | ADIAR (FND-006) |
| Precisa de validacao 3 (exemplars) | s/ sev. | - | ADIAR (ja declarado no doc da entrega) |

Veredito: **CORRECOES_NECESSARIAS**. Nenhum achado rejeitado; nenhum bloqueio de informacao.

## Reproducao independente

### REVIEW-002 (TS, `dist/redact.js` e `dist/logger.js`; sentinela `SENTINEL-s3cr3t-XYZ`, allowlist `note, items, route`)
Saidas literais de `redact(...)`:
- `{items:[S]}` -> `{"items":["SENTINEL-s3cr3t-XYZ"]}` (vaza)
- `{note:"password="+S}` -> vaza
- `{route:"/x?token="+S}` -> vaza
- `S` (escalar de topo) -> `"SENTINEL-s3cr3t-XYZ"` (vaza)
- `[S]` (lista de topo) -> vaza
- `Error` com `name=S` -> `{"note":{"name":"SENTINEL-s3cr3t-XYZ"}}` (vaza)
- `logger.log("info","e",S)` e `logger.log("info","e",[S])`: a linha de log real contem `"data":"SENTINEL-s3cr3t-XYZ"` e `"data":["SENTINEL-s3cr3t-XYZ"]`.

### REVIEW-002 (Python, `src/`)
`redact` devolve o sentinela intacto nos mesmos 5 casos (`{'items': [S]}`, `{'note': 'password=S'}`, `{'route': '/x?token=S'}`, `S`, `[S]`). `Logger.log` chama `redact(event_dict["data"], ...)`, logo o escalar de topo vaza tambem em Python. Nao reproduzi `Error.name` em Python: la o nome vem de `type(value).__name__` (nome de classe do codigo), portanto a parte "Error.name" so se aplica a TS.

### Lacuna do teste (leitura de `redact.test.ts`)
O gerador coloca sentinela apenas sob chaves sensiveis, chaves fora da allowlist e `Bearer <sentinela>`; sob chaves permitidas gera objeto aninhado, `Bearer ...` ou numero. Nunca gera sentinela em string comum sob chave permitida, nem dado de topo escalar/lista. O AC-2 so e provado para as classes que o gerador cobre; a afirmacao "AC-2 ok" do documento da entrega excede a evidencia. Confirmado.

### REVIEW-001
`grep` confirma `options.trustEdge ?? true` (`http.ts:36`), `trust_edge: bool = True` (`http.py:35`), `resolveCorrelationId(..., trustEdge = true)` e `resolve_correlation_id(..., trust_edge=True)`; nenhuma ocorrencia de `trustEdge`/`trust_edge` nos 4 `app.py`/integracoes fora da biblioteca e dos testes. Execucao: `resolveCorrelationId("abcdefgh12", true)` -> `abcdefgh12`; com `false` -> UUID. No servidor Python real, `GET /healthz` com `x-request-id: abcdefgh12` respondeu `x-request-id: abcdefgh12` (aceito de cliente direto). Nao ha borda confiavel (FND-007 ainda nao existe), logo o padrao contraria "da borda confiavel".

### REVIEW-003
`resolve_correlation_id("abcdefgh\n", True)` -> `'abcdefgh\n'` (Python); TS -> UUID novo (`resolveCorrelationId("abcdefgh\n", true)` devolveu um UUID). Causa: `_VALID_ID.match` com `$` (`context.py:15,51,80`; a linha 80 e o caminho do `JobEnvelope`). Confirmado.

### REVIEW-004 e REVIEW-005 (servidor Python real, `make_handler` em `HTTPServer`)
- `GET /healthz` -> `200`, `Server: BaseHTTP/0.6 Python/3.13.17`.
- `POST /x` -> `501`, mesmo header `Server`, sem `x-request-id` (fora da instrumentacao).
- `/readyz` com check bloqueante de 3 s: `GET /healthz` concorrente respondeu `200` apenas apos 2,71 s (servidor single-thread; liveness bloqueada por check pendurado). `/readyz` terminou em 3,0 s sem timeout.
- TS: por leitura de `http.ts`, checks rodam em `for ... await` sequencial com timeout de 2 s cada (pior caso N x 2 s). Getter que lanca dentro de `res.once("close")`: `Object.entries` invoca o getter em `walk`, a excecao sai de um handler de evento e nao e capturada; confirmado por leitura, nao reexecutado por mim (o revisor reproduziu).

## Decisao por achado

### REVIEW-001 - APLICAR (MEDIO)
- Criterio: spec "aceita `X-Request-Id` da borda confiavel"; sem borda, cliente direto forja/colide ids em log e span.
- Codigo: `http.ts:36`, `http.py:35`, `context.ts:40`, `context.py:49`.
- Risco da alteracao: baixo. Mudar o padrao para `false` nas duas bibliotecas (funcao de contexto e opcoes HTTP); testes existentes que esperam aceitacao precisam passar a ligar a flag explicitamente. Nenhuma integracao depende do padrao antigo (nenhuma passa o parametro).
- Plano minimo: padrao `false` em `resolveCorrelationId`, `observeRequest` e `make_handler`/`resolve_correlation_id`; ligar apenas quando FND-007 definir o proxy (opcionalmente via variavel de ambiente explicita, default `false`, validada em FND-006). Atualizar comentario/doc.
- Teste esperado: com o padrao, `x-request-id: abcdefgh12` e substituido por UUID (TS e Python, via servidor real ou `observeRequest`); com `trustEdge=true`, aceito; id invalido continua UUID mesmo com a flag.

### REVIEW-002 - APLICAR (MEDIO, bloqueante)
- Criterio: spec "registrados **apenas por campos permitidos**" e AC-2 "nenhum valor sentinela ... de nenhum servico"; o teste de propriedade pedido deve provar o AC. Vazamento hoje depende de a allowlist ser ampliada (a padrao e de campos controlados), mas a biblioteca e o contrato publico e a prova do AC e insuficiente: o defeito de aceite e a evidencia, mais a API que aceita escalar/lista de topo e strings livres.
- Codigo: `redact.ts` `walk` (strings passam por `scrubString`, so Bearer/JWT), `redact.py` `_walk`/`_scrub`, `logger.ts`/`logger.py` (`data` desconhecido).
- Risco da alteracao: medio-baixo; muda formato de saida de strings sob chaves permitidas (hoje so `route`, `method`, `check`, `job_type`, que sao controladas).
- Plano minimo (nesta ordem):
  1. `log()`/`redact` de topo: aceitar somente objeto simples; escalar, lista e demais tipos viram `{"_dropped": 1}` (ou `[REDACTED]`) em TS e Python.
  2. Valores string sob chave permitida so passam se a chave tiver validador declarado. Allowlist da biblioteca fica como mapa chave -> validador (ex.: `method` enum, `route` template `^/[A-Za-z0-9_\-./:{}]*$` sem `?`/`=`, `check`/`job_type` identificador `^[A-Za-z0-9_.-]{1,64}$`); chaves sem validador aceitam apenas numero/booleano/null, e string vira `[REDACTED]`. Chaves adicionadas por servicos devem declarar o validador ou "string livre" explicito (opt-in documentado como contrato do chamador). Observacao de auditoria: um filtro apenas por charset nao basta, porque `SENTINEL-s3cr3t-XYZ` e charset seguro; a regra correta e "string so com validador por chave".
  3. `Error`: manter somente `constructor.name` validado por `^[A-Za-z0-9_.$]{1,64}$` (TS); Python ja usa o nome da classe.
  4. Scrub antes do truncamento (ver Validacao 1) e scrub extra de `(password|token|secret|api[-_]?key)\s*[=:]\s*\S+` como defesa em profundidade para strings livres opt-in.
  5. Estender o teste de propriedade (TS e Python) com sentinela em string comum sob chave permitida (sem validador), em item de array, em dado de topo escalar/lista e em `Error.name`; asserir ausencia do sentinela na linha de log real de `logger.log`, nao so em `redact`.
- Teste esperado: os casos reproduzidos acima passam a nao conter `SENTINEL-s3cr3t-XYZ`; propriedade com 500 iteracoes e sentinelas em strings sob chaves permitidas; teste negativo de que valores validos (`route: "/healthz"`, `status: 200`) continuam presentes. Corrigir a afirmacao "AC-2 ok" no documento da entrega para refletir a regra final.

### REVIEW-003 - APLICAR (BAIXO)
- Criterio: robustez do contrato do id (injecao de quebra de linha em `correlation_headers()` e consumidores de job); paridade TS/Python.
- Codigo: `context.py:15,51,80`.
- Risco: minimo.
- Plano: `fullmatch` (ou `\Z`) nas duas ocorrencias.
- Teste esperado: `"abcdefgh\n"` e `"abcdefgh\r\nX: 1"` -> UUID, em `resolve_correlation_id` e no caminho do envelope de job.

### REVIEW-004 - APLICAR (BAIXO)
- Criterio: spec "sem expor versoes internas a clientes externos"; `Server: BaseHTTP/0.6 Python/3.13.17` reproduzido. A parte de metodos nao-GET: `POST` -> 501 fora de log/RED reproduzido; custo baixo, aplicar no mesmo handler.
- Codigo: `http.py` (`Handler` sem `server_version`/`sys_version`; so `do_GET`).
- Risco: baixo.
- Plano: `server_version = "nucleos"`, `sys_version = ""`; `do_HEAD/do_POST/do_PUT/do_PATCH/do_DELETE/do_OPTIONS` delegando ao mesmo fluxo (resposta 404/405 com RED e log, metodo normalizado para `OTHER` na label).
- Teste esperado: header `Server` sem `Python`/numero de versao em 200/404/405; `POST /x` gera `x-request-id` e amostra RED.

### REVIEW-005 - APLICAR (BAIXO; item a com impacto de liveness)
- Criterio: `/healthz` e "processo vivo"; um check de `/readyz` pendurado bloqueou o `/healthz` por 2,71 s no Python (reproduzido), causando reinicio em cascata em orquestradores. Item b confirmado por leitura.
- Codigo: `http.py` (`bool(check())` direto), `http.ts` (`for ... await` sequencial), `observeRequest` (log/redact em `close` sem try/catch), `_dispatch` Python (span sem `end()` em excecao).
- Risco: baixo a medio (concorrencia no servidor Python).
- Plano minimo: (a) Python: executar cada check com timeout (`concurrent.futures`, 2 s) e usar `ThreadingHTTPServer` (ou documentar o limite e servir `/healthz` sem esperar `/readyz`); TS: `Promise.all` com o mesmo timeout por check. (b) `try/catch` ao redor de `redact`/`log`/`red.record` no handler de `close` (fail-open, registrar `[REDACTION_ERROR]` sem dados) e `try/finally` para sempre chamar `span.end()` em TS e Python.
- Teste esperado: check bloqueante de 3 s nao atrasa `/healthz` alem de ~tolerancia e `/readyz` responde 503 em ~2 s; getter que lanca nao derruba o processo e o span e encerrado; excecao em `_dispatch` encerra o span.

### REVIEW-006 - APLICAR (BAIXO, somente documentacao)
- Criterio: CLAUDE.md exige commits e diffs documentados reais. Reflog confirma `b7ec5f3` -> `e383f88` (amend). O codigo do patch nao mudou, mas a historia deve constar.
- Plano: ao fechar a rodada de correcoes, registrar na secao "Commits e diffs" o amend (b7ec5f3 -> e383f88, so `documentacoes/`) e os novos commits de correcao com SHA e diff; reconciliar o AC-2 e a pendencia de `lessons/README.md` (ou justificativa explicita).
- Teste/verificacao: releitura final dos documentos contra `git log`/`git diff`.

### Precisa de validacao 1 - truncar antes do scrub - APLICAR (BAIXO, junto de REVIEW-002)
`scrubString` trunca a 256 e depois aplica os padroes (`redact.ts`); um JWT cortado antes do segundo ponto pode escapar do padrao `eyJ...\..*\.` parcialmente. A inversao e gratuita. Teste: JWT atravessando o limite de 256 nao deixa prefixo do token.

### Precisa de validacao 2 - OTLP com URL malformada - ADIAR
Fora do AC de FND-009 (a biblioteca ja e no-op quando desabilitada e nao lanca sincronamente com endpoint inalcancavel). Impacto residual: URL invalida pode falhar tarde ou silenciosamente. Condicao de retomada: FND-006 (validacao tipada de `OTEL_*`); decidir fail-fast no boot. Nenhuma tarefa externa aberta.

### Precisa de validacao 3 - exemplars/correlacao metrica-trace - ADIAR
O documento da entrega ja declara nao verificado. A correlacao exigida no AC-1 e por `correlation_id` (log+trace+metrica), coberta pelos testes existentes; exemplars sao opcionais. Condicao de retomada: ambiente com collector real (FND-006/infra de observabilidade).

## Itens nao executados por esta auditoria
`make build`, `make up/health`, `make lint`, `make test` completos, trafego OTLP real, e a reproducao de `Error.name` em Python (nao aplicavel por leitura) e do getter que lanca (confirmado por leitura). O revisor ja executou lint/test; os turbo `cache hit` do review sao replay de log, nao reexecucao.

## Encaminhamento ao review-loop-driver
APLICAR: REVIEW-001, 002, 003, 004, 005, 006 e Validacao 1. Ordem sugerida: 003 e 004 (triviais), 001, 005, 002 (maior; com os testes de propriedade ampliados), 006 por ultimo (documentacao refletindo o estado final). ADIAR: Validacao 2 e 3. Apos as correcoes, o revisor valida em sessao independente; esta auditoria nao reabre ADIAR sem fato novo. Esta auditoria nao autoriza implementar fora do ciclo do orquestrador.

## Veredito: CORRECOES_NECESSARIAS
O veredito original CHANGES REQUESTED do revisor permanece; o gate consolidado fica pendente das correcoes acima e da revalidacao independente. REVIEW-001 e REVIEW-002 sao bloqueantes (padrao inseguro sem borda; AC-2 nao provado nas classes reproduzidas).
