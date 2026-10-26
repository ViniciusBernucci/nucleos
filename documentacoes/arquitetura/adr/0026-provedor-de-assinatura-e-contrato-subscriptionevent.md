# ADR-026 — Provedor de assinatura e contrato `SubscriptionEvent`

- **Status:** Aceito em 2026-10-26, por decisão do usuário (mensagem \"ADR's aceitos\"). Os pontos em aberto listados neste ADR continuam como parâmetros a confirmar; o aceite não os fecha por inferência.
- **Data:** 2026-10-25
- **Decisores:** Vinícius (dono do produto; Q-06 segue aberta)
- **Origem:** [ENT-DEC-012](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012); ADR consolidado, [seção 11](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) passo 1 (pagamento por webhook autenticado, idempotente e persistido) e Entrega 4 (evento de assinatura simulado com idempotência; suspensão/reativação sem perda de dados)

## Contexto

O provisionamento começa por um webhook de pagamento (seção 11, passo 1). O MVP usa um **simulador** com o mesmo contrato, então a escolha do provedor não bloqueia o gate. Falha de pagamento **não** pode apagar dados (seção 11, offboarding). Provedores diferem em autenticação do webhook, nomes de evento e garantias de entrega; o Control Plane precisa de um contrato único e de uma máquina de estados explícita, independentes do provedor.

Fatos de provedores abaixo foram consultados em **2026-10-25** (WebFetch/WebSearch); o que não pôde ser confirmado está marcado **não verificado**.

| Aspecto | Stripe | Asaas | Mercado Pago |
| --- | --- | --- | --- |
| Autenticação do webhook | Cabeçalho `Stripe-Signature` (`t=` timestamp + `v1=`), HMAC-SHA256 sobre `t.payload` com segredo `whsec_`; tolerância padrão das bibliotecas de 5 min contra replay [S1] | Token estático no cabeçalho `asaas-access-token` (32–255 caracteres), devolvido só na criação; sem assinatura HMAC/timestamp encontrada [A1] | Cabeçalho `x-signature` (`ts=...,v1=...`) com `x-request-id` e `data.id`; algoritmo e *manifest* **não verificado** (página não descreve) [M1] |
| Entrega e reenvio | Produção: reenvia por até 3 dias com espera exponencial; teste: 3 tentativas em poucas horas [S2] | Não-2xx conta como falha; fila pode ser penalizada/interrompida; eventos pendentes perdidos após 14 dias [A1] | 200/201 em 22 s; sem confirmação, reenvio a cada 15 min, intervalo cresce após a 3ª tentativa [M1] |
| Ordem / duplicidade | Ordem **não garantida**; não usar `created` para ordenar; podem existir dois Events para o mesmo fato [S1] | Recomenda idempotência por id do evento; ordem **não verificado** [A1] | **não verificado** |
| Eventos de assinatura/pagamento | `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`; estados `past_due`, `unpaid`, `canceled`, `paused` [S2] | Webhooks são por cobrança (ex.: `PAYMENT_DELETED`); lista exata de nomes (inclui `PAYMENT_OVERDUE`) **não verificado** [A1] | Tópicos `subscription_preapproval`, `subscription_authorized_payment` [M1] |
| Sandbox | Modo de teste e CLI para disparar eventos [S1][S2] | **não verificado** | recomenda URLs separadas para teste e credenciais de teste [M1] |
| Preços, Pix/boleto, disponibilidade, NF | **não verificado** (fora do escopo; impostos/NF excluídos pelo ticket) | **não verificado** | **não verificado** |

Fontes (consultadas em 2026-10-25): [S1] https://docs.stripe.com/webhooks · [S2] https://docs.stripe.com/billing/subscriptions/webhooks · [A1] https://docs.asaas.com/docs/webhooks (HTTP 403 ao buscar direto; conteúdo obtido por busca que cita docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook, /docs/eventos-para-assinaturas e /docs/duvidas-frequentes-webhooks) · [M1] https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks. As páginas do Stripe foram retornadas em francês; o conteúdo foi lido e resumido.

## Problema

Qual contrato normalizado o Control Plane aceita de qualquer provedor (ou do simulador), como esses eventos mudam o estado do tenant sem jamais apagar dados por falha de pagamento, e qual provedor recomendar sem fechar Q-06?

## Decisão

1. **Contrato único.** O Control Plane consome somente `SubscriptionEvent` v1.0, definido em [`subscription-event.schema.json`](../contratos-propostos/subscription-event.schema.json) (JSON Schema Draft-07, **proposta** — o pacote `packages/contracts` pertence a FND-003, que absorverá o schema se este ADR for aceito). Adaptadores por provedor e o simulador traduzem para ele; nada do payload bruto do provedor entra no domínio (guardar só `raw_payload_ref`). O contrato não carrega dados de cartão nem PII (`additionalProperties: false`).
2. **Verificação antes de tudo.** O adaptador valida a autenticação do webhook do provedor (HMAC + janela de timestamp quando existir; comparação em tempo constante; token estático só como último recurso e com HTTPS) **antes** de normalizar. Evento inválido é rejeitado e auditado; nunca vira `SubscriptionEvent`.
3. **Idempotência.** Chave única `(provider, provider_event_id)` persistida **antes** de aplicar efeitos; repetição responde 2xx sem reaplicar. Aplicar o efeito e registrar a chave ocorrem na mesma transação.
4. **Ordem não garantida.** `occurred_at` é informativo e **não** ordena. A transição é decidida pela matriz sobre o *estado atual* do tenant; o par (evento, estado) é total (todo par tem linha), então evento fora de ordem vira "registrar, sem mudança" ou transição segura. **Reconciliação obrigatória:** antes de aplicar qualquer transição que altere acesso (`payment.succeeded`, `subscription.activated` e `subscription.resumed` com destino `ACTIVE`; `subscription.suspended_by_provider` com destino `SUSPENDED`; `subscription.canceled` com destino `CANCELED_RETAINED`), o Control Plane consulta o estado atual da assinatura (API do provedor; no MVP, o simulador expõe o mesmo estado) e só aplica se ele for coerente com o evento. Se a consulta falhar, o evento é registrado, **não é aplicado** e é reenfileirado; nenhum caminho apaga dados. Como o schema não tem sequência/versão, "dúvida" não seria verificável, por isso a regra vale sempre para esses eventos. A implementação é de EP-09; o teste de reordenação (par invertido, ex.: `subscription.resumed` seguido de `subscription.suspended_by_provider` obsoleto) será caso de FND-003/EP-09 contra o simulador.
5. **Matriz evento → transição** em [`matriz-evento-transicao.json`](../contratos-propostos/matriz-evento-transicao.json), resumida abaixo. Estados propostos (a alinhar com EP-02/EP-09): `NONE`, `PROVISIONING`, `ACTIVE`, `GRACE` (carência: runtime opera, responsável é avisado), `SUSPENDED` (runtime parado e tokens revogados, **dados retidos**), `CANCELED_RETAINED` (offboarding iniciado, dados retidos até o prazo contratual), `FAILED_RETRYABLE` (seção 11, passo 12).
6. **Falha de pagamento não apaga dados.** Nenhum `SubscriptionEvent` leva a estado de exclusão. Eventos de falha (`payment.failed`, `subscription.past_due`, `payment.action_required`) só levam a `GRACE` ou a nenhuma mudança; suspensão é consequência de `subscription.suspended_by_provider` (ou do fim do prazo de carência, gatilho interno do Control Plane, fora deste contrato). `payment.refunded` e `payment.disputed` apenas abrem revisão humana. Exclusão de dados só ocorre pelo processo de offboarding explícito, após o prazo aplicável e com autorização, e **não** é acionável por este contrato.
7. **Simulador.** Provedor `simulator` exige `simulated: true`; provedor real exige `simulated: false` (regra no schema). Produção rejeita `simulated: true`.
8. **Recomendação de provedor (não vinculante; Q-06 permanece aberta).** Critérios: (a) autenticação forte do webhook (HMAC + timestamp), (b) reenvio documentado e janela longa, (c) sandbox e ferramenta de disparo de eventos, (d) modelo de assinatura com estados claros, (e) meios de pagamento locais (Pix/boleto) e emissão fiscal, (f) custo, (g) risco de aprisionamento (mitigado pelo adaptador). Com os fatos verificados, **Stripe** é a melhor referência técnica para (a)–(d). Os critérios (e) e (f) são **não verificados** para todos e podem favorecer um provedor brasileiro (Asaas ou Mercado Pago), cuja autenticação documentada é mais fraca (token estático) ou incompleta nas fontes consultadas. A decisão final cabe ao usuário depois de verificar (e) e (f); por causa do adaptador, trocar de provedor não altera o domínio.

### Matriz (resumo; fonte de verdade: o JSON, validado por script)

Estado de origem: NONE=N, PROVISIONING=P, ACTIVE=A, GRACE=G, SUSPENDED=S, CANCELED_RETAINED=C, FAILED_RETRYABLE=F. `=` significa sem mudança de estado.

| Evento normalizado | Estados de origem → destino | Efeito |
| --- | --- | --- |
| `subscription.created` | todos → `=` | registra vínculo; não provisiona |
| `subscription.activated` | N → P; G,S → A; A,P,F,C → `=` | inicia provisionamento ou reativa; dados intactos |
| `payment.succeeded` | A → `=`; G,S → A; N,P,F,C → `=` | estende período / encerra carência |
| `payment.failed` | A → G; demais → `=` | abre carência e avisa; **sem remoção de dados** |
| `payment.action_required` | todos → `=` | avisa o responsável |
| `subscription.past_due` | A → G; demais → `=` | igual a falha de pagamento |
| `subscription.suspended_by_provider` | A,G → S; demais → `=` | para runtime, revoga tokens, **retém dados** |
| `subscription.resumed` | S,G → A; demais → `=` | reativa |
| `subscription.plan_changed` | A,G,S → `=` (atualiza plano/cotas); demais → `=` | reconcilia cotas |
| `subscription.canceled` | A,G,S → C; demais → `=` | inicia offboarding com retenção; **não apaga** |
| `payment.refunded` | todos → `=` | revisão humana |
| `payment.disputed` | todos → `=` | revisão humana |

Eventos do provedor sem equivalente (ex.: `invoice.upcoming`, `customer.updated`) são registrados e ignorados pelo adaptador (assinar só os necessários). Mapeamento Stripe ilustrativo: `invoice.paid`→`payment.succeeded` (e `subscription.activated` no primeiro pagamento), `invoice.payment_failed`→`payment.failed`, `customer.subscription.updated` com status `past_due`→`subscription.past_due`, status `unpaid`/`paused`→`subscription.suspended_by_provider` (**inferência do projeto**: [S2] fornece os nomes de evento e de estado, mas não prescreve esse mapeamento, e `unpaid` depende da configuração do Dashboard para o que fazer após esgotar as tentativas; o implementador deve reconferir), `customer.subscription.resumed`→`subscription.resumed`, `customer.subscription.deleted`→`subscription.canceled`, `charge.refunded`→`payment.refunded`, `charge.dispute.created`→`payment.disputed` (nomes de evento conforme [S2]). Mapeamento de Asaas e Mercado Pago: **não verificado** (nomes exatos não confirmados).

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| Domínio consome o payload do provedor | Menos código inicial | Acopla o domínio ao provedor; impede simulador com mesmo contrato |
| Aplicar efeito pela ordem de `occurred_at` | Simples | Ordem não garantida e timestamps repetem [S1]; risco de reativar/suspender errado |
| Suspender e apagar após N falhas | Reduz custo de infraestrutura | Viola a seção 11 (falha de pagamento não apaga dados); perda irreversível |
| Decidir o provedor agora | Fecha Q-06 | Fatos comerciais não verificados; decisão é do usuário |
| Estado de origem ignorado (evento → estado fixo) | Matriz menor | Eventos fora de ordem/duplicados levam a estados incorretos |

## Benefícios

Domínio independente do provedor; simulador e provedor real compartilham contrato testável; garantia estrutural, verificada por script, de que nenhum evento de pagamento leva a exclusão; idempotência e tolerância a reordenação definidas.

## Trade-offs

Camada de adaptação por provedor para manter; a reconciliação obrigatória por API adiciona uma chamada por transição que altera acesso, dependência de disponibilidade do provedor (falha de consulta adia a aplicação do evento) e latência; estados `GRACE`/`SUSPENDED`/`CANCELED_RETAINED` ampliam a máquina de estados do tenant; retenção de dados de inadimplentes tem custo de armazenamento.

## Consequências

- EP-02/EP-09 devem incorporar os estados propostos e o gatilho interno de fim de carência; o simulador (EP-09) emite `SubscriptionEvent` válido contra o schema.
- FND-003 move o schema para `packages/contracts` e gera tipos TS/Python; o script `validar.py` passa a ser teste do pacote.
- Parâmetros ainda sem valor: duração da carência, prazo de retenção pós-cancelamento, política de reembolso/disputa — dependem de decisão humana e do jurídico (ver DEC-011, rascunho).
- Segurança: segredo/token de webhook é segredo (nunca em repositório/log); resposta 2xx só após persistir a chave de idempotência.
- Observabilidade: registrar `provider`, `provider_event_id`, `event_type`, estado antes/depois e resultado (aplicado/duplicado/ignorado/rejeitado), sem payload bruto nem PII.

## Quando revisar

Ao decidir Q-06; ao aceitar DEC-011 (retenção); se o provedor escolhido não oferecer HMAC com timestamp; se a máquina de estados do tenant (EP-02) divergir dos estados propostos; antes do primeiro cliente real pagante.

## Referências

- [Ticket DEC-012](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012)
- Contrato proposto: [`subscription-event.schema.json`](../contratos-propostos/subscription-event.schema.json); matriz: [`matriz-evento-transicao.json`](../contratos-propostos/matriz-evento-transicao.json); evidência: [`validar.py`](../contratos-propostos/validar.py) e exemplos em [`exemplos/`](../contratos-propostos/exemplos/)
- [Documento de entrega](../../faturamento/2026-10-25-dec-012-adr-026-subscription-event.md)
- [ADR consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md), seção 11

## O que ainda depende de decisão humana

Aceitar este ADR; fechar Q-06 (provedor) após verificar preços, Pix/boleto, NF e disponibilidade; duração da carência e prazo de retenção; aprovar os estados novos do tenant.
