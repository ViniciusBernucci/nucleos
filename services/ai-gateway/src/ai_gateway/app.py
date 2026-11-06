"""Gateway HTTP do CFO com autenticacao interna, probes e observabilidade."""

import hmac
import json
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

from ai_gateway.cfo import AgenteCfo, configurar

SERVICE = "ai-gateway"
HEALTH_PATH = "/healthz"


def default_observability() -> Observability:
    version = os.environ.get("APP_VERSION", "0.0.0")
    env = os.environ.get("APP_ENV", "local")
    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))


def make_server(
    host: str = "127.0.0.1",
    port: int = 8002,
    kit: Observability | None = None,
    agente: AgenteCfo | None = None,
    chave: str | None = None,
) -> ThreadingHTTPServer:
    observacao = kit or default_observability()
    base = make_handler(observacao, SERVICE)

    # A fabrica retorna uma subclasse de BaseHTTPRequestHandler, resolvida em runtime.
    class Handler(base):  # type: ignore[valid-type,misc]
        def do_GET(self) -> None:
            if self.path == "/v1/agentes/disponibilidade":
                self._agente("GET")
            else:
                super().do_GET()

        def do_POST(self) -> None:
            if self.path == "/v1/agentes/executar":
                self._agente("POST")
            else:
                super().do_POST()

        def _agente(self, metodo: str) -> None:
            status = 200
            dados: dict[str, object] = {}
            try:
                credencial = self.headers.get("Authorization", "")
                if not chave:
                    status, dados = 503, {"erro": "CFO indisponivel"}
                elif not hmac.compare_digest(credencial.encode(), ("Bearer " + chave).encode()):
                    status, dados = 401, {"erro": "nao autorizado"}
                elif metodo == "GET":
                    dados = {"disponivel": agente is not None}
                elif agente is None:
                    status, dados = 503, {"erro": "configure ANTHROPIC_API_KEY no gateway"}
                else:
                    tamanho = int(self.headers.get("Content-Length", "0"))
                    if self.headers.get("Transfer-Encoding") or not 1 <= tamanho <= 1024:
                        raise ValueError("corpo invalido")
                    self.connection.settimeout(5)
                    dados = agente.executar(json.loads(self.rfile.read(tamanho)))
                    observacao.logger.log(
                        "info", "cfo.uso", {"status": dados["status"], "uso": dados["uso"]}
                    )
            except (ValueError, TypeError, json.JSONDecodeError):
                status, dados = 400, {"erro": "pedido CFO invalido"}
            except Exception:
                status, dados = 502, {"erro": "CFO indisponivel"}
            corpo = json.dumps(dados).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(corpo)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(corpo)
            self.close_connection = True

    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8002"))
    print(f"{SERVICE} em http://{host}:{port}", flush=True)
    chave, agente = configurar()
    make_server(host, port, agente=agente, chave=chave).serve_forever()


if __name__ == "__main__":
    main()
