"""DEVE FALHAR no import-linter: tenant-runtime nao importa o SDK do provisioner."""

import tenant_provisioner  # type: ignore[import-not-found]  # noqa: F401
