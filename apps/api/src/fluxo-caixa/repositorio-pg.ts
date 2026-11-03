import type {
  Categoria,
  Lancamento,
  NovaCategoria,
  NovaContaRecorrente,
  TipoLancamento,
} from "@nucleos/contracts";
import type { Pool, QueryResult, QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import type { ContaRecorrenteBanco } from "./dominio.js";
import {
  CategoriaDuplicada,
  ContaComLancamentos,
  LancamentoVinculado,
  type NovoLancamentoBanco,
  PagamentoDuplicado,
  type RepositorioFluxoCaixa,
} from "./repositorio.js";

const COLUNAS_LANCAMENTO = `id::text AS id, tipo, descricao, categoria, valor_centavos,
  to_char(data, 'YYYY-MM-DD') AS data, conta_recorrente_id::text AS conta_recorrente_id,
  to_char(competencia, 'YYYY-MM') AS competencia, criado_em`;

const COLUNAS_CONTA = `id::text AS id, descricao, categoria, valor_centavos, dia_vencimento,periodicidade,
  to_char(inicio, 'YYYY-MM') AS inicio, to_char(fim, 'YYYY-MM') AS fim`;

const num = (v: unknown): number => Number(v ?? 0);

/** Codigo SQLSTATE do erro do `pg`, se houver. */
const codigo = (e: unknown): unknown =>
  typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;

function lancamento(r: Record<string, unknown>): Lancamento {
  return {
    id: String(r["id"]),
    tipo: r["tipo"] as TipoLancamento,
    descricao: String(r["descricao"]),
    categoria: String(r["categoria"]),
    valorCentavos: num(r["valor_centavos"]),
    data: String(r["data"]),
    contaRecorrenteId: (r["conta_recorrente_id"] as string | null) ?? null,
    competencia: (r["competencia"] as string | null) ?? null,
    criadoEm: (r["criado_em"] as Date).toISOString(),
  };
}

function conta(r: Record<string, unknown>): ContaRecorrenteBanco {
  return {
    id: String(r["id"]),
    descricao: String(r["descricao"]),
    categoria: String(r["categoria"]),
    valorCentavos: num(r["valor_centavos"]),
    diaVencimento: num(r["dia_vencimento"]),
    periodicidade: r["periodicidade"] === "anual" ? "anual" : "mensal",
    inicio: String(r["inicio"]),
    fim: (r["fim"] as string | null) ?? null,
  };
}

/** `YYYY-MM` => primeiro dia do mes, como o banco guarda meses. */
const mesParaData = (mes: string): string => `${mes}-01`;

export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
  constructor(
    private readonly pool: Pool,
    private readonly motor?: MotorFuncionarios,
  ) {}

  private async consultar<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    p?: unknown[],
  ): Promise<QueryResult<T>> {
    if (!this.motor || !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql))
      return this.pool.query<T>(sql, p);
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const resultado = await c.query<T>(sql, p);
      if (resultado.rowCount)
        await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
      await c.query("COMMIT");
      return resultado;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }

  async saldoAntesDe(dia: string): Promise<number> {
    const { rows } = await this.consultar(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE -valor_centavos END), 0)
              AS saldo
         FROM financeiro.lancamentos WHERE data < $1::date`,
      [dia],
    );
    return num((rows[0] as Record<string, unknown> | undefined)?.["saldo"]);
  }

  async lancamentosEntre(de: string, ate: string): Promise<Lancamento[]> {
    const { rows } = await this.consultar(
      `SELECT ${COLUNAS_LANCAMENTO} FROM financeiro.lancamentos
        WHERE data BETWEEN $1::date AND $2::date ORDER BY data, id`,
      [de, ate],
    );
    return (rows as Record<string, unknown>[]).map(lancamento);
  }

  async pagamentosDaCompetencia(competencia: string): Promise<Lancamento[]> {
    const { rows } = await this.consultar(
      `SELECT ${COLUNAS_LANCAMENTO} FROM financeiro.lancamentos
        WHERE conta_recorrente_id IS NOT NULL AND competencia = $1::date`,
      [mesParaData(competencia)],
    );
    return (rows as Record<string, unknown>[]).map(lancamento);
  }

  async listarContas(): Promise<ContaRecorrenteBanco[]> {
    const { rows } = await this.consultar(
      `SELECT ${COLUNAS_CONTA} FROM financeiro.contas_recorrentes ORDER BY descricao, id`,
    );
    return (rows as Record<string, unknown>[]).map(conta);
  }

  async obterConta(id: string): Promise<ContaRecorrenteBanco | null> {
    const { rows } = await this.consultar(
      `SELECT ${COLUNAS_CONTA} FROM financeiro.contas_recorrentes WHERE id = $1::bigint`,
      [id],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    return r === undefined ? null : conta(r);
  }

  async ultimaCompetenciaPaga(contaId: string): Promise<string | null> {
    const { rows } = await this.consultar(
      `SELECT to_char(MAX(competencia), 'YYYY-MM') AS ultima
         FROM financeiro.lancamentos WHERE conta_recorrente_id = $1::bigint`,
      [contaId],
    );
    return ((rows[0] as Record<string, unknown> | undefined)?.["ultima"] as string | null) ?? null;
  }

  async inserirLancamento(novo: NovoLancamentoBanco): Promise<Lancamento> {
    try {
      const { rows } = await this.consultar(
        `INSERT INTO financeiro.lancamentos
           (tipo, descricao, categoria, valor_centavos, data, conta_recorrente_id, competencia)
         VALUES ($1, $2, $3, $4, $5::date, $6::bigint, $7::date)
         RETURNING ${COLUNAS_LANCAMENTO}`,
        [
          novo.tipo,
          novo.descricao,
          novo.categoria,
          novo.valorCentavos,
          novo.data,
          novo.contaRecorrenteId ?? null,
          novo.competencia === undefined ? null : mesParaData(novo.competencia),
        ],
      );
      return lancamento(rows[0] as Record<string, unknown>);
    } catch (e) {
      // 23505 = unique_violation no indice (conta_recorrente_id, competencia).
      if (codigo(e) === "23505") throw new PagamentoDuplicado();
      throw e;
    }
  }

  async excluirLancamento(id: string): Promise<boolean> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      // Mesma exclusao global de aceitar/desfazer: a checagem e a exclusao sao atomicas.
      await c.query("SELECT pg_advisory_xact_lock(7315090)");
      const r = await c.query<{ id: string; transferencia_id: string | null; conciliado: boolean }>(
        `SELECT id,transferencia_id,EXISTS(
          SELECT 1 FROM financeiro.conciliacao_itens i
          JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id
          WHERE c.aceita AND NOT c.desfeita AND
            ((i.tipo='lancamento' AND i.referencia_id=l.id::text) OR
             (i.tipo='conta_pagar' AND i.referencia_id=l.conta_pagar_id::text))
        ) conciliado FROM financeiro.lancamentos l WHERE l.id=$1::bigint FOR UPDATE`,
        [id],
      );
      const linha = r.rows[0];
      if (linha && (linha.transferencia_id !== null || linha.conciliado))
        throw new LancamentoVinculado("lancamento vinculado");
      const removida = linha
        ? await c.query("DELETE FROM financeiro.lancamentos WHERE id=$1::bigint", [id])
        : null;
      if (removida?.rowCount && this.motor)
        await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
      await c.query("COMMIT");
      return (removida?.rowCount ?? 0) > 0;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }

  async inserirConta(nova: NovaContaRecorrente): Promise<ContaRecorrenteBanco> {
    const { rows } = await this.consultar(
      `INSERT INTO financeiro.contas_recorrentes
         (descricao, categoria, valor_centavos, dia_vencimento, inicio, fim)
       VALUES ($1, $2, $3, $4, $5::date, $6::date)
       RETURNING ${COLUNAS_CONTA}`,
      [
        nova.descricao,
        nova.categoria,
        nova.valorCentavos,
        nova.diaVencimento,
        mesParaData(nova.inicio),
        nova.fim === undefined || nova.fim === null ? null : mesParaData(nova.fim),
      ],
    );
    return conta(rows[0] as Record<string, unknown>);
  }

  async definirFimConta(id: string, fim: string | null): Promise<boolean> {
    const r = await this.consultar(
      `UPDATE financeiro.contas_recorrentes SET fim = $2::date, atualizada_em = now()
        WHERE id = $1::bigint`,
      [id, fim === null ? null : mesParaData(fim)],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async excluirConta(id: string): Promise<boolean> {
    try {
      const r = await this.consultar(
        "DELETE FROM financeiro.contas_recorrentes WHERE id = $1::bigint",
        [id],
      );
      return (r.rowCount ?? 0) > 0;
    } catch (e) {
      // ON DELETE RESTRICT falha com 23001 (restrict_violation); 23503 cobre NO ACTION.
      const c = codigo(e);
      if (c === "23001" || c === "23503") throw new ContaComLancamentos();
      throw e;
    }
  }

  async listarCategorias(): Promise<Categoria[]> {
    const { rows } = await this.consultar(
      `SELECT id::text AS id, tipo, nome FROM financeiro.categorias ORDER BY tipo, lower(nome), id`,
    );
    return rows as Categoria[];
  }

  async nomeDaCategoria(tipo: TipoLancamento, nome: string): Promise<string | null> {
    const { rows } = await this.consultar(
      `SELECT nome FROM financeiro.categorias WHERE tipo = $1 AND lower(nome) = lower($2)`,
      [tipo, nome],
    );
    return (rows[0] as { nome: string } | undefined)?.nome ?? null;
  }

  async inserirCategoria(nova: NovaCategoria): Promise<Categoria> {
    try {
      const { rows } = await this.consultar(
        `INSERT INTO financeiro.categorias (tipo, nome) VALUES ($1, $2)
         RETURNING id::text AS id, tipo, nome`,
        [nova.tipo, nova.nome],
      );
      return rows[0] as Categoria;
    } catch (e) {
      // 23505 = unique_violation no indice (tipo, lower(nome)).
      if (codigo(e) === "23505") throw new CategoriaDuplicada();
      throw e;
    }
  }

  async excluirCategoria(id: string): Promise<boolean> {
    const r = await this.consultar("DELETE FROM financeiro.categorias WHERE id = $1::bigint", [id]);
    return (r.rowCount ?? 0) > 0;
  }
}
