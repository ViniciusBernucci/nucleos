/** Apenas servidor: a chave permanece no Next e não é incluída nos props de componentes client. */
import type { Setor } from "@nucleos/contracts";
import { configuracao } from "./vendas-api.ts";
export type ResultadoFuncionarios<T> = { ok: true; dados: T } | { ok: false; mensagem: string };
export async function funcionariosApi<T>(
  caminho = "",
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  corpo?: unknown,
): Promise<ResultadoFuncionarios<T>> {
  const cfg = configuracao();
  if (cfg === undefined)
    return {
      ok: false,
      mensagem: "Configure a chave de serviço no servidor web para acessar Funcionários.",
    };
  try {
    const resposta = await fetch(`${cfg.base}/v1/funcionarios${caminho}`, {
      method,
      headers: { authorization: `Bearer ${cfg.chave}`, "content-type": "application/json" },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok)
      return {
        ok: false,
        mensagem:
          resposta.status === 400
            ? "Confira os campos e a configuração da tarefa."
            : resposta.status === 409
              ? "A operação conflita com o estado atual. Tarefas planejadas não podem executar."
              : resposta.status === 404
                ? "Registro ou módulo não encontrado. Verifique as migrations da API."
                : resposta.status === 401 || resposta.status === 503
                  ? "A chave de serviço não foi configurada ou foi recusada."
                  : "A API de Funcionários está indisponível.",
      };
    return { ok: true, dados: (await resposta.json()) as T };
  } catch {
    return { ok: false, mensagem: "Não foi possível acessar a API de Funcionários agora." };
  }
}
export async function setoresMenu(): Promise<Setor[]> {
  const r = await funcionariosApi<Setor[]>("/setores");
  return r.ok && Array.isArray(r.dados) ? r.dados : [];
}
