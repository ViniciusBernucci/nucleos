import Link from "next/link";
import type { PainelVendas } from "@nucleos/contracts";
import {
  type FiltrosVendas,
  paraQuery,
  ultimosDias,
} from "../../../../../../lib/vendas-formato.ts";
import styles from "../vendas.module.css";

const ATALHOS = [7, 30, 90] as const;

/** Filtros por GET (sem JavaScript): o servidor recalcula o painel a cada envio. */
export function Filtros({
  painel,
  filtros,
  agora,
}: {
  painel: PainelVendas;
  filtros: FiltrosVendas;
  agora: Date;
}) {
  const base: FiltrosVendas = {
    moeda: painel.moeda,
    ...(filtros.produto === undefined ? {} : { produto: filtros.produto }),
  };
  return (
    <section className="panel-card" aria-labelledby="filtros-titulo">
      <div className="panel-header">
        <h2 id="filtros-titulo">Filtros</h2>
        <nav aria-label="Atalhos de período" className={styles["filtros"]}>
          {ATALHOS.map((n) => (
            <Link
              key={n}
              className="btn btn--secondary"
              href={`?${paraQuery({ ...base, ...ultimosDias(n, agora) })}`}
            >
              Últimos {n} dias
            </Link>
          ))}
        </nav>
      </div>
      <form method="get" className={styles["filtros"]}>
        <label className={styles["campo"]}>
          De
          <input
            className="control-input"
            type="date"
            name="de"
            defaultValue={painel.periodo.de}
            required
          />
        </label>
        <label className={styles["campo"]}>
          Até
          <input
            className="control-input"
            type="date"
            name="ate"
            defaultValue={painel.periodo.ate}
            required
          />
        </label>
        <label className={styles["campo"]}>
          Moeda
          <select className="control-select" name="moeda" defaultValue={painel.moeda}>
            {(painel.moedasDisponiveis.length > 0 ? painel.moedasDisponiveis : [painel.moeda]).map(
              (m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ),
            )}
          </select>
        </label>
        <label className={styles["campo"]}>
          Produto
          <select className="control-select" name="produto" defaultValue={filtros.produto ?? ""}>
            <option value="">Todos os produtos</option>
            {painel.produtos.map((p) => (
              <option key={p.produtoId} value={p.produtoId}>
                {p.produtoNome}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary">
          Aplicar
        </button>
      </form>
    </section>
  );
}
