import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initialize, Store } from '../lib/store.mjs';
import { putTask, getTask, event, snapshot, readiness } from '../lib/tasks.mjs';
import { diagnostic, logError, processEvent } from '../lib/session.mjs';
import { handoff, checkpoint } from '../lib/checkpoints.mjs';
import { index } from '../lib/context.mjs';
import { dataFile } from '../lib/layout.mjs';
import { validateFindings } from '../lib/validation.mjs';
import { exportProject, importProject } from '../lib/transfer.mjs';
import { riskPolicy } from '../lib/risk.mjs';

function fixture(t, risk = 'R2', extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'contexto-opt-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs/spec.md'), 'Acceptance criterion C1');
  fs.writeFileSync(path.join(root, 'proof.txt'), 'Observed deterministic checks and acceptance evidence');
  initialize(root, 'optimization');
  const store = new Store(root);
  t.after(() => { store.close(); if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('contexto-opt-')) throw Error('Unsafe fixture cleanup'); fs.rmSync(root, { recursive: true }); });
  putTask(store, { id: 'T1', profile: ['R3', 'R4'].includes(risk) ? 'critico' : 'padrao', risk_level: risk, risk_factors: [], rationale: 'Classificação explícita por impacto verificado.', criteria: ['C1'], sources: ['docs/spec.md'], ...extra });
  const send = (gate, session, fields = {}) => {
    const task = getTask(store, 'T1');
    return event(store, { id: `E-${task.revision}`, task: task.id, session, expected_revision: task.revision, type: 'gate', gate, status: 'PASS', snapshot: snapshot(store, task), evidence: [{ source: 'proof.txt', detail: 'Execução observada no ambiente de testes' }], ...fields });
  };
  return { root, store, send };
}
const checks = [{ name: 'unit-and-contract', status: 'PASS', detail: 'Suite aplicável executada; resultado registrado em proof.txt' }];
test('exportação preserva risco e QA condicional, sem transferir aprovações', t => {
  const source = fixture(t, 'R2', { qa_required: true });
  const destination = fixture(t, 'R1', { id: 'T0' });
  const file = path.join(source.root, 'definitions.json');
  exportProject(source.store, file); importProject(destination.store, file);
  const task = getTask(destination.store, 'T1');
  assert.equal(task.risk_level, 'R2'); assert.equal(task.qa_required, true);
  assert.deepEqual(task.gates, {});
  assert.throws(() => riskPolicy({ profile: 'padrao', risk_level: null }), /risk_level inválido/);
});
for (const level of ['R0', 'R1', 'R2']) test(`${level}: review e checks permitem cobertura, sem QA PASS fictício`, t => {
  const { store, send } = fixture(t, level);
  send('implementation', 'impl'); send('review', 'review', { findings: 0, coverage: ['C1'] });
  send('audit', 'coord', { status: 'NA_SEM_ACHADOS' });
  assert.throws(() => send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'] }), /checks/);
  send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks });
  const state = readiness(store, getTask(store, 'T1'));
  assert.equal(state.ready, true); assert.equal(state.gates.qa, 'COBERTO_NO_REVIEW');
});
for (const level of ['R3', 'R4']) test(`${level}: QA independente e auditoria permanecem obrigatórios`, t => {
  const { store, send } = fixture(t, level);
  send('implementation', 'impl'); send('review', 'review', { findings: 0, coverage: ['C1'] });
  assert.throws(() => send('audit', 'coord', { status: 'NA_SEM_ACHADOS' }), /dispensada/);
  send('audit', 'auditor', { decisions: [] });
  assert.throws(() => send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks }), /R0/);
  assert.throws(() => send('qa', 'review', { coverage: ['C1'] }), /independente/);
  assert.equal(readiness(store, getTask(store, 'T1')).ready, false);
  send('qa', 'qa', { coverage: ['C1'] });
  assert.equal(readiness(store, getTask(store, 'T1')).ready, true);
});
test('risco descoberto obriga QA e invalida dispensa', t => {
  const { store, send } = fixture(t);
  send('implementation', 'impl'); send('review', 'review', { findings: 0, coverage: ['C1'] });
  send('audit', 'coord', { status: 'NA_SEM_ACHADOS' });
  send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks });
  const task = getTask(store, 'T1');
  event(store, { id: 'require-qa', task: 'T1', session: 'review', expected_revision: task.revision, type: 'require_qa', reason: 'Interação funcional sem cobertura observada.' });
  assert.equal(readiness(store, getTask(store, 'T1')).ready, false);
  assert.throws(() => send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks }));
});
test('fluxo avulso R2 permite cobertura integrada sem sessão fictícia de QA', t => {
  const { store, send } = fixture(t);
  send('implementation', 'impl'); send('review', 'review', { findings: 0, coverage: ['C1'] });
  send('audit', 'coord', { status: 'NA_SEM_ACHADOS' });
  send('qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks });
  send('integration', 'coord');
  send('integration_review', 'integrated-review', { findings: 0, coverage: ['C1'] });
  send('integration_audit', 'coord', { status: 'NA_SEM_ACHADOS' });
  send('integration_qa', 'integrated-review', { status: 'COBERTO_NO_REVIEW', coverage: ['C1'], checks });
  send('cleanup', 'coord');
  assert.equal(getTask(store, 'T1').gates.integration_qa.status, 'COBERTO_NO_REVIEW');
  send('integration_review', 'integrated-review-2', { findings: 0, coverage: ['C1'] });
  assert.equal(getTask(store, 'T1').gates.integration_qa, undefined);
  assert.throws(() => send('cleanup', 'coord'), /integrada pendente/);
});
test('checkpoints persistem, detectam alteração e não transferem aprovação', t => {
  const { root, store } = fixture(t);
  const result = handoff(store, { task: 'T1', role: 'auditor', maxBytes: 3000 });
  assert.ok(result.bytes <= 3000); assert.equal(checkpoint(store, result.checkpoint).stale, false);
  fs.appendFileSync(path.join(root, 'docs/spec.md'), '\nChanged criterion context');
  assert.equal(checkpoint(store, result.checkpoint).stale, true);
  assert.equal(readiness(store, getTask(store, 'T1')).ready, false);
});
test('erros são saneados e oferecem recuperação sem contornar segurança', t => {
  const { root } = fixture(t);
  const result = logError(root, new Error('spawnSync git ETIMEDOUT password=synthetic-secret'), { session: 'S1' });
  assert.equal(result.code, 'GIT_TIMEOUT');
  assert.doesNotMatch(fs.readFileSync(dataFile(root, 'errors.jsonl'), 'utf8'), /synthetic-secret/);
  assert.equal(diagnostic(new Error('Lote imutável já existe')).code, 'MANIFEST_CONFLICT');
  assert.equal(diagnostic(new Error('fatal: not a git repository')).code, 'PROJECT_ROOT');
});
test('checkpoint invalida evidência isolada e fonte de pacote sem tarefa', t => {
  const { root, store, send } = fixture(t);
  send('implementation', 'impl'); send('review', 'review', { findings: 0, coverage: ['C1'] });
  const first = handoff(store, { task: 'T1', role: 'reviewer', maxBytes: 4000 });
  fs.appendFileSync(path.join(root, 'proof.txt'), '\nEvidence changed');
  assert.equal(checkpoint(store, first.checkpoint).stale, true);
  index(store);
  const second = handoff(store, { role: 'reviewer', query: 'Acceptance', maxBytes: 4000 });
  assert.ok(second.payload.hits.length > 0);
  fs.appendFileSync(path.join(root, 'docs/spec.md'), '\nSource changed');
  assert.equal(checkpoint(store, second.checkpoint).stale, true);
});
test('eventos de processo são idempotentes e nunca inventam tokens', t => {
  const { root, store } = fixture(t);
  const event = { id: 'proc-1', at: '2026-10-29T00:00:00Z', status: 'PASS', skill: 'revisor-de-codigo', session: 'S1', provider: 'codex', duration_ms: 50 };
  assert.equal(processEvent(root, event).tokens_observed, false);
  assert.equal(processEvent(root, event).duplicate, true);
  assert.throws(() => processEvent(root, { ...event, duration_ms: 51 }), /reutilizado/);
  const automaticTime = { id: 'proc-auto', status: 'OBSERVED', skill: 'grill-me' };
  processEvent(root, automaticTime);
  assert.equal(processEvent(root, automaticTime).duplicate, true);
  store.db.prepare("UPDATE meta SET value=? WHERE key='root'").run('another-root');
  assert.throws(() => processEvent(root, { id: 'foreign-process', status: 'OBSERVED' }), /outra raiz/);
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM process_events WHERE id='foreign-process'").get().n, 0);
  store.db.prepare("UPDATE meta SET value=? WHERE key='root'").run(store.root);
});
test('achados estruturados recusam evidência incompleta e IDs duplicados', () => {
  assert.throws(() => validateFindings({ findings: 1, finding_ids: ['F1'], finding_details: [{ id: 'F1' }] }), /estruturado/);
  validateFindings({ findings: 1, finding_ids: ['F1'], finding_details: [{ id: 'F1', severity: 'P1', file: 'src/a.js', line: 3, evidence: 'Observed failing case', impact: 'Incorrect authorization', expected_test: 'Negative permission case' }] });
});
