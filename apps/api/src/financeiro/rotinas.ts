import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { VendasConfig } from "@nucleos/config";
import type { ContextoHandler } from "../funcionarios/handlers.js";
import { HotmartClient } from "../vendas/hotmart-client.js";
import { STATUS_HOTMART, type Venda } from "../vendas/dominio.js";
import { RepositorioVendasPg } from "../vendas/repositorio-pg.js";
import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { ConciliacaoFinanceira } from "./conciliacao.js";
import { dia } from "./importacao.js";
const DIA = 86400000;
export class RotinasFinanceiras {
  readonly cliente: HotmartClient | undefined;
  constructor(
    readonly repo: RepositorioFinanceiroPg,
    readonly config: VendasConfig,
  ) {
    this.cliente = config.hotmart
      ? new HotmartClient({ env: config.hotmartEnv, credenciais: config.hotmart })
      : undefined;
    const jobs = {
      "financeiro.gerar_recorrencias": async (
        c: Parameters<RepositorioFinanceiroPg["gerarRecorrencias"]>[0],
      ) => ({ geradas: await repo.gerarRecorrencias(c) }),
      "financeiro.verificar_vencimentos": async (
        c: Parameters<RepositorioFinanceiroPg["vencimentos"]>[0],
      ) => {
        await repo.vencimentos(c);
        return {};
      },
      "financeiro.atualizar_previsoes": async (
        c: Parameters<RepositorioFinanceiroPg["previsoes"]>[0],
      ) => {
        await repo.previsoes(c);
        return {};
      },
      "financeiro.alertar_recebimentos": async (
        c: Parameters<RepositorioFinanceiroPg["atrasados"]>[0],
      ) => {
        await repo.atrasados(c);
        return {};
      },
      "financeiro.conciliar_vendas": async (
        c: Parameters<ConciliacaoFinanceira["sugerir"]>[0],
      ) => ({ sugestoes: await new ConciliacaoFinanceira(repo).sugerir(c) }),
    };
    for (const [chave, executar] of Object.entries(jobs))
      repo.motor.registro.registrar({
        chave,
        validarConfig: (c) => Object.keys(c).length === 0,
        executar: async (ctx) => {
          this.exigirLease(ctx);
          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
          return repo.transacao(async (c) => {
            const resultado = await executar(c);
            this.exigirLease(ctx);
            return resultado;
          });
        },
      });
    if (this.cliente) {
      repo.motor.registro.registrar({
        chave: "financeiro.reconciliar_hotmart",
        validarConfig: (c) => {
          try {
            this.janela(c);
            return Object.keys(c).every((k) => ["inicio", "fim"].includes(k));
          } catch {
            return false;
          }
        },
        executar: (ctx) => this.reconciliar(ctx),
      });
      repo.motor.registro.registrar({
        chave: "financeiro.processar_evento_hotmart",
        validarConfig: (c) => Object.keys(c).length === 0,
        executar: (ctx) => this.processarWebhook(ctx),
      });
    }
  }
  exigirLease(ctx: ContextoHandler): void {
    ctx.signal.throwIfAborted();
  }
  janela(config: Record<string, unknown>): { de: Date; ate: Date } {
    const hoje = new Date(),
      de = config["inicio"]
        ? new Date(dia(config["inicio"]) + "T00:00:00-03:00")
        : new Date(hoje.getTime() - 30 * DIA),
      ate = config["fim"] ? new Date(dia(config["fim"]) + "T23:59:59.999-03:00") : hoje;
    if (ate < de || ate.getTime() - de.getTime() > 366 * DIA || ate > hoje)
      throw new BadRequestException("periodo invalido (maximo 366 dias, ate hoje)");
    return { de, ate };
  }
  async reconciliar(ctx: ContextoHandler): Promise<unknown> {
    const cliente = this.cliente;
    if (!cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
    const janela = this.janela(ctx.config);
    const local = await this.repo.pool.query<{
      status: string;
      moeda: string;
      q: string;
      s: string;
    }>(
      "SELECT status,moeda,count(*)::text q,sum(valor_centavos)::text s FROM financeiro.vendas WHERE pedido_em BETWEEN $1 AND $2 GROUP BY status,moeda",
      [janela.de, janela.ate],
    );
    const esperado = new Map(
      local.rows.map((v) => [v.status + ":" + v.moeda, { q: Number(v.q), s: BigInt(v.s) }]),
    );
    const remoto = new Map<string, { q: number; s: bigint }>();
    const repoVendas = new RepositorioVendasPg(this.repo.pool, this.repo.motor);
    let processadas = 0;
    for (const status of STATUS_HOTMART) {
      this.exigirLease(ctx);
      await cliente.listarVendas(
        janela,
        status,
        this.config.hotmart?.clientSecret.reveal() ?? "",
        async (pagina) => {
          const enriquecidas: Venda[] = [];
          for (const venda of pagina) {
            this.exigirLease(ctx);
            const v = await cliente.enriquecer(venda),
              k = v.status + ":" + v.moeda,
              atual = remoto.get(k) ?? { q: 0, s: 0n };
            atual.q++;
            atual.s += BigInt(v.valorCentavos);
            remoto.set(k, atual);
            enriquecidas.push(v);
          }
          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
          processadas += await repoVendas.gravarVendas(enriquecidas, "reconciliacao");
        },
      );
    }
    const serializar = (m: Map<string, { q: number; s: bigint }>) =>
      [...m]
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([k, v]) => k + ":" + String(v.q) + ":" + v.s.toString())
        .join("|");
    const divergente = serializar(esperado) !== serializar(remoto);
    if (divergente)
      await this.repo.alertas.criar({
        tipo: "divergencia_hotmart",
        chave:
          "reconciliacao:" +
          janela.de.toISOString().slice(0, 10) +
          ":" +
          janela.ate.toISOString().slice(0, 10),
        referenciaTabela: "vendas",
        referenciaId: "periodo",
      });
    return { processadas, divergente };
  }
  async processarWebhook(ctx: ContextoHandler): Promise<unknown> {
    if (!this.cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
    const pendentes = await this.repo.pool.query<{ id: string; transacao: string }>(
      "SELECT id,transacao FROM financeiro.webhooks_hotmart WHERE processado_em IS NULL ORDER BY recebido_em,id LIMIT 100",
    );
    for (const ev of pendentes.rows) {
      this.exigirLease(ctx);
      const v = await this.cliente.transacao(
        ev.transacao,
        this.config.hotmart?.clientSecret.reveal() ?? "",
      );
      if (!(await ctx.verificarLease())) throw new Error("lease perdida");
      await new RepositorioVendasPg(this.repo.pool, this.repo.motor).gravarVendas([v], "webhook");
      await this.repo.pool.query(
        "UPDATE financeiro.webhooks_hotmart SET processado_em=now() WHERE id=$1",
        [ev.id],
      );
    }
    return { processados: pendentes.rowCount ?? 0 };
  }
  async importarHistorico(config: Record<string, unknown>): Promise<{ execucaoId: string }> {
    this.janela(config);
    if (!config["inicio"] || !config["fim"]) throw new BadRequestException("informe inicio e fim");
    if (!this.cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
    const r = await this.repo.pool.query<{ id: string }>(
      "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='financeiro.reconciliar_hotmart' AND a.habilitada ORDER BY a.id LIMIT 1",
    );
    if (!r.rows[0]) throw new ServiceUnavailableException("tarefa indisponivel");
    return { execucaoId: await this.repo.motor.executarAgora(r.rows[0].id, config) };
  }
}
