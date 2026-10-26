"""DEVE FALHAR no ruff: S307 (uso de eval)."""


def executar(codigo: str) -> object:
    return eval(codigo)
