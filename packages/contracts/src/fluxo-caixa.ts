/**
 * Contrato do fluxo de caixa do setor Financeiro: lancamentos manuais (entradas e saidas) e
 * contas a pagar recorrentes (mensais), cujo pagamento vira uma saida vinculada a competencia.
 * Valores em centavos inteiros e sempre em BRL. Dias `YYYY-MM-DD` e meses `YYYY-MM` seguem o fuso
 * America/Sao_Paulo; instantes sao RFC 3339 em UTC. Ids sao texto (bigint no banco).
 */

export type TipoLancamento = "entrada" | "saida";

export const TIPOS_LANCAMENTO: readonly TipoLancamento[] = ["entrada", "saida"];

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valorCentavos: number;
  /** Dia em que o dinheiro entrou ou saiu (YYYY-MM-DD). */
  data: string;
  /** Preenchido quando o lancamento e o pagamento de uma conta recorrente. */
  contaRecorrenteId: string | null;
  /** Mes de referencia (YYYY-MM) do pagamento da conta recorrente. */
  competencia: string | null;
  criadoEm: string;
}

/** Lancamento do mes com o saldo acumulado logo apos ele (ordem: data, id). */
export interface MovimentoFluxo extends Lancamento {
  saldoAposCentavos: number;
}

export interface ContaRecorrente {
  id: string;
  descricao: string;
  categoria: string;
  /** Valor previsto de cada mes; o pagamento pode registrar outro valor (ex.: conta de luz). */
  valorCentavos: number;
  /** 1 a 31; em meses mais curtos vence no ultimo dia. */
  diaVencimento: number;
  /** Primeiro mes em que a conta vence (YYYY-MM). */
  inicio: string;
  /** Ultimo mes em que a conta vence (YYYY-MM); null = sem prazo. */
  fim: string | null;
  /** Falso quando a conta ja foi encerrada antes do mes corrente. */
  vigente: boolean;
}

export type StatusContaDoMes = "paga" | "pendente" | "atrasada";

/** Ocorrencia de uma conta recorrente no mes consultado. */
export interface ContaDoMes {
  contaId: string;
  descricao: string;
  categoria: string;
  valorPrevistoCentavos: number;
  vencimento: string;
  status: StatusContaDoMes;
  pagamento: { lancamentoId: string; data: string; valorCentavos: number } | null;
}

export interface ResumoFluxoCaixa {
  /** Saldo realizado acumulado ate o dia anterior ao mes. */
  saldoInicialCentavos: number;
  entradasCentavos: number;
  saidasCentavos: number;
  /** Saldo inicial + entradas - saidas realizadas no mes. */
  saldoFinalCentavos: number;
  /** Contas recorrentes do mes ainda nao pagas (pendentes e atrasadas). */
  aPagarCentavos: number;
  /** Saldo final menos o que falta pagar no mes. */
  saldoProjetadoCentavos: number;
}

export interface FluxoCaixaMes {
  mes: string;
  moeda: "BRL";
  /** Dia corrente no fuso do negocio, usado para marcar contas atrasadas. */
  hoje: string;
  resumo: ResumoFluxoCaixa;
  movimentos: MovimentoFluxo[];
  contasDoMes: ContaDoMes[];
  /** Todas as contas recorrentes cadastradas, vigentes primeiro. */
  contas: ContaRecorrente[];
  /** Categorias cadastradas, por tipo e nome. */
  categorias: Categoria[];
}

/**
 * Categoria de entrada ou saida. Lancamentos e contas guardam o nome (texto), para o historico nao
 * mudar se a categoria for excluida; novos registros so aceitam categorias cadastradas do mesmo tipo
 * (contas recorrentes sempre usam categorias de saida).
 */
export interface Categoria {
  id: string;
  tipo: TipoLancamento;
  nome: string;
}

export interface NovaCategoria {
  tipo: TipoLancamento;
  nome: string;
}

export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valorCentavos: number;
  data: string;
}

export interface NovaContaRecorrente {
  descricao: string;
  categoria: string;
  valorCentavos: number;
  diaVencimento: number;
  inicio: string;
  fim?: string | null;
}

export interface NovoPagamentoConta {
  competencia: string;
  data: string;
  valorCentavos: number;
}

export const FLUXO_CAIXA_PATH = "/v1/fluxo-caixa";
