# DEC-012 — ADR-026 e contrato SubscriptionEvent — 2026-10-25

## 1. Metadados

- **Domínio:** faturamento
- **Tarefa:** DEC-012 do lote 2026-10-25-ep00-ep01-fundacao — [ENT-DEC-012](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012)
- **Branch:** `tarefa/dec-012`
- **Base / commit inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f` (base do manifesto); `HEAD` inicial igual à base; árvore da worktree limpa
- **Estado da entrega:** correção da rodada 1 aplicada; aguarda revalidação por revisor independente; ADR em status **Proposto**
- **Autores conhecidos:** Claude Sonnet 5.5 (executor); solicitante: Vinícius

## 2. Objetivo, contexto e escopo

- **Objetivo:** ADR-026 com provedor recomendado e contrato `SubscriptionEvent` (JSON Schema) compatível com o simulador (AC-1); matriz evento do provedor → transição do estado do tenant (AC-2).
- **Contexto:** seção 11 do ADR consolidado (webhook autenticado, idempotente, persistido; falha de pagamento não apaga dados). Q-06 (provedor preferido) segue aberta.
- **Escopo:** ADR, schema proposto, matriz, exemplos válidos/inválidos, script de validação.
- **Fora do escopo:** `packages/contracts` (FND-003), implementação de adaptador/simulador (EP-09), impostos/NF, aceitar o ADR, decidir Q-06, atualizar o índice `adr/README.md` (ver pendências).

## 3. Resumo da implementação

ADR-026 (Proposto) com fatos de Stripe, Asaas e Mercado Pago consultados em 2026-10-25 com URL, decisão de contrato único, idempotência, tratamento de ordem não garantida, matriz de transição e recomendação não vinculante de provedor. Schema Draft-07 com regras condicionais (falha exige código e tentativa; simulador exige `simulated: true`). Matriz legível por máquina; `validar.py` verifica schema, 6 exemplos válidos, 13 inválidos (11 originais + 2 da correção da rodada 1), completude da matriz (todo par evento × estado) e a invariante de que eventos de pagamento nunca levam a estado destrutivo.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0026-provedor-de-assinatura-e-contrato-subscriptionevent.md` | doc | ADR-026, status Proposto |
| `documentacoes/arquitetura/contratos-propostos/subscription-event.schema.json` | config (contrato) | JSON Schema proposto |
| `documentacoes/arquitetura/contratos-propostos/matriz-evento-transicao.json` | config (contrato) | matriz evento × estado → estado |
| `documentacoes/arquitetura/contratos-propostos/validar.py` | teste | validação do schema, exemplos e matriz |
| `documentacoes/arquitetura/contratos-propostos/exemplos/validos/*.json` (6) | teste | exemplos aceitos |
| `documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/*.json` (13) | teste | exemplos rejeitados |
| `documentacoes/faturamento/2026-10-25-dec-012-adr-026-subscription-event.md` e `-diffs.md` | doc | esta entrega |

Sem migrações, sem alteração de `CLAUDE.md`, `lessons/` ou índice de ADR.

## 5. Decisões técnicas, alternativas e consequências

Ver ADR-026 (alternativas e consequências). Pontos de design: Draft-07 por ser o suportado pela biblioteca disponível (jsonschema 3.2.0), compatível com geradores comuns; matriz total por (evento, estado) para tolerar reordenação/duplicidade; estados novos do tenant (`GRACE`, `SUSPENDED`, `CANCELED_RETAINED`) são propostas a alinhar com EP-02/EP-09. O script registra `format` `date-time`/`uuid` com verificadores próprios, pois a biblioteca não os aplica por padrão.

## 6. Validações (comandos e resultados reais)

| Comando | Resultado |
| --- | --- |
| `python3 documentacoes/arquitetura/contratos-propostos/validar.py` | 37 verificações OK, 0 falhas; "RESULTADO: TUDO CONFORME", código de saída 0 |
| Mesmo comando com a matriz adulterada (`SUSPENDED` → `DELETED` por `sed`, depois restaurada) | 2 FALHA reportadas (prova de que a invariante detecta estado destrutivo); matriz restaurada, saída 0 |
| Primeira execução do script | 4 FALHA reais de completude da matriz (pares faltantes); corrigidas na matriz e reexecutado |
| WebFetch/WebSearch de provedores (2026-10-25) | Stripe e Mercado Pago obtidos; Asaas retornou HTTP 403 em acesso direto, conteúdo obtido por busca (resumo); demais fatos marcados "não verificado" no ADR |

Não executado: build/lint de código (não há; gate NA para entrega documental), testes de integração com provedor real (sem contas; fora do escopo), revisão/QA independentes (sessões do orquestrador). Nenhum banco ou serviço real foi tocado.

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

Sem impacto em runtime: somente documentos e artefatos de contrato. Risco principal: fatos de provedor mudarem ou estarem incompletos (marcados "não verificado" onde aplicável). Rollback: reverter o commit. Observabilidade proposta no ADR.

## 8. Commits e diffs

Branch `tarefa/dec-012`, `HEAD` inicial `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, árvore limpa, base do manifesto. Um commit local foi criado ao final da tarefa (mensagem `docs(faturamento): ADR-026 e contrato SubscriptionEvent proposto (DEC-012)`); o SHA não pode constar dentro do próprio commit e é informado no retorno ao coordenador (`git log -1 tarefa/dec-012`). Diffs de schema, matriz, script e exemplos: [arquivo de diffs](2026-10-25-dec-012-adr-026-subscription-event-diffs.md). Ficam fora do patch, por serem só documentação: ADR-026, este documento e o arquivo de diffs.

## 9. Lessons

Nenhuma lesson criada. Justificativa: a entrega é decisória/documental (ADR, contrato proposto e script de verificação trivial); não introduz nem exercita conceito novo da stack da trilha (a trilha atual ainda não tem lessons publicadas e o conceito JSON Schema/idempotência será exercitado em FND-003 e EP-09, quando houver implementação real). `lessons/README.md` não foi alterado.

## 10. Pendências

- Índice `documentacoes/arquitetura/adr/README.md` não atualizado (evita conflito de merge com os demais ADR do lote); o coordenador deve acrescentar a linha ADR-026 na integração.
- Humano: aceitar ADR-026; fechar Q-06 após verificar preços, Pix/boleto, NF, disponibilidade, nomes de eventos do Asaas/Mercado Pago e algoritmo do `x-signature`; definir carência e retenção; aprovar estados do tenant.
- FND-003 deve migrar o schema para `packages/contracts`.

## 11. Correção rodada 1 (auditoria REVIEW-001..007)

Origem: [auditoria](../reviews/2026-10-25-auditoria-dec-012.md) (veredito CORRECOES_NECESSARIAS). `HEAD` de partida: `a790676ea63133ceb13f9fd891e62993a16fd1e3`. Aplicado somente o que o auditor decidiu APLICAR; um novo commit local (sem amend), cujo SHA é informado no retorno ao coordenador. Diff da rodada (código/contrato): [arquivo de diffs, seção "Correção rodada 1"](2026-10-25-dec-012-adr-026-subscription-event-diffs.md#correção-rodada-1). O diff das mudanças no ADR e neste documento fica fora do patch (só documentação).

| ID | Decisão | O que foi feito |
| --- | --- | --- |
| REVIEW-001 | APLICAR | ADR Decisão 4: reconciliação obrigatória antes de transições que alteram acesso (`payment.succeeded`, `subscription.activated`/`subscription.resumed` -> ACTIVE, `subscription.suspended_by_provider` -> SUSPENDED, `subscription.canceled` -> CANCELED_RETAINED); falha na consulta => evento registrado, não aplicado e reenfileirado. Trade-offs atualizado. Matriz e schema inalterados. Teste de reordenação ADIADO (FND-003/EP-09, contra o simulador). |
| REVIEW-004 | APLICAR | `minLength: 1` em `payment.failure_code`, `subscription.provider_status`, `raw_payload_ref`; inválido `12-failure-code-vazio.json`. |
| REVIEW-005 | APLICAR parcial | `validar.py` estende o `Draft7Validator` com `pattern` por `re.fullmatch` (docstring explica a divergência Python x ECMA-262); inválido `13-quebra-de-linha-final-em-campos-com-pattern.json` (`provider_event_id`, `subscription.plan_code`, `payment.currency` com `\n` final). Schema não alterado nos patterns. ajv ADIADO para FND-003. |
| REVIEW-006 | APLICAR | Mapeamento `unpaid`/`paused` -> `subscription.suspended_by_provider` rotulado como inferência do projeto; dependência da configuração do Dashboard registrada; [S2] citada só para nomes de evento/estado. Não reabri [S2] (aceito o relato do revisor). |
| REVIEW-007 | APLICAR | Mercado Pago: "recomenda URLs separadas para teste e credenciais de teste [M1]". |
| REVIEW-002 | ADIAR | Dedupe secundário Stripe: retomar no adaptador (EP-09) ou ao escolher Stripe em Q-06. Não tocado. |
| REVIEW-003 | REJEITAR | AC-2 coberto por composição; lacuna de Asaas/Mercado Pago declarada. Não tocado. |

Validações da rodada:

| Comando | Resultado |
| --- | --- |
| `python3 -I documentacoes/arquitetura/contratos-propostos/validar.py` | 39 verificações OK, 0 falhas; "RESULTADO: TUDO CONFORME", saída 0 (6 válidos aceitos, 13 inválidos rejeitados) |
| Mutação: remover `minLength` de `failure_code` | inválido 12 aceito -> FALHA, "RESULTADO: FALHOU (1)", saída 1; schema restaurado |
| Mutação: remover a extensão `fullmatch` (pattern nativo) | inválido 13 aceito -> FALHA, "RESULTADO: FALHOU (1)", saída 1; script restaurado |
| Teste negativo próprio por campo (derivado do válido 03, `python3 -I`) | `provider_event_id`, `plan_code`, `currency` com `\n` final, `provider_status` vazio e `raw_payload_ref` vazio: todos REJEITADOS; controle válido: ACEITO |

Nota honesta: o exemplo 13 combina três campos num só arquivo; a prova por campo é o teste negativo próprio acima (não versionado). Não executado: ajv/validador ECMA (sem dependência Node, ADIADO), nova consulta às fontes dos provedores. `adr/README.md` segue pendência do coordenador. Sem lessons (mesma justificativa da seção 9). Sem pendências novas além das adiadas acima.
