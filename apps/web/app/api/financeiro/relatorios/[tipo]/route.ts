import { configuracao } from "../../../../../lib/vendas-api.ts";
export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!["dre", "vendas", "despesas"].includes(tipo)) return new Response(null, { status: 404 });
  const cfg = configuracao();
  if (!cfg) return new Response("Relatório indisponível", { status: 503 });
  try {
    const url = new URL(request.url),
      p = new URLSearchParams();
    for (const k of ["de", "ate", "produto", "oferta", "centro"]) {
      const v = url.searchParams.get(k);
      if (v) p.set(k, v);
    }
    const r = await fetch(`${cfg.base}/v1/financeiro/gestao/exportar/${tipo}?${p}`, {
      headers: { authorization: `Bearer ${cfg.chave}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return new Response("Relatório recusado", { status: r.status });
    return new Response(r.body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${tipo}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Relatório indisponível", { status: 503 });
  }
}
