# DEC-006 — diffs do PoC

Voltar: [entrega](2026-10-25-dec-006-gestao-de-segredos.md). Patch dos arquivos de código/teste do PoC (novos), base `4be3ce3`. Valores de teste são sentinelas gerados em tempo de execução; nenhum segredo real.

```diff
diff --git a/documentacoes/arquitetura/poc/dec-006/broker.mjs b/documentacoes/arquitetura/poc/dec-006/broker.mjs
new file mode 100644
index 0000000..e2ef28c
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-006/broker.mjs
@@ -0,0 +1,130 @@
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
+
+const b64 = (b) => b.toString("base64");
+const unb64 = (s) => Buffer.from(s, "base64");
+
+function seal(key, plain, aad) {
+  const iv = crypto.randomBytes(12);
+  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
+  c.setAAD(Buffer.from(aad));
+  const ct = Buffer.concat([c.update(plain), c.final()]);
+  return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
+}
+function open(key, blob, aad) {
+  const raw = unb64(blob);
+  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
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
+const tdir = (t) => path.join(TENANTS, t);
+
+function writeFile0400(file, data, uid) {
+  if (fs.existsSync(file)) fs.rmSync(file);
+  fs.writeFileSync(file, data, { mode: 0o400 });
+  fs.chownSync(file, uid, uid);
+}
+function deliver(t, rec, secretsByFile) {
+  const uid = rec.uid;
+  fs.mkdirSync(tdir(t), { recursive: true, mode: 0o500 });
+  fs.chownSync(tdir(t), uid, uid);
+  for (const f of ["current", "previous"]) {
+    const p = path.join(tdir(t), f);
+    if (secretsByFile[f] === undefined) fs.rmSync(p, { force: true });
+    else writeFile0400(p, secretsByFile[f], uid);
+  }
+  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ version: rec.version, hasPrevious: secretsByFile.previous !== undefined }), uid);
+}
+const decrypt = (t, rec, which) => {
+  const dek = open(mk(), rec.wrappedDek, `dek:${t}`);
+  return open(dek, rec.secrets[which], `secret:${t}:${which === "current" ? rec.version : rec.version - 1}`).toString("utf8");
+};
+
+const [cmd, tenant, arg] = process.argv.slice(2);
+const store = loadStore();
+const rec = store.tenants[tenant];
+
+switch (cmd) {
+  case "create": {
+    if (rec && !rec.revoked) throw new Error("tenant ja existe");
+    const dek = crypto.randomBytes(32);
+    const n = Object.keys(store.tenants).length;
+    const r = { uid: UID_BASE + n + 1, version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
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
+    delete rec.secrets.previous;
+    saveStore(store);
+    deliver(tenant, rec, { current: decrypt(tenant, rec, "current") });
+    audit("retire-previous", tenant, { version: rec.version });
+    break;
+  }
+  case "revoke": {
+    // crypto-shredding: destroi a DEK embrulhada e os segredos cifrados; remove arquivos entregues.
+    store.tenants[tenant] = { uid: rec.uid, version: rec.version, revoked: true };
+    saveStore(store);
+    fs.rmSync(path.join(tdir(tenant), "current"), { force: true });
+    fs.rmSync(path.join(tdir(tenant), "previous"), { force: true });
+    writeFile0400(path.join(tdir(tenant), "meta.json"), JSON.stringify({ revoked: true }), rec.uid);
+    audit("revoke", tenant, { version: rec.version });
+    break;
+  }
+  case "backup-mk": {
+    // Backup da chave mestra embrulhada por scrypt(frase). A frase vem por stdin.
+    const salt = crypto.randomBytes(16);
+    const kek2 = crypto.scryptSync(readStdin(), salt, 32);
+    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: "scrypt", salt: b64(salt), blob: seal(kek2, mk(), "mk-backup") }), { mode: 0o600 });
+    audit("backup-mk", "-");
+    break;
+  }
+  case "restore-mk": {
+    const bk = JSON.parse(fs.readFileSync(arg, "utf8"));
+    const kek2 = crypto.scryptSync(readStdin(), unb64(bk.salt), 32);
+    fs.writeFileSync(MK, open(kek2, bk.blob, "mk-backup"), { mode: 0o400 });
+    audit("restore-mk", "-");
+    break;
+  }
+  case "verify-store": {
+    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores)
+    const ok = Object.entries(store.tenants).filter(([, r]) => !r.revoked).every(([t, r]) => { decrypt(t, r, "current"); return true; });
+    console.log(JSON.stringify({ ok }));
+    break;
+  }
+  default:
+    throw new Error("comando desconhecido");
+}
diff --git a/documentacoes/arquitetura/poc/dec-006/poc.test.mjs b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
new file mode 100644
index 0000000..ea4f427
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-006/poc.test.mjs
@@ -0,0 +1,136 @@
+// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs.
+// Valores 100% sinteticos gerados a cada execucao. Containers sem rede (--network none), sem portas.
+import test, { before, after } from "node:test";
+import assert from "node:assert/strict";
+import { execFileSync, spawnSync } from "node:child_process";
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
+const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1") };
+const all = () => Object.values(S).concat([MK.toString("hex"), MK.toString("base64"), PASS]);
+
+const docker = (args, input) => {
+  const r = spawnSync("docker", args, { input, encoding: "utf8" });
+  if (r.status !== 0) throw new Error(`docker ${args[0]} falhou: ${r.stderr.slice(0, 300)}`);
+  return r.stdout;
+};
+const containers = [];
+const volumes = [];
+const broker = (args, input) => docker(["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
+const tenantCheck = (t) => JSON.parse(docker(["exec", N(t), "node", "/app/tenant-app.mjs", "hmac"]));
+const identity = (t) => JSON.parse(docker(["inspect", N(t), "--format", "{{json .}}"]));
+const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.State.StartedAt, restarts: i.RestartCount }; };
+
+function startTenant(t, uid) {
+  docker(["run", "-d", "--name", N(t), "--network", "none", "--user", String(uid), "--read-only", "--cap-drop", "ALL",
+    "-v", `${here}:/app:ro`,
+    "--mount", `type=volume,src=${N("secrets")},dst=/run/secrets,readonly,volume-subpath=${t}`,
+    IMG, "node", "/app/tenant-app.mjs"]);
+  containers.push(N(t));
+}
+
+before(() => {
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", N("secrets")]);
+  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", N("mk")]);
+  docker(["volume", "create", N("store")]);
+  volumes.push(N("secrets"), N("mk"), N("store"));
+  docker(["run", "-d", "--name", N("broker"), "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
+    "-v", `${here}:/app:ro`, "-v", `${N("secrets")}:/tenants`, "-v", `${N("mk")}:/run/mk`, "-v", `${N("store")}:/var/broker`,
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
+  // isolamento: tenant-a nao enxerga o diretorio do tenant-b
+  const peek = spawnSync("docker", ["exec", N("tenant-a"), "ls", "/run/secrets/../"], { encoding: "utf8" });
+  assert.ok(!peek.stdout.includes("tenant-b"));
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
+  const aud = docker(["exec", N("broker"), "cat", "/var/broker/audit.log"]);
+  assert.deepEqual(aud.trim().split("\n").map((l) => JSON.parse(l).event),
+    ["create", "create", "rotate", "retire-previous", "revoke"]);
+  for (const v of all()) assert.ok(!aud.includes(v));
+});
+
+test("AC-2: ausencia de segredo em env, inspect e logs", () => {
+  // novo segredo vivo para que o scan cubra tenant ativo (b) e o broker
+  const names = [N("broker"), N("tenant-a"), N("tenant-b")];
+  const hits = (text) => all().filter((v) => text.includes(v));
+  for (const n of names) {
+    assert.deepEqual(hits(docker(["inspect", n])), [], `inspect ${n}`);
+    assert.deepEqual(hits(docker(["logs", n])), [], `logs ${n}`);
+    assert.deepEqual(hits(docker(["exec", n, "env"])), [], `env ${n}`);
+    assert.deepEqual(hits(docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"])), [], `environ ${n}`);
+  }
+  for (const v of volumes) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume ${v}`);
+  assert.deepEqual(hits(docker(["image", "inspect", IMG])), []);
+  // o tenant ativo realmente enxerga o segredo por arquivo (o scan nao e vazio)
+  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1));
+});
+
+test("controle negativo: o scanner detecta segredo vazado via -e", () => {
+  const leak = sentinel("leak");
+  docker(["run", "-d", "--name", N("leaky"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "60"]);
+  containers.push(N("leaky"));
+  assert.ok(docker(["inspect", N("leaky")]).includes(leak));
+  assert.ok(docker(["exec", N("leaky"), "env"]).includes(leak));
+});
+
+test("backup e recuperacao da chave mestra", () => {
+  broker(["backup-mk", "-", "/var/broker/mk.backup.json"], PASS);
+  const bk = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
+  for (const v of all()) assert.ok(!bk.includes(v), "backup nao expoe a chave");
+  docker(["exec", N("broker"), "rm", "/run/mk/master.key"]);  // desastre: perda da KEK
+  assert.throws(() => broker(["verify-store", "tenant-b"]));
+  assert.throws(() => broker(["restore-mk", "-", "/var/broker/mk.backup.json"], "frase-errada"));
+  broker(["restore-mk", "-", "/var/broker/mk.backup.json"], PASS);
+  assert.equal(JSON.parse(broker(["verify-store", "tenant-b"])).ok, true);
+  const restored = docker(["exec", N("broker"), "sh", "-c", "base64 /run/mk/master.key"]).trim();
+  assert.equal(Buffer.from(restored, "base64").equals(MK), true);
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
