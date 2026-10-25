import assert from "node:assert/strict";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  InMemoryMetricExporter,
  AggregationTemporality,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace";
import {
  CORRELATION_HEADER,
  correlationHeaders,
  createBusinessCounter,
  createJobEnvelope,
  createObservability,
  createTelemetry,
  currentContext,
  handleProbe,
  observeHttp,
  resolveCorrelationId,
  runJob,
  telemetryConfigFromEnv,
} from "./index.js";

const SENTINEL = "SENTINEL_S3CR3T_9f8e7d";
const sink = () => {
  const lines: string[] = [];
  return { lines, write: (l: string) => void lines.push(l) };
};
const base = { service: "svc", version: "9.9.9", env: "test" };

function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

const listen = (s: Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));

test("correlation id: aceita da borda, gera UUID se ausente/invalido, ignora se borda nao confiavel", () => {
  assert.equal(resolveCorrelationId("edge-req-1234"), "edge-req-1234");
  assert.match(resolveCorrelationId(undefined), /^[0-9a-f-]{36}$/);
  assert.match(resolveCorrelationId("x\ninjetado"), /^[0-9a-f-]{36}$/);
  assert.match(resolveCorrelationId("edge-req-1234", false), /^[0-9a-f-]{36}$/);
});

test("AC-1: requisicao sintetica gera log, metrica e trace com o mesmo correlation_id; HTTP -> job -> log", async () => {
  const spans = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 3600_000 });
  const out = sink();
  const kit = createObservability(
    { ...base, destination: out },
    { ...base, enabled: true, spanProcessors: [new SimpleSpanProcessor({ exporter: spans })], metricReaders: [reader] },
  );
  const server = createServer(
    observeHttp(
      kit,
      async (req, res) => {
        const envelope = createJobEnvelope("demo.job", { n: 1 });
        // O job roda fora do contexto HTTP, so com o envelope (como um worker real).
        await new Promise<void>((done) =>
          setImmediate(() => {
            void Promise.resolve(runJob(envelope, () => kit.logger.log("info", "job.done", { job_type: envelope.type }))).then(() => done());
          }),
        );
        assert.equal(correlationHeaders()[CORRELATION_HEADER], currentContext()?.correlationId);
        res.writeHead(200).end("ok");
      },
      { routeOf: () => "/demo" },
    ),
  );
  const port = await listen(server);
  try {
    const res = await get(port, `/demo/123?token=${SENTINEL}`, { "x-request-id": "edge-req-1234", authorization: `Bearer ${SENTINEL}` });
    assert.equal(res.status, 200);
    assert.equal(res.headers[CORRELATION_HEADER], "edge-req-1234");
    await new Promise((r) => setTimeout(r, 50));

    const records = out.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const httpLog = records.find((r) => r["event"] === "http.request");
    const jobLog = records.find((r) => r["event"] === "job.done");
    assert.ok(httpLog && jobLog);
    for (const field of ["ts", "level", "service", "version", "env", "trace_id", "span_id", "correlation_id", "tenant_id", "actor_type", "event"]) {
      assert.ok(field in httpLog, `campo fixo ausente: ${field}`);
    }
    assert.equal(httpLog["correlation_id"], "edge-req-1234");
    assert.equal(jobLog["correlation_id"], "edge-req-1234");
    assert.equal(jobLog["actor_type"], "system");

    const span = spans.getFinishedSpans()[0];
    assert.ok(span);
    assert.equal(span.attributes["nucleos.correlation_id"], "edge-req-1234");
    assert.equal(span.spanContext().traceId, httpLog["trace_id"]);
    assert.equal(span.spanContext().spanId, httpLog["span_id"]);

    await reader.forceFlush();
    const metrics = metricExporter.getMetrics().flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics));
    const requests = metrics.find((m) => m.descriptor.name === "http.server.requests");
    assert.ok(requests);
    assert.deepEqual(requests.dataPoints[0]?.attributes, { method: "GET", route: "/demo", status_class: "2xx" });
    assert.ok(metrics.some((m) => m.descriptor.name === "http.server.request.duration"));

    // AC-2 (biblioteca): nada do request (query, header) aparece no log.
    assert.ok(!out.lines.join("").includes(SENTINEL));
  } finally {
    server.close();
    await kit.telemetry.shutdown();
  }
});

test("cardinalidade: rota nao declarada vira unmatched; label tenant_id e proibido", () => {
  const kit = createObservability({ ...base, destination: sink() }, { ...base, enabled: false });
  assert.throws(() => createBusinessCounter(kit.telemetry.meter, "x", { tenant_id: ["a"] }), /proibido/);
  const count = createBusinessCounter(kit.telemetry.meter, "orders", { outcome: ["ok", "error"] });
  count(1, { outcome: "qualquer" });
});

test("AC-3: telemetria desabilitada e no-op; OTLP inalcancavel nao altera a resposta nem derruba", async () => {
  assert.equal(telemetryConfigFromEnv({}, base).enabled, false);
  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1", OTEL_SDK_DISABLED: "true" }, base).enabled, false);
  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1/" }, base).otlpEndpoint, "http://x:1");
  const disabled = createTelemetry({ ...base, enabled: false });
  disabled.tracer.startSpan("x").end();
  await disabled.shutdown();

  for (const enabled of [false, true]) {
    const out = sink();
    const kit = createObservability(
      { ...base, destination: out },
      { ...base, enabled, otlpEndpoint: "http://127.0.0.1:1", metricIntervalMs: 50 },
    );
    const server = createServer(observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }));
    const port = await listen(server);
    try {
      const res = await get(port, "/x");
      assert.deepEqual([res.status, res.body], [200, "ok"]);
      await new Promise((r) => setTimeout(r, 150));
      assert.equal((await get(port, "/x")).status, 200);
    } finally {
      server.close();
      await kit.telemetry.shutdown();
    }
  }
});

test("sondas: /healthz e /readyz sem versoes; 503 quando dependencia falha", async () => {
  const out = sink();
  const kit = createObservability({ ...base, destination: out }, { ...base, enabled: false });
  let dbUp = true;
  const server = createServer((req, res) => {
    void handleProbe(kit, "svc", req, res, { db: () => dbUp }).then((handled) => {
      if (!handled) res.writeHead(404).end();
    });
  });
  const port = await listen(server);
  try {
    assert.deepEqual(JSON.parse((await get(port, "/healthz")).body), { status: "ok", service: "svc" });
    const ready = await get(port, "/readyz");
    assert.deepEqual([ready.status, JSON.parse(ready.body)], [200, { status: "ready", service: "svc" }]);
    dbUp = false;
    const notReady = await get(port, "/readyz");
    assert.equal(notReady.status, 503);
    assert.ok(!notReady.body.includes("9.9.9") && !notReady.body.includes("db"));
    assert.equal((await get(port, "/outra")).status, 404);
  } finally {
    server.close();
  }
});
