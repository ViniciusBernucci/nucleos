// DEVE FALHAR: no-new-func
export function compilar(corpo: string): () => unknown {
  return new Function(corpo) as () => unknown;
}
