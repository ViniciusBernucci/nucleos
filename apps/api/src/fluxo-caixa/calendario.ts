import { hojeNoFuso, lerDia } from "../vendas/periodo.js";

const MES_RE = /^(\d{4})-(\d{2})$/;

/** Anos aceitos em datas e meses do fluxo de caixa (barra digitacao errada como 0202 ou 20260). */
export const ANO_MIN = 2000;
export const ANO_MAX = 2100;

/** `YYYY-MM` valido e dentro dos anos aceitos. */
export function mesValido(texto: string): boolean {
  const m = MES_RE.exec(texto);
  if (m === null) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return ano >= ANO_MIN && ano <= ANO_MAX && mes >= 1 && mes <= 12;
}

/** `YYYY-MM-DD` valido (calendario real) e dentro dos anos aceitos. */
export function diaValido(texto: string): boolean {
  if (lerDia(texto) === null) return false;
  const ano = Number(texto.slice(0, 4));
  return ano >= ANO_MIN && ano <= ANO_MAX;
}

export function mesAtual(agora: Date): string {
  return hojeNoFuso(agora).slice(0, 7);
}

export function primeiroDia(mes: string): string {
  return `${mes}-01`;
}

/** Quantidade de dias do mes (28 a 31). */
export function diasNoMes(mes: string): number {
  return new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
}

export function ultimoDia(mes: string): string {
  return `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
}

/** Dia de vencimento no mes; 31 em abril vira 30, em fevereiro vira 28 ou 29. */
export function vencimentoNoMes(mes: string, diaVencimento: number): string {
  return `${mes}-${String(Math.min(diaVencimento, diasNoMes(mes))).padStart(2, "0")}`;
}

export function somarMeses(mes: string, n: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}
