/**
 * Contrato do painel de vendas do setor Financeiro (dados vindos da Hotmart).
 * Valores monetarios trafegam em centavos inteiros (nunca float) e sempre com a moeda ISO 4217.
 * Datas de dia (`YYYY-MM-DD`) seguem o fuso America/Sao_Paulo; instantes sao RFC 3339 em UTC.
 */

/** Grupos em que cada status da Hotmart e classificado para os indicadores. */
export type GrupoStatusVenda = "receita" | "reembolso" | "cancelada" | "pendente";

export const GRUPOS_STATUS_VENDA: readonly GrupoStatusVenda[] = [
  "receita",
  "reembolso",
  "cancelada",
  "pendente",
];

export interface PeriodoVendas {
  /** Primeiro dia incluido (YYYY-MM-DD). */
  de: string;
  /** Ultimo dia incluido (YYYY-MM-DD). */
  ate: string;
}

export interface IndicadoresVendas {
  /** Soma das vendas aprovadas/completas. */
  receitaBrutaCentavos: number;
  /** Taxas da Hotmart sobre as vendas aprovadas/completas. */
  taxasCentavos: number;
  /** Receita bruta menos taxas (estimativa; nao considera coprodutores/afiliados). */
  receitaLiquidaCentavos: number;
  vendas: number;
  ticketMedioCentavos: number;
  compradoresUnicos: number;
  reembolsadoCentavos: number;
  reembolsos: number;
  /** Reembolsos / (vendas + reembolsos), entre 0 e 1. */
  taxaReembolso: number;
  /** Vendas de assinaturas dentro das vendas aprovadas. */
  vendasAssinatura: number;
}

export interface PontoSerieVendas {
  /** Dia (YYYY-MM-DD). */
  dia: string;
  receitaCentavos: number;
  vendas: number;
}

export interface VendasPorProduto {
  produtoId: string;
  produtoNome: string;
  receitaCentavos: number;
  vendas: number;
}

export interface VendasPorStatus {
  status: string;
  grupo: GrupoStatusVenda;
  vendas: number;
  valorCentavos: number;
}

export interface VendasPorPagamento {
  /** Tipo de pagamento informado pela Hotmart (ex.: CREDIT_CARD, PIX, BILLET). */
  tipo: string;
  vendas: number;
  receitaCentavos: number;
}

export type StatusSincronizacao = "nunca" | "sucesso" | "parcial" | "falha" | "em_andamento";

export interface EstadoSincronizacao {
  /** Falso quando as credenciais da Hotmart nao estao configuradas. */
  habilitada: boolean;
  intervaloMinutos: number;
  status: StatusSincronizacao;
  ultimaTentativaEm: string | null;
  ultimoSucessoEm: string | null;
  /** Vendas gravadas/atualizadas na ultima execucao. */
  ultimasVendasProcessadas: number;
  /** Mensagem fixa e sem dados sensiveis; null quando tudo correu bem. */
  mensagem: string | null;
}

export interface PainelVendas {
  periodo: PeriodoVendas;
  moeda: string;
  moedasDisponiveis: string[];
  produtos: { produtoId: string; produtoNome: string }[];
  indicadores: IndicadoresVendas;
  /** Mesmos indicadores no periodo imediatamente anterior, de igual duracao. */
  indicadoresAnteriores: IndicadoresVendas;
  serieDiaria: PontoSerieVendas[];
  porProduto: VendasPorProduto[];
  porStatus: VendasPorStatus[];
  porPagamento: VendasPorPagamento[];
  sincronizacao: EstadoSincronizacao;
}

export interface VendaResumo {
  transacao: string;
  produtoNome: string;
  /** Pseudonimo estavel do comprador; o e-mail nunca e armazenado nem exposto. */
  compradorId: string;
  status: string;
  grupo: GrupoStatusVenda;
  pedidoEm: string;
  valorCentavos: number;
  taxaCentavos: number;
  moeda: string;
  pagamento: string;
  parcelas: number;
  assinatura: boolean;
}

export interface ListaVendas {
  itens: VendaResumo[];
  total: number;
  limite: number;
  deslocamento: number;
}

export const VENDAS_PATH = "/v1/vendas";
