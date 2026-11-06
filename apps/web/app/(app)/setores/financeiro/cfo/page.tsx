import Link from "next/link";
import { consultar, Indisponivel, Formulario, Campo, Tabela } from "../_components/Base.tsx";
import { funcionariosApi } from "../../../../../lib/funcionarios-api.ts";
export default async function Page() {
  const dados = await consultar<{ disponivel: boolean; analises: Record<string, unknown>[] }>(
    "/cfo",
  );
  let funcionarios: Record<string, unknown>[] = [];
  try {
    const todos = await funcionariosApi<Record<string, unknown>[]>();
    funcionarios = (todos.ok ? todos.dados : []).filter(
      (f) => f["setor_codigo"] === "financeiro" || f["slug"] === "cfo-virtual",
    );
  } catch {
    /* A indisponibilidade e exibida sem dados ficticios. */
  }
  return (
    <main id="conteudo" className="page">
      <Link href="/setores/financeiro">← Financeiro</Link>
      <h1>Funcionários e CFO</h1>
      <Tabela
        dados={funcionarios}
        colunas={[
          ["nome", "Funcionário"],
          ["status", "Estado"],
        ]}
      />
      <p>
        <Link href="/funcionarios">
          Configurar análise periódica ou gatilho por anomalia em Funcionários → CFO Virtual →
          Tarefas
        </Link>
      </p>
      {!dados ? (
        <Indisponivel />
      ) : (
        <>
          {!dados.disponivel ? (
            <p role="status">
              CFO indisponível. Configure ANTHROPIC_API_KEY no ai-gateway e as chaves de comunicação
              no servidor.
            </p>
          ) : (
            <>
              <p>
                Escolha uma competência e um período. O CFO recebe apenas perguntas predefinidas e
                dados agregados, sem dados pessoais. Não executa alterações.
              </p>
              {[
                ["diagnostico", "Diagnóstico financeiro"],
                ["planejamento", "Planejamento do caixa"],
                ["despesas", "Controle de despesas"],
                ["rentabilidade", "Rentabilidade"],
                ["recomendacoes", "Recomendações"],
              ].map(([codigo, nome]) => (
                <Formulario key={codigo} operacao="cfo" rotulo={nome ?? "Analisar"}>
                  <input type="hidden" name="competencia" value={codigo} />
                  <Campo nome="de" rotulo="De" tipo="date" />
                  <Campo nome="ate" rotulo="Até" tipo="date" />
                </Formulario>
              ))}
            </>
          )}
          <h2>Análises anteriores</h2>
          {dados.analises.length === 0 && <p>Nenhuma análise registrada.</p>}
          {dados.analises.map((a) => (
            <article key={String(a["id"])}>
              <h3>{String(a["pergunta"])}</h3>
              <p>
                {String(a["de"])} a {String(a["ate"])} · {String(a["estado"])}
              </p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {String(a["resposta"])}
              </pre>
              <p>Uso: {JSON.stringify(a["uso"])}</p>
            </article>
          ))}
        </>
      )}
    </main>
  );
}
