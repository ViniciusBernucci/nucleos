---
name: planejador-de-lote
description: Planeja um lote com entrevista grill-me e entrega manifesto executável para o Context Compiler, com tarefas proporcionais, checks, revisão corretiva única e roteiro manual de tela. Planejamento termina no plano; o usuário inicia run.
---

# Planejador de lote

## Contrato padrão

Use o [fluxo enxuto](../_shared/fluxo-enxuto.md). O usuário participa do planejamento e
depois inicia context run com o manifesto. Não execute run ao terminar o planejamento.
No despacho CONTEXTO_EXECUTION=step, execute apenas seu papel e o
[contrato Go](../_shared/context-compiler.md); não entreviste nem encadeie outras skills.

1. Confirme projeto, regras, branch/base SHA e ferramentas existentes. Consulte somente
   fontes relevantes. Reutilize planning-context.json quando vigente; não reexplore todo
   o repositório nem reutilize caminhos de outro computador.
2. Chame grill-me na mesma sessão para esclarecer decisões essenciais, permissões,
   comportamento esperado, critérios observáveis e fora de escopo. Ele devolve ao
   planejador. Perguntas de produto ficam nesta fase; não as adie para o run.
3. Com a entrevista, produza você mesmo a especificação e as unidades de execução.
   Não encadeie tech-lead ou worktree-planner nem abra agentes para repetir o planejamento.
   Registre origem das decisões, hipóteses e lacunas. Ausência essencial mantém o plano bloqueado.
4. Agrupe tarefas pequenas/dependentes numa unidade coerente. Cada unidade deve caber
   nos limites de uma sessão e ter checks reais. O padrão é uma worktree isolada por
   lote, execução sequencial. Não crie uma worktree por arquivo/ticket nem paralelismo
   sem benefício comprovado. A ordem de units respeita dependências.
5. Defina contratos entre unidades, escopo de arquivos, risco 0..4 e aceites. Escolha
   os checks pertinentes e um conjunto final integrado. Testes de tela serão manuais:
   prepare cenários e pré-condições, sem etapa de QA de tela por IA.
6. Prepare um brief consolidado para UMA revisão corretiva independente de impacto
   crítico/alto/médio. Inclua base SHA/diff, critérios essenciais, contratos e comandos
   de teste. Não crie auditor, review-loop-driver ou QA independente no fluxo padrão.
   Dispensa só para todas as unidades R0 e justificativa explícita.
7. Gere o [pacote completo](references/pacote-context-compiler.md) pelo
   [helper](scripts/gerar-pacote-go.mjs). Ele monta o DAG enxuto, valida os briefs e usa
   o compilador real em plan validate e run --dry-run. Publique somente se ambos passarem.

## Conteúdo suficiente para executar

Um manifesto canônico registra objetivo, exclusões, decisões, base SHA, autorizações,
unidades e dependências, critérios por ID, contratos, verificações reais e roteiro manual.
Cada unidade recebe seu brief com ticket_id, objective, scope, acceptance e instructions,
mais required/initial/available. Instruções devem permitir implementar sem esta conversa;
não copie a especificação inteira do lote a cada step.

Regras do projeto e requisitos essenciais são obrigatórios. Available é consulta sob
demanda; initial pode ser omitido pelo orçamento. Não inclua segredos, lockfiles inteiros,
catálogos ou documentação sem relação com o papel. Tarefa grande deve ser decomposta
por comportamento/contrato, preservando critérios e sem fragmentar excessivamente.

## Entrega e autorização

A proposta declara commits locais e branch revisao/ como parte da execução, sem push,
PR, publicação ou merge em main/master. O usuário autoriza essa proposta ao iniciar run;
não acrescente checkpoints humanos intermediários. Bloqueios reais de requisito, segurança,
ambiente ou orçamento são registrados precisamente; não invente solução para manter o fluxo.

Entregue manifesto, workflow e bindings, validações e comando context run CAMINHO --yes,
com --with somente se solicitado. Mesmo com plano pronto, não inicie implementação.
No fim do run, a entrega técnica terá roteiro PENDENTE_DE_TESTES_MANUAIS_DE_TELA;
isso não significa aceite visual nem aprovação humana.

O modo custom/legado só é usado se solicitado explicitamente. Não o selecione para
contornar validações do perfil enxuto. Snapshots de runs existentes permanecem imutáveis.