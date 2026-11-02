/**
 * Funcoes puras do fluxo de caixa: valores em reais <-> centavos, meses da URL e leitura dos
 * formularios das Server Actions. Sem DOM nem rede, para testar no Node.
 */
import type {
  NovaCategoria,
  NovaContaRecorrente,
  NovoLancamento,
  NovoPagamentoConta,
  StatusContaDoMes,
} from "@nucleos/contracts";

export interface EstadoAcao {
  erro: boolean;
  mensagem: string;
}

export const ESTADO_INICIAL: EstadoAcao = { erro: false, mensagem: "" };

/** Evento DOM (borbulha) disparado pelo formulario quando a acao termina com sucesso. */
export const EVENTO_ACAO_CONCLUIDA = "fluxo:acao-concluida";

export type Leitura<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

const VALOR_MAX_CENTAVOS = 100_000_000_000;
const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[1-9]\d{0,17}$/;
// Formato brasileiro com milhar (1.234,56) ou numero simples (1234,56 / 1234.56, como o <input type=number> envia).
const VALOR_BR_RE = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const VALOR_SIMPLES_RE = /^(\d+)(?:[.,](\d{1,2}))?$/;

/** `"1.234,56"` => `123456`. Sem float: inteiro e centavos sao lidos como texto. */
export function lerValorEmCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  const br = VALOR_BR_RE.exec(t);
  const m = br ?? VALOR_SIMPLES_RE.exec(t);
  if (m === null) return null;
  const inteiro = Number((m[1] ?? "").replaceAll(".", ""));
  const centavos = Number((m[2] ?? "").padEnd(2, "0"));
  const total = inteiro * 100 + centavos;
  return Number.isSafeInteger(total) && total > 0 && total <= VALOR_MAX_CENTAVOS ? total : null;
}

/** `123456` => `"1234.56"`, valor padrao para `<input type="number" step="0.01">`. */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function formatarReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

export function mesValido(texto: string): boolean {
  return MES_RE.test(texto);
}

/** `?mes=2026-11`; ausente, repetido ou invalido => undefined (a API usa o mes corrente). */
export function mesDaUrl(busca: Record<string, string | string[] | undefined>): string | undefined {
  const v = busca["mes"];
  return typeof v === "string" && mesValido(v) ? v : undefined;
}

export function somarMeses(mes: string, n: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** `2026-11` => `novembro de 2026`. */
export function nomeDoMes(mes: string): string {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** `2026-11-05` => `05/11`. */
export function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** `2026-11` => `11/2026`. */
export function mesCurto(mes: string): string {
  return `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
}

/** Dia sugerido nos formularios: hoje, se o mes exibido e o corrente; senao o dia 1 do mes. */
export function diaSugerido(mes: string, hoje: string): string {
  return hoje.startsWith(mes) ? hoje : `${mes}-01`;
}

export const ROTULO_STATUS: Record<StatusContaDoMes, string> = {
  paga: "Paga",
  pendente: "A vencer",
  atrasada: "Atrasada",
};

const texto = (f: FormData, nome: string): string => {
  const v = f.get(nome);
  return typeof v === "string" ? v.trim() : "";
};

function campoTexto(f: FormData, nome: string, rotulo: string, max: number): Leitura<string> {
  const v = texto(f, nome);
  return v.length === 0 || v.length > max
    ? { ok: false, mensagem: `Informe ${rotulo} (até ${String(max)} caracteres).` }
    : { ok: true, valor: v };
}

function campoValor(f: FormData): Leitura<number> {
  const v = lerValorEmCentavos(texto(f, "valor"));
  return v === null
    ? { ok: false, mensagem: "Informe um valor maior que zero, como 1.234,56." }
    : { ok: true, valor: v };
}

function campoDia(f: FormData, nome: string): Leitura<string> {
  const v = texto(f, nome);
  return DIA_RE.test(v)
    ? { ok: true, valor: v }
    : { ok: false, mensagem: "Informe uma data válida." };
}

function campoMes(f: FormData, nome: string, rotulo: string): Leitura<string> {
  const v = texto(f, nome);
  return mesValido(v) ? { ok: true, valor: v } : { ok: false, mensagem: `Informe ${rotulo}.` };
}

/** Le o id oculto do formulario; so digitos, para nao montar caminho arbitrario na API. */
export function idDoFormulario(f: FormData, nome = "id"): string | null {
  const v = texto(f, nome);
  return ID_RE.test(v) ? v : null;
}

/** Junta as leituras: devolve a primeira mensagem de erro ou o objeto completo. */
function juntar<T extends object>(campos: {
  [K in keyof T]: Leitura<T[K]>;
}): Leitura<T> {
  const saida: Record<string, unknown> = {};
  for (const [k, r] of Object.entries<Leitura<unknown>>(campos)) {
    if (!r.ok) return r;
    saida[k] = r.valor;
  }
  return { ok: true, valor: saida as T };
}

export function lancamentoDoFormulario(f: FormData): Leitura<NovoLancamento> {
  const tipo = texto(f, "tipo");
  return juntar<NovoLancamento>({
    tipo:
      tipo === "entrada" || tipo === "saida"
        ? { ok: true, valor: tipo }
        : { ok: false, mensagem: "Escolha entrada ou saída." },
    descricao: campoTexto(f, "descricao", "a descrição", 120),
    categoria: campoTexto(f, "categoria", "a categoria", 60),
    valorCentavos: campoValor(f),
    data: campoDia(f, "data"),
  });
}

export function contaDoFormulario(f: FormData): Leitura<NovaContaRecorrente> {
  const dia = Number(texto(f, "diaVencimento"));
  const fim = texto(f, "fim");
  const conta = juntar<Omit<NovaContaRecorrente, "fim">>({
    descricao: campoTexto(f, "descricao", "a descrição", 120),
    categoria: campoTexto(f, "categoria", "a categoria", 60),
    valorCentavos: campoValor(f),
    diaVencimento:
      Number.isInteger(dia) && dia >= 1 && dia <= 31
        ? { ok: true, valor: dia }
        : { ok: false, mensagem: "O dia de vencimento vai de 1 a 31." },
    inicio: campoMes(f, "inicio", "o mês do primeiro vencimento"),
  });
  if (!conta.ok) return conta;
  if (fim === "") return { ok: true, valor: { ...conta.valor, fim: null } };
  if (!mesValido(fim))
    return { ok: false, mensagem: "Informe um mês final válido ou deixe em branco." };
  if (fim < conta.valor.inicio) {
    return { ok: false, mensagem: "O último mês não pode ser anterior ao primeiro." };
  }
  return { ok: true, valor: { ...conta.valor, fim } };
}

export function pagamentoDoFormulario(f: FormData): Leitura<NovoPagamentoConta> {
  return juntar<NovoPagamentoConta>({
    competencia: campoMes(f, "competencia", "o mês de referência"),
    data: campoDia(f, "data"),
    valorCentavos: campoValor(f),
  });
}

export function categoriaDoFormulario(f: FormData): Leitura<NovaCategoria> {
  const tipo = texto(f, "tipo");
  return juntar<NovaCategoria>({
    tipo:
      tipo === "entrada" || tipo === "saida"
        ? { ok: true, valor: tipo }
        : { ok: false, mensagem: "Escolha entrada ou saída." },
    nome: campoTexto(f, "nome", "o nome da categoria", 60),
  });
}
