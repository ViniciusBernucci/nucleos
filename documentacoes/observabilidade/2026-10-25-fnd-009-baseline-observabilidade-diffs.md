# FND-009 - Diffs do commit (2026-10-25)

Patch unificado do commit (exclui `documentacoes/` e lock files). Documento principal: [2026-10-25-fnd-009-baseline-observabilidade.md](2026-10-25-fnd-009-baseline-observabilidade.md).

## Hashes dos lock files
```
122b9efc8b8d585f5b2bea4a1b7e2885f446592f5da5282a5d5a9248f229aca6  pnpm-lock.yaml
2792da5ff91fced561b25aff57021eee6baaa9068073f020e33e1156c2c1cd74  uv.lock
```

```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index b125804..f23b3f8 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -14,6 +14,7 @@
     "@nestjs/core": "12.2.0",
     "@nestjs/platform-express": "12.2.0",
     "@nucleos/contracts": "workspace:*",
+    "@nucleos/observability": "workspace:*",
     "reflect-metadata": "0.2.2",
     "rxjs": "7.8.2"
   }
diff --git a/apps/api/src/health.controller.ts b/apps/api/src/health.controller.ts
index 68415f0..4187271 100644
--- a/apps/api/src/health.controller.ts
+++ b/apps/api/src/health.controller.ts
@@ -7,4 +7,10 @@ export class HealthController {
   health(): HealthResponse {
     return healthResponse("api");
   }
+
+  /** Sem dependencias criticas ainda (banco chega em ticket proprio); nao expoe versao. */
+  @Get("readyz")
+  ready(): { status: "ready"; service: string } {
+    return { status: "ready", service: "api" };
+  }
 }
diff --git a/apps/api/src/health.test.ts b/apps/api/src/health.test.ts
index 799b710..911a9d4 100644
--- a/apps/api/src/health.test.ts
+++ b/apps/api/src/health.test.ts
@@ -3,7 +3,9 @@ import assert from "node:assert/strict";
 import type { AddressInfo } from "node:net";
 import { test } from "node:test";
 import { NestFactory } from "@nestjs/core";
+import { createObservability } from "@nucleos/observability";
 import { AppModule } from "./app.module.js";
+import { observabilityMiddleware } from "./observability.js";
 
 test("GET /healthz responde 200 ok", async () => {
   const app = await NestFactory.create(AppModule, { logger: false });
@@ -17,3 +19,29 @@ test("GET /healthz responde 200 ok", async () => {
     await app.close();
   }
 });
+
+test("middleware de observabilidade: correlation id propagado, /readyz sem versao e log sem sentinela", async () => {
+  const SENTINEL = "SENTINEL_api_c0ffee";
+  const meta = { service: "api", version: "9.9.9", env: "test" };
+  const logs: string[] = [];
+  const kit = createObservability({ ...meta, level: "debug", destination: { write: (l) => void logs.push(l) } }, { ...meta, enabled: false });
+  const app = await NestFactory.create(AppModule, { logger: false });
+  app.use(observabilityMiddleware(kit));
+  await app.listen(0, "127.0.0.1");
+  try {
+    const { port } = app.getHttpServer().address() as AddressInfo;
+    const res = await fetch(`http://127.0.0.1:${port}/readyz?token=${SENTINEL}`, {
+      headers: { "x-request-id": "edge-api-0001", authorization: `Bearer ${SENTINEL}` },
+    });
+    assert.equal(res.status, 200);
+    assert.equal(res.headers.get("x-request-id"), "edge-api-0001");
+    assert.deepEqual(await res.json(), { status: "ready", service: "api" });
+    await new Promise((r) => setTimeout(r, 50));
+    const record = JSON.parse(logs.find((l) => l.includes("http.request")) ?? "{}") as Record<string, unknown>;
+    assert.equal(record["correlation_id"], "edge-api-0001");
+    assert.equal((record["data"] as Record<string, unknown>)["route"], "/readyz");
+    assert.ok(!logs.join("").includes(SENTINEL));
+  } finally {
+    await app.close();
+  }
+});
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index dc6830e..c0fb412 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -1,9 +1,11 @@
 import "reflect-metadata";
 import { NestFactory } from "@nestjs/core";
 import { AppModule } from "./app.module.js";
+import { createApiObservability, observabilityMiddleware } from "./observability.js";
 
 const host = process.env["HOST"] ?? "127.0.0.1";
 const port = Number(process.env["PORT"] ?? 3001);
 const app = await NestFactory.create(AppModule);
+app.use(observabilityMiddleware(createApiObservability()));
 await app.listen(port, host);
 console.log(`api em http://${host}:${port}`);
diff --git a/apps/api/src/observability.ts b/apps/api/src/observability.ts
new file mode 100644
index 0000000..36bab84
--- /dev/null
+++ b/apps/api/src/observability.ts
@@ -0,0 +1,16 @@
+import type { IncomingMessage, ServerResponse } from "node:http";
+import { type Observability, createObservability, observeRequest, telemetryConfigFromEnv } from "@nucleos/observability";
+
+/** `req.route` e preenchido pelo Express ao casar a rota (sem depender de @types/express). */
+type ExpressLike = IncomingMessage & { route?: { path?: string } };
+
+export function createApiObservability(): Observability {
+  const meta = { service: "api", version: process.env["APP_VERSION"] ?? "0.0.0", env: process.env["APP_ENV"] ?? "local" };
+  return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
+}
+
+/** Middleware Express: correlation id, span, log e metricas RED; rota = template do Express. */
+export function observabilityMiddleware(kit: Observability) {
+  return (req: IncomingMessage, res: ServerResponse, next: () => void): void =>
+    observeRequest(kit, req, res, { routeOf: (r) => (r as ExpressLike).route?.path, quietRoutes: ["/healthz", "/readyz"] }, next);
+}
diff --git a/apps/tenant-provisioner/package.json b/apps/tenant-provisioner/package.json
index 6deb04b..0cbf7c3 100644
--- a/apps/tenant-provisioner/package.json
+++ b/apps/tenant-provisioner/package.json
@@ -9,5 +9,5 @@
     "test": "node --test \"dist/**/*.test.js\"",
     "start": "node dist/main.js"
   },
-  "dependencies": { "@nucleos/contracts": "workspace:*" }
+  "dependencies": { "@nucleos/contracts": "workspace:*", "@nucleos/observability": "workspace:*" }
 }
diff --git a/apps/tenant-provisioner/src/server.test.ts b/apps/tenant-provisioner/src/server.test.ts
index 3ee2c17..1ae5027 100644
--- a/apps/tenant-provisioner/src/server.test.ts
+++ b/apps/tenant-provisioner/src/server.test.ts
@@ -1,18 +1,52 @@
 import assert from "node:assert/strict";
 import type { AddressInfo } from "node:net";
 import { test } from "node:test";
+import { createObservability } from "@nucleos/observability";
 import { createHealthServer } from "./server.js";
 
-test("GET /healthz responde 200 ok", async () => {
-  const server = createHealthServer();
+const SENTINEL = "SENTINEL_provisioner_5ec7e7";
+const meta = { service: "tenant-provisioner", version: "9.9.9", env: "test" };
+
+async function withServer(fn: (base: string, logs: string[]) => Promise<void>): Promise<void> {
+  const logs: string[] = [];
+  const kit = createObservability({ ...meta, level: "debug", destination: { write: (l) => void logs.push(l) } }, { ...meta, enabled: false });
+  const server = createHealthServer("tenant-provisioner", kit, { self: () => true });
   await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
   const { port } = server.address() as AddressInfo;
   try {
-    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
-    assert.equal(res.status, 200);
-    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
-    assert.equal((await fetch(`http://127.0.0.1:${port}/outra`)).status, 404);
+    await fn(`http://127.0.0.1:${port}`, logs);
   } finally {
     server.close();
   }
+}
+
+test("GET /healthz responde 200 ok", async () => {
+  await withServer(async (base) => {
+    const res = await fetch(`${base}/healthz`);
+    assert.equal(res.status, 200);
+    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
+    assert.equal((await fetch(`${base}/outra`)).status, 404);
+  });
+});
+
+test("GET /readyz responde 200 ready sem expor versao", async () => {
+  await withServer(async (base) => {
+    const res = await fetch(`${base}/readyz`);
+    assert.equal(res.status, 200);
+    assert.deepEqual(await res.json(), { status: "ready", service: "tenant-provisioner" });
+  });
+});
+
+test("X-Request-Id da borda e propagado; nenhum sentinela aparece no log", async () => {
+  await withServer(async (base, logs) => {
+    const res = await fetch(`${base}/outra?token=${SENTINEL}`, {
+      headers: { "x-request-id": "edge-prov-0001", authorization: `Bearer ${SENTINEL}`, cookie: `s=${SENTINEL}` },
+    });
+    assert.equal(res.headers.get("x-request-id"), "edge-prov-0001");
+    await new Promise((r) => setTimeout(r, 50));
+    const record = JSON.parse(logs.find((l) => l.includes("http.request")) ?? "{}") as Record<string, unknown>;
+    assert.equal(record["correlation_id"], "edge-prov-0001");
+    assert.equal((record["data"] as Record<string, unknown>)["route"], "unmatched");
+    assert.ok(!logs.join("").includes(SENTINEL));
+  });
 });
diff --git a/apps/tenant-provisioner/src/server.ts b/apps/tenant-provisioner/src/server.ts
index c9987eb..356171b 100644
--- a/apps/tenant-provisioner/src/server.ts
+++ b/apps/tenant-provisioner/src/server.ts
@@ -1,13 +1,43 @@
 import { createServer, type Server } from "node:http";
-import { HEALTH_PATH, healthResponse } from "@nucleos/contracts";
+import {
+  type Observability,
+  type ReadinessChecks,
+  createObservability,
+  handleProbe,
+  observeHttp,
+  telemetryConfigFromEnv,
+} from "@nucleos/observability";
 
-export function createHealthServer(service = "tenant-provisioner"): Server {
-  return createServer((req, res) => {
-    if (req.method === "GET" && req.url === HEALTH_PATH) {
-      res.writeHead(200, { "content-type": "application/json" });
-      res.end(JSON.stringify(healthResponse(service)));
-      return;
-    }
-    res.writeHead(404).end();
-  });
+const SERVICE = "tenant-provisioner";
+const ROUTES = new Set(["/healthz", "/readyz"]);
+
+export function createDefaultObservability(service = SERVICE): Observability {
+  const meta = { service, version: process.env["APP_VERSION"] ?? "0.0.0", env: process.env["APP_ENV"] ?? "local" };
+  return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
+}
+
+export function createHealthServer(
+  service = SERVICE,
+  kit: Observability = createDefaultObservability(service),
+  checks: ReadinessChecks = {},
+): Server {
+  const handler = observeHttp(
+    kit,
+    (req, res) => {
+      void handleProbe(kit, service, req, res, checks).then((handled) => {
+        if (!handled) res.writeHead(404).end();
+      });
+    },
+    {
+      // Template de rota: caminho nao declarado vira "unmatched" (cardinalidade controlada).
+      routeOf: (req) => {
+        const path = (req.url ?? "").split("?")[0] ?? "";
+        return ROUTES.has(path) ? path : undefined;
+      },
+      quietRoutes: ["/healthz", "/readyz"],
+    },
+  );
+  const server = createServer(handler);
+  server.on("close", () => void kit.telemetry.shutdown());
+  return server;
 }
diff --git a/packages/observability-py/pyproject.toml b/packages/observability-py/pyproject.toml
new file mode 100644
index 0000000..2ddb437
--- /dev/null
+++ b/packages/observability-py/pyproject.toml
@@ -0,0 +1,18 @@
+[project]
+name = "nucleos-observability"
+version = "0.0.0"
+description = "Logging estruturado, redacao, correlation id, OpenTelemetry e RED (FND-009)"
+requires-python = ">=3.12"
+dependencies = [
+  "structlog==26.1.0",
+  "opentelemetry-api==1.45.1",
+  "opentelemetry-sdk==1.45.1",
+  "opentelemetry-exporter-otlp-proto-http==1.45.1",
+]
+
+[build-system]
+requires = ["uv_build>=0.13.5,<0.14"]
+build-backend = "uv_build"
+
+[tool.uv.build-backend]
+module-name = "nucleos_observability"
diff --git a/packages/observability-py/src/nucleos_observability/__init__.py b/packages/observability-py/src/nucleos_observability/__init__.py
new file mode 100644
index 0000000..572dc0b
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/__init__.py
@@ -0,0 +1,25 @@
+from nucleos_observability.context import (
+    CORRELATION_HEADER,
+    JobEnvelope,
+    RequestContext,
+    correlation_headers,
+    create_job_envelope,
+    current_context,
+    resolve_correlation_id,
+    run_job,
+    set_trusted_tenant,
+    use_context,
+)
+from nucleos_observability.http import Observability, make_handler, make_observability
+from nucleos_observability.logger import Logger
+from nucleos_observability.red import FORBIDDEN_LABELS, RedMetrics, create_business_counter
+from nucleos_observability.redact import REDACTED, SENSITIVE_KEYS, redact
+from nucleos_observability.telemetry import Telemetry, TelemetryConfig, telemetry_config_from_env
+
+__all__ = [
+    "CORRELATION_HEADER", "FORBIDDEN_LABELS", "JobEnvelope", "Logger", "Observability", "REDACTED",
+    "RedMetrics", "RequestContext", "SENSITIVE_KEYS", "Telemetry", "TelemetryConfig",
+    "correlation_headers", "create_business_counter", "create_job_envelope", "current_context",
+    "make_handler", "make_observability", "redact", "resolve_correlation_id", "run_job",
+    "set_trusted_tenant", "telemetry_config_from_env", "use_context",
+]
diff --git a/packages/observability-py/src/nucleos_observability/context.py b/packages/observability-py/src/nucleos_observability/context.py
new file mode 100644
index 0000000..03c1687
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/context.py
@@ -0,0 +1,82 @@
+"""Correlation id por contextvars (HTTP -> job -> log)."""
+
+import re
+import uuid
+from collections.abc import Callable
+from contextlib import contextmanager
+from contextvars import ContextVar
+from dataclasses import dataclass, field
+from datetime import UTC, datetime
+from typing import Any, Iterator
+
+from opentelemetry.trace import Span
+
+CORRELATION_HEADER = "x-request-id"
+_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{8,128}$")
+
+
+@dataclass
+class RequestContext:
+    correlation_id: str
+    actor_type: str = "anonymous"
+    tenant_id: str | None = None  # somente de fonte confiavel; nunca de header de cliente
+    span: Span | None = None
+
+
+_current: ContextVar[RequestContext | None] = ContextVar("nucleos_request_context", default=None)
+
+
+def current_context() -> RequestContext | None:
+    return _current.get()
+
+
+@contextmanager
+def use_context(ctx: RequestContext) -> Iterator[RequestContext]:
+    token = _current.set(ctx)
+    try:
+        yield ctx
+    finally:
+        _current.reset(token)
+
+
+def set_trusted_tenant(tenant_id: str, actor_type: str = "user") -> None:
+    ctx = _current.get()
+    if ctx is not None:
+        ctx.tenant_id = tenant_id
+        ctx.actor_type = actor_type
+
+
+def resolve_correlation_id(header: str | None, trust_edge: bool = True) -> str:
+    """Aceita X-Request-Id da borda confiavel se tiver formato seguro; senao gera UUID."""
+    if trust_edge and header is not None and _VALID_ID.match(header):
+        return header
+    return str(uuid.uuid4())
+
+
+def correlation_headers() -> dict[str, str]:
+    ctx = _current.get()
+    return {CORRELATION_HEADER: ctx.correlation_id} if ctx else {}
+
+
+@dataclass
+class JobEnvelope:
+    """Envelope minimo de job; FND-003 (contracts) pode substitui-lo mantendo correlation_id."""
+
+    type: str
+    payload: Any
+    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
+    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
+    enqueued_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
+
+
+def create_job_envelope(job_type: str, payload: Any) -> JobEnvelope:
+    ctx = _current.get()
+    if ctx is None:
+        return JobEnvelope(type=job_type, payload=payload)
+    return JobEnvelope(type=job_type, payload=payload, correlation_id=ctx.correlation_id)
+
+
+def run_job[T](envelope: JobEnvelope, fn: Callable[[JobEnvelope], T]) -> T:
+    cid = envelope.correlation_id if _VALID_ID.match(envelope.correlation_id) else str(uuid.uuid4())
+    with use_context(RequestContext(correlation_id=cid, actor_type="system")):
+        return fn(envelope)
diff --git a/packages/observability-py/src/nucleos_observability/http.py b/packages/observability-py/src/nucleos_observability/http.py
new file mode 100644
index 0000000..54b906b
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/http.py
@@ -0,0 +1,100 @@
+"""Handler HTTP (stdlib) observado: correlation id, span, log, RED e sondas /healthz e /readyz."""
+
+import json
+import time
+from collections.abc import Callable, Mapping
+from dataclasses import dataclass
+from http.server import BaseHTTPRequestHandler
+
+from opentelemetry.trace import SpanKind, StatusCode
+
+from nucleos_observability.context import CORRELATION_HEADER, RequestContext, resolve_correlation_id, use_context
+from nucleos_observability.logger import Logger
+from nucleos_observability.red import RedMetrics, RedSample
+from nucleos_observability.telemetry import Telemetry
+
+ReadinessChecks = Mapping[str, Callable[[], bool]]
+PROBES = ("/healthz", "/readyz")
+
+
+@dataclass
+class Observability:
+    logger: Logger
+    telemetry: Telemetry
+    red: RedMetrics
+
+
+def make_observability(logger: Logger, telemetry: Telemetry) -> Observability:
+    return Observability(logger=logger, telemetry=telemetry, red=RedMetrics(telemetry.meter))
+
+
+def make_handler(
+    kit: Observability,
+    service: str,
+    checks: ReadinessChecks | None = None,
+    trust_edge: bool = True,
+) -> type[BaseHTTPRequestHandler]:
+    """Cria o handler do servico. Rotas conhecidas: apenas as sondas; o resto e `unmatched`."""
+    readiness = dict(checks or {})
+
+    class Handler(BaseHTTPRequestHandler):
+        def do_GET(self) -> None:  # noqa: N802 - API da stdlib
+            correlation_id = resolve_correlation_id(self.headers.get(CORRELATION_HEADER), trust_edge)
+            started = time.perf_counter()
+            span = kit.telemetry.tracer.start_span(
+                "HTTP GET",
+                kind=SpanKind.SERVER,
+                attributes={"http.request.method": "GET", "nucleos.correlation_id": correlation_id},
+            )
+            path = self.path.split("?", 1)[0]
+            route = path if path in PROBES else None
+            with use_context(RequestContext(correlation_id=correlation_id, span=span)):
+                status = self._dispatch(route, correlation_id)
+                duration_ms = (time.perf_counter() - started) * 1000
+                span.update_name(f"HTTP GET {route or 'unmatched'}")
+                span.set_attribute("http.route", route or "unmatched")
+                span.set_attribute("http.response.status_code", status)
+                if status >= 500:
+                    span.set_status(StatusCode.ERROR)
+                kit.red.record(RedSample("GET", route, status, duration_ms))
+                level = "debug" if route in PROBES and status < 500 else "info"
+                kit.logger.log(
+                    level,
+                    "http.request",
+                    {"method": "GET", "route": route or "unmatched", "status": status, "duration_ms": round(duration_ms)},
+                )
+            span.end()
+
+        def _dispatch(self, route: str | None, correlation_id: str) -> int:
+            if route == "/healthz":
+                return self._send(200, {"status": "ok", "service": service}, correlation_id)
+            if route == "/readyz":
+                ready = True
+                for name, check in readiness.items():
+                    try:
+                        ok = bool(check())
+                    except Exception:  # noqa: BLE001 - dependencia quebrada => nao pronto
+                        ok = False
+                    if not ok:
+                        ready = False
+                        kit.logger.log("warning", "readiness.check_failed", {"check": name})
+                body = {"status": "ready" if ready else "not_ready", "service": service}
+                return self._send(200 if ready else 503, body, correlation_id)
+            return self._send(404, None, correlation_id)
+
+        def _send(self, code: int, body: dict[str, str] | None, correlation_id: str) -> int:
+            payload = json.dumps(body).encode() if body is not None else b""
+            self.send_response(code)
+            self.send_header(CORRELATION_HEADER, correlation_id)
+            if body is not None:
+                self.send_header("content-type", "application/json")
+                self.send_header("cache-control", "no-store")
+            self.send_header("content-length", str(len(payload)))
+            self.end_headers()
+            self.wfile.write(payload)
+            return code
+
+        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - log padrao silenciado
+            return
+
+    return Handler
diff --git a/packages/observability-py/src/nucleos_observability/logger.py b/packages/observability-py/src/nucleos_observability/logger.py
new file mode 100644
index 0000000..b1923b6
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/logger.py
@@ -0,0 +1,60 @@
+"""Logging estruturado JSON (structlog) com campos fixos e redacao por allowlist."""
+
+import sys
+from datetime import UTC, datetime
+from typing import Any, TextIO
+
+import structlog
+
+from nucleos_observability.context import current_context
+from nucleos_observability.redact import redact
+
+DEFAULT_ALLOWLIST = ("method", "route", "status", "duration_ms", "check", "job_type")
+_LEVELS = {"debug": 10, "info": 20, "warning": 30, "error": 40}
+
+
+class Logger:
+    """Campos fixos: ts, level, service, version, env, trace_id, span_id, correlation_id,
+    tenant_id, actor_type, event (+ `data` redigido)."""
+
+    def __init__(
+        self,
+        service: str,
+        version: str,
+        env: str,
+        level: str = "info",
+        allowlist: tuple[str, ...] = (),
+        stream: TextIO | None = None,
+    ) -> None:
+        self._allowlist = (*DEFAULT_ALLOWLIST, *allowlist)
+        self._base = {"service": service, "version": version, "env": env}
+        self._log = structlog.wrap_logger(
+            structlog.PrintLogger(file=stream or sys.stdout),
+            processors=[self._build, structlog.processors.JSONRenderer(sort_keys=False)],
+            wrapper_class=structlog.make_filtering_bound_logger(_LEVELS[level]),
+        )
+
+    def _build(self, _logger: Any, method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
+        ctx = current_context()
+        span_ctx = ctx.span.get_span_context() if ctx and ctx.span else None
+        record: dict[str, Any] = {
+            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
+            "level": method_name,
+            **self._base,
+            "trace_id": format(span_ctx.trace_id, "032x") if span_ctx and span_ctx.is_valid else None,
+            "span_id": format(span_ctx.span_id, "016x") if span_ctx and span_ctx.is_valid else None,
+            "correlation_id": ctx.correlation_id if ctx else None,
+            "tenant_id": ctx.tenant_id if ctx else None,
+            "actor_type": ctx.actor_type if ctx else None,
+            "event": event_dict["event"],
+        }
+        if "data" in event_dict:
+            record["data"] = redact(event_dict["data"], self._allowlist)
+        return record
+
+    def log(self, level: str, event: str, data: Any = None) -> None:
+        method = getattr(self._log, level)
+        if data is None:
+            method(event)
+        else:
+            method(event, data=data)
diff --git a/packages/observability-py/src/nucleos_observability/red.py b/packages/observability-py/src/nucleos_observability/red.py
new file mode 100644
index 0000000..4e8989a
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/red.py
@@ -0,0 +1,56 @@
+"""Metricas RED com cardinalidade controlada."""
+
+from collections.abc import Mapping, Sequence
+from dataclasses import dataclass
+from typing import Callable
+
+from opentelemetry.metrics import Meter
+
+METHODS = frozenset({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
+FORBIDDEN_LABELS = frozenset(
+    {"tenant_id", "user_id", "actor_id", "correlation_id", "request_id", "trace_id", "span_id", "url", "path", "ip"}
+)
+
+
+@dataclass
+class RedSample:
+    method: str
+    route: str | None  # template da rota, nunca a URL crua; None => "unmatched"
+    status: int
+    duration_ms: float
+
+
+class RedMetrics:
+    """Rate, Errors e Duration; labels limitados a method, route (template) e status_class."""
+
+    def __init__(self, meter: Meter) -> None:
+        self._requests = meter.create_counter("http.server.requests", description="Requisicoes HTTP (rate)")
+        self._errors = meter.create_counter("http.server.errors", description="Respostas 5xx (errors)")
+        self._duration = meter.create_histogram("http.server.request.duration", unit="s", description="Duracao")
+
+    def record(self, sample: RedSample) -> None:
+        attributes = {
+            "method": sample.method if sample.method in METHODS else "OTHER",
+            "route": sample.route or "unmatched",
+            "status_class": f"{sample.status // 100}xx",
+        }
+        self._requests.add(1, attributes)
+        if sample.status >= 500:
+            self._errors.add(1, attributes)
+        self._duration.record(sample.duration_ms / 1000, attributes)
+
+
+def create_business_counter(
+    meter: Meter, name: str, labels: Mapping[str, Sequence[str]]
+) -> Callable[[int, Mapping[str, str] | None], None]:
+    """Contador de negocio: so labels enumerados; valor fora do conjunto vira "other"."""
+    for label in labels:
+        if label in FORBIDDEN_LABELS:
+            raise ValueError(f"label proibido por cardinalidade: {label}")
+    counter = meter.create_counter(name)
+
+    def add(value: int, values: Mapping[str, str] | None = None) -> None:
+        given = values or {}
+        counter.add(value, {k: (given[k] if given.get(k) in allowed else "other") for k, allowed in labels.items()})
+
+    return add
diff --git a/packages/observability-py/src/nucleos_observability/redact.py b/packages/observability-py/src/nucleos_observability/redact.py
new file mode 100644
index 0000000..1228310
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/redact.py
@@ -0,0 +1,67 @@
+"""Redacao por allowlist: so campos explicitamente permitidos chegam ao log."""
+
+import re
+from collections.abc import Iterable
+from typing import Any
+
+REDACTED = "[REDACTED]"
+SENSITIVE_KEYS = frozenset(
+    {"authorization", "cookie", "set_cookie", "password", "token", "secret", "prompt", "content", "api_key"}
+)
+_SENSITIVE_PATTERN = re.compile(
+    r"authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session",
+    re.IGNORECASE,
+)
+_VALUE_PATTERNS = (re.compile(r"\bBearer\s+\S+", re.IGNORECASE), re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]*"))
+_MAX_DEPTH = 4
+_MAX_ITEMS = 20
+_MAX_STRING = 256
+_DROPPED = "_dropped"
+
+
+def _normalize(key: str) -> str:
+    return key.lower().replace("-", "_")
+
+
+def _scrub(value: str) -> str:
+    out = value[:_MAX_STRING] + "..." if len(value) > _MAX_STRING else value
+    for pattern in _VALUE_PATTERNS:
+        out = pattern.sub(REDACTED, out)
+    return out
+
+
+def redact(value: Any, allowlist: Iterable[str], depth: int = 0) -> Any:
+    """Mesmas regras da biblioteca TS: chave sensivel => [REDACTED] (nome so se conhecido ou
+    permitido); chave fora da allowlist => descartada e contada em `_dropped`; excecoes viram
+    apenas o nome da classe."""
+    allowed = frozenset(_normalize(k) for k in allowlist)
+    return _walk(value, allowed, depth)
+
+
+def _walk(value: Any, allowed: frozenset[str], depth: int) -> Any:
+    if value is None or isinstance(value, bool | int | float):
+        return value
+    if isinstance(value, str):
+        return _scrub(value)
+    if isinstance(value, BaseException):
+        return {"name": type(value).__name__}
+    if depth >= _MAX_DEPTH:
+        return "[TRUNCATED]"
+    if isinstance(value, list | tuple):
+        return [_walk(item, allowed, depth + 1) for item in value[:_MAX_ITEMS]]
+    if isinstance(value, dict):
+        out: dict[str, Any] = {}
+        dropped = 0
+        for raw_key, child in value.items():
+            key = _normalize(str(raw_key))
+            is_allowed = key in allowed
+            if key in SENSITIVE_KEYS or (is_allowed and _SENSITIVE_PATTERN.search(key)):
+                out[key] = REDACTED
+            elif not is_allowed or _SENSITIVE_PATTERN.search(key):
+                dropped += 1
+            else:
+                out[key] = _walk(child, allowed, depth + 1)
+        if dropped:
+            out[_DROPPED] = dropped
+        return out
+    return "[UNSUPPORTED]"
diff --git a/packages/observability-py/src/nucleos_observability/telemetry.py b/packages/observability-py/src/nucleos_observability/telemetry.py
new file mode 100644
index 0000000..374b685
--- /dev/null
+++ b/packages/observability-py/src/nucleos_observability/telemetry.py
@@ -0,0 +1,88 @@
+"""OpenTelemetry (traces + metricas); OTLP/HTTP configuravel e no-op quando desabilitado."""
+
+from collections.abc import Mapping
+from dataclasses import dataclass, field
+
+from opentelemetry.metrics import Meter, NoOpMeterProvider
+from opentelemetry.sdk.metrics import MeterProvider
+from opentelemetry.sdk.metrics.export import MetricReader, PeriodicExportingMetricReader
+from opentelemetry.sdk.resources import Resource
+from opentelemetry.sdk.trace import SpanProcessor, TracerProvider
+from opentelemetry.sdk.trace.export import BatchSpanProcessor
+from opentelemetry.trace import NoOpTracerProvider, Tracer
+
+_SCOPE = "nucleos_observability"
+
+
+@dataclass
+class TelemetryConfig:
+    enabled: bool
+    service: str
+    version: str
+    env: str
+    otlp_endpoint: str | None = None  # base OTLP/HTTP, ex.: http://127.0.0.1:4318
+    metric_interval_ms: int = 15000
+    span_processors: list[SpanProcessor] = field(default_factory=list)  # injecao em testes
+    metric_readers: list[MetricReader] = field(default_factory=list)
+
+
+def telemetry_config_from_env(
+    environ: Mapping[str, str], service: str, version: str, env: str
+) -> TelemetryConfig:
+    endpoint = environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or None
+    disabled = environ.get("OTEL_SDK_DISABLED") == "true"
+    return TelemetryConfig(
+        enabled=not disabled and endpoint is not None,
+        service=service,
+        version=version,
+        env=env,
+        otlp_endpoint=endpoint.rstrip("/") if endpoint else None,
+    )
+
+
+class Telemetry:
+    def __init__(self, config: TelemetryConfig) -> None:
+        self.enabled = config.enabled
+        self._tracer_provider: TracerProvider | None = None
+        self._meter_provider: MeterProvider | None = None
+        if not config.enabled:
+            self.tracer: Tracer = NoOpTracerProvider().get_tracer(_SCOPE)
+            self.meter: Meter = NoOpMeterProvider().get_meter(_SCOPE)
+            return
+        resource = Resource.create(
+            {
+                "service.name": config.service,
+                "service.version": config.version,
+                "deployment.environment.name": config.env,
+            }
+        )
+        processors = list(config.span_processors)
+        readers = list(config.metric_readers)
+        if config.otlp_endpoint:
+            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
+            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
+
+            processors.append(
+                BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{config.otlp_endpoint}/v1/traces", timeout=2))
+            )
+            readers.append(
+                PeriodicExportingMetricReader(
+                    OTLPMetricExporter(endpoint=f"{config.otlp_endpoint}/v1/metrics", timeout=2),
+                    export_interval_millis=config.metric_interval_ms,
+                )
+            )
+        self._tracer_provider = TracerProvider(resource=resource)
+        for processor in processors:
+            self._tracer_provider.add_span_processor(processor)
+        self._meter_provider = MeterProvider(resource=resource, metric_readers=readers)
+        self.tracer = self._tracer_provider.get_tracer(_SCOPE, config.version)
+        self.meter = self._meter_provider.get_meter(_SCOPE, config.version)
+
+    def shutdown(self) -> None:
+        """Falha de exportacao nunca derruba o encerramento do servico."""
+        for provider in (self._tracer_provider, self._meter_provider):
+            if provider is not None:
+                try:
+                    provider.shutdown()
+                except Exception:  # noqa: BLE001 - telemetria e best-effort
+                    pass
diff --git a/packages/observability-py/tests/test_observability.py b/packages/observability-py/tests/test_observability.py
new file mode 100644
index 0000000..5144bf7
--- /dev/null
+++ b/packages/observability-py/tests/test_observability.py
@@ -0,0 +1,183 @@
+import io
+import json
+import random
+import threading
+import urllib.request
+
+from opentelemetry.sdk.metrics.export import InMemoryMetricReader
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
+import urllib.error
+import pytest
+
+from nucleos_observability import (
+    REDACTED,
+    SENSITIVE_KEYS,
+    Logger,
+    Telemetry,
+    TelemetryConfig,
+    create_business_counter,
+    create_job_envelope,
+    make_handler,
+    make_observability,
+    redact,
+    resolve_correlation_id,
+    run_job,
+    telemetry_config_from_env,
+)
+from http.server import HTTPServer
+
+ALLOWED = ["method", "route", "status", "note"]
+SENSITIVE = [*SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"]
+OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"]
+
+
+def test_propriedade_nenhum_sentinela_sobrevive() -> None:
+    rnd = random.Random(20261025)
+    sentinels: list[str] = []
+
+    def sentinel() -> str:
+        s = f"SENTINEL_{len(sentinels)}_{rnd.randrange(10**9):x}"
+        sentinels.append(s)
+        return s
+
+    def wrap(v: object) -> object:
+        r = rnd.random()
+        if r < 0.3:
+            return [v, {"deep": v}]
+        return {"a": {"b": {"c": {"d": v}}}} if r < 0.5 else v
+
+    def gen(depth: int) -> dict[str, object]:
+        obj: dict[str, object] = {}
+        for _ in range(rnd.randint(1, 5)):
+            r = rnd.random()
+            if r < 0.35:
+                obj[rnd.choice(SENSITIVE)] = wrap(sentinel())
+            elif r < 0.6:
+                obj[rnd.choice(OTHER)] = wrap(sentinel())
+            elif r < 0.75 and depth < 3:
+                obj[rnd.choice(ALLOWED)] = gen(depth + 1)
+            elif r < 0.85:
+                obj[rnd.choice(ALLOWED)] = f"Bearer {sentinel()}"
+            else:
+                obj[rnd.choice(ALLOWED)] = rnd.randrange(100)
+        return obj
+
+    for _ in range(500):
+        sentinels.clear()
+        out = json.dumps(redact(gen(0), ALLOWED))
+        for s in sentinels:
+            assert s not in out
+
+
+def test_chave_sensivel_na_allowlist_continua_redigida() -> None:
+    out = redact({"authorization": "x", "token": "y", "note": "ok", "foo": "z"}, ["token", "note"])
+    assert out == {"authorization": REDACTED, "token": REDACTED, "note": "ok", "_dropped": 1}
+    assert "senha" not in json.dumps(redact({"note": ValueError("senha=abc")}, ["note"]))
+
+
+def test_correlation_id() -> None:
+    assert resolve_correlation_id("edge-req-1234") == "edge-req-1234"
+    assert len(resolve_correlation_id(None)) == 36
+    assert len(resolve_correlation_id("x\ninjetado")) == 36
+    assert len(resolve_correlation_id("edge-req-1234", trust_edge=False)) == 36
+
+
+def _get(url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str]]:
+    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {})) as res:
+        return res.status, dict(res.headers)
+
+
+def test_ac1_log_metrica_e_trace_correlacionados_http_job_log() -> None:
+    spans = InMemorySpanExporter()
+    reader = InMemoryMetricReader()
+    cfg = TelemetryConfig(
+        enabled=True, service="svc", version="9.9.9", env="test",
+        span_processors=[SimpleSpanProcessor(spans)], metric_readers=[reader],
+    )
+    out = io.StringIO()
+    telemetry = Telemetry(cfg)
+    kit = make_observability(Logger("svc", "9.9.9", "test", level="debug", stream=out), telemetry)
+    server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc"))
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    try:
+        url = f"http://127.0.0.1:{server.server_address[1]}/healthz"
+        status, headers = _get(url, {"x-request-id": "edge-req-1234"})
+        assert status == 200 and headers["x-request-id"] == "edge-req-1234"
+    finally:
+        server.shutdown()
+        server.server_close()
+    records = [json.loads(line) for line in out.getvalue().splitlines()]
+    http_log = records[0]
+    for field in ("ts", "level", "service", "version", "env", "trace_id", "span_id",
+                  "correlation_id", "tenant_id", "actor_type", "event"):
+        assert field in http_log
+    assert http_log["correlation_id"] == "edge-req-1234"
+    span = spans.get_finished_spans()[0]
+    assert span.attributes["nucleos.correlation_id"] == "edge-req-1234"
+    assert format(span.context.trace_id, "032x") == http_log["trace_id"]
+    assert format(span.context.span_id, "016x") == http_log["span_id"]
+    data = reader.get_metrics_data()
+    names = {m.name: m for rm in data.resource_metrics for sm in rm.scope_metrics for m in sm.metrics}
+    point = names["http.server.requests"].data.data_points[0]
+    assert dict(point.attributes) == {"method": "GET", "route": "/healthz", "status_class": "2xx"}
+    assert "http.server.request.duration" in names
+
+    # job: envelope criado dentro de um contexto herda o correlation_id e o restaura no worker
+    from nucleos_observability import RequestContext, use_context
+
+    with use_context(RequestContext(correlation_id="edge-req-1234")):
+        envelope = create_job_envelope("demo.job", {"n": 1})
+    assert envelope.correlation_id == "edge-req-1234"
+    out2 = io.StringIO()
+    log = Logger("svc", "9.9.9", "test", stream=out2)
+    run_job(envelope, lambda e: log.log("info", "job.done", {"job_type": e.type}))
+    job_log = json.loads(out2.getvalue())
+    assert job_log["correlation_id"] == "edge-req-1234" and job_log["actor_type"] == "system"
+    telemetry.shutdown()
+
+
+def test_readyz_503_sem_detalhes() -> None:
+    cfg = TelemetryConfig(enabled=False, service="svc", version="9.9.9", env="test")
+    kit = make_observability(Logger("svc", "9.9.9", "test", stream=io.StringIO()), Telemetry(cfg))
+    server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc", {"db": lambda: False}))
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    try:
+        with pytest.raises(urllib.error.HTTPError) as err:
+            urllib.request.urlopen(f"http://127.0.0.1:{server.server_address[1]}/readyz")
+        body = err.value.read().decode()
+        assert err.value.code == 503
+        assert json.loads(body) == {"status": "not_ready", "service": "svc"}
+    finally:
+        server.shutdown()
+        server.server_close()
+
+
+def test_ac3_otlp_inalcancavel_ou_desabilitado_nao_derruba() -> None:
+    assert telemetry_config_from_env({}, "s", "1", "t").enabled is False
+    assert telemetry_config_from_env(
+        {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://x:1", "OTEL_SDK_DISABLED": "true"}, "s", "1", "t"
+    ).enabled is False
+    for enabled in (False, True):
+        cfg = TelemetryConfig(enabled=enabled, service="svc", version="1", env="t",
+                              otlp_endpoint="http://127.0.0.1:1", metric_interval_ms=50)
+        tel = Telemetry(cfg)
+        kit = make_observability(Logger("svc", "1", "t", stream=io.StringIO()), tel)
+        server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc"))
+        threading.Thread(target=server.serve_forever, daemon=True).start()
+        try:
+            url = f"http://127.0.0.1:{server.server_address[1]}/healthz"
+            assert _get(url)[0] == 200
+            assert _get(url)[0] == 200
+        finally:
+            server.shutdown()
+            server.server_close()
+            tel.shutdown()
+
+
+def test_cardinalidade_label_proibido() -> None:
+    cfg = TelemetryConfig(enabled=False, service="s", version="1", env="t")
+    meter = Telemetry(cfg).meter
+    with pytest.raises(ValueError):
+        create_business_counter(meter, "x", {"tenant_id": ["a"]})
+    create_business_counter(meter, "orders", {"outcome": ["ok", "error"]})(1, {"outcome": "qualquer"})
diff --git a/packages/observability/package.json b/packages/observability/package.json
new file mode 100644
index 0000000..47506a4
--- /dev/null
+++ b/packages/observability/package.json
@@ -0,0 +1,23 @@
+{
+  "name": "@nucleos/observability",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "main": "./dist/index.js",
+  "types": "./dist/index.d.ts",
+  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
+  "scripts": {
+    "build": "tsc -p tsconfig.json",
+    "lint": "tsc -p tsconfig.json --noEmit",
+    "test": "node --test \"dist/**/*.test.js\""
+  },
+  "dependencies": {
+    "@opentelemetry/api": "1.10.0",
+    "@opentelemetry/exporter-metrics-otlp-http": "0.300.0",
+    "@opentelemetry/exporter-trace-otlp-http": "0.300.0",
+    "@opentelemetry/resources": "3.0.0",
+    "@opentelemetry/sdk-metrics": "3.0.0",
+    "@opentelemetry/sdk-trace": "3.0.0",
+    "pino": "10.4.0"
+  }
+}
diff --git a/packages/observability/src/context.ts b/packages/observability/src/context.ts
new file mode 100644
index 0000000..4d1e8e6
--- /dev/null
+++ b/packages/observability/src/context.ts
@@ -0,0 +1,76 @@
+import { AsyncLocalStorage } from "node:async_hooks";
+import { randomUUID } from "node:crypto";
+import type { Span } from "@opentelemetry/api";
+
+export const CORRELATION_HEADER = "x-request-id";
+export type ActorType = "user" | "service" | "system" | "anonymous";
+
+export interface RequestContext {
+  correlationId: string;
+  /** Somente de fonte confiavel (autenticacao); nunca de header de cliente. */
+  tenantId?: string;
+  actorType: ActorType;
+  span?: Span;
+}
+
+const storage = new AsyncLocalStorage<RequestContext>();
+const VALID_ID = /^[A-Za-z0-9._-]{8,128}$/;
+
+export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
+  return storage.run(ctx, fn);
+}
+
+export function currentContext(): RequestContext | undefined {
+  return storage.getStore();
+}
+
+/** Marca o tenant resolvido por fonte confiavel (ex.: token validado) no contexto corrente. */
+export function setTrustedTenant(tenantId: string, actorType: ActorType = "user"): void {
+  const ctx = storage.getStore();
+  if (ctx) {
+    ctx.tenantId = tenantId;
+    ctx.actorType = actorType;
+  }
+}
+
+/**
+ * Aceita `X-Request-Id` da borda confiavel apenas se tiver formato seguro (evita injecao em log);
+ * ausente, invalido ou `trustEdge=false` => UUID novo.
+ */
+export function resolveCorrelationId(header: string | string[] | undefined, trustEdge = true): string {
+  const candidate = Array.isArray(header) ? header[0] : header;
+  if (trustEdge && candidate !== undefined && VALID_ID.test(candidate)) return candidate;
+  return randomUUID();
+}
+
+/** Cabecalhos para chamadas HTTP de saida do contexto corrente. */
+export function correlationHeaders(): Record<string, string> {
+  const ctx = storage.getStore();
+  return ctx ? { [CORRELATION_HEADER]: ctx.correlationId } : {};
+}
+
+/** Envelope minimo de job; FND-003 (contracts) pode substitui-lo mantendo `correlation_id`. */
+export interface JobEnvelope<T = unknown> {
+  job_id: string;
+  type: string;
+  correlation_id: string;
+  enqueued_at: string;
+  payload: T;
+}
+
+export function createJobEnvelope<T>(type: string, payload: T): JobEnvelope<T> {
+  const ctx = storage.getStore();
+  return {
+    job_id: randomUUID(),
+    type,
+    correlation_id: ctx?.correlationId ?? randomUUID(),
+    enqueued_at: new Date().toISOString(),
+    payload,
+  };
+}
+
+/** Executa o job restaurando o `correlation_id` do envelope (propagacao HTTP -> job -> log). */
+export function runJob<T, R>(envelope: JobEnvelope<T>, fn: (envelope: JobEnvelope<T>) => R): R {
+  const correlationId = VALID_ID.test(envelope.correlation_id) ? envelope.correlation_id : randomUUID();
+  return storage.run({ correlationId, actorType: "system" }, () => fn(envelope));
+}
diff --git a/packages/observability/src/http.ts b/packages/observability/src/http.ts
new file mode 100644
index 0000000..8feb231
--- /dev/null
+++ b/packages/observability/src/http.ts
@@ -0,0 +1,105 @@
+import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
+import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
+import { CORRELATION_HEADER, resolveCorrelationId, runWithContext } from "./context.js";
+import { type Logger, createLogger, type LoggerOptions } from "./logger.js";
+import { RedMetrics } from "./red.js";
+import { type Telemetry, type TelemetryConfig, createTelemetry } from "./telemetry.js";
+
+export interface Observability {
+  logger: Logger;
+  telemetry: Telemetry;
+  red: RedMetrics;
+}
+
+export function createObservability(logger: LoggerOptions, telemetry: TelemetryConfig): Observability {
+  const t = createTelemetry(telemetry);
+  return { logger: createLogger(logger), telemetry: t, red: new RedMetrics(t.meter) };
+}
+
+export interface ObserveOptions {
+  /** Template da rota, avaliado ao final da resposta (ex.: `req.route.path` no Express). */
+  routeOf: (req: IncomingMessage) => string | undefined;
+  /** `X-Request-Id` so e aceito quando a borda e confiavel (FND-007 define o proxy). */
+  trustEdge?: boolean;
+  /** Rotas de sonda (nao poluem o log em nivel info). */
+  quietRoutes?: readonly string[];
+}
+
+/** Nucleo comum a `node:http` e Express: contexto, span, log e metricas RED por requisicao. */
+export function observeRequest(
+  kit: Observability,
+  req: IncomingMessage,
+  res: ServerResponse,
+  options: ObserveOptions,
+  next: () => void,
+): void {
+  const correlationId = resolveCorrelationId(req.headers[CORRELATION_HEADER], options.trustEdge ?? true);
+  const method = req.method ?? "GET";
+  const started = performance.now();
+  const span = kit.telemetry.tracer.startSpan(`HTTP ${method}`, {
+    kind: SpanKind.SERVER,
+    attributes: { "http.request.method": method, "nucleos.correlation_id": correlationId },
+  });
+  res.setHeader(CORRELATION_HEADER, correlationId);
+  res.once("close", () => {
+    const route = options.routeOf(req);
+    const status = res.statusCode;
+    const durationMs = performance.now() - started;
+    span.updateName(`HTTP ${method} ${route ?? "unmatched"}`);
+    span.setAttribute("http.route", route ?? "unmatched");
+    span.setAttribute("http.response.status_code", status);
+    if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
+    runWithContext({ correlationId, actorType: "anonymous", span }, () => {
+      kit.red.record({ method, route, status, durationMs });
+      const quiet = route !== undefined && (options.quietRoutes ?? []).includes(route);
+      kit.logger.log(quiet && status < 500 ? "debug" : "info", "http.request", {
+        method,
+        route: route ?? "unmatched",
+        status,
+        duration_ms: Math.round(durationMs),
+      });
+    });
+    span.end();
+  });
+  runWithContext({ correlationId, actorType: "anonymous", span }, next);
+}
+
+export function observeHttp(kit: Observability, handler: RequestListener, options: ObserveOptions): RequestListener {
+  return (req, res) => observeRequest(kit, req, res, options, () => handler(req, res));
+}
+
+export type ReadinessChecks = Readonly<Record<string, () => Promise<boolean> | boolean>>;
+
+/** `/healthz` (vivo) e `/readyz` (dependencias criticas). Corpo sem versoes nem detalhes internos. */
+export async function handleProbe(
+  kit: Observability,
+  service: string,
+  req: IncomingMessage,
+  res: ServerResponse,
+  checks: ReadinessChecks = {},
+): Promise<boolean> {
+  if (req.method !== "GET") return false;
+  const path = (req.url ?? "").split("?")[0];
+  if (path === "/healthz") return sendProbe(res, 200, "ok", service);
+  if (path !== "/readyz") return false;
+  let ready = true;
+  for (const [name, check] of Object.entries(checks)) {
+    let ok = false;
+    try {
+      ok = await Promise.race([Promise.resolve(check()), new Promise<boolean>((r) => setTimeout(() => r(false), 2000).unref())]);
+    } catch {
+      ok = false;
+    }
+    if (!ok) {
+      ready = false;
+      kit.logger.log("warn", "readiness.check_failed", { check: name });
+    }
+  }
+  return sendProbe(res, ready ? 200 : 503, ready ? "ready" : "not_ready", service);
+}
+
+function sendProbe(res: ServerResponse, code: number, status: string, service: string): true {
+  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
+  res.end(JSON.stringify({ status, service }));
+  return true;
+}
diff --git a/packages/observability/src/index.ts b/packages/observability/src/index.ts
new file mode 100644
index 0000000..33ed0e5
--- /dev/null
+++ b/packages/observability/src/index.ts
@@ -0,0 +1,6 @@
+export * from "./context.js";
+export * from "./http.js";
+export * from "./logger.js";
+export * from "./red.js";
+export * from "./redact.js";
+export * from "./telemetry.js";
diff --git a/packages/observability/src/logger.ts b/packages/observability/src/logger.ts
new file mode 100644
index 0000000..73f7714
--- /dev/null
+++ b/packages/observability/src/logger.ts
@@ -0,0 +1,54 @@
+import { pino } from "pino";
+import { currentContext } from "./context.js";
+import { redact } from "./redact.js";
+
+/** Campos operacionais emitidos pela propria biblioteca (valores controlados pelo codigo). */
+export const DEFAULT_ALLOWLIST = ["method", "route", "status", "duration_ms", "check", "job_type"] as const;
+
+export type LogLevel = "debug" | "info" | "warn" | "error";
+
+export interface LoggerOptions {
+  service: string;
+  version: string;
+  env: string;
+  level?: LogLevel;
+  /** Campos permitidos em `data`; o restante e descartado (ver `redact`). */
+  allowlist?: readonly string[];
+  destination?: { write(line: string): void };
+}
+
+export interface Logger {
+  log(level: LogLevel, event: string, data?: unknown): void;
+}
+
+/** Campos fixos: ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event. */
+export function createLogger(options: LoggerOptions): Logger {
+  const allowlist = [...DEFAULT_ALLOWLIST, ...(options.allowlist ?? [])];
+  const base = pino(
+    {
+      level: options.level ?? "info",
+      base: { service: options.service, version: options.version, env: options.env },
+      messageKey: "event",
+      timestamp: () => `,"ts":"${new Date().toISOString()}"`,
+      formatters: { level: (label) => ({ level: label }) },
+      mixin() {
+        const ctx = currentContext();
+        const spanContext = ctx?.span?.spanContext();
+        return {
+          trace_id: spanContext?.traceId ?? null,
+          span_id: spanContext?.spanId ?? null,
+          correlation_id: ctx?.correlationId ?? null,
+          tenant_id: ctx?.tenantId ?? null,
+          actor_type: ctx?.actorType ?? null,
+        };
+      },
+    },
+    options.destination ?? process.stdout,
+  );
+  return {
+    log(level, event, data) {
+      if (data === undefined) base[level](event);
+      else base[level]({ data: redact(data, allowlist) }, event);
+    },
+  };
+}
diff --git a/packages/observability/src/observability.test.ts b/packages/observability/src/observability.test.ts
new file mode 100644
index 0000000..794c53b
--- /dev/null
+++ b/packages/observability/src/observability.test.ts
@@ -0,0 +1,176 @@
+import assert from "node:assert/strict";
+import { createServer, request, type Server } from "node:http";
+import type { AddressInfo } from "node:net";
+import { test } from "node:test";
+import {
+  InMemoryMetricExporter,
+  AggregationTemporality,
+  PeriodicExportingMetricReader,
+} from "@opentelemetry/sdk-metrics";
+import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace";
+import {
+  CORRELATION_HEADER,
+  correlationHeaders,
+  createBusinessCounter,
+  createJobEnvelope,
+  createObservability,
+  createTelemetry,
+  currentContext,
+  handleProbe,
+  observeHttp,
+  resolveCorrelationId,
+  runJob,
+  telemetryConfigFromEnv,
+} from "./index.js";
+
+const SENTINEL = "SENTINEL_S3CR3T_9f8e7d";
+const sink = () => {
+  const lines: string[] = [];
+  return { lines, write: (l: string) => void lines.push(l) };
+};
+const base = { service: "svc", version: "9.9.9", env: "test" };
+
+function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
+  return new Promise((resolve, reject) => {
+    const req = request({ host: "127.0.0.1", port, path, headers }, (res) => {
+      let body = "";
+      res.on("data", (c) => (body += c));
+      res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
+    });
+    req.on("error", reject);
+    req.end();
+  });
+}
+
+const listen = (s: Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));
+
+test("correlation id: aceita da borda, gera UUID se ausente/invalido, ignora se borda nao confiavel", () => {
+  assert.equal(resolveCorrelationId("edge-req-1234"), "edge-req-1234");
+  assert.match(resolveCorrelationId(undefined), /^[0-9a-f-]{36}$/);
+  assert.match(resolveCorrelationId("x\ninjetado"), /^[0-9a-f-]{36}$/);
+  assert.match(resolveCorrelationId("edge-req-1234", false), /^[0-9a-f-]{36}$/);
+});
+
+test("AC-1: requisicao sintetica gera log, metrica e trace com o mesmo correlation_id; HTTP -> job -> log", async () => {
+  const spans = new InMemorySpanExporter();
+  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
+  const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 3600_000 });
+  const out = sink();
+  const kit = createObservability(
+    { ...base, destination: out },
+    { ...base, enabled: true, spanProcessors: [new SimpleSpanProcessor({ exporter: spans })], metricReaders: [reader] },
+  );
+  const server = createServer(
+    observeHttp(
+      kit,
+      async (req, res) => {
+        const envelope = createJobEnvelope("demo.job", { n: 1 });
+        // O job roda fora do contexto HTTP, so com o envelope (como um worker real).
+        await new Promise<void>((done) =>
+          setImmediate(() => {
+            void Promise.resolve(runJob(envelope, () => kit.logger.log("info", "job.done", { job_type: envelope.type }))).then(() => done());
+          }),
+        );
+        assert.equal(correlationHeaders()[CORRELATION_HEADER], currentContext()?.correlationId);
+        res.writeHead(200).end("ok");
+      },
+      { routeOf: () => "/demo" },
+    ),
+  );
+  const port = await listen(server);
+  try {
+    const res = await get(port, `/demo/123?token=${SENTINEL}`, { "x-request-id": "edge-req-1234", authorization: `Bearer ${SENTINEL}` });
+    assert.equal(res.status, 200);
+    assert.equal(res.headers[CORRELATION_HEADER], "edge-req-1234");
+    await new Promise((r) => setTimeout(r, 50));
+
+    const records = out.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
+    const httpLog = records.find((r) => r["event"] === "http.request");
+    const jobLog = records.find((r) => r["event"] === "job.done");
+    assert.ok(httpLog && jobLog);
+    for (const field of ["ts", "level", "service", "version", "env", "trace_id", "span_id", "correlation_id", "tenant_id", "actor_type", "event"]) {
+      assert.ok(field in httpLog, `campo fixo ausente: ${field}`);
+    }
+    assert.equal(httpLog["correlation_id"], "edge-req-1234");
+    assert.equal(jobLog["correlation_id"], "edge-req-1234");
+    assert.equal(jobLog["actor_type"], "system");
+
+    const span = spans.getFinishedSpans()[0];
+    assert.ok(span);
+    assert.equal(span.attributes["nucleos.correlation_id"], "edge-req-1234");
+    assert.equal(span.spanContext().traceId, httpLog["trace_id"]);
+    assert.equal(span.spanContext().spanId, httpLog["span_id"]);
+
+    await reader.forceFlush();
+    const metrics = metricExporter.getMetrics().flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics));
+    const requests = metrics.find((m) => m.descriptor.name === "http.server.requests");
+    assert.ok(requests);
+    assert.deepEqual(requests.dataPoints[0]?.attributes, { method: "GET", route: "/demo", status_class: "2xx" });
+    assert.ok(metrics.some((m) => m.descriptor.name === "http.server.request.duration"));
+
+    // AC-2 (biblioteca): nada do request (query, header) aparece no log.
+    assert.ok(!out.lines.join("").includes(SENTINEL));
+  } finally {
+    server.close();
+    await kit.telemetry.shutdown();
+  }
+});
+
+test("cardinalidade: rota nao declarada vira unmatched; label tenant_id e proibido", () => {
+  const kit = createObservability({ ...base, destination: sink() }, { ...base, enabled: false });
+  assert.throws(() => createBusinessCounter(kit.telemetry.meter, "x", { tenant_id: ["a"] }), /proibido/);
+  const count = createBusinessCounter(kit.telemetry.meter, "orders", { outcome: ["ok", "error"] });
+  count(1, { outcome: "qualquer" });
+});
+
+test("AC-3: telemetria desabilitada e no-op; OTLP inalcancavel nao altera a resposta nem derruba", async () => {
+  assert.equal(telemetryConfigFromEnv({}, base).enabled, false);
+  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1", OTEL_SDK_DISABLED: "true" }, base).enabled, false);
+  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1/" }, base).otlpEndpoint, "http://x:1");
+  const disabled = createTelemetry({ ...base, enabled: false });
+  disabled.tracer.startSpan("x").end();
+  await disabled.shutdown();
+
+  for (const enabled of [false, true]) {
+    const out = sink();
+    const kit = createObservability(
+      { ...base, destination: out },
+      { ...base, enabled, otlpEndpoint: "http://127.0.0.1:1", metricIntervalMs: 50 },
+    );
+    const server = createServer(observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }));
+    const port = await listen(server);
+    try {
+      const res = await get(port, "/x");
+      assert.deepEqual([res.status, res.body], [200, "ok"]);
+      await new Promise((r) => setTimeout(r, 150));
+      assert.equal((await get(port, "/x")).status, 200);
+    } finally {
+      server.close();
+      await kit.telemetry.shutdown();
+    }
+  }
+});
+
+test("sondas: /healthz e /readyz sem versoes; 503 quando dependencia falha", async () => {
+  const out = sink();
+  const kit = createObservability({ ...base, destination: out }, { ...base, enabled: false });
+  let dbUp = true;
+  const server = createServer((req, res) => {
+    void handleProbe(kit, "svc", req, res, { db: () => dbUp }).then((handled) => {
+      if (!handled) res.writeHead(404).end();
+    });
+  });
+  const port = await listen(server);
+  try {
+    assert.deepEqual(JSON.parse((await get(port, "/healthz")).body), { status: "ok", service: "svc" });
+    const ready = await get(port, "/readyz");
+    assert.deepEqual([ready.status, JSON.parse(ready.body)], [200, { status: "ready", service: "svc" }]);
+    dbUp = false;
+    const notReady = await get(port, "/readyz");
+    assert.equal(notReady.status, 503);
+    assert.ok(!notReady.body.includes("9.9.9") && !notReady.body.includes("db"));
+    assert.equal((await get(port, "/outra")).status, 404);
+  } finally {
+    server.close();
+  }
+});
diff --git a/packages/observability/src/red.ts b/packages/observability/src/red.ts
new file mode 100644
index 0000000..60d52d6
--- /dev/null
+++ b/packages/observability/src/red.ts
@@ -0,0 +1,71 @@
+import type { Counter, Histogram, Meter } from "@opentelemetry/api";
+
+const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
+/** Labels de alta cardinalidade proibidos em metricas (DEC-010 decide qualquer excecao). */
+export const FORBIDDEN_LABELS: ReadonlySet<string> = new Set([
+  "tenant_id",
+  "user_id",
+  "actor_id",
+  "correlation_id",
+  "request_id",
+  "trace_id",
+  "span_id",
+  "url",
+  "path",
+  "ip",
+]);
+
+export interface RedSample {
+  method: string;
+  /** Template da rota (ex.: `/users/:id`), nunca a URL crua. Ausente => `unmatched`. */
+  route: string | undefined;
+  status: number;
+  durationMs: number;
+}
+
+/** Rate, Errors e Duration por rota; labels limitados a method, route (template) e status_class. */
+export class RedMetrics {
+  private readonly requests: Counter;
+  private readonly errors: Counter;
+  private readonly duration: Histogram;
+
+  constructor(meter: Meter) {
+    this.requests = meter.createCounter("http.server.requests", { description: "Requisicoes HTTP (rate)" });
+    this.errors = meter.createCounter("http.server.errors", { description: "Respostas 5xx (errors)" });
+    this.duration = meter.createHistogram("http.server.request.duration", { unit: "s", description: "Duracao (duration)" });
+  }
+
+  record(sample: RedSample): void {
+    const method = METHODS.has(sample.method) ? sample.method : "OTHER";
+    const attributes = {
+      method,
+      route: sample.route ?? "unmatched",
+      status_class: `${Math.floor(sample.status / 100)}xx`,
+    };
+    this.requests.add(1, attributes);
+    if (sample.status >= 500) this.errors.add(1, attributes);
+    this.duration.record(sample.durationMs / 1000, attributes);
+  }
+}
+
+/** Contador de negocio: so labels enumerados; valor fora do conjunto vira `other`. */
+export function createBusinessCounter(
+  meter: Meter,
+  name: string,
+  labels: Readonly<Record<string, readonly string[]>>,
+): (value: number, values?: Readonly<Record<string, string>>) => void {
+  for (const label of Object.keys(labels)) {
+    if (FORBIDDEN_LABELS.has(label)) {
+      throw new Error(`label proibido por cardinalidade: ${label}`);
+    }
+  }
+  const counter = meter.createCounter(name);
+  return (value, values = {}) => {
+    const attributes: Record<string, string> = {};
+    for (const [label, allowed] of Object.entries(labels)) {
+      const given = values[label];
+      attributes[label] = given !== undefined && allowed.includes(given) ? given : "other";
+    }
+    counter.add(value, attributes);
+  };
+}
diff --git a/packages/observability/src/redact.test.ts b/packages/observability/src/redact.test.ts
new file mode 100644
index 0000000..7b2dcce
--- /dev/null
+++ b/packages/observability/src/redact.test.ts
@@ -0,0 +1,63 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { REDACTED, SENSITIVE_KEYS, redact } from "./redact.js";
+
+// PRNG deterministico (mulberry32) para o teste de propriedade ser reproduzivel.
+function prng(seed: number): () => number {
+  let a = seed;
+  return () => {
+    a = (a + 0x6d2b79f5) | 0;
+    let t = Math.imul(a ^ (a >>> 15), 1 | a);
+    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+const ALLOWED = ["method", "route", "status", "note"];
+const SENSITIVE = [...SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"];
+const OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"];
+
+test("propriedade: nenhum sentinela de segredo sobrevive a redacao (dados aleatorios)", () => {
+  const rnd = prng(20261025);
+  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
+  const sentinels: string[] = [];
+  const gen = (depth: number): unknown => {
+    const obj: Record<string, unknown> = {};
+    const n = 1 + Math.floor(rnd() * 5);
+    for (let i = 0; i < n; i++) {
+      const r = rnd();
+      const sentinel = () => {
+        const s = `SENTINEL_${sentinels.length}_${Math.floor(rnd() * 1e9).toString(36)}`;
+        sentinels.push(s);
+        return s;
+      };
+      const wrap = (v: unknown): unknown => (rnd() < 0.3 ? [v, { deep: v }] : rnd() < 0.2 ? { a: { b: { c: { d: v } } } } : v);
+      if (r < 0.35) obj[pick(SENSITIVE)] = wrap(sentinel());
+      else if (r < 0.6) obj[pick(OTHER)] = wrap(sentinel());
+      else if (r < 0.75 && depth < 3) obj[pick(ALLOWED)] = gen(depth + 1);
+      else if (r < 0.85) obj[pick(ALLOWED)] = `Bearer ${sentinel()}`;
+      else obj[pick(ALLOWED)] = Math.floor(rnd() * 100);
+    }
+    return obj;
+  };
+  for (let i = 0; i < 500; i++) {
+    sentinels.length = 0;
+    const out = JSON.stringify(redact(gen(0), ALLOWED));
+    for (const s of sentinels) assert.ok(!out.includes(s), `vazou ${s} em ${out}`);
+  }
+});
+
+test("chaves sensiveis conhecidas viram [REDACTED] mesmo se estiverem na allowlist", () => {
+  const out = redact({ authorization: "x", token: "y", note: "ok", foo: "z" }, ["token", "note"]) as Record<string, unknown>;
+  assert.equal(out["authorization"], REDACTED);
+  assert.equal(out["token"], REDACTED);
+  assert.equal(out["note"], "ok");
+  assert.equal(out["foo"], undefined);
+  assert.equal(out["_dropped"], 1);
+});
+
+test("Error nao expoe a mensagem; profundidade e strings sao limitadas", () => {
+  const out = JSON.stringify(redact({ note: new Error("senha=abc") }, ["note"]));
+  assert.ok(!out.includes("abc"));
+  assert.ok(JSON.stringify(redact({ note: "a".repeat(5000) }, ["note"])).length < 400);
+});
diff --git a/packages/observability/src/redact.ts b/packages/observability/src/redact.ts
new file mode 100644
index 0000000..d8e4ee2
--- /dev/null
+++ b/packages/observability/src/redact.ts
@@ -0,0 +1,71 @@
+/** Redacao por allowlist: so campos explicitamente permitidos chegam ao log. */
+export const REDACTED = "[REDACTED]";
+
+/** Nomes sempre redigidos (comparacao exata, minuscula, `-` e `_` equivalentes). */
+export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
+  "authorization",
+  "cookie",
+  "set_cookie",
+  "password",
+  "token",
+  "secret",
+  "prompt",
+  "content",
+  "api_key",
+]);
+
+const SENSITIVE_PATTERN = /authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session/i;
+const VALUE_PATTERNS = [/\bBearer\s+\S+/gi, /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g];
+const MAX_DEPTH = 4;
+const MAX_ITEMS = 20;
+const MAX_STRING = 256;
+const DROPPED_KEY = "_dropped";
+
+function normalize(key: string): string {
+  return key.toLowerCase().replaceAll("-", "_");
+}
+
+function scrubString(value: string): string {
+  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
+  for (const pattern of VALUE_PATTERNS) out = out.replace(pattern, REDACTED);
+  return out;
+}
+
+/**
+ * Regras (nesta ordem):
+ * 1. chave sensivel (padrao) => valor `[REDACTED]`; o nome so aparece se for um nome conhecido
+ *    (`SENSITIVE_KEYS`) ou estiver na allowlist; senao conta em `_dropped`.
+ * 2. chave fora da allowlist => descartada (nome e valor); conta em `_dropped`.
+ * 3. chave permitida: escalares passam (strings truncadas e sem Bearer/JWT); objetos e arrays
+ *    recorrem com limites de profundidade e tamanho; Error vira `{name}` (sem mensagem).
+ */
+export function redact(value: unknown, allowlist: Iterable<string>, depth = 0): unknown {
+  const allowed = new Set([...allowlist].map(normalize));
+  return walk(value, allowed, depth);
+}
+
+function walk(value: unknown, allowed: ReadonlySet<string>, depth: number): unknown {
+  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
+  if (typeof value === "string") return scrubString(value);
+  if (value instanceof Error) return { name: value.name };
+  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
+  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => walk(item, allowed, depth + 1));
+  if (typeof value === "object") {
+    const out: Record<string, unknown> = {};
+    let dropped = 0;
+    for (const [rawKey, child] of Object.entries(value)) {
+      const key = normalize(rawKey);
+      const isAllowed = allowed.has(key);
+      if (SENSITIVE_KEYS.has(key) || (isAllowed && SENSITIVE_PATTERN.test(key))) {
+        out[key] = REDACTED;
+      } else if (!isAllowed || SENSITIVE_PATTERN.test(key)) {
+        dropped += 1;
+      } else {
+        out[key] = walk(child, allowed, depth + 1);
+      }
+    }
+    if (dropped > 0) out[DROPPED_KEY] = dropped;
+    return out;
+  }
+  return "[UNSUPPORTED]";
+}
diff --git a/packages/observability/src/telemetry.ts b/packages/observability/src/telemetry.ts
new file mode 100644
index 0000000..a6cc508
--- /dev/null
+++ b/packages/observability/src/telemetry.ts
@@ -0,0 +1,81 @@
+import { type Meter, type Tracer, metrics, trace } from "@opentelemetry/api";
+import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
+import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
+import { resourceFromAttributes } from "@opentelemetry/resources";
+import { type IMetricReader, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
+import { BatchSpanProcessor, type SpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
+
+export interface TelemetryConfig {
+  enabled: boolean;
+  service: string;
+  version: string;
+  env: string;
+  /** Base OTLP/HTTP (ex.: http://127.0.0.1:4318). Sem endpoint, nada e exportado. */
+  otlpEndpoint?: string;
+  metricIntervalMs?: number;
+  /** Injecao para testes (exportadores em memoria). */
+  spanProcessors?: SpanProcessor[];
+  metricReaders?: IMetricReader[];
+}
+
+export interface Telemetry {
+  readonly enabled: boolean;
+  readonly tracer: Tracer;
+  readonly meter: Meter;
+  shutdown(): Promise<void>;
+}
+
+/** Habilitado somente com endpoint e sem `OTEL_SDK_DISABLED=true`; caso contrario e no-op. */
+export function telemetryConfigFromEnv(
+  env: Record<string, string | undefined>,
+  base: Pick<TelemetryConfig, "service" | "version" | "env">,
+): TelemetryConfig {
+  const endpoint = env["OTEL_EXPORTER_OTLP_ENDPOINT"];
+  const disabled = env["OTEL_SDK_DISABLED"] === "true";
+  return {
+    ...base,
+    enabled: !disabled && Boolean(endpoint),
+    ...(endpoint ? { otlpEndpoint: endpoint.replace(/\/+$/, "") } : {}),
+  };
+}
+
+const NOOP_SCOPE = "@nucleos/observability";
+
+export function createTelemetry(config: TelemetryConfig): Telemetry {
+  if (!config.enabled) {
+    // Sem provider global registrado, a API do OpenTelemetry devolve implementacoes no-op.
+    return {
+      enabled: false,
+      tracer: trace.getTracer(NOOP_SCOPE),
+      meter: metrics.getMeter(NOOP_SCOPE),
+      async shutdown() {},
+    };
+  }
+  const resource = resourceFromAttributes({
+    "service.name": config.service,
+    "service.version": config.version,
+    "deployment.environment.name": config.env,
+  });
+  const spanProcessors = [...(config.spanProcessors ?? [])];
+  const readers = [...(config.metricReaders ?? [])];
+  if (config.otlpEndpoint) {
+    spanProcessors.push(new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces`, timeoutMillis: 2000 }) }));
+    readers.push(
+      new PeriodicExportingMetricReader({
+        exporter: new OTLPMetricExporter({ url: `${config.otlpEndpoint}/v1/metrics`, timeoutMillis: 2000 }),
+        exportIntervalMillis: config.metricIntervalMs ?? 15000,
+      }),
+    );
+  }
+  const tracerProvider = new TracerProvider({ resource, spanProcessors });
+  const meterProvider = new MeterProvider({ resource, readers });
+  return {
+    enabled: true,
+    tracer: tracerProvider.getTracer(NOOP_SCOPE, config.version),
+    meter: meterProvider.getMeter(NOOP_SCOPE, config.version),
+    async shutdown() {
+      // Falha de exportacao nunca deve derrubar o encerramento do servico.
+      await Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]);
+    },
+  };
+}
diff --git a/packages/observability/tsconfig.json b/packages/observability/tsconfig.json
new file mode 100644
index 0000000..972facb
--- /dev/null
+++ b/packages/observability/tsconfig.json
@@ -0,0 +1,5 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
+  "include": ["src"]
+}
diff --git a/pyproject.toml b/pyproject.toml
index 8653c62..386d58d 100644
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -12,8 +12,8 @@ dev = ["pytest==9.0.3"]
 package = false
 
 [tool.uv.workspace]
-members = ["services/*"]
+members = ["services/*", "packages/observability-py"]
 
 [tool.pytest.ini_options]
-testpaths = ["services"]
+testpaths = ["services", "packages/observability-py"]
 addopts = "--import-mode=importlib"
diff --git a/services/ai-gateway/pyproject.toml b/services/ai-gateway/pyproject.toml
index 348574b..9a2da4e 100644
--- a/services/ai-gateway/pyproject.toml
+++ b/services/ai-gateway/pyproject.toml
@@ -3,7 +3,10 @@ name = "nucleos-ai-gateway"
 version = "0.0.0"
 description = "Servico ai-gateway (hello-world de FND-001; sem logica de negocio)"
 requires-python = ">=3.12"
-dependencies = []
+dependencies = ["nucleos-observability"]
+
+[tool.uv.sources]
+nucleos-observability = { workspace = true }
 
 [build-system]
 requires = ["uv_build>=0.13.5,<0.14"]
diff --git a/services/ai-gateway/src/ai_gateway/app.py b/services/ai-gateway/src/ai_gateway/app.py
index cd6a0b9..e26ecaa 100644
--- a/services/ai-gateway/src/ai_gateway/app.py
+++ b/services/ai-gateway/src/ai_gateway/app.py
@@ -1,31 +1,33 @@
-"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
 
-import json
 import os
-from http.server import BaseHTTPRequestHandler, HTTPServer
+import sys
+from http.server import HTTPServer
+
+from nucleos_observability import (
+    Logger,
+    Observability,
+    Telemetry,
+    make_handler,
+    make_observability,
+    telemetry_config_from_env,
+)
 
 SERVICE = "ai-gateway"
 HEALTH_PATH = "/healthz"
 
 
-class Handler(BaseHTTPRequestHandler):
-    def do_GET(self) -> None:
-        if self.path != HEALTH_PATH:
-            self.send_error(404)
-            return
-        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
-        self.send_response(200)
-        self.send_header("content-type", "application/json")
-        self.send_header("content-length", str(len(body)))
-        self.end_headers()
-        self.wfile.write(body)
+def default_observability() -> Observability:
+    version = os.environ.get("APP_VERSION", "0.0.0")
+    env = os.environ.get("APP_ENV", "local")
+    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
+    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
 
-    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
-        return
 
-
-def make_server(host: str = "127.0.0.1", port: int = 8002) -> HTTPServer:
-    return HTTPServer((host, port), Handler)
+def make_server(
+    host: str = "127.0.0.1", port: int = 8002, kit: Observability | None = None
+) -> HTTPServer:
+    return HTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
 
 
 def main() -> None:
diff --git a/services/ai-gateway/tests/test_health.py b/services/ai-gateway/tests/test_health.py
index c4e209a..f153925 100644
--- a/services/ai-gateway/tests/test_health.py
+++ b/services/ai-gateway/tests/test_health.py
@@ -1,25 +1,48 @@
+import io
 import json
 import threading
 import urllib.error
 import urllib.request
 
-from ai_gateway.app import make_server
+from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
+from ai_gateway.app import SERVICE, make_server
 
+SENTINEL = "SENTINEL_ai_gateway_5ec7e7"
 
-def test_healthz() -> None:
-    server = make_server("127.0.0.1", 0)
-    thread = threading.Thread(target=server.serve_forever, daemon=True)
-    thread.start()
-    port = server.server_address[1]
+
+def _serve():
+    out = io.StringIO()
+    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
+    kit = make_observability(Logger(SERVICE, "9.9.9", "test", level="debug", stream=out), Telemetry(cfg))
+    server = make_server("127.0.0.1", 0, kit)
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    return server, out
+
+
+def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
+    server, out = _serve()
+    base = f"http://127.0.0.1:{server.server_address[1]}"
     try:
-        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+        with urllib.request.urlopen(f"{base}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "ai-gateway"}
+        with urllib.request.urlopen(f"{base}/readyz") as res:
+            assert json.load(res) == {"status": "ready", "service": "ai-gateway"}
+        req = urllib.request.Request(
+            f"{base}/outra?token={SENTINEL}",
+            headers={"x-request-id": "edge-py-0001", "authorization": f"Bearer {SENTINEL}", "cookie": f"s={SENTINEL}"},
+        )
         try:
-            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            urllib.request.urlopen(req)
             raise AssertionError("esperava 404")
         except urllib.error.HTTPError as err:
             assert err.code == 404
+            assert err.headers["x-request-id"] == "edge-py-0001"
     finally:
         server.shutdown()
         server.server_close()
+    lines = [json.loads(line) for line in out.getvalue().splitlines()]
+    record = next(r for r in lines if r["data"]["route"] == "unmatched")
+    assert record["correlation_id"] == "edge-py-0001"
+    assert record["service"] == "ai-gateway"
+    assert SENTINEL not in out.getvalue()
diff --git a/services/event-dispatcher/pyproject.toml b/services/event-dispatcher/pyproject.toml
index 464c609..7a6da5b 100644
--- a/services/event-dispatcher/pyproject.toml
+++ b/services/event-dispatcher/pyproject.toml
@@ -3,7 +3,10 @@ name = "nucleos-event-dispatcher"
 version = "0.0.0"
 description = "Servico event-dispatcher (hello-world de FND-001; sem logica de negocio)"
 requires-python = ">=3.12"
-dependencies = []
+dependencies = ["nucleos-observability"]
+
+[tool.uv.sources]
+nucleos-observability = { workspace = true }
 
 [build-system]
 requires = ["uv_build>=0.13.5,<0.14"]
diff --git a/services/event-dispatcher/src/event_dispatcher/app.py b/services/event-dispatcher/src/event_dispatcher/app.py
index cb8e164..72addb4 100644
--- a/services/event-dispatcher/src/event_dispatcher/app.py
+++ b/services/event-dispatcher/src/event_dispatcher/app.py
@@ -1,31 +1,33 @@
-"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
 
-import json
 import os
-from http.server import BaseHTTPRequestHandler, HTTPServer
+import sys
+from http.server import HTTPServer
+
+from nucleos_observability import (
+    Logger,
+    Observability,
+    Telemetry,
+    make_handler,
+    make_observability,
+    telemetry_config_from_env,
+)
 
 SERVICE = "event-dispatcher"
 HEALTH_PATH = "/healthz"
 
 
-class Handler(BaseHTTPRequestHandler):
-    def do_GET(self) -> None:
-        if self.path != HEALTH_PATH:
-            self.send_error(404)
-            return
-        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
-        self.send_response(200)
-        self.send_header("content-type", "application/json")
-        self.send_header("content-length", str(len(body)))
-        self.end_headers()
-        self.wfile.write(body)
+def default_observability() -> Observability:
+    version = os.environ.get("APP_VERSION", "0.0.0")
+    env = os.environ.get("APP_ENV", "local")
+    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
+    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
 
-    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
-        return
 
-
-def make_server(host: str = "127.0.0.1", port: int = 8004) -> HTTPServer:
-    return HTTPServer((host, port), Handler)
+def make_server(
+    host: str = "127.0.0.1", port: int = 8004, kit: Observability | None = None
+) -> HTTPServer:
+    return HTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
 
 
 def main() -> None:
diff --git a/services/event-dispatcher/tests/test_health.py b/services/event-dispatcher/tests/test_health.py
index 9763a2d..4ee2171 100644
--- a/services/event-dispatcher/tests/test_health.py
+++ b/services/event-dispatcher/tests/test_health.py
@@ -1,25 +1,48 @@
+import io
 import json
 import threading
 import urllib.error
 import urllib.request
 
-from event_dispatcher.app import make_server
+from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
+from event_dispatcher.app import SERVICE, make_server
 
+SENTINEL = "SENTINEL_event_dispatcher_5ec7e7"
 
-def test_healthz() -> None:
-    server = make_server("127.0.0.1", 0)
-    thread = threading.Thread(target=server.serve_forever, daemon=True)
-    thread.start()
-    port = server.server_address[1]
+
+def _serve():
+    out = io.StringIO()
+    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
+    kit = make_observability(Logger(SERVICE, "9.9.9", "test", level="debug", stream=out), Telemetry(cfg))
+    server = make_server("127.0.0.1", 0, kit)
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    return server, out
+
+
+def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
+    server, out = _serve()
+    base = f"http://127.0.0.1:{server.server_address[1]}"
     try:
-        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+        with urllib.request.urlopen(f"{base}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "event-dispatcher"}
+        with urllib.request.urlopen(f"{base}/readyz") as res:
+            assert json.load(res) == {"status": "ready", "service": "event-dispatcher"}
+        req = urllib.request.Request(
+            f"{base}/outra?token={SENTINEL}",
+            headers={"x-request-id": "edge-py-0001", "authorization": f"Bearer {SENTINEL}", "cookie": f"s={SENTINEL}"},
+        )
         try:
-            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            urllib.request.urlopen(req)
             raise AssertionError("esperava 404")
         except urllib.error.HTTPError as err:
             assert err.code == 404
+            assert err.headers["x-request-id"] == "edge-py-0001"
     finally:
         server.shutdown()
         server.server_close()
+    lines = [json.loads(line) for line in out.getvalue().splitlines()]
+    record = next(r for r in lines if r["data"]["route"] == "unmatched")
+    assert record["correlation_id"] == "edge-py-0001"
+    assert record["service"] == "event-dispatcher"
+    assert SENTINEL not in out.getvalue()
diff --git a/services/tenant-runtime/pyproject.toml b/services/tenant-runtime/pyproject.toml
index f8dbff1..2056ee9 100644
--- a/services/tenant-runtime/pyproject.toml
+++ b/services/tenant-runtime/pyproject.toml
@@ -3,7 +3,10 @@ name = "nucleos-tenant-runtime"
 version = "0.0.0"
 description = "Servico tenant-runtime (hello-world de FND-001; sem logica de negocio)"
 requires-python = ">=3.12"
-dependencies = []
+dependencies = ["nucleos-observability"]
+
+[tool.uv.sources]
+nucleos-observability = { workspace = true }
 
 [build-system]
 requires = ["uv_build>=0.13.5,<0.14"]
diff --git a/services/tenant-runtime/src/tenant_runtime/app.py b/services/tenant-runtime/src/tenant_runtime/app.py
index 6b03ad0..2d7bd10 100644
--- a/services/tenant-runtime/src/tenant_runtime/app.py
+++ b/services/tenant-runtime/src/tenant_runtime/app.py
@@ -1,31 +1,33 @@
-"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
 
-import json
 import os
-from http.server import BaseHTTPRequestHandler, HTTPServer
+import sys
+from http.server import HTTPServer
+
+from nucleos_observability import (
+    Logger,
+    Observability,
+    Telemetry,
+    make_handler,
+    make_observability,
+    telemetry_config_from_env,
+)
 
 SERVICE = "tenant-runtime"
 HEALTH_PATH = "/healthz"
 
 
-class Handler(BaseHTTPRequestHandler):
-    def do_GET(self) -> None:
-        if self.path != HEALTH_PATH:
-            self.send_error(404)
-            return
-        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
-        self.send_response(200)
-        self.send_header("content-type", "application/json")
-        self.send_header("content-length", str(len(body)))
-        self.end_headers()
-        self.wfile.write(body)
+def default_observability() -> Observability:
+    version = os.environ.get("APP_VERSION", "0.0.0")
+    env = os.environ.get("APP_ENV", "local")
+    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
+    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
 
-    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
-        return
 
-
-def make_server(host: str = "127.0.0.1", port: int = 8001) -> HTTPServer:
-    return HTTPServer((host, port), Handler)
+def make_server(
+    host: str = "127.0.0.1", port: int = 8001, kit: Observability | None = None
+) -> HTTPServer:
+    return HTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
 
 
 def main() -> None:
diff --git a/services/tenant-runtime/tests/test_health.py b/services/tenant-runtime/tests/test_health.py
index 68022d5..807e5e0 100644
--- a/services/tenant-runtime/tests/test_health.py
+++ b/services/tenant-runtime/tests/test_health.py
@@ -1,25 +1,48 @@
+import io
 import json
 import threading
 import urllib.error
 import urllib.request
 
-from tenant_runtime.app import make_server
+from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
+from tenant_runtime.app import SERVICE, make_server
 
+SENTINEL = "SENTINEL_tenant_runtime_5ec7e7"
 
-def test_healthz() -> None:
-    server = make_server("127.0.0.1", 0)
-    thread = threading.Thread(target=server.serve_forever, daemon=True)
-    thread.start()
-    port = server.server_address[1]
+
+def _serve():
+    out = io.StringIO()
+    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
+    kit = make_observability(Logger(SERVICE, "9.9.9", "test", level="debug", stream=out), Telemetry(cfg))
+    server = make_server("127.0.0.1", 0, kit)
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    return server, out
+
+
+def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
+    server, out = _serve()
+    base = f"http://127.0.0.1:{server.server_address[1]}"
     try:
-        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+        with urllib.request.urlopen(f"{base}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "tenant-runtime"}
+        with urllib.request.urlopen(f"{base}/readyz") as res:
+            assert json.load(res) == {"status": "ready", "service": "tenant-runtime"}
+        req = urllib.request.Request(
+            f"{base}/outra?token={SENTINEL}",
+            headers={"x-request-id": "edge-py-0001", "authorization": f"Bearer {SENTINEL}", "cookie": f"s={SENTINEL}"},
+        )
         try:
-            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            urllib.request.urlopen(req)
             raise AssertionError("esperava 404")
         except urllib.error.HTTPError as err:
             assert err.code == 404
+            assert err.headers["x-request-id"] == "edge-py-0001"
     finally:
         server.shutdown()
         server.server_close()
+    lines = [json.loads(line) for line in out.getvalue().splitlines()]
+    record = next(r for r in lines if r["data"]["route"] == "unmatched")
+    assert record["correlation_id"] == "edge-py-0001"
+    assert record["service"] == "tenant-runtime"
+    assert SENTINEL not in out.getvalue()
diff --git a/services/tool-gateway/pyproject.toml b/services/tool-gateway/pyproject.toml
index 52e94c2..ab694b4 100644
--- a/services/tool-gateway/pyproject.toml
+++ b/services/tool-gateway/pyproject.toml
@@ -3,7 +3,10 @@ name = "nucleos-tool-gateway"
 version = "0.0.0"
 description = "Servico tool-gateway (hello-world de FND-001; sem logica de negocio)"
 requires-python = ">=3.12"
-dependencies = []
+dependencies = ["nucleos-observability"]
+
+[tool.uv.sources]
+nucleos-observability = { workspace = true }
 
 [build-system]
 requires = ["uv_build>=0.13.5,<0.14"]
diff --git a/services/tool-gateway/src/tool_gateway/app.py b/services/tool-gateway/src/tool_gateway/app.py
index b042ce1..fd1fc4d 100644
--- a/services/tool-gateway/src/tool_gateway/app.py
+++ b/services/tool-gateway/src/tool_gateway/app.py
@@ -1,31 +1,33 @@
-"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""
+"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
 
-import json
 import os
-from http.server import BaseHTTPRequestHandler, HTTPServer
+import sys
+from http.server import HTTPServer
+
+from nucleos_observability import (
+    Logger,
+    Observability,
+    Telemetry,
+    make_handler,
+    make_observability,
+    telemetry_config_from_env,
+)
 
 SERVICE = "tool-gateway"
 HEALTH_PATH = "/healthz"
 
 
-class Handler(BaseHTTPRequestHandler):
-    def do_GET(self) -> None:
-        if self.path != HEALTH_PATH:
-            self.send_error(404)
-            return
-        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
-        self.send_response(200)
-        self.send_header("content-type", "application/json")
-        self.send_header("content-length", str(len(body)))
-        self.end_headers()
-        self.wfile.write(body)
+def default_observability() -> Observability:
+    version = os.environ.get("APP_VERSION", "0.0.0")
+    env = os.environ.get("APP_ENV", "local")
+    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
+    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
 
-    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
-        return
 
-
-def make_server(host: str = "127.0.0.1", port: int = 8003) -> HTTPServer:
-    return HTTPServer((host, port), Handler)
+def make_server(
+    host: str = "127.0.0.1", port: int = 8003, kit: Observability | None = None
+) -> HTTPServer:
+    return HTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
 
 
 def main() -> None:
diff --git a/services/tool-gateway/tests/test_health.py b/services/tool-gateway/tests/test_health.py
index dfe4162..599cf81 100644
--- a/services/tool-gateway/tests/test_health.py
+++ b/services/tool-gateway/tests/test_health.py
@@ -1,25 +1,48 @@
+import io
 import json
 import threading
 import urllib.error
 import urllib.request
 
-from tool_gateway.app import make_server
+from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
+from tool_gateway.app import SERVICE, make_server
 
+SENTINEL = "SENTINEL_tool_gateway_5ec7e7"
 
-def test_healthz() -> None:
-    server = make_server("127.0.0.1", 0)
-    thread = threading.Thread(target=server.serve_forever, daemon=True)
-    thread.start()
-    port = server.server_address[1]
+
+def _serve():
+    out = io.StringIO()
+    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
+    kit = make_observability(Logger(SERVICE, "9.9.9", "test", level="debug", stream=out), Telemetry(cfg))
+    server = make_server("127.0.0.1", 0, kit)
+    threading.Thread(target=server.serve_forever, daemon=True).start()
+    return server, out
+
+
+def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
+    server, out = _serve()
+    base = f"http://127.0.0.1:{server.server_address[1]}"
     try:
-        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
+        with urllib.request.urlopen(f"{base}/healthz") as res:
             assert res.status == 200
             assert json.load(res) == {"status": "ok", "service": "tool-gateway"}
+        with urllib.request.urlopen(f"{base}/readyz") as res:
+            assert json.load(res) == {"status": "ready", "service": "tool-gateway"}
+        req = urllib.request.Request(
+            f"{base}/outra?token={SENTINEL}",
+            headers={"x-request-id": "edge-py-0001", "authorization": f"Bearer {SENTINEL}", "cookie": f"s={SENTINEL}"},
+        )
         try:
-            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
+            urllib.request.urlopen(req)
             raise AssertionError("esperava 404")
         except urllib.error.HTTPError as err:
             assert err.code == 404
+            assert err.headers["x-request-id"] == "edge-py-0001"
     finally:
         server.shutdown()
         server.server_close()
+    lines = [json.loads(line) for line in out.getvalue().splitlines()]
+    record = next(r for r in lines if r["data"]["route"] == "unmatched")
+    assert record["correlation_id"] == "edge-py-0001"
+    assert record["service"] == "tool-gateway"
+    assert SENTINEL not in out.getvalue()
```
