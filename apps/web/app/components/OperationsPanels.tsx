"use client";

import type {
  ApprovalRiskLevel,
  FloorPresentation,
  MockApprovalItem,
  MockSecurityActivityItem,
  MockTaskItem,
  SecurityEventSeverity,
  TaskStatus,
} from "../../lib/mock-types.ts";

export interface SimulatedApprovalDecision {
  readonly approvalId: string;
  readonly decision: "approved" | "rejected";
}

export interface OperationsPanelsProps {
  readonly approvals: readonly MockApprovalItem[];
  readonly tasks: readonly MockTaskItem[];
  readonly floors: readonly FloorPresentation[];
  readonly recentActivity: readonly MockSecurityActivityItem[];
  readonly canDecideApprovals: boolean;
  readonly activeRoleLabel: string;
  readonly decisions: readonly SimulatedApprovalDecision[];
  readonly onDecideApproval: (approvalId: string, decision: "approved" | "rejected") => void;
}

function getRiskBadge(risk: ApprovalRiskLevel): {
  readonly label: string;
  readonly className: string;
} {
  switch (risk) {
    case "high":
      return {
        label: "Risco Alto",
        className: "demo-badge demo-badge--danger",
      };
    case "medium":
      return {
        label: "Risco Médio",
        className: "demo-badge demo-badge--warn",
      };
    case "low":
      return { label: "Risco Baixo", className: "demo-badge demo-badge--ok" };
  }
}

function getTaskBadge(status: TaskStatus): {
  readonly label: string;
  readonly className: string;
} {
  switch (status) {
    case "running":
      return { label: "Em execução", className: "demo-badge demo-badge--ok" };
    case "awaiting_human":
      return {
        label: "Aguarda humano",
        className: "demo-badge demo-badge--warn",
      };
    case "queued":
      return { label: "Na fila", className: "demo-badge demo-badge--info" };
    case "completed":
      return { label: "Concluída", className: "demo-badge demo-badge--ok" };
    case "failed":
      return { label: "Falhou", className: "demo-badge demo-badge--danger" };
  }
}

function getSeverityBadge(severity: SecurityEventSeverity): {
  readonly label: string;
  readonly className: string;
} {
  switch (severity) {
    case "high":
      return { label: "Crítico", className: "demo-badge demo-badge--danger" };
    case "warning":
      return { label: "Alerta", className: "demo-badge demo-badge--warn" };
    case "info":
      return { label: "Info", className: "demo-badge demo-badge--info" };
  }
}

export function OperationsPanels({
  approvals,
  tasks,
  floors,
  recentActivity,
  canDecideApprovals,
  activeRoleLabel,
  decisions,
  onDecideApproval,
}: OperationsPanelsProps) {
  return (
    <div className="two-col-grid">
      <section className="panel-card" aria-labelledby="approvals-panel-heading">
        <div className="panel-header">
          <div>
            <h2 id="approvals-panel-heading">Aprovações Humanas Pendentes (HITL)</h2>
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              Resumo validado e hash da ação antes de liberar execução.
            </p>
          </div>
          <span className="demo-badge demo-badge--warn">{approvals.length} pendente(s)</span>
        </div>

        <ul className="item-list">
          {approvals.map((item) => {
            const riskMeta = getRiskBadge(item.riskLevel);
            const simulated = decisions.find((entry) => entry.approvalId === item.id);

            return (
              <li key={item.id} className="item-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                  }}
                >
                  <strong>{item.title}</strong>
                  <span className={riskMeta.className}>{riskMeta.label}</span>
                </div>

                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {item.departmentName} · Agente: <strong>{item.agentName}</strong> ·{" "}
                  {item.expiresInLabel}
                </div>

                <p style={{ margin: "0.2rem 0", fontSize: "0.86rem" }}>{item.serverSummary}</p>

                <div className="code-preview">
                  <div>
                    Hash da ação: <strong>{item.actionHash}</strong>
                  </div>
                  <div>Argumentos: {item.argumentsPreview}</div>
                </div>

                {simulated ? (
                  <div
                    role="status"
                    className={
                      simulated.decision === "approved"
                        ? "demo-badge demo-badge--ok"
                        : "demo-badge demo-badge--danger"
                    }
                  >
                    Decisão simulada localmente:{" "}
                    {simulated.decision === "approved"
                      ? "APROVADA (sem efeito de rede)"
                      : "REJEITADA (sem efeito de rede)"}
                  </div>
                ) : canDecideApprovals ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn btn--approve"
                      aria-label={`Simular aprovação para ${item.title}`}
                      onClick={() => {
                        onDecideApproval(item.id, "approved");
                      }}
                    >
                      Simular Aprovação
                    </button>
                    <button
                      type="button"
                      className="btn btn--reject"
                      aria-label={`Simular rejeição para ${item.title}`}
                      onClick={() => {
                        onDecideApproval(item.id, "rejected");
                      }}
                    >
                      Simular Rejeição
                    </button>
                  </div>
                ) : (
                  <div className="demo-badge demo-badge--info" style={{ alignSelf: "flex-start" }}>
                    Somente leitura: papel atual ({activeRoleLabel}) não possui{" "}
                    {item.requiredPermission}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel-card" aria-labelledby="tasks-panel-heading">
        <div className="panel-header">
          <div>
            <h2 id="tasks-panel-heading">Tarefas &amp; Fila de Execução</h2>
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              Jobs acompanhados pelo Dispatcher e estado atual por agente.
            </p>
          </div>
          <span className="demo-badge demo-badge--info">{tasks.length} registrada(s)</span>
        </div>

        <ul className="item-list">
          {tasks.map((task) => {
            const statusMeta = getTaskBadge(task.status);
            return (
              <li key={task.id} className="item-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <code>{task.code}</code> · <strong>{task.title}</strong>
                  </div>
                  <span className={statusMeta.className}>{statusMeta.label}</span>
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {task.departmentName} · {task.agentName} · Iniciado {task.startedAtLabel} (
                  {task.durationLabel})
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel-card" aria-labelledby="budget-panel-heading">
        <div className="panel-header">
          <div>
            <h2 id="budget-panel-heading">Consumo de IA vs. Orçamento por Departamento</h2>
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              Limiares automáticos de alerta em 80% e contenção em 100%.
            </p>
          </div>
        </div>

        <ul className="item-list">
          {floors.map((floor) => (
            <li key={floor.id} className="item-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <strong>
                  {floor.floorNumber}º Andar · {floor.name}
                </strong>
                <span
                  className={
                    floor.budgetStatus.alertLevel === "critical_100"
                      ? "demo-badge demo-badge--danger"
                      : floor.budgetStatus.alertLevel === "warning_80"
                        ? "demo-badge demo-badge--warn"
                        : "demo-badge demo-badge--ok"
                  }
                >
                  {floor.budgetStatus.percentage}% — {floor.budgetStatus.alertLabel}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                }}
              >
                Gasto: R$ {floor.monthlySpentBrl} de R$ {floor.monthlyBudgetBrl} · Tokens:{" "}
                {floor.tokensUsedMonth.toLocaleString("pt-BR")} /{" "}
                {floor.tokensLimitMonth.toLocaleString("pt-BR")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card" aria-labelledby="activity-panel-heading">
        <div className="panel-header">
          <div>
            <h2 id="activity-panel-heading">Atividade Recente &amp; Eventos de Segurança</h2>
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              Trilha de auditoria isolada do tenant com código de correlação.
            </p>
          </div>
        </div>

        <ul className="item-list">
          {recentActivity.map((event) => {
            const sev = getSeverityBadge(event.severity);
            return (
              <li key={event.id} className="item-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <code>{event.eventCode}</code>
                  <span className={sev.className}>{sev.label}</span>
                </div>
                <p style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>{event.summary}</p>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <span>
                    Origem: {event.actorLabel} ({event.timestampLabel})
                  </span>
                  <span>
                    Correlação: <code>{event.correlationId}</code>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
