import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { CfoConfig } from "@nucleos/config";
import type { ContextoHandler } from "../funcionarios/handlers.js";
import { filtroGestao, type GestaoFinanceira } from "./gestao.js";
import { RentabilidadeMarketing } from "./rentabilidade.js";
export const COMPETENCIAS_CFO = {
  diagnostico: "Diagnostique a saude financeira do periodo.",
  planejamento: "Sugira planejamento para o caixa projetado.",
  despesas: "Analise despesas e oportunidades de controle.",
  rentabilidade: "Analise a rentabilidade e o investimento em marketing.",
  recomendacoes: "Recomende prioridades com base nos indicadores e alertas.",
} as const;
export function pedidoCfo(c: Record<string, unknown>) {
  if (Object.keys(c).some((k) => !["competencia", "de", "ate"].includes(k)))
    throw new BadRequestException("config CFO invalida");
  const competencia = c["competencia"] ?? "diagnostico";
  if (typeof competencia !== "string" || !Object.hasOwn(COMPETENCIAS_CFO, competencia))
    throw new BadRequestException("competencia invalida");
  const f = filtroGestao(c);
  return { competencia: competencia as keyof typeof COMPETENCIAS_CFO, de: f.de, ate: f.ate };
}
export class CfoFinanceiro {
  disponivel = false;
  readonly marketing: RentabilidadeMarketing;
  constructor(
    readonly gestao: GestaoFinanceira,
    readonly config: CfoConfig,
    readonly requisitar: typeof fetch = fetch,
  ) {
    this.marketing = new RentabilidadeMarketing(gestao);
  }
  async onModuleInit() {
    try {
      const r = await this.chamar("/v1/agentes/disponibilidade");
      this.disponivel = (r as { disponivel?: boolean }).disponivel === true;
    } catch {
      this.disponivel = false;
    }
    if (this.disponivel)
      this.gestao.repo.motor.registro.registrar({
        chave: "diretoria.analisar_financas",
        validarConfig: (c) => {
          try {
            pedidoCfo(c);
            return true;
          } catch {
            return false;
          }
        },
        executar: (c) => this.executar(c),
      });
    await this.gestao.repo.pool.query(
      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao=$1 WHERE codigo='diretoria.analisar_financas'",
      [this.disponivel ? "DISPONIVEL" : "INDISPONIVEL"],
    );
    await this.gestao.repo.pool.query(
      "UPDATE funcionarios.funcionarios SET status=$1 WHERE slug='cfo-virtual' AND status=$2",
      [this.disponivel ? "ATIVO" : "RASCUNHO", this.disponivel ? "RASCUNHO" : "ATIVO"],
    );
  }
  async chamar(path: string, body?: unknown, signal?: AbortSignal) {
    const cfg = this.config.gateway;
    if (!cfg)
      throw new ServiceUnavailableException("Configure Anthropic no gateway e as chaves internas.");
    const r = await this.requisitar(cfg.url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${cfg.chave.reveal()}`,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(110000)])
        : AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new ServiceUnavailableException("CFO indisponivel");
    const texto = await r.text();
    if (texto.length > 64000) throw new ServiceUnavailableException("resposta CFO excedeu limite");
    return JSON.parse(texto) as unknown;
  }
  async perguntar(c: Record<string, unknown>) {
    if (!this.disponivel)
      throw new ServiceUnavailableException(
        "CFO indisponivel: configure ANTHROPIC_API_KEY no gateway.",
      );
    const p = pedidoCfo(c);
    const a = (
      await this.gestao.repo.pool.query<{ id: string }>(
        "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='diretoria.analisar_financas' AND a.habilitada",
      )
    ).rows[0];
    if (!a) throw new ServiceUnavailableException("atribuicao CFO ausente");
    return { execucaoId: await this.gestao.repo.motor.executarAgora(a.id, p) };
  }
  async executar(ctx: ContextoHandler) {
    const p = pedidoCfo(ctx.config);
    ctx.signal.throwIfAborted();
    if (!(await ctx.verificarLease())) throw new Error("lease perdida");
    // Reserva persistente antes da chamada paga: uma retentativa nao gasta de novo
    // se o processo perdeu a resposta ou a lease. Nova tentativa exige nova execucao manual.
    const reserva = await this.gestao.repo.transacao(async (c) => {
      if (!(await ctx.verificarLease())) throw new Error("lease perdida");
      return (
        await c.query<{ id: string }>(
          "INSERT INTO financeiro.analises_cfo(execucao_id,competencia,pergunta,de,ate,resposta,estado,ferramentas,uso) VALUES($1,$2,$3,$4,$5,'','INICIADA_SEM_REPETICAO','[]','{}') ON CONFLICT(execucao_id) DO NOTHING RETURNING id",
          [ctx.execucaoId, p.competencia, COMPETENCIAS_CFO[p.competencia], p.de, p.ate],
        )
      ).rows[0];
    });
    if (!reserva) {
      const existente = (
        await this.gestao.repo.pool.query<{ id: string; estado: string }>(
          "SELECT id,estado FROM financeiro.analises_cfo WHERE execucao_id=$1",
          [ctx.execucaoId],
        )
      ).rows[0];
      return { analiseId: existente?.id, estado: existente?.estado };
    }
    let resposta: unknown;
    try {
      resposta = await this.chamar("/v1/agentes/executar", p, ctx.signal);
    } catch {
      await this.gestao.repo.pool.query(
        "UPDATE financeiro.analises_cfo SET estado='ERRO_GATEWAY' WHERE id=$1",
        [reserva.id],
      );
      return { analiseId: reserva.id, estado: "ERRO_GATEWAY" };
    }
    if (!resposta || typeof resposta !== "object") throw new Error("resposta CFO invalida");
    const r = resposta as Record<string, unknown>;
    if (
      typeof r["status"] !== "string" ||
      typeof r["resposta"] !== "string" ||
      !Array.isArray(r["ferramentas"]) ||
      typeof r["uso"] !== "object"
    )
      throw new Error("resposta CFO invalida");
    return this.gestao.repo.transacao(async (c) => {
      ctx.signal.throwIfAborted();
      if (!(await ctx.verificarLease())) throw new Error("lease perdida");
      await c.query(
        "UPDATE financeiro.analises_cfo SET resposta=$2,estado=$3,ferramentas=$4,uso=$5 WHERE id=$1",
        [
          reserva.id,
          r["resposta"],
          r["status"],
          JSON.stringify(r["ferramentas"]),
          JSON.stringify(r["uso"]),
        ],
      );
      return { analiseId: reserva.id, estado: r["status"] };
    });
  }
  async historico() {
    return (
      await this.gestao.repo.pool.query(
        "SELECT id::text,execucao_id::text,competencia,pergunta,to_char(de,'YYYY-MM-DD') de,to_char(ate,'YYYY-MM-DD') ate,resposta,estado,ferramentas,uso,criada_em FROM financeiro.analises_cfo ORDER BY id DESC LIMIT 50",
      )
    ).rows as Record<string, unknown>[];
  }
  async ferramenta(nome: string, f: Record<string, unknown>) {
    const filtro = filtroGestao(f);
    switch (nome) {
      case "indicadores_mensais":
      case "dre":
        return this.gestao.meses(filtro);
      case "fluxo_projetado": {
        const resultado = await this.gestao.fluxo({ de: filtro.ate });
        return {
          periodos: resultado.periodos,
          saldo_inicial: resultado.saldo_inicial,
          saldo_final: resultado.saldo_final,
        };
      }
      case "despesas_por_categoria":
        return (
          await this.gestao.repo.pool.query<{ categoria_id: string; valor_centavos: string }>(
            "SELECT cat.id::text categoria_id,sum(p.valor_centavos)::text valor_centavos FROM financeiro.contas_pagar p JOIN financeiro.categorias cat ON cat.tipo='saida' AND lower(cat.nome)=lower(p.categoria) WHERE p.status<>'cancelada' AND p.competencia BETWEEN $1 AND $2 GROUP BY cat.id",
            [filtro.de, filtro.ate],
          )
        ).rows;
      case "rentabilidade_campanhas":
        return (await this.marketing.consultar(filtro)).campanhas.map(
          ({ campanha_id, gasto, receita, liquida, novos, roas, cac, margem_pos_aquisicao }) => ({
            campanha_id,
            gasto,
            receita,
            liquida,
            novos,
            roas,
            cac,
            margem_pos_aquisicao,
          }),
        );
      case "alertas_abertos":
        return (
          await this.gestao.repo.pool.query<{ tipo: string; quantidade: string }>(
            "SELECT tipo,count(*)::text quantidade FROM financeiro.alertas WHERE estado='aberto' GROUP BY tipo ORDER BY tipo",
          )
        ).rows;
      default:
        throw new BadRequestException("ferramenta nao autorizada");
    }
  }
}
