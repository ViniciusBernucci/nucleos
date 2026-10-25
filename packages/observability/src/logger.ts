import { pino } from "pino";
import { currentContext } from "./context.js";
import { redact } from "./redact.js";

/** Campos operacionais emitidos pela propria biblioteca (valores controlados pelo codigo). */
export const DEFAULT_ALLOWLIST = ["method", "route", "status", "duration_ms", "check", "job_type"] as const;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  service: string;
  version: string;
  env: string;
  level?: LogLevel;
  /** Campos permitidos em `data`; o restante e descartado (ver `redact`). */
  allowlist?: readonly string[];
  destination?: { write(line: string): void };
}

export interface Logger {
  log(level: LogLevel, event: string, data?: unknown): void;
}

/** Campos fixos: ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event. */
export function createLogger(options: LoggerOptions): Logger {
  const allowlist = [...DEFAULT_ALLOWLIST, ...(options.allowlist ?? [])];
  const base = pino(
    {
      level: options.level ?? "info",
      base: { service: options.service, version: options.version, env: options.env },
      messageKey: "event",
      timestamp: () => `,"ts":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
      mixin() {
        const ctx = currentContext();
        const spanContext = ctx?.span?.spanContext();
        return {
          trace_id: spanContext?.traceId ?? null,
          span_id: spanContext?.spanId ?? null,
          correlation_id: ctx?.correlationId ?? null,
          tenant_id: ctx?.tenantId ?? null,
          actor_type: ctx?.actorType ?? null,
        };
      },
    },
    options.destination ?? process.stdout,
  );
  return {
    log(level, event, data) {
      if (data === undefined) base[level](event);
      else base[level]({ data: redact(data, allowlist) }, event);
    },
  };
}
