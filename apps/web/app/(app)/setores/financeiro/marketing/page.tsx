import Link from "next/link";
import { Filtros, parametros, type BuscaGestao } from "../_components/Gestao.tsx";
import { consultar, Indisponivel, Tabela, Formulario, Campo } from "../_components/Base.tsx";
export default async function Page({ searchParams }: { searchParams: BuscaGestao }) {
  const p = parametros(await searchParams),
    dados = await consultar<{
      campanhas: Record<string, unknown>[];
      produtos: Record<string, unknown>[];
      nao_atribuida: string;
      aviso: string;
    }>("/rentabilidade?" + p.toString());
  return (
    <main id="conteudo" className="page">
      <Link href="/setores/financeiro">← Financeiro</Link>
      <h1>Investimentos em Marketing</h1>
      <Filtros p={p} />
      {!dados ? (
        <Indisponivel />
      ) : (
        <>
          <p>{dados.aviso}</p>
          <p>
            Receita não atribuída: {dados.nao_atribuida} centavos. Valores monetários em BRL,
            centavos.
          </p>
          <Tabela
            dados={dados.campanhas}
            colunas={[
              ["nome", "Campanha"],
              ["gasto", "Gasto"],
              ["receita", "Receita atribuída"],
              ["novos", "Novos compradores"],
              ["roas", "ROAS"],
              ["cac", "CAC"],
              ["margem_pos_aquisicao", "Margem pós aquisição"],
            ]}
          />
          <h2>Comparação de produtos e ofertas</h2>
          <Tabela
            dados={dados.produtos}
            colunas={[
              ["campanha_id", "Campanha (ID)"],
              ["produto_id", "Produto (ID)"],
              ["oferta_codigo", "Oferta"],
              ["receita", "Receita"],
              ["liquida", "Receita após taxas e comissões"],
            ]}
          />
          <Formulario
            operacao="avaliar-marketing"
            rotulo="Gerar alertas de campanhas abaixo do limite"
          >
            <input type="hidden" name="de" value={p.get("de") ?? ""} />
            <input type="hidden" name="ate" value={p.get("ate") ?? ""} />
            <Campo nome="limiteRoas" rotulo="ROAS mínimo" tipo="number" />
          </Formulario>
        </>
      )}
    </main>
  );
}
