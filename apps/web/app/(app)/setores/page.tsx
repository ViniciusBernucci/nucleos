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
      <section className="panel-card" aria-labelledby="setores-lista">
        <div className="panel-header">
          <h2 id="setores-lista">Lista de setores</h2>
        </div>
        <div className="state-box" role="status">
          Nenhum setor cadastrado.
        </div>
      </section>
    </main>
  );
}
