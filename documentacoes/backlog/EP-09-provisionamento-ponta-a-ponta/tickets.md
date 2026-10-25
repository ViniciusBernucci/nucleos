# EP-09 — Tickets

Regras globais: [../README.md](../README.md). Máquina de estados: [README.md](README.md#máquina-de-estados-do-tenant).

<a id="ent-prv-001"></a>
## ENT-PRV-001 — Máquina de estados do tenant e registro de execuções

**Sprint** S07 · **Prioridade** Crítica · **Tam.** M · **Risco** ALTO · **Tipo** Dados/Domínio
**Depende de:** IAM-002, IAM-007 · **Bloqueia:** PRV-003..012

**Especificação técnica** (banco de controle, esquema `provisioning`)
- `provisioning.runs(id, tenant_id, kind (provision|suspend|resume|upgrade|offboard), desired_spec_version, state (PENDING|RUNNING|SUCCEEDED|FAILED_RETRYABLE|FAILED_PERMANENT|COMPENSATING|COMPENSATED), started_at, finished_at, requested_by, correlation_id)`.
- `provisioning.steps(run_id, name, seq, state, attempt, started_at, ended_at, error_code, outputs_ref)` — saídas são **referências** (ex.: `secret_ref`, `network_id`), jamais valores secretos.
- `tenancy.tenant_resources(tenant_id, kind, identifier, state, created_by_run, metadata)` — inventário de tudo que existe para o tenant (database, roles, bucket/prefixo, rede, volume, container, secret_ref), base para reconciliação e offboarding.
- Transições válidas de `organizations.status` aplicadas por função de domínio e trigger (ver diagrama do README); uma execução ativa por tenant (`UNIQUE` parcial).
- Idempotência por `(tenant_id, kind, desired_spec_version)`.
- Eventos de domínio: `tenant.state_changed` (via outbox, consumido pela UI/3D).

**Critérios de aceite**
- [ ] Transição inválida (ex.: `DELETED → ACTIVE`) rejeitada.
- [ ] Duas execuções simultâneas para o mesmo tenant: a segunda aguarda/é rejeitada.
- [ ] Nenhum valor secreto persiste em `steps`/`resources` (teste de varredura).

**Testes.** Unitários da máquina; integração; propriedade (qualquer sequência de eventos termina em estado válido).

---

<a id="ent-prv-002"></a>
## ENT-PRV-002 — `TenantRuntimeSpec` e driver Docker Compose

**Sprint** S07 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Plataforma
**Depende de:** ISO-002, RUN-002, FND-003 · **Bloqueia:** PRV-003, PRV-005
**Referências:** ADR-010 ("especificação declarativa migrável").

**Especificação técnica**
- Schema `TenantRuntimeSpec` (JSON Schema versionado): `tenant_id`, `spec_version`, `images` (runtime e sidecar **por digest**), `resources` (cpu, memória, pids, tmpfs), `network` (nome, sub-rede), `volumes`, `secrets` (somente **referências**), `modules` ativos, `limits` (concorrência, orçamento), `endpoints` internos, `labels` (tenant, versão).
- Interface `OrchestratorDriver`: `plan(spec) → Plan`, `apply(plan)`, `status(tenant)`, `stop(tenant)`, `destroy(tenant)`, `list()`. Implementação **ComposeDriver** renderiza um projeto Compose por tenant (`name: nuc_t_<hex8>`) a partir de templates; `K8sDriver` fica como interface/contrato apenas (estágio 3).
- Renderização **determinística** com validação pela política ISO-002 **antes** de qualquer aplicação; recusa campos desconhecidos; nomes derivados do UUID, nunca de texto do usuário.
- Verificação de assinatura/digest da imagem (ISO-007) na etapa `plan`.
- `plan` é *diff* legível (o que criar/alterar/remover), gravado em auditoria sem segredos.

**Critérios de aceite**
- [ ] Spec com campo extra ou imagem sem digest é rejeitada.
- [ ] `plan` repetido sem mudança é vazio (idempotência).
- [ ] Spec renderizada passa 100% na política ISO-002.

**Testes.** Snapshot da renderização; propriedade (nenhuma spec gerada contém `privileged`/socket); integração com Docker real de teste.

---

<a id="ent-prv-003"></a>
## ENT-PRV-003 — Serviço Provisioner segregado e acesso restrito ao Docker

**Sprint** S07 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** PRV-001, DEC-006, ISO-001 · **Bloqueia:** PRV-004..012
**Referências:** ADR seção 4 ("jamais expor Docker socket/daemon à API ou aos tenants"), 6.1 item 2.

**Especificação técnica** — `apps/tenant-provisioner`.
- **Entrada única**: consome execuções de `provisioning.runs` (job assinado do Control Plane, tipo `provisioning.*`), validando assinatura e `tenant_id`; **sem porta de entrada** e sem API HTTP exposta.
- **Acesso ao Docker** por *socket proxy* (ou `docker compose` via usuário dedicado) que permite **apenas** endpoints necessários (containers/redes/volumes/imagens por label `nucleos.tenant`), nega `exec`, `privileged`, `build`, `swarm`, e `/var/run/docker.sock` nunca é montado em API/runtime/gateways. Registrar no ADR que o acesso ao daemon continua equivalente a poder alto no host (**risco residual**).
- **Credenciais separadas**: papel `provisioner_admin` do PostgreSQL, credencial de criação de recursos de storage, chave de assinatura de enrollment — cada uma em segredo exclusivo do provisioner (DEC-006); nenhuma é lida pelo Control Plane.
- Executor serial por padrão (um provisionamento por vez; configurável), com timeouts por passo e *heartbeat* da execução.
- Logging de ações administrativas em auditoria (quem solicitou, `run_id`, passo), sem segredos.
- Container do provisioner com o mesmo perfil de hardening (sem root quando possível), rede própria `nuc_admin` sem alcance à internet.
- `CODEOWNERS` com revisão dupla; teste de arquitetura impede o Control Plane de importar código do provisioner.

**Critérios de aceite**
- [ ] A API/Control Plane não consegue alcançar o daemon Docker nem as credenciais do provisioner (teste de rede e de montagem).
- [ ] Requisição ao socket proxy com `exec`/`privileged` é negada.
- [ ] Execução com assinatura inválida/`tenant_id` divergente é rejeitada.

**Testes.** Integração; SEC (tentativas de abuso do proxy, entrada forjada).

---

<a id="ent-prv-008"></a>
## ENT-PRV-008 — Webhook de assinatura (simulado) idempotente

**Sprint** S08 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** PRV-001, DEC-012 · **Bloqueia:** PRV-009, GATE-008
**Referências:** ADR seção 11 passo 1; Entrega 4 ("Evento de assinatura simulado com idempotência").

**Especificação técnica**
- Endpoint público `POST /v1/webhooks/subscriptions/{provider}` com verificação de **assinatura HMAC + timestamp** (janela curta), corpo bruto preservado para o cálculo, comparação em tempo constante, segredo do webhook em segredo da plataforma.
- Persistência **antes** de processar: `billing.webhook_events(provider, event_id UNIQUE, received_at, payload_hash, state)`; duplicata retorna 200 sem reprocessar; ordem não garantida tratada por `occurred_at` e versão de assinatura.
- `SubscriptionEvent` (contrato) mapeado a ações: `created → provision`, `payment_failed → suspend (após carência)`, `canceled → offboard (após carência)`, `plan_changed → atualizar entitlements/limites`.
- **Simulador** (`services/payments-simulator` ou script) que emite eventos assinados para testes; mesmo contrato do provedor real escolhido em DEC-012.
- Limites: rate limit por IP, tamanho de corpo, rejeição de JSON malformado; resposta rápida (processamento assíncrono via job).
- Nunca confiar em identificadores de infraestrutura contidos no payload; apenas `external_customer_id` e plano (mapeados no servidor).

**Critérios de aceite**
- [ ] Assinatura inválida/expirada → 401 sem efeitos.
- [ ] Mesmo `event_id` enviado 5× → um único provisionamento.
- [ ] Evento fora de ordem não regride o estado (teste).

---

<a id="ent-prv-004"></a>
## ENT-PRV-004 — Passos de dados: banco, migrations, storage, segredos, identidade

**Sprint** S08 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature
**Depende de:** PRV-003, DAT-002, DAT-003, DAT-006, MSG-002 · **Bloqueia:** PRV-005, PRV-006
**Referências:** ADR seção 11 passos 4–6.

**Especificação técnica** — cada passo implementa `execute()`, `verify()` e `compensate()` idempotentes, e registra saídas como referências.
1. `create_database_and_roles` → DAT-002 (verificação final embutida).
2. `apply_migrations` → DAT-003 até a versão-alvo; validar ACLs pós-migration.
3. `create_storage` → bucket/prefixo + credencial escopada (ou configuração do serviço de storage) conforme ADR-023.
4. `create_secrets` → grava no gerenciador de segredos: credenciais `app`/`tools`, chave de dados do tenant, chave privada de identidade (gerada **no destino**, nunca trafegando), segredo de *enrollment*.
5. `register_identity` → registra chave pública e versão de credencial (MSG-002); revoga *enrollment* após uso.
6. `seed_agents_and_policies` → cria agentes/políticas a partir do catálogo e entitlements (RUN-003/TGW-002) — ainda **inativos** até a verificação.
- Registrar cada recurso em `tenant_resources`.
- Falha em qualquer passo → estado `FAILED_RETRYABLE`/`PERMANENT` e compensação (PRV-007).

**Critérios de aceite**
- [ ] Execução completa em staging cria recursos e registra inventário completo.
- [ ] Cada passo é reexecutável sem efeito duplicado (teste de reexecução).
- [ ] Nenhum segredo aparece em `steps`, logs ou saída do job.

---

<a id="ent-prv-005"></a>
## ENT-PRV-005 — Passos de rede e implantação do runtime

**Sprint** S08 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature
**Depende de:** PRV-004, ISO-003, ISO-006 · **Bloqueia:** PRV-006, ISO-008
**Referências:** ADR seção 11 passos 7–8.

**Especificação técnica**
1. `allocate_network` → sub-rede livre do bloco reservado; cria rede e registra regras (ISO-003 `registerTenantNetwork`).
2. `allocate_volumes` → ISO-006.
3. `render_spec` → `TenantRuntimeSpec` (PRV-002) com digests assinados.
4. `deploy_runtime` → aplica spec: runtime + sidecar do Tool Gateway; segredos montados por arquivo (`tmpfs`), não por variável.
5. `wait_ready` → espera `ready` do runtime e do sidecar com *timeout*; falha controlada.
- Admissão: verifica capacidade do host (PRV-012) **antes** de criar recursos.
- Rollback do passo restaura rede/volumes criados naquela execução (PRV-007).

**Critérios de aceite**
- [ ] Runtime sobe com a spec endurecida (inspeção estática passa) e conecta **apenas** ao próprio banco.
- [ ] Segredos não aparecem em `docker inspect`.
- [ ] Segundo tenant provisionado em paralelo não interfere no primeiro (rede/volume distintos).

---

<a id="ent-prv-006"></a>
## ENT-PRV-006 — Verificação pós-provisionamento e ativação

**Sprint** S08 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** PRV-005, RUN-003 · **Bloqueia:** PRV-007, PRV-009, GATE-001
**Referências:** ADR seção 11 passos 9–11, SEC-16.

**Especificação técnica**
- **Verificação positiva**: health do runtime/sidecar; runtime autentica no Dispatcher e recebe job de teste (`noop`); consulta ao próprio banco; escrita/leitura de objeto de teste no próprio storage; chamada de teste ao AI Gateway (modelo barato/simulado) com custo registrado.
- **Verificação negativa** contra um **tenant sentinela** permanente de teste e contra o banco de controle: runtime não conecta ao DB sentinela nem ao de controle (credencial negada), não alcança a rede/porta do runtime sentinela, não lê objeto do sentinela, não obtém token para outro tenant, não acessa o socket Docker. Reutiliza as sondas de DAT-005/ISO-008.
- Só após **todas** as verificações: ativar departamentos/agentes e orçamento de IA (passo 10), `status=ACTIVE`, publicar `tenant.state_changed` (a UI/3D constrói o prédio).
- Falha → não ativar; estado `FAILED` com motivo; nenhum acesso parcial (credenciais permanecem sem uso, runtime parado).
- Relatório de verificação anexado à execução (evidência para auditoria).

**Critérios de aceite**
- [ ] Um tenant com ACL deliberadamente quebrada (ex.: `CONNECT` a PUBLIC) **não** chega a `ACTIVE`.
- [ ] Todas as verificações negativas executadas e registradas por tenant provisionado.
- [ ] Evento de ativação recebido pela UI de teste.

---

<a id="ent-prv-007"></a>
## ENT-PRV-007 — Compensação, retry e falha segura

**Sprint** S09 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature

**Especificação técnica**
- Cada passo tem `compensate()` idempotente (remover container, rede, volume, bucket/credencial, secrets, database/roles **criados nesta execução**); compensação nunca remove recursos de execuções anteriores bem-sucedidas.
- Classificação de erro (`retryable`: rede, tempo; `permanent`: política/validação); *retry* com *backoff* e limite; após esgotar, `FAILED_PERMANENT` + alerta.
- Idempotência de reexecução: retomar do passo que falhou, respeitando `verify()` antes de reexecutar.
- Proteções: recusa de `compensate` que apague database com dados do tenant se já houve atividade (flag `has_tenant_data`) sem confirmação em duas fases e auditoria.
- Teste de caos: falha injetada em **cada** passo (kill do provisioner, banco indisponível, disco cheio) e verificação do estado final seguro.

**Critérios de aceite**
- [ ] Matriz (passo × falha) executada: nenhum estado "meio ativo" com credenciais utilizáveis.
- [ ] Retomada após reinício do provisioner completa o fluxo.
- [ ] Alerta emitido em `FAILED_PERMANENT`.

---

<a id="ent-prv-009"></a>
## ENT-PRV-009 — Suspensão e reativação

**Sprint** S09 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** PRV-006, PRV-008

**Especificação técnica**
- Suspensão: parar de aceitar novos jobs, cancelar/pausar execuções, parar runtime (mantém volume/banco/storage), `ALTER ROLE … NOLOGIN` para app/tools, revogar tokens (incremento de `ver`), manter dados e backups; UI mostra estado e permite exportação autenticada conforme contrato.
- Reativação: reverter na ordem inversa com **nova verificação** (PRV-006 reduzida); credenciais rotacionadas por padrão.
- Carência configurável (nenhuma exclusão por falha de pagamento).
- Estados e transições auditados; notificação ao `owner`.

**Critérios de aceite**
- [ ] Tenant suspenso não executa jobs nem aceita Tenant API; dados intactos (checksum antes/depois).
- [ ] Reativação restaura operação; credenciais antigas continuam inválidas.
- [ ] B não é afetado por suspensão de A.

---

<a id="ent-prv-011"></a>
## ENT-PRV-011 — Rollout versionado do runtime

**Sprint** S09 · **Prioridade** Média · **Tam.** M · **Risco** ALTO · **Tipo** Feature

**Especificação técnica**
- Versão do runtime por tenant (`desired_spec_version`), *canary* (tenant interno) → lotes; migrations compatíveis (expand/contract, DAT-003) antes do novo runtime; *drain* de jobs antes do reinício; *health gate* automático com rollback ao digest anterior.
- Janela de manutenção e comunicação; rollout bloqueado se backup recente ausente.
- Registro de versão por tenant e relatório de distribuição.

**Critérios de aceite**
- [ ] Atualização de A não interrompe execuções de B.
- [ ] Falha no canary aborta o lote e reverte o tenant afetado.

---

<a id="ent-prv-012"></a>
## ENT-PRV-012 — Reconciliador e controle de admissão por capacidade

**Sprint** S09 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Operação
**Depende de:** PRV-006, RUN-007, OBS-002
**Referências:** ADR seção 13 (gatilhos de expansão).

**Especificação técnica**
- Loop periódico compara `tenant_resources` (desejado) com estado real (Docker, PostgreSQL, storage, regras de rede): detecta deriva (container ausente, regra de firewall faltando, role com privilégio indevido) → alerta e, quando seguro, autocorrige; **deriva de segurança** (privilégio indevido) gera incidente e não é "auto-corrigida" silenciosamente.
- **Admissão**: antes de provisionar, avalia RAM/CPU/disco/conexões do host contra limites (ex.: RAM sustentada > 70% bloqueia novo tenant); retorna `capacity_unavailable` com instrução, em vez de degradar tenants existentes.
- Catálogo de hosts preparado para o estágio 2 (campo `host_id` com um único host no MVP).

**Critérios de aceite**
- [ ] Remover manualmente uma regra de firewall/rede gera alerta de deriva.
- [ ] Provisionamento é recusado quando a capacidade está acima do limite configurado.

---

<a id="ent-prv-010"></a>
## ENT-PRV-010 — Offboarding, exportação e exclusão verificável

**Sprint** S10 · **Prioridade** Média · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** PRV-009, RAG-004, DAT-007 · **Bloqueia:** GATE-007
**Referências:** ADR seção 11 (Offboarding), DEC-011.

**Especificação técnica**
- Fluxo: `OFFBOARDING` → suspender → **exportação autorizada** (dump do database do tenant + objetos do storage + manifesto/hash, entregue por URL assinada de curta duração ao `owner`) → período de retenção contratual → exclusão: `DROP DATABASE`, `DROP ROLE`s, exclusão do bucket/prefixo e versões, remoção de segredos e rede/volumes, expurgo de logs do tenant conforme política, **anotação de tombstone** mínima (sem dados) no controle.
- Exclusão em **duas fases** (agendar → confirmar) com auditoria; backups do tenant expiram conforme política (documentar janela em que ainda existem).
- **Verificação de exclusão**: roteiro que prova inexistência (banco, roles, objetos, segredos, containers) e gera certificado interno.
- Direitos do titular (acesso/eliminação) mapeados no processo (DEC-011).

**Critérios de aceite**
- [ ] Após exclusão, nenhum recurso do tenant existe (script de verificação) e outros tenants permanecem íntegros.
- [ ] Exportação contém todos os dados do tenant e somente dele (conferência por manifesto).
- [ ] Exclusão antes do fim da carência é impossível.
