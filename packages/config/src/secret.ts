import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";

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

function openNoFollow(path: string): number {
  try {
    // O_NOFOLLOW: link simbolico no ultimo componente => ELOOP. O_NONBLOCK: nao trava em FIFO.
    // (o Node ja abre com close-on-exec)
    return openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ELOOP") throw new SecretFileError("link-simbolico");
    if (code === "ENOENT" || code === "ENOTDIR") throw new SecretFileError("ausente");
    throw new SecretFileError("ilegivel");
  }
}

/**
 * Le um segredo de arquivo (ADR-020, item 1). Abre primeiro (`O_NOFOLLOW`) e confere tudo por
 * `fstat` no descritor aberto, sem janela entre checagem e leitura: arquivo regular, sem
 * permissoes para grupo/outros (mascara 0o077), do mesmo dono do processo, nao vazio, no maximo
 * `MAX_SECRET_BYTES` (a leitura e limitada a esse tamanho + 1), UTF-8 valido. Remove um `\n` final.
 */
export function readSecretFile(path: string): Secret {
  const fd = openNoFollow(path);
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new SecretFileError("nao-e-arquivo-regular");
    if ((st.mode & 0o077) !== 0) throw new SecretFileError("permissoes-abertas");
    if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
      throw new SecretFileError("dono-diferente");
    }
    if (st.size === 0) throw new SecretFileError("vazio");
    if (st.size > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
    const buf = Buffer.alloc(MAX_SECRET_BYTES + 1);
    let total = 0;
    try {
      for (;;) {
        const n = readSync(fd, buf, total, buf.length - total, null);
        if (n === 0) break;
        total += n;
        if (total > MAX_SECRET_BYTES) throw new SecretFileError("grande-demais");
      }
    } catch (e) {
      if (e instanceof SecretFileError) throw e;
      throw new SecretFileError("ilegivel");
    }
    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, total));
    } catch {
      throw new SecretFileError("ilegivel");
    }
    const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
    if (value.length === 0) throw new SecretFileError("vazio");
    return new Secret(value);
  } finally {
    closeSync(fd);
  }
}
