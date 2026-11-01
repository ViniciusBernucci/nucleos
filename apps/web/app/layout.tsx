import type { ReactNode } from "react";
import { buildThemeInitScript } from "../lib/theme.ts";
import "./globals.css";

export const metadata = {
  title: "NÚCLEOS Enterprise — Painel Demonstrativo (Mock Local)",
  description:
    "Fundação navegável do frontend NÚCLEOS Enterprise com dados mockados tipados (LOC-WEB-001).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-theme` e aplicado antes da hidratacao pelo script abaixo.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
