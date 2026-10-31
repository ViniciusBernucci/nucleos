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
const VALUE_PATTERNS = [
  /\bBearer\s+\S+/gi,
  /\beyJ[\w-]+(?:\.[\w-]*)*/g,
  /(?:password|passwd|token|secret|api[-_]?key)\s*[=:]\s*\S+/gi,
];
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const MAX_STRING = 256;
const DROPPED_KEY = "_dropped";

function normalize(key: string): string {
  return key.toLowerCase().replaceAll("-", "_");
}

/** Scrub ANTES de truncar: um token cortado no limite nao pode escapar do padrao. */
function scrubString(value: string): string {
  let out = value;
  for (const pattern of VALUE_PATTERNS) out = out.replace(pattern, REDACTED);
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}...` : out;
}

/** Regra de string por chave: RegExp ancorada (valor inteiro) ou `"free"` (opt-in; contrato do chamador). */
export type StringRule = RegExp | "free";
/** Allowlist: chave -> regra. Chave sem regra aceita apenas numero/booleano/null. */
export type AllowMap = Readonly<Record<string, StringRule | undefined>>;

const NAME_PATTERN = /^[A-Za-z0-9_.$]{1,64}$/;
const IDENT_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** Validadores dos campos emitidos pela propria biblioteca (valores controlados pelo codigo). */
export const DEFAULT_RULES: AllowMap = {
  method: /^[A-Z]{1,16}$/,
  route: /^(?:unmatched|\/[A-Za-z0-9_\-./:{}]*)$/,
  status: undefined,
  duration_ms: undefined,
  check: IDENT_PATTERN,
  job_type: IDENT_PATTERN,
};

function toRules(allowlist: Iterable<string> | AllowMap): Map<string, StringRule | undefined> {
  const entries: [string, StringRule | undefined][] =
    Symbol.iterator in Object(allowlist)
      ? [...(allowlist as Iterable<string>)].map((k): [string, undefined] => [k, undefined])
      : Object.entries(allowlist as AllowMap);
  return new Map(entries.map(([k, r]) => [normalize(k), r]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Regras (nesta ordem):
 * 0. dado de topo: somente objeto simples; escalar, lista, Error etc. viram `{_dropped: 1}`.
 * 1. chave sensivel (padrao) => valor `[REDACTED]`; o nome so aparece se for um nome conhecido
 *    (`SENSITIVE_KEYS`) ou estiver na allowlist; senao conta em `_dropped`.
 * 2. chave fora da allowlist => descartada (nome e valor); conta em `_dropped`.
 * 3. chave permitida: numero/booleano/null passam; string so passa se a chave tiver regra declarada
 *    (RegExp casando o valor inteiro, ou `"free"` opt-in) e ainda e filtrada de Bearer/JWT/
 *    `password=...`; sem regra => `[REDACTED]`. Objetos e arrays recorrem com limites; Error vira
 *    `{name}` somente se o nome casar `^[A-Za-z0-9_.$]{1,64}$` (nunca a mensagem).
 */
export function redact(value: unknown, allowlist: Iterable<string> | AllowMap): unknown {
  const rules = toRules(allowlist);
  if (!isPlainObject(value)) return { [DROPPED_KEY]: 1 };
  return walk(value, rules, 0, undefined);
}

function walk(value: unknown, rules: ReadonlyMap<string, StringRule | undefined>, depth: number, rule: StringRule | undefined): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (rule === undefined) return REDACTED;
    if (rule !== "free" && !rule.test(value)) return REDACTED;
    return scrubString(value);
  }
  if (value instanceof Error) {
    const name: unknown = value.name;
    return { name: typeof name === "string" && NAME_PATTERN.test(name) ? name : REDACTED };
  }
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => walk(item, rules, depth + 1, rule));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    let dropped = 0;
    for (const [rawKey, child] of Object.entries(value)) {
      const key = normalize(rawKey);
      const isAllowed = rules.has(key);
      if (SENSITIVE_KEYS.has(key) || (isAllowed && SENSITIVE_PATTERN.test(key))) {
        out[key] = REDACTED;
      } else if (!isAllowed || SENSITIVE_PATTERN.test(key)) {
        dropped += 1;
      } else {
        out[key] = walk(child, rules, depth + 1, rules.get(key));
      }
    }
    if (dropped > 0) out[DROPPED_KEY] = dropped;
    return out;
  }
  return "[UNSUPPORTED]";
}
