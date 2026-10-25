// Broker de segredos do PoC DEC-006 (sem dependencias; apenas node:crypto/node:fs).
// Hierarquia: chave mestra (KEK, tmpfs 0400) -> DEK por tenant (AES-256-GCM, embrulhada pela KEK)
// -> segredo do tenant (AES-256-GCM sob a DEK). Entrega: arquivos 0400 em /tenants/<id>/.
// O valor do segredo entra SOMENTE por stdin; nunca por argv ou env.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MK = process.env.MK_PATH ?? "/run/mk/master.key";
const STORE = process.env.STORE_PATH ?? "/var/broker/store.json";
const AUDIT = process.env.AUDIT_PATH ?? "/var/broker/audit.log";
const TENANTS = process.env.TENANTS_DIR ?? "/tenants";
const UID_BASE = 10000;

const b64 = (b) => b.toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");

function seal(key, plain, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
}
function open(key, blob, aad) {
  const raw = unb64(blob);
  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}
const loadStore = () => (fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : { tenants: {} });
const saveStore = (s) => fs.writeFileSync(STORE, JSON.stringify(s, null, 2), { mode: 0o600 });
const audit = (event, tenant, extra = {}) =>
  fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), event, tenant, ...extra }) + "\n");
const readStdin = () => fs.readFileSync(0).toString("utf8").replace(/\r?\n$/, "");
const mk = () => fs.readFileSync(MK);
const tdir = (t) => path.join(TENANTS, t);

function writeFile0400(file, data, uid) {
  if (fs.existsSync(file)) fs.rmSync(file);
  fs.writeFileSync(file, data, { mode: 0o400 });
  fs.chownSync(file, uid, uid);
}
function deliver(t, rec, secretsByFile) {
  const uid = rec.uid;
  fs.mkdirSync(tdir(t), { recursive: true, mode: 0o500 });
  fs.chownSync(tdir(t), uid, uid);
  for (const f of ["current", "previous"]) {
    const p = path.join(tdir(t), f);
    if (secretsByFile[f] === undefined) fs.rmSync(p, { force: true });
    else writeFile0400(p, secretsByFile[f], uid);
  }
  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ version: rec.version, hasPrevious: secretsByFile.previous !== undefined }), uid);
}
const decrypt = (t, rec, which) => {
  const dek = open(mk(), rec.wrappedDek, `dek:${t}`);
  return open(dek, rec.secrets[which], `secret:${t}:${which === "current" ? rec.version : rec.version - 1}`).toString("utf8");
};

const [cmd, tenant, arg] = process.argv.slice(2);
const store = loadStore();
const rec = store.tenants[tenant];

switch (cmd) {
  case "create": {
    if (rec && !rec.revoked) throw new Error("tenant ja existe");
    const dek = crypto.randomBytes(32);
    const n = Object.keys(store.tenants).length;
    const r = { uid: UID_BASE + n + 1, version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
    r.secrets.current = seal(dek, Buffer.from(readStdin()), `secret:${tenant}:1`);
    store.tenants[tenant] = r;
    saveStore(store);
    deliver(tenant, r, { current: decrypt(tenant, r, "current") });
    audit("create", tenant, { version: 1 });
    break;
  }
  case "rotate": {
    if (!rec || rec.revoked) throw new Error("tenant inexistente/revogado");
    const prev = decrypt(tenant, rec, "current");
    const dek = open(mk(), rec.wrappedDek, `dek:${tenant}`);
    const next = rec.version + 1;
    rec.secrets = { current: seal(dek, Buffer.from(readStdin()), `secret:${tenant}:${next}`), previous: seal(dek, Buffer.from(prev), `secret:${tenant}:${rec.version}`) };
    rec.version = next;
    saveStore(store);
    deliver(tenant, rec, { current: decrypt(tenant, rec, "current"), previous: prev });
    audit("rotate", tenant, { version: next, dualWindow: true });
    break;
  }
  case "retire-previous": {
    delete rec.secrets.previous;
    saveStore(store);
    deliver(tenant, rec, { current: decrypt(tenant, rec, "current") });
    audit("retire-previous", tenant, { version: rec.version });
    break;
  }
  case "revoke": {
    // crypto-shredding: destroi a DEK embrulhada e os segredos cifrados; remove arquivos entregues.
    store.tenants[tenant] = { uid: rec.uid, version: rec.version, revoked: true };
    saveStore(store);
    fs.rmSync(path.join(tdir(tenant), "current"), { force: true });
    fs.rmSync(path.join(tdir(tenant), "previous"), { force: true });
    writeFile0400(path.join(tdir(tenant), "meta.json"), JSON.stringify({ revoked: true }), rec.uid);
    audit("revoke", tenant, { version: rec.version });
    break;
  }
  case "backup-mk": {
    // Backup da chave mestra embrulhada por scrypt(frase). A frase vem por stdin.
    const salt = crypto.randomBytes(16);
    const kek2 = crypto.scryptSync(readStdin(), salt, 32);
    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: "scrypt", salt: b64(salt), blob: seal(kek2, mk(), "mk-backup") }), { mode: 0o600 });
    audit("backup-mk", "-");
    break;
  }
  case "restore-mk": {
    const bk = JSON.parse(fs.readFileSync(arg, "utf8"));
    const kek2 = crypto.scryptSync(readStdin(), unb64(bk.salt), 32);
    fs.writeFileSync(MK, open(kek2, bk.blob, "mk-backup"), { mode: 0o400 });
    audit("restore-mk", "-");
    break;
  }
  case "verify-store": {
    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores)
    const ok = Object.entries(store.tenants).filter(([, r]) => !r.revoked).every(([t, r]) => { decrypt(t, r, "current"); return true; });
    console.log(JSON.stringify({ ok }));
    break;
  }
  default:
    throw new Error("comando desconhecido");
}
