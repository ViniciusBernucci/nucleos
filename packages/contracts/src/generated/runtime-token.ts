/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/runtime-token.schema.json

/**
 * JWT EdDSA (Ed25519) de vida curta emitido pelo Control Plane. Este schema valida o header e os claims decodificados; assinatura, iss/aud/exp e demais checagens semanticas (sub == runtime:<tenant_id>, exp - iat <= 600) ficam no validador (ver runtimeTokenSemanticErrors).
 */
export interface RuntimeToken {
  header: RuntimeTokenHeader;
  claims: RuntimeTokenClaims;
}
/**
 * This interface was referenced by `RuntimeToken`'s JSON-Schema
 * via the `definition` "header".
 */
export interface RuntimeTokenHeader {
  alg: "EdDSA";
  typ: "nucleos-runtime+jwt";
  kid: string;
}
/**
 * This interface was referenced by `RuntimeToken`'s JSON-Schema
 * via the `definition` "claims".
 */
export interface RuntimeTokenClaims {
  iss: "nucleos-control-plane";
  /**
   * runtime:<tenant_id>; deve ser igual a runtime: + tenant_id (checagem semantica no validador)
   */
  sub: string;
  /**
   * Uma unica audiencia por token; sem array.
   */
  aud: "dispatcher" | "tool-gateway" | "ai-gateway";
  /**
   * @minItems 1
   * @maxItems 16
   */
  scope:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
  tenant_id: string;
  jti: string;
  iat: number;
  /**
   * exp - iat <= 600 (checagem semantica: TTL maximo 10 min; padrao 300 s)
   */
  exp: number;
  /**
   * Versao da credencial do runtime; rejeitada se < ver_minima do tenant.
   */
  ver: number;
}
