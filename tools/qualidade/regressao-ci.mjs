#!/usr/bin/env node
// Regressao dos gates do CI (ENT-FND-005): cada caso DEVE falhar. Se algum gate deixar de pegar
// sua violacao, sai com codigo 1. Fixtures em tools/qualidade/regressao-ci/.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verificar } from "../../scripts/ci/verificar-workflows.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const reg = join(raiz, "tools", "qualidade", "regressao-ci");
const offline = process.env.CI_REGRESSAO_OFFLINE === "1";
const falhas = [];

function exec(cmd, args) {
  return spawnSync(cmd, args, { cwd: raiz, encoding: "utf8" });
}
function deveFalhar(nome, r, trecho) {
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ok = r.status !== 0 && r.status !== null && saida.includes(trecho);
  console.log(`${ok ? "OK   " : "FALHA"} ${nome} (esperado: falhar com "${trecho}")`);
  if (!ok) falhas.push(`${nome}\n${saida.slice(0, 600)}`);
}
function deveSer(nome, condicao) {
  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}`);
  if (!condicao) falhas.push(nome);
}

// 1) Politica estatica dos workflows: cada fixture viola uma regra.
const esperado = {
  "acao-sem-sha": "nao fixada por SHA",
  "pull-request-target": "pull_request_target",
  "segredo-exposto": "segredo alem do GITHUB_TOKEN",
  "permissao-escrita": "permissao de escrita",
  "sem-permissions": "permissions: contents: read",
  "sem-timeout": "timeout-minutes",
  "injecao-de-script": "injecao de script",
  "curl-pipe-sh": "curl | sh",
  "injecao-inputs": "injecao de script",
  "injecao-steps-outputs": "injecao de script",
  "segredo-indexado": "segredo alem do GITHUB_TOKEN",
};
for (const arq of readdirSync(join(reg, "workflows"))) {
  const chave = arq.replace(/\.yml$/, "");
  const erros = verificar(readFileSync(join(reg, "workflows", arq), "utf8"), arq);
  deveSer(
    `politica de workflows rejeita ${chave}`,
    erros.some((e) => e.includes(esperado[chave])),
  );
}
const ci = readFileSync(join(raiz, ".github", "workflows", "ci.yml"), "utf8");
deveSer(
  "ci.yml real e conforme a politica",
  verificar(ci, "ci.yml", { exigirJobs: true }).length === 0,
);
deveSer(
  "politica exige os jobs obrigatorios",
  verificar(ci.replace(/^ {2}security:/m, "  outro:"), "ci.yml", { exigirJobs: true }).some((e) =>
    e.includes("job obrigatorio ausente: security"),
  ),
);

// 2) Licencas proibidas.
deveFalhar(
  "licencas proibidas",
  exec("node", [
    "scripts/ci/check-licenses.mjs",
    "--json",
    join(reg, "dependencias", "licencas-proibidas.json"),
  ]),
  "licencas proibidas",
);

// 2b) Ferramenta ausente no PATH (REVIEW-001): o gate deve falhar com mensagem explicita, nao mascarar.
const semPath = { ...process.env, PATH: "/usr/bin:/bin" };
deveFalhar(
  "auditar-dependencias sem pnpm no PATH",
  spawnSync("/bin/bash", ["scripts/ci/auditar-dependencias.sh"], {
    cwd: raiz,
    encoding: "utf8",
    env: semPath,
  }),
  "ferramenta ausente no PATH: pnpm",
);
deveFalhar(
  "check-licenses sem pnpm no PATH",
  spawnSync(process.execPath, ["scripts/ci/check-licenses.mjs"], {
    cwd: raiz,
    encoding: "utf8",
    env: semPath,
  }),
  "ferramenta ausente no PATH: pnpm",
);

// 2c) contracts-drift: arquivo gerado NOVO (nao rastreado) em packages/ deve falhar; sem mudanca, passa.
const tmp = mkdtempSync(join(tmpdir(), "nucleos-drift-"));
try {
  const sh = (args) => spawnSync("git", args, { cwd: tmp, encoding: "utf8" });
  const preparar = (gerador) => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(join(tmp, "packages"), { recursive: true });
    writeFileSync(join(tmp, "packages", "base.txt"), "x\n");
    // gerador === null: Makefile SEM o alvo contracts-check (gate nao pode ficar inativo em silencio).
    writeFileSync(
      join(tmp, "Makefile"),
      gerador === null ? "outro:\n\ttrue\n" : `contracts-check:\n\t${gerador}\n`,
    );
    sh(["init", "-q"]);
    sh(["add", "-A"]);
    sh(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base"]);
  };
  const drift = () =>
    spawnSync("bash", [join(raiz, "scripts", "ci", "contracts-drift.sh")], {
      cwd: tmp,
      encoding: "utf8",
      env: { ...process.env, CONTRACTS_DRIFT_RAIZ: tmp },
    });
  preparar("echo novo > packages/gerado-novo.txt");
  deveFalhar("contracts-drift detecta arquivo novo", drift(), "drift");
  preparar("echo y > packages/base.txt");
  deveFalhar("contracts-drift detecta arquivo modificado", drift(), "drift");
  preparar(null);
  deveFalhar("contracts-drift falha quando o alvo contracts-check some", drift(), "ausente");
  preparar("true");
  deveSer("contracts-drift passa sem alteracao", drift().status === 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 2d) build-images: nomes de artefato validos e unicos (sem Docker).
const nomes = [
  "Dockerfile",
  "apps/api/Dockerfile",
  "apps/api/Dockerfile.worker",
  "apps/api/api.Dockerfile",
  "services/Tool-Gateway/Dockerfile",
].map((c) =>
  spawnSync("scripts/ci/build-images.sh", ["--nome", c], {
    cwd: raiz,
    encoding: "utf8",
  }).stdout.trim(),
);
deveSer(
  "build-images gera nomes unicos e validos para tag docker",
  new Set(nomes).size === nomes.length &&
    nomes.every((n) => /^[a-z0-9][a-z0-9-]*$/.test(n)) &&
    nomes[0].startsWith("raiz-"),
);

// 3) Dockerfile fora do padrao.
deveFalhar(
  "hadolint Dockerfile ruim",
  exec("hadolint", [join(reg, "imagem", "Dockerfile")]),
  "DL3",
);

// 4) Dependencia vulneravel sintetica (precisa de rede: bases OSV/PyPI/trivy-db).
if (offline) {
  console.log("SKIP casos de dependencia vulneravel (CI_REGRESSAO_OFFLINE=1)");
} else {
  deveFalhar(
    "osv-scanner package-lock.json vulneravel",
    exec("osv-scanner", ["scan", "source", "-L", join(reg, "dependencias", "package-lock.json")]),
    "lodash",
  );
  deveFalhar(
    "pip-audit requirements vulneravel",
    exec("uvx", [
      "pip-audit==2.10.1",
      "-r",
      join(reg, "dependencias", "requirements.txt"),
      "--no-deps",
      "--disable-pip",
    ]),
    "requests",
  );
  deveFalhar(
    "trivy fs dependencia vulneravel",
    exec("trivy", [
      "fs",
      "--scanners",
      "vuln",
      "--severity",
      "HIGH,CRITICAL",
      "--exit-code",
      "1",
      join(reg, "dependencias"),
    ]),
    "requests",
  );
}

if (falhas.length > 0) {
  console.error(
    `\n${falhas.length} gate(s) do CI NAO falharam como esperado:\n- ${falhas.join("\n- ")}`,
  );
  process.exit(1);
}
console.log(
  "\nTodos os gates do CI falharam como esperado diante das violacoes (controles ativos).",
);
