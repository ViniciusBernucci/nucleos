# Diffs — DEC-004 (código, testes, configuração e contratos propostos)

Voltar ao [documento da entrega](2026-10-25-dec-004-identidade-de-servico-runtime.md). Diffs staged contra a base `4be3ce3`; todos os arquivos são novos. Sem segredos nos arquivos (nenhuma redação necessária).

Não incluídos como diff (gerados): `poc/dec-004/package-lock.json` (3091 bytes, sha256 iniciando em 419129aa9b36d13a) e `poc/dec-004/saida/*.txt`.

```diff
diff --git a/documentacoes/arquitetura/contratos-propostos/handshake.schema.json b/documentacoes/arquitetura/contratos-propostos/handshake.schema.json
new file mode 100644
index 0000000..8718163
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/handshake.schema.json
@@ -0,0 +1,73 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contratos-propostos/handshake.schema.json",
+  "title": "PROPOSTO (ADR-018) - Handshake de enrollment, emissao, JWKS e revogacao",
+  "description": "PROPOSTA. Mensagens entre runtime, Control Plane (CP) e servicos validadores. Transporte TLS; nenhuma mensagem carrega chave privada. Cada mensagem e validada por referencia a $defs/<nome>.",
+  "$defs": {
+    "uuid": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
+    "b64url": { "type": "string", "pattern": "^[A-Za-z0-9_-]+$" },
+    "jwk_publica": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["kty", "crv", "x", "kid", "use", "alg"],
+      "properties": {
+        "kty": { "const": "OKP" },
+        "crv": { "const": "Ed25519" },
+        "x": { "$ref": "#/$defs/b64url" },
+        "kid": { "type": "string", "pattern": "^[A-Za-z0-9_-]+$", "maxLength": 64 },
+        "use": { "const": "sig" },
+        "alg": { "const": "EdDSA" }
+      }
+    },
+    "enrollment_request": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["tenant_id", "enrollment_secret", "runtime_public_key"],
+      "properties": {
+        "tenant_id": { "$ref": "#/$defs/uuid" },
+        "enrollment_secret": { "type": "string", "minLength": 32, "description": "Uso unico, expira em minutos, gerado pelo provisioner; nunca logado." },
+        "runtime_public_key": { "$ref": "#/$defs/jwk_publica" }
+      }
+    },
+    "enrollment_response": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["tenant_id", "ver", "runtime_kid"],
+      "properties": { "tenant_id": { "$ref": "#/$defs/uuid" }, "ver": { "type": "integer", "minimum": 1 }, "runtime_kid": { "type": "string" } }
+    },
+    "token_request": {
+      "type": "object",
+      "description": "client_assertion e um JWT EdDSA assinado com a chave privada do runtime (header kid = runtime_kid; claims: sub=runtime:<tenant_id>, aud=nucleos-control-plane, jti, iat, exp<=60 s).",
+      "additionalProperties": false,
+      "required": ["client_assertion", "audience", "scope"],
+      "properties": {
+        "client_assertion": { "type": "string" },
+        "audience": { "enum": ["dispatcher", "tool-gateway", "ai-gateway"] },
+        "scope": { "type": "array", "minItems": 1, "items": { "type": "string" } }
+      }
+    },
+    "token_response": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["access_token", "token_type", "expires_in"],
+      "properties": { "access_token": { "type": "string" }, "token_type": { "const": "Bearer" }, "expires_in": { "type": "integer", "minimum": 1, "maximum": 600 } }
+    },
+    "jwks": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["keys"],
+      "properties": { "keys": { "type": "array", "minItems": 1, "maxItems": 3, "items": { "$ref": "#/$defs/jwk_publica" } } }
+    },
+    "revocation_state": {
+      "type": "object",
+      "description": "Estado consultavel pelos validadores (poll curto e/ou push de emergencia). Nunca consultado por requisicao.",
+      "additionalProperties": false,
+      "required": ["generated_at", "min_ver"],
+      "properties": {
+        "generated_at": { "type": "integer", "minimum": 0 },
+        "min_ver": { "type": "object", "propertyNames": { "$ref": "#/$defs/uuid" }, "additionalProperties": { "type": "integer", "minimum": 1 } },
+        "revoked_jti": { "type": "array", "items": { "type": "string" }, "description": "Opcional: revogacao pontual de jti ainda vivo." }
+      }
+    }
+  }
+}
diff --git a/documentacoes/arquitetura/contratos-propostos/runtime-token.schema.json b/documentacoes/arquitetura/contratos-propostos/runtime-token.schema.json
new file mode 100644
index 0000000..b502b4f
--- /dev/null
+++ b/documentacoes/arquitetura/contratos-propostos/runtime-token.schema.json
@@ -0,0 +1,43 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://nucleos.invalid/contratos-propostos/runtime-token.schema.json",
+  "title": "PROPOSTO (ADR-018) - Claims do token de servico do runtime",
+  "description": "PROPOSTA. Nao e contrato vigente: o pacote packages/contracts pertence a FND-003 e so adota este esquema apos aceite humano do ADR-018. JWT EdDSA (Ed25519), vida curta, emitido pelo Control Plane.",
+  "$defs": {
+    "uuid": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
+    "audience": { "enum": ["dispatcher", "tool-gateway", "ai-gateway"] },
+    "header": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["alg", "typ", "kid"],
+      "properties": {
+        "alg": { "const": "EdDSA" },
+        "typ": { "const": "nucleos-runtime+jwt" },
+        "kid": { "type": "string", "minLength": 1, "maxLength": 64, "pattern": "^[A-Za-z0-9_-]+$" }
+      }
+    },
+    "claims": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["iss", "sub", "aud", "scope", "tenant_id", "jti", "iat", "exp", "ver"],
+      "properties": {
+        "iss": { "const": "nucleos-control-plane" },
+        "sub": { "type": "string", "pattern": "^runtime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "description": "runtime:<tenant_id>; deve ser igual a runtime: + tenant_id (checagem semantica no validador)" },
+        "aud": { "$ref": "#/$defs/audience", "description": "Uma unica audiencia por token; sem array." },
+        "scope": { "type": "array", "minItems": 1, "maxItems": 16, "uniqueItems": true, "items": { "type": "string", "pattern": "^[a-z][a-z0-9-]*:[a-z][a-z0-9_.-]*$" } },
+        "tenant_id": { "$ref": "#/$defs/uuid" },
+        "jti": { "type": "string", "minLength": 16, "maxLength": 64, "pattern": "^[A-Za-z0-9_-]+$" },
+        "iat": { "type": "integer", "minimum": 0 },
+        "exp": { "type": "integer", "minimum": 0, "description": "exp - iat <= 600 (checagem semantica: TTL maximo 10 min; padrao 300 s)" },
+        "ver": { "type": "integer", "minimum": 1, "description": "Versao da credencial do runtime; rejeitada se < ver_minima do tenant." }
+      }
+    }
+  },
+  "type": "object",
+  "required": ["header", "claims"],
+  "additionalProperties": false,
+  "properties": {
+    "header": { "$ref": "#/$defs/header" },
+    "claims": { "$ref": "#/$defs/claims" }
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/bench.mjs b/documentacoes/arquitetura/poc/dec-004/bench.mjs
new file mode 100644
index 0000000..5af8220
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/bench.mjs
@@ -0,0 +1,33 @@
+// Mede latencia de validacao LOCAL (sem rede). Uso: node bench.mjs
+import { performance } from 'node:perf_hooks';
+import os from 'node:os';
+import { makeEnv, TENANT_A } from './lib/env.mjs';
+
+const env = makeEnv();
+const rt = env.enrollRuntime(TENANT_A);
+const ctx = { expectedTenantId: TENANT_A, requiredScope: 'tools:invoke' };
+const N = 20000;
+const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
+const us = (ns) => (ns / 1000).toFixed(1);
+
+function measure(label, fn) {
+  for (let i = 0; i < 2000; i++) fn(i); // aquecimento
+  const samples = new Float64Array(N);
+  for (let i = 0; i < N; i++) { const t0 = performance.now(); fn(i); samples[i] = (performance.now() - t0) * 1e6; }
+  const s = Array.from(samples).sort((a, b) => a - b);
+  const mean = s.reduce((x, y) => x + y, 0) / s.length;
+  console.log(`${label.padEnd(46)} p50=${us(pct(s, 0.5))}us p95=${us(pct(s, 0.95))}us p99=${us(pct(s, 0.99))}us media=${us(mean)}us`);
+}
+
+console.log(`node ${process.version} | ${os.cpus()[0].model} | ${os.cpus().length} vCPU | N=${N}`);
+const v = env.validators['tool-gateway'];
+const tok = env.cp.issueToken(rt.tokenRequest('tool-gateway', ['tools:invoke'])).access_token;
+const calls0 = v.networkCalls;
+measure('validate (tool-gateway, reutilizavel)', () => v.validate(tok, ctx));
+console.log(`chamadas de rede durante a medicao: ${v.networkCalls - calls0}`);
+
+const d = env.validators.dispatcher;
+const toks = Array.from({ length: N + 2000 }, () => env.cp.issueToken(rt.tokenRequest('dispatcher', ['jobs:pull'])).access_token);
+let k = 0;
+measure('validate (dispatcher, uso unico + cache jti)', () => d.validate(toks[k++], { expectedTenantId: TENANT_A, requiredScope: 'jobs:pull' }));
+measure('emissao no CP (assinar token + verificar assertion)', () => env.cp.issueToken(rt.tokenRequest('tool-gateway', ['tools:invoke'])));
diff --git a/documentacoes/arquitetura/poc/dec-004/demo.mjs b/documentacoes/arquitetura/poc/dec-004/demo.mjs
new file mode 100644
index 0000000..adcfb7c
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/demo.mjs
@@ -0,0 +1,63 @@
+// Demonstracao narrada: casos negativos, rotacao e revogacao de emergencia. Uso: node demo.mjs
+import { makeEnv, TENANT_A, TENANT_B } from './lib/env.mjs';
+import { b64u, newKeyPair, signJwt } from './lib/jwt.mjs';
+import { ISS } from './lib/control-plane.mjs';
+
+const env = makeEnv();
+const rtA = env.enrollRuntime(TENANT_A);
+const rtB = env.enrollRuntime(TENANT_B);
+const gw = env.validators['tool-gateway'];
+const ctx = (t, s = 'tools:invoke') => ({ expectedTenantId: t, requiredScope: s });
+const issue = (rt, aud = 'tool-gateway', sc = ['tools:invoke']) => env.cp.issueToken(rt.tokenRequest(aud, sc)).access_token;
+const kidOf = (t) => JSON.parse(Buffer.from(t.split('.')[0], 'base64url')).kid;
+const log = (m) => console.log(m);
+const attempt = (label, fn) => {
+  try { fn(); log(`  ACEITO    ${label}`); } catch (e) { log(`  REJEITADO ${label} -> ${e.code ?? e.message}`); }
+};
+
+log('== 1. Caminho feliz');
+const tA = issue(rtA);
+attempt('token valido de A no tool-gateway', () => gw.validate(tA, ctx(TENANT_A)));
+
+log('== 2. Casos negativos');
+const [h, p, s] = tA.split('.');
+const adulterado = JSON.parse(Buffer.from(p, 'base64url')); adulterado.tenant_id = TENANT_B; adulterado.sub = `runtime:${TENANT_B}`;
+attempt('tenant adulterado no payload', () => gw.validate(`${h}.${b64u(JSON.stringify(adulterado))}.${s}`, ctx(TENANT_B)));
+attempt('token de A em contexto de B', () => gw.validate(tA, ctx(TENANT_B)));
+attempt('audiencia errada (ai-gateway no tool-gateway)', () => gw.validate(issue(rtA, 'ai-gateway', ['llm:complete']), ctx(TENANT_A, 'llm:complete')));
+const tExp = issue(rtA); env.now.advance(331);
+attempt('expirado (331 s apos emissao)', () => gw.validate(tExp, ctx(TENANT_A)));
+env.now.advance(-331);
+const tV = issue(rtA); env.cp.revokeTenantCredentials(TENANT_A); env.refreshAll();
+attempt('versao revogada (ver 1 < min 2)', () => gw.validate(tV, ctx(TENANT_A)));
+attempt('B continua valido apos revogar A (SEC-15)', () => gw.validate(issue(rtB), ctx(TENANT_B)));
+const tD = issue(rtB, 'dispatcher', ['jobs:pull']);
+attempt('dispatcher: 1o uso do token', () => env.validators.dispatcher.validate(tD, ctx(TENANT_B, 'jobs:pull')));
+attempt('dispatcher: replay do mesmo jti', () => env.validators.dispatcher.validate(tD, ctx(TENANT_B, 'jobs:pull')));
+attempt('assinado por chave do atacante', () => gw.validate(signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: env.cp.activeKey.kid }, { iss: ISS }, newKeyPair().privateKey), ctx(TENANT_B)));
+
+log('== 3. Rotacao sem downtime (duas chaves ativas no JWKS)');
+const k1 = env.cp.activeKey.kid;
+const tOld = issue(rtB);
+log(`  chave ativa: ${k1}`);
+const k2 = env.cp.publishNextKey(); env.refreshAll();
+log(`  publicada ${k2}; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
+env.cp.activateKey(k2);
+const tNew = issue(rtB);
+log(`  ativada ${k2}; novo token kid=${kidOf(tNew)}`);
+attempt('token antigo (k1) durante a sobreposicao', () => gw.validate(tOld, ctx(TENANT_B)));
+attempt('token novo (k2)', () => gw.validate(tNew, ctx(TENANT_B)));
+env.now.advance(331); env.cp.retireKey(k1); env.refreshAll();
+log(`  k1 aposentada apos TTL+skew; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
+attempt('token antigo (k1) apos aposentadoria', () => gw.validate(tOld, ctx(TENANT_B)));
+attempt('token novo emitido apos aposentadoria', () => gw.validate(issue(rtB), ctx(TENANT_B)));
+
+log('== 4. Revogacao de emergencia da chave de assinatura');
+const comp = env.cp.activeKey;
+const vivo = issue(rtB);
+attempt('token vivo antes da revogacao', () => gw.validate(vivo, ctx(TENANT_B)));
+const k3 = env.cp.emergencyRevokeKey(comp.kid); env.refreshAll();
+log(`  chave ${comp.kid} revogada; nova ativa ${k3}; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
+attempt('mesmo token vivo apos revogacao', () => gw.validate(vivo, ctx(TENANT_B)));
+attempt('runtime B reemite e volta a operar (sem novo enrollment)', () => gw.validate(issue(rtB), ctx(TENANT_B)));
+log(`\nchamadas de rede do tool-gateway ao CP (refresh/poll) em toda a demo: ${gw.networkCalls}`);
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/control-plane.mjs b/documentacoes/arquitetura/poc/dec-004/lib/control-plane.mjs
new file mode 100644
index 0000000..a39a8f9
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/control-plane.mjs
@@ -0,0 +1,159 @@
+// Control Plane FALSO: enrollment, emissao de token, JWKS, rotacao e revogacao.
+import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
+import { newKeyPair, toPublicJwk, fromPublicJwk, signJwt, splitJwt, verifySignature, b64u } from './jwt.mjs';
+import { validate } from './schemas.mjs';
+
+export const ISS = 'nucleos-control-plane';
+export const TOKEN_TTL_S = 300;
+export const MAX_TTL_S = 600;
+const ASSERTION_MAX_TTL_S = 60;
+const ENROLL_TTL_S = 600;
+const SKEW_S = 30;
+
+// Politica de escopos por audiencia (deny by default).
+export const ALLOWED_SCOPES = {
+  dispatcher: ['jobs:pull', 'jobs:ack'],
+  'tool-gateway': ['tools:invoke'],
+  'ai-gateway': ['llm:complete', 'llm:embed'],
+};
+
+const sha256 = (s) => createHash('sha256').update(s).digest();
+
+export class Reject extends Error {
+  constructor(code, detail = '') {
+    super(`${code}${detail ? `: ${detail}` : ''}`);
+    this.code = code;
+  }
+}
+
+export class ControlPlane {
+  /** @param {{now: () => number}} opts now() em segundos Unix. */
+  constructor({ now }) {
+    this.now = now;
+    this.keys = []; // {kid, publicKey, privateKey, state: 'published'|'active'|'retired'}
+    this.tenants = new Map(); // tenant_id -> {ver, minVer, runtimeKid, runtimeKey}
+    this.enrollments = new Map(); // tenant_id -> {hash, exp, used}
+    this.seenAssertionJti = new Map();
+    this.minVer = {}; // tenant_id -> ver minima
+    this.revokedJti = [];
+    this.#addKey('active');
+  }
+
+  #addKey(state) {
+    const { publicKey, privateKey } = newKeyPair();
+    const kid = `cp-${b64u(randomBytes(6))}`;
+    this.keys.push({ kid, publicKey, privateKey, state });
+    return kid;
+  }
+
+  get activeKey() {
+    return this.keys.find((k) => k.state === 'active');
+  }
+
+  // ---- JWKS e estado de revogacao (consumidos por poll curto ou push de emergencia) ----
+  jwks() {
+    const doc = { keys: this.keys.filter((k) => k.state !== 'retired').map((k) => toPublicJwk(k.publicKey, k.kid)) };
+    if (!validate.jwks(doc)) throw new Error('jwks fora do esquema');
+    return doc;
+  }
+
+  revocationState() {
+    const doc = { generated_at: this.now(), min_ver: { ...this.minVer }, revoked_jti: [...this.revokedJti] };
+    if (!validate.revocationState(doc)) throw new Error('revocation_state fora do esquema');
+    return doc;
+  }
+
+  // ---- Rotacao sem downtime (duas chaves ativas): publicar -> ativar -> aposentar ----
+  publishNextKey() { return this.#addKey('published'); }
+  activateKey(kid) {
+    const next = this.keys.find((k) => k.kid === kid && k.state === 'published');
+    if (!next) throw new Error('chave nao publicada');
+    this.activeKey.state = 'published'; // a anterior continua no JWKS ate expirar seus tokens
+    next.state = 'active';
+  }
+  retireKey(kid) {
+    const k = this.keys.find((x) => x.kid === kid);
+    if (!k || k.state === 'active') throw new Error('nao e possivel aposentar a chave ativa');
+    k.state = 'retired';
+  }
+
+  /** Revogacao de emergencia de chave de assinatura: nova chave ativa e a comprometida sai do JWKS. */
+  emergencyRevokeKey(compromisedKid) {
+    const fresh = this.#addKey('active');
+    for (const k of this.keys) {
+      if (k.kid === compromisedKid) k.state = 'retired';
+      else if (k.kid !== fresh && k.state === 'active') k.state = 'published';
+    }
+    return fresh;
+  }
+
+  /** Revogacao por tenant: sobe a versao minima; so afeta o tenant informado. */
+  revokeTenantCredentials(tenantId) {
+    const t = this.tenants.get(tenantId);
+    if (!t) throw new Error('tenant desconhecido');
+    t.ver += 1;
+    this.minVer[tenantId] = t.ver; // tokens com ver < t.ver passam a ser rejeitados
+    t.runtimeKey = null; // exige novo enrollment
+    t.runtimeKid = null;
+    return t.ver;
+  }
+
+  // ---- Enrollment: segredo de uso unico (gerado pelo provisioner) ----
+  provisionEnrollmentSecret(tenantId) {
+    const secret = b64u(randomBytes(32));
+    this.enrollments.set(tenantId, { hash: sha256(secret), exp: this.now() + ENROLL_TTL_S, used: false });
+    if (!this.tenants.has(tenantId)) this.tenants.set(tenantId, { ver: 1, runtimeKid: null, runtimeKey: null });
+    return secret;
+  }
+
+  enroll(req) {
+    if (!validate.enrollmentRequest(req)) throw new Reject('schema', 'enrollment_request');
+    const e = this.enrollments.get(req.tenant_id);
+    if (!e || e.used) throw new Reject('enrollment_invalid');
+    if (this.now() > e.exp) throw new Reject('enrollment_expired');
+    const a = sha256(req.enrollment_secret);
+    if (a.length !== e.hash.length || !timingSafeEqual(a, e.hash)) throw new Reject('enrollment_invalid');
+    e.used = true; // consome antes de qualquer outra coisa
+    const t = this.tenants.get(req.tenant_id);
+    t.runtimeKid = req.runtime_public_key.kid;
+    t.runtimeKey = fromPublicJwk(req.runtime_public_key);
+    const res = { tenant_id: req.tenant_id, ver: t.ver, runtime_kid: t.runtimeKid };
+    if (!validate.enrollmentResponse(res)) throw new Error('enrollment_response fora do esquema');
+    return res;
+  }
+
+  // ---- Emissao de token: runtime prova posse da chave privada (client_assertion) ----
+  issueToken(req) {
+    if (!validate.tokenRequest(req)) throw new Reject('schema', 'token_request');
+    let a;
+    try { a = splitJwt(req.client_assertion); } catch { throw new Reject('malformed'); }
+    const tenantId = typeof a.claims.sub === 'string' ? a.claims.sub.replace(/^runtime:/, '') : '';
+    const t = this.tenants.get(tenantId);
+    if (!t || !t.runtimeKey) throw new Reject('unknown_runtime');
+    if (a.header.alg !== 'EdDSA' || a.header.kid !== t.runtimeKid) throw new Reject('bad_header');
+    if (!verifySignature(a, t.runtimeKey)) throw new Reject('bad_signature');
+    const now = this.now();
+    const c = a.claims;
+    if (c.aud !== ISS) throw new Reject('bad_audience');
+    if (!Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.exp - c.iat > ASSERTION_MAX_TTL_S) throw new Reject('bad_ttl');
+    if (c.iat > now + SKEW_S) throw new Reject('not_yet_valid');
+    if (now > c.exp + SKEW_S) throw new Reject('expired');
+    if (typeof c.jti !== 'string' || this.seenAssertionJti.has(c.jti)) throw new Reject('replay');
+    this.seenAssertionJti.set(c.jti, c.exp + SKEW_S);
+    for (const [j, until] of this.seenAssertionJti) if (until < now) this.seenAssertionJti.delete(j);
+
+    const allowed = ALLOWED_SCOPES[req.audience] ?? [];
+    if (!req.scope.every((s) => allowed.includes(s))) throw new Reject('scope_not_allowed');
+
+    const key = this.activeKey;
+    const claims = {
+      iss: ISS, sub: `runtime:${tenantId}`, aud: req.audience, scope: [...new Set(req.scope)],
+      tenant_id: tenantId, jti: b64u(randomBytes(16)), iat: now, exp: now + TOKEN_TTL_S, ver: t.ver,
+    };
+    const header = { alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid };
+    if (!validate.tokenHeader(header) || !validate.tokenClaims(claims)) throw new Error('token fora do esquema');
+    const res = { access_token: signJwt(header, claims, key.privateKey), token_type: 'Bearer', expires_in: TOKEN_TTL_S };
+    if (!validate.tokenResponse(res)) throw new Error('token_response fora do esquema');
+    return res;
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/env.mjs b/documentacoes/arquitetura/poc/dec-004/lib/env.mjs
new file mode 100644
index 0000000..4829c34
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/env.mjs
@@ -0,0 +1,34 @@
+import { ControlPlane } from './control-plane.mjs';
+import { Validator } from './validator.mjs';
+import { FakeRuntime } from './fake-runtime.mjs';
+
+export const TENANT_A = '11111111-1111-4111-8111-111111111111';
+export const TENANT_B = '22222222-2222-4222-8222-222222222222';
+
+export function makeClock(start = 1_800_000_000) {
+  let t = start;
+  const clock = () => t;
+  clock.advance = (s) => { t += s; };
+  return clock;
+}
+
+export function makeEnv() {
+  const now = makeClock();
+  const cp = new ControlPlane({ now });
+  const mk = (audience, extra = {}) => new Validator({
+    audience, now, fetchJwks: () => cp.jwks(), fetchRevocation: () => cp.revocationState(), ...extra,
+  });
+  const validators = {
+    dispatcher: mk('dispatcher', { singleUse: true }),
+    'tool-gateway': mk('tool-gateway'),
+    'ai-gateway': mk('ai-gateway'),
+  };
+  const enrollRuntime = (tenantId) => {
+    const rt = new FakeRuntime(tenantId, now);
+    const secret = cp.provisionEnrollmentSecret(tenantId);
+    cp.enroll(rt.enrollmentRequest(secret));
+    return rt;
+  };
+  const refreshAll = () => Object.values(validators).forEach((v) => v.refresh());
+  return { now, cp, validators, enrollRuntime, refreshAll };
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/fake-runtime.mjs b/documentacoes/arquitetura/poc/dec-004/lib/fake-runtime.mjs
new file mode 100644
index 0000000..f1299fc
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/fake-runtime.mjs
@@ -0,0 +1,29 @@
+// Runtime FALSO: guarda a propria chave privada (nunca enviada) e pede tokens ao CP.
+import { randomBytes } from 'node:crypto';
+import { newKeyPair, toPublicJwk, signJwt, b64u } from './jwt.mjs';
+import { ISS } from './control-plane.mjs';
+
+export class FakeRuntime {
+  constructor(tenantId, now) {
+    this.tenantId = tenantId;
+    this.now = now;
+    this.kid = `rt-${b64u(randomBytes(6))}`;
+    const kp = newKeyPair();
+    this.privateKey = kp.privateKey;
+    this.publicKey = kp.publicKey;
+  }
+
+  enrollmentRequest(secret) {
+    return { tenant_id: this.tenantId, enrollment_secret: secret, runtime_public_key: toPublicJwk(this.publicKey, this.kid) };
+  }
+
+  tokenRequest(audience, scope, { jti, iat } = {}) {
+    const now = iat ?? this.now();
+    const assertion = signJwt(
+      { alg: 'EdDSA', typ: 'nucleos-runtime-assertion+jwt', kid: this.kid },
+      { sub: `runtime:${this.tenantId}`, aud: ISS, jti: jti ?? b64u(randomBytes(16)), iat: now, exp: now + 60 },
+      this.privateKey,
+    );
+    return { client_assertion: assertion, audience, scope };
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/jwt.mjs b/documentacoes/arquitetura/poc/dec-004/lib/jwt.mjs
new file mode 100644
index 0000000..30f3102
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/jwt.mjs
@@ -0,0 +1,50 @@
+// PoC DESCARTAVEL (ENT-DEC-004). JWT EdDSA minimo com node:crypto.
+// Em producao usar biblioteca revisada (ex.: jose); aqui o formato fica visivel de proposito.
+import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
+
+export const b64u = (buf) => Buffer.from(buf).toString('base64url');
+export const fromB64u = (s) => Buffer.from(s, 'base64url');
+
+export function newKeyPair() {
+  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
+  return { publicKey, privateKey };
+}
+
+export function toPublicJwk(publicKey, kid) {
+  const { x } = publicKey.export({ format: 'jwk' });
+  return { kty: 'OKP', crv: 'Ed25519', x, kid, use: 'sig', alg: 'EdDSA' };
+}
+
+export function fromPublicJwk(jwk) {
+  return createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: 'jwk' });
+}
+
+export function signJwt(header, claims, privateKey) {
+  const h = b64u(JSON.stringify(header));
+  const p = b64u(JSON.stringify(claims));
+  const sig = sign(null, Buffer.from(`${h}.${p}`), privateKey);
+  return `${h}.${p}.${b64u(sig)}`;
+}
+
+/** Divide sem verificar assinatura. Lanca Error('malformed') se a estrutura estiver errada. */
+export function splitJwt(token) {
+  if (typeof token !== 'string' || token.length > 4096) throw new Error('malformed');
+  const parts = token.split('.');
+  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('malformed');
+  try {
+    return {
+      header: JSON.parse(fromB64u(parts[0]).toString('utf8')),
+      claims: JSON.parse(fromB64u(parts[1]).toString('utf8')),
+      signingInput: Buffer.from(`${parts[0]}.${parts[1]}`),
+      signature: fromB64u(parts[2]),
+    };
+  } catch {
+    throw new Error('malformed');
+  }
+}
+
+export function verifySignature(parsed, publicKey) {
+  return verify(null, parsed.signingInput, publicKey, parsed.signature);
+}
+
+export { createPrivateKey };
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/schemas.mjs b/documentacoes/arquitetura/poc/dec-004/lib/schemas.mjs
new file mode 100644
index 0000000..359816b
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/schemas.mjs
@@ -0,0 +1,31 @@
+// Carrega os JSON Schemas PROPOSTOS e compila validadores (ajv 2020).
+import { readFileSync } from 'node:fs';
+import { fileURLToPath } from 'node:url';
+import { dirname, join } from 'node:path';
+import Ajv2020 from 'ajv/dist/2020.js';
+import addFormats from 'ajv-formats';
+
+const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../contratos-propostos');
+const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
+
+const ajv = new Ajv2020({ allErrors: false, strict: true });
+addFormats(ajv);
+const tokenSchema = load('runtime-token.schema.json');
+const handshake = load('handshake.schema.json');
+ajv.addSchema(tokenSchema);
+ajv.addSchema(handshake);
+
+const ref = (id, name) => ajv.getSchema(`${id}#/$defs/${name}`);
+export const tokenId = tokenSchema.$id;
+export const handshakeId = handshake.$id;
+export const validate = {
+  tokenHeader: ref(tokenId, 'header'),
+  tokenClaims: ref(tokenId, 'claims'),
+  enrollmentRequest: ref(handshakeId, 'enrollment_request'),
+  enrollmentResponse: ref(handshakeId, 'enrollment_response'),
+  tokenRequest: ref(handshakeId, 'token_request'),
+  tokenResponse: ref(handshakeId, 'token_response'),
+  jwks: ref(handshakeId, 'jwks'),
+  revocationState: ref(handshakeId, 'revocation_state'),
+};
+for (const [k, v] of Object.entries(validate)) if (!v) throw new Error(`schema ausente: ${k}`);
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
new file mode 100644
index 0000000..36b6179
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
@@ -0,0 +1,80 @@
+// Validador usado por dispatcher / tool-gateway / ai-gateway: SOMENTE verificacao local.
+// JWKS e estado de revogacao ficam em cache, atualizados por poll/push, nunca por requisicao.
+import { splitJwt, verifySignature, fromPublicJwk } from './jwt.mjs';
+import { validate } from './schemas.mjs';
+import { ISS, MAX_TTL_S, Reject } from './control-plane.mjs';
+
+export class Validator {
+  /**
+   * @param {{audience: string, now: () => number, fetchJwks: () => object, fetchRevocation: () => object,
+   *          skewS?: number, singleUse?: boolean, unknownKidRefreshCooldownS?: number}} o
+   */
+  constructor(o) {
+    this.audience = o.audience;
+    this.now = o.now;
+    this.fetchJwks = o.fetchJwks;
+    this.fetchRevocation = o.fetchRevocation;
+    this.skewS = o.skewS ?? 30;
+    this.singleUse = o.singleUse ?? false; // dispatcher: token de uso unico
+    this.cooldown = o.unknownKidRefreshCooldownS ?? 10;
+    this.keys = new Map();
+    this.minVer = {};
+    this.revokedJti = new Set();
+    this.seen = new Map(); // jti -> limite de retencao
+    this.lastKidRefresh = -Infinity;
+    this.networkCalls = 0; // contador: nenhuma chamada por requisicao
+    this.refresh();
+  }
+
+  /** Poll periodico (ex.: 30 s) ou push de emergencia. */
+  refresh() {
+    this.networkCalls += 1;
+    this.keys = new Map(this.fetchJwks().keys.map((j) => [j.kid, fromPublicJwk(j)]));
+    const r = this.fetchRevocation();
+    this.minVer = r.min_ver;
+    this.revokedJti = new Set(r.revoked_jti ?? []);
+  }
+
+  /**
+   * @param {string} token
+   * @param {{expectedTenantId: string, requiredScope: string}} ctx tenant esperado vem do CONTEXTO
+   *        (job/rota/canal autenticado), nunca do payload do token.
+   * @returns claims
+   */
+  validate(token, ctx) {
+    let p;
+    try { p = splitJwt(token); } catch { throw new Reject('malformed'); }
+    if (!validate.tokenHeader(p.header)) throw new Reject('bad_header'); // alg diferente de EdDSA (none, HS256) cai aqui
+
+    let key = this.keys.get(p.header.kid);
+    if (!key && this.now() - this.lastKidRefresh >= this.cooldown) {
+      this.lastKidRefresh = this.now(); // refresh limitado: kid desconhecido nao vira DoS contra o CP
+      this.refresh();
+      key = this.keys.get(p.header.kid);
+    }
+    if (!key) throw new Reject('unknown_kid');
+    if (!verifySignature(p, key)) throw new Reject('bad_signature'); // payload adulterado cai aqui
+
+    const c = p.claims;
+    if (!validate.tokenClaims(c)) throw new Reject('bad_claims');
+    if (c.iss !== ISS) throw new Reject('bad_issuer');
+    if (c.aud !== this.audience) throw new Reject('bad_audience');
+    if (c.sub !== `runtime:${c.tenant_id}`) throw new Reject('sub_tenant_mismatch');
+    if (c.tenant_id !== ctx.expectedTenantId) throw new Reject('tenant_mismatch');
+    const now = this.now();
+    if (c.exp - c.iat > MAX_TTL_S) throw new Reject('ttl_too_long');
+    if (c.iat > now + this.skewS) throw new Reject('not_yet_valid');
+    if (now > c.exp + this.skewS) throw new Reject('expired');
+    if (c.ver < (this.minVer[c.tenant_id] ?? 1)) throw new Reject('version_revoked');
+    if (this.revokedJti.has(c.jti)) throw new Reject('jti_revoked');
+    if (!c.scope.includes(ctx.requiredScope)) throw new Reject('scope_missing');
+
+    if (this.singleUse) {
+      // so registra apos TODAS as outras checagens: token invalido nao polui o cache
+      if (this.seen.has(c.jti)) throw new Reject('replay');
+      this.seen.set(c.jti, c.exp + this.skewS);
+      if (this.seen.size > 10000) for (const [j, u] of this.seen) if (u < now) this.seen.delete(j);
+    }
+    return c;
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/package.json b/documentacoes/arquitetura/poc/dec-004/package.json
new file mode 100644
index 0000000..2ae58a2
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/package.json
@@ -0,0 +1,14 @@
+{
+  "name": "poc-dec-004-identidade-de-servico",
+  "private": true,
+  "version": "0.0.0",
+  "description": "PoC DESCARTAVEL (ENT-DEC-004). Nao e parte do workspace pnpm nem de producao.",
+  "type": "module",
+  "engines": { "node": ">=24.22.1 <25" },
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "demo": "node demo.mjs",
+    "bench": "node bench.mjs"
+  },
+  "devDependencies": { "ajv": "8.17.1", "ajv-formats": "3.0.1" }
+}
diff --git a/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
new file mode 100644
index 0000000..d962861
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
@@ -0,0 +1,247 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { createHmac } from 'node:crypto';
+import { makeEnv, TENANT_A, TENANT_B } from '../lib/env.mjs';
+import { b64u, newKeyPair, signJwt } from '../lib/jwt.mjs';
+import { ISS } from '../lib/control-plane.mjs';
+
+const ctx = (tenant, scope = 'tools:invoke') => ({ expectedTenantId: tenant, requiredScope: scope });
+const rejects = (fn, code) => assert.throws(fn, (e) => e.code === code, `esperado ${code}`);
+const tokenFor = (env, rt, aud = 'tool-gateway', scope = ['tools:invoke']) =>
+  env.cp.issueToken(rt.tokenRequest(aud, scope)).access_token;
+
+test('caminho feliz: enrollment, emissao e validacao local', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const c = env.validators['tool-gateway'].validate(tokenFor(env, rt), ctx(TENANT_A));
+  assert.equal(c.tenant_id, TENANT_A);
+  assert.equal(c.sub, `runtime:${TENANT_A}`);
+  assert.equal(c.aud, 'tool-gateway');
+  assert.equal(c.exp - c.iat, 300);
+});
+
+test('enrollment: segredo de uso unico, expiravel e sem chave privada na mensagem', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  assert.ok(!JSON.stringify(rt.enrollmentRequest('x'.repeat(32))).includes('"d"'));
+  // reuso do mesmo segredo
+  const secret = env.cp.provisionEnrollmentSecret(TENANT_B);
+  const rtB = new (rt.constructor)(TENANT_B, env.now);
+  env.cp.enroll(rtB.enrollmentRequest(secret));
+  rejects(() => env.cp.enroll(rtB.enrollmentRequest(secret)), 'enrollment_invalid');
+  // expirado
+  const s2 = env.cp.provisionEnrollmentSecret(TENANT_A);
+  env.now.advance(601);
+  rejects(() => env.cp.enroll(rt.enrollmentRequest(s2)), 'enrollment_expired');
+  // segredo errado (mesmo tamanho minimo do esquema)
+  env.cp.provisionEnrollmentSecret(TENANT_A);
+  rejects(() => env.cp.enroll(rt.enrollmentRequest('z'.repeat(43))), 'enrollment_invalid');
+});
+
+test('NEGATIVO: token expirado (alem da tolerancia de 30 s)', () => {
+  const env = makeEnv();
+  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
+  const v = env.validators['tool-gateway'];
+  env.now.advance(300 + 30); // exatamente no limite da tolerancia: ainda aceito
+  assert.doesNotThrow(() => v.validate(t, ctx(TENANT_A)));
+  env.now.advance(1);
+  rejects(() => v.validate(t, ctx(TENANT_A)), 'expired');
+});
+
+test('NEGATIVO: audiencia errada (token do gateway de IA nao vale no tool-gateway)', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const t = tokenFor(env, rt, 'ai-gateway', ['llm:complete']);
+  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A, 'llm:complete')), 'bad_audience');
+  assert.doesNotThrow(() => env.validators['ai-gateway'].validate(t, ctx(TENANT_A, 'llm:complete')));
+});
+
+test('NEGATIVO: tenant adulterado no payload (assinatura nao confere)', () => {
+  const env = makeEnv();
+  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
+  const [h, p, s] = t.split('.');
+  const claims = JSON.parse(Buffer.from(p, 'base64url'));
+  claims.tenant_id = TENANT_B;
+  claims.sub = `runtime:${TENANT_B}`;
+  const forged = `${h}.${b64u(JSON.stringify(claims))}.${s}`;
+  rejects(() => env.validators['tool-gateway'].validate(forged, ctx(TENANT_B)), 'bad_signature');
+});
+
+test('NEGATIVO: token valido de A apresentado em contexto de B (SEC-07)', () => {
+  const env = makeEnv();
+  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
+  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_B)), 'tenant_mismatch');
+});
+
+test('NEGATIVO: claims sub e tenant_id divergentes, assinados pela chave real', () => {
+  const env = makeEnv();
+  const key = env.cp.activeKey;
+  const now = env.now();
+  const claims = { iss: ISS, sub: `runtime:${TENANT_B}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A,
+    jti: b64u(Buffer.alloc(16, 1)), iat: now, exp: now + 300, ver: 1 };
+  const t = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid }, claims, key.privateKey);
+  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A)), 'sub_tenant_mismatch');
+});
+
+test('NEGATIVO: versao de credencial revogada; B nao e afetado (SEC-15)', () => {
+  const env = makeEnv();
+  const rtA = env.enrollRuntime(TENANT_A);
+  const rtB = env.enrollRuntime(TENANT_B);
+  const tA = tokenFor(env, rtA);
+  const tB = tokenFor(env, rtB);
+  const v = env.validators['tool-gateway'];
+  assert.doesNotThrow(() => v.validate(tA, ctx(TENANT_A)));
+  env.cp.revokeTenantCredentials(TENANT_A);
+  env.refreshAll(); // propagacao por poll/push
+  rejects(() => v.validate(tA, ctx(TENANT_A)), 'version_revoked');
+  assert.doesNotThrow(() => v.validate(tB, ctx(TENANT_B)));
+  // runtime A antigo nao consegue novo token; precisa de novo enrollment
+  rejects(() => env.cp.issueToken(rtA.tokenRequest('tool-gateway', ['tools:invoke'])), 'unknown_runtime');
+  const secret = env.cp.provisionEnrollmentSecret(TENANT_A);
+  env.cp.enroll(rtA.enrollmentRequest(secret));
+  const novo = tokenFor(env, rtA);
+  assert.equal(v.validate(novo, ctx(TENANT_A)).ver, 2);
+});
+
+test('NEGATIVO: replay de jti (dispatcher e uso unico; CP rejeita client_assertion repetida)', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const t = tokenFor(env, rt, 'dispatcher', ['jobs:pull']);
+  const d = env.validators.dispatcher;
+  assert.doesNotThrow(() => d.validate(t, ctx(TENANT_A, 'jobs:pull')));
+  rejects(() => d.validate(t, ctx(TENANT_A, 'jobs:pull')), 'replay');
+  // assertion repetida no CP
+  const req = rt.tokenRequest('tool-gateway', ['tools:invoke'], { jti: 'fixed-jti-0123456789' });
+  env.cp.issueToken(req);
+  rejects(() => env.cp.issueToken(req), 'replay');
+  // token invalido (escopo ausente) nao "queima" o jti
+  const t2 = tokenFor(env, rt, 'dispatcher', ['jobs:pull']);
+  rejects(() => d.validate(t2, ctx(TENANT_A, 'jobs:ack')), 'scope_missing');
+  assert.doesNotThrow(() => d.validate(t2, ctx(TENANT_A, 'jobs:pull')));
+});
+
+test('NEGATIVO: escopo nao permitido na emissao e ausente na validacao', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  rejects(() => env.cp.issueToken(rt.tokenRequest('tool-gateway', ['llm:complete'])), 'scope_not_allowed');
+  const t = tokenFor(env, rt);
+  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A, 'tools:admin')), 'scope_missing');
+});
+
+test('NEGATIVO: forjados (alg none, HS256, chave propria, kid desconhecido, lixo)', () => {
+  const env = makeEnv();
+  const v = env.validators['tool-gateway'];
+  const now = env.now();
+  const claims = { iss: ISS, sub: `runtime:${TENANT_A}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A,
+    jti: b64u(Buffer.alloc(16, 2)), iat: now, exp: now + 300, ver: 1 };
+  const kid = env.cp.activeKey.kid;
+  const enc = (o) => b64u(JSON.stringify(o));
+  const none = `${enc({ alg: 'none', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}.`;
+  rejects(() => v.validate(none, ctx(TENANT_A)), 'malformed');
+  const none2 = `${enc({ alg: 'none', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}.AAAA`;
+  rejects(() => v.validate(none2, ctx(TENANT_A)), 'bad_header');
+  const hs = `${enc({ alg: 'HS256', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}`;
+  const hsTok = `${hs}.${createHmac('sha256', 'qualquer').update(hs).digest('base64url')}`;
+  rejects(() => v.validate(hsTok, ctx(TENANT_A)), 'bad_header');
+  const atacante = newKeyPair();
+  const own = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid }, claims, atacante.privateKey);
+  rejects(() => v.validate(own, ctx(TENANT_A)), 'bad_signature');
+  const unk = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: 'outro' }, claims, atacante.privateKey);
+  rejects(() => v.validate(unk, ctx(TENANT_A)), 'unknown_kid');
+  rejects(() => v.validate('lixo', ctx(TENANT_A)), 'malformed');
+  rejects(() => v.validate('a'.repeat(5000), ctx(TENANT_A)), 'malformed');
+});
+
+test('NEGATIVO: TTL acima do maximo e iat no futuro', () => {
+  const env = makeEnv();
+  const key = env.cp.activeKey;
+  const now = env.now();
+  const base = { iss: ISS, sub: `runtime:${TENANT_A}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A, ver: 1 };
+  const sign = (extra) => signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid },
+    { ...base, jti: b64u(Buffer.alloc(16, 3)), ...extra }, key.privateKey);
+  const v = env.validators['tool-gateway'];
+  rejects(() => v.validate(sign({ iat: now, exp: now + 601 }), ctx(TENANT_A)), 'ttl_too_long');
+  rejects(() => v.validate(sign({ iat: now + 31, exp: now + 200 }), ctx(TENANT_A)), 'not_yet_valid');
+});
+
+test('ROTACAO sem downtime com duas chaves (JWKS com kid)', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const v = env.validators['tool-gateway'];
+  const k1 = env.cp.activeKey.kid;
+  const tOld = tokenFor(env, rt); // assinado por k1
+  // 1) publicar k2 (ainda nao assina) e propagar
+  const k2 = env.cp.publishNextKey();
+  assert.equal(env.cp.jwks().keys.length, 2);
+  env.refreshAll();
+  // 2) ativar k2: novos tokens usam k2; antigos (k1) continuam validos
+  env.cp.activateKey(k2);
+  const tNew = tokenFor(env, rt);
+  assert.equal(JSON.parse(Buffer.from(tNew.split('.')[0], 'base64url')).kid, k2);
+  assert.doesNotThrow(() => v.validate(tOld, ctx(TENANT_A)));
+  assert.doesNotThrow(() => v.validate(tNew, ctx(TENANT_A)));
+  // 3) aposentar k1 apos TTL maximo + tolerancia
+  env.now.advance(300 + 30 + 1);
+  env.cp.retireKey(k1);
+  env.refreshAll();
+  assert.deepEqual(env.cp.jwks().keys.map((k) => k.kid), [k2]);
+  rejects(() => v.validate(tOld, ctx(TENANT_A)), 'unknown_kid');
+  const tFresh = tokenFor(env, rt);
+  assert.doesNotThrow(() => v.validate(tFresh, ctx(TENANT_A)));
+  // chave ativa nao pode ser aposentada
+  assert.throws(() => env.cp.retireKey(k2));
+});
+
+test('ROTACAO: validador que ainda nao atualizou o JWKS faz refresh limitado por kid desconhecido', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const v = env.validators['tool-gateway'];
+  const k2 = env.cp.publishNextKey();
+  env.cp.activateKey(k2); // sem propagar antes (caso ruim)
+  const calls = v.networkCalls;
+  const t = tokenFor(env, rt);
+  assert.doesNotThrow(() => v.validate(t, ctx(TENANT_A))); // refresh sob demanda
+  assert.equal(v.networkCalls, calls + 1);
+  // kid inexistente em rajada: no maximo 1 refresh por janela de 10 s
+  const bad = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: 'zzz' }, {}, newKeyPair().privateKey);
+  for (let i = 0; i < 50; i++) rejects(() => v.validate(bad, ctx(TENANT_A)), 'unknown_kid');
+  assert.ok(v.networkCalls <= calls + 2);
+});
+
+test('REVOGACAO DE EMERGENCIA da chave de assinatura: tokens da chave comprometida caem na hora', () => {
+  const env = makeEnv();
+  const rtA = env.enrollRuntime(TENANT_A);
+  const v = env.validators['tool-gateway'];
+  const comprometida = env.cp.activeKey;
+  const tVivo = tokenFor(env, rtA); // ainda dentro do TTL
+  const forjado = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: comprometida.kid },
+    { iss: ISS, sub: `runtime:${TENANT_B}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_B,
+      jti: b64u(Buffer.alloc(16, 4)), iat: env.now(), exp: env.now() + 300, ver: 1 }, comprometida.privateKey);
+  assert.doesNotThrow(() => v.validate(forjado, ctx(TENANT_B))); // atacante com a chave vazada teria acesso
+  env.cp.emergencyRevokeKey(comprometida.kid);
+  env.refreshAll(); // push de emergencia, sem esperar o poll
+  rejects(() => v.validate(tVivo, ctx(TENANT_A)), 'unknown_kid');
+  rejects(() => v.validate(forjado, ctx(TENANT_B)), 'unknown_kid');
+  // runtime legitimo re-emite com a nova chave: recuperacao sem novo enrollment
+  assert.doesNotThrow(() => v.validate(tokenFor(env, rtA), ctx(TENANT_A)));
+});
+
+test('REVOGACAO pontual de jti', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const t = tokenFor(env, rt);
+  const jti = JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).jti;
+  env.cp.revokedJti.push(jti);
+  env.refreshAll();
+  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A)), 'jti_revoked');
+});
+
+test('VALIDACAO LOCAL: nenhuma chamada de rede por requisicao', () => {
+  const env = makeEnv();
+  const rt = env.enrollRuntime(TENANT_A);
+  const v = env.validators['tool-gateway'];
+  const t = tokenFor(env, rt);
+  const antes = v.networkCalls;
+  for (let i = 0; i < 1000; i++) v.validate(t, ctx(TENANT_A));
+  assert.equal(v.networkCalls, antes);
+});
```

## Correção rodada 1

Diff não commitado antes do commit da rodada 1 (contra o commit `4c6bd4a`; novo commit sem amend). Inclui `lib/`, `test/` e `demo.mjs`; `saida/*.txt` regerados (sem diff) e ADR, README e documento da entrega alterados apenas em texto (sem diff).

```diff
diff --git a/documentacoes/arquitetura/poc/dec-004/demo.mjs b/documentacoes/arquitetura/poc/dec-004/demo.mjs
index adcfb7c..2b29cfd 100644
--- a/documentacoes/arquitetura/poc/dec-004/demo.mjs
+++ b/documentacoes/arquitetura/poc/dec-004/demo.mjs
@@ -25,7 +25,7 @@ const adulterado = JSON.parse(Buffer.from(p, 'base64url')); adulterado.tenant_id
 attempt('tenant adulterado no payload', () => gw.validate(`${h}.${b64u(JSON.stringify(adulterado))}.${s}`, ctx(TENANT_B)));
 attempt('token de A em contexto de B', () => gw.validate(tA, ctx(TENANT_B)));
 attempt('audiencia errada (ai-gateway no tool-gateway)', () => gw.validate(issue(rtA, 'ai-gateway', ['llm:complete']), ctx(TENANT_A, 'llm:complete')));
-const tExp = issue(rtA); env.now.advance(331);
+const tExp = issue(rtA); env.now.advance(331); env.refreshAll(); // poll em dia
 attempt('expirado (331 s apos emissao)', () => gw.validate(tExp, ctx(TENANT_A)));
 env.now.advance(-331);
 const tV = issue(rtA); env.cp.revokeTenantCredentials(TENANT_A); env.refreshAll();
@@ -60,4 +60,10 @@ const k3 = env.cp.emergencyRevokeKey(comp.kid); env.refreshAll();
 log(`  chave ${comp.kid} revogada; nova ativa ${k3}; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
 attempt('mesmo token vivo apos revogacao', () => gw.validate(vivo, ctx(TENANT_B)));
 attempt('runtime B reemite e volta a operar (sem novo enrollment)', () => gw.validate(issue(rtB), ctx(TENANT_B)));
+log('== 5. Obsolescencia do estado de revogacao (max_staleness = 90 s, fail-closed)');
+const tR = issue(rtB); env.refreshAll();
+env.cp.revokeTenantCredentials(TENANT_B); // validador ainda nao recebeu o poll (CP "fora")
+env.now.advance(60); attempt('token revogado, 60 s sem refresh (dentro de max_staleness)', () => gw.validate(tR, ctx(TENANT_B)));
+env.now.advance(31); attempt('token revogado, 91 s sem refresh (fora de max_staleness)', () => gw.validate(tR, ctx(TENANT_B)));
+gw.refresh(); attempt('apos refresh bem-sucedido', () => gw.validate(tR, ctx(TENANT_B)));
 log(`\nchamadas de rede do tool-gateway ao CP (refresh/poll) em toda a demo: ${gw.networkCalls}`);
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
index 36b6179..b73d709 100644
--- a/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
+++ b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
@@ -7,7 +7,8 @@ import { ISS, MAX_TTL_S, Reject } from './control-plane.mjs';
 export class Validator {
   /**
    * @param {{audience: string, now: () => number, fetchJwks: () => object, fetchRevocation: () => object,
-   *          skewS?: number, singleUse?: boolean, unknownKidRefreshCooldownS?: number}} o
+   *          skewS?: number, singleUse?: boolean, unknownKidRefreshCooldownS?: number,
+   *          maxStalenessS?: number}} o
    */
   constructor(o) {
     this.audience = o.audience;
@@ -17,6 +18,9 @@ export class Validator {
     this.skewS = o.skewS ?? 30;
     this.singleUse = o.singleUse ?? false; // dispatcher: token de uso unico
     this.cooldown = o.unknownKidRefreshCooldownS ?? 10;
+    this.maxStalenessS = o.maxStalenessS ?? 90; // proposto (ADR-018, decisao 7): 3x o poll de 30 s; decisao humana
+    this.lastRefreshOk = -Infinity; // relogio LOCAL do ultimo refresh bem-sucedido (nao confia em generated_at do CP)
+    this.refreshFailures = 0;
     this.keys = new Map();
     this.minVer = {};
     this.revokedJti = new Set();
@@ -26,13 +30,25 @@ export class Validator {
     this.refresh();
   }
 
-  /** Poll periodico (ex.: 30 s) ou push de emergencia. */
+  /**
+   * Poll periodico (ex.: 30 s) ou push de emergencia. Atomico: busca JWKS e revogacao em variaveis locais
+   * e so entao troca o estado e o carimbo. Em falha, mantem o estado anterior, NAO avanca o carimbo,
+   * contabiliza e propaga o erro (fail-closed por idade em validate()).
+   */
   refresh() {
     this.networkCalls += 1;
-    this.keys = new Map(this.fetchJwks().keys.map((j) => [j.kid, fromPublicJwk(j)]));
-    const r = this.fetchRevocation();
+    let keys; let r;
+    try {
+      keys = new Map(this.fetchJwks().keys.map((j) => [j.kid, fromPublicJwk(j)]));
+      r = this.fetchRevocation();
+    } catch (e) {
+      this.refreshFailures += 1;
+      throw e;
+    }
+    this.keys = keys;
     this.minVer = r.min_ver;
     this.revokedJti = new Set(r.revoked_jti ?? []);
+    this.lastRefreshOk = this.now();
   }
 
   /**
@@ -49,9 +65,11 @@ export class Validator {
     let key = this.keys.get(p.header.kid);
     if (!key && this.now() - this.lastKidRefresh >= this.cooldown) {
       this.lastKidRefresh = this.now(); // refresh limitado: kid desconhecido nao vira DoS contra o CP
-      this.refresh();
+      try { this.refresh(); } catch { /* CP indisponivel: segue com o estado em cache; a idade e checada abaixo */ }
       key = this.keys.get(p.header.kid);
     }
+    // fail-closed: estado de revogacao mais velho que max_staleness nao garante o efeito da revogacao
+    if (this.now() - this.lastRefreshOk > this.maxStalenessS) throw new Reject('revocation_state_stale');
     if (!key) throw new Reject('unknown_kid');
     if (!verifySignature(p, key)) throw new Reject('bad_signature'); // payload adulterado cai aqui
 
diff --git a/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
index d962861..0f1fd7e 100644
--- a/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
+++ b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
@@ -4,6 +4,7 @@ import { createHmac } from 'node:crypto';
 import { makeEnv, TENANT_A, TENANT_B } from '../lib/env.mjs';
 import { b64u, newKeyPair, signJwt } from '../lib/jwt.mjs';
 import { ISS } from '../lib/control-plane.mjs';
+import { Validator } from '../lib/validator.mjs';
 
 const ctx = (tenant, scope = 'tools:invoke') => ({ expectedTenantId: tenant, requiredScope: scope });
 const rejects = (fn, code) => assert.throws(fn, (e) => e.code === code, `esperado ${code}`);
@@ -43,8 +44,10 @@ test('NEGATIVO: token expirado (alem da tolerancia de 30 s)', () => {
   const t = tokenFor(env, env.enrollRuntime(TENANT_A));
   const v = env.validators['tool-gateway'];
   env.now.advance(300 + 30); // exatamente no limite da tolerancia: ainda aceito
+  env.refreshAll(); // poll em dia: o estado de revogacao nao esta obsoleto (ver testes de max_staleness)
   assert.doesNotThrow(() => v.validate(t, ctx(TENANT_A)));
   env.now.advance(1);
+  env.refreshAll();
   rejects(() => v.validate(t, ctx(TENANT_A)), 'expired');
 });
 
@@ -245,3 +248,74 @@ test('VALIDACAO LOCAL: nenhuma chamada de rede por requisicao', () => {
   for (let i = 0; i < 1000; i++) v.validate(t, ctx(TENANT_A));
   assert.equal(v.networkCalls, antes);
 });
+
+// ---- REV-001 / REV-002: limite de obsolescencia (max_staleness) do estado de revogacao, fail-closed ----
+function staleEnv(extra = {}) {
+  const env = makeEnv();
+  const cp = { down: false };
+  const gw = new Validator({
+    audience: 'tool-gateway', now: env.now, ...extra,
+    fetchJwks: () => { if (cp.down) throw new Error('CP indisponivel'); return env.cp.jwks(); },
+    fetchRevocation: () => { if (cp.down) throw new Error('CP indisponivel'); return env.cp.revocationState(); },
+  });
+  return { env, cp, gw };
+}
+
+test('STALENESS: CP indisponivel - aceita dentro de max_staleness e rejeita fora (revocation_state_stale)', () => {
+  const { env, cp, gw } = staleEnv();
+  assert.equal(gw.maxStalenessS, 90);
+  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
+  cp.down = true;
+  env.now.advance(90); // exatamente no limite: ainda aceito
+  assert.throws(() => gw.refresh(), /CP indisponivel/);
+  assert.doesNotThrow(() => gw.validate(t, ctx(TENANT_A)));
+  env.now.advance(1);
+  rejects(() => gw.validate(t, ctx(TENANT_A)), 'revocation_state_stale');
+  // recuperacao: refresh bem-sucedido restaura a validacao
+  cp.down = false;
+  gw.refresh();
+  assert.doesNotThrow(() => gw.validate(t, ctx(TENANT_A)));
+});
+
+test('STALENESS: token revogado e nunca aceito sem refresh depois do limite', () => {
+  const { env, gw } = staleEnv();
+  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
+  assert.doesNotThrow(() => gw.validate(t, ctx(TENANT_A)));
+  env.cp.revokeTenantCredentials(TENANT_A); // revogacao no CP; o validador NAO recebeu o poll
+  env.now.advance(60);
+  assert.doesNotThrow(() => gw.validate(t, ctx(TENANT_A))); // janela conhecida: ate max_staleness
+  env.now.advance(31);
+  rejects(() => gw.validate(t, ctx(TENANT_A)), 'revocation_state_stale'); // 91 s > 90 s: fail-closed
+  env.now.advance(150); // ainda dentro do TTL do token (exp = +300)
+  rejects(() => gw.validate(t, ctx(TENANT_A)), 'revocation_state_stale');
+  gw.refresh();
+  rejects(() => gw.validate(t, ctx(TENANT_A)), 'version_revoked');
+});
+
+test('STALENESS: carimbo usa o relogio local no refresh bem-sucedido (nao o generated_at do CP)', () => {
+  const { env, gw } = staleEnv();
+  const antes = gw.lastRefreshOk;
+  env.now.advance(40);
+  gw.refresh();
+  assert.equal(gw.lastRefreshOk, antes + 40);
+  assert.equal(gw.lastRefreshOk, env.now());
+});
+
+test('REFRESH atomico: falha em fetchRevocation mantem o estado anterior e nao avanca o carimbo', () => {
+  const env = makeEnv();
+  let falhar = false;
+  const gw = new Validator({
+    audience: 'tool-gateway', now: env.now, fetchJwks: () => env.cp.jwks(),
+    fetchRevocation: () => { if (falhar) throw new Error('revogacao indisponivel'); return env.cp.revocationState(); },
+  });
+  const rt = env.enrollRuntime(TENANT_A);
+  env.cp.publishNextKey(); // JWKS do CP agora difere do cache do validador
+  const keysAntes = gw.keys; const carimbo = gw.lastRefreshOk; const minVer = gw.minVer;
+  env.now.advance(10); falhar = true;
+  assert.throws(() => gw.refresh(), /revogacao indisponivel/);
+  assert.equal(gw.keys, keysAntes); // JWKS NAO foi trocado pela metade
+  assert.equal(gw.minVer, minVer);
+  assert.equal(gw.lastRefreshOk, carimbo);
+  assert.equal(gw.refreshFailures, 1);
+  assert.doesNotThrow(() => gw.validate(tokenFor(env, rt), ctx(TENANT_A)));
+});
```

## Correção rodada 2

Diff contra `066504a` (HEAD da rodada 1; novo commit sem amend). Inclui `lib/validator.mjs`, `test/poc.test.mjs` e `README.md` do PoC; `saida/*.txt` regerados e ADR/entrega alterados só em texto (sem diff).

```diff
diff --git a/documentacoes/arquitetura/poc/dec-004/README.md b/documentacoes/arquitetura/poc/dec-004/README.md
index 3c5d72e..3b72860 100644
--- a/documentacoes/arquitetura/poc/dec-004/README.md
+++ b/documentacoes/arquitetura/poc/dec-004/README.md
@@ -9,7 +9,7 @@ Runtime falso, Control Plane falso e validadores locais. Sem rede, sem banco, se
 export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$PATH"
 cd documentacoes/arquitetura/poc/dec-004
 npm ci            # reproduz as dependências do lock file
-npm test          # 21 testes (casos negativos, rotação, revogação)
+npm test          # 22 testes (casos negativos, rotação, revogação)
 npm run demo      # narrativa: negativos, rotação, revogação de emergência
 npm run bench     # latência da validação local
 ```
diff --git a/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
index b73d709..014681b 100644
--- a/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
+++ b/documentacoes/arquitetura/poc/dec-004/lib/validator.mjs
@@ -19,6 +19,8 @@ export class Validator {
     this.singleUse = o.singleUse ?? false; // dispatcher: token de uso unico
     this.cooldown = o.unknownKidRefreshCooldownS ?? 10;
     this.maxStalenessS = o.maxStalenessS ?? 90; // proposto (ADR-018, decisao 7): 3x o poll de 30 s; decisao humana
+    // PoC: now() injetavel (relogio de parede em producao). O validador de producao DEVE medir esta idade com relogio
+    // monotonico (ADR-018 7.1); recuo do relogio de parede alonga a janela alem de max_staleness.
     this.lastRefreshOk = -Infinity; // relogio LOCAL do ultimo refresh bem-sucedido (nao confia em generated_at do CP)
     this.refreshFailures = 0;
     this.keys = new Map();
@@ -32,22 +34,25 @@ export class Validator {
 
   /**
    * Poll periodico (ex.: 30 s) ou push de emergencia. Atomico: busca JWKS e revogacao em variaveis locais
-   * e so entao troca o estado e o carimbo. Em falha, mantem o estado anterior, NAO avanca o carimbo,
+   * valida o formato da resposta e so entao troca o estado e o carimbo. Em falha, mantem o estado anterior, NAO avanca o carimbo,
    * contabiliza e propaga o erro (fail-closed por idade em validate()).
    */
   refresh() {
     this.networkCalls += 1;
-    let keys; let r;
+    let keys; let minVer; let revokedJti;
     try {
       keys = new Map(this.fetchJwks().keys.map((j) => [j.kid, fromPublicJwk(j)]));
-      r = this.fetchRevocation();
+      const r = this.fetchRevocation();
+      if (!validate.revocationState(r)) throw new Error('resposta de revogacao malformada'); // null, {} ou min_ver:null
+      minVer = r.min_ver;
+      revokedJti = new Set(r.revoked_jti ?? []);
     } catch (e) {
       this.refreshFailures += 1;
       throw e;
     }
     this.keys = keys;
-    this.minVer = r.min_ver;
-    this.revokedJti = new Set(r.revoked_jti ?? []);
+    this.minVer = minVer;
+    this.revokedJti = revokedJti;
     this.lastRefreshOk = this.now();
   }
 
diff --git a/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
index 0f1fd7e..3293729 100644
--- a/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
+++ b/documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs
@@ -319,3 +319,30 @@ test('REFRESH atomico: falha em fetchRevocation mantem o estado anterior e nao a
   assert.equal(gw.refreshFailures, 1);
   assert.doesNotThrow(() => gw.validate(tokenFor(env, rt), ctx(TENANT_A)));
 });
+
+test('REFRESH atomico: resposta de revogacao malformada (null, {}, min_ver:null) nao troca estado nem avanca carimbo', () => {
+  const env = makeEnv();
+  let resp = null; let usar = false;
+  const gw = new Validator({
+    audience: 'tool-gateway', now: env.now, fetchJwks: () => env.cp.jwks(),
+    fetchRevocation: () => (usar ? resp : env.cp.revocationState()),
+  });
+  const rt = env.enrollRuntime(TENANT_A);
+  env.cp.publishNextKey();
+  const keysAntes = gw.keys; const minVer = gw.minVer; const jtis = gw.revokedJti; const carimbo = gw.lastRefreshOk;
+  usar = true;
+  let falhas = 0;
+  for (const m of [null, {}, { generated_at: 1, min_ver: null }]) {
+    resp = m; env.now.advance(10);
+    assert.throws(() => gw.refresh(), (e) => e instanceof Error && !(e instanceof TypeError));
+    falhas += 1;
+    assert.equal(gw.keys, keysAntes);
+    assert.equal(gw.minVer, minVer);
+    assert.equal(gw.revokedJti, jtis);
+    assert.equal(gw.lastRefreshOk, carimbo);
+    assert.equal(gw.refreshFailures, falhas);
+  }
+  assert.doesNotThrow(() => gw.validate(tokenFor(env, rt), ctx(TENANT_A))); // ainda dentro do limite
+  env.now.advance(61); // 91 s desde o ultimo refresh bom
+  rejects(() => gw.validate(tokenFor(env, rt), ctx(TENANT_A)), 'revocation_state_stale'); // nunca TypeError
+});
```
