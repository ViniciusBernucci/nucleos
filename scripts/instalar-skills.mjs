#!/usr/bin/env node
// Copia as skills de skills/skills/ para as pastas de descoberta da raiz do projeto.
// A fonte nunca é alterada; arquivos extras nos destinos (ex.: archify) são preservados.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'skills', 'skills');
// Claude Code, Codex e Antigravity, Antigravity legado.
const targets = ['.claude/skills', '.agents/skills', '.agent/skills'];
const args = process.argv.slice(2);
if (args.length !== 1 || !['--check', '--apply'].includes(args[0])) {
  console.error('Uso: node scripts/instalar-skills.mjs --check|--apply');
  process.exit(2);
}
const apply = args[0] === '--apply';

function filesIn(folder, relative = '') {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Link inesperado: ${folder}/${entry.name}`);
    if (entry.isDirectory()) return filesIn(path.join(folder, entry.name), name);
    if (!entry.isFile()) throw new Error(`Tipo de arquivo inesperado: ${name}`);
    return [name];
  }).sort();
}

// .DS_Store e similares do macOS não fazem parte da distribuição.
const ignored = name => path.basename(name) === '.DS_Store';
const files = filesIn(source).filter(name => !ignored(name));
const expected = new Set(files);
const skills = fs.readdirSync(source).filter(name => fs.existsSync(path.join(source, name, 'SKILL.md')));
let differences = 0;
let extras = 0;
for (const target of targets) {
  const destination = path.join(root, target);
  // Recusa links na cadeia do destino para não escrever fora do repositório.
  for (const folder of [path.dirname(destination), destination]) {
    if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) throw new Error(`Destino não pode ser link: ${folder}`);
  }
  const existing = fs.existsSync(destination) ? filesIn(destination).filter(name => !ignored(name)) : [];
  const extraSkills = new Set(existing.filter(name => !expected.has(name)).map(name => name.split(path.sep)[0]));
  for (const name of extraSkills) {
    console.error(`Extra preservado: ${target}/${name}`);
    extras++;
  }
  for (const name of files) {
    const original = fs.readFileSync(path.join(source, name));
    const output = path.join(destination, name);
    if (fs.existsSync(output) && original.equals(fs.readFileSync(output))) continue;
    differences++;
    if (apply) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(path.join(source, name), output);
    } else {
      console.error(`Ausente ou diferente: ${target}/${name}`);
    }
  }
}
console.log(`${skills.length} skills; ${files.length} arquivos por destino; ${targets.length} destinos; ${differences} ${apply ? 'arquivos copiados' : 'divergências'}; ${extras} extras preservados.`);
// Extras são esperados (skills instaladas por outras fontes) e não reprovam o --check.
process.exitCode = !apply && differences ? 1 : 0;
