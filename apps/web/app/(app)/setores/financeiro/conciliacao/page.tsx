import {
  NavegacaoFinanceira,
  exibir,
  Campo,
  Formulario,
  Painel,
  consultar,
  Tabela,
  Indisponivel,
} from "../_components/Base.tsx";
type Row = Record<string, unknown>;
export default async function Conciliacao() {
  const rows = await consultar<Row[]>("/conciliacoes");
  return (
    <main>
      <h1>Conciliação financeira</h1>
      <NavegacaoFinanceira />
      <p>
        Sugestões usam valor exato e uma janela de três dias. Candidatos ambíguos exigem análise
        manual; nenhum item é aceito automaticamente.
      </p>
      <Painel titulo="Conciliação manual">
        <Formulario operacao="manual" rotulo="Criar sugestão manual">
          <label>
            Origem
            <select name="tipo">
              <option value="saque">Saque</option>
              <option value="conta_pagar">Conta paga</option>
              <option value="lancamento">Lançamento</option>
              <option value="venda">Venda BRL</option>
            </select>
          </label>
          <Campo nome="referenciaId" rotulo="Código da origem" />
          <Campo nome="extratoId" rotulo="Código do item de extrato" />
          <label>
            Valor em centavos com sinal (saída negativa)
            <input name="valorCentavos" pattern="-?[0-9]+" required />
          </label>
          <Campo nome="observacao" rotulo="Observação" obrigatorio={false} />
        </Formulario>
      </Painel>
      {!rows ? (
        <Indisponivel />
      ) : (
        rows.map((r) => (
          <section className="panel-card" key={String(r["id"])}>
            <h2>
              Conciliação #{String(r["id"])} — {String(r["estado"])}
            </h2>
            <p>{exibir(r["observacao"] ?? "")}</p>
            <p>Diferença: {String(r["diferenca_centavos"])} centavos</p>
            <Tabela
              dados={r["itens"] as Row[]}
              colunas={[
                ["tipo", "Origem"],
                ["referenciaId", "Referência"],
                ["valorCentavos", "Valor (centavos)"],
              ]}
            />
            {r["desfeita"] ? (
              <p>Desfeita</p>
            ) : r["recusada"] ? (
              <p>Recusada</p>
            ) : r["aceita"] ? (
              <Formulario operacao="desfazer" rotulo="Desfazer" id={String(r["id"])} />
            ) : (
              <>
                <Formulario operacao="aceitar" rotulo="Aceitar sugestão" id={String(r["id"])} />
                <Formulario operacao="recusar" rotulo="Recusar sugestão" id={String(r["id"])} />
              </>
            )}
          </section>
        ))
      )}
    </main>
  );
}
