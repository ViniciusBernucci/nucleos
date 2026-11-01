import { atualizarVendasAgora, MENSAGENS_FALHA } from "./vendas-api.ts";

export interface EstadoAtualizacao {
  erro: boolean;
  mensagem: string;
}

const MENSAGENS = {
  sucesso: "Vendas atualizadas com os dados mais recentes da Hotmart.",
  parcial: "Atualização parcial. Alguns dados não puderam ser consultados na Hotmart.",
  falha: "Não foi possível atualizar os dados da Hotmart. Confira o estado da sincronização.",
  ocupada: "Já existe uma atualização em andamento. Aguarde e tente novamente.",
  desabilitada: "Configure as credenciais da Hotmart na API para atualizar as vendas.",
};

/** Mantem mensagens fixas: nenhum corpo de erro externo e enviado ao cliente. */
export async function executarAtualizacao(): Promise<EstadoAtualizacao> {
  const r = await atualizarVendasAgora();
  if (r.tipo === "nao-configurado") {
    return { erro: true, mensagem: "O painel ainda não está conectado à API de vendas." };
  }
  if (r.tipo === "erro") return { erro: true, mensagem: MENSAGENS_FALHA[r.falha] };
  return { erro: r.dados.resultado !== "sucesso", mensagem: MENSAGENS[r.dados.resultado] };
}
