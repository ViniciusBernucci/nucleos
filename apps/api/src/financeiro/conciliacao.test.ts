import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { ConciliacaoFinanceira } from "./conciliacao.js";
import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";

test("conta paga e seu lancamento nao podem duplicar a mesma origem manual", async () => {
  let insercoes = 0;
  const c = {
    query: async (sql: string) => {
      if (sql.startsWith("INSERT")) insercoes++;
      return {
        rows: [
          {
            valor: "-1000",
            conta_pagar_id: sql.includes("FROM financeiro.lancamentos") ? "1" : null,
          },
        ],
        rowCount: 1,
      };
    },
  } as unknown as PoolClient;
  const repo = {
    transacao: async (fn: (c: PoolClient) => Promise<unknown>) => fn(c),
  } as unknown as RepositorioFinanceiroPg;
  await assert.rejects(
    new ConciliacaoFinanceira(repo).manual({
      itens: [
        { tipo: "conta_pagar", referenciaId: "1", valorCentavos: "-1000" },
        { tipo: "lancamento", referenciaId: "2", valorCentavos: "-1000" },
      ],
    }),
    /pagamento repetido/,
  );
  assert.equal(insercoes, 0);
});
