"use server";
import { revalidatePath } from "next/cache";
import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
import { configuracao } from "../../../../../lib/vendas-api.ts";
import type { EstadoAcao } from "../../../../../lib/fluxo-caixa-formato.ts";
const campoString = (v: unknown): string => (typeof v === "string" ? v : "");
function valor(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !/^\d{1,12}([.,]\d{1,2})?$/.test(raw))
    throw new Error("Valor invalido");
  const [i, d = ""] = raw.replace(",", ".").split(".");
  return (BigInt(i ?? "0") * 100n + BigInt(d.padEnd(2, "0"))).toString();
}
export async function executarFinanceiro(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  try {
    const op = campoString(f.get("operacao")),
      p: Record<string, unknown> = {};
    for (const [k, v] of f.entries())
      if (typeof v === "string" && k !== "operacao" && v !== "") p[k] = v;
    if (f.has("valor")) {
      p["valorCentavos"] = valor(f.get("valor"));
      delete p["valor"];
    }
    if (f.has("taxa")) {
      p["taxaCentavos"] = valor(f.get("taxa"));
      delete p["taxa"];
    }
    const cid = campoString(f.get("id") ?? "");
    if (cid && !/^[1-9]\d{0,17}$/.test(cid)) throw new Error("Identificador invalido");
    const simples: Record<string, string> = {
      despesa: "/contas-pagar",
      recorrente: "/contas-recorrentes",
      transferencia: "/transferencias",
      saque: "/saques-hotmart",
      saldo: "/saldos-informados",
      receber: "/contas-receber",
      extrato: "/extratos/importar",
      historico: "/vendas/importar-historico",
      fornecedor: "/cadastros/fornecedores",
      centro: "/cadastros/centros",
      conta: "/cadastros/contas",
      regra: "/cadastros/regras",
      "mapear-dre": "/gestao/mapeamento",
      cfo: "/cfo/perguntar",
      "avaliar-marketing": "/rentabilidade/avaliar",
    };
    let caminho = simples[op];
    if (op === "cfo") delete p["id"];
    if (op === "mapear-dre") p["excluir"] = f.get("excluir") === "on";
    if (op === "cenario") {
      const codigo = campoString(f.get("codigo"));
      if (!["conservador", "base", "otimista"].includes(codigo)) throw new Error();
      caminho = "/gestao/cenarios/" + codigo;
      for (const k of ["realizacao_pct", "reembolso_pct", "variacao_despesas_pct"])
        p[k] = Number(f.get(k));
    }
    if (op === "pagar" || op === "cancelar") caminho = "/contas-pagar/" + cid + "/" + op;
    if (["aceitar", "recusar", "desfazer"].includes(op))
      caminho = "/conciliacoes/" + cid + "/" + op;
    if (op === "manual") {
      caminho = "/conciliacoes";
      p["itens"] = [
        { tipo: p["tipo"], referenciaId: p["referenciaId"], valorCentavos: p["valorCentavos"] },
        { tipo: "extrato_item", referenciaId: p["extratoId"], valorCentavos: p["valorCentavos"] },
      ];
    }
    if (!caminho) throw new Error("Operacao invalida");
    const resultado = await financeiroApi(caminho, p);
    revalidatePath("/setores/financeiro", "layout");
    const execucao = op === "historico" ? (resultado as { execucaoId: string }).execucaoId : null;
    return {
      erro: false,
      mensagem: execucao
        ? "Importação enfileirada. Acompanhe em Funcionários → Execuções."
        : "Operação concluída.",
    };
  } catch {
    return {
      erro: true,
      mensagem: "Operação recusada. Confira os campos, a configuração e a disponibilidade da API.",
    };
  }
}
export async function anexar(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  try {
    const cfg = configuracao(),
      id = campoString(f.get("id"));
    if (!cfg || !/^\d{1,18}$/.test(id)) throw new Error();
    const arquivo = f.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size > 10 * 1024 * 1024) throw new Error();
    const corpo = new FormData();
    corpo.set("arquivo", arquivo);
    const r = await fetch(cfg.base + "/v1/financeiro/contas-pagar/" + id + "/anexos", {
      method: "POST",
      headers: { authorization: "Bearer " + cfg.chave },
      body: corpo,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error();
    revalidatePath("/setores/financeiro/contas");
    return { erro: false, mensagem: "Anexo enviado." };
  } catch {
    return {
      erro: true,
      mensagem: "Não foi possível enviar. Use PDF/JPG/PNG até 10 MB e confira o MinIO.",
    };
  }
}
export async function importarCsv(
  _: { erro: boolean; mensagem: string; previa: string | null },
  f: FormData,
): Promise<{ erro: boolean; mensagem: string; previa: string | null }> {
  try {
    const conteudo = campoString(f.get("conteudo") ?? ""),
      confirmar = f.get("confirmar") === "sim";
    if (conteudo.length > 1024 * 1024) throw new Error();
    const r = (await financeiroApi("/despesas/importar", { conteudo, confirmar })) as {
      erros?: { linha: number; mensagem: string }[];
      linhas?: unknown[];
    };
    if (confirmar) {
      revalidatePath("/setores/financeiro/contas");
      return { erro: false, mensagem: "Importação concluída.", previa: null };
    }
    return {
      erro: Boolean(r.erros?.length),
      mensagem: String(r.linhas?.length ?? 0) + " linhas válidas.",
      previa: JSON.stringify(r, null, 2),
    };
  } catch {
    return {
      erro: true,
      mensagem: "Importação recusada. Confira o layout e os dados.",
      previa: null,
    };
  }
}
