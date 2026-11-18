# Patch da atualizacao manual Hotmart — 2026-11-01

[Registro](2026-11-01-atualizacao-manual-hotmart.md).

Nenhum commit criado nesta tarefa. Nenhum diff staged desta continuacao.
Diff unstaged contra snapshot da entrada desta continuacao, preservando o trabalho anterior.
Documentacao e lessons sao listadas no registro e excluidas do patch para evitar recursao.
O .env real nao esta incluido.

```diff
--- a/.env.example
+++ b/.env.example
@@ -27,10 +27,14 @@
 HOTMART_ENV=production
 HOTMART_CLIENT_ID=
 HOTMART_CLIENT_SECRET=
+# Token Basic fornecido pela Hotmart, sem o prefixo "Basic ". Opcional para compatibilidade.
+HOTMART_CLIENT_TOKEN=
 HOTMART_SYNC_INTERVAL=30m
 HOTMART_BACKFILL_DAYS=90
 # Mesma chave privada na API e no servidor web; vazia => vendas fechadas (503).
 VENDAS_API_KEY=
+# Endereco da API INTERNA do NUCLEOS, consultada pelo servidor web.
+# As URLs externas da Hotmart ficam no codigo; nao substitua esta URL por elas.
 VENDAS_API_URL=http://127.0.0.1:3001
 # APP_ENV=staging|production exige DATABASE_URL e DATABASE_PASSWORD (ou *_FILE).
 # PORT=3001 REQUEST_TIMEOUT=30s SHUTDOWN_TIMEOUT=10s MAX_BODY_SIZE=1mb

--- a/packages/config/src/vendas.ts
+++ b/packages/config/src/vendas.ts
@@ -1,5 +1,5 @@
 import { z } from "zod";
-import { loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
+import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
 import type { Secret } from "./secret.js";
 import { absolutePathSchema, durationMs } from "./primitives.js";
 
@@ -11,6 +11,8 @@
     HOTMART_ENV: z.enum(HOTMART_ENVS).default("production"),
     HOTMART_CLIENT_ID: z.string().optional(),
     HOTMART_CLIENT_SECRET: z.string().optional(),
+    HOTMART_CLIENT_TOKEN: z.string().optional(),
+    HOTMART_CLIENT_TOKEN_FILE: absolutePathSchema.optional(),
     HOTMART_CLIENT_ID_FILE: absolutePathSchema.optional(),
     HOTMART_CLIENT_SECRET_FILE: absolutePathSchema.optional(),
     /** Intervalo entre sincronizacoes; padrao de 30 minutos. */
@@ -31,6 +33,16 @@
       v.HOTMART_CLIENT_ID ?? v.HOTMART_CLIENT_ID_FILE,
       v.HOTMART_CLIENT_SECRET ?? v.HOTMART_CLIENT_SECRET_FILE,
     ];
+    if (
+      (v.HOTMART_CLIENT_TOKEN ?? v.HOTMART_CLIENT_TOKEN_FILE) !== undefined &&
+      par.every((p) => p === undefined)
+    ) {
+      ctx.addIssue({
+        code: "custom",
+        path: ["HOTMART_CLIENT_ID"],
+        message: "o Client Token exige Client ID e Client Secret",
+      });
+    }
     if (par.some((p) => p === undefined) && par.some((p) => p !== undefined)) {
       ctx.addIssue({
         code: "custom",
@@ -43,6 +55,8 @@
 export interface HotmartCredentials {
   readonly clientId: Secret;
   readonly clientSecret: Secret;
+  /** Token Basic fornecido pela Hotmart; ausente preserva a derivacao ID:Secret. */
+  readonly clientToken?: Secret;
 }
 
 export interface VendasConfig {
@@ -70,8 +84,24 @@
     e.HOTMART_CLIENT_SECRET,
     e.HOTMART_CLIENT_SECRET_FILE,
   );
+  const clientToken = loadOptionalSecret(
+    "HOTMART_CLIENT_TOKEN",
+    e.HOTMART_CLIENT_TOKEN,
+    e.HOTMART_CLIENT_TOKEN_FILE,
+  );
+  if (clientToken !== undefined) {
+    const raw = clientToken
+      .reveal()
+      .trim()
+      .replace(/^Basic\s+/i, "");
+    if (raw === "" || /\s/.test(raw)) {
+      throw new ConfigError([{ key: "HOTMART_CLIENT_TOKEN", message: "token Basic invalido" }]);
+    }
+  }
   const hotmart =
-    clientId !== undefined && clientSecret !== undefined ? { clientId, clientSecret } : undefined;
+    clientId !== undefined && clientSecret !== undefined
+      ? { clientId, clientSecret, ...(clientToken === undefined ? {} : { clientToken }) }
+      : undefined;
   return {
     hotmartEnv: e.HOTMART_ENV,
     hotmart,

--- a/packages/config/src/vendas.test.ts
+++ b/packages/config/src/vendas.test.ts
@@ -1,6 +1,30 @@
 import assert from "node:assert/strict";
 import { test } from "node:test";
 import { ConfigError, loadVendasConfig } from "./index.js";
+
+test("vendas: Client Token fica protegido e exige credenciais completas", () => {
+  const base = { HOTMART_CLIENT_ID: "id", HOTMART_CLIENT_SECRET: "segredo" };
+  const c = loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "token-sentinela" });
+  assert.equal(c.hotmart?.clientToken?.reveal(), "token-sentinela");
+  assert.ok(!JSON.stringify(c).includes("token-sentinela"));
+  assert.throws(() => loadVendasConfig({ HOTMART_CLIENT_TOKEN: "token-sentinela" }), ConfigError);
+  assert.throws(
+    () =>
+      loadVendasConfig({
+        ...base,
+        HOTMART_CLIENT_TOKEN: "token-sentinela",
+        HOTMART_CLIENT_TOKEN_FILE: "/unused",
+      }),
+    ConfigError,
+  );
+  assert.throws(
+    () => loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "token\ninvalido" }),
+    (e: unknown) => e instanceof ConfigError && !e.message.includes("token\ninvalido"),
+  );
+  assert.doesNotThrow(() =>
+    loadVendasConfig({ ...base, HOTMART_CLIENT_TOKEN: "Basic token-sentinela" }),
+  );
+});
 
 test("vendas: sem nada configurado usa 30 min, 90 dias e fica sem Hotmart nem chave", () => {
   const c = loadVendasConfig({});

--- a/apps/api/src/vendas/hotmart-client.ts
+++ b/apps/api/src/vendas/hotmart-client.ts
@@ -131,10 +131,20 @@
     if (this.#token !== undefined && this.#token.expiraEm > this.#agora()) {
       return this.#token.valor;
     }
-    const basic = Buffer.from(
-      `${this.#credenciais.clientId.reveal()}:${this.#credenciais.clientSecret.reveal()}`,
-    ).toString("base64");
-    const resposta = await this.#chamar(`${URL_TOKEN}?grant_type=client_credentials`, {
+    const basic =
+      this.#credenciais.clientToken
+        ?.reveal()
+        .trim()
+        .replace(/^Basic\s+/i, "") ??
+      Buffer.from(
+        `${this.#credenciais.clientId.reveal()}:${this.#credenciais.clientSecret.reveal()}`,
+      ).toString("base64");
+    const params = new URLSearchParams({
+      grant_type: "client_credentials",
+      client_id: this.#credenciais.clientId.reveal(),
+      client_secret: this.#credenciais.clientSecret.reveal(),
+    });
+    const resposta = await this.#chamar(`${URL_TOKEN}?${params.toString()}`, {
       method: "POST",
       headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
     });

--- a/apps/api/src/vendas/hotmart-client.test.ts
+++ b/apps/api/src/vendas/hotmart-client.test.ts
@@ -62,6 +62,41 @@
 
 const janela = { de: new Date("2026-10-01T00:00:00Z"), ate: new Date("2026-11-01T00:00:00Z") };
 
+test("usa Client Token explicito no Basic sem codificar novamente nem duplicar prefixo", async () => {
+  for (const valor of ["token-fornecido", "Basic token-fornecido"]) {
+    const { impl, chamadas } = fetchFalso([() => json({ items: [] })]);
+    const c = new HotmartClient({
+      env: "production",
+      fetch: impl,
+      credenciais: {
+        clientId: new Secret(ID),
+        clientSecret: new Secret(SEGREDO),
+        clientToken: new Secret(valor),
+      },
+    });
+    await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
+    assert.equal(chamadas[0]?.headers["Authorization"], "Basic token-fornecido");
+    assert.ok(!chamadas[0].url.href.includes("token-fornecido"));
+    assert.equal(chamadas[1]?.headers["Authorization"], "Bearer tok-1");
+  }
+});
+
+test("sandbox usa o mesmo caminho de historico no host de testes da Hotmart", async () => {
+  const { impl, chamadas } = fetchFalso([() => json({ items: [] })]);
+  const c = new HotmartClient({
+    env: "sandbox",
+    fetch: impl,
+    credenciais: { clientId: new Secret(ID), clientSecret: new Secret(SEGREDO) },
+  });
+  await c.listarVendas(janela, "APPROVED", "k", async () => undefined);
+  const historico = chamadas[1];
+  assert.ok(historico);
+  assert.equal(
+    historico.url.origin + historico.url.pathname,
+    "https://sandbox.hotmart.com/payments/api/v1/sales/history",
+  );
+});
+
 test("normaliza o item e nao guarda e-mail nem nome do comprador", () => {
   const v = normalizarVenda(item("HP1"), "chave") as Venda;
   assert.equal(v.transacao, "HP1");
@@ -110,6 +145,16 @@
     `Basic ${Buffer.from(`${ID}:${SEGREDO}`).toString("base64")}`,
   );
   assert.equal(token.url.searchParams.get("grant_type"), "client_credentials");
+  assert.equal(
+    token.url.origin + token.url.pathname,
+    "https://api-sec-vlc.hotmart.com/security/oauth/token",
+  );
+  assert.equal(token.url.searchParams.get("client_id"), ID);
+  assert.equal(token.url.searchParams.get("client_secret"), SEGREDO);
+  assert.equal(
+    p1.url.origin + p1.url.pathname,
+    "https://developers.hotmart.com/payments/api/v1/sales/history",
+  );
   assert.equal(p1.url.searchParams.get("transaction_status"), "APPROVED");
   assert.equal(p1.url.searchParams.get("start_date"), String(janela.de.getTime()));
   assert.equal(p1.url.searchParams.get("page_token"), null);

--- a/apps/api/src/vendas/vendas.controller.ts
+++ b/apps/api/src/vendas/vendas.controller.ts
@@ -13,7 +13,11 @@
 import { ServicoPainelVendas } from "./painel.service.js";
 import { resolverPeriodo } from "./periodo.js";
 import { REPOSITORIO_VENDAS, type RepositorioVendas } from "./repositorio.js";
-import { SINCRONIZACAO_VENDAS, type SincronizacaoVendas } from "./sincronizacao.js";
+import {
+  SINCRONIZACAO_VENDAS,
+  type SincronizacaoVendas,
+  type ResultadoSincronizacao,
+} from "./sincronizacao.js";
 
 type Consulta = Record<string, unknown>;
 
@@ -94,4 +98,11 @@
     void this.sincronizacao.executar().catch(() => undefined);
     return this.painel.estadoSincronizacao();
   }
+
+  /** O botao do painel aguarda o resultado real antes de recarregar os indicadores. */
+  @Post("sincronizacao/atualizar")
+  @HttpCode(200)
+  atualizarPainel(): Promise<ResultadoSincronizacao> {
+    return this.sincronizacao.executar();
+  }
 }

--- a/apps/api/src/vendas/vendas.http.test.ts
+++ b/apps/api/src/vendas/vendas.http.test.ts
@@ -92,6 +92,17 @@
     });
     assert.equal(disparo.status, 202);
   });
+
+  test("atualizacao do painel exige bearer e retorna resultado da execucao", async () => {
+    const semAuth = await fetch(`${base}/v1/vendas/sincronizacao/atualizar`, { method: "POST" });
+    assert.equal(semAuth.status, 401);
+    const r = await fetch(`${base}/v1/vendas/sincronizacao/atualizar`, {
+      method: "POST",
+      headers: auth,
+    });
+    assert.equal(r.status, 200);
+    assert.deepEqual(await r.json(), { resultado: "desabilitada" });
+  });
 });
 
 test("sem chave de servico configurada as rotas fecham com 503", async () => {

--- a/apps/api/src/vendas/dominio.ts
+++ b/apps/api/src/vendas/dominio.ts
@@ -33,7 +33,8 @@
   "PRINTED_BILLET",
   "UNDER_ANALISYS",
   "STARTED",
-  "DELAYED",
+  "PRE_ORDER",
+  "PROCESSING_TRANSACTION",
   "OVERDUE",
   "PROTESTED",
   "BLOCKED",

--- a/apps/api/src/vendas/sincronizacao.test.ts
+++ b/apps/api/src/vendas/sincronizacao.test.ts
@@ -95,6 +95,9 @@
   assert.deepEqual(r, { resultado: "sucesso", processadas: 1, mensagem: null });
   assert.deepEqual(gravadas, ["A"]);
   assert.equal(consultas.length, STATUS_HOTMART.length);
+  assert.ok(consultas.some((c) => c.status === "PRE_ORDER"));
+  assert.ok(consultas.some((c) => c.status === "PROCESSING_TRANSACTION"));
+  assert.ok(consultas.every((c) => c.status !== "DELAYED"));
   assert.equal(consultas[0]?.de.getTime(), AGORA.getTime() - 90 * DIA);
   assert.equal(estado.status, "sucesso");
   assert.equal(estado.ultimoSucessoEm?.getTime(), AGORA.getTime());

--- a/apps/api/src/vendas/atualizacao.test.ts
+++ b/apps/api/src/vendas/atualizacao.test.ts
@@ -0,0 +1,33 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { VendasController } from "./vendas.controller.js";
+import type { ServicoPainelVendas } from "./painel.service.js";
+import type { RepositorioVendas } from "./repositorio.js";
+import type { ResultadoSincronizacao, SincronizacaoVendas } from "./sincronizacao.js";
+
+test("atualizar painel aguarda a gravacao e devolve o resultado, inclusive lock ocupado", async () => {
+  let concluir!: (r: ResultadoSincronizacao) => void;
+  const execucao = new Promise<ResultadoSincronizacao>((r) => {
+    concluir = r;
+  });
+  const controller = new VendasController(
+    {} as ServicoPainelVendas,
+    {} as RepositorioVendas,
+    { executar: () => execucao } as unknown as SincronizacaoVendas,
+  );
+  let terminou = false;
+  const resposta = controller.atualizarPainel().then((r) => {
+    terminou = true;
+    return r;
+  });
+  await Promise.resolve();
+  assert.equal(terminou, false);
+  concluir({ resultado: "sucesso", processadas: 2, mensagem: null });
+  assert.deepEqual(await resposta, { resultado: "sucesso", processadas: 2, mensagem: null });
+  const ocupada = new VendasController(
+    {} as ServicoPainelVendas,
+    {} as RepositorioVendas,
+    { executar: async () => ({ resultado: "ocupada" }) } as unknown as SincronizacaoVendas,
+  );
+  assert.deepEqual(await ocupada.atualizarPainel(), { resultado: "ocupada" });
+});

--- a/apps/web/lib/vendas-api.ts
+++ b/apps/web/lib/vendas-api.ts
@@ -31,14 +31,16 @@
 async function buscar<T>(
   caminho: string,
   valido: (x: unknown) => x is T,
+  method: "GET" | "POST" = "GET",
 ): Promise<ResultadoVendas<T>> {
   const cfg = configuracao();
   if (cfg === undefined) return { tipo: "nao-configurado" };
   try {
     const r = await fetch(`${cfg.base}${caminho}`, {
+      method,
       headers: { authorization: `Bearer ${cfg.chave}` },
       cache: "no-store",
-      signal: AbortSignal.timeout(TIMEOUT_MS),
+      signal: AbortSignal.timeout(method === "POST" ? 180_000 : TIMEOUT_MS),
     });
     if (r.status === 401) return { tipo: "erro", falha: "nao-autorizado" };
     if (r.status === 400) return { tipo: "erro", falha: "filtro-invalido" };
@@ -61,6 +63,22 @@
   ehObjeto(x["sincronizacao"]);
 
 const ehLista = (x: unknown): x is ListaVendas => ehObjeto(x) && Array.isArray(x["itens"]);
+
+export interface AtualizacaoVendas {
+  resultado: "sucesso" | "parcial" | "falha" | "ocupada" | "desabilitada";
+}
+
+function ehAtualizacao(x: unknown): x is AtualizacaoVendas {
+  return (
+    ehObjeto(x) &&
+    ["sucesso", "parcial", "falha", "ocupada", "desabilitada"].includes(String(x["resultado"]))
+  );
+}
+
+/** Chamada autenticada exclusivamente pelo servidor; nao leva credenciais ao navegador. */
+export function atualizarVendasAgora(): Promise<ResultadoVendas<AtualizacaoVendas>> {
+  return buscar("/v1/vendas/sincronizacao/atualizar", ehAtualizacao, "POST");
+}
 
 export function carregarPainel(filtros: FiltrosVendas): Promise<ResultadoVendas<PainelVendas>> {
   const q = paraQuery(filtros);

--- a/apps/web/lib/vendas-atualizacao.ts
+++ b/apps/web/lib/vendas-atualizacao.ts
@@ -0,0 +1,24 @@
+import { atualizarVendasAgora, MENSAGENS_FALHA } from "./vendas-api.ts";
+
+export interface EstadoAtualizacao {
+  erro: boolean;
+  mensagem: string;
+}
+
+const MENSAGENS = {
+  sucesso: "Vendas atualizadas com os dados mais recentes da Hotmart.",
+  parcial: "Atualização parcial. Alguns dados não puderam ser consultados na Hotmart.",
+  falha: "Não foi possível atualizar os dados da Hotmart. Confira o estado da sincronização.",
+  ocupada: "Já existe uma atualização em andamento. Aguarde e tente novamente.",
+  desabilitada: "Configure as credenciais da Hotmart na API para atualizar as vendas.",
+};
+
+/** Mantem mensagens fixas: nenhum corpo de erro externo e enviado ao cliente. */
+export async function executarAtualizacao(): Promise<EstadoAtualizacao> {
+  const r = await atualizarVendasAgora();
+  if (r.tipo === "nao-configurado") {
+    return { erro: true, mensagem: "O painel ainda não está conectado à API de vendas." };
+  }
+  if (r.tipo === "erro") return { erro: true, mensagem: MENSAGENS_FALHA[r.falha] };
+  return { erro: r.dados.resultado !== "sucesso", mensagem: MENSAGENS[r.dados.resultado] };
+}

--- a/apps/web/app/vendas-atualizacao.test.ts
+++ b/apps/web/app/vendas-atualizacao.test.ts
@@ -0,0 +1,39 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { executarAtualizacao } from "../lib/vendas-atualizacao.ts";
+
+test("atualizacao faz POST privado, aguarda resultado e distingue falhas", async (t) => {
+  const original = { ...process.env };
+  process.env["VENDAS_API_KEY"] = "sentinela-privada";
+  process.env["VENDAS_API_URL"] = "http://127.0.0.1:39999";
+  delete process.env["VENDAS_API_KEY_FILE"];
+  let resposta: unknown = { resultado: "sucesso" };
+  let status = 200;
+  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
+    assert.equal(url, "http://127.0.0.1:39999/v1/vendas/sincronizacao/atualizar");
+    assert.equal(init.method, "POST");
+    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sentinela-privada");
+    assert.equal(init.cache, "no-store");
+    return new Response(JSON.stringify(resposta), { status });
+  });
+  try {
+    assert.equal((await executarAtualizacao()).erro, false);
+    for (const resultado of ["parcial", "falha", "ocupada", "desabilitada"]) {
+      resposta = { resultado };
+      const r = await executarAtualizacao();
+      assert.equal(r.erro, true);
+      assert.ok(r.mensagem.length > 0);
+      assert.ok(!r.mensagem.includes("sentinela-privada"));
+    }
+    resposta = { resultado: "desconhecido", segredo: "sentinela-privada" };
+    assert.equal((await executarAtualizacao()).erro, true);
+    status = 401;
+    assert.match((await executarAtualizacao()).mensagem, /recusada/);
+    status = 503;
+    assert.equal((await executarAtualizacao()).erro, true);
+    delete process.env["VENDAS_API_KEY"];
+    assert.match((await executarAtualizacao()).mensagem, /conectado/);
+  } finally {
+    process.env = original;
+  }
+});

--- a/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
+++ b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
@@ -11,6 +11,7 @@
 import { Indicadores } from "./_components/Indicadores.tsx";
 import { Sincronizacao } from "./_components/Sincronizacao.tsx";
 import { UltimasVendas } from "./_components/UltimasVendas.tsx";
+import { AtualizarVendas } from "./_components/AtualizarVendas.tsx";
 
 export const metadata = {
   title: "Painel de vendas — NÚCLEOS",
@@ -31,15 +32,17 @@
       </nav>
       <header className="page-header">
         <h1>Painel de vendas</h1>
+        <AtualizarVendas
+          habilitada={painel.tipo === "ok" && painel.dados.sincronizacao.habilitada}
+        />
       </header>
 
       {painel.tipo === "nao-configurado" ? (
         <div className="state-box" role="status">
           <p>
-            O painel ainda não está conectado à API de vendas. Defina{" "}
-            <code>VENDAS_API_KEY</code> (chave de serviço no .env) e, se a API não
-            estiver em <code>http://127.0.0.1:3001</code>, <code>VENDAS_API_URL</code> no servidor
-            web.
+            O painel ainda não está conectado à API de vendas. Defina <code>VENDAS_API_KEY</code>{" "}
+            (chave de serviço no .env) e, se a API não estiver em <code>http://127.0.0.1:3001</code>
+            , <code>VENDAS_API_URL</code> no servidor web.
           </p>
         </div>
       ) : painel.tipo === "erro" ? (

--- a/apps/web/app/(app)/setores/financeiro/vendas/actions.ts
+++ b/apps/web/app/(app)/setores/financeiro/vendas/actions.ts
@@ -0,0 +1,13 @@
+"use server";
+
+import { revalidatePath } from "next/cache";
+import {
+  executarAtualizacao,
+  type EstadoAtualizacao,
+} from "../../../../../lib/vendas-atualizacao.ts";
+
+export async function atualizarPainel(): Promise<EstadoAtualizacao> {
+  const resultado = await executarAtualizacao();
+  revalidatePath("/setores/financeiro/vendas");
+  return resultado;
+}

--- a/apps/web/app/(app)/setores/financeiro/vendas/_components/AtualizarVendas.tsx
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/AtualizarVendas.tsx
@@ -0,0 +1,16 @@
+"use client";
+
+import { useActionState } from "react";
+import { atualizarPainel } from "../actions.ts";
+
+export function AtualizarVendas({ habilitada }: { habilitada: boolean }) {
+  const [estado, enviar, pendente] = useActionState(atualizarPainel, { erro: false, mensagem: "" });
+  return (
+    <form action={enviar} aria-busy={pendente}>
+      <button className="btn btn--primary" type="submit" disabled={pendente || !habilitada}>
+        {pendente ? "Atualizando vendas…" : "Atualizar agora"}
+      </button>
+      {estado.mensagem ? <p role={estado.erro ? "alert" : "status"}>{estado.mensagem}</p> : null}
+    </form>
+  );
+}
```
