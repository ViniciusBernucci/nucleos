#!/usr/bin/env node
// Varre todos os `pattern` dos schemas com a semantica ECMA-262 (RegExp com flag u, como o ajv) e
// imprime, em JSON, os codepoints que casam por (pattern, prefixo). O teste Python compara o resultado
// com o seu motor (packages/contracts-py/tests/test_contratos.py): qualquer diferenca de paridade falha.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMAS = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");
export const PREFIXOS = ["", "a", "x:", "/"];
export const CODEPOINTS = [
  ...Array.from({ length: 0x10000 }, (_, i) => i).filter((c) => c < 0xd800 || c > 0xdfff),
  0x10000,
  0x1f600,
  0x10ffff,
];

export function coletarPatterns() {
  const achados = new Set();
  const visitar = (no) => {
    if (Array.isArray(no)) no.forEach(visitar);
    else if (no !== null && typeof no === "object") {
      if (typeof no.pattern === "string") achados.add(no.pattern);
      Object.values(no).forEach(visitar);
    }
  };
  for (const f of readdirSync(SCHEMAS).sort())
    visitar(JSON.parse(readFileSync(join(SCHEMAS, f), "utf8")));
  return [...achados].sort();
}

function faixas(lista) {
  const out = [];
  for (const c of lista) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo[1] === c - 1) ultimo[1] = c;
    else out.push([c, c]);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const resultado = {};
  for (const p of coletarPatterns()) {
    const re = new RegExp(p, "u");
    for (const pre of PREFIXOS) {
      const casam = CODEPOINTS.filter((c) => re.test(pre + String.fromCodePoint(c)));
      resultado[JSON.stringify([p, pre])] = faixas(casam);
    }
  }
  process.stdout.write(JSON.stringify(resultado));
}
