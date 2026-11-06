import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { lerMigracoes } from "./migrar.js";

async function ler(sql: string) {
  const dir = await mkdtemp(join(tmpdir(), "nucleos-migracao-"));
  try {
    await writeFile(join(dir, "0001_teste.up.sql"), sql);
    return await lerMigracoes(pathToFileURL(dir + "/"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("PL/pgSQL e literais nao confundem a transacao externa; checksum preserva bytes", async () => {
  const sql = `CREATE FUNCTION exemplo() RETURNS trigger LANGUAGE plpgsql AS $corpo$
    BEGIN RETURN NEW; END $corpo$;
    SELECT 'COMMIT; --', 'ROLLBACK''BEGIN', "SAVEPOINT";
    /* externo /* BEGIN */ COMMIT */ -- ROLLBACK
    SELECT E'aspas\\'BEGIN';`;
  const resultado = await ler(sql);
  assert.equal(resultado[0]?.sql, sql);
  assert.equal(resultado[0].checksum, createHash("sha256").update(sql).digest("hex"));
});

for (const comando of [
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT x",
  "START TRANSACTION",
  "VACUUM",
  "CREATE INDEX CONCURRENTLY x ON y(z)",
]) {
  test(`rejeita comando externo mesmo depois de corpo ou comentario: ${comando}`, async () => {
    await assert.rejects(ler(`SELECT $$BEGIN$$; /* comentario */ ${comando};`), /comando proibido/);
  });
}
test("nao oculta comando externo depois de comentario dentro de literal", async () => {
  await assert.rejects(ler("SELECT '--'; COMMIT;"), /comando proibido/);
  await assert.rejects(ler("SELECT '/*'; BEGIN;"), /comando proibido/);
});
test("rejeita delimitadores SQL incompletos", async () => {
  for (const sql of ["SELECT 'aberto", "DO $tag$ BEGIN", "/* aberto"])
    await assert.rejects(ler(sql), /nao terminado/);
});
test("comentario termina tambem em CR isolado; COMMIT seguinte continua proibido", async () => {
  await assert.rejects(ler("-- comentario\rCOMMIT;"), /comando proibido/);
});
test("tags longas nao ocultam comandos depois do corpo", async () => {
  for (const tamanho of [78, 79, 80, 200]) {
    const tag = "$" + "a".repeat(tamanho) + "$";
    assert.equal((await ler(`DO ${tag} BEGIN PERFORM 1; END ${tag};`)).length, 1);
    await assert.rejects(ler(`DO ${tag} BEGIN END ${tag}; COMMIT;`), /comando proibido/);
  }
});
