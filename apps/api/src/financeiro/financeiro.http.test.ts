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
  await app.listen(0, "127.0.0.1");
  try {
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
