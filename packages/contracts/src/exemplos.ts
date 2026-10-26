import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Um caso de exemplo: arquivo em exemplos/<schema>[/<def>]/(validos|invalidos)/*.json. */
export interface Exemplo {
  schema: string;
  def: string | undefined;
  valido: boolean;
  nome: string;
  dado: unknown;
}

/**
 * Le os exemplos compartilhados (fonte unica para TypeScript e Python: os mesmos arquivos sao
 * executados nas duas linguagens e o resultado esperado e dado pelo diretorio).
 */
export function carregarExemplos(raiz: string): Exemplo[] {
  const saida: Exemplo[] = [];
  const percorrer = (dir: string, schema: string, def: string | undefined): void => {
    for (const nome of readdirSync(dir).sort()) {
      const caminho = join(dir, nome);
      if (!statSync(caminho).isDirectory()) continue;
      if (nome === "validos" || nome === "invalidos") {
        for (const arq of readdirSync(caminho).sort()) {
          saida.push({
            schema,
            def,
            valido: nome === "validos",
            nome: arq,
            dado: JSON.parse(readFileSync(join(caminho, arq), "utf8")) as unknown,
          });
        }
      } else {
        percorrer(caminho, schema, nome);
      }
    }
  };
  for (const schema of readdirSync(raiz).sort()) {
    const caminho = join(raiz, schema);
    if (statSync(caminho).isDirectory()) percorrer(caminho, schema, undefined);
  }
  return saida;
}
