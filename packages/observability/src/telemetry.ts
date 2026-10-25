import { type Meter, type Tracer, metrics, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { type IMetricReader, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, type SpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";

export interface TelemetryConfig {
  enabled: boolean;
  service: string;
  version: string;
  env: string;
  /** Base OTLP/HTTP (ex.: http://127.0.0.1:4318). Sem endpoint, nada e exportado. */
  otlpEndpoint?: string;
  metricIntervalMs?: number;
  /** Injecao para testes (exportadores em memoria). */
  spanProcessors?: SpanProcessor[];
  metricReaders?: IMetricReader[];
}

export interface Telemetry {
  readonly enabled: boolean;
  readonly tracer: Tracer;
  readonly meter: Meter;
  shutdown(): Promise<void>;
}

/** Habilitado somente com endpoint e sem `OTEL_SDK_DISABLED=true`; caso contrario e no-op. */
export function telemetryConfigFromEnv(
  env: Record<string, string | undefined>,
  base: Pick<TelemetryConfig, "service" | "version" | "env">,
): TelemetryConfig {
  const endpoint = env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  const disabled = env["OTEL_SDK_DISABLED"] === "true";
  return {
    ...base,
    enabled: !disabled && Boolean(endpoint),
    ...(endpoint ? { otlpEndpoint: endpoint.replace(/\/+$/, "") } : {}),
  };
}

const NOOP_SCOPE = "@nucleos/observability";

export function createTelemetry(config: TelemetryConfig): Telemetry {
  if (!config.enabled) {
    // Sem provider global registrado, a API do OpenTelemetry devolve implementacoes no-op.
    return {
      enabled: false,
      tracer: trace.getTracer(NOOP_SCOPE),
      meter: metrics.getMeter(NOOP_SCOPE),
      async shutdown() {},
    };
  }
  const resource = resourceFromAttributes({
    "service.name": config.service,
    "service.version": config.version,
    "deployment.environment.name": config.env,
  });
  const spanProcessors = [...(config.spanProcessors ?? [])];
  const readers = [...(config.metricReaders ?? [])];
  if (config.otlpEndpoint) {
    spanProcessors.push(new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces`, timeoutMillis: 2000 }) }));
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${config.otlpEndpoint}/v1/metrics`, timeoutMillis: 2000 }),
        exportIntervalMillis: config.metricIntervalMs ?? 15000,
      }),
    );
  }
  const tracerProvider = new TracerProvider({ resource, spanProcessors });
  const meterProvider = new MeterProvider({ resource, readers });
  return {
    enabled: true,
    tracer: tracerProvider.getTracer(NOOP_SCOPE, config.version),
    meter: meterProvider.getMeter(NOOP_SCOPE, config.version),
    async shutdown() {
      // Falha de exportacao nunca deve derrubar o encerramento do servico.
      await Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]);
    },
  };
}
