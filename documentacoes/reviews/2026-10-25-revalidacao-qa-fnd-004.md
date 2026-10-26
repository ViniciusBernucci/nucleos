# Revalidacao focal + QA FND-004 (rodada 1) - 2026-10-26

- **Papel:** revisor+QA independente (nao implementou). Sem commit, sem edicao de codigo.
- **Tarefa:** ENT-FND-004 (padrao). **Branch:** `tarefa/fnd-004`. **Worktree:** /home/vinicius/nucleos-worktrees/tarefa/fnd-004
- **Correcao testada:** `70b4a25ef7f4d4febb017aa56641c4622a475dfc` (pai `023da3dacb13ba8770b768bf6435419659eaf1aa`). Arvore limpa antes e depois (a unica sujeira, `apps/web/next-env.d.ts` gerado pelo `next dev`, desapareceu apos `make up`/reset; `git status` final vazio).
- **Ambiente:** Linux, Docker Compose, Node 24.22.1, gitleaks 8.30.1. Projeto compose `nucleos-dev`; portas host 15432/16379/19000/19001/11025/18025/18080/14317/14318/13133. Nao toquei recursos de outros projetos; ao final todos os containers/volumes/redes `nucleos-dev` foram destruidos (`reset.sh --destroy-only`).
- **Limites:** imagens ja em cache (cache frio nao medido); probe "externo" feito do proprio host contra seu IP publico, nao de segunda maquina LAN.

## Parte 1 - Revalidacao dos itens APLICAR

| ID | Verificacao (executada) | Resultado |
| --- | --- | --- |
| REVIEW-002 (.env.local) | `compose up` com `PERFIS="runtime observability"`; em cada um dos 7 apps (api, web, tenant-provisioner, event-dispatcher, tenant-runtime, tool-gateway, ai-gateway): `wc -c < /workspace/infrastructure/docker/.env.local` = 0; `ls -la` mostra `crw-rw-rw- 1 root root 1, 3` (e /dev/null). Host `.env.local` intacto (251 bytes, modo 600). | PASS |
| REVIEW-002 (repo :ro) | Prova independente do `:ro` (sem usar `.git`, que e arquivo na worktree): (a) `docker inspect` mostra `/workspace rw=false` em api/web/event-dispatcher e `/workspace/apps/web rw=true` so no web; (b) `mount` no web: `/workspace ... ro`, `/workspace/apps/web ... rw`, `.env.local` tipo devtmpfs `ro`; (c) `touch` falha com "Read-only file system" em `/workspace/README.md`, `/Makefile`, `/infrastructure/x`, `/apps/api/x` (web) e `/Makefile` (api); (d) `touch /workspace/apps/web/.probe` funciona (rw so onde `next dev` precisa); (e) `touch` em `.env.local` falha (ro). Observacao: `echo >> .env.local` retorna rc=0 porque o alvo e `/dev/null` (descarta); sem impacto, host continua 251 bytes. | PASS |
| REVIEW-005 (smoke sem .env.local) | Copia isolada de `smoke.sh` sem `.env.local` ao lado: `FALHA: .env.local ausente; rode 'make compose-up'`, rc=2. Com `.env.local`: `make compose-smoke` -> `SMOKE OK`, rc=0. | PASS |
| REVIEW-001 (doc) | README do compose e secao REVIEW-001 do documento de entrega registram `AC-1 := make compose-up`; `make up` da FND-001 intacto (ver regressao). **O ticket `tickets.md#ent-fnd-004` ainda diz `make up` e nao foi atualizado**; o proprio README marca como "decisao a registrar pelo coordenador". | PASS com pendencia do coordenador (registrar no ticket/manifesto) |

Veredito Parte 1: REVIEW-002 PASS, REVIEW-005 PASS, REVIEW-001 PASS (condicionado ao registro formal no ticket pelo coordenador).

## Parte 2 - Matriz QA

| AC | Cenario / comando | Resultado observado | Status |
| --- | --- | --- | --- |
| AC-1 (equivalencia `make compose-up`) | `make compose-up PERFIS="runtime observability"` (14 containers): `real 0m28.97s`, todos `healthy` (minio-init/seed `Exited (0)`; otel-collector sem healthcheck, ja ADIAR no REVIEW; coberto por `smoke --observability`: `otel-collector health_check` OK). `make compose-reset` (core, volumes recriados): 31,2 s, todos healthy. | <= 3 min com cache de imagens; frio nao medido | PASS (com ressalva: cache frio nao medido; literal `make up` nao e o alvo, ver equivalencia) |
| AC-2 (LAN) | `ss -ltn`: as 10 portas publicadas em `127.0.0.1:` apenas (nenhuma `0.0.0.0`/`*`); `docker ps` mostra apenas `127.0.0.1:` em todos os mapeamentos; `nc -z`: 127.0.0.1 open e 194.163.191.234 (IP publico do host) closed nas 10 portas; smoke tambem recusa IPs das bridges docker. | Inacessiveis fora do loopback | PASS (sem segunda maquina LAN; aceito por evidencia de bind, REVIEW-003) |
| AC-3 (sem segredo literal) | `gitleaks detect` historico completo (40 commits): no leaks; faixa `4be3ce3..HEAD`: no leaks; `gitleaks detect --no-git` sobre `git archive HEAD`: no leaks; `.env.local` ignorado (`.gitignore:20`) e nao rastreado. | gitleaks verde | PASS |
| Perfil core | `compose-up`/`reset` + `compose-smoke`: pg_isready, seed 3 organizacoes, pgvector, redis ping/seed/senha obrigatoria, minio mc ls + health + console, mailpit, proxy healthz e rotas por Host. | SMOKE OK rc=0 | PASS |
| Perfil runtime | 7 apps healthy; `proxy -> api /healthz`, `proxy -> web /healthz` OK; isolamento da Parte 1. | SMOKE OK | PASS |
| Perfil observability | otel-collector Up; `otel-collector health_check` OK; portas 13133/14317/14318 so em 127.0.0.1. (Ninguem havia rodado antes.) | SMOKE OK | PASS |
| Seeds | smoke apos reset: Postgres 3 organizacoes + pgvector deterministico, Redis seed, MinIO `bem-vindo.txt`. | OK | PASS |
| reset.sh | Criada tabela `qa_marker` no Postgres, `make compose-reset`: `to_regclass('qa_marker')` vazio (volume destruido), seeds reaplicados, smoke OK; `reset.sh --destroy-only` ao final: sem containers/volumes/redes `nucleos-dev` restantes. | Destroi e recria | PASS |
| Regressao FND-001 | `make up` (build + 7 componentes locais, 53,3 s, todos `OK` em :3000/3001/3002/8001-8004), `make health` OK, `make down` rc=0 e portas liberadas. | Intacto | PASS |
| Testes negativos | smoke sem `.env.local` rc=2 (acima); perfil desconhecido nao exercitado (fora do raio). | - | PASS (escopo) |

## Achados / bugs
Nenhum BUG novo. Observacoes nao bloqueantes:
1. Pendencia do coordenador: registrar a equivalencia AC-1 no ticket `tickets.md#ent-fnd-004` (hoje ainda `make up`).
2. AC-1 com cache frio de imagens e AC-2 a partir de segunda maquina continuam nao medidos (lacunas declaradas desde a revisao).
3. `echo >> .env.local` nos apps "funciona" (alvo /dev/null); inofensivo.
4. `next dev` altera `apps/web/next-env.d.ts` na worktree ao rodar o perfil runtime (efeito conhecido do Next; arquivo rastreado). Reverteu-se sozinho apos `make up`; vale gitignore/nota futura, nao e defeito da correcao.

## Veredito por ID
- REVIEW-001: APROVADO (pendencia de registro no ticket pelo coordenador)
- REVIEW-002: APROVADO
- REVIEW-005 (smoke.sh): APROVADO
- AC-1: PASS (ressalva cache frio) - AC-2: PASS - AC-3: PASS
- Regressoes FND-001 / perfis / seeds / reset: PASS

**QA APPROVED** para `70b4a25` (aprovacao condicionada apenas ao registro documental do coordenador).
