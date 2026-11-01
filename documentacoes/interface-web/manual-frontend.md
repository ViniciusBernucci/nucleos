# Manual de front end NUCLEOS

Ultima atualizacao: 2026-11-01. Aplica-se a `apps/web` (Next.js, TypeScript `strict`).
Todo trabalho de interface parte da branch `developer` e segue este manual. Se uma
regra aqui precisar mudar, altere o manual na mesma entrega que a muda no codigo.

## 1. Como usar

Antes de criar qualquer pagina, leia as secoes 2 a 8 e percorra o checklist da secao 10.
Pagina que nao cumpre o checklist nao esta pronta.

## 2. Principios

1. **Dados reais ou estado vazio.** Nao ha dados mockados, fixtures nem numeros
   inventados na interface. Sem fonte de dados, a pagina mostra estado vazio explicito
   (secao 6), nunca valores de exemplo.
2. **Servidor primeiro.** Componentes sao Server Components por padrao. Use
   `"use client"` somente quando houver estado local, efeito ou evento do navegador, e
   no menor componente possivel.
3. **Uma pagina, uma responsabilidade.** Uma rota resolve uma tarefa do usuario.
4. **Acessivel por padrao.** Teclado, foco visivel, contraste e leitores de tela nao
   sao etapa final: fazem parte da definicao de pronto.
5. **Claro e escuro sempre.** Nenhuma tela existe em um tema so.
6. **Sem segredos no cliente.** Nada de token, chave ou dado pessoal em codigo,
   `localStorage`, logs ou HTML.

## 3. Estrutura de arquivos

```text
apps/web/
  app/
    layout.tsx            layout raiz (html, tema, skip-link)
    globals.css           tokens de design e primitivas (unico CSS global)
    <rota>/page.tsx       uma pasta por rota, pagina enxuta
    <rota>/_components/   componentes usados so por essa rota
    components/           componentes compartilhados por 2+ rotas
    healthz/route.ts      endpoint de saude (nao remover)
  lib/                    funcoes puras e testaveis (sem DOM)
```

Regras:

- Nome de rota em kebab-case e em portugues de negocio (`/clientes`), sem nome de camada
  tecnica.
- `page.tsx` so compoe; logica e marcacao vao para componentes.
- Componente compartilhado so sobe para `components/` quando o segundo uso existir.
- Imports relativos com extensao `.ts`/`.tsx`, como no codigo atual.
- Funcao pura e testavel vai em `lib/`, com teste `*.test.ts` ao lado (`node --test`).

## 4. Anatomia de uma pagina

Toda pagina tem, nesta ordem:

1. `export const metadata` com `title` unico (`"<Pagina> — NUCLEOS"`) e `description`.
2. Um unico `<main id="conteudo">` (o skip-link do layout aponta para ele).
3. Um unico `<h1>`; secoes com `<h2>`, sem pular niveis.
4. Cabecalho da pagina (`.page-header`) com titulo e, se houver, acoes primarias.
5. Conteudo em blocos `.panel-card`.
6. Os quatro estados da secao 6.

Esqueleto minimo:

```tsx
export const metadata = {
  title: "Clientes — NUCLEOS",
  description: "Consulta e manutencao de clientes.",
};

export default function ClientesPage() {
  return (
    <main id="conteudo" className="page">
      <header className="page-header">
        <h1>Clientes</h1>
      </header>
      <section className="panel-card" aria-labelledby="lista-titulo">
        <div className="panel-header">
          <h2 id="lista-titulo">Lista</h2>
        </div>
        <div className="state-box" role="status">
          Nenhum cliente cadastrado.
        </div>
      </section>
    </main>
  );
}
```

## 5. Design system

Fonte unica: `app/globals.css`. Tema "Pinho": preto esverdeado, verde como marca, verde
neon somente para chamar atencao.

### Tokens

Use sempre variaveis; nunca cor, fonte ou borda literal em componente.

| Uso | Token |
| --- | --- |
| Fundo da pagina / lateral / cartao / elevado / interativo | `--bg-canvas`, `--bg-side`, `--bg-surface`, `--bg-elevated`, `--bg-interactive` |
| Bordas | `--border-subtle`, `--border-strong` |
| Texto | `--text-primary`, `--text-secondary`, `--text-muted` |
| Marca e acento | `--brand`, `--brand-text`, `--accent-primary`, `--accent-focus` |
| Chamar atencao (use com parcimonia) | `--attn`, `--attn-glow` |
| Estados | `--status-{ok,warn,danger,info}-{bg,text,border}` |
| Tipografia | `--font-sans`, `--font-mono` |

Para criar um token novo, defina-o nos tres blocos de tema (`:root`, `html[data-theme="light"]`
e `@media (prefers-color-scheme: light)`) na mesma alteracao.

### Primitivas disponiveis

`.page`, `.page-header`, `.panel-card`, `.panel-header`, `.state-box`, `.state-box--error`,
`.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger`, `.badge`, `.badge--{ok,warn,danger,info}`,
`.code-preview`, `.theme-toggle`, `.skip-link`, `.card-grid`, `.link-card`, `.visually-hidden`.

Regra de crescimento: nova classe so entra em `globals.css` quando for reutilizada; estilo
de uso unico fica na propria rota.

### Cor nao e a unica informacao

Estado (ok, alerta, erro) sempre vem com texto ou icone alem da cor.

## 6. Os quatro estados

Toda area que depende de dados trata, explicitamente:

| Estado | Marcacao | Regra |
| --- | --- | --- |
| Carregando | `.state-box` com `role="status"` | Mensagem curta; evitar layout saltando |
| Vazio | `.state-box` com `role="status"` | Diga o que falta e qual a proxima acao |
| Erro | `.state-box.state-box--error` com `role="alert"` | Mensagem util, sem detalhe interno nem dado sensivel |
| Sucesso | Conteudo | Dados vindos de fonte real |

## 7. Acessibilidade

- Controles nativos (`button`, `a`, `input`, `select`) antes de `div` com `role`.
- Todo campo tem `<label>` associado; erro de campo com `aria-describedby`.
- Foco visivel e ordem de tab logica; nunca remover `outline` sem substituto.
- Contraste minimo WCAG AA (4.5:1 texto normal) nos dois temas.
- Imagem informativa com `alt`; decorativa com `alt=""`.
- Tudo operavel so com teclado.
- `lang="pt-BR"` no `html`; textos de interface em portugues.

## 8. Responsividade

- Mobile primeiro; conteudo legivel a partir de 360 px sem rolagem horizontal.
- Largura maxima do conteudo: 1280 px, centralizado.
- Alvos de toque com pelo menos 32 px de altura.
- Tabelas largas rolam dentro do proprio contêiner, nunca a pagina inteira.

## 9. Dados, estado e seguranca

- Busca de dados no servidor (Server Component ou rota). Nada de `fetch` em `useEffect`
  quando o servidor puder fazer.
- Entrada do usuario e validada na fronteira e escapada na saida; proibido
  `dangerouslySetInnerHTML` com conteudo externo (a unica excecao existente e o script de
  tema do layout, estatico).
- Preferencia de tema e a unica coisa em `localStorage` (`nucleos-theme`); leitura e escrita
  sempre em `try/catch`.
- Nao criar contas, sessoes ou autenticacao no cliente: autenticacao e responsabilidade do
  backend (ver `documentacoes/identidade/`).
- Textos de erro e logs nao carregam token, e-mail ou dado pessoal.

## 10. Checklist de pagina nova

- [ ] Rota em kebab-case, `page.tsx` enxuto, `metadata` com titulo unico.
- [ ] `<main id="conteudo">`, um `<h1>`, hierarquia de titulos sem saltos.
- [ ] Somente tokens e primitivas; nenhuma cor literal.
- [ ] Verificada em tema claro e escuro.
- [ ] Estados carregando, vazio, erro e sucesso tratados.
- [ ] Sem dados mockados; vazio explicito quando nao ha fonte.
- [ ] Navegavel por teclado, foco visivel, labels e contraste AA.
- [ ] Sem rolagem horizontal em 360 px.
- [ ] `"use client"` apenas onde indispensavel.
- [ ] Testes de logica pura em `lib/` (`pnpm --filter @nucleos/web test`).
- [ ] `pnpm --filter @nucleos/web lint` e `build` sem erros.
- [ ] Documento em `documentacoes/<dominio>/` e lessons atualizadas, conforme `CLAUDE.md`.

## 11. Menu e estrutura do app

As paginas do app ficam no grupo de rotas `app/(app)/`, cujo `layout.tsx` aplica o
`AppShell` (`app/components/AppShell.tsx`): menu lateral e barra superior com o seletor de
tema claro/escuro (`ThemeToggle`). Para adicionar uma pagina ao menu:

1. Crie `app/(app)/<rota>/page.tsx` seguindo a secao 4.
2. Adicione um `<NavLink href="/<rota>" code="XX">Nome</NavLink>` no `AppShell`, no grupo
   adequado (`code` e a sigla de 2 letras do icone).
3. O item ativo e marcado automaticamente com `aria-current="page"`.

Itens atuais: **Painel principal** (`/`) e, no grupo Gestao, **Setores** (`/setores`).
`/setores` lista cada setor como `.link-card` dentro de `.card-grid`; o primeiro setor e o
**Financeiro** (`/setores/financeiro`, pagina vazia, com link de volta para Setores). Todo
setor novo segue esse padrao: um `link-card` em `/setores` e uma pagina em
`app/(app)/setores/<setor>/page.tsx`. Sem fonte de dados, as paginas mostram estado vazio.

## 12. Estado atual do front end

Em 2026-11-01 o front end foi reiniciado (sem paginas de negocio, dashboard e mocks) e, a
pedido, as rotas `/login` e `/orgs` foram restauradas como **excecao legada**: ficam fora do
grupo `(app)`, com o shell de demonstracao proprio (`DashboardClientShell`) e os dados
mockados de `lib/mock-*.ts`. A regra "sem dados mockados" vale para toda pagina nova; essas
duas rotas serao substituidas por paginas reais. `/platform` nao existe e `/healthz`
permanece.
