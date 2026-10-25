# EP-01 — Tickets

Regras globais (DoR/DoD, legendas): [../README.md](../README.md).

<a id="ent-fnd-001"></a>
## ENT-FND-001 — Scaffolding do monorepo

**Sprint** S00 · **Prioridade** Crítica · **Tam.** M · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** — · **Bloqueia:** praticamente todos · **Paralelo a:** FND-008, DEC-001..004
**Referências:** ADR seção 14.

**Objetivo.** Criar o repositório com a árvore da seção 14 do ADR, tooling mínimo e *hello-world* verde em cada componente, sem lógica de negócio.

**Especificação técnica**
- Árvore: `apps/web` (Next.js), `apps/api` (NestJS), `apps/tenant-provisioner` (worker TS), `services/tenant-runtime` (Python), `services/ai-gateway`, `services/tool-gateway`, `services/event-dispatcher`, `packages/contracts`, `packages/sdk`, `infrastructure/{docker,ansible,terraform,kubernetes}`, `documentacoes/`, `lessons/`. `terraform/` e `kubernetes/` nascem com README "reservado" (estágio 2/3), sem código.
- Gerenciador de workspaces TypeScript (pnpm workspaces; orquestrador de tarefas como Turborepo ou Nx **a escolher no ticket, com justificativa em nota**); versões de Node LTS e pnpm fixadas (`.nvmrc`, `packageManager`, `engines`).
- Python ≥ 3.12 com `uv` (workspace por serviço, `pyproject.toml`, `uv.lock` versionado). Cada serviço Python é pacote independente com seu `Dockerfile` futuro.
- Raiz com `Makefile` (ou `Taskfile`) expondo `make setup | lint | test | build | up | down`, escondendo a diferença de linguagem.
- `.editorconfig`, `.gitignore` (inclui `.env*`, exceto `.env.example`), `.dockerignore`, `CODEOWNERS` (caminhos de segurança exigem revisor adicional: `services/tool-gateway`, `apps/tenant-provisioner`, `infrastructure/`).
- *Hello world* por componente com teste trivial e endpoint `/healthz`.
- Registrar em `documentacoes/engenharia/` as **versões exatas verificadas na data** (Node, pnpm, NestJS, Next.js, Python, uv) — não assumir versões de memória.

**Fora do escopo.** Código de domínio, Dockerfiles de produção (ISO-007/RUN-002), pipelines (FND-005).

**Critérios de aceite**
- [ ] Clone limpo + `make setup && make test` passa em máquina sem estado prévio.
- [ ] Todo componente responde `/healthz` em execução local.
- [ ] `CODEOWNERS` cobre os caminhos sensíveis; `.gitignore` impede commit de `.env`.
- [ ] Nenhuma dependência sem *lock file*.

**Testes.** Smoke de build/test por workspace; teste de que `git ls-files` não contém `.env`.

---

<a id="ent-fnd-002"></a>
## ENT-FND-002 — Padrões de qualidade, linters e hooks

**Sprint** S00 · **Prioridade** Alta · **Tam.** S · **Risco** BAIXO · **Tipo** Infraestrutura
**Depende de:** FND-001 · **Bloqueia:** FND-005

**Especificação técnica**
- TypeScript: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; ESLint com `@typescript-eslint` (regras *type-aware*) e plugin de segurança; Prettier; regra que **proíbe `any` implícito e `eval`/`new Function`**.
- Python: `ruff` (lint+format), `mypy --strict` nos pacotes de política (`tool-gateway`, `event-dispatcher`, `tenant-runtime/policy`), `pytest`, `pytest-asyncio`.
- Regra de arquitetura (`dependency-cruiser`/`import-linter`): `apps/web` não importa de `apps/api`; serviços só importam de `packages/contracts`; `tenant-runtime` não importa SDK do provisioner.
- Hooks locais (`lefthook` ou `husky`) para formatação e *gitleaks* nos arquivos staged; os mesmos checks repetem no CI (hook não é controle de segurança).
- Convenção de commits e de nomes de branch registrada em `documentacoes/engenharia/`.

**Critérios de aceite**
- [ ] `make lint` falha ao introduzir `any`, import proibido ou segredo sintético.
- [ ] Documento de convenções referenciado no README raiz.

**Testes.** Casos de regressão do lint (arquivo de exemplo que deve falhar) executados em CI.

---

<a id="ent-fnd-008"></a>
## ENT-FND-008 — Estrutura documental, templates de ADR e runbooks

**Sprint** S00 · **Prioridade** Média · **Tam.** S · **Risco** BAIXO · **Tipo** Documentação
**Depende de:** — · **Bloqueia:** registro de ADR-016+

**Especificação técnica**
- Criar `documentacoes/arquitetura/adr/` com `0000-template.md` (formato do roteiro: Status, Contexto, Problema, Decisão, Alternativas, Benefícios, Trade-offs, Consequências, Quando revisar) e **importar os ADR-001..015 do documento consolidado** como arquivos individuais *sem alterar o conteúdo*, preservando o documento original.
- Criar `documentacoes/seguranca/`, `documentacoes/runbooks/`, `documentacoes/engenharia/` com README.
- Template de documento de entrega conforme `CLAUDE.md` (metadados, escopo, diffs, verificações) em `documentacoes/_modelos/`.
- **Registrar a divergência de stack**: `Nucleos-Especificacao-Mestra.md` e o backlog de 2026-09-22 assumem .NET 10; o ADR de 2026-10-25 escolhe NestJS+Python. Adicionar nota de substituição (status "Substituída em parte") nesses documentos apontando o ADR vigente, sem apagar conteúdo.
- Propor atualização de `CLAUDE.md`/`AGENTS.md`/trilha `lessons/` para a stack atual (hoje voltados a C#/.NET) — **ver questão aberta Q-01 no README do backlog**; não alterar sem aprovação.

**Critérios de aceite**
- [ ] 15 ADRs importados e links verificados; template presente.
- [ ] Notas de substituição adicionadas aos dois documentos antigos.
- [ ] Questão Q-01 registrada para decisão humana.

---

<a id="ent-fnd-003"></a>
## ENT-FND-003 — Pacote de contratos com geração TS/Python

**Sprint** S01 · **Prioridade** Alta · **Tam.** M · **Risco** MÉDIO · **Tipo** Plataforma
**Depende de:** FND-001, DEC-003, DEC-004 · **Bloqueia:** IAM-001, MSG-001, TGW-001, AIG-001
**Referências:** ADR seção 14 (`packages/contracts`, `packages/sdk`).

**Objetivo.** Fonte única de verdade para contratos entre componentes (HTTP, eventos, jobs, tokens), evitando que NestJS e Python divirjam.

**Especificação técnica**
- `packages/contracts/schemas/*.schema.json` (JSON Schema 2020-12) para: `JobEnvelope`, `RuntimeToken` (claims), `ToolCallRequest/Response`, `AiCompletionRequest/Response`, `SubscriptionEvent`, `RealtimeEvent`, `TenantRuntimeSpec`, `ProblemDetails`.
- API REST do Control Plane: OpenAPI 3.1 gerado do NestJS e publicado em `packages/contracts/openapi/`; cliente TypeScript tipado em `packages/sdk` gerado do OpenAPI.
- Python: modelos Pydantic gerados dos JSON Schemas (`datamodel-code-generator`), commitados com cabeçalho "gerado — não editar" e verificação de drift no CI.
- Versionamento: `schema_version` semântico em todo envelope; regra de compatibilidade (adição de campo opcional = minor; remoção/mudança = major com período de coexistência).
- Teste de contrato: exemplos válidos e inválidos por schema, executados em TS e Python com resultado idêntico.

**Critérios de aceite**
- [ ] `make contracts` regenera artefatos; CI falha se houver diff não commitado.
- [ ] Mesmo exemplo inválido é rejeitado nas duas linguagens.
- [ ] Mudança incompatível em schema falha no teste de compatibilidade.

**Testes.** Unitários de schema (TS e Python), *round-trip* de serialização, verificação de drift.

---

<a id="ent-fnd-004"></a>
## ENT-FND-004 — Ambiente local com Docker Compose

**Sprint** S01 · **Prioridade** Alta · **Tam.** M · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** FND-001 · **Bloqueia:** IAM-002, DAT-001

**Especificação técnica**
- `infrastructure/docker/compose.dev.yml` com: PostgreSQL (imagem com `pgvector`), Redis, MinIO (S3 local), Mailpit (SMTP de teste), proxy de desenvolvimento e serviços da aplicação em modo *watch*.
- *Healthchecks* e `depends_on: condition: service_healthy`; volumes nomeados; rede interna separada da rede publicada; portas publicadas apenas em `127.0.0.1`.
- `.env.example` sem valores reais; script `make up` gera segredos descartáveis locais (arquivo não versionado).
- Perfis (`profiles`) para subir só o necessário (`core`, `runtime`, `observability`).
- Dados de seed fictícios e determinísticos, **nunca** dados reais.
- Script `infrastructure/docker/scripts/reset.sh` para destruir e recriar volumes.

**Critérios de aceite**
- [ ] `make up` deixa todos os serviços *healthy* em ≤ 3 min em máquina de desenvolvimento.
- [ ] PostgreSQL/Redis/MinIO inacessíveis de outra máquina da LAN (teste de porta).
- [ ] Nenhum segredo literal nos arquivos versionados (gitleaks verde).

**Testes.** Smoke script (`curl`/`pg_isready`/`redis-cli ping`/`mc ls`).

---

<a id="ent-fnd-005"></a>
## ENT-FND-005 — Pipeline de CI bloqueante

**Sprint** S01 · **Prioridade** Crítica · **Tam.** M · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** FND-001, FND-002 · **Bloqueia:** merges em `main`
**Hipótese H-04:** plataforma de CI = GitHub Actions (host do repositório não confirmado; ver Q-04).

**Especificação técnica**
- Jobs paralelos: `lint-ts`, `test-ts`, `lint-py`, `test-py`, `contracts-drift`, `build-images`, `security`.
- Job `security`: *gitleaks* (histórico completo), `pnpm audit`/`osv-scanner`, `pip-audit`, `trivy fs` e `trivy image`, `hadolint`, verificação de licenças proibidas.
- Serviços auxiliares do CI (PostgreSQL com `pgvector`, Redis, MinIO) para testes de integração.
- Cache de dependências; `permissions:` mínimas por job; ações de terceiros fixadas por SHA; sem segredos expostos a PRs de *forks*.
- Política: *branch protection* em `main` com checks obrigatórios e 1 revisão (2 para `CODEOWNERS` de segurança); proibido *force-push*.
- Artefatos: relatório de cobertura, SBOM (CycloneDX) por imagem, resultados SARIF.

**Critérios de aceite**
- [ ] PR com segredo sintético, dependência vulnerável sintética ou lint quebrado é bloqueado.
- [ ] Tempo do pipeline completo registrado (meta de partida ≤ 15 min, ajustável).
- [ ] Nenhuma credencial de longa duração no pipeline (preferir OIDC quando houver deploy).

**Testes.** PRs sintéticos para cada gate (executados uma vez e documentados).

---

<a id="ent-fnd-009"></a>
## ENT-FND-009 — Baseline de observabilidade nos serviços

**Sprint** S01 · **Prioridade** Alta · **Tam.** M · **Risco** MÉDIO · **Tipo** Plataforma
**Depende de:** FND-001 · **Bloqueia:** DEC-010, OBS-001, todos os serviços
**Referências:** ADR seção 10 ("Logs"), seção 3 (Telemetria).

**Especificação técnica**
- Biblioteca compartilhada (TS e Python) de **logging estruturado JSON** (`pino` no NestJS; `structlog` em Python) com campos fixos: `ts`, `level`, `service`, `version`, `env`, `trace_id`, `span_id`, `correlation_id`, `tenant_id` (quando resolvido por fonte confiável), `actor_type`, `event`.
- **Redação por allowlist**: payloads são registrados apenas por campos permitidos; chaves como `authorization`, `cookie`, `password`, `token`, `secret`, `prompt`, `content`, `api_key` sempre `[REDACTED]`; teste de propriedade com dados aleatórios.
- Correlation ID: aceita `X-Request-Id` da borda confiável, gera UUID caso ausente, propaga em HTTP, jobs e eventos (`correlation_id` no `JobEnvelope`).
- OpenTelemetry SDK (traces + métricas) com exportador OTLP configurável e *no-op* quando desabilitado.
- Padrão de `/healthz` (processo vivo) e `/readyz` (dependências críticas alcançáveis) sem expor versões internas a clientes externos.
- Métricas RED (rate, errors, duration) por rota; contadores de negócio com **cardinalidade controlada** (proibido `tenant_id` livre como label de alta cardinalidade sem decisão da DEC-010).

**Critérios de aceite**
- [ ] Requisição sintética gera log, métrica e trace correlacionáveis pelo mesmo `correlation_id`.
- [ ] Teste de redação: nenhum valor sentinela de segredo aparece na saída de log de nenhum serviço.
- [ ] Desabilitar OTLP não altera comportamento nem derruba serviço.

**Testes.** Unitários de redação (TS/Python), integração de propagação HTTP→job→log.

---

<a id="ent-fnd-006"></a>
## ENT-FND-006 — Configuração tipada e ambientes staging/produção

**Sprint** S03 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Infraestrutura
**Depende de:** FND-004, DEC-006 · **Bloqueia:** FND-007, ISO-001 (deploy), PRV-005

**Especificação técnica**
- Esquema de configuração validado na inicialização (zod no TS, Pydantic Settings em Python); **falha rápida** se variável obrigatória ausente ou inválida; tipos para URLs, durações e limites.
- Segredos **nunca** por variável de ambiente (decisão DEC-006): configuração referencia caminho de arquivo de segredo; leitura com checagem de permissões do arquivo.
- Overlays `compose.staging.yml` e `compose.prod.yml` com imagens por **digest**, `restart: unless-stopped`, limites de CPU/memória/PIDs e perfil de hardening de ISO-002.
- Matriz de ambientes: local, desenvolvimento/CI, staging (espelho reduzido da produção com dados sintéticos) e produção; staging **não** recebe dados reais.
- Procedimento de deploy documentado (puxar digest verificado → migrar controle → subir API → verificar `readyz` → rollback pelo digest anterior).

**Critérios de aceite**
- [ ] Serviço recusa subir com configuração inválida, com mensagem sem vazar valores.
- [ ] Deploy de staging e rollback exercitados e documentados.
- [ ] Nenhum overlay contém segredo literal.

**Testes.** Unitários do esquema; teste que lista `docker inspect` e falha se encontra padrão de segredo.

---

<a id="ent-fnd-007"></a>
## ENT-FND-007 — Borda: reverse proxy, TLS e cabeçalhos de segurança

**Sprint** S04 · **Prioridade** Alta · **Tam.** S · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** FND-006 · **Bloqueia:** WEB-008, GATE-004
**Referências:** ADR seção 3 (Reverse proxy: Caddy ou Traefik), 4.1.

**Especificação técnica**
- Caddy (hipótese; Traefik como alternativa registrada) como **única** porta pública (80/443); TLS automático, HSTS, TLS ≥ 1.2.
- Roteamento: `/` → web; `/api` → Control Plane; rotas `/internal/*` **nunca** expostas.
- Cabeçalhos: CSP restritiva (detalhes em WEB-008), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, remoção de `Server`.
- Limites: tamanho de corpo, *timeouts*, *rate limit* por IP na borda (complementa o limite aplicacional).
- Substituir/definir `X-Forwarded-For` e `X-Request-Id` somente na borda; aplicação confia apenas no proxy.
- Painéis administrativos (Grafana, etc.) apenas por túnel/VPN, nunca na borda pública.

**Critérios de aceite**
- [ ] Varredura de portas externas mostra apenas 80/443 (e SSH conforme ISO-001).
- [ ] Teste de cabeçalhos (ex.: scanner de configuração) sem achados altos.
- [ ] `/internal/*` retorna 404 externamente.

**Testes.** Script de verificação de portas e cabeçalhos no CI de staging.
