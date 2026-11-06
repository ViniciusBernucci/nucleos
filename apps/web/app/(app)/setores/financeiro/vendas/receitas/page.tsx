import Link from "next/link";
import {
  NavegacaoFinanceira,
  Campo,
  Formulario,
  Painel,
  consultar,
  Tabela,
  Indisponivel,
} from "../../_components/Base.tsx";
type Row = Record<string, unknown>;
export default async function Receitas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await searchParams,
    qs = new URLSearchParams();
  for (const k of ["de", "ate", "moeda", "produto", "status", "comprador"])
    if (f[k]) qs.set(k, f[k]);
  const rows = await consultar<Row[]>("/vendas?" + qs.toString());
  return (
    <main>
      <h1>Receitas e vendas</h1>
      <NavegacaoFinanceira />
      <form>
        <Campo nome="de" rotulo="De" tipo="date" obrigatorio={false} />
        <Campo nome="ate" rotulo="Até" tipo="date" obrigatorio={false} />
        <Campo nome="moeda" rotulo="Moeda (padrão BRL)" obrigatorio={false} />
        <Campo nome="produto" rotulo="Código do produto" obrigatorio={false} />
        <Campo nome="comprador" rotulo="Pseudônimo do comprador" obrigatorio={false} />
        <label>
          Status
          <select name="status">
            <option value="">Todos</option>
            <option value="receita">Aprovadas</option>
            <option value="pendente">Pendentes</option>
            <option value="cancelada">Canceladas</option>
            <option value="reembolso">Reembolsadas</option>
            <option value="contestada">Contestadas</option>
          </select>
        </label>
        <button>Filtrar</button>
      </form>
      <p>
        Preço efetivo da venda; desconto desconhecido é exibido como “—” e não é deduzido novamente.
        Valores monetários da tabela em centavos, com moeda explícita.
      </p>
      <Painel titulo="Importar histórico">
        <Formulario operacao="historico" rotulo="Enfileirar importação">
          <Campo nome="inicio" rotulo="Início" tipo="date" />
          <Campo nome="fim" rotulo="Fim" tipo="date" />
          <p>Até 366 dias. Acompanhe o progresso no histórico de execuções.</p>
        </Formulario>
      </Painel>
      {!rows ? (
        <Indisponivel />
      ) : (
        <>
          <Tabela
            dados={rows}
            colunas={[
              ["transacao", "Transação"],
              ["produto_nome", "Produto"],
              ["comprador_id", "Comprador"],
              ["status", "Status"],
              ["valor_centavos", "Bruto"],
              ["desconto_centavos", "Desconto"],
              ["taxa_centavos", "Taxa"],
              ["comissoes_centavos", "Comissões"],
              ["liquido_centavos", "Líquido"],
              ["parcelas", "Parcelas"],
              ["moeda", "Moeda"],
            ]}
          />
          <ul>
            {rows.map((r) => (
              <li key={String(r["transacao"])}>
                <Link
                  href={
                    "/setores/financeiro/vendas/receitas/" +
                    encodeURIComponent(String(r["transacao"]))
                  }
                >
                  Detalhe {String(r["transacao"])}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
