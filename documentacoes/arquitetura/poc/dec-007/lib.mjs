// Biblioteca comum da PoC DEC-007: configuracao, docker, banco de "efeitos" e handler de tarefa.
import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const CFG = {
  host: '127.0.0.1',
  pgPort: Number(process.env.POC_PG_PORT ?? 55437),
  redisPort: Number(process.env.POC_REDIS_PORT ?? 56379),
  temporalPort: Number(process.env.POC_TEMPORAL_PORT ?? 57233),
  leaseMs: 5000, // lease (PG) = lockDuration (BullMQ) = heartbeatTimeout (Temporal)
  tenantLimit: 2,
  pgPassword: process.env.PGPASSWORD ?? '',
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

export function pgConn(database) {
  return new pg.Client({ host: CFG.host, port: CFG.pgPort, user: 'postgres', password: CFG.pgPassword, database });
}
export function pgPool(database, max = 8) {
  return new pg.Pool({ host: CFG.host, port: CFG.pgPort, user: 'postgres', password: CFG.pgPassword, database, max });
}

// Banco "efeitos": registra execucoes (at-least-once visivel) e efeitos (idempotentes por task_id).
export async function effectsPool() {
  const p = pgPool('dec007_effects', 4);
  p.on('error', () => {});
  return p;
}
export const EFFECTS_DDL = `
CREATE TABLE IF NOT EXISTS task_meta (id text PRIMARY KEY, tenant text NOT NULL, enq_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS executions (id bigserial PRIMARY KEY, task_id text NOT NULL, tenant text NOT NULL, attempt int NOT NULL,
  worker text NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), ended_at timestamptz);
CREATE TABLE IF NOT EXISTS effects (task_id text PRIMARY KEY, done_at timestamptz NOT NULL DEFAULT clock_timestamp());`;

let fx;
async function fxPool() {
  return (fx ??= await effectsPool());
}

// Handler comum as tres opcoes. O efeito e idempotente (consumidor idempotente, AC-2).
export async function handle(task, attempt, workerId, heartbeat) {
  const pool = await fxPool();
  const { rows } = await pool.query(
    'INSERT INTO executions (task_id, tenant, attempt, worker) VALUES ($1,$2,$3,$4) RETURNING id',
    [task.id, task.tenant, attempt, workerId],
  );
  const end = Date.now() + (task.workMs ?? 0);
  while (Date.now() < end) {
    await sleep(Math.min(200, Math.max(0, end - Date.now())));
    await heartbeat?.();
  }
  await pool.query('INSERT INTO effects (task_id) VALUES ($1) ON CONFLICT DO NOTHING', [task.id]);
  await pool.query('UPDATE executions SET ended_at = clock_timestamp() WHERE id = $1', [rows[0].id]);
  if (task.crashAfterEffect && attempt === 1) process.exit(137); // efeito feito, ack nao enviado
}

export async function markEnqueued(task) {
  const pool = await fxPool();
  await pool.query('INSERT INTO task_meta (id, tenant) VALUES ($1,$2) ON CONFLICT DO NOTHING', [task.id, task.tenant]);
}

// Simula relogio dessincronizado no processo (so afeta quem usa Date.now() do cliente).
export function applyClockSkew(ms) {
  if (!ms) return;
  const real = Date.now.bind(Date);
  Date.now = () => real() + ms;
}

export const docker = {
  rm: (name) => { try { sh('docker', ['rm', '-fv', name]); } catch { /* ausente */ } },
  stats: (name) => {
    const s = sh('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', name]).split('/')[0].trim();
    const m = /([\d.]+)\s*(KiB|MiB|GiB)/.exec(s);
    return m ? Number(m[1]) * { KiB: 1 / 1024, MiB: 1, GiB: 1024 }[m[2]] : NaN;
  },
};
export function rssMb(pid) {
  try {
    const kb = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1];
    return kb ? Number(kb) / 1024 : 0;
  } catch { return 0; }
}
export const pct = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : NaN;
};
