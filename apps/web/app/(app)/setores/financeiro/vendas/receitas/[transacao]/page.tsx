import {
  NavegacaoFinanceira,
  consultar,
  Tabela,
  Indisponivel,
} from "../../../_components/Base.tsx";
type Row = Record<string, unknown>;
export default async function Detalhe({ params }: { params: Promise<{ transacao: string }> }) {
  const { transacao } = await params,
    r = await consultar<{ venda: Row | null; eventos: Row[]; comissoes: Row[] }>(
      "/vendas/" + encodeURIComponent(transacao),
    );
  return (
    <main>
      <h1>Detalhe da transação</h1>
      <NavegacaoFinanceira />
      {!r ? (
        <Indisponivel />
      ) : !r.venda ? (
        <p>Transação não encontrada.</p>
      ) : (
        <>
          <h2>{transacao}</h2>
          <Tabela
            dados={[r.venda]}
            colunas={[
              ["produto_nome", "Produto"],
              ["oferta_codigo", "Oferta"],
              ["comprador_id", "Comprador"],
              ["status", "Status"],
              ["moeda", "Moeda"],
              ["liquido_centavos", "Líquido (centavos)"],
            ]}
          />
          <h2>Histórico de status</h2>
          <Tabela
            dados={r.eventos}
            colunas={[
              ["ocorrido_em", "Quando"],
              ["status_anterior", "Anterior"],
              ["status_novo", "Novo"],
              ["origem", "Origem"],
            ]}
          />
          <h2>Comissões</h2>
          <Tabela
            dados={r.comissoes}
            colunas={[
              ["tipo", "Papel"],
              ["moeda", "Moeda"],
              ["valor_centavos", "Valor (centavos)"],
            ]}
          />
        </>
      )}
    </main>
  );
}
