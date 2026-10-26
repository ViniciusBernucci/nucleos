"""OpenTelemetry (traces + metricas); OTLP/HTTP configuravel e no-op quando desabilitado."""

from collections.abc import Mapping
from dataclasses import dataclass, field

from opentelemetry.metrics import Meter, NoOpMeterProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import MetricReader, PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import NoOpTracerProvider, Tracer

_SCOPE = "nucleos_observability"


@dataclass
class TelemetryConfig:
    enabled: bool
    service: str
    version: str
    env: str
    otlp_endpoint: str | None = None  # base OTLP/HTTP, ex.: http://127.0.0.1:4318
    metric_interval_ms: int = 15000
    span_processors: list[SpanProcessor] = field(default_factory=list)  # injecao em testes
    metric_readers: list[MetricReader] = field(default_factory=list)


def telemetry_config_from_env(
    environ: Mapping[str, str], service: str, version: str, env: str
) -> TelemetryConfig:
    endpoint = environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or None
    disabled = environ.get("OTEL_SDK_DISABLED") == "true"
    return TelemetryConfig(
        enabled=not disabled and endpoint is not None,
        service=service,
        version=version,
        env=env,
        otlp_endpoint=endpoint.rstrip("/") if endpoint else None,
    )


class Telemetry:
    def __init__(self, config: TelemetryConfig) -> None:
        self.enabled = config.enabled
        self._tracer_provider: TracerProvider | None = None
        self._meter_provider: MeterProvider | None = None
        if not config.enabled:
            self.tracer: Tracer = NoOpTracerProvider().get_tracer(_SCOPE)
            self.meter: Meter = NoOpMeterProvider().get_meter(_SCOPE)
            return
        resource = Resource.create(
            {
                "service.name": config.service,
                "service.version": config.version,
                "deployment.environment.name": config.env,
            }
        )
        processors = list(config.span_processors)
        readers = list(config.metric_readers)
        if config.otlp_endpoint:
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

            processors.append(
                BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{config.otlp_endpoint}/v1/traces", timeout=2))
            )
            readers.append(
                PeriodicExportingMetricReader(
                    OTLPMetricExporter(endpoint=f"{config.otlp_endpoint}/v1/metrics", timeout=2),
                    export_interval_millis=config.metric_interval_ms,
                )
            )
        self._tracer_provider = TracerProvider(resource=resource)
        for processor in processors:
            self._tracer_provider.add_span_processor(processor)
        self._meter_provider = MeterProvider(resource=resource, metric_readers=readers)
        self.tracer = self._tracer_provider.get_tracer(_SCOPE, config.version)
        self.meter = self._meter_provider.get_meter(_SCOPE, config.version)

    def shutdown(self) -> None:
        """Falha de exportacao nunca derruba o encerramento do servico."""
        for provider in (self._tracer_provider, self._meter_provider):
            if provider is not None:
                try:
                    provider.shutdown()
                except Exception:  # noqa: BLE001 - telemetria e best-effort
                    pass
