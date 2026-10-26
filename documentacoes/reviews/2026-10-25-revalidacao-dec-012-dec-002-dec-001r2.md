# Revalidacao focal: DEC-012, DEC-002, DEC-001 (rodada 2)

Revisor independente (nao implementou). Sem edicao de codigo e sem commit. Data: 2026-10-25.
Modo: revalidacao focal (IDs informados, commits de correcao, raio de impacto demonstravel).

## Escopo e estado

| Tarefa | Branch | Commit | Pai | Worktree | Arvore |
| --- | --- | --- | --- | --- | --- |
| DEC-012 | tarefa/dec-012 | 4db6cf1 | a790676ea63133ceb13f9fd891e62993a16fd1e3 | /home/vinicius/nucleos-worktrees/tarefa/dec-012 | limpa |
| DEC-002 | tarefa/dec-002 | b4501f6 | 7d45e877f428841fdcc590ed30c82e624b47e671 | /home/vinicius/nucleos-worktrees/tarefa/dec-002 | limpa |
| DEC-001 r2 | tarefa/dec-001 | 0f5bcbe | 3fb8aa7 | /home/vinicius/nucleos-worktrees/tarefa/dec-001 | limpa |

Fontes de IDs: `2026-10-25-auditoria-dec-012.md`, `2026-10-25-auditoria-dec-002.md`, revalidacao r1 de DEC-001 (REV-009/F3-T, conforme a entrega).

## 1. DEC-012

Verificacoes executadas:
- `python3 -I documentacoes/arquitetura/contratos-propostos/validar.py` (worktree): "RESULTADO: TUDO CONFORME", exit 0.
- Em copia no scratchpad (fora do repo), removido o invalido 13 do implementador e criados 6 invalidos proprios derivados do valido 03: `provider_status` vazio, `raw_payload_ref` vazio, `failure_code` vazio, `provider_event_id` = "abc\n", `plan_code` = "pro\n", `currency` = "BRL\n". Todos rejeitados ("is too short" / "does not match ... (fullmatch)"), resultado TUDO CONFORME.
- Mutacao: removida a linha `Draft7Validator = validators.extend(...)` (volta ao `pattern` nativo): os 3 casos com "\n" passam a ser aceitos e o script retorna "FALHOU (3)". Logo o fullmatch e o que garante a rejeicao.
- `git diff a790676 4db6cf1` no schema: apenas 3 linhas com `minLength: 1` (`provider_status`, `failure_code`, `raw_payload_ref`). Nenhum `pattern` foi alterado.
- ADR-026: `Status: Proposto (somente decisao humana o torna Aceito)` mantido.

| ID | Resultado | Evidencia |
| --- | --- | --- |
| REVIEW-001 | RESOLVIDO | Decisao 4 do ADR-026 agora define "Reconciliacao obrigatoria" para `payment.succeeded`, `subscription.activated` e `subscription.resumed` (destino ACTIVE), `subscription.suspended_by_provider` (SUSPENDED) e `subscription.canceled` (CANCELED_RETAINED); em falha de consulta registra, nao aplica e reenfileira. Trade-offs atualizado. Teste de reordenacao adiado a FND-003/EP-09, como decidido. |
| REVIEW-004 | RESOLVIDO | `minLength: 1` nos 3 campos; inválido 12 presente; meus invalidos de string vazia rejeitados. |
| REVIEW-005 (parcial, validar.py) | RESOLVIDO | `pattern` por `re.fullmatch` via `validators.extend`, docstring registra a divergencia, invalido 13 presente; schema nao alterado; mutacao comprova o efeito. Parte ajv segue ADIADA (FND-003), fora desta revalidacao. |
| REVIEW-006 | RESOLVIDO | Linha `unpaid`/`paused` rotulada "inferencia do projeto", dependencia de configuracao do Dashboard citada, [S2] restrito aos nomes de evento/estado. |
| REVIEW-007 | RESOLVIDO | Mercado Pago: "recomenda URLs separadas para teste e credenciais de teste [M1]". |

Nota (nao e achado): o invalido 13 concentra tres campos com "\n" num unico arquivo; testados individualmente por mim, todos rejeitados. Sem regressao: 6 validos seguem aceitos, matriz inalterada, ADR Proposto.

## 2. DEC-002

Verificacoes: leitura integral do diff `7d45e87..b4501f6` (ADR-016, `poc.mjs`, `saida-poc.txt`, entrega e diffs). `run.sh`/Docker nao reexecutados por mim (nenhum container criado, nada a destruir); aceito o 13/13 da saida versionada, que contem "RESULTADO 13/13 PASS" e a linha com o novo rotulo, consistente com a mudanca de rotulo.

| ID | Resultado | Evidencia |
| --- | --- | --- |
| REVIEW-001 | RESOLVIDO | Consequencias do ADR-016: TOTP de uso unico (ultimo time-step, rejeitar <= ultimo, RFC 6238 5.2), limite de tentativas com bloqueio progressivo por conta e IP para senha e TOTP, resposta uniforme, teste de replay e excesso em IAM-003; frase de que o PoC nao implementa nenhum. |
| REVIEW-002 | RESOLVIDO | Requisito de validar formato (UUID de tenant, schema do corpo), limite de corpo, 400/413 nunca 500, teste em IAM-003; 500 do PoC declarado. Codigo do PoC nao corrigido (REJEITADO conforme auditoria). |
| REVIEW-003 | RESOLVIDO | Celulas SSO, LGPD (1-4) e lock-in da opcao 1 marcadas `[inferencia]`; import de hash argon2id no Keycloak marcado "nao verificado"; TOTP do Kratos rebaixado a `[inferencia]` com ressalva sobre a fonte 1; ressalva de AC-1 parcial presente. |
| REVIEW-004 | RESOLVIDO | Faixas: argon2id 58-258 ms, rejeicao 5,4-16 ms, Postgres 31-40 MiB (com reexecucao 30,6 explicada), no ADR e na entrega. Valores da `saida-poc.txt` (140,7 ms; 5,6 ms; 30,62 MiB) ficam dentro/justificados pelas faixas. |
| REVIEW-005 (a) | RESOLVIDO | Requisito AES-GCM com `user_id` como AAD. |
| REVIEW-005 (b, frase) | RESOLVIDO | Bearer nao tratado como defeito; frase de que cookie/CSRF/fixacao nao foram exercitados, teste em WEB-001/IAM-003. |
| REVIEW-005 (c) | RESOLVIDO | Timeout ocioso, rotacao/revogacao em troca de senha e MFA, limpeza de sessoes expiradas. |
| REVIEW-005 (d, rotulo) | RESOLVIDO | `poc.mjs`: comentario e rotulo do `check` agora "durante sequencia de requisicoes (um worker)"; a celula do ADR diz "nao sob concorrencia"; a entrega idem. Unica ocorrencia de "sob carga" restante esta nos arquivos `-diffs.md` como texto historico do diff (aceitavel) e em backlog nao relacionado. Logica do PoC inalterada (so 2 linhas de texto). |

Rejeitados/adiados nao tocados: variaveis mortas e `void other;` permanecem em `poc.mjs` (ADIADO); REVIEW-005(e) e correcao de codigo para REVIEW-002 nao aplicados; nenhuma lesson renomeada; ADR segue `Proposto`.

Observacao menor (BAIXO, nao bloqueante): o ADR perdeu a frase sobre latencia do `UPDATE` de revogacao (~14 ms); nao ha dependencia, e a entrega nao a reivindica mais.

## 3. DEC-001 rodada 2

| ID | Resultado | Evidencia |
| --- | --- | --- |
| REV-009 / F3-T | RESOLVIDO | `T-F3-T` agora tem 8 colunas (Ativo `A3` = integridade de jobs/politicas, conforme a legenda; Controle do ADR "Membership e a fonte do tenant (5.1)"); a citacao 6.1.9 saiu da linha. |
| Script `verificar.py` | RESOLVIDO | `THREAT_COLS = 8` e checagem por linha `T-Fn-X`. `python3 -I ... verificar.py .` na worktree: "OK: todas as verificacoes passaram" (117 ameacas, 19 fronteiras, 14 RISK, SEC 18/18), exit 0. sha256 do script (`5e52c5fe...b109f5`) confere com a entrega. |
| Teste negativo proprio | RESOLVIDO | Em copia no scratchpad: removida a coluna de `T-F2-S` retornou exit 1 com "T-F2-S: 7 colunas em vez de 8"; coluna extra em `T-F1-S` retornou exit 1 com "9 colunas em vez de 8". (Mensagens de "ticket inexistente" na copia sao esperadas: a copia nao tem o backlog.) |

Sem regressao observada; nenhuma outra linha foi alterada no modelo.

## Veredito

Todos os itens: RESOLVIDO. Nenhum AINDA PRESENTE, nenhuma REGRESSAO.
- DEC-012: APPROVED (ADR segue Proposto; ajv adiado a FND-003).
- DEC-002: APPROVED (ADR segue Proposto; aceite humano pendente; `run.sh` nao reexecutado por mim).
- DEC-001 r2: APPROVED (AC-2/AC-3 seguem pendentes de humano, como declarado).

Pendencia do coordenador (nao e achado): ordem/renumeracao de lessons e `adr/README.md` na integracao.
