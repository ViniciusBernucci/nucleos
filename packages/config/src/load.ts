import type { z } from "zod";
import { type SecretFileReason, SecretFileError, readSecretFile } from "./secret.js";
import type { Secret } from "./secret.js";

export interface ConfigIssue {
  /** Nome da variavel (ou do campo) com problema. Nunca o valor recebido. */
  readonly key: string;
  /** Mensagem fixa do esquema, sem eco do valor. */
  readonly message: string;
}

/**
 * Configuracao ausente ou invalida. A mensagem lista apenas nomes de variaveis e motivos fixos;
 * o valor recebido nunca e incluido (nem no `message`, nem em `issues`, nem em `cause`).
 */
export class ConfigError extends Error {
  constructor(readonly issues: readonly ConfigIssue[]) {
    super(
      `configuracao invalida (${String(issues.length)}): ` +
        issues.map((i) => `${i.key}: ${i.message}`).join("; "),
    );
    this.name = "ConfigError";
  }
}

const SECRET_TOKENS = new Set([
  "PASS",
  "PASSWORD",
  "PASSWD",
  "PWD",
  "SECRET",
  "TOKEN",
  "KEY",
  "APIKEY",
  "CREDENTIAL",
  "CREDENTIALS",
  "DSN",
]);
const SECRET_SUFFIXES = [
  "PASSWORD",
  "PASSWD",
  "SECRET",
  "TOKEN",
  "APIKEY",
  "PRIVATEKEY",
  "CREDENTIAL",
  "CREDENTIALS",
];

/**
 * Nome de variavel que indica segredo literal (ADR-020 item 1): algum token separado por `_`
 * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
 * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de config-py e deploy-lib.mjs.
 */
/** Variaveis POSIX/shell que nao carregam segredo e colidem com os tokens. */
const NOT_SECRET = new Set(["PWD", "OLDPWD"]);

export function isSecretName(name: string): boolean {
  const up = name.toUpperCase().replace(/[.-]/g, "_");
  if (NOT_SECRET.has(up)) return false;
  if (/_(FILE|PATH)$/.test(up)) return false;
  if (up.split("_").some((t) => SECRET_TOKENS.has(t))) return true;
  const compact = up.replaceAll("_", "");
  return SECRET_SUFFIXES.some((suf) => compact.endsWith(suf));
}

/** Devolve as variaveis do ambiente cujo NOME parece carregar um segredo literal. */
export function forbiddenSecretEnv(env: Readonly<Record<string, string | undefined>>): string[] {
  return Object.entries(env)
    .filter(([k, v]) => v !== undefined && v !== "" && isSecretName(k))
    .map(([k]) => k)
    .sort();
}

const SECRET_FILE_MESSAGES: Record<SecretFileReason, string> = {
  ausente: "arquivo de segredo ausente",
  "nao-e-arquivo-regular": "segredo deve ser arquivo regular",
  "link-simbolico": "link simbolico nao permitido",
  "permissoes-abertas": "permissoes do arquivo devem ser 0400/0600 (sem grupo/outros)",
  "dono-diferente": "arquivo pertence a outro usuario",
  vazio: "arquivo de segredo vazio",
  "grande-demais": "arquivo de segredo grande demais",
  ilegivel: "arquivo de segredo ilegivel",
};

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Valida `env` com o esquema (zod) e falha rapido. Regras:
 * - variavel com nome de segredo no ambiente => erro (so `*_FILE` e aceito);
 * - erros do esquema viram `ConfigIssue` por chave, sem o valor recebido.
 * Entradas vazias (`""`) contam como ausentes.
 */
export function parseConfig<S extends z.ZodType>(schema: S, env: Env): z.output<S> {
  const issues: ConfigIssue[] = forbiddenSecretEnv(env).map((key) => ({
    key,
    message: "segredo por variavel de ambiente e proibido (use <NOME>_FILE com caminho de arquivo)",
  }));
  const input = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const result = schema.safeParse(input);
  if (!result.success) {
    for (const issue of result.error.issues) {
      // Mensagem do proprio esquema (fixa); `received`/`input` do zod nao sao usados.
      issues.push({ key: issue.path.map(String).join(".") || "(raiz)", message: issue.message });
    }
  }
  if (issues.length > 0 || !result.success) throw new ConfigError(issues);
  return result.data;
}

/** Le o segredo apontado por `path`, convertendo falhas em `ConfigError` sem vazar o caminho. */
export function loadSecret(key: string, path: string): Secret {
  try {
    return readSecretFile(path);
  } catch (e) {
    const reason = e instanceof SecretFileError ? e.reason : "ilegivel";
    throw new ConfigError([{ key, message: SECRET_FILE_MESSAGES[reason] }]);
  }
}
