# Validacao integrada da onda 3 (FND-005 + DEC-010)

Data: 2026-10-26. Validador independente (sessao nova). Lote 2026-10-25-ep00-ep01-fundacao.
Commit testado: `e7f5df4` (merges `b9cde6d` FND-005 e `e7f5df4` DEC-010; base anterior `02b16a6`), em worktree destacada `/home/vinicius/nucleos-worktrees/integracao-onda3` (Contexto `prepared:true`). Nenhum arquivo do repositorio foi alterado; worktree removida ao final.
Ambiente: Node 24.22.1, `uv`, gitleaks/trivy/hadolint/osv-scanner/actionlint em `~/.local/bin`; Docker local (somente containers do projeto, 127.0.0.1).

## Veredito: APROVADO (com notas)

## Matriz

| # | Verificacao | Resultado | Evidencia |
|---|---|---|---|
| 1a | Merge sem marcadores; arvore limpa | PASS | `git status` limpo; 57 arquivos no diff 02b16a6..HEAD |
| 1b | `lessons/README.md` com lessons 00-03 | PASS | indice lista 00, 01, 02 (FND-005), 03 (DEC-010); arquivos existem |
| 1c | `adr/README.md` com ADR-024 (Proposto) | PASS | linha 28 de `documentacoes/arquitetura/adr/README.md`; arquivo `0024-...md` existe |
| 1d | CLAUDE.md / AGENTS.md / `.agents/rules/project-instructions.md` | PASS | os 3 so mudam no mesmo bloco Validacao (CI FND-005, `ci.yml`, alvos make, branch protection manual); CRLF 100% preservado (212/212, 222/222, 205/205 linhas); textos de cabecalho distintos por desenho |
| 1e | Links relativos em lessons/documentacoes | PASS | script de verificacao em 442 `.md` versionados: 0 quebrados em `lessons/` e `documentacoes/`; 7 em README de skills (ver INT-003) |
| 2 | `make setup`, `lint`, `test` (18 passed), `build`, `lint-workflows` (2 workflows conformes), `ci-regressao` | PASS | todos rc=0 |
| 2 | `make up` / `health` / `down` | PASS | 7 servicos `OK`; rc=0 |
| 2 | `make compose-up` / `compose-smoke` / `compose-down` | PASS | smoke: postgres, pgvector, redis, minio, mailpit OK; containers e redes removidos; lista de containers e portas em escuta identica antes/depois |
| 3 | gitleaks cobre `poc-telemetria` sem falso positivo | PASS | `gitleaks git` (66 commits) e `gitleaks dir infrastructure/docker/poc-telemetria`: no leaks; `make lint` verde. Tokens do PoC sao placeholders `@TOKEN_X@` gerados em runtime e sentinelas `SENTINEL-*` sem match de regra |
| 4 | `ci.yml` cobre o PoC de telemetria | NOTA | ver INT-002 |
| 5 | Pendencia conhecida do cabecalho do `ci.yml` | CONFIRMADA | ver INT-001 |
| - | `trivy fs` (config do job `security`) | FAIL conhecido | ver INT-004 |
| - | `run-poc.sh` (PoC DEC-010 com Loki/Tempo/Prometheus/Grafana) | BLOCKED | nao reexecutado (pull de imagens pesadas; ja validado nos QAs de DEC-010); ver limitacoes |

## Achados

- **INT-001 (baixa, documental, conhecido; NAO corrigido por instrucao):** `.github/workflows/ci.yml` linha 1 diz "Todos os jobs sao checks obrigatorios da branch protection", mas o registro (`documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`, linhas ~116/127/172) define 7 obrigatorios (`lint-ts`, `lint-py`, `make-lint`, `test-ts`, `test-py`, `build`, `security`); `contracts-drift` e `build-images` ficam fora. O mesmo registro, linha 22 ("nomes = checks obrigatorios"), e ambiguo. Correcao sugerida: ajustar o comentario e a linha 22.
- **INT-002 (informativa):** o CI nao exercita o PoC de telemetria (`infrastructure/docker/poc-telemetria`) e isso e coerente: o PoC e descartavel, manual (`run-poc.sh`), sem Dockerfile (usa imagens publicas nginx/loki/tempo/prometheus/grafana por tag, nao por digest), logo `build-images`/`hadolint` nao se aplicam e `trivy fs` (misconfig) nao analisa compose. Cobertura efetiva apenas por gitleaks (`make-lint`, `security`) e, para `poc_telemetria.py`, pelo escopo do ruff/mypy se aplicavel (`testpaths` do pytest nao inclui o PoC). Recomendacao: registrar explicitamente no documento de FND-005 ou DEC-010 que o PoC fica fora do CI; considerar fixar imagens por digest se o PoC for reutilizado.
- **INT-003 (baixa, preexistente, fora do escopo):** 7 `README.md` de skills (`.claude/skills`, `.agents/skills`, `.agent/skills`, `skills/...`) linkam `../CLAUDE.md`, inexistente a partir desses diretorios nas copias; nao introduzido por esta onda.
- **INT-004 (alta para merge em `main`, conhecida e ja registrada em FND-005):** `trivy fs` falha (rc=1): `multer 2.4.0` (HIGH, CVE-2026-113872/GHSA-q7qp-rjg7-q26m, corrigido em 2.5.0) em `pnpm-lock.yaml` via `@nestjs/platform-express` de `apps/api`. O job `security` ficara vermelho desde o primeiro run ate a decisao (override para `multer >= 2.5.0`). Nao e regressao da integracao; confirma que o gate funciona. Nao reexecutei `auditar-dependencias.sh` (depende de bancos online); o resultado do `trivy fs` ja confirma o achado.
- **INT-005 (informativa):** `make compose-down` preserva volumes nomeados (`nucleos-dev_postgres-data`, `-redis-data`, `-minio-data`), por desenho (`reset.sh` os destroi). Nenhum container, rede ou porta ficou de pe; volumes contem apenas dados ficticios de seed. Remocao opcional: `infrastructure/docker/scripts/reset.sh --destroy-only`.

## Limitacoes

- GitHub Actions nao executou (sem runner/remoto): `ci.yml` validado por `actionlint` + politica local (`make lint-workflows`, `make ci-regressao`), nao por execucao real; branch protection e manual e nao verificavel aqui.
- `run-poc.sh`, `auditar-dependencias.sh` (osv/pip-audit/pnpm audit online), `build-images.sh` (sem Dockerfile versionado fora de `tools/qualidade`) e `instalar-ferramenta.sh` nao foram reexecutados.
- Verificacao de links por script proprio (inline links `[](...)`); links de referencia e ancoras (`#...`) nao checados.
- Containers de outros projetos presentes no host nao foram tocados.
