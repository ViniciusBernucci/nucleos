# DEC-003 — Acesso a dados e migrations (ADR-017 e PoC) — 2026-10-25

## 1. Metadados

- **Domínio:** dados
- **Tarefa:** DEC-003 do lote 2026-10-25-ep00-ep01-fundacao — [ENT-DEC-003](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-003)
- **Branch:** `tarefa/dec-003`
- **Base / commit inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f` (base informada pelo manifesto); `HEAD` inicial igual à base; árvore da worktree limpa
- **Estado da entrega:** correções das rodadas 1 (seção 11) e 2 (seção 12) aplicadas, pendentes de revalidação independente. ADR-017 em status **Proposto**
- **Autores conhecidos:** Claude Sonnet 5.5 (executor); solicitante: Vinícius

## 2. Objetivo, contexto e escopo

- **Objetivo:** ADR-017 com as convenções do ticket, PoC de migrations em 20 bancos com falha induzida no banco 12 e documento de procedimento.
- **Contexto:** ADR-003 (database por tenant) e ADR-008 (PostgreSQL + pgvector); seção 6 do ADR consolidado.
- **Escopo:** ADR-017, PoC descartável, procedimento de migration e roll-forward, lesson.
- **Fora do escopo:** código de produção em `packages/`/`services/`; escolha Kysely x Drizzle (não exercitada); roles/ACL por tenant; backup; ferramentas prontas de migração; AC-1 "ADR aceito" (decisão humana).

## 3. Resumo da implementação

Runner TypeScript (`pg` 8.23.1) migra cada banco com conexão curta, advisory lock por database, `schema_migrations` com checksum SHA-256 e uma transação por migration (SQL + registro). `poc.mjs` executa os cenários e afirma os resultados; `py/check_tenant.py` confere o acesso Python (psycopg 3 async) e o esquema contra snapshot gerado do SQL. `run.sh` sobe `pgvector/pgvector:pg16` em `127.0.0.1:55432` com senha aleatória, executa tudo e destrói o container.

Resultados (ver [saída completa](../arquitetura/poc/dec-003/evidencia/saida-poc.txt)):

- AC-2: lote sequencial de 20 bancos x 3 migrations; falha induzida no banco 12 após 0002 (antes do COMMIT): bancos 01–11 em 0001..0003, banco 12 em 0001 (0002 revertida, `documento` inexistente), bancos 13–20 intocados. Retomada com o mesmo comando: banco 12 aplicou 0002 e 0003, banco 11 pulou 3, os 20 em 0001..0003.
- Tempos (execuções locais, tmpfs, `fsync=off`; variam por execução): falha parcial 0,9 a 1,8 s; retomada 1,4 a 1,7 s; reexecução sem pendências 0,7 a 1,3 s; 20 bancos novos: 1,6 a 3,8 s sequencial e 0,4 a 1,2 s com concorrência 4. O valor exato de cada execução está em `saida-poc.txt`.
- Checksum alterado rejeitado; dois runners simultâneos no mesmo banco aplicaram 3 migrations exatamente uma vez.
- Compatibilidade: PostgreSQL 16.15, pgvector 0.8.7; índices HNSW e IVFFlat usados pelo plano (`<=>`, `<->`), GIN em `tsvector` gerado usado pelo plano; vizinhos e busca textual corretos. Limite observado: o stemmer não une "aluguel" e "alugueis" (a busca por "aluguel" retornou 1 documento).
- Python: `psycopg` 3.3.4 leu `schema_migrations`, esquema igual ao snapshot, consulta vetorial e `tsvector` OK.
- AC-3: [procedimento](2026-10-25-dec-003-como-adicionar-migration-e-roll-forward.md).

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md` | doc | ADR-017 (Proposto) |
| `documentacoes/arquitetura/adr/README.md` | doc | linha ADR-017 no índice |
| `documentacoes/arquitetura/poc/dec-003/run.sh`, `runner.mjs`, `poc.mjs` | código | PoC (rodada 1: `assertTransactional` no runner; rodada 2: tokenizador `stripSql`, defesa `xact_start`, cenário H1b; cenário H e `assertDbName` em `provision()` no `poc.mjs`) |
| `documentacoes/arquitetura/poc/dec-003/migrations/0001..0003*.up.sql` | migração | base, vetor+HNSW, tsvector+GIN |
| `documentacoes/arquitetura/poc/dec-003/package.json`, `package-lock.json` | config | dependência única `pg` 8.23.1 |
| `documentacoes/arquitetura/poc/dec-003/py/pyproject.toml`, `uv.lock`, `check_tenant.py` | config/código | `psycopg[binary]` 3.3.4 |
| `documentacoes/arquitetura/poc/dec-003/evidencia/saida-poc.txt`, `schema-snapshot.json` | evidência | saída real e snapshot |
| `documentacoes/dados/2026-10-25-dec-003-como-adicionar-migration-e-roll-forward.md` | doc | procedimento |
| `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md`, `lessons/README.md` | doc | lesson e índice |
| esta entrega e `-diffs.md` | doc | registro |

## 5. Decisões técnicas, alternativas e consequências

No [ADR-017](../arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md). Escolhas da PoC: fail-fast no lote; lock por database via `pg_try_advisory_lock` com polling (permite timeout); extensão criada pelo provisioner. Local da PoC em `documentacoes/arquitetura/poc/` (versionada, sem criar `packages/`).

## 6. Validações (comandos e resultados reais)

| Comando | Resultado |
| --- | --- |
| `documentacoes/arquitetura/poc/dec-003/run.sh` (Node v24.22.1, uv 0.13.5, Docker) | Sucesso: todas as asserções de `poc.mjs` passaram, `check_tenant.py` OK em 2 bancos, container destruído (`docker ps -a --filter name=dec003` vazio) |
| `npm install --package-lock-only`, `uv lock` (em `py/`) | lock files gerados; `run.sh` usa `npm ci` e `uv sync --frozen` |
| `docker pull pgvector/pgvector:pg16` | digest `sha256:7b822b0aac60967beb1ea5e576b8602c94c300a157d187f385ae3e0da199b90a` (2026-10-25) |
| `npm view pg version` | 8.23.1 (2026-10-25) |

Hashes dos lock files: `package-lock.json` sha256 d5a4ce3a52967ef4ea6b79dca0ca560b115683e24e50f9b84a565b01f146fa40; `py/uv.lock` sha256 e7583ee3b3ea1e36764d8a065a280b44aab97824b4b5389e282927cbd6c14871.

Não executado: `make lint/test/build` (a PoC não está nos workspaces; linters não existem — FND-002); validação de links por ferramenta (conferidos por leitura); testes de roles/ACL por tenant; carga com dados reais ou volume (proibido/fora de escopo).

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- Sem impacto em produção ou nos workspaces. Dependências novas apenas dentro da pasta da PoC, com lock file. `node_modules` e `.venv` são ignorados pelo `.gitignore`.
- Riscos: medidas feitas com bancos vazios, `fsync=off` e tmpfs; sem TLS, roles por tenant e PgBouncer. Runner é protótipo, não código de produção.
- Rollback: reverter o commit; o container já foi destruído.

## 8. Commits e diffs

- Início: branch `tarefa/dec-003`, `HEAD` `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, árvore limpa, base idem.
- Commit inicial da tarefa, já existente: `45eb1465ee43fc27f8739edcbee19a64fe123932`, `docs(dados): ADR-017 e PoC de migrations multi-database (DEC-003)`.
- Correção da rodada 1: um commit adicional (sem amend) em `tarefa/dec-003`, mensagem `fix(dados): lint de transacao no runner e exemplo executavel (DEC-003 rodada 1)`. Seu SHA não pode constar dentro do próprio commit; é informado no relatório de integração e conferível por `git log -2`.
- Correção da rodada 2: um segundo commit adicional (sem amend), mensagem `fix(dados): tokenizador no lint de transacao e defesa xact_start (DEC-003 rodada 2)`; SHA informado no relatório de integração (`git log -3`).
- Diffs de código, migrations e configuração (commit inicial e correções das rodadas 1 e 2): [arquivo de diffs](2026-10-25-dec-003-acesso-a-dados-e-migrations-diffs.md). Lock files, evidência e documentos de registro não têm diff textual incluído (regra anti-recursão); estão listados na seção 4.

## 9. Lessons

- [00 - Migracoes SQL forward-only no PostgreSQL](../../lessons/00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md) e [índice](../../lessons/README.md). A numeração `00` pode ser recalculada na integração com lessons de outras tarefas.

## 10. Pendências

1. Decisão humana: aceitar ADR-017 (AC-1 só se cumpre com isso), Kysely x Drizzle, runner próprio x ferramenta pronta, concorrência padrão e política de tenant falho.
2. Teste de roles/ACL por tenant e identidade de migração com privilégio mínimo (DAT-002/DAT-003).
3. `CREATE INDEX CONCURRENTLY` não suportado pelo runner da PoC.

## 11. Correção rodada 1 (auditoria [2026-10-25-auditoria-dec-003](../reviews/2026-10-25-auditoria-dec-003.md))

Aplicadas somente as decisões APLICAR do auditor:

- **REVIEW-001 (MEDIO):** `assertTransactional` em `runner.mjs`, chamada em `migrateTenant` antes de abrir conexão. Rejeita `BEGIN`/`START`/`COMMIT`/`END`/`ROLLBACK`/`ABORT`/`SAVEPOINT`/`RELEASE`/`PREPARE`, `CONCURRENTLY` e `VACUUM` no nível de statement, após remover comentários, literais, identificadores entre aspas e corpos `$$`; `CASE ... END` e `BEGIN/END` de funções não geram falso positivo. Sem escape. Limite: textual, não vê SQL dinâmico. Testes no cenário H de `poc.mjs`: H1 (`COMMIT` interno e demais comandos rejeitados antes de executar, nada criado, versão ausente, sem falso positivo) e H2 (erro SQL real `1/0` no 2º statement: rollback total, retomada com migration corrigida). ADR-017 e procedimento deixam de afirmar rollback incondicional.
- **REVIEW-002 (MEDIO):** exemplo da lesson autossuficiente (cria banco e `schema_migrations`, `try/ROLLBACK`, `docker run` descartável em 127.0.0.1 com senha aleatória). Executado do zero em container novo (`pgvector/pgvector:pg16`, porta 55433, Node 24.22.1, `pg` 8.23.1): saída `[ { version: '0001', name: 'exemplo' } ]`, rc 0, e rc 0 na segunda execução; container destruído. Pré-requisito Docker reescrito apontando que a lesson de Docker ainda não existe (bloco 4 do índice); nenhuma lesson artificial criada.
- **REVIEW-003a (BAIXO):** `provision()` chama `assertDbName` antes de `escapeIdentifier`/`DROP DATABASE`; teste H3 (nome malicioso lança antes de qualquer SQL).
- **REVIEW-006 (BAIXO):** textos "nenhum commit existe ainda"/"será criado" corrigidos; tempos como faixa de execuções locais; caso de erro SQL real coberto (H2).
- **ADIADOS (registrados no ADR-017, seção "Requisitos adiados para o runner de produção (DAT-002)"):** REVIEW-003b (ganchos `failAfter`/`holdMs`, retomada DAT-002), REVIEW-004 (`ROLLBACK` mascara causa, DAT-002), REVIEW-005 (checksum sobre bytes e `.gitattributes` `eol=lf`, DAT-002 ou primeiro contribuidor Windows), REVIEW-007 (digest da imagem quando o Postgres entrar em CI, FND-*/DAT-*). Nenhum deles foi alterado em código.
- **Fora desta correção:** renumeração da lesson (colisão do `00` com DEC-002) é ação do coordenador na integração; a lesson segue `00` aqui.
- **Validação:** `run.sh` completo, Node v24.22.1, exit 0: todas as asserções (A–H) passaram, `check_tenant.py` OK em 2 bancos, container destruído (`docker ps -a --filter name=dec003` vazio). `saida-poc.txt` regenerada com essa execução (nesta execução: sequencial 1564 ms, concorrência 4 419 ms). Revalidação independente ainda pendente.
- **Arquivos tocados:** `runner.mjs`, `poc.mjs`, `evidencia/saida-poc.txt`, ADR-017, procedimento, lesson 00, esta entrega e o arquivo de diffs. `lessons/README.md` não mudou (texto de pré-requisito está só na lesson).
- **Lesson atualizada:** [00 - Migracoes SQL forward-only no PostgreSQL](../../lessons/00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md).

## 12. Correção rodada 2 (auditoria [2026-10-25-auditoria-r2-dec-003-dec-004](../reviews/2026-10-25-auditoria-r2-dec-003-dec-004.md), NOVO-003-A / REVIEW-001)

Problema real: o lint da rodada 1 removia comentários por regex antes de literais, identificadores e dollar-quote. Cinco variantes (`'-- x'`, `'/*'`/`'*/'`, `"--"`, `$$--$$`, `E'\''`) escondiam um `COMMIT` e eram aprovadas; fim a fim, `b1` persistia e `schema_migrations` ficava vazia (reproduzido pelo auditor).

- **Tokenizador de uma passada** (`stripSql` em `runner.mjs`, usado por `assertTransactional`): comentários `--` e `/* */` aninhados, `'...'` com `''` e, para `E'...'`, `\`; `"..."` com `""`; `$tag$...$tag$` só fora de identificador (`$1` não abre); literal, comentário ou dollar-quote não terminado lança erro (fail-closed). `SET standard_conforming_strings` é rejeitado.
- **Defesa em profundidade:** `migrateTenant` lê `xact_start` de `pg_stat_activity` após o `BEGIN` e após o SQL; se mudou, lança erro e não registra a versão. **Só detecta**: o `COMMIT` interno já ocorreu (o teste confirma que `b1` permanece). Para testar, `migrateTenant` aceita a opção `lint` (injetável; padrão `assertTransactional`), usada apenas para contornar o lint no teste.
- **Testes (`poc.mjs`, cenário H1b):** as cinco variantes, comentário aninhado `/* /* */ */ ;` e `SET standard_conforming_strings` rejeitados; fim a fim no Postgres, a variante `'-- x'` é rejeitada antes de executar, `b1` ausente e nenhuma versão registrada; casos legítimos (`/* /* */ COMMIT; */`, `E'a\'b; COMMIT'`, `'it''s; COMMIT'`, `$a$ COMMIT; $a$`, `"x"" COMMIT;"`, `foo$$bar`) não geram falso positivo; cinco construtos não terminados rejeitados; `xact_start` detecta o `COMMIT` interno com o lint contornado e a versão não é registrada. Os demais casos de H1/H2/H3 foram mantidos.
- **Documentado, não corrigido:** `standard_conforming_strings=off` (por `set_config`/`ALTER ROLE`) e SQL dinâmico (`DO`/`EXECUTE`) fora do alcance do lint, gate é a revisão; falso positivo de `concurrently`/`vacuum` como nome de coluna mantido (decisão REJEITAR do auditor). ADR-017 segue **Proposto**; ADR, procedimento e lesson 00 atualizados (numeração da lesson não alterada).
- **Validação:** `./run.sh` completo (Node v24.22.1, Docker descartável em 127.0.0.1, container destruído; `docker ps -a --filter name=dec003` vazio): exit 0, todas as asserções A–H e H1b passaram, `check_tenant.py` OK em 2 bancos. `evidencia/saida-poc.txt` regenerada. Não executado: `make lint/test/build` (não existem para a PoC). Revalidação independente (rodada 3, última) pendente.
- **Arquivos tocados:** `runner.mjs`, `poc.mjs`, `evidencia/saida-poc.txt`, ADR-017, procedimento, lesson 00, esta entrega e o arquivo de diffs.

## 13. Correção rodada 3 (última; revalidação [2026-10-25-revalidacao-dec-003-r2](../reviews/2026-10-25-revalidacao-dec-003-r2.md), REVIEW-001 ainda presente)

Problema real: a revalidação confirmou em Postgres real dois bypasses restantes do tokenizador, ambos deixando `b1` persistida e nenhuma versão registrada: (1) o PostgreSQL encerra o comentário `--` em `\n` **ou** `\r` isolado, mas `stripSql` só parava em `\n`, então `-- x\rCOMMIT;` era tratado como comentário; (2) a tag de dollar-quote era procurada numa janela de 80 caracteres (`slice(i, i + 80)`), então tags com 79 ou mais caracteres não casavam, o `$` virava texto e uma aspa interna desincronizava o tokenizador (a fronteira real era 79; a tag com 78 já era rejeitada por acaso). Eu reproduzi ambos com o código anterior (o lint aprovava os dois SQLs) antes de corrigir.

- **`runner.mjs`:** o ramo `--` agora para em `\n` ou `\r`; `DOLLAR_TAG` virou regex sticky (`/y`) casada a partir de `lastIndex` na string inteira, sem janela nem limite de tamanho (tag válida = identificador sem `$`, como no PostgreSQL).
- **Revisão por leitura de outros limites arbitrários no tokenizador:** nenhum outro encontrado. Os demais laços (`'...'`, `"..."`, `/* */`, escape `E'...'`) não têm janela nem contador; a única janela era a do dollar-quote. O prefixo `E` olha só `sql[i-1]`/`sql[i-2]`, o que é regra lexical (não limite de tamanho). Terminadores de linha: o PostgreSQL só trata `\n` e `\r` como fim de `--`; não há outro (form feed e demais não encerram). Não alterado: `standard_conforming_strings=off` via `set_config`/`ALTER ROLE` e SQL dinâmico seguem como limites declarados (gate = revisão humana).
- **Testes (`poc.mjs`, H1b):** fim a fim no Postgres, `CREATE TABLE b1; -- x\rCOMMIT; CREATE TABLE b2; SELECT 1/0;` e as tags de 78, 79, 80 e 200 caracteres contendo aspa interna seguida de `COMMIT` (com erro final `1/0`) são rejeitadas por `migrateTenant` antes de executar: `b1` ausente e nenhuma versão registrada, além da checagem unitária de `assertTransactional`. Sem falso positivo: `-- COMMIT` terminado por `\r\n` e por `\r` isolado, `COMMIT` dentro de dollar-quote de tag 200, tags 79/80 corretamente fechadas; tags longas não fechadas são rejeitadas como não terminadas.
- **Validação:** `./run.sh` completo (Node v24.22.1, Docker descartável em 127.0.0.1, container destruído): exit 0, todas as asserções A-H e H1b passaram, `check_tenant.py` OK em 2 bancos. `evidencia/saida-poc.txt` regenerada. Não executado: `make lint/test/build` (não existem para a PoC). Honestamente: o lint continua textual e o fuzz da revalidação só cobre as classes já conhecidas; ainda pode haver divergência lexical não descoberta, por isso o ADR mantém a revisão humana como gate e o status **Proposto**.
- **Commit:** um novo commit (sem amend) sobre `be7211a`, mensagem `fix(dados): comentario -- termina em \r e dollar-quote sem limite de tag (DEC-003 rodada 3)`; SHA no relatório de integração (`git log -1`).
- **Arquivos tocados:** `runner.mjs`, `poc.mjs`, `evidencia/saida-poc.txt`, ADR-017, procedimento, lesson 00 (sem renumerar), esta entrega e o arquivo de diffs.
