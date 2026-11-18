import type { FluxoCaixaMes } from "@nucleos/contracts";
import {
  ROTULO_STATUS,
  centavosParaCampo,
  diaCurto,
  formatarReais,
} from "../../../../../../lib/fluxo-caixa-formato.ts";
import { excluirLancamento, pagarConta } from "../actions.ts";
import styles from "../fluxo-de-caixa.module.css";
import { FormularioAcao } from "./FormularioAcao.tsx";

const BADGE = {
  paga: "badge badge--ok",
  pendente: "badge badge--info",
  atrasada: "badge badge--danger",
} as const;

/** Contas recorrentes que vencem no mes, com registro do pagamento (valor e data reais). */
export function ContasDoMes({ fluxo }: { fluxo: FluxoCaixaMes }) {
  const mesCorrente = fluxo.hoje.startsWith(fluxo.mes);
  return (
    <section className="panel-card" aria-labelledby="contas-mes-titulo">
      <div className="panel-header">
        <h2 id="contas-mes-titulo">Contas a pagar do mês</h2>
        <span className="kpi-card__detail">
          {formatarReais(fluxo.resumo.aPagarCentavos)} em aberto
        </span>
      </div>
      {fluxo.contasDoMes.length === 0 ? (
        <div className="state-box" role="status">
          Nenhuma conta recorrente vence neste mês. Cadastre as contas frequentes em “Contas
          recorrentes”, mais abaixo.
        </div>
      ) : (
        <div className={styles["rolagem"]}>
          <table className={styles["tabela"]}>
            <caption className="visually-hidden">Contas recorrentes que vencem no mês</caption>
            <thead>
              <tr>
                <th scope="col">Vence</th>
                <th scope="col">Conta</th>
                <th scope="col" className={styles["numero"]}>
                  Valor
                </th>
                <th scope="col">Situação</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.contasDoMes.map((c) => (
                <tr key={c.contaId}>
                  <td>{diaCurto(c.vencimento)}</td>
                  <td>
                    {c.descricao}
                    <br />
                    <span className="kpi-card__detail">{c.categoria}</span>
                  </td>
                  <td className={styles["numero"]}>
                    {formatarReais(c.pagamento?.valorCentavos ?? c.valorPrevistoCentavos)}
                    {c.pagamento !== null &&
                    c.pagamento.valorCentavos !== c.valorPrevistoCentavos ? (
                      <>
                        <br />
                        <span className="kpi-card__detail">
                          previsto {formatarReais(c.valorPrevistoCentavos)}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className={BADGE[c.status]}>{ROTULO_STATUS[c.status]}</span>
                    {c.pagamento !== null ? (
                      <>
                        <br />
                        <span className="kpi-card__detail">em {diaCurto(c.pagamento.data)}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {c.pagamento === null ? (
                      <details className={styles["detalhes"]}>
                        <summary>Registrar pagamento</summary>
                        <FormularioAcao
                          acao={pagarConta}
                          rotulo="Confirmar pagamento"
                          rotuloPendente="Registrando…"
                          className={styles["formulario"]}
                        >
                          <input type="hidden" name="id" value={c.contaId} />
                          <input type="hidden" name="competencia" value={fluxo.mes} />
                          <label className={styles["campo"]}>
                            Pago em
                            <input
                              className="control-input"
                              type="date"
                              name="data"
                              required
                              defaultValue={mesCorrente ? fluxo.hoje : c.vencimento}
                            />
                          </label>
                          <label
                            className={`${styles["campo"] ?? ""} ${styles["campoValor"] ?? ""}`}
                          >
                            Valor pago (R$)
                            <input
                              className="control-input"
                              type="number"
                              name="valor"
                              min="0.01"
                              step="0.01"
                              required
                              defaultValue={centavosParaCampo(c.valorPrevistoCentavos)}
                            />
                          </label>
                        </FormularioAcao>
                      </details>
                    ) : (
                      <FormularioAcao
                        acao={excluirLancamento}
                        rotulo="Desfazer pagamento"
                        rotuloPendente="Desfazendo…"
                        variante="secondary"
                        className={styles["formulario"]}
                      >
                        <input type="hidden" name="id" value={c.pagamento.lancamentoId} />
                      </FormularioAcao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
