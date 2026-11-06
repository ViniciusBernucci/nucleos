import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildLeanFlow} from './fluxo-enxuto.mjs';
import {generateBundle} from './gerar-pacote-go.mjs';
import {deliver} from '../../_shared/scripts/entregar-lote-go.mjs';
const compiler=process.env.CONTEXTO_TEST_CLI;
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contexto-lean-'));
 t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('contexto-lean-'));fs.rmSync(root,{recursive:true,force:true});});
 const project=path.join(root,'project');fs.mkdirSync(project);
 git(project,'init','-q','-b','main');git(project,'config','user.name','Fixture');git(project,'config','user.email','fixture@example.invalid');git(project,'config','commit.gpgsign','false');
 fs.writeFileSync(path.join(project,'README.md'),'base\n');git(project,'add','.');git(project,'commit','-qm','base');
 const draft={
  schema_version:1,status:'ready',title:'Lean fixture',project_root:project,isolation:'worktree',body:'AC-1: proof implemented and reviewed.',
  workflow_ref:{id:'test/lean',version:1},local_git_authorized:true,delivery_branch:'revisao/fixture',
  implementation_executor:'claude/subscription',review_executor:'claude/subscription',
  units:[{id:'t1',ticket_id:'T1',risk_level:3,objective:'Implement proof',scope:['proof.txt'],acceptance:['AC-1'],checks:['test/unit']}],
  review_context:{ticket_id:'R',objective:'Correct material defects',scope:['proof.txt'],acceptance:['AC-1 reviewed'],instructions:'Compare com o SHA base registrado; executar os checks do catálogo.'},
  final_checks:['test/final'],manual_screen_tests:['Abrir tela e conferir resultado esperado'],
  bindings:{schema_version:1,skills:{'software/implementador-de-ticket@v1':path.join(root,'impl.md'),'software/revisor-de-codigo@v1':path.join(root,'review.md')},executors:{'claude/subscription':{provider:'claude',model:'claude-opus-5'}},commands:{
   'test/unit':[process.execPath,'-e',"if(!require('fs').readFileSync('proof.txt','utf8').startsWith('implemented'))process.exit(1)"],
   'test/final':[process.execPath,'-e',"if(require('fs').readFileSync('proof.txt','utf8')!=='implemented reviewed')process.exit(1)"],
  },values:{}}
 };
 fs.writeFileSync(path.join(root,'impl.md'),'# Implement proof');
 fs.writeFileSync(path.join(root,'review.md'),'# Review proof');
 return {root,project,draft};
}
test('DAG enxuto tem uma revisão e nenhum gate humano/QA/auditor',t=>{
 const {draft}=fixture(t); const b=structuredClone(draft.bindings);const flow=buildLeanFlow(draft,b);
 assert.deepEqual(flow.steps.map(x=>x.id),['t1_implement','t1_check_1','review_fix','integrated_check_1','local_delivery']);
 assert.ok(flow.steps.every((s,i)=>i===0||s.depends_on[0]===flow.steps[i-1].id));
 assert.equal(b.max_concurrency,1);assert.equal(b.values['flow.profile'],'enxuto-v1');
 assert.match(b.step_contexts.review_fix.instructions,/MODO=REVISAO_CORRETIVA_ENXUTA/);
 assert.equal(flow.steps.filter(s=>s.type==='skill').length,2);
});
test('autorização local, roteiro manual e limites de revisão são exigidos',t=>{
 const {draft}=fixture(t);
 const invalid=[
  [d=>delete d.local_git_authorized,/local_git_authorized/],
  [d=>d.manual_screen_tests=[],/cenários/],
  [d=>{d.review='skip-low-risk';d.review_skip_reason='ignore';},/R0/],
  [d=>d.units[0].worktree='other',/worktree/],
  [d=>d.units[0].depends_on=['future'],/posterior/],
  [d=>d.bindings.commands['test/unit']=['pnpm','exec','playwright','test'],/tela/],
 ];
 for(const [mutate,pattern] of invalid){const d=structuredClone(draft);mutate(d);assert.throws(()=>buildLeanFlow(d,d.bindings),pattern);}
 const d=structuredClone(draft);d.units[0].risk_level=0;d.review='skip-low-risk';d.review_skip_reason='Only documentation';d.manual_screen_tests=[];d.manual_screen_tests_na='Sem alteração de tela';
 const flow=buildLeanFlow(d,d.bindings);assert.ok(!flow.steps.some(s=>s.id==='review_fix'));
});
test('entrega recusa checkout principal e preserva branch/dados',t=>{
 const {project}=fixture(t);const before=git(project,'rev-parse','HEAD');
 assert.throws(()=>deliver({cwd:project,branch:'revisao/fixture',manualTests:{scenarios:['manual']}}),/isolada/);
 assert.equal(git(project,'rev-parse','HEAD'),before);
 assert.throws(()=>deliver({cwd:project,branch:'main',manualTests:{scenarios:['manual']}}),/revisao/);
});
test('entrega local é repetível e não sobrescreve branch existente',t=>{
 const {root,project}=fixture(t); const wt=path.join(root,'worktree');
 git(project,'worktree','add','-q','-b','contexto/test',wt,'HEAD');
 git(project,'branch','revisao/existing');
 fs.writeFileSync(path.join(wt,'proof.txt'),'new');
 assert.throws(()=>deliver({cwd:wt,branch:'revisao/existing',manualTests:{scenarios:['manual']}}),/já existe/);
 const first=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:['manual']}});
 const again=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:['manual']}});
 assert.equal(first.head,again.head);assert.equal(first.manual_screen_tests,'PENDING');
 assert.equal(git(project,'branch','--show-current'),'main');assert.equal(fs.existsSync(path.join(project,'proof.txt')),false);
 assert.match(fs.readFileSync(path.join(wt,first.checklist),'utf8'),/PENDENTE_DE_TESTES_MANUAIS/);
 const na=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:[],na:'Somente API'}});
 assert.equal(na.manual_screen_tests,'NOT_APPLICABLE');
 assert.match(fs.readFileSync(path.join(wt,na.checklist),'utf8'),/TESTES_DE_TELA_NAO_APLICAVEIS/);
});
test('pipeline real com executora falsa chega à branch local e não toca a raiz',{skip:!compiler},t=>{
 const {root,project,draft}=fixture(t);
 const fake=path.join(root,'fake.mjs');
 fs.writeFileSync(fake,`import fs from 'node:fs';
const prompt=fs.readFileSync(0,'utf8');const review=prompt.includes('Step: review_fix\\n');
fs.writeFileSync('proof.txt',review?'implemented reviewed':'implemented');
fs.writeFileSync(review?'review.md':'implementation.md',review?'reviewed':'implemented');
const result={status:'PASS',summary:'fixture',artifacts:[{path:review?'review.md':'implementation.md'}]};
console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:'fixture-session',structured_output:result,result:JSON.stringify(result),usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}}));
`);
 draft.bindings.executors['claude/subscription'].command=[process.execPath,fake];
 fs.writeFileSync(path.join(project,'unrelated.txt'),'preserved original');
 const input=path.join(root,'packet.json');fs.writeFileSync(input,JSON.stringify(draft));
 const generated=generateBundle({input,manifest:path.join(root,'plans','batch.md'),compiler});
 const env={...process.env,CONTEXTO_DATA_DIR:path.join(root,'state'),CONTEXTO_LOG_DIR:path.join(root,'logs')};
 const run=JSON.parse(execFileSync(compiler,['run',generated.manifest,'--yes','--quiet'],{encoding:'utf8',env,windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe']}));
 assert.equal(run.status,'DONE');assert.equal(run.steps.review_fix.status,'PASS');assert.equal(run.steps.local_delivery.status,'PASS');
 assert.equal(git(project,'branch','--show-current'),'main');assert.equal(fs.readFileSync(path.join(project,'unrelated.txt'),'utf8'),'preserved original');
 assert.equal(fs.existsSync(path.join(project,'proof.txt')),false);
 assert.equal(git(project,'show','revisao/fixture:proof.txt'),'implemented reviewed');
 const manual=git(project,'show','revisao/fixture:documentacoes/entregas-ia/testes-manuais.md');
 assert.match(manual,/PENDENTE_DE_TESTES_MANUAIS_DE_TELA/);
});
test('modelo, orçamento, referências e preparação são verificáveis',t=>{
 const {draft,project}=fixture(t);
 const b=structuredClone(draft); delete b.bindings.executors['claude/subscription'].model;
 assert.throws(()=>buildLeanFlow(b,b.bindings),/Modelo explícito/);
 const d=structuredClone(draft); d.units[0].limits={max_turns:250};
 assert.throws(()=>buildLeanFlow(d,d.bindings),/budget_reason/);
 d.units[0].budget_reason='Migração indivisível com contrato compartilhado';
 assert.equal(buildLeanFlow(d,d.bindings).steps[0].id,'t1_implement');
 const p=structuredClone(draft);p.preparation_checks=['test/prepare'];p.bindings.commands['test/prepare']=[process.execPath,'--version'];
 const flow=buildLeanFlow(p,p.bindings);
 assert.equal(flow.steps[0].id,'preparation_1');
 assert.equal(p.bindings.executors['claude/subscription'].autocompact_tokens,100000);
 assert.equal(p.bindings.execution.limits.max_context_tokens,160000);
 const q=structuredClone(draft);q.units[0].checks=['test/final'];
 assert.throws(()=>buildLeanFlow(q,q.bindings),/direcionados/);
 fs.writeFileSync(path.join(project,'large.md'),'example\n'.repeat(2000));
 const r=structuredClone(draft);r.units[0].required=[{path:'large.md'}];
 assert.throws(()=>buildLeanFlow(r,r.bindings),/8 KiB/);
 r.units[0].required[0]={path:'large.md',start_line:1,end_line:5};
 assert.ok(buildLeanFlow(r,r.bindings));
});
