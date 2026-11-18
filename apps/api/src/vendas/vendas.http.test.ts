import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Secret, type VendasConfig } from "@nucleos/config";
import type { PainelVendas } from "@nucleos/contracts";
import type { Pool } from "pg";
import { AppModule } from "../app.module.js";
import { VendasModule } from "./vendas.module.js";

const CHAVE = "chave-de-teste-sentinela";

/** Pool falso: toda consulta devolve zero linhas (banco vazio); basta para exercitar a fiacao HTTP. */
const poolVazio = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;

function config(apiKey: Secret | undefined): VendasConfig {
  return {
    hotmartEnv: "production",
    hotmart: undefined,
    syncIntervalMs: 1_800_000,
    backfillDays: 90,
    apiKey,
  };
}

async function subir(apiKey: Secret | undefined): Promise<{ app: INestApplication; base: string }> {
  const app = await NestFactory.create(
    AppModule.comModulos([VendasModule.registrar({ config: config(apiKey), pool: poolVazio })]),
    { logger: false },
  );
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  return { app, base: url.replace("[::1]", "127.0.0.1") };
}

const auth = { authorization: `Bearer ${CHAVE}` };

describe("API de vendas (HTTP)", () => {
  let app: INestApplication;
  let base: string;
  before(async () => ({ app, base } = await subir(new Secret(CHAVE))));
  after(async () => app.close());

  test("sem bearer ou com bearer errado => 401, sem vazar a chave", async () => {
    for (const headers of [{}, { authorization: "Bearer errada" }]) {
      const r = await fetch(`${base}/v1/vendas/painel`, { headers });
      assert.equal(r.status, 401);
      assert.doesNotMatch(await r.text(), new RegExp(CHAVE));
    }
  });

  test("painel vazio: 200, 30 dias preenchidos, indicadores zerados e sincronizacao nunca", async () => {
    const r = await fetch(`${base}/v1/vendas/painel`, { headers: auth });
    assert.equal(r.status, 200);
    const p = (await r.json()) as PainelVendas;
    assert.equal(p.serieDiaria.length, 30);
    assert.equal(p.moeda, "BRL");
    assert.equal(p.indicadores.vendas, 0);
    assert.equal(p.indicadores.taxaReembolso, 0);
    assert.equal(p.sincronizacao.status, "nunca");
    assert.equal(p.sincronizacao.habilitada, false);
    assert.equal(p.sincronizacao.intervaloMinutos, 30);
  });

  test("parametros invalidos => 400 sem eco do valor", async () => {
    const ruins = [
      "de=2026-13-45",
      "ate=ontem",
      "de=2026-11-02&ate=2026-11-01",
      "de=2020-01-01&ate=2026-01-01",
      "moeda=real",
      "produto=a%20b%3Bdrop",
      "de=2026-01-01&de=2026-01-02",
    ];
    for (const q of ruins) {
      const r = await fetch(`${base}/v1/vendas/painel?${q}`, { headers: auth });
      assert.equal(r.status, 400, q);
      assert.doesNotMatch(await r.text(), /drop|real|ontem/i, q);
    }
    const lista = await fetch(`${base}/v1/vendas?limite=1000`, { headers: auth });
    assert.equal(lista.status, 400);
  });

  test("lista e estado da sincronizacao respondem, e o disparo manual devolve 202", async () => {
    const lista = await fetch(`${base}/v1/vendas?limite=10`, { headers: auth });
    assert.deepEqual(await lista.json(), { itens: [], total: 0, limite: 10, deslocamento: 0 });
    assert.equal((await fetch(`${base}/v1/vendas/sincronizacao`, { headers: auth })).status, 200);
    const disparo = await fetch(`${base}/v1/vendas/sincronizacao`, {
      method: "POST",
      headers: auth,
    });
    assert.equal(disparo.status, 202);
  });

  test("atualizacao do painel exige bearer e retorna resultado da execucao", async () => {
    const semAuth = await fetch(`${base}/v1/vendas/sincronizacao/atualizar`, { method: "POST" });
    assert.equal(semAuth.status, 401);
    const r = await fetch(`${base}/v1/vendas/sincronizacao/atualizar`, {
      method: "POST",
      headers: auth,
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { resultado: "desabilitada" });
  });
});

test("sem chave de servico configurada as rotas fecham com 503", async () => {
  const { app, base } = await subir(undefined);
  try {
    const r = await fetch(`${base}/v1/vendas/painel`, { headers: auth });
    assert.equal(r.status, 503);
  } finally {
    await app.close();
  }
});
