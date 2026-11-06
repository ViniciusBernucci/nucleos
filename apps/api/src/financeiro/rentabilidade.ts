import type { GestaoFinanceira, FiltroGestao } from "./gestao.js";
import type { PoolClient } from "pg";
export class RentabilidadeMarketing {
  constructor(readonly gestao: GestaoFinanceira) {}
  async consultar(
    f: FiltroGestao,
    c: PoolClient | GestaoFinanceira["repo"]["pool"] = this.gestao.repo.pool,
  ) {
    const vendas = (
      await c.query<{
        campanha_id: string | null;
        produto_id: string;
        oferta_codigo: string | null;
        receita: string;
        liquida: string;
        compradores_novos: string[];
      }>(
        `WITH atribuida AS (
    SELECT v.*,(SELECT min(c.id) FROM marketing.campanhas c WHERE v.rastreio_sck IN (c.id_externo,c.nome,'meta:'||c.id_externo) OR v.rastreio_origem IN (c.id_externo,c.nome,'meta:'||c.id_externo) HAVING count(*)=1) campanha_id
    FROM financeiro.vendas v WHERE moeda='BRL' AND (pedido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date
    AND ($3::text IS NULL OR produto_id=$3) AND ($4::text IS NULL OR oferta_codigo=$4) AND $5::text IS NULL)
    SELECT campanha_id::text,produto_id,oferta_codigo,
    coalesce(sum(valor_centavos) FILTER(WHERE grupo='receita'),0)::text receita,
    coalesce(sum(liquido_centavos) FILTER(WHERE grupo='receita'),0)::text liquida,
    coalesce(array_agg(DISTINCT comprador_id) FILTER(WHERE grupo='receita' AND NOT EXISTS(SELECT 1 FROM financeiro.vendas anterior WHERE anterior.comprador_id=atribuida.comprador_id AND anterior.grupo IN ('receita','reembolso','contestada') AND anterior.pedido_em<(($1::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'))),'{}') compradores_novos
    FROM atribuida GROUP BY campanha_id,produto_id,oferta_codigo`,
        [f.de, f.ate, f.produto, f.oferta, f.centro],
      )
    ).rows;
    const campanhas = (
      await c.query<{ id: string; nome: string; gasto: string }>(
        `SELECT c.id::text,c.nome,coalesce(sum(g.gasto_centavos),0)::text gasto FROM marketing.campanhas c LEFT JOIN marketing.gastos_diarios g ON g.campanha_id=c.id AND g.dia BETWEEN $1 AND $2 AND g.moeda='BRL' GROUP BY c.id ORDER BY c.id`,
        [f.de, f.ate],
      )
    ).rows;
    const dados = campanhas.map((c) => {
      const vs = vendas.filter((v) => v.campanha_id === c.id),
        receita = vs.reduce((s, v) => s + BigInt(v.receita), 0n),
        liquida = vs.reduce((s, v) => s + BigInt(v.liquida), 0n),
        novos = BigInt(new Set(vs.flatMap((v) => v.compradores_novos)).size),
        gasto = f.produto || f.oferta || f.centro ? null : BigInt(c.gasto);
      return {
        campanha_id: c.id,
        nome: c.nome,
        gasto: gasto?.toString() ?? null,
        receita: receita.toString(),
        liquida: liquida.toString(),
        novos: novos.toString(),
        roas: gasto === null || gasto === 0n ? null : Number((receita * 10000n) / gasto) / 10000,
        cac: gasto === null || novos === 0n ? null : (gasto / novos).toString(),
        margem_pos_aquisicao: gasto === null ? null : (liquida - gasto).toString(),
      };
    });
    return {
      campanhas: dados,
      produtos: vendas.map(({ compradores_novos, ...dados }) => ({
        ...dados,
        novos: String(compradores_novos.length),
      })),
      nao_atribuida: vendas
        .filter((v) => v.campanha_id === null)
        .reduce((s, v) => s + BigInt(v.receita), 0n)
        .toString(),
      aviso:
        "ROAS nao e lucro. Atribuicao exata por id, nome unico ou meta:<id> em sck/origem; ambiguidade fica nao atribuida. Gasto sem alocacao por produto/oferta/centro nao e rateado. CAC de novos compradores segundo a primeira compra conhecida.",
    };
  }
  async alertar(f: FiltroGestao, limite = 1) {
    if (!Number.isFinite(limite) || limite < 0 || limite > 100)
      throw new Error("limite ROAS invalido");
    return this.gestao.repo.transacao(async (c) => {
      const dados = await this.consultar(f, c);
      let criados = 0;
      for (const row of dados.campanhas)
        if (
          row.margem_pos_aquisicao !== null &&
          (BigInt(row.margem_pos_aquisicao) < 0n || (row.roas !== null && row.roas < limite))
        ) {
          if (
            await this.gestao.repo.alertas.criar(
              {
                tipo: "campanha_ruim",
                chave: `campanha:${row.campanha_id}:${f.de}:${f.ate}`,
                referenciaTabela: "campanhas",
                referenciaId: row.campanha_id,
              },
              c,
            )
          )
            criados++;
        }
      return { criados };
    });
  }
}
