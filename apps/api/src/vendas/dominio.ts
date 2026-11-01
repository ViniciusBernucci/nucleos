import type { GrupoStatusVenda } from "@nucleos/contracts";

/** Venda normalizada (um registro por transacao da Hotmart). Sem dados pessoais do comprador. */
export interface Venda {
  transacao: string;
  produtoId: string;
  produtoNome: string;
  /** Pseudonimo HMAC do comprador; o e-mail original nunca e guardado. */
  compradorId: string;
  status: string;
  grupo: GrupoStatusVenda;
  pedidoEm: Date;
  aprovadoEm: Date | null;
  valorCentavos: number;
  taxaCentavos: number;
  moeda: string;
  pagamento: string;
  parcelas: number;
  assinatura: boolean;
  recorrencia: number;
}

/** Status que a API de historico da Hotmart aceita em `transaction_status`. */
export const STATUS_HOTMART = [
  "APPROVED",
  "COMPLETE",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CHARGEBACK",
  "EXPIRED",
  "WAITING_PAYMENT",
  "PRINTED_BILLET",
  "UNDER_ANALISYS",
  "STARTED",
  "PRE_ORDER",
  "PROCESSING_TRANSACTION",
  "OVERDUE",
  "PROTESTED",
  "BLOCKED",
  "NO_FUNDS",
] as const;

const REEMBOLSO = new Set(["REFUNDED", "CHARGEBACK"]);
const CANCELADA = new Set(["CANCELLED", "EXPIRED", "PROTESTED", "BLOCKED", "NO_FUNDS"]);
// PARTIALLY_REFUNDED continua como receita: a venda vale, e o valor devolvido nao vem neste endpoint.
const RECEITA = new Set(["APPROVED", "COMPLETE", "PARTIALLY_REFUNDED"]);

/** Classifica o status da Hotmart; status desconhecido fica pendente (nunca vira receita). */
export function grupoDoStatus(status: string): GrupoStatusVenda {
  const s = status.toUpperCase();
  if (RECEITA.has(s)) return "receita";
  if (REEMBOLSO.has(s)) return "reembolso";
  if (CANCELADA.has(s)) return "cancelada";
  return "pendente";
}

/** Converte valor decimal da API para centavos inteiros (arredondado; invalido vira 0). */
export function paraCentavos(valor: unknown): number {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
