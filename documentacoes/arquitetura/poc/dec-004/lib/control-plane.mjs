// Control Plane FALSO: enrollment, emissao de token, JWKS, rotacao e revogacao.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { newKeyPair, toPublicJwk, fromPublicJwk, signJwt, splitJwt, verifySignature, b64u } from './jwt.mjs';
import { validate } from './schemas.mjs';

export const ISS = 'nucleos-control-plane';
export const TOKEN_TTL_S = 300;
export const MAX_TTL_S = 600;
const ASSERTION_MAX_TTL_S = 60;
const ENROLL_TTL_S = 600;
const SKEW_S = 30;

// Politica de escopos por audiencia (deny by default).
export const ALLOWED_SCOPES = {
  dispatcher: ['jobs:pull', 'jobs:ack'],
  'tool-gateway': ['tools:invoke'],
  'ai-gateway': ['llm:complete', 'llm:embed'],
};

const sha256 = (s) => createHash('sha256').update(s).digest();

export class Reject extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
  }
}

export class ControlPlane {
  /** @param {{now: () => number}} opts now() em segundos Unix. */
  constructor({ now }) {
    this.now = now;
    this.keys = []; // {kid, publicKey, privateKey, state: 'published'|'active'|'retired'}
    this.tenants = new Map(); // tenant_id -> {ver, minVer, runtimeKid, runtimeKey}
    this.enrollments = new Map(); // tenant_id -> {hash, exp, used}
    this.seenAssertionJti = new Map();
    this.minVer = {}; // tenant_id -> ver minima
    this.revokedJti = [];
    this.#addKey('active');
  }

  #addKey(state) {
    const { publicKey, privateKey } = newKeyPair();
    const kid = `cp-${b64u(randomBytes(6))}`;
    this.keys.push({ kid, publicKey, privateKey, state });
    return kid;
  }

  get activeKey() {
    return this.keys.find((k) => k.state === 'active');
  }

  // ---- JWKS e estado de revogacao (consumidos por poll curto ou push de emergencia) ----
  jwks() {
    const doc = { keys: this.keys.filter((k) => k.state !== 'retired').map((k) => toPublicJwk(k.publicKey, k.kid)) };
    if (!validate.jwks(doc)) throw new Error('jwks fora do esquema');
    return doc;
  }

  revocationState() {
    const doc = { generated_at: this.now(), min_ver: { ...this.minVer }, revoked_jti: [...this.revokedJti] };
    if (!validate.revocationState(doc)) throw new Error('revocation_state fora do esquema');
    return doc;
  }

  // ---- Rotacao sem downtime (duas chaves ativas): publicar -> ativar -> aposentar ----
  publishNextKey() { return this.#addKey('published'); }
  activateKey(kid) {
    const next = this.keys.find((k) => k.kid === kid && k.state === 'published');
    if (!next) throw new Error('chave nao publicada');
    this.activeKey.state = 'published'; // a anterior continua no JWKS ate expirar seus tokens
    next.state = 'active';
  }
  retireKey(kid) {
    const k = this.keys.find((x) => x.kid === kid);
    if (!k || k.state === 'active') throw new Error('nao e possivel aposentar a chave ativa');
    k.state = 'retired';
  }

  /** Revogacao de emergencia de chave de assinatura: nova chave ativa e a comprometida sai do JWKS. */
  emergencyRevokeKey(compromisedKid) {
    const fresh = this.#addKey('active');
    for (const k of this.keys) {
      if (k.kid === compromisedKid) k.state = 'retired';
      else if (k.kid !== fresh && k.state === 'active') k.state = 'published';
    }
    return fresh;
  }

  /** Revogacao por tenant: sobe a versao minima; so afeta o tenant informado. */
  revokeTenantCredentials(tenantId) {
    const t = this.tenants.get(tenantId);
    if (!t) throw new Error('tenant desconhecido');
    t.ver += 1;
    this.minVer[tenantId] = t.ver; // tokens com ver < t.ver passam a ser rejeitados
    t.runtimeKey = null; // exige novo enrollment
    t.runtimeKid = null;
    return t.ver;
  }

  // ---- Enrollment: segredo de uso unico (gerado pelo provisioner) ----
  provisionEnrollmentSecret(tenantId) {
    const secret = b64u(randomBytes(32));
    this.enrollments.set(tenantId, { hash: sha256(secret), exp: this.now() + ENROLL_TTL_S, used: false });
    if (!this.tenants.has(tenantId)) this.tenants.set(tenantId, { ver: 1, runtimeKid: null, runtimeKey: null });
    return secret;
  }

  enroll(req) {
    if (!validate.enrollmentRequest(req)) throw new Reject('schema', 'enrollment_request');
    const e = this.enrollments.get(req.tenant_id);
    if (!e || e.used) throw new Reject('enrollment_invalid');
    if (this.now() > e.exp) throw new Reject('enrollment_expired');
    const a = sha256(req.enrollment_secret);
    if (a.length !== e.hash.length || !timingSafeEqual(a, e.hash)) throw new Reject('enrollment_invalid');
    e.used = true; // consome antes de qualquer outra coisa
    const t = this.tenants.get(req.tenant_id);
    t.runtimeKid = req.runtime_public_key.kid;
    t.runtimeKey = fromPublicJwk(req.runtime_public_key);
    const res = { tenant_id: req.tenant_id, ver: t.ver, runtime_kid: t.runtimeKid };
    if (!validate.enrollmentResponse(res)) throw new Error('enrollment_response fora do esquema');
    return res;
  }

  // ---- Emissao de token: runtime prova posse da chave privada (client_assertion) ----
  issueToken(req) {
    if (!validate.tokenRequest(req)) throw new Reject('schema', 'token_request');
    let a;
    try { a = splitJwt(req.client_assertion); } catch { throw new Reject('malformed'); }
    const tenantId = typeof a.claims.sub === 'string' ? a.claims.sub.replace(/^runtime:/, '') : '';
    const t = this.tenants.get(tenantId);
    if (!t || !t.runtimeKey) throw new Reject('unknown_runtime');
    if (a.header.alg !== 'EdDSA' || a.header.kid !== t.runtimeKid) throw new Reject('bad_header');
    if (!verifySignature(a, t.runtimeKey)) throw new Reject('bad_signature');
    const now = this.now();
    const c = a.claims;
    if (c.aud !== ISS) throw new Reject('bad_audience');
    if (!Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.exp - c.iat > ASSERTION_MAX_TTL_S) throw new Reject('bad_ttl');
    if (c.iat > now + SKEW_S) throw new Reject('not_yet_valid');
    if (now > c.exp + SKEW_S) throw new Reject('expired');
    if (typeof c.jti !== 'string' || this.seenAssertionJti.has(c.jti)) throw new Reject('replay');
    this.seenAssertionJti.set(c.jti, c.exp + SKEW_S);
    for (const [j, until] of this.seenAssertionJti) if (until < now) this.seenAssertionJti.delete(j);

    const allowed = ALLOWED_SCOPES[req.audience] ?? [];
    if (!req.scope.every((s) => allowed.includes(s))) throw new Reject('scope_not_allowed');

    const key = this.activeKey;
    const claims = {
      iss: ISS, sub: `runtime:${tenantId}`, aud: req.audience, scope: [...new Set(req.scope)],
      tenant_id: tenantId, jti: b64u(randomBytes(16)), iat: now, exp: now + TOKEN_TTL_S, ver: t.ver,
    };
    const header = { alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid };
    if (!validate.tokenHeader(header) || !validate.tokenClaims(claims)) throw new Error('token fora do esquema');
    const res = { access_token: signJwt(header, claims, key.privateKey), token_type: 'Bearer', expires_in: TOKEN_TTL_S };
    if (!validate.tokenResponse(res)) throw new Error('token_response fora do esquema');
    return res;
  }
}
