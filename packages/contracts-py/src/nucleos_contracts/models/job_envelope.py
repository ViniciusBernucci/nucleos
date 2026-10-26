# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, RootModel


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class AssignmentSignature(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kid: Annotated[str, Field(max_length=64, min_length=1, pattern='^[A-Za-z0-9_-]+$')]
    alg: Literal['EdDSA']
    value: Annotated[str, Field(min_length=1, pattern='^[A-Za-z0-9_-]+$')]


class JobEnvelope(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    job_id: Uuid
    tenant_id: Uuid
    type: Annotated[str, Field(pattern='^[a-z][a-z0-9_.-]{0,63}$')]
    idempotency_key: Annotated[
        str, Field(max_length=128, min_length=1, pattern='^[A-Za-z0-9_.:-]+$')
    ]
    attempt: Annotated[int, Field(ge=1, le=100)]
    issued_at: AwareDatetime
    expires_at: AwareDatetime
    correlation_id: Annotated[
        str, Field(max_length=64, min_length=8, pattern='^[A-Za-z0-9_-]+$')
    ]
    assignment_signature: AssignmentSignature
    payload: Annotated[
        dict[str, Any] | None,
        Field(
            description='Corpo especifico do tipo de job; validado pelo contrato do tipo (fora deste envelope).'
        ),
    ] = None
