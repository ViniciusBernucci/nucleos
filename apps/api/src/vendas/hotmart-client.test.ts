import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import { HotmartClient, HotmartError, normalizarVenda } from "./hotmart-client.js";
import type { Venda } from "./dominio.js";

const ID = "CLIENT-ID-SENTINELA";
const SEGREDO = "CLIENT-SECRET-SENTINELA";

const item = (transacao: string, extra: Record<string, unknown> = {}) => ({
  product: { id: 101, name: "Curso Completo" },
  buyer: { name: "Fulano da Silva", email: "Fulano@Exemplo.com" },
  purchase: {
    transaction: transacao,
    order_date: 1_761_998_400_000,
    approved_date: 1_761_998_460_000,
    status: "APPROVED",
    price: { value: 197.9, currency_code: "BRL" },
    hotmart_fee: { total: 19.79, currency_code: "BRL" },
    payment: { type: "PIX", installments_number: 1 },
    is_subscription: false,
    recurrency_number: 1,
    ...extra,
  },
});

interface Chamada {
  url: URL;
  headers: Record<string, string>;
}

/** fetch falso: responde o token e entrega as respostas de historico da fila, em ordem. */
function fetchFalso(historico: (() => Response)[], token: () => Response = () => tokenOk()) {
  const chamadas: Chamada[] = [];
  const fila = [...historico];
  const impl: typeof fetch = async (entrada, init) => {
    const url = new URL(
      typeof entrada === "string" || entrada instanceof URL ? entrada : entrada.url,
    );
    chamadas.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.pathname.includes("/oauth/token")) return token();
    const prox = fila.shift();
    if (prox === undefined) throw new Error("sem resposta programada");
    return prox();
  };
  return { impl, chamadas };
}

const json = (corpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const tokenOk = (): Response => json({ access_token: "tok-1", expires_in: 3600 });

function cliente(f: typeof fetch, agora = () => 0) {
  return new HotmartClient({
    env: "production",
    credenciais: { clientId: new Secret(ID), clientSecret: new Secret(SEGREDO) },
    fetch: f,
    agora,
    esperar: async () => undefined,
  });
}

const janela = { de: new Date("2026-10-01T00:00:00Z"), ate: new Date("2026-11-01T00:00:00Z") };

test("usa Client Token explicito no Basic sem codificar novamente nem duplicar prefixo", async () => {
  for (const valor of ["token-fornecido", "Basic token-fornecido"]) {
    const { impl, chamadas } = fetchFalso([() => json({ items: [] })]);
    const c = new HotmartClient({
      env: "production",
      fetch: impl,
      credenciais: {
        clientId: new Secret(ID),
        clientSecret: new Secret(SEGREDO),
        clientToken: new Secret(valor),
      },
    });
    await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
    assert.equal(chamadas[0]?.headers["Authorization"], "Basic token-fornecido");
    assert.ok(!chamadas[0].url.href.includes("token-fornecido"));
    assert.equal(chamadas[1]?.headers["Authorization"], "Bearer tok-1");
  }
});

test("sandbox usa o mesmo caminho de historico no host de testes da Hotmart", async () => {
  const { impl, chamadas } = fetchFalso([() => json({ items: [] })]);
  const c = new HotmartClient({
    env: "sandbox",
    fetch: impl,
    credenciais: { clientId: new Secret(ID), clientSecret: new Secret(SEGREDO) },
  });
  await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
  const historico = chamadas[1];
  assert.ok(historico);
  assert.equal(
    historico.url.origin + historico.url.pathname,
    "https://sandbox.hotmart.com/payments/api/v1/sales/history",
  );
});

test("normaliza o item e nao guarda e-mail nem nome do comprador", () => {
  const v = normalizarVenda(item("HP1"), "chave") as Venda;
  assert.equal(v.transacao, "HP1");
  assert.equal(v.valorCentavos, 19790);
  assert.equal(v.taxaCentavos, 1979);
  assert.equal(v.grupo, "receita");
  assert.equal(v.pagamento, "PIX");
  assert.doesNotMatch(JSON.stringify(v), /exemplo|fulano/i);
  // Mesmo comprador (caixa diferente) => mesmo pseudonimo; chave diferente => outro pseudonimo.
  const igual = normalizarVenda(
    { ...item("HP2"), buyer: { email: "fulano@exemplo.COM" } },
    "chave",
  ) as Venda;
  assert.equal(igual.compradorId, v.compradorId);
  assert.notEqual((normalizarVenda(item("HP1"), "outra") as Venda).compradorId, v.compradorId);
});

test("ignora itens sem transacao ou sem data e tolera campos ausentes", () => {
  assert.equal(normalizarVenda({}, "k"), null);
  assert.equal(normalizarVenda({ purchase: { transaction: "X" } }, "k"), null);
  const minimo = normalizarVenda(
    { purchase: { transaction: "X", order_date: 1_761_998_400_000 } },
    "k",
  ) as Venda;
  assert.equal(minimo.moeda, "BRL");
  assert.equal(minimo.valorCentavos, 0);
  assert.equal(minimo.grupo, "pendente");
});

test("pagina por page_token, filtra por status e usa Basic no token", async () => {
  const { impl, chamadas } = fetchFalso([
    () => json({ items: [item("A"), item("B")], page_info: { next_page_token: "P2" } }),
    () => json({ items: [item("C")], page_info: {} }),
  ]);
  const recebidas: string[] = [];
  const total = await cliente(impl).listarVendas(janela, "APPROVED", "k", async (vs) => {
    recebidas.push(...vs.map((v) => v.transacao));
  });

  assert.equal(total, 3);
  assert.deepEqual(recebidas, ["A", "B", "C"]);
  assert.equal(chamadas.length, 3); // token + duas paginas
  const [token, p1, p2] = chamadas as [Chamada, Chamada, Chamada];
  assert.equal(
    token.headers["Authorization"],
    `Basic ${Buffer.from(`${ID}:${SEGREDO}`).toString("base64")}`,
  );
  assert.equal(token.url.searchParams.get("grant_type"), "client_credentials");
  assert.equal(
    token.url.origin + token.url.pathname,
    "https://api-sec-vlc.hotmart.com/security/oauth/token",
  );
  assert.equal(token.url.searchParams.get("client_id"), ID);
  assert.equal(token.url.searchParams.get("client_secret"), SEGREDO);
  assert.equal(
    p1.url.origin + p1.url.pathname,
    "https://developers.hotmart.com/payments/api/v1/sales/history",
  );
  assert.equal(p1.url.searchParams.get("transaction_status"), "APPROVED");
  assert.equal(p1.url.searchParams.get("start_date"), String(janela.de.getTime()));
  assert.equal(p1.url.searchParams.get("page_token"), null);
  assert.equal(p2.url.searchParams.get("page_token"), "P2");
  assert.equal(p2.headers["Authorization"], "Bearer tok-1");
});

test("reaproveita o token ate perto de expirar", async () => {
  let agora = 0;
  const { impl, chamadas } = fetchFalso([
    () => json({ items: [] }),
    () => json({ items: [] }),
    () => json({ items: [] }),
  ]);
  const c = cliente(impl, () => agora);
  await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
  await c.listarVendas(janela, "COMPLETE", "k", async () => undefined);
  agora = 3_600_000; // passou da validade (menos a margem de 60 s)
  await c.listarVendas(janela, "REFUNDED", "k", async () => undefined);
  assert.equal(chamadas.filter((x) => x.url.pathname.includes("/oauth/token")).length, 2);
});

test("renova o token uma vez quando a API responde 401", async () => {
  const { impl, chamadas } = fetchFalso([() => json({}, 401), () => json({ items: [item("A")] })]);
  const total = await cliente(impl).listarVendas(janela, "APPROVED", "k", async () => undefined);
  assert.equal(total, 1);
  assert.equal(chamadas.filter((x) => x.url.pathname.includes("/oauth/token")).length, 2);
});

test("credencial recusada gera erro de autenticacao sem vazar segredos", async () => {
  const { impl } = fetchFalso([], () => json({ error: SEGREDO }, 401));
  await assert.rejects(
    cliente(impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
    (e: unknown) => {
      assert.ok(e instanceof HotmartError);
      assert.equal(e.codigo, "autenticacao");
      assert.doesNotMatch(`${e.message}${JSON.stringify(e)}`, new RegExp(`${ID}|${SEGREDO}`));
      return true;
    },
  );
});

test("tenta de novo em 429 e falha com erro tipado quando esgota as tentativas", async () => {
  const ok = fetchFalso([() => json({}, 429), () => json({ items: [item("A")] })]);
  assert.equal(
    await cliente(ok.impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
    1,
  );

  const ruim = fetchFalso([() => json({}, 500), () => json({}, 502), () => json({}, 503)]);
  await assert.rejects(
    cliente(ruim.impl).listarVendas(janela, "APPROVED", "k", async () => undefined),
    (e: unknown) => e instanceof HotmartError && e.codigo === "http" && e.httpStatus === 503,
  );
});

test("400 do historico vira erro http (status invalido nao e engolido)", async () => {
  const { impl } = fetchFalso([() => json({ error: "x" }, 400)]);
  await assert.rejects(
    cliente(impl).listarVendas(janela, "NAO_EXISTE", "k", async () => undefined),
    (e: unknown) => e instanceof HotmartError && e.codigo === "http" && e.httpStatus === 400,
  );
});
