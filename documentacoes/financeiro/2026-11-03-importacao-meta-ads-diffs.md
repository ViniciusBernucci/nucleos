# Patch FIN-301 — Meta Ads

Registro: [entrega](2026-11-03-importacao-meta-ads.md).
Base: `a1a0b0e`; patch da candidata staged, somente código/testes/configuração.
Sem patch de documentação ou lessons (evita recursão).

```diff
diff --git a/.env.example b/.env.example
index 380c5d1..f6c0e2b 100644
--- a/.env.example
+++ b/.env.example
@@ -41,3 +41,9 @@ VENDAS_API_URL=http://127.0.0.1:3001
 # DATABASE_URL continua sem senha: use DATABASE_PASSWORD separadamente.
 # Alternativa compativel: <NOME>_FILE=/run/secrets/<nome>, arquivo 0400/0600.
 # Nao configure valor direto e *_FILE para a mesma credencial.
+
+# Meta Ads: leitura por System User com ads_read, sem alteracoes de campanhas.
+# Sem token ou conta, a tarefa do Gestor de Trafego fica indisponivel.
+META_ADS_ACCOUNT_ID=
+META_ADS_ACCESS_TOKEN=
+# Alternativa: META_ADS_ACCESS_TOKEN_FILE=/run/secrets/meta_ads_access_token
diff --git a/apps/api/migrations/0020_marketing_meta_ads.up.sql b/apps/api/migrations/0020_marketing_meta_ads.up.sql
new file mode 100644
index 0000000..318308b
--- /dev/null
+++ b/apps/api/migrations/0020_marketing_meta_ads.up.sql
@@ -0,0 +1,23 @@
+CREATE SCHEMA IF NOT EXISTS marketing;
+CREATE TABLE marketing.contas_anuncio (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ id_externo text NOT NULL UNIQUE, moeda text NOT NULL CHECK(moeda ~ '^[A-Z]{3}$'),
+ atualizado_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE TABLE marketing.campanhas (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ conta_anuncio_id bigint NOT NULL REFERENCES marketing.contas_anuncio(id),
+ id_externo text NOT NULL, nome text NOT NULL, status text, objetivo text,
+ atualizado_em timestamptz NOT NULL DEFAULT now(),
+ UNIQUE(conta_anuncio_id,id_externo)
+);
+CREATE TABLE marketing.gastos_diarios (
+ campanha_id bigint NOT NULL REFERENCES marketing.campanhas(id), dia date NOT NULL,
+ gasto_centavos bigint NOT NULL CHECK(gasto_centavos >= 0),
+ moeda text NOT NULL CHECK(moeda ~ '^[A-Z]{3}$'),
+ impressoes bigint NOT NULL CHECK(impressoes >= 0), cliques bigint NOT NULL CHECK(cliques >= 0),
+ compras_meta numeric NOT NULL CHECK(compras_meta >= 0), valor_compras_meta_centavos bigint NOT NULL CHECK(valor_compras_meta_centavos >= 0),
+ tipo_compra_meta text, atualizado_em timestamptz NOT NULL DEFAULT now(),
+ PRIMARY KEY(campanha_id,dia)
+);
+CREATE INDEX gastos_diarios_periodo ON marketing.gastos_diarios(dia);
diff --git a/apps/api/migrations/0021_marketing_funcionario.up.sql b/apps/api/migrations/0021_marketing_funcionario.up.sql
new file mode 100644
index 0000000..7d2a080
--- /dev/null
+++ b/apps/api/migrations/0021_marketing_funcionario.up.sql
@@ -0,0 +1,12 @@
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='INDISPONIVEL',
+ descricao='Importacao somente leitura. Exige META_ADS_ACCESS_TOKEN (ou arquivo) e META_ADS_ACCOUNT_ID no servidor.'
+ WHERE codigo='marketing.importar_meta_ads';
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f
+ JOIN funcionarios.definicoes_tarefa d ON d.codigo='marketing.importar_meta_ads'
+ WHERE f.slug='gestor-trafego' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
+ SELECT a.id,'CRON','0 */6 * * *',now() FROM funcionarios.atribuicoes a
+ JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo='marketing.importar_meta_ads'
+ AND NOT EXISTS(SELECT 1 FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id);
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index afed1c0..75337c3 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -1,5 +1,6 @@
 import "reflect-metadata";
-import { ConfigError, loadApiConfig, loadVendasConfig } from "@nucleos/config";
+import { MarketingModule } from "./marketing/marketing.module.js";
+import { ConfigError, loadApiConfig, loadVendasConfig, loadMarketingConfig } from "@nucleos/config";
 import { NestFactory } from "@nestjs/core";
 import { Pool } from "pg";
 import { AppModule } from "./app.module.js";
@@ -16,9 +17,11 @@ import { FuncionariosModule } from "./funcionarios/funcionarios.module.js";
 // nomes de variaveis e motivos, nunca valores.
 let config;
 let vendasConfig;
+let marketingConfig;
 try {
   config = loadApiConfig();
   vendasConfig = loadVendasConfig();
+  marketingConfig = loadMarketingConfig();
 } catch (e) {
   if (e instanceof ConfigError) {
     console.error(`api: ${e.message}`);
@@ -51,6 +54,12 @@ const app = await NestFactory.create(
     pool === undefined || motor === undefined
       ? []
       : [
+          MarketingModule.registrar({
+            config: marketingConfig,
+            motor,
+            apiKey: vendasConfig.apiKey,
+            log,
+          }),
           VendasModule.registrar({
             config: vendasConfig,
             pool,
diff --git a/apps/api/src/marketing/marketing-pg.test.ts b/apps/api/src/marketing/marketing-pg.test.ts
new file mode 100644
index 0000000..ea1b84c
--- /dev/null
+++ b/apps/api/src/marketing/marketing-pg.test.ts
@@ -0,0 +1,239 @@
+﻿import "reflect-metadata";
+import assert from "node:assert/strict";
+import { randomBytes } from "node:crypto";
+import { after, before, describe, test } from "node:test";
+import type { INestApplication } from "@nestjs/common";
+import { NestFactory } from "@nestjs/core";
+import { Secret } from "@nucleos/config";
+import { Pool } from "pg";
+import { AppModule } from "../app.module.js";
+import { MotorFuncionarios } from "../funcionarios/motor.js";
+import { RegistroHandlers } from "../funcionarios/handlers.js";
+import { lerMigracoes, migrar } from "../migrar.js";
+import { MarketingModule } from "./marketing.module.js";
+import { RepositorioMarketingPg } from "./repositorio-pg.js";
+
+const adminUrl = process.env["TEST_DATABASE_URL"];
+describe(
+  "Meta Ads PostgreSQL + HTTP",
+  { skip: adminUrl === undefined ? "requer PG local temporario" : false },
+  () => {
+    let admin: Pool, pool: Pool, app: INestApplication;
+    const nome = `nucleos_teste_meta_${randomBytes(4).toString("hex")}`;
+    const agora = () => new Date("2026-11-02T12:00:00Z");
+    let gasto = "19.99",
+      moeda = "BRL",
+      status = 200;
+    const pedidos: string[] = [];
+    const requisitar: typeof fetch = async (input) => {
+      const url = new URL(input instanceof Request ? input.url : input);
+      pedidos.push(url.pathname);
+      if (status !== 200) return new Response("sentinela-meta", { status });
+      return new Response(
+        JSON.stringify({
+          data: url.pathname.endsWith("campaigns")
+            ? [{ id: "321", name: "Campanha teste", status: "PAUSED", objective: "OUTCOME_SALES" }]
+            : [
+                {
+                  campaign_id: "321",
+                  campaign_name: "Campanha teste",
+                  date_start: "2026-11-01",
+                  date_stop: "2026-11-01",
+                  account_currency: moeda,
+                  spend: gasto,
+                  impressions: "50",
+                  clicks: "4",
+                },
+              ],
+        }),
+      );
+    };
+    const config = { meta: { token: new Secret("sentinela-meta"), contaId: "123" } };
+    let motor: MotorFuncionarios;
+    async function subir(credencial: boolean, key: Secret | null = new Secret("chave-local")) {
+      motor = new MotorFuncionarios(pool, new RegistroHandlers(), undefined, {
+        agora: async () => agora(),
+      });
+      app = await NestFactory.create(
+        AppModule.comModulos([
+          MarketingModule.registrar({
+            config: credencial ? config : { meta: undefined },
+            motor,
+            apiKey: key ?? undefined,
+            requisitar,
+            agora,
+          }),
+        ]),
+        { logger: false },
+      );
+      await app.listen(0, "127.0.0.1");
+    }
+    before(async () => {
+      const url = new URL(adminUrl as string);
+      assert.equal(url.hostname, "127.0.0.1");
+      assert.equal(url.port, "15432");
+      assert.equal(url.pathname, "/postgres");
+      admin = new Pool({ connectionString: url.toString(), max: 1 });
+      await admin.query(`CREATE DATABASE ${nome}`);
+      url.pathname = `/${nome}`;
+      pool = new Pool({ connectionString: url.toString(), max: 5 });
+      await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
+      assert.deepEqual(
+        await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url))),
+        [],
+      );
+    });
+    after(async () => {
+      await app.close();
+      await pool.end();
+      await admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
+      await admin.end();
+    });
+    test("sem credencial: indisponível, nenhuma execução nem pedido, sem reset de PAUSADO", async () => {
+      await subir(false);
+      assert.equal(motor.registro.possui("marketing.importar_meta_ads"), false);
+      const d = (
+        await pool.query(
+          "SELECT status_implementacao,descricao FROM funcionarios.definicoes_tarefa WHERE codigo='marketing.importar_meta_ads'",
+        )
+      ).rows[0] as { status_implementacao: string; descricao: string };
+      assert.equal(d.status_implementacao, "INDISPONIVEL");
+      assert.match(d.descricao, /META_ADS/);
+      const a = (
+        await pool.query<{ id: string }>(
+          "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
+        )
+      ).rows[0];
+      assert.ok(a);
+      await assert.rejects(motor.executarAgora(a.id));
+      assert.equal(pedidos.length, 0);
+      assert.equal(
+        (await pool.query<{ count: string }>("SELECT count(*) FROM funcionarios.execucoes")).rows[0]
+          ?.count,
+        "0",
+      );
+      await pool.query(
+        "UPDATE funcionarios.funcionarios SET status='PAUSADO' WHERE slug='gestor-trafego'",
+      );
+      await app.close();
+      await subir(true);
+      assert.equal(
+        (
+          await pool.query<{ status: string }>(
+            "SELECT status FROM funcionarios.funcionarios WHERE slug='gestor-trafego'",
+          )
+        ).rows[0]?.status,
+        "PAUSADO",
+      );
+      assert.equal(
+        (
+          await pool.query<{ cron: string }>(
+            "SELECT cron FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
+          )
+        ).rows[0]?.cron,
+        "0 */6 * * *",
+      );
+      assert.equal(
+        (
+          await pool.query<{ status_implementacao: string }>(
+            "SELECT status_implementacao FROM funcionarios.definicoes_tarefa WHERE codigo='marketing.aplicar_otimizacao'",
+          )
+        ).rows[0]?.status_implementacao,
+        "INDISPONIVEL",
+      );
+      assert.equal(
+        (
+          await pool.query<{ count: string }>(
+            "SELECT count(*) FROM funcionarios.atribuicoes a JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id WHERE f.slug='gestor-trafego'",
+          )
+        ).rows[0]?.count,
+        "1",
+      );
+    });
+    test("handler atualiza campanha+dia idempotente; falhas não deixam persistência parcial", async () => {
+      const handler = motor.registro.obter("marketing.importar_meta_ads");
+      const ctx = {
+        execucaoId: "1",
+        chaveIdempotencia: "meta-teste",
+        tentativa: 1,
+        config: {},
+        signal: new AbortController().signal,
+        verificarLease: async () => true,
+      };
+      assert.equal(handler.validarConfig({ token: "injetado" }), false);
+      await handler.executar(ctx);
+      gasto = "20.01";
+      await handler.executar(ctx);
+      const repo = new RepositorioMarketingPg(pool);
+      assert.equal((await repo.campanhas()).length, 1);
+      const gastos = await repo.gastos("2026-10-27", "2026-11-02");
+      assert.equal(gastos.length, 1);
+      assert.equal(gastos[0]?.gasto_centavos, "2001");
+      assert.equal(gastos[0].moeda, "BRL");
+      for (const code of [429, 401]) {
+        status = code;
+        await assert.rejects(handler.executar(ctx));
+      }
+      status = 200;
+      moeda = "USD";
+      await assert.rejects(handler.executar(ctx), /moeda/);
+      moeda = "BRL";
+      let checks = 0;
+      await assert.rejects(
+        repo.salvar(
+          "123",
+          [{ id: "321", nome: "Rollback", status: "ACTIVE", objetivo: "OUTCOME_SALES" }],
+          [],
+          async () => ++checks === 1,
+        ),
+      );
+      assert.equal((await repo.campanhas())[0]?.nome, "Campanha teste");
+      assert.equal((await repo.gastos("2026-10-27", "2026-11-02"))[0]?.gasto_centavos, "2001");
+    });
+    test("motor executa a tarefa real e registra resumo sem credencial", async () => {
+      await pool.query(
+        "UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='gestor-trafego'",
+      );
+      const atribuicao = (
+        await pool.query<{ id: string }>(
+          "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
+        )
+      ).rows[0];
+      assert.ok(atribuicao);
+      const id = await motor.executarAgora(atribuicao.id);
+      assert.equal(await motor.consumirUma(), true);
+      const execucao = await motor.aguardar(id);
+      assert.equal(execucao.status, "SUCESSO");
+      assert.doesNotMatch(JSON.stringify(execucao), /sentinela-meta/);
+      assert.equal(
+        (await new RepositorioMarketingPg(pool).gastos("2026-10-27", "2026-11-02")).length,
+        1,
+      );
+    });
+    test("HTTP somente leitura autenticada, valida período e responde strings precisas", async () => {
+      const base = await app.getUrl();
+      const headers = { authorization: "Bearer chave-local" };
+      assert.equal((await fetch(`${base}/v1/marketing/campanhas`)).status, 401);
+      assert.equal((await fetch(`${base}/v1/marketing/campanhas`, { headers })).status, 200);
+      const r = await fetch(`${base}/v1/marketing/gastos?de=2026-10-27&ate=2026-11-02`, {
+        headers,
+      });
+      assert.equal(r.status, 200);
+      const body = await r.text();
+      assert.match(body, /2001/);
+      assert.doesNotMatch(body, /sentinela-meta/);
+      for (const query of ["", "?de=2026-11-31&ate=2026-12-01", "?de=2026-11-02&ate=2026-10-01"])
+        assert.equal((await fetch(`${base}/v1/marketing/gastos${query}`, { headers })).status, 400);
+      assert.equal(
+        (await fetch(`${base}/v1/marketing/campanhas`, { method: "POST", headers })).status,
+        404,
+      );
+      await app.close();
+      await subir(false, null);
+      assert.equal(
+        (await fetch(`${await app.getUrl()}/v1/marketing/campanhas`, { headers })).status,
+        503,
+      );
+    });
+  },
+);
diff --git a/apps/api/src/marketing/marketing.controller.ts b/apps/api/src/marketing/marketing.controller.ts
new file mode 100644
index 0000000..071a4dc
--- /dev/null
+++ b/apps/api/src/marketing/marketing.controller.ts
@@ -0,0 +1,20 @@
+﻿import { Controller, Get, Inject, Query, UseGuards, BadRequestException } from "@nestjs/common";
+import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { RepositorioMarketingPg } from "./repositorio-pg.js";
+import { resolverPeriodo } from "../vendas/periodo.js";
+
+@Controller("v1/marketing")
+@UseGuards(ChaveServicoGuard)
+export class MarketingController {
+  constructor(@Inject(RepositorioMarketingPg) private readonly repo: RepositorioMarketingPg) {}
+  @Get("campanhas") campanhas() {
+    return this.repo.campanhas();
+  }
+  @Get("gastos") gastos(@Query() q: Record<string, unknown>) {
+    if (typeof q["de"] !== "string" || typeof q["ate"] !== "string")
+      throw new BadRequestException("informe de e ate");
+    const p = resolverPeriodo(q["de"], q["ate"], new Date());
+    if (!p.ok) throw new BadRequestException("periodo invalido");
+    return this.repo.gastos(q["de"], q["ate"]);
+  }
+}
diff --git a/apps/api/src/marketing/marketing.module.ts b/apps/api/src/marketing/marketing.module.ts
new file mode 100644
index 0000000..e26c973
--- /dev/null
+++ b/apps/api/src/marketing/marketing.module.ts
@@ -0,0 +1,100 @@
+﻿import { Module, type DynamicModule, Injectable, Inject, type OnModuleInit } from "@nestjs/common";
+import type { MarketingConfig, Secret } from "@nucleos/config";
+import { MotorFuncionarios } from "../funcionarios/motor.js";
+import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { ClienteMetaAds } from "./meta-client.js";
+import { MarketingController } from "./marketing.controller.js";
+import { RepositorioMarketingPg } from "./repositorio-pg.js";
+
+const DISPONIVEL = Symbol("META_DISPONIVEL");
+@Injectable()
+class EstadoMeta implements OnModuleInit {
+  constructor(
+    @Inject(MotorFuncionarios) private readonly motor: MotorFuncionarios,
+    @Inject(DISPONIVEL) private readonly disponivel: boolean,
+  ) {}
+  async onModuleInit(): Promise<void> {
+    await this.motor.pool.query(
+      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao=$1 WHERE codigo='marketing.importar_meta_ads'",
+      [this.disponivel ? "DISPONIVEL" : "INDISPONIVEL"],
+    );
+    // Preserva PAUSADO e DESATIVADO; só promove o seed quando o executor existe.
+    await this.motor.pool.query(
+      `UPDATE funcionarios.funcionarios SET status=$1,atualizado_em=now() WHERE slug='gestor-trafego' AND status=$2`,
+      [this.disponivel ? "ATIVO" : "RASCUNHO", this.disponivel ? "RASCUNHO" : "ATIVO"],
+    );
+  }
+}
+export function janelaMeta(agora: Date): { de: string; ate: string } {
+  const ate = new Intl.DateTimeFormat("en-CA", {
+    timeZone: "America/Sao_Paulo",
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+  }).format(agora);
+  const inicio = new Date(`${ate}T12:00:00Z`);
+  inicio.setUTCDate(inicio.getUTCDate() - 6);
+  return { de: inicio.toISOString().slice(0, 10), ate };
+}
+@Module({})
+export class MarketingModule {
+  static registrar({
+    config,
+    motor,
+    apiKey,
+    requisitar = fetch,
+    agora = () => new Date(),
+    log = () => undefined,
+  }: {
+    config: MarketingConfig;
+    motor: MotorFuncionarios;
+    apiKey: Secret | undefined;
+    requisitar?: typeof fetch;
+    agora?: () => Date;
+    log?: (s: string) => void;
+  }): DynamicModule {
+    const repo = new RepositorioMarketingPg(motor.pool);
+    if (config.meta !== undefined) {
+      const cliente = new ClienteMetaAds(config.meta, requisitar),
+        contaId = config.meta.contaId;
+      motor.registro.registrar({
+        chave: "marketing.importar_meta_ads",
+        validarConfig: (c) => Object.keys(c).length === 0,
+        executar: async (ctx) => {
+          ctx.signal.throwIfAborted();
+          if (!(await ctx.verificarLease())) throw new Error("Meta Ads: lease perdida.");
+          const { de, ate } = janelaMeta(agora());
+          const dados = await cliente.importar(de, ate, ctx.signal);
+          await repo.salvar(
+            contaId,
+            dados.campanhas,
+            dados.gastos,
+            async () => !ctx.signal.aborted && (await ctx.verificarLease()),
+          );
+          return {
+            campanhas: dados.campanhas.length,
+            diasImportados: dados.gastos.length,
+            de,
+            ate,
+            moeda: "BRL",
+          };
+        },
+      });
+    } else
+      log(
+        "marketing: Meta Ads indisponivel; configure META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID no servidor.",
+      );
+    return {
+      module: MarketingModule,
+      controllers: [MarketingController],
+      providers: [
+        ChaveServicoGuard,
+        EstadoMeta,
+        { provide: CHAVE_SERVICO, useValue: apiKey },
+        { provide: MotorFuncionarios, useValue: motor },
+        { provide: DISPONIVEL, useValue: config.meta !== undefined },
+        { provide: RepositorioMarketingPg, useValue: repo },
+      ],
+    };
+  }
+}
diff --git a/apps/api/src/marketing/meta-client.test.ts b/apps/api/src/marketing/meta-client.test.ts
new file mode 100644
index 0000000..c1650e9
--- /dev/null
+++ b/apps/api/src/marketing/meta-client.test.ts
@@ -0,0 +1,126 @@
+﻿import assert from "node:assert/strict";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import { ClienteMetaAds, centavos, normalizarGasto, ErroMeta } from "./meta-client.js";
+import { janelaMeta } from "./marketing.module.js";
+
+const credentials = { contaId: "123", token: new Secret("sentinela-meta-test") };
+const signal = new AbortController().signal;
+export const insight = {
+  campaign_id: "321",
+  campaign_name: "Teste",
+  date_start: "2026-11-01",
+  date_stop: "2026-11-01",
+  account_currency: "BRL",
+  spend: "19.99",
+  impressions: "120",
+  clicks: "4",
+  actions: [
+    { action_type: "purchase", value: "2" },
+    { action_type: "omni_purchase", value: "2" },
+    { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
+  ],
+  action_values: [{ action_type: "omni_purchase", value: "38.98" }],
+};
+const response = (data: unknown, paging?: unknown) =>
+  new Response(JSON.stringify({ data, ...(paging === undefined ? {} : { paging }) }));
+const campanha = { id: "321", name: "Teste", status: "ACTIVE", objective: "OUTCOME_SALES" };
+
+test("decimal exato e arredondamento de valor reportado; compra sobreposta não soma", () => {
+  assert.equal(centavos("19.99"), "1999");
+  assert.equal(centavos("99999999999999.99"), "9999999999999999");
+  assert.equal(centavos("0.105"), "11");
+  const gasto = normalizarGasto(insight, "2026-10-27", "2026-11-02");
+  assert.equal(gasto.comprasMeta, "2");
+  assert.equal(gasto.tipoCompraMeta, "omni_purchase");
+  assert.equal(gasto.valorComprasMetaCentavos, "3898");
+  assert.throws(() => centavos("-1"));
+  assert.throws(() => centavos("1e3"));
+});
+test("rejeita moeda sem FX, data fora janela e campos inválidos", () => {
+  assert.throws(
+    () => normalizarGasto({ ...insight, account_currency: "USD" }, "2026-10-27", "2026-11-02"),
+    (e: unknown) => e instanceof ErroMeta && e.codigo === "moeda",
+  );
+  for (const v of [
+    { ...insight, date_start: "2026-10-01" },
+    { ...insight, impressions: "NaN" },
+    { ...insight, date_stop: "2026-11-02" },
+    { ...insight, spend: null },
+  ])
+    assert.throws(() => normalizarGasto(v, "2026-10-27", "2026-11-02"));
+});
+test("paginação fixa host/rota, usa somente GET e nunca token query/next host", async () => {
+  const urls: URL[] = [];
+  const cliente = new ClienteMetaAds(credentials, async (input, init) => {
+    const url = new URL(input instanceof Request ? input.url : input);
+    urls.push(url);
+    assert.equal(url.hostname, "graph.facebook.com");
+    assert.equal(init?.method, "GET");
+    assert.equal(init.redirect, "error");
+    assert.equal(
+      (init.headers as Record<string, string>)["Authorization"],
+      "Bearer sentinela-meta-test",
+    );
+    assert.equal(url.searchParams.has("access_token"), false);
+    if (url.pathname.endsWith("campaigns")) return response([campanha]);
+    assert.equal(url.searchParams.get("level"), "campaign");
+    assert.equal(url.searchParams.get("time_increment"), "1");
+    return url.searchParams.has("after")
+      ? response([])
+      : response([insight], {
+          next: "https://evil.invalid/?access_token=nao-propagar",
+          cursors: { after: "cursor_2" },
+        });
+  });
+  const dados = await cliente.importar("2026-10-27", "2026-11-02", signal);
+  assert.equal(urls.length, 3);
+  assert.equal(dados.gastos.length, 1);
+  assert.equal(urls[2]?.searchParams.get("after"), "cursor_2");
+});
+test("erros 429, token inválido, rede e JSON são fixos e sem corpo/url/segredo", async () => {
+  for (const [status, codigo] of [
+    [429, "limite"],
+    [401, "credencial"],
+    [400, "credencial"],
+    [403, "credencial"],
+    [500, "rede"],
+  ] as const) {
+    const cliente = new ClienteMetaAds(
+      credentials,
+      async () => new Response("sentinela-meta-test https://evil.invalid/", { status }),
+    );
+    await assert.rejects(
+      cliente.importar("2026-10-27", "2026-11-02", signal),
+      (e: unknown) =>
+        e instanceof ErroMeta &&
+        e.codigo === codigo &&
+        !e.message.includes("sentinela") &&
+        !e.message.includes("https"),
+    );
+  }
+  for (const impl of [
+    async () => {
+      throw new Error("https://secret.invalid/sentinela");
+    },
+    async () => new Response("invalido"),
+  ]) {
+    await assert.rejects(
+      new ClienteMetaAds(credentials, impl).importar("2026-10-27", "2026-11-02", signal),
+      ErroMeta,
+    );
+  }
+});
+test("cursor repetido/malformado não cria loop, abort interrompe, janela contém 7 dias", async () => {
+  const cliente = new ClienteMetaAds(credentials, async () =>
+    response([], { next: "qualquer", cursors: { after: "igual" } }),
+  );
+  await assert.rejects(cliente.importar("2026-10-27", "2026-11-02", signal), ErroMeta);
+  const abort = new AbortController();
+  abort.abort();
+  await assert.rejects(cliente.importar("2026-10-27", "2026-11-02", abort.signal));
+  assert.deepEqual(janelaMeta(new Date("2026-11-02T01:00:00Z")), {
+    de: "2026-10-26",
+    ate: "2026-11-01",
+  });
+});
diff --git a/apps/api/src/marketing/meta-client.ts b/apps/api/src/marketing/meta-client.ts
new file mode 100644
index 0000000..c32b8b8
--- /dev/null
+++ b/apps/api/src/marketing/meta-client.ts
@@ -0,0 +1,190 @@
+﻿import type { MarketingConfig } from "@nucleos/config";
+
+export const META_API_VERSION = "v26.0";
+export class ErroMeta extends Error {
+  constructor(readonly codigo: "limite" | "credencial" | "resposta" | "rede" | "moeda") {
+    super(
+      {
+        limite: "Meta Ads: limite de requisicoes; tente novamente mais tarde.",
+        credencial: "Meta Ads: credencial invalida ou sem permissao de leitura.",
+        resposta: "Meta Ads: resposta invalida.",
+        rede: "Meta Ads: falha de comunicacao.",
+        moeda: "Meta Ads: moeda incompatível com BRL; nenhuma conversao cambial foi aplicada.",
+      }[codigo],
+    );
+  }
+}
+export interface CampanhaMeta {
+  id: string;
+  nome: string;
+  status: string;
+  objetivo: string;
+}
+export interface GastoMeta {
+  campanhaId: string;
+  nome: string;
+  dia: string;
+  moeda: string;
+  gastoCentavos: string;
+  impressoes: string;
+  cliques: string;
+  comprasMeta: string;
+  valorComprasMetaCentavos: string;
+  tipoCompraMeta: string | null;
+}
+function objeto(v: unknown): Record<string, unknown> {
+  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new ErroMeta("resposta");
+  return v as Record<string, unknown>;
+}
+function texto(v: unknown, re: RegExp, limite = 500): string {
+  if (typeof v !== "string" || v.length > limite || !re.test(v)) throw new ErroMeta("resposta");
+  return v;
+}
+function inteiro(v: unknown): string {
+  return texto(v, /^\d{1,15}$/);
+}
+/** Decimal textual -> centavos com arredondamento half-up, sem ponto flutuante. */
+export function centavos(v: unknown): string {
+  const raw = texto(v, /^\d{1,14}(\.\d{1,10})?$/);
+  const [unidade = "0", fracao = ""] = raw.split(".");
+  return (
+    BigInt(unidade) * 100n +
+    BigInt((fracao + "00").slice(0, 2)) +
+    (Number(fracao[2] ?? "0") >= 5 ? 1n : 0n)
+  ).toString();
+}
+function acoes(v: unknown): Map<string, string> {
+  if (v === undefined) return new Map();
+  if (!Array.isArray(v)) throw new ErroMeta("resposta");
+  const result = new Map<string, string>();
+  for (const item of v) {
+    const a = objeto(item);
+    const tipo = texto(a["action_type"], /^[a-zA-Z0-9_.]+$/);
+    if (result.has(tipo)) throw new ErroMeta("resposta");
+    result.set(tipo, texto(a["value"], /^\d{1,14}(\.\d{1,10})?$/));
+  }
+  return result;
+}
+export function normalizarGasto(v: unknown, de: string, ate: string): GastoMeta {
+  const x = objeto(v);
+  const dia = texto(x["date_start"], /^\d{4}-\d{2}-\d{2}$/);
+  if (
+    dia < de ||
+    dia > ate ||
+    dia !== x["date_stop"] ||
+    !Number.isFinite(Date.parse(dia)) ||
+    new Date(dia).toISOString().slice(0, 10) !== dia
+  )
+    throw new ErroMeta("resposta");
+  const moeda = texto(x["account_currency"], /^[A-Z]{3}$/);
+  if (moeda !== "BRL") throw new ErroMeta("moeda");
+  const compras = acoes(x["actions"]),
+    valores = acoes(x["action_values"]);
+  // Categorias sobrepostas: escolhe uma única série, nunca soma purchase + pixel + omni.
+  const tipo =
+    ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"].find((k) =>
+      compras.has(k),
+    ) ?? null;
+  return {
+    campanhaId: texto(x["campaign_id"], /^\d{1,30}$/),
+    nome: texto(x["campaign_name"], /^[\s\S]+$/),
+    dia,
+    moeda,
+    gastoCentavos: centavos(x["spend"]),
+    impressoes: inteiro(x["impressions"]),
+    cliques: inteiro(x["clicks"]),
+    comprasMeta: tipo === null ? "0" : (compras.get(tipo) ?? "0"),
+    valorComprasMetaCentavos: tipo === null ? "0" : centavos(valores.get(tipo) ?? "0"),
+    tipoCompraMeta: tipo,
+  };
+}
+export class ClienteMetaAds {
+  constructor(
+    readonly credenciais: NonNullable<MarketingConfig["meta"]>,
+    private readonly requisitar: typeof fetch = fetch,
+  ) {
+    if (!/^\d{1,30}$/.test(credenciais.contaId)) throw new ErroMeta("credencial");
+  }
+  async #paginas(
+    rota: "campaigns" | "insights",
+    params: Record<string, string>,
+    signal: AbortSignal,
+  ): Promise<unknown[]> {
+    const resultado: unknown[] = [],
+      vistos = new Set<string>();
+    let cursor: string | undefined;
+    for (let pagina = 0; pagina < 1000; pagina++) {
+      signal.throwIfAborted();
+      const url = new URL(
+        `https://graph.facebook.com/${META_API_VERSION}/act_${this.credenciais.contaId}/${rota}`,
+      );
+      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
+      url.searchParams.set("limit", "500");
+      if (cursor !== undefined) url.searchParams.set("after", cursor);
+      let r: Response;
+      try {
+        r = await this.requisitar(url, {
+          method: "GET",
+          headers: { Authorization: `Bearer ${this.credenciais.token.reveal()}` },
+          redirect: "error",
+          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
+        });
+      } catch {
+        throw new ErroMeta("rede");
+      }
+      if (r.status === 429) throw new ErroMeta("limite");
+      if ([400, 401, 403].includes(r.status)) throw new ErroMeta("credencial");
+      if (!r.ok) throw new ErroMeta("rede");
+      let body: Record<string, unknown>;
+      try {
+        body = objeto(await r.json());
+      } catch {
+        throw new ErroMeta("resposta");
+      }
+      if (body["error"] !== undefined || !Array.isArray(body["data"]))
+        throw new ErroMeta("resposta");
+      const dados: unknown[] = body["data"];
+      resultado.push(...dados);
+      if (resultado.length > 100000) throw new ErroMeta("resposta");
+      if (body["paging"] === undefined) return resultado;
+      const paging = objeto(body["paging"]);
+      if (paging["next"] === undefined) return resultado;
+      // Não visita paging.next: apenas cursor opaco, host/rota/credencial sob controle local.
+      cursor = texto(objeto(paging["cursors"])["after"], /^[A-Za-z0-9_\-=:]+$/, 4096);
+      if (vistos.has(cursor)) throw new ErroMeta("resposta");
+      vistos.add(cursor);
+    }
+    throw new ErroMeta("resposta");
+  }
+  async importar(
+    de: string,
+    ate: string,
+    signal: AbortSignal,
+  ): Promise<{ campanhas: CampanhaMeta[]; gastos: GastoMeta[] }> {
+    const campanhas = (
+      await this.#paginas("campaigns", { fields: "id,name,status,objective" }, signal)
+    ).map((v) => {
+      const x = objeto(v);
+      return {
+        id: texto(x["id"], /^\d{1,30}$/),
+        nome: texto(x["name"], /^[\s\S]+$/),
+        status: texto(x["status"], /^[A-Z_]+$/),
+        objetivo: texto(x["objective"], /^[A-Z_]+$/),
+      };
+    });
+    const gastos = (
+      await this.#paginas(
+        "insights",
+        {
+          level: "campaign",
+          time_increment: "1",
+          time_range: JSON.stringify({ since: de, until: ate }),
+          fields:
+            "campaign_id,campaign_name,date_start,date_stop,account_currency,spend,impressions,clicks,actions,action_values",
+        },
+        signal,
+      )
+    ).map((v) => normalizarGasto(v, de, ate));
+    return { campanhas, gastos };
+  }
+}
diff --git a/apps/api/src/marketing/repositorio-pg.ts b/apps/api/src/marketing/repositorio-pg.ts
new file mode 100644
index 0000000..42aa7db
--- /dev/null
+++ b/apps/api/src/marketing/repositorio-pg.ts
@@ -0,0 +1,105 @@
+﻿import type { Pool } from "pg";
+import type { CampanhaMeta, GastoMeta } from "./meta-client.js";
+
+export interface CampanhaLeitura {
+  id: string;
+  conta_anuncio_id: string;
+  id_externo: string;
+  nome: string;
+  status: string | null;
+  objetivo: string | null;
+}
+export interface GastoLeitura {
+  campanha_id: string;
+  campanha_id_externo: string;
+  campanha_nome: string;
+  dia: string;
+  moeda: string;
+  gasto_centavos: string;
+  impressoes: string;
+  cliques: string;
+  compras_meta: string;
+  valor_compras_meta_centavos: string;
+  tipo_compra_meta: string | null;
+}
+export class RepositorioMarketingPg {
+  constructor(readonly pool: Pool) {}
+  async salvar(
+    contaId: string,
+    campanhas: CampanhaMeta[],
+    gastos: GastoMeta[],
+    verificar: () => Promise<boolean>,
+  ): Promise<void> {
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      // Serializa execuções concorrentes da mesma conta antes dos upserts.
+      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`meta-ads:${contaId}`]);
+      if (!(await verificar())) throw new Error("Meta Ads: lease perdida.");
+      const conta = (
+        await c.query<{ id: string }>(
+          `INSERT INTO marketing.contas_anuncio(id_externo,moeda) VALUES($1,'BRL') ON CONFLICT(id_externo) DO UPDATE SET moeda=excluded.moeda,atualizado_em=now() RETURNING id`,
+          [contaId],
+        )
+      ).rows[0];
+      if (conta === undefined) throw new Error("Meta Ads: conta indisponivel.");
+      const ids = new Map<string, string>();
+      for (const campanha of campanhas) {
+        const r = await c.query<{ id: string }>(
+          `INSERT INTO marketing.campanhas(conta_anuncio_id,id_externo,nome,status,objetivo) VALUES($1,$2,$3,$4,$5) ON CONFLICT(conta_anuncio_id,id_externo) DO UPDATE SET nome=excluded.nome,status=excluded.status,objetivo=excluded.objetivo,atualizado_em=now() RETURNING id`,
+          [conta.id, campanha.id, campanha.nome, campanha.status, campanha.objetivo],
+        );
+        ids.set(campanha.id, r.rows[0]?.id ?? "");
+      }
+      for (const g of gastos) {
+        let id = ids.get(g.campanhaId);
+        if (id === undefined) {
+          // Insights podem conter uma campanha arquivada ausente do catálogo corrente.
+          const r = await c.query<{ id: string }>(
+            `INSERT INTO marketing.campanhas(conta_anuncio_id,id_externo,nome) VALUES($1,$2,$3) ON CONFLICT(conta_anuncio_id,id_externo) DO UPDATE SET nome=excluded.nome,atualizado_em=now() RETURNING id`,
+            [conta.id, g.campanhaId, g.nome],
+          );
+          id = r.rows[0]?.id;
+          if (id === undefined) throw new Error("Meta Ads: campanha indisponivel.");
+          ids.set(g.campanhaId, id);
+        }
+        await c.query(
+          `INSERT INTO marketing.gastos_diarios(campanha_id,dia,gasto_centavos,moeda,impressoes,cliques,compras_meta,valor_compras_meta_centavos,tipo_compra_meta) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(campanha_id,dia) DO UPDATE SET gasto_centavos=excluded.gasto_centavos,moeda=excluded.moeda,impressoes=excluded.impressoes,cliques=excluded.cliques,compras_meta=excluded.compras_meta,valor_compras_meta_centavos=excluded.valor_compras_meta_centavos,tipo_compra_meta=excluded.tipo_compra_meta,atualizado_em=now()`,
+          [
+            id,
+            g.dia,
+            g.gastoCentavos,
+            g.moeda,
+            g.impressoes,
+            g.cliques,
+            g.comprasMeta,
+            g.valorComprasMetaCentavos,
+            g.tipoCompraMeta,
+          ],
+        );
+      }
+      if (!(await verificar())) throw new Error("Meta Ads: lease perdida.");
+      await c.query("COMMIT");
+    } catch {
+      await c.query("ROLLBACK");
+      throw new Error("Meta Ads: importacao nao persistida.");
+    } finally {
+      c.release();
+    }
+  }
+  async campanhas(): Promise<CampanhaLeitura[]> {
+    return (
+      await this.pool.query<CampanhaLeitura>(
+        "SELECT id::text,conta_anuncio_id::text,id_externo,nome,status,objetivo FROM marketing.campanhas ORDER BY id",
+      )
+    ).rows;
+  }
+  async gastos(de: string, ate: string): Promise<GastoLeitura[]> {
+    return (
+      await this.pool.query<GastoLeitura>(
+        `SELECT g.campanha_id::text,c.id_externo campanha_id_externo,c.nome campanha_nome,to_char(g.dia,'YYYY-MM-DD') dia,g.moeda,g.gasto_centavos::text,g.impressoes::text,g.cliques::text,g.compras_meta::text,g.valor_compras_meta_centavos::text,g.tipo_compra_meta FROM marketing.gastos_diarios g JOIN marketing.campanhas c ON c.id=g.campanha_id WHERE dia BETWEEN $1::date AND $2::date ORDER BY dia,c.id`,
+        [de, ate],
+      )
+    ).rows;
+  }
+}
diff --git a/packages/config/src/index.ts b/packages/config/src/index.ts
index 911b862..18ca2da 100644
--- a/packages/config/src/index.ts
+++ b/packages/config/src/index.ts
@@ -16,3 +16,4 @@ export {
 } from "./vendas.js";
 export { absolutePathSchema, durationMs, portSchema, serviceUrl, sizeBytes } from "./primitives.js";
 export { MAX_SECRET_BYTES, Secret, SecretFileError, readSecretFile } from "./secret.js";
+export { loadMarketingConfig, type MarketingConfig } from "./marketing.js";
diff --git a/packages/config/src/marketing.test.ts b/packages/config/src/marketing.test.ts
new file mode 100644
index 0000000..bfdb5c8
--- /dev/null
+++ b/packages/config/src/marketing.test.ts
@@ -0,0 +1,31 @@
+﻿import assert from "node:assert/strict";
+import { test } from "node:test";
+import { loadMarketingConfig } from "./marketing.js";
+
+test("sem token ou conta não fabrica configuração; credencial não serializa segredo", () => {
+  assert.equal(loadMarketingConfig({}).meta, undefined);
+  assert.equal(loadMarketingConfig({ META_ADS_ACCESS_TOKEN: "sentinela-meta" }).meta, undefined);
+  assert.equal(loadMarketingConfig({ META_ADS_ACCOUNT_ID: "123" }).meta, undefined);
+  const config = loadMarketingConfig({
+    META_ADS_ACCESS_TOKEN: "sentinela-meta",
+    META_ADS_ACCOUNT_ID: "act_123",
+  });
+  assert.equal(config.meta?.contaId, "123");
+  assert.doesNotMatch(JSON.stringify(config), /sentinela-meta/);
+});
+test("config rejeita conta arbitrária, segredo em valor+arquivo e token inválido sem valores no erro", () => {
+  for (const env of [
+    { META_ADS_ACCOUNT_ID: "https://evil.invalid" },
+    { META_ADS_ACCESS_TOKEN: "segredo invalido", META_ADS_ACCOUNT_ID: "123" },
+    { META_ADS_ACCESS_TOKEN: "sentinela", META_ADS_ACCESS_TOKEN_FILE: "C:/teste/secret" },
+  ]) {
+    assert.throws(
+      () => loadMarketingConfig(env),
+      (e: unknown) =>
+        e instanceof Error &&
+        !e.message.includes("sentinela") &&
+        !e.message.includes("segredo invalido") &&
+        !e.message.includes("evil.invalid"),
+    );
+  }
+});
diff --git a/packages/config/src/marketing.ts b/packages/config/src/marketing.ts
new file mode 100644
index 0000000..5a3d76b
--- /dev/null
+++ b/packages/config/src/marketing.ts
@@ -0,0 +1,39 @@
+﻿import { z } from "zod";
+import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
+import { absolutePathSchema } from "./primitives.js";
+import type { Secret } from "./secret.js";
+
+export interface MarketingConfig {
+  readonly meta: { readonly token: Secret; readonly contaId: string } | undefined;
+}
+export function loadMarketingConfig(
+  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
+): MarketingConfig {
+  const e = parseConfig(
+    z.object({
+      META_ADS_ACCESS_TOKEN: z.string().optional(),
+      META_ADS_ACCESS_TOKEN_FILE: absolutePathSchema.optional(),
+      META_ADS_ACCOUNT_ID: z
+        .string()
+        .regex(/^(act_)?\d{1,30}$/)
+        .optional(),
+    }),
+    env,
+  );
+  const token = loadOptionalSecret(
+    "META_ADS_ACCESS_TOKEN",
+    e.META_ADS_ACCESS_TOKEN,
+    e.META_ADS_ACCESS_TOKEN_FILE,
+  );
+  if (token !== undefined && !/^[A-Za-z0-9_.|-]+$/.test(token.reveal()))
+    throw new ConfigError([{ key: "META_ADS_ACCESS_TOKEN", message: "token invalido" }]);
+  return {
+    meta:
+      token === undefined || e.META_ADS_ACCOUNT_ID === undefined
+        ? undefined
+        : {
+            token,
+            contaId: e.META_ADS_ACCOUNT_ID.replace(/^act_/, ""),
+          },
+  };
+}

```

