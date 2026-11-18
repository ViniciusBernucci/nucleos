import type { DefinicaoTarefa, Setor } from "@nucleos/contracts";
import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
import {
  alterarFuncionario,
  FormularioAcao,
  Oculto,
  PaginaFuncionarios,
  PainelLateral,
  styles,
} from "../_components/Comum.tsx";
export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const filtros = new URLSearchParams();
  for (const nome of ["setor", "status"]) if (q[nome]) filtros.set(nome, q[nome]);
  const [r, s] = await Promise.all([
    funcionariosApi<DefinicaoTarefa[]>(`/catalogo?${filtros}`),
    funcionariosApi<Setor[]>("/setores"),
  ]);
  return (
    <PaginaFuncionarios titulo="Catálogo de tarefas">
      <p>
        Uma tarefa cadastrada só pode executar quando houver um handler implementado, atribuição
        habilitada e funcionário ativo.
      </p>
      {s.ok ? (
        <>
          <form className={styles["filtros"]}>
            <label>
              Setor
              <select name="setor" defaultValue={q["setor"] ?? ""}>
                <option value="">Todos</option>
                {s.dados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Implementação
              <select name="status" defaultValue={q["status"] ?? ""}>
                <option value="">Todas</option>
                <option>DISPONIVEL</option>
                <option>PLANEJADA</option>
                <option>INDISPONIVEL</option>
              </select>
            </label>
            <button className="btn btn--secondary">Filtrar</button>
          </form>
          <PainelLateral titulo="Cadastrar tarefa planejada" rotuloBotao="Nova tarefa planejada">
            <FormularioAcao
              acao={alterarFuncionario}
              rotulo="Cadastrar rascunho"
              rotuloPendente="Salvando…"
              className={styles["formulario"]}
            >
              <Oculto nome="operacao" valor="tarefa" />
              <label>
                Nome
                <input name="nome" required />
              </label>
              <label>
                Código
                <input
                  name="codigo"
                  pattern="[a-z]+\.[a-z_]+"
                  required
                  placeholder="financeiro.nova_rotina"
                />
              </label>
              <label>
                Setor
                <select name="setor_id">
                  {s.dados.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select name="tipo">
                  <option>DETERMINISTICO</option>
                  <option>TAREFA_IA</option>
                  <option>AGENTE_IA</option>
                  <option>HIBRIDO</option>
                </select>
              </label>
              <label>
                Descrição
                <textarea name="descricao" required />
              </label>
              <p>O cadastro não aceita código nem handler. A tarefa permanece planejada.</p>
            </FormularioAcao>
          </PainelLateral>
        </>
      ) : null}
      {r.ok ? (
        <div className={styles["tabela"]}>
          <table>
            <caption>Tarefas registradas</caption>
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Implementação</th>
                <th>Atribuições</th>
                <th>Habilitadas</th>
                <th>Editar metadados</th>
              </tr>
            </thead>
            <tbody>
              {r.dados.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.nome}</strong>
                    <br />
                    <code>{t.codigo}</code>
                    <p>{t.descricao}</p>
                  </td>
                  <td>
                    {t.status_implementacao}
                    {!t.ativo ? " · inativa" : ""}
                  </td>
                  <td>{t.atribuicoes ?? 0}</td>
                  <td>{t.habilitadas ?? 0}</td>
                  <td>
                    <PainelLateral titulo={`Editar ${t.nome}`} rotuloBotao="Editar">
                      <FormularioAcao
                        acao={alterarFuncionario}
                        rotulo="Salvar"
                        rotuloPendente="Salvando…"
                        className={styles["formulario"]}
                      >
                        <Oculto nome="operacao" valor="editar-tarefa" />
                        <Oculto nome="id" valor={t.id} />
                        <label>
                          Nome
                          <input name="nome" defaultValue={t.nome} required />
                        </label>
                        <label>
                          Descrição
                          <textarea name="descricao" defaultValue={t.descricao} required />
                        </label>
                        <label>
                          Ativa
                          <select name="ativo" defaultValue={String(t.ativo)}>
                            <option value="true">Sim</option>
                            <option value="false">Não</option>
                          </select>
                        </label>
                      </FormularioAcao>
                    </PainelLateral>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="alert">{r.mensagem}</p>
      )}
    </PaginaFuncionarios>
  );
}
