"use server";
import { revalidatePath } from "next/cache";
import { funcionariosApi } from "../../../lib/funcionarios-api.ts";
import type { EstadoAcao } from "../../../lib/fluxo-caixa-formato.ts";
const id = (f: FormData, nome: string): string => {
  const v = f.get(nome);
  if (typeof v !== "string" || !/^\d{1,19}$/.test(v)) throw new Error("id invalido");
  return v;
};
const texto = (f: FormData, nome: string, padrao = ""): string => {
  const v = f.get(nome);
  return typeof v === "string" ? v : padrao;
};
const json = (s: string): unknown => JSON.parse(s) as unknown;
export async function alterarFuncionario(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  try {
    const op = texto(f, "operacao");
    let caminho = "";
    let method: "POST" | "PATCH" | "DELETE" = "POST";
    let corpo: unknown;
    if (op === "criar" || op === "editar") {
      if (op === "editar") {
        caminho = `/${id(f, "id")}`;
        method = "PATCH";
      }
      corpo = {
        nome: texto(f, "nome"),
        setor_id: id(f, "setor_id"),
        descricao: texto(f, "descricao", "Função administrativa"),
        tipo: texto(f, "tipo"),
        perfil_ia: texto(f, "perfil_ia") || null,
        avatar: texto(f, "avatar") || null,
      };
    } else if (op === "status") {
      caminho = `/${id(f, "id")}/status`;
      corpo = { status: texto(f, "status") };
    } else if (op === "atribuir") {
      caminho = `/${id(f, "id")}/atribuicoes`;
      corpo = { definicao_id: id(f, "definicao_id"), config: json(texto(f, "config", "{}")) };
    } else if (op === "executar") {
      caminho = `/atribuicoes/${id(f, "atribuicao_id")}/executar`;
    } else if (op === "remover") {
      caminho = `/atribuicoes/${id(f, "atribuicao_id")}`;
      method = "DELETE";
    } else if (op === "configurar") {
      caminho = `/atribuicoes/${id(f, "atribuicao_id")}`;
      method = "PATCH";
      const config: Record<string, unknown> = {};
      for (const [nome, valor] of f.entries()) {
        if (!nome.startsWith("cfg:") || typeof valor !== "string") continue;
        const [, chave, tipo] = nome.split(":");
        if (chave === undefined || chave === "__proto__" || chave === "constructor")
          throw new Error("campo invalido");
        config[chave] =
          tipo === "number" || tipo === "integer"
            ? Number(valor)
            : tipo === "boolean"
              ? valor === "true"
              : tipo === "json"
                ? json(valor)
                : valor;
      }
      corpo = {
        config: f.has("config") ? json(texto(f, "config", "{}")) : config,
        habilitada: texto(f, "habilitada") === "true",
        prioridade: Number(texto(f, "prioridade", "0")),
      };
    } else if (op === "agenda" || op === "previsualizar") {
      const agendaId = texto(f, "agendamento_id");
      caminho =
        op === "previsualizar"
          ? "/cron/previsualizar"
          : agendaId
            ? `/atribuicoes/${id(f, "atribuicao_id")}/agendamentos/${id(f, "agendamento_id")}`
            : `/atribuicoes/${id(f, "atribuicao_id")}/agendamentos`;
      method = agendaId && op !== "previsualizar" ? "PATCH" : "POST";
      corpo = {
        gatilho: texto(f, "gatilho"),
        intervalo_min: Number(texto(f, "intervalo", "30")) * Number(texto(f, "unidade", "1")),
        cron: texto(f, "cron"),
        tipo_evento: texto(f, "tipo_evento"),
        filtro_evento: json(texto(f, "filtro_evento", "{}")),
        fuso: texto(f, "fuso", "America/Sao_Paulo"),
        ...(texto(f, "inicio_em")
          ? { inicio_em: new Date(texto(f, "inicio_em")).toISOString() }
          : {}),
        fim_em: texto(f, "fim_em") ? new Date(texto(f, "fim_em")).toISOString() : null,
        habilitado: texto(f, "habilitado", "true") === "true",
        politica_sobreposicao: texto(f, "politica_sobreposicao", "PULAR"),
        politica_retentativa: {
          maxTentativas: Number(texto(f, "maxTentativas", "3")),
          backoffSegundos: Number(texto(f, "backoffSegundos", "30")),
        },
      };
      if (op === "previsualizar") {
        const r = await funcionariosApi<string[]>(caminho, method, corpo);
        return r.ok
          ? {
              erro: false,
              mensagem: r.dados.length
                ? `Próximas execuções: ${r.dados.map((d) => new Date(d).toLocaleString("pt-BR", { timeZone: texto(f, "fuso", "America/Sao_Paulo") })).join("; ")}`
                : "Este gatilho não possui próximas ocorrências.",
            }
          : { erro: true, mensagem: r.mensagem };
      }
    } else if (op === "suspender") {
      caminho = `/agendamentos/${id(f, "agendamento_id")}/suspender`;
    } else if (op === "tarefa") {
      caminho = "/catalogo";
      corpo = {
        setor_id: id(f, "setor_id"),
        codigo: texto(f, "codigo"),
        nome: texto(f, "nome"),
        descricao: texto(f, "descricao", "Tarefa planejada"),
        tipo: texto(f, "tipo", "DETERMINISTICO"),
      };
    } else if (op === "editar-tarefa") {
      caminho = `/catalogo/${id(f, "id")}`;
      method = "PATCH";
      corpo = {
        nome: texto(f, "nome"),
        descricao: texto(f, "descricao"),
        ativo: texto(f, "ativo") === "true",
      };
    } else return { erro: true, mensagem: "Operação inválida." };
    const r = await funcionariosApi<unknown>(caminho, method, corpo);
    if (!r.ok) return { erro: true, mensagem: r.mensagem };
    revalidatePath("/funcionarios", "layout");
    revalidatePath("/funcionarios");
    return {
      erro: false,
      mensagem:
        op === "executar" ? "Execução enfileirada. Consulte o histórico." : "Alteração salva.",
    };
  } catch {
    return { erro: true, mensagem: "Confira os campos, datas e o JSON da configuração." };
  }
}
