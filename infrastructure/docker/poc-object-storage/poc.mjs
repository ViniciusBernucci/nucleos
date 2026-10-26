// PoC DEC-009 (ADR-023): isolamento entre tenants em object storage S3-compativel (MinIO local).
// Executado por run-poc.sh. Nao imprime segredos; so codigos HTTP/S3 e verificacoes.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { pegarUrl, S3 } from "./sigv4.mjs";
import {
  ChaveInvalida,
  construirChave,
  politicaBucketDoTenant,
  politicaPrefixoDoTenant,
  validarChaveDoTenant,
  validarTtl,
} from "./politica.mjs";

const execFileAsync = promisify(execFile);
const { POC_PORT, POC_TMP, POC_CONTAINER, POC_VOLUME, POC_MC_IMAGE, POC_HELPER_IMAGE } = process.env;
const ENDPOINT = `http://127.0.0.1:${POC_PORT}`;
const SEGREDOS = `${POC_TMP}/segredos.txt`;

let ok = 0;
let falha = 0;
function verificar(nome, condicao, detalhe = "") {
  if (condicao) ok += 1;
  else falha += 1;
  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}${detalhe ? ` [${detalhe}]` : ""}`);
}
const negado = (r) => r.status === 403 && r.codigo === "AccessDenied";
const resumo = (r) => `${r.status} ${r.codigo ?? "-"}`;

async function mc(...args) {
  const { stdout } = await execFileAsync("docker", [
    "run", "--rm", "--pull=never", "--network", `container:${POC_CONTAINER}`, "--user", `${process.getuid()}`,
    "-v", `${POC_TMP}/mc:/mc`, POC_MC_IMAGE, "--config-dir", "/mc", ...args,
  ]);
  return stdout;
}
const segredo = () => {
  const v = randomBytes(20).toString("hex");
  appendFileSync(SEGREDOS, `${v}\n`);
  return v;
};
const registrar = (t) => {
  if (t instanceof S3) appendFileSync(SEGREDOS, `${t.secretKey}\n${t.sessionToken}\n`);
  return t;
};
const info = (nome, detalhe) => console.log(`INFO  ${nome} [${detalhe}]`);
const sufixo = () => randomBytes(3).toString("hex");

async function criarUsuario(prefixo, politicaNome, politica) {
  const chave = `${prefixo}-${sufixo()}`;
  const sec = segredo();
  writeFileSync(`${POC_TMP}/mc/${politicaNome}.json`, JSON.stringify(politica));
  await mc("admin", "policy", "create", "local", politicaNome, `/mc/${politicaNome}.json`);
  await mc("admin", "user", "add", "local", chave, sec);
  await mc("admin", "policy", "attach", "local", politicaNome, "--user", chave);
  return new S3({ endpoint: ENDPOINT, accessKey: chave, secretKey: sec });
}

const DOC_A = "11111111-1111-4111-8111-111111111111";
const DOC_B = "22222222-2222-4222-8222-222222222222";
const chaveDe = (tenantId, documentId, nome = "contrato.txt") =>
  construirChave({ tenantId, departamento: "juridico", documentId, nome });

// ---------------------------------------------------------------- Modelo P: bucket por tenant
async function modeloP() {
  console.log("== Modelo P: bucket por tenant + credencial restrita ao bucket");
  const [bA, bB] = ["p-tenant-a", "p-tenant-b"];
  await mc("mb", `local/${bA}`);
  await mc("mb", `local/${bB}`);
  const a = await criarUsuario("pa", "pol-p-a", politicaBucketDoTenant(bA));
  const b = await criarUsuario("pb", "pol-p-b", politicaBucketDoTenant(bB));
  const kA = chaveDe("tenant-a", DOC_A);
  const kB = chaveDe("tenant-b", DOC_B);

  verificar("P: A grava e le o proprio objeto", (await a.put(bA, kA, "dado-do-A")).status === 200 && (await a.get(bA, kA)).texto === "dado-do-A");
  verificar("P: B grava e le o proprio objeto", (await b.put(bB, kB, "dado-do-B")).status === 200 && (await b.get(bB, kB)).texto === "dado-do-B");
  let r = await a.get(bB, kB);
  verificar("P: A le objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await a.put(bB, kB, "sobrescrita-do-A");
  verificar("P: A sobrescreve objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await a.del(bB, kB);
  verificar("P: A apaga objeto de B -> AccessDenied", negado(r), resumo(r));
  verificar("P: objeto de B intacto apos ataques de A", (await b.get(bB, kB)).texto === "dado-do-B");
  r = await a.list(bB);
  verificar("P: A lista bucket de B -> AccessDenied", negado(r), resumo(r));
  r = await a.get(bB, chaveDe("tenant-b", "33333333-3333-4333-8333-333333333333", "inexistente.txt"));
  verificar("P: A le chave inexistente em B -> AccessDenied (sem oraculo de existencia, T-F9-I)", negado(r), resumo(r));
  r = await a.listarBuckets();
  verificar("P: A lista buckets da conta e ve somente o proprio (MinIO filtra por permissao)", r.status === 200 && r.texto.includes(bA) && !r.texto.includes(bB), resumo(r));
  r = await a.list(bA);
  verificar("P: A lista o proprio bucket e ve so a propria chave", r.status === 200 && r.texto.includes(kA) && !r.texto.includes(kB));
  r = await new S3({ endpoint: ENDPOINT, accessKey: a.accessKey, secretKey: "x".repeat(40) }).get(bA, kA);
  verificar("P: segredo errado -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
  r = await a.pedido("GET", `/${bA}/${kA}`, { anonimo: true });
  verificar("P: pedido anonimo -> AccessDenied", negado(r), resumo(r));

  // URLs pre-assinadas (T-F9-S)
  const urlA = a.presign("GET", bA, kA, 60);
  r = await pegarUrl(urlA);
  verificar("P: URL pre-assinada de A funciona sem credencial", r.status === 200 && r.texto === "dado-do-A");
  r = await pegarUrl(urlA.replace(kA, kB).replace(bA, bB));
  verificar("P: URL de A adulterada para chave/bucket de B -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
  r = await pegarUrl(a.presign("GET", bB, kB, 60));
  verificar("P: URL que A assina para objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await pegarUrl(a.presign("PUT", bB, kB, 60), "PUT", "x");
  verificar("P: URL de PUT que A assina para B -> AccessDenied", negado(r), resumo(r));
  r = await pegarUrl(urlA, "DELETE");
  verificar("P: URL de GET reutilizada como DELETE -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
  const curta = a.presign("GET", bA, kA, 1);
  await new Promise((res) => setTimeout(res, 2500));
  r = await pegarUrl(curta);
  verificar("P: URL expirada (1 s) -> AccessDenied", negado(r), resumo(r));

  // Revogacao de A sem afetar B (AC-2)
  const urlViva = a.presign("GET", bA, kA, 300);
  verificar("P: antes da revogacao a URL de A (300 s) funciona", (await pegarUrl(urlViva)).status === 200);
  await mc("admin", "user", "remove", "local", a.accessKey);
  r = await a.get(bA, kA);
  verificar("P: apos revogar A, a chave de A e recusada", r.status === 403, resumo(r));
  r = await pegarUrl(urlViva);
  verificar("P: apos revogar A, URL ja assinada por A (ainda dentro do TTL) tambem e recusada", r.status === 403, resumo(r));
  verificar("P: apos revogar A, B continua lendo e gravando", (await b.get(bB, kB)).texto === "dado-do-B" && (await b.put(bB, kB, "dado-do-B-v2")).status === 200);
  const a2 = await criarUsuario("pa", "pol-p-a2", politicaBucketDoTenant(bA));
  verificar("P: nova chave de A (rotacao) le o dado antigo de A", (await a2.get(bA, kA)).texto === "dado-do-A");
}

// ------------------------------------------------- Modelo S: bucket compartilhado + prefixo
async function modeloS() {
  console.log("== Modelo S: bucket compartilhado, credencial por prefixo");
  const bucket = "s-compartilhado";
  await mc("mb", `local/${bucket}`);
  const a = await criarUsuario("sa", "pol-s-a", politicaPrefixoDoTenant(bucket, "a"));
  const ab = await criarUsuario("sab", "pol-s-ab", politicaPrefixoDoTenant(bucket, "ab"));
  const b = await criarUsuario("sb", "pol-s-b", politicaPrefixoDoTenant(bucket, "b"));
  const kA = chaveDe("a", DOC_A);
  const kAB = chaveDe("ab", DOC_A);
  const kB = chaveDe("b", DOC_B);
  for (const [c, k, v] of [[a, kA, "dado-a"], [ab, kAB, "dado-ab"], [b, kB, "dado-b"]]) {
    verificar(`S: ${k.split("/")[1]} grava o proprio objeto`, (await c.put(bucket, k, v)).status === 200);
  }
  let r = await a.get(bucket, kB);
  verificar("S: A le objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await a.put(bucket, kB, "x");
  verificar("S: A sobrescreve objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await a.get(bucket, kAB);
  verificar("S: confusao de prefixo: A (tenants/a/) le tenants/ab/ -> AccessDenied", negado(r), resumo(r));
  r = await ab.get(bucket, kA);
  verificar("S: confusao de prefixo inversa: AB le tenants/a/ -> AccessDenied", negado(r), resumo(r));
  r = await a.list(bucket, "tenants/");
  verificar("S: A lista o prefixo raiz tenants/ -> AccessDenied", negado(r), resumo(r));
  r = await a.list(bucket, "");
  verificar("S: A lista o bucket sem prefixo -> AccessDenied", negado(r), resumo(r));
  r = await a.list(bucket, "tenants/b/");
  verificar("S: A lista o prefixo de B -> AccessDenied", negado(r), resumo(r));
  r = await a.list(bucket, "tenants/a/");
  verificar("S: A lista o proprio prefixo e ve so as proprias chaves", r.status === 200 && r.texto.includes(kA) && !r.texto.includes(kAB) && !r.texto.includes(kB));
  r = await a.get(bucket, "tenants/b/juridico/inexistente");
  verificar("S: A le chave inexistente no prefixo de B -> AccessDenied (sem oraculo)", negado(r), resumo(r));
  r = await a.put(bucket, "tenants/a/juridico/x/..%2F..%2F..%2Fb%2Fjuridico%2Fy", "x");
  const listaB = await b.list(bucket, "tenants/b/");
  const chavesB = [...listaB.texto.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  verificar("S: chave com '..%2F' gravada por A nao aparece no prefixo de B (so a chave original de B)", chavesB.length === 1 && chavesB[0] === kB, `PUT ${resumo(r)}; chaves em tenants/b/: ${chavesB.length}`);
  if (r.status === 200) {
    const listaA = await a.list(bucket, "tenants/a/");
    verificar("S: o objeto '..%2F' existe apenas sob tenants/a/ (chave literal)", listaA.texto.includes("..%2F") && !listaB.texto.includes("..%2F"));
  }
  r = await pegarUrl(a.presign("GET", bucket, kB, 60));
  verificar("S: URL que A assina para objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await pegarUrl(a.presign("GET", bucket, kA, 60).replace(kA, kB));
  verificar("S: URL de A adulterada para B -> SignatureDoesNotMatch", r.status === 403 && r.codigo === "SignatureDoesNotMatch", resumo(r));
  await mc("admin", "user", "remove", "local", a.accessKey);
  verificar("S: apos revogar A, A e recusado e B segue funcionando", (await a.get(bucket, kA)).status === 403 && (await b.get(bucket, kB)).texto === "dado-b");
}

// ------------- Modelo T: credencial temporaria por chamada, escopada ao prefixo (STS do MinIO)
async function modeloT() {
  console.log("== Modelo T: servico de storage assume papel com politica de sessao por tenant");
  const bucket = "t-compartilhado";
  await mc("mb", `local/${bucket}`);
  const ampla = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`] }] };
  const plataforma = await criarUsuario("plat", "pol-t-plataforma", ampla);
  const kA = chaveDe("a", DOC_A);
  const kB = chaveDe("b", DOC_B);
  await plataforma.put(bucket, kA, "dado-a");
  await plataforma.put(bucket, kB, "dado-b");
  verificar("T: a credencial da plataforma e ampla (le A e B): por isso nunca sai do servico", (await plataforma.get(bucket, kB)).texto === "dado-b");

  const tA = registrar(await plataforma.assumirPapel(politicaPrefixoDoTenant(bucket, "a")));
  verificar("T: AssumeRole com politica de sessao de A funciona", tA instanceof S3, tA.erro ? resumo(tA.erro) : "");
  verificar("T: credencial temporaria de A le/grava o proprio prefixo", (await tA.get(bucket, kA)).texto === "dado-a" && (await tA.put(bucket, chaveDe("a", DOC_B, "novo.txt"), "n")).status === 200);
  let r = await tA.get(bucket, kB);
  verificar("T: credencial temporaria de A le objeto de B -> AccessDenied", negado(r), resumo(r));
  r = await tA.list(bucket, "tenants/b/");
  verificar("T: credencial temporaria de A lista prefixo de B -> AccessDenied", negado(r), resumo(r));
  r = await pegarUrl(tA.presign("GET", bucket, kB, 60));
  verificar("T: URL pre-assinada com credencial temporaria de A para B -> AccessDenied", negado(r), resumo(r));
  r = await pegarUrl(tA.presign("GET", bucket, kA, 60));
  verificar("T: URL pre-assinada com credencial temporaria de A para A funciona", r.status === 200 && r.texto === "dado-a");

  // Politica de sessao so reduz: pedir mais que a politica-pai nao amplia.
  const outra = await criarUsuario("fraca", "pol-t-fraca", politicaPrefixoDoTenant(bucket, "a"));
  const tAmpliada = registrar(await outra.assumirPapel(ampla));
  verificar("T: politica de sessao nao amplia a politica do usuario (le B -> AccessDenied)", tAmpliada instanceof S3 && negado(await tAmpliada.get(bucket, kB)));

  // Revogacao: remover o usuario-pai invalida as credenciais temporarias derivadas?
  const tFraca = registrar(await outra.assumirPapel(politicaPrefixoDoTenant(bucket, "a")));
  const antes = (await tFraca.get(bucket, kA)).status;
  await mc("admin", "user", "remove", "local", outra.accessKey);
  const depois = await tFraca.get(bucket, kA);
  verificar("T: remover o usuario-pai invalida a credencial temporaria derivada", antes === 200 && depois.status === 403, `antes=${antes} depois=${resumo(depois)}`);
}

// ------------------------------------------------------ Guardas do servidor (politica.mjs)
function guardas() {
  console.log("== Guardas do servico de storage (antes de qualquer chamada ao provedor)");
  const rejeita = (nome, fn) => {
    let rejeitou = false;
    try {
      fn();
    } catch (e) {
      rejeitou = e instanceof ChaveInvalida;
    }
    verificar(`guarda: ${nome}`, rejeitou);
  };
  const kA = chaveDe("a", DOC_A);
  verificar("guarda: chave valida do proprio tenant aceita", validarChaveDoTenant("a", kA) === kA);
  rejeita("chave de outro tenant", () => validarChaveDoTenant("a", chaveDe("b", DOC_B)));
  rejeita("prefixo parecido (tenant 'ab' vs 'a')", () => validarChaveDoTenant("a", chaveDe("ab", DOC_A)));
  rejeita("'..' como segmento", () => validarChaveDoTenant("a", `tenants/a/juridico/${DOC_A}/..`));
  rejeita("travessia '../'", () => validarChaveDoTenant("a", `tenants/a/../b/juridico/${DOC_B}/x`));
  rejeita("chave absoluta", () => validarChaveDoTenant("a", `/${kA}`));
  rejeita("byte nulo", () => validarChaveDoTenant("a", `${kA}\0`));
  rejeita("barra invertida", () => validarChaveDoTenant("a", kA.replace("juridico", "juri\\dico")));
  rejeita("segmento extra", () => validarChaveDoTenant("a", `${kA}/extra`));
  rejeita("tenant com maiuscula/ponto", () => construirChave({ tenantId: "A.B", departamento: "x", documentId: DOC_A, nome: "f" }));
  rejeita("document_id que nao e UUID", () => construirChave({ tenantId: "a", departamento: "x", documentId: "../b", nome: "f" }));
  rejeita("nome so com '..'", () => construirChave({ tenantId: "a", departamento: "x", documentId: DOC_A, nome: ".." }));
  const k = construirChave({ tenantId: "a", departamento: "x", documentId: DOC_A, nome: "../../etc/passwd" });
  verificar("guarda: nome com caminho e reduzido ao nome-base", k.endsWith("/passwd") && !k.includes(".."), k);
  rejeita("TTL 0", () => validarTtl(0));
  rejeita("TTL 301 (literal)", () => validarTtl(301));
  rejeita("TTL fracionado 1.5", () => validarTtl(1.5));
  rejeita("TTL texto '60'", () => validarTtl("60"));
  rejeita("TTL 604800 (maximo do S3, 7 dias)", () => validarTtl(604800));
  rejeita("presign com TTL 301 recusa antes de assinar", () =>
    new S3({ endpoint: ENDPOINT, accessKey: "k", secretKey: "s" }).presign("GET", "b", "k", 301));
  verificar("guarda: TTL 1 aceito", validarTtl(1) === 1);
  verificar("guarda: TTL 300 aceito (literal)", validarTtl(300) === 300);
}

// ------------------------------------ Versionamento, object lock e criptografia em repouso
async function backupECriptografia() {
  console.log("== Versionamento, object lock e criptografia em repouso (MinIO)");
  const bucket = "lock-bucket";
  const livre = "versao-bucket";
  await mc("mb", "--with-lock", `local/${bucket}`);
  await mc("retention", "set", "--default", "GOVERNANCE", "1d", `local/${bucket}`);
  await mc("mb", `local/${livre}`);
  await mc("version", "enable", `local/${livre}`);
  const total = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`, `arn:aws:s3:::${livre}`, `arn:aws:s3:::${livre}/*`] }] };
  const u = await criarUsuario("lock", "pol-lock", total);
  let r = await u.put(bucket, "obj", "v1");
  const vLock = r.cab["x-amz-version-id"];
  verificar("lock (credencial s3:*, mede o mecanismo): PUT devolve versionId", r.status === 200 && Boolean(vLock));
  r = await u.del(bucket, "obj", vLock);
  const msg = /<Message>([^<]+)<\/Message>/.exec(r.texto)?.[1] ?? "";
  verificar("lock (s3:*): apagar a versao retida (GOVERNANCE) sem bypass e recusado", r.status >= 400 && /WORM|retention|bypass|locked/i.test(msg), `${resumo(r)} ${msg}`);
  r = await u.put(livre, "obj", "v1");
  const vLivre = r.cab["x-amz-version-id"];
  await u.put(livre, "obj", "v2");
  r = await u.del(livre, "obj");
  verificar("versionamento (s3:*): DELETE simples cria delete marker (dado recuperavel)", r.status === 204 && r.cab["x-amz-delete-marker"] === "true", resumo(r));
  r = await u.get(livre, "obj");
  verificar("versionamento (s3:*): objeto some da leitura corrente (404)", r.status === 404, resumo(r));
  const v1 = await u.pedido("GET", `/${livre}/obj`, { consulta: { versionId: vLivre } });
  verificar("versionamento (s3:*): a versao antiga continua recuperavel por versionId", v1.status === 200 && v1.texto === "v1");

  // Rodada 1 (REVIEW-002): a mesma configuracao com a politica REAL do tenant (Modelo P).
  console.log("-- rodada 1: lock/versionamento com a politica real do tenant (politicaBucketDoTenant)");
  const lockT = "lock-tenant";
  const verT = "versao-tenant";
  await mc("mb", "--with-lock", `local/${lockT}`);
  await mc("retention", "set", "--default", "GOVERNANCE", "1d", `local/${lockT}`);
  await mc("mb", `local/${verT}`);
  await mc("version", "enable", `local/${verT}`);
  const t1 = await criarUsuario("tl", "pol-tl", politicaBucketDoTenant(lockT));
  const t2 = await criarUsuario("tv", "pol-tv", politicaBucketDoTenant(verT));
  r = await t1.put(lockT, "obj", "v1");
  const vt = r.cab["x-amz-version-id"];
  verificar("lock (tenant): PUT funciona e devolve versionId", r.status === 200 && Boolean(vt));
  r = await t1.del(lockT, "obj", vt);
  verificar("lock (tenant): DELETE da versao retida sem bypass e recusado", r.status >= 400, resumo(r));
  r = await t1.del(lockT, "obj", vt, { "x-amz-bypass-governance-retention": "true" });
  verificar("lock (tenant): DELETE com cabecalho de bypass tambem e recusado (falta permissao)", r.status >= 400, resumo(r));
  r = await t1.pedido("GET", `/${lockT}/obj`, { consulta: { versionId: vt } });
  info("lock (tenant): GET da versao por versionId com a politica P (s3:GetObjectVersion nao concedida)", resumo(r));
  r = await t1.del(lockT, "obj");
  info("lock (tenant): DELETE simples (sem versionId) pelo tenant", `${resumo(r)} marker=${r.cab["x-amz-delete-marker"] ?? "-"}`);
  r = await t1.get(lockT, "obj");
  info("lock (tenant): GET corrente apos o DELETE simples", resumo(r));
  r = await t2.put(verT, "obj", "v1");
  const vt1 = r.cab["x-amz-version-id"];
  await t2.put(verT, "obj", "v2");
  r = await t2.del(verT, "obj");
  info("versionamento (tenant): DELETE simples cria delete marker", `${resumo(r)} marker=${r.cab["x-amz-delete-marker"] ?? "-"}`);
  r = await t2.pedido("GET", `/${verT}/obj`, { consulta: { versionId: vt1 } });
  info("versionamento (tenant): GET da versao antiga por versionId", resumo(r));
  r = await t2.del(verT, "obj", vt1);
  const apagada = r.status === 204;
  const depois = await t2.pedido("GET", `/${verT}/obj`, { consulta: { versionId: vt1 } });
  verificar("versionamento (tenant): ACHADO - s3:DeleteObject basta para apagar versao especifica no MinIO; versionamento sozinho NAO protege contra credencial comprometida", apagada && depois.status === 404, `DELETE ${resumo(r)}; GET depois ${resumo(depois)}`);
  verificar("lock (tenant): o object lock (GOVERNANCE) e o que protege a versao: ela continua legivel apos as tentativas de apagar", (await t1.pedido("GET", `/${lockT}/obj`, { consulta: { versionId: vt } })).status === 200);

  // Criptografia em repouso (SSE-S3 do MinIO) com controle negativo/positivo.
  await mc("mb", "local/enc-bucket");
  await mc("encrypt", "set", "sse-s3", "local/enc-bucket");
  await mc("mb", "local/claro-bucket");
  const sentinela = `SENTINELA-${randomBytes(8).toString("hex")}`;
  const e = await criarUsuario("enc", "pol-enc", { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*"], Resource: ["arn:aws:s3:::enc-bucket", "arn:aws:s3:::enc-bucket/*", "arn:aws:s3:::claro-bucket", "arn:aws:s3:::claro-bucket/*"] }] });
  await e.put("enc-bucket", "obj", sentinela);
  await e.put("claro-bucket", "obj", sentinela);
  const lido = await e.get("enc-bucket", "obj");
  verificar("SSE-S3 (credencial s3:*; mede criptografia, nao autorizacao): leitura via API devolve o texto original", lido.texto === sentinela);
  const buscar = async (pasta) => {
    try {
      const { stdout } = await execFileAsync("docker", ["run", "--rm", "--pull=never", "-v", `${POC_VOLUME}:/d:ro`, POC_HELPER_IMAGE, "grep", "-rlF", sentinela, `/d/${pasta}`]);
      return stdout.trim() !== "";
    } catch {
      return false; // grep sai com 1 quando nao encontra
    }
  };
  verificar("SSE-S3 (s3:*): controle positivo - bucket sem criptografia guarda o texto em claro no disco", await buscar("claro-bucket"));
  verificar("SSE-S3 (s3:*): bucket com SSE-S3 NAO guarda o texto em claro no disco", !(await buscar("enc-bucket")));
}

// ---------------------------------------------------------------------------------- main
writeFileSync(SEGREDOS, "");
try {
  guardas();
  await modeloP();
  await modeloS();
  await modeloT();
  await backupECriptografia();
} catch (e) {
  falha += 1;
  console.log(`FALHA excecao: ${e instanceof Error ? e.message.split("\n")[0] : "desconhecida"}`);
}
console.log(`== resultado: ${ok} OK, ${falha} FALHA`);
process.exit(falha === 0 ? 0 : 1);
