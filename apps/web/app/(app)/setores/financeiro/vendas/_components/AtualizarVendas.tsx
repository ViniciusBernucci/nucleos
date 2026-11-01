"use client";

import { useActionState } from "react";
import { atualizarPainel } from "../actions.ts";

export function AtualizarVendas({ habilitada }: { habilitada: boolean }) {
  const [estado, enviar, pendente] = useActionState(atualizarPainel, { erro: false, mensagem: "" });
  return (
    <form action={enviar} aria-busy={pendente}>
      <button className="btn btn--primary" type="submit" disabled={pendente || !habilitada}>
        {pendente ? "Atualizando vendas…" : "Atualizar agora"}
      </button>
      {estado.mensagem ? <p role={estado.erro ? "alert" : "status"}>{estado.mensagem}</p> : null}
    </form>
  );
}
