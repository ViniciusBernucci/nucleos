// Opcao A: tabela PostgreSQL com lease (FOR UPDATE SKIP LOCKED), limite e justica por tenant.
import { CFG, sleep, handle, markEnqueued } from './lib.mjs';
import { pgPool } from './lib.mjs';

export const DDL = `
CREATE TABLE IF NOT EXISTS tenant_state (tenant text PRIMARY KEY, last_served_at timestamptz, max_running int NOT NULL DEFAULT 2);
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,                       -- chave de idempotencia do produtor
  tenant text NOT NULL REFERENCES tenant_state(tenant),
  state text NOT NULL CHECK (state IN ('awaiting_approval','queued','running','done')),
  run_at timestamptz NOT NULL DEFAULT now(),
  attempt int NOT NULL DEFAULT 0,
  lease_until timestamptz, lease_owner text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  done_at timestamptz);
CREATE INDEX IF NOT EXISTS tasks_claim_idx ON tasks (tenant, state, run_at);`;

export default {
  name: 'pg',
  async init() { this.pool = pgPool('dec007_control', 8); this.pool.on('error', () => {}); },
  async reset() {
    await this.pool.query('TRUNCATE tasks, tenant_state CASCADE');
  },
  // delayMs e calculado no servidor (now() + intervalo): independe do relogio do cliente.
  async enqueue(task, client = this.pool) {
    await markEnqueued(task);
    await client.query('INSERT INTO tenant_state (tenant, max_running) VALUES ($1,$2) ON CONFLICT DO NOTHING', [task.tenant, CFG.tenantLimit]);
    const state = task.approval ? 'awaiting_approval' : 'queued';
    const r = await client.query(
      `INSERT INTO tasks (id, tenant, state, run_at, payload) VALUES ($1,$2,$3, now() + ($4::int * interval '1 millisecond'), $5)
       ON CONFLICT (id) DO NOTHING`,
      [task.id, task.tenant, state, task.delayMs ?? 0, task]);
    return r.rowCount === 1 ? 'ok' : 'duplicate';
  },
  async approve(id) {
    await this.pool.query("UPDATE tasks SET state='queued', run_at=now() WHERE id=$1 AND state='awaiting_approval'", [id]);
  },
  async close() { await this.pool.end().catch(() => {}); },

  // ---- processo worker ----
  async claim(workerId) {
    const eligible = `((k.state='queued' AND k.run_at<=now()) OR (k.state='running' AND k.lease_until<=now()))`;
    const { rows: cands } = await this.pool.query(
      `SELECT ts.tenant FROM tenant_state ts
        WHERE EXISTS (SELECT 1 FROM tasks k WHERE k.tenant=ts.tenant AND ${eligible})
        ORDER BY ts.last_served_at NULLS FIRST LIMIT 8`);
    for (const { tenant } of cands) {
      const c = await this.pool.connect();
      try {
        await c.query('BEGIN');
        // Trava a linha do tenant: serializa reivindicacoes do mesmo tenant (contagem correta do limite).
        const lock = await c.query('SELECT max_running FROM tenant_state WHERE tenant=$1 FOR UPDATE SKIP LOCKED', [tenant]);
        if (lock.rowCount === 0) { await c.query('ROLLBACK'); continue; }
        const run = await c.query("SELECT count(*)::int n FROM tasks WHERE tenant=$1 AND state='running' AND lease_until>now()", [tenant]);
        if (run.rows[0].n >= lock.rows[0].max_running) { await c.query('ROLLBACK'); continue; }
        const got = await c.query(
          `UPDATE tasks SET state='running', attempt=attempt+1, lease_owner=$2, lease_until=now()+($3::int * interval '1 millisecond')
            WHERE id=(SELECT k.id FROM tasks k WHERE k.tenant=$1 AND ${eligible} ORDER BY k.run_at, k.created_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING id, attempt, payload`, [tenant, workerId, CFG.leaseMs]);
        if (got.rowCount === 0) { await c.query('ROLLBACK'); continue; }
        await c.query('UPDATE tenant_state SET last_served_at=clock_timestamp() WHERE tenant=$1', [tenant]);
        await c.query('COMMIT');
        return got.rows[0];
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    }
    return null;
  },
  async runWorker({ workerId, slots = 2, ready }) {
    ready?.();
    const loop = async () => {
      for (;;) {
        try {
          const job = await this.claim(workerId);
          if (!job) { await sleep(100 + Math.random() * 50); continue; }
          const hb = () => this.pool.query(
            "UPDATE tasks SET lease_until=now()+($3::int * interval '1 millisecond') WHERE id=$1 AND attempt=$2 AND state='running'", [job.id, job.attempt, CFG.leaseMs]);
          await handle(job.payload, job.attempt, workerId, hb);
          // fencing: so conclui quem ainda detem a tentativa corrente
          await this.pool.query("UPDATE tasks SET state='done', done_at=now() WHERE id=$1 AND attempt=$2 AND state='running'", [job.id, job.attempt]);
        } catch { await sleep(500); } // banco indisponivel: tenta de novo; a lease expira e outro worker assume
      }
    };
    await Promise.all(Array.from({ length: slots }, loop));
  },
};
