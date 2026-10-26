# Validacao integrada (revisor + QA independente) - onda 1 e onda 2

- Data: 2026-10-26 | Perfil: critico | Papeis: revisor-de-codigo (completo) + revisor-de-qa
- Worktree: `/home/vinicius/nucleos-worktrees/revisao-ep00-ep01`, branch `revisao/2026-10-25-ep00-ep01-fundacao`
- Base `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594`, HEAD `ba1f700d19fb611598f5eca47c64172d5a377d04` (264 arquivos, +29083/-48; 14 merges)
- Estado local: worktree limpa (apenas ignorados). Checkout principal `/home/vinicius/nucleos`: branch `developer`, intacto (untracked `.turbo/` e `documentacoes/reviews/`).
- Execucao: copia exportada (`git archive HEAD`) no scratchpad (`.../scratchpad/int`); a worktree nao foi mutada. Node 24.22.1, uv em `~/.local/bin`.
- Independencia: o revisor nao implementou nem integrou nenhuma tarefa.

## Veredito: CHANGES REQUESTED (1 ALTO, 2 MEDIO, 4 BAIXO)

Fluxo local (`make setup/lint/test/build/up/health/down`) e compose core estao verdes. O compose com perfil `runtime` esta quebrado por interacao FND-004 x FND-009 e o smoke nao detecta. Nao ha segredos nem ADR aceito indevido.

## Achados

### INT-001 - ALTO - Compose `runtime`: 4 servicos Python em crash loop (interacao FND-004 x FND-009)
- Evidencia: `make compose-up PERFIS=runtime` terminou rc=2 apos 4m03s com "FALHA: timeout aguardando healthy". `tenant-runtime`, `ai-gateway`, `tool-gateway` e `event-dispatcher` em `Restarting (1)`. Log: `ModuleNotFoundError: No module named 'nucleos_observability'` (`services/<svc>/src/<pkg>/app.py:7`).
- Causa: FND-009 fez os servicos importarem `nucleos_observability` (`packages/observability-py/src`). Em `infrastructure/docker/compose.dev.yml:197,207,217,227` o `PYTHONPATH` contem so `/workspace/services/<svc>/src`. A imagem `python:3.13-slim` nao instala o pacote. Cada tarefa estava correta isolada; a falha so existe na combinacao. Os apps Node (api/web/provisioner) sobem porque o pnpm resolve o workspace.
- Impacto: AC de FND-004 para o perfil `runtime` nao vale mais apos a integracao. `make up` (processo local, uv workspace) nao e afetado.
- Correcao: adicionar `/workspace/packages/observability-py/src` ao `PYTHONPATH` dos 4 servicos (a dependencia `opentelemetry`/`structlog` deve estar na imagem ou instalada; verificar se o import precisa de dependencias externas alem de stdlib, pois a imagem slim nao as tem) e reexecutar `make compose-up PERFIS=runtime`.
- Teste: ver INT-002.

### INT-002 - MEDIO - `compose-smoke --runtime` nao cobre os servicos Python (falso positivo)
- Evidencia: com os 4 servicos em crash loop, `make compose-smoke PERFIS=runtime` retornou "SMOKE OK" (rc=0). O ramo `--runtime` de `infrastructure/docker/scripts/smoke.sh:35-37` so verifica `proxy -> api` e `proxy -> web`.
- Correcao: acrescentar checagem do healthcheck/estado `healthy` de tenant-runtime, ai-gateway, tool-gateway, event-dispatcher e tenant-provisioner. Teria pego INT-001.

### INT-003 - MEDIO - Links para `documentacoes/reviews/` quebram na branch (15 links em 8 documentos)
- Evidencia: script de links (abaixo) acusa 15 `BROKEN` do tipo `../reviews/2026-10-25-{auditoria,review,qa,revalidacao}-*.md` em DEC-001/002/003/004/006/012 e FND-004. Os arquivos existem apenas como untracked em `/home/vinicius/nucleos/documentacoes/reviews/` (`git ls-files documentacoes/reviews` vazio no checkout principal e na branch).
- Impacto: ao entregar a branch sem os relatorios, os documentos apontam para o nada. Resolvem assim que `documentacoes/reviews/` for commitado.
- Acao do coordenador: incluir os relatorios no commit de registro do lote (ou ajustar os links).

### INT-004 - BAIXO - `CLAUDE.md`/`AGENTS.md`/`.agents/rules/project-instructions.md` desatualizados em "Validacao"
- Evidencia: `CLAUDE.md:182-184` (idem `AGENTS.md:192`): "Linters, hooks e CI ainda nao existem (FND-002/FND-005)". FND-002 existe (`make lint`, `make hooks`, lefthook, gitleaks, `lint-regressao`); so o CI (FND-005) falta. O proprio doc de FND-002 (`documentacoes/engenharia/2026-10-25-fnd-002-padroes-qualidade-linters-hooks.md:81`) deixa isso como pendencia para a integracao. Comandos reais a declarar: `make lint`, `make hooks`, `make compose-up/compose-smoke/compose-down`. Corrigir os tres arquivos espelhados e, pela regra do projeto, via fonte + `node scripts/instalar-skills.mjs --apply/--check` se aplicavel.

### INT-005 - BAIXO - Equivalencia "AC-1 de FND-004 := `make compose-up`" ainda nao registrada no ticket
- Evidencia: o doc de FND-004 (linha 73) diz que o registro no ticket/QA e do coordenador; `grep AC-1` em `documentacoes/backlog/EP-01*/tickets.md` nao retorna a equivalencia. Registrar no ticket FND-004 e no estado do lote. Observacao: dado INT-001, o AC-1 vale apenas para o perfil core ate a correcao.

### INT-006 - BAIXO - Justificativas de "Lessons" desatualizadas apos a integracao
- `fnd-002` (linhas 74-77) e `fnd-004` (linhas 93-95) afirmam que a trilha `lessons/` e de C#/.NET; `fnd-009` (linha 173) diz que o indice "ainda nao tem lessons publicadas". Apos LOC-001 e a renumeracao, a trilha e TS/Python e tem 2 lessons (00 migracoes, 01 sessao opaca). A decisao de nao criar lesson nao e invalidada por isso (nenhum conceito novo exigido), mas a justificativa textual ficou factualmente errada. Alem disso `lessons/README.md` ainda tem a secao "Ordem pedagogica prevista ... ainda sem lessons publicadas" ao lado do indice com 2 lessons.

### INT-007 - BAIXO - Formato inconsistente das linhas de ADR no indice
- `documentacoes/arquitetura/adr/README.md`: ADR-016/018/020/026 usam `(**Proposto**)`, ADR-017 usa `— **Proposto**`. Cosmetico; unificar.

## Verificacoes por tema

### (1) Interacao entre tarefas e resolucoes de conflito
`git show --cc` de todos os 14 merges. Merges com hunks combinados: `a49a167` (health.test.ts, pnpm-lock.yaml, pyproject.toml, uv.lock), `c09f6fc` (Makefile) e `9183008` (ADR-016, adr/README.md, doc DEC-002). Os demais sem diff combinado.
- `c09f6fc`: `.PHONY` unificado contem a uniao correta (`compose-*` de FND-004 + `lint-regressao format hooks` de FND-002). OK. Targets conferidos: todos definidos.
- `9183008`: renomeacao para `01 - Sessao opaca e revogacao.md`; ADR-016 e doc DEC-002 apontam para o novo nome; indice unico com ADR-016/017/018/020/026 e `lessons/README.md` com 00 e 01 em ordem de dependencia. Nenhuma referencia ao nome antigo (`grep -rIn "00 - Sessao\|00%20-%20Sessao"` fora de `.git`/`node_modules`: zero ocorrencias). OK.
- `a49a167`: locks regenerados; `pnpm install --frozen-lockfile`, `uv sync --frozen` e `uv lock --check` passam na copia limpa, logo os locks estao coerentes com os manifestos. Sem marcadores de conflito.
- `4be3ce3`: atualiza "Validacao" com os comandos de FND-001, correto na epoca, ver INT-004 para o estado atual.
- A unica interacao quebrada e INT-001 (compose x observabilidade Python).

### (2) FND-009 rodada 3 - testes reescritos (comparado a `7c19dab`)
Nenhuma assercao enfraquecida. Diff `7c19dab..HEAD` dos testes:
- `apps/api/src/health.test.ts`: troca `address()`+porta manual por `app.getUrl()`; mesmas assercoes (status 200, corpo `{status:"ok",service:"api"}`, correlation id UUID, corpo de `/readyz`, route `/readyz`, sentinela ausente dos logs). Resto e reformatacao.
- `apps/tenant-provisioner/src/server.test.ts`: so quebra de linhas; assercoes identicas.
- `packages/observability/src/observability.test.ts`: callbacks ganham tipos/chaves; no teste AC-1 o handler passou a IIFE async com `res.destroy` em falha (falha de assercao ainda derruba o teste via erro no cliente) e `runJob` deixou de ser embrulhado em `Promise.resolve(...).then`. `runJob<T,R>` e sincrono (`context.ts:73`) e o callback e sincrono, logo a ordem (job.done logado antes da assercao e da resposta) e preservada. Mesmo conjunto de assercoes.
- 4 `test_health.py`: `urllib` -> `http.client` com helper `_get`. Mantidos: status 200 + corpo exato de healthz, corpo exato de readyz, 404 em rota desconhecida, `x-request-id` do cliente ignorado e de 36 caracteres, `correlation_id` do log igual ao retornado, `service`, sentinela ausente. A assercao composta `returned != X and len == 36` foi dividida em duas (equivalente ou mais estrita). Nota: `dict(res.getheaders())` e sensivel a caixa; o servidor emite `x-request-id` em minusculas e o teste passa.
- Mudancas de fonte tambem sao so de formatacao/tipagem (`api/observability.ts`, `provisioner/server.ts`, `http.ts`). Em `observeHttp` o retorno do handler deixou de ser repassado (era descartado pelo Node de qualquer forma): sem mudanca de comportamento observavel.
- Resultado: `make test` rc=0 (turbo 12/12 tarefas, pytest 18 passed).

### (3) Fluxos executados (copia limpa, Node 24.22.1)
| Fluxo | Resultado |
| --- | --- |
| `make setup` | rc=0 (corepack, pnpm frozen, uv sync frozen) |
| `make lint` | rc=0 (eslint, compileall, lint:quality, uv lock --check, ruff check/format, mypy, import-linter, gitleaks "no leaks found", lint-regressao: 18 controles falharam como esperado) |
| `make test` | rc=0 (12/12 turbo; pytest 18 passed em 9,5 s) |
| `make build` | rc=0 (turbo + `uv build --all-packages`) |
| `make up` / `make health` / `make down` | rc=0/0/0; 7/7 componentes OK em 3000,3001,3002,8001-8004; apos `down` nenhuma porta em escuta nem processo remanescente |
| `make compose-up` (core) | rc=0 em 17 s; 5 healthy + minio-init/seed Exit 0; seed Redis aplicado |
| `make compose-smoke` (core) | rc=0 "SMOKE OK"; portas publicadas so em 127.0.0.1 (checadas nas interfaces do host) |
| `make compose-up PERFIS=runtime` | rc=2 apos 4m03s: ver INT-001 |
| `make compose-smoke PERFIS=runtime` | rc=0 (falso positivo): ver INT-002 |
| `make compose-down` + remocao dos 3 volumes `nucleos-dev_*` | 0 containers, 0 redes e 0 volumes do projeto restantes |

Isolamento: o compose usa portas de host 15432, 16379, 18080, 19000/19001, 11025/18025, 14317/14318/13133 e o projeto `nucleos-dev`; nao tocou 5432/6379/8080 nem containers de outros projetos (listados e intocados). Observabilidade (`PERFIS=observability`) nao foi exercitada (fora do pedido).

### (4) Documentos, links, ADRs
- Script de links (todos os `.md` adicionados/alterados em `documentacoes/` e `lessons/` mais README/CLAUDE/AGENTS; 62 documentos, 242 links relativos): 227 resolvem, 15 quebram, todos de INT-003. Nenhum outro quebrado.
- ADR-016, 017, 018, 020 e 026: todos com `Status: Proposto`, todos presentes no indice. Nenhum ADR novo "Aceito". Os ADR-001..015 constam "Aceito como baseline" por herdarem o status do documento consolidado (importados em FND-008, anteriores a esta onda); `0000-template.md` apenas lista a opcao.
- Numeracao de lessons 00, 01 sem lacunas; links do indice resolvem.

### (6) Segredos
- `gitleaks detect --log-opts=2cb39dc..HEAD`: 35 commits, "no leaks found".
- Varredura da arvore sem git: 5 achados `generic-api-key`, todos em `apps/web/.next/*` (artefato de build ignorado pelo `.gitignore`, nao versionado). Falso positivo da pasta de build local.
- `git ls-files` so lista `.env.example` (sem valores reais; segredos do compose sao gerados localmente por `gerar-segredos.sh` e ignorados).

### (7) Checkout principal
`/home/vinicius/nucleos` esta na branch `developer` (HEAD inalterado `c3c0ba4`); nada commitado nem alterado por esta validacao alem deste relatorio.

## Matriz de fluxos combinados
| Fluxo | Tarefas envolvidas | Status |
| --- | --- | --- |
| setup -> lint -> test -> build | FND-001, FND-002, FND-009, FND-004 (Makefile) | PASS |
| up -> health -> down (processos locais) | FND-001, FND-009 | PASS |
| compose core (up, smoke, down) | FND-004 | PASS |
| compose core + runtime | FND-004 x FND-009 | FAIL (INT-001), smoke nao detecta (INT-002) |
| Indice de ADRs (016/017/018/020/026 Proposto) | DEC-002/003/004/006/012 | PASS (INT-007 cosmetico) |
| Indice de lessons e renomeacao para 01 | DEC-002, DEC-003 | PASS (INT-006 texto) |
| Links de documentos | todas | FAIL parcial (INT-003) |
| Segredos | todas | PASS |
| Regras do projeto (CLAUDE.md Validacao) | FND-001, FND-002 | Desatualizado (INT-004) |

## Lacunas e nao executado
- Perfil `observability` do compose, CI (FND-005) e teste a partir de outra maquina da LAN nao executados.
- Nao foi investigado se o `PYTHONPATH` sozinho basta em INT-001 (dependencias externas de `nucleos_observability` na imagem slim); a correcao deve ser validada por `make compose-up PERFIS=runtime`.
- Nenhum arquivo do repositorio foi editado; este relatorio e o unico artefato escrito (sem commit). Artefatos de execucao ficaram em copia no scratchpad.
