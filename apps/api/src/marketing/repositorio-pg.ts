import type { Pool } from "pg";
import type { CampanhaMeta, GastoMeta } from "./meta-client.js";

export interface CampanhaLeitura {
  id: string;
  conta_anuncio_id: string;
  id_externo: string;
  nome: string;
  status: string | null;
  objetivo: string | null;
}
export interface GastoLeitura {
  campanha_id: string;
  campanha_id_externo: string;
  campanha_nome: string;
  dia: string;
  moeda: string;
  gasto_centavos: string;
  impressoes: string;
  cliques: string;
  compras_meta: string;
  valor_compras_meta_centavos: string;
  tipo_compra_meta: string | null;
}
export class RepositorioMarketingPg {
  constructor(readonly pool: Pool) {}
  async salvar(
    contaId: string,
    campanhas: CampanhaMeta[],
    gastos: GastoMeta[],
    verificar: () => Promise<boolean>,
  ): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      // Serializa execuções concorrentes da mesma conta antes dos upserts.
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`meta-ads:${contaId}`]);
      if (!(await verificar())) throw new Error("Meta Ads: lease perdida.");
      const conta = (
        await c.query<{ id: string }>(
          `INSERT INTO marketing.contas_anuncio(id_externo,moeda) VALUES($1,'BRL') ON CONFLICT(id_externo) DO UPDATE SET moeda=excluded.moeda,atualizado_em=now() RETURNING id`,
          [contaId],
        )
      ).rows[0];
      if (conta === undefined) throw new Error("Meta Ads: conta indisponivel.");
      const ids = new Map<string, string>();
      for (const campanha of campanhas) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO marketing.campanhas(conta_anuncio_id,id_externo,nome,status,objetivo) VALUES($1,$2,$3,$4,$5) ON CONFLICT(conta_anuncio_id,id_externo) DO UPDATE SET nome=excluded.nome,status=excluded.status,objetivo=excluded.objetivo,atualizado_em=now() RETURNING id`,
          [conta.id, campanha.id, campanha.nome, campanha.status, campanha.objetivo],
        );
        ids.set(campanha.id, r.rows[0]?.id ?? "");
      }
      for (const g of gastos) {
        let id = ids.get(g.campanhaId);
        if (id === undefined) {
          // Insights podem conter uma campanha arquivada ausente do catálogo corrente.
          const r = await c.query<{ id: string }>(
            `INSERT INTO marketing.campanhas(conta_anuncio_id,id_externo,nome) VALUES($1,$2,$3) ON CONFLICT(conta_anuncio_id,id_externo) DO UPDATE SET nome=excluded.nome,atualizado_em=now() RETURNING id`,
            [conta.id, g.campanhaId, g.nome],
          );
          id = r.rows[0]?.id;
          if (id === undefined) throw new Error("Meta Ads: campanha indisponivel.");
          ids.set(g.campanhaId, id);
        }
        await c.query(
          `INSERT INTO marketing.gastos_diarios(campanha_id,dia,gasto_centavos,moeda,impressoes,cliques,compras_meta,valor_compras_meta_centavos,tipo_compra_meta) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(campanha_id,dia) DO UPDATE SET gasto_centavos=excluded.gasto_centavos,moeda=excluded.moeda,impressoes=excluded.impressoes,cliques=excluded.cliques,compras_meta=excluded.compras_meta,valor_compras_meta_centavos=excluded.valor_compras_meta_centavos,tipo_compra_meta=excluded.tipo_compra_meta,atualizado_em=now()`,
          [
            id,
            g.dia,
            g.gastoCentavos,
            g.moeda,
            g.impressoes,
            g.cliques,
            g.comprasMeta,
            g.valorComprasMetaCentavos,
            g.tipoCompraMeta,
          ],
        );
      }
      if (!(await verificar())) throw new Error("Meta Ads: lease perdida.");
      await c.query("COMMIT");
    } catch {
      await c.query("ROLLBACK");
      throw new Error("Meta Ads: importacao nao persistida.");
    } finally {
      c.release();
    }
  }
  async campanhas(): Promise<CampanhaLeitura[]> {
    return (
      await this.pool.query<CampanhaLeitura>(
        "SELECT id::text,conta_anuncio_id::text,id_externo,nome,status,objetivo FROM marketing.campanhas ORDER BY id",
      )
    ).rows;
  }
  async gastos(de: string, ate: string): Promise<GastoLeitura[]> {
    return (
      await this.pool.query<GastoLeitura>(
        `SELECT g.campanha_id::text,c.id_externo campanha_id_externo,c.nome campanha_nome,to_char(g.dia,'YYYY-MM-DD') dia,g.moeda,g.gasto_centavos::text,g.impressoes::text,g.cliques::text,g.compras_meta::text,g.valor_compras_meta_centavos::text,g.tipo_compra_meta FROM marketing.gastos_diarios g JOIN marketing.campanhas c ON c.id=g.campanha_id WHERE dia BETWEEN $1::date AND $2::date ORDER BY dia,c.id`,
        [de, ate],
      )
    ).rows;
  }
}
