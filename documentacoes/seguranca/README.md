# Segurança

Documentos de segurança do NÚCLEOS Enterprise: modelo de ameaças, controles, evidências do gate de segurança (seção 15 do [ADR consolidado](../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)) e relatórios de auditoria.

- Não registrar segredos, tokens, dados pessoais ou valores de `.env`; use `[REDACTED]`.
- Decisões estruturais de segurança viram ADR em [arquitetura/adr](../arquitetura/adr/README.md).
- Relatórios de review, auditoria e QA do fluxo de IA ficam em `documentacoes/reviews/`.

Documentos:

- [Threat model STRIDE por fronteira (v0.2, 2026-10-25)](2026-10-25-threat-model-stride-por-fronteira.md) — ENT-DEC-001; revisão humana (AC-3) e aceite de RISK (AC-2) pendentes. Entrega: [dec-001](2026-10-25-dec-001-entrega.md).
- [Script de verificação do threat model](2026-10-25-threat-model-stride-por-fronteira.verificar.py) — `python3 -I <script> .` a partir da raiz do repositório; ver seção 8 do modelo.

Estado: pasta criada pela tarefa FND-008.
