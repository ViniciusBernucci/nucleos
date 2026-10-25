"""Logging estruturado JSON (structlog) com campos fixos e redacao por allowlist."""

import sys
from datetime import UTC, datetime
from collections.abc import Mapping
from typing import Any, TextIO

import structlog

from nucleos_observability.context import current_context
from nucleos_observability.redact import DEFAULT_RULES, StringRule, redact

DEFAULT_ALLOWLIST: Mapping[str, StringRule] = DEFAULT_RULES
_LEVELS = {"debug": 10, "info": 20, "warning": 30, "error": 40}


class Logger:
    """Campos fixos: ts, level, service, version, env, trace_id, span_id, correlation_id,
    tenant_id, actor_type, event (+ `data` redigido)."""

    def __init__(
        self,
        service: str,
        version: str,
        env: str,
        level: str = "info",
        allowlist: tuple[str, ...] | Mapping[str, StringRule] = (),
        stream: TextIO | None = None,
    ) -> None:
        extra = allowlist if isinstance(allowlist, Mapping) else dict.fromkeys(allowlist)
        self._allowlist: dict[str, StringRule] = {**DEFAULT_ALLOWLIST, **extra}
        self._base = {"service": service, "version": version, "env": env}
        self._log = structlog.wrap_logger(
            structlog.PrintLogger(file=stream or sys.stdout),
            processors=[self._build, structlog.processors.JSONRenderer(sort_keys=False)],
            wrapper_class=structlog.make_filtering_bound_logger(_LEVELS[level]),
        )

    def _build(self, _logger: Any, method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
        ctx = current_context()
        span_ctx = ctx.span.get_span_context() if ctx and ctx.span else None
        record: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": method_name,
            **self._base,
            "trace_id": format(span_ctx.trace_id, "032x") if span_ctx and span_ctx.is_valid else None,
            "span_id": format(span_ctx.span_id, "016x") if span_ctx and span_ctx.is_valid else None,
            "correlation_id": ctx.correlation_id if ctx else None,
            "tenant_id": ctx.tenant_id if ctx else None,
            "actor_type": ctx.actor_type if ctx else None,
            "event": event_dict["event"],
        }
        if "data" in event_dict:
            try:
                record["data"] = redact(event_dict["data"], self._allowlist)
            except Exception:  # noqa: BLE001 - fail-open sem dados
                record["data"] = "[REDACTION_ERROR]"
        return record

    def log(self, level: str, event: str, data: Any = None) -> None:
        method = getattr(self._log, level)
        if data is None:
            method(event)
        else:
            method(event, data=data)
