# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Error(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    code: Annotated[str, Field(pattern='^[a-z][a-z0-9_]{0,63}$')]
    message: Annotated[str, Field(max_length=1024, min_length=1)]


class ToolCallResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    status: Literal['ok', 'error', 'denied']
    result: Annotated[
        Any | None,
        Field(description='Qualquer JSON; presente somente quando status=ok.'),
    ] = None
    error: Error | None = None
