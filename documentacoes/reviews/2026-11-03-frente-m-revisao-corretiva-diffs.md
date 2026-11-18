# Patch corretivo da revisão M — RM-01

Registro: [revisão independente](2026-11-03-frente-m-revisao-corretiva.md).
Commit: `bf0a20e177c2d7668ba871d87f496a92b8e2ce64`.
Mensagem: `fix(marketing): garantir limpeza do teste PG em falha de preparacao`.
Documentação e lessons excluídas para evitar recursão.

```diff
diff --git a/apps/api/src/marketing/marketing-pg.test.ts b/apps/api/src/marketing/marketing-pg.test.ts
index ea1b84c..d6b8c3b 100644
--- a/apps/api/src/marketing/marketing-pg.test.ts
+++ b/apps/api/src/marketing/marketing-pg.test.ts
@@ -19,6 +19,8 @@ describe(
   { skip: adminUrl === undefined ? "requer PG local temporario" : false },
   () => {
     let admin: Pool, pool: Pool, app: INestApplication;
+    const recursos: { admin?: Pool; pool?: Pool; app?: INestApplication; bancoCriado?: boolean } =
+      {};
     const nome = `nucleos_teste_meta_${randomBytes(4).toString("hex")}`;
     const agora = () => new Date("2026-11-02T12:00:00Z");
     let gasto = "19.99",
@@ -66,6 +68,7 @@ describe(
         ]),
         { logger: false },
       );
+      recursos.app = app;
       await app.listen(0, "127.0.0.1");
     }
     before(async () => {
@@ -74,9 +77,12 @@ describe(
       assert.equal(url.port, "15432");
       assert.equal(url.pathname, "/postgres");
       admin = new Pool({ connectionString: url.toString(), max: 1 });
+      recursos.admin = admin;
       await admin.query(`CREATE DATABASE ${nome}`);
+      recursos.bancoCriado = true;
       url.pathname = `/${nome}`;
       pool = new Pool({ connectionString: url.toString(), max: 5 });
+      recursos.pool = pool;
       await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
       assert.deepEqual(
         await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url))),
@@ -84,10 +90,24 @@ describe(
       );
     });
     after(async () => {
-      await app.close();
-      await pool.end();
-      await admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
-      await admin.end();
+      // Uma falha em migrations/listen pode ocorrer antes de app existir. Mesmo se
+      // close/end falhar, os recursos seguintes ainda precisam ser encerrados.
+      try {
+        await recursos.app?.close();
+      } finally {
+        try {
+          await recursos.pool?.end();
+        } finally {
+          if (recursos.admin !== undefined) {
+            try {
+              if (recursos.bancoCriado === true)
+                await recursos.admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
+            } finally {
+              await recursos.admin.end();
+            }
+          }
+        }
+      }
     });
     test("sem credencial: indisponível, nenhuma execução nem pedido, sem reset de PAUSADO", async () => {
       await subir(false);
```
