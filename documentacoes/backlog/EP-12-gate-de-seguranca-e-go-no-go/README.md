# EP-12 — Gate de segurança e go/no-go

> Prefixo: `ENT-GATE` · Sprints: S10–S11 · Tickets: 8 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Cumprir o **gate obrigatório da seção 15 do ADR**: nenhum cliente real é ativado enquanto algum dos testes SEC-01 a SEC-18 falhar ou não tiver sido executado. Consolida a execução, evidências e o parecer go/no-go. Os testes individuais são **construídos nos épicos de origem** (ver [../rastreabilidade.md](../rastreabilidade.md)); este épico os orquestra, repete contra o ambiente de staging com a configuração de produção e adiciona carga, caos, revisão independente, recuperação de desastre e dossiê.

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-GATE-001](tickets.md#ent-gate-001) | Suíte única SEC-01..SEC-18 e dossiê de evidências | S10 | L | CRÍTICO | IAM-010, DAT-005, ISO-008, MSG-007, RAG-003, PRV-006 |
| [ENT-GATE-002](tickets.md#ent-gate-002) | Teste de carga com 5 tenants e rajadas de LLM (SEC-17) | S10 | L | ALTO | RUN-007, AIG-002, MSG-005 |
| [ENT-GATE-003](tickets.md#ent-gate-003) | Testes de falha e caos (SEC-18) | S10 | M | ALTO | PRV-007, MSG-007 |
| [ENT-GATE-006](tickets.md#ent-gate-006) | Revisão de custos e capacidade com benchmark | S10 | M | MÉDIO | RUN-007, OBS-002, GATE-002 |
| [ENT-GATE-004](tickets.md#ent-gate-004) | Revisão de segurança independente / teste de invasão | S11 | L | CRÍTICO | GATE-001 |
| [ENT-GATE-005](tickets.md#ent-gate-005) | Simulação de incidente e recuperação de desastre | S11 | M | ALTO | DAT-008, OBS-004 |
| [ENT-GATE-007](tickets.md#ent-gate-007) | Dossiê LGPD, riscos residuais e termos ao cliente | S11 | S | ALTO | DEC-011, PRV-010 |
| [ENT-GATE-008](tickets.md#ent-gate-008) | Go/no-go formal e checklist do primeiro cliente real | S11 | S | CRÍTICO | GATE-001..007 |

## Critério de saída (da primeira parte do projeto)

Parecer formal **GO** com: SEC-01..18 aprovados e documentados (proprietário, versão, data), achados críticos/altos do teste independente corrigidos ou riscos aceitos formalmente, restauração por tenant ensaiada, custos e capacidade revisados, dossiê LGPD revisado por responsável legal. Qualquer SEC reprovado ⇒ **NO-GO**.

## Observação

Os 2 sprints finais reservam **folga de remediação**: achados de GATE-001/004 retornam aos épicos de origem como tickets de correção, com novo ciclo de teste. Não comprimir esse tempo para cumprir uma data.
