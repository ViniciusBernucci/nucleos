# DEC-009 - Diffs da entrega (2026-10-26)

Registro principal: [2026-10-26-dec-009-object-storage.md](2026-10-26-dec-009-object-storage.md). Aqui ficam o diff unificado do commit de codigo da tarefa. Os arquivos de `documentacoes/` e `lessons/` nao entram no patch (regra de nao recursao) e sao listados no registro principal. Nenhum valor secreto aparece (nao houve `[REDACTED]`).

## Commit ae94179 - feat(dados): PoC de isolamento de object storage com MinIO efemero (DEC-009)

```diff
diff --git a/infrastructure/docker/poc-object-storage/poc.mjs b/infrastructure/docker/poc-object-storage/poc.mjs
new file mode 100644
index 0000000..db397f1
--- /dev/null
+++ b/infrastructure/docker/poc-object-storage/poc.mjs
@@ -0,0 +1,302 @@
+// PoC DEC-009 (ADR-023): isolamento entre tenants em object storage S3-compativel (MinIO local).
+// Executado por run-poc.sh. Nao imprime segredos; so codigos HTTP/S3 e verificacoes.
+import { execFile } from "node:child_process";
+import { randomBytes } from "node:crypto";
+import { appendFileSync, writeFileSync } from "node:fs";
+import { promisify } from "node:util";
+import { pegarUrl, S3 } from "./sigv4.mjs";
+import {
+  ChaveInvalida,
+  construirChave,
+  politicaBucketDoTenant,
+  politicaPrefixoDoTenant,
+  TTL_MAXIMO_SEGUNDOS,
+  validarChaveDoTenant,
+  validarTtl,
+} from "./politica.mjs";
+
+const execFileAsync = promisify(execFile);
+const { POC_PORT, POC_TMP, POC_CONTAINER, POC_VOLUME, POC_MC_IMAGE, POC_HELPER_IMAGE } = process.env;
+const ENDPOINT = `http://127.0.0.1:${POC_PORT}`;
+const SEGREDOS = `${POC_TMP}/segredos.txt`;
+
+let ok = 0;
+let falha = 0;
+function verificar(nome, condicao, detalhe = "") {
+  if (condicao) ok += 1;
+  else falha += 1;
+  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}${detalhe ? ` [${detalhe}]` : ""}`);
+}
+const negado = (r) => r.status === 403 && r.codigo === "AccessDenied";
+const resumo = (r) => `${r.status} ${r.codigo ?? "-"}`;
+
+async function mc(...args) {
+  const { stdout } = await execFileAsync("docker", [
+    "run", "--rm", "--network", `container:${POC_CONTAINER}`, "--user", `${process.getuid()}`,
+    "-v", `${POC_TMP}/mc:/mc`, POC_MC_IMAGE, "--config-dir", "/mc", ...args,
+  ]);
+  return stdout;
+}
+const segredo = () => {
+  const v = randomBytes(20).toString("hex");
+  appendFileSync(SEGREDOS, `${v}\n`);
+  return v;
+};
+const sufixo = () => randomBytes(3).toString("hex");
+
+async function criarUsuario(prefixo, politicaNome, politica) {
+  const chave = `${prefixo}-${sufixo()}`;
+  const sec = segredo();
+  writeFileSync(`${POC_TMP}/mc/${politicaNome}.json`, JSON.stringify(politica));
+  await mc("admin", "policy", "create", "local", politicaNome, `/mc/${politicaNome}.json`);
+  await mc("admin", "user", "add", "local", chave, sec);
+  await mc("admin", "policy", "attach", "local", politicaNome, "--user", chave);
+  return new S3({ endpoint: ENDPOINT, accessKey: chave, secretKey: sec });
+}
+
+const DOC_A = "11111111-1111-4111-8111-111111111111";
+const DOC_B = "22222222-2222-4222-8222-222222222222";
+const chaveDe = (tenantId, documentId, nome = "contrato.txt") =>
+  construirChave({ tenantId, departamento: "juridico", documentId, nome });
+
+// ---------------------------------------------------------------- Modelo P: bucket por tenant
+async function modeloP() {
+  console.log("== Modelo P: bucket por tenant + credencial restrita ao bucket");
+  const [bA, bB] = ["p-tenant-a", "p-tenant-b"];
+  await mc("mb", `local/${bA}`);
+  await mc("mb", `local/${bB}`);
+  const a = await criarUsuario("pa", "pol-p-a", politicaBucketDoTenant(bA));
+  const b = await criarUsuario("pb", "pol-p-b", politicaBucketDoTenant(bB));
+  const kA = chaveDe("tenant-a", DOC_A);
+  const kB = chaveDe("tenant-b", DOC_B);
+
+  verificar("P: A grava e le o proprio objeto", (await a.put(bA, kA, "dado-do-A")).status === 200 && (await a.get(bA, kA)).texto === "dado-do-A");
+  verificar("P: B grava e le o proprio objeto", (await b.put(bB, kB, "dado-do-B")).status === 200 && (await b.get(bB, kB)).texto === "dado-do-B");
+  let r = await a.get(bB, kB);
+  verificar("P: A le objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.put(bB, kB, "sobrescrita-do-A");
+  verificar("P: A sobrescreve objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.del(bB, kB);
+  verificar("P: A apaga objeto de B -> AccessDenied", negado(r), resumo(r));
+  verificar("P: objeto de B intacto apos ataques de A", (await b.get(bB, kB)).texto === "dado-do-B");
+  r = await a.list(bB);
+  verificar("P: A lista bucket de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.get(bB, chaveDe("tenant-b", "33333333-3333-4333-8333-333333333333", "inexistente.txt"));
+  verificar("P: A le chave inexistente em B -> AccessDenied (sem oraculo de existencia, T-F9-I)", negado(r), resumo(r));
+  r = await a.listarBuckets();
+  verificar("P: A lista buckets da conta e ve somente o proprio (MinIO filtra por permissao)", r.status === 200 && r.texto.includes(bA) && !r.texto.includes(bB), resumo(r));
+  r = await a.list(bA);
+  verificar("P: A lista o proprio bucket e ve so a propria chave", r.status === 200 && r.texto.includes(kA) && !r.texto.includes(kB));
+  r = await new S3({ endpoint: ENDPOINT, accessKey: a.accessKey, secretKey: "x".repeat(40) }).get(bA, kA);
+  verificar("P: segredo errado -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
+  r = await a.pedido("GET", `/${bA}/${kA}`, { anonimo: true });
+  verificar("P: pedido anonimo -> AccessDenied", negado(r), resumo(r));
+
+  // URLs pre-assinadas (T-F9-S)
+  const urlA = a.presign("GET", bA, kA, 60);
+  r = await pegarUrl(urlA);
+  verificar("P: URL pre-assinada de A funciona sem credencial", r.status === 200 && r.texto === "dado-do-A");
+  r = await pegarUrl(urlA.replace(kA, kB).replace(bA, bB));
+  verificar("P: URL de A adulterada para chave/bucket de B -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
+  r = await pegarUrl(a.presign("GET", bB, kB, 60));
+  verificar("P: URL que A assina para objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await pegarUrl(a.presign("PUT", bB, kB, 60), "PUT", "x");
+  verificar("P: URL de PUT que A assina para B -> AccessDenied", negado(r), resumo(r));
+  r = await pegarUrl(urlA, "DELETE");
+  verificar("P: URL de GET reutilizada como DELETE -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
+  const curta = a.presign("GET", bA, kA, 1);
+  await new Promise((res) => setTimeout(res, 2500));
+  r = await pegarUrl(curta);
+  verificar("P: URL expirada (1 s) -> AccessDenied", negado(r), resumo(r));
+
+  // Revogacao de A sem afetar B (AC-2)
+  const urlViva = a.presign("GET", bA, kA, 300);
+  verificar("P: antes da revogacao a URL de A (300 s) funciona", (await pegarUrl(urlViva)).status === 200);
+  await mc("admin", "user", "remove", "local", a.accessKey);
+  r = await a.get(bA, kA);
+  verificar("P: apos revogar A, a chave de A e recusada", r.status === 403, resumo(r));
+  r = await pegarUrl(urlViva);
+  verificar("P: apos revogar A, URL ja assinada por A (ainda dentro do TTL) tambem e recusada", r.status === 403, resumo(r));
+  verificar("P: apos revogar A, B continua lendo e gravando", (await b.get(bB, kB)).texto === "dado-do-B" && (await b.put(bB, kB, "dado-do-B-v2")).status === 200);
+  const a2 = await criarUsuario("pa", "pol-p-a2", politicaBucketDoTenant(bA));
+  verificar("P: nova chave de A (rotacao) le o dado antigo de A", (await a2.get(bA, kA)).texto === "dado-do-A");
+}
+
+// ------------------------------------------------- Modelo S: bucket compartilhado + prefixo
+async function modeloS() {
+  console.log("== Modelo S: bucket compartilhado, credencial por prefixo");
+  const bucket = "s-compartilhado";
+  await mc("mb", `local/${bucket}`);
+  const a = await criarUsuario("sa", "pol-s-a", politicaPrefixoDoTenant(bucket, "a"));
+  const ab = await criarUsuario("sab", "pol-s-ab", politicaPrefixoDoTenant(bucket, "ab"));
+  const b = await criarUsuario("sb", "pol-s-b", politicaPrefixoDoTenant(bucket, "b"));
+  const kA = chaveDe("a", DOC_A);
+  const kAB = chaveDe("ab", DOC_A);
+  const kB = chaveDe("b", DOC_B);
+  for (const [c, k, v] of [[a, kA, "dado-a"], [ab, kAB, "dado-ab"], [b, kB, "dado-b"]]) {
+    verificar(`S: ${k.split("/")[1]} grava o proprio objeto`, (await c.put(bucket, k, v)).status === 200);
+  }
+  let r = await a.get(bucket, kB);
+  verificar("S: A le objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.put(bucket, kB, "x");
+  verificar("S: A sobrescreve objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.get(bucket, kAB);
+  verificar("S: confusao de prefixo: A (tenants/a/) le tenants/ab/ -> AccessDenied", negado(r), resumo(r));
+  r = await ab.get(bucket, kA);
+  verificar("S: confusao de prefixo inversa: AB le tenants/a/ -> AccessDenied", negado(r), resumo(r));
+  r = await a.list(bucket, "tenants/");
+  verificar("S: A lista o prefixo raiz tenants/ -> AccessDenied", negado(r), resumo(r));
+  r = await a.list(bucket, "");
+  verificar("S: A lista o bucket sem prefixo -> AccessDenied", negado(r), resumo(r));
+  r = await a.list(bucket, "tenants/b/");
+  verificar("S: A lista o prefixo de B -> AccessDenied", negado(r), resumo(r));
+  r = await a.list(bucket, "tenants/a/");
+  verificar("S: A lista o proprio prefixo e ve so as proprias chaves", r.status === 200 && r.texto.includes(kA) && !r.texto.includes(kAB) && !r.texto.includes(kB));
+  r = await a.get(bucket, "tenants/b/juridico/inexistente");
+  verificar("S: A le chave inexistente no prefixo de B -> AccessDenied (sem oraculo)", negado(r), resumo(r));
+  r = await a.put(bucket, "tenants/a/juridico/x/..%2F..%2F..%2Fb%2Fjuridico%2Fy", "x");
+  const confinada = r.status === 200 ? (await b.get(bucket, "tenants/b/juridico/y")).status === 404 || (await b.get(bucket, "tenants/b/juridico/y")).status === 403 : true;
+  verificar("S: chave com '..%2F' literal nao escapa do prefixo de A (recusada ou confinada)", confinada, resumo(r));
+  r = await pegarUrl(a.presign("GET", bucket, kB, 60));
+  verificar("S: URL que A assina para objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await pegarUrl(a.presign("GET", bucket, kA, 60).replace(kA, kB));
+  verificar("S: URL de A adulterada para B -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
+  await mc("admin", "user", "remove", "local", a.accessKey);
+  verificar("S: apos revogar A, A e recusado e B segue funcionando", (await a.get(bucket, kA)).status === 403 && (await b.get(bucket, kB)).texto === "dado-b");
+}
+
+// ------------- Modelo T: credencial temporaria por chamada, escopada ao prefixo (STS do MinIO)
+async function modeloT() {
+  console.log("== Modelo T: servico de storage assume papel com politica de sessao por tenant");
+  const bucket = "t-compartilhado";
+  await mc("mb", `local/${bucket}`);
+  const ampla = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`] }] };
+  const plataforma = await criarUsuario("plat", "pol-t-plataforma", ampla);
+  const kA = chaveDe("a", DOC_A);
+  const kB = chaveDe("b", DOC_B);
+  await plataforma.put(bucket, kA, "dado-a");
+  await plataforma.put(bucket, kB, "dado-b");
+  verificar("T: a credencial da plataforma e ampla (le A e B): por isso nunca sai do servico", (await plataforma.get(bucket, kB)).texto === "dado-b");
+
+  const tA = await plataforma.assumirPapel(politicaPrefixoDoTenant(bucket, "a"));
+  verificar("T: AssumeRole com politica de sessao de A funciona", tA instanceof S3, tA.erro ? resumo(tA.erro) : "");
+  verificar("T: credencial temporaria de A le/grava o proprio prefixo", (await tA.get(bucket, kA)).texto === "dado-a" && (await tA.put(bucket, chaveDe("a", DOC_B, "novo.txt"), "n")).status === 200);
+  let r = await tA.get(bucket, kB);
+  verificar("T: credencial temporaria de A le objeto de B -> AccessDenied", negado(r), resumo(r));
+  r = await tA.list(bucket, "tenants/b/");
+  verificar("T: credencial temporaria de A lista prefixo de B -> AccessDenied", negado(r), resumo(r));
+  r = await pegarUrl(tA.presign("GET", bucket, kB, 60));
+  verificar("T: URL pre-assinada com credencial temporaria de A para B -> AccessDenied", negado(r), resumo(r));
+  r = await pegarUrl(tA.presign("GET", bucket, kA, 60));
+  verificar("T: URL pre-assinada com credencial temporaria de A para A funciona", r.status === 200 && r.texto === "dado-a");
+
+  // Politica de sessao so reduz: pedir mais que a politica-pai nao amplia.
+  const outra = await criarUsuario("fraca", "pol-t-fraca", politicaPrefixoDoTenant(bucket, "a"));
+  const tAmpliada = await outra.assumirPapel(ampla);
+  verificar("T: politica de sessao nao amplia a politica do usuario (le B -> AccessDenied)", tAmpliada instanceof S3 && negado(await tAmpliada.get(bucket, kB)));
+
+  // Revogacao: remover o usuario-pai invalida as credenciais temporarias derivadas?
+  const tFraca = await outra.assumirPapel(politicaPrefixoDoTenant(bucket, "a"));
+  const antes = (await tFraca.get(bucket, kA)).status;
+  await mc("admin", "user", "remove", "local", outra.accessKey);
+  const depois = await tFraca.get(bucket, kA);
+  verificar("T: remover o usuario-pai invalida a credencial temporaria derivada", antes === 200 && depois.status === 403, `antes=${antes} depois=${resumo(depois)}`);
+}
+
+// ------------------------------------------------------ Guardas do servidor (politica.mjs)
+function guardas() {
+  console.log("== Guardas do servico de storage (antes de qualquer chamada ao provedor)");
+  const rejeita = (nome, fn) => {
+    let rejeitou = false;
+    try {
+      fn();
+    } catch (e) {
+      rejeitou = e instanceof ChaveInvalida;
+    }
+    verificar(`guarda: ${nome}`, rejeitou);
+  };
+  const kA = chaveDe("a", DOC_A);
+  verificar("guarda: chave valida do proprio tenant aceita", validarChaveDoTenant("a", kA) === kA);
+  rejeita("chave de outro tenant", () => validarChaveDoTenant("a", chaveDe("b", DOC_B)));
+  rejeita("prefixo parecido (tenant 'ab' vs 'a')", () => validarChaveDoTenant("a", chaveDe("ab", DOC_A)));
+  rejeita("'..' como segmento", () => validarChaveDoTenant("a", `tenants/a/juridico/${DOC_A}/..`));
+  rejeita("travessia '../'", () => validarChaveDoTenant("a", `tenants/a/../b/juridico/${DOC_B}/x`));
+  rejeita("chave absoluta", () => validarChaveDoTenant("a", `/${kA}`));
+  rejeita("byte nulo", () => validarChaveDoTenant("a", `${kA}\0`));
+  rejeita("barra invertida", () => validarChaveDoTenant("a", kA.replace("juridico", "juri\\dico")));
+  rejeita("segmento extra", () => validarChaveDoTenant("a", `${kA}/extra`));
+  rejeita("tenant com maiuscula/ponto", () => construirChave({ tenantId: "A.B", departamento: "x", documentId: DOC_A, nome: "f" }));
+  rejeita("document_id que nao e UUID", () => construirChave({ tenantId: "a", departamento: "x", documentId: "../b", nome: "f" }));
+  rejeita("nome so com '..'", () => construirChave({ tenantId: "a", departamento: "x", documentId: DOC_A, nome: ".." }));
+  const k = construirChave({ tenantId: "a", departamento: "x", documentId: DOC_A, nome: "../../etc/passwd" });
+  verificar("guarda: nome com caminho e reduzido ao nome-base", k.endsWith("/passwd") && !k.includes(".."), k);
+  rejeita("TTL 0", () => validarTtl(0));
+  rejeita(`TTL ${TTL_MAXIMO_SEGUNDOS + 1}`, () => validarTtl(TTL_MAXIMO_SEGUNDOS + 1));
+  verificar("guarda: TTL 300 aceito", validarTtl(300) === 300);
+}
+
+// ------------------------------------ Versionamento, object lock e criptografia em repouso
+async function backupECriptografia() {
+  console.log("== Versionamento, object lock e criptografia em repouso (MinIO)");
+  const bucket = "lock-bucket";
+  const livre = "versao-bucket";
+  await mc("mb", "--with-lock", `local/${bucket}`);
+  await mc("retention", "set", "--default", "GOVERNANCE", "1d", `local/${bucket}`);
+  await mc("mb", `local/${livre}`);
+  await mc("version", "enable", `local/${livre}`);
+  const total = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`, `arn:aws:s3:::${livre}`, `arn:aws:s3:::${livre}/*`] }] };
+  const u = await criarUsuario("lock", "pol-lock", total);
+  let r = await u.put(bucket, "obj", "v1");
+  const vLock = r.cab["x-amz-version-id"];
+  verificar("lock: PUT em bucket com object lock devolve versionId", r.status === 200 && Boolean(vLock));
+  r = await u.del(bucket, "obj", vLock);
+  const msg = /<Message>([^<]+)<\/Message>/.exec(r.texto)?.[1] ?? "";
+  verificar("lock: apagar a versao retida (GOVERNANCE) sem bypass e recusado", r.status >= 400 && /WORM|retention|bypass|locked/i.test(msg), `${resumo(r)} ${msg}`);
+  r = await u.pedido("GET", `/${bucket}/obj`, { consulta: { versionId: vLock } });
+  verificar("lock: a versao retida continua legivel", r.status === 200 && r.texto === "v1");
+  r = await u.put(livre, "obj", "v1");
+  const vLivre = r.cab["x-amz-version-id"];
+  await u.put(livre, "obj", "v2");
+  r = await u.del(livre, "obj");
+  verificar("versionamento: DELETE simples cria delete marker (dado recuperavel)", r.status === 204 && r.cab["x-amz-delete-marker"] === "true", resumo(r));
+  r = await u.get(livre, "obj");
+  verificar("versionamento: objeto some da leitura corrente (404)", r.status === 404, resumo(r));
+  const v1 = await u.pedido("GET", `/${livre}/obj`, { consulta: { versionId: vLivre } });
+  verificar("versionamento: a versao antiga continua recuperavel por versionId", v1.status === 200 && v1.texto === "v1");
+
+  // Criptografia em repouso (SSE-S3 do MinIO) com controle negativo/positivo.
+  await mc("mb", "local/enc-bucket");
+  await mc("encrypt", "set", "sse-s3", "local/enc-bucket");
+  await mc("mb", "local/claro-bucket");
+  const sentinela = `SENTINELA-${randomBytes(8).toString("hex")}`;
+  const e = await criarUsuario("enc", "pol-enc", { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: ["arn:aws:s3:::enc-bucket", "arn:aws:s3:::enc-bucket/*", "arn:aws:s3:::claro-bucket", "arn:aws:s3:::claro-bucket/*"] }] });
+  await e.put("enc-bucket", "obj", sentinela);
+  await e.put("claro-bucket", "obj", sentinela);
+  const lido = await e.get("enc-bucket", "obj");
+  verificar("SSE-S3: leitura via API devolve o texto original", lido.texto === sentinela);
+  const buscar = async (pasta) => {
+    try {
+      const { stdout } = await execFileAsync("docker", ["run", "--rm", "-v", `${POC_VOLUME}:/d:ro`, POC_HELPER_IMAGE, "grep", "-rlF", sentinela, `/d/${pasta}`]);
+      return stdout.trim() !== "";
+    } catch {
+      return false; // grep sai com 1 quando nao encontra
+    }
+  };
+  verificar("SSE-S3: controle positivo - bucket sem criptografia guarda o texto em claro no disco", await buscar("claro-bucket"));
+  verificar("SSE-S3: bucket com SSE-S3 NAO guarda o texto em claro no disco", !(await buscar("enc-bucket")));
+}
+
+// ---------------------------------------------------------------------------------- main
+writeFileSync(SEGREDOS, "");
+try {
+  guardas();
+  await modeloP();
+  await modeloS();
+  await modeloT();
+  await backupECriptografia();
+} catch (e) {
+  falha += 1;
+  console.log(`FALHA excecao: ${e instanceof Error ? e.message.split("\n")[0] : "desconhecida"}`);
+}
+console.log(`== resultado: ${ok} OK, ${falha} FALHA`);
+process.exit(falha === 0 ? 0 : 1);
diff --git a/infrastructure/docker/poc-object-storage/politica.mjs b/infrastructure/docker/poc-object-storage/politica.mjs
new file mode 100644
index 0000000..3e3a7f5
--- /dev/null
+++ b/infrastructure/docker/poc-object-storage/politica.mjs
@@ -0,0 +1,82 @@
+// Proposta de politica do servico de storage (ADR-023, DEC-009). Funcoes puras, sem E/S.
+// O servidor constroi a chave; nada vindo do cliente ou do LLM vira chave sem passar por aqui.
+
+export const TTL_MAXIMO_SEGUNDOS = 300; // ENT-DAT-006: URL assinada de curta duracao (<= 5 min)
+const TENANT = /^[a-z0-9][a-z0-9-]{0,62}$/; // mesma allowlist do ADR-020
+const DEPARTAMENTO = /^[a-z0-9][a-z0-9_-]{0,31}$/;
+const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
+
+export class ChaveInvalida extends Error {}
+
+export function nomeSeguro(bruto) {
+  if (typeof bruto !== "string") throw new ChaveInvalida("nome nao e texto");
+  const base = bruto.split(/[\\/]/).pop() ?? "";
+  const limpo = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100);
+  if (limpo === "" || limpo.includes("..")) throw new ChaveInvalida("nome invalido");
+  return limpo;
+}
+
+// `tenantId` vem da sessao/identidade ja verificada (nunca do corpo da requisicao).
+export function construirChave({ tenantId, departamento, documentId, nome }) {
+  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
+  if (!DEPARTAMENTO.test(departamento)) throw new ChaveInvalida("departamento invalido");
+  if (!UUID.test(documentId)) throw new ChaveInvalida("document_id invalido");
+  return `tenants/${tenantId}/${departamento}/${documentId}/${nomeSeguro(nome)}`;
+}
+
+// Valida uma chave ja existente (ex.: lida do banco) contra o tenant autenticado.
+export function validarChaveDoTenant(tenantId, chave) {
+  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
+  if (typeof chave !== "string" || /[\0\\]/.test(chave) || chave.startsWith("/")) {
+    throw new ChaveInvalida("caracteres proibidos");
+  }
+  const partes = chave.split("/");
+  if (partes.length !== 5 || partes.some((p) => p === "" || p === "." || p === "..")) {
+    throw new ChaveInvalida("formato");
+  }
+  const [raiz, dono, dep, doc, nome] = partes;
+  if (raiz !== "tenants" || dono !== tenantId) throw new ChaveInvalida("chave de outro tenant");
+  if (!DEPARTAMENTO.test(dep) || !UUID.test(doc) || nomeSeguro(nome) !== nome) {
+    throw new ChaveInvalida("segmento invalido");
+  }
+  return chave;
+}
+
+export function validarTtl(segundos) {
+  if (!Number.isInteger(segundos) || segundos < 1 || segundos > TTL_MAXIMO_SEGUNDOS) {
+    throw new ChaveInvalida(`ttl fora de 1..${TTL_MAXIMO_SEGUNDOS}`);
+  }
+  return segundos;
+}
+
+const ARN = (rec) => `arn:aws:s3:::${rec}`;
+
+// Modelo P: bucket dedicado por tenant. Credencial so enxerga o proprio bucket.
+export function politicaBucketDoTenant(bucket) {
+  return {
+    Version: "2012-10-17",
+    Statement: [
+      { Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: [ARN(`${bucket}/*`)] },
+      { Effect: "Allow", Action: ["s3:ListBucket"], Resource: [ARN(bucket)] },
+    ],
+  };
+}
+
+// Modelo S/T: bucket compartilhado, escopo por prefixo. A barra final em `tenants/<id>/`
+// evita a confusao de prefixo (tenant `a` x tenant `ab`).
+export function politicaPrefixoDoTenant(bucket, tenantId) {
+  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
+  const prefixo = `tenants/${tenantId}/`;
+  return {
+    Version: "2012-10-17",
+    Statement: [
+      { Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: [ARN(`${bucket}/${prefixo}*`)] },
+      {
+        Effect: "Allow",
+        Action: ["s3:ListBucket"],
+        Resource: [ARN(bucket)],
+        Condition: { StringLike: { "s3:prefix": [`${prefixo}*`] } },
+      },
+    ],
+  };
+}
diff --git a/infrastructure/docker/poc-object-storage/run-poc.sh b/infrastructure/docker/poc-object-storage/run-poc.sh
new file mode 100755
index 0000000..6965e43
--- /dev/null
+++ b/infrastructure/docker/poc-object-storage/run-poc.sh
@@ -0,0 +1,77 @@
+#!/usr/bin/env bash
+# PoC DEC-009 (ADR-023): MinIO em container efemero (127.0.0.1), sem dados reais, destruido ao final.
+# Prova isolamento entre tenants (bucket por tenant, prefixo, credencial temporaria), revogacao,
+# versionamento/object lock e criptografia em repouso. Uso: infrastructure/docker/poc-object-storage/run-poc.sh
+# Requer docker, node >= 24, openssl. Imagens: MINIO_IMAGE e MC_IMAGE (padrao: ja presentes localmente).
+set -euo pipefail
+
+AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+export POC_TMP POC_PORT POC_CONTAINER POC_VOLUME POC_MC_IMAGE POC_HELPER_IMAGE
+POC_TMP="$(mktemp -d)"
+POC_CONTAINER="poc-object-storage-$$"
+POC_VOLUME="poc-object-storage-vol-$$"
+POC_PORT="${POC_PORT:-19000}"
+POC_MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"
+POC_HELPER_IMAGE="${HELPER_IMAGE:-nginx:1.28-alpine}"
+MINIO_IMAGE="${MINIO_IMAGE:-cgr.dev/chainguard/minio:latest}"
+SAIDA="$POC_TMP/saida.txt"
+
+limpar() {
+  local rc=$?
+  docker rm -f -v "$POC_CONTAINER" >/dev/null 2>&1 || true
+  docker volume rm -f "$POC_VOLUME" >/dev/null 2>&1 || true
+  rm -rf "$POC_TMP"
+  echo "== limpeza: container, volume e segredos temporarios removidos (rc=$rc)"
+  docker ps -a --filter "name=poc-object-storage" --format 'RESTO: {{.Names}}' || true
+  docker volume ls --filter "name=poc-object-storage" --format 'RESTO: {{.Name}}' || true
+  exit "$rc"
+}
+trap limpar EXIT
+
+umask 077
+mkdir -p "$POC_TMP/mc" "$POC_TMP/secrets"
+ROOT_USER="root$(openssl rand -hex 4)"
+ROOT_SECRET="$(openssl rand -hex 20)"
+printf '%s' "$ROOT_USER" > "$POC_TMP/secrets/root-user"
+printf '%s' "$ROOT_SECRET" > "$POC_TMP/secrets/root-password"
+printf 'poc-key:%s' "$(openssl rand -base64 32)" > "$POC_TMP/secrets/kms-key"
+chmod 0755 "$POC_TMP" "$POC_TMP/secrets"; chmod 0644 "$POC_TMP"/secrets/*   # efemeros; leitura pelo usuario do container
+printf '{"version":"10","aliases":{"local":{"url":"http://127.0.0.1:9000","accessKey":"%s","secretKey":"%s","api":"S3v4","path":"auto"}}}' \
+  "$ROOT_USER" "$ROOT_SECRET" > "$POC_TMP/mc/config.json"
+chmod 0755 "$POC_TMP/mc"; chmod 0644 "$POC_TMP/mc/config.json"
+
+echo "== imagens"
+docker image inspect --format '{{index .RepoTags 0}} {{.Id}}' "$MINIO_IMAGE" "$POC_MC_IMAGE"
+docker run --rm "$MINIO_IMAGE" --version | head -n 1
+echo "== subindo MinIO (porta somente em 127.0.0.1:$POC_PORT; segredos por arquivo, nao por ambiente)"
+docker volume create "$POC_VOLUME" >/dev/null
+docker run -d --name "$POC_CONTAINER" -p "127.0.0.1:$POC_PORT:9000" \
+  -v "$POC_VOLUME:/data" -v "$POC_TMP/secrets:/run/poc:ro" \
+  -e MINIO_ROOT_USER_FILE=/run/poc/root-user -e MINIO_ROOT_PASSWORD_FILE=/run/poc/root-password \
+  -e MINIO_KMS_SECRET_KEY_FILE=/run/poc/kms-key -e MINIO_BROWSER=off \
+  "$MINIO_IMAGE" server /data --address ":9000" >/dev/null
+for _ in $(seq 1 60); do
+  curl -fsS "http://127.0.0.1:$POC_PORT/minio/health/ready" >/dev/null 2>&1 && break
+  sleep 1
+done
+curl -fsS "http://127.0.0.1:$POC_PORT/minio/health/ready" >/dev/null
+echo "== portas publicadas (todas devem ser 127.0.0.1)"
+docker port "$POC_CONTAINER"
+if docker port "$POC_CONTAINER" | grep -v '127.0.0.1'; then echo "FALHA: porta fora de 127.0.0.1"; exit 1; fi
+echo "== env do container nao contem valor de segredo (somente caminhos *_FILE)"
+docker inspect "$POC_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'MINIO_' | sed -E 's/=.*_?(\/run\/poc\/.*)$/=\1/'
+
+echo "== PoC"
+set +e
+node "$AQUI/poc.mjs" 2>&1 | tee "$SAIDA"
+rc=${PIPESTATUS[0]}
+set -e
+
+echo "== varredura de vazamento: nenhum segredo gerado aparece na saida"
+SEGREDOS=("$ROOT_SECRET")
+while IFS= read -r s; do [ -n "$s" ] && SEGREDOS+=("$s"); done < "$POC_TMP/segredos.txt"
+vazou=0
+for s in "${SEGREDOS[@]}"; do grep -qF -- "$s" "$SAIDA" && vazou=1; done
+echo "segredos verificados: ${#SEGREDOS[@]}; vazamento: $vazou"
+[ "$vazou" -eq 0 ] || rc=1
+exit "$rc"
diff --git a/infrastructure/docker/poc-object-storage/sigv4.mjs b/infrastructure/docker/poc-object-storage/sigv4.mjs
new file mode 100644
index 0000000..8f1f10e
--- /dev/null
+++ b/infrastructure/docker/poc-object-storage/sigv4.mjs
@@ -0,0 +1,137 @@
+// Cliente S3 minimo (AWS Signature V4) sem dependencias, so para o PoC DEC-009.
+// Suporta PUT/GET/DELETE/HEAD/LIST, URL pre-assinada, credencial temporaria (session token)
+// e o STS AssumeRole do MinIO. Nao e codigo de producao: producao usa SDK mantido.
+import { createHash, createHmac } from "node:crypto";
+
+const sha256 = (dados) => createHash("sha256").update(dados).digest("hex");
+const hmac = (chave, dados) => createHmac("sha256", chave).update(dados).digest();
+const enc = (s) =>
+  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
+const encCaminho = (p) => p.split("/").map(enc).join("/");
+
+function stamp(agora = new Date()) {
+  const amz = agora.toISOString().replace(/[:-]|\.\d{3}/g, "");
+  return { amz, dia: amz.slice(0, 8) };
+}
+
+function chaveAssinatura(secret, dia, regiao, servico) {
+  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dia), regiao), servico), "aws4_request");
+}
+
+function consultaCanonica(params) {
+  return Object.keys(params)
+    .sort()
+    .map((k) => `${enc(k)}=${enc(params[k])}`)
+    .join("&");
+}
+
+export class S3 {
+  constructor({ endpoint, accessKey, secretKey, sessionToken, regiao = "us-east-1" }) {
+    this.url = new URL(endpoint);
+    this.accessKey = accessKey;
+    this.secretKey = secretKey;
+    this.sessionToken = sessionToken;
+    this.regiao = regiao;
+  }
+
+  // Assinatura por cabecalhos (Authorization). `anonimo` envia sem assinar (caso negativo).
+  async pedido(metodo, caminho, { consulta = {}, corpo, anonimo = false, servico = "s3", cabecalhos = {} } = {}) {
+    const dados = corpo === undefined ? "" : corpo;
+    const { amz, dia } = stamp();
+    const hash = sha256(dados);
+    const h = { host: this.url.host, "x-amz-content-sha256": hash, "x-amz-date": amz, ...cabecalhos };
+    if (this.sessionToken) h["x-amz-security-token"] = this.sessionToken;
+    const nomes = Object.keys(h).map((k) => k.toLowerCase()).sort();
+    const canonCab = nomes.map((k) => `${k}:${String(h[Object.keys(h).find((x) => x.toLowerCase() === k)]).trim()}\n`).join("");
+    const assinados = nomes.join(";");
+    const canon = [metodo, encCaminho(caminho), consultaCanonica(consulta), canonCab, assinados, hash].join("\n");
+    const escopo = `${dia}/${this.regiao}/${servico}/aws4_request`;
+    const aAssinar = ["AWS4-HMAC-SHA256", amz, escopo, sha256(canon)].join("\n");
+    const assinatura = createHmac("sha256", chaveAssinatura(this.secretKey, dia, this.regiao, servico))
+      .update(aAssinar)
+      .digest("hex");
+    const cab = { ...h };
+    delete cab.host;
+    if (!anonimo) {
+      cab.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${escopo}, SignedHeaders=${assinados}, Signature=${assinatura}`;
+    }
+    const q = consultaCanonica(consulta);
+    const alvo = `${this.url.origin}${encCaminho(caminho)}${q ? `?${q}` : ""}`;
+    return resposta(await fetch(alvo, { method: metodo, headers: cab, body: dados === "" ? undefined : dados }));
+  }
+
+  put(bucket, chave, corpo) {
+    return this.pedido("PUT", `/${bucket}/${chave}`, { corpo });
+  }
+  get(bucket, chave) {
+    return this.pedido("GET", `/${bucket}/${chave}`);
+  }
+  head(bucket, chave) {
+    return this.pedido("HEAD", `/${bucket}/${chave}`);
+  }
+  del(bucket, chave, versionId) {
+    const consulta = versionId ? { versionId } : {};
+    return this.pedido("DELETE", `/${bucket}/${chave}`, { consulta });
+  }
+  list(bucket, prefixo = "") {
+    return this.pedido("GET", `/${bucket}`, { consulta: { "list-type": "2", prefix: prefixo } });
+  }
+  listarBuckets() {
+    return this.pedido("GET", "/");
+  }
+
+  // URL pre-assinada (query string). Retorna a URL completa.
+  presign(metodo, bucket, chave, expiraSegundos, agora = new Date()) {
+    const { amz, dia } = stamp(agora);
+    const escopo = `${dia}/${this.regiao}/s3/aws4_request`;
+    const consulta = {
+      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
+      "X-Amz-Credential": `${this.accessKey}/${escopo}`,
+      "X-Amz-Date": amz,
+      "X-Amz-Expires": String(expiraSegundos),
+      "X-Amz-SignedHeaders": "host",
+    };
+    if (this.sessionToken) consulta["X-Amz-Security-Token"] = this.sessionToken;
+    const caminho = `/${bucket}/${chave}`;
+    const canon = [metodo, encCaminho(caminho), consultaCanonica(consulta), `host:${this.url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
+    const aAssinar = ["AWS4-HMAC-SHA256", amz, escopo, sha256(canon)].join("\n");
+    const assinatura = createHmac("sha256", chaveAssinatura(this.secretKey, dia, this.regiao, "s3"))
+      .update(aAssinar)
+      .digest("hex");
+    return `${this.url.origin}${encCaminho(caminho)}?${consultaCanonica(consulta)}&X-Amz-Signature=${assinatura}`;
+  }
+
+  // MinIO STS AssumeRole com politica de sessao (reduz, nunca amplia, as permissoes do chamador).
+  async assumirPapel(politicaSessao, duracaoSegundos = 900) {
+    const corpo = new URLSearchParams({
+      Action: "AssumeRole",
+      Version: "2011-06-15",
+      DurationSeconds: String(duracaoSegundos),
+      Policy: JSON.stringify(politicaSessao),
+    }).toString();
+    const r = await this.pedido("POST", "/", {
+      corpo,
+      servico: "sts",
+      cabecalhos: { "content-type": "application/x-www-form-urlencoded" },
+    });
+    if (r.status !== 200) return { erro: r };
+    const tag = (n) => new RegExp(`<${n}>([^<]+)</${n}>`).exec(r.texto)?.[1];
+    return new S3({
+      endpoint: this.url.origin,
+      accessKey: tag("AccessKeyId"),
+      secretKey: tag("SecretAccessKey"),
+      sessionToken: tag("SessionToken"),
+      regiao: this.regiao,
+    });
+  }
+}
+
+export async function pegarUrl(url, metodo = "GET", corpo) {
+  return resposta(await fetch(url, { method: metodo, body: corpo }));
+}
+
+async function resposta(r) {
+  const texto = await r.text();
+  const codigo = /<Code>([^<]+)<\/Code>/.exec(texto)?.[1] ?? null;
+  return { status: r.status, texto, codigo, cab: Object.fromEntries(r.headers) };
+}
```
