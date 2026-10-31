#!/usr/bin/env node
// Gerador unico de contratos (ENT-FND-003). Fonte da verdade: packages/contracts/schemas/*.schema.json
// (JSON Schema 2020-12) e packages/contracts/openapi/control-plane.openapi.json (OpenAPI 3.1).
//
// Saidas (todas versionadas, com cabecalho "GERADO - NAO EDITAR"):
//   packages/contracts/src/generated/        tipos TypeScript + schemas embutidos
//   packages/sdk/src/generated/              tipos do cliente a partir do OpenAPI
//   packages/contracts-py/src/nucleos_contracts/models/    modelos Pydantic (datamodel-code-generator)
//   packages/contracts-py/src/nucleos_contracts/schemas/   copia dos schemas usada na validacao Python
//
// Uso: node scripts/gerar.mjs           regenera no repositorio
//      node scripts/gerar.mjs --check   gera em diretorio temporario e FALHA se diferir do versionado
//                                       (arquivo alterado, ausente ou obsoleto = drift)
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "json-schema-to-typescript";
import openapiTS, { astToString } from "openapi-typescript";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMAS = join(RAIZ, "packages", "contracts", "schemas");
const OPENAPI = join(RAIZ, "packages", "contracts", "openapi", "control-plane.openapi.json");

/** Diretorios gerados, relativos a raiz do repositorio. */
export const SAIDAS = [
  "packages/contracts/src/generated",
  "packages/sdk/src/generated",
  "packages/contracts-py/src/nucleos_contracts/models",
  "packages/contracts-py/src/nucleos_contracts/schemas",
];

const AVISO =
  "GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.";

const pascal = (s) =>
  s
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

function lerSchemas() {
  return readdirSync(SCHEMAS)
    .filter((f) => f.endsWith(".schema.json"))
    .sort()
    .map((f) => ({
      nome: f.replace(/\.schema\.json$/, ""),
      arquivo: f,
      texto: readFileSync(join(SCHEMAS, f), "utf8"),
      schema: JSON.parse(readFileSync(join(SCHEMAS, f), "utf8")),
    }));
}

/** Defs primitivas (sem propriedades) viram inline: evita aliases genericos (Uuid) colidindo entre arquivos. */
function prepararParaTipos(nome, original) {
  const schema = structuredClone(original);
  const raiz = pascal(nome);
  schema.title = raiz;
  const defs = schema.$defs ?? {};
  const originais = structuredClone(defs);
  const primitivas = new Set(
    Object.entries(defs)
      .filter(([, d]) => d.properties === undefined)
      .map(([k]) => k),
  );
  const visitar = (no) => {
    if (Array.isArray(no)) return no.map(visitar);
    if (no === null || typeof no !== "object") return no;
    if (typeof no.$ref === "string" && no.$ref.startsWith("#/$defs/")) {
      const alvo = no.$ref.slice("#/$defs/".length);
      if (primitivas.has(alvo)) {
        const { $ref: _ignorado, ...resto } = no;
        return visitar({ ...originais[alvo], ...resto });
      }
    }
    return Object.fromEntries(Object.entries(no).map(([k, v]) => [k, visitar(v)]));
  };
  for (const k of Object.keys(defs)) {
    if (primitivas.has(k)) delete defs[k];
    else defs[k].title = raiz + pascal(k);
  }
  const resultado = visitar(schema);
  if (Object.keys(resultado.$defs ?? {}).length === 0) delete resultado.$defs;
  return resultado;
}

async function gerarTipos(saida, schemas) {
  const dir = join(saida, SAIDAS[0]);
  mkdirSync(dir, { recursive: true });
  const indice = [`// ${AVISO}`];
  for (const { nome, schema } of schemas) {
    const raiz = pascal(nome);
    const ts = await compile(prepararParaTipos(nome, schema), raiz, {
      bannerComment: `/* eslint-disable */\n// ${AVISO}\n// Fonte: packages/contracts/schemas/${nome}.schema.json`,
      unreachableDefinitions: true,
      additionalProperties: false,
      declareExternallyReferenced: true,
    });
    writeFileSync(join(dir, `${nome}.ts`), ts);
    const publicos = [...ts.matchAll(/^export (?:interface|type) (\w+)/gm)]
      .map((m) => m[1])
      .filter((n) => n.startsWith(raiz));
    indice.push(`export type { ${publicos.join(", ")} } from "./${nome}.js";`);
  }
  const nomes = schemas.map((s) => s.nome);
  const corpo = schemas
    .map(({ nome, schema }) => `  ${JSON.stringify(nome)}: ${JSON.stringify(schema, null, 2)},`)
    .join("\n");
  writeFileSync(
    join(dir, "schemas.ts"),
    `/* eslint-disable */\n// ${AVISO}\n\nexport type SchemaName = ${nomes.map((n) => JSON.stringify(n)).join(" | ")};\n\n` +
      `export const SCHEMA_NAMES: readonly SchemaName[] = ${JSON.stringify(nomes)};\n\n` +
      `export const schemas: Readonly<Record<SchemaName, Readonly<Record<string, unknown>>>> = {\n${corpo}\n};\n`,
  );
  indice.push('export { SCHEMA_NAMES, schemas } from "./schemas.js";');
  indice.push('export type { SchemaName } from "./schemas.js";');
  writeFileSync(join(dir, "index.ts"), indice.join("\n") + "\n");
}

async function gerarOpenapi(saida) {
  const dir = join(saida, SAIDAS[1]);
  mkdirSync(dir, { recursive: true });
  const ast = await openapiTS(pathToFileURL(OPENAPI), { immutable: true });
  writeFileSync(
    join(dir, "control-plane.ts"),
    `/* eslint-disable */\n// ${AVISO}\n// Fonte: packages/contracts/openapi/control-plane.openapi.json\n\n${astToString(ast)}`,
  );
}

function removerPropertyNames(no) {
  if (Array.isArray(no)) no.forEach(removerPropertyNames);
  else if (no !== null && typeof no === "object") {
    delete no.propertyNames;
    Object.values(no).forEach(removerPropertyNames);
  }
}

function gerarPython(saida, schemas) {
  const stage = mkdtempSync(join(tmpdir(), "nucleos-contratos-"));
  try {
    for (const { nome, schema } of schemas) {
      const copia = structuredClone(schema);
      copia.title = pascal(nome);
      // propertyNames com $ref a um RootModel gera dict[Uuid, ...] (chave nao hashable no Pydantic).
      // A restricao de chaves continua valendo na validacao por JSON Schema.
      removerPropertyNames(copia);
      writeFileSync(join(stage, `${nome}.json`), JSON.stringify(copia, null, 1));
    }
    const modelos = join(saida, SAIDAS[2]);
    rmSync(modelos, { recursive: true, force: true });
    const r = spawnSync(
      process.env.UV ?? "uv",
      [
        "run",
        "--frozen",
        "datamodel-codegen",
        ...["--input", stage, "--input-file-type", "jsonschema", "--output", modelos],
        ...["--output-model-type", "pydantic_v2.BaseModel", "--disable-timestamp"],
        ...["--target-python-version", "3.12", "--formatters", "black", "isort"],
        ...["--use-annotated", "--field-constraints", "--extra-fields", "forbid"],
        ...["--use-title-as-name", "--enum-field-as-literal", "all"],
        ...["--custom-file-header", `# ${AVISO}`],
      ],
      { cwd: RAIZ, encoding: "utf8" },
    );
    if (r.status !== 0) {
      throw new Error(`datamodel-codegen falhou (${String(r.status)}):\n${r.stdout}${r.stderr}`);
    }
    const copias = join(saida, SAIDAS[3]);
    mkdirSync(copias, { recursive: true });
    for (const { arquivo, texto } of schemas) writeFileSync(join(copias, arquivo), texto);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** Gera todas as saidas sob `saida` (mesma estrutura relativa do repositorio). */
export async function gerarEm(saida) {
  for (const d of SAIDAS) rmSync(join(saida, d), { recursive: true, force: true });
  const schemas = lerSchemas();
  await gerarTipos(saida, schemas);
  await gerarOpenapi(saida);
  gerarPython(saida, schemas);
}

function listar(base) {
  const arquivos = new Map();
  const percorrer = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "__pycache__") continue;
      const caminho = join(dir, e.name);
      if (e.isDirectory()) percorrer(caminho);
      else arquivos.set(relative(base, caminho), readFileSync(caminho, "utf8"));
    }
  };
  for (const d of SAIDAS) percorrer(join(base, d));
  return arquivos;
}

/** Compara dois repositorios (ou arvores) nas saidas geradas; devolve a lista de divergencias. */
export function compararArvores(gerada, versionada) {
  const a = listar(gerada);
  const b = listar(versionada);
  const dif = [];
  for (const [k, v] of a) {
    if (!b.has(k)) dif.push(`ausente no repositorio (arquivo novo gerado): ${k}`);
    else if (b.get(k) !== v) dif.push(`desatualizado: ${k}`);
  }
  for (const k of b.keys()) if (!a.has(k)) dif.push(`obsoleto (nao e mais gerado): ${k}`);
  return dif.sort();
}

async function main() {
  if (process.argv.includes("--check")) {
    const tmp = mkdtempSync(join(tmpdir(), "nucleos-gerado-"));
    try {
      await gerarEm(tmp);
      // CONTRACTS_REPO_ROOT: so para testes (arvore a comparar); por padrao, o proprio repositorio.
      const dif = compararArvores(tmp, process.env.CONTRACTS_REPO_ROOT ?? RAIZ);
      if (dif.length > 0) {
        console.error(
          `DRIFT em contratos gerados (rode make contracts-gen e commite):\n- ${dif.join("\n- ")}`,
        );
        process.exit(1);
      }
      console.log("contratos gerados em dia com as fontes (sem drift)");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    return;
  }
  await gerarEm(RAIZ);
  console.log("contratos regenerados em:", SAIDAS.join(", "));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
