# Diffs — Painel de vendas Hotmart (2026-11-01)

Documento principal: [2026-11-01-painel-de-vendas-hotmart.md](2026-11-01-painel-de-vendas-hotmart.md).

Nenhum commit criado nesta tarefa. Abaixo, o diff da árvore de trabalho (arquivos modificados em
relação ao `HEAD` `8129a39` e arquivos novos, ainda não rastreados). Ficam de fora os arquivos de
`documentacoes/` e `lessons/` (listados no documento principal), `apps/web/AGENTS.md` (preexistente,
gerado pelo Next.js) e `apps/web/next-env.d.ts` (gerado). Nenhum segredo real aparece nos diffs; valores
de teste são fictícios.

## Arquivos (44)

- `CLAUDE.md` (modificado)
- `apps/api/package.json` (modificado)
- `apps/api/src/app.module.ts` (modificado)
- `apps/api/src/main.ts` (modificado)
- `apps/web/app/(app)/setores/financeiro/page.tsx` (modificado)
- `apps/web/package.json` (modificado)
- `packages/config/src/index.ts` (modificado)
- `packages/contracts/src/index.ts` (modificado)
- `pnpm-lock.yaml` (modificado)
- `apps/api/migrations/0001_vendas.up.sql` (novo)
- `apps/api/src/banco.test.ts` (novo)
- `apps/api/src/banco.ts` (novo)
- `apps/api/src/integracao-pg.test.ts` (novo)
- `apps/api/src/migrar.ts` (novo)
- `apps/api/src/vendas/agendador.ts` (novo)
- `apps/api/src/vendas/apoio.test.ts` (novo)
- `apps/api/src/vendas/chave-servico.guard.ts` (novo)
- `apps/api/src/vendas/dominio.ts` (novo)
- `apps/api/src/vendas/hotmart-client.test.ts` (novo)
- `apps/api/src/vendas/hotmart-client.ts` (novo)
- `apps/api/src/vendas/painel.service.ts` (novo)
- `apps/api/src/vendas/periodo.ts` (novo)
- `apps/api/src/vendas/repositorio-pg.ts` (novo)
- `apps/api/src/vendas/repositorio.ts` (novo)
- `apps/api/src/vendas/sincronizacao.test.ts` (novo)
- `apps/api/src/vendas/sincronizacao.ts` (novo)
- `apps/api/src/vendas/vendas.controller.ts` (novo)
- `apps/api/src/vendas/vendas.http.test.ts` (novo)
- `apps/api/src/vendas/vendas.module.ts` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/Distribuicoes.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/Filtros.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/GraficoReceita.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/Indicadores.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/Sincronizacao.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/page.tsx` (novo)
- `apps/web/app/(app)/setores/financeiro/vendas/vendas.module.css` (novo)
- `apps/web/app/vendas-formato.test.ts` (novo)
- `apps/web/lib/vendas-api.ts` (novo)
- `apps/web/lib/vendas-formato.ts` (novo)
- `infrastructure/docker/scripts/migrar-banco.sh` (novo)
- `packages/config/src/vendas.test.ts` (novo)
- `packages/config/src/vendas.ts` (novo)
- `packages/contracts/src/vendas.ts` (novo)

## `CLAUDE.md` (modificado)

````diff
diff --git a/CLAUDE.md b/CLAUDE.md
index 169a0ab..6d8905d 100755
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -197,6 +197,9 @@ estas regras e as secoes anteriores deste arquivo.
   containers efemeros em `127.0.0.1`; ainda nao roda no CI. Nao ha ambiente de staging declarado:
   deploy real fica BLOCKED (ver `documentacoes/runbooks/deploy-staging-producao.md`).
   Entrega somente de documentacao registra NA com justificativa.
+- **Banco unico:** o Nucleos tem UM unico banco PostgreSQL no Docker; cada assunto e resolvido com
+  schemas e tabelas dentro dele, nunca com banco ou container novo por tarefa. Referencia, mapa de
+  schemas e como migrar: `documentacoes/dados/banco-unico-nucleos.md` (atualize o mapa ao criar tabelas).
 - **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
   banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
   declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
````

## `apps/api/package.json` (modificado)

````diff
diff --git a/apps/api/package.json b/apps/api/package.json
index b2f33e3..14010d1 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -7,7 +7,8 @@
     "build": "tsc -p tsconfig.json",
     "lint": "tsc -p tsconfig.json --noEmit",
     "test": "node --test \"dist/**/*.test.js\"",
-    "start": "node dist/main.js"
+    "start": "node dist/main.js",
+    "migrar": "node dist/migrar.js"
   },
   "dependencies": {
     "@nestjs/common": "12.2.0",
@@ -16,7 +17,11 @@
     "@nucleos/config": "workspace:*",
     "@nucleos/contracts": "workspace:*",
     "@nucleos/observability": "workspace:*",
+    "pg": "8.23.1",
     "reflect-metadata": "0.2.2",
     "rxjs": "7.8.2"
+  },
+  "devDependencies": {
+    "@types/pg": "8.23.1"
   }
 }
````

## `apps/api/src/app.module.ts` (modificado)

````diff
diff --git a/apps/api/src/app.module.ts b/apps/api/src/app.module.ts
index 207e0d0..58540bd 100644
--- a/apps/api/src/app.module.ts
+++ b/apps/api/src/app.module.ts
@@ -1,5 +1,10 @@
-import { Module } from "@nestjs/common";
+import { type DynamicModule, Module } from "@nestjs/common";
 import { HealthController } from "./health.controller.js";
 
 @Module({ controllers: [HealthController] })
-export class AppModule {}
+export class AppModule {
+  /** Compoe o modulo raiz com os modulos opcionais habilitados pela configuracao. */
+  static comModulos(modulos: readonly DynamicModule[]): DynamicModule {
+    return { module: AppModule, imports: [...modulos] };
+  }
+}
````

## `apps/api/src/main.ts` (modificado)

````diff
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 199aea7..098684b 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -1,14 +1,19 @@
 import "reflect-metadata";
-import { ConfigError, loadApiConfig } from "@nucleos/config";
+import { ConfigError, loadApiConfig, loadVendasConfig } from "@nucleos/config";
 import { NestFactory } from "@nestjs/core";
+import { Pool } from "pg";
 import { AppModule } from "./app.module.js";
+import { opcoesPool } from "./banco.js";
 import { createApiObservability, observabilityMiddleware } from "./observability.js";
+import { VendasModule } from "./vendas/vendas.module.js";
 
 // Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
 // nomes de variaveis e motivos, nunca valores.
 let config;
+let vendasConfig;
 try {
   config = loadApiConfig();
+  vendasConfig = loadVendasConfig();
 } catch (e) {
   if (e instanceof ConfigError) {
     console.error(`api: ${e.message}`);
@@ -17,7 +22,26 @@ try {
   throw e;
 }
 
-const app = await NestFactory.create(AppModule);
+const log = (mensagem: string): void => {
+  console.log(mensagem);
+};
+
+// O painel de vendas depende do banco; sem DATABASE_URL (local/ci) o modulo fica desligado.
+const pool =
+  config.databaseUrl === undefined
+    ? undefined
+    : new Pool(opcoesPool(config.databaseUrl, config.databasePassword?.reveal(), 5));
+pool?.on("error", () => {
+  log("api: erro em conexao ociosa do banco");
+});
+if (pool === undefined) log("api: DATABASE_URL ausente; painel de vendas desativado");
+
+const app = await NestFactory.create(
+  AppModule.comModulos(
+    pool === undefined ? [] : [VendasModule.registrar({ config: vendasConfig, pool, log })],
+  ),
+);
+app.enableShutdownHooks();
 app.use(observabilityMiddleware(createApiObservability(config)));
 await app.listen(config.port, config.host);
 console.log(`api em http://${config.host}:${String(config.port)} (${config.appEnv})`);
````

## `apps/web/app/(app)/setores/financeiro/page.tsx` (modificado)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/page.tsx b/apps/web/app/(app)/setores/financeiro/page.tsx
index 6aca287..a8a6843 100644
--- a/apps/web/app/(app)/setores/financeiro/page.tsx
+++ b/apps/web/app/(app)/setores/financeiro/page.tsx
@@ -14,9 +14,22 @@ export default function FinanceiroPage() {
       <header className="page-header">
         <h1>Financeiro</h1>
       </header>
-      <div className="state-box" role="status">
-        Nenhum conteúdo disponível ainda.
-      </div>
+      <section aria-labelledby="financeiro-paineis">
+        <h2 id="financeiro-paineis" className="visually-hidden">
+          Painéis do setor
+        </h2>
+        <ul className="card-grid">
+          <li>
+            <Link href="/setores/financeiro/vendas" className="link-card">
+              <span className="link-card__code" aria-hidden="true">
+                VD
+              </span>
+              <span className="link-card__title">Painel de vendas</span>
+              <span className="link-card__text">Receita, ticket médio e reembolsos da Hotmart</span>
+            </Link>
+          </li>
+        </ul>
+      </section>
     </main>
   );
 }
````

## `apps/web/package.json` (modificado)

````diff
diff --git a/apps/web/package.json b/apps/web/package.json
index 0984845..32a2e7c 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -11,6 +11,7 @@
     "start": "next start -H 127.0.0.1"
   },
   "dependencies": {
+    "@nucleos/contracts": "workspace:*",
     "next": "16.4.3",
     "react": "19.3.1",
     "react-dom": "19.3.1"
````

## `packages/config/src/index.ts` (modificado)

````diff
diff --git a/packages/config/src/index.ts b/packages/config/src/index.ts
index 73e9572..911b862 100644
--- a/packages/config/src/index.ts
+++ b/packages/config/src/index.ts
@@ -1,11 +1,18 @@
-export { ConfigError, type ConfigIssue, forbiddenSecretEnv,
-  isSecretName, loadSecret, parseConfig } from "./load.js";
+export {
+  ConfigError,
+  type ConfigIssue,
+  forbiddenSecretEnv,
+  isSecretName,
+  loadSecret,
+  parseConfig,
+} from "./load.js";
 export { APP_ENVS, type ApiConfig, type AppEnv, loadApiConfig } from "./api.js";
 export {
-  absolutePathSchema,
-  durationMs,
-  portSchema,
-  serviceUrl,
-  sizeBytes,
-} from "./primitives.js";
+  HOTMART_ENVS,
+  type HotmartCredentials,
+  type HotmartEnv,
+  type VendasConfig,
+  loadVendasConfig,
+} from "./vendas.js";
+export { absolutePathSchema, durationMs, portSchema, serviceUrl, sizeBytes } from "./primitives.js";
 export { MAX_SECRET_BYTES, Secret, SecretFileError, readSecretFile } from "./secret.js";
````

## `packages/contracts/src/index.ts` (modificado)

````diff
diff --git a/packages/contracts/src/index.ts b/packages/contracts/src/index.ts
index 04b364d..d34dad2 100644
--- a/packages/contracts/src/index.ts
+++ b/packages/contracts/src/index.ts
@@ -11,6 +11,7 @@ export function healthResponse(service: string): HealthResponse {
 }
 
 export * from "./generated/index.js";
+export * from "./vendas.js";
 export { isRfc3339DateTime } from "./datetime.js";
 export {
   RUNTIME_TOKEN_MAX_TTL_S,
````

## `pnpm-lock.yaml` (modificado)

````diff
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 6e16fef..b7216a2 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -221,12 +221,19 @@ importers:
       '@nucleos/observability':
         specifier: workspace:*
         version: link:../../packages/observability
+      pg:
+        specifier: 8.23.1
+        version: 8.23.1
       reflect-metadata:
         specifier: 0.2.2
         version: 0.2.2
       rxjs:
         specifier: 7.8.2
         version: 7.8.2
+    devDependencies:
+      '@types/pg':
+        specifier: 8.23.1
+        version: 8.23.1
 
   apps/tenant-provisioner:
     dependencies:
@@ -239,6 +246,9 @@ importers:
 
   apps/web:
     dependencies:
+      '@nucleos/contracts':
+        specifier: workspace:*
+        version: link:../../packages/contracts
       next:
         specifier: 16.4.3
         version: 16.4.3(@opentelemetry/api@1.10.0)(@types/node@24.19.2)(react-dom@19.3.1(react@19.3.1))(react@19.3.1)
@@ -796,6 +806,9 @@ packages:
   '@types/node@24.19.2':
     resolution: {integrity: sha512-93d49wCWJkCyN87MxLpNN6KXPCwFw7bVUg79mGUV1OS40JGWwVCr8n61DXCSqz7CV6/VfPkb7xec7uP2M+QHWQ==}
 
+  '@types/pg@8.23.1':
+    resolution: {integrity: sha512-fKVHpikPdg4GKks3JuLEhvwSyvwzF23hnabPy6DD8ljVbC7+6J5dQzdv4arV6jqq57djnMgs1HKBxX4P8aBI3A==}
+
   '@types/react-dom@19.3.0':
     resolution: {integrity: sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==}
     peerDependencies:
@@ -1556,6 +1569,40 @@ packages:
   path-to-regexp@8.4.2:
     resolution: {integrity: sha512-qRcuIdP69NPm4qbACK+aDogI5CBDMi1jKe0ry5rSQJz8JVLsC7jV8XpiJjGRLLol3N+R5ihGYcrPLTno6pAdBA==}
 
+  pg-cloudflare@1.4.1:
+    resolution: {integrity: sha512-6PQbsFWZcp9EmJEwy5cGQ2La+AMWpP46lgbb8X+U/XsHIUweYDNCpeuKck5RxL2MdVFi7krbbEi5nX4Zh7JhrQ==}
+
+  pg-connection-string@2.14.1:
+    resolution: {integrity: sha512-qR3kGNPBLpCNtz0evbKA0Y/MRFXwSSdT+pTJvYp/bXTcReZbvX1kzF0IyTc1QnxqF7AZbOeBhNL8R5mYQZV/MA==}
+
+  pg-int8@1.0.1:
+    resolution: {integrity: sha512-WCtabS6t3c8SkpDBUlb1kjOs7l66xsGdKpIPZsg4wR+B3+u9UAum2odSsF9tnvxg80h4ZxLWMy4pRjOsFIqQpw==}
+    engines: {node: '>=4.0.0'}
+
+  pg-pool@3.14.0:
+    resolution: {integrity: sha512-gKtPkFdQPU3DksooVLi9LsjZxrsBUZIpa+7aVx+LV5pNh0KzP4Zleud2po+ConrxbuXGBJ6Hfer6hdgpIBpBaw==}
+    peerDependencies:
+      pg: '>=8.0'
+
+  pg-protocol@1.16.1:
+    resolution: {integrity: sha512-p9VOFMiHB/ZbJATetbg+99PxssTVSQRnyuPSQ67mN1+1KBOjZaZ83ZQzltnxPhJwSsC3nwVjJ10DVJlerbFzLg==}
+
+  pg-types@2.2.0:
+    resolution: {integrity: sha512-qTAAlrEsl8s4OiEQY69wDvcMIdQN6wdz5ojQiOy6YRMuynxenON0O5oCpJI6lshc6scgAY8qvJ2On/p+CXY0GA==}
+    engines: {node: '>=4'}
+
+  pg@8.23.1:
+    resolution: {integrity: sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==}
+    engines: {node: '>= 16.0.0'}
+    peerDependencies:
+      pg-native: '>=3.0.1'
+    peerDependenciesMeta:
+      pg-native:
+        optional: true
+
+  pgpass@1.0.5:
+    resolution: {integrity: sha512-FdW9r/jQZhSeohs1Z3sI1yxFQNFvMcnmfuj4WBMUTxOrAyLMaTcE1aAMBiTlbMNaXvBCQuVi0R7hd8udDSP7ug==}
+
   picocolors@1.1.1:
     resolution: {integrity: sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==}
 
@@ -1581,6 +1628,22 @@ packages:
     resolution: {integrity: sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg==}
     engines: {node: ^10 || ^12 || >=14}
 
+  postgres-array@2.0.0:
+    resolution: {integrity: sha512-VpZrUqU5A69eQyW2c5CA1jtLecCsN2U/bD6VilrFDWq5+5UIEVO7nazS3TEcHf1zuPYO/sqGvUvW62g86RXZuA==}
+    engines: {node: '>=4'}
+
+  postgres-bytea@1.0.1:
+    resolution: {integrity: sha512-5+5HqXnsZPE65IJZSMkZtURARZelel2oXUEO8rH83VS/hxH5vv1uHquPg5wZs8yMAfdv971IU+kcPUczi7NVBQ==}
+    engines: {node: '>=0.10.0'}
+
+  postgres-date@1.0.7:
+    resolution: {integrity: sha512-suDmjLVQg78nMK2UZ454hAG+OAW+HQPZ6n++TNDUX+L0+uUlLywnoxJKDou51Zm+zTCjrCl0Nq6J9C5hP9vK/Q==}
+    engines: {node: '>=0.10.0'}
+
+  postgres-interval@1.2.0:
+    resolution: {integrity: sha512-9ZhXKM/rw350N1ovuWHbGxnGh/SNJ4cnxHiM0rxE4VN41wsg8P8zWn9hv/buK00RP4WvlOyr/RBDiptyxVbkZQ==}
+    engines: {node: '>=0.10.0'}
+
   prelude-ls@1.2.1:
     resolution: {integrity: sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==}
     engines: {node: '>= 0.8.0'}
@@ -1891,6 +1954,10 @@ packages:
   wrappy@1.0.2:
     resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}
 
+  xtend@4.0.2:
+    resolution: {integrity: sha512-LKYU1iAXJXUgAXn9URjiu+MWhyUXHsvfp7mcuYm9dSUKK0/CjtrUwFAxD82/mCWbtLsGjFIad0wIsod4zrTAEQ==}
+    engines: {node: '>=0.4'}
+
   yaml-ast-parser@0.0.43:
     resolution: {integrity: sha512-2PTINUwsRqSd+s8XxKaJWQlUuEMHJQyEuh2edBbW8KNJz0SJPwUSD2zRWqezFEdN7IzAgeuYHFUCF7o8zRdZ0A==}
 
@@ -2310,6 +2377,12 @@ snapshots:
     dependencies:
       undici-types: 7.24.6
 
+  '@types/pg@8.23.1':
+    dependencies:
+      '@types/node': 24.19.2
+      pg-protocol: 1.16.1
+      pg-types: 2.2.0
+
   '@types/react-dom@19.3.0(@types/react@19.3.0)':
     dependencies:
       '@types/react': 19.3.0
@@ -3106,6 +3179,41 @@ snapshots:
 
   path-to-regexp@8.4.2: {}
 
+  pg-cloudflare@1.4.1:
+    optional: true
+
+  pg-connection-string@2.14.1: {}
+
+  pg-int8@1.0.1: {}
+
+  pg-pool@3.14.0(pg@8.23.1):
+    dependencies:
+      pg: 8.23.1
+
+  pg-protocol@1.16.1: {}
+
+  pg-types@2.2.0:
+    dependencies:
+      pg-int8: 1.0.1
+      postgres-array: 2.0.0
+      postgres-bytea: 1.0.1
+      postgres-date: 1.0.7
+      postgres-interval: 1.2.0
+
+  pg@8.23.1:
+    dependencies:
+      pg-connection-string: 2.14.1
+      pg-pool: 3.14.0(pg@8.23.1)
+      pg-protocol: 1.16.1
+      pg-types: 2.2.0
+      pgpass: 1.0.5
+    optionalDependencies:
+      pg-cloudflare: 1.4.1
+
+  pgpass@1.0.5:
+    dependencies:
+      split2: 4.2.0
+
   picocolors@1.1.1: {}
 
   picomatch@4.0.7: {}
@@ -3138,6 +3246,16 @@ snapshots:
       picocolors: 1.1.1
       source-map-js: 1.2.2
 
+  postgres-array@2.0.0: {}
+
+  postgres-bytea@1.0.1: {}
+
+  postgres-date@1.0.7: {}
+
+  postgres-interval@1.2.0:
+    dependencies:
+      xtend: 4.0.2
+
   prelude-ls@1.2.1: {}
 
   prettier@3.9.10: {}
@@ -3461,6 +3579,8 @@ snapshots:
 
   wrappy@1.0.2: {}
 
+  xtend@4.0.2: {}
+
   yaml-ast-parser@0.0.43: {}
 
   yargs-parser@21.1.1: {}
````

## `apps/api/migrations/0001_vendas.up.sql` (novo)

````diff
diff --git a/apps/api/migrations/0001_vendas.up.sql b/apps/api/migrations/0001_vendas.up.sql
new file mode 100644
index 0000000..94aab26
--- /dev/null
+++ b/apps/api/migrations/0001_vendas.up.sql
@@ -0,0 +1,39 @@
+-- Painel de vendas (setor Financeiro): vendas da Hotmart e estado da sincronizacao.
+-- Forward-only (ADR-017). Nao guarda e-mail nem nome do comprador: so um pseudonimo HMAC.
+CREATE SCHEMA IF NOT EXISTS financeiro;
+
+CREATE TABLE financeiro.vendas (
+  transacao       text PRIMARY KEY,
+  produto_id      text        NOT NULL,
+  produto_nome    text        NOT NULL,
+  comprador_id    text        NOT NULL,
+  status          text        NOT NULL,
+  grupo           text        NOT NULL CHECK (grupo IN ('receita', 'reembolso', 'cancelada', 'pendente')),
+  pedido_em       timestamptz NOT NULL,
+  aprovado_em     timestamptz,
+  valor_centavos  bigint      NOT NULL CHECK (valor_centavos >= 0),
+  taxa_centavos   bigint      NOT NULL DEFAULT 0 CHECK (taxa_centavos >= 0),
+  moeda           char(3)     NOT NULL,
+  pagamento       text        NOT NULL,
+  parcelas        integer     NOT NULL DEFAULT 1 CHECK (parcelas >= 1),
+  assinatura      boolean     NOT NULL DEFAULT false,
+  recorrencia     integer     NOT NULL DEFAULT 0 CHECK (recorrencia >= 0),
+  sincronizado_em timestamptz NOT NULL DEFAULT now()
+);
+
+CREATE INDEX vendas_pedido_em_idx ON financeiro.vendas (pedido_em);
+CREATE INDEX vendas_produto_pedido_idx ON financeiro.vendas (produto_id, pedido_em);
+
+-- Linha unica (id = 1) com o estado da ultima sincronizacao.
+CREATE TABLE financeiro.sincronizacao_estado (
+  id                      smallint    PRIMARY KEY CHECK (id = 1),
+  status                  text        NOT NULL
+    CHECK (status IN ('nunca', 'em_andamento', 'sucesso', 'parcial', 'falha')),
+  ultima_tentativa_em     timestamptz,
+  ultimo_sucesso_em       timestamptz,
+  ultima_reconciliacao_em timestamptz,
+  vendas_processadas      integer     NOT NULL DEFAULT 0,
+  mensagem                text
+);
+
+INSERT INTO financeiro.sincronizacao_estado (id, status) VALUES (1, 'nunca');
````

## `apps/api/src/banco.test.ts` (novo)

````diff
diff --git a/apps/api/src/banco.test.ts b/apps/api/src/banco.test.ts
new file mode 100644
index 0000000..afc8d6c
--- /dev/null
+++ b/apps/api/src/banco.test.ts
@@ -0,0 +1,25 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { opcoesPool } from "./banco.js";
+
+test("opcoes do pool: componentes explicitos, senha separada e sem connectionString", () => {
+  const o = opcoesPool("postgres://nucleos_dev@127.0.0.1:15432/nucleos_dev", "s3nha", 5);
+  assert.deepEqual(o, {
+    host: "127.0.0.1",
+    port: 15432,
+    user: "nucleos_dev",
+    database: "nucleos_dev",
+    password: "s3nha",
+    max: 5,
+  });
+  assert.equal("connectionString" in o, false);
+});
+
+test("opcoes do pool: porta padrao, sem senha e TLS por sslmode", () => {
+  const o = opcoesPool("postgresql://app%40x@db.interno/nucleos?sslmode=verify-full", undefined, 2);
+  assert.equal(o.port, 5432);
+  assert.equal(o.user, "app@x");
+  assert.equal("password" in o, false);
+  assert.equal(o.ssl, true);
+  assert.equal("ssl" in opcoesPool("postgres://u@h/d", undefined, 1), false);
+});
````

## `apps/api/src/banco.ts` (novo)

````diff
diff --git a/apps/api/src/banco.ts b/apps/api/src/banco.ts
new file mode 100644
index 0000000..7ba34af
--- /dev/null
+++ b/apps/api/src/banco.ts
@@ -0,0 +1,21 @@
+import type { PoolConfig } from "pg";
+
+/**
+ * Opcoes do pool a partir da `DATABASE_URL` (sem senha) e da senha lida separadamente.
+ * Monta por componentes: no `pg`, `connectionString` junto de `password` deixa a URL sobrescrever
+ * a senha informada (e a URL nao tem senha), o que quebraria a autenticacao SCRAM.
+ */
+export function opcoesPool(url: string, senha: string | undefined, max: number): PoolConfig {
+  const u = new URL(url);
+  const sslmode = u.searchParams.get("sslmode");
+  const comTls = sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full";
+  return {
+    host: u.hostname,
+    port: u.port === "" ? 5432 : Number(u.port),
+    user: decodeURIComponent(u.username),
+    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
+    ...(senha === undefined ? {} : { password: senha }),
+    ...(comTls ? { ssl: true } : {}),
+    max,
+  };
+}
````

## `apps/api/src/integracao-pg.test.ts` (novo)

````diff
diff --git a/apps/api/src/integracao-pg.test.ts b/apps/api/src/integracao-pg.test.ts
new file mode 100644
index 0000000..74e2e68
--- /dev/null
+++ b/apps/api/src/integracao-pg.test.ts
@@ -0,0 +1,220 @@
+import assert from "node:assert/strict";
+import { randomBytes } from "node:crypto";
+import { after, before, describe, test } from "node:test";
+import { Pool } from "pg";
+import { lerMigracoes, migrar } from "./migrar.js";
+import type { Venda } from "./vendas/dominio.js";
+import { RepositorioVendasPg } from "./vendas/repositorio-pg.js";
+
+/**
+ * Integracao com PostgreSQL real. So roda com TEST_DATABASE_URL apontando para um servidor
+ * DESCARTAVEL (container em 127.0.0.1, sem dados reais); cria um banco temporario proprio e o remove.
+ */
+const URL_ADMIN = process.env["TEST_DATABASE_URL"];
+
+const venda = (transacao: string, parcial: Partial<Venda> = {}): Venda => ({
+  transacao,
+  produtoId: "101",
+  produtoNome: "Curso Completo",
+  compradorId: "comprador-1",
+  status: "APPROVED",
+  grupo: "receita",
+  pedidoEm: new Date("2026-10-10T15:00:00Z"),
+  aprovadoEm: null,
+  valorCentavos: 10_000,
+  taxaCentavos: 1_000,
+  moeda: "BRL",
+  pagamento: "PIX",
+  parcelas: 1,
+  assinatura: false,
+  recorrencia: 0,
+  ...parcial,
+});
+
+describe(
+  "PostgreSQL real",
+  { skip: URL_ADMIN === undefined ? "defina TEST_DATABASE_URL (container descartavel)" : false },
+  () => {
+    const nomeBanco = `nucleos_teste_${randomBytes(4).toString("hex")}`;
+    let admin: Pool;
+    let pool: Pool;
+
+    before(async () => {
+      // Trava de seguranca: este teste cria e apaga bancos; so roda contra servidor local.
+      const host = new URL(URL_ADMIN as string).hostname;
+      assert.ok(
+        ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host),
+        "TEST_DATABASE_URL deve ser local",
+      );
+      admin = new Pool({ connectionString: URL_ADMIN, max: 1 });
+      await admin.query(`CREATE DATABASE ${nomeBanco}`);
+      const u = new URL(URL_ADMIN as string);
+      u.pathname = `/${nomeBanco}`;
+      pool = new Pool({ connectionString: u.toString(), max: 5 });
+      // O DROP ... FORCE final pode cortar uma conexao ociosa: isso nao e falha do teste.
+      pool.on("error", () => undefined);
+    });
+
+    after(async () => {
+      await pool.end();
+      await admin.query(`DROP DATABASE IF EXISTS ${nomeBanco} WITH (FORCE)`);
+      await admin.end();
+    });
+
+    test("migrations aplicam do zero, sao idempotentes e detectam arquivo alterado", async () => {
+      const migracoes = await lerMigracoes(new URL("../migrations/", import.meta.url));
+      assert.deepEqual((await migrar(pool, migracoes)).length, migracoes.length);
+      assert.deepEqual(await migrar(pool, migracoes), []);
+      const adulterada = migracoes.map((m, i) =>
+        i === 0 ? { ...m, checksum: "0".repeat(64) } : m,
+      );
+      await assert.rejects(migrar(pool, adulterada), /alterada apos aplicada/);
+    });
+
+    test("upsert de vendas e idempotente e atualiza o status", async () => {
+      const repo = new RepositorioVendasPg(pool);
+      assert.equal(await repo.gravarVendas([venda("T1"), venda("T2"), venda("T2")]), 2); // duplicada no lote
+      await repo.gravarVendas([venda("T1", { status: "REFUNDED", grupo: "reembolso" })]);
+      const { rows } = await pool.query(
+        "SELECT transacao, status FROM financeiro.vendas ORDER BY transacao",
+      );
+      assert.deepEqual(rows, [
+        { transacao: "T1", status: "REFUNDED" },
+        { transacao: "T2", status: "APPROVED" },
+      ]);
+    });
+
+    test("agregados: periodo no fuso de Sao Paulo, moeda, reembolso, produto e pagamento", async () => {
+      const repo = new RepositorioVendasPg(pool);
+      await pool.query("TRUNCATE financeiro.vendas");
+      await repo.gravarVendas([
+        venda("A", { pedidoEm: new Date("2026-10-10T15:00:00Z"), compradorId: "c1" }),
+        venda("B", {
+          pedidoEm: new Date("2026-10-10T16:00:00Z"),
+          compradorId: "c1",
+          pagamento: "CREDIT_CARD",
+          valorCentavos: 5_000,
+          taxaCentavos: 500,
+          assinatura: true,
+        }),
+        venda("C", {
+          pedidoEm: new Date("2026-10-12T15:00:00Z"),
+          compradorId: "c2",
+          produtoId: "202",
+          produtoNome: "Mentoria",
+          valorCentavos: 30_000,
+          taxaCentavos: 3_000,
+        }),
+        venda("D", {
+          pedidoEm: new Date("2026-10-12T16:00:00Z"),
+          status: "REFUNDED",
+          grupo: "reembolso",
+          valorCentavos: 10_000,
+        }),
+        venda("E", {
+          pedidoEm: new Date("2026-10-12T17:00:00Z"),
+          status: "WAITING_PAYMENT",
+          grupo: "pendente",
+        }),
+        // 02:30Z de 01/11 = 23:30 de 31/10 em Sao Paulo: entra em outubro, nao em novembro.
+        venda("F", { pedidoEm: new Date("2026-11-01T02:30:00Z") }),
+        venda("USD", {
+          moeda: "USD",
+          valorCentavos: 99_900,
+          pedidoEm: new Date("2026-10-11T12:00:00Z"),
+        }),
+      ]);
+
+      const r = await repo.agregados({ de: "2026-10-01", ate: "2026-10-31", moeda: "BRL" });
+      assert.deepEqual(r.indicadores, {
+        receitaBrutaCentavos: 55_000, // A 10.000 + B 5.000 + C 30.000 + F 10.000
+        taxasCentavos: 5_500, // 1.000 + 500 + 3.000 + 1.000
+        receitaLiquidaCentavos: 49_500,
+        vendas: 4,
+        ticketMedioCentavos: 13_750,
+        compradoresUnicos: 3, // c1 (A e B), c2 (C) e o "comprador-1" padrao de F; D (reembolso) nao conta
+        reembolsadoCentavos: 10_000,
+        reembolsos: 1,
+        taxaReembolso: 1 / 5,
+        vendasAssinatura: 1,
+      });
+      assert.deepEqual(
+        r.serieDiaria.map((p) => [p.dia, p.vendas]),
+        [
+          ["2026-10-10", 2],
+          ["2026-10-12", 1],
+          ["2026-10-31", 1],
+        ],
+      );
+      assert.deepEqual(
+        r.porProduto.map((p) => [p.produtoId, p.receitaCentavos]),
+        [
+          ["202", 30_000],
+          ["101", 25_000],
+        ],
+      );
+      assert.deepEqual(r.porPagamento.map((p) => p.tipo).sort(), ["CREDIT_CARD", "PIX"]);
+      assert.deepEqual(r.porStatus.map((s) => s.status).sort(), [
+        "APPROVED",
+        "REFUNDED",
+        "WAITING_PAYMENT",
+      ]);
+
+      const usd = await repo.indicadores({ de: "2026-10-01", ate: "2026-10-31", moeda: "USD" });
+      assert.equal(usd.receitaBrutaCentavos, 99_900);
+      const soMentoria = await repo.indicadores({
+        de: "2026-10-01",
+        ate: "2026-10-31",
+        moeda: "BRL",
+        produtoId: "202",
+      });
+      assert.equal(soMentoria.vendas, 1);
+      const novembro = await repo.indicadores({
+        de: "2026-11-01",
+        ate: "2026-11-30",
+        moeda: "BRL",
+      });
+      assert.equal(novembro.vendas, 0);
+
+      assert.deepEqual(await repo.moedasDisponiveis(), ["USD", "BRL"]); // ordenadas por volume
+      assert.deepEqual(
+        (await repo.produtosDisponiveis()).map((p) => p.produtoNome),
+        ["Curso Completo", "Mentoria"],
+      );
+      const lista = await repo.listar({ de: "2026-10-01", ate: "2026-10-31", moeda: "BRL" }, 2, 0);
+      assert.equal(lista.total, 6);
+      assert.equal(lista.itens.length, 2);
+      assert.equal(lista.itens[0]?.transacao, "F"); // mais recente primeiro
+    });
+
+    test("estado de sincronizacao e lock consultivo", async () => {
+      const repo = new RepositorioVendasPg(pool);
+      assert.equal((await repo.lerEstadoSincronizacao()).status, "nunca");
+      await repo.salvarEstadoSincronizacao({
+        status: "falha",
+        mensagem: "x",
+        vendasProcessadas: 3,
+      });
+      await repo.salvarEstadoSincronizacao({
+        status: "sucesso",
+        mensagem: null,
+        ultimoSucessoEm: new Date("2026-11-01T12:00:00Z"),
+      });
+      const e = await repo.lerEstadoSincronizacao();
+      assert.equal(e.status, "sucesso");
+      assert.equal(e.mensagem, null); // null explicito limpa o aviso
+      assert.equal(e.vendasProcessadas, 3); // nao informado => preservado
+
+      const resultado = await repo.comLockDeSincronizacao(async () => {
+        const interno = await repo.comLockDeSincronizacao(async () => "nunca");
+        assert.deepEqual(interno, { ocupado: true });
+        return "externo";
+      });
+      assert.deepEqual(resultado, { ocupado: false, valor: "externo" });
+      assert.deepEqual(await repo.comLockDeSincronizacao(async () => 1), {
+        ocupado: false,
+        valor: 1,
+      });
+    });
+  },
+);
````

## `apps/api/src/migrar.ts` (novo)

````diff
diff --git a/apps/api/src/migrar.ts b/apps/api/src/migrar.ts
new file mode 100644
index 0000000..9e31aec
--- /dev/null
+++ b/apps/api/src/migrar.ts
@@ -0,0 +1,135 @@
+import { createHash } from "node:crypto";
+import { readFile, readdir } from "node:fs/promises";
+import { pathToFileURL } from "node:url";
+import { ConfigError, loadApiConfig } from "@nucleos/config";
+import { Pool } from "pg";
+import { opcoesPool } from "./banco.js";
+
+const ARQUIVO_RE = /^(\d{4})_[a-z0-9_]+\.up\.sql$/;
+/** Comandos de transacao/concorrencia proibidos: o runner ja controla a transacao (ADR-017). */
+const PROIBIDO_RE =
+  /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|START\s+TRANSACTION|CONCURRENTLY|VACUUM)\b/i;
+const LOCK_MIGRACOES = "nucleos:api:schema_migrations";
+
+export interface Migracao {
+  versao: string;
+  nome: string;
+  sql: string;
+  checksum: string;
+}
+
+export async function lerMigracoes(dir: URL): Promise<Migracao[]> {
+  const nomes = (await readdir(dir)).filter((n) => ARQUIVO_RE.test(n)).sort();
+  const saida: Migracao[] = [];
+  for (const nome of nomes) {
+    const sql = await readFile(new URL(nome, dir), "utf8");
+    if (PROIBIDO_RE.test(sql.replace(/--.*$/gm, ""))) {
+      throw new Error(`migration ${nome} controla transacao ou usa comando proibido`);
+    }
+    saida.push({
+      versao: nome.slice(0, 4),
+      nome,
+      sql,
+      checksum: createHash("sha256").update(sql).digest("hex"),
+    });
+  }
+  return saida;
+}
+
+/**
+ * Aplica migrations pendentes: advisory lock, checksum das ja aplicadas e uma transacao por
+ * arquivo (SQL + registro). Forward-only: nao existe reversao, so nova migration.
+ */
+export async function migrar(pool: Pool, migracoes: readonly Migracao[]): Promise<string[]> {
+  const conexao = await pool.connect();
+  const aplicadas: string[] = [];
+  try {
+    await conexao.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_MIGRACOES]);
+    try {
+      await conexao.query(`CREATE TABLE IF NOT EXISTS public.api_schema_migrations (
+        versao char(4) PRIMARY KEY, nome text NOT NULL, checksum char(64) NOT NULL,
+        aplicada_em timestamptz NOT NULL DEFAULT now())`);
+      const { rows } = await conexao.query(
+        "SELECT versao, checksum FROM public.api_schema_migrations",
+      );
+      const feitas = new Map(
+        (rows as { versao: string; checksum: string }[]).map((r) => [r.versao, r.checksum]),
+      );
+      for (const m of migracoes) {
+        const checksum = feitas.get(m.versao);
+        if (checksum !== undefined) {
+          if (checksum !== m.checksum)
+            throw new Error(`migration ${m.nome} foi alterada apos aplicada`);
+          continue;
+        }
+        await conexao.query("BEGIN");
+        try {
+          await conexao.query(m.sql);
+          await conexao.query(
+            "INSERT INTO public.api_schema_migrations (versao, nome, checksum) VALUES ($1, $2, $3)",
+            [m.versao, m.nome, m.checksum],
+          );
+          await conexao.query("COMMIT");
+        } catch (e) {
+          await conexao.query("ROLLBACK");
+          throw e;
+        }
+        aplicadas.push(m.nome);
+      }
+    } finally {
+      await conexao.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_MIGRACOES]);
+    }
+  } finally {
+    conexao.release();
+  }
+  return aplicadas;
+}
+
+async function lerStdin(): Promise<string> {
+  const partes: Buffer[] = [];
+  for await (const parte of process.stdin) partes.push(parte as Buffer);
+  return Buffer.concat(partes).toString("utf8");
+}
+
+// Execucao como comando (`pnpm --filter @nucleos/api migrar`); importar este arquivo nao executa nada.
+if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
+  try {
+    // `--senha-stdin`: a senha vem da entrada padrao (nunca de env, argumento ou historico), para
+    // uso do operador em dev. Sem a flag, vale a regra do servico: DATABASE_PASSWORD_FILE.
+    const porStdin = process.argv.includes("--senha-stdin");
+    let url: string | undefined;
+    let senha: string | undefined;
+    if (porStdin) {
+      url = process.env["DATABASE_URL"];
+      if (url === undefined || !URL.canParse(url) || new URL(url).password !== "") {
+        throw new Error("DATABASE_URL ausente ou com senha embutida");
+      }
+      senha = (await lerStdin()).trim();
+      if (senha === "") throw new Error("senha vazia na entrada padrao");
+    } else {
+      const config = loadApiConfig();
+      url = config.databaseUrl;
+      senha = config.databasePassword?.reveal();
+    }
+    if (url === undefined) throw new Error("DATABASE_URL ausente");
+    const pool = new Pool(opcoesPool(url, senha, 1));
+    try {
+      const aplicadas = await migrar(
+        pool,
+        await lerMigracoes(new URL("../migrations/", import.meta.url)),
+      );
+      console.log(
+        aplicadas.length === 0
+          ? "migrations: nada a aplicar"
+          : `migrations aplicadas: ${aplicadas.join(", ")}`,
+      );
+    } finally {
+      await pool.end();
+    }
+  } catch (e) {
+    console.error(
+      `migrar: ${e instanceof ConfigError ? e.message : e instanceof Error ? e.message : "falha"}`,
+    );
+    process.exitCode = 1;
+  }
+}
````

## `apps/api/src/vendas/agendador.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/agendador.ts b/apps/api/src/vendas/agendador.ts
new file mode 100644
index 0000000..5ad2d0d
--- /dev/null
+++ b/apps/api/src/vendas/agendador.ts
@@ -0,0 +1,40 @@
+/**
+ * Executa `tarefa` a cada `intervaloMs`, sem sobrepor execucoes na mesma instancia
+ * (entre instancias, quem protege e o lock do banco). Erros ficam no log, nunca derrubam o processo.
+ */
+export class Agendador {
+  #timer: NodeJS.Timeout | undefined;
+  #rodando = false;
+
+  constructor(
+    private readonly tarefa: () => Promise<unknown>,
+    private readonly intervaloMs: number,
+    private readonly log: (mensagem: string) => void = () => undefined,
+  ) {}
+
+  /** Dispara a primeira rodada de imediato (sem bloquear a subida) e agenda as seguintes. */
+  iniciar(): void {
+    if (this.#timer !== undefined) return;
+    void this.rodar();
+    this.#timer = setInterval(() => void this.rodar(), this.intervaloMs);
+    this.#timer.unref(); // o agendador sozinho nao mantem o processo vivo
+  }
+
+  parar(): void {
+    if (this.#timer !== undefined) clearInterval(this.#timer);
+    this.#timer = undefined;
+  }
+
+  async rodar(): Promise<boolean> {
+    if (this.#rodando) return false;
+    this.#rodando = true;
+    try {
+      await this.tarefa();
+    } catch {
+      this.log("vendas: a rodada agendada falhou");
+    } finally {
+      this.#rodando = false;
+    }
+    return true;
+  }
+}
````

## `apps/api/src/vendas/apoio.test.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/apoio.test.ts b/apps/api/src/vendas/apoio.test.ts
new file mode 100644
index 0000000..73d4f0e
--- /dev/null
+++ b/apps/api/src/vendas/apoio.test.ts
@@ -0,0 +1,137 @@
+import assert from "node:assert/strict";
+import type { ExecutionContext } from "@nestjs/common";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import { Agendador } from "./agendador.js";
+import { ChaveServicoGuard } from "./chave-servico.guard.js";
+import { grupoDoStatus, paraCentavos } from "./dominio.js";
+import {
+  hojeNoFuso,
+  lerDia,
+  periodoAnterior,
+  preencherSerie,
+  resolverPeriodo,
+  somarDias,
+} from "./periodo.js";
+
+test("grupos de status: desconhecido nunca vira receita", () => {
+  assert.equal(grupoDoStatus("approved"), "receita");
+  assert.equal(grupoDoStatus("COMPLETE"), "receita");
+  assert.equal(grupoDoStatus("PARTIALLY_REFUNDED"), "receita");
+  assert.equal(grupoDoStatus("REFUNDED"), "reembolso");
+  assert.equal(grupoDoStatus("CHARGEBACK"), "reembolso");
+  assert.equal(grupoDoStatus("CANCELLED"), "cancelada");
+  assert.equal(grupoDoStatus("WAITING_PAYMENT"), "pendente");
+  assert.equal(grupoDoStatus("NOVO_STATUS_DA_HOTMART"), "pendente");
+});
+
+test("centavos: arredonda float e ignora valor invalido", () => {
+  assert.equal(paraCentavos(197.9), 19790);
+  assert.equal(paraCentavos(0.1 + 0.2), 30);
+  assert.equal(paraCentavos("12.34"), 1234);
+  assert.equal(paraCentavos(undefined), 0);
+  assert.equal(paraCentavos(Number.NaN), 0);
+});
+
+test("periodo: valida dias reais, ordem e tamanho maximo", () => {
+  assert.equal(lerDia("2026-02-30"), null);
+  assert.equal(lerDia("2026-2-3"), null);
+  const agora = new Date("2026-11-01T02:00:00Z"); // 31/10 23:00 em Sao Paulo
+  assert.equal(hojeNoFuso(agora), "2026-10-31");
+  assert.deepEqual(resolverPeriodo(undefined, undefined, agora), {
+    ok: true,
+    periodo: { de: "2026-10-02", ate: "2026-10-31" },
+  });
+  assert.deepEqual(resolverPeriodo("2026-11-02", "2026-11-01", agora), {
+    ok: false,
+    erro: "ordem",
+  });
+  assert.deepEqual(resolverPeriodo("2024-01-01", "2026-01-01", agora), {
+    ok: false,
+    erro: "tamanho",
+  });
+  assert.deepEqual(resolverPeriodo("lixo", "2026-01-01", agora), { ok: false, erro: "de" });
+});
+
+test("periodo anterior tem a mesma duracao e a serie completa os dias sem venda", () => {
+  assert.deepEqual(periodoAnterior({ de: "2026-10-01", ate: "2026-10-10" }), {
+    de: "2026-09-21",
+    ate: "2026-09-30",
+  });
+  assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
+  const serie = preencherSerie({ de: "2026-10-01", ate: "2026-10-03" }, [
+    { dia: "2026-10-02", receitaCentavos: 500, vendas: 2 },
+  ]);
+  assert.deepEqual(
+    serie.map((p) => [p.dia, p.receitaCentavos]),
+    [
+      ["2026-10-01", 0],
+      ["2026-10-02", 500],
+      ["2026-10-03", 0],
+    ],
+  );
+});
+
+function contexto(authorization?: string): ExecutionContext {
+  return {
+    switchToHttp: () => ({
+      getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }),
+    }),
+  } as unknown as ExecutionContext;
+}
+
+test("guard: sem chave configurada responde 503 (fecha), com chave exige bearer exato", () => {
+  assert.throws(() => new ChaveServicoGuard(undefined).canActivate(contexto("Bearer x")), {
+    name: "ServiceUnavailableException",
+  });
+  const guard = new ChaveServicoGuard(new Secret("chave-correta"));
+  assert.equal(guard.canActivate(contexto("Bearer chave-correta")), true);
+  for (const ruim of [
+    undefined,
+    "",
+    "Bearer ",
+    "Bearer errada",
+    "chave-correta",
+    "Basic chave-correta",
+  ]) {
+    assert.throws(
+      () => guard.canActivate(contexto(ruim)),
+      { name: "UnauthorizedException" },
+      String(ruim),
+    );
+  }
+});
+
+test("agendador: nao sobrepoe execucoes, sobrevive a erro e para", async () => {
+  let ativas = 0;
+  let maxAtivas = 0;
+  let chamadas = 0;
+  let liberar: () => void = () => undefined;
+  const travada = new Promise<void>((r) => {
+    liberar = r;
+  });
+  const logs: string[] = [];
+  const ag = new Agendador(
+    async () => {
+      chamadas += 1;
+      ativas += 1;
+      maxAtivas = Math.max(maxAtivas, ativas);
+      await travada;
+      ativas -= 1;
+      throw new Error("detalhe-interno");
+    },
+    60_000,
+    (m) => logs.push(m),
+  );
+
+  const primeira = ag.rodar();
+  assert.equal(await ag.rodar(), false); // segunda chamada enquanto a primeira roda
+  liberar();
+  assert.equal(await primeira, true);
+  assert.equal(maxAtivas, 1);
+  assert.equal(chamadas, 1);
+  assert.deepEqual(logs, ["vendas: a rodada agendada falhou"]);
+  assert.equal(await ag.rodar(), true); // volta a rodar depois do erro
+  ag.iniciar();
+  ag.parar();
+});
````

## `apps/api/src/vendas/chave-servico.guard.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/chave-servico.guard.ts b/apps/api/src/vendas/chave-servico.guard.ts
new file mode 100644
index 0000000..ad9f042
--- /dev/null
+++ b/apps/api/src/vendas/chave-servico.guard.ts
@@ -0,0 +1,38 @@
+import { createHash, timingSafeEqual } from "node:crypto";
+import {
+  type CanActivate,
+  type ExecutionContext,
+  Inject,
+  Injectable,
+  ServiceUnavailableException,
+  UnauthorizedException,
+} from "@nestjs/common";
+import type { Secret } from "@nucleos/config";
+
+export const CHAVE_SERVICO = Symbol("CHAVE_SERVICO");
+
+const sha256 = (v: string): Buffer => createHash("sha256").update(v).digest();
+
+/**
+ * Exige `Authorization: Bearer <chave de servico>` (lida de arquivo). Sem chave configurada a rota
+ * responde 503 (falha fechada). Comparacao em tempo constante sobre os digests SHA-256.
+ * Provisorio: sera substituido pelo login real e pela autorizacao por papel (IAM).
+ */
+@Injectable()
+export class ChaveServicoGuard implements CanActivate {
+  constructor(@Inject(CHAVE_SERVICO) private readonly chave: Secret | undefined) {}
+
+  canActivate(contexto: ExecutionContext): boolean {
+    if (this.chave === undefined) throw new ServiceUnavailableException();
+    const req = contexto
+      .switchToHttp()
+      .getRequest<{ headers: Record<string, string | undefined> }>();
+    const cabecalho = req.headers["authorization"] ?? "";
+    const m = /^Bearer (.+)$/.exec(cabecalho);
+    const enviado = m?.[1];
+    if (enviado === undefined || !timingSafeEqual(sha256(enviado), sha256(this.chave.reveal()))) {
+      throw new UnauthorizedException();
+    }
+    return true;
+  }
+}
````

## `apps/api/src/vendas/dominio.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/dominio.ts b/apps/api/src/vendas/dominio.ts
new file mode 100644
index 0000000..d0a6178
--- /dev/null
+++ b/apps/api/src/vendas/dominio.ts
@@ -0,0 +1,62 @@
+import type { GrupoStatusVenda } from "@nucleos/contracts";
+
+/** Venda normalizada (um registro por transacao da Hotmart). Sem dados pessoais do comprador. */
+export interface Venda {
+  transacao: string;
+  produtoId: string;
+  produtoNome: string;
+  /** Pseudonimo HMAC do comprador; o e-mail original nunca e guardado. */
+  compradorId: string;
+  status: string;
+  grupo: GrupoStatusVenda;
+  pedidoEm: Date;
+  aprovadoEm: Date | null;
+  valorCentavos: number;
+  taxaCentavos: number;
+  moeda: string;
+  pagamento: string;
+  parcelas: number;
+  assinatura: boolean;
+  recorrencia: number;
+}
+
+/** Status que a API de historico da Hotmart aceita em `transaction_status`. */
+export const STATUS_HOTMART = [
+  "APPROVED",
+  "COMPLETE",
+  "CANCELLED",
+  "REFUNDED",
+  "PARTIALLY_REFUNDED",
+  "CHARGEBACK",
+  "EXPIRED",
+  "WAITING_PAYMENT",
+  "PRINTED_BILLET",
+  "UNDER_ANALISYS",
+  "STARTED",
+  "DELAYED",
+  "OVERDUE",
+  "PROTESTED",
+  "BLOCKED",
+  "NO_FUNDS",
+] as const;
+
+const REEMBOLSO = new Set(["REFUNDED", "CHARGEBACK"]);
+const CANCELADA = new Set(["CANCELLED", "EXPIRED", "PROTESTED", "BLOCKED", "NO_FUNDS"]);
+// PARTIALLY_REFUNDED continua como receita: a venda vale, e o valor devolvido nao vem neste endpoint.
+const RECEITA = new Set(["APPROVED", "COMPLETE", "PARTIALLY_REFUNDED"]);
+
+/** Classifica o status da Hotmart; status desconhecido fica pendente (nunca vira receita). */
+export function grupoDoStatus(status: string): GrupoStatusVenda {
+  const s = status.toUpperCase();
+  if (RECEITA.has(s)) return "receita";
+  if (REEMBOLSO.has(s)) return "reembolso";
+  if (CANCELADA.has(s)) return "cancelada";
+  return "pendente";
+}
+
+/** Converte valor decimal da API para centavos inteiros (arredondado; invalido vira 0). */
+export function paraCentavos(valor: unknown): number {
+  const n = typeof valor === "string" ? Number(valor) : valor;
+  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
+  return Math.round(n * 100);
+}
````

## `apps/api/src/vendas/hotmart-client.test.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/hotmart-client.test.ts b/apps/api/src/vendas/hotmart-client.test.ts
new file mode 100644
index 0000000..26f5464
--- /dev/null
+++ b/apps/api/src/vendas/hotmart-client.test.ts
@@ -0,0 +1,175 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import { HotmartClient, HotmartError, normalizarVenda } from "./hotmart-client.js";
+import type { Venda } from "./dominio.js";
+
+const ID = "CLIENT-ID-SENTINELA";
+const SEGREDO = "CLIENT-SECRET-SENTINELA";
+
+const item = (transacao: string, extra: Record<string, unknown> = {}) => ({
+  product: { id: 101, name: "Curso Completo" },
+  buyer: { name: "Fulano da Silva", email: "Fulano@Exemplo.com" },
+  purchase: {
+    transaction: transacao,
+    order_date: 1_761_998_400_000,
+    approved_date: 1_761_998_460_000,
+    status: "APPROVED",
+    price: { value: 197.9, currency_code: "BRL" },
+    hotmart_fee: { total: 19.79, currency_code: "BRL" },
+    payment: { type: "PIX", installments_number: 1 },
+    is_subscription: false,
+    recurrency_number: 1,
+    ...extra,
+  },
+});
+
+interface Chamada {
+  url: URL;
+  headers: Record<string, string>;
+}
+
+/** fetch falso: responde o token e entrega as respostas de historico da fila, em ordem. */
+function fetchFalso(historico: (() => Response)[], token: () => Response = () => tokenOk()) {
+  const chamadas: Chamada[] = [];
+  const fila = [...historico];
+  const impl: typeof fetch = async (entrada, init) => {
+    const url = new URL(
+      typeof entrada === "string" || entrada instanceof URL ? entrada : entrada.url,
+    );
+    chamadas.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
+    if (url.pathname.includes("/oauth/token")) return token();
+    const prox = fila.shift();
+    if (prox === undefined) throw new Error("sem resposta programada");
+    return prox();
+  };
+  return { impl, chamadas };
+}
+
+const json = (corpo: unknown, status = 200): Response =>
+  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
+const tokenOk = (): Response => json({ access_token: "tok-1", expires_in: 3600 });
+
+function cliente(f: typeof fetch, agora = () => 0) {
+  return new HotmartClient({
+    env: "production",
+    credenciais: { clientId: new Secret(ID), clientSecret: new Secret(SEGREDO) },
+    fetch: f,
+    agora,
+    esperar: async () => undefined,
+  });
+}
+
+const janela = { de: new Date("2026-10-01T00:00:00Z"), ate: new Date("2026-11-01T00:00:00Z") };
+
+test("normaliza o item e nao guarda e-mail nem nome do comprador", () => {
+  const v = normalizarVenda(item("HP1"), "chave") as Venda;
+  assert.equal(v.transacao, "HP1");
+  assert.equal(v.valorCentavos, 19790);
+  assert.equal(v.taxaCentavos, 1979);
+  assert.equal(v.grupo, "receita");
+  assert.equal(v.pagamento, "PIX");
+  assert.doesNotMatch(JSON.stringify(v), /exemplo|fulano/i);
+  // Mesmo comprador (caixa diferente) => mesmo pseudonimo; chave diferente => outro pseudonimo.
+  const igual = normalizarVenda(
+    { ...item("HP2"), buyer: { email: "fulano@exemplo.COM" } },
+    "chave",
+  ) as Venda;
+  assert.equal(igual.compradorId, v.compradorId);
+  assert.notEqual((normalizarVenda(item("HP1"), "outra") as Venda).compradorId, v.compradorId);
+});
+
+test("ignora itens sem transacao ou sem data e tolera campos ausentes", () => {
+  assert.equal(normalizarVenda({}, "k"), null);
+  assert.equal(normalizarVenda({ purchase: { transaction: "X" } }, "k"), null);
+  const minimo = normalizarVenda(
+    { purchase: { transaction: "X", order_date: 1_761_998_400_000 } },
+    "k",
+  ) as Venda;
+  assert.equal(minimo.moeda, "BRL");
+  assert.equal(minimo.valorCentavos, 0);
+  assert.equal(minimo.grupo, "pendente");
+});
+
+test("pagina por page_token, filtra por status e usa Basic no token", async () => {
+  const { impl, chamadas } = fetchFalso([
+    () => json({ items: [item("A"), item("B")], page_info: { next_page_token: "P2" } }),
+    () => json({ items: [item("C")], page_info: {} }),
+  ]);
+  const recebidas: string[] = [];
+  const total = await cliente(impl).listarVendas(janela, "APPROVED", "k", async (vs) => {
+    recebidas.push(...vs.map((v) => v.transacao));
+  });
+
+  assert.equal(total, 3);
+  assert.deepEqual(recebidas, ["A", "B", "C"]);
+  assert.equal(chamadas.length, 3); // token + duas paginas
+  const [token, p1, p2] = chamadas as [Chamada, Chamada, Chamada];
+  assert.equal(
+    token.headers["Authorization"],
+    `Basic ${Buffer.from(`${ID}:${SEGREDO}`).toString("base64")}`,
+  );
+  assert.equal(token.url.searchParams.get("grant_type"), "client_credentials");
+  assert.equal(p1.url.searchParams.get("transaction_status"), "APPROVED");
+  assert.equal(p1.url.searchParams.get("start_date"), String(janela.de.getTime()));
+  assert.equal(p1.url.searchParams.get("page_token"), null);
+  assert.equal(p2.url.searchParams.get("page_token"), "P2");
+  assert.equal(p2.headers["Authorization"], "Bearer tok-1");
+});
+
+test("reaproveita o token ate perto de expirar", async () => {
+  let agora = 0;
+  const { impl, chamadas } = fetchFalso([
+    () => json({ items: [] }),
+    () => json({ items: [] }),
+    () => json({ items: [] }),
+  ]);
+  const c = cliente(impl, () => agora);
+  await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
+  await c.listarVendas(janela, "COMPLETE", "k", async () => undefined);
+  agora = 3_600_000; // passou da validade (menos a margem de 60 s)
+  await c.listarVendas(janela, "REFUNDED", "k", async () => undefined);
+  assert.equal(chamadas.filter((x) => x.url.pathname.includes("/oauth/token")).length, 2);
+});
+
+test("renova o token uma vez quando a API responde 401", async () => {
+  const { impl, chamadas } = fetchFalso([() => json({}, 401), () => json({ items: [item("A")] })]);
+  const total = await cliente(impl).listarVendas(janela, "APPROVED", "k", async () => undefined);
+  assert.equal(total, 1);
+  assert.equal(chamadas.filter((x) => x.url.pathname.includes("/oauth/token")).length, 2);
+});
+
+test("credencial recusada gera erro de autenticacao sem vazar segredos", async () => {
+  const { impl } = fetchFalso([], () => json({ error: SEGREDO }, 401));
+  await assert.rejects(
+    cliente(impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
+    (e: unknown) => {
+      assert.ok(e instanceof HotmartError);
+      assert.equal(e.codigo, "autenticacao");
+      assert.doesNotMatch(`${e.message}${JSON.stringify(e)}`, new RegExp(`${ID}|${SEGREDO}`));
+      return true;
+    },
+  );
+});
+
+test("tenta de novo em 429 e falha com erro tipado quando esgota as tentativas", async () => {
+  const ok = fetchFalso([() => json({}, 429), () => json({ items: [item("A")] })]);
+  assert.equal(
+    await cliente(ok.impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
+    1,
+  );
+
+  const ruim = fetchFalso([() => json({}, 500), () => json({}, 502), () => json({}, 503)]);
+  await assert.rejects(
+    cliente(ruim.impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
+    (e: unknown) => e instanceof HotmartError && e.codigo === "http" && e.httpStatus === 503,
+  );
+});
+
+test("400 do historico vira erro http (status invalido nao e engolido)", async () => {
+  const { impl } = fetchFalso([() => json({ error: "x" }, 400)]);
+  await assert.rejects(
+    cliente(impl).listarVendas(janela, "NAO_EXISTE", "k", async () => undefined),
+    (e: unknown) => e instanceof HotmartError && e.codigo === "http" && e.httpStatus === 400,
+  );
+});
````

## `apps/api/src/vendas/hotmart-client.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/hotmart-client.ts b/apps/api/src/vendas/hotmart-client.ts
new file mode 100644
index 0000000..7cbde6c
--- /dev/null
+++ b/apps/api/src/vendas/hotmart-client.ts
@@ -0,0 +1,238 @@
+import { createHmac } from "node:crypto";
+import type { HotmartCredentials, HotmartEnv } from "@nucleos/config";
+import { type Venda, grupoDoStatus, paraCentavos } from "./dominio.js";
+
+const URL_TOKEN = "https://api-sec-vlc.hotmart.com/security/oauth/token";
+const URL_HISTORICO: Record<HotmartEnv, string> = {
+  production: "https://developers.hotmart.com/payments/api/v1/sales/history",
+  sandbox: "https://sandbox.hotmart.com/payments/api/v1/sales/history",
+};
+
+const MAX_RESULTADOS = 500;
+const MAX_PAGINAS = 1000;
+const MAX_TENTATIVAS = 3;
+const TIMEOUT_MS = 30_000;
+
+export type CodigoErroHotmart = "autenticacao" | "limite" | "http" | "rede" | "resposta";
+
+/** Erro da integracao. Mensagem fixa: nunca inclui corpo da resposta, credenciais ou URL. */
+export class HotmartError extends Error {
+  constructor(
+    readonly codigo: CodigoErroHotmart,
+    readonly httpStatus?: number,
+  ) {
+    super(
+      httpStatus === undefined
+        ? `hotmart: ${codigo}`
+        : `hotmart: ${codigo} (http ${String(httpStatus)})`,
+    );
+    this.name = "HotmartError";
+  }
+}
+
+export interface OpcoesHotmart {
+  env: HotmartEnv;
+  credenciais: HotmartCredentials;
+  fetch?: typeof fetch;
+  agora?: () => number;
+  /** Pausa entre tentativas; injetavel para testes. */
+  esperar?: (ms: number) => Promise<void>;
+}
+
+export interface JanelaConsulta {
+  de: Date;
+  ate: Date;
+}
+
+type Obj = Record<string, unknown>;
+
+function obj(v: unknown): Obj {
+  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : {};
+}
+function texto(v: unknown, padrao = ""): string {
+  return typeof v === "string" ? v : typeof v === "number" ? String(v) : padrao;
+}
+function inteiro(v: unknown, padrao: number): number {
+  return typeof v === "number" && Number.isInteger(v) ? v : padrao;
+}
+function data(v: unknown): Date | null {
+  if (typeof v !== "number" || !Number.isFinite(v)) return null;
+  const d = new Date(v);
+  return Number.isNaN(d.getTime()) ? null : d;
+}
+
+/**
+ * Converte um item de `/sales/history` em `Venda`. Devolve `null` (item ignorado) quando falta
+ * transacao ou data do pedido; o e-mail do comprador vira pseudonimo HMAC e e descartado.
+ */
+export function normalizarVenda(item: unknown, chavePseudonimo: string): Venda | null {
+  const raiz = obj(item);
+  const compra = obj(raiz["purchase"]);
+  const produto = obj(raiz["product"]);
+  const comprador = obj(raiz["buyer"]);
+  const preco = obj(compra["price"]);
+  const taxa = obj(compra["hotmart_fee"]);
+  const pagamento = obj(compra["payment"]);
+
+  const transacao = texto(compra["transaction"]);
+  const pedidoEm = data(compra["order_date"]);
+  if (transacao === "" || pedidoEm === null) return null;
+
+  const status = texto(compra["status"], "UNKNOWN").toUpperCase();
+  const identidade = (texto(comprador["email"]) || texto(comprador["ucode"]) || transacao)
+    .trim()
+    .toLowerCase();
+  const moeda = (
+    texto(preco["currency_code"]) ||
+    texto(taxa["currency_code"]) ||
+    "BRL"
+  ).toUpperCase();
+
+  return {
+    transacao,
+    produtoId: texto(produto["id"], "desconhecido"),
+    produtoNome: texto(produto["name"], "Produto sem nome"),
+    compradorId: createHmac("sha256", chavePseudonimo)
+      .update(identidade)
+      .digest("hex")
+      .slice(0, 24),
+    status,
+    grupo: grupoDoStatus(status),
+    pedidoEm,
+    aprovadoEm: data(compra["approved_date"]),
+    valorCentavos: paraCentavos(preco["value"]),
+    taxaCentavos: paraCentavos(taxa["total"]),
+    moeda: /^[A-Z]{3}$/.test(moeda) ? moeda : "BRL",
+    pagamento: texto(pagamento["type"], "DESCONHECIDO").toUpperCase(),
+    parcelas: Math.max(1, inteiro(pagamento["installments_number"], 1)),
+    assinatura: compra["is_subscription"] === true,
+    recorrencia: Math.max(0, inteiro(compra["recurrency_number"], 0)),
+  };
+}
+
+/** Cliente somente-leitura da API de pagamentos da Hotmart (historico de vendas). */
+export class HotmartClient {
+  readonly #env: HotmartEnv;
+  readonly #credenciais: HotmartCredentials;
+  readonly #fetch: typeof fetch;
+  readonly #agora: () => number;
+  readonly #esperar: (ms: number) => Promise<void>;
+  #token: { valor: string; expiraEm: number } | undefined;
+
+  constructor(opcoes: OpcoesHotmart) {
+    this.#env = opcoes.env;
+    this.#credenciais = opcoes.credenciais;
+    this.#fetch = opcoes.fetch ?? fetch;
+    this.#agora = opcoes.agora ?? Date.now;
+    this.#esperar = opcoes.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
+  }
+
+  async #obterToken(): Promise<string> {
+    if (this.#token !== undefined && this.#token.expiraEm > this.#agora()) {
+      return this.#token.valor;
+    }
+    const basic = Buffer.from(
+      `${this.#credenciais.clientId.reveal()}:${this.#credenciais.clientSecret.reveal()}`,
+    ).toString("base64");
+    const resposta = await this.#chamar(`${URL_TOKEN}?grant_type=client_credentials`, {
+      method: "POST",
+      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
+    });
+    if (resposta.status === 400 || resposta.status === 401 || resposta.status === 403) {
+      throw new HotmartError("autenticacao", resposta.status);
+    }
+    const corpo = obj(await this.#json(resposta));
+    const valor = texto(corpo["access_token"]);
+    const expiraEmSeg = typeof corpo["expires_in"] === "number" ? corpo["expires_in"] : 0;
+    if (valor === "" || expiraEmSeg <= 0) throw new HotmartError("resposta");
+    // Margem de 60 s para nao usar um token no limite da validade.
+    this.#token = { valor, expiraEm: this.#agora() + Math.max(0, expiraEmSeg - 60) * 1000 };
+    return valor;
+  }
+
+  async #json(resposta: Response): Promise<unknown> {
+    try {
+      return await resposta.json();
+    } catch {
+      throw new HotmartError("resposta");
+    }
+  }
+
+  /** `fetch` com timeout, retentativa em 429/5xx/rede e erro tipado ao esgotar. */
+  async #chamar(url: string, init: RequestInit): Promise<Response> {
+    let ultimo: HotmartError = new HotmartError("rede");
+    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
+      try {
+        const resposta = await this.#fetch(url, {
+          ...init,
+          signal: AbortSignal.timeout(TIMEOUT_MS),
+        });
+        if (resposta.status !== 429 && resposta.status < 500) return resposta;
+        ultimo = new HotmartError(resposta.status === 429 ? "limite" : "http", resposta.status);
+        const espera = Number(resposta.headers.get("retry-after"));
+        await this.#esperar(
+          Number.isFinite(espera) && espera > 0 ? espera * 1000 : 1000 * 2 ** tentativa,
+        );
+      } catch {
+        ultimo = new HotmartError("rede");
+        await this.#esperar(1000 * 2 ** tentativa);
+      }
+    }
+    throw ultimo;
+  }
+
+  async #get(url: string): Promise<Response> {
+    for (let renovou = 0; renovou < 2; renovou += 1) {
+      const token = await this.#obterToken();
+      const resposta = await this.#chamar(url, { headers: { Authorization: `Bearer ${token}` } });
+      if (resposta.status === 401 && renovou === 0) {
+        this.#token = undefined; // token revogado/expirado antes do previsto: renova uma vez
+        continue;
+      }
+      return resposta;
+    }
+    throw new HotmartError("autenticacao", 401);
+  }
+
+  /**
+   * Percorre todas as paginas de um status no intervalo e entrega cada pagina normalizada a
+   * `aoReceber` (gravacao incremental, sem acumular tudo em memoria). Devolve itens recebidos.
+   */
+  async listarVendas(
+    janela: JanelaConsulta,
+    status: string,
+    chavePseudonimo: string,
+    aoReceber: (vendas: Venda[]) => Promise<void>,
+  ): Promise<number> {
+    let token: string | undefined;
+    let total = 0;
+    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
+      const params = new URLSearchParams({
+        max_results: String(MAX_RESULTADOS),
+        start_date: String(janela.de.getTime()),
+        end_date: String(janela.ate.getTime()),
+        transaction_status: status,
+      });
+      if (token !== undefined) params.set("page_token", token);
+
+      const resposta = await this.#get(`${URL_HISTORICO[this.#env]}?${params.toString()}`);
+      if (resposta.status === 401 || resposta.status === 403) {
+        throw new HotmartError("autenticacao", resposta.status);
+      }
+      if (!resposta.ok) throw new HotmartError("http", resposta.status);
+
+      const corpo = obj(await this.#json(resposta));
+      const itens = Array.isArray(corpo["items"]) ? (corpo["items"] as unknown[]) : [];
+      const vendas = itens
+        .map((i) => normalizarVenda(i, chavePseudonimo))
+        .filter((v): v is Venda => v !== null);
+      if (vendas.length > 0) await aoReceber(vendas);
+      total += itens.length;
+
+      const proximo = texto(obj(corpo["page_info"])["next_page_token"]);
+      if (proximo === "") return total;
+      token = proximo;
+    }
+    throw new HotmartError("resposta");
+  }
+}
````

## `apps/api/src/vendas/painel.service.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/painel.service.ts b/apps/api/src/vendas/painel.service.ts
new file mode 100644
index 0000000..1e072c7
--- /dev/null
+++ b/apps/api/src/vendas/painel.service.ts
@@ -0,0 +1,55 @@
+import type { EstadoSincronizacao, PainelVendas, PeriodoVendas } from "@nucleos/contracts";
+import { periodoAnterior, preencherSerie } from "./periodo.js";
+import type { RepositorioVendas } from "./repositorio.js";
+
+export class ServicoPainelVendas {
+  constructor(
+    private readonly repo: RepositorioVendas,
+    private readonly intervaloMinutos: number,
+    private readonly sincronizacaoHabilitada: boolean,
+  ) {}
+
+  async estadoSincronizacao(): Promise<EstadoSincronizacao> {
+    const e = await this.repo.lerEstadoSincronizacao();
+    return {
+      habilitada: this.sincronizacaoHabilitada,
+      intervaloMinutos: this.intervaloMinutos,
+      status: e.status,
+      ultimaTentativaEm: e.ultimaTentativaEm?.toISOString() ?? null,
+      ultimoSucessoEm: e.ultimoSucessoEm?.toISOString() ?? null,
+      ultimasVendasProcessadas: e.vendasProcessadas,
+      mensagem: e.mensagem,
+    };
+  }
+
+  async painel(
+    periodo: PeriodoVendas,
+    moedaPedida: string | undefined,
+    produtoId: string | undefined,
+  ): Promise<PainelVendas> {
+    const [moedasDisponiveis, produtos, sincronizacao] = await Promise.all([
+      this.repo.moedasDisponiveis(),
+      this.repo.produtosDisponiveis(),
+      this.estadoSincronizacao(),
+    ]);
+    const moeda = moedaPedida ?? moedasDisponiveis[0] ?? "BRL";
+    const base = { moeda, ...(produtoId === undefined ? {} : { produtoId }) };
+    const [atual, anterior] = await Promise.all([
+      this.repo.agregados({ ...periodo, ...base }),
+      this.repo.indicadores({ ...periodoAnterior(periodo), ...base }),
+    ]);
+    return {
+      periodo,
+      moeda,
+      moedasDisponiveis,
+      produtos,
+      indicadores: atual.indicadores,
+      indicadoresAnteriores: anterior,
+      serieDiaria: preencherSerie(periodo, atual.serieDiaria),
+      porProduto: atual.porProduto,
+      porStatus: atual.porStatus,
+      porPagamento: atual.porPagamento,
+      sincronizacao,
+    };
+  }
+}
````

## `apps/api/src/vendas/periodo.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/periodo.ts b/apps/api/src/vendas/periodo.ts
new file mode 100644
index 0000000..f921dfc
--- /dev/null
+++ b/apps/api/src/vendas/periodo.ts
@@ -0,0 +1,84 @@
+import type { PeriodoVendas, PontoSerieVendas } from "@nucleos/contracts";
+
+export const FUSO = "America/Sao_Paulo";
+export const MAX_DIAS_PERIODO = 366;
+
+const DIA_MS = 86_400_000;
+const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
+
+/** Interpreta `YYYY-MM-DD` como dia do calendario (sem fuso); `null` se invalido. */
+export function lerDia(texto: string): Date | null {
+  const m = DIA_RE.exec(texto);
+  if (m === null) return null;
+  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
+  return d.toISOString().slice(0, 10) === texto ? d : null;
+}
+
+export function formatarDia(d: Date): string {
+  return d.toISOString().slice(0, 10);
+}
+
+/** Dia corrente no fuso do negocio (America/Sao_Paulo), como `YYYY-MM-DD`. */
+export function hojeNoFuso(agora: Date): string {
+  const partes = new Intl.DateTimeFormat("en-CA", {
+    timeZone: FUSO,
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+  }).format(agora);
+  return partes;
+}
+
+export function somarDias(dia: string, dias: number): string {
+  const d = lerDia(dia);
+  if (d === null) throw new RangeError("dia invalido");
+  return formatarDia(new Date(d.getTime() + dias * DIA_MS));
+}
+
+/** Quantidade de dias incluindo os dois extremos. */
+export function diasNoPeriodo(p: PeriodoVendas): number {
+  const de = lerDia(p.de);
+  const ate = lerDia(p.ate);
+  if (de === null || ate === null) throw new RangeError("periodo invalido");
+  return Math.round((ate.getTime() - de.getTime()) / DIA_MS) + 1;
+}
+
+/** Periodo imediatamente anterior, com a mesma duracao. */
+export function periodoAnterior(p: PeriodoVendas): PeriodoVendas {
+  const n = diasNoPeriodo(p);
+  return { de: somarDias(p.de, -n), ate: somarDias(p.de, -1) };
+}
+
+export type ResultadoPeriodo =
+  { ok: true; periodo: PeriodoVendas } | { ok: false; erro: "de" | "ate" | "ordem" | "tamanho" };
+
+/** Valida `de`/`ate` informados; sem eles, usa os ultimos 30 dias ate hoje (fuso do negocio). */
+export function resolverPeriodo(
+  de: string | undefined,
+  ate: string | undefined,
+  agora: Date,
+): ResultadoPeriodo {
+  const fim = ate ?? hojeNoFuso(agora);
+  if (lerDia(fim) === null) return { ok: false, erro: "ate" };
+  const inicio = de ?? somarDias(fim, -29);
+  if (lerDia(inicio) === null) return { ok: false, erro: "de" };
+  const periodo = { de: inicio, ate: fim };
+  if (inicio > fim) return { ok: false, erro: "ordem" };
+  if (diasNoPeriodo(periodo) > MAX_DIAS_PERIODO) return { ok: false, erro: "tamanho" };
+  return { ok: true, periodo };
+}
+
+/** Completa os dias sem venda com zero, para o grafico nao "pular" datas. */
+export function preencherSerie(
+  periodo: PeriodoVendas,
+  pontos: readonly PontoSerieVendas[],
+): PontoSerieVendas[] {
+  const porDia = new Map(pontos.map((p) => [p.dia, p]));
+  const saida: PontoSerieVendas[] = [];
+  const n = diasNoPeriodo(periodo);
+  for (let i = 0; i < n; i += 1) {
+    const dia = somarDias(periodo.de, i);
+    saida.push(porDia.get(dia) ?? { dia, receitaCentavos: 0, vendas: 0 });
+  }
+  return saida;
+}
````

## `apps/api/src/vendas/repositorio-pg.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/repositorio-pg.ts b/apps/api/src/vendas/repositorio-pg.ts
new file mode 100644
index 0000000..a4c04d7
--- /dev/null
+++ b/apps/api/src/vendas/repositorio-pg.ts
@@ -0,0 +1,275 @@
+import type {
+  GrupoStatusVenda,
+  IndicadoresVendas,
+  StatusSincronizacao,
+  VendaResumo,
+} from "@nucleos/contracts";
+import type { Pool } from "pg";
+import type { Venda } from "./dominio.js";
+import { FUSO } from "./periodo.js";
+import type {
+  AgregadosVendas,
+  EstadoSincronizacaoBanco,
+  FiltroVendas,
+  RepositorioVendas,
+  ResultadoComLock,
+} from "./repositorio.js";
+
+/** Chave do advisory lock que impede duas sincronizacoes simultaneas (entre instancias). */
+const LOCK_SINCRONIZACAO = 7_315_001;
+
+/** Filtro por periodo (dias no fuso do negocio), moeda e produto opcional. */
+const ONDE = `
+  pedido_em >= ($1::date)::timestamp AT TIME ZONE '${FUSO}'
+  AND pedido_em < (($2::date + 1))::timestamp AT TIME ZONE '${FUSO}'
+  AND moeda = $3
+  AND ($4::text IS NULL OR produto_id = $4)`;
+
+function parametros(f: FiltroVendas): [string, string, string, string | null] {
+  return [f.de, f.ate, f.moeda, f.produtoId ?? null];
+}
+
+const num = (v: unknown): number => Number(v ?? 0);
+
+function indicadoresDe(linha: Record<string, unknown>): IndicadoresVendas {
+  const receita = num(linha["receita"]);
+  const taxas = num(linha["taxas"]);
+  const vendas = num(linha["vendas"]);
+  const reembolsos = num(linha["reembolsos"]);
+  return {
+    receitaBrutaCentavos: receita,
+    taxasCentavos: taxas,
+    receitaLiquidaCentavos: receita - taxas,
+    vendas,
+    ticketMedioCentavos: vendas === 0 ? 0 : Math.round(receita / vendas),
+    compradoresUnicos: num(linha["compradores"]),
+    reembolsadoCentavos: num(linha["reembolsado"]),
+    reembolsos,
+    taxaReembolso: vendas + reembolsos === 0 ? 0 : reembolsos / (vendas + reembolsos),
+    vendasAssinatura: num(linha["assinaturas"]),
+  };
+}
+
+const SQL_INDICADORES = `
+  SELECT
+    COALESCE(SUM(valor_centavos) FILTER (WHERE grupo = 'receita'), 0) AS receita,
+    COALESCE(SUM(taxa_centavos)  FILTER (WHERE grupo = 'receita'), 0) AS taxas,
+    COUNT(*) FILTER (WHERE grupo = 'receita') AS vendas,
+    COUNT(DISTINCT comprador_id) FILTER (WHERE grupo = 'receita') AS compradores,
+    COALESCE(SUM(valor_centavos) FILTER (WHERE grupo = 'reembolso'), 0) AS reembolsado,
+    COUNT(*) FILTER (WHERE grupo = 'reembolso') AS reembolsos,
+    COUNT(*) FILTER (WHERE grupo = 'receita' AND assinatura) AS assinaturas
+  FROM financeiro.vendas WHERE ${ONDE}`;
+
+export class RepositorioVendasPg implements RepositorioVendas {
+  constructor(private readonly pool: Pool) {}
+
+  async gravarVendas(vendas: readonly Venda[]): Promise<number> {
+    const unicas = [...new Map(vendas.map((v) => [v.transacao, v])).values()];
+    if (unicas.length === 0) return 0;
+    await this.pool.query(
+      `INSERT INTO financeiro.vendas
+         (transacao, produto_id, produto_nome, comprador_id, status, grupo, pedido_em, aprovado_em,
+          valor_centavos, taxa_centavos, moeda, pagamento, parcelas, assinatura, recorrencia)
+       SELECT * FROM unnest(
+         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
+         $7::timestamptz[], $8::timestamptz[], $9::bigint[], $10::bigint[], $11::char(3)[],
+         $12::text[], $13::integer[], $14::boolean[], $15::integer[])
+       ON CONFLICT (transacao) DO UPDATE SET
+         produto_id = EXCLUDED.produto_id, produto_nome = EXCLUDED.produto_nome,
+         comprador_id = EXCLUDED.comprador_id, status = EXCLUDED.status, grupo = EXCLUDED.grupo,
+         pedido_em = EXCLUDED.pedido_em, aprovado_em = EXCLUDED.aprovado_em,
+         valor_centavos = EXCLUDED.valor_centavos, taxa_centavos = EXCLUDED.taxa_centavos,
+         moeda = EXCLUDED.moeda, pagamento = EXCLUDED.pagamento, parcelas = EXCLUDED.parcelas,
+         assinatura = EXCLUDED.assinatura, recorrencia = EXCLUDED.recorrencia,
+         sincronizado_em = now()`,
+      [
+        unicas.map((v) => v.transacao),
+        unicas.map((v) => v.produtoId),
+        unicas.map((v) => v.produtoNome),
+        unicas.map((v) => v.compradorId),
+        unicas.map((v) => v.status),
+        unicas.map((v) => v.grupo),
+        unicas.map((v) => v.pedidoEm),
+        unicas.map((v) => v.aprovadoEm),
+        unicas.map((v) => v.valorCentavos),
+        unicas.map((v) => v.taxaCentavos),
+        unicas.map((v) => v.moeda),
+        unicas.map((v) => v.pagamento),
+        unicas.map((v) => v.parcelas),
+        unicas.map((v) => v.assinatura),
+        unicas.map((v) => v.recorrencia),
+      ],
+    );
+    return unicas.length;
+  }
+
+  async lerEstadoSincronizacao(): Promise<EstadoSincronizacaoBanco> {
+    const { rows } = await this.pool.query(
+      `SELECT status, ultima_tentativa_em, ultimo_sucesso_em, ultima_reconciliacao_em,
+              vendas_processadas, mensagem
+         FROM financeiro.sincronizacao_estado WHERE id = 1`,
+    );
+    const r = (rows[0] ?? {}) as Record<string, unknown>;
+    return {
+      status: (r["status"] as StatusSincronizacao | undefined) ?? "nunca",
+      ultimaTentativaEm: (r["ultima_tentativa_em"] as Date | null | undefined) ?? null,
+      ultimoSucessoEm: (r["ultimo_sucesso_em"] as Date | null | undefined) ?? null,
+      ultimaReconciliacaoEm: (r["ultima_reconciliacao_em"] as Date | null | undefined) ?? null,
+      vendasProcessadas: num(r["vendas_processadas"]),
+      mensagem: (r["mensagem"] as string | null | undefined) ?? null,
+    };
+  }
+
+  async salvarEstadoSincronizacao(p: Partial<EstadoSincronizacaoBanco>): Promise<void> {
+    // COALESCE nos campos nao informados; `mensagem` aceita null explicito (limpa o aviso).
+    await this.pool.query(
+      `UPDATE financeiro.sincronizacao_estado SET
+         status = COALESCE($1, status),
+         ultima_tentativa_em = COALESCE($2, ultima_tentativa_em),
+         ultimo_sucesso_em = COALESCE($3, ultimo_sucesso_em),
+         ultima_reconciliacao_em = COALESCE($4, ultima_reconciliacao_em),
+         vendas_processadas = COALESCE($5, vendas_processadas),
+         mensagem = CASE WHEN $6::boolean THEN $7 ELSE mensagem END
+       WHERE id = 1`,
+      [
+        p.status ?? null,
+        p.ultimaTentativaEm ?? null,
+        p.ultimoSucessoEm ?? null,
+        p.ultimaReconciliacaoEm ?? null,
+        p.vendasProcessadas ?? null,
+        p.mensagem !== undefined,
+        p.mensagem ?? null,
+      ],
+    );
+  }
+
+  async comLockDeSincronizacao<T>(fn: () => Promise<T>): Promise<ResultadoComLock<T>> {
+    const conexao = await this.pool.connect();
+    try {
+      const { rows } = await conexao.query("SELECT pg_try_advisory_lock($1) AS ok", [
+        LOCK_SINCRONIZACAO,
+      ]);
+      if ((rows[0] as { ok: boolean } | undefined)?.ok !== true) return { ocupado: true };
+      try {
+        return { ocupado: false, valor: await fn() };
+      } finally {
+        await conexao.query("SELECT pg_advisory_unlock($1)", [LOCK_SINCRONIZACAO]);
+      }
+    } finally {
+      conexao.release();
+    }
+  }
+
+  async indicadores(filtro: FiltroVendas): Promise<IndicadoresVendas> {
+    const { rows } = await this.pool.query(SQL_INDICADORES, parametros(filtro));
+    return indicadoresDe((rows[0] ?? {}) as Record<string, unknown>);
+  }
+
+  async agregados(filtro: FiltroVendas): Promise<AgregadosVendas> {
+    const p = parametros(filtro);
+    const [indicadores, serie, produtos, status, pagamentos] = await Promise.all([
+      this.indicadores(filtro),
+      this.pool.query(
+        `SELECT to_char((pedido_em AT TIME ZONE '${FUSO}')::date, 'YYYY-MM-DD') AS dia,
+                SUM(valor_centavos) AS receita, COUNT(*) AS vendas
+           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
+          GROUP BY 1 ORDER BY 1`,
+        p,
+      ),
+      this.pool.query(
+        `SELECT produto_id, (array_agg(produto_nome ORDER BY pedido_em DESC))[1] AS produto_nome,
+                SUM(valor_centavos) AS receita, COUNT(*) AS vendas
+           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
+          GROUP BY produto_id ORDER BY receita DESC, produto_id LIMIT 10`,
+        p,
+      ),
+      this.pool.query(
+        `SELECT status, grupo, COUNT(*) AS vendas, SUM(valor_centavos) AS valor
+           FROM financeiro.vendas WHERE ${ONDE}
+          GROUP BY status, grupo ORDER BY vendas DESC, status`,
+        p,
+      ),
+      this.pool.query(
+        `SELECT pagamento, SUM(valor_centavos) AS receita, COUNT(*) AS vendas
+           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
+          GROUP BY pagamento ORDER BY receita DESC, pagamento`,
+        p,
+      ),
+    ]);
+    return {
+      indicadores,
+      serieDiaria: serie.rows.map((r: Record<string, unknown>) => ({
+        dia: String(r["dia"]),
+        receitaCentavos: num(r["receita"]),
+        vendas: num(r["vendas"]),
+      })),
+      porProduto: produtos.rows.map((r: Record<string, unknown>) => ({
+        produtoId: String(r["produto_id"]),
+        produtoNome: String(r["produto_nome"]),
+        receitaCentavos: num(r["receita"]),
+        vendas: num(r["vendas"]),
+      })),
+      porStatus: status.rows.map((r: Record<string, unknown>) => ({
+        status: String(r["status"]),
+        grupo: r["grupo"] as GrupoStatusVenda,
+        vendas: num(r["vendas"]),
+        valorCentavos: num(r["valor"]),
+      })),
+      porPagamento: pagamentos.rows.map((r: Record<string, unknown>) => ({
+        tipo: String(r["pagamento"]),
+        vendas: num(r["vendas"]),
+        receitaCentavos: num(r["receita"]),
+      })),
+    };
+  }
+
+  async moedasDisponiveis(): Promise<string[]> {
+    const { rows } = await this.pool.query(
+      `SELECT moeda FROM financeiro.vendas GROUP BY moeda ORDER BY SUM(valor_centavos) DESC, moeda`,
+    );
+    return rows.map((r: { moeda: string }) => r.moeda);
+  }
+
+  async produtosDisponiveis(): Promise<{ produtoId: string; produtoNome: string }[]> {
+    const { rows } = await this.pool.query(
+      `SELECT DISTINCT ON (produto_id) produto_id, produto_nome
+         FROM financeiro.vendas ORDER BY produto_id, pedido_em DESC`,
+    );
+    return (rows as { produto_id: string; produto_nome: string }[])
+      .map((r) => ({ produtoId: r.produto_id, produtoNome: r.produto_nome }))
+      .sort((a, b) => a.produtoNome.localeCompare(b.produtoNome, "pt-BR"));
+  }
+
+  async listar(
+    filtro: FiltroVendas,
+    limite: number,
+    deslocamento: number,
+  ): Promise<{ itens: VendaResumo[]; total: number }> {
+    const { rows } = await this.pool.query(
+      `SELECT transacao, produto_nome, comprador_id, status, grupo, pedido_em, valor_centavos,
+              taxa_centavos, moeda, pagamento, parcelas, assinatura, COUNT(*) OVER () AS total
+         FROM financeiro.vendas WHERE ${ONDE}
+        ORDER BY pedido_em DESC, transacao LIMIT $5 OFFSET $6`,
+      [...parametros(filtro), limite, deslocamento],
+    );
+    const linhas = rows as Record<string, unknown>[];
+    return {
+      total: linhas.length === 0 ? 0 : num(linhas[0]?.["total"]),
+      itens: linhas.map((r) => ({
+        transacao: String(r["transacao"]),
+        produtoNome: String(r["produto_nome"]),
+        compradorId: String(r["comprador_id"]),
+        status: String(r["status"]),
+        grupo: r["grupo"] as GrupoStatusVenda,
+        pedidoEm: (r["pedido_em"] as Date).toISOString(),
+        valorCentavos: num(r["valor_centavos"]),
+        taxaCentavos: num(r["taxa_centavos"]),
+        moeda: String(r["moeda"]).trim(),
+        pagamento: String(r["pagamento"]),
+        parcelas: num(r["parcelas"]),
+        assinatura: r["assinatura"] === true,
+      })),
+    };
+  }
+}
````

## `apps/api/src/vendas/repositorio.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/repositorio.ts b/apps/api/src/vendas/repositorio.ts
new file mode 100644
index 0000000..b36ee32
--- /dev/null
+++ b/apps/api/src/vendas/repositorio.ts
@@ -0,0 +1,63 @@
+import type {
+  GrupoStatusVenda,
+  IndicadoresVendas,
+  PontoSerieVendas,
+  StatusSincronizacao,
+  VendaResumo,
+  VendasPorPagamento,
+  VendasPorProduto,
+  VendasPorStatus,
+} from "@nucleos/contracts";
+import type { Venda } from "./dominio.js";
+
+export const REPOSITORIO_VENDAS = Symbol("REPOSITORIO_VENDAS");
+
+export interface FiltroVendas {
+  /** Primeiro dia incluido (YYYY-MM-DD, fuso America/Sao_Paulo). */
+  de: string;
+  /** Ultimo dia incluido (YYYY-MM-DD). */
+  ate: string;
+  moeda: string;
+  produtoId?: string;
+}
+
+export interface EstadoSincronizacaoBanco {
+  status: StatusSincronizacao;
+  ultimaTentativaEm: Date | null;
+  ultimoSucessoEm: Date | null;
+  ultimaReconciliacaoEm: Date | null;
+  vendasProcessadas: number;
+  mensagem: string | null;
+}
+
+export interface AgregadosVendas {
+  indicadores: IndicadoresVendas;
+  /** Apenas dias com movimento; o preenchimento dos demais e feito na camada de servico. */
+  serieDiaria: PontoSerieVendas[];
+  porProduto: VendasPorProduto[];
+  porStatus: VendasPorStatus[];
+  porPagamento: VendasPorPagamento[];
+}
+
+export type ResultadoComLock<T> = { ocupado: true } | { ocupado: false; valor: T };
+
+export interface RepositorioVendas {
+  /** Insere ou atualiza por `transacao` (idempotente). Devolve quantas linhas foram processadas. */
+  gravarVendas(vendas: readonly Venda[]): Promise<number>;
+  lerEstadoSincronizacao(): Promise<EstadoSincronizacaoBanco>;
+  salvarEstadoSincronizacao(parcial: Partial<EstadoSincronizacaoBanco>): Promise<void>;
+  /** Executa `fn` somente se nenhuma outra instancia estiver sincronizando (lock consultivo). */
+  comLockDeSincronizacao<T>(fn: () => Promise<T>): Promise<ResultadoComLock<T>>;
+
+  agregados(filtro: FiltroVendas): Promise<AgregadosVendas>;
+  indicadores(filtro: FiltroVendas): Promise<IndicadoresVendas>;
+  moedasDisponiveis(): Promise<string[]>;
+  produtosDisponiveis(): Promise<{ produtoId: string; produtoNome: string }[]>;
+  listar(
+    filtro: FiltroVendas,
+    limite: number,
+    deslocamento: number,
+  ): Promise<{ itens: VendaResumo[]; total: number }>;
+}
+
+export type { GrupoStatusVenda };
````

## `apps/api/src/vendas/sincronizacao.test.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/sincronizacao.test.ts b/apps/api/src/vendas/sincronizacao.test.ts
new file mode 100644
index 0000000..1e258ca
--- /dev/null
+++ b/apps/api/src/vendas/sincronizacao.test.ts
@@ -0,0 +1,156 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { type Venda, STATUS_HOTMART } from "./dominio.js";
+import { type HotmartClient, HotmartError } from "./hotmart-client.js";
+import type { EstadoSincronizacaoBanco, RepositorioVendas } from "./repositorio.js";
+import { SincronizacaoVendas } from "./sincronizacao.js";
+
+const DIA = 86_400_000;
+const AGORA = new Date("2026-11-01T12:00:00.000Z");
+
+const venda = (transacao: string): Venda => ({
+  transacao,
+  produtoId: "1",
+  produtoNome: "Curso",
+  compradorId: "c",
+  status: "APPROVED",
+  grupo: "receita",
+  pedidoEm: AGORA,
+  aprovadoEm: null,
+  valorCentavos: 100,
+  taxaCentavos: 10,
+  moeda: "BRL",
+  pagamento: "PIX",
+  parcelas: 1,
+  assinatura: false,
+  recorrencia: 0,
+});
+
+function repoFalso(inicial: Partial<EstadoSincronizacaoBanco> = {}, ocupado = false) {
+  const estado: EstadoSincronizacaoBanco = {
+    status: "nunca",
+    ultimaTentativaEm: null,
+    ultimoSucessoEm: null,
+    ultimaReconciliacaoEm: null,
+    vendasProcessadas: 0,
+    mensagem: null,
+    ...inicial,
+  };
+  const gravadas: string[] = [];
+  const repo = {
+    gravarVendas: async (vs: readonly Venda[]) => {
+      gravadas.push(...vs.map((v) => v.transacao));
+      return vs.length;
+    },
+    lerEstadoSincronizacao: async () => ({ ...estado }),
+    salvarEstadoSincronizacao: async (p: Partial<EstadoSincronizacaoBanco>) => {
+      Object.assign(estado, p);
+    },
+    comLockDeSincronizacao: async <T>(fn: () => Promise<T>) =>
+      ocupado ? { ocupado: true as const } : { ocupado: false as const, valor: await fn() },
+  } as unknown as RepositorioVendas;
+  return { repo, estado, gravadas };
+}
+
+interface Consulta {
+  de: Date;
+  status: string;
+}
+function clienteFalso(comportamento: (status: string) => Venda[] | Error) {
+  const consultas: Consulta[] = [];
+  const cliente = {
+    listarVendas: async (
+      janela: { de: Date; ate: Date },
+      status: string,
+      _k: string,
+      aoReceber: (v: Venda[]) => Promise<void>,
+    ) => {
+      consultas.push({ de: janela.de, status });
+      const r = comportamento(status);
+      if (r instanceof Error) throw r;
+      if (r.length > 0) await aoReceber(r);
+      return r.length;
+    },
+  } as unknown as HotmartClient;
+  return { cliente, consultas };
+}
+
+const sync = (repo: RepositorioVendas, cliente: HotmartClient | undefined) =>
+  new SincronizacaoVendas(repo, cliente, {
+    backfillDias: 90,
+    chavePseudonimo: "k",
+    agora: () => AGORA,
+  });
+
+test("sem credenciais a verificacao fica desabilitada", async () => {
+  const { repo } = repoFalso();
+  assert.deepEqual(await sync(repo, undefined).executar(), { resultado: "desabilitada" });
+});
+
+test("primeira execucao carrega o backfill e consulta todos os status", async () => {
+  const { repo, estado, gravadas } = repoFalso();
+  const { cliente, consultas } = clienteFalso((s) => (s === "APPROVED" ? [venda("A")] : []));
+  const r = await sync(repo, cliente).executar();
+
+  assert.deepEqual(r, { resultado: "sucesso", processadas: 1, mensagem: null });
+  assert.deepEqual(gravadas, ["A"]);
+  assert.equal(consultas.length, STATUS_HOTMART.length);
+  assert.equal(consultas[0]?.de.getTime(), AGORA.getTime() - 90 * DIA);
+  assert.equal(estado.status, "sucesso");
+  assert.equal(estado.ultimoSucessoEm?.getTime(), AGORA.getTime());
+  assert.equal(estado.ultimaReconciliacaoEm?.getTime(), AGORA.getTime());
+});
+
+test("execucao incremental reconsulta so desde o ultimo sucesso menos 2 dias", async () => {
+  const ultimo = new Date(AGORA.getTime() - 30 * 60_000);
+  const { repo } = repoFalso({
+    ultimoSucessoEm: ultimo,
+    ultimaReconciliacaoEm: ultimo,
+    status: "sucesso",
+  });
+  const { cliente, consultas } = clienteFalso(() => []);
+  await sync(repo, cliente).executar();
+  assert.equal(consultas[0]?.de.getTime(), ultimo.getTime() - 2 * DIA);
+});
+
+test("passado um dia, reconcilia 30 dias e atualiza a reconciliacao", async () => {
+  const ontem = new Date(AGORA.getTime() - DIA - 1000);
+  const { repo, estado } = repoFalso({
+    ultimoSucessoEm: ontem,
+    ultimaReconciliacaoEm: ontem,
+    status: "sucesso",
+  });
+  const { cliente, consultas } = clienteFalso(() => []);
+  await sync(repo, cliente).executar();
+  assert.equal(consultas[0]?.de.getTime(), AGORA.getTime() - 30 * DIA);
+  assert.equal(estado.ultimaReconciliacaoEm?.getTime(), AGORA.getTime());
+});
+
+test("falha parcial grava o que veio, nao avanca o ultimo sucesso e informa o codigo", async () => {
+  const { repo, estado } = repoFalso();
+  const { cliente } = clienteFalso((s) =>
+    s === "APPROVED" ? [venda("A")] : s === "REFUNDED" ? new HotmartError("http", 400) : [],
+  );
+  const r = await sync(repo, cliente).executar();
+
+  assert.equal(r.resultado, "parcial");
+  assert.equal(estado.status, "parcial");
+  assert.equal(estado.ultimoSucessoEm, null);
+  assert.match(estado.mensagem ?? "", /hotmart: http \(http 400\)/);
+});
+
+test("falha de autenticacao interrompe as demais consultas", async () => {
+  const { repo, estado } = repoFalso();
+  const { cliente, consultas } = clienteFalso(() => new HotmartError("autenticacao", 401));
+  const r = await sync(repo, cliente).executar();
+  assert.equal(r.resultado, "falha");
+  assert.equal(consultas.length, 1);
+  assert.equal(estado.status, "falha");
+});
+
+test("outra instancia sincronizando => ocupada e nada consultado", async () => {
+  const { repo } = repoFalso({}, true);
+  const { cliente, consultas } = clienteFalso(() => []);
+  assert.deepEqual(await sync(repo, cliente).executar(), { resultado: "ocupada" });
+  assert.equal(consultas.length, 0);
+});
````

## `apps/api/src/vendas/sincronizacao.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/sincronizacao.ts b/apps/api/src/vendas/sincronizacao.ts
new file mode 100644
index 0000000..be692cf
--- /dev/null
+++ b/apps/api/src/vendas/sincronizacao.ts
@@ -0,0 +1,111 @@
+import { STATUS_HOTMART } from "./dominio.js";
+import { type HotmartClient, HotmartError } from "./hotmart-client.js";
+import type { RepositorioVendas } from "./repositorio.js";
+
+export const SINCRONIZACAO_VENDAS = Symbol("SINCRONIZACAO_VENDAS");
+
+const DIA_MS = 86_400_000;
+/** Cada execucao reconsulta os ultimos 2 dias alem do ultimo sucesso (mudancas de status recentes). */
+const SOBREPOSICAO_MS = 2 * DIA_MS;
+/** Uma vez por dia reconsulta 30 dias para capturar reembolsos e chargebacks tardios. */
+const JANELA_RECONCILIACAO_MS = 30 * DIA_MS;
+const INTERVALO_RECONCILIACAO_MS = DIA_MS;
+
+export type ResultadoSincronizacao =
+  | { resultado: "desabilitada" }
+  | { resultado: "ocupada" }
+  | { resultado: "sucesso" | "parcial" | "falha"; processadas: number; mensagem: string | null };
+
+export interface OpcoesSincronizacao {
+  backfillDias: number;
+  agora?: () => Date;
+  /** Chave do pseudonimo do comprador (HMAC). */
+  chavePseudonimo: string;
+  log?: (mensagem: string) => void;
+}
+
+export class SincronizacaoVendas {
+  readonly #agora: () => Date;
+
+  constructor(
+    private readonly repo: RepositorioVendas,
+    private readonly cliente: HotmartClient | undefined,
+    private readonly opcoes: OpcoesSincronizacao,
+  ) {
+    this.#agora = opcoes.agora ?? (() => new Date());
+  }
+
+  get habilitada(): boolean {
+    return this.cliente !== undefined;
+  }
+
+  /** Executa uma rodada. Nunca lanca por falha da Hotmart: o resultado vai para o estado salvo. */
+  async executar(): Promise<ResultadoSincronizacao> {
+    const cliente = this.cliente;
+    if (cliente === undefined) return { resultado: "desabilitada" };
+
+    const bloqueio = await this.repo.comLockDeSincronizacao(() => this.#rodada(cliente));
+    return bloqueio.ocupado ? { resultado: "ocupada" } : bloqueio.valor;
+  }
+
+  async #rodada(cliente: HotmartClient): Promise<ResultadoSincronizacao> {
+    const inicio = this.#agora();
+    const estado = await this.repo.lerEstadoSincronizacao();
+    const reconciliar =
+      estado.ultimaReconciliacaoEm === null ||
+      inicio.getTime() - estado.ultimaReconciliacaoEm.getTime() >= INTERVALO_RECONCILIACAO_MS;
+
+    let de: Date;
+    if (estado.ultimoSucessoEm === null)
+      de = new Date(inicio.getTime() - this.opcoes.backfillDias * DIA_MS);
+    else if (reconciliar) de = new Date(inicio.getTime() - JANELA_RECONCILIACAO_MS);
+    else de = new Date(estado.ultimoSucessoEm.getTime() - SOBREPOSICAO_MS);
+
+    await this.repo.salvarEstadoSincronizacao({
+      status: "em_andamento",
+      ultimaTentativaEm: inicio,
+    });
+
+    let processadas = 0;
+    const falhas: string[] = [];
+    for (const status of STATUS_HOTMART) {
+      try {
+        await cliente.listarVendas(
+          { de, ate: inicio },
+          status,
+          this.opcoes.chavePseudonimo,
+          async (vendas) => {
+            processadas += await this.repo.gravarVendas(vendas);
+          },
+        );
+      } catch (e) {
+        const motivo = e instanceof HotmartError ? e.message : "hotmart: erro inesperado";
+        falhas.push(motivo);
+        // Credencial invalida falha todas as consultas: nao adianta repetir 15 vezes.
+        if (e instanceof HotmartError && e.codigo === "autenticacao") break;
+      }
+    }
+
+    const mensagem = falhas.length === 0 ? null : resumirFalhas(falhas);
+    const resultado = falhas.length === 0 ? "sucesso" : processadas > 0 ? "parcial" : "falha";
+    await this.repo.salvarEstadoSincronizacao({
+      status: resultado,
+      vendasProcessadas: processadas,
+      mensagem,
+      ...(resultado === "sucesso"
+        ? {
+            ultimoSucessoEm: inicio,
+            ...(reconciliar ? { ultimaReconciliacaoEm: inicio } : {}),
+          }
+        : {}),
+    });
+    this.opcoes.log?.(`vendas: sincronizacao ${resultado} (${String(processadas)} registros)`);
+    return { resultado, processadas, mensagem };
+  }
+}
+
+/** Mensagem curta e deduplicada, com so os codigos fixos do cliente (sem corpo de resposta). */
+function resumirFalhas(falhas: readonly string[]): string {
+  const unicas = [...new Set(falhas)];
+  return `${String(falhas.length)} consulta(s) falharam: ${unicas.slice(0, 3).join("; ")}`;
+}
````

## `apps/api/src/vendas/vendas.controller.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/vendas.controller.ts b/apps/api/src/vendas/vendas.controller.ts
new file mode 100644
index 0000000..89f6106
--- /dev/null
+++ b/apps/api/src/vendas/vendas.controller.ts
@@ -0,0 +1,97 @@
+import {
+  BadRequestException,
+  Controller,
+  Get,
+  HttpCode,
+  Inject,
+  Post,
+  Query,
+  UseGuards,
+} from "@nestjs/common";
+import type { EstadoSincronizacao, ListaVendas, PainelVendas } from "@nucleos/contracts";
+import { ChaveServicoGuard } from "./chave-servico.guard.js";
+import { ServicoPainelVendas } from "./painel.service.js";
+import { resolverPeriodo } from "./periodo.js";
+import { REPOSITORIO_VENDAS, type RepositorioVendas } from "./repositorio.js";
+import { SINCRONIZACAO_VENDAS, type SincronizacaoVendas } from "./sincronizacao.js";
+
+type Consulta = Record<string, unknown>;
+
+/** Aceita so texto simples e curto; qualquer outra forma (array, objeto) e parametro invalido. */
+function textoOpcional(q: Consulta, nome: string, padrao: RegExp): string | undefined {
+  const v = q[nome];
+  if (v === undefined || v === "") return undefined;
+  if (typeof v !== "string" || v.length > 64 || !padrao.test(v)) {
+    throw new BadRequestException(`parametro invalido: ${nome}`);
+  }
+  return v;
+}
+
+function inteiroOpcional(
+  q: Consulta,
+  nome: string,
+  min: number,
+  max: number,
+  padrao: number,
+): number {
+  const v = textoOpcional(q, nome, /^\d{1,7}$/);
+  if (v === undefined) return padrao;
+  const n = Number(v);
+  if (n < min || n > max) throw new BadRequestException(`parametro invalido: ${nome}`);
+  return n;
+}
+
+@Controller("v1/vendas")
+@UseGuards(ChaveServicoGuard)
+export class VendasController {
+  constructor(
+    @Inject(ServicoPainelVendas) private readonly painel: ServicoPainelVendas,
+    @Inject(REPOSITORIO_VENDAS) private readonly repo: RepositorioVendas,
+    @Inject(SINCRONIZACAO_VENDAS) private readonly sincronizacao: SincronizacaoVendas,
+  ) {}
+
+  #filtro(q: Consulta) {
+    const de = textoOpcional(q, "de", /^\d{4}-\d{2}-\d{2}$/);
+    const ate = textoOpcional(q, "ate", /^\d{4}-\d{2}-\d{2}$/);
+    const periodo = resolverPeriodo(de, ate, new Date());
+    if (!periodo.ok) throw new BadRequestException(`periodo invalido: ${periodo.erro}`);
+    return {
+      periodo: periodo.periodo,
+      moeda: textoOpcional(q, "moeda", /^[A-Z]{3}$/),
+      produtoId: textoOpcional(q, "produto", /^[\w.-]{1,64}$/),
+    };
+  }
+
+  @Get("painel")
+  obterPainel(@Query() q: Consulta): Promise<PainelVendas> {
+    const f = this.#filtro(q);
+    return this.painel.painel(f.periodo, f.moeda, f.produtoId);
+  }
+
+  @Get()
+  async listar(@Query() q: Consulta): Promise<ListaVendas> {
+    const f = this.#filtro(q);
+    const limite = inteiroOpcional(q, "limite", 1, 100, 25);
+    const deslocamento = inteiroOpcional(q, "deslocamento", 0, 1_000_000, 0);
+    const moeda = f.moeda ?? (await this.repo.moedasDisponiveis())[0] ?? "BRL";
+    const { itens, total } = await this.repo.listar(
+      { ...f.periodo, moeda, ...(f.produtoId === undefined ? {} : { produtoId: f.produtoId }) },
+      limite,
+      deslocamento,
+    );
+    return { itens, total, limite, deslocamento };
+  }
+
+  @Get("sincronizacao")
+  estado(): Promise<EstadoSincronizacao> {
+    return this.painel.estadoSincronizacao();
+  }
+
+  /** Dispara uma rodada agora (sem esperar os 30 min). Responde 202 e roda em segundo plano. */
+  @Post("sincronizacao")
+  @HttpCode(202)
+  async sincronizarAgora(): Promise<EstadoSincronizacao> {
+    void this.sincronizacao.executar().catch(() => undefined);
+    return this.painel.estadoSincronizacao();
+  }
+}
````

## `apps/api/src/vendas/vendas.http.test.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/vendas.http.test.ts b/apps/api/src/vendas/vendas.http.test.ts
new file mode 100644
index 0000000..4ff6627
--- /dev/null
+++ b/apps/api/src/vendas/vendas.http.test.ts
@@ -0,0 +1,105 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import { after, before, describe, test } from "node:test";
+import { type INestApplication } from "@nestjs/common";
+import { NestFactory } from "@nestjs/core";
+import { Secret, type VendasConfig } from "@nucleos/config";
+import type { PainelVendas } from "@nucleos/contracts";
+import type { Pool } from "pg";
+import { AppModule } from "../app.module.js";
+import { VendasModule } from "./vendas.module.js";
+
+const CHAVE = "chave-de-teste-sentinela";
+
+/** Pool falso: toda consulta devolve zero linhas (banco vazio); basta para exercitar a fiacao HTTP. */
+const poolVazio = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
+
+function config(apiKey: Secret | undefined): VendasConfig {
+  return {
+    hotmartEnv: "production",
+    hotmart: undefined,
+    syncIntervalMs: 1_800_000,
+    backfillDays: 90,
+    apiKey,
+  };
+}
+
+async function subir(apiKey: Secret | undefined): Promise<{ app: INestApplication; base: string }> {
+  const app = await NestFactory.create(
+    AppModule.comModulos([VendasModule.registrar({ config: config(apiKey), pool: poolVazio })]),
+    { logger: false },
+  );
+  await app.listen(0, "127.0.0.1");
+  const url = await app.getUrl();
+  return { app, base: url.replace("[::1]", "127.0.0.1") };
+}
+
+const auth = { authorization: `Bearer ${CHAVE}` };
+
+describe("API de vendas (HTTP)", () => {
+  let app: INestApplication;
+  let base: string;
+  before(async () => ({ app, base } = await subir(new Secret(CHAVE))));
+  after(async () => app.close());
+
+  test("sem bearer ou com bearer errado => 401, sem vazar a chave", async () => {
+    for (const headers of [{}, { authorization: "Bearer errada" }]) {
+      const r = await fetch(`${base}/v1/vendas/painel`, { headers });
+      assert.equal(r.status, 401);
+      assert.doesNotMatch(await r.text(), new RegExp(CHAVE));
+    }
+  });
+
+  test("painel vazio: 200, 30 dias preenchidos, indicadores zerados e sincronizacao nunca", async () => {
+    const r = await fetch(`${base}/v1/vendas/painel`, { headers: auth });
+    assert.equal(r.status, 200);
+    const p = (await r.json()) as PainelVendas;
+    assert.equal(p.serieDiaria.length, 30);
+    assert.equal(p.moeda, "BRL");
+    assert.equal(p.indicadores.vendas, 0);
+    assert.equal(p.indicadores.taxaReembolso, 0);
+    assert.equal(p.sincronizacao.status, "nunca");
+    assert.equal(p.sincronizacao.habilitada, false);
+    assert.equal(p.sincronizacao.intervaloMinutos, 30);
+  });
+
+  test("parametros invalidos => 400 sem eco do valor", async () => {
+    const ruins = [
+      "de=2026-13-45",
+      "ate=ontem",
+      "de=2026-11-02&ate=2026-11-01",
+      "de=2020-01-01&ate=2026-01-01",
+      "moeda=real",
+      "produto=a%20b%3Bdrop",
+      "de=2026-01-01&de=2026-01-02",
+    ];
+    for (const q of ruins) {
+      const r = await fetch(`${base}/v1/vendas/painel?${q}`, { headers: auth });
+      assert.equal(r.status, 400, q);
+      assert.doesNotMatch(await r.text(), /drop|real|ontem/i, q);
+    }
+    const lista = await fetch(`${base}/v1/vendas?limite=1000`, { headers: auth });
+    assert.equal(lista.status, 400);
+  });
+
+  test("lista e estado da sincronizacao respondem, e o disparo manual devolve 202", async () => {
+    const lista = await fetch(`${base}/v1/vendas?limite=10`, { headers: auth });
+    assert.deepEqual(await lista.json(), { itens: [], total: 0, limite: 10, deslocamento: 0 });
+    assert.equal((await fetch(`${base}/v1/vendas/sincronizacao`, { headers: auth })).status, 200);
+    const disparo = await fetch(`${base}/v1/vendas/sincronizacao`, {
+      method: "POST",
+      headers: auth,
+    });
+    assert.equal(disparo.status, 202);
+  });
+});
+
+test("sem chave de servico configurada as rotas fecham com 503", async () => {
+  const { app, base } = await subir(undefined);
+  try {
+    const r = await fetch(`${base}/v1/vendas/painel`, { headers: auth });
+    assert.equal(r.status, 503);
+  } finally {
+    await app.close();
+  }
+});
````

## `apps/api/src/vendas/vendas.module.ts` (novo)

````diff
diff --git a/apps/api/src/vendas/vendas.module.ts b/apps/api/src/vendas/vendas.module.ts
new file mode 100644
index 0000000..ce67cdf
--- /dev/null
+++ b/apps/api/src/vendas/vendas.module.ts
@@ -0,0 +1,83 @@
+import {
+  type DynamicModule,
+  Inject,
+  Injectable,
+  Module,
+  type OnApplicationBootstrap,
+  type OnApplicationShutdown,
+} from "@nestjs/common";
+import type { VendasConfig } from "@nucleos/config";
+import type { Pool } from "pg";
+import { Agendador } from "./agendador.js";
+import { CHAVE_SERVICO, ChaveServicoGuard } from "./chave-servico.guard.js";
+import { HotmartClient } from "./hotmart-client.js";
+import { ServicoPainelVendas } from "./painel.service.js";
+import { REPOSITORIO_VENDAS } from "./repositorio.js";
+import { RepositorioVendasPg } from "./repositorio-pg.js";
+import { SINCRONIZACAO_VENDAS, SincronizacaoVendas } from "./sincronizacao.js";
+import { VendasController } from "./vendas.controller.js";
+
+const AGENDADOR_VENDAS = Symbol("AGENDADOR_VENDAS");
+
+/** Liga o agendador na subida da API e o desliga no encerramento. */
+@Injectable()
+class CicloDeVidaAgendador implements OnApplicationBootstrap, OnApplicationShutdown {
+  constructor(@Inject(AGENDADOR_VENDAS) private readonly agendador: Agendador | undefined) {}
+
+  onApplicationBootstrap(): void {
+    this.agendador?.iniciar();
+  }
+
+  onApplicationShutdown(): void {
+    this.agendador?.parar();
+  }
+}
+
+export interface OpcoesModuloVendas {
+  config: VendasConfig;
+  pool: Pool;
+  log?: (mensagem: string) => void;
+}
+
+@Module({})
+export class VendasModule {
+  static registrar({ config, pool, log = () => undefined }: OpcoesModuloVendas): DynamicModule {
+    const repo = new RepositorioVendasPg(pool);
+    const cliente =
+      config.hotmart === undefined
+        ? undefined
+        : new HotmartClient({ env: config.hotmartEnv, credenciais: config.hotmart });
+    const sincronizacao = new SincronizacaoVendas(repo, cliente, {
+      backfillDias: config.backfillDays,
+      // O segredo do cliente e estavel enquanto a credencial nao for rotacionada.
+      chavePseudonimo: config.hotmart?.clientSecret.reveal() ?? "sem-hotmart",
+      log,
+    });
+    const agendador =
+      cliente === undefined
+        ? undefined
+        : new Agendador(() => sincronizacao.executar(), config.syncIntervalMs, log);
+    if (cliente === undefined) log("vendas: Hotmart sem credenciais; sincronizacao desativada");
+
+    return {
+      module: VendasModule,
+      controllers: [VendasController],
+      providers: [
+        ChaveServicoGuard,
+        CicloDeVidaAgendador,
+        { provide: CHAVE_SERVICO, useValue: config.apiKey },
+        { provide: REPOSITORIO_VENDAS, useValue: repo },
+        { provide: SINCRONIZACAO_VENDAS, useValue: sincronizacao },
+        { provide: AGENDADOR_VENDAS, useValue: agendador },
+        {
+          provide: ServicoPainelVendas,
+          useValue: new ServicoPainelVendas(
+            repo,
+            Math.round(config.syncIntervalMs / 60_000),
+            sincronizacao.habilitada,
+          ),
+        },
+      ],
+    };
+  }
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/Distribuicoes.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/Distribuicoes.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/Distribuicoes.tsx
new file mode 100644
index 0000000..0076e87
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/Distribuicoes.tsx
@@ -0,0 +1,114 @@
+import type { PainelVendas } from "@nucleos/contracts";
+import {
+  formatarInteiro,
+  formatarMoeda,
+  rotuloPagamento,
+  rotuloStatus,
+} from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+interface Linha {
+  chave: string;
+  nome: string;
+  valor: string;
+  detalhe: string;
+  /** 0 a 1, proporcao da maior linha. */
+  proporcao: number;
+}
+
+function Ranking({
+  titulo,
+  id,
+  linhas,
+  vazio,
+}: {
+  titulo: string;
+  id: string;
+  linhas: Linha[];
+  vazio: string;
+}) {
+  return (
+    <section className="panel-card" aria-labelledby={id}>
+      <div className="panel-header">
+        <h2 id={id}>{titulo}</h2>
+      </div>
+      {linhas.length === 0 ? (
+        <div className="state-box" role="status">
+          {vazio}
+        </div>
+      ) : (
+        <ol className={styles["ranking"]}>
+          {linhas.map((l) => (
+            <li key={l.chave}>
+              <div className={styles["rankingTopo"]}>
+                <span className={styles["rankingNome"]}>{l.nome}</span>
+                <span className={styles["rankingValor"]}>{l.valor}</span>
+              </div>
+              <div className={styles["barra"]} aria-hidden="true">
+                <div
+                  className={styles["barraPreenchida"]}
+                  style={{ width: `${String(Math.max(2, Math.round(l.proporcao * 100)))}%` }}
+                />
+              </div>
+              <span className="kpi-card__detail">{l.detalhe}</span>
+            </li>
+          ))}
+        </ol>
+      )}
+    </section>
+  );
+}
+
+const proporcoes = (valores: number[]): number[] => {
+  const max = Math.max(1, ...valores);
+  return valores.map((v) => v / max);
+};
+
+/** Receita por produto e por forma de pagamento, e quantidade por status da venda. */
+export function Distribuicoes({ painel }: { painel: PainelVendas }) {
+  const { moeda } = painel;
+  const pProd = proporcoes(painel.porProduto.map((p) => p.receitaCentavos));
+  const pPag = proporcoes(painel.porPagamento.map((p) => p.receitaCentavos));
+  const pSta = proporcoes(painel.porStatus.map((s) => s.vendas));
+
+  return (
+    <div className={styles["colunas"]}>
+      <Ranking
+        id="por-produto"
+        titulo="Receita por produto"
+        vazio="Nenhuma venda aprovada no período."
+        linhas={painel.porProduto.map((p, i) => ({
+          chave: p.produtoId,
+          nome: p.produtoNome,
+          valor: formatarMoeda(p.receitaCentavos, moeda),
+          detalhe: `${formatarInteiro(p.vendas)} venda(s)`,
+          proporcao: pProd[i] ?? 0,
+        }))}
+      />
+      <Ranking
+        id="por-pagamento"
+        titulo="Forma de pagamento"
+        vazio="Nenhuma venda aprovada no período."
+        linhas={painel.porPagamento.map((p, i) => ({
+          chave: p.tipo,
+          nome: rotuloPagamento(p.tipo),
+          valor: formatarMoeda(p.receitaCentavos, moeda),
+          detalhe: `${formatarInteiro(p.vendas)} venda(s)`,
+          proporcao: pPag[i] ?? 0,
+        }))}
+      />
+      <Ranking
+        id="por-status"
+        titulo="Vendas por status"
+        vazio="Nenhuma venda no período."
+        linhas={painel.porStatus.map((s, i) => ({
+          chave: s.status,
+          nome: rotuloStatus(s.status),
+          valor: formatarInteiro(s.vendas),
+          detalhe: formatarMoeda(s.valorCentavos, moeda),
+          proporcao: pSta[i] ?? 0,
+        }))}
+      />
+    </div>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/Filtros.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/Filtros.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/Filtros.tsx
new file mode 100644
index 0000000..5664fbc
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/Filtros.tsx
@@ -0,0 +1,92 @@
+import Link from "next/link";
+import type { PainelVendas } from "@nucleos/contracts";
+import {
+  type FiltrosVendas,
+  paraQuery,
+  ultimosDias,
+} from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+const ATALHOS = [7, 30, 90] as const;
+
+/** Filtros por GET (sem JavaScript): o servidor recalcula o painel a cada envio. */
+export function Filtros({
+  painel,
+  filtros,
+  agora,
+}: {
+  painel: PainelVendas;
+  filtros: FiltrosVendas;
+  agora: Date;
+}) {
+  const base: FiltrosVendas = {
+    moeda: painel.moeda,
+    ...(filtros.produto === undefined ? {} : { produto: filtros.produto }),
+  };
+  return (
+    <section className="panel-card" aria-labelledby="filtros-titulo">
+      <div className="panel-header">
+        <h2 id="filtros-titulo">Filtros</h2>
+        <nav aria-label="Atalhos de período" className={styles["filtros"]}>
+          {ATALHOS.map((n) => (
+            <Link
+              key={n}
+              className="btn btn--secondary"
+              href={`?${paraQuery({ ...base, ...ultimosDias(n, agora) })}`}
+            >
+              Últimos {n} dias
+            </Link>
+          ))}
+        </nav>
+      </div>
+      <form method="get" className={styles["filtros"]}>
+        <label className={styles["campo"]}>
+          De
+          <input
+            className="control-input"
+            type="date"
+            name="de"
+            defaultValue={painel.periodo.de}
+            required
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Até
+          <input
+            className="control-input"
+            type="date"
+            name="ate"
+            defaultValue={painel.periodo.ate}
+            required
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Moeda
+          <select className="control-select" name="moeda" defaultValue={painel.moeda}>
+            {(painel.moedasDisponiveis.length > 0 ? painel.moedasDisponiveis : [painel.moeda]).map(
+              (m) => (
+                <option key={m} value={m}>
+                  {m}
+                </option>
+              ),
+            )}
+          </select>
+        </label>
+        <label className={styles["campo"]}>
+          Produto
+          <select className="control-select" name="produto" defaultValue={filtros.produto ?? ""}>
+            <option value="">Todos os produtos</option>
+            {painel.produtos.map((p) => (
+              <option key={p.produtoId} value={p.produtoId}>
+                {p.produtoNome}
+              </option>
+            ))}
+          </select>
+        </label>
+        <button type="submit" className="btn btn--primary">
+          Aplicar
+        </button>
+      </form>
+    </section>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/GraficoReceita.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/GraficoReceita.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/GraficoReceita.tsx
new file mode 100644
index 0000000..3ff317d
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/GraficoReceita.tsx
@@ -0,0 +1,116 @@
+import type { PainelVendas } from "@nucleos/contracts";
+import {
+  formatarDia,
+  formatarDiaCurto,
+  formatarInteiro,
+  formatarMoeda,
+  geometriaGrafico,
+} from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+const LARGURA = 720;
+const ALTURA = 240;
+const MARGEM = { topo: 12, direita: 12, baixo: 28, esquerda: 78 };
+
+/** Receita bruta por dia (SVG no servidor), com a mesma informacao em tabela para leitores de tela. */
+export function GraficoReceita({ painel }: { painel: PainelVendas }) {
+  const { serieDiaria: serie, moeda } = painel;
+  const g = geometriaGrafico(serie, LARGURA, ALTURA, MARGEM);
+  const total = serie.reduce((s, p) => s + p.receitaCentavos, 0);
+  const rotulosX =
+    serie.length <= 1
+      ? serie
+      : [serie[0], serie[Math.floor(serie.length / 2)], serie[serie.length - 1]];
+  const resumo = `Receita bruta por dia, de ${formatarDia(painel.periodo.de)} a ${formatarDia(painel.periodo.ate)}: total de ${formatarMoeda(total, moeda)}.`;
+
+  return (
+    <section className="panel-card" aria-labelledby="grafico-titulo">
+      <div className="panel-header">
+        <h2 id="grafico-titulo">Receita por dia</h2>
+        <span className="kpi-card__detail">
+          Pico: {formatarMoeda(Math.max(0, ...serie.map((p) => p.receitaCentavos)), moeda)}
+        </span>
+      </div>
+
+      <svg
+        className={styles["grafico"]}
+        viewBox={`0 0 ${String(LARGURA)} ${String(ALTURA)}`}
+        role="img"
+        aria-label={resumo}
+      >
+        {g.eixoY.map((t) => (
+          <g key={t.y}>
+            <line
+              className={styles["eixoLinha"]}
+              x1={MARGEM.esquerda}
+              x2={LARGURA - MARGEM.direita}
+              y1={t.y}
+              y2={t.y}
+            />
+            <text
+              className={styles["eixoTexto"]}
+              x={MARGEM.esquerda - 8}
+              y={t.y + 4}
+              textAnchor="end"
+            >
+              {formatarMoeda(t.centavos, moeda)}
+            </text>
+          </g>
+        ))}
+        {g.area !== "" ? <path className={styles["area"]} d={g.area} /> : null}
+        {g.linha !== "" ? <polyline className={styles["linha"]} points={g.linha} /> : null}
+        {serie.length <= 45
+          ? g.pontos.map((p) => (
+              <circle key={p.dia} className={styles["ponto"]} cx={p.x} cy={p.y} r={2.5} />
+            ))
+          : null}
+        {rotulosX.map((p, idx) => {
+          if (p === undefined) return null;
+          const ponto = g.pontos.find((q) => q.dia === p.dia);
+          if (ponto === undefined) return null;
+          const ancora = idx === 0 ? "start" : idx === rotulosX.length - 1 ? "end" : "middle";
+          return (
+            <text
+              key={p.dia}
+              className={styles["eixoTexto"]}
+              x={ponto.x}
+              y={ALTURA - 8}
+              textAnchor={ancora}
+            >
+              {formatarDiaCurto(p.dia)}
+            </text>
+          );
+        })}
+      </svg>
+
+      <details className={styles["detalhes"]}>
+        <summary>Ver os valores diários em tabela</summary>
+        <div className={styles["rolagem"]}>
+          <table className={styles["tabela"]}>
+            <caption>{resumo}</caption>
+            <thead>
+              <tr>
+                <th scope="col">Dia</th>
+                <th scope="col" className={styles["numero"]}>
+                  Vendas
+                </th>
+                <th scope="col" className={styles["numero"]}>
+                  Receita bruta
+                </th>
+              </tr>
+            </thead>
+            <tbody>
+              {serie.map((p) => (
+                <tr key={p.dia}>
+                  <th scope="row">{formatarDia(p.dia)}</th>
+                  <td className={styles["numero"]}>{formatarInteiro(p.vendas)}</td>
+                  <td className={styles["numero"]}>{formatarMoeda(p.receitaCentavos, moeda)}</td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      </details>
+    </section>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/Indicadores.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/Indicadores.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/Indicadores.tsx
new file mode 100644
index 0000000..37c9da6
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/Indicadores.tsx
@@ -0,0 +1,103 @@
+import type { PainelVendas } from "@nucleos/contracts";
+import {
+  formatarInteiro,
+  formatarMoeda,
+  formatarPercentual,
+  variacao,
+} from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+interface Cartao {
+  rotulo: string;
+  valor: string;
+  detalhe: string;
+  atual: number;
+  anterior: number;
+  /** Para reembolsos, subir e ruim. */
+  menorEMelhor?: boolean;
+}
+
+function Tendencia({
+  atual,
+  anterior,
+  menorEMelhor = false,
+}: Pick<Cartao, "atual" | "anterior" | "menorEMelhor">) {
+  const v = variacao(atual, anterior);
+  const bom = menorEMelhor ? v.direcao === "baixa" : v.direcao === "alta";
+  const ruim = menorEMelhor ? v.direcao === "alta" : v.direcao === "baixa";
+  const classe = `${styles["tendencia"] ?? ""} ${bom ? (styles["tendenciaAlta"] ?? "") : ruim ? (styles["tendenciaBaixa"] ?? "") : ""}`;
+  return <span className={classe}>{v.texto}</span>;
+}
+
+/** Indicadores do periodo com variacao frente ao periodo anterior de mesma duracao. */
+export function Indicadores({ painel }: { painel: PainelVendas }) {
+  const { indicadores: i, indicadoresAnteriores: a, moeda } = painel;
+  const dinheiro = (c: number): string => formatarMoeda(c, moeda);
+  const cartoes: Cartao[] = [
+    {
+      rotulo: "Receita bruta",
+      valor: dinheiro(i.receitaBrutaCentavos),
+      detalhe: `Taxas Hotmart: ${dinheiro(i.taxasCentavos)}`,
+      atual: i.receitaBrutaCentavos,
+      anterior: a.receitaBrutaCentavos,
+    },
+    {
+      rotulo: "Receita líquida (estimada)",
+      valor: dinheiro(i.receitaLiquidaCentavos),
+      detalhe: "Bruta menos taxas da Hotmart",
+      atual: i.receitaLiquidaCentavos,
+      anterior: a.receitaLiquidaCentavos,
+    },
+    {
+      rotulo: "Vendas aprovadas",
+      valor: formatarInteiro(i.vendas),
+      detalhe: `${formatarInteiro(i.vendasAssinatura)} de assinaturas`,
+      atual: i.vendas,
+      anterior: a.vendas,
+    },
+    {
+      rotulo: "Ticket médio",
+      valor: dinheiro(i.ticketMedioCentavos),
+      detalhe: "Receita bruta por venda",
+      atual: i.ticketMedioCentavos,
+      anterior: a.ticketMedioCentavos,
+    },
+    {
+      rotulo: "Compradores únicos",
+      valor: formatarInteiro(i.compradoresUnicos),
+      detalhe: "Contados por identificador anônimo",
+      atual: i.compradoresUnicos,
+      anterior: a.compradoresUnicos,
+    },
+    {
+      rotulo: "Reembolsos e chargebacks",
+      valor: dinheiro(i.reembolsadoCentavos),
+      detalhe: `${formatarInteiro(i.reembolsos)} ocorrência(s) · taxa ${formatarPercentual(i.taxaReembolso)}`,
+      atual: i.reembolsadoCentavos,
+      anterior: a.reembolsadoCentavos,
+      menorEMelhor: true,
+    },
+  ];
+
+  return (
+    <section aria-labelledby="indicadores-titulo">
+      <h2 id="indicadores-titulo" className="visually-hidden">
+        Indicadores do período
+      </h2>
+      <div className="kpi-grid">
+        {cartoes.map((c) => (
+          <div key={c.rotulo} className="kpi-card">
+            <span className="kpi-card__label">{c.rotulo}</span>
+            <span className="kpi-card__value">{c.valor}</span>
+            <span className="kpi-card__detail">{c.detalhe}</span>
+            <Tendencia
+              atual={c.atual}
+              anterior={c.anterior}
+              {...(c.menorEMelhor === true ? { menorEMelhor: true } : {})}
+            />
+          </div>
+        ))}
+      </div>
+    </section>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/Sincronizacao.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/Sincronizacao.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/Sincronizacao.tsx
new file mode 100644
index 0000000..f7ed522
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/Sincronizacao.tsx
@@ -0,0 +1,31 @@
+import type { EstadoSincronizacao, StatusSincronizacao } from "@nucleos/contracts";
+import { tempoDecorrido } from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+const ROTULO: Record<StatusSincronizacao, { texto: string; classe: string }> = {
+  sucesso: { texto: "Atualizado", classe: "badge badge--ok" },
+  parcial: { texto: "Atualização parcial", classe: "badge badge--warn" },
+  falha: { texto: "Falha na atualização", classe: "badge badge--danger" },
+  em_andamento: { texto: "Atualizando agora", classe: "badge badge--info" },
+  nunca: { texto: "Ainda não atualizado", classe: "badge badge--info" },
+};
+
+/** Quando os dados vieram da Hotmart pela ultima vez e a cada quanto tempo se renovam. */
+export function Sincronizacao({ estado, agora }: { estado: EstadoSincronizacao; agora: Date }) {
+  const rotulo = ROTULO[estado.status];
+  return (
+    <div className={styles["sync"]} role="status">
+      <span className={rotulo.classe}>{rotulo.texto}</span>
+      <span>
+        Última atualização bem-sucedida:{" "}
+        <strong>{tempoDecorrido(estado.ultimoSucessoEm, agora)}</strong>
+      </span>
+      <span>
+        {estado.habilitada
+          ? `Verificação automática a cada ${String(estado.intervaloMinutos)} min`
+          : "Verificação automática desativada (Hotmart sem credenciais na API)"}
+      </span>
+      {estado.mensagem !== null ? <p className={styles["syncAviso"]}>{estado.mensagem}</p> : null}
+    </div>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx
new file mode 100644
index 0000000..fc8a848
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx
@@ -0,0 +1,77 @@
+import type { ListaVendas } from "@nucleos/contracts";
+import {
+  formatarInteiro,
+  formatarMoeda,
+  rotuloPagamento,
+  rotuloStatus,
+} from "../../../../../../lib/vendas-formato.ts";
+import styles from "../vendas.module.css";
+
+const GRUPO_BADGE = {
+  receita: "badge badge--ok",
+  reembolso: "badge badge--danger",
+  cancelada: "badge badge--warn",
+  pendente: "badge badge--info",
+} as const;
+
+const data = new Intl.DateTimeFormat("pt-BR", {
+  timeZone: "America/Sao_Paulo",
+  dateStyle: "short",
+  timeStyle: "short",
+});
+
+/** Vendas mais recentes do periodo. O comprador aparece so como codigo anonimo. */
+export function UltimasVendas({ lista }: { lista: ListaVendas }) {
+  return (
+    <section className="panel-card" aria-labelledby="ultimas-titulo">
+      <div className="panel-header">
+        <h2 id="ultimas-titulo">Últimas vendas</h2>
+        <span className="kpi-card__detail">
+          {formatarInteiro(lista.itens.length)} de {formatarInteiro(lista.total)} no período
+        </span>
+      </div>
+      {lista.itens.length === 0 ? (
+        <div className="state-box" role="status">
+          Nenhuma venda no período selecionado.
+        </div>
+      ) : (
+        <div className={styles["rolagem"]}>
+          <table className={styles["tabela"]}>
+            <caption className="visually-hidden">Vendas mais recentes do período</caption>
+            <thead>
+              <tr>
+                <th scope="col">Data</th>
+                <th scope="col">Produto</th>
+                <th scope="col">Status</th>
+                <th scope="col">Pagamento</th>
+                <th scope="col">Comprador</th>
+                <th scope="col" className={styles["numero"]}>
+                  Valor
+                </th>
+              </tr>
+            </thead>
+            <tbody>
+              {lista.itens.map((v) => (
+                <tr key={v.transacao}>
+                  <td>{data.format(new Date(v.pedidoEm))}</td>
+                  <td>{v.produtoNome}</td>
+                  <td>
+                    <span className={GRUPO_BADGE[v.grupo]}>{rotuloStatus(v.status)}</span>
+                  </td>
+                  <td>
+                    {rotuloPagamento(v.pagamento)}
+                    {v.parcelas > 1 ? ` · ${String(v.parcelas)}x` : ""}
+                  </td>
+                  <td>
+                    <code>{v.compradorId.slice(0, 8)}</code>
+                  </td>
+                  <td className={styles["numero"]}>{formatarMoeda(v.valorCentavos, v.moeda)}</td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      )}
+    </section>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/page.tsx` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/page.tsx b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
new file mode 100644
index 0000000..5810846
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
@@ -0,0 +1,99 @@
+import Link from "next/link";
+import {
+  MENSAGENS_FALHA,
+  carregarPainel,
+  carregarUltimasVendas,
+} from "../../../../../lib/vendas-api.ts";
+import { filtrosDaUrl } from "../../../../../lib/vendas-formato.ts";
+import { Distribuicoes } from "./_components/Distribuicoes.tsx";
+import { Filtros } from "./_components/Filtros.tsx";
+import { GraficoReceita } from "./_components/GraficoReceita.tsx";
+import { Indicadores } from "./_components/Indicadores.tsx";
+import { Sincronizacao } from "./_components/Sincronizacao.tsx";
+import { UltimasVendas } from "./_components/UltimasVendas.tsx";
+
+export const metadata = {
+  title: "Painel de vendas — NÚCLEOS",
+  description: "Vendas da Hotmart: receita, ticket médio, reembolsos e evolução diária.",
+};
+
+type Busca = Promise<Record<string, string | string[] | undefined>>;
+
+export default async function PainelVendasPage({ searchParams }: { searchParams: Busca }) {
+  const filtros = filtrosDaUrl(await searchParams);
+  const agora = new Date();
+  const painel = await carregarPainel(filtros);
+
+  return (
+    <main id="conteudo" className="page">
+      <nav aria-label="Trilha de navegação">
+        <Link href="/setores/financeiro">← Financeiro</Link>
+      </nav>
+      <header className="page-header">
+        <h1>Painel de vendas</h1>
+      </header>
+
+      {painel.tipo === "nao-configurado" ? (
+        <div className="state-box" role="status">
+          <p>
+            O painel ainda não está conectado à API de vendas. Defina{" "}
+            <code>VENDAS_API_KEY_FILE</code> (arquivo com a chave de serviço) e, se a API não
+            estiver em <code>http://127.0.0.1:3001</code>, <code>VENDAS_API_URL</code> no servidor
+            web.
+          </p>
+        </div>
+      ) : painel.tipo === "erro" ? (
+        <div className="state-box state-box--error" role="alert">
+          {MENSAGENS_FALHA[painel.falha]}
+        </div>
+      ) : (
+        <PainelCompleto painel={painel.dados} filtros={filtros} agora={agora} />
+      )}
+    </main>
+  );
+}
+
+async function PainelCompleto({
+  painel,
+  filtros,
+  agora,
+}: {
+  painel: Extract<Awaited<ReturnType<typeof carregarPainel>>, { tipo: "ok" }>["dados"];
+  filtros: ReturnType<typeof filtrosDaUrl>;
+  agora: Date;
+}) {
+  const ultimas = await carregarUltimasVendas({
+    de: painel.periodo.de,
+    ate: painel.periodo.ate,
+    moeda: painel.moeda,
+    ...(filtros.produto === undefined ? {} : { produto: filtros.produto }),
+  });
+  const semDados = painel.indicadores.vendas === 0 && painel.porStatus.length === 0;
+
+  return (
+    <>
+      <Sincronizacao estado={painel.sincronizacao} agora={agora} />
+      <Filtros painel={painel} filtros={filtros} agora={agora} />
+
+      {semDados ? (
+        <div className="state-box" role="status">
+          {painel.sincronizacao.status === "nunca"
+            ? "Ainda não há vendas carregadas. A primeira verificação com a Hotmart roda automaticamente; quando terminar, os números aparecem aqui."
+            : "Nenhuma venda encontrada para os filtros escolhidos. Ajuste o período ou o produto."}
+        </div>
+      ) : null}
+
+      <Indicadores painel={painel} />
+      <GraficoReceita painel={painel} />
+      <Distribuicoes painel={painel} />
+
+      {ultimas.tipo === "ok" ? (
+        <UltimasVendas lista={ultimas.dados} />
+      ) : (
+        <div className="state-box state-box--error" role="alert">
+          Não foi possível carregar a lista de últimas vendas agora.
+        </div>
+      )}
+    </>
+  );
+}
````

## `apps/web/app/(app)/setores/financeiro/vendas/vendas.module.css` (novo)

````diff
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/vendas.module.css b/apps/web/app/(app)/setores/financeiro/vendas/vendas.module.css
new file mode 100644
index 0000000..cff4211
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/vendas.module.css
@@ -0,0 +1,175 @@
+/* Estilos de uso unico do painel de vendas; so tokens do design system. */
+
+.filtros {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: flex-end;
+  gap: 0.75rem;
+}
+
+.campo {
+  display: flex;
+  flex-direction: column;
+  gap: 0.25rem;
+  font-size: 0.76rem;
+  color: var(--text-secondary);
+}
+
+.sync {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  gap: 0.5rem 0.75rem;
+  font-size: 0.82rem;
+  color: var(--text-secondary);
+}
+
+.syncAviso {
+  flex-basis: 100%;
+  margin: 0;
+  font-size: 0.78rem;
+  color: var(--text-muted);
+}
+
+.tendencia {
+  font-size: 0.72rem;
+  color: var(--text-muted);
+}
+
+.tendenciaAlta {
+  color: var(--status-ok-text);
+}
+
+.tendenciaBaixa {
+  color: var(--status-danger-text);
+}
+
+.tendenciaRuim {
+  color: var(--status-danger-text);
+}
+
+.grafico {
+  width: 100%;
+  height: auto;
+  display: block;
+}
+
+.eixoLinha {
+  stroke: var(--border-subtle);
+  stroke-width: 1;
+}
+
+.eixoTexto {
+  fill: var(--text-muted);
+  font-size: 11px;
+  font-family: var(--font-mono);
+}
+
+.area {
+  fill: var(--brand);
+  opacity: 0.18;
+}
+
+.linha {
+  fill: none;
+  stroke: var(--accent-primary);
+  stroke-width: 2;
+  stroke-linejoin: round;
+  stroke-linecap: round;
+}
+
+.ponto {
+  fill: var(--accent-primary);
+}
+
+.colunas {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
+  gap: 1rem;
+  align-items: start;
+}
+
+.ranking {
+  list-style: none;
+  margin: 0;
+  padding: 0;
+  display: flex;
+  flex-direction: column;
+  gap: 0.6rem;
+}
+
+.rankingTopo {
+  display: flex;
+  justify-content: space-between;
+  gap: 0.75rem;
+  font-size: 0.82rem;
+}
+
+.rankingNome {
+  overflow-wrap: anywhere;
+}
+
+.rankingValor {
+  font-family: var(--font-mono);
+  white-space: nowrap;
+}
+
+.barra {
+  height: 6px;
+  margin-top: 0.25rem;
+  border-radius: 999px;
+  background: var(--bg-interactive);
+  overflow: hidden;
+}
+
+.barraPreenchida {
+  height: 100%;
+  background: var(--brand);
+}
+
+.rolagem {
+  overflow-x: auto;
+}
+
+.tabela {
+  width: 100%;
+  border-collapse: collapse;
+  font-size: 0.8rem;
+}
+
+.tabela caption {
+  text-align: left;
+  color: var(--text-secondary);
+  padding-bottom: 0.4rem;
+}
+
+.tabela th,
+.tabela td {
+  text-align: left;
+  padding: 0.45rem 0.6rem;
+  border-top: 1px solid var(--border-subtle);
+  white-space: nowrap;
+}
+
+.tabela th {
+  color: var(--text-secondary);
+  font-weight: 600;
+}
+
+.numero {
+  text-align: right !important;
+  font-family: var(--font-mono);
+}
+
+.detalhes {
+  margin-top: 0.6rem;
+  font-size: 0.8rem;
+  color: var(--text-secondary);
+}
+
+.detalhes summary {
+  cursor: pointer;
+  min-height: 32px;
+  display: inline-flex;
+  align-items: center;
+}
````

## `apps/web/app/vendas-formato.test.ts` (novo)

````diff
diff --git a/apps/web/app/vendas-formato.test.ts b/apps/web/app/vendas-formato.test.ts
new file mode 100644
index 0000000..15d5c1b
--- /dev/null
+++ b/apps/web/app/vendas-formato.test.ts
@@ -0,0 +1,152 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import {
+  filtrosDaUrl,
+  formatarDiaCurto,
+  formatarInteiro,
+  formatarMoeda,
+  formatarPercentual,
+  geometriaGrafico,
+  paraQuery,
+  rotuloPagamento,
+  rotuloStatus,
+  tempoDecorrido,
+  tetoRedondo,
+  ultimosDias,
+  variacao,
+} from "../lib/vendas-formato.ts";
+
+/** Intl usa espaco nao separavel; normaliza para comparar. */
+const norm = (s: string): string => s.replace(/\p{Zs}/gu, " ");
+
+describe("formatacao pt-BR", () => {
+  test("moeda, inteiro, percentual e dia", () => {
+    assert.equal(norm(formatarMoeda(123_456, "BRL")), "R$ 1.234,56");
+    assert.equal(norm(formatarMoeda(0, "BRL")), "R$ 0,00");
+    assert.match(norm(formatarMoeda(9_990, "USD")), /US\$\s?99,90/);
+    assert.equal(norm(formatarMoeda(1_000, "XX")), "XX 10,00"); // moeda invalida nao quebra
+    assert.equal(formatarInteiro(1234567), "1.234.567");
+    assert.equal(formatarPercentual(0.1234), "12,3%");
+    assert.equal(formatarDiaCurto("2026-10-31"), "31/10");
+  });
+
+  test("rotulos conhecidos e passagem do desconhecido", () => {
+    assert.equal(rotuloStatus("REFUNDED"), "Reembolsada");
+    assert.equal(rotuloStatus("NOVO_STATUS"), "NOVO_STATUS");
+    assert.equal(rotuloPagamento("PIX"), "Pix");
+    assert.equal(rotuloPagamento("OUTRO"), "OUTRO");
+  });
+
+  test("tempo decorrido", () => {
+    const agora = new Date("2026-11-01T12:00:00Z");
+    assert.equal(tempoDecorrido(null, agora), "nunca");
+    assert.equal(tempoDecorrido("lixo", agora), "nunca");
+    assert.equal(tempoDecorrido("2026-11-01T11:59:40Z", agora), "agora há pouco");
+    assert.equal(tempoDecorrido("2026-11-01T11:55:00Z", agora), "há 5 min");
+    assert.equal(tempoDecorrido("2026-11-01T09:00:00Z", agora), "há 3 h");
+    assert.equal(tempoDecorrido("2026-10-31T11:00:00Z", agora), "há 1 dia");
+    assert.equal(tempoDecorrido("2026-10-29T11:00:00Z", agora), "há 3 dias");
+  });
+});
+
+describe("variacao vs. periodo anterior", () => {
+  test("alta, baixa, estavel e sem base (nunca divide por zero)", () => {
+    assert.deepEqual(variacao(150, 100), { texto: "▲ 50% vs. período anterior", direcao: "alta" });
+    assert.deepEqual(variacao(75, 100), { texto: "▼ 25% vs. período anterior", direcao: "baixa" });
+    assert.equal(variacao(100, 100).direcao, "estavel");
+    assert.equal(variacao(10, 0).direcao, "sem-base");
+    assert.equal(variacao(0, 0).direcao, "estavel");
+  });
+});
+
+describe("filtros da URL", () => {
+  test("mantem so valores bem formados e descarta o resto", () => {
+    assert.deepEqual(
+      filtrosDaUrl({
+        de: "2026-10-01",
+        ate: "2026-10-31",
+        moeda: "BRL",
+        produto: "101",
+        extra: "x",
+      }),
+      { de: "2026-10-01", ate: "2026-10-31", moeda: "BRL", produto: "101" },
+    );
+    assert.deepEqual(
+      filtrosDaUrl({
+        de: "ontem",
+        ate: ["2026-10-31", "2026-10-30"],
+        moeda: "real",
+        produto: "a b;drop",
+      }),
+      {},
+    );
+    assert.equal(paraQuery({ de: "2026-10-01", moeda: "BRL" }), "de=2026-10-01&moeda=BRL");
+    assert.equal(paraQuery({}), "");
+  });
+});
+
+describe("atalhos de periodo", () => {
+  test("usa o dia de Sao Paulo (23:30 locais ainda e o mesmo dia) e inclui os dois extremos", () => {
+    const agora = new Date("2026-11-01T02:30:00Z"); // 31/10 23:30 em Sao Paulo
+    assert.deepEqual(ultimosDias(7, agora), { de: "2026-10-25", ate: "2026-10-31" });
+    assert.deepEqual(ultimosDias(1, agora), { de: "2026-10-31", ate: "2026-10-31" });
+    assert.deepEqual(ultimosDias(30, new Date("2026-03-02T15:00:00Z")), {
+      de: "2026-02-01",
+      ate: "2026-03-02",
+    });
+  });
+});
+
+describe("grafico", () => {
+  test("teto redondo", () => {
+    assert.equal(tetoRedondo(0), 100);
+    assert.equal(tetoRedondo(1), 1);
+    assert.equal(tetoRedondo(130), 200);
+    assert.equal(tetoRedondo(4_200), 5_000);
+    assert.equal(tetoRedondo(5_001), 10_000);
+  });
+
+  test("geometria: maior valor encosta no topo, zero na base, eixo em 5 marcas", () => {
+    const g = geometriaGrafico(
+      [
+        { dia: "2026-10-01", receitaCentavos: 0, vendas: 0 },
+        { dia: "2026-10-02", receitaCentavos: 5_000, vendas: 2 },
+        { dia: "2026-10-03", receitaCentavos: 2_500, vendas: 1 },
+      ],
+      640,
+      220,
+      { topo: 10, direita: 10, baixo: 30, esquerda: 50 },
+    );
+    assert.equal(g.maxCentavos, 5_000);
+    assert.deepEqual(
+      g.pontos.map((p) => [p.x, p.y]),
+      [
+        [50, 190],
+        [340, 10],
+        [630, 100],
+      ],
+    );
+    assert.equal(g.eixoY.length, 5);
+    assert.equal(g.eixoY[0]?.centavos, 5_000);
+    assert.equal(g.eixoY[4]?.centavos, 0);
+    assert.match(g.area, /^M50\.0,190\.0 L50\.0,190\.0 .* Z$/);
+  });
+
+  test("serie vazia e de um ponto nao quebram", () => {
+    const vazio = geometriaGrafico([], 640, 220, {
+      topo: 10,
+      direita: 10,
+      baixo: 30,
+      esquerda: 50,
+    });
+    assert.equal(vazio.linha, "");
+    assert.equal(vazio.area, "");
+    const um = geometriaGrafico(
+      [{ dia: "2026-10-01", receitaCentavos: 100, vendas: 1 }],
+      640,
+      220,
+      { topo: 10, direita: 10, baixo: 30, esquerda: 50 },
+    );
+    assert.equal(um.pontos.length, 1);
+  });
+});
````

## `apps/web/lib/vendas-api.ts` (novo)

````diff
diff --git a/apps/web/lib/vendas-api.ts b/apps/web/lib/vendas-api.ts
new file mode 100644
index 0000000..842e168
--- /dev/null
+++ b/apps/web/lib/vendas-api.ts
@@ -0,0 +1,87 @@
+/**
+ * Acesso do servidor Next.js a API de vendas. Roda somente no servidor: a chave de servico e lida
+ * de arquivo (VENDAS_API_KEY_FILE) e nunca vai para o HTML, para o cliente ou para logs.
+ */
+import { readFileSync } from "node:fs";
+import type { ListaVendas, PainelVendas } from "@nucleos/contracts";
+import { type FiltrosVendas, paraQuery } from "./vendas-formato.ts";
+
+export type FalhaVendas =
+  "nao-autorizado" | "api-sem-chave" | "modulo-desligado" | "filtro-invalido" | "indisponivel";
+
+export type ResultadoVendas<T> =
+  { tipo: "ok"; dados: T } | { tipo: "nao-configurado" } | { tipo: "erro"; falha: FalhaVendas };
+
+const URL_PADRAO = "http://127.0.0.1:3001";
+const TIMEOUT_MS = 10_000;
+
+function configuracao(): { base: string; chave: string } | undefined {
+  const arquivo = process.env["VENDAS_API_KEY_FILE"];
+  if (arquivo === undefined || arquivo === "") return undefined;
+  try {
+    const chave = readFileSync(arquivo, "utf8").trim();
+    if (chave === "") return undefined;
+    return { base: (process.env["VENDAS_API_URL"] ?? URL_PADRAO).replace(/\/+$/, ""), chave };
+  } catch {
+    return undefined;
+  }
+}
+
+async function buscar<T>(
+  caminho: string,
+  valido: (x: unknown) => x is T,
+): Promise<ResultadoVendas<T>> {
+  const cfg = configuracao();
+  if (cfg === undefined) return { tipo: "nao-configurado" };
+  try {
+    const r = await fetch(`${cfg.base}${caminho}`, {
+      headers: { authorization: `Bearer ${cfg.chave}` },
+      cache: "no-store",
+      signal: AbortSignal.timeout(TIMEOUT_MS),
+    });
+    if (r.status === 401) return { tipo: "erro", falha: "nao-autorizado" };
+    if (r.status === 400) return { tipo: "erro", falha: "filtro-invalido" };
+    if (r.status === 503) return { tipo: "erro", falha: "api-sem-chave" };
+    if (r.status === 404) return { tipo: "erro", falha: "modulo-desligado" };
+    if (!r.ok) return { tipo: "erro", falha: "indisponivel" };
+    const corpo: unknown = await r.json();
+    return valido(corpo) ? { tipo: "ok", dados: corpo } : { tipo: "erro", falha: "indisponivel" };
+  } catch {
+    return { tipo: "erro", falha: "indisponivel" };
+  }
+}
+
+const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
+
+const ehPainel = (x: unknown): x is PainelVendas =>
+  ehObjeto(x) &&
+  ehObjeto(x["indicadores"]) &&
+  Array.isArray(x["serieDiaria"]) &&
+  ehObjeto(x["sincronizacao"]);
+
+const ehLista = (x: unknown): x is ListaVendas => ehObjeto(x) && Array.isArray(x["itens"]);
+
+export function carregarPainel(filtros: FiltrosVendas): Promise<ResultadoVendas<PainelVendas>> {
+  const q = paraQuery(filtros);
+  return buscar(`/v1/vendas/painel${q === "" ? "" : `?${q}`}`, ehPainel);
+}
+
+export function carregarUltimasVendas(
+  filtros: FiltrosVendas,
+  limite = 10,
+): Promise<ResultadoVendas<ListaVendas>> {
+  const q = new URLSearchParams(paraQuery(filtros));
+  q.set("limite", String(limite));
+  return buscar(`/v1/vendas?${q.toString()}`, ehLista);
+}
+
+export const MENSAGENS_FALHA: Record<FalhaVendas, string> = {
+  "nao-autorizado":
+    "A chave de acesso à API de vendas foi recusada. Confira a chave configurada no servidor web.",
+  "api-sem-chave":
+    "A API de vendas está sem chave de serviço configurada e, por segurança, não responde.",
+  "modulo-desligado": "O módulo de vendas está desligado na API (sem banco de dados configurado).",
+  "filtro-invalido":
+    "Os filtros informados são inválidos. Use datas no formato AAAA-MM-DD, com período de até 366 dias.",
+  indisponivel: "Não foi possível consultar a API de vendas agora. Tente novamente em instantes.",
+};
````

## `apps/web/lib/vendas-formato.ts` (novo)

````diff
diff --git a/apps/web/lib/vendas-formato.ts b/apps/web/lib/vendas-formato.ts
new file mode 100644
index 0000000..a0cc3f8
--- /dev/null
+++ b/apps/web/lib/vendas-formato.ts
@@ -0,0 +1,215 @@
+/**
+ * Funcoes puras do painel de vendas: formatacao pt-BR, comparacao com o periodo anterior,
+ * validacao dos filtros da URL e geometria do grafico. Sem DOM, para testar no Node.
+ */
+import type { PontoSerieVendas } from "@nucleos/contracts";
+
+const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
+
+/** `12345` + `BRL` => `R$ 123,45`. Moeda desconhecida cai para o codigo ao lado do numero. */
+export function formatarMoeda(centavos: number, moeda: string): string {
+  try {
+    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(
+      centavos / 100,
+    );
+  } catch {
+    return `${moeda} ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(centavos / 100)}`;
+  }
+}
+
+export function formatarInteiro(n: number): string {
+  return new Intl.NumberFormat("pt-BR").format(n);
+}
+
+/** `0.1234` => `12,3%`. */
+export function formatarPercentual(fracao: number): string {
+  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(fracao * 100)}%`;
+}
+
+/** `2026-10-31` => `31/10`. */
+export function formatarDiaCurto(dia: string): string {
+  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
+}
+
+/** `2026-10-31` => `31/10/2026`. */
+export function formatarDia(dia: string): string {
+  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
+}
+
+export interface Variacao {
+  texto: string;
+  direcao: "alta" | "baixa" | "estavel" | "sem-base";
+}
+
+/** Variacao percentual frente ao periodo anterior; sem base de comparacao nao inventa numero. */
+export function variacao(atual: number, anterior: number): Variacao {
+  if (anterior === 0) {
+    return atual === 0
+      ? { texto: "sem movimento nos dois períodos", direcao: "estavel" }
+      : { texto: "sem base no período anterior", direcao: "sem-base" };
+  }
+  const pct = ((atual - anterior) / anterior) * 100;
+  if (Math.abs(pct) < 0.05) return { texto: "estável vs. período anterior", direcao: "estavel" };
+  const abs = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(pct));
+  return pct > 0
+    ? { texto: `▲ ${abs}% vs. período anterior`, direcao: "alta" }
+    : { texto: `▼ ${abs}% vs. período anterior`, direcao: "baixa" };
+}
+
+const STATUS: Record<string, string> = {
+  APPROVED: "Aprovada",
+  COMPLETE: "Concluída",
+  PARTIALLY_REFUNDED: "Reembolso parcial",
+  REFUNDED: "Reembolsada",
+  CHARGEBACK: "Chargeback",
+  CANCELLED: "Cancelada",
+  EXPIRED: "Expirada",
+  WAITING_PAYMENT: "Aguardando pagamento",
+  PRINTED_BILLET: "Boleto emitido",
+  UNDER_ANALISYS: "Em análise",
+  STARTED: "Iniciada",
+  DELAYED: "Atrasada",
+  OVERDUE: "Vencida",
+  PROTESTED: "Protestada",
+  BLOCKED: "Bloqueada",
+  NO_FUNDS: "Sem saldo",
+};
+
+export function rotuloStatus(status: string): string {
+  return STATUS[status] ?? status;
+}
+
+const PAGAMENTO: Record<string, string> = {
+  CREDIT_CARD: "Cartão de crédito",
+  DEBIT_CARD: "Cartão de débito",
+  PIX: "Pix",
+  BILLET: "Boleto",
+  PAYPAL: "PayPal",
+  PICPAY: "PicPay",
+  GOOGLE_PAY: "Google Pay",
+  APPLE_PAY: "Apple Pay",
+  DESCONHECIDO: "Não informado",
+};
+
+export function rotuloPagamento(tipo: string): string {
+  return PAGAMENTO[tipo] ?? tipo;
+}
+
+/** `há 5 min`, `há 2 h`, `há 3 dias`; `nunca` quando nao ha data. */
+export function tempoDecorrido(iso: string | null, agora: Date): string {
+  if (iso === null) return "nunca";
+  const t = Date.parse(iso);
+  if (Number.isNaN(t)) return "nunca";
+  const min = Math.max(0, Math.floor((agora.getTime() - t) / 60_000));
+  if (min < 1) return "agora há pouco";
+  if (min < 60) return `há ${String(min)} min`;
+  if (min < 1440) return `há ${String(Math.floor(min / 60))} h`;
+  const dias = Math.floor(min / 1440);
+  return `há ${String(dias)} ${dias === 1 ? "dia" : "dias"}`;
+}
+
+export interface FiltrosVendas {
+  de?: string;
+  ate?: string;
+  moeda?: string;
+  produto?: string;
+}
+
+type Busca = Readonly<Record<string, string | string[] | undefined>>;
+
+/** Mantem so os filtros bem formados; qualquer outra coisa da URL e descartada (nunca repassada). */
+export function filtrosDaUrl(busca: Busca): FiltrosVendas {
+  const um = (v: string | string[] | undefined): string | undefined =>
+    typeof v === "string" ? v : undefined;
+  const de = um(busca["de"]);
+  const ate = um(busca["ate"]);
+  const moeda = um(busca["moeda"]);
+  const produto = um(busca["produto"]);
+  return {
+    ...(de !== undefined && DIA_RE.test(de) ? { de } : {}),
+    ...(ate !== undefined && DIA_RE.test(ate) ? { ate } : {}),
+    ...(moeda !== undefined && /^[A-Z]{3}$/.test(moeda) ? { moeda } : {}),
+    ...(produto !== undefined && /^[\w.-]{1,64}$/.test(produto) ? { produto } : {}),
+  };
+}
+
+export function paraQuery(filtros: FiltrosVendas): string {
+  const p = new URLSearchParams();
+  for (const k of ["de", "ate", "moeda", "produto"] as const) {
+    const v = filtros[k];
+    if (v !== undefined) p.set(k, v);
+  }
+  return p.toString();
+}
+
+/** Ultimos `n` dias ate hoje (fuso America/Sao_Paulo), ambos os extremos incluidos. */
+export function ultimosDias(n: number, agora: Date): { de: string; ate: string } {
+  const ate = new Intl.DateTimeFormat("en-CA", {
+    timeZone: "America/Sao_Paulo",
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+  }).format(agora);
+  const base = new Date(`${ate}T00:00:00Z`);
+  base.setUTCDate(base.getUTCDate() - (n - 1));
+  return { de: base.toISOString().slice(0, 10), ate };
+}
+
+export interface PontoGrafico {
+  x: number;
+  y: number;
+  dia: string;
+  receitaCentavos: number;
+}
+
+export interface GeometriaGrafico {
+  pontos: PontoGrafico[];
+  /** Atributo `points` da linha. */
+  linha: string;
+  /** Atributo `d` da area sob a linha. */
+  area: string;
+  maxCentavos: number;
+  /** Valores de referencia do eixo Y (do maior ao zero). */
+  eixoY: { y: number; centavos: number }[];
+}
+
+/** Arredonda para cima ao proximo valor "redondo" (1, 2, 5 x 10^n) para o eixo nao ficar torto. */
+export function tetoRedondo(valor: number): number {
+  if (valor <= 0) return 100;
+  const exp = 10 ** Math.floor(Math.log10(valor));
+  const frac = valor / exp;
+  const passo = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
+  return passo * exp;
+}
+
+export function geometriaGrafico(
+  serie: readonly PontoSerieVendas[],
+  largura: number,
+  altura: number,
+  margem: { topo: number; direita: number; baixo: number; esquerda: number },
+): GeometriaGrafico {
+  const maxCentavos = tetoRedondo(Math.max(0, ...serie.map((p) => p.receitaCentavos)));
+  const w = largura - margem.esquerda - margem.direita;
+  const h = altura - margem.topo - margem.baixo;
+  const passoX = serie.length > 1 ? w / (serie.length - 1) : 0;
+  const pontos = serie.map((p, i) => ({
+    x: margem.esquerda + (serie.length > 1 ? i * passoX : w / 2),
+    y: margem.topo + h - (p.receitaCentavos / maxCentavos) * h,
+    dia: p.dia,
+    receitaCentavos: p.receitaCentavos,
+  }));
+  const fmt = (n: number): string => n.toFixed(1);
+  const linha = pontos.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
+  const base = margem.topo + h;
+  const primeiro = pontos[0];
+  const ultimo = pontos[pontos.length - 1];
+  const area =
+    primeiro === undefined || ultimo === undefined
+      ? ""
+      : `M${fmt(primeiro.x)},${fmt(base)} ${pontos.map((p) => `L${fmt(p.x)},${fmt(p.y)}`).join(" ")} L${fmt(ultimo.x)},${fmt(base)} Z`;
+  const eixoY = [1, 0.75, 0.5, 0.25, 0].map((f) => ({
+    y: margem.topo + h - f * h,
+    centavos: Math.round(maxCentavos * f),
+  }));
+  return { pontos, linha, area, maxCentavos, eixoY };
+}
````

## `infrastructure/docker/scripts/migrar-banco.sh` (novo)

````diff
diff --git a/infrastructure/docker/scripts/migrar-banco.sh b/infrastructure/docker/scripts/migrar-banco.sh
new file mode 100644
index 0000000..a5256e8
--- /dev/null
+++ b/infrastructure/docker/scripts/migrar-banco.sh
@@ -0,0 +1,25 @@
+#!/usr/bin/env bash
+# Aplica as migrations da API (apps/api/migrations) no banco UNICO do Nucleos em desenvolvimento:
+# o Postgres do compose.dev (container nucleos-dev-postgres-1, 127.0.0.1, banco nucleos_dev).
+# Cada assunto vive em um schema desse mesmo banco (ex.: financeiro); nao se cria banco por tarefa.
+# Pre-requisitos: `scripts/dev.sh up core` (Postgres no ar), `make setup` e `make build`.
+# A senha e lida de .env.local e entregue ao migrador pela entrada padrao: nunca vai para env,
+# argumento de processo, arquivo temporario ou saida.
+set -euo pipefail
+DIR="$(cd "$(dirname "$0")/.." && pwd)"
+RAIZ="$(cd "$DIR/../.." && pwd)"
+ENV_FILE="$DIR/.env.local"
+CONTAINER="${PG_CONTAINER:-nucleos-dev-postgres-1}"
+[ -f "$RAIZ/apps/api/dist/migrar.js" ] || { echo "ERRO: apps/api/dist/migrar.js ausente (rode make build)" >&2; exit 1; }
+
+# A senha valida e a do container em execucao (o volume pode ter sido criado por outro checkout
+# com outro .env.local); sem o container, cai para o .env.local deste checkout.
+senha="$(docker exec "$CONTAINER" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
+if [ -z "$senha" ] && [ -f "$ENV_FILE" ]; then
+  senha="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
+fi
+[ -n "$senha" ] || { echo "ERRO: senha do Postgres indisponivel (suba com scripts/dev.sh up core)" >&2; exit 1; }
+senha="${senha%$'\r'}"
+
+export DATABASE_URL="postgres://nucleos_dev@127.0.0.1:${PG_HOST_PORT:-15432}/nucleos_dev"
+printf '%s' "$senha" | node "$RAIZ/apps/api/dist/migrar.js" --senha-stdin
````

## `packages/config/src/vendas.test.ts` (novo)

````diff
diff --git a/packages/config/src/vendas.test.ts b/packages/config/src/vendas.test.ts
new file mode 100644
index 0000000..15639c1
--- /dev/null
+++ b/packages/config/src/vendas.test.ts
@@ -0,0 +1,50 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { ConfigError, loadVendasConfig } from "./index.js";
+
+test("vendas: sem nada configurado usa 30 min, 90 dias e fica sem Hotmart nem chave", () => {
+  const c = loadVendasConfig({});
+  assert.equal(c.syncIntervalMs, 30 * 60_000);
+  assert.equal(c.backfillDays, 90);
+  assert.equal(c.hotmartEnv, "production");
+  assert.equal(c.hotmart, undefined);
+  assert.equal(c.apiKey, undefined);
+});
+
+test("vendas: intervalo e janela configuraveis, com limites", () => {
+  const c = loadVendasConfig({
+    HOTMART_SYNC_INTERVAL: "15m",
+    HOTMART_BACKFILL_DAYS: "30",
+    HOTMART_ENV: "sandbox",
+  });
+  assert.equal(c.syncIntervalMs, 15 * 60_000);
+  assert.equal(c.backfillDays, 30);
+  assert.equal(c.hotmartEnv, "sandbox");
+  for (const env of [
+    { HOTMART_SYNC_INTERVAL: "30s" },
+    { HOTMART_SYNC_INTERVAL: "25h" },
+    { HOTMART_BACKFILL_DAYS: "0" },
+    { HOTMART_ENV: "dev" },
+  ]) {
+    assert.throws(() => loadVendasConfig(env), ConfigError, JSON.stringify(env));
+  }
+});
+
+test("vendas: credenciais so por arquivo e sempre em par; erros nao ecoam valores", () => {
+  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_ID_FILE: "/run/secrets/id" }), ConfigError);
+  assert.throws(
+    () =>
+      loadVendasConfig({
+        HOTMART_CLIENT_ID_FILE: "relativo/id",
+        HOTMART_CLIENT_SECRET_FILE: "/run/secrets/s",
+      }),
+    ConfigError,
+  );
+  assert.throws(
+    () => loadVendasConfig({ HOTMART_CLIENT_SECRET: "valor-literal-sentinela" }),
+    (e: unknown) =>
+      e instanceof ConfigError &&
+      !e.message.includes("valor-literal-sentinela") &&
+      /HOTMART_CLIENT_SECRET/.test(e.message),
+  );
+});
````

## `packages/config/src/vendas.ts` (novo)

````diff
diff --git a/packages/config/src/vendas.ts b/packages/config/src/vendas.ts
new file mode 100644
index 0000000..ea443de
--- /dev/null
+++ b/packages/config/src/vendas.ts
@@ -0,0 +1,74 @@
+import { z } from "zod";
+import { loadSecret, parseConfig } from "./load.js";
+import type { Secret } from "./secret.js";
+import { absolutePathSchema, durationMs } from "./primitives.js";
+
+export const HOTMART_ENVS = ["production", "sandbox"] as const;
+export type HotmartEnv = (typeof HOTMART_ENVS)[number];
+
+const vendasEnvSchema = z
+  .object({
+    HOTMART_ENV: z.enum(HOTMART_ENVS).default("production"),
+    HOTMART_CLIENT_ID_FILE: absolutePathSchema.optional(),
+    HOTMART_CLIENT_SECRET_FILE: absolutePathSchema.optional(),
+    /** Intervalo entre sincronizacoes; padrao de 30 minutos. */
+    HOTMART_SYNC_INTERVAL: durationMs(60_000, 24 * 3_600_000).default(30 * 60_000),
+    /** Janela do primeiro carregamento (dias para tras). */
+    HOTMART_BACKFILL_DAYS: z
+      .string()
+      .regex(/^\d{1,4}$/, "dias invalidos")
+      .transform(Number)
+      .pipe(z.number().int().min(1).max(1825))
+      .default(90),
+    /** Chave de servico exigida em `/v1/vendas/*` (bearer lido de arquivo). */
+    VENDAS_API_KEY_FILE: absolutePathSchema.optional(),
+  })
+  .superRefine((v, ctx) => {
+    const par = [v.HOTMART_CLIENT_ID_FILE, v.HOTMART_CLIENT_SECRET_FILE];
+    if (par.some((p) => p === undefined) && par.some((p) => p !== undefined)) {
+      ctx.addIssue({
+        code: "custom",
+        path: ["HOTMART_CLIENT_SECRET_FILE"],
+        message: "informe HOTMART_CLIENT_ID_FILE e HOTMART_CLIENT_SECRET_FILE juntos",
+      });
+    }
+  });
+
+export interface HotmartCredentials {
+  readonly clientId: Secret;
+  readonly clientSecret: Secret;
+}
+
+export interface VendasConfig {
+  readonly hotmartEnv: HotmartEnv;
+  /** `undefined` desativa a sincronizacao (a API segue servindo o que ja foi baixado). */
+  readonly hotmart: HotmartCredentials | undefined;
+  readonly syncIntervalMs: number;
+  readonly backfillDays: number;
+  /** `undefined` => rotas de vendas respondem 503 (fail closed), nunca abertas. */
+  readonly apiKey: Secret | undefined;
+}
+
+/** Configuracao do modulo de vendas (integracao Hotmart + chave de servico). Sem valores nos erros. */
+export function loadVendasConfig(
+  env: Readonly<Record<string, string | undefined>> = process.env,
+): VendasConfig {
+  const e = parseConfig(vendasEnvSchema, env);
+  const hotmart =
+    e.HOTMART_CLIENT_ID_FILE !== undefined && e.HOTMART_CLIENT_SECRET_FILE !== undefined
+      ? {
+          clientId: loadSecret("HOTMART_CLIENT_ID_FILE", e.HOTMART_CLIENT_ID_FILE),
+          clientSecret: loadSecret("HOTMART_CLIENT_SECRET_FILE", e.HOTMART_CLIENT_SECRET_FILE),
+        }
+      : undefined;
+  return {
+    hotmartEnv: e.HOTMART_ENV,
+    hotmart,
+    syncIntervalMs: e.HOTMART_SYNC_INTERVAL,
+    backfillDays: e.HOTMART_BACKFILL_DAYS,
+    apiKey:
+      e.VENDAS_API_KEY_FILE === undefined
+        ? undefined
+        : loadSecret("VENDAS_API_KEY_FILE", e.VENDAS_API_KEY_FILE),
+  };
+}
````

## `packages/contracts/src/vendas.ts` (novo)

````diff
diff --git a/packages/contracts/src/vendas.ts b/packages/contracts/src/vendas.ts
new file mode 100644
index 0000000..c3216fc
--- /dev/null
+++ b/packages/contracts/src/vendas.ts
@@ -0,0 +1,123 @@
+/**
+ * Contrato do painel de vendas do setor Financeiro (dados vindos da Hotmart).
+ * Valores monetarios trafegam em centavos inteiros (nunca float) e sempre com a moeda ISO 4217.
+ * Datas de dia (`YYYY-MM-DD`) seguem o fuso America/Sao_Paulo; instantes sao RFC 3339 em UTC.
+ */
+
+/** Grupos em que cada status da Hotmart e classificado para os indicadores. */
+export type GrupoStatusVenda = "receita" | "reembolso" | "cancelada" | "pendente";
+
+export const GRUPOS_STATUS_VENDA: readonly GrupoStatusVenda[] = [
+  "receita",
+  "reembolso",
+  "cancelada",
+  "pendente",
+];
+
+export interface PeriodoVendas {
+  /** Primeiro dia incluido (YYYY-MM-DD). */
+  de: string;
+  /** Ultimo dia incluido (YYYY-MM-DD). */
+  ate: string;
+}
+
+export interface IndicadoresVendas {
+  /** Soma das vendas aprovadas/completas. */
+  receitaBrutaCentavos: number;
+  /** Taxas da Hotmart sobre as vendas aprovadas/completas. */
+  taxasCentavos: number;
+  /** Receita bruta menos taxas (estimativa; nao considera coprodutores/afiliados). */
+  receitaLiquidaCentavos: number;
+  vendas: number;
+  ticketMedioCentavos: number;
+  compradoresUnicos: number;
+  reembolsadoCentavos: number;
+  reembolsos: number;
+  /** Reembolsos / (vendas + reembolsos), entre 0 e 1. */
+  taxaReembolso: number;
+  /** Vendas de assinaturas dentro das vendas aprovadas. */
+  vendasAssinatura: number;
+}
+
+export interface PontoSerieVendas {
+  /** Dia (YYYY-MM-DD). */
+  dia: string;
+  receitaCentavos: number;
+  vendas: number;
+}
+
+export interface VendasPorProduto {
+  produtoId: string;
+  produtoNome: string;
+  receitaCentavos: number;
+  vendas: number;
+}
+
+export interface VendasPorStatus {
+  status: string;
+  grupo: GrupoStatusVenda;
+  vendas: number;
+  valorCentavos: number;
+}
+
+export interface VendasPorPagamento {
+  /** Tipo de pagamento informado pela Hotmart (ex.: CREDIT_CARD, PIX, BILLET). */
+  tipo: string;
+  vendas: number;
+  receitaCentavos: number;
+}
+
+export type StatusSincronizacao = "nunca" | "sucesso" | "parcial" | "falha" | "em_andamento";
+
+export interface EstadoSincronizacao {
+  /** Falso quando as credenciais da Hotmart nao estao configuradas. */
+  habilitada: boolean;
+  intervaloMinutos: number;
+  status: StatusSincronizacao;
+  ultimaTentativaEm: string | null;
+  ultimoSucessoEm: string | null;
+  /** Vendas gravadas/atualizadas na ultima execucao. */
+  ultimasVendasProcessadas: number;
+  /** Mensagem fixa e sem dados sensiveis; null quando tudo correu bem. */
+  mensagem: string | null;
+}
+
+export interface PainelVendas {
+  periodo: PeriodoVendas;
+  moeda: string;
+  moedasDisponiveis: string[];
+  produtos: { produtoId: string; produtoNome: string }[];
+  indicadores: IndicadoresVendas;
+  /** Mesmos indicadores no periodo imediatamente anterior, de igual duracao. */
+  indicadoresAnteriores: IndicadoresVendas;
+  serieDiaria: PontoSerieVendas[];
+  porProduto: VendasPorProduto[];
+  porStatus: VendasPorStatus[];
+  porPagamento: VendasPorPagamento[];
+  sincronizacao: EstadoSincronizacao;
+}
+
+export interface VendaResumo {
+  transacao: string;
+  produtoNome: string;
+  /** Pseudonimo estavel do comprador; o e-mail nunca e armazenado nem exposto. */
+  compradorId: string;
+  status: string;
+  grupo: GrupoStatusVenda;
+  pedidoEm: string;
+  valorCentavos: number;
+  taxaCentavos: number;
+  moeda: string;
+  pagamento: string;
+  parcelas: number;
+  assinatura: boolean;
+}
+
+export interface ListaVendas {
+  itens: VendaResumo[];
+  total: number;
+  limite: number;
+  deslocamento: number;
+}
+
+export const VENDAS_PATH = "/v1/vendas";
````
