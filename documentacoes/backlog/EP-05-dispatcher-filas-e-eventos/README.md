# EP-05 — Dispatcher, filas e eventos em tempo real

> Prefixo: `ENT-MSG` · Sprints: S03–S08 · Tickets: 7 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Implementar a execução assíncrona e durável (ADR-009) com **canal de entrega autenticado por tenant** (ADR seção 9): APIs registram intenção e devolvem `job_id`; o Dispatcher valida produtor, assina a atribuição e entrega ao runtime correto por *pull* com *lease*; o runtime confirma que o job pertence à sua identidade. Inclui identidade de serviço dos runtimes, retries/DLQ, limites de concorrência e o stream de eventos em tempo real para a interface.

## Decisão de partida (a confirmar no ADR-021)

PostgreSQL do Control Plane como fonte de verdade das tarefas (estados explícitos, transacional com *outbox*); runtime **busca** trabalho (sem broker exposto e sem porta de entrada para jobs); Redis apenas para limites de taxa e pub/sub efêmero. Redis/BullMQ **não** é fonte única de verdade de operação crítica (ADR seção 9).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-MSG-001](tickets.md#ent-msg-001) | Modelo de jobs, envelope assinado e outbox | S04 | M | ALTO | DEC-007, IAM-002, FND-003 |
| [ENT-MSG-002](tickets.md#ent-msg-002) | Identidade de serviço do runtime | S04 | L | CRÍTICO | DEC-004, MSG-001 |
| [ENT-MSG-003](tickets.md#ent-msg-003) | Dispatcher: enfileirar, *lease*, heartbeat, ack/nack | S05 | L | CRÍTICO | MSG-001, MSG-002, RUN-001 |
| [ENT-MSG-005](tickets.md#ent-msg-005) | Concorrência e justiça por tenant | S05 | S | MÉDIO | MSG-003 |
| [ENT-MSG-004](tickets.md#ent-msg-004) | Retries, DLQ e reconciliação | S06 | M | ALTO | MSG-003 |
| [ENT-MSG-006](tickets.md#ent-msg-006) | Stream de eventos em tempo real com autorização | S06 | L | ALTO | MSG-003, IAM-004 |
| [ENT-MSG-007](tickets.md#ent-msg-007) | Testes de adulteração e resiliência (SEC-07) | S08 | M | CRÍTICO | MSG-003, MSG-004 |

## Critério de saída

SEC-07 automatizado: `tenant_id`/token/URL adulterados são rejeitados no Dispatcher **e** no consumidor; reinício do Dispatcher/runtime não perde nem duplica efeito; DLQ e backlog observáveis.

## Riscos

- Dispatcher é um ponto privilegiado (*confused deputy*): nunca confiar em `tenant_id` do payload; toda atribuição assinada e conferida.
- Jobs perdidos por reinício do Redis, caso seja usado indevidamente como fonte de verdade.
