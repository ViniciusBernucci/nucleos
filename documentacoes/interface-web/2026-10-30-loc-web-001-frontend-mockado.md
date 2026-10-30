# LOC-WEB-001 — Fundação navegável do frontend com dados mockados (2026-10-30)

## 1. Metadados

- **Domínio:** `interface-web`
- **Tarefa:** `LOC-WEB-001` — lote [`lote-2026-10-30-frontend-mockado`](../planejamento-ia/lote-2026-10-30-frontend-mockado.md), especificação canônica [`lote-2026-10-30-frontend-mockado-web-001.md`](../planejamento-ia/lote-2026-10-30-frontend-mockado-web-001.md)
- **Branch da tarefa:** `tarefa/loc-web-001` (worktree `/home/vinicius/nucleos-worktrees/tarefa/loc-web-001`)
- **Branch de integração do lote:** `revisao/2026-10-30-frontend-mockado`
- **Commit inicial / base:** `f322f4b1698f94ae276fdb8838137cd6b7e9cef8` (`revisao/2026-10-25-ep00-ep01-fundacao`; merge-base com `developer`: `c3c0ba4db42694b847fe0ac2a58f6b7ff7a3d9a7`)
- **Estado da entrega:** implementado e validado localmente, submetido aos gates de review e QA independentes
- **Autores:** executor IA (Antigravity) sob coordenação do `orquestrador-fluxo-ia`
- **Diffs completos:** [`2026-10-30-loc-web-001-frontend-mockado-diffs.md`](2026-10-30-loc-web-001-frontend-mockado-diffs.md)

## 2. Objetivo, contexto e escopo

### Contexto

Em `2026-10-30`, o usuário determinou a pausa de novas implementações de backend/motor de IA e redirecionou o foco para a construção do frontend navegável (`apps/web`) alimentado exclusivamente por dados mockados tipados. Esta entrega materializa a fundação visual preparatória (`LOC-WEB-001`) sem encerrar os tickets canônicos [`WEB-001`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-001), [`WEB-003`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-003) e [`WEB-005`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-005), que continuam abertos aguardando autenticação real, Control Plane, SSE e APIs do tenant.

### Escopo incluído (`WEB-MOCK-AC-01` a `WEB-MOCK-AC-07`)

- Shell do produto em Next.js App Router (`/`) com cabeçalho operacional, seletor de organização mockada ativa (`Aurora Industrial` em estado `ACTIVE` com papel `org_admin` e `Vereda Logística` em estado `PROVISIONING` com papel `viewer`) e banner persistente de ambiente de demonstração (`WEB-MOCK-AC-01`).
- Dashboard operacional com cartões de KPIs, agentes e status, fila de tarefas, painel de aprovações humanas (HITL) com hash da ação e resumo do servidor, orçamento mensal de IA com alertas em 80% e 100%, e trilha de atividade/segurança do tenant derivados de fixtures TypeScript locais (`WEB-MOCK-AC-02`).
- Representação visual 2D acessível do edifício virtual e seus andares/departamentos contratados (corte vertical interativo do prédio + inspeção de estações de trabalho de agentes e filtro local), responsiva em desktop e mobile sem uso de WebGL nem novas dependências (`WEB-MOCK-AC-03`).
- Representação determinística dos estados `ready` (normal), `loading` (carregando), `empty` (vazio) e `error` (erro padronizado com `correlationId` e mensagem amigável sem stack trace interna), selecionáveis na UI e cobertos por testes unitários com `node:test` (`WEB-MOCK-AC-04`).
- Semântica HTML e acessibilidade: link de salto (`.skip-link`), landmarks (`aside`, `header`, `nav`, `main`, `section`, `footer`), hierarquia coerente de títulos (`h1` → `h2` → `h3`), controles nativos (`button`, `select`, `input[type="search"]`) com `label`/`aria-label`/`aria-pressed` e anel de foco `:focus-visible` de alto contraste (`WEB-MOCK-AC-05`).
- Aprovação nos gates da raiz (`make lint`, `make test`, `make build`) preservando `/healthz` (`WEB-MOCK-AC-06`).
- Documentação de entrega, patch completo e lesson didática atualizados (`WEB-MOCK-AC-07`).

### Fora de escopo (respeitado)

- Qualquer chamada de rede (`fetch`), endpoint novo de backend, banco de dados, fila, cookie, token ou autenticação real.
- Conclusão formal dos tickets `WEB-001`, `WEB-002`, `WEB-003`, `WEB-004`, `WEB-005` ou `WEB-008`.
- Adição de bibliotecas externas de UI, ícones, estado ou WebGL/Three.js (`package.json` mantido sem novas dependências).

## 3. Resumo do que foi implementado

1. **Fronteira de tipos e fixtures locais (`apps/web/lib/`):**
   - `mock-types.ts`: define os tipos imutáveis (`readonly`) para organizações, andares/departamentos, agentes, tarefas, aprovações humanas, eventos de segurança, Problem Details simulado e o `DashboardViewModel`.
   - `mock-fixtures.ts`: fornece duas organizações demonstrativas contrastantes (`aurora-industrial`, com 4 andares contratados, 7 agentes, alertas de orçamento em 85% e 100%, aprovações pendentes e eventos de segurança; e `vereda-logistica`, em estado `PROVISIONING` e papel `viewer` somente-leitura).
   - `mock-selectors.ts`: implementa funções puras e determinísticas (`listMockOrganizations`, `getMockOrganizationBySlug`, `roleCanDecideApprovals`, `computeBudgetStatus`, `deriveDashboardViewModel`) sem indexação dinâmica insegura (`security/detect-object-injection`).
2. **Experiência visual e componentes acessíveis (`apps/web/app/`):**
   - `globals.css`: variáveis CSS de alto contraste, layout responsivo (grid de duas colunas em desktop colapsando para coluna única em `< 920px`), estilização do corte vertical do edifício e foco visível `:focus-visible`.
   - `components/DashboardClientShell.tsx`: gerencia a troca entre organizações mockadas, variante determinística de estado (`ready`, `loading`, `empty`, `error`), filtro de navegação (`overview`, `building`, `operations`), seleção de andar, busca de agentes e simulação local de decisão de aprovação.
   - `components/BuildingFloorMap.tsx`: renderiza o corte vertical do edifício (topo ao térreo) com botões de andar (`aria-pressed`) e o painel de estações de trabalho dos agentes daquele departamento.
   - `components/OperationsPanels.tsx`: renderiza os painéis de aprovações humanas (respeitando `canDecideApprovals` conforme papel ativo), tarefas na fila/execução, consumo de orçamento por departamento e eventos recentes de auditoria/segurança.
3. **Testes automatizados (`apps/web/app/dashboard-mock.test.ts`):**
   - 5 testes cobrindo `WEB-MOCK-AC-01` a `WEB-MOCK-AC-04`, cálculo de limiares de orçamento (saudável, >= 80%, >= 100%, divisão por zero), ordenação de andares, filtragem de agentes, estados `ready`/`loading`/`empty`/`error`, restrição do papel `viewer` e fallback de organização.

## 4. Alterações por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `apps/web/lib/mock-types.ts` | Código (novo) | Contratos TypeScript locais para fixtures e `DashboardViewModel`. |
| `apps/web/lib/mock-fixtures.ts` | Código (novo) | Fixtures determinísticas das organizações `aurora-industrial` e `vereda-logistica`. |
| `apps/web/lib/mock-selectors.ts` | Código (novo) | Seletores puros e derivação determinística do estado da interface. |
| `apps/web/app/globals.css` | Estilo (novo) | Estilos responsivos, tema de alto contraste, foco visível e layout do edifício 2D. |
| `apps/web/app/components/BuildingFloorMap.tsx` | Código (novo) | Visualização interativa 2D de andares/departamentos e estações de agentes. |
| `apps/web/app/components/OperationsPanels.tsx` | Código (novo) | Painéis de aprovações humanas, fila de tarefas, orçamento por andar e auditoria. |
| `apps/web/app/components/DashboardClientShell.tsx` | Código (novo) | Shell principal com banner de demonstração, seletores de contexto/estado e landmarks. |
| `apps/web/app/layout.tsx` | Código (alterado) | Inclusão de `globals.css` e metadados descritivos em `pt-BR`. |
| `apps/web/app/page.tsx` | Código (alterado) | Renderização do `DashboardClientShell` na rota raiz `/`. |
| `apps/web/app/dashboard-mock.test.ts` | Teste (novo) | Suíte unitária `node:test` para o modelo e transformações de `LOC-WEB-001`. |
| `documentacoes/interface-web/2026-10-30-loc-web-001-frontend-mockado.md` | Documentação (novo) | Registro completo desta entrega. |
| `documentacoes/interface-web/2026-10-30-loc-web-001-frontend-mockado-diffs.md` | Documentação (novo) | Patch unificado completo do código e testes da tarefa. |
| `lessons/14 - Estado deterministico de UI e fronteira de mocks no Next.js.md` | Lesson (novo) | Material didático sobre fronteira de mocks e estados determinísticos no Next.js. |
| `lessons/README.md` | Lesson (alterado) | Atualização do índice canônico com link para a lesson 14. |

- **Configurações e lockfiles:** nenhuma alteração.
- **Migrações de banco:** nenhuma.

## 5. Decisões técnicas, alternativas e consequências

1. **Separação estrita entre `lib/mock-*` e `app/components/*`:**
   - *Decisão:* concentrar toda derivação de métricas, ordenação de andares e tratamento dos estados `ready`/`loading`/`empty`/`error` em `deriveDashboardViewModel` (`apps/web/lib/mock-selectors.ts`).
   - *Alternativa descartada:* manter arrays e condicionais diretamente dentro dos componentes React.
   - *Consequência:* permite testar 100% das regras de apresentação com `node:test` nativo em milissegundos, sem introduzir bibliotecas de DOM virtual não aprovadas no monorepo, e cria um ponto único de substituição quando o SDK (`WEB-002`) for conectado.
2. **Representação 2D em corte arquitetônico sem WebGL nesta etapa:**
   - *Decisão:* implementar o edifício virtual como corte vertical navegável por teclado (`<button aria-pressed>`) com janelas/estações de trabalho por agente e painel de inspeção lateral.
   - *Alternativa descartada:* adicionar `@react-three/fiber` e `three` agora.
   - *Consequência:* respeita a restrição de zero novas dependências do lote e já entrega o modo 2D acessível exigido como fallback obrigatório por `WEB-005`/`WEB-007`.
3. **Busca por `.find()` em vez de dicionário indexado por chave dinâmica:**
   - *Decisão:* resolver organizações e decisões simuladas com `Array.prototype.find`.
   - *Consequência:* compatibilidade total com `eslint-plugin-security` (`security/detect-object-injection`) e `noUncheckedIndexedAccess` sem supressões de linter.

## 6. Validação executada (resultados reais)

Ambiente: Linux, Node.js `v24.22.1`, pnpm `12.15.0`, Python `3.13.17`, uv `0.13.5`.

| Comando | Resultado |
| --- | --- |
| `make format` | `rc 0` — Prettier formatou os arquivos de `apps/web`; `ruff format` sem alterações. |
| `make lint` | `rc 0` — `lint-ts` (`tsc --noEmit` em 7 pacotes, `eslint .` type-aware, `depcruise`, `prettier --check`), `lint-py` (`compileall`, `uv lock --check`, `ruff`, `mypy`, `lint-imports`), `./scripts/check-secrets.sh` (`gitleaks`), `lint-regressao` (11/11 casos que devem falhar) e `lint-deploy` todos aprovados. |
| `make test` | `rc 0` — `test-ts` (14 tasks turbo, incluindo `@nucleos/web:test` com 6/6 testes passando: 5 testes de `dashboard-mock.test.ts` + 1 teste de `/healthz`) e `test-py` (`pytest` nos 4 serviços Python). |
| `make build` | `rc 0` — `next build` gerou `/` (estático) e `/healthz` (dinâmico) sem avisos; pacotes TS e wheels/sdists Python compilados com sucesso. |

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- **Compatibilidade:** a rota `/healthz` de `apps/web` permanece intacta (`200 OK`, `{"status":"ok","service":"web"}`), preservando compatibilidade com `make up`/`make health` e Docker Compose (`FND-004`).
- **Riscos mitigados:** para evitar que o usuário confunda dados mockados com estado real de produção, um banner superior persistente (`DEMO_ENVIRONMENT_BANNER`) e o rodapé informam explicitamente que a tela opera sobre fixtures estáticas (`LOC-WEB-001`).
- **Observabilidade:** no estado `error`, a interface demonstra a exibição do `correlationId` (`corr-demo-...`) e código de erro sem expor stack trace interna.
- **Rollback:** reverter os commits da branch `tarefa/loc-web-001` restaura o `apps/web/app/page.tsx` minimalista do `FND-001` sem impacto em outros pacotes.

## 8. Commits e diffs da tarefa

- **Commit de código e testes (`tarefa/loc-web-001`):**
  - **SHA:** `4519ed595a1a2ed6bb5d76872b46c62534e864dc` (`4519ed5`)
  - **Mensagem:** `feat(web): implementa fundacao navegavel do frontend com dados mockados (LOC-WEB-001)`
  - **Base:** `f322f4b1698f94ae276fdb8838137cd6b7e9cef8`
- **Commit de documentação e lesson (`tarefa/loc-web-001`):**
  - Registrado na sequência imediata da branch `tarefa/loc-web-001` (o próprio SHA documental consta em `git log tarefa/loc-web-001` e no estado do lote).

O patch unificado completo do commit `4519ed595a1a2ed6bb5d76872b46c62534e864dc` (excluindo `documentacoes/` e `lessons/` para evitar recursão, conforme `AGENTS.md`) está em [`2026-10-30-loc-web-001-frontend-mockado-diffs.md`](2026-10-30-loc-web-001-frontend-mockado-diffs.md).

## 9. Links para lessons criadas e atualizadas

- Lesson criada: [`14 - Estado deterministico de UI e fronteira de mocks no Next.js.md`](../../lessons/14%20-%20Estado%20deterministico%20de%20UI%20e%20fronteira%20de%20mocks%20no%20Next.js.md)
- Índice atualizado: [`lessons/README.md`](../../lessons/README.md)

## 10. Pendências

- Nenhuma pendência dentro do escopo de `LOC-WEB-001`.
- Os tickets canônicos do EP-10 ([`WEB-001`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-001), [`WEB-002`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-002), [`WEB-003`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-003), [`WEB-004`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-004), [`WEB-005`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-005) e [`WEB-008`](../backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-008)) permanecem abertos no backlog para quando o backend e o motor de agentes forem retomados.
