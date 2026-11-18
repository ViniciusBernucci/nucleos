import type { FluxoCaixaMes } from "@nucleos/contracts";
import { formatarReais } from "../../../../../../lib/fluxo-caixa-formato.ts";
import styles from "../fluxo-de-caixa.module.css";

interface Cartao {
  rotulo: string;
  valor: number;
  detalhe: string;
  /** Destaca o cartao quando o valor indica atencao (saldo negativo, contas em aberto). */
  atencao?: boolean;
}

/** Saldos do mes: realizado (lancamentos) e projetado (descontando contas ainda nao pagas). */
export function Resumo({ fluxo }: { fluxo: FluxoCaixaMes }) {
  const r = fluxo.resumo;
  const atrasadas = fluxo.contasDoMes.filter((c) => c.status === "atrasada").length;
  const cartoes: Cartao[] = [
    {
      rotulo: "Saldo inicial",
      valor: r.saldoInicialCentavos,
      detalhe: "Acumulado até o mês anterior",
    },
    { rotulo: "Entradas", valor: r.entradasCentavos, detalhe: "Realizadas no mês" },
    {
      rotulo: "Saídas",
      valor: r.saidasCentavos,
      detalhe: "Realizadas no mês, inclui contas pagas",
    },
    {
      rotulo: "Saldo do mês",
      valor: r.saldoFinalCentavos,
      detalhe: "Inicial + entradas − saídas",
      atencao: r.saldoFinalCentavos < 0,
    },
    {
      rotulo: "Contas a pagar",
      valor: r.aPagarCentavos,
      detalhe:
        atrasadas > 0
          ? `${String(atrasadas)} atrasada(s) neste mês`
          : "Recorrentes do mês ainda não pagas",
      atencao: atrasadas > 0,
    },
    {
      rotulo: "Saldo projetado",
      valor: r.saldoProjetadoCentavos,
      detalhe: "Saldo do mês − contas a pagar",
      atencao: r.saldoProjetadoCentavos < 0,
    },
  ];
  return (
    <section aria-labelledby="resumo-titulo">
      <h2 id="resumo-titulo" className="visually-hidden">
        Resumo do mês
      </h2>
      <ul className={`kpi-grid ${styles["semMarcador"] ?? ""}`}>
        {cartoes.map((c) => (
          <li key={c.rotulo} className={`kpi-card${c.atencao ? " kpi-card--attn" : ""}`}>
            <span className="kpi-card__label">{c.rotulo}</span>
            <span className="kpi-card__value">{formatarReais(c.valor)}</span>
            <span className="kpi-card__detail">{c.detalhe}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
