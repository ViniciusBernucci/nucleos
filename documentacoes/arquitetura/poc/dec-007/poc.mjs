// PoC DEC-007 (ADR-021): orquestracao duravel de tarefas. Descartavel, so 127.0.0.1, sem dados reais.
import { fork } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Connection } from '@temporalio/client';
import { CFG, sh, sleep, pgConn, pgPool, docker, rssMb, pct, EFFECTS_DDL } from './lib.mjs';
import { DDL as PG_DDL } from './impl-pg.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const N = { pg: 'dec007-pg', redis: 'dec007-redis', temporal: 'dec007-temporal' };
const IMAGES = { pg: 'postgres:16', redis: 'redis:8.8.3-alpine', temporal: 'temporalio/temporal:latest' };
const REDIS_MODES = {
  noaof: ['--save', '', '--appendonly', 'no'],
  everysec: ['--save', '', '--appendonly', 'yes', '--appendfsync', 'everysec'],
  always: ['--save', '', '--appendonly', 'yes', '--appendfsync', 'always'],
};
const results = [];
const log = (...a) => console.log(...a);
const rec = (variant, scn, status, detail) => { results.push({ variant, scn, status, detail }); log(`[${scn}][${variant}] ${status} - ${detail}`); };

// ---------- infraestrutura efemera ----------
async function waitFor(fn, ms, poll = 250) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* ainda subindo */ }
    if (Date.now() > end) return null;
    await sleep(poll);
  }
}
async function startPg() {
  docker.rm(N.pg);
  sh('docker', ['run', '-d', '--name', N.pg, '-p', `127.0.0.1:${CFG.pgPort}:5432`, '-e', `POSTGRES_PASSWORD=${CFG.pgPassword}`, IMAGES.pg]);
  await waitFor(() => { sh('docker', ['exec', N.pg, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']); return true; }, 60000, 500);
  await sleep(2000);
  for (const db of ['dec007_control', 'dec007_effects']) {
    const c = pgConn('postgres'); await c.connect(); await c.query(`CREATE DATABASE ${db}`); await c.end();
  }
  let c = pgConn('dec007_control'); await c.connect();
  await c.query(PG_DDL); await c.query('CREATE TABLE IF NOT EXISTS business_orders (id text PRIMARY KEY)'); await c.end();
  c = pgConn('dec007_effects'); await c.connect(); await c.query(EFFECTS_DDL); await c.end();
}
function startRedis(mode) {
  docker.rm(N.redis);
  sh('docker', ['run', '-d', '--name', N.redis, '-p', `127.0.0.1:${CFG.redisPort}:6379`, IMAGES.redis,
    'redis-server', '--maxmemory-policy', 'noeviction', ...REDIS_MODES[mode]]);
}
const redisReady = () => waitFor(() => sh('docker', ['exec', N.redis, 'redis-cli', 'ping']) === 'PONG', 30000);
function startTemporal() {
  docker.rm(N.temporal);
  sh('docker', ['run', '-d', '--name', N.temporal, '-p', `127.0.0.1:${CFG.temporalPort}:7233`, IMAGES.temporal,
    'server', 'start-dev', '--ip', '0.0.0.0', '--headless', '--db-filename', '/tmp/temporal.db', '--log-level', 'error']);
}
const temporalReady = () => waitFor(async () => {
  const c = await Connection.connect({ address: `${CFG.host}:${CFG.temporalPort}`, connectTimeout: 2000 });
  try { await c.workflowService.getSystemInfo({}); return true; } finally { await c.close(); }
}, 90000, 1000);
async function restartBackend(kind, how) {
  const name = N[kind];
  if (how === 'graceful') sh('docker', ['restart', name]);
  else { sh('docker', ['kill', name]); sh('docker', ['start', name]); }
  if (kind === 'redis') await redisReady();
  else if (kind === 'temporal') await temporalReady();
  else await waitFor(() => { sh('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']); return true; }, 60000, 500);
  await sleep(kind === 'pg' ? 2000 : 500);
}

// ---------- efeitos ----------
const fx = pgPool('dec007_effects', 4); fx.on('error', () => {});
const q = async (sql, p) => { for (let i = 0; i < 40; i++) { try { return (await fx.query(sql, p)).rows; } catch { await sleep(500); } } throw new Error('fx indisponivel'); };
const cnt = async (t, where = 'true') => Number((await q(`SELECT count(*)::int n FROM ${t} WHERE ${where}`))[0].n);
const clearFx = () => q('TRUNCATE task_meta, executions, effects RESTART IDENTITY');
const maxOverlap = async (tenant) => Number((await q(`
  WITH ev AS (SELECT started_at t, 1 d FROM executions WHERE tenant=$1 AND ended_at IS NOT NULL
              UNION ALL SELECT ended_at, -1 FROM executions WHERE tenant=$1 AND ended_at IS NOT NULL)
  SELECT coalesce(max(c),0)::int m FROM (SELECT sum(d) OVER (ORDER BY t, d) c FROM ev) s`, [tenant]))[0].m);
const lat = async (where = 'true') => (await q(`SELECT extract(epoch FROM (e.started_at - m.enq_at))*1000 AS ms FROM executions e JOIN task_meta m ON m.id=e.task_id WHERE ${where}`)).map((r) => Number(r.ms));

// ---------- processos ----------
const procs = new Set();
function spawnWorker(impl, id, tenants, { slots = 2, skew = 0, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const p = fork(HERE + 'worker.mjs', [], { env: { ...process.env, IMPL: impl, WORKER_ID: id, TENANTS: tenants.join(','), SLOTS: String(slots), CLOCK_SKEW_MS: String(skew), ...env }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    procs.add(p); p.on('exit', () => procs.delete(p));
    p.once('message', () => resolve(p)); p.once('exit', () => reject(new Error('worker saiu')));
    setTimeout(() => reject(new Error('worker nao ficou pronto')), 90000);
  });
}
const killAll = async () => { for (const p of procs) p.kill('SIGKILL'); await sleep(300); procs.clear(); };
function runProducer(impl, tasks, { skew = 0, pace = 0, env = {} } = {}) {
  const p = fork(HERE + 'producer.mjs', [], { env: { ...process.env, IMPL: impl, TASKS: JSON.stringify(tasks), CLOCK_SKEW_MS: String(skew), PACE_MS: String(pace), ...env }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  procs.add(p);
  const done = new Promise((r) => p.on('exit', (c, s) => { procs.delete(p); r({ code: c, signal: s }); }));
  return { p, done };
}
const mk = (pfx, i, tenant, o = {}) => ({ id: `${pfx}-${i}`, tenant, workMs: 0, ...o });

// ---------- cenarios ----------
async function fresh(impl) { await killAll(); await impl.reset(); await clearFx(); }

const SCN = {
  async S1(impl, v) { // matar worker no meio da tarefa
    await fresh(impl);
    const w1 = await spawnWorker(v.impl, 'w1', ['A']);
    await impl.enqueue(mk('s1', 1, 'A', { workMs: 3000 }));
    await waitFor(async () => (await cnt('executions')) >= 1, 30000);
    await sleep(800); const tk = Date.now(); w1.kill('SIGKILL');
    await spawnWorker(v.impl, 'w2', ['A']);
    const ok = await waitFor(async () => (await cnt('effects')) >= 1, 60000);
    const t = Date.now() - tk;
    const e = await cnt('effects'), x = await cnt('executions');
    rec(v.label, 'S1 kill -9 do worker no meio da tarefa', e === 1 && x >= 2 && ok ? 'PASS' : 'FAIL', `efeitos=${e} execucoes=${x} recuperacao=${(t / 1000).toFixed(1)}s (lease/heartbeat ${CFG.leaseMs}ms)`);
  },
  async S2(impl, v) { // reinicio do backend (sem/com AOF para Redis)
    const variants = v.impl === 'bullmq'
      ? [['restart gracioso, sem AOF', 'noaof', 'graceful'], ['kill -9, sem AOF', 'noaof', 'kill'], ['restart gracioso, AOF everysec', 'everysec', 'graceful'],
         ['kill -9, AOF everysec', 'everysec', 'kill'], ['kill -9, AOF always', 'always', 'kill']]
      : [['restart gracioso', null, 'graceful'], ['kill -9', null, 'kill']];
    for (const [label, mode, how] of variants) {
      if (mode) { startRedis(mode); await redisReady(); }
      await fresh(impl);
      const tasks = Array.from({ length: 50 }, (_, i) => mk('s2', i, i % 2 ? 'A' : 'B', { delayMs: 3000, workMs: 50 }));
      const pr = runProducer(v.impl, tasks); await pr.done;
      await restartBackend(v.kind, how);
      await spawnWorker(v.impl, 'w1', ['A', 'B']); await spawnWorker(v.impl, 'w2', ['A', 'B']);
      await waitFor(async () => (await cnt('effects')) >= 50, 60000);
      const e = await cnt('effects'), x = await cnt('executions');
      rec(v.label, `S2 backend: ${label}`, e === 50 && x === 50 ? 'PASS' : 'FAIL', `efeitos=${e}/50 perdidas=${50 - e} execucoes=${x}`);
    }
    if (v.impl === 'bullmq') { startRedis('everysec'); await redisReady(); }
  },
  async S3(impl, v) { // entrega duplicada
    await fresh(impl);
    const r1 = await impl.enqueue(mk('s3', 1, 'A', { workMs: 200 }));
    const r2 = await impl.enqueue(mk('s3', 1, 'A', { workMs: 200 }));
    const w1 = await spawnWorker(v.impl, 'w1', ['A']);
    await impl.enqueue(mk('s3', 2, 'A', { workMs: 200, crashAfterEffect: true }));
    await new Promise((r) => w1.once('exit', r)); // worker morre apos o efeito, antes do ack
    await spawnWorker(v.impl, 'w2', ['A']);
    await waitFor(async () => (await cnt('executions', "task_id='s3-2' AND ended_at IS NOT NULL")) >= 2 && (await cnt('executions', "task_id='s3-1' AND ended_at IS NOT NULL")) >= 1, 60000);
    const e = await cnt('effects'), x2 = await cnt('executions', "task_id='s3-2' AND ended_at IS NOT NULL"), x1 = await cnt('executions', "task_id='s3-1'");
    rec(v.label, 'S3 entrega duplicada (reenvio do produtor + crash apos efeito)', r1 === 'ok' && r2 === 'duplicate' && e === 2 && x1 >= 1 && x2 === 2 ? 'PASS' : 'FAIL',
      `2o enqueue=${r2}; execucoes s3-1=${x1}, s3-2=${x2} (>1 = redelivery at-least-once); efeitos distintos=${e}/2`);
  },
  async S4(impl, v) { // tarefa agendada
    await fresh(impl);
    await spawnWorker(v.impl, 'w1', ['A']);
    await impl.enqueue(mk('s4', 1, 'A', { delayMs: 4000 }));
    await waitFor(async () => (await cnt('executions')) >= 1, 30000);
    const [ms] = await lat();
    rec(v.label, 'S4 tarefa agendada (+4 s)', ms >= 3950 && ms <= 5500 ? 'PASS' : 'FAIL', `inicio ${Math.round(ms)} ms apos o enfileiramento (alvo 4000)`);
  },
  async S5(impl, v) { // limite de concorrencia por tenant = 2
    for (const nw of v.impl === 'temporal' ? [3, 1] : [3]) {
      await fresh(impl);
      for (let i = 0; i < nw; i++) await spawnWorker(v.impl, `w${i}`, ['A'], { slots: 2 });
      const t0 = Date.now();
      for (let i = 0; i < 10; i++) await impl.enqueue(mk('s5', i, 'A', { workMs: 600 }));
      await waitFor(async () => (await cnt('effects')) >= 10, 60000);
      const m = await maxOverlap('A');
      rec(v.label, `S5 limite 2 por tenant (${nw} worker(s), ${nw * 2} slots)`, m <= CFG.tenantLimit ? 'PASS' : 'FAIL', `concorrencia maxima observada=${m} (limite 2); 10 tarefas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  },
  async S6(impl, v) { // justica entre tenants sob rajada
    await fresh(impl);
    await spawnWorker(v.impl, 'w1', ['A', 'B', 'C'], { slots: 2 }); await spawnWorker(v.impl, 'w2', ['A', 'B', 'C'], { slots: 2 });
    const burst = Array.from({ length: 120 }, (_, i) => mk('s6a', i, 'A', { workMs: 250 }));
    for (let i = 0; i < burst.length; i += 30) await Promise.all(burst.slice(i, i + 30).map((t) => impl.enqueue(t)));
    const small = [...Array.from({ length: 6 }, (_, i) => mk('s6b', i, 'B', { workMs: 250 })), ...Array.from({ length: 6 }, (_, i) => mk('s6c', i, 'C', { workMs: 250 }))];
    for (const t of small) await impl.enqueue(t);
    await waitFor(async () => (await cnt('effects')) >= 132, 120000);
    const lb = await lat("e.tenant IN ('B','C')");
    const la = await lat("e.tenant='A'");
    const maxBC = Math.max(...lb);
    rec(v.label, 'S6 justica sob rajada do tenant A (120 tarefas) para B e C (6+6)', maxBC < 3000 ? 'PASS' : 'FAIL',
      `espera B/C: p50=${Math.round(pct(lb, 50))} ms, max=${Math.round(maxBC)} ms; espera A: p50=${Math.round(pct(la, 50))} ms, max=${Math.round(Math.max(...la))} ms`);
  },
  async S7(impl, v) { // reinicio do Dispatcher (produtor) no meio da rajada
    await fresh(impl);
    await spawnWorker(v.impl, 'w1', ['A', 'B']); await spawnWorker(v.impl, 'w2', ['A', 'B']);
    const tasks = Array.from({ length: 100 }, (_, i) => mk('s7', i, i % 2 ? 'A' : 'B', { workMs: 20 }));
    const p1 = runProducer(v.impl, tasks, { pace: 40 });
    await waitFor(async () => (await cnt('task_meta')) >= 40, 60000, 100);
    p1.p.kill('SIGKILL'); await p1.done;
    const partial = await cnt('task_meta');
    const p2 = runProducer(v.impl, tasks); await p2.done; // novo Dispatcher reenvia tudo (idempotente)
    await waitFor(async () => (await cnt('effects')) >= 100, 90000);
    await sleep(1500);
    const e = await cnt('effects'), x = await cnt('executions');
    rec(v.label, 'S7 reinicio do Dispatcher no meio de 100 tarefas', e === 100 && x >= 100 ? 'PASS' : 'FAIL', `produtor morto apos ~${partial} enfileiradas; apos reenvio: efeitos=${e}/100 execucoes=${x} (${x - 100} reentregas at-least-once absorvidas pela idempotencia)`);
  },
  async S8(impl, v) { // relogio dessincronizado
    await fresh(impl);
    await spawnWorker(v.impl, 'w1', ['A']);
    const pr = runProducer(v.impl, [mk('s8', 1, 'A', { delayMs: 8000 })], { skew: 6000 }); await pr.done;
    await waitFor(async () => (await cnt('executions', "task_id='s8-1'")) >= 1, 40000);
    const [a] = await lat("e.task_id='s8-1'");
    rec(v.label, 'S8a produtor com relogio +6 s, tarefa agendada +8 s', a >= 7900 && a <= 10000 ? 'PASS' : 'FAIL', `inicio ${Math.round(a)} ms apos o enfileiramento (alvo 8000)`);
    await killAll(); await clearFx();
    await spawnWorker(v.impl, 'w2', ['A'], { skew: 120000 }); // worker com relogio +2 min
    await impl.enqueue(mk('s8', 2, 'A', { delayMs: 3000, workMs: 500 }));
    await waitFor(async () => (await cnt('executions', "task_id='s8-2'")) >= 1, 40000);
    const [b] = await lat("e.task_id='s8-2'");
    const done = await waitFor(async () => (await cnt('effects')) >= 1, 20000);
    rec(v.label, 'S8b worker com relogio +2 min, tarefa agendada +3 s', b >= 2950 && b <= 5500 && done ? 'PASS' : 'FAIL', `inicio ${Math.round(b)} ms apos o enfileiramento (alvo 3000); concluida=${!!done}`);
  },
  async S9(impl, v) { // tarefa humana aguardando aprovacao (tempo comprimido)
    await fresh(impl);
    await spawnWorker(v.impl, 'w1', ['A']);
    await impl.enqueue(mk('s9', 1, 'A', { approval: true, workMs: 200 }));
    await sleep(3000);
    const antes = await cnt('executions');
    await killAll();
    await restartBackend(v.kind, 'graceful'); // backend e workers reiniciados durante a espera
    await impl.approve('s9-1', 'A');
    await spawnWorker(v.impl, 'w2', ['A']);
    await waitFor(async () => (await cnt('effects')) >= 1, 60000);
    const e = await cnt('effects'), x = await cnt('executions');
    rec(v.label, 'S9 aprovacao humana pendente sobrevive a reinicio (tempo comprimido: segundos, nao dias)', antes === 0 && e === 1 && x === 1 ? 'PASS' : 'FAIL', `execucoes antes da aprovacao=${antes}; apos aprovar: efeitos=${e} execucoes=${x}`);
  },
  async S10(impl, v) { // atomicidade com a transacao de negocio (outbox)
    await fresh(impl);
    const c = pgConn('dec007_control'); await c.connect();
    await c.query('TRUNCATE business_orders');
    await c.query('BEGIN'); await c.query("INSERT INTO business_orders VALUES ('s10-1')");
    if (v.impl === 'pg') await impl.enqueue(mk('s10', 1, 'A'), c); else await impl.enqueue(mk('s10', 1, 'A'));
    await c.query('ROLLBACK'); // transacao de negocio abortada
    const orders = Number((await c.query('SELECT count(*)::int n FROM business_orders')).rows[0].n);
    let tasks;
    if (v.impl === 'pg') tasks = Number((await c.query("SELECT count(*)::int n FROM tasks WHERE id='s10-1'")).rows[0].n);
    else if (v.impl === 'bullmq') tasks = (await impl.queue('A').getJob('s10-1')) ? 1 : 0;
    else tasks = (await impl.client.workflow.getHandle(`${impl.prefix}-s10-1`).describe().then(() => 1, () => 0));
    await c.end();
    rec(v.label, 'S10 rollback da transacao de negocio apos enfileirar', tasks === 0 && orders === 0 ? 'PASS' : 'FAIL',
      `pedidos=${orders}, tarefas orfas=${tasks}${tasks ? ' (escrita dupla: exige outbox/reconciliacao)' : ' (enfileiramento atomico com o negocio)'}`);
  },
};

// ---------- metricas ----------
async function perf(impl, v, mem) {
  const backendMb = () => (v.kind === 'pg' ? docker.stats(N.pg) : docker.stats(N[v.kind]));
  await fresh(impl);
  const ws = [await spawnWorker(v.impl, 'w1', ['A', 'B', 'C', 'D'], { slots: 2 }), await spawnWorker(v.impl, 'w2', ['A', 'B', 'C', 'D'], { slots: 2 })];
  await sleep(8000);
  const idle = { backend: backendMb(), workers: ws.reduce((s, p) => s + rssMb(p.pid), 0) };
  // P1: latencia fila->inicio com sistema ocioso (30 tarefas espacadas)
  const T = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 30; i++) { await impl.enqueue(mk('p1', i, T[i % 4], { workMs: 0 })); await sleep(250); }
  await waitFor(async () => (await cnt('effects')) >= 30, 30000);
  const l1 = await lat("e.task_id LIKE 'p1-%'");
  // P2: 100 tarefas em 60 s
  const t0 = Date.now(); let peak = 0;
  for (let i = 0; i < 100; i++) {
    const due = t0 + i * 600; await sleep(Math.max(0, due - Date.now()));
    await impl.enqueue(mk('p2', i, T[i % 4], { workMs: 100 }));
    if (i === 70) peak = backendMb() + 0;
  }
  const peakW = ws.reduce((s, p) => s + rssMb(p.pid), 0);
  await waitFor(async () => (await cnt('effects', "task_id LIKE 'p2-%'")) >= 100, 30000);
  const l2 = await lat("e.task_id LIKE 'p2-%'");
  const fim = (Date.now() - t0) / 1000;
  // P3: rajada de 500 tarefas triviais
  const t1 = Date.now();
  for (let i = 0; i < 500; i += 50) await Promise.all(Array.from({ length: 50 }, (_, j) => impl.enqueue(mk('p3', i + j, T[(i + j) % 4], { workMs: 0 }))));
  await waitFor(async () => (await cnt('effects', "task_id LIKE 'p3-%'")) >= 500, 180000, 500);
  const s3 = (Date.now() - t1) / 1000;
  const done3 = await cnt('effects', "task_id LIKE 'p3-%'");
  const row = {
    variant: v.label,
    ram_idle_backend_mb: Math.round(idle.backend), ram_idle_workers_mb: Math.round(idle.workers),
    ram_carga_backend_mb: Math.round(peak), ram_carga_workers_mb: Math.round(peakW),
    lat_ocioso_p50_ms: Math.round(pct(l1, 50)), lat_ocioso_p95_ms: Math.round(pct(l1, 95)),
    lat_100pm_p50_ms: Math.round(pct(l2, 50)), lat_100pm_p95_ms: Math.round(pct(l2, 95)), lat_100pm_max_ms: Math.round(Math.max(...l2)),
    concluiu_100_em_s: Number(fim.toFixed(1)), rajada_500: `${done3}/500 em ${s3.toFixed(1)} s (${(done3 / s3).toFixed(0)} tarefas/s)`,
  };
  mem.push(row); log('[PERF]', JSON.stringify(row));
}

// ---------- main ----------
const only = process.env.ONLY?.split(',');
const VARIANTS = [
  { label: 'A PostgreSQL lease', impl: 'pg', kind: 'pg', scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
  { label: 'B BullMQ (fila por tenant)', impl: 'bullmq', kind: 'redis', env: { BULLMQ_LAYOUT: 'tenant' }, scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
  { label: 'B2 BullMQ (fila unica)', impl: 'bullmq', kind: 'redis', env: { BULLMQ_LAYOUT: 'shared' }, scn: ['S5', 'S6'] },
  { label: 'C Temporal', impl: 'temporal', kind: 'temporal', scn: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
];

const t00 = Date.now();
const versions = {};
try {
  log(`# PoC DEC-007 ${new Date().toISOString()} node ${process.version}`);
  startRedis('everysec'); startTemporal(); await startPg();
  await redisReady(); await temporalReady();
  versions.pg = sh('docker', ['exec', N.pg, 'postgres', '--version']);
  versions.redis = sh('docker', ['exec', N.redis, 'redis-server', '--version']);
  versions.temporal = sh('docker', ['run', '--rm', IMAGES.temporal, '--version']);
  for (const k of Object.keys(IMAGES)) versions[`img_${k}`] = sh('docker', ['image', 'inspect', IMAGES[k], '--format', '{{index .RepoDigests 0}}']);
  const pkg = JSON.parse(readFileSync(HERE + 'package.json', 'utf8')).dependencies;
  log('versoes:', JSON.stringify({ ...versions, deps: pkg }));
  const perfRows = [];
  for (const v of VARIANTS) {
    if (only && !only.some((o) => v.impl === o || v.label.startsWith(o))) continue;
    Object.assign(process.env, v.env ?? {});
    const impl = (await import(`./impl-${v.impl}.mjs`)).default;
    await impl.init();
    log(`\n## ${v.label}`);
    for (const s of v.scn) {
      try { await SCN[s](impl, v); } catch (e) { rec(v.label, s, 'ERRO', String(e.message ?? e).slice(0, 200)); }
    }
    if (v.scn.includes('S1') && !process.env.SKIP_PERF) { try { await perf(impl, v, perfRows); } catch (e) { rec(v.label, 'PERF', 'ERRO', String(e.message).slice(0, 200)); } }
    await killAll(); await impl.close();
    delete process.env.BULLMQ_LAYOUT;
  }
  log('\n## Resumo');
  for (const r of results) log(`| ${r.variant} | ${r.scn} | ${r.status} | ${r.detail} |`);
  log('\n## Metricas');
  for (const r of perfRows) log(JSON.stringify(r));
  const pgBad = results.filter((r) => r.variant.startsWith('A ') && r.status !== 'PASS');
  log(`\nOpcao A (PostgreSQL lease): ${pgBad.length === 0 ? 'todos os cenarios PASS' : 'FALHAS: ' + pgBad.map((r) => r.scn).join('; ')}`);
  process.exitCode = pgBad.length ? 1 : 0;
} finally {
  await killAll();
  await fx.end().catch(() => {});
  for (const n of Object.values(N)) docker.rm(n);
  log(`containers destruidos; duracao ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  process.exit(process.exitCode ?? 0); // conexoes do cliente Temporal/Redis mantem o processo vivo
}
