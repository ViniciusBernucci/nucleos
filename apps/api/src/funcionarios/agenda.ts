import { BadRequestException } from "@nestjs/common";
import type { Agendamento, Gatilho, ObjetoConfig } from "@nucleos/contracts";
import { CronExpressionParser } from "cron-parser";

export const EVENTOS_FUNCIONARIOS = [
  "hotmart.webhook.recebido",
  "financeiro.venda.alterada",
  "financeiro.extrato.importado",
  "financeiro.dados.alterados",
  "financeiro.alerta.criado",
  "financeiro.anomalia.detectada",
] as const;
export type AgendaEntrada = Pick<
  Agendamento,
  | "gatilho"
  | "intervalo_min"
  | "cron"
  | "tipo_evento"
  | "filtro_evento"
  | "fuso"
  | "inicio_em"
  | "fim_em"
  | "habilitado"
  | "politica_sobreposicao"
  | "politica_retentativa"
>;
export const objeto = (x: unknown): x is ObjetoConfig =>
  typeof x === "object" && x !== null && !Array.isArray(x);
export function dadosSeguros(x: unknown, profundidade = 0): boolean {
  if (profundidade > 16) return false;
  if (Array.isArray(x)) return x.length <= 100 && x.every((v) => dadosSeguros(v, profundidade + 1));
  if (objeto(x))
    return Object.entries(x).every(
      ([k, v]) =>
        !/(token|secret|senha|password|api.?key|^key$|__proto__|constructor|prototype)/i.test(k) &&
        dadosSeguros(v, profundidade + 1),
    );
  return (
    x === null ||
    typeof x === "boolean" ||
    (typeof x === "number" && Number.isFinite(x)) ||
    (typeof x === "string" && x.length <= 8000)
  );
}
export function exigirObjeto(x: unknown): ObjetoConfig {
  if (!objeto(x) || !dadosSeguros(x) || JSON.stringify(x).length > 32000)
    throw new BadRequestException("dados invalidos");
  return x;
}
export function campos(x: ObjetoConfig, permitidos: readonly string[]): void {
  if (Object.keys(x).some((k) => !permitidos.includes(k)))
    throw new BadRequestException("campo nao permitido");
}
export function texto(x: unknown, max = 160): string {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw new BadRequestException("texto invalido");
  for (let i = 0; i < x.length; i++)
    if (x.charCodeAt(i) < 32) throw new BadRequestException("texto invalido");
  return x.trim();
}
export function identificador(x: unknown): string {
  const s = texto(x, 19);
  if (!/^[1-9]\d{0,18}$/.test(s) || BigInt(s) > 9223372036854775807n)
    throw new BadRequestException("identificador invalido");
  return s;
}
export function inteiro(x: unknown, min: number, max: number): number {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x > max)
    throw new BadRequestException("numero invalido");
  return x;
}
export function booleano(x: unknown): boolean {
  if (typeof x !== "boolean") throw new BadRequestException("booleano invalido");
  return x;
}
export function opcao<T extends string>(x: unknown, opcoes: readonly T[]): T {
  if (typeof x !== "string" || !opcoes.includes(x as T))
    throw new BadRequestException("opcao invalida");
  return x as T;
}
function data(x: unknown): string {
  const s = texto(x, 40);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s)))
    throw new BadRequestException("data invalida");
  return new Date(s).toISOString();
}
export function validarAgenda(entrada: unknown, agora: Date): AgendaEntrada {
  const x = exigirObjeto(entrada);
  campos(x, [
    "gatilho",
    "intervalo_min",
    "cron",
    "tipo_evento",
    "filtro_evento",
    "fuso",
    "inicio_em",
    "fim_em",
    "habilitado",
    "politica_sobreposicao",
    "politica_retentativa",
  ]);
  const gatilho = opcao<Gatilho>(x["gatilho"], ["MANUAL", "UNICO", "INTERVALO", "CRON", "EVENTO"]);
  const fuso = x["fuso"] === undefined ? "America/Sao_Paulo" : texto(x["fuso"], 80);
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fuso });
  } catch {
    throw new BadRequestException("fuso invalido");
  }
  const inicio_em = x["inicio_em"] === undefined ? agora.toISOString() : data(x["inicio_em"]);
  const fim_em =
    x["fim_em"] === undefined || x["fim_em"] === null || x["fim_em"] === ""
      ? null
      : data(x["fim_em"]);
  if (fim_em !== null && fim_em < inicio_em)
    throw new BadRequestException("fim anterior ao inicio");
  const ret = exigirObjeto(x["politica_retentativa"] ?? { maxTentativas: 3, backoffSegundos: 30 });
  campos(ret, ["maxTentativas", "backoffSegundos"]);
  const agenda: AgendaEntrada = {
    gatilho,
    intervalo_min: gatilho === "INTERVALO" ? inteiro(x["intervalo_min"], 1, 525600) : null,
    cron: gatilho === "CRON" ? texto(x["cron"], 100) : null,
    tipo_evento: gatilho === "EVENTO" ? opcao(x["tipo_evento"], EVENTOS_FUNCIONARIOS) : null,
    filtro_evento: exigirObjeto(x["filtro_evento"] ?? {}),
    fuso,
    inicio_em,
    fim_em,
    habilitado: x["habilitado"] === undefined ? true : booleano(x["habilitado"]),
    politica_sobreposicao: opcao(x["politica_sobreposicao"] ?? "PULAR", [
      "PULAR",
      "ENFILEIRAR",
      "CANCELAR_ANTERIOR",
    ]),
    politica_retentativa: {
      maxTentativas: inteiro(ret["maxTentativas"], 1, 10),
      backoffSegundos: inteiro(ret["backoffSegundos"], 1, 3600),
    },
  };
  if (agenda.cron !== null) proximasOcorrencias(agenda, agora, 1);
  return agenda;
}
export function proximaOcorrencia(
  a: Pick<AgendaEntrada, "gatilho" | "intervalo_min" | "cron" | "fuso" | "inicio_em" | "fim_em">,
  apos: Date,
  primeira = false,
): Date | null {
  const inicio = new Date(a.inicio_em);
  let proxima: Date | null = null;
  if (a.gatilho === "UNICO") proxima = primeira && inicio >= apos ? inicio : null;
  else if (a.gatilho === "INTERVALO" && a.intervalo_min !== null) {
    const intervalo = a.intervalo_min * 60000;
    proxima = new Date(
      primeira && inicio > apos
        ? inicio
        : inicio.getTime() +
            (Math.floor(Math.max(0, apos.getTime() - inicio.getTime()) / intervalo) + 1) *
              intervalo,
    );
  } else if (a.gatilho === "CRON" && a.cron !== null) {
    if (/\bH\b/.test(a.cron)) throw new BadRequestException("cron aleatorio nao suportado");
    if (a.cron.trim().split(/\s+/).length !== 5)
      throw new BadRequestException("cron exige 5 campos");
    try {
      proxima = CronExpressionParser.parse(a.cron, {
        currentDate: new Date(Math.max(apos.getTime(), inicio.getTime() - 1)),
        tz: a.fuso,
      })
        .next()
        .toDate();
    } catch {
      throw new BadRequestException("cron invalido");
    }
  }
  return proxima !== null && a.fim_em !== null && proxima > new Date(a.fim_em) ? null : proxima;
}
export function proximasOcorrencias(a: AgendaEntrada, agora: Date, n = 5): string[] {
  const datas: string[] = [];
  let cursor = agora;
  for (let i = 0; i < n; i++) {
    const d = proximaOcorrencia(a, cursor, i === 0);
    if (d === null) break;
    datas.push(d.toISOString());
    cursor = d;
  }
  return datas;
}
