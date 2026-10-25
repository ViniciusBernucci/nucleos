import assert from "node:assert/strict";
import { test } from "node:test";
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

const ALLOWED = ["method", "route", "status", "note"];
const SENSITIVE = [...SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"];
const OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"];

test("propriedade: nenhum sentinela de segredo sobrevive a redacao (dados aleatorios)", () => {
  const rnd = prng(20261025);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const sentinels: string[] = [];
  const gen = (depth: number): unknown => {
    const obj: Record<string, unknown> = {};
    const n = 1 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const r = rnd();
      const sentinel = () => {
        const s = `SENTINEL_${sentinels.length}_${Math.floor(rnd() * 1e9).toString(36)}`;
        sentinels.push(s);
        return s;
      };
      const wrap = (v: unknown): unknown => (rnd() < 0.3 ? [v, { deep: v }] : rnd() < 0.2 ? { a: { b: { c: { d: v } } } } : v);
      if (r < 0.35) obj[pick(SENSITIVE)] = wrap(sentinel());
      else if (r < 0.6) obj[pick(OTHER)] = wrap(sentinel());
      else if (r < 0.75 && depth < 3) obj[pick(ALLOWED)] = gen(depth + 1);
      else if (r < 0.85) obj[pick(ALLOWED)] = `Bearer ${sentinel()}`;
      else obj[pick(ALLOWED)] = Math.floor(rnd() * 100);
    }
    return obj;
  };
  for (let i = 0; i < 500; i++) {
    sentinels.length = 0;
    const out = JSON.stringify(redact(gen(0), ALLOWED));
    for (const s of sentinels) assert.ok(!out.includes(s), `vazou ${s} em ${out}`);
  }
});

test("chaves sensiveis conhecidas viram [REDACTED] mesmo se estiverem na allowlist", () => {
  const out = redact({ authorization: "x", token: "y", note: "ok", foo: "z" }, ["token", "note"]) as Record<string, unknown>;
  assert.equal(out["authorization"], REDACTED);
  assert.equal(out["token"], REDACTED);
  assert.equal(out["note"], "ok");
  assert.equal(out["foo"], undefined);
  assert.equal(out["_dropped"], 1);
});

test("Error nao expoe a mensagem; profundidade e strings sao limitadas", () => {
  const out = JSON.stringify(redact({ note: new Error("senha=abc") }, ["note"]));
  assert.ok(!out.includes("abc"));
  assert.ok(JSON.stringify(redact({ note: "a".repeat(5000) }, ["note"])).length < 400);
});
