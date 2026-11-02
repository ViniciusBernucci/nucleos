import Link from "next/link";
import type { Funcionario, Setor } from "@nucleos/contracts";
import { funcionariosApi } from "../../../lib/funcionarios-api.ts";
import {
  CadastroFuncionario,
  ListaFuncionarios,
  PaginaFuncionarios,
  styles,
} from "./_components/Comum.tsx";
export default async function Funcionarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const parametros = new URLSearchParams();
  for (const nome of ["busca", "status", "setor"]) if (q[nome]) parametros.set(nome, q[nome]);
  const [r, s] = await Promise.all([
    funcionariosApi<Funcionario[]>(`?${parametros}`),
    funcionariosApi<Setor[]>("/setores"),
  ]);
  return (
    <PaginaFuncionarios titulo="Funcionários">
      <p>Rotinas reais, agendamentos e histórico dos funcionários virtuais.</p>
      {!r.ok ? (
        <p role="alert">{r.mensagem}</p>
      ) : (
        <>
          <div className={styles["cards"]}>
            <section className={styles["painel"]}>
              <h2>Ativos</h2>
              <strong>{r.dados.filter((f) => f.status === "ATIVO").length}</strong>
            </section>
            <section className={styles["painel"]}>
              <h2>Em rascunho</h2>
              <strong>{r.dados.filter((f) => f.status === "RASCUNHO").length}</strong>
            </section>
            <section className={styles["painel"]}>
              <h2>Falhas nos últimos 7 dias</h2>
              <strong>{r.dados.reduce((n, f) => n + f.falhas, 0)}</strong>
            </section>
          </div>
          {s.ok ? (
            <>
              <nav aria-label="Setores de Funcionários">
                {s.dados.map((setor) => (
                  <Link key={setor.id} href={`/funcionarios/setores/${setor.id}`}>
                    {setor.nome}
                  </Link>
                ))}
              </nav>
              <CadastroFuncionario setores={s.dados} />
            </>
          ) : null}
          <form className={styles["filtros"]}>
            <label>
              Buscar por nome
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
          <ListaFuncionarios itens={r.dados} />
        </>
      )}
    </PaginaFuncionarios>
  );
}
