import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { ContextoHandler } from "../funcionarios/handlers.js";
import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
import { dia, id, texto } from "./importacao.js";

export interface FiltroGestao {
  de: string;
  ate: string;
  produto: string | null;
  oferta: string | null;
  centro: string | null;
}
export function filtroGestao(f: Record<string, unknown>): FiltroGestao {
  const hoje = hojeLocal();
  const de = dia(f["de"] ?? hoje.slice(0, 7) + "-01"),
    ate = dia(f["ate"] ?? hoje);
  if (de > ate || Date.parse(ate) - Date.parse(de) > 366 * 86400000)
    throw new BadRequestException("periodo deve conter ate 366 dias");
  return {
    de,
    ate,
    produto: f["produto"] ? texto(f["produto"], 100) : null,
    oferta: f["oferta"] ? texto(f["oferta"], 100) : null,
    centro: f["centro"] ? id(f["centro"]) : null,
  };
}
export interface MesGestao {
  mes: string;
  bruta: string;
  reembolsos: string;
  impostos: string;
  liquida: string;
  taxas: string;
  comissoes: string;
  midia: string;
  variaveis: string;
  fixas: string;
  nao_classificado: string;
  despesas: string;
  resultado: string;
  contribuicao: string;
  vendas: string;
  margem_pct: number | null;
}
function hojeLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function calcularMes(
  m: Omit<MesGestao, "liquida" | "despesas" | "resultado" | "contribuicao" | "margem_pct">,
): MesGestao {
  const liquida = BigInt(m.bruta) - BigInt(m.reembolsos) - BigInt(m.impostos);
  const despesas =
    BigInt(m.taxas) +
    BigInt(m.comissoes) +
    BigInt(m.midia) +
    BigInt(m.variaveis) +
    BigInt(m.fixas) +
    BigInt(m.nao_classificado);
  const resultado = liquida - despesas;
  return {
    ...m,
    liquida: liquida.toString(),
    despesas: despesas.toString(),
    resultado: resultado.toString(),
    contribuicao: (
      liquida -
      BigInt(m.taxas) -
      BigInt(m.comissoes) -
      BigInt(m.midia) -
      BigInt(m.variaveis)
    ).toString(),
    margem_pct: liquida === 0n ? null : Number((resultado * 10000n) / liquida) / 100,
  };
}
export function csvSeguro(linhas: unknown[][]): string {
  return (
    "\uFEFF" +
    linhas
      .map((l) =>
        l
          .map((x) => {
            if (
              x !== null &&
              x !== undefined &&
              typeof x !== "string" &&
              typeof x !== "number" &&
              typeof x !== "bigint" &&
              typeof x !== "boolean"
            )
              throw new BadRequestException("celula CSV invalida");
            let t = String(x ?? "");
            if (/^[\s]*[=+@-]/.test(t) && !/^-[0-9]+$/.test(t)) t = "'" + t;
            return '"' + t.replaceAll('"', '""') + '"';
          })
          .join(";"),
      )
      .join("\r\n")
  );
}

export class GestaoFinanceira {
  constructor(readonly repo: RepositorioFinanceiroPg) {
    for (const chave of [
      "atualizar_indicadores",
      "calcular_dre",
      "monitorar_caixa",
      "detectar_anomalias",
    ]) {
      repo.motor.registro.registrar({
        chave: `financeiro.${chave}`,
        validarConfig: (c) =>
          Object.keys(c).every((k) =>
            ["minimoCentavos", "aumentoDespesaPct", "quedaMargemPp", "reembolsoPct"].includes(k),
          ),
        executar: (ctx) => this.executar(chave, ctx),
      });
    }
  }
  async meses(
    f: FiltroGestao,
    c: PoolClient | RepositorioFinanceiroPg["pool"] = this.repo.pool,
  ): Promise<MesGestao[]> {
    // A competencia das despesas e mensal. Compara meses completos, sem rateio diario.
    const fimMes = new Date(f.ate.slice(0, 7) + "-01T12:00:00Z");
    fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);
    fimMes.setUTCDate(0);
    const deCompetencia = f.de.slice(0, 7) + "-01",
      ateCompetencia = fimMes.toISOString().slice(0, 10);
    const p = [deCompetencia, ateCompetencia, f.produto, f.oferta, f.centro];
    // Vendas nao possuem alocacao por centro de custo. Um recorte por centro nao recebe rateio.
    const vendas = (
      await c.query<{
        mes: string;
        bruta: string;
        reembolsos: string;
        taxas: string;
        comissoes: string;
        vendas: string;
      }>(
        `SELECT to_char(pedido_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') mes,
      coalesce(sum(valor_centavos) FILTER(WHERE grupo IN ('receita','reembolso','contestada')),0)::text bruta,
      coalesce(sum(valor_centavos) FILTER(WHERE grupo IN ('reembolso','contestada')),0)::text reembolsos,
      coalesce(sum(taxa_centavos) FILTER(WHERE grupo='receita'),0)::text taxas,
      coalesce(sum(comissoes_centavos) FILTER(WHERE grupo='receita'),0)::text comissoes,
      count(*) FILTER(WHERE grupo='receita')::text vendas FROM financeiro.vendas
      WHERE moeda='BRL' AND (pedido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date
      AND ($3::text IS NULL OR produto_id=$3) AND ($4::text IS NULL OR oferta_codigo=$4) AND $5::text IS NULL GROUP BY 1`,
        p,
      )
    ).rows;
    const despesas = (
      await c.query<{ mes: string; linha: string; valor: string }>(
        `WITH despesas AS (
      SELECT competencia,data,valor_centavos,categoria,centro_custo_id FROM (
        SELECT competencia,vencimento data,valor_centavos,categoria,centro_custo_id FROM financeiro.contas_pagar WHERE status<>'cancelada'
        UNION ALL SELECT data,data,valor_centavos,categoria,centro_custo_id FROM financeiro.lancamentos WHERE tipo='saida' AND conta_pagar_id IS NULL AND transferencia_id IS NULL
      ) x)
      SELECT to_char(d.competencia,'YYYY-MM') mes,coalesce(cat.linha_dre,'nao_classificado') linha,sum(d.valor_centavos)::text valor
      FROM despesas d LEFT JOIN financeiro.categorias cat ON cat.tipo='saida' AND lower(cat.nome)=lower(d.categoria)
      WHERE d.competencia BETWEEN $1::date AND $2::date AND $3::text IS NULL AND $4::text IS NULL
      AND ($5::bigint IS NULL OR d.centro_custo_id=$5) AND NOT coalesce(cat.excluir_da_dre,false) GROUP BY 1,2`,
        p,
      )
    ).rows;
    const midia =
      f.produto || f.oferta || f.centro
        ? []
        : (
            await c.query<{ mes: string; valor: string }>(
              "SELECT to_char(dia,'YYYY-MM') mes,sum(gasto_centavos)::text valor FROM marketing.gastos_diarios WHERE moeda='BRL' AND dia BETWEEN $1::date AND $2::date GROUP BY 1",
              [deCompetencia, ateCompetencia],
            )
          ).rows;
    const meses = new Map<string, MesGestao>();
    const inicio = new Date(f.de.slice(0, 7) + "-01T12:00:00Z");
    while (inicio.toISOString().slice(0, 10) <= f.ate) {
      const mes = inicio.toISOString().slice(0, 7);
      meses.set(
        mes,
        calcularMes({
          mes,
          bruta: "0",
          reembolsos: "0",
          taxas: "0",
          comissoes: "0",
          midia: "0",
          impostos: "0",
          variaveis: "0",
          fixas: "0",
          nao_classificado: "0",
          vendas: "0",
        }),
      );
      inicio.setUTCMonth(inicio.getUTCMonth() + 1);
    }
    for (const v of vendas) Object.assign(meses.get(v.mes) ?? {}, v);
    for (const d of despesas) {
      const m = meses.get(d.mes);
      if (m && ["impostos", "variaveis", "fixas", "nao_classificado"].includes(d.linha))
        Object.assign(m, { [d.linha]: d.valor });
    }
    for (const g of midia) {
      const m = meses.get(g.mes);
      if (m) m.midia = g.valor;
    }
    return [...meses.values()].map(calcularMes);
  }
  async indicadores(f: FiltroGestao) {
    const meses = await this.meses(f);
    const anterior = new Date(f.de.slice(0, 7) + "-01T12:00:00Z");
    anterior.setUTCDate(0);
    const mesAnterior = await this.meses({
      ...f,
      de: anterior.toISOString().slice(0, 7) + "-01",
      ate: anterior.toISOString().slice(0, 10),
    });
    const destaques = (
      await this.repo.pool.query<{
        vencidas: string;
        divergencias: string;
        alertas: string;
      }>(`SELECT
      (SELECT count(*)::text FROM financeiro.contas_pagar WHERE status='aberta' AND vencimento<current_date) vencidas,
      (SELECT count(*)::text FROM financeiro.conciliacoes WHERE estado<>'conciliada') divergencias,
      (SELECT count(*)::text FROM financeiro.alertas WHERE estado='aberto') alertas`)
    ).rows[0];
    return {
      moeda: "BRL",
      meses,
      mes_anterior: mesAnterior[0] ?? null,
      destaques,
      alocacao:
        f.produto || f.oferta || f.centro
          ? "Somente valores com alocacao conhecida; despesas e midia sem alocacao nao sao rateadas."
          : null,
    };
  }
  async cenarios() {
    return (
      await this.repo.pool.query<{
        codigo: string;
        realizacao_pct: number;
        reembolso_pct: number;
        variacao_despesas_pct: number;
      }>("SELECT * FROM financeiro.cenarios_caixa ORDER BY realizacao_pct")
    ).rows;
  }
  async salvarCenario(codigo: string, p: Record<string, unknown>) {
    if (!["conservador", "base", "otimista"].includes(codigo))
      throw new BadRequestException("cenario invalido");
    const valores = ["realizacao_pct", "reembolso_pct", "variacao_despesas_pct"].map((k, i) => {
      const n = Number(p[k]);
      if (!Number.isInteger(n) || n < (i === 2 ? -100 : 0) || n > (i === 2 ? 300 : 100))
        throw new BadRequestException("percentual invalido");
      return n;
    });
    await this.repo.pool.query(
      "UPDATE financeiro.cenarios_caixa SET realizacao_pct=$2,reembolso_pct=$3,variacao_despesas_pct=$4 WHERE codigo=$1",
      [codigo, ...valores],
    );
  }
  async mapear(p: Record<string, unknown>) {
    const categoria = id(p["categoriaId"]),
      linha = p["linha"] === null || p["linha"] === "" ? null : texto(p["linha"], 40);
    if (linha !== null && !["impostos", "variaveis", "fixas", "nao_classificado"].includes(linha))
      throw new BadRequestException("linha invalida");
    const resultado = await this.repo.pool.query(
      "UPDATE financeiro.categorias SET linha_dre=$2,excluir_da_dre=$3 WHERE id=$1 AND tipo='saida'",
      [categoria, linha, p["excluir"] === true],
    );
    if (resultado.rowCount === 0)
      throw new BadRequestException("categoria de despesa nao encontrada");
  }
  async mapeamento() {
    return (
      await this.repo.pool.query(
        "SELECT id::text,nome,linha_dre,excluir_da_dre FROM financeiro.categorias WHERE tipo='saida' ORDER BY nome",
      )
    ).rows as Record<string, unknown>[];
  }
  async fluxo(
    f: Record<string, unknown>,
    c: PoolClient | RepositorioFinanceiroPg["pool"] = this.repo.pool,
  ) {
    const de = dia(f["de"] ?? hojeLocal());
    const ate = dia(
      f["ate"] ?? new Date(Date.parse(de) + 89 * 86400000).toISOString().slice(0, 10),
    );
    if (de > ate || Date.parse(ate) - Date.parse(de) > 89 * 86400000)
      throw new BadRequestException("projecao limitada a 90 dias");
    const conta = f["conta"] ? id(f["conta"]) : null,
      grupo = f["grupo"] ?? "dia",
      codigo = f["cenario"] ?? "base";
    if (
      typeof grupo !== "string" ||
      !["dia", "semana", "mes"].includes(grupo) ||
      typeof codigo !== "string" ||
      !["conservador", "base", "otimista"].includes(codigo)
    )
      throw new BadRequestException("filtro invalido");
    const cen = (
      await c.query<{
        realizacao_pct: number;
        reembolso_pct: number;
        variacao_despesas_pct: number;
      }>("SELECT * FROM financeiro.cenarios_caixa WHERE codigo=$1", [codigo])
    ).rows[0];
    if (!cen) throw new BadRequestException("cenario indisponivel");
    const inicial =
      (
        await c.query<{ saldo: string }>(
          "SELECT coalesce(sum(CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END),0)::text saldo FROM financeiro.lancamentos WHERE data<$1 AND ($2::bigint IS NULL OR conta_financeira_id=$2)",
          [de, conta],
        )
      ).rows[0]?.saldo ?? "0";
    const dias = (
      await c.query<{
        dia: string;
        entradas: string;
        saidas: string;
        receber: string;
        pagar: string;
      }>(
        `SELECT to_char(d,'YYYY-MM-DD') dia,
      coalesce((SELECT sum(valor_centavos) FROM financeiro.lancamentos WHERE data=d AND tipo='entrada' AND ($3::bigint IS NULL OR conta_financeira_id=$3)),0)::text entradas,
      coalesce((SELECT sum(valor_centavos) FROM financeiro.lancamentos WHERE data=d AND tipo='saida' AND ($3::bigint IS NULL OR conta_financeira_id=$3)),0)::text saidas,
      coalesce((SELECT sum(valor_centavos) FROM financeiro.contas_receber WHERE previsto_em=d AND status='estimado' AND ($3::bigint IS NULL OR conta_financeira_id=$3)),0)::text receber,
      coalesce((SELECT sum(valor_centavos) FROM financeiro.contas_pagar WHERE (vencimento=d OR d=$1::date AND vencimento<d) AND status='aberta' AND $3::bigint IS NULL),0)::text pagar
      FROM generate_series($1::date,$2::date,'1 day'::interval) d`,
        [de, ate, conta],
      )
    ).rows;
    let saldo = BigInt(inicial);
    const pontos = new Map<
      string,
      {
        periodo: string;
        saldo_inicial: string;
        entradas: string;
        saidas: string;
        previsto_receber: string;
        previsto_pagar: string;
        saldo_final: string;
      }
    >();
    for (const d of dias) {
      const rec =
          (BigInt(d.receber) * BigInt(cen.realizacao_pct) * BigInt(100 - cen.reembolso_pct)) /
          10000n,
        pag = (BigInt(d.pagar) * BigInt(100 + cen.variacao_despesas_pct)) / 100n;
      const data = new Date(d.dia + "T12:00:00Z");
      if (grupo === "semana") data.setUTCDate(data.getUTCDate() - ((data.getUTCDay() + 6) % 7));
      const periodo = grupo === "mes" ? d.dia.slice(0, 7) : data.toISOString().slice(0, 10);
      let pt = pontos.get(periodo);
      if (!pt) {
        pt = {
          periodo,
          saldo_inicial: saldo.toString(),
          entradas: "0",
          saidas: "0",
          previsto_receber: "0",
          previsto_pagar: "0",
          saldo_final: saldo.toString(),
        };
        pontos.set(periodo, pt);
      }
      for (const [k, v] of [
        ["entradas", BigInt(d.entradas)],
        ["saidas", BigInt(d.saidas)],
        ["previsto_receber", rec],
        ["previsto_pagar", pag],
      ] as const)
        pt[k] = (BigInt(pt[k]) + v).toString();
      saldo += BigInt(d.entradas) - BigInt(d.saidas) + rec - pag;
      pt.saldo_final = saldo.toString();
    }
    return {
      de,
      ate,
      cenario: codigo,
      saldo_inicial: inicial,
      saldo_final: saldo.toString(),
      periodos: [...pontos.values()],
      aviso: conta
        ? "Contas a pagar ainda sem conta financeira definida nao entram neste recorte."
        : "Recebimentos e cenarios sao estimativas, nao saldo disponivel para saque.",
    };
  }
  async executar(chave: string, ctx: ContextoHandler) {
    ctx.signal.throwIfAborted();
    if (!(await ctx.verificarLease())) throw new Error("lease perdida");
    return this.repo.transacao(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('financeiro:gestao'))");
      const hoje = (await c.query<{ dia: string }>("SELECT to_char(current_date,'YYYY-MM-DD') dia"))
        .rows[0]?.dia as string;
      if (chave === "monitorar_caixa") {
        const limite = ctx.config["minimoCentavos"];
        if (limite !== undefined && (typeof limite !== "string" || !/^\d{1,14}$/.test(limite)))
          throw new BadRequestException("minimo invalido");
        const fluxo = await this.fluxo({ de: hoje, cenario: "conservador" }, c),
          min = BigInt(limite ?? "0");
        if (fluxo.periodos.some((p) => BigInt(p.saldo_final) < min))
          await this.repo.alertas.criar(
            {
              tipo: "caixa_insuficiente",
              chave: `caixa:${hoje}`,
              referenciaTabela: "cenarios_caixa",
              referenciaId: "conservador",
            },
            c,
          );
      } else {
        const inicio = new Date(hoje.slice(0, 7) + "-01T12:00:00Z");
        inicio.setUTCMonth(inicio.getUTCMonth() - 12);
        const meses = await this.meses(
          {
            de: inicio.toISOString().slice(0, 10),
            ate: hoje,
            produto: null,
            oferta: null,
            centro: null,
          },
          c,
        );
        if (chave === "detectar_anomalias") await this.anomalias(meses, ctx.config, c);
        else {
          const tabela = chave === "calcular_dre" ? "dre_mensal" : "indicadores_mensais";
          for (const m of meses)
            await c.query(
              `INSERT INTO financeiro.${tabela}(mes,dados) VALUES($1,$2) ON CONFLICT(mes) DO UPDATE SET dados=excluded.dados,atualizado_em=now()`,
              [m.mes + "-01", m],
            );
        }
      }
      ctx.signal.throwIfAborted();
      if (!(await ctx.verificarLease())) throw new Error("lease perdida");
      return { concluido: true };
    });
  }
  async anomalias(meses: MesGestao[], config: Record<string, unknown>, c: PoolClient) {
    const atual = meses.at(-1),
      anterior = meses.at(-2);
    if (!atual) return;
    const causas: string[] = [];
    if (
      atual.margem_pct !== null &&
      anterior?.margem_pct !== null &&
      anterior?.margem_pct !== undefined &&
      anterior.margem_pct - atual.margem_pct > Number(config["quedaMargemPp"] ?? 5)
    )
      causas.push("margem");
    if (
      BigInt(atual.bruta) > 0n &&
      BigInt(atual.reembolsos) * 100n >
        BigInt(atual.bruta) * BigInt(Number(config["reembolsoPct"] ?? 10))
    )
      causas.push("reembolso");
    const categorias = (
      await c.query<{ categoria: string; atual: string; media: string }>(`WITH despesas AS (
      SELECT categoria,competencia,valor_centavos FROM financeiro.contas_pagar WHERE status<>'cancelada'
      UNION ALL SELECT categoria,data,valor_centavos FROM financeiro.lancamentos WHERE tipo='saida' AND conta_pagar_id IS NULL AND transferencia_id IS NULL
      ) SELECT categoria,
      coalesce(sum(valor_centavos) FILTER(WHERE competencia>=date_trunc('month',current_date)),0)::text atual,
      div(coalesce(sum(valor_centavos) FILTER(WHERE competencia<date_trunc('month',current_date)),0),3)::text media
      FROM despesas WHERE competencia>=date_trunc('month',current_date)-interval '3 months' AND competencia<date_trunc('month',current_date)+interval '1 month' GROUP BY categoria`)
    ).rows;
    for (const d of categorias)
      if (
        BigInt(d.media) > 0n &&
        BigInt(d.atual) * 100n >
          BigInt(d.media) * BigInt(100 + Number(config["aumentoDespesaPct"] ?? 30))
      )
        causas.push(`despesa:${d.categoria}`);
    for (const causa of causas) {
      const alerta = await this.repo.alertas.criar(
        {
          tipo: "anomalia",
          chave: `anomalia:${atual.mes}:${causa}`,
          referenciaTabela: "indicadores_mensais",
          referenciaId: atual.mes,
        },
        c,
      );
      if (alerta)
        await this.repo.motor.publicar(
          "financeiro.anomalia.detectada",
          `anomalia:${alerta}`,
          { alerta_id: alerta },
          c,
        );
    }
  }
}
