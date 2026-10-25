"""Redacao por allowlist: so campos explicitamente permitidos chegam ao log."""

import re
from collections.abc import Iterable, Mapping
from typing import Any

REDACTED = "[REDACTED]"
SENSITIVE_KEYS = frozenset(
    {"authorization", "cookie", "set_cookie", "password", "token", "secret", "prompt", "content", "api_key"}
)
_SENSITIVE_PATTERN = re.compile(
    r"authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session",
    re.IGNORECASE,
)
_VALUE_PATTERNS = (
    re.compile(r"\bBearer\s+\S+", re.IGNORECASE),
    re.compile(r"\beyJ[\w-]+(?:\.[\w-]*)*"),
    re.compile(r"(?:password|passwd|token|secret|api[-_]?key)\s*[=:]\s*\S+", re.IGNORECASE),
)
_MAX_DEPTH = 4
_MAX_ITEMS = 20
_MAX_STRING = 256
_DROPPED = "_dropped"


def _normalize(key: str) -> str:
    return key.lower().replace("-", "_")


def _scrub(value: str) -> str:
    """Scrub ANTES de truncar: um token cortado no limite nao pode escapar do padrao."""
    out = value
    for pattern in _VALUE_PATTERNS:
        out = pattern.sub(REDACTED, out)
    return out[:_MAX_STRING] + "..." if len(out) > _MAX_STRING else out


# Regra de string por chave: Pattern (valor inteiro, via fullmatch) ou FREE (opt-in; contrato do
# chamador). Chave sem regra (None) aceita apenas numero/booleano/None.
FREE = "free"
StringRule = re.Pattern[str] | str | None
_NAME = re.compile(r"[A-Za-z0-9_.$]{1,64}")
_IDENT = re.compile(r"[A-Za-z0-9_.-]{1,64}")
DEFAULT_RULES: dict[str, StringRule] = {
    "method": re.compile(r"[A-Z]{1,16}"),
    "route": re.compile(r"(?:unmatched|/[A-Za-z0-9_\-./:{}]*)"),
    "status": None,
    "duration_ms": None,
    "check": _IDENT,
    "job_type": _IDENT,
}


def redact(value: Any, allowlist: Iterable[str] | Mapping[str, StringRule]) -> Any:
    """Mesmas regras da biblioteca TS: dado de topo so dict simples (senao `{_dropped: 1}`);
    chave sensivel => [REDACTED] (nome so se conhecido ou permitido); chave fora da allowlist =>
    descartada e contada em `_dropped`; string so passa com regra declarada na chave (senao
    [REDACTED]); excecoes viram apenas o nome da classe."""
    if isinstance(allowlist, Mapping):
        rules = {_normalize(k): r for k, r in allowlist.items()}
    else:
        rules = {_normalize(k): None for k in allowlist}
    if type(value) is not dict:
        return {_DROPPED: 1}
    return _walk(value, rules, 0, None)


def _walk(value: Any, rules: Mapping[str, StringRule], depth: int, rule: StringRule) -> Any:
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, str):
        if rule is None:
            return REDACTED
        if isinstance(rule, re.Pattern) and not rule.fullmatch(value):
            return REDACTED
        return _scrub(value)
    if isinstance(value, BaseException):
        name = type(value).__name__
        return {"name": name if _NAME.fullmatch(name) else REDACTED}
    if depth >= _MAX_DEPTH:
        return "[TRUNCATED]"
    if isinstance(value, list | tuple):
        return [_walk(item, rules, depth + 1, rule) for item in value[:_MAX_ITEMS]]
    if type(value) is dict:
        out: dict[str, Any] = {}
        dropped = 0
        for raw_key, child in value.items():
            key = _normalize(str(raw_key))
            is_allowed = key in rules
            if key in SENSITIVE_KEYS or (is_allowed and _SENSITIVE_PATTERN.search(key)):
                out[key] = REDACTED
            elif not is_allowed or _SENSITIVE_PATTERN.search(key):
                dropped += 1
            else:
                out[key] = _walk(child, rules, depth + 1, rules[key])
        if dropped:
            out[_DROPPED] = dropped
        return out
    return "[UNSUPPORTED]"
