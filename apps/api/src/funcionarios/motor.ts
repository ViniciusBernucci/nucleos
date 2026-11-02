import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Agendamento, ExecucaoFuncionario, ObjetoConfig } from "@nucleos/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { dadosSeguros, EVENTOS_FUNCIONARIOS, proximaOcorrencia } from "./agenda.js";
import type { RegistroHandlers } from "./handlers.js";
import { AutorizadorFuncionarios, validarConfiguracao } from "./handlers.js";
import { atribuicaoMotor, auditar, exigirExecutavel, objetos, transacao } from "./repositorio.js";

interface ItemFila extends QueryResultRow {
  id: string;
  execucao_id: string;
  tentativa: number;
  atribuicao_id: string;
  agendamento_id: string | null;
  agendamento_versao: number | null;
  chave_idempotencia: string;
  config_snapshot: ObjetoConfig;
  politica_sobreposicao: string;
  politica_retentativa: { maxTentativas: number; backoffSegundos: number };
  versao: number | null;
  habilitado: boolean | null;
  estado: string;
}
export interface OpcoesMotor {
  dono?: string;
  agora?: (c: PoolClient) => Promise<Date>;
  leaseSegundos?: number;
  heartbeatMs?: number;
  log?: (mensagem: string) => void;
}

/** Fonte de verdade PostgreSQL; fila e histórico são gravados na mesma transação. */
export class MotorFuncionarios {
  readonly #dono: string;
  readonly #agora: (c: PoolClient) => Promise<Date>;
  readonly #leaseSegundos: number;
  readonly #heartbeat: number;
  readonly #ativos = new Set<AbortController>();
  #timer: NodeJS.Timeout | undefined;
  #rodando = false;
  #consumindo = false;
  constructor(
    readonly pool: Pool,
    readonly registro: RegistroHandlers,
    readonly autorizador = new AutorizadorFuncionarios(),
    private readonly opcoes: OpcoesMotor = {},
  ) {
    this.#dono = opcoes.dono ?? randomUUID();
    this.#leaseSegundos = opcoes.leaseSegundos ?? 300;
    this.#heartbeat = opcoes.heartbeatMs ?? 60000;
    this.#agora =
      opcoes.agora ??
      (async (c) =>
        (await c.query<{ agora: Date }>("SELECT clock_timestamp() agora")).rows[0]?.agora ??
        new Date());
  }
  async #enfileirar(
    c: PoolClient,
    id: string,
    chave: string,
    origem: string,
    quando: Date,
    agendamento?: Agendamento,
  ): Promise<string> {
    const a = await atribuicaoMotor(c, id);
    exigirExecutavel(a);
    this.autorizador.permitir(a.permissoes_requeridas);
    validarConfiguracao(a.config_schema, a.config, this.registro.obter(a.handler_key));
    const r = await c.query<{ id: string }>(
      `INSERT INTO funcionarios.execucoes(atribuicao_id,agendamento_id,agendamento_versao,origem,
   programada_em,chave_idempotencia,correlacao,config_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(chave_idempotencia) DO NOTHING RETURNING id`,
      [
        id,
        agendamento?.id ?? null,
        agendamento?.versao ?? null,
        origem,
        quando,
        chave,
        randomUUID(),
        a.config,
      ],
    );
    const execucao = r.rows[0]?.id;
    if (execucao === undefined) {
      const existente = await c.query<{ id: string }>(
        "SELECT id FROM funcionarios.execucoes WHERE chave_idempotencia=$1",
        [chave],
      );
      const idExistente = existente.rows[0]?.id;
      if (idExistente === undefined) throw new Error("enfileiramento sem identificador");
      // Fila e execução foram inseridas atomicamente. Não bloqueia um histórico já em conclusão.
      return idExistente;
    }
    await c.query(
      "INSERT INTO funcionarios.fila(execucao_id,executar_em) VALUES($1,$2) ON CONFLICT(execucao_id) DO NOTHING",
      [execucao, quando],
    );
    if (origem === "manual")
      await auditar(c, "execucao", execucao, "executar", null, { atribuicao_id: id });
    return execucao;
  }
  executarAgora(atribuicaoId: string): Promise<string> {
    return transacao(this.pool, async (c) =>
      this.#enfileirar(c, atribuicaoId, `manual:${randomUUID()}`, "manual", await this.#agora(c)),
    );
  }
  async planejar(): Promise<number> {
    return transacao(this.pool, async (c) => {
      const agora = await this.#agora(c);
      const { rows } = await c.query<{ agenda: Agendamento }>(
        `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
   JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id
   JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id JOIN organizacao.setores setor ON setor.id=f.setor_id
   WHERE s.habilitado AND a.habilitada AND f.status='ATIVO' AND d.ativo AND setor.ativo
    AND d.status_implementacao='DISPONIVEL' AND s.proxima_em<=$1
   ORDER BY s.proxima_em,s.id LIMIT 100 FOR UPDATE OF a SKIP LOCKED`,
        [agora],
      );
      let total = 0;
      for (const { agenda: candidata } of rows) {
        // Mesma ordem das edições: atribuição antes do agendamento. Releitura evita
        // usar a versão/próxima ocorrência do snapshot anterior à aquisição do lock.
        const atual = await c.query<{ agenda: Agendamento }>(
          `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
           WHERE s.id=$1 AND s.habilitado AND s.proxima_em<=$2 FOR UPDATE OF s`,
          [candidata.id, agora],
        );
        const s = atual.rows[0]?.agenda;
        if (s === undefined) continue;
        const ocorrencia = new Date(s.proxima_em as string);
        if (s.fim_em === null || ocorrencia <= new Date(s.fim_em)) {
          await this.#enfileirar(
            c,
            s.atribuicao_id,
            `agendamento:${s.id}:v${s.versao}:${ocorrencia.toISOString()}`,
            "agendamento",
            ocorrencia,
            s,
          );
          total++;
        }
        const proxima = proximaOcorrencia(s, agora);
        await c.query(
          "UPDATE funcionarios.agendamentos SET ultima_em=$2,proxima_em=$3 WHERE id=$1",
          [s.id, ocorrencia, proxima],
        );
      }
      return total;
    });
  }
  /** Pode usar o client da transação de negócio para publicar atomicamente (outbox local). */
  async publicar(
    tipo: string,
    chave: string,
    payload: ObjetoConfig,
    cliente?: PoolClient,
  ): Promise<boolean> {
    if (
      !EVENTOS_FUNCIONARIOS.some((t) => t === tipo) ||
      chave.length > 200 ||
      !dadosSeguros(payload) ||
      JSON.stringify(payload).length > 32000
    )
      throw new ConflictException("evento invalido");
    const publicar = async (c: PoolClient): Promise<boolean> => {
      const { rows } = await c.query<{ id: string }>(
        "INSERT INTO funcionarios.eventos(tipo,chave,payload) VALUES($1,$2,$3) ON CONFLICT(chave) DO NOTHING RETURNING id",
        [tipo, `${tipo}:${chave}`, payload],
      );
      const evento = rows[0];
      if (evento === undefined) return false;
      const agora = await this.#agora(c);
      const agendas = await c.query<{ agenda: Agendamento }>(
        `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id
    JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
    WHERE s.gatilho='EVENTO' AND s.tipo_evento=$1 AND $2::jsonb @> s.filtro_evento AND s.habilitado
    AND s.inicio_em<=$3 AND(s.fim_em IS NULL OR s.fim_em>=$3) AND a.habilitada AND f.status='ATIVO' AND d.ativo
    AND d.status_implementacao='DISPONIVEL' ORDER BY a.id,s.id FOR UPDATE OF a`,
        [tipo, payload, agora],
      );
      for (const { agenda: candidata } of agendas.rows) {
        const atual = await c.query<{ agenda: Agendamento }>(
          `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
           WHERE s.id=$1 AND s.gatilho='EVENTO' AND s.tipo_evento=$2 AND $3::jsonb @> s.filtro_evento
           AND s.habilitado AND s.inicio_em<=$4 AND(s.fim_em IS NULL OR s.fim_em>=$4) FOR UPDATE OF s`,
          [candidata.id, tipo, payload, agora],
        );
        const s = atual.rows[0]?.agenda;
        if (s === undefined) continue;
        await this.#enfileirar(
          c,
          s.atribuicao_id,
          `evento:${evento.id}:agendamento:${s.id}:v${s.versao}`,
          "evento",
          agora,
          s,
        );
      }
      await c.query("UPDATE funcionarios.eventos SET processado_em=$2 WHERE id=$1", [
        evento.id,
        agora,
      ]);
      return true;
    };
    return cliente === undefined ? transacao(this.pool, publicar) : publicar(cliente);
  }
  async #reivindicar(): Promise<ItemFila | null> {
    return transacao(this.pool, async (c) => {
      const agora = await this.#agora(c);
      const consulta = `SELECT q.id,q.execucao_id,q.tentativa,q.estado,e.atribuicao_id,e.agendamento_id,e.agendamento_versao,e.chave_idempotencia,e.config_snapshot,
   s.versao,s.habilitado,coalesce(s.politica_sobreposicao,'ENFILEIRAR') politica_sobreposicao,
   coalesce(s.politica_retentativa,'{"maxTentativas":3,"backoffSegundos":30}'::jsonb) politica_retentativa
   FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id LEFT JOIN funcionarios.agendamentos s ON s.id=e.agendamento_id
   JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id`;
      const disponivel = `(q.estado='AGUARDANDO' AND q.executar_em<=$1 OR q.estado='EXECUTANDO' AND q.lease_ate<=$1)`;
      // O lock da atribuição precede também a fila; cancelamento e enfileiramento
      // não podem esperar um item cujo consumidor esteja esperando esta atribuição.
      const candidata = await c.query<ItemFila>(
        `${consulta} WHERE ${disponivel} ORDER BY a.prioridade DESC,q.executar_em,q.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,
        [agora],
      );
      const id = candidata.rows[0]?.id;
      if (id === undefined) return null;
      const r = await c.query<ItemFila>(
        `${consulta} WHERE q.id=$2 AND ${disponivel} FOR UPDATE OF q SKIP LOCKED`,
        [agora, id],
      );
      const item = r.rows[0];
      if (item === undefined) return null;
      const a = await atribuicaoMotor(c, item.atribuicao_id);
      const velho =
        item.agendamento_id !== null &&
        (item.versao !== item.agendamento_versao || item.habilitado !== true);
      if (
        velho ||
        !a.habilitada ||
        a.funcionario_status !== "ATIVO" ||
        !a.ativo ||
        a.status_implementacao !== "DISPONIVEL" ||
        !this.registro.possui(a.handler_key)
      ) {
        await this.#encerrarSemExecutor(c, item, "CANCELADA", agora);
        return null;
      }
      this.autorizador.permitir(a.permissoes_requeridas);
      try {
        validarConfiguracao(
          a.config_schema,
          item.config_snapshot,
          this.registro.obter(a.handler_key),
        );
      } catch {
        await this.#encerrarSemExecutor(c, item, "FALHA", agora);
        return null;
      }
      const ativos = await c.query<{ id: string; execucao_id: string }>(
        `SELECT q.id,q.execucao_id FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id
    WHERE e.atribuicao_id=$1 AND q.id<>$2 AND q.estado='EXECUTANDO' AND q.lease_ate>$3`,
        [a.id, item.id, agora],
      );
      if (ativos.rowCount !== 0) {
        if (item.politica_sobreposicao === "PULAR") {
          await this.#encerrarSemExecutor(c, item, "IGNORADA", agora);
          return null;
        }
        if (item.politica_sobreposicao === "ENFILEIRAR") {
          await c.query("UPDATE funcionarios.fila SET executar_em=$2 WHERE id=$1", [
            item.id,
            new Date(agora.getTime() + 15000),
          ]);
          return null;
        }
        for (const outro of ativos.rows) {
          await c.query(
            "UPDATE funcionarios.fila SET estado='CANCELADA',tentativa=tentativa+1 WHERE id=$1",
            [outro.id],
          );
          await c.query(
            "UPDATE funcionarios.execucoes SET status='CANCELADA',finalizada_em=$2 WHERE id=$1",
            [outro.execucao_id, agora],
          );
        }
      }
      const max = item.politica_retentativa.maxTentativas;
      if (item.tentativa >= max) {
        await this.#encerrarSemExecutor(c, item, "FALHA", agora);
        return null;
      }
      item.tentativa++;
      await c.query(
        "UPDATE funcionarios.fila SET estado='EXECUTANDO',tentativa=$2,lease_dono=$3,lease_ate=$4 WHERE id=$1",
        [
          item.id,
          item.tentativa,
          this.#dono,
          new Date(agora.getTime() + this.#leaseSegundos * 1000),
        ],
      );
      await c.query(
        "UPDATE funcionarios.execucoes SET status='EXECUTANDO',tentativa=$2,iniciada_em=$3,finalizada_em=NULL,erro_codigo=NULL WHERE id=$1",
        [item.execucao_id, item.tentativa, agora],
      );
      return item;
    });
  }
  async #encerrarSemExecutor(
    c: PoolClient,
    item: ItemFila,
    status: string,
    agora: Date,
  ): Promise<void> {
    await c.query("UPDATE funcionarios.fila SET estado=$2 WHERE id=$1", [item.id, status]);
    await c.query("UPDATE funcionarios.execucoes SET status=$2,finalizada_em=$3 WHERE id=$1", [
      item.execucao_id,
      status,
      agora,
    ]);
  }
  async #lease(item: ItemFila, renovar: boolean): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE funcionarios.fila SET lease_ate=CASE WHEN $5 THEN clock_timestamp()+($4::integer*interval '1 second') ELSE lease_ate END
   WHERE id=$1 AND tentativa=$2 AND lease_dono=$3 AND estado='EXECUTANDO' AND lease_ate>clock_timestamp()`,
      [item.id, item.tentativa, this.#dono, this.#leaseSegundos, renovar],
    );
    return rowCount === 1;
  }
  async consumirUma(): Promise<boolean> {
    const item = await this.#reivindicar();
    if (item === null) return false;
    const controller = new AbortController();
    this.#ativos.add(controller);
    const heartbeat = setInterval(() => {
      void this.#lease(item, true)
        .then((ok) => {
          if (!ok) controller.abort();
        })
        .catch(() => {
          controller.abort();
        });
    }, this.#heartbeat);
    heartbeat.unref();
    let resumo: unknown = null;
    let falha = false;
    try {
      const a = await transacao(this.pool, (c) => atribuicaoMotor(c, item.atribuicao_id));
      resumo = await this.registro.obter(a.handler_key).executar({
        execucaoId: item.execucao_id,
        chaveIdempotencia: item.chave_idempotencia,
        tentativa: item.tentativa,
        config: item.config_snapshot,
        signal: controller.signal,
        verificarLease: () => this.#lease(item, false),
      });
      resumo ??= null;
      if (!dadosSeguros(resumo) || JSON.stringify(resumo).length > 32000)
        resumo = { mensagem: "execucao concluida" };
    } catch {
      falha = true;
      resumo = null;
    } finally {
      clearInterval(heartbeat);
      this.#ativos.delete(controller);
    }
    await transacao(this.pool, async (c) => {
      const agora = await this.#agora(c);
      const retry = falha && item.tentativa < item.politica_retentativa.maxTentativas;
      const status = retry ? "AGUARDANDO" : falha ? "FALHA" : "SUCESSO";
      const { rowCount } = await c.query(
        `UPDATE funcionarios.fila SET estado=$4,lease_ate=NULL,lease_dono=NULL,executar_em=$5
    WHERE id=$1 AND tentativa=$2 AND lease_dono=$3 AND estado='EXECUTANDO' AND lease_ate>clock_timestamp()`,
        [
          item.id,
          item.tentativa,
          this.#dono,
          status,
          new Date(
            agora.getTime() +
              item.politica_retentativa.backoffSegundos * 1000 * 2 ** (item.tentativa - 1),
          ),
        ],
      );
      if (rowCount === 1)
        await c.query(
          "UPDATE funcionarios.execucoes SET status=$2,finalizada_em=$3,resumo=$4,erro_codigo=$5 WHERE id=$1",
          [
            item.execucao_id,
            status,
            retry ? null : agora,
            JSON.stringify(resumo),
            falha ? "HANDLER_FALHOU" : null,
          ],
        );
    });
    return true;
  }
  async aguardar(
    execucaoId: string,
    timeoutMs = 120000,
    primeiraTentativa = false,
  ): Promise<ExecucaoFuncionario> {
    const fim = Date.now() + timeoutMs;
    while (Date.now() < fim) {
      const e = (
        await objetos<ExecucaoFuncionario>(
          this.pool,
          "SELECT * FROM funcionarios.execucoes WHERE id=$1",
          [execucaoId],
        )
      )[0];
      if (e === undefined) throw new NotFoundException();
      if (
        !["AGUARDANDO", "EXECUTANDO"].includes(e.status) ||
        (primeiraTentativa && e.status === "AGUARDANDO" && e.tentativa > 0)
      )
        return e;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new ConflictException("execucao ainda em andamento");
  }
  iniciar(): void {
    if (this.#timer !== undefined) return;
    const tick = async (): Promise<void> => {
      if (this.#rodando) return;
      this.#rodando = true;
      try {
        await this.planejar();
      } catch {
        this.opcoes.log?.("funcionarios: rodada falhou");
      } finally {
        this.#rodando = false;
      }
    };
    const consumir = async (): Promise<void> => {
      if (this.#consumindo) return;
      this.#consumindo = true;
      try {
        await this.consumirUma();
      } catch {
        this.opcoes.log?.("funcionarios: consumidor falhou");
      } finally {
        this.#consumindo = false;
      }
    };
    // O planejador continua avançando mesmo quando o handler demora mais de um tick.
    const rodada = (): void => {
      void tick();
      void consumir();
    };
    rodada();
    this.#timer = setInterval(rodada, 15000);
    this.#timer.unref();
  }
  parar(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    for (const ativo of this.#ativos) ativo.abort();
  }
}
