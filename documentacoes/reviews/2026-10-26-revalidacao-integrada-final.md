# Revalidacao integrada final (revisor + QA independente) - INT-001..INT-007

- Data: 2026-10-26 | Papel: revisor+QA independente (nao implementou nem integrou)
- Worktree (somente leitura): `/home/vinicius/nucleos-worktrees/revisao-ep00-ep01`, branch `revisao/2026-10-25-ep00-ep01-fundacao`, HEAD `c6679d92ae52feb52deac963243b5ae3fe653309` (worktree limpa).
- Execucao: copia exportada por `git archive HEAD` no scratchpad (`.../scratchpad/fin`), Node 24.22.1, uv em `~/.local/bin`. `make lint` exigiu repositorio git (`check-env`), entao a copia recebeu `git init` + commit local (so na copia).
- Relatorio de referencia: `2026-10-26-validacao-integrada-onda1-onda2.md` (HEAD `ba1f700`).

## Veredito final: APROVADO (INT-001..INT-007 todos RESOLVIDOS; nenhuma regressao)

## Status por achado
| ID | Status | Evidencia |
| --- | --- | --- |
| INT-001 compose runtime | RESOLVIDO | `make setup && make build` ok; `make compose-up PERFIS=runtime` rc=0 em 22 s; tenant-runtime, ai-gateway, tool-gateway, event-dispatcher, tenant-provisioner, api, web, proxy, postgres, redis, minio, mailpit todos `healthy`; minio-init/seed `Exited (0)`. Log do ai-gateway sem `ModuleNotFoundError`. (antes: crash loop e timeout de 4 min) |
| INT-002 smoke runtime | RESOLVIDO | `smoke.sh --runtime` agora faz `/healthz` por servico dentro do container (4 Python + api/web/provisioner) alem do proxy. `make compose-smoke PERFIS=runtime` = "SMOKE OK" rc=0. Teste negativo: `docker stop nucleos-dev-ai-gateway-1` => "SMOKE COM FALHAS", make rc=2; apos `docker start` e 15 s => "SMOKE OK" rc=0. |
| INT-003 links | RESOLVIDO | `documentacoes/reviews/` agora versionado (commit `f9db0ad`, 35 relatorios). Script de links (markdown `[..](..)` fora de blocos de codigo): `documentacoes/` 570 links, 0 quebrados; `lessons/` 11 links, 0 quebrados. Observacao fora de escopo: 8 links quebrados em copias de skills (`../CLAUDE.md` em `*/skills/README.md`, placeholder `/abs/path/...` em `archify/SKILL.md`), todos preexistentes na base `2cb39dc`, nao em `documentacoes/` nem `lessons/`. |
| INT-004 CLAUDE/AGENTS/.agents | RESOLVIDO | Bloco "Validacao" identico (texto) nos 3 arquivos: `make setup/lint/test/build`, `up/health/down`, `lint` com ESLint/ruff/mypy/arquitetura/gitleaks, `make hooks`, `compose-up/smoke/down`, `PERFIS=runtime` exige `setup && build`, CI (FND-005) ainda inexistente. Correto frente aos alvos reais do Makefile. `node scripts/instalar-skills.mjs --check`: 15 skills, 0 divergencias (1 extra preservado: `.agents/skills/archify`). |
| INT-005 nota FND-004 | RESOLVIDO | `documentacoes/backlog/EP-01-*/tickets.md:117`: "AC-1 := `make compose-up` (perfis core, runtime, observability)", com link ao planejamento. O AC agora e valido tambem para runtime (ver INT-001). |
| INT-006 lessons | RESOLVIDO (com ressalva) | Secao "Atualizacao no fechamento do lote (2026-10-26)" anexada em fnd-002, fnd-004 e fnd-009 corrigindo a justificativa (trilha e TS/Python/Docker/PG, ja tem lessons). `lessons/README.md` sem a secao "ainda sem lessons publicadas" (agora "Blocos planejados (as lessons ja publicadas estao no indice abaixo...)"). Ressalva (nao bloqueante): as notas declaram honestamente que as lessons candidatas (qualidade estatica, Docker Compose, observabilidade) ainda devem ser criadas pela regra do CLAUDE.md; ficam como pendencia real registrada. O texto antigo permanece acima da nota (historico). |
| INT-007 indice ADR | RESOLVIDO | `adr/README.md`: ADR-016/017/018/020/026 todos no formato `(**Proposto**)`. |

## Fluxos executados na copia limpa
| Fluxo | Resultado |
| --- | --- |
| `make setup` | rc=0 |
| `make lint` | rc=0 (inclui gitleaks e lint-regressao: controles falham como esperado) |
| `make test` | rc=0 (pytest 18 passed em 9,9 s; turbo) |
| `make build` | rc=0 |
| `make up` / `make health` / `make down` | rc=0/0/0; 7/7 OK (3000-3002, 8001-8004); sem portas em escuta apos `down` |
| `make compose-up PERFIS=runtime` | rc=0, tudo healthy |
| `make compose-smoke PERFIS=runtime` | SMOKE OK; negativo (servico parado) falha com rc!=0; recuperacao OK |
| `make compose-up/smoke PERFIS="runtime observability"` | rc=0; `otel-collector health_check` OK; SMOKE OK |
| Core | coberto dentro dos perfis acima (postgres, redis, minio, mailpit, proxy healthy; seed Redis aplicado) |

## Isolamento e limpeza
- Portas do compose: 15432, 16379, 18080, 19000/19001, 18025 e afins; projeto `nucleos-dev`. Nao tocou 5432/6379/8080 nem containers de outros projetos (nenhum container alheio estava em execucao no momento de `docker ps`).
- Ao final: `compose-down`, volumes `nucleos-dev_{minio,postgres,redis}-data` removidos, 0 containers e 0 redes `nucleos-dev*`; nenhuma porta de app em escuta; nenhum processo remanescente da copia.
- Nenhum arquivo do repositorio foi editado; este relatorio e o unico artefato (sem commit). Checkout principal em `developer` intacto (untracked `.turbo/` e `documentacoes/reviews/`).

## Lacunas
- CI (FND-005) nao existe; acesso a partir de outra maquina da LAN nao testado; `verificar-lan.sh` passou dentro do smoke (portas em interfaces de bridge recusadas).
- Pendencia nao bloqueante: criar as 3 lessons candidatas citadas em INT-006.
