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
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MIN_PASSPHRASE = 16;
const KDF = { N: 2 ** 17, r: 8, p: 1 };

const b64 = (b) => b.toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");

function seal(key, plain, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
}
function open(key, blob, aad) {
  const raw = unb64(blob);
  if (raw.length < 28) throw new Error("blob invalido");
  const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12), { authTagLength: 16 });
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

// Nome de tenant: allowlist + confirmacao de que o diretorio resolvido e filho direto de TENANTS.
const validName = (t) => typeof t === "string" && NAME_RE.test(t);
function tdir(t) {
  if (!validName(t)) throw new Error("nome de tenant invalido");
  const root = path.resolve(TENANTS);
  const dir = path.resolve(root, t);
  if (path.dirname(dir) !== root) throw new Error("tenant fora da raiz");
  return dir;
}

// UID nunca reutilizado: contador persistido; store sem o campo inicia em max(uid)+1.
function allocUid(store) {
  const max = Math.max(UID_BASE, ...Object.values(store.tenants).map((t) => t.uid));
  const uid = Math.max(store.nextUid ?? 0, max + 1);
  store.nextUid = uid + 1;
  return uid;
}

function writeFile0400(file, data, uid) {
  if (fs.existsSync(file)) fs.rmSync(file);
  fs.writeFileSync(file, data, { mode: 0o400 });
  fs.chownSync(file, uid, uid);
}
function prepareDir(t, uid) {
  fs.mkdirSync(tdir(t), { recursive: true, mode: 0o500 });
  fs.chownSync(tdir(t), uid, uid);
}
function deliver(t, rec, secretsByFile) {
  const uid = rec.uid;
  prepareDir(t, uid);
  for (const f of ["current", "previous"]) {
    const p = path.join(tdir(t), f);
    if (secretsByFile[f] === undefined) fs.rmSync(p, { force: true });
    else writeFile0400(p, secretsByFile[f], uid);
  }
  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ version: rec.version, hasPrevious: secretsByFile.previous !== undefined }), uid);
}
function deliverRevoked(t, uid) {
  prepareDir(t, uid);
  fs.rmSync(path.join(tdir(t), "current"), { force: true });
  fs.rmSync(path.join(tdir(t), "previous"), { force: true });
  writeFile0400(path.join(tdir(t), "meta.json"), JSON.stringify({ revoked: true }), uid);
}
const decrypt = (t, rec, which) => {
  const dek = open(mk(), rec.wrappedDek, `dek:${t}`);
  return open(dek, rec.secrets[which], `secret:${t}:${which === "current" ? rec.version : rec.version - 1}`).toString("utf8");
};

// Backup da KEK: scrypt(frase) com parametros gravados no blob e autenticados na AAD.
const kdfAad = (k) => `mk-backup:v1:scrypt:${k.N}:${k.r}:${k.p}`;
const kdfKey = (phrase, salt, k) => crypto.scryptSync(phrase, salt, 32, { N: k.N, r: k.r, p: k.p, maxmem: 128 * k.N * k.r + 64 * 1024 * 1024 });
function requirePassphrase(phrase) {
  if (phrase.length < MIN_PASSPHRASE) throw new Error(`frase curta (minimo ${MIN_PASSPHRASE} caracteres)`);
  return phrase;
}
function checkKdf(k) {
  const ok = k && k.name === "scrypt" && [2 ** 17, 2 ** 18].includes(k.N) && k.r === 8 && Number.isInteger(k.p) && k.p >= 1 && k.p <= 2;
  if (!ok) throw new Error("parametros kdf invalidos");
  return k;
}

const [cmd, tenant, arg] = process.argv.slice(2);
if (["create", "rotate", "retire-previous", "revoke"].includes(cmd) || (cmd === "verify-store" && tenant && tenant !== "-")) {
  tdir(tenant); // valida antes de qualquer E/S
}
const store = loadStore();
const rec = Object.hasOwn(store.tenants, tenant) ? store.tenants[tenant] : undefined;

switch (cmd) {
  case "create": {
    if (rec && !rec.revoked) throw new Error("tenant ja existe");
    const dek = crypto.randomBytes(32);
    const r = { uid: allocUid(store), version: 1, revoked: false, wrappedDek: seal(mk(), dek, `dek:${tenant}`), secrets: {} };
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
    if (!rec || rec.revoked) throw new Error("tenant inexistente/revogado");
    delete rec.secrets.previous;
    saveStore(store);
    deliver(tenant, rec, { current: decrypt(tenant, rec, "current") });
    audit("retire-previous", tenant, { version: rec.version });
    break;
  }
  case "revoke": {
    // Revogacao por descarte da DEK embrulhada: remove wrappedDek e textos cifrados do store vivo e os
    // arquivos entregues. NAO e irrecuperavel se houver copia anterior do store enquanto a KEK existir.
    if (!rec) throw new Error("tenant inexistente");
    store.tenants[tenant] = { uid: rec.uid, version: rec.version, revoked: true };
    saveStore(store);
    deliverRevoked(tenant, rec.uid);
    audit("revoke", tenant, { version: rec.version });
    break;
  }
  case "redeliver-all": {
    // recuperacao: reentrega todos os arquivos a partir do store (KEK ja restaurada)
    let delivered = 0;
    for (const [t, r] of Object.entries(store.tenants)) {
      if (r.revoked) { deliverRevoked(t, r.uid); continue; }
      const files = { current: decrypt(t, r, "current") };
      if (r.secrets.previous) files.previous = decrypt(t, r, "previous");
      deliver(t, r, files);
      delivered += 1;
    }
    audit("redeliver-all", "-", { tenants: delivered });
    console.log(JSON.stringify({ ok: true, delivered }));
    break;
  }
  case "backup-mk": {
    // Backup da chave mestra embrulhada por scrypt(frase). A frase vem por stdin.
    const phrase = requirePassphrase(readStdin());
    const salt = crypto.randomBytes(16);
    const k = { name: "scrypt", ...KDF };
    fs.writeFileSync(arg, JSON.stringify({ v: 1, kdf: k, salt: b64(salt), blob: seal(kdfKey(phrase, salt, k), mk(), kdfAad(k)) }), { mode: 0o600 });
    audit("backup-mk", "-");
    break;
  }
  case "restore-mk": {
    const bk = JSON.parse(fs.readFileSync(arg, "utf8"));
    if (bk.v !== 1) throw new Error("versao de backup desconhecida");
    const k = checkKdf(bk.kdf);
    const key = open(kdfKey(requirePassphrase(readStdin()), unb64(bk.salt), k), bk.blob, kdfAad(k));
    fs.rmSync(MK, { force: true });
    fs.writeFileSync(MK, key, { mode: 0o400 });
    audit("restore-mk", "-");
    break;
  }
  case "verify-store": {
    // prova que a KEK atual abre a DEK de cada tenant ativo (sem imprimir valores); {ok:false} + exit 2 se nao
    const targets = Object.entries(store.tenants).filter(([t, r]) => !r.revoked && (!tenant || tenant === "-" || t === tenant));
    let result;
    if (tenant && tenant !== "-" && targets.length === 0) result = { ok: false, reason: "tenant-inexistente-ou-revogado" };
    else if (!fs.existsSync(MK)) result = { ok: false, reason: "kek-ausente" };
    else {
      try { for (const [t, r] of targets) decrypt(t, r, "current"); result = { ok: true, checked: targets.length }; }
      catch { result = { ok: false, reason: "kek-invalida" }; }
    }
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 2;
    break;
  }
  default:
    throw new Error("comando desconhecido");
}
