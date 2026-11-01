---
name: worktree-planner
description: Planeja isolamento de tickets em worktrees, contratos entre frentes, sequência de integração e prompts de execução. Use quando solicitado planejamento com worktrees ou no fluxo Intranet/Orca; não substitui o backlog do Tech Lead nem intercepta toda solicitação de implementação.
---

# Planejador de worktrees

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Planeje o isolamento e entregue os contratos; a criação e o despacho das worktrees pertencem ao runtime.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

## Manifesto executável V2

Gere a parte operacional do JSON definido no [protocolo V2](../_shared/protocolo-v2.md): caminhos absolutos reais, SHA base completo, branch final, definition com fontes/IDs e grupos de integração. Compartilhe `ticket` entre camadas da mesma tarefa, para limites globais de rodadas. Referencie a especificação única; não repita 00/99 nem prompts extensos de tarefa simples. Inclua o helper embarcado, sem pressupor instalação de Contexto/MCP. Retorne ao planejador; não inicialize agentes ou worktrees por planejar.

Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.

Prepare um plano operacional a partir de uma tarefa já definida. Não implemente nem execute Git de escrita; gere arquivos e comandos revisáveis. Leia o ticket, critérios de aceite, dependências, regras locais e topologia real dos repositórios.

No fluxo Intranet, aplique [perfis](../_shared/perfis-de-risco.md) e [contexto econômico](../_shared/contexto-e-automacao.md): especificação única, prompts por referência e artefatos proporcionais. Não copie contratos/regras já acessíveis ao executor.

## Perfil

- IntranetNova/docker-intranet com Orca e ClickUp: leia [perfil Intranet](references/intranet.md). Ele preserva os contratos de branches, registro, review pós-commit e índice diário. Confirme a topologia antes de usar seus caminhos.
- Outros projetos: descubra repositório(s), base, nomes e diretório de worktrees pela configuração local e pedido. Não importe limites de duas worktrees, caminhos Windows, SQL Server, ClickUp ou políticas de commit da Intranet.

## Plano portátil

1. Reutilize a especificação do Tech Lead quando existir; não rediscuta critérios já aprovados. Resolva lacunas que impedem um aceite observável. Sem critérios essenciais, registre o bloqueio e não gere um prompt executável incompleto.
2. Separe frentes apenas quando houver independência real. Identifique colisões de arquivos, símbolos compartilhados, contrato de API e ordem de integração. Trabalho dependente pode exigir sequência ou branch base diferente, não paralelismo fictício.
3. Registre caminhos reais, branch base e identificação do ponto inicial, branch da tarefa, arquivos esperados, limites de leitura/escrita, critérios de aceite, validação e handoff. Não gere comandos com placeholders pendentes.
4. Produza plano geral, contratos por frente e referências consumidas pelo Context Compiler, no padrão documental do projeto. O planejador-de-lote consolida o cabeçalho, workflow e catálogo. O estado operacional pertence ao runtime; gere estado V2 para `orquestrador-fluxo-ia` somente no modo legado explícito. Sem padrão, use `documentacoes/planejamento/worktrees/`. Nomeie sem sobrescrever planos anteriores.
5. Inclua nos prompts somente instruções indisponíveis por referência. Confirme caminhos absolutos das skills e especificação; o executor lê esses arquivos sem depender de descoberta nativa. Transcreva contrato somente quando o acesso ao original não existir, registrando a razão. Não copie o texto e mande reler o original.
6. Descreva criação, integração e limpeza, com verificação de branch, estado local e trabalho ainda não integrado antes de qualquer remoção. A execução depende do pedido; gerar o plano não autoriza merge, push ou exclusão.
7. Inclua no prompt a preparação automática pelo criador/executor conforme [worktrees automáticas](../_shared/worktrees-automaticas.md): helper real, raiz da worktree e origem de configuração confirmada. O usuário não executa init. Planejamento apenas descreve; execução prepara e registra recibo antes de delegar.

Não embuta revisão técnica nos prompts de implementação. O workflow configura `revisor-de-codigo` conforme o risco e o runtime despacha essa etapa independente. Não confunda commit local com aprovação.

No fluxo do planejador-de-lote, devolva os arquivos ao planejador para consolidar o manifesto e terminar o planejamento. Não inicie execução sem pedido já existente; a execução Go usa `contexto run`, sem uma LLM coordenadora.

Saída: frentes/worktrees, dependências, ordem de integração, caminhos dos planos, arquivo de estado e bloqueios concretos.
