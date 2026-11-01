import Link from "next/link";

export const metadata = {
  title: "Financeiro — NÚCLEOS",
  description: "Setor financeiro da organização.",
};

export default function FinanceiroPage() {
  return (
    <main id="conteudo" className="page">
      <nav aria-label="Trilha de navegação">
        <Link href="/setores">← Setores</Link>
      </nav>
      <header className="page-header">
        <h1>Financeiro</h1>
      </header>
      <div className="state-box" role="status">
        Nenhum conteúdo disponível ainda.
      </div>
    </main>
  );
}
