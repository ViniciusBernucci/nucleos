import Link from "next/link";
import type { ListaExecucoes, Setor, Funcionario, DefinicaoTarefa } from "@nucleos/contracts";
import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
import { dataLocal, PaginaFuncionarios, styles } from "../_components/Comum.tsx";
export default async function Execucoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const filtros = new URLSearchParams();
  for (const nome of ["funcionario", "setor", "tarefa", "status", "de", "ate", "deslocamento"])
    if (q[nome]) filtros.set(nome, q[nome]);
  const [r, s, f, t] = await Promise.all([
    funcionariosApi<ListaExecucoes>(`/execucoes?${filtros}`),
    funcionariosApi<Setor[]>("/setores"),
    funcionariosApi<Funcionario[]>(),
    funcionariosApi<DefinicaoTarefa[]>("/catalogo"),
  ]);
  return (
    <PaginaFuncionarios titulo="Histórico de execuções">
      <form className={styles["filtros"]}>
        <label>
          Setor
          <select name="setor" defaultValue={q["setor"] ?? ""}>
            <option value="">Todos</option>
            {s.ok
              ? s.dados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label>
          Funcionário
          <select name="funcionario" defaultValue={q["funcionario"] ?? ""}>
            <option value="">Todos</option>
            {f.ok
              ? f.dados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label>
          Tarefa
          <select name="tarefa" defaultValue={q["tarefa"] ?? ""}>
            <option value="">Todas</option>
            {t.ok
              ? t.dados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={q["status"] ?? ""}>
            <option value="">Todos</option>
            {["AGUARDANDO", "EXECUTANDO", "SUCESSO", "FALHA", "CANCELADA", "IGNORADA"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          De (ISO)
          <input name="de" defaultValue={q["de"]} placeholder="2026-11-01T00:00:00-03:00" />
        </label>
        <label>
          Até (ISO)
          <input name="ate" defaultValue={q["ate"]} />
        </label>
        <button className="btn btn--secondary">Filtrar</button>
      </form>
      {r.ok ? (
        <>
          <p>{r.dados.total} execuções encontradas.</p>
          <div className={styles["tabela"]}>
            <table>
              <caption>Execuções e tentativas</caption>
              <thead>
                <tr>
                  <th>Funcionário / tarefa</th>
                  <th>Origem</th>
                  <th>Status</th>
                  <th>Tentativa</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.funcionario_nome}
                      <br />
                      {e.tarefa_nome}
                    </td>
                    <td>{e.origem}</td>
                    <td>{e.status}</td>
                    <td>{e.tentativa}</td>
                    <td>{dataLocal(e.iniciada_em)}</td>
                    <td>{dataLocal(e.finalizada_em)}</td>
                    <td>
                      <Link href={`/funcionarios/execucoes/${e.id}`}>Abrir execução {e.id}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginação">
            {r.dados.deslocamento > 0 ? (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(filtros), deslocamento: String(Math.max(0, r.dados.deslocamento - 25)) })}`}
              >
                Anteriores
              </Link>
            ) : null}
            {r.dados.deslocamento + 25 < r.dados.total ? (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(filtros), deslocamento: String(r.dados.deslocamento + 25) })}`}
              >
                Próximas
              </Link>
            ) : null}
          </nav>
        </>
      ) : (
        <p role="alert">{r.mensagem}</p>
      )}
    </PaginaFuncionarios>
  );
}
