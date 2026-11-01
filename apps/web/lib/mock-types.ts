/**
 * Tipos do modelo local de demonstracao do frontend (LOC-WEB-001).
 *
 * IMPORTANTE: Estes tipos existem exclusivamente para validar a direcao visual
 * de WEB-001, WEB-003 e WEB-005 com dados mockados locais enquanto o backend
 * permanece pausado. Nao substituem `@nucleos/contracts` nem `@nucleos/sdk`.
 */

export type DemoStateVariant = "ready" | "loading" | "empty" | "error";

export type TenantLifecycleState = "ACTIVE" | "PROVISIONING" | "SUSPENDED";

export type UserRole = "org_admin" | "department_manager" | "operator" | "viewer";

export type AgentStatus = "executing" | "idle" | "awaiting_approval" | "degraded";

export type TaskStatus = "running" | "queued" | "awaiting_human" | "completed" | "failed";

export type ApprovalRiskLevel = "low" | "medium" | "high";

export type BudgetAlertLevel = "healthy" | "warning_80" | "critical_100";

export type SecurityEventSeverity = "info" | "warning" | "high";

export interface MockAgent {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly roleTitle: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly floorNumber: number;
  readonly workstationCode: string;
  readonly status: AgentStatus;
  readonly modelName: string;
  readonly currentTaskSummary: string;
  readonly tokensUsedMonth: number;
  readonly tokensLimitMonth: number;
}

export interface MockDepartmentFloor {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly floorNumber: number;
  readonly moduleCode: string;
  readonly summary: string;
  readonly monthlyBudgetBrl: number;
  readonly monthlySpentBrl: number;
  readonly tokensUsedMonth: number;
  readonly tokensLimitMonth: number;
  readonly agents: readonly MockAgent[];
}

export interface MockTaskItem {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly agentName: string;
  readonly status: TaskStatus;
  readonly startedAtLabel: string;
  readonly durationLabel: string;
}

export interface MockApprovalItem {
  readonly id: string;
  readonly actionHash: string;
  readonly title: string;
  readonly serverSummary: string;
  readonly departmentName: string;
  readonly agentName: string;
  readonly riskLevel: ApprovalRiskLevel;
  readonly expiresInLabel: string;
  readonly argumentsPreview: string;
  readonly requiredPermission: "approvals:decide";
}

export interface MockSecurityActivityItem {
  readonly id: string;
  readonly timestampLabel: string;
  readonly eventCode: string;
  readonly summary: string;
  readonly actorLabel: string;
  readonly severity: SecurityEventSeverity;
  readonly correlationId: string;
}

export interface MockProblemDetails {
  readonly code: string;
  readonly httpStatus: number;
  readonly title: string;
  readonly userMessage: string;
  readonly correlationId: string;
  readonly retryable: boolean;
}

export interface MockOrganizationFixture {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly legalName: string;
  readonly planName: string;
  readonly tenantState: TenantLifecycleState;
  readonly activeRole: UserRole;
  readonly activeUserLabel: string;
  readonly lastSyncLabel: string;
  readonly securityBanner: string | null;
  readonly floors: readonly MockDepartmentFloor[];
  readonly tasks: readonly MockTaskItem[];
  readonly approvals: readonly MockApprovalItem[];
  readonly recentActivity: readonly MockSecurityActivityItem[];
  readonly simulatedError: MockProblemDetails;
}

export interface MockOrganizationSummary {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly planName: string;
  readonly tenantState: TenantLifecycleState;
  readonly activeRole: UserRole;
}

export interface BudgetConsumptionSummary {
  readonly spentBrl: number;
  readonly limitBrl: number;
  readonly percentage: number;
  readonly alertLevel: BudgetAlertLevel;
  readonly alertLabel: string;
}

export interface FloorPresentation extends MockDepartmentFloor {
  readonly budgetStatus: BudgetConsumptionSummary;
  readonly tokenStatus: BudgetConsumptionSummary;
  readonly executingAgentsCount: number;
  readonly awaitingApprovalCount: number;
}

export interface DashboardMetricsSummary {
  readonly totalFloors: number;
  readonly totalAgents: number;
  readonly executingAgents: number;
  readonly awaitingApprovalAgents: number;
  readonly activeTasksCount: number;
  readonly pendingApprovalsCount: number;
  readonly budgetAlertFloorsCount: number;
  readonly totalBudget: BudgetConsumptionSummary;
}

export interface DashboardViewModel {
  readonly variant: DemoStateVariant;
  readonly isDemoEnvironment: true;
  readonly demoBannerText: string;
  readonly organization: MockOrganizationSummary & {
    readonly legalName: string;
    readonly activeUserLabel: string;
    readonly lastSyncLabel: string;
    readonly securityBanner: string | null;
    readonly canDecideApprovals: boolean;
    readonly isProvisioning: boolean;
  };
  readonly metrics: DashboardMetricsSummary;
  readonly floors: readonly FloorPresentation[];
  readonly selectedFloor: FloorPresentation | null;
  readonly filteredAgents: readonly MockAgent[];
  readonly tasks: readonly MockTaskItem[];
  readonly approvals: readonly MockApprovalItem[];
  readonly recentActivity: readonly MockSecurityActivityItem[];
  readonly errorDetails: MockProblemDetails | null;
  readonly emptyStateMessage: string | null;
}
