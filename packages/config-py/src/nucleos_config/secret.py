"""Leitura de segredos por arquivo (ADR-020, item 1): nunca por variavel de ambiente."""

from __future__ import annotations

import os
import stat

MAX_SECRET_BYTES = 16 * 1024


class SecretFileError(Exception):
    """Falha ao ler segredo; `reason` e um codigo fixo (o caminho e o conteudo nunca entram)."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"arquivo de segredo invalido: {reason}")
        self.reason = reason


class Secret:
    """Valor sensivel. `repr`/`str` mostram `[REDACTED]`; use `reveal()` no ponto de uso."""

    __slots__ = ("_value",)

    def __init__(self, value: str) -> None:
        self._value = value

    def reveal(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return "Secret([REDACTED])"

    __str__ = __repr__


def read_secret_file(path: str) -> Secret:
    """Le o segredo com as mesmas regras da biblioteca TypeScript.

    Arquivo regular (sem link simbolico), sem permissoes para grupo/outros (0o077), do mesmo dono
    do processo, nao vazio e com tamanho limitado. Remove um unico `\\n` final.
    """
    try:
        st = os.lstat(path)
    except OSError:
        raise SecretFileError("ausente") from None
    if stat.S_ISLNK(st.st_mode):
        raise SecretFileError("link-simbolico")
    if not stat.S_ISREG(st.st_mode):
        raise SecretFileError("nao-e-arquivo-regular")
    if st.st_mode & 0o077:
        raise SecretFileError("permissoes-abertas")
    if st.st_uid != os.getuid():
        raise SecretFileError("dono-diferente")
    if st.st_size == 0:
        raise SecretFileError("vazio")
    if st.st_size > MAX_SECRET_BYTES:
        raise SecretFileError("grande-demais")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except (OSError, UnicodeDecodeError):
        raise SecretFileError("ilegivel") from None
    value = raw.removesuffix("\n")
    if not value:
        raise SecretFileError("vazio")
    return Secret(value)
