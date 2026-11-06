import assert from "node:assert/strict";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import type { Pool } from "pg";
import type { S3Client } from "@aws-sdk/client-s3";
import { AnexosFinanceiros } from "./anexos.js";
test("anexos privados validam arquivo e compensam upload quando metadados falham", async () => {
  const comandos: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.startsWith("SELECT")) return { rowCount: 1, rows: [{ id: "1" }] };
      throw new Error("falha SQL simulada");
    },
  } as unknown as Pool;
  const s3 = {
    send: async (command: unknown) => {
      comandos.push((command as object).constructor.name);
      return {};
    },
  } as unknown as S3Client;
  const servico = new AnexosFinanceiros(
    pool,
    {
      endpoint: "http://127.0.0.1:19000",
      bucket: "teste-ficticio",
      accessKey: new Secret("teste-key"),
      secretKey: new Secret("teste-secret"),
    },
    s3,
  );
  await assert.rejects(servico.enviar("1", undefined), { status: 400 });
  await assert.rejects(
    servico.enviar("1", {
      originalname: "x.pdf",
      mimetype: "application/pdf",
      size: 2,
      buffer: Buffer.from("xx"),
    }),
    { status: 400 },
  );
  assert.equal(comandos.length, 0);
  await assert.rejects(
    servico.enviar("1", {
      originalname: "x.pdf",
      mimetype: "application/pdf",
      size: 8,
      buffer: Buffer.from("%PDF-1.7"),
    }),
    /falha SQL simulada/,
  );
  assert.deepEqual(comandos, ["PutObjectCommand", "DeleteObjectCommand"]);
});
