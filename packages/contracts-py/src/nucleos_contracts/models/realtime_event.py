# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, RootModel


class Subject(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Literal['agent', 'run', 'approval', 'tenant', 'budget']
    id: Annotated[str, Field(max_length=64, min_length=1, pattern='^[A-Za-z0-9_.:-]+$')]


class Data(RootModel[str]):
    root: Annotated[str, Field(max_length=128)]


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class RealtimeEvent(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    event_id: Uuid
    type: Literal[
        'agent.status_changed',
        'run.started',
        'run.progress',
        'run.waiting_approval',
        'run.completed',
        'run.failed',
        'approval.requested',
        'approval.decided',
        'tenant.state_changed',
        'budget.threshold_reached',
    ]
    occurred_at: AwareDatetime
    tenant_id: Uuid
    subject: Subject
    state: Annotated[
        str | None, Field(max_length=64, min_length=1, pattern='^[a-z][a-z0-9_.-]*$')
    ] = None
    data: Annotated[
        dict[str, Data | int | bool] | None,
        Field(
            description='Apenas escalares curtos; nada de texto livre longo nem conteudo de usuario.',
            max_length=16,
        ),
    ] = None
