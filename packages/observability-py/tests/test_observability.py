import io
import re
import time
from collections.abc import Callable
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
    FREE,
    JobEnvelope,
    create_business_counter,
    create_job_envelope,
    make_handler,
    make_observability,
    current_context,
    redact,
    resolve_correlation_id,
    run_job,
    telemetry_config_from_env,
)
from http.server import HTTPServer, ThreadingHTTPServer

# `note` e `items` nao tem validador: string sob elas e sempre [REDACTED].
ALLOWED = ["method", "route", "status", "note", "items"]
SENSITIVE = [*SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"]
OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"]


def _gen_run(seed: int, check: Callable[[list[str], object], None]) -> None:
    rnd = random.Random(seed)
    sentinels: list[str] = []

    def sentinel() -> str:
        s = f"SENTINEL-s3cr3t-{len(sentinels)}-{rnd.randrange(10**9):x}"
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
            if r < 0.2:
                obj[rnd.choice(SENSITIVE)] = wrap(sentinel())
            elif r < 0.35:
                obj[rnd.choice(OTHER)] = wrap(sentinel())
            elif r < 0.5 and depth < 3:
                obj[rnd.choice(ALLOWED)] = gen(depth + 1)
            elif r < 0.58:
                obj[rnd.choice(ALLOWED)] = f"Bearer {sentinel()}"
            elif r < 0.7:
                obj[rnd.choice(["note", "items"])] = sentinel()  # string comum sob chave permitida
            elif r < 0.78:
                obj["items"] = [sentinel(), 1, [sentinel()]]  # item de array
            elif r < 0.84:
                # nome de classe controlado por dado: type() aceita qualquer string
                obj[rnd.choice(["note", "items"])] = type(sentinel(), (Exception,), {})("m")
            elif r < 0.9:
                obj["route"] = f"/x?token={sentinel()}"
            elif r < 0.95:
                obj["note"] = f"password={sentinel()}"
            else:
                obj[rnd.choice(ALLOWED)] = rnd.randrange(100)
        return obj

    def top() -> object:
        r = rnd.random()
        if r < 0.15:
            return sentinel()
        if r < 0.3:
            return [sentinel(), {"note": sentinel()}]
        return gen(0)

    for _ in range(500):
        sentinels.clear()
        check(sentinels, top())


def test_propriedade_nenhum_sentinela_sobrevive() -> None:
    def check(sentinels: list[str], value: object) -> None:
        out = json.dumps(redact(value, ALLOWED))
        for s in sentinels:
            assert s not in out

    _gen_run(20261025, check)


def test_propriedade_na_linha_de_log_real() -> None:
    stream = io.StringIO()
    logger = Logger("s", "1", "t", allowlist=("note", "items"), stream=stream)

    def check(sentinels: list[str], value: object) -> None:
        stream.seek(0)
        stream.truncate()
        logger.log("info", "evt", value)
        out = stream.getvalue()
        for s in sentinels:
            assert s not in out

    _gen_run(77, check)


def test_validos_permanecem_e_strings_so_com_validador() -> None:
    assert redact({"route": "/healthz", "status": 200, "note": "x"}, ["route", "status", "note"]) == {
        "route": REDACTED, "status": 200, "note": REDACTED,
    }
    rules = {"route": re.compile(r"/[a-z]+"), "status": None, "free": FREE, "note": None}
    assert redact({"route": "/healthz", "status": 200, "free": "livre", "note": "x"}, rules) == {
        "route": "/healthz", "status": 200, "free": "livre", "note": REDACTED,
    }
    assert redact({"route": "/x\n"}, rules) == {"route": REDACTED}
    for top in ("s", 1, ["a"], None, ValueError("x"), (1,)):
        assert redact(top, ["note"]) == {"_dropped": 1}


def test_jwt_cortado_no_limite_e_error_name() -> None:
    jwt = "eyJ" + "a" * 300 + ".payload.sig"
    out = json.dumps(redact({"note": "x" * 250 + " " + jwt}, {"note": FREE}))
    assert "eyJ" not in out and "aaaa" not in out
    assert redact({"note": TypeError("m")}, ["note"]) == {"note": {"name": "TypeError"}}
    bad = type("has space", (Exception,), {})("m")
    assert redact({"note": bad}, ["note"]) == {"note": {"name": REDACTED}}


def test_correlation_id() -> None:
    assert len(resolve_correlation_id("abcdefgh12")) == 36  # padrao: nao confia no cliente
    assert resolve_correlation_id("edge-req-1234", trust_edge=True) == "edge-req-1234"
    assert len(resolve_correlation_id(None, trust_edge=True)) == 36
    assert len(resolve_correlation_id("x\ninjetado", trust_edge=True)) == 36
    assert len(resolve_correlation_id("abcdefgh\n", trust_edge=True)) == 36
    assert len(resolve_correlation_id("abcdefgh\r\nX: 1", trust_edge=True)) == 36
    assert len(resolve_correlation_id("edge-req-1234", trust_edge=False)) == 36


def test_run_job_rejeita_id_com_quebra_de_linha() -> None:
    envelope = JobEnvelope(type="t", payload=None, correlation_id="abcdefgh\n")
    seen: list[str] = []
    run_job(envelope, lambda _e: seen.append(current_context().correlation_id))  # type: ignore[union-attr]
    assert len(seen[0]) == 36 and "\n" not in seen[0]


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
    server = HTTPServer(("127.0.0.1", 0), make_handler(kit, "svc", trust_edge=True))
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


def _serve(checks: dict[str, Callable[[], bool]] | None = None) -> tuple[ThreadingHTTPServer, io.StringIO, str]:
    out = io.StringIO()
    kit = make_observability(
        Logger("svc", "9.9.9", "test", level="debug", stream=out),
        Telemetry(TelemetryConfig(enabled=False, service="svc", version="9.9.9", env="test")),
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(kit, "svc", checks))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, out, f"http://127.0.0.1:{server.server_address[1]}"


def test_padrao_ignora_x_request_id_do_cliente() -> None:
    server, _out, base = _serve()
    try:
        _status, headers = _get(f"{base}/healthz", {"x-request-id": "abcdefgh12"})
        assert headers["x-request-id"] != "abcdefgh12" and len(headers["x-request-id"]) == 36
    finally:
        server.shutdown()
        server.server_close()


def test_header_server_neutro_e_metodos_nao_get_com_red_e_log() -> None:
    server, out, base = _serve()
    try:
        _status, headers = _get(f"{base}/healthz")
        assert "python" not in headers["Server"].lower() and "basehttp" not in headers["Server"].lower()
        assert not any(c.isdigit() for c in headers["Server"])
        for method, path, code in (("POST", "/x", 404), ("DELETE", "/healthz", 405), ("PUT", "/readyz", 405)):
            req = urllib.request.Request(f"{base}{path}", method=method, data=b"" if method != "DELETE" else None)
            with pytest.raises(urllib.error.HTTPError) as err:
                urllib.request.urlopen(req)
            assert err.value.code == code
            assert len(err.value.headers["x-request-id"]) == 36
            assert "python" not in err.value.headers["Server"].lower()
        time.sleep(0.05)
        records = [json.loads(line) for line in out.getvalue().splitlines()]
        assert [r["data"]["method"] for r in records if r["event"] == "http.request"][-3:] == ["POST", "DELETE", "PUT"]
    finally:
        server.shutdown()
        server.server_close()


def test_readyz_check_pendurado_tem_timeout_e_nao_bloqueia_healthz() -> None:
    server, _out, base = _serve({"slow": lambda: time.sleep(4) or True, "also": lambda: time.sleep(4) or True})
    try:
        ready_result: list[float | int] = []

        def call_ready() -> None:
            started = time.monotonic()
            try:
                urllib.request.urlopen(f"{base}/readyz")
            except urllib.error.HTTPError as err:
                ready_result.extend([err.code, time.monotonic() - started])

        t = threading.Thread(target=call_ready)
        t.start()
        time.sleep(0.3)
        started = time.monotonic()
        assert _get(f"{base}/healthz")[0] == 200
        assert time.monotonic() - started < 1.0
        t.join(timeout=6)
        assert ready_result[0] == 503 and ready_result[1] < 3.5  # ~2 s em paralelo, nao 8 s
    finally:
        server.shutdown()
        server.server_close()


def test_excecao_no_dispatch_encerra_o_span() -> None:
    spans = InMemorySpanExporter()
    cfg = TelemetryConfig(
        enabled=True, service="svc", version="1", env="t", span_processors=[SimpleSpanProcessor(spans)],
    )
    kit = make_observability(Logger("svc", "1", "t", stream=io.StringIO()), Telemetry(cfg))
    handler_cls = make_handler(kit, "svc")
    handler = object.__new__(handler_cls)
    handler.headers = {}  # type: ignore[assignment]
    handler.path = "/healthz"
    handler._dispatch = lambda *_a: (_ for _ in ()).throw(RuntimeError("boom"))  # type: ignore[method-assign]
    with pytest.raises(RuntimeError):
        handler._handle("GET")
    assert len(spans.get_finished_spans()) == 1
