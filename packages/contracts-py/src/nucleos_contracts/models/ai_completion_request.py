# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class Message(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    role: Literal['system', 'user', 'assistant', 'tool']
    content: Annotated[str, Field(max_length=200000)]


class AiCompletionRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    run_id: Uuid
    agent_id: Uuid
    step_seq: Annotated[int, Field(ge=0)]
    idempotency_key: Annotated[
        str, Field(max_length=128, min_length=1, pattern='^[A-Za-z0-9_.:-]+$')
    ]
    model_alias: Annotated[str, Field(pattern='^[a-z][a-z0-9_.-]{0,63}$')]
    messages: Annotated[list[Message], Field(max_length=512, min_length=1)]
    max_output_tokens: Annotated[int | None, Field(ge=1, le=200000)] = None
    temperature: Annotated[float | None, Field(ge=0.0, le=2.0)] = None
