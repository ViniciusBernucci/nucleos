# EP-07 — Tool Gateway e AI Gateway

> Prefixos: `ENT-TGW` e `ENT-AIG` · Sprints: S05–S07 · Tickets: 9 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Materializar a regra central do ADR: **o LLM não participa da decisão de segurança** (seção 8.1). O Tool Gateway é a única via para dados, arquivos, RAG e integrações, com política *deny-by-default* reavaliada a cada chamada (ADR-012). O AI Gateway é a única via para provedores de LLM, com identidade, quotas, custo e orçamento obrigatórios por tenant/agente (ADR-007, ADR-015).

## Topologia assumida (confirmar no ADR-025)

| Componente | Posição | Detém |
| --- | --- | --- |
| **Tool Gateway** | **sidecar por tenant** (mesma imagem), na rede local do tenant | credenciais de integração **daquele tenant**, papel `…_tools` do PostgreSQL, política assinada pelo Control Plane |
| **AI Gateway** | serviço compartilhado | chave(s) do provedor (OpenRouter) — nunca entregues ao runtime; identifica o tenant pelo token de serviço |

Se o ADR-025 optar por Tool Gateway compartilhado, TGW-001/004 mudam de forma (cofre por tenant e *scoping* de credenciais no serviço) mas **não** os critérios de aceite de isolamento.

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-TGW-001](tickets.md#ent-tgw-001) | Tool Gateway: núcleo, identidade e ponto de decisão | S05 | L | CRÍTICO | DEC-013, MSG-002, RUN-001 |
| [ENT-TGW-002](tickets.md#ent-tgw-002) | Modelo de políticas e testes de política | S05 | M | CRÍTICO | TGW-001, RUN-003 |
| [ENT-AIG-001](tickets.md#ent-aig-001) | AI Gateway: núcleo e adaptador OpenRouter | S05 | L | ALTO | DEC-004, DEC-011, MSG-002 |
| [ENT-TGW-003](tickets.md#ent-tgw-003) | Ferramentas internas (documentos, arquivos, consultas nomeadas) | S06 | L | ALTO | TGW-001, DAT-004, DAT-006 |
| [ENT-TGW-004](tickets.md#ent-tgw-004) | Cofre de credenciais de integração por tenant | S06 | L | CRÍTICO | TGW-001, DEC-006, DAT-004 |
| [ENT-AIG-002](tickets.md#ent-aig-002) | Quotas, rate limits e orçamento | S06 | L | ALTO | AIG-001 |
| [ENT-AIG-003](tickets.md#ent-aig-003) | Metering e relatórios de custo | S06 | M | MÉDIO | AIG-001, DAT-004 |
| [ENT-TGW-005](tickets.md#ent-tgw-005) | Framework de conectores e conector HTTP seguro | S07 | M | ALTO | TGW-004, ISO-004 |
| [ENT-TGW-006](tickets.md#ent-tgw-006) | Defesas de fronteira contra prompt injection | S07 | M | ALTO | TGW-003 |

## Critério de saída

SEC-05, SEC-09 e a parte de ferramentas de SEC-10 automatizados e verdes; nenhuma chamada de ferramenta executa sem decisão de política registrada; nenhum prompt/segredo em logs; orçamento por tenant corta o consumo.

## Riscos

- Gateway é componente de maior valor para um atacante: revisão de segurança obrigatória (`CODEOWNERS`), cobertura de testes de política e análise estática estrita.
- Latência adicional por chamada de ferramenta: medir e manter dentro de orçamento.
