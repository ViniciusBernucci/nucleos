import type {
  Categoria,
  ContaRecorrente,
  FluxoCaixaMes,
  Lancamento,
  NovaCategoria,
  NovaContaRecorrente,
  NovoLancamento,
  NovoPagamentoConta,
  TipoLancamento,
} from "@nucleos/contracts";
import { hojeNoFuso } from "../vendas/periodo.js";
import { mesAtual, primeiroDia, ultimoDia } from "./calendario.js";
import { contaVigente, montarFluxo, venceNoMes } from "./dominio.js";
import type { RepositorioFluxoCaixa } from "./repositorio.js";

/** Falha de regra de negocio com mensagem fixa (sem eco de dados enviados). */
export class RegraFluxoCaixa extends Error {
  constructor(
    readonly tipo: "nao-encontrado" | "conflito" | "invalido",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export class ServicoFluxoCaixa {
  constructor(
    private readonly repo: RepositorioFluxoCaixa,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  mesCorrente(): string {
    return mesAtual(this.agora());
  }

  async mes(mes: string): Promise<FluxoCaixaMes> {
    const [saldoInicialCentavos, lancamentosDoMes, pagamentosDaCompetencia, contas, categorias] =
      await Promise.all([
        this.repo.saldoAntesDe(primeiroDia(mes)),
        this.repo.lancamentosEntre(primeiroDia(mes), ultimoDia(mes)),
        this.repo.pagamentosDaCompetencia(mes),
        this.repo.listarContas(),
        this.repo.listarCategorias(),
      ]);
    return montarFluxo({
      mes,
      hoje: hojeNoFuso(this.agora()),
      saldoInicialCentavos,
      lancamentosDoMes,
      pagamentosDaCompetencia,
      contas,
      categorias,
    });
  }

  /** Exige categoria cadastrada do tipo e devolve o nome com a grafia do cadastro. */
  async #categoria(tipo: TipoLancamento, nome: string): Promise<string> {
    const cadastrada = await this.repo.nomeDaCategoria(tipo, nome);
    if (cadastrada === null) {
      throw new RegraFluxoCaixa("invalido", "categoria nao cadastrada para esse tipo");
    }
    return cadastrada;
  }

  async criarLancamento(novo: NovoLancamento): Promise<Lancamento> {
    const categoria = await this.#categoria(novo.tipo, novo.categoria);
    return this.repo.inserirLancamento({ ...novo, categoria });
  }

  criarCategoria(nova: NovaCategoria): Promise<Categoria> {
    return this.repo.inserirCategoria(nova);
  }

  async excluirCategoria(id: string): Promise<void> {
    if (!(await this.repo.excluirCategoria(id))) {
      throw new RegraFluxoCaixa("nao-encontrado", "categoria nao encontrada");
    }
  }

  async excluirLancamento(id: string): Promise<void> {
    if (!(await this.repo.excluirLancamento(id))) {
      throw new RegraFluxoCaixa("nao-encontrado", "lancamento nao encontrado");
    }
  }

  async criarConta(nova: NovaContaRecorrente): Promise<ContaRecorrente> {
    // Conta a pagar e sempre saida: so aceita categorias de saida.
    const categoria = await this.#categoria("saida", nova.categoria);
    const conta = await this.repo.inserirConta({ ...nova, categoria });
    return { ...conta, vigente: contaVigente(conta, this.mesCorrente()) };
  }

  async #conta(id: string) {
    const conta = await this.repo.obterConta(id);
    if (conta === null) throw new RegraFluxoCaixa("nao-encontrado", "conta nao encontrada");
    return conta;
  }

  /** Registra o pagamento da competencia como uma saida vinculada a conta. */
  async pagarConta(id: string, p: NovoPagamentoConta): Promise<Lancamento> {
    const conta = await this.#conta(id);
    if (!venceNoMes(conta, p.competencia)) {
      throw new RegraFluxoCaixa("invalido", "a conta nao vence na competencia informada");
    }
    return this.repo.inserirLancamento({
      tipo: "saida",
      descricao: conta.descricao,
      categoria: conta.categoria,
      valorCentavos: p.valorCentavos,
      data: p.data,
      contaRecorrenteId: conta.id,
      competencia: p.competencia,
    });
  }

  /**
   * Encerra a conta: `ultimoMes` (padrao: mes corrente, ou o inicio se for posterior) passa a ser
   * o ultimo vencimento. Nao pode deixar de fora um mes ja pago.
   */
  async encerrarConta(id: string, ultimoMes: string | undefined): Promise<void> {
    const conta = await this.#conta(id);
    const corrente = this.mesCorrente();
    const fim = ultimoMes ?? (corrente < conta.inicio ? conta.inicio : corrente);
    if (fim < conta.inicio) {
      throw new RegraFluxoCaixa("invalido", "o ultimo mes deve ser igual ou posterior ao inicio");
    }
    const pago = await this.repo.ultimaCompetenciaPaga(id);
    if (pago !== null && fim < pago) {
      throw new RegraFluxoCaixa("conflito", "ha pagamento registrado depois do ultimo mes");
    }
    await this.repo.definirFimConta(id, fim);
  }

  async reativarConta(id: string): Promise<void> {
    await this.#conta(id);
    await this.repo.definirFimConta(id, null);
  }

  async excluirConta(id: string): Promise<void> {
    if (!(await this.repo.excluirConta(id))) {
      throw new RegraFluxoCaixa("nao-encontrado", "conta nao encontrada");
    }
  }
}
