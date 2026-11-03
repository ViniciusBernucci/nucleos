import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { before, after, describe, test } from "node:test";
import { Pool } from "pg";
import { migrar, lerMigracoes } from "../migrar.js";
import { RegistroHandlers } from "../funcionarios/handlers.js";
import { MotorFuncionarios } from "../funcionarios/motor.js";
import { AlertasFinanceiros } from "./alertas.js";
import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { ConciliacaoFinanceira } from "./conciliacao.js";
import { encerrarFixturePg } from "./teste-pg-apoio.js";
import { RepositorioFluxoCaixaPg } from "../fluxo-caixa/repositorio-pg.js";
const url = process.env["TEST_DATABASE_URL"];
describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
  let pool: Pool, admin: Pool, alertas: AlertasFinanceiros;
  let fecharPool: (() => Promise<void>) | undefined;
  let removerBanco: (() => Promise<void>) | undefined;
  let fecharAdmin: (() => Promise<void>) | undefined;
  const banco = `nucleos_fin_teste_${randomBytes(5).toString("hex")}`;
  before(async () => {
    const u = new URL(url as string);
    assert.equal(u.hostname, "127.0.0.1");
    assert.equal(u.port, "15432");
    admin = new Pool({ connectionString: u.toString() });
    fecharAdmin = () => admin.end();
    await admin.query(`CREATE DATABASE ${banco}`);
    removerBanco = async () => {
      await admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
    };
    u.pathname = `/${banco}`;
    pool = new Pool({ connectionString: u.toString() });
    fecharPool = () => pool.end();
    pool.on("error", () => undefined);
    await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
    alertas = new AlertasFinanceiros(pool, new MotorFuncionarios(pool, new RegistroHandlers()));
  });
  after(async () => {
    await encerrarFixturePg(fecharPool, removerBanco, fecharAdmin);
  });
  test("alerta concorrente deduplica e publica um evento; encerrado permite nova ocorrencia", async () => {
    const dados = {
      tipo: "conta_vencida" as const,
      chave: "conta:1",
      referenciaTabela: "contas_pagar",
      referenciaId: "1",
    };
    const ids = await Promise.all([alertas.criar(dados), alertas.criar(dados)]);
    assert.equal(ids.filter(Boolean).length, 1);
    assert.equal(
      (
        await pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM funcionarios.eventos WHERE tipo='financeiro.alerta.criado'",
        )
      ).rows[0]?.n,
      1,
    );
    await alertas.encerrar(ids.find((id): id is string => id !== null) as string, "resolvido");
    assert.ok(await alertas.criar(dados));
    assert.equal((await alertas.listar()).length, 1);
  });
  test("rollback do chamador remove alerta e evento", async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const id = await alertas.criar(
        { tipo: "anomalia", chave: "rollback", referenciaTabela: "vendas", referenciaId: "1" },
        c,
      );
      await c.query("ROLLBACK");
      assert.equal(
        (await pool.query("SELECT id FROM financeiro.alertas WHERE id=$1", [id])).rowCount,
        0,
      );
    } finally {
      c.release();
    }
  });
  test("parcelas preservam total e pagamento concorrente produz uma unica saida", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
    const resultado = (await repo.criarDespesa({
      descricao: "Parcelada PG",
      categoria: "Serviços",
      valorCentavos: "10001",
      vencimento: "2026-11-30",
      parcelas: 3,
    })) as { ids: string[] };
    const linhas = await pool.query<{ valor_centavos: string }>(
      "SELECT valor_centavos FROM financeiro.contas_pagar WHERE id=ANY($1::bigint[]) ORDER BY parcela",
      [resultado.ids],
    );
    assert.deepEqual(
      linhas.rows.map((v) => v.valor_centavos),
      ["3334", "3334", "3333"],
    );
    const cid = resultado.ids[0];
    assert.ok(cid);
    const pagos = await Promise.allSettled([
      repo.pagar(cid, { data: "2026-11-30", contaFinanceiraId: "1" }),
      repo.pagar(cid, { data: "2026-11-30", contaFinanceiraId: "1" }),
    ]);
    assert.equal(pagos.filter((p) => p.status === "fulfilled").length, 1);
    assert.equal(
      (await pool.query("SELECT id FROM financeiro.lancamentos WHERE conta_pagar_id=$1", [cid]))
        .rowCount,
      1,
    );
  });
  test("transferencia e extrato mantem atomicidade e idempotencia", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
    const t = (await repo.transferencia({
      origemId: "1",
      destinoId: "2",
      data: "2026-11-03",
      valorCentavos: "10000",
    })) as { id: string };
    const r = await pool.query<{ n: number; saldo: string }>(
      "SELECT count(*)::int n,sum(CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text saldo FROM financeiro.lancamentos WHERE transferencia_id=$1",
      [t.id],
    );
    assert.deepEqual(r.rows[0], { n: 2, saldo: "0" });
    const perna = (
      await pool.query<{ id: string }>(
        "SELECT id FROM financeiro.lancamentos WHERE transferencia_id=$1 ORDER BY id LIMIT 1",
        [t.id],
      )
    ).rows[0];
    assert.ok(perna);
    await assert.rejects(
      new RepositorioFluxoCaixaPg(pool, alertas.motor).excluirLancamento(perna.id),
      /vinculado/,
    );
    assert.equal(
      (await pool.query("SELECT id FROM financeiro.lancamentos WHERE transferencia_id=$1", [t.id]))
        .rowCount,
      2,
    );
    const p = {
      contaFinanceiraId: "1",
      formato: "csv",
      conteudo: "data;valor;fitid;memo\n2026-11-03;100,00;FIT-PG;Entrada",
    };
    await repo.importarExtrato(p);
    await repo.importarExtrato(p);
    assert.equal(
      (await pool.query("SELECT id FROM financeiro.extrato_itens WHERE fitid='FIT-PG'")).rowCount,
      1,
    );
  });
  test("recorrencia idempotente respeita periodicidade anual e pagamento legado vincula conta", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
    const atual = await pool.query<{ mes: string }>(
      "SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM') mes",
    );
    const mes = atual.rows[0]?.mes;
    assert.ok(mes);
    const recorrente = (await repo.criarRecorrente({
      descricao: "Recorrente PG",
      categoria: "Serviços",
      valorCentavos: "9900",
      diaVencimento: 31,
      inicio: mes + "-01",
      periodicidade: "anual",
    })) as { id: string };
    await repo.transacao((c) => repo.gerarRecorrencias(c));
    assert.equal(
      (
        await pool.query("SELECT id FROM financeiro.contas_pagar WHERE conta_recorrente_id=$1", [
          recorrente.id,
        ])
      ).rowCount,
      1,
    );
    const l = await pool.query<{ conta_pagar_id: string }>(
      "INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_recorrente_id,competencia) VALUES('saida','Legado PG','Serviços',9900,$1,$2,$1) RETURNING conta_pagar_id",
      [mes + "-01", recorrente.id],
    );
    const pagamento = l.rows[0];
    assert.ok(pagamento);
    assert.ok(pagamento.conta_pagar_id);
    assert.equal(
      (
        await pool.query<{ status: string }>(
          "SELECT status FROM financeiro.contas_pagar WHERE id=$1",
          [pagamento.conta_pagar_id],
        )
      ).rows[0]?.status,
      "paga",
    );
  });
  test("conciliacao ambigua exige escolha e aceita um extrato uma unica vez", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas),
      conciliacao = new ConciliacaoFinanceira(repo);
    const saque = (await repo.transferencia(
      { destinoId: "1", data: "2026-11-03", valorCentavos: "20200", taxaCentavos: "200" },
      true,
    )) as { id: string };
    assert.ok(saque.id);
    await repo.importarExtrato({
      contaFinanceiraId: "1",
      formato: "csv",
      conteudo:
        "data;valor;fitid;memo\n2026-11-03;200,00;AMB1;Entrada\n2026-11-03;200,00;AMB2;Entrada",
    });
    await repo.transacao((c) => conciliacao.sugerir(c));
    const origem = await pool.query<{ id: string }>(
      "SELECT id FROM financeiro.saques_hotmart WHERE transferencia_id=$1",
      [saque.id],
    );
    const sid = origem.rows[0]?.id;
    assert.ok(sid);
    const sugestao = await pool.query<{ id: string; estado: string }>(
      "SELECT id,estado FROM financeiro.conciliacoes WHERE chave=$1",
      ["saque:" + sid],
    );
    assert.equal(sugestao.rows[0]?.estado, "pendente_analise");
    const eid = (
      await pool.query<{ id: string }>("SELECT id FROM financeiro.extrato_itens WHERE fitid='AMB1'")
    ).rows[0]?.id;
    assert.ok(eid);
    const itens = [
      { tipo: "saque", referenciaId: sid, valorCentavos: "20000" },
      { tipo: "extrato_item", referenciaId: eid, valorCentavos: "20000" },
    ];
    const manual = (await conciliacao.manual({ itens })) as { id: string };
    await conciliacao.agir(manual.id, "aceitar");
    const outra = (await conciliacao.manual({ itens })) as { id: string };
    await assert.rejects(conciliacao.agir(outra.id, "aceitar"));
    await conciliacao.agir(manual.id, "desfazer");
    await conciliacao.agir(outra.id, "aceitar");
  });
  test("exclusao legada preserva pagamento conciliado e so reabre apos desfazer", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
    const criada = (await repo.criarDespesa({
      descricao: "Protegida",
      categoria: "Serviços",
      valorCentavos: "5000",
      vencimento: "2026-11-03",
    })) as { ids: string[] };
    const cid = criada.ids[0];
    assert.ok(cid);
    await repo.pagar(cid, { data: "2026-11-03", contaFinanceiraId: "1" });
    const lancamento = (
      await pool.query<{ id: string }>(
        "SELECT id FROM financeiro.lancamentos WHERE conta_pagar_id=$1",
        [cid],
      )
    ).rows[0];
    assert.ok(lancamento);
    await repo.importarExtrato({
      contaFinanceiraId: "1",
      formato: "csv",
      conteudo: "data;valor;fitid;memo\n2026-11-03;-50,00;REV-PAGO;Teste",
    });
    const e = (
      await pool.query<{ id: string }>(
        "SELECT id FROM financeiro.extrato_itens WHERE fitid='REV-PAGO'",
      )
    ).rows[0];
    assert.ok(e);
    const conciliacao = new ConciliacaoFinanceira(repo);
    const manual = (await conciliacao.manual({
      itens: [
        { tipo: "conta_pagar", referenciaId: cid, valorCentavos: "-5000" },
        { tipo: "extrato_item", referenciaId: e.id, valorCentavos: "-5000" },
      ],
    })) as { id: string };
    await conciliacao.agir(manual.id, "aceitar");
    const legado = new RepositorioFluxoCaixaPg(pool, alertas.motor);
    await repo.importarExtrato({
      contaFinanceiraId: "1",
      formato: "csv",
      conteudo: "data;valor;fitid;memo\n2026-11-03;-50,00;REV-PAGO-ALIAS;Teste",
    });
    const outro = (
      await pool.query<{ id: string }>(
        "SELECT id FROM financeiro.extrato_itens WHERE fitid='REV-PAGO-ALIAS'",
      )
    ).rows[0];
    assert.ok(outro);
    const alias = (await conciliacao.manual({
      itens: [
        { tipo: "lancamento", referenciaId: lancamento.id, valorCentavos: "-5000" },
        { tipo: "extrato_item", referenciaId: outro.id, valorCentavos: "-5000" },
      ],
    })) as { id: string };
    await assert.rejects(conciliacao.agir(alias.id, "aceitar"), /item ja conciliado/);
    await assert.rejects(legado.excluirLancamento(lancamento.id), /vinculado/);
    await conciliacao.agir(manual.id, "desfazer");
    assert.equal(await legado.excluirLancamento(lancamento.id), true);
    assert.equal(
      (
        await pool.query<{ status: string }>(
          "SELECT status FROM financeiro.contas_pagar WHERE id=$1",
          [cid],
        )
      ).rows[0]?.status,
      "aberta",
    );
  });
});
