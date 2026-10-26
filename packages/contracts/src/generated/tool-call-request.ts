/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/tool-call-request.schema.json

/**
 * POST /v1/tools/{tool_name}/invoke. NAO existe campo de tenant: o tenant vem da identidade do sidecar/token (EP-07); additionalProperties=false rejeita qualquer tentativa de informa-lo.
 */
export interface ToolCallRequest {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  run_id: string;
  agent_id: string;
  step_seq: number;
  idempotency_key: string;
  arguments: {};
}
