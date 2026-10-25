import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createHealthServer } from "./server.js";

test("GET /healthz responde 200 ok", async () => {
  const server = createHealthServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
    assert.equal((await fetch(`http://127.0.0.1:${port}/outra`)).status, 404);
  } finally {
    server.close();
  }
});
