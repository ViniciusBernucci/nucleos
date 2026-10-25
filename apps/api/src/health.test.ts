import "reflect-metadata";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { createObservability } from "@nucleos/observability";
import { AppModule } from "./app.module.js";
import { observabilityMiddleware } from "./observability.js";

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

test("middleware de observabilidade: correlation id propagado, /readyz sem versao e log sem sentinela", async () => {
  const SENTINEL = "SENTINEL_api_c0ffee";
  const meta = { service: "api", version: "9.9.9", env: "test" };
  const logs: string[] = [];
  const kit = createObservability({ ...meta, level: "debug", destination: { write: (l) => void logs.push(l) } }, { ...meta, enabled: false });
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(observabilityMiddleware(kit));
  await app.listen(0, "127.0.0.1");
  try {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/readyz?token=${SENTINEL}`, {
      headers: { "x-request-id": "edge-api-0001", authorization: `Bearer ${SENTINEL}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-request-id"), "edge-api-0001");
    assert.deepEqual(await res.json(), { status: "ready", service: "api" });
    await new Promise((r) => setTimeout(r, 50));
    const record = JSON.parse(logs.find((l) => l.includes("http.request")) ?? "{}") as Record<string, unknown>;
    assert.equal(record["correlation_id"], "edge-api-0001");
    assert.equal((record["data"] as Record<string, unknown>)["route"], "/readyz");
    assert.ok(!logs.join("").includes(SENTINEL));
  } finally {
    await app.close();
  }
});
