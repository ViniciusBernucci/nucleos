// Testes de FND-006 (AC-1..3): esquema recusa configuracao invalida sem vazar valores; overlays sem
// segredo literal; ausencia de segredo em `docker inspect`/env/argv/logs num ambiente EFEMERO
// (127.0.0.1, containers descartaveis, destruidos ao final). Executar: make test-ambientes
// Pre-requisitos: Docker, `make build` (apps/api/dist) e as imagens do compose (digest) locais ou puxaveis.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { envListToObject, isSecretName, secretFindingsInEnv, secretFindingsInText, verifyRendered } from "../scripts/deploy-lib.mjs";

const docker = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(docker, "..", "..");
const NODE24 = "node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205";
const NODE22 = "node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914";
const PY = "python:3.13.17-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530";
const PORT = "13901";
const PROJECT = "nucleos-ensaio-fnd006";

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });

// ---------------------------------------------------------------- verificador (sem Docker)
describe("verificador de overlays", () => {
  const ok = {
    services: {
      api: {
        image: `r/a@sha256:${"a".repeat(64)}`, restart: "unless-stopped", cap_drop: ["ALL"],
        security_opt: ["no-new-privileges:true"], read_only: true, mem_limit: "1", cpus: 1, pids_limit: 1,
        user: "10001:10001", ports: [{ host_ip: "127.0.0.1" }], environment: { DATABASE_PASSWORD_FILE: "/run/secrets/x" },
      },
    },
  };
  const interna = { interna: { internal: true } };
  const bad = (patch, extra = {}) =>
    verifyRendered({ networks: interna, services: { api: { ...ok.services.api, ...patch } }, ...extra }, "t");
  const pg = (patch) =>
    verifyRendered({ networks: interna, services: { postgres: { ...ok.services.api, networks: { interna: null }, ...patch } } }, "t");
  test("configuracao correta passa", () => assert.deepEqual(bad({}), []));
  test("cada regra e violada separadamente", () => {
    assert.match(bad({ image: "r/a:latest" }).join(), /sem digest/);
    assert.match(bad({ environment: { DB_PASSWORD: "x" } }).join(), /nome de segredo/);
    assert.match(bad({ environment: { X: "postgres://u:p4ss@h/db" } }).join(), /senha embutida/);
    assert.match(bad({ ports: [{ host_ip: "0.0.0.0" }] }).join(), /fora de 127\.0\.0\.1/);
    assert.match(bad({ privileged: true }).join(), /privileged/);
    assert.match(bad({ user: "0:0" }).join(), /root/);
    assert.match(bad({ read_only: false }).join(), /read_only/);
    assert.match(bad({ cap_drop: [] }).join(), /cap_drop/);
    assert.match(bad({ mem_limit: undefined }).join(), /limites/);
    assert.match(bad({ restart: "always" }).join(), /unless-stopped/);
  });
  test("regras de hardening adicionais (REVIEW-005), uma por regra", () => {
    assert.match(bad({ cap_add: ["SYS_ADMIN"] }).join(), /cap_add SYS_ADMIN fora da allowlist/);
    assert.deepEqual(pg({ cap_add: ["CHOWN", "SETUID"] }), []);
    assert.match(pg({ cap_add: ["CHOWN", "SYS_ADMIN"] }).join(), /SYS_ADMIN/);
    assert.match(bad({}, { networks: { interna: { internal: false } } }).join(), /internal: true/);
    assert.match(bad({}, { networks: {} }).join(), /internal: true/);
    assert.match(pg({ networks: { interna: null, publicada: null } }).join(), /somente na rede interna/);
    assert.match(bad({ tmpfs: ["/tmp:rw,size=1m"] }).join(), /noexec e nosuid/);
    assert.match(bad({ tmpfs: ["/tmp:rw,noexec,size=1m"] }).join(), /noexec e nosuid/);
    assert.deepEqual(bad({ tmpfs: ["/tmp:rw,noexec,nosuid,size=1m"] }), []);
    assert.match(bad({ security_opt: ["no-new-privileges:true", "seccomp=unconfined"] }).join(), /unconfined/);
    assert.match(bad({ security_opt: ["no-new-privileges:true", "apparmor=unconfined"] }).join(), /unconfined/);
    for (const source of ["/etc", "/var/run", "/home/x", "/var/run/docker.sock"]) {
      assert.match(bad({ volumes: [{ type: "bind", source }] }).join(), /mount bind proibido/);
    }
    assert.deepEqual(bad({ volumes: [{ type: "volume", source: "postgres-data" }] }), []);
  });
  test("nomes de segredo por token no ambiente e no texto (REVIEW-004)", () => {
    for (const n of ["DB_PASS", "SECRET_KEY", "JWT_SECRET_KEY", "AWS_SECRET_ACCESS_KEY", "ACCESS_KEY", "API_TOKEN", "DBPASSWORD"]) {
      assert.ok(isSecretName(n), n);
      assert.match(bad({ environment: { [n]: "hunter2" } }).join(), /nome de segredo/, n);
    }
    for (const n of ["DATABASE_PASSWORD_FILE", "SSH_KEY_PATH", "KEYBOARD", "PASSTHROUGH"]) assert.ok(!isSecretName(n), n);
    assert.equal(secretFindingsInText("      DB_PASS: hunter2\n").length, 1);
    assert.equal(secretFindingsInText("      JWT_SECRET_KEY: abc\n").length, 1);
    assert.equal(secretFindingsInText("      DB_PASS: ${DB_PASS:?}\n").length, 0);
  });
  test("texto de compose com segredo literal e detectado; *_FILE e ${} nao", () => {
    assert.equal(secretFindingsInText("POSTGRES_PASSWORD: abc12345678\n").length, 1);
    assert.equal(secretFindingsInText("POSTGRES_PASSWORD_FILE: /run/secrets/x\nA_TOKEN: ${TOKEN:?}\n").length, 0);
  });
});

// ------------------------------------------------- esquema de configuracao (processo real)
describe("api recusa subir com configuracao invalida (AC-1)", { skip: !dockerOk() }, () => {
  const SENT = `S${randomBytes(12).toString("hex")}`;
  const runApi = (env, extra = []) =>
    sh("docker", ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "-u", `${process.getuid()}:${process.getgid()}`,
      ...extra, "-v", `${root}:/workspace:ro`, "-w", "/workspace", ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
      NODE24, "node", "apps/api/dist/main.js"]);
  const dir = mkdtempSync(join(tmpdir(), "fnd006-cfg-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const check = (r, keys) => {
    assert.equal(r.status, 1, `esperado exit 1, obtido ${r.status}`);
    for (const k of keys) assert.ok(r.stderr.includes(k), `stderr deve citar ${k}`);
    assert.ok(!(r.stdout + r.stderr).includes(SENT), "valor vazou na saida");
  };
  test("porta/duracao/URL invalidas", () => {
    check(runApi({ PORT: `x${SENT}`, REQUEST_TIMEOUT: SENT, DATABASE_URL: `postgres://u:${SENT}@h/db` }), ["PORT", "REQUEST_TIMEOUT", "DATABASE_URL"]);
  });
  test("staging sem banco/segredo", () => check(runApi({ APP_ENV: "staging" }), ["DATABASE_URL", "DATABASE_PASSWORD_FILE"]));
  test("segredo por variavel de ambiente", () => check(runApi({ DATABASE_PASSWORD: SENT }), ["DATABASE_PASSWORD"]));
  test("arquivo de segredo com permissao aberta", () => {
    const f = join(dir, "pw"); writeFileSync(f, `${SENT}\n`); chmodSync(f, 0o644);
    check(runApi({ DATABASE_PASSWORD_FILE: "/run/pw" }, ["-v", `${f}:/run/pw:ro`]), ["DATABASE_PASSWORD_FILE", "permissoes"]);
  });
  test("arquivo de segredo ausente", () => check(runApi({ DATABASE_PASSWORD_FILE: "/run/nao-existe" }), ["ausente"]));
});

// -------------------------------------------- ambiente efemero: deploy, rollback e ausencia de segredo
describe("staging efemero em 127.0.0.1 (AC-2, AC-3)", { skip: !dockerOk() }, () => {
  const SENT = `Z${randomBytes(16).toString("hex")}`; // senha sentinela (so no arquivo 0400)
  const tmp = mkdtempSync(join(tmpdir(), "fnd006-"));
  const secrets = join(tmp, "segredos");
  const state = join(tmp, "estado");
  const env = {
    ...process.env, SECRETS_DIR: secrets, STATE_DIR: state, API_HOST_PORT: PORT, READY_TIMEOUT: "90",
    EXTRA_COMPOSE: join(docker, "tests", "ensaio.override.yml"), ENSAIO_UID: String(process.getuid()), ENSAIO_GID: String(process.getgid()),
    API_UID: String(process.getuid()), FND006_ENSAIO: "1",
  };
  const deploy = (...a) => sh(join(docker, "scripts", "deploy.sh"), ["staging", ...a], { env });
  const compose = (...a) => sh("docker", ["compose", "-p", PROJECT, "-f", join(docker, "compose.deploy.yml"), "-f", join(docker, "compose.staging.yml"),
    "-f", env.EXTRA_COMPOSE, ...a], { env: { ...env, API_IMAGE: NODE24 } });
  const cid = (svc) => out("docker", ["ps", "-aq", "--filter", `label=com.docker.compose.project=${PROJECT}`, "--filter", `label=com.docker.compose.service=${svc}`]).trim();

  before(() => {
    sh("mkdir", ["-p", secrets, state]); chmodSync(secrets, 0o700);
    writeFileSync(join(secrets, "database_password"), `${SENT}\n`, { mode: 0o400 });
    // O volume da rodada anterior nao pode existir (senha antiga no PGDATA).
    sh("docker", ["volume", "rm", "-f", `${PROJECT}_postgres-data`]);
  });
  after(() => {
    compose("down", "-v", "--remove-orphans", "-t", "5");
    rmSync(tmp, { recursive: true, force: true });
  });

  test("deploy exige digest (tag e recusada) e segredo 0400", () => {
    const r = deploy("deploy", "node:24");
    assert.equal(r.status, 2);
    chmodSync(join(secrets, "database_password"), 0o644);
    assert.equal(deploy("deploy", NODE24).status, 1);
    chmodSync(join(secrets, "database_password"), 0o400);
  });

  test("deploy do digest A sobe API e Postgres; /readyz responde", () => {
    const r = deploy("deploy", NODE24);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const res = sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /"ready"/);
  });

  test("Postgres aceitou a senha vinda do arquivo (POSTGRES_PASSWORD_FILE)", () => {
    const r = sh("docker", ["exec", cid("postgres"), "sh", "-c",
      "PGPASSWORD=\"$(cat /run/secrets/database_password)\" psql -h 127.0.0.1 -U nucleos -d nucleos -tAc 'select 1'"]);
    assert.equal(r.stdout.trim(), "1", r.stderr);
  });

  test("docker inspect/env/argv/logs sem segredo; hardening aplicado", () => {
    for (const svc of ["api", "postgres"]) {
      const id = cid(svc);
      const insp = out("docker", ["inspect", id]);
      assert.ok(!insp.includes(SENT), `${svc}: sentinela em docker inspect`);
      const j = JSON.parse(insp)[0];
      assert.deepEqual(secretFindingsInEnv(envListToObject(j.Config.Env)).filter((f) => !/_FILE: /.test(f)), [], `${svc}: env`);
      assert.ok(!JSON.stringify([j.Config.Cmd, j.Config.Entrypoint]).includes(SENT));
      assert.equal(j.HostConfig.Privileged, false);
      assert.deepEqual(j.HostConfig.CapDrop, ["ALL"]);
      assert.ok(j.HostConfig.SecurityOpt.includes("no-new-privileges:true"));
      assert.equal(j.HostConfig.ReadonlyRootfs, true);
      assert.ok(j.HostConfig.Memory > 0 && j.HostConfig.PidsLimit > 0 && j.HostConfig.NanoCpus > 0);
      assert.equal(j.HostConfig.RestartPolicy.Name, "unless-stopped");
      for (const binds of Object.values(j.NetworkSettings.Ports ?? {})) {
        for (const b of binds ?? []) assert.equal(b.HostIp, "127.0.0.1");
      }
      const logs = sh("docker", ["logs", id]);
      assert.ok(!(logs.stdout + logs.stderr).includes(SENT), `${svc}: sentinela em logs`);
      // por dentro: /proc/*/environ e /proc/*/cmdline (o arquivo em /run/secrets e a unica copia)
      const inside = sh("docker", ["exec", id, "sh", "-c",
        "cat /proc/[0-9]*/environ /proc/[0-9]*/cmdline 2>/dev/null | tr '\\0' '\\n'"]);
      assert.ok(!inside.stdout.includes(SENT), `${svc}: sentinela em environ/cmdline`);
      assert.equal(sh("docker", ["exec", id, "sh", "-c", "env"]).stdout.includes(SENT), false);
    }
    assert.ok(!out("docker", ["image", "inspect", NODE24]).includes(SENT));
    assert.ok(!out("docker", ["compose", "-p", PROJECT, "-f", join(docker, "compose.deploy.yml"), "-f", join(docker, "compose.staging.yml"), "-f", env.EXTRA_COMPOSE, "config"],
      { env: { ...env, API_IMAGE: NODE24 } }).includes(SENT), "sentinela na configuracao renderizada");
  });

  test("controle negativo: a mesma deteccao acusa segredo passado por -e", () => {
    const id = out("docker", ["run", "-d", "--rm", "--network", "none", "-e", `DATABASE_PASSWORD=${SENT}`, NODE24, "sleep", "30"]).trim();
    try {
      const insp = out("docker", ["inspect", id]);
      assert.ok(insp.includes(SENT));
      assert.ok(secretFindingsInEnv(envListToObject(JSON.parse(insp)[0].Config.Env)).length > 0);
    } finally { sh("docker", ["rm", "-f", id]); }
  });

  const imagem = () => out("docker", ["inspect", "-f", "{{.Config.Image}}", cid("api")]).trim();
  const estado = () => deploy("status").stdout;
  const pronto = () => sh("curl", ["-fsS", `http://127.0.0.1:${PORT}/readyz`]).status === 0;
  const DESCONHECIDA = `registry.invalid/nucleos/nao-existe@sha256:${"0".repeat(64)}`;

  test("deploy B, redeploy de B (idempotente) e rollback volta a A (REVIEW-001)", () => {
    assert.equal(deploy("deploy", NODE22).status, 0);
    assert.equal(imagem(), NODE22);
    assert.equal(deploy("deploy", NODE22).status, 0); // retentativa de pipeline
    assert.match(estado(), new RegExp(`anterior: ${NODE24.replace(/[.]/g, "\\.")}`));
    const r = deploy("rollback");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(imagem(), NODE24);
    assert.ok(pronto());
    assert.match(estado(), new RegExp(`atual:\\s+${NODE24.replace(/[.]/g, "\\.")}`));
  });

  test("deploy defeituoso (readyz nunca responde) reverte e preserva o estado", () => {
    const antes = estado();
    const r = sh(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", PY], { env: { ...env, READY_TIMEOUT: "8" } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /rollback concluido/);
    assert.equal(imagem(), NODE24);
    assert.ok(pronto());
    assert.equal(estado(), antes);
  });

  test("falha em `compose up` (imagem inexistente) aciona rollback e preserva atual/anterior (REVIEW-010)", () => {
    const antes = estado();
    const r = deploy("deploy", DESCONHECIDA);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /rollback concluido/);
    assert.equal(imagem(), NODE24);
    assert.ok(pronto());
    assert.equal(estado(), antes);
  });

  test("segunda execucao concorrente e recusada (flock)", async () => {
    const primeiro = spawn(join(docker, "scripts", "deploy.sh"), ["staging", "deploy", NODE22], { env, stdio: "ignore" });
    const fim = new Promise((res) => primeiro.on("close", res));
    await new Promise((res) => setTimeout(res, 1500));
    const r = deploy("deploy", NODE24);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /em andamento/);
    assert.equal(await fim, 0);
    assert.equal(deploy("rollback").status, 0); // volta a A para os demais testes
    assert.equal(imagem(), NODE24);
  });
});

// ------------------------------------------- EXTRA_COMPOSE nunca em producao (REVIEW-002), sem Docker
describe("EXTRA_COMPOSE e restrito ao ensaio", () => {
  const stubDir = mkdtempSync(join(tmpdir(), "fnd006-stub-"));
  const marker = join(stubDir, "docker-chamado");
  writeFileSync(join(stubDir, "docker"), `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, { mode: 0o755 });
  after(() => rmSync(stubDir, { recursive: true, force: true }));
  const run = (envName, extra) => {
    rmSync(marker, { force: true });
    const r = sh(join(docker, "scripts", "deploy.sh"), [envName, "deploy", `r/a@sha256:${"a".repeat(64)}`], {
      env: { PATH: `${stubDir}:/usr/bin:/bin`, SECRETS_DIR: stubDir, EXTRA_COMPOSE: "/tmp/x.yml", ...extra },
    });
    assert.ok(!existsSync(marker), "docker nao deve ser chamado");
    return r;
  };
  test("prod recusa EXTRA_COMPOSE, mesmo com FND006_ENSAIO=1", () => {
    for (const extra of [{}, { FND006_ENSAIO: "1" }]) {
      const r = run("prod", extra);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /proibido em prod/);
    }
  });
  test("staging exige FND006_ENSAIO=1", () => {
    const r = run("staging", {});
    assert.equal(r.status, 2);
    assert.match(r.stderr, /FND006_ENSAIO=1/);
  });
});

function dockerOk() {
  return sh("docker", ["info"]).status === 0;
}
