import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as acoes from "../lib/fluxo-caixa-acoes.ts";
import { carregarFluxo } from "../lib/fluxo-caixa-api.ts";
import {
  categoriaDoFormulario,
  contaDoFormulario,
  diaSugerido,
  formatarReais,
  idDoFormulario,
  lancamentoDoFormulario,
  lerValorEmCentavos,
  mesDaUrl,
  nomeDoMes,
  pagamentoDoFormulario,
  somarMeses,
} from "../lib/fluxo-caixa-formato.ts";

const form = (campos: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("formato do fluxo de caixa", () => {
  test("valor em reais vira centavos sem float", () => {
    const casos: [string, number | null][] = [
      ["1.234,56", 123_456],
      ["1234,56", 123_456],
      ["1234.56", 123_456],
      ["0.1", 10],
      ["10", 1_000],
      ["R$ 2.500", 250_000],
      ["1.000.000,00", 100_000_000],
      ["0,07", 7],
      ["0", null],
      ["-5", null],
      ["1,234", null],
      ["12.34.56", null],
      ["abc", null],
      ["", null],
      ["1000000001", null],
    ];
    for (const [entrada, esperado] of casos)
      assert.equal(lerValorEmCentavos(entrada), esperado, entrada);
  });

  test("meses: URL, navegacao e nome por extenso", () => {
    assert.equal(mesDaUrl({ mes: "2026-11" }), "2026-11");
    assert.equal(mesDaUrl({ mes: "2026-13" }), undefined);
    assert.equal(mesDaUrl({ mes: ["2026-11", "2026-10"] }), undefined);
    assert.equal(somarMeses("2026-01", -1), "2025-12");
    assert.equal(somarMeses("2026-12", 1), "2027-01");
    assert.equal(nomeDoMes("2026-11"), "novembro de 2026");
    assert.equal(diaSugerido("2026-11", "2026-11-15"), "2026-11-15");
    assert.equal(diaSugerido("2026-12", "2026-11-15"), "2026-12-01");
    assert.match(formatarReais(-123_456), /-R\$\s1\.234,56/);
  });

  test("formularios viram payloads tipados ou mensagem clara", () => {
    const l = lancamentoDoFormulario(
      form({
        tipo: "entrada",
        descricao: " Aporte ",
        categoria: "Socios",
        valor: "1500.00",
        data: "2026-11-02",
      }),
    );
    assert.deepEqual(l, {
      ok: true,
      valor: {
        tipo: "entrada",
        descricao: "Aporte",
        categoria: "Socios",
        valorCentavos: 150_000,
        data: "2026-11-02",
      },
    });
    assert.equal(lancamentoDoFormulario(form({ tipo: "x" })).ok, false);
    const semValor = lancamentoDoFormulario(
      form({ tipo: "saida", descricao: "a", categoria: "b", valor: "0", data: "2026-11-02" }),
    );
    assert.deepEqual(semValor, {
      ok: false,
      mensagem: "Informe um valor maior que zero, como 1.234,56.",
    });

    const conta = {
      descricao: "Aluguel",
      categoria: "Imovel",
      valor: "2000",
      diaVencimento: "31",
      inicio: "2026-11",
    };
    const c = contaDoFormulario(form({ ...conta, fim: "" }));
    assert.ok(c.ok && c.valor.fim === null && c.valor.diaVencimento === 31);
    assert.equal(contaDoFormulario(form({ ...conta, fim: "2026-10" })).ok, false);
    assert.equal(contaDoFormulario(form({ ...conta, diaVencimento: "32" })).ok, false);

    assert.ok(
      pagamentoDoFormulario(form({ competencia: "2026-11", data: "2026-11-10", valor: "99,90" }))
        .ok,
    );
    assert.equal(idDoFormulario(form({ id: "12" })), "12");
    assert.equal(idDoFormulario(form({ id: "../contas" })), null);
  });
});

describe("acoes e API do fluxo de caixa", () => {
  test("acao valida antes de chamar a API, usa bearer e devolve so mensagem fixa", async (t) => {
    const original = { ...process.env };
    process.env["VENDAS_API_KEY"] = "sentinela-web";
    delete process.env["VENDAS_API_KEY_FILE"];
    const chamadas: { url: string; init: RequestInit }[] = [];
    let status = 201;
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response(status === 204 ? null : JSON.stringify({ detalhe: "interno-secreto" }), {
        status,
      });
    });
    try {
      const invalida = await acoes.criarLancamento(form({ tipo: "saida" }));
      assert.equal(invalida.erro, true);
      assert.equal(chamadas.length, 0);

      const ok = await acoes.criarLancamento(
        form({
          tipo: "saida",
          descricao: "Material",
          categoria: "Escritorio",
          valor: "19,90",
          data: "2026-11-02",
        }),
      );
      assert.deepEqual(ok, { erro: false, mensagem: "Saída registrada." });
      const [primeira] = chamadas;
      assert.equal(primeira?.url, "http://127.0.0.1:3001/v1/fluxo-caixa/lancamentos");
      assert.equal(new Headers(primeira.init.headers).get("authorization"), "Bearer sentinela-web");
      assert.deepEqual(JSON.parse(primeira.init.body as string), {
        tipo: "saida",
        descricao: "Material",
        categoria: "Escritorio",
        valorCentavos: 1_990,
        data: "2026-11-02",
      });

      status = 409;
      const dup = await acoes.pagarConta(
        form({ id: "7", competencia: "2026-11", data: "2026-11-10", valor: "10" }),
      );
      assert.deepEqual(dup, { erro: true, mensagem: "Esta conta já está paga neste mês." });
      assert.ok(!JSON.stringify(dup).includes("interno-secreto"));

      status = 204;
      assert.equal((await acoes.excluirLancamento(form({ id: "abc" }))).erro, true);
      assert.equal(chamadas.length, 2); // id invalido nem chega a API
      assert.deepEqual(await acoes.excluirLancamento(form({ id: "3" })), {
        erro: false,
        mensagem: "Lançamento excluído.",
      });
      assert.equal(chamadas.at(-1)?.init.method, "DELETE");
    } finally {
      process.env = original;
    }
  });

  test("categorias: formulario validado e duplicada com mensagem propria", async (t) => {
    assert.deepEqual(categoriaDoFormulario(form({ tipo: "entrada", nome: " Vendas " })), {
      ok: true,
      valor: { tipo: "entrada", nome: "Vendas" },
    });
    assert.equal(categoriaDoFormulario(form({ tipo: "x", nome: "a" })).ok, false);
    assert.equal(categoriaDoFormulario(form({ tipo: "saida", nome: "" })).ok, false);

    const original = { ...process.env };
    process.env["VENDAS_API_KEY"] = "sentinela-web";
    delete process.env["VENDAS_API_KEY_FILE"];
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string) => {
      urls.push(url);
      return new Response("{}", { status: 409 });
    });
    try {
      assert.deepEqual(await acoes.criarCategoria(form({ tipo: "saida", nome: "Aluguel" })), {
        erro: true,
        mensagem: "Já existe uma categoria com esse nome para esse tipo.",
      });
      assert.equal((await acoes.excluirCategoria(form({ id: "x" }))).erro, true);
      assert.deepEqual(urls, ["http://127.0.0.1:3001/v1/fluxo-caixa/categorias"]);
    } finally {
      process.env = original;
    }
  });

  test("carregarFluxo: 404 vira modulo desligado e sem chave nao chama a API", async (t) => {
    const original = { ...process.env };
    delete process.env["VENDAS_API_KEY"];
    delete process.env["VENDAS_API_KEY_FILE"];
    let chamadas = 0;
    t.mock.method(globalThis, "fetch", async () => {
      chamadas++;
      return new Response("{}", { status: 404 });
    });
    try {
      assert.deepEqual(await carregarFluxo(undefined), { tipo: "nao-configurado" });
      process.env["VENDAS_API_KEY"] = "sentinela-web";
      assert.deepEqual(await carregarFluxo("2026-11"), { tipo: "erro", falha: "modulo-desligado" });
      assert.equal(chamadas, 1);
    } finally {
      process.env = original;
    }
  });
});
