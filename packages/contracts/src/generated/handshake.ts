/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/handshake.schema.json

/**
 * Mensagens entre runtime, Control Plane (CP) e servicos validadores. Transporte TLS; nenhuma mensagem carrega chave privada. Cada mensagem e validada por referencia a $defs/<nome>.
 */
export interface Handshake {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "jwk_publica".
 */
export interface HandshakeJwkPublica {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  use: "sig";
  alg: "EdDSA";
}
/**
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "enrollment_request".
 */
export interface HandshakeEnrollmentRequest {
  tenant_id: string;
  /**
   * Uso unico, expira em minutos, gerado pelo provisioner; nunca logado.
   */
  enrollment_secret: string;
  runtime_public_key: HandshakeJwkPublica;
}
/**
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "enrollment_response".
 */
export interface HandshakeEnrollmentResponse {
  tenant_id: string;
  ver: number;
  runtime_kid: string;
}
/**
 * client_assertion e um JWT EdDSA assinado com a chave privada do runtime (header kid = runtime_kid; claims: sub=runtime:<tenant_id>, aud=nucleos-control-plane, jti, iat, exp<=60 s).
 *
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "token_request".
 */
export interface HandshakeTokenRequest {
  client_assertion: string;
  audience: "dispatcher" | "tool-gateway" | "ai-gateway";
  /**
   * @minItems 1
   */
  scope: [string, ...string[]];
}
/**
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "token_response".
 */
export interface HandshakeTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
}
/**
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "jwks".
 */
export interface HandshakeJwks {
  /**
   * @minItems 1
   * @maxItems 3
   */
  keys:
    | [HandshakeJwkPublica]
    | [HandshakeJwkPublica, HandshakeJwkPublica]
    | [HandshakeJwkPublica, HandshakeJwkPublica, HandshakeJwkPublica];
}
/**
 * Estado consultavel pelos validadores (poll curto e/ou push de emergencia). Nunca consultado por requisicao.
 *
 * This interface was referenced by `Handshake`'s JSON-Schema
 * via the `definition` "revocation_state".
 */
export interface HandshakeRevocationState {
  generated_at: number;
  min_ver: {
    [k: string]: number;
  };
  /**
   * Opcional: revogacao pontual de jti ainda vivo.
   */
  revoked_jti?: string[];
}
