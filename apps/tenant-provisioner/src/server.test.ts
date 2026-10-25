import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createObservability } from "@nucleos/observability";
import { createHealthServer } from "./server.js";

const SENTINEL = "SENTINEL_provisioner_5ec7e7";
const meta = { service: "tenant-provisioner", version: "9.9.9", env: "test" };

async function withServer(fn: (base: string, logs: string[]) => Promise<void>): Promise<void> {
  const logs: string[] = [];
  const kit = createObservability({ ...meta, level: "debug", destination: { write: (l) => void logs.push(l) } }, { ...meta, enabled: false });
  const server = createHealthServer("tenant-provisioner", kit, { self: () => true });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, logs);
  } finally {
    server.close();
  }
}

test("GET /healthz responde 200 ok", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
    assert.equal((await fetch(`${base}/outra`)).status, 404);
  });
});

test("GET /readyz responde 200 ready sem expor versao", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ready", service: "tenant-provisioner" });
  });
});

test("X-Request-Id da borda e propagado; nenhum sentinela aparece no log", async () => {
  await withServer(async (base, logs) => {
    const res = await fetch(`${base}/outra?token=${SENTINEL}`, {
      headers: { "x-request-id": "edge-prov-0001", authorization: `Bearer ${SENTINEL}`, cookie: `s=${SENTINEL}` },
    });
    assert.equal(res.headers.get("x-request-id"), "edge-prov-0001");
    await new Promise((r) => setTimeout(r, 50));
    const record = JSON.parse(logs.find((l) => l.includes("http.request")) ?? "{}") as Record<string, unknown>;
    assert.equal(record["correlation_id"], "edge-prov-0001");
    assert.equal((record["data"] as Record<string, unknown>)["route"], "unmatched");
    assert.ok(!logs.join("").includes(SENTINEL));
  });
});
