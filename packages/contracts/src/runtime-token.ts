import type { RuntimeTokenClaims } from "./generated/index.js";

/** TTL maximo do token de servico do runtime, em segundos (ADR-018). */
export const RUNTIME_TOKEN_MAX_TTL_S = 600;

export type RuntimeTokenSemanticError = "sub_tenant_mismatch" | "ttl_too_long" | "ttl_not_positive";

/**
 * Regras do ADR-018 que o JSON Schema nao expressa (campos cruzados). Mesmos codigos do validador
 * do PoC DEC-004 e da versao Python (`runtime_token_semantic_errors`); a assinatura, iss, aud e
 * relogio continuam responsabilidade do validador de cada servico.
 */
export function runtimeTokenSemanticErrors(c: RuntimeTokenClaims): RuntimeTokenSemanticError[] {
  const erros: RuntimeTokenSemanticError[] = [];
  if (c.sub !== `runtime:${c.tenant_id}`) erros.push("sub_tenant_mismatch");
  if (c.exp <= c.iat) erros.push("ttl_not_positive");
  else if (c.exp - c.iat > RUNTIME_TOKEN_MAX_TTL_S) erros.push("ttl_too_long");
  return erros;
}
