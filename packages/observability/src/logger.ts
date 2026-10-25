import { pino } from "pino";
import { currentContext } from "./context.js";
import { type AllowMap, DEFAULT_RULES, redact } from "./redact.js";

/** Campos operacionais emitidos pela propria biblioteca, com o validador de cada string. */
export const DEFAULT_ALLOWLIST: AllowMap = DEFAULT_RULES;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  service: string;
  version: string;
  env: string;
  level?: LogLevel;
  /**
   * Campos extras permitidos em `data`: lista de nomes (so numero/booleano) ou mapa
   * nome -> RegExp/"free" para liberar strings. O restante e descartado (ver `redact`).
   */
  allowlist?: readonly string[] | AllowMap;
  destination?: { write(line: string): void };
}

export interface Logger {
  log(level: LogLevel, event: string, data?: unknown): void;
}

/** Campos fixos: ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event. */
export function createLogger(options: LoggerOptions): Logger {
  const extra = options.allowlist ?? [];
  const extraMap: AllowMap = Array.isArray(extra)
    ? Object.fromEntries((extra as readonly string[]).map((k) => [k, undefined]))
    : (extra as AllowMap);
  const allowlist: AllowMap = { ...DEFAULT_ALLOWLIST, ...extraMap };
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
      else base[level]({ data: safeRedact(data, allowlist) }, event);
    },
  };
}

/** Fail-open sem dados: falha ao redigir (ex.: getter que lanca) nunca derruba nem vaza. */
function safeRedact(data: unknown, allowlist: AllowMap): unknown {
  try {
    return redact(data, allowlist);
  } catch {
    return "[REDACTION_ERROR]";
  }
}
