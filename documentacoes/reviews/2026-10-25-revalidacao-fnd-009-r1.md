# Revalidacao focal FND-009 - rodada 1 - 2026-10-25

- Papel: REVISOR independente (nao implementou; sem edicao de codigo, sem commit). Modo: revalidacao depois de correcoes (`revisor-de-codigo`), com raio de impacto de seguranca (AppSec) e correcao.
- Tarefa: FND-009 (baseline de observabilidade). Branch `tarefa/fnd-009`, worktree `/home/vinicius/nucleos-worktrees/tarefa/fnd-009`.
- Commit de correcao: `6217fd453ee718797cbb6694b4e1451b363f56d1` (`fix(observabilidade): correcoes da rodada 1 de review (FND-009)`); pai `e383f8884006b8e3a0b4234476edd607388aad0d` (HEAD = 6217fd4; `git status` da worktree limpo antes e depois das verificacoes).
- Fontes: `documentacoes/reviews/2026-10-25-review-fnd-009.md` (veredito original CHANGES REQUESTED, preservado) e `documentacoes/reviews/2026-10-25-auditoria-fnd-009.md` (itens APLICAR).
- Escopo lido integralmente: `redact.ts`, `logger.ts`, `redact.py`, `logger.py`; diff `e383f88..6217fd4` de `context.ts/py`, `http.ts/py`, dos `app.py` dos 4 servicos Python e dos testes. Fora do escopo: itens ADIAR (OTLP malformado, exemplars).

## Verificacoes realmente executadas (Node 24.22.1, Python 3.13.17 do `.venv`)

| Comando | Resultado |
|---|---|
| `make setup` | OK (lockfile e uv sync em dia) |
| `make lint` | OK (turbo, 8 tasks; mostra `cache hit` = replay) |
| `make test` | TS: replay de cache; Python: 18 passed |
| `tsc -p tsconfig.json` + `node --test "dist/**/*.test.js"` em `packages/observability` (execucao real, sem cache) | 14 tests, 14 pass, 0 fail |
| `make up` / `make health` | 7 componentes OK (web, api, tenant-provisioner, tenant-runtime, ai-gateway, tool-gateway, event-dispatcher) |
| `make down` | OK; nenhuma porta 3000-3002/8001-8004 em escuta, 0 processos remanescentes da worktree |
| Scripts de ataque (scratchpad, importando `dist/` e `src/`, nao alteram a worktree) | resultados abaixo |

Nota: `pnpm` so existe via shim do Makefile (`.run/bin`); `turbo --force` fora do Makefile falhou por falta do binario do gerenciador, entao a execucao real dos testes TS foi feita direto com `tsc` + `node --test` no pacote.

## Validacao 1 - "truncar antes do scrub": a interpretacao do executor esta correta?

**Sim.** O texto da auditoria ("`scrubString` trunca a 256 e depois aplica os padroes ... a inversao e gratuita") descreve o estado original (truncar, depois aplicar padroes) como o defeito e a inversao como correcao. Ordem implementada: padroes sobre a string inteira, depois corte em 256 (`scrubString` em `redact.ts`; `_scrub` em `redact.py`). E a ordem que fecha o risco real: os padroes enxergam o segredo completo, entao uma ocorrencia que atravessa a posicao 256 e substituida inteira por `[REDACTED]` antes do corte; com corte primeiro, o padrao poderia ver apenas fragmento (palavra-chave cortada, JWT truncado) e deixar prefixo do segredo. Evidencia (TS e Python, regra `free`): `"x"*250 + "Bearer " + S`, `"x"*240 + " password=" + S` e `"x"*240 + " eyJ...<jwt>"` nao deixam nenhum trecho do segredo; o teste novo "JWT cortado no limite nao deixa prefixo" passa. Observacao: o sufixo `...` e adicionado depois do scrub, entao nao ha como ele gerar match. Custo/ReDoS: 4 MB de entrada pseudo-JWT em 79 ms e 4 MB de "password " em 17 ms; sem explosao.

## Reproducao dos ataques originais (sentinela `SENTINEL-s3cr3t-XYZ`)

| Ataque | TS | Python |
|---|---|---|
| `items:[S]` | `["[REDACTED]"]` | idem |
| `note:"password="+S` | `[REDACTED]` | idem |
| `route:"/x?token="+S` | `[REDACTED]` | idem |
| dado de topo escalar / lista (tupla em Python) | `{"_dropped":1}` | idem |
| `Error` de topo | `{"_dropped":1}` | idem |
| `Error.name = S` (aninhado) | `{"name":"[REDACTED]"}` | idem (nome de classe `SENTINEL-s3cr3t-XYZ`) |
| `logger.log` com S, `[S]`, Error, `{items:[S]}`, objeto com getter que lanca | 5 linhas reais sem sentinela; getter => `"data":"[REDACTION_ERROR]"` | 5 linhas sem sentinela; subclasse de dict que lanca => `{"_dropped":1}` |
| `x-request-id` valido vindo de cliente direto | substituido por UUID (aceito somente com `trustEdge=true`) | idem; servidor real: `x-request-id: abcdefgh12` do cliente => UUID novo |
| `\n` / `\r\nX: 1` no id | UUID (com e sem trust) | UUID (com e sem trust; `fullmatch`) |
| `Server` header (Python, 4 servicos reais) | n/a | `Server: nucleos ` (sem versao de Python/BaseHTTP) em 200/404/405 |
| `POST /x`, `PUT`, `DELETE`, `OPTIONS` | api/provisioner: 404 | 404/405 com `x-request-id`, amostra RED e log (`method":"POST"` registrado) |
| `/readyz` pendurado (check de 3 s) bloqueando `/healthz` | teste proprio passa: 503 em ~2 s e `/healthz` nao espera | `/healthz` durante `/readyz` lento: 200 em 0,0 s; `/readyz` 503 em 2,01 s |
| getter que lanca no handler de `close` | teste "getter que lanca ... span encerrado" passa | `try/except/finally` com `span.end()` por leitura do diff; `Logger` captura erro de redact |

## Tentativas novas de bypass da regra "string so sob chave com validador"

Resistiram (todas `ok`, sem sentinela): string sob chave sem regra (inclusive lista de nomes); matriz aninhada `items:[[S],[[S]]]`; objeto "array-like" `{0:S}`; `__proto__` via JSON.parse; objeto de prototipo nulo; chave com caixa diferente (`ROUTE`); sentinela como nome de chave; `String` object, `Map`, `Buffer`, `Date`, instancia de classe, `bigint`, `Symbol` (todos `[UNSUPPORTED]`); objeto com `toJSON`; profundidade 5 (`[TRUNCATED]`); `set`, `bytes`, `OrderedDict`, subclasse de `str`, chave inteira (Python); validador com quebra de linha (`/a\n`, fullmatch/`$` sem flag `m`) => `[REDACTED]`; `status`/`duration_ms` string => `[REDACTED]`; `Infinity/NaN` => `null` (JSON).

Passaram a vazar (limite de design, sem caminho de producao hoje; ver REVIEW-007/008):
- Valores que satisfazem o charset do validador: `route:"/"+S`, `route:"/reset/"+S`, `route:["/"+S]`, `check:S`, `job_type:S`, `method:"SENTINELSECRET"` (TS e Python, com `DEFAULT_RULES`). Validador por charset prova formato, nao ausencia de segredo (a propria auditoria alertou: "SENTINEL-s3cr3t-XYZ e charset seguro").
- `Error.name` sem hifen (`SENTINELs3cr3tXYZ`) passa em `NAME_PATTERN` (TS e Python).
- Chave `free` com padrao nao coberto (`pwd=S`) passa; e opt-in explicito, contrato do chamador.

## Decisao por ID

### REVIEW-001 (MEDIO) - RESOLVIDO
Padrao `false` em `resolveCorrelationId`, `observeRequest`, `resolve_correlation_id`, `make_handler`. Testes novos TS/Python (padrao ignora cliente; com flag aceita so formato seguro) e `api/health.test.ts` ajustado passam. Servidores reais (7 componentes): id do cliente nunca ecoado. Nenhuma integracao passa a flag (FND-007 a define).

### REVIEW-002 (MEDIO, bloqueante AC-2) - RESOLVIDO (com ressalva do REVIEW-007/008)
Todos os vetores reproduzidos originalmente fecham em `redact` e na linha real de `logger.log`, em TS e Python; propriedade com sentinelas em string sob chave permitida, item de array, topo escalar/lista e `Error.name`; testes negativos preservam valores validos. A afirmacao "AC-2 provado so nas classes listadas" do documento da entrega e honesta quanto a rodada; as ressalvas abaixo sao residuais de design, nao regressao.

### REVIEW-003 (BAIXO) - RESOLVIDO
`fullmatch` em `resolve_correlation_id` e `run_job`; `abcdefgh\n` e `abcdefgh\r\nX: 1` => UUID. TS ja era correto (`$` sem flag `m`), confirmado.

### REVIEW-004 (BAIXO) - RESOLVIDO (nos servicos Python), com observacao
`Server: nucleos`, metodos GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS tratados com RED+log e `x-request-id`; metodo normalizado em `OTHER` na label. Observacoes (REVIEW-009): `HEAD /healthz` devolve 405 (a ramificacao `self.command != "HEAD"` em `_send` e codigo morto) e `api` (Express) ainda emite `X-Powered-By: Express`.

### REVIEW-005 (BAIXO) - RESOLVIDO
(a) Python: checks em `ThreadPoolExecutor` com prazo unico de 2 s e `ThreadingHTTPServer` nos 4 servicos; TS: `Promise.all` com timeout por check; reproduzido `/healthz` 200 em 0,0 s durante `/readyz` de 3 s e `/readyz` 503 em 2,01 s. (b) `try/catch/finally` com `span.end()` no `close` (TS) e `try/except/finally` (Python); getter que lanca nao derruba. Residual: ver REVIEW-010.

### REVIEW-006 (BAIXO, documentacao) - RESOLVIDO (com um residual formal)
Documento da entrega registra o amend `b7ec5f3` -> `e383f88` (so `documentacoes/`), o commit de correcao sem amend, o diff da rodada no arquivo `-diffs.md`, a reconciliacao do AC-2 e a justificativa de nao haver lesson (indice sem lessons publicadas, LOC-001 em paralelo). Residual: o SHA `6217fd4` ainda nao consta no texto (o proprio documento diz que e reportado ao coordenador); incluir em fechamento posterior.

### Validacao 1 (truncar antes do scrub) - RESOLVIDO (interpretacao correta; ver secao acima)

## Achados novos (todos nao bloqueantes)

- **REVIEW-007 (BAIXO, seguranca)** - Validadores de `route`, `check`, `job_type`, `method` sao por charset (`redact.ts` `DEFAULT_RULES`; `redact.py` `DEFAULT_RULES`). Um valor caller-controlled com formato valido (`/reset/<token>`, `check:<segredo>`) atravessa. Hoje os valores vem do codigo (template de rota, `PROBES`, nomes de check/job), entao nao ha vazamento alcancavel; o risco e de uso indevido futuro. Recomendacao: documentar na API/doc que os campos padrao so aceitam valores gerados pelo codigo (nao dados de entrada), e, em FND-007/EP-11, validar `route` contra o conjunto de templates declarados; opcional: enumerar `check`/`job_type` registrados. Teste: `route` fora do conjunto declarado => `[REDACTED]`.
- **REVIEW-008 (BAIXO, seguranca)** - `Error.name`/nome de classe sem hifen e charset-valido passa (`NAME_PATTERN`). Nome de classe e controlado pelo codigo; so `name` atribuido dinamicamente em TS teria risco. Recomendacao: em TS, preferir `value.constructor.name` ou limitar a nomes de classe conhecidos; aceitar como residual se documentado.
- **REVIEW-009 (BAIXO, endurecimento)** - `X-Powered-By: Express` na `api` (stack exposta, sem versao); `HEAD` das sondas devolve 405 nos servicos Python (probers que usam HEAD falham). Recomendacao: `app.disable("x-powered-by")` (ou `helmet`) em FND-007; tratar `HEAD` como `GET` sem corpo nas sondas ou remover o ramo morto.
- **REVIEW-010 (BAIXO, robustez)** - `pool.shutdown(wait=False)` deixa a thread de um check que nunca retorna viva; cada `/readyz` adiciona uma thread (medido: 3 s de espera, threads voltam a 2 apos o termino). Check infinito acumularia threads e atrasaria o encerramento do processo. Recomendacao: reutilizar um executor limitado ao `make_handler` ou exigir que checks tenham timeout proprio (documentar).

## Precisa de validacao / nao verificado
- Trafego OTLP real e exemplars (ADIAR, conforme auditoria); nenhum teste tocou banco ou servico externo (somente processos locais em 127.0.0.1).
- Execucao do `make test` TS foi replay de cache; compensada pela execucao real de `node --test` no pacote de observabilidade (14/14). Os demais pacotes TS (api, tenant-provisioner, sdk) nao foram reexecutados sem cache por mim; o health real dos 7 componentes via `make up/health` e os scripts acima cobrem o comportamento.

## Resumo de classificacao

| ID | Resultado |
|---|---|
| REVIEW-001 | RESOLVIDO |
| REVIEW-002 | RESOLVIDO |
| REVIEW-003 | RESOLVIDO |
| REVIEW-004 | RESOLVIDO |
| REVIEW-005 | RESOLVIDO |
| REVIEW-006 | RESOLVIDO |
| Validacao 1 | RESOLVIDO (interpretacao correta) |
| Regressoes | nenhuma |
| Novos (007 a 010) | BAIXO, nao bloqueantes |

## Veredito: APPROVED WITH NOTES
Todos os IDs APLICAR resolvidos, sem regressao. Notas 007 a 010 sao residuais de design/endurecimento sem caminho de vazamento em producao hoje; encaminhar para FND-007/EP-11 ou aceitar documentadas. O gate consolidado continua dependendo do QA independente (esta revalidacao nao o substitui).
