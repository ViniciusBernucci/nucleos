# DEC-003 diffs — 2026-10-25

Diffs da tarefa (PoC: código, migrations e configuração). Entrega: [DEC-003](2026-10-25-dec-003-acesso-a-dados-e-migrations.md). Excluídos por regra: `documentacoes/` de registro e `lessons/`, `saida-poc.txt`, `schema-snapshot.json` e os lock files (hashes na entrega). Os diffs abaixo (até a seção Correção rodada 1) correspondem ao commit inicial da tarefa (`45eb146`, `docs(dados): ADR-017 e PoC de migrations multi-database (DEC-003)`), que contém exatamente estes arquivos mais os documentos listados na entrega; o SHA não pode constar dentro do próprio commit e é informado no relatório de integração (conferível por `git log`). A correção da rodada 1 é um commit adicional, com o diff real ao final deste arquivo.

```diff
diff --git a/documentacoes/arquitetura/poc/dec-003/migrations/0001_base.up.sql b/documentacoes/arquitetura/poc/dec-003/migrations/0001_base.up.sql
new file mode 100644
index 0000000..308f954
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/migrations/0001_base.up.sql
@@ -0,0 +1,16 @@
+-- 0001: tabelas base do tenant (convencoes ADR-017: uuid PK, timestamptz, numeric, text+CHECK).
+CREATE TABLE agente (
+    id         uuid PRIMARY KEY,
+    nome       text NOT NULL,
+    status     text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'pausado')),
+    criado_em  timestamptz NOT NULL DEFAULT now()
+);
+
+CREATE TABLE uso_tokens (
+    id          uuid PRIMARY KEY,
+    agente_id   uuid NOT NULL REFERENCES agente (id),
+    tokens      integer NOT NULL CHECK (tokens >= 0),
+    custo_usd   numeric(18, 8) NOT NULL CHECK (custo_usd >= 0),
+    criado_em   timestamptz NOT NULL DEFAULT now()
+);
+CREATE INDEX uso_tokens_agente_criado_idx ON uso_tokens (agente_id, criado_em);
diff --git a/documentacoes/arquitetura/poc/dec-003/migrations/0002_documento_vetor.up.sql b/documentacoes/arquitetura/poc/dec-003/migrations/0002_documento_vetor.up.sql
new file mode 100644
index 0000000..1b2624a
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/migrations/0002_documento_vetor.up.sql
@@ -0,0 +1,9 @@
+-- 0002: memoria semantica. Requer a extensao "vector" criada pelo provisioner (admin).
+CREATE TABLE documento (
+    id         uuid PRIMARY KEY,
+    titulo     text NOT NULL,
+    conteudo   text NOT NULL,
+    embedding  vector(3),
+    criado_em  timestamptz NOT NULL DEFAULT now()
+);
+CREATE INDEX documento_embedding_hnsw_idx ON documento USING hnsw (embedding vector_cosine_ops);
diff --git a/documentacoes/arquitetura/poc/dec-003/migrations/0003_documento_busca_texto.up.sql b/documentacoes/arquitetura/poc/dec-003/migrations/0003_documento_busca_texto.up.sql
new file mode 100644
index 0000000..6f50afa
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/migrations/0003_documento_busca_texto.up.sql
@@ -0,0 +1,6 @@
+-- 0003: busca textual (expand): coluna gerada tsvector + GIN. Aditiva, compativel com codigo anterior.
+ALTER TABLE documento
+    ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
+        to_tsvector('portuguese', coalesce(titulo, '') || ' ' || coalesce(conteudo, ''))
+    ) STORED;
+CREATE INDEX documento_tsv_gin_idx ON documento USING gin (tsv);
diff --git a/documentacoes/arquitetura/poc/dec-003/package.json b/documentacoes/arquitetura/poc/dec-003/package.json
new file mode 100644
index 0000000..89b337d
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/package.json
@@ -0,0 +1,10 @@
+{
+  "name": "dec-003-poc-migrations",
+  "version": "0.0.0",
+  "private": true,
+  "type": "module",
+  "description": "PoC descartavel DEC-003: runner de migrations multi-database. Nao e codigo de producao.",
+  "engines": { "node": ">=24.22.1" },
+  "dependencies": { "pg": "8.23.1" },
+  "scripts": { "poc": "node poc.mjs" }
+}
diff --git a/documentacoes/arquitetura/poc/dec-003/poc.mjs b/documentacoes/arquitetura/poc/dec-003/poc.mjs
new file mode 100644
index 0000000..7918983
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/poc.mjs
@@ -0,0 +1,156 @@
+// Cenarios da PoC DEC-003. Requer PGHOST=127.0.0.1, PGPORT, PGUSER, PGPASSWORD (container descartavel).
+import assert from 'node:assert/strict';
+import { writeFileSync } from 'node:fs';
+import { randomUUID } from 'node:crypto';
+import pg from 'pg';
+import { appliedVersions, connect, loadMigrations, migrateBatch, migrateTenant } from './runner.mjs';
+
+const base = { host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD };
+assert.equal(base.host, '127.0.0.1', 'PoC so roda contra 127.0.0.1');
+const N = 20;
+const dbs = Array.from({ length: N }, (_, i) => `poc_tenant_${String(i + 1).padStart(2, '0')}`);
+const migrations = loadMigrations(new URL('./migrations', import.meta.url).pathname);
+const ms = (x) => `${x.toFixed(0)}ms`;
+const log = (...a) => console.log(...a);
+
+async function admin(fn) {
+  const c = new pg.Client({ ...base, database: 'postgres' });
+  await c.connect();
+  try { return await fn(c); } finally { await c.end(); }
+}
+// Provisioner (admin): cria database e extensao. Identificadores via allowlist + escapeIdentifier.
+async function provision(names) {
+  await admin(async (c) => {
+    for (const n of names) {
+      const id = c.escapeIdentifier(n);
+      await c.query(`DROP DATABASE IF EXISTS ${id} WITH (FORCE)`);
+      await c.query(`CREATE DATABASE ${id}`);
+    }
+  });
+  for (const n of names) {
+    const c = connect(base, n);
+    await c.connect();
+    await c.query('CREATE EXTENSION IF NOT EXISTS vector');
+    await c.end();
+  }
+}
+const versionsOf = async () => Object.fromEntries(await Promise.all(dbs.map(async (d) => [d, (await appliedVersions(base, d)).join(',') || '-'])));
+const summarize = (v) => {
+  const g = {};
+  for (const [d, s] of Object.entries(v)) (g[s] ??= []).push(d.slice(-2));
+  return Object.entries(g).map(([s, l]) => `  versoes[${s}] -> bancos ${l.join(' ')}`).join('\n');
+};
+
+log(`migrations: ${migrations.map((m) => `${m.file} sha256=${m.checksum.slice(0, 12)}`).join(' | ')}`);
+
+// ---- Cenario A: falha induzida no banco 12 + retomada ----
+await provision(dbs);
+log('\n[A1] lote sequencial com falha induzida no banco 12 (apos 0002, antes do COMMIT)');
+const a1 = await migrateBatch(base, dbs, migrations, { concurrency: 1, failAt: { poc_tenant_12: '0002' } });
+log(`  tempo=${ms(a1.ms)} ok=${a1.results.length} falhas=${JSON.stringify(a1.failed)} nao_iniciados=${a1.notStarted.length}`);
+const afterFail = await versionsOf();
+log(summarize(afterFail));
+assert.equal(a1.failed.length, 1);
+assert.equal(a1.failed[0].database, 'poc_tenant_12');
+assert.equal(afterFail.poc_tenant_12, '0001', 'banco 12 manteve 0001 e reverteu 0002 inteira');
+assert.equal(afterFail.poc_tenant_11, '0001,0002,0003');
+assert.equal(afterFail.poc_tenant_13, '-', 'bancos posteriores nao tocados (fail-fast)');
+{ // 0002 realmente revertida no banco 12 (nenhuma tabela documento)
+  const c = connect(base, 'poc_tenant_12'); await c.connect();
+  const r = await c.query("SELECT to_regclass('documento') AS t"); await c.end();
+  assert.equal(r.rows[0].t, null);
+}
+log('[A2] retomada: mesmo comando, sem falha');
+const a2 = await migrateBatch(base, dbs, migrations, { concurrency: 1 });
+log(`  tempo=${ms(a2.ms)} ok=${a2.results.length} falhas=${a2.failed.length}`);
+const r12 = a2.results.find((r) => r.database === 'poc_tenant_12');
+const r11 = a2.results.find((r) => r.database === 'poc_tenant_11');
+log(`  banco 12 aplicou=[${r12.applied}] pulou=${r12.skipped}; banco 11 aplicou=[${r11.applied}] pulou=${r11.skipped}`);
+const afterResume = await versionsOf();
+log(summarize(afterResume));
+assert.deepEqual(r12.applied, ['0002', '0003']);
+assert.deepEqual(r11.applied, []);
+assert.ok(Object.values(afterResume).every((v) => v === '0001,0002,0003'));
+
+// ---- Cenario B: idempotencia ----
+const b = await migrateBatch(base, dbs, migrations, { concurrency: 1 });
+log(`\n[B] reexecucao idempotente: tempo=${ms(b.ms)} aplicadas=${b.results.reduce((s, r) => s + r.applied.length, 0)}`);
+assert.equal(b.results.reduce((s, r) => s + r.applied.length, 0), 0);
+
+// ---- Cenario C: checksum alterado ----
+{
+  const tampered = migrations.map((m) => (m.version === '0002' ? { ...m, checksum: 'f'.repeat(64) } : m));
+  await assert.rejects(() => migrateTenant(base, dbs[0], tampered), /checksum divergente/);
+  log('[C] checksum divergente rejeitado (migration aplicada nao pode ser editada)');
+}
+
+// ---- Cenario D: advisory lock entre dois runners no mesmo banco ----
+{
+  await provision(['poc_tenant_lock']);
+  const t0 = performance.now();
+  const [x, y] = await Promise.all([
+    migrateTenant(base, 'poc_tenant_lock', migrations, { holdMs: 150 }),
+    migrateTenant(base, 'poc_tenant_lock', migrations, { holdMs: 150 }),
+  ]);
+  const total = x.applied.length + y.applied.length;
+  const c = connect(base, 'poc_tenant_lock'); await c.connect();
+  const rows = (await c.query('SELECT version FROM schema_migrations ORDER BY 1')).rows.length; await c.end();
+  log(`[D] 2 runners concorrentes no mesmo banco: aplicadas runner1=[${x.applied}] runner2=[${y.applied}] total=${total} linhas_schema_migrations=${rows} (${ms(performance.now() - t0)})`);
+  assert.equal(total, 3);
+  assert.equal(rows, 3);
+}
+
+// ---- Cenario E: compatibilidade pgvector / tsvector ----
+{
+  const c = connect(base, dbs[0]); await c.connect();
+  const ver = (await c.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0].extversion;
+  const srv = (await c.query('SHOW server_version')).rows[0].server_version;
+  const docs = [
+    ['Contrato de locacao', 'contrato de aluguel de imovel comercial', '[1,0,0]'],
+    ['Receita de bolo', 'bolo de cenoura com cobertura de chocolate', '[0,1,0]'],
+    ['Manual do agente', 'configuracao de agentes de atendimento', '[0,0,1]'],
+    ['Locacao residencial', 'alugueis residenciais e garantias', '[0.9,0.1,0]'],
+  ];
+  for (const [t, ct, e] of docs) await c.query('INSERT INTO documento (id, titulo, conteudo, embedding) VALUES ($1,$2,$3,$4)', [randomUUID(), t, ct, e]);
+  await c.query('SET enable_seqscan = off');
+  const hnswPlan = (await c.query("EXPLAIN SELECT titulo FROM documento ORDER BY embedding <=> '[1,0,0]' LIMIT 2")).rows.map((r) => r['QUERY PLAN']).join(' | ');
+  const top = (await c.query("SELECT titulo FROM documento ORDER BY embedding <=> $1 LIMIT 2", ['[1,0,0]'])).rows.map((r) => r.titulo);
+  await c.query('CREATE INDEX tmp_ivf ON documento USING ivfflat (embedding vector_l2_ops) WITH (lists = 1)');
+  await c.query('DROP INDEX documento_embedding_hnsw_idx');
+  const ivfPlan = (await c.query("EXPLAIN SELECT titulo FROM documento ORDER BY embedding <-> '[1,0,0]' LIMIT 2")).rows.map((r) => r['QUERY PLAN']).join(' | ');
+  const ftsPlan = (await c.query("EXPLAIN SELECT titulo FROM documento WHERE tsv @@ websearch_to_tsquery('portuguese','aluguel')")).rows.map((r) => r['QUERY PLAN']).join(' | ');
+  const fts = (await c.query("SELECT titulo FROM documento WHERE tsv @@ websearch_to_tsquery('portuguese','aluguel') ORDER BY titulo")).rows.map((r) => r.titulo);
+  await c.end();
+  log(`[E] postgres=${srv} pgvector=${ver}`);
+  log(`  HNSW  plano: ${hnswPlan}`);
+  log(`  IVFFlat plano: ${ivfPlan}`);
+  log(`  GIN/tsvector plano: ${ftsPlan}`);
+  log(`  vizinhos(cosseno)=${JSON.stringify(top)} busca_texto('aluguel')=${JSON.stringify(fts)}`);
+  assert.match(hnswPlan, /documento_embedding_hnsw_idx/);
+  assert.match(ivfPlan, /tmp_ivf/);
+  assert.match(ftsPlan, /documento_tsv_gin_idx/);
+  assert.deepEqual(top, ['Contrato de locacao', 'Locacao residencial']);
+  assert.deepEqual(fts, ['Contrato de locacao']); // "alugueis" nao e mesmo lexema de "aluguel" no stemmer: documenta o limite
+}
+
+// ---- Snapshot de esquema (fonte unica: SQL) para conformidade Python ----
+{
+  const c = connect(base, dbs[1]); await c.connect();
+  const r = await c.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable FROM information_schema.columns
+    WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
+  await c.end();
+  writeFileSync(new URL('./evidencia/schema-snapshot.json', import.meta.url), JSON.stringify(r.rows, null, 1) + '\n');
+  log(`[F] snapshot de esquema gerado a partir do SQL: ${r.rows.length} colunas`);
+}
+
+// ---- Cenario G: tempos limpos, sequencial vs concorrencia 4 ----
+log('\n[G] medicao de tempo (20 bancos novos, 3 migrations cada)');
+for (const conc of [1, 4]) {
+  await provision(dbs);
+  const g = await migrateBatch(base, dbs, migrations, { concurrency: conc });
+  const per = g.results.map((r) => r.ms);
+  log(`  concorrencia=${conc}: total=${ms(g.ms)} por_banco_medio=${ms(per.reduce((a, b) => a + b, 0) / per.length)} max=${ms(Math.max(...per))} falhas=${g.failed.length}`);
+  assert.equal(g.failed.length, 0);
+}
+// deixa 20 bancos migrados para a verificacao Python
+log('\nPoC concluida: todas as asserções passaram.');
diff --git a/documentacoes/arquitetura/poc/dec-003/py/check_tenant.py b/documentacoes/arquitetura/poc/dec-003/py/check_tenant.py
new file mode 100644
index 0000000..87f7c6f
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/py/check_tenant.py
@@ -0,0 +1,43 @@
+"""Acesso do runtime Python ao banco do tenant: psycopg 3 async, SQL explicito, conexao por uso."""
+import asyncio
+import json
+import os
+import pathlib
+
+import psycopg
+from psycopg import sql
+
+SNAPSHOT = json.loads((pathlib.Path(__file__).parent.parent / "evidencia" / "schema-snapshot.json").read_text())
+
+
+async def main() -> None:
+    assert os.environ["PGHOST"] == "127.0.0.1"
+    # nomes de banco vem de allowlist interna; identificadores nunca por f-string
+    for dbname in ("poc_tenant_02", "poc_tenant_07"):
+        async with await psycopg.AsyncConnection.connect(dbname=dbname) as conn:
+            cur = await conn.execute("SELECT version FROM schema_migrations ORDER BY version")
+            versions = [r[0] for r in await cur.fetchall()]
+            assert versions == ["0001", "0002", "0003"], versions
+            cur = await conn.execute(
+                "SELECT table_name, column_name, data_type, udt_name, is_nullable FROM information_schema.columns "
+                "WHERE table_schema='public' ORDER BY table_name, ordinal_position"
+            )
+            cols = [dict(zip(("table_name", "column_name", "data_type", "udt_name", "is_nullable"), r)) for r in await cur.fetchall()]
+            assert cols == SNAPSHOT, "esquema Python diverge do snapshot gerado a partir do SQL"
+            await conn.execute(
+                "INSERT INTO documento (id, titulo, conteudo, embedding) VALUES (gen_random_uuid(), %s, %s, %s::vector)",
+                ("py", "texto de teste do runtime", "[0,0,1]"),
+            )
+            cur = await conn.execute(
+                "SELECT titulo FROM documento ORDER BY embedding <=> %s::vector LIMIT 1", ("[0,0,1]",)
+            )
+            assert (await cur.fetchone())[0] == "py"
+            cur = await conn.execute(
+                sql.SQL("SELECT count(*) FROM {t} WHERE tsv @@ websearch_to_tsquery('portuguese', %s)").format(t=sql.Identifier("documento")),
+                ("teste",),
+            )
+            assert (await cur.fetchone())[0] == 1
+            print(f"{dbname}: versoes={versions} esquema==snapshot vetor=ok tsvector=ok identificador via sql.Identifier")
+
+
+asyncio.run(main())
diff --git a/documentacoes/arquitetura/poc/dec-003/py/pyproject.toml b/documentacoes/arquitetura/poc/dec-003/py/pyproject.toml
new file mode 100644
index 0000000..b1fada2
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/py/pyproject.toml
@@ -0,0 +1,6 @@
+[project]
+name = "dec-003-poc-python"
+version = "0.0.0"
+description = "PoC descartavel DEC-003: acesso Python (psycopg 3 async) ao banco do tenant."
+requires-python = ">=3.12"
+dependencies = ["psycopg[binary]==3.3.4"]
diff --git a/documentacoes/arquitetura/poc/dec-003/run.sh b/documentacoes/arquitetura/poc/dec-003/run.sh
new file mode 100755
index 0000000..b059a18
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/run.sh
@@ -0,0 +1,20 @@
+#!/usr/bin/env bash
+# Sobe PostgreSQL+pgvector descartavel em 127.0.0.1, roda a PoC e destroi o container (mesmo em erro).
+set -euo pipefail
+cd "$(dirname "$0")"
+export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$HOME/.local/bin:$PATH"
+IMAGE="pgvector/pgvector:pg16"
+NAME="dec003-poc-pg"
+export PGHOST=127.0.0.1 PGPORT="${POC_PORT:-55432}" PGUSER=postgres
+PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"; export PGPASSWORD  # descartavel, nunca impresso
+trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
+docker rm -f "$NAME" >/dev/null 2>&1 || true
+docker run -d --name "$NAME" -p "127.0.0.1:${PGPORT}:5432" -e POSTGRES_PASSWORD="$PGPASSWORD" \
+  --tmpfs /var/lib/postgresql/data "$IMAGE" -c fsync=off >/dev/null
+until docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; do sleep 0.5; done
+sleep 2
+node --version
+npm ci --silent
+node poc.mjs
+(cd py && uv sync --frozen --quiet && uv run --frozen python check_tenant.py)
+echo "container destruido ao sair"
diff --git a/documentacoes/arquitetura/poc/dec-003/runner.mjs b/documentacoes/arquitetura/poc/dec-003/runner.mjs
new file mode 100644
index 0000000..754ba7c
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-003/runner.mjs
@@ -0,0 +1,122 @@
+// Runner de migrations multi-database (PoC DEC-003). Uma conexao curta por tenant; nada de pool por tenant.
+import { createHash } from 'node:crypto';
+import { readdirSync, readFileSync } from 'node:fs';
+import { join } from 'node:path';
+import pg from 'pg';
+
+const { Client } = pg;
+const LOCK_NAME = 'nucleos:schema_migrations';
+const NAME_RE = /^[a-z][a-z0-9_]{0,62}$/; // identificadores so de allowlist; nunca de entrada externa
+
+export function assertDbName(name) {
+  if (!NAME_RE.test(name)) throw new Error(`nome de database invalido: ${name}`);
+  return name;
+}
+
+export function loadMigrations(dir) {
+  return readdirSync(dir)
+    .filter((f) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(f))
+    .sort()
+    .map((file) => {
+      const sql = readFileSync(join(dir, file), 'utf8');
+      return {
+        version: file.slice(0, 4),
+        name: file.replace(/^\d{4}_/, '').replace(/\.up\.sql$/, ''),
+        file,
+        sql,
+        checksum: createHash('sha256').update(sql).digest('hex'),
+      };
+    });
+}
+
+export function connect(base, database) {
+  return new Client({ ...base, database: assertDbName(database) });
+}
+
+async function acquireLock(client, timeoutMs) {
+  const deadline = Date.now() + timeoutMs;
+  for (;;) {
+    const r = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
+    if (r.rows[0].ok) return;
+    if (Date.now() > deadline) throw new Error('timeout aguardando advisory lock de migrations');
+    await new Promise((res) => setTimeout(res, 25));
+  }
+}
+
+/** Migra UM tenant. Retorna { applied: [...], skipped: n, ms }. Cada migration = 1 transacao (SQL + registro). */
+export async function migrateTenant(base, database, migrations, { failAfter, lockTimeoutMs = 10000, holdMs = 0 } = {}) {
+  const t0 = performance.now();
+  const client = connect(base, database);
+  await client.connect();
+  const applied = [];
+  try {
+    await acquireLock(client, lockTimeoutMs); // por database: tenants nao disputam entre si
+    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
+      version text PRIMARY KEY, name text NOT NULL, checksum char(64) NOT NULL,
+      applied_at timestamptz NOT NULL DEFAULT now(), execution_ms integer NOT NULL)`);
+    const done = new Map((await client.query('SELECT version, checksum FROM schema_migrations')).rows.map((r) => [r.version, r.checksum]));
+    for (const [v] of done) {
+      if (!migrations.some((m) => m.version === v)) throw new Error(`${database}: versao ${v} aplicada sem arquivo correspondente`);
+    }
+    for (const m of migrations) {
+      if (done.has(m.version)) {
+        if (done.get(m.version) !== m.checksum) throw new Error(`${database}: checksum divergente na migration ${m.file} (arquivo alterado apos aplicada)`);
+        continue;
+      }
+      const s0 = performance.now();
+      await client.query('BEGIN');
+      try {
+        await client.query(m.sql);
+        if (holdMs) await new Promise((res) => setTimeout(res, holdMs));
+        if (failAfter === m.version) throw new Error(`falha induzida em ${database} apos ${m.file}`);
+        await client.query(
+          'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)',
+          [m.version, m.name, m.checksum, Math.round(performance.now() - s0)],
+        );
+        await client.query('COMMIT');
+      } catch (e) {
+        await client.query('ROLLBACK');
+        throw e;
+      }
+      applied.push(m.version);
+    }
+    return { database, applied, skipped: migrations.length - applied.length, ms: performance.now() - t0 };
+  } finally {
+    await client.query('SELECT pg_advisory_unlock_all()').catch(() => {});
+    await client.end();
+  }
+}
+
+/** Lote: concorrencia limitada; ao primeiro erro nao inicia novos bancos (fail-fast) e reporta o estado. */
+export async function migrateBatch(base, databases, migrations, { concurrency = 1, failAt = {} } = {}) {
+  const results = [];
+  const failed = [];
+  const queue = [...databases];
+  let halted = false;
+  const worker = async () => {
+    while (!halted && queue.length) {
+      const db = queue.shift();
+      try {
+        results.push(await migrateTenant(base, db, migrations, { failAfter: failAt[db] }));
+      } catch (e) {
+        failed.push({ database: db, error: e.message });
+        halted = true;
+      }
+    }
+  };
+  const t0 = performance.now();
+  await Promise.all(Array.from({ length: concurrency }, worker));
+  return { results, failed, notStarted: queue, ms: performance.now() - t0 };
+}
+
+export async function appliedVersions(base, database) {
+  const c = connect(base, database);
+  await c.connect();
+  try {
+    const t = await c.query("SELECT to_regclass('schema_migrations') AS t");
+    if (!t.rows[0].t) return [];
+    return (await c.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version);
+  } finally {
+    await c.end();
+  }
+}
```

## Correção rodada 1 (commit adicional sobre `45eb146`)

Diff real de código e testes da correção (REVIEW-001, REVIEW-003a da auditoria). Excluídos por regra: `saida-poc.txt` regenerada, lesson, ADR, procedimento e entrega (listados na entrega, seção 11).

```diff
diff --git a/documentacoes/arquitetura/poc/dec-003/poc.mjs b/documentacoes/arquitetura/poc/dec-003/poc.mjs
index 7918983..d6ad839 100644
--- a/documentacoes/arquitetura/poc/dec-003/poc.mjs
+++ b/documentacoes/arquitetura/poc/dec-003/poc.mjs
@@ -3,7 +3,7 @@ import assert from 'node:assert/strict';
 import { writeFileSync } from 'node:fs';
 import { randomUUID } from 'node:crypto';
 import pg from 'pg';
-import { appliedVersions, connect, loadMigrations, migrateBatch, migrateTenant } from './runner.mjs';
+import { appliedVersions, assertDbName, assertTransactional, connect, loadMigrations, migrateBatch, migrateTenant } from './runner.mjs';
 
 const base = { host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD };
 assert.equal(base.host, '127.0.0.1', 'PoC so roda contra 127.0.0.1');
@@ -22,7 +22,7 @@ async function admin(fn) {
 async function provision(names) {
   await admin(async (c) => {
     for (const n of names) {
-      const id = c.escapeIdentifier(n);
+      const id = c.escapeIdentifier(assertDbName(n));
       await c.query(`DROP DATABASE IF EXISTS ${id} WITH (FORCE)`);
       await c.query(`CREATE DATABASE ${id}`);
     }
@@ -72,6 +72,43 @@ assert.deepEqual(r12.applied, ['0002', '0003']);
 assert.deepEqual(r11.applied, []);
 assert.ok(Object.values(afterResume).every((v) => v === '0001,0002,0003'));
 
+// ---- Cenario H: garantia de atomicidade (REVIEW-001/003a da auditoria DEC-003) ----
+{
+  await provision(['poc_tenant_neg']);
+  const mk = (version, name, sql) => ({ version, name, file: `${version}_${name}.up.sql`, sql, checksum: String(version).padEnd(64, '0') });
+  const tableExists = async (t) => {
+    const c = connect(base, 'poc_tenant_neg'); await c.connect();
+    const r = await c.query('SELECT to_regclass($1) AS t', [t]); await c.end();
+    return r.rows[0].t !== null;
+  };
+  // H1: COMMIT interno rejeitado antes de executar: nada criado, nenhuma versao registrada
+  await assert.rejects(
+    () => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'commit_interno', 'CREATE TABLE b1(x int); COMMIT; CREATE TABLE b2(x int);')]),
+    /controle de transacao proibido.*COMMIT/,
+  );
+  assert.equal(await tableExists('b1'), false);
+  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), []);
+  for (const bad of ['BEGIN; SELECT 1', 'ROLLBACK', 'SAVEPOINT s1', 'END', 'CREATE INDEX CONCURRENTLY i ON t(x)', 'VACUUM']) {
+    await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'ruim', bad)]), /proibido|nao roda dentro|nao e suportado/, bad);
+  }
+  // sem falso positivo: palavras em comentario, literal, corpo de funcao e CASE ... END
+  assertTransactional(mk('0001', 'ok', "-- COMMIT aqui e so comentario\nSELECT 'COMMIT; VACUUM', CASE WHEN true THEN 1 END; CREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN 1; END $$"));
+  log('[H1] COMMIT/BEGIN/ROLLBACK/SAVEPOINT/END/CONCURRENTLY/VACUUM rejeitados antes de executar; comentarios, literais e corpos $$ nao geram falso positivo');
+  // H2: erro SQL real (divisao por zero) no 2o statement: rollback total, nada registrado, retomada com migration corrigida
+  const bad2 = mk('0001', 'erro_real', 'CREATE TABLE b1(x int); CREATE TABLE b2(x int); SELECT 1/0;');
+  await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [bad2]), /division by zero/);
+  assert.equal(await tableExists('b1'), false);
+  assert.equal(await tableExists('b2'), false);
+  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), []);
+  const fixed = mk('0001', 'erro_real', 'CREATE TABLE b1(x int); CREATE TABLE b2(x int);');
+  assert.deepEqual((await migrateTenant(base, 'poc_tenant_neg', [fixed])).applied, ['0001']);
+  assert.equal(await tableExists('b2'), true);
+  log('[H2] erro SQL real no 2o statement: rollback total (b1 e b2 ausentes, nenhuma versao registrada); retomada com a migration corrigida aplicou 0001');
+  // H3: provisioner recusa nome fora da allowlist antes de qualquer SQL
+  await assert.rejects(() => provision(['x"; DROP DATABASE postgres; --']), /nome de database invalido/);
+  log('[H3] provision() rejeita nome fora da allowlist antes de qualquer SQL');
+}
+
 // ---- Cenario B: idempotencia ----
 const b = await migrateBatch(base, dbs, migrations, { concurrency: 1 });
 log(`\n[B] reexecucao idempotente: tempo=${ms(b.ms)} aplicadas=${b.results.reduce((s, r) => s + r.applied.length, 0)}`);
diff --git a/documentacoes/arquitetura/poc/dec-003/runner.mjs b/documentacoes/arquitetura/poc/dec-003/runner.mjs
index 754ba7c..6b2ed2a 100644
--- a/documentacoes/arquitetura/poc/dec-003/runner.mjs
+++ b/documentacoes/arquitetura/poc/dec-003/runner.mjs
@@ -29,6 +29,28 @@ export function loadMigrations(dir) {
     });
 }
 
+const TX_CONTROL = /^(begin|start|commit|end|rollback|abort|savepoint|release|prepare)\b/i;
+const NO_TX = /\b(concurrently|vacuum)\b/i;
+
+/**
+ * Lint estatico: o runner envolve cada migration em BEGIN/COMMIT; SQL que controla transacao ou que nao roda
+ * dentro de uma (CONCURRENTLY, VACUUM) quebraria a atomicidade e e rejeitado ANTES de executar. Sem escape.
+ * Limite: e textual; nao enxerga SQL dinamico (DO/EXECUTE); a revisao da migration continua sendo gate.
+ */
+export function assertTransactional(m) {
+  const text = m.sql
+    .replace(/--[^\n]*/g, ' ')
+    .replace(/\/\*[\s\S]*?\*\//g, ' ')
+    .replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1\$/g, ' ')
+    .replace(/'(?:[^']|'')*'/g, "''")
+    .replace(/"(?:[^"]|"")*"/g, '""');
+  for (const stmt of text.split(';')) {
+    const t = stmt.trim();
+    if (TX_CONTROL.test(t)) throw new Error(`${m.file}: controle de transacao proibido na migration (${t.split(/\s+/)[0].toUpperCase()}); o runner ja envolve cada migration em transacao`);
+    if (NO_TX.test(t)) throw new Error(`${m.file}: comando que nao roda dentro de transacao (${t.match(NO_TX)[1].toUpperCase()}) nao e suportado pelo runner`);
+  }
+}
+
 export function connect(base, database) {
   return new Client({ ...base, database: assertDbName(database) });
 }
@@ -46,6 +68,7 @@ async function acquireLock(client, timeoutMs) {
 /** Migra UM tenant. Retorna { applied: [...], skipped: n, ms }. Cada migration = 1 transacao (SQL + registro). */
 export async function migrateTenant(base, database, migrations, { failAfter, lockTimeoutMs = 10000, holdMs = 0 } = {}) {
   const t0 = performance.now();
+  for (const m of migrations) assertTransactional(m); // antes de abrir conexao ou executar qualquer SQL
   const client = connect(base, database);
   await client.connect();
   const applied = [];
```
