import {
  NavegacaoFinanceira,
  Campo,
  Escolha,
  Formulario,
  Painel,
  consultar,
  Tabela,
  Indisponivel,
} from "../_components/Base.tsx";
type Row = Record<string, unknown>;
export default async function Movimentacoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await searchParams,
    qs = new URLSearchParams();
  for (const k of ["de", "ate", "conta"]) if (f[k]) qs.set(k, f[k]);
  const [cad, mov, itens] = await Promise.all([
    consultar<Record<string, Row[]>>("/cadastros"),
    consultar<Row[]>("/movimentacoes?" + qs.toString()),
    consultar<Row[]>("/extratos/itens"),
  ]);
  return (
    <main>
      <h1>Movimentações</h1>
      <NavegacaoFinanceira />
      {!cad || !mov || !itens ? (
        <Indisponivel />
      ) : (
        <>
          <form>
            <Campo nome="de" rotulo="De" tipo="date" obrigatorio={false} />
            <Campo nome="ate" rotulo="Até" tipo="date" obrigatorio={false} />
            <Escolha nome="conta" rotulo="Conta" opcoes={cad["contas"] ?? []} />
            <button>Filtrar</button>
          </form>
          <Painel titulo="Nova conta financeira">
            <Formulario operacao="conta" rotulo="Cadastrar">
              <Campo nome="nome" rotulo="Nome" />
              <label>
                Tipo
                <select name="tipo">
                  <option value="banco">Banco</option>
                  <option value="caixa">Caixa</option>
                  <option value="plataforma">Plataforma</option>
                </select>
              </label>
            </Formulario>
          </Painel>
          <Painel titulo="Transferir">
            <Formulario operacao="transferencia" rotulo="Registrar transferência">
              <Escolha nome="origemId" rotulo="Conta de origem" opcoes={cad["contas"] ?? []} />
              <Escolha nome="destinoId" rotulo="Conta de destino" opcoes={cad["contas"] ?? []} />
              <Campo nome="data" rotulo="Data" tipo="date" />
              <Campo nome="valor" rotulo="Valor (R$)" />
            </Formulario>
          </Painel>
          <Painel titulo="Registrar saque Hotmart">
            <Formulario operacao="saque" rotulo="Registrar saque">
              <Escolha nome="destinoId" rotulo="Conta de destino" opcoes={cad["contas"] ?? []} />
              <Campo nome="data" rotulo="Data" tipo="date" />
              <Campo nome="valor" rotulo="Valor bruto (R$)" />
              <Campo nome="taxa" rotulo="Taxa (R$)" obrigatorio={false} />
              <Campo nome="comprovante" rotulo="Referência do comprovante" obrigatorio={false} />
            </Formulario>
          </Painel>
          <Painel titulo="Informar saldo disponível">
            <Formulario operacao="saldo" rotulo="Salvar saldo informado">
              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
              <Campo nome="data" rotulo="Data de referência" tipo="date" />
              <Campo nome="valor" rotulo="Saldo disponível informado (R$)" />
            </Formulario>
          </Painel>
          <Painel titulo="Importar extrato">
            <p>
              CSV: data;valor;fitid;memo. Valor decimal com sinal, datas AAAA-MM-DD. OFX: STMTTRN
              com DTPOSTED, TRNAMT e FITID.
            </p>
            <Formulario operacao="extrato" rotulo="Importar">
              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
              <label>
                Formato
                <select name="formato">
                  <option value="ofx">OFX</option>
                  <option value="csv">CSV</option>
                </select>
              </label>
              <label>
                Conteúdo
                <textarea name="conteudo" rows={8} maxLength={1048576} required />
              </label>
            </Formulario>
          </Painel>
          <h2>Lançamentos</h2>
          <Tabela
            dados={mov}
            colunas={[
              ["id", "Código"],
              ["data", "Data"],
              ["tipo", "Tipo"],
              ["descricao", "Descrição"],
              ["valor_centavos", "Valor (centavos)"],
              ["conta_financeira_id", "Conta"],
              ["transferencia_id", "Transferência"],
            ]}
          />
          <h2>Extrato não conciliado</h2>
          <Tabela
            dados={itens}
            colunas={[
              ["id", "Código"],
              ["data", "Data"],
              ["memo", "Descrição"],
              ["valor_centavos", "Valor (centavos)"],
              ["conta_financeira_id", "Conta"],
            ]}
          />
        </>
      )}
    </main>
  );
}
