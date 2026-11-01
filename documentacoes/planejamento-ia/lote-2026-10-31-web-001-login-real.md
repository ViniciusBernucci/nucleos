---
contexto:
  schema_version: 1
  project_root: "C:\\Users\\vinicius.silva\\Documents\\Documentos\\Projetos Dev\\nucleos"
  workflow: "lote-2026-10-31-web-001-login-real.workflow.yaml"
  bindings: "lote-2026-10-31-web-001-login-real.bindings.yaml"
  status: ready
  isolation: worktree
---

# Lote 2026-10-31 — ENT-WEB-001 com login real no banco (shell, login e multi-organização)

> **Lote:** `lote-2026-10-31-web-001-login-real` · **Fuso:** America/Sao_Paulo · **Publicação:** manual (sem push/PR/deploy).
> **Demanda:** ENT-WEB-001 (Shell, login e multi-organização) com **login real contra o banco**, sem mock. Não possui ID externo vinculado (ClickUp não usado); chave local `WEB-001-REAL`.
> **Fonte canônica:** `documentacoes/backlog/EP-10-interface-web-e-predio-3d/tickets.md#ent-web-001`; dependências reais em `documentacoes/backlog/EP-02-control-plane-identidade-e-autorizacao/tickets.md` (IAM-001..004); ADR-016 e ADR-017.

## 1. Decisões e origem

| # | Decisão | Origem |
| --- | --- | --- |
| D1 | Fatia vertical mínima de identidade: IAM-001 (API), IAM-002 (banco de controle), IAM-003 parcial (login/logout, senha argon2id, bloqueio por força bruta) e IAM-004 (sessão + membership). **MFA TOTP, verificação de e-mail, recuperação de senha e cadastro público ficam FORA** e continuam abertos nos tickets canônicos. | Resposta do usuário nesta sessão |
| D2 | Mocks: trocar **somente** login, logout e seletor de organizações pela API real; as demais telas mockadas (EP-10 sem 3D) permanecem com fixtures, mas atrás da sessão real. | Resposta do usuário |
| D3 | Dados iniciais por seed de desenvolvimento idempotente (migration/script) em Postgres descartável do compose, sem dados reais; senha dos usuários de teste vem de variável de ambiente, nunca do repositório. | Resposta do usuário |
| D4 | Parâmetros dos ADRs aceitos: sessão opaca própria (32 bytes aleatórios, só `sha256` no banco), `argon2id` (m=19 MiB, t=2, p=1), cookie `HttpOnly; Secure; SameSite=Lax`, senha ≥ 12, SQL puro forward-only com runner TS e query builder Kysely (primeira opção do ADR-017, ainda "não exercitada"), PK `uuid` gerado na aplicação, `timestamptz`. | ADR-016/017 aceitos em 2026-10-26; usuário confirmou usá-los |
| D5 | Dependências novas autorizadas por este manifesto, em versão exata com `pnpm-lock.yaml` atualizado e justificativa na documentação: `kysely`, `pg` (+`@types/pg`), `argon2`, `helmet`, `class-validator` e `class-transformer` (ValidationPipe). Biblioteca de UI/estado e Playwright **não** estão autorizados sem nova decisão (ver AC-14). | Inferido do ADR-017/IAM-001; revisão do usuário ao autorizar a execução |

Hipóteses abertas: TTL de sessão (idle 30 min / absoluto 12 h, configuráveis) e limites de tentativa (5 falhas → bloqueio 15 min) são padrões propostos, não confirmados pelo usuário.

## 2. Escopo

Dentro: `apps/api`, `packages/contracts` (contrato OpenAPI de auth), migrations e seed do banco `nucleos_control`, `apps/web` (login, logout, `/orgs`, `/orgs/[orgSlug]`, layout com organização ativa, estados padronizados), documentação e lessons exigidas pelo `CLAUDE.md`.

Fora: MFA, verify-email, forgot-password, cadastro, papéis/permissões aplicados (IAM-005), auditoria `audit.events` (IAM-008), entitlements de módulos, provisionamento de tenant, banco de tenant, prédio 3D, SSO, i18n além de strings pt-BR centralizadas, deploy e infraestrutura de staging/produção.

## 3. Tarefas (ordem estrita; DAG sem ciclos)

`T1 → T2 → T3` (sequencial, uma worktree, concorrência 1).

### T1 — LOC-WEB-001-A: API NestJS e banco de controle (perfil **R3 / padrão-alto**)

Justificativa: introduz banco, esquema e pipeline de segurança da API; sem autenticação ainda. Gates: implementação, checks, review independente, auditoria, QA independente.

Comportamento e contratos:
- `apps/api`: prefixo `/v1`; `ValidationPipe` (whitelist, `forbidNonWhitelisted`, transformação explícita); filtro global devolvendo **Problem Details (RFC 9457)** sem stack/mensagem interna e com `correlation_id`; `helmet`; CORS por allowlist vinda de config; módulos `iam` e `tenancy` com limites de importação respeitando o lint de arquitetura (FND-002). Configuração via `@nucleos/config`, sem segredo no código.
- Banco `nucleos_control` com esquemas `iam` e `tenancy`: `iam.users` (id, email citext único, email_verified_at, password_hash, status `active|locked|disabled`, failed_logins, locked_until), `iam.sessions` (id, user_id, token_hash único, created_at, last_seen_at, expires_at, revoked_at, ip_hash, user_agent; índice `(user_id, revoked_at)`), `iam.roles`/`iam.permissions`/`iam.role_permissions` (catálogo mínimo + seed idempotente), `tenancy.organizations` (id = tenant_id imutável por trigger, slug único, name, status), `tenancy.memberships` (UNIQUE(organization_id, user_id), índice `(user_id)`). Migrations em `.sql` forward-only com o runner do ADR-017 (advisory lock, checksum, uma transação por migration, lint de transação). Papéis `control_owner`, `control_migrator`, `control_app` sem `SUPERUSER`/`BYPASSRLS`.
- Seed de desenvolvimento: usuários fictícios `usuario-a` (membro de `org-a`), `usuario-b` (membro de `org-b`) e `usuario-ab` (membro de ambas), senhas lidas de variável de ambiente (hash gerado em tempo de seed).
- Diagrama ER em `documentacoes/banco/modelo-dados-controle.md`.

Critérios:
- **LGN-AC-01** Corpo com campo extra → 400 Problem Details sem eco do campo; erro interno → 500 genérico com `correlation_id`, detalhes só em log; rota `/v1/health` responde.
- **LGN-AC-02** Migrations aplicam do zero em banco descartável e são idempotentes na reexecução; `UPDATE tenancy.organizations SET id=...` é rejeitado por trigger; `control_app` não consegue `CREATE TABLE`/`DROP` (testes de integração com PostgreSQL real).
- **LGN-AC-03** Seed idempotente cria as duas organizações e três usuários sem nenhuma senha, hash ou segredo versionado; nenhuma tabela contém conteúdo privado de tenant.

### T2 — LOC-WEB-001-B: autenticação, sessão e membership (perfil **R4 / crítico**)

Justificativa: autenticação, sessão e isolamento de tenant (SEC-01/SEC-07). Gates: todos, incluindo QA independente obrigatório.

Comportamento e contratos:
- `POST /v1/auth/login` (e-mail + senha): verifica `argon2id` (com rehash se parâmetros mudarem), resposta **idêntica** para usuário inexistente e senha errada (sem enumeração; custo equalizado), cria sessão opaca de 32 bytes aleatórios, grava apenas `sha256(token)`, e emite cookie `HttpOnly; Secure; SameSite=Lax; Path=/` (em desenvolvimento HTTP local o atributo `Secure` é desligado somente por flag explícita de config, com teste cobrindo o valor de produção).
- Proteção contra força bruta: `failed_logins`/`locked_until` e limite de taxa por IP+e-mail; usuário `locked`/`disabled` não autentica; mensagem genérica.
- `POST /v1/auth/logout` revoga a sessão (`revoked_at`) e limpa o cookie; `SessionGuard` carrega a sessão por hash a cada requisição, rejeita expirada/revogada (401), aplica idle timeout e absolute timeout configuráveis e limita escrita de `last_seen_at`.
- `GET /v1/me`, `GET /v1/orgs` (somente memberships ativas do usuário) e `GET /v1/orgs/:slug/context`: o slug é **contexto solicitado**; o tenant é derivado de membership válida; sem membership → **404** idêntico ao de slug inexistente, sem dados da outra organização. Nunca aceitar `tenant_id` do corpo.
- Contrato OpenAPI/JSON Schema em `packages/contracts`, tipos gerados (`make contracts-gen`; `make contracts-check` sem drift).
- Logs estruturados sem senha, token ou cookie.

Critérios:
- **LGN-AC-04** Login válido emite cookie com `HttpOnly`, `SameSite=Lax` (e `Secure` na configuração de produção); o banco guarda só `sha256` do token; credencial inválida e usuário inexistente retornam resposta e status indistinguíveis.
- **LGN-AC-05** Após N falhas consecutivas a conta fica bloqueada até `locked_until`, inclusive com a senha correta; contador zera no sucesso.
- **LGN-AC-06** Logout ou revogação direta no banco faz a requisição seguinte retornar 401; sessão expirada por idle/absoluto retorna 401.
- **LGN-AC-07** Com sessão de A, `GET /v1/orgs/org-b/context` retorna 404 sem qualquer dado de B; `GET /v1/orgs` lista só as organizações do usuário; corpo com `tenant_id` é rejeitado.

### T3 — LOC-WEB-001-C: shell Next.js com login real e multi-organização (perfil **R3 / padrão-alto**)

Justificativa: fluxo de autenticação no cliente e isolamento visual de tenant, sem lógica de segurança própria (o backend é a fonte da verdade). Gates: implementação, checks, review, auditoria e QA independente.

Comportamento e contratos:
- `/login` chama a API real por Server Action/Route Handler; o cookie `HttpOnly` é repassado entre servidor Next e API; **nenhum token em `localStorage`/`sessionStorage`**; erro de credencial exibe mensagem genérica.
- Logout encerra a sessão na API; sessão revogada/expirada redireciona a `/login`. `middleware` apenas para UX (redirecionamento), sem decidir segurança.
- `/orgs` lista as organizações reais do usuário (Server Component); `/orgs/[orgSlug]/...` valida via API e mostra 404 para organização sem membership.
- Layout base com navegação, **indicador persistente da organização ativa** e textos pt-BR centralizados; estados padronizados: carregando, vazio, erro, proibido (403), não encontrado (404), offline.
- Remover as fixtures/telas mock de login, logout e seletor de organizações; as demais superfícies mock (EP-10 sem 3D) continuam funcionando atrás da sessão real e marcadas como demonstração.
- Documentar a escolha (ou não) de biblioteca de UI/estado: padrão é **não adicionar** dependência de UI/estado.

Critérios:
- **LGN-AC-08** Login com `usuario-a` leva a `/orgs` com apenas `org-a`; `usuario-ab` vê as duas e a org ativa fica indicada no layout.
- **LGN-AC-09** Acessar `/orgs/org-b` com sessão de `usuario-a` mostra 404 sem dados de B (teste contra API e banco reais).
- **LGN-AC-10** Teste automatizado prova que nenhum token é gravado em `localStorage`/`sessionStorage` e que o cookie não é legível por JavaScript.
- **LGN-AC-11** Logout e sessão revogada no banco redirecionam a `/login`; telas protegidas não renderizam dados sem sessão.
- **LGN-AC-12** Estados carregando/vazio/erro/403/404/offline existem e têm teste de componente.
- **LGN-AC-13** Nenhum import de `mock-security`/fixtures de auth permanece no fluxo de login/orgs; `make lint`, `make test`, `make build` e `make contracts-check` passam.
- **LGN-AC-14** E2E de navegador (Playwright + axe) exigido pela especificação canônica **depende de nova aprovação de dependência**. Sem ela, a cobertura é testes de integração HTTP contra a API real (cookies, 404, redirecionamentos) + Testing-Library/`node:test` já disponíveis; o Playwright permanece como pendência registrada, não como critério satisfeito.

## 4. Mapeamento step → ticket/critério

| Step | Ticket | Critérios |
| --- | --- | --- |
| `setup`, `db_up` | todos | preparação da worktree e do Postgres descartável |
| `t1_implement`, `t1_checks`, `t1_review`, `t1_audit`, `t1_qa` | T1 | LGN-AC-01..03 |
| `t2_implement`, `t2_checks`, `t2_review`, `t2_audit`, `t2_qa` | T2 | LGN-AC-04..07 |
| `t3_implement`, `t3_checks`, `t3_review`, `t3_audit`, `t3_qa` | T3 | LGN-AC-08..14 |
| `finalize` | todos | documentação em `documentacoes/identidade/`, lessons aplicáveis, `lessons/README.md`, diffs e commits locais |

Implementar e revisar usam executores diferentes (claude implementa/audita; codex revisa/faz QA). Correções pedidas pela auditoria são feitas na rodada de implementação seguinte e exigem novo `checks`; o workflow atual não tem ciclo de correção: achado ACEITO pela auditoria bloqueia o step e pede alteração explícita do workflow.

## 5. Base, branches e recursos

- Repositório único `nucleos`, raiz do projeto, camada `monorepo`. **Base:** `main` @ `54a9aa78812e7772493b9fa5721a2e0a268bfb33` (inclui o lote `frontend-mockado` já integrado). Branch de revisão: `revisao/2026-10-31-web-001-login-real`; branch de tarefa/worktree: `tarefa/web-001-login-real` em `../nucleos-worktrees/`.
- A árvore de trabalho atual tem **mudanças não commitadas** alheias a este lote (sincronização das skills, `package.json` e `apps/web/package.json` dos scripts `start`/`dev`). A worktree nasce do commit da base e não as inclui; o runtime lê as skills por caminho absoluto do checkout principal. Commite ou descarte essas mudanças antes de executar se elas precisarem estar na base.
- Ambiente: Node 24.22.1 (`.nvmrc`), `pnpm` via corepack (`make setup`), `uv`, Docker. Em uma worktree nova `make setup` roda primeiro (node_modules não existem).
- **Banco/serviços (proteção de dados):** só o Postgres do `compose.dev` (profile `core`), container descartável publicado em `127.0.0.1`, sem dados reais e sem VPS, conforme o `CLAUDE.md`. Testes criam bancos temporários próprios e os removem; nenhum teste ou script acessa outro banco ou serviço. Segredos vêm de `scripts/gerar-segredos.sh` (arquivos ignorados pelo Git) e nunca entram em código, saída ou documentação.
- Validação real (raiz): `make lint`, `make test`, `make build`, `make contracts-check`.

## 6. Riscos

Risco crítico em T2 (autenticação e isolamento de tenant); drift de contrato entre API e web; testes de integração dependem do Docker local; Kysely não foi exercitado em PoC (pode exigir ajuste e registro no ADR-017); seed com senhas só por variável de ambiente exige documentar o procedimento no runbook local; sem Playwright a cobertura de navegador fica parcial.

## 7. Autorização

Este manifesto autoriza, ao ser executado com `contexto run`, criar a worktree, implementar T1..T3, rodar checks com o Postgres descartável, revisar, auditar, executar QA, escrever documentação/lessons e criar **commits locais** na branch de tarefa e em `revisao/`. Não autoriza push, PR, deploy, publicação, commits em `main`/`master` nem dependências além das listadas em D5.

## 8. Definição de pronto da entrega

Cada ticket atualiza `documentacoes/identidade/` (e `documentacoes/banco/` quando houver migration), registra comandos reais, commits e diffs, cria ou atualiza as lessons aplicáveis (TypeScript, PostgreSQL, segurança) e `lessons/README.md`, e reconfere os documentos no final, conforme o `CLAUDE.md` do projeto.
