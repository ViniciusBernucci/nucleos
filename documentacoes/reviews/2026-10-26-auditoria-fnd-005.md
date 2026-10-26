# Auditoria de review — FND-005 (CI bloqueante), perfil CRITICO

Data: 2026-10-26. Auditor independente (nao implementou nem revisou o codigo; sem edicao de codigo).

- Relatorio de origem: `documentacoes/reviews/2026-10-26-review-fnd-005.md` (commit `d0d3f6f`, veredito original CHANGES_REQUESTED, preservado).
- Tarefa: ENT-FND-005, lote 2026-10-25-ep00-ep01-fundacao. Worktree `/home/vinicius/nucleos-worktrees/tarefa/fnd-005`, branch `tarefa/fnd-005`.
- Base `02b16a6`. Codigo auditado: `d0e4b5f` (CI) e `cb2e3da` (docs/lesson); HEAD de entrada `d0d3f6f` (somente o relatorio do review). Nenhuma mudanca de codigo desde a revisao.
- Especificacao: ENT-FND-005 em `documentacoes/backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md` (jobs, `security`, servicos, cache/permissions/SHA, branch protection, artefatos; AC-1 gates bloqueiam, AC-2 tempo registrado, AC-3 sem credencial longa).
- Verificado por leitura de codigo e execucao local de comandos de leitura (nao executado: workflow em runner GitHub, `docker build`).

**Veredito: CORRECOES_NECESSARIAS** (APLICAR: REVIEW-001, 002 parcial, 004, 005 parcial, 006 parcial).

## Gate nao enfraquecido (multer)

Confirmado por leitura: `osv-scanner.toml` esta vazio (so exemplo comentado); nenhum `continue-on-error`, nenhum `--ignore` de GHSA, `pnpm audit --audit-level high` e `trivy ... --exit-code 1` intactos; `package.json`/`pnpm-lock.yaml` nao foram tocados no diff. O `multer 2.4.0` (GHSA-q7qp-rjg7-q26m) continua barrando `security`, conforme decisao humana registrada. Nao e achado de codigo desta tarefa; nenhuma correcao aqui deve ocultar ou excetuar essa vulnerabilidade.

## Tabela de decisoes

| ID | Sev. original | Sev. avaliada | Decisao | Resumo |
| --- | --- | --- | --- | --- |
| REVIEW-001 | ALTO | ALTO | APLICAR | `pnpm` fora do PATH nos passos diretos do job `security` |
| REVIEW-002 | MEDIO | MEDIO (drift) / BAIXO (inatividade) | APLICAR (drift e orientacao) + ADIAR (inatividade) | drift ignora arquivos novos; required checks inativos |
| REVIEW-003 | MEDIO | MEDIO | ADIAR | cobertura e SBOM nao entregues |
| REVIEW-004 | BAIXO | BAIXO | APLICAR (versao do uv) + ADIAR (hashes pip-audit) | `setup-uv` sem versao |
| REVIEW-005 | BAIXO | BAIXO | APLICAR (regex) + ADIAR (permissions por job/persist-credentials) | lacunas da politica estatica |
| REVIEW-006 | BAIXO | BAIXO | APLICAR (nome/colisao) + ADIAR (contexto de build) | `build-images.sh` |
| REVIEW-007 | BAIXO | BAIXO | ADIAR (a, b) + REJEITAR (c) | integridade de binarios, `if: always`, gatilho de branches |

## Justificativa e instrucao por achado

### REVIEW-001 — APLICAR (ALTO confirmado)
- Evidencia: `.github/workflows/ci.yml` (job `security`) chama `scripts/ci/auditar-dependencias.sh` (linha `pnpm audit`) e `node scripts/ci/check-licenses.mjs` (`spawnSync("pnpm", ...)`) diretamente. O Makefile so poe `.run/bin` (shim do corepack) no PATH dentro do `make` (`Makefile:5-6`); a action `preparar` roda `make setup` mas nao exporta o PATH; `setup-node` nao habilita corepack. Logo `pnpm: command not found` no runner: o `pnpm audit` e as licencas nunca sao avaliados e o `status=1` mascara a causa.
- Regra: AC-1 (PR com dependencia vulneravel/licenca proibida e bloqueado pelo motivo certo) e `security` listar `pnpm audit` e licencas (especificacao). Defeito de correcao do gate, nao dependencia externa.
- Correcao minima: (1) em `.github/actions/preparar/action.yml`, depois de `make setup`, novo passo `shell: bash`, `run: echo "$GITHUB_WORKSPACE/.run/bin" >> "$GITHUB_PATH"`. (2) Em `scripts/ci/auditar-dependencias.sh` e `scripts/ci/check-licenses.mjs`, falhar de forma explicita e clara quando `pnpm` (e `uv`/`osv-scanner`) nao estiver no PATH (`command -v pnpm || { echo ERRO...; exit 1; }`), em vez de mascarar. (3) Teste: caso novo em `tools/qualidade/regressao-ci.mjs` que executa `auditar-dependencias.sh` com PATH sem `.run/bin` e exige falha com a mensagem especifica; reexecutar os dois scripts em shell com PATH limpo apos `make setup`. Atualizar o registro (Validacoes) e o diff.
- Risco de regressao: baixo (PATH extra apenas no CI). Cuidado para o caso novo nao depender de rede (rodar tambem com `CI_REGRESSAO_OFFLINE=1`).

### REVIEW-002 — APLICAR (parcial) / ADIAR (parcial)
- Evidencia: `contracts-drift.sh` usa `git diff --exit-code -- packages/`, que nao detecta arquivos gerados novos nao rastreados (falso negativo quando o gate ficar ativo; o AC de FND-003 "CI falha se houver diff nao commitado" inclui arquivos novos). Defeito real, embora hoje inativo.
- APLICAR: no ramo ativo, trocar por verificacao que cubra nao rastreados, p.ex. `test -z "$(git status --porcelain -- packages/)"` (ou `git add -N packages/` antes do `git diff --exit-code`). Teste: caso simulado em `regressao-ci` (alvo `contracts-check` falso que cria arquivo novo em `packages/`) deve falhar. Adicionar ao registro a orientacao de nao marcar `contracts-drift` e `build-images` como required ate FND-003/primeiro Dockerfile, ou marcar com a ressalva explicita.
- ADIAR: a inatividade em si. O ticket depende de FND-003 (contratos) e dos Dockerfiles (ISO-007/RUN-002, fora do escopo); o aviso `::warning` explicito e a pendencia ja estao registrados. Condicao de retomada: integracao de FND-003 / primeiro Dockerfile; sem abrir tarefa externa automaticamente.
- Risco: baixo (ramo inativo).

### REVIEW-003 — ADIAR
- Evidencia: o ticket lista "relatorio de cobertura, SBOM (CycloneDX) por imagem, SARIF". SARIF e JUnit existem; SBOM depende de Dockerfile (inexistente, mesmo adiamento de REVIEW-002); cobertura Python exige `pytest-cov`/`coverage` (dependencia nova = decisao humana, regra do projeto) e a cobertura TS exigiria escolher ferramenta/limiar, nao definidos no ticket.
- Impacto residual: entrega parcial da lista de artefatos; ja declarada como pendencia honesta no registro.
- Condicao de retomada: decisao humana sobre ferramenta/limiar de cobertura; Dockerfile de produto. Manter a pendencia visivel no registro e nao declarar a especificacao integral concluida.

### REVIEW-004 — APLICAR (versao do uv) / ADIAR (hashes)
- Evidencia: `.github/actions/preparar/action.yml:9-12` sem `version:`; instala o uv mais recente, quebrando a reprodutibilidade que o restante do PR impoe por SHA/hash (ticket: supply chain por SHA). Nao adiciona dependencia, so fixa uma existente.
- Correcao minima: `with: version: "<versao do uv usada no lock/local, conferir com uv --version e a tag existente do setup-uv>"`. Teste: `make lint-workflows`; conferir que a versao fixada existe antes de commitar (nao foi possivel provar em runner).
- ADIAR: `--require-hashes` com lock proprio do `pip-audit` (novo artefato/lock, melhoria futura; transitivas ja reconhecidas no registro).
- Risco: se a versao fixada nao existir, o job quebra; validar com a tag oficial.

### REVIEW-005 — APLICAR (regex) / ADIAR (restante)
- Evidencia (`scripts/ci/verificar-workflows.mjs`): a regra de injecao cobre so `github.event.`/`github.head_ref`; nao cobre `inputs.*` (workflow_dispatch), `steps.*.outputs.*`, nem `secrets['X']` (regex exige `secrets.`), o que deixa passar injecao em `run:` e uso de segredo alem do GITHUB_TOKEN por indexacao. Isso toca o ticket ("sem segredos expostos a PRs de forks") e e o gate de politica do proprio CI.
- Correcao minima: ampliar para `\$\{\{\s*(github\.(event\.|head_ref)|inputs\.|steps\.[\w-]+\.outputs\.)` fora de `if:`/`with:`, e `secrets(\.|\[)` (exceto `GITHUB_TOKEN`). Adicionar fixtures em `tools/qualidade/regressao-ci/workflows/` (`injecao-inputs.yml`, `segredo-indexado.yml`) e registra-las no runner. Cuidado: as exclusoes por prefixo `if:`/`with:` ja existentes devem seguir; conferir que o `ci.yml` real continua `OK`.
- ADIAR: exigir `permissions` por job e `persist-credentials: false` na politica. O workflow ja tem `contents: read` global e todos os checkouts tem `persist-credentials: false` (verificado por leitura); o risco e de regressao futura, nao defeito atual. Retomar ao evoluir a politica.
- Risco: falsos positivos em `ci.yml`; resolver ajustando a regra, nao enfraquecendo.

### REVIEW-006 — APLICAR (nome/colisao) / ADIAR (contexto)
- Evidencia: para `Dockerfile` na raiz, `${df%/*}` devolve `Dockerfile` e o `tr -c 'a-z0-9-\n'` troca o `D` maiusculo (nome `-ockerfile`); dois Dockerfiles na mesma pasta colidem em `$nome.sarif`/`.cdx.json`. Quando o primeiro Dockerfile entrar o job ativa sozinho (ver REVIEW-002), entao o defeito de nome vai a producao sem aviso.
- Correcao minima: derivar o nome do caminho completo em minusculas, tratando raiz (`dirname` = `.`) e incluindo o sufixo do Dockerfile (`Dockerfile.api` -> `...-api`); teste com fixtures de caminhos (raiz, subpasta, dois Dockerfiles na mesma pasta) validando nomes unicos, sem Docker.
- ADIAR: contexto de build configuravel. Depende da estrutura dos Dockerfiles de produto (ISO-007/RUN-002, fora do escopo); definir convencao junto ao primeiro Dockerfile.
- Risco: baixo (ramo inativo).

### REVIEW-007 — ADIAR (a, b) / REJEITAR (c)
- (a) SHA-256 do mesmo host sem assinatura: protege contra troca posterior, nao contra release ja comprometida. Real, porem melhoria de supply chain alem do ticket (que exige SHA nas acoes); verificacao cosign/minisign e dependencia/ferramenta nova (decisao humana). Documentar a limitacao no registro. Retomada: decisao humana sobre verificacao de assinaturas.
- (b) Passos do `security` sem `!cancelled()`: so reduz diagnostico (a primeira falha oculta outras no mesmo run); o gate continua bloqueante e nada passa verde. Nao bloqueante; ADIAR (melhoria de DX). Retomada: apos o primeiro run real, se o tempo/diagnostico justificar.
- (c) Gatilho so em PRs para `main`: REJEITAR. O ticket e explicito ("Bloqueia: merges em `main`", branch protection em `main`); PRs para `developer`/`revisao/*` fora do escopo; `workflow_dispatch` ja permite execucao manual.

## Lacunas de cobertura do review (registradas pelo auditor)

1. Injecao em `run:` — o review so verificou ausencia de `${{ }}` de dados do usuario no workflow atual; nao testou a politica contra `inputs.*`/`steps.*.outputs.*`/`secrets[...]` (coberto por REVIEW-005). Existe fixture so para `github.event.*`.
2. Cache — o review concluiu "sem risco" sem observar que `setup-uv` (`enable-cache`) e `actions/cache` (`restore-keys` por prefixo) restauram cache escrito por qualquer run da `main`; aceitavel porque o store do pnpm e verificado por integridade do lockfile (`--frozen-lockfile`) e o cache do uv por `uv.lock`, mas nao foi comprovado em runner. Sem acao de codigo; manter como limitacao.
3. Permissoes — nao verificou que nenhum passo exige mais que `contents: read` (upload-artifact e cache usam token interno/servico de cache, nao `GITHUB_TOKEN` de escrita). Conferencia por leitura nesta auditoria: nenhum `write`, nenhum `continue-on-error`.
4. Escopo do `trivy fs`: `--skip-dirs skills .claude .agents .agent tools/qualidade` reduz a area varrida de vulnerabilidade/misconfig; segredos nessas pastas continuam cobertos pelo `gitleaks` (historico completo). Aceitavel e declarado no workflow; registrar no documento se a lista de skip crescer.
5. Nenhum teste prova que a ausencia de uma ferramenta (pnpm/uv/osv-scanner) faz o gate falhar de forma explicita (coberto em REVIEW-001).
6. AC-1/AC-2 do ticket (PRs sinteticos executados, tempo do pipeline) dependem de execucao real no GitHub (H-04/Q-04), ainda pendente; nao e defeito de codigo e permanece como pendencia do registro.

## Riscos de regressao e ordem sugerida

1. REVIEW-001 primeiro (impacta o gate principal), depois 005 e 002, depois 004 e 006.
2. Apos as correcoes: `make lint-workflows`, `make lint`, `make test`, `make ci-regressao` (completo e `CI_REGRESSAO_OFFLINE=1`) e reexecucao dos scripts com PATH limpo; atualizar registro, diffs e lesson 02 (secoes sobre PATH/politica) e indices se houver link novo.
3. Nao tocar em `package.json`/`pnpm-lock.yaml`/`osv-scanner.toml` para o `multer`.

## Limitacoes

- Workflow nao executado em runner real (sem push/PR); comportamento de `setup-uv`, `setup-node`, cache e tempos nao comprovado.
- Nao reexecutei `docker build`, `servicos-auxiliares.sh` nem os downloads de binarios; confiei nas evidencias do review para SHAs/digests, apenas relendo o codigo correspondente.
- A versao exata do uv a fixar (REVIEW-004) deve ser confirmada pelo implementador.
- Auditoria nao autoriza implementar fora do ciclo do orquestrador e nao substitui QA.
