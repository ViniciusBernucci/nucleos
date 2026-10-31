// Processo produtor ("Dispatcher") descartavel: enfileira tarefas e pode ser morto no meio.
import { applyClockSkew, sleep } from './lib.mjs';

applyClockSkew(Number(process.env.CLOCK_SKEW_MS ?? 0));
const impl = (await import(`./impl-${process.env.IMPL}.mjs`)).default;
await impl.init();
const tasks = JSON.parse(process.env.TASKS);
for (const t of tasks) {
  await impl.enqueue(t);
  if (process.env.PACE_MS) await sleep(Number(process.env.PACE_MS));
}
await impl.close();
process.exit(0);
