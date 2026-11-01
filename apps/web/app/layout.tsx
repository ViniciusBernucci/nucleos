import type { ReactNode } from "react";
import { buildThemeInitScript } from "../lib/theme.ts";
import "./globals.css";

export const metadata = {
  title: "NÚCLEOS",
  description: "Interface web NÚCLEOS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-theme` e aplicado antes da hidratacao pelo script abaixo.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body>
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
