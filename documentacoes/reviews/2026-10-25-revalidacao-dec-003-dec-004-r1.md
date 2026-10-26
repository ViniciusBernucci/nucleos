# Revalidacao focal r1 - DEC-003 e DEC-004 (2026-10-25)

- Modo: revalidacao depois de correcoes (skill `revisor-de-codigo`), somente os IDs APLICAR das auditorias e o raio de impacto demonstravel. Revisor independente (nao implementou). Sem edicao de codigo, sem commit; unica escrita: este relatorio.
- Fontes: `documentacoes/reviews/2026-10-25-auditoria-dec-003.md` e `2026-10-25-auditoria-dec-004.md`.
- Ambiente: Node v24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64/bin`); Docker local; scripts de ataque no scratchpad, fora dos repositorios.

## Escopo e hashes

| Tarefa | Branch / worktree | Correcao (pai) |
| --- | --- | --- |
| DEC-003 | `tarefa/dec-003` em `/home/vinicius/nucleos-worktrees/tarefa/dec-003` | `96b7bc4dd038f24f9a1ad695338969207a370a23` (`45eb1465ee43fc27f8739edcbee19a64fe123932`) |
| DEC-004 | `tarefa/dec-004` em `/home/vinicius/nucleos-worktrees/tarefa/dec-004` | `066504ac5559490f453d2a4f642bf970e1308616` (`4c6bd4a8030a503e10032e2f55cde63cce933526`) |

HEAD de ambas confirmado por `git log` igual ao SHA da correcao; arvores limpas antes e depois das execucoes (`git status --short` vazio).

## Resultado por ID

| ID | Resultado |
| --- | --- |
| DEC-003 REVIEW-001 | **AINDA PRESENTE (parcial)**: lint estatico contornavel (ver NOVO-003-A) |
| DEC-003 REVIEW-002 | RESOLVIDO |
| DEC-003 REVIEW-003a | RESOLVIDO |
| DEC-003 REVIEW-006 | RESOLVIDO |
| DEC-003 adiados (003b, 004, 005, 007) | registrados no ADR-017 (secao "Requisitos adiados para o runner de producao (DAT-002)"): OK |
| DEC-004 REV-001 | RESOLVIDO no escopo pedido (fail-closed por idade); residuos BAIXO em NOVO-004-A/B |
| DEC-004 REV-002 | RESOLVIDO para falha de fetch; residuo de resposta malformada em NOVO-004-C |
| DEC-004 REV-003 | RESOLVIDO |
| DEC-004 REV-004 | RESOLVIDO (registro); upgrade do ajv segue ADIADO para FND-003 |
| DEC-004 REV-006 | RESOLVIDO |
| DEC-004 REV-007 | RESOLVIDO (parte textual) |
| Regressoes | nenhuma encontrada em DEC-003 ou DEC-004 |

## DEC-003

### Verificacoes executadas
- `POC_PORT=55633 ./run.sh` (container descartavel proprio do script): rc 0. Cenarios A-G passam; novos `[H1]`, `[H2]`, `[H3]` impressos; Python `check_tenant.py` OK; "container destruido ao sair".
- Exemplo da lesson extraido literalmente do bloco `ts` (so a porta/senha por variavel de ambiente), container novo `postgres:16`, `npm install pg@8.23.1`: saida `[ { version: '0001', name: 'exemplo' } ]` com rc 0; segunda execucao tambem rc 0 (idempotente por `DROP DATABASE ... FORCE`). REVIEW-002 RESOLVIDO.
- REVIEW-003a: `provision()` agora chama `assertDbName`; H3 comprova rejeicao antes de qualquer SQL. RESOLVIDO.
- REVIEW-006: texto "nenhum commit existe ainda"/"sera criado" corrigido nos diffs e na entrega; tempos como faixas de execucoes locais (ADR e entrega); erro SQL real coberto em H2 (rollback total, nada registrado, retomada). RESOLVIDO.
- ADR-017 segue `Status: Proposto` (linhas 3 e 95). Adiados 003b/004/005/007 registrados. Lesson nao renumerada (esperado; colisao do 00 e do coordenador na integracao).

### Ataques ao lint (`assertTransactional`, `runner.mjs`)
Rejeitados corretamente (OK): `commit` minusculo, `;;` multiplos, `COMMIT AND CHAIN`, `COMMIT` em linha propria, `END;`, `START TRANSACTION`, `ABORT`, `RELEASE`, `COMMIT PREPARED`, `BEGIN` depois de comentario, dollar-quote de tag errada, `U&'...'; COMMIT`. Sem falso positivo: `COMMIT` em comentario `--`, em `/* */`, em literal, em `$$...$$` e `$t$...$t$`, `END` dentro de corpo de funcao `$$`, corpo de funcao em aspas simples, `COMMENT ON ... IS 'vacuum'`, `SET LOCAL`.

### NOVO-003-A (MEDIO, especialidade: correcao/dados) - lint contornavel por ordem de remocao (REVIEW-001 AINDA PRESENTE)
- Local: `documentacoes/arquitetura/poc/dec-003/runner.mjs`, `assertTransactional` (cadeia `.replace(/--[^\n]*/g, ' ')` antes de remover literais e identificadores).
- Causa: comentarios `--` e `/* */` sao removidos antes dos literais/identificadores entre aspas. Um literal ou identificador que contenha `--` ou `/*` faz o lint apagar o restante da linha/trecho, escondendo o `COMMIT` real. Alem disso `'(?:[^']|'')*'` nao entende `E'\''`.
- Reproducao (contra PostgreSQL 16 real, `migrateTenant` do HEAD, 4 variantes, todas aprovadas pelo lint):
  - `CREATE TABLE b1(x int); SELECT '-- x'; COMMIT; CREATE TABLE b2(x int); SELECT 1/0;`
  - `... SELECT '/*'; COMMIT; ...; SELECT '*/'`
  - `... SELECT 1 AS "--"; COMMIT; ...`
  - `... SELECT E'\\''; COMMIT; ...; SELECT '';`
  Resultado em todas: erro `division by zero`, mas `b1` **persistiu** (`to_regclass('b1')` existe, `b2` nulo) e `schema_migrations` vazia, ou seja, o mesmo estado preso que REVIEW-001 descreve. O teste unitario `lint.mjs` confirmou `rejeitou=false` nas quatro.
- Impacto: a afirmacao do ADR ("rollback completo, garantido pela rejeicao estatica") e a lesson ficam falsas para esses SQLs; e uma migration legitima acidental (ex.: string com `--`) basta, nao so adversarial. Risco de dados real porem baixo na PoC; critico para o runner de producao que herdara o lint.
- Plano: (1) substituir a cadeia de `replace` por um tokenizador de uma passada que reconhece, na ordem em que aparecem, `--`, `/* */` (aninhado no PostgreSQL), `'...'` (com `''` e, para `E'...'`, `\\.`), `"..."`, `$tag$...$tag$`; (2) testes H novos para as quatro variantes acima e um comentario aninhado; (3) opcionalmente remover o falso positivo de `concurrently`/`vacuum` usados como nome de coluna (`CREATE TABLE t(concurrently int)` e rejeitado hoje; BAIXO, aceitavel e documentavel); (4) como defesa em profundidade, o ADR ja diz que a revisao de migration continua gate; manter.

### Observacao BAIXA (nao bloqueante)
- `NO_TX` (`concurrently|vacuum`) e testado como palavra em qualquer posicao do statement, gerando falso positivo para identificadores com esses nomes. Conservador (falha visivel e barata).

### Veredito DEC-003: CHANGES REQUESTED (REVIEW-001 ainda presente de forma parcial; demais IDs resolvidos).

## DEC-004

### Verificacoes executadas
- `npm ci` OK; `npm test`: 21 testes, 21 passam, 0 falhas; `npm run demo`: secao 5 mostra `ACEITO` com 60 s sem refresh, `REJEITADO ... revocation_state_stale` com 91 s e `version_revoked` apos refresh; 9 chamadas de rede ao CP em toda a demo (somente refresh/poll).
- Leitura de `lib/validator.mjs`, ADR-018 (decisoes 7 e 7.1, trade-offs, consequencias, pendencias, itens adiados), README, entrega e `saida/bench.txt`.

### Ataques (scripts proprios, relogio simulado)
| Ataque | Resultado |
| --- | --- |
| Token de tenant revogado, CP fora, sem refresh: 89 s / 91 s | ACEITO / `revocation_state_stale` (limite exato 90 s aceito, 91 s rejeitado) |
| Limpeza apos refresh bem-sucedido | volta a validar; revogado vira `version_revoked` |
| Refresh parcial: JWKS ok, `fetchRevocation` lanca | erro propagado, `keys` mantidas (mesma referencia), carimbo nao avancou, `refreshFailures` incrementado |
| Relogio avancado +200 s com CP fora | `revocation_state_stale` (fail-closed) |
| Relogio recuado -1 h | token rejeitado por `not_yet_valid`; ver NOVO-004-A |
| `maxStalenessS` 0 / NaN / Infinity | sem crash; efeito apenas na politica (config, decisao humana) |
| Construtor com CP fora | propaga erro (inalterado) |
| Kid desconhecido em rajada com CP fora | nao ha DoS ao CP (cooldown 10 s) e o limite de idade continua valendo |

### REV-001 RESOLVIDO; REV-002 RESOLVIDO (fetch); REV-003/004/006/007 RESOLVIDOS
- REV-001: carimbo por relogio local; `validate()` rejeita `revocation_state_stale` antes da checagem de chave/assinatura; teste e demo cobrem token revogado sem refresh apos o limite. ADR 7.1 define fail-closed, 90 s proposto, consequencia de disponibilidade e inclui o valor nas pendencias humanas.
- REV-003: ADR e entrega descrevem p99 variavel (~1,7 a 8,7 ms), inconclusivo, sem reprovar AC-3; `saida/bench.txt` regenerado (p99 1641 us / 6536 us) coerente com o texto.
- REV-004: GHSA-2g4f-4pwh-qvx6 registrado no README e na entrega; upgrade adiado para FND-003. REV-006: premissa de instancia unica do cache `seen` no ADR e em "Quando revisar". REV-007: alvo de 5 s marcado como nao demonstrado, `nbf` ausente, limite `maxItems: 3`; API de `jti` adiada e registrada.
- ADR segue `Proposto`. A entrega menciona "231 us" (p50 original) na tabela, consistente com a nota de execucao original; sem contradicao.

### NOVO-004-A (BAIXO, precisa de validacao) - staleness mede relogio de parede
`now` e injetavel, mas em producao sera relogio de parede: um passo para tras (NTP/ajuste manual) estende a janela alem de 90 s (reproduzido: 85 s, recuo de 80 s, mais 85 s = 170 s de tempo real aceitos). Mitigacao: usar relogio monotonico (`performance.now`/`process.hrtime`) para o carimbo de idade e registrar no ADR 7.1. Nao e regressao; o limite nunca existiu antes.

### NOVO-004-B (BAIXO) - CP "no ar" servindo snapshot velho
Como a correcao nao confia em `generated_at` (decisao deliberada, documentada), um CP que responde com snapshot antigo (replica atrasada/cache) renova o carimbo. Reproduzido: snapshot 200 s atras, refresh "ok", token revogado ACEITO. A auditoria tratava a verificacao de `generated_at` como opcional; sugerir como requisito do ADR 7.1 (comparar `generated_at` do CP com um limite, alem do carimbo local) ou registrar como premissa (CP fonte unica e consistente). Sem mudanca de codigo exigida na PoC.

### NOVO-004-C (BAIXO) - atomicidade vale para falha de fetch, nao para resposta malformada
`refresh()` atribui `this.keys` antes de `this.minVer = r.min_ver`, fora do `try`: `fetchRevocation()` retornando `null` troca `keys` e lanca `TypeError` (sem contabilizar `refreshFailures`, carimbo nao avanca); retornando `{}`/`{min_ver:null}` avanca o carimbo e `validate()` passa a lancar `TypeError` (nao `Reject`) para todo token, ou seja, fail-closed por excecao, nao por codigo. Mitigacao: montar todo o estado novo (`keys`, `minVer`, `revokedJti`) em locais, validar o formato (ajv ja existe no PoC) e atribuir ao final, dentro do mesmo `try`.

### Veredito DEC-004: APPROVED WITH NOTES (todos os IDs RESOLVIDOS; NOVO-004-A/B/C sao BAIXO, nao regressoes, para planejar no runner de producao/ADR).

## Containers e limpeza
`docker ps -a --filter name=dec003 --filter name=exemplo-pg --filter name=rev-dec003 -q` retorna vazio: `dec003-poc-pg` (run.sh, removido pelo trap), `rev-dec003` (ataques) e `exemplo-pg` (exemplo da lesson) destruidos. DEC-004 nao usa containers. Imagem `postgres:16` ficou no cache local do Docker (nao e container).

## Limitacoes
Nao executado: benchmark em host alvo, `npm audit` novo (apenas leitura do registro no README), revisao linha a linha de `*-diffs.md`, CI. Outros containers do host (nucleos-dev, etc.) nao foram tocados.

## Veredito consolidado
CHANGES REQUESTED para DEC-003 (NOVO-003-A: REVIEW-001 AINDA PRESENTE, corrigir o lint com tokenizador e acrescentar testes); DEC-004 APPROVED WITH NOTES.
