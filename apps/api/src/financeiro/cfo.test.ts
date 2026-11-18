import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { Secret } from "@nucleos/config";
import { LeituraCfoGuard } from "./cfo.controller.js";
import { pedidoCfo } from "./cfo.js";
test("CFO aceita apenas competencias e periodo, sem texto pessoal ou alteracao de limites", () => {
  for (const f of [
    { competencia: "__proto__" },
    { pergunta: "email@exemplo.com" },
    { maxTokens: 90000 },
    { competencia: "pagar" },
  ])
    assert.throws(() => pedidoCfo(f));
  assert.equal(
    pedidoCfo({ competencia: "despesas", de: "2026-11-01", ate: "2026-11-06" }).competencia,
    "despesas",
  );
});
test("credencial de ferramentas nao concede acesso com a chave administrativa ou ausente", () => {
  const contexto = (authorization?: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    }) as unknown as ExecutionContext;
  const guard = new LeituraCfoGuard({ leitura: new Secret("somente-leitura"), gateway: undefined });
  assert.equal(guard.canActivate(contexto("Bearer somente-leitura")), true);
  for (const chave of [undefined, "Bearer admin", "Bearer gateway"])
    assert.throws(() => guard.canActivate(contexto(chave)));
  assert.throws(() =>
    new LeituraCfoGuard({ leitura: undefined, gateway: undefined }).canActivate(
      contexto("Bearer x"),
    ),
  );
});
