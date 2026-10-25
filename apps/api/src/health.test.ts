import "reflect-metadata";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

test("GET /healthz responde 200 ok", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  try {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", service: "api" });
  } finally {
    await app.close();
  }
});
