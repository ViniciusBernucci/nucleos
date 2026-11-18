import type { ReactNode } from "react";
import { NavLink } from "./NavLink.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { setoresMenu } from "../../lib/funcionarios-api.ts";

/**
 * Estrutura comum das paginas do app: menu lateral + barra superior com o
 * seletor de tema. Cada pagina fornece o proprio `<main id="conteudo">`.
 * Novos itens de menu entram aqui (ver manual de front end, secao 4).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const setores = await setoresMenu();
  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo principal
      </a>

      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <div className="brand-title">NÚCLEOS</div>
            <div className="brand-subtitle">Enterprise</div>
          </div>
        </div>

        <div className="side-group">
          <NavLink href="/" code="PP">
            Painel principal
          </NavLink>
        </div>

        <div className="side-group">
          <h2 className="side-group__title">Gestão</h2>
          <NavLink href="/setores" code="ST">
            Setores
          </NavLink>
          <NavLink href="/funcionarios" code="FU">
            Funcionários
          </NavLink>
          {setores.map((setor) => (
            <NavLink
              key={setor.id}
              href={`/funcionarios/setores/${setor.id}`}
              code={setor.codigo.slice(0, 2).toUpperCase()}
            >
              {setor.nome}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="app-content">
        <header className="topbar">
          <ThemeToggle />
        </header>
        {children}
      </div>
    </div>
  );
}
