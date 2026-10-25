import { Controller, Get } from "@nestjs/common";
import { type HealthResponse, healthResponse } from "@nucleos/contracts";

@Controller()
export class HealthController {
  @Get("healthz")
  health(): HealthResponse {
    return healthResponse("api");
  }
}
