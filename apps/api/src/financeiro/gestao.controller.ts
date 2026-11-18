import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { CorpoFinanceiroPipe } from "./corpo.pipe.js";
import { GestaoFinanceira, filtroGestao, csvSeguro } from "./gestao.js";
@Controller("v1/financeiro/gestao")
@UseGuards(ChaveServicoGuard)
export class GestaoController {
  constructor(@Inject(GestaoFinanceira) readonly gestao: GestaoFinanceira) {}
  @Get("indicadores") indicadores(@Query() f: Record<string, unknown>) {
    return this.gestao.indicadores(filtroGestao(f));
  }
  @Get("dre") dre(@Query() f: Record<string, unknown>) {
    return this.gestao.meses(filtroGestao(f));
  }
  @Get("fluxo") fluxo(@Query() f: Record<string, unknown>) {
    return this.gestao.fluxo(f);
  }
  @Get("cenarios") cenarios() {
    return this.gestao.cenarios();
  }
  @Post("cenarios/:codigo") cenario(
    @Param("codigo") codigo: string,
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.gestao.salvarCenario(codigo, p);
  }
  @Get("mapeamento") categorias() {
    return this.gestao.mapeamento();
  }
  @Post("mapeamento") mapear(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
    return this.gestao.mapear(p);
  }
  @Get("exportar/:tipo") async exportar(
    @Param("tipo") tipo: string,
    @Query() f: Record<string, unknown>,
  ) {
    const filtro = filtroGestao(f);
    let linhas: unknown[][];
    if (tipo === "dre") {
      const meses = await this.gestao.meses(filtro);
      const chaves = [
        "mes",
        "bruta",
        "reembolsos",
        "impostos",
        "liquida",
        "taxas",
        "comissoes",
        "midia",
        "variaveis",
        "contribuicao",
        "fixas",
        "nao_classificado",
        "resultado",
      ] as const;
      linhas = [[...chaves], ...meses.map((m) => chaves.map((k) => m[k]))];
    } else if (tipo === "despesas") {
      const rows = (
        await this.gestao.repo.pool.query<{
          competencia: string;
          categoria: string;
          valor_centavos: string;
        }>(
          "SELECT to_char(competencia,'YYYY-MM-DD') competencia,categoria,valor_centavos::text FROM financeiro.contas_pagar WHERE status<>'cancelada' AND competencia BETWEEN $1 AND $2 AND $3::text IS NULL AND $4::text IS NULL AND ($5::bigint IS NULL OR centro_custo_id=$5) ORDER BY competencia,id",
          [filtro.de, filtro.ate, filtro.produto, filtro.oferta, filtro.centro],
        )
      ).rows;
      linhas = [
        ["competencia", "categoria", "valor_centavos"],
        ...rows.map((r) => [r.competencia, r.categoria, r.valor_centavos]),
      ];
    } else if (tipo === "vendas") {
      const rows = (
        await this.gestao.repo.pool.query<{
          dia: string;
          produto_id: string;
          status: string;
          valor_centavos: string;
        }>(
          "SELECT to_char(pedido_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') dia,produto_id,status,valor_centavos::text FROM financeiro.vendas WHERE moeda='BRL' AND (pedido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2 AND ($3::text IS NULL OR produto_id=$3) AND ($4::text IS NULL OR oferta_codigo=$4) AND $5::text IS NULL ORDER BY pedido_em,transacao",
          [filtro.de, filtro.ate, filtro.produto, filtro.oferta, filtro.centro],
        )
      ).rows;
      linhas = [
        ["dia", "produto_id", "status", "valor_centavos"],
        ...rows.map((r) => [r.dia, r.produto_id, r.status, r.valor_centavos]),
      ];
    } else throw new BadRequestException("relatorio invalido");
    return new StreamableFile(Buffer.from(csvSeguro(linhas)), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${tipo}.csv"`,
    });
  }
}
