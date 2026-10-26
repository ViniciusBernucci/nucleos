// Runtime FALSO: guarda a propria chave privada (nunca enviada) e pede tokens ao CP.
import { randomBytes } from 'node:crypto';
import { newKeyPair, toPublicJwk, signJwt, b64u } from './jwt.mjs';
import { ISS } from './control-plane.mjs';

export class FakeRuntime {
  constructor(tenantId, now) {
    this.tenantId = tenantId;
    this.now = now;
    this.kid = `rt-${b64u(randomBytes(6))}`;
    const kp = newKeyPair();
    this.privateKey = kp.privateKey;
    this.publicKey = kp.publicKey;
  }

  enrollmentRequest(secret) {
    return { tenant_id: this.tenantId, enrollment_secret: secret, runtime_public_key: toPublicJwk(this.publicKey, this.kid) };
  }

  tokenRequest(audience, scope, { jti, iat } = {}) {
    const now = iat ?? this.now();
    const assertion = signJwt(
      { alg: 'EdDSA', typ: 'nucleos-runtime-assertion+jwt', kid: this.kid },
      { sub: `runtime:${this.tenantId}`, aud: ISS, jti: jti ?? b64u(randomBytes(16)), iat: now, exp: now + 60 },
      this.privateKey,
    );
    return { client_assertion: assertion, audience, scope };
  }
}
