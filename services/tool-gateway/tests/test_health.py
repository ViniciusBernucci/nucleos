import http.client
import io
import json
import threading

from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
from tool_gateway.app import SERVICE, make_server

SENTINEL = "SENTINEL_tool_gateway_5ec7e7"


def _serve():
    out = io.StringIO()
    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
    logger = Logger(SERVICE, "9.9.9", "test", level="debug", stream=out)
    kit = make_observability(logger, Telemetry(cfg))
    server = make_server("127.0.0.1", 0, kit)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, out


def _get(port: int, path: str, headers: dict[str, str] | None = None):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.request("GET", path, headers=headers or {})
        res = conn.getresponse()
        return res.status, dict(res.getheaders()), res.read()
    finally:
        conn.close()


def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
    server, out = _serve()
    port = server.server_address[1]
    try:
        status, _, body = _get(port, "/healthz")
        assert status == 200
        assert json.loads(body) == {"status": "ok", "service": "tool-gateway"}
        _, _, body = _get(port, "/readyz")
        assert json.loads(body) == {"status": "ready", "service": "tool-gateway"}
        status, headers, _ = _get(
            port,
            f"/outra?token={SENTINEL}",
            {
                "x-request-id": "edge-py-0001",
                "authorization": f"Bearer {SENTINEL}",
                "cookie": f"s={SENTINEL}",
            },
        )
        assert status == 404
        returned = headers["x-request-id"]
        assert returned != "edge-py-0001"  # trust_edge=False por padrao
        assert len(returned) == 36
    finally:
        server.shutdown()
        server.server_close()
    lines = [json.loads(line) for line in out.getvalue().splitlines()]
    record = next(r for r in lines if r["data"]["route"] == "unmatched")
    assert record["correlation_id"] == returned
    assert record["service"] == "tool-gateway"
    assert SENTINEL not in out.getvalue()
