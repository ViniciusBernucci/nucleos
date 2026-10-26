# Pacote de contratos com geracao TS/Python (FND-003) - 2026-10-26

## 1. Metadados

- **Dominio:** contratos
- **Tarefa:** ENT-FND-003 ([ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-003)), perfil CRITICO, lote 2026-10-25-ep00-ep01-fundacao
- **Branch:** `tarefa/fnd-003`
- **Base / commit inicial:** `d00e8df` (base indicada pelo coordenador, igual ao `HEAD` da worktree)
- **Estado da arvore no inicio:** limpa
- **Estado da entrega:** pronta para revisao independente (nao revisada pelo executor)
- **Autores conhecidos:** Claude Sonnet 5.5 (executor); solicitante: Vinicius

## 2. Objetivo, contexto e escopo

- **Objetivo:** fonte unica de contratos entre componentes, com geracao TypeScript e Python e gate de drift/compatibilidade no CI.
- **Contexto:** ADR-017 e ADR-018 aceitos; schemas de DEC-004 (token/handshake) e ADR-026 (SubscriptionEvent) estavam como proposta em `documentacoes/arquitetura/contratos-propostos/`; o job `contracts-drift` (FND-005) estava inativo (aviso).
- **Escopo:** `packages/contracts`, `packages/sdk`, `packages/contracts-py`, alvos `make contracts*`, ativacao do `contracts-drift`.
- **Fora do escopo:** geracao do OpenAPI **a partir do NestJS** (ver decisoes), schemas de tipos de job especificos, alteracao de `apps/api`, `multer`/`osv-scanner.toml`.

## 3. Resumo da implementacao

- 11 schemas JSON Schema 2020-12 em `packages/contracts/schemas`: `job-envelope`, `runtime-token`, `handshake` (DEC-004 adotados), `subscription-event` (ADR-026), `tool-call-request/response`, `ai-completion-request/response`, `realtime-event`, `tenant-runtime-spec`, `problem-details`. Todos com `x-schema-version` (e `schema_version` const nos envelopes).
- `scripts/gerar.mjs` gera: tipos TS (`json-schema-to-typescript`) + schemas embutidos; tipos do cliente a partir de `openapi/control-plane.openapi.json` (`openapi-typescript`); modelos Pydantic (`datamodel-code-generator`); copia dos schemas no pacote Python. `--check` gera em diretorio temporario e falha em arquivo alterado, novo ou obsoleto.
- Validacao runtime: ajv (TS) e jsonschema (Python) com as divergencias de motor fechadas (`$`/quebra de linha, `date-time` estrito) e regras semanticas do token (`sub`/`tenant_id`, TTL <= 600 s).
- 188 testes no pacote TS (incl. exemplos validos/invalidos, round-trip, drift, compat) e 315 em Python (mesmos exemplos, modelos Pydantic, semantica).
- `scripts/compat.mjs`: compara schemas com `baseline/`; mudanca incompativel exige major, aditiva exige minor.
- `contracts-drift.sh` agora **falha** se `make contracts-check` nao existir; regressao-ci ganhou o caso.

## 4. Mudancas por arquivo

| Arquivo | Tipo | Descricao |
| --- | --- | --- |
| `packages/contracts/schemas/*.schema.json` (11) | codigo/fonte | Contratos |
| `packages/contracts/exemplos/**` (155 json) | teste | Exemplos validos/invalidos compartilhados; `runtime-token/semantica.json`, `date-time.json` |
| `packages/contracts/baseline/*` | config | Baseline v1.0 para compatibilidade |
| `packages/contracts/openapi/control-plane.openapi.json` | codigo/fonte | OpenAPI 3.1 (`/healthz`, ProblemDetails) |
| `packages/contracts/scripts/{gerar,compat}.mjs` + testes | codigo/teste | Gerador, drift, compatibilidade |
| `packages/contracts/src/{validators,datetime,runtime-token,exemplos,index}.ts`, `contratos.test.ts`, `generated/` | codigo/teste/gerado | API TS |
| `packages/sdk/src/{index.ts,index.test.ts,generated/}` | codigo/teste/gerado | Cliente tipado, `ApiError`, `checkHealth` mantido |
| `packages/contracts-py/**` | codigo/teste/gerado | `validation.py`, testes, modelos e schemas gerados |
| `packages/contracts/package.json`, `pnpm-lock.yaml`, `pyproject.toml`, `uv.lock` | config | Dependencias (abaixo) e workspace uv |
| `Makefile` | config | `contracts`, `contracts-gen`, `contracts-check`, `contracts-baseline`; ruff/compileall incluem `contracts-py` |
| `scripts/ci/contracts-drift.sh`, `tools/qualidade/regressao-ci.mjs` | config/teste | Gate ativo; caso "alvo ausente" |
| `eslint.config.mjs`, `.prettierignore` | config | Ignoram `**/generated/` (drift e `tsc` cobrem) |
| `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md` | doc | Bloco Validacao (CRLF preservado) |

Diff completo: [diffs](2026-10-26-fnd-003-contratos-ts-python-diffs.md) e [diffs de schemas/exemplos](2026-10-26-fnd-003-contratos-ts-python-diffs-schemas.md). Sem migracoes.

## 5. Decisoes tecnicas, alternativas e consequencias

- **Supply chain (consulta 2026-10-26, fonte registry npm/PyPI; versoes exatas, > 2 semanas, exceto onde indicado):** `ajv` 8.20.0 (2026-04-24; corrige GHSA-2g4f-4pwh-qvx6, pendencia do ADR-018; sem `$data`); `json-schema-to-typescript` 16.0.0 (2026-08-28, dev); `openapi-typescript` 7.13.0 (2026-06-15, dev); `datamodel-code-generator` 0.83.0 (2026-09-24, dev; 0.84-0.86 tinham < 2 semanas); `pydantic` 2.13.5 (2026-08-28); `jsonschema` 4.26.0 (2026-01-07). Lock files atualizados; `pnpm`/`uv` frozen. `ajv-formats` descartado (formato definido por nos). `auditar-dependencias.sh` e `check-licenses`: unico achado e o `multer` preexistente (nao tocado); nada novo.
- **OpenAPI nao e gerado do NestJS:** `apps/api` so tem `/healthz`; gerar via `@nestjs/swagger` exigiria dependencia e alterar `apps/api`. O OpenAPI e a fonte e o SDK e gerado dele. Consequencia: ao surgirem endpoints, decidir entre manter OpenAPI como fonte (contract-first) ou gerar do NestJS.
- **Adocao dos schemas propostos:** `subscription-event` passou a 2020-12; `tenant_id` trocou `format: uuid` por `pattern` minusculo (ajv-formats aceita maiusculas/`urn:`, Python nao); `type: object` adicionado em ramos `then` (modo estrito do ajv). `strictRequired` desligado (padrao `if/then required` legitimo).
- **Paridade TS/Python:** `pattern` buscado como ECMA com `$` -> `\Z`; `date-time` RFC 3339 estrito identico (tabela comum). Achado durante a implementacao: `re.fullmatch` quebrava `not: {pattern}` (corrigido).
- **Pydantic nao e validador autoritativo:** o gerador nao traduz if/then, uniqueItems, not, propertyNames, data estrita; lista fechada de 19 casos de lacuna testada (if/then/else, uniqueItems, not, propertyNames, `date-time` estrito e `pattern` de chave em `realtime-event`/`handshake`) e falha se o gerador passar a cobrir. `propertyNames` e removido so na copia de staging para o gerador (gerava `dict[Uuid,...]` nao hashable).
- Schemas novos (job, tool, ai, realtime, tenant-runtime-spec, problem-details) sao v1.0 **iniciais e minimos**, derivados dos tickets EP-05/07/09; os tickets donos podem estende-los (minor).
- Baseline de compatibilidade cobre leitura (antigo aceito pelo novo); periodo de coexistencia de major nao e automatizado.

## 6. Validacoes (comandos e resultados reais)

| Comando | Resultado |
| --- | --- |
| `make lint` | exit 0 (eslint, depcruise, ruff, mypy, import-linter, gitleaks, regressao; avisos `security/*` apenas) |
| `make test` | exit 0; contracts 188/188, sdk 5/5, 333 testes Python |
| `make build` | exit 0 (inclui wheel `nucleos_contracts` com `schemas/`) |
| `make ci-regressao` | exit 0 (todos os gates falharam como esperado, inclusive novo caso drift) |
| `make contracts-check` | exit 0; `git status -- packages` sem mudanca tracked inesperada |
| `scripts/ci/auditar-dependencias.sh`, `check-licenses.mjs` | somente `multer` (preexistente); licencas ok |

Nao executado: CI real no GitHub (inexistente localmente); `actionlint` do ci.yml nao mudou. Validacoes foram rodadas antes do commit final; docs/lessons adicionados depois (sem codigo).
Observacao: `format:check` do `package.json` raiz usa aspas escapadas e nao casa `packages/**` (preexistente); arquivos novos foram conferidos com `prettier --check` direto.

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- `contracts-drift` agora bloqueia de verdade; recomenda-se marca-lo como check obrigatorio na branch protection (decisao humana; o doc FND-005 o excluia ate FND-003).
- `make test-ts` passa a exigir `uv` (teste de geracao ~30 s).
- Rollback: reverter o commit; sem migracoes nem estado externo.

## 8. Commits e diffs

- Inicio: branch `tarefa/fnd-003`, `HEAD d00e8df`, arvore limpa, base `d00e8df`.
- Commit de codigo: `635cff0` "feat(contratos): pacote de contratos JSON Schema com geracao TS/Python e gate de drift (FND-003)". Diff em [-diffs](2026-10-26-fnd-003-contratos-ts-python-diffs.md).
- Rodada 1: `b5297d6` (codigo/testes/schemas) e commit de documentacao seguinte.
- Commit de documentacao/lessons: o seguinte na branch (somente `documentacoes/contratos/*`, `lessons/*`); seu proprio diff nao e reproduzido.

### Rodada de correcao 1 (review `49786ae`, auditoria `1a2d1a1`) - commit `b5297d6`

| ID | Decisao | Tratamento |
| --- | --- | --- |
| REVIEW-001 | APLICAR | `compat.mjs` percorre cada `$defs` (definicao removida = incompativel; mensagens deduplicadas). Testes: schema so-`$defs` (remocao de campo, obrigatorio novo, `maximum` mais estrito falham; opcional novo passa) e handshake real mutado (3 mutacoes do review, com 1.1, falham). |
| REVIEW-002 | APLICAR | `problem-details`: `[^\\s]` -> `[\\u0021-\\u007e]` (ASCII visivel) em `type` e `instance`; 7 exemplos invalidos novos (`U+0085`, `U+001C`, `U+FEFF`, nao ASCII); teste `test_varredura_de_codepoints_todos_os_patterns_iguais_ao_ecma` compara `node` (RegExp `u`) e Python para todo `pattern` (BMP + 3 astrais, 4 prefixos). `x-schema-version` mantida em 1.0 e baseline promovido (`make contracts-baseline`): `problem-details` 1.0 nunca foi liberado e nao tem consumidores; se alguem o consumiu, usar 2.0. |
| REVIEW-003 | APLICAR | [diffs de schemas/exemplos](2026-10-26-fnd-003-contratos-ts-python-diffs-schemas.md) criado; links nos dois sentidos; cabecalho do arquivo de diffs corrigido. |
| REVIEW-004 | APLICAR | Contagem corrigida para 19 (secao 5). |
| REVIEW-007 | APLICAR (parcial) | `packages/contracts-py/src/nucleos_contracts/validation.py` esta **fora do mypy estrito** (4 erros por falta de stubs de `jsonschema`); o gate do pacote e ruff + pytest. Inclusao ADIADA (exige a dependencia dev `types-jsonschema`): decisao humana. |
| REVIEW-005 | ADIAR | OpenAPI mantido a mao (desvio declarado do ticket). Destino: EP-02, ao entrar o NestJS, gerar o OpenAPI e remover a copia manual; aceite do desvio e decisao humana. |
| REVIEW-006 | ADIAR | Baseline editavel no mesmo commit (revisao humana do diff de `baseline/` e o controle) e contrato novo sem baseline nao checado. Destino: comparar `baseline/` com o merge-base quando houver CODEOWNERS/protecao de branch ativos (FND-005). Documentado na lesson 11. |
| REVIEW-008 | ADIAR | Entradas livres (`payload`, `arguments`) sem limite de tamanho; ajv com `allErrors`. Destino: tickets JOB/TGW devem impor limite de corpo antes da validacao. |

Validacoes reexecutadas na rodada: `make contracts-baseline`, `make contracts-gen`, `make contracts-check` (exit 0, compat ok 11 contratos), `make lint` (0), `make test` (0; contracts 201/201, 348 testes Python), `make build` (0), `make ci-regressao` (0). Lessons 10 e 11 relidas e atualizadas (`\s`, `$defs`, limite do baseline).

## 9. Lessons

- [09 - Contratos JSON Schema entre TypeScript e Python](../../lessons/09%20-%20Contratos%20JSON%20Schema%20entre%20TypeScript%20e%20Python.md) (numeracao provisoria)
- [10 - Drift e compatibilidade de contratos](../../lessons/10%20-%20Drift%20e%20compatibilidade%20de%20contratos.md) (numeracao provisoria)
- Indice: [lessons/README.md](../../lessons/README.md)

## 10. Pendencias

- Rodada 1: ADIAR 005, 006, 007 (inclusao no mypy) e 008, com destinos na secao 5; `types-jsonschema` depende de decisao humana.

- Decisao humana: marcar `contracts-drift` como obrigatorio; contract-first vs gerar OpenAPI do NestJS; ownership dos schemas minimos novos.
- Gerar OpenAPI do NestJS quando houver endpoints (EP-02).
- `format:check` raiz nao cobre `packages/` (preexistente, fora do escopo).
