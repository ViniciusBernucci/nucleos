#!/usr/bin/env node
// Valida a mensagem de commit (Conventional Commits em portugues). Uso: arquivo como arg 1.
import { readFileSync } from "node:fs";

export const TIPOS = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
  "merge",
];
const PADRAO = new RegExp(`^(${TIPOS.join("|")})(\\([a-z0-9._-]+\\))?!?: \\S.{0,98}$`);

export function validar(mensagem) {
  const linha = mensagem.split("\n")[0] ?? "";
  if (/^(Merge |Revert ")/.test(linha) || /^fixup! |^squash! /.test(linha)) return true;
  return PADRAO.test(linha);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("uso: check-commit-msg.mjs <arquivo-da-mensagem>");
    process.exit(2);
  }
  if (!validar(readFileSync(arquivo, "utf8"))) {
    console.error(
      "ERRO: mensagem de commit invalida. Use '<tipo>(escopo opcional): resumo' (ate 100 colunas).\n" +
        `Tipos: ${TIPOS.join(", ")}. Ver documentacoes/engenharia/convencoes-commits-e-branches.md`,
    );
    process.exit(1);
  }
}
