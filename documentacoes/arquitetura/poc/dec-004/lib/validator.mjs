// Validador usado por dispatcher / tool-gateway / ai-gateway: SOMENTE verificacao local.
// JWKS e estado de revogacao ficam em cache, atualizados por poll/push, nunca por requisicao.
import { splitJwt, verifySignature, fromPublicJwk } from './jwt.mjs';
import { validate } from './schemas.mjs';
import { ISS, MAX_TTL_S, Reject } from './control-plane.mjs';

export class Validator {
  /**
   * @param {{audience: string, now: () => number, fetchJwks: () => object, fetchRevocation: () => object,
   *          skewS?: number, singleUse?: boolean, unknownKidRefreshCooldownS?: number}} o
   */
  constructor(o) {
    this.audience = o.audience;
    this.now = o.now;
    this.fetchJwks = o.fetchJwks;
    this.fetchRevocation = o.fetchRevocation;
    this.skewS = o.skewS ?? 30;
    this.singleUse = o.singleUse ?? false; // dispatcher: token de uso unico
    this.cooldown = o.unknownKidRefreshCooldownS ?? 10;
    this.keys = new Map();
    this.minVer = {};
    this.revokedJti = new Set();
    this.seen = new Map(); // jti -> limite de retencao
    this.lastKidRefresh = -Infinity;
    this.networkCalls = 0; // contador: nenhuma chamada por requisicao
    this.refresh();
  }

  /** Poll periodico (ex.: 30 s) ou push de emergencia. */
  refresh() {
    this.networkCalls += 1;
    this.keys = new Map(this.fetchJwks().keys.map((j) => [j.kid, fromPublicJwk(j)]));
    const r = this.fetchRevocation();
    this.minVer = r.min_ver;
    this.revokedJti = new Set(r.revoked_jti ?? []);
  }

  /**
   * @param {string} token
   * @param {{expectedTenantId: string, requiredScope: string}} ctx tenant esperado vem do CONTEXTO
   *        (job/rota/canal autenticado), nunca do payload do token.
   * @returns claims
   */
  validate(token, ctx) {
    let p;
    try { p = splitJwt(token); } catch { throw new Reject('malformed'); }
    if (!validate.tokenHeader(p.header)) throw new Reject('bad_header'); // alg diferente de EdDSA (none, HS256) cai aqui

    let key = this.keys.get(p.header.kid);
    if (!key && this.now() - this.lastKidRefresh >= this.cooldown) {
      this.lastKidRefresh = this.now(); // refresh limitado: kid desconhecido nao vira DoS contra o CP
      this.refresh();
      key = this.keys.get(p.header.kid);
    }
    if (!key) throw new Reject('unknown_kid');
    if (!verifySignature(p, key)) throw new Reject('bad_signature'); // payload adulterado cai aqui

    const c = p.claims;
    if (!validate.tokenClaims(c)) throw new Reject('bad_claims');
    if (c.iss !== ISS) throw new Reject('bad_issuer');
    if (c.aud !== this.audience) throw new Reject('bad_audience');
    if (c.sub !== `runtime:${c.tenant_id}`) throw new Reject('sub_tenant_mismatch');
    if (c.tenant_id !== ctx.expectedTenantId) throw new Reject('tenant_mismatch');
    const now = this.now();
    if (c.exp - c.iat > MAX_TTL_S) throw new Reject('ttl_too_long');
    if (c.iat > now + this.skewS) throw new Reject('not_yet_valid');
    if (now > c.exp + this.skewS) throw new Reject('expired');
    if (c.ver < (this.minVer[c.tenant_id] ?? 1)) throw new Reject('version_revoked');
    if (this.revokedJti.has(c.jti)) throw new Reject('jti_revoked');
    if (!c.scope.includes(ctx.requiredScope)) throw new Reject('scope_missing');

    if (this.singleUse) {
      // so registra apos TODAS as outras checagens: token invalido nao polui o cache
      if (this.seen.has(c.jti)) throw new Reject('replay');
      this.seen.set(c.jti, c.exp + this.skewS);
      if (this.seen.size > 10000) for (const [j, u] of this.seen) if (u < now) this.seen.delete(j);
    }
    return c;
  }
}
