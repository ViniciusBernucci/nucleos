import type {
  Categoria,
  ContaDoMes,
  ContaRecorrente,
  FluxoCaixaMes,
  Lancamento,
  MovimentoFluxo,
} from "@nucleos/contracts";
import { vencimentoNoMes } from "./calendario.js";

/** Conta recorrente como guardada no banco (meses ja convertidos para `YYYY-MM`). */
export type ContaRecorrenteBanco = Omit<ContaRecorrente, "vigente">;

/** A conta vence no mes quando o mes esta entre `inicio` e `fim` (inclusive). */
export function venceNoMes(conta: ContaRecorrenteBanco, mes: string): boolean {
  return conta.inicio <= mes && (conta.fim === null || mes <= conta.fim);
}

export function contaVigente(conta: ContaRecorrenteBanco, mesCorrente: string): boolean {
  return conta.fim === null || conta.fim >= mesCorrente;
}

const sinal = (l: Lancamento): number =>
  l.tipo === "entrada" ? l.valorCentavos : -l.valorCentavos;

const porDataEId = (a: Lancamento, b: Lancamento): number =>
  a.data === b.data ? Number(a.id) - Number(b.id) : a.data < b.data ? -1 : 1;

export interface DadosFluxo {
  mes: string;
  hoje: string;
  saldoInicialCentavos: number;
  /** Lancamentos com `data` dentro do mes. */
  lancamentosDoMes: readonly Lancamento[];
  /** Pagamentos de contas recorrentes cuja competencia e o mes (podem ter data em outro mes). */
  pagamentosDaCompetencia: readonly Lancamento[];
  contas: readonly ContaRecorrenteBanco[];
  categorias: readonly Categoria[];
}

/** Monta a visao do mes sem tocar em banco: saldo corrido, contas do mes e projecao. */
export function montarFluxo(d: DadosFluxo): FluxoCaixaMes {
  let saldo = d.saldoInicialCentavos;
  let entradas = 0;
  let saidas = 0;
  const movimentos: MovimentoFluxo[] = [...d.lancamentosDoMes].sort(porDataEId).map((l) => {
    saldo += sinal(l);
    if (l.tipo === "entrada") entradas += l.valorCentavos;
    else saidas += l.valorCentavos;
    return { ...l, saldoAposCentavos: saldo };
  });

  const pagamentos = new Map(d.pagamentosDaCompetencia.map((p) => [p.contaRecorrenteId, p]));
  const contasDoMes: ContaDoMes[] = d.contas
    .filter((c) => venceNoMes(c, d.mes))
    .map((c) => {
      const vencimento = vencimentoNoMes(d.mes, c.diaVencimento);
      const p = pagamentos.get(c.id);
      return {
        contaId: c.id,
        descricao: c.descricao,
        categoria: c.categoria,
        valorPrevistoCentavos: c.valorCentavos,
        vencimento,
        status: p !== undefined ? "paga" : vencimento < d.hoje ? "atrasada" : "pendente",
        pagamento:
          p === undefined
            ? null
            : { lancamentoId: p.id, data: p.data, valorCentavos: p.valorCentavos },
      } satisfies ContaDoMes;
    })
    .sort((a, b) =>
      a.vencimento === b.vencimento
        ? a.descricao.localeCompare(b.descricao, "pt-BR")
        : a.vencimento < b.vencimento
          ? -1
          : 1,
    );

  const aPagar = contasDoMes
    .filter((c) => c.status !== "paga")
    .reduce((t, c) => t + c.valorPrevistoCentavos, 0);
  const mesCorrente = d.hoje.slice(0, 7);
  const contas: ContaRecorrente[] = d.contas
    .map((c) => ({ ...c, vigente: contaVigente(c, mesCorrente) }))
    .sort((a, b) =>
      a.vigente === b.vigente
        ? a.descricao.localeCompare(b.descricao, "pt-BR")
        : a.vigente
          ? -1
          : 1,
    );

  return {
    mes: d.mes,
    moeda: "BRL",
    hoje: d.hoje,
    resumo: {
      saldoInicialCentavos: d.saldoInicialCentavos,
      entradasCentavos: entradas,
      saidasCentavos: saidas,
      saldoFinalCentavos: saldo,
      aPagarCentavos: aPagar,
      saldoProjetadoCentavos: saldo - aPagar,
    },
    movimentos,
    contasDoMes,
    contas,
    categorias: [...d.categorias].sort((a, b) =>
      a.tipo === b.tipo ? a.nome.localeCompare(b.nome, "pt-BR") : a.tipo === "entrada" ? -1 : 1,
    ),
  };
}
