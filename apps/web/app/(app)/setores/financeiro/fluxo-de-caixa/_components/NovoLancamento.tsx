import type { FluxoCaixaMes } from "@nucleos/contracts";
import { diaSugerido } from "../../../../../../lib/fluxo-caixa-formato.ts";
import { criarLancamento } from "../actions.ts";
import styles from "../fluxo-de-caixa.module.css";
import { Categorias } from "./Categorias.tsx";
import { FormularioAcao } from "./FormularioAcao.tsx";
import { SeletorTipoCategoria } from "./SeletorCategoria.tsx";

/** Entrada ou saida avulsa (ex.: aporte, venda no balcao, compra de material). */
export function NovoLancamento({ fluxo }: { fluxo: FluxoCaixaMes }) {
  return (
    <section className="panel-card" aria-labelledby="novo-lancamento-titulo">
      <div className="panel-header">
        <h2 id="novo-lancamento-titulo">Novo lançamento</h2>
        <Categorias categorias={fluxo.categorias} />
      </div>
      <FormularioAcao
        acao={criarLancamento}
        rotulo="Registrar"
        rotuloPendente="Registrando…"
        className={styles["formulario"]}
      >
        <SeletorTipoCategoria categorias={fluxo.categorias} />
        <label className={`${styles["campo"] ?? ""} ${styles["campoLargo"] ?? ""}`}>
          Descrição
          <input className="control-input" name="descricao" maxLength={120} required />
        </label>
        <label className={`${styles["campo"] ?? ""} ${styles["campoValor"] ?? ""}`}>
          Valor (R$)
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
          Data
          <input
            className="control-input"
            type="date"
            name="data"
            required
            defaultValue={diaSugerido(fluxo.mes, fluxo.hoje)}
          />
        </label>
      </FormularioAcao>
    </section>
  );
}
