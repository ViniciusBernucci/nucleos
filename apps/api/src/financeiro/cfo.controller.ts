import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Inject,
  Injectable,
  UseGuards,
  UnauthorizedException,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { CfoConfig } from "@nucleos/config";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { CfoFinanceiro } from "./cfo.js";
import { CorpoFinanceiroPipe } from "./corpo.pipe.js";
import { filtroGestao } from "./gestao.js";
export const CONFIG_CFO = Symbol("CONFIG_CFO");
@Injectable()
export class LeituraCfoGuard implements CanActivate {
  constructor(@Inject(CONFIG_CFO) readonly config: CfoConfig) {}
  canActivate(ctx: ExecutionContext) {
    const chave = this.config.leitura;
    if (!chave) throw new ServiceUnavailableException();
    const req = ctx.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const recebido = req.headers.authorization ?? "",
      esperado = "Bearer " + chave.reveal();
    const hash = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(recebido), hash(esperado))) throw new UnauthorizedException();
    return true;
  }
}
@Controller("v1/financeiro/cfo/ferramentas")
@UseGuards(LeituraCfoGuard)
export class FerramentasCfoController {
  constructor(@Inject(CfoFinanceiro) readonly cfo: CfoFinanceiro) {}
  @Get(":nome") consultar(@Param("nome") nome: string, @Query() f: Record<string, unknown>) {
    return this.cfo.ferramenta(nome, f);
  }
}
@Controller("v1/financeiro")
@UseGuards(ChaveServicoGuard)
export class CfoController {
  constructor(@Inject(CfoFinanceiro) readonly cfo: CfoFinanceiro) {}
  @Get("rentabilidade") rentabilidade(@Query() f: Record<string, unknown>) {
    return this.cfo.marketing.consultar(filtroGestao(f));
  }
  @Post("rentabilidade/avaliar") avaliar(
    @Body(new CorpoFinanceiroPipe()) f: Record<string, unknown>,
  ) {
    const limite = f["limiteRoas"] === undefined ? 1 : Number(f["limiteRoas"]);
    if (!Number.isFinite(limite) || limite < 0 || limite > 100) throw new BadRequestException();
    return this.cfo.marketing.alertar(filtroGestao(f), limite);
  }
  @Get("cfo") async historico() {
    return { disponivel: this.cfo.disponivel, analises: await this.cfo.historico() };
  }
  @Post("cfo/perguntar") perguntar(@Body(new CorpoFinanceiroPipe()) f: Record<string, unknown>) {
    return this.cfo.perguntar(f);
  }
}
