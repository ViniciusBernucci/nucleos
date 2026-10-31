# Review independente: lessons pendentes (2026-10-26)

- Tarefa: `lessons-pendentes` (perfil simples, somente documentacao), lote 2026-10-25-ep00-ep01-fundacao.
- Modo: revisao completa de documentacao/lessons (fatos, execucao dos exemplos, links, conteudo minimo, honestidade do registro). Revisor independente (sessao nova; nao escreveu a entrega).
- Worktree: `/home/vinicius/nucleos-worktrees/tarefa/lessons-pendentes`, branch `tarefa/lessons-pendentes`. Base `9214e5b`, HEAD revisado `ca19b56`. Arvore limpa no inicio e ao final (todo arquivo temporario criado na revisao foi removido).
- Escopo: `git diff 9214e5b..HEAD` (17 arquivos: 3 lessons novas, 2 renomeadas, indice, registro novo e 10 docs com links/notas).

## Veredito: APPROVED

Nenhum achado critico, alto ou medio. Quatro observacoes BAIXAS (nao bloqueantes).

## Verificacoes realmente executadas (PATH Node 24.22.1 e `~/.local/bin`)

| Item | Resultado |
| --- | --- |
| Lesson 02 ex.1 (ESLint `JSON.parse` -> `unknown`) | Reproduzido: exit 1 com `no-unsafe-assignment` (2:9), `no-unsafe-return` (3:3), `no-unsafe-member-access` (3:15), identico ao texto; versao estreitada: eslint rc 0 e prettier OK |
| Lesson 02 ex.2 (ruff/mypy) | `S307` e `S602`; mypy `no-untyped-def`; versao corrigida: ruff OK, `ruff format --check` "1 file already formatted", mypy "Success" |
| Lesson 02 ex.3 | `pnpm run lint:arch`: `web-nao-importa-api` e `apps-nao-importam-outros-apps`, "2 dependency violations", exit 2; `lint-imports`: "1 kept, 1 broken", `tool_gateway is not allowed to import ai_gateway` |
| Lesson 02 ex.4 | `gitleaks dir` com segredo sintetico gerado na hora: `leaks found: 1`, rc 1; `check-commit-msg.mjs`: `ajustes` rc 1, `feat(api): x` rc 0 |
| Lesson 02 `make lint-regressao` | 18 linhas `OK`; ultima linha "Todos os casos de regressao falharam como esperado (controles ativos)." |
| Lesson 03 Compose (projeto `licao-compose`, `redis:8.8.3-alpine`, 127.0.0.1:19379) | YAML extraido do .md e executado: sem perfil nenhum servico; `core` -> redis; sem `REDIS_PASSWORD` falha com "required variable ... is missing a value"; `healthy`; `ss` mostra so `127.0.0.1:19379`; PING sem senha -> `-NOAUTH`; `cliente` imprime `PONG`; `runtime` sozinho falha com "depends on undefined service ... invalid compose project"; `down -v`: 0 containers, 0 volumes, 0 redes restantes do projeto (outros containers do host nao foram tocados) |
| Lesson 03 `compose.dev.yml` real (env fictício em arquivo fora do repo, apenas `config --services`) | `core`: minio minio-init minio-seed postgres mailpit proxy redis (7); `observability`: otel-collector; `runtime` sozinho invalido |
| Lesson 05 TS | Extraido do .md, `node packages/observability/exemplo-lesson.ts`: `ok {...}` com `correlation_id":"req-0000001"`, `data":{"tentativas":1,"_dropped":1}`; `tsc --noEmit --strict ...` rc 0 |
| Lesson 05 Python | `uv run --frozen python ...`: `ok {...}`; `mypy --strict`: "Success: no issues found" |
| Lesson 05 testes citados | `pnpm --filter @nucleos/observability test`: 14 pass/0 fail; `pytest packages/observability-py`: 14 passed |
| Lesson 04 (exemplo `politica.ts`) e 06 (`gateway.py`, `python3 -I`) | `politica OK` e `ok` |
| Links | Script percorreu todos os `.md` rastreados (exceto `*-diffs.md`, que contem diffs textuais, e `skills/`): unico "quebrado" e o texto `...` em `reviews/2026-10-26-validacao-integrada-onda3.md` (preexistente, nao e link real). Todos os links para `lessons/` resolvem |
| Nomes antigos | `grep` por `02 - CI`, `03 - Isolamento` e variantes URL-encoded: so ocorrencias dentro do proprio registro (descricao da renomeacao). `CLAUDE.md`, `AGENTS.md` e `Nucleos-Especificacao-Mestra.md` referenciam apenas `lessons/README.md` |
| Escopo | `git diff 9214e5b..HEAD --name-only` fora de `documentacoes/` e `lessons/`: vazio. Nenhum codigo/config/teste alterado |

## Conferencia de fatos (lessons 02, 03, 05)

Conferem com o codigo real: `.dependency-cruiser.cjs` (regras citadas e `no-circular`), `.importlinter` (contratos `independence` e `forbidden`), `lefthook.yml` (pre-commit e commit-msg; LEFTHOOK=0), `pyproject.toml` (ruff `py312`, `S`, mypy 3.12 e `files` listados, `S101` em `tests`), `eslint.config.mjs` (`detect-object-injection` desligada em `*.test.ts`), `package.json` (`lint:eslint` faz `turbo build` dos packages antes; versoes ESLint 10.13.0, typescript-eslint 8.72.0, dep-cruiser 18.7.0, lefthook 2.2.2), `uv`/python 3.13.17, gitleaks 8.30.1, `pnpm-workspace.yaml` (`minimumReleaseAge`, `allowBuilds`), `compose.dev.yml` (perfis, bind 127.0.0.1, portas 15432/16379/18080, redes `interna` `internal: true`, `no-new-privileges`, digests, `/dev/null` sobre `.env.local`, apenas `apps/web` gravavel, distroless sem healthcheck), scripts (`dev.sh` polling, `smoke.sh` SMOKE OK/COM FALHAS, `verificar-lan.sh`, `reset.sh --destroy-only`) e `packages/observability{,-py}` (API publica, limites 4/20/256, `SENSITIVE_KEYS`, regex de ID `{8,128}` com `fullmatch` em Python, `[REDACTION_ERROR]`, `FORBIDDEN_LABELS`, 500 casos de propriedade por linguagem, correcao da corrida de log antes da resposta na "rodada 2" do registro FND-009). Nada inventado encontrado.

## Achados

### REVIEW-001 (BAIXO, documentacao) - registro subnotifica mencoes antigas a "lesson 02"
`documentacoes/engenharia/2026-10-26-lessons-pendentes.md:32` diz que so permanecem mencoes textuais a "lesson 03" em relatorios historicos. Tambem permanecem mencoes a "lesson 02" (que era CI e agora e Qualidade estatica) em `documentacoes/reviews/2026-10-26-review-fnd-005.md:7,80` e `documentacoes/reviews/2026-10-26-auditoria-fnd-005.md:83`. Risco: leitor interpreta "lesson 02" pela nova numeracao. Recomendacao: citar tambem "lesson 02" nessa frase (ou nota "numerada 02 na epoca", como feito nos relatorios DEC-010). Nao bloqueia: sao relatorios historicos.

### REVIEW-002 (BAIXO, precisao) - mensagem de erro citada na lesson 03 nao e estavel
`lessons/03 - Docker Compose para ambiente local.md:84` afirma como "verificado" que `--profile runtime` sozinho no repositorio real falha com `service "web" depends on undefined service "redis"`. Em tres execucoes nesta revisao a mensagem citou outros servicos/dependencias (`api`/`minio`, `tenant-runtime`/`minio`, `tenant-provisioner`/`postgres`); a ordem do servico citado varia. O fato (projeto invalido sem `core`) esta correto. Recomendacao: escrever "por exemplo" ou "uma mensagem do tipo `service \"X\" depends on undefined service \"Y\"`".

### REVIEW-003 (BAIXO, precisao) - afirmacao "todos os comandos executados" na lesson 02
`lessons/02 - Qualidade estatica em TypeScript e Python.md:4` diz que todos os comandos foram executados; `make hooks`/`lefthook install` nao foi (o registro admite a lacuna, linhas 52 e 73). Recomendacao: ajustar a frase para "exceto `make hooks`". Observacao correlata, irrelevante para aprovacao: a lesson 03 chama o plugin de "Compose v2" enquanto o host reporta Compose 5.5.1 (a major do plugin mudou; o comportamento mostrado vale).

### REVIEW-004 (BAIXO, boa pratica) - caminho fixo em `/tmp` no exemplo de segredos
`lessons/02 - ...md:122-125` usa `/tmp/gl` e `/tmp/m` fixos. Recomendacao didatica: `d=$(mktemp -d)`, coerente com a propria lesson que ensina higiene de segredos. Nao ha segredo real no texto (segredo sintetico gerado em tempo de execucao; varredura por `ghp_`, `AKIA`, chaves privadas e senhas literais nas lessons nao encontrou valores).

## Conteudo minimo e indices

- Lessons 02, 03 e 05: objetivo, pre-requisitos e posicao, modelo mental, ligacao com a entrega (link relativo valido), exemplos executaveis, progressao minimo -> padrao, erros comuns/trade-offs/nao se aplica, verificacao e exercicios, datas de criacao/atualizacao e versoes de Node/TS/Python: presentes. Lessons 04 e 06 mantem o conteudo conceitual e ganharam pre-requisitos coerentes.
- `lessons/README.md`: ordem 00..06 por dependencia (02 e 03 antes do CI; 05 antes de 06); pre-requisitos de cada item referenciam apenas lessons de numero menor; data de atualizacao e nota de renumeracao presentes. Sem lesson duplicada por assunto.

## Honestidade do registro (`2026-10-26-lessons-pendentes.md`)

Fiel: tabela de validacoes reproduzida nos pontos que executei; lacunas declaradas (sem `make compose-up` real, sem `lefthook install`, sem `make lint`/`make test` completos); "Nenhum commit/diff de codigo" coerente com `git diff` (so docs/lessons); regra anti-recursao aplicada e arquivos listados; estado "aguarda revisao independente" correto. Unica ressalva: REVIEW-001.

## Limitacoes

- Nao executei `make setup`/`make build`/`make lint` completos nem `make compose-up` do projeto real (so `config --services` com env ficticio). `lefthook` nao esta no PATH nesta sessao.
- O exemplo da lesson 06 foi executado com o Python do sistema, nao em 3.10.12 como declarado; o exemplo da lesson 04 foi executado so na parte TypeScript (YAML/`actionlint` nao reverificados, conteudo apenas renumerado).
- A checagem de links ignorou `*-diffs.md` (texto de diffs) e `skills/`.
- Outros containers/volumes do host (nao relacionados) existiam e nao foram tocados; o Compose desta revisao usou projeto proprio, porta 127.0.0.1:19379, e foi destruido com `down -v`.
