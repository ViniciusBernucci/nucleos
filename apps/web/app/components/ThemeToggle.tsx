"use client";

import { useEffect, useState } from "react";
import {
  parseStoredTheme,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../../lib/theme.ts";

function readStoredTheme(): ThemePreference | null {
  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  // `null` ate montar no cliente: evita divergencia de hidratacao com o tema salvo.
  const [theme, setTheme] = useState<ThemePreference | null>(null);

  useEffect(() => {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(resolveEffectiveTheme(readStoredTheme(), systemPrefersDark));
  }, []);

  function choose(next: ThemePreference): void {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Armazenamento indisponivel: o tema vale apenas nesta sessao.
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Tema da interface">
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => {
          choose("dark");
        }}
      >
        Escuro
      </button>
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => {
          choose("light");
        }}
      >
        Claro
      </button>
    </div>
  );
}
