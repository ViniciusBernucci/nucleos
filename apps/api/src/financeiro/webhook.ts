import { createHash, timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import type { Secret } from "@nucleos/config";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
export const RECEPTOR_HOTMART = Symbol("RECEPTOR_HOTMART");
const EVENTOS = new Set([
  "PURCHASE_APPROVED",
  "PURCHASE_COMPLETE",
  "PURCHASE_CANCELED",
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_PROTEST",
  "PURCHASE_EXPIRED",
  "PURCHASE_DELAYED",
  "PURCHASE_DISPUTE",
]);
export class ReceptorHotmart {
  constructor(
    readonly pool: Pool,
    readonly motor: MotorFuncionarios,
    readonly segredo: Secret | undefined,
  ) {}
  async receber(cabecalho: unknown, corpo: unknown): Promise<{ recebido: true }> {
    if (!this.segredo) throw new ServiceUnavailableException("webhook nao configurado");
    // Hash both inputs to fixed size before timingSafeEqual, including invalid lengths.
    const a = createHash("sha256")
      .update(typeof cabecalho === "string" ? cabecalho : "")
      .digest();
    const b = createHash("sha256").update(this.segredo.reveal()).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
    if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo))
      throw new BadRequestException("evento invalido");
    const bruto = JSON.stringify(corpo);
    if (Buffer.byteLength(bruto) > 65536) throw new BadRequestException("corpo excede 64 KB");
    const r = corpo as Record<string, unknown>;
    const dados =
      typeof r["data"] === "object" && r["data"] !== null
        ? (r["data"] as Record<string, unknown>)
        : {};
    const compra =
      typeof dados["purchase"] === "object" && dados["purchase"] !== null
        ? (dados["purchase"] as Record<string, unknown>)
        : {};
    const evento = r["event"],
      eventoId = r["id"],
      transacao = compra["transaction"];
    if (
      typeof evento !== "string" ||
      !EVENTOS.has(evento) ||
      typeof eventoId !== "string" ||
      !/^[-\w]{1,100}$/.test(eventoId) ||
      typeof transacao !== "string" ||
      !/^[-\w]{1,100}$/.test(transacao)
    )
      throw new BadRequestException("evento invalido");
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const insercao = await c.query(
        "INSERT INTO financeiro.webhooks_hotmart(id,tipo,transacao,corpo_hash) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id",
        [eventoId, evento, transacao, createHash("sha256").update(bruto).digest("hex")],
      );
      if (insercao.rowCount)
        await this.motor.publicar("hotmart.webhook.recebido", eventoId, { evento_id: eventoId }, c);
      await c.query("COMMIT");
      return { recebido: true };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
@Controller("v1/webhooks")
export class WebhookHotmartController {
  constructor(@Inject(RECEPTOR_HOTMART) readonly receptor: ReceptorHotmart) {}
  @Post("hotmart")
  @HttpCode(200)
  receber(@Headers("x-hotmart-hottok") hottok: unknown, @Body() corpo: unknown) {
    return this.receptor.receber(hottok, corpo);
  }
}
