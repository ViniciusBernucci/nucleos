import { fileURLToPath } from 'node:url';
function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function buildLeanFlow(draft, bindings) {
  requireValue(draft.local_git_authorized === true, 'Declare local_git_authorized:true na proposta; o usuário autoriza a execução ao chamar run');
  requireValue(draft.isolation !== 'none', 'Fluxo enxuto exige worktree isolada');
  requireValue(Array.isArray(draft.units) && draft.units.length > 0, 'Fluxo enxuto exige units com briefs e checks');
  requireValue(typeof draft.delivery_branch === 'string' && /^revisao\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(draft.delivery_branch), 'delivery_branch deve usar revisao/');
  requireValue(Array.isArray(draft.final_checks) && draft.final_checks.length, 'final_checks determinísticos obrigatórios');
  requireValue(Array.isArray(draft.manual_screen_tests), 'Declare manual_screen_tests');
  requireValue(draft.manual_screen_tests.every(x => typeof x === 'string' && x.trim()), 'Cenários manuais devem ser textos');
  requireValue(draft.manual_screen_tests.length || typeof draft.manual_screen_tests_na === 'string' && draft.manual_screen_tests_na.trim(), 'Informe cenários de tela ou justificativa NA');
  const impl = draft.implementation_executor;
  const reviewer = draft.review_executor ?? impl;
  const implRef = draft.implementation_skill ?? 'software/implementador-de-ticket@v1';
  const reviewRef = draft.review_skill ?? 'software/revisor-de-codigo@v1';
  requireValue(bindings.skills?.[implRef] && bindings.executors?.[impl], 'Cadastre skill/executor de implementação');
  const skip = draft.review === 'skip-low-risk';
  requireValue(draft.review === undefined || ['required','skip-low-risk'].includes(draft.review), 'review inválido');
  requireValue(!skip || typeof draft.review_skip_reason === 'string' && draft.review_skip_reason.trim() &&
    draft.units.every(u => u.risk_level === 0), 'Dispensa de review exige R0 explícito em todas as unidades e justificativa');
  requireValue(skip || bindings.skills?.[reviewRef] && bindings.executors?.[reviewer], 'Cadastre skill/executor da revisão corretiva');
  requireValue(bindings.max_concurrency === undefined || bindings.max_concurrency === 1, 'Fluxo enxuto padrão é sequencial numa worktree');
  bindings.max_concurrency = 1;
  bindings.commands ??= {};
  bindings.values ??= {};
  bindings.values['flow.profile'] = 'enxuto-v1';
  bindings.values['flow.screen_testing'] = 'manual_pending';
  bindings.step_contexts = {};
  const steps = [];
  const ids = new Set();
  let previous;
  const policy = '\nFLUXO_ENXUTO_V1: execute somente este papel. Sem orquestrador, auditor, QA de tela por IA ou novas sessões. Preserve limites/checkpoints e regras do projeto. Testes de tela serão manuais no final. Não execute commits/merges: a entrega Git é uma etapa determinística posterior.';
  function addCheck(ref, id) {
    requireValue(typeof ref === 'string' && Array.isArray(bindings.commands[ref]), 'Comando de check não cadastrado: ' + ref);
    const argv = bindings.commands[ref];
    requireValue(!/(?:playwright\s+test|cypress\s+run|selenium)/i.test(argv.join(' ')), 'Checks de tela ficam manuais neste perfil');
    steps.push({id, type:'command', ...(previous ? {depends_on:[previous]} : {}), command_ref:ref});
    previous = id;
  }
  for (const unit of draft.units) {
    requireValue(typeof unit.id === 'string' && /^[a-z][a-z0-9_]{0,30}$/.test(unit.id) && !ids.has(unit.id), 'ID de unidade inválido/duplicado');
    requireValue(!unit.worktree && !unit.branch, 'O perfil padrão usa uma worktree por lote; não declare worktrees extras sem workflow custom explícito');
    requireValue(Number.isInteger(unit.risk_level) && unit.risk_level >= 0 && unit.risk_level <= 4, 'risk_level numérico obrigatório');
    for (const dep of unit.depends_on ?? []) requireValue(ids.has(dep), 'Unidade depende de tarefa ausente ou posterior: ' + dep);
    ids.add(unit.id);
    requireValue(Array.isArray(unit.checks) && unit.checks.length, 'Cada unidade exige checks determinísticos');
    const id = unit.id + '_implement';
    const {ticket_id, objective, scope, acceptance, instructions = '', required = [], initial = [], available = [], limits} = unit;
    bindings.step_contexts[id] = {ticket_id, objective, scope, acceptance, instructions:instructions+policy, required, initial, available, ...(limits ? {limits} : {})};
    steps.push({id, type:'skill', skill_ref:implRef, executor_ref:impl, ...(previous ? {depends_on:[previous]} : {})});
    previous = id;
    unit.checks.forEach((ref,i) => addCheck(ref, unit.id+'_check_'+(i+1)));
  }
  if (!skip) {
    const brief = draft.review_context;
    requireValue(brief && typeof brief === 'object', 'review_context obrigatório: brief consolidado da revisão');
    requireValue(typeof brief.instructions === 'string' && brief.instructions.trim(), 'review_context.instructions deve informar base/diff, contratos e checks');
    const id = 'review_fix';
    bindings.step_contexts[id] = {...brief, instructions:'MODO=REVISAO_CORRETIVA_ENXUTA\nUma revisão independente consolidada. Procure somente problemas críticos/altos/médios fundamentados e corrija dentro do escopo. Um ciclo de correção e testes; sem auditor/review-loop/QA IA.\n'+brief.instructions+policy};
    steps.push({id,type:'skill',skill_ref:reviewRef,executor_ref:reviewer,depends_on:[previous]});
    previous = id;
  }
  draft.final_checks.forEach((ref,i) => addCheck(ref,'integrated_check_'+(i+1)));
  const deliveryRef = 'flow/local-delivery';
  requireValue(!Object.hasOwn(bindings.commands,deliveryRef), 'flow/local-delivery é reservado ao gerador');
  const script = fileURLToPath(new URL('../../_shared/scripts/entregar-lote-go.mjs', import.meta.url));
  bindings.commands[deliveryRef] = [process.execPath, script, '--branch', draft.delivery_branch, '--manual-tests-json', JSON.stringify({scenarios:draft.manual_screen_tests,na:draft.manual_screen_tests_na ?? ''})];
  steps.push({id:'local_delivery',type:'command',command_ref:deliveryRef,depends_on:[previous]});
  bindings.values['flow.review_policy'] = skip ? 'skip_r0: '+draft.review_skip_reason : 'one_corrective_review';
  const ref = draft.workflow_ref;
  requireValue(ref && typeof ref.id === 'string' && Number.isInteger(ref.version), 'workflow_ref {id,version} obrigatório');
  return {schema_version:1,workflow:{...ref,trigger:'manual'},steps};
}