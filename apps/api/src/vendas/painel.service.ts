import type { EstadoSincronizacao, PainelVendas, PeriodoVendas } from "@nucleos/contracts";
import { periodoAnterior, preencherSerie } from "./periodo.js";
import type { RepositorioVendas } from "./repositorio.js";

export class ServicoPainelVendas {
  constructor(
    private readonly repo: RepositorioVendas,
    private readonly intervaloMinutos: number,
    private readonly sincronizacaoHabilitada: boolean,
  ) {}

  async estadoSincronizacao(): Promise<EstadoSincronizacao> {
    const e = await this.repo.lerEstadoSincronizacao();
    return {
      habilitada: this.sincronizacaoHabilitada,
      intervaloMinutos: this.intervaloMinutos,
      status: e.status,
      ultimaTentativaEm: e.ultimaTentativaEm?.toISOString() ?? null,
      ultimoSucessoEm: e.ultimoSucessoEm?.toISOString() ?? null,
      ultimasVendasProcessadas: e.vendasProcessadas,
      mensagem: e.mensagem,
    };
  }

  async painel(
    periodo: PeriodoVendas,
    moedaPedida: string | undefined,
    produtoId: string | undefined,
  ): Promise<PainelVendas> {
    const [moedasDisponiveis, produtos, sincronizacao] = await Promise.all([
      this.repo.moedasDisponiveis(),
      this.repo.produtosDisponiveis(),
      this.estadoSincronizacao(),
    ]);
    const moeda = moedaPedida ?? moedasDisponiveis[0] ?? "BRL";
    const base = { moeda, ...(produtoId === undefined ? {} : { produtoId }) };
    const [atual, anterior] = await Promise.all([
      this.repo.agregados({ ...periodo, ...base }),
      this.repo.indicadores({ ...periodoAnterior(periodo), ...base }),
    ]);
    return {
      periodo,
      moeda,
      moedasDisponiveis,
      produtos,
      indicadores: atual.indicadores,
      indicadoresAnteriores: anterior,
      serieDiaria: preencherSerie(periodo, atual.serieDiaria),
      porProduto: atual.porProduto,
      porStatus: atual.porStatus,
      porPagamento: atual.porPagamento,
      sincronizacao,
    };
  }
}
