# EP-04 — Isolamento de host, containers e rede

> Prefixo: `ENT-ISO` · Sprints: S01–S08 · Tickets: 8 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Implementar as seções 7 e 4.1 do ADR (ADR-010, ADR-014): host endurecido, containers de tenant sem privilégios, redes segregadas com **bloqueio entre tenants efetivo no host e testado**, egress controlado contra SSRF e cadeia de suprimentos de imagens verificável.

## Honestidade de modelo

Containers compartilham kernel. Este épico reduz a probabilidade e o impacto de fuga e de movimento lateral, mas **não** equivale a MicroVM/VM. Código arbitrário do cliente permanece **proibido** (ADR-013) até existir Sandbox Executor próprio.

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-ISO-001](tickets.md#ent-iso-001) | Baseline do host (Ansible) | S01 | M | CRÍTICO | DEC-005 |
| [ENT-ISO-002](tickets.md#ent-iso-002) | Perfil de hardening de containers + policy-as-code | S02 | M | ALTO | DEC-005, FND-004 |
| [ENT-ISO-003](tickets.md#ent-iso-003) | Redes por tenant e bloqueio entre tenants | S03 | L | CRÍTICO | ISO-001, ISO-002, DEC-005 |
| [ENT-ISO-005](tickets.md#ent-iso-005) | Exposição mínima de serviços internos | S03 | S | ALTO | ISO-003 |
| [ENT-ISO-007](tickets.md#ent-iso-007) | Cadeia de suprimentos de imagens | S03 | M | ALTO | FND-005 |
| [ENT-ISO-004](tickets.md#ent-iso-004) | Controle de egress e proteção contra SSRF | S04 | L | CRÍTICO | ISO-003 |
| [ENT-ISO-006](tickets.md#ent-iso-006) | Volumes e quotas por tenant | S06 | M | MÉDIO | ISO-003 |
| [ENT-ISO-008](tickets.md#ent-iso-008) | Suíte automatizada de isolamento host/rede | S08 | M | CRÍTICO | ISO-003..006, PRV-005 |

> A numeração segue a ordem lógica do planejamento original; a ordem de execução é a da coluna Sprint.

## Critério de saída

SEC-04, SEC-11, SEC-12 e a parte de rede/volume de SEC-16 automatizados e verdes **após reinício do daemon Docker e do host**; nenhum container de tenant com `privileged`, socket do Docker, `network_mode: host` ou capabilities além da allowlist.

## Riscos

- Regras de firewall do Docker são recriadas/alteradas em reinícios: o teste de regressão após reinício é obrigatório (ISO-008).
- VPS pode não oferecer controle completo de rede/kernel (módulos, nftables); validar cedo (DEC-005).
