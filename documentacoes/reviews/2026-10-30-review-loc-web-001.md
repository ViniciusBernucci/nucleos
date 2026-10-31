# Code Review — LOC-WEB-001 — Fundação navegável do frontend com dados mockados

- **Tarefa:** `LOC-WEB-001`
- **Lote:** `lote-2026-10-30-frontend-mockado`
- **Modo:** Revisão completa (`correção/performance`, `qualidade/arquitetura`, `segurança/AppSec`)
- **Repositório / Worktree:** `nucleos` (branch `tarefa/loc-web-001`)
- **Base:** `f322f4b1698f94ae276fdb8838137cd6b7e9cef8`
- **HEAD revisado:** `9578d64` (código em `4519ed595a1a2ed6bb5d76872b46c62534e864dc` e documentação/lesson em `9578d64`)
- **Especificação canônica:** `documentacoes/planejamento-ia/lote-2026-10-30-frontend-mockado-web-001.md`
- **Executor independente:** subagente `efc94012-1c78-4d49-a4e5-945aecaf6d69` (`revisor-de-codigo`)

---

## 1. Resumo da Revisão por Especialidade

### 1.1 Correção, Lógica e Performance
- **Derivação determinística (`apps/web/lib/mock-selectors.ts`):** `deriveDashboardViewModel` trata de forma pura e isolada as quatro variantes (`ready`, `loading`, `empty`, `error`), garantindo que listas operacionais (`floors`, `tasks`, `approvals`, `recentActivity`) não vazem dados parciais quando `variant !== "ready"`.
- **Proteção aritmética:** `computeBudgetStatus` protege contra valores negativos (`Math.max(0, ...)`) e divisão por zero (`safeLimit === 0 ? 0 : ...`), classificando corretamente os limiares `< 80%` (`healthy`), `>= 80%` (`warning_80`) e `>= 100%` (`critical_100`). O mesmo cuidado de divisão por zero foi aplicado ao cálculo de percentual de tokens por agente em `BuildingFloorMap.tsx:226`.
- **Imutabilidade e ordenação:** a ordenação dos andares (`[...org.floors].sort((a, b) => b.floorNumber - a.floorNumber)`) cria cópia rasa antes de ordenar, preservando a imutabilidade das fixtures originais.
- **Transição de estado na UI (`DashboardClientShell.tsx:29-34`):** ao alternar a organização mockada em `handleSelectOrg`, os estados dependentes (`selectedFloorId`, `agentQuery`, `decisions`) são limpos, evitando estado órfão entre organizações.

### 1.2 Qualidade, Clean Code, TypeScript Strict e Acessibilidade
- **Fronteira de mocks bem delimitada:** separação clara entre contratos locais (`mock-types.ts`), dados estáticos (`mock-fixtures.ts`), seletores puros (`mock-selectors.ts`) e componentes React (`app/components/*.tsx`), facilitando a futura substituição pelo `@nucleos/sdk` (`WEB-002`) sem reescrever a árvore visual.
- **TypeScript `strict` e `exactOptionalPropertyTypes`:** uso consistente de modificadores `readonly` em todas as interfaces e arrays, switches exaustivos por union types (`AgentStatus`, `BudgetAlertLevel`, `ApprovalRiskLevel`, `TaskStatus`, `SecurityEventSeverity`) e passagem condicional de propriedades opcionais (`...(selectedFloorId !== undefined ? { selectedFloorId } : {})`).
- **Acessibilidade e Semântica (`WEB-MOCK-AC-05`):**
  - Idioma declarado em `<html lang="pt-BR">` (`layout.tsx:12`).
  - Skip link funcional (`.skip-link` apontando para `#main-content`).
  - Landmarks semânticos completos (`aside`, `header`, `nav`, `main`, `section`, `footer`) e hierarquia de títulos sem saltos (`h1` → `h2` → `h3`).
  - Controles interativos nativos (`select` associado a `label htmlFor`, `input type="search"` com `label`, botões de navegação com `aria-current="page"`, botões de andar com `aria-pressed` e `aria-label` descritivo, regiões de status/erro com `role="status"` / `role="alert"`).
  - Anel de foco `:focus-visible` de alto contraste (`3px solid var(--accent-focus)`) e layout responsivo via CSS Grid e `@media (max-width: 920px)`.

### 1.3 Segurança (AppSec)
- **Ausência de XSS e injeção:** nenhum uso de `dangerouslySetInnerHTML`, `eval` ou construção dinâmica de HTML/CSS inseguro; a largura da barra de progresso é limitada numericamente (`Math.min(100, selectedFloor.budgetStatus.percentage)`).
- **Prevenção de Object Injection:** buscas em coleções utilizam `Array.prototype.find` em vez de indexação dinâmica por chave controlada pelo usuário, mantendo conformidade nativa com `security/detect-object-injection`.
- **Isolamento de rede e segredos:** zero chamadas `fetch`/XHR, zero leitura de variáveis sensíveis, zero armazenamento inseguro em `localStorage`/`cookie` e zero dados pessoais reais nas fixtures.
- **Tratamento de erro seguro:** a variante `error` apresenta apenas `title`, `userMessage`, `httpStatus`, `code` e `correlationId` (`corr-demo-...`), sem expor stack traces ou detalhes internos de infraestrutura.
- **Demonstração de controle de acesso por papel:** na organização `vereda-logistica` (`activeRole: "viewer"`), `canDecideApprovals` é `false` e os botões de decisão humana são substituídos por aviso explícito de somente-leitura (`requiredPermission: "approvals:decide"`).

### 1.4 Documentação e Lesson (`AGENTS.md` e `WEB-MOCK-AC-07`)
- O documento de entrega `documentacoes/interface-web/2026-10-30-loc-web-001-frontend-mockado.md`, o arquivo de diffs `2026-10-30-loc-web-001-frontend-mockado-diffs.md`, a lesson `lessons/14 - Estado deterministico de UI e fronteira de mocks no Next.js.md` e o índice `lessons/README.md` estão completos, íntegros e deixam explícito que os tickets canônicos `WEB-001`, `WEB-003` e `WEB-005` permanecem abertos.

---

## 2. Achados

Nenhum achado. Nenhum problema fundamentado no escopo revisado.

---

## 3. Verificações e Riscos Residuais

- **Verificado e OK:** aderência integral aos critérios `WEB-MOCK-AC-01` a `WEB-MOCK-AC-07`, preservando a rota `/healthz` intacta e sem adicionar dependências ao `package.json`.
- **Riscos residuais:** como previsto na especificação `LOC-WEB-001`, os contratos em `apps/web/lib/mock-types.ts` são exclusivos para validação visual local e deverão ser substituídos pelos schemas canônicos de `@nucleos/contracts` e pelo cliente `@nucleos/sdk` quando os tickets `WEB-001` a `WEB-005` forem executados.

---

## 4. Veredito Final

**Veredito:** `APPROVED`

```yaml
FLUXO_EVENTO:
  etapa: review
  tarefa: LOC-WEB-001
  lote: lote-2026-10-30-frontend-mockado
  veredito: APPROVED
  achados_abertos: 0
  bloqueios: 0
```
