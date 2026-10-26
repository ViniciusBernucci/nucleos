/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/job-envelope.schema.json

/**
 * Contrato do job entregue ao runtime (EP-05). O runtime recusa envelope cujo tenant_id difira do seu proprio. assignment_signature assina os campos canonicos (definicao em MSG-001).
 */
export interface JobEnvelope {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  job_id: string;
  tenant_id: string;
  type: string;
  idempotency_key: string;
  attempt: number;
  issued_at: string;
  expires_at: string;
  correlation_id: string;
  assignment_signature: JobEnvelopeAssignmentSignature;
  /**
   * Corpo especifico do tipo de job; validado pelo contrato do tipo (fora deste envelope).
   */
  payload?: {};
}
/**
 * This interface was referenced by `JobEnvelope`'s JSON-Schema
 * via the `definition` "assignment_signature".
 */
export interface JobEnvelopeAssignmentSignature {
  kid: string;
  alg: "EdDSA";
  value: string;
}
