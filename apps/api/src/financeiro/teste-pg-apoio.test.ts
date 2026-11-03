import assert from "node:assert/strict";
import { test } from "node:test";
import { encerrarFixturePg } from "./teste-pg-apoio.js";

test("cleanup tenta pool, banco e admin mesmo quando uma etapa falha", async () => {
  for (const falha of [0, 1, 2]) {
    const passos: number[] = [];
    const limpar = (n: number) => async () => {
      passos.push(n);
      if (n === falha) throw new Error("falha simulada de cleanup");
    };
    await assert.rejects(encerrarFixturePg(limpar(0), limpar(1), limpar(2)), /falha simulada/);
    assert.deepEqual(passos, [0, 1, 2]);
  }
});
test("setup parcial finaliza somente recursos ja adquiridos", async () => {
  const passos: string[] = [];
  await encerrarFixturePg(undefined, undefined, undefined);
  await encerrarFixturePg(undefined, undefined, async () => {
    passos.push("admin");
  });
  assert.deepEqual(passos, ["admin"]);
});
