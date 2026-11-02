import type { FluxoCaixaMes } from "@nucleos/contracts";
import { diaCurto, formatarReais, mesCurto } from "../../../../../../lib/fluxo-caixa-formato.ts";
import { excluirLancamento } from "../actions.ts";
import styles from "../fluxo-de-caixa.module.css";
import { FormularioAcao } from "./FormularioAcao.tsx";

/** Extrato do mes em ordem de data, com o saldo acumulado depois de cada lancamento. */
export function Movimentacoes({ fluxo }: { fluxo: FluxoCaixaMes }) {
  return (
    <section className="panel-card" aria-labelledby="movimentos-titulo">
      <div className="panel-header">
        <h2 id="movimentos-titulo">Movimentações do mês</h2>
        <span className="kpi-card__detail">
          Saldo inicial {formatarReais(fluxo.resumo.saldoInicialCentavos)}
        </span>
      </div>
      {fluxo.movimentos.length === 0 ? (
        <div className="state-box" role="status">
          Nenhuma entrada ou saída registrada neste mês.
        </div>
      ) : (
        <div className={styles["rolagem"]}>
          <table className={styles["tabela"]}>
            <caption className="visually-hidden">Entradas e saídas do mês com saldo</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Categoria</th>
                <th scope="col">Origem</th>
                <th scope="col" className={styles["numero"]}>
                  Valor
                </th>
                <th scope="col" className={styles["numero"]}>
                  Saldo
                </th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fluxo.movimentos.map((m) => (
                <tr key={m.id}>
                  <td>{diaCurto(m.data)}</td>
                  <td>{m.descricao}</td>
                  <td>{m.categoria}</td>
                  <td>
                    {m.competencia === null
                      ? "Manual"
                      : `Conta recorrente · ${mesCurto(m.competencia)}`}
                  </td>
                  <td
                    className={`${styles["numero"] ?? ""} ${(m.tipo === "entrada" ? styles["entrada"] : styles["saida"]) ?? ""}`}
                  >
                    {m.tipo === "entrada" ? "+" : "−"} {formatarReais(m.valorCentavos)}
                  </td>
                  <td
                    className={`${styles["numero"] ?? ""} ${m.saldoAposCentavos < 0 ? (styles["negativo"] ?? "") : ""}`}
                  >
                    {formatarReais(m.saldoAposCentavos)}
                  </td>
                  <td>
                    <FormularioAcao
                      acao={excluirLancamento}
                      rotulo="Excluir"
                      rotuloPendente="Excluindo…"
                      variante="secondary"
                      className={styles["formulario"]}
                    >
                      <input type="hidden" name="id" value={m.id} />
                    </FormularioAcao>
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
