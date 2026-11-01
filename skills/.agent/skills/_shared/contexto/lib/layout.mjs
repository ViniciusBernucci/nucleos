import fs from 'node:fs';
import path from 'node:path';
import { normalized, safePath } from './safety.mjs';

// All clients select the same store for this root. Existing legacy data is
// preserved in place: migration never silently copies approval state.
const bases = ['skills/_shared', '.agents/skills/_shared', '.claude/skills/_shared', '.agent/skills/_shared'];
export function dataRelative(root) {
  const candidates = [...bases.map(base => `${base}/.contexto`), '.contexto'];
  const configured = candidates.filter(base => fs.existsSync(path.join(root, base, 'project.json')));
  if (configured.length > 1) throw Error('Mais de um estado Contexto nesta raiz; preserve os bancos e resolva a duplicação explicitamente');
  if (configured.length) return configured[0];
  const base = bases.find(base => fs.existsSync(path.join(root, base))) || '.agents/skills/_shared';
  return `${base}/.contexto`;
}
export const dataFolder = root => safePath(root, dataRelative(root), { existing: false });
export function dataFile(root, suffix, options = {}) {
  return safePath(root, `${dataRelative(root)}/${suffix}`, options);
}
export const dataSource = (root, suffix) => normalized(`${dataRelative(root)}/${suffix}`);
