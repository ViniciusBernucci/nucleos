/** Finaliza apenas os recursos adquiridos e tenta todos mesmo se um fechamento falhar. */
export async function encerrarFixturePg(
  fecharPool: (() => Promise<void>) | undefined,
  removerBanco: (() => Promise<void>) | undefined,
  fecharAdmin: (() => Promise<void>) | undefined,
): Promise<void> {
  try {
    await fecharPool?.();
  } finally {
    try {
      await removerBanco?.();
    } finally {
      await fecharAdmin?.();
    }
  }
}
