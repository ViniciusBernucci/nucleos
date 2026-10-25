# EP-02 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-iam-001"></a>
## ENT-IAM-001 — Bootstrap da API NestJS

**Sprint** S01 · **Prioridade** Crítica · **Tam.** M · **Risco** MÉDIO · **Tipo** Feature de plataforma
**Depende de:** FND-001, FND-003 · **Bloqueia:** IAM-003+, MSG-001
**Referências:** ADR-004, roteiro etapa 11.

**Especificação técnica**
- Módulos NestJS por domínio (`iam`, `tenancy`, `catalog`, `audit`, `jobs`, `provisioning`) com limites de importação aplicados por lint (FND-002). Sem módulo "common" genérico crescendo sem regra.
- Prefixo `/v1`; pipeline global: `ValidationPipe` (whitelist + `forbidNonWhitelisted` + transformação explícita), filtro de exceções que devolve **Problem Details (RFC 9457)** sem *stack trace*/mensagens internas, `helmet`, CORS por allowlist, compressão desativada em rotas sensíveis.
- Idempotência: cabeçalho `Idempotency-Key` em `POST` mutáveis críticos (armazenamento na tabela `idempotency_keys` com hash do corpo e resposta; 409 se mesma chave com corpo diferente; TTL configurável).
- Paginação por cursor (`limit` máx. 100, cursor opaco assinado), ordenação por allowlist de campos, filtros tipados.
- *Rate limit* (por IP e por identidade) com armazenamento em Redis; limites estritos em login/recuperação.
- OpenAPI 3.1 gerado e publicado em `packages/contracts/openapi`; `operationId` estável.
- Integração com baseline de observabilidade (FND-009): correlation ID, logs, métricas.
- Endpoint `/healthz` e `/readyz` (verifica banco de controle e Redis).

**Fora do escopo.** Regras de negócio; autenticação (IAM-003).

**Critérios de aceite**
- [ ] Corpo com campo extra retorna 400 Problem Details sem eco do campo sensível.
- [ ] Erro interno retorna 500 genérico com `correlation_id`; detalhes só em log.
- [ ] `POST` repetido com mesma `Idempotency-Key` retorna a resposta original; corpo diferente → 409.
- [ ] OpenAPI gerado confere com o contrato publicado (drift = falha no CI).

**Testes.** Unitários dos filtros/pipes; e2e com supertest; teste de contrato OpenAPI.

---

<a id="ent-iam-002"></a>
## ENT-IAM-002 — Banco de controle: esquema e migrations iniciais

**Sprint** S01 · **Prioridade** Crítica · **Tam.** L · **Risco** ALTO · **Tipo** Dados
**Depende de:** DEC-003, FND-004 · **Bloqueia:** IAM-003, IAM-008, MSG-001, PRV-001
**Referências:** ADR-003, 6.1 item 9; ADR-017.

**Especificação técnica** — banco `nucleos_control`, esquemas separados por contexto; PK UUID; `created_at/updated_at timestamptz`.

| Esquema.tabela | Colunas principais | Constraints / índices |
| --- | --- | --- |
| `iam.users` | `id`, `email` (citext), `email_verified_at`, `password_hash`, `status` (`active\|locked\|disabled`), `failed_logins`, `locked_until` | `UNIQUE(email)` |
| `iam.sessions` | `id`, `user_id`, `token_hash` (SHA-256 do token opaco), `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `ip_hash`, `user_agent` | `UNIQUE(token_hash)`; índice `(user_id, revoked_at)` |
| `iam.mfa_factors` | `id`, `user_id`, `type`, `secret_encrypted`, `confirmed_at` | FK `user_id` |
| `iam.roles` / `iam.permissions` / `iam.role_permissions` | catálogos de papéis e permissões `recurso:ação` | `UNIQUE(code)` |
| `tenancy.organizations` | `id` (**= tenant_id imutável**), `slug`, `name`, `status` (`PROVISIONING\|ACTIVE\|SUSPENDED\|FAILED\|OFFBOARDING\|DELETED`), `plan_id`, `created_at`, `deleted_at` | `UNIQUE(slug)`; trigger impedindo `UPDATE id` |
| `tenancy.memberships` | `id`, `organization_id`, `user_id`, `role_id`, `status`, `invited_by` | `UNIQUE(organization_id, user_id)`; índice `(user_id)` |
| `catalog.modules`, `catalog.plans`, `catalog.plan_modules` | definição de departamentos/módulos e limites por plano | `UNIQUE(code)` |
| `tenancy.organization_modules` | entitlements ativos por organização | `UNIQUE(organization_id, module_id)` |
| `audit.events` | ver IAM-008 | particionada por mês |
| `platform.idempotency_keys` | `key`, `scope`, `request_hash`, `response`, `expires_at` | `UNIQUE(scope, key)` |

- **Metadados mínimos**: nenhuma coluna de conteúdo privado do tenant (conversas, documentos, prompts).
- Papéis PostgreSQL do banco de controle: `control_owner` (migrations, NOLOGIN), `control_migrator`, `control_app` (DML; sem DDL), `control_readonly_policy` (somente leitura das tabelas de política para o Tool Gateway — criada em TGW-002). Sem `SUPERUSER`/`BYPASSRLS`.
- Migrations conforme ADR-017, *forward-only*; o `down` documentado é *roll-forward*.
- Seed de papéis/permissões idempotente.
- Diagrama ER (Mermaid) em `documentacoes/banco/modelo-dados-controle.md`.

**Critérios de aceite**
- [ ] Migrations aplicam do zero em banco descartável e são idempotentes na reexecução.
- [ ] `UPDATE tenancy.organizations SET id=...` é rejeitado por trigger (teste).
- [ ] `control_app` não consegue `CREATE TABLE`/`DROP` (teste).
- [ ] Nenhuma tabela contém campos de conteúdo de tenant (checklist de revisão).

**Testes.** Integração com PostgreSQL real (Testcontainers/serviço de CI): constraints, triggers, privilégios.

---

<a id="ent-iam-003"></a>
## ENT-IAM-003 — Autenticação, MFA e proteção contra força bruta

**Sprint** S02 · **Prioridade** Crítica · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** DEC-002, IAM-002 · **Bloqueia:** IAM-004, WEB-001
**Referências:** ADR-016, OWASP ASVS V2.

**Especificação técnica** (assume a hipótese do ADR-016; ajustar se a decisão mudar)
- Cadastro, verificação de e-mail (token de uso único, hash armazenado, expira), login, logout, recuperação de senha, troca de senha com revogação de sessões.
- Hash `argon2id` com parâmetros registrados (memória/iterações) e *rehash* quando parâmetros mudarem; política de senha por comprimento (≥ 12) e verificação contra lista de senhas vazadas (k-anonymity ou lista local).
- MFA TOTP (RFC 6238) com *backup codes* de uso único; `secret_encrypted` com chave de aplicação (DEC-006); janela de tolerância ±1 passo; bloqueio de reuso do mesmo código.
- Proteção contra força bruta: limite por conta **e** por IP, atraso progressivo, bloqueio temporário (`locked_until`) com resposta indistinguível entre usuário inexistente e senha errada (mesma mensagem e tempo aproximado).
- Sessão opaca de 256 bits em cookie `HttpOnly; Secure; SameSite=Lax` (ver WEB-008); armazenar apenas o hash; rotação do identificador após login/MFA (anti-fixação).
- Eventos de auditoria: login ok/falho, MFA, troca de senha, bloqueio.
- Envio de e-mail por adaptador (SMTP; Mailpit no dev) sem expor token em logs.

**Fora do escopo.** SSO/OIDC corporativo; login social.

**Critérios de aceite**
- [ ] Respostas de login/recuperação não permitem enumerar e-mails (teste comparando corpo e latência).
- [ ] Após N falhas a conta é bloqueada pelo tempo definido; contagem por IP independe.
- [ ] Token de verificação/recuperação reutilizado ou expirado é rejeitado.
- [ ] Senha e TOTP seed nunca aparecem em log (teste de redação).

**Testes.** Unitários (hash, TOTP com vetores RFC), integração, testes de segurança de enumeração e força bruta.

---

<a id="ent-iam-004"></a>
## ENT-IAM-004 — Sessão e resolução de contexto de tenant

**Sprint** S02 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** IAM-003 · **Bloqueia:** IAM-005, IAM-006, IAM-010, WEB-001
**Referências:** ADR 5.1, SEC-01, SEC-07.

**Objetivo.** Garantir que **toda** operação com escopo de tenant derive o tenant de uma membership válida, nunca do corpo da requisição.

**Especificação técnica**
- `SessionGuard`: carrega sessão por hash do token; rejeita expirada/revogada; atualiza `last_seen_at` com limitação de escrita; *idle timeout* e *absolute timeout* configuráveis.
- Rota de tenant `/v1/organizations/:orgId/...`: `:orgId` é apenas o **contexto solicitado**. `TenantContextGuard` consulta `memberships` (ativa) e organiza `req.tenantContext = { tenantId, userId, roleId, permissions }`; sem membership → **404** (não 403, para não revelar existência) salvo política explícita.
- Proíbe-se `tenant_id` no corpo/consulta como fonte de autoridade: DTOs não possuem o campo e um lint/teste de arquitetura detecta `tenantId` em DTOs de entrada.
- O contexto é imutável e propagado por `AsyncLocalStorage` para repositórios; consultas ao banco de controle de recursos de tenant **exigem** o `tenantId` do contexto (API do repositório não aceita omissão).
- Organização `SUSPENDED/OFFBOARDING`: operações de escrita negadas conforme matriz de estados.
- Trocar de organização cria novo contexto, não reaproveita permissões.

**Critérios de aceite**
- [ ] Usuário de A chamando `/organizations/B/...` recebe 404 e gera evento de auditoria `tenant.access_denied` (sem dados de B).
- [ ] DTO com `tenantId` no corpo falha no lint de arquitetura.
- [ ] Sessão revogada deixa de funcionar na requisição seguinte.

**Testes.** Unitários dos guards; integração A/B (usa IAM-010); teste de arquitetura.

---

<a id="ent-iam-005"></a>
## ENT-IAM-005 — RBAC/ABAC do Control Plane

**Sprint** S02 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature de segurança
**Depende de:** IAM-004 · **Bloqueia:** IAM-006, IAM-009, TGW-002
**Referências:** ADR 5.2.

**Especificação técnica**
- Permissões no formato `recurso:ação` (ex.: `members:invite`, `agents:configure`, `approvals:decide`, `billing:read`). Papéis iniciais: `owner`, `admin`, `member`, `viewer`, `platform_admin` (apenas plano de plataforma, nunca dentro de tenant por herança).
- Decorator `@RequirePermission('members:invite')` + `PolicyGuard`. **Negação por padrão**: rota sem declaração de política é rejeitada na inicialização (teste de arquitetura que varre controllers).
- ABAC para atributos: departamento, propriedade do recurso, estado da organização; avaliador puro (`evaluate(subject, action, resource, ctx) → Decision{allow, reason_code}`), sem I/O, testável por tabela.
- Decisões negadas registram `reason_code` em auditoria (sem dados do recurso).
- Cache de permissões por sessão com invalidação ao mudar papel (evento interno).

**Critérios de aceite**
- [ ] Inicialização falha se algum endpoint não declarar política.
- [ ] Tabela de decisão cobre papel × ação × estado da organização (≥ 40 casos) e passa.
- [ ] Mudança de papel reflete na próxima requisição.

**Testes.** Unitários por tabela, integração, teste de arquitetura.

---

<a id="ent-iam-006"></a>
## ENT-IAM-006 — Organizações, memberships e convites

**Sprint** S02 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** IAM-005 · **Bloqueia:** IAM-007, PRV-001

**Especificação técnica**
- Criação de organização: somente pelo fluxo de plataforma (provisionamento) ou por `platform_admin`; `tenant_id` gerado pelo servidor (UUID), `slug` validado (`^[a-z0-9-]{3,40}$`, lista de reservados).
- Convites: token de uso único (hash), expiração, vinculação ao e-mail convidado, papel limitado ao do convidante (sem escalada); aceitação exige e-mail verificado coincidente.
- Gestão de membros: listar (paginado), alterar papel, remover; invariantes: **sempre ≥ 1 `owner` ativo**, ninguém altera o próprio papel acima do seu, remoção revoga sessões de contexto daquele tenant.
- Endpoints (todos com política): `POST /v1/organizations/:orgId/invitations`, `POST /v1/invitations/:token/accept`, `GET/PATCH/DELETE /v1/organizations/:orgId/members/:userId`.
- Eventos de auditoria para cada mutação.

**Critérios de aceite**
- [ ] Último `owner` não pode ser removido/rebaixado (409).
- [ ] Convite não pode ser aceito por outro e-mail nem reutilizado.
- [ ] Escalada de privilégio via convite/PATCH rejeitada (testes).

**Testes.** Integração + SEC (escalada, IDOR em `userId`).

---

<a id="ent-iam-010"></a>
## ENT-IAM-010 — Harness de testes de autorização A/B

**Sprint** S02 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Qualidade/Segurança
**Depende de:** IAM-004 · **Bloqueia:** GATE-001; reusado por EP-05..10
**Referências:** ADR 17 (Entrega 1: "ferramenta de testes automáticos de autorização entre A/B"), SEC-01, SEC-07.

**Objetivo.** Biblioteca que, dado o OpenAPI do Control Plane, **gera automaticamente** testes de acesso cruzado.

**Especificação técnica**
- Fixture que cria os tenants A e B com usuários em cada papel e recursos "marcados" (valores sentinela únicos).
- Percorre cada operação do OpenAPI com parâmetros de caminho de B usando credenciais de A, e vice-versa; espera 403/404 e **ausência de qualquer sentinela de B no corpo/cabeçalhos**.
- Variações automáticas: `tenant_id` trocado no corpo, em *query*, em cabeçalho; ID de recurso de B dentro de rota de A; enumeração sequencial; método alternativo (`PUT` vs `PATCH`).
- Relatório (JUnit + markdown) com evidência para o dossiê do gate; extensível a Dispatcher, Tool Gateway e storage (adaptadores).
- Falha o CI se endpoint novo não for coberto (cobertura de operações OpenAPI = 100%).

**Critérios de aceite**
- [ ] Introduzir um IDOR deliberado em endpoint de teste faz o harness falhar.
- [ ] Cobertura de 100% das operações com parâmetros de tenant/recurso.
- [ ] Relatório gerado como artefato do CI.

**Testes.** Teste do próprio harness com aplicação-alvo vulnerável sintética (deve detectar) e segura (deve passar).

---

<a id="ent-iam-007"></a>
## ENT-IAM-007 — Catálogo de módulos, planos e entitlements

**Sprint** S03 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** IAM-006 · **Bloqueia:** PRV-001, RUN-003, WEB-003
**Referências:** ADR 2.1 (departamentos/módulos), seção 11 passo 3.

**Especificação técnica**
- Catálogo de módulos/departamentos (financeiro, controladoria, marketing, comercial, CRM, conteúdo): `code`, nome, descrição, **agentes-modelo** (papéis, ferramentas permitidas por padrão, versão), requisitos de recurso.
- Planos com módulos incluídos e **limites**: tarefas simultâneas (padrão 2), orçamento mensal de IA, armazenamento, nº de agentes.
- *Entitlements* por organização com vigência (`valid_from/valid_until`) e origem (`subscription|manual`); a ativação de módulo só modifica **estado desejado** (consumido pelo provisionamento).
- API: `GET /v1/catalog/modules`, `GET/PUT /v1/organizations/:orgId/modules` (PUT apenas `platform_admin` no MVP).
- O catálogo é versionado; mudanças de agente-modelo não alteram retroativamente agentes já criados (versão fixada).

**Critérios de aceite**
- [ ] Alterar entitlement gera evento de domínio `entitlement.changed` (para provisionador/UI).
- [ ] Limites do plano acessíveis por serviço interno com cache e invalidação.
- [ ] Atualizar catálogo não muda agentes existentes.

**Testes.** Integração; contrato do evento.

---

<a id="ent-iam-008"></a>
## ENT-IAM-008 — Auditoria append-only e eventos de segurança

**Sprint** S03 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** IAM-002 · **Bloqueia:** IAM-009, OBS-003
**Referências:** ADR seções 5.1, 8.3 (passo 6), SEC-13.

**Especificação técnica**
- `audit.events(id, occurred_at, actor_type, actor_id, tenant_id NULL, action, resource_type, resource_id, outcome, reason_code, correlation_id, ip_hash, metadata jsonb)` particionada por mês; **sem conteúdo sensível** (metadata validada por allowlist de chaves por `action`).
- Imutabilidade: papel de aplicação com `INSERT` apenas; `REVOKE UPDATE, DELETE, TRUNCATE`; trigger de proteção; corrente de integridade opcional (hash encadeado por partição) avaliada como *nice-to-have*.
- Serviço `AuditService.record()` assíncrono com *outbox* para não perder evento em falha; modo "falhar fechado" para ações críticas (login admin, break-glass).
- Classe separada `security_events` (tentativa de acesso cruzado, token inválido, violação de política) com severidade, alimentando OBS-003.
- Consulta: `GET /v1/organizations/:orgId/audit-events` (apenas o próprio tenant, papel `admin+`), filtros/paginação; consulta de plataforma separada e ela mesma auditada.
- Retenção configurável por classe; rotina de arquivamento/expurgo por partição.

**Critérios de aceite**
- [ ] `UPDATE/DELETE` em `audit.events` pelo papel da aplicação falha (teste).
- [ ] Tentativa A→B (IAM-010) gera `security_event` sem dados de B.
- [ ] Consulta de A nunca retorna eventos de B.

**Testes.** Integração (privilégios), SEC, carga leve de escrita.

---

<a id="ent-iam-009"></a>
## ENT-IAM-009 — Acesso administrativo excepcional (break-glass)

**Sprint** S09 · **Prioridade** Média · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** IAM-005, IAM-008 · **Bloqueia:** GATE-008
**Referências:** ADR 5.1 (último item).

**Especificação técnica**
- Acesso de operador a dados/estado de um tenant só por **concessão temporária**: solicitação com justificativa e ticket, **aprovação por segunda pessoa**, escopo (leitura de metadados / diagnóstico), duração máxima (ex.: 60 min), revogação manual imediata.
- Concessão gera token de plataforma separado do de usuário, com `aud` próprio; toda ação sob concessão é auditada com `grant_id`.
- Notificação ao `owner` do tenant (configurável) ao início/fim de acesso.
- Nenhum agente de IA, runtime ou serviço automático pode obter concessão (negação explícita).
- Sem acesso ao conteúdo de dados do tenant no MVP: apenas metadados e diagnósticos; leitura de conteúdo exige ADR própria.

**Critérios de aceite**
- [ ] Solicitante não pode aprovar a própria concessão.
- [ ] Concessão expira automaticamente; uso após expiração → 403.
- [ ] Toda chamada sob concessão aparece na auditoria do tenant afetado.

**Testes.** Integração + SEC (auto-aprovação, extensão indevida, uso por serviço).
