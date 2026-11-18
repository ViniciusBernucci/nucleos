# Adoção do fluxo enxuto de IA

Data: 2026-11-01. Domínio: transversal. Solicitação: simplificar o fluxo mantendo grill-me,
run iniciado pelo usuário e testes de tela manuais. Branch: developer.
HEAD/base inicial: 8129a391f0f88f6d77704eb41b7cd89a2fc19379. Comparação desta tarefa:
cópias dos arquivos da árvore de trabalho no início, preservando alterações anteriores.
Autor: Codex a pedido de Vinicius. Nenhum commit criado nesta tarefa.

## Escopo e resultado

Atualização das skills fonte em skills/skills/, seus modelos e regras locais.
Fluxo padrão: planejador + grill-me na mesma sessão; usuário chama context run;
unidades/checks sequenciais numa worktree; uma revisão corretiva consolidada;
checks finais e entrega Git local determinística; testes de tela manuais.

O planejador não chama run sozinho. Não há approvals, auditor, review-loop-driver ou
QA de tela por IA no fluxo novo. A revisão procura/corrige somente impactos médios,
altos e críticos demonstrados, em um ciclo, sem refatorações cosméticas.
Bloqueio essencial continua sendo registrado, sem inventar requisito ou aprovação.

A proposta do manifesto declara commits/branch locais; o usuário autoriza ao iniciar run.
Não autoriza push, PR, publicação ou merge automático em main/master.
A alteração de skills desta tarefa não executou nenhum lote nem commit no Nucleos.

## Arquivos e decisões

- AGENTS.md e CLAUDE.md: política atual e distinção entre conclusão técnica e teste visual.
  Preservadas regras de banco único/schemas, segurança, documentação e lessons.
- Planejador e grill-me: entrevista mantida; especificação/unidades consolidadas pelo
  planejador sem sessões obrigatórias de tech-lead/worktree-planner.
- Implementador: instruções reduzidas, uma unidade e checks, sem coordenação/commits pela IA.
- Revisor: modo corretivo explícito; pedido direto de review continua sem editar por padrão.
- _shared/fluxo-enxuto.md e perfis-de-risco.md: política atual; política anterior preservada
  em perfis-de-risco-legado.md. Risco aumenta cobertura, sem multiplicar agentes.
- Recursos Node do planejador: montagem/validação do DAG, revisão única e roteiro manual.
- _shared/scripts/entregar-lote-go.mjs: commit/branch locais somente na worktree isolada,
  proteção do checkout principal, destino existente, conflitos e arquivos de segredo.
- Demais referências e skills especializadas: modo legado/pedido explícito; retiradas do
  encadeamento padrão, sem apagar capacidades que ainda têm uso separado.
- Modelos e três espelhos de descoberta sincronizados pelo instalador oficial.
- [Diffs próprios desta tarefa](2026-11-01-fluxo-enxuto-ia-diffs.md).

O padrão atual compartilha uma worktree por lote; portanto não faz merges entre unidades.
Múltiplas frentes/worktrees paralelas continuam exigindo workflow custom explícito com
suporte real. Não foi declarada uma implementação nova dessa capacidade no compilador.
Não há economia percentual comprovada: o usuário fará a validação em feature real.

## Operação

Chame planejador-de-lote na IA do projeto e responda ao grill-me durante o planejamento.
Receba o manifesto pronto e rode:
```bash
context run "C:/caminho/nucleos/documentacoes/planejamento-ia/lote.md" --with claude --yes
```

Ao concluir, localize a worktree/branch revisao/ no relatório do runtime. Execute
manualmente os cenários de documentacoes/entregas-ia/testes-manuais.md.
Sem alteração de tela, o roteiro declara NA com justificativa.
DONE técnico não declara QA visual aprovado. Checks de código/API/contratos continuam.

Limites, logs, métricas, pause/checkpoint/resume/recover permanecem. Não se alterou snapshot
da execução antiga 31d6724286f0e3bb0542b6818c7971d0 nem se retomou esse run nesta tarefa.
O novo pacote usa campos já aceitos pelo binário Go; não exige nova compilação.

Manual técnico/operacional: docs/FLUXO-ENXUTO.md no repositório irmão context-compiler-v1.
Contrato detalhado: skills/skills/planejador-de-lote/references/pacote-context-compiler.md.

## Validação e lessons

Testes Node do gerador/entrega com compilador real e executora falsa: ver registro final.
Cobertura inclui sequência, autorização, limites do papel, roteiro/NA, proteção de
main/checkout, destino existente, repetição sem commit duplicado e pipeline completo.
Frontmatter e referências das 16 skills validados; espelhos conferidos pelo instalador.
Não foram executados testes de tela nem IA real: o usuário fará a validação solicitada.
Build/lint/test do aplicativo: NA; não houve alteração de código ou dependências do app.

lessons/ não foi alterada: a entrega é de instruções e automação externa de Git/IA, sem
mudança de conceito da trilha TypeScript/Python/Docker/PostgreSQL/segurança da aplicação.
Não foi criado material artificial nem alterado o índice da trilha.

## Riscos e rollback

As ações locais de Git exigem manifesto explícito e worktree isolada. Falhas reais de
ambiente, permissão, orçamento ou requisito podem interromper o fluxo. Nunca transforme
isso em aprovação fictícia para evitar intervenção humana.

Rollback: restaurar somente os patches desta tarefa e sincronizar os espelhos novamente;
preservar todo trabalho anterior, snapshots, logs e worktrees. Não usar reset global.
Pendência intencional: validação de consumo/qualidade e testes de tela pelo usuário.

## Registro final da instalação

Validação final: 16 testes Node aprovados, sem skips; 16 skills válidas. Instalações original e Nucleos: 81 arquivos por destino, três destinos, zero divergências; archify extra preservada. Conferidos 67 arquivos instalados e 84 arquivos alheios à tarefa sem mudanças. Diff checks passaram. HEAD/branch Nucleos permaneceram 8129a391f0f88f6d77704eb41b7cd89a2fc19379/developer. O run histórico 31d672... permaneceu PENDING, revisão 7. Nenhuma IA real, tela ou lote Nucleos foi executado nesta tarefa; nenhum commit no repositório.
