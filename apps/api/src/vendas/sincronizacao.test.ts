import assert from "node:assert/strict";
import { test } from "node:test";
import { type Venda, STATUS_HOTMART } from "./dominio.js";
import { type HotmartClient, HotmartError } from "./hotmart-client.js";
import type { EstadoSincronizacaoBanco, RepositorioVendas } from "./repositorio.js";
import { SincronizacaoVendas } from "./sincronizacao.js";

const DIA = 86_400_000;
const AGORA = new Date("2026-11-01T12:00:00.000Z");

const venda = (transacao: string): Venda => ({
  transacao,
  produtoId: "1",
  produtoNome: "Curso",
  compradorId: "c",
  status: "APPROVED",
  grupo: "receita",
  pedidoEm: AGORA,
  aprovadoEm: null,
  valorCentavos: 100,
  taxaCentavos: 10,
  moeda: "BRL",
  pagamento: "PIX",
  parcelas: 1,
  assinatura: false,
  recorrencia: 0,
});

function repoFalso(inicial: Partial<EstadoSincronizacaoBanco> = {}, ocupado = false) {
  const estado: EstadoSincronizacaoBanco = {
    status: "nunca",
    ultimaTentativaEm: null,
    ultimoSucessoEm: null,
    ultimaReconciliacaoEm: null,
    vendasProcessadas: 0,
    mensagem: null,
    ...inicial,
  };
  const gravadas: string[] = [];
  const repo = {
    gravarVendas: async (vs: readonly Venda[]) => {
      gravadas.push(...vs.map((v) => v.transacao));
      return vs.length;
    },
    lerEstadoSincronizacao: async () => ({ ...estado }),
    salvarEstadoSincronizacao: async (p: Partial<EstadoSincronizacaoBanco>) => {
      Object.assign(estado, p);
    },
    comLockDeSincronizacao: async <T>(fn: () => Promise<T>) =>
      ocupado ? { ocupado: true as const } : { ocupado: false as const, valor: await fn() },
  } as unknown as RepositorioVendas;
  return { repo, estado, gravadas };
}

interface Consulta {
  de: Date;
  status: string;
}
function clienteFalso(comportamento: (status: string) => Venda[] | Error) {
  const consultas: Consulta[] = [];
  const cliente = {
    listarVendas: async (
      janela: { de: Date; ate: Date },
      status: string,
      _k: string,
      aoReceber: (v: Venda[]) => Promise<void>,
    ) => {
      consultas.push({ de: janela.de, status });
      const r = comportamento(status);
      if (r instanceof Error) throw r;
      if (r.length > 0) await aoReceber(r);
      return r.length;
    },
  } as unknown as HotmartClient;
  return { cliente, consultas };
}

const sync = (repo: RepositorioVendas, cliente: HotmartClient | undefined) =>
  new SincronizacaoVendas(repo, cliente, {
    backfillDias: 90,
    chavePseudonimo: "k",
    agora: () => AGORA,
  });

test("sem credenciais a verificacao fica desabilitada", async () => {
  const { repo } = repoFalso();
  assert.deepEqual(await sync(repo, undefined).executar(), { resultado: "desabilitada" });
});

test("primeira execucao carrega o backfill e consulta todos os status", async () => {
  const { repo, estado, gravadas } = repoFalso();
  const { cliente, consultas } = clienteFalso((s) => (s === "APPROVED" ? [venda("A")] : []));
  const r = await sync(repo, cliente).executar();

  assert.deepEqual(r, { resultado: "sucesso", processadas: 1, mensagem: null });
  assert.deepEqual(gravadas, ["A"]);
  assert.equal(consultas.length, STATUS_HOTMART.length);
  assert.ok(consultas.some((c) => c.status === "PRE_ORDER"));
  assert.ok(consultas.some((c) => c.status === "PROCESSING_TRANSACTION"));
  assert.ok(consultas.every((c) => c.status !== "DELAYED"));
  assert.equal(consultas[0]?.de.getTime(), AGORA.getTime() - 90 * DIA);
  assert.equal(estado.status, "sucesso");
  assert.equal(estado.ultimoSucessoEm?.getTime(), AGORA.getTime());
  assert.equal(estado.ultimaReconciliacaoEm?.getTime(), AGORA.getTime());
});

test("execucao incremental reconsulta so desde o ultimo sucesso menos 2 dias", async () => {
  const ultimo = new Date(AGORA.getTime() - 30 * 60_000);
  const { repo } = repoFalso({
    ultimoSucessoEm: ultimo,
    ultimaReconciliacaoEm: ultimo,
    status: "sucesso",
  });
  const { cliente, consultas } = clienteFalso(() => []);
  await sync(repo, cliente).executar();
  assert.equal(consultas[0]?.de.getTime(), ultimo.getTime() - 2 * DIA);
});

test("passado um dia, reconcilia 30 dias e atualiza a reconciliacao", async () => {
  const ontem = new Date(AGORA.getTime() - DIA - 1000);
  const { repo, estado } = repoFalso({
    ultimoSucessoEm: ontem,
    ultimaReconciliacaoEm: ontem,
    status: "sucesso",
  });
  const { cliente, consultas } = clienteFalso(() => []);
  await sync(repo, cliente).executar();
  assert.equal(consultas[0]?.de.getTime(), AGORA.getTime() - 30 * DIA);
  assert.equal(estado.ultimaReconciliacaoEm?.getTime(), AGORA.getTime());
});

test("falha parcial grava o que veio, nao avanca o ultimo sucesso e informa o codigo", async () => {
  const { repo, estado } = repoFalso();
  const { cliente } = clienteFalso((s) =>
    s === "APPROVED" ? [venda("A")] : s === "REFUNDED" ? new HotmartError("http", 400) : [],
  );
  const r = await sync(repo, cliente).executar();

  assert.equal(r.resultado, "parcial");
  assert.equal(estado.status, "parcial");
  assert.equal(estado.ultimoSucessoEm, null);
  assert.match(estado.mensagem ?? "", /hotmart: http \(http 400\)/);
});

test("falha de autenticacao interrompe as demais consultas", async () => {
  const { repo, estado } = repoFalso();
  const { cliente, consultas } = clienteFalso(() => new HotmartError("autenticacao", 401));
  const r = await sync(repo, cliente).executar();
  assert.equal(r.resultado, "falha");
  assert.equal(consultas.length, 1);
  assert.equal(estado.status, "falha");
});

test("outra instancia sincronizando => ocupada e nada consultado", async () => {
  const { repo } = repoFalso({}, true);
  const { cliente, consultas } = clienteFalso(() => []);
  assert.deepEqual(await sync(repo, cliente).executar(), { resultado: "ocupada" });
  assert.equal(consultas.length, 0);
});
