import { Module, type DynamicModule, Injectable, Inject, type OnModuleInit } from "@nestjs/common";
import type { MarketingConfig, Secret } from "@nucleos/config";
import { MotorFuncionarios } from "../funcionarios/motor.js";
import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { ClienteMetaAds } from "./meta-client.js";
import { MarketingController } from "./marketing.controller.js";
import { RepositorioMarketingPg } from "./repositorio-pg.js";

const DISPONIVEL = Symbol("META_DISPONIVEL");
@Injectable()
class EstadoMeta implements OnModuleInit {
  constructor(
    @Inject(MotorFuncionarios) private readonly motor: MotorFuncionarios,
    @Inject(DISPONIVEL) private readonly disponivel: boolean,
  ) {}
  async onModuleInit(): Promise<void> {
    await this.motor.pool.query(
      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao=$1 WHERE codigo='marketing.importar_meta_ads'",
      [this.disponivel ? "DISPONIVEL" : "INDISPONIVEL"],
    );
    // Preserva PAUSADO e DESATIVADO; só promove o seed quando o executor existe.
    await this.motor.pool.query(
      `UPDATE funcionarios.funcionarios SET status=$1,atualizado_em=now() WHERE slug='gestor-trafego' AND status=$2`,
      [this.disponivel ? "ATIVO" : "RASCUNHO", this.disponivel ? "RASCUNHO" : "ATIVO"],
    );
  }
}
export function janelaMeta(agora: Date): { de: string; ate: string } {
  const ate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const inicio = new Date(`${ate}T12:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - 6);
  return { de: inicio.toISOString().slice(0, 10), ate };
}
@Module({})
export class MarketingModule {
  static registrar({
    config,
    motor,
    apiKey,
    requisitar = fetch,
    agora = () => new Date(),
    log = () => undefined,
  }: {
    config: MarketingConfig;
    motor: MotorFuncionarios;
    apiKey: Secret | undefined;
    requisitar?: typeof fetch;
    agora?: () => Date;
    log?: (s: string) => void;
  }): DynamicModule {
    const repo = new RepositorioMarketingPg(motor.pool);
    if (config.meta !== undefined) {
      const cliente = new ClienteMetaAds(config.meta, requisitar),
        contaId = config.meta.contaId;
      motor.registro.registrar({
        chave: "marketing.importar_meta_ads",
        validarConfig: (c) => Object.keys(c).length === 0,
        executar: async (ctx) => {
          ctx.signal.throwIfAborted();
          if (!(await ctx.verificarLease())) throw new Error("Meta Ads: lease perdida.");
          const { de, ate } = janelaMeta(agora());
          const dados = await cliente.importar(de, ate, ctx.signal);
          await repo.salvar(
            contaId,
            dados.campanhas,
            dados.gastos,
            async () => !ctx.signal.aborted && (await ctx.verificarLease()),
          );
          return {
            campanhas: dados.campanhas.length,
            diasImportados: dados.gastos.length,
            de,
            ate,
            moeda: "BRL",
          };
        },
      });
    } else
      log(
        "marketing: Meta Ads indisponivel; configure META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID no servidor.",
      );
    return {
      module: MarketingModule,
      controllers: [MarketingController],
      providers: [
        ChaveServicoGuard,
        EstadoMeta,
        { provide: CHAVE_SERVICO, useValue: apiKey },
        { provide: MotorFuncionarios, useValue: motor },
        { provide: DISPONIVEL, useValue: config.meta !== undefined },
        { provide: RepositorioMarketingPg, useValue: repo },
      ],
    };
  }
}
