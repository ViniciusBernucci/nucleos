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
import { GestaoFinanceira, filtroGestao } from "./gestao.js";
import { RentabilidadeMarketing } from "./rentabilidade.js";
import { CfoFinanceiro } from "./cfo.js";
import { Secret } from "@nucleos/config";
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
  test("gestao: competencia sem duplicar pagamento, midia e filtros sem rateio", async () => {
    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
    const gestao = new GestaoFinanceira(repo);
    await pool.query(
      "INSERT INTO financeiro.vendas(transacao,produto_id,produto_nome,comprador_id,status,grupo,pedido_em,valor_centavos,taxa_centavos,moeda,pagamento,liquido_centavos) VALUES('gestao','P','Produto','anonimo','APPROVED','receita','2020-02-15T12:00:00Z',10000,1000,'BRL','PIX',9000)",
    );
    await pool.query(
      "INSERT INTO financeiro.contas_pagar(descricao,categoria,valor_centavos,vencimento,competencia,status,origem) VALUES('Competencia','Serviços',2000,'2020-03-10','2020-02-01','aberta','manual')",
    );
    const f = filtroGestao({ de: "2020-02-01", ate: "2020-02-29" });
    let m = (await gestao.meses(f))[0];
    assert.equal(m?.bruta, "10000");
    assert.equal(m.resultado, "7000");
    const conta = (
      await pool.query<{ id: string }>(
        "SELECT id FROM financeiro.contas_pagar WHERE descricao='Competencia'",
      )
    ).rows[0];
    assert.ok(conta);
    await repo.pagar(conta.id, { data: "2020-03-10", contaFinanceiraId: "1" });
    m = (await gestao.meses(f))[0];
    assert.equal(m?.resultado, "7000");
    const produto = (await gestao.meses({ ...f, produto: "P" }))[0];
    assert.equal(produto?.resultado, "9000");
    assert.equal(produto.nao_classificado, "0");
    const centro = (await gestao.meses({ ...f, centro: "1" }))[0];
    assert.equal(centro?.bruta, "0");
    const antes = await gestao.fluxo({ de: "2020-03-10", ate: "2020-03-11" });
    assert.equal(antes.periodos[0]?.saidas, "2000");
    assert.equal(antes.periodos[0].previsto_pagar, "0");
    await assert.rejects(gestao.fluxo({ de: "2020-01-01", ate: "2020-12-31" }));
    await assert.rejects(
      gestao.salvarCenario("base", {
        realizacao_pct: 101,
        reembolso_pct: 0,
        variacao_despesas_pct: 0,
      }),
    );
    await gestao.salvarCenario("conservador", {
      realizacao_pct: 50,
      reembolso_pct: 10,
      variacao_despesas_pct: 20,
    });
    await pool.query(
      "INSERT INTO financeiro.contas_receber(origem,descricao,valor_centavos,previsto_em,conta_financeira_id) VALUES('manual','Estimativa',10000,'2020-04-01',1)",
    );
    const fluxo = await gestao.fluxo({
      de: "2020-04-01",
      ate: "2020-04-01",
      cenario: "conservador",
    });
    assert.equal(fluxo.periodos[0]?.previsto_receber, "4500");
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
  test("marketing/CFO: CAC unico entre produtos, nao atribuida, agregados sem PII e execucao simulada", async () => {
    const motor = new MotorFuncionarios(pool, new RegistroHandlers());
    const repo = new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor));
    const gestao = new GestaoFinanceira(repo),
      marketing = new RentabilidadeMarketing(gestao);
    const conta = (
      await pool.query<{ id: string }>(
        "INSERT INTO marketing.contas_anuncio(id_externo,moeda) VALUES('999','BRL') RETURNING id",
      )
    ).rows[0];
    assert.ok(conta);
    const camp = (
      await pool.query<{ id: string }>(
        "INSERT INTO marketing.campanhas(conta_anuncio_id,id_externo,nome) VALUES($1,'777','Campanha teste') RETURNING id",
        [conta.id],
      )
    ).rows[0];
    assert.ok(camp);
    await pool.query(
      "INSERT INTO marketing.gastos_diarios(campanha_id,dia,gasto_centavos,moeda,impressoes,cliques,compras_meta,valor_compras_meta_centavos) VALUES($1,'2021-02-01',3000,'BRL',10,2,0,0)",
      [camp.id],
    );
    await pool.query(
      "INSERT INTO financeiro.vendas(transacao,produto_id,produto_nome,comprador_id,status,grupo,pedido_em,valor_centavos,taxa_centavos,moeda,pagamento,liquido_centavos,rastreio_sck) SELECT 'mkt'||n,n::text,'Produto','pseudonimo-interno','APPROVED','receita','2021-02-01T12:00:00Z',10000,1000,'BRL','PIX',9000,CASE WHEN n<3 THEN '777' ELSE NULL END FROM generate_series(1,3) n",
    );
    const f = filtroGestao({ de: "2021-02-01", ate: "2021-02-28" }),
      dados = await marketing.consultar(f);
    assert.equal(dados.campanhas[0]?.cac, "3000");
    assert.equal(dados.campanhas[0].novos, "1");
    assert.equal(dados.campanhas[0].margem_pos_aquisicao, "15000");
    assert.equal(dados.nao_atribuida, "10000");
    assert.equal((await marketing.consultar({ ...f, produto: "1" })).campanhas[0]?.gasto, null);
    assert.doesNotMatch(JSON.stringify(dados), /pseudonimo-interno/);
    const chamadas: { url: string; corpo: unknown }[] = [];
    const requisitar: typeof fetch = async (input, op) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      chamadas.push({
        url,
        corpo: typeof op?.body === "string" ? (JSON.parse(op.body) as unknown) : null,
      });
      return new Response(
        JSON.stringify(
          url.endsWith("disponibilidade")
            ? { disponivel: true }
            : {
                status: "SUCESSO",
                resposta: "Resumo agregado",
                ferramentas: ["dre"],
                uso: { entrada: 100, saida: 20, custo_usd: "0.001", modelo: "claude-sonnet-5-5" },
              },
        ),
      );
    };
    const cfo = new CfoFinanceiro(
      gestao,
      {
        leitura: new Secret("leitura"),
        gateway: { url: "http://127.0.0.1:8002", chave: new Secret("gateway") },
      },
      requisitar,
    );
    await cfo.onModuleInit();
    assert.equal(cfo.disponivel, true);
    for (const nome of [
      "indicadores_mensais",
      "dre",
      "fluxo_projetado",
      "despesas_por_categoria",
      "rentabilidade_campanhas",
      "alertas_abertos",
    ])
      assert.doesNotMatch(
        JSON.stringify(await cfo.ferramenta(nome, { de: f.de, ate: f.ate })),
        /pseudonimo-interno|comprador|Campanha teste/,
      );
    await assert.rejects(cfo.ferramenta("pagar", { de: f.de, ate: f.ate }));
    const { execucaoId } = await cfo.perguntar({
      competencia: "diagnostico",
      de: f.de,
      ate: f.ate,
    });
    // Outras ocorrencias de indicadores podem preceder a pergunta na fila compartilhada.
    for (let i = 0; i < 30; i++) {
      const estado = (
        await pool.query<{ status: string }>(
          "SELECT status FROM funcionarios.execucoes WHERE id=$1",
          [execucaoId],
        )
      ).rows[0]?.status;
      if (estado === "SUCESSO") break;
      await motor.consumirUma();
    }
    assert.equal((await motor.aguardar(execucaoId, 1000)).status, "SUCESSO");
    const analise = (await cfo.historico()).find((a) => a["execucao_id"] === execucaoId);
    assert.equal(analise?.["resposta"], "Resumo agregado");
    assert.equal(chamadas.filter((c) => c.url.endsWith("/executar")).length, 1);
    await cfo.executar({
      execucaoId,
      chaveIdempotencia: "teste",
      tentativa: 2,
      config: { competencia: "diagnostico", de: f.de, ate: f.ate },
      signal: new AbortController().signal,
      verificarLease: async () => true,
    });
    assert.equal(
      chamadas.filter((c) => c.url.endsWith("/executar")).length,
      1,
      "retentativa nao repete chamada paga",
    );
    assert.deepEqual(chamadas.find((c) => c.url.endsWith("/executar"))?.corpo, {
      competencia: "diagnostico",
      de: f.de,
      ate: f.ate,
    });
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
  test("gestao: materializacao e anomalia incluem despesas manuais, com alerta idempotente", async () => {
    const motor = new MotorFuncionarios(pool, new RegistroHandlers());
    const repo = new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor));
    const gestao = new GestaoFinanceira(repo);
    await pool.query(
      "INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data) SELECT 'saida','Teste regra','Categoria anomalia',CASE WHEN n=0 THEN 20000 ELSE 10000 END,(date_trunc('month',current_date)-n*interval '1 month')::date FROM generate_series(0,3) n",
    );
    const ctx = {
      execucaoId: "1",
      chaveIdempotencia: "teste",
      tentativa: 1,
      config: {},
      signal: new AbortController().signal,
      verificarLease: async () => true,
    };
    await gestao.executar("atualizar_indicadores", ctx);
    await gestao.executar("calcular_dre", ctx);
    assert.ok((await pool.query("SELECT 1 FROM financeiro.indicadores_mensais")).rowCount);
    assert.ok((await pool.query("SELECT 1 FROM financeiro.dre_mensal")).rowCount);
    await gestao.executar("detectar_anomalias", ctx);
    await gestao.executar("detectar_anomalias", ctx);
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM financeiro.alertas WHERE chave LIKE 'anomalia:%:despesa:Categoria anomalia'",
        )
      ).rowCount,
      1,
    );
  });
});
