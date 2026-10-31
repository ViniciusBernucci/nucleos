import { Controller, Get } from "@nestjs/common";
import { type HealthResponse, healthResponse } from "@nucleos/contracts";

@Controller()
export class HealthController {
  @Get("healthz")
  health(): HealthResponse {
    return healthResponse("api");
  }

  /** Sem dependencias criticas ainda (banco chega em ticket proprio); nao expoe versao. */
  @Get("readyz")
  ready(): { status: "ready"; service: string } {
    return { status: "ready", service: "api" };
  }
}
