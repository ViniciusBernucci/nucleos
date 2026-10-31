# DEC-007 diffs — 2026-10-26

Diffs da tarefa (código e configuração da PoC). Entrega: [DEC-007](2026-10-26-dec-007-orquestracao-duravel.md). Excluídos por regra: registro em `documentacoes/` e `lessons/`, `evidencia/saida-poc.txt` e `package-lock.json` (hash na entrega). Base `d00e8df`; diff da árvore de trabalho antes do commit (o SHA do commit não pode constar dentro dele; ver relatório de integração).

```diff
diff --git a/documentacoes/arquitetura/poc/dec-007/.gitignore b/documentacoes/arquitetura/poc/dec-007/.gitignore
new file mode 100644
index 0000000..2782646
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/.gitignore
@@ -0,0 +1,2 @@
+.bundle-cache.json
+node_modules/
diff --git a/documentacoes/arquitetura/poc/dec-007/impl-bullmq.mjs b/documentacoes/arquitetura/poc/dec-007/impl-bullmq.mjs
new file mode 100644
index 0000000..09a1184
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/impl-bullmq.mjs
@@ -0,0 +1,54 @@
+// Opcao B: BullMQ + Redis. layout 'tenant' = uma fila por tenant (limite global 2 por fila); 'shared' = fila unica.
+import { Queue, Worker } from 'bullmq';
+import { Redis } from 'ioredis';
+import { CFG, handle, markEnqueued } from './lib.mjs';
+
+const layout = () => process.env.BULLMQ_LAYOUT ?? 'tenant';
+const qname = (tenant) => (layout() === 'shared' ? 'dec007-shared' : `dec007-t-${tenant}`);
+const conn = (worker) => {
+  const r = new Redis({ host: CFG.host, port: CFG.redisPort, maxRetriesPerRequest: worker ? null : 3, retryStrategy: () => 300 });
+  r.on('error', () => {}); // quedas do Redis sao esperadas nos cenarios S2/S9
+  return r;
+};
+
+export default {
+  name: 'bullmq',
+  async init() { this.redis = conn(false); this.queues = new Map(); this.capped = new Set(); },
+  queue(tenant) {
+    const n = qname(tenant);
+    if (!this.queues.has(n)) this.queues.set(n, new Queue(n, { connection: conn(false), defaultJobOptions: { removeOnComplete: false } }));
+    return this.queues.get(n);
+  },
+  async reset() {
+    for (const q of this.queues.values()) await q.close().catch(() => {});
+    this.queues.clear(); this.capped.clear();
+    await this.redis.flushall();
+  },
+  async enqueue(task) {
+    await markEnqueued(task);
+    const q = this.queue(task.tenant);
+    if (layout() === 'tenant' && !this.capped.has(q.name)) { await q.setGlobalConcurrency(CFG.tenantLimit); this.capped.add(q.name); }
+    const existing = await q.getJob(task.id);
+    if (existing) return 'duplicate';
+    await q.add('task', task, { jobId: task.id, delay: task.approval ? 7 * 24 * 3600 * 1000 : (task.delayMs ?? 0), attempts: 5, backoff: { type: 'fixed', delay: 500 } });
+    return 'ok';
+  },
+  async approve(id, tenant) { const j = await this.queue(tenant).getJob(id); await j.promote(); },
+  async close() { for (const q of this.queues.values()) await q.close().catch(() => {}); await this.redis.quit().catch(() => {}); },
+
+  async runWorker({ workerId, tenants, slots = 2, ready }) {
+    const names = layout() === 'shared' ? [qname('x')] : tenants.map(qname);
+    const workers = names.map((n) => new Worker(n, async (job) => {
+      await handle(job.data, job.attemptsStarted, workerId, null); // BullMQ renova o lock sozinho
+    }, {
+      connection: conn(true),
+      concurrency: layout() === 'shared' ? slots : CFG.tenantLimit,
+      lockDuration: CFG.leaseMs, stalledInterval: 2000, maxStalledCount: 5,
+    }));
+    workers.forEach((w) => w.on('error', () => {}));
+    if (layout() === 'tenant') for (const t of tenants) await this.queue(t).setGlobalConcurrency(CFG.tenantLimit);
+    await Promise.all(workers.map((w) => w.waitUntilReady()));
+    ready?.();
+    await new Promise(() => {});
+  },
+};
diff --git a/documentacoes/arquitetura/poc/dec-007/impl-pg.mjs b/documentacoes/arquitetura/poc/dec-007/impl-pg.mjs
new file mode 100644
index 0000000..a899fb6
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/impl-pg.mjs
@@ -0,0 +1,86 @@
+// Opcao A: tabela PostgreSQL com lease (FOR UPDATE SKIP LOCKED), limite e justica por tenant.
+import { CFG, sleep, handle, markEnqueued } from './lib.mjs';
+import { pgPool } from './lib.mjs';
+
+export const DDL = `
+CREATE TABLE IF NOT EXISTS tenant_state (tenant text PRIMARY KEY, last_served_at timestamptz, max_running int NOT NULL DEFAULT 2);
+CREATE TABLE IF NOT EXISTS tasks (
+  id text PRIMARY KEY,                       -- chave de idempotencia do produtor
+  tenant text NOT NULL REFERENCES tenant_state(tenant),
+  state text NOT NULL CHECK (state IN ('awaiting_approval','queued','running','done')),
+  run_at timestamptz NOT NULL DEFAULT now(),
+  attempt int NOT NULL DEFAULT 0,
+  lease_until timestamptz, lease_owner text,
+  payload jsonb NOT NULL,
+  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+  done_at timestamptz);
+CREATE INDEX IF NOT EXISTS tasks_claim_idx ON tasks (tenant, state, run_at);`;
+
+export default {
+  name: 'pg',
+  async init() { this.pool = pgPool('dec007_control', 8); this.pool.on('error', () => {}); },
+  async reset() {
+    await this.pool.query('TRUNCATE tasks, tenant_state CASCADE');
+  },
+  // delayMs e calculado no servidor (now() + intervalo): independe do relogio do cliente.
+  async enqueue(task, client = this.pool) {
+    await markEnqueued(task);
+    await client.query('INSERT INTO tenant_state (tenant, max_running) VALUES ($1,$2) ON CONFLICT DO NOTHING', [task.tenant, CFG.tenantLimit]);
+    const state = task.approval ? 'awaiting_approval' : 'queued';
+    const r = await client.query(
+      `INSERT INTO tasks (id, tenant, state, run_at, payload) VALUES ($1,$2,$3, now() + ($4::int * interval '1 millisecond'), $5)
+       ON CONFLICT (id) DO NOTHING`,
+      [task.id, task.tenant, state, task.delayMs ?? 0, task]);
+    return r.rowCount === 1 ? 'ok' : 'duplicate';
+  },
+  async approve(id) {
+    await this.pool.query("UPDATE tasks SET state='queued', run_at=now() WHERE id=$1 AND state='awaiting_approval'", [id]);
+  },
+  async close() { await this.pool.end().catch(() => {}); },
+
+  // ---- processo worker ----
+  async claim(workerId) {
+    const eligible = `((k.state='queued' AND k.run_at<=now()) OR (k.state='running' AND k.lease_until<=now()))`;
+    const { rows: cands } = await this.pool.query(
+      `SELECT ts.tenant FROM tenant_state ts
+        WHERE EXISTS (SELECT 1 FROM tasks k WHERE k.tenant=ts.tenant AND ${eligible})
+        ORDER BY ts.last_served_at NULLS FIRST LIMIT 8`);
+    for (const { tenant } of cands) {
+      const c = await this.pool.connect();
+      try {
+        await c.query('BEGIN');
+        // Trava a linha do tenant: serializa reivindicacoes do mesmo tenant (contagem correta do limite).
+        const lock = await c.query('SELECT max_running FROM tenant_state WHERE tenant=$1 FOR UPDATE SKIP LOCKED', [tenant]);
+        if (lock.rowCount === 0) { await c.query('ROLLBACK'); continue; }
+        const run = await c.query("SELECT count(*)::int n FROM tasks WHERE tenant=$1 AND state='running' AND lease_until>now()", [tenant]);
+        if (run.rows[0].n >= lock.rows[0].max_running) { await c.query('ROLLBACK'); continue; }
+        const got = await c.query(
+          `UPDATE tasks SET state='running', attempt=attempt+1, lease_owner=$2, lease_until=now()+($3::int * interval '1 millisecond')
+            WHERE id=(SELECT k.id FROM tasks k WHERE k.tenant=$1 AND ${eligible} ORDER BY k.run_at, k.created_at FOR UPDATE SKIP LOCKED LIMIT 1)
+            RETURNING id, attempt, payload`, [tenant, workerId, CFG.leaseMs]);
+        if (got.rowCount === 0) { await c.query('ROLLBACK'); continue; }
+        await c.query('UPDATE tenant_state SET last_served_at=clock_timestamp() WHERE tenant=$1', [tenant]);
+        await c.query('COMMIT');
+        return got.rows[0];
+      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
+    }
+    return null;
+  },
+  async runWorker({ workerId, slots = 2, ready }) {
+    ready?.();
+    const loop = async () => {
+      for (;;) {
+        try {
+          const job = await this.claim(workerId);
+          if (!job) { await sleep(100 + Math.random() * 50); continue; }
+          const hb = () => this.pool.query(
+            "UPDATE tasks SET lease_until=now()+($3::int * interval '1 millisecond') WHERE id=$1 AND attempt=$2 AND state='running'", [job.id, job.attempt, CFG.leaseMs]);
+          await handle(job.payload, job.attempt, workerId, hb);
+          // fencing: so conclui quem ainda detem a tentativa corrente
+          await this.pool.query("UPDATE tasks SET state='done', done_at=now() WHERE id=$1 AND attempt=$2 AND state='running'", [job.id, job.attempt]);
+        } catch { await sleep(500); } // banco indisponivel: tenta de novo; a lease expira e outro worker assume
+      }
+    };
+    await Promise.all(Array.from({ length: slots }, loop));
+  },
+};
diff --git a/documentacoes/arquitetura/poc/dec-007/impl-temporal.mjs b/documentacoes/arquitetura/poc/dec-007/impl-temporal.mjs
new file mode 100644
index 0000000..60a6a71
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/impl-temporal.mjs
@@ -0,0 +1,63 @@
+// Opcao C: Temporal (servidor dev em container). Uma task queue por tenant.
+import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
+import { NativeConnection, Worker, Runtime, DefaultLogger, bundleWorkflowCode } from '@temporalio/worker';
+import { Context } from '@temporalio/activity';
+import { fileURLToPath } from 'node:url';
+import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
+import { CFG, handle, markEnqueued } from './lib.mjs';
+
+const address = () => `${CFG.host}:${CFG.temporalPort}`;
+const WF = fileURLToPath(new URL('./temporal-workflows.mjs', import.meta.url));
+const CACHE = fileURLToPath(new URL('./.bundle-cache.json', import.meta.url));
+// Empacota os workflows uma vez (webpack e caro) e reaproveita entre os workers.
+async function loadBundle() {
+  if (existsSync(CACHE) && statSync(CACHE).mtimeMs > statSync(WF).mtimeMs) return JSON.parse(readFileSync(CACHE, 'utf8'));
+  const b = await bundleWorkflowCode({ workflowsPath: WF });
+  writeFileSync(CACHE, JSON.stringify({ code: b.code }));
+  return { code: b.code };
+}
+export const tq = (prefix, tenant) => `${prefix}-${tenant}`;
+
+export default {
+  name: 'temporal',
+  prefix: process.env.TQ_PREFIX ?? 'run',
+  async init() {
+    this.conn = await Connection.connect({ address: address() });
+    this.client = new Client({ connection: this.conn });
+  },
+  async reset() { this.prefix = `r${Date.now().toString(36)}`; process.env.TQ_PREFIX = this.prefix; },
+  async enqueue(task) {
+    await markEnqueued(task);
+    try {
+      await this.client.workflow.start('taskWorkflow', {
+        args: [task], taskQueue: tq(this.prefix, task.tenant), workflowId: `${this.prefix}-${task.id}`,
+        startDelay: task.delayMs ? task.delayMs : undefined,
+      });
+      return 'ok';
+    } catch (e) {
+      if (e instanceof WorkflowExecutionAlreadyStartedError) return 'duplicate';
+      throw e;
+    }
+  },
+  async approve(id) { await this.client.workflow.getHandle(`${this.prefix}-${id}`).signal('approve'); },
+  async close() { await this.conn?.close().catch(() => {}); },
+
+  async runWorker({ workerId, tenants, ready }) {
+    Runtime.install({ logger: new DefaultLogger('ERROR') });
+    const connection = await NativeConnection.connect({ address: address() });
+    const activities = {
+      async runTask(task) {
+        const info = Context.current().info;
+        await handle(task, info.attempt, workerId, async () => Context.current().heartbeat());
+      },
+    };
+    const workflowBundle = await loadBundle();
+    const workers = await Promise.all(tenants.map((t) => Worker.create({
+      connection, taskQueue: tq(process.env.TQ_PREFIX, t), activities,
+      workflowBundle,
+      maxConcurrentActivityTaskExecutions: CFG.tenantLimit, // limite por worker, nao global
+    })));
+    ready?.();
+    await Promise.all(workers.map((w) => w.run()));
+  },
+};
diff --git a/documentacoes/arquitetura/poc/dec-007/lib.mjs b/documentacoes/arquitetura/poc/dec-007/lib.mjs
new file mode 100644
index 0000000..eb960b2
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/lib.mjs
@@ -0,0 +1,89 @@
+// Biblioteca comum da PoC DEC-007: configuracao, docker, banco de "efeitos" e handler de tarefa.
+import pg from 'pg';
+import { execFileSync } from 'node:child_process';
+import { readFileSync } from 'node:fs';
+
+export const CFG = {
+  host: '127.0.0.1',
+  pgPort: Number(process.env.POC_PG_PORT ?? 55437),
+  redisPort: Number(process.env.POC_REDIS_PORT ?? 56379),
+  temporalPort: Number(process.env.POC_TEMPORAL_PORT ?? 57233),
+  leaseMs: 5000, // lease (PG) = lockDuration (BullMQ) = heartbeatTimeout (Temporal)
+  tenantLimit: 2,
+  pgPassword: process.env.PGPASSWORD ?? '',
+};
+export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
+export const sh = (cmd, args, opts = {}) =>
+  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
+
+export function pgConn(database) {
+  return new pg.Client({ host: CFG.host, port: CFG.pgPort, user: 'postgres', password: CFG.pgPassword, database });
+}
+export function pgPool(database, max = 8) {
+  return new pg.Pool({ host: CFG.host, port: CFG.pgPort, user: 'postgres', password: CFG.pgPassword, database, max });
+}
+
+// Banco "efeitos": registra execucoes (at-least-once visivel) e efeitos (idempotentes por task_id).
+export async function effectsPool() {
+  const p = pgPool('dec007_effects', 4);
+  p.on('error', () => {});
+  return p;
+}
+export const EFFECTS_DDL = `
+CREATE TABLE IF NOT EXISTS task_meta (id text PRIMARY KEY, tenant text NOT NULL, enq_at timestamptz NOT NULL DEFAULT clock_timestamp());
+CREATE TABLE IF NOT EXISTS executions (id bigserial PRIMARY KEY, task_id text NOT NULL, tenant text NOT NULL, attempt int NOT NULL,
+  worker text NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), ended_at timestamptz);
+CREATE TABLE IF NOT EXISTS effects (task_id text PRIMARY KEY, done_at timestamptz NOT NULL DEFAULT clock_timestamp());`;
+
+let fx;
+async function fxPool() {
+  return (fx ??= await effectsPool());
+}
+
+// Handler comum as tres opcoes. O efeito e idempotente (consumidor idempotente, AC-2).
+export async function handle(task, attempt, workerId, heartbeat) {
+  const pool = await fxPool();
+  const { rows } = await pool.query(
+    'INSERT INTO executions (task_id, tenant, attempt, worker) VALUES ($1,$2,$3,$4) RETURNING id',
+    [task.id, task.tenant, attempt, workerId],
+  );
+  const end = Date.now() + (task.workMs ?? 0);
+  while (Date.now() < end) {
+    await sleep(Math.min(200, Math.max(0, end - Date.now())));
+    await heartbeat?.();
+  }
+  await pool.query('INSERT INTO effects (task_id) VALUES ($1) ON CONFLICT DO NOTHING', [task.id]);
+  await pool.query('UPDATE executions SET ended_at = clock_timestamp() WHERE id = $1', [rows[0].id]);
+  if (task.crashAfterEffect && attempt === 1) process.exit(137); // efeito feito, ack nao enviado
+}
+
+export async function markEnqueued(task) {
+  const pool = await fxPool();
+  await pool.query('INSERT INTO task_meta (id, tenant) VALUES ($1,$2) ON CONFLICT DO NOTHING', [task.id, task.tenant]);
+}
+
+// Simula relogio dessincronizado no processo (so afeta quem usa Date.now() do cliente).
+export function applyClockSkew(ms) {
+  if (!ms) return;
+  const real = Date.now.bind(Date);
+  Date.now = () => real() + ms;
+}
+
+export const docker = {
+  rm: (name) => { try { sh('docker', ['rm', '-fv', name]); } catch { /* ausente */ } },
+  stats: (name) => {
+    const s = sh('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', name]).split('/')[0].trim();
+    const m = /([\d.]+)\s*(KiB|MiB|GiB)/.exec(s);
+    return m ? Number(m[1]) * { KiB: 1 / 1024, MiB: 1, GiB: 1024 }[m[2]] : NaN;
+  },
+};
+export function rssMb(pid) {
+  try {
+    const kb = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1];
+    return kb ? Number(kb) / 1024 : 0;
+  } catch { return 0; }
+}
+export const pct = (arr, p) => {
+  const a = [...arr].sort((x, y) => x - y);
+  return a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : NaN;
+};
diff --git a/documentacoes/arquitetura/poc/dec-007/package.json b/documentacoes/arquitetura/poc/dec-007/package.json
new file mode 100644
index 0000000..b14d0b2
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/package.json
@@ -0,0 +1,18 @@
+{
+  "name": "dec-007-poc-orquestracao",
+  "private": true,
+  "type": "module",
+  "description": "PoC descartavel ENT-DEC-007 (ADR-021): PostgreSQL lease vs BullMQ+Redis vs Temporal",
+  "engines": {
+    "node": ">=24.22.1"
+  },
+  "dependencies": {
+    "@temporalio/activity": "1.24.0",
+    "@temporalio/client": "1.24.0",
+    "@temporalio/worker": "1.24.0",
+    "@temporalio/workflow": "1.24.0",
+    "bullmq": "6.4.2",
+    "ioredis": "6.0.0",
+    "pg": "8.23.1"
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-007/poc.mjs b/documentacoes/arquitetura/poc/dec-007/poc.mjs
new file mode 100644
index 0000000..3329de2
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/poc.mjs
@@ -0,0 +1,325 @@
+// PoC DEC-007 (ADR-021): orquestracao duravel de tarefas. Descartavel, so 127.0.0.1, sem dados reais.
+import { fork } from 'node:child_process';
+import { readFileSync } from 'node:fs';
+import { Connection } from '@temporalio/client';
+import { CFG, sh, sleep, pgConn, pgPool, docker, rssMb, pct, EFFECTS_DDL } from './lib.mjs';
+import { DDL as PG_DDL } from './impl-pg.mjs';
+
+const HERE = new URL('.', import.meta.url).pathname;
+const N = { pg: 'dec007-pg', redis: 'dec007-redis', temporal: 'dec007-temporal' };
+const IMAGES = { pg: 'postgres:16', redis: 'redis:8.8.3-alpine', temporal: 'temporalio/temporal:latest' };
+const REDIS_MODES = {
+  noaof: ['--save', '', '--appendonly', 'no'],
+  everysec: ['--save', '', '--appendonly', 'yes', '--appendfsync', 'everysec'],
+  always: ['--save', '', '--appendonly', 'yes', '--appendfsync', 'always'],
+};
+const results = [];
+const log = (...a) => console.log(...a);
+const rec = (variant, scn, status, detail) => { results.push({ variant, scn, status, detail }); log(`[${scn}][${variant}] ${status} - ${detail}`); };
+
+// ---------- infraestrutura efemera ----------
+async function waitFor(fn, ms, poll = 250) {
+  const end = Date.now() + ms;
+  for (;;) {
+    try { const v = await fn(); if (v) return v; } catch { /* ainda subindo */ }
+    if (Date.now() > end) return null;
+    await sleep(poll);
+  }
+}
+async function startPg() {
+  docker.rm(N.pg);
+  sh('docker', ['run', '-d', '--name', N.pg, '-p', `127.0.0.1:${CFG.pgPort}:5432`, '-e', `POSTGRES_PASSWORD=${CFG.pgPassword}`, IMAGES.pg]);
+  await waitFor(() => { sh('docker', ['exec', N.pg, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']); return true; }, 60000, 500);
+  await sleep(2000);
+  for (const db of ['dec007_control', 'dec007_effects']) {
+    const c = pgConn('postgres'); await c.connect(); await c.query(`CREATE DATABASE ${db}`); await c.end();
+  }
+  let c = pgConn('dec007_control'); await c.connect();
+  await c.query(PG_DDL); await c.query('CREATE TABLE IF NOT EXISTS business_orders (id text PRIMARY KEY)'); await c.end();
+  c = pgConn('dec007_effects'); await c.connect(); await c.query(EFFECTS_DDL); await c.end();
+}
+function startRedis(mode) {
+  docker.rm(N.redis);
+  sh('docker', ['run', '-d', '--name', N.redis, '-p', `127.0.0.1:${CFG.redisPort}:6379`, IMAGES.redis,
+    'redis-server', '--maxmemory-policy', 'noeviction', ...REDIS_MODES[mode]]);
+}
+const redisReady = () => waitFor(() => sh('docker', ['exec', N.redis, 'redis-cli', 'ping']) === 'PONG', 30000);
+function startTemporal() {
+  docker.rm(N.temporal);
+  sh('docker', ['run', '-d', '--name', N.temporal, '-p', `127.0.0.1:${CFG.temporalPort}:7233`, IMAGES.temporal,
+    'server', 'start-dev', '--ip', '0.0.0.0', '--headless', '--db-filename', '/tmp/temporal.db', '--log-level', 'error']);
+}
+const temporalReady = () => waitFor(async () => {
+  const c = await Connection.connect({ address: `${CFG.host}:${CFG.temporalPort}`, connectTimeout: 2000 });
+  try { await c.workflowService.getSystemInfo({}); return true; } finally { await c.close(); }
+}, 90000, 1000);
+async function restartBackend(kind, how) {
+  const name = N[kind];
+  if (how === 'graceful') sh('docker', ['restart', name]);
+  else { sh('docker', ['kill', name]); sh('docker', ['start', name]); }
+  if (kind === 'redis') await redisReady();
+  else if (kind === 'temporal') await temporalReady();
+  else await waitFor(() => { sh('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']); return true; }, 60000, 500);
+  await sleep(kind === 'pg' ? 2000 : 500);
+}
+
+// ---------- efeitos ----------
+const fx = pgPool('dec007_effects', 4); fx.on('error', () => {});
+const q = async (sql, p) => { for (let i = 0; i < 40; i++) { try { return (await fx.query(sql, p)).rows; } catch { await sleep(500); } } throw new Error('fx indisponivel'); };
+const cnt = async (t, where = 'true') => Number((await q(`SELECT count(*)::int n FROM ${t} WHERE ${where}`))[0].n);
+const clearFx = () => q('TRUNCATE task_meta, executions, effects RESTART IDENTITY');
+const maxOverlap = async (tenant) => Number((await q(`
+  WITH ev AS (SELECT started_at t, 1 d FROM executions WHERE tenant=$1 AND ended_at IS NOT NULL
+              UNION ALL SELECT ended_at, -1 FROM executions WHERE tenant=$1 AND ended_at IS NOT NULL)
+  SELECT coalesce(max(c),0)::int m FROM (SELECT sum(d) OVER (ORDER BY t, d) c FROM ev) s`, [tenant]))[0].m);
+const lat = async (where = 'true') => (await q(`SELECT extract(epoch FROM (e.started_at - m.enq_at))*1000 AS ms FROM executions e JOIN task_meta m ON m.id=e.task_id WHERE ${where}`)).map((r) => Number(r.ms));
+
+// ---------- processos ----------
+const procs = new Set();
+function spawnWorker(impl, id, tenants, { slots = 2, skew = 0, env = {} } = {}) {
+  return new Promise((resolve, reject) => {
+    const p = fork(HERE + 'worker.mjs', [], { env: { ...process.env, IMPL: impl, WORKER_ID: id, TENANTS: tenants.join(','), SLOTS: String(slots), CLOCK_SKEW_MS: String(skew), ...env }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
+    procs.add(p); p.on('exit', () => procs.delete(p));
+    p.once('message', () => resolve(p)); p.once('exit', () => reject(new Error('worker saiu')));
+    setTimeout(() => reject(new Error('worker nao ficou pronto')), 90000);
+  });
+}
+const killAll = async () => { for (const p of procs) p.kill('SIGKILL'); await sleep(300); procs.clear(); };
+function runProducer(impl, tasks, { skew = 0, pace = 0, env = {} } = {}) {
+  const p = fork(HERE + 'producer.mjs', [], { env: { ...process.env, IMPL: impl, TASKS: JSON.stringify(tasks), CLOCK_SKEW_MS: String(skew), PACE_MS: String(pace), ...env }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
+  procs.add(p);
+  const done = new Promise((r) => p.on('exit', (c, s) => { procs.delete(p); r({ code: c, signal: s }); }));
+  return { p, done };
+}
+const mk = (pfx, i, tenant, o = {}) => ({ id: `${pfx}-${i}`, tenant, workMs: 0, ...o });
+
+// ---------- cenarios ----------
+async function fresh(impl) { await killAll(); await impl.reset(); await clearFx(); }
+
+const SCN = {
+  async S1(impl, v) { // matar worker no meio da tarefa
+    await fresh(impl);
+    const w1 = await spawnWorker(v.impl, 'w1', ['A']);
+    await impl.enqueue(mk('s1', 1, 'A', { workMs: 3000 }));
+    await waitFor(async () => (await cnt('executions')) >= 1, 30000);
+    await sleep(800); const tk = Date.now(); w1.kill('SIGKILL');
+    await spawnWorker(v.impl, 'w2', ['A']);
+    const ok = await waitFor(async () => (await cnt('effects')) >= 1, 60000);
+    const t = Date.now() - tk;
+    const e = await cnt('effects'), x = await cnt('executions');
+    rec(v.label, 'S1 kill -9 do worker no meio da tarefa', e === 1 && x >= 2 && ok ? 'PASS' : 'FAIL', `efeitos=${e} execucoes=${x} recuperacao=${(t / 1000).toFixed(1)}s (lease/heartbeat ${CFG.leaseMs}ms)`);
+  },
+  async S2(impl, v) { // reinicio do backend (sem/com AOF para Redis)
+    const variants = v.impl === 'bullmq'
+      ? [['restart gracioso, sem AOF', 'noaof', 'graceful'], ['kill -9, sem AOF', 'noaof', 'kill'], ['restart gracioso, AOF everysec', 'everysec', 'graceful'],
+         ['kill -9, AOF everysec', 'everysec', 'kill'], ['kill -9, AOF always', 'always', 'kill']]
+      : [['restart gracioso', null, 'graceful'], ['kill -9', null, 'kill']];
+    for (const [label, mode, how] of variants) {
+      if (mode) { startRedis(mode); await redisReady(); }
+      await fresh(impl);
+      const tasks = Array.from({ length: 50 }, (_, i) => mk('s2', i, i % 2 ? 'A' : 'B', { delayMs: 3000, workMs: 50 }));
+      const pr = runProducer(v.impl, tasks); await pr.done;
+      await restartBackend(v.kind, how);
+      await spawnWorker(v.impl, 'w1', ['A', 'B']); await spawnWorker(v.impl, 'w2', ['A', 'B']);
+      await waitFor(async () => (await cnt('effects')) >= 50, 60000);
+      const e = await cnt('effects'), x = await cnt('executions');
+      rec(v.label, `S2 backend: ${label}`, e === 50 && x === 50 ? 'PASS' : 'FAIL', `efeitos=${e}/50 perdidas=${50 - e} execucoes=${x}`);
+    }
+    if (v.impl === 'bullmq') { startRedis('everysec'); await redisReady(); }
+  },
+  async S3(impl, v) { // entrega duplicada
+    await fresh(impl);
+    const r1 = await impl.enqueue(mk('s3', 1, 'A', { workMs: 200 }));
+    const r2 = await impl.enqueue(mk('s3', 1, 'A', { workMs: 200 }));
+    const w1 = await spawnWorker(v.impl, 'w1', ['A']);
+    await impl.enqueue(mk('s3', 2, 'A', { workMs: 200, crashAfterEffect: true }));
+    await new Promise((r) => w1.once('exit', r)); // worker morre apos o efeito, antes do ack
+    await spawnWorker(v.impl, 'w2', ['A']);
+    await waitFor(async () => (await cnt('executions', "task_id='s3-2' AND ended_at IS NOT NULL")) >= 2 && (await cnt('executions', "task_id='s3-1' AND ended_at IS NOT NULL")) >= 1, 60000);
+    const e = await cnt('effects'), x2 = await cnt('executions', "task_id='s3-2' AND ended_at IS NOT NULL"), x1 = await cnt('executions', "task_id='s3-1'");
+    rec(v.label, 'S3 entrega duplicada (reenvio do produtor + crash apos efeito)', r1 === 'ok' && r2 === 'duplicate' && e === 2 && x1 >= 1 && x2 === 2 ? 'PASS' : 'FAIL',
+      `2o enqueue=${r2}; execucoes s3-1=${x1}, s3-2=${x2} (>1 = redelivery at-least-once); efeitos distintos=${e}/2`);
+  },
+  async S4(impl, v) { // tarefa agendada
+    await fresh(impl);
+    await spawnWorker(v.impl, 'w1', ['A']);
+    await impl.enqueue(mk('s4', 1, 'A', { delayMs: 4000 }));
+    await waitFor(async () => (await cnt('executions')) >= 1, 30000);
+    const [ms] = await lat();
+    rec(v.label, 'S4 tarefa agendada (+4 s)', ms >= 3950 && ms <= 5500 ? 'PASS' : 'FAIL', `inicio ${Math.round(ms)} ms apos o enfileiramento (alvo 4000)`);
+  },
+  async S5(impl, v) { // limite de concorrencia por tenant = 2
+    for (const nw of v.impl === 'temporal' ? [3, 1] : [3]) {
+      await fresh(impl);
+      for (let i = 0; i < nw; i++) await spawnWorker(v.impl, `w${i}`, ['A'], { slots: 2 });
+      const t0 = Date.now();
+      for (let i = 0; i < 10; i++) await impl.enqueue(mk('s5', i, 'A', { workMs: 600 }));
+      await waitFor(async () => (await cnt('effects')) >= 10, 60000);
+      const m = await maxOverlap('A');
+      rec(v.label, `S5 limite 2 por tenant (${nw} worker(s), ${nw * 2} slots)`, m <= CFG.tenantLimit ? 'PASS' : 'FAIL', `concorrencia maxima observada=${m} (limite 2); 10 tarefas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
+    }
+  },
+  async S6(impl, v) { // justica entre tenants sob rajada
+    await fresh(impl);
+    await spawnWorker(v.impl, 'w1', ['A', 'B', 'C'], { slots: 2 }); await spawnWorker(v.impl, 'w2', ['A', 'B', 'C'], { slots: 2 });
+    const burst = Array.from({ length: 120 }, (_, i) => mk('s6a', i, 'A', { workMs: 250 }));
+    for (let i = 0; i < burst.length; i += 30) await Promise.all(burst.slice(i, i + 30).map((t) => impl.enqueue(t)));
+    const small = [...Array.from({ length: 6 }, (_, i) => mk('s6b', i, 'B', { workMs: 250 })), ...Array.from({ length: 6 }, (_, i) => mk('s6c', i, 'C', { workMs: 250 }))];
+    for (const t of small) await impl.enqueue(t);
+    await waitFor(async () => (await cnt('effects')) >= 132, 120000);
+    const lb = await lat("e.tenant IN ('B','C')");
+    const la = await lat("e.tenant='A'");
+    const maxBC = Math.max(...lb);
+    rec(v.label, 'S6 justica sob rajada do tenant A (120 tarefas) para B e C (6+6)', maxBC < 3000 ? 'PASS' : 'FAIL',
+      `espera B/C: p50=${Math.round(pct(lb, 50))} ms, max=${Math.round(maxBC)} ms; espera A: p50=${Math.round(pct(la, 50))} ms, max=${Math.round(Math.max(...la))} ms`);
+  },
+  async S7(impl, v) { // reinicio do Dispatcher (produtor) no meio da rajada
+    await fresh(impl);
+    await spawnWorker(v.impl, 'w1', ['A', 'B']); await spawnWorker(v.impl, 'w2', ['A', 'B']);
+    const tasks = Array.from({ length: 100 }, (_, i) => mk('s7', i, i % 2 ? 'A' : 'B', { workMs: 20 }));
+    const p1 = runProducer(v.impl, tasks, { pace: 40 });
+    await waitFor(async () => (await cnt('task_meta')) >= 40, 60000, 100);
+    p1.p.kill('SIGKILL'); await p1.done;
+    const partial = await cnt('task_meta');
+    const p2 = runProducer(v.impl, tasks); await p2.done; // novo Dispatcher reenvia tudo (idempotente)
+    await waitFor(async () => (await cnt('effects')) >= 100, 90000);
+    await sleep(1500);
+    const e = await cnt('effects'), x = await cnt('executions');
+    rec(v.label, 'S7 reinicio do Dispatcher no meio de 100 tarefas', e === 100 && x >= 100 ? 'PASS' : 'FAIL', `produtor morto apos ~${partial} enfileiradas; apos reenvio: efeitos=${e}/100 execucoes=${x} (${x - 100} reentregas at-least-once absorvidas pela idempotencia)`);
+  },
+  async S8(impl, v) { // relogio dessincronizado
+    await fresh(impl);
+    await spawnWorker(v.impl, 'w1', ['A']);
+    const pr = runProducer(v.impl, [mk('s8', 1, 'A', { delayMs: 8000 })], { skew: 6000 }); await pr.done;
+    await waitFor(async () => (await cnt('executions', "task_id='s8-1'")) >= 1, 40000);
+    const [a] = await lat("e.task_id='s8-1'");
+    rec(v.label, 'S8a produtor com relogio +6 s, tarefa agendada +8 s', a >= 7900 && a <= 10000 ? 'PASS' : 'FAIL', `inicio ${Math.round(a)} ms apos o enfileiramento (alvo 8000)`);
+    await killAll(); await clearFx();
+    await spawnWorker(v.impl, 'w2', ['A'], { skew: 120000 }); // worker com relogio +2 min
+    await impl.enqueue(mk('s8', 2, 'A', { delayMs: 3000, workMs: 500 }));
+    await waitFor(async () => (await cnt('executions', "task_id='s8-2'")) >= 1, 40000);
+    const [b] = await lat("e.task_id='s8-2'");
+    const done = await waitFor(async () => (await cnt('effects')) >= 1, 20000);
+    rec(v.label, 'S8b worker com relogio +2 min, tarefa agendada +3 s', b >= 2950 && b <= 5500 && done ? 'PASS' : 'FAIL', `inicio ${Math.round(b)} ms apos o enfileiramento (alvo 3000); concluida=${!!done}`);
+  },
+  async S9(impl, v) { // tarefa humana aguardando aprovacao (tempo comprimido)
+    await fresh(impl);
+    await spawnWorker(v.impl, 'w1', ['A']);
+    await impl.enqueue(mk('s9', 1, 'A', { approval: true, workMs: 200 }));
+    await sleep(3000);
+    const antes = await cnt('executions');
+    await killAll();
+    await restartBackend(v.kind, 'graceful'); // backend e workers reiniciados durante a espera
+    await impl.approve('s9-1', 'A');
+    await spawnWorker(v.impl, 'w2', ['A']);
+    await waitFor(async () => (await cnt('effects')) >= 1, 60000);
+    const e = await cnt('effects'), x = await cnt('executions');
+    rec(v.label, 'S9 aprovacao humana pendente sobrevive a reinicio (tempo comprimido: segundos, nao dias)', antes === 0 && e === 1 && x === 1 ? 'PASS' : 'FAIL', `execucoes antes da aprovacao=${antes}; apos aprovar: efeitos=${e} execucoes=${x}`);
+  },
+  async S10(impl, v) { // atomicidade com a transacao de negocio (outbox)
+    await fresh(impl);
+    const c = pgConn('dec007_control'); await c.connect();
+    await c.query('TRUNCATE business_orders');
+    await c.query('BEGIN'); await c.query("INSERT INTO business_orders VALUES ('s10-1')");
+    if (v.impl === 'pg') await impl.enqueue(mk('s10', 1, 'A'), c); else await impl.enqueue(mk('s10', 1, 'A'));
+    await c.query('ROLLBACK'); // transacao de negocio abortada
+    const orders = Number((await c.query('SELECT count(*)::int n FROM business_orders')).rows[0].n);
+    let tasks;
+    if (v.impl === 'pg') tasks = Number((await c.query("SELECT count(*)::int n FROM tasks WHERE id='s10-1'")).rows[0].n);
+    else if (v.impl === 'bullmq') tasks = (await impl.queue('A').getJob('s10-1')) ? 1 : 0;
+    else tasks = (await impl.client.workflow.getHandle(`${impl.prefix}-s10-1`).describe().then(() => 1, () => 0));
+    await c.end();
+    rec(v.label, 'S10 rollback da transacao de negocio apos enfileirar', tasks === 0 && orders === 0 ? 'PASS' : 'FAIL',
+      `pedidos=${orders}, tarefas orfas=${tasks}${tasks ? ' (escrita dupla: exige outbox/reconciliacao)' : ' (enfileiramento atomico com o negocio)'}`);
+  },
+};
+
+// ---------- metricas ----------
+async function perf(impl, v, mem) {
+  const backendMb = () => (v.kind === 'pg' ? docker.stats(N.pg) : docker.stats(N[v.kind]));
+  await fresh(impl);
+  const ws = [await spawnWorker(v.impl, 'w1', ['A', 'B', 'C', 'D'], { slots: 2 }), await spawnWorker(v.impl, 'w2', ['A', 'B', 'C', 'D'], { slots: 2 })];
+  await sleep(8000);
+  const idle = { backend: backendMb(), workers: ws.reduce((s, p) => s + rssMb(p.pid), 0) };
+  // P1: latencia fila->inicio com sistema ocioso (30 tarefas espacadas)
+  const T = ['A', 'B', 'C', 'D'];
+  for (let i = 0; i < 30; i++) { await impl.enqueue(mk('p1', i, T[i % 4], { workMs: 0 })); await sleep(250); }
+  await waitFor(async () => (await cnt('effects')) >= 30, 30000);
+  const l1 = await lat("e.task_id LIKE 'p1-%'");
+  // P2: 100 tarefas em 60 s
+  const t0 = Date.now(); let peak = 0;
+  for (let i = 0; i < 100; i++) {
+    const due = t0 + i * 600; await sleep(Math.max(0, due - Date.now()));
+    await impl.enqueue(mk('p2', i, T[i % 4], { workMs: 100 }));
+    if (i === 70) peak = backendMb() + 0;
+  }
+  const peakW = ws.reduce((s, p) => s + rssMb(p.pid), 0);
+  await waitFor(async () => (await cnt('effects', "task_id LIKE 'p2-%'")) >= 100, 30000);
+  const l2 = await lat("e.task_id LIKE 'p2-%'");
+  const fim = (Date.now() - t0) / 1000;
+  // P3: rajada de 500 tarefas triviais
+  const t1 = Date.now();
+  for (let i = 0; i < 500; i += 50) await Promise.all(Array.from({ length: 50 }, (_, j) => impl.enqueue(mk('p3', i + j, T[(i + j) % 4], { workMs: 0 }))));
+  await waitFor(async () => (await cnt('effects', "task_id LIKE 'p3-%'")) >= 500, 180000, 500);
+  const s3 = (Date.now() - t1) / 1000;
+  const done3 = await cnt('effects', "task_id LIKE 'p3-%'");
+  const row = {
+    variant: v.label,
+    ram_idle_backend_mb: Math.round(idle.backend), ram_idle_workers_mb: Math.round(idle.workers),
+    ram_carga_backend_mb: Math.round(peak), ram_carga_workers_mb: Math.round(peakW),
+    lat_ocioso_p50_ms: Math.round(pct(l1, 50)), lat_ocioso_p95_ms: Math.round(pct(l1, 95)),
+    lat_100pm_p50_ms: Math.round(pct(l2, 50)), lat_100pm_p95_ms: Math.round(pct(l2, 95)), lat_100pm_max_ms: Math.round(Math.max(...l2)),
+    concluiu_100_em_s: Number(fim.toFixed(1)), rajada_500: `${done3}/500 em ${s3.toFixed(1)} s (${(done3 / s3).toFixed(0)} tarefas/s)`,
+  };
+  mem.push(row); log('[PERF]', JSON.stringify(row));
+}
+
+// ---------- main ----------
+const only = process.env.ONLY?.split(',');
+const VARIANTS = [
+  { label: 'A PostgreSQL lease', impl: 'pg', kind: 'pg', scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
+  { label: 'B BullMQ (fila por tenant)', impl: 'bullmq', kind: 'redis', env: { BULLMQ_LAYOUT: 'tenant' }, scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
+  { label: 'B2 BullMQ (fila unica)', impl: 'bullmq', kind: 'redis', env: { BULLMQ_LAYOUT: 'shared' }, scn: ['S5', 'S6'] },
+  { label: 'C Temporal', impl: 'temporal', kind: 'temporal', scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
+];
+
+const t00 = Date.now();
+const versions = {};
+try {
+  log(`# PoC DEC-007 ${new Date().toISOString()} node ${process.version}`);
+  startRedis('everysec'); startTemporal(); await startPg();
+  await redisReady(); await temporalReady();
+  versions.pg = sh('docker', ['exec', N.pg, 'postgres', '--version']);
+  versions.redis = sh('docker', ['exec', N.redis, 'redis-server', '--version']);
+  versions.temporal = sh('docker', ['run', '--rm', IMAGES.temporal, '--version']);
+  for (const k of Object.keys(IMAGES)) versions[`img_${k}`] = sh('docker', ['image', 'inspect', IMAGES[k], '--format', '{{index .RepoDigests 0}}']);
+  const pkg = JSON.parse(readFileSync(HERE + 'package.json', 'utf8')).dependencies;
+  log('versoes:', JSON.stringify({ ...versions, deps: pkg }));
+  const perfRows = [];
+  for (const v of VARIANTS) {
+    if (only && !only.some((o) => v.impl === o || v.label.startsWith(o))) continue;
+    Object.assign(process.env, v.env ?? {});
+    const impl = (await import(`./impl-${v.impl}.mjs`)).default;
+    await impl.init();
+    log(`\n## ${v.label}`);
+    for (const s of v.scn) {
+      try { await SCN[s](impl, v); } catch (e) { rec(v.label, s, 'ERRO', String(e.message ?? e).slice(0, 200)); }
+    }
+    if (v.scn.includes('S1') && !process.env.SKIP_PERF) { try { await perf(impl, v, perfRows); } catch (e) { rec(v.label, 'PERF', 'ERRO', String(e.message).slice(0, 200)); } }
+    await killAll(); await impl.close();
+    delete process.env.BULLMQ_LAYOUT;
+  }
+  log('\n## Resumo');
+  for (const r of results) log(`| ${r.variant} | ${r.scn} | ${r.status} | ${r.detail} |`);
+  log('\n## Metricas');
+  for (const r of perfRows) log(JSON.stringify(r));
+  const pgBad = results.filter((r) => r.variant.startsWith('A ') && r.status !== 'PASS');
+  log(`\nOpcao A (PostgreSQL lease): ${pgBad.length === 0 ? 'todos os cenarios PASS' : 'FALHAS: ' + pgBad.map((r) => r.scn).join('; ')}`);
+  process.exitCode = pgBad.length ? 1 : 0;
+} finally {
+  await killAll();
+  await fx.end().catch(() => {});
+  for (const n of Object.values(N)) docker.rm(n);
+  log(`containers destruidos; duracao ${((Date.now() - t00) / 1000).toFixed(0)} s`);
+  process.exit(process.exitCode ?? 0); // conexoes do cliente Temporal/Redis mantem o processo vivo
+}
diff --git a/documentacoes/arquitetura/poc/dec-007/producer.mjs b/documentacoes/arquitetura/poc/dec-007/producer.mjs
new file mode 100644
index 0000000..9b4839c
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/producer.mjs
@@ -0,0 +1,13 @@
+// Processo produtor ("Dispatcher") descartavel: enfileira tarefas e pode ser morto no meio.
+import { applyClockSkew, sleep } from './lib.mjs';
+
+applyClockSkew(Number(process.env.CLOCK_SKEW_MS ?? 0));
+const impl = (await import(`./impl-${process.env.IMPL}.mjs`)).default;
+await impl.init();
+const tasks = JSON.parse(process.env.TASKS);
+for (const t of tasks) {
+  await impl.enqueue(t);
+  if (process.env.PACE_MS) await sleep(Number(process.env.PACE_MS));
+}
+await impl.close();
+process.exit(0);
diff --git a/documentacoes/arquitetura/poc/dec-007/run.sh b/documentacoes/arquitetura/poc/dec-007/run.sh
new file mode 100755
index 0000000..552b8d5
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/run.sh
@@ -0,0 +1,11 @@
+#!/usr/bin/env bash
+# Sobe PostgreSQL, Redis e Temporal (dev) descartaveis em 127.0.0.1, roda a PoC e destroi os containers.
+# Uso: ./run.sh            (tudo, ~10-15 min)   |   ONLY=pg ./run.sh   |   SKIP_PERF=1 ./run.sh
+set -euo pipefail
+cd "$(dirname "$0")"
+export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$HOME/.local/bin:$PATH"
+PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"; export PGPASSWORD  # descartavel, nunca impresso
+trap 'for n in dec007-pg dec007-redis dec007-temporal; do docker rm -fv "$n" >/dev/null 2>&1 || true; done' EXIT
+node --version
+npm ci --silent
+node poc.mjs
diff --git a/documentacoes/arquitetura/poc/dec-007/temporal-workflows.mjs b/documentacoes/arquitetura/poc/dec-007/temporal-workflows.mjs
new file mode 100644
index 0000000..2f0dfbf
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/temporal-workflows.mjs
@@ -0,0 +1,19 @@
+import { proxyActivities, defineSignal, setHandler, condition } from '@temporalio/workflow';
+
+const { runTask } = proxyActivities({
+  startToCloseTimeout: '120 seconds',
+  heartbeatTimeout: '5 seconds', // equivalente a lease/lock de 5 s
+  retry: { initialInterval: '500 milliseconds', backoffCoefficient: 1, maximumAttempts: 5 },
+});
+export const approveSignal = defineSignal('approve');
+
+export async function taskWorkflow(task) {
+  if (task.approval) {
+    let approved = false;
+    setHandler(approveSignal, () => { approved = true; });
+    const ok = await condition(() => approved, '7 days'); // espera duravel, sem worker ocupado
+    if (!ok) return 'expired';
+  }
+  await runTask(task);
+  return 'done';
+}
diff --git a/documentacoes/arquitetura/poc/dec-007/worker.mjs b/documentacoes/arquitetura/poc/dec-007/worker.mjs
new file mode 100644
index 0000000..c81560d
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-007/worker.mjs
@@ -0,0 +1,12 @@
+// Processo worker (filho do poc.mjs). Morto com SIGKILL nos cenarios de falha.
+import { applyClockSkew } from './lib.mjs';
+
+applyClockSkew(Number(process.env.CLOCK_SKEW_MS ?? 0));
+const impl = (await import(`./impl-${process.env.IMPL}.mjs`)).default;
+await impl.init();
+await impl.runWorker({
+  workerId: process.env.WORKER_ID,
+  tenants: (process.env.TENANTS ?? '').split(',').filter(Boolean),
+  slots: Number(process.env.SLOTS ?? 2),
+  ready: () => process.send?.('ready'),
+});
```
