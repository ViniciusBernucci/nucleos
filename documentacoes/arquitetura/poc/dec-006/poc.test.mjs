// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs/argv/volumes.
// Valores 100% sinteticos gerados a cada execucao. Containers sem rede (--network none), sem portas.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const IMG = "node:22-alpine";
const RUN = crypto.randomBytes(3).toString("hex");
const N = (s) => `dec006-${RUN}-${s}`;
const sentinel = (label) => `SENTINEL-${label}-${crypto.randomBytes(16).toString("hex")}`;
const hmac = (v) => crypto.createHmac("sha256", v).update("challenge").digest("hex");

const MK = crypto.randomBytes(32);
const PASS = sentinel("passphrase");
const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1"), u: sentinel("uid"), u2: sentinel("uid-v2") };
const all = () => Object.values(S).concat([MK.toString("hex"), MK.toString("base64"), PASS]);
// UNICA funcao de deteccao, usada nos canais reais e nos controles negativos
const hits = (text, values = all()) => values.filter((v) => text.includes(v));

const docker = (args, input) => {
  const r = spawnSync("docker", args, { input, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`docker ${args[0]} falhou: ${r.stderr.slice(0, 300)}`);
  return r.stdout;
};
const containers = [];
const volumes = [];
const V = { secrets: N("secrets"), mk: N("mk"), store: N("store") };
// stdout+stderr de TODAS as chamadas ao broker, para varredura de ausencia de segredo
const brokerOut = [];
const execIn = (sink, args, input) => {
  const r = spawnSync("docker", args, { input, encoding: "utf8" });
  sink.push(r.stdout, r.stderr);
  return r;
};
const brokerRaw = (args, input) => execIn(brokerOut, ["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
const broker = (args, input) => {
  const r = brokerRaw(args, input);
  if (r.status !== 0) throw new Error(`broker ${args[0]} falhou (status ${r.status}): ${r.stderr.slice(0, 300)}`);
  return r.stdout;
};
const inBroker = (cmd) => docker(["exec", N("broker"), "sh", "-c", cmd]);
const storeJson = () => JSON.parse(docker(["exec", N("broker"), "cat", "/var/broker/store.json"]));
const tenantCheck = (t) => JSON.parse(docker(["exec", N(t), "node", "/app/tenant-app.mjs", "hmac"]));
const identity = (t) => JSON.parse(docker(["inspect", N(t), "--format", "{{json .}}"]));
const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.State.StartedAt, restarts: i.RestartCount }; };

function startTenant(t, uid) {
  docker(["run", "-d", "--name", N(t), "--network", "none", "--user", String(uid), "--read-only", "--cap-drop", "ALL",
    "-v", `${here}:/app:ro`,
    "--mount", `type=volume,src=${V.secrets},dst=/run/secrets,readonly,volume-subpath=${t}`,
    IMG, "node", "/app/tenant-app.mjs"]);
  containers.push(N(t));
}

// Canais de um container: inspect, logs (stdout+stderr), env, environ do PID 1 e argv de todos os processos.
function channels(n) {
  const logs = spawnSync("docker", ["logs", n], { encoding: "utf8" });
  return {
    inspect: docker(["inspect", n]),
    logs: logs.stdout + logs.stderr,
    env: docker(["exec", n, "env"]),
    environ: docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"]),
    cmdline: docker(["exec", n, "sh", "-c", "cat /proc/[0-9]*/cmdline | tr '\\0' '\\n'"]),
  };
}

// Conteudo de um volume lido por container auxiliar (somente leitura): [{p, buf}]
const WALK = "const fs=require('fs'),path=require('path');const o=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.isFile())o.push({p:p.slice(3),b:fs.readFileSync(p).toString('base64')})}})('/v');console.log(JSON.stringify(o))";
function volumeFiles(vol) {
  const out = docker(["run", "--rm", "--network", "none", "--user", "0", "-v", `${vol}:/v:ro`, IMG, "node", "-e", WALK]);
  return JSON.parse(out).map(({ p, b }) => ({ p, buf: Buffer.from(b, "base64") }));
}
function fileHits(buf, values = all(), rawKey = true) {
  const h = hits(buf.toString("latin1"), values);
  if (rawKey && buf.includes(MK)) h.push("RAW-MK");
  return h;
}

before(() => {
  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", V.secrets]);
  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", V.mk]);
  docker(["volume", "create", V.store]);
  volumes.push(V.secrets, V.mk, V.store);
  docker(["run", "-d", "--name", N("broker"), "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
    "-v", `${here}:/app:ro`, "-v", `${V.secrets}:/tenants`, "-v", `${V.mk}:/run/mk`, "-v", `${V.store}:/var/broker`,
    IMG, "sleep", "3600"]);
  containers.push(N("broker"));
  // a chave mestra entra por stdin direto no tmpfs do broker (nunca env, nunca argv, nunca imagem)
  docker(["exec", "-i", N("broker"), "sh", "-c", "umask 277; cat > /run/mk/master.key"], MK);
});

after(() => {
  for (const c of containers) spawnSync("docker", ["rm", "-f", c]);
  for (const v of volumes) spawnSync("docker", ["volume", "rm", "-f", v]);
});

test("AC-1: cria, entrega, rotaciona e revoga segredo de tenant sem reiniciar outros tenants", () => {
  broker(["create", "tenant-a"], S.a1);
  broker(["create", "tenant-b"], S.b1);
  startTenant("tenant-a", 10001);
  startTenant("tenant-b", 10002);
  const bBefore = stamp("tenant-b");

  assert.equal(tenantCheck("tenant-a").current, hmac(S.a1), "entrega a");
  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "entrega b");

  // isolamento: leitura real de segredo de outro tenant falha; leitura do proprio funciona (controle positivo)
  const read = (t, p) => spawnSync("docker", ["exec", N(t), "cat", p], { encoding: "utf8" });
  assert.equal(read("tenant-a", "/run/secrets/current").stdout, S.a1, "controle positivo: le o proprio segredo");
  assert.equal(read("tenant-b", "/run/secrets/current").stdout, S.b1, "controle positivo: le o proprio segredo");
  for (const [from, other, otherSecret] of [["tenant-a", "tenant-b", S.b1], ["tenant-b", "tenant-a", S.a1]]) {
    for (const p of [`/run/secrets/${other}/current`, `/run/secrets/../${other}/current`, `/run/secrets/../secrets/${other}/current`, `/tenants/${other}/current`]) {
      const r = read(from, p);
      assert.notEqual(r.status, 0, `${from} nao pode ler ${p}`);
      assert.ok(!r.stdout.includes(otherSecret));
    }
    assert.equal(docker(["exec", N(from), "ls", "/run/secrets"]).split("\n").filter(Boolean).sort().join(","), "current,meta.json");
  }

  // rotacao com janela dupla
  const aBefore = stamp("tenant-a");
  broker(["rotate", "tenant-a"], S.a2);
  let c = tenantCheck("tenant-a");
  assert.equal(c.current, hmac(S.a2));
  assert.equal(c.previous, hmac(S.a1), "janela dupla mantem a versao anterior");
  broker(["retire-previous", "tenant-a"]);
  assert.equal(tenantCheck("tenant-a").previous, null);
  assert.deepEqual(stamp("tenant-a"), aBefore, "rotacao nao reinicia o proprio tenant");

  // revogacao
  broker(["revoke", "tenant-a"]);
  c = tenantCheck("tenant-a");
  assert.equal(c.current, null);
  assert.equal(c.previous, null);
  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "b intacto");
  assert.deepEqual(stamp("tenant-b"), bBefore, "b nao reiniciou nem foi recriado");

  // criptografia em repouso: store nao contem valores em claro
  const store = docker(["exec", N("broker"), "cat", "/var/broker/store.json"]);
  for (const v of all()) assert.ok(!store.includes(v));
  // REVIEW-003: apos revoke, wrappedDek e segredos cifrados sumiram do store vivo (nao se afirma irrecuperabilidade)
  const revoked = JSON.parse(store).tenants["tenant-a"];
  assert.deepEqual(Object.keys(revoked).sort(), ["revoked", "uid", "version"]);
  assert.equal(revoked.wrappedDek, undefined);
  assert.equal(revoked.secrets, undefined);
  const aud = docker(["exec", N("broker"), "cat", "/var/broker/audit.log"]);
  assert.deepEqual(aud.trim().split("\n").map((l) => JSON.parse(l).event),
    ["create", "create", "rotate", "retire-previous", "revoke"]);
  for (const v of all()) assert.ok(!aud.includes(v));
});

test("REVIEW-001: UID nunca e reutilizado (create/revoke/recreate)", () => {
  const uidOf = (t) => storeJson().tenants[t].uid;
  broker(["create", "uid-a"], S.u);
  broker(["create", "uid-b"], S.u);
  const a1 = uidOf("uid-a");
  const b = uidOf("uid-b");
  broker(["revoke", "uid-a"]);
  broker(["create", "uid-a"], S.u); // recria o mesmo nome revogado
  broker(["create", "uid-c"], S.u);
  broker(["rotate", "uid-c"], S.u2); // deixa previous para o teste de reentrega
  const st = storeJson();
  const uids = Object.values(st.tenants).map((t) => t.uid);
  assert.equal(new Set(uids).size, uids.length, `UIDs duplicados: ${uids}`);
  assert.notEqual(uidOf("uid-a"), a1, "recriacao recebe UID novo");
  assert.equal(uidOf("uid-b"), b);
  assert.ok(st.nextUid > Math.max(...uids), "nextUid persistido e maior que todos os UIDs");
  // store legado sem nextUid: reinicializa em max(uid)+1
  inBroker(`node -e "const fs=require('fs');const p='/var/broker/store.json';const s=JSON.parse(fs.readFileSync(p));delete s.nextUid;fs.writeFileSync(p,JSON.stringify(s))"`);
  broker(["create", "uid-d"], S.u);
  const st2 = storeJson();
  const uids2 = Object.values(st2.tenants).map((t) => t.uid);
  assert.equal(new Set(uids2).size, uids2.length);
  assert.ok(st2.tenants["uid-d"].uid > Math.max(...uids));
});

test("REVIEW-002: nomes de tenant fora da allowlist sao rejeitados antes de qualquer E/S", () => {
  const snapshot = () => inBroker("cat /var/broker/store.json; find /tenants | sort; ls -d /victim /x /tenants/../x 2>&1; true");
  const before = snapshot();
  const bad = ["..", ".", "../x", "a/b", "", "Maiusc", "a b", "-x", "../../victim/x", "a".repeat(64), "x\ny"];
  for (const name of bad) {
    for (const cmd of ["create", "rotate", "retire-previous", "revoke"]) {
      const r = brokerRaw([cmd, name], S.u);
      assert.notEqual(r.status, 0, `${cmd} ${JSON.stringify(name)} deveria falhar`);
      assert.ok(r.stderr.includes("nome de tenant invalido"), `${cmd} ${JSON.stringify(name)}: ${r.stderr.slice(0, 200)}`);
    }
  }
  assert.equal(snapshot(), before, "nada criado/alterado (store, /tenants, fora da raiz)");
  assert.equal(brokerRaw(["verify-store", "../x"]).status, 1, "verify-store tambem valida o nome");
});

test("AC-2: ausencia de segredo em env, inspect, logs, argv, saida do broker e conteudo dos volumes", () => {
  const names = [N("broker"), N("tenant-a"), N("tenant-b")];
  for (const n of names) {
    for (const [canal, texto] of Object.entries(channels(n))) assert.deepEqual(hits(texto), [], `${canal} ${n}`);
  }
  // stdout/stderr de todas as chamadas ao broker (create/rotate/revoke, erros com stack)
  assert.ok(brokerOut.length > 10, "captura nao vazia");
  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
  for (const v of Object.values(V)) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume inspect ${v}`);
  assert.deepEqual(hits(docker(["image", "inspect", IMG])), []);

  // conteudo dos volumes, com allowlist explicita dos arquivos legitimamente entregues
  const active = Object.entries(storeJson().tenants).filter(([, r]) => !r.revoked).map(([t]) => t);
  const allowedSecretFiles = new Set(active.flatMap((t) => [`${t}/current`, `${t}/previous`]));
  const isSecret = (h) => Object.values(S).includes(h);
  const unexpected = [];
  const seen = new Set();
  for (const [role, vol] of Object.entries(V)) {
    for (const { p, buf } of volumeFiles(vol)) {
      seen.add(`${role}:${p}`);
      for (const h of fileHits(buf)) {
        const ok = (role === "secrets" && allowedSecretFiles.has(p) && isSecret(h)) || (role === "mk" && p === "master.key" && h === "RAW-MK");
        if (!ok) unexpected.push(`${role}:${p}:${h.slice(0, 18)}`);
      }
    }
  }
  assert.deepEqual(unexpected, [], "segredo em arquivo de volume fora da allowlist");
  // a varredura nao e vazia: viu os arquivos legitimos
  assert.ok(seen.has("secrets:tenant-b/current") && seen.has("mk:master.key") && seen.has("store:store.json"));
  assert.ok(fileHits(volumeFiles(V.secrets).find((f) => f.p === "tenant-b/current").buf).includes(S.b1));
  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1));
});

test("controle negativo: a mesma hits() detecta vazamento em cada canal", () => {
  const leak = sentinel("leak");
  const only = (text) => hits(text, [leak]);
  // env / inspect / environ
  docker(["run", "-d", "--name", N("leak-env"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "120"]);
  containers.push(N("leak-env"));
  const ce = channels(N("leak-env"));
  for (const c of ["inspect", "env", "environ"]) assert.deepEqual(only(ce[c]), [leak], `canal ${c}`);
  // logs e argv
  docker(["run", "-d", "--name", N("leak-log"), "--network", "none", IMG, "sh", "-c", 'echo "$0"; sleep 120; :', leak]);
  containers.push(N("leak-log"));
  const cl = channels(N("leak-log"));
  for (const c of ["logs", "cmdline"]) assert.deepEqual(only(cl[c]), [leak], `canal ${c}`);
  // arquivo em volume (mesmo varredor de conteudo)
  const ctl = N("ctl");
  docker(["volume", "create", ctl]);
  volumes.push(ctl);
  docker(["run", "--rm", "--network", "none", "-v", `${ctl}:/v`, IMG, "sh", "-c", 'echo "$0" > /v/f', leak]);
  assert.deepEqual(volumeFiles(ctl).filter((f) => fileHits(f.buf, [leak], false).length).map((f) => f.p), ["f"]);
  // saida capturada do broker
  const sink = [];
  execIn(sink, ["exec", N("broker"), "sh", "-c", 'echo "$0"', leak]);
  assert.deepEqual(only(sink.join("\n")), [leak]);
  // controle do controle: sem vazamento nada e detectado
  assert.deepEqual(only(channels(N("broker")).logs + brokerOut.join("")), []);
});

test("backup da KEK: KDF parametrizado, frase curta rejeitada, parametros adulterados falham", () => {
  broker(["backup-mk", "-", "/var/broker/mk.backup.json"], PASS);
  const raw = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
  for (const v of all()) assert.ok(!raw.includes(v), "backup nao expoe a chave");
  const bk = JSON.parse(raw);
  assert.deepEqual(bk.kdf, { name: "scrypt", N: 2 ** 17, r: 8, p: 1 }, "parametros gravados no blob");
  const mkB64 = () => inBroker("base64 /run/mk/master.key").trim();
  const mkBefore = mkB64();

  // frase vazia/curta rejeitada, sem arquivo gerado
  for (const phrase of ["", "curta", "x".repeat(15)]) {
    const r = brokerRaw(["backup-mk", "-", "/var/broker/mk.short.json"], phrase);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.includes("frase curta"));
  }
  assert.equal(inBroker("ls /var/broker/mk.short.json 2>&1; true").includes("No such file"), true);

  // parametros/versao adulterados: falham sem tocar na KEK
  const tamper = (mut) => {
    const b = structuredClone(bk);
    mut(b);
    docker(["exec", "-i", N("broker"), "sh", "-c", "cat > /var/broker/mk.t.json"], JSON.stringify(b));
    return brokerRaw(["restore-mk", "-", "/var/broker/mk.t.json"], PASS);
  };
  assert.notEqual(tamper((b) => { b.kdf.p = 2; }).status, 0, "p alterado (valido) falha por autenticacao");
  assert.notEqual(tamper((b) => { b.kdf.N = 2 ** 18; }).status, 0, "N alterado (valido) falha por autenticacao");
  assert.ok(tamper((b) => { b.kdf.N = 2 ** 14; }).stderr.includes("parametros kdf invalidos"), "N fraco recusado");
  assert.ok(tamper((b) => { b.v = 2; }).stderr.includes("versao de backup"));
  assert.equal(tamper(() => {}).status, 0, "controle: backup integro restaura");
  assert.equal(mkB64(), mkBefore, "KEK intacta");
});

test("desastre completo: perde KEK e arquivos entregues, restaura e reentrega", () => {
  const restoreArgs = ["restore-mk", "-", "/var/broker/mk.backup.json"];
  const mkBefore = inBroker("base64 /run/mk/master.key").trim();
  // desastre
  inBroker("rm /run/mk/master.key; find /tenants -type f -delete");
  assert.equal(tenantCheck("tenant-b").current, null, "arquivos entregues apagados");
  let v = brokerRaw(["verify-store", "tenant-b"]);
  assert.equal(v.status, 2);
  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-ausente" });
  // KEK errada nao passa como valida
  docker(["exec", "-i", N("broker"), "sh", "-c", "umask 277; cat > /run/mk/master.key"], crypto.randomBytes(32));
  v = brokerRaw(["verify-store", "tenant-b"]);
  assert.deepEqual(JSON.parse(v.stdout), { ok: false, reason: "kek-invalida" });
  // frase errada rejeitada (longa o bastante para chegar a autenticacao)
  const wrong = brokerRaw(restoreArgs, "frase-errada-mas-longa-123");
  assert.notEqual(wrong.status, 0);
  assert.deepEqual(JSON.parse(brokerRaw(["verify-store", "tenant-b"]).stdout), { ok: false, reason: "kek-invalida" });
  // restauracao + verificacao + reentrega
  broker(restoreArgs, PASS);
  assert.deepEqual(JSON.parse(broker(["verify-store", "tenant-b"])), { ok: true, checked: 1 });
  assert.equal(inBroker("base64 /run/mk/master.key").trim(), mkBefore);
  assert.equal(Buffer.from(mkBefore, "base64").equals(MK), true);
  const active = Object.values(storeJson().tenants).filter((t) => !t.revoked).length;
  assert.deepEqual(JSON.parse(broker(["redeliver-all"])), { ok: true, delivered: active });
  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1), "tenant-b volta a ler o segredo correto");
  const a = tenantCheck("tenant-a");
  assert.equal(a.current, null, "revogado continua sem segredo");
  assert.equal(inBroker("cat /tenants/tenant-a/meta.json"), JSON.stringify({ revoked: true }));
  assert.equal(inBroker("cat /tenants/uid-c/current"), S.u2, "versao rotacionada reentregue");
  assert.equal(inBroker("cat /tenants/uid-c/previous"), S.u, "janela dupla reentregue");
  assert.equal(inBroker("cat /tenants/uid-a/current"), S.u);
  // nada vazou na saida do broker durante backup/desastre/recuperacao
  assert.deepEqual(hits(brokerOut.join("\n")), [], "saida do broker");
});
