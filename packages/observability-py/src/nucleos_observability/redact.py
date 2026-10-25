"""Redacao por allowlist: so campos explicitamente permitidos chegam ao log."""

import re
from collections.abc import Iterable
from typing import Any

REDACTED = "[REDACTED]"
SENSITIVE_KEYS = frozenset(
    {"authorization", "cookie", "set_cookie", "password", "token", "secret", "prompt", "content", "api_key"}
)
_SENSITIVE_PATTERN = re.compile(
    r"authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session",
    re.IGNORECASE,
)
_VALUE_PATTERNS = (re.compile(r"\bBearer\s+\S+", re.IGNORECASE), re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]*"))
_MAX_DEPTH = 4
_MAX_ITEMS = 20
_MAX_STRING = 256
_DROPPED = "_dropped"


def _normalize(key: str) -> str:
    return key.lower().replace("-", "_")


def _scrub(value: str) -> str:
    out = value[:_MAX_STRING] + "..." if len(value) > _MAX_STRING else value
    for pattern in _VALUE_PATTERNS:
        out = pattern.sub(REDACTED, out)
    return out


def redact(value: Any, allowlist: Iterable[str], depth: int = 0) -> Any:
    """Mesmas regras da biblioteca TS: chave sensivel => [REDACTED] (nome so se conhecido ou
    permitido); chave fora da allowlist => descartada e contada em `_dropped`; excecoes viram
    apenas o nome da classe."""
    allowed = frozenset(_normalize(k) for k in allowlist)
    return _walk(value, allowed, depth)


def _walk(value: Any, allowed: frozenset[str], depth: int) -> Any:
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, str):
        return _scrub(value)
    if isinstance(value, BaseException):
        return {"name": type(value).__name__}
    if depth >= _MAX_DEPTH:
        return "[TRUNCATED]"
    if isinstance(value, list | tuple):
        return [_walk(item, allowed, depth + 1) for item in value[:_MAX_ITEMS]]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        dropped = 0
        for raw_key, child in value.items():
            key = _normalize(str(raw_key))
            is_allowed = key in allowed
            if key in SENSITIVE_KEYS or (is_allowed and _SENSITIVE_PATTERN.search(key)):
                out[key] = REDACTED
            elif not is_allowed or _SENSITIVE_PATTERN.search(key):
                dropped += 1
            else:
                out[key] = _walk(child, allowed, depth + 1)
        if dropped:
            out[_DROPPED] = dropped
        return out
    return "[UNSUPPORTED]"
