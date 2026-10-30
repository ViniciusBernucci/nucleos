import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "NÚCLEOS Enterprise — Painel Demonstrativo (Mock Local)",
  description:
    "Fundação navegável do frontend NÚCLEOS Enterprise com dados mockados tipados (LOC-WEB-001).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
