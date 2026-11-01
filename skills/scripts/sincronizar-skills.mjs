#!/usr/bin/env node
// Distribui as skills sem alterar nenhum byte da fonte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'skills');
const targets = ['.agents/skills', '.claude/skills', '.agent/skills'];
const args = process.argv.slice(2);
if (args.length !== 1 || !['--check', '--apply'].includes(args[0])) {
  console.error('Uso: node scripts/sincronizar-skills.mjs --check|--apply');
  process.exit(2);
}
const apply = args[0] === '--apply';

function filesIn(folder, relative = '') {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    if (entry.name === '.contexto' || entry.name === '__pycache__' || entry.name === 'backups' || entry.name.endsWith('.pyc')) return [];
    if (entry.isSymbolicLink()) throw new Error(`Link inesperado: ${folder}/${entry.name}`);
    if (entry.isDirectory()) return filesIn(path.join(folder, entry.name), name);
    if (!entry.isFile()) throw new Error(`Tipo de arquivo inesperado: ${name}`);
    return [name];
  }).sort();
}

// Inclui _shared e todos os recursos para preservar os caminhos relativos.
if (fs.lstatSync(source).isSymbolicLink()) throw Error('Fonte não pode ser link');
const files = filesIn(source);
const observerName = path.join('_shared', 'observatory', 'token_observatory.py');
const observerSource = path.join(root, 'observatory', 'payload', 'runtime', 'token_observatory.py');
const hasObserver = fs.existsSync(observerSource);
if (hasObserver && !files.includes(observerName)) { files.push(observerName); files.sort(); }
const contentFor = name => fs.readFileSync(hasObserver && name === observerName ? observerSource : path.join(source, name));
const signature = crypto.createHash('sha256');
for (const name of files) signature.update(name).update(contentFor(name));
const sourceHash = signature.digest('hex');
const receiptDirectory = fs.existsSync(path.join(root, '.git')) && fs.lstatSync(path.join(root, '.git')).isDirectory() ? path.join(root, '.git') : path.join(root, '.sync-local');
if (fs.existsSync(receiptDirectory) && fs.lstatSync(receiptDirectory).isSymbolicLink()) throw Error('Metadados de sincronização não podem ser link');
const receiptFile = path.join(receiptDirectory, 'fluxo-sync-check.json');
if (apply) {
  const prior = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile, 'utf8')) : null;
  if (!prior || prior.sourceHash !== sourceHash) throw Error('Execute --check após a última alteração antes de --apply');
}
const expected = new Set(files);
const skills = fs.readdirSync(source).filter(name =>
  fs.existsSync(path.join(source, name, 'SKILL.md')));
let differences = 0;
let extras = 0;
if (hasObserver) {
  const mirror = path.join(source, observerName), original = contentFor(observerName);
  if (!fs.existsSync(mirror) || !original.equals(fs.readFileSync(mirror))) {
    differences++;
    if (apply) { fs.mkdirSync(path.dirname(mirror), { recursive: true }); fs.copyFileSync(observerSource, mirror); }
    else console.error(`Espelho do Observatório ausente/diferente: skills/${observerName}`);
  }
}
for (const target of targets) {
  const destination = path.join(root, target);
  // Recusa links na cadeia do destino para não escrever fora do repositório.
  for (const folder of [path.dirname(destination), destination]) {
    if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) {
      throw new Error(`Destino não pode ser link: ${folder}`);
    }
  }
  const existing = fs.existsSync(destination) ? filesIn(destination) : [];
  for (const name of existing.filter(name => !expected.has(name))) {
    console.error(`Arquivo extra (preservado): ${target}/${name}`);
    extras++;
  }
  for (const name of files) {
    const original = contentFor(name);
    const output = path.join(destination, name);
    if (fs.existsSync(output) && original.equals(fs.readFileSync(output))) continue;
    differences++;
    if (apply) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, original);
    } else {
      console.error(`Ausente ou diferente: ${target}/${name}`);
    }
  }
}
if (!apply) { fs.mkdirSync(receiptDirectory, { recursive: true }); fs.writeFileSync(receiptFile, JSON.stringify({ sourceHash })); }
console.log(`${skills.length} skills; ${files.length} arquivos por destino; ${targets.length} destinos; ${differences} ${apply ? 'arquivos sincronizados' : 'divergências'}; ${extras} extras.`);
process.exitCode = extras || (!apply && differences) ? 1 : 0;
