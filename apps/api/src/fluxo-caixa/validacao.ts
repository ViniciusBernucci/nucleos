import type {
  NovaCategoria,
  NovaContaRecorrente,
  NovoLancamento,
  NovoPagamentoConta,
  TipoLancamento,
} from "@nucleos/contracts";
import { diaValido, mesValido } from "./calendario.js";

/** Teto por valor (R$ 1 bilhao): bem abaixo de Number.MAX_SAFE_INTEGER mesmo somando milhares. */
export const VALOR_MAX_CENTAVOS = 100_000_000_000;

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

type Corpo = Record<string, unknown>;

// Caracteres de controle (inclui quebra de linha): textos sao de uma linha so.
// eslint-disable-next-line no-control-regex
const CONTROLE_RE = /[\u0000-\u001f\u007f]/;

class Invalido extends Error {}

function objeto(corpo: unknown, campos: readonly string[]): Corpo {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new Invalido("corpo deve ser um objeto JSON");
  }
  const extra = Object.keys(corpo).find((k) => !campos.includes(k));
  if (extra !== undefined) throw new Invalido("campo desconhecido no corpo");
  return corpo as Corpo;
}

function texto(c: Corpo, nome: string, max: number): string {
  const v = c[nome];
  if (typeof v !== "string") throw new Invalido(`${nome} obrigatorio`);
  const t = v.trim();
  if (t.length === 0 || t.length > max || CONTROLE_RE.test(t)) {
    throw new Invalido(`${nome} deve ter de 1 a ${String(max)} caracteres`);
  }
  return t;
}

function inteiro(c: Corpo, nome: string, min: number, max: number): number {
  const v = c[nome];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new Invalido(`${nome} invalido`);
  }
  return v;
}

function dia(c: Corpo, nome: string): string {
  const v = c[nome];
  if (typeof v !== "string" || !diaValido(v)) throw new Invalido(`${nome} deve ser AAAA-MM-DD`);
  return v;
}

function mes(c: Corpo, nome: string): string {
  const v = c[nome];
  if (typeof v !== "string" || !mesValido(v)) throw new Invalido(`${nome} deve ser AAAA-MM`);
  return v;
}

function validar<T>(fn: () => T): Resultado<T> {
  try {
    return { ok: true, valor: fn() };
  } catch (e) {
    if (e instanceof Invalido) return { ok: false, erro: e.message };
    throw e;
  }
}

export function validarNovoLancamento(corpo: unknown): Resultado<NovoLancamento> {
  return validar(() => {
    const c = objeto(corpo, ["tipo", "descricao", "categoria", "valorCentavos", "data"]);
    const tipo = c["tipo"];
    if (tipo !== "entrada" && tipo !== "saida")
      throw new Invalido("tipo deve ser entrada ou saida");
    return {
      tipo: tipo satisfies TipoLancamento,
      descricao: texto(c, "descricao", 120),
      categoria: texto(c, "categoria", 60),
      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
      data: dia(c, "data"),
    };
  });
}

export function validarNovaCategoria(corpo: unknown): Resultado<NovaCategoria> {
  return validar(() => {
    const c = objeto(corpo, ["tipo", "nome"]);
    const tipo = c["tipo"];
    if (tipo !== "entrada" && tipo !== "saida")
      throw new Invalido("tipo deve ser entrada ou saida");
    return { tipo, nome: texto(c, "nome", 60) };
  });
}

export function validarNovaConta(corpo: unknown): Resultado<NovaContaRecorrente> {
  return validar(() => {
    const c = objeto(corpo, [
      "descricao",
      "categoria",
      "valorCentavos",
      "diaVencimento",
      "inicio",
      "fim",
    ]);
    const inicio = mes(c, "inicio");
    const fim = c["fim"] === undefined || c["fim"] === null ? null : mes(c, "fim");
    if (fim !== null && fim < inicio)
      throw new Invalido("fim deve ser igual ou posterior ao inicio");
    return {
      descricao: texto(c, "descricao", 120),
      categoria: texto(c, "categoria", 60),
      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
      diaVencimento: inteiro(c, "diaVencimento", 1, 31),
      inicio,
      fim,
    };
  });
}

export function validarPagamento(corpo: unknown): Resultado<NovoPagamentoConta> {
  return validar(() => {
    const c = objeto(corpo, ["competencia", "data", "valorCentavos"]);
    return {
      competencia: mes(c, "competencia"),
      data: dia(c, "data"),
      valorCentavos: inteiro(c, "valorCentavos", 1, VALOR_MAX_CENTAVOS),
    };
  });
}

/** Corpo opcional de encerramento: `{ ultimoMes?: "YYYY-MM" }`. */
export function validarEncerramento(corpo: unknown): Resultado<{ ultimoMes: string | undefined }> {
  return validar(() => {
    const c = objeto(corpo ?? {}, ["ultimoMes"]);
    return { ultimoMes: c["ultimoMes"] === undefined ? undefined : mes(c, "ultimoMes") };
  });
}

/** Ids sao bigint positivos no banco; no caminho aceitamos so digitos (ate 18). */
export function idValido(id: string): boolean {
  return /^[1-9]\d{0,17}$/.test(id);
}
