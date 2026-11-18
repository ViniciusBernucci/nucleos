import type { PainelVendas } from "@nucleos/contracts";
import {
  formatarInteiro,
  formatarMoeda,
  rotuloPagamento,
  rotuloStatus,
} from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

interface Linha {
  chave: string;
  nome: string;
  valor: string;
  detalhe: string;
  /** 0 a 1, proporcao da maior linha. */
  proporcao: number;
}

function Ranking({
  titulo,
  id,
  linhas,
  vazio,
}: {
  titulo: string;
  id: string;
  linhas: Linha[];
  vazio: string;
}) {
  return (
    <section className="panel-card" aria-labelledby={id}>
      <div className="panel-header">
        <h2 id={id}>{titulo}</h2>
      </div>
      {linhas.length === 0 ? (
        <div className="state-box" role="status">
          {vazio}
        </div>
      ) : (
        <ol className={styles["ranking"]}>
          {linhas.map((l) => (
            <li key={l.chave}>
              <div className={styles["rankingTopo"]}>
                <span className={styles["rankingNome"]}>{l.nome}</span>
                <span className={styles["rankingValor"]}>{l.valor}</span>
              </div>
              <div className={styles["barra"]} aria-hidden="true">
                <div
                  className={styles["barraPreenchida"]}
                  style={{ width: `${String(Math.max(2, Math.round(l.proporcao * 100)))}%` }}
                />
              </div>
              <span className="kpi-card__detail">{l.detalhe}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const proporcoes = (valores: number[]): number[] => {
  const max = Math.max(1, ...valores);
  return valores.map((v) => v / max);
};

/** Receita por produto e por forma de pagamento, e quantidade por status da venda. */
export function Distribuicoes({ painel }: { painel: PainelVendas }) {
  const { moeda } = painel;
  const pProd = proporcoes(painel.porProduto.map((p) => p.receitaCentavos));
  const pPag = proporcoes(painel.porPagamento.map((p) => p.receitaCentavos));
  const pSta = proporcoes(painel.porStatus.map((s) => s.vendas));

  return (
    <div className={styles["colunas"]}>
      <Ranking
        id="por-produto"
        titulo="Receita por produto"
        vazio="Nenhuma venda aprovada no período."
        linhas={painel.porProduto.map((p, i) => ({
          chave: p.produtoId,
          nome: p.produtoNome,
          valor: formatarMoeda(p.receitaCentavos, moeda),
          detalhe: `${formatarInteiro(p.vendas)} venda(s)`,
          proporcao: pProd[i] ?? 0,
        }))}
      />
      <Ranking
        id="por-pagamento"
        titulo="Forma de pagamento"
        vazio="Nenhuma venda aprovada no período."
        linhas={painel.porPagamento.map((p, i) => ({
          chave: p.tipo,
          nome: rotuloPagamento(p.tipo),
          valor: formatarMoeda(p.receitaCentavos, moeda),
          detalhe: `${formatarInteiro(p.vendas)} venda(s)`,
          proporcao: pPag[i] ?? 0,
        }))}
      />
      <Ranking
        id="por-status"
        titulo="Vendas por status"
        vazio="Nenhuma venda no período."
        linhas={painel.porStatus.map((s, i) => ({
          chave: s.status,
          nome: rotuloStatus(s.status),
          valor: formatarInteiro(s.vendas),
          detalhe: formatarMoeda(s.valorCentavos, moeda),
          proporcao: pSta[i] ?? 0,
        }))}
      />
    </div>
  );
}
