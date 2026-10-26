// DEVE FALHAR: @typescript-eslint/no-unsafe-member-access (any vindo de JSON.parse)
export function ler(texto: string): string {
  const dado = JSON.parse(texto);
  return dado.nome;
}
