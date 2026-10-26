/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/realtime-event.schema.json

/**
 * Payload minimo e sem conteudo privado (IDs, estados, rotulos); detalhes sao buscados por API autorizada (EP-05).
 */
export interface RealtimeEvent {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  event_id: string;
  type:
    | "agent.status_changed"
    | "run.started"
    | "run.progress"
    | "run.waiting_approval"
    | "run.completed"
    | "run.failed"
    | "approval.requested"
    | "approval.decided"
    | "tenant.state_changed"
    | "budget.threshold_reached";
  occurred_at: string;
  tenant_id: string;
  subject: {
    kind: "agent" | "run" | "approval" | "tenant" | "budget";
    id: string;
  };
  state?: string;
  /**
   * Apenas escalares curtos; nada de texto livre longo nem conteudo de usuario.
   */
  data?: {
    [k: string]: string | number | boolean;
  };
}
