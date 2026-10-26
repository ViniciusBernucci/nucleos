# docker

Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`. Dockerfiles de producao: ISO-007/RUN-002.

- `make compose-up [PERFIS="runtime observability"]`, `make compose-smoke`, `make compose-down`, `make compose-reset`.
- Equivalencia do AC-1 do ticket (decisao a registrar pelo coordenador): **AC-1 := `make compose-up`** (perfil core; `PERFIS=...` para runtime/observability). `make up` permanece o da FND-001.
- `make up` (FND-001) continua rodando os componentes localmente; nao use junto com o perfil `runtime` (portas de app distintas no host: o perfil runtime so publica o proxy).
- Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
- Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
- Apps do perfil `runtime`: repo montado somente leitura (web tem escrita so em `apps/web`) e `.env.local` mascarado por `/dev/null` (apps nao recebem segredos do Compose).
