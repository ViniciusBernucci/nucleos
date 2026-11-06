import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import { AlertasFinanceiros } from "./alertas.js";
import { RepositorioFinanceiroPg } from "./repositorio-pg.js";

test("mutacoes financeiras publicam dados.alterados atomicamente e falha do evento impede commit", async () => {
  const entradas: [string, Record<string, unknown>][] = [
    ["cancelar", { id: "1" }],
    ["saldo", { contaFinanceiraId: "1", data: "2026-11-03", valorCentavos: "100" }],
    [
      "receber",
      {
        contaFinanceiraId: "1",
        previstoEm: "2026-11-03",
        valorCentavos: "100",
        descricao: "Teste",
      },
    ],
    ["regras", { pagamento: "PIX", dias: "2" }],
    ["fornecedores", { nome: "Ficticio" }],
    ["centros", { nome: "Centro" }],
    ["contas", { nome: "Caixa", tipo: "caixa" }],
  ];
  for (const [operacao, p] of entradas)
    for (const falhar of [false, true]) {
      const passos: string[] = [];
      const c = {
        query: async (sql: string) => {
          passos.push(sql);
          return { rows: [{ id: "1" }], rowCount: 1 };
        },
        release: () => {},
      };
      const pool = {
        connect: async () => c,
        query: () => {
          throw new Error("escrita fora da transacao");
        },
      } as unknown as Pool;
      const motor = {
        publicar: async (tipo: string, _chave: string, _p: unknown, cliente: unknown) => {
          assert.equal(tipo, "financeiro.dados.alterados");
          assert.equal(cliente, c);
          passos.push("EVENTO");
          if (falhar) throw new Error("evento falhou");
          return true;
        },
      } as unknown as MotorFuncionarios;
      const repo = new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor));
      const executar = () =>
        operacao === "cancelar"
          ? repo.cancelar("1")
          : operacao === "saldo"
            ? repo.saldoInformado(p)
            : operacao === "receber"
              ? repo.receberManual(p)
              : repo.cadastro(operacao, p);
      if (falhar) {
        await assert.rejects(executar(), /evento falhou/);
        assert.equal(passos.includes("COMMIT"), false);
      } else {
        await executar();
        assert.equal(passos.filter((s) => s === "EVENTO").length, 1);
      }
      assert.equal(passos.at(-1), falhar ? "ROLLBACK" : "COMMIT");
    }
});
function ambiente(falhar = false) {
  const sqls: { sql: string; p: unknown[] }[] = [];
  let conta = 0;
  const c = {
    query: async (sql: string, p: unknown[] = []) => {
      sqls.push({ sql, p });
      if (sql.startsWith("SELECT id FROM financeiro.categorias"))
        return { rowCount: 1, rows: [{ id: "1" }] };
      if (sql.includes("INSERT INTO financeiro.contas_pagar")) {
        conta++;
        if (falhar && conta === 2) throw new Error("falha simulada");
        return { rowCount: 1, rows: [{ id: String(conta) }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const pool = { connect: async () => c } as unknown as Pool;
  const motor = { publicar: async () => true } as unknown as MotorFuncionarios;
  return {
    repo: new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor)),
    sqls,
  };
}
test("parcelamento distribui resto sem perda e confirma uma transacao", async () => {
  const a = ambiente();
  await a.repo.criarDespesa({
    descricao: "Serviço",
    categoria: "Serviços",
    valorCentavos: "10001",
    vencimento: "2026-11-30",
    parcelas: 3,
  });
  const inserts = a.sqls.filter((c) => c.sql.includes("INSERT INTO financeiro.contas_pagar"));
  assert.deepEqual(
    inserts.map((i) => i.p[4]),
    ["3334", "3334", "3333"],
  );
  assert.equal(
    inserts.reduce((s, i) => s + BigInt(String(i.p[4])), 0n),
    10001n,
  );
  assert.equal(a.sqls.at(-1)?.sql, "COMMIT");
});
test("falha durante parcelamento provoca rollback sem commit", async () => {
  const a = ambiente(true);
  await assert.rejects(
    a.repo.criarDespesa({
      descricao: "Serviço",
      categoria: "Serviços",
      valorCentavos: "10001",
      vencimento: "2026-11-30",
      parcelas: 3,
    }),
    /falha simulada/,
  );
  assert.equal(a.sqls.at(-1)?.sql, "ROLLBACK");
  assert.equal(
    a.sqls.some((c) => c.sql === "COMMIT"),
    false,
  );
});
test("previa CSV denuncia linha invalida e confirmacao nao inicia transacao", async () => {
  const a = ambiente(),
    csv =
      "data;descricao;valor;categoria;fornecedor;centro_custo;vencimento\n2026-11-03;Aluguel;100,00;Aluguel;;;2026-11-10\n2026-11-03;Inválida;1,005;Aluguel;;;2026-11-10";
  const previa = a.repo.previaDespesas(csv);
  assert.equal(previa.linhas.length, 1);
  assert.equal(previa.erros[0]?.linha, 3);
  await assert.rejects(a.repo.importarDespesas(csv, true));
  assert.equal(a.sqls.length, 0);
});
