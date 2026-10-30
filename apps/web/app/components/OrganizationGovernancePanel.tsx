"use client";

import { useState } from "react";
import {
  generateOrganizationUsageCsv,
  MOCK_ENTITLEMENTS,
  MOCK_INTEGRATIONS,
  MOCK_ORG_MEMBERS,
  MOCK_RAG_DOCUMENTS,
} from "../../lib/mock-enterprise-data.ts";
import type { UserRole } from "../../lib/mock-types.ts";

export interface OrganizationGovernancePanelProps {
  readonly orgSlug: string;
  readonly activeRole: UserRole;
  readonly canMutateGovernance: boolean;
}

export function OrganizationGovernancePanel({
  orgSlug,
  activeRole,
  canMutateGovernance,
}: OrganizationGovernancePanelProps) {
  const [showCsvPreview, setShowCsvPreview] = useState<boolean>(false);
  const [invitedEmailNotice, setInvitedEmailNotice] = useState<string | null>(null);

  const csvContent = generateOrganizationUsageCsv(orgSlug);

  return (
    <section className="panel-card" aria-labelledby="org-governance-heading">
      <div className="panel-header">
        <div>
          <h2 id="org-governance-heading">
            Gestão da Organização: Membros, Módulos, Integrações, Documentos RAG &amp; Exportação
            CSV (WEB-003)
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
            }}
          >
            Ações de mutação respeitam o papel ativo ({activeRole}). Quando o papel é{" "}
            <code>viewer</code>, convites e alterações ficam ocultos.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setShowCsvPreview((prev) => !prev);
          }}
        >
          {showCsvPreview
            ? "Ocultar CSV de Uso (AIG-003)"
            : "Exportar / Visualizar CSV de Uso de IA"}
        </button>
      </div>

      {showCsvPreview ? (
        <div style={{ marginBottom: "1.25rem" }}>
          <strong style={{ fontSize: "0.84rem" }}>
            Relatório CSV de Consumo de IA ({orgSlug}.csv — protegido contra CSV Injection):
          </strong>
          <pre className="code-preview" style={{ marginTop: "0.4rem" }}>
            {csvContent}
          </pre>
        </div>
      ) : null}

      <div className="two-col-grid">
        <div className="item-card">
          <div className="panel-header" style={{ marginBottom: "0.5rem" }}>
            <h3>Membros &amp; Papéis ({MOCK_ORG_MEMBERS.length})</h3>
            {canMutateGovernance ? (
              <button
                type="button"
                className="btn btn--approve"
                onClick={() => {
                  setInvitedEmailNotice(
                    "Convite simulado registrado para novo.operador@aurora-demo.example (sem envio de rede).",
                  );
                }}
              >
                Simular Convite de Membro
              </button>
            ) : (
              <span className="demo-badge demo-badge--info">
                Papel {activeRole}: mutação oculta (WEB-003 AC-1)
              </span>
            )}
          </div>

          {invitedEmailNotice ? (
            <p
              role="status"
              style={{
                fontSize: "0.8rem",
                color: "var(--status-ok-text)",
                margin: "0 0 0.5rem",
              }}
            >
              {invitedEmailNotice}
            </p>
          ) : null}

          <ul className="item-list">
            {MOCK_ORG_MEMBERS.map((member) => (
              <li
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.84rem",
                  paddingBottom: "0.4rem",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <strong>{member.name}</strong> ({member.email})
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    MFA: {member.mfaEnabled ? "Ativo" : "Pendente"} · {member.lastSeenLabel}
                  </div>
                </div>
                <span className="demo-badge demo-badge--info">{member.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="item-card">
          <h3>Módulos Contratados / Entitlements (Somente Leitura)</h3>
          <ul className="item-list">
            {MOCK_ENTITLEMENTS.map((mod) => (
              <li
                key={mod.moduleCode}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.84rem",
                  paddingBottom: "0.4rem",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <code>{mod.moduleCode}</code> · <strong>{mod.name}</strong>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Agentes: {mod.activeAgents}/{mod.maxAgents} · Cota:{" "}
                    {mod.monthlyQuotaTokens.toLocaleString("pt-BR")} tokens
                  </div>
                </div>
                <span className="demo-badge demo-badge--ok">{mod.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="item-card">
          <h3>Integrações &amp; Conectores (Metadados sem Segredos)</h3>
          <ul className="item-list">
            {MOCK_INTEGRATIONS.map((conn) => (
              <li
                key={conn.id}
                style={{
                  fontSize: "0.84rem",
                  paddingBottom: "0.4rem",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>{conn.name}</strong>
                  <span
                    className={
                      conn.status === "HEALTHY"
                        ? "demo-badge demo-badge--ok"
                        : "demo-badge demo-badge--danger"
                    }
                  >
                    {conn.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Egress allowlist: <code>{conn.egressDomain}</code> · Cofre:{" "}
                  <code>{conn.credentialVaultRef}</code>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="item-card">
          <h3>Documentos &amp; Indexação RAG do Tenant</h3>
          <ul className="item-list">
            {MOCK_RAG_DOCUMENTS.map((doc) => (
              <li
                key={doc.id}
                style={{
                  fontSize: "0.84rem",
                  paddingBottom: "0.4rem",
                  borderBottom: "1px solid var(--border-subtle)",
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
                  <strong>{doc.title}</strong>
                  <span
                    className={
                      doc.status === "INDEXED"
                        ? "demo-badge demo-badge--ok"
                        : doc.status === "INDEXING"
                          ? "demo-badge demo-badge--warn"
                          : "demo-badge demo-badge--danger"
                    }
                  >
                    {doc.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {doc.departmentName} · {doc.chunksCount} chunks · {doc.updatedAtLabel}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
