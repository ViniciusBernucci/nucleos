import io
import json
import threading
import urllib.error
import urllib.request

from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
from event_dispatcher.app import SERVICE, make_server

SENTINEL = "SENTINEL_event_dispatcher_5ec7e7"


def _serve():
    out = io.StringIO()
    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
    kit = make_observability(Logger(SERVICE, "9.9.9", "test", level="debug", stream=out), Telemetry(cfg))
    server = make_server("127.0.0.1", 0, kit)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, out


def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
    server, out = _serve()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with urllib.request.urlopen(f"{base}/healthz") as res:
            assert res.status == 200
            assert json.load(res) == {"status": "ok", "service": "event-dispatcher"}
        with urllib.request.urlopen(f"{base}/readyz") as res:
            assert json.load(res) == {"status": "ready", "service": "event-dispatcher"}
        req = urllib.request.Request(
            f"{base}/outra?token={SENTINEL}",
            headers={"x-request-id": "edge-py-0001", "authorization": f"Bearer {SENTINEL}", "cookie": f"s={SENTINEL}"},
        )
        try:
            urllib.request.urlopen(req)
            raise AssertionError("esperava 404")
        except urllib.error.HTTPError as err:
            assert err.code == 404
            assert err.headers["x-request-id"] == "edge-py-0001"
    finally:
        server.shutdown()
        server.server_close()
    lines = [json.loads(line) for line in out.getvalue().splitlines()]
    record = next(r for r in lines if r["data"]["route"] == "unmatched")
    assert record["correlation_id"] == "edge-py-0001"
    assert record["service"] == "event-dispatcher"
    assert SENTINEL not in out.getvalue()
