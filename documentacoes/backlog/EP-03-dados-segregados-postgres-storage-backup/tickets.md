# EP-03 — Tickets

Regras globais: [../README.md](../README.md). Papéis PostgreSQL por tenant: [README.md](README.md#papéis-postgresql-por-tenant-referência-para-todos-os-tickets).

<a id="ent-dat-001"></a>
## ENT-DAT-001 — Instância PostgreSQL: hardening e papéis administrativos

**Sprint** S02 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Infraestrutura/Dados
**Depende de:** FND-004, DEC-003 · **Bloqueia:** DAT-002, DAT-007
**Referências:** ADR 6.1 itens 2–6, ADR-003; documentação PostgreSQL (privilégios, `pg_hba.conf`).

**Especificação técnica**
- Imagem/versão major do PostgreSQL fixada (verificar suporte vigente na data) com `pgvector` instalada; `postgresql.conf` versionado: `listen_addresses` somente na rede interna, `ssl=on`, `password_encryption=scram-sha-256`, `log_connections`, `log_disconnections`, `log_statement=ddl`, `log_min_duration_statement` (sem logar parâmetros sensíveis), `max_connections` dimensionado.
- `pg_hba.conf` **estático e de negação por padrão**: `hostssl` apenas das redes internas autorizadas (Control Plane, provisioner, runtimes, sidecars) com `scram-sha-256`, seguido de `host all all 0.0.0.0/0 reject`. Avaliar linhas por tenant (database+role+sub-rede) como endurecimento adicional **somente se** a edição puder ser automatizada sem conceder ao provisioner acesso ao arquivo além do necessário; registrar a decisão. Lembrar: **credenciais e ACLs são a barreira de dados**, IP é complemento.
- Em `template1` (ou template dedicado): `REVOKE ALL ON SCHEMA public FROM PUBLIC`; `ALTER DEFAULT PRIVILEGES … REVOKE ALL ON DATABASE … FROM PUBLIC` e `REVOKE CONNECT, TEMPORARY ON DATABASE … FROM PUBLIC` aplicado a **todo database criado**, inclusive `postgres` e `nucleos_control`.
- Papéis administrativos: `platform_dba` (superuser, uso humano excepcional, sem acesso de rede da aplicação), `provisioner_admin` (`CREATEDB CREATEROLE` apenas, **sem** superuser; credencial só do provisioner), papéis do banco de controle (IAM-002). Nenhum serviço de aplicação usa `postgres`.
- Auditoria: extensão `pgaudit` avaliada (classes `ddl`, `role`) com envio para o log do host.
- Healthcheck e métricas (`postgres_exporter`) apenas na rede interna.

**Critérios de aceite**
- [ ] Conexão de rede externa/não listada é rejeitada (teste de porta e `pg_hba`).
- [ ] `psql` com role de aplicação do controle não enxerga outros databases (`\l` permitido, `CONNECT` negado).
- [ ] Configuração versionada; `SHOW` confirma parâmetros críticos.
- [ ] `provisioner_admin` não é superuser nem consegue ler dados de tenant (teste).

**Testes.** Integração contra instância real; script de verificação de ACL (`has_database_privilege`) executado no CI.

---

<a id="ent-dat-002"></a>
## ENT-DAT-002 — Biblioteca de provisionamento de database e roles por tenant

**Sprint** S03 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** DAT-001, DEC-006, DEC-013 · **Bloqueia:** DAT-003, DAT-005, PRV-004
**Referências:** ADR 6.1–6.2; exemplo SQL do ADR é *ilustrativo e incompleto*.

**Objetivo.** Função idempotente `provisionTenantDatabase(tenantId)` usada **apenas** pelo `tenant-provisioner`.

**Especificação técnica**
- Entrada: `tenant_id` (UUID validado). **Nomes derivados exclusivamente do UUID** (`tenant_<hex>`, `…_owner`, `…_migrator`, `…_app`, `…_tools`); nunca interpolar entrada de usuário; identificadores montados com `format('%I')`/quoting da biblioteca e validados por regex `^tenant_[0-9a-f]{32}(_owner|_migrator|_app|_tools)?$`.
- Senhas: 32 bytes de CSPRNG codificados em base64url; entregues ao gerenciador de segredos (DEC-006) e **nunca** logadas/gravadas em SQL versionado ou no banco de controle.
- Sequência (cada passo idempotente, verificando estado atual antes de agir):
  1. `CREATE ROLE …_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`.
  2. `CREATE ROLE …_migrator LOGIN NOINHERIT … IN ROLE …_owner` com `VALID UNTIL` curto e `CONNECTION LIMIT` baixo.
  3. `CREATE ROLE …_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT n`; idem `…_tools`.
  4. `CREATE DATABASE tenant_<hex> OWNER …_owner TEMPLATE template0 ENCODING 'UTF8'`.
  5. Conectado ao novo database: `REVOKE ALL ON DATABASE … FROM PUBLIC; GRANT CONNECT ON DATABASE … TO app, tools, migrator`; `REVOKE CREATE ON SCHEMA public FROM PUBLIC`; criar schema `app` de propriedade do owner; `ALTER ROLE … SET search_path = app`; `ALTER DEFAULT PRIVILEGES FOR ROLE owner IN SCHEMA app GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO app` (e `USAGE` em sequences); `…_tools` recebe privilégios apenas em views/funções nomeadas.
  6. `CREATE EXTENSION vector` (e `pg_trgm`/`citext` conforme DAT-004) executada pelo `provisioner_admin`/`platform_dba`, **verificando** se a extensão é confiável na versão instalada; extensões instaladas ficam em schema dedicado `ext` com `USAGE` controlado.
  7. Verificação final embutida: consulta `has_database_privilege`, `pg_roles`, `pg_auth_members` e `information_schema` garantindo que: app/tools **não** pertencem a roles de outro tenant, nenhum role possui `BYPASSRLS/SUPERUSER/CREATEDB/CREATEROLE`, nenhum privilégio concedido a `PUBLIC`.
- Operações adicionais: `suspendTenantDatabase` (`ALTER ROLE … NOLOGIN` + encerrar sessões via `pg_terminate_backend` do database) e `dropTenantDatabase` (EP-09) com confirmação em duas fases.
- Retorna **referências** a segredos, não valores.
- Registro em `tenancy.tenant_resources` (banco de controle): `kind=postgres_database`, `identifier`, `state`, sem credenciais.

**Fora do escopo.** Migrations (DAT-003); decisão de rede (EP-04).

**Critérios de aceite**
- [ ] Reexecução não duplica nem altera estado correto; reparo de estado parcial funciona (derrubar após o passo 4 e reexecutar).
- [ ] Verificação final falha se um privilégio indevido for injetado artificialmente (teste de mutação).
- [ ] Nenhuma senha em logs, saída ou arquivos versionados (scan).
- [ ] Nome inválido/malicioso de entrada (`'; DROP …`) é rejeitado antes de qualquer SQL.

**Testes.** Unitários da geração/validação de identificadores; integração real com PostgreSQL; SEC (injeção de identificador); SEC-02 base.

**Arquivos prováveis.** `apps/tenant-provisioner/src/postgres/*`, `infrastructure/postgres/sql/*.sql.tmpl`.

---

<a id="ent-dat-003"></a>
## ENT-DAT-003 — Runner de migrations por tenant

**Sprint** S03 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Dados
**Depende de:** DAT-002, DEC-003 · **Bloqueia:** DAT-004, PRV-004, PRV-011
**Referências:** ADR 6.1 item 7, ADR-017.

**Especificação técnica**
- Arquivos `packages/tenant-schema/migrations/NNNN_descricao.sql` (forward-only), com *checksum* SHA-256 registrado em `app.schema_migrations(version, checksum, applied_at, applied_by, duration_ms)` por tenant; divergência de checksum **aborta**.
- Execução como `…_migrator` (credencial efêmera obtida do gerenciador de segredos), com `SET ROLE …_owner` e `SET lock_timeout`/`statement_timeout`; cada migration em transação, exceto as marcadas `-- no-transaction` (ex.: `CREATE INDEX CONCURRENTLY`).
- `pg_advisory_lock` por tenant para impedir execuções concorrentes.
- **Rollout controlado**: estado por tenant no banco de controle (`tenancy.tenant_schema_state`: versão atual, versão-alvo, última falha); comando "migrar lote" com *canary* (1 tenant) → demais; falha de um tenant não bloqueia nem corrompe os outros e gera alerta.
- Regra expand/contract: migration destrutiva exige duas versões de runtime compatíveis; lint de SQL proíbe `DROP`/`ALTER … TYPE` sem anotação aprovada.
- A migration **não** conecta a outro database; o runner recebe um único `tenant_id` por invocação.
- Imagem do runtime verifica na inicialização que a versão de esquema está dentro da faixa suportada (falha segura).

**Critérios de aceite**
- [ ] Executar 2× é idempotente; alterar arquivo já aplicado falha por checksum.
- [ ] Falha induzida no meio da migration deixa tenant em estado consistente e retomável.
- [ ] Migrar 20 bancos de teste com falha no 12º: 19 corretos, 1 `FAILED` com erro registrado.
- [ ] Runner não consegue operar com credencial de app (somente migrator).

**Testes.** Integração com múltiplos bancos; testes de falha/retomada; lint SQL.

---

<a id="ent-dat-005"></a>
## ENT-DAT-005 — Suíte adversarial PostgreSQL (SEC-02/SEC-03)

**Sprint** S03 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Segurança/Testes
**Depende de:** DAT-002 · **Bloqueia:** GATE-001 (artefato reutilizado)
**Referências:** ADR 6.1 item 5, SEC-02, SEC-03.

**Especificação técnica**
- Fixture que provisiona A e B e executa a **matriz** `role × database` completa (app, tools, migrator × A, B, control, postgres, template0/1): somente a diagonal própria permitida.
- Verificações adicionais: `SET ROLE` para role de outro tenant; leitura de `pg_authid`/`pg_shadow` (negada); `COPY … PROGRAM`/`lo_import` (negados); `CREATE EXTENSION` não permitido ao app; criação de objeto em `public`; uso de `dblink`/`postgres_fdw` ausentes ou sem privilégio; funções `SECURITY DEFINER` do esquema revisadas; `pg_read_file`; `CREATE DATABASE`; `ALTER ROLE` de terceiros.
- Verificação de **herança**: nenhuma cadeia de `pg_auth_members` conecta tenants.
- Executável como script autônomo contra staging (`make sec-db`) e no CI; emite relatório para o dossiê.
- Testes de regressão para o caso "PUBLIC ainda tem CONNECT" (provoca falha controlada).

**Critérios de aceite**
- [ ] Matriz completa verde; qualquer permissão fora da diagonal falha o job.
- [ ] Mutação (conceder `CONNECT` a PUBLIC) é detectada.
- [ ] Relatório com versão do PostgreSQL, data e hash do commit.

**Testes.** A própria suíte; teste de mutação.

---

<a id="ent-dat-004"></a>
## ENT-DAT-004 — Esquema inicial do banco do tenant

**Sprint** S04 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Dados
**Depende de:** DAT-003 · **Bloqueia:** RUN-001, RUN-006, RAG-001, AIG-003
**Referências:** ADR-008, 8.2 (memória/embeddings/cache no database do tenant).

**Especificação técnica** — schema `app` (migration `0001_initial.sql` e seguintes). Tipos: PK `uuid`, `timestamptz`, `numeric`. **Sem `tenant_id`** (isolamento = database).

| Tabela | Finalidade / colunas-chave | Índices e regras |
| --- | --- | --- |
| `conversations` | `id`, `agent_id` (ref. ao registro do Control Plane, sem FK), `title`, `created_by_user_id`, `created_at`, `archived_at` | `(created_by_user_id, created_at desc)` |
| `messages` | `id`, `conversation_id`, `role` (`user\|agent\|system\|tool`), `content`, `token_count`, `created_at` | FK; `(conversation_id, created_at)`; `content` pode ser grande — avaliar TOAST/compressão |
| `agent_runs` | `id`, `job_id`, `agent_id`, `status`, `started_at`, `finished_at`, `budget_tokens`, `used_tokens`, `error_code`, `attempt` | `UNIQUE(job_id, attempt)`; `(status, started_at)` |
| `run_steps` | `id`, `run_id`, `seq`, `kind`, `payload jsonb` (redigido), `created_at` | `UNIQUE(run_id, seq)` |
| `tool_calls` | `id`, `run_id`, `tool`, `args_hash`, `decision` (`allowed\|denied\|pending_approval`), `reason_code`, `latency_ms` | `(run_id)`; **sem argumentos em claro** por padrão |
| `approvals` | `id`, `run_id`, `action`, `summary`, `payload_ref`, `status`, `requested_at`, `expires_at`, `decided_by`, `decided_at` | `(status, expires_at)` |
| `documents` | `id`, `name`, `storage_key`, `mime_type`, `size_bytes`, `sha256`, `status`, `department_code`, `created_by`, `created_at`, `deleted_at` | `UNIQUE(sha256, department_code)` opcional |
| `document_chunks` | `id`, `document_id`, `ordinal`, `content`, `embedding vector(D)`, `tsv tsvector` | HNSW `vector_cosine_ops` + GIN em `tsv`; FK com `ON DELETE CASCADE` |
| `memory_items` | `id`, `agent_id`, `scope`, `content`, `embedding vector(D)`, `importance`, `created_at`, `expires_at` | HNSW; expurgo por `expires_at` |
| `token_usage` | `id`, `run_id`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd numeric(18,8)`, `created_at` | `(created_at)`, `(run_id)`; tabela de alto crescimento → particionar por mês se necessário |
| `integration_credentials` | `id`, `provider`, `label`, `ciphertext`, `key_version`, `created_at`, `revoked_at` | acessível **apenas** ao role `tools`; ver TGW-004 |
| `local_audit` | trilha local append-only (sem `UPDATE/DELETE` para `app`) | `REVOKE` explícito |
| `schema_migrations` | controlado pelo runner | — |

- Dimensão `D` do vetor definida pelo modelo de embedding escolhido (ex.: 1536); **trocar de modelo = migration de reindexação**, não simples configuração — registrar no ADR.
- `…_tools` não recebe acesso direto às tabelas: views/funções nomeadas (ex.: `app.search_chunks(query_embedding, dept, limit)` com `SECURITY INVOKER`, `limit` máx.).
- Views de agregação para o dashboard (ex.: `v_run_summary`) sem conteúdo.
- Diagrama ER em `documentacoes/banco/modelo-dados-tenant.md`.

**Critérios de aceite**
- [ ] Migration aplica em tenant novo; `EXPLAIN` das consultas críticas usa os índices esperados.
- [ ] `app` não consegue `UPDATE/DELETE` em `local_audit`; `tools` não lê `messages` diretamente.
- [ ] Teste de volume: 100 mil chunks, busca vetorial p95 dentro do orçamento definido (registrar).

**Testes.** Integração; `EXPLAIN` como asserção; privilégios (reusa DAT-005).

---

<a id="ent-dat-006"></a>
## ENT-DAT-006 — Storage por tenant com URLs assinadas

**Sprint** S04 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature de segurança
**Depende de:** DEC-009 · **Bloqueia:** RAG-001, PRV-004
**Referências:** ADR seção 10 ("Storage"), SEC-08.

**Especificação técnica** (modelo final conforme ADR-023)
- Serviço de storage (módulo do Control Plane ou do Tool Gateway por decisão do ADR) que **gera upload/download via URL assinada de curta duração (≤ 5 min)** após autorização no servidor.
- Chave de objeto **construída pelo servidor**: `tenants/<tenant_id>/<departamento>/<document_id>/<nome-sanitizado>`; nunca aceitar caminho/chave do cliente ou do LLM; validar `document_id` pertence ao tenant (consulta ao banco do tenant).
- Políticas: bucket/credencial por tenant quando suportado; senão prefixo + política `Deny` explícita fora do prefixo.
- Restrições de upload: tamanho máximo, allowlist de MIME **verificada por conteúdo** (magic bytes), nome sanitizado, `Content-Disposition: attachment`, sem execução; contagem de bytes por tenant (cota).
- Criptografia em trânsito (TLS) e em repouso (SSE do provedor ou cifra de envelope).
- Verificação antimalware: decisão registrada (ClamAV em worker isolado vs. adiado com bloqueio de tipos de risco); **arquivos tratados como não confiáveis** pelo parser do RAG.
- Cliente interno para runtime: o runtime **não** recebe credenciais de storage; pede URL a partir do Tool Gateway.
- Registro de acesso (quem/quando/qual `document_id`), sem conteúdo.

**Critérios de aceite**
- [ ] Credencial/URL de A tentando chave de B → `AccessDenied` (SEC-08, teste automatizado com MinIO/provedor).
- [ ] Chave com `../` ou outro `tenant_id` é rejeitada no servidor antes do provedor.
- [ ] URL expirada falha; tipo/tamanho fora da política rejeitado.

**Testes.** Integração contra S3 compatível; SEC (path traversal, URL reutilizada, chave forjada).

---

<a id="ent-dat-007"></a>
## ENT-DAT-007 — Backups externos criptografados

**Sprint** S05 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Operação
**Depende de:** DAT-001, DEC-006 · **Bloqueia:** DAT-008, GATE-005
**Referências:** ADR seção 10 ("Backups"), seção 16 item 9.

**Especificação técnica**
- **Backup lógico por tenant** (`pg_dump -Fc` do database do tenant com role dedicada de backup somente leitura) e do banco de controle; agendamento por job do host (systemd timer) ou worker do provisioner.
- Fluxo: dump → compressão → criptografia (age/restic com chave **fora** da VPS, por tenant ou por lote conforme DEC-006) → envio ao destino externo (provedor distinto do host) → verificação de integridade (checksum) → registro do manifesto (`tenant_id`, versão de esquema, tamanho, hash, data) no banco de controle.
- Avaliar **WAL archiving/PITR** (pgBackRest ou WAL-G) para o cluster e registrar RPO/RTO alcançáveis; no MVP, pode-se começar com dumps frequentes + decisão documentada sobre PITR.
- Backup de storage: *versioning* + replicação/cópia para destino secundário; política de retenção (diário/semanal/mensal) e *object lock* quando disponível.
- Backup de volumes persistentes do runtime (se houver) e de configuração do host (Ansible é a fonte; sem segredos em claro).
- Chave de criptografia: custodiada separadamente, com procedimento testado de recuperação; **sem a chave, o backup é inútil** — registrar custódia.
- Alertas: backup ausente/atrasado/falho/tamanho anômalo; snapshot da VPS **não** conta como backup.

**Critérios de aceite**
- [ ] Backup de 2 tenants e do controle concluídos com manifesto e checksum válidos no destino externo.
- [ ] Arquivo no destino é ilegível sem a chave (teste de leitura).
- [ ] Alerta dispara quando um backup é omitido (teste).

**Testes.** Execução ponta a ponta em staging; verificação de integridade; revisão de permissões do destino (credencial de escrita sem permissão de apagar).

---

<a id="ent-dat-008"></a>
## ENT-DAT-008 — Restore isolado por tenant (SEC-14)

**Sprint** S07 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Operação/Segurança
**Depende de:** DAT-007 · **Bloqueia:** GATE-001, GATE-005

**Especificação técnica**
- Procedimento automatizado `restore-tenant <tenant_id> <backup_id> [--to-new-database]`: baixar → verificar hash → descriptografar → restaurar em **database temporário** → validar (contagem de tabelas, `schema_migrations`, amostra) → trocar (suspender runtime, renomear/trocar, reativar) ou manter lado a lado para comparação.
- Garantias: operação toca somente o database e prefixo de storage do tenant alvo; roles do tenant não são recriados com privilégio ampliado (reaplicar DAT-002 verificação final após restore).
- Restore de objetos do storage a partir de versão/cópia.
- Medir RTO por tenant (tempo de restauração para tamanho de referência) e registrar RPO real (idade do último backup).
- Runbook em `documentacoes/runbooks/restore-tenant.md`, incluindo decisão de comunicação ao cliente.

**Critérios de aceite**
- [ ] Restaurar A com B ativo: checksums e contagens de B inalteradas antes/depois; B sem indisponibilidade.
- [ ] Verificação pós-restore de ACLs passa.
- [ ] RTO/RPO medidos registrados; ensaio executado por pessoa diferente do autor.

**Testes.** Ensaio completo em staging; SEC-14 automatizado.

---

<a id="ent-dat-009"></a>
## ENT-DAT-009 — Rotação e revogação de credenciais (SEC-15)

**Sprint** S07 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** DAT-002, MSG-002 · **Bloqueia:** GATE-001
**Referências:** ADR seção 10 ("Integrações", "Segredos"), SEC-15.

**Especificação técnica**
- Rotação de senha de `app`/`tools` com **janela dupla**: criar nova credencial → distribuir ao runtime/sidecar → confirmar uso → revogar a antiga; sem reinício de outros tenants.
- Revogação de emergência: `ALTER ROLE … NOLOGIN` + `pg_terminate_backend`, revogação de chave de storage, incremento de `ver` na identidade de serviço (MSG-002), invalidação de lease de jobs.
- Registro em auditoria de quem/quando/por quê (sem valores).
- Agendamento de rotação periódica e rotação sob demanda (incidente); `VALID UNTIL` para credenciais efêmeras do migrator.
- Teste de que credencial antiga **falha** após a janela.

**Critérios de aceite**
- [ ] Rotação em A sem impacto observável em B (testes de sonda contínua em B).
- [ ] Conexão com senha antiga falha; com nova funciona.
- [ ] Revogação de emergência interrompe sessões ativas em < 30 s (alvo a validar).

**Testes.** Integração; SEC-15 automatizado; medição de tempo de revogação.
