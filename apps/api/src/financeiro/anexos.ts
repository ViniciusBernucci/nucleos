import { randomUUID, createHash } from "node:crypto";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { FinanceiroConfig } from "@nucleos/config";
import type { Pool } from "pg";
import { id } from "./importacao.js";
export interface ArquivoAnexo {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
export class AnexosFinanceiros {
  readonly cliente: S3Client | undefined;
  constructor(
    readonly pool: Pool,
    readonly config: FinanceiroConfig["anexos"],
    cliente?: S3Client,
  ) {
    this.cliente =
      cliente ??
      (config
        ? new S3Client({
            endpoint: config.endpoint,
            region: "us-east-1",
            forcePathStyle: true,
            credentials: {
              accessKeyId: config.accessKey.reveal(),
              secretAccessKey: config.secretKey.reveal(),
            },
          })
        : undefined);
  }
  async enviar(conta: string, arquivo: ArquivoAnexo | undefined): Promise<unknown> {
    id(conta);
    if (!this.cliente || !this.config)
      throw new ServiceUnavailableException("anexos MinIO nao configurados");
    if (
      !arquivo ||
      !Buffer.isBuffer(arquivo.buffer) ||
      arquivo.size < 1 ||
      arquivo.size > 10 * 1024 * 1024
    )
      throw new BadRequestException("anexo exige 1 byte a 10 MB");
    const b = arquivo.buffer,
      tipo = arquivo.mimetype;
    const magic =
      tipo === "application/pdf"
        ? b.subarray(0, 5).toString() === "%PDF-"
        : tipo === "image/png"
          ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : tipo === "image/jpeg"
            ? b[0] === 255 && b[1] === 216 && b[2] === 255
            : false;
    if (!magic) throw new BadRequestException("arquivo PDF, JPG ou PNG invalido");
    if (
      !(await this.pool.query("SELECT id FROM financeiro.contas_pagar WHERE id=$1", [conta]))
        .rowCount
    )
      throw new NotFoundException();
    const anexo = randomUUID(),
      chave = "contas-pagar/" + conta + "/" + anexo;
    await this.cliente.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: chave, Body: b, ContentType: tipo }),
    );
    try {
      await this.pool.query(
        "INSERT INTO financeiro.anexos(id,conta_pagar_id,nome,tipo,tamanho,hash,objeto_chave) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          anexo,
          conta,
          arquivo.originalname.replace(/[\r\n/\\]/g, "_").slice(0, 120),
          tipo,
          b.length,
          createHash("sha256").update(b).digest("hex"),
          chave,
        ],
      );
    } catch (e) {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: chave }));
      throw e;
    }
    return { id: anexo };
  }
  async baixar(anexo: string): Promise<{ corpo: Uint8Array; tipo: string; nome: string }> {
    if (!/^[a-f0-9-]{36}$/i.test(anexo)) throw new NotFoundException();
    if (!this.cliente || !this.config)
      throw new ServiceUnavailableException("anexos nao configurados");
    const r = await this.pool.query<{ objeto_chave: string; tipo: string; nome: string }>(
      "SELECT objeto_chave,tipo,nome FROM financeiro.anexos WHERE id=$1",
      [anexo],
    );
    const v = r.rows[0];
    if (!v) throw new NotFoundException();
    const objeto = await this.cliente.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: v.objeto_chave }),
    );
    if (!objeto.Body) throw new NotFoundException();
    return { corpo: await objeto.Body.transformToByteArray(), tipo: v.tipo, nome: v.nome };
  }
}
