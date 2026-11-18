import assert from "node:assert/strict";
import { test } from "node:test";
import { funcionariosApi, setoresMenu } from "../lib/funcionarios-api.ts";
async function comAmbiente(fn: () => Promise<void>) {
  const nomes = ["VENDAS_API_KEY", "VENDAS_API_KEY_FILE", "VENDAS_API_URL"];
  const salvo = new Map(nomes.map((n) => [n, process.env[n]]));
  const fetchAntes = globalThis.fetch;
  try {
    delete process.env["VENDAS_API_KEY_FILE"];
    process.env["VENDAS_API_URL"] = "http://127.0.0.1:3001";
    await fn();
  } finally {
    for (const [n, v] of salvo) {
      if (v === undefined) Reflect.deleteProperty(process.env, n);
      else process.env[n] = v;
    }
    globalThis.fetch = fetchAntes;
  }
}
test("cliente de Funcionários sem chave não chama API nem inventa setores", async () =>
  comAmbiente(async () => {
    delete process.env["VENDAS_API_KEY"];
    let chamadas = 0;
    globalThis.fetch = async () => {
      chamadas++;
      throw new Error("não deve chamar");
    };
    const r = await funcionariosApi("/setores");
    assert.equal(r.ok, false);
    assert.deepEqual(await setoresMenu(), []);
    assert.equal(chamadas, 0);
  }));
test("cliente envia chave só ao servidor e devolve mensagens fixas em erros de HTTP/rede", async () =>
  comAmbiente(async () => {
    process.env["VENDAS_API_KEY"] = "CHAVE_SENTINELA";
    let recebido = "";
    globalThis.fetch = async (_, init) => {
      recebido = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ segredo: "CHAVE_SENTINELA" }), { status: 401 });
    };
    const r = await funcionariosApi("/setores");
    assert.equal(recebido, "Bearer CHAVE_SENTINELA");
    assert.equal(r.ok, false);
    assert.equal(JSON.stringify(r).includes("CHAVE_SENTINELA"), false);
    globalThis.fetch = async () => {
      throw new Error("CHAVE_SENTINELA");
    };
    assert.equal(JSON.stringify(await funcionariosApi()).includes("CHAVE_SENTINELA"), false);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          { id: "9", codigo: "financeiro", nome: "Financeiro", ativo: true, ordem: 0 },
        ]),
        { status: 200 },
      );
    assert.equal((await setoresMenu())[0]?.id, "9");
  }));
