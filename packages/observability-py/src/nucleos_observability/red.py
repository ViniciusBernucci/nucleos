"""Metricas RED com cardinalidade controlada."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Callable

from opentelemetry.metrics import Meter

METHODS = frozenset({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
FORBIDDEN_LABELS = frozenset(
    {"tenant_id", "user_id", "actor_id", "correlation_id", "request_id", "trace_id", "span_id", "url", "path", "ip"}
)


@dataclass
class RedSample:
    method: str
    route: str | None  # template da rota, nunca a URL crua; None => "unmatched"
    status: int
    duration_ms: float


class RedMetrics:
    """Rate, Errors e Duration; labels limitados a method, route (template) e status_class."""

    def __init__(self, meter: Meter) -> None:
        self._requests = meter.create_counter("http.server.requests", description="Requisicoes HTTP (rate)")
        self._errors = meter.create_counter("http.server.errors", description="Respostas 5xx (errors)")
        self._duration = meter.create_histogram("http.server.request.duration", unit="s", description="Duracao")

    def record(self, sample: RedSample) -> None:
        attributes = {
            "method": sample.method if sample.method in METHODS else "OTHER",
            "route": sample.route or "unmatched",
            "status_class": f"{sample.status // 100}xx",
        }
        self._requests.add(1, attributes)
        if sample.status >= 500:
            self._errors.add(1, attributes)
        self._duration.record(sample.duration_ms / 1000, attributes)


def create_business_counter(
    meter: Meter, name: str, labels: Mapping[str, Sequence[str]]
) -> Callable[[int, Mapping[str, str] | None], None]:
    """Contador de negocio: so labels enumerados; valor fora do conjunto vira "other"."""
    for label in labels:
        if label in FORBIDDEN_LABELS:
            raise ValueError(f"label proibido por cardinalidade: {label}")
    counter = meter.create_counter(name)

    def add(value: int, values: Mapping[str, str] | None = None) -> None:
        given = values or {}
        counter.add(value, {k: (given[k] if given.get(k) in allowed else "other") for k, allowed in labels.items()})

    return add
