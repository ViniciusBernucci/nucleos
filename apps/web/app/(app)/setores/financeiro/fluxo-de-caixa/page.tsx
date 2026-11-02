import Link from "next/link";
import { MENSAGENS_FALHA_FLUXO, carregarFluxo } from "../../../../../lib/fluxo-caixa-api.ts";
import { mesDaUrl, nomeDoMes, somarMeses } from "../../../../../lib/fluxo-caixa-formato.ts";
import { ContasDoMes } from "./_components/ContasDoMes.tsx";
import { ContasRecorrentes } from "./_components/ContasRecorrentes.tsx";
import { Movimentacoes } from "./_components/Movimentacoes.tsx";
import { NovoLancamento } from "./_components/NovoLancamento.tsx";
import { Resumo } from "./_components/Resumo.tsx";
import styles from "./fluxo-de-caixa.module.css";

export const metadata = {
  title: "Fluxo de caixa — NÚCLEOS",
  description: "Entradas, saídas e contas a pagar recorrentes do setor financeiro.",
};

type Busca = Promise<Record<string, string | string[] | undefined>>;

export default async function FluxoDeCaixaPage({ searchParams }: { searchParams: Busca }) {
  const fluxo = await carregarFluxo(mesDaUrl(await searchParams));

  return (
    <main id="conteudo" className="page">
      <nav aria-label="Trilha de navegação">
        <Link href="/setores/financeiro">← Financeiro</Link>
      </nav>
      <header className="page-header">
        <h1>Fluxo de caixa</h1>
        {fluxo.tipo === "ok" ? (
          <nav aria-label="Mês exibido" className={styles["navMes"]}>
            <Link className="btn btn--secondary" href={`?mes=${somarMeses(fluxo.dados.mes, -1)}`}>
              ← Mês anterior
            </Link>
            <span className={styles["mesAtual"]} aria-current="page">
              {nomeDoMes(fluxo.dados.mes)}
            </span>
            <Link className="btn btn--secondary" href={`?mes=${somarMeses(fluxo.dados.mes, 1)}`}>
              Próximo mês →
            </Link>
            {fluxo.dados.hoje.startsWith(fluxo.dados.mes) ? null : (
              <Link className="btn btn--secondary" href="?">
                Mês atual
              </Link>
            )}
          </nav>
        ) : null}
      </header>

      {fluxo.tipo === "nao-configurado" ? (
        <div className="state-box" role="status">
          <p>
            O fluxo de caixa ainda não está conectado à API do financeiro. Defina{" "}
            <code>VENDAS_API_KEY</code> (chave de serviço no .env) e, se a API não estiver em{" "}
            <code>http://127.0.0.1:3001</code>, <code>VENDAS_API_URL</code> no servidor web.
          </p>
        </div>
      ) : fluxo.tipo === "erro" ? (
        <div className="state-box state-box--error" role="alert">
          {MENSAGENS_FALHA_FLUXO[fluxo.falha]}
        </div>
      ) : (
        <>
          <Resumo fluxo={fluxo.dados} />
          <div className={styles["colunas"]}>
            <NovoLancamento fluxo={fluxo.dados} />
            <ContasDoMes fluxo={fluxo.dados} />
          </div>
          <Movimentacoes fluxo={fluxo.dados} />
          <ContasRecorrentes fluxo={fluxo.dados} />
        </>
      )}
    </main>
  );
}
