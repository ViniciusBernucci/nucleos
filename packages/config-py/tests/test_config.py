import os
import stat
from pathlib import Path

import pytest
from nucleos_config import (
    ConfigError,
    SecretFileError,
    forbidden_secret_env,
    load_settings,
    read_secret_file,
)

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
