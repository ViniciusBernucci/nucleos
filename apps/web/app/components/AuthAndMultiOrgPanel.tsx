"use client";

import { useState } from "react";
import { MOCK_SESSION_ACTORS, resolveTenantRouteAccess } from "../../lib/mock-enterprise-data.ts";

type AuthStepView = "login" | "mfa" | "forgot_password" | "verify_email" | "org_selector";

export function AuthAndMultiOrgPanel() {
  const [authStep, setAuthStep] = useState<AuthStepView>("org_selector");
  const [actorId, setActorId] = useState<string>(MOCK_SESSION_ACTORS[0]?.id ?? "usr-marina-01");
  const [requestedSlug, setRequestedSlug] = useState<string>("aurora-industrial");
  const [totpCode, setTotpCode] = useState<string>("482910");
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const activeActor =
    MOCK_SESSION_ACTORS.find((a) => a.id === actorId) ?? MOCK_SESSION_ACTORS[0] ?? null;

  const routeResolution = resolveTenantRouteAccess(activeActor, requestedSlug);

  return (
    <section className="panel-card" aria-labelledby="auth-multiorg-heading">
      <div className="panel-header">
        <div>
          <h2 id="auth-multiorg-heading">
            Autenticação, MFA &amp; Isolamento Multi-Organização (WEB-001 + WEB-002)
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
            }}
          >
            Simulação das rotas <code>/login</code>, <code>/mfa</code>,{" "}
            <code>/forgot-password</code>, <code>/verify-email</code> e <code>/orgs/[orgSlug]</code>
            . Nenhum token é gravado em <code>localStorage</code> ou <code>sessionStorage</code>.
          </p>
        </div>

        <div className="action-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setAuthStep("login");
            }}
          >
            /login
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setAuthStep("mfa");
            }}
          >
            /mfa
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setAuthStep("forgot_password");
            }}
          >
            /forgot-password
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setAuthStep("verify_email");
            }}
          >
            /verify-email
          </button>
          <button
            type="button"
            className="btn btn--approve"
            onClick={() => {
              setAuthStep("org_selector");
            }}
          >
            /orgs/[orgSlug] (Teste A/B 404)
          </button>
        </div>
      </div>

      {authStep === "login" ? (
        <div className="item-card">
          <h3>Simulação de /login (Credenciais Opacas + Redirecionamento MFA)</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Na arquitetura real (ADR-016), o Control Plane emite cookie{" "}
            <code>HttpOnly; Secure; SameSite=Lax</code> após o segundo fator.
          </p>
          <div className="action-row">
            <button
              type="button"
              className="btn btn--approve"
              onClick={() => {
                setAuthNotice(
                  "Credenciais primárias validadas; avançando para desafio TOTP (/mfa).",
                );
                setAuthStep("mfa");
              }}
            >
              Autenticar e avançar para /mfa
            </button>
          </div>
        </div>
      ) : null}

      {authStep === "mfa" ? (
        <div className="item-card">
          <h3>Simulação de /mfa (Segundo Fator TOTP Obrigatório)</h3>
          <div className="control-group" style={{ maxWidth: "240px" }}>
            <label htmlFor="mfa-totp-input">Código TOTP de 6 dígitos</label>
            <input
              id="mfa-totp-input"
              type="text"
              className="control-input"
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value);
              }}
            />
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn btn--approve"
              onClick={() => {
                setAuthNotice(
                  `Desafio MFA (${totpCode}) confirmado. Sessão ativa sem qualquer token em localStorage.`,
                );
                setAuthStep("org_selector");
              }}
            >
              Confirmar MFA e abrir /orgs
            </button>
          </div>
        </div>
      ) : null}

      {authStep === "forgot_password" ? (
        <div className="item-card">
          <h3>Simulação de /forgot-password</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Resposta idêntica para e-mails cadastrados ou inexistentes (evita enumeração de contas).
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setAuthNotice("Se o endereço existir, um link temporário de uso único foi enviado.");
            }}
          >
            Simular disparo de recuperação
          </button>
        </div>
      ) : null}

      {authStep === "verify_email" ? (
        <div className="item-card">
          <h3>Simulação de /verify-email</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Confirmação de endereço de e-mail corporativo antes de ativar memberships.
          </p>
        </div>
      ) : null}

      {authStep === "org_selector" ? (
        <div className="two-col-grid">
          <div className="item-card">
            <h3>1. Selecionar Sessão e Rota Solicitada</h3>
            <div className="control-group">
              <label htmlFor="session-actor-select">Usuário autenticado na sessão</label>
              <select
                id="session-actor-select"
                className="control-select"
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                }}
              >
                {MOCK_SESSION_ACTORS.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.displayName} (Orgs: {actor.authorizedOrgSlugs.join(", ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group" style={{ marginTop: "0.6rem" }}>
              <label htmlFor="target-org-slug-select">
                Rota solicitada: <code>/orgs/[orgSlug]</code>
              </label>
              <select
                id="target-org-slug-select"
                className="control-select"
                value={requestedSlug}
                onChange={(e) => {
                  setRequestedSlug(e.target.value);
                }}
              >
                <option value="aurora-industrial">/orgs/aurora-industrial (Tenant A)</option>
                <option value="vereda-logistica">/orgs/vereda-logistica (Tenant B)</option>
                <option value="titan-defesa">
                  /orgs/titan-defesa (Tenant C — Não pertence à sessão → 404)
                </option>
              </select>
            </div>
          </div>

          <div className="item-card">
            <h3>2. Resultado da Guarda de Isolamento A/B (WEB-001 AC-2)</h3>
            <div className="org-meta-row">
              <span
                className={
                  routeResolution.allowed
                    ? "demo-badge demo-badge--ok"
                    : "demo-badge demo-badge--danger"
                }
              >
                HTTP {routeResolution.httpStatus}
              </span>
              <code>/orgs/{requestedSlug}</code>
            </div>

            <p style={{ margin: "0.4rem 0", fontSize: "0.86rem" }}>{routeResolution.safeMessage}</p>

            {routeResolution.organization ? (
              <div className="code-preview">
                Organização resolvida: <strong>{routeResolution.organization.displayName}</strong> (
                {routeResolution.organization.legalName}) · Estado:{" "}
                {routeResolution.organization.tenantState}
              </div>
            ) : (
              <div className="code-preview">
                Nenhum dado de <code>{requestedSlug}</code> foi retornado ao cliente (404 seguro
                contra enumeração entre tenants).
              </div>
            )}
          </div>
        </div>
      ) : null}

      {authNotice ? (
        <p
          role="status"
          style={{
            marginTop: "0.75rem",
            fontSize: "0.82rem",
            color: "var(--status-ok-text)",
          }}
        >
          {authNotice}
        </p>
      ) : null}
    </section>
  );
}
