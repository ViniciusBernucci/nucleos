import { Module, type DynamicModule } from "@nestjs/common";
import {
  loadFinanceiroConfig,
  loadVendasConfig,
  type FinanceiroConfig,
  type VendasConfig,
  type Secret,
} from "@nucleos/config";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { AlertasFinanceiros } from "./alertas.js";
import { FinanceiroController } from "./financeiro.controller.js";
import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { RotinasFinanceiras } from "./rotinas.js";
import { ReceptorHotmart, RECEPTOR_HOTMART, WebhookHotmartController } from "./webhook.js";
import { AnexosFinanceiros } from "./anexos.js";
@Module({})
export class FinanceiroModule {
  static registrar(
    motor: MotorFuncionarios,
    apiKey: Secret | undefined,
    config: FinanceiroConfig = loadFinanceiroConfig(),
    vendas: VendasConfig = loadVendasConfig(),
  ): DynamicModule {
    const alertas = new AlertasFinanceiros(motor.pool, motor);
    const repo = new RepositorioFinanceiroPg(motor.pool, motor, alertas);
    const rotinas = new RotinasFinanceiras(repo, vendas);
    return {
      module: FinanceiroModule,
      controllers: [FinanceiroController, WebhookHotmartController],
      providers: [
        ChaveServicoGuard,
        { provide: CHAVE_SERVICO, useValue: apiKey },
        { provide: AlertasFinanceiros, useValue: alertas },
        { provide: RepositorioFinanceiroPg, useValue: repo },
        { provide: RotinasFinanceiras, useValue: rotinas },
        {
          provide: RECEPTOR_HOTMART,
          useValue: new ReceptorHotmart(motor.pool, motor, config.webhookHottok),
        },
        { provide: AnexosFinanceiros, useValue: new AnexosFinanceiros(motor.pool, config.anexos) },
      ],
    };
  }
}
