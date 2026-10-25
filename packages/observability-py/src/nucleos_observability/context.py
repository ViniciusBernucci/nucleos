"""Correlation id por contextvars (HTTP -> job -> log)."""

import re
import uuid
from collections.abc import Callable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Iterator

from opentelemetry.trace import Span

CORRELATION_HEADER = "x-request-id"
_VALID_ID = re.compile(r"[A-Za-z0-9._-]{8,128}")


@dataclass
class RequestContext:
    correlation_id: str
    actor_type: str = "anonymous"
    tenant_id: str | None = None  # somente de fonte confiavel; nunca de header de cliente
    span: Span | None = None


_current: ContextVar[RequestContext | None] = ContextVar("nucleos_request_context", default=None)


def current_context() -> RequestContext | None:
    return _current.get()


@contextmanager
def use_context(ctx: RequestContext) -> Iterator[RequestContext]:
    token = _current.set(ctx)
    try:
        yield ctx
    finally:
        _current.reset(token)


def set_trusted_tenant(tenant_id: str, actor_type: str = "user") -> None:
    ctx = _current.get()
    if ctx is not None:
        ctx.tenant_id = tenant_id
        ctx.actor_type = actor_type


def resolve_correlation_id(header: str | None, trust_edge: bool = False) -> str:
    """Aceita X-Request-Id somente com trust_edge=True (borda confiavel, FND-007) e formato seguro;
    padrao False, ausente ou invalido => UUID novo."""
    if trust_edge and header is not None and _VALID_ID.fullmatch(header):
        return header
    return str(uuid.uuid4())


def correlation_headers() -> dict[str, str]:
    ctx = _current.get()
    return {CORRELATION_HEADER: ctx.correlation_id} if ctx else {}


@dataclass
class JobEnvelope:
    """Envelope minimo de job; FND-003 (contracts) pode substitui-lo mantendo correlation_id."""

    type: str
    payload: Any
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    enqueued_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


def create_job_envelope(job_type: str, payload: Any) -> JobEnvelope:
    ctx = _current.get()
    if ctx is None:
        return JobEnvelope(type=job_type, payload=payload)
    return JobEnvelope(type=job_type, payload=payload, correlation_id=ctx.correlation_id)


def run_job[T](envelope: JobEnvelope, fn: Callable[[JobEnvelope], T]) -> T:
    cid = envelope.correlation_id if _VALID_ID.fullmatch(envelope.correlation_id) else str(uuid.uuid4())
    with use_context(RequestContext(correlation_id=cid, actor_type="system")):
        return fn(envelope)
