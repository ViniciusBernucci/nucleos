import type { EstadoSincronizacao, StatusSincronizacao } from "@nucleos/contracts";
import { tempoDecorrido } from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

const ROTULO: Record<StatusSincronizacao, { texto: string; classe: string }> = {
  sucesso: { texto: "Atualizado", classe: "badge badge--ok" },
  parcial: { texto: "Atualização parcial", classe: "badge badge--warn" },
  falha: { texto: "Falha na atualização", classe: "badge badge--danger" },
  em_andamento: { texto: "Atualizando agora", classe: "badge badge--info" },
  nunca: { texto: "Ainda não atualizado", classe: "badge badge--info" },
};

/** Quando os dados vieram da Hotmart pela ultima vez e a cada quanto tempo se renovam. */
export function Sincronizacao({ estado, agora }: { estado: EstadoSincronizacao; agora: Date }) {
  const rotulo = ROTULO[estado.status];
  return (
    <div className={styles["sync"]} role="status">
      <span className={rotulo.classe}>{rotulo.texto}</span>
      <span>
        Última atualização bem-sucedida:{" "}
        <strong>{tempoDecorrido(estado.ultimoSucessoEm, agora)}</strong>
      </span>
      <span>
        {estado.habilitada
          ? `Verificação automática a cada ${String(estado.intervaloMinutos)} min`
          : "Verificação automática desativada (Hotmart sem credenciais na API)"}
      </span>
      {estado.mensagem !== null ? <p className={styles["syncAviso"]}>{estado.mensagem}</p> : null}
    </div>
  );
}
