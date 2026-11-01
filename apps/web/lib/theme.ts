/**
 * Preferencia de tema (claro/escuro) da interface web.
 *
 * Funcoes puras, sem acesso a DOM ou `localStorage`, para poderem ser testadas
 * no Node. A leitura/gravacao do navegador fica em `ThemeToggle.tsx` e no
 * script de inicializacao gerado por `buildThemeInitScript`.
 */

export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "nucleos-theme";

export function parseStoredTheme(value: string | null | undefined): ThemePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveEffectiveTheme(
  stored: ThemePreference | null,
  systemPrefersDark: boolean,
): ThemePreference {
  if (stored !== null) {
    return stored;
  }
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Script inline executado antes da pintura para evitar o "flash" de tema.
 * So aplica `data-theme` quando existe preferencia valida salva; sem ela, o CSS
 * segue `prefers-color-scheme`. Qualquer falha de armazenamento e ignorada.
 */
export function buildThemeInitScript(): string {
  return `try{var t=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}`;
}
