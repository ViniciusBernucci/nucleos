import { createServer, type Server } from "node:http";
import {
  type Observability,
  type ReadinessChecks,
  createObservability,
  handleProbe,
  observeHttp,
  telemetryConfigFromEnv,
} from "@nucleos/observability";

const SERVICE = "tenant-provisioner";
const ROUTES = new Set(["/healthz", "/readyz"]);

export function createDefaultObservability(service = SERVICE): Observability {
  const meta = { service, version: process.env["APP_VERSION"] ?? "0.0.0", env: process.env["APP_ENV"] ?? "local" };
  return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
}

export function createHealthServer(
  service = SERVICE,
  kit: Observability = createDefaultObservability(service),
  checks: ReadinessChecks = {},
): Server {
  const handler = observeHttp(
    kit,
    (req, res) => {
      void handleProbe(kit, service, req, res, checks).then((handled) => {
        if (!handled) res.writeHead(404).end();
      });
    },
    {
      // Template de rota: caminho nao declarado vira "unmatched" (cardinalidade controlada).
      routeOf: (req) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        return ROUTES.has(path) ? path : undefined;
      },
      quietRoutes: ["/healthz", "/readyz"],
    },
  );
  const server = createServer(handler);
  server.on("close", () => void kit.telemetry.shutdown());
  return server;
}
