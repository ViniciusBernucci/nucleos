import Link from "next/link";
import {
  exibir,
  consultar,
  Indisponivel,
  Tabela,
  Campo,
  Escolha,
  Formulario,
  Painel,
} from "./Base.tsx";
export type BuscaGestao = Promise<Record<string, string | string[] | undefined>>;
export function parametros(f: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams();
  for (const k of ["de", "ate", "produto", "oferta", "centro", "conta", "grupo", "cenario"]) {
    const v = f[k];
    if (typeof v === "string" && v) p.set(k, v);
  }
  return p;
}
export function Filtros({ p, fluxo = false }: { p: URLSearchParams; fluxo?: boolean }) {
  return (
    <form method="get" className="filters">
      <label>
        De <input type="date" name="de" defaultValue={p.get("de") ?? ""} />
      </label>
      <label>
        Até <input type="date" name="ate" defaultValue={p.get("ate") ?? ""} />
      </label>
      {fluxo ? (
        <>
          <label>
            Conta (ID)
            <input name="conta" defaultValue={p.get("conta") ?? ""} />
          </label>
          <label>
            Agrupar
            <select name="grupo" defaultValue={p.get("grupo") ?? "dia"}>
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </label>
          <label>
            Cenário
            <select name="cenario" defaultValue={p.get("cenario") ?? "base"}>
              {["conservador", "base", "otimista"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          {["produto", "oferta", "centro"].map((k) => (
            <label key={k}>
              {k}
              <input name={k} defaultValue={p.get(k) ?? ""} />
            </label>
          ))}
        </>
      )}
      <button className="btn">Aplicar filtros</button>
    </form>
  );
}
export function GraficoMeses({ meses }: { meses: Record<string, unknown>[] }) {
  const max = Math.max(
    1,
    ...meses.flatMap((m) => [Number(m["liquida"]), Number(m["despesas"])]).filter(Number.isFinite),
  );
  return (
    <svg
      role="img"
      aria-label="Receita líquida e despesas por mês. Valores exatos na tabela abaixo."
      viewBox={`0 0 ${Math.max(meses.length, 1) * 60} 150`}
      style={{ width: "100%", maxHeight: 240 }}
    >
      {meses.map((m, i) => (
        <g key={String(m["mes"])}>
          <rect
            x={i * 60 + 5}
            y={130 - (Math.max(0, Number(m["liquida"])) / max) * 110}
            width="20"
            height={(Math.max(0, Number(m["liquida"])) / max) * 110}
            fill="currentColor"
          />
          <rect
            x={i * 60 + 27}
            y={130 - (Math.max(0, Number(m["despesas"])) / max) * 110}
            width="20"
            height={(Math.max(0, Number(m["despesas"])) / max) * 110}
            fill="#b66a3c"
          />
          <text x={i * 60 + 3} y="145" fontSize="8">
            {String(m["mes"])}
          </text>
        </g>
      ))}
    </svg>
  );
}
export async function PainelGestao({
  searchParams,
  dre = false,
}: {
  searchParams: BuscaGestao;
  dre?: boolean;
}) {
  const p = parametros(await searchParams),
    dados = await consultar<{
      meses: Record<string, unknown>[];
      destaques: Record<string, unknown>;
      mes_anterior: Record<string, unknown> | null;
      alocacao: string | null;
    }>("/gestao/indicadores?" + p.toString());
  const categorias = dre ? await consultar<Record<string, unknown>[]>("/gestao/mapeamento") : null;
  return (
    <main id="conteudo" className="page">
      <Link href="/setores/financeiro">← Financeiro</Link>
      <h1>{dre ? "DRE gerencial" : "Visão Geral"}</h1>
      <Filtros p={p} />
      {!dados ? (
        <Indisponivel />
      ) : (
        <>
          <p>
            Valores em centavos, BRL. Indicadores e DRE consideram os meses completos selecionados,
            sem rateio diário de despesas. {dados.alocacao}
          </p>
          {dados.mes_anterior && (
            <p>
              Comparativo com {String(dados.mes_anterior["mes"])}: resultado{" "}
              {String(dados.mes_anterior["resultado"])} centavos; margem{" "}
              {exibir(dados.mes_anterior["margem_pct"] ?? "sem receita")} %.
            </p>
          )}
          {dre ? (
            <p>
              A DRE reconhece a competência das contas; o fluxo de caixa acompanha o dinheiro
              recebido e pago. Taxas e comissões são custos variáveis. Mídia importada entra uma
              vez: exclua da DRE a categoria da fatura paga para evitar dupla contagem.
            </p>
          ) : (
            <>
              <dl className="card-grid">
                {["liquida", "despesas", "resultado"].map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {dados.meses.reduce((s, m) => s + BigInt(exibir(m[k] ?? 0)), 0n).toString()}{" "}
                      centavos
                    </dd>
                  </div>
                ))}
              </dl>
              <p>
                Contas vencidas: {String(dados.destaques["vencidas"])} · Divergências:{" "}
                {String(dados.destaques["divergencias"])} ·{" "}
                <Link href="/setores/financeiro/alertas">
                  Alertas: {String(dados.destaques["alertas"])}
                </Link>
              </p>
              <GraficoMeses meses={dados.meses} />
            </>
          )}
          <Tabela
            dados={dados.meses}
            colunas={
              dre
                ? [
                    ["mes", "Competência"],
                    ["bruta", "Receita bruta"],
                    ["reembolsos", "Reembolsos/chargebacks"],
                    ["impostos", "Impostos"],
                    ["liquida", "Receita líquida"],
                    ["taxas", "Taxas"],
                    ["comissoes", "Comissões"],
                    ["midia", "Mídia"],
                    ["variaveis", "Outros variáveis"],
                    ["contribuicao", "Contribuição antes de despesas não classificadas"],
                    ["fixas", "Fixas"],
                    ["nao_classificado", "Não classificado"],
                    ["resultado", "Resultado operacional"],
                    ["margem_pct", "Margem %"],
                  ]
                : [
                    ["mes", "Mês"],
                    ["liquida", "Receita líquida"],
                    ["despesas", "Despesas"],
                    ["resultado", "Resultado"],
                    ["margem_pct", "Margem %"],
                    ["reembolsos", "Reembolsos"],
                  ]
            }
          />
          {dre && (
            <>
              <h2>Mapeamento de categorias</h2>
              <Tabela
                dados={categorias ?? []}
                colunas={[
                  ["nome", "Categoria"],
                  ["linha_dre", "Linha"],
                  ["excluir_da_dre", "Excluir (fatura de mídia)"],
                ]}
              />
              <Painel titulo="Mapear categoria">
                <Formulario operacao="mapear-dre" rotulo="Salvar mapeamento">
                  <Escolha nome="categoriaId" rotulo="Categoria" opcoes={categorias ?? []} />
                  <label>
                    Linha
                    <select name="linha">
                      {["impostos", "variaveis", "fixas", "nao_classificado"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input type="checkbox" name="excluir" /> Excluir da DRE (mídia já importada)
                  </label>
                </Formulario>
              </Painel>
              <p>
                {["dre", "vendas", "despesas"].map((t) => (
                  <span key={t}>
                    <a href={`/api/financeiro/relatorios/${t}?${p}`}>Exportar {t} em CSV</a>
                    {" · "}
                  </span>
                ))}
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}
export async function ProjecaoCaixa({ searchParams }: { searchParams: BuscaGestao }) {
  const p = parametros(await searchParams),
    dados = await consultar<{
      periodos: Record<string, unknown>[];
      saldo_inicial: string;
      saldo_final: string;
      aviso: string;
    }>("/gestao/fluxo?" + p.toString()),
    cenarios = await consultar<Record<string, unknown>[]>("/gestao/cenarios");
  return (
    <section aria-labelledby="projecao">
      <h2 id="projecao">Realizado e projeção de 90 dias</h2>
      <Filtros p={p} fluxo />
      {!dados ? (
        <Indisponivel />
      ) : (
        <>
          <p>{dados.aviso}</p>
          <p>
            Saldo inicial: {dados.saldo_inicial} · Saldo final projetado: {dados.saldo_final}{" "}
            centavos
          </p>
          <Tabela
            dados={dados.periodos}
            colunas={[
              ["periodo", "Período"],
              ["saldo_inicial", "Saldo inicial"],
              ["entradas", "Entradas realizadas"],
              ["saidas", "Saídas realizadas"],
              ["previsto_receber", "Entradas estimadas"],
              ["previsto_pagar", "Saídas previstas"],
              ["saldo_final", "Saldo final"],
            ]}
          />
        </>
      )}
      <Painel titulo="Editar cenários">
        <Tabela
          dados={cenarios ?? []}
          colunas={[
            ["codigo", "Cenário"],
            ["realizacao_pct", "Realização %"],
            ["reembolso_pct", "Reembolso %"],
            ["variacao_despesas_pct", "Variação despesas %"],
          ]}
        />
        <Formulario operacao="cenario" rotulo="Salvar cenário">
          <label>
            Cenário
            <select name="codigo">
              {["conservador", "base", "otimista"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <Campo nome="realizacao_pct" rotulo="Realização de recebimentos (%)" tipo="number" />
          <Campo nome="reembolso_pct" rotulo="Reembolso (%)" tipo="number" />
          <Campo nome="variacao_despesas_pct" rotulo="Variação de despesas (%)" tipo="number" />
        </Formulario>
      </Painel>
    </section>
  );
}
