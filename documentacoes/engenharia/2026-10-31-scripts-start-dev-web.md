# Scripts `start` e `dev` na raiz para o front (2026-10-31)

- **Dominio:** engenharia
- **Solicitacao:** "quero um comando npm start" para subir o front localmente no Windows.
- **Branch / base:** `main`, HEAD `54a9aa7`, arvore limpa no inicio.
- **Estado:** implementado, sem commit (nenhum commit criado nesta tarefa).

## Objetivo e contexto

`pnpm --filter @nucleos/web start` falha no Windows: o script de `apps/web` usa `${PORT:-3000}`, sintaxe
POSIX que o shell do pnpm no Windows nao expande (`argument '${PORT:-3000}' is invalid`). O
`scripts/local.sh up` tambem nao funciona no Git Bash (depende de `setsid`).

Escopo: atalhos na raiz para o front. Fora do escopo: alterar `apps/web/package.json`, `local.sh`, Compose.

## Mudancas por arquivo

- `package.json` (raiz): novos scripts
  - `start`: `pnpm --filter @nucleos/web exec next start -H 127.0.0.1 -p 3000` (serve o build; exige `pnpm build` antes)
  - `dev`: `pnpm --filter @nucleos/web exec next dev -H 127.0.0.1 -p 3000` (hot reload)

## Atualizacao: correcao do script em `apps/web`

Rodando `npm start` dentro de `apps/web`, o script antigo ainda falhava. Foi corrigido tambem:
`apps/web/package.json` `start`: `next start -H ${HOST:-127.0.0.1} -p ${PORT:-3000}` -> `next start -H 127.0.0.1`.
O Next ja le `PORT` do ambiente (padrao 3000; verificado: `PORT=3055` subiu na 3055), entao `scripts/local.sh`
(que exporta `PORT`) segue funcionando. A variavel `HOST` deixa de ser lida; `local.sh` sempre usa `127.0.0.1`.

## Decisoes

Host e porta fixos (`127.0.0.1:3000`), sem expansao de variavel, para funcionar em qualquer shell. Quem precisar
de outra porta usa `pnpm --filter @nucleos/web exec next start -p <porta>`. O script de `apps/web` tambem foi
corrigido (ver acima) para funcionar em qualquer pasta.

## Validacao

- `pnpm start` (Node 24.22.2, pnpm 12.15.0): `Next.js 16.4.3 ... Ready in 322ms`, `GET http://127.0.0.1:3000/` -> 200. Processo encerrado depois.
- `pnpm dev`: nao executado.
- Lint/testes completos: nao executados (so scripts de atalho; `package.json` nao esta nos globs do Prettier).

## Impactos e rollback

Sem impacto em CI, build ou dependencias. Rollback: remover as duas linhas.

## Diff (staged/unstaged)

```diff
--- a/package.json
+++ b/package.json
@@ scripts
+    "start": "pnpm --filter @nucleos/web exec next start -H 127.0.0.1 -p 3000",
+    "dev": "pnpm --filter @nucleos/web exec next dev -H 127.0.0.1 -p 3000",
     "build": "turbo run build",
```

## Lessons

Nao criada: a entrega nao introduz nem exercita conceito novo de TypeScript, Python, Docker, PostgreSQL ou
seguranca (apenas atalhos de script).

## Pendencias

Nenhuma conhecida. `pnpm dev` nao foi testado.
