# EP-02 — Control Plane: identidade e autorização

> Prefixo: `ENT-IAM` · Sprints: S01–S09 · Tickets: 10 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Implementar o Control Plane em NestJS (ADR-004) com organizações (tenants), usuários, memberships, RBAC/ABAC, catálogo de módulos/planos, auditoria e acesso administrativo excepcional. Princípio: **o tenant é resolvido no servidor por membership no banco central; nada vindo do corpo/URL é prova de autorização** (ADR seção 5.1).

## Escopo

- API versionada `/v1`, Problem Details, validação, *rate limit*, OpenAPI.
- Banco `nucleos_control` com metadados mínimos (ADR seção 6.1 item 9).
- Autenticação conforme ADR-016, sessões revogáveis, MFA.
- Política de autorização reutilizável e **harness de testes A/B** que serve a todos os épicos (SEC-01).

## Fora do escopo

- Runtime, gateways e provisionamento (EP-05..09); interface (EP-10).
- Cobrança/pagamento (apenas o evento simulado em EP-09).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-IAM-001](tickets.md#ent-iam-001) | Bootstrap da API NestJS | S01 | M | MÉDIO | FND-001, FND-003 |
| [ENT-IAM-002](tickets.md#ent-iam-002) | Banco de controle: esquema e migrations iniciais | S01 | L | ALTO | DEC-003, FND-004 |
| [ENT-IAM-003](tickets.md#ent-iam-003) | Autenticação, MFA e proteção contra força bruta | S02 | L | ALTO | DEC-002, IAM-002 |
| [ENT-IAM-004](tickets.md#ent-iam-004) | Sessão e resolução de contexto de tenant | S02 | M | CRÍTICO | IAM-003 |
| [ENT-IAM-005](tickets.md#ent-iam-005) | RBAC/ABAC do Control Plane | S02 | M | ALTO | IAM-004 |
| [ENT-IAM-006](tickets.md#ent-iam-006) | Organizações, memberships e convites | S02 | M | ALTO | IAM-005 |
| [ENT-IAM-010](tickets.md#ent-iam-010) | Harness de testes de autorização A/B | S02 | M | CRÍTICO | IAM-004 |
| [ENT-IAM-007](tickets.md#ent-iam-007) | Catálogo de módulos, planos e entitlements | S03 | M | MÉDIO | IAM-006 |
| [ENT-IAM-008](tickets.md#ent-iam-008) | Auditoria append-only e eventos de segurança | S03 | M | ALTO | IAM-002 |
| [ENT-IAM-009](tickets.md#ent-iam-009) | Acesso administrativo excepcional (break-glass) | S09 | M | ALTO | IAM-005, IAM-008 |

## Critério de saída

SEC-01 automatizado e verde para todos os endpoints existentes; qualquer novo endpoint sem declaração de política falha no CI; auditoria registra autenticação, mudança de papel e acesso administrativo.

## Riscos

- Resolver tenant por cabeçalho/rota sem verificar membership (IDOR) — mitigado por IAM-004 + IAM-010.
- Ponto único de comprometimento: o Control Plane alcança todos os tenants (ADR-025); manter a superfície mínima e sem credencial de dados de tenant.
