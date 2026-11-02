import { type DynamicModule, Module } from "@nestjs/common";
import type { VendasConfig } from "@nucleos/config";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { CHAVE_SERVICO, ChaveServicoGuard } from "./chave-servico.guard.js";
import { HotmartClient } from "./hotmart-client.js";
import { ServicoPainelVendas } from "./painel.service.js";
import { REPOSITORIO_VENDAS } from "./repositorio.js";
import { RepositorioVendasPg } from "./repositorio-pg.js";
import {
  SINCRONIZACAO_VENDAS,
  SincronizacaoVendas,
  type ResultadoSincronizacao,
} from "./sincronizacao.js";
import { VendasController } from "./vendas.controller.js";

export interface OpcoesModuloVendas {
  config: VendasConfig;
  pool: Pool;
  log?: (mensagem: string) => void;
  motor?: MotorFuncionarios;
}

@Module({})
export class VendasModule {
  static registrar({
    config,
    pool,
    log = () => undefined,
    motor,
  }: OpcoesModuloVendas): DynamicModule {
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
    if (motor !== undefined && cliente !== undefined) {
      motor.registro.registrar({
        chave: "financeiro.atualizar_dados",
        validarConfig: (c) => Object.keys(c).length === 0,
        executar: async (ctx) => {
          ctx.signal.throwIfAborted();
          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
          return sincronizacao.executar();
        },
      });
    }
    const disparo =
      motor === undefined
        ? sincronizacao
        : {
            executar: async () => {
              if (cliente === undefined) return { resultado: "desabilitada" as const };
              const { rows } = await pool.query<{
                id: string;
              }>(`SELECT a.id FROM funcionarios.atribuicoes a
          JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
          WHERE d.codigo='financeiro.atualizar_dados' AND a.habilitada ORDER BY a.id LIMIT 1`);
              const atribuicao = rows[0];
              if (atribuicao === undefined) return { resultado: "desabilitada" as const };
              const id = await motor.executarAgora(atribuicao.id);
              // Mesmo consumidor/lease do disparo automático; preserva o contrato síncrono do botão.
              void motor.consumirUma().catch(() => undefined);
              const execucao = await motor.aguardar(id);
              return execucao.resumo === null
                ? { resultado: "falha" as const, processadas: 0, mensagem: "A execucao falhou." }
                : (execucao.resumo as ResultadoSincronizacao);
            },
          };
    if (cliente === undefined) log("vendas: Hotmart sem credenciais; sincronizacao desativada");

    return {
      module: VendasModule,
      controllers: [VendasController],
      providers: [
        ChaveServicoGuard,
        { provide: CHAVE_SERVICO, useValue: config.apiKey },
        { provide: REPOSITORIO_VENDAS, useValue: repo },
        { provide: SINCRONIZACAO_VENDAS, useValue: disparo },
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
