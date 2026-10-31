// Opcao B: BullMQ + Redis. layout 'tenant' = uma fila por tenant (limite global 2 por fila); 'shared' = fila unica.
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { CFG, handle, markEnqueued } from './lib.mjs';

const layout = () => process.env.BULLMQ_LAYOUT ?? 'tenant';
const qname = (tenant) => (layout() === 'shared' ? 'dec007-shared' : `dec007-t-${tenant}`);
const conn = (worker) => {
  const r = new Redis({ host: CFG.host, port: CFG.redisPort, maxRetriesPerRequest: worker ? null : 3, retryStrategy: () => 300 });
  r.on('error', () => {}); // quedas do Redis sao esperadas nos cenarios S2/S9
  return r;
};

export default {
  name: 'bullmq',
  async init() { this.redis = conn(false); this.queues = new Map(); this.capped = new Set(); },
  queue(tenant) {
    const n = qname(tenant);
    if (!this.queues.has(n)) this.queues.set(n, new Queue(n, { connection: conn(false), defaultJobOptions: { removeOnComplete: false } }));
    return this.queues.get(n);
  },
  async reset() {
    for (const q of this.queues.values()) await q.close().catch(() => {});
    this.queues.clear(); this.capped.clear();
    await this.redis.flushall();
  },
  async enqueue(task) {
    await markEnqueued(task);
    const q = this.queue(task.tenant);
    if (layout() === 'tenant' && !this.capped.has(q.name)) { await q.setGlobalConcurrency(CFG.tenantLimit); this.capped.add(q.name); }
    const existing = await q.getJob(task.id);
    if (existing) return 'duplicate';
    await q.add('task', task, { jobId: task.id, delay: task.approval ? 7 * 24 * 3600 * 1000 : (task.delayMs ?? 0), attempts: 5, backoff: { type: 'fixed', delay: 500 } });
    return 'ok';
  },
  async approve(id, tenant) { const j = await this.queue(tenant).getJob(id); await j.promote(); },
  async close() { for (const q of this.queues.values()) await q.close().catch(() => {}); await this.redis.quit().catch(() => {}); },

  async runWorker({ workerId, tenants, slots = 2, ready }) {
    const names = layout() === 'shared' ? [qname('x')] : tenants.map(qname);
    const workers = names.map((n) => new Worker(n, async (job) => {
      await handle(job.data, job.attemptsStarted, workerId, null); // BullMQ renova o lock sozinho
    }, {
      connection: conn(true),
      concurrency: layout() === 'shared' ? slots : CFG.tenantLimit,
      lockDuration: CFG.leaseMs, stalledInterval: 2000, maxStalledCount: 5,
    }));
    workers.forEach((w) => w.on('error', () => {}));
    if (layout() === 'tenant') for (const t of tenants) await this.queue(t).setGlobalConcurrency(CFG.tenantLimit);
    await Promise.all(workers.map((w) => w.waitUntilReady()));
    ready?.();
    await new Promise(() => {});
  },
};
