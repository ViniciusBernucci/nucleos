# EP-11 — Observabilidade e operação

> Prefixo: `ENT-OBS` · Sprints: S07–S09 · Tickets: 5 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Centralizar logs, métricas e traces **com segregação por tenant e redação** (ADR seção 10), expor as métricas que disparam a expansão (ADR seção 13), detectar tentativas cruzadas (Entrega 4), definir alertas acionáveis com runbooks e fixar SLOs/RPO/RTO antes da comercialização (ADR seção 16 item 10).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-OBS-001](tickets.md#ent-obs-001) | Stack centralizada de logs, métricas e traces | S07 | L | MÉDIO | DEC-010, FND-009 |
| [ENT-OBS-002](tickets.md#ent-obs-002) | Métricas de capacidade e gatilhos de expansão | S08 | M | MÉDIO | OBS-001 |
| [ENT-OBS-003](tickets.md#ent-obs-003) | Eventos de segurança e alerta de acesso cruzado | S08 | M | ALTO | OBS-001, IAM-008 |
| [ENT-OBS-004](tickets.md#ent-obs-004) | Alertas acionáveis e runbooks | S09 | M | MÉDIO | OBS-002, OBS-003 |
| [ENT-OBS-005](tickets.md#ent-obs-005) | SLOs, RPO/RTO e política de resposta a incidentes | S09 | S | MÉDIO | DAT-008, OBS-002 |

## Critério de saída

Dashboards e alertas funcionando em staging; consulta de logs com identidade do tenant A não retorna dados de B (SEC-13); simulação de incidente exercita alertas e runbooks.

## Riscos

- A própria stack de observabilidade pode vazar dados entre tenants se mal segregada (risco 5 do ADR).
- Orçamento de RAM da VPS: stack pesada pode exigir host separado ou serviço externo (DEC-010).
