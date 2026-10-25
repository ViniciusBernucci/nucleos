# Migracoes SQL forward-only no PostgreSQL (multi-database)

Criada em 2026-10-25. Ultima atualizacao: 2026-10-25. Exemplos: Node 24.22.1, `pg` 8.23.1, Python 3.13 e `psycopg` 3.3.4, PostgreSQL 16 com pgvector 0.8.7.

## Objetivo, pre-requisitos e posicao na trilha

Entender como versionar o esquema de varios bancos identicos (um por tenant) com arquivos SQL, transacao, advisory lock e checksum. Corresponde ao bloco "PostgreSQL: modelagem, migracoes e consultas" do [indice](README.md). Pre-requisitos: SQL basico, `async/await` em TypeScript e uso de Docker local.

## Modelo mental

Cada banco guarda seu proprio diario (`schema_migrations`): "quais arquivos ja apliquei e com que impressao digital". O runner le a pasta, compara com o diario e aplica so o que falta, em ordem. Reverter nao e "desfazer": e escrever uma migration nova que corrige.

## Exemplo minimo

```ts
import pg from 'pg';
import { createHash } from 'node:crypto';

const client = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres', password: process.env.PGPASSWORD, database: 'poc_tenant_01' });
await client.connect();
const sql = 'CREATE TABLE exemplo (id uuid PRIMARY KEY)';
const checksum = createHash('sha256').update(sql).digest('hex');
await client.query('BEGIN');
await client.query(sql);
await client.query('INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1,$2,$3,0)', ['0001', 'exemplo', checksum]);
await client.query('COMMIT'); // SQL e registro entram juntos ou nenhum entra
await client.end();
```

## Padrao do projeto (da PoC)

Veja `migrateTenant` e `migrateBatch` em [`runner.mjs`](../documentacoes/arquitetura/poc/dec-003/runner.mjs): `pg_try_advisory_lock` por database, uma conexao curta por tenant, checksum SHA-256, lote fail-fast e retomada pelo mesmo comando. Identificadores (nomes de banco) so por allowlist + `escapeIdentifier`; valores sempre por parametros (`$1`). No Python use `psycopg.sql.Identifier` para identificadores. Decisao e evidencias: [ADR-017](../documentacoes/arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md) e [entrega DEC-003](../documentacoes/dados/2026-10-25-dec-003-acesso-a-dados-e-migrations.md).

## Erros comuns e quando nao se aplica

- Editar migration ja aplicada (o checksum acusa; crie uma nova).
- Interpolar nome vindo de entrada externa em `CREATE DATABASE`/`SELECT ... FROM`.
- Usar `CREATE INDEX CONCURRENTLY` dentro da transacao do runner (nao funciona; exige tratamento proprio).
- Advisory lock de sessao com pooler em modo transacao (o lock se perde).
- Nao se aplica quando ha um unico banco pequeno e uma ferramenta pronta ja atende.

## Verificacao e exercicios

Rode `documentacoes/arquitetura/poc/dec-003/run.sh` (cria e destroi um container local). Exercicios: (1) adicione `0004` com uma coluna nula e confirme que a segunda execucao nao aplica nada; (2) altere uma letra em `0001` e observe o erro; (3) escreva a migration que remove a coluna do item 1 por roll-forward.
