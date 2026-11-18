/**
 * Acesso do servidor Next.js a API de fluxo de caixa. Mesma chave de servico do painel de vendas
 * (VENDAS_API_KEY ou arquivo); roda so no servidor e a chave nunca chega ao navegador.
 */
import type { FluxoCaixaMes } from "@nucleos/contracts";
import { configuracao } from "./vendas-api.ts";

export type FalhaFluxo =
  | "nao-autorizado"
  | "api-sem-chave"
  | "modulo-desligado"
  | "invalido"
  | "nao-encontrado"
  | "conflito"
  | "indisponivel";

export type ResultadoFluxo<T> =
  { tipo: "ok"; dados: T } | { tipo: "nao-configurado" } | { tipo: "erro"; falha: FalhaFluxo };

const TIMEOUT_MS = 10_000;

const FALHA_POR_STATUS: Record<number, FalhaFluxo> = {
  400: "invalido",
  401: "nao-autorizado",
  404: "nao-encontrado",
  409: "conflito",
  503: "api-sem-chave",
};

async function chamar(
  caminho: string,
  method: "GET" | "POST" | "DELETE",
  corpo?: unknown,
): Promise<ResultadoFluxo<unknown>> {
  const cfg = configuracao();
  if (cfg === undefined) return { tipo: "nao-configurado" };
  try {
    const r = await fetch(`${cfg.base}/v1/fluxo-caixa${caminho}`, {
      method,
      headers: {
        authorization: `Bearer ${cfg.chave}`,
        ...(corpo === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return { tipo: "erro", falha: FALHA_POR_STATUS[r.status] ?? "indisponivel" };
    return { tipo: "ok", dados: r.status === 204 ? null : ((await r.json()) as unknown) };
  } catch {
    return { tipo: "erro", falha: "indisponivel" };
  }
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

const ehFluxo = (x: unknown): x is FluxoCaixaMes =>
  ehObjeto(x) &&
  typeof x["mes"] === "string" &&
  ehObjeto(x["resumo"]) &&
  Array.isArray(x["movimentos"]) &&
  Array.isArray(x["contasDoMes"]) &&
  Array.isArray(x["contas"]) &&
  Array.isArray(x["categorias"]);

export async function carregarFluxo(
  mes: string | undefined,
): Promise<ResultadoFluxo<FluxoCaixaMes>> {
  const r = await chamar(mes === undefined ? "" : `?mes=${mes}`, "GET");
  // 404 no GET significa rota ausente: modulo desligado na API (sem banco).
  if (r.tipo === "erro" && r.falha === "nao-encontrado") {
    return { tipo: "erro", falha: "modulo-desligado" };
  }
  if (r.tipo !== "ok") return r;
  return ehFluxo(r.dados)
    ? { tipo: "ok", dados: r.dados }
    : { tipo: "erro", falha: "indisponivel" };
}

/** Mutacao sem corpo de resposta relevante para a tela (a pagina e revalidada em seguida). */
export async function alterarFluxo(
  caminho: string,
  method: "POST" | "DELETE",
  corpo?: unknown,
): Promise<ResultadoFluxo<null>> {
  const r = await chamar(caminho, method, corpo);
  return r.tipo === "ok" ? { tipo: "ok", dados: null } : r;
}

export const MENSAGENS_FALHA_FLUXO: Record<FalhaFluxo, string> = {
  "nao-autorizado":
    "A chave de acesso à API do financeiro foi recusada. Confira a chave configurada no servidor web.",
  "api-sem-chave":
    "A API do financeiro está sem chave de serviço configurada e, por segurança, não responde.",
  "modulo-desligado": "O fluxo de caixa está desligado na API (sem banco de dados configurado).",
  invalido: "Os dados enviados foram recusados pela API. Confira os campos e tente de novo.",
  "nao-encontrado":
    "O registro não foi encontrado. Ele pode ter sido removido; recarregue a página.",
  conflito: "A operação conflita com um registro existente.",
  indisponivel:
    "Não foi possível falar com a API do financeiro agora. Tente novamente em instantes.",
};
