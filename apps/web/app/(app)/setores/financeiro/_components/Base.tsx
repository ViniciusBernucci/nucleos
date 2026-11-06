import Link from "next/link";
import type { ReactNode } from "react";
import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
import { FormularioAcao } from "../fluxo-de-caixa/_components/FormularioAcao.tsx";
import { PainelLateral } from "../fluxo-de-caixa/_components/PainelLateral.tsx";
import { executarFinanceiro } from "./acoes.ts";
export function exibir(v: unknown): string {
  return typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "bigint" ||
    typeof v === "boolean"
    ? String(v)
    : "—";
}
export function NavegacaoFinanceira() {
  return (
    <nav aria-label="Financeiro">
      <Link href="/setores/financeiro/vendas/receitas">Receitas e vendas</Link>
      {" · "}
      <Link href="/setores/financeiro/contas">Contas a pagar e receber</Link>
      {" · "}
      <Link href="/setores/financeiro/movimentacoes">Movimentações</Link>
      {" · "}
      <Link href="/setores/financeiro/conciliacao">Conciliação</Link>
      {" · "}
      <Link href="/setores/financeiro/alertas">Alertas</Link>
    </nav>
  );
}
export function Campo({
  nome,
  rotulo,
  tipo = "text",
  obrigatorio = true,
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBlock: 12 }}>
      {rotulo}
      <input name={nome} type={tipo} required={obrigatorio} maxLength={200} />
    </label>
  );
}
export function Escolha({
  nome,
  rotulo,
  opcoes,
}: {
  nome: string;
  rotulo: string;
  opcoes: Record<string, unknown>[];
}) {
  return (
    <label style={{ display: "block", marginBlock: 12 }}>
      {rotulo}
      <select name={nome} required>
        <option value="">Selecione</option>
        {opcoes.map((o) => (
          <option value={String(o["id"])} key={String(o["id"])}>
            {String(o["nome"] ?? o["descricao"] ?? o["id"])}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Formulario({
  operacao,
  rotulo,
  children,
  id,
}: {
  operacao: string;
  rotulo: string;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <FormularioAcao acao={executarFinanceiro} rotulo={rotulo} rotuloPendente="Aguarde…">
      <input type="hidden" name="operacao" value={operacao} />
      {id && <input type="hidden" name="id" value={id} />} {children}
    </FormularioAcao>
  );
}
export function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <PainelLateral rotuloBotao={titulo} titulo={titulo} fecharAoConcluir={false}>
      {children}
    </PainelLateral>
  );
}
export function Tabela({
  dados,
  colunas,
}: {
  dados: Record<string, unknown>[];
  colunas: [string, string][];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {colunas.map(([k, n]) => (
              <th key={k}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.map((d, i) => (
            <tr key={exibir(d["id"] ?? d["transacao"] ?? i)}>
              {colunas.map(([k]) => (
                <td key={k}>{d[k] === null || d[k] === undefined ? "—" : exibir(d[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!dados.length && <p>Nenhum registro para os filtros.</p>}
    </div>
  );
}
export async function consultar<T>(path: string): Promise<T | null> {
  try {
    return (await financeiroApi(path)) as T;
  } catch {
    return null;
  }
}
export function Indisponivel() {
  return (
    <p role="status">Dados financeiros indisponíveis. Confira a conexão e a configuração da API.</p>
  );
}
