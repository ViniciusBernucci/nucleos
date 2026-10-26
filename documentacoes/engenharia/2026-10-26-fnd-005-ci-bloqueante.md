# FND-005 — Pipeline de CI bloqueante

Data: 2026-10-26

- **Dominio:** engenharia. **Tarefa:** ENT-FND-005 (lote 2026-10-25-ep00-ep01-fundacao), AC-1..3, perfil CRITICO.
- **Branch:** `tarefa/fnd-005`. **Base/HEAD inicial:** `02b16a612b38f353e9d3946122eb8b445cf444bb` (`revisao/2026-10-25-ep00-ep01-fundacao`), arvore limpa.
- **Estado:** implementado e validado localmente; **nao executado no GitHub** (sem push/PR). Aguarda review/QA independentes e as acoes manuais abaixo.
- **Autoria:** Claude (executor, Claude Sonnet 5.5) a pedido do dono do repositorio.

## Objetivo, contexto e escopo

Criar o CI de GitHub Actions que bloqueia merges em `main`: lint, testes, build, `make lint` (com gitleaks), varredura de
dependencias, de arquivos e de imagens, mais as instrucoes manuais de branch protection. Hipotese H-04 (CI = GitHub Actions;
o remoto `origin` aponta para github.com). **Fora do escopo:** executar a branch protection via API (manual, abaixo), push/PR,
deploy/OIDC (nao ha deploy), alvo `contracts-check` (FND-003), Dockerfiles de servicos (nao existem ainda), relatorio de cobertura (pendencia).

## Resumo da implementacao

- `.github/workflows/ci.yml`: gatilhos `pull_request` (-> `main`), `push` em `main` e `workflow_dispatch`; nunca `pull_request_target`.
  `permissions: contents: read` no workflow e em cada job; `timeout-minutes` em todos; `concurrency` cancela execucoes antigas de PR;
  `persist-credentials: false`; nenhum segredo (apenas o `GITHUB_TOKEN` somente-leitura).
- Jobs paralelos (nomes = checks obrigatorios): `lint-ts`, `lint-py`, `make-lint` (o `make lint` inteiro: ESLint, ruff, mypy, arquitetura,
  gitleaks na arvore, regressao dos linters), `test-ts`, `test-py`, `build`, `contracts-drift`, `build-images`, `security`.
- `security`: gitleaks no **historico completo** (`fetch-depth: 0`), `pnpm audit` (>= high), `osv-scanner` (`pnpm-lock.yaml`, `uv.lock`), `pip-audit`,
  `trivy fs` (vuln/segredo/misconfig, HIGH+CRITICAL), `hadolint`, licencas proibidas e a regressao dos gates (`make ci-regressao`). SARIF como artefato.
- `build-images`: para cada Dockerfile versionado, `docker build`, `trivy image` (HIGH/CRITICAL bloqueiam), SBOM CycloneDX e SARIF como artefatos.
  Hoje nao ha Dockerfile: emite `::warning` e passa (gate inativo ate existir imagem).
- `test-ts`/`test-py`: PostgreSQL+pgvector, Redis e MinIO efemeros (mesmos digests do compose de dev), portas so em `127.0.0.1`, senhas aleatorias
  geradas na hora e mascaradas, removidos em `always()`.
- Cache: store do pnpm (`actions/cache`) e `setup-uv` (`enable-cache`, chave `uv.lock`).
- Binarios de scanners baixados por `scripts/ci/instalar-ferramenta.sh` com versao fixa e SHA-256 conferido (sem `curl | sh`).
- `Makefile`: `lint` e `test` divididos em `lint-ts`/`lint-py` e `test-ts`/`test-py` (a ordem e o conjunto de comandos de `make lint`/`make test` nao mudam;
  `check-env` fica em `lint-ts`/`test-*`); novos `lint-workflows` e `ci-regressao`.

### Versoes consultadas (2026-10-26, API publica do GitHub / PyPI)

| Item | Versao | Publicada | Fixacao |
| --- | --- | --- | --- |
| actions/checkout | v7.0.1 | 2026-07-20 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | 2026-10-08 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| astral-sh/setup-uv | v10.3.2 | 2026-10-22 | `07a047e608db84b3d8c06cd9a7c7dcc9c355c18e` |
| actions/upload-artifact | v7.0.2 | 2026-10-07 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| actions/cache | v6.1.0 | 2026-06-26 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| gitleaks | 8.30.1 | 2026-03-21 | SHA-256 do tarball no script |
| osv-scanner | 2.7.0 | 2026-10-12 | SHA-256 do binario |
| trivy | 0.76.1 | 2026-10-21 | SHA-256 do tarball |
| hadolint | 2.15.1 | 2026-07-31 | SHA-256 do binario |
| actionlint | 1.7.12 | 2026-03-30 | SHA-256 do tarball |
| pip-audit (via `uvx`) | 2.10.1 | 2026-06-10 | versao fixa (dependencias transitivas dele nao fixadas por hash) |

Os SHAs de commit foram obtidos de `git/ref/tags/<tag>` (tags leves, tipo `commit`); os SHA-256 vem do campo `digest` dos assets das releases. Toda a
fixacao deve ser revalidada pelo revisor.

## Mudancas por arquivo

- `.github/workflows/ci.yml` (novo), `.github/actions/preparar/action.yml` (novo, composite: Node `.nvmrc`, uv, cache, `make setup` com lockfiles congelados).
- `Makefile`: alvos `lint-ts`, `lint-py`, `test-ts`, `test-py`, `lint-workflows`, `ci-regressao`.
- `scripts/ci/`: `instalar-ferramenta.sh`, `auditar-dependencias.sh`, `check-licenses.mjs`, `servicos-auxiliares.sh`, `contracts-drift.sh`, `build-images.sh`, `verificar-workflows.mjs`.
- `osv-scanner.toml` (excecoes com prazo; vazio).
- `tools/qualidade/regressao-ci.mjs` e `tools/qualidade/regressao-ci/` (fixtures que DEVEM falhar: 8 workflows ruins, `package-lock.json` com lodash 4.17.15,
  `requirements.txt` com requests 2.19.0, `Dockerfile` ruim, licencas proibidas).
- `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md` (CRLF preservado): o bloco de Validacao agora diz que o CI existe.
- Documentacao/lessons: este documento, o de diffs, `lessons/04 - CI bloqueante e cadeia de suprimentos.md`, `lessons/README.md`, `documentacoes/engenharia/README.md`.
- Sem migracoes, sem dependencias novas no `package.json`/`pyproject.toml`/lockfiles.

## Decisoes tecnicas

- **`make lint` inteiro como job proprio (`make-lint`)** alem de `lint-ts`/`lint-py`: custa minutos em paralelo, mas garante que o alvo local e o CI nao divirjam.
- **Binarios com SHA-256 em vez de acoes de terceiros dos scanners:** menos acoes para fixar/atualizar; verificacao criptografica local e reprodutivel.
- **SARIF como artefato, nao `upload-sarif`:** o upload exige `security-events: write` (fugiria de `contents: read`) e nao funciona em fork.
- **Sem `docker/*-action`:** `docker build` direto basta; menos superficie.
- **`contracts-drift` e `build-images` passam com aviso quando nao ha objeto a verificar.** Alternativa (falhar sempre) bloquearia `main` sem motivo; a consequencia
  e que esses dois checks so passam a proteger depois de FND-003 e do primeiro Dockerfile. Registrado como pendencia.
- **Analise estatica da politica sem biblioteca YAML** (nenhuma dependencia nova): `verificar-workflows.mjs` por linhas, complementado pelo `actionlint` (sintaxe/tipos).
- **Sem excecao para a vulnerabilidade encontrada** (abaixo): o gate fica vermelho ate decisao humana, em vez de ser enfraquecido pelo executor.
- Senhas dos servicos auxiliares so existem na memoria do runner; nenhum valor foi impresso ou versionado.

## Validacoes (reais, em 2026-10-26, Node 24.22.1, uv 0.13.5)

| Comando | Resultado |
| --- | --- |
| `actionlint .github/workflows/ci.yml` (1.7.12) | sem achados |
| `node scripts/ci/verificar-workflows.mjs` | OK, 2 arquivos conformes |
| `make lint` (inclui gitleaks na arvore e regressao dos linters) | passou (~1m35s) |
| `make lint-ts` / `lint-py` / `lint-workflows` | passaram (26s / 2s / <1s) |
| `make test` (TS: node:test; Py: 18 testes) e `make build` | passaram (turbo com cache; ~12s pytest) |
| `make ci-regressao` | 15 casos, todos falharam como esperado (8 politicas de workflow, licencas, hadolint `DL3*`, osv-scanner/lodash, pip-audit/requests, trivy fs/requests) |
| `gitleaks git` (historico, 48 commits) | `no leaks found` |
| `scripts/ci/auditar-dependencias.sh` | **FALHA (esperada, achado real):** `multer 2.4.0` (GHSA-q7qp-rjg7-q26m, HIGH 7.5, corrigido em 2.5.0) via `@nestjs/platform-express` de `apps/api`. `pip-audit`: sem vulnerabilidades |
| `trivy fs` (config do job `security`) | falha pelo mesmo `multer` (CVE-2026-113872 no trivy); lockfiles de `documentacoes/arquitetura/poc/dec-003` limpos |
| `scripts/ci/check-licenses.mjs` | OK, 183 pacotes, nenhuma licenca proibida (5 pacotes locais sem licenca, aviso) |
| `scripts/ci/servicos-auxiliares.sh up` / `down` | 3 containers em `127.0.0.1` (portas efemeras), prontos em ~9s, removidos (`docker ps -a` = 0) |
| `scripts/ci/contracts-drift.sh`, `build-images.sh` | passaram com `::warning` (ver decisoes) |

**Nao executado:** o workflow no GitHub (runner real, cache, `setup-uv`/`setup-node` dos SHAs, `services` de rede do runner, tempo real do pipeline, artefatos, `pip-audit`
em runner limpo); `trivy image`/SBOM/`docker build` (sem Dockerfile); hadolint em Dockerfile do produto; os checks da branch protection.

### Criterios de aceite

- **AC-1 (PR com segredo, dependencia vulneravel ou lint quebrado e bloqueado): parcial.** Cada gate foi provado localmente com violacao sintetica
  (segredo: caso do `regressao.mjs`; dependencia: `make ci-regressao`; lint: `make lint-regressao`; falham o job e, com branch protection ativa, bloqueiam o merge). A prova no GitHub
  exige abrir 3 PRs sinteticos (descritos abaixo) e nao foi feita: sem push/PR e sem API.
- **AC-2 (tempo registrado): pendente.** So ha medidas locais (lint ~1m35s; jobs paralelos, estimativa < 15 min); registrar o tempo real do primeiro run.
- **AC-3 (sem credencial de longa duracao): atendido.** Nenhum segredo/PAT; `GITHUB_TOKEN` read-only; sem deploy (OIDC n/a). Verificado por `verificar-workflows.mjs`.

## Instrucoes MANUAIS (nao executadas por este agente)

1. **Pre-requisito:** confirmar que o repositorio `ViniciusBernucci/nucleos` esta no GitHub (H-04/Q-04) e fazer o push da integracao; abrir um PR para `main` para o CI rodar uma vez
   (os nomes de check so aparecem na lista de "required" depois do primeiro run).
2. **Settings > Actions > General:** "Workflow permissions" = *Read repository contents* (nao marcar "Allow GitHub Actions to create and approve pull requests");
   "Fork pull request workflows": exigir aprovacao para colaboradores externos; limitar acoes a "Allow ... selected actions" (actions/*, astral-sh/*).
3. **Settings > Branches > Branch protection rule (ou Ruleset) para `main`:**
   - *Require a pull request before merging*, com **1 aprovacao** minima; *Dismiss stale approvals*; *Require review from Code Owners* (`CODEOWNERS` ja existe; os caminhos de seguranca
     `/services/tool-gateway/`, `/apps/tenant-provisioner/`, `/infrastructure/`, `/CODEOWNERS` exigem o dono listado; para **2 revisoes nesses caminhos** (ticket), cadastrar um segundo
     revisor/time em `CODEOWNERS` e usar um Ruleset com `required approvals = 2` — a regra classica nao diferencia por caminho; **decisao humana**, pois hoje ha um unico dono).
   - *Require status checks to pass* + *Require branches to be up to date*; marcar como obrigatorios apenas os checks com cobertura real: `lint-ts`, `lint-py`, `make-lint`, `test-ts`, `test-py`, `build`, `security`. **NAO marcar `contracts-drift` nem `build-images`** por enquanto (passam com aviso sem proteger nada; ver rodada 1) ate FND-003 e o primeiro Dockerfile.
   - *Do not allow bypassing the above settings*; *Block force pushes* (sim); *Allow deletions* (nao); *Require linear history* (opcional); *Require signed commits* (opcional, decisao humana).
4. **Provas AC-1 (3 PRs sinteticos, nao mergear, fechar ao final):** (a) adicionar um arquivo com token sintetico gerado na hora (nunca reutilize um valor real) -> `security` e `make-lint` falham;
   (b) copiar `tools/qualidade/regressao-ci/dependencias/package-lock.json` para a raiz de um workspace ou fixar `lodash@4.17.15` -> `security` falha; (c) inserir `any` explicito em `apps/api/src` -> `lint-ts`/`make-lint` falham.
   Registrar links/capturas e o tempo do pipeline (AC-2).
5. **Vulnerabilidade `multer` (bloqueia `security` desde o primeiro run):** decidir entre (a) `pnpm.overrides`/atualizacao para `multer >= 2.5.0` (recomendado; muda `package.json`/`pnpm-lock.yaml`,
   dependencia sujeita ao `minimumReleaseAge` do `pnpm-workspace.yaml`) ou (b) excecao temporaria em `osv-scanner.toml` com `ignoreUntil` e motivo (e em `auditConfig.ignoreGhsas` do pnpm — **nota:** `pnpm audit --ignore`
   grava essa chave automaticamente em `pnpm-workspace.yaml`; foi revertida aqui).

## Impactos, riscos, compatibilidade, observabilidade e rollback

- Impacto: merges em `main` passam a depender de 7 checks obrigatorios (9 jobs existem; `contracts-drift` e `build-images` ficam fora ate terem cobertura real); runners `ubuntu-24.04` (minutos do GitHub). `make lint`/`make test` mantem comportamento.
- Riscos: (1) gate `security` vermelho de partida (multer); (2) fixacao por SHA exige manutencao (ver pendencia, sem Dependabot por nao ser pedido); (3) `trivy`/`osv`/`pip-audit` dependem de bancos online —
  indisponibilidade falha fechado; (4) `make-lint` duplica trabalho de `lint-ts`/`lint-py` (aceito); (5) `pip-audit` via `uvx` nao tem hash das transitivas; (6) o CI nao foi exercitado no GitHub; `allowBuilds` do pnpm (FND-001) continua bloqueando scripts de instalacao.
- Observabilidade: logs dos jobs, artefatos `pytest-junit`, `security-sarif`, `imagens-sbom-sarif`; avisos `::warning` explicitam gates inativos.
- Rollback: reverter o commit; desmarcar os checks obrigatorios na branch protection antes (senao o merge fica preso a checks inexistentes).

## Commits e diffs

Commit local em `tarefa/fnd-005` (sem push/amend): `d0e4b5f1b15eba425d49709196e102523d1e2138` — `ci(infra): pipeline de CI bloqueante com scanners e regressao dos gates (FND-005)`.
O commit de documentacao/lessons (arquivos de `documentacoes/` e `lessons/`) e posterior e nao entra no patch textual. Diff completo: [diffs](2026-10-26-fnd-005-ci-bloqueante-diffs.md).
Arquivos `documentacoes/`/`lessons/` desta entrega: este documento, o de diffs, `documentacoes/engenharia/README.md`, `lessons/04 - ...md` (antes `02`), `lessons/README.md`.

## Lessons

- [04 - CI bloqueante e cadeia de suprimentos](../../lessons/04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md) (nova); indice [lessons/README.md](../../lessons/README.md) atualizado.
- Exemplo TypeScript da lesson executado (`node politica.ts`) e conferido com `tsc --strict --noEmit`.

## Pendencias

- Executar o CI no GitHub, registrar o tempo (AC-2) e as provas dos 3 PRs sinteticos (AC-1) — **acao humana**.
- Decisao sobre `multer` (vulnerabilidade real em `apps/api`) e sobre 2 revisoes em caminhos de seguranca / segundo revisor em `CODEOWNERS`.
- Coordenar com FND-003: criar `make contracts-check` (ate la `contracts-drift` e inativo, com aviso).
- Primeiro Dockerfile: confirmar que `build-images.sh` (contexto = pasta do Dockerfile; pode exigir `make build` antes) atende; trocar para `docker/build-push-action` se necessario.
- Relatorio de cobertura (ticket): `node --test` sem script de cobertura e Python sem `pytest-cov` (dependencia nova — decisao humana); hoje so o JUnit do pytest e publicado.
- Manutencao das fixacoes (SHAs/versoes/digests; sugere-se Dependabot para `github-actions` — nao adicionado).
- `exclude-newer` do uv (pendencia herdada de FND-002) nao tratado.

---

## Rodada de correcao 1 (2026-10-26)

Origem: review `d0d3f6f` e auditoria `13cfc1b` (`documentacoes/reviews/2026-10-26-auditoria-fnd-005.md`). Aplicados somente os itens decididos APLICAR; ADIAR/REJEITAR nao foram tocados
(`apps/api`, `package.json`, lockfiles e `osv-scanner.toml` intactos: `multer` segue como decisao humana). Commit: `808184be53f3a546e045eb443e4eba96d3b8f45c` (diff na secao final de [diffs](2026-10-26-fnd-005-ci-bloqueante-diffs.md)).

| Item | Correcao | Prova |
| --- | --- | --- |
| REVIEW-001 (alto) | `preparar/action.yml` exporta `$GITHUB_WORKSPACE/.run/bin` ao `GITHUB_PATH`; `auditar-dependencias.sh` e `check-licenses.mjs` falham com "ferramenta ausente no PATH: <nome>" (pnpm, uv, uvx, osv-scanner) em vez de mascarar | 2 casos novos em `make ci-regressao` (PATH `/usr/bin:/bin`, sem rede); com PATH normal os scripts voltam a executar (`multer` continua barrando) |
| REVIEW-002 | `contracts-drift.sh` usa `git status --porcelain -- packages/` (cobre arquivos novos); `CONTRACTS_DRIFT_RAIZ` permite testar em repo descartavel | 3 casos novos: arquivo novo e modificado falham com "drift"; sem alteracao passa |
| REVIEW-004 | `setup-uv` com `version: "0.13.5"` (fonte: API de releases de `astral-sh/uv`, latest = tag `0.13.5`, publicada em 2026-10-22; consulta 2026-10-26; mesma versao usada nos testes locais) | `make lint-workflows`; a existencia da tag foi confirmada na API, o uso em runner nao foi exercitado |
| REVIEW-005 | politica cobre `inputs.*`, `steps.<id>.outputs.*` e `secrets[...]` | fixtures novas `injecao-inputs`, `injecao-steps-outputs`, `segredo-indexado` falham; `ci.yml` real segue conforme |
| REVIEW-006 | `build-images.sh`: nome do artefato = caminho em minusculas + sufixo do Dockerfile + hash de 6 hex do caminho (raiz vira `raiz-<hash>`); modo `--nome <caminho>` | caso novo: 5 caminhos (raiz, subpasta, mesma pasta com sufixo, maiuscula) geram nomes unicos e validos |

### Orientacao sobre required checks (REVIEW-002; complementa o item 3 das instrucoes manuais)

Enquanto `make contracts-check` (FND-003) e o primeiro Dockerfile nao existirem, `contracts-drift` e `build-images` passam com aviso sem proteger nada:
**nao os marque como obrigatorios por enquanto** (ou marque sabendo que sao verdes sem cobertura). Obrigatorios agora: `lint-ts`, `lint-py`, `make-lint`, `test-ts`, `test-py`, `build`, `security`.
Marcar os dois restantes quando FND-003 e o primeiro Dockerfile forem integrados.

### Validacoes da rodada 1 (reais)

- `make lint-workflows`: OK. `make ci-regressao`: todos os casos falham como esperado (inclui os 9 novos; ver rodada 2), tambem com `CI_REGRESSAO_OFFLINE=1`.
- `make lint`: passou. `make test`: passou (18 testes Python; TS sem falhas).
- Reproducao do REVIEW-001: com PATH sem `.run/bin`, `auditar-dependencias.sh`/`check-licenses.mjs` agora saem com a mensagem explicita (testado); no CI o PATH vem da action `preparar` (nao exercitado em runner).

### Itens ADIAR/REJEITAR mantidos (sem alteracao)

REVIEW-003 (cobertura/SBOM), hashes do pip-audit, permissions por job e `persist-credentials` na politica, contexto de build, REVIEW-007 (a, b adiados; c rejeitado). Pendencias anteriores continuam validas.

---

## Rodada de correcao 2 (2026-10-26)

Origem: revalidacao `documentacoes/reviews/2026-10-26-revalidacao-fnd-005-r1.md` (`9b7c3c3`). Somente o registro foi corrigido; nenhum codigo alterado.

- **REV-001:** a rodada 1 declarou "11 novos" casos de `ci-regressao`; o numero correto e **9**: 3 fixtures de politica (`injecao-inputs`, `injecao-steps-outputs`, `segredo-indexado`), 2 de PATH ausente
  (`auditar-dependencias`, `check-licenses`), 3 de drift (arquivo novo, arquivo modificado, sem alteracao) e 1 de nomes de imagem. A ocorrencia unica do numero (secao "Validacoes da rodada 1") foi corrigida; nao ha outras.
- **Nota (limitacao):** a guarda de PATH para `uv`, `uvx` e `osv-scanner` em `auditar-dependencias.sh` (e `uv` em `check-licenses.mjs`) nao tem teste proprio; os casos de regressao exercitam apenas a ausencia de `pnpm`, a primeira verificada.

---

## Rodada de correcao 3 (2026-10-26)

Origem: QA `documentacoes/reviews/2026-10-26-qa-fnd-005.md` (`acc6b98`). Somente documentacao; nenhum codigo alterado.

- **BUG-001 (medio):** o item 3 das instrucoes manuais listava os 9 jobs como obrigatorios, contradizendo a orientacao da rodada 1. Corrigido no proprio item 3: obrigatorios sao `lint-ts`, `lint-py`, `make-lint`, `test-ts`, `test-py`,
  `build`, `security`; `contracts-drift` e `build-images` ficam explicitamente excluidos ate FND-003 e o primeiro Dockerfile. A frase de impacto ("9 checks") tambem foi ajustada. Nenhum outro README/doc do CI lista os 9 checks
  (varredura em `*.md`/`*.yml`, exceto o proprio ticket, que e a especificacao). Observacao: o comentario de cabecalho de `.github/workflows/ci.yml` ainda diz "todos os jobs sao checks obrigatorios"; e codigo e nao foi alterado nesta rodada (pendencia de redacao).
- **BUG-002 (baixo), decisao humana:** com um unico dono em `CODEOWNERS` (`@ViniciusBernucci`) que tambem e o autor dos PRs, o GitHub nao permite autoaprovacao, entao *Require review from Code Owners* com 1 aprovacao deixaria os PRs sem
  como serem mergeados. Opcoes: (a) cadastrar um segundo dono/revisor (necessario tambem para as 2 revisoes em caminhos de seguranca) e manter 1+ aprovacao; (b) manter **0 aprovacoes obrigatorias** (e desmarcar *Require review from Code Owners*)
  ate existir um segundo revisor, mantendo os checks obrigatorios e a proibicao de force-push. Escolha pendente do dono do repositorio; a politica do ticket (1 revisao) so e atendida na opcao (a).
- **BUG-003:** permanece ADIADO (sem alteracao).
