/** Redacao por allowlist: so campos explicitamente permitidos chegam ao log. */
export const REDACTED = "[REDACTED]";

/** Nomes sempre redigidos (comparacao exata, minuscula, `-` e `_` equivalentes). */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set_cookie",
  "password",
  "token",
  "secret",
  "prompt",
  "content",
  "api_key",
]);

const SENSITIVE_PATTERN = /authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session/i;
const VALUE_PATTERNS = [/\bBearer\s+\S+/gi, /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g];
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const MAX_STRING = 256;
const DROPPED_KEY = "_dropped";

function normalize(key: string): string {
  return key.toLowerCase().replaceAll("-", "_");
}

function scrubString(value: string): string {
  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  for (const pattern of VALUE_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

/**
 * Regras (nesta ordem):
 * 1. chave sensivel (padrao) => valor `[REDACTED]`; o nome so aparece se for um nome conhecido
 *    (`SENSITIVE_KEYS`) ou estiver na allowlist; senao conta em `_dropped`.
 * 2. chave fora da allowlist => descartada (nome e valor); conta em `_dropped`.
 * 3. chave permitida: escalares passam (strings truncadas e sem Bearer/JWT); objetos e arrays
 *    recorrem com limites de profundidade e tamanho; Error vira `{name}` (sem mensagem).
 */
export function redact(value: unknown, allowlist: Iterable<string>, depth = 0): unknown {
  const allowed = new Set([...allowlist].map(normalize));
  return walk(value, allowed, depth);
}

function walk(value: unknown, allowed: ReadonlySet<string>, depth: number): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return scrubString(value);
  if (value instanceof Error) return { name: value.name };
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => walk(item, allowed, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let dropped = 0;
    for (const [rawKey, child] of Object.entries(value)) {
      const key = normalize(rawKey);
      const isAllowed = allowed.has(key);
      if (SENSITIVE_KEYS.has(key) || (isAllowed && SENSITIVE_PATTERN.test(key))) {
        out[key] = REDACTED;
      } else if (!isAllowed || SENSITIVE_PATTERN.test(key)) {
        dropped += 1;
      } else {
        out[key] = walk(child, allowed, depth + 1);
      }
    }
    if (dropped > 0) out[DROPPED_KEY] = dropped;
    return out;
  }
  return "[UNSUPPORTED]";
}
