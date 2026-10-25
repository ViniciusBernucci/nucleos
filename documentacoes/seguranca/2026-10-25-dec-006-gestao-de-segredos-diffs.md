# DEC-006 — diffs do PoC

Voltar: [entrega](2026-10-25-dec-006-gestao-de-segredos.md). Valores de teste são sentinelas gerados em tempo de execução; nenhum segredo real. Nenhum segredo foi redigido ([REDACTED] não necessário).

## Patch consolidado do código/teste do PoC (base `4be3ce3` até a árvore após a correção rodada 1)

```diff
diff --git a/documentacoes/arquitetura/poc/dec-006/broker.mjs b/documentacoes/arquitetura/poc/dec-006/broker.mjs
new file mode 100644
index 0000000..441ebeb
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-006/broker.mjs
@@ -0,0 +1,202 @@
+// Broker de segredos do PoC DEC-006 (sem dependencias; apenas node:crypto/node:fs).
+// Hierarquia: chave mestra (KEK, tmpfs 0400) -> DEK por tenant (AES-256-GCM, embrulhada pela KEK)
+// -> segredo do tenant (AES-256-GCM sob a DEK). Entrega: arquivos 0400 em /tenants/<id>/.
+// O valor do segredo entra SOMENTE por stdin; nunca por argv ou env.
+import crypto from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+
+const MK = process.env.MK_PATH ?? "/run/mk/master.key";
+const STORE = process.env.STORE_PATH ?? "/var/broker/store.json";
+const AUDIT = process.env.AUDIT_PATH ?? "/var/broker/audit.log";
+const TENANTS = process.env.TENANTS_DIR ?? "/tenants";
+const UID_BASE = 10000;
+const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
+const MIN_PASSPHRASE = 16;
+const KDF = { N: 2 ** 17, r: 8, p: 1 };
+
+const b64 = (b) => b.toString("base64");
+const unb64 = (s) => Buffer.from(s, "base64");
+
+function seal(key, plain, aad) {
+  const iv = crypto.randomBytes(12);
+  const c = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
+  c.setAAD(Buffer.from(aad));
+  const ct = Buffer.concat([c.update(plain), c.final()]);
+  return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
+}
+function open(key, blob, aad) {
+  const raw = unb64(blob);
+  if (raw.length < 28) throw new Error("blob invalido");
+  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12), { authTagLength: 16 });
+  d.setAAD(Buffer.from(aad));
+  d.setAuthTag(raw.subarray(12, 28));
+  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
+}
+const loadStore = () => (fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : { tenants: {} });
+const saveStore = (s) => fs.writeFileSync(STORE, JSON.stringify(s, null, 2), { mode: 0o600 });
+const audit = (event, tenant, extra = {}) =>
+  fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), event, tenant, ...extra }) + "\n");
+const readStdin = () => fs.readFileSync(0).toString("utf8").replace(/\r?\n$/, "");
+const mk = () => fs.readFileSync(MK);
+
+// Nome de tenant: allowlist + confirmacao de que o diretorio resolvido e filho direto de TENANTS.
+const validName = (t) => typeof t === "string" && NAME_RE.test(t);
+function tdir(t) {
+  if (!validName(t)) throw new Error("nome de tenant invalido");
+  const root = path.resolve(TENANTS);
+  const dir = path.resolve(root, t);
+  if (path.dirname(dir) !== root) throw new Error("tenant fora da raiz");
+  return dir;
+}
+
+// UID nunca reutilizado: contador persistido; store sem o campo inicia em max(uid)+1.
+function allocUid(store) {
+  const max = Math.max(UID_BASE, ...Object.values(store.tenants).map((t) => t.uid));
+  const uid = Math.max(store.nextUid ?? 0, max + 1);
+  store.nextUid = uid + 1;
+  return uid;
+}
+
+function writeFile0400(file, data, uid) {
+  if (fs.existsSync(file)) fs.rmSync(file);
+  fs.writeFileSync(file, data, { mode: 0o400 });
+  fs.chownSync(file, uid, uid);
+}
+function prepareDir(t, uid) {
+  fs.mkdirSync(tdir(t), { recursive: true, mode: 0o500 });
+  fs.chownSync(tdir(t), uid, uid);
+}
+function deliver(t, rec, secretsByFile) {
+  const uid = rec.uid;
+  prepareDir(t, uid);
+  for (const f of ["current", "previous"]) {
+    const p = path.join(tdir(t), f);
+    if (secretsByFile[f] === undefined) fs.rmSync(p, { force: true });
+    else writeFile0400(p, secretsByFile[f], uid);
+  }
+  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ version: rec.version, hasPrevious: secretsByFile.previous !== undefined }), uid);
+}
+function deliverRevoked(t, uid) {
+  prepareDir(t, uid);
+  fs.rmSync(path.join(tdir(t), "current"), { force: true });
+  fs.rmSync(path.join(tdir(t), "previous"), { force: true });
+  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ revoked: true }), uid);
+}
+const decrypt = (t, rec, which) => {
+  const dek = open(mk(), rec.wrappedDek, `dek:${t}`);
+  return open(dek, rec.secrets[which], `secret:${t}:${which === "current" ? rec.version : rec.version - 1}`).toString("utf8");
+};
+
+// Backup da KEK: scrypt(frase) com parametros gravados no blob e autenticados na AAD.
+const kdfAad = (k) => `mk-backup:v1:scrypt:${k.N}:${k.r}:${k.p}`;
+const kdfKey = (phrase, salt, k) => crypto.scryptSync(phrase, salt, 32, { N: k.N, r: k.r, p: k.p, maxmem: 128 * k.N * k.r + 64 * 1024 * 1024 });
+function requirePassphrase(phrase) {
+  if (phrase.length < MIN_PASSPHRASE) throw new Error(`frase curta (minimo ${MIN_PASSPHRASE} caracteres)`);
+  return phrase;
+}
+function checkKdf(k) {
+  const ok = k && k.name === "scrypt" && [2 ** 17, 2 ** 18].includes(k.N) && k.r === 8 && Number.isInteger(k.p) && k.p >= 1 && k.p <= 2;
+  if (!ok) throw new Error("parametros kdf invalidos");
+  return k;
+}
+
+const [cmd, tenant, arg] = process.argv.slice(2);
+if (["create", "rotate", "retire-previous", "revoke"].includes(cmd) || (cmd === "verify-store" && tenant && tenant !== "-")) {
+  tdir(tenant); // valida antes de qualquer E/S
+}
+const store = loadStore();
+const rec = Object.hasOwn(store.tenants, tenant) ? store.tenants[tenant] : undefined;
+
+switch (cmd) {
+  case "create": {
+    if (rec && !rec.revoked) throw new Error("tenant ja existe");
+    const dek = crypto.randomBytes(32);
+    const r = { uid: allocUid(store), version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
+    r.secrets.current = seal(dek, Buffer.from(readStdin()), `secret:${tenant}:1`);
+    store.tenants[tenant] = r;
+    saveStore(store);
+    deliver(tenant, r, { current: decrypt(tenant, r, "current") });
+    audit("create", tenant, { version: 1 });
+    break;
+  }
+  case "rotate": {
+    if (!rec || rec.revoked) throw new Error("tenant inexistente/revogado");
+    const prev = decrypt(tenant, rec, "current");
+    const dek = open(mk(), rec.wrappedDek, `dek:${tenant}`);
+    const next = rec.version + 1;
+    rec.secrets = { current: seal(dek, Buffer.from(readStdin()), `secret:${tenant}:${next}`), previous: seal(dek, Buffer.from(prev), `secret:${tenant}:${rec.version}`) };
+    rec.version = next;
+    saveStore(store);
+    deliver(tenant, rec, { current: decrypt(tenant, rec, "current"), previous: prev });
+    audit("rotate", tenant, { version: next, dualWindow: true });
+    break;
+  }
+  case "retire-previous": {
+    if (!rec || rec.revoked) throw new Error("tenant inexistente/revogado");
+    delete rec.secrets.previous;
+    saveStore(store);
+    deliver(tenant, rec, { current: decrypt(tenant, rec, "current") });
+    audit("retire-previous", tenant, { version: rec.version });
+    break;
+  }
+  case "revoke": {
+    // Revogacao por descarte da DEK embrulhada: remove wrappedDek e textos cifrados do store vivo e os
+    // arquivos entregues. NAO e irrecuperavel se houver copia anterior do store enquanto a KEK existir.
+    if (!rec) throw new Error("tenant inexistente");
+    store.tenants[tenant] = { uid: rec.uid, version: rec.version, revoked: true };
+    saveStore(store);
+    deliverRevoked(tenant, rec.uid);
+    audit("revoke", tenant, { version: rec.version });
+    break;
+  }
+  case "redeliver-all": {
+    // recuperacao: reentrega todos os arquivos a partir do store (KEK ja restaurada)
+    let delivered = 0;
+    for (const [t, r] of Object.entries(store.tenants)) {
+      if (r.revoked) { deliverRevoked(t, r.uid); continue; }
+      const files = { current: decrypt(t, r, "current") };
+      if (r.secrets.previous) files.previous = decrypt(t, r, "previous");
+      deliver(t, r, files);
+      delivered += 1;
+    }
+    audit("redeliver-all", "-", { tenants: delivered });
+    console.log(JSON.stringify({ ok: true, delivered }));
+    break;
+  }
+  case "backup-mk": {
+    // Backup da chave mestra embrulhada por scrypt(frase). A frase vem por stdin.
+    const phrase = requirePassphrase(readStdin());
+    const salt = crypto.randomBytes(16);
+    const k = { name: "scrypt", ...KDF };
+    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: k, salt: b64(salt), blob: seal(kdfKey(phrase, salt, k), mk(), kdfAad(k)) }), { mode: 0o600 });
+    audit("backup-mk", "-");
+    break;
+  }
+  case "restore-mk": {
+    const bk = JSON.parse(fs.readFileSync(arg, "utf8"));
+    if (bk.v !== 1) throw new Error("versao de backup desconhecida");
+    const k = checkKdf(bk.kdf);
+    const key = open(kdfKey(requirePassphrase(readStdin()), unb64(bk.salt), k), bk.blob, kdfAad(k));
+    fs.rmSync(MK, { force: true });
+    fs.writeFileSync(MK, key, { mode: 0o400 });
+    audit("restore-mk", "-");
+    break;
+  }
+  case "verify-store": {
+    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores); {ok:false} + exit 2 se nao
+    const targets = Object.entries(store.tenants).filter(([t, r]) => !r.revoked && (!tenant || tenant === "-" || t === tenant));
+    let result;
+    if (tenant && tenant !== "-" && targets.length === 0) result = { ok: false, reason: "tenant-inexistente-ou-revogado" };
+    else if (!fs.existsSync(MK)) result = { ok: false, reason: "kek-ausente" };
+    else {
+      try { for (const [t, r] of targets) decrypt(t, r, "current"); result = { ok: true, checked: targets.length }; }
+      catch { result = { ok: false, reason: "kek-invalida" }; }
+    }
+    console.log(JSON.stringify(result));
+    if (!result.ok) process.exitCode = 2;
+    break;
+  }
+  default:
+    throw new Error("comando desconhecido");
+}
diff --git a/documentacoes/arquitetura/poc/dec-006/poc.test.mjs b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
new file mode 100644
index 0000000..4efae38
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
@@ -0,0 +1,321 @@
+// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs/argv/volumes.
+// Valores 100% sinteticos gerados a cada execucao. Containers sem rede (--network none), sem portas.
+import test, { before, after } from "node:test";
+import assert from "node:assert/strict";
+import { spawnSync } from "node:child_process";
+import crypto from "node:crypto";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+const IMG = "node:22-alpine";
+const RUN = crypto.randomBytes(3).toString("hex");
+const N = (s) => `dec006-${RUN}-${s}`;
+const sentinel = (label) => `SENTINEL-${label}-${crypto.randomBytes(16).toString("hex")}`;
+const hmac = (v) => crypto.createHmac("sha256", v).update("challenge").digest("hex");
+
+const MK = crypto.randomBytes(32);
+const PASS = sentinel("passphrase");
+const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1"), u: sentinel("uid"), u2: sentinel("uid-v2") };
+const all = () => Object.values(S).concat([MK.toString("hex"), MK.toString("base64"), PASS]);
+// UNICA funcao de deteccao, usada nos canais reais e nos controles negativos
+const hits = (text, values = all()) => values.filter((v) => text.includes(v));
+
+const docker = (args, input) => {
+  const r = spawnSync("docker", args, { input, encoding: "utf8" });
+  if (r.status !== 0) throw new Error(`docker ${args[0]} falhou: ${r.stderr.slice(0, 300)}`);
+  return r.stdout;
+};
+const containers = [];
+const volumes = [];
+const V = { secrets: N("secrets"), mk: N("mk"), store: N("store") };
+// stdout+stderr de TODAS as chamadas ao broker, para varredura de ausencia de segredo
+const brokerOut = [];
+const execIn = (sink, args, input) => {
+  const r = spawnSync("docker", args, { input, encoding: "utf8" });
+  sink.push(r.stdout, r.stderr);
+  return r;
+};
+const brokerRaw = (args, input) => execIn(brokerOut, ["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
+const broker = (args, input) => {
+  const r = brokerRaw(args, input);
+  if (r.status !== 0) throw new Error(`broker ${args[0]} falhou (status ${r.status}): ${r.stderr.slice(0, 300)}`);
+  return r.stdout;
+};
+const inBroker = (cmd) => docker(["exec", N("broker"), "sh", "-c", cmd]);
+const storeJson = () => JSON.parse(docker(["exec", N("broker"), "cat", "/var/broker/store.json"]));
+const tenantCheck = (t) => JSON.parse(docker(["exec", N(t), "node", "/app/tenant-app.mjs", "hmac"]));
+const identity = (t) => JSON.parse(docker(["inspect", N(t), "--format", "{{json .}}"]));
+const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.State.StartedAt, restarts: i.RestartCount }; };
+
+function startTenant(t, uid) {
+  docker(["run", "-d", "--name", N(t), "--network", "none", "--user", String(uid), "--read-only", "--cap-drop", "ALL",
+    "-v", `${here}:/app:ro`,
+    "--mount", `type=volume,src=${V.secrets},dst=/run/secrets,readonly,volume-subpath=${t}`,
+    IMG, "node", "/app/tenant-app.mjs"]);
+  containers.push(N(t));
+}
+
+// Canais de um container: inspect, logs (stdout+stderr), env, environ do PID 1 e argv de todos os processos.
+function channels(n) {
+  const logs = spawnSync("docker", ["logs", n], { encoding: "utf8" });
+  return {
+    inspect: docker(["inspect", n]),
+    logs: logs.stdout + logs.stderr,
+    env: docker(["exec", n, "env"]),
+    environ: docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"]),
+    cmdline: docker(["exec", n, "sh", "-c", "cat /proc/[0-9]*/cmdline | tr '\\0' '\\n'"]),
+  };
+}
+
+// Conteudo de um volume lido por container auxiliar (somente leitura): [{p, buf}]
+const WALK = "const fs=require('fs'),path=require('path');const o=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.isFile())o.push({p:p.slice(3),b:fs.readFileSync(p).toString('base64')})}})('/v');console.log(JSON.stringify(o))";
+function volumeFiles(vol) {
+  const out = docker(["run", "--rm", "--network", "none", "--user", "0", "-v", `${vol}:/v:ro`, IMG, "node", "-e", WALK]);
+  return JSON.parse(out).map(({ p, b }) => ({ p, buf: Buffer.from(b, "base64") }));
+}
+function fileHits(buf, values = all(), rawKey = true) {
+  const h = hits(buf.toString("latin1"), values);
+  if (rawKey && buf.includes(MK)) h.push("RAW-MK");
+  return h;
+}
+
+before(() => {
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", V.secrets]);
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", V.mk]);
+  docker(["volume", "create", V.store]);
+  volumes.push(V.secrets, V.mk, V.store);
+  docker(["run", "-d", "--name", N("broker"), "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
+    "-v", `${here}:/app:ro`, "-v", `${V.secrets}:/tenants`, "-v", `${V.mk}:/run/mk`, "-v", `${V.store}:/var/broker`,
+    IMG, "sleep", "3600"]);
+  containers.push(N("broker"));
+  // a chave mestra entra por stdin direto no tmpfs do broker (nunca env, nunca argv, nunca imagem)
+  docker(["exec", "-i", N("broker"), "sh", "-c", "umask 277; cat > /run/mk/master.key"], MK);
+});
+
+after(() => {
+  for (const c of containers) spawnSync("docker", ["rm", "-f", c]);
+  for (const v of volumes) spawnSync("docker", ["volume", "rm", "-f", v]);
+});
+
+test("AC-1: cria, entrega, rotaciona e revoga segredo de tenant sem reiniciar outros tenants", () => {
+  broker(["create", "tenant-a"], S.a1);
+  broker(["create", "tenant-b"], S.b1);
+  startTenant("tenant-a", 10001);
+  startTenant("tenant-b", 10002);
+  const bBefore = stamp("tenant-b");
+
+  assert.equal(tenantCheck("tenant-a").current, hmac(S.a1), "entrega a");
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "entrega b");
+
+  // isolamento: leitura real de segredo de outro tenant falha; leitura do proprio funciona (controle positivo)
+  const read = (t, p) => spawnSync("docker", ["exec", N(t), "cat", p], { encoding: "utf8" });
+  assert.equal(read("tenant-a", "/run/secrets/current").stdout, S.a1, "controle positivo: le o proprio segredo");
+  assert.equal(read("tenant-b", "/run/secrets/current").stdout, S.b1, "controle positivo: le o proprio segredo");
+  for (const [from, other, otherSecret] of [["tenant-a", "tenant-b", S.b1], ["tenant-b", "tenant-a", S.a1]]) {
+    for (const p of [`/run/secrets/${other}/current`, `/run/secrets/../${other}/current`, `/run/secrets/../secrets/${other}/current`, `/tenants/${other}/current`]) {
+      const r = read(from, p);
+      assert.notEqual(r.status, 0, `${from} nao pode ler ${p}`);
+      assert.ok(!r.stdout.includes(otherSecret));
+    }
+    assert.equal(docker(["exec", N(from), "ls", "/run/secrets"]).split("\n").filter(Boolean).sort().join(","), "current,meta.json");
+  }
+
+  // rotacao com janela dupla
+  const aBefore = stamp("tenant-a");
+  broker(["rotate", "tenant-a"], S.a2);
+  let c = tenantCheck("tenant-a");
+  assert.equal(c.current, hmac(S.a2));
+  assert.equal(c.previous, hmac(S.a1), "janela dupla mantem a versao anterior");
+  broker(["retire-previous", "tenant-a"]);
+  assert.equal(tenantCheck("tenant-a").previous, null);
+  assert.deepEqual(stamp("tenant-a"), aBefore, "rotacao nao reinicia o proprio tenant");
+
+  // revogacao
+  broker(["revoke", "tenant-a"]);
+  c = tenantCheck("tenant-a");
+  assert.equal(c.current, null);
+  assert.equal(c.previous, null);
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "b intacto");
+  assert.deepEqual(stamp("tenant-b"), bBefore, "b nao reiniciou nem foi recriado");
+
+  // criptografia em repouso: store nao contem valores em claro
+  const store = docker(["exec", N("broker"), "cat", "/var/broker/store.json"]);
+  for (const v of all()) assert.ok(!store.includes(v));
+  // REVIEW-003: apos revoke, wrappedDek e segredos cifrados sumiram do store vivo (nao se afirma irrecuperabilidade)
+  const revoked = JSON.parse(store).tenants["tenant-a"];
+  assert.deepEqual(Object.keys(revoked).sort(), ["revoked", "uid", "version"]);
+  assert.equal(revoked.wrappedDek, undefined);
+  assert.equal(revoked.secrets, undefined);
+  const aud = docker(["exec", N("broker"), "cat", "/var/broker/audit.log"]);
+  assert.deepEqual(aud.trim().split("\n").map((l) => JSON.parse(l).event),
+    ["create", "create", "rotate", "retire-previous", "revoke"]);
+  for (const v of all()) assert.ok(!aud.includes(v));
+});
+
+test("REVIEW-001: UID nunca e reutilizado (create/revoke/recreate)", () => {
+  const uidOf = (t) => storeJson().tenants[t].uid;
+  broker(["create", "uid-a"], S.u);
+  broker(["create", "uid-b"], S.u);
+  const a1 = uidOf("uid-a");
+  const b = uidOf("uid-b");
+  broker(["revoke", "uid-a"]);
+  broker(["create", "uid-a"], S.u); // recria o mesmo nome revogado
+  broker(["create", "uid-c"], S.u);
+  broker(["rotate", "uid-c"], S.u2); // deixa previous para o teste de reentrega
+  const st = storeJson();
+  const uids = Object.values(st.tenants).map((t) => t.uid);
+  assert.equal(new Set(uids).size, uids.length, `UIDs duplicados: ${uids}`);
+  assert.notEqual(uidOf("uid-a"), a1, "recriacao recebe UID novo");
+  assert.equal(uidOf("uid-b"), b);
+  assert.ok(st.nextUid > Math.max(...uids), "nextUid persistido e maior que todos os UIDs");
+  // store legado sem nextUid: reinicializa em max(uid)+1
+  inBroker(`node -e "const fs=require('fs');const p='/var/broker/store.json';const s=JSON.parse(fs.readFileSync(p));delete s.nextUid;fs.writeFileSync(p,JSON.stringify(s))"`);
+  broker(["create", "uid-d"], S.u);
+  const st2 = storeJson();
+  const uids2 = Object.values(st2.tenants).map((t) => t.uid);
+  assert.equal(new Set(uids2).size, uids2.length);
+  assert.ok(st2.tenants["uid-d"].uid > Math.max(...uids));
+});
+
+test("REVIEW-002: nomes de tenant fora da allowlist sao rejeitados antes de qualquer E/S", () => {
+  const snapshot = () => inBroker("cat /var/broker/store.json; find /tenants | sort; ls -d /victim /x /tenants/../x 2>&1; true");
+  const before = snapshot();
+  const bad = ["..", ".", "../x", "a/b", "", "Maiusc", "a b", "-x", "../../victim/x", "a".repeat(64), "x\ny"];
+  for (const name of bad) {
+    for (const cmd of ["create", "rotate", "retire-previous", "revoke"]) {
+      const r = brokerRaw([cmd, name], S.u);
+      assert.notEqual(r.status, 0, `${cmd} ${JSON.stringify(name)} deveria falhar`);
+      assert.ok(r.stderr.includes("nome de tenant invalido"), `${cmd} ${JSON.stringify(name)}: ${r.stderr.slice(0, 200)}`);
+    }
+  }
+  assert.equal(snapshot(), before, "nada criado/alterado (store, /tenants, fora da raiz)");
+  assert.equal(brokerRaw(["verify-store", "../x"]).status, 1, "verify-store tambem valida o nome");
+});
+
+test("AC-2: ausencia de segredo em env, inspect, logs, argv, saida do broker e conteudo dos volumes", () => {
+  const names = [N("broker"), N("tenant-a"), N("tenant-b")];
+  for (const n of names) {
+    for (const [canal, texto] of Object.entries(channels(n))) assert.deepEqual(hits(texto), [], `${canal} ${n}`);
+  }
+  // stdout/stderr de todas as chamadas ao broker (create/rotate/revoke, erros com stack)
+  assert.ok(brokerOut.length > 10, "captura nao vazia");
+  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
+  for (const v of Object.values(V)) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume inspect ${v}`);
+  assert.deepEqual(hits(docker(["image", "inspect", IMG])), []);
+
+  // conteudo dos volumes, com allowlist explicita dos arquivos legitimamente entregues
+  const active = Object.entries(storeJson().tenants).filter(([, r]) => !r.revoked).map(([t]) => t);
+  const allowedSecretFiles = new Set(active.flatMap((t) => [`${t}/current`, `${t}/previous`]));
+  const isSecret = (h) => Object.values(S).includes(h);
+  const unexpected = [];
+  const seen = new Set();
+  for (const [role, vol] of Object.entries(V)) {
+    for (const { p, buf } of volumeFiles(vol)) {
+      seen.add(`${role}:${p}`);
+      for (const h of fileHits(buf)) {
+        const ok = (role === "secrets" && allowedSecretFiles.has(p) && isSecret(h)) || (role === "mk" && p === "master.key" && h === "RAW-MK");
+        if (!ok) unexpected.push(`${role}:${p}:${h.slice(0, 18)}`);
+      }
+    }
+  }
+  assert.deepEqual(unexpected, [], "segredo em arquivo de volume fora da allowlist");
+  // a varredura nao e vazia: viu os arquivos legitimos
+  assert.ok(seen.has("secrets:tenant-b/current") && seen.has("mk:master.key") && seen.has("store:store.json"));
+  assert.ok(fileHits(volumeFiles(V.secrets).find((f) => f.p === "tenant-b/current").buf).includes(S.b1));
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1));
+});
+
+test("controle negativo: a mesma hits() detecta vazamento em cada canal", () => {
+  const leak = sentinel("leak");
+  const only = (text) => hits(text, [leak]);
+  // env / inspect / environ
+  docker(["run", "-d", "--name", N("leak-env"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "120"]);
+  containers.push(N("leak-env"));
+  const ce = channels(N("leak-env"));
+  for (const c of ["inspect", "env", "environ"]) assert.deepEqual(only(ce[c]), [leak], `canal ${c}`);
+  // logs e argv
+  docker(["run", "-d", "--name", N("leak-log"), "--network", "none", IMG, "sh", "-c", 'echo "$0"; sleep 120; :', leak]);
+  containers.push(N("leak-log"));
+  const cl = channels(N("leak-log"));
+  for (const c of ["logs", "cmdline"]) assert.deepEqual(only(cl[c]), [leak], `canal ${c}`);
+  // arquivo em volume (mesmo varredor de conteudo)
+  const ctl = N("ctl");
+  docker(["volume", "create", ctl]);
+  volumes.push(ctl);
+  docker(["run", "--rm", "--network", "none", "-v", `${ctl}:/v`, IMG, "sh", "-c", 'echo "$0" > /v/f', leak]);
+  assert.deepEqual(volumeFiles(ctl).filter((f) => fileHits(f.buf, [leak], false).length).map((f) => f.p), ["f"]);
+  // saida capturada do broker
+  const sink = [];
+  execIn(sink, ["exec", N("broker"), "sh", "-c", 'echo "$0"', leak]);
+  assert.deepEqual(only(sink.join("\n")), [leak]);
+  // controle do controle: sem vazamento nada e detectado
+  assert.deepEqual(only(channels(N("broker")).logs + brokerOut.join("")), []);
+});
+
+test("backup da KEK: KDF parametrizado, frase curta rejeitada, parametros adulterados falham", () => {
+  broker(["backup-mk", "-", "/var/broker/mk.backup.json"], PASS);
+  const raw = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
+  for (const v of all()) assert.ok(!raw.includes(v), "backup nao expoe a chave");
+  const bk = JSON.parse(raw);
+  assert.deepEqual(bk.kdf, { name: "scrypt", N: 2 ** 17, r: 8, p: 1 }, "parametros gravados no blob");
+  const mkB64 = () => inBroker("base64 /run/mk/master.key").trim();
+  const mkBefore = mkB64();
+
+  // frase vazia/curta rejeitada, sem arquivo gerado
+  for (const phrase of ["", "curta", "x".repeat(15)]) {
+    const r = brokerRaw(["backup-mk", "-", "/var/broker/mk.short.json"], phrase);
+    assert.notEqual(r.status, 0);
+    assert.ok(r.stderr.includes("frase curta"));
+  }
+  assert.equal(inBroker("ls /var/broker/mk.short.json 2>&1; true").includes("No such file"), true);
+
+  // parametros/versao adulterados: falham sem tocar na KEK
+  const tamper = (mut) => {
+    const b = structuredClone(bk);
+    mut(b);
+    docker(["exec", "-i", N("broker"), "sh", "-c", "cat > /var/broker/mk.t.json"], JSON.stringify(b));
+    return brokerRaw(["restore-mk", "-", "/var/broker/mk.t.json"], PASS);
+  };
+  assert.notEqual(tamper((b) => { b.kdf.p = 2; }).status, 0, "p alterado (valido) falha por autenticacao");
+  assert.notEqual(tamper((b) => { b.kdf.N = 2 ** 18; }).status, 0, "N alterado (valido) falha por autenticacao");
+  assert.ok(tamper((b) => { b.kdf.N = 2 ** 14; }).stderr.includes("parametros kdf invalidos"), "N fraco recusado");
+  assert.ok(tamper((b) => { b.v = 2; }).stderr.includes("versao de backup"));
+  assert.equal(tamper(() => {}).status, 0, "controle: backup integro restaura");
+  assert.equal(mkB64(), mkBefore, "KEK intacta");
+});
+
+test("desastre completo: perde KEK e arquivos entregues, restaura e reentrega", () => {
+  const restoreArgs = ["restore-mk", "-", "/var/broker/mk.backup.json"];
+  const mkBefore = inBroker("base64 /run/mk/master.key").trim();
+  // desastre
+  inBroker("rm /run/mk/master.key; find /tenants -type f -delete");
+  assert.equal(tenantCheck("tenant-b").current, null, "arquivos entregues apagados");
+  let v = brokerRaw(["verify-store", "tenant-b"]);
+  assert.equal(v.status, 2);
+  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-ausente" });
+  // KEK errada nao passa como valida
+  docker(["exec", "-i", N("broker"), "sh", "-c", "umask 277; cat > /run/mk/master.key"], crypto.randomBytes(32));
+  v = brokerRaw(["verify-store", "tenant-b"]);
+  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-invalida" });
+  // frase errada rejeitada (longa o bastante para chegar a autenticacao)
+  const wrong = brokerRaw(restoreArgs, "frase-errada-mas-longa-123");
+  assert.notEqual(wrong.status, 0);
+  assert.deepEqual(JSON.parse(brokerRaw(["verify-store", "tenant-b"]).stdout), { ok: false, reason: "kek-invalida" });
+  // restauracao + verificacao + reentrega
+  broker(restoreArgs, PASS);
+  assert.deepEqual(JSON.parse(broker(["verify-store", "tenant-b"])), { ok: true, checked: 1 });
+  assert.equal(inBroker("base64 /run/mk/master.key").trim(), mkBefore);
+  assert.equal(Buffer.from(mkBefore, "base64").equals(MK), true);
+  const active = Object.values(storeJson().tenants).filter((t) => !t.revoked).length;
+  assert.deepEqual(JSON.parse(broker(["redeliver-all"])), { ok: true, delivered: active });
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "tenant-b volta a ler o segredo correto");
+  const a = tenantCheck("tenant-a");
+  assert.equal(a.current, null, "revogado continua sem segredo");
+  assert.equal(inBroker("cat /tenants/tenant-a/meta.json"), JSON.stringify({ revoked: true }));
+  assert.equal(inBroker("cat /tenants/uid-c/current"), S.u2, "versao rotacionada reentregue");
+  assert.equal(inBroker("cat /tenants/uid-c/previous"), S.u, "janela dupla reentregue");
+  assert.equal(inBroker("cat /tenants/uid-a/current"), S.u);
+  // nada vazou na saida do broker durante backup/desastre/recuperacao
+  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
+});
diff --git a/documentacoes/arquitetura/poc/dec-006/tenant-app.mjs b/documentacoes/arquitetura/poc/dec-006/tenant-app.mjs
new file mode 100644
index 0000000..4362f77
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-006/tenant-app.mjs
@@ -0,0 +1,18 @@
+// Tenant sintetico: observa /run/secrets e loga somente a VERSAO (nunca o valor).
+import fs from "node:fs";
+import crypto from "node:crypto";
+const dir = "/run/secrets";
+const read = (f) => { try { return fs.readFileSync(`${dir}/${f}`, "utf8"); } catch { return null; } };
+const mode = process.argv[2];
+if (mode === "hmac") {
+  // uso via docker exec: prova que o valor entregue esta correto sem imprimi-lo
+  const out = {};
+  for (const f of ["current", "previous"]) { const v = read(f); out[f] = v === null ? null : crypto.createHmac("sha256", v).update("challenge").digest("hex"); }
+  console.log(JSON.stringify(out));
+} else {
+  let last = "";
+  setInterval(() => {
+    const m = read("meta.json");
+    if (m !== last) { last = m; console.log(`tenant secret meta changed: ${m === null ? "absent" : m}`); }
+  }, 100);
+}
```

## Correção rodada 1 — patch incremental (de `8105de1` à árvore após a correção)

Este é o diff do commit da rodada 1 para broker/teste. ADR, README do PoC, `saida-execucao.txt` e o documento da entrega (escrita em `documentacoes/`) ficam fora do patch para evitar recursão.

```diff
diff --git a/documentacoes/arquitetura/poc/dec-006/broker.mjs b/documentacoes/arquitetura/poc/dec-006/broker.mjs
index e2ef28c..441ebeb 100644
--- a/documentacoes/arquitetura/poc/dec-006/broker.mjs
+++ b/documentacoes/arquitetura/poc/dec-006/broker.mjs
@@ -11,20 +11,24 @@ const STORE = process.env.STORE_PATH ?? "/var/broker/store.json";
 const AUDIT = process.env.AUDIT_PATH ?? "/var/broker/audit.log";
 const TENANTS = process.env.TENANTS_DIR ?? "/tenants";
 const UID_BASE = 10000;
+const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
+const MIN_PASSPHRASE = 16;
+const KDF = { N: 2 ** 17, r: 8, p: 1 };
 
 const b64 = (b) => b.toString("base64");
 const unb64 = (s) => Buffer.from(s, "base64");
 
 function seal(key, plain, aad) {
   const iv = crypto.randomBytes(12);
-  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
+  const c = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
   c.setAAD(Buffer.from(aad));
   const ct = Buffer.concat([c.update(plain), c.final()]);
   return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
 }
 function open(key, blob, aad) {
   const raw = unb64(blob);
-  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
+  if (raw.length < 28) throw new Error("blob invalido");
+  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12), { authTagLength: 16 });
   d.setAAD(Buffer.from(aad));
   d.setAuthTag(raw.subarray(12, 28));
   return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
@@ -35,17 +39,37 @@ const audit = (event, tenant, extra = {}) =>
   fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), event, tenant, ...extra }) + "\n");
 const readStdin = () => fs.readFileSync(0).toString("utf8").replace(/\r?\n$/, "");
 const mk = () => fs.readFileSync(MK);
-const tdir = (t) => path.join(TENANTS, t);
+
+// Nome de tenant: allowlist + confirmacao de que o diretorio resolvido e filho direto de TENANTS.
+const validName = (t) => typeof t === "string" && NAME_RE.test(t);
+function tdir(t) {
+  if (!validName(t)) throw new Error("nome de tenant invalido");
+  const root = path.resolve(TENANTS);
+  const dir = path.resolve(root, t);
+  if (path.dirname(dir) !== root) throw new Error("tenant fora da raiz");
+  return dir;
+}
+
+// UID nunca reutilizado: contador persistido; store sem o campo inicia em max(uid)+1.
+function allocUid(store) {
+  const max = Math.max(UID_BASE, ...Object.values(store.tenants).map((t) => t.uid));
+  const uid = Math.max(store.nextUid ?? 0, max + 1);
+  store.nextUid = uid + 1;
+  return uid;
+}
 
 function writeFile0400(file, data, uid) {
   if (fs.existsSync(file)) fs.rmSync(file);
   fs.writeFileSync(file, data, { mode: 0o400 });
   fs.chownSync(file, uid, uid);
 }
-function deliver(t, rec, secretsByFile) {
-  const uid = rec.uid;
+function prepareDir(t, uid) {
   fs.mkdirSync(tdir(t), { recursive: true, mode: 0o500 });
   fs.chownSync(tdir(t), uid, uid);
+}
+function deliver(t, rec, secretsByFile) {
+  const uid = rec.uid;
+  prepareDir(t, uid);
   for (const f of ["current", "previous"]) {
     const p = path.join(tdir(t), f);
     if (secretsByFile[f] === undefined) fs.rmSync(p, { force: true });
@@ -53,21 +77,42 @@ function deliver(t, rec, secretsByFile) {
   }
   writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ version: rec.version, hasPrevious: secretsByFile.previous !== undefined }), uid);
 }
+function deliverRevoked(t, uid) {
+  prepareDir(t, uid);
+  fs.rmSync(path.join(tdir(t), "current"), { force: true });
+  fs.rmSync(path.join(tdir(t), "previous"), { force: true });
+  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ revoked: true }), uid);
+}
 const decrypt = (t, rec, which) => {
   const dek = open(mk(), rec.wrappedDek, `dek:${t}`);
   return open(dek, rec.secrets[which], `secret:${t}:${which === "current" ? rec.version : rec.version - 1}`).toString("utf8");
 };
 
+// Backup da KEK: scrypt(frase) com parametros gravados no blob e autenticados na AAD.
+const kdfAad = (k) => `mk-backup:v1:scrypt:${k.N}:${k.r}:${k.p}`;
+const kdfKey = (phrase, salt, k) => crypto.scryptSync(phrase, salt, 32, { N: k.N, r: k.r, p: k.p, maxmem: 128 * k.N * k.r + 64 * 1024 * 1024 });
+function requirePassphrase(phrase) {
+  if (phrase.length < MIN_PASSPHRASE) throw new Error(`frase curta (minimo ${MIN_PASSPHRASE} caracteres)`);
+  return phrase;
+}
+function checkKdf(k) {
+  const ok = k && k.name === "scrypt" && [2 ** 17, 2 ** 18].includes(k.N) && k.r === 8 && Number.isInteger(k.p) && k.p >= 1 && k.p <= 2;
+  if (!ok) throw new Error("parametros kdf invalidos");
+  return k;
+}
+
 const [cmd, tenant, arg] = process.argv.slice(2);
+if (["create", "rotate", "retire-previous", "revoke"].includes(cmd) || (cmd === "verify-store" && tenant && tenant !== "-")) {
+  tdir(tenant); // valida antes de qualquer E/S
+}
 const store = loadStore();
-const rec = store.tenants[tenant];
+const rec = Object.hasOwn(store.tenants, tenant) ? store.tenants[tenant] : undefined;
 
 switch (cmd) {
   case "create": {
     if (rec && !rec.revoked) throw new Error("tenant ja existe");
     const dek = crypto.randomBytes(32);
-    const n = Object.keys(store.tenants).length;
-    const r = { uid: UID_BASE + n + 1, version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
+    const r = { uid: allocUid(store), version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
     r.secrets.current = seal(dek, Buffer.from(readStdin()), `secret:${tenant}:1`);
     store.tenants[tenant] = r;
     saveStore(store);
@@ -88,6 +133,7 @@ switch (cmd) {
     break;
   }
   case "retire-previous": {
+    if (!rec || rec.revoked) throw new Error("tenant inexistente/revogado");
     delete rec.secrets.previous;
     saveStore(store);
     deliver(tenant, rec, { current: decrypt(tenant, rec, "current") });
@@ -95,34 +141,60 @@ switch (cmd) {
     break;
   }
   case "revoke": {
-    // crypto-shredding: destroi a DEK embrulhada e os segredos cifrados; remove arquivos entregues.
+    // Revogacao por descarte da DEK embrulhada: remove wrappedDek e textos cifrados do store vivo e os
+    // arquivos entregues. NAO e irrecuperavel se houver copia anterior do store enquanto a KEK existir.
+    if (!rec) throw new Error("tenant inexistente");
     store.tenants[tenant] = { uid: rec.uid, version: rec.version, revoked: true };
     saveStore(store);
-    fs.rmSync(path.join(tdir(tenant), "current"), { force: true });
-    fs.rmSync(path.join(tdir(tenant), "previous"), { force: true });
-    writeFile0400(path.join(tdir(tenant), "meta.json"), JSON.stringify({ revoked: true }), rec.uid);
+    deliverRevoked(tenant, rec.uid);
     audit("revoke", tenant, { version: rec.version });
     break;
   }
+  case "redeliver-all": {
+    // recuperacao: reentrega todos os arquivos a partir do store (KEK ja restaurada)
+    let delivered = 0;
+    for (const [t, r] of Object.entries(store.tenants)) {
+      if (r.revoked) { deliverRevoked(t, r.uid); continue; }
+      const files = { current: decrypt(t, r, "current") };
+      if (r.secrets.previous) files.previous = decrypt(t, r, "previous");
+      deliver(t, r, files);
+      delivered += 1;
+    }
+    audit("redeliver-all", "-", { tenants: delivered });
+    console.log(JSON.stringify({ ok: true, delivered }));
+    break;
+  }
   case "backup-mk": {
     // Backup da chave mestra embrulhada por scrypt(frase). A frase vem por stdin.
+    const phrase = requirePassphrase(readStdin());
     const salt = crypto.randomBytes(16);
-    const kek2 = crypto.scryptSync(readStdin(), salt, 32);
-    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: "scrypt", salt: b64(salt), blob: seal(kek2, mk(), "mk-backup") }), { mode: 0o600 });
+    const k = { name: "scrypt", ...KDF };
+    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: k, salt: b64(salt), blob: seal(kdfKey(phrase, salt, k), mk(), kdfAad(k)) }), { mode: 0o600 });
     audit("backup-mk", "-");
     break;
   }
   case "restore-mk": {
     const bk = JSON.parse(fs.readFileSync(arg, "utf8"));
-    const kek2 = crypto.scryptSync(readStdin(), unb64(bk.salt), 32);
-    fs.writeFileSync(MK, open(kek2, bk.blob, "mk-backup"), { mode: 0o400 });
+    if (bk.v !== 1) throw new Error("versao de backup desconhecida");
+    const k = checkKdf(bk.kdf);
+    const key = open(kdfKey(requirePassphrase(readStdin()), unb64(bk.salt), k), bk.blob, kdfAad(k));
+    fs.rmSync(MK, { force: true });
+    fs.writeFileSync(MK, key, { mode: 0o400 });
     audit("restore-mk", "-");
     break;
   }
   case "verify-store": {
-    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores)
-    const ok = Object.entries(store.tenants).filter(([, r]) => !r.revoked).every(([t, r]) => { decrypt(t, r, "current"); return true; });
-    console.log(JSON.stringify({ ok }));
+    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores); {ok:false} + exit 2 se nao
+    const targets = Object.entries(store.tenants).filter(([t, r]) => !r.revoked && (!tenant || tenant === "-" || t === tenant));
+    let result;
+    if (tenant && tenant !== "-" && targets.length === 0) result = { ok: false, reason: "tenant-inexistente-ou-revogado" };
+    else if (!fs.existsSync(MK)) result = { ok: false, reason: "kek-ausente" };
+    else {
+      try { for (const [t, r] of targets) decrypt(t, r, "current"); result = { ok: true, checked: targets.length }; }
+      catch { result = { ok: false, reason: "kek-invalida" }; }
+    }
+    console.log(JSON.stringify(result));
+    if (!result.ok) process.exitCode = 2;
     break;
   }
   default:
diff --git a/documentacoes/arquitetura/poc/dec-006/poc.test.mjs b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
index ea4f427..4efae38 100644
--- a/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
+++ b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
@@ -1,8 +1,8 @@
-// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs.
+// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs/argv/volumes.
 // Valores 100% sinteticos gerados a cada execucao. Containers sem rede (--network none), sem portas.
 import test, { before, after } from "node:test";
 import assert from "node:assert/strict";
-import { execFileSync, spawnSync } from "node:child_process";
+import { spawnSync } from "node:child_process";
 import crypto from "node:crypto";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
@@ -16,8 +16,10 @@ const hmac = (v) => crypto.createHmac("sha256", v).update("challenge").digest("h
 
 const MK = crypto.randomBytes(32);
 const PASS = sentinel("passphrase");
-const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1") };
+const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1"), u: sentinel("uid"), u2: sentinel("uid-v2") };
 const all = () => Object.values(S).concat([MK.toString("hex"), MK.toString("base64"), PASS]);
+// UNICA funcao de deteccao, usada nos canais reais e nos controles negativos
+const hits = (text, values = all()) => values.filter((v) => text.includes(v));
 
 const docker = (args, input) => {
   const r = spawnSync("docker", args, { input, encoding: "utf8" });
@@ -26,7 +28,22 @@ const docker = (args, input) => {
 };
 const containers = [];
 const volumes = [];
-const broker = (args, input) => docker(["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
+const V = { secrets: N("secrets"), mk: N("mk"), store: N("store") };
+// stdout+stderr de TODAS as chamadas ao broker, para varredura de ausencia de segredo
+const brokerOut = [];
+const execIn = (sink, args, input) => {
+  const r = spawnSync("docker", args, { input, encoding: "utf8" });
+  sink.push(r.stdout, r.stderr);
+  return r;
+};
+const brokerRaw = (args, input) => execIn(brokerOut, ["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
+const broker = (args, input) => {
+  const r = brokerRaw(args, input);
+  if (r.status !== 0) throw new Error(`broker ${args[0]} falhou (status ${r.status}): ${r.stderr.slice(0, 300)}`);
+  return r.stdout;
+};
+const inBroker = (cmd) => docker(["exec", N("broker"), "sh", "-c", cmd]);
+const storeJson = () => JSON.parse(docker(["exec", N("broker"), "cat", "/var/broker/store.json"]));
 const tenantCheck = (t) => JSON.parse(docker(["exec", N(t), "node", "/app/tenant-app.mjs", "hmac"]));
 const identity = (t) => JSON.parse(docker(["inspect", N(t), "--format", "{{json .}}"]));
 const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.State.StartedAt, restarts: i.RestartCount }; };
@@ -34,18 +51,42 @@ const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.Stat
 function startTenant(t, uid) {
   docker(["run", "-d", "--name", N(t), "--network", "none", "--user", String(uid), "--read-only", "--cap-drop", "ALL",
     "-v", `${here}:/app:ro`,
-    "--mount", `type=volume,src=${N("secrets")},dst=/run/secrets,readonly,volume-subpath=${t}`,
+    "--mount", `type=volume,src=${V.secrets},dst=/run/secrets,readonly,volume-subpath=${t}`,
     IMG, "node", "/app/tenant-app.mjs"]);
   containers.push(N(t));
 }
 
+// Canais de um container: inspect, logs (stdout+stderr), env, environ do PID 1 e argv de todos os processos.
+function channels(n) {
+  const logs = spawnSync("docker", ["logs", n], { encoding: "utf8" });
+  return {
+    inspect: docker(["inspect", n]),
+    logs: logs.stdout + logs.stderr,
+    env: docker(["exec", n, "env"]),
+    environ: docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"]),
+    cmdline: docker(["exec", n, "sh", "-c", "cat /proc/[0-9]*/cmdline | tr '\\0' '\\n'"]),
+  };
+}
+
+// Conteudo de um volume lido por container auxiliar (somente leitura): [{p, buf}]
+const WALK = "const fs=require('fs'),path=require('path');const o=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.isFile())o.push({p:p.slice(3),b:fs.readFileSync(p).toString('base64')})}})('/v');console.log(JSON.stringify(o))";
+function volumeFiles(vol) {
+  const out = docker(["run", "--rm", "--network", "none", "--user", "0", "-v", `${vol}:/v:ro`, IMG, "node", "-e", WALK]);
+  return JSON.parse(out).map(({ p, b }) => ({ p, buf: Buffer.from(b, "base64") }));
+}
+function fileHits(buf, values = all(), rawKey = true) {
+  const h = hits(buf.toString("latin1"), values);
+  if (rawKey && buf.includes(MK)) h.push("RAW-MK");
+  return h;
+}
+
 before(() => {
-  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", N("secrets")]);
-  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", N("mk")]);
-  docker(["volume", "create", N("store")]);
-  volumes.push(N("secrets"), N("mk"), N("store"));
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", V.secrets]);
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", V.mk]);
+  docker(["volume", "create", V.store]);
+  volumes.push(V.secrets, V.mk, V.store);
   docker(["run", "-d", "--name", N("broker"), "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
-    "-v", `${here}:/app:ro`, "-v", `${N("secrets")}:/tenants`, "-v", `${N("mk")}:/run/mk`, "-v", `${N("store")}:/var/broker`,
+    "-v", `${here}:/app:ro`, "-v", `${V.secrets}:/tenants`, "-v", `${V.mk}:/run/mk`, "-v", `${V.store}:/var/broker`,
     IMG, "sleep", "3600"]);
   containers.push(N("broker"));
   // a chave mestra entra por stdin direto no tmpfs do broker (nunca env, nunca argv, nunca imagem)
@@ -67,9 +108,18 @@ test("AC-1: cria, entrega, rotaciona e revoga segredo de tenant sem reiniciar ou
   assert.equal(tenantCheck("tenant-a").current, hmac(S.a1), "entrega a");
   assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "entrega b");
 
-  // isolamento: tenant-a nao enxerga o diretorio do tenant-b
-  const peek = spawnSync("docker", ["exec", N("tenant-a"), "ls", "/run/secrets/../"], { encoding: "utf8" });
-  assert.ok(!peek.stdout.includes("tenant-b"));
+  // isolamento: leitura real de segredo de outro tenant falha; leitura do proprio funciona (controle positivo)
+  const read = (t, p) => spawnSync("docker", ["exec", N(t), "cat", p], { encoding: "utf8" });
+  assert.equal(read("tenant-a", "/run/secrets/current").stdout, S.a1, "controle positivo: le o proprio segredo");
+  assert.equal(read("tenant-b", "/run/secrets/current").stdout, S.b1, "controle positivo: le o proprio segredo");
+  for (const [from, other, otherSecret] of [["tenant-a", "tenant-b", S.b1], ["tenant-b", "tenant-a", S.a1]]) {
+    for (const p of [`/run/secrets/${other}/current`, `/run/secrets/../${other}/current`, `/run/secrets/../secrets/${other}/current`, `/tenants/${other}/current`]) {
+      const r = read(from, p);
+      assert.notEqual(r.status, 0, `${from} nao pode ler ${p}`);
+      assert.ok(!r.stdout.includes(otherSecret));
+    }
+    assert.equal(docker(["exec", N(from), "ls", "/run/secrets"]).split("\n").filter(Boolean).sort().join(","), "current,meta.json");
+  }
 
   // rotacao com janela dupla
   const aBefore = stamp("tenant-a");
@@ -92,45 +142,180 @@ test("AC-1: cria, entrega, rotaciona e revoga segredo de tenant sem reiniciar ou
   // criptografia em repouso: store nao contem valores em claro
   const store = docker(["exec", N("broker"), "cat", "/var/broker/store.json"]);
   for (const v of all()) assert.ok(!store.includes(v));
+  // REVIEW-003: apos revoke, wrappedDek e segredos cifrados sumiram do store vivo (nao se afirma irrecuperabilidade)
+  const revoked = JSON.parse(store).tenants["tenant-a"];
+  assert.deepEqual(Object.keys(revoked).sort(), ["revoked", "uid", "version"]);
+  assert.equal(revoked.wrappedDek, undefined);
+  assert.equal(revoked.secrets, undefined);
   const aud = docker(["exec", N("broker"), "cat", "/var/broker/audit.log"]);
   assert.deepEqual(aud.trim().split("\n").map((l) => JSON.parse(l).event),
     ["create", "create", "rotate", "retire-previous", "revoke"]);
   for (const v of all()) assert.ok(!aud.includes(v));
 });
 
-test("AC-2: ausencia de segredo em env, inspect e logs", () => {
-  // novo segredo vivo para que o scan cubra tenant ativo (b) e o broker
+test("REVIEW-001: UID nunca e reutilizado (create/revoke/recreate)", () => {
+  const uidOf = (t) => storeJson().tenants[t].uid;
+  broker(["create", "uid-a"], S.u);
+  broker(["create", "uid-b"], S.u);
+  const a1 = uidOf("uid-a");
+  const b = uidOf("uid-b");
+  broker(["revoke", "uid-a"]);
+  broker(["create", "uid-a"], S.u); // recria o mesmo nome revogado
+  broker(["create", "uid-c"], S.u);
+  broker(["rotate", "uid-c"], S.u2); // deixa previous para o teste de reentrega
+  const st = storeJson();
+  const uids = Object.values(st.tenants).map((t) => t.uid);
+  assert.equal(new Set(uids).size, uids.length, `UIDs duplicados: ${uids}`);
+  assert.notEqual(uidOf("uid-a"), a1, "recriacao recebe UID novo");
+  assert.equal(uidOf("uid-b"), b);
+  assert.ok(st.nextUid > Math.max(...uids), "nextUid persistido e maior que todos os UIDs");
+  // store legado sem nextUid: reinicializa em max(uid)+1
+  inBroker(`node -e "const fs=require('fs');const p='/var/broker/store.json';const s=JSON.parse(fs.readFileSync(p));delete s.nextUid;fs.writeFileSync(p,JSON.stringify(s))"`);
+  broker(["create", "uid-d"], S.u);
+  const st2 = storeJson();
+  const uids2 = Object.values(st2.tenants).map((t) => t.uid);
+  assert.equal(new Set(uids2).size, uids2.length);
+  assert.ok(st2.tenants["uid-d"].uid > Math.max(...uids));
+});
+
+test("REVIEW-002: nomes de tenant fora da allowlist sao rejeitados antes de qualquer E/S", () => {
+  const snapshot = () => inBroker("cat /var/broker/store.json; find /tenants | sort; ls -d /victim /x /tenants/../x 2>&1; true");
+  const before = snapshot();
+  const bad = ["..", ".", "../x", "a/b", "", "Maiusc", "a b", "-x", "../../victim/x", "a".repeat(64), "x\ny"];
+  for (const name of bad) {
+    for (const cmd of ["create", "rotate", "retire-previous", "revoke"]) {
+      const r = brokerRaw([cmd, name], S.u);
+      assert.notEqual(r.status, 0, `${cmd} ${JSON.stringify(name)} deveria falhar`);
+      assert.ok(r.stderr.includes("nome de tenant invalido"), `${cmd} ${JSON.stringify(name)}: ${r.stderr.slice(0, 200)}`);
+    }
+  }
+  assert.equal(snapshot(), before, "nada criado/alterado (store, /tenants, fora da raiz)");
+  assert.equal(brokerRaw(["verify-store", "../x"]).status, 1, "verify-store tambem valida o nome");
+});
+
+test("AC-2: ausencia de segredo em env, inspect, logs, argv, saida do broker e conteudo dos volumes", () => {
   const names = [N("broker"), N("tenant-a"), N("tenant-b")];
-  const hits = (text) => all().filter((v) => text.includes(v));
   for (const n of names) {
-    assert.deepEqual(hits(docker(["inspect", n])), [], `inspect ${n}`);
-    assert.deepEqual(hits(docker(["logs", n])), [], `logs ${n}`);
-    assert.deepEqual(hits(docker(["exec", n, "env"])), [], `env ${n}`);
-    assert.deepEqual(hits(docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"])), [], `environ ${n}`);
+    for (const [canal, texto] of Object.entries(channels(n))) assert.deepEqual(hits(texto), [], `${canal} ${n}`);
   }
-  for (const v of volumes) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume ${v}`);
+  // stdout/stderr de todas as chamadas ao broker (create/rotate/revoke, erros com stack)
+  assert.ok(brokerOut.length > 10, "captura nao vazia");
+  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
+  for (const v of Object.values(V)) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume inspect ${v}`);
   assert.deepEqual(hits(docker(["image", "inspect", IMG])), []);
-  // o tenant ativo realmente enxerga o segredo por arquivo (o scan nao e vazio)
+
+  // conteudo dos volumes, com allowlist explicita dos arquivos legitimamente entregues
+  const active = Object.entries(storeJson().tenants).filter(([, r]) => !r.revoked).map(([t]) => t);
+  const allowedSecretFiles = new Set(active.flatMap((t) => [`${t}/current`, `${t}/previous`]));
+  const isSecret = (h) => Object.values(S).includes(h);
+  const unexpected = [];
+  const seen = new Set();
+  for (const [role, vol] of Object.entries(V)) {
+    for (const { p, buf } of volumeFiles(vol)) {
+      seen.add(`${role}:${p}`);
+      for (const h of fileHits(buf)) {
+        const ok = (role === "secrets" && allowedSecretFiles.has(p) && isSecret(h)) || (role === "mk" && p === "master.key" && h === "RAW-MK");
+        if (!ok) unexpected.push(`${role}:${p}:${h.slice(0, 18)}`);
+      }
+    }
+  }
+  assert.deepEqual(unexpected, [], "segredo em arquivo de volume fora da allowlist");
+  // a varredura nao e vazia: viu os arquivos legitimos
+  assert.ok(seen.has("secrets:tenant-b/current") && seen.has("mk:master.key") && seen.has("store:store.json"));
+  assert.ok(fileHits(volumeFiles(V.secrets).find((f) => f.p === "tenant-b/current").buf).includes(S.b1));
   assert.equal(tenantCheck("tenant-b").current, hmac(S.b1));
 });
 
-test("controle negativo: o scanner detecta segredo vazado via -e", () => {
+test("controle negativo: a mesma hits() detecta vazamento em cada canal", () => {
   const leak = sentinel("leak");
-  docker(["run", "-d", "--name", N("leaky"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "60"]);
-  containers.push(N("leaky"));
-  assert.ok(docker(["inspect", N("leaky")]).includes(leak));
-  assert.ok(docker(["exec", N("leaky"), "env"]).includes(leak));
+  const only = (text) => hits(text, [leak]);
+  // env / inspect / environ
+  docker(["run", "-d", "--name", N("leak-env"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "120"]);
+  containers.push(N("leak-env"));
+  const ce = channels(N("leak-env"));
+  for (const c of ["inspect", "env", "environ"]) assert.deepEqual(only(ce[c]), [leak], `canal ${c}`);
+  // logs e argv
+  docker(["run", "-d", "--name", N("leak-log"), "--network", "none", IMG, "sh", "-c", 'echo "$0"; sleep 120; :', leak]);
+  containers.push(N("leak-log"));
+  const cl = channels(N("leak-log"));
+  for (const c of ["logs", "cmdline"]) assert.deepEqual(only(cl[c]), [leak], `canal ${c}`);
+  // arquivo em volume (mesmo varredor de conteudo)
+  const ctl = N("ctl");
+  docker(["volume", "create", ctl]);
+  volumes.push(ctl);
+  docker(["run", "--rm", "--network", "none", "-v", `${ctl}:/v`, IMG, "sh", "-c", 'echo "$0" > /v/f', leak]);
+  assert.deepEqual(volumeFiles(ctl).filter((f) => fileHits(f.buf, [leak], false).length).map((f) => f.p), ["f"]);
+  // saida capturada do broker
+  const sink = [];
+  execIn(sink, ["exec", N("broker"), "sh", "-c", 'echo "$0"', leak]);
+  assert.deepEqual(only(sink.join("\n")), [leak]);
+  // controle do controle: sem vazamento nada e detectado
+  assert.deepEqual(only(channels(N("broker")).logs + brokerOut.join("")), []);
 });
 
-test("backup e recuperacao da chave mestra", () => {
+test("backup da KEK: KDF parametrizado, frase curta rejeitada, parametros adulterados falham", () => {
   broker(["backup-mk", "-", "/var/broker/mk.backup.json"], PASS);
-  const bk = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
-  for (const v of all()) assert.ok(!bk.includes(v), "backup nao expoe a chave");
-  docker(["exec", N("broker"), "rm", "/run/mk/master.key"]);  // desastre: perda da KEK
-  assert.throws(() => broker(["verify-store", "tenant-b"]));
-  assert.throws(() => broker(["restore-mk", "-", "/var/broker/mk.backup.json"], "frase-errada"));
-  broker(["restore-mk", "-", "/var/broker/mk.backup.json"], PASS);
-  assert.equal(JSON.parse(broker(["verify-store", "tenant-b"])).ok, true);
-  const restored = docker(["exec", N("broker"), "sh", "-c", "base64 /run/mk/master.key"]).trim();
-  assert.equal(Buffer.from(restored, "base64").equals(MK), true);
+  const raw = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
+  for (const v of all()) assert.ok(!raw.includes(v), "backup nao expoe a chave");
+  const bk = JSON.parse(raw);
+  assert.deepEqual(bk.kdf, { name: "scrypt", N: 2 ** 17, r: 8, p: 1 }, "parametros gravados no blob");
+  const mkB64 = () => inBroker("base64 /run/mk/master.key").trim();
+  const mkBefore = mkB64();
+
+  // frase vazia/curta rejeitada, sem arquivo gerado
+  for (const phrase of ["", "curta", "x".repeat(15)]) {
+    const r = brokerRaw(["backup-mk", "-", "/var/broker/mk.short.json"], phrase);
+    assert.notEqual(r.status, 0);
+    assert.ok(r.stderr.includes("frase curta"));
+  }
+  assert.equal(inBroker("ls /var/broker/mk.short.json 2>&1; true").includes("No such file"), true);
+
+  // parametros/versao adulterados: falham sem tocar na KEK
+  const tamper = (mut) => {
+    const b = structuredClone(bk);
+    mut(b);
+    docker(["exec", "-i", N("broker"), "sh", "-c", "cat > /var/broker/mk.t.json"], JSON.stringify(b));
+    return brokerRaw(["restore-mk", "-", "/var/broker/mk.t.json"], PASS);
+  };
+  assert.notEqual(tamper((b) => { b.kdf.p = 2; }).status, 0, "p alterado (valido) falha por autenticacao");
+  assert.notEqual(tamper((b) => { b.kdf.N = 2 ** 18; }).status, 0, "N alterado (valido) falha por autenticacao");
+  assert.ok(tamper((b) => { b.kdf.N = 2 ** 14; }).stderr.includes("parametros kdf invalidos"), "N fraco recusado");
+  assert.ok(tamper((b) => { b.v = 2; }).stderr.includes("versao de backup"));
+  assert.equal(tamper(() => {}).status, 0, "controle: backup integro restaura");
+  assert.equal(mkB64(), mkBefore, "KEK intacta");
+});
+
+test("desastre completo: perde KEK e arquivos entregues, restaura e reentrega", () => {
+  const restoreArgs = ["restore-mk", "-", "/var/broker/mk.backup.json"];
+  const mkBefore = inBroker("base64 /run/mk/master.key").trim();
+  // desastre
+  inBroker("rm /run/mk/master.key; find /tenants -type f -delete");
+  assert.equal(tenantCheck("tenant-b").current, null, "arquivos entregues apagados");
+  let v = brokerRaw(["verify-store", "tenant-b"]);
+  assert.equal(v.status, 2);
+  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-ausente" });
+  // KEK errada nao passa como valida
+  docker(["exec", "-i", N("broker"), "sh", "-c", "umask 277; cat > /run/mk/master.key"], crypto.randomBytes(32));
+  v = brokerRaw(["verify-store", "tenant-b"]);
+  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-invalida" });
+  // frase errada rejeitada (longa o bastante para chegar a autenticacao)
+  const wrong = brokerRaw(restoreArgs, "frase-errada-mas-longa-123");
+  assert.notEqual(wrong.status, 0);
+  assert.deepEqual(JSON.parse(brokerRaw(["verify-store", "tenant-b"]).stdout), { ok: false, reason: "kek-invalida" });
+  // restauracao + verificacao + reentrega
+  broker(restoreArgs, PASS);
+  assert.deepEqual(JSON.parse(broker(["verify-store", "tenant-b"])), { ok: true, checked: 1 });
+  assert.equal(inBroker("base64 /run/mk/master.key").trim(), mkBefore);
+  assert.equal(Buffer.from(mkBefore, "base64").equals(MK), true);
+  const active = Object.values(storeJson().tenants).filter((t) => !t.revoked).length;
+  assert.deepEqual(JSON.parse(broker(["redeliver-all"])), { ok: true, delivered: active });
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "tenant-b volta a ler o segredo correto");
+  const a = tenantCheck("tenant-a");
+  assert.equal(a.current, null, "revogado continua sem segredo");
+  assert.equal(inBroker("cat /tenants/tenant-a/meta.json"), JSON.stringify({ revoked: true }));
+  assert.equal(inBroker("cat /tenants/uid-c/current"), S.u2, "versao rotacionada reentregue");
+  assert.equal(inBroker("cat /tenants/uid-c/previous"), S.u, "janela dupla reentregue");
+  assert.equal(inBroker("cat /tenants/uid-a/current"), S.u);
+  // nada vazou na saida do broker durante backup/desastre/recuperacao
+  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
 });
```
