#!/usr/bin/env node
// Verificacao estatica de compose.deploy.yml + overlays staging/prod (FND-006, AC-3):
// (1) texto dos arquivos sem segredo literal; (2) configuracao renderizada: digest, hardening,
// limites, portas em 127.0.0.1, ambiente sem segredo. Roda em `make lint` (e no job make-lint do CI).
// Interpolacao com valores ficticios: nenhum segredo e lido ou necessario.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { secretFindingsInText, verifyRendered } from "./deploy-lib.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["compose.deploy.yml", "compose.staging.yml", "compose.prod.yml"];
const violations = [];

for (const f of FILES) {
  for (const finding of secretFindingsInText(readFileSync(join(dir, f), "utf8"))) {
    violations.push(`${f}: ${finding}`);
  }
}

const env = {
  ...process.env,
  API_IMAGE: `registry.invalid/nucleos/api@sha256:${"0".repeat(64)}`,
  SECRETS_DIR: "/nao-existe/segredos",
};
for (const overlay of ["compose.staging.yml", "compose.prod.yml"]) {
  const out = execFileSync(
    "docker",
    ["compose", "-f", join(dir, "compose.deploy.yml"), "-f", join(dir, overlay), "config", "--format", "json"],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  violations.push(...verifyRendered(JSON.parse(out), overlay));
}

if (violations.length > 0) {
  console.error(`verificar-deploy: ${violations.length} violacao(oes)`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("verificar-deploy: OK (staging e producao sem segredo literal, com digest e hardening)");
