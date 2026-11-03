import type { MarketingConfig } from "@nucleos/config";

export const META_API_VERSION = "v26.0";
export class ErroMeta extends Error {
  constructor(readonly codigo: "limite" | "credencial" | "resposta" | "rede" | "moeda") {
    super(
      {
        limite: "Meta Ads: limite de requisicoes; tente novamente mais tarde.",
        credencial: "Meta Ads: credencial invalida ou sem permissao de leitura.",
        resposta: "Meta Ads: resposta invalida.",
        rede: "Meta Ads: falha de comunicacao.",
        moeda: "Meta Ads: moeda incompatível com BRL; nenhuma conversao cambial foi aplicada.",
      }[codigo],
    );
  }
}
export interface CampanhaMeta {
  id: string;
  nome: string;
  status: string;
  objetivo: string;
}
export interface GastoMeta {
  campanhaId: string;
  nome: string;
  dia: string;
  moeda: string;
  gastoCentavos: string;
  impressoes: string;
  cliques: string;
  comprasMeta: string;
  valorComprasMetaCentavos: string;
  tipoCompraMeta: string | null;
}
function objeto(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new ErroMeta("resposta");
  return v as Record<string, unknown>;
}
function texto(v: unknown, re: RegExp, limite = 500): string {
  if (typeof v !== "string" || v.length > limite || !re.test(v)) throw new ErroMeta("resposta");
  return v;
}
function inteiro(v: unknown): string {
  return texto(v, /^\d{1,15}$/);
}
/** Decimal textual -> centavos com arredondamento half-up, sem ponto flutuante. */
export function centavos(v: unknown): string {
  const raw = texto(v, /^\d{1,14}(\.\d{1,10})?$/);
  const [unidade = "0", fracao = ""] = raw.split(".");
  return (
    BigInt(unidade) * 100n +
    BigInt((fracao + "00").slice(0, 2)) +
    (Number(fracao[2] ?? "0") >= 5 ? 1n : 0n)
  ).toString();
}
function acoes(v: unknown): Map<string, string> {
  if (v === undefined) return new Map();
  if (!Array.isArray(v)) throw new ErroMeta("resposta");
  const result = new Map<string, string>();
  for (const item of v) {
    const a = objeto(item);
    const tipo = texto(a["action_type"], /^[a-zA-Z0-9_.]+$/);
    if (result.has(tipo)) throw new ErroMeta("resposta");
    result.set(tipo, texto(a["value"], /^\d{1,14}(\.\d{1,10})?$/));
  }
  return result;
}
export function normalizarGasto(v: unknown, de: string, ate: string): GastoMeta {
  const x = objeto(v);
  const dia = texto(x["date_start"], /^\d{4}-\d{2}-\d{2}$/);
  if (
    dia < de ||
    dia > ate ||
    dia !== x["date_stop"] ||
    !Number.isFinite(Date.parse(dia)) ||
    new Date(dia).toISOString().slice(0, 10) !== dia
  )
    throw new ErroMeta("resposta");
  const moeda = texto(x["account_currency"], /^[A-Z]{3}$/);
  if (moeda !== "BRL") throw new ErroMeta("moeda");
  const compras = acoes(x["actions"]),
    valores = acoes(x["action_values"]);
  // Categorias sobrepostas: escolhe uma única série, nunca soma purchase + pixel + omni.
  const tipo =
    ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"].find((k) =>
      compras.has(k),
    ) ?? null;
  return {
    campanhaId: texto(x["campaign_id"], /^\d{1,30}$/),
    nome: texto(x["campaign_name"], /^[\s\S]+$/),
    dia,
    moeda,
    gastoCentavos: centavos(x["spend"]),
    impressoes: inteiro(x["impressions"]),
    cliques: inteiro(x["clicks"]),
    comprasMeta: tipo === null ? "0" : (compras.get(tipo) ?? "0"),
    valorComprasMetaCentavos: tipo === null ? "0" : centavos(valores.get(tipo) ?? "0"),
    tipoCompraMeta: tipo,
  };
}
export class ClienteMetaAds {
  constructor(
    readonly credenciais: NonNullable<MarketingConfig["meta"]>,
    private readonly requisitar: typeof fetch = fetch,
  ) {
    if (!/^\d{1,30}$/.test(credenciais.contaId)) throw new ErroMeta("credencial");
  }
  async #paginas(
    rota: "campaigns" | "insights",
    params: Record<string, string>,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    const resultado: unknown[] = [],
      vistos = new Set<string>();
    let cursor: string | undefined;
    for (let pagina = 0; pagina < 1000; pagina++) {
      signal.throwIfAborted();
      const url = new URL(
        `https://graph.facebook.com/${META_API_VERSION}/act_${this.credenciais.contaId}/${rota}`,
      );
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      url.searchParams.set("limit", "500");
      if (cursor !== undefined) url.searchParams.set("after", cursor);
      let r: Response;
      try {
        r = await this.requisitar(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${this.credenciais.token.reveal()}` },
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        });
      } catch {
        throw new ErroMeta("rede");
      }
      if (r.status === 429) throw new ErroMeta("limite");
      if ([400, 401, 403].includes(r.status)) throw new ErroMeta("credencial");
      if (!r.ok) throw new ErroMeta("rede");
      let body: Record<string, unknown>;
      try {
        body = objeto(await r.json());
      } catch {
        throw new ErroMeta("resposta");
      }
      if (body["error"] !== undefined || !Array.isArray(body["data"]))
        throw new ErroMeta("resposta");
      const dados: unknown[] = body["data"];
      resultado.push(...dados);
      if (resultado.length > 100000) throw new ErroMeta("resposta");
      if (body["paging"] === undefined) return resultado;
      const paging = objeto(body["paging"]);
      if (paging["next"] === undefined) return resultado;
      // Não visita paging.next: apenas cursor opaco, host/rota/credencial sob controle local.
      cursor = texto(objeto(paging["cursors"])["after"], /^[A-Za-z0-9_\-=:]+$/, 4096);
      if (vistos.has(cursor)) throw new ErroMeta("resposta");
      vistos.add(cursor);
    }
    throw new ErroMeta("resposta");
  }
  async importar(
    de: string,
    ate: string,
    signal: AbortSignal,
  ): Promise<{ campanhas: CampanhaMeta[]; gastos: GastoMeta[] }> {
    const campanhas = (
      await this.#paginas("campaigns", { fields: "id,name,status,objective" }, signal)
    ).map((v) => {
      const x = objeto(v);
      return {
        id: texto(x["id"], /^\d{1,30}$/),
        nome: texto(x["name"], /^[\s\S]+$/),
        status: texto(x["status"], /^[A-Z_]+$/),
        objetivo: texto(x["objective"], /^[A-Z_]+$/),
      };
    });
    const gastos = (
      await this.#paginas(
        "insights",
        {
          level: "campaign",
          time_increment: "1",
          time_range: JSON.stringify({ since: de, until: ate }),
          fields:
            "campaign_id,campaign_name,date_start,date_stop,account_currency,spend,impressions,clicks,actions,action_values",
        },
        signal,
      )
    ).map((v) => normalizarGasto(v, de, ate));
    return { campanhas, gastos };
  }
}
