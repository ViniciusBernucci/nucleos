import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHealth } from "./index.js";

test("checkHealth le a resposta de /healthz", async () => {
  const fake = (async (url: URL | string) => {
    assert.equal(String(url), "http://127.0.0.1:1/healthz");
    return Response.json({ status: "ok", service: "fake" });
  }) as unknown as typeof fetch;
  assert.deepEqual(await checkHealth("http://127.0.0.1:1", fake), {
    status: "ok",
    service: "fake",
  });
});

test("checkHealth falha quando HTTP nao e 2xx", async () => {
  const fake = (async () => new Response("x", { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(checkHealth("http://127.0.0.1:1", fake));
});
