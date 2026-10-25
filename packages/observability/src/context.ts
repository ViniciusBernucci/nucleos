import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Span } from "@opentelemetry/api";

export const CORRELATION_HEADER = "x-request-id";
export type ActorType = "user" | "service" | "system" | "anonymous";

export interface RequestContext {
  correlationId: string;
  /** Somente de fonte confiavel (autenticacao); nunca de header de cliente. */
  tenantId?: string;
  actorType: ActorType;
  span?: Span;
}

const storage = new AsyncLocalStorage<RequestContext>();
const VALID_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Marca o tenant resolvido por fonte confiavel (ex.: token validado) no contexto corrente. */
export function setTrustedTenant(tenantId: string, actorType: ActorType = "user"): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.tenantId = tenantId;
    ctx.actorType = actorType;
  }
}

/**
 * Aceita `X-Request-Id` da borda confiavel apenas se tiver formato seguro (evita injecao em log);
 * ausente, invalido ou `trustEdge=false` => UUID novo.
 */
export function resolveCorrelationId(header: string | string[] | undefined, trustEdge = true): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  if (trustEdge && candidate !== undefined && VALID_ID.test(candidate)) return candidate;
  return randomUUID();
}

/** Cabecalhos para chamadas HTTP de saida do contexto corrente. */
export function correlationHeaders(): Record<string, string> {
  const ctx = storage.getStore();
  return ctx ? { [CORRELATION_HEADER]: ctx.correlationId } : {};
}

/** Envelope minimo de job; FND-003 (contracts) pode substitui-lo mantendo `correlation_id`. */
export interface JobEnvelope<T = unknown> {
  job_id: string;
  type: string;
  correlation_id: string;
  enqueued_at: string;
  payload: T;
}

export function createJobEnvelope<T>(type: string, payload: T): JobEnvelope<T> {
  const ctx = storage.getStore();
  return {
    job_id: randomUUID(),
    type,
    correlation_id: ctx?.correlationId ?? randomUUID(),
    enqueued_at: new Date().toISOString(),
    payload,
  };
}

/** Executa o job restaurando o `correlation_id` do envelope (propagacao HTTP -> job -> log). */
export function runJob<T, R>(envelope: JobEnvelope<T>, fn: (envelope: JobEnvelope<T>) => R): R {
  const correlationId = VALID_ID.test(envelope.correlation_id) ? envelope.correlation_id : randomUUID();
  return storage.run({ correlationId, actorType: "system" }, () => fn(envelope));
}
