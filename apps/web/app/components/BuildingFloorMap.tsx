"use client";

import type {
  AgentStatus,
  BudgetAlertLevel,
  FloorPresentation,
  MockAgent,
} from "../../lib/mock-types.ts";

export interface BuildingFloorMapProps {
  readonly floors: readonly FloorPresentation[];
  readonly selectedFloor: FloorPresentation | null;
  readonly filteredAgents: readonly MockAgent[];
  readonly isProvisioning: boolean;
  readonly agentQuery: string;
  readonly onSelectFloor: (floorId: string) => void;
  readonly onChangeAgentQuery: (query: string) => void;
}

function getAgentStatusLabel(status: AgentStatus): {
  readonly label: string;
  readonly badgeClass: string;
} {
  switch (status) {
    case "executing":
      return { label: "Em execução", badgeClass: "demo-badge demo-badge--ok" };
    case "awaiting_approval":
      return {
        label: "Aguarda aprovação",
        badgeClass: "demo-badge demo-badge--warn",
      };
    case "degraded":
      return {
        label: "Pausado / Cota",
        badgeClass: "demo-badge demo-badge--danger",
      };
    case "idle":
      return { label: "Ocioso", badgeClass: "demo-badge demo-badge--info" };
  }
}

function getBudgetBadgeClass(level: BudgetAlertLevel): string {
  switch (level) {
    case "critical_100":
      return "demo-badge demo-badge--danger";
    case "warning_80":
      return "demo-badge demo-badge--warn";
    case "healthy":
      return "demo-badge demo-badge--ok";
  }
}

function getProgressFillClass(level: BudgetAlertLevel): string {
  switch (level) {
    case "critical_100":
      return "progress-fill progress-fill--danger";
    case "warning_80":
      return "progress-fill progress-fill--warn";
    case "healthy":
      return "progress-fill";
  }
}

export function BuildingFloorMap({
  floors,
  selectedFloor,
  filteredAgents,
  isProvisioning,
  agentQuery,
  onSelectFloor,
  onChangeAgentQuery,
}: BuildingFloorMapProps) {
  return (
    <section className="panel-card" aria-labelledby="building-section-heading">
      <div className="panel-header">
        <div>
          <h2 id="building-section-heading">
            Edifício Virtual &amp; Departamentos Contratados (Modo 2D Acessível)
          </h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
            Cada andar representa um módulo contratado pela organização. Selecione um andar pelo
            teclado ou clique para inspecionar suas estações de agentes.
          </p>
        </div>
        {isProvisioning ? (
          <span className="demo-badge demo-badge--warn">Edifício em construção (PROVISIONING)</span>
        ) : (
          <span className="demo-badge demo-badge--ok">
            Planta sincronizada ({floors.length} andares)
          </span>
        )}
      </div>

      <div className="building-layout">
        <div
          className="building-stack"
          role="group"
          aria-label="Corte vertical de andares do edifício da organização"
        >
          <div className="building-roof">Topo do Edifício · Gateway &amp; Isolamento do Tenant</div>

          {floors.map((floor) => {
            const isSelected = selectedFloor?.id === floor.id;
            return (
              <button
                key={floor.id}
                type="button"
                className="floor-button"
                aria-pressed={isSelected}
                aria-label={`Andar ${floor.floorNumber}: ${floor.name}, ${floor.agents.length} agentes, orçamento em ${floor.budgetStatus.percentage}%`}
                onClick={() => {
                  onSelectFloor(floor.id);
                }}
              >
                <div className="floor-button__top">
                  <strong>
                    {floor.floorNumber}º Andar · {floor.name}
                  </strong>
                  <span className={getBudgetBadgeClass(floor.budgetStatus.alertLevel)}>
                    {floor.budgetStatus.percentage}% cota
                  </span>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Módulo <code>{floor.moduleCode}</code> · {floor.agents.length}{" "}
                  {floor.agents.length === 1 ? "agente" : "agentes"} ({floor.executingAgentsCount}{" "}
                  em execução)
                </div>

                <div className="floor-windows" aria-hidden="true">
                  {floor.agents.map((agent) => (
                    <span key={agent.id} className="window-pill">
                      [{agent.workstationCode}] {agent.name}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="panel-card" style={{ background: "var(--bg-elevated)" }}>
          {selectedFloor ? (
            <>
              <div className="panel-header">
                <div>
                  <h3 id="selected-floor-heading">
                    {selectedFloor.floorNumber}º Andar — {selectedFloor.name}
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "0.86rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {selectedFloor.summary}
                  </p>
                </div>
                <span className={getBudgetBadgeClass(selectedFloor.budgetStatus.alertLevel)}>
                  {selectedFloor.budgetStatus.alertLabel}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span>Orçamento mensal do andar</span>
                    <strong>
                      R$ {selectedFloor.monthlySpentBrl} / R$ {selectedFloor.monthlyBudgetBrl} (
                      {selectedFloor.budgetStatus.percentage}%)
                    </strong>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className={getProgressFillClass(selectedFloor.budgetStatus.alertLevel)}
                      style={{
                        width: `${Math.min(100, selectedFloor.budgetStatus.percentage)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="control-group">
                  <label htmlFor="floor-agent-filter">Filtrar agentes neste andar</label>
                  <input
                    id="floor-agent-filter"
                    type="search"
                    className="control-input"
                    placeholder="Nome, código ou tarefa..."
                    value={agentQuery}
                    onChange={(e) => {
                      onChangeAgentQuery(e.target.value);
                    }}
                  />
                </div>
              </div>

              {filteredAgents.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  Nenhum agente corresponde ao filtro informado neste andar.
                </p>
              ) : (
                <div
                  className="agent-grid"
                  role="list"
                  aria-label={`Estações de trabalho do ${selectedFloor.floorNumber}º andar`}
                >
                  {filteredAgents.map((agent) => {
                    const statusMeta = getAgentStatusLabel(agent.status);
                    const tokenPct =
                      agent.tokensLimitMonth === 0
                        ? 0
                        : Math.round((agent.tokensUsedMonth / agent.tokensLimitMonth) * 100);
                    return (
                      <article key={agent.id} role="listitem" className="agent-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                          }}
                        >
                          <div>
                            <strong>{agent.name}</strong>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {agent.roleTitle} · Sala <code>{agent.workstationCode}</code>
                            </div>
                          </div>
                          <span className={statusMeta.badgeClass}>{statusMeta.label}</span>
                        </div>

                        <p
                          style={{
                            margin: "0.25rem 0",
                            fontSize: "0.84rem",
                            color: "var(--text-primary)",
                          }}
                        >
                          {agent.currentTaskSummary}
                        </p>

                        <div
                          style={{
                            fontSize: "0.76rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>Modelo: {agent.modelName}</span>
                          <span>Tokens: {tokenPct}% da cota</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p>Selecione um andar para visualizar os agentes.</p>
          )}
        </div>
      </div>
    </section>
  );
}
