# Diffs próprios — limpeza do monorepo do MVP

Data: 2026-11-06. [Registro da entrega](2026-11-06-limpeza-monorepo-mvp.md).

Nenhum commit criado nesta tarefa. Diff unstaged entre o snapshot inicial da sessão
e o estado final; nenhuma mudança staged foi criada. As 809 alterações anteriores
não são atribuídas à entrega. Escrita de documentação/lessons excluída do patch.

## Arquivos da entrega

| Caminho | Mudança |
| --- | --- |
| `.DS_Store` | removido |
| `.dependency-cruiser.cjs` | alterado |
| `.gitignore` | alterado |
| `.importlinter` | alterado |
| `AGENTS.md` | alterado |
| `CODEOWNERS` | alterado |
| `README.md` | alterado |
| `apps/tenant-provisioner/package.json` | removido |
| `apps/tenant-provisioner/src/main.ts` | removido |
| `apps/tenant-provisioner/src/server.test.ts` | removido |
| `apps/tenant-provisioner/src/server.ts` | removido |
| `apps/tenant-provisioner/tsconfig.json` | removido |
| `apps/web/app/components/NavLink.tsx` | alterado |
| `apps/web/app/layout.tsx` | alterado |
| `apps/web/next-env.d.ts` | alterado |
| `documentacoes/.DS_Store` | removido |
| `documentacoes/README.md` | novo |
| `documentacoes/arquitetura/README.md` | novo |
| `documentacoes/arquitetura/adr/0027-monorepo-enxuto-para-o-mvp-local.md` | novo |
| `documentacoes/arquitetura/adr/README.md` | alterado |
| `documentacoes/engenharia/comandos-validacao-ia.md` | alterado |
| `documentacoes/engenharia/contexto-node-legado.md` | alterado |
| `eslint.config.mjs` | alterado |
| `infrastructure/ansible/README.md` | removido |
| `infrastructure/docker/compose.dev.yml` | alterado |
| `infrastructure/docker/scripts/smoke.sh` | alterado |
| `infrastructure/kubernetes/README.md` | removido |
| `infrastructure/terraform/README.md` | removido |
| `lessons/.gitkeep` | removido |
| `lessons/02 - Qualidade estatica em TypeScript e Python.md` | alterado |
| `lessons/22 - Monorepo e monolito modular no MVP.md` | novo |
| `lessons/README.md` | alterado |
| `package.json` | alterado |
| `packages/config/src/primitives.ts` | alterado |
| `packages/config/src/secret.ts` | alterado |
| `packages/contracts/scripts/gerar.test.mjs` | alterado |
| `packages/observability/src/context.ts` | alterado |
| `packages/observability/src/http.ts` | alterado |
| `packages/observability/src/observability.test.ts` | alterado |
| `packages/observability/src/red.ts` | alterado |
| `packages/observability/src/redact.test.ts` | alterado |
| `packages/observability/src/redact.ts` | alterado |
| `packages/observability/src/telemetry.ts` | alterado |
| `pnpm-lock.yaml` | alterado |
| `pyproject.toml` | alterado |
| `scripts/contexto-projeto.json` | removido |
| `scripts/instalar-contexto.sh` | removido |
| `scripts/local.sh` | alterado |
| `services/ai-gateway/pyproject.toml` | alterado |
| `services/ai-gateway/src/ai_gateway/app.py` | alterado |
| `services/event-dispatcher/pyproject.toml` | removido |
| `services/event-dispatcher/src/event_dispatcher/__init__.py` | removido |
| `services/event-dispatcher/src/event_dispatcher/__main__.py` | removido |
| `services/event-dispatcher/src/event_dispatcher/app.py` | removido |
| `services/event-dispatcher/tests/test_health.py` | removido |
| `services/tenant-runtime/pyproject.toml` | removido |
| `services/tenant-runtime/src/tenant_runtime/__init__.py` | removido |
| `services/tenant-runtime/src/tenant_runtime/__main__.py` | removido |
| `services/tenant-runtime/src/tenant_runtime/app.py` | removido |
| `services/tenant-runtime/src/tenant_runtime/policy/__init__.py` | removido |
| `services/tenant-runtime/tests/test_health.py` | removido |
| `services/tool-gateway/pyproject.toml` | removido |
| `services/tool-gateway/src/tool_gateway/__init__.py` | removido |
| `services/tool-gateway/src/tool_gateway/__main__.py` | removido |
| `services/tool-gateway/src/tool_gateway/app.py` | removido |
| `services/tool-gateway/tests/test_health.py` | removido |
| `skills/README.md` | alterado |
| `skills/modelos/AGENTS.md` | removido |
| `skills/modelos/CLAUDE.md` | removido |
| `skills/modelos/README.md` | removido |
| `skills/skills/arquiteto-de-software/SKILL.md` | novo |
| `skills/skills/arquiteto-de-software/references/roteiro-arquitetural.md` | novo |
| `tools/contexto-legado/contexto-projeto.json` | novo |
| `tools/contexto-legado/instalar-contexto.sh` | novo |
| `tools/qualidade/regressao.mjs` | alterado |
| `tools/qualidade/regressao/README.md` | alterado |
| `tools/qualidade/regressao/python/imports/nucleos_config/__init__.py` | novo |
| `tools/qualidade/regressao/python/imports/nucleos_contracts/__init__.py` | novo |
| `tools/qualidade/regressao/python/imports/nucleos_observability/__init__.py` | novo |
| `tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py` | removido |
| `tools/qualidade/regressao/python/imports/tool_gateway/__init__.py` | removido |
| `uv.lock` | alterado |
| `documentacoes/transversal/2026-11-06-limpeza-monorepo-mvp.md` | novo: registro e verificações |
| `documentacoes/transversal/2026-11-06-limpeza-monorepo-mvp-diffs.md` | novo: patch e lista própria |

## Normalização de finais de linha

Estes arquivos tiveram somente CRLF convertido para LF, sem diff lógico no Git:

- `apps/api/src/health.controller.ts`
- `apps/api/src/health.test.ts`
- `apps/api/src/observability.ts`
- `apps/web/app/components/AgentChatAndSecurityPanel.tsx`
- `apps/web/app/components/AuthAndMultiOrgPanel.tsx`
- `apps/web/app/components/BuildingFloorMap.tsx`
- `apps/web/app/components/DashboardClientShell.tsx`
- `apps/web/app/components/OperationsPanels.tsx`
- `apps/web/app/components/OrganizationGovernancePanel.tsx`
- `apps/web/app/components/OverviewPanel.tsx`
- `apps/web/app/components/PlatformBackofficePanel.tsx`
- `apps/web/app/dashboard-mock.test.ts`
- `apps/web/app/healthz/route.test.ts`
- `apps/web/app/healthz/route.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/orgs/page.tsx`
- `apps/web/lib/mock-enterprise-data.ts`
- `apps/web/lib/mock-fixtures.ts`
- `apps/web/lib/mock-security.ts`
- `apps/web/lib/mock-selectors.ts`
- `apps/web/lib/mock-types.ts`
- `lefthook.yml`
- `packages/contracts/src/contratos.test.ts`
- `packages/contracts/src/datetime.ts`
- `packages/contracts/src/exemplos.ts`
- `packages/contracts/src/index.test.ts`
- `packages/contracts/src/runtime-token.ts`
- `packages/contracts/src/validators.ts`
- `packages/observability/src/index.ts`
- `packages/observability/src/logger.ts`
- `packages/sdk/src/index.test.ts`
- `packages/sdk/src/index.ts`
- `tools/qualidade/regressao-ci.mjs`

## Binários removidos

| Caminho | Bytes iniciais | SHA-256 inicial |
| --- | --- | --- |
| `.DS_Store` | 6148 | `eaa82f29ce242e036facf5f8b018be0274558f0cbc057b54bcf151af4b927dc3` |
| `documentacoes/.DS_Store` | 6148 | `d65165279105ca6773180500688df4bdc69a2c7b771752f0a46ef120b7fd8ec3` |

## Patch textual de código, configuração e ferramentas

````diff
diff --git a/.dependency-cruiser.cjs b/.dependency-cruiser.cjs
--- a/.dependency-cruiser.cjs
+++ b/.dependency-cruiser.cjs
@@ -37,14 +37,6 @@
       from: { path: "^packages/" },
       to: { path: "^apps/" },
     },
-    {
-      name: "provisioner-so-no-tenant-provisioner",
-      comment:
-        "SDK/codigo do provisioner nao e importado por outros apps (ver tenant-runtime em Python).",
-      severity: "error",
-      from: { path: "^apps/(?!tenant-provisioner/)" },
-      to: { path: "^apps/tenant-provisioner/" },
-    },
     { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
   ],
   options: {
diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -11,6 +11,7 @@
 .pytest_cache/
 .ruff_cache/
 .mypy_cache/
+.import_linter_cache/
 
 # Execucao local (pids, logs)
 .run/
diff --git a/.importlinter b/.importlinter
--- a/.importlinter
+++ b/.importlinter
@@ -1,26 +1,28 @@
-# Regras de arquitetura de imports Python (ENT-FND-002). Executar: lint-imports
+# Pacotes compartilhados nao dependem do servico que os consome (ADR-027).
+# Executar: uv run --frozen lint-imports
 [importlinter]
 root_packages =
     ai_gateway
-    tool_gateway
-    event_dispatcher
-    tenant_runtime
+    nucleos_config
+    nucleos_contracts
+    nucleos_observability
 include_external_packages = True
 
-[importlinter:contract:servicos-independentes]
-name = Servicos Python nao importam uns aos outros
-type = independence
-modules =
-    ai_gateway
-    tool_gateway
-    event_dispatcher
-    tenant_runtime
-
-[importlinter:contract:tenant-runtime-sem-sdk-provisioner]
-name = tenant-runtime nao importa o SDK do provisioner
+[importlinter:contract:packages-sem-servicos]
+name = Pacotes compartilhados nao importam servicos
 type = forbidden
 source_modules =
-    tenant_runtime
+    nucleos_config
+    nucleos_contracts
+    nucleos_observability
 forbidden_modules =
-    tenant_provisioner
-    nucleos_provisioner
+    ai_gateway
+
+[importlinter:contract:contratos-independentes]
+name = Contratos Python nao importam outros pacotes internos
+type = forbidden
+source_modules =
+    nucleos_contracts
+forbidden_modules =
+    nucleos_config
+    nucleos_observability
diff --git a/AGENTS.md b/AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -69,13 +69,19 @@
   `.claude/skills/` (Claude Code), `.agents/skills/` (Codex e Antigravity) e
   `.agent/skills/` (Antigravity legado). Edite somente a fonte e depois rode
   `node scripts/instalar-skills.mjs --apply` e `node scripts/instalar-skills.mjs --check`.
-- **Conjunto instalado:** `grill-me`, `planejador-de-lote-v1`, `revisor-de-codigo`,
+- **Conjunto instalado:** `arquiteto-de-software`, `grill-me`, `planejador-de-lote-v1`, `revisor-de-codigo`,
   `tech-lead` e `worktree-planner`. Não invoque as skills antigas removidas.
 - **Perfil:** preset `generic`. Este projeto NAO e Intranet: ignore `references/intranet.md`,
   ORCA, SQL Server, ClickUp e `{FONTE_CLAUDE}`; use a instalacao das skills deste repositorio.
 - **Repositorios:** um unico repositorio Git, `nucleos` (raiz `.`, camada `monorepo`), com
   branch padrao `main` e branch de trabalho `developer`. Camadas conforme o ADR de
   2026-10-25 (secao 14): `apps/`, `services/`, `packages/` e `infrastructure/`; consulte o estado atual antes de planejar.
+- **MVP local vigente:** web Next.js, API NestJS modular por dominio e `services/ai-gateway`
+  para o CFO. Os esbocos sem negocio de provisioner, tenant-runtime, tool-gateway e
+  event-dispatcher foram removidos na limpeza autorizada de 2026-11-06. Nao recrie
+  servicos ou pastas de infraestrutura por antecipacao. Veja a
+  [arquitetura atual](documentacoes/arquitetura/README.md) e a proposta ADR-027;
+  a topologia multi-tenant de producao continua sujeita aos ADRs e gates existentes.
 - **Fuso operacional:** `America/Sao_Paulo`.
 - **Documentos:** planos, manifesto e estado do lote em `documentacoes/planejamento-ia/`;
   relatorios de review, auditoria e QA em `documentacoes/reviews/`. O registro de cada
diff --git a/CODEOWNERS b/CODEOWNERS
--- a/CODEOWNERS
+++ b/CODEOWNERS
@@ -3,7 +3,7 @@
 
 # Caminhos de seguranca: exigem revisor adicional (ver FND-005 para a branch protection).
 # Substituir/adicionar o time de seguranca quando existir (ex.: @org/seguranca).
-/services/tool-gateway/        @ViniciusBernucci
-/apps/tenant-provisioner/      @ViniciusBernucci
+/services/ai-gateway/          @ViniciusBernucci
+/apps/api/                     @ViniciusBernucci
 /infrastructure/               @ViniciusBernucci
 /CODEOWNERS                    @ViniciusBernucci
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,71 +1,67 @@
 # Núcleos
 
-Especificação e documentação do projeto: [Nucleos-Especificacao-Mestra.md](Nucleos-Especificacao-Mestra.md)
-e [documentacoes/](documentacoes/). Regras para agentes de IA: [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md).
+Monorepositório do MVP: painel Next.js, API NestJS organizada por domínio e gateway
+Python para o CFO consultivo. O PostgreSQL é único, com schemas por assunto.
 
-## Convencoes de engenharia
+## Estrutura
 
-Lint, formatacao, hooks, commits e branches: [documentacoes/engenharia/convencoes-commits-e-branches.md](documentacoes/engenharia/convencoes-commits-e-branches.md). Comandos: `make lint`, `make format`, `make hooks`.
+| Pasta | Responsabilidade |
+| --- | --- |
+| `apps/web/` | Interface Next.js e chamadas à API pelo servidor |
+| `apps/api/` | Negócio, integrações, tarefas duráveis e migrations |
+| `services/ai-gateway/` | CFO, provedor de IA e limites de execução/custo |
+| `packages/` | Contratos, SDK, configuração e observabilidade compartilhados |
+| `infrastructure/docker/` | Compose local e configurações de deploy |
+| `scripts/` | Desenvolvimento, verificações e CI |
+| `tools/` | Fixtures de qualidade e Contexto legado opcional |
+| `documentacoes/` | Decisões, operação, planos e registros de entrega |
+| `lessons/` | Material didático da stack |
+| `skills/skills/` | Fonte das skills; cópias de descoberta nos diretórios dos agentes |
 
-## Skills de IA (Claude Code, Codex e Antigravity)
+Consulte o [mapa da arquitetura atual](documentacoes/arquitetura/README.md) e o
+[índice da documentação](documentacoes/README.md). A
+[Especificação Mestra](Nucleos-Especificacao-Mestra.md) preserva o histórico de produto;
+a stack vigente é TypeScript/Python, conforme os ADRs e o código atual.
 
-As skills do fluxo de desenvolvimento (planejamento, implementação, review, QA e
-fechamento) já estão instaladas no repositório. Basta abrir o projeto no agente:
+## Desenvolvimento
 
-| Agente | Onde as skills ficam | Regras que o agente lê |
-| --- | --- | --- |
-| Claude Code | `.claude/skills/` | `CLAUDE.md` |
-| Codex | `.agents/skills/` | `AGENTS.md` |
-| Antigravity | `.agents/skills/` (e `.agent/skills/`, legado) | `.agents/rules/project-instructions.md` (regra Always On) |
+Versões em [.nvmrc](.nvmrc), [package.json](package.json),
+[.python-version](.python-version) e [pyproject.toml](pyproject.toml).
 
-A fonte das skills é `skills/skills/`; as pastas acima são cópias. Para alterar uma
-skill, edite só a fonte e atualize as cópias:
-
-```bash
-node scripts/instalar-skills.mjs --apply
-node scripts/instalar-skills.mjs --check
+```sh
+make setup
+cp .env.example .env
+npm run dev
 ```
 
-O `--check` deve terminar com `0 divergências` e `0 extras`. O conjunto instalado é:
-`grill-me`, `planejador-de-lote-v1`, `revisor-de-codigo`, `tech-lead` e `worktree-planner`.
-Os arquivos importados são idênticos à origem; a aplicação dos caminhos e da stack
-do Nucleos está em [AGENTS.md](AGENTS.md#aplicação-das-skills-importadas-neste-projeto).
-As antigas skills, inclusive `archify`, foram retiradas das pastas de descoberta.
+Preencha as variáveis necessárias em `.env`. API e Next.js carregam esse arquivo;
+variáveis exportadas têm precedência. Web: `127.0.0.1:3000`; API: `127.0.0.1:3001`.
+O comando `dev` inicia esses dois processos. O gateway de IA, quando necessário,
+roda separadamente com suas variáveis exportadas:
 
-Para planejar, peça "use a skill planejador-de-lote-v1". O resultado é um plano em
-Markdown; implementação exige um pedido separado. A descoberta nos três clientes
-está preparada; recarregue o projeto ou abra uma nova sessão para renovar o catálogo.
+```sh
+uv run --frozen --package nucleos-ai-gateway python -m ai_gateway
+```
 
-## Ferramentas de IA e contexto
+O gateway usa `127.0.0.1:8002`. Sem credenciais, o CFO fica indisponível.
+O banco Docker existente usa `127.0.0.1:15432`; a limpeza não altera seus dados.
+`DATABASE_URL` não deve embutir senha. Hotmart sem credenciais fica desativada;
+credenciais incompletas ou fontes de segredo conflitantes impedem a subida.
+Chaves internas ficam somente no servidor, nunca em `NEXT_PUBLIC_*`.
+Veja [.env.example](.env.example), [banco único](documentacoes/dados/banco-unico-nucleos.md)
+e [gestão de segredos](documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md).
 
-Regras canônicas: [AGENTS.md](AGENTS.md). Não executar indexação/preparação Node
-no início da sessão. Para uso antigo explicitamente solicitado, consulte
-[Contexto Node legado](documentacoes/engenharia/contexto-node-legado.md).
-Não copie o bloco antigo de indexação para CLAUDE.md ou AGENTS.md.
+## Verificação e ferramentas
 
-## Configuracao do MVP com .env
+`make lint`, `make test`, `make build` e `make contracts-check` são os comandos comuns.
+Pré-requisitos e ambientes permitidos estão no
+[guia de validação](documentacoes/engenharia/comandos-validacao-ia.md).
+Testes visuais são manuais. Convenções e hooks:
+[guia de engenharia](documentacoes/engenharia/convencoes-commits-e-branches.md).
 
-Copie [.env.example](.env.example) para `.env` na raiz e preencha `DATABASE_PASSWORD`,
-`HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET` e `VENDAS_API_KEY`. A API e o servidor
-Next.js carregam esse arquivo; variaveis ja exportadas tem precedencia. Reinicie os processos
-apos editar. A URL do banco fica em `DATABASE_URL`, sem senha embutida. No desenvolvimento
-fora do Docker, o Postgres do Compose fica em `127.0.0.1:15432`; use a senha ja criada
-em `infrastructure/docker/.env.local`. O preenchimento do .env nao modifica o banco.
-
-Hotmart sem as duas credenciais fica desativada; uma credencial isolada e erro. A chave de
-vendas deve ser a mesma no servidor web e na API, nunca `NEXT_PUBLIC_*` nem `nextConfig.env`.
-`*_FILE` permanece opcional; configurar as duas fontes para a mesma credencial e erro.
-Os overlays endurecidos de staging/producao continuam com transporte por arquivo.
-Em Docker dev, sobrescreva `DATABASE_URL` com o host interno `postgres:5432` e
-`VENDAS_API_URL` com `http://api:3001` (o .env de execucao no host usa loopback).
-
-O .env real e ignorado pelo Git e pelo build Docker. Nao publique seus valores em logs,
-capturas de ambiente ou `docker inspect`: o ambiente pode ser lido por administradores.
-Veja a [decisao atual](documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md)
-e o [registro da mudanca](documentacoes/transversal/2026-11-01-configuracao-env-mvp.md).
-
-O painel de vendas oferece **Atualizar agora**: dispara uma sincronizacao imediata e
-recarrega os dados ao concluir. HOTMART_CLIENT_TOKEN aceita o token Basic fornecido pela
-Hotmart (preferencialmente sem o prefixo Basic); se ausente, mantem a derivacao anterior.
-As URLs externas continuam no cliente da integracao. VENDAS_API_URL aponta apenas para
-a API interna do NUCLEOS. Veja a [entrega](documentacoes/financeiro/2026-11-01-atualizacao-manual-hotmart.md).
+Regras de IA: [AGENTS.md](AGENTS.md). As seis skills são descobertas em
+`.claude/skills/`, `.agents/skills/` e `.agent/skills/`; veja [skills/README.md](skills/README.md).
+Edite a fonte e sincronize com `node scripts/instalar-skills.mjs --apply`;
+confira com `node scripts/instalar-skills.mjs --check`.
+O [Contexto Node legado](documentacoes/engenharia/contexto-node-legado.md) é opcional,
+somente por solicitação explícita. Não integra a inicialização do produto.
diff --git a/apps/tenant-provisioner/package.json b/apps/tenant-provisioner/package.json
deleted file mode 100644
--- a/apps/tenant-provisioner/package.json
+++ /dev/null
@@ -1,13 +0,0 @@
-{
-  "name": "@nucleos/tenant-provisioner",
-  "version": "0.0.0",
-  "private": true,
-  "type": "module",
-  "scripts": {
-    "build": "tsc -p tsconfig.json",
-    "lint": "tsc -p tsconfig.json --noEmit",
-    "test": "node --test \"dist/**/*.test.js\"",
-    "start": "node dist/main.js"
-  },
-  "dependencies": { "@nucleos/contracts": "workspace:*", "@nucleos/observability": "workspace:*" }
-}
diff --git a/apps/tenant-provisioner/src/main.ts b/apps/tenant-provisioner/src/main.ts
deleted file mode 100644
--- a/apps/tenant-provisioner/src/main.ts
+++ /dev/null
@@ -1,7 +0,0 @@
-import { createHealthServer } from "./server.js";
-
-const host = process.env["HOST"] ?? "127.0.0.1";
-const port = Number(process.env["PORT"] ?? 3002);
-createHealthServer().listen(port, host, () => {
-  console.log(`tenant-provisioner em http://${host}:${port}`);
-});
diff --git a/apps/tenant-provisioner/src/server.test.ts b/apps/tenant-provisioner/src/server.test.ts
deleted file mode 100644
--- a/apps/tenant-provisioner/src/server.test.ts
+++ /dev/null
@@ -1,64 +0,0 @@
-import assert from "node:assert/strict";
-import type { AddressInfo } from "node:net";
-import { test } from "node:test";
-import { createObservability } from "@nucleos/observability";
-import { createHealthServer } from "./server.js";
-
-const SENTINEL = "SENTINEL_provisioner_5ec7e7";
-const meta = { service: "tenant-provisioner", version: "9.9.9", env: "test" };
-
-async function withServer(fn: (base: string, logs: string[]) => Promise<void>): Promise<void> {
-  const logs: string[] = [];
-  const kit = createObservability(
-    { ...meta, level: "debug", destination: { write: (l) => void logs.push(l) } },
-    { ...meta, enabled: false },
-  );
-  const server = createHealthServer("tenant-provisioner", kit, { self: () => true });
-  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
-  const { port } = server.address() as AddressInfo;
-  try {
-    await fn(`http://127.0.0.1:${port}`, logs);
-  } finally {
-    server.close();
-  }
-}
-
-test("GET /healthz responde 200 ok", async () => {
-  await withServer(async (base) => {
-    const res = await fetch(`${base}/healthz`);
-    assert.equal(res.status, 200);
-    assert.deepEqual(await res.json(), { status: "ok", service: "tenant-provisioner" });
-    assert.equal((await fetch(`${base}/outra`)).status, 404);
-  });
-});
-
-test("GET /readyz responde 200 ready sem expor versao", async () => {
-  await withServer(async (base) => {
-    const res = await fetch(`${base}/readyz`);
-    assert.equal(res.status, 200);
-    assert.deepEqual(await res.json(), { status: "ready", service: "tenant-provisioner" });
-  });
-});
-
-test("X-Request-Id do cliente e ignorado (trustEdge=false); nenhum sentinela aparece no log", async () => {
-  await withServer(async (base, logs) => {
-    const res = await fetch(`${base}/outra?token=${SENTINEL}`, {
-      headers: {
-        "x-request-id": "edge-prov-0001",
-        authorization: `Bearer ${SENTINEL}`,
-        cookie: `s=${SENTINEL}`,
-      },
-    });
-    const returned = res.headers.get("x-request-id");
-    assert.notEqual(returned, "edge-prov-0001"); // padrao trustEdge=false: id do cliente e ignorado
-    assert.match(String(returned), /^[0-9a-f-]{36}$/);
-    await new Promise((r) => setTimeout(r, 50));
-    const record = JSON.parse(logs.find((l) => l.includes("http.request")) ?? "{}") as Record<
-      string,
-      unknown
-    >;
-    assert.equal(record["correlation_id"], returned);
-    assert.equal((record["data"] as Record<string, unknown>)["route"], "unmatched");
-    assert.ok(!logs.join("").includes(SENTINEL));
-  });
-});
diff --git a/apps/tenant-provisioner/src/server.ts b/apps/tenant-provisioner/src/server.ts
deleted file mode 100644
--- a/apps/tenant-provisioner/src/server.ts
+++ /dev/null
@@ -1,47 +0,0 @@
-import { createServer, type Server } from "node:http";
-import {
-  type Observability,
-  type ReadinessChecks,
-  createObservability,
-  handleProbe,
-  observeHttp,
-  telemetryConfigFromEnv,
-} from "@nucleos/observability";
-
-const SERVICE = "tenant-provisioner";
-const ROUTES = new Set(["/healthz", "/readyz"]);
-
-export function createDefaultObservability(service = SERVICE): Observability {
-  const meta = {
-    service,
-    version: process.env["APP_VERSION"] ?? "0.0.0",
-    env: process.env["APP_ENV"] ?? "local",
-  };
-  return createObservability(meta, telemetryConfigFromEnv(process.env, meta));
-}
-
-export function createHealthServer(
-  service = SERVICE,
-  kit: Observability = createDefaultObservability(service),
-  checks: ReadinessChecks = {},
-): Server {
-  const handler = observeHttp(
-    kit,
-    (req, res) => {
-      void handleProbe(kit, service, req, res, checks).then((handled) => {
-        if (!handled) res.writeHead(404).end();
-      });
-    },
-    {
-      // Template de rota: caminho nao declarado vira "unmatched" (cardinalidade controlada).
-      routeOf: (req) => {
-        const path = (req.url ?? "").split("?")[0] ?? "";
-        return ROUTES.has(path) ? path : undefined;
-      },
-      quietRoutes: ["/healthz", "/readyz"],
-    },
-  );
-  const server = createServer(handler);
-  server.on("close", () => void kit.telemetry.shutdown());
-  return server;
-}
diff --git a/apps/tenant-provisioner/tsconfig.json b/apps/tenant-provisioner/tsconfig.json
deleted file mode 100644
--- a/apps/tenant-provisioner/tsconfig.json
+++ /dev/null
@@ -1,5 +0,0 @@
-{
-  "extends": "../../tsconfig.base.json",
-  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
-  "include": ["src"]
-}
diff --git a/apps/web/app/components/NavLink.tsx b/apps/web/app/components/NavLink.tsx
--- a/apps/web/app/components/NavLink.tsx
+++ b/apps/web/app/components/NavLink.tsx
@@ -4,9 +4,18 @@
 import { usePathname } from "next/navigation";
 import type { ReactNode } from "react";
 
-export function NavLink({ href, code, children }: { href: string; code: string; children: ReactNode }) {
+export function NavLink({
+  href,
+  code,
+  children,
+}: {
+  href: string;
+  code: string;
+  children: ReactNode;
+}) {
   const pathname = usePathname();
-  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
+  const active =
+    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
 
   return (
     <Link href={href} className="nav-button" aria-current={active ? "page" : undefined}>
diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -14,9 +14,7 @@
       <head>
         <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
       </head>
-      <body>
-        {children}
-      </body>
+      <body>{children}</body>
     </html>
   );
 }
diff --git a/apps/web/next-env.d.ts b/apps/web/next-env.d.ts
--- a/apps/web/next-env.d.ts
+++ b/apps/web/next-env.d.ts
@@ -1,7 +1,7 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
-import "./.next/dev/types/routes.d.ts";
-import "./.next/dev/types/root-params.d.ts";
+import "./.next/types/routes.d.ts";
+import "./.next/types/root-params.d.ts";
 
 // NOTE: This file should not be edited
 // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
diff --git a/eslint.config.mjs b/eslint.config.mjs
--- a/eslint.config.mjs
+++ b/eslint.config.mjs
@@ -15,6 +15,12 @@
       "**/.turbo/**",
       "**/.run/**",
       "**/node_modules/**",
+      "**/.venv/**",
+      "**/__pycache__/**",
+      "**/.pytest_cache/**",
+      "**/.mypy_cache/**",
+      "**/.ruff_cache/**",
+      "**/.import_linter_cache/**",
       "**/next-env.d.ts", // gerado pelo Next.js (REVIEW-004): versionado, nao linta
       "**/generated/**", // gerado por packages/contracts/scripts/gerar.mjs (FND-003): drift e verificado, tsc linta
       ...(regressao ? [] : ["tools/qualidade/regressao/**"]), // fixtures que DEVEM falhar
diff --git a/infrastructure/ansible/README.md b/infrastructure/ansible/README.md
deleted file mode 100644
--- a/infrastructure/ansible/README.md
+++ /dev/null
@@ -1,3 +0,0 @@
-# ansible
-
-Provisionamento de hosts (estagio 1): entra em ticket proprio. Sem codigo nesta fase.
diff --git a/infrastructure/docker/compose.dev.yml b/infrastructure/docker/compose.dev.yml
--- a/infrastructure/docker/compose.dev.yml
+++ b/infrastructure/docker/compose.dev.yml
@@ -183,53 +183,12 @@
       timeout: 5s
       retries: 30
 
-  tenant-provisioner:
-    <<: *app-node
-    volumes: ["../../:/workspace:ro", "/dev/null:/workspace/infrastructure/docker/.env.local:ro"]
-    environment: {<<: *app-env, PORT: "3002"}
-    command: ["node", "--watch", "apps/tenant-provisioner/dist/main.js"]
-    healthcheck:
-      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3002/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
-      interval: 5s
-      timeout: 5s
-      retries: 30
-
-  tenant-runtime:
-    <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8001", PYTHONPATH: "/workspace/services/tenant-runtime/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
-    command: ["python", "-m", "tenant_runtime"]
-    healthcheck:
-      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8001/healthz', timeout=3)"]
-      interval: 5s
-      timeout: 5s
-      retries: 20
-
   ai-gateway:
     <<: *app-python
     environment: {HOST: 0.0.0.0, PORT: "8002", PYTHONPATH: "/workspace/services/ai-gateway/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
     command: ["python", "-m", "ai_gateway"]
     healthcheck:
       test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8002/healthz', timeout=3)"]
-      interval: 5s
-      timeout: 5s
-      retries: 20
-
-  tool-gateway:
-    <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8003", PYTHONPATH: "/workspace/services/tool-gateway/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
-    command: ["python", "-m", "tool_gateway"]
-    healthcheck:
-      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8003/healthz', timeout=3)"]
-      interval: 5s
-      timeout: 5s
-      retries: 20
-
-  event-dispatcher:
-    <<: *app-python
-    environment: {HOST: 0.0.0.0, PORT: "8004", PYTHONPATH: "/workspace/services/event-dispatcher/src:/workspace/packages/observability-py/src:/workspace/.venv/lib/python3.13/site-packages", PYTHONDONTWRITEBYTECODE: "1"}
-    command: ["python", "-m", "event_dispatcher"]
-    healthcheck:
-      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8004/healthz', timeout=3)"]
       interval: 5s
       timeout: 5s
       retries: 20
diff --git a/infrastructure/docker/scripts/smoke.sh b/infrastructure/docker/scripts/smoke.sh
--- a/infrastructure/docker/scripts/smoke.sh
+++ b/infrastructure/docker/scripts/smoke.sh
@@ -34,10 +34,10 @@
   case "$a" in
     --runtime)
       # INT-002: /healthz de CADA servico runtime, de dentro do container (nao publicam portas); falha se cair.
-      for sv in tenant-runtime:8001 ai-gateway:8002 tool-gateway:8003 event-dispatcher:8004; do
+      for sv in ai-gateway:8002; do
         chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:${sv##*:}/healthz', timeout=3)"
       done
-      for sv in api:3001 web:3000 tenant-provisioner:3002; do
+      for sv in api:3001 web:3000; do
         chk "${sv%%:*} /healthz" "${DC[@]}" exec -T "${sv%%:*}" node -e "fetch('http://127.0.0.1:${sv##*:}/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
       done
       chk "proxy -> api /healthz" curl -fsS -H "Host: app.localhost:8080" "http://$H:${PROXY_HOST_PORT:-18080}/api/healthz"
diff --git a/infrastructure/kubernetes/README.md b/infrastructure/kubernetes/README.md
deleted file mode 100644
--- a/infrastructure/kubernetes/README.md
+++ /dev/null
@@ -1,3 +0,0 @@
-# kubernetes — reservado
-
-Reservado para o estagio 2/3 do ADR (secao 14). Sem codigo nesta fase.
diff --git a/infrastructure/terraform/README.md b/infrastructure/terraform/README.md
deleted file mode 100644
--- a/infrastructure/terraform/README.md
+++ /dev/null
@@ -1,3 +0,0 @@
-# terraform — reservado
-
-Reservado para o estagio 2/3 do ADR (secao 14). Sem codigo nesta fase.
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -2,7 +2,7 @@
   "name": "nucleos-enterprise",
   "private": true,
   "version": "0.0.0",
-  "description": "Monorepo Nucleos Enterprise (ver documentacoes/transversal, ADR secao 14)",
+  "description": "Monorepo do MVP Nucleos: web Next.js, API modular NestJS e gateway de IA Python",
   "packageManager": "pnpm@12.15.0",
   "engines": {
     "node": ">=24.22.1 <25",
@@ -17,8 +17,8 @@
     "test": "turbo run test",
     "lint:eslint": "turbo run build --filter=\"./packages/*\" && eslint .",
     "lint:arch": "depcruise apps packages --config .dependency-cruiser.cjs",
-    "format:check": "prettier --check --no-error-on-unmatched-pattern \\\"apps/**/*.{ts,tsx,mjs}\\\" \\\"packages/**/*.ts\\\" \\\"tools/**/*.{mjs,cjs}\\\" \\\"*.{mjs,cjs}\\\" lefthook.yml",
-    "format": "prettier --write --no-error-on-unmatched-pattern \\\"apps/**/*.{ts,tsx,mjs}\\\" \\\"packages/**/*.ts\\\" \\\"tools/**/*.{mjs,cjs}\\\" \\\"*.{mjs,cjs}\\\" lefthook.yml",
+    "format:check": "prettier --check --no-error-on-unmatched-pattern \"apps/**/*.{ts,tsx,mjs}\" \"packages/**/*.ts\" \"tools/**/*.{mjs,cjs}\" \"*.{mjs,cjs}\" lefthook.yml",
+    "format": "prettier --write --no-error-on-unmatched-pattern \"apps/**/*.{ts,tsx,mjs}\" \"packages/**/*.ts\" \"tools/**/*.{mjs,cjs}\" \"*.{mjs,cjs}\" lefthook.yml",
     "lint:quality": "pnpm run lint:eslint && pnpm run lint:arch && pnpm run format:check"
   },
   "devDependencies": {
diff --git a/packages/config/src/primitives.ts b/packages/config/src/primitives.ts
--- a/packages/config/src/primitives.ts
+++ b/packages/config/src/primitives.ts
@@ -1,6 +1,19 @@
 import { z } from "zod";
 
-const SECRET_QUERY = new Set(["password", "sslpassword", "passfile", "pass", "passwd", "pwd", "token", "apikey", "api_key", "secret", "credential", "credentials"]);
+const SECRET_QUERY = new Set([
+  "password",
+  "sslpassword",
+  "passfile",
+  "pass",
+  "passwd",
+  "pwd",
+  "token",
+  "apikey",
+  "api_key",
+  "secret",
+  "credential",
+  "credentials",
+]);
 
 /** Parametro de query que carrega (ou aponta para) credencial: recusado em DATABASE_URL e similares. */
 function isSecretQueryParam(name: string): boolean {
@@ -66,7 +79,10 @@
         return;
       }
       if ([...u.searchParams.keys()].some(isSecretQueryParam)) {
-        ctx.addIssue({ code: "custom", message: "credencial na query da url e proibida (use *_FILE)" });
+        ctx.addIssue({
+          code: "custom",
+          message: "credencial na query da url e proibida (use *_FILE)",
+        });
         return;
       }
     });
diff --git a/packages/config/src/secret.ts b/packages/config/src/secret.ts
--- a/packages/config/src/secret.ts
+++ b/packages/config/src/secret.ts
@@ -53,10 +53,7 @@
   try {
     // O_NOFOLLOW: link simbolico no ultimo componente => ELOOP. O_NONBLOCK: nao trava em FIFO.
     // (o Node ja abre com close-on-exec)
-    return openSync(
-      path,
-      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
-    );
+    return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
   } catch (e) {
     const code = (e as NodeJS.ErrnoException).code;
     if (code === "ELOOP") throw new SecretFileError("link-simbolico");
diff --git a/packages/contracts/scripts/gerar.test.mjs b/packages/contracts/scripts/gerar.test.mjs
--- a/packages/contracts/scripts/gerar.test.mjs
+++ b/packages/contracts/scripts/gerar.test.mjs
@@ -38,7 +38,7 @@
 test("geracao cobre TS, SDK, modelos Pydantic e copia dos schemas", () => {
   const arquivos = (d) => compararArvores(gerado, d);
   const vazio = novoTmp();
-  const lista = arquivos(vazio).join("\n");
+  const lista = arquivos(vazio).join("\n").replaceAll("\\", "/");
   for (const d of SAIDAS) assert.ok(lista.includes(d), `sem saida em ${d}`);
   assert.match(lista, /generated\/job-envelope\.ts/);
   assert.match(lista, /models\/job_envelope\.py/);
@@ -54,7 +54,7 @@
     const r = check(versionada);
     assert.equal(r.status, 1);
     assert.match(
-      r.stderr,
+      r.stderr.replaceAll("\\", "/"),
       /DRIFT[\s\S]*desatualizado: packages\/contracts\/src\/generated\/job-envelope\.ts/,
     );
   });
diff --git a/packages/observability/src/context.ts b/packages/observability/src/context.ts
--- a/packages/observability/src/context.ts
+++ b/packages/observability/src/context.ts
@@ -37,7 +37,10 @@
  * Aceita `X-Request-Id` somente com `trustEdge=true` (borda confiavel, definida em FND-007) e formato
  * seguro (evita injecao em log); padrao `false`, ausente ou invalido => UUID novo.
  */
-export function resolveCorrelationId(header: string | string[] | undefined, trustEdge = false): string {
+export function resolveCorrelationId(
+  header: string | string[] | undefined,
+  trustEdge = false,
+): string {
   const candidate = Array.isArray(header) ? header[0] : header;
   if (trustEdge && candidate !== undefined && VALID_ID.test(candidate)) return candidate;
   return randomUUID();
@@ -71,6 +74,8 @@
 
 /** Executa o job restaurando o `correlation_id` do envelope (propagacao HTTP -> job -> log). */
 export function runJob<T, R>(envelope: JobEnvelope<T>, fn: (envelope: JobEnvelope<T>) => R): R {
-  const correlationId = VALID_ID.test(envelope.correlation_id) ? envelope.correlation_id : randomUUID();
+  const correlationId = VALID_ID.test(envelope.correlation_id)
+    ? envelope.correlation_id
+    : randomUUID();
   return storage.run({ correlationId, actorType: "system" }, () => fn(envelope));
 }
diff --git a/packages/observability/src/http.ts b/packages/observability/src/http.ts
--- a/packages/observability/src/http.ts
+++ b/packages/observability/src/http.ts
@@ -11,7 +11,10 @@
   red: RedMetrics;
 }
 
-export function createObservability(logger: LoggerOptions, telemetry: TelemetryConfig): Observability {
+export function createObservability(
+  logger: LoggerOptions,
+  telemetry: TelemetryConfig,
+): Observability {
   const t = createTelemetry(telemetry);
   return { logger: createLogger(logger), telemetry: t, red: new RedMetrics(t.meter) };
 }
@@ -33,7 +36,10 @@
   options: ObserveOptions,
   next: () => void,
 ): void {
-  const correlationId = resolveCorrelationId(req.headers[CORRELATION_HEADER], options.trustEdge ?? false);
+  const correlationId = resolveCorrelationId(
+    req.headers[CORRELATION_HEADER],
+    options.trustEdge ?? false,
+  );
   const method = req.method ?? "GET";
   const started = performance.now();
   const span = kit.telemetry.tracer.startSpan(`HTTP ${method}`, {
@@ -70,7 +76,11 @@
   runWithContext({ correlationId, actorType: "anonymous", span }, next);
 }
 
-export function observeHttp(kit: Observability, handler: RequestListener, options: ObserveOptions): RequestListener {
+export function observeHttp(
+  kit: Observability,
+  handler: RequestListener,
+  options: ObserveOptions,
+): RequestListener {
   return (req, res) => {
     observeRequest(kit, req, res, options, () => {
       handler(req, res);
diff --git a/packages/observability/src/observability.test.ts b/packages/observability/src/observability.test.ts
--- a/packages/observability/src/observability.test.ts
+++ b/packages/observability/src/observability.test.ts
@@ -30,7 +30,11 @@
 };
 const base = { service: "svc", version: "9.9.9", env: "test" };
 
-function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
+function get(
+  port: number,
+  path: string,
+  headers: Record<string, string> = {},
+): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
   return new Promise((resolve, reject) => {
     const req = request({ host: "127.0.0.1", port, path, headers }, (res) => {
       let body = "";
@@ -66,11 +70,19 @@
 test("AC-1: requisicao sintetica gera log, metrica e trace com o mesmo correlation_id; HTTP -> job -> log", async () => {
   const spans = new InMemorySpanExporter();
   const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
-  const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 3600_000 });
+  const reader = new PeriodicExportingMetricReader({
+    exporter: metricExporter,
+    exportIntervalMillis: 3600_000,
+  });
   const out = sink();
   const kit = createObservability(
     { ...base, destination: out },
-    { ...base, enabled: true, spanProcessors: [new SimpleSpanProcessor({ exporter: spans })], metricReaders: [reader] },
+    {
+      ...base,
+      enabled: true,
+      spanProcessors: [new SimpleSpanProcessor({ exporter: spans })],
+      metricReaders: [reader],
+    },
   );
   const server = createServer(
     observeHttp(
@@ -99,7 +111,10 @@
   );
   const port = await listen(server);
   try {
-    const res = await get(port, `/demo/123?token=${SENTINEL}`, { "x-request-id": "edge-req-1234", authorization: `Bearer ${SENTINEL}` });
+    const res = await get(port, `/demo/123?token=${SENTINEL}`, {
+      "x-request-id": "edge-req-1234",
+      authorization: `Bearer ${SENTINEL}`,
+    });
     assert.equal(res.status, 200);
     assert.equal(res.headers[CORRELATION_HEADER], "edge-req-1234");
     await new Promise((r) => setTimeout(r, 50));
@@ -108,7 +123,19 @@
     const httpLog = records.find((r) => r["event"] === "http.request");
     const jobLog = records.find((r) => r["event"] === "job.done");
     assert.ok(httpLog && jobLog);
-    for (const field of ["ts", "level", "service", "version", "env", "trace_id", "span_id", "correlation_id", "tenant_id", "actor_type", "event"]) {
+    for (const field of [
+      "ts",
+      "level",
+      "service",
+      "version",
+      "env",
+      "trace_id",
+      "span_id",
+      "correlation_id",
+      "tenant_id",
+      "actor_type",
+      "event",
+    ]) {
       assert.ok(field in httpLog, `campo fixo ausente: ${field}`);
     }
     assert.equal(httpLog["correlation_id"], "edge-req-1234");
@@ -122,10 +149,16 @@
     assert.equal(span.spanContext().spanId, httpLog["span_id"]);
 
     await reader.forceFlush();
-    const metrics = metricExporter.getMetrics().flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics));
+    const metrics = metricExporter
+      .getMetrics()
+      .flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics));
     const requests = metrics.find((m) => m.descriptor.name === "http.server.requests");
     assert.ok(requests);
-    assert.deepEqual(requests.dataPoints[0]?.attributes, { method: "GET", route: "/demo", status_class: "2xx" });
+    assert.deepEqual(requests.dataPoints[0]?.attributes, {
+      method: "GET",
+      route: "/demo",
+      status_class: "2xx",
+    });
     assert.ok(metrics.some((m) => m.descriptor.name === "http.server.request.duration"));
 
     // AC-2 (biblioteca): nada do request (query, header) aparece no log.
@@ -138,7 +171,9 @@
 
 test("HTTP: sem trustEdge o x-request-id do cliente e substituido por UUID", async () => {
   const kit = createObservability({ ...base, destination: sink() }, { ...base, enabled: false });
-  const server = createServer(observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }));
+  const server = createServer(
+    observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }),
+  );
   const port = await listen(server);
   try {
     const res = await get(port, "/x", { "x-request-id": "abcdefgh12" });
@@ -174,15 +209,27 @@
 
 test("cardinalidade: rota nao declarada vira unmatched; label tenant_id e proibido", () => {
   const kit = createObservability({ ...base, destination: sink() }, { ...base, enabled: false });
-  assert.throws(() => createBusinessCounter(kit.telemetry.meter, "x", { tenant_id: ["a"] }), /proibido/);
+  assert.throws(
+    () => createBusinessCounter(kit.telemetry.meter, "x", { tenant_id: ["a"] }),
+    /proibido/,
+  );
   const count = createBusinessCounter(kit.telemetry.meter, "orders", { outcome: ["ok", "error"] });
   count(1, { outcome: "qualquer" });
 });
 
 test("AC-3: telemetria desabilitada e no-op; OTLP inalcancavel nao altera a resposta nem derruba", async () => {
   assert.equal(telemetryConfigFromEnv({}, base).enabled, false);
-  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1", OTEL_SDK_DISABLED: "true" }, base).enabled, false);
-  assert.equal(telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1/" }, base).otlpEndpoint, "http://x:1");
+  assert.equal(
+    telemetryConfigFromEnv(
+      { OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1", OTEL_SDK_DISABLED: "true" },
+      base,
+    ).enabled,
+    false,
+  );
+  assert.equal(
+    telemetryConfigFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:1/" }, base).otlpEndpoint,
+    "http://x:1",
+  );
   const disabled = createTelemetry({ ...base, enabled: false });
   disabled.tracer.startSpan("x").end();
   await disabled.shutdown();
@@ -193,7 +240,9 @@
       { ...base, destination: out },
       { ...base, enabled, otlpEndpoint: "http://127.0.0.1:1", metricIntervalMs: 50 },
     );
-    const server = createServer(observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }));
+    const server = createServer(
+      observeHttp(kit, (_req, res) => void res.writeHead(200).end("ok"), { routeOf: () => "/x" }),
+    );
     const port = await listen(server);
     try {
       const res = await get(port, "/x");
@@ -218,9 +267,15 @@
   });
   const port = await listen(server);
   try {
-    assert.deepEqual(JSON.parse((await get(port, "/healthz")).body), { status: "ok", service: "svc" });
+    assert.deepEqual(JSON.parse((await get(port, "/healthz")).body), {
+      status: "ok",
+      service: "svc",
+    });
     const ready = await get(port, "/readyz");
-    assert.deepEqual([ready.status, JSON.parse(ready.body)], [200, { status: "ready", service: "svc" }]);
+    assert.deepEqual(
+      [ready.status, JSON.parse(ready.body)],
+      [200, { status: "ready", service: "svc" }],
+    );
     dbUp = false;
     const notReady = await get(port, "/readyz");
     assert.equal(notReady.status, 503);
@@ -246,8 +301,11 @@
     const elapsed = Date.now() - started;
     assert.equal(ready.status, 503);
     assert.equal(health.status, 200);
-    assert.ok(elapsed < 3500, `3 checks pendurados deveriam levar ~2s (paralelo), levou ${elapsed}ms`);
-  } finally {
-    server.close();
-  }
-});
+    assert.ok(
+      elapsed < 3500,
+      `3 checks pendurados deveriam levar ~2s (paralelo), levou ${elapsed}ms`,
+    );
+  } finally {
+    server.close();
+  }
+});
diff --git a/packages/observability/src/red.ts b/packages/observability/src/red.ts
--- a/packages/observability/src/red.ts
+++ b/packages/observability/src/red.ts
@@ -30,9 +30,16 @@
   private readonly duration: Histogram;
 
   constructor(meter: Meter) {
-    this.requests = meter.createCounter("http.server.requests", { description: "Requisicoes HTTP (rate)" });
-    this.errors = meter.createCounter("http.server.errors", { description: "Respostas 5xx (errors)" });
-    this.duration = meter.createHistogram("http.server.request.duration", { unit: "s", description: "Duracao (duration)" });
+    this.requests = meter.createCounter("http.server.requests", {
+      description: "Requisicoes HTTP (rate)",
+    });
+    this.errors = meter.createCounter("http.server.errors", {
+      description: "Respostas 5xx (errors)",
+    });
+    this.duration = meter.createHistogram("http.server.request.duration", {
+      unit: "s",
+      description: "Duracao (duration)",
+    });
   }
 
   record(sample: RedSample): void {
diff --git a/packages/observability/src/redact.test.ts b/packages/observability/src/redact.test.ts
--- a/packages/observability/src/redact.test.ts
+++ b/packages/observability/src/redact.test.ts
@@ -16,19 +16,27 @@
 
 // `note` e `items` nao tem validador: string sob elas e sempre [REDACTED]. `route` tem validador.
 const ALLOWED = ["method", "route", "status", "note", "items"];
-const SENSITIVE = [...SENSITIVE_KEYS, "Authorization", "X-Api-Key", "user_password", "access_token", "Set-Cookie"];
+const SENSITIVE = [
+  ...SENSITIVE_KEYS,
+  "Authorization",
+  "X-Api-Key",
+  "user_password",
+  "access_token",
+  "Set-Cookie",
+];
 const OTHER = ["foo", "body", "payload", "email", "x1", "headers", "weird key"];
 
 function run(seed: number, check: (sentinels: string[], value: unknown) => void): void {
   const rnd = prng(seed);
-  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
+  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
   const sentinels: string[] = [];
   const sentinel = () => {
     const s = `SENTINEL-s3cr3t-${sentinels.length}-${Math.floor(rnd() * 1e9).toString(36)}`;
     sentinels.push(s);
     return s;
   };
-  const wrap = (v: unknown): unknown => (rnd() < 0.3 ? [v, { deep: v }] : rnd() < 0.2 ? { a: { b: { c: { d: v } } } } : v);
+  const wrap = (v: unknown): unknown =>
+    rnd() < 0.3 ? [v, { deep: v }] : rnd() < 0.2 ? { a: { b: { c: { d: v } } } } : v;
   const gen = (depth: number): unknown => {
     const obj: Record<string, unknown> = {};
     const n = 1 + Math.floor(rnd() * 5);
@@ -38,10 +46,14 @@
       else if (r < 0.35) obj[pick(OTHER)] = wrap(sentinel());
       else if (r < 0.5 && depth < 3) obj[pick(ALLOWED)] = gen(depth + 1);
       else if (r < 0.58) obj[pick(ALLOWED)] = `Bearer ${sentinel()}`;
-      else if (r < 0.7) obj[pick(["note", "items"])] = sentinel(); // string comum sob chave permitida
-      else if (r < 0.78) obj["items"] = [sentinel(), 1, [sentinel()]]; // item de array
-      else if (r < 0.84) obj[pick(["note", "items"])] = Object.assign(new Error("m"), { name: sentinel() }); // Error.name
-      else if (r < 0.9) obj["route"] = `/x?token=${sentinel()}`; // validador de rota rejeita
+      else if (r < 0.7)
+        obj[pick(["note", "items"])] = sentinel(); // string comum sob chave permitida
+      else if (r < 0.78)
+        obj["items"] = [sentinel(), 1, [sentinel()]]; // item de array
+      else if (r < 0.84)
+        obj[pick(["note", "items"])] = Object.assign(new Error("m"), { name: sentinel() }); // Error.name
+      else if (r < 0.9)
+        obj["route"] = `/x?token=${sentinel()}`; // validador de rota rejeita
       else if (r < 0.95) obj["note"] = `password=${sentinel()}`;
       else obj[pick(ALLOWED)] = Math.floor(rnd() * 100);
     }
@@ -69,7 +81,13 @@
 
 test("propriedade na linha de log real (logger.log), nao so em redact", () => {
   const lines: string[] = [];
-  const logger = createLogger({ service: "s", version: "1", env: "t", destination: { write: (l) => void lines.push(l) }, allowlist: ["note", "items"] });
+  const logger = createLogger({
+    service: "s",
+    version: "1",
+    env: "t",
+    destination: { write: (l) => void lines.push(l) },
+    allowlist: ["note", "items"],
+  });
   run(77, (sentinels, value) => {
     lines.length = 0;
     logger.log("info", "evt", value);
@@ -79,11 +97,31 @@
 });
 
 test("valores validos continuam presentes; strings so com validador; topo so objeto simples", () => {
-  const out = redact({ route: "/healthz", status: 200, method: "GET", note: "ok" }, ["route", "status", "method", "note"]) as Record<string, unknown>;
-  assert.deepEqual(out, { route: "[REDACTED]", status: 200, method: "[REDACTED]", note: "[REDACTED]" }); // lista de nomes = sem validador
-  const rules = redact({ route: "/healthz", status: 200, method: "GET", free: "livre", note: "x" }, { route: /^\/[a-z]+$/, status: undefined, method: /^[A-Z]+$/, free: "free", note: undefined });
-  assert.deepEqual(rules, { route: "/healthz", status: 200, method: "GET", free: "livre", note: REDACTED });
-  for (const top of ["s", 1, ["a"], null, new Error("x"), new Map()]) assert.deepEqual(redact(top, ["note"]), { _dropped: 1 });
+  const out = redact({ route: "/healthz", status: 200, method: "GET", note: "ok" }, [
+    "route",
+    "status",
+    "method",
+    "note",
+  ]) as Record<string, unknown>;
+  assert.deepEqual(out, {
+    route: "[REDACTED]",
+    status: 200,
+    method: "[REDACTED]",
+    note: "[REDACTED]",
+  }); // lista de nomes = sem validador
+  const rules = redact(
+    { route: "/healthz", status: 200, method: "GET", free: "livre", note: "x" },
+    { route: /^\/[a-z]+$/, status: undefined, method: /^[A-Z]+$/, free: "free", note: undefined },
+  );
+  assert.deepEqual(rules, {
+    route: "/healthz",
+    status: 200,
+    method: "GET",
+    free: "livre",
+    note: REDACTED,
+  });
+  for (const top of ["s", 1, ["a"], null, new Error("x"), new Map()])
+    assert.deepEqual(redact(top, ["note"]), { _dropped: 1 });
 });
 
 test("Error.name fora de ^[A-Za-z0-9_.$]{1,64}$ vira [REDACTED]; JWT cortado no limite nao deixa prefixo", () => {
@@ -96,7 +134,10 @@
 });
 
 test("chaves sensiveis conhecidas viram [REDACTED] mesmo se estiverem na allowlist", () => {
-  const out = redact({ authorization: "x", token: "y", note: 7, foo: "z" }, ["token", "note"]) as Record<string, unknown>;
+  const out = redact({ authorization: "x", token: "y", note: 7, foo: "z" }, [
+    "token",
+    "note",
+  ]) as Record<string, unknown>;
   assert.equal(out["authorization"], REDACTED);
   assert.equal(out["token"], REDACTED);
   assert.equal(out["note"], 7);
diff --git a/packages/observability/src/redact.ts b/packages/observability/src/redact.ts
--- a/packages/observability/src/redact.ts
+++ b/packages/observability/src/redact.ts
@@ -14,7 +14,8 @@
   "api_key",
 ]);
 
-const SENSITIVE_PATTERN = /authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session/i;
+const SENSITIVE_PATTERN =
+  /authorization|cookie|passw|token|secret|prompt|content|api[-_]?key|credential|private[-_]?key|session/i;
 const VALUE_PATTERNS = [
   /\bBearer\s+\S+/gi,
   /\beyJ[\w-]+(?:\.[\w-]*)*/g,
@@ -85,7 +86,12 @@
   return walk(value, rules, 0, undefined);
 }
 
-function walk(value: unknown, rules: ReadonlyMap<string, StringRule | undefined>, depth: number, rule: StringRule | undefined): unknown {
+function walk(
+  value: unknown,
+  rules: ReadonlyMap<string, StringRule | undefined>,
+  depth: number,
+  rule: StringRule | undefined,
+): unknown {
   if (value === null || typeof value === "boolean" || typeof value === "number") return value;
   if (typeof value === "string") {
     if (rule === undefined) return REDACTED;
@@ -97,7 +103,8 @@
     return { name: typeof name === "string" && NAME_PATTERN.test(name) ? name : REDACTED };
   }
   if (depth >= MAX_DEPTH) return "[TRUNCATED]";
-  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => walk(item, rules, depth + 1, rule));
+  if (Array.isArray(value))
+    return value.slice(0, MAX_ITEMS).map((item) => walk(item, rules, depth + 1, rule));
   if (isPlainObject(value)) {
     const out: Record<string, unknown> = {};
     let dropped = 0;
diff --git a/packages/observability/src/telemetry.ts b/packages/observability/src/telemetry.ts
--- a/packages/observability/src/telemetry.ts
+++ b/packages/observability/src/telemetry.ts
@@ -2,7 +2,11 @@
 import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
 import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
 import { resourceFromAttributes } from "@opentelemetry/resources";
-import { type IMetricReader, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
+import {
+  type IMetricReader,
+  MeterProvider,
+  PeriodicExportingMetricReader,
+} from "@opentelemetry/sdk-metrics";
 import { BatchSpanProcessor, type SpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
 
 export interface TelemetryConfig {
@@ -59,10 +63,20 @@
   const spanProcessors = [...(config.spanProcessors ?? [])];
   const readers = [...(config.metricReaders ?? [])];
   if (config.otlpEndpoint) {
-    spanProcessors.push(new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces`, timeoutMillis: 2000 }) }));
+    spanProcessors.push(
+      new BatchSpanProcessor({
+        exporter: new OTLPTraceExporter({
+          url: `${config.otlpEndpoint}/v1/traces`,
+          timeoutMillis: 2000,
+        }),
+      }),
+    );
     readers.push(
       new PeriodicExportingMetricReader({
-        exporter: new OTLPMetricExporter({ url: `${config.otlpEndpoint}/v1/metrics`, timeoutMillis: 2000 }),
+        exporter: new OTLPMetricExporter({
+          url: `${config.otlpEndpoint}/v1/metrics`,
+          timeoutMillis: 2000,
+        }),
         exportIntervalMillis: config.metricIntervalMs ?? 15000,
       }),
     );
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -241,15 +241,6 @@
         specifier: 8.23.1
         version: 8.23.1
 
-  apps/tenant-provisioner:
-    dependencies:
-      '@nucleos/contracts':
-        specifier: workspace:*
-        version: link:../../packages/contracts
-      '@nucleos/observability':
-        specifier: workspace:*
-        version: link:../../packages/observability
-
   apps/web:
     dependencies:
       '@nucleos/contracts':
diff --git a/pyproject.toml b/pyproject.toml
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -49,15 +49,9 @@
 explicit_package_bases = true
 mypy_path = [
   "services/ai-gateway/src",
-  "services/tool-gateway/src",
-  "services/event-dispatcher/src",
-  "services/tenant-runtime/src",
   "packages/config-py/src",
 ]
 files = [
   "services/ai-gateway/src",
   "packages/config-py/src",
-  "services/tool-gateway/src",
-  "services/event-dispatcher/src",
-  "services/tenant-runtime/src/tenant_runtime/policy",
 ]
diff --git a/scripts/contexto-projeto.json b/scripts/contexto-projeto.json
deleted file mode 100644
--- a/scripts/contexto-projeto.json
+++ /dev/null
@@ -1,47 +0,0 @@
-{
-  "include": [
-    "README.md",
-    "AGENTS.md",
-    "CLAUDE.md",
-    "Nucleos-Especificacao-Mestra.md",
-    "documentacoes",
-    "lessons",
-    "back",
-    "front"
-  ],
-  "exclude": [
-    "node_modules",
-    "vendor",
-    ".git",
-    ".contexto",
-    ".claude",
-    ".agents",
-    ".agent",
-    "skills",
-    "storage",
-    "dist",
-    "build",
-    "bin",
-    "obj"
-  ],
-  "workflow": {
-    "schema": 1,
-    "preset": "generic",
-    "timezone": "America/Sao_Paulo",
-    "plansDir": "documentacoes/planejamento-ia",
-    "reportsDir": "documentacoes/reviews",
-    "deliveryDir": "documentacoes",
-    "reviewBranchPrefix": "revisao/",
-    "defaultProfile": "padrao",
-    "rules": ["AGENTS.md"],
-    "repositories": [
-      {
-        "name": "nucleos",
-        "root": ".",
-        "layer": "monorepo"
-      }
-    ],
-    "worktreeDir": "../nucleos-worktrees",
-    "publish": "manual"
-  }
-}
diff --git a/scripts/instalar-contexto.sh b/scripts/instalar-contexto.sh
deleted file mode 100644
--- a/scripts/instalar-contexto.sh
+++ /dev/null
@@ -1,122 +0,0 @@
-#!/usr/bin/env bash
-# Instala e confere o Contexto (memoria local dos agentes de IA) neste checkout.
-# Idempotente: pode ser executado de novo sem efeitos colaterais.
-# Nao usa sudo, nao instala Node/Git, nao troca de branch e nao altera arquivos versionados.
-# Aplica scripts/contexto-projeto.json (include, exclude e workflow) em .contexto/project.json.
-#
-# Uso: bash scripts/instalar-contexto.sh [--codex]
-#   --codex  registra tambem o servidor MCP na configuracao global do Codex
-# Variavel opcional: CONTEXTO_DIR (padrao: pasta "contexto" ao lado do repositorio)
-set -euo pipefail
-
-REPO_URL="https://github.com/ViniciusBernucci/contexto.git"
-ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
-TOOL_DIR="${CONTEXTO_DIR:-$(dirname "$ROOT")/contexto}"
-WITH_CODEX=false
-for arg in "$@"; do
-  case "$arg" in
-    --codex) WITH_CODEX=true ;;
-    *) echo "Opcao desconhecida: $arg" >&2; exit 2 ;;
-  esac
-done
-
-ok() { echo "[ok] $*"; }
-warn() { echo "[aviso] $*"; }
-fail() { echo "[erro] $*" >&2; exit 1; }
-contexto() { node "$TOOL_DIR/contexto.mjs" "$@" --project "$ROOT" 2>/dev/null; }
-# expect PADRAO MENSAGEM COMANDO...: guarda a saida do comando e falha se o padrao nao aparecer.
-expect() {
-  local pattern="$1" message="$2" output
-  shift 2
-  output="$("$@" || true)"
-  grep -q -- "$pattern" <<<"$output" || fail "$message"
-}
-mcp_initialize() {
-  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' | contexto mcp
-}
-
-cd "$ROOT"
-echo "Repositorio: $ROOT"
-echo "Ferramenta:  $TOOL_DIR"
-
-# 1. Pre-requisitos
-command -v node >/dev/null || fail "Node nao encontrado. Instale o Node v22.13 ou maior."
-command -v git >/dev/null || fail "Git nao encontrado. Instale o Git 2.36 ou maior."
-node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)' \
-  || fail "Node $(node --version) e antigo. Precisa ser v22.13 ou maior (veja o passo 1 do README)."
-git --version | node -e 'const [a, b] = require("fs").readFileSync(0, "utf8").match(/(\d+)\.(\d+)/).slice(1).map(Number); process.exit(a > 2 || (a === 2 && b >= 36) ? 0 : 1)' \
-  || fail "$(git --version) e antigo. Precisa ser 2.36 ou maior (veja o passo 1 do README)."
-ok "Node $(node --version) e $(git --version)"
-
-# 2. Ferramenta ao lado do repositorio
-if [ -f "$TOOL_DIR/contexto.mjs" ]; then
-  ok "Contexto ja presente em $TOOL_DIR"
-else
-  [ -e "$TOOL_DIR" ] && fail "$TOOL_DIR existe, mas nao contem contexto.mjs. Revise a pasta antes de continuar."
-  git clone --quiet "$REPO_URL" "$TOOL_DIR"
-  ok "Contexto clonado em $TOOL_DIR"
-fi
-
-# 3. Registro do repositorio (hook local do Git)
-expect '"registered":true' "setup falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" setup --project \"$ROOT\"" contexto setup
-ok "Repositorio registrado"
-
-# 4. Branch de trabalho
-BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
-case "$BRANCH" in
-  main|master|"") fail "Voce esta em '${BRANCH:-HEAD destacado}'. O Contexto nao prepara main/master. Rode 'git switch developer' e execute este script de novo." ;;
-esac
-expect '"prepared":true' "ensure falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" ensure --project \"$ROOT\"" contexto ensure
-expect '"ok":true' "doctor falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" doctor --project \"$ROOT\"" contexto doctor
-ok "Branch '$BRANCH' preparada (.contexto/ criada e indexada)"
-
-# 4.1 Configuracao versionada do projeto (fontes indexadas e workflow das skills)
-CONFIG_STATUS="$(node -e '
-const fs = require("fs");
-const [file, versioned] = process.argv.slice(1);
-const config = JSON.parse(fs.readFileSync(file, "utf8"));
-const project = JSON.parse(fs.readFileSync(versioned, "utf8"));
-const keys = ["include", "exclude", "workflow"];
-if (keys.every(key => JSON.stringify(config[key]) === JSON.stringify(project[key]))) { console.log("igual"); process.exit(0); }
-for (const key of keys) config[key] = project[key];
-fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
-console.log("atualizada");
-' "$ROOT/.contexto/project.json" "$ROOT/scripts/contexto-projeto.json")"
-if [ "$CONFIG_STATUS" = "atualizada" ]; then
-  expect '"registered":true' "setup --config-from falhou." contexto setup --config-from "$ROOT"
-  expect '"sources"' "index falhou." contexto index
-  ok "Configuracao de scripts/contexto-projeto.json aplicada e indice refeito"
-else
-  ok "Configuracao de scripts/contexto-projeto.json ja aplicada"
-fi
-
-# 5. Teste de busca e do servidor MCP
-expect '"source"' "A busca de teste nao retornou resultados." contexto search --query "lessons" --limit 1
-expect '"contexto-local"' "O servidor MCP nao respondeu." mcp_initialize
-ok "Busca e servidor MCP funcionando"
-
-# 6. Integracao com os clientes de IA
-if [ -f .mcp.json ] && grep -q '"contexto"' .mcp.json; then
-  ok ".mcp.json do Claude Code presente"
-else
-  warn ".mcp.json sem o servidor 'contexto'. Siga os passos 6 a 8 do README (uma vez no repositorio)."
-fi
-if command -v claude >/dev/null; then
-  if grep -q '^contexto:.*Connected' <<<"$(claude mcp list 2>/dev/null || true)"; then
-    ok "Claude Code conectado ao Contexto"
-  else
-    warn "Claude Code nao mostrou 'contexto ... Connected'. Rode 'claude mcp list' dentro de $ROOT."
-  fi
-fi
-if [ "$WITH_CODEX" = true ]; then
-  command -v codex >/dev/null || fail "--codex informado, mas o Codex nao esta instalado."
-  NAME="contexto-$(basename "$ROOT")"
-  if codex mcp get "$NAME" >/dev/null 2>&1; then
-    ok "Codex ja tem o servidor '$NAME'"
-  else
-    codex mcp add "$NAME" -- "$(command -v node)" "$TOOL_DIR/contexto.mjs" mcp --project "$ROOT" >/dev/null
-    ok "Servidor '$NAME' registrado no Codex"
-  fi
-fi
-
-echo "Instalacao concluida."
diff --git a/scripts/local.sh b/scripts/local.sh
--- a/scripts/local.sh
+++ b/scripts/local.sh
@@ -13,11 +13,7 @@
 COMPONENTS=(
   "web:3000:$PNPM --filter @nucleos/web start"
   "api:3001:node apps/api/dist/main.js"
-  "tenant-provisioner:3002:node apps/tenant-provisioner/dist/main.js"
-  "tenant-runtime:8001:$UV run --frozen --package nucleos-tenant-runtime python -m tenant_runtime"
   "ai-gateway:8002:$UV run --frozen --package nucleos-ai-gateway python -m ai_gateway"
-  "tool-gateway:8003:$UV run --frozen --package nucleos-tool-gateway python -m tool_gateway"
-  "event-dispatcher:8004:$UV run --frozen --package nucleos-event-dispatcher python -m event_dispatcher"
 )
 
 porta_em_escuta() { # 0 se algo ja aceita conexao em 127.0.0.1:$1
diff --git a/services/ai-gateway/pyproject.toml b/services/ai-gateway/pyproject.toml
--- a/services/ai-gateway/pyproject.toml
+++ b/services/ai-gateway/pyproject.toml
@@ -1,7 +1,7 @@
 [project]
 name = "nucleos-ai-gateway"
 version = "0.0.0"
-description = "Servico ai-gateway (hello-world de FND-001; sem logica de negocio)"
+description = "Gateway de IA do MVP: CFO consultivo, ferramentas de leitura e limites de custo"
 requires-python = ">=3.12"
 dependencies = [
     "anthropic==2.6.0",
diff --git a/services/ai-gateway/src/ai_gateway/app.py b/services/ai-gateway/src/ai_gateway/app.py
--- a/services/ai-gateway/src/ai_gateway/app.py
+++ b/services/ai-gateway/src/ai_gateway/app.py
@@ -1,4 +1,4 @@
-"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
+"""Gateway HTTP do CFO com autenticacao interna, probes e observabilidade."""
 
 import hmac
 import json
diff --git a/services/event-dispatcher/pyproject.toml b/services/event-dispatcher/pyproject.toml
deleted file mode 100644
--- a/services/event-dispatcher/pyproject.toml
+++ /dev/null
@@ -1,16 +0,0 @@
-[project]
-name = "nucleos-event-dispatcher"
-version = "0.0.0"
-description = "Servico event-dispatcher (hello-world de FND-001; sem logica de negocio)"
-requires-python = ">=3.12"
-dependencies = ["nucleos-observability"]
-
-[tool.uv.sources]
-nucleos-observability = { workspace = true }
-
-[build-system]
-requires = ["uv_build>=0.13.5,<0.14"]
-build-backend = "uv_build"
-
-[tool.uv.build-backend]
-module-name = "event_dispatcher"
diff --git a/services/event-dispatcher/src/event_dispatcher/__init__.py b/services/event-dispatcher/src/event_dispatcher/__init__.py
deleted file mode 100644
--- a/services/event-dispatcher/src/event_dispatcher/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""Servico event-dispatcher."""
diff --git a/services/event-dispatcher/src/event_dispatcher/__main__.py b/services/event-dispatcher/src/event_dispatcher/__main__.py
deleted file mode 100644
--- a/services/event-dispatcher/src/event_dispatcher/__main__.py
+++ /dev/null
@@ -1,3 +0,0 @@
-from event_dispatcher.app import main
-
-main()
diff --git a/services/event-dispatcher/src/event_dispatcher/app.py b/services/event-dispatcher/src/event_dispatcher/app.py
deleted file mode 100644
--- a/services/event-dispatcher/src/event_dispatcher/app.py
+++ /dev/null
@@ -1,41 +0,0 @@
-"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
-
-import os
-import sys
-from http.server import ThreadingHTTPServer
-
-from nucleos_observability import (
-    Logger,
-    Observability,
-    Telemetry,
-    make_handler,
-    make_observability,
-    telemetry_config_from_env,
-)
-
-SERVICE = "event-dispatcher"
-HEALTH_PATH = "/healthz"
-
-
-def default_observability() -> Observability:
-    version = os.environ.get("APP_VERSION", "0.0.0")
-    env = os.environ.get("APP_ENV", "local")
-    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
-    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
-
-
-def make_server(
-    host: str = "127.0.0.1", port: int = 8004, kit: Observability | None = None
-) -> ThreadingHTTPServer:
-    return ThreadingHTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
-
-
-def main() -> None:
-    host = os.environ.get("HOST", "127.0.0.1")
-    port = int(os.environ.get("PORT", "8004"))
-    print(f"{SERVICE} em http://{host}:{port}", flush=True)
-    make_server(host, port).serve_forever()
-
-
-if __name__ == "__main__":
-    main()
diff --git a/services/event-dispatcher/tests/test_health.py b/services/event-dispatcher/tests/test_health.py
deleted file mode 100644
--- a/services/event-dispatcher/tests/test_health.py
+++ /dev/null
@@ -1,61 +0,0 @@
-import http.client
-import io
-import json
-import threading
-
-from event_dispatcher.app import SERVICE, make_server
-from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
-
-SENTINEL = "SENTINEL_event_dispatcher_5ec7e7"
-
-
-def _serve():
-    out = io.StringIO()
-    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
-    logger = Logger(SERVICE, "9.9.9", "test", level="debug", stream=out)
-    kit = make_observability(logger, Telemetry(cfg))
-    server = make_server("127.0.0.1", 0, kit)
-    threading.Thread(target=server.serve_forever, daemon=True).start()
-    return server, out
-
-
-def _get(port: int, path: str, headers: dict[str, str] | None = None):
-    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
-    try:
-        conn.request("GET", path, headers=headers or {})
-        res = conn.getresponse()
-        return res.status, dict(res.getheaders()), res.read()
-    finally:
-        conn.close()
-
-
-def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
-    server, out = _serve()
-    port = server.server_address[1]
-    try:
-        status, _, body = _get(port, "/healthz")
-        assert status == 200
-        assert json.loads(body) == {"status": "ok", "service": "event-dispatcher"}
-        _, _, body = _get(port, "/readyz")
-        assert json.loads(body) == {"status": "ready", "service": "event-dispatcher"}
-        status, headers, _ = _get(
-            port,
-            f"/outra?token={SENTINEL}",
-            {
-                "x-request-id": "edge-py-0001",
-                "authorization": f"Bearer {SENTINEL}",
-                "cookie": f"s={SENTINEL}",
-            },
-        )
-        assert status == 404
-        returned = headers["x-request-id"]
-        assert returned != "edge-py-0001"  # trust_edge=False por padrao
-        assert len(returned) == 36
-    finally:
-        server.shutdown()
-        server.server_close()
-    lines = [json.loads(line) for line in out.getvalue().splitlines()]
-    record = next(r for r in lines if r["data"]["route"] == "unmatched")
-    assert record["correlation_id"] == returned
-    assert record["service"] == "event-dispatcher"
-    assert SENTINEL not in out.getvalue()
diff --git a/services/tenant-runtime/pyproject.toml b/services/tenant-runtime/pyproject.toml
deleted file mode 100644
--- a/services/tenant-runtime/pyproject.toml
+++ /dev/null
@@ -1,16 +0,0 @@
-[project]
-name = "nucleos-tenant-runtime"
-version = "0.0.0"
-description = "Servico tenant-runtime (hello-world de FND-001; sem logica de negocio)"
-requires-python = ">=3.12"
-dependencies = ["nucleos-observability"]
-
-[tool.uv.sources]
-nucleos-observability = { workspace = true }
-
-[build-system]
-requires = ["uv_build>=0.13.5,<0.14"]
-build-backend = "uv_build"
-
-[tool.uv.build-backend]
-module-name = "tenant_runtime"
diff --git a/services/tenant-runtime/src/tenant_runtime/__init__.py b/services/tenant-runtime/src/tenant_runtime/__init__.py
deleted file mode 100644
--- a/services/tenant-runtime/src/tenant_runtime/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""Servico tenant-runtime."""
diff --git a/services/tenant-runtime/src/tenant_runtime/__main__.py b/services/tenant-runtime/src/tenant_runtime/__main__.py
deleted file mode 100644
--- a/services/tenant-runtime/src/tenant_runtime/__main__.py
+++ /dev/null
@@ -1,3 +0,0 @@
-from tenant_runtime.app import main
-
-main()
diff --git a/services/tenant-runtime/src/tenant_runtime/app.py b/services/tenant-runtime/src/tenant_runtime/app.py
deleted file mode 100644
--- a/services/tenant-runtime/src/tenant_runtime/app.py
+++ /dev/null
@@ -1,41 +0,0 @@
-"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
-
-import os
-import sys
-from http.server import ThreadingHTTPServer
-
-from nucleos_observability import (
-    Logger,
-    Observability,
-    Telemetry,
-    make_handler,
-    make_observability,
-    telemetry_config_from_env,
-)
-
-SERVICE = "tenant-runtime"
-HEALTH_PATH = "/healthz"
-
-
-def default_observability() -> Observability:
-    version = os.environ.get("APP_VERSION", "0.0.0")
-    env = os.environ.get("APP_ENV", "local")
-    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
-    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
-
-
-def make_server(
-    host: str = "127.0.0.1", port: int = 8001, kit: Observability | None = None
-) -> ThreadingHTTPServer:
-    return ThreadingHTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
-
-
-def main() -> None:
-    host = os.environ.get("HOST", "127.0.0.1")
-    port = int(os.environ.get("PORT", "8001"))
-    print(f"{SERVICE} em http://{host}:{port}", flush=True)
-    make_server(host, port).serve_forever()
-
-
-if __name__ == "__main__":
-    main()
diff --git a/services/tenant-runtime/src/tenant_runtime/policy/__init__.py b/services/tenant-runtime/src/tenant_runtime/policy/__init__.py
deleted file mode 100644
--- a/services/tenant-runtime/src/tenant_runtime/policy/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""Pacote de politica do tenant-runtime (tipagem estrita via mypy --strict; sem logica ainda)."""
diff --git a/services/tenant-runtime/tests/test_health.py b/services/tenant-runtime/tests/test_health.py
deleted file mode 100644
--- a/services/tenant-runtime/tests/test_health.py
+++ /dev/null
@@ -1,61 +0,0 @@
-import http.client
-import io
-import json
-import threading
-
-from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
-from tenant_runtime.app import SERVICE, make_server
-
-SENTINEL = "SENTINEL_tenant_runtime_5ec7e7"
-
-
-def _serve():
-    out = io.StringIO()
-    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
-    logger = Logger(SERVICE, "9.9.9", "test", level="debug", stream=out)
-    kit = make_observability(logger, Telemetry(cfg))
-    server = make_server("127.0.0.1", 0, kit)
-    threading.Thread(target=server.serve_forever, daemon=True).start()
-    return server, out
-
-
-def _get(port: int, path: str, headers: dict[str, str] | None = None):
-    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
-    try:
-        conn.request("GET", path, headers=headers or {})
-        res = conn.getresponse()
-        return res.status, dict(res.getheaders()), res.read()
-    finally:
-        conn.close()
-
-
-def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
-    server, out = _serve()
-    port = server.server_address[1]
-    try:
-        status, _, body = _get(port, "/healthz")
-        assert status == 200
-        assert json.loads(body) == {"status": "ok", "service": "tenant-runtime"}
-        _, _, body = _get(port, "/readyz")
-        assert json.loads(body) == {"status": "ready", "service": "tenant-runtime"}
-        status, headers, _ = _get(
-            port,
-            f"/outra?token={SENTINEL}",
-            {
-                "x-request-id": "edge-py-0001",
-                "authorization": f"Bearer {SENTINEL}",
-                "cookie": f"s={SENTINEL}",
-            },
-        )
-        assert status == 404
-        returned = headers["x-request-id"]
-        assert returned != "edge-py-0001"  # trust_edge=False por padrao
-        assert len(returned) == 36
-    finally:
-        server.shutdown()
-        server.server_close()
-    lines = [json.loads(line) for line in out.getvalue().splitlines()]
-    record = next(r for r in lines if r["data"]["route"] == "unmatched")
-    assert record["correlation_id"] == returned
-    assert record["service"] == "tenant-runtime"
-    assert SENTINEL not in out.getvalue()
diff --git a/services/tool-gateway/pyproject.toml b/services/tool-gateway/pyproject.toml
deleted file mode 100644
--- a/services/tool-gateway/pyproject.toml
+++ /dev/null
@@ -1,16 +0,0 @@
-[project]
-name = "nucleos-tool-gateway"
-version = "0.0.0"
-description = "Servico tool-gateway (hello-world de FND-001; sem logica de negocio)"
-requires-python = ">=3.12"
-dependencies = ["nucleos-observability"]
-
-[tool.uv.sources]
-nucleos-observability = { workspace = true }
-
-[build-system]
-requires = ["uv_build>=0.13.5,<0.14"]
-build-backend = "uv_build"
-
-[tool.uv.build-backend]
-module-name = "tool_gateway"
diff --git a/services/tool-gateway/src/tool_gateway/__init__.py b/services/tool-gateway/src/tool_gateway/__init__.py
deleted file mode 100644
--- a/services/tool-gateway/src/tool_gateway/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""Servico tool-gateway."""
diff --git a/services/tool-gateway/src/tool_gateway/__main__.py b/services/tool-gateway/src/tool_gateway/__main__.py
deleted file mode 100644
--- a/services/tool-gateway/src/tool_gateway/__main__.py
+++ /dev/null
@@ -1,3 +0,0 @@
-from tool_gateway.app import main
-
-main()
diff --git a/services/tool-gateway/src/tool_gateway/app.py b/services/tool-gateway/src/tool_gateway/app.py
deleted file mode 100644
--- a/services/tool-gateway/src/tool_gateway/app.py
+++ /dev/null
@@ -1,41 +0,0 @@
-"""Servidor HTTP minimo (stdlib) com /healthz e /readyz observados (FND-009)."""
-
-import os
-import sys
-from http.server import ThreadingHTTPServer
-
-from nucleos_observability import (
-    Logger,
-    Observability,
-    Telemetry,
-    make_handler,
-    make_observability,
-    telemetry_config_from_env,
-)
-
-SERVICE = "tool-gateway"
-HEALTH_PATH = "/healthz"
-
-
-def default_observability() -> Observability:
-    version = os.environ.get("APP_VERSION", "0.0.0")
-    env = os.environ.get("APP_ENV", "local")
-    config = telemetry_config_from_env(os.environ, SERVICE, version, env)
-    return make_observability(Logger(SERVICE, version, env, stream=sys.stdout), Telemetry(config))
-
-
-def make_server(
-    host: str = "127.0.0.1", port: int = 8003, kit: Observability | None = None
-) -> ThreadingHTTPServer:
-    return ThreadingHTTPServer((host, port), make_handler(kit or default_observability(), SERVICE))
-
-
-def main() -> None:
-    host = os.environ.get("HOST", "127.0.0.1")
-    port = int(os.environ.get("PORT", "8003"))
-    print(f"{SERVICE} em http://{host}:{port}", flush=True)
-    make_server(host, port).serve_forever()
-
-
-if __name__ == "__main__":
-    main()
diff --git a/services/tool-gateway/tests/test_health.py b/services/tool-gateway/tests/test_health.py
deleted file mode 100644
--- a/services/tool-gateway/tests/test_health.py
+++ /dev/null
@@ -1,61 +0,0 @@
-import http.client
-import io
-import json
-import threading
-
-from nucleos_observability import Logger, Telemetry, TelemetryConfig, make_observability
-from tool_gateway.app import SERVICE, make_server
-
-SENTINEL = "SENTINEL_tool_gateway_5ec7e7"
-
-
-def _serve():
-    out = io.StringIO()
-    cfg = TelemetryConfig(enabled=False, service=SERVICE, version="9.9.9", env="test")
-    logger = Logger(SERVICE, "9.9.9", "test", level="debug", stream=out)
-    kit = make_observability(logger, Telemetry(cfg))
-    server = make_server("127.0.0.1", 0, kit)
-    threading.Thread(target=server.serve_forever, daemon=True).start()
-    return server, out
-
-
-def _get(port: int, path: str, headers: dict[str, str] | None = None):
-    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
-    try:
-        conn.request("GET", path, headers=headers or {})
-        res = conn.getresponse()
-        return res.status, dict(res.getheaders()), res.read()
-    finally:
-        conn.close()
-
-
-def test_healthz_readyz_correlation_e_sem_vazamento() -> None:
-    server, out = _serve()
-    port = server.server_address[1]
-    try:
-        status, _, body = _get(port, "/healthz")
-        assert status == 200
-        assert json.loads(body) == {"status": "ok", "service": "tool-gateway"}
-        _, _, body = _get(port, "/readyz")
-        assert json.loads(body) == {"status": "ready", "service": "tool-gateway"}
-        status, headers, _ = _get(
-            port,
-            f"/outra?token={SENTINEL}",
-            {
-                "x-request-id": "edge-py-0001",
-                "authorization": f"Bearer {SENTINEL}",
-                "cookie": f"s={SENTINEL}",
-            },
-        )
-        assert status == 404
-        returned = headers["x-request-id"]
-        assert returned != "edge-py-0001"  # trust_edge=False por padrao
-        assert len(returned) == 36
-    finally:
-        server.shutdown()
-        server.server_close()
-    lines = [json.loads(line) for line in out.getvalue().splitlines()]
-    record = next(r for r in lines if r["data"]["route"] == "unmatched")
-    assert record["correlation_id"] == returned
-    assert record["service"] == "tool-gateway"
-    assert SENTINEL not in out.getvalue()
diff --git a/skills/README.md b/skills/README.md
--- a/skills/README.md
+++ b/skills/README.md
@@ -8,6 +8,7 @@
 
 | Skill | Uso |
 | --- | --- |
+| `arquiteto-de-software` | Investigar e revisar decisões de arquitetura |
 | `grill-me` | Entrevistar requisitos e critérios de aceite |
 | `planejador-de-lote-v1` | Encadear entrevista, especificação e plano Markdown |
 | `tech-lead` | Especificar tickets, contratos, dependências e riscos |
@@ -44,3 +45,11 @@
 Recarregue o projeto ou abra uma nova sessão nos clientes após a substituição.
 As pastas e os metadados foram preparados para descoberta; a execução nos aplicativos
 depende da sessão e das ferramentas disponíveis em cada cliente.
+
+Em 2026-11-06, a limpeza do monorepo também incorporou à fonte a skill
+`arquiteto-de-software`, já presente nas três pastas de descoberta (total: seis skills).
+Os antigos modelos de regras em `skills/modelos/` foram retirados por descreverem
+o fluxo anterior. As referências `_shared/` citadas pelo arquiteto não vieram na distribuição
+disponível; não há runtime ou helpers desses links instalados. O roteiro arquitetural
+foi preservado com a skill.
+As regras de projeto e o corpo da skill continuam disponíveis.
diff --git a/skills/modelos/AGENTS.md b/skills/modelos/AGENTS.md
deleted file mode 100644
--- a/skills/modelos/AGENTS.md
+++ /dev/null
@@ -1,30 +0,0 @@
-# Instruções essenciais para o fluxo de IA
-
-Preserve regras específicas do projeto, arquitetura, dados, documentação e autorização.
-Confirme raiz Git, base/branch e escopo; use a instalação real das skills, sem caminhos
-de outra máquina ou convenções de outro projeto.
-
-O padrão é planejador-de-lote + grill-me na mesma sessão. O planejador consolida
-especificação, unidades e pacote executável e termina no plano. O usuário inicia
-context run; não inicie implementação durante o planejamento.
-
-O runtime Go controla unidades sequenciais, checks, uma revisão corretiva de impactos
-médios/altos/críticos, validação final e entrega local em revisao/. Uma worktree por lote.
-Não chame orquestrador, auditor, review-loop ou QA de tela por IA. Testes de tela e
-aceite visual são manuais ao final; DONE técnico não significa aprovação visual.
-
-No despacho CONTEXTO_EXECUTION=step, execute somente o brief e referências pertinentes.
-Não faça preparação/indexação/process do Node legado. Não leia catálogos/lockfiles/logs
-inteiros. O Go calcula hashes e registra limites, logs, métricas e checkpoints.
-Na retomada, preserve trabalho existente e não repita o que já passou.
-
-O run autoriza somente ações locais previstas explicitamente no manifesto, incluindo
-commits e branch de revisão. Sem push, PR, publicação ou merge automático em main/master.
-Não exponha segredos nem acesse dados reais sem isolamento comprovado.
-
-Um ciclo de correções/testes; lacuna essencial ou risco sem solução autorizada bloqueia
-com diagnóstico preciso. Skills não ampliam permissões do host. Configuração externa,
-fontes, caminhos de documentos/checks e restrições pertencem às regras deste projeto.
-
-Modo custom/legado só por pedido explícito; não migre snapshots/runs antigos silenciosamente.
-Ao editar skills, altere a fonte e sincronize as cópias pelo instalador da distribuição.diff --git a/skills/modelos/CLAUDE.md b/skills/modelos/CLAUDE.md
deleted file mode 100644
--- a/skills/modelos/CLAUDE.md
+++ /dev/null
@@ -1,30 +0,0 @@
-# Instruções essenciais para o fluxo de IA
-
-Preserve regras específicas do projeto, arquitetura, dados, documentação e autorização.
-Confirme raiz Git, base/branch e escopo; use a instalação real das skills, sem caminhos
-de outra máquina ou convenções de outro projeto.
-
-O padrão é planejador-de-lote + grill-me na mesma sessão. O planejador consolida
-especificação, unidades e pacote executável e termina no plano. O usuário inicia
-context run; não inicie implementação durante o planejamento.
-
-O runtime Go controla unidades sequenciais, checks, uma revisão corretiva de impactos
-médios/altos/críticos, validação final e entrega local em revisao/. Uma worktree por lote.
-Não chame orquestrador, auditor, review-loop ou QA de tela por IA. Testes de tela e
-aceite visual são manuais ao final; DONE técnico não significa aprovação visual.
-
-No despacho CONTEXTO_EXECUTION=step, execute somente o brief e referências pertinentes.
-Não faça preparação/indexação/process do Node legado. Não leia catálogos/lockfiles/logs
-inteiros. O Go calcula hashes e registra limites, logs, métricas e checkpoints.
-Na retomada, preserve trabalho existente e não repita o que já passou.
-
-O run autoriza somente ações locais previstas explicitamente no manifesto, incluindo
-commits e branch de revisão. Sem push, PR, publicação ou merge automático em main/master.
-Não exponha segredos nem acesse dados reais sem isolamento comprovado.
-
-Um ciclo de correções/testes; lacuna essencial ou risco sem solução autorizada bloqueia
-com diagnóstico preciso. Skills não ampliam permissões do host. Configuração externa,
-fontes, caminhos de documentos/checks e restrições pertencem às regras deste projeto.
-
-Modo custom/legado só por pedido explícito; não migre snapshots/runs antigos silenciosamente.
-Ao editar skills, altere a fonte e sincronize as cópias pelo instalador da distribuição.diff --git a/skills/modelos/README.md b/skills/modelos/README.md
deleted file mode 100644
--- a/skills/modelos/README.md
+++ /dev/null
@@ -1,24 +0,0 @@
-# Modelos mínimos de instruções
-
-`CLAUDE.md` e `AGENTS.md` contêm o mesmo bloco essencial para o fluxo destas skills. São modelos para incorporar às regras de outro projeto, não configurações completas de aplicação.
-
-## Como usar
-
-1. Instale as skills conforme o README da distribuição, preservando `_shared/`, referências e scripts.
-2. Para Claude, use o conteúdo de `CLAUDE.md`. Para um agente que lê `AGENTS.md`, use o conteúdo desse arquivo. Se o projeto usa ambos, mantenha o bloco consistente nos dois ou estabeleça uma fonte comum explicitamente referenciada.
-3. Se o arquivo de destino já existe, acrescente o bloco e resolva conflitos com suas regras. **Não substitua o arquivo inteiro nem apague instruções existentes.** Os modelos ficam em `modelos/` para não se tornarem regras ativas na raiz desta distribuição.
-4. Acrescente os fatos específicos do seu projeto descritos abaixo. A configuração muda no projeto; o código das skills permanece reutilizável.
-
-## O que configurar em cada projeto
-
-| Informação | O que declarar nas regras locais ou na configuração existente |
-| --- | --- |
-| Repositórios | Raízes e camadas; não presuma que backend e frontend estão na mesma raiz Git |
-| Validação | Comandos reais de lint, build e testes; critérios e isolamento exigido para banco/serviços |
-| Documentos e worktrees | Diretórios de planos, relatórios, entregas e worktrees; fuso operacional |
-| Políticas locais | Regras de dependências, Git, dados e limites adicionais; permissões continuam sendo as do cliente |
-| Contexto integrado | Node.js >=22.13/Git e configuração da raiz; a CLI já acompanha `_shared` |
-
-O Contexto acompanha as skills em `_shared/contexto`; o agente executa a preparação automaticamente e o helper informa o caminho do project.json/SQLite dentro das skills locais. Configuração legada em `.contexto/project.json` é preservada. Workflow descreve caminhos, fuso e repositórios; não concede autorização nem substitui segurança. Não é necessário instalar/cadastrar MCP, configurar CONTEXTO_CLI nem executar init manualmente. Node/Git e executores independentes são recursos do host; gates que dependem de recursos ausentes ficam bloqueados.
-
-Os modelos não incluem caminhos de máquina, nomes de empresa, framework obrigatório, banco específico, credenciais ou vínculo obrigatório com gerenciador de tarefas. Também não repetem os contratos completos de cada skill: eles continuam nos respectivos `SKILL.md` e referências.
diff --git a/skills/skills/arquiteto-de-software/SKILL.md b/skills/skills/arquiteto-de-software/SKILL.md
new file mode 100644
--- /dev/null
+++ b/skills/skills/arquiteto-de-software/SKILL.md
@@ -0,0 +1,28 @@
+---
+name: arquiteto-de-software
+description: Investiga e define ou revisa arquitetura, domínios, dados, contratos e decisões estruturais com base nos requisitos e no sistema existente. Use para decisões arquiteturais e handoff técnico; não para planejar sprints, implementar ou revisar rotineiramente um diff.
+---
+
+# Arquiteto de software
+
+Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Entregue a decisão ou análise da etapa; não inicie outros papéis do workflow.
+
+## Registro de execução e contexto compacto
+
+Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).
+
+Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.
+
+Construa a menor arquitetura que atende os requisitos conhecidos e permite evolução. Identifique se o pedido é greenfield, evolução, legado ou revisão focal; não presuma projeto novo.
+
+Leia AGENTS.md, requisitos, ADRs, documentação e código relacionado antes de propor mudanças. Diferencie estado observado, requisito aprovado, hipótese e decisão proposta. Pergunte somente o que muda materialmente uma decisão; avance nas partes independentes.
+
+Para análise ampla, consulte o [roteiro arquitetural](references/roteiro-arquitetural.md). Ele é um catálogo de dimensões e formatos: selecione somente os aplicáveis. Não execute todas as etapas nem gere toda a árvore documental para responder a uma questão pontual.
+
+Avalie limites de domínio, ownership de dados, contratos, consistência, segurança, integrações, migrações, operação e custo conforme o risco. Compare alternativas reais e registre trade-offs. Não escolha microserviços, DDD, filas ou infraestrutura por padrão.
+
+Respeite ADRs aceitos. Mudanças estruturais devem explicar o conflito, alternativas e proposta de novo ADR; não silenciosamente redefinir o sistema. Decisão proposta não é decisão aceita.
+
+Siga a organização documental existente. Registre ADR para decisão estrutural relevante, não detalhes triviais. No planejamento de uma arquitetura completa, produza `TECH-LEAD-HANDOFF.md` com objetivo, estado atual/alvo, domínios, componentes, stack, contratos, requisitos, riscos, hipóteses, migrações, dependências e restrições de sequência. Em revisão focal, atualize apenas os artefatos afetados.
+
+Entregue decisão/recomendação, evidências, artefatos alterados e questões em aberto. O Tech Lead planeja tickets e sprints; o arquiteto não implementa nem aprova a própria entrega.
diff --git a/skills/skills/arquiteto-de-software/references/roteiro-arquitetural.md b/skills/skills/arquiteto-de-software/references/roteiro-arquitetural.md
new file mode 100644
--- /dev/null
+++ b/skills/skills/arquiteto-de-software/references/roteiro-arquitetural.md
@@ -0,0 +1,828 @@
+# Arquiteto de Software
+
+## Papel
+
+Atue como Principal Software Architect.
+
+Sua responsabilidade é transformar necessidades de negócio em uma arquitetura
+coerente, documentada, sustentável e implementável.
+
+Você deve pensar como:
+
+- Arquiteto de Software;
+- Arquiteto de Soluções;
+- Arquiteto Backend;
+- Arquiteto Frontend;
+- Arquiteto de Dados;
+- Arquiteto de Integrações;
+- Arquiteto de Segurança;
+- Arquiteto de Cloud;
+- Engenheiro de Plataforma.
+
+Sua principal responsabilidade NÃO é criar sprints nem implementar features.
+
+Seu trabalho deve preparar o projeto para o Tech Lead.
+
+---
+
+# Objetivo
+
+Responder com clareza:
+
+O QUE o sistema precisa fazer?
+
+COMO o sistema deve ser estruturado?
+
+QUAIS são os seus domínios?
+
+QUAIS componentes existirão?
+
+COMO os componentes se comunicam?
+
+QUEM possui cada dado?
+
+QUAIS tecnologias são adequadas?
+
+QUAIS riscos existem?
+
+QUAIS decisões arquiteturais devem ser preservadas?
+
+---
+
+# MODOS DE OPERAÇÃO
+
+Identifique automaticamente o cenário.
+
+## GREENFIELD
+
+Projeto ainda não implementado.
+
+## DESENVOLVIMENTO INICIAL
+
+Alguma estrutura já existe, mas a arquitetura ainda está sendo formada.
+
+## PROJETO EM DESENVOLVIMENTO
+
+Existem funcionalidades, código, banco, testes e documentação.
+
+## SISTEMA LEGADO
+
+Existe sistema operacional cuja arquitetura precisa ser compreendida antes de
+qualquer mudança.
+
+## REVISÃO ARQUITETURAL
+
+Arquitetura existente precisa ser revisada.
+
+Nunca presuma que um projeto é greenfield.
+
+---
+
+# ETAPA 0 — Inspeção
+
+Antes de propor arquitetura, analise o que estiver disponível:
+
+- AGENTS.md;
+- README;
+- documentação;
+- código fonte;
+- migrations;
+- banco;
+- APIs;
+- Docker;
+- CI/CD;
+- infraestrutura;
+- testes;
+- ADRs;
+- backlog;
+- sprints;
+- arquivos de configuração;
+- dependências;
+- histórico relevante.
+
+Em projeto existente:
+
+CÓDIGO É EVIDÊNCIA.
+
+Não redesenhe antes de compreender o que já existe.
+
+---
+
+# ETAPA 1 — Investigação do produto
+
+Descubra:
+
+## Produto
+
+- Qual problema é resolvido?
+- Quem é o usuário?
+- Quem paga?
+- Quem administra?
+- Quais atores existem?
+- Quais fluxos principais existem?
+- O que constitui sucesso?
+
+## Escala
+
+- quantidade esperada de usuários;
+- usuários simultâneos;
+- volume de dados;
+- volume de requests;
+- volume de arquivos;
+- crescimento esperado.
+
+## Operação
+
+- disponibilidade;
+- tolerância a falhas;
+- necessidade de processamento assíncrono;
+- notificações;
+- integrações;
+- relatórios;
+- auditoria.
+
+## Segurança
+
+- dados sensíveis;
+- autenticação;
+- autorização;
+- multi-tenancy;
+- compliance;
+- LGPD quando aplicável.
+
+## Restrições
+
+- orçamento;
+- prazo;
+- stack;
+- equipe;
+- cloud;
+- fornecedores;
+- legado.
+
+---
+
+# ETAPA 2 — Perguntas ao usuário
+
+Faça perguntas somente quando a resposta puder alterar materialmente a arquitetura.
+
+Não transforme o processo em entrevista infinita.
+
+Quando for possível continuar:
+
+registre:
+
+ASSUNCAO-001
+
+Descrição:
+
+Impacto:
+
+Necessita validação:
+
+SIM / NÃO
+
+---
+
+# ETAPA 3 — Estado atual
+
+Em projetos existentes documente:
+
+## Aplicações
+
+## Serviços
+
+## Banco
+
+## Infraestrutura
+
+## Autenticação
+
+## Autorização
+
+## Integrações
+
+## Filas
+
+## Jobs
+
+## Cache
+
+## Arquivos
+
+## Observabilidade
+
+## Deploy
+
+## Testes
+
+---
+
+# ETAPA 4 — Gap arquitetural
+
+Compare:
+
+ESTADO ATUAL
+
+vs.
+
+REQUISITOS
+
+vs.
+
+ESTADO NECESSÁRIO
+
+Identifique:
+
+- documentação ausente;
+- decisões não documentadas;
+- inconsistências;
+- acoplamento;
+- duplicação;
+- débito técnico;
+- risco de segurança;
+- risco de escala;
+- risco operacional;
+- arquitetura divergente da documentação.
+
+Quando houver gap relevante, registrar no padrão do projeto; sugestão:
+
+documentacoes/arquitetura/analise-gap-arquitetural.md
+
+Classificar:
+
+CRÍTICO
+ALTO
+MÉDIO
+BAIXO
+
+---
+
+# ETAPA 5 — Modelo de domínio
+
+Identifique:
+
+- domínios;
+- subdomínios;
+- bounded contexts quando fizer sentido;
+- entidades;
+- agregados;
+- value objects;
+- serviços de domínio;
+- comandos;
+- consultas;
+- eventos;
+- invariantes.
+
+Para cada domínio:
+
+## Responsabilidade
+
+## Entidades
+
+## Regras
+
+## Entradas
+
+## Saídas
+
+## Eventos produzidos
+
+## Eventos consumidos
+
+## Dados pertencentes ao domínio
+
+## Dependências
+
+Evite DDD cerimonial.
+
+Use somente quando agregar clareza.
+
+---
+
+# ETAPA 6 — Arquitetura alvo
+
+Avalie opções como:
+
+- monólito modular;
+- arquitetura em camadas;
+- Clean Architecture;
+- Hexagonal;
+- Vertical Slice;
+- event-driven;
+- serviços;
+- microserviços;
+- serverless;
+- híbrida.
+
+Não escolha microserviços automaticamente.
+
+Documente:
+
+## Arquitetura escolhida
+
+## Contexto
+
+## Motivo
+
+## Alternativas avaliadas
+
+## Benefícios
+
+## Trade-offs
+
+## Consequências
+
+## Quando reconsiderar
+
+---
+
+# ETAPA 7 — Componentes
+
+Identifique componentes necessários.
+
+Exemplos:
+
+- aplicação web;
+- aplicação mobile;
+- portal administrativo;
+- API;
+- serviço de autenticação;
+- workers;
+- scheduler;
+- broker;
+- cache;
+- banco;
+- busca;
+- object storage;
+- CDN;
+- IA;
+- notificações;
+- analytics.
+
+Para cada componente:
+
+## Responsabilidade
+
+## Tecnologia
+
+## Interfaces
+
+## Dependências
+
+## Dados pertencentes
+
+## Forma de escala
+
+## Comportamento de falha
+
+## Fronteira de segurança
+
+---
+
+# ETAPA 8 — Escolha de tecnologias
+
+Avaliar:
+
+- adequação ao problema;
+- produtividade;
+- suporte a desenvolvimento assistido por IA;
+- performance;
+- concorrência;
+- escalabilidade;
+- segurança;
+- maturidade;
+- testes;
+- observabilidade;
+- comunidade;
+- custo;
+- complexidade operacional;
+- lock-in;
+- conhecimento da equipe.
+
+Não escolher tecnologia por moda.
+
+---
+
+# ETAPA 9 — ADRs
+
+Decisões estruturais devem gerar ADR.
+
+Local:
+
+documentacoes/arquitetura/adr/
+
+Formato:
+
+# ADR-XXX — Título
+
+## Status
+
+Proposta / Aceita / Substituída / Descontinuada
+
+## Contexto
+
+## Problema
+
+## Decisão
+
+## Alternativas avaliadas
+
+## Benefícios
+
+## Trade-offs
+
+## Consequências
+
+## Quando revisar
+
+Não criar ADR para detalhes triviais.
+
+---
+
+# ETAPA 10 — Arquitetura de dados
+
+Definir:
+
+- banco;
+- schemas;
+- entidades;
+- tabelas;
+- relacionamentos;
+- PKs;
+- FKs;
+- uniques;
+- constraints;
+- índices;
+- queries críticas;
+- soft delete;
+- auditoria;
+- multi-tenancy;
+- retenção;
+- criptografia;
+- dados sensíveis;
+- backups;
+- migrations.
+
+Identifique:
+
+- tabelas de alto crescimento;
+- risco de N+1;
+- queries críticas;
+- cardinalidade;
+- índices importantes.
+
+Criar Mermaid ER quando útil.
+
+---
+
+# ETAPA 11 — Arquitetura de APIs
+
+Definir:
+
+- REST / GraphQL / RPC;
+- versionamento;
+- autenticação;
+- autorização;
+- paginação;
+- filtros;
+- ordenação;
+- pesquisa;
+- validação;
+- erros;
+- idempotência;
+- rate limit;
+- correlation ID;
+- webhooks.
+
+Endpoints críticos devem especificar:
+
+METHOD /rota
+
+Objetivo
+
+Ator
+
+Autorização
+
+Request
+
+Response
+
+Validação
+
+Regras
+
+Erros
+
+Eventos
+
+Idempotência
+
+Observabilidade
+
+---
+
+# ETAPA 12 — Eventos e processamento assíncrono
+
+Determinar necessidade de:
+
+- filas;
+- workers;
+- jobs;
+- scheduler;
+- domain events;
+- integration events;
+- retries;
+- DLQ.
+
+Para cada fluxo:
+
+Produtor
+
+Consumidor
+
+Payload
+
+Retry
+
+Idempotência
+
+Falha
+
+DLQ
+
+Observabilidade
+
+---
+
+# ETAPA 13 — Segurança
+
+Avaliar:
+
+- autenticação;
+- autorização;
+- roles;
+- permissions;
+- isolamento entre tenants;
+- sessão;
+- tokens;
+- secrets;
+- criptografia;
+- rate limit;
+- brute force;
+- auditoria;
+- logs sensíveis;
+- XSS;
+- CSRF;
+- SQL injection;
+- SSRF;
+- uploads;
+- dependências;
+- acesso administrativo;
+- webhooks.
+
+Transformar descobertas importantes em requisitos explícitos.
+
+---
+
+# ETAPA 14 — Infraestrutura
+
+Definir arquiteturalmente:
+
+LOCAL
+
+DESENVOLVIMENTO
+
+TESTE
+
+STAGING
+
+PRODUÇÃO
+
+Considerar:
+
+- compute;
+- containers;
+- banco;
+- cache;
+- fila;
+- storage;
+- CDN;
+- DNS;
+- TLS;
+- networking;
+- firewall;
+- secrets;
+- backups;
+- observabilidade.
+
+Evitar overengineering.
+
+---
+
+# ETAPA 15 — Observabilidade
+
+Definir:
+
+## Logs
+
+Logs estruturados.
+
+## Métricas
+
+- latência;
+- erros;
+- tráfego;
+- banco;
+- filas;
+- recursos;
+- métricas de negócio.
+
+## Tracing
+
+Quando necessário.
+
+## Alertas
+
+Alertas devem ser acionáveis.
+
+---
+
+# ETAPA 16 — Diagramas
+
+Criar Mermaid quando útil para:
+
+1. contexto;
+2. containers;
+3. componentes;
+4. deploy;
+5. sequências críticas;
+6. domínios;
+7. dados.
+
+Diagramas devem aumentar entendimento.
+
+---
+
+# ETAPA 17 — Riscos
+
+Criar registro:
+
+RISK-XXX
+
+Descrição:
+
+Probabilidade:
+BAIXA / MÉDIA / ALTA
+
+Impacto:
+BAIXO / MÉDIO / ALTO / CRÍTICO
+
+Área:
+
+Mitigação:
+
+Contingência:
+
+Trigger de revisão:
+
+---
+
+# ETAPA 18 — Documentação
+
+Preferir:
+
+documentacoes/
+├── arquitetura/
+│   ├── visao-geral.md
+│   ├── estado-atual.md
+│   ├── estado-alvo.md
+│   ├── decisoes-tecnologicas.md
+│   ├── integracoes.md
+│   ├── seguranca.md
+│   ├── infraestrutura.md
+│   ├── riscos.md
+│   ├── TECH-LEAD-HANDOFF.md
+│   └── adr/
+│
+├── dominio/
+│   └── modelo-dominio.md
+│
+├── banco/
+│   └── modelo-dados.md
+│
+├── api/
+│   └── especificacao-api.md
+│
+└── requisitos/
+    └── requisitos-tecnicos.md
+
+Se o projeto já tiver padrão documental, respeitá-lo.
+
+---
+
+# ETAPA 19 — Handoff ao Tech Lead
+
+Em definição arquitetural completa com handoff de execução, criar:
+
+documentacoes/arquitetura/TECH-LEAD-HANDOFF.md
+
+Contendo:
+
+# Objetivo do sistema
+
+# Estado atual
+
+# Arquitetura alvo
+
+# Domínios
+
+# Componentes
+
+# Stack
+
+# ADRs importantes
+
+# Requisitos funcionais
+
+# Requisitos não funcionais
+
+# Segurança
+
+# Infraestrutura
+
+# Integrações
+
+# Dados
+
+# APIs
+
+# Filas e assíncrono
+
+# Estratégia de testes esperada
+
+# Dependências técnicas
+
+# Riscos
+
+# Assunções
+
+# Débito técnico
+
+# Migrações necessárias
+
+# Restrições de sequenciamento
+
+# Decisões que não devem ser alteradas sem novo ADR
+
+---
+
+# RELATÓRIO FINAL
+
+Ao finalizar, apresentar:
+
+## Estado do projeto
+
+## Arquitetura definida
+
+## Documentação analisada
+
+## Documentação criada
+
+## ADRs criados
+
+## Domínios identificados
+
+## Componentes
+
+## Riscos críticos
+
+## Assunções
+
+## Problemas encontrados
+
+## Questões que ainda precisam de decisão humana
+
+## Pronto para o Tech Lead?
+
+SIM / NÃO
+
+Se NÃO:
+
+explique exatamente o bloqueio.
+
+---
+
+# REGRA DE OURO
+
+Construa a MENOR arquitetura capaz de atender corretamente aos requisitos
+conhecidos e evoluir com segurança.
+
+Evite:
+
+SUBENGENHARIA
+
+e
+
+OVERENGINEERING PREMATURO.
diff --git a/tools/contexto-legado/contexto-projeto.json b/tools/contexto-legado/contexto-projeto.json
new file mode 100644
--- /dev/null
+++ b/tools/contexto-legado/contexto-projeto.json
@@ -0,0 +1,58 @@
+{
+  "include": [
+    "README.md",
+    "AGENTS.md",
+    "CLAUDE.md",
+    "Nucleos-Especificacao-Mestra.md",
+    "documentacoes",
+    "lessons",
+    "apps",
+    "services",
+    "packages",
+    "infrastructure",
+    "scripts",
+    "tools"
+  ],
+  "exclude": [
+    "node_modules",
+    "vendor",
+    ".git",
+    ".contexto",
+    ".claude",
+    ".agents",
+    ".agent",
+    "skills",
+    "storage",
+    "dist",
+    "build",
+    "bin",
+    "obj",
+    ".venv",
+    ".run",
+    ".turbo",
+    ".next",
+    "__pycache__"
+  ],
+  "workflow": {
+    "schema": 1,
+    "preset": "generic",
+    "timezone": "America/Sao_Paulo",
+    "plansDir": "documentacoes/planejamento-ia",
+    "reportsDir": "documentacoes/reviews",
+    "deliveryDir": "documentacoes",
+    "reviewBranchPrefix": "revisao/",
+    "defaultProfile": "padrao",
+    "rules": [
+      "AGENTS.md"
+    ],
+    "repositories": [
+      {
+        "name": "nucleos",
+        "root": ".",
+        "layer": "monorepo"
+      }
+    ],
+    "worktreeDir": "../nucleos-worktrees",
+    "publish": "manual"
+  }
+}
diff --git a/tools/contexto-legado/instalar-contexto.sh b/tools/contexto-legado/instalar-contexto.sh
new file mode 100644
--- /dev/null
+++ b/tools/contexto-legado/instalar-contexto.sh
@@ -0,0 +1,122 @@
+#!/usr/bin/env bash
+# Instala e confere o Contexto (memoria local dos agentes de IA) neste checkout.
+# Idempotente: pode ser executado de novo sem efeitos colaterais.
+# Nao usa sudo, nao instala Node/Git, nao troca de branch e nao altera arquivos versionados.
+# Aplica tools/contexto-legado/contexto-projeto.json (include, exclude e workflow) em .contexto/project.json.
+#
+# Uso: bash tools/contexto-legado/instalar-contexto.sh [--codex]
+#   --codex  registra tambem o servidor MCP na configuracao global do Codex
+# Variavel opcional: CONTEXTO_DIR (padrao: pasta "contexto" ao lado do repositorio)
+set -euo pipefail
+
+REPO_URL="https://github.com/ViniciusBernucci/contexto.git"
+ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
+TOOL_DIR="${CONTEXTO_DIR:-$(dirname "$ROOT")/contexto}"
+WITH_CODEX=false
+for arg in "$@"; do
+  case "$arg" in
+    --codex) WITH_CODEX=true ;;
+    *) echo "Opcao desconhecida: $arg" >&2; exit 2 ;;
+  esac
+done
+
+ok() { echo "[ok] $*"; }
+warn() { echo "[aviso] $*"; }
+fail() { echo "[erro] $*" >&2; exit 1; }
+contexto() { node "$TOOL_DIR/contexto.mjs" "$@" --project "$ROOT" 2>/dev/null; }
+# expect PADRAO MENSAGEM COMANDO...: guarda a saida do comando e falha se o padrao nao aparecer.
+expect() {
+  local pattern="$1" message="$2" output
+  shift 2
+  output="$("$@" || true)"
+  grep -q -- "$pattern" <<<"$output" || fail "$message"
+}
+mcp_initialize() {
+  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' | contexto mcp
+}
+
+cd "$ROOT"
+echo "Repositorio: $ROOT"
+echo "Ferramenta:  $TOOL_DIR"
+
+# 1. Pre-requisitos
+command -v node >/dev/null || fail "Node nao encontrado. Instale o Node v22.13 ou maior."
+command -v git >/dev/null || fail "Git nao encontrado. Instale o Git 2.36 ou maior."
+node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)' \
+  || fail "Node $(node --version) e antigo. Precisa ser v22.13 ou maior (veja o passo 1 do README)."
+git --version | node -e 'const [a, b] = require("fs").readFileSync(0, "utf8").match(/(\d+)\.(\d+)/).slice(1).map(Number); process.exit(a > 2 || (a === 2 && b >= 36) ? 0 : 1)' \
+  || fail "$(git --version) e antigo. Precisa ser 2.36 ou maior (veja o passo 1 do README)."
+ok "Node $(node --version) e $(git --version)"
+
+# 2. Ferramenta ao lado do repositorio
+if [ -f "$TOOL_DIR/contexto.mjs" ]; then
+  ok "Contexto ja presente em $TOOL_DIR"
+else
+  [ -e "$TOOL_DIR" ] && fail "$TOOL_DIR existe, mas nao contem contexto.mjs. Revise a pasta antes de continuar."
+  git clone --quiet "$REPO_URL" "$TOOL_DIR"
+  ok "Contexto clonado em $TOOL_DIR"
+fi
+
+# 3. Registro do repositorio (hook local do Git)
+expect '"registered":true' "setup falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" setup --project \"$ROOT\"" contexto setup
+ok "Repositorio registrado"
+
+# 4. Branch de trabalho
+BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
+case "$BRANCH" in
+  main|master|"") fail "Voce esta em '${BRANCH:-HEAD destacado}'. O Contexto nao prepara main/master. Rode 'git switch developer' e execute este script de novo." ;;
+esac
+expect '"prepared":true' "ensure falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" ensure --project \"$ROOT\"" contexto ensure
+expect '"ok":true' "doctor falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" doctor --project \"$ROOT\"" contexto doctor
+ok "Branch '$BRANCH' preparada (.contexto/ criada e indexada)"
+
+# 4.1 Configuracao versionada do projeto (fontes indexadas e workflow das skills)
+CONFIG_STATUS="$(node -e '
+const fs = require("fs");
+const [file, versioned] = process.argv.slice(1);
+const config = JSON.parse(fs.readFileSync(file, "utf8"));
+const project = JSON.parse(fs.readFileSync(versioned, "utf8"));
+const keys = ["include", "exclude", "workflow"];
+if (keys.every(key => JSON.stringify(config[key]) === JSON.stringify(project[key]))) { console.log("igual"); process.exit(0); }
+for (const key of keys) config[key] = project[key];
+fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
+console.log("atualizada");
+' "$ROOT/.contexto/project.json" "$ROOT/tools/contexto-legado/contexto-projeto.json")"
+if [ "$CONFIG_STATUS" = "atualizada" ]; then
+  expect '"registered":true' "setup --config-from falhou." contexto setup --config-from "$ROOT"
+  expect '"sources"' "index falhou." contexto index
+  ok "Configuracao de tools/contexto-legado/contexto-projeto.json aplicada e indice refeito"
+else
+  ok "Configuracao de tools/contexto-legado/contexto-projeto.json ja aplicada"
+fi
+
+# 5. Teste de busca e do servidor MCP
+expect '"source"' "A busca de teste nao retornou resultados." contexto search --query "lessons" --limit 1
+expect '"contexto-local"' "O servidor MCP nao respondeu." mcp_initialize
+ok "Busca e servidor MCP funcionando"
+
+# 6. Integracao com os clientes de IA
+if [ -f .mcp.json ] && grep -q '"contexto"' .mcp.json; then
+  ok ".mcp.json do Claude Code presente"
+else
+  warn ".mcp.json sem o servidor 'contexto'. Siga os passos 6 a 8 do README (uma vez no repositorio)."
+fi
+if command -v claude >/dev/null; then
+  if grep -q '^contexto:.*Connected' <<<"$(claude mcp list 2>/dev/null || true)"; then
+    ok "Claude Code conectado ao Contexto"
+  else
+    warn "Claude Code nao mostrou 'contexto ... Connected'. Rode 'claude mcp list' dentro de $ROOT."
+  fi
+fi
+if [ "$WITH_CODEX" = true ]; then
+  command -v codex >/dev/null || fail "--codex informado, mas o Codex nao esta instalado."
+  NAME="contexto-$(basename "$ROOT")"
+  if codex mcp get "$NAME" >/dev/null 2>&1; then
+    ok "Codex ja tem o servidor '$NAME'"
+  else
+    codex mcp add "$NAME" -- "$(command -v node)" "$TOOL_DIR/contexto.mjs" mcp --project "$ROOT" >/dev/null
+    ok "Servidor '$NAME' registrado no Codex"
+  fi
+fi
+
+echo "Instalacao concluida."
diff --git a/tools/qualidade/regressao.mjs b/tools/qualidade/regressao.mjs
--- a/tools/qualidade/regressao.mjs
+++ b/tools/qualidade/regressao.mjs
@@ -67,7 +67,7 @@
     deveFalhar(`depcruise ${regra}`, dep, regra);
   }
 
-  // 4) Python: ruff (eval), mypy --strict (sem tipos), import-linter (servicos/SDK).
+  // 4) Python: ruff (eval), mypy --strict (sem tipos), import-linter (packages/servicos).
   deveFalhar(
     "ruff eval_inseguro.py",
     exec("uv", [
@@ -100,8 +100,12 @@
       env: { ...process.env, PYTHONPATH: join(reg, "python", "imports") },
     },
   );
-  deveFalhar("import-linter servicos independentes", il, "nao importam uns aos outros BROKEN");
-  deveFalhar("import-linter SDK do provisioner", il, "SDK do provisioner BROKEN");
+  deveFalhar("import-linter packages sem servicos", il, "nao importam servicos BROKEN");
+  deveFalhar(
+    "import-linter contratos independentes",
+    il,
+    "nao importam outros pacotes internos BROKEN",
+  );
 
   // 5) gitleaks: segredo sintetico gerado agora (nada de segredo armazenado no repositorio).
   const seg = join(tmpRaiz, "segredo");
diff --git a/tools/qualidade/regressao/README.md b/tools/qualidade/regressao/README.md
--- a/tools/qualidade/regressao/README.md
+++ b/tools/qualidade/regressao/README.md
@@ -5,3 +5,8 @@
 normais, e so sao lidos por `tools/qualidade/regressao.mjs` (`make lint-regressao`), que
 confirma que cada violacao FALHA com a regra esperada. Se um controle deixar de pegar sua
 violacao, o runner falha. O segredo sintetico nao e armazenado: e gerado em tempo de execucao.
+
+No MVP local (ADR-027), as fixtures Python verificam a direção entre pacotes e
+serviço: pacotes compartilhados não importam `ai_gateway`, e contratos não importam
+outros pacotes internos. Os antigos serviços de probes não são necessários para
+exercitar essas regras. As fixtures TypeScript continuam protegendo apps/pacotes.
diff --git a/tools/qualidade/regressao/python/imports/nucleos_config/__init__.py b/tools/qualidade/regressao/python/imports/nucleos_config/__init__.py
new file mode 100644
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/nucleos_config/__init__.py
@@ -0,0 +1,3 @@
+"""DEVE FALHAR: um pacote compartilhado nao importa o servico consumidor."""
+
+import ai_gateway  # noqa: F401
diff --git a/tools/qualidade/regressao/python/imports/nucleos_contracts/__init__.py b/tools/qualidade/regressao/python/imports/nucleos_contracts/__init__.py
new file mode 100644
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/nucleos_contracts/__init__.py
@@ -0,0 +1,3 @@
+"""DEVE FALHAR: contratos nao dependem de outros pacotes internos."""
+
+import nucleos_observability  # noqa: F401
diff --git a/tools/qualidade/regressao/python/imports/nucleos_observability/__init__.py b/tools/qualidade/regressao/python/imports/nucleos_observability/__init__.py
new file mode 100644
--- /dev/null
+++ b/tools/qualidade/regressao/python/imports/nucleos_observability/__init__.py
@@ -0,0 +1 @@
+"""Pacote alvo para verificar a independencia dos contratos."""
diff --git a/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py b/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py
deleted file mode 100644
--- a/tools/qualidade/regressao/python/imports/tenant_runtime/__init__.py
+++ /dev/null
@@ -1,3 +0,0 @@
-"""DEVE FALHAR no import-linter: tenant-runtime nao importa o SDK do provisioner."""
-
-import tenant_provisioner  # type: ignore[import-not-found]  # noqa: F401
diff --git a/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py b/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py
deleted file mode 100644
--- a/tools/qualidade/regressao/python/imports/tool_gateway/__init__.py
+++ /dev/null
@@ -1,3 +0,0 @@
-"""DEVE FALHAR no import-linter: servicos nao importam outros servicos."""
-
-import ai_gateway  # noqa: F401
diff --git a/uv.lock b/uv.lock
--- a/uv.lock
+++ b/uv.lock
@@ -13,10 +13,7 @@
     "nucleos-config",
     "nucleos-contracts",
     "nucleos-enterprise-python",
-    "nucleos-event-dispatcher",
     "nucleos-observability",
-    "nucleos-tenant-runtime",
-    "nucleos-tool-gateway",
 ]
 
 [[package]]
@@ -1094,17 +1091,6 @@
 ]
 
 [[package]]
-name = "nucleos-event-dispatcher"
-version = "0.0.0"
-source = { editable = "services/event-dispatcher" }
-dependencies = [
-    { name = "nucleos-observability" },
-]
-
-[package.metadata]
-requires-dist = [{ name = "nucleos-observability", editable = "packages/observability-py" }]
-
-[[package]]
 name = "nucleos-observability"
 version = "0.0.0"
 source = { editable = "packages/observability-py" }
@@ -1122,28 +1108,6 @@
     { name = "opentelemetry-sdk", specifier = "==1.45.1" },
     { name = "structlog", specifier = "==26.1.0" },
 ]
-
-[[package]]
-name = "nucleos-tenant-runtime"
-version = "0.0.0"
-source = { editable = "services/tenant-runtime" }
-dependencies = [
-    { name = "nucleos-observability" },
-]
-
-[package.metadata]
-requires-dist = [{ name = "nucleos-observability", editable = "packages/observability-py" }]
-
-[[package]]
-name = "nucleos-tool-gateway"
-version = "0.0.0"
-source = { editable = "services/tool-gateway" }
-dependencies = [
-    { name = "nucleos-observability" },
-]
-
-[package.metadata]
-requires-dist = [{ name = "nucleos-observability", editable = "packages/observability-py" }]
 
 [[package]]
 name = "opentelemetry-api"
````
