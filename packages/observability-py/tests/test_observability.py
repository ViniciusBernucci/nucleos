import io
import json
import random
import threading
import urllib.request

from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
import urllib.error
import pytest

from nucleos_observability import (
    REDACTED,
    SENSITIVE_KEYS,
    Logger,
    Telemetry,
    TelemetryConfig,
    create_business_counter,
    create_job_envelope,
    make_handler,
    make_observability,
    redact,
    resolve_correlation_id,
    run_job,
    telemetry_config_from_env,
)
from http.server import HTTPServer

ALLOWED = ["method", "route", "status", "note"]
SENSITIVE = [*SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"]
OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"]


def test_propriedade_nenhum_sentinela_sobrevive() -> None:
    rnd = random.Random(20261025)
    sentinels: list[str] = []

    def sentinel() -> str:
        s = f"SENTINEL_{len(sentinels)}_{rnd.randrange(10**9):x}"
        sentinels.append(s)
        return s

    def wrap(v: object) -> object:
        r = rnd.random()
        if r < 0.3:
            return [v, {"deep": v}]
        return {"a": {"b": {"c": {"d": v}}}} if r < 0.5 else v

    def gen(depth: int) -> dict[str, object]:
        obj: dict[str, object] = {}
        for _ in range(rnd.randint(1, 5)):
            r = rnd.random()
            if r < 0.35:
                obj[rnd.choice(SENSITIVE)] = wrap(sentinel())
            elif r < 0.6:
                obj[rnd.choice(OTHER)] = wrap(sentinel())
            elif r < 0.75 and depth < 3:
                obj[rnd.choice(ALLOWED)] = gen(depth + 1)
            elif r < 0.85:
                obj[rnd.choice(ALLOWED)] = f"Bearer {sentinel()}"
            else:
                obj[rnd.choice(ALLOWED)] = rnd.randrange(100)
        return obj

    for _ in range(500):
        sentinels.clear()
        out = json.dumps(redact(gen(0), ALLOWED))
        for s in sentinels:
            assert s not in out


def test_chave_sensivel_na_allowlist_continua_redigida() -> None:
    out = redact({"authorization": "x", "token": "y", "note": "ok", "foo": "z"}, ["token", "note"])
    assert out == {"authorization": REDACTED, "token": REDACTED, "note": "ok", "_dropped": 1}
    assert "senha" not in json.dumps(redact({"note": ValueError("senha=abc")}, ["note"]))


def test_correlation_id() -> None:
    assert resolve_correlation_id("edge-req-1234") == "edge-req-1234"
    assert len(resolve_correlation_id(None)) == 36
    assert len(resolve_correlation_id("x\ninjetado")) == 36
    assert len(resolve_correlation_id("edge-req-1234", trust_edge=False)) == 36


def _get(url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str]]:
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {})) as res:
        return res.status, dict(res.headers)


def test_ac1_log_metrica_e_trace_correlacionados_http_job_log() -> None:
    spans = InMemorySpanExporter()
    reader = InMemoryMetricReader()
    cfg = TelemetryConfig(
        enabled=True, service="svc", version="9.9.9", env="test",
        span_processors=[SimpleSpanProcessor(spans)], metric_readers=[reader],
    )
    out = io.StringIO()
    telemetry = Telemetry(cfg)
    kit = make_observability(Logger("svc", "9.9.9", "test", level="debug", stream=out), telemetry)
    server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc"))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/healthz"
        status, headers = _get(url, {"x-request-id": "edge-req-1234"})
        assert status == 200 and headers["x-request-id"] == "edge-req-1234"
    finally:
        server.shutdown()
        server.server_close()
    records = [json.loads(line) for line in out.getvalue().splitlines()]
    http_log = records[0]
    for field in ("ts", "level", "service", "version", "env", "trace_id", "span_id",
                  "correlation_id", "tenant_id", "actor_type", "event"):
        assert field in http_log
    assert http_log["correlation_id"] == "edge-req-1234"
    span = spans.get_finished_spans()[0]
    assert span.attributes["nucleos.correlation_id"] == "edge-req-1234"
    assert format(span.context.trace_id, "032x") == http_log["trace_id"]
    assert format(span.context.span_id, "016x") == http_log["span_id"]
    data = reader.get_metrics_data()
    names = {m.name: m for rm in data.resource_metrics for sm in rm.scope_metrics for m in sm.metrics}
    point = names["http.server.requests"].data.data_points[0]
    assert dict(point.attributes) == {"method": "GET", "route": "/healthz", "status_class": "2xx"}
    assert "http.server.request.duration" in names

    # job: envelope criado dentro de um contexto herda o correlation_id e o restaura no worker
    from nucleos_observability import RequestContext, use_context

    with use_context(RequestContext(correlation_id="edge-req-1234")):
        envelope = create_job_envelope("demo.job", {"n": 1})
    assert envelope.correlation_id == "edge-req-1234"
    out2 = io.StringIO()
    log = Logger("svc", "9.9.9", "test", stream=out2)
    run_job(envelope, lambda e: log.log("info", "job.done", {"job_type": e.type}))
    job_log = json.loads(out2.getvalue())
    assert job_log["correlation_id"] == "edge-req-1234" and job_log["actor_type"] == "system"
    telemetry.shutdown()


def test_readyz_503_sem_detalhes() -> None:
    cfg = TelemetryConfig(enabled=False, service="svc", version="9.9.9", env="test")
    kit = make_observability(Logger("svc", "9.9.9", "test", stream=io.StringIO()), Telemetry(cfg))
    server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc", {"db": lambda: False}))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with pytest.raises(urllib.error.HTTPError) as err:
            urllib.request.urlopen(f"http://127.0.0.1:{server.server_address[1]}/readyz")
        body = err.value.read().decode()
        assert err.value.code == 503
        assert json.loads(body) == {"status": "not_ready", "service": "svc"}
    finally:
        server.shutdown()
        server.server_close()


def test_ac3_otlp_inalcancavel_ou_desabilitado_nao_derruba() -> None:
    assert telemetry_config_from_env({}, "s", "1", "t").enabled is False
    assert telemetry_config_from_env(
        {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://x:1", "OTEL_SDK_DISABLED": "true"}, "s", "1", "t"
    ).enabled is False
    for enabled in (False, True):
        cfg = TelemetryConfig(enabled=enabled, service="svc", version="1", env="t",
                              otlp_endpoint="http://127.0.0.1:1", metric_interval_ms=50)
        tel = Telemetry(cfg)
        kit = make_observability(Logger("svc", "1", "t", stream=io.StringIO()), tel)
        server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc"))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            url = f"http://127.0.0.1:{server.server_address[1]}/healthz"
            assert _get(url)[0] == 200
            assert _get(url)[0] == 200
        finally:
            server.shutdown()
            server.server_close()
            tel.shutdown()


def test_cardinalidade_label_proibido() -> None:
    cfg = TelemetryConfig(enabled=False, service="s", version="1", env="t")
    meter = Telemetry(cfg).meter
    with pytest.raises(ValueError):
        create_business_counter(meter, "x", {"tenant_id": ["a"]})
    create_business_counter(meter, "orders", {"outcome": ["ok", "error"]})(1, {"outcome": "qualquer"})
