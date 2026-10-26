import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "./logger.js";
import { REDACTED, SENSITIVE_KEYS, redact } from "./redact.js";

// PRNG deterministico (mulberry32) para o teste de propriedade ser reproduzivel.
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `note` e `items` nao tem validador: string sob elas e sempre [REDACTED]. `route` tem validador.
const ALLOWED = ["method", "route", "status", "note", "items"];
const SENSITIVE = [...SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"];
const OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"];

function run(seed: number, check: (sentinels: string[], value: unknown) => void): void {
  const rnd = prng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const sentinels: string[] = [];
  const sentinel = () => {
    const s = `SENTINEL-s3cr3t-${sentinels.length}-${Math.floor(rnd() * 1e9).toString(36)}`;
    sentinels.push(s);
    return s;
  };
  const wrap = (v: unknown): unknown => (rnd() < 0.3 ? [v, { deep: v }] : rnd() < 0.2 ? { a: { b: { c: { d: v } } } } : v);
  const gen = (depth: number): unknown => {
    const obj: Record<string, unknown> = {};
    const n = 1 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const r = rnd();
      if (r < 0.2) obj[pick(SENSITIVE)] = wrap(sentinel());
      else if (r < 0.35) obj[pick(OTHER)] = wrap(sentinel());
      else if (r < 0.5 && depth < 3) obj[pick(ALLOWED)] = gen(depth + 1);
      else if (r < 0.58) obj[pick(ALLOWED)] = `Bearer ${sentinel()}`;
      else if (r < 0.7) obj[pick(["note", "items"])] = sentinel(); // string comum sob chave permitida
      else if (r < 0.78) obj["items"] = [sentinel(), 1, [sentinel()]]; // item de array
      else if (r < 0.84) obj[pick(["note", "items"])] = Object.assign(new Error("m"), { name: sentinel() }); // Error.name
      else if (r < 0.9) obj["route"] = `/x?token=${sentinel()}`; // validador de rota rejeita
      else if (r < 0.95) obj["note"] = `password=${sentinel()}`;
      else obj[pick(ALLOWED)] = Math.floor(rnd() * 100);
    }
    return obj;
  };
  const top = (): unknown => {
    const r = rnd();
    if (r < 0.15) return sentinel(); // escalar de topo
    if (r < 0.3) return [sentinel(), { note: sentinel() }]; // lista de topo
    if (r < 0.4) return Object.assign(new Error("m"), { name: sentinel() }); // Error de topo
    return gen(0);
  };
  for (let i = 0; i < 500; i++) {
    sentinels.length = 0;
    check(sentinels, top());
  }
}

test("propriedade: nenhum sentinela sobrevive a redacao (strings sob chave permitida, arrays, topo, Error.name)", () => {
  run(20261025, (sentinels, value) => {
    const out = JSON.stringify(redact(value, ALLOWED));
    for (const s of sentinels) assert.ok(!out.includes(s), `vazou ${s} em ${out}`);
  });
});

test("propriedade na linha de log real (logger.log), nao so em redact", () => {
  const lines: string[] = [];
  const logger = createLogger({ service: "s", version: "1", env: "t", destination: { write: (l) => void lines.push(l) }, allowlist: ["note", "items"] });
  run(77, (sentinels, value) => {
    lines.length = 0;
    logger.log("info", "evt", value);
    const out = lines.join("");
    for (const s of sentinels) assert.ok(!out.includes(s), `vazou ${s} em ${out}`);
  });
});

test("valores validos continuam presentes; strings so com validador; topo so objeto simples", () => {
  const out = redact({ route: "/healthz", status: 200, method: "GET", note: "ok" }, ["route", "status", "method", "note"]) as Record<string, unknown>;
  assert.deepEqual(out, { route: "[REDACTED]", status: 200, method: "[REDACTED]", note: "[REDACTED]" }); // lista de nomes = sem validador
  const rules = redact({ route: "/healthz", status: 200, method: "GET", free: "livre", note: "x" }, { route: /^\/[a-z]+$/, status: undefined, method: /^[A-Z]+$/, free: "free", note: undefined });
  assert.deepEqual(rules, { route: "/healthz", status: 200, method: "GET", free: "livre", note: REDACTED });
  for (const top of ["s", 1, ["a"], null, new Error("x"), new Map()]) assert.deepEqual(redact(top, ["note"]), { _dropped: 1 });
});

test("Error.name fora de ^[A-Za-z0-9_.$]{1,64}$ vira [REDACTED]; JWT cortado no limite nao deixa prefixo", () => {
  const bad = Object.assign(new Error("m"), { name: "has space" });
  assert.deepEqual(redact({ note: bad }, ["note"]), { note: { name: REDACTED } });
  assert.deepEqual(redact({ note: new TypeError("m") }, ["note"]), { note: { name: "TypeError" } });
  const jwt = `eyJ${"a".repeat(300)}.payload.sig`;
  const out = JSON.stringify(redact({ note: `${"x".repeat(250)} ${jwt}` }, { note: "free" }));
  assert.ok(!out.includes("eyJ") && !out.includes("aaaa"));
});

test("chaves sensiveis conhecidas viram [REDACTED] mesmo se estiverem na allowlist", () => {
  const out = redact({ authorization: "x", token: "y", note: 7, foo: "z" }, ["token", "note"]) as Record<string, unknown>;
  assert.equal(out["authorization"], REDACTED);
  assert.equal(out["token"], REDACTED);
  assert.equal(out["note"], 7);
  assert.equal(out["foo"], undefined);
  assert.equal(out["_dropped"], 1);
});

test("Error nao expoe a mensagem; profundidade e strings sao limitadas", () => {
  const out = JSON.stringify(redact({ note: new Error("senha=abc") }, ["note"]));
  assert.ok(!out.includes("abc"));
  assert.ok(JSON.stringify(redact({ note: "a".repeat(5000) }, { note: "free" })).length < 400);
});
