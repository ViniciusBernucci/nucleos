/**
 * Regras das Server Actions do fluxo de caixa, fora do arquivo "use server" para testar no Node.
 * Cada acao valida o formulario antes de chamar a API e devolve so mensagens fixas ao cliente.
 */
import { alterarFluxo, type FalhaFluxo, MENSAGENS_FALHA_FLUXO } from "./fluxo-caixa-api.ts";
import {
  contaDoFormulario,
  type EstadoAcao,
  idDoFormulario,
  type Leitura,
  lancamentoDoFormulario,
  mesValido,
  categoriaDoFormulario,
  pagamentoDoFormulario,
} from "./fluxo-caixa-formato.ts";

const NAO_CONFIGURADO = "O fluxo de caixa ainda não está conectado à API do financeiro.";
const SEM_ID = "Registro inválido. Recarregue a página e tente de novo.";

async function executar(
  caminho: string,
  method: "POST" | "DELETE",
  corpo: unknown,
  sucesso: string,
  conflito?: string,
): Promise<EstadoAcao> {
  const r = await alterarFluxo(caminho, method, corpo);
  if (r.tipo === "nao-configurado") return { erro: true, mensagem: NAO_CONFIGURADO };
  if (r.tipo === "erro") {
    const falha: FalhaFluxo = r.falha;
    return {
      erro: true,
      mensagem: falha === "conflito" && conflito ? conflito : MENSAGENS_FALHA_FLUXO[falha],
    };
  }
  return { erro: false, mensagem: sucesso };
}

function comLeitura<T>(
  leitura: Leitura<T>,
  fn: (valor: T) => Promise<EstadoAcao>,
): Promise<EstadoAcao> {
  return leitura.ok
    ? fn(leitura.valor)
    : Promise.resolve({ erro: true, mensagem: leitura.mensagem });
}

export function criarLancamento(f: FormData): Promise<EstadoAcao> {
  return comLeitura(lancamentoDoFormulario(f), (l) =>
    executar(
      "/lancamentos",
      "POST",
      l,
      l.tipo === "entrada" ? "Entrada registrada." : "Saída registrada.",
    ),
  );
}

export function excluirLancamento(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  return executar(`/lancamentos/${id}`, "DELETE", undefined, "Lançamento excluído.");
}

export function criarConta(f: FormData): Promise<EstadoAcao> {
  return comLeitura(contaDoFormulario(f), (c) =>
    executar("/contas", "POST", c, "Conta recorrente cadastrada."),
  );
}

export function pagarConta(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  return comLeitura(pagamentoDoFormulario(f), (p) =>
    executar(
      `/contas/${id}/pagamentos`,
      "POST",
      p,
      "Pagamento registrado.",
      "Esta conta já está paga neste mês.",
    ),
  );
}

export function encerrarConta(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  const campo = f.get("ultimoMes");
  const ultimoMes = typeof campo === "string" ? campo.trim() : "";
  if (ultimoMes !== "" && !mesValido(ultimoMes)) {
    return Promise.resolve({ erro: true, mensagem: "Informe o último mês de vencimento." });
  }
  return executar(
    `/contas/${id}/encerrar`,
    "POST",
    ultimoMes === "" ? {} : { ultimoMes },
    "Conta encerrada.",
    "Há pagamento registrado depois do último mês escolhido.",
  );
}

export function reativarConta(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  return executar(`/contas/${id}/reativar`, "POST", {}, "Conta reativada.");
}

export function excluirConta(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  return executar(
    `/contas/${id}`,
    "DELETE",
    undefined,
    "Conta excluída.",
    "A conta tem pagamentos registrados. Encerre-a para manter o histórico.",
  );
}

export function criarCategoria(f: FormData): Promise<EstadoAcao> {
  return comLeitura(categoriaDoFormulario(f), (c) =>
    executar(
      "/categorias",
      "POST",
      c,
      `Categoria “${c.nome}” cadastrada.`,
      "Já existe uma categoria com esse nome para esse tipo.",
    ),
  );
}

export function excluirCategoria(f: FormData): Promise<EstadoAcao> {
  const id = idDoFormulario(f);
  if (id === null) return Promise.resolve({ erro: true, mensagem: SEM_ID });
  return executar(`/categorias/${id}`, "DELETE", undefined, "Categoria excluída.");
}
