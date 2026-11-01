#!/usr/bin/env node
// Enumerate explicit files so the command works in PowerShell/cmd and POSIX shells.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folders = ['tests', 'skills/_shared/contexto/tests'];
const files = folders.flatMap(folder => fs.readdirSync(path.join(root, folder)).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(root, folder, name)));
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
