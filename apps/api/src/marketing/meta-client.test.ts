import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import { ClienteMetaAds, centavos, normalizarGasto, ErroMeta } from "./meta-client.js";
import { janelaMeta } from "./marketing.module.js";

const credentials = { contaId: "123", token: new Secret("sentinela-meta-test") };
const signal = new AbortController().signal;
export const insight = {
  campaign_id: "321",
  campaign_name: "Teste",
  date_start: "2026-11-01",
  date_stop: "2026-11-01",
  account_currency: "BRL",
  spend: "19.99",
  impressions: "120",
  clicks: "4",
  actions: [
    { action_type: "purchase", value: "2" },
    { action_type: "omni_purchase", value: "2" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
  ],
  action_values: [{ action_type: "omni_purchase", value: "38.98" }],
};
const response = (data: unknown, paging?: unknown) =>
  new Response(JSON.stringify({ data, ...(paging === undefined ? {} : { paging }) }));
const campanha = { id: "321", name: "Teste", status: "ACTIVE", objective: "OUTCOME_SALES" };

test("decimal exato e arredondamento de valor reportado; compra sobreposta não soma", () => {
  assert.equal(centavos("19.99"), "1999");
  assert.equal(centavos("99999999999999.99"), "9999999999999999");
  assert.equal(centavos("0.105"), "11");
  const gasto = normalizarGasto(insight, "2026-10-27", "2026-11-02");
  assert.equal(gasto.comprasMeta, "2");
  assert.equal(gasto.tipoCompraMeta, "omni_purchase");
  assert.equal(gasto.valorComprasMetaCentavos, "3898");
  assert.throws(() => centavos("-1"));
  assert.throws(() => centavos("1e3"));
});
test("rejeita moeda sem FX, data fora janela e campos inválidos", () => {
  assert.throws(
    () => normalizarGasto({ ...insight, account_currency: "USD" }, "2026-10-27", "2026-11-02"),
    (e: unknown) => e instanceof ErroMeta && e.codigo === "moeda",
  );
  for (const v of [
    { ...insight, date_start: "2026-10-01" },
    { ...insight, impressions: "NaN" },
    { ...insight, date_stop: "2026-11-02" },
    { ...insight, spend: null },
  ])
    assert.throws(() => normalizarGasto(v, "2026-10-27", "2026-11-02"));
});
test("paginação fixa host/rota, usa somente GET e nunca token query/next host", async () => {
  const urls: URL[] = [];
  const cliente = new ClienteMetaAds(credentials, async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url);
    assert.equal(url.hostname, "graph.facebook.com");
    assert.equal(init?.method, "GET");
    assert.equal(init.redirect, "error");
    assert.equal(
      (init.headers as Record<string, string>)["Authorization"],
      "Bearer sentinela-meta-test",
    );
    assert.equal(url.searchParams.has("access_token"), false);
    if (url.pathname.endsWith("campaigns")) return response([campanha]);
    assert.equal(url.searchParams.get("level"), "campaign");
    assert.equal(url.searchParams.get("time_increment"), "1");
    return url.searchParams.has("after")
      ? response([])
      : response([insight], {
          next: "https://evil.invalid/?access_token=nao-propagar",
          cursors: { after: "cursor_2" },
        });
  });
  const dados = await cliente.importar("2026-10-27", "2026-11-02", signal);
  assert.equal(urls.length, 3);
  assert.equal(dados.gastos.length, 1);
  assert.equal(urls[2]?.searchParams.get("after"), "cursor_2");
});
test("erros 429, token inválido, rede e JSON são fixos e sem corpo/url/segredo", async () => {
  for (const [status, codigo] of [
    [429, "limite"],
    [401, "credencial"],
    [400, "credencial"],
    [403, "credencial"],
    [500, "rede"],
  ] as const) {
    const cliente = new ClienteMetaAds(
      credentials,
      async () => new Response("sentinela-meta-test https://evil.invalid/", { status }),
    );
    await assert.rejects(
      cliente.importar("2026-10-27", "2026-11-02", signal),
      (e: unknown) =>
        e instanceof ErroMeta &&
        e.codigo === codigo &&
        !e.message.includes("sentinela") &&
        !e.message.includes("https"),
    );
  }
  for (const impl of [
    async () => {
      throw new Error("https://secret.invalid/sentinela");
    },
    async () => new Response("invalido"),
  ]) {
    await assert.rejects(
      new ClienteMetaAds(credentials, impl).importar("2026-10-27", "2026-11-02", signal),
      ErroMeta,
    );
  }
});
test("cursor repetido/malformado não cria loop, abort interrompe, janela contém 7 dias", async () => {
  const cliente = new ClienteMetaAds(credentials, async () =>
    response([], { next: "qualquer", cursors: { after: "igual" } }),
  );
  await assert.rejects(cliente.importar("2026-10-27", "2026-11-02", signal), ErroMeta);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(cliente.importar("2026-10-27", "2026-11-02", abort.signal));
  assert.deepEqual(janelaMeta(new Date("2026-11-02T01:00:00Z")), {
    de: "2026-10-26",
    ate: "2026-11-01",
  });
});
