/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/subscription-event.schema.json

/**
 * Evento normalizado de assinatura emitido pelo adaptador do provedor (ou pelo simulador) ao Control Plane. Nao carrega dados de cartao nem PII; o payload bruto fica fora, referenciado por raw_payload_ref.
 */
export type SubscriptionEvent = {
  schema_version: "1.0";
  provider: "simulator" | "stripe" | "asaas" | "mercadopago";
  /**
   * Chave de idempotencia junto com provider. Unique (provider, provider_event_id).
   */
  provider_event_id: string;
  event_type:
    | "subscription.created"
    | "subscription.activated"
    | "subscription.past_due"
    | "subscription.suspended_by_provider"
    | "subscription.resumed"
    | "subscription.plan_changed"
    | "subscription.canceled"
    | "payment.succeeded"
    | "payment.failed"
    | "payment.action_required"
    | "payment.refunded"
    | "payment.disputed";
  /**
   * Informativo. NAO define ordem de aplicacao (ordem de entrega nao e garantida).
   */
  occurred_at: string;
  received_at: string;
  simulated: boolean;
  subscription: {
    provider_subscription_id: string;
    provider_customer_id?: string;
    /**
     * Presente quando o vinculo ja existe no Control Plane; senao o CP resolve por provider_subscription_id.
     */
    tenant_id?: string;
    plan_code?: string;
    /**
     * Status bruto informado pelo provedor, so para auditoria.
     */
    provider_status?: string;
    current_period_end?: string;
  };
  payment?: {
    provider_invoice_id?: string;
    amount_minor: number;
    currency: string;
    failure_code?: string;
    attempt_count?: number;
    next_retry_at?: string;
  };
  /**
   * Referencia (chave/URI interna) ao payload bruto guardado fora do evento.
   */
  raw_payload_ref?: string;
};
