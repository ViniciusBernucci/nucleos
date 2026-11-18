import type { DashboardViewModel } from "../../lib/mock-types.ts";

export interface OverviewPanelProps {
  readonly viewModel: DashboardViewModel;
  readonly onOpenApprovals: () => void;
  readonly onOpenActivity: () => void;
}

const MAX_APPROVALS = 3;
const MAX_ACTIVITY = 4;

/** Painel inicial enxuto: so o essencial; os setores ficam no menu lateral. */
export function OverviewPanel({ viewModel, onOpenApprovals, onOpenActivity }: OverviewPanelProps) {
  const { metrics, approvals, recentActivity } = viewModel;
  const hasPending = metrics.pendingApprovalsCount > 0;

  return (
    <>
      <section aria-label="Indicadores essenciais">
        <div className="kpi-grid">
          <div className={hasPending ? "kpi-card kpi-card--attn" : "kpi-card"}>
            <span className="kpi-card__label">
              {hasPending ? <span className="attn-dot" aria-hidden="true" /> : null}
              Decisões pendentes
            </span>
            <span className="kpi-card__value">{metrics.pendingApprovalsCount}</span>
            <span className="kpi-card__detail">Requerem decisão humana</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-card__label">Agentes de IA em execução</span>
            <span className="kpi-card__value">
              {metrics.executingAgents} / {metrics.totalAgents}
            </span>
            <span className="kpi-card__detail">
              {metrics.awaitingApprovalAgents} aguardando aprovação
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-card__label">Orçamento mensal de IA</span>
            <span className="kpi-card__value">{metrics.totalBudget.percentage}%</span>
            <span className="kpi-card__detail">
              R$ {metrics.totalBudget.spentBrl} / R$ {metrics.totalBudget.limitBrl}
            </span>
          </div>
        </div>
      </section>

      <div className="two-col-grid">
        <section className="panel-card" aria-labelledby="overview-approvals-heading">
          <div className="panel-header">
            <h2 id="overview-approvals-heading">Aguardam sua decisão</h2>
            <button type="button" className="btn btn--secondary" onClick={onOpenApprovals}>
              Ver todas
            </button>
          </div>
          {approvals.length === 0 ? (
            <p className="org-meta-row">Nenhuma decisão pendente.</p>
          ) : (
            <ul className="row-list">
              {approvals.slice(0, MAX_APPROVALS).map((approval) => (
                <li key={approval.id}>
                  <span className="row-list__main">{approval.title}</span>
                  <span className="demo-badge demo-badge--info">{approval.departmentName}</span>
                  {approval.riskLevel === "high" ? (
                    <span className="demo-badge demo-badge--danger">Risco alto</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card" aria-labelledby="overview-activity-heading">
          <div className="panel-header">
            <h2 id="overview-activity-heading">Atualizações</h2>
            <button type="button" className="btn btn--secondary" onClick={onOpenActivity}>
              Histórico
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <p className="org-meta-row">Sem atividade recente.</p>
          ) : (
            <ul className="row-list">
              {recentActivity.slice(0, MAX_ACTIVITY).map((item) => (
                <li key={item.id}>
                  <span className="row-list__time">{item.timestampLabel}</span>
                  <span className="row-list__main">{item.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
