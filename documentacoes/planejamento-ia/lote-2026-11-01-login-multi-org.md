---
contexto:
  schema_version: 1
  project_root: "C:\\Users\\vinicius.silva\\Documents\\Documentos\\Projetos Dev\\nucleos"
  workflow: "lote-2026-11-01-login-multi-org.workflow.yaml"
  bindings: "lote-2026-11-01-login-multi-org.bindings.yaml"
  status: ready
  isolation: worktree
---

# Lote 2026-11-01 — Login multi-organização (API + web) no banco único

Fluxo enxuto: ao executar run, você autoriza implementação, checks, revisão corretiva e commits/branch locais previstos. Sem checkpoints humanos intermediários; testes de tela serão manuais ao final. Não autoriza push, PR nem merge em main/master.

> **Lote:** `lote-2026-11-01-login-multi-org` · **Data/fuso:** 2026-11-01, America/Sao_Paulo · **Perfil:** enxuto-v1 · **Publicação:** manual (sem push/PR/deploy).
> **Demanda:** sistema de login (back-end NestJS + front-end Next.js) com multi-organização, sobre o banco único do Nucleos. Não possui ID externo vinculado (ClickUp não usado); chave local `LGN-MULTI-ORG`.
> **Substitui:** `lote-2026-10-31-web-001-login-real` (obsoleto: previa banco separado `nucleos_control` e Kysely, ambos contrários à regra de banco único de 2026-11-01 e ao padrão `pg` puro já adotado). O run `31d6724286f0e3bb0542b6818c7971d0` daquele lote fica abandonado e preservado; seu código serve apenas de consulta.
> **Contexto para decisões de produto:** `planning-context.json` ao lado deste manifesto.

## 1. Decisões e origem

| # | Decisão | Origem |
| --- | --- | --- |
| D1 | Modelo **multi-organização**: usuários, organizações e memberships; seletor `/orgs`; organização ativa visível no layout. | Usuário, grill-me 2026-11-01 |
| D2 | Partir **do zero** sobre `developer`; o run antigo é só referência e não é apagado. | Usuário |
| D3 | **Toda a área logada exige sessão**; a API de vendas passa a aceitar a sessão do usuário. | Usuário |
| D4 | Usuários criados por **seed de desenvolvimento idempotente** (senha via variável de ambiente/arquivo) **e por comando CLI administrativo** (criar organização, criar usuário, adicionar membership, desativar usuário, trocar senha; senha lida da entrada padrão). Cadastro público, MFA, verificação de e-mail e recuperação de senha ficam **fora**. | Usuário (repete D1 do lote anterior) |
| D5 | Painel de vendas pertence a uma **organização fixa** (slug configurável `VENDAS_ORG_SLUG`, padrão `nucleos`); só membros dela o veem; demais recebem 404. Sem coluna nova em `financeiro.vendas`. | Usuário |
| D6 | Rotas do web com **prefixo `/orgs/[orgSlug]/…`**; o slug é contexto solicitado e é validado pela API a cada página. | Usuário |
| D7 | **Remover a chave de serviço** `VENDAS_API_KEY`: sai o `ChaveServicoGuard`, o web deixa de ler a chave; o agendador interno da API não depende dela. | Usuário |
| D8 | Parâmetros: sessão ociosa 30 min, absoluta 12 h; 5 falhas → bloqueio 15 min; senha ≥ 12; argon2id m=19 MiB, t=2, p=1; todos configuráveis por env. | Usuário confirmou os padrões |
| D9 | **Nenhuma dependência nova**: argon2id via `node:crypto` (`crypto.argon2`, Node 24.22), validação manual no padrão de `vendas.controller.ts`, cabeçalhos de segurança definidos à mão, SQL com `pg` puro. Se `crypto.argon2` não for utilizável, a unidade fica BLOCKED em vez de instalar pacote. | Usuário |
| D10 | Banco **único** `nucleos_dev` com schemas `iam` e `tenancy`, migrations forward-only no runner existente (`apps/api/src/migrar.ts`), sem papéis Postgres novos. | Regra permanente do `CLAUDE.md` e `documentacoes/dados/banco-unico-nucleos.md` |
| D11 | Sessão opaca própria: 32 bytes aleatórios, só `sha256(token)` no banco; cookie `HttpOnly; SameSite=Lax; Path=/` e `Secure` obrigatório fora de `local`. | ADR-016 (aceito) |
| D12 | O web chama a API servidor-a-servidor; o cookie de sessão pertence à origem do web e o servidor Next repassa o token à API. A limitação de taxa é por e-mail (memória) mais bloqueio por conta (banco); limitação por IP do cliente fica fora, porque a API só vê o IP do servidor web. | Inferido pelo planejador a partir da arquitetura existente (`apps/web/lib/vendas-api.ts`) |

## 2. Escopo

Dentro: `apps/api` (pipeline HTTP, iam, tenancy, auth, sessão, CLI admin, troca da proteção de vendas), migration `0002`, seed dev, alvo `make test-integracao` com Postgres efêmero, `packages/config` (parâmetros de sessão/login, remoção de `VENDAS_API_KEY`), `packages/contracts` (OpenAPI de auth/orgs), `apps/web` (login, logout, `/orgs`, área sob `/orgs/[orgSlug]`, proteção de rotas), `.env.example`, documentação em `documentacoes/identidade/` e `documentacoes/dados/banco-unico-nucleos.md`, lessons e `lessons/README.md`.

Fora: MFA, verificação de e-mail, recuperação de senha, cadastro público, tela de administração de usuários, papéis/permissões aplicados (IAM-005), auditoria `audit.events`, coluna `organization_id` em vendas, banco/container novo, SSO/IdP, Playwright/E2E de navegador, deploy.

## 3. Unidades (sequenciais, uma worktree; DAG `u1 → u2 → u3 → review_fix`)

- **u1 — LGN-U1 (R3):** pipeline da API, schemas `iam`/`tenancy`, seed, CLI admin, alvo de integração. Critérios LGN-AC-01..05.
- **u2 — LGN-U2 (R4):** login/logout/sessão/lockout, `/v1/me`, `/v1/orgs`, contexto da org, vendas sob sessão e membership, contrato OpenAPI. Critérios LGN-AC-06..12.
- **u3 — LGN-U3 (R3):** web com login real, `/orgs`, área sob `/orgs/[orgSlug]`, logout, estados e remoção do mock/chave. Critérios LGN-AC-13..19.

Os critérios completos estão nos briefs de cada unidade (bindings).

## 4. Critérios (resumo por ID)

- LGN-AC-01 Problem Details (RFC 9457) sem eco/stack + `correlation_id`; campo extra → 400.
- LGN-AC-02 Migration `0002` aplica do zero e reaplica sem efeito; `tenancy.organizations.id` imutável.
- LGN-AC-03 Seed idempotente sem senha/hash versionado.
- LGN-AC-04 CLI admin cria org/usuário/membership, desativa e troca senha lendo a senha da entrada padrão.
- LGN-AC-05 `make test-integracao` sobe Postgres efêmero em 127.0.0.1 e o destrói ao final.
- LGN-AC-06 Cookie/sessão seguros; banco guarda só `sha256`; erro de login indistinguível.
- LGN-AC-07 Bloqueio após 5 falhas, inclusive com a senha correta; contador zera no sucesso.
- LGN-AC-08 Logout, revogação, expiração ociosa/absoluta → 401.
- LGN-AC-09 Isolamento: org sem membership → 404 idêntico a slug inexistente; `tenant_id` no corpo rejeitado.
- LGN-AC-10 Vendas só sob sessão e membership da org de vendas; `VENDAS_API_KEY` removida.
- LGN-AC-11 Contrato OpenAPI e tipos gerados sem drift.
- LGN-AC-12 Nenhum log contém senha, token ou cookie.
- LGN-AC-13..19 Web: login real, `/orgs`, 404 de outra org, nenhum token em storage, logout/sessão revogada → `/login`, estados padronizados, nenhum mock de auth e nenhuma chave de serviço restantes.

## 5. Base, branch e recursos

- Repositório único `nucleos`. **Base:** `developer` @ `c5427047db13c8bb84e3a635298e94e89105caea` (inclui painel de vendas, banco único e fluxo enxuto, commitados em 2026-11-01 com autorização do usuário). Árvore limpa no momento do planejamento.
- Entrega: branch local `revisao/2026-11-01-login-multi-org`, criada pelo helper determinístico.
- Ambiente: Node 24.22.1, pnpm via corepack (`make setup` primeiro na worktree nova), `uv`, Docker.
- **Proteção de dados:** só containers descartáveis em 127.0.0.1, sem dados reais, destruídos ao final (alvo `make test-integracao`). Nenhum teste toca `nucleos_dev` nem outro serviço. Segredos nunca em código, saída ou documentação.
- Validação real: `make build lint test contracts-check` e `make test-integracao`.

## 6. Riscos

Crítico em u2 (autenticação e isolamento de tenant). `crypto.argon2` é recente no Node 24 (se falhar, BLOCKED; não instalar pacote). Next 16 mudou convenções (por exemplo `middleware` → `proxy`); o implementador deve ler `node_modules/next/dist/docs/`. Testes de integração dependem do Docker local. Sem E2E de navegador, as telas são validadas pelo roteiro manual.

## 7. Autorização

Ao executar `context run` com este manifesto, o usuário autoriza criar a worktree do runtime, implementar u1..u3, rodar checks com Postgres efêmero, uma revisão corretiva, escrever documentação/lessons e criar commits locais com branch `revisao/2026-11-01-login-multi-org`. Não autoriza push, PR, deploy, publicação, merge em `main`/`master`, nem dependências novas.

## 8. Testes manuais de tela

O roteiro está no fim do run, em `documentacoes/entregas-ia/testes-manuais.md` (PENDENTE_DE_TESTES_MANUAIS_DE_TELA). DONE técnico não é aceite visual.
