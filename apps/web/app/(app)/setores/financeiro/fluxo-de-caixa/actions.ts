"use server";

import { revalidatePath } from "next/cache";
import * as regras from "../../../../../lib/fluxo-caixa-acoes.ts";
import type { EstadoAcao } from "../../../../../lib/fluxo-caixa-formato.ts";

type Acao = (f: FormData) => Promise<EstadoAcao>;

async function comRevalidacao(acao: Acao, f: FormData): Promise<EstadoAcao> {
  const estado = await acao(f);
  if (!estado.erro) revalidatePath("/setores/financeiro/fluxo-de-caixa");
  return estado;
}

export async function criarLancamento(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.criarLancamento, f);
}

export async function excluirLancamento(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.excluirLancamento, f);
}

export async function criarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.criarConta, f);
}

export async function pagarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.pagarConta, f);
}

export async function encerrarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.encerrarConta, f);
}

export async function reativarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.reativarConta, f);
}

export async function excluirConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.excluirConta, f);
}

export async function criarCategoria(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.criarCategoria, f);
}

export async function excluirCategoria(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return comRevalidacao(regras.excluirCategoria, f);
}
