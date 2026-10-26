import { constants, lstatSync, readFileSync } from "node:fs";

/** Tamanho maximo aceito para um arquivo de segredo (evita ler arquivo arbitrario grande). */
export const MAX_SECRET_BYTES = 16 * 1024;

/**
 * Segredo lido de arquivo. Nunca imprime o valor: `toString`, `toJSON` e `inspect` devolvem
 * `[REDACTED]`. O valor so sai por `reveal()`, chamado no ponto de uso (ex.: abrir conexao).
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "Secret([REDACTED])";
  }
}

/** Falha de leitura de segredo: o motivo e um codigo fixo; o caminho e o conteudo nunca entram. */
export class SecretFileError extends Error {
  constructor(readonly reason: SecretFileReason) {
    super(`arquivo de segredo invalido: ${reason}`);
    this.name = "SecretFileError";
  }
}

export type SecretFileReason =
  | "ausente"
  | "nao-e-arquivo-regular"
  | "link-simbolico"
  | "permissoes-abertas"
  | "dono-diferente"
  | "vazio"
  | "grande-demais"
  | "ilegivel";

/**
 * Le um segredo de arquivo com checagens (ADR-020, item 1): arquivo regular (sem link simbolico),
 * sem nenhuma permissao para grupo/outros (mascara 0o077), do mesmo dono do processo, nao vazio
 * e com tamanho limitado. Remove um unico `\n` final (formato comum de arquivos criados por shell).
 */
export function readSecretFile(path: string): Secret {
  let st;
  try {
    st = lstatSync(path);
  } catch {
    throw new SecretFileError("ausente");
  }
  if (st.isSymbolicLink()) throw new SecretFileError("link-simbolico");
  if (!st.isFile()) throw new SecretFileError("nao-e-arquivo-regular");
  if ((st.mode & 0o077) !== 0) throw new SecretFileError("permissoes-abertas");
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
    throw new SecretFileError("dono-diferente");
  }
  if (st.size === 0) throw new SecretFileError("vazio");
  if (st.size > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
  let raw: string;
  try {
    // O_NOFOLLOW fecha a janela entre lstat e leitura (troca por link simbolico).
    raw = readFileSync(path, { encoding: "utf8", flag: constants.O_RDONLY | constants.O_NOFOLLOW });
  } catch {
    throw new SecretFileError("ilegivel");
  }
  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (value.length === 0) throw new SecretFileError("vazio");
  return new Secret(value);
}
