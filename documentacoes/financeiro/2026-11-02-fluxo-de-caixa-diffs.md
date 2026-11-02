# Diffs — Fluxo de caixa (2026-11-02)

Documento principal: [2026-11-02-fluxo-de-caixa.md](2026-11-02-fluxo-de-caixa.md).

Nenhum commit criado nesta tarefa. Patch da árvore de trabalho (unstaged + arquivos novos) sobre o
HEAD `c5427047db13c8bb84e3a635298e94e89105caea`, somente código, testes, migration e CSS desta
entrega. Arquivos de `documentacoes/` e `lessons/` não entram no patch. Nenhum segredo presente.

```diff
diff --git a/apps/api/src/integracao-pg.test.ts b/apps/api/src/integracao-pg.test.ts
index 74e2e68..7ca08e7 100644
--- a/apps/api/src/integracao-pg.test.ts
+++ b/apps/api/src/integracao-pg.test.ts
@@ -2,6 +2,12 @@ import assert from "node:assert/strict";
 import { randomBytes } from "node:crypto";
 import { after, before, describe, test } from "node:test";
 import { Pool } from "pg";
+import {
+  CategoriaDuplicada,
+  ContaComLancamentos,
+  PagamentoDuplicado,
+} from "./fluxo-caixa/repositorio.js";
+import { RepositorioFluxoCaixaPg } from "./fluxo-caixa/repositorio-pg.js";
 import { lerMigracoes, migrar } from "./migrar.js";
 import type { Venda } from "./vendas/dominio.js";
 import { RepositorioVendasPg } from "./vendas/repositorio-pg.js";
@@ -216,5 +222,70 @@ describe(
         valor: 1,
       });
     });
+
+    test("fluxo de caixa: saldo, meses, pagamento unico por competencia e FK restrita", async () => {
+      const repo = new RepositorioFluxoCaixaPg(pool);
+      const base = { descricao: "Aporte", categoria: "Socios", valorCentavos: 100_000 };
+      await repo.inserirLancamento({ ...base, tipo: "entrada", data: "2026-10-31" });
+      await repo.inserirLancamento({
+        ...base,
+        tipo: "saida",
+        valorCentavos: 2_500,
+        data: "2026-11-01",
+      });
+      assert.equal(await repo.saldoAntesDe("2026-11-01"), 100_000);
+      assert.equal(await repo.saldoAntesDe("2026-11-02"), 97_500);
+
+      const conta = await repo.inserirConta({
+        descricao: "Aluguel",
+        categoria: "Imovel",
+        valorCentavos: 200_000,
+        diaVencimento: 31,
+        inicio: "2026-09",
+      });
+      assert.deepEqual({ inicio: conta.inicio, fim: conta.fim }, { inicio: "2026-09", fim: null });
+      const pagamento = {
+        ...base,
+        tipo: "saida" as const,
+        data: "2026-12-02",
+        contaRecorrenteId: conta.id,
+        competencia: "2026-11",
+      };
+      const pago = await repo.inserirLancamento(pagamento);
+      assert.equal(pago.competencia, "2026-11");
+      assert.equal(pago.data, "2026-12-02");
+      await assert.rejects(repo.inserirLancamento(pagamento), PagamentoDuplicado);
+      assert.equal((await repo.pagamentosDaCompetencia("2026-11")).length, 1);
+      assert.equal((await repo.lancamentosEntre("2026-11-01", "2026-11-30")).length, 1);
+      assert.equal(await repo.ultimaCompetenciaPaga(conta.id), "2026-11");
+
+      // O banco recusa entrada vinculada a conta e fim anterior ao inicio, mesmo sem a API.
+      await assert.rejects(
+        repo.inserirLancamento({ ...pagamento, tipo: "entrada", competencia: "2026-10" }),
+      );
+      await assert.rejects(repo.definirFimConta(conta.id, "2026-08"));
+
+      assert.ok(await repo.definirFimConta(conta.id, "2026-12"));
+      assert.equal((await repo.obterConta(conta.id))?.fim, "2026-12");
+      await assert.rejects(repo.excluirConta(conta.id), ContaComLancamentos);
+      assert.ok(await repo.excluirLancamento(pago.id));
+      assert.ok(await repo.excluirConta(conta.id));
+      assert.equal(await repo.obterConta(conta.id), null);
+    });
+
+    test("categorias: carga inicial, unicidade sem diferenciar maiusculas e exclusao", async () => {
+      const repo = new RepositorioFluxoCaixaPg(pool);
+      const iniciais = await repo.listarCategorias();
+      assert.ok(iniciais.some((c) => c.tipo === "saida" && c.nome === "Aluguel"));
+      assert.equal(await repo.nomeDaCategoria("saida", "ALUGUEL"), "Aluguel");
+      assert.equal(await repo.nomeDaCategoria("entrada", "Aluguel"), null);
+      await assert.rejects(
+        repo.inserirCategoria({ tipo: "saida", nome: "aluguel" }),
+        CategoriaDuplicada,
+      );
+      const nova = await repo.inserirCategoria({ tipo: "entrada", nome: "Aluguel recebido" });
+      assert.ok(await repo.excluirCategoria(nova.id));
+      assert.equal(await repo.excluirCategoria(nova.id), false);
+    });
   },
 );
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 098684b..71a5b26 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -5,6 +5,8 @@ import { Pool } from "pg";
 import { AppModule } from "./app.module.js";
 import { opcoesPool } from "./banco.js";
 import { createApiObservability, observabilityMiddleware } from "./observability.js";
+import { FluxoCaixaModule } from "./fluxo-caixa/fluxo-caixa.module.js";
+import { RepositorioFluxoCaixaPg } from "./fluxo-caixa/repositorio-pg.js";
 import { VendasModule } from "./vendas/vendas.module.js";
 
 // Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
@@ -34,11 +36,20 @@ const pool =
 pool?.on("error", () => {
   log("api: erro em conexao ociosa do banco");
 });
-if (pool === undefined) log("api: DATABASE_URL ausente; painel de vendas desativado");
+if (pool === undefined)
+  log("api: DATABASE_URL ausente; painel de vendas e fluxo de caixa desativados");
 
 const app = await NestFactory.create(
   AppModule.comModulos(
-    pool === undefined ? [] : [VendasModule.registrar({ config: vendasConfig, pool, log })],
+    pool === undefined
+      ? []
+      : [
+          VendasModule.registrar({ config: vendasConfig, pool, log }),
+          FluxoCaixaModule.registrar({
+            apiKey: vendasConfig.apiKey,
+            repositorio: new RepositorioFluxoCaixaPg(pool),
+          }),
+        ],
   ),
 );
 app.enableShutdownHooks();
diff --git a/apps/web/app/(app)/setores/financeiro/page.tsx b/apps/web/app/(app)/setores/financeiro/page.tsx
index a8a6843..3e2c015 100644
--- a/apps/web/app/(app)/setores/financeiro/page.tsx
+++ b/apps/web/app/(app)/setores/financeiro/page.tsx
@@ -28,6 +28,15 @@ export default function FinanceiroPage() {
               <span className="link-card__text">Receita, ticket médio e reembolsos da Hotmart</span>
             </Link>
           </li>
+          <li>
+            <Link href="/setores/financeiro/fluxo-de-caixa" className="link-card">
+              <span className="link-card__code" aria-hidden="true">
+                FC
+              </span>
+              <span className="link-card__title">Fluxo de caixa</span>
+              <span className="link-card__text">Entradas, saídas e contas a pagar recorrentes</span>
+            </Link>
+          </li>
         </ul>
       </section>
     </main>
diff --git a/apps/web/lib/vendas-api.ts b/apps/web/lib/vendas-api.ts
index 060316c..0f9bb99 100644
--- a/apps/web/lib/vendas-api.ts
+++ b/apps/web/lib/vendas-api.ts
@@ -15,7 +15,8 @@ export type ResultadoVendas<T> =
 const URL_PADRAO = "http://127.0.0.1:3001";
 const TIMEOUT_MS = 10_000;
 
-function configuracao(): { base: string; chave: string } | undefined {
+/** Base e chave de servico da API do Financeiro (vendas e fluxo de caixa usam a mesma chave). */
+export function configuracao(): { base: string; chave: string } | undefined {
   const arquivo = process.env["VENDAS_API_KEY_FILE"];
   const direta = process.env["VENDAS_API_KEY"];
   try {
diff --git a/packages/contracts/src/index.ts b/packages/contracts/src/index.ts
index d34dad2..18680b8 100644
--- a/packages/contracts/src/index.ts
+++ b/packages/contracts/src/index.ts
@@ -12,6 +12,7 @@ export function healthResponse(service: string): HealthResponse {
 
 export * from "./generated/index.js";
 export * from "./vendas.js";
+export * from "./fluxo-caixa.js";
 export { isRfc3339DateTime } from "./datetime.js";
 export {
   RUNTIME_TOKEN_MAX_TTL_S,
diff --git a/apps/api/migrations/0002_fluxo_caixa.up.sql b/apps/api/migrations/0002_fluxo_caixa.up.sql
new file mode 100644
index 0000000..13e3107
--- /dev/null
+++ b/apps/api/migrations/0002_fluxo_caixa.up.sql
@@ -0,0 +1,37 @@
+-- Fluxo de caixa (setor Financeiro): contas a pagar recorrentes e lancamentos de entrada/saida.
+-- Forward-only (ADR-017). Valores em centavos, sempre BRL. Meses guardados como o dia 1 do mes.
+
+CREATE TABLE financeiro.contas_recorrentes (
+  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+  descricao       text        NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
+  categoria       text        NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 60),
+  valor_centavos  bigint      NOT NULL CHECK (valor_centavos > 0),
+  dia_vencimento  smallint    NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
+  inicio          date        NOT NULL CHECK (extract(day FROM inicio) = 1),
+  fim             date        CHECK (fim IS NULL OR (extract(day FROM fim) = 1 AND fim >= inicio)),
+  criada_em       timestamptz NOT NULL DEFAULT now(),
+  atualizada_em   timestamptz NOT NULL DEFAULT now()
+);
+
+CREATE TABLE financeiro.lancamentos (
+  id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+  tipo                text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
+  descricao           text        NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
+  categoria           text        NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 60),
+  valor_centavos      bigint      NOT NULL CHECK (valor_centavos > 0),
+  data                date        NOT NULL,
+  conta_recorrente_id bigint      REFERENCES financeiro.contas_recorrentes (id) ON DELETE RESTRICT,
+  competencia         date,
+  criado_em           timestamptz NOT NULL DEFAULT now(),
+  -- Pagamento de conta recorrente: sempre saida e sempre com o mes de competencia.
+  CHECK ((conta_recorrente_id IS NULL) = (competencia IS NULL)),
+  CHECK (conta_recorrente_id IS NULL OR tipo = 'saida'),
+  CHECK (competencia IS NULL OR extract(day FROM competencia) = 1)
+);
+
+CREATE INDEX lancamentos_data_idx ON financeiro.lancamentos (data, id);
+
+-- Cada conta recorrente e paga no maximo uma vez por mes de competencia.
+CREATE UNIQUE INDEX lancamentos_conta_competencia_uq
+  ON financeiro.lancamentos (conta_recorrente_id, competencia)
+  WHERE conta_recorrente_id IS NOT NULL;
diff --git a/apps/api/migrations/0003_categorias_fluxo.up.sql b/apps/api/migrations/0003_categorias_fluxo.up.sql
new file mode 100644
index 0000000..d3f5a57
--- /dev/null
+++ b/apps/api/migrations/0003_categorias_fluxo.up.sql
@@ -0,0 +1,35 @@
+-- Categorias de entrada e saida do fluxo de caixa. Forward-only (ADR-017).
+-- Lancamentos e contas continuam guardando o nome da categoria (texto): excluir uma categoria nao
+-- altera o historico; a API so aceita categorias cadastradas em registros novos.
+
+CREATE TABLE financeiro.categorias (
+  id        bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+  tipo      text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
+  nome      text        NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
+  criada_em timestamptz NOT NULL DEFAULT now()
+);
+
+-- Um nome por tipo, sem diferenciar maiusculas ("Aluguel" = "aluguel").
+CREATE UNIQUE INDEX categorias_tipo_nome_uq ON financeiro.categorias (tipo, lower(nome));
+
+-- Categorias ja usadas antes desta migration continuam validas.
+INSERT INTO financeiro.categorias (tipo, nome)
+SELECT DISTINCT tipo, categoria FROM financeiro.lancamentos
+ON CONFLICT (tipo, lower(nome)) DO NOTHING;
+
+INSERT INTO financeiro.categorias (tipo, nome)
+SELECT DISTINCT 'saida', categoria FROM financeiro.contas_recorrentes
+ON CONFLICT (tipo, lower(nome)) DO NOTHING;
+
+-- Ponto de partida editavel (podem ser excluidas na tela).
+INSERT INTO financeiro.categorias (tipo, nome) VALUES
+  ('entrada', 'Vendas'),
+  ('entrada', 'Aporte de sócios'),
+  ('entrada', 'Outras entradas'),
+  ('saida', 'Aluguel'),
+  ('saida', 'Salários'),
+  ('saida', 'Impostos'),
+  ('saida', 'Fornecedores'),
+  ('saida', 'Serviços'),
+  ('saida', 'Outras saídas')
+ON CONFLICT (tipo, lower(nome)) DO NOTHING;
diff --git a/apps/api/src/fluxo-caixa/calendario.ts b/apps/api/src/fluxo-caixa/calendario.ts
new file mode 100644
index 0000000..44ec5bd
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/calendario.ts
@@ -0,0 +1,50 @@
+import { hojeNoFuso, lerDia } from "../vendas/periodo.js";
+
+const MES_RE = /^(\d{4})-(\d{2})$/;
+
+/** Anos aceitos em datas e meses do fluxo de caixa (barra digitacao errada como 0202 ou 20260). */
+export const ANO_MIN = 2000;
+export const ANO_MAX = 2100;
+
+/** `YYYY-MM` valido e dentro dos anos aceitos. */
+export function mesValido(texto: string): boolean {
+  const m = MES_RE.exec(texto);
+  if (m === null) return false;
+  const ano = Number(m[1]);
+  const mes = Number(m[2]);
+  return ano >= ANO_MIN && ano <= ANO_MAX && mes >= 1 && mes <= 12;
+}
+
+/** `YYYY-MM-DD` valido (calendario real) e dentro dos anos aceitos. */
+export function diaValido(texto: string): boolean {
+  if (lerDia(texto) === null) return false;
+  const ano = Number(texto.slice(0, 4));
+  return ano >= ANO_MIN && ano <= ANO_MAX;
+}
+
+export function mesAtual(agora: Date): string {
+  return hojeNoFuso(agora).slice(0, 7);
+}
+
+export function primeiroDia(mes: string): string {
+  return `${mes}-01`;
+}
+
+/** Quantidade de dias do mes (28 a 31). */
+export function diasNoMes(mes: string): number {
+  return new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
+}
+
+export function ultimoDia(mes: string): string {
+  return `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
+}
+
+/** Dia de vencimento no mes; 31 em abril vira 30, em fevereiro vira 28 ou 29. */
+export function vencimentoNoMes(mes: string, diaVencimento: number): string {
+  return `${mes}-${String(Math.min(diaVencimento, diasNoMes(mes))).padStart(2, "0")}`;
+}
+
+export function somarMeses(mes: string, n: number): string {
+  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
+  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
+}
diff --git a/apps/api/src/fluxo-caixa/dominio.test.ts b/apps/api/src/fluxo-caixa/dominio.test.ts
new file mode 100644
index 0000000..00d0125
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/dominio.test.ts
@@ -0,0 +1,245 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import type { Lancamento } from "@nucleos/contracts";
+import {
+  diaValido,
+  diasNoMes,
+  mesAtual,
+  mesValido,
+  somarMeses,
+  ultimoDia,
+  vencimentoNoMes,
+} from "./calendario.js";
+import { type ContaRecorrenteBanco, montarFluxo, venceNoMes } from "./dominio.js";
+import {
+  idValido,
+  validarEncerramento,
+  validarNovaConta,
+  validarNovoLancamento,
+  validarPagamento,
+} from "./validacao.js";
+
+const lanc = (id: string, p: Partial<Lancamento> = {}): Lancamento => ({
+  id,
+  tipo: "entrada",
+  descricao: "Venda balcao",
+  categoria: "Vendas",
+  valorCentavos: 10_000,
+  data: "2026-11-05",
+  contaRecorrenteId: null,
+  competencia: null,
+  criadoEm: "2026-11-05T12:00:00.000Z",
+  ...p,
+});
+
+const conta = (id: string, p: Partial<ContaRecorrenteBanco> = {}): ContaRecorrenteBanco => ({
+  id,
+  descricao: "Aluguel",
+  categoria: "Imovel",
+  valorCentavos: 200_000,
+  diaVencimento: 10,
+  inicio: "2026-01",
+  fim: null,
+  ...p,
+});
+
+describe("calendario", () => {
+  test("meses e dias validos dentro da faixa de anos", () => {
+    assert.ok(mesValido("2026-11"));
+    for (const m of ["2026-13", "2026-1", "1999-12", "2101-01", "2026-00", "abc"]) {
+      assert.equal(mesValido(m), false, m);
+    }
+    assert.ok(diaValido("2028-02-29"));
+    assert.equal(diaValido("2026-02-29"), false);
+    assert.equal(diaValido("0202-01-01"), false);
+  });
+
+  test("vencimento cai no ultimo dia em meses curtos", () => {
+    assert.equal(diasNoMes("2026-02"), 28);
+    assert.equal(diasNoMes("2028-02"), 29);
+    assert.equal(ultimoDia("2026-04"), "2026-04-30");
+    assert.equal(vencimentoNoMes("2026-04", 31), "2026-04-30");
+    assert.equal(vencimentoNoMes("2026-02", 30), "2026-02-28");
+    assert.equal(vencimentoNoMes("2026-11", 5), "2026-11-05");
+  });
+
+  test("somarMeses atravessa o ano nos dois sentidos", () => {
+    assert.equal(somarMeses("2026-12", 1), "2027-01");
+    assert.equal(somarMeses("2026-01", -1), "2025-12");
+    assert.equal(somarMeses("2026-06", -18), "2024-12");
+  });
+
+  test("mes atual usa o fuso de Sao Paulo", () => {
+    // 01/12 02:00 UTC ainda e 30/11 23:00 em Sao Paulo.
+    assert.equal(mesAtual(new Date("2026-12-01T02:00:00Z")), "2026-11");
+  });
+});
+
+describe("montarFluxo", () => {
+  test("saldo corrido, totais e projecao descontando contas pendentes", () => {
+    const pagamentoAluguel = lanc("3", {
+      tipo: "saida",
+      descricao: "Aluguel",
+      valorCentavos: 200_000,
+      data: "2026-11-09",
+      contaRecorrenteId: "1",
+      competencia: "2026-11",
+    });
+    const f = montarFluxo({
+      mes: "2026-11",
+      hoje: "2026-11-15",
+      saldoInicialCentavos: 50_000,
+      lancamentosDoMes: [
+        lanc("2", { tipo: "saida", valorCentavos: 3_000, data: "2026-11-05" }),
+        pagamentoAluguel,
+        lanc("1", { valorCentavos: 300_000, data: "2026-11-05" }),
+      ],
+      pagamentosDaCompetencia: [pagamentoAluguel],
+      contas: [
+        conta("1"),
+        conta("2", { descricao: "Internet", valorCentavos: 15_000, diaVencimento: 12 }),
+        conta("3", { descricao: "Contador", valorCentavos: 80_000, diaVencimento: 31 }),
+        conta("4", { descricao: "Antiga", fim: "2026-10" }),
+        conta("5", { descricao: "Futura", inicio: "2027-01" }),
+      ],
+      categorias: [
+        { id: "1", tipo: "saida", nome: "Impostos" },
+        { id: "2", tipo: "entrada", nome: "Vendas" },
+        { id: "3", tipo: "saida", nome: "Água" },
+      ],
+    });
+    // Entradas primeiro; dentro do tipo, ordem alfabetica pt-BR (acento nao vai para o fim).
+    assert.deepEqual(
+      f.categorias.map((c) => c.nome),
+      ["Vendas", "Água", "Impostos"],
+    );
+    assert.deepEqual(
+      f.movimentos.map((m) => [m.id, m.saldoAposCentavos]),
+      [
+        ["1", 350_000],
+        ["2", 347_000],
+        ["3", 147_000],
+      ],
+    );
+    assert.deepEqual(f.resumo, {
+      saldoInicialCentavos: 50_000,
+      entradasCentavos: 300_000,
+      saidasCentavos: 203_000,
+      saldoFinalCentavos: 147_000,
+      aPagarCentavos: 95_000,
+      saldoProjetadoCentavos: 52_000,
+    });
+    assert.deepEqual(
+      f.contasDoMes.map((c) => [c.descricao, c.vencimento, c.status]),
+      [
+        ["Aluguel", "2026-11-10", "paga"],
+        ["Internet", "2026-11-12", "atrasada"],
+        ["Contador", "2026-11-30", "pendente"],
+      ],
+    );
+    assert.equal(f.contasDoMes[0]?.pagamento?.lancamentoId, "3");
+    assert.deepEqual(
+      f.contas.map((c) => [c.descricao, c.vigente]),
+      [
+        ["Aluguel", true],
+        ["Contador", true],
+        ["Futura", true],
+        ["Internet", true],
+        ["Antiga", false],
+      ],
+    );
+  });
+
+  test("mes sem movimento mantem o saldo inicial", () => {
+    const f = montarFluxo({
+      mes: "2026-11",
+      hoje: "2026-11-01",
+      saldoInicialCentavos: -1_000,
+      lancamentosDoMes: [],
+      pagamentosDaCompetencia: [],
+      contas: [],
+      categorias: [],
+    });
+    assert.equal(f.resumo.saldoFinalCentavos, -1_000);
+    assert.equal(f.resumo.saldoProjetadoCentavos, -1_000);
+    assert.equal(f.moeda, "BRL");
+  });
+
+  test("vigencia da conta e inclusiva nas duas pontas", () => {
+    const c = conta("1", { inicio: "2026-03", fim: "2026-05" });
+    assert.deepEqual(
+      ["2026-02", "2026-03", "2026-05", "2026-06"].map((m) => venceNoMes(c, m)),
+      [false, true, true, false],
+    );
+  });
+});
+
+describe("validacao", () => {
+  const base = {
+    tipo: "saida",
+    descricao: "  Material  ",
+    categoria: "Escritorio",
+    valorCentavos: 1_990,
+    data: "2026-11-02",
+  };
+
+  test("lancamento valido e normalizado (trim)", () => {
+    const r = validarNovoLancamento(base);
+    assert.ok(r.ok);
+    assert.equal(r.valor.descricao, "Material");
+  });
+
+  test("lancamento rejeita tipos, valores e campos estranhos", () => {
+    const ruins: unknown[] = [
+      null,
+      [],
+      "texto",
+      { ...base, tipo: "transferencia" },
+      { ...base, valorCentavos: 0 },
+      { ...base, valorCentavos: 10.5 },
+      { ...base, valorCentavos: "1990" },
+      { ...base, valorCentavos: 100_000_000_001 },
+      { ...base, data: "02/11/2026" },
+      { ...base, data: "2026-02-30" },
+      { ...base, descricao: "   " },
+      { ...base, descricao: "a".repeat(121) },
+      { ...base, descricao: "linha\nquebrada" },
+      { ...base, extra: true },
+    ];
+    for (const c of ruins) assert.equal(validarNovoLancamento(c).ok, false, JSON.stringify(c));
+  });
+
+  test("conta recorrente: dia 1..31, meses AAAA-MM e fim nao anterior ao inicio", () => {
+    const conta = {
+      descricao: "Aluguel",
+      categoria: "Imovel",
+      valorCentavos: 200_000,
+      diaVencimento: 31,
+      inicio: "2026-11",
+    };
+    const ok = validarNovaConta(conta);
+    assert.ok(ok.ok);
+    assert.equal(ok.valor.fim, null);
+    assert.ok(validarNovaConta({ ...conta, fim: "2026-11" }).ok);
+    for (const c of [
+      { ...conta, diaVencimento: 0 },
+      { ...conta, diaVencimento: 32 },
+      { ...conta, inicio: "2026-11-01" },
+      { ...conta, fim: "2026-10" },
+    ]) {
+      assert.equal(validarNovaConta(c).ok, false, JSON.stringify(c));
+    }
+  });
+
+  test("pagamento, encerramento e ids", () => {
+    assert.ok(
+      validarPagamento({ competencia: "2026-11", data: "2026-11-10", valorCentavos: 1 }).ok,
+    );
+    assert.equal(validarPagamento({ competencia: "2026-11", data: "2026-11-10" }).ok, false);
+    assert.deepEqual(validarEncerramento(undefined), { ok: true, valor: { ultimoMes: undefined } });
+    assert.equal(validarEncerramento({ ultimoMes: "nov" }).ok, false);
+    assert.ok(idValido("42"));
+    for (const v of ["0", "-1", "01", "1e3", "abc", "1".repeat(19)])
+      assert.equal(idValido(v), false);
+  });
+});
diff --git a/apps/api/src/fluxo-caixa/dominio.ts b/apps/api/src/fluxo-caixa/dominio.ts
new file mode 100644
index 0000000..c5b16f9
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/dominio.ts
@@ -0,0 +1,113 @@
+import type {
+  Categoria,
+  ContaDoMes,
+  ContaRecorrente,
+  FluxoCaixaMes,
+  Lancamento,
+  MovimentoFluxo,
+} from "@nucleos/contracts";
+import { vencimentoNoMes } from "./calendario.js";
+
+/** Conta recorrente como guardada no banco (meses ja convertidos para `YYYY-MM`). */
+export type ContaRecorrenteBanco = Omit<ContaRecorrente, "vigente">;
+
+/** A conta vence no mes quando o mes esta entre `inicio` e `fim` (inclusive). */
+export function venceNoMes(conta: ContaRecorrenteBanco, mes: string): boolean {
+  return conta.inicio <= mes && (conta.fim === null || mes <= conta.fim);
+}
+
+export function contaVigente(conta: ContaRecorrenteBanco, mesCorrente: string): boolean {
+  return conta.fim === null || conta.fim >= mesCorrente;
+}
+
+const sinal = (l: Lancamento): number =>
+  l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos;
+
+const porDataEId = (a: Lancamento, b: Lancamento): number =>
+  a.data === b.data ? Number(a.id) - Number(b.id) : a.data < b.data ? -1 : 1;
+
+export interface DadosFluxo {
+  mes: string;
+  hoje: string;
+  saldoInicialCentavos: number;
+  /** Lancamentos com `data` dentro do mes. */
+  lancamentosDoMes: readonly Lancamento[];
+  /** Pagamentos de contas recorrentes cuja competencia e o mes (podem ter data em outro mes). */
+  pagamentosDaCompetencia: readonly Lancamento[];
+  contas: readonly ContaRecorrenteBanco[];
+  categorias: readonly Categoria[];
+}
+
+/** Monta a visao do mes sem tocar em banco: saldo corrido, contas do mes e projecao. */
+export function montarFluxo(d: DadosFluxo): FluxoCaixaMes {
+  let saldo = d.saldoInicialCentavos;
+  let entradas = 0;
+  let saidas = 0;
+  const movimentos: MovimentoFluxo[] = [...d.lancamentosDoMes].sort(porDataEId).map((l) => {
+    saldo += sinal(l);
+    if (l.tipo === "entrada") entradas += l.valorCentavos;
+    else saidas += l.valorCentavos;
+    return { ...l, saldoAposCentavos: saldo };
+  });
+
+  const pagamentos = new Map(d.pagamentosDaCompetencia.map((p) => [p.contaRecorrenteId, p]));
+  const contasDoMes: ContaDoMes[] = d.contas
+    .filter((c) => venceNoMes(c, d.mes))
+    .map((c) => {
+      const vencimento = vencimentoNoMes(d.mes, c.diaVencimento);
+      const p = pagamentos.get(c.id);
+      return {
+        contaId: c.id,
+        descricao: c.descricao,
+        categoria: c.categoria,
+        valorPrevistoCentavos: c.valorCentavos,
+        vencimento,
+        status: p !== undefined ? "paga" : vencimento < d.hoje ? "atrasada" : "pendente",
+        pagamento:
+          p === undefined
+            ? null
+            : { lancamentoId: p.id, data: p.data, valorCentavos: p.valorCentavos },
+      } satisfies ContaDoMes;
+    })
+    .sort((a, b) =>
+      a.vencimento === b.vencimento
+        ? a.descricao.localeCompare(b.descricao, "pt-BR")
+        : a.vencimento < b.vencimento
+          ? -1
+          : 1,
+    );
+
+  const aPagar = contasDoMes
+    .filter((c) => c.status !== "paga")
+    .reduce((t, c) => t + c.valorPrevistoCentavos, 0);
+  const mesCorrente = d.hoje.slice(0, 7);
+  const contas: ContaRecorrente[] = d.contas
+    .map((c) => ({ ...c, vigente: contaVigente(c, mesCorrente) }))
+    .sort((a, b) =>
+      a.vigente === b.vigente
+        ? a.descricao.localeCompare(b.descricao, "pt-BR")
+        : a.vigente
+          ? -1
+          : 1,
+    );
+
+  return {
+    mes: d.mes,
+    moeda: "BRL",
+    hoje: d.hoje,
+    resumo: {
+      saldoInicialCentavos: d.saldoInicialCentavos,
+      entradasCentavos: entradas,
+      saidasCentavos: saidas,
+      saldoFinalCentavos: saldo,
+      aPagarCentavos: aPagar,
+      saldoProjetadoCentavos: saldo - aPagar,
+    },
+    movimentos,
+    contasDoMes,
+    contas,
+    categorias: [...d.categorias].sort((a, b) =>
+      a.tipo === b.tipo ? a.nome.localeCompare(b.nome, "pt-BR") : a.tipo === "entrada" ? -1 : 1,
+    ),
+  };
+}
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts
new file mode 100644
index 0000000..7dd35f0
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts
@@ -0,0 +1,132 @@
+import {
+  BadRequestException,
+  Body,
+  ConflictException,
+  Controller,
+  Delete,
+  Get,
+  HttpCode,
+  Inject,
+  NotFoundException,
+  Param,
+  Post,
+  Query,
+  UseGuards,
+} from "@nestjs/common";
+import type { Categoria, ContaRecorrente, FluxoCaixaMes, Lancamento } from "@nucleos/contracts";
+import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { mesValido } from "./calendario.js";
+import { RegraFluxoCaixa, ServicoFluxoCaixa } from "./fluxo-caixa.service.js";
+import { CategoriaDuplicada, ContaComLancamentos, PagamentoDuplicado } from "./repositorio.js";
+import {
+  type Resultado,
+  idValido,
+  validarEncerramento,
+  validarNovaConta,
+  validarNovoLancamento,
+  validarNovaCategoria,
+  validarPagamento,
+} from "./validacao.js";
+
+function exigir<T>(r: Resultado<T>): T {
+  if (!r.ok) throw new BadRequestException(r.erro);
+  return r.valor;
+}
+
+function id(valor: string): string {
+  if (!idValido(valor)) throw new NotFoundException();
+  return valor;
+}
+
+/** Traduz falhas de regra para HTTP com mensagens fixas; o resto vira 500 sem detalhe. */
+async function http<T>(fn: () => Promise<T>): Promise<T> {
+  try {
+    return await fn();
+  } catch (e) {
+    if (e instanceof RegraFluxoCaixa) {
+      if (e.tipo === "nao-encontrado") throw new NotFoundException(e.message);
+      if (e.tipo === "conflito") throw new ConflictException(e.message);
+      throw new BadRequestException(e.message);
+    }
+    if (e instanceof PagamentoDuplicado) {
+      throw new ConflictException("a conta ja esta paga nessa competencia");
+    }
+    if (e instanceof ContaComLancamentos) {
+      throw new ConflictException(
+        "a conta tem pagamentos registrados; encerre-a em vez de excluir",
+      );
+    }
+    if (e instanceof CategoriaDuplicada) {
+      throw new ConflictException("ja existe categoria com esse nome para esse tipo");
+    }
+    throw e;
+  }
+}
+
+@Controller("v1/fluxo-caixa")
+@UseGuards(ChaveServicoGuard)
+export class FluxoCaixaController {
+  constructor(@Inject(ServicoFluxoCaixa) private readonly servico: ServicoFluxoCaixa) {}
+
+  @Get()
+  obterMes(@Query() q: Record<string, unknown>): Promise<FluxoCaixaMes> {
+    const mes = q["mes"];
+    if (mes === undefined || mes === "") return this.servico.mes(this.servico.mesCorrente());
+    if (typeof mes !== "string" || !mesValido(mes)) {
+      throw new BadRequestException("parametro invalido: mes");
+    }
+    return this.servico.mes(mes);
+  }
+
+  @Post("lancamentos")
+  criarLancamento(@Body() corpo: unknown): Promise<Lancamento> {
+    return http(() => this.servico.criarLancamento(exigir(validarNovoLancamento(corpo))));
+  }
+
+  @Delete("lancamentos/:id")
+  @HttpCode(204)
+  excluirLancamento(@Param("id") valor: string): Promise<void> {
+    return http(() => this.servico.excluirLancamento(id(valor)));
+  }
+
+  @Post("contas")
+  criarConta(@Body() corpo: unknown): Promise<ContaRecorrente> {
+    return http(() => this.servico.criarConta(exigir(validarNovaConta(corpo))));
+  }
+
+  @Post("contas/:id/pagamentos")
+  pagarConta(@Param("id") valor: string, @Body() corpo: unknown): Promise<Lancamento> {
+    return http(() => this.servico.pagarConta(id(valor), exigir(validarPagamento(corpo))));
+  }
+
+  @Post("contas/:id/encerrar")
+  @HttpCode(204)
+  encerrarConta(@Param("id") valor: string, @Body() corpo: unknown): Promise<void> {
+    const { ultimoMes } = exigir(validarEncerramento(corpo));
+    return http(() => this.servico.encerrarConta(id(valor), ultimoMes));
+  }
+
+  @Post("contas/:id/reativar")
+  @HttpCode(204)
+  reativarConta(@Param("id") valor: string): Promise<void> {
+    return http(() => this.servico.reativarConta(id(valor)));
+  }
+
+  @Delete("contas/:id")
+  @HttpCode(204)
+  excluirConta(@Param("id") valor: string): Promise<void> {
+    return http(() => this.servico.excluirConta(id(valor)));
+  }
+
+  @Post("categorias")
+  criarCategoria(@Body() corpo: unknown): Promise<Categoria> {
+    return http(() => this.servico.criarCategoria(exigir(validarNovaCategoria(corpo))));
+  }
+
+  /** Excluir nao altera lancamentos/contas antigos: eles guardam o nome da categoria. */
+  @Delete("categorias/:id")
+  @HttpCode(204)
+  excluirCategoria(@Param("id") valor: string): Promise<void> {
+    return http(() => this.servico.excluirCategoria(id(valor)));
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts
new file mode 100644
index 0000000..4a51bc2
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts
@@ -0,0 +1,334 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import { after, before, describe, test } from "node:test";
+import { type INestApplication } from "@nestjs/common";
+import { NestFactory } from "@nestjs/core";
+import { Secret } from "@nucleos/config";
+import type {
+  Categoria,
+  FluxoCaixaMes,
+  Lancamento,
+  NovaCategoria,
+  NovaContaRecorrente,
+  TipoLancamento,
+} from "@nucleos/contracts";
+import { AppModule } from "../app.module.js";
+import type { ContaRecorrenteBanco } from "./dominio.js";
+import { FluxoCaixaModule } from "./fluxo-caixa.module.js";
+import {
+  CategoriaDuplicada,
+  ContaComLancamentos,
+  type NovoLancamentoBanco,
+  PagamentoDuplicado,
+  type RepositorioFluxoCaixa,
+} from "./repositorio.js";
+
+const CHAVE = "chave-de-teste-sentinela";
+const AGORA = new Date("2026-11-15T15:00:00Z");
+
+/** Repositorio em memoria com as mesmas restricoes do banco (indice unico e FK RESTRICT). */
+class RepositorioMemoria implements RepositorioFluxoCaixa {
+  lancamentos: Lancamento[] = [];
+  contas: ContaRecorrenteBanco[] = [];
+  categorias: Categoria[] = [
+    { id: "c1", tipo: "entrada", nome: "Socios" },
+    { id: "c2", tipo: "saida", nome: "Escritorio" },
+    { id: "c3", tipo: "saida", nome: "Imovel" },
+    { id: "c4", tipo: "saida", nome: "Outros" },
+  ];
+  #seq = 0;
+
+  #id(): string {
+    this.#seq += 1;
+    return String(this.#seq);
+  }
+
+  async saldoAntesDe(dia: string): Promise<number> {
+    return this.lancamentos
+      .filter((l) => l.data < dia)
+      .reduce((t, l) => t + (l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos), 0);
+  }
+  async lancamentosEntre(de: string, ate: string): Promise<Lancamento[]> {
+    return this.lancamentos.filter((l) => l.data >= de && l.data <= ate);
+  }
+  async pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]> {
+    return this.lancamentos.filter((l) => l.competencia === competencia);
+  }
+  async listarContas(): Promise<ContaRecorrenteBanco[]> {
+    return [...this.contas];
+  }
+  async obterConta(id: string): Promise<ContaRecorrenteBanco | null> {
+    return this.contas.find((c) => c.id === id) ?? null;
+  }
+  async ultimaCompetenciaPaga(contaId: string): Promise<string | null> {
+    const meses = this.lancamentos
+      .filter((l) => l.contaRecorrenteId === contaId)
+      .map((l) => l.competencia ?? "")
+      .sort();
+    return meses.at(-1) ?? null;
+  }
+  async inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento> {
+    if (
+      novo.contaRecorrenteId !== undefined &&
+      this.lancamentos.some(
+        (l) => l.contaRecorrenteId === novo.contaRecorrenteId && l.competencia === novo.competencia,
+      )
+    ) {
+      throw new PagamentoDuplicado();
+    }
+    const l: Lancamento = {
+      id: this.#id(),
+      tipo: novo.tipo,
+      descricao: novo.descricao,
+      categoria: novo.categoria,
+      valorCentavos: novo.valorCentavos,
+      data: novo.data,
+      contaRecorrenteId: novo.contaRecorrenteId ?? null,
+      competencia: novo.competencia ?? null,
+      criadoEm: AGORA.toISOString(),
+    };
+    this.lancamentos.push(l);
+    return l;
+  }
+  async excluirLancamento(id: string): Promise<boolean> {
+    const antes = this.lancamentos.length;
+    this.lancamentos = this.lancamentos.filter((l) => l.id !== id);
+    return this.lancamentos.length < antes;
+  }
+  async inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco> {
+    const c = { ...nova, fim: nova.fim ?? null, id: this.#id() };
+    this.contas.push(c);
+    return c;
+  }
+  async definirFimConta(id: string, fim: string | null): Promise<boolean> {
+    const c = this.contas.find((x) => x.id === id);
+    if (c === undefined) return false;
+    c.fim = fim;
+    return true;
+  }
+  async excluirConta(id: string): Promise<boolean> {
+    if (this.lancamentos.some((l) => l.contaRecorrenteId === id)) throw new ContaComLancamentos();
+    const antes = this.contas.length;
+    this.contas = this.contas.filter((c) => c.id !== id);
+    return this.contas.length < antes;
+  }
+  async listarCategorias(): Promise<Categoria[]> {
+    return [...this.categorias];
+  }
+  async nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null> {
+    const igual = (c: Categoria): boolean =>
+      c.tipo === tipo && c.nome.toLowerCase() === nome.toLowerCase();
+    return this.categorias.find(igual)?.nome ?? null;
+  }
+  async inserirCategoria(nova: NovaCategoria): Promise<Categoria> {
+    if ((await this.nomeDaCategoria(nova.tipo, nova.nome)) !== null) throw new CategoriaDuplicada();
+    const c = { ...nova, id: this.#id() };
+    this.categorias.push(c);
+    return c;
+  }
+  async excluirCategoria(id: string): Promise<boolean> {
+    const antes = this.categorias.length;
+    this.categorias = this.categorias.filter((c) => c.id !== id);
+    return this.categorias.length < antes;
+  }
+}
+
+async function subir(
+  apiKey: Secret | undefined,
+  repo = new RepositorioMemoria(),
+): Promise<{ app: INestApplication; base: string }> {
+  const app = await NestFactory.create(
+    AppModule.comModulos([
+      FluxoCaixaModule.registrar({ apiKey, repositorio: repo, agora: () => AGORA }),
+    ]),
+    { logger: false },
+  );
+  await app.listen(0, "127.0.0.1");
+  const url = await app.getUrl();
+  return { app, base: url.replace("[::1]", "127.0.0.1") };
+}
+
+const auth = { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" };
+
+describe("API de fluxo de caixa (HTTP)", () => {
+  let app: INestApplication;
+  let base: string;
+  let repo: RepositorioMemoria;
+
+  before(async () => {
+    repo = new RepositorioMemoria();
+    ({ app, base } = await subir(new Secret(CHAVE), repo));
+  });
+  after(async () => app.close());
+
+  const enviar = (caminho: string, corpo?: unknown, method = "POST") =>
+    fetch(`${base}/v1/fluxo-caixa${caminho}`, {
+      method,
+      headers: auth,
+      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
+    });
+
+  const mes = async (q = ""): Promise<FluxoCaixaMes> => {
+    const r = await fetch(`${base}/v1/fluxo-caixa${q}`, { headers: auth });
+    assert.equal(r.status, 200);
+    return (await r.json()) as FluxoCaixaMes;
+  };
+
+  test("sem bearer ou com bearer errado => 401, sem vazar a chave", async () => {
+    for (const headers of [{}, { authorization: "Bearer errada" }]) {
+      const r = await fetch(`${base}/v1/fluxo-caixa`, { headers });
+      assert.equal(r.status, 401);
+      assert.doesNotMatch(await r.text(), new RegExp(CHAVE));
+    }
+    const post = await fetch(`${base}/v1/fluxo-caixa/lancamentos`, { method: "POST" });
+    assert.equal(post.status, 401);
+  });
+
+  test("mes padrao e o corrente em Sao Paulo; mes invalido => 400", async () => {
+    const f = await mes();
+    assert.equal(f.mes, "2026-11");
+    assert.equal(f.hoje, "2026-11-15");
+    for (const q of ["?mes=2026-13", "?mes=nov", "?mes=2026-11&mes=2026-10"]) {
+      assert.equal((await fetch(`${base}/v1/fluxo-caixa${q}`, { headers: auth })).status, 400, q);
+    }
+  });
+
+  test("lancamentos manuais entram no fluxo e podem ser excluidos", async () => {
+    const r = await enviar("/lancamentos", {
+      tipo: "entrada",
+      descricao: "Aporte",
+      categoria: "Socios",
+      valorCentavos: 500_000,
+      data: "2026-10-30",
+    });
+    assert.equal(r.status, 201);
+    const saida = (await (
+      await enviar("/lancamentos", {
+        tipo: "saida",
+        descricao: "Material",
+        categoria: "Escritorio",
+        valorCentavos: 12_000,
+        data: "2026-11-03",
+      })
+    ).json()) as Lancamento;
+    const f = await mes("?mes=2026-11");
+    assert.equal(f.resumo.saldoInicialCentavos, 500_000);
+    assert.equal(f.resumo.saidasCentavos, 12_000);
+    assert.equal(f.resumo.saldoFinalCentavos, 488_000);
+
+    assert.equal((await enviar(`/lancamentos/${saida.id}`, undefined, "DELETE")).status, 204);
+    assert.equal((await enviar(`/lancamentos/${saida.id}`, undefined, "DELETE")).status, 404);
+    assert.equal((await enviar("/lancamentos/abc", undefined, "DELETE")).status, 404);
+  });
+
+  test("corpo invalido => 400 sem eco do valor enviado", async () => {
+    const r = await enviar("/lancamentos", {
+      tipo: "saida",
+      descricao: "<script>drop</script>",
+      categoria: "x",
+      valorCentavos: -5,
+      data: "2026-11-03",
+    });
+    assert.equal(r.status, 400);
+    assert.doesNotMatch(await r.text(), /script|drop/);
+    assert.equal((await enviar("/contas", { descricao: "x" })).status, 400);
+  });
+
+  test("conta recorrente: paga uma vez por competencia, encerra e nao exclui com pagamento", async () => {
+    const criada = await enviar("/contas", {
+      descricao: "Aluguel",
+      categoria: "Imovel",
+      valorCentavos: 200_000,
+      diaVencimento: 10,
+      inicio: "2026-09",
+    });
+    assert.equal(criada.status, 201);
+    const { id } = (await criada.json()) as { id: string };
+
+    let f = await mes("?mes=2026-11");
+    assert.equal(f.contasDoMes[0]?.status, "atrasada");
+    assert.equal(f.resumo.aPagarCentavos, 200_000);
+
+    const pagamento = { competencia: "2026-11", data: "2026-11-15", valorCentavos: 210_000 };
+    assert.equal((await enviar(`/contas/${id}/pagamentos`, pagamento)).status, 201);
+    assert.equal((await enviar(`/contas/${id}/pagamentos`, pagamento)).status, 409);
+    const fora = { ...pagamento, competencia: "2026-08" };
+    assert.equal((await enviar(`/contas/${id}/pagamentos`, fora)).status, 400);
+    assert.equal((await enviar(`/contas/999/pagamentos`, pagamento)).status, 404);
+
+    f = await mes("?mes=2026-11");
+    assert.equal(f.contasDoMes[0]?.status, "paga");
+    assert.equal(f.contasDoMes[0].pagamento?.valorCentavos, 210_000);
+    assert.equal(f.resumo.aPagarCentavos, 0);
+
+    // Encerrar antes do ultimo mes pago e conflito; o padrao (mes corrente) funciona.
+    const cedo = await enviar(`/contas/${id}/encerrar`, { ultimoMes: "2026-10" });
+    assert.equal(cedo.status, 409);
+    assert.equal((await enviar(`/contas/${id}/encerrar`, {})).status, 204);
+    assert.equal(repo.contas[0]?.fim, "2026-11");
+    assert.equal((await mes("?mes=2026-12")).contasDoMes.length, 0);
+
+    assert.equal((await enviar(`/contas/${id}/reativar`)).status, 204);
+    assert.equal(repo.contas[0].fim, null);
+    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 409);
+  });
+
+  test("categorias: cadastro, duplicidade sem diferenciar maiusculas e tipo conferido", async () => {
+    const r = await enviar("/categorias", { tipo: "entrada", nome: " Vendas " });
+    assert.equal(r.status, 201);
+    const vendas = (await r.json()) as Categoria;
+    assert.equal(vendas.nome, "Vendas");
+    assert.equal((await enviar("/categorias", { tipo: "entrada", nome: "VENDAS" })).status, 409);
+    // Mesmo nome em outro tipo e permitido.
+    assert.equal((await enviar("/categorias", { tipo: "saida", nome: "Vendas" })).status, 201);
+    assert.equal((await enviar("/categorias", { tipo: "transf", nome: "x" })).status, 400);
+    assert.ok((await mes()).categorias.some((c) => c.id === vendas.id));
+
+    const lancamento = {
+      tipo: "saida",
+      descricao: "Compra",
+      valorCentavos: 100,
+      data: "2026-11-03",
+    };
+    // Categoria de entrada numa saida, ou inexistente: recusado.
+    assert.equal(
+      (await enviar("/lancamentos", { ...lancamento, categoria: "Socios" })).status,
+      400,
+    );
+    assert.equal((await enviar("/lancamentos", { ...lancamento, categoria: "Nada" })).status, 400);
+    // Grafia diferente vira a grafia do cadastro.
+    const ok = await enviar("/lancamentos", { ...lancamento, categoria: "escritorio" });
+    assert.equal(((await ok.json()) as Lancamento).categoria, "Escritorio");
+    // Conta recorrente so aceita categoria de saida.
+    const conta = { descricao: "X", valorCentavos: 1, diaVencimento: 1, inicio: "2026-11" };
+    assert.equal((await enviar("/contas", { ...conta, categoria: "Socios" })).status, 400);
+
+    assert.equal((await enviar(`/categorias/${vendas.id}`, undefined, "DELETE")).status, 204);
+    assert.equal((await enviar(`/categorias/${vendas.id}`, undefined, "DELETE")).status, 404);
+  });
+
+  test("conta sem pagamento pode ser excluida", async () => {
+    const r = await enviar("/contas", {
+      descricao: "Teste",
+      categoria: "Outros",
+      valorCentavos: 100,
+      diaVencimento: 1,
+      inicio: "2027-01",
+    });
+    const { id } = (await r.json()) as { id: string };
+    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 204);
+    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 404);
+  });
+});
+
+test("sem chave de servico configurada as rotas fecham com 503", async () => {
+  const { app, base } = await subir(undefined);
+  try {
+    const r = await fetch(`${base}/v1/fluxo-caixa`, {
+      headers: { authorization: `Bearer ${CHAVE}` },
+    });
+    assert.equal(r.status, 503);
+  } finally {
+    await app.close();
+  }
+});
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.module.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.module.ts
new file mode 100644
index 0000000..ada2c5c
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.module.ts
@@ -0,0 +1,28 @@
+import { type DynamicModule, Module } from "@nestjs/common";
+import type { Secret } from "@nucleos/config";
+import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { FluxoCaixaController } from "./fluxo-caixa.controller.js";
+import { ServicoFluxoCaixa } from "./fluxo-caixa.service.js";
+import type { RepositorioFluxoCaixa } from "./repositorio.js";
+
+export interface OpcoesModuloFluxoCaixa {
+  /** Mesma chave de servico do painel de vendas (provisoria ate o login real/IAM). */
+  apiKey: Secret | undefined;
+  repositorio: RepositorioFluxoCaixa;
+  agora?: () => Date;
+}
+
+@Module({})
+export class FluxoCaixaModule {
+  static registrar({ apiKey, repositorio, agora }: OpcoesModuloFluxoCaixa): DynamicModule {
+    return {
+      module: FluxoCaixaModule,
+      controllers: [FluxoCaixaController],
+      providers: [
+        ChaveServicoGuard,
+        { provide: CHAVE_SERVICO, useValue: apiKey },
+        { provide: ServicoFluxoCaixa, useValue: new ServicoFluxoCaixa(repositorio, agora) },
+      ],
+    };
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/fluxo-caixa.service.ts b/apps/api/src/fluxo-caixa/fluxo-caixa.service.ts
new file mode 100644
index 0000000..24a4401
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/fluxo-caixa.service.ts
@@ -0,0 +1,145 @@
+import type {
+  Categoria,
+  ContaRecorrente,
+  FluxoCaixaMes,
+  Lancamento,
+  NovaCategoria,
+  NovaContaRecorrente,
+  NovoLancamento,
+  NovoPagamentoConta,
+  TipoLancamento,
+} from "@nucleos/contracts";
+import { hojeNoFuso } from "../vendas/periodo.js";
+import { mesAtual, primeiroDia, ultimoDia } from "./calendario.js";
+import { contaVigente, montarFluxo, venceNoMes } from "./dominio.js";
+import type { RepositorioFluxoCaixa } from "./repositorio.js";
+
+/** Falha de regra de negocio com mensagem fixa (sem eco de dados enviados). */
+export class RegraFluxoCaixa extends Error {
+  constructor(
+    readonly tipo: "nao-encontrado" | "conflito" | "invalido",
+    mensagem: string,
+  ) {
+    super(mensagem);
+  }
+}
+
+export class ServicoFluxoCaixa {
+  constructor(
+    private readonly repo: RepositorioFluxoCaixa,
+    private readonly agora: () => Date = () => new Date(),
+  ) {}
+
+  mesCorrente(): string {
+    return mesAtual(this.agora());
+  }
+
+  async mes(mes: string): Promise<FluxoCaixaMes> {
+    const [saldoInicialCentavos, lancamentosDoMes, pagamentosDaCompetencia, contas, categorias] =
+      await Promise.all([
+        this.repo.saldoAntesDe(primeiroDia(mes)),
+        this.repo.lancamentosEntre(primeiroDia(mes), ultimoDia(mes)),
+        this.repo.pagamentosDaCompetencia(mes),
+        this.repo.listarContas(),
+        this.repo.listarCategorias(),
+      ]);
+    return montarFluxo({
+      mes,
+      hoje: hojeNoFuso(this.agora()),
+      saldoInicialCentavos,
+      lancamentosDoMes,
+      pagamentosDaCompetencia,
+      contas,
+      categorias,
+    });
+  }
+
+  /** Exige categoria cadastrada do tipo e devolve o nome com a grafia do cadastro. */
+  async #categoria(tipo: TipoLancamento, nome: string): Promise<string> {
+    const cadastrada = await this.repo.nomeDaCategoria(tipo, nome);
+    if (cadastrada === null) {
+      throw new RegraFluxoCaixa("invalido", "categoria nao cadastrada para esse tipo");
+    }
+    return cadastrada;
+  }
+
+  async criarLancamento(novo: NovoLancamento): Promise<Lancamento> {
+    const categoria = await this.#categoria(novo.tipo, novo.categoria);
+    return this.repo.inserirLancamento({ ...novo, categoria });
+  }
+
+  criarCategoria(nova: NovaCategoria): Promise<Categoria> {
+    return this.repo.inserirCategoria(nova);
+  }
+
+  async excluirCategoria(id: string): Promise<void> {
+    if (!(await this.repo.excluirCategoria(id))) {
+      throw new RegraFluxoCaixa("nao-encontrado", "categoria nao encontrada");
+    }
+  }
+
+  async excluirLancamento(id: string): Promise<void> {
+    if (!(await this.repo.excluirLancamento(id))) {
+      throw new RegraFluxoCaixa("nao-encontrado", "lancamento nao encontrado");
+    }
+  }
+
+  async criarConta(nova: NovaContaRecorrente): Promise<ContaRecorrente> {
+    // Conta a pagar e sempre saida: so aceita categorias de saida.
+    const categoria = await this.#categoria("saida", nova.categoria);
+    const conta = await this.repo.inserirConta({ ...nova, categoria });
+    return { ...conta, vigente: contaVigente(conta, this.mesCorrente()) };
+  }
+
+  async #conta(id: string) {
+    const conta = await this.repo.obterConta(id);
+    if (conta === null) throw new RegraFluxoCaixa("nao-encontrado", "conta nao encontrada");
+    return conta;
+  }
+
+  /** Registra o pagamento da competencia como uma saida vinculada a conta. */
+  async pagarConta(id: string, p: NovoPagamentoConta): Promise<Lancamento> {
+    const conta = await this.#conta(id);
+    if (!venceNoMes(conta, p.competencia)) {
+      throw new RegraFluxoCaixa("invalido", "a conta nao vence na competencia informada");
+    }
+    return this.repo.inserirLancamento({
+      tipo: "saida",
+      descricao: conta.descricao,
+      categoria: conta.categoria,
+      valorCentavos: p.valorCentavos,
+      data: p.data,
+      contaRecorrenteId: conta.id,
+      competencia: p.competencia,
+    });
+  }
+
+  /**
+   * Encerra a conta: `ultimoMes` (padrao: mes corrente, ou o inicio se for posterior) passa a ser
+   * o ultimo vencimento. Nao pode deixar de fora um mes ja pago.
+   */
+  async encerrarConta(id: string, ultimoMes: string | undefined): Promise<void> {
+    const conta = await this.#conta(id);
+    const corrente = this.mesCorrente();
+    const fim = ultimoMes ?? (corrente < conta.inicio ? conta.inicio : corrente);
+    if (fim < conta.inicio) {
+      throw new RegraFluxoCaixa("invalido", "o ultimo mes deve ser igual ou posterior ao inicio");
+    }
+    const pago = await this.repo.ultimaCompetenciaPaga(id);
+    if (pago !== null && fim < pago) {
+      throw new RegraFluxoCaixa("conflito", "ha pagamento registrado depois do ultimo mes");
+    }
+    await this.repo.definirFimConta(id, fim);
+  }
+
+  async reativarConta(id: string): Promise<void> {
+    await this.#conta(id);
+    await this.repo.definirFimConta(id, null);
+  }
+
+  async excluirConta(id: string): Promise<void> {
+    if (!(await this.repo.excluirConta(id))) {
+      throw new RegraFluxoCaixa("nao-encontrado", "conta nao encontrada");
+    }
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/repositorio-pg.ts b/apps/api/src/fluxo-caixa/repositorio-pg.ts
new file mode 100644
index 0000000..11a647f
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/repositorio-pg.ts
@@ -0,0 +1,226 @@
+import type {
+  Categoria,
+  Lancamento,
+  NovaCategoria,
+  NovaContaRecorrente,
+  TipoLancamento,
+} from "@nucleos/contracts";
+import type { Pool } from "pg";
+import type { ContaRecorrenteBanco } from "./dominio.js";
+import {
+  CategoriaDuplicada,
+  ContaComLancamentos,
+  type NovoLancamentoBanco,
+  PagamentoDuplicado,
+  type RepositorioFluxoCaixa,
+} from "./repositorio.js";
+
+const COLUNAS_LANCAMENTO = `id::text AS id, tipo, descricao, categoria, valor_centavos,
+  to_char(data, 'YYYY-MM-DD') AS data, conta_recorrente_id::text AS conta_recorrente_id,
+  to_char(competencia, 'YYYY-MM') AS competencia, criado_em`;
+
+const COLUNAS_CONTA = `id::text AS id, descricao, categoria, valor_centavos, dia_vencimento,
+  to_char(inicio, 'YYYY-MM') AS inicio, to_char(fim, 'YYYY-MM') AS fim`;
+
+const num = (v: unknown): number => Number(v ?? 0);
+
+/** Codigo SQLSTATE do erro do `pg`, se houver. */
+const codigo = (e: unknown): unknown =>
+  typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
+
+function lancamento(r: Record<string, unknown>): Lancamento {
+  return {
+    id: String(r["id"]),
+    tipo: r["tipo"] as TipoLancamento,
+    descricao: String(r["descricao"]),
+    categoria: String(r["categoria"]),
+    valorCentavos: num(r["valor_centavos"]),
+    data: String(r["data"]),
+    contaRecorrenteId: (r["conta_recorrente_id"] as string | null) ?? null,
+    competencia: (r["competencia"] as string | null) ?? null,
+    criadoEm: (r["criado_em"] as Date).toISOString(),
+  };
+}
+
+function conta(r: Record<string, unknown>): ContaRecorrenteBanco {
+  return {
+    id: String(r["id"]),
+    descricao: String(r["descricao"]),
+    categoria: String(r["categoria"]),
+    valorCentavos: num(r["valor_centavos"]),
+    diaVencimento: num(r["dia_vencimento"]),
+    inicio: String(r["inicio"]),
+    fim: (r["fim"] as string | null) ?? null,
+  };
+}
+
+/** `YYYY-MM` => primeiro dia do mes, como o banco guarda meses. */
+const mesParaData = (mes: string): string => `${mes}-01`;
+
+export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
+  constructor(private readonly pool: Pool) {}
+
+  async saldoAntesDe(dia: string): Promise<number> {
+    const { rows } = await this.pool.query(
+      `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE -valor_centavos END), 0)
+              AS saldo
+         FROM financeiro.lancamentos WHERE data < $1::date`,
+      [dia],
+    );
+    return num((rows[0] as Record<string, unknown> | undefined)?.["saldo"]);
+  }
+
+  async lancamentosEntre(de: string, ate: string): Promise<Lancamento[]> {
+    const { rows } = await this.pool.query(
+      `SELECT ${COLUNAS_LANCAMENTO} FROM financeiro.lancamentos
+        WHERE data BETWEEN $1::date AND $2::date ORDER BY data, id`,
+      [de, ate],
+    );
+    return (rows as Record<string, unknown>[]).map(lancamento);
+  }
+
+  async pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]> {
+    const { rows } = await this.pool.query(
+      `SELECT ${COLUNAS_LANCAMENTO} FROM financeiro.lancamentos
+        WHERE conta_recorrente_id IS NOT NULL AND competencia = $1::date`,
+      [mesParaData(competencia)],
+    );
+    return (rows as Record<string, unknown>[]).map(lancamento);
+  }
+
+  async listarContas(): Promise<ContaRecorrenteBanco[]> {
+    const { rows } = await this.pool.query(
+      `SELECT ${COLUNAS_CONTA} FROM financeiro.contas_recorrentes ORDER BY descricao, id`,
+    );
+    return (rows as Record<string, unknown>[]).map(conta);
+  }
+
+  async obterConta(id: string): Promise<ContaRecorrenteBanco | null> {
+    const { rows } = await this.pool.query(
+      `SELECT ${COLUNAS_CONTA} FROM financeiro.contas_recorrentes WHERE id = $1::bigint`,
+      [id],
+    );
+    const r = rows[0] as Record<string, unknown> | undefined;
+    return r === undefined ? null : conta(r);
+  }
+
+  async ultimaCompetenciaPaga(contaId: string): Promise<string | null> {
+    const { rows } = await this.pool.query(
+      `SELECT to_char(MAX(competencia), 'YYYY-MM') AS ultima
+         FROM financeiro.lancamentos WHERE conta_recorrente_id = $1::bigint`,
+      [contaId],
+    );
+    return ((rows[0] as Record<string, unknown> | undefined)?.["ultima"] as string | null) ?? null;
+  }
+
+  async inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento> {
+    try {
+      const { rows } = await this.pool.query(
+        `INSERT INTO financeiro.lancamentos
+           (tipo, descricao, categoria, valor_centavos, data, conta_recorrente_id, competencia)
+         VALUES ($1, $2, $3, $4, $5::date, $6::bigint, $7::date)
+         RETURNING ${COLUNAS_LANCAMENTO}`,
+        [
+          novo.tipo,
+          novo.descricao,
+          novo.categoria,
+          novo.valorCentavos,
+          novo.data,
+          novo.contaRecorrenteId ?? null,
+          novo.competencia === undefined ? null : mesParaData(novo.competencia),
+        ],
+      );
+      return lancamento(rows[0] as Record<string, unknown>);
+    } catch (e) {
+      // 23505 = unique_violation no indice (conta_recorrente_id, competencia).
+      if (codigo(e) === "23505") throw new PagamentoDuplicado();
+      throw e;
+    }
+  }
+
+  async excluirLancamento(id: string): Promise<boolean> {
+    const r = await this.pool.query("DELETE FROM financeiro.lancamentos WHERE id = $1::bigint", [
+      id,
+    ]);
+    return (r.rowCount ?? 0) > 0;
+  }
+
+  async inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco> {
+    const { rows } = await this.pool.query(
+      `INSERT INTO financeiro.contas_recorrentes
+         (descricao, categoria, valor_centavos, dia_vencimento, inicio, fim)
+       VALUES ($1, $2, $3, $4, $5::date, $6::date)
+       RETURNING ${COLUNAS_CONTA}`,
+      [
+        nova.descricao,
+        nova.categoria,
+        nova.valorCentavos,
+        nova.diaVencimento,
+        mesParaData(nova.inicio),
+        nova.fim === undefined || nova.fim === null ? null : mesParaData(nova.fim),
+      ],
+    );
+    return conta(rows[0] as Record<string, unknown>);
+  }
+
+  async definirFimConta(id: string, fim: string | null): Promise<boolean> {
+    const r = await this.pool.query(
+      `UPDATE financeiro.contas_recorrentes SET fim = $2::date, atualizada_em = now()
+        WHERE id = $1::bigint`,
+      [id, fim === null ? null : mesParaData(fim)],
+    );
+    return (r.rowCount ?? 0) > 0;
+  }
+
+  async excluirConta(id: string): Promise<boolean> {
+    try {
+      const r = await this.pool.query(
+        "DELETE FROM financeiro.contas_recorrentes WHERE id = $1::bigint",
+        [id],
+      );
+      return (r.rowCount ?? 0) > 0;
+    } catch (e) {
+      // ON DELETE RESTRICT falha com 23001 (restrict_violation); 23503 cobre NO ACTION.
+      const c = codigo(e);
+      if (c === "23001" || c === "23503") throw new ContaComLancamentos();
+      throw e;
+    }
+  }
+
+  async listarCategorias(): Promise<Categoria[]> {
+    const { rows } = await this.pool.query(
+      `SELECT id::text AS id, tipo, nome FROM financeiro.categorias ORDER BY tipo, lower(nome), id`,
+    );
+    return rows as Categoria[];
+  }
+
+  async nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null> {
+    const { rows } = await this.pool.query(
+      `SELECT nome FROM financeiro.categorias WHERE tipo = $1 AND lower(nome) = lower($2)`,
+      [tipo, nome],
+    );
+    return (rows[0] as { nome: string } | undefined)?.nome ?? null;
+  }
+
+  async inserirCategoria(nova: NovaCategoria): Promise<Categoria> {
+    try {
+      const { rows } = await this.pool.query(
+        `INSERT INTO financeiro.categorias (tipo, nome) VALUES ($1, $2)
+         RETURNING id::text AS id, tipo, nome`,
+        [nova.tipo, nova.nome],
+      );
+      return rows[0] as Categoria;
+    } catch (e) {
+      // 23505 = unique_violation no indice (tipo, lower(nome)).
+      if (codigo(e) === "23505") throw new CategoriaDuplicada();
+      throw e;
+    }
+  }
+
+  async excluirCategoria(id: string): Promise<boolean> {
+    const r = await this.pool.query("DELETE FROM financeiro.categorias WHERE id = $1::bigint", [
+      id,
+    ]);
+    return (r.rowCount ?? 0) > 0;
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/repositorio.ts b/apps/api/src/fluxo-caixa/repositorio.ts
new file mode 100644
index 0000000..da38774
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/repositorio.ts
@@ -0,0 +1,51 @@
+import type {
+  Categoria,
+  Lancamento,
+  NovaCategoria,
+  NovaContaRecorrente,
+  NovoLancamento,
+  TipoLancamento,
+} from "@nucleos/contracts";
+import type { ContaRecorrenteBanco } from "./dominio.js";
+
+export const REPOSITORIO_FLUXO_CAIXA = Symbol("REPOSITORIO_FLUXO_CAIXA");
+
+/** A conta ja tem pagamento para a competencia (indice unico parcial no banco). */
+export class PagamentoDuplicado extends Error {}
+
+/** A conta tem lancamentos vinculados e nao pode ser apagada (FK com ON DELETE RESTRICT). */
+export class ContaComLancamentos extends Error {}
+
+/** Ja existe categoria com esse nome (sem diferenciar maiusculas) para o tipo. */
+export class CategoriaDuplicada extends Error {}
+
+export interface NovoLancamentoBanco extends NovoLancamento {
+  contaRecorrenteId?: string;
+  competencia?: string;
+}
+
+export interface RepositorioFluxoCaixa {
+  /** Entradas menos saidas com `data` anterior ao dia informado (YYYY-MM-DD, exclusivo). */
+  saldoAntesDe(dia: string): Promise<number>;
+  /** Lancamentos com `data` entre os dias (inclusive). */
+  lancamentosEntre(de: string, ate: string): Promise<Lancamento[]>;
+  /** Pagamentos de contas recorrentes da competencia (YYYY-MM). */
+  pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]>;
+  listarContas(): Promise<ContaRecorrenteBanco[]>;
+  obterConta(id: string): Promise<ContaRecorrenteBanco | null>;
+  /** Maior competencia ja paga da conta (YYYY-MM), ou null. */
+  ultimaCompetenciaPaga(contaId: string): Promise<string | null>;
+  /** Lanca `PagamentoDuplicado` se a competencia da conta ja estiver paga. */
+  inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento>;
+  excluirLancamento(id: string): Promise<boolean>;
+  inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco>;
+  definirFimConta(id: string, fim: string | null): Promise<boolean>;
+  /** Lanca `ContaComLancamentos` se houver pagamento registrado. */
+  excluirConta(id: string): Promise<boolean>;
+  listarCategorias(): Promise<Categoria[]>;
+  /** Nome como cadastrado (grafia canonica) se a categoria existe para o tipo; senao null. */
+  nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null>;
+  /** Lanca `CategoriaDuplicada` se o nome ja existir para o tipo. */
+  inserirCategoria(nova: NovaCategoria): Promise<Categoria>;
+  excluirCategoria(id: string): Promise<boolean>;
+}
diff --git a/apps/api/src/fluxo-caixa/validacao.ts b/apps/api/src/fluxo-caixa/validacao.ts
new file mode 100644
index 0000000..b8210b0
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/validacao.ts
@@ -0,0 +1,144 @@
+import type {
+  NovaCategoria,
+  NovaContaRecorrente,
+  NovoLancamento,
+  NovoPagamentoConta,
+  TipoLancamento,
+} from "@nucleos/contracts";
+import { diaValido, mesValido } from "./calendario.js";
+
+/** Teto por valor (R$ 1 bilhao): bem abaixo de Number.MAX_SAFE_INTEGER mesmo somando milhares. */
+export const VALOR_MAX_CENTAVOS = 100_000_000_000;
+
+export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };
+
+type Corpo = Record<string, unknown>;
+
+// Caracteres de controle (inclui quebra de linha): textos sao de uma linha so.
+// eslint-disable-next-line no-control-regex
+const CONTROLE_RE = /[\u0000-\u001f\u007f]/;
+
+class Invalido extends Error {}
+
+function objeto(corpo: unknown, campos: readonly string[]): Corpo {
+  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
+    throw new Invalido("corpo deve ser um objeto JSON");
+  }
+  const extra = Object.keys(corpo).find((k) => !campos.includes(k));
+  if (extra !== undefined) throw new Invalido("campo desconhecido no corpo");
+  return corpo as Corpo;
+}
+
+function texto(c: Corpo, nome: string, max: number): string {
+  const v = c[nome];
+  if (typeof v !== "string") throw new Invalido(`${nome} obrigatorio`);
+  const t = v.trim();
+  if (t.length === 0 || t.length > max || CONTROLE_RE.test(t)) {
+    throw new Invalido(`${nome} deve ter de 1 a ${String(max)} caracteres`);
+  }
+  return t;
+}
+
+function inteiro(c: Corpo, nome: string, min: number, max: number): number {
+  const v = c[nome];
+  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
+    throw new Invalido(`${nome} invalido`);
+  }
+  return v;
+}
+
+function dia(c: Corpo, nome: string): string {
+  const v = c[nome];
+  if (typeof v !== "string" || !diaValido(v)) throw new Invalido(`${nome} deve ser AAAA-MM-DD`);
+  return v;
+}
+
+function mes(c: Corpo, nome: string): string {
+  const v = c[nome];
+  if (typeof v !== "string" || !mesValido(v)) throw new Invalido(`${nome} deve ser AAAA-MM`);
+  return v;
+}
+
+function validar<T>(fn: () => T): Resultado<T> {
+  try {
+    return { ok: true, valor: fn() };
+  } catch (e) {
+    if (e instanceof Invalido) return { ok: false, erro: e.message };
+    throw e;
+  }
+}
+
+export function validarNovoLancamento(corpo: unknown): Resultado<NovoLancamento> {
+  return validar(() => {
+    const c = objeto(corpo, ["tipo", "descricao", "categoria", "valorCentavos", "data"]);
+    const tipo = c["tipo"];
+    if (tipo !== "entrada" && tipo !== "saida")
+      throw new Invalido("tipo deve ser entrada ou saida");
+    return {
+      tipo: tipo satisfies TipoLancamento,
+      descricao: texto(c, "descricao", 120),
+      categoria: texto(c, "categoria", 60),
+      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
+      data: dia(c, "data"),
+    };
+  });
+}
+
+export function validarNovaCategoria(corpo: unknown): Resultado<NovaCategoria> {
+  return validar(() => {
+    const c = objeto(corpo, ["tipo", "nome"]);
+    const tipo = c["tipo"];
+    if (tipo !== "entrada" && tipo !== "saida")
+      throw new Invalido("tipo deve ser entrada ou saida");
+    return { tipo, nome: texto(c, "nome", 60) };
+  });
+}
+
+export function validarNovaConta(corpo: unknown): Resultado<NovaContaRecorrente> {
+  return validar(() => {
+    const c = objeto(corpo, [
+      "descricao",
+      "categoria",
+      "valorCentavos",
+      "diaVencimento",
+      "inicio",
+      "fim",
+    ]);
+    const inicio = mes(c, "inicio");
+    const fim = c["fim"] === undefined || c["fim"] === null ? null : mes(c, "fim");
+    if (fim !== null && fim < inicio)
+      throw new Invalido("fim deve ser igual ou posterior ao inicio");
+    return {
+      descricao: texto(c, "descricao", 120),
+      categoria: texto(c, "categoria", 60),
+      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
+      diaVencimento: inteiro(c, "diaVencimento", 1, 31),
+      inicio,
+      fim,
+    };
+  });
+}
+
+export function validarPagamento(corpo: unknown): Resultado<NovoPagamentoConta> {
+  return validar(() => {
+    const c = objeto(corpo, ["competencia", "data", "valorCentavos"]);
+    return {
+      competencia: mes(c, "competencia"),
+      data: dia(c, "data"),
+      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
+    };
+  });
+}
+
+/** Corpo opcional de encerramento: `{ ultimoMes?: "YYYY-MM" }`. */
+export function validarEncerramento(corpo: unknown): Resultado<{ ultimoMes: string | undefined }> {
+  return validar(() => {
+    const c = objeto(corpo ?? {}, ["ultimoMes"]);
+    return { ultimoMes: c["ultimoMes"] === undefined ? undefined : mes(c, "ultimoMes") };
+  });
+}
+
+/** Ids sao bigint positivos no banco; no caminho aceitamos so digitos (ate 18). */
+export function idValido(id: string): boolean {
+  return /^[1-9]\d{0,17}$/.test(id);
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Categorias.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Categorias.tsx
new file mode 100644
index 0000000..c1e5a17
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Categorias.tsx
@@ -0,0 +1,83 @@
+import type { Categoria, TipoLancamento } from "@nucleos/contracts";
+import { criarCategoria, excluirCategoria } from "../actions.ts";
+import styles from "../fluxo-de-caixa.module.css";
+import { FormularioAcao } from "./FormularioAcao.tsx";
+import { PainelLateral } from "./PainelLateral.tsx";
+
+const GRUPOS: { tipo: TipoLancamento; titulo: string }[] = [
+  { tipo: "entrada", titulo: "Categorias de entrada" },
+  { tipo: "saida", titulo: "Categorias de saída" },
+];
+
+/**
+ * Off-canvas de cadastro de categorias. Fica aberto apos cada operacao, para cadastrar varias
+ * seguidas; a lista se atualiza pela revalidacao da pagina.
+ */
+export function Categorias({ categorias }: { categorias: readonly Categoria[] }) {
+  return (
+    <PainelLateral
+      rotuloBotao="Categorias"
+      titulo="Categorias de entradas e saídas"
+      varianteBotao="secondary"
+      fecharAoConcluir={false}
+    >
+      <FormularioAcao
+        acao={criarCategoria}
+        rotulo="Adicionar categoria"
+        rotuloPendente="Adicionando…"
+        className={styles["formularioPainel"]}
+      >
+        <label className={styles["campo"]}>
+          Tipo
+          <select className="control-select" name="tipo" defaultValue="saida" required>
+            <option value="saida">Saída</option>
+            <option value="entrada">Entrada</option>
+          </select>
+        </label>
+        <label className={styles["campo"]}>
+          Nome
+          <input
+            className="control-input"
+            name="nome"
+            maxLength={60}
+            required
+            placeholder="Ex.: Marketing"
+          />
+        </label>
+      </FormularioAcao>
+
+      {GRUPOS.map((g) => {
+        const lista = categorias.filter((c) => c.tipo === g.tipo);
+        return (
+          <section key={g.tipo} aria-label={g.titulo}>
+            <h3>{g.titulo}</h3>
+            {lista.length === 0 ? (
+              <p className={styles["ajuda"]}>Nenhuma categoria cadastrada.</p>
+            ) : (
+              <ul className={styles["listaCategorias"]}>
+                {lista.map((c) => (
+                  <li key={c.id}>
+                    <span>{c.nome}</span>
+                    <FormularioAcao
+                      acao={excluirCategoria}
+                      rotulo="Excluir"
+                      rotuloPendente="Excluindo…"
+                      variante="secondary"
+                      className={styles["formulario"]}
+                    >
+                      <input type="hidden" name="id" value={c.id} />
+                    </FormularioAcao>
+                  </li>
+                ))}
+              </ul>
+            )}
+          </section>
+        );
+      })}
+      <p className={styles["ajuda"]}>
+        Excluir uma categoria não altera lançamentos e contas já registrados; ela só deixa de
+        aparecer nas opções.
+      </p>
+    </PainelLateral>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasDoMes.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasDoMes.tsx
new file mode 100644
index 0000000..8fb583f
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasDoMes.tsx
@@ -0,0 +1,137 @@
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import {
+  ROTULO_STATUS,
+  centavosParaCampo,
+  diaCurto,
+  formatarReais,
+} from "../../../../../../lib/fluxo-caixa-formato.ts";
+import { excluirLancamento, pagarConta } from "../actions.ts";
+import styles from "../fluxo-de-caixa.module.css";
+import { FormularioAcao } from "./FormularioAcao.tsx";
+
+const BADGE = {
+  paga: "badge badge--ok",
+  pendente: "badge badge--info",
+  atrasada: "badge badge--danger",
+} as const;
+
+/** Contas recorrentes que vencem no mes, com registro do pagamento (valor e data reais). */
+export function ContasDoMes({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  const mesCorrente = fluxo.hoje.startsWith(fluxo.mes);
+  return (
+    <section className="panel-card" aria-labelledby="contas-mes-titulo">
+      <div className="panel-header">
+        <h2 id="contas-mes-titulo">Contas a pagar do mês</h2>
+        <span className="kpi-card__detail">
+          {formatarReais(fluxo.resumo.aPagarCentavos)} em aberto
+        </span>
+      </div>
+      {fluxo.contasDoMes.length === 0 ? (
+        <div className="state-box" role="status">
+          Nenhuma conta recorrente vence neste mês. Cadastre as contas frequentes em “Contas
+          recorrentes”, mais abaixo.
+        </div>
+      ) : (
+        <div className={styles["rolagem"]}>
+          <table className={styles["tabela"]}>
+            <caption className="visually-hidden">Contas recorrentes que vencem no mês</caption>
+            <thead>
+              <tr>
+                <th scope="col">Vence</th>
+                <th scope="col">Conta</th>
+                <th scope="col" className={styles["numero"]}>
+                  Valor
+                </th>
+                <th scope="col">Situação</th>
+                <th scope="col">Ação</th>
+              </tr>
+            </thead>
+            <tbody>
+              {fluxo.contasDoMes.map((c) => (
+                <tr key={c.contaId}>
+                  <td>{diaCurto(c.vencimento)}</td>
+                  <td>
+                    {c.descricao}
+                    <br />
+                    <span className="kpi-card__detail">{c.categoria}</span>
+                  </td>
+                  <td className={styles["numero"]}>
+                    {formatarReais(c.pagamento?.valorCentavos ?? c.valorPrevistoCentavos)}
+                    {c.pagamento !== null &&
+                    c.pagamento.valorCentavos !== c.valorPrevistoCentavos ? (
+                      <>
+                        <br />
+                        <span className="kpi-card__detail">
+                          previsto {formatarReais(c.valorPrevistoCentavos)}
+                        </span>
+                      </>
+                    ) : null}
+                  </td>
+                  <td>
+                    <span className={BADGE[c.status]}>{ROTULO_STATUS[c.status]}</span>
+                    {c.pagamento !== null ? (
+                      <>
+                        <br />
+                        <span className="kpi-card__detail">em {diaCurto(c.pagamento.data)}</span>
+                      </>
+                    ) : null}
+                  </td>
+                  <td>
+                    {c.pagamento === null ? (
+                      <details className={styles["detalhes"]}>
+                        <summary>Registrar pagamento</summary>
+                        <FormularioAcao
+                          acao={pagarConta}
+                          rotulo="Confirmar pagamento"
+                          rotuloPendente="Registrando…"
+                          className={styles["formulario"]}
+                        >
+                          <input type="hidden" name="id" value={c.contaId} />
+                          <input type="hidden" name="competencia" value={fluxo.mes} />
+                          <label className={styles["campo"]}>
+                            Pago em
+                            <input
+                              className="control-input"
+                              type="date"
+                              name="data"
+                              required
+                              defaultValue={mesCorrente ? fluxo.hoje : c.vencimento}
+                            />
+                          </label>
+                          <label
+                            className={`${styles["campo"] ?? ""} ${styles["campoValor"] ?? ""}`}
+                          >
+                            Valor pago (R$)
+                            <input
+                              className="control-input"
+                              type="number"
+                              name="valor"
+                              min="0.01"
+                              step="0.01"
+                              required
+                              defaultValue={centavosParaCampo(c.valorPrevistoCentavos)}
+                            />
+                          </label>
+                        </FormularioAcao>
+                      </details>
+                    ) : (
+                      <FormularioAcao
+                        acao={excluirLancamento}
+                        rotulo="Desfazer pagamento"
+                        rotuloPendente="Desfazendo…"
+                        variante="secondary"
+                        className={styles["formulario"]}
+                      >
+                        <input type="hidden" name="id" value={c.pagamento.lancamentoId} />
+                      </FormularioAcao>
+                    )}
+                  </td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      )}
+    </section>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasRecorrentes.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasRecorrentes.tsx
new file mode 100644
index 0000000..a1802d4
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/ContasRecorrentes.tsx
@@ -0,0 +1,181 @@
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import { formatarReais, mesCurto } from "../../../../../../lib/fluxo-caixa-formato.ts";
+import { criarConta, encerrarConta, excluirConta, reativarConta } from "../actions.ts";
+import styles from "../fluxo-de-caixa.module.css";
+import { FormularioAcao } from "./FormularioAcao.tsx";
+import { PainelLateral } from "./PainelLateral.tsx";
+import { CampoCategoria } from "./SeletorCategoria.tsx";
+
+/** Cadastro das contas a pagar frequentes (mensais): aluguel, internet, contador etc. */
+export function ContasRecorrentes({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  const mesCorrente = fluxo.hoje.slice(0, 7);
+  return (
+    <section className="panel-card" aria-labelledby="recorrentes-titulo">
+      <div className="panel-header">
+        <h2 id="recorrentes-titulo">Contas recorrentes</h2>
+        <NovaConta fluxo={fluxo} />
+      </div>
+      <p className={styles["ajuda"]}>Vencem todo mês no dia informado.</p>
+
+      {fluxo.contas.length === 0 ? (
+        <div className="state-box" role="status">
+          Nenhuma conta recorrente cadastrada ainda.
+        </div>
+      ) : (
+        <div className={styles["rolagem"]}>
+          <table className={styles["tabela"]}>
+            <caption className="visually-hidden">Contas a pagar recorrentes cadastradas</caption>
+            <thead>
+              <tr>
+                <th scope="col">Conta</th>
+                <th scope="col" className={styles["numero"]}>
+                  Valor previsto
+                </th>
+                <th scope="col">Dia</th>
+                <th scope="col">Vigência</th>
+                <th scope="col">Ações</th>
+              </tr>
+            </thead>
+            <tbody>
+              {fluxo.contas.map((c) => (
+                <tr key={c.id}>
+                  <td>
+                    {c.descricao}
+                    <br />
+                    <span className="kpi-card__detail">{c.categoria}</span>
+                  </td>
+                  <td className={styles["numero"]}>{formatarReais(c.valorCentavos)}</td>
+                  <td>{c.diaVencimento}</td>
+                  <td>
+                    {mesCurto(c.inicio)} – {c.fim === null ? "sem prazo" : mesCurto(c.fim)}
+                    <br />
+                    <span className={c.vigente ? "badge badge--ok" : "badge badge--warn"}>
+                      {c.vigente ? "Vigente" : "Encerrada"}
+                    </span>
+                  </td>
+                  <td>
+                    <div className={styles["acoes"]}>
+                      {c.fim === null ? (
+                        <details className={styles["detalhes"]}>
+                          <summary>Encerrar</summary>
+                          <FormularioAcao
+                            acao={encerrarConta}
+                            rotulo="Confirmar encerramento"
+                            rotuloPendente="Encerrando…"
+                            variante="secondary"
+                            className={styles["formulario"]}
+                          >
+                            <input type="hidden" name="id" value={c.id} />
+                            <label className={styles["campo"]}>
+                              Último vencimento
+                              <input
+                                className="control-input"
+                                type="month"
+                                name="ultimoMes"
+                                required
+                                min={c.inicio}
+                                defaultValue={mesCorrente < c.inicio ? c.inicio : mesCorrente}
+                              />
+                            </label>
+                          </FormularioAcao>
+                        </details>
+                      ) : (
+                        <FormularioAcao
+                          acao={reativarConta}
+                          rotulo="Reativar"
+                          rotuloPendente="Reativando…"
+                          variante="secondary"
+                          className={styles["formulario"]}
+                        >
+                          <input type="hidden" name="id" value={c.id} />
+                        </FormularioAcao>
+                      )}
+                      <FormularioAcao
+                        acao={excluirConta}
+                        rotulo="Excluir"
+                        rotuloPendente="Excluindo…"
+                        variante="danger"
+                        className={styles["formulario"]}
+                      >
+                        <input type="hidden" name="id" value={c.id} />
+                      </FormularioAcao>
+                    </div>
+                  </td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      )}
+    </section>
+  );
+}
+
+/** Off-canvas a direita com o cadastro; fecha sozinho quando a conta e cadastrada. */
+function NovaConta({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  return (
+    <PainelLateral rotuloBotao="Nova conta recorrente" titulo="Nova conta recorrente">
+      <FormularioAcao
+        acao={criarConta}
+        rotulo="Cadastrar conta"
+        rotuloPendente="Cadastrando…"
+        className={styles["formularioPainel"]}
+      >
+        <label className={styles["campo"]}>
+          Descrição
+          <input
+            className="control-input"
+            name="descricao"
+            maxLength={120}
+            required
+            placeholder="Ex.: Aluguel da sala"
+          />
+        </label>
+        <CampoCategoria categorias={fluxo.categorias} tipo="saida" />
+        <label className={styles["campo"]}>
+          Valor previsto (R$)
+          <input
+            className="control-input"
+            type="number"
+            name="valor"
+            min="0.01"
+            step="0.01"
+            required
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Dia do vencimento
+          <input
+            className="control-input"
+            type="number"
+            name="diaVencimento"
+            min="1"
+            max="31"
+            step="1"
+            required
+            defaultValue="10"
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Primeiro mês
+          <input
+            className="control-input"
+            type="month"
+            name="inicio"
+            required
+            defaultValue={fluxo.mes}
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Último mês (opcional)
+          <input className="control-input" type="month" name="fim" />
+        </label>
+      </FormularioAcao>
+      <p className={styles["ajuda"]}>
+        Em meses mais curtos, vencimentos nos dias 29 a 31 caem no último dia do mês. O valor pago
+        pode ser diferente do previsto (por exemplo, contas de consumo). Só aparecem categorias de
+        saída; cadastre novas em “Categorias”, no painel Novo lançamento.
+      </p>
+    </PainelLateral>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/FormularioAcao.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/FormularioAcao.tsx
new file mode 100644
index 0000000..c251ee8
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/FormularioAcao.tsx
@@ -0,0 +1,52 @@
+"use client";
+
+import { type ReactNode, useActionState, useEffect, useRef } from "react";
+import {
+  ESTADO_INICIAL,
+  EVENTO_ACAO_CONCLUIDA,
+  type EstadoAcao,
+} from "../../../../../../lib/fluxo-caixa-formato.ts";
+
+/**
+ * Formulario ligado a uma Server Action: desabilita o botao durante o envio e mostra o retorno.
+ * No sucesso dispara `EVENTO_ACAO_CONCLUIDA` (borbulha), que o PainelLateral usa para fechar.
+ */
+export function FormularioAcao({
+  acao,
+  rotulo,
+  rotuloPendente,
+  variante = "primary",
+  className,
+  children,
+}: {
+  acao: (estado: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
+  rotulo: string;
+  rotuloPendente: string;
+  variante?: "primary" | "secondary" | "danger";
+  className?: string | undefined;
+  children?: ReactNode;
+}) {
+  const [estado, enviar, pendente] = useActionState(acao, ESTADO_INICIAL);
+  const formulario = useRef<HTMLFormElement>(null);
+
+  // Cada envio devolve um objeto novo, entao o efeito roda uma vez por resultado.
+  useEffect(() => {
+    if (estado !== ESTADO_INICIAL && !estado.erro) {
+      formulario.current?.dispatchEvent(new Event(EVENTO_ACAO_CONCLUIDA, { bubbles: true }));
+    }
+  }, [estado]);
+
+  return (
+    <form ref={formulario} action={enviar} aria-busy={pendente} className={className}>
+      {children}
+      <button className={`btn btn--${variante}`} type="submit" disabled={pendente}>
+        {pendente ? rotuloPendente : rotulo}
+      </button>
+      {estado.mensagem ? (
+        <p role={estado.erro ? "alert" : "status"} data-erro={estado.erro}>
+          {estado.mensagem}
+        </p>
+      ) : null}
+    </form>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Movimentacoes.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Movimentacoes.tsx
new file mode 100644
index 0000000..d4b3684
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Movimentacoes.tsx
@@ -0,0 +1,82 @@
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import { diaCurto, formatarReais, mesCurto } from "../../../../../../lib/fluxo-caixa-formato.ts";
+import { excluirLancamento } from "../actions.ts";
+import styles from "../fluxo-de-caixa.module.css";
+import { FormularioAcao } from "./FormularioAcao.tsx";
+
+/** Extrato do mes em ordem de data, com o saldo acumulado depois de cada lancamento. */
+export function Movimentacoes({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  return (
+    <section className="panel-card" aria-labelledby="movimentos-titulo">
+      <div className="panel-header">
+        <h2 id="movimentos-titulo">Movimentações do mês</h2>
+        <span className="kpi-card__detail">
+          Saldo inicial {formatarReais(fluxo.resumo.saldoInicialCentavos)}
+        </span>
+      </div>
+      {fluxo.movimentos.length === 0 ? (
+        <div className="state-box" role="status">
+          Nenhuma entrada ou saída registrada neste mês.
+        </div>
+      ) : (
+        <div className={styles["rolagem"]}>
+          <table className={styles["tabela"]}>
+            <caption className="visually-hidden">Entradas e saídas do mês com saldo</caption>
+            <thead>
+              <tr>
+                <th scope="col">Data</th>
+                <th scope="col">Descrição</th>
+                <th scope="col">Categoria</th>
+                <th scope="col">Origem</th>
+                <th scope="col" className={styles["numero"]}>
+                  Valor
+                </th>
+                <th scope="col" className={styles["numero"]}>
+                  Saldo
+                </th>
+                <th scope="col">
+                  <span className="visually-hidden">Ações</span>
+                </th>
+              </tr>
+            </thead>
+            <tbody>
+              {fluxo.movimentos.map((m) => (
+                <tr key={m.id}>
+                  <td>{diaCurto(m.data)}</td>
+                  <td>{m.descricao}</td>
+                  <td>{m.categoria}</td>
+                  <td>
+                    {m.competencia === null
+                      ? "Manual"
+                      : `Conta recorrente · ${mesCurto(m.competencia)}`}
+                  </td>
+                  <td
+                    className={`${styles["numero"] ?? ""} ${(m.tipo === "entrada" ? styles["entrada"] : styles["saida"]) ?? ""}`}
+                  >
+                    {m.tipo === "entrada" ? "+" : "−"} {formatarReais(m.valorCentavos)}
+                  </td>
+                  <td
+                    className={`${styles["numero"] ?? ""} ${m.saldoAposCentavos < 0 ? (styles["negativo"] ?? "") : ""}`}
+                  >
+                    {formatarReais(m.saldoAposCentavos)}
+                  </td>
+                  <td>
+                    <FormularioAcao
+                      acao={excluirLancamento}
+                      rotulo="Excluir"
+                      rotuloPendente="Excluindo…"
+                      variante="secondary"
+                      className={styles["formulario"]}
+                    >
+                      <input type="hidden" name="id" value={m.id} />
+                    </FormularioAcao>
+                  </td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      )}
+    </section>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/NovoLancamento.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/NovoLancamento.tsx
new file mode 100644
index 0000000..d56c3be
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/NovoLancamento.tsx
@@ -0,0 +1,52 @@
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import { diaSugerido } from "../../../../../../lib/fluxo-caixa-formato.ts";
+import { criarLancamento } from "../actions.ts";
+import styles from "../fluxo-de-caixa.module.css";
+import { Categorias } from "./Categorias.tsx";
+import { FormularioAcao } from "./FormularioAcao.tsx";
+import { SeletorTipoCategoria } from "./SeletorCategoria.tsx";
+
+/** Entrada ou saida avulsa (ex.: aporte, venda no balcao, compra de material). */
+export function NovoLancamento({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  return (
+    <section className="panel-card" aria-labelledby="novo-lancamento-titulo">
+      <div className="panel-header">
+        <h2 id="novo-lancamento-titulo">Novo lançamento</h2>
+        <Categorias categorias={fluxo.categorias} />
+      </div>
+      <FormularioAcao
+        acao={criarLancamento}
+        rotulo="Registrar"
+        rotuloPendente="Registrando…"
+        className={styles["formulario"]}
+      >
+        <SeletorTipoCategoria categorias={fluxo.categorias} />
+        <label className={`${styles["campo"] ?? ""} ${styles["campoLargo"] ?? ""}`}>
+          Descrição
+          <input className="control-input" name="descricao" maxLength={120} required />
+        </label>
+        <label className={`${styles["campo"] ?? ""} ${styles["campoValor"] ?? ""}`}>
+          Valor (R$)
+          <input
+            className="control-input"
+            type="number"
+            name="valor"
+            min="0.01"
+            step="0.01"
+            required
+          />
+        </label>
+        <label className={styles["campo"]}>
+          Data
+          <input
+            className="control-input"
+            type="date"
+            name="data"
+            required
+            defaultValue={diaSugerido(fluxo.mes, fluxo.hoje)}
+          />
+        </label>
+      </FormularioAcao>
+    </section>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/PainelLateral.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/PainelLateral.tsx
new file mode 100644
index 0000000..1d2a7fb
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/PainelLateral.tsx
@@ -0,0 +1,81 @@
+"use client";
+
+import { type ReactNode, useEffect, useId, useRef, useState } from "react";
+import { EVENTO_ACAO_CONCLUIDA } from "../../../../../../lib/fluxo-caixa-formato.ts";
+import styles from "../fluxo-de-caixa.module.css";
+
+/**
+ * Off-canvas a direita sobre `<dialog>` nativo: foco preso, Esc fecha e o resto da pagina fica inerte.
+ * Fecha sozinho quando um FormularioAcao interno conclui com sucesso; ao reabrir, o conteudo e
+ * remontado (formulario limpo, sem a mensagem anterior).
+ */
+export function PainelLateral({
+  rotuloBotao,
+  titulo,
+  fecharAoConcluir = true,
+  varianteBotao = "primary",
+  children,
+}: {
+  rotuloBotao: string;
+  titulo: string;
+  /** Falso para paineis de varias operacoes seguidas (ex.: cadastro de categorias). */
+  fecharAoConcluir?: boolean;
+  varianteBotao?: "primary" | "secondary";
+  children: ReactNode;
+}) {
+  const dialogo = useRef<HTMLDialogElement>(null);
+  const [abertura, setAbertura] = useState(0);
+  const idTitulo = useId();
+
+  useEffect(() => {
+    const d = dialogo.current;
+    if (d === null || !fecharAoConcluir) return;
+    const fechar = (): void => {
+      d.close();
+    };
+    d.addEventListener(EVENTO_ACAO_CONCLUIDA, fechar);
+    return () => {
+      d.removeEventListener(EVENTO_ACAO_CONCLUIDA, fechar);
+    };
+  }, [fecharAoConcluir]);
+
+  return (
+    <>
+      <button
+        type="button"
+        className={`btn btn--${varianteBotao}`}
+        aria-haspopup="dialog"
+        onClick={() => {
+          setAbertura((n) => n + 1);
+          dialogo.current?.showModal();
+        }}
+      >
+        {rotuloBotao}
+      </button>
+      <dialog
+        ref={dialogo}
+        className={styles["painelLateral"]}
+        aria-labelledby={idTitulo}
+        // Clique no fundo escurecido (fora do conteudo) fecha o painel.
+        onClick={(e) => {
+          if (e.target === e.currentTarget) e.currentTarget.close();
+        }}
+      >
+        <div className={styles["painelConteudo"]}>
+          <header className={styles["painelTopo"]}>
+            <h2 id={idTitulo}>{titulo}</h2>
+            <button
+              type="button"
+              className="btn btn--secondary"
+              aria-label="Fechar"
+              onClick={() => dialogo.current?.close()}
+            >
+              ✕
+            </button>
+          </header>
+          <div key={abertura}>{children}</div>
+        </div>
+      </dialog>
+    </>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Resumo.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Resumo.tsx
new file mode 100644
index 0000000..3903ee8
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/Resumo.tsx
@@ -0,0 +1,67 @@
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import { formatarReais } from "../../../../../../lib/fluxo-caixa-formato.ts";
+import styles from "../fluxo-de-caixa.module.css";
+
+interface Cartao {
+  rotulo: string;
+  valor: number;
+  detalhe: string;
+  /** Destaca o cartao quando o valor indica atencao (saldo negativo, contas em aberto). */
+  atencao?: boolean;
+}
+
+/** Saldos do mes: realizado (lancamentos) e projetado (descontando contas ainda nao pagas). */
+export function Resumo({ fluxo }: { fluxo: FluxoCaixaMes }) {
+  const r = fluxo.resumo;
+  const atrasadas = fluxo.contasDoMes.filter((c) => c.status === "atrasada").length;
+  const cartoes: Cartao[] = [
+    {
+      rotulo: "Saldo inicial",
+      valor: r.saldoInicialCentavos,
+      detalhe: "Acumulado até o mês anterior",
+    },
+    { rotulo: "Entradas", valor: r.entradasCentavos, detalhe: "Realizadas no mês" },
+    {
+      rotulo: "Saídas",
+      valor: r.saidasCentavos,
+      detalhe: "Realizadas no mês, inclui contas pagas",
+    },
+    {
+      rotulo: "Saldo do mês",
+      valor: r.saldoFinalCentavos,
+      detalhe: "Inicial + entradas − saídas",
+      atencao: r.saldoFinalCentavos < 0,
+    },
+    {
+      rotulo: "Contas a pagar",
+      valor: r.aPagarCentavos,
+      detalhe:
+        atrasadas > 0
+          ? `${String(atrasadas)} atrasada(s) neste mês`
+          : "Recorrentes do mês ainda não pagas",
+      atencao: atrasadas > 0,
+    },
+    {
+      rotulo: "Saldo projetado",
+      valor: r.saldoProjetadoCentavos,
+      detalhe: "Saldo do mês − contas a pagar",
+      atencao: r.saldoProjetadoCentavos < 0,
+    },
+  ];
+  return (
+    <section aria-labelledby="resumo-titulo">
+      <h2 id="resumo-titulo" className="visually-hidden">
+        Resumo do mês
+      </h2>
+      <ul className={`kpi-grid ${styles["semMarcador"] ?? ""}`}>
+        {cartoes.map((c) => (
+          <li key={c.rotulo} className={`kpi-card${c.atencao ? " kpi-card--attn" : ""}`}>
+            <span className="kpi-card__label">{c.rotulo}</span>
+            <span className="kpi-card__value">{formatarReais(c.valor)}</span>
+            <span className="kpi-card__detail">{c.detalhe}</span>
+          </li>
+        ))}
+      </ul>
+    </section>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/SeletorCategoria.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/SeletorCategoria.tsx
new file mode 100644
index 0000000..1bb248d
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/_components/SeletorCategoria.tsx
@@ -0,0 +1,69 @@
+"use client";
+
+import type { Categoria, TipoLancamento } from "@nucleos/contracts";
+import { useState } from "react";
+import styles from "../fluxo-de-caixa.module.css";
+
+function OpcoesCategoria({ categorias }: { categorias: readonly Categoria[] }) {
+  return (
+    <>
+      <option value="" disabled>
+        {categorias.length === 0 ? "Cadastre uma categoria" : "Escolha…"}
+      </option>
+      {categorias.map((c) => (
+        <option key={c.id} value={c.nome}>
+          {c.nome}
+        </option>
+      ))}
+    </>
+  );
+}
+
+/** Lista de categorias cadastradas de um tipo fixo (ex.: contas recorrentes = saida). */
+export function CampoCategoria({
+  categorias,
+  tipo,
+}: {
+  categorias: readonly Categoria[];
+  tipo: TipoLancamento;
+}) {
+  return (
+    <label className={styles["campo"]}>
+      Categoria
+      <select className="control-select" name="categoria" required defaultValue="">
+        <OpcoesCategoria categorias={categorias.filter((c) => c.tipo === tipo)} />
+      </select>
+    </label>
+  );
+}
+
+/** Tipo + categoria: ao trocar o tipo, a lista mostra so as categorias daquele tipo. */
+export function SeletorTipoCategoria({ categorias }: { categorias: readonly Categoria[] }) {
+  const [tipo, setTipo] = useState<TipoLancamento>("saida");
+  return (
+    <>
+      <label className={styles["campo"]}>
+        Tipo
+        <select
+          className="control-select"
+          name="tipo"
+          required
+          value={tipo}
+          onChange={(e) => {
+            setTipo(e.target.value === "entrada" ? "entrada" : "saida");
+          }}
+        >
+          <option value="saida">Saída</option>
+          <option value="entrada">Entrada</option>
+        </select>
+      </label>
+      <label className={styles["campo"]}>
+        Categoria
+        {/* key: ao trocar o tipo, a escolha anterior (de outro tipo) e descartada. */}
+        <select key={tipo} className="control-select" name="categoria" required defaultValue="">
+          <OpcoesCategoria categorias={categorias.filter((c) => c.tipo === tipo)} />
+        </select>
+      </label>
+    </>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/actions.ts b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/actions.ts
new file mode 100644
index 0000000..5b1e185
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/actions.ts
@@ -0,0 +1,49 @@
+"use server";
+
+import { revalidatePath } from "next/cache";
+import * as regras from "../../../../../lib/fluxo-caixa-acoes.ts";
+import type { EstadoAcao } from "../../../../../lib/fluxo-caixa-formato.ts";
+
+type Acao = (f: FormData) => Promise<EstadoAcao>;
+
+async function comRevalidacao(acao: Acao, f: FormData): Promise<EstadoAcao> {
+  const estado = await acao(f);
+  if (!estado.erro) revalidatePath("/setores/financeiro/fluxo-de-caixa");
+  return estado;
+}
+
+export async function criarLancamento(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.criarLancamento, f);
+}
+
+export async function excluirLancamento(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.excluirLancamento, f);
+}
+
+export async function criarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.criarConta, f);
+}
+
+export async function pagarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.pagarConta, f);
+}
+
+export async function encerrarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.encerrarConta, f);
+}
+
+export async function reativarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.reativarConta, f);
+}
+
+export async function excluirConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.excluirConta, f);
+}
+
+export async function criarCategoria(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.criarCategoria, f);
+}
+
+export async function excluirCategoria(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  return comRevalidacao(regras.excluirCategoria, f);
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/fluxo-de-caixa.module.css b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/fluxo-de-caixa.module.css
new file mode 100644
index 0000000..0a8c903
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/fluxo-de-caixa.module.css
@@ -0,0 +1,234 @@
+/* Estilos de uso unico do fluxo de caixa; so tokens do design system. */
+
+.semMarcador {
+  list-style: none;
+  margin: 0;
+  padding: 0;
+}
+
+.navMes {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  gap: 0.5rem;
+}
+
+.mesAtual {
+  font-weight: 600;
+  min-width: 10rem;
+  text-align: center;
+  text-transform: capitalize;
+}
+
+.colunas {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
+  gap: 1rem;
+  align-items: start;
+}
+
+.formulario {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: flex-end;
+  gap: 0.75rem;
+}
+
+.formulario p {
+  flex-basis: 100%;
+  margin: 0;
+  font-size: 0.8rem;
+}
+
+.formulario p[data-erro="true"] {
+  color: var(--status-danger-text);
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
+.campoLargo {
+  flex: 1 1 14rem;
+}
+
+.campoValor {
+  width: 8.5rem;
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
+.tabela th,
+.tabela td {
+  text-align: left;
+  padding: 0.45rem 0.6rem;
+  border-top: 1px solid var(--border-subtle);
+  vertical-align: top;
+}
+
+.tabela th {
+  color: var(--text-secondary);
+  font-weight: 600;
+  white-space: nowrap;
+}
+
+.numero {
+  text-align: right !important;
+  font-family: var(--font-mono);
+  white-space: nowrap;
+}
+
+.entrada {
+  color: var(--status-ok-text);
+}
+
+.saida {
+  color: var(--status-danger-text);
+}
+
+.negativo {
+  color: var(--status-danger-text);
+}
+
+.acoes {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.4rem;
+  align-items: flex-start;
+}
+
+.detalhes summary {
+  cursor: pointer;
+  min-height: 32px;
+  display: inline-flex;
+  align-items: center;
+  font-size: 0.78rem;
+  font-weight: 600;
+  color: var(--accent-primary);
+}
+
+.detalhes[open] {
+  padding-bottom: 0.4rem;
+}
+
+/* Off-canvas a direita (<dialog> nativo). */
+.painelLateral {
+  margin: 0 0 0 auto;
+  width: min(30rem, 100vw);
+  max-width: 100vw;
+  height: 100dvh;
+  max-height: 100dvh;
+  padding: 0;
+  border: none;
+  border-left: 1px solid var(--border-subtle);
+  background: var(--bg-surface);
+  color: var(--text-primary);
+  box-shadow: -8px 0 24px rgb(0 0 0 / 0.18);
+}
+
+.painelLateral[open] {
+  animation: entrarDaDireita 0.2s ease-out;
+}
+
+.painelLateral::backdrop {
+  background: rgb(0 0 0 / 0.45);
+}
+
+@keyframes entrarDaDireita {
+  from {
+    transform: translateX(100%);
+  }
+  to {
+    transform: translateX(0);
+  }
+}
+
+@media (prefers-reduced-motion: reduce) {
+  .painelLateral[open] {
+    animation: none;
+  }
+}
+
+.painelConteudo {
+  display: flex;
+  flex-direction: column;
+  gap: 1rem;
+  padding: calc(1rem + env(safe-area-inset-top, 0px)) 1.25rem
+    calc(1.25rem + env(safe-area-inset-bottom, 0px));
+}
+
+.painelTopo {
+  display: flex;
+  align-items: center;
+  justify-content: space-between;
+  gap: 0.75rem;
+}
+
+.painelTopo h2 {
+  margin: 0;
+  font-size: 1.1rem;
+}
+
+.painelTopo h3,
+.painelConteudo h3 {
+  margin: 0;
+  font-size: 0.9rem;
+}
+
+/* Formulario empilhado (um campo por linha) dentro do painel. */
+.formularioPainel {
+  display: flex;
+  flex-direction: column;
+  align-items: stretch;
+  gap: 0.75rem;
+}
+
+.formularioPainel p {
+  margin: 0;
+  font-size: 0.8rem;
+}
+
+.formularioPainel p[data-erro="true"] {
+  color: var(--status-danger-text);
+}
+
+.formularioPainel :global(.control-input),
+.formularioPainel :global(.control-select) {
+  width: 100%;
+}
+
+.listaCategorias {
+  list-style: none;
+  margin: 0;
+  padding: 0;
+  display: flex;
+  flex-direction: column;
+}
+
+.listaCategorias li {
+  display: flex;
+  align-items: center;
+  justify-content: space-between;
+  gap: 0.75rem;
+  padding: 0.35rem 0;
+  border-top: 1px solid var(--border-subtle);
+  font-size: 0.85rem;
+}
+
+.ajuda {
+  margin: 0;
+  font-size: 0.78rem;
+  color: var(--text-muted);
+}
diff --git a/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/page.tsx b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/page.tsx
new file mode 100644
index 0000000..465031a
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/page.tsx
@@ -0,0 +1,73 @@
+import Link from "next/link";
+import { MENSAGENS_FALHA_FLUXO, carregarFluxo } from "../../../../../lib/fluxo-caixa-api.ts";
+import { mesDaUrl, nomeDoMes, somarMeses } from "../../../../../lib/fluxo-caixa-formato.ts";
+import { ContasDoMes } from "./_components/ContasDoMes.tsx";
+import { ContasRecorrentes } from "./_components/ContasRecorrentes.tsx";
+import { Movimentacoes } from "./_components/Movimentacoes.tsx";
+import { NovoLancamento } from "./_components/NovoLancamento.tsx";
+import { Resumo } from "./_components/Resumo.tsx";
+import styles from "./fluxo-de-caixa.module.css";
+
+export const metadata = {
+  title: "Fluxo de caixa — NÚCLEOS",
+  description: "Entradas, saídas e contas a pagar recorrentes do setor financeiro.",
+};
+
+type Busca = Promise<Record<string, string | string[] | undefined>>;
+
+export default async function FluxoDeCaixaPage({ searchParams }: { searchParams: Busca }) {
+  const fluxo = await carregarFluxo(mesDaUrl(await searchParams));
+
+  return (
+    <main id="conteudo" className="page">
+      <nav aria-label="Trilha de navegação">
+        <Link href="/setores/financeiro">← Financeiro</Link>
+      </nav>
+      <header className="page-header">
+        <h1>Fluxo de caixa</h1>
+        {fluxo.tipo === "ok" ? (
+          <nav aria-label="Mês exibido" className={styles["navMes"]}>
+            <Link className="btn btn--secondary" href={`?mes=${somarMeses(fluxo.dados.mes, -1)}`}>
+              ← Mês anterior
+            </Link>
+            <span className={styles["mesAtual"]} aria-current="page">
+              {nomeDoMes(fluxo.dados.mes)}
+            </span>
+            <Link className="btn btn--secondary" href={`?mes=${somarMeses(fluxo.dados.mes, 1)}`}>
+              Próximo mês →
+            </Link>
+            {fluxo.dados.hoje.startsWith(fluxo.dados.mes) ? null : (
+              <Link className="btn btn--secondary" href="?">
+                Mês atual
+              </Link>
+            )}
+          </nav>
+        ) : null}
+      </header>
+
+      {fluxo.tipo === "nao-configurado" ? (
+        <div className="state-box" role="status">
+          <p>
+            O fluxo de caixa ainda não está conectado à API do financeiro. Defina{" "}
+            <code>VENDAS_API_KEY</code> (chave de serviço no .env) e, se a API não estiver em{" "}
+            <code>http://127.0.0.1:3001</code>, <code>VENDAS_API_URL</code> no servidor web.
+          </p>
+        </div>
+      ) : fluxo.tipo === "erro" ? (
+        <div className="state-box state-box--error" role="alert">
+          {MENSAGENS_FALHA_FLUXO[fluxo.falha]}
+        </div>
+      ) : (
+        <>
+          <Resumo fluxo={fluxo.dados} />
+          <div className={styles["colunas"]}>
+            <NovoLancamento fluxo={fluxo.dados} />
+            <ContasDoMes fluxo={fluxo.dados} />
+          </div>
+          <Movimentacoes fluxo={fluxo.dados} />
+          <ContasRecorrentes fluxo={fluxo.dados} />
+        </>
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/fluxo-caixa.test.ts b/apps/web/app/fluxo-caixa.test.ts
new file mode 100644
index 0000000..e3057e2
--- /dev/null
+++ b/apps/web/app/fluxo-caixa.test.ts
@@ -0,0 +1,215 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import * as acoes from "../lib/fluxo-caixa-acoes.ts";
+import { carregarFluxo } from "../lib/fluxo-caixa-api.ts";
+import {
+  categoriaDoFormulario,
+  contaDoFormulario,
+  diaSugerido,
+  formatarReais,
+  idDoFormulario,
+  lancamentoDoFormulario,
+  lerValorEmCentavos,
+  mesDaUrl,
+  nomeDoMes,
+  pagamentoDoFormulario,
+  somarMeses,
+} from "../lib/fluxo-caixa-formato.ts";
+
+const form = (campos: Record<string, string>): FormData => {
+  const f = new FormData();
+  for (const [k, v] of Object.entries(campos)) f.set(k, v);
+  return f;
+};
+
+describe("formato do fluxo de caixa", () => {
+  test("valor em reais vira centavos sem float", () => {
+    const casos: [string, number | null][] = [
+      ["1.234,56", 123_456],
+      ["1234,56", 123_456],
+      ["1234.56", 123_456],
+      ["0.1", 10],
+      ["10", 1_000],
+      ["R$ 2.500", 250_000],
+      ["1.000.000,00", 100_000_000],
+      ["0,07", 7],
+      ["0", null],
+      ["-5", null],
+      ["1,234", null],
+      ["12.34.56", null],
+      ["abc", null],
+      ["", null],
+      ["1000000001", null],
+    ];
+    for (const [entrada, esperado] of casos)
+      assert.equal(lerValorEmCentavos(entrada), esperado, entrada);
+  });
+
+  test("meses: URL, navegacao e nome por extenso", () => {
+    assert.equal(mesDaUrl({ mes: "2026-11" }), "2026-11");
+    assert.equal(mesDaUrl({ mes: "2026-13" }), undefined);
+    assert.equal(mesDaUrl({ mes: ["2026-11", "2026-10"] }), undefined);
+    assert.equal(somarMeses("2026-01", -1), "2025-12");
+    assert.equal(somarMeses("2026-12", 1), "2027-01");
+    assert.equal(nomeDoMes("2026-11"), "novembro de 2026");
+    assert.equal(diaSugerido("2026-11", "2026-11-15"), "2026-11-15");
+    assert.equal(diaSugerido("2026-12", "2026-11-15"), "2026-12-01");
+    assert.match(formatarReais(-123_456), /-R\$\s1\.234,56/);
+  });
+
+  test("formularios viram payloads tipados ou mensagem clara", () => {
+    const l = lancamentoDoFormulario(
+      form({
+        tipo: "entrada",
+        descricao: " Aporte ",
+        categoria: "Socios",
+        valor: "1500.00",
+        data: "2026-11-02",
+      }),
+    );
+    assert.deepEqual(l, {
+      ok: true,
+      valor: {
+        tipo: "entrada",
+        descricao: "Aporte",
+        categoria: "Socios",
+        valorCentavos: 150_000,
+        data: "2026-11-02",
+      },
+    });
+    assert.equal(lancamentoDoFormulario(form({ tipo: "x" })).ok, false);
+    const semValor = lancamentoDoFormulario(
+      form({ tipo: "saida", descricao: "a", categoria: "b", valor: "0", data: "2026-11-02" }),
+    );
+    assert.deepEqual(semValor, {
+      ok: false,
+      mensagem: "Informe um valor maior que zero, como 1.234,56.",
+    });
+
+    const conta = {
+      descricao: "Aluguel",
+      categoria: "Imovel",
+      valor: "2000",
+      diaVencimento: "31",
+      inicio: "2026-11",
+    };
+    const c = contaDoFormulario(form({ ...conta, fim: "" }));
+    assert.ok(c.ok && c.valor.fim === null && c.valor.diaVencimento === 31);
+    assert.equal(contaDoFormulario(form({ ...conta, fim: "2026-10" })).ok, false);
+    assert.equal(contaDoFormulario(form({ ...conta, diaVencimento: "32" })).ok, false);
+
+    assert.ok(
+      pagamentoDoFormulario(form({ competencia: "2026-11", data: "2026-11-10", valor: "99,90" }))
+        .ok,
+    );
+    assert.equal(idDoFormulario(form({ id: "12" })), "12");
+    assert.equal(idDoFormulario(form({ id: "../contas" })), null);
+  });
+});
+
+describe("acoes e API do fluxo de caixa", () => {
+  test("acao valida antes de chamar a API, usa bearer e devolve so mensagem fixa", async (t) => {
+    const original = { ...process.env };
+    process.env["VENDAS_API_KEY"] = "sentinela-web";
+    delete process.env["VENDAS_API_KEY_FILE"];
+    const chamadas: { url: string; init: RequestInit }[] = [];
+    let status = 201;
+    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
+      chamadas.push({ url, init });
+      return new Response(status === 204 ? null : JSON.stringify({ detalhe: "interno-secreto" }), {
+        status,
+      });
+    });
+    try {
+      const invalida = await acoes.criarLancamento(form({ tipo: "saida" }));
+      assert.equal(invalida.erro, true);
+      assert.equal(chamadas.length, 0);
+
+      const ok = await acoes.criarLancamento(
+        form({
+          tipo: "saida",
+          descricao: "Material",
+          categoria: "Escritorio",
+          valor: "19,90",
+          data: "2026-11-02",
+        }),
+      );
+      assert.deepEqual(ok, { erro: false, mensagem: "Saída registrada." });
+      const [primeira] = chamadas;
+      assert.equal(primeira?.url, "http://127.0.0.1:3001/v1/fluxo-caixa/lancamentos");
+      assert.equal(new Headers(primeira.init.headers).get("authorization"), "Bearer sentinela-web");
+      assert.deepEqual(JSON.parse(primeira.init.body as string), {
+        tipo: "saida",
+        descricao: "Material",
+        categoria: "Escritorio",
+        valorCentavos: 1_990,
+        data: "2026-11-02",
+      });
+
+      status = 409;
+      const dup = await acoes.pagarConta(
+        form({ id: "7", competencia: "2026-11", data: "2026-11-10", valor: "10" }),
+      );
+      assert.deepEqual(dup, { erro: true, mensagem: "Esta conta já está paga neste mês." });
+      assert.ok(!JSON.stringify(dup).includes("interno-secreto"));
+
+      status = 204;
+      assert.equal((await acoes.excluirLancamento(form({ id: "abc" }))).erro, true);
+      assert.equal(chamadas.length, 2); // id invalido nem chega a API
+      assert.deepEqual(await acoes.excluirLancamento(form({ id: "3" })), {
+        erro: false,
+        mensagem: "Lançamento excluído.",
+      });
+      assert.equal(chamadas.at(-1)?.init.method, "DELETE");
+    } finally {
+      process.env = original;
+    }
+  });
+
+  test("categorias: formulario validado e duplicada com mensagem propria", async (t) => {
+    assert.deepEqual(categoriaDoFormulario(form({ tipo: "entrada", nome: " Vendas " })), {
+      ok: true,
+      valor: { tipo: "entrada", nome: "Vendas" },
+    });
+    assert.equal(categoriaDoFormulario(form({ tipo: "x", nome: "a" })).ok, false);
+    assert.equal(categoriaDoFormulario(form({ tipo: "saida", nome: "" })).ok, false);
+
+    const original = { ...process.env };
+    process.env["VENDAS_API_KEY"] = "sentinela-web";
+    delete process.env["VENDAS_API_KEY_FILE"];
+    const urls: string[] = [];
+    t.mock.method(globalThis, "fetch", async (url: string) => {
+      urls.push(url);
+      return new Response("{}", { status: 409 });
+    });
+    try {
+      assert.deepEqual(await acoes.criarCategoria(form({ tipo: "saida", nome: "Aluguel" })), {
+        erro: true,
+        mensagem: "Já existe uma categoria com esse nome para esse tipo.",
+      });
+      assert.equal((await acoes.excluirCategoria(form({ id: "x" }))).erro, true);
+      assert.deepEqual(urls, ["http://127.0.0.1:3001/v1/fluxo-caixa/categorias"]);
+    } finally {
+      process.env = original;
+    }
+  });
+
+  test("carregarFluxo: 404 vira modulo desligado e sem chave nao chama a API", async (t) => {
+    const original = { ...process.env };
+    delete process.env["VENDAS_API_KEY"];
+    delete process.env["VENDAS_API_KEY_FILE"];
+    let chamadas = 0;
+    t.mock.method(globalThis, "fetch", async () => {
+      chamadas++;
+      return new Response("{}", { status: 404 });
+    });
+    try {
+      assert.deepEqual(await carregarFluxo(undefined), { tipo: "nao-configurado" });
+      process.env["VENDAS_API_KEY"] = "sentinela-web";
+      assert.deepEqual(await carregarFluxo("2026-11"), { tipo: "erro", falha: "modulo-desligado" });
+      assert.equal(chamadas, 1);
+    } finally {
+      process.env = original;
+    }
+  });
+});
diff --git a/apps/web/lib/fluxo-caixa-acoes.ts b/apps/web/lib/fluxo-caixa-acoes.ts
new file mode 100644
index 0000000..7991ce8
--- /dev/null
+++ b/apps/web/lib/fluxo-caixa-acoes.ts
@@ -0,0 +1,136 @@
+/**
+ * Regras das Server Actions do fluxo de caixa, fora do arquivo "use server" para testar no Node.
+ * Cada acao valida o formulario antes de chamar a API e devolve so mensagens fixas ao cliente.
+ */
+import { alterarFluxo, type FalhaFluxo, MENSAGENS_FALHA_FLUXO } from "./fluxo-caixa-api.ts";
+import {
+  contaDoFormulario,
+  type EstadoAcao,
+  idDoFormulario,
+  type Leitura,
+  lancamentoDoFormulario,
+  mesValido,
+  categoriaDoFormulario,
+  pagamentoDoFormulario,
+} from "./fluxo-caixa-formato.ts";
+
+const NAO_CONFIGURADO = "O fluxo de caixa ainda não está conectado à API do financeiro.";
+const SEM_ID = "Registro inválido. Recarregue a página e tente de novo.";
+
+async function executar(
+  caminho: string,
+  method: "POST" | "DELETE",
+  corpo: unknown,
+  sucesso: string,
+  conflito?: string,
+): Promise<EstadoAcao> {
+  const r = await alterarFluxo(caminho, method, corpo);
+  if (r.tipo === "nao-configurado") return { erro: true, mensagem: NAO_CONFIGURADO };
+  if (r.tipo === "erro") {
+    const falha: FalhaFluxo = r.falha;
+    return {
+      erro: true,
+      mensagem: falha === "conflito" && conflito ? conflito : MENSAGENS_FALHA_FLUXO[falha],
+    };
+  }
+  return { erro: false, mensagem: sucesso };
+}
+
+function comLeitura<T>(
+  leitura: Leitura<T>,
+  fn: (valor: T) => Promise<EstadoAcao>,
+): Promise<EstadoAcao> {
+  return leitura.ok
+    ? fn(leitura.valor)
+    : Promise.resolve({ erro: true, mensagem: leitura.mensagem });
+}
+
+export function criarLancamento(f: FormData): Promise<EstadoAcao> {
+  return comLeitura(lancamentoDoFormulario(f), (l) =>
+    executar(
+      "/lancamentos",
+      "POST",
+      l,
+      l.tipo === "entrada" ? "Entrada registrada." : "Saída registrada.",
+    ),
+  );
+}
+
+export function excluirLancamento(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  return executar(`/lancamentos/${id}`, "DELETE", undefined, "Lançamento excluído.");
+}
+
+export function criarConta(f: FormData): Promise<EstadoAcao> {
+  return comLeitura(contaDoFormulario(f), (c) =>
+    executar("/contas", "POST", c, "Conta recorrente cadastrada."),
+  );
+}
+
+export function pagarConta(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  return comLeitura(pagamentoDoFormulario(f), (p) =>
+    executar(
+      `/contas/${id}/pagamentos`,
+      "POST",
+      p,
+      "Pagamento registrado.",
+      "Esta conta já está paga neste mês.",
+    ),
+  );
+}
+
+export function encerrarConta(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  const campo = f.get("ultimoMes");
+  const ultimoMes = typeof campo === "string" ? campo.trim() : "";
+  if (ultimoMes !== "" && !mesValido(ultimoMes)) {
+    return Promise.resolve({ erro: true, mensagem: "Informe o último mês de vencimento." });
+  }
+  return executar(
+    `/contas/${id}/encerrar`,
+    "POST",
+    ultimoMes === "" ? {} : { ultimoMes },
+    "Conta encerrada.",
+    "Há pagamento registrado depois do último mês escolhido.",
+  );
+}
+
+export function reativarConta(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  return executar(`/contas/${id}/reativar`, "POST", {}, "Conta reativada.");
+}
+
+export function excluirConta(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  return executar(
+    `/contas/${id}`,
+    "DELETE",
+    undefined,
+    "Conta excluída.",
+    "A conta tem pagamentos registrados. Encerre-a para manter o histórico.",
+  );
+}
+
+export function criarCategoria(f: FormData): Promise<EstadoAcao> {
+  return comLeitura(categoriaDoFormulario(f), (c) =>
+    executar(
+      "/categorias",
+      "POST",
+      c,
+      `Categoria “${c.nome}” cadastrada.`,
+      "Já existe uma categoria com esse nome para esse tipo.",
+    ),
+  );
+}
+
+export function excluirCategoria(f: FormData): Promise<EstadoAcao> {
+  const id = idDoFormulario(f);
+  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
+  return executar(`/categorias/${id}`, "DELETE", undefined, "Categoria excluída.");
+}
diff --git a/apps/web/lib/fluxo-caixa-api.ts b/apps/web/lib/fluxo-caixa-api.ts
new file mode 100644
index 0000000..ff68a1c
--- /dev/null
+++ b/apps/web/lib/fluxo-caixa-api.ts
@@ -0,0 +1,102 @@
+/**
+ * Acesso do servidor Next.js a API de fluxo de caixa. Mesma chave de servico do painel de vendas
+ * (VENDAS_API_KEY ou arquivo); roda so no servidor e a chave nunca chega ao navegador.
+ */
+import type { FluxoCaixaMes } from "@nucleos/contracts";
+import { configuracao } from "./vendas-api.ts";
+
+export type FalhaFluxo =
+  | "nao-autorizado"
+  | "api-sem-chave"
+  | "modulo-desligado"
+  | "invalido"
+  | "nao-encontrado"
+  | "conflito"
+  | "indisponivel";
+
+export type ResultadoFluxo<T> =
+  { tipo: "ok"; dados: T } | { tipo: "nao-configurado" } | { tipo: "erro"; falha: FalhaFluxo };
+
+const TIMEOUT_MS = 10_000;
+
+const FALHA_POR_STATUS: Record<number, FalhaFluxo> = {
+  400: "invalido",
+  401: "nao-autorizado",
+  404: "nao-encontrado",
+  409: "conflito",
+  503: "api-sem-chave",
+};
+
+async function chamar(
+  caminho: string,
+  method: "GET" | "POST" | "DELETE",
+  corpo?: unknown,
+): Promise<ResultadoFluxo<unknown>> {
+  const cfg = configuracao();
+  if (cfg === undefined) return { tipo: "nao-configurado" };
+  try {
+    const r = await fetch(`${cfg.base}/v1/fluxo-caixa${caminho}`, {
+      method,
+      headers: {
+        authorization: `Bearer ${cfg.chave}`,
+        ...(corpo === undefined ? {} : { "content-type": "application/json" }),
+      },
+      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
+      cache: "no-store",
+      signal: AbortSignal.timeout(TIMEOUT_MS),
+    });
+    if (!r.ok) return { tipo: "erro", falha: FALHA_POR_STATUS[r.status] ?? "indisponivel" };
+    return { tipo: "ok", dados: r.status === 204 ? null : ((await r.json()) as unknown) };
+  } catch {
+    return { tipo: "erro", falha: "indisponivel" };
+  }
+}
+
+const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
+
+const ehFluxo = (x: unknown): x is FluxoCaixaMes =>
+  ehObjeto(x) &&
+  typeof x["mes"] === "string" &&
+  ehObjeto(x["resumo"]) &&
+  Array.isArray(x["movimentos"]) &&
+  Array.isArray(x["contasDoMes"]) &&
+  Array.isArray(x["contas"]) &&
+  Array.isArray(x["categorias"]);
+
+export async function carregarFluxo(
+  mes: string | undefined,
+): Promise<ResultadoFluxo<FluxoCaixaMes>> {
+  const r = await chamar(mes === undefined ? "" : `?mes=${mes}`, "GET");
+  // 404 no GET significa rota ausente: modulo desligado na API (sem banco).
+  if (r.tipo === "erro" && r.falha === "nao-encontrado") {
+    return { tipo: "erro", falha: "modulo-desligado" };
+  }
+  if (r.tipo !== "ok") return r;
+  return ehFluxo(r.dados)
+    ? { tipo: "ok", dados: r.dados }
+    : { tipo: "erro", falha: "indisponivel" };
+}
+
+/** Mutacao sem corpo de resposta relevante para a tela (a pagina e revalidada em seguida). */
+export async function alterarFluxo(
+  caminho: string,
+  method: "POST" | "DELETE",
+  corpo?: unknown,
+): Promise<ResultadoFluxo<null>> {
+  const r = await chamar(caminho, method, corpo);
+  return r.tipo === "ok" ? { tipo: "ok", dados: null } : r;
+}
+
+export const MENSAGENS_FALHA_FLUXO: Record<FalhaFluxo, string> = {
+  "nao-autorizado":
+    "A chave de acesso à API do financeiro foi recusada. Confira a chave configurada no servidor web.",
+  "api-sem-chave":
+    "A API do financeiro está sem chave de serviço configurada e, por segurança, não responde.",
+  "modulo-desligado": "O fluxo de caixa está desligado na API (sem banco de dados configurado).",
+  invalido: "Os dados enviados foram recusados pela API. Confira os campos e tente de novo.",
+  "nao-encontrado":
+    "O registro não foi encontrado. Ele pode ter sido removido; recarregue a página.",
+  conflito: "A operação conflita com um registro existente.",
+  indisponivel:
+    "Não foi possível falar com a API do financeiro agora. Tente novamente em instantes.",
+};
diff --git a/apps/web/lib/fluxo-caixa-formato.ts b/apps/web/lib/fluxo-caixa-formato.ts
new file mode 100644
index 0000000..f5d8626
--- /dev/null
+++ b/apps/web/lib/fluxo-caixa-formato.ts
@@ -0,0 +1,205 @@
+/**
+ * Funcoes puras do fluxo de caixa: valores em reais <-> centavos, meses da URL e leitura dos
+ * formularios das Server Actions. Sem DOM nem rede, para testar no Node.
+ */
+import type {
+  NovaCategoria,
+  NovaContaRecorrente,
+  NovoLancamento,
+  NovoPagamentoConta,
+  StatusContaDoMes,
+} from "@nucleos/contracts";
+
+export interface EstadoAcao {
+  erro: boolean;
+  mensagem: string;
+}
+
+export const ESTADO_INICIAL: EstadoAcao = { erro: false, mensagem: "" };
+
+/** Evento DOM (borbulha) disparado pelo formulario quando a acao termina com sucesso. */
+export const EVENTO_ACAO_CONCLUIDA = "fluxo:acao-concluida";
+
+export type Leitura<T> = { ok: true; valor: T } | { ok: false; mensagem: string };
+
+const VALOR_MAX_CENTAVOS = 100_000_000_000;
+const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
+const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
+const ID_RE = /^[1-9]\d{0,17}$/;
+// Formato brasileiro com milhar (1.234,56) ou numero simples (1234,56 / 1234.56, como o <input type=number> envia).
+const VALOR_BR_RE = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
+const VALOR_SIMPLES_RE = /^(\d+)(?:[.,](\d{1,2}))?$/;
+
+/** `"1.234,56"` => `123456`. Sem float: inteiro e centavos sao lidos como texto. */
+export function lerValorEmCentavos(texto: string): number | null {
+  const t = texto.trim().replace(/^R\$\s*/, "");
+  const br = VALOR_BR_RE.exec(t);
+  const m = br ?? VALOR_SIMPLES_RE.exec(t);
+  if (m === null) return null;
+  const inteiro = Number((m[1] ?? "").replaceAll(".", ""));
+  const centavos = Number((m[2] ?? "").padEnd(2, "0"));
+  const total = inteiro * 100 + centavos;
+  return Number.isSafeInteger(total) && total > 0 && total <= VALOR_MAX_CENTAVOS ? total : null;
+}
+
+/** `123456` => `"1234.56"`, valor padrao para `<input type="number" step="0.01">`. */
+export function centavosParaCampo(centavos: number): string {
+  return (centavos / 100).toFixed(2);
+}
+
+export function formatarReais(centavos: number): string {
+  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
+    centavos / 100,
+  );
+}
+
+export function mesValido(texto: string): boolean {
+  return MES_RE.test(texto);
+}
+
+/** `?mes=2026-11`; ausente, repetido ou invalido => undefined (a API usa o mes corrente). */
+export function mesDaUrl(busca: Record<string, string | string[] | undefined>): string | undefined {
+  const v = busca["mes"];
+  return typeof v === "string" && mesValido(v) ? v : undefined;
+}
+
+export function somarMeses(mes: string, n: number): string {
+  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
+  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
+}
+
+/** `2026-11` => `novembro de 2026`. */
+export function nomeDoMes(mes: string): string {
+  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1));
+  return new Intl.DateTimeFormat("pt-BR", {
+    month: "long",
+    year: "numeric",
+    timeZone: "UTC",
+  }).format(d);
+}
+
+/** `2026-11-05` => `05/11`. */
+export function diaCurto(dia: string): string {
+  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
+}
+
+/** `2026-11` => `11/2026`. */
+export function mesCurto(mes: string): string {
+  return `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
+}
+
+/** Dia sugerido nos formularios: hoje, se o mes exibido e o corrente; senao o dia 1 do mes. */
+export function diaSugerido(mes: string, hoje: string): string {
+  return hoje.startsWith(mes) ? hoje : `${mes}-01`;
+}
+
+export const ROTULO_STATUS: Record<StatusContaDoMes, string> = {
+  paga: "Paga",
+  pendente: "A vencer",
+  atrasada: "Atrasada",
+};
+
+const texto = (f: FormData, nome: string): string => {
+  const v = f.get(nome);
+  return typeof v === "string" ? v.trim() : "";
+};
+
+function campoTexto(f: FormData, nome: string, rotulo: string, max: number): Leitura<string> {
+  const v = texto(f, nome);
+  return v.length === 0 || v.length > max
+    ? { ok: false, mensagem: `Informe ${rotulo} (até ${String(max)} caracteres).` }
+    : { ok: true, valor: v };
+}
+
+function campoValor(f: FormData): Leitura<number> {
+  const v = lerValorEmCentavos(texto(f, "valor"));
+  return v === null
+    ? { ok: false, mensagem: "Informe um valor maior que zero, como 1.234,56." }
+    : { ok: true, valor: v };
+}
+
+function campoDia(f: FormData, nome: string): Leitura<string> {
+  const v = texto(f, nome);
+  return DIA_RE.test(v)
+    ? { ok: true, valor: v }
+    : { ok: false, mensagem: "Informe uma data válida." };
+}
+
+function campoMes(f: FormData, nome: string, rotulo: string): Leitura<string> {
+  const v = texto(f, nome);
+  return mesValido(v) ? { ok: true, valor: v } : { ok: false, mensagem: `Informe ${rotulo}.` };
+}
+
+/** Le o id oculto do formulario; so digitos, para nao montar caminho arbitrario na API. */
+export function idDoFormulario(f: FormData, nome = "id"): string | null {
+  const v = texto(f, nome);
+  return ID_RE.test(v) ? v : null;
+}
+
+/** Junta as leituras: devolve a primeira mensagem de erro ou o objeto completo. */
+function juntar<T extends object>(campos: {
+  [K in keyof T]: Leitura<T[K]>;
+}): Leitura<T> {
+  const saida: Record<string, unknown> = {};
+  for (const [k, r] of Object.entries<Leitura<unknown>>(campos)) {
+    if (!r.ok) return r;
+    saida[k] = r.valor;
+  }
+  return { ok: true, valor: saida as T };
+}
+
+export function lancamentoDoFormulario(f: FormData): Leitura<NovoLancamento> {
+  const tipo = texto(f, "tipo");
+  return juntar<NovoLancamento>({
+    tipo:
+      tipo === "entrada" || tipo === "saida"
+        ? { ok: true, valor: tipo }
+        : { ok: false, mensagem: "Escolha entrada ou saída." },
+    descricao: campoTexto(f, "descricao", "a descrição", 120),
+    categoria: campoTexto(f, "categoria", "a categoria", 60),
+    valorCentavos: campoValor(f),
+    data: campoDia(f, "data"),
+  });
+}
+
+export function contaDoFormulario(f: FormData): Leitura<NovaContaRecorrente> {
+  const dia = Number(texto(f, "diaVencimento"));
+  const fim = texto(f, "fim");
+  const conta = juntar<Omit<NovaContaRecorrente, "fim">>({
+    descricao: campoTexto(f, "descricao", "a descrição", 120),
+    categoria: campoTexto(f, "categoria", "a categoria", 60),
+    valorCentavos: campoValor(f),
+    diaVencimento:
+      Number.isInteger(dia) && dia >= 1 && dia <= 31
+        ? { ok: true, valor: dia }
+        : { ok: false, mensagem: "O dia de vencimento vai de 1 a 31." },
+    inicio: campoMes(f, "inicio", "o mês do primeiro vencimento"),
+  });
+  if (!conta.ok) return conta;
+  if (fim === "") return { ok: true, valor: { ...conta.valor, fim: null } };
+  if (!mesValido(fim))
+    return { ok: false, mensagem: "Informe um mês final válido ou deixe em branco." };
+  if (fim < conta.valor.inicio) {
+    return { ok: false, mensagem: "O último mês não pode ser anterior ao primeiro." };
+  }
+  return { ok: true, valor: { ...conta.valor, fim } };
+}
+
+export function pagamentoDoFormulario(f: FormData): Leitura<NovoPagamentoConta> {
+  return juntar<NovoPagamentoConta>({
+    competencia: campoMes(f, "competencia", "o mês de referência"),
+    data: campoDia(f, "data"),
+    valorCentavos: campoValor(f),
+  });
+}
+
+export function categoriaDoFormulario(f: FormData): Leitura<NovaCategoria> {
+  const tipo = texto(f, "tipo");
+  return juntar<NovaCategoria>({
+    tipo:
+      tipo === "entrada" || tipo === "saida"
+        ? { ok: true, valor: tipo }
+        : { ok: false, mensagem: "Escolha entrada ou saída." },
+    nome: campoTexto(f, "nome", "o nome da categoria", 60),
+  });
+}
diff --git a/packages/contracts/src/fluxo-caixa.ts b/packages/contracts/src/fluxo-caixa.ts
new file mode 100644
index 0000000..e77d938
--- /dev/null
+++ b/packages/contracts/src/fluxo-caixa.ts
@@ -0,0 +1,127 @@
+/**
+ * Contrato do fluxo de caixa do setor Financeiro: lancamentos manuais (entradas e saidas) e
+ * contas a pagar recorrentes (mensais), cujo pagamento vira uma saida vinculada a competencia.
+ * Valores em centavos inteiros e sempre em BRL. Dias `YYYY-MM-DD` e meses `YYYY-MM` seguem o fuso
+ * America/Sao_Paulo; instantes sao RFC 3339 em UTC. Ids sao texto (bigint no banco).
+ */
+
+export type TipoLancamento = "entrada" | "saida";
+
+export const TIPOS_LANCAMENTO: readonly TipoLancamento[] = ["entrada", "saida"];
+
+export interface Lancamento {
+  id: string;
+  tipo: TipoLancamento;
+  descricao: string;
+  categoria: string;
+  valorCentavos: number;
+  /** Dia em que o dinheiro entrou ou saiu (YYYY-MM-DD). */
+  data: string;
+  /** Preenchido quando o lancamento e o pagamento de uma conta recorrente. */
+  contaRecorrenteId: string | null;
+  /** Mes de referencia (YYYY-MM) do pagamento da conta recorrente. */
+  competencia: string | null;
+  criadoEm: string;
+}
+
+/** Lancamento do mes com o saldo acumulado logo apos ele (ordem: data, id). */
+export interface MovimentoFluxo extends Lancamento {
+  saldoAposCentavos: number;
+}
+
+export interface ContaRecorrente {
+  id: string;
+  descricao: string;
+  categoria: string;
+  /** Valor previsto de cada mes; o pagamento pode registrar outro valor (ex.: conta de luz). */
+  valorCentavos: number;
+  /** 1 a 31; em meses mais curtos vence no ultimo dia. */
+  diaVencimento: number;
+  /** Primeiro mes em que a conta vence (YYYY-MM). */
+  inicio: string;
+  /** Ultimo mes em que a conta vence (YYYY-MM); null = sem prazo. */
+  fim: string | null;
+  /** Falso quando a conta ja foi encerrada antes do mes corrente. */
+  vigente: boolean;
+}
+
+export type StatusContaDoMes = "paga" | "pendente" | "atrasada";
+
+/** Ocorrencia de uma conta recorrente no mes consultado. */
+export interface ContaDoMes {
+  contaId: string;
+  descricao: string;
+  categoria: string;
+  valorPrevistoCentavos: number;
+  vencimento: string;
+  status: StatusContaDoMes;
+  pagamento: { lancamentoId: string; data: string; valorCentavos: number } | null;
+}
+
+export interface ResumoFluxoCaixa {
+  /** Saldo realizado acumulado ate o dia anterior ao mes. */
+  saldoInicialCentavos: number;
+  entradasCentavos: number;
+  saidasCentavos: number;
+  /** Saldo inicial + entradas - saidas realizadas no mes. */
+  saldoFinalCentavos: number;
+  /** Contas recorrentes do mes ainda nao pagas (pendentes e atrasadas). */
+  aPagarCentavos: number;
+  /** Saldo final menos o que falta pagar no mes. */
+  saldoProjetadoCentavos: number;
+}
+
+export interface FluxoCaixaMes {
+  mes: string;
+  moeda: "BRL";
+  /** Dia corrente no fuso do negocio, usado para marcar contas atrasadas. */
+  hoje: string;
+  resumo: ResumoFluxoCaixa;
+  movimentos: MovimentoFluxo[];
+  contasDoMes: ContaDoMes[];
+  /** Todas as contas recorrentes cadastradas, vigentes primeiro. */
+  contas: ContaRecorrente[];
+  /** Categorias cadastradas, por tipo e nome. */
+  categorias: Categoria[];
+}
+
+/**
+ * Categoria de entrada ou saida. Lancamentos e contas guardam o nome (texto), para o historico nao
+ * mudar se a categoria for excluida; novos registros so aceitam categorias cadastradas do mesmo tipo
+ * (contas recorrentes sempre usam categorias de saida).
+ */
+export interface Categoria {
+  id: string;
+  tipo: TipoLancamento;
+  nome: string;
+}
+
+export interface NovaCategoria {
+  tipo: TipoLancamento;
+  nome: string;
+}
+
+export interface NovoLancamento {
+  tipo: TipoLancamento;
+  descricao: string;
+  categoria: string;
+  valorCentavos: number;
+  data: string;
+}
+
+export interface NovaContaRecorrente {
+  descricao: string;
+  categoria: string;
+  valorCentavos: number;
+  diaVencimento: number;
+  inicio: string;
+  fim?: string | null;
+}
+
+export interface NovoPagamentoConta {
+  competencia: string;
+  data: string;
+  valorCentavos: number;
+}
+
+export const FLUXO_CAIXA_PATH = "/v1/fluxo-caixa";
```
