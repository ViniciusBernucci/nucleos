/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/problem-details.schema.json

/**
 * Corpo de erro da API (application/problem+json). Sem stack trace, SQL, segredos nem PII. additionalProperties=false: extensoes novas entram por versao do contrato.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  correlation_id?: string;
  /**
   * @maxItems 64
   */
  errors?: {
    pointer: string;
    detail: string;
  }[];
}
