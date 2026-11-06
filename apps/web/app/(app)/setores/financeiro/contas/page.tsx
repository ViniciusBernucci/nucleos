import Link from "next/link";
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
import { FormularioAcao } from "../fluxo-de-caixa/_components/FormularioAcao.tsx";
import { anexar } from "../_components/acoes.ts";
import { ImportarDespesas } from "../_components/ImportarDespesas.tsx";
type Row = Record<string, unknown>;
export default async function Contas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await searchParams,
    qs = new URLSearchParams();
  for (const k of ["de", "ate", "status", "categoria", "fornecedor", "centro"])
    if (f[k]) qs.set(k, f[k]);
  const [cad, pagar, receber] = await Promise.all([
    consultar<Record<string, Row[]>>("/cadastros"),
    consultar<{ contas: Row[]; totais: Row[] }>("/contas-pagar?" + qs.toString()),
    consultar<Record<string, Row[]>>("/contas-receber"),
  ]);
  return (
    <main>
      <h1>Contas a pagar e receber</h1>
      <NavegacaoFinanceira />
      <nav aria-label="Abas">
        <Link href="?aba=pagar">Pagar</Link>
        {" · "}
        <Link href="?aba=receber">Receber</Link>
      </nav>
      {!cad || !pagar || !receber ? (
        <Indisponivel />
      ) : f["aba"] === "receber" ? (
        <>
          <h2>Recebimentos</h2>
          <p>
            Valores a receber são estimativas. Disponibilidade para saque exige saldo informado com
            data e origem; os saques recebidos aparecem após conciliação.
          </p>
          <h3>Vendido</h3>
          <Tabela
            dados={receber["vendido"] ?? []}
            colunas={[
              ["moeda", "Moeda"],
              ["valor_centavos", "Vendido (centavos)"],
            ]}
          />
          <h3>A receber — estimado</h3>
          <Tabela
            dados={receber["aReceberEstimado"] ?? []}
            colunas={[
              ["id", "Código"],
              ["descricao", "Descrição"],
              ["valor_centavos", "Valor (centavos)"],
              ["previsto_em", "Previsão"],
            ]}
          />
          <h3>Disponível para saque — informado</h3>
          <Tabela
            dados={receber["disponivelInformado"] ?? []}
            colunas={[
              ["conta_financeira_id", "Conta"],
              ["valor_centavos", "Valor (centavos)"],
              ["data", "Data"],
              ["origem", "Origem"],
            ]}
          />
          <h3>Recebido — conciliado</h3>
          <Tabela
            dados={receber["recebidoConciliado"] ?? []}
            colunas={[
              ["id", "Saque"],
              ["liquido_centavos", "Líquido (centavos)"],
              ["data", "Data"],
            ]}
          />
          <Painel titulo="Novo recebimento">
            <Formulario operacao="receber" rotulo="Cadastrar">
              <Campo nome="descricao" rotulo="Descrição" />
              <Campo nome="valor" rotulo="Valor (R$)" />
              <Campo nome="previstoEm" rotulo="Data prevista" tipo="date" />
              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
            </Formulario>
          </Painel>
          <Painel titulo="Regra de liberação">
            <Formulario operacao="regra" rotulo="Salvar">
              <Campo nome="pagamento" rotulo="Forma de pagamento (ex.: CREDIT_CARD)" />
              <Campo nome="dias" rotulo="Dias para liberação" tipo="number" />
            </Formulario>
            <Tabela
              dados={cad["regras"] ?? []}
              colunas={[
                ["pagamento", "Forma"],
                ["dias", "Dias"],
              ]}
            />
          </Painel>
        </>
      ) : (
        <>
          <form>
            <label>
              De
              <input name="de" type="date" defaultValue={f["de"]} />
            </label>
            <label>
              Até
              <input name="ate" type="date" defaultValue={f["ate"]} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={f["status"] ?? ""}>
                <option value="">Todos</option>
                <option value="aberta">Aberta</option>
                <option value="paga">Paga</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <Campo nome="categoria" rotulo="Categoria" obrigatorio={false} />
            <Campo nome="fornecedor" rotulo="Código do fornecedor" obrigatorio={false} />
            <Campo nome="centro" rotulo="Código do centro de custo" obrigatorio={false} />
            <button>Filtrar</button>
          </form>
          <Painel titulo="Nova despesa">
            <Formulario operacao="despesa" rotulo="Cadastrar">
              <Campo nome="descricao" rotulo="Descrição" />
              <Campo nome="valor" rotulo="Valor total (R$)" />
              <Campo nome="vencimento" rotulo="Primeiro vencimento" tipo="date" />
              <Campo nome="competencia" rotulo="Competência" tipo="date" obrigatorio={false} />
              <Campo nome="categoria" rotulo="Categoria cadastrada" />
              <Campo nome="fornecedorId" rotulo="Código do fornecedor" obrigatorio={false} />
              <Campo nome="centroCustoId" rotulo="Código do centro de custo" obrigatorio={false} />
              <Campo
                nome="parcelas"
                rotulo="Parcelas (1 a 120)"
                tipo="number"
                obrigatorio={false}
              />
            </Formulario>
          </Painel>
          <Painel titulo="Nova conta recorrente">
            <Formulario operacao="recorrente" rotulo="Cadastrar recorrência">
              <Campo nome="descricao" rotulo="Descrição" />
              <Campo nome="categoria" rotulo="Categoria cadastrada" />
              <Campo nome="valor" rotulo="Valor (R$)" />
              <Campo nome="diaVencimento" rotulo="Dia do vencimento (1 a 31)" tipo="number" />
              <Campo nome="inicio" rotulo="Início — primeiro dia do mês" tipo="date" />
              <Campo
                nome="fim"
                rotulo="Fim — primeiro dia do mês"
                tipo="date"
                obrigatorio={false}
              />
              <label>
                Periodicidade
                <select name="periodicidade">
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <Campo nome="fornecedorId" rotulo="Código do fornecedor" obrigatorio={false} />
              <Campo nome="centroCustoId" rotulo="Código do centro de custo" obrigatorio={false} />
            </Formulario>
          </Painel>
          <Painel titulo="Importar despesas">
            <ImportarDespesas />
          </Painel>
          <Painel titulo="Cadastros">
            <h3>Fornecedor</h3>
            <Formulario operacao="fornecedor" rotulo="Cadastrar fornecedor">
              <Campo nome="nome" rotulo="Nome" />
              <Campo nome="documento" rotulo="CPF/CNPJ" obrigatorio={false} />
              <Campo nome="contato" rotulo="Contato" obrigatorio={false} />
            </Formulario>
            <Tabela
              dados={cad["fornecedores"] ?? []}
              colunas={[
                ["id", "Código"],
                ["nome", "Fornecedor"],
                ["documento", "Documento"],
              ]}
            />
            <h3>Centro de custo</h3>
            <Formulario operacao="centro" rotulo="Cadastrar centro">
              <Campo nome="nome" rotulo="Nome" />
            </Formulario>
            <Tabela
              dados={cad["centros"] ?? []}
              colunas={[
                ["id", "Código"],
                ["nome", "Centro"],
              ]}
            />
          </Painel>
          <h2>Contas</h2>
          <Tabela
            dados={pagar.contas}
            colunas={[
              ["id", "Código"],
              ["descricao", "Descrição"],
              ["valor_centavos", "Valor (centavos)"],
              ["vencimento", "Vencimento"],
              ["status", "Status"],
              ["parcela", "Parcela"],
              ["parcelas", "Total de parcelas"],
            ]}
          />
          {pagar.contas.map((c) => (
            <details key={String(c["id"])}>
              <summary>
                Ações — {String(c["descricao"])} (#{String(c["id"])})
              </summary>
              {c["status"] === "aberta" && (
                <>
                  <Formulario operacao="pagar" rotulo="Registrar pagamento" id={String(c["id"])}>
                    <Campo nome="data" rotulo="Data do pagamento" tipo="date" />
                    <Escolha
                      nome="contaFinanceiraId"
                      rotulo="Conta de saída"
                      opcoes={cad["contas"] ?? []}
                    />
                  </Formulario>
                  <Formulario operacao="cancelar" rotulo="Cancelar conta" id={String(c["id"])} />
                </>
              )}
              <FormularioAcao acao={anexar} rotulo="Enviar anexo" rotuloPendente="Enviando…">
                <input type="hidden" name="id" value={String(c["id"])} />
                <label>
                  PDF/JPG/PNG até 10 MB
                  <input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
                </label>
              </FormularioAcao>
              <ul>
                {(Array.isArray(c["anexos"]) ? (c["anexos"] as Row[]) : []).map((a) => (
                  <li key={String(a["id"])}>
                    <a href={"/api/financeiro/anexos/" + encodeURIComponent(String(a["id"]))}>
                      Baixar {String(a["nome"])}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <h2>Totais por categoria</h2>
          <Tabela
            dados={pagar.totais}
            colunas={[
              ["categoria", "Categoria"],
              ["status", "Status"],
              ["total_centavos", "Total (centavos)"],
            ]}
          />
          <p>
            <Link href="/setores/financeiro/fluxo-de-caixa">
              Configurar contas recorrentes no fluxo de caixa
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
