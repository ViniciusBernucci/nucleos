import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route.ts";

test("GET /healthz responde 200 ok", async () => {
  const res = GET();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok", service: "web" });
});
