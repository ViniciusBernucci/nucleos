// Opcao C: Temporal (servidor dev em container). Uma task queue por tenant.
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { NativeConnection, Worker, Runtime, DefaultLogger, bundleWorkflowCode } from '@temporalio/worker';
import { Context } from '@temporalio/activity';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { CFG, handle, markEnqueued } from './lib.mjs';

const address = () => `${CFG.host}:${CFG.temporalPort}`;
const WF = fileURLToPath(new URL('./temporal-workflows.mjs', import.meta.url));
const CACHE = fileURLToPath(new URL('./.bundle-cache.json', import.meta.url));
// Empacota os workflows uma vez (webpack e caro) e reaproveita entre os workers.
async function loadBundle() {
  if (existsSync(CACHE) && statSync(CACHE).mtimeMs > statSync(WF).mtimeMs) return JSON.parse(readFileSync(CACHE, 'utf8'));
  const b = await bundleWorkflowCode({ workflowsPath: WF });
  writeFileSync(CACHE, JSON.stringify({ code: b.code }));
  return { code: b.code };
}
export const tq = (prefix, tenant) => `${prefix}-${tenant}`;

export default {
  name: 'temporal',
  prefix: process.env.TQ_PREFIX ?? 'run',
  async init() {
    this.conn = await Connection.connect({ address: address() });
    this.client = new Client({ connection: this.conn });
  },
  async reset() { this.prefix = `r${Date.now().toString(36)}`; process.env.TQ_PREFIX = this.prefix; },
  async enqueue(task) {
    await markEnqueued(task);
    try {
      await this.client.workflow.start('taskWorkflow', {
        args: [task], taskQueue: tq(this.prefix, task.tenant), workflowId: `${this.prefix}-${task.id}`,
        startDelay: task.delayMs ? task.delayMs : undefined,
      });
      return 'ok';
    } catch (e) {
      if (e instanceof WorkflowExecutionAlreadyStartedError) return 'duplicate';
      throw e;
    }
  },
  async approve(id) { await this.client.workflow.getHandle(`${this.prefix}-${id}`).signal('approve'); },
  async close() { await this.conn?.close().catch(() => {}); },

  async runWorker({ workerId, tenants, ready }) {
    Runtime.install({ logger: new DefaultLogger('ERROR') });
    const connection = await NativeConnection.connect({ address: address() });
    const activities = {
      async runTask(task) {
        const info = Context.current().info;
        await handle(task, info.attempt, workerId, async () => Context.current().heartbeat());
      },
    };
    const workflowBundle = await loadBundle();
    const workers = await Promise.all(tenants.map((t) => Worker.create({
      connection, taskQueue: tq(process.env.TQ_PREFIX, t), activities,
      workflowBundle,
      maxConcurrentActivityTaskExecutions: CFG.tenantLimit, // limite por worker, nao global
    })));
    ready?.();
    await Promise.all(workers.map((w) => w.run()));
  },
};
