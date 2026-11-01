# 15 - Temas claro e escuro com variáveis CSS no Next.js

Criada em 2026-11-01. Última atualização: 2026-11-01. Numeração provisória (o coordenador reconcilia a posição na trilha). Exemplos validados com Node.js 24.22.2, TypeScript 5.9.3 (`strict`), Next.js 16.4.3 e React 19.3.1. Python não é usado nesta lição.

## 1. Objetivo de aprendizagem

Ao concluir, você será capaz de:

1. Definir uma paleta como **variáveis CSS** e trocar de tema mudando apenas um atributo no `<html>`.
2. Respeitar a preferência do sistema (`prefers-color-scheme`) e, ao mesmo tempo, permitir que o usuário escolha e guarde o tema.
3. Evitar o "flash" de tema errado e o erro de hidratação do React.
4. Manter a lógica de decisão em funções puras e testáveis no Node.

## 2. Pré-requisitos e posição na trilha

- **Pré-requisitos:** TypeScript `strict` ([02 - Qualidade estatica em TypeScript e Python](02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md)) e a separação entre lógica pura e componentes ([14 - Estado deterministico de UI e fronteira de mocks no Next.js](14%20-%20Estado%20deterministico%20de%20UI%20e%20fronteira%20de%20mocks%20no%20Next.js.md)).
- **Posição na trilha:** Bloco 6 (Next.js) e Bloco 8 (testes).

## 3. Modelo mental

Pense em três camadas:

1. **Tokens** (CSS): nomes semânticos (`--bg-surface`, `--text-primary`) em vez de cores soltas. Cada tema só reatribui os valores.
2. **Decisão** (TypeScript puro): dado o valor salvo e a preferência do sistema, qual tema vale? Sem DOM, portanto testável.
3. **Efeitos** (navegador): ler/gravar `localStorage` e escrever `data-theme` no `<html>`.

Regra de precedência: **escolha salva > preferência do sistema**. Sem escolha salva, o CSS segue o sistema sozinho, sem JavaScript.

## 4. Conexão com a implementação real

A entrega está documentada em [2026-11-01-tema-v6-menu-lateral-e-painel-enxuto.md](../documentacoes/interface-web/2026-11-01-tema-v6-menu-lateral-e-painel-enxuto.md). Arquivos: `apps/web/app/globals.css`, `apps/web/lib/theme.ts`, `apps/web/app/components/ThemeToggle.tsx` e `apps/web/app/layout.tsx`.

## 5. Do exemplo mínimo ao padrão do projeto

### 5.1 Mínimo: tokens e atributo

```css
:root {
  color-scheme: dark;
  --bg: #0f1311;
  --text: #e8ece8;
}
html[data-theme="light"] {
  color-scheme: light;
  --bg: #f3f6f4;
  --text: #111613;
}
body {
  background: var(--bg);
  color: var(--text);
}
```

`color-scheme` também ajusta controles nativos (selects, barras de rolagem).

### 5.2 Seguir o sistema quando não há escolha

```css
@media (prefers-color-scheme: light) {
  html:not([data-theme]) {
    color-scheme: light;
    --bg: #f3f6f4;
    --text: #111613;
  }
}
```

Só vale quando `data-theme` não existe. Quando o usuário escolhe, o atributo passa a mandar.

### 5.3 Decisão em TypeScript puro (executável)

```ts
// lib/theme.ts
export type ThemePreference = "light" | "dark";
export const THEME_STORAGE_KEY = "nucleos-theme";

export function parseStoredTheme(value: string | null | undefined): ThemePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveEffectiveTheme(
  stored: ThemePreference | null,
  systemPrefersDark: boolean,
): ThemePreference {
  if (stored !== null) return stored;
  return systemPrefersDark ? "dark" : "light";
}
```

Validar entrada com lista fechada (`"light"`/`"dark"`) impede que um valor adulterado no `localStorage` chegue ao DOM.

### 5.4 Sem flash: script antes da pintura

```tsx
// app/layout.tsx
import { buildThemeInitScript } from "../lib/theme.ts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

O script roda antes do primeiro desenho e só **define** `data-theme` se houver valor válido. `suppressHydrationWarning` é necessário porque o servidor não conhece o atributo que o script acrescenta.

### 5.5 Alternador sem erro de hidratação

```tsx
"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null); // null até montar

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const attr = document.documentElement.getAttribute("data-theme");
    setTheme(attr === "light" || attr === "dark" ? attr : dark ? "dark" : "light");
  }, []);

  return (
    <div role="group" aria-label="Tema da interface">
      <button type="button" aria-pressed={theme === "dark"}>Escuro</button>
      <button type="button" aria-pressed={theme === "light"}>Claro</button>
    </div>
  );
}
```

O estado começa `null` para o HTML do servidor e do primeiro render do cliente serem iguais. A versão do projeto também grava no `localStorage` dentro de `try/catch`.

## 6. Erros comuns, trade-offs e quando não usar

- **Ler `localStorage` durante o render:** quebra a hidratação e não funciona no servidor. Leia em `useEffect`.
- **Cores fixas fora dos tokens:** ficam erradas em um dos temas. Em geral, `grep` por `#` nos componentes.
- **Contraste só testado no escuro:** neon sobre fundo branco fica ilegível. Defina valores próprios por tema.
- **Duplicar o bloco claro** (atributo e `@media`) é um custo real do CSS puro; o ganho é não depender de JavaScript para seguir o sistema.
- **Não use** este padrão para temas com muitas marcas ou configuração por tenant em tempo de execução; aí vale gerar os tokens no servidor.
- `dangerouslySetInnerHTML` só é aceitável com conteúdo **constante** gerado no código, nunca com entrada do usuário.

## 7. Verificação

Teste do projeto (`apps/web/app/theme.test.ts`), executável com `node --test`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { buildThemeInitScript, parseStoredTheme, resolveEffectiveTheme } from "../lib/theme.ts";

test("preferência salva vence o sistema", () => {
  assert.equal(resolveEffectiveTheme("light", true), "light");
  assert.equal(resolveEffectiveTheme(null, true), "dark");
  assert.equal(parseStoredTheme("<script>"), null);
  assert.doesNotThrow(() => new vm.Script(buildThemeInitScript()));
});
```

Execução: `node --test "app/**/*.test.ts"` em `apps/web` (14 testes aprovados na entrega).

## 8. Exercícios e perguntas de revisão

1. Por que o estado do alternador começa em `null`? O que acontece se começar em `"dark"`?
2. O que muda se o usuário nunca clicar no alternador e o sistema estiver em modo claro?
3. Adicione um terceiro valor `"system"` que apague a escolha salva. Quais funções e testes mudam?
4. Por que `parseStoredTheme` não deveria simplesmente devolver o texto lido?
5. Escolha uma cor de atenção para o tema claro e justifique o contraste com o fundo `#ffffff`.
