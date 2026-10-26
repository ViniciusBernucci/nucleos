#!/usr/bin/env node
// Teste de compatibilidade de contratos (ENT-FND-003, AC-3).
//
// Regra: o schema novo deve aceitar TODO documento aceito pelo baseline (ultima versao liberada, em
// packages/contracts/baseline/). Adicao de campo OPCIONAL = minor (x-schema-version sobe o minor);
// remocao/mudanca incompativel = major (sobe o major, com periodo de coexistencia combinado no ADR/ticket
// do contrato). A analise e conservadora: na duvida (ex.: if/then novo) trata como incompativel.
//
// Uso: node scripts/compat.mjs            compara schemas/ com baseline/ e falha em violacao
//      node scripts/compat.mjs --baseline  promove schemas/ a novo baseline (apos liberar a versao)
import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");

const ESTREITAM_MIN = ["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"];
const ESTREITAM_MAX = ["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"];
const COMPOSICAO = ["allOf", "anyOf", "oneOf", "not", "if", "then", "else", "dependentRequired"];
const IGNORADOS = new Set([
  "title",
  "description",
  "$comment",
  "examples",
  "x-schema-version",
  "$id",
  "$schema",
]);

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tipos = (s) => (s.type === undefined ? null : [].concat(s.type));

function resolver(raiz, s) {
  let atual = s;
  for (let i = 0; i < 20 && typeof atual?.$ref === "string"; i++) {
    const { $ref, ...resto } = atual;
    if (!$ref.startsWith("#/")) return atual;
    const alvo = $ref
      .slice(2)
      .split("/")
      .reduce((o, k) => o?.[k], raiz);
    atual = { ...alvo, ...resto };
  }
  return atual;
}

/** Lista de incompatibilidades (strings) de `novo` em relacao a `antigo`; vazia = compativel. */
export function incompatibilidades(antigo, novo) {
  const erros = [];
  const visitar = (a, n, caminho) => {
    const sa = resolver(antigo, a);
    const sn = resolver(novo, n);
    if (sa === undefined || sn === undefined || typeof sa !== "object" || typeof sn !== "object") {
      if (!iguais(sa, sn)) erros.push(`${caminho}: schema alterado`);
      return;
    }
    const ta = tipos(sa);
    const tn = tipos(sn);
    if (
      tn !== null &&
      (ta === null ||
        !ta.every((t) => tn.includes(t) || (t === "integer" && tn.includes("number"))))
    )
      erros.push(
        `${caminho}: tipo alterado (${JSON.stringify(sa.type)} -> ${JSON.stringify(sn.type)})`,
      );
    if ("const" in sa && !iguais(sa.const, sn.const)) erros.push(`${caminho}: const alterado`);
    if (!("const" in sa) && "const" in sn) erros.push(`${caminho}: const adicionado`);
    if (sa.enum !== undefined) {
      if (sn.enum !== undefined) {
        for (const v of sa.enum)
          if (!sn.enum.some((x) => iguais(x, v)))
            erros.push(`${caminho}: valor de enum removido (${JSON.stringify(v)})`);
      } else if (sn.const !== undefined) erros.push(`${caminho}: enum virou const`);
    } else if (sn.enum !== undefined) erros.push(`${caminho}: enum adicionado`);
    for (const k of ESTREITAM_MIN)
      if (sn[k] !== undefined && (sa[k] === undefined || sn[k] > sa[k]))
        erros.push(`${caminho}: ${k} mais restritivo`);
    for (const k of ESTREITAM_MAX)
      if (sn[k] !== undefined && (sa[k] === undefined || sn[k] < sa[k]))
        erros.push(`${caminho}: ${k} mais restritivo`);
    for (const k of ["pattern", "format", "multipleOf"])
      if (!iguais(sa[k], sn[k])) erros.push(`${caminho}: ${k} alterado`);
    if (sn.uniqueItems === true && sa.uniqueItems !== true)
      erros.push(`${caminho}: uniqueItems adicionado`);
    for (const k of COMPOSICAO) if (!iguais(sa[k], sn[k])) erros.push(`${caminho}: ${k} alterado`);
    for (const campo of sn.required ?? [])
      if (!(sa.required ?? []).includes(campo))
        erros.push(`${caminho}: campo passou a ser obrigatorio (${campo})`);
    const pa = sa.properties ?? {};
    const pn = sn.properties ?? {};
    for (const k of Object.keys(pa)) {
      if (!(k in pn)) erros.push(`${caminho}: campo removido (${k})`);
      else visitar(pa[k], pn[k], `${caminho}/${k}`);
    }
    const apAntigo = sa.additionalProperties ?? true;
    const apNovo = sn.additionalProperties ?? true;
    if (apAntigo !== false && apNovo === false)
      erros.push(`${caminho}: additionalProperties passou a false`);
    else if (typeof apAntigo === "object" && typeof apNovo === "object")
      visitar(apAntigo, apNovo, `${caminho}/*`);
    else if (typeof apAntigo === "object" && apNovo === false)
      erros.push(`${caminho}: additionalProperties passou a false`);
    if (sa.items !== undefined) {
      if (sn.items === undefined) erros.push(`${caminho}: items removido`);
      else visitar(sa.items, sn.items, `${caminho}[]`);
    }
    for (const k of Object.keys(sn))
      if (
        !IGNORADOS.has(k) &&
        !(k in sa) &&
        ![
          "properties",
          "required",
          "items",
          "additionalProperties",
          "$defs",
          "type",
          "const",
          "enum",
          ...ESTREITAM_MIN,
          ...ESTREITAM_MAX,
          "uniqueItems",
          "pattern",
          "format",
          "multipleOf",
          ...COMPOSICAO,
        ].includes(k) &&
        k !== "$ref"
      )
        erros.push(`${caminho}: palavra-chave nova nao analisada (${k})`);
  };
  visitar(antigo, novo, "#");
  // $defs e superficie publica (ex.: handshake tem raiz so com $defs): cada definicao e comparada.
  for (const k of Object.keys(antigo.$defs ?? {})) {
    if (novo.$defs?.[k] === undefined) erros.push(`#/$defs/${k}: definicao removida`);
    else visitar(antigo.$defs[k], novo.$defs[k], `#/$defs/${k}`);
  }
  return [...new Set(erros)];
}

const versao = (s) => {
  const m = /^([0-9]+)\.([0-9]+)$/.exec(s["x-schema-version"] ?? "");
  if (m === null) throw new Error("x-schema-version ausente ou invalida (esperado major.minor)");
  return [Number(m[1]), Number(m[2])];
};

/** Compara um par baseline/atual e devolve problemas de versionamento (vazio = ok). */
export function verificarPar(nome, antigo, novo) {
  if (iguais(antigo, novo)) return [];
  const [ma, na] = versao(antigo);
  const [mn, nn] = versao(novo);
  const incomp = incompatibilidades(antigo, novo);
  if (mn < ma || (mn === ma && nn < na))
    return [`${nome}: versao regrediu (${ma}.${na} -> ${mn}.${nn})`];
  if (incomp.length > 0 && mn === ma)
    return [
      `${nome}: mudanca INCOMPATIVEL sem subir o major (${ma}.${na} -> ${mn}.${nn}):`,
      ...incomp.map((e) => `  - ${e}`),
    ];
  if (mn === ma && nn === na)
    return [`${nome}: schema mudou sem subir x-schema-version (adicao opcional = minor)`];
  return [];
}

function lerDir(dir) {
  const r = new Map();
  if (!existsSync(dir)) return r;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".schema.json")))
    r.set(f.replace(".schema.json", ""), JSON.parse(readFileSync(join(dir, f), "utf8")));
  return r;
}

/** Verifica todos os schemas de `atual` contra `baseline`; devolve a lista de problemas. */
export function verificarDiretorios(baseline, atual) {
  const problemas = [];
  const b = lerDir(baseline);
  const a = lerDir(atual);
  for (const [nome, s] of b) {
    if (!a.has(nome)) problemas.push(`${nome}: contrato removido (existe no baseline)`);
    else problemas.push(...verificarPar(nome, s, a.get(nome)));
  }
  return problemas;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const baseline = join(PACOTE, "baseline");
  const atual = join(PACOTE, "schemas");
  if (process.argv.includes("--baseline")) {
    for (const f of readdirSync(atual).filter((x) => x.endsWith(".schema.json")))
      copyFileSync(join(atual, f), join(baseline, f));
    console.log("baseline atualizado a partir de schemas/");
  } else {
    const problemas = verificarDiretorios(baseline, atual);
    if (problemas.length > 0) {
      console.error(`Compatibilidade de contratos VIOLADA:\n${problemas.join("\n")}`);
      process.exit(1);
    }
    console.log(`compatibilidade ok (${lerDir(atual).size} contratos contra o baseline)`);
  }
}
