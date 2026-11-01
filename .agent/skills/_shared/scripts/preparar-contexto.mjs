#!/usr/bin/env node
// Always available beside the skills. No package/MCP/global installation.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) throw Error('Contexto integrado requer Node.js >=22.13 (node:sqlite); não há instalação npm/MCP');
const cli = process.env.CONTEXTO_CLI || fileURLToPath(new URL('../contexto/contexto.mjs', import.meta.url));
if (!fs.existsSync(cli)) throw Error('Distribuição incompleta: preserve _shared/contexto junto das skills');
const result = spawnSync(process.execPath, [cli, 'ensure', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
