import type { Funcionario, Setor } from "@nucleos/contracts";
import { funcionariosApi } from "../../../../../lib/funcionarios-api.ts";
import {
  CadastroFuncionario,
  ListaFuncionarios,
  PaginaFuncionarios,
  styles,
} from "../../_components/Comum.tsx";
export default async function SetorFuncionarios({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const [s, r] = await Promise.all([
    funcionariosApi<Setor>(`/setores/${encodeURIComponent(id)}`),
    funcionariosApi<Funcionario[]>(
      `?setor=${encodeURIComponent(id)}&busca=${encodeURIComponent(q["busca"] ?? "")}${q["status"] ? `&status=${encodeURIComponent(q["status"])}` : ""}`,
    ),
  ]);
  return (
    <PaginaFuncionarios titulo={s.ok ? s.dados.nome : "Setor"}>
      {!s.ok ? (
        <p role="alert">{s.mensagem}</p>
      ) : (
        <>
          <CadastroFuncionario setores={[s.dados]} />
          <form className={styles["filtros"]}>
            <label>
              Buscar
              <input name="busca" defaultValue={q["busca"]} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={q["status"] ?? ""}>
                <option value="">Todos</option>
                {["ATIVO", "RASCUNHO", "PAUSADO", "DESATIVADO"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button className="btn btn--secondary">Filtrar</button>
          </form>
        </>
      )}
      {r.ok ? <ListaFuncionarios itens={r.dados} /> : <p role="alert">{r.mensagem}</p>}
    </PaginaFuncionarios>
  );
}
