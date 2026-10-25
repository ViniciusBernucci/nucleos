// Runner de migrations multi-database (PoC DEC-003). Uma conexao curta por tenant; nada de pool por tenant.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const LOCK_NAME = 'nucleos:schema_migrations';
const NAME_RE = /^[a-z][a-z0-9_]{0,62}$/; // identificadores so de allowlist; nunca de entrada externa

export function assertDbName(name) {
  if (!NAME_RE.test(name)) throw new Error(`nome de database invalido: ${name}`);
  return name;
}

export function loadMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(dir, file), 'utf8');
      return {
        version: file.slice(0, 4),
        name: file.replace(/^\d{4}_/, '').replace(/\.up\.sql$/, ''),
        file,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    });
}

export function connect(base, database) {
  return new Client({ ...base, database: assertDbName(database) });
}

async function acquireLock(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [LOCK_NAME]);
    if (r.rows[0].ok) return;
    if (Date.now() > deadline) throw new Error('timeout aguardando advisory lock de migrations');
    await new Promise((res) => setTimeout(res, 25));
  }
}

/** Migra UM tenant. Retorna { applied: [...], skipped: n, ms }. Cada migration = 1 transacao (SQL + registro). */
export async function migrateTenant(base, database, migrations, { failAfter, lockTimeoutMs = 10000, holdMs = 0 } = {}) {
  const t0 = performance.now();
  const client = connect(base, database);
  await client.connect();
  const applied = [];
  try {
    await acquireLock(client, lockTimeoutMs); // por database: tenants nao disputam entre si
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, name text NOT NULL, checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(), execution_ms integer NOT NULL)`);
    const done = new Map((await client.query('SELECT version, checksum FROM schema_migrations')).rows.map((r) => [r.version, r.checksum]));
    for (const [v] of done) {
      if (!migrations.some((m) => m.version === v)) throw new Error(`${database}: versao ${v} aplicada sem arquivo correspondente`);
    }
    for (const m of migrations) {
      if (done.has(m.version)) {
        if (done.get(m.version) !== m.checksum) throw new Error(`${database}: checksum divergente na migration ${m.file} (arquivo alterado apos aplicada)`);
        continue;
      }
      const s0 = performance.now();
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        if (holdMs) await new Promise((res) => setTimeout(res, holdMs));
        if (failAfter === m.version) throw new Error(`falha induzida em ${database} apos ${m.file}`);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)',
          [m.version, m.name, m.checksum, Math.round(performance.now() - s0)],
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
      applied.push(m.version);
    }
    return { database, applied, skipped: migrations.length - applied.length, ms: performance.now() - t0 };
  } finally {
    await client.query('SELECT pg_advisory_unlock_all()').catch(() => {});
    await client.end();
  }
}

/** Lote: concorrencia limitada; ao primeiro erro nao inicia novos bancos (fail-fast) e reporta o estado. */
export async function migrateBatch(base, databases, migrations, { concurrency = 1, failAt = {} } = {}) {
  const results = [];
  const failed = [];
  const queue = [...databases];
  let halted = false;
  const worker = async () => {
    while (!halted && queue.length) {
      const db = queue.shift();
      try {
        results.push(await migrateTenant(base, db, migrations, { failAfter: failAt[db] }));
      } catch (e) {
        failed.push({ database: db, error: e.message });
        halted = true;
      }
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { results, failed, notStarted: queue, ms: performance.now() - t0 };
}

export async function appliedVersions(base, database) {
  const c = connect(base, database);
  await c.connect();
  try {
    const t = await c.query("SELECT to_regclass('schema_migrations') AS t");
    if (!t.rows[0].t) return [];
    return (await c.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version);
  } finally {
    await c.end();
  }
}
