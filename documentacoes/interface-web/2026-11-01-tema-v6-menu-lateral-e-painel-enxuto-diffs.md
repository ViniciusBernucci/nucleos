# Diffs — Tema v6, menu lateral e Painel enxuto (2026-11-01)

Documento principal: [2026-11-01-tema-v6-menu-lateral-e-painel-enxuto.md](2026-11-01-tema-v6-menu-lateral-e-painel-enxuto.md).

Base: `HEAD` = `54a9aa78812e7772493b9fa5721a2e0a268bfb33` na branch `design/tema-v6`. Nenhum commit criado nesta tarefa; os diffs abaixo são do estado da árvore de trabalho (não staged) e foram gerados com `git diff` / `git diff --no-index`. Os arquivos em `documentacoes/` e `lessons/` não entram, para evitar recursão.

## Arquivos modificados (unstaged)

```diff
diff --git a/apps/web/app/components/DashboardClientShell.tsx b/apps/web/app/components/DashboardClientShell.tsx
index 8c3ccb7..61797cf 100644
--- a/apps/web/app/components/DashboardClientShell.tsx
+++ b/apps/web/app/components/DashboardClientShell.tsx
@@ -2,13 +2,15 @@
 
 import { useState } from "react";
 import { deriveDashboardViewModel, listMockOrganizations } from "../../lib/mock-selectors.ts";
-import type { DemoStateVariant } from "../../lib/mock-types.ts";
+import type { DashboardMetricsSummary, DemoStateVariant } from "../../lib/mock-types.ts";
 import { AgentChatAndSecurityPanel } from "./AgentChatAndSecurityPanel.tsx";
 import { AuthAndMultiOrgPanel } from "./AuthAndMultiOrgPanel.tsx";
 import { BuildingFloorMap } from "./BuildingFloorMap.tsx";
 import { OperationsPanels, type SimulatedApprovalDecision } from "./OperationsPanels.tsx";
 import { OrganizationGovernancePanel } from "./OrganizationGovernancePanel.tsx";
+import { OverviewPanel } from "./OverviewPanel.tsx";
 import { PlatformBackofficePanel } from "./PlatformBackofficePanel.tsx";
+import { ThemeToggle } from "./ThemeToggle.tsx";
 
 export type NavigationSection =
   "overview" | "building" | "operations" | "chat" | "governance" | "auth" | "platform";
@@ -17,6 +19,88 @@ export interface DashboardClientShellProps {
   readonly initialSection?: NavigationSection;
 }
 
+const SYSTEM_SECTIONS: readonly {
+  readonly section: NavigationSection;
+  readonly code: string;
+  readonly label: string;
+}[] = [
+  { section: "operations", code: "OP", label: "Aprovações, filas e orçamento" },
+  { section: "chat", code: "IA", label: "Chat com agentes" },
+  { section: "governance", code: "GV", label: "Governança e exportação" },
+  { section: "auth", code: "AC", label: "Acesso e organizações" },
+  { section: "platform", code: "PL", label: "Plataforma" },
+];
+
+function sectionTitle(section: NavigationSection): string {
+  switch (section) {
+    case "overview":
+      return "Painel";
+    case "building":
+      return "Setores e agentes";
+    case "operations":
+      return "Aprovações, filas e orçamento";
+    case "chat":
+      return "Chat com agentes";
+    case "governance":
+      return "Governança e exportação";
+    case "auth":
+      return "Acesso e organizações";
+    case "platform":
+      return "Plataforma";
+  }
+}
+
+function floorCode(name: string): string {
+  return name
+    .replace(/[^\p{L}]/gu, "")
+    .slice(0, 2)
+    .toUpperCase();
+}
+
+function MetricsGrid({ metrics }: { readonly metrics: DashboardMetricsSummary }) {
+  return (
+    <section aria-labelledby="metrics-summary-heading">
+      <h2 id="metrics-summary-heading" className="panel-header" style={{ fontSize: "0.95rem" }}>
+        Indicadores operacionais
+      </h2>
+      <div className="kpi-grid">
+        <div className="kpi-card">
+          <span className="kpi-card__label">Departamentos ativos</span>
+          <span className="kpi-card__value">{metrics.totalFloors}</span>
+          <span className="kpi-card__detail">Módulos contratados</span>
+        </div>
+        <div className="kpi-card">
+          <span className="kpi-card__label">Agentes de IA</span>
+          <span className="kpi-card__value">
+            {metrics.executingAgents} / {metrics.totalAgents}
+          </span>
+          <span className="kpi-card__detail">
+            Em execução ({metrics.awaitingApprovalAgents} aguardando humano)
+          </span>
+        </div>
+        <div className="kpi-card">
+          <span className="kpi-card__label">Tarefas ativas e fila</span>
+          <span className="kpi-card__value">{metrics.activeTasksCount}</span>
+          <span className="kpi-card__detail">Em andamento ou aguardando</span>
+        </div>
+        <div className="kpi-card">
+          <span className="kpi-card__label">Aprovações pendentes</span>
+          <span className="kpi-card__value">{metrics.pendingApprovalsCount}</span>
+          <span className="kpi-card__detail">Requerem decisão humana (HITL)</span>
+        </div>
+        <div className="kpi-card">
+          <span className="kpi-card__label">Orçamento mensal de IA</span>
+          <span className="kpi-card__value">{metrics.totalBudget.percentage}%</span>
+          <span className="kpi-card__detail">
+            R$ {metrics.totalBudget.spentBrl} / R$ {metrics.totalBudget.limitBrl} (
+            {metrics.budgetAlertFloorsCount} depto(s) em alerta)
+          </span>
+        </div>
+      </div>
+    </section>
+  );
+}
+
 export function DashboardClientShell({ initialSection = "overview" }: DashboardClientShellProps) {
   const organizations = listMockOrganizations();
   const defaultOrgSlug = organizations[0]?.slug ?? "aurora-industrial";
@@ -49,400 +133,336 @@ export function DashboardClientShell({ initialSection = "overview" }: DashboardC
     ]);
   }
 
+  const showingSectors = activeSection === "building";
+  const activeFloorId = viewModel.selectedFloor?.id;
+
   return (
-    <div>
+    <div className="app-shell">
       <a href="#main-content" className="skip-link">
         Pular para o conteúdo principal
       </a>
 
-      <aside
-        className="demo-banner"
-        aria-label="Aviso de ambiente de demonstração com dados mockados"
-      >
-        <div>
-          <strong>MODO DEMONSTRAÇÃO (MOCK LOCAL)</strong> — {viewModel.demoBannerText}
-        </div>
-        <span className="demo-badge demo-badge--warn">
-          Sem rede · Sem autenticação real · EP-10 Mockado
-        </span>
-      </aside>
-
-      <header className="shell-header">
-        <div className="shell-header__inner">
-          <div className="brand-block">
-            <span className="brand-title">NÚCLEOS ENTERPRISE</span>
-            <span className="brand-subtitle">
-              Interface Web Completa com Dados Mockados (WEB-001..004, WEB-008, WEB-009)
-            </span>
+      <nav className="sidebar" aria-label="Navegação principal da organização">
+        <div className="brand-block">
+          <span className="brand-mark" aria-hidden="true">
+            N
+          </span>
+          <div>
+            <div className="brand-title">NÚCLEOS</div>
+            <div className="brand-subtitle">Enterprise</div>
           </div>
+        </div>
 
-          <div className="controls-bar">
-            <div className="control-group">
-              <label htmlFor="org-switcher-select">Organização ativa (mock)</label>
-              <select
-                id="org-switcher-select"
-                className="control-select"
-                value={viewModel.organization.slug}
-                onChange={(e) => {
-                  handleSelectOrg(e.target.value);
-                }}
-              >
-                {organizations.map((org) => (
-                  <option key={org.id} value={org.slug}>
-                    {org.displayName} ({org.tenantState} · {org.activeRole})
-                  </option>
-                ))}
-              </select>
-            </div>
+        <div className="side-org">
+          <label htmlFor="org-switcher-select">Organização ativa (mock)</label>
+          <select
+            id="org-switcher-select"
+            value={viewModel.organization.slug}
+            onChange={(e) => {
+              handleSelectOrg(e.target.value);
+            }}
+          >
+            {organizations.map((org) => (
+              <option key={org.id} value={org.slug}>
+                {org.displayName} ({org.tenantState} · {org.activeRole})
+              </option>
+            ))}
+          </select>
+        </div>
 
-            <div className="control-group">
-              <label htmlFor="state-variant-select">Estado determinístico da tela</label>
-              <select
-                id="state-variant-select"
-                className="control-select"
-                value={variant}
-                onChange={(e) => {
-                  setVariant(e.target.value as DemoStateVariant);
+        <div className="side-group">
+          <button
+            type="button"
+            className="nav-button"
+            aria-current={activeSection === "overview" ? "page" : undefined}
+            onClick={() => {
+              setActiveSection("overview");
+            }}
+          >
+            <span className="nav-code" aria-hidden="true">
+              PN
+            </span>
+            Painel
+          </button>
+        </div>
+
+        <div className="side-group">
+          <h2 className="side-group__title">Setores</h2>
+          {viewModel.floors.length === 0 ? (
+            <span className="brand-subtitle" style={{ padding: "0 0.65rem" }}>
+              Nenhum setor ativo
+            </span>
+          ) : (
+            viewModel.floors.map((floor) => (
+              <button
+                key={floor.id}
+                type="button"
+                className="nav-button"
+                aria-current={showingSectors && activeFloorId === floor.id ? "page" : undefined}
+                onClick={() => {
+                  setSelectedFloorId(floor.id);
+                  setActiveSection("building");
                 }}
               >
-                <option value="ready">Normal (Dados carregados)</option>
-                <option value="loading">Carregando (Skeleton)</option>
-                <option value="empty">Vazio (Sem módulos ativos)</option>
-                <option value="error">Erro (Problem Details)</option>
-              </select>
-            </div>
-          </div>
+                <span className="nav-code" aria-hidden="true">
+                  {floorCode(floor.name)}
+                </span>
+                {floor.name}
+              </button>
+            ))
+          )}
         </div>
-      </header>
 
-      <nav className="shell-nav" aria-label="Navegação principal da organização">
-        <ul className="shell-nav__list">
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "overview" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("overview");
-              }}
-            >
-              Visão Completa
-            </button>
-          </li>
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "building" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("building");
-              }}
-            >
-              Departamentos &amp; Agentes
-            </button>
-          </li>
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "operations" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("operations");
-              }}
-            >
-              Aprovações, Filas &amp; Orçamento
-            </button>
-          </li>
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "chat" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("chat");
-              }}
-            >
-              Chat Agentes &amp; XSS (WEB-004/008)
-            </button>
-          </li>
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "governance" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("governance");
-              }}
-            >
-              Governança &amp; CSV (WEB-003)
-            </button>
-          </li>
-          <li>
-            <button
-              type="button"
-              className="nav-button"
-              aria-current={activeSection === "auth" ? "page" : undefined}
-              onClick={() => {
-                setActiveSection("auth");
-              }}
-            >
-              Login, MFA &amp; Multi-Org (WEB-001)
-            </button>
-          </li>
-          <li>
+        <div className="side-group">
+          <h2 className="side-group__title">Sistema</h2>
+          {SYSTEM_SECTIONS.map((item) => (
             <button
+              key={item.section}
               type="button"
               className="nav-button"
-              aria-current={activeSection === "platform" ? "page" : undefined}
+              aria-current={activeSection === item.section ? "page" : undefined}
               onClick={() => {
-                setActiveSection("platform");
+                setActiveSection(item.section);
               }}
             >
-              Backoffice /platform (WEB-009)
+              <span className="nav-code" aria-hidden="true">
+                {item.code}
+              </span>
+              {item.label}
             </button>
-          </li>
-        </ul>
+          ))}
+        </div>
       </nav>
 
-      <main id="main-content" className="shell-main">
-        <section className="org-hero" aria-labelledby="active-org-heading">
+      <div className="app-content">
+        <aside
+          className="demo-banner"
+          aria-label="Aviso de ambiente de demonstração com dados mockados"
+        >
           <div>
-            <div className="org-meta-row">
-              <span className="demo-badge demo-badge--info">
-                Tenant: {viewModel.organization.slug}
-              </span>
-              <span
-                className={
-                  viewModel.organization.isProvisioning
-                    ? "demo-badge demo-badge--warn"
-                    : "demo-badge demo-badge--ok"
-                }
-              >
-                Estado: {viewModel.organization.tenantState}
-              </span>
-              <span className="demo-badge demo-badge--info">
-                Papel simulado: {viewModel.organization.activeRole}
-              </span>
-            </div>
-            <h1 id="active-org-heading">
-              {viewModel.organization.displayName} — Painel Operacional
-            </h1>
-            <div className="org-meta-row">
-              <span>{viewModel.organization.legalName}</span>
-              <span>·</span>
-              <span>Plano: {viewModel.organization.planName}</span>
-              <span>·</span>
-              <span>Sessão mockada: {viewModel.organization.activeUserLabel}</span>
-            </div>
+            <strong>MODO DEMONSTRAÇÃO (MOCK LOCAL)</strong> — {viewModel.demoBannerText}
           </div>
+          <span className="demo-badge demo-badge--warn">
+            Sem rede · Sem autenticação real · EP-10 Mockado
+          </span>
+        </aside>
 
-          <div
-            style={{
-              fontSize: "0.8rem",
-              color: "var(--text-secondary)",
-              textAlign: "right",
-            }}
-          >
-            <div>Origem: Fixtures locais tipadas</div>
-            <div>{viewModel.organization.lastSyncLabel}</div>
+        <header className="topbar">
+          <span className="topbar__title">{sectionTitle(activeSection)}</span>
+          <div className="controls-bar">
+            <div className="control-group">
+              <label htmlFor="state-variant-select">Estado da tela (demo)</label>
+              <select
+                id="state-variant-select"
+                className="control-select"
+                value={variant}
+                onChange={(e) => {
+                  setVariant(e.target.value as DemoStateVariant);
+                }}
+              >
+                <option value="ready">Normal (dados carregados)</option>
+                <option value="loading">Carregando (skeleton)</option>
+                <option value="empty">Vazio (sem módulos ativos)</option>
+                <option value="error">Erro (Problem Details)</option>
+              </select>
+            </div>
+            <ThemeToggle />
           </div>
-        </section>
-
-        {viewModel.organization.securityBanner && viewModel.variant === "ready" ? (
-          <section className="security-banner" aria-label="Alerta recente de segurança do tenant">
-            <strong>Segurança do Tenant:</strong> {viewModel.organization.securityBanner}
-          </section>
-        ) : null}
-
-        {viewModel.variant === "loading" ? (
-          <section
-            className="state-box"
-            role="status"
-            aria-live="polite"
-            aria-labelledby="loading-state-heading"
-          >
-            <h2 id="loading-state-heading">
-              Sincronizando departamentos e agentes (Simulação de carregamento)
-            </h2>
-            <p style={{ color: "var(--text-secondary)" }}>
-              Aguardando leitura agregada das fixtures de{" "}
-              <strong>{viewModel.organization.displayName}</strong>. Nenhum dado parcial ou de outra
-              organização é exibido durante a transição.
-            </p>
-            <button
-              type="button"
-              className="btn btn--secondary"
-              onClick={() => {
-                setVariant("ready");
-              }}
-            >
-              Concluir carregamento simulado
-            </button>
-          </section>
-        ) : null}
+        </header>
+
+        <main id="main-content" className="shell-main">
+          <section className="org-hero" aria-labelledby="active-org-heading">
+            <div>
+              <div className="org-meta-row">
+                <span className="demo-badge demo-badge--info">
+                  Tenant: {viewModel.organization.slug}
+                </span>
+                <span
+                  className={
+                    viewModel.organization.isProvisioning
+                      ? "demo-badge demo-badge--warn"
+                      : "demo-badge demo-badge--ok"
+                  }
+                >
+                  Estado: {viewModel.organization.tenantState}
+                </span>
+                <span className="demo-badge demo-badge--info">
+                  Papel simulado: {viewModel.organization.activeRole}
+                </span>
+              </div>
+              <h1 id="active-org-heading">
+                {viewModel.organization.displayName} —{" "}
+                <span className="hl">{sectionTitle(activeSection)}</span>
+              </h1>
+              <div className="org-meta-row">
+                <span>{viewModel.organization.legalName}</span>
+                <span>·</span>
+                <span>Plano: {viewModel.organization.planName}</span>
+                <span>·</span>
+                <span>Sessão mockada: {viewModel.organization.activeUserLabel}</span>
+              </div>
+            </div>
 
-        {viewModel.variant === "empty" ? (
-          <section className="state-box" aria-labelledby="empty-state-heading">
-            <h2 id="empty-state-heading">Nenhum departamento ativo para exibir</h2>
-            <p style={{ color: "var(--text-secondary)" }}>{viewModel.emptyStateMessage}</p>
-            <button
-              type="button"
-              className="btn btn--secondary"
-              onClick={() => {
-                setVariant("ready");
-              }}
+            <div
+              className="org-meta-row"
+              style={{ flexDirection: "column", alignItems: "flex-end" }}
             >
-              Restaurar fixtures povoadas (Normal)
-            </button>
+              <span>Origem: fixtures locais tipadas</span>
+              <span>{viewModel.organization.lastSyncLabel}</span>
+            </div>
           </section>
-        ) : null}
 
-        {viewModel.variant === "error" && viewModel.errorDetails ? (
-          <section
-            className="state-box state-box--error"
-            role="alert"
-            aria-labelledby="error-state-heading"
-          >
-            <div className="org-meta-row" style={{ marginBottom: "0.5rem" }}>
-              <span className="demo-badge demo-badge--danger">
-                HTTP {viewModel.errorDetails.httpStatus}
-              </span>
-              <code>{viewModel.errorDetails.code}</code>
-            </div>
-            <h2 id="error-state-heading">{viewModel.errorDetails.title}</h2>
-            <p style={{ color: "var(--text-primary)" }}>{viewModel.errorDetails.userMessage}</p>
-            <p
-              style={{
-                fontSize: "0.84rem",
-                color: "var(--text-secondary)",
-              }}
-            >
-              Código de correlação para suporte: <code>{viewModel.errorDetails.correlationId}</code>{" "}
-              (detalhes internos ocultados por segurança conforme diretriz de WEB-002).
-            </p>
-            <button
-              type="button"
-              className="btn btn--secondary"
-              onClick={() => {
-                setVariant("ready");
-              }}
+          {viewModel.organization.securityBanner && viewModel.variant === "ready" ? (
+            <section className="security-banner" aria-label="Alerta recente de segurança do tenant">
+              <strong>Segurança do tenant:</strong> {viewModel.organization.securityBanner}
+            </section>
+          ) : null}
+
+          {viewModel.variant === "loading" ? (
+            <section
+              className="state-box"
+              role="status"
+              aria-live="polite"
+              aria-labelledby="loading-state-heading"
             >
-              Tentar novamente (Voltar ao estado Normal)
-            </button>
-          </section>
-        ) : null}
-
-        {viewModel.variant === "ready" ? (
-          <>
-            <section aria-labelledby="metrics-summary-heading">
-              <h2
-                id="metrics-summary-heading"
-                style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
-              >
-                Indicadores Operacionais da Organização
+              <h2 id="loading-state-heading">
+                Sincronizando departamentos e agentes (simulação de carregamento)
               </h2>
-              <div className="kpi-grid">
-                <div className="kpi-card">
-                  <span className="kpi-card__label">Departamentos Ativos</span>
-                  <span className="kpi-card__value">{viewModel.metrics.totalFloors}</span>
-                  <span className="kpi-card__detail">Módulos contratados na organização</span>
-                </div>
-
-                <div className="kpi-card">
-                  <span className="kpi-card__label">Agentes de IA</span>
-                  <span className="kpi-card__value">
-                    {viewModel.metrics.executingAgents} / {viewModel.metrics.totalAgents}
-                  </span>
-                  <span className="kpi-card__detail">
-                    Em execução agora ({viewModel.metrics.awaitingApprovalAgents} aguardando humano)
-                  </span>
-                </div>
-
-                <div className="kpi-card">
-                  <span className="kpi-card__label">Tarefas Ativas &amp; Fila</span>
-                  <span className="kpi-card__value">{viewModel.metrics.activeTasksCount}</span>
-                  <span className="kpi-card__detail">Jobs em andamento ou aguardando</span>
-                </div>
-
-                <div className="kpi-card">
-                  <span className="kpi-card__label">Aprovações Pendentes</span>
-                  <span className="kpi-card__value">{viewModel.metrics.pendingApprovalsCount}</span>
-                  <span className="kpi-card__detail">Requerem decisão humana (HITL)</span>
-                </div>
-
-                <div className="kpi-card">
-                  <span className="kpi-card__label">Orçamento Mensal de IA</span>
-                  <span className="kpi-card__value">
-                    {viewModel.metrics.totalBudget.percentage}%
-                  </span>
-                  <span className="kpi-card__detail">
-                    R$ {viewModel.metrics.totalBudget.spentBrl} / R${" "}
-                    {viewModel.metrics.totalBudget.limitBrl} (
-                    {viewModel.metrics.budgetAlertFloorsCount} depto(s) em alerta)
-                  </span>
-                </div>
-              </div>
+              <p style={{ color: "var(--text-secondary)" }}>
+                Aguardando leitura agregada das fixtures de{" "}
+                <strong>{viewModel.organization.displayName}</strong>. Nenhum dado parcial ou de
+                outra organização é exibido durante a transição.
+              </p>
+              <button
+                type="button"
+                className="btn btn--secondary"
+                onClick={() => {
+                  setVariant("ready");
+                }}
+              >
+                Concluir carregamento simulado
+              </button>
             </section>
-
-            {activeSection === "overview" || activeSection === "building" ? (
-              <BuildingFloorMap
-                floors={viewModel.floors}
-                selectedFloor={viewModel.selectedFloor}
-                filteredAgents={viewModel.filteredAgents}
-                isProvisioning={viewModel.organization.isProvisioning}
-                agentQuery={agentQuery}
-                onSelectFloor={(floorId) => {
-                  setSelectedFloorId(floorId);
+          ) : null}
+
+          {viewModel.variant === "empty" ? (
+            <section className="state-box" aria-labelledby="empty-state-heading">
+              <h2 id="empty-state-heading">Nenhum departamento ativo para exibir</h2>
+              <p style={{ color: "var(--text-secondary)" }}>{viewModel.emptyStateMessage}</p>
+              <button
+                type="button"
+                className="btn btn--secondary"
+                onClick={() => {
+                  setVariant("ready");
                 }}
-                onChangeAgentQuery={(q) => {
-                  setAgentQuery(q);
+              >
+                Restaurar fixtures povoadas (normal)
+              </button>
+            </section>
+          ) : null}
+
+          {viewModel.variant === "error" && viewModel.errorDetails ? (
+            <section
+              className="state-box state-box--error"
+              role="alert"
+              aria-labelledby="error-state-heading"
+            >
+              <div className="org-meta-row" style={{ marginBottom: "0.5rem" }}>
+                <span className="demo-badge demo-badge--danger">
+                  HTTP {viewModel.errorDetails.httpStatus}
+                </span>
+                <code>{viewModel.errorDetails.code}</code>
+              </div>
+              <h2 id="error-state-heading">{viewModel.errorDetails.title}</h2>
+              <p style={{ color: "var(--text-primary)" }}>{viewModel.errorDetails.userMessage}</p>
+              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
+                Código de correlação para suporte:{" "}
+                <code>{viewModel.errorDetails.correlationId}</code> (detalhes internos ocultados por
+                segurança conforme diretriz de WEB-002).
+              </p>
+              <button
+                type="button"
+                className="btn btn--secondary"
+                onClick={() => {
+                  setVariant("ready");
                 }}
-              />
-            ) : null}
-
-            {activeSection === "overview" || activeSection === "operations" ? (
-              <OperationsPanels
-                approvals={viewModel.approvals}
-                tasks={viewModel.tasks}
-                floors={viewModel.floors}
-                recentActivity={viewModel.recentActivity}
-                canDecideApprovals={viewModel.organization.canDecideApprovals}
-                activeRoleLabel={viewModel.organization.activeRole}
-                decisions={decisions}
-                onDecideApproval={handleDecideApproval}
-              />
-            ) : null}
-
-            {activeSection === "overview" || activeSection === "chat" ? (
-              <AgentChatAndSecurityPanel />
-            ) : null}
-
-            {activeSection === "overview" || activeSection === "governance" ? (
-              <OrganizationGovernancePanel
-                orgSlug={viewModel.organization.slug}
-                activeRole={viewModel.organization.activeRole}
-                canMutateGovernance={viewModel.organization.canDecideApprovals}
-              />
-            ) : null}
-
-            {activeSection === "overview" || activeSection === "auth" ? (
-              <AuthAndMultiOrgPanel />
-            ) : null}
-
-            {activeSection === "overview" || activeSection === "platform" ? (
-              <PlatformBackofficePanel />
-            ) : null}
-          </>
-        ) : null}
-      </main>
-
-      <footer className="shell-footer">
-        <strong>NÚCLEOS Enterprise — Interface Web Mockada (LOC-WEB-001 / EP-10 sem 3D)</strong>
-        {" · "}Esta entrega utiliza exclusivamente fixtures TypeScript locais para validar
-        navegação, acessibilidade, fluxos de autenticação/multi-org, chat com sanitização XSS,
-        governança/CSV e backoffice. Os tickets canônicos do EP-10 permanecem abertos aguardando
-        integração com o backend; a cena 3D (<code>WEB-005..007</code>) fica para sessão futura.
-      </footer>
+              >
+                Tentar novamente (voltar ao estado normal)
+              </button>
+            </section>
+          ) : null}
+
+          {viewModel.variant === "ready" ? (
+            <>
+              {activeSection === "overview" ? (
+                <OverviewPanel
+                  viewModel={viewModel}
+                  onOpenApprovals={() => {
+                    setActiveSection("operations");
+                  }}
+                  onOpenActivity={() => {
+                    setActiveSection("operations");
+                  }}
+                />
+              ) : null}
+
+              {activeSection === "building" ? (
+                <BuildingFloorMap
+                  floors={viewModel.floors}
+                  selectedFloor={viewModel.selectedFloor}
+                  filteredAgents={viewModel.filteredAgents}
+                  isProvisioning={viewModel.organization.isProvisioning}
+                  agentQuery={agentQuery}
+                  onSelectFloor={(floorId) => {
+                    setSelectedFloorId(floorId);
+                  }}
+                  onChangeAgentQuery={(q) => {
+                    setAgentQuery(q);
+                  }}
+                />
+              ) : null}
+
+              {activeSection === "operations" ? (
+                <>
+                  <MetricsGrid metrics={viewModel.metrics} />
+                  <OperationsPanels
+                    approvals={viewModel.approvals}
+                    tasks={viewModel.tasks}
+                    floors={viewModel.floors}
+                    recentActivity={viewModel.recentActivity}
+                    canDecideApprovals={viewModel.organization.canDecideApprovals}
+                    activeRoleLabel={viewModel.organization.activeRole}
+                    decisions={decisions}
+                    onDecideApproval={handleDecideApproval}
+                  />
+                </>
+              ) : null}
+
+              {activeSection === "chat" ? <AgentChatAndSecurityPanel /> : null}
+
+              {activeSection === "governance" ? (
+                <OrganizationGovernancePanel
+                  orgSlug={viewModel.organization.slug}
+                  activeRole={viewModel.organization.activeRole}
+                  canMutateGovernance={viewModel.organization.canDecideApprovals}
+                />
+              ) : null}
+
+              {activeSection === "auth" ? <AuthAndMultiOrgPanel /> : null}
+
+              {activeSection === "platform" ? <PlatformBackofficePanel /> : null}
+            </>
+          ) : null}
+        </main>
+
+        <footer className="shell-footer">
+          <strong>NÚCLEOS Enterprise — Interface Web Mockada (LOC-WEB-001 / EP-10 sem 3D)</strong>
+          {" · "}Esta entrega utiliza exclusivamente fixtures TypeScript locais para validar
+          navegação, acessibilidade, fluxos de autenticação/multi-org, chat com sanitização XSS,
+          governança/CSV e backoffice. Os tickets canônicos do EP-10 permanecem abertos aguardando
+          integração com o backend; a cena 3D (<code>WEB-005..007</code>) fica para sessão futura.
+        </footer>
+      </div>
     </div>
   );
 }
diff --git a/apps/web/app/globals.css b/apps/web/app/globals.css
index 1adcbd0..a0e8c70 100644
--- a/apps/web/app/globals.css
+++ b/apps/web/app/globals.css
@@ -1,27 +1,108 @@
+/*
+ * Tokens de design NUCLEOS (v6 "Pinho"): preto esverdeado, verde como cor de
+ * marca e verde neon apenas para chamar atencao. Escuro e o padrao; o claro e
+ * ativado por `data-theme="light"` ou, sem preferencia salva, por
+ * `prefers-color-scheme: light`.
+ */
 :root {
-  --bg-canvas: #0b1020;
-  --bg-surface: #121a2f;
-  --bg-elevated: #18233f;
-  --bg-interactive: #1f2d52;
-  --border-subtle: #2a3b68;
-  --border-strong: #4762a6;
-  --text-primary: #f4f7ff;
-  --text-secondary: #c3d0f0;
-  --text-muted: #93a6d4;
-  --accent-primary: #5ea0ff;
-  --accent-focus: #ffd166;
-  --status-ok-bg: #0f3828;
-  --status-ok-text: #6ee7b7;
-  --status-ok-border: #10b981;
-  --status-warn-bg: #3f2e0e;
-  --status-warn-text: #fde68a;
-  --status-warn-border: #f59e0b;
-  --status-danger-bg: #451520;
-  --status-danger-text: #fda4af;
-  --status-danger-border: #f43f5e;
-  --status-info-bg: #132c52;
-  --status-info-text: #93c5fd;
-  --status-info-border: #3b82f6;
+  color-scheme: dark;
+  --bg-canvas: #0f1311;
+  --bg-side: #0b0e0c;
+  --bg-surface: #161b18;
+  --bg-elevated: #1b221e;
+  --bg-interactive: #232b26;
+  --border-subtle: #262d29;
+  --border-strong: #3a443e;
+  --text-primary: #e8ece8;
+  --text-secondary: #b3bdb7;
+  --text-muted: #8a968f;
+  --brand: #1e5b40;
+  --brand-text: #ffffff;
+  --accent-primary: #4cb07f;
+  --accent-focus: #3dff8e;
+  --attn: #3dff8e;
+  --attn-glow: rgba(61, 255, 142, 0.55);
+  --status-ok-bg: #12301f;
+  --status-ok-text: #7be3a8;
+  --status-ok-border: #2e9e68;
+  --status-warn-bg: #3a2a0c;
+  --status-warn-text: #f3d58a;
+  --status-warn-border: #d99a1a;
+  --status-danger-bg: #3e1620;
+  --status-danger-text: #f9a8b6;
+  --status-danger-border: #e5546c;
+  --status-info-bg: #14283f;
+  --status-info-text: #9cc4f2;
+  --status-info-border: #3f7fc4;
+  --font-sans:
+    "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
+  --font-mono: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, Consolas, monospace;
+}
+
+html[data-theme="light"] {
+  color-scheme: light;
+  --bg-canvas: #f3f6f4;
+  --bg-side: #eaefec;
+  --bg-surface: #ffffff;
+  --bg-elevated: #f0f4f1;
+  --bg-interactive: #e3eae6;
+  --border-subtle: #d6ded9;
+  --border-strong: #aebbb4;
+  --text-primary: #111613;
+  --text-secondary: #3a453f;
+  --text-muted: #56635b;
+  --brand: #1e6b4a;
+  --brand-text: #ffffff;
+  --accent-primary: #1e6b4a;
+  --accent-focus: #0b6b3f;
+  --attn: #0a7a45;
+  --attn-glow: rgba(10, 122, 69, 0.35);
+  --status-ok-bg: #e2f4ea;
+  --status-ok-text: #14633f;
+  --status-ok-border: #2e9e68;
+  --status-warn-bg: #fff3dc;
+  --status-warn-text: #7a4a00;
+  --status-warn-border: #d98a00;
+  --status-danger-bg: #fde7ea;
+  --status-danger-text: #9b1c31;
+  --status-danger-border: #d33a55;
+  --status-info-bg: #e4eef9;
+  --status-info-text: #1d4e89;
+  --status-info-border: #3b7ac8;
+}
+
+@media (prefers-color-scheme: light) {
+  html:not([data-theme]) {
+    color-scheme: light;
+    --bg-canvas: #f3f6f4;
+    --bg-side: #eaefec;
+    --bg-surface: #ffffff;
+    --bg-elevated: #f0f4f1;
+    --bg-interactive: #e3eae6;
+    --border-subtle: #d6ded9;
+    --border-strong: #aebbb4;
+    --text-primary: #111613;
+    --text-secondary: #3a453f;
+    --text-muted: #56635b;
+    --brand: #1e6b4a;
+    --brand-text: #ffffff;
+    --accent-primary: #1e6b4a;
+    --accent-focus: #0b6b3f;
+    --attn: #0a7a45;
+    --attn-glow: rgba(10, 122, 69, 0.35);
+    --status-ok-bg: #e2f4ea;
+    --status-ok-text: #14633f;
+    --status-ok-border: #2e9e68;
+    --status-warn-bg: #fff3dc;
+    --status-warn-text: #7a4a00;
+    --status-warn-border: #d98a00;
+    --status-danger-bg: #fde7ea;
+    --status-danger-text: #9b1c31;
+    --status-danger-border: #d33a55;
+    --status-info-bg: #e4eef9;
+    --status-info-text: #1d4e89;
+    --status-info-border: #3b7ac8;
+  }
 }
 
 *,
@@ -36,16 +117,16 @@ body {
   padding: 0;
   background-color: var(--bg-canvas);
   color: var(--text-primary);
-  font-family:
-    system-ui,
-    -apple-system,
-    BlinkMacSystemFont,
-    "Segoe UI",
-    Roboto,
-    sans-serif;
+  font-family: var(--font-sans);
+  font-size: 15px;
   line-height: 1.5;
 }
 
+a {
+  color: var(--accent-primary);
+  text-decoration: none;
+}
+
 .skip-link {
   position: absolute;
   top: -3rem;
@@ -53,9 +134,9 @@ body {
   z-index: 1000;
   padding: 0.5rem 1rem;
   background: var(--accent-focus);
-  color: #0b1020;
+  color: var(--bg-canvas);
   font-weight: 700;
-  border-radius: 0.375rem;
+  border-radius: 0.5rem;
   text-decoration: none;
 }
 
@@ -67,98 +148,214 @@ button:focus-visible,
 select:focus-visible,
 input:focus-visible,
 a:focus-visible {
-  outline: 3px solid var(--accent-focus);
+  outline: 2px solid var(--accent-focus);
   outline-offset: 2px;
 }
 
-.demo-banner {
-  background: linear-gradient(90deg, #3b2807 0%, #4b1d1d 100%);
-  border-bottom: 2px solid var(--status-warn-border);
-  color: var(--status-warn-text);
-  padding: 0.65rem 1.25rem;
-  font-size: 0.875rem;
+/* ---------- Estrutura: menu lateral + conteudo ---------- */
+
+.app-shell {
+  display: grid;
+  grid-template-columns: 232px minmax(0, 1fr);
+  min-height: 100vh;
+}
+
+@media (max-width: 860px) {
+  .app-shell {
+    grid-template-columns: minmax(0, 1fr);
+  }
+}
+
+.sidebar {
+  position: sticky;
+  top: 0;
+  align-self: start;
+  height: 100vh;
+  overflow-y: auto;
+  background: var(--bg-side);
+  border-right: 1px solid var(--border-subtle);
+  padding: 1rem 0.65rem;
+  display: flex;
+  flex-direction: column;
+  gap: 0.9rem;
+}
+
+@media (max-width: 860px) {
+  .sidebar {
+    position: static;
+    height: auto;
+    border-right: none;
+    border-bottom: 1px solid var(--border-subtle);
+  }
+}
+
+.brand-block {
   display: flex;
-  flex-wrap: wrap;
   align-items: center;
-  justify-content: space-between;
-  gap: 0.75rem;
+  gap: 0.6rem;
+  padding: 0 0.4rem;
 }
 
-.demo-badge {
+.brand-mark {
+  width: 24px;
+  height: 24px;
+  border-radius: 7px;
+  background: var(--brand);
+  color: var(--attn);
   display: inline-flex;
   align-items: center;
-  gap: 0.35rem;
-  padding: 0.2rem 0.6rem;
-  border-radius: 999px;
-  font-size: 0.75rem;
+  justify-content: center;
+  font-size: 0.8rem;
+  font-weight: 800;
+}
+
+.brand-title {
+  font-size: 0.95rem;
   font-weight: 700;
+  letter-spacing: 0.01em;
+  color: var(--text-primary);
+}
+
+.brand-subtitle {
+  font-size: 0.72rem;
+  color: var(--text-muted);
+}
+
+.side-group {
+  display: flex;
+  flex-direction: column;
+  gap: 1px;
+}
+
+.side-group__title {
+  margin: 0;
+  padding: 0 0.65rem 0.25rem;
+  font-size: 0.66rem;
+  font-weight: 600;
+  letter-spacing: 0.08em;
   text-transform: uppercase;
-  letter-spacing: 0.04em;
+  color: var(--text-muted);
 }
 
-.demo-badge--warn {
-  background: var(--status-warn-bg);
-  color: var(--status-warn-text);
-  border: 1px solid var(--status-warn-border);
+.side-org {
+  display: flex;
+  flex-direction: column;
+  gap: 0.25rem;
+  padding: 0.5rem 0.65rem;
+  background: var(--bg-surface);
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.65rem;
 }
 
-.demo-badge--ok {
-  background: var(--status-ok-bg);
-  color: var(--status-ok-text);
-  border: 1px solid var(--status-ok-border);
+.side-org label {
+  font-size: 0.66rem;
+  color: var(--text-muted);
 }
 
-.demo-badge--danger {
-  background: var(--status-danger-bg);
-  color: var(--status-danger-text);
-  border: 1px solid var(--status-danger-border);
+.side-org select {
+  background: transparent;
+  color: var(--text-primary);
+  border: none;
+  padding: 0;
+  font-size: 0.8rem;
+  font-weight: 500;
+  font-family: inherit;
+  width: 100%;
 }
 
-.demo-badge--info {
-  background: var(--status-info-bg);
-  color: var(--status-info-text);
-  border: 1px solid var(--status-info-border);
+.nav-button {
+  display: flex;
+  align-items: center;
+  gap: 0.6rem;
+  width: 100%;
+  min-height: 32px;
+  padding: 0 0.65rem;
+  background: transparent;
+  color: var(--text-secondary);
+  border: 1px solid transparent;
+  border-radius: 0.55rem;
+  font-family: inherit;
+  font-size: 0.8rem;
+  font-weight: 500;
+  text-align: left;
+  cursor: pointer;
 }
 
-.shell-header {
+.nav-button:hover {
+  background: var(--bg-interactive);
+  color: var(--text-primary);
+}
+
+.nav-button[aria-current="page"] {
+  background: var(--brand);
+  color: var(--brand-text);
+}
+
+.nav-code {
+  flex: 0 0 20px;
+  width: 20px;
+  height: 20px;
+  border-radius: 6px;
   background: var(--bg-surface);
-  border-bottom: 1px solid var(--border-subtle);
-  padding: 1rem 1.25rem;
+  border: 1px solid var(--border-subtle);
+  color: var(--text-muted);
+  font-size: 0.56rem;
+  font-weight: 700;
+  display: inline-flex;
+  align-items: center;
+  justify-content: center;
 }
 
-.shell-header__inner {
-  max-width: 1360px;
-  margin: 0 auto;
+.nav-button[aria-current="page"] .nav-code {
+  background: rgba(255, 255, 255, 0.16);
+  border-color: transparent;
+  color: var(--brand-text);
+}
+
+.app-content {
+  min-width: 0;
+  display: flex;
+  flex-direction: column;
+}
+
+.demo-banner {
+  background: var(--bg-side);
+  border-bottom: 1px solid var(--border-subtle);
+  color: var(--text-muted);
+  padding: 0.35rem 1.5rem;
+  font-size: 0.72rem;
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   justify-content: space-between;
-  gap: 1rem;
+  gap: 0.5rem;
 }
 
-.brand-block {
-  display: flex;
-  flex-direction: column;
-  gap: 0.25rem;
+.demo-banner strong {
+  color: var(--text-secondary);
 }
 
-.brand-title {
-  font-size: 1.15rem;
-  font-weight: 800;
-  letter-spacing: 0.04em;
-  color: var(--text-primary);
+.topbar {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  justify-content: flex-end;
+  gap: 0.75rem;
+  padding: 0.6rem 1.5rem;
+  border-bottom: 1px solid var(--border-subtle);
 }
 
-.brand-subtitle {
-  font-size: 0.82rem;
-  color: var(--text-secondary);
+.topbar__title {
+  margin-right: auto;
+  font-size: 0.8rem;
+  color: var(--text-muted);
 }
 
 .controls-bar {
   display: flex;
   flex-wrap: wrap;
-  align-items: flex-end;
-  gap: 0.85rem;
+  align-items: center;
+  gap: 0.75rem;
 }
 
 .control-group {
@@ -168,91 +365,120 @@ a:focus-visible {
 }
 
 .control-group label {
-  font-size: 0.75rem;
+  font-size: 0.72rem;
   font-weight: 600;
   color: var(--text-secondary);
 }
 
 .control-select,
 .control-input {
-  background: var(--bg-elevated);
+  background: var(--bg-surface);
   color: var(--text-primary);
   border: 1px solid var(--border-strong);
-  border-radius: 0.375rem;
-  padding: 0.45rem 0.65rem;
-  font-size: 0.875rem;
-}
-
-.shell-nav {
-  background: var(--bg-elevated);
-  border-bottom: 1px solid var(--border-subtle);
-  padding: 0.5rem 1.25rem;
+  border-radius: 0.55rem;
+  padding: 0.4rem 0.65rem;
+  font-size: 0.8rem;
+  font-family: inherit;
 }
 
-.shell-nav__list {
-  max-width: 1360px;
-  margin: 0 auto;
-  padding: 0;
-  list-style: none;
-  display: flex;
-  flex-wrap: wrap;
-  gap: 0.5rem;
+.theme-toggle {
+  display: inline-flex;
+  padding: 2px;
+  background: var(--bg-surface);
+  border: 1px solid var(--border-subtle);
+  border-radius: 999px;
 }
 
-.nav-button {
+.theme-toggle button {
+  min-height: 28px;
+  padding: 0 0.75rem;
   background: transparent;
   color: var(--text-secondary);
-  border: 1px solid transparent;
-  border-radius: 0.375rem;
-  padding: 0.45rem 0.85rem;
-  font-size: 0.875rem;
+  border: none;
+  border-radius: 999px;
+  font-family: inherit;
+  font-size: 0.74rem;
   font-weight: 600;
   cursor: pointer;
 }
 
-.nav-button:hover {
-  background: var(--bg-interactive);
-  color: var(--text-primary);
-}
-
-.nav-button[aria-current="page"] {
-  background: var(--bg-interactive);
-  color: var(--text-primary);
-  border-color: var(--accent-primary);
+.theme-toggle button[aria-pressed="true"] {
+  background: var(--brand);
+  color: var(--brand-text);
 }
 
 .shell-main {
-  max-width: 1360px;
+  width: 100%;
+  max-width: 1280px;
   margin: 0 auto;
-  padding: 1.5rem 1.25rem 3rem;
+  padding: 1.25rem 1.5rem 2rem;
   display: flex;
   flex-direction: column;
-  gap: 1.5rem;
+  gap: 1rem;
+}
+
+/* ---------- Componentes ---------- */
+
+.demo-badge {
+  display: inline-flex;
+  align-items: center;
+  gap: 0.35rem;
+  padding: 0.12rem 0.55rem;
+  border-radius: 999px;
+  font-size: 0.68rem;
+  font-weight: 600;
+  letter-spacing: 0.02em;
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
 }
 
 .org-hero {
-  background: var(--bg-surface);
-  border: 1px solid var(--border-subtle);
-  border-radius: 0.65rem;
-  padding: 1.25rem;
   display: flex;
   flex-wrap: wrap;
   justify-content: space-between;
-  align-items: flex-start;
-  gap: 1rem;
+  align-items: flex-end;
+  gap: 0.75rem;
 }
 
 .org-hero h1 {
-  margin: 0 0 0.35rem;
+  margin: 0.15rem 0 0.25rem;
   font-size: 1.5rem;
+  line-height: 1.25;
+  letter-spacing: -0.02em;
+}
+
+.org-hero h1 .hl {
+  color: var(--accent-primary);
 }
 
 .org-meta-row {
   display: flex;
   flex-wrap: wrap;
-  gap: 0.5rem;
+  gap: 0.4rem;
   align-items: center;
-  font-size: 0.85rem;
+  font-size: 0.78rem;
   color: var(--text-secondary);
 }
 
@@ -260,48 +486,68 @@ a:focus-visible {
   background: var(--status-warn-bg);
   border: 1px solid var(--status-warn-border);
   color: var(--status-warn-text);
-  border-radius: 0.5rem;
-  padding: 0.75rem 1rem;
-  font-size: 0.875rem;
+  border-radius: 0.75rem;
+  padding: 0.6rem 0.9rem;
+  font-size: 0.82rem;
 }
 
 .kpi-grid {
   display: grid;
-  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
-  gap: 1rem;
+  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
+  gap: 0.75rem;
 }
 
 .kpi-card {
   background: var(--bg-surface);
   border: 1px solid var(--border-subtle);
-  border-radius: 0.6rem;
-  padding: 1rem;
+  border-radius: 0.9rem;
+  padding: 0.85rem 1rem;
   display: flex;
   flex-direction: column;
-  gap: 0.35rem;
+  gap: 0.25rem;
+}
+
+.kpi-card--attn {
+  border-color: var(--attn);
 }
 
 .kpi-card__label {
-  font-size: 0.8rem;
+  font-size: 0.76rem;
   color: var(--text-secondary);
-  font-weight: 600;
+  font-weight: 500;
 }
 
 .kpi-card__value {
-  font-size: 1.65rem;
-  font-weight: 800;
+  font-size: 1.6rem;
+  font-weight: 600;
+  letter-spacing: -0.01em;
   color: var(--text-primary);
 }
 
+.kpi-card--attn .kpi-card__value {
+  color: var(--attn);
+}
+
 .kpi-card__detail {
-  font-size: 0.8rem;
+  font-family: var(--font-mono);
+  font-size: 0.68rem;
   color: var(--text-muted);
 }
 
+.attn-dot {
+  display: inline-block;
+  width: 8px;
+  height: 8px;
+  margin-right: 0.4rem;
+  border-radius: 50%;
+  background: var(--attn);
+  box-shadow: 0 0 8px var(--attn-glow);
+}
+
 .building-layout {
   display: grid;
   grid-template-columns: minmax(300px, 420px) 1fr;
-  gap: 1.25rem;
+  gap: 1rem;
   align-items: start;
 }
 
@@ -314,8 +560,13 @@ a:focus-visible {
 .panel-card {
   background: var(--bg-surface);
   border: 1px solid var(--border-subtle);
-  border-radius: 0.65rem;
-  padding: 1.25rem;
+  border-radius: 0.9rem;
+  padding: 1rem;
+}
+
+.panel-card h2,
+.panel-card h3 {
+  font-size: 0.95rem;
 }
 
 .panel-header {
@@ -323,8 +574,8 @@ a:focus-visible {
   flex-wrap: wrap;
   align-items: center;
   justify-content: space-between;
-  gap: 0.75rem;
-  margin-bottom: 1rem;
+  gap: 0.6rem;
+  margin-bottom: 0.75rem;
 }
 
 .panel-header h2,
@@ -332,26 +583,54 @@ a:focus-visible {
   margin: 0;
 }
 
+.row-list {
+  list-style: none;
+  margin: 0;
+  padding: 0;
+}
+
+.row-list > li {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  gap: 0.6rem;
+  min-height: 40px;
+  padding: 0.35rem 0;
+  border-top: 1px solid var(--border-subtle);
+  font-size: 0.84rem;
+}
+
+.row-list__main {
+  flex: 1 1 200px;
+  min-width: 0;
+}
+
+.row-list__time {
+  font-family: var(--font-mono);
+  font-size: 0.68rem;
+  color: var(--text-muted);
+}
+
 .building-stack {
   display: flex;
   flex-direction: column;
-  gap: 0.6rem;
-  padding: 0.85rem;
-  background: #090e1c;
+  gap: 0.5rem;
+  padding: 0.7rem;
+  background: var(--bg-canvas);
   border: 1px solid var(--border-strong);
-  border-radius: 0.5rem;
+  border-radius: 0.75rem;
 }
 
 .building-roof {
   text-align: center;
-  font-size: 0.75rem;
+  font-size: 0.68rem;
   font-weight: 700;
   letter-spacing: 0.06em;
   text-transform: uppercase;
   color: var(--text-secondary);
-  padding: 0.4rem;
+  padding: 0.35rem;
   background: var(--bg-elevated);
-  border-radius: 0.375rem 0.375rem 0 0;
+  border-radius: 0.5rem 0.5rem 0 0;
   border-bottom: 2px solid var(--accent-primary);
 }
 
@@ -360,14 +639,17 @@ a:focus-visible {
   text-align: left;
   background: var(--bg-surface);
   color: var(--text-primary);
-  border: 2px solid var(--border-subtle);
-  border-radius: 0.45rem;
-  padding: 0.8rem;
+  border: 1px solid var(--border-subtle);
+  border-radius: 0.7rem;
+  padding: 0.7rem;
   cursor: pointer;
   display: flex;
   flex-direction: column;
-  gap: 0.45rem;
-  transition: border-color 0.15s ease, background-color 0.15s ease;
+  gap: 0.4rem;
+  font-family: inherit;
+  transition:
+    border-color 0.15s ease,
+    background-color 0.15s ease;
 }
 
 .floor-button:hover {
@@ -377,7 +659,7 @@ a:focus-visible {
 
 .floor-button[aria-pressed="true"] {
   background: var(--bg-interactive);
-  border-color: var(--accent-focus);
+  border-color: var(--attn);
 }
 
 .floor-button__top {
@@ -390,13 +672,13 @@ a:focus-visible {
 .floor-windows {
   display: flex;
   flex-wrap: wrap;
-  gap: 0.4rem;
+  gap: 0.35rem;
 }
 
 .window-pill {
-  font-size: 0.75rem;
-  padding: 0.15rem 0.5rem;
-  border-radius: 0.25rem;
+  font-size: 0.7rem;
+  padding: 0.1rem 0.5rem;
+  border-radius: 999px;
   background: var(--bg-canvas);
   border: 1px solid var(--border-subtle);
   color: var(--text-secondary);
@@ -405,23 +687,23 @@ a:focus-visible {
 .agent-grid {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
-  gap: 0.9rem;
-  margin-top: 1rem;
+  gap: 0.75rem;
+  margin-top: 0.85rem;
 }
 
 .agent-card {
   background: var(--bg-elevated);
   border: 1px solid var(--border-subtle);
-  border-radius: 0.5rem;
-  padding: 0.95rem;
+  border-radius: 0.75rem;
+  padding: 0.8rem;
   display: flex;
   flex-direction: column;
-  gap: 0.5rem;
+  gap: 0.4rem;
 }
 
 .progress-track {
   width: 100%;
-  height: 0.5rem;
+  height: 0.4rem;
   background: var(--bg-canvas);
   border-radius: 999px;
   overflow: hidden;
@@ -444,7 +726,7 @@ a:focus-visible {
 .two-col-grid {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
-  gap: 1.25rem;
+  gap: 1rem;
 }
 
 .item-list {
@@ -453,17 +735,17 @@ a:focus-visible {
   margin: 0;
   display: flex;
   flex-direction: column;
-  gap: 0.75rem;
+  gap: 0.6rem;
 }
 
 .item-card {
   background: var(--bg-elevated);
   border: 1px solid var(--border-subtle);
-  border-radius: 0.5rem;
-  padding: 0.95rem;
+  border-radius: 0.75rem;
+  padding: 0.8rem;
   display: flex;
   flex-direction: column;
-  gap: 0.5rem;
+  gap: 0.4rem;
 }
 
 .action-row {
@@ -471,14 +753,15 @@ a:focus-visible {
   flex-wrap: wrap;
   gap: 0.5rem;
   align-items: center;
-  margin-top: 0.35rem;
+  margin-top: 0.3rem;
 }
 
 .btn {
-  padding: 0.45rem 0.85rem;
-  border-radius: 0.375rem;
-  font-size: 0.82rem;
-  font-weight: 700;
+  padding: 0.35rem 0.85rem;
+  border-radius: 999px;
+  font-family: inherit;
+  font-size: 0.78rem;
+  font-weight: 600;
   cursor: pointer;
   border: 1px solid transparent;
 }
@@ -496,17 +779,21 @@ a:focus-visible {
 }
 
 .btn--secondary {
-  background: var(--bg-interactive);
+  background: transparent;
   color: var(--text-primary);
   border-color: var(--border-strong);
 }
 
+.btn--secondary:hover {
+  border-color: var(--accent-primary);
+}
+
 .code-preview {
-  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
-  font-size: 0.78rem;
+  font-family: var(--font-mono);
+  font-size: 0.74rem;
   background: var(--bg-canvas);
-  padding: 0.45rem 0.65rem;
-  border-radius: 0.35rem;
+  padding: 0.4rem 0.6rem;
+  border-radius: 0.5rem;
   border: 1px solid var(--border-subtle);
   overflow-x: auto;
   color: var(--text-secondary);
@@ -514,21 +801,21 @@ a:focus-visible {
 
 .state-box {
   background: var(--bg-surface);
-  border: 2px solid var(--border-strong);
-  border-radius: 0.65rem;
-  padding: 1.75rem;
+  border: 1px solid var(--border-strong);
+  border-radius: 0.9rem;
+  padding: 1.5rem;
 }
 
 .state-box--error {
   border-color: var(--status-danger-border);
-  background: #22111b;
+  background: var(--status-danger-bg);
 }
 
 .shell-footer {
-  max-width: 1360px;
+  max-width: 1280px;
   margin: 0 auto;
-  padding: 1.25rem;
+  padding: 1rem 1.5rem 1.5rem;
   border-top: 1px solid var(--border-subtle);
   color: var(--text-muted);
-  font-size: 0.82rem;
+  font-size: 0.74rem;
 }
diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
index 0b16378..8568d7f 100644
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -1,4 +1,5 @@
 import type { ReactNode } from "react";
+import { buildThemeInitScript } from "../lib/theme.ts";
 import "./globals.css";
 
 export const metadata = {
@@ -9,7 +10,11 @@ export const metadata = {
 
 export default function RootLayout({ children }: { children: ReactNode }) {
   return (
-    <html lang="pt-BR">
+    // `data-theme` e aplicado antes da hidratacao pelo script abaixo.
+    <html lang="pt-BR" suppressHydrationWarning>
+      <head>
+        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
+      </head>
       <body>{children}</body>
     </html>
   );
```

## Arquivos novos (sem rastreio)

### `apps/web/app/components/OverviewPanel.tsx`

```diff
diff --git a/apps/web/app/components/OverviewPanel.tsx b/apps/web/app/components/OverviewPanel.tsx
new file mode 100644
index 0000000..061fe31
--- /dev/null
+++ b/apps/web/app/components/OverviewPanel.tsx
@@ -0,0 +1,98 @@
+import type { DashboardViewModel } from "../../lib/mock-types.ts";
+
+export interface OverviewPanelProps {
+  readonly viewModel: DashboardViewModel;
+  readonly onOpenApprovals: () => void;
+  readonly onOpenActivity: () => void;
+}
+
+const MAX_APPROVALS = 3;
+const MAX_ACTIVITY = 4;
+
+/** Painel inicial enxuto: so o essencial; os setores ficam no menu lateral. */
+export function OverviewPanel({ viewModel, onOpenApprovals, onOpenActivity }: OverviewPanelProps) {
+  const { metrics, approvals, recentActivity } = viewModel;
+  const hasPending = metrics.pendingApprovalsCount > 0;
+
+  return (
+    <>
+      <section aria-label="Indicadores essenciais">
+        <div className="kpi-grid">
+          <div className={hasPending ? "kpi-card kpi-card--attn" : "kpi-card"}>
+            <span className="kpi-card__label">
+              {hasPending ? <span className="attn-dot" aria-hidden="true" /> : null}
+              Decisões pendentes
+            </span>
+            <span className="kpi-card__value">{metrics.pendingApprovalsCount}</span>
+            <span className="kpi-card__detail">Requerem decisão humana</span>
+          </div>
+
+          <div className="kpi-card">
+            <span className="kpi-card__label">Agentes de IA em execução</span>
+            <span className="kpi-card__value">
+              {metrics.executingAgents} / {metrics.totalAgents}
+            </span>
+            <span className="kpi-card__detail">
+              {metrics.awaitingApprovalAgents} aguardando aprovação
+            </span>
+          </div>
+
+          <div className="kpi-card">
+            <span className="kpi-card__label">Orçamento mensal de IA</span>
+            <span className="kpi-card__value">{metrics.totalBudget.percentage}%</span>
+            <span className="kpi-card__detail">
+              R$ {metrics.totalBudget.spentBrl} / R$ {metrics.totalBudget.limitBrl}
+            </span>
+          </div>
+        </div>
+      </section>
+
+      <div className="two-col-grid">
+        <section className="panel-card" aria-labelledby="overview-approvals-heading">
+          <div className="panel-header">
+            <h2 id="overview-approvals-heading">Aguardam sua decisão</h2>
+            <button type="button" className="btn btn--secondary" onClick={onOpenApprovals}>
+              Ver todas
+            </button>
+          </div>
+          {approvals.length === 0 ? (
+            <p className="org-meta-row">Nenhuma decisão pendente.</p>
+          ) : (
+            <ul className="row-list">
+              {approvals.slice(0, MAX_APPROVALS).map((approval) => (
+                <li key={approval.id}>
+                  <span className="row-list__main">{approval.title}</span>
+                  <span className="demo-badge demo-badge--info">{approval.departmentName}</span>
+                  {approval.riskLevel === "high" ? (
+                    <span className="demo-badge demo-badge--danger">Risco alto</span>
+                  ) : null}
+                </li>
+              ))}
+            </ul>
+          )}
+        </section>
+
+        <section className="panel-card" aria-labelledby="overview-activity-heading">
+          <div className="panel-header">
+            <h2 id="overview-activity-heading">Atualizações</h2>
+            <button type="button" className="btn btn--secondary" onClick={onOpenActivity}>
+              Histórico
+            </button>
+          </div>
+          {recentActivity.length === 0 ? (
+            <p className="org-meta-row">Sem atividade recente.</p>
+          ) : (
+            <ul className="row-list">
+              {recentActivity.slice(0, MAX_ACTIVITY).map((item) => (
+                <li key={item.id}>
+                  <span className="row-list__time">{item.timestampLabel}</span>
+                  <span className="row-list__main">{item.summary}</span>
+                </li>
+              ))}
+            </ul>
+          )}
+        </section>
+      </div>
+    </>
+  );
+}
```

### `apps/web/app/components/ThemeToggle.tsx`

```diff
diff --git a/apps/web/app/components/ThemeToggle.tsx b/apps/web/app/components/ThemeToggle.tsx
new file mode 100644
index 0000000..b49d115
--- /dev/null
+++ b/apps/web/app/components/ThemeToggle.tsx
@@ -0,0 +1,60 @@
+"use client";
+
+import { useEffect, useState } from "react";
+import {
+  parseStoredTheme,
+  resolveEffectiveTheme,
+  THEME_STORAGE_KEY,
+  type ThemePreference,
+} from "../../lib/theme.ts";
+
+function readStoredTheme(): ThemePreference | null {
+  try {
+    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
+  } catch {
+    return null;
+  }
+}
+
+export function ThemeToggle() {
+  // `null` ate montar no cliente: evita divergencia de hidratacao com o tema salvo.
+  const [theme, setTheme] = useState<ThemePreference | null>(null);
+
+  useEffect(() => {
+    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
+    setTheme(resolveEffectiveTheme(readStoredTheme(), systemPrefersDark));
+  }, []);
+
+  function choose(next: ThemePreference): void {
+    setTheme(next);
+    document.documentElement.setAttribute("data-theme", next);
+    try {
+      window.localStorage.setItem(THEME_STORAGE_KEY, next);
+    } catch {
+      // Armazenamento indisponivel: o tema vale apenas nesta sessao.
+    }
+  }
+
+  return (
+    <div className="theme-toggle" role="group" aria-label="Tema da interface">
+      <button
+        type="button"
+        aria-pressed={theme === "dark"}
+        onClick={() => {
+          choose("dark");
+        }}
+      >
+        Escuro
+      </button>
+      <button
+        type="button"
+        aria-pressed={theme === "light"}
+        onClick={() => {
+          choose("light");
+        }}
+      >
+        Claro
+      </button>
+    </div>
+  );
+}
```

### `apps/web/app/theme.test.ts`

```diff
diff --git a/apps/web/app/theme.test.ts b/apps/web/app/theme.test.ts
new file mode 100644
index 0000000..69c892d
--- /dev/null
+++ b/apps/web/app/theme.test.ts
@@ -0,0 +1,37 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import vm from "node:vm";
+import {
+  buildThemeInitScript,
+  parseStoredTheme,
+  resolveEffectiveTheme,
+  THEME_STORAGE_KEY,
+} from "../lib/theme.ts";
+
+describe("Tema claro/escuro da interface web", () => {
+  test("THEME-01: aceita somente 'light' e 'dark' como preferencia salva", () => {
+    assert.equal(parseStoredTheme("light"), "light");
+    assert.equal(parseStoredTheme("dark"), "dark");
+    assert.equal(parseStoredTheme("system"), null);
+    assert.equal(parseStoredTheme("<script>"), null);
+    assert.equal(parseStoredTheme(""), null);
+    assert.equal(parseStoredTheme(null), null);
+    assert.equal(parseStoredTheme(undefined), null);
+  });
+
+  test("THEME-02: preferencia salva vence o sistema; sem ela, segue o sistema", () => {
+    assert.equal(resolveEffectiveTheme("light", true), "light");
+    assert.equal(resolveEffectiveTheme("dark", false), "dark");
+    assert.equal(resolveEffectiveTheme(null, true), "dark");
+    assert.equal(resolveEffectiveTheme(null, false), "light");
+  });
+
+  test("THEME-03: script de inicializacao usa a chave de armazenamento e tolera falhas", () => {
+    const script = buildThemeInitScript();
+    assert.ok(script.includes(JSON.stringify(THEME_STORAGE_KEY)));
+    assert.ok(script.startsWith("try{"));
+    assert.ok(script.endsWith("catch(e){}"));
+    // Compila sem executar: garante que o script inline e JavaScript valido.
+    assert.doesNotThrow(() => new vm.Script(script));
+  });
+});
```

### `apps/web/lib/theme.ts`

```diff
diff --git a/apps/web/lib/theme.ts b/apps/web/lib/theme.ts
new file mode 100644
index 0000000..7ea7ec7
--- /dev/null
+++ b/apps/web/lib/theme.ts
@@ -0,0 +1,34 @@
+/**
+ * Preferencia de tema (claro/escuro) da interface web.
+ *
+ * Funcoes puras, sem acesso a DOM ou `localStorage`, para poderem ser testadas
+ * no Node. A leitura/gravacao do navegador fica em `ThemeToggle.tsx` e no
+ * script de inicializacao gerado por `buildThemeInitScript`.
+ */
+
+export type ThemePreference = "light" | "dark";
+
+export const THEME_STORAGE_KEY = "nucleos-theme";
+
+export function parseStoredTheme(value: string | null | undefined): ThemePreference | null {
+  return value === "light" || value === "dark" ? value : null;
+}
+
+export function resolveEffectiveTheme(
+  stored: ThemePreference | null,
+  systemPrefersDark: boolean,
+): ThemePreference {
+  if (stored !== null) {
+    return stored;
+  }
+  return systemPrefersDark ? "dark" : "light";
+}
+
+/**
+ * Script inline executado antes da pintura para evitar o "flash" de tema.
+ * So aplica `data-theme` quando existe preferencia valida salva; sem ela, o CSS
+ * segue `prefers-color-scheme`. Qualquer falha de armazenamento e ignorada.
+ */
+export function buildThemeInitScript(): string {
+  return `try{var t=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}`;
+}
```
