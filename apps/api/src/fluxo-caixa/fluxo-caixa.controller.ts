import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Categoria, ContaRecorrente, FluxoCaixaMes, Lancamento } from "@nucleos/contracts";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { mesValido } from "./calendario.js";
import { RegraFluxoCaixa, ServicoFluxoCaixa } from "./fluxo-caixa.service.js";
import {
  CategoriaDuplicada,
  ContaComLancamentos,
  LancamentoVinculado,
  PagamentoDuplicado,
} from "./repositorio.js";
import {
  type Resultado,
  idValido,
  validarEncerramento,
  validarNovaConta,
  validarNovoLancamento,
  validarNovaCategoria,
  validarPagamento,
} from "./validacao.js";

function exigir<T>(r: Resultado<T>): T {
  if (!r.ok) throw new BadRequestException(r.erro);
  return r.valor;
}

function id(valor: string): string {
  if (!idValido(valor)) throw new NotFoundException();
  return valor;
}

/** Traduz falhas de regra para HTTP com mensagens fixas; o resto vira 500 sem detalhe. */
async function http<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RegraFluxoCaixa) {
      if (e.tipo === "nao-encontrado") throw new NotFoundException(e.message);
      if (e.tipo === "conflito") throw new ConflictException(e.message);
      throw new BadRequestException(e.message);
    }
    if (e instanceof PagamentoDuplicado) {
      throw new ConflictException("a conta ja esta paga nessa competencia");
    }
    if (e instanceof LancamentoVinculado)
      throw new ConflictException(
        "lancamento vinculado a transferencia ou conciliacao aceita; desfaca a conciliacao antes de excluir",
      );
    if (e instanceof ContaComLancamentos) {
      throw new ConflictException(
        "a conta tem pagamentos registrados; encerre-a em vez de excluir",
      );
    }
    if (e instanceof CategoriaDuplicada) {
      throw new ConflictException("ja existe categoria com esse nome para esse tipo");
    }
    throw e;
  }
}

@Controller("v1/fluxo-caixa")
@UseGuards(ChaveServicoGuard)
export class FluxoCaixaController {
  constructor(@Inject(ServicoFluxoCaixa) private readonly servico: ServicoFluxoCaixa) {}

  @Get()
  obterMes(@Query() q: Record<string, unknown>): Promise<FluxoCaixaMes> {
    const mes = q["mes"];
    if (mes === undefined || mes === "") return this.servico.mes(this.servico.mesCorrente());
    if (typeof mes !== "string" || !mesValido(mes)) {
      throw new BadRequestException("parametro invalido: mes");
    }
    return this.servico.mes(mes);
  }

  @Post("lancamentos")
  criarLancamento(@Body() corpo: unknown): Promise<Lancamento> {
    return http(() => this.servico.criarLancamento(exigir(validarNovoLancamento(corpo))));
  }

  @Delete("lancamentos/:id")
  @HttpCode(204)
  excluirLancamento(@Param("id") valor: string): Promise<void> {
    return http(() => this.servico.excluirLancamento(id(valor)));
  }

  @Post("contas")
  criarConta(@Body() corpo: unknown): Promise<ContaRecorrente> {
    return http(() => this.servico.criarConta(exigir(validarNovaConta(corpo))));
  }

  @Post("contas/:id/pagamentos")
  pagarConta(@Param("id") valor: string, @Body() corpo: unknown): Promise<Lancamento> {
    return http(() => this.servico.pagarConta(id(valor), exigir(validarPagamento(corpo))));
  }

  @Post("contas/:id/encerrar")
  @HttpCode(204)
  encerrarConta(@Param("id") valor: string, @Body() corpo: unknown): Promise<void> {
    const { ultimoMes } = exigir(validarEncerramento(corpo));
    return http(() => this.servico.encerrarConta(id(valor), ultimoMes));
  }

  @Post("contas/:id/reativar")
  @HttpCode(204)
  reativarConta(@Param("id") valor: string): Promise<void> {
    return http(() => this.servico.reativarConta(id(valor)));
  }

  @Delete("contas/:id")
  @HttpCode(204)
  excluirConta(@Param("id") valor: string): Promise<void> {
    return http(() => this.servico.excluirConta(id(valor)));
  }

  @Post("categorias")
  criarCategoria(@Body() corpo: unknown): Promise<Categoria> {
    return http(() => this.servico.criarCategoria(exigir(validarNovaCategoria(corpo))));
  }

  /** Excluir nao altera lancamentos/contas antigos: eles guardam o nome da categoria. */
  @Delete("categorias/:id")
  @HttpCode(204)
  excluirCategoria(@Param("id") valor: string): Promise<void> {
    return http(() => this.servico.excluirCategoria(id(valor)));
  }
}
