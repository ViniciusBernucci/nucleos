# Checklist de implementação do backlog

> Atualizado em 2026-10-30 (America/Sao_Paulo). Este checklist acompanha os 110 tickets de EP-00 a EP-12. A especificação continua canônica nos arquivos `tickets.md` de cada épico.

## Legenda e fotografia atual

- `[x]` **Integrado localmente:** implementação (incluindo entregas de frontend com dados mockados nesta fase) incorporada às branches locais de revisão (`revisao/2026-10-25-ep00-ep01-fundacao` e `revisao/2026-10-30-frontend-mockado`); ainda não significa push, PR ou produção.
- `[ ]` **Em andamento / Pausado:** há trabalho preservado em branch/worktree, pausado por redirecionamento de escopo.
- `[ ]` **Bloqueado:** falta uma decisão ou recurso externo essencial.
- `[ ]` **Não iniciado:** não há implementação comprovada no repositório.

Resumo desta fotografia: **25 integrados localmente (19 de EP-00/EP-01 + 6 do EP-10 com dados mockados, além de `LOC-001` e `LOC-WEB-001`), 2 pausados em andamento (`DEC-008`, `FND-007`), 1 bloqueado (`DEC-005`) e 82 não iniciados (sendo 3 de 3D adiados no EP-10 e 79 de backend/infra pausados)**. Evidências dos lotes: [lote fundação](../planejamento-ia/lote-2026-10-25-ep00-ep01-fundacao.md), [estado fundação](../planejamento-ia/lote-2026-10-25-ep00-ep01-fundacao-estado.json), [lote frontend mockado](../planejamento-ia/lote-2026-10-30-frontend-mockado.md), [estado frontend mockado](../planejamento-ia/lote-2026-10-30-frontend-mockado-estado.json) e [pacote de revisão frontend mockado](../planejamento-ia/revisao-humana-2026-10-30-frontend-mockado.md).

**Direção atual (2026-10-30):** todas as frentes de backend/infra/motor de IA estão pausadas e a parte do prédio 3D (`WEB-005..007`) foi adiada para sessão futura. O frontend (`apps/web`) foi implementado com dados mockados cobrindo `LOC-WEB-001` e as 6 frentes 2D do EP-10 (`WEB-001`, `WEB-002`, `WEB-003`, `WEB-004`, `WEB-008` e `WEB-009`).

## EP-00 — Decisões, PoCs e threat model (11/13 integrados)

- [x] `DEC-001` — Threat model STRIDE por fronteira de confiança — integrado localmente.
- [x] `DEC-002` — Autenticação de usuários: construir vs. IdP — integrado localmente.
- [x] `DEC-003` — Acesso a dados e migrations — integrado localmente.
- [x] `DEC-004` — Identidade de serviço entre runtime, Control Plane e gateways — integrado localmente.
- [ ] `DEC-005` — PoC de isolamento de rede no host alvo e `userns-remap`/rootless — **bloqueado** pela ausência da VPS alvo (Q-03).
- [x] `DEC-006` — Gestão de segredos do MVP — integrado localmente.
- [x] `DEC-007` — PoC de orquestração durável de tarefas — integrado localmente; ADR-021 aceito.
- [ ] `DEC-008` — PoC do framework de agentes (Pydantic AI vs. LangGraph) — **pausado** na branch `tarefa/dec-008` (backend/motor de IA pausado por decisão do usuário em 2026-10-30).
- [x] `DEC-009` — Provedor e autorização do object storage — integrado localmente; ADR-023 aceito.
- [x] `DEC-010` — Stack de telemetria e política de redação/retenção — integrado localmente; ADR-024 aceito.
- [x] `DEC-011` — LGPD e provedores de LLM — integrado localmente, com revisão legal externa ainda registrada como limitação.
- [x] `DEC-012` — Provedor de pagamento/assinatura — integrado localmente; ADR-026 aceito.
- [x] `DEC-013` — Acesso da UI aos dados do tenant e posição do Tool Gateway — integrado localmente; ADR-025 aceito.

Especificação: [tickets do EP-00](EP-00-decisoes-pocs-e-threat-model/tickets.md).

## EP-01 — Fundação do monorepo, ambientes e CI (8/9 integrados)

- [x] `FND-001` — Scaffolding do monorepo — integrado localmente.
- [x] `FND-002` — Padrões de qualidade, linters e hooks — integrado localmente.
- [x] `FND-003` — Pacote de contratos com geração TypeScript/Python — integrado localmente.
- [x] `FND-004` — Ambiente local com Docker Compose — integrado localmente.
- [x] `FND-005` — Pipeline de CI bloqueante — integrado localmente.
- [x] `FND-006` — Configuração tipada e ambientes staging/produção — integrado localmente.
- [ ] `FND-007` — Borda: reverse proxy, TLS e cabeçalhos de segurança — **pausado em auditoria/correção** na branch `tarefa/fnd-007` (backend/infra pausado por decisão do usuário em 2026-10-30).
- [x] `FND-008` — Estrutura documental, templates de ADR e runbooks — integrado localmente.
- [x] `FND-009` — Baseline de observabilidade nos serviços — integrado localmente.

Especificação: [tickets do EP-01](EP-01-fundacao-monorepo-ambientes-ci/tickets.md).

## EP-02 — Control Plane: identidade e autorização (0/10)

- [ ] `IAM-001` — Bootstrap da API NestJS — não iniciado.
- [ ] `IAM-002` — Banco de controle: esquema e migrations iniciais — não iniciado.
- [ ] `IAM-003` — Autenticação, MFA e proteção contra força bruta — não iniciado.
- [ ] `IAM-004` — Sessão e resolução de contexto de tenant — não iniciado.
- [ ] `IAM-005` — RBAC/ABAC do Control Plane — não iniciado.
- [ ] `IAM-006` — Organizações, memberships e convites — não iniciado.
- [ ] `IAM-007` — Catálogo de módulos, planos e entitlements — não iniciado.
- [ ] `IAM-008` — Auditoria append-only e eventos de segurança — não iniciado.
- [ ] `IAM-009` — Acesso administrativo excepcional (break-glass) — não iniciado.
- [ ] `IAM-010` — Harness de testes de autorização A/B — não iniciado.

Especificação: [tickets do EP-02](EP-02-control-plane-identidade-e-autorizacao/tickets.md).

## EP-03 — Dados segregados: PostgreSQL, storage e backup (0/9)

- [ ] `DAT-001` — Instância PostgreSQL: hardening e papéis administrativos — não iniciado.
- [ ] `DAT-002` — Provisionamento de database e roles por tenant — não iniciado.
- [ ] `DAT-003` — Runner de migrations por tenant — não iniciado.
- [ ] `DAT-004` — Esquema inicial do banco do tenant — não iniciado.
- [ ] `DAT-005` — Suíte adversarial PostgreSQL — não iniciado.
- [ ] `DAT-006` — Storage por tenant com URLs assinadas — não iniciado.
- [ ] `DAT-007` — Backups externos criptografados — não iniciado.
- [ ] `DAT-008` — Restore isolado por tenant — não iniciado.
- [ ] `DAT-009` — Rotação e revogação de credenciais — não iniciado.

Especificação: [tickets do EP-03](EP-03-dados-segregados-postgres-storage-backup/tickets.md).

## EP-04 — Isolamento de host, containers e rede (0/8)

- [ ] `ISO-001` — Baseline do host com Ansible — não iniciado.
- [ ] `ISO-002` — Hardening de containers e policy-as-code — não iniciado.
- [ ] `ISO-003` — Redes por tenant e bloqueio entre tenants — não iniciado.
- [ ] `ISO-004` — Controle de egress e proteção contra SSRF — não iniciado.
- [ ] `ISO-005` — Exposição mínima de serviços internos — não iniciado.
- [ ] `ISO-006` — Volumes e quotas por tenant — não iniciado.
- [ ] `ISO-007` — Cadeia de suprimentos de imagens — não iniciado.
- [ ] `ISO-008` — Suíte automatizada de isolamento host/rede — não iniciado.

Especificação: [tickets do EP-04](EP-04-isolamento-host-containers-e-rede/tickets.md).

## EP-05 — Dispatcher, filas e eventos (0/7)

- [ ] `MSG-001` — Modelo de jobs, envelope assinado e outbox — não iniciado.
- [ ] `MSG-002` — Identidade de serviço do runtime — não iniciado.
- [ ] `MSG-003` — Dispatcher: enfileirar, lease, heartbeat e ack/nack — não iniciado.
- [ ] `MSG-004` — Retries, DLQ e reconciliação — não iniciado.
- [ ] `MSG-005` — Concorrência e justiça por tenant — não iniciado.
- [ ] `MSG-006` — Stream de eventos em tempo real com autorização — não iniciado.
- [ ] `MSG-007` — Testes de adulteração e resiliência — não iniciado.

Especificação: [tickets do EP-05](EP-05-dispatcher-filas-e-eventos/tickets.md).

## EP-06 — Tenant Runtime e agentes (0/7)

- [ ] `RUN-001` — Esqueleto do runtime e Tenant API interna — não iniciado.
- [ ] `RUN-002` — Imagem do runtime não-root e somente leitura — não iniciado.
- [ ] `RUN-003` — Registro e versionamento de agentes e departamentos — não iniciado.
- [ ] `RUN-004` — Engine de execução de agentes — não iniciado.
- [ ] `RUN-005` — Aprovação humana durável — não iniciado.
- [ ] `RUN-006` — Conversas, memória e API de leitura — não iniciado.
- [ ] `RUN-007` — Perfil de recursos do runtime — não iniciado.

Especificação: [tickets do EP-06](EP-06-tenant-runtime-e-agentes/tickets.md).

## EP-07 — Tool Gateway e AI Gateway (0/9)

- [ ] `TGW-001` — Núcleo, identidade e ponto de decisão do Tool Gateway — não iniciado.
- [ ] `TGW-002` — Modelo de políticas e testes de política — não iniciado.
- [ ] `AIG-001` — Núcleo do AI Gateway e adaptador OpenRouter — não iniciado.
- [ ] `TGW-003` — Ferramentas internas — não iniciado.
- [ ] `TGW-004` — Cofre de credenciais de integração por tenant — não iniciado.
- [ ] `AIG-002` — Quotas, rate limits e orçamento — não iniciado.
- [ ] `AIG-003` — Metering e relatórios de custo — não iniciado.
- [ ] `TGW-005` — Framework de conectores e conector HTTP seguro — não iniciado.
- [ ] `TGW-006` — Defesas contra prompt injection — não iniciado.

Especificação: [tickets do EP-07](EP-07-tool-gateway-e-ai-gateway/tickets.md).

## EP-08 — Memória e RAG (0/4)

- [ ] `RAG-001` — Pipeline de ingestão de documentos — não iniciado.
- [ ] `RAG-002` — Recuperação híbrida vetorial e textual — não iniciado.
- [ ] `RAG-003` — Isolamento do RAG e suíte de prompt injection — não iniciado.
- [ ] `RAG-004` — Reindexação, exclusão e retenção — não iniciado.

Especificação: [tickets do EP-08](EP-08-memoria-e-rag/tickets.md).

## EP-09 — Provisionamento ponta a ponta (0/12)

- [ ] `PRV-001` — Máquina de estados do tenant e registro de execuções — não iniciado.
- [ ] `PRV-002` — `TenantRuntimeSpec` e driver Docker Compose — não iniciado.
- [ ] `PRV-003` — Provisioner segregado e acesso restrito ao Docker — não iniciado.
- [ ] `PRV-004` — Passos de dados do provisionamento — não iniciado.
- [ ] `PRV-005` — Passos de rede e implantação do runtime — não iniciado.
- [ ] `PRV-006` — Verificação pós-provisionamento e ativação — não iniciado.
- [ ] `PRV-007` — Compensação, retry e falha segura — não iniciado.
- [ ] `PRV-008` — Webhook de assinatura simulado e idempotente — não iniciado.
- [ ] `PRV-009` — Suspensão e reativação — não iniciado.
- [ ] `PRV-010` — Offboarding, exportação e exclusão verificável — não iniciado.
- [ ] `PRV-011` — Rollout versionado do runtime — não iniciado.
- [ ] `PRV-012` — Reconciliador e admissão por capacidade — não iniciado.

Especificação: [tickets do EP-09](EP-09-provisionamento-ponta-a-ponta/tickets.md).

## EP-10 — Interface web e prédio 3D (6/9 concluídos com dados mockados; 3/9 de 3D adiados para sessão futura)

- [x] `LOC-WEB-001` — Fundação navegável do frontend com dados mockados — **integrado localmente** em `revisao/2026-10-30-frontend-mockado` ([entrega](../interface-web/2026-10-30-loc-web-001-frontend-mockado.md)).
- [x] `WEB-001` — Shell Next.js, autenticação e experiência multi-organização — **concluído com dados mockados** (`/`, `/login`, `/mfa`, `/forgot-password`, `/verify-email`, `/orgs`, guarda 404 A/B sem vazamento de tenant e zero tokens em `localStorage`); integração com backend real (`IAM-003`, `IAM-004`) ficará para quando o backend for retomado.
- [x] `WEB-002` — Cliente de API tipado e estados de erro — **concluído com dados mockados** (estados determinísticos `ready`/`loading`/`empty`/`error`, Problem Details com `correlation_id` sem stack trace e proteção de `Idempotency-Key` contra duplo clique); conexão HTTP real aguarda backend.
- [x] `WEB-003` — Dashboard da organização — **concluído com dados mockados** (KPIs, agentes/status, tarefas, orçamento de IA com alertas 80%/100%, membros/papéis ocultando mutação para `viewer`, módulos contratados, integrações, documentos RAG e exportação CSV); conexão com SSE/API real aguarda backend.
- [x] `WEB-004` — Conversas com agentes e painel de aprovações — **concluído com dados mockados** (chat por agente, criação de job, passos do Tool Gateway, citações RAG e painel HITL com hash da ação); conexão com runtime real aguarda backend.
- [ ] `WEB-005` — Cena 3D base — **adiado para sessão futura** por decisão do usuário (modo 2D de departamentos já entregue em `LOC-WEB-001`).
- [ ] `WEB-006` — Agentes 3D com estado em tempo real — **adiado para sessão futura** por decisão do usuário.
- [ ] `WEB-007` — Desempenho 3D, pipeline de assets e modo 2D — **adiado para sessão futura** por decisão do usuário (alternativa 2D acessível já entregue).
- [x] `WEB-008` — Segurança do frontend — **concluído com dados mockados** (sanitizador determinístico contra payloads `<script>`/XSS sem `dangerouslySetInnerHTML`, bloqueio de carregamento automático de imagens remotas com placeholder e prevenção de CSV Injection).
- [x] `WEB-009` — Backoffice de plataforma — **concluído com dados mockados** (`/platform` restrito a `platform_admin` com MFA e bloqueio 403 para usuário comum, capacidade da VPS, lista de 5 tenants, kill switch de orçamento, execuções de provisionamento, requeue de DLQ com justificativa e break-glass somente metadados).

Especificação: [tickets do EP-10](EP-10-interface-web-e-predio-3d/tickets.md).

## EP-11 — Observabilidade e operação (0/5)

- [ ] `OBS-001` — Stack centralizada de logs, métricas e traces — não iniciado.
- [ ] `OBS-002` — Métricas de capacidade e gatilhos de expansão — não iniciado.
- [ ] `OBS-003` — Eventos de segurança e alerta de acesso cruzado — não iniciado.
- [ ] `OBS-004` — Alertas acionáveis e runbooks — não iniciado.
- [ ] `OBS-005` — SLOs, RPO/RTO e resposta a incidentes — não iniciado.

Especificação: [tickets do EP-11](EP-11-observabilidade-e-operacao/tickets.md).

## EP-12 — Gate de segurança e go/no-go (0/8)

- [ ] `GATE-001` — Suíte única SEC-01..SEC-18 e dossiê de evidências — não iniciado.
- [ ] `GATE-002` — Carga com cinco tenants e rajadas de LLM — não iniciado.
- [ ] `GATE-003` — Testes de falha e caos — não iniciado.
- [ ] `GATE-004` — Revisão de segurança independente/teste de invasão — não iniciado.
- [ ] `GATE-005` — Simulação de incidente e recuperação de desastre — não iniciado.
- [ ] `GATE-006` — Revisão de custos e capacidade com benchmark — não iniciado.
- [ ] `GATE-007` — Dossiê LGPD, riscos residuais e termos ao cliente — não iniciado.
- [ ] `GATE-008` — Go/no-go e checklist do primeiro cliente real — não iniciado.

Especificação: [tickets do EP-12](EP-12-gate-de-seguranca-e-go-no-go/tickets.md).

## Como manter

1. Não marque `[x]` apenas por existir código: exija os gates do perfil, evidências e integração local aprovada.
2. Ao mudar o estado, atualize o resumo, a fração do épico e a descrição do ticket.
3. Preserve o ID e a especificação canônica; detalhes de execução pertencem ao documento de entrega, aos relatórios e ao estado do lote.
4. Push, PR, deploy e aceite humano final são estados posteriores e não são inferidos por este checklist.
