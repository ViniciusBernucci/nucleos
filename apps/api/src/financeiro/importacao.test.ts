import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { csv, decimal, dia, extrato, centavos } from "./importacao.js";
test("dinheiro decimal nao perde centavos e nao aceita fracao oculta", () => {
  assert.equal(decimal("999999999999.99"), "99999999999999");
  assert.equal(decimal("-0,01"), "-1");
  assert.throws(() => decimal("1.005"), BadRequestException);
  assert.throws(() => centavos("0"), BadRequestException);
  assert.throws(() => centavos("10.1"), BadRequestException);
});
test("datas invalidas sao recusadas com erro de entrada", () => {
  for (const d of ["2026-02-29", "2026-99-01", "abc"])
    assert.throws(() => dia(d), BadRequestException);
  assert.equal(dia("2028-02-29"), "2028-02-29");
});
test("CSV preserva aspas, ponto e virgula e quebra de linha dentro do campo", () => {
  assert.deepEqual(
    csv('data;descricao\n2026-11-03;"Serviço; "online"\nmensal"'.replace('"online"', '""online""')),
    [
      ["data", "descricao"],
      ["2026-11-03", 'Serviço; "online"\nmensal'],
    ],
  );
  assert.throws(() => csv('a;"aberto'), BadRequestException);
});
test("OFX e CSV normalizam sinais e identificadores sem arredondamento", () => {
  const a = extrato(
    "<OFX><STMTTRN><DTPOSTED>20261103120000[-3:BRT]<TRNAMT>-123.45<FITID>abc<MEMO>Pagamento</STMTTRN></OFX>",
    "ofx",
  );
  assert.deepEqual(a, [
    { data: "2026-11-03", valorCentavos: "-12345", fitid: "abc", memo: "Pagamento" },
  ]);
  assert.deepEqual(extrato("data;valor;fitid;memo\n2026-11-03;123,45;abc;Entrada", "csv"), [
    { data: "2026-11-03", valorCentavos: "12345", fitid: "abc", memo: "Entrada" },
  ]);
  assert.throws(() => extrato("data;valor;fitid;memo\n2026-11-03;NaN;abc;Entrada", "csv"));
});
