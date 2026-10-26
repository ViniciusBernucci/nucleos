# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class Error(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    pointer: Annotated[str, Field(max_length=512)]
    detail: Annotated[str, Field(max_length=1024, min_length=1)]


class ProblemDetails(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Annotated[
        str,
        Field(
            max_length=2048,
            pattern='^(about:blank|[A-Za-z][A-Za-z0-9+.-]*:[^\\s]*|/[^\\s]*)$',
        ),
    ]
    title: Annotated[str, Field(max_length=256, min_length=1)]
    status: Annotated[int, Field(ge=400, le=599)]
    detail: Annotated[str | None, Field(max_length=2048)] = None
    instance: Annotated[str | None, Field(max_length=2048, pattern='^[^\\s]+$')] = None
    code: Annotated[str | None, Field(pattern='^[a-z][a-z0-9_]{0,63}$')] = None
    correlation_id: Annotated[
        str | None, Field(max_length=64, min_length=8, pattern='^[A-Za-z0-9_-]+$')
    ] = None
    errors: Annotated[list[Error] | None, Field(max_length=64)] = None
