# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class Audience(RootModel[Literal['dispatcher', 'tool-gateway', 'ai-gateway']]):
    root: Literal['dispatcher', 'tool-gateway', 'ai-gateway']


class Header(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    alg: Literal['EdDSA']
    typ: Literal['nucleos-runtime+jwt']
    kid: Annotated[str, Field(max_length=64, min_length=1, pattern='^[A-Za-z0-9_-]+$')]


class ScopeItem(RootModel[str]):
    root: Annotated[str, Field(pattern='^[a-z][a-z0-9-]*:[a-z][a-z0-9_.-]*$')]


class Claims(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    iss: Literal['nucleos-control-plane']
    sub: Annotated[
        str,
        Field(
            description='runtime:<tenant_id>; deve ser igual a runtime: + tenant_id (checagem semantica no validador)',
            pattern='^runtime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        ),
    ]
    aud: Annotated[
        Audience, Field(description='Uma unica audiencia por token; sem array.')
    ]
    scope: Annotated[list[ScopeItem], Field(max_length=16, min_length=1)]
    tenant_id: Uuid
    jti: Annotated[str, Field(max_length=64, min_length=16, pattern='^[A-Za-z0-9_-]+$')]
    iat: Annotated[int, Field(ge=0)]
    exp: Annotated[
        int,
        Field(
            description='exp - iat <= 600 (checagem semantica: TTL maximo 10 min; padrao 300 s)',
            ge=0,
        ),
    ]
    ver: Annotated[
        int,
        Field(
            description='Versao da credencial do runtime; rejeitada se < ver_minima do tenant.',
            ge=1,
        ),
    ]


class RuntimeToken(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    header: Header
    claims: Claims
