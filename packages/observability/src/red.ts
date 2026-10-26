import type { Counter, Histogram, Meter } from "@opentelemetry/api";

const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
/** Labels de alta cardinalidade proibidos em metricas (DEC-010 decide qualquer excecao). */
export const FORBIDDEN_LABELS: ReadonlySet<string> = new Set([
  "tenant_id",
  "user_id",
  "actor_id",
  "correlation_id",
  "request_id",
  "trace_id",
  "span_id",
  "url",
  "path",
  "ip",
]);

export interface RedSample {
  method: string;
  /** Template da rota (ex.: `/users/:id`), nunca a URL crua. Ausente => `unmatched`. */
  route: string | undefined;
  status: number;
  durationMs: number;
}

/** Rate, Errors e Duration por rota; labels limitados a method, route (template) e status_class. */
export class RedMetrics {
  private readonly requests: Counter;
  private readonly errors: Counter;
  private readonly duration: Histogram;

  constructor(meter: Meter) {
    this.requests = meter.createCounter("http.server.requests", { description: "Requisicoes HTTP (rate)" });
    this.errors = meter.createCounter("http.server.errors", { description: "Respostas 5xx (errors)" });
    this.duration = meter.createHistogram("http.server.request.duration", { unit: "s", description: "Duracao (duration)" });
  }

  record(sample: RedSample): void {
    const method = METHODS.has(sample.method) ? sample.method : "OTHER";
    const attributes = {
      method,
      route: sample.route ?? "unmatched",
      status_class: `${Math.floor(sample.status / 100)}xx`,
    };
    this.requests.add(1, attributes);
    if (sample.status >= 500) this.errors.add(1, attributes);
    this.duration.record(sample.durationMs / 1000, attributes);
  }
}

/** Contador de negocio: so labels enumerados; valor fora do conjunto vira `other`. */
export function createBusinessCounter(
  meter: Meter,
  name: string,
  labels: Readonly<Record<string, readonly string[]>>,
): (value: number, values?: Readonly<Record<string, string>>) => void {
  for (const label of Object.keys(labels)) {
    if (FORBIDDEN_LABELS.has(label)) {
      throw new Error(`label proibido por cardinalidade: ${label}`);
    }
  }
  const counter = meter.createCounter(name);
  return (value, values = {}) => {
    const attributes: Record<string, string> = {};
    for (const [label, allowed] of Object.entries(labels)) {
      const given = values[label];
      attributes[label] = given !== undefined && allowed.includes(given) ? given : "other";
    }
    counter.add(value, attributes);
  };
}
