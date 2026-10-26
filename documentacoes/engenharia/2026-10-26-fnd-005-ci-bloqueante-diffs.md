# FND-005 — diffs

Complemento de [o documento da entrega](2026-10-26-fnd-005-ci-bloqueante.md). Commit `d0e4b5f1b15eba425d49709196e102523d1e2138` (`git show`), sem arquivos de `documentacoes/` e `lessons/`. Nenhum binario; nenhum segredo (os fixtures vulneraveis sao publicos e sinteticos).

````diff
diff --git a/.agents/rules/project-instructions.md b/.agents/rules/project-instructions.md
index bd90a7c..9977b14 100755
--- a/.agents/rules/project-instructions.md
+++ b/.agents/rules/project-instructions.md
@@ -176,7 +176,11 @@ estas regras e as secoes anteriores deste arquivo.
   ESLint type-aware, ruff, mypy, regras de arquitetura e gitleaks (FND-002); `make hooks` instala
   os hooks. Ambiente local em Docker: `make compose-up`, `make compose-smoke` e
   `make compose-down` (FND-004; `PERFIS=runtime` exige `make setup && make build`). O CI
-  (FND-005) ainda nao existe; entrega somente de documentacao registra NA com justificativa.
+  (FND-005, `.github/workflows/ci.yml`; GitHub Actions) bloqueia merge em `main` e chama os mesmos
+  alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
+  seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
+  branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
   declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
diff --git a/.github/actions/preparar/action.yml b/.github/actions/preparar/action.yml
new file mode 100644
index 0000000..b67e1a9
--- /dev/null
+++ b/.github/actions/preparar/action.yml
@@ -0,0 +1,21 @@
+name: Preparar ambiente
+description: Node (.nvmrc), pnpm via corepack, uv e dependencias congeladas (lockfiles).
+runs:
+  using: composite
+  steps:
+    - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0 (consulta 2026-10-26)
+      with:
+        node-version-file: .nvmrc
+    - uses: astral-sh/setup-uv@07a047e608db84b3d8c06cd9a7c7dcc9c355c18e # v10.3.2 (consulta 2026-10-26)
+      with:
+        enable-cache: true
+        cache-dependency-glob: uv.lock
+    - name: Cache do store do pnpm
+      uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0 (consulta 2026-10-26)
+      with:
+        path: ~/.local/share/pnpm/store
+        key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
+        restore-keys: pnpm-${{ runner.os }}-
+    - name: make setup (frozen lockfiles)
+      shell: bash
+      run: make setup
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
new file mode 100644
index 0000000..66e082f
--- /dev/null
+++ b/.github/workflows/ci.yml
@@ -0,0 +1,198 @@
+# CI bloqueante (ENT-FND-005). Todos os jobs sao checks obrigatorios da branch protection de `main`
+# (ver documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md). Sem segredos: somente o
+# GITHUB_TOKEN somente-leitura. Gatilho `pull_request` (nunca `pull_request_target`): PRs de forks
+# rodam sem segredos e sem token de escrita. Acoes de terceiros fixadas por SHA (consulta 2026-10-26).
+name: CI
+
+on:
+  pull_request:
+    branches: [main]
+  push:
+    branches: [main]
+  workflow_dispatch:
+
+concurrency:
+  group: ci-${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
+
+permissions:
+  contents: read
+
+env:
+  FERRAMENTAS_BIN: ${{ github.workspace }}/.run/ferramentas
+  TURBO_TELEMETRY_DISABLED: "1"
+  DO_NOT_TRACK: "1"
+
+jobs:
+  lint-ts:
+    name: lint-ts
+    runs-on: ubuntu-24.04
+    timeout-minutes: 15
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: make lint-ts
+      - run: scripts/ci/instalar-ferramenta.sh actionlint
+      - name: Workflows (actionlint + politica)
+        run: make lint-workflows
+
+  lint-py:
+    name: lint-py
+    runs-on: ubuntu-24.04
+    timeout-minutes: 15
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: make lint-py
+
+  # `make lint` completo (inclui gitleaks na arvore e o runner de regressao dos linters): garante que
+  # o alvo local e o CI nao divirjam.
+  make-lint:
+    name: make-lint
+    runs-on: ubuntu-24.04
+    timeout-minutes: 20
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: scripts/ci/instalar-ferramenta.sh gitleaks
+      - run: make lint
+
+  test-ts:
+    name: test-ts
+    runs-on: ubuntu-24.04
+    timeout-minutes: 15
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - name: Servicos auxiliares (PostgreSQL+pgvector, Redis, MinIO; 127.0.0.1, senhas aleatorias)
+        run: scripts/ci/servicos-auxiliares.sh up
+      - run: make test-ts
+      - name: Remover servicos auxiliares
+        if: always()
+        run: scripts/ci/servicos-auxiliares.sh down
+
+  test-py:
+    name: test-py
+    runs-on: ubuntu-24.04
+    timeout-minutes: 15
+    permissions:
+      contents: read
+    env:
+      PYTEST_ADDOPTS: --junitxml=.run/ci-artefatos/pytest-junit.xml
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - name: Servicos auxiliares (PostgreSQL+pgvector, Redis, MinIO; 127.0.0.1, senhas aleatorias)
+        run: scripts/ci/servicos-auxiliares.sh up
+      - run: make test-py
+      - name: Remover servicos auxiliares
+        if: always()
+        run: scripts/ci/servicos-auxiliares.sh down
+      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2 (consulta 2026-10-26)
+        if: always()
+        with:
+          name: pytest-junit
+          path: .run/ci-artefatos/pytest-junit.xml
+          if-no-files-found: warn
+
+  build:
+    name: build
+    runs-on: ubuntu-24.04
+    timeout-minutes: 20
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: make build
+
+  contracts-drift:
+    name: contracts-drift
+    runs-on: ubuntu-24.04
+    timeout-minutes: 10
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: scripts/ci/contracts-drift.sh
+
+  build-images:
+    name: build-images
+    runs-on: ubuntu-24.04
+    timeout-minutes: 20
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          persist-credentials: false
+      - run: scripts/ci/instalar-ferramenta.sh trivy
+      - run: scripts/ci/build-images.sh
+      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2 (consulta 2026-10-26)
+        if: always()
+        with:
+          name: imagens-sbom-sarif
+          path: .run/ci-artefatos/
+          if-no-files-found: ignore
+
+  security:
+    name: security
+    runs-on: ubuntu-24.04
+    timeout-minutes: 20
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1 (consulta 2026-10-26)
+        with:
+          fetch-depth: 0 # historico completo para o gitleaks
+          persist-credentials: false
+      - uses: ./.github/actions/preparar
+      - run: scripts/ci/instalar-ferramenta.sh gitleaks osv-scanner trivy hadolint
+      - name: gitleaks (historico completo)
+        run: |
+          mkdir -p .run/ci-artefatos
+          gitleaks git --config .gitleaks.toml --redact --no-banner \
+            --report-format sarif --report-path .run/ci-artefatos/gitleaks.sarif .
+      - name: Dependencias vulneraveis (pnpm audit, osv-scanner, pip-audit)
+        run: scripts/ci/auditar-dependencias.sh
+      - name: trivy fs (vulnerabilidades, segredos, misconfiguracao)
+        run: |
+          trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --ignore-unfixed \
+            --exit-code 1 --skip-dirs tools/qualidade --skip-dirs node_modules --skip-dirs .run \
+            --skip-dirs skills --skip-dirs .claude --skip-dirs .agents --skip-dirs .agent \
+            --format sarif --output .run/ci-artefatos/trivy-fs.sarif .
+      - name: hadolint (Dockerfiles versionados)
+        run: git ls-files -z '*Dockerfile' '*Dockerfile.*' '*.Dockerfile' | grep -zv '^tools/qualidade/' | xargs -0 -r hadolint
+      - name: Licencas proibidas
+        run: node scripts/ci/check-licenses.mjs
+      - name: Regressao dos gates (cada gate deve falhar na sua violacao)
+        run: make ci-regressao
+      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2 (consulta 2026-10-26)
+        if: always()
+        with:
+          name: security-sarif
+          path: .run/ci-artefatos/
+          if-no-files-found: ignore
diff --git a/AGENTS.md b/AGENTS.md
index f47adec..2d3cbe4 100755
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -193,7 +193,11 @@ estas regras e as secoes anteriores deste arquivo.
   ESLint type-aware, ruff, mypy, regras de arquitetura e gitleaks (FND-002); `make hooks` instala
   os hooks. Ambiente local em Docker: `make compose-up`, `make compose-smoke` e
   `make compose-down` (FND-004; `PERFIS=runtime` exige `make setup && make build`). O CI
-  (FND-005) ainda nao existe; entrega somente de documentacao registra NA com justificativa.
+  (FND-005, `.github/workflows/ci.yml`; GitHub Actions) bloqueia merge em `main` e chama os mesmos
+  alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
+  seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
+  branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
   declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
diff --git a/CLAUDE.md b/CLAUDE.md
index 0535fb8..5ca95c1 100755
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -183,7 +183,11 @@ estas regras e as secoes anteriores deste arquivo.
   ESLint type-aware, ruff, mypy, regras de arquitetura e gitleaks (FND-002); `make hooks` instala
   os hooks. Ambiente local em Docker: `make compose-up`, `make compose-smoke` e
   `make compose-down` (FND-004; `PERFIS=runtime` exige `make setup && make build`). O CI
-  (FND-005) ainda nao existe; entrega somente de documentacao registra NA com justificativa.
+  (FND-005, `.github/workflows/ci.yml`; GitHub Actions) bloqueia merge em `main` e chama os mesmos
+  alvos (`make lint-ts`, `lint-py`, `lint`, `test-ts`, `test-py`, `build`) mais varreduras de
+  seguranca; `make lint-workflows` e `make ci-regressao` validam o proprio CI localmente. A
+  branch protection e manual (ver `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`).
+  Entrega somente de documentacao registra NA com justificativa.
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
   declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
diff --git a/Makefile b/Makefile
index c02b1cb..19a0257 100644
--- a/Makefile
+++ b/Makefile
@@ -10,7 +10,7 @@ export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
 export TURBO_TELEMETRY_DISABLED=1
 export DO_NOT_TRACK=1
 
-.PHONY: setup lint test build up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao format hooks
+.PHONY: setup lint lint-ts lint-py test test-ts test-py build ci-regressao up down health check-env compose-up compose-down compose-reset compose-smoke lint-regressao lint-workflows format hooks
 
 setup:
 	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
@@ -18,22 +18,36 @@ setup:
 	$(PNPM) install --frozen-lockfile
 	$(UV) sync --frozen --all-packages
 
-lint: check-env
+# lint = lint-ts + lint-py + segredos + regressao. Os jobs do CI (FND-005) chamam estes mesmos alvos.
+lint: lint-ts lint-py
+	./scripts/check-secrets.sh
+	$(MAKE) lint-regressao
+
+lint-ts: check-env
 	$(PNPM) run lint
-	$(UV) run --frozen python -m compileall -q services
 	$(PNPM) run lint:quality
+
+lint-py:
+	$(UV) run --frozen python -m compileall -q services
 	$(UV) lock --check
 	$(UV) run --frozen ruff check services
 	$(UV) run --frozen ruff format --check services
 	$(UV) run --frozen mypy
 	$(UV) run --frozen lint-imports
-	./scripts/check-secrets.sh
-	$(MAKE) lint-regressao
 
 # Casos que DEVEM falhar (regressao dos proprios linters); ver tools/qualidade/regressao/.
 lint-regressao:
 	node tools/qualidade/regressao.mjs
 
+# Sintaxe (actionlint) e politica (SHA, permissions, sem pull_request_target) dos workflows.
+lint-workflows:
+	actionlint .github/workflows/*.yml
+	node scripts/ci/verificar-workflows.mjs
+
+# Casos que DEVEM falhar nos gates do CI (FND-005); ver tools/qualidade/regressao-ci/.
+ci-regressao:
+	node tools/qualidade/regressao-ci.mjs
+
 format:
 	$(PNPM) run format
 	$(UV) run --frozen ruff format services
@@ -42,8 +56,12 @@ format:
 hooks:
 	$(PNPM) exec lefthook install
 
-test: check-env
+test: test-ts test-py
+
+test-ts: check-env
 	$(PNPM) run test
+
+test-py: check-env
 	$(UV) run --frozen --all-packages pytest
 
 build:
diff --git a/osv-scanner.toml b/osv-scanner.toml
new file mode 100644
index 0000000..6dbc01b
--- /dev/null
+++ b/osv-scanner.toml
@@ -0,0 +1,6 @@
+# Excecoes do osv-scanner (ENT-FND-005). Vazio por padrao: cada excecao exige id, motivo e prazo.
+# Exemplo (nao ativo):
+# [[IgnoredVulns]]
+# id = "GHSA-xxxx-xxxx-xxxx"
+# ignoreUntil = 2026-12-31
+# reason = "Nao alcancavel: <justificativa revisada por humano>; issue/PR de correcao: <link>"
diff --git a/scripts/ci/auditar-dependencias.sh b/scripts/ci/auditar-dependencias.sh
new file mode 100755
index 0000000..bc3fee4
--- /dev/null
+++ b/scripts/ci/auditar-dependencias.sh
@@ -0,0 +1,24 @@
+#!/usr/bin/env bash
+# Varredura de dependencias vulneraveis (ENT-FND-005): pnpm audit, osv-scanner (pnpm-lock + uv.lock)
+# e pip-audit. Falha se QUALQUER ferramenta encontrar vulnerabilidade (severidade >= high no pnpm
+# audit; qualquer severidade no osv-scanner/pip-audit). Excecoes: osv-scanner.toml, com prazo.
+# Uso: scripts/ci/auditar-dependencias.sh [DIRETORIO_RAIZ_COM_LOCKS]   (padrao: raiz do repositorio)
+set -uo pipefail
+raiz="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
+cd "$raiz"
+status=0
+tmp="$(mktemp -d)"
+trap 'rm -rf "$tmp"' EXIT
+
+echo "== pnpm audit (>= high)"
+pnpm audit --audit-level high || status=1
+
+echo "== osv-scanner (pnpm-lock.yaml, uv.lock)"
+osv-scanner scan source --config osv-scanner.toml -L pnpm-lock.yaml -L uv.lock || status=1
+
+echo "== pip-audit (uv export)"
+uv export --frozen --all-packages --no-hashes --no-emit-workspace -o "$tmp/requirements.txt" >/dev/null || status=1
+# Versao do pip-audit fixada (PyPI, consulta 2026-10-26: 2.10.1, publicada em 2026-06-10).
+uvx pip-audit==2.10.1 -r "$tmp/requirements.txt" --no-deps --disable-pip || status=1
+
+exit "$status"
diff --git a/scripts/ci/build-images.sh b/scripts/ci/build-images.sh
new file mode 100755
index 0000000..833a08a
--- /dev/null
+++ b/scripts/ci/build-images.sh
@@ -0,0 +1,23 @@
+#!/usr/bin/env bash
+# Job build-images (ENT-FND-005): para cada Dockerfile versionado, docker build (hadolint roda no job security) ->
+# trivy image (HIGH/CRITICAL bloqueiam) -> SBOM CycloneDX + SARIF em .run/ci-artefatos/.
+# Sem Dockerfile no repositorio (estado atual) emite aviso e passa.
+set -euo pipefail
+cd "$(dirname "$0")/../.."
+saida=".run/ci-artefatos"
+mkdir -p "$saida"
+mapfile -t dockerfiles < <(git ls-files '*Dockerfile' '*Dockerfile.*' '*.Dockerfile' | grep -v '^tools/qualidade/regressao-ci/' || true)
+if [ "${#dockerfiles[@]}" -eq 0 ]; then
+  echo "::warning title=build-images::nenhum Dockerfile versionado; nada a construir/escanear"
+  exit 0
+fi
+status=0
+for df in "${dockerfiles[@]}"; do
+  nome="$(echo "${df%/*}" | tr '/.' '--' | tr -c 'a-z0-9-\n' '-')"
+  tag="nucleos-ci/${nome:-raiz}:${GITHUB_SHA:-local}"
+  docker build -f "$df" -t "$tag" "$(dirname "$df")"
+  trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
+    --format sarif --output "$saida/$nome.sarif" "$tag" || status=1
+  trivy image --format cyclonedx --output "$saida/$nome.cdx.json" "$tag"
+done
+exit "$status"
diff --git a/scripts/ci/check-licenses.mjs b/scripts/ci/check-licenses.mjs
new file mode 100644
index 0000000..f1d8eda
--- /dev/null
+++ b/scripts/ci/check-licenses.mjs
@@ -0,0 +1,70 @@
+#!/usr/bin/env node
+// Verificacao de licencas proibidas (ENT-FND-005). Politica: nega copyleft forte/de rede e
+// licencas nao livres (AGPL, GPL, SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC). LGPL/MPL passam.
+// Licenca ausente ou desconhecida NAO bloqueia, mas e listada para triagem humana.
+// Uso: node scripts/ci/check-licenses.mjs            (pnpm licenses + ambiente uv instalado)
+//      node scripts/ci/check-licenses.mjs --json arquivo.json   (entrada pronta: {"pacote@ver":"licenca"})
+import { spawnSync } from "node:child_process";
+import { readFileSync } from "node:fs";
+
+export const PROIBIDAS =
+  /(^|[^L])\bGPL|\bAGPL|\bSSPL|\bBUSL|Business Source|\bElastic[- ]License|Commons[- ]Clause|\bCC-BY-NC|\bProprietary|\bGNU (Affero )?General Public/i;
+
+/** Retorna os pacotes cuja expressao de licenca contem TODAS as alternativas proibidas. */
+export function avaliar(pacotes) {
+  const proibidos = [];
+  const desconhecidos = [];
+  for (const [pacote, licenca] of Object.entries(pacotes)) {
+    if (!licenca || /^(unknown|\?)$/i.test(licenca)) {
+      desconhecidos.push(pacote);
+      continue;
+    }
+    // Em "A OR B" basta uma alternativa permitida; em "A AND B" todas valem.
+    const alternativas = licenca.split(/\s+OR\s+/i);
+    if (alternativas.every((a) => PROIBIDAS.test(a))) proibidos.push(`${pacote} (${licenca})`);
+  }
+  return { proibidos, desconhecidos };
+}
+
+function coletar() {
+  const pacotes = {};
+  const ts = spawnSync("pnpm", ["licenses", "list", "--json"], {
+    encoding: "utf8",
+    maxBuffer: 1 << 26,
+  });
+  if (ts.status !== 0) throw new Error(`pnpm licenses falhou: ${ts.stderr}`);
+  for (const [licenca, lista] of Object.entries(JSON.parse(ts.stdout))) {
+    for (const p of lista) for (const v of p.versions) pacotes[`npm:${p.name}@${v}`] = licenca;
+  }
+  const py = `
+import importlib.metadata as m, json
+out = {}
+for d in m.distributions():
+    md = d.metadata
+    lic = md.get("License-Expression") or ""
+    if not lic:
+        cl = [c.split("::")[-1].strip() for c in (md.get_all("Classifier") or []) if c.startswith("License ::")]
+        lic = " OR ".join(cl) or (md.get("License") or "")[:80]
+    out[f"pypi:{md['Name']}@{d.version}"] = lic
+print(json.dumps(out))`;
+  const r = spawnSync("uv", ["run", "--frozen", "python", "-c", py], { encoding: "utf8" });
+  if (r.status !== 0) throw new Error(`leitura de licencas Python falhou: ${r.stderr}`);
+  Object.assign(pacotes, JSON.parse(r.stdout));
+  return pacotes;
+}
+
+if (process.argv[1] === new URL(import.meta.url).pathname) {
+  const i = process.argv.indexOf("--json");
+  const pacotes = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], "utf8")) : coletar();
+  const { proibidos, desconhecidos } = avaliar(pacotes);
+  if (desconhecidos.length > 0) {
+    console.log(
+      `AVISO: ${desconhecidos.length} pacote(s) sem licenca declarada: ${desconhecidos.join(", ")}`,
+    );
+  }
+  if (proibidos.length > 0) {
+    console.error(`ERRO: licencas proibidas:\n- ${proibidos.join("\n- ")}`);
+    process.exit(1);
+  }
+  console.log(`OK: ${Object.keys(pacotes).length} pacotes verificados; nenhuma licenca proibida.`);
+}
diff --git a/scripts/ci/contracts-drift.sh b/scripts/ci/contracts-drift.sh
new file mode 100755
index 0000000..67d158a
--- /dev/null
+++ b/scripts/ci/contracts-drift.sh
@@ -0,0 +1,16 @@
+#!/usr/bin/env bash
+# Job contracts-drift (ENT-FND-005): falha se o codigo gerado a partir de packages/contracts
+# estiver defasado. O alvo `make contracts-check` pertence a FND-003 (ainda nao entregue).
+# Enquanto o alvo nao existir, o job emite aviso explicito (nao silencia) e passa; quando FND-003
+# for integrada o job passa a bloquear sem mudar o workflow.
+set -euo pipefail
+cd "$(dirname "$0")/../.."
+if make -n contracts-check >/dev/null 2>&1; then
+  make contracts-check
+  git diff --exit-code -- packages/ || {
+    echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
+    exit 1
+  }
+else
+  echo "::warning title=contracts-drift::alvo 'make contracts-check' ausente (ENT-FND-003 pendente); gate inativo"
+fi
diff --git a/scripts/ci/instalar-ferramenta.sh b/scripts/ci/instalar-ferramenta.sh
new file mode 100755
index 0000000..cb830a4
--- /dev/null
+++ b/scripts/ci/instalar-ferramenta.sh
@@ -0,0 +1,45 @@
+#!/usr/bin/env bash
+# Instala binarios de scanners com versao e SHA-256 fixos (nada de "latest", nada de curl | sh).
+# Consulta das versoes/digests: 2026-10-26 (API de releases do GitHub, campo digest do asset).
+# Uso: scripts/ci/instalar-ferramenta.sh <gitleaks|osv-scanner|trivy|hadolint|actionlint>...
+# Destino: ${FERRAMENTAS_BIN:-$HOME/.local/bin}; no CI e adicionado ao GITHUB_PATH.
+set -euo pipefail
+destino="${FERRAMENTAS_BIN:-$HOME/.local/bin}"
+mkdir -p "$destino"
+base="https://github.com"
+
+instalar() { # nome versao url sha256 tipo(bin|tgz) caminho_no_tgz
+  local nome="$1" versao="$2" url="$3" sha="$4" tipo="$5" interno="${6:-$1}"
+  if [ -x "$destino/$nome" ] && "$destino/$nome" --version 2>&1 | grep -q "$versao"; then
+    echo "OK: $nome $versao ja instalado"
+    return 0
+  fi
+  local tmp
+  tmp="$(mktemp -d)"
+  curl -fsSL --retry 3 -o "$tmp/artefato" "$url"
+  echo "$sha  $tmp/artefato" | sha256sum -c - >/dev/null || {
+    echo "ERRO: SHA-256 de $nome $versao difere do esperado" >&2
+    rm -rf "$tmp"
+    exit 1
+  }
+  if [ "$tipo" = "tgz" ]; then
+    tar -xzf "$tmp/artefato" -C "$tmp" "$interno"
+    install -m 0755 "$tmp/$interno" "$destino/$nome"
+  else
+    install -m 0755 "$tmp/artefato" "$destino/$nome"
+  fi
+  rm -rf "$tmp"
+  echo "OK: $nome $versao instalado em $destino (SHA-256 conferido)"
+}
+
+for alvo in "$@"; do
+  case "$alvo" in
+    gitleaks) instalar gitleaks 8.30.1 "$base/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz" 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb tgz ;;
+    osv-scanner) instalar osv-scanner 2.7.0 "$base/google/osv-scanner/releases/download/v2.7.0/osv-scanner_linux_amd64" 160c6253e2922e9e0a6a9771c5c4c40a4b3c6090b34a3cdd5e80c96cc2e4218b bin ;;
+    trivy) instalar trivy 0.76.1 "$base/aquasecurity/trivy/releases/download/v0.76.1/trivy_0.76.1_Linux-64bit.tar.gz" c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 tgz ;;
+    hadolint) instalar hadolint 2.15.1 "$base/hadolint/hadolint/releases/download/v2.15.1/hadolint-linux-x86_64" c7187db94eeeeca956519a6af171adc31453941a1e777961f6e680f697c8c507 bin ;;
+    actionlint) instalar actionlint 1.7.12 "$base/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz" 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 tgz ;;
+    *) echo "ERRO: ferramenta desconhecida: $alvo" >&2; exit 2 ;;
+  esac
+done
+if [ -n "${GITHUB_PATH:-}" ]; then echo "$destino" >> "$GITHUB_PATH"; fi
diff --git a/scripts/ci/servicos-auxiliares.sh b/scripts/ci/servicos-auxiliares.sh
new file mode 100755
index 0000000..59b92cd
--- /dev/null
+++ b/scripts/ci/servicos-auxiliares.sh
@@ -0,0 +1,63 @@
+#!/usr/bin/env bash
+# Servicos auxiliares efemeros para testes de integracao (PostgreSQL+pgvector, Redis, MinIO).
+# Mesmas imagens (digest) do compose de desenvolvimento. Portas SOMENTE em 127.0.0.1, senhas
+# aleatorias geradas na hora (nunca versionadas), containers descartados por `down`.
+# Uso: scripts/ci/servicos-auxiliares.sh up|down
+# `up` exporta NUCLEOS_CI_* para $GITHUB_ENV (mascarados) ou, fora do CI, para .run/ci-servicos.env (0600).
+set -euo pipefail
+cd "$(dirname "$0")/../.."
+PREFIXO="nucleos-ci"
+PG_IMG="pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0"
+REDIS_IMG="redis:8.8.3-alpine@sha256:dc95ea2fcf5d5c4253be0f967c28143d0f625846197eed2fd32c748eb99abfca"
+MINIO_IMG="cgr.dev/chainguard/minio:latest@sha256:268d68a2a3b6fc65f905a61f84d7eab6345ce6bff14f551e2b028ec31e6a1341"
+
+down() { docker rm -f "$PREFIXO-pg" "$PREFIXO-redis" "$PREFIXO-minio" >/dev/null 2>&1 || true; }
+
+porta() { docker port "$1" "$2/tcp" | head -1 | sed 's/.*://'; }
+
+aguardar() { # nome comando...
+  local nome="$1"; shift
+  for _ in $(seq 1 60); do
+    if "$@" >/dev/null 2>&1; then return 0; fi
+    sleep 1
+  done
+  echo "ERRO: $nome nao ficou pronto em 60s" >&2
+  return 1
+}
+
+up() {
+  down
+  local pg_pw redis_pw minio_pw
+  pg_pw="$(openssl rand -hex 16)"; redis_pw="$(openssl rand -hex 16)"; minio_pw="$(openssl rand -hex 16)"
+  trap 'down' ERR
+  docker run -d --name "$PREFIXO-pg" -p 127.0.0.1::5432 \
+    -e POSTGRES_USER=nucleos_ci -e POSTGRES_DB=nucleos_ci -e POSTGRES_PASSWORD="$pg_pw" "$PG_IMG" >/dev/null
+  docker run -d --name "$PREFIXO-redis" -p 127.0.0.1::6379 -e REDIS_PASSWORD="$redis_pw" "$REDIS_IMG" \
+    sh -c 'exec redis-server --requirepass "$REDIS_PASSWORD"' >/dev/null
+  docker run -d --name "$PREFIXO-minio" -p 127.0.0.1::9000 \
+    -e MINIO_ROOT_USER=nucleosci -e MINIO_ROOT_PASSWORD="$minio_pw" "$MINIO_IMG" \
+    server /data --address :9000 >/dev/null
+  aguardar postgres docker exec "$PREFIXO-pg" pg_isready -U nucleos_ci -d nucleos_ci
+  aguardar redis docker exec -e "REDISCLI_AUTH=$redis_pw" "$PREFIXO-redis" redis-cli ping
+  aguardar minio curl -fsS "http://127.0.0.1:$(porta "$PREFIXO-minio" 9000)/minio/health/live"
+  local saida="${GITHUB_ENV:-.run/ci-servicos.env}"
+  if [ -z "${GITHUB_ENV:-}" ]; then mkdir -p .run; : > "$saida"; chmod 600 "$saida"; fi
+  if [ -n "${GITHUB_ENV:-}" ]; then
+    echo "::add-mask::$pg_pw"; echo "::add-mask::$redis_pw"; echo "::add-mask::$minio_pw"
+  fi
+  {
+    echo "NUCLEOS_CI_PG_URL=postgresql://nucleos_ci:$pg_pw@127.0.0.1:$(porta "$PREFIXO-pg" 5432)/nucleos_ci"
+    echo "NUCLEOS_CI_REDIS_URL=redis://:$redis_pw@127.0.0.1:$(porta "$PREFIXO-redis" 6379)/0"
+    echo "NUCLEOS_CI_MINIO_ENDPOINT=http://127.0.0.1:$(porta "$PREFIXO-minio" 9000)"
+    echo "NUCLEOS_CI_MINIO_USER=nucleosci"
+    echo "NUCLEOS_CI_MINIO_PASSWORD=$minio_pw"
+  } >> "$saida"
+  trap - ERR
+  echo "OK: postgres/redis/minio efemeros em 127.0.0.1 (variaveis NUCLEOS_CI_* em ${GITHUB_ENV:+GITHUB_ENV}${GITHUB_ENV:-$saida})"
+}
+
+case "${1:-}" in
+  up) up ;;
+  down) down; echo "OK: servicos auxiliares removidos" ;;
+  *) echo "Uso: $0 up|down" >&2; exit 2 ;;
+esac
diff --git a/scripts/ci/verificar-workflows.mjs b/scripts/ci/verificar-workflows.mjs
new file mode 100644
index 0000000..71120c5
--- /dev/null
+++ b/scripts/ci/verificar-workflows.mjs
@@ -0,0 +1,82 @@
+#!/usr/bin/env node
+// Politica estatica dos workflows (ENT-FND-005), sem dependencias externas (analise por linha).
+// Complementa o actionlint (sintaxe/tipos). Uso: node scripts/ci/verificar-workflows.mjs [arquivo|dir]...
+import { readFileSync, readdirSync, statSync } from "node:fs";
+import { join } from "node:path";
+
+export const JOBS_OBRIGATORIOS = [
+  "lint-ts",
+  "lint-py",
+  "make-lint",
+  "test-ts",
+  "test-py",
+  "build",
+  "contracts-drift",
+  "build-images",
+  "security",
+];
+
+/** Devolve a lista de violacoes de um workflow (texto YAML). */
+export function verificar(texto, nome, { exigirJobs = false, acao = false } = {}) {
+  const erros = [];
+  const linhas = texto.split("\n");
+  const err = (n, msg) => erros.push(`${nome}:${n}: ${msg}`);
+  if (!acao && !/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(texto)) {
+    err(1, "falta `permissions: contents: read` no nivel do workflow");
+  }
+  if (/^\s*(pull_request_target|workflow_run)\s*:/m.test(texto)) {
+    err(1, "gatilho pull_request_target/workflow_run e proibido (segredos/escrita para forks)");
+  }
+  linhas.forEach((linha, i) => {
+    const n = i + 1;
+    if (/^\s*#/.test(linha)) return;
+    const uses = /^\s*-?\s*uses:\s*(\S+)/.exec(linha);
+    if (uses && !uses[1].startsWith("./") && !/@[0-9a-f]{40}$/.test(uses[1])) {
+      err(n, `acao nao fixada por SHA de 40 hex: ${uses[1]}`);
+    }
+    if (/secrets\.(?!GITHUB_TOKEN\b)/.test(linha)) err(n, "uso de segredo alem do GITHUB_TOKEN");
+    if (/^\s+\w[\w-]*:\s*write\b/.test(linha) || /permissions:\s*write-all/.test(linha)) {
+      err(n, "permissao de escrita nao permitida");
+    }
+    if (/\$\{\{\s*github\.(event\.|head_ref)/.test(linha) && !/^\s*(if|with):/.test(linha)) {
+      err(n, "expressao controlada por usuario fora de if/with (injecao de script)");
+    }
+    if (/\b(curl|wget)\b[^|]*\|\s*(ba)?sh\b/.test(linha)) err(n, "curl | sh e proibido");
+  });
+  // timeout-minutes por job: conta jobs (2 espacos sob `jobs:`) e timeouts.
+  const bloco = texto.split(/^jobs:\s*$/m)[1] ?? "";
+  const jobs = [...bloco.matchAll(/^ {2}([a-z][\w-]*):\s*$/gm)].map((m) => m[1]);
+  const timeouts = (bloco.match(/^ {4}timeout-minutes:/gm) ?? []).length;
+  if (jobs.length > 0 && timeouts < jobs.length) err(1, "todo job precisa de timeout-minutes");
+  if (exigirJobs) {
+    for (const j of JOBS_OBRIGATORIOS)
+      if (!jobs.includes(j)) err(1, `job obrigatorio ausente: ${j}`);
+  }
+  return erros;
+}
+
+if (process.argv[1] === new URL(import.meta.url).pathname) {
+  const alvos = process.argv.slice(2);
+  if (alvos.length === 0) alvos.push(".github/workflows", ".github/actions/preparar");
+  const arquivos = alvos.flatMap((a) =>
+    statSync(a).isDirectory()
+      ? readdirSync(a)
+          .filter((f) => /\.ya?ml$/.test(f))
+          .map((f) => join(a, f))
+      : [a],
+  );
+  let erros = [];
+  for (const f of arquivos) {
+    erros = erros.concat(
+      verificar(readFileSync(f, "utf8"), f, {
+        exigirJobs: f.endsWith("ci.yml"),
+        acao: f.endsWith("action.yml"),
+      }),
+    );
+  }
+  if (erros.length > 0) {
+    console.error(erros.join("\n"));
+    process.exit(1);
+  }
+  console.log(`OK: ${arquivos.length} workflow(s) conformes a politica.`);
+}
diff --git a/tools/qualidade/regressao-ci.mjs b/tools/qualidade/regressao-ci.mjs
new file mode 100644
index 0000000..f28cd38
--- /dev/null
+++ b/tools/qualidade/regressao-ci.mjs
@@ -0,0 +1,122 @@
+#!/usr/bin/env node
+// Regressao dos gates do CI (ENT-FND-005): cada caso DEVE falhar. Se algum gate deixar de pegar
+// sua violacao, sai com codigo 1. Fixtures em tools/qualidade/regressao-ci/.
+import { spawnSync } from "node:child_process";
+import { readFileSync, readdirSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { verificar } from "../../scripts/ci/verificar-workflows.mjs";
+
+const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
+const reg = join(raiz, "tools", "qualidade", "regressao-ci");
+const offline = process.env.CI_REGRESSAO_OFFLINE === "1";
+const falhas = [];
+
+function exec(cmd, args) {
+  return spawnSync(cmd, args, { cwd: raiz, encoding: "utf8" });
+}
+function deveFalhar(nome, r, trecho) {
+  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
+  const ok = r.status !== 0 && r.status !== null && saida.includes(trecho);
+  console.log(`${ok ? "OK   " : "FALHA"} ${nome} (esperado: falhar com "${trecho}")`);
+  if (!ok) falhas.push(`${nome}\n${saida.slice(0, 600)}`);
+}
+function deveSer(nome, condicao) {
+  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}`);
+  if (!condicao) falhas.push(nome);
+}
+
+// 1) Politica estatica dos workflows: cada fixture viola uma regra.
+const esperado = {
+  "acao-sem-sha": "nao fixada por SHA",
+  "pull-request-target": "pull_request_target",
+  "segredo-exposto": "segredo alem do GITHUB_TOKEN",
+  "permissao-escrita": "permissao de escrita",
+  "sem-permissions": "permissions: contents: read",
+  "sem-timeout": "timeout-minutes",
+  "injecao-de-script": "injecao de script",
+  "curl-pipe-sh": "curl | sh",
+};
+for (const arq of readdirSync(join(reg, "workflows"))) {
+  const chave = arq.replace(/\.yml$/, "");
+  const erros = verificar(readFileSync(join(reg, "workflows", arq), "utf8"), arq);
+  deveSer(
+    `politica de workflows rejeita ${chave}`,
+    erros.some((e) => e.includes(esperado[chave])),
+  );
+}
+const ci = readFileSync(join(raiz, ".github", "workflows", "ci.yml"), "utf8");
+deveSer(
+  "ci.yml real e conforme a politica",
+  verificar(ci, "ci.yml", { exigirJobs: true }).length === 0,
+);
+deveSer(
+  "politica exige os jobs obrigatorios",
+  verificar(ci.replace(/^ {2}security:/m, "  outro:"), "ci.yml", { exigirJobs: true }).some((e) =>
+    e.includes("job obrigatorio ausente: security"),
+  ),
+);
+
+// 2) Licencas proibidas.
+deveFalhar(
+  "licencas proibidas",
+  exec("node", [
+    "scripts/ci/check-licenses.mjs",
+    "--json",
+    join(reg, "dependencias", "licencas-proibidas.json"),
+  ]),
+  "licencas proibidas",
+);
+
+// 3) Dockerfile fora do padrao.
+deveFalhar(
+  "hadolint Dockerfile ruim",
+  exec("hadolint", [join(reg, "imagem", "Dockerfile")]),
+  "DL3",
+);
+
+// 4) Dependencia vulneravel sintetica (precisa de rede: bases OSV/PyPI/trivy-db).
+if (offline) {
+  console.log("SKIP casos de dependencia vulneravel (CI_REGRESSAO_OFFLINE=1)");
+} else {
+  deveFalhar(
+    "osv-scanner package-lock.json vulneravel",
+    exec("osv-scanner", ["scan", "source", "-L", join(reg, "dependencias", "package-lock.json")]),
+    "lodash",
+  );
+  deveFalhar(
+    "pip-audit requirements vulneravel",
+    exec("uvx", [
+      "pip-audit==2.10.1",
+      "-r",
+      join(reg, "dependencias", "requirements.txt"),
+      "--no-deps",
+      "--disable-pip",
+    ]),
+    "requests",
+  );
+  deveFalhar(
+    "trivy fs dependencia vulneravel",
+    exec("trivy", [
+      "fs",
+      "--scanners",
+      "vuln",
+      "--severity",
+      "HIGH,CRITICAL",
+      "--exit-code",
+      "1",
+      join(reg, "dependencias"),
+    ]),
+    "requests",
+  );
+}
+
+if (falhas.length > 0) {
+  console.error(
+    `\n${falhas.length} gate(s) do CI NAO falharam como esperado:\n- ${falhas.join("\n- ")}`,
+  );
+  process.exit(1);
+}
+console.log(
+  "\nTodos os gates do CI falharam como esperado diante das violacoes (controles ativos).",
+);
diff --git a/tools/qualidade/regressao-ci/README.md b/tools/qualidade/regressao-ci/README.md
new file mode 100644
index 0000000..a6e67bc
--- /dev/null
+++ b/tools/qualidade/regressao-ci/README.md
@@ -0,0 +1,8 @@
+# Regressao do CI (ENT-FND-005)
+
+Fixtures que violam de proposito as politicas dos gates do CI. Nao sao codigo do produto: ficam
+fora de lint/scanners normais (`--skip-dirs tools/qualidade`, `osv-scanner -L` explicito, hadolint
+sem este diretorio) e so sao lidas por `tools/qualidade/regressao-ci.mjs` (`make ci-regressao`),
+que confirma que cada gate FALHA diante da sua violacao. Segredo sintetico: ver `regressao.mjs`
+(gerado em tempo de execucao, nunca armazenado). Casos dependentes de rede (osv-scanner, pip-audit,
+trivy) sao ignorados com `CI_REGRESSAO_OFFLINE=1`; no CI nunca sao ignorados.
diff --git a/tools/qualidade/regressao-ci/dependencias/licencas-proibidas.json b/tools/qualidade/regressao-ci/dependencias/licencas-proibidas.json
new file mode 100644
index 0000000..2d79dc7
--- /dev/null
+++ b/tools/qualidade/regressao-ci/dependencias/licencas-proibidas.json
@@ -0,0 +1 @@
+{ "npm:copyleft-rede@1.0.0": "AGPL-3.0-only", "pypi:servidor@2.0": "SSPL-1.0", "npm:ok@1.0.0": "MIT" }
diff --git a/tools/qualidade/regressao-ci/dependencias/package-lock.json b/tools/qualidade/regressao-ci/dependencias/package-lock.json
new file mode 100644
index 0000000..720f916
--- /dev/null
+++ b/tools/qualidade/regressao-ci/dependencias/package-lock.json
@@ -0,0 +1,13 @@
+{
+  "name": "regressao-dependencia-vulneravel",
+  "version": "0.0.0",
+  "lockfileVersion": 3,
+  "requires": true,
+  "packages": {
+    "": { "name": "regressao-dependencia-vulneravel", "version": "0.0.0", "dependencies": { "lodash": "4.17.15" } },
+    "node_modules/lodash": {
+      "version": "4.17.15",
+      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz"
+    }
+  }
+}
diff --git a/tools/qualidade/regressao-ci/dependencias/requirements.txt b/tools/qualidade/regressao-ci/dependencias/requirements.txt
new file mode 100644
index 0000000..382ae30
--- /dev/null
+++ b/tools/qualidade/regressao-ci/dependencias/requirements.txt
@@ -0,0 +1 @@
+requests==2.19.0
diff --git a/tools/qualidade/regressao-ci/imagem/Dockerfile b/tools/qualidade/regressao-ci/imagem/Dockerfile
new file mode 100644
index 0000000..27876e3
--- /dev/null
+++ b/tools/qualidade/regressao-ci/imagem/Dockerfile
@@ -0,0 +1,4 @@
+FROM ubuntu
+ADD . /app
+RUN apt-get install -y curl
+USER root
diff --git a/tools/qualidade/regressao-ci/workflows/acao-sem-sha.yml b/tools/qualidade/regressao-ci/workflows/acao-sem-sha.yml
new file mode 100644
index 0000000..09df9c2
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/acao-sem-sha.yml
@@ -0,0 +1,11 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - uses: actions/checkout@v4
diff --git a/tools/qualidade/regressao-ci/workflows/curl-pipe-sh.yml b/tools/qualidade/regressao-ci/workflows/curl-pipe-sh.yml
new file mode 100644
index 0000000..74d7617
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/curl-pipe-sh.yml
@@ -0,0 +1,11 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: curl -fsSL https://example.com/i.sh | sh
diff --git a/tools/qualidade/regressao-ci/workflows/injecao-de-script.yml b/tools/qualidade/regressao-ci/workflows/injecao-de-script.yml
new file mode 100644
index 0000000..4ebefa1
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/injecao-de-script.yml
@@ -0,0 +1,11 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: echo "${{ github.event.pull_request.title }}"
diff --git a/tools/qualidade/regressao-ci/workflows/permissao-escrita.yml b/tools/qualidade/regressao-ci/workflows/permissao-escrita.yml
new file mode 100644
index 0000000..db2cde1
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/permissao-escrita.yml
@@ -0,0 +1,11 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: write
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: echo oi
diff --git a/tools/qualidade/regressao-ci/workflows/pull-request-target.yml b/tools/qualidade/regressao-ci/workflows/pull-request-target.yml
new file mode 100644
index 0000000..a060027
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/pull-request-target.yml
@@ -0,0 +1,11 @@
+name: ruim
+on:
+  pull_request_target:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: echo oi
diff --git a/tools/qualidade/regressao-ci/workflows/segredo-exposto.yml b/tools/qualidade/regressao-ci/workflows/segredo-exposto.yml
new file mode 100644
index 0000000..6f24d4a
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/segredo-exposto.yml
@@ -0,0 +1,13 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: echo oi
+        env:
+          TOKEN: ${{ secrets.DEPLOY_TOKEN }}
diff --git a/tools/qualidade/regressao-ci/workflows/sem-permissions.yml b/tools/qualidade/regressao-ci/workflows/sem-permissions.yml
new file mode 100644
index 0000000..8280cd3
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/sem-permissions.yml
@@ -0,0 +1,9 @@
+name: ruim
+on:
+  pull_request:
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - run: echo oi
diff --git a/tools/qualidade/regressao-ci/workflows/sem-timeout.yml b/tools/qualidade/regressao-ci/workflows/sem-timeout.yml
new file mode 100644
index 0000000..f66cbbb
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/sem-timeout.yml
@@ -0,0 +1,10 @@
+name: ruim
+on:
+  pull_request:
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    steps:
+      - run: echo oi
````

---

## Rodada de correcao 1 (2026-10-26) — commit `808184be53f3a546e045eb443e4eba96d3b8f45c`

Diff real do commit da rodada 1 (`git show 808184be53f3a546e045eb443e4eba96d3b8f45c`), sem `documentacoes/`/`lessons/`. A evidencia da entrega original acima permanece valida para o commit `d0e4b5f`.

````diff
diff --git a/.github/actions/preparar/action.yml b/.github/actions/preparar/action.yml
index b67e1a9..d687a72 100644
--- a/.github/actions/preparar/action.yml
+++ b/.github/actions/preparar/action.yml
@@ -8,6 +8,8 @@ runs:
         node-version-file: .nvmrc
     - uses: astral-sh/setup-uv@07a047e608db84b3d8c06cd9a7c7dcc9c355c18e # v10.3.2 (consulta 2026-10-26)
       with:
+        # uv fixado: 0.13.5 (latest em astral-sh/uv, publicado em 2026-10-22; consulta 2026-10-26; mesma versao dos testes locais)
+        version: "0.13.5"
         enable-cache: true
         cache-dependency-glob: uv.lock
     - name: Cache do store do pnpm
@@ -19,3 +21,6 @@ runs:
     - name: make setup (frozen lockfiles)
       shell: bash
       run: make setup
+    - name: pnpm (shim do corepack) no PATH dos passos seguintes
+      shell: bash
+      run: echo "$GITHUB_WORKSPACE/.run/bin" >> "$GITHUB_PATH"
diff --git a/scripts/ci/auditar-dependencias.sh b/scripts/ci/auditar-dependencias.sh
index bc3fee4..c11c8f0 100755
--- a/scripts/ci/auditar-dependencias.sh
+++ b/scripts/ci/auditar-dependencias.sh
@@ -6,6 +6,12 @@
 set -uo pipefail
 raiz="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
 cd "$raiz"
+for f in pnpm uv uvx osv-scanner; do
+  command -v "$f" >/dev/null 2>&1 || {
+    echo "ERRO: ferramenta ausente no PATH: $f (rode make setup, exporte .run/bin e instale osv-scanner)" >&2
+    exit 1
+  }
+done
 status=0
 tmp="$(mktemp -d)"
 trap 'rm -rf "$tmp"' EXIT
diff --git a/scripts/ci/build-images.sh b/scripts/ci/build-images.sh
index 833a08a..fdd92e6 100755
--- a/scripts/ci/build-images.sh
+++ b/scripts/ci/build-images.sh
@@ -1,8 +1,31 @@
 #!/usr/bin/env bash
-# Job build-images (ENT-FND-005): para cada Dockerfile versionado, docker build (hadolint roda no job security) ->
-# trivy image (HIGH/CRITICAL bloqueiam) -> SBOM CycloneDX + SARIF em .run/ci-artefatos/.
+# Job build-images (ENT-FND-005): para cada Dockerfile versionado, docker build (hadolint roda no job
+# security) -> trivy image (HIGH/CRITICAL bloqueiam) -> SBOM CycloneDX + SARIF em .run/ci-artefatos/.
 # Sem Dockerfile no repositorio (estado atual) emite aviso e passa.
+# Uso: scripts/ci/build-images.sh | scripts/ci/build-images.sh --nome <caminho/do/Dockerfile>
 set -euo pipefail
+
+# Nome unico e valido para tag/arquivo: caminho em minusculas + sufixo do Dockerfile + hash do caminho.
+nome_artefato() {
+  local df="$1" dir base sufixo="" slug hash
+  dir="$(dirname "$df")"
+  base="$(basename "$df")"
+  base="${base,,}"
+  case "$base" in
+    dockerfile.*) sufixo="-${base#dockerfile.}" ;;
+    *.dockerfile) sufixo="-${base%.dockerfile}" ;;
+  esac
+  slug="$(echo "${dir,,}" | tr -c 'a-z0-9\n' '-' | sed 's/^-*//; s/-*$//')"
+  [ "$dir" = "." ] && slug="raiz"
+  hash="$(printf '%s' "$df" | sha1sum | cut -c1-6)"
+  echo "${slug:-raiz}$(echo "$sufixo" | tr -c 'a-z0-9\n-' '-')-$hash"
+}
+
+if [ "${1:-}" = "--nome" ]; then
+  nome_artefato "$2"
+  exit 0
+fi
+
 cd "$(dirname "$0")/../.."
 saida=".run/ci-artefatos"
 mkdir -p "$saida"
@@ -13,8 +36,8 @@ if [ "${#dockerfiles[@]}" -eq 0 ]; then
 fi
 status=0
 for df in "${dockerfiles[@]}"; do
-  nome="$(echo "${df%/*}" | tr '/.' '--' | tr -c 'a-z0-9-\n' '-')"
-  tag="nucleos-ci/${nome:-raiz}:${GITHUB_SHA:-local}"
+  nome="$(nome_artefato "$df")"
+  tag="nucleos-ci/$nome:${GITHUB_SHA:-local}"
   docker build -f "$df" -t "$tag" "$(dirname "$df")"
   trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
     --format sarif --output "$saida/$nome.sarif" "$tag" || status=1
diff --git a/scripts/ci/check-licenses.mjs b/scripts/ci/check-licenses.mjs
index f1d8eda..7121abe 100644
--- a/scripts/ci/check-licenses.mjs
+++ b/scripts/ci/check-licenses.mjs
@@ -26,7 +26,16 @@ export function avaliar(pacotes) {
   return { proibidos, desconhecidos };
 }
 
+function exigirFerramentas() {
+  for (const f of ["pnpm", "uv"]) {
+    if (spawnSync("sh", ["-c", `command -v ${f}`], { encoding: "utf8" }).status !== 0) {
+      throw new Error(`ferramenta ausente no PATH: ${f} (rode make setup e exporte .run/bin)`);
+    }
+  }
+}
+
 function coletar() {
+  exigirFerramentas();
   const pacotes = {};
   const ts = spawnSync("pnpm", ["licenses", "list", "--json"], {
     encoding: "utf8",
@@ -55,7 +64,13 @@ print(json.dumps(out))`;
 
 if (process.argv[1] === new URL(import.meta.url).pathname) {
   const i = process.argv.indexOf("--json");
-  const pacotes = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], "utf8")) : coletar();
+  let pacotes;
+  try {
+    pacotes = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], "utf8")) : coletar();
+  } catch (e) {
+    console.error(`ERRO: ${e.message}`);
+    process.exit(1);
+  }
   const { proibidos, desconhecidos } = avaliar(pacotes);
   if (desconhecidos.length > 0) {
     console.log(
diff --git a/scripts/ci/contracts-drift.sh b/scripts/ci/contracts-drift.sh
index 67d158a..8229432 100755
--- a/scripts/ci/contracts-drift.sh
+++ b/scripts/ci/contracts-drift.sh
@@ -4,13 +4,16 @@
 # Enquanto o alvo nao existir, o job emite aviso explicito (nao silencia) e passa; quando FND-003
 # for integrada o job passa a bloquear sem mudar o workflow.
 set -euo pipefail
-cd "$(dirname "$0")/../.."
+# CONTRACTS_DRIFT_RAIZ permite testar o script em um repositorio descartavel (regressao-ci).
+cd "${CONTRACTS_DRIFT_RAIZ:-$(dirname "$0")/../..}"
 if make -n contracts-check >/dev/null 2>&1; then
   make contracts-check
-  git diff --exit-code -- packages/ || {
+  # porcelain cobre modificados E arquivos novos nao rastreados (git diff nao veria estes).
+  if [ -n "$(git status --porcelain -- packages/)" ]; then
+    git status --porcelain -- packages/ >&2
     echo "ERRO: artefatos gerados de packages/contracts divergem do versionado (drift)" >&2
     exit 1
-  }
+  fi
 else
   echo "::warning title=contracts-drift::alvo 'make contracts-check' ausente (ENT-FND-003 pendente); gate inativo"
 fi
diff --git a/scripts/ci/verificar-workflows.mjs b/scripts/ci/verificar-workflows.mjs
index 71120c5..e29e99e 100644
--- a/scripts/ci/verificar-workflows.mjs
+++ b/scripts/ci/verificar-workflows.mjs
@@ -34,11 +34,15 @@ export function verificar(texto, nome, { exigirJobs = false, acao = false } = {}
     if (uses && !uses[1].startsWith("./") && !/@[0-9a-f]{40}$/.test(uses[1])) {
       err(n, `acao nao fixada por SHA de 40 hex: ${uses[1]}`);
     }
-    if (/secrets\.(?!GITHUB_TOKEN\b)/.test(linha)) err(n, "uso de segredo alem do GITHUB_TOKEN");
+    if (/secrets(\.(?!GITHUB_TOKEN\b)|\[)/.test(linha))
+      err(n, "uso de segredo alem do GITHUB_TOKEN");
     if (/^\s+\w[\w-]*:\s*write\b/.test(linha) || /permissions:\s*write-all/.test(linha)) {
       err(n, "permissao de escrita nao permitida");
     }
-    if (/\$\{\{\s*github\.(event\.|head_ref)/.test(linha) && !/^\s*(if|with):/.test(linha)) {
+    if (
+      /\$\{\{\s*(github\.(event\.|head_ref)|inputs\.|steps\.[\w-]+\.outputs\.)/.test(linha) &&
+      !/^\s*(if|with):/.test(linha)
+    ) {
       err(n, "expressao controlada por usuario fora de if/with (injecao de script)");
     }
     if (/\b(curl|wget)\b[^|]*\|\s*(ba)?sh\b/.test(linha)) err(n, "curl | sh e proibido");
diff --git a/tools/qualidade/regressao-ci.mjs b/tools/qualidade/regressao-ci.mjs
index f28cd38..2eda44a 100644
--- a/tools/qualidade/regressao-ci.mjs
+++ b/tools/qualidade/regressao-ci.mjs
@@ -2,7 +2,8 @@
 // Regressao dos gates do CI (ENT-FND-005): cada caso DEVE falhar. Se algum gate deixar de pegar
 // sua violacao, sai com codigo 1. Fixtures em tools/qualidade/regressao-ci/.
 import { spawnSync } from "node:child_process";
-import { readFileSync, readdirSync } from "node:fs";
+import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { fileURLToPath } from "node:url";
 import { verificar } from "../../scripts/ci/verificar-workflows.mjs";
@@ -36,6 +37,9 @@ const esperado = {
   "sem-timeout": "timeout-minutes",
   "injecao-de-script": "injecao de script",
   "curl-pipe-sh": "curl | sh",
+  "injecao-inputs": "injecao de script",
+  "injecao-steps-outputs": "injecao de script",
+  "segredo-indexado": "segredo alem do GITHUB_TOKEN",
 };
 for (const arq of readdirSync(join(reg, "workflows"))) {
   const chave = arq.replace(/\.yml$/, "");
@@ -68,6 +72,76 @@ deveFalhar(
   "licencas proibidas",
 );
 
+// 2b) Ferramenta ausente no PATH (REVIEW-001): o gate deve falhar com mensagem explicita, nao mascarar.
+const semPath = { ...process.env, PATH: "/usr/bin:/bin" };
+deveFalhar(
+  "auditar-dependencias sem pnpm no PATH",
+  spawnSync("/bin/bash", ["scripts/ci/auditar-dependencias.sh"], {
+    cwd: raiz,
+    encoding: "utf8",
+    env: semPath,
+  }),
+  "ferramenta ausente no PATH: pnpm",
+);
+deveFalhar(
+  "check-licenses sem pnpm no PATH",
+  spawnSync(process.execPath, ["scripts/ci/check-licenses.mjs"], {
+    cwd: raiz,
+    encoding: "utf8",
+    env: semPath,
+  }),
+  "ferramenta ausente no PATH: pnpm",
+);
+
+// 2c) contracts-drift: arquivo gerado NOVO (nao rastreado) em packages/ deve falhar; sem mudanca, passa.
+const tmp = mkdtempSync(join(tmpdir(), "nucleos-drift-"));
+try {
+  const sh = (args) => spawnSync("git", args, { cwd: tmp, encoding: "utf8" });
+  const preparar = (gerador) => {
+    rmSync(tmp, { recursive: true, force: true });
+    mkdirSync(join(tmp, "packages"), { recursive: true });
+    writeFileSync(join(tmp, "packages", "base.txt"), "x\n");
+    writeFileSync(join(tmp, "Makefile"), `contracts-check:\n\t${gerador}\n`);
+    sh(["init", "-q"]);
+    sh(["add", "-A"]);
+    sh(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base"]);
+  };
+  const drift = () =>
+    spawnSync("bash", [join(raiz, "scripts", "ci", "contracts-drift.sh")], {
+      cwd: tmp,
+      encoding: "utf8",
+      env: { ...process.env, CONTRACTS_DRIFT_RAIZ: tmp },
+    });
+  preparar("echo novo > packages/gerado-novo.txt");
+  deveFalhar("contracts-drift detecta arquivo novo", drift(), "drift");
+  preparar("echo y > packages/base.txt");
+  deveFalhar("contracts-drift detecta arquivo modificado", drift(), "drift");
+  preparar("true");
+  deveSer("contracts-drift passa sem alteracao", drift().status === 0);
+} finally {
+  rmSync(tmp, { recursive: true, force: true });
+}
+
+// 2d) build-images: nomes de artefato validos e unicos (sem Docker).
+const nomes = [
+  "Dockerfile",
+  "apps/api/Dockerfile",
+  "apps/api/Dockerfile.worker",
+  "apps/api/api.Dockerfile",
+  "services/Tool-Gateway/Dockerfile",
+].map((c) =>
+  spawnSync("scripts/ci/build-images.sh", ["--nome", c], {
+    cwd: raiz,
+    encoding: "utf8",
+  }).stdout.trim(),
+);
+deveSer(
+  "build-images gera nomes unicos e validos para tag docker",
+  new Set(nomes).size === nomes.length &&
+    nomes.every((n) => /^[a-z0-9][a-z0-9-]*$/.test(n)) &&
+    nomes[0].startsWith("raiz-"),
+);
+
 // 3) Dockerfile fora do padrao.
 deveFalhar(
   "hadolint Dockerfile ruim",
diff --git a/tools/qualidade/regressao-ci/workflows/injecao-inputs.yml b/tools/qualidade/regressao-ci/workflows/injecao-inputs.yml
new file mode 100644
index 0000000..76c6fc3
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/injecao-inputs.yml
@@ -0,0 +1,16 @@
+name: ruim
+on:
+  workflow_dispatch:
+    inputs:
+      alvo:
+        type: string
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - id: s
+        run: echo ok
+      - run: echo "${{ inputs.alvo }}"
diff --git a/tools/qualidade/regressao-ci/workflows/injecao-steps-outputs.yml b/tools/qualidade/regressao-ci/workflows/injecao-steps-outputs.yml
new file mode 100644
index 0000000..28eb4c8
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/injecao-steps-outputs.yml
@@ -0,0 +1,16 @@
+name: ruim
+on:
+  workflow_dispatch:
+    inputs:
+      alvo:
+        type: string
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - id: s
+        run: echo ok
+      - run: echo "${{ steps.s.outputs.valor }}"
diff --git a/tools/qualidade/regressao-ci/workflows/segredo-indexado.yml b/tools/qualidade/regressao-ci/workflows/segredo-indexado.yml
new file mode 100644
index 0000000..b9d98e2
--- /dev/null
+++ b/tools/qualidade/regressao-ci/workflows/segredo-indexado.yml
@@ -0,0 +1,16 @@
+name: ruim
+on:
+  workflow_dispatch:
+    inputs:
+      alvo:
+        type: string
+permissions:
+  contents: read
+jobs:
+  a:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    steps:
+      - id: s
+        run: echo ok
+      - run: echo "${{ secrets['DEPLOY_TOKEN'] }}"
````
