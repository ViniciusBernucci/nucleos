# Plano de sprints — NÚCLEOS Enterprise (primeira parte)

> Parte do [backlog](README.md). Fonte: ADR de 2026-10-25, seções 13, 15 e 17. **Sprints são lotes de escopo ordenados por dependência e risco, não prazos.** A duração e a capacidade da equipe não foram informadas (Q-02); nenhuma data é prometida. Recalibrar após as duas primeiras sprints com a velocidade observada.

## Marcos (Entregas 1–5 do ADR)

| Marco | Entrega do ADR | Conclui ao fim de | Evidência de saída |
| --- | --- | --- | --- |
| M1 | Fundamentos e identidade | S02 | Login/sessão/RBAC; contexto de tenant; harness A/B verde (SEC-01); CI bloqueante; ADR-016..019 aceitos |
| M2 | Dados segregados | S07 | DB/roles por tenant; SEC-02/03/08/14/15 verdes; backup externo e restore por tenant ensaiados |
| M3 | Runtime e agentes | S08 | Agente executa job com ferramenta autorizada, aprovação e orçamento; SEC-05/06/07/09/10 verdes |
| M4 | Provisionamento ponta a ponta | S09 | Evento simulado → tenant `ACTIVE` sem intervenção; falhas compensadas; suspensão/reativação |
| M5 | Interface e validação de produção | S11 | UI/3D com eventos reais; SEC-01..18; carga; pentest; go/no-go |

A Entrega 6 do ADR (escala futura) está **fora desta parte** — ver [futuro.md](futuro.md).

## Resumo

| Sprint | Objetivo | Tickets | Marco |
| --- | --- | --- | --- |
| S00 | Decisões bloqueantes e esqueleto do repositório | 7 | — |
| S01 | Fundação executável | 9 | — |
| S02 | Identidade, contexto de tenant e instância PostgreSQL segura | 9 | M1 |
| S03 | Dados e redes por tenant | 11 | — |
| S04 | Identidade de serviço, runtime base e shell web | 11 | — |
| S05 | Dispatcher, núcleo de gateways e engine de agentes | 10 | — |
| S06 | Agentes seguros: aprovação, cofre, quotas e cena 3D | 11 | — |
| S07 | Provisioner, RAG e recuperação | 11 | M2 |
| S08 | Provisionamento ponta a ponta e isolamento do RAG | 11 | M3 |
| S09 | Ciclo de vida, operação e agentes 3D | 10 | M4 |
| S10 | Gate: suíte SEC, carga, caos e backoffice | 6 | — |
| S11 | Validação independente e go/no-go | 4 | M5 |
| **Total** | | **110** | |

> Contagem por épico: ver o [README](README.md#épicos).

---

## S00 — Decisões bloqueantes e esqueleto do repositório

**Objetivo.** Fechar as decisões que destravam o caminho crítico e criar o monorepo.
**Tickets:** [DEC-001](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-001) threat model (M) · [DEC-002](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-002) autenticação (S) · [DEC-003](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-003) dados/migrations (M) · [DEC-004](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-004) identidade de serviço (M) · [FND-001](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-001) monorepo (M) · [FND-002](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-002) qualidade (S) · [FND-008](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-008) estrutura documental (S)
**Demonstração.** `make setup && make test` verde; ADR-016/017/018 aceitos; threat model revisado.
**Saída.** Sem decisão pendente que bloqueie S01.
**Riscos.** Decisões adiadas por falta de insumo (VPS, auditor) — ver Q-03/Q-05.

## S01 — Fundação executável

**Objetivo.** Control Plane sobe com schema; CI bloqueante; host e isolamento de rede validados no hardware real.
**Tickets:** [DEC-005](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-005) rede no host (M) · [DEC-006](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-006) segredos (S) · [FND-003](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-003) contratos (M) · [FND-004](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-004) compose local (M) · [FND-005](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-005) CI (M) · [FND-009](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-009) observabilidade base (M) · [IAM-001](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-001) API NestJS (M) · [IAM-002](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-002) schema de controle (L) · [ISO-001](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-001) baseline do host (M)
**Demonstração.** PR com segredo sintético é bloqueado; API responde `/healthz`; matriz de isolamento de rede do PoC.
**Dependência crítica.** VPS alvo disponível (A-02).

## S02 — Identidade, contexto de tenant e instância PostgreSQL segura

**Tickets:** [DEC-007](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-007) orquestração (M) · [DEC-009](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-009) storage (S) · [IAM-003](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-003) autenticação (L) · [IAM-004](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-004) contexto de tenant (M) · [IAM-005](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-005) RBAC/ABAC (M) · [IAM-006](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-006) organizações/membros (M) · [IAM-010](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-010) harness A/B (M) · [DAT-001](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-001) PostgreSQL seguro (M) · [ISO-002](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-002) hardening de containers (M)
**Demonstração.** Usuário de A recebe 404 em toda rota de B (harness automático); política de container rejeita specs maliciosas.
**Saída (M1).** SEC-01 verde.

## S03 — Dados e redes por tenant

**Tickets:** [DEC-008](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-008) framework de agentes (M) · [DEC-013](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-013) acesso a dados/Tool Gateway (M) · [FND-006](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-006) config/ambientes (M) · [IAM-007](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-007) catálogo (M) · [IAM-008](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-008) auditoria (M) · [DAT-002](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-002) provisionamento de DB (L) · [DAT-003](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-003) migrations (L) · [DAT-005](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-005) suíte adversarial (M) · [ISO-003](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-003) redes (L) · [ISO-005](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-005) exposição mínima (S) · [ISO-007](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-007) supply chain (M)
**Demonstração.** Dois tenants de teste: matriz role×database somente na diagonal; A não alcança B pela rede, inclusive após reiniciar o Docker.
**Observação.** Sprint mais carregada de decisões + segurança; se a capacidade for baixa, deslizar FND-006 e IAM-007 para S04 (não estão no caminho crítico).

## S04 — Identidade de serviço, runtime base e shell web

**Tickets:** [DEC-010](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-010) telemetria (S) · [DEC-011](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-011) LGPD/LLM (S) · [FND-007](EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-007) borda TLS (S) · [DAT-004](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-004) schema do tenant (L) · [DAT-006](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-006) storage (L) · [ISO-004](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-004) egress/SSRF (L) · [MSG-001](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-001) modelo de jobs (M) · [MSG-002](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-002) identidade do runtime (L) · [RUN-001](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-001) esqueleto do runtime (M) · [RUN-002](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-002) imagem (M) · [WEB-001](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-001) shell web (L)
**Demonstração.** Runtime de teste autentica com credencial própria; corpus SSRF 100% bloqueado; usuário faz login na UI.

## S05 — Dispatcher, núcleo de gateways e engine de agentes

**Tickets:** [MSG-003](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-003) Dispatcher (L) · [MSG-005](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-005) concorrência (S) · [RUN-003](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-003) registro de agentes (M) · [RUN-004](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-004) engine (L) · [TGW-001](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-001) Tool Gateway (L) · [TGW-002](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-002) políticas (M) · [AIG-001](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-aig-001) AI Gateway (L) · [DAT-007](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-007) backups (L) · [WEB-002](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-002) cliente de API (S) · [WEB-008](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-008) segurança do front (M)
**Demonstração.** Job enfileirado → runtime executa agente com modelo falso → ferramenta negada/permitida pelo gateway.
**Saída.** Início do corredor crítico de segurança de agentes.

## S06 — Agentes seguros: aprovação, cofre, quotas e cena 3D

**Tickets:** [MSG-004](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-004) retries/DLQ (M) · [MSG-006](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-006) eventos em tempo real (L) · [RUN-005](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-005) aprovação (M) · [RUN-006](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-006) conversas/memória (M) · [RUN-007](EP-06-tenant-runtime-e-agentes/tickets.md#ent-run-007) perfil de recursos (S) · [TGW-003](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-003) ferramentas internas (L) · [TGW-004](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-004) cofre (L) · [AIG-002](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-aig-002) quotas (L) · [AIG-003](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-aig-003) metering (M) · [WEB-005](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-005) cena 3D base (L) · [ISO-006](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-006) volumes/quotas (M)
**Demonstração.** Ação sensível pausa para aprovação humana e retoma; orçamento corta chamadas; prédio 3D com dados reais.
**Pontos de atenção.** RUN-007 pode revisar o orçamento de RAM e o dimensionamento (retroalimenta ISO-002/PRV-002).

## S07 — Provisioner, RAG e recuperação

**Tickets:** [DEC-012](EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012) pagamento (S) · [PRV-001](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-001) estados (M) · [PRV-002](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-002) spec/driver (L) · [PRV-003](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-003) provisioner (L) · [RAG-001](EP-08-memoria-e-rag/tickets.md#ent-rag-001) ingestão (L) · [RAG-002](EP-08-memoria-e-rag/tickets.md#ent-rag-002) recuperação (M) · [TGW-005](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-005) conectores (M) · [TGW-006](EP-07-tool-gateway-e-ai-gateway/tickets.md#ent-tgw-006) prompt injection (M) · [DAT-008](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-008) restore por tenant (M) · [DAT-009](EP-03-dados-segregados-postgres-storage-backup/tickets.md#ent-dat-009) rotação de credenciais (M) · [OBS-001](EP-11-observabilidade-e-operacao/tickets.md#ent-obs-001) stack de observabilidade (L)
**Saída (M2).** SEC-02/03/08/14/15 verdes.

## S08 — Provisionamento ponta a ponta e isolamento do RAG

**Tickets:** [PRV-004](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-004) dados (L) · [PRV-005](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-005) rede/deploy (L) · [PRV-006](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-006) verificação/ativação (M) · [PRV-008](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-008) webhook (M) · [RAG-003](EP-08-memoria-e-rag/tickets.md#ent-rag-003) isolamento do RAG (M) · [MSG-007](EP-05-dispatcher-filas-e-eventos/tickets.md#ent-msg-007) adulteração (M) · [ISO-008](EP-04-isolamento-host-containers-e-rede/tickets.md#ent-iso-008) suíte de rede (M) · [OBS-002](EP-11-observabilidade-e-operacao/tickets.md#ent-obs-002) capacidade (M) · [OBS-003](EP-11-observabilidade-e-operacao/tickets.md#ent-obs-003) eventos de segurança (M) · [WEB-003](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-003) dashboard (L) · [WEB-004](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-004) chat/aprovações (L)
**Demonstração.** Evento simulado cria um tenant ativo, com verificação negativa aprovada.
**Saída (M3).** SEC-05/06/07/09/10 verdes.

## S09 — Ciclo de vida, operação e agentes 3D

**Tickets:** [PRV-007](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-007) compensação (M) · [PRV-009](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-009) suspensão (M) · [PRV-011](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-011) rollout (M) · [PRV-012](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-012) reconciliador (M) · [RAG-004](EP-08-memoria-e-rag/tickets.md#ent-rag-004) ciclo de vida (S) · [IAM-009](EP-02-control-plane-identidade-e-autorizacao/tickets.md#ent-iam-009) break-glass (M) · [OBS-004](EP-11-observabilidade-e-operacao/tickets.md#ent-obs-004) alertas/runbooks (M) · [OBS-005](EP-11-observabilidade-e-operacao/tickets.md#ent-obs-005) SLOs (S) · [WEB-006](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-006) agentes 3D (L) · [WEB-007](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-007) desempenho 3D (M)
**Saída (M4).** SEC-18 parcial (falhas de provisionamento) verde.

## S10 — Gate: suíte SEC, carga, caos e backoffice

**Tickets:** [PRV-010](EP-09-provisionamento-ponta-a-ponta/tickets.md#ent-prv-010) offboarding (L) · [WEB-009](EP-10-interface-web-e-predio-3d/tickets.md#ent-web-009) backoffice (L) · [GATE-001](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-001) suíte SEC (L) · [GATE-002](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-002) carga (L) · [GATE-003](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-003) caos (M) · [GATE-006](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-006) custos/capacidade (M)
**Observação.** Reserva intencional de folga para remediar achados do GATE-001.

## S11 — Validação independente e go/no-go

**Tickets:** [GATE-004](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-004) teste de invasão (L) · [GATE-005](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-005) incidente/DR (M) · [GATE-007](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-007) dossiê LGPD (S) · [GATE-008](EP-12-gate-de-seguranca-e-go-no-go/tickets.md#ent-gate-008) go/no-go (S)
**Saída (M5).** Parecer formal. Qualquer SEC reprovado ⇒ NO-GO.

---

## Caminho crítico

`DEC-004 → MSG-002 → MSG-003 → RUN-004 → TGW-001 → TGW-003 → RAG-001 → RAG-003 → PRV-004 → PRV-005 → PRV-006 → GATE-001 → GATE-004 → GATE-008`

Cadeia paralela crítica de dados/rede: `DEC-005 → ISO-003 → ISO-008 → GATE-001` e `DEC-003 → DAT-002 → DAT-003 → DAT-004 → RUN-001`.

## Trilhas paralelas sugeridas

| Trilha | Épicos | Pode correr em paralelo com |
| --- | --- | --- |
| A — Control Plane | EP-02, parte de EP-05 | B, D |
| B — Dados e infraestrutura | EP-03, EP-04, EP-11 | A, C (após S03) |
| C — Runtime e agentes | EP-06, EP-07, EP-08 | D |
| D — Interface | EP-10 | A–C (com contratos e mocks de FND-003) |
| E — Provisionamento | EP-09 | começa quando B e C têm contratos estáveis (S07) |

Disputa de arquivos/contratos: `packages/contracts` é ponto de contenção; mudanças exigem PR pequeno e revisor dos consumidores.
