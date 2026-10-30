# Diffs — LOC-WEB-001 — Fundação navegável do frontend com dados mockados (2026-10-30)

> Documento principal: [2026-10-30-loc-web-001-frontend-mockado.md](2026-10-30-loc-web-001-frontend-mockado.md) · Especificação: [lote-2026-10-30-frontend-mockado-web-001.md](../planejamento-ia/lote-2026-10-30-frontend-mockado-web-001.md)

## Commit `4519ed595a1a2ed6bb5d76872b46c62534e864dc`

- **Mensagem:** `feat(web): implementa fundacao navegavel do frontend com dados mockados (LOC-WEB-001)`
- **Base:** `f322f4b1698f94ae276fdb8838137cd6b7e9cef8`

```diff
diff --git a/apps/web/app/components/BuildingFloorMap.tsx b/apps/web/app/components/BuildingFloorMap.tsx
new file mode 100644
index 0000000..f3261a2
--- /dev/null
+++ b/apps/web/app/components/BuildingFloorMap.tsx
@@ -0,0 +1,287 @@
+"use client";
+
+import type {
+  AgentStatus,
+  BudgetAlertLevel,
+  FloorPresentation,
+  MockAgent,
+} from "../../lib/mock-types.ts";
+
+export interface BuildingFloorMapProps {
+  readonly floors: readonly FloorPresentation[];
+  readonly selectedFloor: FloorPresentation | null;
+  readonly filteredAgents: readonly MockAgent[];
+  readonly isProvisioning: boolean;
+  readonly agentQuery: string;
+  readonly onSelectFloor: (floorId: string) => void;
+  readonly onChangeAgentQuery: (query: string) => void;
+}
+
+function getAgentStatusLabel(status: AgentStatus): {
+  readonly label: string;
+  readonly badgeClass: string;
+} {
+  switch (status) {
+    case "executing":
+      return { label: "Em execução", badgeClass: "demo-badge demo-badge--ok" };
+    case "awaiting_approval":
+      return {
+        label: "Aguarda aprovação",
+        badgeClass: "demo-badge demo-badge--warn",
+      };
+    case "degraded":
+      return {
+        label: "Pausado / Cota",
+        badgeClass: "demo-badge demo-badge--danger",
+      };
+    case "idle":
+      return { label: "Ocioso", badgeClass: "demo-badge demo-badge--info" };
+  }
+}
+
+function getBudgetBadgeClass(level: BudgetAlertLevel): string {
+  switch (level) {
+    case "critical_100":
+      return "demo-badge demo-badge--danger";
+    case "warning_80":
+      return "demo-badge demo-badge--warn";
+    case "healthy":
+      return "demo-badge demo-badge--ok";
+  }
+}
+
+function getProgressFillClass(level: BudgetAlertLevel): string {
+  switch (level) {
+    case "critical_100":
+      return "progress-fill progress-fill--danger";
+    case "warning_80":
+      return "progress-fill progress-fill--warn";
+    case "healthy":
+      return "progress-fill";
+  }
+}
+
+export function BuildingFloorMap({
+  floors,
+  selectedFloor,
+  filteredAgents,
+  isProvisioning,
+  agentQuery,
+  onSelectFloor,
+  onChangeAgentQuery,
+}: BuildingFloorMapProps) {
+  return (
+    <section className="panel-card" aria-labelledby="building-section-heading">
+      <div className="panel-header">
+        <div>
+          <h2 id="building-section-heading">
+            Edifício Virtual &amp; Departamentos Contratados (Modo 2D Acessível)
+          </h2>
+          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
+            Cada andar representa um módulo contratado pela organização. Selecione um andar pelo
+            teclado ou clique para inspecionar suas estações de agentes.
+          </p>
+        </div>
+        {isProvisioning ? (
+          <span className="demo-badge demo-badge--warn">Edifício em construção (PROVISIONING)</span>
+        ) : (
+          <span className="demo-badge demo-badge--ok">
+            Planta sincronizada ({floors.length} andares)
+          </span>
+        )}
+      </div>
+
+      <div className="building-layout">
+        <div
+          className="building-stack"
+          role="group"
+          aria-label="Corte vertical de andares do edifício da organização"
+        >
+          <div className="building-roof">Topo do Edifício · Gateway &amp; Isolamento do Tenant</div>
+
+          {floors.map((floor) => {
+            const isSelected = selectedFloor?.id === floor.id;
+            return (
+              <button
+                key={floor.id}
+                type="button"
+                className="floor-button"
+                aria-pressed={isSelected}
+                aria-label={`Andar ${floor.floorNumber}: ${floor.name}, ${floor.agents.length} agentes, orçamento em ${floor.budgetStatus.percentage}%`}
+                onClick={() => {
+                  onSelectFloor(floor.id);
+                }}
+              >
+                <div className="floor-button__top">
+                  <strong>
+                    {floor.floorNumber}º Andar · {floor.name}
+                  </strong>
+                  <span className={getBudgetBadgeClass(floor.budgetStatus.alertLevel)}>
+                    {floor.budgetStatus.percentage}% cota
+                  </span>
+                </div>
+
+                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
+                  Módulo <code>{floor.moduleCode}</code> · {floor.agents.length}{" "}
+                  {floor.agents.length === 1 ? "agente" : "agentes"} ({floor.executingAgentsCount}{" "}
+                  em execução)
+                </div>
+
+                <div className="floor-windows" aria-hidden="true">
+                  {floor.agents.map((agent) => (
+                    <span key={agent.id} className="window-pill">
+                      [{agent.workstationCode}] {agent.name}
+                    </span>
+                  ))}
+                </div>
+              </button>
+            );
+          })}
+        </div>
+
+        <div className="panel-card" style={{ background: "var(--bg-elevated)" }}>
+          {selectedFloor ? (
+            <>
+              <div className="panel-header">
+                <div>
+                  <h3 id="selected-floor-heading">
+                    {selectedFloor.floorNumber}º Andar — {selectedFloor.name}
+                  </h3>
+                  <p
+                    style={{
+                      margin: "0.25rem 0 0",
+                      fontSize: "0.86rem",
+                      color: "var(--text-secondary)",
+                    }}
+                  >
+                    {selectedFloor.summary}
+                  </p>
+                </div>
+                <span className={getBudgetBadgeClass(selectedFloor.budgetStatus.alertLevel)}>
+                  {selectedFloor.budgetStatus.alertLabel}
+                </span>
+              </div>
+
+              <div
+                style={{
+                  display: "grid",
+                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
+                  gap: "0.85rem",
+                  marginBottom: "1rem",
+                }}
+              >
+                <div>
+                  <div
+                    style={{
+                      display: "flex",
+                      justifyContent: "space-between",
+                      fontSize: "0.8rem",
+                      marginBottom: "0.25rem",
+                    }}
+                  >
+                    <span>Orçamento mensal do andar</span>
+                    <strong>
+                      R$ {selectedFloor.monthlySpentBrl} / R$ {selectedFloor.monthlyBudgetBrl} (
+                      {selectedFloor.budgetStatus.percentage}%)
+                    </strong>
+                  </div>
+                  <div className="progress-track" aria-hidden="true">
+                    <div
+                      className={getProgressFillClass(selectedFloor.budgetStatus.alertLevel)}
+                      style={{
+                        width: `${Math.min(100, selectedFloor.budgetStatus.percentage)}%`,
+                      }}
+                    />
+                  </div>
+                </div>
+
+                <div className="control-group">
+                  <label htmlFor="floor-agent-filter">Filtrar agentes neste andar</label>
+                  <input
+                    id="floor-agent-filter"
+                    type="search"
+                    className="control-input"
+                    placeholder="Nome, código ou tarefa..."
+                    value={agentQuery}
+                    onChange={(e) => {
+                      onChangeAgentQuery(e.target.value);
+                    }}
+                  />
+                </div>
+              </div>
+
+              {filteredAgents.length === 0 ? (
+                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
+                  Nenhum agente corresponde ao filtro informado neste andar.
+                </p>
+              ) : (
+                <div
+                  className="agent-grid"
+                  role="list"
+                  aria-label={`Estações de trabalho do ${selectedFloor.floorNumber}º andar`}
+                >
+                  {filteredAgents.map((agent) => {
+                    const statusMeta = getAgentStatusLabel(agent.status);
+                    const tokenPct =
+                      agent.tokensLimitMonth === 0
+                        ? 0
+                        : Math.round((agent.tokensUsedMonth / agent.tokensLimitMonth) * 100);
+                    return (
+                      <article key={agent.id} role="listitem" className="agent-card">
+                        <div
+                          style={{
+                            display: "flex",
+                            justifyContent: "space-between",
+                            alignItems: "flex-start",
+                            gap: "0.5rem",
+                          }}
+                        >
+                          <div>
+                            <strong>{agent.name}</strong>
+                            <div
+                              style={{
+                                fontSize: "0.78rem",
+                                color: "var(--text-secondary)",
+                              }}
+                            >
+                              {agent.roleTitle} · Sala <code>{agent.workstationCode}</code>
+                            </div>
+                          </div>
+                          <span className={statusMeta.badgeClass}>{statusMeta.label}</span>
+                        </div>
+
+                        <p
+                          style={{
+                            margin: "0.25rem 0",
+                            fontSize: "0.84rem",
+                            color: "var(--text-primary)",
+                          }}
+                        >
+                          {agent.currentTaskSummary}
+                        </p>
+
+                        <div
+                          style={{
+                            fontSize: "0.76rem",
+                            color: "var(--text-muted)",
+                            display: "flex",
+                            justifyContent: "space-between",
+                          }}
+                        >
+                          <span>Modelo: {agent.modelName}</span>
+                          <span>Tokens: {tokenPct}% da cota</span>
+                        </div>
+                      </article>
+                    );
+                  })}
+                </div>
+              )}
+            </>
+          ) : (
+            <p>Selecione um andar para visualizar os agentes.</p>
+          )}
+        </div>
+      </div>
+    </section>
+  );
+}
diff --git a/apps/web/app/components/DashboardClientShell.tsx b/apps/web/app/components/DashboardClientShell.tsx
new file mode 100644
index 0000000..e783558
--- /dev/null
+++ b/apps/web/app/components/DashboardClientShell.tsx
@@ -0,0 +1,371 @@
+"use client";
+
+import { useState } from "react";
+import { deriveDashboardViewModel, listMockOrganizations } from "../../lib/mock-selectors.ts";
+import type { DemoStateVariant } from "../../lib/mock-types.ts";
+import { BuildingFloorMap } from "./BuildingFloorMap.tsx";
+import { OperationsPanels, type SimulatedApprovalDecision } from "./OperationsPanels.tsx";
+
+type NavigationSection = "overview" | "building" | "operations";
+
+export function DashboardClientShell() {
+  const organizations = listMockOrganizations();
+  const defaultOrgSlug = organizations[0]?.slug ?? "aurora-industrial";
+
+  const [orgSlug, setOrgSlug] = useState<string>(defaultOrgSlug);
+  const [variant, setVariant] = useState<DemoStateVariant>("ready");
+  const [selectedFloorId, setSelectedFloorId] = useState<string | undefined>(undefined);
+  const [agentQuery, setAgentQuery] = useState<string>("");
+  const [activeSection, setActiveSection] = useState<NavigationSection>("overview");
+  const [decisions, setDecisions] = useState<readonly SimulatedApprovalDecision[]>([]);
+
+  const viewModel = deriveDashboardViewModel({
+    orgSlug,
+    variant,
+    ...(selectedFloorId !== undefined ? { selectedFloorId } : {}),
+    ...(agentQuery ? { agentQuery } : {}),
+  });
+
+  function handleSelectOrg(nextSlug: string): void {
+    setOrgSlug(nextSlug);
+    setSelectedFloorId(undefined);
+    setAgentQuery("");
+    setDecisions([]);
+  }
+
+  function handleDecideApproval(approvalId: string, decision: "approved" | "rejected"): void {
+    setDecisions((prev) => [
+      ...prev.filter((item) => item.approvalId !== approvalId),
+      { approvalId, decision },
+    ]);
+  }
+
+  return (
+    <div>
+      <a href="#main-content" className="skip-link">
+        Pular para o conteúdo principal
+      </a>
+
+      <aside
+        className="demo-banner"
+        aria-label="Aviso de ambiente de demonstração com dados mockados"
+      >
+        <div>
+          <strong>MODO DEMONSTRAÇÃO (MOCK LOCAL)</strong> — {viewModel.demoBannerText}
+        </div>
+        <span className="demo-badge demo-badge--warn">
+          Sem rede · Sem autenticação real · LOC-WEB-001
+        </span>
+      </aside>
+
+      <header className="shell-header">
+        <div className="shell-header__inner">
+          <div className="brand-block">
+            <span className="brand-title">NÚCLEOS ENTERPRISE</span>
+            <span className="brand-subtitle">
+              Shell Multi-Organização &amp; Escritório de Agentes (Fixtures TypeScript)
+            </span>
+          </div>
+
+          <div className="controls-bar">
+            <div className="control-group">
+              <label htmlFor="org-switcher-select">Organização ativa (mock)</label>
+              <select
+                id="org-switcher-select"
+                className="control-select"
+                value={viewModel.organization.slug}
+                onChange={(e) => {
+                  handleSelectOrg(e.target.value);
+                }}
+              >
+                {organizations.map((org) => (
+                  <option key={org.id} value={org.slug}>
+                    {org.displayName} ({org.tenantState} · {org.activeRole})
+                  </option>
+                ))}
+              </select>
+            </div>
+
+            <div className="control-group">
+              <label htmlFor="state-variant-select">Estado determinístico da tela</label>
+              <select
+                id="state-variant-select"
+                className="control-select"
+                value={variant}
+                onChange={(e) => {
+                  setVariant(e.target.value as DemoStateVariant);
+                }}
+              >
+                <option value="ready">Normal (Dados carregados)</option>
+                <option value="loading">Carregando (Skeleton)</option>
+                <option value="empty">Vazio (Sem módulos ativos)</option>
+                <option value="error">Erro (Problem Details)</option>
+              </select>
+            </div>
+          </div>
+        </div>
+      </header>
+
+      <nav className="shell-nav" aria-label="Navegação principal da organização">
+        <ul className="shell-nav__list">
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "overview" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("overview");
+              }}
+            >
+              Visão Completa (Dashboard + Edifício)
+            </button>
+          </li>
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "building" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("building");
+              }}
+            >
+              Edifício &amp; Departamentos
+            </button>
+          </li>
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "operations" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("operations");
+              }}
+            >
+              Aprovações, Filas &amp; Orçamento
+            </button>
+          </li>
+        </ul>
+      </nav>
+
+      <main id="main-content" className="shell-main">
+        <section className="org-hero" aria-labelledby="active-org-heading">
+          <div>
+            <div className="org-meta-row">
+              <span className="demo-badge demo-badge--info">
+                Tenant: {viewModel.organization.slug}
+              </span>
+              <span
+                className={
+                  viewModel.organization.isProvisioning
+                    ? "demo-badge demo-badge--warn"
+                    : "demo-badge demo-badge--ok"
+                }
+              >
+                Estado: {viewModel.organization.tenantState}
+              </span>
+              <span className="demo-badge demo-badge--info">
+                Papel simulado: {viewModel.organization.activeRole}
+              </span>
+            </div>
+            <h1 id="active-org-heading">
+              {viewModel.organization.displayName} — Painel Operacional
+            </h1>
+            <div className="org-meta-row">
+              <span>{viewModel.organization.legalName}</span>
+              <span>·</span>
+              <span>Plano: {viewModel.organization.planName}</span>
+              <span>·</span>
+              <span>Sessão mockada: {viewModel.organization.activeUserLabel}</span>
+            </div>
+          </div>
+
+          <div
+            style={{
+              fontSize: "0.8rem",
+              color: "var(--text-secondary)",
+              textAlign: "right",
+            }}
+          >
+            <div>Origem: Fixtures locais tipadas</div>
+            <div>{viewModel.organization.lastSyncLabel}</div>
+          </div>
+        </section>
+
+        {viewModel.organization.securityBanner && viewModel.variant === "ready" ? (
+          <section className="security-banner" aria-label="Alerta recente de segurança do tenant">
+            <strong>Segurança do Tenant:</strong> {viewModel.organization.securityBanner}
+          </section>
+        ) : null}
+
+        {viewModel.variant === "loading" ? (
+          <section
+            className="state-box"
+            role="status"
+            aria-live="polite"
+            aria-labelledby="loading-state-heading"
+          >
+            <h2 id="loading-state-heading">
+              Sincronizando departamentos e agentes (Simulação de carregamento)
+            </h2>
+            <p style={{ color: "var(--text-secondary)" }}>
+              Aguardando leitura agregada das fixtures de{" "}
+              <strong>{viewModel.organization.displayName}</strong>. Nenhum dado parcial ou de outra
+              organização é exibido durante a transição.
+            </p>
+            <button
+              type="button"
+              className="btn btn--secondary"
+              onClick={() => {
+                setVariant("ready");
+              }}
+            >
+              Concluir carregamento simulado
+            </button>
+          </section>
+        ) : null}
+
+        {viewModel.variant === "empty" ? (
+          <section className="state-box" aria-labelledby="empty-state-heading">
+            <h2 id="empty-state-heading">Nenhum departamento ativo para exibir</h2>
+            <p style={{ color: "var(--text-secondary)" }}>{viewModel.emptyStateMessage}</p>
+            <button
+              type="button"
+              className="btn btn--secondary"
+              onClick={() => {
+                setVariant("ready");
+              }}
+            >
+              Restaurar fixtures povoadas (Normal)
+            </button>
+          </section>
+        ) : null}
+
+        {viewModel.variant === "error" && viewModel.errorDetails ? (
+          <section
+            className="state-box state-box--error"
+            role="alert"
+            aria-labelledby="error-state-heading"
+          >
+            <div className="org-meta-row" style={{ marginBottom: "0.5rem" }}>
+              <span className="demo-badge demo-badge--danger">
+                HTTP {viewModel.errorDetails.httpStatus}
+              </span>
+              <code>{viewModel.errorDetails.code}</code>
+            </div>
+            <h2 id="error-state-heading">{viewModel.errorDetails.title}</h2>
+            <p style={{ color: "var(--text-primary)" }}>{viewModel.errorDetails.userMessage}</p>
+            <p
+              style={{
+                fontSize: "0.84rem",
+                color: "var(--text-secondary)",
+              }}
+            >
+              Código de correlação para suporte: <code>{viewModel.errorDetails.correlationId}</code>{" "}
+              (detalhes internos ocultados por segurança conforme diretriz de WEB-002).
+            </p>
+            <button
+              type="button"
+              className="btn btn--secondary"
+              onClick={() => {
+                setVariant("ready");
+              }}
+            >
+              Tentar novamente (Voltar ao estado Normal)
+            </button>
+          </section>
+        ) : null}
+
+        {viewModel.variant === "ready" ? (
+          <>
+            <section aria-labelledby="metrics-summary-heading">
+              <h2
+                id="metrics-summary-heading"
+                style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
+              >
+                Indicadores Operacionais da Organização
+              </h2>
+              <div className="kpi-grid">
+                <div className="kpi-card">
+                  <span className="kpi-card__label">Andares / Departamentos</span>
+                  <span className="kpi-card__value">{viewModel.metrics.totalFloors}</span>
+                  <span className="kpi-card__detail">Módulos contratados no edifício</span>
+                </div>
+
+                <div className="kpi-card">
+                  <span className="kpi-card__label">Agentes de IA</span>
+                  <span className="kpi-card__value">
+                    {viewModel.metrics.executingAgents} / {viewModel.metrics.totalAgents}
+                  </span>
+                  <span className="kpi-card__detail">
+                    Em execução agora ({viewModel.metrics.awaitingApprovalAgents} aguardando humano)
+                  </span>
+                </div>
+
+                <div className="kpi-card">
+                  <span className="kpi-card__label">Tarefas Ativas &amp; Fila</span>
+                  <span className="kpi-card__value">{viewModel.metrics.activeTasksCount}</span>
+                  <span className="kpi-card__detail">Jobs em andamento ou aguardando</span>
+                </div>
+
+                <div className="kpi-card">
+                  <span className="kpi-card__label">Aprovações Pendentes</span>
+                  <span className="kpi-card__value">{viewModel.metrics.pendingApprovalsCount}</span>
+                  <span className="kpi-card__detail">Requerem decisão humana (HITL)</span>
+                </div>
+
+                <div className="kpi-card">
+                  <span className="kpi-card__label">Orçamento Mensal de IA</span>
+                  <span className="kpi-card__value">
+                    {viewModel.metrics.totalBudget.percentage}%
+                  </span>
+                  <span className="kpi-card__detail">
+                    R$ {viewModel.metrics.totalBudget.spentBrl} / R${" "}
+                    {viewModel.metrics.totalBudget.limitBrl} (
+                    {viewModel.metrics.budgetAlertFloorsCount} andar(es) em alerta)
+                  </span>
+                </div>
+              </div>
+            </section>
+
+            {activeSection === "overview" || activeSection === "building" ? (
+              <BuildingFloorMap
+                floors={viewModel.floors}
+                selectedFloor={viewModel.selectedFloor}
+                filteredAgents={viewModel.filteredAgents}
+                isProvisioning={viewModel.organization.isProvisioning}
+                agentQuery={agentQuery}
+                onSelectFloor={(floorId) => {
+                  setSelectedFloorId(floorId);
+                }}
+                onChangeAgentQuery={(q) => {
+                  setAgentQuery(q);
+                }}
+              />
+            ) : null}
+
+            {activeSection === "overview" || activeSection === "operations" ? (
+              <OperationsPanels
+                approvals={viewModel.approvals}
+                tasks={viewModel.tasks}
+                floors={viewModel.floors}
+                recentActivity={viewModel.recentActivity}
+                canDecideApprovals={viewModel.organization.canDecideApprovals}
+                activeRoleLabel={viewModel.organization.activeRole}
+                decisions={decisions}
+                onDecideApproval={handleDecideApproval}
+              />
+            ) : null}
+          </>
+        ) : null}
+      </main>
+
+      <footer className="shell-footer">
+        <strong>NÚCLEOS Enterprise — Fundação Visual Mockada (LOC-WEB-001)</strong>
+        {" · "}Esta entrega utiliza exclusivamente fixtures TypeScript locais para validar
+        navegação, acessibilidade e hierarquia visual. Os tickets canônicos <code>WEB-001</code>,{" "}
+        <code>WEB-003</code> e <code>WEB-005</code> permanecem abertos aguardando integração com o
+        backend.
+      </footer>
+    </div>
+  );
+}
diff --git a/apps/web/app/components/OperationsPanels.tsx b/apps/web/app/components/OperationsPanels.tsx
new file mode 100644
index 0000000..2b8fffa
--- /dev/null
+++ b/apps/web/app/components/OperationsPanels.tsx
@@ -0,0 +1,364 @@
+"use client";
+
+import type {
+  ApprovalRiskLevel,
+  FloorPresentation,
+  MockApprovalItem,
+  MockSecurityActivityItem,
+  MockTaskItem,
+  SecurityEventSeverity,
+  TaskStatus,
+} from "../../lib/mock-types.ts";
+
+export interface SimulatedApprovalDecision {
+  readonly approvalId: string;
+  readonly decision: "approved" | "rejected";
+}
+
+export interface OperationsPanelsProps {
+  readonly approvals: readonly MockApprovalItem[];
+  readonly tasks: readonly MockTaskItem[];
+  readonly floors: readonly FloorPresentation[];
+  readonly recentActivity: readonly MockSecurityActivityItem[];
+  readonly canDecideApprovals: boolean;
+  readonly activeRoleLabel: string;
+  readonly decisions: readonly SimulatedApprovalDecision[];
+  readonly onDecideApproval: (approvalId: string, decision: "approved" | "rejected") => void;
+}
+
+function getRiskBadge(risk: ApprovalRiskLevel): {
+  readonly label: string;
+  readonly className: string;
+} {
+  switch (risk) {
+    case "high":
+      return {
+        label: "Risco Alto",
+        className: "demo-badge demo-badge--danger",
+      };
+    case "medium":
+      return {
+        label: "Risco Médio",
+        className: "demo-badge demo-badge--warn",
+      };
+    case "low":
+      return { label: "Risco Baixo", className: "demo-badge demo-badge--ok" };
+  }
+}
+
+function getTaskBadge(status: TaskStatus): {
+  readonly label: string;
+  readonly className: string;
+} {
+  switch (status) {
+    case "running":
+      return { label: "Em execução", className: "demo-badge demo-badge--ok" };
+    case "awaiting_human":
+      return {
+        label: "Aguarda humano",
+        className: "demo-badge demo-badge--warn",
+      };
+    case "queued":
+      return { label: "Na fila", className: "demo-badge demo-badge--info" };
+    case "completed":
+      return { label: "Concluída", className: "demo-badge demo-badge--ok" };
+    case "failed":
+      return { label: "Falhou", className: "demo-badge demo-badge--danger" };
+  }
+}
+
+function getSeverityBadge(severity: SecurityEventSeverity): {
+  readonly label: string;
+  readonly className: string;
+} {
+  switch (severity) {
+    case "high":
+      return { label: "Crítico", className: "demo-badge demo-badge--danger" };
+    case "warning":
+      return { label: "Alerta", className: "demo-badge demo-badge--warn" };
+    case "info":
+      return { label: "Info", className: "demo-badge demo-badge--info" };
+  }
+}
+
+export function OperationsPanels({
+  approvals,
+  tasks,
+  floors,
+  recentActivity,
+  canDecideApprovals,
+  activeRoleLabel,
+  decisions,
+  onDecideApproval,
+}: OperationsPanelsProps) {
+  return (
+    <div className="two-col-grid">
+      <section className="panel-card" aria-labelledby="approvals-panel-heading">
+        <div className="panel-header">
+          <div>
+            <h2 id="approvals-panel-heading">Aprovações Humanas Pendentes (HITL)</h2>
+            <p
+              style={{
+                margin: "0.2rem 0 0",
+                fontSize: "0.84rem",
+                color: "var(--text-secondary)",
+              }}
+            >
+              Resumo validado e hash da ação antes de liberar execução.
+            </p>
+          </div>
+          <span className="demo-badge demo-badge--warn">{approvals.length} pendente(s)</span>
+        </div>
+
+        <ul className="item-list">
+          {approvals.map((item) => {
+            const riskMeta = getRiskBadge(item.riskLevel);
+            const simulated = decisions.find((entry) => entry.approvalId === item.id);
+
+            return (
+              <li key={item.id} className="item-card">
+                <div
+                  style={{
+                    display: "flex",
+                    justifyContent: "space-between",
+                    alignItems: "flex-start",
+                    gap: "0.5rem",
+                  }}
+                >
+                  <strong>{item.title}</strong>
+                  <span className={riskMeta.className}>{riskMeta.label}</span>
+                </div>
+
+                <div
+                  style={{
+                    fontSize: "0.8rem",
+                    color: "var(--text-secondary)",
+                  }}
+                >
+                  {item.departmentName} · Agente: <strong>{item.agentName}</strong> ·{" "}
+                  {item.expiresInLabel}
+                </div>
+
+                <p style={{ margin: "0.2rem 0", fontSize: "0.86rem" }}>{item.serverSummary}</p>
+
+                <div className="code-preview">
+                  <div>
+                    Hash da ação: <strong>{item.actionHash}</strong>
+                  </div>
+                  <div>Argumentos: {item.argumentsPreview}</div>
+                </div>
+
+                {simulated ? (
+                  <div
+                    role="status"
+                    className={
+                      simulated.decision === "approved"
+                        ? "demo-badge demo-badge--ok"
+                        : "demo-badge demo-badge--danger"
+                    }
+                  >
+                    Decisão simulada localmente:{" "}
+                    {simulated.decision === "approved"
+                      ? "APROVADA (sem efeito de rede)"
+                      : "REJEITADA (sem efeito de rede)"}
+                  </div>
+                ) : canDecideApprovals ? (
+                  <div className="action-row">
+                    <button
+                      type="button"
+                      className="btn btn--approve"
+                      aria-label={`Simular aprovação para ${item.title}`}
+                      onClick={() => {
+                        onDecideApproval(item.id, "approved");
+                      }}
+                    >
+                      Simular Aprovação
+                    </button>
+                    <button
+                      type="button"
+                      className="btn btn--reject"
+                      aria-label={`Simular rejeição para ${item.title}`}
+                      onClick={() => {
+                        onDecideApproval(item.id, "rejected");
+                      }}
+                    >
+                      Simular Rejeição
+                    </button>
+                  </div>
+                ) : (
+                  <div className="demo-badge demo-badge--info" style={{ alignSelf: "flex-start" }}>
+                    Somente leitura: papel atual ({activeRoleLabel}) não possui{" "}
+                    {item.requiredPermission}
+                  </div>
+                )}
+              </li>
+            );
+          })}
+        </ul>
+      </section>
+
+      <section className="panel-card" aria-labelledby="tasks-panel-heading">
+        <div className="panel-header">
+          <div>
+            <h2 id="tasks-panel-heading">Tarefas &amp; Fila de Execução</h2>
+            <p
+              style={{
+                margin: "0.2rem 0 0",
+                fontSize: "0.84rem",
+                color: "var(--text-secondary)",
+              }}
+            >
+              Jobs acompanhados pelo Dispatcher e estado atual por agente.
+            </p>
+          </div>
+          <span className="demo-badge demo-badge--info">{tasks.length} registrada(s)</span>
+        </div>
+
+        <ul className="item-list">
+          {tasks.map((task) => {
+            const statusMeta = getTaskBadge(task.status);
+            return (
+              <li key={task.id} className="item-card">
+                <div
+                  style={{
+                    display: "flex",
+                    justifyContent: "space-between",
+                    alignItems: "flex-start",
+                    gap: "0.5rem",
+                  }}
+                >
+                  <div>
+                    <code>{task.code}</code> · <strong>{task.title}</strong>
+                  </div>
+                  <span className={statusMeta.className}>{statusMeta.label}</span>
+                </div>
+                <div
+                  style={{
+                    fontSize: "0.8rem",
+                    color: "var(--text-secondary)",
+                  }}
+                >
+                  {task.departmentName} · {task.agentName} · Iniciado {task.startedAtLabel} (
+                  {task.durationLabel})
+                </div>
+              </li>
+            );
+          })}
+        </ul>
+      </section>
+
+      <section className="panel-card" aria-labelledby="budget-panel-heading">
+        <div className="panel-header">
+          <div>
+            <h2 id="budget-panel-heading">Consumo de IA vs. Orçamento por Departamento</h2>
+            <p
+              style={{
+                margin: "0.2rem 0 0",
+                fontSize: "0.84rem",
+                color: "var(--text-secondary)",
+              }}
+            >
+              Limiares automáticos de alerta em 80% e contenção em 100%.
+            </p>
+          </div>
+        </div>
+
+        <ul className="item-list">
+          {floors.map((floor) => (
+            <li key={floor.id} className="item-card">
+              <div
+                style={{
+                  display: "flex",
+                  justifyContent: "space-between",
+                  alignItems: "center",
+                  gap: "0.5rem",
+                }}
+              >
+                <strong>
+                  {floor.floorNumber}º Andar · {floor.name}
+                </strong>
+                <span
+                  className={
+                    floor.budgetStatus.alertLevel === "critical_100"
+                      ? "demo-badge demo-badge--danger"
+                      : floor.budgetStatus.alertLevel === "warning_80"
+                        ? "demo-badge demo-badge--warn"
+                        : "demo-badge demo-badge--ok"
+                  }
+                >
+                  {floor.budgetStatus.percentage}% — {floor.budgetStatus.alertLabel}
+                </span>
+              </div>
+              <div
+                style={{
+                  fontSize: "0.82rem",
+                  color: "var(--text-secondary)",
+                }}
+              >
+                Gasto: R$ {floor.monthlySpentBrl} de R$ {floor.monthlyBudgetBrl} · Tokens:{" "}
+                {floor.tokensUsedMonth.toLocaleString("pt-BR")} /{" "}
+                {floor.tokensLimitMonth.toLocaleString("pt-BR")}
+              </div>
+            </li>
+          ))}
+        </ul>
+      </section>
+
+      <section className="panel-card" aria-labelledby="activity-panel-heading">
+        <div className="panel-header">
+          <div>
+            <h2 id="activity-panel-heading">Atividade Recente &amp; Eventos de Segurança</h2>
+            <p
+              style={{
+                margin: "0.2rem 0 0",
+                fontSize: "0.84rem",
+                color: "var(--text-secondary)",
+              }}
+            >
+              Trilha de auditoria isolada do tenant com código de correlação.
+            </p>
+          </div>
+        </div>
+
+        <ul className="item-list">
+          {recentActivity.map((event) => {
+            const sev = getSeverityBadge(event.severity);
+            return (
+              <li key={event.id} className="item-card">
+                <div
+                  style={{
+                    display: "flex",
+                    justifyContent: "space-between",
+                    alignItems: "center",
+                    gap: "0.5rem",
+                  }}
+                >
+                  <code>{event.eventCode}</code>
+                  <span className={sev.className}>{sev.label}</span>
+                </div>
+                <p style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>{event.summary}</p>
+                <div
+                  style={{
+                    fontSize: "0.78rem",
+                    color: "var(--text-muted)",
+                    display: "flex",
+                    justifyContent: "space-between",
+                    flexWrap: "wrap",
+                    gap: "0.5rem",
+                  }}
+                >
+                  <span>
+                    Origem: {event.actorLabel} ({event.timestampLabel})
+                  </span>
+                  <span>
+                    Correlação: <code>{event.correlationId}</code>
+                  </span>
+                </div>
+              </li>
+            );
+          })}
+        </ul>
+      </section>
+    </div>
+  );
+}
diff --git a/apps/web/app/dashboard-mock.test.ts b/apps/web/app/dashboard-mock.test.ts
new file mode 100644
index 0000000..e3ac782
--- /dev/null
+++ b/apps/web/app/dashboard-mock.test.ts
@@ -0,0 +1,108 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import {
+  computeBudgetStatus,
+  deriveDashboardViewModel,
+  getMockOrganizationBySlug,
+  listMockOrganizations,
+  roleCanDecideApprovals,
+} from "../lib/mock-selectors.ts";
+
+describe("LOC-WEB-001 — Modelo e transformações do frontend mockado", () => {
+  test("WEB-MOCK-AC-01: expõe organizações mockadas e banner explícito de demonstração", () => {
+    const orgs = listMockOrganizations();
+    assert.equal(orgs.length, 2);
+    assert.equal(orgs[0]?.slug, "aurora-industrial");
+    assert.equal(orgs[1]?.slug, "vereda-logistica");
+
+    const vm = deriveDashboardViewModel({ orgSlug: "aurora-industrial" });
+    assert.equal(vm.isDemoEnvironment, true);
+    assert.match(vm.demoBannerText, /DEMONSTRAÇÃO/i);
+    assert.equal(vm.organization.displayName, "Aurora Industrial");
+    assert.equal(vm.organization.tenantState, "ACTIVE");
+    assert.equal(vm.organization.canDecideApprovals, true);
+  });
+
+  test("WEB-MOCK-AC-02: calcula métricas, filas, aprovações e alertas de orçamento (80% e 100%)", () => {
+    assert.equal(computeBudgetStatus(500, 1000).alertLevel, "healthy");
+    assert.equal(computeBudgetStatus(800, 1000).alertLevel, "warning_80");
+    assert.equal(computeBudgetStatus(1000, 1000).alertLevel, "critical_100");
+    assert.equal(computeBudgetStatus(0, 0).percentage, 0);
+
+    const vm = deriveDashboardViewModel({
+      orgSlug: "aurora-industrial",
+      variant: "ready",
+    });
+
+    assert.equal(vm.metrics.totalFloors, 4);
+    assert.equal(vm.metrics.totalAgents, 7);
+    assert.equal(vm.metrics.executingAgents, 3);
+    assert.equal(vm.metrics.awaitingApprovalAgents, 2);
+    assert.equal(vm.metrics.activeTasksCount, 4);
+    assert.equal(vm.metrics.pendingApprovalsCount, 2);
+    assert.equal(vm.metrics.budgetAlertFloorsCount, 2);
+    assert.equal(vm.metrics.totalBudget.spentBrl, 11000);
+    assert.equal(vm.metrics.totalBudget.limitBrl, 15000);
+    assert.equal(vm.metrics.totalBudget.percentage, 73);
+  });
+
+  test("WEB-MOCK-AC-03: ordena andares do topo ao térreo e filtra agentes por andar e busca", () => {
+    const vm = deriveDashboardViewModel({ orgSlug: "aurora-industrial" });
+    assert.deepEqual(
+      vm.floors.map((f) => f.floorNumber),
+      [4, 3, 2, 1],
+    );
+    assert.equal(vm.selectedFloor?.id, "floor-fin-04");
+    assert.equal(vm.filteredAgents.length, 2);
+
+    const opsVm = deriveDashboardViewModel({
+      orgSlug: "aurora-industrial",
+      selectedFloorId: "floor-ops-02",
+      agentQuery: "roteirização",
+    });
+    assert.equal(opsVm.selectedFloor?.floorNumber, 2);
+    assert.equal(opsVm.filteredAgents.length, 1);
+    assert.equal(opsVm.filteredAgents[0]?.code, "OPS-logistica");
+  });
+
+  test("WEB-MOCK-AC-04: estados determinísticos ready, loading, empty e error são representáveis", () => {
+    const loadingVm = deriveDashboardViewModel({
+      orgSlug: "aurora-industrial",
+      variant: "loading",
+    });
+    assert.equal(loadingVm.variant, "loading");
+    assert.equal(loadingVm.floors.length, 0);
+    assert.equal(loadingVm.tasks.length, 0);
+    assert.equal(loadingVm.errorDetails, null);
+
+    const emptyVm = deriveDashboardViewModel({
+      orgSlug: "aurora-industrial",
+      variant: "empty",
+    });
+    assert.equal(emptyVm.variant, "empty");
+    assert.equal(emptyVm.floors.length, 0);
+    assert.equal(emptyVm.metrics.totalAgents, 0);
+    assert.ok(emptyVm.emptyStateMessage && emptyVm.emptyStateMessage.length > 10);
+
+    const errorVm = deriveDashboardViewModel({
+      orgSlug: "aurora-industrial",
+      variant: "error",
+    });
+    assert.equal(errorVm.variant, "error");
+    assert.equal(errorVm.floors.length, 0);
+    assert.ok(errorVm.errorDetails);
+    assert.equal(errorVm.errorDetails.code, "TENANT_RUNTIME_UNAVAILABLE");
+    assert.match(errorVm.errorDetails.correlationId, /^corr-demo-/);
+  });
+
+  test("respeita papel viewer e estado PROVISIONING na organização secundária e fallback seguro", () => {
+    const veredaVm = deriveDashboardViewModel({ orgSlug: "vereda-logistica" });
+    assert.equal(veredaVm.organization.isProvisioning, true);
+    assert.equal(veredaVm.organization.canDecideApprovals, false);
+    assert.equal(roleCanDecideApprovals("viewer"), false);
+    assert.equal(roleCanDecideApprovals("org_admin"), true);
+
+    const fallbackOrg = getMockOrganizationBySlug("slug-inexistente");
+    assert.equal(fallbackOrg.slug, "aurora-industrial");
+  });
+});
diff --git a/apps/web/app/globals.css b/apps/web/app/globals.css
new file mode 100644
index 0000000..1adcbd0
--- /dev/null
+++ b/apps/web/app/globals.css
@@ -0,0 +1,534 @@
+:root {
+  --bg-canvas: #0b1020;
+  --bg-surface: #121a2f;
+  --bg-elevated: #18233f;
+  --bg-interactive: #1f2d52;
+  --border-subtle: #2a3b68;
+  --border-strong: #4762a6;
+  --text-primary: #f4f7ff;
+  --text-secondary: #c3d0f0;
+  --text-muted: #93a6d4;
+  --accent-primary: #5ea0ff;
+  --accent-focus: #ffd166;
+  --status-ok-bg: #0f3828;
+  --status-ok-text: #6ee7b7;
+  --status-ok-border: #10b981;
+  --status-warn-bg: #3f2e0e;
+  --status-warn-text: #fde68a;
+  --status-warn-border: #f59e0b;
+  --status-danger-bg: #451520;
+  --status-danger-text: #fda4af;
+  --status-danger-border: #f43f5e;
+  --status-info-bg: #132c52;
+  --status-info-text: #93c5fd;
+  --status-info-border: #3b82f6;
+}
+
+*,
+*::before,
+*::after {
+  box-sizing: border-box;
+}
+
+html,
+body {
+  margin: 0;
+  padding: 0;
+  background-color: var(--bg-canvas);
+  color: var(--text-primary);
+  font-family:
+    system-ui,
+    -apple-system,
+    BlinkMacSystemFont,
+    "Segoe UI",
+    Roboto,
+    sans-serif;
+  line-height: 1.5;
+}
+
+.skip-link {
+  position: absolute;
+  top: -3rem;
+  left: 1rem;
+  z-index: 1000;
+  padding: 0.5rem 1rem;
+  background: var(--accent-focus);
+  color: #0b1020;
+  font-weight: 700;
+  border-radius: 0.375rem;
+  text-decoration: none;
+}
+
+.skip-link:focus {
+  top: 0.75rem;
+}
+
+button:focus-visible,
+select:focus-visible,
+input:focus-visible,
+a:focus-visible {
+  outline: 3px solid var(--accent-focus);
+  outline-offset: 2px;
+}
+
+.demo-banner {
+  background: linear-gradient(90deg, #3b2807 0%, #4b1d1d 100%);
+  border-bottom: 2px solid var(--status-warn-border);
+  color: var(--status-warn-text);
+  padding: 0.65rem 1.25rem;
+  font-size: 0.875rem;
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  justify-content: space-between;
+  gap: 0.75rem;
+}
+
+.demo-badge {
+  display: inline-flex;
+  align-items: center;
+  gap: 0.35rem;
+  padding: 0.2rem 0.6rem;
+  border-radius: 999px;
+  font-size: 0.75rem;
+  font-weight: 700;
+  text-transform: uppercase;
+  letter-spacing: 0.04em;
+}
+
+.demo-badge--warn {
+  background: var(--status-warn-bg);
+  color: var(--status-warn-text);
+  border: 1px solid var(--status-warn-border);
+}
+
+.demo-badge--ok {
+  background: var(--status-ok-bg);
+  color: var(--status-ok-text);
+  border: 1px solid var(--status-ok-border);
+}
+
+.demo-badge--danger {
+  background: var(--status-danger-bg);
+  color: var(--status-danger-text);
+  border: 1px solid var(--status-danger-border);
+}
+
+.demo-badge--info {
+  background: var(--status-info-bg);
+  color: var(--status-info-text);
+  border: 1px solid var(--status-info-border);
+}
+
+.shell-header {
+  background: var(--bg-surface);
+  border-bottom: 1px solid var(--border-subtle);
+  padding: 1rem 1.25rem;
+}
+
+.shell-header__inner {
+  max-width: 1360px;
+  margin: 0 auto;
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  justify-content: space-between;
+  gap: 1rem;
+}
+
+.brand-block {
+  display: flex;
+  flex-direction: column;
+  gap: 0.25rem;
+}
+
+.brand-title {
+  font-size: 1.15rem;
+  font-weight: 800;
+  letter-spacing: 0.04em;
+  color: var(--text-primary);
+}
+
+.brand-subtitle {
+  font-size: 0.82rem;
+  color: var(--text-secondary);
+}
+
+.controls-bar {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: flex-end;
+  gap: 0.85rem;
+}
+
+.control-group {
+  display: flex;
+  flex-direction: column;
+  gap: 0.25rem;
+}
+
+.control-group label {
+  font-size: 0.75rem;
+  font-weight: 600;
+  color: var(--text-secondary);
+}
+
+.control-select,
+.control-input {
+  background: var(--bg-elevated);
+  color: var(--text-primary);
+  border: 1px solid var(--border-strong);
+  border-radius: 0.375rem;
+  padding: 0.45rem 0.65rem;
+  font-size: 0.875rem;
+}
+
+.shell-nav {
+  background: var(--bg-elevated);
+  border-bottom: 1px solid var(--border-subtle);
+  padding: 0.5rem 1.25rem;
+}
+
+.shell-nav__list {
+  max-width: 1360px;
+  margin: 0 auto;
+  padding: 0;
+  list-style: none;
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.5rem;
+}
+
+.nav-button {
+  background: transparent;
+  color: var(--text-secondary);
+  border: 1px solid transparent;
+  border-radius: 0.375rem;
+  padding: 0.45rem 0.85rem;
+  font-size: 0.875rem;
+  font-weight: 600;
+  cursor: pointer;
+}
+
+.nav-button:hover {
+  background: var(--bg-interactive);
+  color: var(--text-primary);
+}
+
+.nav-button[aria-current="page"] {
+  background: var(--bg-interactive);
+  color: var(--text-primary);
+  border-color: var(--accent-primary);
+}
+
+.shell-main {
+  max-width: 1360px;
+  margin: 0 auto;
+  padding: 1.5rem 1.25rem 3rem;
+  display: flex;
+  flex-direction: column;
+  gap: 1.5rem;
+}
+
+.org-hero {
+  background: var(--bg-surface);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.65rem;
+  padding: 1.25rem;
+  display: flex;
+  flex-wrap: wrap;
+  justify-content: space-between;
+  align-items: flex-start;
+  gap: 1rem;
+}
+
+.org-hero h1 {
+  margin: 0 0 0.35rem;
+  font-size: 1.5rem;
+}
+
+.org-meta-row {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.5rem;
+  align-items: center;
+  font-size: 0.85rem;
+  color: var(--text-secondary);
+}
+
+.security-banner {
+  background: var(--status-warn-bg);
+  border: 1px solid var(--status-warn-border);
+  color: var(--status-warn-text);
+  border-radius: 0.5rem;
+  padding: 0.75rem 1rem;
+  font-size: 0.875rem;
+}
+
+.kpi-grid {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
+  gap: 1rem;
+}
+
+.kpi-card {
+  background: var(--bg-surface);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.6rem;
+  padding: 1rem;
+  display: flex;
+  flex-direction: column;
+  gap: 0.35rem;
+}
+
+.kpi-card__label {
+  font-size: 0.8rem;
+  color: var(--text-secondary);
+  font-weight: 600;
+}
+
+.kpi-card__value {
+  font-size: 1.65rem;
+  font-weight: 800;
+  color: var(--text-primary);
+}
+
+.kpi-card__detail {
+  font-size: 0.8rem;
+  color: var(--text-muted);
+}
+
+.building-layout {
+  display: grid;
+  grid-template-columns: minmax(300px, 420px) 1fr;
+  gap: 1.25rem;
+  align-items: start;
+}
+
+@media (max-width: 920px) {
+  .building-layout {
+    grid-template-columns: 1fr;
+  }
+}
+
+.panel-card {
+  background: var(--bg-surface);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.65rem;
+  padding: 1.25rem;
+}
+
+.panel-header {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  justify-content: space-between;
+  gap: 0.75rem;
+  margin-bottom: 1rem;
+}
+
+.panel-header h2,
+.panel-header h3 {
+  margin: 0;
+}
+
+.building-stack {
+  display: flex;
+  flex-direction: column;
+  gap: 0.6rem;
+  padding: 0.85rem;
+  background: #090e1c;
+  border: 1px solid var(--border-strong);
+  border-radius: 0.5rem;
+}
+
+.building-roof {
+  text-align: center;
+  font-size: 0.75rem;
+  font-weight: 700;
+  letter-spacing: 0.06em;
+  text-transform: uppercase;
+  color: var(--text-secondary);
+  padding: 0.4rem;
+  background: var(--bg-elevated);
+  border-radius: 0.375rem 0.375rem 0 0;
+  border-bottom: 2px solid var(--accent-primary);
+}
+
+.floor-button {
+  width: 100%;
+  text-align: left;
+  background: var(--bg-surface);
+  color: var(--text-primary);
+  border: 2px solid var(--border-subtle);
+  border-radius: 0.45rem;
+  padding: 0.8rem;
+  cursor: pointer;
+  display: flex;
+  flex-direction: column;
+  gap: 0.45rem;
+  transition: border-color 0.15s ease, background-color 0.15s ease;
+}
+
+.floor-button:hover {
+  background: var(--bg-interactive);
+  border-color: var(--accent-primary);
+}
+
+.floor-button[aria-pressed="true"] {
+  background: var(--bg-interactive);
+  border-color: var(--accent-focus);
+}
+
+.floor-button__top {
+  display: flex;
+  justify-content: space-between;
+  align-items: center;
+  gap: 0.5rem;
+}
+
+.floor-windows {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.4rem;
+}
+
+.window-pill {
+  font-size: 0.75rem;
+  padding: 0.15rem 0.5rem;
+  border-radius: 0.25rem;
+  background: var(--bg-canvas);
+  border: 1px solid var(--border-subtle);
+  color: var(--text-secondary);
+}
+
+.agent-grid {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
+  gap: 0.9rem;
+  margin-top: 1rem;
+}
+
+.agent-card {
+  background: var(--bg-elevated);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.5rem;
+  padding: 0.95rem;
+  display: flex;
+  flex-direction: column;
+  gap: 0.5rem;
+}
+
+.progress-track {
+  width: 100%;
+  height: 0.5rem;
+  background: var(--bg-canvas);
+  border-radius: 999px;
+  overflow: hidden;
+  border: 1px solid var(--border-subtle);
+}
+
+.progress-fill {
+  height: 100%;
+  background: var(--accent-primary);
+}
+
+.progress-fill--warn {
+  background: var(--status-warn-border);
+}
+
+.progress-fill--danger {
+  background: var(--status-danger-border);
+}
+
+.two-col-grid {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
+  gap: 1.25rem;
+}
+
+.item-list {
+  list-style: none;
+  padding: 0;
+  margin: 0;
+  display: flex;
+  flex-direction: column;
+  gap: 0.75rem;
+}
+
+.item-card {
+  background: var(--bg-elevated);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.5rem;
+  padding: 0.95rem;
+  display: flex;
+  flex-direction: column;
+  gap: 0.5rem;
+}
+
+.action-row {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.5rem;
+  align-items: center;
+  margin-top: 0.35rem;
+}
+
+.btn {
+  padding: 0.45rem 0.85rem;
+  border-radius: 0.375rem;
+  font-size: 0.82rem;
+  font-weight: 700;
+  cursor: pointer;
+  border: 1px solid transparent;
+}
+
+.btn--approve {
+  background: var(--status-ok-bg);
+  color: var(--status-ok-text);
+  border-color: var(--status-ok-border);
+}
+
+.btn--reject {
+  background: var(--status-danger-bg);
+  color: var(--status-danger-text);
+  border-color: var(--status-danger-border);
+}
+
+.btn--secondary {
+  background: var(--bg-interactive);
+  color: var(--text-primary);
+  border-color: var(--border-strong);
+}
+
+.code-preview {
+  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
+  font-size: 0.78rem;
+  background: var(--bg-canvas);
+  padding: 0.45rem 0.65rem;
+  border-radius: 0.35rem;
+  border: 1px solid var(--border-subtle);
+  overflow-x: auto;
+  color: var(--text-secondary);
+}
+
+.state-box {
+  background: var(--bg-surface);
+  border: 2px solid var(--border-strong);
+  border-radius: 0.65rem;
+  padding: 1.75rem;
+}
+
+.state-box--error {
+  border-color: var(--status-danger-border);
+  background: #22111b;
+}
+
+.shell-footer {
+  max-width: 1360px;
+  margin: 0 auto;
+  padding: 1.25rem;
+  border-top: 1px solid var(--border-subtle);
+  color: var(--text-muted);
+  font-size: 0.82rem;
+}
diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
index a388277..0b16378 100644
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -1,6 +1,11 @@
 import type { ReactNode } from "react";
+import "./globals.css";
 
-export const metadata = { title: "Nucleos" };
+export const metadata = {
+  title: "NÚCLEOS Enterprise — Painel Demonstrativo (Mock Local)",
+  description:
+    "Fundação navegável do frontend NÚCLEOS Enterprise com dados mockados tipados (LOC-WEB-001).",
+};
 
 export default function RootLayout({ children }: { children: ReactNode }) {
   return (
diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index 4a73280..f4309ed 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -1,3 +1,5 @@
+import { DashboardClientShell } from "./components/DashboardClientShell.tsx";
+
 export default function Home() {
-  return <main>Nucleos Enterprise</main>;
+  return <DashboardClientShell />;
 }
diff --git a/apps/web/lib/mock-fixtures.ts b/apps/web/lib/mock-fixtures.ts
new file mode 100644
index 0000000..276ee56
--- /dev/null
+++ b/apps/web/lib/mock-fixtures.ts
@@ -0,0 +1,443 @@
+import type { MockOrganizationFixture } from "./mock-types.ts";
+
+export const DEMO_ENVIRONMENT_BANNER =
+  "AMBIENTE DE DEMONSTRAÇÃO (MOCK LOCAL — LOC-WEB-001): Todos os dados exibidos vêm de fixtures TypeScript estáticas. Autenticação real, Control Plane, SSE e chamadas de rede estão desativados.";
+
+export const MOCK_ORGANIZATIONS: readonly MockOrganizationFixture[] = [
+  {
+    id: "org-aurora-01",
+    slug: "aurora-industrial",
+    displayName: "Aurora Industrial",
+    legalName: "Aurora Equipamentos Industriais S.A.",
+    planName: "Enterprise Multi-Departamento",
+    tenantState: "ACTIVE",
+    activeRole: "org_admin",
+    activeUserLabel: "Marina Costa (Admin da Organização)",
+    lastSyncLabel: "Fixture determinística · 2026-10-30 14:20 BRT",
+    securityBanner:
+      "Último evento relevante do tenant: bloqueio preventivo de conector externo não catalogado há 2h (sem exfiltração).",
+    simulatedError: {
+      code: "TENANT_RUNTIME_UNAVAILABLE",
+      httpStatus: 503,
+      title: "Falha temporária ao carregar leitura agregada da organização",
+      userMessage:
+        "Não foi possível sincronizar o estado operacional dos departamentos neste momento. Nenhuma ação pendente foi executada.",
+      correlationId: "corr-demo-9f41a8c2-001",
+      retryable: true,
+    },
+    floors: [
+      {
+        id: "floor-fin-04",
+        slug: "financas-controladoria",
+        name: "Finanças & Controladoria",
+        floorNumber: 4,
+        moduleCode: "MOD-FIN-CORE",
+        summary:
+          "Conciliação contábil, previsão de fluxo de caixa e auditoria de faturas com aprovação humana obrigatória acima da alçada.",
+        monthlyBudgetBrl: 5000,
+        monthlySpentBrl: 4250,
+        tokensUsedMonth: 4250000,
+        tokensLimitMonth: 5000000,
+        agents: [
+          {
+            id: "agt-fin-01",
+            code: "FIN-conciliador",
+            name: "Helena (Conciliação)",
+            roleTitle: "Agente de Conciliação Bancária",
+            departmentId: "floor-fin-04",
+            departmentName: "Finanças & Controladoria",
+            floorNumber: 4,
+            workstationCode: "4A-01",
+            status: "executing",
+            modelName: "claude-3-7-sonnet",
+            currentTaskSummary:
+              "Conferindo 48 lançamentos do lote bancário de outubro contra notas fiscais.",
+            tokensUsedMonth: 2300000,
+            tokensLimitMonth: 2500000,
+          },
+          {
+            id: "agt-fin-02",
+            code: "FIN-tesouraria",
+            name: "Breno (Tesouraria)",
+            roleTitle: "Agente de Programação de Pagamentos",
+            departmentId: "floor-fin-04",
+            departmentName: "Finanças & Controladoria",
+            floorNumber: 4,
+            workstationCode: "4A-02",
+            status: "awaiting_approval",
+            modelName: "gpt-4.1",
+            currentTaskSummary:
+              "Aguardando aprovação humana para liberar borderô de fornecedores críticos.",
+            tokensUsedMonth: 1950000,
+            tokensLimitMonth: 2500000,
+          },
+        ],
+      },
+      {
+        id: "floor-jur-03",
+        slug: "juridico-compliance",
+        name: "Jurídico & Privacidade LGPD",
+        floorNumber: 3,
+        moduleCode: "MOD-JUR-LGPD",
+        summary:
+          "Análise de minutas contratuais, verificação de cláusulas de proteção de dados e triagem de solicitações de titulares.",
+        monthlyBudgetBrl: 4000,
+        monthlySpentBrl: 2100,
+        tokensUsedMonth: 2100000,
+        tokensLimitMonth: 4000000,
+        agents: [
+          {
+            id: "agt-jur-01",
+            code: "JUR-contratos",
+            name: "Clara (Minutas)",
+            roleTitle: "Agente Revisor de Contratos B2B",
+            departmentId: "floor-jur-03",
+            departmentName: "Jurídico & Privacidade LGPD",
+            floorNumber: 3,
+            workstationCode: "3B-01",
+            status: "awaiting_approval",
+            modelName: "claude-3-7-sonnet",
+            currentTaskSummary:
+              "Parecer de aditivo DPA pronto; requer aceite jurídico antes de envio.",
+            tokensUsedMonth: 1400000,
+            tokensLimitMonth: 2500000,
+          },
+          {
+            id: "agt-jur-02",
+            code: "JUR-dpo",
+            name: "Davi (Governança LGPD)",
+            roleTitle: "Agente de Inventário ROPA",
+            departmentId: "floor-jur-03",
+            departmentName: "Jurídico & Privacidade LGPD",
+            floorNumber: 3,
+            workstationCode: "3B-02",
+            status: "idle",
+            modelName: "gpt-4.1-mini",
+            currentTaskSummary: "Sem jobs ativos; última revisão de retenção concluída há 35 min.",
+            tokensUsedMonth: 700000,
+            tokensLimitMonth: 1500000,
+          },
+        ],
+      },
+      {
+        id: "floor-ops-02",
+        slug: "operacoes-suprimentos",
+        name: "Operações & Suprimentos",
+        floorNumber: 2,
+        moduleCode: "MOD-OPS-SUPPLY",
+        summary:
+          "Monitoramento de estoque de segurança, cotação automatizada e acompanhamento de SLA de entregas industriais.",
+        monthlyBudgetBrl: 3500,
+        monthlySpentBrl: 3500,
+        tokensUsedMonth: 3500000,
+        tokensLimitMonth: 3500000,
+        agents: [
+          {
+            id: "agt-ops-01",
+            code: "OPS-compras",
+            name: "Ícaro (Suprimentos)",
+            roleTitle: "Agente de Ressuprimento e Cotações",
+            departmentId: "floor-ops-02",
+            departmentName: "Operações & Suprimentos",
+            floorNumber: 2,
+            workstationCode: "2C-01",
+            status: "degraded",
+            modelName: "gpt-4.1",
+            currentTaskSummary:
+              "Pausado por teto de orçamento mensal atingido (100% da cota do andar).",
+            tokensUsedMonth: 2200000,
+            tokensLimitMonth: 2200000,
+          },
+          {
+            id: "agt-ops-02",
+            code: "OPS-logistica",
+            name: "Lívia (Roteirização)",
+            roleTitle: "Agente de Auditoria de Frete",
+            departmentId: "floor-ops-02",
+            departmentName: "Operações & Suprimentos",
+            floorNumber: 2,
+            workstationCode: "2C-02",
+            status: "executing",
+            modelName: "gpt-4.1-mini",
+            currentTaskSummary:
+              "Consolidando divergências de cubagem do centro de distribuição Sul.",
+            tokensUsedMonth: 1300000,
+            tokensLimitMonth: 1300000,
+          },
+        ],
+      },
+      {
+        id: "floor-atd-01",
+        slug: "atendimento-recepcao",
+        name: "Térreo · Recepção & Triagem Digital",
+        floorNumber: 1,
+        moduleCode: "MOD-CX-FRONT",
+        summary:
+          "Porta de entrada do edifício: classifica demandas recebidas e encaminha para o departamento responsável com rastreabilidade.",
+        monthlyBudgetBrl: 2500,
+        monthlySpentBrl: 1150,
+        tokensUsedMonth: 1150000,
+        tokensLimitMonth: 2500000,
+        agents: [
+          {
+            id: "agt-atd-01",
+            code: "CX-recepcao",
+            name: "Nora (Recepção)",
+            roleTitle: "Agente de Triagem e Roteamento",
+            departmentId: "floor-atd-01",
+            departmentName: "Térreo · Recepção & Triagem Digital",
+            floorNumber: 1,
+            workstationCode: "1T-01",
+            status: "executing",
+            modelName: "gpt-4.1-mini",
+            currentTaskSummary:
+              "Classificando 12 protocolos técnicos e direcionando ao 2º e 4º andares.",
+            tokensUsedMonth: 1150000,
+            tokensLimitMonth: 2500000,
+          },
+        ],
+      },
+    ],
+    tasks: [
+      {
+        id: "tsk-101",
+        code: "JOB-2026-0891",
+        title: "Conciliação de extratos CNAB 240 — Outubro/2026",
+        departmentId: "floor-fin-04",
+        departmentName: "Finanças & Controladoria",
+        agentName: "Helena (Conciliação)",
+        status: "running",
+        startedAtLabel: "há 4 min",
+        durationLabel: "04m 12s",
+      },
+      {
+        id: "tsk-102",
+        code: "JOB-2026-0890",
+        title: "Emissão de borderô de fornecedores homologados",
+        departmentId: "floor-fin-04",
+        departmentName: "Finanças & Controladoria",
+        agentName: "Breno (Tesouraria)",
+        status: "awaiting_human",
+        startedAtLabel: "há 18 min",
+        durationLabel: "aguardando decisão",
+      },
+      {
+        id: "tsk-103",
+        code: "JOB-2026-0888",
+        title: "Revisão de cláusulas de suboperadores em aditivo DPA",
+        departmentId: "floor-jur-03",
+        departmentName: "Jurídico & Privacidade LGPD",
+        agentName: "Clara (Minutas)",
+        status: "awaiting_human",
+        startedAtLabel: "há 27 min",
+        durationLabel: "aguardando decisão",
+      },
+      {
+        id: "tsk-104",
+        code: "JOB-2026-0885",
+        title: "Auditoria de tabelas de frete rodoviário Q4",
+        departmentId: "floor-ops-02",
+        departmentName: "Operações & Suprimentos",
+        agentName: "Lívia (Roteirização)",
+        status: "queued",
+        startedAtLabel: "na fila há 2 min",
+        durationLabel: "prioridade normal",
+      },
+    ],
+    approvals: [
+      {
+        id: "apr-301",
+        actionHash: "sha256:7c9e2b4d...f102a8",
+        title: "Autorizar envio de borderô de pagamento #BR-442",
+        serverSummary:
+          "Pagamento programado de 6 notas fiscais conferidas para fornecedores industriais já homologados, totalizando R$ 48.200,00.",
+        departmentName: "Finanças & Controladoria",
+        agentName: "Breno (Tesouraria)",
+        riskLevel: "high",
+        expiresInLabel: "Expira em 45 min",
+        argumentsPreview:
+          '{"lote":"BR-442","documentos":6,"valorTotalBrl":48200,"contaOrigem":"Banco-001-Operacional"}',
+        requiredPermission: "approvals:decide",
+      },
+      {
+        id: "apr-302",
+        actionHash: "sha256:3a11e90c...88b4d1",
+        title: "Aprovar minuta revisada de DPA para parceiro logístico",
+        serverSummary:
+          "Minuta padrão com cláusula de retenção máxima de 30 dias e vedação de uso para treinamento de modelos externos.",
+        departmentName: "Jurídico & Privacidade LGPD",
+        agentName: "Clara (Minutas)",
+        riskLevel: "medium",
+        expiresInLabel: "Expira em 3h 10min",
+        argumentsPreview:
+          '{"documento":"DPA-2026-19","retencaoDias":30,"suboperadoresAutorizados":2}',
+        requiredPermission: "approvals:decide",
+      },
+    ],
+    recentActivity: [
+      {
+        id: "act-501",
+        timestampLabel: "14:15 BRT",
+        eventCode: "AIG_BUDGET_THRESHOLD_100",
+        summary:
+          "Departamento Operações & Suprimentos atingiu 100% do orçamento mensal de IA; novas execuções não prioritárias foram retidas.",
+        actorLabel: "AI Gateway (política de cota)",
+        severity: "high",
+        correlationId: "corr-aig-88210a",
+      },
+      {
+        id: "act-502",
+        timestampLabel: "13:52 BRT",
+        eventCode: "TGW_EGRESS_DENIED",
+        summary:
+          "Tentativa de chamada HTTP para domínio fora da allowlist do tenant bloqueada pelo Tool Gateway.",
+        actorLabel: "Tool Gateway (agt-ops-01)",
+        severity: "warning",
+        correlationId: "corr-tgw-77104b",
+      },
+      {
+        id: "act-503",
+        timestampLabel: "13:30 BRT",
+        eventCode: "AIG_BUDGET_THRESHOLD_80",
+        summary:
+          "Departamento Finanças & Controladoria ultrapassou 80% do orçamento mensal (85% utilizado).",
+        actorLabel: "AI Gateway (metering)",
+        severity: "warning",
+        correlationId: "corr-aig-61902c",
+      },
+      {
+        id: "act-504",
+        timestampLabel: "12:40 BRT",
+        eventCode: "RUN_APPROVAL_REQUESTED",
+        summary: "Agente Breno (Tesouraria) registrou pedido de aprovação humana durável #apr-301.",
+        actorLabel: "Tenant Runtime",
+        severity: "info",
+        correlationId: "corr-run-50411d",
+      },
+    ],
+  },
+  {
+    id: "org-vereda-02",
+    slug: "vereda-logistica",
+    displayName: "Vereda Logística",
+    legalName: "Vereda Operações Logísticas Ltda.",
+    planName: "Business · Em Provisionamento",
+    tenantState: "PROVISIONING",
+    activeRole: "viewer",
+    activeUserLabel: "Carlos Mendes (Leitor / Auditoria)",
+    lastSyncLabel: "Fixture determinística · 2026-10-30 14:18 BRT",
+    securityBanner: null,
+    simulatedError: {
+      code: "CONTROL_PLANE_TIMEOUT",
+      httpStatus: 504,
+      title: "Tempo limite ao consultar provisionamento da organização",
+      userMessage:
+        "A consulta de status do ambiente demorou mais que o esperado. Tente novamente em instantes ou informe o código de correlação ao suporte.",
+      correlationId: "corr-demo-4b19d2e0-002",
+      retryable: true,
+    },
+    floors: [
+      {
+        id: "floor-ver-02",
+        slug: "torre-controle-frete",
+        name: "Torre de Controle de Frota",
+        floorNumber: 2,
+        moduleCode: "MOD-LOG-TOWER",
+        summary:
+          "Andar em construção (PROVISIONING): preparação de agentes de rastreamento e janelas de descarga.",
+        monthlyBudgetBrl: 3000,
+        monthlySpentBrl: 450,
+        tokensUsedMonth: 450000,
+        tokensLimitMonth: 3000000,
+        agents: [
+          {
+            id: "agt-ver-01",
+            code: "LOG-janela",
+            name: "Otto (Docas)",
+            roleTitle: "Agente de Agendamento de Pátio",
+            departmentId: "floor-ver-02",
+            departmentName: "Torre de Controle de Frota",
+            floorNumber: 2,
+            workstationCode: "2A-01",
+            status: "idle",
+            modelName: "gpt-4.1-mini",
+            currentTaskSummary:
+              "Ambiente do tenant em etapa final de ativação; aguardando liberação de tráfego.",
+            tokensUsedMonth: 450000,
+            tokensLimitMonth: 3000000,
+          },
+        ],
+      },
+      {
+        id: "floor-ver-01",
+        slug: "recepcao-embarcadores",
+        name: "Térreo · Recepção de Embarcadores",
+        floorNumber: 1,
+        moduleCode: "MOD-CX-FRONT",
+        summary: "Triagem de conhecimentos de transporte (CT-e) e avisos de sinistro.",
+        monthlyBudgetBrl: 2000,
+        monthlySpentBrl: 600,
+        tokensUsedMonth: 600000,
+        tokensLimitMonth: 2000000,
+        agents: [
+          {
+            id: "agt-ver-02",
+            code: "LOG-cte",
+            name: "Sofia (Triagem CT-e)",
+            roleTitle: "Agente de Validação Documental",
+            departmentId: "floor-ver-01",
+            departmentName: "Térreo · Recepção de Embarcadores",
+            floorNumber: 1,
+            workstationCode: "1T-01",
+            status: "awaiting_approval",
+            modelName: "claude-3-7-sonnet",
+            currentTaskSummary:
+              "Divergência de CNPJ em manifesto #CT-902 aguarda validação de operador autorizado.",
+            tokensUsedMonth: 600000,
+            tokensLimitMonth: 2000000,
+          },
+        ],
+      },
+    ],
+    tasks: [
+      {
+        id: "tsk-201",
+        code: "JOB-2026-0310",
+        title: "Validação de manifesto de carga fracionada #CT-902",
+        departmentId: "floor-ver-01",
+        departmentName: "Térreo · Recepção de Embarcadores",
+        agentName: "Sofia (Triagem CT-e)",
+        status: "awaiting_human",
+        startedAtLabel: "há 11 min",
+        durationLabel: "aguardando operador",
+      },
+    ],
+    approvals: [
+      {
+        id: "apr-401",
+        actionHash: "sha256:9d04a11b...c72e19",
+        title: "Liberar reprocessamento de CT-e com ressalva fiscal",
+        serverSummary:
+          "Solicitação requer papel com permissão approvals:decide; seu papel atual (viewer) permite apenas leitura e auditoria.",
+        departmentName: "Térreo · Recepção de Embarcadores",
+        agentName: "Sofia (Triagem CT-e)",
+        riskLevel: "medium",
+        expiresInLabel: "Expira em 2h",
+        argumentsPreview: '{"cte":"902","ufOrigem":"SP","ufDestino":"PR"}',
+        requiredPermission: "approvals:decide",
+      },
+    ],
+    recentActivity: [
+      {
+        id: "act-601",
+        timestampLabel: "14:10 BRT",
+        eventCode: "PRV_STEP_NETWORK_READY",
+        summary:
+          "Rede isolada do tenant verificada; edifício em modo de pré-ativação (PROVISIONING).",
+        actorLabel: "Tenant Provisioner",
+        severity: "info",
+        correlationId: "corr-prv-11029f",
+      },
+    ],
+  },
+];
diff --git a/apps/web/lib/mock-selectors.ts b/apps/web/lib/mock-selectors.ts
new file mode 100644
index 0000000..830c4ce
--- /dev/null
+++ b/apps/web/lib/mock-selectors.ts
@@ -0,0 +1,244 @@
+import { DEMO_ENVIRONMENT_BANNER, MOCK_ORGANIZATIONS } from "./mock-fixtures.ts";
+import type {
+  BudgetConsumptionSummary,
+  DashboardMetricsSummary,
+  DashboardViewModel,
+  DemoStateVariant,
+  FloorPresentation,
+  MockAgent,
+  MockDepartmentFloor,
+  MockOrganizationFixture,
+  MockOrganizationSummary,
+  UserRole,
+} from "./mock-types.ts";
+
+export interface DeriveDashboardOptions {
+  readonly orgSlug?: string;
+  readonly variant?: DemoStateVariant;
+  readonly selectedFloorId?: string;
+  readonly agentQuery?: string;
+}
+
+export function listMockOrganizations(): readonly MockOrganizationSummary[] {
+  return MOCK_ORGANIZATIONS.map((org) => ({
+    id: org.id,
+    slug: org.slug,
+    displayName: org.displayName,
+    planName: org.planName,
+    tenantState: org.tenantState,
+    activeRole: org.activeRole,
+  }));
+}
+
+export function getMockOrganizationBySlug(slug?: string): MockOrganizationFixture {
+  const fallback = MOCK_ORGANIZATIONS[0];
+  if (!fallback) {
+    throw new Error("MOCK_ORGANIZATIONS deve conter ao menos uma organizacao.");
+  }
+  if (!slug) {
+    return fallback;
+  }
+  const matched = MOCK_ORGANIZATIONS.find((org) => org.slug === slug);
+  return matched ?? fallback;
+}
+
+export function roleCanDecideApprovals(role: UserRole): boolean {
+  return role === "org_admin" || role === "department_manager" || role === "operator";
+}
+
+export function computeBudgetStatus(spent: number, limit: number): BudgetConsumptionSummary {
+  const safeSpent = Math.max(0, spent);
+  const safeLimit = Math.max(0, limit);
+  const rawPercentage = safeLimit === 0 ? 0 : Math.round((safeSpent / safeLimit) * 100);
+
+  if (rawPercentage >= 100) {
+    return {
+      spentBrl: safeSpent,
+      limitBrl: safeLimit,
+      percentage: rawPercentage,
+      alertLevel: "critical_100",
+      alertLabel: "Limite 100% atingido (bloqueio preventivo)",
+    };
+  }
+
+  if (rawPercentage >= 80) {
+    return {
+      spentBrl: safeSpent,
+      limitBrl: safeLimit,
+      percentage: rawPercentage,
+      alertLevel: "warning_80",
+      alertLabel: "Alerta de orçamento (acima de 80%)",
+    };
+  }
+
+  return {
+    spentBrl: safeSpent,
+    limitBrl: safeLimit,
+    percentage: rawPercentage,
+    alertLevel: "healthy",
+    alertLabel: "Dentro do orçamento",
+  };
+}
+
+function buildFloorPresentation(floor: MockDepartmentFloor): FloorPresentation {
+  const budgetStatus = computeBudgetStatus(floor.monthlySpentBrl, floor.monthlyBudgetBrl);
+  const tokenStatus = computeBudgetStatus(floor.tokensUsedMonth, floor.tokensLimitMonth);
+  const executingAgentsCount = floor.agents.filter((agent) => agent.status === "executing").length;
+  const awaitingApprovalCount = floor.agents.filter(
+    (agent) => agent.status === "awaiting_approval",
+  ).length;
+
+  return {
+    ...floor,
+    budgetStatus,
+    tokenStatus,
+    executingAgentsCount,
+    awaitingApprovalCount,
+  };
+}
+
+function createZeroMetrics(): DashboardMetricsSummary {
+  return {
+    totalFloors: 0,
+    totalAgents: 0,
+    executingAgents: 0,
+    awaitingApprovalAgents: 0,
+    activeTasksCount: 0,
+    pendingApprovalsCount: 0,
+    budgetAlertFloorsCount: 0,
+    totalBudget: computeBudgetStatus(0, 0),
+  };
+}
+
+export function deriveDashboardViewModel(options: DeriveDashboardOptions = {}): DashboardViewModel {
+  const variant: DemoStateVariant = options.variant ?? "ready";
+  const org = getMockOrganizationBySlug(options.orgSlug);
+  const canDecideApprovals = roleCanDecideApprovals(org.activeRole);
+  const isProvisioning = org.tenantState === "PROVISIONING";
+
+  const baseOrganization = {
+    id: org.id,
+    slug: org.slug,
+    displayName: org.displayName,
+    legalName: org.legalName,
+    planName: org.planName,
+    tenantState: org.tenantState,
+    activeRole: org.activeRole,
+    activeUserLabel: org.activeUserLabel,
+    lastSyncLabel: org.lastSyncLabel,
+    securityBanner: org.securityBanner,
+    canDecideApprovals,
+    isProvisioning,
+  };
+
+  if (variant === "loading") {
+    return {
+      variant: "loading",
+      isDemoEnvironment: true,
+      demoBannerText: DEMO_ENVIRONMENT_BANNER,
+      organization: baseOrganization,
+      metrics: createZeroMetrics(),
+      floors: [],
+      selectedFloor: null,
+      filteredAgents: [],
+      tasks: [],
+      approvals: [],
+      recentActivity: [],
+      errorDetails: null,
+      emptyStateMessage: null,
+    };
+  }
+
+  if (variant === "error") {
+    return {
+      variant: "error",
+      isDemoEnvironment: true,
+      demoBannerText: DEMO_ENVIRONMENT_BANNER,
+      organization: baseOrganization,
+      metrics: createZeroMetrics(),
+      floors: [],
+      selectedFloor: null,
+      filteredAgents: [],
+      tasks: [],
+      approvals: [],
+      recentActivity: [],
+      errorDetails: org.simulatedError,
+      emptyStateMessage: null,
+    };
+  }
+
+  if (variant === "empty") {
+    return {
+      variant: "empty",
+      isDemoEnvironment: true,
+      demoBannerText: DEMO_ENVIRONMENT_BANNER,
+      organization: baseOrganization,
+      metrics: createZeroMetrics(),
+      floors: [],
+      selectedFloor: null,
+      filteredAgents: [],
+      tasks: [],
+      approvals: [],
+      recentActivity: [],
+      errorDetails: null,
+      emptyStateMessage:
+        "Nenhum departamento ou agente provisionado nesta visualização demonstrativa. Quando os módulos forem ativados no Control Plane, os andares do edifício e as filas aparecerão aqui.",
+    };
+  }
+
+  // Ordena do andar mais alto para o terreo (representacao visual de predio)
+  const sortedFloors = [...org.floors]
+    .sort((a, b) => b.floorNumber - a.floorNumber)
+    .map((floor) => buildFloorPresentation(floor));
+
+  const selectedFloor =
+    sortedFloors.find((floor) => floor.id === options.selectedFloorId) ?? sortedFloors[0] ?? null;
+
+  const allAgents: MockAgent[] = sortedFloors.flatMap((floor) => floor.agents);
+  const normalizedQuery = (options.agentQuery ?? "").trim().toLowerCase();
+  const sourceAgents = selectedFloor ? selectedFloor.agents : allAgents;
+  const filteredAgents = normalizedQuery
+    ? sourceAgents.filter(
+        (agent) =>
+          agent.name.toLowerCase().includes(normalizedQuery) ||
+          agent.roleTitle.toLowerCase().includes(normalizedQuery) ||
+          agent.code.toLowerCase().includes(normalizedQuery) ||
+          agent.currentTaskSummary.toLowerCase().includes(normalizedQuery),
+      )
+    : sourceAgents;
+
+  const totalSpentBrl = sortedFloors.reduce((acc, floor) => acc + floor.monthlySpentBrl, 0);
+  const totalLimitBrl = sortedFloors.reduce((acc, floor) => acc + floor.monthlyBudgetBrl, 0);
+  const budgetAlertFloorsCount = sortedFloors.filter(
+    (floor) => floor.budgetStatus.alertLevel !== "healthy",
+  ).length;
+
+  const metrics: DashboardMetricsSummary = {
+    totalFloors: sortedFloors.length,
+    totalAgents: allAgents.length,
+    executingAgents: allAgents.filter((a) => a.status === "executing").length,
+    awaitingApprovalAgents: allAgents.filter((a) => a.status === "awaiting_approval").length,
+    activeTasksCount: org.tasks.filter(
+      (t) => t.status === "running" || t.status === "queued" || t.status === "awaiting_human",
+    ).length,
+    pendingApprovalsCount: org.approvals.length,
+    budgetAlertFloorsCount,
+    totalBudget: computeBudgetStatus(totalSpentBrl, totalLimitBrl),
+  };
+
+  return {
+    variant: "ready",
+    isDemoEnvironment: true,
+    demoBannerText: DEMO_ENVIRONMENT_BANNER,
+    organization: baseOrganization,
+    metrics,
+    floors: sortedFloors,
+    selectedFloor,
+    filteredAgents,
+    tasks: org.tasks,
+    approvals: org.approvals,
+    recentActivity: org.recentActivity,
+    errorDetails: null,
+    emptyStateMessage: null,
+  };
+}
diff --git a/apps/web/lib/mock-types.ts b/apps/web/lib/mock-types.ts
new file mode 100644
index 0000000..e3f1d64
--- /dev/null
+++ b/apps/web/lib/mock-types.ts
@@ -0,0 +1,173 @@
+/**
+ * Tipos do modelo local de demonstracao do frontend (LOC-WEB-001).
+ *
+ * IMPORTANTE: Estes tipos existem exclusivamente para validar a direcao visual
+ * de WEB-001, WEB-003 e WEB-005 com dados mockados locais enquanto o backend
+ * permanece pausado. Nao substituem `@nucleos/contracts` nem `@nucleos/sdk`.
+ */
+
+export type DemoStateVariant = "ready" | "loading" | "empty" | "error";
+
+export type TenantLifecycleState = "ACTIVE" | "PROVISIONING" | "SUSPENDED";
+
+export type UserRole = "org_admin" | "department_manager" | "operator" | "viewer";
+
+export type AgentStatus = "executing" | "idle" | "awaiting_approval" | "degraded";
+
+export type TaskStatus = "running" | "queued" | "awaiting_human" | "completed" | "failed";
+
+export type ApprovalRiskLevel = "low" | "medium" | "high";
+
+export type BudgetAlertLevel = "healthy" | "warning_80" | "critical_100";
+
+export type SecurityEventSeverity = "info" | "warning" | "high";
+
+export interface MockAgent {
+  readonly id: string;
+  readonly code: string;
+  readonly name: string;
+  readonly roleTitle: string;
+  readonly departmentId: string;
+  readonly departmentName: string;
+  readonly floorNumber: number;
+  readonly workstationCode: string;
+  readonly status: AgentStatus;
+  readonly modelName: string;
+  readonly currentTaskSummary: string;
+  readonly tokensUsedMonth: number;
+  readonly tokensLimitMonth: number;
+}
+
+export interface MockDepartmentFloor {
+  readonly id: string;
+  readonly slug: string;
+  readonly name: string;
+  readonly floorNumber: number;
+  readonly moduleCode: string;
+  readonly summary: string;
+  readonly monthlyBudgetBrl: number;
+  readonly monthlySpentBrl: number;
+  readonly tokensUsedMonth: number;
+  readonly tokensLimitMonth: number;
+  readonly agents: readonly MockAgent[];
+}
+
+export interface MockTaskItem {
+  readonly id: string;
+  readonly code: string;
+  readonly title: string;
+  readonly departmentId: string;
+  readonly departmentName: string;
+  readonly agentName: string;
+  readonly status: TaskStatus;
+  readonly startedAtLabel: string;
+  readonly durationLabel: string;
+}
+
+export interface MockApprovalItem {
+  readonly id: string;
+  readonly actionHash: string;
+  readonly title: string;
+  readonly serverSummary: string;
+  readonly departmentName: string;
+  readonly agentName: string;
+  readonly riskLevel: ApprovalRiskLevel;
+  readonly expiresInLabel: string;
+  readonly argumentsPreview: string;
+  readonly requiredPermission: "approvals:decide";
+}
+
+export interface MockSecurityActivityItem {
+  readonly id: string;
+  readonly timestampLabel: string;
+  readonly eventCode: string;
+  readonly summary: string;
+  readonly actorLabel: string;
+  readonly severity: SecurityEventSeverity;
+  readonly correlationId: string;
+}
+
+export interface MockProblemDetails {
+  readonly code: string;
+  readonly httpStatus: number;
+  readonly title: string;
+  readonly userMessage: string;
+  readonly correlationId: string;
+  readonly retryable: boolean;
+}
+
+export interface MockOrganizationFixture {
+  readonly id: string;
+  readonly slug: string;
+  readonly displayName: string;
+  readonly legalName: string;
+  readonly planName: string;
+  readonly tenantState: TenantLifecycleState;
+  readonly activeRole: UserRole;
+  readonly activeUserLabel: string;
+  readonly lastSyncLabel: string;
+  readonly securityBanner: string | null;
+  readonly floors: readonly MockDepartmentFloor[];
+  readonly tasks: readonly MockTaskItem[];
+  readonly approvals: readonly MockApprovalItem[];
+  readonly recentActivity: readonly MockSecurityActivityItem[];
+  readonly simulatedError: MockProblemDetails;
+}
+
+export interface MockOrganizationSummary {
+  readonly id: string;
+  readonly slug: string;
+  readonly displayName: string;
+  readonly planName: string;
+  readonly tenantState: TenantLifecycleState;
+  readonly activeRole: UserRole;
+}
+
+export interface BudgetConsumptionSummary {
+  readonly spentBrl: number;
+  readonly limitBrl: number;
+  readonly percentage: number;
+  readonly alertLevel: BudgetAlertLevel;
+  readonly alertLabel: string;
+}
+
+export interface FloorPresentation extends MockDepartmentFloor {
+  readonly budgetStatus: BudgetConsumptionSummary;
+  readonly tokenStatus: BudgetConsumptionSummary;
+  readonly executingAgentsCount: number;
+  readonly awaitingApprovalCount: number;
+}
+
+export interface DashboardMetricsSummary {
+  readonly totalFloors: number;
+  readonly totalAgents: number;
+  readonly executingAgents: number;
+  readonly awaitingApprovalAgents: number;
+  readonly activeTasksCount: number;
+  readonly pendingApprovalsCount: number;
+  readonly budgetAlertFloorsCount: number;
+  readonly totalBudget: BudgetConsumptionSummary;
+}
+
+export interface DashboardViewModel {
+  readonly variant: DemoStateVariant;
+  readonly isDemoEnvironment: true;
+  readonly demoBannerText: string;
+  readonly organization: MockOrganizationSummary & {
+    readonly legalName: string;
+    readonly activeUserLabel: string;
+    readonly lastSyncLabel: string;
+    readonly securityBanner: string | null;
+    readonly canDecideApprovals: boolean;
+    readonly isProvisioning: boolean;
+  };
+  readonly metrics: DashboardMetricsSummary;
+  readonly floors: readonly FloorPresentation[];
+  readonly selectedFloor: FloorPresentation | null;
+  readonly filteredAgents: readonly MockAgent[];
+  readonly tasks: readonly MockTaskItem[];
+  readonly approvals: readonly MockApprovalItem[];
+  readonly recentActivity: readonly MockSecurityActivityItem[];
+  readonly errorDetails: MockProblemDetails | null;
+  readonly emptyStateMessage: string | null;
+}
```
