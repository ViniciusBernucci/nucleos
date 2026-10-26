# Revalidacao DEC-003 rodada 2 (3/3, ultima) - REVIEW-001

- Revisor: independente (nao implementou). Modo: revalidacao focal de correcao (`revisor-de-codigo`). Sem edicao de codigo; sem commit.
- Tarefa: DEC-003, branch `tarefa/dec-003`, worktree `/home/vinicius/nucleos-worktrees/tarefa/dec-003`.
- Correcao revisada: `be7211af6717a15a843275f3750c85528b432acd` (pai `96b7bc4dd038f24f9a1ad695338969207a370a23`). Arvore da worktree limpa (`git status --short` vazio).
- Decisao de origem: `documentacoes/reviews/2026-10-25-auditoria-r2-dec-003-dec-004.md` (secao DEC-003, NOVO-003-A / REVIEW-001).
- Arquivos lidos integralmente: `documentacoes/arquitetura/poc/dec-003/runner.mjs`; trechos pertinentes de `poc.mjs`, ADR-0017, lesson 00, documentacao da entrega.

## Veredito REVIEW-001: AINDA PRESENTE (parcialmente corrigido)

As cinco variantes originais (`'-- x'`, `'/*'`, `"--"`, `$$--$$`, `E'\''`) e as demais da lista do pedido agora sao rejeitadas, mas restam **dois bypasses reais** que deixam estado parcial preso (CREATE TABLE persistido, versao nao registrada), confirmados em Postgres real.

### Bypass 1 (principal) - `\r` isolado encerra comentario `--` no PostgreSQL
- Causa: o scanner do PostgreSQL encerra `--` em `\n` **ou** `\r` (`non_newline [^\n\r]`). `stripSql` so encerra em `\n` (`while (i < n && sql[i] !== '\n')`), entao `COMMIT` depois de `\r` e tratado como comentario.
- SQL: `CREATE TABLE b1(x int); -- x\rCOMMIT; CREATE TABLE b2(x int); SELECT 1/0;`
- Lint: `assertTransactional` APROVA. PG: executa o COMMIT.
- Fim a fim com `migrateTenant` (PG16 descartavel): erro `division by zero`; `b1` PERSISTIU, `b2` nulo, `schema_migrations` 0 linhas. Sem o `SELECT 1/0` final (`lonecr_noerr`): a defesa `xact_start` detecta ("encerrou ou reiniciou a transacao"), mas `b1` e `b2` persistem (limite ja declarado: so detecta). Quando a migration falha depois do COMMIT, o `xact_start` nao e checado (o erro do SQL sobe antes), entao nem a deteccao age.
- Fuzz diferencial (3 sementes, ~12 mil SQLs aprovados pelo lint, todos executados no PG): todos os bypasses achados continham `\r` isolado dentro de comentario `--` (nenhuma outra classe).
- Correcao minima: no ramo `--`, parar em `\n` ou `\r`.

### Bypass 2 - dollar-quote com tag longa (>= 79 caracteres entre os `$`)
- Causa: `DOLLAR_TAG.exec(sql.slice(i, i + 80))` trunca a janela a 80 chars; uma tag maior nao casa, o `$` vira texto comum e aspas dentro do dollar-quote desincronizam o tokenizador. O PG aceita tags desse tamanho como dollar-quote.
- SQL (T = `$` + 90x`L` + `$`): `CREATE TABLE b1(x int); SELECT T ' T; COMMIT; CREATE TABLE b2(x int); SELECT T ' T; SELECT 1/0;`
- Lint APROVA (o `'` dentro do dollar-quote abre um "literal" que engole o COMMIT). Fim a fim: `b1` PERSISTIU, `b2` nulo, 0 versoes. Fronteira: tag com 78 caracteres entre os `$` ainda e rejeitada (por acerto de tokenizacao); a partir de 79 aprova.
- Correcao minima: casar a tag sem limite de janela (regex ancorada em `sticky`/`lastIndex` sobre a string inteira) ou rejeitar (fail-closed) `$` seguido de tag que nao fecha em 80 chars.

### Possivel (nao exercitado fim a fim como migration unica) - `standard_conforming_strings=off`
- Limite documentado (ADR, lesson e entrega). Confirmado no PG que, com a GUC desligada na sessao por uma migration anterior (`set_config(..., false)`), uma segunda migration `SELECT '\''; COMMIT; SELECT '\'';` e aprovada pelo lint e deixa COMMIT efetivo (persistiu). Como o ADR ja classifica como fora do alcance (gate = revisao humana), nao conta como falha de entrega; apenas registro que o caminho e real e que `set_config` em migration anterior nao e barrado.

## O que foi corrigido (verificado em PG real)
Rejeitados (ou sem falso positivo quando aplicavel) e coerentes com o PG: `'-- x'`; `'/*'`...`'*/'`; `"--"` e `"a""--"`; `$$--$$`; `$t$--$t$`; `E'\''`; `''` escapado; `'\'` sem E; comentario aninhado (`/* /* */ COMMIT; */` aprovado, `/* /* */ */ ; COMMIT` rejeitado); `$1`; unicode; CRLF (`\r\n` OK); COMMIT apos literal nao terminado (rejeita, fail-closed); `END` em `CASE` (sem falso positivo); `commit` minusculo; `COMMIT AND CHAIN`; `;;;`; `BEGIN ATOMIC ... END` (falso positivo aceitavel); `DO $$ ... EXECUTE 'COMMIT' $$` (aprovado, mas o PG rejeita em bloco transacional: sem estado preso); `U&'..'`; `"x"E'..'`; `$$x$$E'..'` (rejeita/erro de sintaxe no PG).

## Demais itens do pedido
- `./run.sh` na worktree: rc 0, "PoC concluida: todas as asserções passaram", linha `[H1b]` presente, container `dec003-poc-pg` destruido ao sair. (Os testes H1b nao cobrem `\r` isolado nem tag longa, por isso passam.)
- ADR-0017: `Status: Proposto` mantido.
- Limitacoes documentadas: `standard_conforming_strings=off`, `DO`/`EXECUTE`, `set_config`, `ALTER ROLE/DATABASE ... SET` presentes no ADR (linha 23), lesson 00 e entrega; defesa `xact_start` descrita como so-detecta.
- Lesson: `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md` nao renumerada (diff do commit altera so conteudo, 6 linhas); unica lesson alem do README.

## Metodo e limpeza
Postgres 16 (pgvector/pgvector:pg16) descartavel `rev-dec003-r2` em 127.0.0.1:55711 (senha aleatoria, nunca impressa), Node 24.22.1; container removido ao fim. Scripts de fuzz no scratchpad da sessao (`fuzz.mjs`, `fuzz2.mjs`, `fuzz3.mjs`, `long.mjs`, `e2e.mjs`). Observacao: uma primeira execucao concorrente de dois fuzzers compartilhando a mesma tabela gerou falsos positivos; foram descartados e refeitos em serie (0 bypasses sem `\r`, 3 x ~5,5 mil SQLs). O fuzz aleatorio nao gera o par de tag longa; esse bypass foi montado e confirmado de forma direcionada.

## Plano de correcao (limite de rodadas esgotado: decisao do coordenador)
1. `stripSql`: encerrar `--` em `\n` e `\r`.
2. Dollar-quote: remover o limite de 80 chars da tag.
3. Testes H1b: `-- x\rCOMMIT`, tag longa (>=79), ambos fim a fim (b1 ausente); opcionalmente barrar `set_config(... standard_conforming_strings ...)` por texto da chave dentro de literal (hoje invisivel).
Como esta e a rodada 3/3, pela regra do auditor o DEC-003 deve ser isolado e o bloqueio registrado no pacote final se nao houver nova autorizacao.
