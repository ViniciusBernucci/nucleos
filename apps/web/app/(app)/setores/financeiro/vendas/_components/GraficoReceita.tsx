import type { PainelVendas } from "@nucleos/contracts";
import {
  formatarDia,
  formatarDiaCurto,
  formatarInteiro,
  formatarMoeda,
  geometriaGrafico,
} from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

const LARGURA = 720;
const ALTURA = 240;
const MARGEM = { topo: 12, direita: 12, baixo: 28, esquerda: 78 };

/** Receita bruta por dia (SVG no servidor), com a mesma informacao em tabela para leitores de tela. */
export function GraficoReceita({ painel }: { painel: PainelVendas }) {
  const { serieDiaria: serie, moeda } = painel;
  const g = geometriaGrafico(serie, LARGURA, ALTURA, MARGEM);
  const total = serie.reduce((s, p) => s + p.receitaCentavos, 0);
  const rotulosX =
    serie.length <= 1
      ? serie
      : [serie[0], serie[Math.floor(serie.length / 2)], serie[serie.length - 1]];
  const resumo = `Receita bruta por dia, de ${formatarDia(painel.periodo.de)} a ${formatarDia(painel.periodo.ate)}: total de ${formatarMoeda(total, moeda)}.`;

  return (
    <section className="panel-card" aria-labelledby="grafico-titulo">
      <div className="panel-header">
        <h2 id="grafico-titulo">Receita por dia</h2>
        <span className="kpi-card__detail">
          Pico: {formatarMoeda(Math.max(0, ...serie.map((p) => p.receitaCentavos)), moeda)}
        </span>
      </div>

      <svg
        className={styles["grafico"]}
        viewBox={`0 0 ${String(LARGURA)} ${String(ALTURA)}`}
        role="img"
        aria-label={resumo}
      >
        {g.eixoY.map((t) => (
          <g key={t.y}>
            <line
              className={styles["eixoLinha"]}
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={t.y}
              y2={t.y}
            />
            <text
              className={styles["eixoTexto"]}
              x={MARGEM.esquerda - 8}
              y={t.y + 4}
              textAnchor="end"
            >
              {formatarMoeda(t.centavos, moeda)}
            </text>
          </g>
        ))}
        {g.area !== "" ? <path className={styles["area"]} d={g.area} /> : null}
        {g.linha !== "" ? <polyline className={styles["linha"]} points={g.linha} /> : null}
        {serie.length <= 45
          ? g.pontos.map((p) => (
              <circle key={p.dia} className={styles["ponto"]} cx={p.x} cy={p.y} r={2.5} />
            ))
          : null}
        {rotulosX.map((p, idx) => {
          if (p === undefined) return null;
          const ponto = g.pontos.find((q) => q.dia === p.dia);
          if (ponto === undefined) return null;
          const ancora = idx === 0 ? "start" : idx === rotulosX.length - 1 ? "end" : "middle";
          return (
            <text
              key={p.dia}
              className={styles["eixoTexto"]}
              x={ponto.x}
              y={ALTURA - 8}
              textAnchor={ancora}
            >
              {formatarDiaCurto(p.dia)}
            </text>
          );
        })}
      </svg>

      <details className={styles["detalhes"]}>
        <summary>Ver os valores diários em tabela</summary>
        <div className={styles["rolagem"]}>
          <table className={styles["tabela"]}>
            <caption>{resumo}</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col" className={styles["numero"]}>
                  Vendas
                </th>
                <th scope="col" className={styles["numero"]}>
                  Receita bruta
                </th>
              </tr>
            </thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.dia}>
                  <th scope="row">{formatarDia(p.dia)}</th>
                  <td className={styles["numero"]}>{formatarInteiro(p.vendas)}</td>
                  <td className={styles["numero"]}>{formatarMoeda(p.receitaCentavos, moeda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
