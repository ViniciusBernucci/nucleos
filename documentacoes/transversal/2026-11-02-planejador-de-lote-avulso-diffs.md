# Diffs da variante avulsa

Registro: [entrega original](2026-11-02-planejador-de-lote-avulso.md).

[Entrega](2026-11-02-planejador-de-lote-avulso.md). Comparacao com os bytes iniciais; os espelhos copiam os mesmos recursos e nao sao repetidos.

```diff
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-base\\AGENTS.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\nucleos\\AGENTS.md"
index 57399c6..cc0f985 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-base\\AGENTS.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\nucleos\\AGENTS.md"	
@@ -5,6 +5,8 @@ Estas instrucoes se aplicam a todo o repositorio. Regras mais especificas em um
 dispensar a documentacao obrigatoria de entrega nem a manutencao de `lessons/`.
 
 
+Quando o usuario chamar planejador-de-lote-avulso, use o planejamento classico independente: entrevista, especificacao e plano Markdown. Essa escolha dispensa o pacote/execucao do compilador e as rotinas de preparacao/indexacao do Node legado descritas abaixo; permanecem regras de negocio, seguranca e documentacao. O planejador avulso nao inicia implementacao.
+
 ## Fluxo enxuto padrao
 
 Novos lotes: planejador-de-lote + grill-me na mesma sessao; o planejador termina no
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-base\\CLAUDE.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\nucleos\\CLAUDE.md"
index 156283c..599d7a8 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-base\\CLAUDE.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\nucleos\\CLAUDE.md"	
@@ -6,6 +6,8 @@ complementa-las, mas nao podem dispensar a documentacao obrigatoria nem a base
 didatica descritas aqui.
 
 
+Quando o usuario chamar planejador-de-lote-avulso, use o planejamento classico independente: entrevista, especificacao e plano Markdown. Essa escolha dispensa o pacote/execucao do compilador e as rotinas de preparacao/indexacao do Node legado descritas abaixo; permanecem regras de negocio, seguranca e documentacao. O planejador avulso nao inicia implementacao.
+
 ## Fluxo enxuto padrao
 
 Novos lotes: planejador-de-lote + grill-me na mesma sessao; o planejador termina no
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\SKILL.md"
new file mode 100644
index 0000000..aceb268
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\SKILL.md"	
@@ -0,0 +1,61 @@
+---
+name: planejador-de-lote-avulso
+description: Recupera o planejamento clássico grill-me → tech-lead → worktree-planner para uso avulso, com especificação, tickets e plano Markdown. Use quando solicitado planejamento sem Context Compiler; não gera pacote executável nem inicia implementação.
+---
+
+# Planejador de lote avulso
+
+Variante do planejador original anterior à integração com o Context Compiler, com nome
+próprio e referências históricas locais. [Origem e adaptações](references/origem.md).
+Não substitui planejador-de-lote, que continua atendendo ao fluxo do compilador.
+
+## Contrato avulso
+
+O usuário está pedindo planejamento independente. Entregue documentos legíveis para
+execução posterior por uma IA ou pessoa, sem depender de compilador, runtime Node, MCP,
+workflow/bindings YAML, manifesto executável JSON, indexação ou comandos context run.
+Não carregue contratos do fluxo enxuto/compilador por essa variante.
+
+Leia as regras locais de negócio, arquitetura, dados, segurança e documentação. A escolha
+explícita desta variante dispensa apenas o acoplamento operacional do planejador, sem
+ampliar permissões nem ignorar requisitos. Resolva caminhos a partir do projeto atual.
+Não presuma Intranet, ORCA, ClickUp ou diretórios de outra instalação.
+
+Os papéis abaixo são as etapas clássicas, recuperadas nas referências locais para que
+alterações das skills homônimas não reconectem esta variante ao compilador. Carregue uma
+etapa por vez na mesma sessão; não abra agentes/terminais para repetir planejamento.
+
+## Encadeamento clássico
+
+1. Identifique uma ou mais demandas, IDs/links quando existirem e o estado real do projeto.
+   Consulte somente código/documentos pertinentes. Sem ID externo, use chave local estável.
+2. Carregue [grill-me](references/grill-me.md): esclareça objetivo, comportamento, regras,
+   bordas, restrições e fora do escopo. Reutilize respostas; não invente decisões essenciais.
+3. Carregue [tech-lead](references/tech-lead.md) com as respostas: produza especificação,
+   tickets proporcionais, critérios observáveis, contratos e dependências. Questão essencial
+   aberta mantém a tarefa BLOQUEADA_NO_PLANEJAMENTO; avance nas demandas independentes.
+4. Carregue [worktree-planner](references/worktree-planner.md): planeje isolamento quando
+   necessário, ordem de implementação/integração, prompts e verificações. Trabalho simples
+   pode compartilhar uma branch/worktree; não fragmente por arquivo nem crie paralelismo fictício.
+5. Consolide um manifesto Markdown na pasta de planos configurada pelo projeto. Sem padrão,
+   use documentacoes/planejamento/. Data/fuso do projeto e identificador estável; não sobrescreva
+   outro lote. Reutilize somente artefatos do mesmo planejamento que esteja sendo retomado.
+
+Manifesto: objetivo; escopo e exclusões; decisões e origem; por tarefa, ID, perfil/risco
+justificado, referência à especificação, critérios, contratos, dependências e status;
+bases/SHAs verificados, ordem de execução/integração, recursos, validações e bloqueios.
+Não copie integralmente critérios/documentos já canônicos nem mande o executor reler
+conteúdo transcrito sem necessidade. Produza prompts com referências reais e suficientes
+para executar sem esta conversa, sem despejar todo o acervo documental.
+
+## Entrega
+
+Entregue manifesto e especificações Markdown, prompts quando úteis, resumo e pendências.
+Pode registrar decisões/questões em planning-context.json se isso ajudar a retomada;
+esse arquivo é memória de planejamento, não contrato executável de runtime.
+Marque PRONTA_PARA_IMPLEMENTAR somente quando requisitos essenciais, contratos, plano e
+verificações viáveis estiverem claros. Hipótese não é aprovação do usuário.
+
+Planejar não inicia implementação. Encerre nos documentos prontos; uma solicitação futura
+pode mandar uma IA executar o plano diretamente. Não abra compilador ou orquestrador,
+crie worktrees, faça commits/merges/push/PR nem execute testes ou mudanças de aplicação.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\agents\\openai.yaml" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\agents\\openai.yaml"
new file mode 100644
index 0000000..53bde46
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\agents\\openai.yaml"	
@@ -0,0 +1,6 @@
+interface:
+  display_name: "Planejador de Lote Avulso"
+  short_description: "Planejamento clássico, sem compilador"
+  default_prompt: "Use $planejador-de-lote-avulso para entrevistar, especificar e planejar este lote em Markdown, sem compilador nem execução."
+policy:
+  allow_implicit_invocation: true
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\grill-me.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\grill-me.md"
new file mode 100644
index 0000000..c83ff81
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\grill-me.md"	
@@ -0,0 +1,16 @@
+# Etapa histórica: grill-me
+
+Papel recuperado do acervo em e18f2e3, adaptado ao planejador avulso.
+
+Questione o plano até esclarecer decisões importantes. Leia demanda e fontes pertinentes
+antes de entrevistar. Pergunte em português, uma decisão relevante por vez, sobre resultado
+esperado, usuários, situação atual, restrições, regra de negócio, erros, permissões,
+dados legados, limites e critérios de sucesso.
+
+Confronte premissas com evidência e explique consequências das alternativas. Não pergunte
+fatos verificáveis no repositório nem repita respostas já válidas. Registre decisões,
+hipóteses, questões abertas, exemplos Dado/Quando/Então e fora do escopo.
+
+Não implemente nem invente arquitetura na entrevista. Sem resposta essencial, preserve
+a questão; não declare requisito resolvido. Devolva ao planejador avulso para a etapa
+tech-lead, sem chamar compilador, runtime, outras sessões ou o fluxo enxuto.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\origem.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\origem.md"
new file mode 100644
index 0000000..8bfa79e
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\origem.md"	
@@ -0,0 +1,17 @@
+# Origem da variante avulsa
+
+Base histórica: commit e18f2e3 (primeiro commit do acervo), arquivos
+skills/planejador-de-lote/SKILL.md, skills/grill-me/SKILL.md,
+skills/tech-lead/SKILL.md e skills/worktree-planner/SKILL.md.
+Também conferida a revisão c79d38d (V1.0.3), anterior à adaptação Go em 35925ae.
+
+Restaurado o encadeamento clássico grill-me → tech-lead → worktree-planner.
+A revisão c79d38d já exigia manifesto/runtime V2; por isso a base escolhida é anterior.
+
+Adaptações intencionais para o pedido atual: nome planejador-de-lote-avulso; uso
+portátil; referências próprias aos papéis originais; saída em Markdown sem manifesto
+executável; remoção do acoplamento a compilador, runtime Node, indexação e lançamento
+automático do orquestrador. Não é uma cópia byte a byte: são os papéis clássicos
+preservados com esse isolamento operacional. Não se modificou o planejador atual.
+
+O arquivo de origem é documentação histórica para conferência, não outra etapa.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\tech-lead.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\tech-lead.md"
new file mode 100644
index 0000000..6aa9b2f
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\tech-lead.md"	
@@ -0,0 +1,23 @@
+# Etapa histórica: tech-lead
+
+Papel recuperado do acervo em e18f2e3, adaptado ao planejador avulso.
+
+Planeje a execução respeitando requisitos, ADRs e o estado real. Leia regras, arquitetura,
+backlog e evidências pertinentes; checkbox ou relato não prova implementação.
+
+1. Identifique resultado esperado, restrições, capacidade e situação atual. Pergunte só
+   o que muda materialmente escopo, prioridade ou sequência; registre hipóteses.
+2. Decomponha por resultados verificáveis. Use iniciativa/épico/feature/ticket somente
+   nos níveis úteis; não crie hierarquia inteira para uma correção pequena.
+3. Cada ticket tem ID, objetivo, contexto, escopo/exclusões, critérios observáveis,
+   dependências, contratos, verificações propostas, documentação e riscos.
+4. Ordene por dependência e risco. Registre caminho crítico, migrations/deploy, colisões
+   e paralelismo real. Estimativas são hipóteses, não prazos garantidos.
+5. Sprint/milestone só quando solicitado ou necessário. Preserve IDs ao replanejar.
+
+Decisão estrutural ausente ou incompatível com ADR vira questão arquitetural, sem
+redesenho silencioso. Não invente arquivos, testes executados ou comandos disponíveis.
+Siga o padrão documental do projeto e mantenha uma especificação canônica.
+
+Devolva tickets, prioridades, dependências e bloqueios ao planejador para a etapa
+worktree-planner. Não execute implementação, publicação externa, runtime ou gates.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\worktree-planner.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\worktree-planner.md"
new file mode 100644
index 0000000..4aedac2
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\avulso-work\\skills\\planejador-de-lote-avulso\\references\\worktree-planner.md"	
@@ -0,0 +1,24 @@
+# Etapa histórica: worktree-planner
+
+Papel recuperado do acervo em e18f2e3, adaptado ao planejador avulso.
+
+Prepare o plano operacional a partir dos tickets. Não implemente nem execute Git de
+escrita. Confirme regras e topologia reais; não importe caminhos/políticas de outro projeto.
+
+1. Reutilize a especificação, critérios e decisões da etapa anterior. Lacuna essencial
+   impede marcar o prompt pronto; não refaça a entrevista sem uma dúvida nova concreta.
+2. Separe frentes somente com independência real. Identifique arquivos/símbolos em disputa,
+   contratos compartilhados e ordem de integração. Trabalho dependente pode ser sequencial
+   na mesma worktree ou exigir outra base. Não imponha worktree por ticket.
+3. Registre repositório, base/HEAD verificados, branch proposta, localização de trabalho,
+   arquivos esperados, fronteiras, critérios, verificações e handoff. Nomeie sem colisões.
+4. Produza plano geral e prompts por frente quando úteis, em Markdown, com referências
+   reais à especificação. Não gere bindings, workflow ou estado executável de runtime.
+5. Descreva preparação, integração e eventual limpeza como ações futuras autorizáveis,
+   preservando trabalho não integrado e ownership. Planejar não cria worktrees, faz merge
+   ou exclui arquivos. Não execute indexação/ensure de ferramenta por preparar o plano.
+6. Diferencie implementação, checks, revisão e aceite manual conforme o projeto. Uma
+   proposta de validação não é aprovação nem teste executado.
+
+Devolva planos, sequência, prompts e bloqueios ao planejador avulso. Não inicie
+orquestrador ou compilador. O plano deve poder ser entregue diretamente a outra sessão.
\ No newline at end of file

```