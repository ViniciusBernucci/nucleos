# Pacote de Revisão Humana — Lote 2026-10-30 (Frontend com Dados Mockados)

> **Status do lote:** `PRONTO_PARA_REVISAO_HUMANA` · **Lote:** [`lote-2026-10-30-frontend-mockado`](lote-2026-10-30-frontend-mockado.md) · **Estado:** [`lote-2026-10-30-frontend-mockado-estado.json`](lote-2026-10-30-frontend-mockado-estado.json)

## 1. Resumo Executivo

- **Direcionamento aplicado:**
  - Todas as frentes de backend e motor de IA (`DEC-008`, `FND-007`) foram **pausadas** sem perda de trabalho e marcadas como pausadas no [`checklist-implementacao.md`](../backlog/checklist-implementacao.md).
  - A parte do **prédio 3D (`WEB-005`, `WEB-006`, `WEB-007`)** foi mantida no backlog para uma sessão futura e não foi executada nesta sessão.
  - Revisores de QA foram dispensados conforme solicitação explícita do usuário.
- **O que foi entregue no frontend (`apps/web`) com dados mockados (`LOC-WEB-001`):**
  1. **Shell Multi-Organização, Login, MFA e Guarda 404 A/B (`WEB-001` + `WEB-002` mockados):**
     - Rotas `/`, `/login`, `/orgs` e `/platform`.
     - Alternância entre organizações mockadas (`Aurora Industrial` — estado `ACTIVE`, papel `org_admin`; e `Vereda Logística` — estado `PROVISIONING`, papel `viewer`).
     - Seletor determinístico dos 4 estados de tela: `Normal (ready)`, `Carregando (loading)`, `Vazio (empty)` e `Erro (error)` (com `correlationId` e mensagem amigável sem stack trace).
     - Guarda de isolamento entre tenants (`resolveTenantRouteAccess`): tentar acessar `/orgs/titan-defesa` (organização fora da sessão) retorna **HTTP 404** sem vazar qualquer dado da outra organização.
     - Chave determinística de idempotência (`registerIdempotentMutation`) que bloqueia mutações repetidas (duplo clique).
  2. **Dashboard Operacional e Governança da Organização (`WEB-003` mockado):**
     - KPIs de departamentos, agentes ativos, tarefas na fila, aprovações humanas pendentes e orçamento mensal de IA (com alertas automáticos em **80%** e **100%** da cota).
     - Painéis de **Membros & Papéis** (ocultando ações de mutação para o papel `viewer`), **Módulos Contratados (Entitlements)**, **Integrações do Tool Gateway** (somente metadados, sem segredos), **Documentos & Indexação RAG** (`INDEXED`, `INDEXING`, `QUARANTINED_INJECTION`) e **Exportação CSV de Consumo de IA** protegida contra CSV Formula Injection.
  3. **Conversas com Agentes, Painel HITL e Segurança de Frontend (`WEB-004` + `WEB-008` mockados):**
     - Chat interativo por agente com criação simulada de job, visualização de passos de ferramentas no Tool Gateway (`ALLOW` / `REQUIRE_APPROVAL`), citações de documentos RAG e painel de aprovações humanas com hash da ação.
     - Sanitizador determinístico (`sanitizeAgentMessageContent`): neutraliza payloads `<script>`/XSS (sem usar `dangerouslySetInnerHTML`) e bloqueia carregamento automático de imagens remotas (`![tracker](https://...)`) exibindo placeholder seguro.
  4. **Backoffice de Plataforma (`WEB-009` mockado — `/platform`):**
     - Guarda de papel (`resolvePlatformBackoffice`): bloqueia com **HTTP 403** usuários comuns de tenant e libera apenas para `platform_admin` com MFA.
     - Exibe capacidade da VPS, lista dos 5 tenants com **Kill Switch de Orçamento**, execuções de provisionamento, **Requeue de DLQ com justificativa obrigatória** e concessões **Break-Glass** (estritamente metadados, sem acesso a conversas ou documentos dos tenants).

## 2. Branches e Commits

- **Checkout principal (`/home/vinicius/nucleos`):** já posicionado na branch de revisão `revisao/2026-10-30-frontend-mockado` (e sincronizado com `tarefa/loc-web-001`).
- **Base SHA:** `f322f4b1698f94ae276fdb8838137cd6b7e9cef8` (`revisao/2026-10-25-ep00-ep01-fundacao`).
- **Comandos de leitura do diff:**
  ```bash
  git log --oneline f322f4b1698f94ae276fdb8838137cd6b7e9cef8..revisao/2026-10-30-frontend-mockado
  git diff f322f4b1698f94ae276fdb8838137cd6b7e9cef8...revisao/2026-10-30-frontend-mockado -- apps/web
  ```

## 3. Roteiro para Testar as Telas no Checkout Principal

Para subir o servidor web localmente e navegar pelas telas mockadas:

```bash
export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$HOME/.local/bin:$PATH"
./.run/bin/pnpm --filter @nucleos/web start
# Acesse http://127.0.0.1:3000 (ou /login, /orgs, /platform)
```

## 4. Inventário de Worktrees

| Caminho | Branch | Estado | Motivo |
| --- | --- | --- | --- |
| `/home/vinicius/nucleos-worktrees/tarefa/loc-web-001` | `tarefa/loc-web-001` | Removida com segurança (`archive` concluído) | Integrada em `revisao/2026-10-30-frontend-mockado` |
| `/home/vinicius/nucleos-worktrees/tarefa/dec-008` | `tarefa/dec-008` | Mantida (Pausada) | Trabalho de backend/IA pausado por decisão do usuário |
| `/home/vinicius/nucleos-worktrees/tarefa/fnd-007` | `tarefa/fnd-007` | Mantida (Pausada) | Trabalho de infra/borda pausado por decisão do usuário |
