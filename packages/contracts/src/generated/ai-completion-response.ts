/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/ai-completion-response.schema.json

/**
 * status=ok exige content, finish_reason e usage; status=error exige error.
 */
export type AiCompletionResponse = {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  status: "ok" | "error";
  model_alias?: string;
  content?: string;
  finish_reason?: "stop" | "length" | "tool_calls" | "content_filter";
  usage?: AiCompletionResponseUsage;
  error?: AiCompletionResponseError;
};

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "usage".
 */
export interface AiCompletionResponseUsage {
  input_tokens: number;
  output_tokens: number;
  /**
   * Custo em micro-unidades da moeda de faturamento (inteiro: sem ponto flutuante).
   */
  cost_micros: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "error".
 */
export interface AiCompletionResponseError {
  code: string;
  message: string;
}
