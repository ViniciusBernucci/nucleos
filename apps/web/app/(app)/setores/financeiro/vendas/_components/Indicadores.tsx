import type { PainelVendas } from "@nucleos/contracts";
import {
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
  variacao,
} from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

interface Cartao {
  rotulo: string;
  valor: string;
  detalhe: string;
  atual: number;
  anterior: number;
  /** Para reembolsos, subir e ruim. */
  menorEMelhor?: boolean;
}

function Tendencia({
  atual,
  anterior,
  menorEMelhor = false,
}: Pick<Cartao, "atual" | "anterior" | "menorEMelhor">) {
  const v = variacao(atual, anterior);
  const bom = menorEMelhor ? v.direcao === "baixa" : v.direcao === "alta";
  const ruim = menorEMelhor ? v.direcao === "alta" : v.direcao === "baixa";
  const classe = `${styles["tendencia"] ?? ""} ${bom ? (styles["tendenciaAlta"] ?? "") : ruim ? (styles["tendenciaBaixa"] ?? "") : ""}`;
  return <span className={classe}>{v.texto}</span>;
}

/** Indicadores do periodo com variacao frente ao periodo anterior de mesma duracao. */
export function Indicadores({ painel }: { painel: PainelVendas }) {
  const { indicadores: i, indicadoresAnteriores: a, moeda } = painel;
  const dinheiro = (c: number): string => formatarMoeda(c, moeda);
  const cartoes: Cartao[] = [
    {
      rotulo: "Receita bruta",
      valor: dinheiro(i.receitaBrutaCentavos),
      detalhe: `Taxas Hotmart: ${dinheiro(i.taxasCentavos)}`,
      atual: i.receitaBrutaCentavos,
      anterior: a.receitaBrutaCentavos,
    },
    {
      rotulo: "Receita líquida (estimada)",
      valor: dinheiro(i.receitaLiquidaCentavos),
      detalhe: "Bruta menos taxas da Hotmart",
      atual: i.receitaLiquidaCentavos,
      anterior: a.receitaLiquidaCentavos,
    },
    {
      rotulo: "Vendas aprovadas",
      valor: formatarInteiro(i.vendas),
      detalhe: `${formatarInteiro(i.vendasAssinatura)} de assinaturas`,
      atual: i.vendas,
      anterior: a.vendas,
    },
    {
      rotulo: "Ticket médio",
      valor: dinheiro(i.ticketMedioCentavos),
      detalhe: "Receita bruta por venda",
      atual: i.ticketMedioCentavos,
      anterior: a.ticketMedioCentavos,
    },
    {
      rotulo: "Compradores únicos",
      valor: formatarInteiro(i.compradoresUnicos),
      detalhe: "Contados por identificador anônimo",
      atual: i.compradoresUnicos,
      anterior: a.compradoresUnicos,
    },
    {
      rotulo: "Reembolsos e chargebacks",
      valor: dinheiro(i.reembolsadoCentavos),
      detalhe: `${formatarInteiro(i.reembolsos)} ocorrência(s) · taxa ${formatarPercentual(i.taxaReembolso)}`,
      atual: i.reembolsadoCentavos,
      anterior: a.reembolsadoCentavos,
      menorEMelhor: true,
    },
  ];

  return (
    <section aria-labelledby="indicadores-titulo">
      <h2 id="indicadores-titulo" className="visually-hidden">
        Indicadores do período
      </h2>
      <div className="kpi-grid">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="kpi-card">
            <span className="kpi-card__label">{c.rotulo}</span>
            <span className="kpi-card__value">{c.valor}</span>
            <span className="kpi-card__detail">{c.detalhe}</span>
            <Tendencia
              atual={c.atual}
              anterior={c.anterior}
              {...(c.menorEMelhor === true ? { menorEMelhor: true } : {})}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
