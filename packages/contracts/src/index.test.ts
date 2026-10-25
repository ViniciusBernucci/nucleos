import assert from "node:assert/strict";
import { test } from "node:test";
import { HEALTH_PATH, healthResponse } from "./index.js";

test("healthResponse devolve status ok e nome do servico", () => {
  assert.equal(HEALTH_PATH, "/healthz");
  assert.deepEqual(healthResponse("x"), { status: "ok", service: "x" });
});
