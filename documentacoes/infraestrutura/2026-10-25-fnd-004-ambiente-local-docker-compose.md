# FND-004 - Ambiente local com Docker Compose (2026-10-25)

## Metadados

- **Dominio:** infraestrutura
- **Tarefa:** ENT-FND-004, lote 2026-10-25-ep00-ep01-fundacao ([ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-004))
- **Branch:** `tarefa/fnd-004`; **base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f` (arvore limpa)
- **Estado:** implementado e validado; aguarda review/QA independentes (nao revisado pelo executor)
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador do lote
- **Diffs completos:** [2026-10-25-fnd-004-ambiente-local-docker-compose-diffs.md](2026-10-25-fnd-004-ambiente-local-docker-compose-diffs.md)

## Objetivo, contexto e escopo

Ambiente de desenvolvimento em Docker Compose: PostgreSQL com pgvector, Redis, S3 local, Mailpit, proxy dev, apps em modo watch e observabilidade minima; healthchecks, redes separadas, portas so em `127.0.0.1`, perfis, segredos descartaveis, seeds ficticios, reset e smoke. Fora do escopo: Dockerfiles de producao, compose de staging/prod (FND-006), pipelines de logs/metricas (FND-009/DEC-010), migracoes (DAT-001).

## Resumo da implementacao

- `infrastructure/docker/compose.dev.yml` (projeto `nucleos-dev`). Perfis: `core` (postgres, redis, minio, minio-init, minio-seed, mailpit, proxy), `runtime` (web, api, tenant-provisioner e 4 servicos Python hello-world em containers com o repo montado), `observability` (otel-collector). O wrapper `scripts/dev.sh` sempre inclui `core`.
- Redes: `interna` (`internal: true`, trafego servico-a-servico) e `publicada` (necessaria para publicar portas no host). Apps ficam so em `interna` e so sao alcancadas pelo proxy; postgres/redis/minio/mailpit/proxy/otel tambem estao em `publicada` apenas para o bind em loopback.
- Todas as portas: `127.0.0.1:<porta>`; padroes fora das portas comuns (host ja usava 5432/6379/8080): PG 15432, Redis 16379, MinIO 19000/19001, Mailpit SMTP 11025/UI 18025, proxy 18080, OTLP 14317/14318, health OTEL 13133. Sobrescrevem-se por variavel (`.env.example`).
- Segredos: `scripts/gerar-segredos.sh` cria `infrastructure/docker/.env.local` (modo 600, ignorado por `.env.*`) com senhas aleatorias de Postgres/Redis/MinIO e UID/GID; o compose usa `${VAR:?}` (falha sem o arquivo). Valores nunca impressos.
- Seeds: `postgres/init/01-seed-ficticio.sql` (extensao `vector`, schema `dev_seed`, 3 organizacoes ficticias com UUIDs e vetores fixos), bucket `nucleos-dev-seed` com `bem-vindo.txt`, chaves `dev:seed:*` no Redis (`seed-redis.sh`, idempotente).
- Scripts: `dev.sh` (up/down/ps/logs/config; espera healthy por polling proprio porque `up --wait` trata containers one-shot como erro), `reset.sh` (destroi containers+volumes e recria; `--destroy-only`), `smoke.sh`, `verificar-lan.sh`, `seed-redis.sh`, `gerar-segredos.sh`.
- Makefile (bloco acrescentado, sem alterar alvos existentes): `compose-up`, `compose-down`, `compose-reset`, `compose-smoke` (`PERFIS="runtime observability"`). `make up/down/health` (FND-001, componentes locais) permanecem como estavam.
- Imagens (tag + digest, verificadas nos registros em 2026-10-25): `pgvector/pgvector:0.8.7-pg18-trixie`, `redis:8.8.3-alpine`, `axllent/mailpit:v1.32.0`, `caddy:2.11.7-alpine`, `cgr.dev/chainguard/minio` (RELEASE.2026-10-23T20-06-51Z) e `cgr.dev/chainguard/minio-client`, `otel/opentelemetry-collector:0.163.2`, `node:24.22.1-bookworm-slim`, `python:3.13.17-slim-bookworm`. Digests no compose.

## Mudancas por arquivo

`infrastructure/docker/{compose.dev.yml,README.md,caddy/Caddyfile.dev,otel/collector.dev.yaml,postgres/init/01-seed-ficticio.sql,seeds/minio/bem-vindo.txt,scripts/*.sh}`, `.env.example` (apenas portas; sem segredos), `Makefile` (bloco final). Testes: `smoke.sh` e `verificar-lan.sh`. Migracoes: nenhuma. Este documento e o de diffs ficam fora do patch.

## Decisoes tecnicas

1. **MinIO sem imagem oficial.** `minio/minio` e `quay.io/minio/minio` nao existem mais nos registros (404 / "no such manifest" em 2026-10-25). Adotada a imagem Chainguard do mesmo software, so por digest fixo (a tag `latest` e a unica gratuita). Consequencia: dependencia de terceiro; a escolha definitiva do storage S3 e DEC-009 (decisao humana pendente).
2. **Rede interna vs. publicada.** Docker nao publica portas de containers presentes apenas em redes `internal: true`; por isso datastores ficam nas duas redes. A protecao contra LAN vem do bind em loopback (provado), nao da rede interna.
3. **Portas nao padrao** para nao colidir com outros servicos do host e permitir Compose ao lado de `make up`.
4. **Runtime sem Dockerfile:** imagens base oficiais + bind mount do repo (requer `make setup` e `make build`). Watch: `node --watch` (api/provisioner, reinicia ao mudar `dist/`), `next dev` (web); Python (stdlib) sem watcher: `docker compose restart`. Apps nao publicam portas; acesso via proxy (`Host: app.localhost`).
5. **OTEL collector** e distroless: sem healthcheck do Compose; o smoke consulta o `health_check` publicado.
6. Redis usa `--requirepass` com o segredo via env (aparece em `ps` dentro do container; aceitavel em dev).

## Validacoes (reais, 2026-10-25, Docker 29.8.1, Node 24.22.1)

| Verificacao | Resultado |
| --- | --- |
| `docker compose config` / `make compose-up` (core) | todos healthy; ~17 s com imagens ja em cache (tempo com download frio nao medido; AC-1 <= 3 min atendido no caso medido) |
| `make compose-up PERFIS="runtime observability"` (apos `make setup && make build`) | 7 apps `healthy`, core healthy, otel up |
| `make compose-smoke` (core) | `SMOKE OK`: pg_isready, seed (3 linhas), consulta pgvector deterministica, redis ping/seed/exige senha, `mc ls` mostra `bem-vindo.txt`, curl minio/console/mailpit/proxy |
| `make compose-smoke PERFIS="runtime observability"` | `SMOKE OK` incluindo proxy->api, proxy->web e health do collector |
| AC-2 `verificar-lan.sh` | `ss -ltn`: as 10 portas escutam somente em `127.0.0.1:<porta>` (nenhuma `0.0.0.0`/`[::]`); `docker ps` mostra publicacao so em `127.0.0.1`; `nc -z` para todos os IPv4 nao loopback da maquina (publico 194.163.191.234 e bridges docker) recusado em todas (140 OK, 0 FALHA). Teste feito na propria maquina; nao houve outra maquina da LAN |
| `reset.sh` | destroi containers/volumes e recria; seeds reaplicados |
| AC-3 `gitleaks dir infrastructure/docker` e `.env.example` (gitleaks 8.30.1) | `no leaks found`; `.env.local` ignorado (`git check-ignore`); `make check-env` OK |
| Limpeza | `reset.sh --destroy-only`: 0 containers, volumes e redes `nucleos-dev`; 0 portas em escuta; `.env.local` removido |

Um primeiro `up` falhou por healthcheck do MinIO (imagem sem `grep`; requisicao sem `Host`) e por `mc` distroless (sem `sh`); ambos corrigidos antes das validacoes acima. Uma primeira execucao do gitleaks via container varreu o filesystem do host por engano (sem efeito no repositorio; resultado descartado e substituido pelo gitleaks local).

Nao executado: `make lint/test` completos (nenhum codigo TS/Python alterado); hadolint/trivy (FND-005); `gitleaks` no historico completo.

## Impactos, riscos, rollback

- `next dev` reescreve `apps/web/next-env.d.ts`; revertido manualmente nesta entrega (risco de ruido em diffs de quem usa o perfil runtime).
- Compose runtime e `make up` nao devem rodar juntos para os mesmos fins, mas nao colidem em portas de host.
- Observabilidade: apenas collector com exporter `debug`. Rollback: reverter o commit unico; `scripts/reset.sh --destroy-only` remove os recursos locais.

## Commits e diffs

Um commit local em `tarefa/fnd-004` (SHA reportado ao coordenador; nao consta no proprio commit). Diff: [diffs](2026-10-25-fnd-004-ambiente-local-docker-compose-diffs.md).

## Correcao rodada 1 (2026-10-26)

Origem: [auditoria](../reviews/2026-10-25-auditoria-fnd-004.md) (veredito CORRECOES_NECESSARIAS). Base: HEAD `023da3dacb13ba8770b768bf6435419659eaf1aa`; um novo commit, sem amend.

| Achado | Decisao | O que foi feito |
| --- | --- | --- |
| REVIEW-001 | APLICAR (documental) | Equivalencia registrada aqui e em `infrastructure/docker/README.md`: **AC-1 := `make compose-up`** (core; `PERFIS=...` para runtime/observability). `make up` da FND-001 nao mudou; `CLAUDE.md` nao tocado. O registro no ticket/QA e do coordenador. |
| REVIEW-002 | APLICAR | `compose.dev.yml`: os tres pontos de app (`x-app-python`, `api`, `tenant-provisioner`) e `web` montam `/dev/null:/workspace/infrastructure/docker/.env.local:ro`; `web` passa a `../../:/workspace:ro` mais `../../apps/web:/workspace/apps/web` (rw). |
| REVIEW-005 (smoke.sh) | APLICAR | `smoke.sh` falha com mensagem clara e rc=2 se `.env.local` estiver ausente. |
| REVIEW-003 | REJEITAR | Sem mudanca; ressalva ao QA (repetir `ss -ltn`; probe externo opcional). |
| REVIEW-004 | ADIAR | Para FND-005 (digests/scan) e DEC-009. |
| REVIEW-005 (restart, senha Redis em ps/inspect, healthcheck do otel) | ADIAR (restart, otel) / REJEITAR (senha) | Sem mudanca; ver auditoria. |

Validacao real (Docker, Node 24.22.1; `make setup && make build` antes; `make compose-up PERFIS=runtime` levou ~22 s com cache, todos healthy):

- `.env.local` visto como 0 bytes em `api`, `tenant-provisioner`, `web` e `tenant-runtime`.
- `web`: `touch /workspace/x` falha (Read-only file system); `touch /workspace/apps/web/.t` funciona (rw); `api` tambem somente leitura.
- `touch /workspace/.git/x` no `web` falhou com "Not a directory", porque na worktree `.git` e um arquivo (ponteiro), nao diretorio: a falha ocorre, mas **nao prova** por si so a protecao por `:ro`; a prova de somente leitura vem do `touch` na raiz. O `.git` real da worktree fica fora do mount.
- `make compose-smoke PERFIS=runtime`: `SMOKE OK` (rc=0), incluindo web/api via proxy e 140 checagens de LAN.
- `make compose-smoke` sem `.env.local`: mensagem `FALHA: .env.local ausente; rode 'make compose-up'`, rc=2.
- `next dev` reescreveu `apps/web/next-env.d.ts` (ja documentado); revertido com `git checkout`.
- Limpeza: `reset.sh --destroy-only`; 0 containers, volumes e redes do projeto `nucleos-dev` (recursos de outros projetos e portas 5432/6379/8080 do host nao tocados).
- Nao executado: perfil observability nesta rodada; lint/test completos; gitleaks nao reexecutado.

Arquivos: `infrastructure/docker/compose.dev.yml`, `infrastructure/docker/scripts/smoke.sh`, `infrastructure/docker/README.md`. Diff desta rodada: secao "Correcao rodada 1" do [arquivo de diffs](2026-10-25-fnd-004-ambiente-local-docker-compose-diffs.md). Lessons: nao aplicavel (infraestrutura).

## Correcao rodada 2 (integracao, 2026-10-26)

Origem: INT-001 e INT-002 de [validacao integrada](../reviews/2026-10-26-validacao-integrada-onda1-onda2.md). Base: HEAD `70b4a25`; merge `4bb1332` de `revisao/2026-10-25-ep00-ep01-fundacao` (`ba1f700`, inclui FND-009) sem conflitos; commit de correcao `6b3251f`. Diff em [diffs](2026-10-25-fnd-004-ambiente-local-docker-compose-diffs.md#correcao-rodada-2-integracao).

- INT-001: o `PYTHONPATH` dos 4 servicos Python agora e `/workspace/services/<svc>/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages` (`infrastructure/docker/compose.dev.yml`). O `.venv` e o do `uv sync --frozen --all-packages` (`make setup`), montado ro em `/workspace`: mesmas versoes travadas no `uv.lock` (structlog, opentelemetry-*), sem rede nem instalacao no container. As dependencias sao Python puro e a imagem e 3.13 como o `.venv`.
- Alternativa descartada: `pip install` ad hoc no entrypoint (ou imagem propria) por exigir rede/rebuild a cada start e divergir do `uv.lock`. Consequencia aceita: `make setup` e pre-requisito do perfil runtime (ja era para o Node); `.venv` com ABI diferente de 3.13 nao serve.
- INT-002: `smoke.sh --runtime` executa `/healthz` dentro de cada um dos 7 servicos (tenant-runtime, ai-gateway, tool-gateway, event-dispatcher, api, web, tenant-provisioner) e marca FALHA se algum nao responder.

Validacoes reais (Docker, Node 24.22.1): `make setup && make build` OK; `make compose-up PERFIS=runtime` com todos healthy; `make compose-smoke PERFIS=runtime` SMOKE OK (rc=0, 7 healthz + proxy->api/web); teste negativo com `docker stop nucleos-dev-ai-gateway-1`: "FALHA ai-gateway /healthz", "SMOKE COM FALHAS", rc!=0; `make compose-up`/`compose-smoke` core SMOKE OK; `PERFIS=observability` sobe e smoke OK (otel-collector health_check). Recursos do compose destruidos ao final (`compose-down`, 0 containers). Servicos do host (5432/6379/8080) nao tocados. Sem pendencias novas; lessons: sem alteracao (nenhum conceito C#/.NET novo).

## Lessons

Nao aplicavel: a trilha `lessons/` e de C#/.NET e esta entrega e infraestrutura (Compose, shell). Nenhum conceito C#/.NET introduzido.

## Pendencias

- Decisao humana sobre o storage S3 local (imagem MinIO oficial descontinuada): DEC-009.
- Medir AC-1 com cache frio de imagens e testar a partir de outra maquina da LAN.
- Registrar comandos `make compose-*` em `CLAUDE.md` (coordenador/LOC-001).

## Atualizacao no fechamento do lote (2026-10-26)

A justificativa de "sem lesson" desta entrega ficou desatualizada: a trilha de `lessons/` agora e de TypeScript, Python, Docker, PostgreSQL e seguranca (LOC-001) e ja tem lessons publicadas. Esta entrega exercita conceitos relevantes (Docker Compose (healthchecks, perfis, redes, bind em 127.0.0.1). Lesson candidata: `Docker Compose para ambiente local` (bloco 4 da trilha).) e, pela regra do `CLAUDE.md`, a lesson **ainda deve ser criada**: pendencia real registrada, nao criada neste fechamento.
