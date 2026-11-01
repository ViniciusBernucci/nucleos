export const metadata = {
  title: "Painel principal — NÚCLEOS",
  description: "Visão geral da organização.",
};

export default function PainelPrincipalPage() {
  return (
    <main id="conteudo" className="page">
      <header className="page-header">
        <h1>Painel principal</h1>
      </header>
      <div className="state-box" role="status">
        Nenhum indicador disponível ainda.
      </div>
    </main>
  );
}
