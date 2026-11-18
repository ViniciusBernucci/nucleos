import { Controller, Get, Inject, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { RepositorioMarketingPg } from "./repositorio-pg.js";
import { resolverPeriodo } from "../vendas/periodo.js";

@Controller("v1/marketing")
@UseGuards(ChaveServicoGuard)
export class MarketingController {
  constructor(@Inject(RepositorioMarketingPg) private readonly repo: RepositorioMarketingPg) {}
  @Get("campanhas") campanhas() {
    return this.repo.campanhas();
  }
  @Get("gastos") gastos(@Query() q: Record<string, unknown>) {
    if (typeof q["de"] !== "string" || typeof q["ate"] !== "string")
      throw new BadRequestException("informe de e ate");
    const p = resolverPeriodo(q["de"], q["ate"], new Date());
    if (!p.ok) throw new BadRequestException("periodo invalido");
    return this.repo.gastos(q["de"], q["ate"]);
  }
}
