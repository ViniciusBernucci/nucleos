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

const TX_CONTROL = /^(begin|start|commit|end|rollback|abort|savepoint|release|prepare)\b/i;
const NO_TX = /\b(concurrently|vacuum)\b/i; // falso positivo aceito: coluna chamada "concurrently"/"vacuum" tambem e rejeitada (falha visivel e barata)
const SCS = /\bstandard_conforming_strings\b/i;
const IDENT_CHAR = /[A-Za-z0-9_$\u0080-￿]/;
const DOLLAR_TAG = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/;

/**
 * Tokenizador de UMA passada (estado unico, na ordem de aparicao, como o servidor): devolve o SQL com comentarios
 * trocados por espaco, literais por '' e identificadores entre aspas por "". Fail-closed: literal, comentario
 * ou dollar-quote nao terminado lanca erro. Assume standard_conforming_strings=on (padrao): em '...' a barra
 * invertida e comum; so E'...' trata \ como escape.
 */
export function stripSql(sql, file = 'migration') {
  const n = sql.length;
  let out = '';
  let i = 0;
  const unterminated = (what) => { throw new Error(`${file}: ${what} nao terminado; migration rejeitada pelo lint`); };
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') i++;
      out += ' ';
    } else if (c === '/' && next === '*') {
      let depth = 1;
      i += 2;
      while (depth > 0) {
        if (i >= n) unterminated('comentario /* */');
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; } else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; } else i++;
      }
      out += ' ';
    } else if (c === "'") {
      // E'...' (prefixo E/e que nao faz parte de um identificador maior) aceita \ como escape
      const escapes = /^[eE]$/.test(sql[i - 1] ?? '') && !IDENT_CHAR.test(sql[i - 2] ?? ' ');
      i++;
      for (;;) {
        if (i >= n) unterminated("literal '...'");
        if (escapes && sql[i] === '\\') i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") { i++; break; } else i++;
      }
      out += "''";
    } else if (c === '"') {
      i++;
      for (;;) {
        if (i >= n) unterminated('identificador "..."');
        if (sql[i] === '"' && sql[i + 1] === '"') i += 2;
        else if (sql[i] === '"') { i++; break; } else i++;
      }
      out += '""';
    } else if (c === '$' && !IDENT_CHAR.test(sql[i - 1] ?? ' ')) {
      const tag = DOLLAR_TAG.exec(sql.slice(i, i + 80))?.[0]; // $1 (parametro) nao casa: exige $tag$ ou $$
      if (!tag) { out += c; i++; continue; }
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) unterminated(`dollar-quote ${tag}`);
      i = end + tag.length;
      out += "''";
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Lint estatico: o runner envolve cada migration em BEGIN/COMMIT; SQL que controla transacao ou que nao roda
 * dentro de uma (CONCURRENTLY, VACUUM) quebraria a atomicidade e e rejeitado ANTES de executar. Sem escape.
 * Limites: e textual; nao enxerga SQL dinamico (DO/EXECUTE, set_config) nem standard_conforming_strings=off
 * (o SET literal e rejeitado, mas nao uma troca por set_config/ALTER ROLE); a revisao da migration continua sendo gate.
 */
export function assertTransactional(m) {
  const text = stripSql(m.sql, m.file);
  for (const stmt of text.split(';')) {
    const t = stmt.trim();
    if (TX_CONTROL.test(t)) throw new Error(`${m.file}: controle de transacao proibido na migration (${t.split(/\s+/)[0].toUpperCase()}); o runner ja envolve cada migration em transacao`);
    if (NO_TX.test(t)) throw new Error(`${m.file}: comando que nao roda dentro de transacao (${t.match(NO_TX)[1].toUpperCase()}) nao e suportado pelo runner`);
    if (SCS.test(t)) throw new Error(`${m.file}: alterar standard_conforming_strings e proibido (o lint assume o padrao 'on')`);
  }
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
export async function migrateTenant(base, database, migrations, { failAfter, lockTimeoutMs = 10000, holdMs = 0, lint = assertTransactional } = {}) {
  const t0 = performance.now();
  for (const m of migrations) lint(m); // antes de abrir conexao ou executar SQL; `lint` e injetavel so para testar a defesa em profundidade
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
        const xactStart = () => client.query('SELECT xact_start::text AS t FROM pg_stat_activity WHERE pid = pg_backend_pid()').then((r) => r.rows[0].t);
        const before = await xactStart();
        await client.query(m.sql);
        // Defesa em profundidade: so DETECTA (o COMMIT interno ja ocorreu); nao registra a versao se a transacao mudou.
        if ((await xactStart()) !== before) throw new Error(`${database}: migration ${m.file} encerrou ou reiniciou a transacao; versao nao registrada (estado parcial possivel: investigar)`);
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
