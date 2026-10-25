# docker

Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`. Dockerfiles de producao: ISO-007/RUN-002.

- `make compose-up [PERFIS="runtime observability"]`, `make compose-smoke`, `make compose-down`, `make compose-reset`.
- `make up` (FND-001) continua rodando os componentes localmente; nao use junto com o perfil `runtime` (portas de app distintas no host: o perfil runtime so publica o proxy).
- Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
- Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
