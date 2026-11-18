import type { ExecucaoFuncionario } from "@nucleos/contracts";
import { funcionariosApi } from "../../../../../lib/funcionarios-api.ts";
import { dataLocal, PaginaFuncionarios, styles } from "../../_components/Comum.tsx";
export default async function Execucao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await funcionariosApi<ExecucaoFuncionario>(`/execucoes/${encodeURIComponent(id)}`);
  return (
    <PaginaFuncionarios titulo={`Execução ${id}`}>
      {r.ok ? (
        <section className={styles["painel"]}>
          <dl>
            <dt>Status</dt>
            <dd>{r.dados.status}</dd>
            <dt>Origem</dt>
            <dd>{r.dados.origem}</dd>
            <dt>Programada</dt>
            <dd>{dataLocal(r.dados.programada_em)}</dd>
            <dt>Iniciada</dt>
            <dd>{dataLocal(r.dados.iniciada_em)}</dd>
            <dt>Finalizada</dt>
            <dd>{dataLocal(r.dados.finalizada_em)}</dd>
            <dt>Tentativa</dt>
            <dd>{r.dados.tentativa}</dd>
            <dt>Correlação</dt>
            <dd>{r.dados.correlacao}</dd>
            <dt>Erro</dt>
            <dd>{r.dados.erro_codigo ?? "—"}</dd>
          </dl>
          <h2>Configuração usada</h2>
          <pre>{JSON.stringify(r.dados.config_snapshot, null, 2)}</pre>
          <h2>Resumo</h2>
          <pre>{JSON.stringify(r.dados.resumo, null, 2)}</pre>
        </section>
      ) : (
        <p role="alert">{r.mensagem}</p>
      )}
    </PaginaFuncionarios>
  );
}
