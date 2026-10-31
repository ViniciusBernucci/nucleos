# FND-003 - diffs de schemas e exemplos (2026-10-26)

Registro principal: [2026-10-26-fnd-003-contratos-ts-python.md](2026-10-26-fnd-003-contratos-ts-python.md) · Diffs de codigo/config: [2026-10-26-fnd-003-contratos-ts-python-diffs.md](2026-10-26-fnd-003-contratos-ts-python-diffs.md).
Intervalo: `git diff d00e8df b5297d6` restrito a `packages/contracts/schemas` e `packages/contracts/exemplos` (inclui a correcao da rodada 1 de ProblemDetails).

## baseline (resumo)

`packages/contracts/baseline/*.schema.json` e copia byte a byte de `schemas/` (promocao via `make contracts-baseline`); verificado por `sha256sum`: IDENTICOS.

```
 .../baseline/tool-call-request.schema.json         |  48 ++++
 .../baseline/tool-call-response.schema.json        |  87 ++++++++
 11 files changed, 1394 insertions(+)

0e0861e587ef34e257733e05547eec2e0c4369f43196aa463f11203c65cc7f53  ai-completion-request.schema.json
c850e9f46dbcfb2139074a33fe455aeede21ce04b07377a985e52dd0bb29d152  ai-completion-response.schema.json
082f64f1fba8d2d43861827a02da4727f094f51ca7ac6c7446624932cea61ac1  handshake.schema.json
47ab3ed5604f0a7165437a6c55f519455ec7caf3f288252943ea1f0f6d9ada5c  job-envelope.schema.json
62e9296ffe4a4168e8e0192d2616ed9a930e2228b45f8fbdb2bcf3fddeafec24  problem-details.schema.json
5719edc8acd7c574a4cb050d6c1d54661d774615621f57a988a288a062256ad8  realtime-event.schema.json
71f7a977fe3ad51692a82dbcf1804b3fdf6c403b81f0778a24db87dca182c3ad  runtime-token.schema.json
f97ab75ffdf88040eca94b383003c7554755cff212fad41cd6c947afda489b85  subscription-event.schema.json
d8e161be7952cec8b0e6b7c85c07960b6afab57e6c06939953d93dad1bf1b9eb  tenant-runtime-spec.schema.json
d8a1ce40b9b1e19b9c65e76d24e94063261a583343a342bbb5f37bfe61fa6e85  tool-call-request.schema.json
397066f483a4a35001c5755fd80243707e20713ffc8db68b65e99fed7280f1f3  tool-call-response.schema.json
```

## Patch

```diff
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/01-messages-vazio.json b/packages/contracts/exemplos/ai-completion-request/invalidos/01-messages-vazio.json
new file mode 100644
index 0000000..e9832a2
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/01-messages-vazio.json
@@ -0,0 +1,11 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [],
+  "max_output_tokens": 512,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/02-role-invalida.json b/packages/contracts/exemplos/ai-completion-request/invalidos/02-role-invalida.json
new file mode 100644
index 0000000..18afc84
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/02-role-invalida.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "admin",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/03-campo-tenant-id.json b/packages/contracts/exemplos/ai-completion-request/invalidos/03-campo-tenant-id.json
new file mode 100644
index 0000000..e00ffa0
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/03-campo-tenant-id.json
@@ -0,0 +1,21 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 0.2,
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15"
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/04-temperatura-3.json b/packages/contracts/exemplos/ai-completion-request/invalidos/04-temperatura-3.json
new file mode 100644
index 0000000..fcae65a
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/04-temperatura-3.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 3
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/05-alias-maiusculo.json b/packages/contracts/exemplos/ai-completion-request/invalidos/05-alias-maiusculo.json
new file mode 100644
index 0000000..a4669d1
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/05-alias-maiusculo.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "GPT",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/06-max-tokens-zero.json b/packages/contracts/exemplos/ai-completion-request/invalidos/06-max-tokens-zero.json
new file mode 100644
index 0000000..66b17c2
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/06-max-tokens-zero.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 0,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/invalidos/07-message-extra.json b/packages/contracts/exemplos/ai-completion-request/invalidos/07-message-extra.json
new file mode 100644
index 0000000..dfb61b1
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/invalidos/07-message-extra.json
@@ -0,0 +1,21 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve.",
+      "name": "x"
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/validos/01-base.json b/packages/contracts/exemplos/ai-completion-request/validos/01-base.json
new file mode 100644
index 0000000..b631c5f
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/validos/01-base.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ],
+  "max_output_tokens": 512,
+  "temperature": 0.2
+}
diff --git a/packages/contracts/exemplos/ai-completion-request/validos/02-sem-opcionais.json b/packages/contracts/exemplos/ai-completion-request/validos/02-sem-opcionais.json
new file mode 100644
index 0000000..dfa8443
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-request/validos/02-sem-opcionais.json
@@ -0,0 +1,18 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 1,
+  "idempotency_key": "run-1:step-1",
+  "model_alias": "padrao",
+  "messages": [
+    {
+      "role": "system",
+      "content": "Seja breve."
+    },
+    {
+      "role": "user",
+      "content": "Ola"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/01-ok-sem-usage.json b/packages/contracts/exemplos/ai-completion-response/invalidos/01-ok-sem-usage.json
new file mode 100644
index 0000000..b40f219
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/01-ok-sem-usage.json
@@ -0,0 +1,7 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "stop"
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/02-uso-negativo.json b/packages/contracts/exemplos/ai-completion-response/invalidos/02-uso-negativo.json
new file mode 100644
index 0000000..adb2e2d
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/02-uso-negativo.json
@@ -0,0 +1,12 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "stop",
+  "usage": {
+    "input_tokens": -1,
+    "output_tokens": 3,
+    "cost_micros": 120
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/03-finish-reason-invalido.json b/packages/contracts/exemplos/ai-completion-response/invalidos/03-finish-reason-invalido.json
new file mode 100644
index 0000000..f49efc0
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/03-finish-reason-invalido.json
@@ -0,0 +1,12 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "other",
+  "usage": {
+    "input_tokens": 10,
+    "output_tokens": 3,
+    "cost_micros": 120
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/04-ok-sem-content.json b/packages/contracts/exemplos/ai-completion-response/invalidos/04-ok-sem-content.json
new file mode 100644
index 0000000..c9deefa
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/04-ok-sem-content.json
@@ -0,0 +1,11 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "finish_reason": "stop",
+  "usage": {
+    "input_tokens": 10,
+    "output_tokens": 3,
+    "cost_micros": 120
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/05-error-sem-error.json b/packages/contracts/exemplos/ai-completion-response/invalidos/05-error-sem-error.json
new file mode 100644
index 0000000..16863fc
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/05-error-sem-error.json
@@ -0,0 +1,12 @@
+{
+  "schema_version": "1.0",
+  "status": "error",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "stop",
+  "usage": {
+    "input_tokens": 10,
+    "output_tokens": 3,
+    "cost_micros": 120
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/invalidos/06-custo-decimal.json b/packages/contracts/exemplos/ai-completion-response/invalidos/06-custo-decimal.json
new file mode 100644
index 0000000..0113b43
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/invalidos/06-custo-decimal.json
@@ -0,0 +1,12 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "stop",
+  "usage": {
+    "input_tokens": 10,
+    "output_tokens": 3,
+    "cost_micros": 1.5
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/validos/01-base.json b/packages/contracts/exemplos/ai-completion-response/validos/01-base.json
new file mode 100644
index 0000000..6d74ffa
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/validos/01-base.json
@@ -0,0 +1,12 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "model_alias": "padrao",
+  "content": "Ola!",
+  "finish_reason": "stop",
+  "usage": {
+    "input_tokens": 10,
+    "output_tokens": 3,
+    "cost_micros": 120
+  }
+}
diff --git a/packages/contracts/exemplos/ai-completion-response/validos/02-erro.json b/packages/contracts/exemplos/ai-completion-response/validos/02-erro.json
new file mode 100644
index 0000000..1014574
--- /dev/null
+++ b/packages/contracts/exemplos/ai-completion-response/validos/02-erro.json
@@ -0,0 +1,8 @@
+{
+  "schema_version": "1.0",
+  "status": "error",
+  "error": {
+    "code": "provider_unavailable",
+    "message": "indisponivel"
+  }
+}
diff --git a/packages/contracts/exemplos/date-time.json b/packages/contracts/exemplos/date-time.json
new file mode 100644
index 0000000..6fd8a8c
--- /dev/null
+++ b/packages/contracts/exemplos/date-time.json
@@ -0,0 +1,98 @@
+[
+ {
+  "valor": "2026-10-25T12:00:00Z",
+  "valido": true
+ },
+ {
+  "valor": "2026-10-25T12:00:00.123456Z",
+  "valido": true
+ },
+ {
+  "valor": "2026-10-25T12:00:00-03:00",
+  "valido": true
+ },
+ {
+  "valor": "2028-02-29T00:00:00Z",
+  "valido": true
+ },
+ {
+  "valor": "2000-02-29T00:00:00Z",
+  "valido": true
+ },
+ {
+  "valor": "2026-10-25t12:00:00z",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25 12:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00+0300",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00+03",
+  "valido": false
+ },
+ {
+  "valor": "2026-12-31T23:59:60Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T24:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:60:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-02-29T12:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "1900-02-29T12:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-13-01T00:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-00-10T00:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-04-31T00:00:00Z",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00+24:00",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00Z\n",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25T12:00:00.Z",
+  "valido": false
+ },
+ {
+  "valor": "",
+  "valido": false
+ },
+ {
+  "valor": "2026-10-25",
+  "valido": false
+ },
+ {
+  "valor": "٢٠٢٦-10-25T12:00:00Z",
+  "valido": false
+ }
+]
\ No newline at end of file
diff --git a/packages/contracts/exemplos/handshake/enrollment_request/invalidos/01-segredo-curto.json b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/01-segredo-curto.json
new file mode 100644
index 0000000..09cf444
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/01-segredo-curto.json
@@ -0,0 +1,12 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "enrollment_secret": "curto",
+  "runtime_public_key": {
+    "kty": "OKP",
+    "crv": "Ed25519",
+    "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+    "kid": "rt-key-1",
+    "use": "sig",
+    "alg": "EdDSA"
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_request/invalidos/02-sem-chave.json b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/02-sem-chave.json
new file mode 100644
index 0000000..2339f9f
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/02-sem-chave.json
@@ -0,0 +1,4 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "enrollment_secret": "ssssssssssssssssssssssssssssssssssssssss"
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_request/invalidos/03-tenant-invalido.json b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/03-tenant-invalido.json
new file mode 100644
index 0000000..744fb97
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_request/invalidos/03-tenant-invalido.json
@@ -0,0 +1,12 @@
+{
+  "tenant_id": "x",
+  "enrollment_secret": "ssssssssssssssssssssssssssssssssssssssss",
+  "runtime_public_key": {
+    "kty": "OKP",
+    "crv": "Ed25519",
+    "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+    "kid": "rt-key-1",
+    "use": "sig",
+    "alg": "EdDSA"
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_request/validos/01-base.json b/packages/contracts/exemplos/handshake/enrollment_request/validos/01-base.json
new file mode 100644
index 0000000..1bd9d9f
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_request/validos/01-base.json
@@ -0,0 +1,12 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "enrollment_secret": "ssssssssssssssssssssssssssssssssssssssss",
+  "runtime_public_key": {
+    "kty": "OKP",
+    "crv": "Ed25519",
+    "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+    "kid": "rt-key-1",
+    "use": "sig",
+    "alg": "EdDSA"
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_response/invalidos/01-ver-zero.json b/packages/contracts/exemplos/handshake/enrollment_response/invalidos/01-ver-zero.json
new file mode 100644
index 0000000..8dd1683
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_response/invalidos/01-ver-zero.json
@@ -0,0 +1,5 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "ver": 0,
+  "runtime_kid": "rt-key-1"
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_response/invalidos/02-sem-kid.json b/packages/contracts/exemplos/handshake/enrollment_response/invalidos/02-sem-kid.json
new file mode 100644
index 0000000..ba7914a
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_response/invalidos/02-sem-kid.json
@@ -0,0 +1,4 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "ver": 1
+}
diff --git a/packages/contracts/exemplos/handshake/enrollment_response/validos/01-base.json b/packages/contracts/exemplos/handshake/enrollment_response/validos/01-base.json
new file mode 100644
index 0000000..d30aebf
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/enrollment_response/validos/01-base.json
@@ -0,0 +1,5 @@
+{
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "ver": 1,
+  "runtime_kid": "rt-key-1"
+}
diff --git a/packages/contracts/exemplos/handshake/jwk_publica/invalidos/01-kty-rsa.json b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/01-kty-rsa.json
new file mode 100644
index 0000000..6fe9a01
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/01-kty-rsa.json
@@ -0,0 +1,8 @@
+{
+  "kty": "RSA",
+  "crv": "Ed25519",
+  "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+  "kid": "rt-key-1",
+  "use": "sig",
+  "alg": "EdDSA"
+}
diff --git a/packages/contracts/exemplos/handshake/jwk_publica/invalidos/02-chave-privada-d.json b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/02-chave-privada-d.json
new file mode 100644
index 0000000..84251a5
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/02-chave-privada-d.json
@@ -0,0 +1,9 @@
+{
+  "kty": "OKP",
+  "crv": "Ed25519",
+  "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+  "kid": "rt-key-1",
+  "use": "sig",
+  "alg": "EdDSA",
+  "d": "segredo"
+}
diff --git a/packages/contracts/exemplos/handshake/jwk_publica/invalidos/03-x-com-padding.json b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/03-x-com-padding.json
new file mode 100644
index 0000000..35cc1aa
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/03-x-com-padding.json
@@ -0,0 +1,8 @@
+{
+  "kty": "OKP",
+  "crv": "Ed25519",
+  "x": "abc=",
+  "kid": "rt-key-1",
+  "use": "sig",
+  "alg": "EdDSA"
+}
diff --git a/packages/contracts/exemplos/handshake/jwk_publica/invalidos/04-use-enc.json b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/04-use-enc.json
new file mode 100644
index 0000000..ef0fbf7
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwk_publica/invalidos/04-use-enc.json
@@ -0,0 +1,8 @@
+{
+  "kty": "OKP",
+  "crv": "Ed25519",
+  "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+  "kid": "rt-key-1",
+  "use": "enc",
+  "alg": "EdDSA"
+}
diff --git a/packages/contracts/exemplos/handshake/jwk_publica/validos/01-base.json b/packages/contracts/exemplos/handshake/jwk_publica/validos/01-base.json
new file mode 100644
index 0000000..e811b4f
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwk_publica/validos/01-base.json
@@ -0,0 +1,8 @@
+{
+  "kty": "OKP",
+  "crv": "Ed25519",
+  "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+  "kid": "rt-key-1",
+  "use": "sig",
+  "alg": "EdDSA"
+}
diff --git a/packages/contracts/exemplos/handshake/jwks/invalidos/01-keys-vazio.json b/packages/contracts/exemplos/handshake/jwks/invalidos/01-keys-vazio.json
new file mode 100644
index 0000000..faf87ec
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/invalidos/01-keys-vazio.json
@@ -0,0 +1,3 @@
+{
+  "keys": []
+}
diff --git a/packages/contracts/exemplos/handshake/jwks/invalidos/02-quatro-chaves.json b/packages/contracts/exemplos/handshake/jwks/invalidos/02-quatro-chaves.json
new file mode 100644
index 0000000..0477e5b
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/invalidos/02-quatro-chaves.json
@@ -0,0 +1,36 @@
+{
+  "keys": [
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    },
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    },
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    },
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/jwks/invalidos/03-keys-null.json b/packages/contracts/exemplos/handshake/jwks/invalidos/03-keys-null.json
new file mode 100644
index 0000000..942dd2a
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/invalidos/03-keys-null.json
@@ -0,0 +1,3 @@
+{
+  "keys": null
+}
diff --git a/packages/contracts/exemplos/handshake/jwks/invalidos/04-sem-keys.json b/packages/contracts/exemplos/handshake/jwks/invalidos/04-sem-keys.json
new file mode 100644
index 0000000..0967ef4
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/invalidos/04-sem-keys.json
@@ -0,0 +1 @@
+{}
diff --git a/packages/contracts/exemplos/handshake/jwks/validos/01-base.json b/packages/contracts/exemplos/handshake/jwks/validos/01-base.json
new file mode 100644
index 0000000..40e9bc6
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/validos/01-base.json
@@ -0,0 +1,12 @@
+{
+  "keys": [
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/jwks/validos/02-tres-chaves.json b/packages/contracts/exemplos/handshake/jwks/validos/02-tres-chaves.json
new file mode 100644
index 0000000..17abc81
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/jwks/validos/02-tres-chaves.json
@@ -0,0 +1,28 @@
+{
+  "keys": [
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    },
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    },
+    {
+      "kty": "OKP",
+      "crv": "Ed25519",
+      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
+      "kid": "rt-key-1",
+      "use": "sig",
+      "alg": "EdDSA"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/invalidos/01-min-ver-null.json b/packages/contracts/exemplos/handshake/revocation_state/invalidos/01-min-ver-null.json
new file mode 100644
index 0000000..5e1fa38
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/invalidos/01-min-ver-null.json
@@ -0,0 +1,4 @@
+{
+  "generated_at": 1790000000,
+  "min_ver": null
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/invalidos/02-sem-min-ver.json b/packages/contracts/exemplos/handshake/revocation_state/invalidos/02-sem-min-ver.json
new file mode 100644
index 0000000..552bdcc
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/invalidos/02-sem-min-ver.json
@@ -0,0 +1,3 @@
+{
+  "generated_at": 1790000000
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/invalidos/03-chave-nao-uuid.json b/packages/contracts/exemplos/handshake/revocation_state/invalidos/03-chave-nao-uuid.json
new file mode 100644
index 0000000..9cb4701
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/invalidos/03-chave-nao-uuid.json
@@ -0,0 +1,6 @@
+{
+  "generated_at": 1790000000,
+  "min_ver": {
+    "abc": 1
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/invalidos/04-versao-zero.json b/packages/contracts/exemplos/handshake/revocation_state/invalidos/04-versao-zero.json
new file mode 100644
index 0000000..7e6a4f2
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/invalidos/04-versao-zero.json
@@ -0,0 +1,6 @@
+{
+  "generated_at": 1790000000,
+  "min_ver": {
+    "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15": 0
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/validos/01-base.json b/packages/contracts/exemplos/handshake/revocation_state/validos/01-base.json
new file mode 100644
index 0000000..ebe24f9
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/validos/01-base.json
@@ -0,0 +1,6 @@
+{
+  "generated_at": 1790000000,
+  "min_ver": {
+    "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15": 2
+  }
+}
diff --git a/packages/contracts/exemplos/handshake/revocation_state/validos/02-com-jti-revogado.json b/packages/contracts/exemplos/handshake/revocation_state/validos/02-com-jti-revogado.json
new file mode 100644
index 0000000..6a88233
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/revocation_state/validos/02-com-jti-revogado.json
@@ -0,0 +1,9 @@
+{
+  "generated_at": 1790000000,
+  "min_ver": {
+    "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15": 2
+  },
+  "revoked_jti": [
+    "jti_x"
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/token_request/invalidos/01-audiencia-desconhecida.json b/packages/contracts/exemplos/handshake/token_request/invalidos/01-audiencia-desconhecida.json
new file mode 100644
index 0000000..fe075f6
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_request/invalidos/01-audiencia-desconhecida.json
@@ -0,0 +1,7 @@
+{
+  "client_assertion": "aaa.bbb.ccc",
+  "audience": "admin",
+  "scope": [
+    "ai:complete"
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/token_request/invalidos/02-scope-vazio.json b/packages/contracts/exemplos/handshake/token_request/invalidos/02-scope-vazio.json
new file mode 100644
index 0000000..e31d7f6
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_request/invalidos/02-scope-vazio.json
@@ -0,0 +1,5 @@
+{
+  "client_assertion": "aaa.bbb.ccc",
+  "audience": "ai-gateway",
+  "scope": []
+}
diff --git a/packages/contracts/exemplos/handshake/token_request/invalidos/03-campo-extra.json b/packages/contracts/exemplos/handshake/token_request/invalidos/03-campo-extra.json
new file mode 100644
index 0000000..f76c24f
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_request/invalidos/03-campo-extra.json
@@ -0,0 +1,8 @@
+{
+  "client_assertion": "aaa.bbb.ccc",
+  "audience": "ai-gateway",
+  "scope": [
+    "ai:complete"
+  ],
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15"
+}
diff --git a/packages/contracts/exemplos/handshake/token_request/validos/01-base.json b/packages/contracts/exemplos/handshake/token_request/validos/01-base.json
new file mode 100644
index 0000000..72d68e4
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_request/validos/01-base.json
@@ -0,0 +1,7 @@
+{
+  "client_assertion": "aaa.bbb.ccc",
+  "audience": "ai-gateway",
+  "scope": [
+    "ai:complete"
+  ]
+}
diff --git a/packages/contracts/exemplos/handshake/token_response/invalidos/01-expira-em-601.json b/packages/contracts/exemplos/handshake/token_response/invalidos/01-expira-em-601.json
new file mode 100644
index 0000000..a141e93
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_response/invalidos/01-expira-em-601.json
@@ -0,0 +1,5 @@
+{
+  "access_token": "aaa.bbb.ccc",
+  "token_type": "Bearer",
+  "expires_in": 601
+}
diff --git a/packages/contracts/exemplos/handshake/token_response/invalidos/02-tipo-basic.json b/packages/contracts/exemplos/handshake/token_response/invalidos/02-tipo-basic.json
new file mode 100644
index 0000000..80a6c26
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_response/invalidos/02-tipo-basic.json
@@ -0,0 +1,5 @@
+{
+  "access_token": "aaa.bbb.ccc",
+  "token_type": "Basic",
+  "expires_in": 300
+}
diff --git a/packages/contracts/exemplos/handshake/token_response/invalidos/03-expira-em-zero.json b/packages/contracts/exemplos/handshake/token_response/invalidos/03-expira-em-zero.json
new file mode 100644
index 0000000..276f013
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_response/invalidos/03-expira-em-zero.json
@@ -0,0 +1,5 @@
+{
+  "access_token": "aaa.bbb.ccc",
+  "token_type": "Bearer",
+  "expires_in": 0
+}
diff --git a/packages/contracts/exemplos/handshake/token_response/validos/01-base.json b/packages/contracts/exemplos/handshake/token_response/validos/01-base.json
new file mode 100644
index 0000000..573aa3d
--- /dev/null
+++ b/packages/contracts/exemplos/handshake/token_response/validos/01-base.json
@@ -0,0 +1,5 @@
+{
+  "access_token": "aaa.bbb.ccc",
+  "token_type": "Bearer",
+  "expires_in": 300
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/01-sem-tenant-id.json b/packages/contracts/exemplos/job-envelope/invalidos/01-sem-tenant-id.json
new file mode 100644
index 0000000..0b99132
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/01-sem-tenant-id.json
@@ -0,0 +1,15 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/02-tenant-id-maiusculo.json b/packages/contracts/exemplos/job-envelope/invalidos/02-tenant-id-maiusculo.json
new file mode 100644
index 0000000..effe6b1
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/02-tenant-id-maiusculo.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3F2B8C1E-5A7D-4E90-9B61-0C4D2E8F7A15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/03-versao-2-0.json b/packages/contracts/exemplos/job-envelope/invalidos/03-versao-2-0.json
new file mode 100644
index 0000000..a39f0b0
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/03-versao-2-0.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "2.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/04-attempt-zero.json b/packages/contracts/exemplos/job-envelope/invalidos/04-attempt-zero.json
new file mode 100644
index 0000000..c194b84
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/04-attempt-zero.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 0,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/05-campo-extra.json b/packages/contracts/exemplos/job-envelope/invalidos/05-campo-extra.json
new file mode 100644
index 0000000..74e3d09
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/05-campo-extra.json
@@ -0,0 +1,17 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  },
+  "assinatura_extra": "x"
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/06-assinatura-hs256.json b/packages/contracts/exemplos/job-envelope/invalidos/06-assinatura-hs256.json
new file mode 100644
index 0000000..57399ec
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/06-assinatura-hs256.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "HS256",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/07-idempotency-key-vazia.json b/packages/contracts/exemplos/job-envelope/invalidos/07-idempotency-key-vazia.json
new file mode 100644
index 0000000..3585556
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/07-idempotency-key-vazia.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/08-data-invalida.json b/packages/contracts/exemplos/job-envelope/invalidos/08-data-invalida.json
new file mode 100644
index 0000000..4069ee1
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/08-data-invalida.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-02-30T12:00:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/09-type-maiusculo.json b/packages/contracts/exemplos/job-envelope/invalidos/09-type-maiusculo.json
new file mode 100644
index 0000000..e469829
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/09-type-maiusculo.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "Agent.Run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/10-payload-array.json b/packages/contracts/exemplos/job-envelope/invalidos/10-payload-array.json
new file mode 100644
index 0000000..06a2416
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/10-payload-array.json
@@ -0,0 +1,19 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  },
+  "payload": [
+    1
+  ]
+}
diff --git a/packages/contracts/exemplos/job-envelope/invalidos/11-quebra-de-linha-final.json b/packages/contracts/exemplos/job-envelope/invalidos/11-quebra-de-linha-final.json
new file mode 100644
index 0000000..25a538b
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/invalidos/11-quebra-de-linha-final.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run\n",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/validos/01-base.json b/packages/contracts/exemplos/job-envelope/validos/01-base.json
new file mode 100644
index 0000000..8ddcb0f
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/validos/01-base.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  }
+}
diff --git a/packages/contracts/exemplos/job-envelope/validos/02-com-payload.json b/packages/contracts/exemplos/job-envelope/validos/02-com-payload.json
new file mode 100644
index 0000000..4e9c59d
--- /dev/null
+++ b/packages/contracts/exemplos/job-envelope/validos/02-com-payload.json
@@ -0,0 +1,19 @@
+{
+  "schema_version": "1.0",
+  "job_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "type": "agent.run",
+  "idempotency_key": "run-0001:step-1",
+  "attempt": 1,
+  "issued_at": "2026-10-26T12:00:00Z",
+  "expires_at": "2026-10-26T12:05:00Z",
+  "correlation_id": "corr-0123456789",
+  "assignment_signature": {
+    "kid": "cp-key-1",
+    "alg": "EdDSA",
+    "value": "c2lnbmF0dXJlLWV4YW1wbGU"
+  },
+  "payload": {
+    "agent_id": "ag-1"
+  }
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/01-status-200.json b/packages/contracts/exemplos/problem-details/invalidos/01-status-200.json
new file mode 100644
index 0000000..4055e1e
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/01-status-200.json
@@ -0,0 +1,5 @@
+{
+  "type": "about:blank",
+  "title": "Nao autorizado",
+  "status": 200
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/02-sem-title.json b/packages/contracts/exemplos/problem-details/invalidos/02-sem-title.json
new file mode 100644
index 0000000..150e95b
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/02-sem-title.json
@@ -0,0 +1,4 @@
+{
+  "type": "about:blank",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/03-stack-trace.json b/packages/contracts/exemplos/problem-details/invalidos/03-stack-trace.json
new file mode 100644
index 0000000..da69508
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/03-stack-trace.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "Nao autorizado",
+  "status": 401,
+  "stack": "at x"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/04-instance-com-espaco.json b/packages/contracts/exemplos/problem-details/invalidos/04-instance-com-espaco.json
new file mode 100644
index 0000000..c4044f6
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/04-instance-com-espaco.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "Nao autorizado",
+  "status": 401,
+  "instance": "a b"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/05-code-maiusculo.json b/packages/contracts/exemplos/problem-details/invalidos/05-code-maiusculo.json
new file mode 100644
index 0000000..5f4047d
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/05-code-maiusculo.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "Nao autorizado",
+  "status": 401,
+  "code": "ERRO"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/06-type-vazio.json b/packages/contracts/exemplos/problem-details/invalidos/06-type-vazio.json
new file mode 100644
index 0000000..29c51cc
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/06-type-vazio.json
@@ -0,0 +1,5 @@
+{
+  "type": "",
+  "title": "Nao autorizado",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/07-type-com-u0085.json b/packages/contracts/exemplos/problem-details/invalidos/07-type-com-u0085.json
new file mode 100644
index 0000000..5bdbbc9
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/07-type-com-u0085.json
@@ -0,0 +1,5 @@
+{
+  "type": "x:a\u0085b",
+  "title": "x",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/08-type-com-u001c.json b/packages/contracts/exemplos/problem-details/invalidos/08-type-com-u001c.json
new file mode 100644
index 0000000..9a68f1a
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/08-type-com-u001c.json
@@ -0,0 +1,5 @@
+{
+  "type": "x:a\u001cb",
+  "title": "x",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/09-type-com-feff.json b/packages/contracts/exemplos/problem-details/invalidos/09-type-com-feff.json
new file mode 100644
index 0000000..669b256
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/09-type-com-feff.json
@@ -0,0 +1,5 @@
+{
+  "type": "x:a\ufeffb",
+  "title": "x",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/10-instance-com-u0085.json b/packages/contracts/exemplos/problem-details/invalidos/10-instance-com-u0085.json
new file mode 100644
index 0000000..ff31612
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/10-instance-com-u0085.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "x",
+  "status": 401,
+  "instance": "/a\u0085b"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/11-instance-com-u001c.json b/packages/contracts/exemplos/problem-details/invalidos/11-instance-com-u001c.json
new file mode 100644
index 0000000..99f5b9b
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/11-instance-com-u001c.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "x",
+  "status": 401,
+  "instance": "/a\u001cb"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/12-instance-com-feff.json b/packages/contracts/exemplos/problem-details/invalidos/12-instance-com-feff.json
new file mode 100644
index 0000000..1b9728e
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/12-instance-com-feff.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "x",
+  "status": 401,
+  "instance": "/a\ufeffb"
+}
diff --git a/packages/contracts/exemplos/problem-details/invalidos/13-instance-nao-ascii.json b/packages/contracts/exemplos/problem-details/invalidos/13-instance-nao-ascii.json
new file mode 100644
index 0000000..ad72f22
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/invalidos/13-instance-nao-ascii.json
@@ -0,0 +1,6 @@
+{
+  "type": "about:blank",
+  "title": "x",
+  "status": 401,
+  "instance": "/a\u00e9"
+}
diff --git a/packages/contracts/exemplos/problem-details/validos/01-base.json b/packages/contracts/exemplos/problem-details/validos/01-base.json
new file mode 100644
index 0000000..b33ffdb
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/validos/01-base.json
@@ -0,0 +1,5 @@
+{
+  "type": "about:blank",
+  "title": "Nao autorizado",
+  "status": 401
+}
diff --git a/packages/contracts/exemplos/problem-details/validos/02-completo.json b/packages/contracts/exemplos/problem-details/validos/02-completo.json
new file mode 100644
index 0000000..f711a27
--- /dev/null
+++ b/packages/contracts/exemplos/problem-details/validos/02-completo.json
@@ -0,0 +1,15 @@
+{
+  "type": "https://nucleos.invalid/problemas/validacao",
+  "title": "Dados invalidos",
+  "status": 422,
+  "detail": "campo x invalido",
+  "instance": "/v1/agents/1",
+  "code": "validation_error",
+  "correlation_id": "corr-0123456789",
+  "errors": [
+    {
+      "pointer": "/x",
+      "detail": "obrigatorio"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/01-tipo-desconhecido.json b/packages/contracts/exemplos/realtime-event/invalidos/01-tipo-desconhecido.json
new file mode 100644
index 0000000..d0c14a6
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/01-tipo-desconhecido.json
@@ -0,0 +1,17 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.exploded",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "step": 3,
+    "final": false,
+    "label": "buscando"
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/02-data-aninhado.json b/packages/contracts/exemplos/realtime-event/invalidos/02-data-aninhado.json
new file mode 100644
index 0000000..ecac405
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/02-data-aninhado.json
@@ -0,0 +1,17 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "a": {
+      "b": 1
+    }
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/03-data-chave-maiuscula.json b/packages/contracts/exemplos/realtime-event/invalidos/03-data-chave-maiuscula.json
new file mode 100644
index 0000000..40e9c0b
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/03-data-chave-maiuscula.json
@@ -0,0 +1,15 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "Step": 1
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/04-sem-tenant-id.json b/packages/contracts/exemplos/realtime-event/invalidos/04-sem-tenant-id.json
new file mode 100644
index 0000000..dffb89c
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/04-sem-tenant-id.json
@@ -0,0 +1,16 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "step": 3,
+    "final": false,
+    "label": "buscando"
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/05-data-float.json b/packages/contracts/exemplos/realtime-event/invalidos/05-data-float.json
new file mode 100644
index 0000000..36628a7
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/05-data-float.json
@@ -0,0 +1,15 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "pct": 1.5
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/06-subject-kind-invalido.json b/packages/contracts/exemplos/realtime-event/invalidos/06-subject-kind-invalido.json
new file mode 100644
index 0000000..862d078
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/06-subject-kind-invalido.json
@@ -0,0 +1,17 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "user",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "step": 3,
+    "final": false,
+    "label": "buscando"
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/invalidos/07-data-texto-livre-longo.json b/packages/contracts/exemplos/realtime-event/invalidos/07-data-texto-livre-longo.json
new file mode 100644
index 0000000..f6e4ee5
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/invalidos/07-data-texto-livre-longo.json
@@ -0,0 +1,15 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "msg": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/validos/01-base.json b/packages/contracts/exemplos/realtime-event/validos/01-base.json
new file mode 100644
index 0000000..fcfc7b0
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/validos/01-base.json
@@ -0,0 +1,17 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  },
+  "state": "running",
+  "data": {
+    "step": 3,
+    "final": false,
+    "label": "buscando"
+  }
+}
diff --git a/packages/contracts/exemplos/realtime-event/validos/02-sem-state-e-data.json b/packages/contracts/exemplos/realtime-event/validos/02-sem-state-e-data.json
new file mode 100644
index 0000000..0beb629
--- /dev/null
+++ b/packages/contracts/exemplos/realtime-event/validos/02-sem-state-e-data.json
@@ -0,0 +1,11 @@
+{
+  "schema_version": "1.0",
+  "event_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "type": "run.progress",
+  "occurred_at": "2026-10-26T12:00:00Z",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "subject": {
+    "kind": "run",
+    "id": "run_42"
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/01-alg-none.json b/packages/contracts/exemplos/runtime-token/invalidos/01-alg-none.json
new file mode 100644
index 0000000..80a6110
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/01-alg-none.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "none",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/02-alg-hs256.json b/packages/contracts/exemplos/runtime-token/invalidos/02-alg-hs256.json
new file mode 100644
index 0000000..71ac808
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/02-alg-hs256.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "HS256",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/03-typ-errado.json b/packages/contracts/exemplos/runtime-token/invalidos/03-typ-errado.json
new file mode 100644
index 0000000..fb1ea8f
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/03-typ-errado.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "JWT",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/04-kid-com-espaco.json b/packages/contracts/exemplos/runtime-token/invalidos/04-kid-com-espaco.json
new file mode 100644
index 0000000..0e2759d
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/04-kid-com-espaco.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "a b"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/05-audiencia-array.json b/packages/contracts/exemplos/runtime-token/invalidos/05-audiencia-array.json
new file mode 100644
index 0000000..178831f
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/05-audiencia-array.json
@@ -0,0 +1,22 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": [
+      "tool-gateway"
+    ],
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/06-audiencia-desconhecida.json b/packages/contracts/exemplos/runtime-token/invalidos/06-audiencia-desconhecida.json
new file mode 100644
index 0000000..067e811
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/06-audiencia-desconhecida.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "outro",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/07-scope-vazio.json b/packages/contracts/exemplos/runtime-token/invalidos/07-scope-vazio.json
new file mode 100644
index 0000000..413550a
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/07-scope-vazio.json
@@ -0,0 +1,18 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/08-scope-duplicado.json b/packages/contracts/exemplos/runtime-token/invalidos/08-scope-duplicado.json
new file mode 100644
index 0000000..684a188
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/08-scope-duplicado.json
@@ -0,0 +1,21 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke",
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/09-scope-mal-formado.json b/packages/contracts/exemplos/runtime-token/invalidos/09-scope-mal-formado.json
new file mode 100644
index 0000000..5e36879
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/09-scope-mal-formado.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "Invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/10-claim-extra.json b/packages/contracts/exemplos/runtime-token/invalidos/10-claim-extra.json
new file mode 100644
index 0000000..bdf36cf
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/10-claim-extra.json
@@ -0,0 +1,21 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1,
+    "role": "admin"
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/11-sem-jti.json b/packages/contracts/exemplos/runtime-token/invalidos/11-sem-jti.json
new file mode 100644
index 0000000..584a25a
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/11-sem-jti.json
@@ -0,0 +1,19 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/12-jti-curto.json b/packages/contracts/exemplos/runtime-token/invalidos/12-jti-curto.json
new file mode 100644
index 0000000..4a2b115
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/12-jti-curto.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "abc",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/13-tenant-id-invalido.json b/packages/contracts/exemplos/runtime-token/invalidos/13-tenant-id-invalido.json
new file mode 100644
index 0000000..39862ed
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/13-tenant-id-invalido.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "nao-e-uuid",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/14-sub-sem-prefixo.json b/packages/contracts/exemplos/runtime-token/invalidos/14-sub-sem-prefixo.json
new file mode 100644
index 0000000..0d43bcb
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/14-sub-sem-prefixo.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/15-iss-errado.json b/packages/contracts/exemplos/runtime-token/invalidos/15-iss-errado.json
new file mode 100644
index 0000000..05b289a
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/15-iss-errado.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "outro",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/16-ver-zero.json b/packages/contracts/exemplos/runtime-token/invalidos/16-ver-zero.json
new file mode 100644
index 0000000..fa06f25
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/16-ver-zero.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 0
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/17-exp-negativo.json b/packages/contracts/exemplos/runtime-token/invalidos/17-exp-negativo.json
new file mode 100644
index 0000000..6e282dc
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/17-exp-negativo.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": -1,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/18-sem-header.json b/packages/contracts/exemplos/runtime-token/invalidos/18-sem-header.json
new file mode 100644
index 0000000..6920522
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/18-sem-header.json
@@ -0,0 +1,15 @@
+{
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/invalidos/19-iat-string.json b/packages/contracts/exemplos/runtime-token/invalidos/19-iat-string.json
new file mode 100644
index 0000000..2069bdb
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/invalidos/19-iat-string.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": "1790000000",
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/semantica.json b/packages/contracts/exemplos/runtime-token/semantica.json
new file mode 100644
index 0000000..7e597fe
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/semantica.json
@@ -0,0 +1,132 @@
+[
+  {
+    "nome": "valido",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000300,
+      "ver": 1
+    },
+    "erros": []
+  },
+  {
+    "nome": "ttl-no-limite-600",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000600,
+      "ver": 1
+    },
+    "erros": []
+  },
+  {
+    "nome": "sub-diverge-do-tenant",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:a1b2c3d4-0000-4000-8000-123456789abc",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000300,
+      "ver": 1
+    },
+    "erros": [
+      "sub_tenant_mismatch"
+    ]
+  },
+  {
+    "nome": "ttl-acima-de-600",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000601,
+      "ver": 1
+    },
+    "erros": [
+      "ttl_too_long"
+    ]
+  },
+  {
+    "nome": "exp-igual-a-iat",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000000,
+      "ver": 1
+    },
+    "erros": [
+      "ttl_not_positive"
+    ]
+  },
+  {
+    "nome": "exp-antes-de-iat",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1789999995,
+      "ver": 1
+    },
+    "erros": [
+      "ttl_not_positive"
+    ]
+  },
+  {
+    "nome": "sub-diverge-e-ttl-longo",
+    "claims": {
+      "iss": "nucleos-control-plane",
+      "sub": "runtime:a1b2c3d4-0000-4000-8000-123456789abc",
+      "aud": "tool-gateway",
+      "scope": [
+        "tool:invoke"
+      ],
+      "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+      "jti": "jti_0123456789abcdef",
+      "iat": 1790000000,
+      "exp": 1790000900,
+      "ver": 1
+    },
+    "erros": [
+      "sub_tenant_mismatch",
+      "ttl_too_long"
+    ]
+  }
+]
diff --git a/packages/contracts/exemplos/runtime-token/validos/01-base.json b/packages/contracts/exemplos/runtime-token/validos/01-base.json
new file mode 100644
index 0000000..361f7b3
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/validos/01-base.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "tool-gateway",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/runtime-token/validos/02-audiencia-dispatcher.json b/packages/contracts/exemplos/runtime-token/validos/02-audiencia-dispatcher.json
new file mode 100644
index 0000000..e3b5f65
--- /dev/null
+++ b/packages/contracts/exemplos/runtime-token/validos/02-audiencia-dispatcher.json
@@ -0,0 +1,20 @@
+{
+  "header": {
+    "alg": "EdDSA",
+    "typ": "nucleos-runtime+jwt",
+    "kid": "cp-key-1"
+  },
+  "claims": {
+    "iss": "nucleos-control-plane",
+    "sub": "runtime:3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "aud": "dispatcher",
+    "scope": [
+      "tool:invoke"
+    ],
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+    "jti": "jti_0123456789abcdef",
+    "iat": 1790000000,
+    "exp": 1790000300,
+    "ver": 1
+  }
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/01-sem-event-id.json b/packages/contracts/exemplos/subscription-event/invalidos/01-sem-event-id.json
new file mode 100644
index 0000000..dc4214e
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/01-sem-event-id.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"event_type":"subscription.activated","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/02-tipo-desconhecido.json b/packages/contracts/exemplos/subscription-event/invalidos/02-tipo-desconhecido.json
new file mode 100644
index 0000000..7474fce
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/02-tipo-desconhecido.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"e2","event_type":"tenant.delete","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/03-campo-extra-dados-de-cartao.json b/packages/contracts/exemplos/subscription-event/invalidos/03-campo-extra-dados-de-cartao.json
new file mode 100644
index 0000000..51ac471
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/03-campo-extra-dados-de-cartao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e3","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":100,"currency":"BRL","card_number":"0000"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/04-falha-sem-codigo-nem-tentativa.json b/packages/contracts/exemplos/subscription-event/invalidos/04-falha-sem-codigo-nem-tentativa.json
new file mode 100644
index 0000000..4389288
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/04-falha-sem-codigo-nem-tentativa.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e4","event_type":"payment.failed","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":100,"currency":"BRL"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/05-pagamento-sem-bloco-payment.json b/packages/contracts/exemplos/subscription-event/invalidos/05-pagamento-sem-bloco-payment.json
new file mode 100644
index 0000000..0cc57a0
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/05-pagamento-sem-bloco-payment.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e5","event_type":"payment.refunded","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/06-simulador-com-simulated-false.json b/packages/contracts/exemplos/subscription-event/invalidos/06-simulador-com-simulated-false.json
new file mode 100644
index 0000000..a599482
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/06-simulador-com-simulated-false.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":false,"provider_event_id":"e6","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/07-provedor-real-com-simulated-true.json b/packages/contracts/exemplos/subscription-event/invalidos/07-provedor-real-com-simulated-true.json
new file mode 100644
index 0000000..99a30b8
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/07-provedor-real-com-simulated-true.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":true,"provider_event_id":"e7","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/08-moeda-e-valor-invalidos.json b/packages/contracts/exemplos/subscription-event/invalidos/08-moeda-e-valor-invalidos.json
new file mode 100644
index 0000000..a8bf397
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/08-moeda-e-valor-invalidos.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"e8","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"s1"},"payment":{"amount_minor":-5,"currency":"brl"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/09-plan-changed-sem-plano.json b/packages/contracts/exemplos/subscription-event/invalidos/09-plan-changed-sem-plano.json
new file mode 100644
index 0000000..8d2ba71
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/09-plan-changed-sem-plano.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"asaas","simulated":false,"provider_event_id":"e9","event_type":"subscription.plan_changed","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/10-id-com-caracteres-invalidos.json b/packages/contracts/exemplos/subscription-event/invalidos/10-id-com-caracteres-invalidos.json
new file mode 100644
index 0000000..a1ff044
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/10-id-com-caracteres-invalidos.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"a b/../c","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/11-data-invalida.json b/packages/contracts/exemplos/subscription-event/invalidos/11-data-invalida.json
new file mode 100644
index 0000000..0fcff0c
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/11-data-invalida.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"ontem","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"e11","event_type":"subscription.created","subscription":{"provider_subscription_id":"s1"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/12-failure-code-vazio.json b/packages/contracts/exemplos/subscription-event/invalidos/12-failure-code-vazio.json
new file mode 100644
index 0000000..7e15da4
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/12-failure-code-vazio.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"evt_example_0003","event_type":"payment.failed","subscription":{"provider_subscription_id":"sub_example_1","provider_status":"past_due"},"payment":{"provider_invoice_id":"in_example_2","amount_minor":9900,"currency":"BRL","failure_code":"","attempt_count":1,"next_retry_at":"2026-10-28T12:00:00Z"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/13-quebra-de-linha-final-em-campos-com-pattern.json b/packages/contracts/exemplos/subscription-event/invalidos/13-quebra-de-linha-final-em-campos-com-pattern.json
new file mode 100644
index 0000000..a830906
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/13-quebra-de-linha-final-em-campos-com-pattern.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"abc\n","event_type":"payment.failed","subscription":{"provider_subscription_id":"sub_example_1","provider_status":"past_due","plan_code":"a\n"},"payment":{"provider_invoice_id":"in_example_2","amount_minor":9900,"currency":"USD\n","failure_code":"card_declined","attempt_count":1,"next_retry_at":"2026-10-28T12:00:00Z"}}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/14-data-hora-minuscula.json b/packages/contracts/exemplos/subscription-event/invalidos/14-data-hora-minuscula.json
new file mode 100644
index 0000000..7eb3a8c
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/14-data-hora-minuscula.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25t12:00:00z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/15-fuso-sem-dois-pontos.json b/packages/contracts/exemplos/subscription-event/invalidos/15-fuso-sem-dois-pontos.json
new file mode 100644
index 0000000..220d2f9
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/15-fuso-sem-dois-pontos.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25T12:00:00+0300",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/16-segundo-bissexto.json b/packages/contracts/exemplos/subscription-event/invalidos/16-segundo-bissexto.json
new file mode 100644
index 0000000..75bf5f7
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/16-segundo-bissexto.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-12-31T23:59:60Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/17-dia-inexistente.json b/packages/contracts/exemplos/subscription-event/invalidos/17-dia-inexistente.json
new file mode 100644
index 0000000..4efb3b9
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/17-dia-inexistente.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-02-29T12:00:00Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/18-hora-24.json b/packages/contracts/exemplos/subscription-event/invalidos/18-hora-24.json
new file mode 100644
index 0000000..7c2b1a0
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/18-hora-24.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25T24:00:00Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/19-tenant-id-maiusculo.json b/packages/contracts/exemplos/subscription-event/invalidos/19-tenant-id-maiusculo.json
new file mode 100644
index 0000000..ac88fe5
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/19-tenant-id-maiusculo.json
@@ -0,0 +1,21 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25T12:00:00Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z",
+    "tenant_id": "3F2B8C1E-5A7D-4E90-9B61-0C4D2E8F7A15"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/20-sem-fuso.json b/packages/contracts/exemplos/subscription-event/invalidos/20-sem-fuso.json
new file mode 100644
index 0000000..ed93f72
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/20-sem-fuso.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25T12:00:00",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/invalidos/21-separador-espaco.json b/packages/contracts/exemplos/subscription-event/invalidos/21-separador-espaco.json
new file mode 100644
index 0000000..c3c5262
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/invalidos/21-separador-espaco.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25 12:00:00Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/validos/01-simulador-ativacao.json b/packages/contracts/exemplos/subscription-event/validos/01-simulador-ativacao.json
new file mode 100644
index 0000000..9bf4627
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/01-simulador-ativacao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0001","event_type":"subscription.activated","subscription":{"provider_subscription_id":"sim_sub_001","plan_code":"starter","provider_status":"active"}}
diff --git a/packages/contracts/exemplos/subscription-event/validos/02-stripe-pagamento-ok.json b/packages/contracts/exemplos/subscription-event/validos/02-stripe-pagamento-ok.json
new file mode 100644
index 0000000..6865bba
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/02-stripe-pagamento-ok.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"evt_example_0002","event_type":"payment.succeeded","subscription":{"provider_subscription_id":"sub_example_1","provider_customer_id":"cus_example_1","current_period_end":"2026-11-25T12:00:00Z"},"payment":{"provider_invoice_id":"in_example_1","amount_minor":9900,"currency":"BRL"},"raw_payload_ref":"webhook-raw/stripe/evt_example_0002"}
diff --git a/packages/contracts/exemplos/subscription-event/validos/03-stripe-falha-pagamento.json b/packages/contracts/exemplos/subscription-event/validos/03-stripe-falha-pagamento.json
new file mode 100644
index 0000000..0e3089e
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/03-stripe-falha-pagamento.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"stripe","simulated":false,"provider_event_id":"evt_example_0003","event_type":"payment.failed","subscription":{"provider_subscription_id":"sub_example_1","provider_status":"past_due"},"payment":{"provider_invoice_id":"in_example_2","amount_minor":9900,"currency":"BRL","failure_code":"card_declined","attempt_count":1,"next_retry_at":"2026-10-28T12:00:00Z"}}
diff --git a/packages/contracts/exemplos/subscription-event/validos/04-simulador-suspensao.json b/packages/contracts/exemplos/subscription-event/validos/04-simulador-suspensao.json
new file mode 100644
index 0000000..42d0265
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/04-simulador-suspensao.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0004","event_type":"subscription.suspended_by_provider","subscription":{"provider_subscription_id":"sim_sub_001","tenant_id":"3f0c1a52-8d1e-4b7a-9c2e-5d6f7a8b9c0d"}}
diff --git a/packages/contracts/exemplos/subscription-event/validos/05-troca-de-plano.json b/packages/contracts/exemplos/subscription-event/validos/05-troca-de-plano.json
new file mode 100644
index 0000000..40a7e17
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/05-troca-de-plano.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"asaas","simulated":false,"provider_event_id":"evt_asaas_0005","event_type":"subscription.plan_changed","subscription":{"provider_subscription_id":"sub_asaas_1","plan_code":"business"}}
diff --git a/packages/contracts/exemplos/subscription-event/validos/06-cancelamento.json b/packages/contracts/exemplos/subscription-event/validos/06-cancelamento.json
new file mode 100644
index 0000000..9615d87
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/06-cancelamento.json
@@ -0,0 +1 @@
+{"schema_version":"1.0","received_at":"2026-10-25T12:00:05Z","occurred_at":"2026-10-25T12:00:00Z","provider":"simulator","simulated":true,"provider_event_id":"sim_evt_0006","event_type":"subscription.canceled","subscription":{"provider_subscription_id":"sim_sub_001"}}
diff --git a/packages/contracts/exemplos/subscription-event/validos/07-bissexto-valido-29-fev.json b/packages/contracts/exemplos/subscription-event/validos/07-bissexto-valido-29-fev.json
new file mode 100644
index 0000000..fe20482
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/07-bissexto-valido-29-fev.json
@@ -0,0 +1,20 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2028-02-29T12:00:00.123+03:30",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/subscription-event/validos/08-tenant-id-minusculo.json b/packages/contracts/exemplos/subscription-event/validos/08-tenant-id-minusculo.json
new file mode 100644
index 0000000..add48b9
--- /dev/null
+++ b/packages/contracts/exemplos/subscription-event/validos/08-tenant-id-minusculo.json
@@ -0,0 +1,21 @@
+{
+  "schema_version": "1.0",
+  "received_at": "2026-10-25T12:00:05Z",
+  "occurred_at": "2026-10-25T12:00:00Z",
+  "provider": "stripe",
+  "simulated": false,
+  "provider_event_id": "evt_example_0002",
+  "event_type": "payment.succeeded",
+  "subscription": {
+    "provider_subscription_id": "sub_example_1",
+    "provider_customer_id": "cus_example_1",
+    "current_period_end": "2026-11-25T12:00:00Z",
+    "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15"
+  },
+  "payment": {
+    "provider_invoice_id": "in_example_1",
+    "amount_minor": 9900,
+    "currency": "BRL"
+  },
+  "raw_payload_ref": "webhook-raw/stripe/evt_example_0002"
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/01-imagem-por-tag.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/01-imagem-por-tag.json
new file mode 100644
index 0000000..be168ca
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/01-imagem-por-tag.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime:latest",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/02-segredo-literal.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/02-segredo-literal.json
new file mode 100644
index 0000000..572ac82
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/02-segredo-literal.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "senha123"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/03-subnet-publica.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/03-subnet-publica.json
new file mode 100644
index 0000000..feab0e0
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/03-subnet-publica.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "8.8.8.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/04-mount-path-com-ponto-ponto.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/04-mount-path-com-ponto-ponto.json
new file mode 100644
index 0000000..da0fac6
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/04-mount-path-com-ponto-ponto.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/../etc"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/05-cpu-abaixo-do-minimo.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/05-cpu-abaixo-do-minimo.json
new file mode 100644
index 0000000..bb0aeaf
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/05-cpu-abaixo-do-minimo.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 50,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/06-modulos-duplicados.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/06-modulos-duplicados.json
new file mode 100644
index 0000000..469c206
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/06-modulos-duplicados.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "rag"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/07-campo-env.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/07-campo-env.json
new file mode 100644
index 0000000..dffcda4
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/07-campo-env.json
@@ -0,0 +1,47 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ],
+  "env": {
+    "X": "1"
+  }
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/invalidos/08-sem-limits.json b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/08-sem-limits.json
new file mode 100644
index 0000000..c9fe71b
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/invalidos/08-sem-limits.json
@@ -0,0 +1,40 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/validos/01-base.json b/packages/contracts/exemplos/tenant-runtime-spec/validos/01-base.json
new file mode 100644
index 0000000..3154fb5
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/validos/01-base.json
@@ -0,0 +1,44 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [
+    {
+      "name": "dados",
+      "mount_path": "/var/lib/tenant"
+    }
+  ],
+  "secrets": [
+    {
+      "name": "db-url",
+      "ref": "secretref:tenant/db-url"
+    }
+  ],
+  "modules": [
+    "rag",
+    "tools"
+  ],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tenant-runtime-spec/validos/02-sem-volumes-e-modulos.json b/packages/contracts/exemplos/tenant-runtime-spec/validos/02-sem-volumes-e-modulos.json
new file mode 100644
index 0000000..c4678c7
--- /dev/null
+++ b/packages/contracts/exemplos/tenant-runtime-spec/validos/02-sem-volumes-e-modulos.json
@@ -0,0 +1,31 @@
+{
+  "schema_version": "1.0",
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "images": {
+    "runtime": "registry.example.invalid/nucleos/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+    "sidecar": "registry.example.invalid/nucleos/sidecar@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
+  },
+  "resources": {
+    "cpu_millis": 1000,
+    "memory_mib": 1024,
+    "pids": 256,
+    "tmpfs_mib": 64
+  },
+  "network": {
+    "name": "tenant-net",
+    "subnet": "10.20.0.0/24"
+  },
+  "volumes": [],
+  "secrets": [],
+  "modules": [],
+  "limits": {
+    "max_concurrency": 4,
+    "budget_minor": 50000
+  },
+  "endpoints": [
+    {
+      "name": "dispatcher",
+      "url": "http://dispatcher.internal:8080/v1"
+    }
+  ]
+}
diff --git a/packages/contracts/exemplos/tool-call-request/invalidos/01-campo-tenant-id.json b/packages/contracts/exemplos/tool-call-request/invalidos/01-campo-tenant-id.json
new file mode 100644
index 0000000..8585382
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/invalidos/01-campo-tenant-id.json
@@ -0,0 +1,11 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 0,
+  "idempotency_key": "run-1:step-0",
+  "arguments": {
+    "query": "x"
+  },
+  "tenant_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15"
+}
diff --git a/packages/contracts/exemplos/tool-call-request/invalidos/02-arguments-array.json b/packages/contracts/exemplos/tool-call-request/invalidos/02-arguments-array.json
new file mode 100644
index 0000000..159464c
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/invalidos/02-arguments-array.json
@@ -0,0 +1,10 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 0,
+  "idempotency_key": "run-1:step-0",
+  "arguments": [
+    1
+  ]
+}
diff --git a/packages/contracts/exemplos/tool-call-request/invalidos/03-step-seq-negativo.json b/packages/contracts/exemplos/tool-call-request/invalidos/03-step-seq-negativo.json
new file mode 100644
index 0000000..73c64da
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/invalidos/03-step-seq-negativo.json
@@ -0,0 +1,10 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": -1,
+  "idempotency_key": "run-1:step-0",
+  "arguments": {
+    "query": "x"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-request/invalidos/04-sem-idempotency-key.json b/packages/contracts/exemplos/tool-call-request/invalidos/04-sem-idempotency-key.json
new file mode 100644
index 0000000..e859c78
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/invalidos/04-sem-idempotency-key.json
@@ -0,0 +1,9 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 0,
+  "arguments": {
+    "query": "x"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-request/invalidos/05-run-id-mal-formado.json b/packages/contracts/exemplos/tool-call-request/invalidos/05-run-id-mal-formado.json
new file mode 100644
index 0000000..803d8b8
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/invalidos/05-run-id-mal-formado.json
@@ -0,0 +1,10 @@
+{
+  "schema_version": "1.0",
+  "run_id": "123",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 0,
+  "idempotency_key": "run-1:step-0",
+  "arguments": {
+    "query": "x"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-request/validos/01-base.json b/packages/contracts/exemplos/tool-call-request/validos/01-base.json
new file mode 100644
index 0000000..7d98ce4
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-request/validos/01-base.json
@@ -0,0 +1,10 @@
+{
+  "schema_version": "1.0",
+  "run_id": "a1b2c3d4-0000-4000-8000-123456789abc",
+  "agent_id": "3f2b8c1e-5a7d-4e90-9b61-0c4d2e8f7a15",
+  "step_seq": 0,
+  "idempotency_key": "run-1:step-0",
+  "arguments": {
+    "query": "x"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/invalidos/01-ok-sem-result.json b/packages/contracts/exemplos/tool-call-response/invalidos/01-ok-sem-result.json
new file mode 100644
index 0000000..65351a9
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/invalidos/01-ok-sem-result.json
@@ -0,0 +1,4 @@
+{
+  "schema_version": "1.0",
+  "status": "ok"
+}
diff --git a/packages/contracts/exemplos/tool-call-response/invalidos/02-error-sem-error.json b/packages/contracts/exemplos/tool-call-response/invalidos/02-error-sem-error.json
new file mode 100644
index 0000000..92c60bb
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/invalidos/02-error-sem-error.json
@@ -0,0 +1,4 @@
+{
+  "schema_version": "1.0",
+  "status": "error"
+}
diff --git a/packages/contracts/exemplos/tool-call-response/invalidos/03-ok-com-error.json b/packages/contracts/exemplos/tool-call-response/invalidos/03-ok-com-error.json
new file mode 100644
index 0000000..adcb95e
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/invalidos/03-ok-com-error.json
@@ -0,0 +1,11 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "result": {
+    "linhas": 3
+  },
+  "error": {
+    "code": "e",
+    "message": "m"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/invalidos/04-status-desconhecido.json b/packages/contracts/exemplos/tool-call-response/invalidos/04-status-desconhecido.json
new file mode 100644
index 0000000..dcdb6d7
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/invalidos/04-status-desconhecido.json
@@ -0,0 +1,7 @@
+{
+  "schema_version": "1.0",
+  "status": "pending",
+  "result": {
+    "linhas": 3
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/invalidos/05-codigo-de-erro-maiusculo.json b/packages/contracts/exemplos/tool-call-response/invalidos/05-codigo-de-erro-maiusculo.json
new file mode 100644
index 0000000..6f73672
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/invalidos/05-codigo-de-erro-maiusculo.json
@@ -0,0 +1,8 @@
+{
+  "schema_version": "1.0",
+  "status": "error",
+  "error": {
+    "code": "ERRO",
+    "message": "m"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/validos/01-base.json b/packages/contracts/exemplos/tool-call-response/validos/01-base.json
new file mode 100644
index 0000000..f81936d
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/validos/01-base.json
@@ -0,0 +1,7 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "result": {
+    "linhas": 3
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/validos/02-erro.json b/packages/contracts/exemplos/tool-call-response/validos/02-erro.json
new file mode 100644
index 0000000..7406148
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/validos/02-erro.json
@@ -0,0 +1,8 @@
+{
+  "schema_version": "1.0",
+  "status": "error",
+  "error": {
+    "code": "tool_failed",
+    "message": "falhou"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/validos/03-negado.json b/packages/contracts/exemplos/tool-call-response/validos/03-negado.json
new file mode 100644
index 0000000..cfe20cc
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/validos/03-negado.json
@@ -0,0 +1,8 @@
+{
+  "schema_version": "1.0",
+  "status": "denied",
+  "error": {
+    "code": "tool_failed",
+    "message": "falhou"
+  }
+}
diff --git a/packages/contracts/exemplos/tool-call-response/validos/04-result-null.json b/packages/contracts/exemplos/tool-call-response/validos/04-result-null.json
new file mode 100644
index 0000000..d3e724a
--- /dev/null
+++ b/packages/contracts/exemplos/tool-call-response/validos/04-result-null.json
@@ -0,0 +1,5 @@
+{
+  "schema_version": "1.0",
+  "status": "ok",
+  "result": null
+}
diff --git a/packages/contracts/schemas/ai-completion-request.schema.json b/packages/contracts/schemas/ai-completion-request.schema.json
new file mode 100644
index 0000000..95832b2
--- /dev/null
+++ b/packages/contracts/schemas/ai-completion-request.schema.json
@@ -0,0 +1,90 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/ai-completion-request.schema.json",
+  "x-schema-version": "1.0",
+  "title": "AiCompletionRequest - pedido de completion ao AI Gateway",
+  "description": "Sem campo de tenant (derivado da identidade, EP-07). model_alias e um alias logico resolvido pelo gateway, nunca o identificador do provedor.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "run_id",
+    "agent_id",
+    "step_seq",
+    "idempotency_key",
+    "model_alias",
+    "messages"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "run_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "agent_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "step_seq": {
+      "type": "integer",
+      "minimum": 0
+    },
+    "idempotency_key": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 128,
+      "pattern": "^[A-Za-z0-9_.:-]+$"
+    },
+    "model_alias": {
+      "type": "string",
+      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
+    },
+    "messages": {
+      "type": "array",
+      "minItems": 1,
+      "maxItems": 512,
+      "items": {
+        "$ref": "#/$defs/message"
+      }
+    },
+    "max_output_tokens": {
+      "type": "integer",
+      "minimum": 1,
+      "maximum": 200000
+    },
+    "temperature": {
+      "type": "number",
+      "minimum": 0,
+      "maximum": 2
+    }
+  },
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    },
+    "message": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "role",
+        "content"
+      ],
+      "properties": {
+        "role": {
+          "enum": [
+            "system",
+            "user",
+            "assistant",
+            "tool"
+          ]
+        },
+        "content": {
+          "type": "string",
+          "maxLength": 200000
+        }
+      }
+    }
+  }
+}
diff --git a/packages/contracts/schemas/ai-completion-response.schema.json b/packages/contracts/schemas/ai-completion-response.schema.json
new file mode 100644
index 0000000..4240518
--- /dev/null
+++ b/packages/contracts/schemas/ai-completion-response.schema.json
@@ -0,0 +1,123 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/ai-completion-response.schema.json",
+  "x-schema-version": "1.0",
+  "title": "AiCompletionResponse - resposta de completion do AI Gateway",
+  "description": "status=ok exige content, finish_reason e usage; status=error exige error.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "status"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "status": {
+      "enum": [
+        "ok",
+        "error"
+      ]
+    },
+    "model_alias": {
+      "type": "string",
+      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
+    },
+    "content": {
+      "type": "string",
+      "maxLength": 200000
+    },
+    "finish_reason": {
+      "enum": [
+        "stop",
+        "length",
+        "tool_calls",
+        "content_filter"
+      ]
+    },
+    "usage": {
+      "$ref": "#/$defs/usage"
+    },
+    "error": {
+      "$ref": "#/$defs/error"
+    }
+  },
+  "$defs": {
+    "error": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "code",
+        "message"
+      ],
+      "properties": {
+        "code": {
+          "type": "string",
+          "pattern": "^[a-z][a-z0-9_]{0,63}$"
+        },
+        "message": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 1024
+        }
+      }
+    },
+    "usage": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "input_tokens",
+        "output_tokens",
+        "cost_micros"
+      ],
+      "properties": {
+        "input_tokens": {
+          "type": "integer",
+          "minimum": 0
+        },
+        "output_tokens": {
+          "type": "integer",
+          "minimum": 0
+        },
+        "cost_micros": {
+          "type": "integer",
+          "minimum": 0,
+          "description": "Custo em micro-unidades da moeda de faturamento (inteiro: sem ponto flutuante)."
+        }
+      }
+    }
+  },
+  "allOf": [
+    {
+      "if": {
+        "properties": {
+          "status": {
+            "const": "ok"
+          }
+        },
+        "required": [
+          "status"
+        ]
+      },
+      "then": {
+        "required": [
+          "content",
+          "finish_reason",
+          "usage"
+        ],
+        "not": {
+          "required": [
+            "error"
+          ]
+        }
+      },
+      "else": {
+        "required": [
+          "error"
+        ]
+      }
+    }
+  ]
+}
diff --git a/packages/contracts/schemas/handshake.schema.json b/packages/contracts/schemas/handshake.schema.json
new file mode 100644
index 0000000..31ed6a8
--- /dev/null
+++ b/packages/contracts/schemas/handshake.schema.json
@@ -0,0 +1,194 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/handshake.schema.json",
+  "x-schema-version": "1.0",
+  "title": "Handshake - enrollment, emissao, JWKS e revogacao (ADR-018)",
+  "description": "Mensagens entre runtime, Control Plane (CP) e servicos validadores. Transporte TLS; nenhuma mensagem carrega chave privada. Cada mensagem e validada por referencia a $defs/<nome>.",
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    },
+    "b64url": {
+      "type": "string",
+      "pattern": "^[A-Za-z0-9_-]+$"
+    },
+    "jwk_publica": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "kty",
+        "crv",
+        "x",
+        "kid",
+        "use",
+        "alg"
+      ],
+      "properties": {
+        "kty": {
+          "const": "OKP"
+        },
+        "crv": {
+          "const": "Ed25519"
+        },
+        "x": {
+          "$ref": "#/$defs/b64url"
+        },
+        "kid": {
+          "type": "string",
+          "pattern": "^[A-Za-z0-9_-]+$",
+          "maxLength": 64
+        },
+        "use": {
+          "const": "sig"
+        },
+        "alg": {
+          "const": "EdDSA"
+        }
+      }
+    },
+    "enrollment_request": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "tenant_id",
+        "enrollment_secret",
+        "runtime_public_key"
+      ],
+      "properties": {
+        "tenant_id": {
+          "$ref": "#/$defs/uuid"
+        },
+        "enrollment_secret": {
+          "type": "string",
+          "minLength": 32,
+          "description": "Uso unico, expira em minutos, gerado pelo provisioner; nunca logado."
+        },
+        "runtime_public_key": {
+          "$ref": "#/$defs/jwk_publica"
+        }
+      }
+    },
+    "enrollment_response": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "tenant_id",
+        "ver",
+        "runtime_kid"
+      ],
+      "properties": {
+        "tenant_id": {
+          "$ref": "#/$defs/uuid"
+        },
+        "ver": {
+          "type": "integer",
+          "minimum": 1
+        },
+        "runtime_kid": {
+          "type": "string"
+        }
+      }
+    },
+    "token_request": {
+      "type": "object",
+      "description": "client_assertion e um JWT EdDSA assinado com a chave privada do runtime (header kid = runtime_kid; claims: sub=runtime:<tenant_id>, aud=nucleos-control-plane, jti, iat, exp<=60 s).",
+      "additionalProperties": false,
+      "required": [
+        "client_assertion",
+        "audience",
+        "scope"
+      ],
+      "properties": {
+        "client_assertion": {
+          "type": "string"
+        },
+        "audience": {
+          "enum": [
+            "dispatcher",
+            "tool-gateway",
+            "ai-gateway"
+          ]
+        },
+        "scope": {
+          "type": "array",
+          "minItems": 1,
+          "items": {
+            "type": "string"
+          }
+        }
+      }
+    },
+    "token_response": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "access_token",
+        "token_type",
+        "expires_in"
+      ],
+      "properties": {
+        "access_token": {
+          "type": "string"
+        },
+        "token_type": {
+          "const": "Bearer"
+        },
+        "expires_in": {
+          "type": "integer",
+          "minimum": 1,
+          "maximum": 600
+        }
+      }
+    },
+    "jwks": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "keys"
+      ],
+      "properties": {
+        "keys": {
+          "type": "array",
+          "minItems": 1,
+          "maxItems": 3,
+          "items": {
+            "$ref": "#/$defs/jwk_publica"
+          }
+        }
+      }
+    },
+    "revocation_state": {
+      "type": "object",
+      "description": "Estado consultavel pelos validadores (poll curto e/ou push de emergencia). Nunca consultado por requisicao.",
+      "additionalProperties": false,
+      "required": [
+        "generated_at",
+        "min_ver"
+      ],
+      "properties": {
+        "generated_at": {
+          "type": "integer",
+          "minimum": 0
+        },
+        "min_ver": {
+          "type": "object",
+          "propertyNames": {
+            "$ref": "#/$defs/uuid"
+          },
+          "additionalProperties": {
+            "type": "integer",
+            "minimum": 1
+          }
+        },
+        "revoked_jti": {
+          "type": "array",
+          "items": {
+            "type": "string"
+          },
+          "description": "Opcional: revogacao pontual de jti ainda vivo."
+        }
+      }
+    }
+  }
+}
diff --git a/packages/contracts/schemas/job-envelope.schema.json b/packages/contracts/schemas/job-envelope.schema.json
new file mode 100644
index 0000000..aee67e8
--- /dev/null
+++ b/packages/contracts/schemas/job-envelope.schema.json
@@ -0,0 +1,100 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/job-envelope.schema.json",
+  "x-schema-version": "1.0",
+  "title": "JobEnvelope - envelope de job do Dispatcher para o runtime",
+  "description": "Contrato do job entregue ao runtime (EP-05). O runtime recusa envelope cujo tenant_id difira do seu proprio. assignment_signature assina os campos canonicos (definicao em MSG-001).",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "job_id",
+    "tenant_id",
+    "type",
+    "idempotency_key",
+    "attempt",
+    "issued_at",
+    "expires_at",
+    "correlation_id",
+    "assignment_signature"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "job_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "tenant_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "type": {
+      "type": "string",
+      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
+    },
+    "idempotency_key": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 128,
+      "pattern": "^[A-Za-z0-9_.:-]+$"
+    },
+    "attempt": {
+      "type": "integer",
+      "minimum": 1,
+      "maximum": 100
+    },
+    "issued_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "expires_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "correlation_id": {
+      "type": "string",
+      "minLength": 8,
+      "maxLength": 64,
+      "pattern": "^[A-Za-z0-9_-]+$"
+    },
+    "assignment_signature": {
+      "$ref": "#/$defs/assignment_signature"
+    },
+    "payload": {
+      "type": "object",
+      "description": "Corpo especifico do tipo de job; validado pelo contrato do tipo (fora deste envelope)."
+    }
+  },
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    },
+    "assignment_signature": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "kid",
+        "alg",
+        "value"
+      ],
+      "properties": {
+        "kid": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 64,
+          "pattern": "^[A-Za-z0-9_-]+$"
+        },
+        "alg": {
+          "const": "EdDSA"
+        },
+        "value": {
+          "type": "string",
+          "minLength": 1,
+          "pattern": "^[A-Za-z0-9_-]+$"
+        }
+      }
+    }
+  }
+}
diff --git a/packages/contracts/schemas/problem-details.schema.json b/packages/contracts/schemas/problem-details.schema.json
new file mode 100644
index 0000000..c1893ed
--- /dev/null
+++ b/packages/contracts/schemas/problem-details.schema.json
@@ -0,0 +1,73 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/problem-details.schema.json",
+  "x-schema-version": "1.0",
+  "title": "ProblemDetails - erro HTTP (RFC 9457)",
+  "description": "Corpo de erro da API (application/problem+json). Sem stack trace, SQL, segredos nem PII. additionalProperties=false: extensoes novas entram por versao do contrato.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "type",
+    "title",
+    "status"
+  ],
+  "properties": {
+    "type": {
+      "type": "string",
+      "maxLength": 2048,
+      "pattern": "^(about:blank|[A-Za-z][A-Za-z0-9+.-]*:[\\u0021-\\u007e]*|/[\\u0021-\\u007e]*)$"
+    },
+    "title": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 256
+    },
+    "status": {
+      "type": "integer",
+      "minimum": 400,
+      "maximum": 599
+    },
+    "detail": {
+      "type": "string",
+      "maxLength": 2048
+    },
+    "instance": {
+      "type": "string",
+      "maxLength": 2048,
+      "pattern": "^[\\u0021-\\u007e]+$"
+    },
+    "code": {
+      "type": "string",
+      "pattern": "^[a-z][a-z0-9_]{0,63}$"
+    },
+    "correlation_id": {
+      "type": "string",
+      "minLength": 8,
+      "maxLength": 64,
+      "pattern": "^[A-Za-z0-9_-]+$"
+    },
+    "errors": {
+      "type": "array",
+      "maxItems": 64,
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": [
+          "pointer",
+          "detail"
+        ],
+        "properties": {
+          "pointer": {
+            "type": "string",
+            "maxLength": 512
+          },
+          "detail": {
+            "type": "string",
+            "minLength": 1,
+            "maxLength": 1024
+          }
+        }
+      }
+    }
+  }
+}
diff --git a/packages/contracts/schemas/realtime-event.schema.json b/packages/contracts/schemas/realtime-event.schema.json
new file mode 100644
index 0000000..ed0f113
--- /dev/null
+++ b/packages/contracts/schemas/realtime-event.schema.json
@@ -0,0 +1,106 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/realtime-event.schema.json",
+  "x-schema-version": "1.0",
+  "title": "RealtimeEvent - evento de tempo real para a interface",
+  "description": "Payload minimo e sem conteudo privado (IDs, estados, rotulos); detalhes sao buscados por API autorizada (EP-05).",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "event_id",
+    "type",
+    "occurred_at",
+    "tenant_id",
+    "subject"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "event_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "type": {
+      "enum": [
+        "agent.status_changed",
+        "run.started",
+        "run.progress",
+        "run.waiting_approval",
+        "run.completed",
+        "run.failed",
+        "approval.requested",
+        "approval.decided",
+        "tenant.state_changed",
+        "budget.threshold_reached"
+      ]
+    },
+    "occurred_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "tenant_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "subject": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "kind",
+        "id"
+      ],
+      "properties": {
+        "kind": {
+          "enum": [
+            "agent",
+            "run",
+            "approval",
+            "tenant",
+            "budget"
+          ]
+        },
+        "id": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 64,
+          "pattern": "^[A-Za-z0-9_.:-]+$"
+        }
+      }
+    },
+    "state": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 64,
+      "pattern": "^[a-z][a-z0-9_.-]*$"
+    },
+    "data": {
+      "type": "object",
+      "maxProperties": 16,
+      "propertyNames": {
+        "pattern": "^[a-z][a-z0-9_]{0,31}$"
+      },
+      "additionalProperties": {
+        "oneOf": [
+          {
+            "type": "string",
+            "maxLength": 128
+          },
+          {
+            "type": "integer"
+          },
+          {
+            "type": "boolean"
+          }
+        ]
+      },
+      "description": "Apenas escalares curtos; nada de texto livre longo nem conteudo de usuario."
+    }
+  },
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    }
+  }
+}
diff --git a/packages/contracts/schemas/runtime-token.schema.json b/packages/contracts/schemas/runtime-token.schema.json
new file mode 100644
index 0000000..6a92b8e
--- /dev/null
+++ b/packages/contracts/schemas/runtime-token.schema.json
@@ -0,0 +1,119 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/runtime-token.schema.json",
+  "x-schema-version": "1.0",
+  "title": "RuntimeToken - header e claims do token de servico do runtime (ADR-018)",
+  "description": "JWT EdDSA (Ed25519) de vida curta emitido pelo Control Plane. Este schema valida o header e os claims decodificados; assinatura, iss/aud/exp e demais checagens semanticas (sub == runtime:<tenant_id>, exp - iat <= 600) ficam no validador (ver runtimeTokenSemanticErrors).",
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    },
+    "audience": {
+      "enum": [
+        "dispatcher",
+        "tool-gateway",
+        "ai-gateway"
+      ]
+    },
+    "header": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "alg",
+        "typ",
+        "kid"
+      ],
+      "properties": {
+        "alg": {
+          "const": "EdDSA"
+        },
+        "typ": {
+          "const": "nucleos-runtime+jwt"
+        },
+        "kid": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 64,
+          "pattern": "^[A-Za-z0-9_-]+$"
+        }
+      }
+    },
+    "claims": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "iss",
+        "sub",
+        "aud",
+        "scope",
+        "tenant_id",
+        "jti",
+        "iat",
+        "exp",
+        "ver"
+      ],
+      "properties": {
+        "iss": {
+          "const": "nucleos-control-plane"
+        },
+        "sub": {
+          "type": "string",
+          "pattern": "^runtime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
+          "description": "runtime:<tenant_id>; deve ser igual a runtime: + tenant_id (checagem semantica no validador)"
+        },
+        "aud": {
+          "$ref": "#/$defs/audience",
+          "description": "Uma unica audiencia por token; sem array."
+        },
+        "scope": {
+          "type": "array",
+          "minItems": 1,
+          "maxItems": 16,
+          "uniqueItems": true,
+          "items": {
+            "type": "string",
+            "pattern": "^[a-z][a-z0-9-]*:[a-z][a-z0-9_.-]*$"
+          }
+        },
+        "tenant_id": {
+          "$ref": "#/$defs/uuid"
+        },
+        "jti": {
+          "type": "string",
+          "minLength": 16,
+          "maxLength": 64,
+          "pattern": "^[A-Za-z0-9_-]+$"
+        },
+        "iat": {
+          "type": "integer",
+          "minimum": 0
+        },
+        "exp": {
+          "type": "integer",
+          "minimum": 0,
+          "description": "exp - iat <= 600 (checagem semantica: TTL maximo 10 min; padrao 300 s)"
+        },
+        "ver": {
+          "type": "integer",
+          "minimum": 1,
+          "description": "Versao da credencial do runtime; rejeitada se < ver_minima do tenant."
+        }
+      }
+    }
+  },
+  "type": "object",
+  "required": [
+    "header",
+    "claims"
+  ],
+  "additionalProperties": false,
+  "properties": {
+    "header": {
+      "$ref": "#/$defs/header"
+    },
+    "claims": {
+      "$ref": "#/$defs/claims"
+    }
+  }
+}
diff --git a/packages/contracts/schemas/subscription-event.schema.json b/packages/contracts/schemas/subscription-event.schema.json
new file mode 100644
index 0000000..da7f014
--- /dev/null
+++ b/packages/contracts/schemas/subscription-event.schema.json
@@ -0,0 +1,246 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/subscription-event.schema.json",
+  "x-schema-version": "1.0",
+  "title": "SubscriptionEvent - evento normalizado de assinatura (ADR-026)",
+  "description": "Evento normalizado de assinatura emitido pelo adaptador do provedor (ou pelo simulador) ao Control Plane. Nao carrega dados de cartao nem PII; o payload bruto fica fora, referenciado por raw_payload_ref.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "provider",
+    "provider_event_id",
+    "event_type",
+    "occurred_at",
+    "received_at",
+    "subscription",
+    "simulated"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0"
+    },
+    "provider": {
+      "type": "string",
+      "enum": [
+        "simulator",
+        "stripe",
+        "asaas",
+        "mercadopago"
+      ]
+    },
+    "provider_event_id": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 128,
+      "pattern": "^[A-Za-z0-9_.:-]+$",
+      "description": "Chave de idempotencia junto com provider. Unique (provider, provider_event_id)."
+    },
+    "event_type": {
+      "type": "string",
+      "enum": [
+        "subscription.created",
+        "subscription.activated",
+        "subscription.past_due",
+        "subscription.suspended_by_provider",
+        "subscription.resumed",
+        "subscription.plan_changed",
+        "subscription.canceled",
+        "payment.succeeded",
+        "payment.failed",
+        "payment.action_required",
+        "payment.refunded",
+        "payment.disputed"
+      ]
+    },
+    "occurred_at": {
+      "type": "string",
+      "format": "date-time",
+      "description": "Informativo. NAO define ordem de aplicacao (ordem de entrega nao e garantida)."
+    },
+    "received_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "simulated": {
+      "type": "boolean"
+    },
+    "subscription": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "provider_subscription_id"
+      ],
+      "properties": {
+        "provider_subscription_id": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 128
+        },
+        "provider_customer_id": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 128
+        },
+        "tenant_id": {
+          "type": "string",
+          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
+          "description": "Presente quando o vinculo ja existe no Control Plane; senao o CP resolve por provider_subscription_id."
+        },
+        "plan_code": {
+          "type": "string",
+          "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$"
+        },
+        "provider_status": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 64,
+          "description": "Status bruto informado pelo provedor, so para auditoria."
+        },
+        "current_period_end": {
+          "type": "string",
+          "format": "date-time"
+        }
+      }
+    },
+    "payment": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "amount_minor",
+        "currency"
+      ],
+      "properties": {
+        "provider_invoice_id": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 128
+        },
+        "amount_minor": {
+          "type": "integer",
+          "minimum": 0
+        },
+        "currency": {
+          "type": "string",
+          "pattern": "^[A-Z]{3}$"
+        },
+        "failure_code": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 64
+        },
+        "attempt_count": {
+          "type": "integer",
+          "minimum": 1
+        },
+        "next_retry_at": {
+          "type": "string",
+          "format": "date-time"
+        }
+      }
+    },
+    "raw_payload_ref": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 256,
+      "description": "Referencia (chave/URI interna) ao payload bruto guardado fora do evento."
+    }
+  },
+  "allOf": [
+    {
+      "if": {
+        "properties": {
+          "event_type": {
+            "enum": [
+              "payment.succeeded",
+              "payment.failed",
+              "payment.action_required",
+              "payment.refunded",
+              "payment.disputed"
+            ]
+          }
+        },
+        "required": [
+          "event_type"
+        ]
+      },
+      "then": {
+        "required": [
+          "payment"
+        ]
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "event_type": {
+            "const": "payment.failed"
+          }
+        },
+        "required": [
+          "event_type"
+        ]
+      },
+      "then": {
+        "properties": {
+          "payment": {
+            "type": "object",
+            "required": [
+              "failure_code",
+              "attempt_count"
+            ]
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "event_type": {
+            "const": "subscription.plan_changed"
+          }
+        },
+        "required": [
+          "event_type"
+        ]
+      },
+      "then": {
+        "properties": {
+          "subscription": {
+            "type": "object",
+            "required": [
+              "provider_subscription_id",
+              "plan_code"
+            ]
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "provider": {
+            "const": "simulator"
+          }
+        },
+        "required": [
+          "provider"
+        ]
+      },
+      "then": {
+        "properties": {
+          "simulated": {
+            "const": true
+          }
+        }
+      },
+      "else": {
+        "properties": {
+          "simulated": {
+            "const": false
+          }
+        }
+      }
+    }
+  ]
+}
diff --git a/packages/contracts/schemas/tenant-runtime-spec.schema.json b/packages/contracts/schemas/tenant-runtime-spec.schema.json
new file mode 100644
index 0000000..22c05db
--- /dev/null
+++ b/packages/contracts/schemas/tenant-runtime-spec.schema.json
@@ -0,0 +1,208 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/tenant-runtime-spec.schema.json",
+  "x-schema-version": "1.0",
+  "title": "TenantRuntimeSpec - especificacao declarativa do runtime de um tenant",
+  "description": "Renderizada pelo provisioner (EP-09/PRV-002). Imagens somente por digest; segredos somente por referencia; nenhum valor de segredo no spec.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "tenant_id",
+    "images",
+    "resources",
+    "network",
+    "volumes",
+    "secrets",
+    "modules",
+    "limits",
+    "endpoints"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "tenant_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "images": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "runtime",
+        "sidecar"
+      ],
+      "properties": {
+        "runtime": {
+          "type": "string",
+          "maxLength": 300,
+          "pattern": "^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$"
+        },
+        "sidecar": {
+          "type": "string",
+          "maxLength": 300,
+          "pattern": "^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$"
+        }
+      }
+    },
+    "resources": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "cpu_millis",
+        "memory_mib",
+        "pids",
+        "tmpfs_mib"
+      ],
+      "properties": {
+        "cpu_millis": {
+          "type": "integer",
+          "minimum": 100,
+          "maximum": 64000
+        },
+        "memory_mib": {
+          "type": "integer",
+          "minimum": 64,
+          "maximum": 262144
+        },
+        "pids": {
+          "type": "integer",
+          "minimum": 16,
+          "maximum": 65536
+        },
+        "tmpfs_mib": {
+          "type": "integer",
+          "minimum": 0,
+          "maximum": 65536
+        }
+      }
+    },
+    "network": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "name",
+        "subnet"
+      ],
+      "properties": {
+        "name": {
+          "type": "string",
+          "pattern": "^[a-z][a-z0-9-]{0,62}$"
+        },
+        "subnet": {
+          "type": "string",
+          "pattern": "^(10|172\\.(1[6-9]|2[0-9]|3[01])|192\\.168)\\.[0-9]{1,3}(\\.[0-9]{1,3}){0,2}/([0-9]|[12][0-9]|3[0-2])$",
+          "description": "CIDR IPv4 privado (RFC 1918)."
+        }
+      }
+    },
+    "volumes": {
+      "type": "array",
+      "maxItems": 16,
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": [
+          "name",
+          "mount_path"
+        ],
+        "properties": {
+          "name": {
+            "type": "string",
+            "pattern": "^[a-z][a-z0-9-]{0,62}$"
+          },
+          "mount_path": {
+            "type": "string",
+            "pattern": "^/[A-Za-z0-9_./-]{1,200}$",
+            "not": {
+              "pattern": "\\.\\."
+            }
+          }
+        }
+      }
+    },
+    "secrets": {
+      "type": "array",
+      "maxItems": 32,
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": [
+          "name",
+          "ref"
+        ],
+        "properties": {
+          "name": {
+            "type": "string",
+            "pattern": "^[a-z][a-z0-9-]{0,62}$"
+          },
+          "ref": {
+            "type": "string",
+            "minLength": 1,
+            "maxLength": 256,
+            "pattern": "^secretref:[A-Za-z0-9_./-]+$",
+            "description": "Referencia opaca; o valor nunca trafega no spec."
+          }
+        }
+      }
+    },
+    "modules": {
+      "type": "array",
+      "uniqueItems": true,
+      "maxItems": 64,
+      "items": {
+        "type": "string",
+        "pattern": "^[a-z][a-z0-9-]{0,62}$"
+      }
+    },
+    "limits": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "max_concurrency",
+        "budget_minor"
+      ],
+      "properties": {
+        "max_concurrency": {
+          "type": "integer",
+          "minimum": 1,
+          "maximum": 10000
+        },
+        "budget_minor": {
+          "type": "integer",
+          "minimum": 0
+        }
+      }
+    },
+    "endpoints": {
+      "type": "array",
+      "maxItems": 16,
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": [
+          "name",
+          "url"
+        ],
+        "properties": {
+          "name": {
+            "type": "string",
+            "pattern": "^[a-z][a-z0-9-]{0,62}$"
+          },
+          "url": {
+            "type": "string",
+            "maxLength": 256,
+            "pattern": "^https?://[a-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9_./-]*)?$"
+          }
+        }
+      }
+    }
+  },
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    }
+  }
+}
diff --git a/packages/contracts/schemas/tool-call-request.schema.json b/packages/contracts/schemas/tool-call-request.schema.json
new file mode 100644
index 0000000..520047d
--- /dev/null
+++ b/packages/contracts/schemas/tool-call-request.schema.json
@@ -0,0 +1,48 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/tool-call-request.schema.json",
+  "x-schema-version": "1.0",
+  "title": "ToolCallRequest - invocacao de ferramenta no Tool Gateway",
+  "description": "POST /v1/tools/{tool_name}/invoke. NAO existe campo de tenant: o tenant vem da identidade do sidecar/token (EP-07); additionalProperties=false rejeita qualquer tentativa de informa-lo.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "run_id",
+    "agent_id",
+    "step_seq",
+    "idempotency_key",
+    "arguments"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "run_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "agent_id": {
+      "$ref": "#/$defs/uuid"
+    },
+    "step_seq": {
+      "type": "integer",
+      "minimum": 0
+    },
+    "idempotency_key": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 128,
+      "pattern": "^[A-Za-z0-9_.:-]+$"
+    },
+    "arguments": {
+      "type": "object"
+    }
+  },
+  "$defs": {
+    "uuid": {
+      "type": "string",
+      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
+    }
+  }
+}
diff --git a/packages/contracts/schemas/tool-call-response.schema.json b/packages/contracts/schemas/tool-call-response.schema.json
new file mode 100644
index 0000000..e14ba4a
--- /dev/null
+++ b/packages/contracts/schemas/tool-call-response.schema.json
@@ -0,0 +1,87 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contracts/tool-call-response.schema.json",
+  "x-schema-version": "1.0",
+  "title": "ToolCallResponse - resultado da invocacao de ferramenta",
+  "description": "Resposta do Tool Gateway. status=ok exige result; status=error|denied exige error.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "status"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "1.0",
+      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
+    },
+    "status": {
+      "enum": [
+        "ok",
+        "error",
+        "denied"
+      ]
+    },
+    "result": {
+      "description": "Qualquer JSON; presente somente quando status=ok."
+    },
+    "error": {
+      "$ref": "#/$defs/error"
+    }
+  },
+  "$defs": {
+    "error": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": [
+        "code",
+        "message"
+      ],
+      "properties": {
+        "code": {
+          "type": "string",
+          "pattern": "^[a-z][a-z0-9_]{0,63}$"
+        },
+        "message": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 1024
+        }
+      }
+    }
+  },
+  "allOf": [
+    {
+      "if": {
+        "properties": {
+          "status": {
+            "const": "ok"
+          }
+        },
+        "required": [
+          "status"
+        ]
+      },
+      "then": {
+        "required": [
+          "result"
+        ],
+        "not": {
+          "required": [
+            "error"
+          ]
+        }
+      },
+      "else": {
+        "required": [
+          "error"
+        ],
+        "not": {
+          "required": [
+            "result"
+          ]
+        }
+      }
+    }
+  ]
+}
```
