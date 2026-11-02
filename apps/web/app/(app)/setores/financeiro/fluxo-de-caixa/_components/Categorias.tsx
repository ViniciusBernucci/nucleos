import type { Categoria, TipoLancamento } from "@nucleos/contracts";
import { criarCategoria, excluirCategoria } from "../actions.ts";
import styles from "../fluxo-de-caixa.module.css";
import { FormularioAcao } from "./FormularioAcao.tsx";
import { PainelLateral } from "./PainelLateral.tsx";

const GRUPOS: { tipo: TipoLancamento; titulo: string }[] = [
  { tipo: "entrada", titulo: "Categorias de entrada" },
  { tipo: "saida", titulo: "Categorias de saída" },
];

/**
 * Off-canvas de cadastro de categorias. Fica aberto apos cada operacao, para cadastrar varias
 * seguidas; a lista se atualiza pela revalidacao da pagina.
 */
export function Categorias({ categorias }: { categorias: readonly Categoria[] }) {
  return (
    <PainelLateral
      rotuloBotao="Categorias"
      titulo="Categorias de entradas e saídas"
      varianteBotao="secondary"
      fecharAoConcluir={false}
    >
      <FormularioAcao
        acao={criarCategoria}
        rotulo="Adicionar categoria"
        rotuloPendente="Adicionando…"
        className={styles["formularioPainel"]}
      >
        <label className={styles["campo"]}>
          Tipo
          <select className="control-select" name="tipo" defaultValue="saida" required>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </label>
        <label className={styles["campo"]}>
          Nome
          <input
            className="control-input"
            name="nome"
            maxLength={60}
            required
            placeholder="Ex.: Marketing"
          />
        </label>
      </FormularioAcao>

      {GRUPOS.map((g) => {
        const lista = categorias.filter((c) => c.tipo === g.tipo);
        return (
          <section key={g.tipo} aria-label={g.titulo}>
            <h3>{g.titulo}</h3>
            {lista.length === 0 ? (
              <p className={styles["ajuda"]}>Nenhuma categoria cadastrada.</p>
            ) : (
              <ul className={styles["listaCategorias"]}>
                {lista.map((c) => (
                  <li key={c.id}>
                    <span>{c.nome}</span>
                    <FormularioAcao
                      acao={excluirCategoria}
                      rotulo="Excluir"
                      rotuloPendente="Excluindo…"
                      variante="secondary"
                      className={styles["formulario"]}
                    >
                      <input type="hidden" name="id" value={c.id} />
                    </FormularioAcao>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className={styles["ajuda"]}>
        Excluir uma categoria não altera lançamentos e contas já registrados; ela só deixa de
        aparecer nas opções.
      </p>
    </PainelLateral>
  );
}
