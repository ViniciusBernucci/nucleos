import type {
  GrupoStatusVenda,
  IndicadoresVendas,
  StatusSincronizacao,
  VendaResumo,
} from "@nucleos/contracts";
import type { Pool } from "pg";
import type { Venda } from "./dominio.js";
import { FUSO } from "./periodo.js";
import type {
  AgregadosVendas,
  EstadoSincronizacaoBanco,
  FiltroVendas,
  RepositorioVendas,
  ResultadoComLock,
} from "./repositorio.js";

/** Chave do advisory lock que impede duas sincronizacoes simultaneas (entre instancias). */
const LOCK_SINCRONIZACAO = 7_315_001;

/** Filtro por periodo (dias no fuso do negocio), moeda e produto opcional. */
const ONDE = `
  pedido_em >= ($1::date)::timestamp AT TIME ZONE '${FUSO}'
  AND pedido_em < (($2::date + 1))::timestamp AT TIME ZONE '${FUSO}'
  AND moeda = $3
  AND ($4::text IS NULL OR produto_id = $4)`;

function parametros(f: FiltroVendas): [string, string, string, string | null] {
  return [f.de, f.ate, f.moeda, f.produtoId ?? null];
}

const num = (v: unknown): number => Number(v ?? 0);

function indicadoresDe(linha: Record<string, unknown>): IndicadoresVendas {
  const receita = num(linha["receita"]);
  const taxas = num(linha["taxas"]);
  const vendas = num(linha["vendas"]);
  const reembolsos = num(linha["reembolsos"]);
  return {
    receitaBrutaCentavos: receita,
    taxasCentavos: taxas,
    receitaLiquidaCentavos: receita - taxas,
    vendas,
    ticketMedioCentavos: vendas === 0 ? 0 : Math.round(receita / vendas),
    compradoresUnicos: num(linha["compradores"]),
    reembolsadoCentavos: num(linha["reembolsado"]),
    reembolsos,
    taxaReembolso: vendas + reembolsos === 0 ? 0 : reembolsos / (vendas + reembolsos),
    vendasAssinatura: num(linha["assinaturas"]),
  };
}

const SQL_INDICADORES = `
  SELECT
    COALESCE(SUM(valor_centavos) FILTER (WHERE grupo = 'receita'), 0) AS receita,
    COALESCE(SUM(taxa_centavos)  FILTER (WHERE grupo = 'receita'), 0) AS taxas,
    COUNT(*) FILTER (WHERE grupo = 'receita') AS vendas,
    COUNT(DISTINCT comprador_id) FILTER (WHERE grupo = 'receita') AS compradores,
    COALESCE(SUM(valor_centavos) FILTER (WHERE grupo = 'reembolso'), 0) AS reembolsado,
    COUNT(*) FILTER (WHERE grupo = 'reembolso') AS reembolsos,
    COUNT(*) FILTER (WHERE grupo = 'receita' AND assinatura) AS assinaturas
  FROM financeiro.vendas WHERE ${ONDE}`;

export class RepositorioVendasPg implements RepositorioVendas {
  constructor(private readonly pool: Pool) {}

  async gravarVendas(vendas: readonly Venda[]): Promise<number> {
    const unicas = [...new Map(vendas.map((v) => [v.transacao, v])).values()];
    if (unicas.length === 0) return 0;
    await this.pool.query(
      `INSERT INTO financeiro.vendas
         (transacao, produto_id, produto_nome, comprador_id, status, grupo, pedido_em, aprovado_em,
          valor_centavos, taxa_centavos, moeda, pagamento, parcelas, assinatura, recorrencia)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
         $7::timestamptz[], $8::timestamptz[], $9::bigint[], $10::bigint[], $11::char(3)[],
         $12::text[], $13::integer[], $14::boolean[], $15::integer[])
       ON CONFLICT (transacao) DO UPDATE SET
         produto_id = EXCLUDED.produto_id, produto_nome = EXCLUDED.produto_nome,
         comprador_id = EXCLUDED.comprador_id, status = EXCLUDED.status, grupo = EXCLUDED.grupo,
         pedido_em = EXCLUDED.pedido_em, aprovado_em = EXCLUDED.aprovado_em,
         valor_centavos = EXCLUDED.valor_centavos, taxa_centavos = EXCLUDED.taxa_centavos,
         moeda = EXCLUDED.moeda, pagamento = EXCLUDED.pagamento, parcelas = EXCLUDED.parcelas,
         assinatura = EXCLUDED.assinatura, recorrencia = EXCLUDED.recorrencia,
         sincronizado_em = now()`,
      [
        unicas.map((v) => v.transacao),
        unicas.map((v) => v.produtoId),
        unicas.map((v) => v.produtoNome),
        unicas.map((v) => v.compradorId),
        unicas.map((v) => v.status),
        unicas.map((v) => v.grupo),
        unicas.map((v) => v.pedidoEm),
        unicas.map((v) => v.aprovadoEm),
        unicas.map((v) => v.valorCentavos),
        unicas.map((v) => v.taxaCentavos),
        unicas.map((v) => v.moeda),
        unicas.map((v) => v.pagamento),
        unicas.map((v) => v.parcelas),
        unicas.map((v) => v.assinatura),
        unicas.map((v) => v.recorrencia),
      ],
    );
    return unicas.length;
  }

  async lerEstadoSincronizacao(): Promise<EstadoSincronizacaoBanco> {
    const { rows } = await this.pool.query(
      `SELECT status, ultima_tentativa_em, ultimo_sucesso_em, ultima_reconciliacao_em,
              vendas_processadas, mensagem
         FROM financeiro.sincronizacao_estado WHERE id = 1`,
    );
    const r = (rows[0] ?? {}) as Record<string, unknown>;
    return {
      status: (r["status"] as StatusSincronizacao | undefined) ?? "nunca",
      ultimaTentativaEm: (r["ultima_tentativa_em"] as Date | null | undefined) ?? null,
      ultimoSucessoEm: (r["ultimo_sucesso_em"] as Date | null | undefined) ?? null,
      ultimaReconciliacaoEm: (r["ultima_reconciliacao_em"] as Date | null | undefined) ?? null,
      vendasProcessadas: num(r["vendas_processadas"]),
      mensagem: (r["mensagem"] as string | null | undefined) ?? null,
    };
  }

  async salvarEstadoSincronizacao(p: Partial<EstadoSincronizacaoBanco>): Promise<void> {
    // COALESCE nos campos nao informados; `mensagem` aceita null explicito (limpa o aviso).
    await this.pool.query(
      `UPDATE financeiro.sincronizacao_estado SET
         status = COALESCE($1, status),
         ultima_tentativa_em = COALESCE($2, ultima_tentativa_em),
         ultimo_sucesso_em = COALESCE($3, ultimo_sucesso_em),
         ultima_reconciliacao_em = COALESCE($4, ultima_reconciliacao_em),
         vendas_processadas = COALESCE($5, vendas_processadas),
         mensagem = CASE WHEN $6::boolean THEN $7 ELSE mensagem END
       WHERE id = 1`,
      [
        p.status ?? null,
        p.ultimaTentativaEm ?? null,
        p.ultimoSucessoEm ?? null,
        p.ultimaReconciliacaoEm ?? null,
        p.vendasProcessadas ?? null,
        p.mensagem !== undefined,
        p.mensagem ?? null,
      ],
    );
  }

  async comLockDeSincronizacao<T>(fn: () => Promise<T>): Promise<ResultadoComLock<T>> {
    const conexao = await this.pool.connect();
    try {
      const { rows } = await conexao.query("SELECT pg_try_advisory_lock($1) AS ok", [
        LOCK_SINCRONIZACAO,
      ]);
      if ((rows[0] as { ok: boolean } | undefined)?.ok !== true) return { ocupado: true };
      try {
        return { ocupado: false, valor: await fn() };
      } finally {
        await conexao.query("SELECT pg_advisory_unlock($1)", [LOCK_SINCRONIZACAO]);
      }
    } finally {
      conexao.release();
    }
  }

  async indicadores(filtro: FiltroVendas): Promise<IndicadoresVendas> {
    const { rows } = await this.pool.query(SQL_INDICADORES, parametros(filtro));
    return indicadoresDe((rows[0] ?? {}) as Record<string, unknown>);
  }

  async agregados(filtro: FiltroVendas): Promise<AgregadosVendas> {
    const p = parametros(filtro);
    const [indicadores, serie, produtos, status, pagamentos] = await Promise.all([
      this.indicadores(filtro),
      this.pool.query(
        `SELECT to_char((pedido_em AT TIME ZONE '${FUSO}')::date, 'YYYY-MM-DD') AS dia,
                SUM(valor_centavos) AS receita, COUNT(*) AS vendas
           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
          GROUP BY 1 ORDER BY 1`,
        p,
      ),
      this.pool.query(
        `SELECT produto_id, (array_agg(produto_nome ORDER BY pedido_em DESC))[1] AS produto_nome,
                SUM(valor_centavos) AS receita, COUNT(*) AS vendas
           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
          GROUP BY produto_id ORDER BY receita DESC, produto_id LIMIT 10`,
        p,
      ),
      this.pool.query(
        `SELECT status, grupo, COUNT(*) AS vendas, SUM(valor_centavos) AS valor
           FROM financeiro.vendas WHERE ${ONDE}
          GROUP BY status, grupo ORDER BY vendas DESC, status`,
        p,
      ),
      this.pool.query(
        `SELECT pagamento, SUM(valor_centavos) AS receita, COUNT(*) AS vendas
           FROM financeiro.vendas WHERE ${ONDE} AND grupo = 'receita'
          GROUP BY pagamento ORDER BY receita DESC, pagamento`,
        p,
      ),
    ]);
    return {
      indicadores,
      serieDiaria: serie.rows.map((r: Record<string, unknown>) => ({
        dia: String(r["dia"]),
        receitaCentavos: num(r["receita"]),
        vendas: num(r["vendas"]),
      })),
      porProduto: produtos.rows.map((r: Record<string, unknown>) => ({
        produtoId: String(r["produto_id"]),
        produtoNome: String(r["produto_nome"]),
        receitaCentavos: num(r["receita"]),
        vendas: num(r["vendas"]),
      })),
      porStatus: status.rows.map((r: Record<string, unknown>) => ({
        status: String(r["status"]),
        grupo: r["grupo"] as GrupoStatusVenda,
        vendas: num(r["vendas"]),
        valorCentavos: num(r["valor"]),
      })),
      porPagamento: pagamentos.rows.map((r: Record<string, unknown>) => ({
        tipo: String(r["pagamento"]),
        vendas: num(r["vendas"]),
        receitaCentavos: num(r["receita"]),
      })),
    };
  }

  async moedasDisponiveis(): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT moeda FROM financeiro.vendas GROUP BY moeda ORDER BY SUM(valor_centavos) DESC, moeda`,
    );
    return rows.map((r: { moeda: string }) => r.moeda);
  }

  async produtosDisponiveis(): Promise<{ produtoId: string; produtoNome: string }[]> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (produto_id) produto_id, produto_nome
         FROM financeiro.vendas ORDER BY produto_id, pedido_em DESC`,
    );
    return (rows as { produto_id: string; produto_nome: string }[])
      .map((r) => ({ produtoId: r.produto_id, produtoNome: r.produto_nome }))
      .sort((a, b) => a.produtoNome.localeCompare(b.produtoNome, "pt-BR"));
  }

  async listar(
    filtro: FiltroVendas,
    limite: number,
    deslocamento: number,
  ): Promise<{ itens: VendaResumo[]; total: number }> {
    const { rows } = await this.pool.query(
      `SELECT transacao, produto_nome, comprador_id, status, grupo, pedido_em, valor_centavos,
              taxa_centavos, moeda, pagamento, parcelas, assinatura, COUNT(*) OVER () AS total
         FROM financeiro.vendas WHERE ${ONDE}
        ORDER BY pedido_em DESC, transacao LIMIT $5 OFFSET $6`,
      [...parametros(filtro), limite, deslocamento],
    );
    const linhas = rows as Record<string, unknown>[];
    return {
      total: linhas.length === 0 ? 0 : num(linhas[0]?.["total"]),
      itens: linhas.map((r) => ({
        transacao: String(r["transacao"]),
        produtoNome: String(r["produto_nome"]),
        compradorId: String(r["comprador_id"]),
        status: String(r["status"]),
        grupo: r["grupo"] as GrupoStatusVenda,
        pedidoEm: (r["pedido_em"] as Date).toISOString(),
        valorCentavos: num(r["valor_centavos"]),
        taxaCentavos: num(r["taxa_centavos"]),
        moeda: String(r["moeda"]).trim(),
        pagamento: String(r["pagamento"]),
        parcelas: num(r["parcelas"]),
        assinatura: r["assinatura"] === true,
      })),
    };
  }
}
