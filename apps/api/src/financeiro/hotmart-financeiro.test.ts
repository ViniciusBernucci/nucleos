import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import { HotmartClient, normalizarVenda } from "../vendas/hotmart-client.js";
const item = {
  purchase: {
    transaction: "T1",
    order_date: 1793650000000,
    status: "APPROVED",
    price: { value: "100.00", currency_code: "BRL" },
    hotmart_fee: { total: "10.00" },
    tracking: { source_sck: "campanha-1" },
  },
};
test("enriquecimento consulta fontes oficiais, conserva preco efetivo e remove identidade", async () => {
  const urls: string[] = [];
  const cliente = new HotmartClient({
    env: "sandbox",
    credenciais: { clientId: new Secret("id-teste"), clientSecret: new Secret("secret-teste") },
    fetch: async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      urls.push(url);
      if (url.includes("/oauth/token"))
        return Response.json({ access_token: "token-ficticio", expires_in: 3600 });
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token-ficticio");
      if (url.includes("/commissions"))
        return Response.json({
          items: [
            {
              source: "PRODUCER",
              commission: { value: "70.00", currency_value: "BRL" },
              user: { name: "Descartar" },
            },
            {
              source: "AFFILIATE",
              commission: { value: "20.00", currency_value: "BRL" },
              user: { email: "descartar@example.invalid" },
            },
          ],
        });
      return Response.json({ items: [{ coupon: { value: 22.9 } }] });
    },
  });
  const v = normalizarVenda(item, "pseudo");
  assert.ok(v);
  const enriquecida = await cliente.enriquecer(v);
  assert.equal(enriquecida.valorCentavos, 10000);
  assert.equal(enriquecida.descontoCentavos, null);
  assert.equal(enriquecida.comissoesCentavos, 2000);
  assert.equal(enriquecida.rastreioSck, "campanha-1");
  assert.equal(JSON.stringify(enriquecida).includes("descartar"), false);
  assert.equal(urls.filter((u) => u.includes("/commissions")).length, 1);
  assert.equal(urls.filter((u) => u.includes("/price/details")).length, 1);
});
test("comissao em moeda divergente falha sem misturar valores", async () => {
  const cliente = new HotmartClient({
    env: "sandbox",
    credenciais: { clientId: new Secret("id-teste"), clientSecret: new Secret("secret-teste") },
    fetch: async (input) =>
      (input instanceof Request ? input.url : input.toString()).includes("/oauth/token")
        ? Response.json({ access_token: "token-ficticio", expires_in: 3600 })
        : Response.json({
            items: [{ source: "AFFILIATE", commission: { value: 1, currency_value: "USD" } }],
          }),
  });
  const v = normalizarVenda(item, "pseudo");
  assert.ok(v);
  await assert.rejects(cliente.enriquecer(v), /hotmart: resposta/);
});
