#!/usr/bin/env node
// Runner de regressao dos controles de qualidade (ENT-FND-002): cada caso DEVE falhar.
// Se algum controle deixar de pegar sua violacao, este script sai com codigo 1.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validar } from "../../scripts/check-commit-msg.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const reg = join(raiz, "tools", "qualidade", "regressao");
const falhas = [];
const tmpRaiz = mkdtempSync(join(tmpdir(), "nucleos-regressao-"));

function exec(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: raiz, encoding: "utf8", ...opts });
}
function deveFalhar(nome, resultado, trecho) {
  const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
  const ok = resultado.status !== 0 && resultado.status !== null && saida.includes(trecho);
  console.log(`${ok ? "OK   " : "FALHA"} ${nome} (esperado: falhar com "${trecho}")`);
  if (!ok) falhas.push(`${nome}\n${saida.slice(0, 800)}`);
}
function deveSer(nome, condicao) {
  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}`);
  if (!condicao) falhas.push(nome);
}

try {
  // 1) ESLint type-aware + seguranca: uma regra esperada por fixture.
  const eslintCasos = {
    "any-explicito.ts": "@typescript-eslint/no-explicit-any",
    "any-fluxo.ts": "@typescript-eslint/no-unsafe-member-access",
    "eval.ts": "no-eval",
    "new-function.ts": "no-new-func",
  };
  for (const [arq, regra] of Object.entries(eslintCasos)) {
    const r = exec("pnpm", ["exec", "eslint", `tools/qualidade/regressao/ts/${arq}`], {
      env: { ...process.env, NUCLEOS_LINT_REGRESSAO: "1" },
    });
    deveFalhar(`eslint ${arq}`, r, regra);
  }
  // 2) any implicito: tsc strict (noImplicitAny).
  deveFalhar(
    "tsc any-implicito.ts",
    exec("pnpm", ["exec", "tsc", "-p", "tools/qualidade/regressao/tsconfig.json"]),
    "TS7006",
  );

  // 3) dependency-cruiser em arvore virtual copiada para tmp.
  const arq = join(tmpRaiz, "arq");
  mkdirSync(arq);
  cpSync(join(reg, "arquitetura"), arq, { recursive: true });
  cpSync(join(raiz, "tsconfig.base.json"), join(arq, "tsconfig.base.json"));
  const dep = exec(
    join(raiz, "node_modules", ".bin", "depcruise"),
    ["apps", "packages", "--config", join(raiz, ".dependency-cruiser.cjs"), "--output-type", "err"],
    { cwd: arq },
  );
  for (const regra of [
    "web-nao-importa-api",
    "api-nao-importa-web",
    "contracts-nao-depende-de-apps",
  ]) {
    deveFalhar(`depcruise ${regra}`, dep, regra);
  }

  // 4) Python: ruff (eval), mypy --strict (sem tipos), import-linter (servicos/SDK).
  deveFalhar(
    "ruff eval_inseguro.py",
    exec("uv", [
      "run",
      "--frozen",
      "ruff",
      "check",
      "--no-cache",
      "tools/qualidade/regressao/python/eval_inseguro.py",
    ]),
    "S307",
  );
  deveFalhar(
    "mypy --strict sem_tipos.py",
    exec("uv", [
      "run",
      "--frozen",
      "mypy",
      "--strict",
      "--no-incremental",
      "tools/qualidade/regressao/python/sem_tipos.py",
    ]),
    "no-untyped-def",
  );
  const il = exec(
    "uv",
    ["run", "--frozen", "--project", raiz, "lint-imports", "--config", join(raiz, ".importlinter")],
    {
      cwd: join(reg, "python", "imports"),
      env: { ...process.env, PYTHONPATH: join(reg, "python", "imports") },
    },
  );
  deveFalhar("import-linter servicos independentes", il, "nao importam uns aos outros BROKEN");
  deveFalhar("import-linter SDK do provisioner", il, "SDK do provisioner BROKEN");

  // 5) gitleaks: segredo sintetico gerado agora (nada de segredo armazenado no repositorio).
  const seg = join(tmpRaiz, "segredo");
  mkdirSync(seg);
  const token = `ghp_${randomBytes(27).toString("base64url").replace(/[-_]/g, "a").slice(0, 36)}`;
  writeFileSync(join(seg, "config.ts"), `export const token = "${token}";\n`);
  deveFalhar(
    "gitleaks segredo sintetico",
    exec("gitleaks", [
      "dir",
      seg,
      "--config",
      join(raiz, ".gitleaks.toml"),
      "--redact",
      "--no-banner",
    ]),
    "leaks found",
  );

  // 6) Convencao de commit.
  deveSer("commit-msg rejeita 'ajustes'", !validar("ajustes"));
  deveSer("commit-msg rejeita tipo desconhecido", !validar("feature: algo"));
  deveSer("commit-msg aceita 'feat(api): x'", validar("feat(api): x"));
  // 7) Nome de branch.
  const br = exec("scripts/check-branch-name.sh", ["minha-branch-solta"]);
  deveSer("branch-name rejeita 'minha-branch-solta'", br.status === 1);
  deveSer(
    "branch-name aceita 'tarefa/fnd-002'",
    exec("scripts/check-branch-name.sh", ["tarefa/fnd-002"]).status === 0,
  );
} finally {
  rmSync(tmpRaiz, { recursive: true, force: true });
}

if (falhas.length > 0) {
  console.error(
    `\n${falhas.length} controle(s) de regressao NAO falharam como esperado:\n- ${falhas.join("\n- ")}`,
  );
  process.exit(1);
}
console.log("\nTodos os casos de regressao falharam como esperado (controles ativos).");
