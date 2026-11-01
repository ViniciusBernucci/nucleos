import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { VendasConfig } from "@nucleos/config";
import type { Pool } from "pg";
import { Agendador } from "./agendador.js";
import { CHAVE_SERVICO, ChaveServicoGuard } from "./chave-servico.guard.js";
import { HotmartClient } from "./hotmart-client.js";
import { ServicoPainelVendas } from "./painel.service.js";
import { REPOSITORIO_VENDAS } from "./repositorio.js";
import { RepositorioVendasPg } from "./repositorio-pg.js";
import { SINCRONIZACAO_VENDAS, SincronizacaoVendas } from "./sincronizacao.js";
import { VendasController } from "./vendas.controller.js";

const AGENDADOR_VENDAS = Symbol("AGENDADOR_VENDAS");

/** Liga o agendador na subida da API e o desliga no encerramento. */
@Injectable()
class CicloDeVidaAgendador implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(AGENDADOR_VENDAS) private readonly agendador: Agendador | undefined) {}

  onApplicationBootstrap(): void {
    this.agendador?.iniciar();
  }

  onApplicationShutdown(): void {
    this.agendador?.parar();
  }
}

export interface OpcoesModuloVendas {
  config: VendasConfig;
  pool: Pool;
  log?: (mensagem: string) => void;
}

@Module({})
export class VendasModule {
  static registrar({ config, pool, log = () => undefined }: OpcoesModuloVendas): DynamicModule {
    const repo = new RepositorioVendasPg(pool);
    const cliente =
      config.hotmart === undefined
        ? undefined
        : new HotmartClient({ env: config.hotmartEnv, credenciais: config.hotmart });
    const sincronizacao = new SincronizacaoVendas(repo, cliente, {
      backfillDias: config.backfillDays,
      // O segredo do cliente e estavel enquanto a credencial nao for rotacionada.
      chavePseudonimo: config.hotmart?.clientSecret.reveal() ?? "sem-hotmart",
      log,
    });
    const agendador =
      cliente === undefined
        ? undefined
        : new Agendador(() => sincronizacao.executar(), config.syncIntervalMs, log);
    if (cliente === undefined) log("vendas: Hotmart sem credenciais; sincronizacao desativada");

    return {
      module: VendasModule,
      controllers: [VendasController],
      providers: [
        ChaveServicoGuard,
        CicloDeVidaAgendador,
        { provide: CHAVE_SERVICO, useValue: config.apiKey },
        { provide: REPOSITORIO_VENDAS, useValue: repo },
        { provide: SINCRONIZACAO_VENDAS, useValue: sincronizacao },
        { provide: AGENDADOR_VENDAS, useValue: agendador },
        {
          provide: ServicoPainelVendas,
          useValue: new ServicoPainelVendas(
            repo,
            Math.round(config.syncIntervalMs / 60_000),
            sincronizacao.habilitada,
          ),
        },
      ],
    };
  }
}
