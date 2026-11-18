"use client";

import { useState } from "react";
import { deriveDashboardViewModel, listMockOrganizations } from "../../lib/mock-selectors.ts";
import type { DashboardMetricsSummary, DemoStateVariant } from "../../lib/mock-types.ts";
import { AgentChatAndSecurityPanel } from "./AgentChatAndSecurityPanel.tsx";
import { AuthAndMultiOrgPanel } from "./AuthAndMultiOrgPanel.tsx";
import { BuildingFloorMap } from "./BuildingFloorMap.tsx";
import { OperationsPanels, type SimulatedApprovalDecision } from "./OperationsPanels.tsx";
import { OrganizationGovernancePanel } from "./OrganizationGovernancePanel.tsx";
import { OverviewPanel } from "./OverviewPanel.tsx";
import { PlatformBackofficePanel } from "./PlatformBackofficePanel.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

export type NavigationSection =
  "overview" | "building" | "operations" | "chat" | "governance" | "auth" | "platform";

export interface DashboardClientShellProps {
  readonly initialSection?: NavigationSection;
}

const SYSTEM_SECTIONS: readonly {
  readonly section: NavigationSection;
  readonly code: string;
  readonly label: string;
}[] = [
  { section: "operations", code: "OP", label: "Aprovações, filas e orçamento" },
  { section: "chat", code: "IA", label: "Chat com agentes" },
  { section: "governance", code: "GV", label: "Governança e exportação" },
  { section: "auth", code: "AC", label: "Acesso e organizações" },
  { section: "platform", code: "PL", label: "Plataforma" },
];

function sectionTitle(section: NavigationSection): string {
  switch (section) {
    case "overview":
      return "Painel";
    case "building":
      return "Setores e agentes";
    case "operations":
      return "Aprovações, filas e orçamento";
    case "chat":
      return "Chat com agentes";
    case "governance":
      return "Governança e exportação";
    case "auth":
      return "Acesso e organizações";
    case "platform":
      return "Plataforma";
  }
}

function floorCode(name: string): string {
  return name
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
}

function MetricsGrid({ metrics }: { readonly metrics: DashboardMetricsSummary }) {
  return (
    <section aria-labelledby="metrics-summary-heading">
      <h2 id="metrics-summary-heading" className="panel-header" style={{ fontSize: "0.95rem" }}>
        Indicadores operacionais
      </h2>
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-card__label">Departamentos ativos</span>
          <span className="kpi-card__value">{metrics.totalFloors}</span>
          <span className="kpi-card__detail">Módulos contratados</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Agentes de IA</span>
          <span className="kpi-card__value">
            {metrics.executingAgents} / {metrics.totalAgents}
          </span>
          <span className="kpi-card__detail">
            Em execução ({metrics.awaitingApprovalAgents} aguardando humano)
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Tarefas ativas e fila</span>
          <span className="kpi-card__value">{metrics.activeTasksCount}</span>
          <span className="kpi-card__detail">Em andamento ou aguardando</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Aprovações pendentes</span>
          <span className="kpi-card__value">{metrics.pendingApprovalsCount}</span>
          <span className="kpi-card__detail">Requerem decisão humana (HITL)</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Orçamento mensal de IA</span>
          <span className="kpi-card__value">{metrics.totalBudget.percentage}%</span>
          <span className="kpi-card__detail">
            R$ {metrics.totalBudget.spentBrl} / R$ {metrics.totalBudget.limitBrl} (
            {metrics.budgetAlertFloorsCount} depto(s) em alerta)
          </span>
        </div>
      </div>
    </section>
  );
}

export function DashboardClientShell({ initialSection = "overview" }: DashboardClientShellProps) {
  const organizations = listMockOrganizations();
  const defaultOrgSlug = organizations[0]?.slug ?? "aurora-industrial";

  const [orgSlug, setOrgSlug] = useState<string>(defaultOrgSlug);
  const [variant, setVariant] = useState<DemoStateVariant>("ready");
  const [selectedFloorId, setSelectedFloorId] = useState<string | undefined>(undefined);
  const [agentQuery, setAgentQuery] = useState<string>("");
  const [activeSection, setActiveSection] = useState<NavigationSection>(initialSection);
  const [decisions, setDecisions] = useState<readonly SimulatedApprovalDecision[]>([]);

  const viewModel = deriveDashboardViewModel({
    orgSlug,
    variant,
    ...(selectedFloorId !== undefined ? { selectedFloorId } : {}),
    ...(agentQuery ? { agentQuery } : {}),
  });

  function handleSelectOrg(nextSlug: string): void {
    setOrgSlug(nextSlug);
    setSelectedFloorId(undefined);
    setAgentQuery("");
    setDecisions([]);
  }

  function handleDecideApproval(approvalId: string, decision: "approved" | "rejected"): void {
    setDecisions((prev) => [
      ...prev.filter((item) => item.approvalId !== approvalId),
      { approvalId, decision },
    ]);
  }

  const showingSectors = activeSection === "building";
  const activeFloorId = viewModel.selectedFloor?.id;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

      <nav className="sidebar" aria-label="Navegação principal da organização">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <div className="brand-title">NÚCLEOS</div>
            <div className="brand-subtitle">Enterprise</div>
          </div>
        </div>

        <div className="side-org">
          <label htmlFor="org-switcher-select">Organização ativa (mock)</label>
          <select
            id="org-switcher-select"
            value={viewModel.organization.slug}
            onChange={(e) => {
              handleSelectOrg(e.target.value);
            }}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.slug}>
                {org.displayName} ({org.tenantState} · {org.activeRole})
              </option>
            ))}
          </select>
        </div>

        <div className="side-group">
          <button
            type="button"
            className="nav-button"
            aria-current={activeSection === "overview" ? "page" : undefined}
            onClick={() => {
              setActiveSection("overview");
            }}
          >
            <span className="nav-code" aria-hidden="true">
              PN
            </span>
            Painel
          </button>
        </div>

        <div className="side-group">
          <h2 className="side-group__title">Setores</h2>
          {viewModel.floors.length === 0 ? (
            <span className="brand-subtitle" style={{ padding: "0 0.65rem" }}>
              Nenhum setor ativo
            </span>
          ) : (
            viewModel.floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className="nav-button"
                aria-current={showingSectors && activeFloorId === floor.id ? "page" : undefined}
                onClick={() => {
                  setSelectedFloorId(floor.id);
                  setActiveSection("building");
                }}
              >
                <span className="nav-code" aria-hidden="true">
                  {floorCode(floor.name)}
                </span>
                {floor.name}
              </button>
            ))
          )}
        </div>

        <div className="side-group">
          <h2 className="side-group__title">Sistema</h2>
          {SYSTEM_SECTIONS.map((item) => (
            <button
              key={item.section}
              type="button"
              className="nav-button"
              aria-current={activeSection === item.section ? "page" : undefined}
              onClick={() => {
                setActiveSection(item.section);
              }}
            >
              <span className="nav-code" aria-hidden="true">
                {item.code}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="app-content">
        <aside
          className="demo-banner"
          aria-label="Aviso de ambiente de demonstração com dados mockados"
        >
          <div>
            <strong>MODO DEMONSTRAÇÃO (MOCK LOCAL)</strong> — {viewModel.demoBannerText}
          </div>
          <span className="demo-badge demo-badge--warn">
            Sem rede · Sem autenticação real · EP-10 Mockado
          </span>
        </aside>

        <header className="topbar">
          <span className="topbar__title">{sectionTitle(activeSection)}</span>
          <div className="controls-bar">
            <div className="control-group">
              <label htmlFor="state-variant-select">Estado da tela (demo)</label>
              <select
                id="state-variant-select"
                className="control-select"
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value as DemoStateVariant);
                }}
              >
                <option value="ready">Normal (dados carregados)</option>
                <option value="loading">Carregando (skeleton)</option>
                <option value="empty">Vazio (sem módulos ativos)</option>
                <option value="error">Erro (Problem Details)</option>
              </select>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="shell-main">
          <section className="org-hero" aria-labelledby="active-org-heading">
            <div>
              <div className="org-meta-row">
                <span className="demo-badge demo-badge--info">
                  Tenant: {viewModel.organization.slug}
                </span>
                <span
                  className={
                    viewModel.organization.isProvisioning
                      ? "demo-badge demo-badge--warn"
                      : "demo-badge demo-badge--ok"
                  }
                >
                  Estado: {viewModel.organization.tenantState}
                </span>
                <span className="demo-badge demo-badge--info">
                  Papel simulado: {viewModel.organization.activeRole}
                </span>
              </div>
              <h1 id="active-org-heading">
                {viewModel.organization.displayName} —{" "}
                <span className="hl">{sectionTitle(activeSection)}</span>
              </h1>
              <div className="org-meta-row">
                <span>{viewModel.organization.legalName}</span>
                <span>·</span>
                <span>Plano: {viewModel.organization.planName}</span>
                <span>·</span>
                <span>Sessão mockada: {viewModel.organization.activeUserLabel}</span>
              </div>
            </div>

            <div
              className="org-meta-row"
              style={{ flexDirection: "column", alignItems: "flex-end" }}
            >
              <span>Origem: fixtures locais tipadas</span>
              <span>{viewModel.organization.lastSyncLabel}</span>
            </div>
          </section>

          {viewModel.organization.securityBanner && viewModel.variant === "ready" ? (
            <section className="security-banner" aria-label="Alerta recente de segurança do tenant">
              <strong>Segurança do tenant:</strong> {viewModel.organization.securityBanner}
            </section>
          ) : null}

          {viewModel.variant === "loading" ? (
            <section
              className="state-box"
              role="status"
              aria-live="polite"
              aria-labelledby="loading-state-heading"
            >
              <h2 id="loading-state-heading">
                Sincronizando departamentos e agentes (simulação de carregamento)
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>
                Aguardando leitura agregada das fixtures de{" "}
                <strong>{viewModel.organization.displayName}</strong>. Nenhum dado parcial ou de
                outra organização é exibido durante a transição.
              </p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setVariant("ready");
                }}
              >
                Concluir carregamento simulado
              </button>
            </section>
          ) : null}

          {viewModel.variant === "empty" ? (
            <section className="state-box" aria-labelledby="empty-state-heading">
              <h2 id="empty-state-heading">Nenhum departamento ativo para exibir</h2>
              <p style={{ color: "var(--text-secondary)" }}>{viewModel.emptyStateMessage}</p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setVariant("ready");
                }}
              >
                Restaurar fixtures povoadas (normal)
              </button>
            </section>
          ) : null}

          {viewModel.variant === "error" && viewModel.errorDetails ? (
            <section
              className="state-box state-box--error"
              role="alert"
              aria-labelledby="error-state-heading"
            >
              <div className="org-meta-row" style={{ marginBottom: "0.5rem" }}>
                <span className="demo-badge demo-badge--danger">
                  HTTP {viewModel.errorDetails.httpStatus}
                </span>
                <code>{viewModel.errorDetails.code}</code>
              </div>
              <h2 id="error-state-heading">{viewModel.errorDetails.title}</h2>
              <p style={{ color: "var(--text-primary)" }}>{viewModel.errorDetails.userMessage}</p>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                Código de correlação para suporte:{" "}
                <code>{viewModel.errorDetails.correlationId}</code> (detalhes internos ocultados por
                segurança conforme diretriz de WEB-002).
              </p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setVariant("ready");
                }}
              >
                Tentar novamente (voltar ao estado normal)
              </button>
            </section>
          ) : null}

          {viewModel.variant === "ready" ? (
            <>
              {activeSection === "overview" ? (
                <OverviewPanel
                  viewModel={viewModel}
                  onOpenApprovals={() => {
                    setActiveSection("operations");
                  }}
                  onOpenActivity={() => {
                    setActiveSection("operations");
                  }}
                />
              ) : null}

              {activeSection === "building" ? (
                <BuildingFloorMap
                  floors={viewModel.floors}
                  selectedFloor={viewModel.selectedFloor}
                  filteredAgents={viewModel.filteredAgents}
                  isProvisioning={viewModel.organization.isProvisioning}
                  agentQuery={agentQuery}
                  onSelectFloor={(floorId) => {
                    setSelectedFloorId(floorId);
                  }}
                  onChangeAgentQuery={(q) => {
                    setAgentQuery(q);
                  }}
                />
              ) : null}

              {activeSection === "operations" ? (
                <>
                  <MetricsGrid metrics={viewModel.metrics} />
                  <OperationsPanels
                    approvals={viewModel.approvals}
                    tasks={viewModel.tasks}
                    floors={viewModel.floors}
                    recentActivity={viewModel.recentActivity}
                    canDecideApprovals={viewModel.organization.canDecideApprovals}
                    activeRoleLabel={viewModel.organization.activeRole}
                    decisions={decisions}
                    onDecideApproval={handleDecideApproval}
                  />
                </>
              ) : null}

              {activeSection === "chat" ? <AgentChatAndSecurityPanel /> : null}

              {activeSection === "governance" ? (
                <OrganizationGovernancePanel
                  orgSlug={viewModel.organization.slug}
                  activeRole={viewModel.organization.activeRole}
                  canMutateGovernance={viewModel.organization.canDecideApprovals}
                />
              ) : null}

              {activeSection === "auth" ? <AuthAndMultiOrgPanel /> : null}

              {activeSection === "platform" ? <PlatformBackofficePanel /> : null}
            </>
          ) : null}
        </main>

        <footer className="shell-footer">
          <strong>NÚCLEOS Enterprise — Interface Web Mockada (LOC-WEB-001 / EP-10 sem 3D)</strong>
          {" · "}Esta entrega utiliza exclusivamente fixtures TypeScript locais para validar
          navegação, acessibilidade, fluxos de autenticação/multi-org, chat com sanitização XSS,
          governança/CSV e backoffice. Os tickets canônicos do EP-10 permanecem abertos aguardando
          integração com o backend; a cena 3D (<code>WEB-005..007</code>) fica para sessão futura.
        </footer>
      </div>
    </div>
  );
}
