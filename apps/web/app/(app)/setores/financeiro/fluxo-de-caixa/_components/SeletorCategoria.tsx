"use client";

import type { Categoria, TipoLancamento } from "@nucleos/contracts";
import { useState } from "react";
import styles from "../fluxo-de-caixa.module.css";

function OpcoesCategoria({ categorias }: { categorias: readonly Categoria[] }) {
  return (
    <>
      <option value="" disabled>
        {categorias.length === 0 ? "Cadastre uma categoria" : "Escolha…"}
      </option>
      {categorias.map((c) => (
        <option key={c.id} value={c.nome}>
          {c.nome}
        </option>
      ))}
    </>
  );
}

/** Lista de categorias cadastradas de um tipo fixo (ex.: contas recorrentes = saida). */
export function CampoCategoria({
  categorias,
  tipo,
}: {
  categorias: readonly Categoria[];
  tipo: TipoLancamento;
}) {
  return (
    <label className={styles["campo"]}>
      Categoria
      <select className="control-select" name="categoria" required defaultValue="">
        <OpcoesCategoria categorias={categorias.filter((c) => c.tipo === tipo)} />
      </select>
    </label>
  );
}

/** Tipo + categoria: ao trocar o tipo, a lista mostra so as categorias daquele tipo. */
export function SeletorTipoCategoria({ categorias }: { categorias: readonly Categoria[] }) {
  const [tipo, setTipo] = useState<TipoLancamento>("saida");
  return (
    <>
      <label className={styles["campo"]}>
        Tipo
        <select
          className="control-select"
          name="tipo"
          required
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value === "entrada" ? "entrada" : "saida");
          }}
        >
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
      </label>
      <label className={styles["campo"]}>
        Categoria
        {/* key: ao trocar o tipo, a escolha anterior (de outro tipo) e descartada. */}
        <select key={tipo} className="control-select" name="categoria" required defaultValue="">
          <OpcoesCategoria categorias={categorias.filter((c) => c.tipo === tipo)} />
        </select>
      </label>
    </>
  );
}
