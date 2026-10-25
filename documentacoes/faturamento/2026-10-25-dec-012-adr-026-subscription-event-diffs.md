# DEC-012 — diffs dos artefatos de contrato e validação — 2026-10-25

Documento principal: [entrega](2026-10-25-dec-012-adr-026-subscription-event.md). Diffs textuais (arquivos novos contra /dev/null) de schema, matriz, script e exemplos, produzidos antes do commit. O ADR-026, este arquivo e o documento de entrega são só documentação e ficam fora do patch (regra anti-recursão do CLAUDE.md); estão listados no documento principal. Nenhum segredo ou dado pessoal; os identificadores dos exemplos são fictícios.

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/01-sem-event-id.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/01-sem-event-id.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/01-sem-event-id.json
new file mode 100644
index 0000000..dc4214e
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/01-sem-event-id.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"event_type":"subscription.activated","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/02-tipo-desconhecido.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/02-tipo-desconhecido.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/02-tipo-desconhecido.json
new file mode 100644
index 0000000..7474fce
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/02-tipo-desconhecido.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"e2","event_type":"tenant.delete","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/03-campo-extra-dados-de-cartao.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/03-campo-extra-dados-de-cartao.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/03-campo-extra-dados-de-cartao.json
new file mode 100644
index 0000000..51ac471
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/03-campo-extra-dados-de-cartao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e3","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":100,"currency":"BRL","card_number":"0000"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/04-falha-sem-codigo-nem-tentativa.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/04-falha-sem-codigo-nem-tentativa.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/04-falha-sem-codigo-nem-tentativa.json
new file mode 100644
index 0000000..4389288
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/04-falha-sem-codigo-nem-tentativa.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e4","event_type":"payment.failed","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":100,"currency":"BRL"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/05-pagamento-sem-bloco-payment.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/05-pagamento-sem-bloco-payment.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/05-pagamento-sem-bloco-payment.json
new file mode 100644
index 0000000..0cc57a0
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/05-pagamento-sem-bloco-payment.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e5","event_type":"payment.refunded","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/06-simulador-com-simulated-false.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/06-simulador-com-simulated-false.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/06-simulador-com-simulated-false.json
new file mode 100644
index 0000000..a599482
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/06-simulador-com-simulated-false.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":false,"provider_event_id":"e6","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/07-provedor-real-com-simulated-true.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/07-provedor-real-com-simulated-true.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/07-provedor-real-com-simulated-true.json
new file mode 100644
index 0000000..99a30b8
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/07-provedor-real-com-simulated-true.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":true,"provider_event_id":"e7","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/08-moeda-e-valor-invalidos.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/08-moeda-e-valor-invalidos.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/08-moeda-e-valor-invalidos.json
new file mode 100644
index 0000000..a8bf397
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/08-moeda-e-valor-invalidos.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e8","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":-5,"currency":"brl"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/09-plan-changed-sem-plano.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/09-plan-changed-sem-plano.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/09-plan-changed-sem-plano.json
new file mode 100644
index 0000000..8d2ba71
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/09-plan-changed-sem-plano.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"asaas","simulated":false,"provider_event_id":"e9","event_type":"subscription.plan_changed","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/10-id-com-caracteres-invalidos.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/10-id-com-caracteres-invalidos.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/10-id-com-caracteres-invalidos.json
new file mode 100644
index 0000000..a1ff044
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/10-id-com-caracteres-invalidos.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"a b/../c","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/11-data-invalida.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/11-data-invalida.json b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/11-data-invalida.json
new file mode 100644
index 0000000..0fcff0c
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/invalidos/11-data-invalida.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"ontem","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"e11","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/01-simulador-ativacao.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/01-simulador-ativacao.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/01-simulador-ativacao.json
new file mode 100644
index 0000000..9bf4627
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/01-simulador-ativacao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0001","event_type":"subscription.activated","subscription":{"provider_subscription_id":"sim_sub_001","plan_code":"starter","provider_status":"active"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/02-stripe-pagamento-ok.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/02-stripe-pagamento-ok.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/02-stripe-pagamento-ok.json
new file mode 100644
index 0000000..6865bba
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/02-stripe-pagamento-ok.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"evt_example_0002","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"sub_example_1","provider_customer_id":"cus_example_1","current_period_end":"2026-11-25T12:00:00Z"},"payment":{"provider_invoice_id":"in_example_1","amount_minor":9900,"currency":"BRL"},"raw_payload_ref":"webhook-raw/stripe/evt_example_0002"}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/03-stripe-falha-pagamento.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/03-stripe-falha-pagamento.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/03-stripe-falha-pagamento.json
new file mode 100644
index 0000000..0e3089e
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/03-stripe-falha-pagamento.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"evt_example_0003","event_type":"payment.failed","subscription":{"provider_subscription_id":"sub_example_1","provider_status":"past_due"},"payment":{"provider_invoice_id":"in_example_2","amount_minor":9900,"currency":"BRL","failure_code":"card_declined","attempt_count":1,"next_retry_at":"2026-10-28T12:00:00Z"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/04-simulador-suspensao.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/04-simulador-suspensao.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/04-simulador-suspensao.json
new file mode 100644
index 0000000..42d0265
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/04-simulador-suspensao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0004","event_type":"subscription.suspended_by_provider","subscription":{"provider_subscription_id":"sim_sub_001","tenant_id":"3f0c1a52-8d1e-4b7a-9c2e-5d6f7a8b9c0d"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/05-troca-de-plano.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/05-troca-de-plano.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/05-troca-de-plano.json
new file mode 100644
index 0000000..40a7e17
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/05-troca-de-plano.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"asaas","simulated":false,"provider_event_id":"evt_asaas_0005","event_type":"subscription.plan_changed","subscription":{"provider_subscription_id":"sub_asaas_1","plan_code":"business"}}
```

## documentacoes/arquitetura/contratos-propostos/exemplos/validos/06-cancelamento.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/exemplos/validos/06-cancelamento.json b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/06-cancelamento.json
new file mode 100644
index 0000000..9615d87
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/exemplos/validos/06-cancelamento.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0006","event_type":"subscription.canceled","subscription":{"provider_subscription_id":"sim_sub_001"}}
```

## documentacoes/arquitetura/contratos-propostos/matriz-evento-transicao.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/matriz-evento-transicao.json b/documentacoes/arquitetura/contratos-propostos/matriz-evento-transicao.json
new file mode 100644
index 0000000..bef821c
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/matriz-evento-transicao.json
@@ -0,0 +1,274 @@
+{
+  "_status": "PROPOSTO - ADR-026. Estados do tenant sao propostas a alinhar com EP-02/EP-09.",
+  "estados": [
+    "NONE",
+    "PROVISIONING",
+    "ACTIVE",
+    "GRACE",
+    "SUSPENDED",
+    "CANCELED_RETAINED",
+    "FAILED_RETRYABLE"
+  ],
+  "estados_que_apagam_dados": [],
+  "transicoes": [
+    {
+      "evento": "subscription.created",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar assinatura pendente e vinculo provider_subscription_id; nao muda estado (em NONE aguarda pagamento; nos demais e duplicata/idempotente)."
+    },
+    {
+      "evento": "subscription.activated",
+      "de": [
+        "NONE"
+      ],
+      "para": "PROVISIONING",
+      "acao": "Iniciar provisionamento (ADR consolidado, secao 11, passo 2)."
+    },
+    {
+      "evento": "subscription.activated",
+      "de": [
+        "GRACE",
+        "SUSPENDED"
+      ],
+      "para": "ACTIVE",
+      "acao": "Reativar runtime e tokens; dados intactos."
+    },
+    {
+      "evento": "subscription.activated",
+      "de": [
+        "ACTIVE",
+        "PROVISIONING",
+        "FAILED_RETRYABLE",
+        "CANCELED_RETAINED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Idempotente: registrar e ignorar. Em CANCELED_RETAINED nao reativa sozinho (decisao humana/nova assinatura)."
+    },
+    {
+      "evento": "payment.succeeded",
+      "de": [
+        "ACTIVE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Estender periodo vigente."
+    },
+    {
+      "evento": "payment.succeeded",
+      "de": [
+        "GRACE",
+        "SUSPENDED"
+      ],
+      "para": "ACTIVE",
+      "acao": "Encerrar carencia/suspensao; reativar runtime; dados intactos."
+    },
+    {
+      "evento": "payment.succeeded",
+      "de": [
+        "CANCELED_RETAINED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Nao reativa sozinho; sinalizar para decisao humana/nova assinatura."
+    },
+    {
+      "evento": "payment.succeeded",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar; provisionamento segue seu proprio fluxo."
+    },
+    {
+      "evento": "payment.failed",
+      "de": [
+        "ACTIVE"
+      ],
+      "para": "GRACE",
+      "acao": "Abrir carencia (prazo = parametro a decidir), notificar o responsavel; runtime continua operando."
+    },
+    {
+      "evento": "payment.failed",
+      "de": [
+        "GRACE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Incrementar tentativas; reavisar."
+    },
+    {
+      "evento": "payment.failed",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "SUSPENDED",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar. Nunca remove dados."
+    },
+    {
+      "evento": "payment.action_required",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED",
+        "FAILED_RETRYABLE",
+        "CANCELED_RETAINED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Notificar o responsavel (autenticacao do pagamento pendente)."
+    },
+    {
+      "evento": "subscription.past_due",
+      "de": [
+        "ACTIVE"
+      ],
+      "para": "GRACE",
+      "acao": "Igual a payment.failed em ACTIVE."
+    },
+    {
+      "evento": "subscription.past_due",
+      "de": [
+        "GRACE",
+        "SUSPENDED",
+        "NONE",
+        "PROVISIONING",
+        "FAILED_RETRYABLE",
+        "CANCELED_RETAINED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar."
+    },
+    {
+      "evento": "subscription.suspended_by_provider",
+      "de": [
+        "ACTIVE",
+        "GRACE"
+      ],
+      "para": "SUSPENDED",
+      "acao": "Suspender runtime e revogar tokens; reter bancos, objetos e backups; nada e apagado."
+    },
+    {
+      "evento": "subscription.suspended_by_provider",
+      "de": [
+        "SUSPENDED",
+        "NONE",
+        "PROVISIONING",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar."
+    },
+    {
+      "evento": "subscription.resumed",
+      "de": [
+        "SUSPENDED",
+        "GRACE"
+      ],
+      "para": "ACTIVE",
+      "acao": "Reativar runtime; dados intactos."
+    },
+    {
+      "evento": "subscription.resumed",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "ACTIVE",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar."
+    },
+    {
+      "evento": "subscription.plan_changed",
+      "de": [
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Atualizar plano/cotas desejadas; reconciliar runtime."
+    },
+    {
+      "evento": "subscription.plan_changed",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar."
+    },
+    {
+      "evento": "subscription.canceled",
+      "de": [
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED"
+      ],
+      "para": "CANCELED_RETAINED",
+      "acao": "Iniciar offboarding: suspender, iniciar relogio de retencao contratual; NAO apagar. Exclusao so por processo de offboarding explicito apos o prazo, fora deste contrato."
+    },
+    {
+      "evento": "subscription.canceled",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar; cancelar provisionamento pendente sem apagar artefatos ja criados sem revisao."
+    },
+    {
+      "evento": "subscription.canceled",
+      "de": [
+        "CANCELED_RETAINED"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Idempotente."
+    },
+    {
+      "evento": "payment.refunded",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar e abrir revisao humana; reembolso sozinho nao muda estado nem apaga dados."
+    },
+    {
+      "evento": "payment.disputed",
+      "de": [
+        "NONE",
+        "PROVISIONING",
+        "ACTIVE",
+        "GRACE",
+        "SUSPENDED",
+        "CANCELED_RETAINED",
+        "FAILED_RETRYABLE"
+      ],
+      "para": "UNCHANGED",
+      "acao": "Registrar e abrir revisao humana (decide suspensao); nunca apaga dados."
+    }
+  ]
+}
```

## documentacoes/arquitetura/contratos-propostos/subscription-event.schema.json

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/subscription-event.schema.json b/documentacoes/arquitetura/contratos-propostos/subscription-event.schema.json
new file mode 100644
index 0000000..3f2fb79
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/subscription-event.schema.json
@@ -0,0 +1,72 @@
+{
+  "$schema": "http://json-schema.org/draft-07/schema#",
+  "$id": "https://nucleos.invalid/contratos-propostos/subscription-event/1.0",
+  "title": "SubscriptionEvent (PROPOSTO - ADR-026)",
+  "description": "Evento normalizado de assinatura emitido pelo adaptador do provedor (ou pelo simulador) ao Control Plane. PROPOSTO: nao e o pacote packages/contracts (FND-003). Nao carrega dados de cartao nem PII; o payload bruto fica fora, referenciado por raw_payload_ref.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": ["schema_version", "provider", "provider_event_id", "event_type", "occurred_at", "received_at", "subscription", "simulated"],
+  "properties": {
+    "schema_version": { "const": "1.0" },
+    "provider": { "type": "string", "enum": ["simulator", "stripe", "asaas", "mercadopago"] },
+    "provider_event_id": { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[A-Za-z0-9_.:-]+$", "description": "Chave de idempotencia junto com provider. Unique (provider, provider_event_id)." },
+    "event_type": {
+      "type": "string",
+      "enum": [
+        "subscription.created", "subscription.activated", "subscription.past_due",
+        "subscription.suspended_by_provider", "subscription.resumed", "subscription.plan_changed",
+        "subscription.canceled", "payment.succeeded", "payment.failed",
+        "payment.action_required", "payment.refunded", "payment.disputed"
+      ]
+    },
+    "occurred_at": { "type": "string", "format": "date-time", "description": "Informativo. NAO define ordem de aplicacao (ordem de entrega nao e garantida)." },
+    "received_at": { "type": "string", "format": "date-time" },
+    "simulated": { "type": "boolean" },
+    "subscription": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["provider_subscription_id"],
+      "properties": {
+        "provider_subscription_id": { "type": "string", "minLength": 1, "maxLength": 128 },
+        "provider_customer_id": { "type": "string", "minLength": 1, "maxLength": 128 },
+        "tenant_id": { "type": "string", "format": "uuid", "description": "Presente quando o vinculo ja existe no Control Plane; senao o CP resolve por provider_subscription_id." },
+        "plan_code": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$" },
+        "provider_status": { "type": "string", "maxLength": 64, "description": "Status bruto informado pelo provedor, so para auditoria." },
+        "current_period_end": { "type": "string", "format": "date-time" }
+      }
+    },
+    "payment": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["amount_minor", "currency"],
+      "properties": {
+        "provider_invoice_id": { "type": "string", "minLength": 1, "maxLength": 128 },
+        "amount_minor": { "type": "integer", "minimum": 0 },
+        "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
+        "failure_code": { "type": "string", "maxLength": 64 },
+        "attempt_count": { "type": "integer", "minimum": 1 },
+        "next_retry_at": { "type": "string", "format": "date-time" }
+      }
+    },
+    "raw_payload_ref": { "type": "string", "maxLength": 256, "description": "Referencia (chave/URI interna) ao payload bruto guardado fora do evento." }
+  },
+  "allOf": [
+    {
+      "if": { "properties": { "event_type": { "enum": ["payment.succeeded", "payment.failed", "payment.action_required", "payment.refunded", "payment.disputed"] } }, "required": ["event_type"] },
+      "then": { "required": ["payment"] }
+    },
+    {
+      "if": { "properties": { "event_type": { "const": "payment.failed" } }, "required": ["event_type"] },
+      "then": { "properties": { "payment": { "required": ["failure_code", "attempt_count"] } } }
+    },
+    {
+      "if": { "properties": { "event_type": { "const": "subscription.plan_changed" } }, "required": ["event_type"] },
+      "then": { "properties": { "subscription": { "required": ["provider_subscription_id", "plan_code"] } } }
+    },
+    {
+      "if": { "properties": { "provider": { "const": "simulator" } }, "required": ["provider"] },
+      "then": { "properties": { "simulated": { "const": true } } },
+      "else": { "properties": { "simulated": { "const": false } } }
+    }
+  ]
+}
```

## documentacoes/arquitetura/contratos-propostos/validar.py

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/validar.py b/documentacoes/arquitetura/contratos-propostos/validar.py
new file mode 100644
index 0000000..32a9251
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/validar.py
@@ -0,0 +1,92 @@
+#!/usr/bin/env python3
+"""Valida o contrato PROPOSTO SubscriptionEvent (ADR-026) e a matriz evento -> transicao.
+
+Uso: python3 documentacoes/arquitetura/contratos-propostos/validar.py
+Requer: python3 e a biblioteca jsonschema (testado com 3.2.0, Draft-07). Sem rede, sem banco.
+Saida: 0 se tudo conforme; 1 caso contrario.
+"""
+import json
+import re
+import sys
+import uuid
+from datetime import datetime
+from pathlib import Path
+
+from jsonschema import Draft7Validator, FormatChecker
+
+AQUI = Path(__file__).resolve().parent
+RFC3339 = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")
+
+checker = FormatChecker()
+
+
+@checker.checks("date-time")
+def _dt(v):
+    if not isinstance(v, str) or not RFC3339.match(v):
+        return False
+    try:
+        datetime.fromisoformat(v.replace("Z", "+00:00"))
+        return True
+    except ValueError:
+        return False
+
+
+@checker.checks("uuid")
+def _uuid(v):
+    try:
+        return isinstance(v, str) and str(uuid.UUID(v)) == v.lower()
+    except ValueError:
+        return False
+
+
+def carregar(p):
+    return json.loads(Path(p).read_text(encoding="utf-8"))
+
+
+falhas = []
+
+
+def checar(cond, msg):
+    print(("OK   " if cond else "FALHA ") + msg)
+    if not cond:
+        falhas.append(msg)
+
+
+schema = carregar(AQUI / "subscription-event.schema.json")
+Draft7Validator.check_schema(schema)
+checar(True, "schema e um Draft-07 valido")
+v = Draft7Validator(schema, format_checker=checker)
+
+for f in sorted((AQUI / "exemplos/validos").glob("*.json")):
+    erros = list(v.iter_errors(carregar(f)))
+    checar(not erros, f"valido aceito: {f.name}" + ("" if not erros else f" -> {erros[0].message}"))
+for f in sorted((AQUI / "exemplos/invalidos").glob("*.json")):
+    erros = list(v.iter_errors(carregar(f)))
+    checar(bool(erros), f"invalido rejeitado: {f.name}" + (f" ({erros[0].message[:70]})" if erros else ""))
+
+# Matriz
+m = carregar(AQUI / "matriz-evento-transicao.json")
+estados = set(m["estados"])
+tipos = set(schema["properties"]["event_type"]["enum"])
+checar(m["estados_que_apagam_dados"] == [], "nenhum estado/transicao apaga dados")
+vistos = {}
+for t in m["transicoes"]:
+    checar(t["evento"] in tipos, f"evento da matriz existe no schema: {t['evento']}") if t["evento"] not in tipos else None
+    ok = set(t["de"]) <= estados and (t["para"] in estados or t["para"] == "UNCHANGED")
+    checar(ok, f"estados validos: {t['evento']} {t['de']} -> {t['para']}") if not ok else None
+    for s in t["de"]:
+        k = (t["evento"], s)
+        checar(k not in vistos, f"par (evento, estado) sem duplicidade: {k}") if k in vistos else None
+        vistos[k] = t["para"]
+for e in sorted(tipos):
+    faltam = [s for s in m["estados"] if (e, s) not in vistos]
+    checar(not faltam, f"matriz total para {e}" + (f" (faltam {faltam})" if faltam else ""))
+# Falha de pagamento nunca leva a estado destrutivo nem a cancelamento
+for e in ("payment.failed", "subscription.past_due", "payment.action_required", "payment.refunded", "payment.disputed"):
+    destinos = {vistos[(e, s)] for s in m["estados"] if (e, s) in vistos}
+    checar(destinos <= {"UNCHANGED", "GRACE"}, f"{e} so leva a UNCHANGED/GRACE (destinos: {sorted(destinos)})")
+checar(all("apag" not in t["para"].lower() and "DELET" not in t["para"] for t in m["transicoes"]),
+       "nenhuma transicao para estado de exclusao")
+
+print(f"\n{'RESULTADO: FALHOU (' + str(len(falhas)) + ')' if falhas else 'RESULTADO: TUDO CONFORME'}")
+sys.exit(1 if falhas else 0)
```
