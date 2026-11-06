import { revalidatePath } from "next/cache";
import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
async function encerrar(f: FormData) {
  "use server";
  const id = f.get("id"),
    acao = f.get("acao");
  if (
    typeof id !== "string" ||
    !/^\d{1,19}$/.test(id) ||
    typeof acao !== "string" ||
    !["resolver", "ignorar"].includes(acao)
  )
    throw new Error("Acao invalida");
  await financeiroApi(`/alertas/${id}/${acao}`, {});
  revalidatePath("/setores/financeiro");
}
export async function Alertas({ tipo }: { tipo?: string }) {
  let alertas: Record<string, unknown>[];
  try {
    alertas = (await financeiroApi(
      `/alertas${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ""}`,
    )) as Record<string, unknown>[];
  } catch {
    return <p role="status">Alertas indisponÃ­veis. Confira a conexÃ£o com a API.</p>;
  }
  return (
    <section aria-label="Alertas financeiros">
      <h2>Alertas financeiros</h2>
      {alertas.length === 0 ? (
        <p>Nenhum alerta aberto.</p>
      ) : (
        <ul>
          {alertas.map((a) => (
            <li key={String(a["id"])}>
              <strong>{String(a["severidade"])}</strong> â€” {String(a["mensagem"])}
              <form action={encerrar}>
                <input type="hidden" name="id" value={String(a["id"])} />
                <button name="acao" value="resolver">
                  Resolver
                </button>
                <button name="acao" value="ignorar">
                  Ignorar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
