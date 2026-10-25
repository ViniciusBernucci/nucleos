# Migracoes SQL forward-only no PostgreSQL (multi-database)

Criada em 2026-10-25. Ultima atualizacao: 2026-10-25 (correcao rodada 3: fim do comentario -- em \r e dollar-quote sem limite de tag; rodada 2: lint por tokenizador e defesa xact_start). Exemplos: Node 24.22.1, `pg` 8.23.1, Python 3.13 e `psycopg` 3.3.4, PostgreSQL 16 com pgvector 0.8.7.

## Objetivo, pre-requisitos e posicao na trilha

Entender como versionar o esquema de varios bancos identicos (um por tenant) com arquivos SQL, transacao, advisory lock e checksum. Corresponde ao bloco "PostgreSQL: modelagem, migracoes e consultas" do [indice](README.md). Pre-requisitos: SQL basico, `async/await` em TypeScript e Docker local (a lesson de Docker ainda nao existe; ver bloco 4 do [indice](README.md); por ora basta saber rodar `docker run`).

## Modelo mental

Cada banco guarda seu proprio diario (`schema_migrations`): "quais arquivos ja apliquei e com que impressao digital". O runner le a pasta, compara com o diario e aplica so o que falta, em ordem. Reverter nao e "desfazer": e escrever uma migration nova que corrige.

## Exemplo minimo

Autossuficiente: sobe um PostgreSQL descartavel, cria o banco do tenant, o diario e aplica uma migration. Foi executado do zero (duas vezes seguidas) contra um container novo em Node 24.22.1 e `pg` 8.23.1 (use `npm install pg@8.23.1`).

```bash
export PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"   # senha aleatoria, so desta sessao
export PGPORT=55433
docker run -d --name exemplo-pg -p 127.0.0.1:$PGPORT:5432 -e POSTGRES_PASSWORD="$PGPASSWORD" \
  --tmpfs /var/lib/postgresql/data postgres:16     # ou pgvector/pgvector:pg16, usado na PoC
# aguarde `docker exec exemplo-pg pg_isready -U postgres -h 127.0.0.1` responder; rode `node exemplo.mjs`
# ao terminar: docker rm -f exemplo-pg
```

```ts
// exemplo.mjs
import pg from 'pg';
import { createHash } from 'node:crypto';

const base = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'postgres', password: process.env.PGPASSWORD };

// 1) cria um banco de tenant descartavel (conexao administrativa)
const admin = new pg.Client({ ...base, database: 'postgres' });
await admin.connect();
await admin.query('DROP DATABASE IF EXISTS exemplo_tenant WITH (FORCE)');
await admin.query('CREATE DATABASE exemplo_tenant');
await admin.end();

// 2) aplica UMA migration: SQL + registro no diario, na mesma transacao
const client = new pg.Client({ ...base, database: 'exemplo_tenant' });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY, name text NOT NULL, checksum char(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(), execution_ms integer NOT NULL)`);
const sql = 'CREATE TABLE exemplo (id uuid PRIMARY KEY)';
const checksum = createHash('sha256').update(sql).digest('hex');
await client.query('BEGIN');
try {
  await client.query(sql);
  await client.query(
    'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, 0)',
    ['0001', 'exemplo', checksum],
  );
  await client.query('COMMIT'); // SQL e registro entram juntos ou nenhum entra
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
}
console.log((await client.query('SELECT version, name FROM schema_migrations')).rows);
await client.end();
```

Saida esperada: `[ { version: '0001', name: 'exemplo' } ]`. O exemplo ignora o que o runner da PoC faz a mais (lock, comparacao de checksum, varias migrations); veja a proxima secao.

## Padrao do projeto (da PoC)

Veja `migrateTenant` e `migrateBatch` em [`runner.mjs`](../documentacoes/arquitetura/poc/dec-003/runner.mjs): `pg_try_advisory_lock` por database, uma conexao curta por tenant, checksum SHA-256, lote fail-fast e retomada pelo mesmo comando. `assertTransactional` rejeita, antes de executar, migrations com `BEGIN`/`COMMIT`/`END`/`ROLLBACK`/`SAVEPOINT`, `CONCURRENTLY` ou `VACUUM`: um `COMMIT` dentro do arquivo encerraria a transacao do runner e deixaria a migration meio aplicada e sem registro (o tenant ficaria preso). Ele usa `stripSql`, um tokenizador de uma passada: uma regex em cadeia que remove comentarios antes dos literais erra, porque `SELECT '-- x'; COMMIT;` perderia o `COMMIT` junto com um falso comentario. O tokenizador varre da esquerda para a direita e o primeiro construto que abre manda: `--` ate o fim da linha, `/* */` aninhado (como o PostgreSQL), `'...'` (com `''`; `E'...'` tambem com `\`), `"..."` e `$tag$...$tag$` (so fora de identificador; `$1` e parametro). Construto nao terminado e rejeitado (fail-closed). Limites: assume `standard_conforming_strings=on`; nao enxerga SQL dinamico (`DO`/`EXECUTE`, `set_config`); coluna chamada `vacuum`/`concurrently` da falso positivo. Defesa em profundidade: o runner compara `xact_start` (`pg_stat_activity`) antes e depois do SQL e, se mudou, nao registra a versao; isso so detecta (o `COMMIT` interno ja ocorreu), a prevencao e o lint mais a revisao. Identificadores (nomes de banco) so por allowlist + `escapeIdentifier`; valores sempre por parametros (`$1`). No Python use `psycopg.sql.Identifier` para identificadores. Decisao e evidencias: [ADR-017](../documentacoes/arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md) e [entrega DEC-003](../documentacoes/dados/2026-10-25-dec-003-acesso-a-dados-e-migrations.md).

## Erros comuns e quando nao se aplica

- Editar migration ja aplicada (o checksum acusa; crie uma nova).
- Interpolar nome vindo de entrada externa em `CREATE DATABASE`/`SELECT ... FROM`.
- Usar `CREATE INDEX CONCURRENTLY` ou `VACUUM` dentro da transacao do runner (nao funciona; o runner da PoC os rejeita; exigem fluxo proprio, fora de escopo).
- Escrever `COMMIT`/`BEGIN` no arquivo da migration (rejeitado pelo lint do runner).
- Tratar comentarios como removiveis por regex antes de literais: `'-- x'` e `$$--$$` contem `--` sem ser comentario (use um tokenizador de uma passada).
- Copiar so parte das regras lexicais do servidor: no PostgreSQL o comentario `--` termina em `\n` **ou** `\r` isolado, e a tag de dollar-quote nao tem limite de tamanho. Qualquer limite arbitrario (por exemplo, olhar so 80 caracteres a frente) vira bypass: o lint aprova e o servidor executa `COMMIT`. Confirme cada regra contra o servidor real e teste os valores de fronteira (78, 79, 80, 200).
- Confiar no lint contra SQL dinamico ou `standard_conforming_strings=off`: nao cobre; a revisao humana e o gate.
- Advisory lock de sessao com pooler em modo transacao (o lock se perde).
- Nao se aplica quando ha um unico banco pequeno e uma ferramenta pronta ja atende.

## Verificacao e exercicios

Rode `documentacoes/arquitetura/poc/dec-003/run.sh` (cria e destroi um container local); o cenario H de `poc.mjs` cobre `COMMIT` interno, erro SQL real e nome fora da allowlist. Exercicios: (1) adicione `0004` com uma coluna nula e confirme que a segunda execucao nao aplica nada; (2) altere uma letra em `0001` e observe o erro; (3) escreva a migration que remove a coluna do item 1 por roll-forward.
