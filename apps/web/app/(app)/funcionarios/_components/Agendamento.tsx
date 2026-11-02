import type { Agendamento as TipoAgendamento } from "@nucleos/contracts";
import {
  alterarFuncionario,
  FormularioAcao,
  Oculto,
  PainelLateral,
  styles,
  dataLocal,
} from "./Comum.tsx";
function CamposAgenda({
  agenda,
  eventos,
}: {
  agenda?: TipoAgendamento;
  eventos: readonly string[];
}) {
  return (
    <>
      <label>
        Gatilho
        <select name="gatilho" defaultValue={agenda?.gatilho ?? "INTERVALO"}>
          <option>MANUAL</option>
          <option>UNICO</option>
          <option>INTERVALO</option>
          <option>CRON</option>
          <option>EVENTO</option>
        </select>
      </label>
      <label>
        Intervalo
        <input
          name="intervalo"
          type="number"
          min="1"
          max="525600"
          defaultValue={agenda?.intervalo_min ?? 30}
        />
      </label>
      <label>
        Unidade
        <select name="unidade" defaultValue="1">
          <option value="1">Minutos</option>
          <option value="60">Horas</option>
          <option value="1440">Dias</option>
        </select>
      </label>
      <label>
        Cron (5 campos)
        <input name="cron" defaultValue={agenda?.cron ?? "0 3 * * *"} placeholder="0 3 * * *" />
      </label>
      <label>
        Evento
        <select name="tipo_evento" defaultValue={agenda?.tipo_evento ?? eventos[0]}>
          {eventos.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </label>
      <label>
        Filtro do evento (JSON)
        <textarea name="filtro_evento" defaultValue={JSON.stringify(agenda?.filtro_evento ?? {})} />
      </label>
      <label>
        Fuso horário
        <input name="fuso" required defaultValue={agenda?.fuso ?? "America/Sao_Paulo"} />
      </label>
      <label>
        Início (data ISO com fuso ou Z)
        <input
          name="inicio_em"
          placeholder="2026-11-02T09:00:00-03:00"
          defaultValue={agenda?.inicio_em ?? ""}
        />
      </label>
      <label>
        Fim opcional (data ISO com fuso ou Z)
        <input name="fim_em" defaultValue={agenda?.fim_em ?? ""} />
      </label>
      <label>
        Habilitado
        <select name="habilitado" defaultValue={String(agenda?.habilitado ?? true)}>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </label>
      <label>
        Sobreposição
        <select
          name="politica_sobreposicao"
          defaultValue={agenda?.politica_sobreposicao ?? "PULAR"}
        >
          <option>PULAR</option>
          <option>ENFILEIRAR</option>
          <option>CANCELAR_ANTERIOR</option>
        </select>
      </label>
      <label>
        Máximo de tentativas
        <input
          name="maxTentativas"
          type="number"
          min="1"
          max="10"
          defaultValue={agenda?.politica_retentativa.maxTentativas ?? 3}
        />
      </label>
      <label>
        Backoff inicial (segundos)
        <input
          name="backoffSegundos"
          type="number"
          min="1"
          max="3600"
          defaultValue={agenda?.politica_retentativa.backoffSegundos ?? 30}
        />
      </label>
    </>
  );
}
export function ConfigurarAgenda({
  atribuicaoId,
  agenda,
  eventos,
}: {
  atribuicaoId: string;
  agenda?: TipoAgendamento;
  eventos: readonly string[];
}) {
  return (
    <PainelLateral
      titulo="Configurar agendamento"
      rotuloBotao={agenda ? "Configurar agendamento" : "Criar agendamento"}
      fecharAoConcluir={false}
    >
      <FormularioAcao
        acao={alterarFuncionario}
        rotulo="Salvar agendamento"
        rotuloPendente="Salvando…"
        className={styles["formulario"]}
      >
        <Oculto nome="operacao" valor="agenda" />
        <Oculto nome="atribuicao_id" valor={atribuicaoId} />
        {agenda ? <Oculto nome="agendamento_id" valor={agenda.id} /> : null}
        <CamposAgenda {...(agenda === undefined ? {} : { agenda })} eventos={eventos} />
      </FormularioAcao>
      <details>
        <summary>Validar cron e ver as próximas 5 ocorrências</summary>
        <FormularioAcao
          acao={alterarFuncionario}
          rotulo="Previsualizar"
          rotuloPendente="Calculando…"
          className={styles["formulario"]}
        >
          <Oculto nome="operacao" valor="previsualizar" />
          <CamposAgenda {...(agenda === undefined ? {} : { agenda })} eventos={eventos} />
        </FormularioAcao>
      </details>
      <p>
        Próxima execução salva: {dataLocal(agenda?.proxima_em ?? null)}. Horários exibidos em São
        Paulo.
      </p>
    </PainelLateral>
  );
}
