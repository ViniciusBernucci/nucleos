"use client";

import { useState } from "react";
import { MOCK_SESSION_ACTORS, resolvePlatformBackoffice } from "../../lib/mock-enterprise-data.ts";

export function PlatformBackofficePanel() {
  const [actorId, setActorId] = useState<string>("usr-roberto-admin-03");
  const [killSwitchedTenants, setKillSwitchedTenants] = useState<readonly string[]>([
    "vanguarda-agro",
  ]);
  const [dlqJustification, setDlqJustification] = useState<string>(
    "Reprocessar após normalização de latência do gateway upstream.",
  );
  const [requeuedJobs, setRequeuedJobs] = useState<readonly string[]>([]);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);

  const actor =
    MOCK_SESSION_ACTORS.find((item) => item.id === actorId) ?? MOCK_SESSION_ACTORS[0] ?? null;

  const backoffice = resolvePlatformBackoffice(actor);

  function handleToggleKillSwitch(slug: string): void {
    const isCurrentlyActive = killSwitchedTenants.includes(slug);
    const next = isCurrentlyActive
      ? killSwitchedTenants.filter((item) => item !== slug)
      : [...killSwitchedTenants, slug];

    setKillSwitchedTenants(next);
    setAuditFeedback(
      `Auditoria /platform: Kill switch de orçamento para "${slug}" alterado para ${!isCurrentlyActive ? "ATIVADO" : "DESATIVADO"} por ${actor?.email ?? "operador"}.`,
    );
  }

  function handleRequeueDlq(jobId: string): void {
    if (dlqJustification.trim().length < 10) {
      setAuditFeedback(
        "Erro de validação: Requeue de DLQ exige justificativa auditável com pelo menos 10 caracteres.",
      );
      return;
    }
    setRequeuedJobs((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    setAuditFeedback(
      `Auditoria /platform: Job ${jobId} reenfileirado com justificativa: "${dlqJustification.trim()}".`,
    );
  }

  return (
    <section className="panel-card" aria-labelledby="platform-backoffice-heading">
      <div className="panel-header">
        <div>
          <h2 id="platform-backoffice-heading">
            Backoffice de Plataforma — <code>/platform</code> (WEB-009)
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
            }}
          >
            Exclusivo para <code>platform_admin</code> com MFA. Exibe apenas metadados operacionais,
            provisionamento, DLQ, capacidade e break-glass — <strong>jamais</strong> conteúdo
            privado de conversas ou documentos do tenant.
          </p>
        </div>

        <div className="control-group">
          <label htmlFor="backoffice-actor-select">Testar acesso a /platform com papel</label>
          <select
            id="backoffice-actor-select"
            className="control-select"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setAuditFeedback(null);
            }}
          >
            {MOCK_SESSION_ACTORS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} ({item.platformRole})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!backoffice.allowed ? (
        <div role="alert" className="state-box state-box--error" style={{ marginTop: "0.5rem" }}>
          <span className="demo-badge demo-badge--danger">
            HTTP {backoffice.httpStatus} FORBIDDEN
          </span>
          <h3 style={{ marginTop: "0.5rem" }}>Acesso bloqueado à área /platform (WEB-009 AC-1)</h3>
          <p>{backoffice.denialReason}</p>
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="kpi-card">
              <span className="kpi-card__label">Host VPS do MVP</span>
              <span className="kpi-card__value">
                {backoffice.hostCapacity.activeTenantsCount} /{" "}
                {backoffice.hostCapacity.maxTenantsMvp} tenants
              </span>
              <span className="kpi-card__detail">{backoffice.hostCapacity.vpsNodeLabel}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">Memória RAM do Host</span>
              <span className="kpi-card__value">
                {backoffice.hostCapacity.ramUsedGb} GB / {backoffice.hostCapacity.ramTotalGb} GB
              </span>
              <span className="kpi-card__detail">
                CPU: {backoffice.hostCapacity.cpuUsagePct}% · Disco NVMe:{" "}
                {backoffice.hostCapacity.diskUsedPct}%
              </span>
            </div>
          </div>

          <div className="two-col-grid">
            <div className="item-card">
              <h3>Tenants, Custos, Deriva &amp; Kill Switch de Orçamento</h3>
              <ul className="item-list">
                {backoffice.tenants.map((tnt) => {
                  const killActive = killSwitchedTenants.includes(tnt.slug);
                  return (
                    <li
                      key={tnt.tenantId}
                      style={{
                        paddingBottom: "0.6rem",
                        borderBottom: "1px solid var(--border-subtle)",
                        fontSize: "0.84rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <div>
                          <strong>{tnt.slug}</strong> ({tnt.state}) · {tnt.activeContainers}{" "}
                          containers
                        </div>
                        <span
                          className={
                            tnt.reconcilerDrift === "NONE"
                              ? "demo-badge demo-badge--ok"
                              : "demo-badge demo-badge--warn"
                          }
                        >
                          Drift: {tnt.reconcilerDrift}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "0.35rem",
                          gap: "0.5rem",
                        }}
                      >
                        <span>
                          Custo IA: R$ {tnt.monthlyCostBrl} / R$ {tnt.monthlyCapBrl}
                        </span>
                        <button
                          type="button"
                          className={killActive ? "btn btn--approve" : "btn btn--reject"}
                          onClick={() => {
                            handleToggleKillSwitch(tnt.slug);
                          }}
                        >
                          {killActive
                            ? "Reativar Orçamento (Kill Switch ON)"
                            : "Acionar Kill Switch de Orçamento"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="item-card">
              <h3>Fila DLQ &amp; Requeue com Justificativa Auditada</h3>
              <div className="control-group" style={{ marginBottom: "0.6rem" }}>
                <label htmlFor="dlq-justification-input">
                  Justificativa obrigatória para Requeue
                </label>
                <input
                  id="dlq-justification-input"
                  type="text"
                  className="control-input"
                  value={dlqJustification}
                  onChange={(e) => {
                    setDlqJustification(e.target.value);
                  }}
                />
              </div>

              <ul className="item-list">
                {backoffice.dlqItems.map((dlq) => {
                  const isRequeued = requeuedJobs.includes(dlq.jobId);
                  return (
                    <li
                      key={dlq.jobId}
                      style={{
                        paddingBottom: "0.5rem",
                        borderBottom: "1px solid var(--border-subtle)",
                        fontSize: "0.83rem",
                      }}
                    >
                      <div>
                        <code>{dlq.jobId}</code> · Tenant: <strong>{dlq.tenantSlug}</strong> (
                        {dlq.queueName})
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        Erro: <code>{dlq.failureCode}</code> ({dlq.retriesCount} tentativas ·{" "}
                        {dlq.occurredAtLabel})
                      </div>
                      <div style={{ marginTop: "0.35rem" }}>
                        {isRequeued ? (
                          <span className="demo-badge demo-badge--ok">
                            Reenfileirado com auditoria
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => {
                              handleRequeueDlq(dlq.jobId);
                            }}
                          >
                            Requeue com Justificativa
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="item-card">
              <h3>Execuções de Provisionamento</h3>
              <ul className="item-list">
                {backoffice.provisioningRuns.map((run) => (
                  <li key={run.executionId} style={{ fontSize: "0.84rem" }}>
                    <strong>{run.executionId}</strong> ({run.tenantSlug}) —{" "}
                    <span className="demo-badge demo-badge--info">{run.status}</span>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {run.currentStep} ({run.stepsCompleted}/{run.totalSteps})
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="item-card">
              <h3>Concessões Break-Glass (Somente Metadados — IAM-009)</h3>
              <ul className="item-list">
                {backoffice.breakGlassGrants.map((bg) => (
                  <li key={bg.grantId} style={{ fontSize: "0.84rem" }}>
                    <div>
                      <code>{bg.grantId}</code> · Tenant: <strong>{bg.tenantSlug}</strong> ·{" "}
                      <span className="demo-badge demo-badge--warn">{bg.status}</span>
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      Motivo: {bg.reason} ({bg.expiresAtLabel})
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {auditFeedback ? (
        <p
          role="status"
          style={{
            marginTop: "0.75rem",
            fontSize: "0.82rem",
            color: "var(--status-warn-text)",
          }}
        >
          {auditFeedback}
        </p>
      ) : null}
    </section>
  );
}
