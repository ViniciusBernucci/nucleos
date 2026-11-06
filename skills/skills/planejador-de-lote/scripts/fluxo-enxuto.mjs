import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
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
  bindings.execution ??= {};
  bindings.execution.effort ??= 'medium';
  bindings.execution.profile ??= 'compiled';
  const defaultBudget = {max_prompt_tokens:8000,max_context_tokens:160000,max_total_tokens:2000000,max_turns:40,max_tool_calls:80,timeout_seconds:1200,max_cost_usd:5,max_output_bytes:16777216};
  requireValue(!Object.entries(bindings.execution.limits??{}).some(([k,v])=>v>(defaultBudget[k]??Infinity)) ||
    typeof draft.budget_reason==='string'&&draft.budget_reason.trim(),
    'Aumento de orçamento global exige budget_reason');
  bindings.execution.limits = {max_prompt_tokens:8000,max_context_tokens:160000,
    max_total_tokens:2000000,max_turns:40,max_tool_calls:80,timeout_seconds:1200,
    ...bindings.execution.limits};
  for (const ref of new Set(skip ? [impl] : [impl,reviewer])) {
    const ex = bindings.executors[ref];
    requireValue(typeof ex.model === 'string' && ex.model.trim() && !/^[ -]|[\r\n]/.test(ex.model),
      'Modelo explícito obrigatório no executor: '+ref);
    if (ex.provider === 'claude') ex.autocompact_tokens ??= 100000;
  }
  const preparations = draft.preparation_checks ?? [];
  requireValue(Array.isArray(preparations), 'preparation_checks deve ser lista');
  function validateBrief(brief) {
    const limits = brief.limits ?? {};
    const raised = Object.entries(limits).some(([key,v]) => v > (bindings.execution.limits[key] ?? (key==='max_cost_usd'?5:Infinity)));
    requireValue(!raised || typeof brief.budget_reason === 'string' && brief.budget_reason.trim(),
      'Aumento de orçamento exige budget_reason; prefira decompor por comportamento');
    for (const ref of [...(brief.required??[]),...(brief.initial??[])]) {
      requireValue(!/(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|uv\.lock)$/.test(ref.path), 'Lockfiles ficam em available');
      const file = path.resolve(draft.project_root,ref.path);
      if (fs.existsSync(file) && fs.statSync(file).size > 8192)
        requireValue(ref.start_line > 0 && ref.end_line >= ref.start_line || typeof brief.large_reference_reason === 'string' && brief.large_reference_reason.trim(),
          'Referência acima de 8 KiB exige intervalo de linhas ou large_reference_reason: '+ref.path);
    }
  }
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
  preparations.forEach((ref,i) => addCheck(ref,'preparation_'+(i+1)));
  for (const unit of draft.units) {
    requireValue(typeof unit.id === 'string' && /^[a-z][a-z0-9_]{0,30}$/.test(unit.id) && !ids.has(unit.id), 'ID de unidade inválido/duplicado');
    requireValue(!unit.worktree && !unit.branch, 'O perfil padrão usa uma worktree por lote; não declare worktrees extras sem workflow custom explícito');
    requireValue(Number.isInteger(unit.risk_level) && unit.risk_level >= 0 && unit.risk_level <= 4, 'risk_level numérico obrigatório');
    for (const dep of unit.depends_on ?? []) requireValue(ids.has(dep), 'Unidade depende de tarefa ausente ou posterior: ' + dep);
    ids.add(unit.id);
    requireValue(Array.isArray(unit.checks) && unit.checks.length, 'Cada unidade exige checks determinísticos');
    validateBrief(unit);
    requireValue(unit.checks.every(ref => !preparations.includes(ref) && !draft.final_checks.includes(ref)),
      'Checks de unidade devem ser direcionados; preparação e globais executam uma vez');
    const id = unit.id + '_implement';
    const {ticket_id, objective, scope, acceptance, instructions = '', required = [], initial = [], available = [], limits} = unit;
    bindings.step_contexts[id] = {ticket_id, objective, scope, acceptance, instructions:instructions+policy+(unit.budget_reason?'\nOrçamento justificado: '+unit.budget_reason:''), required, initial, available, ...(limits ? {limits} : {})};
    steps.push({id, type:'skill', skill_ref:implRef, executor_ref:impl, ...(previous ? {depends_on:[previous]} : {})});
    previous = id;
    unit.checks.forEach((ref,i) => addCheck(ref, unit.id+'_check_'+(i+1)));
  }
  if (!skip) {
    const brief = draft.review_context;
    requireValue(brief && typeof brief === 'object', 'review_context obrigatório: brief consolidado da revisão');
    requireValue(typeof brief.instructions === 'string' && brief.instructions.trim(), 'review_context.instructions deve informar base/diff, contratos e checks');
    validateBrief(brief);
    const id = 'review_fix';
    const {budget_reason,large_reference_reason,...briefContext}=brief;
    bindings.step_contexts[id] = {...briefContext, instructions:'MODO=REVISAO_CORRETIVA_ENXUTA\nUma revisão independente consolidada. Procure somente problemas críticos/altos/médios fundamentados e corrija dentro do escopo. Um ciclo de correção e testes; sem auditor/review-loop/QA IA.\n'+brief.instructions+policy+(budget_reason?'\nOrçamento justificado: '+budget_reason:'')};
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