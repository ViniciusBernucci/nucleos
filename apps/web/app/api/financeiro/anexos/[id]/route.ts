import { configuracao } from "../../../../../lib/vendas-api.ts";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params,
    cfg = configuracao();
  if (!cfg) return new Response("Anexos indisponíveis", { status: 503 });
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
  try {
    const r = await fetch(cfg.base + "/v1/financeiro/anexos/" + id, {
      headers: { authorization: "Bearer " + cfg.chave },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return new Response("Anexo indisponível", { status: r.status === 404 ? 404 : 503 });
    return new Response(r.body, {
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": r.headers.get("content-disposition") ?? "attachment",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Anexos indisponíveis", { status: 503 });
  }
}
