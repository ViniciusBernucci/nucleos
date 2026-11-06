import Link from "next/link";
import {
  MENSAGENS_FALHA,
  carregarPainel,
  carregarUltimasVendas,
} from "../../../../../lib/vendas-api.ts";
import { filtrosDaUrl } from "../../../../../lib/vendas-formato.ts";
import { Distribuicoes } from "./_components/Distribuicoes.tsx";
import { Filtros } from "./_components/Filtros.tsx";
import { GraficoReceita } from "./_components/GraficoReceita.tsx";
import { Indicadores } from "./_components/Indicadores.tsx";
import { Sincronizacao } from "./_components/Sincronizacao.tsx";
import { UltimasVendas } from "./_components/UltimasVendas.tsx";
import { AtualizarVendas } from "./_components/AtualizarVendas.tsx";

export const metadata = {
  title: "Painel de vendas — NÚCLEOS",
  description: "Vendas da Hotmart: receita, ticket médio, reembolsos e evolução diária.",
};

type Busca = Promise<Record<string, string | string[] | undefined>>;

export default async function PainelVendasPage({ searchParams }: { searchParams: Busca }) {
  const filtros = filtrosDaUrl(await searchParams);
  const agora = new Date();
  const painel = await carregarPainel(filtros);

  return (
    <main id="conteudo" className="page">
      <nav aria-label="Trilha de navegação">
        <Link href="/setores/financeiro">← Financeiro</Link>
      </nav>
      <header className="page-header">
        <h1>Painel de vendas</h1>
        <AtualizarVendas
          habilitada={painel.tipo === "ok" && painel.dados.sincronizacao.habilitada}
        />
      </header>

      {painel.tipo === "nao-configurado" ? (
        <div className="state-box" role="status">
          <p>
            O painel ainda não está conectado à API de vendas. Defina <code>VENDAS_API_KEY</code>{" "}
            (chave de serviço no .env) e, se a API não estiver em <code>http://127.0.0.1:3001</code>
            , <code>VENDAS_API_URL</code> no servidor web.
          </p>
        </div>
      ) : painel.tipo === "erro" ? (
        <div className="state-box state-box--error" role="alert">
          {MENSAGENS_FALHA[painel.falha]}
        </div>
      ) : (
        <PainelCompleto painel={painel.dados} filtros={filtros} agora={agora} />
      )}
    </main>
  );
}

async function PainelCompleto({
  painel,
  filtros,
  agora,
}: {
  painel: Extract<Awaited<ReturnType<typeof carregarPainel>>, { tipo: "ok" }>["dados"];
  filtros: ReturnType<typeof filtrosDaUrl>;
  agora: Date;
}) {
  const ultimas = await carregarUltimasVendas({
    de: painel.periodo.de,
    ate: painel.periodo.ate,
    moeda: painel.moeda,
    ...(filtros.produto === undefined ? {} : { produto: filtros.produto }),
  });
  const semDados = painel.indicadores.vendas === 0 && painel.porStatus.length === 0;

  return (
    <>
      <Sincronizacao estado={painel.sincronizacao} agora={agora} />
      <a href="/setores/financeiro/vendas/receitas">
        Receitas detalhadas, comissões e histórico de status
      </a>
      <Filtros painel={painel} filtros={filtros} agora={agora} />

      {semDados ? (
        <div className="state-box" role="status">
          {painel.sincronizacao.status === "nunca"
            ? "Ainda não há vendas carregadas. A primeira verificação com a Hotmart roda automaticamente; quando terminar, os números aparecem aqui."
            : "Nenhuma venda encontrada para os filtros escolhidos. Ajuste o período ou o produto."}
        </div>
      ) : null}

      <Indicadores painel={painel} />
      <GraficoReceita painel={painel} />
      <Distribuicoes painel={painel} />

      {ultimas.tipo === "ok" ? (
        <UltimasVendas lista={ultimas.dados} />
      ) : (
        <div className="state-box state-box--error" role="alert">
          Não foi possível carregar a lista de últimas vendas agora.
        </div>
      )}
    </>
  );
}
