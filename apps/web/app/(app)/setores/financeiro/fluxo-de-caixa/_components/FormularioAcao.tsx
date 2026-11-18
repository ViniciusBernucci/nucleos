"use client";

import { type ReactNode, useActionState, useEffect, useRef } from "react";
import {
  ESTADO_INICIAL,
  EVENTO_ACAO_CONCLUIDA,
  type EstadoAcao,
} from "../../../../../../lib/fluxo-caixa-formato.ts";

/**
 * Formulario ligado a uma Server Action: desabilita o botao durante o envio e mostra o retorno.
 * No sucesso dispara `EVENTO_ACAO_CONCLUIDA` (borbulha), que o PainelLateral usa para fechar.
 */
export function FormularioAcao({
  acao,
  rotulo,
  rotuloPendente,
  variante = "primary",
  className,
  children,
}: {
  acao: (estado: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
  rotulo: string;
  rotuloPendente: string;
  variante?: "primary" | "secondary" | "danger";
  className?: string | undefined;
  children?: ReactNode;
}) {
  const [estado, enviar, pendente] = useActionState(acao, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Cada envio devolve um objeto novo, entao o efeito roda uma vez por resultado.
  useEffect(() => {
    if (estado !== ESTADO_INICIAL && !estado.erro) {
      formulario.current?.dispatchEvent(new Event(EVENTO_ACAO_CONCLUIDA, { bubbles: true }));
    }
  }, [estado]);

  return (
    <form ref={formulario} action={enviar} aria-busy={pendente} className={className}>
      {children}
      <button className={`btn btn--${variante}`} type="submit" disabled={pendente}>
        {pendente ? rotuloPendente : rotulo}
      </button>
      {estado.mensagem ? (
        <p role={estado.erro ? "alert" : "status"} data-erro={estado.erro}>
          {estado.mensagem}
        </p>
      ) : null}
    </form>
  );
}
