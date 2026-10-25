# EP-11 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-obs-001"></a>
## ENT-OBS-001 — Stack centralizada de logs, métricas e traces

**Sprint** S07 · **Prioridade** Alta · **Tam.** L · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** DEC-010, FND-009 · **Bloqueia:** OBS-002, OBS-003

**Especificação técnica** (conforme ADR-024)
- Coletor OpenTelemetry na rede de infraestrutura; serviços exportam via OTLP; logs de containers coletados pelo driver/agente com **filtros de redação** reaplicados no coletor (defesa em profundidade).
- Armazenamento de logs com **multi-tenancy** (ex.: cabeçalho/organização por tenant) e controle de acesso: consulta de tenant só por identidade de plataforma autorizada e auditada; tenant **não** consulta a stack diretamente no MVP (UI mostra auditoria própria via API).
- Retenção por classe (logs de aplicação, segurança, auditoria, traces) e expurgo automático; compressão e limite de disco.
- Métricas de infraestrutura (node, Docker/cAdvisor, PostgreSQL exporter, Redis exporter) e RED dos serviços; `tenant_id` como label **somente** onde a cardinalidade é controlada (DEC-010).
- Painéis administrativos acessíveis por VPN/túnel; credenciais fortes; sem exposição pública.
- Consumo de RAM/disco medido contra o orçamento; se excede, mover para host separado/serviço gerenciado conforme ADR.

**Critérios de aceite**
- [ ] Logs de um request percorrem Next.js → API → Dispatcher → runtime com o mesmo `correlation_id`.
- [ ] Consulta autenticada como tenant A (ou filtro de A) não retorna linhas de B (SEC-13).
- [ ] Varredura de logs com sentinelas não encontra segredos/prompts.

---

<a id="ent-obs-002"></a>
## ENT-OBS-002 — Métricas de capacidade e gatilhos de expansão

**Sprint** S08 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Operação
**Depende de:** OBS-001 · **Bloqueia:** GATE-006, PRV-012
**Referências:** ADR seção 13 ("Gatilhos concretos de expansão").

**Especificação técnica**
- Painel e regras para: RAM sustentada > 70–75% e OOMs; CPU e *steal time* (vCPU compartilhada); latência p95 vs. SLO; backlog e **idade máxima** de tarefas; PostgreSQL (IOPS/latência de disco, locks, conexões, tamanho de WAL, tempo de restore medido); taxa de erro e limites dos provedores de IA; custo de IA por tenant.
- Cada gatilho do ADR vira alerta com limiar inicial **ajustável** e referência ao runbook de expansão (estágio 2).
- Relatório mensal automático de capacidade por tenant (RAM/CPU/disco/uso de IA) para apoiar precificação.

**Critérios de aceite**
- [ ] Teste de carga (GATE-002) dispara pelo menos um alerta de capacidade esperado.
- [ ] Todos os gatilhos da seção 13 do ADR têm métrica correspondente ou justificativa de ausência.

---

<a id="ent-obs-003"></a>
## ENT-OBS-003 — Eventos de segurança e alerta de acesso cruzado

**Sprint** S08 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** OBS-001, IAM-008
**Referências:** ADR seção 8.3 (passo 6), Entrega 4 ("alerta de tentativas cruzadas"), SEC-13.

**Especificação técnica**
- Taxonomia de `security_events` normalizada: `tenant.access_denied`, `token.invalid|replayed|wrong_audience`, `policy.denied`, `egress.blocked`, `ssrf.attempt`, `db.connection_denied`, `jobs.tampering`, `approval.mismatch`, `credential.misuse`, `injection.suspected`.
- Fontes: Control Plane, Dispatcher, gateways, runtime, logs do PostgreSQL (`FATAL: permission denied for database`), firewall do host (drops entre sub-redes), proxy de egress.
- Regras de correlação: N negações por origem/janela, tentativa de acesso a tenant diferente do contexto, qualquer **sucesso** em ação que deveria ser negada (**crítico**).
- Alertas por severidade com canal de notificação (e-mail/mensageria de plataforma); eventos **sem conteúdo** do recurso alheio.
- Painel de plataforma e visão resumida ao `owner` do tenant (apenas seus eventos).

**Critérios de aceite**
- [ ] Execução do IAM-010/DAT-005/ISO-008 gera eventos correspondentes visíveis no painel.
- [ ] Alerta crítico dispara ao simular acesso cruzado bem-sucedido em ambiente de teste.
- [ ] Eventos não contêm dados do tenant alheio (teste de sentinela).

---

<a id="ent-obs-004"></a>
## ENT-OBS-004 — Alertas acionáveis e runbooks

**Sprint** S09 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Operação
**Depende de:** OBS-002, OBS-003

**Especificação técnica**
- Catálogo de alertas: cada um com **causa provável, impacto, primeiros passos, escalonamento e critério de resolução**; alertas sem ação possível são removidos.
- Runbooks em `documentacoes/runbooks/`: tenant em `FAILED`, DLQ crescendo, backup ausente, OOM de runtime, credencial vazada (rotação/revogação), provedor LLM indisponível, orçamento estourado, regra de rede ausente, restauração de tenant, expansão para host adicional.
- Roteamento de notificações e *on-call* (mesmo que de uma pessoa no MVP) documentado; silenciamento com expiração.
- Ensaios (game days) com pelo menos 3 cenários.

**Critérios de aceite**
- [ ] Cada alerta ativo possui runbook linkado.
- [ ] Ensaio de 3 cenários executado e lições registradas.

---

<a id="ent-obs-005"></a>
## ENT-OBS-005 — SLOs, RPO/RTO e política de resposta a incidentes

**Sprint** S09 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Decisão/Documento
**Depende de:** DAT-008, OBS-002
**Referências:** ADR seção 16 item 10.

**Especificação técnica**
- SLIs/SLOs internos propostos (disponibilidade da API, latência p95, tempo de início de tarefa, idade máxima de fila, sucesso de provisionamento) **sem promessa contratual**; RPO/RTO **medidos** (DAT-007/008) comparados à meta aprovada pelo responsável de negócio.
- Política de incidentes: severidades, papéis, comunicação ao cliente, preservação de evidências, prazos de notificação (alinhado a DEC-011/LGPD — revisão jurídica), modelo de pós-mortem sem culpa.
- Declaração explícita do que o cenário A **não** garante (sem HA, ponto único de falha).

**Critérios de aceite**
- [ ] Documento aprovado por responsável nomeado; SLOs ligados a métricas existentes.
- [ ] Lacunas entre RPO/RTO medidos e metas viram risco ou ticket.
