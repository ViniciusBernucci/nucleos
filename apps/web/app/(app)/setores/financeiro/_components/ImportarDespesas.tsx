"use client";
import { useActionState } from "react";
import { importarCsv } from "./acoes.ts";
export function ImportarDespesas() {
  const [estado, acao, pendente] = useActionState(importarCsv, {
    erro: false,
    mensagem: "",
    previa: null,
  });
  const previa = estado.previa
    ? (JSON.parse(estado.previa) as {
        linhas: Record<string, unknown>[];
        erros: { linha: number; mensagem: string }[];
      })
    : null;
  return (
    <form action={acao} aria-busy={pendente}>
      <p>
        Layout separado por ponto e vírgula:
        data;descricao;valor;categoria;fornecedor;centro_custo;vencimento. Datas AAAA-MM-DD; valor
        decimal; fornecedor e centro opcionais usam os códigos dos cadastros.
      </p>
      <label>
        Conteúdo CSV
        <textarea name="conteudo" rows={7} required maxLength={1048576} />
      </label>
      <button disabled={pendente} name="confirmar" value="nao">
        Pré-visualizar
      </button>
      <button disabled={pendente || estado.erro || !estado.previa} name="confirmar" value="sim">
        Confirmar importação
      </button>
      {estado.mensagem && <p role={estado.erro ? "alert" : "status"}>{estado.mensagem}</p>}
      {previa && (
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          <ul>
            {previa.erros.map((e) => (
              <li key={e.linha}>
                Linha {e.linha}: {e.mensagem}
              </li>
            ))}
          </ul>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Competência</th>
                <th>Categoria</th>
                <th>Valor (centavos)</th>
                <th>Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {previa.linhas.map((l, i) => (
                <tr key={i}>
                  {["descricao", "competencia", "categoria", "valorCentavos", "vencimento"].map(
                    (k) => (
                      <td key={k}>{String(l[k])}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
