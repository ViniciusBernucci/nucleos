import assert from "node:assert/strict";
import { test } from "node:test";
import { VendasController } from "./vendas.controller.js";
import type { ServicoPainelVendas } from "./painel.service.js";
import type { RepositorioVendas } from "./repositorio.js";
import type { ResultadoSincronizacao } from "./sincronizacao.js";

test("atualizar painel aguarda a gravacao e devolve o resultado, inclusive lock ocupado", async () => {
  let concluir!: (r: ResultadoSincronizacao) => void;
  const execucao = new Promise<ResultadoSincronizacao>((r) => {
    concluir = r;
  });
  const controller = new VendasController({} as ServicoPainelVendas, {} as RepositorioVendas, {
    executar: () => execucao,
  });
  let terminou = false;
  const resposta = controller.atualizarPainel().then((r) => {
    terminou = true;
    return r;
  });
  await Promise.resolve();
  assert.equal(terminou, false);
  concluir({ resultado: "sucesso", processadas: 2, mensagem: null });
  assert.deepEqual(await resposta, { resultado: "sucesso", processadas: 2, mensagem: null });
  const ocupada = new VendasController({} as ServicoPainelVendas, {} as RepositorioVendas, {
    executar: async () => ({ resultado: "ocupada" }),
  });
  assert.deepEqual(await ocupada.atualizarPainel(), { resultado: "ocupada" });
});
