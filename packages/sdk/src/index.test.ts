import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, checkHealth, createControlPlaneClient } from "./index.js";

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

test("cliente tipado: erro com ProblemDetails valido preserva o problema", async () => {
  const fake = (async () =>
    new Response(JSON.stringify({ type: "about:blank", title: "Indisponivel", status: 503 }), {
      status: 503,
      headers: { "content-type": "application/problem+json" },
    })) as unknown as typeof fetch;
  await assert.rejects(createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 503);
    assert.equal(e.problem?.title, "Indisponivel");
    return true;
  });
});

test("cliente tipado: corpo de erro fora do contrato nao vira problem", async () => {
  const fake = (async () =>
    Response.json(
      { type: "about:blank", title: "x", status: 200, stack: "at x" },
      { status: 500 },
    )) as unknown as typeof fetch;
  await assert.rejects(createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.problem, undefined);
    return true;
  });
});

test("cliente tipado: 200 fora do contrato e rejeitado", async () => {
  const fake = (async () => Response.json({ status: "degraded" })) as unknown as typeof fetch;
  await assert.rejects(
    createControlPlaneClient("http://127.0.0.1:1", fake).getHealth(),
    /fora do contrato/,
  );
});
