# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Subscription(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    provider_subscription_id: Annotated[str, Field(max_length=128, min_length=1)]
    provider_customer_id: Annotated[str | None, Field(max_length=128, min_length=1)] = (
        None
    )
    tenant_id: Annotated[
        str | None,
        Field(
            description='Presente quando o vinculo ja existe no Control Plane; senao o CP resolve por provider_subscription_id.',
            pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        ),
    ] = None
    plan_code: Annotated[str | None, Field(pattern='^[a-z0-9][a-z0-9_-]{0,63}$')] = None
    provider_status: Annotated[
        str | None,
        Field(
            description='Status bruto informado pelo provedor, so para auditoria.',
            max_length=64,
            min_length=1,
        ),
    ] = None
    current_period_end: AwareDatetime | None = None


class Payment(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    provider_invoice_id: Annotated[str | None, Field(max_length=128, min_length=1)] = (
        None
    )
    amount_minor: Annotated[int, Field(ge=0)]
    currency: Annotated[str, Field(pattern='^[A-Z]{3}$')]
    failure_code: Annotated[str | None, Field(max_length=64, min_length=1)] = None
    attempt_count: Annotated[int | None, Field(ge=1)] = None
    next_retry_at: AwareDatetime | None = None


class SubscriptionEvent(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Literal['1.0']
    provider: Literal['simulator', 'stripe', 'asaas', 'mercadopago']
    provider_event_id: Annotated[
        str,
        Field(
            description='Chave de idempotencia junto com provider. Unique (provider, provider_event_id).',
            max_length=128,
            min_length=1,
            pattern='^[A-Za-z0-9_.:-]+$',
        ),
    ]
    event_type: Literal[
        'subscription.created',
        'subscription.activated',
        'subscription.past_due',
        'subscription.suspended_by_provider',
        'subscription.resumed',
        'subscription.plan_changed',
        'subscription.canceled',
        'payment.succeeded',
        'payment.failed',
        'payment.action_required',
        'payment.refunded',
        'payment.disputed',
    ]
    occurred_at: Annotated[
        AwareDatetime,
        Field(
            description='Informativo. NAO define ordem de aplicacao (ordem de entrega nao e garantida).'
        ),
    ]
    received_at: AwareDatetime
    simulated: bool
    subscription: Subscription
    payment: Payment | None = None
    raw_payload_ref: Annotated[
        str | None,
        Field(
            description='Referencia (chave/URI interna) ao payload bruto guardado fora do evento.',
            max_length=256,
            min_length=1,
        ),
    ] = None
