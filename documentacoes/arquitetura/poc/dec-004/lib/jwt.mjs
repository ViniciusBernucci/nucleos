// PoC DESCARTAVEL (ENT-DEC-004). JWT EdDSA minimo com node:crypto.
// Em producao usar biblioteca revisada (ex.: jose); aqui o formato fica visivel de proposito.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64u = (s) => Buffer.from(s, 'base64url');

export function newKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey, privateKey };
}

export function toPublicJwk(publicKey, kid) {
  const { x } = publicKey.export({ format: 'jwk' });
  return { kty: 'OKP', crv: 'Ed25519', x, kid, use: 'sig', alg: 'EdDSA' };
}

export function fromPublicJwk(jwk) {
  return createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: 'jwk' });
}

export function signJwt(header, claims, privateKey) {
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(claims));
  const sig = sign(null, Buffer.from(`${h}.${p}`), privateKey);
  return `${h}.${p}.${b64u(sig)}`;
}

/** Divide sem verificar assinatura. Lanca Error('malformed') se a estrutura estiver errada. */
export function splitJwt(token) {
  if (typeof token !== 'string' || token.length > 4096) throw new Error('malformed');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('malformed');
  try {
    return {
      header: JSON.parse(fromB64u(parts[0]).toString('utf8')),
      claims: JSON.parse(fromB64u(parts[1]).toString('utf8')),
      signingInput: Buffer.from(`${parts[0]}.${parts[1]}`),
      signature: fromB64u(parts[2]),
    };
  } catch {
    throw new Error('malformed');
  }
}

export function verifySignature(parsed, publicKey) {
  return verify(null, parsed.signingInput, publicKey, parsed.signature);
}

export { createPrivateKey };
