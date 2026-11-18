import { type DynamicModule, Module } from "@nestjs/common";
import type { Secret } from "@nucleos/config";
import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { FluxoCaixaController } from "./fluxo-caixa.controller.js";
import { ServicoFluxoCaixa } from "./fluxo-caixa.service.js";
import type { RepositorioFluxoCaixa } from "./repositorio.js";

export interface OpcoesModuloFluxoCaixa {
  /** Mesma chave de servico do painel de vendas (provisoria ate o login real/IAM). */
  apiKey: Secret | undefined;
  repositorio: RepositorioFluxoCaixa;
  agora?: () => Date;
}

@Module({})
export class FluxoCaixaModule {
  static registrar({ apiKey, repositorio, agora }: OpcoesModuloFluxoCaixa): DynamicModule {
    return {
      module: FluxoCaixaModule,
      controllers: [FluxoCaixaController],
      providers: [
        ChaveServicoGuard,
        { provide: CHAVE_SERVICO, useValue: apiKey },
        { provide: ServicoFluxoCaixa, useValue: new ServicoFluxoCaixa(repositorio, agora) },
      ],
    };
  }
}
