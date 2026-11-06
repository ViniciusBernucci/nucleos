#!/usr/bin/env node
// Empacota o planejamento e usa o compilador real como validador. Nunca executa o plano.
import fs from 'node:fs';
import { buildLeanFlow } from './fluxo-enxuto.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function requireValue(ok, message) { if (!ok) throw new Error(message); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function absolute(base, value) {
  requireValue(typeof value === 'string' && value.trim(), 'Caminho obrigatório ausente');
  return path.resolve(base, value);
}
function argv(value, label) {
  requireValue(Array.isArray(value) && value.length && value.every(x => typeof x === 'string') && value[0].trim(), `${label}: use uma lista argv explícita`);
}
function yaml(value, depth = 0) {
  const indent = ' '.repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return `${indent}[]`;
    return value.map(item => object(item) || Array.isArray(item)
      ? `${indent}-\n${yaml(item, depth + 2)}` : `${indent}- ${JSON.stringify(item)}`).join('\n');
  }
  if (object(value)) {
    if (!Object.keys(value).length) return `${indent}{}`;
    return Object.entries(value).map(([key, item]) => object(item) || Array.isArray(item)
      ? `${indent}${JSON.stringify(key)}:\n${yaml(item, depth + 2)}`
      : `${indent}${JSON.stringify(key)}: ${JSON.stringify(item)}`).join('\n');
  }
  return `${indent}${JSON.stringify(value)}`;
}
function validateWithCompiler(binary, args, key) {
  let stdout;
  try { stdout = execFileSync(binary, args, { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { throw new Error(`Compilador recusou ${args[0]}: ${error.stderr?.toString().trim() || error.stdout?.toString().trim() || error.message}`); }
  let result;
  try { result = JSON.parse(stdout); } catch { throw new Error('O compilador não retornou JSON válido'); }
  requireValue(result[key] === true, `O compilador não confirmou ${key}`);
  return result;
}

export function generateBundle({ input, manifest, compiler = process.env.CONTEXTO_CLI || 'contexto' }) {
  const inputPath = path.resolve(input);
  const inputDir = path.dirname(inputPath);
  const draft = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));
  requireValue(draft.schema_version === 1, 'schema_version do pacote deve ser 1');
  requireValue(draft.status === 'ready', 'Planejamento bloqueado ou sem status ready: não publicar manifesto executável');
  requireValue(typeof draft.title === 'string' && draft.title.trim(), 'Título do plano ausente');
  requireValue(Boolean(draft.body) !== Boolean(draft.body_file), 'Informe exatamente body ou body_file');
  const body = draft.body_file ? fs.readFileSync(absolute(inputDir, draft.body_file), 'utf8') : draft.body;
  requireValue(typeof body === 'string' && body.trim(), 'Corpo aprovado do plano ausente');
  requireValue(!/^---\r?\n/.test(body), 'body/body_file deve conter somente o corpo, sem outro cabeçalho operacional');
  const project = fs.realpathSync.native(absolute(inputDir, draft.project_root));
  requireValue(fs.statSync(project).isDirectory(), 'project_root deve ser diretório existente');
  const isolation = draft.isolation ?? 'worktree';
  requireValue(['worktree', 'none'].includes(isolation), 'isolation inválido');
  if (isolation === 'worktree') {
    try {
      const gitRoot = execFileSync('git', ['-C', project, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const gitStat = fs.statSync(gitRoot, { bigint: true });
      const projectStat = fs.statSync(project, { bigint: true });
      requireValue(gitStat.dev === projectStat.dev && gitStat.ino === projectStat.ino, 'project_root deve ser a raiz Git, não uma subpasta');
      execFileSync('git', ['-C', project, 'rev-parse', '--verify', 'HEAD'], { stdio: 'ignore', windowsHide: true });
    } catch (error) { throw new Error(`Worktree exige projeto Git com commit base verificado: ${error.message}`); }
  }
  requireValue(draft.flow_profile === undefined || ['enxuto-v1', 'custom'].includes(draft.flow_profile), 'flow_profile inválido');
  requireValue(object(draft.bindings), 'Catálogo bindings completo ausente');
  const bindings = structuredClone(draft.bindings);
  if ((draft.flow_profile ?? 'enxuto-v1') === 'enxuto-v1') draft.workflow = buildLeanFlow({...draft, project_root:project}, bindings);
  requireValue(object(draft.workflow) && Array.isArray(draft.workflow.steps), 'Workflow completo ausente');
  bindings.max_concurrency ??= 1;
  if (Object.hasOwn(bindings.values ?? {}, 'task.final_risk_level')) {
    const risk = bindings.values['task.final_risk_level'];
    requireValue(Number.isInteger(risk) && risk >= 0 && risk <= 4, 'task.final_risk_level deve ser um inteiro de 0 a 4');
  }
  for (const [ref, skillPath] of Object.entries(bindings.skills ?? {})) {
    const resolved = fs.realpathSync.native(absolute(inputDir, skillPath));
    requireValue(fs.statSync(resolved).isFile(), `Skill não é arquivo: ${ref}`);
    bindings.skills[ref] = resolved;
  }
  for (const [ref, command] of Object.entries(bindings.commands ?? {})) argv(command, `Comando ${ref}`);
  for (const [ref, executor] of Object.entries(bindings.executors ?? {})) {
    requireValue(object(executor), `Executor inválido: ${ref}`);
    if (executor.command !== undefined) argv(executor.command, `Executor ${ref}`);
  }
  bindings.execution ??= {};
  bindings.execution.profile ??= 'compiled';
  requireValue(object(bindings.step_contexts), 'bindings.step_contexts obrigatório para cada etapa skill');
  const skillIDs = new Set(draft.workflow.steps.filter(s => s.type === 'skill').map(s => s.id));
  for (const id of Object.keys(bindings.step_contexts)) requireValue(skillIDs.has(id), 'step_contexts desconhecido: ' + id);
  for (const id of skillIDs) {
    const brief = bindings.step_contexts[id];
    requireValue(object(brief) && typeof brief.ticket_id === 'string' && brief.ticket_id.trim() &&
      typeof brief.objective === 'string' && brief.objective.trim(), id + ': ticket_id e objective obrigatórios');
    for (const name of ['scope', 'acceptance']) requireValue(Array.isArray(brief[name]) && brief[name].length &&
      brief[name].every(x => typeof x === 'string' && x.trim()), id + ': ' + name + ' obrigatório');
    for (const tier of ['required', 'initial', 'available']) {
      requireValue(brief[tier] === undefined || Array.isArray(brief[tier]), id + ': ' + tier + ' deve ser lista');
      for (const ref of brief[tier] ?? []) {
        requireValue(object(ref) && typeof ref.path === 'string' && ref.path.trim() &&
          !path.isAbsolute(ref.path), id + ': referência deve ser relativa ao projeto');
        const resolved = path.resolve(project, ref.path);
        const relative = path.relative(project, resolved);
        requireValue(relative && !relative.startsWith('..') && !path.isAbsolute(relative), id + ': referência fora do projeto');
        requireValue(!ref.path.replaceAll('\\', '/').split('/').some(x => x === '.git' || x === '.env' ||
          x.startsWith('.env.') || x.endsWith('.pem') || x.endsWith('.key')), id + ': referência de segredo proibida');
        if (fs.existsSync(resolved)) {
          const realRelative = path.relative(project, fs.realpathSync.native(resolved));
          requireValue(realRelative && !realRelative.startsWith('..') && !path.isAbsolute(realRelative), id + ': link fora do projeto');
          requireValue(fs.statSync(resolved).isFile(), id + ': referência não é arquivo');
        } else requireValue(tier !== 'required', id + ': referência required não existe');
        ref.path = relative.split(path.sep).join('/');
        requireValue((ref.start_line === undefined || Number.isInteger(ref.start_line) && ref.start_line >= 1) &&
          (ref.end_line === undefined || Number.isInteger(ref.end_line) && ref.end_line >= (ref.start_line ?? 1)),
          id + ': faixa de linhas inválida');
      }
    }
  }
  const ids = new Set(draft.workflow.steps.map(step => step.id));
  for (const step of draft.workflow.steps) {
    requireValue(!/^.+\/(orquestrador-fluxo-ia|planejador-de-lote)@v\d+$/.test(step.skill_ref ?? ''), 'O planejamento externo já terminou; não cadastre planejador/orquestrador no workflow de execução');
    for (const condition of [step.when, step.loop?.until].filter(Boolean)) {
      for (const side of [condition.left, condition.right]) {
        if (!side?.ref) continue;
        const ref = side.ref.match(/^step\.([a-z0-9_]+)\.status$/);
        if (ref) requireValue(ids.has(ref[1]), `Condição referencia etapa inexistente: ${side.ref}`);
        else requireValue(Object.hasOwn(bindings.values ?? {}, side.ref), `Referência não declarada em bindings.values: ${side.ref}`);
      }
    }
  }

  const target = path.resolve(manifest);
  requireValue(path.extname(target).toLowerCase() === '.md', 'O manifesto de saída deve terminar em .md');
  const base = path.basename(target, path.extname(target));
  const names = [path.basename(target), `${base}.workflow.yaml`, `${base}.bindings.yaml`];
  const outputDir = path.dirname(target);
  const targets = names.map(name => path.join(outputDir, name));
  for (const destination of targets) requireValue(!fs.existsSync(destination), `Arquivo existente preservado: ${destination}`);
  const header = ['---', 'contexto:', '  schema_version: 1', `  project_root: ${JSON.stringify(project)}`, `  workflow: ${JSON.stringify(names[1])}`, `  bindings: ${JSON.stringify(names[2])}`, '  status: ready', `  isolation: ${isolation}`, '---', '', `# ${draft.title.trim()}`, '', (draft.flow_profile === 'custom' ? '' : 'Fluxo enxuto: ao executar run, você autoriza implementação, checks, revisão corretiva e commits/branch locais previstos. Sem checkpoints humanos intermediários; testes de tela serão manuais ao final. Não autoriza push, PR nem merge em main/master.'), '', body.trim(), ''].join('\n');
  const contents = [header, `${yaml(draft.workflow)}\n`, `${yaml(bindings)}\n`];
  fs.mkdirSync(outputDir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputDir, '.contexto-packet-'));
  const published = [];
  try {
    names.forEach((name, i) => fs.writeFileSync(path.join(staging, name), contents[i], { flag: 'wx' }));
    const stagedManifest = path.join(staging, names[0]);
    validateWithCompiler(compiler, ['plan', 'validate', stagedManifest], 'valid');
    validateWithCompiler(compiler, ['run', stagedManifest, '--dry-run'], 'dry_run');
    // COPYFILE_EXCL also protects files created by another process after the precheck.
    targets.forEach((destination, i) => { fs.copyFileSync(path.join(staging, names[i]), destination, fs.constants.COPYFILE_EXCL); published.push(destination); });
    return { ready: true, project_root: project, manifest: targets[0], workflow: targets[1], bindings: targets[2], validations: ['plan validate', 'run --dry-run'] };
  } catch (error) {
    for (const file of published) fs.unlinkSync(file);
    throw error;
  } finally {
    for (const name of names) { const file = path.join(staging, name); if (fs.existsSync(file)) fs.unlinkSync(file); }
    fs.rmdirSync(staging);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const key = { '--input': 'input', '--manifest': 'manifest', '--contexto': 'compiler' }[process.argv[i]];
      requireValue(key && process.argv[i + 1] && !Object.hasOwn(options, key), 'Uso: node gerar-pacote-go.mjs --input pacote.json --manifest plano.md [--contexto EXECUTAVEL]');
      options[key] = process.argv[i + 1];
    }
    requireValue(options.input && options.manifest, '--input e --manifest são obrigatórios');
    console.log(JSON.stringify(generateBundle(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
