# Reinicio do front end: limpeza de menus, paginas, dashboard e mocks

Data: 2026-11-01

- Dominio: interface-web
- Solicitacao: criar a branch `developer`, escrever um manual de front end e limpar o
  sistema (menus, paginas, dashboard e dados mockados) para recomecar do zero.
- Branch: `developer` (criada a partir de `main` em `083ead0`). HEAD inicial: `083ead0`.
- Estado: implementado na arvore de trabalho; nenhum commit criado nesta tarefa.
- Autores conhecidos: Vinicius (solicitante) e Claude Code.

## Objetivo, contexto e escopo

Remover toda a interface de demonstracao (LOC-WEB-001 e tema v6) e fixar as regras para as
paginas novas. Dentro do escopo: remocao de paginas, menu lateral, dashboard e dados
mockados; manual de front end; CSS reduzido a tokens e primitivas. Fora do escopo: criar
qualquer pagina nova, definir menu, autenticacao, backend.

## Resumo

- Criada a branch `developer`.
- Escrito [manual-frontend.md](manual-frontend.md), a ser seguido em toda pagina nova.
- Removidos 8 componentes de painel, as rotas `/login`, `/orgs` e `/platform`, 5 arquivos
  `lib/mock-*.ts` e `app/dashboard-mock.test.ts`.
- `/` virou uma pagina vazia com estado "Nenhuma pagina criada ainda".
- `globals.css` manteve tokens de tema e passou a trazer so primitivas (`.page`,
  `.page-header`, `.panel-card`, `.state-box`, `.btn*`, `.badge*`, `.theme-toggle`,
  `.code-preview`, `.skip-link`).
- `layout.tsx` ganhou o `skip-link` apontando para `#conteudo` e titulo generico.
- Mantidos: tema claro/escuro (`lib/theme.ts`, `ThemeToggle.tsx`, `theme.test.ts`) e
  `/healthz`.

## Mudancas por arquivo

| Arquivo | Mudanca |
| --- | --- |
| `apps/web/app/page.tsx` | Substituido pelo estado vazio |
| `apps/web/app/layout.tsx` | Titulo generico e skip-link |
| `apps/web/app/globals.css` | De 821 para cerca de 300 linhas: tokens, base e primitivas |
| `apps/web/app/login/`, `orgs/`, `platform/` | Removidos |
| `apps/web/app/components/*Panel*.tsx`, `BuildingFloorMap.tsx`, `DashboardClientShell.tsx` | Removidos (8 arquivos) |
| `apps/web/lib/mock-{enterprise-data,fixtures,security,selectors,types}.ts` | Removidos |
| `apps/web/app/dashboard-mock.test.ts` | Removido junto com o codigo que testava |
| `documentacoes/interface-web/manual-frontend.md` | Criado |
| `lessons/14 - ...`, `lessons/README.md` | Nota de que o codigo mockado foi removido |

Sem mudanca de configuracao, dependencia ou migracao.

## Decisoes

- **Manter o tema e os tokens:** o design "Pinho" e o claro/escuro continuam sendo a base
  visual; recomecar nao exige redescobrir cores.
- **Sem menu por enquanto:** o menu sera definido com a primeira pagina real.
- **Lesson 14 preservada com nota:** o conceito de estados de tela segue util; so os
  arquivos citados deixaram de existir. A lesson 15 (temas) segue valida.
- **Lessons novas:** nao criadas; a entrega remove codigo e nao introduz conceito novo alem
  do ja coberto pelas lessons 14 e 15.
- Documentos historicos de LOC-WEB-001 e tema v6 foram mantidos como registro.

## Validacoes

Executadas com `corepack pnpm --filter @nucleos/web ...` (Node v24.22.2):

- `build`: sucesso; rotas `/`, `/_not-found` e `/healthz`.
- `test`: 4 testes (tema), 4 aprovados, 0 falhas.
- `lint` (`tsc --noEmit`): sucesso, depois do `build`. Antes do build falhou por tipos
  obsoletos em `.next/types` que apontavam para as paginas removidas (cache, ja regenerado).
- Nao executados: `make lint` completo (ESLint type-aware, gitleaks), `make test`, verificacao
  visual manual nos dois temas.

## Impactos e rollback

- Impacto: `/login`, `/orgs` e `/platform` deixam de existir (retornam 404). Nada fora de
  `apps/web` dependia delas, segundo busca por `mock` e `dashboard` no workspace.
- Rollback: `git checkout main -- apps/web` restaura a interface anterior.

## Commits e diffs

Nenhum commit criado nesta tarefa. Diff completo: `git diff HEAD -- apps lessons`
(20 arquivos em `apps`, 96 insercoes e 4848 remocoes). Os arquivos removidos estao
listados acima e recuperaveis de `083ead0`. Diffs dos arquivos de pequeno porte:

```diff
diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
index 8568d7f..bd1f177 100644
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -3,9 +3,8 @@ import { buildThemeInitScript } from "../lib/theme.ts";
 import "./globals.css";
 
 export const metadata = {
-  title: "NÚCLEOS Enterprise — Painel Demonstrativo (Mock Local)",
-  description:
-    "Fundação navegável do frontend NÚCLEOS Enterprise com dados mockados tipados (LOC-WEB-001).",
+  title: "NÚCLEOS",
+  description: "Interface web NÚCLEOS.",
 };
 
 export default function RootLayout({ children }: { children: ReactNode }) {
@@ -15,7 +14,12 @@ export default function RootLayout({ children }: { children: ReactNode }) {
       <head>
         <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
       </head>
-      <body>{children}</body>
+      <body>
+        <a className="skip-link" href="#conteudo">
+          Ir para o conteúdo
+        </a>
+        {children}
+      </body>
     </html>
   );
 }
diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index f4309ed..582f3e7 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -1,5 +1,12 @@
-import { DashboardClientShell } from "./components/DashboardClientShell.tsx";
-
 export default function Home() {
-  return <DashboardClientShell />;
+  return (
+    <main id="conteudo" className="page">
+      <header className="page-header">
+        <h1>NÚCLEOS</h1>
+      </header>
+      <div className="state-box" role="status">
+        Nenhuma página criada ainda.
+      </div>
+    </main>
+  );
 }
```

`documentacoes/` e `lessons/` ficam fora do patch para evitar recursao.

## Lessons

- [14 - Estado deterministico de UI e fronteira de mocks no Next.js](../../lessons/14%20-%20Estado%20deterministico%20de%20UI%20e%20fronteira%20de%20mocks%20no%20Next.js.md) (nota adicionada)
- [Indice](../../lessons/README.md)

## Pendencias

Nenhuma conhecida. Proximos passos: definir a primeira pagina e o menu, seguindo o manual.

## Atualizacao: restauracao de /login e /orgs

A pedido, `/login` e `/orgs` foram restauradas a partir de `083ead0`, junto com o que
dependem: `DashboardClientShell`, os 7 paineis, `lib/mock-*.ts`, `dashboard-mock.test.ts` e o
`globals.css` anterior (as primitivas novas `.page`, `.page-header`, `.btn--primary`,
`.btn--danger` e `.badge*` foram anexadas). O skip-link do layout foi removido porque o shell
ja tem o seu. Isso reintroduz os dados mockados nessas duas rotas, como excecao legada
registrada no manual (secao 11). `/platform` continua removida.

Validacao: `build` (rotas `/`, `/login`, `/orgs`, `/healthz`), `lint` (`tsc --noEmit`) e
`test` (14 de 14 aprovados). Nao executados: `make lint` completo e verificacao visual.
Commits: o commit `1655d2a` fez a limpeza; a restauracao esta no commit seguinte da `developer`.

## Atualizacao: menu, barra superior e pagina Setores

- Criado o grupo de rotas `apps/web/app/(app)/` com `layout.tsx` que aplica o novo
  `components/AppShell.tsx` (menu lateral + barra superior com `ThemeToggle` claro/escuro) e
  `components/NavLink.tsx` (client; marca o item ativo com `aria-current`).
- Menu: **Painel principal** (`/`, movido para `(app)/page.tsx`) e, no grupo Gestao,
  **Setores** (nova pagina `(app)/setores/page.tsx`, estado vazio "Nenhum setor cadastrado").
- `/login` e `/orgs` ficaram fora do grupo, com o shell legado.
- Manual atualizado (secoes 11 e 12) com o passo a passo para incluir paginas no menu.
- Validacao: `build` (rotas `/`, `/setores`, `/login`, `/orgs`, `/healthz`), `tsc --noEmit` e
  14 de 14 testes. Nao executados: `make lint` completo e verificacao visual no navegador.
- Lessons: nenhuma nova; conceitos (layout aninhado e Client Component minimo) nao exigem
  lesson propria nesta entrega.

## Atualizacao: setor Financeiro

- `(app)/setores/page.tsx` passou a listar o setor **Financeiro** como cartao-link
  (`.link-card` em `.card-grid`, classes novas em `globals.css`, mais `.visually-hidden`).
- Nova pagina vazia `(app)/setores/financeiro/page.tsx` (`/setores/financeiro`) com link de
  volta para Setores; o item Setores do menu continua ativo nela.
- Manual atualizado (secao 11 e lista de primitivas).
- Validacao: `build` (inclui `/setores/financeiro`), `tsc --noEmit` e 14 de 14 testes. Nao
  executados: `make lint` completo e verificacao visual no navegador. Sem lesson nova.
