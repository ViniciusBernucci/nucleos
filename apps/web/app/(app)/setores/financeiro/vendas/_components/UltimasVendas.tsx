import type { ListaVendas } from "@nucleos/contracts";
import {
  formatarInteiro,
  formatarMoeda,
  rotuloPagamento,
  rotuloStatus,
} from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

const GRUPO_BADGE = {
  receita: "badge badge--ok",
  reembolso: "badge badge--danger",
  cancelada: "badge badge--warn",
  pendente: "badge badge--info",
} as const;

const data = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

/** Vendas mais recentes do periodo. O comprador aparece so como codigo anonimo. */
export function UltimasVendas({ lista }: { lista: ListaVendas }) {
  return (
    <section className="panel-card" aria-labelledby="ultimas-titulo">
      <div className="panel-header">
        <h2 id="ultimas-titulo">Últimas vendas</h2>
        <span className="kpi-card__detail">
          {formatarInteiro(lista.itens.length)} de {formatarInteiro(lista.total)} no período
        </span>
      </div>
      {lista.itens.length === 0 ? (
        <div className="state-box" role="status">
          Nenhuma venda no período selecionado.
        </div>
      ) : (
        <div className={styles["rolagem"]}>
          <table className={styles["tabela"]}>
            <caption className="visually-hidden">Vendas mais recentes do período</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Produto</th>
                <th scope="col">Status</th>
                <th scope="col">Pagamento</th>
                <th scope="col">Comprador</th>
                <th scope="col" className={styles["numero"]}>
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((v) => (
                <tr key={v.transacao}>
                  <td>{data.format(new Date(v.pedidoEm))}</td>
                  <td>{v.produtoNome}</td>
                  <td>
                    <span className={GRUPO_BADGE[v.grupo]}>{rotuloStatus(v.status)}</span>
                  </td>
                  <td>
                    {rotuloPagamento(v.pagamento)}
                    {v.parcelas > 1 ? ` · ${String(v.parcelas)}x` : ""}
                  </td>
                  <td>
                    <code>{v.compradorId.slice(0, 8)}</code>
                  </td>
                  <td className={styles["numero"]}>{formatarMoeda(v.valorCentavos, v.moeda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
