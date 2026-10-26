import { proxyActivities, defineSignal, setHandler, condition } from '@temporalio/workflow';

const { runTask } = proxyActivities({
  startToCloseTimeout: '120 seconds',
  heartbeatTimeout: '5 seconds', // equivalente a lease/lock de 5 s
  retry: { initialInterval: '500 milliseconds', backoffCoefficient: 1, maximumAttempts: 5 },
});
export const approveSignal = defineSignal('approve');

export async function taskWorkflow(task) {
  if (task.approval) {
    let approved = false;
    setHandler(approveSignal, () => { approved = true; });
    const ok = await condition(() => approved, '7 days'); // espera duravel, sem worker ocupado
    if (!ok) return 'expired';
  }
  await runTask(task);
  return 'done';
}
