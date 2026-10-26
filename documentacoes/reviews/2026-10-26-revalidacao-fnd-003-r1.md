# Revalidacao focal FND-003 - rodada de correcao 1/3 (2026-10-26)

Revisor independente (sessao nova, nao implementou). Perfil CRITICO. Branch `tarefa/fnd-003`, HEAD `efcec70` (correcoes `b5297d6`, `efcec70`; review `49786ae`, auditoria `1a2d1a1`). Escopo: IDs APLICADOS e `git diff 570e51f..HEAD`.

## Classificacao

| ID | Resultado | Evidencia |
| --- | --- | --- |
| REVIEW-001 | VERIFICADO (corrigido) | `compat.mjs` agora percorre `antigo.$defs` (remocao + `visitar` por def) e deduplica erros. Em `git clone --no-hardlinks` limpo, as 3 mutacoes de `handshake` (x-schema-version 1.1) falharam: campo removido (`enrollment_response/runtime_kid`), campo obrigatorio novo (`token_response/novo`), `maximum` mais estrito (`expires_in` 600->300). Controle sem mutacao: sem erros. |
| REVIEW-002 | VERIFICADO (corrigido) | Patterns de `problem-details` agora `[!-~]`; 7 exemplos invalidos novos; `varrer-patterns.mjs` + teste Python comparam ECMA (flag u) x `re`. Mutacao no clone (voltar a `[^\s]`): `test_varredura_de_codepoints_...` e `test_copia_dos_schemas_...` FALHAM (volta a divergir e e detectado). Baseline identico a `schemas/` (cmp). Justificativa de manter 1.0 (nunca liberado, sem consumidores; baseline do arquivo nasceu em `635cff0` na propria branch; se consumido, 2.0) e aceitavel. |
| REVIEW-003 | VERIFICADO | `-diffs-schemas.md` contem o patch literal de `git diff d00e8df b5297d6` em schemas/exemplos (0 linhas do patch ausentes; 174 `diff --git`); baseline resumido com hash/estatistica; links nos dois sentidos (principal e `-diffs.md` <-> `-diffs-schemas.md`). |
| REVIEW-004 | VERIFICADO | Registro cita 19 casos de lacuna, coerente com `LACUNAS_DO_MODELO`. |
| REVIEW-007 (parcial) | VERIFICADO (parte aplicada) | Registro declara `validation.py` fora do mypy estrito (4 erros sem stubs) e gate do pacote = ruff + pytest; inclusao no mypy segue ADIADA (`types-jsonschema` exige decisao humana). |

## Reexecucao (worktree)

`make contracts-check` rc=0 (sem drift; compat ok 11 contratos); `make lint` rc=0; `make test` rc=0 (348 passed); `make build` rc=0; `make ci-regressao` rc=0 (todos os gates falham como esperado). No clone com mutacao \s: pytest 2 falhas (esperado), 328 passed.

## Novos achados

Nenhum. `git diff 570e51f..HEAD`: multer, `osv-scanner.toml` e `apps/api` / ci.yml intocados; sem alteracao de dependencias ou lockfiles; arquivos de instrucoes (`CLAUDE.md`, `AGENTS.md`, `.agents/rules/...`) nao modificados (CRLF preexistente inalterado); sem segredos (apenas ocorrencias de `max_output_tokens` e hash de arquivo). Nenhum `reset --hard`, `gc`, `clean`, `cp -a` usado.

## Parecer

Todos os IDs APLICADOS verificados; sem regressoes. APPROVED (rodada 1/3 suficiente). Pendencia remanescente: ADIADOS 005, 006, 007 (inclusao no mypy) e 008, conforme auditoria.
