# Auditoria independente do review ENT-DEC-011 — 2026-10-25

- **Relatorio de origem:** `documentacoes/reviews/2026-10-25-review-dec-011.md` (veredito original do revisor preservado: APPROVED WITH NOTES).
- **Tarefa:** ENT-DEC-011 (`documentacoes/backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-011`).
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/dec-011` · `tarefa/dec-011`
- **Base:** 4be3ce391a51b9e24cd85f7c894d841636dcd50f · **HEAD auditado:** 3fa25607546cb758a778758b340793c2eba005e0 (confirmado por `git rev-parse`; sem mudanca desde o review).
- **Auditor:** sessao independente (nao implementou nem revisou). Nada foi editado no codigo/rascunho nem commitado.
- **Executado:** leitura do relatorio, do rascunho (`documentacoes/conformidade/2026-10-25-lgpd-e-provedores-de-llm-rascunho.md`), do ticket e de `documentacoes/backlog/README.md` e do lote; WebFetch proprio em 2026-10-25 de `openrouter.ai/docs/guides/features/zdr`, `openrouter.ai/privacy` (2 consultas) e `openrouter.ai/docs/guides/privacy/provider-logging`. **Nao executado:** build/testes (NA, so documentacao). Limite: WebFetch resume a pagina com modelo menor; citacoes abaixo sao as devolvidas, nao texto integral.

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | MEDIO | MEDIO | **APLICAR** |
| REVIEW-002 | BAIXO | — | **REJEITAR** |
| REVIEW-003 | BAIXO | — | **REJEITAR** |
| REVIEW-004 | BAIXO | — | **REJEITAR** |

### REVIEW-001 — APLICAR (defeito confirmado, solucao do revisor aceita)
- Evidencia direta (zdr, WebFetch proprio): Anthropic "Removes first-party Anthropic endpoints (Bedrock and Vertex remain available)"; OpenAI "...(Azure remains available)"; Google "Removes AI Studio endpoints (Vertex remains available)"; SpaceXAI "Removes non-ZDR SpaceXAI endpoints (the ZDR SpaceXAI endpoint remains available)"; outros "Removes all other non-ZDR endpoints".
- Rascunho secao 3 (linha 37) diz que os toggles Anthropic/OpenAI/Google "removem apenas endpoints de primeira parte (Bedrock, Vertex e Azure continuam disponiveis)": agrupa terceiros sem mapear por escopo, chama de "primeira parte" o escopo Google (que remove AI Studio) e omite os escopos xai/other, que removem todo endpoint nao-ZDR. Isso e insumo de AIG-001 (bloqueado por DEC-011) e pode induzir a crer que terceiros nunca sao filtrados.
- Criterio: ticket exige "como forcar via gateway ... verificar na documentacao vigente"; fato impreciso viola o entregavel.
- Risco da alteracao: baixo (texto de uma frase/lista).
- Plano minimo: reescrever a ressalva em lista por escopo (Anthropic: mantem Bedrock/Vertex; OpenAI: mantem Azure; Google: remove AI Studio, mantem Vertex; xai: remove nao-ZDR xAI, endpoint ZDR permanece; other: remove todos os nao-ZDR), mesma fonte e data 2026-10-25. Verificacao: reabrir a URL e comparar; reler o documento de entrega para refletir a correcao.

### REVIEW-002 — REJEITAR (falso positivo)
- Evidencia (privacy, WebFetch proprio): secao com titulo "Enterprise and API Users" abre com "If you have a Data Processing Agreement with us, the terms of that agreement...". Outras mencoes (Files API, Data Transfers) so referenciam o DPA. A pagina nao diz como obter o DPA.
- Rascunho (linha 40) "menciona DPA para usuarios Enterprise e API sem dizer como obte-lo" e fiel; a linha 41 ja marca disponibilidade/termos como NAO VERIFICADO. Nenhum defeito demonstrado. Opcional (nao requerido): acrescentar "condicional ('se voce tiver um DPA')".

### REVIEW-003 — REJEITAR (falso positivo; fatos rastreaveis no repo)
- Q-03 existe: `documentacoes/backlog/README.md:83` ("Provedor, plano e acesso a VPS", bloqueia DEC-005, ISO-001); `README.md:141` ("DEC-005 | Bloqueada ate haver VPS (Q-03)"); tambem `documentacoes/planejamento-ia/lote-2026-10-25-ep00-ep01-fundacao.md:15,61`. O revisor buscou apenas em `tickets.md`.
- provider-logging foi reaberta por este auditor: confirma que o opt-out "has no bearing on OpenRouter's own policies" e roteamento regional `eu./us.openrouter.ai` nos planos Business e Enterprise; a pagina cobre retencao dos provedores, nao a do OpenRouter, coerente com a linha 39 do rascunho.
- Opcional (nao requerido): apontar `backlog/README.md` como origem de Q-03.

### REVIEW-004 — REJEITAR (premissa errada)
- Fonte: campos `enforce_zdr_anthropic|openai|google|xai|other`; apenas o rotulo exibido e "SpaceXAI". O rascunho (linha 36) usa `enforce_zdr_xai`, identico ao campo. Nada a corrigir. Sugestao nao obrigatoria: mencionar que o rotulo da UI e "SpaceXAI".

## Veredito: CORRECOES_NECESSARIAS
Apenas REVIEW-001 e necessario (correcao textual, antes de AIG-001 usar o documento). Nao ha bloqueio de seguranca. AC-1 (revisao por responsavel legal) segue pendente e fora do alcance; a tarefa nao deve ser dada como DONE quanto ao AC-1. Sem fato novo, REVIEW-002/003/004 nao devem ser reabertos.

## Handoff
Enviar ao review-loop-driver: **REVIEW-001** (APLICAR). Teste esperado: comparacao com a pagina ZDR por escopo.
