import type { FluxoCaixaMes } from "@nucleos/contracts";
import { formatarReais, mesCurto } from "../../../../../../lib/fluxo-caixa-formato.ts";
import { criarConta, encerrarConta, excluirConta, reativarConta } from "../actions.ts";
import styles from "../fluxo-de-caixa.module.css";
import { FormularioAcao } from "./FormularioAcao.tsx";
import { PainelLateral } from "./PainelLateral.tsx";
import { CampoCategoria } from "./SeletorCategoria.tsx";

/** Cadastro das contas a pagar frequentes (mensais): aluguel, internet, contador etc. */
export function ContasRecorrentes({ fluxo }: { fluxo: FluxoCaixaMes }) {
  const mesCorrente = fluxo.hoje.slice(0, 7);
  return (
    <section className="panel-card" aria-labelledby="recorrentes-titulo">
      <div className="panel-header">
        <h2 id="recorrentes-titulo">Contas recorrentes</h2>
        <NovaConta fluxo={fluxo} />
      </div>
      <p className={styles["ajuda"]}>Vencem todo mês no dia informado.</p>

      {fluxo.contas.length === 0 ? (
        <div className="state-box" role="status">
          Nenhuma conta recorrente cadastrada ainda.
        </div>
      ) : (
        <div className={styles["rolagem"]}>
          <table className={styles["tabela"]}>
            <caption className="visually-hidden">Contas a pagar recorrentes cadastradas</caption>
            <thead>
              <tr>
                <th scope="col">Conta</th>
                <th scope="col" className={styles["numero"]}>
                  Valor previsto
                </th>
                <th scope="col">Dia</th>
                <th scope="col">Vigência</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.contas.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.descricao}
                    <br />
                    <span className="kpi-card__detail">{c.categoria}</span>
                  </td>
                  <td className={styles["numero"]}>{formatarReais(c.valorCentavos)}</td>
                  <td>{c.diaVencimento}</td>
                  <td>
                    {mesCurto(c.inicio)} – {c.fim === null ? "sem prazo" : mesCurto(c.fim)}
                    <br />
                    <span className={c.vigente ? "badge badge--ok" : "badge badge--warn"}>
                      {c.vigente ? "Vigente" : "Encerrada"}
                    </span>
                  </td>
                  <td>
                    <div className={styles["acoes"]}>
                      {c.fim === null ? (
                        <details className={styles["detalhes"]}>
                          <summary>Encerrar</summary>
                          <FormularioAcao
                            acao={encerrarConta}
                            rotulo="Confirmar encerramento"
                            rotuloPendente="Encerrando…"
                            variante="secondary"
                            className={styles["formulario"]}
                          >
                            <input type="hidden" name="id" value={c.id} />
                            <label className={styles["campo"]}>
                              Último vencimento
                              <input
                                className="control-input"
                                type="month"
                                name="ultimoMes"
                                required
                                min={c.inicio}
                                defaultValue={mesCorrente < c.inicio ? c.inicio : mesCorrente}
                              />
                            </label>
                          </FormularioAcao>
                        </details>
                      ) : (
                        <FormularioAcao
                          acao={reativarConta}
                          rotulo="Reativar"
                          rotuloPendente="Reativando…"
                          variante="secondary"
                          className={styles["formulario"]}
                        >
                          <input type="hidden" name="id" value={c.id} />
                        </FormularioAcao>
                      )}
                      <FormularioAcao
                        acao={excluirConta}
                        rotulo="Excluir"
                        rotuloPendente="Excluindo…"
                        variante="danger"
                        className={styles["formulario"]}
                      >
                        <input type="hidden" name="id" value={c.id} />
                      </FormularioAcao>
                    </div>
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

/** Off-canvas a direita com o cadastro; fecha sozinho quando a conta e cadastrada. */
function NovaConta({ fluxo }: { fluxo: FluxoCaixaMes }) {
  return (
    <PainelLateral rotuloBotao="Nova conta recorrente" titulo="Nova conta recorrente">
      <FormularioAcao
        acao={criarConta}
        rotulo="Cadastrar conta"
        rotuloPendente="Cadastrando…"
        className={styles["formularioPainel"]}
      >
        <label className={styles["campo"]}>
          Descrição
          <input
            className="control-input"
            name="descricao"
            maxLength={120}
            required
            placeholder="Ex.: Aluguel da sala"
          />
        </label>
        <CampoCategoria categorias={fluxo.categorias} tipo="saida" />
        <label className={styles["campo"]}>
          Valor previsto (R$)
          <input
            className="control-input"
            type="number"
            name="valor"
            min="0.01"
            step="0.01"
            required
          />
        </label>
        <label className={styles["campo"]}>
          Dia do vencimento
          <input
            className="control-input"
            type="number"
            name="diaVencimento"
            min="1"
            max="31"
            step="1"
            required
            defaultValue="10"
          />
        </label>
        <label className={styles["campo"]}>
          Primeiro mês
          <input
            className="control-input"
            type="month"
            name="inicio"
            required
            defaultValue={fluxo.mes}
          />
        </label>
        <label className={styles["campo"]}>
          Último mês (opcional)
          <input className="control-input" type="month" name="fim" />
        </label>
      </FormularioAcao>
      <p className={styles["ajuda"]}>
        Em meses mais curtos, vencimentos nos dias 29 a 31 caem no último dia do mês. O valor pago
        pode ser diferente do previsto (por exemplo, contas de consumo). Só aparecem categorias de
        saída; cadastre novas em “Categorias”, no painel Novo lançamento.
      </p>
    </PainelLateral>
  );
}
