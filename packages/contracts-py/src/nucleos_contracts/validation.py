"""Validacao de contratos em Python, com o mesmo resultado do pacote TypeScript @nucleos/contracts.

Fonte unica: os JSON Schemas (2020-12) copiados em ``nucleos_contracts/schemas`` por
``make contracts-gen``. Dois ajustes tornam o jsonschema equivalente ao ajv (ECMA-262):

* ``pattern`` e buscado como em ECMA-262 (``RegExp.test``, sem ancoragem implicita), mas com ``$``
  traduzido para ``\\Z``: em Python, ``$`` aceita uma quebra de linha final ("abc\\n" casa
  ``^[a-z]+$``), em ECMA-262 nao.
* ``date-time`` e o RFC 3339 estrito de ``is_rfc3339_date_time`` (mesma regra e mesma tabela de
  casos de ``packages/contracts/src/datetime.ts``), em vez do verificador padrao da biblioteca.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError
from jsonschema.validators import extend

RUNTIME_TOKEN_MAX_TTL_S = 600

_RFC3339 = re.compile(
    r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?"
    r"(?:Z|[+-]([0-9]{2}):([0-9]{2}))"
)


def _days_in_month(year: int, month: int) -> int:
    if month == 2:
        return 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28
    return 30 if month in (4, 6, 9, 11) else 31


def is_rfc3339_date_time(value: str) -> bool:
    m = _RFC3339.fullmatch(value)
    if m is None:
        return False
    year, month, day, hour, minute, second = (int(g) for g in m.groups()[:6])
    if not 1 <= month <= 12 or not 1 <= day <= _days_in_month(year, month):
        return False
    if hour > 23 or minute > 59 or second > 59:
        return False
    return m.group(7) is None or (int(m.group(7)) <= 23 and int(m.group(8)) <= 59)


def _ecma_to_python(pattern: str) -> str:
    """Traduz `$` (fora de classe e nao escapado) para `\\Z` (fim absoluto da entrada)."""
    out: list[str] = []
    in_class = escaped = False
    for ch in pattern:
        if escaped:
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == "[":
            in_class = True
        elif ch == "]":
            in_class = False
        elif ch == "$" and not in_class:
            out.append("\\Z")
            continue
        out.append(ch)
    return "".join(out)


def _pattern(validator: Any, pattern: str, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if (
        validator.is_type(instance, "string")
        and re.search(_ecma_to_python(pattern), instance) is None
    ):
        yield ValidationError(f"{instance!r} does not match {pattern!r}")


_Validator = extend(Draft202012Validator, {"pattern": _pattern})
_formats = FormatChecker(formats=())


@_formats.checks("date-time")
def _date_time(value: object) -> bool:
    return not isinstance(value, str) or is_rfc3339_date_time(value)


@dataclass(frozen=True)
class ValidationIssue:
    path: str  # JSON Pointer da instancia (vazio = raiz)
    keyword: str
    message: str


class ContractViolationError(ValueError):
    def __init__(self, schema: str, issues: list[ValidationIssue]) -> None:
        self.schema = schema
        self.issues = issues
        detail = "; ".join(f"{i.path or '/'} {i.message}" for i in issues)
        super().__init__(f"violacao do contrato {schema}: {detail}")


@cache
def load_schema(name: str) -> dict[str, Any]:
    text = (files("nucleos_contracts") / "schemas" / f"{name}.schema.json").read_text("utf-8")
    loaded: dict[str, Any] = json.loads(text)
    return loaded


def schema_names() -> list[str]:
    folder = files("nucleos_contracts") / "schemas"
    return sorted(p.name.removesuffix(".schema.json") for p in folder.iterdir())


@cache
def _validator(name: str, definition: str | None) -> Any:
    schema = load_schema(name)
    if definition is not None:
        defs = schema.get("$defs", {})
        if definition not in defs:
            raise KeyError(f"schema ou definicao inexistente: {name}#/$defs/{definition}")
        schema = {
            "$schema": schema["$schema"],
            "$defs": defs,
            "$ref": f"#/$defs/{definition}",
        }
    return _Validator(schema, format_checker=_formats)


def validate(name: str, data: Any, definition: str | None = None) -> list[ValidationIssue]:
    """Problemas (lista vazia = valido) de ``data`` contra ``name`` (ou ``$defs/<definition>``)."""
    errors = _validator(name, definition).iter_errors(data)
    return [
        ValidationIssue("".join(f"/{p}" for p in e.absolute_path), str(e.validator), e.message)
        for e in errors
    ]


def is_valid(name: str, data: Any, definition: str | None = None) -> bool:
    return not validate(name, data, definition)


def assert_valid(name: str, data: Any, definition: str | None = None) -> None:
    issues = validate(name, data, definition)
    if issues:
        raise ContractViolationError(name, issues)


def runtime_token_semantic_errors(claims: Mapping[str, Any]) -> list[str]:
    """Regras do ADR-018 fora do schema; mesmos codigos de ``runtimeTokenSemanticErrors``."""
    errors: list[str] = []
    if claims["sub"] != f"runtime:{claims['tenant_id']}":
        errors.append("sub_tenant_mismatch")
    if claims["exp"] <= claims["iat"]:
        errors.append("ttl_not_positive")
    elif claims["exp"] - claims["iat"] > RUNTIME_TOKEN_MAX_TTL_S:
        errors.append("ttl_too_long")
    return errors
