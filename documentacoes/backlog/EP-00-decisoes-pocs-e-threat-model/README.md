# EP-00 — Decisões, PoCs e threat model

> Prefixo dos tickets: `ENT-DEC` · Sprints: S00–S07 · Tickets: 13 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Fechar, com evidência, as decisões que o ADR consolidado de 2026-10-25 deixou explicitamente em aberto (seção 3, "Não definido ainda") e as lacunas que a análise arquitetural encontrou ao decompor o backlog. Cada ticket termina em **um ADR aceito ou em um documento de decisão** e em uma recomendação reproduzível, não em "pesquisa".

## Por que existe

O ADR fixa o modelo de isolamento, mas não escolhe: autenticação de usuários, ferramenta de acesso a dados/migrations, formato de identidade de serviço, mecanismo de segredos, orquestração durável, framework de agentes, provedor S3, stack de telemetria e provedor de pagamento. Começar a implementar antes dessas escolhas gera retrabalho nas fronteiras de segurança. Há ainda duas lacunas estruturais (caminho de leitura da UI aos dados privados do tenant e posição do Tool Gateway) que precisam de ADR antes de EP-05/06/07.

## Tickets

| ID | Título | Sprint | Tam. | Risco | ADR resultante |
| --- | --- | --- | --- | --- | --- |
| [ENT-DEC-001](tickets.md#ent-dec-001) | Threat model STRIDE por fronteira de confiança | S00 | M | ALTO | documento de segurança |
| [ENT-DEC-002](tickets.md#ent-dec-002) | Autenticação de usuários: construir vs. IdP | S00 | S | ALTO | ADR-016 |
| [ENT-DEC-003](tickets.md#ent-dec-003) | Acesso a dados e migrations (control, tenant, Python) | S00 | M | ALTO | ADR-017 |
| [ENT-DEC-004](tickets.md#ent-dec-004) | Identidade de serviço runtime ↔ Control Plane ↔ gateways | S00 | M | CRÍTICO | ADR-018 |
| [ENT-DEC-005](tickets.md#ent-dec-005) | PoC de isolamento de rede no host alvo e `userns-remap`/rootless | S01 | M | CRÍTICO | ADR-019 |
| [ENT-DEC-006](tickets.md#ent-dec-006) | Gestão de segredos do MVP | S01 | S | ALTO | ADR-020 |
| [ENT-DEC-007](tickets.md#ent-dec-007) | PoC de orquestração durável de tarefas | S02 | M | ALTO | ADR-021 |
| [ENT-DEC-008](tickets.md#ent-dec-008) | PoC do framework de agentes (Pydantic AI vs LangGraph) | S03 | M | ALTO | ADR-022 |
| [ENT-DEC-009](tickets.md#ent-dec-009) | Provedor e modelo de autorização do object storage | S02 | S | ALTO | ADR-023 |
| [ENT-DEC-010](tickets.md#ent-dec-010) | Stack de telemetria e política de redação/retenção | S04 | S | MÉDIO | ADR-024 |
| [ENT-DEC-011](tickets.md#ent-dec-011) | LGPD e provedores de LLM (processo + decisões) | S04 | S | ALTO | documento de conformidade |
| [ENT-DEC-012](tickets.md#ent-dec-012) | Provedor de pagamento/assinatura | S07 | S | MÉDIO | ADR-026 |
| [ENT-DEC-013](tickets.md#ent-dec-013) | Acesso da UI aos dados do tenant e posição do Tool Gateway | S03 | M | CRÍTICO | ADR-025 |

## Critério de saída do épico

- ADR-016 a ADR-026 aceitos (ou substituídos com justificativa) em `documentacoes/arquitetura/adr/`.
- Threat model revisado por pessoa diferente do autor, com todo risco mapeado a ticket ou a risco aceito com responsável.
- Nenhum ticket de implementação das áreas afetadas inicia antes do ADR correspondente (ver coluna "Depende de" em cada ticket).

## Riscos do épico

- Decisão adiada vira dívida estrutural: DEC-004 e DEC-013 bloqueiam o caminho crítico inteiro.
- PoCs em VPS compartilhada medem desempenho variável; registrar data, plano contratado e carga concorrente.
