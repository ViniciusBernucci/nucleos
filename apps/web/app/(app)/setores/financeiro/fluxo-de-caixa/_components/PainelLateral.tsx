"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { EVENTO_ACAO_CONCLUIDA } from "../../../../../../lib/fluxo-caixa-formato.ts";
import styles from "../fluxo-de-caixa.module.css";

/**
 * Off-canvas a direita sobre `<dialog>` nativo: foco preso, Esc fecha e o resto da pagina fica inerte.
 * Fecha sozinho quando um FormularioAcao interno conclui com sucesso; ao reabrir, o conteudo e
 * remontado (formulario limpo, sem a mensagem anterior).
 */
export function PainelLateral({
  rotuloBotao,
  titulo,
  fecharAoConcluir = true,
  varianteBotao = "primary",
  children,
}: {
  rotuloBotao: string;
  titulo: string;
  /** Falso para paineis de varias operacoes seguidas (ex.: cadastro de categorias). */
  fecharAoConcluir?: boolean;
  varianteBotao?: "primary" | "secondary";
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abertura, setAbertura] = useState(0);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (d === null || !fecharAoConcluir) return;
    const fechar = (): void => {
      d.close();
    };
    d.addEventListener(EVENTO_ACAO_CONCLUIDA, fechar);
    return () => {
      d.removeEventListener(EVENTO_ACAO_CONCLUIDA, fechar);
    };
  }, [fecharAoConcluir]);

  return (
    <>
      <button
        type="button"
        className={`btn btn--${varianteBotao}`}
        aria-haspopup="dialog"
        onClick={() => {
          setAbertura((n) => n + 1);
          dialogo.current?.showModal();
        }}
      >
        {rotuloBotao}
      </button>
      <dialog
        ref={dialogo}
        className={styles["painelLateral"]}
        aria-labelledby={idTitulo}
        // Clique no fundo escurecido (fora do conteudo) fecha o painel.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={styles["painelConteudo"]}>
          <header className={styles["painelTopo"]}>
            <h2 id={idTitulo}>{titulo}</h2>
            <button
              type="button"
              className="btn btn--secondary"
              aria-label="Fechar"
              onClick={() => dialogo.current?.close()}
            >
              ✕
            </button>
          </header>
          <div key={abertura}>{children}</div>
        </div>
      </dialog>
    </>
  );
}
