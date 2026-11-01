import type { PeriodoVendas, PontoSerieVendas } from "@nucleos/contracts";

export const FUSO = "America/Sao_Paulo";
export const MAX_DIAS_PERIODO = 366;

const DIA_MS = 86_400_000;
const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Interpreta `YYYY-MM-DD` como dia do calendario (sem fuso); `null` se invalido. */
export function lerDia(texto: string): Date | null {
  const m = DIA_RE.exec(texto);
  if (m === null) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === texto ? d : null;
}

export function formatarDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dia corrente no fuso do negocio (America/Sao_Paulo), como `YYYY-MM-DD`. */
export function hojeNoFuso(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return partes;
}

export function somarDias(dia: string, dias: number): string {
  const d = lerDia(dia);
  if (d === null) throw new RangeError("dia invalido");
  return formatarDia(new Date(d.getTime() + dias * DIA_MS));
}

/** Quantidade de dias incluindo os dois extremos. */
export function diasNoPeriodo(p: PeriodoVendas): number {
  const de = lerDia(p.de);
  const ate = lerDia(p.ate);
  if (de === null || ate === null) throw new RangeError("periodo invalido");
  return Math.round((ate.getTime() - de.getTime()) / DIA_MS) + 1;
}

/** Periodo imediatamente anterior, com a mesma duracao. */
export function periodoAnterior(p: PeriodoVendas): PeriodoVendas {
  const n = diasNoPeriodo(p);
  return { de: somarDias(p.de, -n), ate: somarDias(p.de, -1) };
}

export type ResultadoPeriodo =
  { ok: true; periodo: PeriodoVendas } | { ok: false; erro: "de" | "ate" | "ordem" | "tamanho" };

/** Valida `de`/`ate` informados; sem eles, usa os ultimos 30 dias ate hoje (fuso do negocio). */
export function resolverPeriodo(
  de: string | undefined,
  ate: string | undefined,
  agora: Date,
): ResultadoPeriodo {
  const fim = ate ?? hojeNoFuso(agora);
  if (lerDia(fim) === null) return { ok: false, erro: "ate" };
  const inicio = de ?? somarDias(fim, -29);
  if (lerDia(inicio) === null) return { ok: false, erro: "de" };
  const periodo = { de: inicio, ate: fim };
  if (inicio > fim) return { ok: false, erro: "ordem" };
  if (diasNoPeriodo(periodo) > MAX_DIAS_PERIODO) return { ok: false, erro: "tamanho" };
  return { ok: true, periodo };
}

/** Completa os dias sem venda com zero, para o grafico nao "pular" datas. */
export function preencherSerie(
  periodo: PeriodoVendas,
  pontos: readonly PontoSerieVendas[],
): PontoSerieVendas[] {
  const porDia = new Map(pontos.map((p) => [p.dia, p]));
  const saida: PontoSerieVendas[] = [];
  const n = diasNoPeriodo(periodo);
  for (let i = 0; i < n; i += 1) {
    const dia = somarDias(periodo.de, i);
    saida.push(porDia.get(dia) ?? { dia, receitaCentavos: 0, vendas: 0 });
  }
  return saida;
}
