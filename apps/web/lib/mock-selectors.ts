import { DEMO_ENVIRONMENT_BANNER, MOCK_ORGANIZATIONS } from "./mock-fixtures.ts";
import type {
  BudgetConsumptionSummary,
  DashboardMetricsSummary,
  DashboardViewModel,
  DemoStateVariant,
  FloorPresentation,
  MockAgent,
  MockDepartmentFloor,
  MockOrganizationFixture,
  MockOrganizationSummary,
  UserRole,
} from "./mock-types.ts";

export interface DeriveDashboardOptions {
  readonly orgSlug?: string;
  readonly variant?: DemoStateVariant;
  readonly selectedFloorId?: string;
  readonly agentQuery?: string;
}

export function listMockOrganizations(): readonly MockOrganizationSummary[] {
  return MOCK_ORGANIZATIONS.map((org) => ({
    id: org.id,
    slug: org.slug,
    displayName: org.displayName,
    planName: org.planName,
    tenantState: org.tenantState,
    activeRole: org.activeRole,
  }));
}

export function getMockOrganizationBySlug(slug?: string): MockOrganizationFixture {
  const fallback = MOCK_ORGANIZATIONS[0];
  if (!fallback) {
    throw new Error("MOCK_ORGANIZATIONS deve conter ao menos uma organizacao.");
  }
  if (!slug) {
    return fallback;
  }
  const matched = MOCK_ORGANIZATIONS.find((org) => org.slug === slug);
  return matched ?? fallback;
}

export function roleCanDecideApprovals(role: UserRole): boolean {
  return role === "org_admin" || role === "department_manager" || role === "operator";
}

export function computeBudgetStatus(spent: number, limit: number): BudgetConsumptionSummary {
  const safeSpent = Math.max(0, spent);
  const safeLimit = Math.max(0, limit);
  const rawPercentage = safeLimit === 0 ? 0 : Math.round((safeSpent / safeLimit) * 100);

  if (rawPercentage >= 100) {
    return {
      spentBrl: safeSpent,
      limitBrl: safeLimit,
      percentage: rawPercentage,
      alertLevel: "critical_100",
      alertLabel: "Limite 100% atingido (bloqueio preventivo)",
    };
  }

  if (rawPercentage >= 80) {
    return {
      spentBrl: safeSpent,
      limitBrl: safeLimit,
      percentage: rawPercentage,
      alertLevel: "warning_80",
      alertLabel: "Alerta de orçamento (acima de 80%)",
    };
  }

  return {
    spentBrl: safeSpent,
    limitBrl: safeLimit,
    percentage: rawPercentage,
    alertLevel: "healthy",
    alertLabel: "Dentro do orçamento",
  };
}

function buildFloorPresentation(floor: MockDepartmentFloor): FloorPresentation {
  const budgetStatus = computeBudgetStatus(floor.monthlySpentBrl, floor.monthlyBudgetBrl);
  const tokenStatus = computeBudgetStatus(floor.tokensUsedMonth, floor.tokensLimitMonth);
  const executingAgentsCount = floor.agents.filter((agent) => agent.status === "executing").length;
  const awaitingApprovalCount = floor.agents.filter(
    (agent) => agent.status === "awaiting_approval",
  ).length;

  return {
    ...floor,
    budgetStatus,
    tokenStatus,
    executingAgentsCount,
    awaitingApprovalCount,
  };
}

function createZeroMetrics(): DashboardMetricsSummary {
  return {
    totalFloors: 0,
    totalAgents: 0,
    executingAgents: 0,
    awaitingApprovalAgents: 0,
    activeTasksCount: 0,
    pendingApprovalsCount: 0,
    budgetAlertFloorsCount: 0,
    totalBudget: computeBudgetStatus(0, 0),
  };
}

export function deriveDashboardViewModel(options: DeriveDashboardOptions = {}): DashboardViewModel {
  const variant: DemoStateVariant = options.variant ?? "ready";
  const org = getMockOrganizationBySlug(options.orgSlug);
  const canDecideApprovals = roleCanDecideApprovals(org.activeRole);
  const isProvisioning = org.tenantState === "PROVISIONING";

  const baseOrganization = {
    id: org.id,
    slug: org.slug,
    displayName: org.displayName,
    legalName: org.legalName,
    planName: org.planName,
    tenantState: org.tenantState,
    activeRole: org.activeRole,
    activeUserLabel: org.activeUserLabel,
    lastSyncLabel: org.lastSyncLabel,
    securityBanner: org.securityBanner,
    canDecideApprovals,
    isProvisioning,
  };

  if (variant === "loading") {
    return {
      variant: "loading",
      isDemoEnvironment: true,
      demoBannerText: DEMO_ENVIRONMENT_BANNER,
      organization: baseOrganization,
      metrics: createZeroMetrics(),
      floors: [],
      selectedFloor: null,
      filteredAgents: [],
      tasks: [],
      approvals: [],
      recentActivity: [],
      errorDetails: null,
      emptyStateMessage: null,
    };
  }

  if (variant === "error") {
    return {
      variant: "error",
      isDemoEnvironment: true,
      demoBannerText: DEMO_ENVIRONMENT_BANNER,
      organization: baseOrganization,
      metrics: createZeroMetrics(),
      floors: [],
      selectedFloor: null,
      filteredAgents: [],
      tasks: [],
      approvals: [],
      recentActivity: [],
      errorDetails: org.simulatedError,
      emptyStateMessage: null,
    };
  }

  if (variant === "empty") {
    return {
      variant: "empty",
      isDemoEnvironment: true,
      demoBannerText: DEMO_ENVIRONMENT_BANNER,
      organization: baseOrganization,
      metrics: createZeroMetrics(),
      floors: [],
      selectedFloor: null,
      filteredAgents: [],
      tasks: [],
      approvals: [],
      recentActivity: [],
      errorDetails: null,
      emptyStateMessage:
        "Nenhum departamento ou agente provisionado nesta visualização demonstrativa. Quando os módulos forem ativados no Control Plane, os andares do edifício e as filas aparecerão aqui.",
    };
  }

  // Ordena do andar mais alto para o terreo (representacao visual de predio)
  const sortedFloors = [...org.floors]
    .sort((a, b) => b.floorNumber - a.floorNumber)
    .map((floor) => buildFloorPresentation(floor));

  const selectedFloor =
    sortedFloors.find((floor) => floor.id === options.selectedFloorId) ?? sortedFloors[0] ?? null;

  const allAgents: MockAgent[] = sortedFloors.flatMap((floor) => floor.agents);
  const normalizedQuery = (options.agentQuery ?? "").trim().toLowerCase();
  const sourceAgents = selectedFloor ? selectedFloor.agents : allAgents;
  const filteredAgents = normalizedQuery
    ? sourceAgents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(normalizedQuery) ||
          agent.roleTitle.toLowerCase().includes(normalizedQuery) ||
          agent.code.toLowerCase().includes(normalizedQuery) ||
          agent.currentTaskSummary.toLowerCase().includes(normalizedQuery),
      )
    : sourceAgents;

  const totalSpentBrl = sortedFloors.reduce((acc, floor) => acc + floor.monthlySpentBrl, 0);
  const totalLimitBrl = sortedFloors.reduce((acc, floor) => acc + floor.monthlyBudgetBrl, 0);
  const budgetAlertFloorsCount = sortedFloors.filter(
    (floor) => floor.budgetStatus.alertLevel !== "healthy",
  ).length;

  const metrics: DashboardMetricsSummary = {
    totalFloors: sortedFloors.length,
    totalAgents: allAgents.length,
    executingAgents: allAgents.filter((a) => a.status === "executing").length,
    awaitingApprovalAgents: allAgents.filter((a) => a.status === "awaiting_approval").length,
    activeTasksCount: org.tasks.filter(
      (t) => t.status === "running" || t.status === "queued" || t.status === "awaiting_human",
    ).length,
    pendingApprovalsCount: org.approvals.length,
    budgetAlertFloorsCount,
    totalBudget: computeBudgetStatus(totalSpentBrl, totalLimitBrl),
  };

  return {
    variant: "ready",
    isDemoEnvironment: true,
    demoBannerText: DEMO_ENVIRONMENT_BANNER,
    organization: baseOrganization,
    metrics,
    floors: sortedFloors,
    selectedFloor,
    filteredAgents,
    tasks: org.tasks,
    approvals: org.approvals,
    recentActivity: org.recentActivity,
    errorDetails: null,
    emptyStateMessage: null,
  };
}
