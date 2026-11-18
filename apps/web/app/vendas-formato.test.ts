import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  filtrosDaUrl,
  formatarDiaCurto,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
  geometriaGrafico,
  paraQuery,
  rotuloPagamento,
  rotuloStatus,
  tempoDecorrido,
  tetoRedondo,
  ultimosDias,
  variacao,
} from "../lib/vendas-formato.ts";

/** Intl usa espaco nao separavel; normaliza para comparar. */
const norm = (s: string): string => s.replace(/\p{Zs}/gu, " ");

describe("formatacao pt-BR", () => {
  test("moeda, inteiro, percentual e dia", () => {
    assert.equal(norm(formatarMoeda(123_456, "BRL")), "R$ 1.234,56");
    assert.equal(norm(formatarMoeda(0, "BRL")), "R$ 0,00");
    assert.match(norm(formatarMoeda(9_990, "USD")), /US\$\s?99,90/);
    assert.equal(norm(formatarMoeda(1_000, "XX")), "XX 10,00"); // moeda invalida nao quebra
    assert.equal(formatarInteiro(1234567), "1.234.567");
    assert.equal(formatarPercentual(0.1234), "12,3%");
    assert.equal(formatarDiaCurto("2026-10-31"), "31/10");
  });

  test("rotulos conhecidos e passagem do desconhecido", () => {
    assert.equal(rotuloStatus("REFUNDED"), "Reembolsada");
    assert.equal(rotuloStatus("NOVO_STATUS"), "NOVO_STATUS");
    assert.equal(rotuloPagamento("PIX"), "Pix");
    assert.equal(rotuloPagamento("OUTRO"), "OUTRO");
  });

  test("tempo decorrido", () => {
    const agora = new Date("2026-11-01T12:00:00Z");
    assert.equal(tempoDecorrido(null, agora), "nunca");
    assert.equal(tempoDecorrido("lixo", agora), "nunca");
    assert.equal(tempoDecorrido("2026-11-01T11:59:40Z", agora), "agora há pouco");
    assert.equal(tempoDecorrido("2026-11-01T11:55:00Z", agora), "há 5 min");
    assert.equal(tempoDecorrido("2026-11-01T09:00:00Z", agora), "há 3 h");
    assert.equal(tempoDecorrido("2026-10-31T11:00:00Z", agora), "há 1 dia");
    assert.equal(tempoDecorrido("2026-10-29T11:00:00Z", agora), "há 3 dias");
  });
});

describe("variacao vs. periodo anterior", () => {
  test("alta, baixa, estavel e sem base (nunca divide por zero)", () => {
    assert.deepEqual(variacao(150, 100), { texto: "▲ 50% vs. período anterior", direcao: "alta" });
    assert.deepEqual(variacao(75, 100), { texto: "▼ 25% vs. período anterior", direcao: "baixa" });
    assert.equal(variacao(100, 100).direcao, "estavel");
    assert.equal(variacao(10, 0).direcao, "sem-base");
    assert.equal(variacao(0, 0).direcao, "estavel");
  });
});

describe("filtros da URL", () => {
  test("mantem so valores bem formados e descarta o resto", () => {
    assert.deepEqual(
      filtrosDaUrl({
        de: "2026-10-01",
        ate: "2026-10-31",
        moeda: "BRL",
        produto: "101",
        extra: "x",
      }),
      { de: "2026-10-01", ate: "2026-10-31", moeda: "BRL", produto: "101" },
    );
    assert.deepEqual(
      filtrosDaUrl({
        de: "ontem",
        ate: ["2026-10-31", "2026-10-30"],
        moeda: "real",
        produto: "a b;drop",
      }),
      {},
    );
    assert.equal(paraQuery({ de: "2026-10-01", moeda: "BRL" }), "de=2026-10-01&moeda=BRL");
    assert.equal(paraQuery({}), "");
  });
});

describe("atalhos de periodo", () => {
  test("usa o dia de Sao Paulo (23:30 locais ainda e o mesmo dia) e inclui os dois extremos", () => {
    const agora = new Date("2026-11-01T02:30:00Z"); // 31/10 23:30 em Sao Paulo
    assert.deepEqual(ultimosDias(7, agora), { de: "2026-10-25", ate: "2026-10-31" });
    assert.deepEqual(ultimosDias(1, agora), { de: "2026-10-31", ate: "2026-10-31" });
    assert.deepEqual(ultimosDias(30, new Date("2026-03-02T15:00:00Z")), {
      de: "2026-02-01",
      ate: "2026-03-02",
    });
  });
});

describe("grafico", () => {
  test("teto redondo", () => {
    assert.equal(tetoRedondo(0), 100);
    assert.equal(tetoRedondo(1), 1);
    assert.equal(tetoRedondo(130), 200);
    assert.equal(tetoRedondo(4_200), 5_000);
    assert.equal(tetoRedondo(5_001), 10_000);
  });

  test("geometria: maior valor encosta no topo, zero na base, eixo em 5 marcas", () => {
    const g = geometriaGrafico(
      [
        { dia: "2026-10-01", receitaCentavos: 0, vendas: 0 },
        { dia: "2026-10-02", receitaCentavos: 5_000, vendas: 2 },
        { dia: "2026-10-03", receitaCentavos: 2_500, vendas: 1 },
      ],
      640,
      220,
      { topo: 10, direita: 10, baixo: 30, esquerda: 50 },
    );
    assert.equal(g.maxCentavos, 5_000);
    assert.deepEqual(
      g.pontos.map((p) => [p.x, p.y]),
      [
        [50, 190],
        [340, 10],
        [630, 100],
      ],
    );
    assert.equal(g.eixoY.length, 5);
    assert.equal(g.eixoY[0]?.centavos, 5_000);
    assert.equal(g.eixoY[4]?.centavos, 0);
    assert.match(g.area, /^M50\.0,190\.0 L50\.0,190\.0 .* Z$/);
  });

  test("serie vazia e de um ponto nao quebram", () => {
    const vazio = geometriaGrafico([], 640, 220, {
      topo: 10,
      direita: 10,
      baixo: 30,
      esquerda: 50,
    });
    assert.equal(vazio.linha, "");
    assert.equal(vazio.area, "");
    const um = geometriaGrafico(
      [{ dia: "2026-10-01", receitaCentavos: 100, vendas: 1 }],
      640,
      220,
      { topo: 10, direita: 10, baixo: 30, esquerda: 50 },
    );
    assert.equal(um.pontos.length, 1);
  });
});
