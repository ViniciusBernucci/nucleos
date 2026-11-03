import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Pool, PoolClient } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";

export const MENSAGENS_ALERTA = {
  conta_vencendo: "Conta a pagar vence nos proximos tres dias.",
  conta_vencida: "Conta a pagar vencida.",
  divergencia_conciliacao: "Divergencia encontrada na conciliacao financeira.",
  divergencia_hotmart: "Divergencia na reconciliacao com a Hotmart.",
  recebimento_atrasado: "Recebimento estimado vencido sem conciliacao.",
  caixa_insuficiente: "Saldo projetado abaixo do limite configurado.",
  anomalia: "Desvio detectado nos indicadores financeiros.",
  campanha_ruim: "Campanha abaixo do limite de rentabilidade.",
} as const;
export type TipoAlerta = keyof typeof MENSAGENS_ALERTA;
export interface NovoAlerta {
  tipo: TipoAlerta;
  chave: string;
  referenciaTabela: string;
  referenciaId: string;
  severidade?: "info" | "aviso" | "critico";
}
export class AlertasFinanceiros {
  constructor(
    readonly pool: Pool,
    readonly motor: MotorFuncionarios,
  ) {}
  /** A insercao e o evento pertencem a mesma transacao. O chamador pode fornecer a sua. */
  async criar(dados: NovoAlerta, cliente?: PoolClient): Promise<string | null> {
    if (
      !(dados.tipo in MENSAGENS_ALERTA) ||
      !/^[a-z_]+$/.test(dados.referenciaTabela) ||
      dados.chave.length > 240
    )
      throw new BadRequestException("alerta invalido");
    const c = cliente ?? (await this.pool.connect());
    try {
      if (!cliente) await c.query("BEGIN");
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO financeiro.alertas(tipo,severidade,referencia_tabela,referencia_id,mensagem,chave)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chave) WHERE estado='aberto' DO NOTHING RETURNING id`,
        [
          dados.tipo,
          dados.severidade ?? "aviso",
          dados.referenciaTabela,
          dados.referenciaId,
          MENSAGENS_ALERTA[dados.tipo],
          dados.chave,
        ],
      );
      const id = rows[0]?.id ?? null;
      if (id)
        await this.motor.publicar(
          "financeiro.alerta.criado",
          `alerta:${id}`,
          { alerta_id: id, tipo: dados.tipo },
          c,
        );
      if (!cliente) await c.query("COMMIT");
      return id;
    } catch (erro) {
      if (!cliente) await c.query("ROLLBACK");
      throw erro;
    } finally {
      if (!cliente) c.release();
    }
  }
  async listar(estado = "aberto", tipo?: string): Promise<Record<string, unknown>[]> {
    if (
      !["aberto", "resolvido", "ignorado"].includes(estado) ||
      (tipo !== undefined && !(tipo in MENSAGENS_ALERTA))
    )
      throw new BadRequestException("filtro invalido");
    return (
      await this.pool.query(
        `SELECT * FROM financeiro.alertas WHERE estado=$1 AND ($2::text IS NULL OR tipo=$2) ORDER BY criado_em DESC,id DESC LIMIT 500`,
        [estado, tipo ?? null],
      )
    ).rows as Record<string, unknown>[];
  }
  async encerrar(id: string, estado: "resolvido" | "ignorado"): Promise<void> {
    if (!/^\d{1,19}$/.test(id)) throw new NotFoundException();
    const r = await this.pool.query(
      "UPDATE financeiro.alertas SET estado=$2,encerrado_em=now() WHERE id=$1 AND estado='aberto' RETURNING id",
      [id, estado],
    );
    if (r.rowCount === 0) throw new NotFoundException("alerta aberto nao encontrado");
  }
}
