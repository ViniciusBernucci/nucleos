import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { centavos, id, texto } from "./importacao.js";
type Item = {
  tipo: "saque" | "conta_pagar" | "extrato_item" | "venda" | "lancamento";
  referenciaId: string;
  valorCentavos: string;
};
export class ConciliacaoFinanceira {
  constructor(readonly repo: RepositorioFinanceiroPg) {}
  async sugerir(c: PoolClient): Promise<number> {
    const origens = await c.query<{
      tipo: "saque" | "conta_pagar";
      id: string;
      valor: string;
      data: string;
      conta: string;
    }>(`
      SELECT 'saque' tipo,id,liquido_centavos::text valor,data::text data,conta_destino_id::text conta FROM financeiro.saques_hotmart
      UNION ALL SELECT 'conta_pagar',p.id,(-p.valor_centavos)::text,l.data::text,l.conta_financeira_id::text
      FROM financeiro.contas_pagar p JOIN financeiro.lancamentos l ON l.conta_pagar_id=p.id WHERE p.status='paga'`);
    let novas = 0;
    for (const origem of origens.rows) {
      const candidatos = await c.query<{ id: string; valor_centavos: string }>(
        `SELECT id,valor_centavos FROM financeiro.extrato_itens
        WHERE NOT conciliado AND conta_financeira_id=$1 AND valor_centavos=$2 AND data BETWEEN $3::date-3 AND $3::date+3 ORDER BY id`,
        [origem.conta, origem.valor, origem.data],
      );
      const estado = candidatos.rowCount === 1 ? "conciliada" : "pendente_analise";
      const r = await c.query<{ id: string }>(
        `INSERT INTO financeiro.conciliacoes(estado,chave) VALUES($1,$2)
        ON CONFLICT(chave) WHERE NOT desfeita AND NOT recusada DO NOTHING RETURNING id`,
        [estado, origem.tipo + ":" + origem.id],
      );
      const cid = r.rows[0]?.id;
      if (!cid) continue;
      novas++;
      await c.query(
        "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,$2,$3,$4)",
        [cid, origem.tipo, origem.id, origem.valor],
      );
      // A unique exact match is only a suggestion; accepting still rechecks ownership.
      if (candidatos.rowCount === 1)
        await c.query(
          "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,'extrato_item',$2,$3)",
          [cid, candidatos.rows[0]?.id, candidatos.rows[0]?.valor_centavos],
        );
      else
        await this.repo.alertas.criar(
          {
            tipo: "divergencia_conciliacao",
            chave: "conciliacao:" + cid,
            referenciaTabela: "conciliacoes",
            referenciaId: cid,
          },
          c,
        );
    }
    const divergentes = await c.query<{ transacao: string; diferenca: string }>(
      "SELECT transacao,(liquido_centavos-(valor_centavos-taxa_centavos-comissoes_centavos))::text diferenca FROM financeiro.vendas WHERE liquido_centavos<>valor_centavos-taxa_centavos-comissoes_centavos",
    );
    for (const v of divergentes.rows)
      await this.repo.alertas.criar(
        {
          tipo: "divergencia_conciliacao",
          chave: "venda-inconsistente:" + v.transacao,
          referenciaTabela: "vendas",
          referenciaId: v.transacao,
        },
        c,
      );
    // Compare like periods in BRL; this is not the platform's available balance.
    const periodos = await c.query<{ periodo: string; vendido: string; sacado: string }>(`
      WITH vendas AS (
        SELECT date_trunc('month',coalesce(aprovado_em,pedido_em) AT TIME ZONE 'America/Sao_Paulo')::date mes,
        sum(liquido_centavos) valor FROM financeiro.vendas WHERE grupo='receita' AND moeda='BRL' GROUP BY 1
      ), saques AS (
        SELECT date_trunc('month',data)::date mes,sum(bruto_centavos) valor FROM financeiro.saques_hotmart GROUP BY 1
      )
      SELECT to_char(coalesce(v.mes,s.mes),'YYYY-MM') periodo,coalesce(v.valor,0)::text vendido,
        coalesce(s.valor,0)::text sacado FROM vendas v FULL JOIN saques s ON s.mes=v.mes`);
    for (const saldo of periodos.rows) {
      const diferenca = BigInt(saldo.vendido) - BigInt(saldo.sacado);
      if (diferenca === 0n) continue;
      const chave = "hotmart-periodo:" + saldo.periodo;
      const resumo = await c.query<{ id: string }>(
        `INSERT INTO financeiro.conciliacoes(estado,chave,diferenca_centavos,observacao)
        VALUES('parcial',$1,$2,'Receitas liquidas BRL e saques do mesmo mes; saldo nao representa disponibilidade.')
        ON CONFLICT(chave) WHERE NOT desfeita AND NOT recusada DO UPDATE SET diferenca_centavos=excluded.diferenca_centavos
        RETURNING id`,
        [chave, diferenca.toString()],
      );
      const cid = resumo.rows[0]?.id;
      if (cid)
        await this.repo.alertas.criar(
          {
            tipo: "divergencia_conciliacao",
            chave: "resumo:" + cid,
            referenciaTabela: "conciliacoes",
            referenciaId: cid,
          },
          c,
        );
    }
    return novas;
  }
  async listar(): Promise<unknown> {
    return (
      await this.repo.pool
        .query(`SELECT c.*,coalesce(jsonb_agg(jsonb_build_object('tipo',i.tipo,'referenciaId',i.referencia_id,'valorCentavos',i.valor_centavos::text)) FILTER(WHERE i.id IS NOT NULL),'[]') itens
      FROM financeiro.conciliacoes c LEFT JOIN financeiro.conciliacao_itens i ON i.conciliacao_id=c.id
      GROUP BY c.id ORDER BY c.id DESC LIMIT 500`)
    ).rows;
  }
  async manual(p: Record<string, unknown>): Promise<unknown> {
    if (!Array.isArray(p["itens"]) || p["itens"].length < 2 || p["itens"].length > 100)
      throw new BadRequestException("itens invalidos");
    const itens: Item[] = p["itens"].map((v: unknown) => {
      if (typeof v !== "object" || v === null) throw new BadRequestException();
      const i = v as Record<string, unknown>,
        tipo = String(i["tipo"]) as Item["tipo"];
      if (!["saque", "conta_pagar", "extrato_item", "venda", "lancamento"].includes(tipo))
        throw new BadRequestException();
      return {
        tipo,
        referenciaId: tipo === "venda" ? texto(i["referenciaId"], 100) : id(i["referenciaId"]),
        valorCentavos: centavos(i["valorCentavos"], true),
      };
    });
    return this.repo.transacao(async (c) => {
      for (const i of itens) await this.validarItem(c, i);
      const origens = itens
        .filter((i) => i.tipo !== "extrato_item")
        .reduce((n, i) => n + BigInt(i.valorCentavos), 0n);
      const extratos = itens
        .filter((i) => i.tipo === "extrato_item")
        .reduce((n, i) => n + BigInt(i.valorCentavos), 0n);
      const diferenca = origens - extratos;
      const r = await c.query<{ id: string }>(
        "INSERT INTO financeiro.conciliacoes(estado,chave,diferenca_centavos,observacao) VALUES($1,$2,$3,$4) RETURNING id",
        [
          diferenca === 0n ? "conciliada" : "parcial",
          "manual:" + randomUUID(),
          diferenca.toString(),
          p["observacao"] ? texto(p["observacao"], 500) : "",
        ],
      );
      const cid = r.rows[0]?.id;
      for (const i of itens)
        await c.query(
          "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,$2,$3,$4)",
          [cid, i.tipo, i.referenciaId, i.valorCentavos],
        );
      return { id: cid };
    });
  }
  private async validarItem(c: PoolClient, i: Item): Promise<void> {
    // Query table/columns come only from the closed discriminator above.
    const queries: Record<Item["tipo"], string> = {
      saque: "SELECT liquido_centavos::text valor FROM financeiro.saques_hotmart WHERE id=$1",
      conta_pagar:
        "SELECT (-valor_centavos)::text valor FROM financeiro.contas_pagar WHERE id=$1 AND status='paga'",
      extrato_item:
        "SELECT valor_centavos::text valor FROM financeiro.extrato_itens WHERE id=$1 FOR UPDATE",
      venda:
        "SELECT liquido_centavos::text valor FROM financeiro.vendas WHERE transacao=$1 AND moeda='BRL'",
      lancamento:
        "SELECT (CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text valor FROM financeiro.lancamentos WHERE id=$1",
    };
    const r = await c.query<{ valor: string }>(queries[i.tipo], [i.referenciaId]);
    if (!r.rows[0] || BigInt(r.rows[0].valor) !== BigInt(i.valorCentavos))
      throw new BadRequestException("item ou valor divergente");
  }
  async agir(cid: string, acao: string): Promise<void> {
    id(cid);
    if (!["aceitar", "recusar", "desfazer"].includes(acao))
      throw new BadRequestException("acao invalida");
    await this.repo.transacao(async (c) => {
      // Global reconciliation lock gives deterministic exclusion across overlapping suggestions.
      await c.query("SELECT pg_advisory_xact_lock(7315090)");
      const r = await c.query<{
        aceita: boolean;
        desfeita: boolean;
        recusada: boolean;
        estado: string;
      }>("SELECT * FROM financeiro.conciliacoes WHERE id=$1 FOR UPDATE", [cid]);
      const v = r.rows[0];
      if (!v) throw new NotFoundException();
      if (v.desfeita || v.recusada) throw new ConflictException("conciliacao encerrada");
      const itens = await c.query<{
        tipo: Item["tipo"];
        referencia_id: string;
        valor_centavos: string;
      }>(
        "SELECT tipo,referencia_id,valor_centavos FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 ORDER BY tipo,referencia_id",
        [cid],
      );
      if (acao === "aceitar") {
        if (v.aceita || v.estado === "pendente_analise" || itens.rows.length < 2)
          throw new ConflictException("revise os itens manualmente");
        for (const i of itens.rows) {
          await this.validarItem(c, {
            tipo: i.tipo,
            referenciaId: i.referencia_id,
            valorCentavos: i.valor_centavos,
          });
          if (
            (
              await c.query(
                `SELECT i.id FROM financeiro.conciliacao_itens i JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id
            WHERE i.tipo=$1 AND i.referencia_id=$2 AND c.aceita AND NOT c.desfeita`,
                [i.tipo, i.referencia_id],
              )
            ).rowCount
          )
            throw new ConflictException("item ja conciliado");
        }
        await c.query(
          "UPDATE financeiro.extrato_itens SET conciliado=true WHERE id::text IN (SELECT referencia_id FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 AND tipo='extrato_item')",
          [cid],
        );
        await c.query(
          "UPDATE financeiro.conciliacoes SET aceita=true,atualizada_em=now() WHERE id=$1",
          [cid],
        );
      } else if (acao === "recusar") {
        if (v.aceita) throw new ConflictException("desfaca antes de recusar");
        await c.query(
          "UPDATE financeiro.conciliacoes SET recusada=true,atualizada_em=now() WHERE id=$1",
          [cid],
        );
      } else {
        if (!v.aceita) throw new ConflictException("conciliacao nao aceita");
        await c.query(
          "UPDATE financeiro.extrato_itens SET conciliado=false WHERE id::text IN (SELECT referencia_id FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 AND tipo='extrato_item')",
          [cid],
        );
        await c.query(
          "UPDATE financeiro.conciliacoes SET desfeita=true,atualizada_em=now() WHERE id=$1",
          [cid],
        );
      }
      await this.repo.mudou(c);
    });
  }
}
