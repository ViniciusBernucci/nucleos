import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularMes, csvSeguro, filtroGestao } from "./gestao.js";
test("DRE conserva centavos grandes e separa deducoes, custos e despesas", () => {
  const m = calcularMes({
    mes: "2026-11",
    bruta: "10000000000000001",
    reembolsos: "1",
    impostos: "0",
    taxas: "200",
    comissoes: "300",
    midia: "400",
    variaveis: "500",
    fixas: "600",
    nao_classificado: "700",
    vendas: "4",
  });
  assert.equal(m.liquida, "10000000000000000");
  assert.equal(m.despesas, "2700");
  assert.equal(m.resultado, "9999999999997300");
  assert.equal(m.contribuicao, "9999999999998600");
});
test("CSV escapa formula e aspas e usa BOM, ponto e virgula e CRLF", () => {
  const csv = csvSeguro([
    ["=IMPORTDATA(1)", 'texto"x', "-100"],
    ["@x", "+1", "ok"],
  ]);
  assert.ok(csv.startsWith('\uFEFF"\'=IMPORTDATA(1)";"texto""x";"-100"\r\n'));
  assert.ok(csv.includes('"\'@x"'));
  assert.throws(() => csvSeguro([[{ formula: "=1" }]]));
});
test("filtros recusam datas inexistentes, periodo invertido e intervalo excessivo", () => {
  for (const f of [
    { de: "2026-02-30", ate: "2026-03-01" },
    { de: "2026-11-02", ate: "2026-11-01" },
    { de: "2020-01-01", ate: "2026-01-01" },
  ])
    assert.throws(() => filtroGestao(f));
  assert.equal(filtroGestao({ de: "2026-11-01", ate: "2026-11-30", centro: "1" }).centro, "1");
});
