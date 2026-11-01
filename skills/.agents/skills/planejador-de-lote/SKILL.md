---
name: planejador-de-lote
description: Planeja uma ou mais demandas com grill-me, tech-lead e worktree-planner e entrega automaticamente manifesto, workflow e catálogo validados para o Context Compiler. Use para iniciar ou revisar um lote; planejamento não inicia implementação.
---

# Planejador de lote

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Nesse caso não encadeie grill-me, tech-lead ou worktree-planner: o YAML define essas etapas. Na chamada direta do usuário, preserve o encadeamento de planejamento abaixo.

## Entrega para o Context Compiler Go

A chamada normal já exige o pacote completo para o compilador: manifesto Markdown com cabeçalho e especificação essencial, workflow YAML e catálogo bindings YAML. Não espere o usuário pedir esses arquivos nem entregue apenas um plano de texto para ele adaptar. A exceção é o modo legado V2 solicitado explicitamente, que mantém seu contrato próprio.

Leia o [contrato de saída e geração automática](references/pacote-context-compiler.md) e use [gerar-pacote-go.mjs](scripts/gerar-pacote-go.mjs) para publicar os três arquivos. O helper verifica projeto/caminhos, gera o cabeçalho e só publica após `plan validate` e `run --dry-run` aprovados pelo compilador real. Você prepara e executa essa geração como parte do planejamento; o usuário recebe o manifesto pronto e o comando de execução.

Resolva o projeto, executoras, providers, comandos, condições, critérios e dependências com os fatos coletados no planejamento. Preserve a configuração explícita do projeto. Sem catálogo existente, cadastre as executoras verificadas no mesmo acervo desta skill. Não copie caminhos de outro computador, invente comandos ou peça ao usuário que monte o pacote manualmente.

O workflow começa nas etapas executoras e não repete entrevista/planejamento nem usa `orquestrador-fluxo-ia` como coordenador. Dados essenciais ausentes, ferramenta indisponível ou capacidade não suportada deixam a entrega bloqueada, com motivo explícito; nunca declare `ready` por ter apenas escrito os arquivos. Não altere gates para esconder um bloqueio. Planejar não inicia a execução do workflow.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

## Artefatos de planejamento e compatibilidade

Persista decisões, origem e referências em `planning-context.json` por lote. No fluxo Go, o contrato executável é o Markdown com cabeçalho, workflow e catálogo descritos acima; não gere um segundo manifesto operacional incompatível. Preserve bases completas, caminhos reais, DAG, critérios por ID e grupos por repositório nos artefatos de planejamento. O manifesto JSON e o [protocolo V2](../_shared/protocolo-v2.md) são exigidos apenas no modo legado V2 explícito. Planeje fontes existentes na base; arquivos novos serão cobertos pelo snapshot Git. Não reexplore o repositório inteiro a cada demanda; atualize fatos apenas quando seus hashes/referências mudarem. Gerar os artefatos não inicia execução.

Entrada do planejamento para Claude, Antigravity e Codex. Leia [configuração por projeto](../_shared/perfil-projeto.md), regras locais e [execução portátil](../_shared/execucao-portavel.md). Carregar uma skill significa ler seu SKILL.md e seguir suas instruções com as ferramentas disponíveis; não depende de um comando exclusivo de um cliente.

Leia [perfis de risco](../_shared/perfis-de-risco.md) e [contexto e automação](../_shared/contexto-e-automacao.md). Classifique cada tarefa como simples/padrao/critico e registre justificativa, critérios e gates aplicáveis. Preserve controles de banco/Git em todos os perfis. Não use o tamanho do diff como classificação de risco.

## Encadeamento

1. Identifique as demandas selecionadas pelo usuário, com IDs/links quando existirem. Consulte fontes conectadas e o código antes de perguntar. ClickUp é opcional; sem vínculo, gere uma chave local estável e registre “não possui ID vinculado”, sem inventar ticket externo.
2. Carregue **grill-me** para esclarecer objetivo, comportamento atual, regras de negócio, bordas e fora do escopo do lote. Pergunte o que só o usuário pode decidir. Reutilize respostas e fatos documentados entre demandas; registre hipóteses e questões em aberto. Não confunda falta de requisito com permissão para inventá-lo.
3. Assim que a entrevista permitir critérios observáveis, carregue **tech-lead** automaticamente com todas as respostas. Ele produz tickets e dependências, sem iniciar implementação. Questões essenciais não resolvidas deixam a tarefa BLOQUEADA_NO_PLANEJAMENTO; continue as demais.
4. Ao concluir os tickets, carregue **worktree-planner** automaticamente para preparar cada feature. Ele usa a especificação já produzida, sem repetir a entrevista, e grava planos, prompts e estados. Não peça ao usuário para invocar essas etapas.
5. Consolide o manifesto na pasta de planos configurada, com data/fuso do projeto (Intranet: `{FONTE_CLAUDE}/worktrees/AAAA-MM-DD/lote-AAAA-MM-DD-{slug}.md` e America/Sao_Paulo). Use slug estável do lote; em colisão, reutilize só se for retomada do mesmo lote, senão acrescente sufixo. Nunca sobrescreva outro lote do dia.
6. Monte a entrada do helper com a especificação aprovada, o workflow e o catálogo completos. Gere e valide o pacote automaticamente conforme o contrato de saída. A chamada normal termina com os três arquivos publicados e validados ou um bloqueio preciso, sem exigir um prompt adicional do usuário.

Manifesto: identificador do lote; data/fuso; demandas incluídas/excluídas; referências de especificações/estados; por tarefa: chave, ID externo opcional, camadas, perfil/justificativa, critérios observáveis e seus IDs, dependências e status; grafo sem ciclos; ordem de execução/integração; mapeamento de step para ticket/critério; base ref + SHA por repositório; branch de revisão por grupo; recursos necessários e riscos. Inclua os requisitos essenciais para executar sem a conversa anterior, sem duplicar integralmente documentos auxiliares. Use o prefixo de revisão configurado (default revisao/AAAA-MM-DD-{slug}), com sufixos -2, -3 apenas para grupos incompatíveis. Todos os planos referenciam este mesmo manifesto.

## Conclusão

No fluxo Go, marque PRONTA_PARA_ORQUESTRAR somente a tarefa com critérios essenciais, contratos e planos definidos e pacote publicado com `ready: true` pelo helper após validação real. Não marque especificação como aprovada pelo usuário se apenas foi inferida: registre a origem de cada decisão. Distingua prontidão técnica de autorização para executar.

Entregue os caminhos do manifesto, workflow e catálogo, as validações realizadas, resumo e pendências e o comando `contexto run CAMINHO_ABSOLUTO_DO_MANIFESTO.md`. Use o executável absoluto se estiver fora do PATH e acrescente `--with` somente quando solicitado; por padrão valem os providers por etapa. **Planejar não inicia execução.** Se o usuário já pediu explicitamente planejar e executar, rode o comando com `--yes` após validar o plano, sem chamar uma LLM orquestradora. Fora disso, encerre no plano pronto. A execução usa as etapas e autorizações declaradas no workflow; não implique push/PR nem publicação externa. O runtime V2 anterior só deve ser utilizado quando o usuário pedir explicitamente o modo legado.
