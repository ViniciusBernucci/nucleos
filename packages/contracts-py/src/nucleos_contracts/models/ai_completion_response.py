# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Error(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    code: Annotated[str, Field(pattern='^[a-z][a-z0-9_]{0,63}$')]
    message: Annotated[str, Field(max_length=1024, min_length=1)]


class Usage(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    input_tokens: Annotated[int, Field(ge=0)]
    output_tokens: Annotated[int, Field(ge=0)]
    cost_micros: Annotated[
        int,
        Field(
            description='Custo em micro-unidades da moeda de faturamento (inteiro: sem ponto flutuante).',
            ge=0,
        ),
    ]


class AiCompletionResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    status: Literal['ok', 'error']
    model_alias: Annotated[str | None, Field(pattern='^[a-z][a-z0-9_.-]{0,63}$')] = None
    content: Annotated[str | None, Field(max_length=200000)] = None
    finish_reason: Literal['stop', 'length', 'tool_calls', 'content_filter'] | None = (
        None
    )
    usage: Usage | None = None
    error: Error | None = None
