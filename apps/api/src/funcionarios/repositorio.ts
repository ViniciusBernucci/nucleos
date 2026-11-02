import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ObjetoConfig } from "@nucleos/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface AtribuicaoMotor extends QueryResultRow {
  id: string;
  config: ObjetoConfig;
  habilitada: boolean;
  funcionario_status: string;
  definicao_id: string;
  handler_key: string | null;
  config_schema: ObjetoConfig;
  permissoes_requeridas: string[];
  status_implementacao: string;
  ativo: boolean;
  gatilhos_suportados: string[];
}
export async function atribuicaoMotor(c: PoolClient, id: string): Promise<AtribuicaoMotor> {
  const { rows } = await c.query<AtribuicaoMotor>(
    `SELECT a.id,a.config,a.habilitada,f.status funcionario_status,d.id definicao_id,
 d.handler_key,d.config_schema,d.permissoes_requeridas,d.status_implementacao,d.ativo,d.gatilhos_suportados
 FROM funcionarios.atribuicoes a JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id
 JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id JOIN organizacao.setores s ON s.id=f.setor_id
 WHERE a.id=$1 AND s.ativo FOR UPDATE OF a`,
    [id],
  );
  const a = rows[0];
  if (a === undefined) throw new NotFoundException("atribuicao nao encontrada");
  return a;
}
export function exigirExecutavel(a: AtribuicaoMotor): void {
  if (
    !a.habilitada ||
    a.funcionario_status !== "ATIVO" ||
    !a.ativo ||
    a.status_implementacao !== "DISPONIVEL"
  )
    throw new ConflictException("tarefa nao executavel");
}
export async function transacao<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    try {
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  } finally {
    c.release();
  }
}
export async function auditar(
  c: PoolClient,
  entidade: string,
  id: string,
  acao: string,
  antes: unknown,
  depois: unknown,
): Promise<void> {
  await c.query(
    "INSERT INTO funcionarios.auditoria(entidade,entidade_id,acao,antes,depois) VALUES($1,$2,$3,$4,$5)",
    [entidade, id, acao, JSON.stringify(antes), JSON.stringify(depois)],
  );
}
export async function objetos<T>(pool: Pool, sql: string, valores: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query<{ dado: T }>(
    `SELECT funcionarios.json_ids(to_jsonb(x)) dado FROM (${sql}) x`,
    valores,
  );
  return rows.map((r) => r.dado);
}
