// DEVE FALHAR: no-eval
export function executar(codigo: string): unknown {
  return eval(codigo);
}
