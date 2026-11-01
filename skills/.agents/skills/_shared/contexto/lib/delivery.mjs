import fs from 'node:fs';
import path from 'node:path';
import { git, discover } from './worktrees.mjs';
import { atomicWrite, safePath, sanitize, id } from './safety.mjs';

export function delivery(store, input) {
  id(input.id);
  if (!['ENTREGA_INICIAL', 'CORRECAO', 'FECHAMENTO_INTEGRADO'].includes(input.mode)) throw Error('Modo de entrega inválido');
  const file = safePath(store.root, input.output, { existing: false });
  if (!/\.md$/.test(file)) throw Error('Registro deve ser Markdown');
  const info = discover(store.root);
  if (['main', 'master'].includes(info.branch) || !info.branch) throw Error('Entrega exige branch de trabalho');
  const base = input.base_sha;
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(base || '')) throw Error('base_sha completo obrigatório');
  git(store.root, ['cat-file', '-e', `${base}^{commit}`]);
  for (const field of ['title', 'context', 'changes', 'risks', 'how_to_test']) if (typeof input[field] !== 'string' || !input[field].trim()) throw Error(`Texto obrigatório: ${field}`);
  const head = git(store.root, ['rev-parse', 'HEAD']);
  // Include committed and current changes. Do not embed diffs or inspect file contents.
  const changed = new Set([
    ...git(store.root, ['diff', '--name-only', `${base}...HEAD`]).split('\n'),
    ...git(store.root, ['diff', '--name-only']).split('\n'),
    ...git(store.root, ['diff', '--cached', '--name-only']).split('\n'),
    ...git(store.root, ['ls-files', '--others', '--exclude-standard']).split('\n')
  ].filter(Boolean).filter(name => name !== input.output && !/^docs\/historico\//.test(name)));
  const checks = Array.isArray(input.checks) ? input.checks : [];
  const date = new Date().toISOString(), marker = `<!-- fluxo-entrega:${input.id} -->`;
  const sections = [`${marker}`, '', `Data UTC: ${date}. Branch: ${info.branch}. Base: ${base}. HEAD observado antes do fechamento: ${head}.`, '', '## Contexto', '', input.context, '', '## O que foi feito', '', input.changes, '', '## Arquivos alterados', '', ...[...changed].sort().map(name => `- ${name}`), '', '## Referências de diff e validação', '', `Consultar Git entre ${base} e o commit da entrega. O runtime não cria commits nem atribui o HEAD anterior a trabalho pendente.`, '', ...checks.map(check => `- ${check.command}: ${check.result}; evidência: ${check.evidence || 'não informada'}`), '', '## Impacto e pontos de atenção', '', input.risks, '', '## Como testar', '', input.how_to_test, ''];
  if (input.mode === 'CORRECAO') {
    if (!fs.existsSync(file)) throw Error('Correção deve atualizar o registro existente');
    if (!Array.isArray(input.finding_ids) || !input.finding_ids.length) throw Error('Correção exige IDs');
    const previous = fs.readFileSync(file, 'utf8');
    if (previous.includes(marker)) return { duplicate: true, output: input.output, indexed: false };
    const extra = sanitize(`\n## Correções — ${input.finding_ids.join(', ')}\n\n${sections.join('\n')}`);
    const position = previous.indexOf('\n## Resumo para o ClickUp');
    atomicWrite(file, position < 0 ? previous + extra : previous.slice(0, position) + extra + '\n' + previous.slice(position));
  } else {
    if (fs.existsSync(file)) {
      const previous = fs.readFileSync(file, 'utf8');
      if (previous.includes(marker)) return { duplicate: true, output: input.output, indexed: false };
      throw Error('Registro existente de outra entrega; não sobrescrever');
    }
    if (input.clickup) {
      const clickupId = input.clickup.id || 'nenhum';
      if (!/^[a-z0-9-]+$/.test(clickupId) || !['backend', 'frontend'].includes(input.clickup.layer)) throw Error('Marcadores ClickUp inválidos');
      sections.push('## Resumo para o ClickUp', '', `<!-- clickup-resumo:inicio id=${clickupId} camada=${input.clickup.layer} -->`, `**${input.title}**`, '', '**O que foi feito**', input.changes, '', '**Como testar**', input.how_to_test, '', '**Pontos de atenção**', input.risks, '', `**Repositório:** ${path.basename(store.root)} (${input.clickup.layer})`, '<!-- clickup-resumo:fim -->', '');
    }
    atomicWrite(file, sanitize(`# ${input.title}\n\n${sections.join('\n')}`));
  }
  return { output: input.output, mode: input.mode, branch: info.branch, base_sha: base, observed_head: head, changed_files: [...changed], committed: false, indexed: false, note: 'Coordenador serializa índice após commit real; correção não cria nova linha. Publicação manual.' };
}
