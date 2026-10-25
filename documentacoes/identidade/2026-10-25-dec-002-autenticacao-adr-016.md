# DEC-002 — Autenticação de usuários (ADR-016) — 2026-10-25

- **Domínio:** identidade · **Tarefa:** ENT-DEC-002 (lote 2026-10-25-ep00-ep01-fundacao) · **Branch:** `tarefa/dec-002` · **Base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, árvore limpa · **Estado:** pronta para decisão humana (ADR **Proposto**) · **Autores:** Claude Sonnet 5.5 (executor), a pedido de vinicius Silva.

## Objetivo, contexto, escopo
Decidir como usuários se autenticam preservando tenant resolvido no servidor por membership. Escopo: ADR-016, PoC descartável de login + sessão + revogação, medição de RAM. Fora do escopo: código de produção (`packages/`), e-mail transacional, WebAuthn, PoC das opções 4 e 5, aceite do ADR (só o usuário).

## Resumo
Opção líder proposta: autenticação própria (argon2id + TOTP + sessão opaca em PostgreSQL). PoC: 13/13 verificações PASS, incluindo a sessão revogada falhando na requisição seguinte (logout 13,9 ms; rejeição seguinte 15,6 ms; revoke-all; revogação sob carga com 0 requisições aceitas após o UPDATE). RAM medida: Node 91,8 MiB RSS, Postgres 40,3 MiB, Keycloak 26.0 dev 520,6 MiB, Kratos v1.3.1 34,4 MiB. Hash de senha, seed MFA e migração de opção estão declarados no ADR.

## Mudanças por arquivo
- `documentacoes/arquitetura/adr/0016-autenticacao-de-usuarios-sessao-opaca-propria-vs-idp.md` (novo) e linha em `adr/README.md`.
- `documentacoes/arquitetura/poc/dec-002/`: `server.mjs` (servidor), `poc.mjs` (roteiro medido), `schema.sql`, `run.sh` (Postgres descartável, executa e destrói), `medir-ram-idp.sh`, `kratos.yml`, `kratos-identity.schema.json`, `package.json` + `package-lock.json`, `saida-poc.txt`, `saida-ram-idp.txt`. Fora do workspace pnpm (`apps/*`, `packages/*`); nada em `packages/`.
- `lessons/00 - Sessao opaca e revogacao.md` (nova) e índice em `lessons/README.md`.
- Dependências do PoC (lock npm, registradas): `pg@8.23.1`, `@node-rs/argon2@2.2.2` (consultadas no registro npm em 2026-10-25). TOTP e cifra usam `node:crypto`, sem dependência extra.

## Decisões técnicas
TOTP implementado com `node:crypto` para evitar dependência; PoC usa npm por ser isolado do workspace pnpm (consequência: não participa de `make lint/test`). Alternativas e trade-offs no ADR. Achado: Keycloak em repouso mediu ~521 MiB (dev, H2, sem carga), abaixo da estimativa de ~1 GiB; a documentação oficial recomenda 1250 MB de base em produção.

## Validações reais
- `./run.sh` (Node 24.22.1, Docker 29.8.1, `postgres:16-alpine` em `127.0.0.1:55432`): `RESULTADO 13/13 PASS` ([saída](../arquitetura/poc/dec-002/saida-poc.txt)).
- `./medir-ram-idp.sh`: ver [saída](../arquitetura/poc/dec-002/saida-ram-idp.txt).
- Exemplo da lesson executado com `node` 24.22.1: imprime `u1` e `null`.
- Containers `poc-dec002-*` destruídos (confirmado: `docker ps -a --filter name=poc-dec002` vazio). Outros containers do host não foram tocados.
- `make lint/test/build`: NA, a entrega não altera workspace de produção. Hooks/CI não existem.
- Fatos de produtos (Ory, Keycloak, Clerk) com fonte e data no ADR; células sem medição ou fonte estão marcadas "[inferência]".

## Impactos, riscos, rollback
Sem impacto em produção. Risco: PoC local não cobre rate limit, CSRF, cookies, recuperação de senha. Rollback: reverter o commit.

## Commit e diffs
Commit único local em `tarefa/dec-002` (SHA informado ao coordenador na resposta; um commit não pode conter o próprio SHA). Diff dos arquivos de código/configuração do PoC em [diffs](2026-10-25-dec-002-autenticacao-adr-016-diffs.md). Os arquivos em `documentacoes/` e `lessons/` listados acima foram excluídos do patch por regra.

## Lessons
[00 - Sessão opaca e revogação](../../lessons/00%20-%20Sessao%20opaca%20e%20revogacao.md); índice [lessons/README.md](../../lessons/README.md).

## Pendências
Decisão humana: aceite do ADR-016, pesos dos critérios, WebAuthn no MVP. Células "[inferência]" não medidas para as opções 2–5 (exceto RAM de Keycloak/Kratos).
