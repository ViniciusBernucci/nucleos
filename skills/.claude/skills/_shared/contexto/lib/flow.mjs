// Deterministic host bridge: JSON actions go to the current AI client. No model
// APIs, subscriptions, shell loop or synthetic independent sessions are used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Store } from './store.mjs';
import { discover, git, ensure, archive } from './worktrees.mjs';
import { putTask, getTask, readiness, event, snapshot, evidenceValid } from './tasks.mjs';
import { safePath, sha256, id, now, atomicWrite, normalized, jsonFile } from './safety.mjs';
import { dataFile } from './layout.mjs';
import { index } from './context.mjs';
import { gitSnapshot } from './git-snapshot.mjs';
import { riskPolicy, requiresQA } from './risk.mjs';
import { validateChecks } from './validation.mjs';
import { qualityEvent } from './session.mjs';

const accepted = status => ['PASS', 'NA_SEM_ACHADOS', 'COBERTO_NO_REVIEW'].includes(status);
function groupRequiresQA(value, group) {
  return group.members.some(name => {
    const item = value.tasks.find(t => t.id === name);
    return requiresQA(item.removed ? item.completion.task : withTask(item, target => getTask(target, name)));
  });
}
function canonical(value) {
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

function schema(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS flow_batches(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_leases(batch TEXT PRIMARY KEY,session TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_receipts(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_rounds(batch TEXT NOT NULL,ticket TEXT NOT NULL,kind TEXT NOT NULL,round_id TEXT NOT NULL,PRIMARY KEY(batch,ticket,kind,round_id));`);
}
function fullPath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\r\n\0]/.test(value)) throw Error('Caminho absoluto real obrigatório no manifesto JSON');
  let current = path.resolve(value);
  while (true) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('Link/junction recusado no manifesto'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  return path.resolve(value);
}
function batch(store, name) {
  schema(store); const row = store.db.prepare('SELECT body FROM flow_batches WHERE id=?').get(id(name));
  if (!row) throw Error('Lote não importado'); return JSON.parse(row.body);
}
function update(store, value) {
  value.revision++; value.updated = now();
  store.db.prepare('UPDATE flow_batches SET revision=?,body=? WHERE id=?').run(value.revision, JSON.stringify(value), value.id);
}
function lease(store, batchId, session) {
  id(session);
  const row = store.db.prepare('SELECT * FROM flow_leases WHERE batch=?').get(batchId);
  if (!row || row.session !== session || row.expires < Date.now()) throw Error('Lease do coordenador ausente/expirado; claim é obrigatório');
}
export function claim(store, batchId, session) {
  batch(store, batchId); id(session);
  return store.transaction(() => {
    const row = store.db.prepare('SELECT * FROM flow_leases WHERE batch=?').get(batchId);
    // Even expired ownership is not silently stolen: a different coordinator
    // must explicitly release after inspecting the old process/session.
    if (row && row.session !== session) throw Error('Outro coordenador é proprietário; verifique a sessão e use release com expected-session');
    store.db.prepare('INSERT OR REPLACE INTO flow_leases VALUES(?,?,?)').run(batchId, session, Date.now() + 1800000);
    return { claimed: true, batch: batchId, session, expires_in_seconds: 1800 };
  });
}
export function release(store, batchId, session) {
  schema(store); id(session);
  const row = store.db.prepare('SELECT * FROM flow_leases WHERE batch=?').get(id(batchId));
  if (!row || row.session !== session) throw Error('Sessão proprietária diverge');
  store.db.prepare('DELETE FROM flow_leases WHERE batch=? AND session=?').run(batchId, session);
  return { released: true, previous_session: session, warning: 'Confirme que o coordenador anterior parou antes de claim por outra sessão' };
}
export function loadBatch(store, input) {
  schema(store); id(input.id);
  if (input.schema !== 1 || !Array.isArray(input.tasks) || !input.tasks.length || input.tasks.length > 1000) throw Error('Manifesto JSON schema:1 e tasks obrigatórios');
  const old = store.db.prepare('SELECT body FROM flow_batches WHERE id=?').get(input.id);
  if (old) {
    const value = JSON.parse(old.body);
    if (![sha256(JSON.stringify(input)), sha256(canonical(input))].includes(value.manifest_hash)) throw Error('Lote imutável já existe com outro manifesto; reutilize o JSON original ou planeje um novo ID de lote. Estado e worktrees preservados');
    return { duplicate: true, batch: value.id };
  }
  const ids = new Set();
  const tasks = input.tasks.map(item => {
    id(item.id); if (ids.has(item.id)) throw Error('ID duplicado no lote'); ids.add(item.id);
    const repository = fullPath(item.repository), root = fullPath(item.root);
    const info = discover(repository);
    if (!item.branch || /^(main|master)$/.test(item.branch)) throw Error('Branch de tarefa obrigatória e não protegida');
    git(repository, ['check-ref-format', '--branch', item.branch]);
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(item.base_sha || '')) throw Error('base_sha completo obrigatório');
    git(repository, ['cat-file', '-e', `${item.base_sha}^{commit}`]);
    if (root === info.primary || root === repository) throw Error('Tarefa deve usar worktree isolada, nunca checkout principal');
    if (!item.definition || item.definition.id !== item.id) throw Error('definition.id deve coincidir com a tarefa');
    riskPolicy(item.definition); // Fail before creating any worktree.
    id(item.ticket || item.id);
    return { ...item, repository, root, common: info.common, dependencies: item.dependencies || [], ticket: item.ticket || item.id, prepared: null, owned: false, isolated: null };
  });
  for (const item of tasks) for (const dependency of item.dependencies) if (!ids.has(dependency) || dependency === item.id) throw Error('Dependência inexistente/cíclica');
  const visiting = new Set(), done = new Set();
  function visit(item) { if (visiting.has(item.id)) throw Error('Grafo cíclico'); if (done.has(item.id)) return; visiting.add(item.id); item.dependencies.forEach(name => visit(tasks.find(t => t.id === name))); visiting.delete(item.id); done.add(item.id); }
  tasks.forEach(visit);
  const integrations = (input.integrations || []).map(item => {
    id(item.id); fullPath(item.root); fullPath(item.repository);
    if (!item.branch?.startsWith('revisao/') || !Array.isArray(item.members) || !item.members.length || new Set(item.members).size !== item.members.length || item.members.some(member => !ids.has(member))) throw Error('Integração requer revisao/ e membros válidos');
    const info = discover(item.repository);
    if (item.root === info.primary) throw Error('Integração deve ser em worktree separada');
    if (item.members.some(member => tasks.find(t => t.id === member).common !== info.common)) throw Error('Grupo integrado mistura repositórios Git diferentes');
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(item.base_sha || '')) throw Error('Base integrada completa obrigatória');
    git(item.repository, ['cat-file', '-e', `${item.base_sha}^{commit}`]);
    git(item.repository, ['check-ref-format', '--branch', item.branch]);
    return { ...item, common: info.common, owned: false, prepared: null, receipt: null, removed: false };
  });
  if (new Set([...tasks.map(t => t.root), ...integrations.map(g => g.root)]).size !== tasks.length + integrations.length) throw Error('Raízes de worktree duplicadas');
  if (integrations.some(g => ids.has(g.id))) throw Error('IDs de grupo e tarefa devem ser distintos');
  if (new Set(integrations.map(i => i.id)).size !== integrations.length) throw Error('ID de integração duplicado');
  for (const task of tasks) if (integrations.filter(g => g.members.includes(task.id)).length !== 1) throw Error('Cada tarefa exige exatamente um grupo de integração');
  const value = { schema: 1, id: input.id, revision: 0, manifest_hash: sha256(canonical(input)), tasks, integrations, created: now(), updated: now() };
  store.db.prepare('INSERT INTO flow_batches VALUES(?,?,?)').run(value.id, 0, JSON.stringify(value));
  return { batch: value.id, tasks: tasks.length, integrations: integrations.length, prepared: false };
}
function withTask(item, operation) {
  const target = new Store(item.root);
  try { return operation(target); } finally { target.close(); }
}
function taskState(item) {
  if (item.removed) {
    try {
      if (git(item.repository, ['rev-parse', item.branch]) !== item.completion?.head) throw Error('Branch preservada mudou');
      const manifest = jsonFile(path.join(item.completion.archive, 'manifest.json'));
      if (!manifest.files?.length || manifest.files.some(file => sha256(fs.readFileSync(safePath(item.completion.archive, file.archive))) !== file.sha256)) throw Error('Arquivo histórico ausente/divergente');
      return item.completion.state;
    }
    catch { return { ready: false, blocked: 'Branch histórica mudou após limpeza' }; }
  }
  if (item.isolated) return { id: item.id, ready: false, isolated: item.isolated, missing: [] };
  if (!item.prepared) return { id: item.id, ready: false, prepared: false, missing: ['worktree'] };
  return withTask(item, target => readiness(target, getTask(target, item.id)));
}
function freshGroup(value, group, states = null) {
  if (!group.prepared) return false;
  return group.members.every(name => {
    const item = value.tasks.find(t => t.id === name), state = states?.[name] || taskState(item);
    const task = item.removed ? item.completion.task : withTask(item, target => getTask(target, name));
    return state.ready && group.member_profiles?.[name] === state.profile && group.member_qa_required?.[name] === requiresQA(task) && group.members_sha?.[name] === (item.removed ? item.completion?.head : git(item.root, ['rev-parse', 'HEAD']));
  });
}
function groupSnapshot(group) {
  if (group.removed) {
    if (git(group.repository, ['rev-parse', group.branch]) !== group.completion?.head) throw Error('Candidata preservada mudou após limpeza');
    return group.completion.snapshot;
  }
  return gitSnapshot({ root: group.root }, { base_sha: group.base_sha, branch: group.branch }, { approve: true });
}
function validReceipt(group, receipt, current = null) {
  if (!receipt || !group.prepared) return false;
  try {
    if (receipt.snapshot !== (current || groupSnapshot(group)).hash) return false;
    return receipt.evidence.every(item => {
      if (!group.removed) return sha256(fs.readFileSync(safePath(group.root, item.source))) === item.hash;
      // Reports must be committed, or part of Contexto's archived captures.
      const manifest = jsonFile(path.join(group.completion.archive, 'manifest.json'));
      const archived = manifest.files.find(file => file.source === item.source);
      if (archived) return sha256(fs.readFileSync(safePath(group.completion.archive, archived.archive))) === item.hash;
      return group.completion.evidence?.[item.source] === item.hash && git(group.repository, ['rev-parse', group.branch]) === group.completion.head;
    });
  } catch { return false; }
}
export function next(store, batchId) {
  const value = batch(store, batchId), actions = [], states = new Map();
  for (const item of value.tasks) {
    try { states.set(item.id, taskState(item)); }
    catch (error) { states.set(item.id, { ready: false, blocked: error.message }); }
  }
  for (const item of value.tasks) {
    const state = states.get(item.id);
    if (item.isolated || state.isolated) continue;
    const blocked = item.dependencies.find(name => { const s = states.get(name); return s.isolated || s.blocked; });
    if (blocked) { actions.push({ task: item.id, action: 'ISOLATE_DEPENDENCY', dependency: blocked }); continue; }
    if (item.dependencies.some(name => !states.get(name).ready)) continue;
    if (state.blocked) { actions.push({ task: item.id, action: 'BLOCKED', reason: state.blocked }); continue; }
    if (!item.prepared) { actions.push({ task: item.id, action: 'PREPARE_WORKTREE' }); continue; }
    if (state.ready) continue;
    const action = withTask(item, target => {
      const task = getTask(target, item.id), current = snapshot(target, task);
      const gate = name => task.gates[name]?.snapshot === current && evidenceValid(target, task.gates[name]) ? task.gates[name] : null;
      if (task.correction_plan) {
        return gate('implementation') && current !== task.correction_plan.origin_snapshot ? { action: 'REVALIDATE', role: 'reviewer', ids: task.correction_plan.decisions.filter(d => d.decision === 'APLICAR').map(d => d.id) } : { action: 'CORRECT', role: 'implementer', ids: task.correction_plan.decisions.filter(d => d.decision === 'APLICAR').map(d => d.id) };
      }
      if (!gate('implementation') || gate('implementation').status !== 'PASS') return { action: 'IMPLEMENT', role: 'implementer' };
      const review = gate('review'), audit = gate('audit'), qa = gate('qa');
      if (!review || !['PASS', 'FAIL'].includes(review.status) || !task.criteria.every(c => review.coverage?.includes(c))) return { action: 'REVIEW', role: 'reviewer' };
      if (!audit) return review.findings === 0 && review.status === 'PASS' && task.profile !== 'critico' ? { action: 'AUDIT_NA', deterministic: true } : { action: 'AUDIT', role: 'auditor' };
      if (!['PASS', 'NA_SEM_ACHADOS'].includes(audit.status)) return { action: 'BLOCKED', reason: 'Auditoria não liberada' };
      if (!qa) return requiresQA(task) ? { action: 'QA', role: 'qa' } : { action: 'QA_COVERAGE', role: 'reviewer', required_status: 'COBERTO_NO_REVIEW', note: 'Registre cobertura, checks aplicáveis e evidências do review. Risco descoberto exige require_qa; não invente QA PASS.' };
      if (qa.status === 'FAIL') return task.qa_rounds >= 3 ? { action: 'ROUND_LIMIT', kind: 'qa' } : { action: 'CORRECT_QA', role: 'implementer' };
      return { action: 'BLOCKED', reason: state.missing.join(', ') };
    });
    actions.push({ task: item.id, root: item.root, ...action });
  }
  for (const group of value.integrations) {
    if (group.superseded_by) continue;
    if (!group.members.every(name => states.get(name)?.ready)) continue;
    if (!group.prepared || !freshGroup(value, group)) { actions.push({ group: group.id, action: 'INTEGRATE' }); continue; }
    const current = groupSnapshot(group);
    const failed = ['checks', 'review', 'audit', 'qa'].find(stage => validReceipt(group, group.receipts?.[stage], current) && ['FAIL', 'BLOCKED'].includes(group.receipts[stage].status));
    if (failed) {
      const receipt = group.receipts[failed];
      const action = receipt.status === 'BLOCKED' ? 'ISOLATE_INTEGRATED_BLOCK' : failed === 'review' ? (group.receipts.audit?.status === 'FAIL' ? 'ROUTE_INTEGRATED_CORRECTIONS' : 'AUDIT_INTEGRATED_FINDINGS') : failed === 'qa' ? 'CORRECT_INTEGRATED_QA' : 'FIX_INTEGRATED_CHECKS';
      actions.push({ group: group.id, action, role: action === 'AUDIT_INTEGRATED_FINDINGS' ? 'auditor' : 'coordinator', report: receipt.evidence, note: 'Identifique as tarefas responsáveis; corrija/revalide nelas e crie nova candidata. Não repita o gate falho sem alteração material.' });
      continue;
    }
    for (const [stage, role] of [['checks', 'coordinator'], ['review', 'reviewer'], ['audit', 'auditor'], ['qa', 'qa']]) {
      if (!validReceipt(group, group.receipts?.[stage], current) || !accepted(group.receipts[stage].status)) { actions.push({ group: group.id, action: stage === 'qa' && !groupRequiresQA(value, group) ? 'INTEGRATED_QA_COVERAGE' : `INTEGRATED_${stage.toUpperCase()}`, role: stage === 'qa' && !groupRequiresQA(value, group) ? 'reviewer' : role }); break; }
    }
  }
  return { batch: value.id, revision: value.revision, host_bridge: true, automatic_model_launch: false, actions, states: Object.fromEntries(states), note: 'A IA cliente executa apenas as ações autorizadas e registra evidências; next não aprova nem chama modelos.' };
}
export function prepare(store, batchId, taskId, session) {
  const value = batch(store, batchId); lease(store, batchId, session);
  const item = value.tasks.find(t => t.id === taskId);
  if (!item) throw Error('Tarefa desconhecida');
  if (item.dependencies.some(name => !taskState(value.tasks.find(t => t.id === name)).ready)) throw Error('Dependências ainda não aprovadas');
  // Existing roots cannot be appropriated by a batch. The intent is written
  // before Git so a crash after worktree creation can be resumed safely.
  if (!item.owned) {
    if (fs.existsSync(item.root)) throw Error('Worktree já existe e não pertence a este lote; preserve-a e planeje outro path');
    item.owned = true; item.intent = { base_sha: item.base_sha, branch: item.branch }; update(store, value);
  }
  if (!fs.existsSync(item.root)) git(item.repository, ['worktree', 'add', '-b', item.branch, item.root, item.base_sha]);
  const info = discover(item.root);
  if (info.common !== item.common || info.branch !== item.branch) throw Error('Ownership/topologia diverge do plano');
  const receipt = ensure(item.root);
  item.dependency_commits ||= {};
  for (const name of item.dependencies) {
    const dependency = value.tasks.find(t => t.id === name);
    if (dependency.common !== item.common) continue; // Cross-repository contracts remain explicit in the spec.
    const head = dependency.removed ? dependency.completion.head : git(dependency.root, ['rev-parse', 'HEAD']);
    if (item.dependency_commits[name] === head) continue;
    if (git(item.root, ['status', '--porcelain'])) throw Error('Worktree suja antes de incluir dependência; preservada');
    git(item.root, ['-c', 'commit.gpgsign=false', 'merge', '--no-edit', '--no-ff', head]);
    item.dependency_commits[name] = head; update(store, value);
  }
  item.effective_base_sha ||= git(item.root, ['rev-parse', 'HEAD']);
  withTask(item, target => {
    const exists = target.db.prepare('SELECT id FROM tasks WHERE id=?').get(item.id);
    if (!exists) putTask(target, { ...item.definition, id: item.id, ticket: item.ticket, batch: batchId, dependencies: [], base_sha: item.effective_base_sha, snapshot_mode: 'git' });
  });
  item.prepared = receipt; update(store, value); return receipt;
}
export function record(store, batchId, taskId, session, input) {
  const value = batch(store, batchId); lease(store, batchId, session);
  const item = value.tasks.find(t => t.id === taskId);
  if (!item?.prepared || input.task !== taskId) throw Error('Tarefa não preparada ou ID divergente');
  if (item.dependencies.some(name => !taskState(value.tasks.find(t => t.id === name)).ready)) throw Error('Dependência perdeu aprovação');
  if (input.type === 'round') {
    // Global per-ticket counter survives layers and integration. Reserve first;
    // an interruption reuses round ID and never spends another round.
    const roundId = id(input.round_id || input.id), kind = input.kind;
    if (!['technical', 'qa'].includes(kind)) throw Error('Rodada inválida');
    store.transaction(() => {
      const exists = store.db.prepare('SELECT 1 FROM flow_rounds WHERE batch=? AND ticket=? AND kind=? AND round_id=?').get(batchId, item.ticket, kind, roundId);
      if (!exists) {
        const count = store.db.prepare('SELECT COUNT(*) AS n FROM flow_rounds WHERE batch=? AND ticket=? AND kind=?').get(batchId, item.ticket, kind).n;
        if (count >= 3) throw Error('Limite global de três rodadas por ticket; isole');
        store.db.prepare('INSERT INTO flow_rounds VALUES(?,?,?,?)').run(batchId, item.ticket, kind, roundId);
      }
    });
  }
  return withTask(item, target => {
    const result = event(target, input);
    if (!result.duplicate) qualityEvent(target, input, result.task);
    if (input.type === 'gate' && input.gate === 'implementation' && input.status === 'PASS') {
      try { result.index = index(target); }
      catch (error) { result.index_warning = error.message; }
    }
    return result;
  });
}
export function isolate(store, batchId, taskId, session, reason) {
  const value = batch(store, batchId); lease(store, batchId, session);
  if (!reason?.trim()) throw Error('Motivo obrigatório');
  const item = value.tasks.find(t => t.id === taskId); if (!item) throw Error('Tarefa inexistente');
  item.isolated = reason;
  let changed;
  do { changed = false; for (const target of value.tasks) if (!target.isolated && target.dependencies.some(dep => value.tasks.find(t => t.id === dep).isolated)) { target.isolated = `Dependência isolada: ${target.dependencies.join(',')}`; changed = true; } } while (changed);
  update(store, value); return { isolated: value.tasks.filter(t => t.isolated).map(t => ({ id: t.id, reason: t.isolated })) };
}
export function integrate(store, batchId, groupId, session) {
  const value = batch(store, batchId); lease(store, batchId, session);
  const group = value.integrations.find(g => g.id === groupId); if (!group) throw Error('Grupo inexistente');
  if (!group.members.every(name => taskState(value.tasks.find(t => t.id === name)).ready)) throw Error('Membros/dependências não aprovados');
  if (group.prepared) {
    if (!freshGroup(value, group)) throw Error('Membros mudaram; preserve candidata e planeje nova integração, sem reset/rebase');
    return { duplicate: true, root: group.root, head: git(group.root, ['rev-parse', 'HEAD']) };
  }
  if (!group.owned) {
    if (fs.existsSync(group.root)) throw Error('Candidata existente fora do lote; não apropriada');
    group.owned = true; update(store, value);
  }
  if (!fs.existsSync(group.root)) git(group.repository, ['worktree', 'add', '-b', group.branch, group.root, group.base_sha]);
  const info = discover(group.root);
  if (info.branch !== group.branch || info.common !== group.common) throw Error('Candidata não corresponde ao plano');
  ensure(group.root); group.members_sha ||= {};
  for (const name of group.members) {
    const item = value.tasks.find(t => t.id === name), head = git(item.root, ['rev-parse', 'HEAD']);
    if (group.members_sha[name] === head) continue;
    if (git(group.root, ['status', '--porcelain'])) throw Error('Candidata suja/conflito; preservada para investigação');
    // Merge is local, without force; conflicts remain visible and no arbitrary
    // ours/theirs resolution or destructive automatic abort is performed.
    try { git(group.root, ['-c', 'commit.gpgsign=false', 'merge', '--no-edit', '--no-ff', head]); }
    catch (error) { group.blocked = error.message; update(store, value); throw error; }
    group.members_sha[name] = head; update(store, value);
  }
  group.member_profiles = Object.fromEntries(group.members.map(name => [name, taskState(value.tasks.find(t => t.id === name)).profile]));
  group.member_qa_required = Object.fromEntries(group.members.map(name => [name, withTask(value.tasks.find(t => t.id === name), target => requiresQA(getTask(target, name)))]));
  group.prepared = { root: group.root, head: git(group.root, ['rev-parse', 'HEAD']) }; group.receipts = {}; update(store, value);
  return { integrated: true, ...group.prepared, approved: false, next: 'checks/review/audit/qa integrados' };
}
export function integratedReceipt(store, batchId, session, input) {
  const value = batch(store, batchId); lease(store, batchId, session); id(input.id); id(input.session);
  const previous = store.db.prepare('SELECT body FROM flow_receipts WHERE id=?').get(input.id);
  if (previous) { if (previous.body !== JSON.stringify(input)) throw Error('ID de recibo reutilizado'); return { duplicate: true }; }
  if (input.expected_revision !== value.revision) throw Error('Revisão de lote divergente');
  const group = value.integrations.find(g => g.id === input.group);
  if (!group || !freshGroup(value, group)) throw Error('Integração ausente/obsoleta');
  const current = groupSnapshot(group);
  if (input.snapshot !== current.hash || input.head_sha !== current.head) throw Error('Snapshot/SHA integrado divergente');
  if (!['checks', 'review', 'audit', 'qa'].includes(input.stage)) throw Error('Etapa integrada inválida');
  if (!['PASS', 'FAIL', 'BLOCKED', 'NA_SEM_ACHADOS', 'COBERTO_NO_REVIEW'].includes(input.status)) throw Error('Status inválido');
  const prior = group.receipts || {}, order = ['checks', 'review', 'audit', 'qa'];
  for (const before of order.slice(0, order.indexOf(input.stage))) {
    const triage = input.stage === 'audit' && before === 'review' && prior.review?.status === 'FAIL' && ['FAIL', 'BLOCKED'].includes(input.status);
    if (!validReceipt(group, prior[before]) || (!['PASS', 'NA_SEM_ACHADOS'].includes(prior[before].status) && !triage)) throw Error('Gate integrado anterior pendente');
  }
  if (input.stage === 'audit' && prior.review?.status === 'FAIL') {
    if (!Array.isArray(input.decisions) || input.decisions.length !== (prior.review.finding_ids || []).length || input.decisions.some(d => !prior.review.finding_ids.includes(d.id) || !['APLICAR', 'ADIAR', 'REJEITAR'].includes(d.decision) || !d.reason?.trim() || (d.blocking && d.decision !== 'APLICAR'))) throw Error('Triagem integrada exige decisões fundamentadas por achado; não aprova a candidata');
  }
  if (input.stage === 'review' && input.status === 'FAIL' && (!Number.isInteger(input.findings) || input.findings < 1 || !Array.isArray(input.finding_ids) || new Set(input.finding_ids).size !== input.findings)) throw Error('Review integrado FAIL exige IDs dos novos achados');
  const implementers = group.members.map(name => withTask(value.tasks.find(t => t.id === name), target => getTask(target, name).gates.implementation.session));
  if (input.stage !== 'checks' && implementers.includes(input.session)) throw Error('Gate integrado requer executor independente');
  if (input.stage === 'audit' && input.session === prior.review?.session && input.status !== 'NA_SEM_ACHADOS') throw Error('Auditor integrado deve ser independente do review');
  if (input.status === 'COBERTO_NO_REVIEW') {
    if (input.stage !== 'qa' || groupRequiresQA(value, group) || input.session !== prior.review?.session || input.coverage_complete !== true) throw Error('Cobertura integrada exige R0–R2, revisor independente e critérios completos');
    validateChecks(input.checks);
  }
  if (input.stage === 'qa' && input.status !== 'COBERTO_NO_REVIEW' && [prior.review?.session, ...(prior.audit?.status === 'PASS' ? [prior.audit.session] : [])].includes(input.session)) throw Error('QA integrado deve ser independente');
  const critical = group.members.some(name => taskState(value.tasks.find(t => t.id === name)).profile === 'critico');
  if (input.status === 'NA_SEM_ACHADOS' && (input.stage !== 'audit' || critical || prior.review?.findings !== 0)) throw Error('NA integrado inválido');
  if (['review', 'qa'].includes(input.stage) && input.status === 'PASS' && (input.coverage_complete !== true || (input.stage === 'review' && input.findings !== 0))) throw Error('Cobertura/novos achados integrados pendentes');
  if (!Array.isArray(input.evidence) || !input.evidence.length) throw Error('Evidência integrada obrigatória');
  const proof = input.evidence.map(item => { const file = safePath(group.root, item.source); const hash = sha256(fs.readFileSync(file)); if (item.hash !== hash) throw Error('Hash de relatório divergente'); return { source: item.source, hash }; });
  group.receipts ||= {}; group.receipts[input.stage] = { ...input, evidence: proof };
  for (const after of order.slice(order.indexOf(input.stage) + 1)) delete group.receipts[after];
  store.transaction(() => { store.db.prepare('INSERT INTO flow_receipts VALUES(?,?)').run(input.id, JSON.stringify(input)); update(store, value); });
  return { recorded: true, approved: input.stage === 'qa' && accepted(input.status), revision: value.revision };
}
export function flowStatus(store, batchId) {
  const value = batch(store, batchId);
  const report = next(store, batchId);
  return { ...report, integrations: value.integrations.map(group => {
    let current = null, blocked = group.blocked || null;
    try { if (group.prepared) current = groupSnapshot(group); } catch (error) { blocked = error.message; }
    const fresh = !blocked && freshGroup(value, group, report.states);
    return { id: group.id, root: group.root, branch: group.branch, snapshot: current, superseded_by: group.superseded_by || null, stages: Object.fromEntries(['checks', 'review', 'audit', 'qa'].map(name => [name, fresh && validReceipt(group, group.receipts?.[name], current) ? group.receipts[name].status : 'PENDING'])), blocked };
  }) };
}
export function finalPackage(store, batchId) {
  const value = batch(store, batchId), report = flowStatus(store, batchId);
  const active = report.integrations.filter(group => !group.superseded_by);
  const approved = active.filter(group => freshGroup(value, value.integrations.find(item => item.id === group.id), report.states) && ['PASS', 'COBERTO_NO_REVIEW'].includes(group.stages.qa) && Object.values(group.stages).every(accepted));
  const blocked = value.tasks.filter(task => task.isolated || !report.states[task.id]?.ready);
  const cleanupDone = value.tasks.every(task => task.isolated || task.removed) && value.integrations.every(group => group.removed || !group.prepared || (group.superseded_by && group.retained_reason));
  const result = approved.length === active.length && !blocked.length ? (cleanupDone ? 'PRONTO_PARA_REVISAO_HUMANA' : 'VALIDADO_LIMPEZA_PENDENTE') : approved.length ? 'PARCIAL_COM_BLOQUEIOS' : 'BLOQUEADO';
  const file = dataFile(store.root, `generated/${batchId}-revisao-humana.md`, { existing: false });
  const lines = [`# Revisão humana — ${batchId}`, '', `Resultado: ${result}.`, '', 'Projeção verificável do SQLite. Publicação externa permanece manual.', '', '| Tarefa | Ticket | Perfil | Estado | Branch | Raiz |', '| --- | --- | --- | --- | --- | --- |'];
  for (const task of value.tasks) lines.push(`| ${task.id} | ${task.ticket} | ${report.states[task.id]?.profile || task.definition.profile} | ${task.isolated || (report.states[task.id]?.ready ? 'pronta para integrar' : 'pendente')} | ${task.branch} | ${task.root} |`);
  for (const group of report.integrations) lines.push('', `## ${group.id}`, '', `Branch: ${group.branch}. Raiz: ${group.root}.`, '', `Gates: ${JSON.stringify(group.stages)}.`, '', group.snapshot ? `HEAD: ${group.snapshot.head}. Base: ${value.integrations.find(g => g.id === group.id).base_sha}.` : 'Sem candidata.', '', 'Revise o diff entre a base e HEAD e os relatórios de aceite. Teste telas no checkout principal somente após conferir estado limpo e trocar para a branch aprovada conforme as regras locais.');
  lines.push('', '## Evidências e decisões', '');
  for (const item of value.tasks) {
    let detail = item.completion?.task;
    if (!detail && item.prepared && !item.removed) { try { detail = withTask(item, targetStore => getTask(targetStore, item.id)); } catch {} }
    if (!detail) continue;
    lines.push(`### ${item.id}`, '', `Especificação: ${detail.spec}. Critérios: ${detail.criteria.join(', ')}.`, '', `Rodadas técnicas: ${detail.technical_rounds}/3. QA: ${detail.qa_rounds}/3.`, '');
    for (const [name, gate] of Object.entries(detail.gates)) lines.push(`- ${name}: ${gate.status}; snapshot ${gate.snapshot}; sessão ${gate.session}; evidências: ${gate.evidence.map(proof => `${proof.source} (SHA256 ${proof.hash})`).join(', ')}.`);
    for (const decision of detail.gates.audit?.decisions || []) lines.push(`- ${decision.id}: ${decision.decision}. ${decision.reason || 'Motivo no relatório histórico de auditoria.'}`);
    lines.push('');
  }
  lines.push('', '## Inventário de worktrees', '', '| Tipo/ID | Path | Branch | Situação | Motivo/arquivo histórico |', '| --- | --- | --- | --- | --- |');
  for (const item of [...value.tasks, ...value.integrations]) lines.push(`| ${item.id} | ${item.root} | ${item.branch} | ${item.removed ? 'removida pelo Git' : 'mantida'} | ${item.completion?.archive || item.isolated || item.retained_reason || 'limpeza/validação pendente'} |`);
  for (const group of value.integrations) if (group.delivered) lines.push('', `Checkout principal ${group.delivered.root}: ${group.delivered.branch}; branch anterior ${group.delivered.previous}; HEAD ${group.delivered.head}.`);
  lines.push('', '## Limpeza', '', 'Use cleanup-check por worktree. O runtime não apaga diretórios, links ou branches. Registre remoções Git sem force somente após o recibo seguro e ausência de executores. Mantenha itens bloqueados e candidatas reprovadas.', '');
  atomicWrite(file, lines.join('\n'));
  return { status: result, output: normalized(path.relative(store.root, file)), approved_groups: approved.map(g => g.id), blocked_tasks: blocked.map(t => t.id), cleanup_required: !cleanupDone };
}
function cleanupTarget(store, value, targetId) {
  const item = value.tasks.find(t => t.id === targetId);
  const group = value.integrations.find(g => g.id === targetId);
  if (item && group) throw Error('ID ambíguo entre tarefa e grupo');
  const target = item || group;
  if (!target?.owned || !target.prepared || target.removed) throw Error('Worktree não pertence ao lote ou já removida');
  const groups = item ? value.integrations.filter(g => !g.superseded_by && g.members.includes(item.id)) : [group];
  if (item && (item.isolated || !taskState(item).ready)) throw Error('Tarefa isolada/não aprovada deve ser preservada');
  if (!groups.length) throw Error('Worktree sem grupo aprovado ativo deve ser preservada');
  if (!groups.every(g => freshGroup(value, g) && ['checks', 'review', 'audit', 'qa'].every(name => validReceipt(g, g.receipts?.[name]) && accepted(g.receipts[name].status)))) throw Error('Grupo integrado ainda não aprovado');
  const info = discover(target.root);
  if (!info.linked || info.primary === info.root || info.common !== target.common || info.branch !== target.branch) throw Error('Topologia/ownership não comprovados');
  if (git(target.root, ['status', '--porcelain', '--untracked-files=all'])) throw Error('Worktree contém mudanças não preservadas');
  const ignored = git(target.root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const own = normalized(path.relative(target.root, dataFile(target.root, 'project.json'))).replace(/\/project.json$/, '');
  if (ignored.some(name => !name.startsWith(own + '/'))) throw Error('Arquivos ignorados únicos, node_modules ou junction: preserve e inspecione manualmente, sem exclusão recursiva');
  function inspect(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw Error('Limpeza bloqueada por link/junction; nunca seguir ou apagar destino');
      if (entry.isDirectory()) inspect(file);
    }
  }
  inspect(target.root);
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) if (fs.existsSync(path.join(info.directory, name))) throw Error('Operação Git pendente');
  return { target, item, group, info };
}
export function cleanupCheck(store, batchId, targetId, session) {
  const value = batch(store, batchId); lease(store, batchId, session);
  const { target } = cleanupTarget(store, value, targetId);
  const receipt = archive(target.root);
  return { ...receipt, path: target.root, branch: target.branch, ownership: true, safe_to_remove_by_git: receipt.cleanup_safe, requires_no_active_executors: true, removed: false };
}
export function cleanup(store, batchId, targetId, session, stopped) {
  const value = batch(store, batchId); lease(store, batchId, session);
  if (stopped !== 'yes') throw Error('Coordenador deve comprovar ausência de executores e informar --executors-stopped yes');
  const existing = [...value.tasks, ...value.integrations].find(t => t.id === targetId);
  if (existing?.removed) return { duplicate: true, removed: true, path: existing.root };
  // Recovery after a process exit between Git removal and recording the receipt.
  if (existing?.completion && !fs.existsSync(existing.root)) {
    if (git(existing.repository, ['rev-parse', existing.branch]) !== existing.completion.head) throw Error('Branch mudou durante retomada de limpeza');
    existing.removed = true; update(store, value); return { recovered: true, removed: true, path: existing.root };
  }
  const { target, item, group } = cleanupTarget(store, value, targetId);
  const receipt = archive(target.root);
  if (!receipt.cleanup_safe) throw Error('Arquivo operacional desconhecido: preserve worktree');
  const head = git(target.root, ['rev-parse', 'HEAD']);
  const completion = { head, archive: receipt.output, at: now() };
  if (item) { completion.state = taskState(item); completion.task = withTask(item, targetStore => getTask(targetStore, item.id)); }
  if (group) {
    completion.snapshot = groupSnapshot(group); completion.evidence = {};
    for (const proof of Object.values(group.receipts).flatMap(r => r.evidence)) completion.evidence[proof.source] = proof.hash;
  }
  target.completion = completion; update(store, value);
  // No shell, recursive filesystem delete, --force, branch delete or traversal of links.
  git(target.repository, ['worktree', 'remove', target.root]);
  target.removed = true; update(store, value);
  return { removed: true, branch_preserved: target.branch, head, archive: receipt.output, path: target.root };
}
export function deliver(store, batchId, groupId, session) {
  const value = batch(store, batchId); lease(store, batchId, session);
  const group = value.integrations.find(g => g.id === groupId);
  if (!group?.removed || !['checks', 'review', 'audit', 'qa'].every(name => validReceipt(group, group.receipts[name]) && accepted(group.receipts[name].status))) throw Error('Candidata ainda não aprovada/preservada e liberada para checkout');
  const primary = discover(group.repository).primary;
  if (git(primary, ['status', '--porcelain', '--untracked-files=all'])) return { switched: false, root: primary, branch: group.branch, reason: 'Checkout principal contém alterações; preservado' };
  const previous = discover(primary).branch;
  git(primary, ['switch', group.branch]);
  group.delivered = { root: primary, branch: group.branch, previous, head: git(primary, ['rev-parse', 'HEAD']) }; update(store, value);
  return { switched: true, ...group.delivered };
}

export function candidate(store, batchId, session, input) {
  const value = batch(store, batchId); lease(store, batchId, session);
  id(input.id); id(input.group);
  if (input.expected_revision !== value.revision) throw Error('Revisão do lote divergente');
  if ([...value.tasks, ...value.integrations].some(item => item.id === input.id)) throw Error('ID de candidata já existe');
  const origin = value.integrations.find(group => group.id === input.group);
  if (!origin || origin.superseded_by) throw Error('Grupo original inexistente/superado');
  const root = fullPath(input.root);
  if (fs.existsSync(root) || [...value.tasks, ...value.integrations].some(item => item.root === root)) throw Error('Nova candidata exige path livre e distinto');
  if (!input.branch?.startsWith('revisao/')) throw Error('Candidata exige revisao/');
  git(origin.repository, ['check-ref-format', '--branch', input.branch]);
  if (!Array.isArray(input.members) || !input.members.length || new Set(input.members).size !== input.members.length || input.members.some(member => !origin.members.includes(member))) throw Error('Selecione membros únicos do grupo original');
  for (const name of input.members) {
    const task = value.tasks.find(t => t.id === name);
    if (!taskState(task).ready) throw Error('Candidata não pode incluir tarefa bloqueada');
    for (const dep of task.dependencies) {
      const source = value.tasks.find(t => t.id === dep);
      if (!taskState(source).ready) throw Error('Dependência bloqueada');
      if (source.common === task.common && !input.members.includes(dep)) throw Error('Inclua dependência da mesma camada na candidata');
    }
  }
  origin.superseded_by = input.id;
  origin.retained_reason = 'Candidata anterior preservada sem reset/remoção; aprovações não transferidas';
  value.integrations.push({ id: input.id, repository: origin.repository, root, branch: input.branch, base_sha: origin.base_sha, common: origin.common, members: input.members, owned: false, prepared: null, receipts: {}, removed: false, derived_from: origin.id });
  update(store, value);
  return { candidate: input.id, revision: value.revision, previous_preserved: origin.id, approved: false };
}
