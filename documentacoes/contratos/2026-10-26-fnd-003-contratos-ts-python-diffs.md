# FND-003 - diffs (2026-10-26)

Resumo: [documento principal](2026-10-26-fnd-003-contratos-ts-python.md). Commit da tarefa: `635cff0`. Base `d00e8df`.

Omitidos do patch textual por serem gerados, lock files ou dados (listados com estatistica): `pnpm-lock.yaml`, `uv.lock`, `packages/*/src/generated`, `packages/contracts-py/src/nucleos_contracts/{models,schemas}`, `packages/contracts/{exemplos,baseline,schemas}` (schemas e exemplos sao conteudo-fonte versionado em git; consulte `git show 635cff0`).

## Estatistica completa
```
 .agents/rules/project-instructions.md                                       |    4 +
 .prettierignore                                                             |    1 +
 AGENTS.md                                                                   |    4 +
 CLAUDE.md                                                                   |    4 +
 Makefile                                                                    |   27 +-
 eslint.config.mjs                                                           |    1 +
 packages/contracts-py/pyproject.toml                                        |   16 +
 packages/contracts-py/src/nucleos_contracts/__init__.py                     |   27 +
 packages/contracts-py/src/nucleos_contracts/models/__init__.py              |    1 +
 packages/contracts-py/src/nucleos_contracts/models/ai_completion_request.py |   44 ++
 .../contracts-py/src/nucleos_contracts/models/ai_completion_response.py     |   50 ++
 packages/contracts-py/src/nucleos_contracts/models/handshake.py             |  107 +++
 packages/contracts-py/src/nucleos_contracts/models/job_envelope.py          |   54 ++
 packages/contracts-py/src/nucleos_contracts/models/problem_details.py       |   37 +
 packages/contracts-py/src/nucleos_contracts/models/realtime_event.py        |   64 ++
 packages/contracts-py/src/nucleos_contracts/models/runtime_token.py         |   74 ++
 packages/contracts-py/src/nucleos_contracts/models/subscription_event.py    |   97 +++
 packages/contracts-py/src/nucleos_contracts/models/tenant_runtime_spec.py   |  123 +++
 packages/contracts-py/src/nucleos_contracts/models/tool_call_request.py     |   33 +
 packages/contracts-py/src/nucleos_contracts/models/tool_call_response.py    |   33 +
 packages/contracts-py/src/nucleos_contracts/py.typed                        |    0
 .../src/nucleos_contracts/schemas/ai-completion-request.schema.json         |   90 +++
 .../src/nucleos_contracts/schemas/ai-completion-response.schema.json        |  123 +++
 packages/contracts-py/src/nucleos_contracts/schemas/handshake.schema.json   |  194 +++++
 .../contracts-py/src/nucleos_contracts/schemas/job-envelope.schema.json     |  100 +++
 .../contracts-py/src/nucleos_contracts/schemas/problem-details.schema.json  |   73 ++
 .../contracts-py/src/nucleos_contracts/schemas/realtime-event.schema.json   |  106 +++
 .../contracts-py/src/nucleos_contracts/schemas/runtime-token.schema.json    |  119 +++
 .../src/nucleos_contracts/schemas/subscription-event.schema.json            |  246 ++++++
 .../src/nucleos_contracts/schemas/tenant-runtime-spec.schema.json           |  208 ++++++
 .../src/nucleos_contracts/schemas/tool-call-request.schema.json             |   48 ++
 .../src/nucleos_contracts/schemas/tool-call-response.schema.json            |   87 +++
 packages/contracts-py/src/nucleos_contracts/validation.py                   |  160 ++++
 packages/contracts-py/tests/test_contratos.py                               |  178 +++++
 packages/contracts/baseline/ai-completion-request.schema.json               |   90 +++
 packages/contracts/baseline/ai-completion-response.schema.json              |  123 +++
 packages/contracts/baseline/handshake.schema.json                           |  194 +++++
 packages/contracts/baseline/job-envelope.schema.json                        |  100 +++
 packages/contracts/baseline/problem-details.schema.json                     |   73 ++
 packages/contracts/baseline/realtime-event.schema.json                      |  106 +++
 packages/contracts/baseline/runtime-token.schema.json                       |  119 +++
 packages/contracts/baseline/subscription-event.schema.json                  |  246 ++++++
 packages/contracts/baseline/tenant-runtime-spec.schema.json                 |  208 ++++++
 packages/contracts/baseline/tool-call-request.schema.json                   |   48 ++
 packages/contracts/baseline/tool-call-response.schema.json                  |   87 +++
 .../ai-completion-response/invalidos/03-finish-reason-invalido.json         |   12 +
 .../handshake/token_request/invalidos/01-audiencia-desconhecida.json        |    7 +
 .../subscription-event/invalidos/03-campo-extra-dados-de-cartao.json        |    1 +
 .../subscription-event/invalidos/04-falha-sem-codigo-nem-tentativa.json     |    1 +
 .../subscription-event/invalidos/05-pagamento-sem-bloco-payment.json        |    1 +
 .../subscription-event/invalidos/06-simulador-com-simulated-false.json      |    1 +
 .../subscription-event/invalidos/07-provedor-real-com-simulated-true.json   |    1 +
 .../subscription-event/invalidos/10-id-com-caracteres-invalidos.json        |    1 +
 .../invalidos/13-quebra-de-linha-final-em-campos-com-pattern.json           |    1 +
 .../tenant-runtime-spec/invalidos/04-mount-path-com-ponto-ponto.json        |   44 ++
 packages/contracts/openapi/control-plane.openapi.json                       |   47 ++
 packages/contracts/package.json                                             |   19 +-
 packages/contracts/schemas/ai-completion-request.schema.json                |   90 +++
 packages/contracts/schemas/ai-completion-response.schema.json               |  123 +++
 packages/contracts/schemas/handshake.schema.json                            |  194 +++++
 packages/contracts/schemas/job-envelope.schema.json                         |  100 +++
 packages/contracts/schemas/problem-details.schema.json                      |   73 ++
 packages/contracts/schemas/realtime-event.schema.json                       |  106 +++
 packages/contracts/schemas/runtime-token.schema.json                        |  119 +++
 packages/contracts/schemas/subscription-event.schema.json                   |  246 ++++++
 packages/contracts/schemas/tenant-runtime-spec.schema.json                  |  208 ++++++
 packages/contracts/schemas/tool-call-request.schema.json                    |   48 ++
 packages/contracts/schemas/tool-call-response.schema.json                   |   87 +++
 packages/contracts/scripts/compat.mjs                                       |  196 +++++
 packages/contracts/scripts/compat.test.mjs                                  |  122 +++
 packages/contracts/scripts/gerar.mjs                                        |  248 +++++++
 packages/contracts/scripts/gerar.test.mjs                                   |   81 ++
 packages/contracts/src/contratos.test.ts                                    |  100 +++
 packages/contracts/src/datetime.ts                                          |   30 +
 packages/contracts/src/exemplos.ts                                          |   43 ++
 packages/contracts/src/generated/ai-completion-request.ts                   |   33 +
 packages/contracts/src/generated/ai-completion-response.ts                  |   40 +
 packages/contracts/src/generated/handshake.ts                               |   96 +++
 packages/contracts/src/generated/index.ts                                   |   14 +
 packages/contracts/src/generated/job-envelope.ts                            |   35 +
 packages/contracts/src/generated/problem-details.ts                         |   23 +
 packages/contracts/src/generated/realtime-event.ts                          |   38 +
 packages/contracts/src/generated/runtime-token.ts                           |  100 +++
 packages/contracts/src/generated/schemas.ts                                 | 1403 +++++++++++++++++++++++++++++++++++
 packages/contracts/src/generated/subscription-event.ts                      |   60 ++
 packages/contracts/src/generated/tenant-runtime-spec.ts                     | 1211 ++++++++++++++++++++++++++++++
 packages/contracts/src/generated/tool-call-request.ts                       |   18 +
 packages/contracts/src/generated/tool-call-response.ts                      |   30 +
 packages/contracts/src/index.ts                                             |   15 +
 packages/contracts/src/runtime-token.ts                                     |   19 +
 packages/contracts/src/validators.ts                                        |   73 ++
 packages/sdk/src/generated/control-plane.ts                                 |   88 +++
 packages/sdk/src/index.test.ts                                              |   37 +-
 packages/sdk/src/index.ts                                                   |   56 +-
 pnpm-lock.yaml                                                              |  291 +++++++-
 pyproject.toml                                                              |   10 +-
 scripts/ci/contracts-drift.sh                                               |   29 +-
 tools/qualidade/regressao-ci.mjs                                            |    8 +-
 uv.lock                                                                     |  625 +++++++++++++++-
 245 files changed, 12862 insertions(+), 34 deletions(-)
(+ 7 arquivos em packages/contracts/exemplos)
```

## Patch (codigo, testes, configuracao)

```diff
diff --git a/.agents/rules/project-instructions.md b/.agents/rules/project-instructions.md
index 9977b14..b1db6b0 100755
--- a/.agents/rules/project-instructions.md
+++ b/.agents/rules/project-instructions.md
@@ -180,6 +180,10 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Contratos TS/Python (FND-003): `make contracts-gen` (alias `make contracts`) regenera tipos TS,
+  cliente do SDK, modelos Pydantic e a copia dos schemas a partir de `packages/contracts`;
+  `make contracts-check` falha em drift ou mudanca incompativel de schema (job `contracts-drift`
+  do CI); `make contracts-baseline` promove os schemas a baseline apos liberar a versao.
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
diff --git a/.prettierignore b/.prettierignore
index 28c4f84..4e8453c 100644
--- a/.prettierignore
+++ b/.prettierignore
@@ -5,6 +5,7 @@
 **/node_modules/
 .run/
 **/next-env.d.ts
+**/generated/
 pnpm-lock.yaml
 uv.lock
 tools/qualidade/regressao/
diff --git a/AGENTS.md b/AGENTS.md
index 2d3cbe4..96f85e7 100755
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -197,6 +197,10 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Contratos TS/Python (FND-003): `make contracts-gen` (alias `make contracts`) regenera tipos TS,
+  cliente do SDK, modelos Pydantic e a copia dos schemas a partir de `packages/contracts`;
+  `make contracts-check` falha em drift ou mudanca incompativel de schema (job `contracts-drift`
+  do CI); `make contracts-baseline` promove os schemas a baseline apos liberar a versao.
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
diff --git a/CLAUDE.md b/CLAUDE.md
index 5ca95c1..cb26e50 100755
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -187,6 +187,10 @@ estas regras e as secoes anteriores deste arquivo.
   alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
   seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
   branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Contratos TS/Python (FND-003): `make contracts-gen` (alias `make contracts`) regenera tipos TS,
+  cliente do SDK, modelos Pydantic e a copia dos schemas a partir de `packages/contracts`;
+  `make contracts-check` falha em drift ou mudanca incompativel de schema (job `contracts-drift`
+  do CI); `make contracts-baseline` promove os schemas a baseline apos liberar a versao.
   Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
diff --git a/Makefile b/Makefile
index 19a0257..5d0969a 100644
--- a/Makefile
+++ b/Makefile
@@ -10,7 +10,7 @@ export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
 export TURBO_TELEMETRY_DISABLED=1
 export DO_NOT_TRACK=1
 
-.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows format hooks
+.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows format hooks contracts contracts-gen contracts-check contracts-baseline
 
 setup:
 	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
@@ -28,10 +28,10 @@ lint-ts: check-env
 	$(PNPM) run lint:quality
 
 lint-py:
-	$(UV) run --frozen python -m compileall -q services
+	$(UV) run --frozen python -m compileall -q services packages/contracts-py/src
 	$(UV) lock --check
-	$(UV) run --frozen ruff check services
-	$(UV) run --frozen ruff format --check services
+	$(UV) run --frozen ruff check services packages/contracts-py
+	$(UV) run --frozen ruff format --check services packages/contracts-py
 	$(UV) run --frozen mypy
 	$(UV) run --frozen lint-imports
 
@@ -50,7 +50,7 @@ ci-regressao:
 
 format:
 	$(PNPM) run format
-	$(UV) run --frozen ruff format services
+	$(UV) run --frozen ruff format services packages/contracts-py
 
 # Instala os hooks do lefthook no .git (explicito: o diretorio de hooks e compartilhado por worktrees).
 hooks:
@@ -93,3 +93,20 @@ compose-reset:
 
 compose-smoke:
 	./infrastructure/docker/scripts/smoke.sh $(if $(findstring runtime,$(PERFIS)),--runtime) $(if $(findstring observability,$(PERFIS)),--observability)
+
+# --- Contratos TS/Python (FND-003). Fonte: packages/contracts/schemas e openapi; ver documentacoes/contratos/.
+# contracts-gen regenera tipos TS, cliente do SDK, modelos Pydantic e a copia dos schemas (exige make setup).
+# contracts-check NAO escreve nada: falha se algum gerado divergir da fonte (drift) ou se a mudanca de
+# schema quebrar a compatibilidade com packages/contracts/baseline (usado pelo job contracts-drift do CI).
+# contracts-baseline promove os schemas atuais a baseline: so apos liberar a versao.
+contracts: contracts-gen
+
+contracts-gen: check-env
+	$(PNPM) --filter @nucleos/contracts run gerar
+
+contracts-check: check-env
+	$(PNPM) --filter @nucleos/contracts run verificar-gerados
+	$(PNPM) --filter @nucleos/contracts run compat
+
+contracts-baseline:
+	node packages/contracts/scripts/compat.mjs --baseline
diff --git a/eslint.config.mjs b/eslint.config.mjs
index df04800..edfa617 100644
--- a/eslint.config.mjs
+++ b/eslint.config.mjs
@@ -16,6 +16,7 @@ export default tseslint.config(
       "**/.run/**",
       "**/node_modules/**",
       "**/next-env.d.ts", // gerado pelo Next.js (REVIEW-004): versionado, nao linta
+      "**/generated/**", // gerado por packages/contracts/scripts/gerar.mjs (FND-003): drift e verificado, tsc linta
       ...(regressao ? [] : ["tools/qualidade/regressao/**"]), // fixtures que DEVEM falhar
       "skills/**",
       ".claude/**",
diff --git a/packages/contracts-py/pyproject.toml b/packages/contracts-py/pyproject.toml
new file mode 100644
index 0000000..824bad8
--- /dev/null
+++ b/packages/contracts-py/pyproject.toml
@@ -0,0 +1,16 @@
+[project]
+name = "nucleos-contracts"
+version = "0.0.0"
+description = "Modelos Pydantic gerados dos JSON Schemas de packages/contracts e validacao de contratos (FND-003)"
+requires-python = ">=3.12"
+dependencies = [
+  "pydantic==2.13.5",
+  "jsonschema==4.26.0",
+]
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "nucleos_contracts"
diff --git a/packages/contracts-py/src/nucleos_contracts/__init__.py b/packages/contracts-py/src/nucleos_contracts/__init__.py
new file mode 100644
index 0000000..a1a9735
--- /dev/null
+++ b/packages/contracts-py/src/nucleos_contracts/__init__.py
@@ -0,0 +1,27 @@
+"""Contratos entre componentes (FND-003): modelos Pydantic gerados e validacao por JSON Schema."""
+
+from nucleos_contracts.validation import (
+    RUNTIME_TOKEN_MAX_TTL_S,
+    ContractViolationError,
+    ValidationIssue,
+    assert_valid,
+    is_rfc3339_date_time,
+    is_valid,
+    load_schema,
+    runtime_token_semantic_errors,
+    schema_names,
+    validate,
+)
+
+__all__ = [
+    "RUNTIME_TOKEN_MAX_TTL_S",
+    "ContractViolationError",
+    "ValidationIssue",
+    "assert_valid",
+    "is_rfc3339_date_time",
+    "is_valid",
+    "load_schema",
+    "runtime_token_semantic_errors",
+    "schema_names",
+    "validate",
+]
diff --git a/packages/contracts-py/src/nucleos_contracts/py.typed b/packages/contracts-py/src/nucleos_contracts/py.typed
new file mode 100644
index 0000000..e69de29
diff --git a/packages/contracts-py/src/nucleos_contracts/validation.py b/packages/contracts-py/src/nucleos_contracts/validation.py
new file mode 100644
index 0000000..6ebdf0c
--- /dev/null
+++ b/packages/contracts-py/src/nucleos_contracts/validation.py
@@ -0,0 +1,160 @@
+"""Validacao de contratos em Python, com o mesmo resultado do pacote TypeScript @nucleos/contracts.
+
+Fonte unica: os JSON Schemas (2020-12) copiados em ``nucleos_contracts/schemas`` por
+``make contracts-gen``. Dois ajustes tornam o jsonschema equivalente ao ajv (ECMA-262):
+
+* ``pattern`` e buscado como em ECMA-262 (``RegExp.test``, sem ancoragem implicita), mas com ``$``
+  traduzido para ``\\Z``: em Python, ``$`` aceita uma quebra de linha final ("abc\\n" casa
+  ``^[a-z]+$``), em ECMA-262 nao.
+* ``date-time`` e o RFC 3339 estrito de ``is_rfc3339_date_time`` (mesma regra e mesma tabela de
+  casos de ``packages/contracts/src/datetime.ts``), em vez do verificador padrao da biblioteca.
+"""
+
+from __future__ import annotations
+
+import json
+import re
+from collections.abc import Iterator, Mapping
+from dataclasses import dataclass
+from functools import cache
+from importlib.resources import files
+from typing import Any
+
+from jsonschema import Draft202012Validator, FormatChecker
+from jsonschema.exceptions import ValidationError
+from jsonschema.validators import extend
+
+RUNTIME_TOKEN_MAX_TTL_S = 600
+
+_RFC3339 = re.compile(
+    r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?"
+    r"(?:Z|[+-]([0-9]{2}):([0-9]{2}))"
+)
+
+
+def _days_in_month(year: int, month: int) -> int:
+    if month == 2:
+        return 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28
+    return 30 if month in (4, 6, 9, 11) else 31
+
+
+def is_rfc3339_date_time(value: str) -> bool:
+    m = _RFC3339.fullmatch(value)
+    if m is None:
+        return False
+    year, month, day, hour, minute, second = (int(g) for g in m.groups()[:6])
+    if not 1 <= month <= 12 or not 1 <= day <= _days_in_month(year, month):
+        return False
+    if hour > 23 or minute > 59 or second > 59:
+        return False
+    return m.group(7) is None or (int(m.group(7)) <= 23 and int(m.group(8)) <= 59)
+
+
+def _ecma_to_python(pattern: str) -> str:
+    """Traduz `$` (fora de classe e nao escapado) para `\\Z` (fim absoluto da entrada)."""
+    out: list[str] = []
+    in_class = escaped = False
+    for ch in pattern:
+        if escaped:
+            escaped = False
+        elif ch == "\\":
+            escaped = True
+        elif ch == "[":
+            in_class = True
+        elif ch == "]":
+            in_class = False
+        elif ch == "$" and not in_class:
+            out.append("\\Z")
+            continue
+        out.append(ch)
+    return "".join(out)
+
+
+def _pattern(validator: Any, pattern: str, instance: Any, schema: Any) -> Iterator[ValidationError]:
+    if (
+        validator.is_type(instance, "string")
+        and re.search(_ecma_to_python(pattern), instance) is None
+    ):
+        yield ValidationError(f"{instance!r} does not match {pattern!r}")
+
+
+_Validator = extend(Draft202012Validator, {"pattern": _pattern})
+_formats = FormatChecker(formats=())
+
+
+@_formats.checks("date-time")
+def _date_time(value: object) -> bool:
+    return not isinstance(value, str) or is_rfc3339_date_time(value)
+
+
+@dataclass(frozen=True)
+class ValidationIssue:
+    path: str  # JSON Pointer da instancia (vazio = raiz)
+    keyword: str
+    message: str
+
+
+class ContractViolationError(ValueError):
+    def __init__(self, schema: str, issues: list[ValidationIssue]) -> None:
+        self.schema = schema
+        self.issues = issues
+        detail = "; ".join(f"{i.path or '/'} {i.message}" for i in issues)
+        super().__init__(f"violacao do contrato {schema}: {detail}")
+
+
+@cache
+def load_schema(name: str) -> dict[str, Any]:
+    text = (files("nucleos_contracts") / "schemas" / f"{name}.schema.json").read_text("utf-8")
+    loaded: dict[str, Any] = json.loads(text)
+    return loaded
+
+
+def schema_names() -> list[str]:
+    folder = files("nucleos_contracts") / "schemas"
+    return sorted(p.name.removesuffix(".schema.json") for p in folder.iterdir())
+
+
+@cache
+def _validator(name: str, definition: str | None) -> Any:
+    schema = load_schema(name)
+    if definition is not None:
+        defs = schema.get("$defs", {})
+        if definition not in defs:
+            raise KeyError(f"schema ou definicao inexistente: {name}#/$defs/{definition}")
+        schema = {
+            "$schema": schema["$schema"],
+            "$defs": defs,
+            "$ref": f"#/$defs/{definition}",
+        }
+    return _Validator(schema, format_checker=_formats)
+
+
+def validate(name: str, data: Any, definition: str | None = None) -> list[ValidationIssue]:
+    """Problemas (lista vazia = valido) de ``data`` contra ``name`` (ou ``$defs/<definition>``)."""
+    errors = _validator(name, definition).iter_errors(data)
+    return [
+        ValidationIssue("".join(f"/{p}" for p in e.absolute_path), str(e.validator), e.message)
+        for e in errors
+    ]
+
+
+def is_valid(name: str, data: Any, definition: str | None = None) -> bool:
+    return not validate(name, data, definition)
+
+
+def assert_valid(name: str, data: Any, definition: str | None = None) -> None:
+    issues = validate(name, data, definition)
+    if issues:
+        raise ContractViolationError(name, issues)
+
+
+def runtime_token_semantic_errors(claims: Mapping[str, Any]) -> list[str]:
+    """Regras do ADR-018 fora do schema; mesmos codigos de ``runtimeTokenSemanticErrors``."""
+    errors: list[str] = []
+    if claims["sub"] != f"runtime:{claims['tenant_id']}":
+        errors.append("sub_tenant_mismatch")
+    if claims["exp"] <= claims["iat"]:
+        errors.append("ttl_not_positive")
+    elif claims["exp"] - claims["iat"] > RUNTIME_TOKEN_MAX_TTL_S:
+        errors.append("ttl_too_long")
+    return errors
diff --git a/packages/contracts-py/tests/test_contratos.py b/packages/contracts-py/tests/test_contratos.py
new file mode 100644
index 0000000..7dbee99
--- /dev/null
+++ b/packages/contracts-py/tests/test_contratos.py
@@ -0,0 +1,178 @@
+"""Testes de contrato em Python: os MESMOS exemplos de packages/contracts/exemplos do TypeScript."""
+
+from __future__ import annotations
+
+import importlib
+import json
+from pathlib import Path
+from typing import Any
+
+import pytest
+from nucleos_contracts import (
+    ContractViolationError,
+    assert_valid,
+    is_rfc3339_date_time,
+    runtime_token_semantic_errors,
+    schema_names,
+    validate,
+)
+from pydantic import BaseModel, ValidationError
+
+PACOTE = Path(__file__).resolve().parents[2] / "contracts"
+EXEMPLOS = PACOTE / "exemplos"
+
+
+def _carregar() -> list[tuple[str, str | None, bool, str, Path]]:
+    casos: list[tuple[str, str | None, bool, str, Path]] = []
+    for pasta in sorted(p for p in EXEMPLOS.rglob("*") if p.name in ("validos", "invalidos")):
+        relativo = pasta.relative_to(EXEMPLOS).parts
+        schema, definicao = relativo[0], (relativo[1] if len(relativo) == 3 else None)
+        for arq in sorted(pasta.glob("*.json")):
+            casos.append((schema, definicao, pasta.name == "validos", arq.name, arq))
+    return casos
+
+
+CASOS = _carregar()
+IDS = [f"{s}{'#' + d if d else ''}-{'aceita' if v else 'rejeita'}-{n}" for s, d, v, n, _ in CASOS]
+
+
+def test_todo_schema_tem_exemplos() -> None:
+    for nome in schema_names():
+        doschema = [c for c in CASOS if c[0] == nome]
+        assert any(c[2] for c in doschema), f"{nome}: sem exemplo valido"
+        assert sum(1 for c in doschema if not c[2]) >= 3, f"{nome}: poucos invalidos"
+    assert {c[0] for c in CASOS} <= set(schema_names())
+
+
+@pytest.mark.parametrize(("schema", "definicao", "valido", "_nome", "arquivo"), CASOS, ids=IDS)
+def test_exemplo_tem_o_mesmo_resultado_do_typescript(
+    schema: str, definicao: str | None, valido: bool, _nome: str, arquivo: Path
+) -> None:
+    dado = json.loads(arquivo.read_text("utf-8"))
+    problemas = validate(schema, dado, definicao)
+    assert (not problemas) == valido, problemas
+
+
+# --- Modelos Pydantic gerados ---------------------------------------------------------------
+CLASSES = {
+    ("job-envelope", None): ("job_envelope", "JobEnvelope"),
+    ("runtime-token", None): ("runtime_token", "RuntimeToken"),
+    ("handshake", "jwk_publica"): ("handshake", "JwkPublica"),
+    ("handshake", "enrollment_request"): ("handshake", "EnrollmentRequest"),
+    ("handshake", "enrollment_response"): ("handshake", "EnrollmentResponse"),
+    ("handshake", "token_request"): ("handshake", "TokenRequest"),
+    ("handshake", "token_response"): ("handshake", "TokenResponse"),
+    ("handshake", "jwks"): ("handshake", "Jwks"),
+    ("handshake", "revocation_state"): ("handshake", "RevocationState"),
+    ("tool-call-request", None): ("tool_call_request", "ToolCallRequest"),
+    ("tool-call-response", None): ("tool_call_response", "ToolCallResponse"),
+    ("ai-completion-request", None): ("ai_completion_request", "AiCompletionRequest"),
+    ("ai-completion-response", None): ("ai_completion_response", "AiCompletionResponse"),
+    ("subscription-event", None): ("subscription_event", "SubscriptionEvent"),
+    ("realtime-event", None): ("realtime_event", "RealtimeEvent"),
+    ("tenant-runtime-spec", None): ("tenant_runtime_spec", "TenantRuntimeSpec"),
+    ("problem-details", None): ("problem_details", "ProblemDetails"),
+}
+
+# Regras que o gerador NAO traduz para Pydantic (if/then/else, uniqueItems, not, propertyNames,
+# formato estrito de data-hora): o modelo gerado as aceita. A validacao autoritativa e `validate`
+# (JSON Schema, mesmo resultado do TypeScript); o modelo e uma conveniencia tipada. Lista FECHADA:
+# um caso novo aqui exige revisao (e o teste abaixo falha se o gerador passar a cobrir algum).
+LACUNAS_DO_MODELO = {
+    ("subscription-event", "04-falha-sem-codigo-nem-tentativa.json"),
+    ("subscription-event", "05-pagamento-sem-bloco-payment.json"),
+    ("subscription-event", "06-simulador-com-simulated-false.json"),
+    ("subscription-event", "07-provedor-real-com-simulated-true.json"),
+    ("subscription-event", "09-plan-changed-sem-plano.json"),
+    ("subscription-event", "14-data-hora-minuscula.json"),
+    ("subscription-event", "15-fuso-sem-dois-pontos.json"),
+    ("subscription-event", "21-separador-espaco.json"),
+    ("tool-call-response", "01-ok-sem-result.json"),
+    ("tool-call-response", "02-error-sem-error.json"),
+    ("tool-call-response", "03-ok-com-error.json"),
+    ("ai-completion-response", "01-ok-sem-usage.json"),
+    ("ai-completion-response", "04-ok-sem-content.json"),
+    ("ai-completion-response", "05-error-sem-error.json"),
+    ("handshake", "03-chave-nao-uuid.json"),
+    ("realtime-event", "03-data-chave-maiuscula.json"),
+    ("runtime-token", "08-scope-duplicado.json"),
+    ("tenant-runtime-spec", "04-mount-path-com-ponto-ponto.json"),
+    ("tenant-runtime-spec", "06-modulos-duplicados.json"),
+}
+
+
+def _modelo(schema: str, definicao: str | None) -> type[BaseModel]:
+    modulo, classe = CLASSES[(schema, definicao)]
+    cls = getattr(importlib.import_module(f"nucleos_contracts.models.{modulo}"), classe)
+    assert issubclass(cls, BaseModel)
+    return cls
+
+
+@pytest.mark.parametrize(("schema", "definicao", "valido", "nome", "arquivo"), CASOS, ids=IDS)
+def test_modelo_pydantic_gerado(
+    schema: str, definicao: str | None, valido: bool, nome: str, arquivo: Path
+) -> None:
+    if (schema, definicao) not in CLASSES:
+        pytest.skip("schema sem modelo de raiz")
+    modelo = _modelo(schema, definicao)
+    texto = arquivo.read_text("utf-8")
+    if valido:
+        obj = modelo.model_validate_json(texto, strict=True)
+        # round-trip: modelo -> JSON -> modelo e o JSON emitido ainda cumpre o contrato
+        emitido = obj.model_dump_json(exclude_unset=True)
+        assert modelo.model_validate_json(emitido) == obj
+        assert validate(schema, json.loads(emitido), definicao) == []
+    elif (schema, nome) not in LACUNAS_DO_MODELO:
+        with pytest.raises(ValidationError):
+            modelo.model_validate_json(texto, strict=True)
+
+
+def test_lacunas_do_modelo_continuam_lacunas() -> None:
+    """Se o gerador passar a traduzir uma regra, remova-a da lista (nao esconder cobertura)."""
+    achados = 0
+    for schema, definicao, valido, nome, arquivo in CASOS:
+        if valido or (schema, nome) not in LACUNAS_DO_MODELO:
+            continue
+        achados += 1
+        try:
+            _modelo(schema, definicao).model_validate_json(arquivo.read_text("utf-8"), strict=True)
+        except ValidationError:
+            pytest.fail(f"{schema}/{nome} agora e rejeitado pelo modelo: remover de LACUNAS")
+    assert achados == len(LACUNAS_DO_MODELO)
+
+
+# --- Semantica, formato e cobertura ---------------------------------------------------------
+def test_semantica_do_runtime_token() -> None:
+    casos: list[dict[str, Any]] = json.loads(
+        (EXEMPLOS / "runtime-token" / "semantica.json").read_text("utf-8")
+    )
+    header = {"alg": "EdDSA", "typ": "nucleos-runtime+jwt", "kid": "k"}
+    for c in casos:
+        assert validate("runtime-token", {"header": header, "claims": c["claims"]}) == []
+        assert runtime_token_semantic_errors(c["claims"]) == c["erros"], c["nome"]
+
+
+def test_date_time_estrito_mesma_tabela_do_typescript() -> None:
+    tabela = json.loads((EXEMPLOS / "date-time.json").read_text("utf-8"))
+    for caso in tabela:
+        assert is_rfc3339_date_time(caso["valor"]) == caso["valido"], caso["valor"]
+
+
+def test_quebra_de_linha_final_nao_casa_pattern() -> None:
+    problemas = validate("job-envelope", {"type": "x\n"}, None)
+    assert any(p.path == "/type" and p.keyword == "pattern" for p in problemas)
+
+
+def test_assert_valid_e_definicao_inexistente() -> None:
+    with pytest.raises(ContractViolationError, match="problem-details"):
+        assert_valid("problem-details", {"type": "about:blank", "title": "x", "status": 200})
+    with pytest.raises(KeyError):
+        validate("problem-details", {}, "nao-existe")
+
+
+def test_copia_dos_schemas_no_pacote_python_e_identica_a_fonte() -> None:
+    for nome in schema_names():
+        copia = Path(__file__).resolve().parents[1] / "src" / "nucleos_contracts" / "schemas"
+        assert (copia / f"{nome}.schema.json").read_bytes() == (
+            PACOTE / "schemas" / f"{nome}.schema.json"
+        ).read_bytes()
diff --git a/packages/contracts/openapi/control-plane.openapi.json b/packages/contracts/openapi/control-plane.openapi.json
new file mode 100644
index 0000000..6a14061
--- /dev/null
+++ b/packages/contracts/openapi/control-plane.openapi.json
@@ -0,0 +1,47 @@
+{
+  "openapi": "3.1.0",
+  "info": {
+    "title": "Nucleos Control Plane API",
+    "version": "1.0.0",
+    "description": "Contrato REST do Control Plane. Fonte de verdade do cliente de packages/sdk. Hoje cobre apenas o endpoint de saude; novos endpoints entram aqui junto com a implementacao (a geracao a partir do NestJS esta pendente, ver documentacao da entrega FND-003)."
+  },
+  "servers": [{ "url": "http://127.0.0.1:3000", "description": "Desenvolvimento local" }],
+  "paths": {
+    "/healthz": {
+      "get": {
+        "operationId": "getHealth",
+        "summary": "Saude do componente",
+        "responses": {
+          "200": {
+            "description": "Componente saudavel",
+            "content": {
+              "application/json": { "schema": { "$ref": "#/components/schemas/HealthResponse" } }
+            }
+          },
+          "default": {
+            "description": "Erro",
+            "content": {
+              "application/problem+json": {
+                "schema": { "$ref": "#/components/schemas/ProblemDetails" }
+              }
+            }
+          }
+        }
+      }
+    }
+  },
+  "components": {
+    "schemas": {
+      "ProblemDetails": { "$ref": "../schemas/problem-details.schema.json" },
+      "HealthResponse": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": ["status", "service"],
+        "properties": {
+          "status": { "const": "ok" },
+          "service": { "type": "string", "minLength": 1 }
+        }
+      }
+    }
+  }
+}
diff --git a/packages/contracts/package.json b/packages/contracts/package.json
index acffceb..d8625ba 100644
--- a/packages/contracts/package.json
+++ b/packages/contracts/package.json
@@ -5,10 +5,25 @@
   "type": "module",
   "main": "./dist/index.js",
   "types": "./dist/index.d.ts",
-  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
+  "exports": {
+    ".": {
+      "types": "./dist/index.d.ts",
+      "default": "./dist/index.js"
+    }
+  },
   "scripts": {
     "build": "tsc -p tsconfig.json",
     "lint": "tsc -p tsconfig.json --noEmit",
-    "test": "node --test \"dist/**/*.test.js\""
+    "test": "node --test \"dist/**/*.test.js\" \"scripts/*.test.mjs\"",
+    "gerar": "node scripts/gerar.mjs",
+    "verificar-gerados": "node scripts/gerar.mjs --check",
+    "compat": "node scripts/compat.mjs"
+  },
+  "dependencies": {
+    "ajv": "8.20.0"
+  },
+  "devDependencies": {
+    "json-schema-to-typescript": "16.0.0",
+    "openapi-typescript": "7.13.0"
   }
 }
diff --git a/packages/contracts/scripts/compat.mjs b/packages/contracts/scripts/compat.mjs
new file mode 100644
index 0000000..0e2c4dc
--- /dev/null
+++ b/packages/contracts/scripts/compat.mjs
@@ -0,0 +1,196 @@
+#!/usr/bin/env node
+// Teste de compatibilidade de contratos (ENT-FND-003, AC-3).
+//
+// Regra: o schema novo deve aceitar TODO documento aceito pelo baseline (ultima versao liberada, em
+// packages/contracts/baseline/). Adicao de campo OPCIONAL = minor (x-schema-version sobe o minor);
+// remocao/mudanca incompativel = major (sobe o major, com periodo de coexistencia combinado no ADR/ticket
+// do contrato). A analise e conservadora: na duvida (ex.: if/then novo) trata como incompativel.
+//
+// Uso: node scripts/compat.mjs            compara schemas/ com baseline/ e falha em violacao
+//      node scripts/compat.mjs --baseline  promove schemas/ a novo baseline (apos liberar a versao)
+import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+
+const PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");
+
+const ESTREITAM_MIN = ["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"];
+const ESTREITAM_MAX = ["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"];
+const COMPOSICAO = ["allOf", "anyOf", "oneOf", "not", "if", "then", "else", "dependentRequired"];
+const IGNORADOS = new Set([
+  "title",
+  "description",
+  "$comment",
+  "examples",
+  "x-schema-version",
+  "$id",
+  "$schema",
+]);
+
+const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);
+const tipos = (s) => (s.type === undefined ? null : [].concat(s.type));
+
+function resolver(raiz, s) {
+  let atual = s;
+  for (let i = 0; i < 20 && typeof atual?.$ref === "string"; i++) {
+    const { $ref, ...resto } = atual;
+    if (!$ref.startsWith("#/")) return atual;
+    const alvo = $ref
+      .slice(2)
+      .split("/")
+      .reduce((o, k) => o?.[k], raiz);
+    atual = { ...alvo, ...resto };
+  }
+  return atual;
+}
+
+/** Lista de incompatibilidades (strings) de `novo` em relacao a `antigo`; vazia = compativel. */
+export function incompatibilidades(antigo, novo) {
+  const erros = [];
+  const visitar = (a, n, caminho) => {
+    const sa = resolver(antigo, a);
+    const sn = resolver(novo, n);
+    if (sa === undefined || sn === undefined || typeof sa !== "object" || typeof sn !== "object") {
+      if (!iguais(sa, sn)) erros.push(`${caminho}: schema alterado`);
+      return;
+    }
+    const ta = tipos(sa);
+    const tn = tipos(sn);
+    if (
+      tn !== null &&
+      (ta === null ||
+        !ta.every((t) => tn.includes(t) || (t === "integer" && tn.includes("number"))))
+    )
+      erros.push(
+        `${caminho}: tipo alterado (${JSON.stringify(sa.type)} -> ${JSON.stringify(sn.type)})`,
+      );
+    if ("const" in sa && !iguais(sa.const, sn.const)) erros.push(`${caminho}: const alterado`);
+    if (!("const" in sa) && "const" in sn) erros.push(`${caminho}: const adicionado`);
+    if (sa.enum !== undefined) {
+      if (sn.enum !== undefined) {
+        for (const v of sa.enum)
+          if (!sn.enum.some((x) => iguais(x, v)))
+            erros.push(`${caminho}: valor de enum removido (${JSON.stringify(v)})`);
+      } else if (sn.const !== undefined) erros.push(`${caminho}: enum virou const`);
+    } else if (sn.enum !== undefined) erros.push(`${caminho}: enum adicionado`);
+    for (const k of ESTREITAM_MIN)
+      if (sn[k] !== undefined && (sa[k] === undefined || sn[k] > sa[k]))
+        erros.push(`${caminho}: ${k} mais restritivo`);
+    for (const k of ESTREITAM_MAX)
+      if (sn[k] !== undefined && (sa[k] === undefined || sn[k] < sa[k]))
+        erros.push(`${caminho}: ${k} mais restritivo`);
+    for (const k of ["pattern", "format", "multipleOf"])
+      if (!iguais(sa[k], sn[k])) erros.push(`${caminho}: ${k} alterado`);
+    if (sn.uniqueItems === true && sa.uniqueItems !== true)
+      erros.push(`${caminho}: uniqueItems adicionado`);
+    for (const k of COMPOSICAO) if (!iguais(sa[k], sn[k])) erros.push(`${caminho}: ${k} alterado`);
+    for (const campo of sn.required ?? [])
+      if (!(sa.required ?? []).includes(campo))
+        erros.push(`${caminho}: campo passou a ser obrigatorio (${campo})`);
+    const pa = sa.properties ?? {};
+    const pn = sn.properties ?? {};
+    for (const k of Object.keys(pa)) {
+      if (!(k in pn)) erros.push(`${caminho}: campo removido (${k})`);
+      else visitar(pa[k], pn[k], `${caminho}/${k}`);
+    }
+    const apAntigo = sa.additionalProperties ?? true;
+    const apNovo = sn.additionalProperties ?? true;
+    if (apAntigo !== false && apNovo === false)
+      erros.push(`${caminho}: additionalProperties passou a false`);
+    else if (typeof apAntigo === "object" && typeof apNovo === "object")
+      visitar(apAntigo, apNovo, `${caminho}/*`);
+    else if (typeof apAntigo === "object" && apNovo === false)
+      erros.push(`${caminho}: additionalProperties passou a false`);
+    if (sa.items !== undefined) {
+      if (sn.items === undefined) erros.push(`${caminho}: items removido`);
+      else visitar(sa.items, sn.items, `${caminho}[]`);
+    }
+    for (const k of Object.keys(sn))
+      if (
+        !IGNORADOS.has(k) &&
+        !(k in sa) &&
+        ![
+          "properties",
+          "required",
+          "items",
+          "additionalProperties",
+          "$defs",
+          "type",
+          "const",
+          "enum",
+          ...ESTREITAM_MIN,
+          ...ESTREITAM_MAX,
+          "uniqueItems",
+          "pattern",
+          "format",
+          "multipleOf",
+          ...COMPOSICAO,
+        ].includes(k) &&
+        k !== "$ref"
+      )
+        erros.push(`${caminho}: palavra-chave nova nao analisada (${k})`);
+  };
+  visitar(antigo, novo, "#");
+  return erros;
+}
+
+const versao = (s) => {
+  const m = /^([0-9]+)\.([0-9]+)$/.exec(s["x-schema-version"] ?? "");
+  if (m === null) throw new Error("x-schema-version ausente ou invalida (esperado major.minor)");
+  return [Number(m[1]), Number(m[2])];
+};
+
+/** Compara um par baseline/atual e devolve problemas de versionamento (vazio = ok). */
+export function verificarPar(nome, antigo, novo) {
+  if (iguais(antigo, novo)) return [];
+  const [ma, na] = versao(antigo);
+  const [mn, nn] = versao(novo);
+  const incomp = incompatibilidades(antigo, novo);
+  if (mn < ma || (mn === ma && nn < na))
+    return [`${nome}: versao regrediu (${ma}.${na} -> ${mn}.${nn})`];
+  if (incomp.length > 0 && mn === ma)
+    return [
+      `${nome}: mudanca INCOMPATIVEL sem subir o major (${ma}.${na} -> ${mn}.${nn}):`,
+      ...incomp.map((e) => `  - ${e}`),
+    ];
+  if (mn === ma && nn === na)
+    return [`${nome}: schema mudou sem subir x-schema-version (adicao opcional = minor)`];
+  return [];
+}
+
+function lerDir(dir) {
+  const r = new Map();
+  if (!existsSync(dir)) return r;
+  for (const f of readdirSync(dir).filter((x) => x.endsWith(".schema.json")))
+    r.set(f.replace(".schema.json", ""), JSON.parse(readFileSync(join(dir, f), "utf8")));
+  return r;
+}
+
+/** Verifica todos os schemas de `atual` contra `baseline`; devolve a lista de problemas. */
+export function verificarDiretorios(baseline, atual) {
+  const problemas = [];
+  const b = lerDir(baseline);
+  const a = lerDir(atual);
+  for (const [nome, s] of b) {
+    if (!a.has(nome)) problemas.push(`${nome}: contrato removido (existe no baseline)`);
+    else problemas.push(...verificarPar(nome, s, a.get(nome)));
+  }
+  return problemas;
+}
+
+if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
+  const baseline = join(PACOTE, "baseline");
+  const atual = join(PACOTE, "schemas");
+  if (process.argv.includes("--baseline")) {
+    for (const f of readdirSync(atual).filter((x) => x.endsWith(".schema.json")))
+      copyFileSync(join(atual, f), join(baseline, f));
+    console.log("baseline atualizado a partir de schemas/");
+  } else {
+    const problemas = verificarDiretorios(baseline, atual);
+    if (problemas.length > 0) {
+      console.error(`Compatibilidade de contratos VIOLADA:\n${problemas.join("\n")}`);
+      process.exit(1);
+    }
+    console.log(`compatibilidade ok (${lerDir(atual).size} contratos contra o baseline)`);
+  }
+}
diff --git a/packages/contracts/scripts/compat.test.mjs b/packages/contracts/scripts/compat.test.mjs
new file mode 100644
index 0000000..86dbaf4
--- /dev/null
+++ b/packages/contracts/scripts/compat.test.mjs
@@ -0,0 +1,122 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { test } from "node:test";
+import { incompatibilidades, verificarDiretorios, verificarPar } from "./compat.mjs";
+
+const base = () => ({
+  "x-schema-version": "1.0",
+  type: "object",
+  additionalProperties: false,
+  required: ["schema_version", "a"],
+  properties: {
+    schema_version: { const: "1.0" },
+    a: { type: "string", maxLength: 10, pattern: "^[a-z]+$" },
+    modo: { enum: ["x", "y"] },
+    n: { type: "integer", minimum: 0, maximum: 5 },
+    lista: { type: "array", items: { type: "string" } },
+    obj: { type: "object" },
+  },
+});
+const mudar = (f, versao) => {
+  const s = base();
+  f(s);
+  if (versao !== undefined) s["x-schema-version"] = versao;
+  return s;
+};
+
+test("identico e compativel", () => {
+  assert.deepEqual(verificarPar("c", base(), base()), []);
+});
+
+test("campo opcional novo: compativel, mas exige minor", () => {
+  const novo = mudar((s) => (s.properties.b = { type: "string" }));
+  assert.deepEqual(incompatibilidades(base(), novo), []);
+  assert.match(verificarPar("c", base(), novo)[0], /sem subir x-schema-version/);
+  const comMinor = mudar((s) => (s.properties.b = { type: "string" }), "1.1");
+  assert.deepEqual(verificarPar("c", base(), comMinor), []);
+});
+
+test("relaxar restricao e compativel", () => {
+  const novo = mudar((s) => {
+    s.properties.a.maxLength = 20;
+    s.properties.modo.enum.push("z");
+    s.properties.n.maximum = 9;
+  }, "1.1");
+  assert.deepEqual(incompatibilidades(base(), novo), []);
+  assert.deepEqual(verificarPar("c", base(), novo), []);
+});
+
+const incompativeis = {
+  "campo obrigatorio novo": (s) => {
+    s.properties.b = { type: "string" };
+    s.required.push("b");
+  },
+  "campo removido": (s) => delete s.properties.lista,
+  "tipo alterado": (s) => (s.properties.a.type = "integer"),
+  "valor de enum removido": (s) => (s.properties.modo.enum = ["x"]),
+  "maxLength reduzido": (s) => (s.properties.a.maxLength = 5),
+  "minimum elevado": (s) => (s.properties.n.minimum = 1),
+  "pattern alterado": (s) => (s.properties.a.pattern = "^[a-z0-9]+$"),
+  "additionalProperties true -> false": (s) => (s.properties.obj.additionalProperties = false),
+  "const alterado": (s) => (s.properties.schema_version.const = "2.0"),
+  "condicional novo": (s) => (s.allOf = [{ if: { required: ["a"] }, then: { required: ["n"] } }]),
+  "items alterado": (s) => (s.properties.lista.items = { type: "integer" }),
+};
+for (const [nome, f] of Object.entries(incompativeis)) {
+  test(`incompativel detectado: ${nome}`, () => {
+    const novo = mudar(f);
+    assert.ok(incompatibilidades(base(), novo).length > 0, nome);
+    // sem major: falha; com minor apenas: falha; com major: passa
+    assert.match(verificarPar("c", base(), novo).join("\n"), /INCOMPATIVEL/);
+    assert.match(verificarPar("c", base(), mudar(f, "1.1")).join("\n"), /INCOMPATIVEL/);
+    assert.deepEqual(verificarPar("c", base(), mudar(f, "2.0")), []);
+  });
+}
+
+test("versao nao pode regredir", () => {
+  assert.match(
+    verificarPar(
+      "c",
+      mudar(() => {}, "1.2"),
+      mudar((s) => (s.properties.b = { type: "string" }), "1.1"),
+    )[0],
+    /regrediu/,
+  );
+});
+
+test("verificarDiretorios: contrato removido e mudanca incompativel falham; ok passa", () => {
+  const raiz = mkdtempSync(join(tmpdir(), "nucleos-compat-"));
+  try {
+    const grava = (dir, nome, obj) => {
+      mkdirSync(join(raiz, dir), { recursive: true });
+      writeFileSync(join(raiz, dir, `${nome}.schema.json`), JSON.stringify(obj));
+    };
+    grava("b", "um", base());
+    grava("b", "dois", base());
+    grava("a", "um", base());
+    assert.match(
+      verificarDiretorios(join(raiz, "b"), join(raiz, "a")).join("\n"),
+      /dois: contrato removido/,
+    );
+    grava(
+      "a",
+      "dois",
+      mudar((s) => delete s.properties.a),
+    );
+    assert.match(
+      verificarDiretorios(join(raiz, "b"), join(raiz, "a")).join("\n"),
+      /dois: mudanca INCOMPATIVEL/,
+    );
+    grava("a", "dois", base());
+    assert.deepEqual(verificarDiretorios(join(raiz, "b"), join(raiz, "a")), []);
+  } finally {
+    rmSync(raiz, { recursive: true, force: true });
+  }
+});
+
+test("schemas reais estao compativeis com o baseline", () => {
+  const pacote = join(import.meta.dirname, "..");
+  assert.deepEqual(verificarDiretorios(join(pacote, "baseline"), join(pacote, "schemas")), []);
+});
diff --git a/packages/contracts/scripts/gerar.mjs b/packages/contracts/scripts/gerar.mjs
new file mode 100644
index 0000000..57e1070
--- /dev/null
+++ b/packages/contracts/scripts/gerar.mjs
@@ -0,0 +1,248 @@
+#!/usr/bin/env node
+// Gerador unico de contratos (ENT-FND-003). Fonte da verdade: packages/contracts/schemas/*.schema.json
+// (JSON Schema 2020-12) e packages/contracts/openapi/control-plane.openapi.json (OpenAPI 3.1).
+//
+// Saidas (todas versionadas, com cabecalho "GERADO - NAO EDITAR"):
+//   packages/contracts/src/generated/        tipos TypeScript + schemas embutidos
+//   packages/sdk/src/generated/              tipos do cliente a partir do OpenAPI
+//   packages/contracts-py/src/nucleos_contracts/models/    modelos Pydantic (datamodel-code-generator)
+//   packages/contracts-py/src/nucleos_contracts/schemas/   copia dos schemas usada na validacao Python
+//
+// Uso: node scripts/gerar.mjs           regenera no repositorio
+//      node scripts/gerar.mjs --check   gera em diretorio temporario e FALHA se diferir do versionado
+//                                       (arquivo alterado, ausente ou obsoleto = drift)
+import { spawnSync } from "node:child_process";
+import {
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  readdirSync,
+  rmSync,
+  writeFileSync,
+} from "node:fs";
+import { tmpdir } from "node:os";
+import { dirname, join, relative } from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+import { compile } from "json-schema-to-typescript";
+import openapiTS, { astToString } from "openapi-typescript";
+
+export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
+const SCHEMAS = join(RAIZ, "packages", "contracts", "schemas");
+const OPENAPI = join(RAIZ, "packages", "contracts", "openapi", "control-plane.openapi.json");
+
+/** Diretorios gerados, relativos a raiz do repositorio. */
+export const SAIDAS = [
+  "packages/contracts/src/generated",
+  "packages/sdk/src/generated",
+  "packages/contracts-py/src/nucleos_contracts/models",
+  "packages/contracts-py/src/nucleos_contracts/schemas",
+];
+
+const AVISO =
+  "GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.";
+
+const pascal = (s) =>
+  s
+    .split(/[-_]/)
+    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
+    .join("");
+
+function lerSchemas() {
+  return readdirSync(SCHEMAS)
+    .filter((f) => f.endsWith(".schema.json"))
+    .sort()
+    .map((f) => ({
+      nome: f.replace(/\.schema\.json$/, ""),
+      arquivo: f,
+      texto: readFileSync(join(SCHEMAS, f), "utf8"),
+      schema: JSON.parse(readFileSync(join(SCHEMAS, f), "utf8")),
+    }));
+}
+
+/** Defs primitivas (sem propriedades) viram inline: evita aliases genericos (Uuid) colidindo entre arquivos. */
+function prepararParaTipos(nome, original) {
+  const schema = structuredClone(original);
+  const raiz = pascal(nome);
+  schema.title = raiz;
+  const defs = schema.$defs ?? {};
+  const originais = structuredClone(defs);
+  const primitivas = new Set(
+    Object.entries(defs)
+      .filter(([, d]) => d.properties === undefined)
+      .map(([k]) => k),
+  );
+  const visitar = (no) => {
+    if (Array.isArray(no)) return no.map(visitar);
+    if (no === null || typeof no !== "object") return no;
+    if (typeof no.$ref === "string" && no.$ref.startsWith("#/$defs/")) {
+      const alvo = no.$ref.slice("#/$defs/".length);
+      if (primitivas.has(alvo)) {
+        const { $ref: _ignorado, ...resto } = no;
+        return visitar({ ...originais[alvo], ...resto });
+      }
+    }
+    return Object.fromEntries(Object.entries(no).map(([k, v]) => [k, visitar(v)]));
+  };
+  for (const k of Object.keys(defs)) {
+    if (primitivas.has(k)) delete defs[k];
+    else defs[k].title = raiz + pascal(k);
+  }
+  const resultado = visitar(schema);
+  if (Object.keys(resultado.$defs ?? {}).length === 0) delete resultado.$defs;
+  return resultado;
+}
+
+async function gerarTipos(saida, schemas) {
+  const dir = join(saida, SAIDAS[0]);
+  mkdirSync(dir, { recursive: true });
+  const indice = [`// ${AVISO}`];
+  for (const { nome, schema } of schemas) {
+    const raiz = pascal(nome);
+    const ts = await compile(prepararParaTipos(nome, schema), raiz, {
+      bannerComment: `/* eslint-disable */\n// ${AVISO}\n// Fonte: packages/contracts/schemas/${nome}.schema.json`,
+      unreachableDefinitions: true,
+      additionalProperties: false,
+      declareExternallyReferenced: true,
+    });
+    writeFileSync(join(dir, `${nome}.ts`), ts);
+    const publicos = [...ts.matchAll(/^export (?:interface|type) (\w+)/gm)]
+      .map((m) => m[1])
+      .filter((n) => n.startsWith(raiz));
+    indice.push(`export type { ${publicos.join(", ")} } from "./${nome}.js";`);
+  }
+  const nomes = schemas.map((s) => s.nome);
+  const corpo = schemas
+    .map(({ nome, schema }) => `  ${JSON.stringify(nome)}: ${JSON.stringify(schema, null, 2)},`)
+    .join("\n");
+  writeFileSync(
+    join(dir, "schemas.ts"),
+    `/* eslint-disable */\n// ${AVISO}\n\nexport type SchemaName = ${nomes.map((n) => JSON.stringify(n)).join(" | ")};\n\n` +
+      `export const SCHEMA_NAMES: readonly SchemaName[] = ${JSON.stringify(nomes)};\n\n` +
+      `export const schemas: Readonly<Record<SchemaName, Readonly<Record<string, unknown>>>> = {\n${corpo}\n};\n`,
+  );
+  indice.push('export { SCHEMA_NAMES, schemas } from "./schemas.js";');
+  indice.push('export type { SchemaName } from "./schemas.js";');
+  writeFileSync(join(dir, "index.ts"), indice.join("\n") + "\n");
+}
+
+async function gerarOpenapi(saida) {
+  const dir = join(saida, SAIDAS[1]);
+  mkdirSync(dir, { recursive: true });
+  const ast = await openapiTS(pathToFileURL(OPENAPI), { immutable: true });
+  writeFileSync(
+    join(dir, "control-plane.ts"),
+    `/* eslint-disable */\n// ${AVISO}\n// Fonte: packages/contracts/openapi/control-plane.openapi.json\n\n${astToString(ast)}`,
+  );
+}
+
+function removerPropertyNames(no) {
+  if (Array.isArray(no)) no.forEach(removerPropertyNames);
+  else if (no !== null && typeof no === "object") {
+    delete no.propertyNames;
+    Object.values(no).forEach(removerPropertyNames);
+  }
+}
+
+function gerarPython(saida, schemas) {
+  const stage = mkdtempSync(join(tmpdir(), "nucleos-contratos-"));
+  try {
+    for (const { nome, schema } of schemas) {
+      const copia = structuredClone(schema);
+      copia.title = pascal(nome);
+      // propertyNames com $ref a um RootModel gera dict[Uuid, ...] (chave nao hashable no Pydantic).
+      // A restricao de chaves continua valendo na validacao por JSON Schema.
+      removerPropertyNames(copia);
+      writeFileSync(join(stage, `${nome}.json`), JSON.stringify(copia, null, 1));
+    }
+    const modelos = join(saida, SAIDAS[2]);
+    rmSync(modelos, { recursive: true, force: true });
+    const r = spawnSync(
+      process.env.UV ?? "uv",
+      [
+        "run",
+        "--frozen",
+        "datamodel-codegen",
+        ...["--input", stage, "--input-file-type", "jsonschema", "--output", modelos],
+        ...["--output-model-type", "pydantic_v2.BaseModel", "--disable-timestamp"],
+        ...["--target-python-version", "3.12", "--formatters", "black", "isort"],
+        ...["--use-annotated", "--field-constraints", "--extra-fields", "forbid"],
+        ...["--use-title-as-name", "--enum-field-as-literal", "all"],
+        ...["--custom-file-header", `# ${AVISO}`],
+      ],
+      { cwd: RAIZ, encoding: "utf8" },
+    );
+    if (r.status !== 0) {
+      throw new Error(`datamodel-codegen falhou (${String(r.status)}):\n${r.stdout}${r.stderr}`);
+    }
+    const copias = join(saida, SAIDAS[3]);
+    mkdirSync(copias, { recursive: true });
+    for (const { arquivo, texto } of schemas) writeFileSync(join(copias, arquivo), texto);
+  } finally {
+    rmSync(stage, { recursive: true, force: true });
+  }
+}
+
+/** Gera todas as saidas sob `saida` (mesma estrutura relativa do repositorio). */
+export async function gerarEm(saida) {
+  for (const d of SAIDAS) rmSync(join(saida, d), { recursive: true, force: true });
+  const schemas = lerSchemas();
+  await gerarTipos(saida, schemas);
+  await gerarOpenapi(saida);
+  gerarPython(saida, schemas);
+}
+
+function listar(base) {
+  const arquivos = new Map();
+  const percorrer = (dir) => {
+    if (!existsSync(dir)) return;
+    for (const e of readdirSync(dir, { withFileTypes: true })) {
+      if (e.name === "__pycache__") continue;
+      const caminho = join(dir, e.name);
+      if (e.isDirectory()) percorrer(caminho);
+      else arquivos.set(relative(base, caminho), readFileSync(caminho, "utf8"));
+    }
+  };
+  for (const d of SAIDAS) percorrer(join(base, d));
+  return arquivos;
+}
+
+/** Compara dois repositorios (ou arvores) nas saidas geradas; devolve a lista de divergencias. */
+export function compararArvores(gerada, versionada) {
+  const a = listar(gerada);
+  const b = listar(versionada);
+  const dif = [];
+  for (const [k, v] of a) {
+    if (!b.has(k)) dif.push(`ausente no repositorio (arquivo novo gerado): ${k}`);
+    else if (b.get(k) !== v) dif.push(`desatualizado: ${k}`);
+  }
+  for (const k of b.keys()) if (!a.has(k)) dif.push(`obsoleto (nao e mais gerado): ${k}`);
+  return dif.sort();
+}
+
+async function main() {
+  if (process.argv.includes("--check")) {
+    const tmp = mkdtempSync(join(tmpdir(), "nucleos-gerado-"));
+    try {
+      await gerarEm(tmp);
+      // CONTRACTS_REPO_ROOT: so para testes (arvore a comparar); por padrao, o proprio repositorio.
+      const dif = compararArvores(tmp, process.env.CONTRACTS_REPO_ROOT ?? RAIZ);
+      if (dif.length > 0) {
+        console.error(
+          `DRIFT em contratos gerados (rode make contracts-gen e commite):\n- ${dif.join("\n- ")}`,
+        );
+        process.exit(1);
+      }
+      console.log("contratos gerados em dia com as fontes (sem drift)");
+    } finally {
+      rmSync(tmp, { recursive: true, force: true });
+    }
+    return;
+  }
+  await gerarEm(RAIZ);
+  console.log("contratos regenerados em:", SAIDAS.join(", "));
+}
+
+if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
+  await main();
+}
diff --git a/packages/contracts/scripts/gerar.test.mjs b/packages/contracts/scripts/gerar.test.mjs
new file mode 100644
index 0000000..490fcc9
--- /dev/null
+++ b/packages/contracts/scripts/gerar.test.mjs
@@ -0,0 +1,81 @@
+import assert from "node:assert/strict";
+import { spawnSync } from "node:child_process";
+import { mkdtempSync, rmSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { after, before, test } from "node:test";
+import { RAIZ, SAIDAS, compararArvores, gerarEm } from "./gerar.mjs";
+
+const tmps = [];
+const novoTmp = () => {
+  const d = mkdtempSync(join(tmpdir(), "nucleos-gerar-teste-"));
+  tmps.push(d);
+  return d;
+};
+let gerado;
+before(async () => {
+  gerado = novoTmp();
+  await gerarEm(gerado);
+});
+after(() => {
+  for (const d of tmps) rmSync(d, { recursive: true, force: true });
+});
+
+const check = (raizVersionada) =>
+  spawnSync(
+    process.execPath,
+    [join(RAIZ, "packages", "contracts", "scripts", "gerar.mjs"), "--check"],
+    {
+      encoding: "utf8",
+      env: { ...process.env, CONTRACTS_REPO_ROOT: raizVersionada },
+    },
+  );
+
+test("a geracao e deterministica e o repositorio esta sem drift", () => {
+  assert.deepEqual(compararArvores(gerado, RAIZ), []);
+});
+
+test("geracao cobre TS, SDK, modelos Pydantic e copia dos schemas", () => {
+  const arquivos = (d) => compararArvores(gerado, d);
+  const vazio = novoTmp();
+  const lista = arquivos(vazio).join("\n");
+  for (const d of SAIDAS) assert.ok(lista.includes(d), `sem saida em ${d}`);
+  assert.match(lista, /generated\/job-envelope\.ts/);
+  assert.match(lista, /models\/job_envelope\.py/);
+  assert.match(lista, /generated\/control-plane\.ts/);
+});
+
+test("drift: arquivo gerado alterado a mao e detectado (--check sai com 1)", () => {
+  const versionada = novoTmp();
+  return gerarEm(versionada).then(() => {
+    assert.equal(check(versionada).status, 0);
+    const alvo = join(versionada, "packages/contracts/src/generated/job-envelope.ts");
+    writeFileSync(alvo, `${readFileSync(alvo, "utf8")}// edicao manual\n`);
+    const r = check(versionada);
+    assert.equal(r.status, 1);
+    assert.match(
+      r.stderr,
+      /DRIFT[\s\S]*desatualizado: packages\/contracts\/src\/generated\/job-envelope\.ts/,
+    );
+  });
+});
+
+test("drift: arquivo NOVO gerado e ausente no repositorio e detectado", async () => {
+  const versionada = novoTmp();
+  await gerarEm(versionada);
+  unlinkSync(
+    join(versionada, "packages/contracts-py/src/nucleos_contracts/models/job_envelope.py"),
+  );
+  const r = check(versionada);
+  assert.equal(r.status, 1);
+  assert.match(r.stderr, /ausente no repositorio \(arquivo novo gerado\): .*job_envelope\.py/);
+});
+
+test("drift: arquivo obsoleto (nao mais gerado) e detectado", async () => {
+  const versionada = novoTmp();
+  await gerarEm(versionada);
+  writeFileSync(join(versionada, "packages/contracts/src/generated/antigo.ts"), "export {};\n");
+  const r = check(versionada);
+  assert.equal(r.status, 1);
+  assert.match(r.stderr, /obsoleto \(nao e mais gerado\): .*antigo\.ts/);
+});
diff --git a/packages/contracts/src/contratos.test.ts b/packages/contracts/src/contratos.test.ts
new file mode 100644
index 0000000..310266f
--- /dev/null
+++ b/packages/contracts/src/contratos.test.ts
@@ -0,0 +1,100 @@
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import { join } from "node:path";
+import { test } from "node:test";
+import { isRfc3339DateTime } from "./datetime.js";
+import { carregarExemplos } from "./exemplos.js";
+import {
+  SCHEMA_NAMES,
+  assertValid,
+  ContractViolationError,
+  runtimeTokenSemanticErrors,
+  schemas,
+  validate,
+  type RuntimeTokenClaims,
+  type SchemaName,
+} from "./index.js";
+
+const raizPacote = join(import.meta.dirname, "..");
+const exemplos = carregarExemplos(join(raizPacote, "exemplos"));
+
+test("todo schema tem exemplos validos e ao menos 3 invalidos", () => {
+  for (const nome of SCHEMA_NAMES) {
+    const doSchema = exemplos.filter((e) => e.schema === nome);
+    assert.ok(
+      doSchema.some((e) => e.valido),
+      `${nome}: sem exemplo valido`,
+    );
+    assert.ok(doSchema.filter((e) => !e.valido).length >= 3, `${nome}: poucos invalidos`);
+  }
+  for (const e of exemplos) assert.ok(SCHEMA_NAMES.includes(e.schema as SchemaName), e.schema);
+});
+
+for (const e of exemplos) {
+  const rotulo = `${e.schema}${e.def === undefined ? "" : `#${e.def}`} ${e.valido ? "aceita" : "rejeita"} ${e.nome}`;
+  test(rotulo, () => {
+    const r = validate(e.schema as SchemaName, e.dado, e.def);
+    assert.equal(r.valid, e.valido, JSON.stringify(r));
+    if (e.valido) {
+      // round-trip: serializar e reler nao altera a validade nem o conteudo
+      const volta = JSON.parse(JSON.stringify(e.dado)) as unknown;
+      assert.deepEqual(volta, e.dado);
+      assert.equal(validate(e.schema as SchemaName, volta, e.def).valid, true);
+    }
+  });
+}
+
+test("x-schema-version existe em todo schema e coincide com schema_version quando ha", () => {
+  for (const nome of SCHEMA_NAMES) {
+    const s = schemas[nome] as {
+      "x-schema-version"?: string;
+      properties?: { schema_version?: { const?: string } };
+    };
+    assert.match(s["x-schema-version"] ?? "", /^[0-9]+\.[0-9]+$/, nome);
+    const c = s.properties?.schema_version?.const;
+    if (c !== undefined) assert.equal(c, s["x-schema-version"], nome);
+  }
+});
+
+test("assertValid lanca ContractViolationError com os problemas", () => {
+  assert.throws(
+    () => {
+      assertValid("problem-details", { type: "about:blank", title: "x", status: 200 });
+    },
+    (err: unknown) =>
+      err instanceof ContractViolationError &&
+      err.issues.some((i) => i.path === "/status" && i.keyword === "minimum"),
+  );
+  assert.doesNotThrow(() => {
+    assertValid("problem-details", { type: "about:blank", title: "x", status: 404 });
+  });
+  assert.throws(() => validate("problem-details", {}, "nao-existe"), /inexistente/);
+});
+
+interface CasoSemantico {
+  nome: string;
+  claims: RuntimeTokenClaims;
+  erros: string[];
+}
+const semanticos = JSON.parse(
+  readFileSync(join(raizPacote, "exemplos", "runtime-token", "semantica.json"), "utf8"),
+) as CasoSemantico[];
+for (const c of semanticos) {
+  test(`runtime-token semantica: ${c.nome}`, () => {
+    assert.equal(
+      validate("runtime-token", {
+        header: { alg: "EdDSA", typ: "nucleos-runtime+jwt", kid: "k" },
+        claims: c.claims,
+      }).valid,
+      true,
+    );
+    assert.deepEqual(runtimeTokenSemanticErrors(c.claims), c.erros);
+  });
+}
+
+test("date-time estrito (mesma tabela do teste Python)", () => {
+  const tabela = JSON.parse(
+    readFileSync(join(raizPacote, "exemplos", "date-time.json"), "utf8"),
+  ) as { valor: string; valido: boolean }[];
+  for (const { valor, valido } of tabela) assert.equal(isRfc3339DateTime(valor), valido, valor);
+});
diff --git a/packages/contracts/src/datetime.ts b/packages/contracts/src/datetime.ts
new file mode 100644
index 0000000..efb570e
--- /dev/null
+++ b/packages/contracts/src/datetime.ts
@@ -0,0 +1,30 @@
+/**
+ * Formato `date-time` dos contratos: RFC 3339 estrito, identico em TypeScript e Python
+ * (packages/contracts-py/src/nucleos_contracts/validation.py). Exige `T` maiusculo, fuso `Z` ou `+hh:mm`,
+ * calendario valido e sem segundo bissexto (`:60`). Definido aqui, e nao via ajv-formats, para que os dois
+ * motores aceitem e rejeitem exatamente as mesmas entradas.
+ */
+const RFC3339 =
+  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?(?:Z|[+-]([0-9]{2}):([0-9]{2}))$/;
+
+function diasNoMes(ano: number, mes: number): number {
+  if (mes === 2) return ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28;
+  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
+}
+
+export function isRfc3339DateTime(valor: string): boolean {
+  const m = RFC3339.exec(valor);
+  if (m === null) return false;
+  const [ano, mes, dia, hora, min, seg] = m.slice(1, 7).map(Number) as [
+    number,
+    number,
+    number,
+    number,
+    number,
+    number,
+  ];
+  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return false;
+  if (hora > 23 || min > 59 || seg > 59) return false;
+  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false;
+  return true;
+}
diff --git a/packages/contracts/src/exemplos.ts b/packages/contracts/src/exemplos.ts
new file mode 100644
index 0000000..b3f7dbe
--- /dev/null
+++ b/packages/contracts/src/exemplos.ts
@@ -0,0 +1,43 @@
+import { readFileSync, readdirSync, statSync } from "node:fs";
+import { join } from "node:path";
+
+/** Um caso de exemplo: arquivo em exemplos/<schema>[/<def>]/(validos|invalidos)/*.json. */
+export interface Exemplo {
+  schema: string;
+  def: string | undefined;
+  valido: boolean;
+  nome: string;
+  dado: unknown;
+}
+
+/**
+ * Le os exemplos compartilhados (fonte unica para TypeScript e Python: os mesmos arquivos sao
+ * executados nas duas linguagens e o resultado esperado e dado pelo diretorio).
+ */
+export function carregarExemplos(raiz: string): Exemplo[] {
+  const saida: Exemplo[] = [];
+  const percorrer = (dir: string, schema: string, def: string | undefined): void => {
+    for (const nome of readdirSync(dir).sort()) {
+      const caminho = join(dir, nome);
+      if (!statSync(caminho).isDirectory()) continue;
+      if (nome === "validos" || nome === "invalidos") {
+        for (const arq of readdirSync(caminho).sort()) {
+          saida.push({
+            schema,
+            def,
+            valido: nome === "validos",
+            nome: arq,
+            dado: JSON.parse(readFileSync(join(caminho, arq), "utf8")) as unknown,
+          });
+        }
+      } else {
+        percorrer(caminho, schema, nome);
+      }
+    }
+  };
+  for (const schema of readdirSync(raiz).sort()) {
+    const caminho = join(raiz, schema);
+    if (statSync(caminho).isDirectory()) percorrer(caminho, schema, undefined);
+  }
+  return saida;
+}
diff --git a/packages/contracts/src/index.ts b/packages/contracts/src/index.ts
index 67695f0..04b364d 100644
--- a/packages/contracts/src/index.ts
+++ b/packages/contracts/src/index.ts
@@ -9,3 +9,18 @@ export interface HealthResponse {
 export function healthResponse(service: string): HealthResponse {
   return { status: "ok", service };
 }
+
+export * from "./generated/index.js";
+export { isRfc3339DateTime } from "./datetime.js";
+export {
+  RUNTIME_TOKEN_MAX_TTL_S,
+  runtimeTokenSemanticErrors,
+  type RuntimeTokenSemanticError,
+} from "./runtime-token.js";
+export {
+  ContractViolationError,
+  assertValid,
+  validate,
+  type ValidationIssue,
+  type ValidationResult,
+} from "./validators.js";
diff --git a/packages/contracts/src/runtime-token.ts b/packages/contracts/src/runtime-token.ts
new file mode 100644
index 0000000..61beb39
--- /dev/null
+++ b/packages/contracts/src/runtime-token.ts
@@ -0,0 +1,19 @@
+import type { RuntimeTokenClaims } from "./generated/index.js";
+
+/** TTL maximo do token de servico do runtime, em segundos (ADR-018). */
+export const RUNTIME_TOKEN_MAX_TTL_S = 600;
+
+export type RuntimeTokenSemanticError = "sub_tenant_mismatch" | "ttl_too_long" | "ttl_not_positive";
+
+/**
+ * Regras do ADR-018 que o JSON Schema nao expressa (campos cruzados). Mesmos codigos do validador
+ * do PoC DEC-004 e da versao Python (`runtime_token_semantic_errors`); a assinatura, iss, aud e
+ * relogio continuam responsabilidade do validador de cada servico.
+ */
+export function runtimeTokenSemanticErrors(c: RuntimeTokenClaims): RuntimeTokenSemanticError[] {
+  const erros: RuntimeTokenSemanticError[] = [];
+  if (c.sub !== `runtime:${c.tenant_id}`) erros.push("sub_tenant_mismatch");
+  if (c.exp <= c.iat) erros.push("ttl_not_positive");
+  else if (c.exp - c.iat > RUNTIME_TOKEN_MAX_TTL_S) erros.push("ttl_too_long");
+  return erros;
+}
diff --git a/packages/contracts/src/validators.ts b/packages/contracts/src/validators.ts
new file mode 100644
index 0000000..6c8dad5
--- /dev/null
+++ b/packages/contracts/src/validators.ts
@@ -0,0 +1,73 @@
+import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
+import { isRfc3339DateTime } from "./datetime.js";
+import { SCHEMA_NAMES, schemas, type SchemaName } from "./generated/index.js";
+
+export interface ValidationIssue {
+  /** JSON Pointer da instancia (vazio = raiz). */
+  path: string;
+  keyword: string;
+  message: string;
+}
+
+export type ValidationResult = { valid: true } | { valid: false; issues: ValidationIssue[] };
+
+// strictRequired desligado: `then: {required: [...]}` em allOf/if referencia propriedades do objeto pai,
+// padrao legitimo dos contratos condicionais. Todo o restante do modo estrito do ajv fica ligado.
+function criarAjv(): Ajv2020 {
+  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
+  ajv.addKeyword({ keyword: "x-schema-version", schemaType: "string" });
+  ajv.addFormat("date-time", { type: "string", validate: isRfc3339DateTime });
+  for (const nome of SCHEMA_NAMES) ajv.addSchema(schemas[nome], nome);
+  return ajv;
+}
+
+const ajv = criarAjv();
+const cache = new Map<string, ValidateFunction>();
+
+function validador(nome: SchemaName, def?: string): ValidateFunction {
+  const chave = def === undefined ? nome : `${nome}#${def}`;
+  let v = cache.get(chave);
+  if (v === undefined) {
+    const ref = def === undefined ? nome : `${nome}#/$defs/${def}`;
+    const encontrado = ajv.getSchema(ref);
+    if (encontrado === undefined) throw new Error(`schema ou definicao inexistente: ${ref}`);
+    v = encontrado;
+    cache.set(chave, v);
+  }
+  return v;
+}
+
+/**
+ * Valida `dado` contra o schema `nome` (ou contra `$defs/<def>` dele). Rejeita campos extras,
+ * tipos errados e formatos invalidos conforme o JSON Schema 2020-12 do pacote.
+ */
+export function validate(nome: SchemaName, dado: unknown, def?: string): ValidationResult {
+  const v = validador(nome, def);
+  if (v(dado)) return { valid: true };
+  return {
+    valid: false,
+    issues: (v.errors ?? []).map((e) => ({
+      path: e.instancePath,
+      keyword: e.keyword,
+      message: e.message ?? "",
+    })),
+  };
+}
+
+export class ContractViolationError extends Error {
+  constructor(
+    readonly schema: SchemaName,
+    readonly issues: ValidationIssue[],
+  ) {
+    super(
+      `violacao do contrato ${schema}: ${issues.map((i) => `${i.path || "/"} ${i.message}`).join("; ")}`,
+    );
+    this.name = "ContractViolationError";
+  }
+}
+
+/** Valida e lanca ContractViolationError se invalido; o chamador tipa o dado com os tipos gerados. */
+export function assertValid(nome: SchemaName, dado: unknown, def?: string): void {
+  const r = validate(nome, dado, def);
+  if (!r.valid) throw new ContractViolationError(nome, r.issues);
+}
diff --git a/packages/sdk/src/index.test.ts b/packages/sdk/src/index.test.ts
index 250764a..6c8a264 100644
--- a/packages/sdk/src/index.test.ts
+++ b/packages/sdk/src/index.test.ts
@@ -1,6 +1,6 @@
 import assert from "node:assert/strict";
 import { test } from "node:test";
-import { checkHealth } from "./index.js";
+import { ApiError, checkHealth, createControlPlaneClient } from "./index.js";
 
 test("checkHealth le a resposta de /healthz", async () => {
   const fake = (async (url: URL | string) => {
@@ -17,3 +17,38 @@ test("checkHealth falha quando HTTP nao e 2xx", async () => {
   const fake = (async () => new Response("x", { status: 503 })) as unknown as typeof fetch;
   await assert.rejects(checkHealth("http://127.0.0.1:1", fake));
 });
+
+test("cliente tipado: erro com ProblemDetails valido preserva o problema", async () => {
+  const fake = (async () =>
+    new Response(JSON.stringify({ type: "about:blank", title: "Indisponivel", status: 503 }), {
+      status: 503,
+      headers: { "content-type": "application/problem+json" },
+    })) as unknown as typeof fetch;
+  await assert.rejects(createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(), (e) => {
+    assert.ok(e instanceof ApiError);
+    assert.equal(e.status, 503);
+    assert.equal(e.problem?.title, "Indisponivel");
+    return true;
+  });
+});
+
+test("cliente tipado: corpo de erro fora do contrato nao vira problem", async () => {
+  const fake = (async () =>
+    Response.json(
+      { type: "about:blank", title: "x", status: 200, stack: "at x" },
+      { status: 500 },
+    )) as unknown as typeof fetch;
+  await assert.rejects(createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(), (e) => {
+    assert.ok(e instanceof ApiError);
+    assert.equal(e.problem, undefined);
+    return true;
+  });
+});
+
+test("cliente tipado: 200 fora do contrato e rejeitado", async () => {
+  const fake = (async () => Response.json({ status: "degraded" })) as unknown as typeof fetch;
+  await assert.rejects(
+    createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(),
+    /fora do contrato/,
+  );
+});
diff --git a/packages/sdk/src/index.ts b/packages/sdk/src/index.ts
index 3624770..f5bb0a7 100644
--- a/packages/sdk/src/index.ts
+++ b/packages/sdk/src/index.ts
@@ -1,13 +1,57 @@
-import { HEALTH_PATH, type HealthResponse } from "@nucleos/contracts";
+import { HEALTH_PATH, validate, type ProblemDetails } from "@nucleos/contracts";
+import type { paths } from "./generated/control-plane.js";
+
+/** Corpo 200 de GET /healthz, tipado a partir do OpenAPI (packages/contracts/openapi). */
+export type HealthResponse =
+  paths["/healthz"]["get"]["responses"][200]["content"]["application/json"];
+
+/** Erro de uma chamada ao Control Plane; `problem` presente quando o corpo era um ProblemDetails valido. */
+export class ApiError extends Error {
+  constructor(
+    message: string,
+    readonly status: number,
+    readonly problem?: ProblemDetails,
+  ) {
+    super(message);
+    this.name = "ApiError";
+  }
+}
+
+async function lerProblema(res: Response): Promise<ProblemDetails | undefined> {
+  try {
+    const corpo: unknown = await res.json();
+    return validate("problem-details", corpo).valid ? (corpo as ProblemDetails) : undefined;
+  } catch {
+    return undefined;
+  }
+}
+
+/** Cliente tipado do Control Plane. Cada metodo corresponde a uma operacao do OpenAPI. */
+export function createControlPlaneClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
+  return {
+    async getHealth(): Promise<HealthResponse> {
+      const res = await fetchImpl(new URL(HEALTH_PATH, baseUrl));
+      if (!res.ok) {
+        const problem = await lerProblema(res);
+        throw new ApiError(
+          problem?.title ?? `healthz falhou: HTTP ${String(res.status)}`,
+          res.status,
+          problem,
+        );
+      }
+      const corpo = (await res.json()) as Partial<HealthResponse>;
+      if (corpo.status !== "ok" || typeof corpo.service !== "string" || corpo.service === "") {
+        throw new ApiError("healthz: resposta fora do contrato", res.status);
+      }
+      return { status: corpo.status, service: corpo.service };
+    },
+  };
+}
 
 /** Cliente minimo: consulta /healthz de um componente. Sem logica de negocio. */
 export async function checkHealth(
   baseUrl: string,
   fetchImpl: typeof fetch = fetch,
 ): Promise<HealthResponse> {
-  const res = await fetchImpl(new URL(HEALTH_PATH, baseUrl));
-  if (!res.ok) {
-    throw new Error(`healthz falhou: HTTP ${res.status}`);
-  }
-  return (await res.json()) as HealthResponse;
+  return createControlPlaneClient(baseUrl, fetchImpl).getHealth();
 }
diff --git a/pyproject.toml b/pyproject.toml
index 7dd26e1..dcbd7d1 100644
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -7,6 +7,7 @@ dependencies = []
 
 [dependency-groups]
 dev = [
+    "datamodel-code-generator==0.83.0",
     "import-linter==2.15",
     "mypy==2.4.0",
     "pytest==9.0.3",
@@ -18,17 +19,20 @@ dev = [
 package = false
 
 [tool.uv.workspace]
-members = ["services/*", "packages/observability-py"]
+members = ["services/*", "packages/observability-py", "packages/contracts-py"]
 
 [tool.pytest.ini_options]
-testpaths = ["services", "packages/observability-py"]
+testpaths = ["services", "packages/observability-py", "packages/contracts-py"]
 addopts = "--import-mode=importlib"
 
 # --- Qualidade Python (ENT-FND-002) ---
 [tool.ruff]
 line-length = 100
 target-version = "py312"
-extend-exclude = ["tools/qualidade/regressao"]
+extend-exclude = [
+  "tools/qualidade/regressao",
+  "packages/contracts-py/src/nucleos_contracts/models", # gerado por make contracts-gen
+]
 
 [tool.ruff.lint]
 # E/F pycodestyle+pyflakes, I imports, B bugbear, UP pyupgrade, S bandit (inclui eval/exec),
diff --git a/scripts/ci/contracts-drift.sh b/scripts/ci/contracts-drift.sh
index 8229432..b452874 100755
--- a/scripts/ci/contracts-drift.sh
+++ b/scripts/ci/contracts-drift.sh
@@ -1,19 +1,20 @@
 #!/usr/bin/env bash
-# Job contracts-drift (ENT-FND-005): falha se o codigo gerado a partir de packages/contracts
-# estiver defasado. O alvo `make contracts-check` pertence a FND-003 (ainda nao entregue).
-# Enquanto o alvo nao existir, o job emite aviso explicito (nao silencia) e passa; quando FND-003
-# for integrada o job passa a bloquear sem mudar o workflow.
+# Job contracts-drift (ENT-FND-005 + ENT-FND-003): falha se o codigo gerado a partir de packages/contracts
+# estiver defasado. `make contracts-check` (FND-003) regenera TS/SDK/Pydantic em diretorio temporario e
+# compara com o versionado, e roda o teste de compatibilidade contra o baseline; aqui ha uma segunda
+# barreira: apos o alvo, a arvore de packages/ nao pode ter nenhuma mudanca nem arquivo novo.
+# O alvo AUSENTE e erro (o gate nao pode voltar a ser inativo em silencio).
 set -euo pipefail
 # CONTRACTS_DRIFT_RAIZ permite testar o script em um repositorio descartavel (regressao-ci).
 cd "${CONTRACTS_DRIFT_RAIZ:-$(dirname "$0")/../..}"
-if make -n contracts-check >/dev/null 2>&1; then
-  make contracts-check
-  # porcelain cobre modificados E arquivos novos nao rastreados (git diff nao veria estes).
-  if [ -n "$(git status --porcelain -- packages/)" ]; then
-    git status --porcelain -- packages/ >&2
-    echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
-    exit 1
-  fi
-else
-  echo "::warning title=contracts-drift::alvo 'make contracts-check' ausente (ENT-FND-003 pendente); gate inativo"
+if ! make -n contracts-check >/dev/null 2>&1; then
+  echo "ERRO: alvo 'make contracts-check' ausente; o gate contracts-drift exige o alvo (ENT-FND-003)" >&2
+  exit 1
+fi
+make contracts-check
+# porcelain cobre modificados E arquivos novos nao rastreados (git diff nao veria estes).
+if [ -n "$(git status --porcelain -- packages/)" ]; then
+  git status --porcelain -- packages/ >&2
+  echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
+  exit 1
 fi
diff --git a/tools/qualidade/regressao-ci.mjs b/tools/qualidade/regressao-ci.mjs
index 2eda44a..85c6de1 100644
--- a/tools/qualidade/regressao-ci.mjs
+++ b/tools/qualidade/regressao-ci.mjs
@@ -101,7 +101,11 @@ try {
     rmSync(tmp, { recursive: true, force: true });
     mkdirSync(join(tmp, "packages"), { recursive: true });
     writeFileSync(join(tmp, "packages", "base.txt"), "x\n");
-    writeFileSync(join(tmp, "Makefile"), `contracts-check:\n\t${gerador}\n`);
+    // gerador === null: Makefile SEM o alvo contracts-check (gate nao pode ficar inativo em silencio).
+    writeFileSync(
+      join(tmp, "Makefile"),
+      gerador === null ? "outro:\n\ttrue\n" : `contracts-check:\n\t${gerador}\n`,
+    );
     sh(["init", "-q"]);
     sh(["add", "-A"]);
     sh(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base"]);
@@ -116,6 +120,8 @@ try {
   deveFalhar("contracts-drift detecta arquivo novo", drift(), "drift");
   preparar("echo y > packages/base.txt");
   deveFalhar("contracts-drift detecta arquivo modificado", drift(), "drift");
+  preparar(null);
+  deveFalhar("contracts-drift falha quando o alvo contracts-check some", drift(), "ausente");
   preparar("true");
   deveSer("contracts-drift passa sem alteracao", drift().status === 0);
 } finally {
```
