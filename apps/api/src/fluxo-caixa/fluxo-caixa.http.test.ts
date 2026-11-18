import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Secret } from "@nucleos/config";
import type {
  Categoria,
  FluxoCaixaMes,
  Lancamento,
  NovaCategoria,
  NovaContaRecorrente,
  TipoLancamento,
} from "@nucleos/contracts";
import { AppModule } from "../app.module.js";
import type { ContaRecorrenteBanco } from "./dominio.js";
import { FluxoCaixaModule } from "./fluxo-caixa.module.js";
import {
  CategoriaDuplicada,
  ContaComLancamentos,
  LancamentoVinculado,
  type NovoLancamentoBanco,
  PagamentoDuplicado,
  type RepositorioFluxoCaixa,
} from "./repositorio.js";

const CHAVE = "chave-de-teste-sentinela";
const AGORA = new Date("2026-11-15T15:00:00Z");

/** Repositorio em memoria com as mesmas restricoes do banco (indice unico e FK RESTRICT). */
class RepositorioMemoria implements RepositorioFluxoCaixa {
  lancamentos: Lancamento[] = [];
  contas: ContaRecorrenteBanco[] = [];
  categorias: Categoria[] = [
    { id: "c1", tipo: "entrada", nome: "Socios" },
    { id: "c2", tipo: "saida", nome: "Escritorio" },
    { id: "c3", tipo: "saida", nome: "Imovel" },
    { id: "c4", tipo: "saida", nome: "Outros" },
  ];
  #seq = 0;

  #id(): string {
    this.#seq += 1;
    return String(this.#seq);
  }

  async saldoAntesDe(dia: string): Promise<number> {
    return this.lancamentos
      .filter((l) => l.data < dia)
      .reduce((t, l) => t + (l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos), 0);
  }
  async lancamentosEntre(de: string, ate: string): Promise<Lancamento[]> {
    return this.lancamentos.filter((l) => l.data >= de && l.data <= ate);
  }
  async pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]> {
    return this.lancamentos.filter((l) => l.competencia === competencia);
  }
  async listarContas(): Promise<ContaRecorrenteBanco[]> {
    return [...this.contas];
  }
  async obterConta(id: string): Promise<ContaRecorrenteBanco | null> {
    return this.contas.find((c) => c.id === id) ?? null;
  }
  async ultimaCompetenciaPaga(contaId: string): Promise<string | null> {
    const meses = this.lancamentos
      .filter((l) => l.contaRecorrenteId === contaId)
      .map((l) => l.competencia ?? "")
      .sort();
    return meses.at(-1) ?? null;
  }
  async inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento> {
    if (
      novo.contaRecorrenteId !== undefined &&
      this.lancamentos.some(
        (l) => l.contaRecorrenteId === novo.contaRecorrenteId && l.competencia === novo.competencia,
      )
    ) {
      throw new PagamentoDuplicado();
    }
    const l: Lancamento = {
      id: this.#id(),
      tipo: novo.tipo,
      descricao: novo.descricao,
      categoria: novo.categoria,
      valorCentavos: novo.valorCentavos,
      data: novo.data,
      contaRecorrenteId: novo.contaRecorrenteId ?? null,
      competencia: novo.competencia ?? null,
      criadoEm: AGORA.toISOString(),
    };
    this.lancamentos.push(l);
    return l;
  }
  async excluirLancamento(id: string): Promise<boolean> {
    const antes = this.lancamentos.length;
    this.lancamentos = this.lancamentos.filter((l) => l.id !== id);
    return this.lancamentos.length < antes;
  }
  async inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco> {
    const c = { ...nova, fim: nova.fim ?? null, id: this.#id() };
    this.contas.push(c);
    return c;
  }
  async definirFimConta(id: string, fim: string | null): Promise<boolean> {
    const c = this.contas.find((x) => x.id === id);
    if (c === undefined) return false;
    c.fim = fim;
    return true;
  }
  async excluirConta(id: string): Promise<boolean> {
    if (this.lancamentos.some((l) => l.contaRecorrenteId === id)) throw new ContaComLancamentos();
    const antes = this.contas.length;
    this.contas = this.contas.filter((c) => c.id !== id);
    return this.contas.length < antes;
  }
  async listarCategorias(): Promise<Categoria[]> {
    return [...this.categorias];
  }
  async nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null> {
    const igual = (c: Categoria): boolean =>
      c.tipo === tipo && c.nome.toLowerCase() === nome.toLowerCase();
    return this.categorias.find(igual)?.nome ?? null;
  }
  async inserirCategoria(nova: NovaCategoria): Promise<Categoria> {
    if ((await this.nomeDaCategoria(nova.tipo, nova.nome)) !== null) throw new CategoriaDuplicada();
    const c = { ...nova, id: this.#id() };
    this.categorias.push(c);
    return c;
  }
  async excluirCategoria(id: string): Promise<boolean> {
    const antes = this.categorias.length;
    this.categorias = this.categorias.filter((c) => c.id !== id);
    return this.categorias.length < antes;
  }
}

async function subir(
  apiKey: Secret | undefined,
  repo = new RepositorioMemoria(),
): Promise<{ app: INestApplication; base: string }> {
  const app = await NestFactory.create(
    AppModule.comModulos([
      FluxoCaixaModule.registrar({ apiKey, repositorio: repo, agora: () => AGORA }),
    ]),
    { logger: false },
  );
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  return { app, base: url.replace("[::1]", "127.0.0.1") };
}

const auth = { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" };

describe("API de fluxo de caixa (HTTP)", () => {
  let app: INestApplication;
  let base: string;
  let repo: RepositorioMemoria;

  before(async () => {
    repo = new RepositorioMemoria();
    ({ app, base } = await subir(new Secret(CHAVE), repo));
  });
  after(async () => app.close());

  const enviar = (caminho: string, corpo?: unknown, method = "POST") =>
    fetch(`${base}/v1/fluxo-caixa${caminho}`, {
      method,
      headers: auth,
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });

  const mes = async (q = ""): Promise<FluxoCaixaMes> => {
    const r = await fetch(`${base}/v1/fluxo-caixa${q}`, { headers: auth });
    assert.equal(r.status, 200);
    return (await r.json()) as FluxoCaixaMes;
  };

  test("sem bearer ou com bearer errado => 401, sem vazar a chave", async () => {
    for (const headers of [{}, { authorization: "Bearer errada" }]) {
      const r = await fetch(`${base}/v1/fluxo-caixa`, { headers });
      assert.equal(r.status, 401);
      assert.doesNotMatch(await r.text(), new RegExp(CHAVE));
    }
    const post = await fetch(`${base}/v1/fluxo-caixa/lancamentos`, { method: "POST" });
    assert.equal(post.status, 401);
  });

  test("mes padrao e o corrente em Sao Paulo; mes invalido => 400", async () => {
    const f = await mes();
    assert.equal(f.mes, "2026-11");
    assert.equal(f.hoje, "2026-11-15");
    for (const q of ["?mes=2026-13", "?mes=nov", "?mes=2026-11&mes=2026-10"]) {
      assert.equal((await fetch(`${base}/v1/fluxo-caixa${q}`, { headers: auth })).status, 400, q);
    }
  });

  test("exclusao de lancamento vinculado responde conflito sem expor detalhe interno", async () => {
    const excluir = repo.excluirLancamento.bind(repo);
    repo.excluirLancamento = async () => {
      throw new LancamentoVinculado("detalhe-interno");
    };
    try {
      const r = await enviar("/lancamentos/123", undefined, "DELETE");
      assert.equal(r.status, 409);
      assert.doesNotMatch(await r.text(), /detalhe-interno/);
    } finally {
      repo.excluirLancamento = excluir;
    }
  });

  test("lancamentos manuais entram no fluxo e podem ser excluidos", async () => {
    const r = await enviar("/lancamentos", {
      tipo: "entrada",
      descricao: "Aporte",
      categoria: "Socios",
      valorCentavos: 500_000,
      data: "2026-10-30",
    });
    assert.equal(r.status, 201);
    const saida = (await (
      await enviar("/lancamentos", {
        tipo: "saida",
        descricao: "Material",
        categoria: "Escritorio",
        valorCentavos: 12_000,
        data: "2026-11-03",
      })
    ).json()) as Lancamento;
    const f = await mes("?mes=2026-11");
    assert.equal(f.resumo.saldoInicialCentavos, 500_000);
    assert.equal(f.resumo.saidasCentavos, 12_000);
    assert.equal(f.resumo.saldoFinalCentavos, 488_000);

    assert.equal((await enviar(`/lancamentos/${saida.id}`, undefined, "DELETE")).status, 204);
    assert.equal((await enviar(`/lancamentos/${saida.id}`, undefined, "DELETE")).status, 404);
    assert.equal((await enviar("/lancamentos/abc", undefined, "DELETE")).status, 404);
  });

  test("corpo invalido => 400 sem eco do valor enviado", async () => {
    const r = await enviar("/lancamentos", {
      tipo: "saida",
      descricao: "<script>drop</script>",
      categoria: "x",
      valorCentavos: -5,
      data: "2026-11-03",
    });
    assert.equal(r.status, 400);
    assert.doesNotMatch(await r.text(), /script|drop/);
    assert.equal((await enviar("/contas", { descricao: "x" })).status, 400);
  });

  test("conta recorrente: paga uma vez por competencia, encerra e nao exclui com pagamento", async () => {
    const criada = await enviar("/contas", {
      descricao: "Aluguel",
      categoria: "Imovel",
      valorCentavos: 200_000,
      diaVencimento: 10,
      inicio: "2026-09",
    });
    assert.equal(criada.status, 201);
    const { id } = (await criada.json()) as { id: string };

    let f = await mes("?mes=2026-11");
    assert.equal(f.contasDoMes[0]?.status, "atrasada");
    assert.equal(f.resumo.aPagarCentavos, 200_000);

    const pagamento = { competencia: "2026-11", data: "2026-11-15", valorCentavos: 210_000 };
    assert.equal((await enviar(`/contas/${id}/pagamentos`, pagamento)).status, 201);
    assert.equal((await enviar(`/contas/${id}/pagamentos`, pagamento)).status, 409);
    const fora = { ...pagamento, competencia: "2026-08" };
    assert.equal((await enviar(`/contas/${id}/pagamentos`, fora)).status, 400);
    assert.equal((await enviar(`/contas/999/pagamentos`, pagamento)).status, 404);

    f = await mes("?mes=2026-11");
    assert.equal(f.contasDoMes[0]?.status, "paga");
    assert.equal(f.contasDoMes[0].pagamento?.valorCentavos, 210_000);
    assert.equal(f.resumo.aPagarCentavos, 0);

    // Encerrar antes do ultimo mes pago e conflito; o padrao (mes corrente) funciona.
    const cedo = await enviar(`/contas/${id}/encerrar`, { ultimoMes: "2026-10" });
    assert.equal(cedo.status, 409);
    assert.equal((await enviar(`/contas/${id}/encerrar`, {})).status, 204);
    assert.equal(repo.contas[0]?.fim, "2026-11");
    assert.equal((await mes("?mes=2026-12")).contasDoMes.length, 0);

    assert.equal((await enviar(`/contas/${id}/reativar`)).status, 204);
    assert.equal(repo.contas[0].fim, null);
    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 409);
  });

  test("categorias: cadastro, duplicidade sem diferenciar maiusculas e tipo conferido", async () => {
    const r = await enviar("/categorias", { tipo: "entrada", nome: " Vendas " });
    assert.equal(r.status, 201);
    const vendas = (await r.json()) as Categoria;
    assert.equal(vendas.nome, "Vendas");
    assert.equal((await enviar("/categorias", { tipo: "entrada", nome: "VENDAS" })).status, 409);
    // Mesmo nome em outro tipo e permitido.
    assert.equal((await enviar("/categorias", { tipo: "saida", nome: "Vendas" })).status, 201);
    assert.equal((await enviar("/categorias", { tipo: "transf", nome: "x" })).status, 400);
    assert.ok((await mes()).categorias.some((c) => c.id === vendas.id));

    const lancamento = {
      tipo: "saida",
      descricao: "Compra",
      valorCentavos: 100,
      data: "2026-11-03",
    };
    // Categoria de entrada numa saida, ou inexistente: recusado.
    assert.equal(
      (await enviar("/lancamentos", { ...lancamento, categoria: "Socios" })).status,
      400,
    );
    assert.equal((await enviar("/lancamentos", { ...lancamento, categoria: "Nada" })).status, 400);
    // Grafia diferente vira a grafia do cadastro.
    const ok = await enviar("/lancamentos", { ...lancamento, categoria: "escritorio" });
    assert.equal(((await ok.json()) as Lancamento).categoria, "Escritorio");
    // Conta recorrente so aceita categoria de saida.
    const conta = { descricao: "X", valorCentavos: 1, diaVencimento: 1, inicio: "2026-11" };
    assert.equal((await enviar("/contas", { ...conta, categoria: "Socios" })).status, 400);

    assert.equal((await enviar(`/categorias/${vendas.id}`, undefined, "DELETE")).status, 204);
    assert.equal((await enviar(`/categorias/${vendas.id}`, undefined, "DELETE")).status, 404);
  });

  test("conta sem pagamento pode ser excluida", async () => {
    const r = await enviar("/contas", {
      descricao: "Teste",
      categoria: "Outros",
      valorCentavos: 100,
      diaVencimento: 1,
      inicio: "2027-01",
    });
    const { id } = (await r.json()) as { id: string };
    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 204);
    assert.equal((await enviar(`/contas/${id}`, undefined, "DELETE")).status, 404);
  });
});

test("sem chave de servico configurada as rotas fecham com 503", async () => {
  const { app, base } = await subir(undefined);
  try {
    const r = await fetch(`${base}/v1/fluxo-caixa`, {
      headers: { authorization: `Bearer ${CHAVE}` },
    });
    assert.equal(r.status, 503);
  } finally {
    await app.close();
  }
});
