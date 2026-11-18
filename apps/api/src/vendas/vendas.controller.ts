import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { EstadoSincronizacao, ListaVendas, PainelVendas } from "@nucleos/contracts";
import { ChaveServicoGuard } from "./chave-servico.guard.js";
import { ServicoPainelVendas } from "./painel.service.js";
import { resolverPeriodo } from "./periodo.js";
import { REPOSITORIO_VENDAS, type RepositorioVendas } from "./repositorio.js";
import {
  SINCRONIZACAO_VENDAS,
  type SincronizacaoVendas,
  type ResultadoSincronizacao,
} from "./sincronizacao.js";

type Consulta = Record<string, unknown>;

/** Aceita so texto simples e curto; qualquer outra forma (array, objeto) e parametro invalido. */
function textoOpcional(q: Consulta, nome: string, padrao: RegExp): string | undefined {
  const v = q[nome];
  if (v === undefined || v === "") return undefined;
  if (typeof v !== "string" || v.length > 64 || !padrao.test(v)) {
    throw new BadRequestException(`parametro invalido: ${nome}`);
  }
  return v;
}

function inteiroOpcional(
  q: Consulta,
  nome: string,
  min: number,
  max: number,
  padrao: number,
): number {
  const v = textoOpcional(q, nome, /^\d{1,7}$/);
  if (v === undefined) return padrao;
  const n = Number(v);
  if (n < min || n > max) throw new BadRequestException(`parametro invalido: ${nome}`);
  return n;
}

@Controller("v1/vendas")
@UseGuards(ChaveServicoGuard)
export class VendasController {
  constructor(
    @Inject(ServicoPainelVendas) private readonly painel: ServicoPainelVendas,
    @Inject(REPOSITORIO_VENDAS) private readonly repo: RepositorioVendas,
    @Inject(SINCRONIZACAO_VENDAS)
    private readonly sincronizacao: Pick<SincronizacaoVendas, "executar">,
  ) {}

  #filtro(q: Consulta) {
    const de = textoOpcional(q, "de", /^\d{4}-\d{2}-\d{2}$/);
    const ate = textoOpcional(q, "ate", /^\d{4}-\d{2}-\d{2}$/);
    const periodo = resolverPeriodo(de, ate, new Date());
    if (!periodo.ok) throw new BadRequestException(`periodo invalido: ${periodo.erro}`);
    return {
      periodo: periodo.periodo,
      moeda: textoOpcional(q, "moeda", /^[A-Z]{3}$/),
      produtoId: textoOpcional(q, "produto", /^[\w.-]{1,64}$/),
    };
  }

  @Get("painel")
  obterPainel(@Query() q: Consulta): Promise<PainelVendas> {
    const f = this.#filtro(q);
    return this.painel.painel(f.periodo, f.moeda, f.produtoId);
  }

  @Get()
  async listar(@Query() q: Consulta): Promise<ListaVendas> {
    const f = this.#filtro(q);
    const limite = inteiroOpcional(q, "limite", 1, 100, 25);
    const deslocamento = inteiroOpcional(q, "deslocamento", 0, 1_000_000, 0);
    const moeda = f.moeda ?? (await this.repo.moedasDisponiveis())[0] ?? "BRL";
    const { itens, total } = await this.repo.listar(
      { ...f.periodo, moeda, ...(f.produtoId === undefined ? {} : { produtoId: f.produtoId }) },
      limite,
      deslocamento,
    );
    return { itens, total, limite, deslocamento };
  }

  @Get("sincronizacao")
  estado(): Promise<EstadoSincronizacao> {
    return this.painel.estadoSincronizacao();
  }

  /** Dispara uma rodada agora (sem esperar os 30 min). Responde 202 e roda em segundo plano. */
  @Post("sincronizacao")
  @HttpCode(202)
  async sincronizarAgora(): Promise<EstadoSincronizacao> {
    void this.sincronizacao.executar().catch(() => undefined);
    return this.painel.estadoSincronizacao();
  }

  /** O botao do painel aguarda o resultado real antes de recarregar os indicadores. */
  @Post("sincronizacao/atualizar")
  @HttpCode(200)
  atualizarPainel(): Promise<ResultadoSincronizacao> {
    return this.sincronizacao.executar();
  }
}
