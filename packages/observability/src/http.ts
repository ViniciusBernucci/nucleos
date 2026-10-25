import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { CORRELATION_HEADER, resolveCorrelationId, runWithContext } from "./context.js";
import { type Logger, createLogger, type LoggerOptions } from "./logger.js";
import { RedMetrics } from "./red.js";
import { type Telemetry, type TelemetryConfig, createTelemetry } from "./telemetry.js";

export interface Observability {
  logger: Logger;
  telemetry: Telemetry;
  red: RedMetrics;
}

export function createObservability(logger: LoggerOptions, telemetry: TelemetryConfig): Observability {
  const t = createTelemetry(telemetry);
  return { logger: createLogger(logger), telemetry: t, red: new RedMetrics(t.meter) };
}

export interface ObserveOptions {
  /** Template da rota, avaliado ao final da resposta (ex.: `req.route.path` no Express). */
  routeOf: (req: IncomingMessage) => string | undefined;
  /** `X-Request-Id` so e aceito quando a borda e confiavel (FND-007 define o proxy). */
  trustEdge?: boolean;
  /** Rotas de sonda (nao poluem o log em nivel info). */
  quietRoutes?: readonly string[];
}

/** Nucleo comum a `node:http` e Express: contexto, span, log e metricas RED por requisicao. */
export function observeRequest(
  kit: Observability,
  req: IncomingMessage,
  res: ServerResponse,
  options: ObserveOptions,
  next: () => void,
): void {
  const correlationId = resolveCorrelationId(req.headers[CORRELATION_HEADER], options.trustEdge ?? true);
  const method = req.method ?? "GET";
  const started = performance.now();
  const span = kit.telemetry.tracer.startSpan(`HTTP ${method}`, {
    kind: SpanKind.SERVER,
    attributes: { "http.request.method": method, "nucleos.correlation_id": correlationId },
  });
  res.setHeader(CORRELATION_HEADER, correlationId);
  res.once("close", () => {
    const route = options.routeOf(req);
    const status = res.statusCode;
    const durationMs = performance.now() - started;
    span.updateName(`HTTP ${method} ${route ?? "unmatched"}`);
    span.setAttribute("http.route", route ?? "unmatched");
    span.setAttribute("http.response.status_code", status);
    if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    runWithContext({ correlationId, actorType: "anonymous", span }, () => {
      kit.red.record({ method, route, status, durationMs });
      const quiet = route !== undefined && (options.quietRoutes ?? []).includes(route);
      kit.logger.log(quiet && status < 500 ? "debug" : "info", "http.request", {
        method,
        route: route ?? "unmatched",
        status,
        duration_ms: Math.round(durationMs),
      });
    });
    span.end();
  });
  runWithContext({ correlationId, actorType: "anonymous", span }, next);
}

export function observeHttp(kit: Observability, handler: RequestListener, options: ObserveOptions): RequestListener {
  return (req, res) => observeRequest(kit, req, res, options, () => handler(req, res));
}

export type ReadinessChecks = Readonly<Record<string, () => Promise<boolean> | boolean>>;

/** `/healthz` (vivo) e `/readyz` (dependencias criticas). Corpo sem versoes nem detalhes internos. */
export async function handleProbe(
  kit: Observability,
  service: string,
  req: IncomingMessage,
  res: ServerResponse,
  checks: ReadinessChecks = {},
): Promise<boolean> {
  if (req.method !== "GET") return false;
  const path = (req.url ?? "").split("?")[0];
  if (path === "/healthz") return sendProbe(res, 200, "ok", service);
  if (path !== "/readyz") return false;
  let ready = true;
  for (const [name, check] of Object.entries(checks)) {
    let ok = false;
    try {
      ok = await Promise.race([Promise.resolve(check()), new Promise<boolean>((r) => setTimeout(() => r(false), 2000).unref())]);
    } catch {
      ok = false;
    }
    if (!ok) {
      ready = false;
      kit.logger.log("warn", "readiness.check_failed", { check: name });
    }
  }
  return sendProbe(res, ready ? 200 : 503, ready ? "ready" : "not_ready", service);
}

function sendProbe(res: ServerResponse, code: number, status: string, service: string): true {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ status, service }));
  return true;
}
