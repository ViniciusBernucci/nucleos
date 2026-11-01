#!/usr/bin/env node
// Finaliza somente a worktree isolada do runtime; nunca faz push ou merge em main.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
function git(cwd,args) {
  return execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
}
export function deliver({cwd=process.cwd(),branch,manualTests}) {
  if (!/^revisao\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch ?? '')) throw Error('Branch de entrega deve usar revisao/');
  git(cwd,['check-ref-format','--branch',branch]);
  const root=git(cwd,['rev-parse','--show-toplevel']);
  if(fs.realpathSync.native(root)!==fs.realpathSync.native(cwd)) throw Error('Execute na raiz da worktree');
  const current=git(cwd,['branch','--show-current']);
  if(!current.startsWith('contexto/') && current!==branch) throw Error('Entrega exige branch isolada contexto/ ou a mesma revisao/');
  const gitdir=git(cwd,['rev-parse','--absolute-git-dir']);
  if(!path.basename(path.dirname(gitdir)).includes('worktrees')) throw Error('Checkout principal não pode ser finalizado por este helper');
  if(git(cwd,['diff','--name-only','--diff-filter=U'])) throw Error('Conflitos pendentes; não é permitido registrar entrega');
  for(const name of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD']) if(fs.existsSync(path.join(gitdir,name))) throw Error('Operação Git incompleta: '+name);
  if(!Array.isArray(manualTests?.scenarios) || !manualTests.scenarios.every(x=>typeof x==='string'&&x.trim()) ||
     !manualTests.scenarios.length && !manualTests.na?.trim()) throw Error('Roteiro manual ou justificativa NA obrigatório');
  if(current!==branch) {
    try {git(cwd,['show-ref','--verify','--quiet','refs/heads/'+branch]);throw Error('Branch de entrega já existe; não sobrescrever');}
    catch(error) {if(error.status!==1)throw error;}
  }
  const pending=git(cwd,['diff','--cached','--name-only','-z'])+'\0'+git(cwd,['ls-files','--others','--exclude-standard','-z'])+'\0'+git(cwd,['diff','--name-only','-z']);
  if(pending.split('\0').some(p=>/(^|\/)(\.env(?!\.example$)|[^/]+\.(pem|key)$)/i.test(p))) throw Error('Arquivo potencialmente secreto na entrega; não criar commit');
  const output=path.join(cwd,'documentacoes','entregas-ia','testes-manuais.md');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const text=['# Entrega técnica e testes manuais','',manualTests.scenarios.length ? 'Estado: PENDENTE_DE_TESTES_MANUAIS_DE_TELA.' : 'Estado: TESTES_DE_TELA_NAO_APLICAVEIS.',
    'A execução automática não declara validação visual nem aceite humano.','',
    'Branch local: '+branch,'','## Roteiro',...manualTests.scenarios.map((s,i)=>(i+1)+'. [ ] '+s),
    ...(manualTests.scenarios.length?[]:['Não aplicável: '+manualTests.na]),''].join('\n');
  fs.writeFileSync(output,text);
  git(cwd,['add','--all']);
  if(git(cwd,['diff','--cached','--name-only'])) git(cwd,['commit','-m','Entrega técnica do lote; testes manuais pendentes']);
  if(current!==branch)git(cwd,['branch','-m',branch]);
  return {status:'TECHNICAL_DELIVERY',branch,head:git(cwd,['rev-parse','HEAD']),manual_screen_tests:manualTests.scenarios.length?'PENDING':'NOT_APPLICABLE',checklist:path.relative(cwd,output).split(path.sep).join('/'),push:false};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const options={};
  for(let i=2;i<process.argv.length;i+=2) {
   const key={'--branch':'branch','--manual-tests-json':'manualTests'}[process.argv[i]];
   if(!key || !process.argv[i+1] || Object.hasOwn(options,key))throw Error('Uso: entregar-lote-go.mjs --branch revisao/LOTE --manual-tests-json JSON');
   options[key]=key==='manualTests'?JSON.parse(process.argv[i+1]):process.argv[i+1];
  }
  console.log(JSON.stringify(deliver(options)));
 }catch(error){console.error(error.stderr?.toString().trim()||error.message);process.exitCode=1;}
}