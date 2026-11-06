import http.client
import io
import json
import threading
from decimal import Decimal

import pytest
from ai_gateway.app import make_server
from ai_gateway.cfo import AgenteCfo, Limites, configurar, pedido
from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability

PERIODO = {"competencia": "diagnostico", "de": "2026-11-01", "ate": "2026-11-06"}


class ModeloFalso:
    def __init__(self, blocos=None):
        self.blocos = blocos or [[{"type": "text", "text": "Analise sem dados pessoais."}]]
        self.chamadas = []

    def contar(self, mensagens, modelo):
        return 100

    def responder(self, mensagens, modelo, saida):
        self.chamadas.append((mensagens.copy(), modelo, saida))
        return {
            "content": self.blocos[min(len(self.chamadas) - 1, len(self.blocos) - 1)],
            "usage": {"input_tokens": 100, "output_tokens": 20},
            "stop_reason": "end_turn",
        }


def test_ferramenta_somente_leitura_e_uso_sem_prompt():
    modelo = ModeloFalso(
        [
            [{"type": "tool_use", "name": "dre", "id": "t1", "input": {}}],
            [{"type": "text", "text": "Resultado agregado."}],
        ]
    )
    chamadas = []

    def ler(nome, periodo):
        chamadas.append((nome, periodo))
        return [{"mes": "2026-11", "resultado": "10000"}]

    resultado = AgenteCfo(modelo, ler).executar(PERIODO)
    assert resultado["status"] == "SUCESSO"
    assert resultado["ferramentas"] == ["dre"]
    assert resultado["uso"]["entrada"] == 200
    assert chamadas == [("dre", PERIODO)]
    assert set(json.loads(modelo.chamadas[0][0][0]["content"])) == set(PERIODO)
    assert "resposta" not in resultado["uso"]


@pytest.mark.parametrize("tool", ["pagar", "excluir", "POST", "alterar_limites", "http://externo"])
def test_modelo_nao_pode_escrever(tool):
    modelo = ModeloFalso([[{"type": "tool_use", "name": tool, "id": "t1", "input": {}}]])

    def proibido(*_):
        pytest.fail("ferramenta de escrita foi executada")

    assert AgenteCfo(modelo, proibido).executar(PERIODO)["status"] == "FERRAMENTA_RECUSADA"


def test_argumentos_nao_permitidos_e_limites_nao_sao_configuraveis_pelo_modelo():
    modelo = ModeloFalso(
        [[{"type": "tool_use", "name": "dre", "id": "t1", "input": {"url": "http://externo"}}]]
    )
    assert AgenteCfo(modelo, lambda *_: {}).executar(PERIODO)["status"] == "FERRAMENTA_RECUSADA"
    with pytest.raises(ValueError, match="pedido"):
        pedido({**PERIODO, "max_custo": 1000})
    with pytest.raises(ValueError, match="pedido"):
        pedido({**PERIODO, "pergunta": "pessoa@exemplo.com"})


def test_reserva_de_custo_bloqueia_antes_da_chamada_paga():
    modelo = ModeloFalso()
    resultado = AgenteCfo(modelo, lambda *_: {}, Limites(custo=Decimal("0.000001"))).executar(
        PERIODO
    )
    assert resultado["status"] == "LIMITE_CUSTO"
    assert modelo.chamadas == []


def test_limite_tokens_e_passos():
    modelo = ModeloFalso()
    assert (
        AgenteCfo(modelo, lambda *_: {}, Limites(tokens=100)).executar(PERIODO)["status"]
        == "LIMITE_TOKENS"
    )
    modelo = ModeloFalso([[{"type": "tool_use", "name": "dre", "id": "t1", "input": {}}]])
    assert (
        AgenteCfo(modelo, lambda *_: {}, Limites(passos=2)).executar(PERIODO)["status"]
        == "LIMITE_PASSOS"
    )
    assert len(modelo.chamadas) == 2


@pytest.mark.parametrize(
    "dados",
    [
        {**PERIODO, "de": "2026-02-30"},
        {**PERIODO, "ate": "2020-01-01"},
        {**PERIODO, "competencia": "escrever"},
        {**PERIODO, "de": "2020-01-01"},
    ],
)
def test_pedido_invalido(dados):
    with pytest.raises(ValueError, match=r"invalido|invalida"):
        pedido(dados)


def test_gateway_autenticado_sem_rede_externa_e_sem_segredos_em_logs():
    stream = io.StringIO()
    kit = make_observability(
        Logger("ai-gateway", "test", "test", stream=stream),
        Telemetry(TelemetryConfig(enabled=False, service="ai-gateway", version="test", env="test")),
    )
    server = make_server(
        "127.0.0.1",
        0,
        kit,
        agente=AgenteCfo(ModeloFalso(), lambda *_: {}),
        chave="sentinela-segredo",
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:

        def chamar(path, chave="sentinela-segredo", corpo=None):
            conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
            try:
                conn.request(
                    "GET" if corpo is None else "POST",
                    path,
                    body=None if corpo is None else json.dumps(corpo),
                    headers={"Authorization": "Bearer " + chave},
                )
                r = conn.getresponse()
                return r.status, json.loads(r.read())
            finally:
                conn.close()

        assert chamar("/v1/agentes/disponibilidade", "errada")[0] == 401
        assert chamar("/v1/agentes/disponibilidade")[1] == {"disponivel": True}
        assert chamar("/v1/agentes/executar", corpo=PERIODO)[1]["status"] == "SUCESSO"
        assert (
            chamar("/v1/agentes/executar", corpo={**PERIODO, "pergunta": "email@exemplo.com"})[0]
            == 400
        )
        assert "sentinela-segredo" not in stream.getvalue()
        assert "email@exemplo.com" not in stream.getvalue()
    finally:
        server.shutdown()
        server.server_close()


def test_sem_chave_nao_cria_cliente_claude():
    assert configurar({}) == (None, None)
    assert configurar({"AI_GATEWAY_API_KEY": "local"}) == ("local", None)


def test_custo_observado_acima_do_teto_interrompe_e_resposta_vazia_nao_e_sucesso():
    class Excedido(ModeloFalso):
        def responder(self, mensagens, modelo, saida):
            resposta = super().responder(mensagens, modelo, saida)
            resposta["usage"] = {"input_tokens": 100, "output_tokens": 50000}
            return resposta

    assert AgenteCfo(Excedido(), lambda *_: {}).executar(PERIODO)["status"] == "LIMITE_CUSTO"
    assert (
        AgenteCfo(ModeloFalso([[{"type": "text", "text": ""}]]), lambda *_: {}).executar(PERIODO)[
            "status"
        ]
        == "SEM_RESPOSTA"
    )
