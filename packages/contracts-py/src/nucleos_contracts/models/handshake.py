# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel
from typing_extensions import TypeAliasType


class Handshake(RootModel[Any]):
    root: Annotated[
        Any,
        Field(
            description='Mensagens entre runtime, Control Plane (CP) e servicos validadores. Transporte TLS; nenhuma mensagem carrega chave privada. Cada mensagem e validada por referencia a $defs/<nome>.',
            title='Handshake',
        ),
    ]


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class B64url(RootModel[str]):
    root: Annotated[str, Field(pattern='^[A-Za-z0-9_-]+$')]


class JwkPublica(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kty: Literal['OKP']
    crv: Literal['Ed25519']
    x: B64url
    kid: Annotated[str, Field(max_length=64, pattern='^[A-Za-z0-9_-]+$')]
    use: Literal['sig']
    alg: Literal['EdDSA']


class EnrollmentRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    tenant_id: Uuid
    enrollment_secret: Annotated[
        str,
        Field(
            description='Uso unico, expira em minutos, gerado pelo provisioner; nunca logado.',
            min_length=32,
        ),
    ]
    runtime_public_key: JwkPublica


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    tenant_id: Uuid
    ver: Annotated[int, Field(ge=1)]
    runtime_kid: str


class TokenRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    client_assertion: str
    audience: Literal['dispatcher', 'tool-gateway', 'ai-gateway']
    scope: Annotated[list[str], Field(min_length=1)]


class TokenResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    access_token: str
    token_type: Literal['Bearer']
    expires_in: Annotated[int, Field(ge=1, le=600)]


class Jwks(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    keys: Annotated[list[JwkPublica], Field(max_length=3, min_length=1)]


MinVerAdditionalProperty = TypeAliasType(
    "MinVerAdditionalProperty", Annotated[int, Field(ge=1)]
)


class RevocationState(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    generated_at: Annotated[int, Field(ge=0)]
    min_ver: dict[str, MinVerAdditionalProperty]
    revoked_jti: Annotated[
        list[str] | None,
        Field(description='Opcional: revogacao pontual de jti ainda vivo.'),
    ] = None
