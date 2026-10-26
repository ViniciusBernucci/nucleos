# GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Images(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    runtime: Annotated[
        str,
        Field(max_length=300, pattern='^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$'),
    ]
    sidecar: Annotated[
        str,
        Field(max_length=300, pattern='^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$'),
    ]


class Resources(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    cpu_millis: Annotated[int, Field(ge=100, le=64000)]
    memory_mib: Annotated[int, Field(ge=64, le=262144)]
    pids: Annotated[int, Field(ge=16, le=65536)]
    tmpfs_mib: Annotated[int, Field(ge=0, le=65536)]


class Network(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(pattern='^[a-z][a-z0-9-]{0,62}$')]
    subnet: Annotated[
        str,
        Field(
            description='CIDR IPv4 privado (RFC 1918).',
            pattern='^(10|172\\.(1[6-9]|2[0-9]|3[01])|192\\.168)\\.[0-9]{1,3}(\\.[0-9]{1,3}){0,2}/([0-9]|[12][0-9]|3[0-2])$',
        ),
    ]


class Volume(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(pattern='^[a-z][a-z0-9-]{0,62}$')]
    mount_path: Annotated[str, Field(pattern='^/[A-Za-z0-9_./-]{1,200}$')]


class Secret(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(pattern='^[a-z][a-z0-9-]{0,62}$')]
    ref: Annotated[
        str,
        Field(
            description='Referencia opaca; o valor nunca trafega no spec.',
            max_length=256,
            min_length=1,
            pattern='^secretref:[A-Za-z0-9_./-]+$',
        ),
    ]


class Module(RootModel[str]):
    root: Annotated[str, Field(pattern='^[a-z][a-z0-9-]{0,62}$')]


class Limits(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    max_concurrency: Annotated[int, Field(ge=1, le=10000)]
    budget_minor: Annotated[int, Field(ge=0)]


class Endpoint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(pattern='^[a-z][a-z0-9-]{0,62}$')]
    url: Annotated[
        str,
        Field(
            max_length=256,
            pattern='^https?://[a-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9_./-]*)?$',
        ),
    ]


class Uuid(RootModel[str]):
    root: Annotated[
        str,
        Field(pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ]


class TenantRuntimeSpec(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        Literal['1.0'],
        Field(
            description='Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.'
        ),
    ]
    tenant_id: Uuid
    images: Images
    resources: Resources
    network: Network
    volumes: Annotated[list[Volume], Field(max_length=16)]
    secrets: Annotated[list[Secret], Field(max_length=32)]
    modules: Annotated[list[Module], Field(max_length=64)]
    limits: Limits
    endpoints: Annotated[list[Endpoint], Field(max_length=16)]
