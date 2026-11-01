import assert from "node:assert/strict";
import { test } from "node:test";
import { opcoesPool } from "./banco.js";

test("opcoes do pool: componentes explicitos, senha separada e sem connectionString", () => {
  const o = opcoesPool("postgres://nucleos_dev@127.0.0.1:15432/nucleos_dev", "s3nha", 5);
  assert.deepEqual(o, {
    host: "127.0.0.1",
    port: 15432,
    user: "nucleos_dev",
    database: "nucleos_dev",
    password: "s3nha",
    max: 5,
  });
  assert.equal("connectionString" in o, false);
});

test("opcoes do pool: porta padrao, sem senha e TLS por sslmode", () => {
  const o = opcoesPool("postgresql://app%40x@db.interno/nucleos?sslmode=verify-full", undefined, 2);
  assert.equal(o.port, 5432);
  assert.equal(o.user, "app@x");
  assert.equal("password" in o, false);
  assert.equal(o.ssl, true);
  assert.equal("ssl" in opcoesPool("postgres://u@h/d", undefined, 1), false);
});
