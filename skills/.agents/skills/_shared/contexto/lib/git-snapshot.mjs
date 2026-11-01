import fs from 'node:fs';
import path from 'node:path';
import { git, discover } from './worktrees.mjs';
import { sha256 } from './safety.mjs';

const historical = name => /^(docs\/historico\/(reviews|entregas)\/)/.test(name);
export function gitSnapshot(store, task, { approve = false } = {}) {
  const info = discover(store.root);
  if (!info.branch || ['main', 'master'].includes(info.branch)) throw Error('Gate Git exige branch de trabalho, nunca main/master/detached');
  if (task.branch && task.branch !== info.branch) throw Error('Branch atual diverge da tarefa');
  const head = git(store.root, ['rev-parse', 'HEAD']);
  if (task.base_sha) git(store.root, ['merge-base', '--is-ancestor', task.base_sha, head]);
  const entries = git(store.root, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD']).split('\0').filter(Boolean).filter(row => !historical(row.split('\t').slice(1).join('\t')));
  const dirty = git(store.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  // Commit all code before any approval. Even report drafts are conservatively
  // refused here: use local Contexto storage for uncommitted gate evidence.
  if (approve && dirty) throw Error('Gate PASS exige commit e árvore Git limpa; preserve mudanças alheias');
  return { hash: sha256(JSON.stringify({ base: task.base_sha, tree: entries, dirty })), head, branch: info.branch, dirty: Boolean(dirty), common: info.common };
}
export const gitAvailable = root => fs.existsSync(path.join(root, '.git'));
