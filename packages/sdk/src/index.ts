import { HEALTH_PATH, validate, type ProblemDetails } from "@nucleos/contracts";
import type { paths } from "./generated/control-plane.js";

/** Corpo 200 de GET /healthz, tipado a partir do OpenAPI (packages/contracts/openapi). */
export type HealthResponse =
  paths["/healthz"]["get"]["responses"][200]["content"]["application/json"];

/** Erro de uma chamada ao Control Plane; `problem` presente quando o corpo era um ProblemDetails valido. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function lerProblema(res: Response): Promise<ProblemDetails | undefined> {
  try {
    const corpo: unknown = await res.json();
    return validate("problem-details", corpo).valid ? (corpo as ProblemDetails) : undefined;
  } catch {
    return undefined;
  }
}

/** Cliente tipado do Control Plane. Cada metodo corresponde a uma operacao do OpenAPI. */
export function createControlPlaneClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  return {
    async getHealth(): Promise<HealthResponse> {
      const res = await fetchImpl(new URL(HEALTH_PATH, baseUrl));
      if (!res.ok) {
        const problem = await lerProblema(res);
        throw new ApiError(
          problem?.title ?? `healthz falhou: HTTP ${String(res.status)}`,
          res.status,
          problem,
        );
      }
      const corpo = (await res.json()) as Partial<HealthResponse>;
      if (corpo.status !== "ok" || typeof corpo.service !== "string" || corpo.service === "") {
        throw new ApiError("healthz: resposta fora do contrato", res.status);
      }
      return { status: corpo.status, service: corpo.service };
    },
  };
}

/** Cliente minimo: consulta /healthz de um componente. Sem logica de negocio. */
export async function checkHealth(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResponse> {
  return createControlPlaneClient(baseUrl, fetchImpl).getHealth();
}
