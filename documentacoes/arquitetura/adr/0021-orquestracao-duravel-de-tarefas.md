# ADR-021 — Orquestração durável de tarefas (fonte de verdade e entrega)

- **Status:** Aceito em 2026-10-26, por decisão do usuário (mensagem \"o que depende de mim está aceito tudo\"). Os pontos em aberto listados neste ADR (H-x e pendências) continuam como parâmetros a confirmar; o aceite não os fecha por inferência.
- **Data:** 2026-10-26
- **Decisores:** a definir pelo usuário (proposta do executor DEC-007, Claude Sonnet 5.5)
- **Origem:** [ENT-DEC-007](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-007); [ADR-009](0009-execucoes-de-ia-assincronas-e-duraveis.md) (execuções assíncronas e duráveis), [ADR-008](0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md) (Redis só como auxiliar), [ADR-017](0017-acesso-a-dados-e-migrations-multi-database.md), [ADR-018](0018-identidade-de-servico-runtime-control-plane-gateways.md)

## Contexto

O ADR-009 exige execuções de IA assíncronas e duráveis, com retries e idempotência, mas não escolhe a fonte de verdade das tarefas nem o mecanismo de entrega. Três opções foram medidas na mesma bancada (containers efêmeros em `127.0.0.1`, mesmo handler, mesmo lease de 5 s): **A** tabela PostgreSQL com lease (`FOR UPDATE SKIP LOCKED`), **B** BullMQ + Redis, **C** Temporal. Requisitos de produto relevantes: limite de 2 tarefas simultâneas por tenant, justiça entre tenants, tarefas agendadas, tarefas humanas aguardando aprovação por dias, auditabilidade e atomicidade com o `outbox` do Control Plane.

## Problema

Qual é a fonte de verdade das tarefas e qual o mecanismo de entrega que não perde nem duplica efeito sob falha (com consumidor idempotente), com a menor complexidade operacional para o MVP?

## Decisão

Proposta (a confirmar):

1. **PostgreSQL do Control Plane é a fonte de verdade** das tarefas: tabela `tasks` com estado explícito (`awaiting_approval`, `queued`, `running`, `done`, e `failed`/`cancelled` a definir), `run_at`, `attempt`, `lease_until`, `lease_owner` e `payload`. Enfileirar é `INSERT ... ON CONFLICT (id) DO NOTHING`, na **mesma transação** do fato de negócio/`outbox`.
2. **Entrega por pull com lease**: o consumidor reivindica uma tarefa com `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)`, renova a lease por heartbeat e conclui com *fencing* (`WHERE id = $1 AND attempt = $2`). Toda a aritmética de tempo usa o relógio do banco (`now()`), nunca o do cliente.
3. **Limite e justiça por tenant** dentro da reivindicação: linha `tenant_state` travada (`FOR UPDATE SKIP LOCKED`) serializa as reivindicações do tenant, conta tarefas `running` com lease válida contra `max_running` (2) e ordena tenants por `last_served_at` (rodízio).
4. **Semântica at-least-once + consumidor idempotente** é obrigatória em qualquer opção: efeito identificado por `task_id` com `ON CONFLICT DO NOTHING` (ou chave de idempotência da ferramenta, ADR-012/Tool Gateway).
5. **Redis** permanece só para limites de taxa e pub/sub efêmero (ADR-008); nenhuma tarefa depende de persistência do Redis.
6. **Temporal não entra no MVP**; é reavaliado pelos gatilhos abaixo. BullMQ não é adotado como fonte de verdade.
7. O acesso do runtime à fila segue o ADR-018: a PoC fez o `claim`/`heartbeat`/`complete` direto em SQL por simplicidade; no produto o runtime chama operações do Control Plane autenticadas pelo token de serviço, e o SQL fica no Control Plane (o runtime não recebe credencial do banco de controle).

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| A. Tabela PostgreSQL com lease (proposta) | Estado auditável por SQL, atomicidade com `outbox`, sem componente novo | Throughput menor (49 tarefas/s na rajada medida) e polling; justiça, limites e retries são código nosso |
| B. BullMQ + Redis (AOF) | Maior throughput (150 tarefas/s), latência menor, API madura de filas, fila por tenant dá limite e justiça | Redis sem AOF perde tudo (50/50 tarefas perdidas); delays dependem do relógio do cliente (S8 falhou); escrita dupla com o banco gera tarefa órfã (S10); estado de negócio ainda precisaria de tabela; um componente stateful a mais |
| B'. BullMQ com backend PostgreSQL (opcional, documentado em 2026-10-26) | Mesma API sobre PostgreSQL | **Não avaliado nesta PoC**; recurso novo, a doc o descreve como alternativa ao padrão Redis "mais testado" (ver fatos); candidato a reavaliar |
| C. Temporal (servidor dev em container) | Execução durável nativa, timers e *signals* para aprovação humana, histórico e UI | Servidor + banco próprio a operar; limite por tenant não é global (S5 com 3 workers chegou a 5 simultâneas); justiça e throughput ruins na configuração dev/sqlite medida (2 tarefas/s na rajada, B/C esperaram até 38 s); RAM 4 a 5 vezes maior; escrita dupla com o banco (S10); modelo de programação novo |

## Benefícios

- Único componente stateful já aprovado (ADR-003/008); backup, auditoria e consulta ad hoc já cobertos.
- Atomicidade enfileirar+negócio (S10) sem outbox adicional entre sistemas.
- Relógio único (o do banco): S8 não afeta a tarefa agendada nem o lease.
- Sobrevive a reinício e `kill -9` do banco sem perda (S2) e a espera humana de qualquer duração é só uma linha (S9).
- RAM incremental ~zero (o banco já existe) e custo de worker menor que Temporal.

## Trade-offs

- Latência fila→início maior que BullMQ (p50 79 ms vs 25 ms a 100 tarefas/min) e throughput máximo menor.
- Polling consome conexões e CPU do banco de controle; exige índice e vacuum disciplinado em tabela de alta rotatividade.
- Retries com backoff, dead-letter, cancelamento, prioridades e métricas são implementados por nós (complexidade de código maior que B; ver contagem de linhas na entrega).
- Lease de 5 s significa recuperação de ~8 s após `kill -9` do worker (medida); tarefas longas precisam de heartbeat.
- Tarefas executadas mais de uma vez são normais (at-least-once): efeitos externos exigem idempotência.

## Consequências

- Trabalho derivado: MSG-001/MSG-003 implementam `tasks`, `tenant_state`, API de claim/heartbeat/complete, reaper, métricas e testes de falha (S1..S10 como regressão).
- Migrations seguem o ADR-017 (tabela no banco de controle).
- Observabilidade: contadores por estado, idade da tarefa mais antiga por tenant, leases expiradas e tentativas (ADR-024), sem payload nos logs.
- Segurança: payload de tarefa pode conter dado de tenant; mantê-lo no banco de controle exige decisão de classificação (ver pendências).
- Documentação/lesson: [lesson 11 (renumerada na integração; era 07, provisória)](../../../lessons/11%20-%20Fila%20duravel%20em%20PostgreSQL%20com%20lease.md).

## Resultados dos cenários por opção

Saída completa: [`../poc/dec-007/evidencia/saida-poc.txt`](../poc/dec-007/evidencia/saida-poc.txt). PASS = nenhum efeito perdido, reentregas absorvidas pelo consumidor idempotente e critério do cenário atendido. **Limite do AC-2:** a tabela `effects` tem chave primária por `task_id`, então "nenhum efeito duplicado" **não é medido de forma independente** (a contagem de efeitos nunca excede o número de tarefas, qualquer que seja a entrega). A PoC prova ausência de perda (efeitos = tarefas) e a absorção das reentregas (execuções > 1 com 1 efeito); a duplicação de efeito sem idempotência de consumidor não foi medida. Medido em 2026-10-26, uma máquina de desenvolvimento (4 vCPU), um único run; tempos variam por execução.

| Cenário | A PostgreSQL lease | B BullMQ (fila por tenant, AOF everysec) | C Temporal (dev server) |
| --- | --- | --- | --- |
| S1 kill -9 do worker no meio da tarefa | PASS, efeito 1, 2 execuções, recuperação 8,1 s | PASS, 8,0 s | PASS, 9,5 s |
| S2 reinício do backend | PASS (graceful e kill -9): 50/50 | Sem AOF: **FAIL 0/50** (graceful e kill); AOF everysec: PASS 50/50 (graceful e kill); AOF always (kill): PASS 50/50 | PASS (graceful e kill): 50/50 |
| S3 entrega duplicada | PASS: reenvio ignorado; crash após efeito, 2 execuções, 1 efeito | PASS: idem (s3-1 também reentregue) | PASS: idem |

Nota S3: o cenário não é idêntico entre opções (A: s3-1 com 1 execução; B e C: 2). A diferença vem do momento do crash em relação às tarefas concorrentes no mesmo worker, não da regra de entrega; a conclusão não muda.
| S4 tarefa agendada +4 s | PASS, 4123 ms | PASS, 4176 ms | PASS, 4778 ms |
| S5 limite 2 por tenant (3 workers) | PASS, máx. 2 | PASS, máx. 2 (fila por tenant + `setGlobalConcurrency`); **fila única FAIL, máx. 6** | **FAIL, máx. 5** (limite é por worker); com 1 worker PASS |
| S6 justiça sob rajada (A 120 tarefas; B, C 6+6) | PASS, espera B/C máx. 1,6 s | PASS, máx. 0,56 s (fila por tenant); **fila única FAIL, 9,3 s** | **FAIL, 38 s** (dev server saturado) |
| S7 reinício do Dispatcher (produtor morto no meio) | PASS, 100/100, 0 reentregas | PASS, 100/100, 0 reentregas | PASS, 100/100 efeitos, 39 reentregas por timeouts de heartbeat sob carga |
| S8a produtor com relógio +6 s, agendada +8 s | PASS, 8173 ms | **FAIL, 14227 ms** | PASS, 9336 ms |
| S8b worker com relógio +2 min, agendada +3 s | PASS, 3063 ms | **FAIL, 71 ms** (executou cedo) | PASS, 3981 ms |
| S9 aprovação humana pendente + reinício de backend e workers | PASS | PASS (delay de 7 dias + `promote`; depende do AOF) | PASS (signal + timer de 7 dias, nativo) |
| S10 rollback da transação de negócio após enfileirar | PASS, 0 órfãs (atômico) | **FAIL**, 1 tarefa órfã (escrita dupla) | **FAIL**, 1 workflow órfão |

Limites da PoC: a saída registrada é de uma execução anterior ao `process.exit` acrescentado ao fim de `poc.mjs` (o processo não encerrava e foi terminado à mão: a saída termina com `exit 143`, depois de "containers destruidos"); a mudança não toca cenários e não foi reexecutada para B e C. As imagens usam tag mutável (`postgres:16`, `temporalio/temporal:latest`) e os digests constam só na saída; produção deve fixar o digest. O `finally` de `poc.mjs` chama `fx.end()` sem guarda, então uma falha antes do primeiro uso pode pular a remoção de containers; o `trap` de `run.sh` cobre o uso documentado (`./run.sh`), não `node poc.mjs` direto. S9 foi em **tempo comprimido** (segundos, não dias); os mecanismos são independentes da duração mas o timeout de 7 dias não foi esperado. Temporal rodou no servidor `start-dev` com SQLite; os resultados de justiça e throughput **não** representam um Temporal de produção com banco dedicado e vários serviços. A opção B' (BullMQ sobre PostgreSQL) não foi medida.

## Métricas (mesma bancada; RAM em MiB via `docker stats` e `VmRSS`)

| Métrica | A PostgreSQL | B BullMQ | C Temporal |
| --- | --- | --- | --- |
| RAM backend ocioso / sob carga | 33 / 36 (PostgreSQL, já existente) | 7 / 7 (Redis) | 80 / 140 |
| RAM de 2 workers ocioso / sob carga | 123 / 133 | 169 / 174 | 634 / 610 |
| Latência fila→início, ocioso (p50/p95, ms) | 116 / 310 | 30 / 91 | 438 / 738 |
| Latência a 100 tarefas/min (p50/p95/máx, ms) | 79 / 314 / 713 | 25 / 148 / 277 | 402 / 1728 / 2257 |
| 100 tarefas em 60 s concluídas em | 59,8 s | 59,7 s | 60,3 s |
| Rajada de 500 tarefas triviais | 10,3 s (49/s) | 3,3 s (150/s) | 269,6 s (2/s) |
| Código da opção (sem o handler comum; B e C ainda precisariam de tabela de estado de negócio e reconciliação) | `impl-pg.mjs` 86 linhas (inclui DDL) | `impl-bullmq.mjs` 54 linhas | `impl-temporal.mjs` + `temporal-workflows.mjs` 82 linhas |
| Componentes a operar além do banco de controle | 0 | Redis com AOF `noeviction` | servidor Temporal + banco próprio |
| Observabilidade nativa | SQL e métricas próprias | contadores de fila, eventos | UI e histórico por workflow |

100 tarefas/min (1,7/s) é folgado nas três opções; o gargalo de requisito não é throughput.

## Fatos de ferramentas (fonte e data de consulta: 2026-10-26)

- BullMQ 6.4.2 (npm, modificado em 2026-10-24); `ioredis` 6.0.0; `pg` 8.23.1; `@temporalio/*` 1.24.0 (npm, 2026-09-15).
- Imagens: `postgres:16` (16.15, `sha256:9e2cf628...0a97`), `redis:8.8.3-alpine` (`sha256:dc95ea2f...eabfca`), `temporalio/temporal:latest` = Temporal CLI 1.9.1, servidor 1.32.0, UI 2.54.1 (`sha256:ad4c82c9...df447e`, criada em 2026-09-14). Digests completos na saída da PoC.
- Documentação BullMQ ([going-to-production](https://docs.bullmq.io/guide/going-to-production)): recomenda AOF (cerca de 1 s por escrita costuma bastar) e `maxmemory-policy noeviction`; job de worker morto vira *stalled* e é reprocessado. [Global concurrency](https://docs.bullmq.io/guide/queues/global-concurrency): limite de paralelismo entre todas as instâncias de worker, por fila. Grupos (concorrência local por grupo) pertencem ao BullMQ **Pro** (pago; não avaliado).
- Documentação BullMQ ([PostgreSQL backend](https://docs.bullmq.io/guide/postgresql)): backend PostgreSQL opcional (PostgreSQL 13+, 14+ recomendado), Redis segue como padrão e "mais testado". Não exercitado.
- Redis ([persistência](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)): `appendfsync everysec` pode perder cerca de 1 s de dados em desastre; `always` faz fsync por comando.
- Temporal ([guia self-hosted](https://docs.temporal.io/self-hosted-guide)): a página consultada não trouxe texto extraível para requisitos de produção; os requisitos de operação do Temporal **não foram verificados** e não são afirmados aqui.

## Quando revisar (gatilhos propostos, a confirmar)

- Vazão sustentada acima de **25 tarefas/s** (metade da rajada medida em A) ou p95 fila→início acima de **2 s** por 15 min com workers ociosos.
- CPU do banco de controle acima de **30%** atribuível ao polling de `tasks`, ou fila ativa acima de **100 mil** linhas `queued/running`.
- Fluxos com mais de **8 passos** dependentes, compensações (saga) ou espera por eventos em mais de **20%** das tarefas: reavaliar Temporal com servidor de produção e banco dedicado.
- Necessidade de prioridade, rate limit por provedor ou *dead-letter* além do que o time quer manter: reavaliar BullMQ (Redis AOF) ou o backend PostgreSQL do BullMQ.
- Mais de **~200 tenants** com tarefas simultâneas (cada reivindicação percorre candidatos por tenant) ou separação de bancos por host.
- Mudança de versão major do PostgreSQL, do BullMQ ou do Temporal.

## Referências

- Ticket: [ENT-DEC-007](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-007)
- PoC: [`../poc/dec-007/`](../poc/dec-007/run.sh) (`run.sh`, `poc.mjs`, `impl-*.mjs`, `worker.mjs`, `producer.mjs`); saída: [`../poc/dec-007/evidencia/saida-poc.txt`](../poc/dec-007/evidencia/saida-poc.txt)
- Entrega: [DEC-007](../../mensageria/2026-10-26-dec-007-orquestracao-duravel.md)

## Pendências que dependem de decisão humana

1. Aceitar, alterar ou rejeitar este ADR (continua **Proposto**).
2. Confirmar os gatilhos numéricos de reconsideração (25 tarefas/s, 2 s p95, 30% CPU, 8 passos, 200 tenants).
3. Aceitar a latência e o throughput menores de A em troca de atomicidade e menos componentes, ou preferir B (Redis AOF) com outbox/reconciliação.
4. Autorizar ou não avaliar o backend PostgreSQL do BullMQ (B') e um Temporal de produção antes de MSG-001.
5. Política de classificação do `payload` das tarefas no banco de controle (dados de tenant) e retenção das linhas `done`.
6. Política de retry (máximo de tentativas, backoff, dead-letter) e semântica de cancelamento.
