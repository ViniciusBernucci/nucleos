# EP-03 — Dados segregados: PostgreSQL, storage e backup

> Prefixo: `ENT-DAT` · Sprints: S02–S07 · Tickets: 9 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Implementar o isolamento de dados por tenant exigido pelos ADR-003, ADR-008 e seção 6 do ADR: **database exclusivo por tenant** em instância PostgreSQL compartilhada, **roles/credenciais exclusivas**, migrations por tenant, storage com políticas por tenant, backups externos e restauração isolada.

## Escopo

- Configuração segura da instância PostgreSQL (`pg_hba`, TLS, privilégios padrão, limites).
- Biblioteca de provisionamento de database/roles e runner de migrations por tenant.
- Esquema inicial do tenant (conversas, execuções, documentos, vetores, memória, aprovações, consumo, auditoria local).
- Storage S3 segregado com URLs assinadas pelo backend.
- Backups criptografados fora do host e restore por tenant; rotação/revogação de credenciais.

## Fora do escopo

- Réplica/HA de PostgreSQL (estágio 2/3 — ver [../futuro.md](../futuro.md)).
- Orquestração do provisionamento completo (EP-09), que **consome** a biblioteca deste épico.

## Papéis PostgreSQL por tenant (referência para todos os tickets)

Hipótese consolidada com ADR-025; confirmar no ADR:

| Role | Login | Uso | Privilégios |
| --- | --- | --- | --- |
| `tenant_<hex>_owner` | não | dono do database/schemas | DDL; usado apenas via `SET ROLE` pelo migrator |
| `tenant_<hex>_migrator` | sim | runner de migrations (processo do provisionador) | membro de `owner`; credencial efêmera |
| `tenant_<hex>_app` | sim | runtime | DML nas tabelas do schema `app`; sem DDL; `CONNECTION LIMIT` |
| `tenant_<hex>_tools` | sim | sidecar Tool Gateway | `SELECT`/`EXECUTE` apenas em views/funções nomeadas (sem SQL livre) |

`<hex>` = `tenant_id` sem hífens (32 caracteres → identificadores com ≤ 48 caracteres, abaixo do limite de 63).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-DAT-001](tickets.md#ent-dat-001) | Instância PostgreSQL: hardening e papéis administrativos | S02 | M | CRÍTICO | FND-004, DEC-003 |
| [ENT-DAT-002](tickets.md#ent-dat-002) | Biblioteca de provisionamento de database e roles por tenant | S03 | L | CRÍTICO | DAT-001, DEC-006, DEC-013 |
| [ENT-DAT-003](tickets.md#ent-dat-003) | Runner de migrations por tenant | S03 | L | ALTO | DAT-002, DEC-003 |
| [ENT-DAT-005](tickets.md#ent-dat-005) | Suíte adversarial PostgreSQL (SEC-02/SEC-03) | S03 | M | CRÍTICO | DAT-002 |
| [ENT-DAT-004](tickets.md#ent-dat-004) | Esquema inicial do banco do tenant | S04 | L | ALTO | DAT-003 |
| [ENT-DAT-006](tickets.md#ent-dat-006) | Storage por tenant com URLs assinadas | S04 | L | ALTO | DEC-009 |
| [ENT-DAT-007](tickets.md#ent-dat-007) | Backups externos criptografados | S05 | L | ALTO | DAT-001, DEC-006 |
| [ENT-DAT-008](tickets.md#ent-dat-008) | Restore isolado por tenant (SEC-14) | S07 | M | ALTO | DAT-007 |
| [ENT-DAT-009](tickets.md#ent-dat-009) | Rotação e revogação de credenciais (SEC-15) | S07 | M | ALTO | DAT-002, MSG-002 |

## Critério de saída

SEC-02, SEC-03, SEC-08, SEC-14 e SEC-15 automatizados e verdes; restauração de um tenant medida (RPO/RTO observados registrados); nenhuma credencial de superuser ou de outro tenant acessível ao runtime.

## Riscos

- Instância compartilhada = mesmo processo, disco e superuser (risco residual R2 do ADR): mitigação por privilégio mínimo, mas **não é isolamento físico**.
- `CREATE EXTENSION vector` pode exigir privilégio elevado dependendo da versão/empacotamento; o provisionador administrativo executa essa etapa (verificar no ambiente real).
- Número de bancos × conexões: dimensionar `max_connections`, `CONNECTION LIMIT` por role e pool no runtime antes de 20 tenants.
