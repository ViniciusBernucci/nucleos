# Patch corretivo — revisão independente B

Registro: [revisão](2026-11-03-frente-b-revisao-corretiva.md).
Fonte congelada: `c5da47f640eb2204cc8bab9d5566fff6ae73ddbd`.
HEAD documental recebido: `0604d25a776ec8493e0e1c41bee1e7c641e0cf05`.
Commit corretivo do coordenador: `ecb94e761f6a303bf6a9d518e019d11b911c80b0`.
Mensagem: `fix(financeiro): proteger vinculos conciliados e limites do webhook`.
Patch completo do código/testes com contexto zero; exclui `apps/web/next-env.d.ts`
preexistente, documentação e lessons para evitar recursão.

```diff
diff --git a/apps/api/src/financeiro/conciliacao.test.ts b/apps/api/src/financeiro/conciliacao.test.ts
new file mode 100644
index 0000000..5068c69
--- /dev/null
+++ b/apps/api/src/financeiro/conciliacao.test.ts
@@ -0,0 +1,36 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import type { PoolClient } from "pg";
+import { ConciliacaoFinanceira } from "./conciliacao.js";
+import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+
+test("conta paga e seu lancamento nao podem duplicar a mesma origem manual", async () => {
+  let insercoes = 0;
+  const c = {
+    query: async (sql: string) => {
+      if (sql.startsWith("INSERT")) insercoes++;
+      return {
+        rows: [
+          {
+            valor: "-1000",
+            conta_pagar_id: sql.includes("FROM financeiro.lancamentos") ? "1" : null,
+          },
+        ],
+        rowCount: 1,
+      };
+    },
+  } as unknown as PoolClient;
+  const repo = {
+    transacao: async (fn: (c: PoolClient) => Promise<unknown>) => fn(c),
+  } as unknown as RepositorioFinanceiroPg;
+  await assert.rejects(
+    new ConciliacaoFinanceira(repo).manual({
+      itens: [
+        { tipo: "conta_pagar", referenciaId: "1", valorCentavos: "-1000" },
+        { tipo: "lancamento", referenciaId: "2", valorCentavos: "-1000" },
+      ],
+    }),
+    /pagamento repetido/,
+  );
+  assert.equal(insercoes, 0);
+});
diff --git a/apps/api/src/financeiro/conciliacao.ts b/apps/api/src/financeiro/conciliacao.ts
index 5c95049..9c07591 100644
--- a/apps/api/src/financeiro/conciliacao.ts
+++ b/apps/api/src/financeiro/conciliacao.ts
@@ -133 +133,7 @@ export class ConciliacaoFinanceira {
-      for (const i of itens) await this.validarItem(c, i);
+      const identidades = new Set<string>();
+      for (const i of itens) {
+        const identidade = await this.validarItem(c, i);
+        if (identidades.has(identidade))
+          throw new BadRequestException("pagamento repetido na conciliacao");
+        identidades.add(identidade);
+      }
@@ -159 +165 @@ export class ConciliacaoFinanceira {
-  private async validarItem(c: PoolClient, i: Item): Promise<void> {
+  private async validarItem(c: PoolClient, i: Item): Promise<string> {
@@ -170 +176 @@ export class ConciliacaoFinanceira {
-        "SELECT (CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text valor FROM financeiro.lancamentos WHERE id=$1",
+        "SELECT (CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text valor,conta_pagar_id::text FROM financeiro.lancamentos WHERE id=$1",
@@ -172 +178,3 @@ export class ConciliacaoFinanceira {
-    const r = await c.query<{ valor: string }>(queries[i.tipo], [i.referenciaId]);
+    const r = await c.query<{ valor: string; conta_pagar_id?: string | null }>(queries[i.tipo], [
+      i.referenciaId,
+    ]);
@@ -174,0 +183,3 @@ export class ConciliacaoFinanceira {
+    return i.tipo === "lancamento" && r.rows[0].conta_pagar_id
+      ? "conta_pagar:" + r.rows[0].conta_pagar_id
+      : i.tipo + ":" + i.referenciaId;
@@ -202,0 +214 @@ export class ConciliacaoFinanceira {
+        const identidades = new Set<string>();
@@ -204 +216 @@ export class ConciliacaoFinanceira {
-          await this.validarItem(c, {
+          const identidade = await this.validarItem(c, {
@@ -208,0 +221,6 @@ export class ConciliacaoFinanceira {
+          if (identidades.has(identidade))
+            throw new ConflictException("pagamento repetido na conciliacao");
+          identidades.add(identidade);
+          const contaPagar = identidade.startsWith("conta_pagar:")
+            ? identidade.slice("conta_pagar:".length)
+            : null;
@@ -213,2 +231,9 @@ export class ConciliacaoFinanceira {
-            WHERE i.tipo=$1 AND i.referencia_id=$2 AND c.aceita AND NOT c.desfeita`,
-                [i.tipo, i.referencia_id],
+            WHERE c.aceita AND NOT c.desfeita AND (
+              (i.tipo=$1 AND i.referencia_id=$2) OR
+              ($3::text IS NOT NULL AND (
+                (i.tipo='conta_pagar' AND i.referencia_id=$3) OR
+                (i.tipo='lancamento' AND i.referencia_id IN
+                  (SELECT id::text FROM financeiro.lancamentos WHERE conta_pagar_id=$3::bigint))
+              ))
+            )`,
+                [i.tipo, i.referencia_id, contaPagar],
diff --git a/apps/api/src/financeiro/corpo-webhook.ts b/apps/api/src/financeiro/corpo-webhook.ts
new file mode 100644
index 0000000..981fc9a
--- /dev/null
+++ b/apps/api/src/financeiro/corpo-webhook.ts
@@ -0,0 +1,11 @@
+import { PayloadTooLargeException } from "@nestjs/common";
+import type { IncomingMessage, ServerResponse } from "node:http";
+
+export function verificarCorpoHotmart(
+  req: IncomingMessage,
+  _res: ServerResponse,
+  buf: Buffer,
+): void {
+  if (/^\/v1\/webhooks\/hotmart\/?$/i.test(req.url?.split("?")[0] ?? "") && buf.byteLength > 65536)
+    throw new PayloadTooLargeException("corpo excede 64 KB");
+}
diff --git a/apps/api/src/financeiro/financeiro.http.test.ts b/apps/api/src/financeiro/financeiro.http.test.ts
index c5fa3e6..80c9b6c 100644
--- a/apps/api/src/financeiro/financeiro.http.test.ts
+++ b/apps/api/src/financeiro/financeiro.http.test.ts
@@ -10,0 +11,49 @@ import { FinanceiroModule } from "./financeiro.module.js";
+import type { NestExpressApplication } from "@nestjs/platform-express";
+import { verificarCorpoHotmart } from "./corpo-webhook.js";
+
+test("limite bruto Hotmart cobre barra terminal e maiusculas aceitas pelo roteador", async () => {
+  const sqls: string[] = [];
+  const c = {
+    query: async (sql: string) => {
+      sqls.push(sql);
+      return { rows: [], rowCount: 0 };
+    },
+    release: () => {},
+  };
+  const pool = { connect: async () => c } as unknown as Pool;
+  const app = await NestFactory.create<NestExpressApplication>(
+    AppModule.comModulos([
+      FinanceiroModule.registrar(
+        new MotorFuncionarios(pool, new RegistroHandlers()),
+        new Secret("chave-ficticia"),
+        { webhookHottok: new Secret("hottok-ficticio"), anexos: undefined },
+        loadVendasConfig({}),
+      ),
+    ]),
+    { logger: false, bodyParser: false },
+  );
+  app.useBodyParser("json", { limit: "2mb", verify: verificarCorpoHotmart });
+  try {
+    await app.listen(0, "127.0.0.1");
+    const base = await app.getUrl();
+    const evento = JSON.stringify({
+      id: "evento-http",
+      event: "PURCHASE_APPROVED",
+      data: { purchase: { transaction: "T1" } },
+    });
+    for (const rota of ["/v1/webhooks/hotmart", "/v1/webhooks/hotmart/", "/V1/WEBHOOKS/HOTMART"]) {
+      const chamar = (body: string) =>
+        fetch(base + rota, {
+          method: "POST",
+          headers: { "content-type": "application/json", "x-hotmart-hottok": "hottok-ficticio" },
+          body,
+        });
+      assert.equal((await chamar(evento)).status, 200);
+      sqls.length = 0;
+      assert.equal((await chamar(" ".repeat(65536) + evento)).status, 413, rota);
+      assert.equal(sqls.length, 0);
+    }
+  } finally {
+    await app.close();
+  }
+});
@@ -31 +79,0 @@ test("rotas financeiras exigem chave e validam corpo sem consultar PostgreSQL",
-  await app.listen(0, "127.0.0.1");
@@ -32,0 +81 @@ test("rotas financeiras exigem chave e validam corpo sem consultar PostgreSQL",
+    await app.listen(0, "127.0.0.1");
diff --git a/apps/api/src/financeiro/financeiro.pg.test.ts b/apps/api/src/financeiro/financeiro.pg.test.ts
index a7b1488..ce3212c 100644
--- a/apps/api/src/financeiro/financeiro.pg.test.ts
+++ b/apps/api/src/financeiro/financeiro.pg.test.ts
@@ -11,0 +12,2 @@ import { ConciliacaoFinanceira } from "./conciliacao.js";
+import { encerrarFixturePg } from "./teste-pg-apoio.js";
+import { RepositorioFluxoCaixaPg } from "../fluxo-caixa/repositorio-pg.js";
@@ -14,0 +17,3 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+  let fecharPool: (() => Promise<void>) | undefined;
+  let removerBanco: (() => Promise<void>) | undefined;
+  let fecharAdmin: (() => Promise<void>) | undefined;
@@ -20,0 +26 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+    fecharAdmin = () => admin.end();
@@ -21,0 +28,3 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+    removerBanco = async () => {
+      await admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
+    };
@@ -23,0 +33 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+    fecharPool = () => pool.end();
@@ -29,3 +39 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
-    await pool.end();
-    await admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
-    await admin.end();
+    await encerrarFixturePg(fecharPool, removerBanco, fecharAdmin);
@@ -113,0 +122,16 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+    const perna = (
+      await pool.query<{ id: string }>(
+        "SELECT id FROM financeiro.lancamentos WHERE transferencia_id=$1 ORDER BY id LIMIT 1",
+        [t.id],
+      )
+    ).rows[0];
+    assert.ok(perna);
+    await assert.rejects(
+      new RepositorioFluxoCaixaPg(pool, alertas.motor).excluirLancamento(perna.id),
+      /vinculado/,
+    );
+    assert.equal(
+      (await pool.query("SELECT id FROM financeiro.lancamentos WHERE transferencia_id=$1", [t.id]))
+        .rowCount,
+      2,
+    );
@@ -207,0 +232,69 @@ describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+  test("exclusao legada preserva pagamento conciliado e so reabre apos desfazer", async () => {
+    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
+    const criada = (await repo.criarDespesa({
+      descricao: "Protegida",
+      categoria: "Serviços",
+      valorCentavos: "5000",
+      vencimento: "2026-11-03",
+    })) as { ids: string[] };
+    const cid = criada.ids[0];
+    assert.ok(cid);
+    await repo.pagar(cid, { data: "2026-11-03", contaFinanceiraId: "1" });
+    const lancamento = (
+      await pool.query<{ id: string }>(
+        "SELECT id FROM financeiro.lancamentos WHERE conta_pagar_id=$1",
+        [cid],
+      )
+    ).rows[0];
+    assert.ok(lancamento);
+    await repo.importarExtrato({
+      contaFinanceiraId: "1",
+      formato: "csv",
+      conteudo: "data;valor;fitid;memo\n2026-11-03;-50,00;REV-PAGO;Teste",
+    });
+    const e = (
+      await pool.query<{ id: string }>(
+        "SELECT id FROM financeiro.extrato_itens WHERE fitid='REV-PAGO'",
+      )
+    ).rows[0];
+    assert.ok(e);
+    const conciliacao = new ConciliacaoFinanceira(repo);
+    const manual = (await conciliacao.manual({
+      itens: [
+        { tipo: "conta_pagar", referenciaId: cid, valorCentavos: "-5000" },
+        { tipo: "extrato_item", referenciaId: e.id, valorCentavos: "-5000" },
+      ],
+    })) as { id: string };
+    await conciliacao.agir(manual.id, "aceitar");
+    const legado = new RepositorioFluxoCaixaPg(pool, alertas.motor);
+    await repo.importarExtrato({
+      contaFinanceiraId: "1",
+      formato: "csv",
+      conteudo: "data;valor;fitid;memo\n2026-11-03;-50,00;REV-PAGO-ALIAS;Teste",
+    });
+    const outro = (
+      await pool.query<{ id: string }>(
+        "SELECT id FROM financeiro.extrato_itens WHERE fitid='REV-PAGO-ALIAS'",
+      )
+    ).rows[0];
+    assert.ok(outro);
+    const alias = (await conciliacao.manual({
+      itens: [
+        { tipo: "lancamento", referenciaId: lancamento.id, valorCentavos: "-5000" },
+        { tipo: "extrato_item", referenciaId: outro.id, valorCentavos: "-5000" },
+      ],
+    })) as { id: string };
+    await assert.rejects(conciliacao.agir(alias.id, "aceitar"), /item ja conciliado/);
+    await assert.rejects(legado.excluirLancamento(lancamento.id), /vinculado/);
+    await conciliacao.agir(manual.id, "desfazer");
+    assert.equal(await legado.excluirLancamento(lancamento.id), true);
+    assert.equal(
+      (
+        await pool.query<{ status: string }>(
+          "SELECT status FROM financeiro.contas_pagar WHERE id=$1",
+          [cid],
+        )
+      ).rows[0]?.status,
+      "aberta",
+    );
+  });
diff --git a/apps/api/src/financeiro/repositorio-pg.ts b/apps/api/src/financeiro/repositorio-pg.ts
index 06a42e4..a50533b 100644
--- a/apps/api/src/financeiro/repositorio-pg.ts
+++ b/apps/api/src/financeiro/repositorio-pg.ts
@@ -3 +3 @@ import { BadRequestException, ConflictException, NotFoundException } from "@nest
-import type { Pool, PoolClient } from "pg";
+import type { Pool, PoolClient, QueryResult } from "pg";
@@ -32,0 +33,7 @@ export class RepositorioFinanceiroPg {
+  private async gravar(sql: string, p: unknown[]): Promise<QueryResult<Objeto>> {
+    return this.transacao(async (c) => {
+      const r = await c.query<Objeto>(sql, p);
+      if (r.rowCount) await this.mudou(c);
+      return r;
+    });
+  }
@@ -57 +64 @@ export class RepositorioFinanceiroPg {
-        await this.pool.query(
+        await this.gravar(
@@ -65,4 +72,3 @@ export class RepositorioFinanceiroPg {
-        await this.pool.query(
-          "INSERT INTO financeiro.centros_custo(nome) VALUES($1) RETURNING id",
-          [texto(p["nome"], 80)],
-        )
+        await this.gravar("INSERT INTO financeiro.centros_custo(nome) VALUES($1) RETURNING id", [
+          texto(p["nome"], 80),
+        ])
@@ -74 +80 @@ export class RepositorioFinanceiroPg {
-        await this.pool.query(
+        await this.gravar(
@@ -84 +90 @@ export class RepositorioFinanceiroPg {
-      await this.pool.query(
+      await this.gravar(
@@ -220 +226 @@ export class RepositorioFinanceiroPg {
-    const r = await this.pool.query(
+    const r = await this.gravar(
@@ -410 +416 @@ export class RepositorioFinanceiroPg {
-      await this.pool.query(
+      await this.gravar(
@@ -468 +474 @@ export class RepositorioFinanceiroPg {
-      await this.pool.query(
+      await this.gravar(
diff --git a/apps/api/src/financeiro/repositorio.test.ts b/apps/api/src/financeiro/repositorio.test.ts
index 03d8051..7109eca 100644
--- a/apps/api/src/financeiro/repositorio.test.ts
+++ b/apps/api/src/financeiro/repositorio.test.ts
@@ -6,0 +7,63 @@ import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+
+test("mutacoes financeiras publicam dados.alterados atomicamente e falha do evento impede commit", async () => {
+  const entradas: [string, Record<string, unknown>][] = [
+    ["cancelar", { id: "1" }],
+    ["saldo", { contaFinanceiraId: "1", data: "2026-11-03", valorCentavos: "100" }],
+    [
+      "receber",
+      {
+        contaFinanceiraId: "1",
+        previstoEm: "2026-11-03",
+        valorCentavos: "100",
+        descricao: "Teste",
+      },
+    ],
+    ["regras", { pagamento: "PIX", dias: "2" }],
+    ["fornecedores", { nome: "Ficticio" }],
+    ["centros", { nome: "Centro" }],
+    ["contas", { nome: "Caixa", tipo: "caixa" }],
+  ];
+  for (const [operacao, p] of entradas)
+    for (const falhar of [false, true]) {
+      const passos: string[] = [];
+      const c = {
+        query: async (sql: string) => {
+          passos.push(sql);
+          return { rows: [{ id: "1" }], rowCount: 1 };
+        },
+        release: () => {},
+      };
+      const pool = {
+        connect: async () => c,
+        query: () => {
+          throw new Error("escrita fora da transacao");
+        },
+      } as unknown as Pool;
+      const motor = {
+        publicar: async (tipo: string, _chave: string, _p: unknown, cliente: unknown) => {
+          assert.equal(tipo, "financeiro.dados.alterados");
+          assert.equal(cliente, c);
+          passos.push("EVENTO");
+          if (falhar) throw new Error("evento falhou");
+          return true;
+        },
+      } as unknown as MotorFuncionarios;
+      const repo = new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor));
+      const executar = () =>
+        operacao === "cancelar"
+          ? repo.cancelar("1")
+          : operacao === "saldo"
+            ? repo.saldoInformado(p)
+            : operacao === "receber"
+              ? repo.receberManual(p)
+              : repo.cadastro(operacao, p);
+      if (falhar) {
+        await assert.rejects(executar(), /evento falhou/);
+        assert.equal(passos.includes("COMMIT"), false);
+      } else {
+        await executar();
+        assert.equal(passos.filter((s) => s === "EVENTO").length, 1);
+      }
+      assert.equal(passos.at(-1), falhar ? "ROLLBACK" : "COMMIT");
+    }
+});
diff --git a/apps/api/src/financeiro/teste-pg-apoio.test.ts b/apps/api/src/financeiro/teste-pg-apoio.test.ts
new file mode 100644
index 0000000..9a8b489
--- /dev/null
+++ b/apps/api/src/financeiro/teste-pg-apoio.test.ts
@@ -0,0 +1,23 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { encerrarFixturePg } from "./teste-pg-apoio.js";
+
+test("cleanup tenta pool, banco e admin mesmo quando uma etapa falha", async () => {
+  for (const falha of [0, 1, 2]) {
+    const passos: number[] = [];
+    const limpar = (n: number) => async () => {
+      passos.push(n);
+      if (n === falha) throw new Error("falha simulada de cleanup");
+    };
+    await assert.rejects(encerrarFixturePg(limpar(0), limpar(1), limpar(2)), /falha simulada/);
+    assert.deepEqual(passos, [0, 1, 2]);
+  }
+});
+test("setup parcial finaliza somente recursos ja adquiridos", async () => {
+  const passos: string[] = [];
+  await encerrarFixturePg(undefined, undefined, undefined);
+  await encerrarFixturePg(undefined, undefined, async () => {
+    passos.push("admin");
+  });
+  assert.deepEqual(passos, ["admin"]);
+});
diff --git a/apps/api/src/financeiro/teste-pg-apoio.ts b/apps/api/src/financeiro/teste-pg-apoio.ts
new file mode 100644
index 0000000..53276ca
--- /dev/null
+++ b/apps/api/src/financeiro/teste-pg-apoio.ts
@@ -0,0 +1,16 @@
+/** Finaliza apenas os recursos adquiridos e tenta todos mesmo se um fechamento falhar. */
+export async function encerrarFixturePg(
+  fecharPool: (() => Promise<void>) | undefined,
+  removerBanco: (() => Promise<void>) | undefined,
+  fecharAdmin: (() => Promise<void>) | undefined,
+): Promise<void> {
+  try {
+    await fecharPool?.();
+  } finally {
+    try {
+      await removerBanco?.();
+    } finally {
+      await fecharAdmin?.();
+    }
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/eventos.test.ts b/apps/api/src/fluxo-caixa/eventos.test.ts
index ed59547..3bf1128 100644
--- a/apps/api/src/fluxo-caixa/eventos.test.ts
+++ b/apps/api/src/fluxo-caixa/eventos.test.ts
@@ -5,0 +6,29 @@ import { RepositorioFluxoCaixaPg } from "./repositorio-pg.js";
+
+test("exclusao legada recusa transferencia e conciliacao aceita antes de apagar", async () => {
+  for (const vinculo of [
+    { transferencia_id: "uuid", conciliado: false },
+    { transferencia_id: null, conciliado: true },
+  ]) {
+    const passos: string[] = [];
+    const c = {
+      query: async (sql: string) => {
+        passos.push(sql);
+        if (sql.startsWith("SELECT id,transferencia_id"))
+          return { rows: [{ id: "1", ...vinculo }], rowCount: 1 };
+        return { rows: [], rowCount: sql.startsWith("DELETE") ? 1 : 0 };
+      },
+      release: () => {},
+    };
+    const pool = { query: c.query, connect: async () => c } as unknown as Pool;
+    const motor = { publicar: async () => true } as unknown as MotorFuncionarios;
+    await assert.rejects(
+      new RepositorioFluxoCaixaPg(pool, motor).excluirLancamento("1"),
+      /vinculado/,
+    );
+    assert.equal(
+      passos.some((s) => s.startsWith("DELETE")),
+      false,
+    );
+    assert.equal(passos.at(-1), "ROLLBACK");
+  }
+});
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts
index 7dd35f0..ac67a22 100644
--- a/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts
@@ -20 +20,6 @@ import { RegraFluxoCaixa, ServicoFluxoCaixa } from "./fluxo-caixa.service.js";
-import { CategoriaDuplicada, ContaComLancamentos, PagamentoDuplicado } from "./repositorio.js";
+import {
+  CategoriaDuplicada,
+  ContaComLancamentos,
+  LancamentoVinculado,
+  PagamentoDuplicado,
+} from "./repositorio.js";
@@ -53,0 +59,4 @@ async function http<T>(fn: () => Promise<T>): Promise<T> {
+    if (e instanceof LancamentoVinculado)
+      throw new ConflictException(
+        "lancamento vinculado a transferencia ou conciliacao aceita; desfaca a conciliacao antes de excluir",
+      );
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts
index 4a51bc2..a9d3c92 100644
--- a/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts
@@ -20,0 +21 @@ import {
+  LancamentoVinculado,
@@ -195,0 +197,14 @@ describe("API de fluxo de caixa (HTTP)", () => {
+  test("exclusao de lancamento vinculado responde conflito sem expor detalhe interno", async () => {
+    const excluir = repo.excluirLancamento.bind(repo);
+    repo.excluirLancamento = async () => {
+      throw new LancamentoVinculado("detalhe-interno");
+    };
+    try {
+      const r = await enviar("/lancamentos/123", undefined, "DELETE");
+      assert.equal(r.status, 409);
+      assert.doesNotMatch(await r.text(), /detalhe-interno/);
+    } finally {
+      repo.excluirLancamento = excluir;
+    }
+  });
+
diff --git a/apps/api/src/fluxo-caixa/repositorio-pg.ts b/apps/api/src/fluxo-caixa/repositorio-pg.ts
index 1b7098f..b3abe1f 100644
--- a/apps/api/src/fluxo-caixa/repositorio-pg.ts
+++ b/apps/api/src/fluxo-caixa/repositorio-pg.ts
@@ -14,0 +15 @@ import {
+  LancamentoVinculado,
@@ -170,4 +171,31 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const r = await this.consultar("DELETE FROM financeiro.lancamentos WHERE id = $1::bigint", [
-      id,
-    ]);
-    return (r.rowCount ?? 0) > 0;
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      // Mesma exclusao global de aceitar/desfazer: a checagem e a exclusao sao atomicas.
+      await c.query("SELECT pg_advisory_xact_lock(7315090)");
+      const r = await c.query<{ id: string; transferencia_id: string | null; conciliado: boolean }>(
+        `SELECT id,transferencia_id,EXISTS(
+          SELECT 1 FROM financeiro.conciliacao_itens i
+          JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id
+          WHERE c.aceita AND NOT c.desfeita AND
+            ((i.tipo='lancamento' AND i.referencia_id=l.id::text) OR
+             (i.tipo='conta_pagar' AND i.referencia_id=l.conta_pagar_id::text))
+        ) conciliado FROM financeiro.lancamentos l WHERE l.id=$1::bigint FOR UPDATE`,
+        [id],
+      );
+      const linha = r.rows[0];
+      if (linha && (linha.transferencia_id !== null || linha.conciliado))
+        throw new LancamentoVinculado("lancamento vinculado");
+      const removida = linha
+        ? await c.query("DELETE FROM financeiro.lancamentos WHERE id=$1::bigint", [id])
+        : null;
+      if (removida?.rowCount && this.motor)
+        await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
+      await c.query("COMMIT");
+      return (removida?.rowCount ?? 0) > 0;
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    } finally {
+      c.release();
+    }
diff --git a/apps/api/src/fluxo-caixa/repositorio.ts b/apps/api/src/fluxo-caixa/repositorio.ts
index da38774..4b4c36a 100644
--- a/apps/api/src/fluxo-caixa/repositorio.ts
+++ b/apps/api/src/fluxo-caixa/repositorio.ts
@@ -18,0 +19,3 @@ export class ContaComLancamentos extends Error {}
+/** Excluir isoladamente quebraria uma transferencia ou conciliacao aceita. */
+export class LancamentoVinculado extends Error {}
+
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 9513529..67f9068 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -9 +8,0 @@ import { NestFactory } from "@nestjs/core";
-import { PayloadTooLargeException } from "@nestjs/common";
@@ -12 +10,0 @@ import { Pool } from "pg";
-import type { IncomingMessage, ServerResponse } from "node:http";
@@ -22,0 +21 @@ import { FinanceiroModule } from "./financeiro/financeiro.module.js";
+import { verificarCorpoHotmart } from "./financeiro/corpo-webhook.js";
@@ -88,4 +87 @@ app.useBodyParser("json", {
-  verify: (req: IncomingMessage, _res: ServerResponse, buf: Buffer) => {
-    if (req.url?.split("?")[0] === "/v1/webhooks/hotmart" && buf.byteLength > 65536)
-      throw new PayloadTooLargeException("corpo excede 64 KB");
-  },
+  verify: verificarCorpoHotmart,
```
