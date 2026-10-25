"""Servidor HTTP minimo (stdlib) com /healthz. Framework real entra em ticket proprio."""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

SERVICE = "tool-gateway"
HEALTH_PATH = "/healthz"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != HEALTH_PATH:
            self.send_error(404)
            return
        body = json.dumps({"status": "ok", "service": SERVICE}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # silencia o log padrao
        return


def make_server(host: str = "127.0.0.1", port: int = 8003) -> HTTPServer:
    return HTTPServer((host, port), Handler)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8003"))
    print(f"{SERVICE} em http://{host}:{port}", flush=True)
    make_server(host, port).serve_forever()


if __name__ == "__main__":
    main()
