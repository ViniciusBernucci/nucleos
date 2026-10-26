#!/usr/bin/env node
// Verificacao de licencas proibidas (ENT-FND-005). Politica: nega copyleft forte/de rede e
// licencas nao livres (AGPL, GPL, SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC). LGPL/MPL passam.
// Licenca ausente ou desconhecida NAO bloqueia, mas e listada para triagem humana.
// Uso: node scripts/ci/check-licenses.mjs            (pnpm licenses + ambiente uv instalado)
//      node scripts/ci/check-licenses.mjs --json arquivo.json   (entrada pronta: {"pacote@ver":"licenca"})
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const PROIBIDAS =
  /(^|[^L])\bGPL|\bAGPL|\bSSPL|\bBUSL|Business Source|\bElastic[- ]License|Commons[- ]Clause|\bCC-BY-NC|\bProprietary|\bGNU (Affero )?General Public/i;

/** Retorna os pacotes cuja expressao de licenca contem TODAS as alternativas proibidas. */
export function avaliar(pacotes) {
  const proibidos = [];
  const desconhecidos = [];
  for (const [pacote, licenca] of Object.entries(pacotes)) {
    if (!licenca || /^(unknown|\?)$/i.test(licenca)) {
      desconhecidos.push(pacote);
      continue;
    }
    // Em "A OR B" basta uma alternativa permitida; em "A AND B" todas valem.
    const alternativas = licenca.split(/\s+OR\s+/i);
    if (alternativas.every((a) => PROIBIDAS.test(a))) proibidos.push(`${pacote} (${licenca})`);
  }
  return { proibidos, desconhecidos };
}

function exigirFerramentas() {
  for (const f of ["pnpm", "uv"]) {
    if (spawnSync("sh", ["-c", `command -v ${f}`], { encoding: "utf8" }).status !== 0) {
      throw new Error(`ferramenta ausente no PATH: ${f} (rode make setup e exporte .run/bin)`);
    }
  }
}

function coletar() {
  exigirFerramentas();
  const pacotes = {};
  const ts = spawnSync("pnpm", ["licenses", "list", "--json"], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  if (ts.status !== 0) throw new Error(`pnpm licenses falhou: ${ts.stderr}`);
  for (const [licenca, lista] of Object.entries(JSON.parse(ts.stdout))) {
    for (const p of lista) for (const v of p.versions) pacotes[`npm:${p.name}@${v}`] = licenca;
  }
  const py = `
import importlib.metadata as m, json
out = {}
for d in m.distributions():
    md = d.metadata
    lic = md.get("License-Expression") or ""
    if not lic:
        cl = [c.split("::")[-1].strip() for c in (md.get_all("Classifier") or []) if c.startswith("License ::")]
        lic = " OR ".join(cl) or (md.get("License") or "")[:80]
    out[f"pypi:{md['Name']}@{d.version}"] = lic
print(json.dumps(out))`;
  const r = spawnSync("uv", ["run", "--frozen", "python", "-c", py], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`leitura de licencas Python falhou: ${r.stderr}`);
  Object.assign(pacotes, JSON.parse(r.stdout));
  return pacotes;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const i = process.argv.indexOf("--json");
  let pacotes;
  try {
    pacotes = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], "utf8")) : coletar();
  } catch (e) {
    console.error(`ERRO: ${e.message}`);
    process.exit(1);
  }
  const { proibidos, desconhecidos } = avaliar(pacotes);
  if (desconhecidos.length > 0) {
    console.log(
      `AVISO: ${desconhecidos.length} pacote(s) sem licenca declarada: ${desconhecidos.join(", ")}`,
    );
  }
  if (proibidos.length > 0) {
    console.error(`ERRO: licencas proibidas:\n- ${proibidos.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`OK: ${Object.keys(pacotes).length} pacotes verificados; nenhuma licenca proibida.`);
}
