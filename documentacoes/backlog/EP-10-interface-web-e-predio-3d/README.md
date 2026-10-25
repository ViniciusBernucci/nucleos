# EP-10 — Interface web e prédio 3D

> Prefixo: `ENT-WEB` · Sprints: S04–S10 · Tickets: 9 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Entregar a interface SaaS (Next.js + React + TypeScript, ADR-006) e o ambiente 3D (Three.js + React Three Fiber, GLB/glTF): login, seleção de organização, dashboard, prédio navegável com andares/departamentos/agentes, painel de aprovações e conversas, e backoffice de plataforma. A renderização 3D ocorre **no cliente**; o servidor não exige GPU.

## Princípios

- A UI nunca é fonte de autorização: toda decisão é do servidor; esconder um botão não é controle.
- O prédio 3D é **projeção de estado autorizado** (eventos reais do tenant, MSG-006), nunca fonte de dados.
- Degradação graciosa: modo 2D/lista equivalente para dispositivos fracos e acessibilidade.
- Segurança de frontend (CSP, XSS, CSRF, cookies) é requisito, não polimento.

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-WEB-001](tickets.md#ent-web-001) | Shell Next.js, autenticação e experiência multi-organização | S04 | L | ALTO | IAM-003, IAM-004, FND-003 |
| [ENT-WEB-002](tickets.md#ent-web-002) | Cliente de API tipado e estados de erro | S05 | S | MÉDIO | WEB-001 |
| [ENT-WEB-008](tickets.md#ent-web-008) | Segurança do frontend | S05 | M | ALTO | WEB-001, FND-007 |
| [ENT-WEB-005](tickets.md#ent-web-005) | Cena 3D base: edifício, andares e navegação | S06 | L | MÉDIO | WEB-001 |
| [ENT-WEB-003](tickets.md#ent-web-003) | Dashboard da organização | S08 | L | MÉDIO | IAM-007, AIG-003, RUN-003 |
| [ENT-WEB-004](tickets.md#ent-web-004) | Conversas com agentes e painel de aprovações | S08 | L | ALTO | RUN-005, RUN-006, MSG-006 |
| [ENT-WEB-006](tickets.md#ent-web-006) | Agentes 3D com estado em tempo real | S09 | L | MÉDIO | WEB-005, MSG-006 |
| [ENT-WEB-007](tickets.md#ent-web-007) | Desempenho 3D, pipeline de assets e modo 2D | S09 | M | MÉDIO | WEB-005, WEB-006 |
| [ENT-WEB-009](tickets.md#ent-web-009) | Backoffice de plataforma | S10 | L | ALTO | IAM-009, PRV-006, MSG-004, AIG-003 |

## Critério de saída

Usuário de A navega login → dashboard → prédio → agente → conversa → aprovação, vendo **somente** dados de A; testes E2E e axe sem violações críticas; orçamento de desempenho 3D atendido em dispositivo de referência.
