import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { Secret, loadVendasConfig } from "@nucleos/config";
import type { Pool } from "pg";
import { AppModule } from "../app.module.js";
import { MotorFuncionarios } from "../funcionarios/motor.js";
import { RegistroHandlers } from "../funcionarios/handlers.js";
import { FinanceiroModule } from "./financeiro.module.js";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { verificarCorpoHotmart } from "./corpo-webhook.js";

test("limite bruto Hotmart cobre barra terminal e maiusculas aceitas pelo roteador", async () => {
  const sqls: string[] = [];
  const c = {
    query: async (sql: string) => {
      sqls.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  const pool = { connect: async () => c } as unknown as Pool;
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.comModulos([
      FinanceiroModule.registrar(
        new MotorFuncionarios(pool, new RegistroHandlers()),
        new Secret("chave-ficticia"),
        { webhookHottok: new Secret("hottok-ficticio"), anexos: undefined },
        loadVendasConfig({}),
      ),
    ]),
    { logger: false, bodyParser: false },
  );
  app.useBodyParser("json", { limit: "2mb", verify: verificarCorpoHotmart });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const evento = JSON.stringify({
      id: "evento-http",
      event: "PURCHASE_APPROVED",
      data: { purchase: { transaction: "T1" } },
    });
    for (const rota of ["/v1/webhooks/hotmart", "/v1/webhooks/hotmart/", "/V1/WEBHOOKS/HOTMART"]) {
      const chamar = (body: string) =>
        fetch(base + rota, {
          method: "POST",
          headers: { "content-type": "application/json", "x-hotmart-hottok": "hottok-ficticio" },
          body,
        });
      assert.equal((await chamar(evento)).status, 200);
      sqls.length = 0;
      assert.equal((await chamar(" ".repeat(65536) + evento)).status, 413, rota);
      assert.equal(sqls.length, 0);
    }
  } finally {
    await app.close();
  }
});
test("rotas financeiras exigem chave e validam corpo sem consultar PostgreSQL", async () => {
  let consultas = 0;
  const pool = {
    query: () => {
      consultas++;
      throw new Error("consulta inesperada");
    },
  } as unknown as Pool;
  const motor = new MotorFuncionarios(pool, new RegistroHandlers());
  const app = await NestFactory.create(
    AppModule.comModulos([
      FinanceiroModule.registrar(
        motor,
        new Secret("chave-ficticia"),
        { webhookHottok: undefined, anexos: undefined },
        loadVendasConfig({}),
      ),
    ]),
    { logger: false },
  );
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    assert.equal((await fetch(base + "/v1/financeiro/contas-pagar")).status, 401);
    const r = await fetch(base + "/v1/financeiro/contas-pagar", {
      method: "POST",
      headers: { authorization: "Bearer chave-ficticia", "content-type": "application/json" },
      body: "[]",
    });
    assert.equal(r.status, 400);
    assert.equal(
      (
        await fetch(base + "/v1/financeiro/contas-pagar?de=2026-99-99", {
          headers: { authorization: "Bearer chave-ficticia" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + "/v1/webhooks/hotmart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
      503,
    );
    assert.equal(consultas, 0);
  } finally {
    await app.close();
  }
});
