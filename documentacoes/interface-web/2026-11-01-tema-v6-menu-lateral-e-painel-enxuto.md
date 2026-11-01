# Tema v6, menu lateral por setores e Painel enxuto (claro/escuro)

Data: 2026-11-01.

- **Domínio:** interface-web.
- **Solicitação:** aplicar no site o visual escolhido na versão v6 do redesenho (preto esverdeado, verde como marca, verde neon só para atenção, menus menores e menos espaçamento), com Painel inicial mínimo, setores acessados pelo menu e opção de modo escuro e claro.
- **Branch:** `design/tema-v6` (criada a partir de `main`, sem commits novos).
- **Base / commit inicial:** `HEAD` = `54a9aa78812e7772493b9fa5721a2e0a268bfb33`; árvore de trabalho já continha mudanças alheias (skills em `.agent/`, `apps/web/package.json`, documentos) que **não** pertencem a esta tarefa.
- **Estado:** implementado e validado localmente; não commitado.
- **Autores conhecidos:** Claude (implementação) a partir da direção de design do usuário.

## Objetivo, contexto e escopo

O frontend mockado (LOC-WEB-001, ver [2026-10-30-loc-web-001-frontend-mockado.md](2026-10-30-loc-web-001-frontend-mockado.md)) tinha tema azul, muitas informações no painel inicial e navegação horizontal. O objetivo é uma interface sóbria, de aparência tecnológica e confiável para empresas grandes, com o mínimo de informação no Painel e os setores no menu.

**Dentro do escopo:** tokens de cor claro/escuro; menu lateral (Painel, Setores, Sistema); Painel inicial enxuto; alternância de tema persistente; ajuste do CSS global, que restila automaticamente os painéis existentes.

**Fora do escopo:** novas telas de login/organizações independentes do shell (`/login`, `/orgs` e `/platform` continuam renderizando o mesmo shell mockado em seções diferentes); integração com backend; fontes web (usa a pilha do sistema, com `Inter` quando instalada); testes de DOM/navegador automatizados.

## Resumo da implementação

- **Tema:** variáveis CSS em `globals.css`. Escuro é o padrão (`:root`); o claro vale com `html[data-theme="light"]` e, sem preferência salva, com `prefers-color-scheme: light`. Os nomes antigos das variáveis foram mantidos, então os painéis existentes não precisaram mudar.
- **Persistência sem "flash":** script inline no `<head>` (`buildThemeInitScript`) aplica `data-theme` antes da pintura a partir de `localStorage`; falhas de armazenamento são ignoradas. `ThemeToggle` (componente cliente) lê o estado só após montar, para não divergir da hidratação.
- **Menu lateral:** marca, seletor de organização (mock), Painel, **Setores** (os departamentos da organização ativa, vindos de `viewModel.floors`) e **Sistema** (aprovações/filas/orçamento, chat, governança, acesso, plataforma). Itens de 12,8 px e 32 px de altura.
- **Painel enxuto (`OverviewPanel`):** 3 indicadores (decisões pendentes, agentes em execução, orçamento de IA), "Aguardam sua decisão" (até 3) e "Atualizações" (até 4). O verde neon aparece apenas no contador e no ponto de decisões pendentes. Os demais painéis passaram a ser exibidos só na seção própria, e não mais empilhados no Painel.
- **Aviso de demonstração:** mantido, porém reduzido a uma faixa discreta.

## Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `apps/web/app/globals.css` | Reescrito: tokens claro/escuro, grade menu+conteúdo, menu lateral, topbar, alternador de tema, cantos arredondados, remoção de cores fixas (`#090e1c`, `#22111b`, gradiente do banner). |
| `apps/web/app/components/DashboardClientShell.tsx` | Novo layout (menu lateral + topbar); setores no menu; Painel usa `OverviewPanel`; seções sob demanda; `MetricsGrid` só em "Aprovações, filas e orçamento". |
| `apps/web/app/components/OverviewPanel.tsx` | **Novo.** Painel inicial mínimo. |
| `apps/web/app/components/ThemeToggle.tsx` | **Novo.** Alternador Escuro/Claro com `aria-pressed`. |
| `apps/web/app/layout.tsx` | `suppressHydrationWarning` e script de inicialização do tema. |
| `apps/web/lib/theme.ts` | **Novo.** Funções puras: `parseStoredTheme`, `resolveEffectiveTheme`, `buildThemeInitScript`. |
| `apps/web/app/theme.test.ts` | **Novo.** 3 testes (THEME-01..03). |

Sem migrações, sem mudança de configuração e sem novas dependências.

## Decisões técnicas e consequências

- **Manter os nomes das variáveis CSS:** evita tocar nos cinco componentes de painel; consequência: a paleta nova vive só em `globals.css`.
- **Duplicação do bloco claro** (`[data-theme="light"]` e `@media (prefers-color-scheme: light)`): CSS puro não permite reaproveitar o bloco entre as duas condições sem pré-processador. Alternativa descartada: `color-mix`/`light-dark()` em todas as variáveis, que dificultaria revisar a paleta.
- **Sem `next/font`:** fontes do Google exigiriam rede no build; a pilha do sistema mantém o build offline.
- **Verde neon de atenção só no escuro:** no tema claro o neon perde contraste; usa-se `#0a7a45`. Estados de aviso (`warn`) continuam âmbar por semântica funcional (alerta de orçamento/segurança), diferente do laranja retirado do design de atenção.
- **Contraste:** os pares texto/fundo foram escolhidos para ≥ 4,5:1 (texto muted `#8a968f` sobre `#161b18` e `#56635b` sobre `#ffffff`); não foi executada medição automatizada.

## Validações (comandos e resultados reais)

`pnpm` não está instalado neste ambiente, então as ferramentas foram chamadas diretamente (`make lint/test/build` **não** foram executados).

| Verificação | Comando (em `apps/web`, salvo indicação) | Resultado |
| --- | --- | --- |
| Tipos | `../../node_modules/.bin/tsc --noEmit` | sem erros |
| Testes | `node --test "app/**/*.test.ts"` | 14 testes, 14 aprovados (11 existentes + 3 novos) |
| ESLint | `node_modules/.bin/eslint apps/web/app apps/web/lib` (raiz) | 0 erros, 0 avisos (2 erros e 2 avisos iniciais corrigidos: `new Function` no teste e acesso por índice em `Record`) |
| Prettier | `prettier --check` nos 7 arquivos alterados | formatados. O repositório tem 18 arquivos de `apps/web` fora do padrão que **já estavam assim** e não foram tocados |
| Build | `node_modules/.bin/next build` | compilado; rotas `/`, `/login`, `/orgs`, `/platform`, `/healthz` geradas |
| Visual | `next start -p 3123` + navegador embutido | Painel escuro e claro renderizados; preferência "Claro" mantida após recarregar; clique em setor (Finanças) abre "Setores e agentes" com o andar selecionado |

Não verificado: leitores de tela, navegação por teclado completa, larguras de celular reais, Firefox/Safari.

## Impactos, riscos e rollback

- **Compatibilidade:** nenhuma API ou contrato alterado. Quem tinha navegação por abas horizontais passa a usar o menu lateral; as seções antes empilhadas no Painel agora estão em itens do menu.
- **Risco:** `dangerouslySetInnerHTML` no `<head>` — o conteúdo é constante gerada no código, sem entrada do usuário; a chave de `localStorage` só aceita `light`/`dark`.
- **Observabilidade:** não se aplica (interface estática mockada).
- **Rollback:** descartar a branch `design/tema-v6` (ou `git checkout -- apps/web` e remover os 4 arquivos novos).

## Commits e diffs

Nenhum commit criado nesta tarefa. Diffs completos (não staged) em [2026-11-01-tema-v6-menu-lateral-e-painel-enxuto-diffs.md](2026-11-01-tema-v6-menu-lateral-e-painel-enxuto-diffs.md). Ficaram de fora, por não pertencerem à tarefa, as alterações prévias em `.agent/skills/` e em `apps/web/package.json`, além deste documento, da lesson e do índice.

## Material de design relacionado

Fontes do protótipo (canvas) em [`documentacoes/design-painel/project/`](../design-painel/project/): Painel v3 (violeta, `Main.dc.html`), v4, v5, v6 (`Painel-v6.dc.html`, escolhida), Setor, Organizações, Plataforma e Entrada. As telas de Setor, Organizações, Plataforma e Entrada do protótipo ainda estão no estilo violeta e não foram refeitas no estilo v6.

## Lessons

- [15 - Temas claro e escuro com variaveis CSS no Next.js](../../lessons/15%20-%20Temas%20claro%20e%20escuro%20com%20variaveis%20CSS%20no%20Next.js.md) (nova).
- Índice atualizado em [lessons/README.md](../../lessons/README.md).

## Pendências

- As duas primeiras versões do Painel no protótipo (mono e arredondada) foram sobrescritas no canvas e não foram recuperadas.
- Aplicar o estilo v6 às telas de Setor, Organizações, Plataforma e Entrada do protótipo, se o usuário confirmar.
- Rodar `make lint`, `make test` e `make build` em ambiente com `pnpm`.
- `/login` e `/orgs` ainda abrem o mesmo shell mockado na seção "Acesso e organizações"; uma tela de entrada dedicada é decisão de produto pendente.
