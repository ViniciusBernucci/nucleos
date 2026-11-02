import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Lancamento } from "@nucleos/contracts";
import {
  diaValido,
  diasNoMes,
  mesAtual,
  mesValido,
  somarMeses,
  ultimoDia,
  vencimentoNoMes,
} from "./calendario.js";
import { type ContaRecorrenteBanco, montarFluxo, venceNoMes } from "./dominio.js";
import {
  idValido,
  validarEncerramento,
  validarNovaConta,
  validarNovoLancamento,
  validarPagamento,
} from "./validacao.js";

const lanc = (id: string, p: Partial<Lancamento> = {}): Lancamento => ({
  id,
  tipo: "entrada",
  descricao: "Venda balcao",
  categoria: "Vendas",
  valorCentavos: 10_000,
  data: "2026-11-05",
  contaRecorrenteId: null,
  competencia: null,
  criadoEm: "2026-11-05T12:00:00.000Z",
  ...p,
});

const conta = (id: string, p: Partial<ContaRecorrenteBanco> = {}): ContaRecorrenteBanco => ({
  id,
  descricao: "Aluguel",
  categoria: "Imovel",
  valorCentavos: 200_000,
  diaVencimento: 10,
  inicio: "2026-01",
  fim: null,
  ...p,
});

describe("calendario", () => {
  test("meses e dias validos dentro da faixa de anos", () => {
    assert.ok(mesValido("2026-11"));
    for (const m of ["2026-13", "2026-1", "1999-12", "2101-01", "2026-00", "abc"]) {
      assert.equal(mesValido(m), false, m);
    }
    assert.ok(diaValido("2028-02-29"));
    assert.equal(diaValido("2026-02-29"), false);
    assert.equal(diaValido("0202-01-01"), false);
  });

  test("vencimento cai no ultimo dia em meses curtos", () => {
    assert.equal(diasNoMes("2026-02"), 28);
    assert.equal(diasNoMes("2028-02"), 29);
    assert.equal(ultimoDia("2026-04"), "2026-04-30");
    assert.equal(vencimentoNoMes("2026-04", 31), "2026-04-30");
    assert.equal(vencimentoNoMes("2026-02", 30), "2026-02-28");
    assert.equal(vencimentoNoMes("2026-11", 5), "2026-11-05");
  });

  test("somarMeses atravessa o ano nos dois sentidos", () => {
    assert.equal(somarMeses("2026-12", 1), "2027-01");
    assert.equal(somarMeses("2026-01", -1), "2025-12");
    assert.equal(somarMeses("2026-06", -18), "2024-12");
  });

  test("mes atual usa o fuso de Sao Paulo", () => {
    // 01/12 02:00 UTC ainda e 30/11 23:00 em Sao Paulo.
    assert.equal(mesAtual(new Date("2026-12-01T02:00:00Z")), "2026-11");
  });
});

describe("montarFluxo", () => {
  test("saldo corrido, totais e projecao descontando contas pendentes", () => {
    const pagamentoAluguel = lanc("3", {
      tipo: "saida",
      descricao: "Aluguel",
      valorCentavos: 200_000,
      data: "2026-11-09",
      contaRecorrenteId: "1",
      competencia: "2026-11",
    });
    const f = montarFluxo({
      mes: "2026-11",
      hoje: "2026-11-15",
      saldoInicialCentavos: 50_000,
      lancamentosDoMes: [
        lanc("2", { tipo: "saida", valorCentavos: 3_000, data: "2026-11-05" }),
        pagamentoAluguel,
        lanc("1", { valorCentavos: 300_000, data: "2026-11-05" }),
      ],
      pagamentosDaCompetencia: [pagamentoAluguel],
      contas: [
        conta("1"),
        conta("2", { descricao: "Internet", valorCentavos: 15_000, diaVencimento: 12 }),
        conta("3", { descricao: "Contador", valorCentavos: 80_000, diaVencimento: 31 }),
        conta("4", { descricao: "Antiga", fim: "2026-10" }),
        conta("5", { descricao: "Futura", inicio: "2027-01" }),
      ],
      categorias: [
        { id: "1", tipo: "saida", nome: "Impostos" },
        { id: "2", tipo: "entrada", nome: "Vendas" },
        { id: "3", tipo: "saida", nome: "Água" },
      ],
    });
    // Entradas primeiro; dentro do tipo, ordem alfabetica pt-BR (acento nao vai para o fim).
    assert.deepEqual(
      f.categorias.map((c) => c.nome),
      ["Vendas", "Água", "Impostos"],
    );
    assert.deepEqual(
      f.movimentos.map((m) => [m.id, m.saldoAposCentavos]),
      [
        ["1", 350_000],
        ["2", 347_000],
        ["3", 147_000],
      ],
    );
    assert.deepEqual(f.resumo, {
      saldoInicialCentavos: 50_000,
      entradasCentavos: 300_000,
      saidasCentavos: 203_000,
      saldoFinalCentavos: 147_000,
      aPagarCentavos: 95_000,
      saldoProjetadoCentavos: 52_000,
    });
    assert.deepEqual(
      f.contasDoMes.map((c) => [c.descricao, c.vencimento, c.status]),
      [
        ["Aluguel", "2026-11-10", "paga"],
        ["Internet", "2026-11-12", "atrasada"],
        ["Contador", "2026-11-30", "pendente"],
      ],
    );
    assert.equal(f.contasDoMes[0]?.pagamento?.lancamentoId, "3");
    assert.deepEqual(
      f.contas.map((c) => [c.descricao, c.vigente]),
      [
        ["Aluguel", true],
        ["Contador", true],
        ["Futura", true],
        ["Internet", true],
        ["Antiga", false],
      ],
    );
  });

  test("mes sem movimento mantem o saldo inicial", () => {
    const f = montarFluxo({
      mes: "2026-11",
      hoje: "2026-11-01",
      saldoInicialCentavos: -1_000,
      lancamentosDoMes: [],
      pagamentosDaCompetencia: [],
      contas: [],
      categorias: [],
    });
    assert.equal(f.resumo.saldoFinalCentavos, -1_000);
    assert.equal(f.resumo.saldoProjetadoCentavos, -1_000);
    assert.equal(f.moeda, "BRL");
  });

  test("vigencia da conta e inclusiva nas duas pontas", () => {
    const c = conta("1", { inicio: "2026-03", fim: "2026-05" });
    assert.deepEqual(
      ["2026-02", "2026-03", "2026-05", "2026-06"].map((m) => venceNoMes(c, m)),
      [false, true, true, false],
    );
  });
});

describe("validacao", () => {
  const base = {
    tipo: "saida",
    descricao: "  Material  ",
    categoria: "Escritorio",
    valorCentavos: 1_990,
    data: "2026-11-02",
  };

  test("lancamento valido e normalizado (trim)", () => {
    const r = validarNovoLancamento(base);
    assert.ok(r.ok);
    assert.equal(r.valor.descricao, "Material");
  });

  test("lancamento rejeita tipos, valores e campos estranhos", () => {
    const ruins: unknown[] = [
      null,
      [],
      "texto",
      { ...base, tipo: "transferencia" },
      { ...base, valorCentavos: 0 },
      { ...base, valorCentavos: 10.5 },
      { ...base, valorCentavos: "1990" },
      { ...base, valorCentavos: 100_000_000_001 },
      { ...base, data: "02/11/2026" },
      { ...base, data: "2026-02-30" },
      { ...base, descricao: "   " },
      { ...base, descricao: "a".repeat(121) },
      { ...base, descricao: "linha\nquebrada" },
      { ...base, extra: true },
    ];
    for (const c of ruins) assert.equal(validarNovoLancamento(c).ok, false, JSON.stringify(c));
  });

  test("conta recorrente: dia 1..31, meses AAAA-MM e fim nao anterior ao inicio", () => {
    const conta = {
      descricao: "Aluguel",
      categoria: "Imovel",
      valorCentavos: 200_000,
      diaVencimento: 31,
      inicio: "2026-11",
    };
    const ok = validarNovaConta(conta);
    assert.ok(ok.ok);
    assert.equal(ok.valor.fim, null);
    assert.ok(validarNovaConta({ ...conta, fim: "2026-11" }).ok);
    for (const c of [
      { ...conta, diaVencimento: 0 },
      { ...conta, diaVencimento: 32 },
      { ...conta, inicio: "2026-11-01" },
      { ...conta, fim: "2026-10" },
    ]) {
      assert.equal(validarNovaConta(c).ok, false, JSON.stringify(c));
    }
  });

  test("pagamento, encerramento e ids", () => {
    assert.ok(
      validarPagamento({ competencia: "2026-11", data: "2026-11-10", valorCentavos: 1 }).ok,
    );
    assert.equal(validarPagamento({ competencia: "2026-11", data: "2026-11-10" }).ok, false);
    assert.deepEqual(validarEncerramento(undefined), { ok: true, valor: { ultimoMes: undefined } });
    assert.equal(validarEncerramento({ ultimoMes: "nov" }).ok, false);
    assert.ok(idValido("42"));
    for (const v of ["0", "-1", "01", "1e3", "abc", "1".repeat(19)])
      assert.equal(idValido(v), false);
  });
});
