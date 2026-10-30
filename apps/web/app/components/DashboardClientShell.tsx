"use client";

import { useState } from "react";
import { deriveDashboardViewModel, listMockOrganizations } from "../../lib/mock-selectors.ts";
import type { DemoStateVariant } from "../../lib/mock-types.ts";
import { AgentChatAndSecurityPanel } from "./AgentChatAndSecurityPanel.tsx";
import { AuthAndMultiOrgPanel } from "./AuthAndMultiOrgPanel.tsx";
import { BuildingFloorMap } from "./BuildingFloorMap.tsx";
import { OperationsPanels, type SimulatedApprovalDecision } from "./OperationsPanels.tsx";
import { OrganizationGovernancePanel } from "./OrganizationGovernancePanel.tsx";
import { PlatformBackofficePanel } from "./PlatformBackofficePanel.tsx";

export type NavigationSection =
  "overview" | "building" | "operations" | "chat" | "governance" | "auth" | "platform";

export interface DashboardClientShellProps {
  readonly initialSection?: NavigationSection;
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

  return (
    <div>
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

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

      <header className="shell-header">
        <div className="shell-header__inner">
          <div className="brand-block">
            <span className="brand-title">NÚCLEOS ENTERPRISE</span>
            <span className="brand-subtitle">
              Interface Web Completa com Dados Mockados (WEB-001..004, WEB-008, WEB-009)
            </span>
          </div>

          <div className="controls-bar">
            <div className="control-group">
              <label htmlFor="org-switcher-select">Organização ativa (mock)</label>
              <select
                id="org-switcher-select"
                className="control-select"
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

            <div className="control-group">
              <label htmlFor="state-variant-select">Estado determinístico da tela</label>
              <select
                id="state-variant-select"
                className="control-select"
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value as DemoStateVariant);
                }}
              >
                <option value="ready">Normal (Dados carregados)</option>
                <option value="loading">Carregando (Skeleton)</option>
                <option value="empty">Vazio (Sem módulos ativos)</option>
                <option value="error">Erro (Problem Details)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <nav className="shell-nav" aria-label="Navegação principal da organização">
        <ul className="shell-nav__list">
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "overview" ? "page" : undefined}
              onClick={() => {
                setActiveSection("overview");
              }}
            >
              Visão Completa
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "building" ? "page" : undefined}
              onClick={() => {
                setActiveSection("building");
              }}
            >
              Departamentos &amp; Agentes
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "operations" ? "page" : undefined}
              onClick={() => {
                setActiveSection("operations");
              }}
            >
              Aprovações, Filas &amp; Orçamento
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "chat" ? "page" : undefined}
              onClick={() => {
                setActiveSection("chat");
              }}
            >
              Chat Agentes &amp; XSS (WEB-004/008)
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "governance" ? "page" : undefined}
              onClick={() => {
                setActiveSection("governance");
              }}
            >
              Governança &amp; CSV (WEB-003)
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "auth" ? "page" : undefined}
              onClick={() => {
                setActiveSection("auth");
              }}
            >
              Login, MFA &amp; Multi-Org (WEB-001)
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-button"
              aria-current={activeSection === "platform" ? "page" : undefined}
              onClick={() => {
                setActiveSection("platform");
              }}
            >
              Backoffice /platform (WEB-009)
            </button>
          </li>
        </ul>
      </nav>

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
              {viewModel.organization.displayName} — Painel Operacional
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
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              textAlign: "right",
            }}
          >
            <div>Origem: Fixtures locais tipadas</div>
            <div>{viewModel.organization.lastSyncLabel}</div>
          </div>
        </section>

        {viewModel.organization.securityBanner && viewModel.variant === "ready" ? (
          <section className="security-banner" aria-label="Alerta recente de segurança do tenant">
            <strong>Segurança do Tenant:</strong> {viewModel.organization.securityBanner}
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
              Sincronizando departamentos e agentes (Simulação de carregamento)
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Aguardando leitura agregada das fixtures de{" "}
              <strong>{viewModel.organization.displayName}</strong>. Nenhum dado parcial ou de outra
              organização é exibido durante a transição.
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
              Restaurar fixtures povoadas (Normal)
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
            <p
              style={{
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              Código de correlação para suporte: <code>{viewModel.errorDetails.correlationId}</code>{" "}
              (detalhes internos ocultados por segurança conforme diretriz de WEB-002).
            </p>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setVariant("ready");
              }}
            >
              Tentar novamente (Voltar ao estado Normal)
            </button>
          </section>
        ) : null}

        {viewModel.variant === "ready" ? (
          <>
            <section aria-labelledby="metrics-summary-heading">
              <h2
                id="metrics-summary-heading"
                style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
              >
                Indicadores Operacionais da Organização
              </h2>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-card__label">Departamentos Ativos</span>
                  <span className="kpi-card__value">{viewModel.metrics.totalFloors}</span>
                  <span className="kpi-card__detail">Módulos contratados na organização</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-card__label">Agentes de IA</span>
                  <span className="kpi-card__value">
                    {viewModel.metrics.executingAgents} / {viewModel.metrics.totalAgents}
                  </span>
                  <span className="kpi-card__detail">
                    Em execução agora ({viewModel.metrics.awaitingApprovalAgents} aguardando humano)
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-card__label">Tarefas Ativas &amp; Fila</span>
                  <span className="kpi-card__value">{viewModel.metrics.activeTasksCount}</span>
                  <span className="kpi-card__detail">Jobs em andamento ou aguardando</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-card__label">Aprovações Pendentes</span>
                  <span className="kpi-card__value">{viewModel.metrics.pendingApprovalsCount}</span>
                  <span className="kpi-card__detail">Requerem decisão humana (HITL)</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-card__label">Orçamento Mensal de IA</span>
                  <span className="kpi-card__value">
                    {viewModel.metrics.totalBudget.percentage}%
                  </span>
                  <span className="kpi-card__detail">
                    R$ {viewModel.metrics.totalBudget.spentBrl} / R${" "}
                    {viewModel.metrics.totalBudget.limitBrl} (
                    {viewModel.metrics.budgetAlertFloorsCount} depto(s) em alerta)
                  </span>
                </div>
              </div>
            </section>

            {activeSection === "overview" || activeSection === "building" ? (
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

            {activeSection === "overview" || activeSection === "operations" ? (
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
            ) : null}

            {activeSection === "overview" || activeSection === "chat" ? (
              <AgentChatAndSecurityPanel />
            ) : null}

            {activeSection === "overview" || activeSection === "governance" ? (
              <OrganizationGovernancePanel
                orgSlug={viewModel.organization.slug}
                activeRole={viewModel.organization.activeRole}
                canMutateGovernance={viewModel.organization.canDecideApprovals}
              />
            ) : null}

            {activeSection === "overview" || activeSection === "auth" ? (
              <AuthAndMultiOrgPanel />
            ) : null}

            {activeSection === "overview" || activeSection === "platform" ? (
              <PlatformBackofficePanel />
            ) : null}
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
  );
}
