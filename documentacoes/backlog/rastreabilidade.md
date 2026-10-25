# Rastreabilidade — ADR, gate SEC e riscos

> Parte do [backlog](README.md). Garante que cada decisão (ADR-001..015), cada teste do gate (SEC-01..18) e cada risco residual (seção 16 do ADR) tenha ticket responsável.

## 1. ADR-001..015 → tickets

| ADR | Decisão | Tickets que a implementam |
| --- | --- | --- |
| ADR-001 | Control Plane + Data Plane por tenant | IAM-001..010, PRV-001..012 |
| ADR-002 | Runtime dedicado por empresa em container | RUN-001, RUN-002, PRV-002, PRV-005 |
| ADR-003 | Database PostgreSQL exclusivo por tenant | DAT-001..005, DEC-003, PRV-004 |
| ADR-004 | NestJS + TypeScript no Control Plane | IAM-001, FND-001, FND-003 |
| ADR-005 | Python no Tenant Runtime | RUN-001..007, DEC-008 |
| ADR-006 | React + Next.js; R3F + Three.js | WEB-001..009 |
| ADR-007 | LLMs via gateway (OpenRouter) | AIG-001..003, DEC-011 |
| ADR-008 | PostgreSQL + pgvector; Redis; storage de objetos | DAT-004, DAT-006, RAG-001..004, DEC-009 |
| ADR-009 | Execuções de IA assíncronas e duráveis | DEC-007, MSG-001..007, RUN-004, RUN-005 |
| ADR-010 | Docker Compose no MVP com spec declarativa | PRV-002, FND-004, FND-006 |
| ADR-011 | Escala horizontal por tenant e pool de workers | MSG-005, PRV-012, OBS-002 (preparação; execução na [segunda parte](futuro.md)) |
| ADR-012 | Deny-by-default; autorização externa ao LLM | TGW-001, TGW-002, TGW-006, RUN-004 |
| ADR-013 | Código arbitrário fora do runtime principal | RUN-004 (proibição + varredura), TGW-001 (lint de imports), RAG-001 (sem OCR/browser); Sandbox Executor em [futuro.md](futuro.md) |
| ADR-014 | Sem rede entre tenants | DEC-005, ISO-003, ISO-004, ISO-005, ISO-008 |
| ADR-015 | Custos por tenant/agente rastreados | AIG-002, AIG-003, WEB-003, GATE-006 |

**Novos ADRs a produzir** (numeração a partir de 016): ADR-016 autenticação · ADR-017 acesso a dados/migrations · ADR-018 identidade de serviço · ADR-019 isolamento de rede/userns · ADR-020 segredos · ADR-021 orquestração durável · ADR-022 framework de agentes · ADR-023 object storage · ADR-024 telemetria · ADR-025 acesso a dados do tenant e Tool Gateway · ADR-026 provedor de pagamento.

## 2. Gate SEC-01..18 → onde o teste nasce e onde é consolidado

| SEC | Teste | Construído em | Consolidado em |
| --- | --- | --- | --- |
| SEC-01 | API/IDOR A→B | IAM-004, **IAM-010** | GATE-001 |
| SEC-02 | Runtime A → DB B | DAT-002, **DAT-005** | GATE-001 |
| SEC-03 | Runtime A → DB control | **DAT-005**, IAM-002 | GATE-001 |
| SEC-04 | Runtime A → porta/runtime/volume B | ISO-003, ISO-006, **ISO-008** | GATE-001 |
| SEC-05 | LLM A pede documentos de B ao Tool Gateway | TGW-001..003, **RAG-003** | GATE-001 |
| SEC-06 | RAG de A recupera embedding/documento de B | DAT-004, RAG-002, **RAG-003** | GATE-001 |
| SEC-07 | Adulteração de `tenant_id` em job/token/URL | MSG-001..003, **MSG-007** | GATE-001 |
| SEC-08 | Storage: object key/URL de B | **DAT-006** | GATE-001 |
| SEC-09 | Agent A usa token de integração de B | **TGW-004** | GATE-001 |
| SEC-10 | Prompt injection pede segredos de B | TGW-006, **RAG-003** | GATE-001 |
| SEC-11 | Container tenta Docker socket/host/privileged | ISO-002, PRV-003, **ISO-008** | GATE-001 |
| SEC-12 | SSRF metadados/localhost/IP privado | **ISO-004**, TGW-005, ISO-008 | GATE-001 |
| SEC-13 | Logs/traces de A consultam B | IAM-008, **OBS-001**, OBS-003 | GATE-001 |
| SEC-14 | Restore de A isolado | DAT-007, **DAT-008** | GATE-001, GATE-005 |
| SEC-15 | Rotação/revogação de credenciais de A | MSG-002, TGW-004, **DAT-009** | GATE-001 |
| SEC-16 | Isolamento de storage/rede/ACL após provisionamento | **PRV-006**, DAT-005, ISO-008 | GATE-001 |
| SEC-17 | Carga com 5 tenants e rajadas de LLM | AIG-002, MSG-005, RUN-007 | **GATE-002** |
| SEC-18 | Falhas (OOM, reinício, serviço externo) | MSG-007, PRV-007 | **GATE-003** |

## 3. Riscos residuais do ADR (seção 16) → tratamento

| # | Risco | Tratamento no backlog |
| --- | --- | --- |
| 1 | VPS única, kernel e administrador compartilhados | DEC-005, ISO-001/002/003; dossiê GATE-007; HA fora do escopo ([futuro.md](futuro.md)) |
| 2 | Instância PostgreSQL compartilhada | DAT-001/002/005; GATE-007; segregação física em [futuro.md](futuro.md) |
| 3 | LLM externa e LGPD | DEC-011, AIG-001, GATE-007 |
| 4 | Ferramentas externas | TGW-004/005; conectores reais na segunda parte |
| 5 | Observabilidade como fonte de vazamento | DEC-010, FND-009, OBS-001/003 |
| 6 | Código arbitrário e browser automation | Proibidos no MVP: RUN-004, TGW-001; Sandbox em [futuro.md](futuro.md) |
| 7 | Orquestração (filas vs Temporal) | DEC-007 (PoC) |
| 8 | Custos de VPS e CPU compartilhada | RUN-007, GATE-002, GATE-006 |
| 9 | Criptografia e chaves | DEC-006, DAT-007, TGW-004 |
| 10 | Disponibilidade, RPO/RTO, resposta a incidentes | DAT-007/008, OBS-005, GATE-005 |

## 4. Lacunas do ADR encontradas pela decomposição

| ID | Lacuna | Onde tratada |
| --- | --- | --- |
| L-01 | Não define como a UI lê dados privados do tenant (metadados mínimos no controle vs. conteúdo no tenant) | DEC-013 → ADR-025; RUN-001, RUN-006 |
| L-02 | Posição e credenciais do Tool Gateway ambíguas (diagrama por tenant × árvore de serviço único) | DEC-013 → ADR-025; EP-07 |
| L-03 | Mecanismo de autenticação de usuários não escolhido | DEC-002 → ADR-016 |
| L-04 | Fonte de verdade de definição de agentes/políticas | RUN-003, TGW-002 (Control Plane autoritativo; runtime consome snapshot assinado) |
| L-05 | Acesso do provisioner ao daemon Docker equivale a poder alto no host | PRV-003 (socket proxy + risco residual explícito) |
| L-06 | Orçamento de RAM (4.2) não inclui sidecar do Tool Gateway nem observabilidade | DEC-013, RUN-007, GATE-006 |
| L-07 | Stack divergente da Especificação Mestra e do backlog de 2026-09-22 (.NET 10) e das regras do `CLAUDE.md`/`AGENTS.md` (C#/.NET, lessons) | FND-008 e questão Q-01 |
