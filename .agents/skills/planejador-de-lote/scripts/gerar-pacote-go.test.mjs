import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateBundle } from './gerar-pacote-go.mjs';

const compiler = process.env.CONTEXTO_TEST_CLI;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'contexto-plan-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('contexto-plan-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const project = path.join(root, 'projeto com espaços');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(root, 'worker.md'), '# Executor de teste\n');
  fs.writeFileSync(path.join(root, 'spec.md'), 'Objetivo: alterar README.\nAC-1: preservar as seções existentes.\nEtapa implementar atende AC-1.\n');
  const draft = {
    schema_version: 1, status: 'ready', title: 'Lote de teste', project_root: 'projeto com espaços',
    isolation: 'none', body_file: 'spec.md',
    workflow: { schema_version: 1, workflow: { id: 'test/planning', version: 1, trigger: 'manual' }, steps: [
      { id: 'implementar', type: 'skill', skill_ref: 'test/worker@v1', executor_ref: 'codex/subscription' },
      { id: 'checks', type: 'command', depends_on: ['implementar'], command_ref: 'project/checks' },
    ] },
    bindings: { schema_version: 1, skills: { 'test/worker@v1': 'worker.md' }, executors: { 'codex/subscription': { provider: 'codex' } }, commands: { 'project/checks': ['git', 'diff', '--check'] }, values: {} },
  };
  const input = path.join(root, 'packet.json');
  const manifest = path.join(root, 'planos', 'lote.md');
  const write = () => fs.writeFileSync(input, JSON.stringify(draft));
  write();
  return { root, project, draft, input, manifest, write };
}

test('pacote publicado é lido pelo compilador real de outra pasta', { skip: !compiler }, t => {
  const f = fixture(t);
  const result = generateBundle({ input: f.input, manifest: f.manifest, compiler });
  assert.equal(result.ready, true);
  assert.deepEqual(fs.readdirSync(path.dirname(f.manifest)).sort(), ['lote.bindings.yaml', 'lote.md', 'lote.workflow.yaml']);
  const other = fs.mkdtempSync(path.join(f.root, 'terminal-'));
  const validation = JSON.parse(execFileSync(compiler, ['plan', 'validate', result.manifest], { cwd: other, encoding: 'utf8' }));
  assert.equal(validation.valid, true);
  assert.equal(fs.realpathSync.native(validation.project_root), fs.realpathSync.native(f.project));
  const preview = JSON.parse(execFileSync(compiler, ['run', result.manifest, '--dry-run'], { cwd: other, encoding: 'utf8' }));
  assert.equal(preview.dry_run, true);
  assert.deepEqual(preview.workflow.steps.map(s => s.id), ['implementar', 'checks']);
});

test('validação falha sem publicar arquivos finais', { skip: !compiler }, t => {
  const f = fixture(t);
  f.draft.workflow.steps[0].campo_inexistente = true; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /Compilador recusou/);
  assert.deepEqual(fs.readdirSync(path.dirname(f.manifest)), []);
});

test('plano existente é preservado', { skip: !compiler }, t => {
  const f = fixture(t);
  generateBundle({ input: f.input, manifest: f.manifest, compiler });
  const before = fs.readFileSync(f.manifest);
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /Arquivo existente preservado/);
  assert.deepEqual(fs.readFileSync(f.manifest), before);
});

test('bloqueio de planejamento não se transforma em ready', t => {
  const f = fixture(t); f.draft.status = 'blocked'; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /Planejamento bloqueado/);
  assert.equal(fs.existsSync(f.manifest), false);
});

test('catálogo incompleto é recusado pelo compilador real', { skip: !compiler }, t => {
  const f = fixture(t); delete f.draft.bindings.executors['codex/subscription']; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /executor não cadastrado/);
  assert.equal(fs.existsSync(f.manifest), false);
});

test('condição sem valor declarado bloqueia antes da publicação', t => {
  const f = fixture(t);
  f.draft.workflow.steps[0].when = { op: 'gte', left: { ref: 'task.final_risk_level' }, right: { literal: 3 } }; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /Referência não declarada/);
  assert.equal(fs.existsSync(f.manifest), false);
});

test('orquestrador não vira uma etapa disfarçada', t => {
  const f = fixture(t); f.draft.workflow.steps[0].skill_ref = 'software/orquestrador-fluxo-ia@v1'; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /não cadastre planejador\/orquestrador/);
});

test('risco textual não produz um pacote aparentemente pronto', t => {
  const f = fixture(t); f.draft.bindings.values['task.final_risk_level'] = 'R3'; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /inteiro de 0 a 4/);
  assert.equal(fs.existsSync(f.manifest), false);
});

test('worktree verifica Git e um commit base antes de declarar prontidão', { skip: !compiler }, t => {
  const f = fixture(t); f.draft.isolation = 'worktree'; f.write();
  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest, compiler }), /Worktree exige projeto Git/);
  execFileSync('git', ['init', '-q'], { cwd: f.project });
  fs.writeFileSync(path.join(f.project, 'README.md'), 'base\n');
  execFileSync('git', ['add', 'README.md'], { cwd: f.project });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base'], { cwd: f.project });
  assert.equal(generateBundle({ input: f.input, manifest: f.manifest, compiler }).ready, true);
});
