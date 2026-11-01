import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Store } from '../lib/store.mjs';
import { dataFile } from '../lib/layout.mjs';
import { ensure, git, discover } from '../lib/worktrees.mjs';
import { snapshot, getTask, event, readiness } from '../lib/tasks.mjs';
import { gitSnapshot } from '../lib/git-snapshot.mjs';
import { loadBatch, claim, release, next, prepare, record, integrate, integratedReceipt, flowStatus, finalPackage, cleanupCheck, cleanup, deliver, candidate, isolate } from '../lib/flow.mjs';
import { delivery } from '../lib/delivery.mjs';
import { sha256 } from '../lib/safety.mjs';

function fixture(t, count = 1, risk = null) {
  const temporary = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-v2-')));
  const root = path.join(temporary, 'repo with spaces'); fs.mkdirSync(root);
  git(root, ['init', '-b', 'fixture-base']);
  git(root, ['config', 'user.name', 'Fixture']); git(root, ['config', 'user.email', 'fixture@example.invalid']);
  for (const [name, text] of Object.entries({ '.gitignore': 'node_modules\n', 'src/a.js': 'export const a = 1;\n', 'src/unlisted.js': 'export const b = 1;\n', 'docs/spec.md': 'AC1: Comportamento verificável\n', 'docs/historico/reviews/proof.md': 'Execução observada na fixture de teste\n' })) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), text);
  }
  git(root, ['add', '--', 'src', 'docs', '.gitignore']); git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: base']);
  const base = git(root, ['rev-parse', 'HEAD']); ensure(root); const store = new Store(root);
  t.after(() => { store.close(); fs.rmSync(temporary, { recursive: true }); });
  const tasks = Array.from({ length: count }, (_, i) => ({ id: `T${i + 1}`, ticket: 'ticket-shared', repository: root, root: path.join(temporary, `task ${i + 1}`), branch: `feature/t${i + 1}`, base_sha: base, definition: { id: `T${i + 1}`, profile: 'padrao', rationale: 'Alteração funcional localizada para teste.', risk_factors: ['functional'], criteria: ['AC1'], sources: ['docs/spec.md', 'src/a.js'] } }));
  if (risk) for (const item of tasks) item.definition.risk_level = risk;
  const manifest = { schema: 1, id: 'B1', tasks, integrations: [{ id: 'I1', repository: root, root: path.join(temporary, 'integrated'), branch: 'revisao/teste', base_sha: base, members: tasks.map(t => t.id) }] };
  loadBatch(store, manifest); claim(store, 'B1', 'coordinator');
  return { temporary, root, base, store, manifest, tasks };
}
function inTask(f, name, operation) {
  const item = f.tasks.find(t => t.id === name), target = new Store(item.root);
  try { return operation(target, item); } finally { target.close(); }
}
function emit(f, name, gate, session, extra = {}) {
  return inTask(f, name, target => {
    const task = getTask(target, name);
    return record(f.store, 'B1', name, 'coordinator', { id: `${name}-${task.revision}`, task: name, expected_revision: task.revision, session, type: 'gate', gate, status: 'PASS', snapshot: snapshot(target, task), evidence: [{ source: 'docs/historico/reviews/proof.md', detail: 'Comando/cenário observado' }], ...extra });
  });
}
function approved(f, name = 'T1') {
  prepare(f.store, 'B1', name, 'coordinator');
  const item = f.tasks.find(t => t.id === name);
  fs.appendFileSync(path.join(item.root, 'src/a.js'), `// ${name}\n`);
  git(item.root, ['add', '--', 'src/a.js']); git(item.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', `test: ${name}`]);
  emit(f, name, 'implementation', `implementer-${name}`);
  emit(f, name, 'review', `reviewer-${name}`, { findings: 0, coverage: ['AC1'] });
  emit(f, name, 'audit', 'coordinator', { status: 'NA_SEM_ACHADOS' });
  emit(f, name, 'qa', `qa-${name}`, { coverage: ['AC1'] });
}
function integrated(f, groupId = 'I1', covered = false) {
  integrate(f.store, 'B1', groupId, 'coordinator');
  const group = flowStatus(f.store, 'B1').integrations.find(g => g.id === groupId);
  for (const [stage, session] of [['checks', 'coordinator'], ['review', 'integrated-review'], ['audit', 'coordinator'], ['qa', 'integrated-qa']]) {
    const state = flowStatus(f.store, 'B1'), snap = state.integrations.find(g => g.id === groupId).snapshot;
    integratedReceipt(f.store, 'B1', 'coordinator', { id: `${groupId}-${stage}`, group: groupId, session: covered && stage === 'qa' ? 'integrated-review' : session, expected_revision: state.revision, stage, status: stage === 'audit' ? 'NA_SEM_ACHADOS' : covered && stage === 'qa' ? 'COBERTO_NO_REVIEW' : 'PASS', findings: 0, coverage_complete: true, checks: [{ name: 'integration', status: 'PASS', detail: 'Combined deterministic checks observed in fixture' }], snapshot: snap.hash, head_sha: snap.head, evidence: [{ source: 'docs/historico/reviews/proof.md', hash: sha256(fs.readFileSync(path.join(group.root, 'docs/historico/reviews/proof.md'))) }] });
  }
}

test('bootstrap embutido não instala hook e grava SQLite na pasta skills', t => {
  const f = fixture(t);
  assert.match(dataFile(f.root, 'context.sqlite'), /skills[/\\]_shared[/\\]\.contexto[/\\]context.sqlite$/);
  assert.equal(fs.existsSync(path.join(discover(f.root).common, 'hooks/post-checkout')), false);
  assert.equal(git(f.root, ['status', '--porcelain']), '');
  assert.equal(loadBatch(f.store, f.manifest).duplicate, true);
  assert.equal(next(f.store, 'B1').actions[0].action, 'PREPARE_WORKTREE');
});
test('R2 integrado permite cobertura e exige nova candidata após QA condicional', t => {
  const f = fixture(t, 1, 'R2');
  prepare(f.store, 'B1', 'T1', 'coordinator');
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'review', { findings: 0, coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'coordinator', { status: 'NA_SEM_ACHADOS' });
  assert.equal(next(f.store, 'B1').actions[0].action, 'QA_COVERAGE');
  emit(f, 'T1', 'qa', 'review', { status: 'COBERTO_NO_REVIEW', coverage: ['AC1'], checks: [{ name: 'contract', status: 'PASS', detail: 'Applicable checks observed against acceptance evidence' }] });
  integrated(f, 'I1', true);
  assert.equal(finalPackage(f.store, 'B1').status, 'VALIDADO_LIMPEZA_PENDENTE');
  emit(f, 'T1', 'implementation', 'review', { type: 'require_qa', reason: 'New uncovered functional risk requires independent QA.' });
  emit(f, 'T1', 'qa', 'independent-qa', { coverage: ['AC1'] });
  assert.deepEqual(finalPackage(f.store, 'B1').approved_groups, []);
  assert.throws(() => cleanupCheck(f.store, 'B1', 'T1', 'coordinator'), /não aprovado/);
});
test('ownership de lote e retomada rejeitam coordenador concorrente', t => {
  const f = fixture(t);
  assert.throws(() => claim(f.store, 'B1', 'another'), /Outro coordenador/);
  assert.throws(() => release(f.store, 'B1', 'another'), /diverge/);
  release(f.store, 'B1', 'coordinator'); claim(f.store, 'B1', 'new-owner');
  assert.throws(() => prepare(f.store, 'B1', 'T1', 'coordinator'), /Lease/);
});
test('snapshot Git inclui código omitido da lista e recusa PASS não commitado', t => {
  const f = fixture(t); prepare(f.store, 'B1', 'T1', 'coordinator');
  inTask(f, 'T1', target => {
    const task = getTask(target, 'T1'), before = snapshot(target, task);
    fs.writeFileSync(path.join(target.root, 'src/unlisted.js'), 'changed\n');
    assert.notEqual(snapshot(target, task), before);
    assert.throws(() => emit(f, 'T1', 'implementation', 'impl'), /árvore Git limpa/);
    git(target.root, ['add', '--', 'src/unlisted.js']); git(target.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: changed']);
    assert.notEqual(snapshot(target, task), before);
  });
});
test('APLICAR é decidido antes da correção e verificado em sessão independente', t => {
  const f = fixture(t); prepare(f.store, 'B1', 'T1', 'coordinator');
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'reviewer', { status: 'FAIL', findings: 1, finding_ids: ['R1'], coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'auditor', { type: 'audit_decision', decisions: [{ id: 'R1', decision: 'APLICAR', reason: 'Defeito confirmado por cenário' }] });
  assert.equal(next(f.store, 'B1').actions[0].action, 'CORRECT');
  emit(f, 'T1', 'implementation', 'coordinator', { type: 'round', kind: 'technical', round_id: 'round1' });
  inTask(f, 'T1', target => { fs.appendFileSync(path.join(target.root, 'src/a.js'), '// correction\n'); git(target.root, ['add', '--', 'src/a.js']); git(target.root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: correction']); });
  emit(f, 'T1', 'implementation', 'impl');
  assert.equal(next(f.store, 'B1').actions[0].action, 'REVALIDATE');
  assert.throws(() => emit(f, 'T1', 'review', 'auditor', { type: 'revalidate', results: [{ id: 'R1', status: 'VERIFICADO' }], coverage: ['AC1'], impact_checked: true }), /independente/);
  emit(f, 'T1', 'review', 'reviewer2', { type: 'revalidate', results: [{ id: 'R1', status: 'VERIFICADO' }], coverage: ['AC1'], impact_checked: true });
  assert.equal(next(f.store, 'B1').actions[0].action, 'QA');
  emit(f, 'T1', 'qa', 'qa', { coverage: ['AC1'] });
  assert.equal(inTask(f, 'T1', target => readiness(target, getTask(target, 'T1')).ready), true);
});
test('limite de rodadas é compartilhado entre camadas do mesmo ticket', t => {
  const f = fixture(t, 2); prepare(f.store, 'B1', 'T1', 'coordinator'); prepare(f.store, 'B1', 'T2', 'coordinator');
  for (let i = 0; i < 3; i++) emit(f, i % 2 ? 'T2' : 'T1', 'implementation', 'coord', { type: 'round', kind: 'technical', round_id: `round-${i}` });
  assert.throws(() => emit(f, 'T2', 'implementation', 'coord', { type: 'round', kind: 'technical', round_id: 'round-4' }), /Limite global/);
});
test('integração e limpeza terminam sem force, preservando branches e recibos', t => {
  const f = fixture(t); approved(f); integrated(f);
  assert.equal(finalPackage(f.store, 'B1').status, 'VALIDADO_LIMPEZA_PENDENTE');
  assert.throws(() => cleanup(f.store, 'B1', 'T1', 'coordinator'), /executors-stopped/);
  assert.equal(cleanupCheck(f.store, 'B1', 'T1', 'coordinator').safe_to_remove_by_git, true);
  assert.equal(cleanup(f.store, 'B1', 'T1', 'coordinator', 'yes').removed, true);
  assert.equal(cleanup(f.store, 'B1', 'I1', 'coordinator', 'yes').removed, true);
  assert.equal(finalPackage(f.store, 'B1').status, 'PRONTO_PARA_REVISAO_HUMANA');
  assert.equal(deliver(f.store, 'B1', 'I1', 'coordinator').switched, true);
  assert.equal(git(f.root, ['branch', '--show-current']), 'revisao/teste');
  assert.equal(fs.existsSync(f.tasks[0].root), false);
  assert.ok(git(f.root, ['rev-parse', 'feature/t1']));
});
test('limpeza recusa link para pasta principal sem tocar no destino', t => {
  const f = fixture(t); approved(f); integrated(f);
  const target = f.tasks[0].root;
  fs.symlinkSync(f.root, path.join(target, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(inTask(f, 'T1', target => readiness(target, getTask(target, 'T1')).ready), true);
  assert.throws(() => cleanupCheck(f.store, 'B1', 'T1', 'coordinator'), /ignorados|link|junction/i);
  assert.equal(fs.existsSync(path.join(f.root, 'src/a.js')), true);
});
test('entrega inicial é idempotente e correção mantém um único bloco ClickUp', t => {
  const f = fixture(t);
  const input = { id: 'D1', mode: 'ENTREGA_INICIAL', output: 'docs/historico/entregas/test.md', base_sha: f.base, title: 'Entrega teste', context: 'Problema anterior', changes: 'Comportamento alterado', risks: 'Sem novos riscos', how_to_test: 'Executar cenário AC1', checks: [], clickup: { id: 'nenhum', layer: 'backend' } };
  assert.equal(delivery(f.store, input).committed, false);
  assert.equal(delivery(f.store, input).duplicate, true);
  delivery(f.store, { ...input, id: 'D2', mode: 'CORRECAO', finding_ids: ['R1'] });
  const text = fs.readFileSync(path.join(f.root, input.output), 'utf8');
  assert.equal((text.match(/clickup-resumo:inicio/g) || []).length, 1);
  assert.ok(text.indexOf('Correções') < text.indexOf('## Resumo para o ClickUp'));
});

test('auditoria comum não adia bloqueante nem aceita decisão sem fundamento', t => {
  const f = fixture(t); prepare(f.store, 'B1', 'T1', 'coordinator');
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'review', { status: 'FAIL', findings: 1, finding_ids: ['R1'], coverage: ['AC1'] });
  assert.throws(() => emit(f, 'T1', 'audit', 'audit', { decisions: [{ id: 'R1', decision: 'ADIAR', blocking: true, reason: 'não agora' }] }), /bloqueante/);
  assert.throws(() => emit(f, 'T1', 'audit', 'audit', { decisions: [{ id: 'R1', decision: 'ADIAR' }] }), /fundamentado/);
  emit(f, 'T1', 'audit', 'audit', { type: 'audit_decision', decisions: [{ id: 'R1', decision: 'ADIAR', reason: 'Dívida preexistente, fora do aceite e não bloqueante.' }] });
  assert.equal(next(f.store, 'B1').actions[0].action, 'QA');
});
test('revalidação exige rodada nova para cada plano auditado', t => {
  const f = fixture(t); prepare(f.store, 'B1', 'T1', 'coordinator');
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'review', { status: 'FAIL', findings: 1, finding_ids: ['R1'], coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'audit', { type: 'audit_decision', decisions: [{ id: 'R1', decision: 'APLICAR', reason: 'Defeito reproduzido' }] });
  emit(f, 'T1', 'implementation', 'coord', { type: 'round', kind: 'technical', round_id: 'round-first' });
  const root = f.tasks[0].root;
  fs.appendFileSync(path.join(root, 'src/a.js'), '// fix 1\n'); git(root, ['add', '--', 'src/a.js']); git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: fix1']);
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'review2', { type: 'revalidate', results: [{ id: 'R1', status: 'VERIFICADO' }], coverage: ['AC1'], impact_checked: true });
  emit(f, 'T1', 'review', 'review2', { status: 'FAIL', findings: 1, finding_ids: ['R2'], coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'audit', { type: 'audit_decision', decisions: [{ id: 'R2', decision: 'APLICAR', reason: 'Outra falha reproduzida' }] });
  fs.appendFileSync(path.join(root, 'src/a.js'), '// fix 2\n'); git(root, ['add', '--', 'src/a.js']); git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: fix2']);
  assert.throws(() => emit(f, 'T1', 'implementation', 'impl'), /nova rodada/);
  assert.throws(() => emit(f, 'T1', 'review', 'review2', { type: 'revalidate', results: [{ id: 'R2', status: 'VERIFICADO' }], coverage: ['AC1'], impact_checked: true }), /implementação/);
});
test('perfil elevado a crítico impede auditoria integrada NA', t => {
  const f = fixture(t); prepare(f.store, 'B1', 'T1', 'coordinator');
  emit(f, 'T1', 'implementation', 'coordinator', { type: 'elevate', profile: 'critico' });
  emit(f, 'T1', 'implementation', 'impl'); emit(f, 'T1', 'review', 'review', { findings: 0, coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'audit', { decisions: [] }); emit(f, 'T1', 'qa', 'qa', { coverage: ['AC1'] });
  integrate(f.store, 'B1', 'I1', 'coordinator');
  for (const [stage, session] of [['checks', 'coordinator'], ['review', 'integrated-review']]) {
    const state = flowStatus(f.store, 'B1'), snap = state.integrations[0].snapshot;
    integratedReceipt(f.store, 'B1', 'coordinator', { id: `critical-${stage}`, group: 'I1', session, expected_revision: state.revision, stage, status: 'PASS', findings: 0, coverage_complete: true, snapshot: snap.hash, head_sha: snap.head, evidence: [{ source: 'docs/historico/reviews/proof.md', hash: sha256(fs.readFileSync(path.join(f.manifest.integrations[0].root, 'docs/historico/reviews/proof.md'))) }] });
  }
  const state = flowStatus(f.store, 'B1'), snap = state.integrations[0].snapshot;
  assert.throws(() => integratedReceipt(f.store, 'B1', 'coordinator', { id: 'critical-na', group: 'I1', session: 'coordinator', expected_revision: state.revision, stage: 'audit', status: 'NA_SEM_ACHADOS', snapshot: snap.hash, head_sha: snap.head, evidence: [{ source: 'docs/historico/reviews/proof.md', hash: sha256(fs.readFileSync(path.join(f.manifest.integrations[0].root, 'docs/historico/reviews/proof.md'))) }] }), /NA integrado inválido/);
});
test('QA FAIL requer rodada própria antes de nova implementação', t => {
  const f = fixture(t); approved(f); emit(f, 'T1', 'qa', 'qa', { status: 'FAIL', coverage: ['AC1'], bug_ids: ['BUG-1'] });
  const root = f.tasks[0].root; fs.appendFileSync(path.join(root, 'src/a.js'), '// qa fix\n'); git(root, ['add', '--', 'src/a.js']); git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test: qa fix']);
  assert.throws(() => emit(f, 'T1', 'implementation', 'impl'), /rodada QA/);
  emit(f, 'T1', 'implementation', 'coordinator', { type: 'round', kind: 'qa', round_id: 'qa-round-1' });
  emit(f, 'T1', 'implementation', 'impl');
  emit(f, 'T1', 'review', 'review-focal', { findings: 0, coverage: ['AC1'], mode: 'focal' });
  emit(f, 'T1', 'audit', 'coordinator', { status: 'NA_SEM_ACHADOS' });
  emit(f, 'T1', 'qa', 'qa-new', { coverage: ['AC1'], mode: 'focal', observed_scenarios: ['BUG-1 e regressão AC1'] });
  assert.equal(inTask(f, 'T1', target => readiness(target, getTask(target, 'T1')).ready), true);
});

test('candidata parcial preserva membro isolado e seus arquivos', t => {
  const f = fixture(t, 2); approved(f, 'T1'); prepare(f.store, 'B1', 'T2', 'coordinator');
  isolate(f.store, 'B1', 'T2', 'coordinator', 'Dependência/ambiente essencial indisponível');
  const state = flowStatus(f.store, 'B1');
  candidate(f.store, 'B1', 'coordinator', { id: 'I2', group: 'I1', root: path.join(f.temporary, 'partial'), branch: 'revisao/parcial', expected_revision: state.revision, members: ['T1'] });
  integrated(f, 'I2');
  assert.equal(finalPackage(f.store, 'B1').status, 'PARCIAL_COM_BLOQUEIOS');
  assert.throws(() => cleanupCheck(f.store, 'B1', 'T2', 'coordinator'), /isolada|preservada/);
  assert.throws(() => cleanup(f.store, 'B1', 'T2', 'coordinator', 'yes'), /isolada|preservada/);
  assert.ok(fs.existsSync(path.join(f.tasks[1].root, 'src/a.js')));
});
test('elevação de risco invalida recibos integrados já existentes', t => {
  const f = fixture(t); approved(f); integrated(f);
  emit(f, 'T1', 'implementation', 'coordinator', { type: 'elevate', profile: 'critico' });
  emit(f, 'T1', 'implementation', 'impl-new'); emit(f, 'T1', 'review', 'review-new', { findings: 0, coverage: ['AC1'] });
  emit(f, 'T1', 'audit', 'audit-new', { decisions: [] }); emit(f, 'T1', 'qa', 'qa-new', { coverage: ['AC1'] });
  assert.equal(finalPackage(f.store, 'B1').status, 'BLOQUEADO');
  assert.throws(() => cleanup(f.store, 'B1', 'T1', 'coordinator', 'yes'), /aprovado/);
});
test('especificação externa canônica participa do snapshot sem ser copiada', t => {
  const f = fixture(t); const external = path.join(f.temporary, 'central'); fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'spec.md'), 'Critério central original');
  f.manifest.id = 'B2'; f.manifest.tasks[0].root = path.join(f.temporary, 'external-task'); f.manifest.tasks[0].branch = 'feature/external';
  f.manifest.tasks[0].definition.external_sources = [{ root: external, source: 'spec.md' }];
  f.manifest.integrations[0].root = path.join(f.temporary, 'external-integration'); f.manifest.integrations[0].branch = 'revisao/external';
  loadBatch(f.store, f.manifest); claim(f.store, 'B2', 'coordinator'); prepare(f.store, 'B2', 'T1', 'coordinator');
  const target = new Store(f.manifest.tasks[0].root);
  try {
    const before = snapshot(target, 'T1'); fs.appendFileSync(path.join(external, 'spec.md'), ' - revisado');
    assert.notEqual(snapshot(target, 'T1'), before);
    assert.equal(fs.existsSync(path.join(target.root, 'central/spec.md')), false);
  } finally { target.close(); }
});

test('falha integrada encaminha auditoria/correção em vez de repetir review', t => {
  const f = fixture(t); approved(f); integrate(f.store, 'B1', 'I1', 'coordinator');
  function receipt(stage, status, extra = {}) {
    const state = flowStatus(f.store, 'B1'), group = state.integrations[0], snap = group.snapshot;
    return integratedReceipt(f.store, 'B1', 'coordinator', { id: `failed-${stage}`, group: 'I1', session: `integrated-${stage}`, expected_revision: state.revision, stage, status, snapshot: snap.hash, head_sha: snap.head, evidence: [{ source: 'docs/historico/reviews/proof.md', hash: sha256(fs.readFileSync(path.join(group.root, 'docs/historico/reviews/proof.md'))) }], ...extra });
  }
  receipt('checks', 'PASS');
  receipt('review', 'FAIL', { findings: 1, finding_ids: ['IR-1'], coverage_complete: true });
  assert.equal(next(f.store, 'B1').actions.find(a => a.group === 'I1').action, 'AUDIT_INTEGRATED_FINDINGS');
  receipt('audit', 'FAIL', { decisions: [{ id: 'IR-1', decision: 'APLICAR', reason: 'Interação confirmada entre tarefas' }] });
  assert.equal(next(f.store, 'B1').actions.find(a => a.group === 'I1').action, 'ROUTE_INTEGRATED_CORRECTIONS');
  assert.notEqual(finalPackage(f.store, 'B1').status, 'PRONTO_PARA_REVISAO_HUMANA');
});
