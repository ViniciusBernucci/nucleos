import type {
  Categoria,
  Lancamento,
  NovaCategoria,
  NovaContaRecorrente,
  NovoLancamento,
  TipoLancamento,
} from "@nucleos/contracts";
import type { ContaRecorrenteBanco } from "./dominio.js";

export const REPOSITORIO_FLUXO_CAIXA = Symbol("REPOSITORIO_FLUXO_CAIXA");

/** A conta ja tem pagamento para a competencia (indice unico parcial no banco). */
export class PagamentoDuplicado extends Error {}

/** A conta tem lancamentos vinculados e nao pode ser apagada (FK com ON DELETE RESTRICT). */
export class ContaComLancamentos extends Error {}

/** Excluir isoladamente quebraria uma transferencia ou conciliacao aceita. */
export class LancamentoVinculado extends Error {}

/** Ja existe categoria com esse nome (sem diferenciar maiusculas) para o tipo. */
export class CategoriaDuplicada extends Error {}

export interface NovoLancamentoBanco extends NovoLancamento {
  contaRecorrenteId?: string;
  competencia?: string;
}

export interface RepositorioFluxoCaixa {
  /** Entradas menos saidas com `data` anterior ao dia informado (YYYY-MM-DD, exclusivo). */
  saldoAntesDe(dia: string): Promise<number>;
  /** Lancamentos com `data` entre os dias (inclusive). */
  lancamentosEntre(de: string, ate: string): Promise<Lancamento[]>;
  /** Pagamentos de contas recorrentes da competencia (YYYY-MM). */
  pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]>;
  listarContas(): Promise<ContaRecorrenteBanco[]>;
  obterConta(id: string): Promise<ContaRecorrenteBanco | null>;
  /** Maior competencia ja paga da conta (YYYY-MM), ou null. */
  ultimaCompetenciaPaga(contaId: string): Promise<string | null>;
  /** Lanca `PagamentoDuplicado` se a competencia da conta ja estiver paga. */
  inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento>;
  excluirLancamento(id: string): Promise<boolean>;
  inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco>;
  definirFimConta(id: string, fim: string | null): Promise<boolean>;
  /** Lanca `ContaComLancamentos` se houver pagamento registrado. */
  excluirConta(id: string): Promise<boolean>;
  listarCategorias(): Promise<Categoria[]>;
  /** Nome como cadastrado (grafia canonica) se a categoria existe para o tipo; senao null. */
  nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null>;
  /** Lanca `CategoriaDuplicada` se o nome ja existir para o tipo. */
  inserirCategoria(nova: NovaCategoria): Promise<Categoria>;
  excluirCategoria(id: string): Promise<boolean>;
}
