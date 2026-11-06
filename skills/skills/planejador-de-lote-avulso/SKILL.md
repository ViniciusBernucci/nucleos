---
name: planejador-de-lote-avulso
description: Recupera o planejamento clássico grill-me → tech-lead → worktree-planner para uso avulso, com especificação, tickets e plano Markdown. Use quando solicitado planejamento sem Context Compiler; não gera pacote executável nem inicia implementação.
---

# Planejador de lote avulso

Variante do planejador original anterior à integração com o Context Compiler, com nome
próprio e referências históricas locais. [Origem e adaptações](references/origem.md).
Não substitui planejador-de-lote, que continua atendendo ao fluxo do compilador.

## Contrato avulso

O usuário está pedindo planejamento independente. Entregue documentos legíveis para
execução posterior por uma IA ou pessoa, sem depender de compilador, runtime Node, MCP,
workflow/bindings YAML, manifesto executável JSON, indexação ou comandos context run.
Não carregue contratos do fluxo enxuto/compilador por essa variante.

Leia as regras locais de negócio, arquitetura, dados, segurança e documentação. A escolha
explícita desta variante dispensa apenas o acoplamento operacional do planejador, sem
ampliar permissões nem ignorar requisitos. Resolva caminhos a partir do projeto atual.
Não presuma Intranet, ORCA, ClickUp ou diretórios de outra instalação.

Os papéis abaixo são as etapas clássicas, recuperadas nas referências locais para que
alterações das skills homônimas não reconectem esta variante ao compilador. Carregue uma
etapa por vez na mesma sessão; não abra agentes/terminais para repetir planejamento.

## Encadeamento clássico

1. Identifique uma ou mais demandas, IDs/links quando existirem e o estado real do projeto.
   Consulte somente código/documentos pertinentes. Sem ID externo, use chave local estável.
2. Carregue [grill-me](references/grill-me.md): esclareça objetivo, comportamento, regras,
   bordas, restrições e fora do escopo. Reutilize respostas; não invente decisões essenciais.
3. Carregue [tech-lead](references/tech-lead.md) com as respostas: produza especificação,
   tickets proporcionais, critérios observáveis, contratos e dependências. Questão essencial
   aberta mantém a tarefa BLOQUEADA_NO_PLANEJAMENTO; avance nas demandas independentes.
4. Carregue [worktree-planner](references/worktree-planner.md): planeje isolamento quando
   necessário, ordem de implementação/integração, prompts e verificações. Trabalho simples
   pode compartilhar uma branch/worktree; não fragmente por arquivo nem crie paralelismo fictício.
5. Consolide um manifesto Markdown na pasta de planos configurada pelo projeto. Sem padrão,
   use documentacoes/planejamento/. Data/fuso do projeto e identificador estável; não sobrescreva
   outro lote. Reutilize somente artefatos do mesmo planejamento que esteja sendo retomado.

Manifesto: objetivo; escopo e exclusões; decisões e origem; por tarefa, ID, perfil/risco
justificado, referência à especificação, critérios, contratos, dependências e status;
bases/SHAs verificados, ordem de execução/integração, recursos, validações e bloqueios.
Não copie integralmente critérios/documentos já canônicos nem mande o executor reler
conteúdo transcrito sem necessidade. Produza prompts com referências reais e suficientes
para executar sem esta conversa, sem despejar todo o acervo documental.

## Entrega

Entregue manifesto e especificações Markdown, prompts quando úteis, resumo e pendências.
Pode registrar decisões/questões em planning-context.json se isso ajudar a retomada;
esse arquivo é memória de planejamento, não contrato executável de runtime.
Marque PRONTA_PARA_IMPLEMENTAR somente quando requisitos essenciais, contratos, plano e
verificações viáveis estiverem claros. Hipótese não é aprovação do usuário.

Planejar não inicia implementação. Encerre nos documentos prontos; uma solicitação futura
pode mandar uma IA executar o plano diretamente. Não abra compilador ou orquestrador,
crie worktrees, faça commits/merges/push/PR nem execute testes ou mudanças de aplicação.