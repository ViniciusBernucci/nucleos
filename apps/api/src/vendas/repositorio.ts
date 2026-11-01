import type {
  GrupoStatusVenda,
  IndicadoresVendas,
  PontoSerieVendas,
  StatusSincronizacao,
  VendaResumo,
  VendasPorPagamento,
  VendasPorProduto,
  VendasPorStatus,
} from "@nucleos/contracts";
import type { Venda } from "./dominio.js";

export const REPOSITORIO_VENDAS = Symbol("REPOSITORIO_VENDAS");

export interface FiltroVendas {
  /** Primeiro dia incluido (YYYY-MM-DD, fuso America/Sao_Paulo). */
  de: string;
  /** Ultimo dia incluido (YYYY-MM-DD). */
  ate: string;
  moeda: string;
  produtoId?: string;
}

export interface EstadoSincronizacaoBanco {
  status: StatusSincronizacao;
  ultimaTentativaEm: Date | null;
  ultimoSucessoEm: Date | null;
  ultimaReconciliacaoEm: Date | null;
  vendasProcessadas: number;
  mensagem: string | null;
}

export interface AgregadosVendas {
  indicadores: IndicadoresVendas;
  /** Apenas dias com movimento; o preenchimento dos demais e feito na camada de servico. */
  serieDiaria: PontoSerieVendas[];
  porProduto: VendasPorProduto[];
  porStatus: VendasPorStatus[];
  porPagamento: VendasPorPagamento[];
}

export type ResultadoComLock<T> = { ocupado: true } | { ocupado: false; valor: T };

export interface RepositorioVendas {
  /** Insere ou atualiza por `transacao` (idempotente). Devolve quantas linhas foram processadas. */
  gravarVendas(vendas: readonly Venda[]): Promise<number>;
  lerEstadoSincronizacao(): Promise<EstadoSincronizacaoBanco>;
  salvarEstadoSincronizacao(parcial: Partial<EstadoSincronizacaoBanco>): Promise<void>;
  /** Executa `fn` somente se nenhuma outra instancia estiver sincronizando (lock consultivo). */
  comLockDeSincronizacao<T>(fn: () => Promise<T>): Promise<ResultadoComLock<T>>;

  agregados(filtro: FiltroVendas): Promise<AgregadosVendas>;
  indicadores(filtro: FiltroVendas): Promise<IndicadoresVendas>;
  moedasDisponiveis(): Promise<string[]>;
  produtosDisponiveis(): Promise<{ produtoId: string; produtoNome: string }[]>;
  listar(
    filtro: FiltroVendas,
    limite: number,
    deslocamento: number,
  ): Promise<{ itens: VendaResumo[]; total: number }>;
}

export type { GrupoStatusVenda };
