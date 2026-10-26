import json
import os
import stat
from pathlib import Path

import pytest
from nucleos_config import (
    MAX_SECRET_BYTES,
    ConfigError,
    SecretFileError,
    ServiceSettings,
    forbidden_secret_env,
    is_secret_name,
    load_settings,
    read_secret_file,
)
from pydantic import ValidationError

SENTINEL = "SENTINELA_valor_que_nunca_deve_vazar_9f3a"


def secret_file(
    tmp_path: Path, content: str = SENTINEL, mode: int = 0o400, name: str = "pw"
) -> str:
    p = tmp_path / name
    p.write_text(content + "\n")
    p.chmod(mode)
    return str(p)


def keys(exc: ConfigError) -> list[str]:
    return sorted(i.key for i in exc.issues)


def test_local_defaults() -> None:
    s, secret = load_settings({})
    assert (s.APP_ENV, s.HOST, s.PORT, s.REQUEST_TIMEOUT) == ("local", "127.0.0.1", 8000, 30_000)
    assert secret is None


def test_typed_values_and_secret_from_file(tmp_path: Path) -> None:
    s, secret = load_settings(
        {
            "APP_ENV": "staging",
            "PORT": "8080",
            "REQUEST_TIMEOUT": "5s",
            "DATABASE_URL": "postgres://nucleos@postgres:5432/nucleos",
            "DATABASE_PASSWORD_FILE": secret_file(tmp_path),
        }
    )
    assert s.PORT == 8080
    assert s.REQUEST_TIMEOUT == 5000
    assert secret is not None
    assert secret.reveal() == SENTINEL
    assert SENTINEL not in repr(secret) + str(secret)


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_strict_envs_require_database(app_env: str) -> None:
    with pytest.raises(ConfigError) as ei:
        load_settings({"APP_ENV": app_env})
    assert keys(ei.value) == ["DATABASE_PASSWORD_FILE", "DATABASE_URL"]


def test_invalid_values_never_echo_input() -> None:
    with pytest.raises(ConfigError) as ei:
        load_settings(
            {
                "APP_ENV": f"prod-{SENTINEL}",
                "PORT": f"99999{SENTINEL}",
                "REQUEST_TIMEOUT": f"abc{SENTINEL}",
                "DATABASE_URL": f"postgres://u:{SENTINEL}@h/db",
            }
        )
    assert keys(ei.value) == ["APP_ENV", "DATABASE_URL", "PORT", "REQUEST_TIMEOUT"]
    assert SENTINEL not in str(ei.value)
    assert SENTINEL not in repr(ei.value.issues)


def test_secret_in_environment_is_forbidden() -> None:
    assert forbidden_secret_env({"DATABASE_PASSWORD": "x", "DATABASE_PASSWORD_FILE": "/a"}) == [
        "DATABASE_PASSWORD"
    ]
    with pytest.raises(ConfigError) as ei:
        load_settings({"DATABASE_PASSWORD": SENTINEL})
    assert keys(ei.value) == ["DATABASE_PASSWORD"]
    assert SENTINEL not in str(ei.value)
    assert load_settings({"DATABASE_PASSWORD": "", "PORT": ""})[0].PORT == 8000


def test_does_not_read_process_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PORT", "1234")
    assert load_settings({})[0].PORT == 8000


@pytest.mark.parametrize(
    ("mode", "reason"),
    [(0o644, "permissoes-abertas"), (0o640, "permissoes-abertas"), (0o470, "permissoes-abertas")],
)
def test_open_permissions_rejected(tmp_path: Path, mode: int, reason: str) -> None:
    with pytest.raises(SecretFileError) as ei:
        read_secret_file(secret_file(tmp_path, mode=mode))
    assert ei.value.reason == reason
    assert SENTINEL not in str(ei.value)


def test_missing_symlink_empty_big_and_dir(tmp_path: Path) -> None:
    def reason(path: str) -> str:
        with pytest.raises(SecretFileError) as ei:
            read_secret_file(path)
        return ei.value.reason

    real = secret_file(tmp_path)
    link = tmp_path / "ln"
    link.symlink_to(real)
    empty = tmp_path / "e"
    empty.write_text("\n")
    empty.chmod(0o400)
    big = tmp_path / "b"
    big.write_text("a" * 20_000)
    big.chmod(0o400)
    assert reason(str(tmp_path / "nao-existe")) == "ausente"
    assert reason(str(link)) == "link-simbolico"
    assert reason(str(tmp_path)) == "nao-e-arquivo-regular"
    assert reason(str(empty)) == "vazio"
    assert reason(str(big)) == "grande-demais"
    assert stat.S_IMODE(os.lstat(real).st_mode) == 0o400


def test_unreadable_secret_file_reports_without_path(tmp_path: Path) -> None:
    with pytest.raises(ConfigError) as ei:
        load_settings({"DATABASE_PASSWORD_FILE": secret_file(tmp_path, mode=0o666)})
    assert keys(ei.value) == ["DATABASE_PASSWORD_FILE"]
    assert str(tmp_path) not in str(ei.value)


# ------------------------------------------------ REVIEW-003/004/006/007/009
def test_other_owner_is_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = secret_file(tmp_path)
    real = os.getuid()
    monkeypatch.setattr(os, "getuid", lambda: real + 1)
    with pytest.raises(SecretFileError) as ei:
        read_secret_file(path)
    assert ei.value.reason == "dono-diferente"


def test_size_boundary(tmp_path: Path) -> None:
    at = tmp_path / "no-limite"
    at.write_text("a" * MAX_SECRET_BYTES)
    at.chmod(0o400)
    assert len(read_secret_file(str(at)).reveal()) == MAX_SECRET_BYTES
    over = tmp_path / "acima"
    over.write_text("a" * (MAX_SECRET_BYTES + 1))
    over.chmod(0o400)
    with pytest.raises(SecretFileError) as ei:
        read_secret_file(str(over))
    assert ei.value.reason == "grande-demais"


def test_invalid_utf8_is_unreadable(tmp_path: Path) -> None:
    p = tmp_path / "bin"
    p.write_bytes(bytes([0x61, 0xFF, 0xFE, 0x62]))
    p.chmod(0o400)
    with pytest.raises(SecretFileError) as ei:
        read_secret_file(str(p))
    assert ei.value.reason == "ilegivel"


@pytest.mark.parametrize(
    "name",
    [
        "API_TOKEN",
        "X_SECRET",
        "DB_PASS",
        "SECRET_KEY",
        "AWS_SECRET_ACCESS_KEY",
        "DBPASSWORD",
        "A_DSN",
    ],
)
def test_secret_names(name: str) -> None:
    assert is_secret_name(name)


@pytest.mark.parametrize(
    "name",
    [
        "DATABASE_PASSWORD_FILE",
        "SSH_KEY_PATH",
        "OTEL_SERVICE_NAME",
        "KEYBOARD",
        "PORT",
        "PASSTHROUGH",
    ],
)
def test_non_secret_names(name: str) -> None:
    assert not is_secret_name(name)


def test_pydantic_errors_hide_input() -> None:
    # Mutante: hide_input_in_errors removido. O erro cru do pydantic nao pode ecoar o valor.
    with pytest.raises(ValidationError) as ei:
        ServiceSettings.model_validate({"APP_ENV": f"x{SENTINEL}", "PORT": f"1{SENTINEL}"})
    assert SENTINEL not in str(ei.value)
    assert SENTINEL not in repr(ei.value)


def test_shared_parity_table() -> None:
    table = json.loads((Path(__file__).parents[2] / "config" / "paridade-casos.json").read_text())
    assert len(table["casos"]) > 40
    for case in table["casos"]:
        message = ""
        try:
            load_settings(case["env"])
        except ConfigError as exc:
            message = str(exc)
            accepted = False
        else:
            accepted = True
        assert "SENT" not in message, case["caso"]
        assert accepted == case["aceita"], case["caso"]


def test_shell_pwd_is_not_a_secret() -> None:
    assert not is_secret_name("PWD")
    assert not is_secret_name("OLDPWD")
    assert is_secret_name("X_PWD")
