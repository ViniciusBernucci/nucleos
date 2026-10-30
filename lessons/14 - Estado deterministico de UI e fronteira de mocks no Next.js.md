# 14 - Estado determinístico de UI e fronteira de mocks no Next.js

Criada em 2026-10-30. Última atualização: 2026-10-30. Numeração provisória (o coordenador reconcilia a posição na trilha). Exemplos validados com Node.js 24.22.1, TypeScript 5.9.3 (`strict`), Next.js 16.4.3, React 19.3.1 e Python 3.13.17 (monorepo).

## 1. Objetivo de aprendizagem

Ao concluir esta lição, você será capaz de:

1. Separar **fixtures estáticas**, **transformações determinísticas de domínio/apresentação (seletores puros)** e **componentes visuais React/Next.js** para construir interfaces ricas antes que o backend esteja disponível.
2. Modelar os estados canônicos de uma tela (`ready`, `loading`, `empty`, `error`) de forma determinística e testável sem depender de DOM ou navegador nos testes unitários de lógica.
3. Evitar que dados mockados cristalizem contratos inseguros ou sejam confundidos pelo usuário com dados reais de produção.

## 2. Pré-requisitos e posição na trilha

- **Pré-requisitos:** TypeScript em modo `strict` e lint estático ([02 - Qualidade estatica em TypeScript e Python](02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md)) e noções de sessões e fronteiras de confiança ([01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md)).
- **Posição na trilha:** Bloco 6 (`NestJS e Next.js`) e Bloco 8 (`Testes e CI`).

## 3. Explicação em linguagem simples e modelo mental

Quando o time decide validar a experiência visual do produto enquanto o backend está pausado ou em construção, surgem dois extremos perigosos:

1. **JSX acoplado a dados literais espalhados:** cada componente inventa seus próprios arrays e `if/else`. Quando a API real chega, é preciso reescrever toda a árvore de componentes, e ninguém sabe como a tela se comporta quando a lista vem vazia ou quando ocorre um erro `503`.
2. **Simulação enganosa de segurança/rede:** o frontend guarda tokens falsos em `localStorage` ou finge que o cliente decide permissões reais, criando maus hábitos que vazam para produção.

O **modelo mental da fronteira de mocks** resolve isso dividindo o frontend em três camadas claras:

- **Camada 1 — Fixtures imutáveis (`mock-fixtures.ts`):** dados brutos tipados (`readonly`), sem lógica e com aviso explícito de demonstração.
- **Camada 2 — Seletores e View-Model determinístico (`mock-selectors.ts`):** funções puras que recebem `(orgSlug, variant, filtros)` e devolvem um único objeto `DashboardViewModel` pronto para renderização. Toda regra de cálculo (percentual de orçamento, alerta de 80%/100%, ordenação de andares do edifício, estados `loading`/`empty`/`error`) vive aqui.
- **Camada 3 — Componentes de apresentação (`app/components/*.tsx`):** apenas leem o `DashboardViewModel`, garantem semântica HTML/acessibilidade (`header`, `nav`, `main`, `aria-pressed`, foco visível) e disparam eventos de estado local.

## 4. Relação com a implementação real

Esta lição acompanha a entrega preparatória [LOC-WEB-001 — Fundação navegável do frontend com dados mockados](../documentacoes/interface-web/2026-10-30-loc-web-001-frontend-mockado.md) (especificação em [`lote-2026-10-30-frontend-mockado-web-001.md`](../documentacoes/planejamento-ia/lote-2026-10-30-frontend-mockado-web-001.md)):

- Tipos em `apps/web/lib/mock-types.ts`;
- Fixtures em `apps/web/lib/mock-fixtures.ts`;
- Transformações puras em `apps/web/lib/mock-selectors.ts`;
- Componentes acessíveis em `apps/web/app/components/DashboardClientShell.tsx`, `BuildingFloorMap.tsx` e `OperationsPanels.tsx`;
- Testes nativos com `node:test` em `apps/web/app/dashboard-mock.test.ts`.

## 5. Progressão: do exemplo mínimo ao padrão do projeto

### Exemplo mínimo (anti-padrão comum vs. seletor puro)

Em vez de calcular alertas dentro do JSX, extraímos uma função pura executável em Node.js:

```ts
// exemplo-orcamento.ts
export type BudgetAlertLevel = "healthy" | "warning_80" | "critical_100";

export interface BudgetSummary {
  readonly spentBrl: number;
  readonly limitBrl: number;
  readonly percentage: number;
  readonly alertLevel: BudgetAlertLevel;
}

export function computeBudgetStatus(spent: number, limit: number): BudgetSummary {
  const safeSpent = Math.max(0, spent);
  const safeLimit = Math.max(0, limit);
  const percentage = safeLimit === 0 ? 0 : Math.round((safeSpent / safeLimit) * 100);

  if (percentage >= 100) {
    return { spentBrl: safeSpent, limitBrl: safeLimit, percentage, alertLevel: "critical_100" };
  }
  if (percentage >= 80) {
    return { spentBrl: safeSpent, limitBrl: safeLimit, percentage, alertLevel: "warning_80" };
  }
  return { spentBrl: safeSpent, limitBrl: safeLimit, percentage, alertLevel: "healthy" };
}
```

### Padrão usado no projeto (`deriveDashboardViewModel`)

No projeto, `deriveDashboardViewModel` garante que os estados `loading`, `empty` e `error` nunca vazem listas parciais e que erros sigam o formato seguro de Problem Details (com `correlationId` e mensagem amigável, sem stack trace interna):

```ts
// Trecho conceitual alinhado a apps/web/lib/mock-selectors.ts
import type { DashboardViewModel, DemoStateVariant } from "../apps/web/lib/mock-types.ts";
import { deriveDashboardViewModel } from "../apps/web/lib/mock-selectors.ts";

export function inspecionarVariante(variant: DemoStateVariant): DashboardViewModel {
  return deriveDashboardViewModel({
    orgSlug: "aurora-industrial",
    variant,
  });
}
```

## 6. Erros comuns, trade-offs e quando não usar

1. **Misturar mock com contrato definitivo:** fixtures locais ajudam a validar layout e fluxo de tela, mas **não** substituem `@nucleos/contracts` (JSON Schema/OpenAPI). Quando o backend entrar, a camada `lib/mock-*` deve ser substituída pelo cliente do SDK (`WEB-002`).
2. **Esconder estados de erro e vazio:** protótipos que só mostram o "caminho feliz" falham em produção quando uma organização recém-provisionada (`PROVISIONING`) ainda não tem agentes ou quando o gateway retorna `503`.
3. **Violar regras de segurança do linter (`security/detect-object-injection`):** ao buscar uma organização pelo `slug` vindo de um `<select>`, prefira `ORGANIZATIONS.find((o) => o.slug === slug)` com fallback explícito em vez de indexação dinâmica `ORGANIZATIONS_BY_SLUG[slug]`.
4. **Acessibilidade esquecida em representações visuais:** um mapa de edifício/andares feito com `<div>` clicável exclui usuários de teclado e leitores de tela. Cada andar interativo deve ser um `<button type="button">` com `aria-pressed` e nome acessível claro.

## 7. Como testar ou verificar

Como toda a derivação do `DashboardViewModel` está em funções TypeScript puras, podemos testá-la diretamente com o runner nativo `node --test` do Node 24, sem precisar subir navegador pesado para validar regras de apresentação:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveDashboardViewModel } from "../apps/web/lib/mock-selectors.ts";

test("estado error retorna correlationId e oculta listas operacionais", () => {
  const vm = deriveDashboardViewModel({
    orgSlug: "aurora-industrial",
    variant: "error",
  });

  assert.equal(vm.variant, "error");
  assert.equal(vm.floors.length, 0);
  assert.ok(vm.errorDetails);
  assert.match(vm.errorDetails.correlationId, /^corr-demo-/);
});
```

Para executar no repositório:

```bash
pnpm --filter @nucleos/web test
pnpm --filter @nucleos/web lint
pnpm --filter @nucleos/web build
```

## 8. Exercícios e perguntas de revisão

1. Por que `deriveDashboardViewModel` zera `floors`, `tasks` e `approvals` quando `variant === "error"` ou `variant === "loading"` em vez de manter os arrays da organização no objeto retornado?
2. Como o painel de aprovações humanas diferencia visualmente os papéis `org_admin` e `viewer`, e por que essa verificação visual na UI **não** substitui a autorização no backend quando `WEB-003`/`WEB-004` forem integrados?
3. Adicione um caso de teste verificando que buscar por um termo inexistente em `agentQuery` mantém `selectedFloor` intacto, mas retorna `filteredAgents` vazio (`[]`).
