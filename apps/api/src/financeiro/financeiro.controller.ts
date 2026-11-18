import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  UseGuards,
  Body,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AnexosFinanceiros, type ArquivoAnexo } from "./anexos.js";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { AlertasFinanceiros } from "./alertas.js";
import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { ConciliacaoFinanceira } from "./conciliacao.js";
import { RotinasFinanceiras } from "./rotinas.js";
import { dia, texto } from "./importacao.js";
import { CorpoFinanceiroPipe } from "./corpo.pipe.js";
@Controller("v1/financeiro")
@UseGuards(ChaveServicoGuard)
export class FinanceiroController {
  constructor(
    @Inject(AlertasFinanceiros) private readonly alertas: AlertasFinanceiros,
    @Inject(RepositorioFinanceiroPg) private readonly repo: RepositorioFinanceiroPg,
    @Inject(RotinasFinanceiras) private readonly rotinas: RotinasFinanceiras,
    @Inject(AnexosFinanceiros) private readonly anexos: AnexosFinanceiros,
  ) {}
  @Get("alertas") listar(@Query("estado") estado?: string, @Query("tipo") tipo?: string) {
    return this.alertas.listar(estado, tipo);
  }
  @Post("alertas/:id/resolver") resolver(@Param("id") id: string) {
    return this.alertas.encerrar(id, "resolvido");
  }
  @Post("alertas/:id/ignorar") ignorar(@Param("id") id: string) {
    return this.alertas.encerrar(id, "ignorado");
  }
  @Get("cadastros") cadastros() {
    return this.repo.cadastros();
  }
  @Post("cadastros/:tipo") cadastro(
    @Param("tipo") tipo: string,
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.cadastro(tipo, p);
  }
  @Get("contas-pagar") contasPagar(@Query() f: Record<string, unknown>) {
    return this.repo.pagarContas(f);
  }
  @Post("contas-recorrentes")
  recorrente(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
    return this.repo.criarRecorrente(p);
  }
  @Post("contas-pagar") despesa(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
    return this.repo.criarDespesa(p);
  }
  @Post("contas-pagar/:id/pagar") pagar(
    @Param("id") id: string,
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.pagar(id, p);
  }
  @Post("contas-pagar/:id/cancelar") cancelar(@Param("id") id: string) {
    return this.repo.cancelar(id);
  }
  @Post("contas-pagar/:id/anexos")
  @UseInterceptors(
    FileInterceptor("arquivo", { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  anexo(@Param("id") id: string, @UploadedFile() arquivo: ArquivoAnexo) {
    return this.anexos.enviar(id, arquivo);
  }
  @Get("anexos/:id") async baixarAnexo(@Param("id") id: string) {
    const a = await this.anexos.baixar(id);
    return new StreamableFile(a.corpo, {
      type: a.tipo,
      disposition: "attachment; filename*=UTF-8''" + encodeURIComponent(a.nome),
    });
  }
  @Post("despesas/importar") importarDespesas(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.importarDespesas(texto(p["conteudo"], 1024 * 1024), p["confirmar"] === true);
  }
  @Get("movimentacoes") movimentacoes(
    @Query("de") de = "2000-01-01",
    @Query("ate") ate = "2100-12-31",
    @Query("conta") conta?: string,
  ) {
    return this.repo.movimentacoes(de, ate, conta);
  }
  @Post("transferencias") transferencia(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.transferencia(p);
  }
  @Post("saques-hotmart") saque(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
    return this.repo.transferencia(p, true);
  }
  @Post("saldos-informados") saldo(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
    return this.repo.saldoInformado(p);
  }
  @Get("contas-receber") receber() {
    return this.repo.receber();
  }
  @Post("contas-receber") receberManual(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.receberManual(p);
  }
  @Post("extratos/importar") importarExtrato(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.repo.importarExtrato(p);
  }
  @Get("extratos/itens") itensExtrato() {
    return this.repo.itensExtrato();
  }
  @Get("conciliacoes") conciliacoes() {
    return new ConciliacaoFinanceira(this.repo).listar();
  }
  @Post("conciliacoes") conciliacaoManual(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return new ConciliacaoFinanceira(this.repo).manual(p);
  }
  @Post("conciliacoes/:id/:acao") conciliar(@Param("id") id: string, @Param("acao") acao: string) {
    return new ConciliacaoFinanceira(this.repo).agir(id, acao);
  }
  @Post("vendas/importar-historico") historico(
    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
  ) {
    return this.rotinas.importarHistorico(p);
  }
  @Get("vendas") async vendas(@Query() f: Record<string, unknown>) {
    const de = dia(f["de"] ?? "2000-01-01"),
      ate = dia(f["ate"] ?? "2100-12-31"),
      moeda = f["moeda"] ?? "BRL";
    if (typeof moeda !== "string" || !/^[A-Z]{3}$/.test(moeda))
      throw new BadRequestException("moeda invalida");
    return (
      await this.repo.pool.query<Record<string, unknown>>(
        `SELECT transacao,produto_id,produto_nome,comprador_id,status,grupo,oferta_codigo,
      pedido_em,valor_centavos,desconto_centavos,taxa_centavos,comissoes_centavos,liquido_centavos,parcelas,moeda
      FROM financeiro.vendas WHERE pedido_em>=($1::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      AND pedido_em<(($2::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AND moeda=$3
      AND ($4::text IS NULL OR produto_id=$4) AND ($5::text IS NULL OR status=$5 OR grupo=$5)
      AND ($6::text IS NULL OR comprador_id LIKE $6||'%') ORDER BY pedido_em DESC,transacao LIMIT 500`,
        [de, ate, moeda, f["produto"] ?? null, f["status"] ?? null, f["comprador"] ?? null],
      )
    ).rows;
  }
  @Get("vendas/:transacao") async venda(@Param("transacao") transacao: string) {
    texto(transacao, 100);
    const [vendas, eventos, comissoes] = await Promise.all([
      this.repo.pool.query<Record<string, unknown>>(
        "SELECT * FROM financeiro.vendas WHERE transacao=$1",
        [transacao],
      ),
      this.repo.pool.query<Record<string, unknown>>(
        "SELECT * FROM financeiro.vendas_eventos WHERE transacao=$1 ORDER BY id",
        [transacao],
      ),
      this.repo.pool.query<Record<string, unknown>>(
        "SELECT tipo,moeda,valor_centavos FROM financeiro.vendas_comissoes WHERE transacao=$1",
        [transacao],
      ),
    ]);
    return { venda: vendas.rows[0] ?? null, eventos: eventos.rows, comissoes: comissoes.rows };
  }
}
