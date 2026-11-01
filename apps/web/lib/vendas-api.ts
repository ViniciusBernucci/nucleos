/**
 * Acesso do servidor Next.js a API de vendas. Roda somente no servidor: a chave de servico e lida
 * do ambiente (VENDAS_API_KEY) ou arquivo e nunca vai para o HTML, cliente ou logs.
 */
import { readFileSync } from "node:fs";
import type { ListaVendas, PainelVendas } from "@nucleos/contracts";
import { type FiltrosVendas, paraQuery } from "./vendas-formato.ts";

export type FalhaVendas =
  "nao-autorizado" | "api-sem-chave" | "modulo-desligado" | "filtro-invalido" | "indisponivel";

export type ResultadoVendas<T> =
  { tipo: "ok"; dados: T } | { tipo: "nao-configurado" } | { tipo: "erro"; falha: FalhaVendas };

const URL_PADRAO = "http://127.0.0.1:3001";
const TIMEOUT_MS = 10_000;

function configuracao(): { base: string; chave: string } | undefined {
  const arquivo = process.env["VENDAS_API_KEY_FILE"];
  const direta = process.env["VENDAS_API_KEY"];
  try {
    if (direta && arquivo) return undefined;
    const chave = direta || (arquivo ? readFileSync(arquivo, "utf8").replace(/\n$/, "") : "");
    if (chave === "") return undefined;
    return { base: (process.env["VENDAS_API_URL"] ?? URL_PADRAO).replace(/\/+$/, ""), chave };
  } catch {
    return undefined;
  }
}

async function buscar<T>(
  caminho: string,
  valido: (x: unknown) => x is T,
  method: "GET" | "POST" = "GET",
): Promise<ResultadoVendas<T>> {
  const cfg = configuracao();
  if (cfg === undefined) return { tipo: "nao-configurado" };
  try {
    const r = await fetch(`${cfg.base}${caminho}`, {
      method,
      headers: { authorization: `Bearer ${cfg.chave}` },
      cache: "no-store",
      signal: AbortSignal.timeout(method === "POST" ? 180_000 : TIMEOUT_MS),
    });
    if (r.status === 401) return { tipo: "erro", falha: "nao-autorizado" };
    if (r.status === 400) return { tipo: "erro", falha: "filtro-invalido" };
    if (r.status === 503) return { tipo: "erro", falha: "api-sem-chave" };
    if (r.status === 404) return { tipo: "erro", falha: "modulo-desligado" };
    if (!r.ok) return { tipo: "erro", falha: "indisponivel" };
    const corpo: unknown = await r.json();
    return valido(corpo) ? { tipo: "ok", dados: corpo } : { tipo: "erro", falha: "indisponivel" };
  } catch {
    return { tipo: "erro", falha: "indisponivel" };
  }
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

const ehPainel = (x: unknown): x is PainelVendas =>
  ehObjeto(x) &&
  ehObjeto(x["indicadores"]) &&
  Array.isArray(x["serieDiaria"]) &&
  ehObjeto(x["sincronizacao"]);

const ehLista = (x: unknown): x is ListaVendas => ehObjeto(x) && Array.isArray(x["itens"]);

export interface AtualizacaoVendas {
  resultado: "sucesso" | "parcial" | "falha" | "ocupada" | "desabilitada";
}

function ehAtualizacao(x: unknown): x is AtualizacaoVendas {
  return (
    ehObjeto(x) &&
    ["sucesso", "parcial", "falha", "ocupada", "desabilitada"].includes(String(x["resultado"]))
  );
}

/** Chamada autenticada exclusivamente pelo servidor; nao leva credenciais ao navegador. */
export function atualizarVendasAgora(): Promise<ResultadoVendas<AtualizacaoVendas>> {
  return buscar("/v1/vendas/sincronizacao/atualizar", ehAtualizacao, "POST");
}

export function carregarPainel(filtros: FiltrosVendas): Promise<ResultadoVendas<PainelVendas>> {
  const q = paraQuery(filtros);
  return buscar(`/v1/vendas/painel${q === "" ? "" : `?${q}`}`, ehPainel);
}

export function carregarUltimasVendas(
  filtros: FiltrosVendas,
  limite = 10,
): Promise<ResultadoVendas<ListaVendas>> {
  const q = new URLSearchParams(paraQuery(filtros));
  q.set("limite", String(limite));
  return buscar(`/v1/vendas?${q.toString()}`, ehLista);
}

export const MENSAGENS_FALHA: Record<FalhaVendas, string> = {
  "nao-autorizado":
    "A chave de acesso à API de vendas foi recusada. Confira a chave configurada no servidor web.",
  "api-sem-chave":
    "A API de vendas está sem chave de serviço configurada e, por segurança, não responde.",
  "modulo-desligado": "O módulo de vendas está desligado na API (sem banco de dados configurado).",
  "filtro-invalido":
    "Os filtros informados são inválidos. Use datas no formato AAAA-MM-DD, com período de até 366 dias.",
  indisponivel: "Não foi possível consultar a API de vendas agora. Tente novamente em instantes.",
};
