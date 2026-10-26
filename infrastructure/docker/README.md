# docker

Compose de desenvolvimento (FND-004): `compose.dev.yml`, scripts em `scripts/`. Dockerfiles de producao: ISO-007/RUN-002.

- `make compose-up [PERFIS="runtime observability"]`, `make compose-smoke`, `make compose-down`, `make compose-reset`.
- Equivalencia do AC-1 do ticket (decisao a registrar pelo coordenador): **AC-1 := `make compose-up`** (perfil core; `PERFIS=...` para runtime/observability). `make up` permanece o da FND-001.
- `make up` (FND-001) continua rodando os componentes localmente; nao use junto com o perfil `runtime` (portas de app distintas no host: o perfil runtime so publica o proxy).
- Segredos descartaveis: `scripts/gerar-segredos.sh` (gera `.env.local`, ignorado pelo git).
- Detalhes e validacoes: `documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md`.
- Apps do perfil `runtime`: repo montado somente leitura (web tem escrita so em `apps/web`) e `.env.local` mascarado por `/dev/null` (apps nao recebem segredos do Compose).

## Staging e producao (FND-006)

- `compose.deploy.yml` (base) + `compose.staging.yml` / `compose.prod.yml` (overlays): imagens por digest, segredos so por arquivo (`*_FILE`), hardening e limites. `scripts/deploy.sh` faz deploy/rollback por digest; `scripts/verificar-deploy.mjs` (`make lint`) valida a politica; `make test-ambientes` ensaia em containers efemeros.
- Runbook: `documentacoes/runbooks/deploy-staging-producao.md`. Documento da entrega: `documentacoes/infraestrutura/2026-10-26-fnd-006-configuracao-tipada-e-ambientes.md`.
