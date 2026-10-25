import { HEALTH_PATH, type HealthResponse } from "@nucleos/contracts";

/** Cliente minimo: consulta /healthz de um componente. Sem logica de negocio. */
export async function checkHealth(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResponse> {
  const res = await fetchImpl(new URL(HEALTH_PATH, baseUrl));
  if (!res.ok) {
    throw new Error(`healthz falhou: HTTP ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}
