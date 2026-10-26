"""Esquema de configuracao dos servicos Python (Pydantic Settings), com falha rapida."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Annotated, Literal

from pydantic import AfterValidator, AnyUrl, BaseModel, Field, ValidationError, field_validator
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

from .secret import Secret, SecretFileError, read_secret_file

_SECRET_NAME = re.compile(
    r"(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)S?$", re.I
)
_UNITS_MS = {"ms": 1, "s": 1000, "m": 60_000, "h": 3_600_000}
_STRICT = ("staging", "production")


class ConfigIssue(BaseModel):
    key: str
    message: str


class ConfigError(Exception):
    """Configuracao invalida: lista nomes e motivos fixos, nunca o valor recebido."""

    def __init__(self, issues: list[ConfigIssue]) -> None:
        self.issues = issues
        detail = "; ".join(f"{i.key}: {i.message}" for i in issues)
        super().__init__(f"configuracao invalida ({len(issues)}): {detail}")


def forbidden_secret_env(env: Mapping[str, str]) -> list[str]:
    """Nomes de variaveis que parecem carregar segredo literal (so `*_FILE` e permitido)."""
    return sorted(k for k, v in env.items() if v != "" and _SECRET_NAME.search(k))


def _no_password(url: AnyUrl) -> AnyUrl:
    if url.password:
        raise ValueError("senha embutida na url e proibida (use *_FILE)")
    return url


def _absolute(path: str) -> str:
    if not path.startswith("/") or "\0" in path or ".." in path.split("/"):
        raise ValueError("caminho deve ser absoluto e sem '..'")
    return path


ServiceUrl = Annotated[AnyUrl, AfterValidator(_no_password)]
AbsolutePath = Annotated[str, Field(max_length=4096), AfterValidator(_absolute)]


class ServiceSettings(BaseSettings):
    """Configuracao comum dos servicos Python. Campos mapeiam 1:1 as variaveis em MAIUSCULAS."""

    model_config = SettingsConfigDict(
        extra="ignore", case_sensitive=True, frozen=True, hide_input_in_errors=True
    )

    APP_ENV: Literal["local", "ci", "staging", "production"] = "local"
    APP_VERSION: str = Field("0.0.0", pattern=r"^[0-9A-Za-z.+_-]{1,64}$")
    HOST: str = Field("127.0.0.1", min_length=1, max_length=255)
    PORT: int = Field(8000, ge=1, le=65535)
    REQUEST_TIMEOUT: int = 30_000  # ms; do ambiente: "500ms", "30s", "5m", "1h"
    DATABASE_URL: ServiceUrl | None = None
    DATABASE_PASSWORD_FILE: AbsolutePath | None = None

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Somente o mapa explicito: nao le os.environ, .env nem /run/secrets por acidente.
        return (init_settings,)

    @field_validator("REQUEST_TIMEOUT", mode="before")
    @classmethod
    def _duration(cls, v: object) -> int:
        if isinstance(v, int):  # padrao do codigo (ja em ms); o ambiente sempre chega como texto
            return v
        m = re.fullmatch(r"(\d{1,9})(ms|s|m|h)", str(v))
        if not m:
            raise ValueError("duracao invalida (use 500ms, 30s, 5m, 1h)")
        ms = int(m.group(1)) * _UNITS_MS[m.group(2)]
        if not 100 <= ms <= 300_000:
            raise ValueError("duracao fora da faixa permitida")
        return ms


def load_settings(
    env: Mapping[str, str], *, model: type[ServiceSettings] = ServiceSettings
) -> tuple[ServiceSettings, Secret | None]:
    """Valida `env` e le o segredo do banco. Levanta `ConfigError` (sem valores) se invalido."""
    clean = {k: v for k, v in env.items() if v != ""}
    issues = [
        ConfigIssue(
            key=k,
            message="segredo por variavel de ambiente e proibido (use <NOME>_FILE)",
        )
        for k in forbidden_secret_env(clean)
    ]
    settings: ServiceSettings | None = None
    try:
        settings = model.model_validate(clean)
    except ValidationError as exc:
        for err in exc.errors(include_input=False, include_url=False, include_context=False):
            issues.append(
                ConfigIssue(
                    key=".".join(str(p) for p in err["loc"]) or "(raiz)", message=err["msg"]
                )
            )
    if settings is not None and settings.APP_ENV in _STRICT:
        issues.extend(
            ConfigIssue(key=k, message=f"obrigatoria em {settings.APP_ENV}")
            for k in ("DATABASE_URL", "DATABASE_PASSWORD_FILE")
            if getattr(settings, k) is None
        )
    secret: Secret | None = None
    if settings is not None and settings.DATABASE_PASSWORD_FILE is not None and not issues:
        try:
            secret = read_secret_file(settings.DATABASE_PASSWORD_FILE)
        except SecretFileError as exc:
            issues.append(ConfigIssue(key="DATABASE_PASSWORD_FILE", message=exc.reason))
    if issues or settings is None:
        raise ConfigError(issues)
    return settings, secret
