import Link from "next/link";

export const metadata = {
  title: "Setores — NÚCLEOS",
  description: "Consulta e manutenção dos setores da organização.",
};

export default function SetoresPage() {
  return (
    <main id="conteudo" className="page">
      <header className="page-header">
        <h1>Setores</h1>
      </header>
      <section aria-labelledby="setores-lista">
        <h2 id="setores-lista" className="visually-hidden">
          Lista de setores
        </h2>
        <ul className="card-grid">
          <li>
            <Link href="/setores/financeiro" className="link-card">
              <span className="link-card__code" aria-hidden="true">
                FN
              </span>
              <span className="link-card__title">Financeiro</span>
              <span className="link-card__text">Abrir o setor financeiro</span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
