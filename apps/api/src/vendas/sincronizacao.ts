import { STATUS_HOTMART } from "./dominio.js";
import { type HotmartClient, HotmartError } from "./hotmart-client.js";
import type { RepositorioVendas } from "./repositorio.js";

export const SINCRONIZACAO_VENDAS = Symbol("SINCRONIZACAO_VENDAS");

const DIA_MS = 86_400_000;
/** Cada execucao reconsulta os ultimos 2 dias alem do ultimo sucesso (mudancas de status recentes). */
const SOBREPOSICAO_MS = 2 * DIA_MS;
/** Uma vez por dia reconsulta 30 dias para capturar reembolsos e chargebacks tardios. */
const JANELA_RECONCILIACAO_MS = 30 * DIA_MS;
const INTERVALO_RECONCILIACAO_MS = DIA_MS;

export type ResultadoSincronizacao =
  | { resultado: "desabilitada" }
  | { resultado: "ocupada" }
  | { resultado: "sucesso" | "parcial" | "falha"; processadas: number; mensagem: string | null };

export interface OpcoesSincronizacao {
  backfillDias: number;
  agora?: () => Date;
  /** Chave do pseudonimo do comprador (HMAC). */
  chavePseudonimo: string;
  log?: (mensagem: string) => void;
}

export class SincronizacaoVendas {
  readonly #agora: () => Date;

  constructor(
    private readonly repo: RepositorioVendas,
    private readonly cliente: HotmartClient | undefined,
    private readonly opcoes: OpcoesSincronizacao,
  ) {
    this.#agora = opcoes.agora ?? (() => new Date());
  }

  get habilitada(): boolean {
    return this.cliente !== undefined;
  }

  /** Executa uma rodada. Nunca lanca por falha da Hotmart: o resultado vai para o estado salvo. */
  async executar(): Promise<ResultadoSincronizacao> {
    const cliente = this.cliente;
    if (cliente === undefined) return { resultado: "desabilitada" };

    const bloqueio = await this.repo.comLockDeSincronizacao(() => this.#rodada(cliente));
    return bloqueio.ocupado ? { resultado: "ocupada" } : bloqueio.valor;
  }

  async #rodada(cliente: HotmartClient): Promise<ResultadoSincronizacao> {
    const inicio = this.#agora();
    const estado = await this.repo.lerEstadoSincronizacao();
    const reconciliar =
      estado.ultimaReconciliacaoEm === null ||
      inicio.getTime() - estado.ultimaReconciliacaoEm.getTime() >= INTERVALO_RECONCILIACAO_MS;

    let de: Date;
    if (estado.ultimoSucessoEm === null)
      de = new Date(inicio.getTime() - this.opcoes.backfillDias * DIA_MS);
    else if (reconciliar) de = new Date(inicio.getTime() - JANELA_RECONCILIACAO_MS);
    else de = new Date(estado.ultimoSucessoEm.getTime() - SOBREPOSICAO_MS);

    await this.repo.salvarEstadoSincronizacao({
      status: "em_andamento",
      ultimaTentativaEm: inicio,
    });

    let processadas = 0;
    const falhas: string[] = [];
    for (const status of STATUS_HOTMART) {
      try {
        await cliente.listarVendas(
          { de, ate: inicio },
          status,
          this.opcoes.chavePseudonimo,
          async (vendas) => {
            processadas += await this.repo.gravarVendas(vendas);
          },
        );
      } catch (e) {
        const motivo = e instanceof HotmartError ? e.message : "hotmart: erro inesperado";
        falhas.push(motivo);
        // Credencial invalida falha todas as consultas: nao adianta repetir 15 vezes.
        if (e instanceof HotmartError && e.codigo === "autenticacao") break;
      }
    }

    const mensagem = falhas.length === 0 ? null : resumirFalhas(falhas);
    const resultado = falhas.length === 0 ? "sucesso" : processadas > 0 ? "parcial" : "falha";
    await this.repo.salvarEstadoSincronizacao({
      status: resultado,
      vendasProcessadas: processadas,
      mensagem,
      ...(resultado === "sucesso"
        ? {
            ultimoSucessoEm: inicio,
            ...(reconciliar ? { ultimaReconciliacaoEm: inicio } : {}),
          }
        : {}),
    });
    this.opcoes.log?.(`vendas: sincronizacao ${resultado} (${String(processadas)} registros)`);
    return { resultado, processadas, mensagem };
  }
}

/** Mensagem curta e deduplicada, com so os codigos fixos do cliente (sem corpo de resposta). */
function resumirFalhas(falhas: readonly string[]): string {
  const unicas = [...new Set(falhas)];
  return `${String(falhas.length)} consulta(s) falharam: ${unicas.slice(0, 3).join("; ")}`;
}
