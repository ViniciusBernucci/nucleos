import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { Pool, PoolClient } from "pg";
import type { MotorFuncionarios } from "../funcionarios/motor.js";
import type { AlertasFinanceiros } from "./alertas.js";
import { centavos, csv, dia, decimal, extrato, hash, id, texto } from "./importacao.js";
type Objeto = Record<string, unknown>;
const opcionalId = (v: unknown): string | null =>
  v === undefined || v === null || v === "" ? null : id(v);
export class RepositorioFinanceiroPg {
  constructor(
    readonly pool: Pool,
    readonly motor: MotorFuncionarios,
    readonly alertas: AlertasFinanceiros,
  ) {}
  async transacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async mudou(c: PoolClient): Promise<void> {
    await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
  }
  async cadastros(): Promise<Objeto> {
    const [fornecedores, centros, categorias, contas, regras] = await Promise.all([
      this.pool.query(
        "SELECT id,nome, CASE WHEN documento IS NULL THEN NULL ELSE '***' || right(documento,4) END documento,contato FROM financeiro.fornecedores ORDER BY nome",
      ),
      this.pool.query("SELECT * FROM financeiro.centros_custo ORDER BY nome"),
      this.pool.query("SELECT * FROM financeiro.categorias ORDER BY tipo,nome"),
      this.pool.query("SELECT * FROM financeiro.contas_financeiras ORDER BY nome"),
      this.pool.query("SELECT * FROM financeiro.regras_liberacao ORDER BY pagamento"),
    ]);
    return {
      fornecedores: fornecedores.rows,
      centros: centros.rows,
      categorias: categorias.rows,
      contas: contas.rows,
      regras: regras.rows,
    };
  }
  async cadastro(tipo: string, p: Objeto): Promise<unknown> {
    if (tipo === "fornecedores") {
      const documento = p["documento"] ? texto(p["documento"], 18).replace(/\D/g, "") : null;
      if (documento && ![11, 14].includes(documento.length))
        throw new BadRequestException("documento invalido");
      return (
        await this.pool.query(
          "INSERT INTO financeiro.fornecedores(nome,documento,contato) VALUES($1,$2,$3) RETURNING id",
          [texto(p["nome"]), documento, p["contato"] ? texto(p["contato"], 120) : null],
        )
      ).rows[0];
    }
    if (tipo === "centros")
      return (
        await this.pool.query(
          "INSERT INTO financeiro.centros_custo(nome) VALUES($1) RETURNING id",
          [texto(p["nome"], 80)],
        )
      ).rows[0];
    if (tipo === "contas") {
      if (!["banco", "caixa", "plataforma"].includes(String(p["tipo"])))
        throw new BadRequestException("tipo invalido");
      return (
        await this.pool.query(
          "INSERT INTO financeiro.contas_financeiras(nome,tipo) VALUES($1,$2) RETURNING id",
          [texto(p["nome"]), p["tipo"]],
        )
      ).rows[0];
    }
    if (tipo === "regras") {
      const dias = Number(p["dias"]);
      if (!Number.isInteger(dias) || dias < 0 || dias > 365)
        throw new BadRequestException("prazo invalido");
      await this.pool.query(
        "INSERT INTO financeiro.regras_liberacao VALUES($1,$2) ON CONFLICT(pagamento) DO UPDATE SET dias=excluded.dias",
        [texto(p["pagamento"], 40), dias],
      );
      return {};
    }
    throw new NotFoundException();
  }
  async pagarContas(f: Objeto = {}): Promise<Objeto> {
    const de = dia(f["de"] ?? "2000-01-01"),
      ate = dia(f["ate"] ?? "2100-12-31");
    const status = f["status"] ?? null;
    if (
      status !== null &&
      (typeof status !== "string" || !["aberta", "paga", "cancelada"].includes(status))
    )
      throw new BadRequestException("status invalido");
    const p = [
      de,
      ate,
      status,
      f["categoria"] ?? null,
      opcionalId(f["fornecedor"]),
      opcionalId(f["centro"]),
    ];
    const onde =
      "vencimento BETWEEN $1 AND $2 AND ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR categoria=$4) AND ($5::bigint IS NULL OR fornecedor_id=$5) AND ($6::bigint IS NULL OR centro_custo_id=$6)";
    const [lista, totais] = await Promise.all([
      this.pool.query(
        "SELECT p.*,to_char(vencimento,'YYYY-MM-DD') vencimento,to_char(competencia,'YYYY-MM-DD') competencia,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nome',a.nome)),'[]') FROM financeiro.anexos a WHERE a.conta_pagar_id=p.id) anexos FROM financeiro.contas_pagar p WHERE " +
          onde +
          " ORDER BY vencimento,id LIMIT 500",
        p,
      ),
      this.pool.query(
        "SELECT categoria,status,sum(valor_centavos)::text total_centavos FROM financeiro.contas_pagar WHERE " +
          onde +
          " GROUP BY categoria,status ORDER BY categoria",
        p,
      ),
    ]);
    return { contas: lista.rows, totais: totais.rows };
  }
  async criarDespesa(p: Objeto, cliente?: PoolClient): Promise<unknown> {
    const descricao = texto(p["descricao"]),
      categoria = texto(p["categoria"], 60),
      valor = centavos(p["valorCentavos"]);
    const vencimento = dia(p["vencimento"]),
      competencia = dia(p["competencia"] ?? vencimento);
    const n = Number(p["parcelas"] ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 120 || BigInt(valor) < BigInt(n))
      throw new BadRequestException("parcelas invalidas");
    const executar = async (c: PoolClient): Promise<unknown> => {
      if (
        !(
          await c.query(
            "SELECT id FROM financeiro.categorias WHERE tipo='saida' AND lower(nome)=lower($1)",
            [categoria],
          )
        ).rowCount
      )
        throw new BadRequestException("categoria nao cadastrada");
      const grupo = randomUUID(),
        ids: string[] = [];
      const base = BigInt(valor) / BigInt(n),
        resto = BigInt(valor) % BigInt(n);
      for (let parcela = 1; parcela <= n; parcela++) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO financeiro.contas_pagar(descricao,categoria,fornecedor_id,centro_custo_id,valor_centavos,vencimento,competencia,parcela,parcelas,grupo_parcelamento,origem,importacao_hash)
          VALUES($1,$2,$3,$4,$5,($6::date+make_interval(months=>$7))::date,($8::date+make_interval(months=>$7))::date,$9,$10,$11,$12,$13)
          ON CONFLICT(importacao_hash) DO NOTHING RETURNING id`,
          [
            descricao,
            categoria,
            opcionalId(p["fornecedorId"]),
            opcionalId(p["centroCustoId"]),
            (base + (BigInt(parcela) <= resto ? 1n : 0n)).toString(),
            vencimento,
            parcela - 1,
            competencia,
            parcela,
            n,
            grupo,
            p["importacaoHash"] ? "importacao" : "manual",
            p["importacaoHash"] ?? null,
          ],
        );
        if (r.rows[0]) ids.push(r.rows[0].id);
      }
      await this.mudou(c);
      return { ids };
    };
    return cliente ? executar(cliente) : this.transacao(executar);
  }
  async pagar(contaId: string, p: Objeto): Promise<unknown> {
    const conta = id(contaId),
      data = dia(p["data"]),
      financeira = id(p["contaFinanceiraId"]);
    return this.transacao(async (c) => {
      const r = await c.query<Objeto>(
        "SELECT * FROM financeiro.contas_pagar WHERE id=$1 FOR UPDATE",
        [conta],
      );
      const v = r.rows[0];
      if (!v) throw new NotFoundException();
      if (v["status"] !== "aberta") throw new ConflictException("conta nao esta aberta");
      if (
        !(
          await c.query(
            "SELECT id FROM financeiro.contas_financeiras WHERE id=$1 AND ativa FOR SHARE",
            [financeira],
          )
        ).rowCount
      )
        throw new BadRequestException("conta financeira indisponivel");
      await c.query(
        `INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_pagar_id,conta_financeira_id,centro_custo_id,conta_recorrente_id,competencia)
        VALUES('saida',$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          v["descricao"],
          v["categoria"],
          v["valor_centavos"],
          data,
          conta,
          financeira,
          v["centro_custo_id"],
          v["conta_recorrente_id"],
          v["conta_recorrente_id"] ? v["competencia"] : null,
        ],
      );
      await c.query("UPDATE financeiro.contas_pagar SET status='paga' WHERE id=$1", [conta]);
      await this.mudou(c);
      return {};
    });
  }
  async cancelar(contaId: string): Promise<void> {
    const r = await this.pool.query(
      "UPDATE financeiro.contas_pagar SET status='cancelada' WHERE id=$1 AND status='aberta' RETURNING id",
      [id(contaId)],
    );
    if (!r.rowCount) throw new ConflictException("conta nao esta aberta");
  }
  async gerarRecorrencias(c: PoolClient): Promise<number> {
    const r =
      await c.query(`INSERT INTO financeiro.contas_pagar(descricao,categoria,fornecedor_id,centro_custo_id,valor_centavos,vencimento,competencia,origem,conta_recorrente_id)
      SELECT r.descricao,r.categoria,r.fornecedor_id,r.centro_custo_id,r.valor_centavos,
      (m.mes + (least(r.dia_vencimento,extract(day FROM m.mes+interval '1 month -1 day')::int)-1)*interval '1 day')::date,
      m.mes,'recorrente',r.id FROM financeiro.contas_recorrentes r
      CROSS JOIN LATERAL (SELECT s::date mes FROM generate_series(date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo'),date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')+interval '2 months',interval '1 month') s) m
      WHERE m.mes>=r.inicio AND (r.fim IS NULL OR m.mes<=r.fim)
      AND (r.periodicidade='mensal' OR extract(month FROM m.mes)=extract(month FROM r.inicio))
      ON CONFLICT(conta_recorrente_id,competencia) DO NOTHING`);
    await this.mudou(c);
    return r.rowCount ?? 0;
  }
  async criarRecorrente(p: Objeto): Promise<unknown> {
    const periodicidade = p["periodicidade"] ?? "mensal",
      vencimento = Number(p["diaVencimento"]);
    if (
      typeof periodicidade !== "string" ||
      !["mensal", "anual"].includes(periodicidade) ||
      !Number.isInteger(vencimento) ||
      vencimento < 1 ||
      vencimento > 31
    )
      throw new BadRequestException("recorrencia invalida");
    const inicio = dia(p["inicio"]),
      fim = p["fim"] ? dia(p["fim"]) : null;
    if (!inicio.endsWith("-01") || (fim && (!fim.endsWith("-01") || fim < inicio)))
      throw new BadRequestException("use primeiro dia do mes na vigencia");
    return this.transacao(async (c) => {
      const categoria = texto(p["categoria"], 60);
      if (
        !(
          await c.query(
            "SELECT id FROM financeiro.categorias WHERE tipo='saida' AND lower(nome)=lower($1)",
            [categoria],
          )
        ).rowCount
      )
        throw new BadRequestException("categoria nao cadastrada");
      const r = await c.query<{ id: string }>(
        `INSERT INTO financeiro.contas_recorrentes(descricao,categoria,valor_centavos,dia_vencimento,inicio,fim,fornecedor_id,centro_custo_id,periodicidade) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          texto(p["descricao"]),
          categoria,
          centavos(p["valorCentavos"]),
          vencimento,
          inicio,
          fim,
          opcionalId(p["fornecedorId"]),
          opcionalId(p["centroCustoId"]),
          periodicidade,
        ],
      );
      await this.gerarRecorrencias(c);
      return r.rows[0];
    });
  }
  async vencimentos(c: PoolClient): Promise<void> {
    const r = await c.query<{
      id: string;
      vencida: boolean;
    }>(`SELECT id,vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date vencida FROM financeiro.contas_pagar
      WHERE status='aberta' AND vencimento<=(now() AT TIME ZONE 'America/Sao_Paulo')::date+3`);
    for (const v of r.rows)
      await this.alertas.criar(
        {
          tipo: v.vencida ? "conta_vencida" : "conta_vencendo",
          chave: (v.vencida ? "vencida:" : "vencendo:") + v.id,
          referenciaTabela: "contas_pagar",
          referenciaId: v.id,
        },
        c,
      );
  }
  previaDespesas(conteudo: string): {
    linhas: Objeto[];
    erros: { linha: number; mensagem: string }[];
  } {
    const linhas = csv(conteudo),
      cabecalho = linhas
        .shift()
        ?.join(";")
        .replace(/^\uFEFF/, "");
    if (cabecalho !== "data;descricao;valor;categoria;fornecedor;centro_custo;vencimento")
      throw new BadRequestException("cabecalho CSV invalido");
    const validas: Objeto[] = [],
      erros: { linha: number; mensagem: string }[] = [];
    linhas.forEach((l, i) => {
      try {
        if (l.length !== 7) throw new Error();
        validas.push({
          competencia: dia(l[0]),
          descricao: texto(l[1]),
          valorCentavos: centavos(decimal(l[2] ?? "")),
          categoria: texto(l[3], 60),
          fornecedorId: opcionalId(l[4]),
          centroCustoId: opcionalId(l[5]),
          vencimento: dia(l[6]),
          importacaoHash: hash(l.join(";")),
        });
      } catch {
        erros.push({
          linha: i + 2,
          mensagem: "Linha invalida: confira datas, valor, categoria e ids.",
        });
      }
    });
    return { linhas: validas, erros };
  }
  async importarDespesas(conteudo: string, confirmar: boolean): Promise<unknown> {
    const previa = this.previaDespesas(conteudo);
    if (!confirmar) return previa;
    if (previa.erros.length)
      throw new BadRequestException("corrija as linhas invalidas antes de confirmar");
    return this.transacao(async (c) => {
      for (const p of previa.linhas) await this.criarDespesa(p, c);
      return { processadas: previa.linhas.length };
    });
  }
  async movimentacoes(de: string, ate: string, conta?: string): Promise<unknown> {
    return (
      await this.pool.query(
        `SELECT *,to_char(data,'YYYY-MM-DD') data FROM financeiro.lancamentos
      WHERE data BETWEEN $1 AND $2 AND ($3::bigint IS NULL OR conta_financeira_id=$3) ORDER BY data,id LIMIT 1000`,
        [dia(de), dia(ate), opcionalId(conta)],
      )
    ).rows;
  }
  async transferencia(p: Objeto, saque = false): Promise<unknown> {
    const origem = saque
      ? (
          await this.pool.query<{ id: string }>(
            "SELECT id FROM financeiro.contas_financeiras WHERE nome='Hotmart'",
          )
        ).rows[0]?.id
      : id(p["origemId"]);
    const destino = id(p["destinoId"]),
      data = dia(p["data"]),
      valor = centavos(p["valorCentavos"]),
      taxa = saque ? (typeof p["taxaCentavos"] === "string" ? p["taxaCentavos"] : "0") : "0";
    if (!/^\d{1,14}$/.test(taxa) || BigInt(taxa) >= BigInt(valor) || origem === destino || !origem)
      throw new BadRequestException("transferencia invalida");
    return this.transacao(async (c) => {
      const ativas = await c.query(
        "SELECT id FROM financeiro.contas_financeiras WHERE id=ANY($1::bigint[]) AND ativa ORDER BY id FOR SHARE",
        [[origem, destino]],
      );
      if (ativas.rowCount !== 2) throw new BadRequestException("conta indisponivel");
      const transferencia = randomUUID(),
        liquido = (BigInt(valor) - BigInt(taxa)).toString();
      await c.query(
        `INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_financeira_id,transferencia_id)
        VALUES('saida',$1,'Transferencia',$2,$3,$4,$6),('entrada',$1,'Transferencia',$5,$3,$7,$6)`,
        [
          saque ? "Saque Hotmart" : "Transferencia entre contas",
          valor,
          data,
          origem,
          liquido,
          transferencia,
          destino,
        ],
      );
      if (saque)
        await c.query(
          "INSERT INTO financeiro.saques_hotmart(data,bruto_centavos,taxa_centavos,liquido_centavos,conta_destino_id,comprovante,transferencia_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            data,
            valor,
            taxa,
            liquido,
            destino,
            p["comprovante"] ? texto(p["comprovante"], 200) : null,
            transferencia,
          ],
        );
      await this.mudou(c);
      return { id: transferencia };
    });
  }
  async saldoInformado(p: Objeto): Promise<unknown> {
    const valor = String(p["valorCentavos"]);
    if (!/^\d{1,14}$/.test(valor)) throw new BadRequestException("saldo invalido");
    return (
      await this.pool.query(
        "INSERT INTO financeiro.saldos_informados(conta_financeira_id,data,valor_centavos) VALUES($1,$2,$3) RETURNING id",
        [id(p["contaFinanceiraId"]), dia(p["data"]), valor],
      )
    ).rows[0];
  }
  async previsoes(c: PoolClient): Promise<void> {
    await c.query(`INSERT INTO financeiro.contas_receber(origem,transacao,descricao,valor_centavos,previsto_em,conta_financeira_id)
      SELECT 'hotmart',v.transacao,'Recebimento Hotmart',v.liquido_centavos,
      (v.aprovado_em AT TIME ZONE 'America/Sao_Paulo')::date+r.dias,f.id
      FROM financeiro.vendas v JOIN financeiro.contas_financeiras f ON f.nome='Hotmart'
      LEFT JOIN financeiro.regras_liberacao r ON r.pagamento=v.pagamento
      WHERE v.grupo='receita' AND v.moeda='BRL' AND v.liquido_centavos>0
      ON CONFLICT(transacao) DO UPDATE SET valor_centavos=excluded.valor_centavos,
      previsto_em=excluded.previsto_em WHERE financeiro.contas_receber.status='estimado'`);
    await c.query(
      "UPDATE financeiro.contas_receber r SET status='cancelado' FROM financeiro.vendas v WHERE v.transacao=r.transacao AND v.grupo<>'receita' AND r.status='estimado'",
    );
  }
  async atrasados(c: PoolClient): Promise<void> {
    const r = await c.query<{ id: string }>(
      "SELECT id FROM financeiro.contas_receber WHERE status='estimado' AND previsto_em<(now() AT TIME ZONE 'America/Sao_Paulo')::date",
    );
    for (const v of r.rows)
      await this.alertas.criar(
        {
          tipo: "recebimento_atrasado",
          chave: "receber:" + v.id,
          referenciaTabela: "contas_receber",
          referenciaId: v.id,
        },
        c,
      );
  }
  async receber(): Promise<Objeto> {
    const [vendido, receber, disponivel, recebido] = await Promise.all([
      this.pool.query(
        "SELECT moeda,sum(valor_centavos)::text valor_centavos FROM financeiro.vendas WHERE grupo='receita' GROUP BY moeda",
      ),
      this.pool.query(
        "SELECT *,to_char(previsto_em,'YYYY-MM-DD') previsto_em FROM financeiro.contas_receber WHERE status='estimado' ORDER BY previsto_em NULLS LAST LIMIT 500",
      ),
      this.pool.query(
        "SELECT DISTINCT ON(conta_financeira_id) *,to_char(data,'YYYY-MM-DD') data FROM financeiro.saldos_informados ORDER BY conta_financeira_id,data DESC,id DESC",
      ),
      this.pool.query(
        "SELECT s.id,s.data,s.liquido_centavos FROM financeiro.saques_hotmart s JOIN financeiro.conciliacao_itens i ON i.tipo='saque' AND i.referencia_id=s.id::text JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id AND c.aceita AND NOT c.desfeita",
      ),
    ]);
    return {
      vendido: vendido.rows,
      aReceberEstimado: receber.rows,
      disponivelInformado: disponivel.rows,
      recebidoConciliado: recebido.rows,
    };
  }
  async receberManual(p: Objeto): Promise<unknown> {
    return (
      await this.pool.query(
        "INSERT INTO financeiro.contas_receber(origem,descricao,valor_centavos,previsto_em,conta_financeira_id) VALUES('manual',$1,$2,$3,$4) RETURNING id",
        [
          texto(p["descricao"]),
          centavos(p["valorCentavos"]),
          dia(p["previstoEm"]),
          id(p["contaFinanceiraId"]),
        ],
      )
    ).rows[0];
  }
  async importarExtrato(p: Objeto): Promise<unknown> {
    const conta = id(p["contaFinanceiraId"]),
      conteudo = texto(p["conteudo"], 1024 * 1024);
    if (!["csv", "ofx"].includes(String(p["formato"])))
      throw new BadRequestException("formato invalido");
    const itens = extrato(conteudo, p["formato"] as "csv" | "ofx");
    return this.transacao(async (c) => {
      const r = await c.query<{ id: string }>(
        "INSERT INTO financeiro.extratos_importados(conta_financeira_id,hash) VALUES($1,$2) ON CONFLICT(conta_financeira_id,hash) DO UPDATE SET hash=excluded.hash RETURNING id",
        [conta, hash(conteudo)],
      );
      const importacao = r.rows[0]?.id;
      let novos = 0;
      for (const i of itens)
        novos +=
          (
            await c.query(
              "INSERT INTO financeiro.extrato_itens(extrato_id,conta_financeira_id,fitid,data,valor_centavos,memo) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(conta_financeira_id,fitid) DO NOTHING",
              [importacao, conta, i.fitid, i.data, centavos(i.valorCentavos, true), i.memo],
            )
          ).rowCount ?? 0;
      await this.motor.publicar(
        "financeiro.extrato.importado",
        "extrato:" + (importacao ?? ""),
        { extrato_id: importacao ?? "" },
        c,
      );
      return { id: importacao, novos };
    });
  }
  async itensExtrato(): Promise<unknown> {
    return (
      await this.pool.query(
        "SELECT *,to_char(data,'YYYY-MM-DD') data FROM financeiro.extrato_itens WHERE NOT conciliado ORDER BY data,id LIMIT 1000",
      )
    ).rows;
  }
}
