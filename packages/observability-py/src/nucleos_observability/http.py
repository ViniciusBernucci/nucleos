"""Handler HTTP (stdlib) observado: correlation id, span, log, RED e sondas /healthz e /readyz."""

import json
import time
from concurrent.futures import ThreadPoolExecutor
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


CHECK_TIMEOUT_S = 2.0
_METHODS = frozenset({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})


def _run_checks(kit: Observability, readiness: Mapping[str, Callable[[], bool]]) -> bool:
    """Roda os checks em paralelo, cada um com timeout proprio (pior caso: CHECK_TIMEOUT_S)."""
    if not readiness:
        return True
    pool = ThreadPoolExecutor(max_workers=len(readiness), thread_name_prefix="readyz")
    futures = {name: pool.submit(check) for name, check in readiness.items()}
    deadline = time.monotonic() + CHECK_TIMEOUT_S
    ready = True
    for name, future in futures.items():
        try:
            ok = bool(future.result(timeout=max(0.0, deadline - time.monotonic())))
        except Exception:  # noqa: BLE001 - dependencia quebrada ou timeout => nao pronto
            ok = False
        if not ok:
            ready = False
            kit.logger.log("warning", "readiness.check_failed", {"check": name})
    pool.shutdown(wait=False, cancel_futures=True)  # check pendurado nao segura a resposta
    return ready


_Reply = tuple[int, dict[str, str] | None, dict[str, str] | None]


def make_handler(
    kit: Observability,
    service: str,
    checks: ReadinessChecks | None = None,
    trust_edge: bool = False,
) -> type[BaseHTTPRequestHandler]:
    """Cria o handler do servico. Rotas conhecidas: apenas as sondas; o resto e `unmatched`.

    `trust_edge=False` (padrao) ignora `X-Request-Id` do cliente. Use com `ThreadingHTTPServer`
    para que um `/readyz` lento nao bloqueie o `/healthz`.
    """
    readiness = dict(checks or {})

    class Handler(BaseHTTPRequestHandler):
        server_version = "nucleos"  # nao expoe a stack/versoes (BaseHTTP/Python)
        sys_version = ""

        def do_GET(self) -> None:  # noqa: N802 - API da stdlib
            self._handle("GET")

        def do_HEAD(self) -> None:  # noqa: N802
            self._handle("HEAD")

        def do_POST(self) -> None:  # noqa: N802
            self._handle("POST")

        def do_PUT(self) -> None:  # noqa: N802
            self._handle("PUT")

        def do_PATCH(self) -> None:  # noqa: N802
            self._handle("PATCH")

        def do_DELETE(self) -> None:  # noqa: N802
            self._handle("DELETE")

        def do_OPTIONS(self) -> None:  # noqa: N802
            self._handle("OPTIONS")

        def _handle(self, method: str) -> None:
            correlation_id = resolve_correlation_id(self.headers.get(CORRELATION_HEADER), trust_edge)
            started = time.perf_counter()
            span = kit.telemetry.tracer.start_span(
                f"HTTP {method}",
                kind=SpanKind.SERVER,
                attributes={"http.request.method": method, "nucleos.correlation_id": correlation_id},
            )
            path = self.path.split("?", 1)[0]
            route = path if path in PROBES else None
            try:
                with use_context(RequestContext(correlation_id=correlation_id, span=span)):
                    status, body, extra = self._dispatch(method, route)
                    duration_ms = (time.perf_counter() - started) * 1000
                    span.update_name(f"HTTP {method} {route or 'unmatched'}")
                    span.set_attribute("http.route", route or "unmatched")
                    span.set_attribute("http.response.status_code", status)
                    if status >= 500:
                        span.set_status(StatusCode.ERROR)
                    kit.red.record(RedSample(method, route, status, duration_ms))
                    level = "debug" if route in PROBES and status < 500 else "info"
                    kit.logger.log(
                        level,
                        "http.request",
                        {
                            "method": method if method in _METHODS else "OTHER",
                            "route": route or "unmatched",
                            "status": status,
                            "duration_ms": round(duration_ms),
                        },
                    )
                    # Resposta enviada SO depois de metricas/log: quem recebe a resposta ja encontra o
                    # registro escrito (sem corrida entre cliente e thread do handler).
                    self._send(status, body, correlation_id, extra)
            except Exception:
                span.set_status(StatusCode.ERROR)
                raise
            finally:
                span.end()

        def _dispatch(self, method: str, route: str | None) -> _Reply:
            if route is None:
                return 404, None, None
            if method != "GET":
                return 405, None, {"allow": "GET"}
            if route == "/healthz":
                return 200, {"status": "ok", "service": service}, None
            ready = _run_checks(kit, readiness)
            return 200 if ready else 503, {"status": "ready" if ready else "not_ready", "service": service}, None

        def _send(
            self, code: int, body: dict[str, str] | None, correlation_id: str, extra: dict[str, str] | None = None
        ) -> None:
            payload = json.dumps(body).encode() if body is not None else b""
            self.send_response(code)
            self.send_header(CORRELATION_HEADER, correlation_id)
            for name, value in (extra or {}).items():
                self.send_header(name, value)
            if body is not None:
                self.send_header("content-type", "application/json")
                self.send_header("cache-control", "no-store")
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - log padrao silenciado
            return

    return Handler
