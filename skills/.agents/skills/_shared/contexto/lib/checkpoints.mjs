import { pack, source } from './context.mjs';
import { getTask, snapshot, evidenceValid } from './tasks.mjs';
import { sha256, now } from './safety.mjs';

function schema(store) {
  store.db.exec('CREATE TABLE IF NOT EXISTS handoffs(id TEXT PRIMARY KEY,body TEXT NOT NULL,at TEXT NOT NULL)');
}
export function handoff(store, options) {
  schema(store);
  const payload = pack(store, options);
  const body = JSON.stringify(payload), id = sha256(body);
  store.db.prepare('INSERT OR IGNORE INTO handoffs VALUES(?,?,?)').run(id, body, now());
  return { checkpoint: id, bytes: Buffer.byteLength(body), payload, instruction: 'Passe somente payload à próxima sessão. Expanda referências quando faltar evidência; não herde a conversa inteira.' };
}
export function checkpoint(store, id) {
  schema(store);
  if (!/^[a-f0-9]{64}$/.test(id || '')) throw Error('ID de checkpoint inválido');
  const row = store.db.prepare('SELECT body FROM handoffs WHERE id=?').get(id);
  if (!row || sha256(row.body) !== id) throw Error('Checkpoint ausente/corrompido');
  const payload = JSON.parse(row.body);
  const task = payload.task ? getTask(store, payload.task.id) : null;
  let stale = task ? snapshot(store, task) !== payload.current_snapshot || task.revision !== payload.task.revision || Object.values(task.gates).some(gate => !evidenceValid(store, gate)) : false;
  for (const hit of payload.hits) {
    try { if (source(store, hit.source).hash !== hit.hash) stale = true; }
    catch { stale = true; }
  }
  return { checkpoint: id, stale, historical_only: true, payload, instruction: stale ? 'Estado mudou: gere novo handoff; checkpoint nunca transfere aprovação.' : 'Confira evidências atuais; checkpoint não aprova gates.' };
}
