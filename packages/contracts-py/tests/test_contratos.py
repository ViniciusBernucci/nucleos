"""Testes de contrato em Python: os MESMOS exemplos de packages/contracts/exemplos do TypeScript."""

from __future__ import annotations

import importlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest
from nucleos_contracts import (
    ContractViolationError,
    assert_valid,
    is_rfc3339_date_time,
    runtime_token_semantic_errors,
    schema_names,
    validate,
)
from nucleos_contracts.validation import _ecma_to_python
from pydantic import BaseModel, ValidationError

PACOTE = Path(__file__).resolve().parents[2] / "contracts"
EXEMPLOS = PACOTE / "exemplos"


def _carregar() -> list[tuple[str, str | None, bool, str, Path]]:
    casos: list[tuple[str, str | None, bool, str, Path]] = []
    for pasta in sorted(p for p in EXEMPLOS.rglob("*") if p.name in ("validos", "invalidos")):
        relativo = pasta.relative_to(EXEMPLOS).parts
        schema, definicao = relativo[0], (relativo[1] if len(relativo) == 3 else None)
        for arq in sorted(pasta.glob("*.json")):
            casos.append((schema, definicao, pasta.name == "validos", arq.name, arq))
    return casos


CASOS = _carregar()
IDS = [f"{s}{'#' + d if d else ''}-{'aceita' if v else 'rejeita'}-{n}" for s, d, v, n, _ in CASOS]


def test_todo_schema_tem_exemplos() -> None:
    for nome in schema_names():
        doschema = [c for c in CASOS if c[0] == nome]
        assert any(c[2] for c in doschema), f"{nome}: sem exemplo valido"
        assert sum(1 for c in doschema if not c[2]) >= 3, f"{nome}: poucos invalidos"
    assert {c[0] for c in CASOS} <= set(schema_names())


@pytest.mark.parametrize(("schema", "definicao", "valido", "_nome", "arquivo"), CASOS, ids=IDS)
def test_exemplo_tem_o_mesmo_resultado_do_typescript(
    schema: str, definicao: str | None, valido: bool, _nome: str, arquivo: Path
) -> None:
    dado = json.loads(arquivo.read_text("utf-8"))
    problemas = validate(schema, dado, definicao)
    assert (not problemas) == valido, problemas


# --- Modelos Pydantic gerados ---------------------------------------------------------------
CLASSES = {
    ("job-envelope", None): ("job_envelope", "JobEnvelope"),
    ("runtime-token", None): ("runtime_token", "RuntimeToken"),
    ("handshake", "jwk_publica"): ("handshake", "JwkPublica"),
    ("handshake", "enrollment_request"): ("handshake", "EnrollmentRequest"),
    ("handshake", "enrollment_response"): ("handshake", "EnrollmentResponse"),
    ("handshake", "token_request"): ("handshake", "TokenRequest"),
    ("handshake", "token_response"): ("handshake", "TokenResponse"),
    ("handshake", "jwks"): ("handshake", "Jwks"),
    ("handshake", "revocation_state"): ("handshake", "RevocationState"),
    ("tool-call-request", None): ("tool_call_request", "ToolCallRequest"),
    ("tool-call-response", None): ("tool_call_response", "ToolCallResponse"),
    ("ai-completion-request", None): ("ai_completion_request", "AiCompletionRequest"),
    ("ai-completion-response", None): ("ai_completion_response", "AiCompletionResponse"),
    ("subscription-event", None): ("subscription_event", "SubscriptionEvent"),
    ("realtime-event", None): ("realtime_event", "RealtimeEvent"),
    ("tenant-runtime-spec", None): ("tenant_runtime_spec", "TenantRuntimeSpec"),
    ("problem-details", None): ("problem_details", "ProblemDetails"),
}

# Regras que o gerador NAO traduz para Pydantic (if/then/else, uniqueItems, not, propertyNames,
# formato estrito de data-hora): o modelo gerado as aceita. A validacao autoritativa e `validate`
# (JSON Schema, mesmo resultado do TypeScript); o modelo e uma conveniencia tipada. Lista FECHADA:
# um caso novo aqui exige revisao (e o teste abaixo falha se o gerador passar a cobrir algum).
LACUNAS_DO_MODELO = {
    ("subscription-event", "04-falha-sem-codigo-nem-tentativa.json"),
    ("subscription-event", "05-pagamento-sem-bloco-payment.json"),
    ("subscription-event", "06-simulador-com-simulated-false.json"),
    ("subscription-event", "07-provedor-real-com-simulated-true.json"),
    ("subscription-event", "09-plan-changed-sem-plano.json"),
    ("subscription-event", "14-data-hora-minuscula.json"),
    ("subscription-event", "15-fuso-sem-dois-pontos.json"),
    ("subscription-event", "21-separador-espaco.json"),
    ("tool-call-response", "01-ok-sem-result.json"),
    ("tool-call-response", "02-error-sem-error.json"),
    ("tool-call-response", "03-ok-com-error.json"),
    ("ai-completion-response", "01-ok-sem-usage.json"),
    ("ai-completion-response", "04-ok-sem-content.json"),
    ("ai-completion-response", "05-error-sem-error.json"),
    ("handshake", "03-chave-nao-uuid.json"),
    ("realtime-event", "03-data-chave-maiuscula.json"),
    ("runtime-token", "08-scope-duplicado.json"),
    ("tenant-runtime-spec", "04-mount-path-com-ponto-ponto.json"),
    ("tenant-runtime-spec", "06-modulos-duplicados.json"),
}


def _modelo(schema: str, definicao: str | None) -> type[BaseModel]:
    modulo, classe = CLASSES[(schema, definicao)]
    cls = getattr(importlib.import_module(f"nucleos_contracts.models.{modulo}"), classe)
    assert issubclass(cls, BaseModel)
    return cls


@pytest.mark.parametrize(("schema", "definicao", "valido", "nome", "arquivo"), CASOS, ids=IDS)
def test_modelo_pydantic_gerado(
    schema: str, definicao: str | None, valido: bool, nome: str, arquivo: Path
) -> None:
    if (schema, definicao) not in CLASSES:
        pytest.skip("schema sem modelo de raiz")
    modelo = _modelo(schema, definicao)
    texto = arquivo.read_text("utf-8")
    if valido:
        obj = modelo.model_validate_json(texto, strict=True)
        # round-trip: modelo -> JSON -> modelo e o JSON emitido ainda cumpre o contrato
        emitido = obj.model_dump_json(exclude_unset=True)
        assert modelo.model_validate_json(emitido) == obj
        assert validate(schema, json.loads(emitido), definicao) == []
    elif (schema, nome) not in LACUNAS_DO_MODELO:
        with pytest.raises(ValidationError):
            modelo.model_validate_json(texto, strict=True)


def test_lacunas_do_modelo_continuam_lacunas() -> None:
    """Se o gerador passar a traduzir uma regra, remova-a da lista (nao esconder cobertura)."""
    achados = 0
    for schema, definicao, valido, nome, arquivo in CASOS:
        if valido or (schema, nome) not in LACUNAS_DO_MODELO:
            continue
        achados += 1
        try:
            _modelo(schema, definicao).model_validate_json(arquivo.read_text("utf-8"), strict=True)
        except ValidationError:
            pytest.fail(f"{schema}/{nome} agora e rejeitado pelo modelo: remover de LACUNAS")
    assert achados == len(LACUNAS_DO_MODELO)


# --- Semantica, formato e cobertura ---------------------------------------------------------
def test_semantica_do_runtime_token() -> None:
    casos: list[dict[str, Any]] = json.loads(
        (EXEMPLOS / "runtime-token" / "semantica.json").read_text("utf-8")
    )
    header = {"alg": "EdDSA", "typ": "nucleos-runtime+jwt", "kid": "k"}
    for c in casos:
        assert validate("runtime-token", {"header": header, "claims": c["claims"]}) == []
        assert runtime_token_semantic_errors(c["claims"]) == c["erros"], c["nome"]


def test_date_time_estrito_mesma_tabela_do_typescript() -> None:
    tabela = json.loads((EXEMPLOS / "date-time.json").read_text("utf-8"))
    for caso in tabela:
        assert is_rfc3339_date_time(caso["valor"]) == caso["valido"], caso["valor"]


def test_quebra_de_linha_final_nao_casa_pattern() -> None:
    problemas = validate("job-envelope", {"type": "x\n"}, None)
    assert any(p.path == "/type" and p.keyword == "pattern" for p in problemas)


def test_assert_valid_e_definicao_inexistente() -> None:
    with pytest.raises(ContractViolationError, match="problem-details"):
        assert_valid("problem-details", {"type": "about:blank", "title": "x", "status": 200})
    with pytest.raises(KeyError):
        validate("problem-details", {}, "nao-existe")


def test_copia_dos_schemas_no_pacote_python_e_identica_a_fonte() -> None:
    for nome in schema_names():
        copia = Path(__file__).resolve().parents[1] / "src" / "nucleos_contracts" / "schemas"
        assert (copia / f"{nome}.schema.json").read_bytes() == (
            PACOTE / "schemas" / f"{nome}.schema.json"
        ).read_bytes()


CODEPOINTS = [*range(0xD800), *range(0xE000, 0x10000), 0x10000, 0x1F600, 0x10FFFF]


def test_varredura_de_codepoints_todos_os_patterns_iguais_ao_ecma() -> None:
    """Todo `pattern` casa os MESMOS codepoints em ECMA-262 (node/ajv) e no motor Python."""
    script = PACOTE / "scripts" / "varrer-patterns.mjs"
    saida = subprocess.run(  # noqa: S603 - script do repositorio, sem entrada externa
        ["node", str(script)],  # noqa: S607
        capture_output=True,
        text=True,
        check=True,
        cwd=PACOTE,
    ).stdout
    ecma: dict[str, list[list[int]]] = json.loads(saida)
    assert len(ecma) >= 40  # protege contra varredura vazia
    for chave, faixas in ecma.items():
        padrao, prefixo = json.loads(chave)
        esperado = {c for ini, fim in faixas for c in range(ini, fim + 1)}
        regex = re.compile(_ecma_to_python(padrao))
        obtido = {
            c
            for c in list(range(0xD800))
            + list(range(0xE000, 0x10000))
            + [0x10000, 0x1F600, 0x10FFFF]
            if regex.search(prefixo + chr(c))
        }
        assert obtido == esperado, (padrao, prefixo, sorted(obtido ^ esperado)[:10])
