/**
 * Utilitarios puros de seguranca do frontend e prevencao de duplicidade (WEB-002 e WEB-008).
 *
 * - Sanitizacao deterministica de texto/markdown vindo de agentes (sem dangerouslySetInnerHTML).
 * - Bloqueio automatico de imagens remotas em respostas de agentes (evita exfiltracao por URL).
 * - Guard de idempotencia contra duplo clique em mutacoes criticas.
 * - Exportacao CSV de consumo de IA com neutralizacao de CSV Formula Injection.
 */

export interface SafeMessageSegment {
  readonly kind: "text" | "code" | "safe_link" | "blocked_xss" | "blocked_remote_image";
  readonly content: string;
  readonly href?: string;
}

export interface SanitizedAgentOutput {
  readonly safeSegments: readonly SafeMessageSegment[];
  readonly blockedXssCount: number;
  readonly blockedRemoteImages: readonly string[];
}

export interface DepartmentUsageCsvRow {
  readonly organizationSlug: string;
  readonly departmentName: string;
  readonly moduleCode: string;
  readonly agentName: string;
  readonly modelName: string;
  readonly tokensUsedMonth: number;
  readonly tokensLimitMonth: number;
  readonly monthlySpentBrl: number;
  readonly monthlyBudgetBrl: number;
}

const XSS_PATTERN =
  /<\s*\/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta)\b[^>]*>|on[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/gi;

const REMOTE_IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi;

const HTML_IMG_TAG_PATTERN = /<\s*img\b[^>]*\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/gi;

/**
 * Sanitiza conteudo emitido por agente antes da renderizacao em componentes React.
 * Nunca produz HTML bruto; divide e neutraliza trechos maliciosos e imagens remotas.
 */
export function sanitizeAgentMessageContent(rawContent: string): SanitizedAgentOutput {
  const blockedRemoteImages: string[] = [];
  let working = rawContent;

  working = working.replace(
    REMOTE_IMAGE_MARKDOWN_PATTERN,
    (_fullMatch, _alt: string, url: string) => {
      blockedRemoteImages.push(url);
      return `[IMAGEM_REMOTA_BLOQUEADA:${url}]`;
    },
  );

  working = working.replace(HTML_IMG_TAG_PATTERN, (_fullMatch, url: string) => {
    blockedRemoteImages.push(url);
    return `[IMAGEM_REMOTA_BLOQUEADA:${url}]`;
  });

  const xssMatches = working.match(XSS_PATTERN);
  const blockedXssCount = xssMatches ? xssMatches.length : 0;

  if (blockedXssCount > 0) {
    working = working.replace(XSS_PATTERN, "[CONTEUDO_ATUADO_POR_POLITICA_XSS]");
  }

  const lines = working.split("\n");
  const safeSegments: SafeMessageSegment[] = [];

  for (const line of lines) {
    if (line.includes("[IMAGEM_REMOTA_BLOQUEADA:")) {
      safeSegments.push({
        kind: "blocked_remote_image",
        content: line,
      });
    } else if (line.includes("[CONTEUDO_ATUADO_POR_POLITICA_XSS]")) {
      safeSegments.push({
        kind: "blocked_xss",
        content: line,
      });
    } else if (line.trim().startsWith("`") && line.trim().endsWith("`")) {
      safeSegments.push({
        kind: "code",
        content: line.trim().slice(1, -1),
      });
    } else {
      safeSegments.push({
        kind: "text",
        content: line,
      });
    }
  }

  return {
    safeSegments,
    blockedXssCount,
    blockedRemoteImages,
  };
}

/**
 * Gera chave deterministica de idempotencia para mutacoes da UI (WEB-002).
 */
export function createIdempotencyKey(scope: string, targetId: string, action: string): string {
  const normalized = `${scope.trim()}:${targetId.trim()}:${action.trim()}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-");
  return `idem-${normalized}`;
}

export interface IdempotencyCheckResult {
  readonly allowed: boolean;
  readonly idempotencyKey: string;
  readonly updatedKeys: readonly string[];
}

export function registerIdempotentMutation(
  existingKeys: readonly string[],
  scope: string,
  targetId: string,
  action: string,
): IdempotencyCheckResult {
  const key = createIdempotencyKey(scope, targetId, action);
  if (existingKeys.includes(key)) {
    return {
      allowed: false,
      idempotencyKey: key,
      updatedKeys: existingKeys,
    };
  }
  return {
    allowed: true,
    idempotencyKey: key,
    updatedKeys: [...existingKeys, key],
  };
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  // Previne CSV Formula Injection (=, +, -, @, tab, CR no inicio da celula)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exporta o relatorio de consumo de IA da organizacao em formato CSV seguro (WEB-003).
 */
export function buildOrganizationUsageCsv(rows: readonly DepartmentUsageCsvRow[]): string {
  const header = [
    "organizacao",
    "departamento",
    "modulo",
    "agente",
    "modelo",
    "tokens_usados_mes",
    "tokens_limite_mes",
    "gasto_mensal_brl",
    "orcamento_mensal_brl",
  ].join(",");

  const bodyLines = rows.map((row) =>
    [
      escapeCsvCell(row.organizationSlug),
      escapeCsvCell(row.departmentName),
      escapeCsvCell(row.moduleCode),
      escapeCsvCell(row.agentName),
      escapeCsvCell(row.modelName),
      escapeCsvCell(row.tokensUsedMonth),
      escapeCsvCell(row.tokensLimitMonth),
      escapeCsvCell(row.monthlySpentBrl),
      escapeCsvCell(row.monthlyBudgetBrl),
    ].join(","),
  );

  return [header, ...bodyLines].join("\n");
}
