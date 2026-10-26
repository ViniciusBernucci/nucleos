"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""

import os
import sys
from http.server import ThreadingHTTPServer

from nucleos_observability import (
    Logger,
    Observability,
    Telemetry,
    make_handler,
    make_observability,
    telemetry_config_from_env,
)

SERVICE = "ai-gateway"
HEALTH_PATH = "/healthz"


def default_observability() -> Observability:
    version = os.environ.get("APP_VERSION", "0.0.0")
    env = os.environ.get("APP_ENV", "local")
    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))


def make_server(
    host: str = "127.0.0.1", port: int = 8002, kit: Observability | None = None
) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8002"))
    print(f"{SERVICE} em http://{host}:{port}", flush=True)
    make_server(host, port).serve_forever()


if __name__ == "__main__":
    main()
