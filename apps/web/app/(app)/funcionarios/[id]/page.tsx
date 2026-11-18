import Link from "next/link";
import type {
  DefinicaoTarefa,
  DetalheFuncionario,
  ListaExecucoes,
  Setor,
} from "@nucleos/contracts";
import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
import {
  CadastroFuncionario,
  alterarFuncionario,
  dataLocal,
  FormularioAcao,
  Oculto,
  Operacao,
  PaginaFuncionarios,
  PainelLateral,
  styles,
} from "../_components/Comum.tsx";
import { ConfigurarAgenda } from "../_components/Agendamento.tsx";
import { ConfigCampos } from "../_components/ConfigCampos.tsx";
export default async function Detalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const r = await funcionariosApi<DetalheFuncionario>(`/${encodeURIComponent(id)}`);
  if (!r.ok)
    return (
      <PaginaFuncionarios titulo="Funcionário">
        <p role="alert">{r.mensagem}</p>
      </PaginaFuncionarios>
    );
  const { funcionario: f, atribuicoes } = r.dados;
  const [setores, catalogo, eventos, historico] = await Promise.all([
    funcionariosApi<Setor[]>("/setores"),
    funcionariosApi<DefinicaoTarefa[]>(`/catalogo?setor=${f.setor_id}`),
    funcionariosApi<string[]>("/eventos"),
    funcionariosApi<ListaExecucoes>(`/execucoes?funcionario=${id}`),
  ]);
  const aba = q["aba"] ?? "visao-geral";
  const abas = [
    ["visao-geral", "Visão geral"],
    ["tarefas", "Tarefas"],
    ["agendamentos", "Agendamentos"],
    ["execucoes", "Execuções"],
    ["configuracoes", "Configurações"],
  ];
  return (
    <PaginaFuncionarios titulo={f.nome}>
      <p>
        {f.tipo} · {f.status} · {f.descricao}
      </p>
      <nav aria-label="Detalhes do funcionário">
        {abas.map(([codigo, nome]) => (
          <Link
            key={codigo}
            href={`/funcionarios/${id}?aba=${codigo}`}
            aria-current={aba === codigo ? "page" : undefined}
          >
            {nome}
          </Link>
        ))}
      </nav>
      {aba === "visao-geral" ? (
        <section className={styles["painel"]}>
          <h2>Atividade</h2>
          <p>
            {f.tarefas} tarefas atribuídas. {f.falhas} falhas nos últimos 7 dias.
          </p>
          <p>
            Última: {dataLocal(f.ultima_em)}. Próxima: {dataLocal(f.proxima_em)}.
          </p>
          <Link href={`/funcionarios/${id}?aba=tarefas`}>
            Ver tarefas e configurar agendamentos
          </Link>
        </section>
      ) : null}
      {aba === "configuracoes" ? (
        <section className={styles["aba"]}>
          <h2>Configurações do funcionário</h2>
          {setores.ok ? <CadastroFuncionario setores={setores.dados} funcionario={f} /> : null}
          <div className={styles["acoes"]}>
            <Operacao
              op="status"
              id={id}
              status={f.status === "ATIVO" ? "PAUSADO" : "ATIVO"}
              rotulo={f.status === "ATIVO" ? "Pausar" : "Ativar"}
            />
            <Operacao op="status" id={id} status="DESATIVADO" rotulo="Desativar" />
          </div>
          <p>A pausa impede novos disparos e preserva as execuções já iniciadas.</p>
        </section>
      ) : null}
      {aba === "tarefas" || aba === "agendamentos" ? (
        <section className={styles["aba"]}>
          <h2>{aba === "tarefas" ? "Tarefas atribuídas" : "Agendamentos"}</h2>
          {catalogo.ok ? (
            <PainelLateral titulo="Atribuir tarefa do setor" rotuloBotao="Atribuir tarefa">
              <FormularioAcao
                acao={alterarFuncionario}
                rotulo="Atribuir"
                rotuloPendente="Salvando…"
                className={styles["formulario"]}
              >
                <Oculto nome="operacao" valor="atribuir" />
                <Oculto nome="id" valor={id} />
                <label>
                  Tarefa disponível
                  <select name="definicao_id" required>
                    {catalogo.dados
                      .filter(
                        (t) =>
                          t.ativo &&
                          t.status_implementacao === "DISPONIVEL" &&
                          !atribuicoes.some((a) => a.definicao_id === t.id),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Configuração inicial (JSON)
                  <textarea name="config" defaultValue="{}" />
                </label>
                <p>
                  Tarefas planejadas só aparecem no catálogo e não podem ser atribuídas para
                  execução.
                </p>
              </FormularioAcao>
            </PainelLateral>
          ) : null}
          {atribuicoes.map((a) => (
            <article key={a.id} className={styles["painel"]}>
              <h3>{a.nome_override ?? a.definicao.nome}</h3>
              <p>
                {a.definicao.status_implementacao} · {a.habilitada ? "Habilitada" : "Desabilitada"}
              </p>
              {a.definicao.status_implementacao === "DISPONIVEL" ? (
                <>
                  <div className={styles["acoes"]}>
                    <Operacao op="executar" atribuicao={a.id} rotulo="Executar agora" />
                    <Link
                      href={`/funcionarios/execucoes?funcionario=${id}&tarefa=${a.definicao_id}`}
                    >
                      Histórico
                    </Link>
                    <PainelLateral
                      titulo={`Configurar ${a.definicao.nome}`}
                      rotuloBotao="Configurar tarefa"
                    >
                      <FormularioAcao
                        acao={alterarFuncionario}
                        rotulo="Salvar configuração"
                        rotuloPendente="Salvando…"
                        className={styles["formulario"]}
                      >
                        <Oculto nome="operacao" valor="configurar" />
                        <Oculto nome="atribuicao_id" valor={a.id} />
                        <ConfigCampos schema={a.definicao.config_schema} config={a.config} />
                        <label>
                          Habilitada
                          <select name="habilitada" defaultValue={String(a.habilitada)}>
                            <option value="true">Sim</option>
                            <option value="false">Não</option>
                          </select>
                        </label>
                        <label>
                          Prioridade
                          <input
                            type="number"
                            min="0"
                            max="100"
                            name="prioridade"
                            defaultValue={a.prioridade}
                          />
                        </label>
                      </FormularioAcao>
                    </PainelLateral>
                    <Operacao op="remover" atribuicao={a.id} rotulo="Remover atribuição" />
                  </div>
                  {a.agendamentos.map((s) => (
                    <div key={s.id}>
                      <p>
                        {s.gatilho}
                        {s.intervalo_min !== null ? ` · ${s.intervalo_min} min` : ""} ·{" "}
                        {s.habilitado ? "Habilitado" : "Suspenso"} · Próxima:{" "}
                        {dataLocal(s.proxima_em)}
                      </p>
                      <ConfigurarAgenda
                        atribuicaoId={a.id}
                        agenda={s}
                        eventos={eventos.ok ? eventos.dados : []}
                      />
                      <FormularioAcao
                        acao={alterarFuncionario}
                        rotulo="Suspender"
                        rotuloPendente="Suspendendo…"
                      >
                        <Oculto nome="operacao" valor="suspender" />
                        <Oculto nome="agendamento_id" valor={s.id} />
                      </FormularioAcao>
                    </div>
                  ))}
                  <ConfigurarAgenda atribuicaoId={a.id} eventos={eventos.ok ? eventos.dados : []} />
                </>
              ) : (
                <p>Executor ainda não disponível. Não há ação de agendamento ou execução.</p>
              )}
            </article>
          ))}
          {atribuicoes.length === 0 ? <p>Nenhuma tarefa atribuída.</p> : null}
        </section>
      ) : null}
      {aba === "execucoes" ? (
        <section className={styles["painel"]}>
          <h2>Execuções recentes</h2>
          {historico.ok ? (
            <ul>
              {historico.dados.itens.map((e) => (
                <li key={e.id}>
                  <Link href={`/funcionarios/execucoes/${e.id}`}>
                    {e.tarefa_nome} · {e.status} · {dataLocal(e.criado_em)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p role="alert">{historico.mensagem}</p>
          )}
        </section>
      ) : null}
    </PaginaFuncionarios>
  );
}
