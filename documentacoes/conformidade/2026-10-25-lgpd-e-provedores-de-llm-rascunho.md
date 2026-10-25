# LGPD e provedores de LLM — decisões e requisitos técnicos (RASCUNHO) — 2026-10-25

> **AVISO: este documento é um RASCUNHO técnico e NÃO constitui aconselhamento jurídico. Exige revisão do responsável legal/DPO (ainda não indicado) antes de qualquer decisão, contrato ou ativação de cliente real.** Papéis, bases legais, prazos e cláusulas abaixo são hipóteses de trabalho, não conclusões jurídicas.

- **Ticket:** [ENT-DEC-011](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-011) · **Referências:** [ADR consolidado](../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) seções 8.2 e 16 (itens 3 e 9); Lei 13.709/2018 (LGPD).
- **Estado:** rascunho; AC-1 (revisão legal) **pendente**; AC-2 atendido (seção 5).
- **Convenção de fatos de provedores:** cada fato traz fonte (URL) e data de consulta (2026-10-25). O que não foi possível confirmar está marcado **NÃO VERIFICADO**. Páginas de provedores mudam; reconfirmar antes do 1º cliente (bloqueio B-02).

## 1. Mapa de papéis (hipótese a validar pelo jurídico)

| Atividade | Cliente (empresa) | NÚCLEOS | Observação |
| --- | --- | --- | --- |
| Dados de usuários/clientes finais do cliente tratados pelos agentes | Controlador (hipótese) | Operador (hipótese) | Depende do contrato; o cliente define finalidades |
| Dados de conta/cobrança/uso do próprio cliente (login, faturamento, metering) | Titular: usuários do cliente | Controlador (hipótese) | Finalidades próprias do NÚCLEOS |
| Provedores de LLM, hospedagem, storage, e-mail, pagamentos | — | Suboperadores (hipótese) | Ver seção 2; exigem instrumento contratual |

Questões para o jurídico: base legal por finalidade; controlador conjunto ou não; encarregado (DPO) do NÚCLEOS e do cliente; transferência internacional (art. 33 LGPD) para provedores fora do Brasil.

## 2. Subprocessadores previstos (lista inicial)

| Categoria | Provedor | País de processamento | Situação |
| --- | --- | --- | --- |
| Gateway de LLM | OpenRouter | EUA/outros fora do EEA/UK (política de privacidade); Brasil não abordado. Fonte: <https://openrouter.ai/privacy> (2026-10-25) | Previsto no ADR (AIG-001) |
| LLM (via gateway) | Anthropic, OpenAI e outros roteados | Varia por endpoint: **NÃO VERIFICADO** | Seção 3 |
| Hospedagem (VPS) | **NÃO DEFINIDO** (Q-03 do lote; DEC-005 bloqueada) | NÃO VERIFICADO | Bloqueio B-03 |
| Storage de objetos/backup | **NÃO DEFINIDO** ([DEC-009](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-009) decide região/LGPD) | NÃO VERIFICADO | Bloqueio B-03 |
| E-mail transacional | **NÃO DEFINIDO** | NÃO VERIFICADO | — |
| Pagamentos/assinatura | **NÃO DEFINIDO** ([DEC-012](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012)); MVP usa simulador | NÃO VERIFICADO | — |
| Analytics do OpenRouter | Google Analytics, PostHog (citados na política do OpenRouter) | NÃO VERIFICADO | Fonte: <https://openrouter.ai/privacy> (2026-10-25) |

## 3. Provedores de LLM — fatos com fonte (consulta em 2026-10-25)

### 3.1 OpenRouter (gateway)

- Roteamento por requisito de política: `provider.data_collection` aceita `"allow"` (padrão: permite provedores que armazenam dados de forma não transitória e podem treinar) e `"deny"` (somente provedores que não coletam dados do usuário). Fonte: <https://openrouter.ai/docs/guides/routing/provider-selection> (2026-10-25).
- `provider.zdr: true` na requisição restringe o roteamento a endpoints com política de *zero data retention*; só acrescenta enforcement, não desliga o definido na conta. Há toggles por grupo de modelos na conta e campos de guardrail `enforce_zdr_anthropic|openai|google|xai|other` (o `enforce_zdr` legado é obsoleto). Fonte: <https://openrouter.ai/docs/guides/features/zdr> (2026-10-25).
- Ressalvas da mesma fonte: o enforcement cobre apenas o roteamento de inferência (plugins/ferramentas, ex.: web search, podem ter retenção própria de terceiros); endpoints cuja política não pode ser confirmada são tratados como se retivessem e treinassem; as declarações de ZDR em BYOK/endpoints privados são atestações do cliente; os toggles Anthropic/OpenAI/Google removem apenas endpoints de primeira parte (Bedrock, Vertex e Azure continuam disponíveis).
- `only`, `ignore` e `allow_fallbacks` (padrão `true`) permitem lista de provedores e controlam fallback; restringir reduz a resiliência. Fonte: <https://openrouter.ai/docs/guides/routing/provider-selection> (2026-10-25).
- O opt-out de treinamento "não tem relação" com as políticas do próprio OpenRouter; esta página não descreve retenção do OpenRouter. Roteamento regional (`eu.openrouter.ai`/`us.openrouter.ai`) é descrito para planos Business/Enterprise. Fonte: <https://openrouter.ai/docs/guides/privacy/provider-logging> (2026-10-25).
- Política de privacidade: não declara prazo de retenção de prompts de texto; afirma não usar Inputs/Outputs para treinar modelos próprios, mas "alguns provedores podem"; menciona DPA para usuários Enterprise e API sem dizer como obtê-lo; transferências fora do EEA/UK citam decisões de adequação e cláusulas-padrão (GDPR); **transferência a partir do Brasil não é tratada**. Fonte: <https://openrouter.ai/privacy> (2026-10-25).
- DPA do OpenRouter: existência citada, **disponibilidade e termos NÃO VERIFICADOS**.

### 3.2 Anthropic (API direta ou via gateway)

- API: entradas e saídas são apagadas do backend em até 30 dias, salvo exceções (Files API, acordo específico como ZDR, aplicação da Usage Policy, exigência legal). ZDR é disponível por acordo separado. Conteúdo sinalizado por trust and safety pode ser retido por até 2 anos (scores até 7 anos). Fonte: <https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data> (2026-10-25).
- Treinamento com dados de API e DPA: **NÃO VERIFICADO** nesta consulta.

### 3.3 OpenAI (API direta ou via gateway)

- Dados enviados à API não são usados para treinamento por padrão (opt-in possível). Logs de monitoramento de abuso: até 30 dias por padrão, mais se exigido por lei/proteção. ZDR exige aprovação prévia da OpenAI e depende do endpoint (Chat Completions, Responses e Embeddings listados como elegíveis, com limitações; Files, Batches, Assistants, Vector Stores etc. não). Fonte: <https://developers.openai.com/api/docs/guides/your-data> (2026-10-25).
- DPA e país de processamento: **NÃO VERIFICADO**.

### 3.4 Demais provedores (Google, xAI, outros)

**NÃO VERIFICADO.** Regra derivada: modelo/provedor sem política verificada e registrada nesta tabela permanece **bloqueado** (R-02).

## 4. Decisões propostas (a aprovar pelo responsável legal)

| ID | Decisão proposta | Origem |
| --- | --- | --- |
| D-01 | Provedores de LLM recebem apenas o mínimo necessário; nunca segredos de tenant | ADR 8.2 |
| D-02 | Por padrão, roteamento com `provider.data_collection="deny"` e `provider.zdr=true`; exceção só por allowlist aprovada | seção 3.1 |
| D-03 | Prompts, respostas e documentos não são registrados em logs por padrão; só metadados | ADR 10 (Logs) |
| D-04 | Titular exerce acesso, correção e eliminação por fluxo do cliente (controlador), com apoio técnico do NÚCLEOS | seção 5 R-05 |
| D-05 | Incidentes têm registro e prazos definidos com o jurídico antes do 1º cliente real | seção 5 R-06 |

## 5. Requisitos técnicos derivados e tickets que os implementam (AC-2)

| ID | Requisito | Ticket |
| --- | --- | --- |
| R-01 | Minimização de dados no prompt (sem segredos, só contexto necessário) | [ENT-AIG-001](../backlog/EP-07-tool-gateway-e-ai-gateway/tickets.md), [ENT-TGW-006](../backlog/EP-07-tool-gateway-e-ai-gateway/tickets.md) |
| R-02 | Bloqueio de provedores sem política aceitável (`data_collection="deny"`, `zdr=true`, allowlist `only`) | [ENT-AIG-001](../backlog/EP-07-tool-gateway-e-ai-gateway/tickets.md) |
| R-03 | Sem log de prompts/respostas por padrão; allowlist de campos e redação | [ENT-AIG-001](../backlog/EP-07-tool-gateway-e-ai-gateway/tickets.md), [ENT-OBS-001](../backlog/EP-11-observabilidade-e-operacao/tickets.md), [ENT-DEC-010](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-010) |
| R-04 | Prazo de retenção configurável por tenant e expurgo de documentos, conversas e memória derivada | [ENT-RAG-004](../backlog/EP-08-memoria-e-rag/tickets.md) |
| R-05 | Direitos do titular: acesso (exportação), correção e eliminação verificável | [ENT-PRV-010](../backlog/EP-09-provisionamento-ponta-a-ponta/tickets.md), [ENT-RAG-004](../backlog/EP-08-memoria-e-rag/tickets.md) |
| R-06 | Registro e política de incidentes (severidades, prazos de notificação, evidências) | [ENT-OBS-005](../backlog/EP-11-observabilidade-e-operacao/tickets.md), [ENT-OBS-003](../backlog/EP-11-observabilidade-e-operacao/tickets.md) |
| R-07 | Backups externos criptografados e política de retenção de backups | [ENT-DAT-007](../backlog/EP-03-dados-segregados-postgres-storage-backup/tickets.md) |
| R-08 | Medição de uso por tenant e provedor para rastrear fluxo de dados | [ENT-AIG-003](../backlog/EP-07-tool-gateway-e-ai-gateway/tickets.md) |
| R-09 | Dossiê LGPD consolidado (papéis, subprocessadores, fluxos, retenção, evidências) | [ENT-GATE-007](../backlog/EP-12-gate-de-seguranca-e-go-no-go/tickets.md) |
| R-10 | Checklist go/no-go do 1º cliente real inclui os bloqueios da seção 6 | [ENT-GATE-008](../backlog/EP-12-gate-de-seguranca-e-go-no-go/tickets.md) |

Observação: a incorporação desses requisitos como critérios de aceite nos tickets é ação do coordenador/Tech Lead; este rascunho não altera o backlog.

## 6. Bloqueios para ativar o 1º cliente real

- **B-01:** revisão deste documento por responsável legal/DPO indicado (AC-1).
- **B-02:** reconfirmação dos fatos da seção 3 na data da ativação e verificação dos itens NÃO VERIFICADOS (DPAs, país de processamento, treinamento).
- **B-03:** definição de hospedagem, storage, e-mail e pagamentos, com país e instrumento contratual.
- **B-04:** DPAs/cláusulas de transferência internacional assinados com os subprocessadores.
- **B-05:** termos ao cliente (papéis, subprocessadores, retenção, incidentes) aprovados — [ENT-GATE-007](../backlog/EP-12-gate-de-seguranca-e-go-no-go/tickets.md).
- **B-06:** R-01 a R-05 implementados e evidenciados.

## 7. Pendências

- AC-1 (revisão legal) aguarda responsável legal/DPO ainda não indicado.
- Itens NÃO VERIFICADOS das seções 2 e 3.
