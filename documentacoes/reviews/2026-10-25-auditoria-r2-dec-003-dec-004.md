# Auditoria r2 - DEC-003 e DEC-004 (2026-10-25)

- Papel: auditor independente (skill `auditor-de-review`); nao implementou nem revisou. Sem edicao de codigo, sem commit; unica escrita: este arquivo.
- Origem: `documentacoes/reviews/2026-10-25-revalidacao-dec-003-dec-004-r1.md` (IDs NOVO-003-A, NOVO-004-A/B/C). Auditorias anteriores preservadas: `2026-10-25-auditoria-dec-003.md` e `-dec-004.md` (decisoes originais nao reabertas; REVIEW-001 de DEC-003 ja era APLICAR e segue APLICAR por fato novo: correcao incompleta).
- Namespace: IDs abaixo pertencem a cada tarefa; `NOVO-003-A` = continuacao de DEC-003 REVIEW-001.
- Identidade: auditor-sessao-2 (Claude, sessao independente das de implementacao e revalidacao r1).
- Rodada de correcao: **2 de 3** para DEC-003 (limite 3). DEC-004: rodada 2.

## Estado auditado

| Tarefa | Branch / worktree | HEAD completo | Arvore |
| --- | --- | --- | --- |
| DEC-003 | `tarefa/dec-003` / `/home/vinicius/nucleos-worktrees/tarefa/dec-003` | `96b7bc4dd038f24f9a1ad695338969207a370a23` | limpa (`git status --short` vazio) |
| DEC-004 | `tarefa/dec-004` / `/home/vinicius/nucleos-worktrees/tarefa/dec-004` | `066504ac5559490f453d2a4f642bf970e1308616` | nao alterada por esta auditoria |

HEADs identicos aos da revalidacao r1; nenhuma mudanca desde entao.

## DEC-003 - NOVO-003-A / REVIEW-001: APLICAR

- Severidade original (r1): MEDIO. Avaliada: **MEDIO (mantida)**; critica para o runner de producao que herdara o lint.
- Local: `documentacoes/arquitetura/poc/dec-003/runner.mjs`, `assertTransactional` (linhas 40-52): cadeia de `replace` remove `--[^\n]*` e `/* */` ANTES de literais, identificadores e dollar-quote.

### Reproducao independente (Node v24.22.1; Postgres 16 descartavel `aud-dec003`, porta 55644, destruido ao fim - `docker ps -a --filter name=aud-dec003` vazio)
1. Lint puro (`assertTransactional` do HEAD), cinco variantes, TODAS aprovadas (nenhuma rejeitada):
   - `SELECT '-- x'; COMMIT; ...` (literal com `--`)
   - `SELECT '/*'; COMMIT; ...; SELECT '*/'` (literal com `/*`)
   - `SELECT 1 AS "--"; COMMIT; ...` (identificador com `--`)
   - `SELECT $$--$$; COMMIT; SELECT 1/0;` (dollar-quote com `--`; variante nova, nao listada em r1)
   - `SELECT E'\\''; COMMIT; SELECT '';` (escape de aspa em `E'...'`)
2. Fim a fim com `migrateTenant` contra o Postgres: SQL `CREATE TABLE b1(x int); SELECT '-- x'; COMMIT; CREATE TABLE b2(x int); SELECT 1/0;` -> erro `division by zero`, porem `to_regclass('b1')`=`b1` (PERSISTIU), `b2`=nulo, `schema_migrations` com 0 linhas. Estado parcial preso, contradizendo a garantia do ADR-017 ("rollback completo, garantido pela rejeicao estatica") e a lesson.
- Nao executado: variante com `standard_conforming_strings=off` (analise por leitura, ver plano item 4).

### Por que APLICAR (nao ADIAR)
Quebra de criterio de aceite declarado (atomicidade por migration) confirmada em banco real; o gatilho pode ser acidental (string com `--`), nao so adversarial; correcao minima e pequena (uma funcao + testes). O ADR-017 ja trata a revisao humana como gate, mas a propria afirmacao de "garantia estatica" fica falsa, entao nao se pode adiar.

### Plano minimo
1. Em `runner.mjs`, substituir a cadeia de `replace` por **tokenizador de uma passada** (varredura por indice, estado unico), que consome na ordem de aparicao:
   - `--` ate fim de linha;
   - `/* ... */` **aninhado** (contador de profundidade, como o PostgreSQL);
   - `'...'` com `''`; se precedido de `E`/`e` (nao parte de identificador), tambem `\` + qualquer char; prefixo `U&'` tratado como literal comum;
   - `"..."` com `""` (incluindo `U&"`);
   - `$tag$...$tag$`, so iniciado quando o caractere anterior NAO e de identificador (`[A-Za-z0-9_$]`) e a tag e valida; parametros `$1` nao abrem dollar-quote.
   Saida: texto com literais/identificadores/comentarios substituidos por espaco/`''`, a ser dividido por `;` como hoje. **Fail-closed:** literal, comentario ou dollar-quote nao terminado -> lancar erro (nunca "assumir que acabou").
2. Testes (estender `poc.mjs` H1/lint ou novo bloco): rejeitar as 5 variantes acima, comentario aninhado `/* /* */ COMMIT; */` (nao deve rejeitar, pois e comentario) e `/* /* */ */ ; COMMIT` (deve rejeitar), `E'\''; COMMIT`, construto nao terminado (rejeita), e manter todos os casos de nao-falso-positivo ja existentes. Pelo menos uma variante deve rodar fim a fim no Postgres: esperado erro de lint ANTES de executar, `b1` ausente.
3. **Defesa em profundidade (recomendada, mesma entrega):** dentro de `migrateTenant`, capturar `SELECT xact_start FROM pg_stat_activity WHERE pid = pg_backend_pid()` logo apos `BEGIN` e comparar apos `client.query(m.sql)`; se mudou (transacao encerrada/reiniciada pelo SQL), lancar erro explicito "migration encerrou a transacao" e **nao** registrar a versao. Limite honesto: e deteccao (o COMMIT interno ja ocorreu), nao prevencao; o ADR deve dizer isso e que a prevencao e o lint + revisao. Alternativa aceitavel: so documentar a limitacao. Teste: usar `E'...'` obscuro nao coberto pelo tokenizador nao e necessario; basta teste unitario forcando o caso (SQL que o lint nao ve, por ex. `DO $$ BEGIN EXECUTE 'COMMIT'; END $$` - PostgreSQL rejeita COMMIT em bloco DO dentro de transacao; usar caso `EXECUTE` apenas se reproduzivel; senao registrar como nao testavel).
4. Registrar no ADR-017 e na lesson: o lint cobre `standard_conforming_strings=on` (padrao); rejeitar `SET ... standard_conforming_strings` na migration (um item no `NO_TX`/lista de proibicoes) ou documentar; SQL dinamico (`DO`/`EXECUTE`) segue fora do alcance, gate = revisao.
5. Item BAIXO de r1 (`concurrently`/`vacuum` como nome de coluna gera falso positivo): **REJEITAR como correcao** (conservador, falha visivel e barata; documentar em uma linha). Com o tokenizador, restringir a primeira palavra do statement e opcional.
6. Atualizar documentacao da entrega (`documentacoes/<dominio>/` + diffs) e a lesson com a nova limitacao e os testes; ADR segue `Status: Proposto`.

- Risco da alteracao: baixo (funcao pura isolada; mudanca de comportamento apenas para SQL antes aprovado indevidamente; risco de novo falso positivo mitigado pelos testes existentes). Teste esperado: `./run.sh` rc 0 com novos cenarios; lint rejeita as 5 variantes; Postgres sem `b1`.
- Condicao de bloqueio: se a correcao falhar em revalidacao independente, e a rodada 3 (ultima); apos isso, isolar DEC-003 e registrar bloqueio no pacote final.

## DEC-004 - notas A/B/C (todas BAIXO, nao regressoes)

Evidencia lida no HEAD `066504a`: `lib/validator.mjs` (`refresh()` atribui `this.keys` e `this.minVer` apos o `try`, linhas 40-51; `validate()` checa staleness na linha 72) e ADR-018 decisao 7.1 (nao menciona relogio monotonico, nem idade do snapshot do CP, nem formato da resposta).

### NOVO-004-A (relogio monotonico): APLICAR (somente ADR) - BAIXO mantido
- Fato: `now()` injetavel; em producao relogio de parede. Recuo de relogio estende a janela alem de 90 s (reproduzido em r1: 170 s reais). Afeta o controle essencial (limite de obsolescencia), portanto o ADR deve exigir o controle.
- Plano minimo: acrescentar ao ADR-018 7.1 uma frase: a idade do estado de revogacao e medida com **relogio monotonico** (ex.: `process.hrtime`/`performance.now`), separado do relogio de parede usado para `exp/iat`; mudanca de relogio de parede nao deve alongar a janela. Na PoC, nao mudar codigo: registrar na entrega/README que o PoC usa `now()` injetavel e que a garantia depende desse requisito. Teste: nenhum novo (PoC); criterio de aceite para o validador de producao.
- Risco: nulo (documental).

### NOVO-004-B (snapshot velho do CP): APLICAR (somente ADR/premissa) - BAIXO mantido
- Fato: carimbo local avanca em qualquer resposta bem-sucedida; CP "no ar" com replica atrasada renova o carimbo e a revogacao nao chega (reproduzido em r1: snapshot de 200 s, token revogado aceito). A frase do ADR "limitado por `max_staleness` mesmo com o CP ou a rede indisponiveis" e verdadeira so para indisponibilidade, nao para dado velho: evidencia nao pode enganar.
- Plano minimo: no ADR 7.1 (a) qualificar a frase acima e (b) exigir **uma** das opcoes como decisao humana pendente: validar `generated_at` do CP contra o limite (exigindo relogios sincronizados/tolerancia) ou registrar premissa explicita "CP e fonte unica e consistente; replica atrasada fora de escopo" nas pendencias. Sem codigo na PoC.
- Risco: nulo (documental). Nota: nao reabre a decisao deliberada de nao confiar em `generated_at` para o carimbo; apenas torna o limite explicito.

### NOVO-004-C (resposta malformada no refresh): APLICAR (pequeno, codigo + teste) - BAIXO mantido
- Fato: ADR e comentario afirmam refresh "atomico"; vale para falha de fetch, nao para `fetchRevocation()` retornando `null`/`{}`/`{min_ver:null}` (troca `keys` e lanca `TypeError` sem contar `refreshFailures`, ou avanca o carimbo e faz `validate()` lancar `TypeError`). O codigo viola a propria afirmacao documentada; correcao e de 3-5 linhas e o `ajv` ja existe na PoC. Nao aceitar como ADIAR porque a evidencia declara uma propriedade que o codigo nao tem.
- Plano minimo: em `refresh()`, montar `keys`, `minVer`, `revokedJti` em locais DENTRO do `try`, validar `r` (objeto com `min_ver` objeto; `revoked_jti` array opcional) pelo schema do snapshot ja existente, contar `refreshFailures` e propagar erro; atribuir ao final. Testes: `fetchRevocation` retornando `null`, `{}` e `{min_ver:null}` -> erro, `keys`/`minVer` inalterados (mesma referencia), carimbo e `refreshFailures` corretos, `validate()` continua lancando `Reject('revocation_state_stale')` apos o limite e nunca `TypeError`. Atualizar entrega/README (contagem de testes).
- Risco: baixo; rodar `npm test` (21 testes hoje) e `npm run demo`.
- Alternativa aceitavel se o implementador preferir nao tocar codigo: qualificar o texto ("atomico para falha de fetch; resposta malformada e requisito do validador de producao") e **ADIAR** o codigo; mas a opcao recomendada e APLICAR.

## Resumo de decisoes

| ID | Tarefa | Decisao | Severidade (orig. -> aval.) |
| --- | --- | --- | --- |
| REVIEW-001 / NOVO-003-A | DEC-003 | **APLICAR** (tokenizador + testes + defesa em profundidade) | MEDIO -> MEDIO |
| Obs. BAIXA `concurrently`/`vacuum` como identificador | DEC-003 | REJEITAR (conservador; documentar) | BAIXO -> BAIXO |
| NOVO-004-A | DEC-004 | **APLICAR** (texto ADR; sem codigo) | BAIXO -> BAIXO |
| NOVO-004-B | DEC-004 | **APLICAR** (texto ADR/premissa; sem codigo) | BAIXO -> BAIXO |
| NOVO-004-C | DEC-004 | **APLICAR** (codigo pequeno + teste) | BAIXO -> BAIXO |

IDs resolvidos em r1 (DEC-003 REVIEW-002/003a/006; DEC-004 REV-001..004/006/007) e adiados registrados: **sem mudanca**, nao reabertos.

## Veredito: CORRECOES_NECESSARIAS (DEC-003 e DEC-004)
Veredito original do revisor (r1: CHANGES REQUESTED / APPROVED WITH NOTES) preservado. Gate consolidado: DEC-003 bloqueado ate a correcao de NOVO-003-A revalidada em sessao independente (rodada 3 e a ultima); DEC-004 libera integracao apos aplicar A/B (texto) e C, com revalidacao curta.

## Limitacoes
Nao executado: `./run.sh` completo, `npm test`/`demo` de DEC-004 (r1 ja executou), variante com `standard_conforming_strings=off`, CI. Outros containers do host nao foram tocados.
