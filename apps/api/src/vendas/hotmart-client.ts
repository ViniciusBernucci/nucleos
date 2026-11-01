import { createHmac } from "node:crypto";
import type { HotmartCredentials, HotmartEnv } from "@nucleos/config";
import { type Venda, grupoDoStatus, paraCentavos } from "./dominio.js";

const URL_TOKEN = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const URL_HISTORICO: Record<HotmartEnv, string> = {
  production: "https://developers.hotmart.com/payments/api/v1/sales/history",
  sandbox: "https://sandbox.hotmart.com/payments/api/v1/sales/history",
};

const MAX_RESULTADOS = 500;
const MAX_PAGINAS = 1000;
const MAX_TENTATIVAS = 3;
const TIMEOUT_MS = 30_000;

export type CodigoErroHotmart = "autenticacao" | "limite" | "http" | "rede" | "resposta";

/** Erro da integracao. Mensagem fixa: nunca inclui corpo da resposta, credenciais ou URL. */
export class HotmartError extends Error {
  constructor(
    readonly codigo: CodigoErroHotmart,
    readonly httpStatus?: number,
  ) {
    super(
      httpStatus === undefined
        ? `hotmart: ${codigo}`
        : `hotmart: ${codigo} (http ${String(httpStatus)})`,
    );
    this.name = "HotmartError";
  }
}

export interface OpcoesHotmart {
  env: HotmartEnv;
  credenciais: HotmartCredentials;
  fetch?: typeof fetch;
  agora?: () => number;
  /** Pausa entre tentativas; injetavel para testes. */
  esperar?: (ms: number) => Promise<void>;
}

export interface JanelaConsulta {
  de: Date;
  ate: Date;
}

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : {};
}
function texto(v: unknown, padrao = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : padrao;
}
function inteiro(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isInteger(v) ? v : padrao;
}
function data(v: unknown): Date | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Converte um item de `/sales/history` em `Venda`. Devolve `null` (item ignorado) quando falta
 * transacao ou data do pedido; o e-mail do comprador vira pseudonimo HMAC e e descartado.
 */
export function normalizarVenda(item: unknown, chavePseudonimo: string): Venda | null {
  const raiz = obj(item);
  const compra = obj(raiz["purchase"]);
  const produto = obj(raiz["product"]);
  const comprador = obj(raiz["buyer"]);
  const preco = obj(compra["price"]);
  const taxa = obj(compra["hotmart_fee"]);
  const pagamento = obj(compra["payment"]);

  const transacao = texto(compra["transaction"]);
  const pedidoEm = data(compra["order_date"]);
  if (transacao === "" || pedidoEm === null) return null;

  const status = texto(compra["status"], "UNKNOWN").toUpperCase();
  const identidade = (texto(comprador["email"]) || texto(comprador["ucode"]) || transacao)
    .trim()
    .toLowerCase();
  const moeda = (
    texto(preco["currency_code"]) ||
    texto(taxa["currency_code"]) ||
    "BRL"
  ).toUpperCase();

  return {
    transacao,
    produtoId: texto(produto["id"], "desconhecido"),
    produtoNome: texto(produto["name"], "Produto sem nome"),
    compradorId: createHmac("sha256", chavePseudonimo)
      .update(identidade)
      .digest("hex")
      .slice(0, 24),
    status,
    grupo: grupoDoStatus(status),
    pedidoEm,
    aprovadoEm: data(compra["approved_date"]),
    valorCentavos: paraCentavos(preco["value"]),
    taxaCentavos: paraCentavos(taxa["total"]),
    moeda: /^[A-Z]{3}$/.test(moeda) ? moeda : "BRL",
    pagamento: texto(pagamento["type"], "DESCONHECIDO").toUpperCase(),
    parcelas: Math.max(1, inteiro(pagamento["installments_number"], 1)),
    assinatura: compra["is_subscription"] === true,
    recorrencia: Math.max(0, inteiro(compra["recurrency_number"], 0)),
  };
}

/** Cliente somente-leitura da API de pagamentos da Hotmart (historico de vendas). */
export class HotmartClient {
  readonly #env: HotmartEnv;
  readonly #credenciais: HotmartCredentials;
  readonly #fetch: typeof fetch;
  readonly #agora: () => number;
  readonly #esperar: (ms: number) => Promise<void>;
  #token: { valor: string; expiraEm: number } | undefined;

  constructor(opcoes: OpcoesHotmart) {
    this.#env = opcoes.env;
    this.#credenciais = opcoes.credenciais;
    this.#fetch = opcoes.fetch ?? fetch;
    this.#agora = opcoes.agora ?? Date.now;
    this.#esperar = opcoes.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async #obterToken(): Promise<string> {
    if (this.#token !== undefined && this.#token.expiraEm > this.#agora()) {
      return this.#token.valor;
    }
    const basic =
      this.#credenciais.clientToken
        ?.reveal()
        .trim()
        .replace(/^Basic\s+/i, "") ??
      Buffer.from(
        `${this.#credenciais.clientId.reveal()}:${this.#credenciais.clientSecret.reveal()}`,
      ).toString("base64");
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.#credenciais.clientId.reveal(),
      client_secret: this.#credenciais.clientSecret.reveal(),
    });
    const resposta = await this.#chamar(`${URL_TOKEN}?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    });
    if (resposta.status === 400 || resposta.status === 401 || resposta.status === 403) {
      throw new HotmartError("autenticacao", resposta.status);
    }
    const corpo = obj(await this.#json(resposta));
    const valor = texto(corpo["access_token"]);
    const expiraEmSeg = typeof corpo["expires_in"] === "number" ? corpo["expires_in"] : 0;
    if (valor === "" || expiraEmSeg <= 0) throw new HotmartError("resposta");
    // Margem de 60 s para nao usar um token no limite da validade.
    this.#token = { valor, expiraEm: this.#agora() + Math.max(0, expiraEmSeg - 60) * 1000 };
    return valor;
  }

  async #json(resposta: Response): Promise<unknown> {
    try {
      return await resposta.json();
    } catch {
      throw new HotmartError("resposta");
    }
  }

  /** `fetch` com timeout, retentativa em 429/5xx/rede e erro tipado ao esgotar. */
  async #chamar(url: string, init: RequestInit): Promise<Response> {
    let ultimo: HotmartError = new HotmartError("rede");
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
      try {
        const resposta = await this.#fetch(url, {
          ...init,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (resposta.status !== 429 && resposta.status < 500) return resposta;
        ultimo = new HotmartError(resposta.status === 429 ? "limite" : "http", resposta.status);
        const espera = Number(resposta.headers.get("retry-after"));
        await this.#esperar(
          Number.isFinite(espera) && espera > 0 ? espera * 1000 : 1000 * 2 ** tentativa,
        );
      } catch {
        ultimo = new HotmartError("rede");
        await this.#esperar(1000 * 2 ** tentativa);
      }
    }
    throw ultimo;
  }

  async #get(url: string): Promise<Response> {
    for (let renovou = 0; renovou < 2; renovou += 1) {
      const token = await this.#obterToken();
      const resposta = await this.#chamar(url, { headers: { Authorization: `Bearer ${token}` } });
      if (resposta.status === 401 && renovou === 0) {
        this.#token = undefined; // token revogado/expirado antes do previsto: renova uma vez
        continue;
      }
      return resposta;
    }
    throw new HotmartError("autenticacao", 401);
  }

  /**
   * Percorre todas as paginas de um status no intervalo e entrega cada pagina normalizada a
   * `aoReceber` (gravacao incremental, sem acumular tudo em memoria). Devolve itens recebidos.
   */
  async listarVendas(
    janela: JanelaConsulta,
    status: string,
    chavePseudonimo: string,
    aoReceber: (vendas: Venda[]) => Promise<void>,
  ): Promise<number> {
    let token: string | undefined;
    let total = 0;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const params = new URLSearchParams({
        max_results: String(MAX_RESULTADOS),
        start_date: String(janela.de.getTime()),
        end_date: String(janela.ate.getTime()),
        transaction_status: status,
      });
      if (token !== undefined) params.set("page_token", token);

      const resposta = await this.#get(`${URL_HISTORICO[this.#env]}?${params.toString()}`);
      if (resposta.status === 401 || resposta.status === 403) {
        throw new HotmartError("autenticacao", resposta.status);
      }
      if (!resposta.ok) throw new HotmartError("http", resposta.status);

      const corpo = obj(await this.#json(resposta));
      const itens = Array.isArray(corpo["items"]) ? (corpo["items"] as unknown[]) : [];
      const vendas = itens
        .map((i) => normalizarVenda(i, chavePseudonimo))
        .filter((v): v is Venda => v !== null);
      if (vendas.length > 0) await aoReceber(vendas);
      total += itens.length;

      const proximo = texto(obj(corpo["page_info"])["next_page_token"]);
      if (proximo === "") return total;
      token = proximo;
    }
    throw new HotmartError("resposta");
  }
}
