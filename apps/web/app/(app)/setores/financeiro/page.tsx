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
      <section aria-labelledby="financeiro-paineis">
        <h2 id="financeiro-paineis" className="visually-hidden">
          Painéis do setor
        </h2>
        <ul className="card-grid">
          <li>
            <Link href="/setores/financeiro/vendas" className="link-card">
              <span className="link-card__code" aria-hidden="true">
                VD
              </span>
              <span className="link-card__title">Painel de vendas</span>
              <span className="link-card__text">Receita, ticket médio e reembolsos da Hotmart</span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
