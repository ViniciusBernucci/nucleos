import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { SERVICO_FUNCIONARIOS, ServicoFuncionarios } from "./servico.js";

@Controller("v1/funcionarios")
@UseGuards(ChaveServicoGuard)
export class FuncionariosController {
  constructor(@Inject(SERVICO_FUNCIONARIOS) private readonly servico: ServicoFuncionarios) {}
  @Get("setores") setores() {
    return this.servico.setores();
  }
  @Get("setores/:id") setor(@Param("id") id: string) {
    return this.servico.setor(id);
  }
  @Get("estado") estado() {
    return this.servico.estado();
  }
  @Get("eventos") eventos() {
    return this.servico.eventos();
  }
  @Get("catalogo") catalogo(@Query() q: Record<string, unknown>) {
    return this.servico.catalogo(q);
  }
  @Get("catalogo/:id") tarefa(@Param("id") id: string) {
    return this.servico.tarefa(id);
  }
  @Post("catalogo") criarTarefa(@Body() x: unknown) {
    return this.servico.salvarTarefa(x).then((id) => ({ id }));
  }
  @Patch("catalogo/:id") editarTarefa(@Param("id") id: string, @Body() x: unknown) {
    return this.servico.salvarTarefa(x, id).then((id) => ({ id }));
  }
  @Get("execucoes") execucoes(@Query() q: Record<string, unknown>) {
    return this.servico.execucoes(q);
  }
  @Get("execucoes/:id") execucao(@Param("id") id: string) {
    return this.servico.execucao(id);
  }
  @Post("cron/previsualizar") previsualizar(@Body() x: unknown) {
    return this.servico.previsualizar(x);
  }
  @Post("atribuicoes/:id/executar") executar(@Param("id") id: string) {
    return this.servico.executar(id);
  }
  @Patch("atribuicoes/:id") configurar(@Param("id") id: string, @Body() x: unknown) {
    return this.servico.configurarAtribuicao(id, x).then(() => ({ ok: true }));
  }
  @Delete("atribuicoes/:id") remover(@Param("id") id: string) {
    return this.servico.removerAtribuicao(id).then(() => ({ ok: true }));
  }
  @Post("atribuicoes/:id/agendamentos") agendar(@Param("id") id: string, @Body() x: unknown) {
    return this.servico.salvarAgenda(id, x).then((id) => ({ id }));
  }
  @Patch("atribuicoes/:atribuicao/agendamentos/:id") editarAgenda(
    @Param("atribuicao") atribuicao: string,
    @Param("id") id: string,
    @Body() x: unknown,
  ) {
    return this.servico.salvarAgenda(atribuicao, x, id).then((id) => ({ id }));
  }
  @Post("agendamentos/:id/suspender") suspender(@Param("id") id: string) {
    return this.servico.suspenderAgenda(id).then(() => ({ ok: true }));
  }
  @Get("agendamentos/:id/proximas") proximas(@Param("id") id: string, @Query("n") n: unknown) {
    return this.servico.proximas(id, n);
  }
  @Get() listar(@Query() q: Record<string, unknown>) {
    return this.servico.funcionarios(q);
  }
  @Post() criar(@Body() x: unknown) {
    return this.servico.salvarFuncionario(x).then((id) => ({ id }));
  }
  @Get(":id") detalhe(@Param("id") id: string) {
    return this.servico.detalhe(id);
  }
  @Patch(":id") editar(@Param("id") id: string, @Body() x: unknown) {
    return this.servico.salvarFuncionario(x, id).then((id) => ({ id }));
  }
  @Post(":id/status") status(@Param("id") id: string, @Body("status") status: unknown) {
    return this.servico.statusFuncionario(id, status).then(() => ({ ok: true }));
  }
  @Post(":id/atribuicoes") atribuir(@Param("id") id: string, @Body() x: unknown) {
    return this.servico.atribuir(id, x).then((id) => ({ id }));
  }
}
