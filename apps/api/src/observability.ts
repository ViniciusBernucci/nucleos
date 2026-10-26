import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type Observability,
  createObservability,
  observeRequest,
  telemetryConfigFromEnv,
} from "@nucleos/observability";

/** `req.route` e preenchido pelo Express ao casar a rota (sem depender de @types/express). */
type ExpressLike = IncomingMessage & { route?: { path?: string } };

export function createApiObservability(): Observability {
  const meta = {
    service: "api",
    version: process.env["APP_VERSION"] ?? "0.0.0",
    env: process.env["APP_ENV"] ?? "local",
  };
  return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
}

/** Middleware Express: correlation id, span, log e metricas RED; rota = template do Express. */
export function observabilityMiddleware(kit: Observability) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    observeRequest(
      kit,
      req,
      res,
      { routeOf: (r) => (r as ExpressLike).route?.path, quietRoutes: ["/healthz", "/readyz"] },
      next,
    );
  };
}
