/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/ai-completion-request.schema.json

/**
 * Sem campo de tenant (derivado da identidade, EP-07). model_alias e um alias logico resolvido pelo gateway, nunca o identificador do provedor.
 */
export interface AiCompletionRequest {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  run_id: string;
  agent_id: string;
  step_seq: number;
  idempotency_key: string;
  model_alias: string;
  /**
   * @minItems 1
   * @maxItems 512
   */
  messages: [AiCompletionRequestMessage, ...AiCompletionRequestMessage[]];
  max_output_tokens?: number;
  temperature?: number;
}
/**
 * This interface was referenced by `AiCompletionRequest`'s JSON-Schema
 * via the `definition` "message".
 */
export interface AiCompletionRequestMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}
