/**
 * Funcoes puras do painel de vendas: formatacao pt-BR, comparacao com o periodo anterior,
 * validacao dos filtros da URL e geometria do grafico. Sem DOM, para testar no Node.
 */
import type { PontoSerieVendas } from "@nucleos/contracts";

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `12345` + `BRL` => `R$ 123,45`. Moeda desconhecida cai para o codigo ao lado do numero. */
export function formatarMoeda(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(
      centavos / 100,
    );
  } catch {
    return `${moeda} ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(centavos / 100)}`;
  }
}

export function formatarInteiro(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** `0.1234` => `12,3%`. */
export function formatarPercentual(fracao: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(fracao * 100)}%`;
}

/** `2026-10-31` => `31/10`. */
export function formatarDiaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** `2026-10-31` => `31/10/2026`. */
export function formatarDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

export interface Variacao {
  texto: string;
  direcao: "alta" | "baixa" | "estavel" | "sem-base";
}

/** Variacao percentual frente ao periodo anterior; sem base de comparacao nao inventa numero. */
export function variacao(atual: number, anterior: number): Variacao {
  if (anterior === 0) {
    return atual === 0
      ? { texto: "sem movimento nos dois períodos", direcao: "estavel" }
      : { texto: "sem base no período anterior", direcao: "sem-base" };
  }
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.05) return { texto: "estável vs. período anterior", direcao: "estavel" };
  const abs = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(pct));
  return pct > 0
    ? { texto: `▲ ${abs}% vs. período anterior`, direcao: "alta" }
    : { texto: `▼ ${abs}% vs. período anterior`, direcao: "baixa" };
}

const STATUS: Record<string, string> = {
  APPROVED: "Aprovada",
  COMPLETE: "Concluída",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  REFUNDED: "Reembolsada",
  CHARGEBACK: "Chargeback",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  WAITING_PAYMENT: "Aguardando pagamento",
  PRINTED_BILLET: "Boleto emitido",
  UNDER_ANALISYS: "Em análise",
  STARTED: "Iniciada",
  DELAYED: "Atrasada",
  OVERDUE: "Vencida",
  PROTESTED: "Protestada",
  BLOCKED: "Bloqueada",
  NO_FUNDS: "Sem saldo",
};

export function rotuloStatus(status: string): string {
  return STATUS[status] ?? status;
}

const PAGAMENTO: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  PIX: "Pix",
  BILLET: "Boleto",
  PAYPAL: "PayPal",
  PICPAY: "PicPay",
  GOOGLE_PAY: "Google Pay",
  APPLE_PAY: "Apple Pay",
  DESCONHECIDO: "Não informado",
};

export function rotuloPagamento(tipo: string): string {
  return PAGAMENTO[tipo] ?? tipo;
}

/** `há 5 min`, `há 2 h`, `há 3 dias`; `nunca` quando nao ha data. */
export function tempoDecorrido(iso: string | null, agora: Date): string {
  if (iso === null) return "nunca";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "nunca";
  const min = Math.max(0, Math.floor((agora.getTime() - t) / 60_000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${String(min)} min`;
  if (min < 1440) return `há ${String(Math.floor(min / 60))} h`;
  const dias = Math.floor(min / 1440);
  return `há ${String(dias)} ${dias === 1 ? "dia" : "dias"}`;
}

export interface FiltrosVendas {
  de?: string;
  ate?: string;
  moeda?: string;
  produto?: string;
}

type Busca = Readonly<Record<string, string | string[] | undefined>>;

/** Mantem so os filtros bem formados; qualquer outra coisa da URL e descartada (nunca repassada). */
export function filtrosDaUrl(busca: Busca): FiltrosVendas {
  const um = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" ? v : undefined;
  const de = um(busca["de"]);
  const ate = um(busca["ate"]);
  const moeda = um(busca["moeda"]);
  const produto = um(busca["produto"]);
  return {
    ...(de !== undefined && DIA_RE.test(de) ? { de } : {}),
    ...(ate !== undefined && DIA_RE.test(ate) ? { ate } : {}),
    ...(moeda !== undefined && /^[A-Z]{3}$/.test(moeda) ? { moeda } : {}),
    ...(produto !== undefined && /^[\w.-]{1,64}$/.test(produto) ? { produto } : {}),
  };
}

export function paraQuery(filtros: FiltrosVendas): string {
  const p = new URLSearchParams();
  for (const k of ["de", "ate", "moeda", "produto"] as const) {
    const v = filtros[k];
    if (v !== undefined) p.set(k, v);
  }
  return p.toString();
}

/** Ultimos `n` dias ate hoje (fuso America/Sao_Paulo), ambos os extremos incluidos. */
export function ultimosDias(n: number, agora: Date): { de: string; ate: string } {
  const ate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const base = new Date(`${ate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - (n - 1));
  return { de: base.toISOString().slice(0, 10), ate };
}

export interface PontoGrafico {
  x: number;
  y: number;
  dia: string;
  receitaCentavos: number;
}

export interface GeometriaGrafico {
  pontos: PontoGrafico[];
  /** Atributo `points` da linha. */
  linha: string;
  /** Atributo `d` da area sob a linha. */
  area: string;
  maxCentavos: number;
  /** Valores de referencia do eixo Y (do maior ao zero). */
  eixoY: { y: number; centavos: number }[];
}

/** Arredonda para cima ao proximo valor "redondo" (1, 2, 5 x 10^n) para o eixo nao ficar torto. */
export function tetoRedondo(valor: number): number {
  if (valor <= 0) return 100;
  const exp = 10 ** Math.floor(Math.log10(valor));
  const frac = valor / exp;
  const passo = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return passo * exp;
}

export function geometriaGrafico(
  serie: readonly PontoSerieVendas[],
  largura: number,
  altura: number,
  margem: { topo: number; direita: number; baixo: number; esquerda: number },
): GeometriaGrafico {
  const maxCentavos = tetoRedondo(Math.max(0, ...serie.map((p) => p.receitaCentavos)));
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.baixo;
  const passoX = serie.length > 1 ? w / (serie.length - 1) : 0;
  const pontos = serie.map((p, i) => ({
    x: margem.esquerda + (serie.length > 1 ? i * passoX : w / 2),
    y: margem.topo + h - (p.receitaCentavos / maxCentavos) * h,
    dia: p.dia,
    receitaCentavos: p.receitaCentavos,
  }));
  const fmt = (n: number): string => n.toFixed(1);
  const linha = pontos.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
  const base = margem.topo + h;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const area =
    primeiro === undefined || ultimo === undefined
      ? ""
      : `M${fmt(primeiro.x)},${fmt(base)} ${pontos.map((p) => `L${fmt(p.x)},${fmt(p.y)}`).join(" ")} L${fmt(ultimo.x)},${fmt(base)} Z`;
  const eixoY = [1, 0.75, 0.5, 0.25, 0].map((f) => ({
    y: margem.topo + h - f * h,
    centavos: Math.round(maxCentavos * f),
  }));
  return { pontos, linha, area, maxCentavos, eixoY };
}
