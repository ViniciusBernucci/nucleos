#!/usr/bin/env node
// Compatibility entrypoint: one source of synchronization logic, no drive paths.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let folder = path.dirname(fileURLToPath(import.meta.url));
while (true) {
  const candidate = path.join(folder, 'scripts', 'sincronizar-skills.mjs');
  if (fs.existsSync(candidate) && fs.existsSync(path.join(folder, 'skills', 'planejador-de-lote', 'SKILL.md'))) {
    const args = process.argv.slice(2);
    const result = spawnSync(process.execPath, [candidate, ...(args.length ? args : ['--check'])], { stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
  const parent = path.dirname(folder);
  if (parent === folder) throw Error('Sincronize na fonte do projeto skills; cópia instalada não altera outros projetos nem configuração global');
  folder = parent;
}
