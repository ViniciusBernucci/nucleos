# Auditoria do review - ENT-FND-003 - 2026-10-26

- **Relatorio de origem:** `documentacoes/reviews/2026-10-26-review-fnd-003.md` (commit `49786ae`, veredito CHANGES_REQUESTED)
- **Tarefa:** ENT-FND-003 (perfil CRITICO), lote 2026-10-25-ep00-ep01-fundacao
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/fnd-003`, `tarefa/fnd-003`; base `d00e8df`; HEAD revisado/auditado `49786ae` (codigo `635cff0`, docs `570e51f`); arvore limpa
- **Auditor:** sessao independente (Claude Sonnet 5.5), sem papel de implementador/revisor; nao editou codigo
- **Regra base:** AC-1..3 da ENT-FND-003 (tickets.md), ADR-017/018, CLAUDE.md (diffs de codigo/testes/config; verificadores configurados)
- **Verificacao:** leitura de `compat.mjs`, `problem-details.schema.json`, `validation.py`, `pyproject.toml`, arquivo de diffs; busca de classes `\s\d\w\b` em `schemas/`. Nao reexecutei `make` (reexecucao do revisor aceita como evidencia; reproduzi por leitura de codigo).

## Veredito: CORRECOES_NECESSARIAS

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao | Criterio / evidencia |
| --- | --- | --- | --- | --- |
| REVIEW-001 | Alto | Alto | **APLICAR** | AC-3 ("mudanca incompativel falha no teste de compat"). Confirmado: `incompatibilidades` so chama `visitar(antigo, novo, "#")`; `visitar` desce por `properties`/`items`/`additionalProperties`; `$defs` esta na lista de chaves ignoradas para "palavra-chave nova" e nunca e percorrido. `handshake.schema.json` tem raiz so com `$defs` (contrato central ADR-018/DEC-004), logo qualquer quebra nele passa como minor. |
| REVIEW-002 | Medio | Medio | **APLICAR** | AC-2 ("mesmo exemplo invalido rejeitado nas duas linguagens", resultado identico). Confirmado: unicos usos de `\s` nos schemas sao `problem-details` linhas 18 e 37; `_ecma_to_python` so traduz `$`; `\s` difere entre ECMA-262 e `re` Unicode. Demais patterns usam classes ASCII explicitas. Correcao minima por restricao do pattern (nao por traducao generica, que ampliaria superficie). |
| REVIEW-003 | Medio | Medio | **APLICAR** | CLAUDE.md: patches de codigo, testes e configuracao devem constar; `schemas/` e `exemplos/` sao fonte/testes (produto central), nao gerados. Confirmado no cabecalho do arquivo de diffs, que os omite com justificativa insuficiente. `baseline/` e copia byte-a-byte de `schemas/` na promocao: pode ser resumido (estatistica + hash), `generated/`, copias em `contracts-py` e lockfiles continuam resumidos. |
| REVIEW-004 | Baixo | Baixo | **APLICAR** | Registro impreciso ("16 casos" vs 19 em `LACUNAS_DO_MODELO`); CLAUDE.md exige documentacao fiel e releitura. Correcao so documental, custo minimo. |
| REVIEW-005 | Baixo | Baixo | **ADIAR** | Desvio do texto do ticket ("OpenAPI gerado do NestJS") e declarado e justificado no registro; `apps/api` e do EP-02. Aceitar o desvio e decisao humana. Impacto residual: OpenAPI mantido a mao pode divergir do Control Plane real. Retomada: ao entrar o NestJS (EP-02), gerar o OpenAPI e remover a copia manual; registrar a pendencia de decisao humana no pacote final/handoff do EP-02. |
| REVIEW-006 | Baixo | Baixo | **ADIAR** | Limitacao conhecida e revisavel (diff de `baseline/` e visivel em review); o ticket nao exige ancora em ref de base. Impacto: quem altera schema e baseline no mesmo commit burla o gate. Retomada: ao existir CI/CODEOWNERS ativos (FND-005/protecao de branch), comparar `baseline/` com o merge-base. Documentar a limitacao na lesson 11 e no registro (pode ser feito junto da correcao do REVIEW-004, doc-only). |
| REVIEW-007 | Baixo | Baixo | **APLICAR (parcial)** + ADIAR da inclusao | Confirmado: `[tool.mypy].files` nao inclui `packages/contracts-py/src`; registro lista mypy verde sem citar a exclusao. APLICAR: declarar a exclusao no registro. ADIAR: incluir o arquivo exige nova dependencia (`types-jsonschema`), vedada sem decisao explicita (CLAUDE.md, "nao adicionar dependencias silenciosamente"). Retomada: decisao humana sobre a dependencia dev. |
| REVIEW-008 | Baixo | Baixo | **ADIAR** | Limite de tamanho de corpo pertence ao transporte/consumidor (JOB/TGW), ainda inexistentes; os schemas sao v1.0 minimos e os patterns nao tem ReDoS. Impacto: DoS se validar antes do limite. Retomada: tickets JOB/TGW devem exigir limite de corpo antes da validacao; registrar a nota no registro da entrega. |

## Instrucao dos APLICAR (correcao minima)

1. **REVIEW-001** (`packages/contracts/scripts/compat.mjs`): em `incompatibilidades`, antes/depois de `visitar(antigo, novo, "#")`, para cada chave `k` de `antigo.$defs` exigir `novo.$defs?.[k]` (senao erro `#/$defs/<k>: definicao removida`) e chamar `visitar(antigo.$defs[k], novo.$defs[k], "#/$defs/<k>")`. Manter `resolver` com raiz (`antigo`/`novo`), pois os `$ref` sao `#/...`. Evitar erros duplicados quando a def tambem e alcancada por `$ref` (deduplicar mensagens por `Set`). Testes: (a) em `compat.test.mjs`, schema so-`$defs` com remocao de campo, campo obrigatorio novo e `maximum` mais estrito, todos devendo falhar, e adicao de campo opcional passando; (b) teste de regressao com o `handshake.schema.json` real em copia mutada (as 3 mutacoes do review, com `x-schema-version` 1.1, devem falhar). `make contracts-check` deve continuar verde (baseline = schemas atuais).
2. **REVIEW-002** (`schemas/problem-details.schema.json` e copia em `contracts-py`, `baseline/`): trocar `[^\\s]` por classe ASCII explicita, por exemplo `[^\\u0000-\\u0020\\u007f-\\u009f\\u2028\\u2029\\ufeff]` ou, mais simples, `[\\u0021-\\u007e]` (URI/instance somente ASCII visivel; ambos motores interpretam igual). Verificar semantica com `exemplos/problem-details`. Adicionar invalidos com `U+0085`, `U+001C`, `U+FEFF` (no `type` e `instance`) e, se possivel, teste que varre codepoints comparando ajv x Python para todos os `pattern` do pacote. Como `problem-details` 1.0 nunca foi liberado (sem consumidores), manter `x-schema-version` 1.0 e promover o baseline com `make contracts-baseline`, registrando a justificativa; `make contracts` para regenerar; `make contracts-check` verde.
3. **REVIEW-003**: criar `documentacoes/contratos/2026-10-26-fnd-003-contratos-ts-python-diffs-schemas.md` com o diff textual de `packages/contracts/{schemas,exemplos}` (`git diff d00e8df 635cff0` mais a alteracao da correcao, se commitada), `baseline/` como estatistica + hash declarando copia identica de `schemas/`; links nos dois sentidos com os arquivos principal e de diffs; corrigir a frase de omissao do cabecalho do arquivo de diffs existente.
4. **REVIEW-004**: corrigir "16 casos" para 19 (ou derivar a contagem) no registro, citando as regras nao suportadas pelo Pydantic.
5. **REVIEW-007**: registrar no registro que `validation.py` esta fora do mypy estrito (4 erros por falta de stubs de `jsonschema`) e que o gate do pacote e ruff + pytest; pendencia: decisao humana sobre `types-jsonschema`.
6. Documentar tambem, no registro, as limitacoes dos ADIAR 005, 006 e 008 (condicoes de retomada acima) e atualizar as secoes de validacao/diffs/pendencias com os comandos reexecutados (`make lint`, `make test`, `make build`, `make contracts-check`, `make ci-regressao`); reler lessons 10 e 11 (compat com `$defs`, limite do baseline).

## Riscos das correcoes
- 001: maior rigor pode acusar incompatibilidade real preexistente entre baseline e schemas atuais; hoje sao identicos (`make contracts-check` verde), entao sem falso positivo esperado. Risco de mensagens duplicadas: mitigado por deduplicacao.
- 002: restringir o pattern a ASCII rejeita URIs com caracteres nao ASCII em `type`/`instance`; coerente com RFC 3986 (URI ASCII) e com o uso interno de ProblemDetails. Promover baseline sem major so e valido por 1.0 nunca ter sido liberada; se alguem a consumiu, usar 2.0.
- 003/004/007: apenas documentais.

## Lacunas e limitacoes
- Lacuna do review: nao verificou, por leitura, `generated/` e copias de schemas (apenas por regeneracao reprodutiva e mutacoes), e amostrou 155 exemplos; aceitavel para o perfil dado o gate de drift, mas o teste de varredura de codepoints (REVIEW-002) fecha a paridade.
- Lacuna do review: nao avaliou se contratos novos sem baseline sao exigidos; ja coberto em REVIEW-006 (ADIAR).
- Nota de conduta do revisor (`reset --hard` em clone descartavel) registrada: sem efeito sobre o produto.
- Nesta auditoria nao reexecutei `make`; nao ha CI real; auditoria de CVE/licencas online nao feita.
- Numeracao 10/11 das lessons permanece provisoria (coordenador).
- Revalidacao independente das correcoes (review de acompanhamento) e necessaria apos o review-loop-driver.
