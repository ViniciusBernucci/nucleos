"use server";

import { revalidatePath } from "next/cache";
import {
  executarAtualizacao,
  type EstadoAtualizacao,
} from "../../../../../lib/vendas-atualizacao.ts";

export async function atualizarPainel(): Promise<EstadoAtualizacao> {
  const resultado = await executarAtualizacao();
  revalidatePath("/setores/financeiro/vendas");
  return resultado;
}
