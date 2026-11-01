/**
 * Executa `tarefa` a cada `intervaloMs`, sem sobrepor execucoes na mesma instancia
 * (entre instancias, quem protege e o lock do banco). Erros ficam no log, nunca derrubam o processo.
 */
export class Agendador {
  #timer: NodeJS.Timeout | undefined;
  #rodando = false;

  constructor(
    private readonly tarefa: () => Promise<unknown>,
    private readonly intervaloMs: number,
    private readonly log: (mensagem: string) => void = () => undefined,
  ) {}

  /** Dispara a primeira rodada de imediato (sem bloquear a subida) e agenda as seguintes. */
  iniciar(): void {
    if (this.#timer !== undefined) return;
    void this.rodar();
    this.#timer = setInterval(() => void this.rodar(), this.intervaloMs);
    this.#timer.unref(); // o agendador sozinho nao mantem o processo vivo
  }

  parar(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async rodar(): Promise<boolean> {
    if (this.#rodando) return false;
    this.#rodando = true;
    try {
      await this.tarefa();
    } catch {
      this.log("vendas: a rodada agendada falhou");
    } finally {
      this.#rodando = false;
    }
    return true;
  }
}
