/** Contrato minimo do endpoint de saude de todo componente (hello-world de FND-001). */
export const HEALTH_PATH = "/healthz";

export interface HealthResponse {
  status: "ok";
  service: string;
}

export function healthResponse(service: string): HealthResponse {
  return { status: "ok", service };
}
