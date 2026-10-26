# FND-002 — diffs

Complemento de [o documento da entrega](2026-10-25-fnd-002-padroes-qualidade-linters-hooks.md). Diff staged da arvore de trabalho (sem os proprios arquivos de documentacoes/; lockfiles resumidos por hash).

````diff
diff --git a/.dependency-cruiser.cjs b/.dependency-cruiser.cjs
new file mode 100644
index 0000000..78afd39
--- /dev/null
+++ b/.dependency-cruiser.cjs
@@ -0,0 +1,62 @@
+/** Regras de arquitetura de imports (ENT-FND-002). Executar: pnpm run lint:arch */
+/** @type {import('dependency-cruiser').IConfiguration} */
+module.exports = {
+  forbidden: [
+    {
+      name: "web-nao-importa-api",
+      comment: "apps/web nao pode importar de apps/api (acoplamento so via packages/contracts).",
+      severity: "error",
+      from: { path: "^apps/web/" },
+      to: { path: "^apps/api/" },
+    },
+    {
+      name: "api-nao-importa-web",
+      comment: "apps/api nao pode importar de apps/web.",
+      severity: "error",
+      from: { path: "^apps/api/" },
+      to: { path: "^apps/web/" },
+    },
+    {
+      name: "apps-nao-importam-outros-apps",
+      comment: "Apps so compartilham codigo via packages/contracts (ou packages/sdk).",
+      severity: "error",
+      from: { path: "^apps/([^/]+)/" },
+      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
+    },
+    {
+      name: "contracts-nao-depende-de-apps",
+      comment: "packages/contracts e folha: nao importa apps nem outros packages.",
+      severity: "error",
+      from: { path: "^packages/contracts/" },
+      to: { path: "^(apps|packages/(?!contracts/))" },
+    },
+    {
+      name: "packages-nao-importam-apps",
+      comment: "Pacotes compartilhados nunca dependem de aplicacoes.",
+      severity: "error",
+      from: { path: "^packages/" },
+      to: { path: "^apps/" },
+    },
+    {
+      name: "provisioner-so-no-tenant-provisioner",
+      comment:
+        "SDK/codigo do provisioner nao e importado por outros apps (ver tenant-runtime em Python).",
+      severity: "error",
+      from: { path: "^apps/(?!tenant-provisioner/)" },
+      to: { path: "^apps/tenant-provisioner/" },
+    },
+    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
+  ],
+  options: {
+    doNotFollow: { path: "node_modules" },
+    exclude: { path: "(^|/)(dist|\\.next|\\.turbo|node_modules)/|\\.d\\.ts$" },
+    tsConfig: { fileName: "tsconfig.base.json" },
+    tsPreCompilationDeps: true,
+    enhancedResolveOptions: {
+      exportsFields: ["exports"],
+      conditionNames: ["import", "require", "node", "default", "types"],
+      extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
+    },
+    moduleSystems: ["es6", "cjs"],
+  },
+};
diff --git a/.gitleaks.toml b/.gitleaks.toml
new file mode 100644
index 0000000..bcdd6b0
--- /dev/null
+++ b/.gitleaks.toml
@@ -0,0 +1,7 @@
+# Configuracao do gitleaks (ENT-FND-002): regras padrao + allowlist minima.
+[extend]
+useDefault = true
+
+[allowlist]
+description = "Somente exemplos documentados sem valor real"
+paths = ['''(^|/)\.env\.example$''', '''pnpm-lock\.yaml$''', '''uv\.lock$''']
diff --git a/.importlinter b/.importlinter
new file mode 100644
index 0000000..6580389
--- /dev/null
+++ b/.importlinter
@@ -0,0 +1,26 @@
+# Regras de arquitetura de imports Python (ENT-FND-002). Executar: lint-imports
+[importlinter]
+root_packages =
+    ai_gateway
+    tool_gateway
+    event_dispatcher
+    tenant_runtime
+include_external_packages = True
+
+[importlinter:contract:servicos-independentes]
+name = Servicos Python nao importam uns aos outros
+type = independence
+modules =
+    ai_gateway
+    tool_gateway
+    event_dispatcher
+    tenant_runtime
+
+[importlinter:contract:tenant-runtime-sem-sdk-provisioner]
+name = tenant-runtime nao importa o SDK do provisioner
+type = forbidden
+source_modules =
+    tenant_runtime
+forbidden_modules =
+    tenant_provisioner
+    nucleos_provisioner
diff --git a/.prettierignore b/.prettierignore
new file mode 100644
index 0000000..28c4f84
--- /dev/null
+++ b/.prettierignore
@@ -0,0 +1,16 @@
+# Prettier cobre so codigo e configuracao (ts/tsx/mjs/json/yaml); Markdown e docs ficam fora.
+**/dist/
+**/.next/
+**/.turbo/
+**/node_modules/
+.run/
+**/next-env.d.ts
+pnpm-lock.yaml
+uv.lock
+tools/qualidade/regressao/
+skills/
+.claude/
+.agents/
+.agent/
+documentacoes/
+lessons/
diff --git a/.prettierrc.json b/.prettierrc.json
new file mode 100644
index 0000000..803f2db
--- /dev/null
+++ b/.prettierrc.json
@@ -0,0 +1,6 @@
+{
+  "printWidth": 100,
+  "singleQuote": false,
+  "trailingComma": "all",
+  "endOfLine": "lf"
+}
diff --git a/Makefile b/Makefile
index 82dab1d..0242798 100644
--- a/Makefile
+++ b/Makefile
@@ -10,7 +10,7 @@ export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
 export TURBO_TELEMETRY_DISABLED=1
 export DO_NOT_TRACK=1
 
-.PHONY: setup lint test build up down health check-env
+.PHONY: setup lint test build up down health check-env lint-regressao format hooks
 
 setup:
 	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
@@ -21,6 +21,26 @@ setup:
 lint: check-env
 	$(PNPM) run lint
 	$(UV) run --frozen python -m compileall -q services
+	$(PNPM) run lint:quality
+	$(UV) lock --check
+	$(UV) run --frozen ruff check services
+	$(UV) run --frozen ruff format --check services
+	$(UV) run --frozen mypy
+	$(UV) run --frozen lint-imports
+	./scripts/check-secrets.sh
+	$(MAKE) lint-regressao
+
+# Casos que DEVEM falhar (regressao dos proprios linters); ver tools/qualidade/regressao/.
+lint-regressao:
+	node tools/qualidade/regressao.mjs
+
+format:
+	$(PNPM) run format
+	$(UV) run --frozen ruff format services
+
+# Instala os hooks do lefthook no .git (explicito: o diretorio de hooks e compartilhado por worktrees).
+hooks:
+	$(PNPM) exec lefthook install
 
 test: check-env
 	$(PNPM) run test
diff --git a/README.md b/README.md
index 574ebfe..fd6a818 100644
--- a/README.md
+++ b/README.md
@@ -3,6 +3,10 @@
 Especificação e documentação do projeto: [Nucleos-Especificacao-Mestra.md](Nucleos-Especificacao-Mestra.md)
 e [documentacoes/](documentacoes/). Regras para agentes de IA: [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md).
 
+## Convencoes de engenharia
+
+Lint, formatacao, hooks, commits e branches: [documentacoes/engenharia/convencoes-commits-e-branches.md](documentacoes/engenharia/convencoes-commits-e-branches.md). Comandos: `make lint`, `make format`, `make hooks`.
+
 ## Skills de IA (Claude Code, Codex e Antigravity)
 
 As skills do fluxo de desenvolvimento (planejamento, implementação, review, QA e
diff --git a/apps/api/src/health.test.ts b/apps/api/src/health.test.ts
index 799b710..232c0c4 100644
--- a/apps/api/src/health.test.ts
+++ b/apps/api/src/health.test.ts
@@ -1,6 +1,5 @@
 import "reflect-metadata";
 import assert from "node:assert/strict";
-import type { AddressInfo } from "node:net";
 import { test } from "node:test";
 import { NestFactory } from "@nestjs/core";
 import { AppModule } from "./app.module.js";
@@ -9,8 +8,7 @@ test("GET /healthz responde 200 ok", async () => {
   const app = await NestFactory.create(AppModule, { logger: false });
   await app.listen(0, "127.0.0.1");
   try {
-    const { port } = app.getHttpServer().address() as AddressInfo;
-    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
+    const res = await fetch(`${await app.getUrl()}/healthz`);
     assert.equal(res.status, 200);
     assert.deepEqual(await res.json(), { status: "ok", service: "api" });
   } finally {
diff --git a/eslint.config.mjs b/eslint.config.mjs
new file mode 100644
index 0000000..df04800
--- /dev/null
+++ b/eslint.config.mjs
@@ -0,0 +1,79 @@
+// ESLint (flat config) com regras type-aware. Ver documentacoes/engenharia (FND-002).
+import js from "@eslint/js";
+import security from "eslint-plugin-security";
+import tseslint from "typescript-eslint";
+
+// O runner de regressao (tools/qualidade/regressao.mjs) liga esta variavel para lintar os
+// arquivos que DEVEM falhar; no uso normal eles ficam ignorados.
+const regressao = process.env.NUCLEOS_LINT_REGRESSAO === "1";
+
+export default tseslint.config(
+  {
+    ignores: [
+      "**/dist/**",
+      "**/.next/**",
+      "**/.turbo/**",
+      "**/.run/**",
+      "**/node_modules/**",
+      "**/next-env.d.ts", // gerado pelo Next.js (REVIEW-004): versionado, nao linta
+      ...(regressao ? [] : ["tools/qualidade/regressao/**"]), // fixtures que DEVEM falhar
+      "skills/**",
+      ".claude/**",
+      ".agents/**",
+      ".agent/**",
+    ],
+  },
+  {
+    files: [
+      "apps/**/*.{ts,tsx}",
+      "packages/**/*.ts",
+      ...(regressao ? ["tools/qualidade/regressao/ts/*.ts"] : []),
+    ],
+    extends: [
+      js.configs.recommended,
+      tseslint.configs.strictTypeChecked,
+      security.configs.recommended,
+    ],
+    languageOptions: {
+      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
+    },
+    rules: {
+      // Proibe any explicito e todo fluxo de any (implicito ou vindo de libs).
+      "@typescript-eslint/no-explicit-any": "error",
+      "@typescript-eslint/no-unsafe-assignment": "error",
+      "@typescript-eslint/no-unsafe-argument": "error",
+      "@typescript-eslint/no-unsafe-call": "error",
+      "@typescript-eslint/no-unsafe-member-access": "error",
+      "@typescript-eslint/no-unsafe-return": "error",
+      // Proibe eval / new Function / setTimeout(string) e equivalentes.
+      "no-eval": "error",
+      "no-new-func": "error",
+      "no-implied-eval": "off",
+      "@typescript-eslint/no-implied-eval": "error",
+      "@typescript-eslint/consistent-type-imports": "error",
+      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
+      // node:test devolve Promise nos registros de teste; nao e promessa esquecida.
+      "@typescript-eslint/no-floating-promises": [
+        "error",
+        {
+          allowForKnownSafeCalls: [
+            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
+          ],
+        },
+      ],
+    },
+  },
+  {
+    // Controllers/modulos NestJS usam decorators e classes sem estado por design.
+    files: ["apps/api/**/*.ts"],
+    rules: { "@typescript-eslint/no-extraneous-class": "off" },
+  },
+  {
+    // Testes indexam objetos de fixtures conhecidos; a regra gera ruido sem risco real.
+    files: ["**/*.test.ts"],
+    rules: {
+      "security/detect-object-injection": "off",
+      "@typescript-eslint/require-await": "off",
+    },
+  },
+);
diff --git a/lefthook.yml b/lefthook.yml
new file mode 100644
index 0000000..30f6b7e
--- /dev/null
+++ b/lefthook.yml
@@ -0,0 +1,24 @@
+# Hooks locais (ENT-FND-002). Hook NAO e controle de seguranca: os mesmos checks repetem no CI
+# (FND-005). Instalar com `make hooks`. Ignorar com LEFTHOOK=0 so em emergencia (registre no PR).
+pre-commit:
+  parallel: false
+  commands:
+    branch-name:
+      run: scripts/check-branch-name.sh
+    segredos:
+      run: scripts/check-secrets.sh --staged
+    prettier:
+      glob: "*.{ts,tsx,mjs,cjs,yml}"
+      exclude: 'tools/qualidade/regressao/|next-env\.d\.ts'
+      run: pnpm exec prettier --check --no-error-on-unmatched-pattern {staged_files}
+    eslint:
+      glob: "{apps,packages}/**/*.{ts,tsx}"
+      exclude: 'next-env\.d\.ts'
+      run: pnpm exec eslint --no-warn-ignored {staged_files}
+    ruff:
+      glob: "services/**/*.py"
+      run: uv run --frozen ruff check {staged_files} && uv run --frozen ruff format --check {staged_files}
+commit-msg:
+  commands:
+    mensagem:
+      run: node scripts/check-commit-msg.mjs {1}
diff --git a/package.json b/package.json
index 3d0611e..36923c9 100644
--- a/package.json
+++ b/package.json
@@ -11,11 +11,23 @@
   "scripts": {
     "build": "turbo run build",
     "lint": "turbo run lint",
-    "test": "turbo run test"
+    "test": "turbo run test",
+    "lint:eslint": "turbo run build --filter=\"./packages/*\" && eslint .",
+    "lint:arch": "depcruise apps packages --config .dependency-cruiser.cjs",
+    "format:check": "prettier --check --no-error-on-unmatched-pattern \\\"apps/**/*.{ts,tsx,mjs}\\\" \\\"packages/**/*.ts\\\" \\\"tools/**/*.{mjs,cjs}\\\" \\\"*.{mjs,cjs}\\\" lefthook.yml",
+    "format": "prettier --write --no-error-on-unmatched-pattern \\\"apps/**/*.{ts,tsx,mjs}\\\" \\\"packages/**/*.ts\\\" \\\"tools/**/*.{mjs,cjs}\\\" \\\"*.{mjs,cjs}\\\" lefthook.yml",
+    "lint:quality": "pnpm run lint:eslint && pnpm run lint:arch && pnpm run format:check"
   },
   "devDependencies": {
+    "@eslint/js": "10.0.1",
+    "@types/node": "24.19.2",
+    "dependency-cruiser": "18.7.0",
+    "eslint": "10.13.0",
+    "eslint-plugin-security": "4.2.0",
+    "lefthook": "2.2.2",
+    "prettier": "3.9.10",
     "turbo": "2.11.10",
     "typescript": "5.9.3",
-    "@types/node": "24.19.2"
+    "typescript-eslint": "8.72.0"
   }
 }
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
index 3ff5faa..e9bb34e 100644
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@ -1,3 +1,13 @@
 packages:
   - "apps/*"
   - "packages/*"
+
+# Politica de supply chain (FND-002, REVIEW-002). Semantica verificada no pnpm 12.15.0:
+# - scripts de instalacao de dependencias sao NEGADOS por padrao e uma dependencia nao
+#   aprovada faz o install falhar (ERR_PNPM_IGNORED_BUILDS); allowBuilds e a allowlist
+#   explicita (nome: true|false). Vazia = nenhum pacote executa script no install.
+# - minimumReleaseAge e em MINUTOS: versoes publicadas ha menos tempo que isso nao sao
+#   resolvidas (ERR_PNPM_NO_MATURE_MATCHING_VERSION), exceto em minimumReleaseAgeExclude.
+allowBuilds:
+  lefthook: false
+minimumReleaseAge: 1440
diff --git a/pyproject.toml b/pyproject.toml
index 8653c62..e7762f0 100644
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -6,7 +6,13 @@ requires-python = ">=3.12"
 dependencies = []
 
 [dependency-groups]
-dev = ["pytest==9.0.3"]
+dev = [
+    "import-linter==2.15",
+    "mypy==2.4.0",
+    "pytest==9.0.3",
+    "pytest-asyncio==1.4.0",
+    "ruff==0.17.2",
+]
 
 [tool.uv]
 package = false
@@ -17,3 +23,33 @@ members = ["services/*"]
 [tool.pytest.ini_options]
 testpaths = ["services"]
 addopts = "--import-mode=importlib"
+
+# --- Qualidade Python (ENT-FND-002) ---
+[tool.ruff]
+line-length = 100
+target-version = "py312"
+extend-exclude = ["tools/qualidade/regressao"]
+
+[tool.ruff.lint]
+# E/F pycodestyle+pyflakes, I imports, B bugbear, UP pyupgrade, S bandit (inclui eval/exec),
+# ASYNC, SIM, C4, PT pytest-style, RUF.
+select = ["E", "F", "I", "B", "UP", "S", "ASYNC", "SIM", "C4", "PT", "RUF"]
+
+[tool.ruff.lint.per-file-ignores]
+"**/tests/**" = ["S101"]
+
+[tool.mypy]
+# Pacotes de politica: tipagem estrita obrigatoria. Demais servicos entram quando ganharem logica.
+strict = true
+python_version = "3.12"
+explicit_package_bases = true
+mypy_path = [
+  "services/tool-gateway/src",
+  "services/event-dispatcher/src",
+  "services/tenant-runtime/src",
+]
+files = [
+  "services/tool-gateway/src",
+  "services/event-dispatcher/src",
+  "services/tenant-runtime/src/tenant_runtime/policy",
+]
diff --git a/scripts/check-branch-name.sh b/scripts/check-branch-name.sh
new file mode 100755
index 0000000..2f9d2ee
--- /dev/null
+++ b/scripts/check-branch-name.sh
@@ -0,0 +1,11 @@
+#!/usr/bin/env bash
+# Valida o nome da branch atual (ver documentacoes/engenharia/convencoes-commits-e-branches.md).
+set -euo pipefail
+branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
+if [ "$branch" = "HEAD" ]; then exit 0; fi # HEAD destacado (rebase, CI)
+if [[ "$branch" =~ ^(main|developer|tarefa/[a-z0-9][a-z0-9-]*|revisao/[a-z0-9][a-z0-9._-]*|hotfix/[a-z0-9][a-z0-9-]*)$ ]]; then
+  exit 0
+fi
+echo "ERRO: nome de branch invalido: $branch" >&2
+echo "Permitidos: main, developer, tarefa/<id-em-kebab>, revisao/<lote>, hotfix/<slug>" >&2
+exit 1
diff --git a/scripts/check-commit-msg.mjs b/scripts/check-commit-msg.mjs
new file mode 100644
index 0000000..c08b75d
--- /dev/null
+++ b/scripts/check-commit-msg.mjs
@@ -0,0 +1,40 @@
+#!/usr/bin/env node
+// Valida a mensagem de commit (Conventional Commits em portugues). Uso: arquivo como arg 1.
+import { readFileSync } from "node:fs";
+
+export const TIPOS = [
+  "feat",
+  "fix",
+  "docs",
+  "style",
+  "refactor",
+  "perf",
+  "test",
+  "build",
+  "ci",
+  "chore",
+  "revert",
+  "merge",
+];
+const PADRAO = new RegExp(`^(${TIPOS.join("|")})(\\([a-z0-9._-]+\\))?!?: \\S.{0,98}$`);
+
+export function validar(mensagem) {
+  const linha = mensagem.split("\n")[0] ?? "";
+  if (/^(Merge |Revert ")/.test(linha) || /^fixup! |^squash! /.test(linha)) return true;
+  return PADRAO.test(linha);
+}
+
+if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
+  const arquivo = process.argv[2];
+  if (!arquivo) {
+    console.error("uso: check-commit-msg.mjs <arquivo-da-mensagem>");
+    process.exit(2);
+  }
+  if (!validar(readFileSync(arquivo, "utf8"))) {
+    console.error(
+      "ERRO: mensagem de commit invalida. Use '<tipo>(escopo opcional): resumo' (ate 100 colunas).\n" +
+        `Tipos: ${TIPOS.join(", ")}. Ver documentacoes/engenharia/convencoes-commits-e-branches.md`,
+    );
+    process.exit(1);
+  }
+}
diff --git a/scripts/check-secrets.sh b/scripts/check-secrets.sh
new file mode 100755
index 0000000..05bcaea
--- /dev/null
+++ b/scripts/check-secrets.sh
@@ -0,0 +1,18 @@
+#!/usr/bin/env bash
+# Varredura de segredos (gitleaks) na arvore de trabalho: arquivos versionados e nao
+# ignorados. Falha fechado se o gitleaks nao estiver instalado.
+# Uso: scripts/check-secrets.sh            (arvore inteira)
+#      scripts/check-secrets.sh --staged   (somente o index; usado pelo hook pre-commit)
+set -euo pipefail
+cd "$(dirname "$0")/.."
+if ! command -v gitleaks >/dev/null 2>&1; then
+  echo "ERRO: gitleaks nao encontrado no PATH (ver documentacoes/engenharia/ para instalar)" >&2
+  exit 2
+fi
+if [ "${1:-}" = "--staged" ]; then
+  exec gitleaks git --pre-commit --staged --config .gitleaks.toml --redact --no-banner
+fi
+tmp="$(mktemp -d)"
+trap 'rm -rf "$tmp"' EXIT
+git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf - 2>/dev/null | tar -xf - -C "$tmp"
+gitleaks dir "$tmp" --config .gitleaks.toml --redact --no-banner
diff --git a/services/ai-gateway/tests/test_health.py b/services/ai-gateway/tests/test_health.py
index c4e209a..ec8dd09 100644
--- a/services/ai-gateway/tests/test_health.py
+++ b/services/ai-gateway/tests/test_health.py
@@ -3,6 +3,7 @@ import threading
 import urllib.error
 import urllib.request
 
+import pytest
 from ai_gateway.app import make_server
 
 
@@ -15,11 +16,9 @@ def test_healthz() -> None:
         with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "ai-gateway"}
-        try:
+        with pytest.raises(urllib.error.HTTPError) as excinfo:
             urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
-            raise AssertionError("esperava 404")
-        except urllib.error.HTTPError as err:
-            assert err.code == 404
+        assert excinfo.value.code == 404
     finally:
         server.shutdown()
         server.server_close()
diff --git a/services/event-dispatcher/tests/test_health.py b/services/event-dispatcher/tests/test_health.py
index 9763a2d..7d50e6f 100644
--- a/services/event-dispatcher/tests/test_health.py
+++ b/services/event-dispatcher/tests/test_health.py
@@ -3,6 +3,7 @@ import threading
 import urllib.error
 import urllib.request
 
+import pytest
 from event_dispatcher.app import make_server
 
 
@@ -15,11 +16,9 @@ def test_healthz() -> None:
         with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "event-dispatcher"}
-        try:
+        with pytest.raises(urllib.error.HTTPError) as excinfo:
             urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
-            raise AssertionError("esperava 404")
-        except urllib.error.HTTPError as err:
-            assert err.code == 404
+        assert excinfo.value.code == 404
     finally:
         server.shutdown()
         server.server_close()
diff --git a/services/tenant-runtime/src/tenant_runtime/policy/__init__.py b/services/tenant-runtime/src/tenant_runtime/policy/__init__.py
new file mode 100644
index 0000000..2cf91fe
--- /dev/null
+++ b/services/tenant-runtime/src/tenant_runtime/policy/__init__.py
@@ -0,0 +1 @@
+"""Pacote de politica do tenant-runtime (tipagem estrita via mypy --strict; sem logica ainda)."""
diff --git a/services/tenant-runtime/tests/test_health.py b/services/tenant-runtime/tests/test_health.py
index 68022d5..0cac59e 100644
--- a/services/tenant-runtime/tests/test_health.py
+++ b/services/tenant-runtime/tests/test_health.py
@@ -3,6 +3,7 @@ import threading
 import urllib.error
 import urllib.request
 
+import pytest
 from tenant_runtime.app import make_server
 
 
@@ -15,11 +16,9 @@ def test_healthz() -> None:
         with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "tenant-runtime"}
-        try:
+        with pytest.raises(urllib.error.HTTPError) as excinfo:
             urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
-            raise AssertionError("esperava 404")
-        except urllib.error.HTTPError as err:
-            assert err.code == 404
+        assert excinfo.value.code == 404
     finally:
         server.shutdown()
         server.server_close()
diff --git a/services/tool-gateway/tests/test_health.py b/services/tool-gateway/tests/test_health.py
index dfe4162..9ef54c5 100644
--- a/services/tool-gateway/tests/test_health.py
+++ b/services/tool-gateway/tests/test_health.py
@@ -3,6 +3,7 @@ import threading
 import urllib.error
 import urllib.request
 
+import pytest
 from tool_gateway.app import make_server
 
 
@@ -15,11 +16,9 @@ def test_healthz() -> None:
         with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "tool-gateway"}
-        try:
+        with pytest.raises(urllib.error.HTTPError) as excinfo:
             urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
-            raise AssertionError("esperava 404")
-        except urllib.error.HTTPError as err:
-            assert err.code == 404
+        assert excinfo.value.code == 404
     finally:
         server.shutdown()
         server.server_close()
diff --git a/tools/qualidade/regressao.mjs b/tools/qualidade/regressao.mjs
new file mode 100644
index 0000000..686e2ba
--- /dev/null
+++ b/tools/qualidade/regressao.mjs
@@ -0,0 +1,145 @@
+#!/usr/bin/env node
+// Runner de regressao dos controles de qualidade (ENT-FND-002): cada caso DEVE falhar.
+// Se algum controle deixar de pegar sua violacao, este script sai com codigo 1.
+import { spawnSync } from "node:child_process";
+import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { randomBytes } from "node:crypto";
+import { tmpdir } from "node:os";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { validar } from "../../scripts/check-commit-msg.mjs";
+
+const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
+const reg = join(raiz, "tools", "qualidade", "regressao");
+const falhas = [];
+const tmpRaiz = mkdtempSync(join(tmpdir(), "nucleos-regressao-"));
+
+function exec(cmd, args, opts = {}) {
+  return spawnSync(cmd, args, { cwd: raiz, encoding: "utf8", ...opts });
+}
+function deveFalhar(nome, resultado, trecho) {
+  const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
+  const ok = resultado.status !== 0 && resultado.status !== null && saida.includes(trecho);
+  console.log(`${ok ? "OK   " : "FALHA"} ${nome} (esperado: falhar com "${trecho}")`);
+  if (!ok) falhas.push(`${nome}\n${saida.slice(0, 800)}`);
+}
+function deveSer(nome, condicao) {
+  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}`);
+  if (!condicao) falhas.push(nome);
+}
+
+try {
+  // 1) ESLint type-aware + seguranca: uma regra esperada por fixture.
+  const eslintCasos = {
+    "any-explicito.ts": "@typescript-eslint/no-explicit-any",
+    "any-fluxo.ts": "@typescript-eslint/no-unsafe-member-access",
+    "eval.ts": "no-eval",
+    "new-function.ts": "no-new-func",
+  };
+  for (const [arq, regra] of Object.entries(eslintCasos)) {
+    const r = exec("pnpm", ["exec", "eslint", `tools/qualidade/regressao/ts/${arq}`], {
+      env: { ...process.env, NUCLEOS_LINT_REGRESSAO: "1" },
+    });
+    deveFalhar(`eslint ${arq}`, r, regra);
+  }
+  // 2) any implicito: tsc strict (noImplicitAny).
+  deveFalhar(
+    "tsc any-implicito.ts",
+    exec("pnpm", ["exec", "tsc", "-p", "tools/qualidade/regressao/tsconfig.json"]),
+    "TS7006",
+  );
+
+  // 3) dependency-cruiser em arvore virtual copiada para tmp.
+  const arq = join(tmpRaiz, "arq");
+  mkdirSync(arq);
+  cpSync(join(reg, "arquitetura"), arq, { recursive: true });
+  cpSync(join(raiz, "tsconfig.base.json"), join(arq, "tsconfig.base.json"));
+  const dep = exec(
+    join(raiz, "node_modules", ".bin", "depcruise"),
+    ["apps", "packages", "--config", join(raiz, ".dependency-cruiser.cjs"), "--output-type", "err"],
+    { cwd: arq },
+  );
+  for (const regra of [
+    "web-nao-importa-api",
+    "api-nao-importa-web",
+    "contracts-nao-depende-de-apps",
+  ]) {
+    deveFalhar(`depcruise ${regra}`, dep, regra);
+  }
+
+  // 4) Python: ruff (eval), mypy --strict (sem tipos), import-linter (servicos/SDK).
+  deveFalhar(
+    "ruff eval_inseguro.py",
+    exec("uv", [
+      "run",
+      "--frozen",
+      "ruff",
+      "check",
+      "--no-cache",
+      "tools/qualidade/regressao/python/eval_inseguro.py",
+    ]),
+    "S307",
+  );
+  deveFalhar(
+    "mypy --strict sem_tipos.py",
+    exec("uv", [
+      "run",
+      "--frozen",
+      "mypy",
+      "--strict",
+      "--no-incremental",
+      "tools/qualidade/regressao/python/sem_tipos.py",
+    ]),
+    "no-untyped-def",
+  );
+  const il = exec(
+    "uv",
+    ["run", "--frozen", "--project", raiz, "lint-imports", "--config", join(raiz, ".importlinter")],
+    {
+      cwd: join(reg, "python", "imports"),
+      env: { ...process.env, PYTHONPATH: join(reg, "python", "imports") },
+    },
+  );
+  deveFalhar("import-linter servicos independentes", il, "nao importam uns aos outros BROKEN");
+  deveFalhar("import-linter SDK do provisioner", il, "SDK do provisioner BROKEN");
+
+  // 5) gitleaks: segredo sintetico gerado agora (nada de segredo armazenado no repositorio).
+  const seg = join(tmpRaiz, "segredo");
+  mkdirSync(seg);
+  const token = `ghp_${randomBytes(27).toString("base64url").replace(/[-_]/g, "a").slice(0, 36)}`;
+  writeFileSync(join(seg, "config.ts"), `export const token = "${token}";\n`);
+  deveFalhar(
+    "gitleaks segredo sintetico",
+    exec("gitleaks", [
+      "dir",
+      seg,
+      "--config",
+      join(raiz, ".gitleaks.toml"),
+      "--redact",
+      "--no-banner",
+    ]),
+    "leaks found",
+  );
+
+  // 6) Convencao de commit.
+  deveSer("commit-msg rejeita 'ajustes'", !validar("ajustes"));
+  deveSer("commit-msg rejeita tipo desconhecido", !validar("feature: algo"));
+  deveSer("commit-msg aceita 'feat(api): x'", validar("feat(api): x"));
+  // 7) Nome de branch.
+  const br = exec("scripts/check-branch-name.sh", ["minha-branch-solta"]);
+  deveSer("branch-name rejeita 'minha-branch-solta'", br.status === 1);
+  deveSer(
+    "branch-name aceita 'tarefa/fnd-002'",
+    exec("scripts/check-branch-name.sh", ["tarefa/fnd-002"]).status === 0,
+  );
+} finally {
+  rmSync(tmpRaiz, { recursive: true, force: true });
+}
+
+if (falhas.length > 0) {
+  console.error(
+    `\n${falhas.length} controle(s) de regressao NAO falharam como esperado:\n- ${falhas.join("\n- ")}`,
+  );
+  process.exit(1);
+}
+console.log("\nTodos os casos de regressao falharam como esperado (controles ativos).");
diff --git a/tools/qualidade/regressao/README.md b/tools/qualidade/regressao/README.md
new file mode 100644
index 0000000..f8102a5
--- /dev/null
+++ b/tools/qualidade/regressao/README.md
@@ -0,0 +1,7 @@
+# Regressao dos controles de qualidade (ENT-FND-002)
+
+Estes arquivos violam de proposito as regras de lint, tipagem e arquitetura. Eles NAO sao
+codigo do produto: sao excluidos de ESLint, Prettier, ruff e dependency-cruiser nas execucoes
+normais, e so sao lidos por `tools/qualidade/regressao.mjs` (`make lint-regressao`), que
+confirma que cada violacao FALHA com a regra esperada. Se um controle deixar de pegar sua
+violacao, o runner falha. O segredo sintetico nao e armazenado: e gerado em tempo de execucao.
diff --git a/tools/qualidade/regressao/arquitetura/apps/api/src/alvo.ts b/tools/qualidade/regressao/arquitetura/apps/api/src/alvo.ts
new file mode 100644
index 0000000..4f68446
--- /dev/null
+++ b/tools/qualidade/regressao/arquitetura/apps/api/src/alvo.ts
@@ -0,0 +1 @@
+export const alvo = 1;
diff --git a/tools/qualidade/regressao/arquitetura/apps/api/src/viola-api-para-web.ts b/tools/qualidade/regressao/arquitetura/apps/api/src/viola-api-para-web.ts
new file mode 100644
index 0000000..904c7be
--- /dev/null
+++ b/tools/qualidade/regressao/arquitetura/apps/api/src/viola-api-para-web.ts
@@ -0,0 +1,2 @@
+import { alvoWeb } from "../../web/src/alvo.js";
+export const usado = alvoWeb;
diff --git a/tools/qualidade/regressao/arquitetura/apps/web/src/alvo.ts b/tools/qualidade/regressao/arquitetura/apps/web/src/alvo.ts
new file mode 100644
index 0000000..dc76c8b
--- /dev/null
+++ b/tools/qualidade/regressao/arquitetura/apps/web/src/alvo.ts
@@ -0,0 +1 @@
+export const alvoWeb = 1;
diff --git a/tools/qualidade/regressao/arquitetura/apps/web/src/viola-web-para-api.ts b/tools/qualidade/regressao/arquitetura/apps/web/src/viola-web-para-api.ts
new file mode 100644
index 0000000..41f5081
--- /dev/null
+++ b/tools/qualidade/regressao/arquitetura/apps/web/src/viola-web-para-api.ts
@@ -0,0 +1,2 @@
+import { alvo } from "../../api/src/alvo.js";
+export const usado = alvo;
diff --git a/tools/qualidade/regressao/arquitetura/packages/contracts/src/viola-contracts-para-app.ts b/tools/qualidade/regressao/arquitetura/packages/contracts/src/viola-contracts-para-app.ts
new file mode 100644
index 0000000..b4c7674
--- /dev/null
+++ b/tools/qualidade/regressao/arquitetura/packages/contracts/src/viola-contracts-para-app.ts
@@ -0,0 +1,2 @@
+import { alvo } from "../../../apps/api/src/alvo.js";
+export const usado = alvo;
diff --git a/tools/qualidade/regressao/python/eval_inseguro.py b/tools/qualidade/regressao/python/eval_inseguro.py
new file mode 100644
index 0000000..1f8620a
--- /dev/null
+++ b/tools/qualidade/regressao/python/eval_inseguro.py
@@ -0,0 +1,5 @@
+"""DEVE FALHAR no ruff: S307 (uso de eval)."""
+
+
+def executar(codigo: str) -> object:
+    return eval(codigo)
diff --git a/tools/qualidade/regressao/python/imports/ai_gateway/__init__.py b/tools/qualidade/regressao/python/imports/ai_gateway/__init__.py
new file mode 100644
index 0000000..9dc318f
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/ai_gateway/__init__.py
@@ -0,0 +1 @@
+"""Pacote alvo."""
diff --git a/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py b/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py
new file mode 100644
index 0000000..c43a355
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py
@@ -0,0 +1,3 @@
+"""DEVE FALHAR no import-linter: tenant-runtime nao importa o SDK do provisioner."""
+
+import tenant_provisioner  # type: ignore[import-not-found]  # noqa: F401
diff --git a/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py b/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py
new file mode 100644
index 0000000..5eaa35f
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py
@@ -0,0 +1,3 @@
+"""DEVE FALHAR no import-linter: servicos nao importam outros servicos."""
+
+import ai_gateway  # noqa: F401
diff --git a/tools/qualidade/regressao/python/sem_tipos.py b/tools/qualidade/regressao/python/sem_tipos.py
new file mode 100644
index 0000000..756ac02
--- /dev/null
+++ b/tools/qualidade/regressao/python/sem_tipos.py
@@ -0,0 +1,5 @@
+"""DEVE FALHAR no mypy --strict: funcao sem anotacoes de tipo."""
+
+
+def dobro(valor):
+    return valor * 2
diff --git a/tools/qualidade/regressao/ts/any-explicito.ts b/tools/qualidade/regressao/ts/any-explicito.ts
new file mode 100644
index 0000000..8ac4265
--- /dev/null
+++ b/tools/qualidade/regressao/ts/any-explicito.ts
@@ -0,0 +1,4 @@
+// DEVE FALHAR: @typescript-eslint/no-explicit-any
+export function identidade(valor: any): any {
+  return valor;
+}
diff --git a/tools/qualidade/regressao/ts/any-fluxo.ts b/tools/qualidade/regressao/ts/any-fluxo.ts
new file mode 100644
index 0000000..20bfd83
--- /dev/null
+++ b/tools/qualidade/regressao/ts/any-fluxo.ts
@@ -0,0 +1,5 @@
+// DEVE FALHAR: @typescript-eslint/no-unsafe-member-access (any vindo de JSON.parse)
+export function ler(texto: string): string {
+  const dado = JSON.parse(texto);
+  return dado.nome;
+}
diff --git a/tools/qualidade/regressao/ts/any-implicito.ts b/tools/qualidade/regressao/ts/any-implicito.ts
new file mode 100644
index 0000000..db375da
--- /dev/null
+++ b/tools/qualidade/regressao/ts/any-implicito.ts
@@ -0,0 +1,4 @@
+// DEVE FALHAR no tsc: TS7006 (parametro com tipo any implicito)
+export function dobro(valor) {
+  return valor * 2;
+}
diff --git a/tools/qualidade/regressao/ts/eval.ts b/tools/qualidade/regressao/ts/eval.ts
new file mode 100644
index 0000000..e5f14b2
--- /dev/null
+++ b/tools/qualidade/regressao/ts/eval.ts
@@ -0,0 +1,4 @@
+// DEVE FALHAR: no-eval
+export function executar(codigo: string): unknown {
+  return eval(codigo);
+}
diff --git a/tools/qualidade/regressao/ts/new-function.ts b/tools/qualidade/regressao/ts/new-function.ts
new file mode 100644
index 0000000..147cbbd
--- /dev/null
+++ b/tools/qualidade/regressao/ts/new-function.ts
@@ -0,0 +1,4 @@
+// DEVE FALHAR: no-new-func
+export function compilar(corpo: string): () => unknown {
+  return new Function(corpo) as () => unknown;
+}
diff --git a/tools/qualidade/regressao/tsconfig.json b/tools/qualidade/regressao/tsconfig.json
new file mode 100644
index 0000000..97e8fd0
--- /dev/null
+++ b/tools/qualidade/regressao/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../../tsconfig.base.json",
+  "compilerOptions": { "noEmit": true, "rootDir": "ts" },
+  "include": ["ts/*.ts"]
+}
````

Lockfiles (gerados): pnpm-lock.yaml sha256 93aecad43e28c893c975999d646f0a85730dd5c293ded3dfe45d690b161d36ef, uv.lock sha256 a4a85f4f3794b34f85ff81b8048670da34c00bd1472c88bf9b18d64eb4a04c79.
