import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type {
  Agendamento,
  Atribuicao,
  DefinicaoTarefa,
  DetalheFuncionario,
  EstadoFuncionarios,
  ExecucaoFuncionario,
  Funcionario,
  ListaExecucoes,
  ObjetoConfig,
  Setor,
} from "@nucleos/contracts";
import type { Pool, PoolClient } from "pg";
import {
  booleano,
  campos,
  EVENTOS_FUNCIONARIOS,
  exigirObjeto,
  identificador,
  inteiro,
  objeto,
  opcao,
  proximasOcorrencias,
  proximaOcorrencia,
  texto,
  validarAgenda,
} from "./agenda.js";
import { validarConfiguracao } from "./handlers.js";
import type { MotorFuncionarios } from "./motor.js";
import { atribuicaoMotor, auditar, objetos, transacao } from "./repositorio.js";

const CONSULTA_FUNCIONARIOS = `SELECT f.*,
 (SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.funcionario_id=f.id) tarefas,
 (SELECT max(e.iniciada_em) FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id WHERE a.funcionario_id=f.id) ultima_em,
 (SELECT min(s.proxima_em) FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id WHERE a.funcionario_id=f.id AND s.habilitado AND a.habilitada) proxima_em,
 (SELECT count(*)::integer FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id WHERE a.funcionario_id=f.id AND e.status='FALHA' AND e.criado_em>now()-interval '7 days') falhas
 FROM funcionarios.funcionarios f`;
export const SERVICO_FUNCIONARIOS = Symbol("SERVICO_FUNCIONARIOS");
export class ServicoFuncionarios {
  constructor(
    readonly pool: Pool,
    readonly motor: MotorFuncionarios,
  ) {}
  setores(): Promise<Setor[]> {
    return objetos(this.pool, "SELECT * FROM organizacao.setores WHERE ativo ORDER BY ordem,nome");
  }
  async setor(id: string): Promise<Setor> {
    return this.#um(
      await objetos<Setor>(this.pool, "SELECT * FROM organizacao.setores WHERE id=$1", [
        identificador(id),
      ]),
    );
  }
  funcionarios(q: ObjetoConfig = {}): Promise<Funcionario[]> {
    const setor = q["setor"] === undefined ? null : identificador(q["setor"]);
    const busca = q["busca"] === undefined || q["busca"] === "" ? "" : texto(q["busca"], 100);
    const status =
      q["status"] === undefined || q["status"] === ""
        ? null
        : opcao(q["status"], ["RASCUNHO", "ATIVO", "PAUSADO", "DESATIVADO"]);
    return objetos(
      this.pool,
      `${CONSULTA_FUNCIONARIOS} WHERE($1::bigint IS NULL OR f.setor_id=$1) AND f.nome ILIKE '%'||$2||'%' AND($3::text IS NULL OR f.status=$3) ORDER BY f.nome LIMIT 200`,
      [setor, busca, status],
    );
  }
  async detalhe(id: string): Promise<DetalheFuncionario> {
    const funcionario = this.#um(
      await objetos<Funcionario>(this.pool, `${CONSULTA_FUNCIONARIOS} WHERE f.id=$1`, [
        identificador(id),
      ]),
    );
    const atribuicoes = await objetos<Atribuicao>(
      this.pool,
      `SELECT a.*,funcionarios.json_ids(to_jsonb(d)) definicao,coalesce((SELECT jsonb_agg(funcionarios.json_ids(to_jsonb(s)) ORDER BY s.id) FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id),'[]') agendamentos FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE a.funcionario_id=$1 ORDER BY d.nome`,
      [id],
    );
    return { funcionario, atribuicoes };
  }
  catalogo(q: ObjetoConfig = {}): Promise<DefinicaoTarefa[]> {
    const setor = q["setor"] === undefined ? null : identificador(q["setor"]);
    const status =
      q["status"] === undefined || q["status"] === ""
        ? null
        : opcao(q["status"], ["DISPONIVEL", "PLANEJADA", "INDISPONIVEL"]);
    return objetos(
      this.pool,
      `SELECT d.*,(SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.definicao_id=d.id) atribuicoes,
   (SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.definicao_id=d.id AND a.habilitada) habilitadas FROM funcionarios.definicoes_tarefa d
   WHERE($1::bigint IS NULL OR d.setor_id=$1)AND($2::text IS NULL OR d.status_implementacao=$2) ORDER BY d.nome`,
      [setor, status],
    );
  }
  async tarefa(id: string): Promise<DefinicaoTarefa> {
    return this.#um(
      await objetos<DefinicaoTarefa>(
        this.pool,
        "SELECT * FROM funcionarios.definicoes_tarefa WHERE id=$1",
        [identificador(id)],
      ),
    );
  }
  async salvarFuncionario(entrada: unknown, id?: string): Promise<string> {
    const x = exigirObjeto(entrada);
    campos(x, ["nome", "setor_id", "descricao", "tipo", "perfil_ia", "avatar"]);
    const nome = texto(x["nome"]);
    const setor = identificador(x["setor_id"]);
    const tipo = opcao(x["tipo"], ["DETERMINISTICO", "AGENTE_IA", "HIBRIDO"]);
    const descricao = x["descricao"] === undefined ? "" : texto(x["descricao"], 2000);
    const perfil =
      x["perfil_ia"] === undefined || x["perfil_ia"] === null || x["perfil_ia"] === ""
        ? null
        : texto(x["perfil_ia"], 100);
    const avatar =
      x["avatar"] === undefined || x["avatar"] === null || x["avatar"] === ""
        ? null
        : texto(x["avatar"], 100);
    if (avatar !== null && !/^[a-z0-9_-]+$/.test(avatar))
      throw new BadRequestException("avatar invalido");
    return this.#mutacao(async (c) => {
      const antes =
        id === undefined
          ? null
          : (
              await c.query<{ dado: Funcionario }>(
                "SELECT funcionarios.json_ids(to_jsonb(f)) dado FROM funcionarios.funcionarios f WHERE id=$1 FOR UPDATE",
                [identificador(id)],
              )
            ).rows[0]?.dado;
      if (id !== undefined && antes === undefined) throw new NotFoundException();
      if (antes !== null && antes !== undefined && antes.setor_id !== setor) {
        const r = await c.query(
          "SELECT 1 FROM funcionarios.atribuicoes WHERE funcionario_id=$1 LIMIT 1",
          [id],
        );
        if (r.rowCount !== 0)
          throw new ConflictException("funcionario com atribuicoes nao muda de setor");
      }
      const r =
        id === undefined
          ? await c.query<{ id: string }>(
              "INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,descricao,tipo,perfil_ia,avatar) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
              [setor, nome, `funcionario-${crypto.randomUUID()}`, descricao, tipo, perfil, avatar],
            )
          : await c.query<{ id: string }>(
              "UPDATE funcionarios.funcionarios SET setor_id=$2,nome=$3,descricao=$4,tipo=$5,perfil_ia=$6,avatar=$7,atualizado_em=now() WHERE id=$1 RETURNING id",
              [id, setor, nome, descricao, tipo, perfil, avatar],
            );
      const salvo = this.#um(r.rows).id;
      await auditar(c, "funcionario", salvo, id === undefined ? "criar" : "editar", antes, x);
      return salvo;
    });
  }
  async statusFuncionario(id: string, status: unknown): Promise<void> {
    const novo = opcao(status, ["ATIVO", "PAUSADO", "DESATIVADO", "RASCUNHO"]);
    await this.#mutacao(async (c) => {
      const f = this.#um(
        (
          await c.query<{ status: string }>(
            "SELECT status FROM funcionarios.funcionarios WHERE id=$1 FOR UPDATE",
            [identificador(id)],
          )
        ).rows,
      );
      if (novo === "ATIVO") {
        const tarefas = await c.query<{ handler_key: string | null }>(
          `SELECT d.handler_key FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE a.funcionario_id=$1 AND a.habilitada AND d.ativo AND d.status_implementacao='DISPONIVEL'`,
          [id],
        );
        if (!tarefas.rows.some((t) => this.motor.registro.possui(t.handler_key)))
          throw new ConflictException("nenhum executor disponivel");
      }
      await c.query(
        "UPDATE funcionarios.funcionarios SET status=$2,atualizado_em=now() WHERE id=$1",
        [id, novo],
      );
      if (novo !== "ATIVO") await this.#invalidarAgendas(c, id);
      await auditar(c, "funcionario", id, "status", f, { status: novo });
    });
  }
  async salvarTarefa(entrada: unknown, id?: string): Promise<string> {
    const x = exigirObjeto(entrada);
    campos(
      x,
      id === undefined
        ? ["setor_id", "codigo", "nome", "descricao", "tipo"]
        : ["nome", "descricao", "ativo"],
    );
    return this.#mutacao(async (c) => {
      if (id === undefined) {
        const codigo = texto(x["codigo"], 100);
        if (!/^[a-z]+\.[a-z_]+$/.test(codigo)) throw new BadRequestException("codigo invalido");
        const r = await c.query<{ id: string }>(
          "INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,descricao,tipo) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [
            identificador(x["setor_id"]),
            codigo,
            texto(x["nome"]),
            x["descricao"] === undefined ? "" : texto(x["descricao"], 2000),
            opcao(x["tipo"] ?? "DETERMINISTICO", [
              "DETERMINISTICO",
              "TAREFA_IA",
              "AGENTE_IA",
              "HIBRIDO",
            ]),
          ],
        );
        const salvo = this.#um(r.rows).id;
        await auditar(c, "tarefa", salvo, "criar", null, x);
        return salvo;
      }
      const antes = this.#um(
        (
          await c.query<{ dado: DefinicaoTarefa }>(
            "SELECT funcionarios.json_ids(to_jsonb(d)) dado FROM funcionarios.definicoes_tarefa d WHERE id=$1 FOR UPDATE",
            [identificador(id)],
          )
        ).rows,
      ).dado;
      await c.query(
        "UPDATE funcionarios.definicoes_tarefa SET nome=$2,descricao=$3,ativo=$4 WHERE id=$1",
        [
          id,
          x["nome"] === undefined ? antes.nome : texto(x["nome"]),
          x["descricao"] === undefined ? antes.descricao : texto(x["descricao"], 2000),
          x["ativo"] === undefined ? antes.ativo : booleano(x["ativo"]),
        ],
      );
      await auditar(c, "tarefa", id, "editar", antes, x);
      return id;
    });
  }
  async atribuir(funcionarioId: string, entrada: unknown): Promise<string> {
    const x = exigirObjeto(entrada);
    campos(x, ["definicao_id", "config", "habilitada", "prioridade"]);
    const config = exigirObjeto(x["config"] ?? {});
    const tarefa = await this.tarefa(identificador(x["definicao_id"]));
    if (tarefa.status_implementacao !== "DISPONIVEL")
      throw new ConflictException("tarefa planejada ou indisponivel");
    validarConfiguracao(
      tarefa.config_schema,
      config,
      this.motor.registro.obter(tarefa.handler_key),
    );
    return this.#mutacao(async (c) => {
      const f = this.#um(
        (
          await c.query<{ setor_id: string }>(
            "SELECT setor_id FROM funcionarios.funcionarios WHERE id=$1 FOR UPDATE",
            [identificador(funcionarioId)],
          )
        ).rows,
      );
      if (f.setor_id !== tarefa.setor_id)
        throw new BadRequestException("atribuicao deve ser do mesmo setor");
      const r = await c.query<{ id: string }>(
        "INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id,config,habilitada,prioridade) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          funcionarioId,
          tarefa.id,
          f.setor_id,
          config,
          x["habilitada"] === undefined ? true : booleano(x["habilitada"]),
          x["prioridade"] === undefined ? 0 : inteiro(x["prioridade"], 0, 100),
        ],
      );
      const id = this.#um(r.rows).id;
      await auditar(c, "atribuicao", id, "criar", null, x);
      return id;
    });
  }
  async configurarAtribuicao(id: string, entrada: unknown): Promise<void> {
    const x = exigirObjeto(entrada);
    campos(x, ["config", "habilitada", "prioridade", "nome_override"]);
    await this.#mutacao(async (c) => {
      const a = await atribuicaoMotor(c, identificador(id));
      const config = x["config"] === undefined ? a.config : exigirObjeto(x["config"]);
      if (a.status_implementacao !== "DISPONIVEL")
        throw new ConflictException("tarefa indisponivel");
      validarConfiguracao(a.config_schema, config, this.motor.registro.obter(a.handler_key));
      await c.query(
        "UPDATE funcionarios.atribuicoes SET config=$2,habilitada=coalesce($3,habilitada),prioridade=coalesce($4,prioridade),nome_override=coalesce($5,nome_override) WHERE id=$1",
        [
          id,
          config,
          x["habilitada"] === undefined ? null : booleano(x["habilitada"]),
          x["prioridade"] === undefined ? null : inteiro(x["prioridade"], 0, 100),
          x["nome_override"] === undefined ? null : texto(x["nome_override"]),
        ],
      );
      await c.query("UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE atribuicao_id=$1", [
        id,
      ]);
      await auditar(
        c,
        "atribuicao",
        id,
        "configurar",
        { config: a.config, habilitada: a.habilitada },
        x,
      );
    });
  }
  async removerAtribuicao(id: string): Promise<void> {
    await this.#mutacao(async (c) => {
      await atribuicaoMotor(c, identificador(id));
      await c.query("UPDATE funcionarios.atribuicoes SET habilitada=false WHERE id=$1", [id]);
      await c.query(
        "UPDATE funcionarios.agendamentos SET habilitado=false,versao=versao+1 WHERE atribuicao_id=$1",
        [id],
      );
      await auditar(c, "atribuicao", id, "remover", null, { habilitada: false });
    });
  }
  async salvarAgenda(atribuicaoId: string, entrada: unknown, id?: string): Promise<string> {
    return this.#mutacao(async (c) => {
      const agora = this.#um(
        (await c.query<{ agora: Date }>("SELECT clock_timestamp() agora")).rows,
      ).agora;
      const a = await atribuicaoMotor(c, identificador(atribuicaoId));
      if (
        a.status_implementacao !== "DISPONIVEL" ||
        !a.ativo ||
        !this.motor.registro.possui(a.handler_key)
      )
        throw new ConflictException("tarefa planejada ou indisponivel");
      const agenda = validarAgenda(entrada, agora);
      if (!a.gatilhos_suportados.includes(agenda.gatilho))
        throw new BadRequestException("gatilho nao suportado");
      const anterior =
        id === undefined
          ? null
          : this.#um(
              (
                await c.query<{ dado: Agendamento }>(
                  "SELECT funcionarios.json_ids(to_jsonb(s)) dado FROM funcionarios.agendamentos s WHERE id=$1 AND atribuicao_id=$2 FOR UPDATE",
                  [identificador(id), atribuicaoId],
                )
              ).rows,
            ).dado;
      const args = [
        atribuicaoId,
        agenda.gatilho,
        agenda.intervalo_min,
        agenda.cron,
        agenda.tipo_evento,
        agenda.filtro_evento,
        agenda.fuso,
        agenda.inicio_em,
        agenda.fim_em,
        proximaOcorrencia(agenda, agora, true),
        agenda.habilitado,
        agenda.politica_sobreposicao,
        agenda.politica_retentativa,
      ];
      const r =
        id === undefined
          ? await c.query<{ id: string }>(
              `INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,intervalo_min,cron,tipo_evento,filtro_evento,fuso,inicio_em,fim_em,proxima_em,habilitado,politica_sobreposicao,politica_retentativa) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
              args,
            )
          : await c.query<{ id: string }>(
              `UPDATE funcionarios.agendamentos SET gatilho=$2,intervalo_min=$3,cron=$4,tipo_evento=$5,filtro_evento=$6,fuso=$7,inicio_em=$8,fim_em=$9,proxima_em=$10,habilitado=$11,politica_sobreposicao=$12,politica_retentativa=$13,versao=versao+1 WHERE id=$14 AND atribuicao_id=$1 RETURNING id`,
              [...args, id],
            );
      const salvo = this.#um(r.rows).id;
      await auditar(
        c,
        "agendamento",
        salvo,
        id === undefined ? "criar" : "editar",
        anterior,
        agenda,
      );
      return salvo;
    });
  }
  async suspenderAgenda(id: string): Promise<void> {
    await this.#mutacao(async (c) => {
      const r = await c.query(
        "UPDATE funcionarios.agendamentos SET habilitado=false,versao=versao+1 WHERE id=$1 RETURNING id",
        [identificador(id)],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      await auditar(c, "agendamento", id, "suspender", null, { habilitado: false });
    });
  }
  async proximas(id: string, n: unknown): Promise<string[]> {
    const a = this.#um(
      await objetos<Agendamento>(this.pool, "SELECT * FROM funcionarios.agendamentos WHERE id=$1", [
        identificador(id),
      ]),
    );
    const quantidade = n === undefined ? 5 : inteiro(Number(n), 1, 20);
    return a.habilitado ? proximasOcorrencias(a, new Date(), quantidade) : [];
  }
  previsualizar(entrada: unknown): string[] {
    return proximasOcorrencias(validarAgenda(entrada, new Date()), new Date());
  }
  eventos(): readonly string[] {
    return EVENTOS_FUNCIONARIOS;
  }
  async executar(id: string): Promise<{ id: string }> {
    const execucao = await this.motor.executarAgora(identificador(id));
    return { id: execucao };
  }
  async execucoes(q: ObjetoConfig = {}): Promise<ListaExecucoes> {
    const limite = q["limite"] === undefined ? 25 : inteiro(Number(q["limite"]), 1, 100);
    const deslocamento =
      q["deslocamento"] === undefined ? 0 : inteiro(Number(q["deslocamento"]), 0, 1000000);
    const filtro = `FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE ($1::bigint IS NULL OR f.id=$1) AND($2::bigint IS NULL OR f.setor_id=$2) AND($3::bigint IS NULL OR d.id=$3) AND($4::text IS NULL OR e.status=$4) AND($5::timestamptz IS NULL OR e.criado_em>=$5) AND($6::timestamptz IS NULL OR e.criado_em<=$6)`;
    const data = (x: unknown): string | null => {
      if (x === undefined || x === "") return null;
      const s = texto(x, 40);
      if (!Number.isFinite(Date.parse(s))) throw new BadRequestException("data invalida");
      return new Date(s).toISOString();
    };
    const args = [
      q["funcionario"] === undefined ? null : identificador(q["funcionario"]),
      q["setor"] === undefined ? null : identificador(q["setor"]),
      q["tarefa"] === undefined ? null : identificador(q["tarefa"]),
      q["status"] === undefined || q["status"] === ""
        ? null
        : opcao(q["status"], [
            "AGUARDANDO",
            "EXECUTANDO",
            "SUCESSO",
            "FALHA",
            "CANCELADA",
            "IGNORADA",
          ]),
      data(q["de"]),
      data(q["ate"]),
    ];
    const itens = await objetos<ExecucaoFuncionario>(
      this.pool,
      `SELECT e.*,f.nome funcionario_nome,d.nome tarefa_nome ${filtro} ORDER BY e.criado_em DESC,e.id DESC LIMIT $7 OFFSET $8`,
      [...args, limite, deslocamento],
    );
    const { rows } = await this.pool.query<{ total: number }>(
      `SELECT count(*)::integer total ${filtro}`,
      args,
    );
    return { itens, total: rows[0]?.total ?? 0, limite, deslocamento };
  }
  async execucao(id: string): Promise<ExecucaoFuncionario> {
    return this.#um(
      await objetos<ExecucaoFuncionario>(
        this.pool,
        "SELECT * FROM funcionarios.execucoes WHERE id=$1",
        [identificador(id)],
      ),
    );
  }
  async estado(): Promise<EstadoFuncionarios> {
    const setores = await this.setores();
    const funcionarios = await objetos<Funcionario>(
      this.pool,
      `${CONSULTA_FUNCIONARIOS} ORDER BY f.nome`,
    );
    const historico = await objetos<ExecucaoFuncionario & { funcionario_id: string }>(
      this.pool,
      `SELECT DISTINCT ON(a.funcionario_id) e.*,a.funcionario_id FROM funcionarios.execucoes e
       JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id
       ORDER BY a.funcionario_id,(e.status='EXECUTANDO') DESC,e.criado_em DESC,e.id DESC`,
    );
    return {
      setores: setores.map((s) => ({
        ...s,
        funcionarios: funcionarios
          .filter((f) => f.setor_id === s.id)
          .map((f) => ({
            ...f,
            atividade: historico.find((e) => e.funcionario_id === f.id) ?? null,
          })),
      })),
    };
  }
  async #invalidarAgendas(c: PoolClient, funcionarioId: string): Promise<void> {
    await c.query(
      "UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE atribuicao_id IN(SELECT id FROM funcionarios.atribuicoes WHERE funcionario_id=$1)",
      [funcionarioId],
    );
  }
  #um<T>(r: T[]): T {
    const x = r[0];
    if (x === undefined) throw new NotFoundException();
    return x;
  }
  async #mutacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    this.motor.autorizador.permitir(["funcionarios.administrar"]);
    try {
      return await transacao(this.pool, fn);
    } catch (e) {
      if (objeto(e) && ["23505", "23503", "23514"].includes(String(e["code"])))
        throw new ConflictException("operacao conflita com registros existentes");
      throw e;
    }
  }
}
