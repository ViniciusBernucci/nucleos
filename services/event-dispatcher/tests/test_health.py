import json
import threading
import urllib.error
import urllib.request

import pytest
from event_dispatcher.app import make_server


def test_healthz() -> None:
    server = make_server("127.0.0.1", 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as res:
            assert res.status == 200
            assert json.load(res) == {"status": "ok", "service": "event-dispatcher"}
        with pytest.raises(urllib.error.HTTPError) as excinfo:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/outra")
        assert excinfo.value.code == 404
    finally:
        server.shutdown()
        server.server_close()
