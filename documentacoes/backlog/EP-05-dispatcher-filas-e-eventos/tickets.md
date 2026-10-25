# EP-05 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-msg-001"></a>
## ENT-MSG-001 — Modelo de jobs, envelope assinado e outbox

**Sprint** S04 · **Prioridade** Crítica · **Tam.** M · **Risco** ALTO · **Tipo** Dados/Contrato
**Depende de:** DEC-007, IAM-002, FND-003 · **Bloqueia:** MSG-002, MSG-003
**Referências:** ADR-009, seção 9, SEC-07.

**Especificação técnica** (banco de controle, esquema `jobs`)

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `jobs.jobs` | `id` (= `job_id`), `tenant_id`, `type`, `payload_ref`/`payload jsonb` mínimo, `state`, `priority`, `idempotency_key`, `attempt`, `max_attempts`, `not_before`, `lease_owner`, `lease_expires_at`, `created_by` (ator), `correlation_id`, `created_at`, `finished_at` | `UNIQUE(tenant_id, idempotency_key)`; índice `(tenant_id, state, not_before, priority)`; estados: `QUEUED → LEASED → RUNNING → (WAITING_APPROVAL) → SUCCEEDED \| FAILED \| CANCELLED \| DEAD` |
| `jobs.job_attempts` | `job_id`, `attempt`, `lease_owner`, `started_at`, `ended_at`, `outcome`, `error_code` | histórico imutável |
| `jobs.outbox` | `id`, `aggregate`, `event_type`, `payload`, `created_at`, `published_at` | escrito **na mesma transação** que a mudança de estado |

- **Payload mínimo**: referência ao pedido e parâmetros não sensíveis; conteúdo privado (texto de usuário, documentos) permanece no banco do tenant e viaja como *referência* resolvida pelo runtime. Isso preserva "metadados mínimos" no controle.
- **Envelope** (`JobEnvelope`, JSON Schema em `packages/contracts`): `job_id`, `tenant_id`, `type`, `schema_version`, `idempotency_key`, `attempt`, `issued_at`, `expires_at`, `correlation_id`, `assignment_signature` (assinatura do Dispatcher sobre os campos canônicos, com `kid`). O runtime **recusa** envelope cujo `tenant_id` ≠ seu `sub` autenticado, sem assinatura válida, expirado ou `attempt` incoerente.
- Máquina de estados com transições válidas implementada como função pura + trigger de proteção no banco; transição inválida falha.
- Idempotência: reenvio da mesma `idempotency_key` retorna o `job_id` existente.
- Política de retenção de `jobs` concluídos (arquivamento/expurgo).

**Critérios de aceite**
- [ ] Transição inválida (ex.: `SUCCEEDED → RUNNING`) é rejeitada pela aplicação e pelo banco.
- [ ] Mesma `idempotency_key` não cria segundo job.
- [ ] Envelope com `tenant_id` alterado tem assinatura inválida (teste).

**Testes.** Unitários da máquina de estados; integração com PostgreSQL; contrato do envelope (TS/Python).

---

<a id="ent-msg-002"></a>
## ENT-MSG-002 — Identidade de serviço do runtime

**Sprint** S04 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** DEC-004, MSG-001 · **Bloqueia:** MSG-003, TGW-001, AIG-001, DAT-009, PRV-004
**Referências:** ADR 5.1, ADR-018, SEC-07, SEC-15.

**Especificação técnica** (conforme ADR-018; ajustar ao formato decidido)
- **Serviço de identidade** no Control Plane: `POST /internal/v1/runtime-identity/enroll` (segredo de *enrollment* de uso único gerado por PRV-004, TTL curto) → registra chave pública do runtime em `iam.runtime_credentials(tenant_id, kid, public_key, version, state, created_at, revoked_at)`.
- Runtime assina asserção (`private_key_jwt`-style) e troca por **access token curto** (≤ 5–10 min) com `aud` específico (dispatcher, tool-gateway, ai-gateway), `scope`, `tenant_id`, `ver`, `jti`. Claims tipadas em `packages/contracts`.
- Biblioteca de verificação (TS e Python) para serviços: valida assinatura via JWKS em cache, `aud`, `exp`, `nbf`, `ver >= min_ver(tenant)`, `jti` não repetido (cache curto) e rejeita `alg=none`/confusão de algoritmos.
- Revogação: `min_ver` por tenant propagado aos serviços (poll curto ou pub/sub) — revogação efetiva em segundos; endpoint administrativo de revogação.
- Rotação de chaves de assinatura do Control Plane com `kid` e sobreposição; chave privada de assinatura fora de imagens e do banco (DEC-006).
- Chave privada do runtime armazenada em segredo exclusivo do tenant, nunca no banco de controle.
- Endpoints `/internal/*` acessíveis apenas na rede interna (ISO-003/005) **e** exigindo token; nunca expostos na borda.

**Critérios de aceite**
- [ ] Token expirado, de audiência errada, com `ver` revogado, de outro tenant ou reutilizado (`jti`) é rejeitado (testes dedicados por caso).
- [ ] Revogar credencial do tenant A impede novos tokens e invalida os existentes em ≤ 30 s (alvo a medir); tenant B inalterado.
- [ ] Segredo de *enrollment* é de uso único e expira.
- [ ] Nenhum token aparece em logs (teste).

**Testes.** Unitários da biblioteca; integração runtime falso ↔ serviços; SEC (algoritmo, replay, tenant adulterado).

---

<a id="ent-msg-003"></a>
## ENT-MSG-003 — Dispatcher: enfileirar, *lease*, heartbeat, ack/nack

**Sprint** S05 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature
**Depende de:** MSG-001, MSG-002, RUN-001 · **Bloqueia:** MSG-004..007, RUN-004, PRV-006
**Referências:** ADR seção 9, ADR-009, ADR-012.

**Especificação técnica** — `services/event-dispatcher` (interface interna; enfileiramento é chamado pelo Control Plane).
- **Enfileirar** (`POST /internal/v1/jobs`): chamado pelo Control Plane/serviços autorizados (token de serviço com escopo `jobs:enqueue`); valida que o `tenant_id` existe e está `ACTIVE`, que o tipo de job é permitido pelo plano/módulo (entitlement) e quota; grava job + outbox em uma transação; retorna `job_id`.
- **Lease** (`POST /internal/v1/runtime/jobs/lease`): identidade do runtime determina o tenant; consulta `QUEUED` com `FOR UPDATE SKIP LOCKED` **filtrando por `tenant_id` do token** (nunca por parâmetro do cliente); define `lease_owner`, `lease_expires_at` (ex.: 60 s) e devolve envelope assinado. *Long poll* (≤ 25 s) para reduzir latência sem broker.
- **Heartbeat** (`POST …/jobs/:id/heartbeat`): estende lease; rejeita se `lease_owner` ≠ chamador.
- **Ack/Nack** (`…/complete`, `…/fail`): transição de estado com `attempt` e `lease_owner` conferidos; resultado pequeno e referência (conteúdo permanece no tenant).
- **Cancelamento**: `POST /v1/organizations/:orgId/jobs/:id/cancel` sinaliza no próximo heartbeat; runtime interrompe execução.
- Publicação do `outbox` para o canal de eventos (MSG-006) por *relay* idempotente.
- Entrega **sem porta de entrada** no runtime e sem broker exposto.
- Métricas: profundidade da fila por tenant, idade do job mais antigo, tempo em lease, taxa de falha; sem alta cardinalidade de labels além de `tenant_id` controlado (DEC-010).

**Critérios de aceite**
- [ ] Runtime A, mesmo informando `tenant_id=B`, só recebe jobs de A (SEC-07 parcial).
- [ ] Dois runtimes concorrentes nunca recebem o mesmo job (teste de concorrência com 50 workers simulados).
- [ ] Lease expirado devolve o job à fila e incrementa `attempt`.
- [ ] Ack com `lease_owner` incorreto é rejeitado.

**Testes.** Integração com PostgreSQL real e concorrência; resiliência (matar Dispatcher durante lease).

---

<a id="ent-msg-005"></a>
## ENT-MSG-005 — Concorrência e justiça por tenant

**Sprint** S05 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Feature

**Especificação técnica**
- Limite de jobs `LEASED/RUNNING` por tenant (padrão 2, ADR seção 4.3), configurável por plano (IAM-007); aplicado na transação do *lease* por contagem (sem *race*; `SELECT … FOR UPDATE` em linha de contador por tenant ou *advisory lock*).
- Prioridades por tipo (interativo > lote) e *aging* para evitar inanição.
- Limite global do host (ex.: nº de execuções simultâneas) configurável para proteger RAM/CPU.
- Rajada de um tenant não atrasa outros além do tolerável (medido em MSG-007/GATE-002).

**Critérios de aceite**
- [ ] Com limite 2, o terceiro job do mesmo tenant aguarda sem ser perdido.
- [ ] Tenant A com 500 jobs não impede B de iniciar um job em ≤ X s (X definido no teste de carga).

---

<a id="ent-msg-004"></a>
## ENT-MSG-004 — Retries, DLQ e reconciliação

**Sprint** S06 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature

**Especificação técnica**
- Política por tipo de job: `max_attempts`, *backoff* exponencial com *jitter*, classificação de erro (`retryable` vs `permanent`); erros de política/autorização **nunca** reexecutam automaticamente.
- Esgotadas as tentativas: estado `DEAD` e registro em `jobs.dead_letters` (motivo, última tentativa, correlação) — **sem payload sensível**.
- API de operação (plataforma): listar DLQ, *requeue* individual com justificativa auditada, descartar; alerta quando DLQ > 0.
- **Reconciliador** periódico: jobs `LEASED/RUNNING` com lease expirado e runtime saudável → reenfileirar; runtime inexistente/`SUSPENDED` → pausar; jobs `WAITING_APPROVAL` expirados → resolver conforme política (cancelar/notificar).
- Idempotência no consumidor: efeito externo protegido por `idempotency_key` (chave composta por job+passo), documentado para o runtime (RUN-004) e gateway (TGW-001).

**Critérios de aceite**
- [ ] Falha permanente vai a `DEAD` sem tentativas extras; falha transitória respeita backoff.
- [ ] Job com lease expirado é recuperado automaticamente sem execução dupla de efeito (teste com efeito externo simulado).
- [ ] *Requeue* manual gera auditoria.

---

<a id="ent-msg-006"></a>
## ENT-MSG-006 — Stream de eventos em tempo real com autorização

**Sprint** S06 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** MSG-003, IAM-004 · **Bloqueia:** WEB-006, WEB-004
**Referências:** ADR 2.1 (acompanhamento em tempo real), seção 11 passo 11.

**Especificação técnica**
- Canal **SSE** (`GET /v1/organizations/:orgId/events/stream`) como padrão (unidirecional, passa por proxies; WebSocket só se necessário, registrar decisão) autenticado pela sessão; contexto de tenant resolvido por membership (IAM-004).
- Eventos (`RealtimeEvent`, contrato versionado): `agent.status_changed`, `run.started|progress|waiting_approval|completed|failed`, `approval.requested|decided`, `tenant.state_changed`, `budget.threshold_reached`. Payload **mínimo e sem conteúdo privado** (IDs, estados, rótulos); detalhes são buscados por API autorizada.
- Barramento interno: `outbox` → relay → canal por tenant (Redis pub/sub ou `LISTEN/NOTIFY`; decisão em ADR-021) com **nome de canal derivado do tenant autenticado**, nunca de parâmetro; assinatura do canal verificada na assinatura (*subscribe*).
- `Last-Event-ID` para retomada sem perda dentro de janela; *heartbeat* periódico; limite de conexões por usuário/tenant; encerramento ao revogar sessão/membership.
- Autorização por evento: filtragem por departamento/permissão do usuário (um `member` não recebe eventos de departamento sem acesso).

**Critérios de aceite**
- [ ] Usuário de A não recebe nenhum evento de B (teste com ambos conectados).
- [ ] Revogar sessão fecha o stream em ≤ 10 s.
- [ ] Reconexão com `Last-Event-ID` não duplica nem perde eventos na janela.
- [ ] 200 conexões simultâneas por tenant sem degradar a API (meta a medir).

**Testes.** Integração; SEC (assinar canal de outro tenant, `orgId` forjado); carga leve.

---

<a id="ent-msg-007"></a>
## ENT-MSG-007 — Testes de adulteração e resiliência (SEC-07)

**Sprint** S08 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Segurança/Testes
**Depende de:** MSG-003, MSG-004 · **Bloqueia:** GATE-001, GATE-003

**Especificação técnica**
- Suíte que tenta: alterar `tenant_id` no envelope, no token e na URL; reutilizar envelope de outro tenant; assinatura forjada ou de `kid` desconhecido; replay de envelope expirado; ack de job alheio; *lease* com parâmetro `tenant_id` de outro tenant; publicar job via credencial de runtime (negado: runtime não enfileira).
- Cenários de resiliência: reiniciar Dispatcher durante lease; reiniciar runtime durante execução; queda do PostgreSQL de controle por 30 s; relógio adiantado; duplicação de entrega.
- Relatório alimenta GATE-001/003.

**Critérios de aceite**
- [ ] Todas as tentativas de adulteração rejeitadas **no Dispatcher e no consumidor** (cada camada testada isoladamente).
- [ ] Nos cenários de resiliência: nenhum job perdido, nenhum efeito duplicado, estado final consistente.
