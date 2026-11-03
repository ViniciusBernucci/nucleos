import { configuracao } from "./vendas-api.ts";
/** Exclusivamente servidor: a credencial nunca integra propriedades de componentes cliente. */
export async function financeiroApi(caminho: string, corpo?: unknown): Promise<unknown> {
  const cfg = configuracao();
  if (!cfg) throw new Error("API financeira nao configurada");
  const r = await fetch(`${cfg.base}/v1/financeiro${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${cfg.chave}`, "content-type": "application/json" },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Operacao financeira recusada (${r.status})`);
  const t = await r.text();
  return t ? (JSON.parse(t) as unknown) : null;
}
