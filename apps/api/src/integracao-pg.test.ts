import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { Pool } from "pg";
import { lerMigracoes, migrar } from "./migrar.js";
import type { Venda } from "./vendas/dominio.js";
import { RepositorioVendasPg } from "./vendas/repositorio-pg.js";

/**
 * Integracao com PostgreSQL real. So roda com TEST_DATABASE_URL apontando para um servidor
 * DESCARTAVEL (container em 127.0.0.1, sem dados reais); cria um banco temporario proprio e o remove.
 */
const URL_ADMIN = process.env["TEST_DATABASE_URL"];

const venda = (transacao: string, parcial: Partial<Venda> = {}): Venda => ({
  transacao,
  produtoId: "101",
  produtoNome: "Curso Completo",
  compradorId: "comprador-1",
  status: "APPROVED",
  grupo: "receita",
  pedidoEm: new Date("2026-10-10T15:00:00Z"),
  aprovadoEm: null,
  valorCentavos: 10_000,
  taxaCentavos: 1_000,
  moeda: "BRL",
  pagamento: "PIX",
  parcelas: 1,
  assinatura: false,
  recorrencia: 0,
  ...parcial,
});

describe(
  "PostgreSQL real",
  { skip: URL_ADMIN === undefined ? "defina TEST_DATABASE_URL (container descartavel)" : false },
  () => {
    const nomeBanco = `nucleos_teste_${randomBytes(4).toString("hex")}`;
    let admin: Pool;
    let pool: Pool;

    before(async () => {
      // Trava de seguranca: este teste cria e apaga bancos; so roda contra servidor local.
      const host = new URL(URL_ADMIN as string).hostname;
      assert.ok(
        ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host),
        "TEST_DATABASE_URL deve ser local",
      );
      admin = new Pool({ connectionString: URL_ADMIN, max: 1 });
      await admin.query(`CREATE DATABASE ${nomeBanco}`);
      const u = new URL(URL_ADMIN as string);
      u.pathname = `/${nomeBanco}`;
      pool = new Pool({ connectionString: u.toString(), max: 5 });
      // O DROP ... FORCE final pode cortar uma conexao ociosa: isso nao e falha do teste.
      pool.on("error", () => undefined);
    });

    after(async () => {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${nomeBanco} WITH (FORCE)`);
      await admin.end();
    });

    test("migrations aplicam do zero, sao idempotentes e detectam arquivo alterado", async () => {
      const migracoes = await lerMigracoes(new URL("../migrations/", import.meta.url));
      assert.deepEqual((await migrar(pool, migracoes)).length, migracoes.length);
      assert.deepEqual(await migrar(pool, migracoes), []);
      const adulterada = migracoes.map((m, i) =>
        i === 0 ? { ...m, checksum: "0".repeat(64) } : m,
      );
      await assert.rejects(migrar(pool, adulterada), /alterada apos aplicada/);
    });

    test("upsert de vendas e idempotente e atualiza o status", async () => {
      const repo = new RepositorioVendasPg(pool);
      assert.equal(await repo.gravarVendas([venda("T1"), venda("T2"), venda("T2")]), 2); // duplicada no lote
      await repo.gravarVendas([venda("T1", { status: "REFUNDED", grupo: "reembolso" })]);
      const { rows } = await pool.query(
        "SELECT transacao, status FROM financeiro.vendas ORDER BY transacao",
      );
      assert.deepEqual(rows, [
        { transacao: "T1", status: "REFUNDED" },
        { transacao: "T2", status: "APPROVED" },
      ]);
    });

    test("agregados: periodo no fuso de Sao Paulo, moeda, reembolso, produto e pagamento", async () => {
      const repo = new RepositorioVendasPg(pool);
      await pool.query("TRUNCATE financeiro.vendas");
      await repo.gravarVendas([
        venda("A", { pedidoEm: new Date("2026-10-10T15:00:00Z"), compradorId: "c1" }),
        venda("B", {
          pedidoEm: new Date("2026-10-10T16:00:00Z"),
          compradorId: "c1",
          pagamento: "CREDIT_CARD",
          valorCentavos: 5_000,
          taxaCentavos: 500,
          assinatura: true,
        }),
        venda("C", {
          pedidoEm: new Date("2026-10-12T15:00:00Z"),
          compradorId: "c2",
          produtoId: "202",
          produtoNome: "Mentoria",
          valorCentavos: 30_000,
          taxaCentavos: 3_000,
        }),
        venda("D", {
          pedidoEm: new Date("2026-10-12T16:00:00Z"),
          status: "REFUNDED",
          grupo: "reembolso",
          valorCentavos: 10_000,
        }),
        venda("E", {
          pedidoEm: new Date("2026-10-12T17:00:00Z"),
          status: "WAITING_PAYMENT",
          grupo: "pendente",
        }),
        // 02:30Z de 01/11 = 23:30 de 31/10 em Sao Paulo: entra em outubro, nao em novembro.
        venda("F", { pedidoEm: new Date("2026-11-01T02:30:00Z") }),
        venda("USD", {
          moeda: "USD",
          valorCentavos: 99_900,
          pedidoEm: new Date("2026-10-11T12:00:00Z"),
        }),
      ]);

      const r = await repo.agregados({ de: "2026-10-01", ate: "2026-10-31", moeda: "BRL" });
      assert.deepEqual(r.indicadores, {
        receitaBrutaCentavos: 55_000, // A 10.000 + B 5.000 + C 30.000 + F 10.000
        taxasCentavos: 5_500, // 1.000 + 500 + 3.000 + 1.000
        receitaLiquidaCentavos: 49_500,
        vendas: 4,
        ticketMedioCentavos: 13_750,
        compradoresUnicos: 3, // c1 (A e B), c2 (C) e o "comprador-1" padrao de F; D (reembolso) nao conta
        reembolsadoCentavos: 10_000,
        reembolsos: 1,
        taxaReembolso: 1 / 5,
        vendasAssinatura: 1,
      });
      assert.deepEqual(
        r.serieDiaria.map((p) => [p.dia, p.vendas]),
        [
          ["2026-10-10", 2],
          ["2026-10-12", 1],
          ["2026-10-31", 1],
        ],
      );
      assert.deepEqual(
        r.porProduto.map((p) => [p.produtoId, p.receitaCentavos]),
        [
          ["202", 30_000],
          ["101", 25_000],
        ],
      );
      assert.deepEqual(r.porPagamento.map((p) => p.tipo).sort(), ["CREDIT_CARD", "PIX"]);
      assert.deepEqual(r.porStatus.map((s) => s.status).sort(), [
        "APPROVED",
        "REFUNDED",
        "WAITING_PAYMENT",
      ]);

      const usd = await repo.indicadores({ de: "2026-10-01", ate: "2026-10-31", moeda: "USD" });
      assert.equal(usd.receitaBrutaCentavos, 99_900);
      const soMentoria = await repo.indicadores({
        de: "2026-10-01",
        ate: "2026-10-31",
        moeda: "BRL",
        produtoId: "202",
      });
      assert.equal(soMentoria.vendas, 1);
      const novembro = await repo.indicadores({
        de: "2026-11-01",
        ate: "2026-11-30",
        moeda: "BRL",
      });
      assert.equal(novembro.vendas, 0);

      assert.deepEqual(await repo.moedasDisponiveis(), ["USD", "BRL"]); // ordenadas por volume
      assert.deepEqual(
        (await repo.produtosDisponiveis()).map((p) => p.produtoNome),
        ["Curso Completo", "Mentoria"],
      );
      const lista = await repo.listar({ de: "2026-10-01", ate: "2026-10-31", moeda: "BRL" }, 2, 0);
      assert.equal(lista.total, 6);
      assert.equal(lista.itens.length, 2);
      assert.equal(lista.itens[0]?.transacao, "F"); // mais recente primeiro
    });

    test("estado de sincronizacao e lock consultivo", async () => {
      const repo = new RepositorioVendasPg(pool);
      assert.equal((await repo.lerEstadoSincronizacao()).status, "nunca");
      await repo.salvarEstadoSincronizacao({
        status: "falha",
        mensagem: "x",
        vendasProcessadas: 3,
      });
      await repo.salvarEstadoSincronizacao({
        status: "sucesso",
        mensagem: null,
        ultimoSucessoEm: new Date("2026-11-01T12:00:00Z"),
      });
      const e = await repo.lerEstadoSincronizacao();
      assert.equal(e.status, "sucesso");
      assert.equal(e.mensagem, null); // null explicito limpa o aviso
      assert.equal(e.vendasProcessadas, 3); // nao informado => preservado

      const resultado = await repo.comLockDeSincronizacao(async () => {
        const interno = await repo.comLockDeSincronizacao(async () => "nunca");
        assert.deepEqual(interno, { ocupado: true });
        return "externo";
      });
      assert.deepEqual(resultado, { ocupado: false, valor: "externo" });
      assert.deepEqual(await repo.comLockDeSincronizacao(async () => 1), {
        ocupado: false,
        valor: 1,
      });
    });
  },
);
