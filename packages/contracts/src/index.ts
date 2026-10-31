/** Contrato minimo do endpoint de saude de todo componente (hello-world de FND-001). */
export const HEALTH_PATH = "/healthz";

export interface HealthResponse {
  status: "ok";
  service: string;
}

export function healthResponse(service: string): HealthResponse {
  return { status: "ok", service };
}

export * from "./generated/index.js";
export { isRfc3339DateTime } from "./datetime.js";
export {
  RUNTIME_TOKEN_MAX_TTL_S,
  runtimeTokenSemanticErrors,
  type RuntimeTokenSemanticError,
} from "./runtime-token.js";
export {
  ContractViolationError,
  assertValid,
  validate,
  type ValidationIssue,
  type ValidationResult,
} from "./validators.js";
