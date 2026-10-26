// Processo worker (filho do poc.mjs). Morto com SIGKILL nos cenarios de falha.
import { applyClockSkew } from './lib.mjs';

applyClockSkew(Number(process.env.CLOCK_SKEW_MS ?? 0));
const impl = (await import(`./impl-${process.env.IMPL}.mjs`)).default;
await impl.init();
await impl.runWorker({
  workerId: process.env.WORKER_ID,
  tenants: (process.env.TENANTS ?? '').split(',').filter(Boolean),
  slots: Number(process.env.SLOTS ?? 2),
  ready: () => process.send?.('ready'),
});
