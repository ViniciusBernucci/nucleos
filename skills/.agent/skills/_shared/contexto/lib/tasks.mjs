import { dataFile, dataFolder, dataSource } from './layout.mjs';
import fs from 'node:fs';
import { riskPolicy, requiresQA } from './risk.mjs';
import { validateChecks, validateFindings } from './validation.mjs';
import { gitSnapshot, gitAvailable } from './git-snapshot.mjs';
import { git, discover } from './worktrees.mjs';
import path from 'node:path';
import { atomicWrite, id, now, safePath, sanitize, sanitizeValues, secretPath, sha256 } from './safety.mjs';

const critical = new Set(['auth', 'authorization', 'data', 'migration', 'secrets', 'cross-layer-contract', 'concurrency', 'shared-infra']);
const standard = new Set(['business', 'api', 'dependency', 'functional']);
const profiles = ['simples', 'padrao', 'critico'];
const gateNames = ['implementation', 'review', 'audit', 'qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup'];
function strings(values, field, { empty = false } = {}) {
  if (!Array.isArray(values) || (!empty && !values.length) || values.length > 100 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 2000)) throw Error(`Campo inválido: ${field}`);
  return [...new Set(values)];
}
export function getTask(store, task) {
  const row = store.db.prepare('SELECT body FROM tasks WHERE id=?').get(id(task));
  if (!row) throw Error('Tarefa não encontrada');
  return JSON.parse(row.body);
}
export function putTask(store, input) {
  id(input.id);
  if (!profiles.includes(input.profile)) throw Error('Perfil inválido');
  if (store.db.prepare('SELECT id FROM tasks WHERE id=?').get(input.id)) throw Error('Tarefa já existe; use eventos para atualização');
  const factors = strings(input.risk_factors || [], 'risk_factors', { empty: true });
  const policy = riskPolicy({ ...input, risk_factors: factors });
  const minimum = factors.some(factor => critical.has(factor)) ? 2 : factors.some(factor => standard.has(factor)) ? 1 : 0;
  if (profiles.indexOf(input.profile) < minimum) throw Error(`Risco exige perfil ${profiles[minimum]}`);
  if (typeof input.rationale !== 'string' || input.rationale.trim().length < 10 || input.rationale.length > 4000) throw Error('Justificativa de risco obrigatória (10 a 4000 caracteres)');
  const externalSources = input.external_sources || [];
  if (!Array.isArray(externalSources) || externalSources.length > 50) throw Error('external_sources inválido');
  for (const ref of externalSources) externalReference(ref, store.config.maxFileBytes);
  const sources = strings(input.sources || [], 'sources', { empty: externalSources.length > 0 });
  for (const relative of sources) { if (secretPath(relative)) throw Error('Fonte sensível proibida'); safePath(store.root, relative); }
  const dependencies = strings(input.dependencies || [], 'dependencies', { empty: true });
  for (const dependency of dependencies) { id(dependency); if (dependency === input.id) throw Error('Dependência cíclica'); getTask(store, dependency); }
  const mode = input.snapshot_mode || (gitAvailable(store.root) ? 'git' : 'sources');
  if (!['git', 'sources'].includes(mode)) throw Error('snapshot_mode inválido');
  if (gitAvailable(store.root) && mode !== 'git') throw Error('Repositórios Git exigem snapshot completo; fontes declaradas não bastam');
  const base = mode === 'git' ? (input.base_sha || git(store.root, ['rev-parse', 'HEAD'])) : null;
  if (base && !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(base)) throw Error('base_sha completo obrigatório');
  const task = { snapshot_mode: mode, base_sha: base, branch: mode === 'git' ? discover(store.root).branch : null, external_sources: externalSources, spec: input.spec || sources[0] || `${externalSources[0].root}/${externalSources[0].source}`, ticket: input.ticket || input.id, batch: input.batch || null, id: input.id, revision: 0, profile: input.profile, rationale: sanitize(input.rationale), risk_factors: factors, criteria: strings(input.criteria, 'criteria').map(sanitize), sources, dependencies, gates: {}, technical_rounds: 0, qa_rounds: 0, isolated: null, updated: now() };
  Object.assign(task, policy);
  store.db.prepare('INSERT INTO tasks VALUES(?,?,?)').run(task.id, 0, JSON.stringify(task));
  return task;
}
export function externalReference(ref, limit = 512000) {
  if (!ref || typeof ref.root !== 'string' || !path.isAbsolute(ref.root) || fs.realpathSync.native(ref.root) !== path.resolve(ref.root) || secretPath(ref.source || '')) throw Error('Referência externa exige raiz real declarada e caminho não sensível');
  const file = safePath(ref.root, ref.source);
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > limit) throw Error('Referência externa inválida/acima do limite');
  return { root: ref.root, source: ref.source, hash: sha256(fs.readFileSync(file)) };
}
export function snapshot(store, task) {
  const files = [];
  const taskDefinition = typeof task === 'string' ? getTask(store, task) : task;
  const external = (taskDefinition.external_sources || []).map(ref => externalReference(ref, store.config.maxFileBytes));
  if (taskDefinition.snapshot_mode === 'git') return sha256(JSON.stringify({ code: gitSnapshot(store, taskDefinition).hash, external }));
  for (const relative of [...taskDefinition.sources].sort()) {
    if (secretPath(relative)) throw Error('Fonte sensível proibida');
    const file = safePath(store.root, relative);
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > store.config.maxFileBytes) throw Error('Snapshot requer arquivos regulares dentro do limite');
    files.push([relative, sha256(fs.readFileSync(file))]);
  }
  return sha256(JSON.stringify({ files, external }));
}
function evidence(store, values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 100) throw Error('Evidência local obrigatória');
  return values.map(item => {
    if (!item || typeof item.source !== 'string' || typeof item.detail !== 'string' || !item.detail.trim()) throw Error('Evidência requer source e detail');
    if (secretPath(item.source)) throw Error('Evidência sensível proibida');
    const file = safePath(store.root, item.source);
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 2000000) throw Error('Arquivo de evidência inválido');
    return { source: item.source, detail: sanitize(item.detail).slice(0, 4000), hash: sha256(fs.readFileSync(file)) };
  });
}
export function currentGate(task, name, current) { return task.gates[name]?.snapshot === current ? task.gates[name] : null; }
function completeCoverage(task, gate) { return Array.isArray(gate?.coverage) && task.criteria.every(criterion => gate.coverage.includes(criterion)); }
function consolidatedReview(task, review, audit) {
  if (!review || !completeCoverage(task, review) || !['PASS', 'FAIL'].includes(review.status)) return false;
  if (review.status === 'PASS' && review.findings === 0) return true;
  return review.findings > 0 && audit?.status === 'PASS' && Array.isArray(review.finding_ids) && review.finding_ids.length === review.findings && Array.isArray(audit.decisions) && audit.decisions.length === review.findings && review.finding_ids.every(finding => audit.decisions.some(decision => decision.id === finding && (decision.decision !== 'APLICAR' || decision.verified === true)));
}
export function evidenceValid(store, gate) {
  try { return gate.evidence.every(item => sha256(fs.readFileSync(safePath(store.root, item.source))) === item.hash); }
  catch { return false; }
}
export function readiness(store, task) {
  const current = snapshot(store, task);
  const missing = [];
  const gates = Object.fromEntries(gateNames.map(name => {
    const gate = currentGate(task, name, current);
    return [name, gate && evidenceValid(store, gate) ? gate : null];
  }));
  if (task.correction_plan) missing.push('corrections');
  if (gates.implementation?.status !== 'PASS') missing.push('implementation');
  if (!consolidatedReview(task, gates.review, gates.audit)) missing.push('review');
  const noFindings = gates.review?.status === 'PASS' && gates.review.findings === 0;
  if (task.profile === 'critico' || !noFindings) {
    if (gates.audit?.status !== 'PASS') missing.push('audit');
  } else if (!['PASS', 'NA_SEM_ACHADOS'].includes(gates.audit?.status)) missing.push('audit');
  if (gates.qa?.status !== 'PASS' && !(!requiresQA(task) && gates.qa?.status === 'COBERTO_NO_REVIEW')) missing.push('qa');
  for (const dependency of task.dependencies) if (!readiness(store, getTask(store, dependency)).ready) missing.push(`dependency:${dependency}`);
  return { id: task.id, revision: task.revision, profile: task.profile, snapshot: current, ready: !task.isolated && missing.length === 0, missing, isolated: task.isolated, technical_rounds: task.technical_rounds, qa_rounds: task.qa_rounds, gates: Object.fromEntries(gateNames.map(name => [name, gates[name]?.status || (task.gates[name] ? 'STALE' : 'PENDING')])) };
}
export function event(store, input) {
  if (!input || typeof input !== 'object') throw Error('Evento inválido');
  id(input.id); id(input.task); id(input.session);
  const clean = sanitizeValues(input);
  return store.transaction(() => {
    const previous = store.db.prepare('SELECT body FROM events WHERE id=?').get(clean.id);
    if (previous) {
      if (previous.body !== JSON.stringify(clean)) throw Error('ID idempotente reutilizado com conteúdo diferente');
      return { duplicate: true, task: getTask(store, clean.task) };
    }
    const task = getTask(store, clean.task);
    if (clean.expected_revision !== task.revision) throw Error(`Conflito de revisão: atual ${task.revision}`);
    if (clean.type === 'isolate') {
      if (typeof clean.reason !== 'string' || !clean.reason.trim()) throw Error('Motivo obrigatório');
      task.isolated = clean.reason.slice(0, 4000);
    } else if (clean.type === 'round') {
      if (!['technical', 'qa'].includes(clean.kind)) throw Error('Tipo de rodada inválido');
      const key = `${clean.kind}_rounds`;
      if (task[key] >= 3 && !task.round_ids?.[clean.kind]?.includes(clean.round_id || clean.id)) throw Error('Limite de três rodadas; isole a tarefa');
      const roundId = id(clean.round_id || clean.id);
      task.round_ids ||= { technical: [], qa: [] };
      if (!task.round_ids[clean.kind].includes(roundId)) {
        task[key]++; task.round_ids[clean.kind].push(roundId);
        task.active_round = { id: roundId, kind: clean.kind, plan_id: task.correction_plan?.round_id || task.qa_failure?.event_id || null };
      }
    } else if (clean.type === 'require_qa') {
      if (typeof clean.reason !== 'string' || clean.reason.trim().length < 10) throw Error('Justificativa de QA condicional obrigatória');
      task.qa_required = true; task.qa_reason = clean.reason;
      if (task.policy_version !== 2) task.profile = 'critico';
      for (const key of ['qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
    } else if (clean.type === 'elevate') {
      if (!profiles.includes(clean.profile) || profiles.indexOf(clean.profile) <= profiles.indexOf(task.profile)) throw Error('Somente elevação de perfil permitida');
      task.profile = clean.profile;
      if (task.profile === 'critico') { task.risk_level = 'R3'; task.qa_required = true; }
      task.gates = {};
    } else if (clean.type === 'audit_decision') {
      const current = snapshot(store, task), review = currentGate(task, 'review', current);
      const implementation = currentGate(task, 'implementation', current);
      if (clean.snapshot !== current || !review || !implementation || !evidenceValid(store, review) || !evidenceValid(store, implementation)) throw Error('Review/implementação atual e evidências obrigatórios');
      if (clean.session === implementation.session || clean.session === review.session) throw Error('Auditor deve ser independente');
      if (!completeCoverage(task, review)) throw Error('Review com cobertura essencial incompleta');
      const decisions = clean.decisions;
      if (!Array.isArray(decisions) || decisions.length !== review.findings || new Set(decisions.map(d => d.id)).size !== review.findings || decisions.some(d => !review.finding_ids?.includes(d.id) || !['APLICAR', 'ADIAR', 'REJEITAR'].includes(d.decision) || typeof d.reason !== 'string' || !d.reason.trim())) throw Error('Decisão única e fundamentada para todos os achados é obrigatória');
      if (decisions.some(d => d.blocking === true && d.decision !== 'APLICAR')) throw Error('Achado bloqueante confirmado não pode ser adiado/rejeitado');
      const proof = evidence(store, clean.evidence);
      task.correction_plan = decisions.some(d => d.decision === 'APLICAR') ? { origin_snapshot: current, origin_review: structuredClone(review), decisions, session: clean.session, evidence: proof, round_id: clean.id, rounds_at_decision: task.technical_rounds, code_changed: false } : null;
      task.gates.audit = { status: decisions.some(d => d.decision === 'APLICAR') ? 'CORRECOES_NECESSARIAS' : 'PASS', snapshot: current, session: clean.session, evidence: proof, decisions, at: now() };
      for (const key of ['qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
    } else if (clean.type === 'revalidate') {
      const current = snapshot(store, task), plan = task.correction_plan;
      const implementation = currentGate(task, 'implementation', current);
      if (plan && current === plan.origin_snapshot) throw Error('Revalidação exige alteração de código após a decisão; snapshot de origem inalterado');
      if (clean.snapshot !== current || !plan || !implementation || !evidenceValid(store, implementation) || !evidenceValid(store, plan) || !evidenceValid(store, plan.origin_review)) throw Error('Correção sem implementação/plano/evidência válida');
      if ([implementation.session, plan.session].includes(clean.session)) throw Error('Revalidação exige revisor independente');
      const applied = plan.decisions.filter(d => d.decision === 'APLICAR').map(d => d.id);
      if (!applied.length || !Array.isArray(clean.results) || clean.results.length !== applied.length || new Set(clean.results.map(r => r.id)).size !== applied.length || clean.results.some(r => !applied.includes(r.id) || r.status !== 'VERIFICADO')) throw Error('Revalidação requer exatamente os IDs APLICAR verificados; novos achados exigem review/auditoria');
      if (task.technical_rounds !== plan.rounds_at_decision + 1 || task.active_round?.kind !== 'technical' || task.active_round?.plan_id !== plan.round_id) throw Error('Registre uma nova rodada técnica vinculada a esta decisão antes da correção');
      if (!completeCoverage(task, clean) || clean.impact_checked !== true) throw Error('Revalidação deve cobrir critérios e raio de impacto; declarar lacunas bloqueia');
      if (task.snapshot_mode === 'git') gitSnapshot(store, task, { approve: true });
      const proof = evidence(store, clean.evidence);
      task.gates.review = { ...plan.origin_review, status: 'PASS', findings: 0, finding_ids: [], finding_details: [], session: clean.session, snapshot: current, evidence: proof, mode: 'focal', origin_snapshot: plan.origin_snapshot, origin_head_sha: plan.origin_review.head_sha, head_sha: task.snapshot_mode === 'git' ? git(store.root, ['rev-parse', 'HEAD']) : null, results: clean.results, at: now() };
      // Preserve the auditor's original decision, never fabricate a new auditor
      // approving changed code. Independent verification proves the correction.
      task.gates.audit = { status: 'PASS', session: plan.session, snapshot: current, evidence: [...plan.evidence, ...proof], decisions: plan.decisions, original_snapshot: plan.origin_snapshot, revalidated_by: clean.session, at: now() };
      task.correction_plan = null;
      for (const key of ['qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
    } else if (clean.type === 'gate') {
      if (!gateNames.includes(clean.gate)) throw Error('Gate inválido');
      const current = snapshot(store, task);
      if (task.snapshot_mode === 'git' && ['PASS', 'NA_SEM_ACHADOS', 'COBERTO_NO_REVIEW'].includes(clean.status)) gitSnapshot(store, task, { approve: true });
      if (clean.snapshot !== current) throw Error('Snapshot obsoleto');
      if (!['PASS', 'FAIL', 'BLOCKED', 'NA_SEM_ACHADOS', 'COBERTO_NO_REVIEW'].includes(clean.status)) throw Error('Status inválido');
      if (clean.gate === 'implementation' && clean.status === 'PASS') {
        const plan = task.correction_plan;
        if (plan && (task.technical_rounds !== plan.rounds_at_decision + 1 || task.active_round?.plan_id !== plan.round_id)) throw Error('Correção exige nova rodada vinculada à decisão do auditor');
        if (task.qa_failure && (task.qa_rounds !== task.qa_failure.rounds_at_failure + 1 || task.active_round?.kind !== 'qa' || task.active_round?.plan_id !== task.qa_failure.event_id)) throw Error('Correção de QA exige nova rodada QA vinculada à falha');
      }
      if (clean.gate === 'review' && clean.status === 'PASS' && task.correction_plan) throw Error('Plano APLICAR pendente exige revalidate com IDs; review PASS não pode apagá-lo');
      const implementation = currentGate(task, 'implementation', current);
      const review = currentGate(task, 'review', current);
      const audit = currentGate(task, 'audit', current);
      if (clean.gate !== 'implementation' && (!implementation || implementation.status !== 'PASS' || !evidenceValid(store, implementation))) throw Error('Implementação atual válida ausente');
      if (['review', 'audit', 'qa'].includes(clean.gate) && clean.session === implementation?.session) throw Error('Gate requer executor independente da implementação');
      if (clean.gate === 'audit' && clean.session === review?.session && clean.status !== 'NA_SEM_ACHADOS') throw Error('Auditor deve ser independente do revisor');
      if (clean.gate === 'audit' && !review) throw Error('Review atual ausente');
      if (clean.gate === 'qa' && clean.status !== 'COBERTO_NO_REVIEW' && (clean.session === review?.session || (audit?.status !== 'NA_SEM_ACHADOS' && clean.session === audit?.session))) throw Error('QA separado requer sessão independente do review e auditoria');
      if (clean.status === 'NA_SEM_ACHADOS' && !['audit', 'integration_audit'].includes(clean.gate)) throw Error('NA somente em auditoria');
      if (clean.status === 'NA_SEM_ACHADOS' && clean.gate === 'audit' && (task.profile === 'critico' || review?.status !== 'PASS' || review.findings !== 0)) throw Error('Auditoria não pode ser dispensada');
      if (clean.status === 'COBERTO_NO_REVIEW' && !['qa', 'integration_qa'].includes(clean.gate)) throw Error('Cobertura somente em QA');
      if (clean.status === 'COBERTO_NO_REVIEW' && clean.gate === 'qa' && (requiresQA(task) || !consolidatedReview(task, review, audit) || clean.session !== review.session)) throw Error('QA só pode ser coberto pelo review independente em simples legado ou R0–R2 sem QA condicional');
      if (clean.status === 'COBERTO_NO_REVIEW' && (task.policy_version === 2 || clean.gate === 'integration_qa')) validateChecks(clean.checks);
      if (clean.gate === 'review') {
        if (task.policy_version === 2 && clean.findings > 0 && clean.finding_details === undefined) throw Error('Review R0–R4 requer finding_details estruturados por ID');
        validateFindings(clean);
        if (!Number.isInteger(clean.findings) || clean.findings < 0 || clean.findings > 1000) throw Error('Review requer número de achados');
        if (clean.findings > 0 && (!Array.isArray(clean.finding_ids) || clean.finding_ids.length !== clean.findings || new Set(clean.finding_ids).size !== clean.findings || clean.finding_ids.some(finding => typeof finding !== 'string' || !finding.trim() || finding.length > 200))) throw Error('Review requer IDs únicos de todos os achados');
        if (clean.status === 'PASS' && !completeCoverage(task, clean)) throw Error('Review PASS requer cobertura de todos os critérios');
      }
      if (clean.gate === 'qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(clean.status) && !completeCoverage(task, clean)) throw Error('QA requer cobertura de todos os critérios');
      if (clean.gate === 'audit' && clean.status === 'PASS') {
        if (clean.decisions?.some(d => d.decision === 'APLICAR')) throw Error('APLICAR deve usar audit_decision e revalidate independente');
        if (!['PASS', 'FAIL'].includes(review.status) || !completeCoverage(task, review) || !evidenceValid(store, review)) throw Error('Review com cobertura essencial incompleta ou obsoleta');
        if (review.status === 'FAIL' && review.findings === 0) throw Error('Review FAIL sem achados permanece bloqueado; auditoria não pode inventar liberação');
        if (clean.decisions?.some(d => d.blocking === true && d.decision !== 'APLICAR')) throw Error('Achado bloqueante confirmado não pode ser adiado/rejeitado');
        if (clean.decisions?.some(d => typeof d.reason !== 'string' || !d.reason.trim())) throw Error('Motivo fundamentado obrigatório para cada decisão');
        if (!Array.isArray(clean.decisions) || clean.decisions.length !== review.findings || new Set(clean.decisions.map(decision => decision.id)).size !== review.findings || clean.decisions.some(decision => !review.finding_ids?.includes(decision.id) || !['APLICAR', 'ADIAR', 'REJEITAR'].includes(decision.decision) || (decision.decision === 'APLICAR' && decision.verified !== true))) throw Error('Auditoria requer decisão única por achado e correções verificadas');
      }
      if (clean.gate === 'qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(clean.status)) {
        const currentReview = review && evidenceValid(store, review) ? review : null;
        const currentAudit = audit && evidenceValid(store, audit) ? audit : null;
        if (!consolidatedReview(task, currentReview, currentAudit)) throw Error('Review/auditoria essenciais ainda não liberados');
        if ((task.profile === 'critico' || currentReview.findings > 0) && currentAudit?.status !== 'PASS') throw Error('Auditoria essencial pendente');
      }
      if (['integration', 'cleanup'].includes(clean.gate) && clean.status === 'PASS' && !readiness(store, task).ready) throw Error('Gates da tarefa/dependências pendentes');
      if (clean.gate.startsWith('integration_')) {
        if (!readiness(store, task).ready || currentGate(task, 'integration', current)?.status !== 'PASS') throw Error('Integração/testes combinados pendentes');
        if (['integration_review', 'integration_qa', 'integration_audit'].includes(clean.gate) && clean.session === implementation.session) throw Error('Gate integrado exige executor independente');
        const ir = currentGate(task, 'integration_review', current), ia = currentGate(task, 'integration_audit', current);
        if (clean.gate === 'integration_review' && clean.status === 'PASS' && (clean.findings !== 0 || !completeCoverage(task, clean))) throw Error('Review integrado PASS exige zero novos achados e cobertura');
        if (clean.gate === 'integration_audit') {
          if (!ir || !evidenceValid(store, ir) || clean.session === ir.session) throw Error('Auditoria integrada requer review e auditor independente');
          if (clean.status === 'NA_SEM_ACHADOS' && (task.profile === 'critico' || ir.findings !== 0)) throw Error('Auditoria integrada crítica não pode ser dispensada');
        }
        if (clean.gate === 'integration_qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(clean.status)) {
          if (!ir || ir.status !== 'PASS' || !evidenceValid(store, ir) || !ia || !['PASS', 'NA_SEM_ACHADOS'].includes(ia.status) || !evidenceValid(store, ia)) throw Error('Review/auditoria integrada pendente');
          if (clean.status === 'COBERTO_NO_REVIEW') {
            if (requiresQA(task) || clean.session !== ir.session) throw Error('Cobertura integrada exige R0–R2 e sessão do review independente');
          } else if ([ir.session, ...(ia.status === 'PASS' ? [ia.session] : [])].includes(clean.session)) throw Error('QA integrado exige sessão independente');
          if (!completeCoverage(task, clean)) throw Error('QA integrado requer cobertura de critérios');
        }
      }
      if (clean.gate === 'cleanup' && clean.status === 'PASS') {
        for (const name of ['integration', 'integration_review', 'integration_audit', 'integration_qa']) {
          const prior = currentGate(task, name, current);
          if (!prior || !['PASS', 'NA_SEM_ACHADOS', ...(name === 'integration_qa' && !requiresQA(task) ? ['COBERTO_NO_REVIEW'] : [])].includes(prior.status) || !evidenceValid(store, prior)) throw Error('Validação integrada pendente');
        }
      }
      const gate = { status: clean.status, session: clean.session, snapshot: current, evidence: evidence(store, clean.evidence), at: now() };
      if (task.snapshot_mode === 'git') { gate.head_sha = git(store.root, ['rev-parse', 'HEAD']); gate.base_sha = task.base_sha; }
      for (const key of ['coverage', 'findings', 'finding_ids', 'finding_details', 'checks', 'decisions', 'mode', 'origin_report', 'bug_ids', 'observed_scenarios']) if (clean[key] !== undefined) gate[key] = clean[key];
      task.gates[clean.gate] = gate;
      if (clean.gate === 'qa' && clean.status === 'FAIL') task.qa_failure = { event_id: clean.id, rounds_at_failure: task.qa_rounds, origin_gate: structuredClone(gate) };
      if (clean.gate === 'qa' && ['PASS', 'COBERTO_NO_REVIEW'].includes(clean.status)) task.qa_failure = null;
      // Alterar o parecer invalida decisões derivadas, mesmo sem alteração no código.
      if (clean.gate === 'implementation') for (const key of gateNames.slice(1)) delete task.gates[key];
      if (clean.gate === 'review') for (const key of ['audit', 'qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
      if (clean.gate === 'audit') for (const key of ['qa', 'integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
      if (clean.gate === 'qa') for (const key of ['integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup']) delete task.gates[key];
      const integratedOrder = ['integration', 'integration_review', 'integration_audit', 'integration_qa', 'cleanup'];
      if (integratedOrder.includes(clean.gate)) for (const key of integratedOrder.slice(integratedOrder.indexOf(clean.gate) + 1)) delete task.gates[key];
    } else throw Error('Tipo de evento inválido');
    task.revision++; task.updated = now();
    store.db.prepare('UPDATE tasks SET revision=?,body=? WHERE id=?').run(task.revision, JSON.stringify(task), task.id);
    store.db.prepare('INSERT INTO events VALUES(?,?,?)').run(clean.id, task.id, JSON.stringify(clean));
    return { duplicate: false, task };
  });
}
export function status(store, task) {
  const tasks = task ? [getTask(store, task)] : store.db.prepare('SELECT body FROM tasks ORDER BY id').all().map(row => JSON.parse(row.body));
  return tasks.map(item => readiness(store, item));
}
export function render(store) {
  const states = status(store);
  const lines = ['# Estado local do fluxo', '', 'Projeção gerada; SQLite é a fonte operacional. READY significa pronta para integrar, não entrega final.', '', '| Tarefa | Perfil | Revisão | Pronta | Pendências |', '| --- | --- | --- | --- | --- |'];
  for (const item of states) lines.push(`| ${item.id} | ${item.profile} | ${item.revision} | ${item.ready ? 'sim' : 'não'} | ${item.missing.join(', ')} |`);
  const file = path.join(store.folder, 'generated', 'status.md');
  dataFile(store.root, 'generated/status.md', { existing: false });
  atomicWrite(file, lines.join('\n') + '\n');
  return { output: dataSource(store.root, 'generated/status.md'), tasks: states.length };
}
