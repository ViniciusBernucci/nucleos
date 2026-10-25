"""Handler HTTP (stdlib) observado: correlation id, span, log, RED e sondas /healthz e /readyz."""

import json
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler

from opentelemetry.trace import SpanKind, StatusCode

from nucleos_observability.context import CORRELATION_HEADER, RequestContext, resolve_correlation_id, use_context
from nucleos_observability.logger import Logger
from nucleos_observability.red import RedMetrics, RedSample
from nucleos_observability.telemetry import Telemetry

ReadinessChecks = Mapping[str, Callable[[], bool]]
PROBES = ("/healthz", "/readyz")


@dataclass
class Observability:
    logger: Logger
    telemetry: Telemetry
    red: RedMetrics


def make_observability(logger: Logger, telemetry: Telemetry) -> Observability:
    return Observability(logger=logger, telemetry=telemetry, red=RedMetrics(telemetry.meter))


def make_handler(
    kit: Observability,
    service: str,
    checks: ReadinessChecks | None = None,
    trust_edge: bool = True,
) -> type[BaseHTTPRequestHandler]:
    """Cria o handler do servico. Rotas conhecidas: apenas as sondas; o resto e `unmatched`."""
    readiness = dict(checks or {})

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - API da stdlib
            correlation_id = resolve_correlation_id(self.headers.get(CORRELATION_HEADER), trust_edge)
            started = time.perf_counter()
            span = kit.telemetry.tracer.start_span(
                "HTTP GET",
                kind=SpanKind.SERVER,
                attributes={"http.request.method": "GET", "nucleos.correlation_id": correlation_id},
            )
            path = self.path.split("?", 1)[0]
            route = path if path in PROBES else None
            with use_context(RequestContext(correlation_id=correlation_id, span=span)):
                status = self._dispatch(route, correlation_id)
                duration_ms = (time.perf_counter() - started) * 1000
                span.update_name(f"HTTP GET {route or 'unmatched'}")
                span.set_attribute("http.route", route or "unmatched")
                span.set_attribute("http.response.status_code", status)
                if status >= 500:
                    span.set_status(StatusCode.ERROR)
                kit.red.record(RedSample("GET", route, status, duration_ms))
                level = "debug" if route in PROBES and status < 500 else "info"
                kit.logger.log(
                    level,
                    "http.request",
                    {"method": "GET", "route": route or "unmatched", "status": status, "duration_ms": round(duration_ms)},
                )
            span.end()

        def _dispatch(self, route: str | None, correlation_id: str) -> int:
            if route == "/healthz":
                return self._send(200, {"status": "ok", "service": service}, correlation_id)
            if route == "/readyz":
                ready = True
                for name, check in readiness.items():
                    try:
                        ok = bool(check())
                    except Exception:  # noqa: BLE001 - dependencia quebrada => nao pronto
                        ok = False
                    if not ok:
                        ready = False
                        kit.logger.log("warning", "readiness.check_failed", {"check": name})
                body = {"status": "ready" if ready else "not_ready", "service": service}
                return self._send(200 if ready else 503, body, correlation_id)
            return self._send(404, None, correlation_id)

        def _send(self, code: int, body: dict[str, str] | None, correlation_id: str) -> int:
            payload = json.dumps(body).encode() if body is not None else b""
            self.send_response(code)
            self.send_header(CORRELATION_HEADER, correlation_id)
            if body is not None:
                self.send_header("content-type", "application/json")
                self.send_header("cache-control", "no-store")
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return code

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - log padrao silenciado
            return

    return Handler
