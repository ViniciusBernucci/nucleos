#!/usr/bin/env node
// Politica estatica dos workflows (ENT-FND-005), sem dependencias externas (analise por linha).
// Complementa o actionlint (sintaxe/tipos). Uso: node scripts/ci/verificar-workflows.mjs [arquivo|dir]...
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const JOBS_OBRIGATORIOS = [
  "lint-ts",
  "lint-py",
  "make-lint",
  "test-ts",
  "test-py",
  "build",
  "contracts-drift",
  "build-images",
  "security",
];

/** Devolve a lista de violacoes de um workflow (texto YAML). */
export function verificar(texto, nome, { exigirJobs = false, acao = false } = {}) {
  const erros = [];
  const linhas = texto.split("\n");
  const err = (n, msg) => erros.push(`${nome}:${n}: ${msg}`);
  if (!acao && !/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(texto)) {
    err(1, "falta `permissions: contents: read` no nivel do workflow");
  }
  if (/^\s*(pull_request_target|workflow_run)\s*:/m.test(texto)) {
    err(1, "gatilho pull_request_target/workflow_run e proibido (segredos/escrita para forks)");
  }
  linhas.forEach((linha, i) => {
    const n = i + 1;
    if (/^\s*#/.test(linha)) return;
    const uses = /^\s*-?\s*uses:\s*(\S+)/.exec(linha);
    if (uses && !uses[1].startsWith("./") && !/@[0-9a-f]{40}$/.test(uses[1])) {
      err(n, `acao nao fixada por SHA de 40 hex: ${uses[1]}`);
    }
    if (/secrets\.(?!GITHUB_TOKEN\b)/.test(linha)) err(n, "uso de segredo alem do GITHUB_TOKEN");
    if (/^\s+\w[\w-]*:\s*write\b/.test(linha) || /permissions:\s*write-all/.test(linha)) {
      err(n, "permissao de escrita nao permitida");
    }
    if (/\$\{\{\s*github\.(event\.|head_ref)/.test(linha) && !/^\s*(if|with):/.test(linha)) {
      err(n, "expressao controlada por usuario fora de if/with (injecao de script)");
    }
    if (/\b(curl|wget)\b[^|]*\|\s*(ba)?sh\b/.test(linha)) err(n, "curl | sh e proibido");
  });
  // timeout-minutes por job: conta jobs (2 espacos sob `jobs:`) e timeouts.
  const bloco = texto.split(/^jobs:\s*$/m)[1] ?? "";
  const jobs = [...bloco.matchAll(/^ {2}([a-z][\w-]*):\s*$/gm)].map((m) => m[1]);
  const timeouts = (bloco.match(/^ {4}timeout-minutes:/gm) ?? []).length;
  if (jobs.length > 0 && timeouts < jobs.length) err(1, "todo job precisa de timeout-minutes");
  if (exigirJobs) {
    for (const j of JOBS_OBRIGATORIOS)
      if (!jobs.includes(j)) err(1, `job obrigatorio ausente: ${j}`);
  }
  return erros;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const alvos = process.argv.slice(2);
  if (alvos.length === 0) alvos.push(".github/workflows", ".github/actions/preparar");
  const arquivos = alvos.flatMap((a) =>
    statSync(a).isDirectory()
      ? readdirSync(a)
          .filter((f) => /\.ya?ml$/.test(f))
          .map((f) => join(a, f))
      : [a],
  );
  let erros = [];
  for (const f of arquivos) {
    erros = erros.concat(
      verificar(readFileSync(f, "utf8"), f, {
        exigirJobs: f.endsWith("ci.yml"),
        acao: f.endsWith("action.yml"),
      }),
    );
  }
  if (erros.length > 0) {
    console.error(erros.join("\n"));
    process.exit(1);
  }
  console.log(`OK: ${arquivos.length} workflow(s) conformes a politica.`);
}
