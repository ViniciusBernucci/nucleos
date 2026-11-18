import Link from "next/link";
import type { ReactNode } from "react";
import type { Funcionario, Setor } from "@nucleos/contracts";
import { FormularioAcao } from "../../setores/financeiro/fluxo-de-caixa/_components/FormularioAcao.tsx";
import { PainelLateral } from "../../setores/financeiro/fluxo-de-caixa/_components/PainelLateral.tsx";
import { alterarFuncionario } from "../actions.ts";
import styles from "../funcionarios.module.css";
export { styles, FormularioAcao, PainelLateral, alterarFuncionario };
export function PaginaFuncionarios({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main id="conteudo" className={styles["pagina"]}>
      <header>
        <h1>{titulo}</h1>
        <nav aria-label="Funcionários">
          <Link href="/funcionarios">Visão geral</Link> ·{" "}
          <Link href="/funcionarios/catalogo">Catálogo de tarefas</Link> ·{" "}
          <Link href="/funcionarios/execucoes">Histórico de execuções</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
export function Oculto({ nome, valor }: { nome: string; valor: string }) {
  return <input type="hidden" name={nome} value={valor} />;
}
export function Operacao({
  op,
  id,
  atribuicao,
  status,
  rotulo,
}: {
  op: string;
  id?: string;
  atribuicao?: string;
  status?: string;
  rotulo: string;
}) {
  return (
    <FormularioAcao acao={alterarFuncionario} rotulo={rotulo} rotuloPendente="Salvando…">
      <Oculto nome="operacao" valor={op} />
      {id ? <Oculto nome="id" valor={id} /> : null}
      {atribuicao ? <Oculto nome="atribuicao_id" valor={atribuicao} /> : null}
      {status ? <Oculto nome="status" valor={status} /> : null}
    </FormularioAcao>
  );
}
export function CadastroFuncionario({
  setores,
  funcionario,
}: {
  setores: Setor[];
  funcionario?: Funcionario;
}) {
  return (
    <PainelLateral
      titulo={funcionario ? "Editar funcionário" : "Novo funcionário"}
      rotuloBotao={funcionario ? "Editar" : "Novo funcionário"}
    >
      <FormularioAcao
        acao={alterarFuncionario}
        rotulo="Salvar funcionário"
        rotuloPendente="Salvando…"
        className={styles["formulario"]}
      >
        <Oculto nome="operacao" valor={funcionario ? "editar" : "criar"} />
        {funcionario ? <Oculto nome="id" valor={funcionario.id} /> : null}
        <label>
          Nome
          <input name="nome" maxLength={160} required defaultValue={funcionario?.nome} />
        </label>
        <label>
          Setor
          <select name="setor_id" defaultValue={funcionario?.setor_id}>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descrição e função
          <textarea
            name="descricao"
            required
            maxLength={2000}
            defaultValue={funcionario?.descricao}
          />
        </label>
        <label>
          Tipo
          <select name="tipo" defaultValue={funcionario?.tipo ?? "DETERMINISTICO"}>
            <option>DETERMINISTICO</option>
            <option>AGENTE_IA</option>
            <option>HIBRIDO</option>
          </select>
        </label>
        <label>
          Referência do perfil de IA
          <input name="perfil_ia" defaultValue={funcionario?.perfil_ia ?? ""} />
        </label>
        <label>
          Identificador do avatar
          <input name="avatar" pattern="[a-z0-9_-]+" defaultValue={funcionario?.avatar ?? ""} />
        </label>
        <p>
          Novos funcionários começam em rascunho e só podem ser ativados com um executor disponível.
        </p>
      </FormularioAcao>
    </PainelLateral>
  );
}
export const dataLocal = (x: string | null) =>
  x === null ? "—" : new Date(x).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
export function ListaFuncionarios({ itens }: { itens: Funcionario[] }) {
  return (
    <div className={styles["tabela"]}>
      <table>
        <caption>Funcionários cadastrados</caption>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Tarefas</th>
            <th>Última execução</th>
            <th>Próxima execução</th>
            <th>Falhas (7 dias)</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/funcionarios/${f.id}`}>{f.nome}</Link>
              </td>
              <td>{f.tipo}</td>
              <td>{f.status}</td>
              <td>{f.tarefas}</td>
              <td>{dataLocal(f.ultima_em)}</td>
              <td>{dataLocal(f.proxima_em)}</td>
              <td>{f.falhas}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {itens.length === 0 ? <p>Nenhum funcionário encontrado.</p> : null}
    </div>
  );
}
