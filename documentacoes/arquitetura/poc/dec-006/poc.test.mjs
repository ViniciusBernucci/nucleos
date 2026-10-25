// Teste DEC-006: ciclo de vida do segredo de tenant e ausencia de segredo em env/inspect/logs.
// Valores 100% sinteticos gerados a cada execucao. Containers sem rede (--network none), sem portas.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
const S = { a1: sentinel("a-v1"), a2: sentinel("a-v2"), b1: sentinel("b-v1") };
const all = () => Object.values(S).concat([MK.toString("hex"), MK.toString("base64"), PASS]);

const docker = (args, input) => {
  const r = spawnSync("docker", args, { input, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`docker ${args[0]} falhou: ${r.stderr.slice(0, 300)}`);
  return r.stdout;
};
const containers = [];
const volumes = [];
const broker = (args, input) => docker(["exec", "-i", N("broker"), "node", "/app/broker.mjs", ...args], input);
const tenantCheck = (t) => JSON.parse(docker(["exec", N(t), "node", "/app/tenant-app.mjs", "hmac"]));
const identity = (t) => JSON.parse(docker(["inspect", N(t), "--format", "{{json .}}"]));
const stamp = (t) => { const i = identity(t); return { id: i.Id, started: i.State.StartedAt, restarts: i.RestartCount }; };

function startTenant(t, uid) {
  docker(["run", "-d", "--name", N(t), "--network", "none", "--user", String(uid), "--read-only", "--cap-drop", "ALL",
    "-v", `${here}:/app:ro`,
    "--mount", `type=volume,src=${N("secrets")},dst=/run/secrets,readonly,volume-subpath=${t}`,
    IMG, "node", "/app/tenant-app.mjs"]);
  containers.push(N(t));
}

before(() => {
  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=4m,mode=0755", N("secrets")]);
  docker(["volume", "create", "--driver", "local", "--opt", "type=tmpfs", "--opt", "device=tmpfs", "--opt", "o=size=1m,mode=0700", N("mk")]);
  docker(["volume", "create", N("store")]);
  volumes.push(N("secrets"), N("mk"), N("store"));
  docker(["run", "-d", "--name", N("broker"), "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
    "-v", `${here}:/app:ro`, "-v", `${N("secrets")}:/tenants`, "-v", `${N("mk")}:/run/mk`, "-v", `${N("store")}:/var/broker`,
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

  // isolamento: tenant-a nao enxerga o diretorio do tenant-b
  const peek = spawnSync("docker", ["exec", N("tenant-a"), "ls", "/run/secrets/../"], { encoding: "utf8" });
  assert.ok(!peek.stdout.includes("tenant-b"));

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
  const aud = docker(["exec", N("broker"), "cat", "/var/broker/audit.log"]);
  assert.deepEqual(aud.trim().split("\n").map((l) => JSON.parse(l).event),
    ["create", "create", "rotate", "retire-previous", "revoke"]);
  for (const v of all()) assert.ok(!aud.includes(v));
});

test("AC-2: ausencia de segredo em env, inspect e logs", () => {
  // novo segredo vivo para que o scan cubra tenant ativo (b) e o broker
  const names = [N("broker"), N("tenant-a"), N("tenant-b")];
  const hits = (text) => all().filter((v) => text.includes(v));
  for (const n of names) {
    assert.deepEqual(hits(docker(["inspect", n])), [], `inspect ${n}`);
    assert.deepEqual(hits(docker(["logs", n])), [], `logs ${n}`);
    assert.deepEqual(hits(docker(["exec", n, "env"])), [], `env ${n}`);
    assert.deepEqual(hits(docker(["exec", n, "sh", "-c", "cat /proc/1/environ | tr '\\0' '\\n'"])), [], `environ ${n}`);
  }
  for (const v of volumes) assert.deepEqual(hits(docker(["volume", "inspect", v])), [], `volume ${v}`);
  assert.deepEqual(hits(docker(["image", "inspect", IMG])), []);
  // o tenant ativo realmente enxerga o segredo por arquivo (o scan nao e vazio)
  assert.equal(tenantCheck("tenant-b").current, hmac(S.b1));
});

test("controle negativo: o scanner detecta segredo vazado via -e", () => {
  const leak = sentinel("leak");
  docker(["run", "-d", "--name", N("leaky"), "--network", "none", "-e", `API_KEY=${leak}`, IMG, "sleep", "60"]);
  containers.push(N("leaky"));
  assert.ok(docker(["inspect", N("leaky")]).includes(leak));
  assert.ok(docker(["exec", N("leaky"), "env"]).includes(leak));
});

test("backup e recuperacao da chave mestra", () => {
  broker(["backup-mk", "-", "/var/broker/mk.backup.json"], PASS);
  const bk = docker(["exec", N("broker"), "cat", "/var/broker/mk.backup.json"]);
  for (const v of all()) assert.ok(!bk.includes(v), "backup nao expoe a chave");
  docker(["exec", N("broker"), "rm", "/run/mk/master.key"]);  // desastre: perda da KEK
  assert.throws(() => broker(["verify-store", "tenant-b"]));
  assert.throws(() => broker(["restore-mk", "-", "/var/broker/mk.backup.json"], "frase-errada"));
  broker(["restore-mk", "-", "/var/broker/mk.backup.json"], PASS);
  assert.equal(JSON.parse(broker(["verify-store", "tenant-b"])).ok, true);
  const restored = docker(["exec", N("broker"), "sh", "-c", "base64 /run/mk/master.key"]).trim();
  assert.equal(Buffer.from(restored, "base64").equals(MK), true);
});
