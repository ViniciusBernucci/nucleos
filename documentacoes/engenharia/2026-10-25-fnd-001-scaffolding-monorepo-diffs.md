# FND-001 — Diffs da entrega (scaffolding do monorepo)

Documento principal: [2026-10-25-fnd-001-scaffolding-monorepo.md](2026-10-25-fnd-001-scaffolding-monorepo.md).

Diff unificado do commit unico da tarefa (`git diff --cached` antes do commit, base `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594`), excluindo:
`documentacoes/` e `lessons/` (para evitar recursao) e os lock files gerados `pnpm-lock.yaml` (52525 bytes, sha256 `d8381d394740b0824bef360679a41cd17d3c6773e0d5b82d8f3322cef6f64b21`) e `uv.lock` (5285 bytes, sha256 `a014732f03a4af1885cfdd3d5a6709838afac5b6ce4019a7676f32fa81670109`), gerados por `pnpm install` e `uv lock`. Nenhum segredo foi encontrado nos arquivos; nada foi redigido.

```diff
diff --git a/.dockerignore b/.dockerignore
new file mode 100644
index 0000000..070c311
--- /dev/null
+++ b/.dockerignore
@@ -0,0 +1,21 @@
+.git
+.github
+.run
+node_modules
+**/node_modules
+**/dist
+**/.next
+**/.turbo
+**/__pycache__
+**/.venv
+**/.pytest_cache
+.env
+.env.*
+!.env.example
+documentacoes
+lessons
+skills
+.claude
+.agent
+.agents
+.contexto
diff --git a/.editorconfig b/.editorconfig
new file mode 100644
index 0000000..2d33154
--- /dev/null
+++ b/.editorconfig
@@ -0,0 +1,18 @@
+root = true
+
+[*]
+charset = utf-8
+end_of_line = lf
+insert_final_newline = true
+trim_trailing_whitespace = true
+indent_style = space
+indent_size = 2
+
+[*.py]
+indent_size = 4
+
+[Makefile]
+indent_style = tab
+
+[*.md]
+trim_trailing_whitespace = false
diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000..ce37ee1
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,2 @@
+# Exemplo SEM valores reais. Copie para .env (nao versionado).
+HOST=127.0.0.1
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000..d4aa99b
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,33 @@
+# Dependencias e artefatos de build
+node_modules/
+dist/
+.next/
+.turbo/
+*.tsbuildinfo
+coverage/
+__pycache__/
+*.py[cod]
+.venv/
+.pytest_cache/
+.ruff_cache/
+.mypy_cache/
+
+# Execucao local (pids, logs)
+.run/
+
+# Segredos: nunca versionar .env; apenas .env.example e permitido
+.env
+.env.*
+!.env.example
+*.pem
+*.key
+
+# Terraform (reservado, mas evita estado acidental)
+*.tfstate
+*.tfstate.*
+.terraform/
+
+# SO / editores
+.DS_Store
+.idea/
+.vscode/
diff --git a/.nvmrc b/.nvmrc
new file mode 100644
index 0000000..ce62013
--- /dev/null
+++ b/.nvmrc
@@ -0,0 +1 @@
+24.22.1
diff --git a/.python-version b/.python-version
new file mode 100644
index 0000000..24ee5b1
--- /dev/null
+++ b/.python-version
@@ -0,0 +1 @@
+3.13
diff --git a/CODEOWNERS b/CODEOWNERS
new file mode 100644
index 0000000..a945db7
--- /dev/null
+++ b/CODEOWNERS
@@ -0,0 +1,9 @@
+# Revisor padrao
+*                              @ViniciusBernucci
+
+# Caminhos de seguranca: exigem revisor adicional (ver FND-005 para a branch protection).
+# Substituir/adicionar o time de seguranca quando existir (ex.: @org/seguranca).
+/services/tool-gateway/        @ViniciusBernucci
+/apps/tenant-provisioner/      @ViniciusBernucci
+/infrastructure/               @ViniciusBernucci
+/CODEOWNERS                    @ViniciusBernucci
diff --git a/Makefile b/Makefile
new file mode 100644
index 0000000..82dab1d
--- /dev/null
+++ b/Makefile
@@ -0,0 +1,43 @@
+# Interface unica de desenvolvimento (esconde pnpm/uv). Ver documentacoes/engenharia/.
+# Pre-requisitos no PATH: Node (ver .nvmrc), corepack, uv (Python gerenciado pelo uv).
+# O pnpm vem do corepack (versao fixada em package.json "packageManager"); os atalhos
+# ficam em .run/bin (local, ignorado pelo git) para nao exigir instalacao global.
+SHIMS := $(CURDIR)/.run/bin
+export PATH := $(SHIMS):$(PATH)
+PNPM ?= pnpm
+UV ?= uv
+export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
+export TURBO_TELEMETRY_DISABLED=1
+export DO_NOT_TRACK=1
+
+.PHONY: setup lint test build up down health check-env
+
+setup:
+	@node -e "const v=require('fs').readFileSync('.nvmrc','utf8').trim().split('.')[0]; if(process.versions.node.split('.')[0]!==v){console.error('Node '+v+'.x requerido (.nvmrc); atual '+process.version);process.exit(1)}"
+	mkdir -p $(SHIMS) && corepack enable --install-directory $(SHIMS)
+	$(PNPM) install --frozen-lockfile
+	$(UV) sync --frozen --all-packages
+
+lint: check-env
+	$(PNPM) run lint
+	$(UV) run --frozen python -m compileall -q services
+
+test: check-env
+	$(PNPM) run test
+	$(UV) run --frozen --all-packages pytest
+
+build:
+	$(PNPM) run build
+	$(UV) build --all-packages --out-dir .run/py-dist
+
+up: build
+	./scripts/local.sh up
+
+down:
+	./scripts/local.sh down
+
+health:
+	./scripts/local.sh health
+
+check-env:
+	./scripts/check-no-env.sh
diff --git a/apps/api/package.json b/apps/api/package.json
new file mode 100644
index 0000000..b125804
--- /dev/null
+++ b/apps/api/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@nucleos/api",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\"",
+    "start": "node dist/main.js"
+  },
+  "dependencies": {
+    "@nestjs/common": "12.2.0",
+    "@nestjs/core": "12.2.0",
+    "@nestjs/platform-express": "12.2.0",
+    "@nucleos/contracts": "workspace:*",
+    "reflect-metadata": "0.2.2",
+    "rxjs": "7.8.2"
+  }
+}
diff --git a/apps/api/src/app.module.ts b/apps/api/src/app.module.ts
new file mode 100644
index 0000000..207e0d0
--- /dev/null
+++ b/apps/api/src/app.module.ts
@@ -0,0 +1,5 @@
+import { Module } from "@nestjs/common";
+import { HealthController } from "./health.controller.js";
+
+@Module({ controllers: [HealthController] })
+export class AppModule {}
diff --git a/apps/api/src/health.controller.ts b/apps/api/src/health.controller.ts
new file mode 100644
index 0000000..68415f0
--- /dev/null
+++ b/apps/api/src/health.controller.ts
@@ -0,0 +1,10 @@
+import { Controller, Get } from "@nestjs/common";
+import { type HealthResponse, healthResponse } from "@nucleos/contracts";
+
+@Controller()
+export class HealthController {
+  @Get("healthz")
+  health(): HealthResponse {
+    return healthResponse("api");
+  }
+}
diff --git a/apps/api/src/health.test.ts b/apps/api/src/health.test.ts
new file mode 100644
index 0000000..799b710
--- /dev/null
+++ b/apps/api/src/health.test.ts
@@ -0,0 +1,19 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import type { AddressInfo } from "node:net";
+import { test } from "node:test";
+import { NestFactory } from "@nestjs/core";
+import { AppModule } from "./app.module.js";
+
+test("GET /healthz responde 200 ok", async () => {
+  const app = await NestFactory.create(AppModule, { logger: false });
+  await app.listen(0, "127.0.0.1");
+  try {
+    const { port } = app.getHttpServer().address() as AddressInfo;
+    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
+    assert.equal(res.status, 200);
+    assert.deepEqual(await res.json(), { status: "ok", service: "api" });
+  } finally {
+    await app.close();
+  }
+});
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
new file mode 100644
index 0000000..dc6830e
--- /dev/null
+++ b/apps/api/src/main.ts
@@ -0,0 +1,9 @@
+import "reflect-metadata";
+import { NestFactory } from "@nestjs/core";
+import { AppModule } from "./app.module.js";
+
+const host = process.env["HOST"] ?? "127.0.0.1";
+const port = Number(process.env["PORT"] ?? 3001);
+const app = await NestFactory.create(AppModule);
+await app.listen(port, host);
+console.log(`api em http://${host}:${port}`);
diff --git a/apps/api/tsconfig.json b/apps/api/tsconfig.json
new file mode 100644
index 0000000..adb502c
--- /dev/null
+++ b/apps/api/tsconfig.json
@@ -0,0 +1,11 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "dist",
+    "rootDir": "src",
+    "experimentalDecorators": true,
+    "emitDecoratorMetadata": true,
+    "verbatimModuleSyntax": false
+  },
+  "include": ["src"]
+}
diff --git a/apps/tenant-provisioner/package.json b/apps/tenant-provisioner/package.json
new file mode 100644
index 0000000..6deb04b
--- /dev/null
+++ b/apps/tenant-provisioner/package.json
@@ -0,0 +1,13 @@
+{
+  "name": "@nucleos/tenant-provisioner",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\"",
+    "start": "node dist/main.js"
+  },
+  "dependencies": { "@nucleos/contracts": "workspace:*" }
+}
diff --git a/apps/tenant-provisioner/src/main.ts b/apps/tenant-provisioner/src/main.ts
new file mode 100644
index 0000000..6e328c7
--- /dev/null
+++ b/apps/tenant-provisioner/src/main.ts
@@ -0,0 +1,7 @@
+import { createHealthServer } from "./server.js";
+
+const host = process.env["HOST"] ?? "127.0.0.1";
+const port = Number(process.env["PORT"] ?? 3002);
+createHealthServer().listen(port, host, () => {
+  console.log(`tenant-provisioner em http://${host}:${port}`);
+});
diff --git a/apps/tenant-provisioner/src/server.test.ts b/apps/tenant-provisioner/src/server.test.ts
new file mode 100644
index 0000000..3ee2c17
--- /dev/null
+++ b/apps/tenant-provisioner/src/server.test.ts
@@ -0,0 +1,18 @@
+import assert from "node:assert/strict";
+import type { AddressInfo } from "node:net";
+import { test } from "node:test";
+import { createHealthServer } from "./server.js";
+
+test("GET /healthz responde 200 ok", async () => {
+  const server = createHealthServer();
+  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
+  const { port } = server.address() as AddressInfo;
+  try {
+    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
+    assert.equal(res.status, 200);
+    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
+    assert.equal((await fetch(`http://127.0.0.1:${port}/outra`)).status, 404);
+  } finally {
+    server.close();
+  }
+});
diff --git a/apps/tenant-provisioner/src/server.ts b/apps/tenant-provisioner/src/server.ts
new file mode 100644
index 0000000..c9987eb
--- /dev/null
+++ b/apps/tenant-provisioner/src/server.ts
@@ -0,0 +1,13 @@
+import { createServer, type Server } from "node:http";
+import { HEALTH_PATH, healthResponse } from "@nucleos/contracts";
+
+export function createHealthServer(service = "tenant-provisioner"): Server {
+  return createServer((req, res) => {
+    if (req.method === "GET" && req.url === HEALTH_PATH) {
+      res.writeHead(200, { "content-type": "application/json" });
+      res.end(JSON.stringify(healthResponse(service)));
+      return;
+    }
+    res.writeHead(404).end();
+  });
+}
diff --git a/apps/tenant-provisioner/tsconfig.json b/apps/tenant-provisioner/tsconfig.json
new file mode 100644
index 0000000..972facb
--- /dev/null
+++ b/apps/tenant-provisioner/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
+  "include": ["src"]
+}
diff --git a/apps/web/app/healthz/route.test.ts b/apps/web/app/healthz/route.test.ts
new file mode 100644
index 0000000..12311f2
--- /dev/null
+++ b/apps/web/app/healthz/route.test.ts
@@ -0,0 +1,9 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { GET } from "./route.ts";
+
+test("GET /healthz responde 200 ok", async () => {
+  const res = GET();
+  assert.equal(res.status, 200);
+  assert.deepEqual(await res.json(), { status: "ok", service: "web" });
+});
diff --git a/apps/web/app/healthz/route.ts b/apps/web/app/healthz/route.ts
new file mode 100644
index 0000000..d429f4a
--- /dev/null
+++ b/apps/web/app/healthz/route.ts
@@ -0,0 +1,3 @@
+export function GET(): Response {
+  return Response.json({ status: "ok", service: "web" });
+}
diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
new file mode 100644
index 0000000..a388277
--- /dev/null
+++ b/apps/web/app/layout.tsx
@@ -0,0 +1,11 @@
+import type { ReactNode } from "react";
+
+export const metadata = { title: "Nucleos" };
+
+export default function RootLayout({ children }: { children: ReactNode }) {
+  return (
+    <html lang="pt-BR">
+      <body>{children}</body>
+    </html>
+  );
+}
diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
new file mode 100644
index 0000000..4a73280
--- /dev/null
+++ b/apps/web/app/page.tsx
@@ -0,0 +1,3 @@
+export default function Home() {
+  return <main>Nucleos Enterprise</main>;
+}
diff --git a/apps/web/next-env.d.ts b/apps/web/next-env.d.ts
new file mode 100644
index 0000000..ce4e94a
--- /dev/null
+++ b/apps/web/next-env.d.ts
@@ -0,0 +1,7 @@
+/// <reference types="next" />
+/// <reference types="next/image-types/global" />
+import "./.next/types/routes.d.ts";
+import "./.next/types/root-params.d.ts";
+
+// NOTE: This file should not be edited
+// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
diff --git a/apps/web/next.config.mjs b/apps/web/next.config.mjs
new file mode 100644
index 0000000..5b7e0f5
--- /dev/null
+++ b/apps/web/next.config.mjs
@@ -0,0 +1,3 @@
+/** @type {import('next').NextConfig} */
+const nextConfig = { reactStrictMode: true };
+export default nextConfig;
diff --git a/apps/web/package.json b/apps/web/package.json
new file mode 100644
index 0000000..441732e
--- /dev/null
+++ b/apps/web/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "@nucleos/web",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "build": "next build",
+    "lint": "tsc --noEmit",
+    "test": "node --test \"app/**/*.test.ts\"",
+    "start": "next start -H ${HOST:-127.0.0.1} -p ${PORT:-3000}"
+  },
+  "dependencies": {
+    "next": "16.4.3",
+    "react": "19.3.1",
+    "react-dom": "19.3.1"
+  },
+  "devDependencies": {
+    "@types/react": "19.3.0",
+    "@types/react-dom": "19.3.0"
+  }
+}
diff --git a/apps/web/tsconfig.json b/apps/web/tsconfig.json
new file mode 100644
index 0000000..80c2474
--- /dev/null
+++ b/apps/web/tsconfig.json
@@ -0,0 +1,42 @@
+{
+  "compilerOptions": {
+    "target": "ES2023",
+    "lib": [
+      "ES2023",
+      "dom",
+      "dom.iterable"
+    ],
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "jsx": "react-jsx",
+    "strict": true,
+    "noUncheckedIndexedAccess": true,
+    "exactOptionalPropertyTypes": true,
+    "allowImportingTsExtensions": true,
+    "noEmit": true,
+    "esModuleInterop": true,
+    "skipLibCheck": true,
+    "isolatedModules": true,
+    "incremental": true,
+    "plugins": [
+      {
+        "name": "next"
+      }
+    ],
+    "types": [
+      "node"
+    ],
+    "allowJs": true,
+    "resolveJsonModule": true
+  },
+  "include": [
+    "next-env.d.ts",
+    "**/*.ts",
+    "**/*.tsx",
+    ".next/types/**/*.ts",
+    ".next/dev/types/**/*.ts"
+  ],
+  "exclude": [
+    "node_modules"
+  ]
+}
diff --git a/infrastructure/ansible/README.md b/infrastructure/ansible/README.md
new file mode 100644
index 0000000..761ed6a
--- /dev/null
+++ b/infrastructure/ansible/README.md
@@ -0,0 +1,3 @@
+# ansible
+
+Provisionamento de hosts (estagio 1): entra em ticket proprio. Sem codigo nesta fase.
diff --git a/infrastructure/docker/README.md b/infrastructure/docker/README.md
new file mode 100644
index 0000000..28f23de
--- /dev/null
+++ b/infrastructure/docker/README.md
@@ -0,0 +1,3 @@
+# docker
+
+Compose de desenvolvimento e scripts: FND-004. Dockerfiles de producao: ISO-007/RUN-002.
diff --git a/infrastructure/kubernetes/README.md b/infrastructure/kubernetes/README.md
new file mode 100644
index 0000000..95b0195
--- /dev/null
+++ b/infrastructure/kubernetes/README.md
@@ -0,0 +1,3 @@
+# kubernetes — reservado
+
+Reservado para o estagio 2/3 do ADR (secao 14). Sem codigo nesta fase.
diff --git a/infrastructure/terraform/README.md b/infrastructure/terraform/README.md
new file mode 100644
index 0000000..72d51a0
--- /dev/null
+++ b/infrastructure/terraform/README.md
@@ -0,0 +1,3 @@
+# terraform — reservado
+
+Reservado para o estagio 2/3 do ADR (secao 14). Sem codigo nesta fase.
diff --git a/package.json b/package.json
new file mode 100644
index 0000000..3d0611e
--- /dev/null
+++ b/package.json
@@ -0,0 +1,21 @@
+{
+  "name": "nucleos-enterprise",
+  "private": true,
+  "version": "0.0.0",
+  "description": "Monorepo Nucleos Enterprise (ver documentacoes/transversal, ADR secao 14)",
+  "packageManager": "pnpm@12.15.0",
+  "engines": {
+    "node": ">=24.22.1 <25",
+    "pnpm": ">=12.15.0 <13"
+  },
+  "scripts": {
+    "build": "turbo run build",
+    "lint": "turbo run lint",
+    "test": "turbo run test"
+  },
+  "devDependencies": {
+    "turbo": "2.11.10",
+    "typescript": "5.9.3",
+    "@types/node": "24.19.2"
+  }
+}
diff --git a/packages/contracts/package.json b/packages/contracts/package.json
new file mode 100644
index 0000000..acffceb
--- /dev/null
+++ b/packages/contracts/package.json
@@ -0,0 +1,14 @@
+{
+  "name": "@nucleos/contracts",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "main": "./dist/index.js",
+  "types": "./dist/index.d.ts",
+  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\""
+  }
+}
diff --git a/packages/contracts/src/index.test.ts b/packages/contracts/src/index.test.ts
new file mode 100644
index 0000000..ecefd77
--- /dev/null
+++ b/packages/contracts/src/index.test.ts
@@ -0,0 +1,8 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { HEALTH_PATH, healthResponse } from "./index.js";
+
+test("healthResponse devolve status ok e nome do servico", () => {
+  assert.equal(HEALTH_PATH, "/healthz");
+  assert.deepEqual(healthResponse("x"), { status: "ok", service: "x" });
+});
diff --git a/packages/contracts/src/index.ts b/packages/contracts/src/index.ts
new file mode 100644
index 0000000..67695f0
--- /dev/null
+++ b/packages/contracts/src/index.ts
@@ -0,0 +1,11 @@
+/** Contrato minimo do endpoint de saude de todo componente (hello-world de FND-001). */
+export const HEALTH_PATH = "/healthz";
+
+export interface HealthResponse {
+  status: "ok";
+  service: string;
+}
+
+export function healthResponse(service: string): HealthResponse {
+  return { status: "ok", service };
+}
diff --git a/packages/contracts/tsconfig.json b/packages/contracts/tsconfig.json
new file mode 100644
index 0000000..972facb
--- /dev/null
+++ b/packages/contracts/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
+  "include": ["src"]
+}
diff --git a/packages/sdk/package.json b/packages/sdk/package.json
new file mode 100644
index 0000000..46cbf4f
--- /dev/null
+++ b/packages/sdk/package.json
@@ -0,0 +1,15 @@
+{
+  "name": "@nucleos/sdk",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "main": "./dist/index.js",
+  "types": "./dist/index.d.ts",
+  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\""
+  },
+  "dependencies": { "@nucleos/contracts": "workspace:*" }
+}
diff --git a/packages/sdk/src/index.test.ts b/packages/sdk/src/index.test.ts
new file mode 100644
index 0000000..250764a
--- /dev/null
+++ b/packages/sdk/src/index.test.ts
@@ -0,0 +1,19 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { checkHealth } from "./index.js";
+
+test("checkHealth le a resposta de /healthz", async () => {
+  const fake = (async (url: URL | string) => {
+    assert.equal(String(url), "http://127.0.0.1:1/healthz");
+    return Response.json({ status: "ok", service: "fake" });
+  }) as unknown as typeof fetch;
+  assert.deepEqual(await checkHealth("http://127.0.0.1:1", fake), {
+    status: "ok",
+    service: "fake",
+  });
+});
+
+test("checkHealth falha quando HTTP nao e 2xx", async () => {
+  const fake = (async () => new Response("x", { status: 503 })) as unknown as typeof fetch;
+  await assert.rejects(checkHealth("http://127.0.0.1:1", fake));
+});
diff --git a/packages/sdk/src/index.ts b/packages/sdk/src/index.ts
new file mode 100644
index 0000000..3624770
--- /dev/null
+++ b/packages/sdk/src/index.ts
@@ -0,0 +1,13 @@
+import { HEALTH_PATH, type HealthResponse } from "@nucleos/contracts";
+
+/** Cliente minimo: consulta /healthz de um componente. Sem logica de negocio. */
+export async function checkHealth(
+  baseUrl: string,
+  fetchImpl: typeof fetch = fetch,
+): Promise<HealthResponse> {
+  const res = await fetchImpl(new URL(HEALTH_PATH, baseUrl));
+  if (!res.ok) {
+    throw new Error(`healthz falhou: HTTP ${res.status}`);
+  }
+  return (await res.json()) as HealthResponse;
+}
diff --git a/packages/sdk/tsconfig.json b/packages/sdk/tsconfig.json
new file mode 100644
index 0000000..972facb
--- /dev/null
+++ b/packages/sdk/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
+  "include": ["src"]
+}
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
new file mode 100644
index 0000000..3ff5faa
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1,3 @@
+packages:
+  - "apps/*"
+  - "packages/*"
diff --git a/pyproject.toml b/pyproject.toml
new file mode 100644
index 0000000..8653c62
--- /dev/null
+++ b/pyproject.toml
@@ -0,0 +1,19 @@
+[project]
+name = "nucleos-enterprise-python"
+version = "0.0.0"
+description = "Raiz do workspace uv dos servicos Python (nao publicavel)"
+requires-python = ">=3.12"
+dependencies = []
+
+[dependency-groups]
+dev = ["pytest==9.0.3"]
+
+[tool.uv]
+package = false
+
+[tool.uv.workspace]
+members = ["services/*"]
+
+[tool.pytest.ini_options]
+testpaths = ["services"]
+addopts = "--import-mode=importlib"
diff --git a/scripts/check-no-env.sh b/scripts/check-no-env.sh
new file mode 100755
index 0000000..419a0fa
--- /dev/null
+++ b/scripts/check-no-env.sh
@@ -0,0 +1,15 @@
+#!/usr/bin/env bash
+# Falha se algum arquivo .env* (exceto .env.example) estiver versionado.
+set -euo pipefail
+cd "$(dirname "$0")/.."
+bad=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)
+if [ -n "$bad" ]; then
+  echo "ERRO: arquivos .env versionados:" >&2
+  echo "$bad" >&2
+  exit 1
+fi
+if ! git check-ignore -q .env; then
+  echo "ERRO: .env nao esta ignorado pelo .gitignore" >&2
+  exit 1
+fi
+echo "OK: nenhum .env versionado e .env ignorado"
diff --git a/scripts/local.sh b/scripts/local.sh
new file mode 100755
index 0000000..e11e7ac
--- /dev/null
+++ b/scripts/local.sh
@@ -0,0 +1,68 @@
+#!/usr/bin/env bash
+# Sobe/derruba/verifica todos os componentes localmente (somente 127.0.0.1).
+# Uso: scripts/local.sh up|down|health   (substituido por Docker Compose em FND-004)
+set -euo pipefail
+cd "$(dirname "$0")/.."
+RUN=.run
+HOST_ADDR=127.0.0.1
+export PATH="$PWD/.run/bin:$PATH"
+PNPM=${PNPM:-pnpm}
+UV=${UV:-uv}
+
+# nome:porta:comando
+COMPONENTS=(
+  "web:3000:$PNPM --filter @nucleos/web start"
+  "api:3001:node apps/api/dist/main.js"
+  "tenant-provisioner:3002:node apps/tenant-provisioner/dist/main.js"
+  "tenant-runtime:8001:$UV run --frozen --package nucleos-tenant-runtime python -m tenant_runtime"
+  "ai-gateway:8002:$UV run --frozen --package nucleos-ai-gateway python -m ai_gateway"
+  "tool-gateway:8003:$UV run --frozen --package nucleos-tool-gateway python -m tool_gateway"
+  "event-dispatcher:8004:$UV run --frozen --package nucleos-event-dispatcher python -m event_dispatcher"
+)
+
+up() {
+  mkdir -p "$RUN"
+  for c in "${COMPONENTS[@]}"; do
+    IFS=: read -r name port cmd <<<"$c"
+    HOST=$HOST_ADDR PORT=$port setsid bash -c "exec $cmd" >"$RUN/$name.log" 2>&1 &
+    echo $! >"$RUN/$name.pid"
+  done
+  for c in "${COMPONENTS[@]}"; do
+    IFS=: read -r name port _ <<<"$c"
+    for _ in $(seq 1 60); do
+      curl -fsS "http://$HOST_ADDR:$port/healthz" >/dev/null 2>&1 && break
+      sleep 1
+    done
+  done
+  health
+}
+
+down() {
+  [ -d "$RUN" ] || exit 0
+  for f in "$RUN"/*.pid; do
+    [ -e "$f" ] || continue
+    pid=$(cat "$f")
+    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
+    rm -f "$f"
+  done
+}
+
+health() {
+  rc=0
+  for c in "${COMPONENTS[@]}"; do
+    IFS=: read -r name port _ <<<"$c"
+    if out=$(curl -fsS "http://$HOST_ADDR:$port/healthz"); then
+      echo "OK   $name :$port $out"
+    else
+      echo "FAIL $name :$port"; rc=1
+    fi
+  done
+  return $rc
+}
+
+case "${1:-}" in
+  up) up ;;
+  down) down ;;
+  health) health ;;
+  *) echo "uso: $0 up|down|health" >&2; exit 2 ;;
+esac
diff --git a/services/ai-gateway/pyproject.toml b/services/ai-gateway/pyproject.toml
new file mode 100644
index 0000000..348574b
--- /dev/null
+++ b/services/ai-gateway/pyproject.toml
@@ -0,0 +1,13 @@
+[project]
+name = "nucleos-ai-gateway"
+version = "0.0.0"
+description = "Servico ai-gateway (hello-world de FND-001; sem logica de negocio)"
+requires-python = ">=3.12"
+dependencies = []
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "ai_gateway"
diff --git a/services/ai-gateway/src/ai_gateway/__init__.py b/services/ai-gateway/src/ai_gateway/__init__.py
new file mode 100644
index 0000000..14c001d
--- /dev/null
+++ b/services/ai-gateway/src/ai_gateway/__init__.py
@@ -0,0 +1 @@
+"""Servico ai-gateway."""
diff --git a/services/ai-gateway/src/ai_gateway/__main__.py b/services/ai-gateway/src/ai_gateway/__main__.py
new file mode 100644
index 0000000..618ea3e
--- /dev/null
+++ b/services/ai-gateway/src/ai_gateway/__main__.py
@@ -0,0 +1,3 @@
+from ai_gateway.app import main
+
+main()
diff --git a/services/ai-gateway/src/ai_gateway/app.py b/services/ai-gateway/src/ai_gateway/app.py
new file mode 100644
index 0000000..cd6a0b9
--- /dev/null
+++ b/services/ai-gateway/src/ai_gateway/app.py
@@ -0,0 +1,39 @@
+"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+
+import json
+import os
+from http.server import BaseHTTPRequestHandler, HTTPServer
+
+SERVICE = "ai-gateway"
+HEALTH_PATH = "/healthz"
+
+
+class Handler(BaseHTTPRequestHandler):
+    def do_GET(self) -> None:
+        if self.path != HEALTH_PATH:
+            self.send_error(404)
+            return
+        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
+        self.send_response(200)
+        self.send_header("content-type", "application/json")
+        self.send_header("content-length", str(len(body)))
+        self.end_headers()
+        self.wfile.write(body)
+
+    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
+        return
+
+
+def make_server(host: str = "127.0.0.1", port: int = 8002) -> HTTPServer:
+    return HTTPServer((host, port), Handler)
+
+
+def main() -> None:
+    host = os.environ.get("HOST", "127.0.0.1")
+    port = int(os.environ.get("PORT", "8002"))
+    print(f"{SERVICE} em http://{host}:{port}", flush=True)
+    make_server(host, port).serve_forever()
+
+
+if __name__ == "__main__":
+    main()
diff --git a/services/ai-gateway/tests/test_health.py b/services/ai-gateway/tests/test_health.py
new file mode 100644
index 0000000..c4e209a
--- /dev/null
+++ b/services/ai-gateway/tests/test_health.py
@@ -0,0 +1,25 @@
+import json
+import threading
+import urllib.error
+import urllib.request
+
+from ai_gateway.app import make_server
+
+
+def test_healthz() -> None:
+    server = make_server("127.0.0.1", 0)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    port = server.server_address[1]
+    try:
+        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+            assert res.status == 200
+            assert json.load(res) == {"status": "ok", "service": "ai-gateway"}
+        try:
+            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            raise AssertionError("esperava 404")
+        except urllib.error.HTTPError as err:
+            assert err.code == 404
+    finally:
+        server.shutdown()
+        server.server_close()
diff --git a/services/event-dispatcher/pyproject.toml b/services/event-dispatcher/pyproject.toml
new file mode 100644
index 0000000..464c609
--- /dev/null
+++ b/services/event-dispatcher/pyproject.toml
@@ -0,0 +1,13 @@
+[project]
+name = "nucleos-event-dispatcher"
+version = "0.0.0"
+description = "Servico event-dispatcher (hello-world de FND-001; sem logica de negocio)"
+requires-python = ">=3.12"
+dependencies = []
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "event_dispatcher"
diff --git a/services/event-dispatcher/src/event_dispatcher/__init__.py b/services/event-dispatcher/src/event_dispatcher/__init__.py
new file mode 100644
index 0000000..34ac901
--- /dev/null
+++ b/services/event-dispatcher/src/event_dispatcher/__init__.py
@@ -0,0 +1 @@
+"""Servico event-dispatcher."""
diff --git a/services/event-dispatcher/src/event_dispatcher/__main__.py b/services/event-dispatcher/src/event_dispatcher/__main__.py
new file mode 100644
index 0000000..36005ce
--- /dev/null
+++ b/services/event-dispatcher/src/event_dispatcher/__main__.py
@@ -0,0 +1,3 @@
+from event_dispatcher.app import main
+
+main()
diff --git a/services/event-dispatcher/src/event_dispatcher/app.py b/services/event-dispatcher/src/event_dispatcher/app.py
new file mode 100644
index 0000000..cb8e164
--- /dev/null
+++ b/services/event-dispatcher/src/event_dispatcher/app.py
@@ -0,0 +1,39 @@
+"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+
+import json
+import os
+from http.server import BaseHTTPRequestHandler, HTTPServer
+
+SERVICE = "event-dispatcher"
+HEALTH_PATH = "/healthz"
+
+
+class Handler(BaseHTTPRequestHandler):
+    def do_GET(self) -> None:
+        if self.path != HEALTH_PATH:
+            self.send_error(404)
+            return
+        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
+        self.send_response(200)
+        self.send_header("content-type", "application/json")
+        self.send_header("content-length", str(len(body)))
+        self.end_headers()
+        self.wfile.write(body)
+
+    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
+        return
+
+
+def make_server(host: str = "127.0.0.1", port: int = 8004) -> HTTPServer:
+    return HTTPServer((host, port), Handler)
+
+
+def main() -> None:
+    host = os.environ.get("HOST", "127.0.0.1")
+    port = int(os.environ.get("PORT", "8004"))
+    print(f"{SERVICE} em http://{host}:{port}", flush=True)
+    make_server(host, port).serve_forever()
+
+
+if __name__ == "__main__":
+    main()
diff --git a/services/event-dispatcher/tests/test_health.py b/services/event-dispatcher/tests/test_health.py
new file mode 100644
index 0000000..9763a2d
--- /dev/null
+++ b/services/event-dispatcher/tests/test_health.py
@@ -0,0 +1,25 @@
+import json
+import threading
+import urllib.error
+import urllib.request
+
+from event_dispatcher.app import make_server
+
+
+def test_healthz() -> None:
+    server = make_server("127.0.0.1", 0)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    port = server.server_address[1]
+    try:
+        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+            assert res.status == 200
+            assert json.load(res) == {"status": "ok", "service": "event-dispatcher"}
+        try:
+            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            raise AssertionError("esperava 404")
+        except urllib.error.HTTPError as err:
+            assert err.code == 404
+    finally:
+        server.shutdown()
+        server.server_close()
diff --git a/services/tenant-runtime/pyproject.toml b/services/tenant-runtime/pyproject.toml
new file mode 100644
index 0000000..f8dbff1
--- /dev/null
+++ b/services/tenant-runtime/pyproject.toml
@@ -0,0 +1,13 @@
+[project]
+name = "nucleos-tenant-runtime"
+version = "0.0.0"
+description = "Servico tenant-runtime (hello-world de FND-001; sem logica de negocio)"
+requires-python = ">=3.12"
+dependencies = []
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "tenant_runtime"
diff --git a/services/tenant-runtime/src/tenant_runtime/__init__.py b/services/tenant-runtime/src/tenant_runtime/__init__.py
new file mode 100644
index 0000000..71c2a61
--- /dev/null
+++ b/services/tenant-runtime/src/tenant_runtime/__init__.py
@@ -0,0 +1 @@
+"""Servico tenant-runtime."""
diff --git a/services/tenant-runtime/src/tenant_runtime/__main__.py b/services/tenant-runtime/src/tenant_runtime/__main__.py
new file mode 100644
index 0000000..1537e86
--- /dev/null
+++ b/services/tenant-runtime/src/tenant_runtime/__main__.py
@@ -0,0 +1,3 @@
+from tenant_runtime.app import main
+
+main()
diff --git a/services/tenant-runtime/src/tenant_runtime/app.py b/services/tenant-runtime/src/tenant_runtime/app.py
new file mode 100644
index 0000000..6b03ad0
--- /dev/null
+++ b/services/tenant-runtime/src/tenant_runtime/app.py
@@ -0,0 +1,39 @@
+"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+
+import json
+import os
+from http.server import BaseHTTPRequestHandler, HTTPServer
+
+SERVICE = "tenant-runtime"
+HEALTH_PATH = "/healthz"
+
+
+class Handler(BaseHTTPRequestHandler):
+    def do_GET(self) -> None:
+        if self.path != HEALTH_PATH:
+            self.send_error(404)
+            return
+        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
+        self.send_response(200)
+        self.send_header("content-type", "application/json")
+        self.send_header("content-length", str(len(body)))
+        self.end_headers()
+        self.wfile.write(body)
+
+    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
+        return
+
+
+def make_server(host: str = "127.0.0.1", port: int = 8001) -> HTTPServer:
+    return HTTPServer((host, port), Handler)
+
+
+def main() -> None:
+    host = os.environ.get("HOST", "127.0.0.1")
+    port = int(os.environ.get("PORT", "8001"))
+    print(f"{SERVICE} em http://{host}:{port}", flush=True)
+    make_server(host, port).serve_forever()
+
+
+if __name__ == "__main__":
+    main()
diff --git a/services/tenant-runtime/tests/test_health.py b/services/tenant-runtime/tests/test_health.py
new file mode 100644
index 0000000..68022d5
--- /dev/null
+++ b/services/tenant-runtime/tests/test_health.py
@@ -0,0 +1,25 @@
+import json
+import threading
+import urllib.error
+import urllib.request
+
+from tenant_runtime.app import make_server
+
+
+def test_healthz() -> None:
+    server = make_server("127.0.0.1", 0)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    port = server.server_address[1]
+    try:
+        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+            assert res.status == 200
+            assert json.load(res) == {"status": "ok", "service": "tenant-runtime"}
+        try:
+            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            raise AssertionError("esperava 404")
+        except urllib.error.HTTPError as err:
+            assert err.code == 404
+    finally:
+        server.shutdown()
+        server.server_close()
diff --git a/services/tool-gateway/pyproject.toml b/services/tool-gateway/pyproject.toml
new file mode 100644
index 0000000..52e94c2
--- /dev/null
+++ b/services/tool-gateway/pyproject.toml
@@ -0,0 +1,13 @@
+[project]
+name = "nucleos-tool-gateway"
+version = "0.0.0"
+description = "Servico tool-gateway (hello-world de FND-001; sem logica de negocio)"
+requires-python = ">=3.12"
+dependencies = []
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "tool_gateway"
diff --git a/services/tool-gateway/src/tool_gateway/__init__.py b/services/tool-gateway/src/tool_gateway/__init__.py
new file mode 100644
index 0000000..235187a
--- /dev/null
+++ b/services/tool-gateway/src/tool_gateway/__init__.py
@@ -0,0 +1 @@
+"""Servico tool-gateway."""
diff --git a/services/tool-gateway/src/tool_gateway/__main__.py b/services/tool-gateway/src/tool_gateway/__main__.py
new file mode 100644
index 0000000..dba794b
--- /dev/null
+++ b/services/tool-gateway/src/tool_gateway/__main__.py
@@ -0,0 +1,3 @@
+from tool_gateway.app import main
+
+main()
diff --git a/services/tool-gateway/src/tool_gateway/app.py b/services/tool-gateway/src/tool_gateway/app.py
new file mode 100644
index 0000000..b042ce1
--- /dev/null
+++ b/services/tool-gateway/src/tool_gateway/app.py
@@ -0,0 +1,39 @@
+"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+
+import json
+import os
+from http.server import BaseHTTPRequestHandler, HTTPServer
+
+SERVICE = "tool-gateway"
+HEALTH_PATH = "/healthz"
+
+
+class Handler(BaseHTTPRequestHandler):
+    def do_GET(self) -> None:
+        if self.path != HEALTH_PATH:
+            self.send_error(404)
+            return
+        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
+        self.send_response(200)
+        self.send_header("content-type", "application/json")
+        self.send_header("content-length", str(len(body)))
+        self.end_headers()
+        self.wfile.write(body)
+
+    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
+        return
+
+
+def make_server(host: str = "127.0.0.1", port: int = 8003) -> HTTPServer:
+    return HTTPServer((host, port), Handler)
+
+
+def main() -> None:
+    host = os.environ.get("HOST", "127.0.0.1")
+    port = int(os.environ.get("PORT", "8003"))
+    print(f"{SERVICE} em http://{host}:{port}", flush=True)
+    make_server(host, port).serve_forever()
+
+
+if __name__ == "__main__":
+    main()
diff --git a/services/tool-gateway/tests/test_health.py b/services/tool-gateway/tests/test_health.py
new file mode 100644
index 0000000..dfe4162
--- /dev/null
+++ b/services/tool-gateway/tests/test_health.py
@@ -0,0 +1,25 @@
+import json
+import threading
+import urllib.error
+import urllib.request
+
+from tool_gateway.app import make_server
+
+
+def test_healthz() -> None:
+    server = make_server("127.0.0.1", 0)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    port = server.server_address[1]
+    try:
+        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+            assert res.status == 200
+            assert json.load(res) == {"status": "ok", "service": "tool-gateway"}
+        try:
+            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            raise AssertionError("esperava 404")
+        except urllib.error.HTTPError as err:
+            assert err.code == 404
+    finally:
+        server.shutdown()
+        server.server_close()
diff --git a/tsconfig.base.json b/tsconfig.base.json
new file mode 100644
index 0000000..c4baee7
--- /dev/null
+++ b/tsconfig.base.json
@@ -0,0 +1,18 @@
+{
+  "compilerOptions": {
+    "target": "ES2023",
+    "lib": ["ES2023"],
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "strict": true,
+    "noUncheckedIndexedAccess": true,
+    "exactOptionalPropertyTypes": true,
+    "noImplicitOverride": true,
+    "verbatimModuleSyntax": true,
+    "esModuleInterop": true,
+    "skipLibCheck": true,
+    "declaration": true,
+    "sourceMap": true,
+    "types": ["node"]
+  }
+}
diff --git a/turbo.json b/turbo.json
new file mode 100644
index 0000000..1507c72
--- /dev/null
+++ b/turbo.json
@@ -0,0 +1,15 @@
+{
+  "$schema": "https://turbo.build/schema.json",
+  "tasks": {
+    "build": {
+      "dependsOn": ["^build"],
+      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
+    },
+    "lint": {
+      "dependsOn": ["^build"]
+    },
+    "test": {
+      "dependsOn": ["build"]
+    }
+  }
+}
```

## Correcao rodada 1

Origem: auditoria `documentacoes/reviews/2026-10-25-auditoria-fnd-001.md` (veredito CORRECOES_NECESSARIAS; somente REVIEW-003 com decisao APLICAR). Base da rodada: HEAD `a995596c32a86b2b8448db92f342653566acfc58` na branch `tarefa/fnd-001`, arvore limpa. Arquivo alterado: `scripts/local.sh`.

### O que mudou (REVIEW-003)

- (a) `up` verifica, antes de iniciar qualquer componente, se alguma das 7 portas ja aceita conexao em `127.0.0.1` (`/dev/tcp`, sem depender de `ss`); se sim, imprime `ERRO: porta N (nome) ja esta em escuta` e retorna rc != 0 sem iniciar nada.
- (b) a espera por saude agora para se o PID iniciado morrer e so conta OK com `kill -0` verdadeiro mais `/healthz` respondendo (portas comprovadamente livres antes da subida, logo a resposta e do processo iniciado). Falha: mensagem com log, `down` e rc 1.
- (c) `down` so envia `kill -- -PID` se o PID e numerico, existe (`kill -0`) e `ps -o pgid=` e igual ao PID (lider de grupo criado por `setsid`); caso contrario apenas remove o pid-file. `down` sem `.run` retorna 0 sem encerrar o shell chamador.

### Validacoes reais (rodada 1)

| Teste | Resultado |
| --- | --- |
| `bash -n scripts/local.sh` | ok |
| Servidor trivial em 8001 respondendo 200 em `/healthz` + `make up` | rc 2 (make), `ERRO: porta 8001 (tenant-runtime) ja esta em escuta`; 0 pid-files; 0 processos nas demais portas |
| Fluxo normal `./scripts/local.sh up` / `make health` | 7/7 `OK`, rc 0 |
| `up` com tudo ja no ar | rc 1, `ERRO: porta 3000 ... 3001 ...` (comportamento esperado) |
| `down` com pid-file apontando para processo alheio (nao lider de grupo) | processo seguiu vivo; pid-file removido |
| Apos `down` | 0 portas em escuta (3000-3002, 8001-8004); 0 pid-files |
| `make lint` | rc 0 |
| `make test` | rc 0 (turbo 10/10 tasks; pytest `4 passed`) |

Observacao: uma primeira tentativa de teste rodou por engano contra o script antigo (edicao ainda nao aplicada) e os processos foram encerrados; nao e evidencia da correcao. Todos os resultados acima sao do script corrigido. Todos os processos de teste foram encerrados.

### Achados ADIADOS (nao tocados nesta rodada)

- REVIEW-001 (CODEOWNERS sem time / revisor adicional): ADIADO para FND-005 (branch protection, require review from Code Owners).
- REVIEW-002 (politica de scripts de instalacao pnpm / supply chain): ADIADO para FND-002 / FND-005; verificar semantica do pnpm antes de implementar.
- REVIEW-004 (pytest travado em 9.0.3; `apps/web/next-env.d.ts` versionado): ADIADO para FND-002, considerado informativo e nao defeito.

### Commit e diff da rodada

Commit unico novo (sem amend) em `tarefa/fnd-001` sobre `a995596c32a86b2b8448db92f342653566acfc58`; SHA em `git log tarefa/fnd-001` (nao pode constar no proprio commit). Diff de `scripts/local.sh`:

```diff
diff --git a/scripts/local.sh b/scripts/local.sh
index e11e7ac..d17ea3f 100755
--- a/scripts/local.sh
+++ b/scripts/local.sh
@@ -20,29 +20,61 @@ COMPONENTS=(
   "event-dispatcher:8004:$UV run --frozen --package nucleos-event-dispatcher python -m event_dispatcher"
 )
 
+porta_em_escuta() { # 0 se algo ja aceita conexao em 127.0.0.1:$1
+  (exec 3<>"/dev/tcp/$HOST_ADDR/$1") 2>/dev/null
+}
+
+pgid_de() { ps -o pgid= -p "$1" 2>/dev/null | tr -d ' ' || true; }
+
 up() {
   mkdir -p "$RUN"
+  # (a) porta ocupada: falha antes de iniciar qualquer componente.
+  ocupada=0
+  for c in "${COMPONENTS[@]}"; do
+    IFS=: read -r name port _ <<<"$c"
+    if porta_em_escuta "$port"; then
+      echo "ERRO: porta $port ($name) ja esta em escuta; libere-a antes de 'up'." >&2
+      ocupada=1
+    fi
+  done
+  [ "$ocupada" -eq 0 ] || return 1
+
   for c in "${COMPONENTS[@]}"; do
     IFS=: read -r name port cmd <<<"$c"
     HOST=$HOST_ADDR PORT=$port setsid bash -c "exec $cmd" >"$RUN/$name.log" 2>&1 &
     echo $! >"$RUN/$name.pid"
   done
+
+  # (b) so e OK se o PID iniciado segue vivo e o /healthz responde (portas estavam livres).
+  falha=0
   for c in "${COMPONENTS[@]}"; do
     IFS=: read -r name port _ <<<"$c"
+    pid=$(cat "$RUN/$name.pid")
+    ok=0
     for _ in $(seq 1 60); do
-      curl -fsS "http://$HOST_ADDR:$port/healthz" >/dev/null 2>&1 && break
+      kill -0 "$pid" 2>/dev/null || break
+      if curl -fsS "http://$HOST_ADDR:$port/healthz" >/dev/null 2>&1; then ok=1; break; fi
       sleep 1
     done
+    if [ "$ok" -eq 1 ] && kill -0 "$pid" 2>/dev/null; then
+      continue
+    fi
+    echo "ERRO: $name (pid $pid) nao ficou saudavel na porta $port; veja $RUN/$name.log" >&2
+    falha=1
   done
+  if [ "$falha" -ne 0 ]; then down; return 1; fi
   health
 }
 
 down() {
-  [ -d "$RUN" ] || exit 0
+  [ -d "$RUN" ] || return 0
   for f in "$RUN"/*.pid; do
     [ -e "$f" ] || continue
     pid=$(cat "$f")
-    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
+    # (c) so mata se o PID existe e e lider do proprio grupo (criado por setsid).
+    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && [ "$(pgid_de "$pid")" = "$pid" ]; then
+      kill -- "-$pid" 2>/dev/null || true
+    fi
     rm -f "$f"
   done
 }
```

## Correcao rodada 2

Origem: auditoria `documentacoes/reviews/2026-10-25-auditoria-qa-fnd-001.md` (somente BUG-001 com decisao APLICAR). Base da rodada: HEAD `54448cb76455d861ae823fbbb447e577f3f6fbea` na branch `tarefa/fnd-001`, arvore limpa. Arquivo alterado: `scripts/check-no-env.sh`.

### O que mudou (BUG-001)

Logo apos o `cd`, `check-no-env.sh` executa `git rev-parse --is-inside-work-tree`; se falhar, imprime `ERRO: check-env requer um repositorio git (git ls-files); arvore sem .git nao e verificavel` e sai com rc=2. Sem skip silencioso (guard de seguranca falha fechado) e sem as linhas `fatal:`. Comportamento sem `.git`: `make lint`/`make test` (que chamam o guard) exigem repositorio git.

### Validacoes reais (rodada 2)

| Teste | Resultado |
| --- | --- |
| Arvore sem `.git` (arquivos rastreados extraidos com `git ls-files -z \| tar` para diretorio novo no scratchpad, incluindo a correcao ainda nao commitada; `git archive HEAD` nao conteria a edicao) | rc=2, mensagem nova, sem `fatal:` |
| Worktree real | `OK: nenhum .env versionado e .env ignorado`, rc=0 |
| `.env` forcado com `git add -f` | rc=1, `ERRO: arquivos .env versionados: .env`; teste revertido (`git rm --cached -f` + remocao), arvore sem sujeira alem do script |
| `make lint` | rc 0 |
| `make test` | rc 0 |

### Achados ADIADOS / nao tocados

- REVIEW-001 (CODEOWNERS sem time): ADIADO para FND-005.
- REVIEW-002 (politica de scripts de instalacao pnpm): ADIADO para FND-002 / FND-005.
- REVIEW-004 (pytest 9.0.3 travado; `next-env.d.ts` versionado): ADIADO para FND-002.
- NOTA-2 (`uv sync --frozen` nao detecta drift de `uv.lock`): ADIADO para FND-005; incluir `uv lock --check` e `pnpm install --frozen-lockfile` no job `lint-py`.
- NOTA-3 (`CODEOWNERS` com dono unico torna o revisor adicional nominal): ADIADO (depende de time/branch protection, FND-005).

### Commit e diff da rodada

Commit unico novo (sem amend) em `tarefa/fnd-001` sobre `54448cb76455d861ae823fbbb447e577f3f6fbea`; SHA em `git log tarefa/fnd-001`.

Diff de `scripts/check-no-env.sh`:

```diff
diff --git a/scripts/check-no-env.sh b/scripts/check-no-env.sh
index 419a0fa..4fba843 100755
--- a/scripts/check-no-env.sh
+++ b/scripts/check-no-env.sh
@@ -2,6 +2,11 @@
 # Falha se algum arquivo .env* (exceto .env.example) estiver versionado.
 set -euo pipefail
 cd "$(dirname "$0")/.."
+# Controle de seguranca: sem repositorio git nao ha como verificar; falha fechado.
+if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
+  echo "ERRO: check-env requer um repositorio git (git ls-files); arvore sem .git nao e verificavel" >&2
+  exit 2
+fi
 bad=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)
 if [ -n "$bad" ]; then
   echo "ERRO: arquivos .env versionados:" >&2
```
