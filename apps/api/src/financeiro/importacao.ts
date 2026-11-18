import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

export const hash = (texto: string): string => createHash("sha256").update(texto).digest("hex");
export function dia(valor: unknown): string {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    !Number.isFinite(new Date(valor + "T12:00:00Z").getTime()) ||
    new Date(valor + "T12:00:00Z").toISOString().slice(0, 10) !== valor
  )
    throw new BadRequestException("data invalida");
  return valor;
}
export function texto(valor: unknown, max = 120): string {
  if (typeof valor !== "string" || !valor.trim() || valor.length > max)
    throw new BadRequestException("texto invalido");
  return valor.trim();
}
export function id(valor: unknown): string {
  if (typeof valor !== "string" || !/^[1-9]\d{0,17}$/.test(valor))
    throw new BadRequestException("id invalido");
  return valor;
}
export function centavos(valor: unknown, permitirNegativo = false): string {
  if (
    typeof valor !== "string" ||
    !(permitirNegativo ? /^-?\d{1,14}$/ : /^\d{1,14}$/).test(valor) ||
    BigInt(valor) === 0n
  )
    throw new BadRequestException("valor em centavos invalido");
  return BigInt(valor).toString();
}
export function decimal(valor: string): string {
  if (!/^-?\d{1,12}[.,]\d{2}$/.test(valor.trim()))
    throw new BadRequestException("decimal invalido");
  return BigInt(valor.trim().replace(/[.,]/, "")).toString();
}
/** RFC-style quoting with semicolon separator. No silent truncation of malformed input. */
export function csv(conteudo: string): string[][] {
  if (Buffer.byteLength(conteudo) > 1024 * 1024)
    throw new BadRequestException("arquivo excede 1 MB");
  const linhas: string[][] = [],
    atual: string[] = [];
  let campo = "",
    aspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (c === '"') {
      if (aspas && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else aspas = !aspas;
    } else if (!aspas && (c === ";" || c === "\n")) {
      atual.push(campo.replace(/\r$/, ""));
      campo = "";
      if (c === "\n") {
        if (atual.some(Boolean)) linhas.push([...atual]);
        atual.length = 0;
      }
    } else campo += c ?? "";
  }
  if (aspas) throw new BadRequestException("aspas CSV invalidas");
  atual.push(campo.replace(/\r$/, ""));
  if (atual.some(Boolean)) linhas.push(atual);
  if (linhas.length > 2001) throw new BadRequestException("limite de 2000 linhas");
  return linhas;
}
export interface ItemExtrato {
  fitid: string;
  data: string;
  valorCentavos: string;
  memo: string;
}
export function extrato(conteudo: string, formato: "ofx" | "csv"): ItemExtrato[] {
  if (Buffer.byteLength(conteudo) > 1024 * 1024)
    throw new BadRequestException("arquivo excede 1 MB");
  if (formato === "csv") {
    const linhas = csv(conteudo);
    if (
      linhas
        .shift()
        ?.join(";")
        .replace(/^\uFEFF/, "") !== "data;valor;fitid;memo"
    )
      throw new BadRequestException("cabecalho CSV invalido");
    return linhas.map((l) => ({
      data: dia(l[0]),
      valorCentavos: decimal(l[1] ?? ""),
      fitid: l[2] ? texto(l[2], 200) : hash(l.join(";")),
      memo: (l[3] ?? "").slice(0, 240),
    }));
  }
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (!blocos.length || blocos.length > 2000)
    throw new BadRequestException("OFX sem transacoes ou excedido");
  return blocos.map((b) => {
    const campo = (tag: string): string =>
      new RegExp("<" + tag + ">([^<\r\n]*)", "i").exec(b)?.[1]?.trim() ?? "";
    const d = campo("DTPOSTED").slice(0, 8);
    return {
      fitid: texto(campo("FITID"), 200),
      data: dia(d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)),
      valorCentavos: decimal(campo("TRNAMT")),
      memo: campo("MEMO").slice(0, 240),
    };
  });
}
