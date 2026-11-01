import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dataFile, dataFolder } from './layout.mjs';
import { sanitize, sanitizeValues, id, now, sha256 } from './safety.mjs';

export function diagnostic(error) {
  const message = sanitize(String(error.message || error)).slice(0, 4000);
  const rules = [
    [/not a git repository|raiz exata/i, 'PROJECT_ROOT', 'Informe --project com a raiz Git real. Se o checkout estiver em app/, use essa pasta explicitamente.'],
    [/Fator de risco|risk_level|Risco exige/i, 'RISK_SCHEMA', 'risk_level é R0–R4; risk_factors usa os nomes documentados. R3/R4 e fatores críticos exigem perfil critico.'],
    [/imutável/i, 'MANIFEST_CONFLICT', 'Reutilize o manifesto original; alteração material exige um novo ID de lote. Nunca edite SQLite para liberar.'],
    [/não pertence|fora do lote|Ownership|ownership/i, 'WORKTREE_OWNERSHIP', 'Preserve a worktree existente; use novo path/branch no planejamento. Não há adoção automática.'],
    [/ETIMEDOUT|timeout/i, 'GIT_TIMEOUT', 'Inspecione git status e git worktree list antes de retomar. Não repita mutações cegamente. CONTEXTO_GIT_TIMEOUT_MS permite limite explícito.'],
  ];
  const rule = rules.find(([pattern]) => pattern.test(message));
  return { code: rule?.[1] || 'CONTEXT_ERROR', message, recovery: rule?.[2] || 'Confira a operação e as evidências locais antes de retomar.' };
}
export function logError(root, error, metadata = {}) {
  const result = diagnostic(error);
  try {
    fs.mkdirSync(dataFolder(root), { recursive: true });
    const file = dataFile(root, 'errors.jsonl', { existing: false });
    const previous = dataFile(root, 'errors.previous.jsonl', { existing: false });
    if (fs.existsSync(file) && fs.statSync(file).size > 1000000) {
      fs.copyFileSync(file, previous); fs.truncateSync(file, 0);
    }
    fs.appendFileSync(file, JSON.stringify({ at: now(), ...sanitizeValues(metadata), ...result }) + '\n', { mode: 0o600 });
    return { ...result, log: file };
  } catch { return { ...result, log: null, log_warning: 'Não foi possível persistir o diagnóstico; erro original preservado.' }; }
}
export function processEvent(root, input) {
  if (!input || typeof input !== 'object') throw Error('Evento de processo inválido');
  id(input.id);
  const record = { id: input.id, status: input.status || 'OBSERVED' };
  if (input.at != null && (typeof input.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(input.at) || !Number.isFinite(Date.parse(input.at)))) throw Error('at deve ser timestamp ISO válido');
  if (!['STARTED', 'PASS', 'FAIL', 'BLOCKED', 'OBSERVED'].includes(record.status)) throw Error('Status de processo inválido');
  for (const key of ['session', 'batch', 'task', 'ticket', 'skill', 'role', 'agent', 'stage', 'provider', 'parent']) {
    if (input[key] != null) { id(input[key]); record[key] = input[key]; }
  }
  if (input.duration_ms != null) {
    if (!Number.isSafeInteger(input.duration_ms) || input.duration_ms < 0) throw Error('duration_ms inválido');
    record.duration_ms = input.duration_ms;
  }
  for (const key of ['findings_new', 'findings_resolved', 'criteria_proven']) {
    if (input[key] != null) {
      if (!Number.isSafeInteger(input[key]) || input[key] < 0 || input[key] > 100000) throw Error(`Contador inválido: ${key}`);
      record[key] = input[key];
    }
  }
  for (const key of ['base_sha', 'head_sha']) if (input[key] != null) {
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(input[key])) throw Error(`SHA inválido: ${key}`);
    record[key] = input[key];
  }
  if (input.file_keys != null) {
    if (!Array.isArray(input.file_keys) || input.file_keys.length > 1000 || input.file_keys.some(key => !/^[a-f0-9]{64}$/.test(key))) throw Error('file_keys requer hashes SHA256 de referências, sem conteúdo');
    record.file_keys = input.file_keys;
  }
  // A missing token counter stays unknown. Process spans never invent usage.
  record.tokens_observed = false;
  const db = new DatabaseSync(dataFile(root, 'context.sqlite'));
  try {
    const binding = db.prepare("SELECT value FROM meta WHERE key='root'").get();
    if (!binding || binding.value !== fs.realpathSync.native(root)) throw Error('Banco pertence a outra raiz ou não tem identidade; processo não registrado');
    db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS process_events(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
    const old = db.prepare('SELECT body FROM process_events WHERE id=?').get(record.id);
    record.at = input.at || (old ? JSON.parse(old.body).at : now());
    const body = JSON.stringify(record);
    if (old && old.body !== body) throw Error('ID de processo reutilizado com conteúdo diferente');
    db.prepare('INSERT OR IGNORE INTO process_events VALUES(?,?)').run(record.id, body);
    return { recorded: !old, duplicate: Boolean(old), ...record };
  } finally { db.close(); }
}
export function qualityEvent(store, input, task) {
  if (!['gate', 'revalidate'].includes(input.type)) return;
  const stage = input.type === 'revalidate' ? 'revalidate' : input.gate;
  const roles = { implementation: ['implementer', 'implementador-de-ticket'], review: ['reviewer', 'revisor-de-codigo'], revalidate: ['reviewer', 'revisor-de-codigo'], audit: ['auditor', 'auditor-de-review'], qa: ['qa', 'revisor-de-qa'] };
  if (!roles[stage]) return;
  const old = store.db.prepare('SELECT body FROM events WHERE task=? AND id<>?').all(task.id, input.id).map(row => JSON.parse(row.body));
  const seenFindings = new Set(old.flatMap(e => e.finding_ids || []));
  const seenCriteria = new Set(old.filter(e => e.gate === 'qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(e.status)).flatMap(e => e.coverage || []));
  const gate = task.gates[input.type === 'revalidate' ? 'review' : input.gate];
  try {
    processEvent(store.root, { id: `quality-${sha256(input.id)}`, at: gate?.at || task.updated, status: ['FAIL', 'BLOCKED'].includes(input.status) ? input.status : 'OBSERVED', session: input.session, task: task.id, ticket: task.ticket, batch: task.batch,
      role: roles[stage][0], skill: stage === 'qa' && input.status === 'COBERTO_NO_REVIEW' ? 'revisor-de-codigo' : roles[stage][1], stage,
      provider: process.env.CONTEXTO_PROVIDER || 'unknown', parent: process.env.CONTEXTO_PARENT,
      agent: input.agent,
      findings_new: (input.finding_ids || []).filter(id => !seenFindings.has(id)).length,
      findings_resolved: (input.results || []).filter(r => r.status === 'VERIFICADO').length,
      criteria_proven: stage === 'qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(input.status) ? (input.coverage || []).filter(id => !seenCriteria.has(id)).length : 0,
      base_sha: task.base_sha || undefined, head_sha: gate?.head_sha });
  } catch { process.stderr.write('{"warning":"Evento confirmado; metadados de qualidade não persistidos."}\n'); }
}
