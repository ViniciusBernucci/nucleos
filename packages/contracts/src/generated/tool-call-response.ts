/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/tool-call-response.schema.json

/**
 * Resposta do Tool Gateway. status=ok exige result; status=error|denied exige error.
 */
export type ToolCallResponse = {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  status: "ok" | "error" | "denied";
  /**
   * Qualquer JSON; presente somente quando status=ok.
   */
  result?: {
    [k: string]: unknown;
  };
  error?: ToolCallResponseError;
};

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "error".
 */
export interface ToolCallResponseError {
  code: string;
  message: string;
}
