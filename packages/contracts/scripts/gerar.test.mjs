import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { RAIZ, SAIDAS, compararArvores, gerarEm } from "./gerar.mjs";

const tmps = [];
const novoTmp = () => {
  const d = mkdtempSync(join(tmpdir(), "nucleos-gerar-teste-"));
  tmps.push(d);
  return d;
};
let gerado;
before(async () => {
  gerado = novoTmp();
  await gerarEm(gerado);
});
after(() => {
  for (const d of tmps) rmSync(d, { recursive: true, force: true });
});

const check = (raizVersionada) =>
  spawnSync(
    process.execPath,
    [join(RAIZ, "packages", "contracts", "scripts", "gerar.mjs"), "--check"],
    {
      encoding: "utf8",
      env: { ...process.env, CONTRACTS_REPO_ROOT: raizVersionada },
    },
  );

test("a geracao e deterministica e o repositorio esta sem drift", () => {
  assert.deepEqual(compararArvores(gerado, RAIZ), []);
});

test("geracao cobre TS, SDK, modelos Pydantic e copia dos schemas", () => {
  const arquivos = (d) => compararArvores(gerado, d);
  const vazio = novoTmp();
  const lista = arquivos(vazio).join("\n");
  for (const d of SAIDAS) assert.ok(lista.includes(d), `sem saida em ${d}`);
  assert.match(lista, /generated\/job-envelope\.ts/);
  assert.match(lista, /models\/job_envelope\.py/);
  assert.match(lista, /generated\/control-plane\.ts/);
});

test("drift: arquivo gerado alterado a mao e detectado (--check sai com 1)", () => {
  const versionada = novoTmp();
  return gerarEm(versionada).then(() => {
    assert.equal(check(versionada).status, 0);
    const alvo = join(versionada, "packages/contracts/src/generated/job-envelope.ts");
    writeFileSync(alvo, `${readFileSync(alvo, "utf8")}// edicao manual\n`);
    const r = check(versionada);
    assert.equal(r.status, 1);
    assert.match(
      r.stderr,
      /DRIFT[\s\S]*desatualizado: packages\/contracts\/src\/generated\/job-envelope\.ts/,
    );
  });
});

test("drift: arquivo NOVO gerado e ausente no repositorio e detectado", async () => {
  const versionada = novoTmp();
  await gerarEm(versionada);
  unlinkSync(
    join(versionada, "packages/contracts-py/src/nucleos_contracts/models/job_envelope.py"),
  );
  const r = check(versionada);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ausente no repositorio \(arquivo novo gerado\): .*job_envelope\.py/);
});

test("drift: arquivo obsoleto (nao mais gerado) e detectado", async () => {
  const versionada = novoTmp();
  await gerarEm(versionada);
  writeFileSync(join(versionada, "packages/contracts/src/generated/antigo.ts"), "export {};\n");
  const r = check(versionada);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /obsoleto \(nao e mais gerado\): .*antigo\.ts/);
});
