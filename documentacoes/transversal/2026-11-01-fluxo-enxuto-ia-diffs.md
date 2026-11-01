# Diffs próprios — fluxo enxuto

[Entrega](2026-11-01-fluxo-enxuto-ia.md). Base: bytes iniciais da árvore; não atribuir mudanças anteriores à tarefa. Espelhos recebem bytes idênticos à fonte e não são repetidos no patch. Não inclui diff da própria documentação de entrega.

```diff
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\AGENTS.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\AGENTS.md"
index b6fce05..57399c6 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\AGENTS.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\AGENTS.md"	
@@ -5,6 +5,20 @@ Estas instrucoes se aplicam a todo o repositorio. Regras mais especificas em um
 dispensar a documentacao obrigatoria de entrega nem a manutencao de `lessons/`.
 
 
+## Fluxo enxuto padrao
+
+Novos lotes: planejador-de-lote + grill-me na mesma sessao; o planejador termina no
+pacote e o usuario inicia context run. Uma worktree por lote, unidades sequenciais,
+checks, uma revisao corretiva de impactos medios/altos/criticos, checks integrados e
+entrega deterministica em revisao/. Sem auditor, review-loop ou QA de tela por IA.
+Os testes de tela sao MANUAIS ao final, com roteiro; DONE tecnico nao e aceite visual.
+O run autoriza commits/branch locais explicitamente propostos no manifesto; nao autoriza
+push, PR, publicacao ou merge em main/master. Fora disso, sem commits sem pedido explicito.
+No planejamento/despacho enxutos, nao preparar/indexar o Node legado. Preservar regras
+de negocio/banco, seguranca, documentacao/lessons, limites, telemetria e retomada.
+Esta politica substitui apenas o encadeamento/gates legados abaixo. Um ciclo de correcao
+e testes; bloqueios reais sao registrados. Runs antigos conservam seu snapshot.
+
 ## Despacho pelo Context Compiler Go
 
 Quando o prompt contiver CONTEXTO_EXECUTION=step, esta secao rege a coordenacao da
@@ -32,7 +46,7 @@ Pausa/orcamento nao equivalem a QA aprovado.
 
 Retorne status, summary e artifacts com caminhos relativos. O Go calcula SHA-256:
 nao transcreva hashes. Falha de finalizacao pode ser revalidada com recover sem IA,
-sem dispensar os checks/reviews/QA posteriores. Nao altere snapshot/estado manualmente.
+sem dispensar os checks e a revisao previstos no snapshot; testes de tela do fluxo enxuto ficam manuais. Nao altere snapshot/estado manualmente.
 
 ## Forma de trabalho
 
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\CLAUDE.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\CLAUDE.md"
index f3ff9bb..156283c 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\CLAUDE.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\CLAUDE.md"	
@@ -6,6 +6,20 @@ complementa-las, mas nao podem dispensar a documentacao obrigatoria nem a base
 didatica descritas aqui.
 
 
+## Fluxo enxuto padrao
+
+Novos lotes: planejador-de-lote + grill-me na mesma sessao; o planejador termina no
+pacote e o usuario inicia context run. Uma worktree por lote, unidades sequenciais,
+checks, uma revisao corretiva de impactos medios/altos/criticos, checks integrados e
+entrega deterministica em revisao/. Sem auditor, review-loop ou QA de tela por IA.
+Os testes de tela sao MANUAIS ao final, com roteiro; DONE tecnico nao e aceite visual.
+O run autoriza commits/branch locais explicitamente propostos no manifesto; nao autoriza
+push, PR, publicacao ou merge em main/master. Fora disso, sem commits sem pedido explicito.
+No planejamento/despacho enxutos, nao preparar/indexar o Node legado. Preservar regras
+de negocio/banco, seguranca, documentacao/lessons, limites, telemetria e retomada.
+Esta politica substitui apenas o encadeamento/gates legados abaixo. Um ciclo de correcao
+e testes; bloqueios reais sao registrados. Runs antigos conservam seu snapshot.
+
 ## Despacho pelo Context Compiler Go
 
 Quando o prompt contiver CONTEXTO_EXECUTION=step, esta secao rege a coordenacao da
@@ -33,7 +47,7 @@ Pausa/orcamento nao equivalem a QA aprovado.
 
 Retorne status, summary e artifacts com caminhos relativos. O Go calcula SHA-256:
 nao transcreva hashes. Falha de finalizacao pode ser revalidada com recover sem IA,
-sem dispensar os checks/reviews/QA posteriores. Nao altere snapshot/estado manualmente.
+sem dispensar os checks e a revisao previstos no snapshot; testes de tela do fluxo enxuto ficam manuais. Nao altere snapshot/estado manualmente.
 
 ## Forma de trabalho
 
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\modelos\\AGENTS.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\modelos\\AGENTS.md"
index 75114be..d20ec01 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\modelos\\AGENTS.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\modelos\\AGENTS.md"	
@@ -1,24 +1,30 @@
-# Instruções essenciais para as skills do fluxo de IA
+# Instruções essenciais para o fluxo de IA
 
-Estas instruções complementam as regras específicas deste projeto; não concedem permissões adicionais.
+Preserve regras específicas do projeto, arquitetura, dados, documentação e autorização.
+Confirme raiz Git, base/branch e escopo; use a instalação real das skills, sem caminhos
+de outra máquina ou convenções de outro projeto.
 
-- Antes de agir, confirme a raiz Git, branch e regras aplicáveis. Em múltiplos repositórios, confirme cada raiz separadamente. Resolva caminhos a partir do projeto e da instalação real das skills, sem reutilizar caminhos de outro ambiente.
-- Ao usar uma skill, leia seu `SKILL.md` e somente as referências necessárias à fase. Preserve `_shared/`, scripts e referências da distribuição. Adapte às ferramentas disponíveis; não presuma comandos exclusivos de outro cliente. Após compactação, releia regras, skill atual e flow status/next; abra somente as referências da próxima ação.
-- Use `workflow` do project.json no armazenamento devolvido pelo helper; configuração legada em `.contexto/project.json` permanece válida. Sem ele, siga convenções existentes e os defaults portáveis das skills. Configure caminhos, comandos de validação e proteção de dados nas regras deste projeto; não altere as skills para cada instalação.
-- Planejamento usa `planejador-de-lote`; execução usa `orquestrador-fluxo-ia` com manifesto. Planejar não autoriza implementar. Pedido explícito de planejar e executar permite encadear ambos. Durante execução autorizada, avance sem checkpoints humanos intermediários, respeitando permissões e bloqueios reais.
-- Respeite perfis de risco, gates, evidências, independência das sessões e limites de correção definidos nas skills. Não simule review/QA independente trocando de papel na mesma sessão. Gate essencial sem evidência ou executor disponível fica bloqueado; preserve a tarefa e continue frentes independentes.
-- Preserve trabalho alheio e segredos. Não implemente em `main`/`master`, não faça push, PR ou publicação externa automaticamente e não adicione dependências silenciosamente. Antes de testes/scripts que toquem banco ou serviços reais, siga a proteção local e comprove isolamento; sem prova, não execute.
-- O Contexto é incluído em `_shared/contexto/`: prepare automaticamente cada raiz/worktree pelo helper `_shared/scripts/preparar-contexto.mjs`, sem instalação de MCP/npm ou init manual. Exija prepared:true; SQLite é local e isolado por raiz, dentro da pasta skills. Não copie bancos/aprovações entre projetos. O runtime controla estados e o cliente chama agentes independentes; leia `_shared/protocolo-v2.md` conforme a fase.
-- Mantenha uma especificação canônica e retornos por referência. Só o coordenador atualiza manifesto/estado durante o lote; Markdown derivado não é uma segunda fonte independente. Feche com registro, validações reais e commits quando autorizados; antes de limpar worktrees, preserve histórico e comprove ownership, Git seguro e ausência de executores.
+O padrão é planejador-de-lote + grill-me na mesma sessão. O planejador consolida
+especificação, unidades e pacote executável e termina no plano. O usuário inicia
+context run; não inicie implementação durante o planejamento.
 
-## Quando a execução é controlada pelo Context Compiler Go
+O runtime Go controla unidades sequenciais, checks, uma revisão corretiva de impactos
+médios/altos/críticos, validação final e entrega local em revisao/. Uma worktree por lote.
+Não chame orquestrador, auditor, review-loop ou QA de tela por IA. Testes de tela e
+aceite visual são manuais ao final; DONE técnico não significa aprovação visual.
 
-Em CONTEXTO_EXECUTION=step, o runtime Go executa o workflow YAML e registra estado,
-limites, resultados, logs e checkpoints. Execute somente o brief do step e não chame
-orquestrador-fluxo-ia, outras skills nem preparação/indexação/process/handoff do Node
-legado. Preserve regras do projeto, segurança, autorização, documentação e gates.
-O planejador-de-lote continua externo. Esta exceção rege apenas coordenação; não
-concede permissão para alterar negócio/arquitetura ou dispensar QA.
-Use fontes incluídas e consulte referências adicionais sob demanda. Não carregue
-catálogos, lockfiles, logs ou diffs inteiros. Retorne artefatos por caminho: o Go
-calcula SHA-256. Em retomada preserve a worktree e execute apenas o que falta.
\ No newline at end of file
+No despacho CONTEXTO_EXECUTION=step, execute somente o brief e referências pertinentes.
+Não faça preparação/indexação/process do Node legado. Não leia catálogos/lockfiles/logs
+inteiros. O Go calcula hashes e registra limites, logs, métricas e checkpoints.
+Na retomada, preserve trabalho existente e não repita o que já passou.
+
+O run autoriza somente ações locais previstas explicitamente no manifesto, incluindo
+commits e branch de revisão. Sem push, PR, publicação ou merge automático em main/master.
+Não exponha segredos nem acesse dados reais sem isolamento comprovado.
+
+Um ciclo de correções/testes; lacuna essencial ou risco sem solução autorizada bloqueia
+com diagnóstico preciso. Skills não ampliam permissões do host. Configuração externa,
+fontes, caminhos de documentos/checks e restrições pertencem às regras deste projeto.
+
+Modo custom/legado só por pedido explícito; não migre snapshots/runs antigos silenciosamente.
+Ao editar skills, altere a fonte e sincronize as cópias pelo instalador da distribuição.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\modelos\\CLAUDE.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\modelos\\CLAUDE.md"
index 75114be..d20ec01 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\modelos\\CLAUDE.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\modelos\\CLAUDE.md"	
@@ -1,24 +1,30 @@
-# Instruções essenciais para as skills do fluxo de IA
+# Instruções essenciais para o fluxo de IA
 
-Estas instruções complementam as regras específicas deste projeto; não concedem permissões adicionais.
+Preserve regras específicas do projeto, arquitetura, dados, documentação e autorização.
+Confirme raiz Git, base/branch e escopo; use a instalação real das skills, sem caminhos
+de outra máquina ou convenções de outro projeto.
 
-- Antes de agir, confirme a raiz Git, branch e regras aplicáveis. Em múltiplos repositórios, confirme cada raiz separadamente. Resolva caminhos a partir do projeto e da instalação real das skills, sem reutilizar caminhos de outro ambiente.
-- Ao usar uma skill, leia seu `SKILL.md` e somente as referências necessárias à fase. Preserve `_shared/`, scripts e referências da distribuição. Adapte às ferramentas disponíveis; não presuma comandos exclusivos de outro cliente. Após compactação, releia regras, skill atual e flow status/next; abra somente as referências da próxima ação.
-- Use `workflow` do project.json no armazenamento devolvido pelo helper; configuração legada em `.contexto/project.json` permanece válida. Sem ele, siga convenções existentes e os defaults portáveis das skills. Configure caminhos, comandos de validação e proteção de dados nas regras deste projeto; não altere as skills para cada instalação.
-- Planejamento usa `planejador-de-lote`; execução usa `orquestrador-fluxo-ia` com manifesto. Planejar não autoriza implementar. Pedido explícito de planejar e executar permite encadear ambos. Durante execução autorizada, avance sem checkpoints humanos intermediários, respeitando permissões e bloqueios reais.
-- Respeite perfis de risco, gates, evidências, independência das sessões e limites de correção definidos nas skills. Não simule review/QA independente trocando de papel na mesma sessão. Gate essencial sem evidência ou executor disponível fica bloqueado; preserve a tarefa e continue frentes independentes.
-- Preserve trabalho alheio e segredos. Não implemente em `main`/`master`, não faça push, PR ou publicação externa automaticamente e não adicione dependências silenciosamente. Antes de testes/scripts que toquem banco ou serviços reais, siga a proteção local e comprove isolamento; sem prova, não execute.
-- O Contexto é incluído em `_shared/contexto/`: prepare automaticamente cada raiz/worktree pelo helper `_shared/scripts/preparar-contexto.mjs`, sem instalação de MCP/npm ou init manual. Exija prepared:true; SQLite é local e isolado por raiz, dentro da pasta skills. Não copie bancos/aprovações entre projetos. O runtime controla estados e o cliente chama agentes independentes; leia `_shared/protocolo-v2.md` conforme a fase.
-- Mantenha uma especificação canônica e retornos por referência. Só o coordenador atualiza manifesto/estado durante o lote; Markdown derivado não é uma segunda fonte independente. Feche com registro, validações reais e commits quando autorizados; antes de limpar worktrees, preserve histórico e comprove ownership, Git seguro e ausência de executores.
+O padrão é planejador-de-lote + grill-me na mesma sessão. O planejador consolida
+especificação, unidades e pacote executável e termina no plano. O usuário inicia
+context run; não inicie implementação durante o planejamento.
 
-## Quando a execução é controlada pelo Context Compiler Go
+O runtime Go controla unidades sequenciais, checks, uma revisão corretiva de impactos
+médios/altos/críticos, validação final e entrega local em revisao/. Uma worktree por lote.
+Não chame orquestrador, auditor, review-loop ou QA de tela por IA. Testes de tela e
+aceite visual são manuais ao final; DONE técnico não significa aprovação visual.
 
-Em CONTEXTO_EXECUTION=step, o runtime Go executa o workflow YAML e registra estado,
-limites, resultados, logs e checkpoints. Execute somente o brief do step e não chame
-orquestrador-fluxo-ia, outras skills nem preparação/indexação/process/handoff do Node
-legado. Preserve regras do projeto, segurança, autorização, documentação e gates.
-O planejador-de-lote continua externo. Esta exceção rege apenas coordenação; não
-concede permissão para alterar negócio/arquitetura ou dispensar QA.
-Use fontes incluídas e consulte referências adicionais sob demanda. Não carregue
-catálogos, lockfiles, logs ou diffs inteiros. Retorne artefatos por caminho: o Go
-calcula SHA-256. Em retomada preserve a worktree e execute apenas o que falta.
\ No newline at end of file
+No despacho CONTEXTO_EXECUTION=step, execute somente o brief e referências pertinentes.
+Não faça preparação/indexação/process do Node legado. Não leia catálogos/lockfiles/logs
+inteiros. O Go calcula hashes e registra limites, logs, métricas e checkpoints.
+Na retomada, preserve trabalho existente e não repita o que já passou.
+
+O run autoriza somente ações locais previstas explicitamente no manifesto, incluindo
+commits e branch de revisão. Sem push, PR, publicação ou merge automático em main/master.
+Não exponha segredos nem acesse dados reais sem isolamento comprovado.
+
+Um ciclo de correções/testes; lacuna essencial ou risco sem solução autorizada bloqueia
+com diagnóstico preciso. Skills não ampliam permissões do host. Configuração externa,
+fontes, caminhos de documentos/checks e restrições pertencem às regras deste projeto.
+
+Modo custom/legado só por pedido explícito; não migre snapshots/runs antigos silenciosamente.
+Ao editar skills, altere a fonte e sincronize as cópias pelo instalador da distribuição.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\auditor-de-review\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\auditor-de-review\\SKILL.md"
index 6790ff1..e336962 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\auditor-de-review\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\auditor-de-review\\SKILL.md"	
@@ -3,6 +3,9 @@ name: auditor-de-review
 description: Audita achados de code review contra código, especificação e regras de negócio; decide APLICAR, ADIAR ou REJEITAR com evidência. Use no ciclo do orquestrador ou para auditar um relatório; não implementa nem substitui QA.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Auditor de review
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Audite os achados e devolva as decisões por ID; não dispare a etapa de correção.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\grill-me\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\grill-me\\SKILL.md"
index 3e28788..670706d 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\grill-me\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\grill-me\\SKILL.md"	
@@ -7,6 +7,8 @@ description: Entrevista requisitos de uma demanda ou lote até esclarecer decis
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Questões que dependam do usuário deixam a etapa `BLOCKED`, com as perguntas no relatório; não presuma respostas numa execução headless.
 
+No planejamento enxuto, participe na mesma sessão do planejador. Não execute preparação/indexação/process do Node legado nem abra outro agente. Telemetria de planejamento não exposta permanece desconhecida; o runtime registra a execução posterior.
+
 ## Registro de execução e contexto compacto
 
 Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).
@@ -23,4 +25,4 @@ Pergunte em português, uma decisão relevante por vez, sobre resultado esperado
 
 Registre decisões, hipóteses, questões abertas, exemplos Dado/Quando/Então e fora do escopo. Não implemente nem crie arquitetura durante a entrevista. Sem resposta essencial, preserve a questão e não declare o requisito resolvido.
 
-No fluxo do planejador-de-lote, devolva a entrevista ao coordenador, que carrega tech-lead assim que houver informação suficiente. Se chamada diretamente para planejar uma demanda Intranet, faça o mesmo handoff automático para tech-lead e depois worktree-planner, sem começar a implementação. Fora desse fluxo, entregue as decisões e perguntas restantes.
+No fluxo do planejador-de-lote, devolva a entrevista ao próprio planejador, na mesma sessão. Ele consolida especificação, unidades, checks e pacote executável. Não chame tech-lead/worktree-planner automaticamente. Perguntas essenciais pertencem ao planejamento; o run posterior não deve depender de nova entrevista. Na chamada direta, entregue decisões e perguntas restantes sem iniciar implementação.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\implementador-de-ticket\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\implementador-de-ticket\\SKILL.md"
index 9a7ea92..5601816 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\implementador-de-ticket\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\implementador-de-ticket\\SKILL.md"	
@@ -1,253 +1,48 @@
 ---
 name: implementador-de-ticket
-description: >
-  Implementa um ticket técnico previamente especificado pelo Tech Lead,
-  respeitando arquitetura, ADRs, escopo, testes, segurança e documentação.
-  Use para executar uma tarefa específica do backlog sem redesenhar ou expandir
-  silenciosamente o sistema.
+description: Implementa uma unidade técnica especificada com testes, segurança e documentação. No fluxo enxuto, trabalha na worktree do runtime e devolve evidências, sem coordenar outras etapas.
 ---
 
-# Implementador de Ticket
+# Implementador de ticket
 
-Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Implemente somente a etapa recebida e devolva suas evidências ao runtime.
+No despacho CONTEXTO_EXECUTION=step, siga o [contrato Go](../_shared/context-compiler.md).
+Para novos lotes vale o [fluxo enxuto](../_shared/fluxo-enxuto.md).
 
-## Registro de execução e contexto compacto
+## Executar uma unidade
 
-Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).
+Use o brief aprovado: objetivo, escopo, exclusões, critérios, contratos, referências e
+checks. Confirme worktree/base e regras aplicáveis. Leia arquivos/testes pertinentes;
+amplie a investigação somente diante de uma dependência concreta. Não reabra entrevista,
+não leia catálogos/lockfiles inteiros e não planeje novamente o lote.
 
-## Contexto proporcional e modos
+Preserve arquitetura, ADRs, limites de domínio, dados e convenções existentes.
+Implemente somente o necessário; não introduza biblioteca, refatoração ou mudança
+arquitetural fora do escopo. Problema adicional vira follow-up. Lacuna essencial ou
+conflito de negócio/arquitetura fica BLOCKED com motivo, impacto e referências.
 
-No despacho Go, use o brief compilado e o contrato compartilhado; referências adicionais são sob demanda. Fora desse modo, use o [protocolo V2](../_shared/protocolo-v2.md) e o pacote do papel implementer. Na implementação inicial, leia regras aplicáveis, especificação canônica, critérios, contratos/ADRs citados e arquivos/testes relacionados; amplie a investigação quando encontrar uma dependência concreta. A lista abaixo é checklist de pertinência, não ordem para ler todo domínio/API/banco de todo projeto.
+Verifique os riscos concretos da alteração: autenticação/autorização, tenant, validação,
+segredos, logs e entradas externas. Em migrations, avalie compatibilidade, dados existentes,
+locks/volume, rollback e sequência de deploy. Não acesse banco real sem isolamento comprovado.
 
-Em correção focal, receba IDs APLICAR ou bugs de QA autorizados, evidências, commits e raio de impacto. Não refaça entrevista/planejamento nem amplie escopo silenciosamente. Preserve IDs e execute regressões afetadas. Fora do despacho Go, use fechar-entrega na mesma sessão, em ENTREGA_INICIAL ou CORRECAO conforme o caso; simplificação ampla permanece opcional. Devolva evento estruturado e caminhos, não o histórico da conversa.
+Implemente testes exigidos pelos aceites e pelos riscos descobertos. Execute formatter,
+lint, tipos, testes de código/API/integração e build aplicáveis ao escopo. Corrija falhas
+pertinentes dentro do orçamento; não simule resultado nem crie ciclo infinito. Testes
+de tela serão manuais no final; não abra QA de tela por IA.
 
-Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.
+Atualize documentação afetada, registro de entrega e lessons conforme regras do projeto,
+sem conteúdo artificial. Registre mudanças, decisões, migrations, verificações reais,
+riscos e follow-ups. Para cada aceite: ATENDIDO, NÃO ATENDIDO ou NÃO VALIDADO.
 
-## Papel
+## Limites e retorno
 
-Atue como Senior Software Engineer.
+Na retomada preserve arquivos e inspecione o que falta; não recomece automaticamente.
+Não chame orquestrador, auditor, review-loop-driver, QA, preparação Node ou outras IAs.
+Não faça commits/merges no step: a entrega determinística posterior cuida do Git.
+Autorrevisão não é aprovação independente nem aceite visual.
 
-Sua responsabilidade é implementar UM ticket.
+Entregue relatório e JSON do runtime com caminhos relativos, sem transcrever hashes.
+PASS exige implementação, testes essenciais e documentação comprovados no seu escopo;
+não significa que os gates posteriores ou testes manuais já foram concluídos.
 
-Fora do despacho Go, em worktree com estas skills, confira o recibo de preparação e execute o helper de [worktrees automáticas](../_shared/worktrees-automaticas.md) se o criador ainda não o fez. Use a raiz desta worktree; não peça init ao usuário nem use banco de outro checkout.
-
-Não planeje o projeto inteiro.
-
-Não altere arquitetura sem autorização.
-
----
-
-# Antes de programar
-
-Ler:
-
-1. AGENTS.md;
-2. ticket;
-3. ADRs citados;
-4. arquitetura citada;
-5. domínio;
-6. API;
-7. banco;
-8. código existente;
-9. testes relacionados;
-10. tickets dependentes já implementados.
-
----
-
-# Validar o ticket
-
-Confirmar internamente:
-
-- objetivo;
-- escopo;
-- fora do escopo;
-- dependências;
-- critérios de aceite;
-- testes;
-- impacto de banco;
-- impacto de segurança;
-- documentação.
-
----
-
-# Analisar antes de modificar
-
-Localizar:
-
-- código relacionado;
-- padrões existentes;
-- abstrações já utilizadas;
-- testes existentes;
-- integrações relacionadas.
-
-Preferir consistência com o projeto a introduzir novo padrão.
-
----
-
-# Escopo
-
-Implementar somente o necessário.
-
-Não aproveitar o ticket para:
-
-- grandes refatorações;
-- renomeações globais;
-- troca de biblioteca;
-- mudança arquitetural;
-- melhoria não relacionada.
-
-Quando encontrar problema adicional:
-
-registrar como follow-up.
-
----
-
-# Arquitetura
-
-Respeitar:
-
-- ADRs;
-- boundaries;
-- domínio;
-- contratos;
-- ownership de dados;
-- padrões do projeto.
-
-Se a implementação exigir violar arquitetura:
-
-PARAR a mudança arquitetural.
-
-Documentar:
-
-CONFLITO ARQUITETURAL
-
-Motivo
-
-Impacto
-
-Alternativas
-
-ADR afetado
-
-Recomendação
-
----
-
-# Banco
-
-Antes de migration avaliar:
-
-- compatibilidade;
-- dados existentes;
-- lock;
-- volume;
-- índice;
-- rollback;
-- sequência de deploy.
-
----
-
-# Segurança
-
-Verificar:
-
-- autenticação;
-- autorização;
-- validação;
-- tenant;
-- exposição de dados;
-- secrets;
-- logs;
-- injection;
-- uploads;
-- webhooks.
-
----
-
-# Testes
-
-Implementar todos os testes requeridos pelo ticket.
-
-Além disso adicionar testes necessários para riscos descobertos durante a implementação.
-
----
-
-# Validação
-
-Executar quando disponível:
-
-- formatter;
-- lint;
-- análise estática;
-- unit tests;
-- integration tests;
-- testes específicos;
-- build.
-
-Não declarar sucesso se testes relevantes falharem.
-
----
-
-# Documentação
-
-Atualizar documentação afetada.
-
-Registrar implementação quando o padrão do projeto exigir.
-
-Atualizar lessons quando existir conceito técnico relevante para aprendizado.
-
----
-
-# Limite de responsabilidade
-
-Implemente e valide no escopo autorizado. Revisão própria não equivale a revisão independente ou aprovação de QA. Entregue evidências para esses papéis; não declare DONE enquanto gates exigidos estiverem pendentes. Commit e fechamento seguem o pedido e as regras locais, sem acionar convenções da Intranet em outros projetos. Uma correção recebida de QA mantém o ID do bug e exige verificar o estado atual antes de aplicar o plano. Correções de code review são recebidas pelo review-loop-driver: no lote, aplique somente IDs APLICAR decididos pelo auditor-de-review e vinculados ao HEAD atual; fora dele, somente os IDs autorizados pelo usuário. Não audite nem aprove sua própria correção. Devolva commit e validações ao orquestrador; conflito de negócio ou arquitetura retorna como bloqueio, sem pedir confirmação intermediária no lote.
-
-# Entrega
-
-Ao finalizar gerar:
-
-## Ticket
-
-## Resumo da implementação
-
-## Arquivos alterados
-
-## Decisões tomadas
-
-## Migrations
-
-## Testes criados
-
-## Testes executados
-
-## Resultado dos testes
-
-## Critérios de aceite
-
-Para cada:
-
-ATENDIDO / NÃO ATENDIDO / NÃO VALIDADO
-
-## Riscos
-
-## Débito técnico descoberto
-
-## Follow-ups
-
-## Pronto para Code Review?
-
-SIM / NÃO
-
----
-
-# Regra
-
-Não confundir:
-
-"implementei"
-
-com
-
-"entreguei".
-
-A entrega inclui código + testes + documentação + validação.
+Fora do despacho Go, implemente somente o ticket autorizado, preservando regras locais,
+autorizações e critérios acima. Não encadeie automaticamente outros papéis.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\orquestrador-fluxo-ia\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\orquestrador-fluxo-ia\\SKILL.md"
index 7d44ccb..0f78b22 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\orquestrador-fluxo-ia\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\orquestrador-fluxo-ia\\SKILL.md"	
@@ -3,6 +3,9 @@ name: orquestrador-fluxo-ia
 description: Entrada de compatibilidade para executar um plano pelo Context Compiler Go. A coordenação pertence ao runtime; o fluxo Node V2 só se aplica quando o usuário pedir explicitamente modo legado.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Orquestrador do fluxo de IA
 
 ## Entrada de compatibilidade do Context Compiler Go
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\SKILL.md"
index 22b0ca4..b13fb69 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\SKILL.md"	
@@ -1,47 +1,65 @@
 ---
 name: planejador-de-lote
-description: Planeja uma ou mais demandas com grill-me, tech-lead e worktree-planner e entrega automaticamente manifesto, workflow e catálogo validados para o Context Compiler. Use para iniciar ou revisar um lote; planejamento não inicia implementação.
+description: Planeja um lote com entrevista grill-me e entrega manifesto executável para o Context Compiler, com tarefas proporcionais, checks, revisão corretiva única e roteiro manual de tela. Planejamento termina no plano; o usuário inicia run.
 ---
 
 # Planejador de lote
 
-Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Nesse caso não encadeie grill-me, tech-lead ou worktree-planner: o YAML define essas etapas. Na chamada direta do usuário, preserve o encadeamento de planejamento abaixo.
-
-## Entrega para o Context Compiler Go
-
-A chamada normal já exige o pacote completo para o compilador: manifesto Markdown com cabeçalho e especificação essencial, workflow YAML e catálogo bindings YAML. Não espere o usuário pedir esses arquivos nem entregue apenas um plano de texto para ele adaptar. A exceção é o modo legado V2 solicitado explicitamente, que mantém seu contrato próprio.
-
-Leia o [contrato de saída e geração automática](references/pacote-context-compiler.md) e use [gerar-pacote-go.mjs](scripts/gerar-pacote-go.mjs) para publicar os três arquivos. O helper verifica projeto/caminhos, gera o cabeçalho e só publica após `plan validate` e `run --dry-run` aprovados pelo compilador real. Você prepara e executa essa geração como parte do planejamento; o usuário recebe o manifesto pronto e o comando de execução.
-
-Resolva o projeto, executoras, providers, comandos, condições, critérios e dependências com os fatos coletados no planejamento. Para cada etapa skill, gere bindings.step_contexts com ticket_id, objective, scope, acceptance e referências required/initial/available relativas à raiz do projeto. Inclua a especificação essencial daquele papel em instructions. Configure execution.profile=compiled e limites finitos. USD nativo só é suportado no Claude; não configure esse limite global em lote com outros providers. Divida tarefas que não cabem no orçamento, preservando gates. Preserve a configuração explícita do projeto. Sem catálogo existente, cadastre as executoras verificadas no mesmo acervo desta skill. Não copie caminhos de outro computador, invente comandos ou peça ao usuário que monte o pacote manualmente.
-
-O workflow começa nas etapas executoras e não repete entrevista/planejamento nem usa `orquestrador-fluxo-ia` como coordenador. Dados essenciais ausentes, ferramenta indisponível ou capacidade não suportada deixam a entrega bloqueada, com motivo explícito; nunca declare `ready` por ter apenas escrito os arquivos. Não altere gates para esconder um bloqueio. Planejar não inicia a execução do workflow.
-
-## Registro de execução e contexto compacto
-
-Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).
-
-## Artefatos de planejamento e compatibilidade
-
-Persista decisões, origem e referências em `planning-context.json` por lote. No fluxo Go, o contrato executável é o Markdown com cabeçalho, workflow e catálogo descritos acima; não gere um segundo manifesto operacional incompatível. Preserve bases completas, caminhos reais, DAG, critérios por ID e grupos por repositório nos artefatos de planejamento. O manifesto JSON e o [protocolo V2](../_shared/protocolo-v2.md) são exigidos apenas no modo legado V2 explícito. Planeje fontes existentes na base; arquivos novos serão cobertos pelo snapshot Git. Não reexplore o repositório inteiro a cada demanda; atualize fatos apenas quando seus hashes/referências mudarem. Gerar os artefatos não inicia execução.
-
-Entrada do planejamento para Claude, Antigravity e Codex. Leia [configuração por projeto](../_shared/perfil-projeto.md), regras locais e [execução portátil](../_shared/execucao-portavel.md). Carregar uma skill significa ler seu SKILL.md e seguir suas instruções com as ferramentas disponíveis; não depende de um comando exclusivo de um cliente.
-
-Leia [perfis de risco](../_shared/perfis-de-risco.md) e [contexto e automação](../_shared/contexto-e-automacao.md). Classifique cada tarefa como simples/padrao/critico e registre justificativa, critérios e gates aplicáveis. Preserve controles de banco/Git em todos os perfis. Não use o tamanho do diff como classificação de risco.
-
-## Encadeamento
-
-1. Identifique as demandas selecionadas pelo usuário, com IDs/links quando existirem. Consulte fontes conectadas e o código antes de perguntar. ClickUp é opcional; sem vínculo, gere uma chave local estável e registre “não possui ID vinculado”, sem inventar ticket externo.
-2. Carregue **grill-me** para esclarecer objetivo, comportamento atual, regras de negócio, bordas e fora do escopo do lote. Pergunte o que só o usuário pode decidir. Reutilize respostas e fatos documentados entre demandas; registre hipóteses e questões em aberto. Não confunda falta de requisito com permissão para inventá-lo.
-3. Assim que a entrevista permitir critérios observáveis, carregue **tech-lead** automaticamente com todas as respostas. Ele produz tickets e dependências, sem iniciar implementação. Questões essenciais não resolvidas deixam a tarefa BLOQUEADA_NO_PLANEJAMENTO; continue as demais.
-4. Ao concluir os tickets, carregue **worktree-planner** automaticamente para preparar cada feature. Ele usa a especificação já produzida, sem repetir a entrevista, e grava planos, prompts e estados. Não peça ao usuário para invocar essas etapas.
-5. Consolide o manifesto na pasta de planos configurada, com data/fuso do projeto (Intranet: `{FONTE_CLAUDE}/worktrees/AAAA-MM-DD/lote-AAAA-MM-DD-{slug}.md` e America/Sao_Paulo). Use slug estável do lote; em colisão, reutilize só se for retomada do mesmo lote, senão acrescente sufixo. Nunca sobrescreva outro lote do dia.
-6. Monte a entrada do helper com a especificação aprovada, o workflow e o catálogo completos. Gere e valide o pacote automaticamente conforme o contrato de saída. A chamada normal termina com os três arquivos publicados e validados ou um bloqueio preciso, sem exigir um prompt adicional do usuário.
-
-Manifesto: identificador do lote; data/fuso; demandas incluídas/excluídas; referências de especificações/estados; por tarefa: chave, ID externo opcional, camadas, perfil/justificativa, critérios observáveis e seus IDs, dependências e status; grafo sem ciclos; ordem de execução/integração; mapeamento de step para ticket/critério; base ref + SHA por repositório; branch de revisão por grupo; recursos necessários e riscos. Inclua os requisitos essenciais para executar sem a conversa anterior, sem duplicar integralmente documentos auxiliares. Use o prefixo de revisão configurado (default revisao/AAAA-MM-DD-{slug}), com sufixos -2, -3 apenas para grupos incompatíveis. Todos os planos referenciam este mesmo manifesto.
-
-## Conclusão
-
-No fluxo Go, marque PRONTA_PARA_ORQUESTRAR somente a tarefa com critérios essenciais, contratos e planos definidos e pacote publicado com `ready: true` pelo helper após validação real. Não marque especificação como aprovada pelo usuário se apenas foi inferida: registre a origem de cada decisão. Distingua prontidão técnica de autorização para executar.
-
-Entregue os caminhos do manifesto, workflow e catálogo, as validações realizadas, resumo e pendências e o comando `contexto run CAMINHO_ABSOLUTO_DO_MANIFESTO.md`. Use o executável absoluto se estiver fora do PATH e acrescente `--with` somente quando solicitado; por padrão valem os providers por etapa. **Planejar não inicia execução.** Se o usuário já pediu explicitamente planejar e executar, rode o comando com `--yes` após validar o plano, sem chamar uma LLM orquestradora. Fora disso, encerre no plano pronto. A execução usa as etapas e autorizações declaradas no workflow; não implique push/PR nem publicação externa. O runtime V2 anterior só deve ser utilizado quando o usuário pedir explicitamente o modo legado.
+## Contrato padrão
+
+Use o [fluxo enxuto](../_shared/fluxo-enxuto.md). O usuário participa do planejamento e
+depois inicia context run com o manifesto. Não execute run ao terminar o planejamento.
+No despacho CONTEXTO_EXECUTION=step, execute apenas seu papel e o
+[contrato Go](../_shared/context-compiler.md); não entreviste nem encadeie outras skills.
+
+1. Confirme projeto, regras, branch/base SHA e ferramentas existentes. Consulte somente
+   fontes relevantes. Reutilize planning-context.json quando vigente; não reexplore todo
+   o repositório nem reutilize caminhos de outro computador.
+2. Chame grill-me na mesma sessão para esclarecer decisões essenciais, permissões,
+   comportamento esperado, critérios observáveis e fora de escopo. Ele devolve ao
+   planejador. Perguntas de produto ficam nesta fase; não as adie para o run.
+3. Com a entrevista, produza você mesmo a especificação e as unidades de execução.
+   Não encadeie tech-lead ou worktree-planner nem abra agentes para repetir o planejamento.
+   Registre origem das decisões, hipóteses e lacunas. Ausência essencial mantém o plano bloqueado.
+4. Agrupe tarefas pequenas/dependentes numa unidade coerente. Cada unidade deve caber
+   nos limites de uma sessão e ter checks reais. O padrão é uma worktree isolada por
+   lote, execução sequencial. Não crie uma worktree por arquivo/ticket nem paralelismo
+   sem benefício comprovado. A ordem de units respeita dependências.
+5. Defina contratos entre unidades, escopo de arquivos, risco 0..4 e aceites. Escolha
+   os checks pertinentes e um conjunto final integrado. Testes de tela serão manuais:
+   prepare cenários e pré-condições, sem etapa de QA de tela por IA.
+6. Prepare um brief consolidado para UMA revisão corretiva independente de impacto
+   crítico/alto/médio. Inclua base SHA/diff, critérios essenciais, contratos e comandos
+   de teste. Não crie auditor, review-loop-driver ou QA independente no fluxo padrão.
+   Dispensa só para todas as unidades R0 e justificativa explícita.
+7. Gere o [pacote completo](references/pacote-context-compiler.md) pelo
+   [helper](scripts/gerar-pacote-go.mjs). Ele monta o DAG enxuto, valida os briefs e usa
+   o compilador real em plan validate e run --dry-run. Publique somente se ambos passarem.
+
+## Conteúdo suficiente para executar
+
+Um manifesto canônico registra objetivo, exclusões, decisões, base SHA, autorizações,
+unidades e dependências, critérios por ID, contratos, verificações reais e roteiro manual.
+Cada unidade recebe seu brief com ticket_id, objective, scope, acceptance e instructions,
+mais required/initial/available. Instruções devem permitir implementar sem esta conversa;
+não copie a especificação inteira do lote a cada step.
+
+Regras do projeto e requisitos essenciais são obrigatórios. Available é consulta sob
+demanda; initial pode ser omitido pelo orçamento. Não inclua segredos, lockfiles inteiros,
+catálogos ou documentação sem relação com o papel. Tarefa grande deve ser decomposta
+por comportamento/contrato, preservando critérios e sem fragmentar excessivamente.
+
+## Entrega e autorização
+
+A proposta declara commits locais e branch revisao/ como parte da execução, sem push,
+PR, publicação ou merge em main/master. O usuário autoriza essa proposta ao iniciar run;
+não acrescente checkpoints humanos intermediários. Bloqueios reais de requisito, segurança,
+ambiente ou orçamento são registrados precisamente; não invente solução para manter o fluxo.
+
+Entregue manifesto, workflow e bindings, validações e comando context run CAMINHO --yes,
+com --with somente se solicitado. Mesmo com plano pronto, não inicie implementação.
+No fim do run, a entrega técnica terá roteiro PENDENTE_DE_TESTES_MANUAIS_DE_TELA;
+isso não significa aceite visual nem aprovação humana.
+
+O modo custom/legado só é usado se solicitado explicitamente. Não o selecione para
+contornar validações do perfil enxuto. Snapshots de runs existentes permanecem imutáveis.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"
index 9fa4300..511b8bf 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"	
@@ -1,117 +1,125 @@
-# Saída obrigatória do planejador para o Context Compiler
+# Pacote executável do fluxo enxuto
 
-Esta é a entrega padrão da chamada normal da skill. O usuário não precisa solicitar
-cabeçalho, YAML ou catálogo. Planejar continua sem iniciar implementação.
+O planejador publica manifesto Markdown, workflow YAML e bindings YAML. O usuário só
+precisa iniciar context run depois. O helper monta o DAG: unidades sequenciais e checks,
+uma revisão corretiva, checks integrados, entrega local. Não abre IA nem executa o lote
+durante o planejamento. Não inclui approval/wait_event/QA de tela.
 
-## Arquivos finais
+## Entrada do helper
 
-Para um lote `lote-X`, entregue juntos:
-
-- `lote-X.md`: manifesto legível com cabeçalho `contexto` e corpo aprovado.
-- `lote-X.workflow.yaml`: todas as etapas executoras, dependências, condições e providers.
-- `lote-X.bindings.yaml`: caminhos reais das skills, executores, argv dos comandos e valores.
-
-Use a pasta de planos do projeto e nomes exclusivos do lote. Caminhos do cabeçalho são
-relativos ao manifesto; o helper grava o projeto e as skills com caminhos reais absolutos
-do computador atual. Referências do JSON de entrada são relativas à pasta desse JSON.
-Não reaproveite caminhos de outro computador nem invente comandos de teste.
-
-O corpo do manifesto deve permitir executar sem a conversa anterior: identidade do lote,
-objetivo, escopo/exclusões, decisões e origem da aprovação; por ticket, IDs, comportamento,
-critérios observáveis, arquivos/contratos, dependências, validações e risco justificado;
-raiz/base ref/SHA verificados, ordem e mapeamento **step ID → ticket/critério**; recursos,
-preparação do ambiente na worktree, autorizações e bloqueios. Inclua o conteúdo essencial
-da especificação. Links auxiliares devem ser verificáveis; o runtime envia o brief do step em step_contexts, não a conversa inteira nem todos os tickets.
-
-O workflow começa depois do planejamento. Não inclua `planejador-de-lote`, entrevista ou
-uma LLM orquestradora novamente. Cadastre cada executora por referência qualificada e
-versão. Reutilize o catálogo explícito do projeto; se não existir, verifique os SKILL.md
-no mesmo acervo desta skill e registre seus caminhos. Não exija que o usuário monte o catálogo.
-
-Configure checks conforme os scripts e ferramentas do projeto, incluindo preparação de
-dependências que não existem em uma worktree nova. Todo `command_ref` precisa de argv no
-catálogo; toda `skill_ref` precisa de arquivo real e `executor_ref` cadastrado. Todo ref
-de condição deve apontar para uma etapa existente ou uma chave de `bindings.values`.
-
-No workflow software, checks permanecem obrigatórios; configure review por risco e QA em
-R3/R4. Expresse o risco numericamente (0..4), conforme a classificação verificada. Use
-concorrência 1 para mutações na mesma worktree enquanto não houver isolamento por ticket.
-Se faltarem dados essenciais ou o fluxo exigir uma capacidade ainda não conectada ao
-runtime, registre o bloqueio em vez de retirar gates ou marcar um plano incompleto como ready.
-
-## Geração e validação automática
-
-Grave `pacote-planejamento.json` como entrada do helper. Ele reaproveita o planejamento,
-não toma decisões de produto. Exemplo mínimo de formato, a substituir pelos fatos reais:
+Grave um JSON com os fatos verificados do planejamento:
 
 ```json
 {
   "schema_version": 1,
   "status": "ready",
-  "title": "Identificador e objetivo do lote",
+  "flow_profile": "enxuto-v1",
+  "title": "Lote identificado",
   "project_root": "CAMINHO_REAL_DO_PROJETO",
   "isolation": "worktree",
   "body_file": "especificacao-aprovada.md",
-  "workflow": {
-    "schema_version": 1,
-    "workflow": {"id": "software/execucao", "version": 1, "trigger": "manual"},
-    "steps": [
-      {"id": "implementar", "type": "skill", "skill_ref": "software/implementador-de-ticket@v1", "executor_ref": "codex/subscription"},
-      {"id": "checks", "type": "command", "depends_on": ["implementar"], "command_ref": "project/checks"}
-    ]
+  "workflow_ref": {"id": "software/lote-identificado", "version": 1},
+  "local_git_authorized": true,
+  "delivery_branch": "revisao/lote-identificado",
+  "implementation_executor": "claude/subscription",
+  "review_executor": "claude/subscription",
+  "units": [{
+    "id": "t1",
+    "ticket_id": "T1",
+    "risk_level": 3,
+    "objective": "Comportamento aprovado",
+    "scope": ["Arquivos e contratos pertinentes"],
+    "acceptance": ["AC-1: critério verificável"],
+    "instructions": "Regras, contratos, decisões e verificações essenciais desta unidade",
+    "required": [],
+    "initial": [],
+    "available": [],
+    "checks": ["project/check-unit"]
+  }],
+  "review_context": {
+    "ticket_id": "LOTE-REVIEW",
+    "objective": "Conferir e corrigir impactos médios/altos/críticos do conjunto",
+    "scope": ["Diff do lote e contratos afetados"],
+    "acceptance": ["Nenhum problema demonstrado médio/alto/crítico pendente"],
+    "instructions": "Base SHA REAL; critérios consolidados; superfícies críticas; comandos de testes e fontes pertinentes",
+    "required": [],
+    "initial": [],
+    "available": []
   },
+  "final_checks": ["project/check-integrated"],
+  "manual_screen_tests": ["Pré-condição e cenário de tela com resultado esperado"],
   "bindings": {
     "schema_version": 1,
-    "max_concurrency": 1,
-    "execution": {"profile": "compiled", "effort": "medium", "limits": {"timeout_seconds": 1200, "max_turns": 40, "max_tool_calls": 80, "max_total_tokens": 2000000, "max_context_tokens": 64000, "max_prompt_tokens": 12000}},
-    "step_contexts": {"implementar": {"ticket_id": "T1", "objective": "Objetivo aprovado", "scope": ["Escopo deste papel"], "acceptance": ["AC-1: resultado observável"], "instructions": "Requisitos e decisões essenciais desta etapa", "required": [], "initial": [], "available": []}},
-    "skills": {"software/implementador-de-ticket@v1": "CAMINHO_REAL_DO_SKILL_MD"},
-    "executors": {"codex/subscription": {"provider": "codex"}},
-    "commands": {"project/checks": ["COMANDO_REAL", "ARGUMENTOS_REAIS"]},
-    "values": {"task.final_risk_level": 0}
+    "execution": {"profile": "compiled", "effort": "medium"},
+    "skills": {
+      "software/implementador-de-ticket@v1": "CAMINHO_REAL_DA_SKILL",
+      "software/revisor-de-codigo@v1": "CAMINHO_REAL_DA_SKILL"
+    },
+    "executors": {"claude/subscription": {"provider": "claude"}},
+    "commands": {
+      "project/check-unit": ["COMANDO_REAL", "ARGUMENTOS"],
+      "project/check-integrated": ["COMANDO_REAL", "ARGUMENTOS"]
+    },
+    "values": {}
   }
 }
 ```
 
-Esse exemplo apenas mostra o contrato; não é um workflow padrão para todos os riscos.
-Pode usar `body` com texto em vez de `body_file`, nunca ambos. Preserve os artefatos de
-decisão já produzidos e reutilize-os; não gere documentação duplicada sem necessidade.
+O exemplo mostra formato, não comandos/caminhos reais. Resolve-os pelo repositório.
+body ou body_file, nunca ambos. Localize as skills do mesmo acervo e a CLI Go, sem
+pedir ao usuário para montar o catálogo. Cada unidade tem checks não vazios.
+depends_on pode referir unidades anteriores; o padrão executa em sequência, sem paralelo.
 
-Execute o helper da pasta desta skill, sem pedir ao usuário que o invoque:
+Use uma unidade por comportamento coerente; não fragmente por arquivo. O padrão usa uma
+worktree por lote. Não declare branch/worktree por unidade nesse perfil. Frentes realmente
+paralelas exigem workflow custom explícito com suporte operacional verificado; não use
+custom para contornar a política enxuta. No perfil custom, workflow e step_contexts
+continuam sendo informados explicitamente e mantêm as validações do compilador.
+
+A revisão é obrigatória por padrão. review:"skip-low-risk" só é aceito se todas as
+unidades forem risk_level:0 e houver review_skip_reason. Não reduza risco para dispensá-la.
+review_context deve conter critérios e base reais, sem exigir que o revisor releia
+todos os planos. Sua sessão pode corrigir dentro do escopo em um ciclo, sem auditor.
+
+manual_screen_tests contém cenários com pré-condição, ação e resultado. Sem alteração
+de tela, informe [] e manual_screen_tests_na com justificativa. Não inclua Playwright,
+Cypress ou Selenium nos checks de tela do perfil atual. Testes automatizados de código,
+API, contratos e regressões continuam previstos conforme pertinência.
+
+## Contexto, recursos e autorização
+
+O helper gera step_contexts a partir das unidades e do brief de revisão; ele não inventa
+requisitos. Paths required/initial/available são relativos à raiz Git, com faixas
+start_line/end_line opcionais. Required precisa existir na base e caber no orçamento.
+Initial pode ser omitido; available é índice. Não inclua segredos nem catálogos inteiros.
+
+Limites finitos e checkpoints do compilador continuam ativos; personalize execution.limits
+ou unit.limits proporcionalmente ao trabalho. USD nativo só no Claude, nunca teto global
+num lote com outros providers. Não adicione outra LLM para coordenar/resumir o contexto.
+
+local_git_authorized:true descreve a proposta: o manifesto informa que chamar run
+autoriza commits e branch locais previstos. Não afirma que o usuário já executou ou
+aprovou o lote durante a geração. O planejador termina no pacote e não chama run.
+Não há checkpoints humanos entre etapas; bloqueio real continua sendo reportado.
+Não autoriza push, PR, publicação ou merge em main/master.
+
+## Geração
 
 ```text
-node CAMINHO_DA_SKILL/scripts/gerar-pacote-go.mjs --input PACOTE.json --manifest PASTA_DO_LOTE/lote-X.md --contexto EXECUTAVEL_CONTEXTO
+node CAMINHO_DA_SKILL/scripts/gerar-pacote-go.mjs --input pacote.json --manifest PASTA/lote.md --contexto EXECUTAVEL_GO
 ```
 
-Localize o executável pela configuração do projeto, `CONTEXTO_CLI`, PATH ou pelo caminho
-de instalação já verificado na sessão. Em um checkout de desenvolvimento com os dois
-repositórios lado a lado, verifique também `context-compiler-v1/bin/contexto.exe` (Windows)
-ou `context-compiler-v1/bin/contexto` ao lado do repositório de skills. Não pergunte um caminho
-que já possa verificar. `--contexto` aceita um executável, não uma string
-de shell como `go run ...`. Se a CLI estiver indisponível, registre `BLOQUEADO_POR_VALIDACAO`
-e os rascunhos, sem declarar prontidão ou simular as validações.
-
-O helper gera os arquivos em uma pasta temporária, chama o compilador real com
-`plan validate` e `run --dry-run` e só publica os três arquivos quando ambos aprovam.
-Não abre IA, não cria worktree de execução e não altera arquivos finais existentes.
-Falhas preservam os planos anteriores e não deixam um novo manifesto final falso como ready.
-
-Ao retornar `ready: true`, confira os caminhos publicados e entregue ao usuário o comando
-`contexto run CAMINHO_ABSOLUTO_DO_MANIFESTO` (ou o executável absoluto se estiver fora do
-PATH). Não imponha `--with claude`: sem override, cada etapa usa seu executor configurado.
-Informe os três arquivos, validações realizadas e qualquer limitação material. Somente
-execute `run` quando o usuário já tiver autorizado a implementação.
-
-## Contexto e orçamentos por etapa
-
-Todo step skill precisa de brief próprio, incluindo revisão, auditoria e QA. Em instructions,
-inclua decisões, contratos, bordas e verificações necessários sem o chat. required são fontes
-essenciais; initial podem ser omitidas pelo orçamento; available é índice para consulta sob
-demanda. Use path relativo à raiz Git e start_line/end_line para trechos pertinentes.
-Não inclua segredos. Arquivos required precisam existir na base de execução.
-
-Regras locais não podem ser descartadas para economizar. Required acima do orçamento
-bloqueia antes de abrir IA. Refine limites por step no campo limits. USD nativo só no Claude;
-não é valor faturado. Não configure esse campo global em lote com Codex/Agy. Os defaults
-são finitos: divida tickets grandes, preservando gates. Documente exceção inherited.
-Não acrescente outra LLM para resumir o lote.
\ No newline at end of file
+O helper valida projeto, Git/base, referências, briefs, comandos e risco; monta o YAML;
+chama plan validate e run --dry-run com o binário real. Só publica os três arquivos após
+aprovação. Não sobrescreve arquivos existentes. Sem CLI Go, preserve rascunhos e informe
+bloqueio de validação, sem marcar ready. Não confunda a CLI Go com contexto.mjs legado.
+
+A etapa local_delivery usa o helper determinístico do mesmo acervo. Ele exige worktree
+do runtime e branch contexto/ ou a mesma revisao/, recusa conflitos e branch de destino
+já existente, registra roteiro manual, cria commit local e renomeia a branch para revisao/.
+Não há merge entre unidades porque elas compartilham a mesma worktree. Não atribua esse
+helper à integração de múltiplas worktrees: esse fluxo exige outro contrato explícito.
+
+Ao finalizar, a branch conserva documentacoes/entregas-ia/testes-manuais.md como
+PENDENTE_DE_TESTES_MANUAIS_DE_TELA. DONE do runtime é conclusão técnica, não QA visual.
+Snapshots históricos não são regenerados nem modificados automaticamente.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.mjs"
new file mode 100644
index 0000000..b1f141e
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.mjs"	
@@ -0,0 +1,73 @@
+import { fileURLToPath } from 'node:url';
+function requireValue(ok, message) { if (!ok) throw new Error(message); }
+export function buildLeanFlow(draft, bindings) {
+  requireValue(draft.local_git_authorized === true, 'Declare local_git_authorized:true na proposta; o usuário autoriza a execução ao chamar run');
+  requireValue(draft.isolation !== 'none', 'Fluxo enxuto exige worktree isolada');
+  requireValue(Array.isArray(draft.units) && draft.units.length > 0, 'Fluxo enxuto exige units com briefs e checks');
+  requireValue(typeof draft.delivery_branch === 'string' && /^revisao\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(draft.delivery_branch), 'delivery_branch deve usar revisao/');
+  requireValue(Array.isArray(draft.final_checks) && draft.final_checks.length, 'final_checks determinísticos obrigatórios');
+  requireValue(Array.isArray(draft.manual_screen_tests), 'Declare manual_screen_tests');
+  requireValue(draft.manual_screen_tests.every(x => typeof x === 'string' && x.trim()), 'Cenários manuais devem ser textos');
+  requireValue(draft.manual_screen_tests.length || typeof draft.manual_screen_tests_na === 'string' && draft.manual_screen_tests_na.trim(), 'Informe cenários de tela ou justificativa NA');
+  const impl = draft.implementation_executor;
+  const reviewer = draft.review_executor ?? impl;
+  const implRef = draft.implementation_skill ?? 'software/implementador-de-ticket@v1';
+  const reviewRef = draft.review_skill ?? 'software/revisor-de-codigo@v1';
+  requireValue(bindings.skills?.[implRef] && bindings.executors?.[impl], 'Cadastre skill/executor de implementação');
+  const skip = draft.review === 'skip-low-risk';
+  requireValue(draft.review === undefined || ['required','skip-low-risk'].includes(draft.review), 'review inválido');
+  requireValue(!skip || typeof draft.review_skip_reason === 'string' && draft.review_skip_reason.trim() &&
+    draft.units.every(u => u.risk_level === 0), 'Dispensa de review exige R0 explícito em todas as unidades e justificativa');
+  requireValue(skip || bindings.skills?.[reviewRef] && bindings.executors?.[reviewer], 'Cadastre skill/executor da revisão corretiva');
+  requireValue(bindings.max_concurrency === undefined || bindings.max_concurrency === 1, 'Fluxo enxuto padrão é sequencial numa worktree');
+  bindings.max_concurrency = 1;
+  bindings.commands ??= {};
+  bindings.values ??= {};
+  bindings.values['flow.profile'] = 'enxuto-v1';
+  bindings.values['flow.screen_testing'] = 'manual_pending';
+  bindings.step_contexts = {};
+  const steps = [];
+  const ids = new Set();
+  let previous;
+  const policy = '\nFLUXO_ENXUTO_V1: execute somente este papel. Sem orquestrador, auditor, QA de tela por IA ou novas sessões. Preserve limites/checkpoints e regras do projeto. Testes de tela serão manuais no final. Não execute commits/merges: a entrega Git é uma etapa determinística posterior.';
+  function addCheck(ref, id) {
+    requireValue(typeof ref === 'string' && Array.isArray(bindings.commands[ref]), 'Comando de check não cadastrado: ' + ref);
+    const argv = bindings.commands[ref];
+    requireValue(!/(?:playwright\s+test|cypress\s+run|selenium)/i.test(argv.join(' ')), 'Checks de tela ficam manuais neste perfil');
+    steps.push({id, type:'command', ...(previous ? {depends_on:[previous]} : {}), command_ref:ref});
+    previous = id;
+  }
+  for (const unit of draft.units) {
+    requireValue(typeof unit.id === 'string' && /^[a-z][a-z0-9_]{0,30}$/.test(unit.id) && !ids.has(unit.id), 'ID de unidade inválido/duplicado');
+    requireValue(!unit.worktree && !unit.branch, 'O perfil padrão usa uma worktree por lote; não declare worktrees extras sem workflow custom explícito');
+    requireValue(Number.isInteger(unit.risk_level) && unit.risk_level >= 0 && unit.risk_level <= 4, 'risk_level numérico obrigatório');
+    for (const dep of unit.depends_on ?? []) requireValue(ids.has(dep), 'Unidade depende de tarefa ausente ou posterior: ' + dep);
+    ids.add(unit.id);
+    requireValue(Array.isArray(unit.checks) && unit.checks.length, 'Cada unidade exige checks determinísticos');
+    const id = unit.id + '_implement';
+    const {ticket_id, objective, scope, acceptance, instructions = '', required = [], initial = [], available = [], limits} = unit;
+    bindings.step_contexts[id] = {ticket_id, objective, scope, acceptance, instructions:instructions+policy, required, initial, available, ...(limits ? {limits} : {})};
+    steps.push({id, type:'skill', skill_ref:implRef, executor_ref:impl, ...(previous ? {depends_on:[previous]} : {})});
+    previous = id;
+    unit.checks.forEach((ref,i) => addCheck(ref, unit.id+'_check_'+(i+1)));
+  }
+  if (!skip) {
+    const brief = draft.review_context;
+    requireValue(brief && typeof brief === 'object', 'review_context obrigatório: brief consolidado da revisão');
+    requireValue(typeof brief.instructions === 'string' && brief.instructions.trim(), 'review_context.instructions deve informar base/diff, contratos e checks');
+    const id = 'review_fix';
+    bindings.step_contexts[id] = {...brief, instructions:'MODO=REVISAO_CORRETIVA_ENXUTA\nUma revisão independente consolidada. Procure somente problemas críticos/altos/médios fundamentados e corrija dentro do escopo. Um ciclo de correção e testes; sem auditor/review-loop/QA IA.\n'+brief.instructions+policy};
+    steps.push({id,type:'skill',skill_ref:reviewRef,executor_ref:reviewer,depends_on:[previous]});
+    previous = id;
+  }
+  draft.final_checks.forEach((ref,i) => addCheck(ref,'integrated_check_'+(i+1)));
+  const deliveryRef = 'flow/local-delivery';
+  requireValue(!Object.hasOwn(bindings.commands,deliveryRef), 'flow/local-delivery é reservado ao gerador');
+  const script = fileURLToPath(new URL('../../_shared/scripts/entregar-lote-go.mjs', import.meta.url));
+  bindings.commands[deliveryRef] = [process.execPath, script, '--branch', draft.delivery_branch, '--manual-tests-json', JSON.stringify({scenarios:draft.manual_screen_tests,na:draft.manual_screen_tests_na ?? ''})];
+  steps.push({id:'local_delivery',type:'command',command_ref:deliveryRef,depends_on:[previous]});
+  bindings.values['flow.review_policy'] = skip ? 'skip_r0: '+draft.review_skip_reason : 'one_corrective_review';
+  const ref = draft.workflow_ref;
+  requireValue(ref && typeof ref.id === 'string' && Number.isInteger(ref.version), 'workflow_ref {id,version} obrigatório');
+  return {schema_version:1,workflow:{...ref,trigger:'manual'},steps};
+}
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.test.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.test.mjs"
new file mode 100644
index 0000000..522cf4b
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\fluxo-enxuto.test.mjs"	
@@ -0,0 +1,99 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import {execFileSync} from 'node:child_process';
+import {buildLeanFlow} from './fluxo-enxuto.mjs';
+import {generateBundle} from './gerar-pacote-go.mjs';
+import {deliver} from '../../_shared/scripts/entregar-lote-go.mjs';
+const compiler=process.env.CONTEXTO_TEST_CLI;
+const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
+function fixture(t){
+ const root=fs.mkdtempSync(path.join(os.tmpdir(),'contexto-lean-'));
+ t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('contexto-lean-'));fs.rmSync(root,{recursive:true,force:true});});
+ const project=path.join(root,'project');fs.mkdirSync(project);
+ git(project,'init','-q','-b','main');git(project,'config','user.name','Fixture');git(project,'config','user.email','fixture@example.invalid');git(project,'config','commit.gpgsign','false');
+ fs.writeFileSync(path.join(project,'README.md'),'base\n');git(project,'add','.');git(project,'commit','-qm','base');
+ const draft={
+  schema_version:1,status:'ready',title:'Lean fixture',project_root:project,isolation:'worktree',body:'AC-1: proof implemented and reviewed.',
+  workflow_ref:{id:'test/lean',version:1},local_git_authorized:true,delivery_branch:'revisao/fixture',
+  implementation_executor:'claude/subscription',review_executor:'claude/subscription',
+  units:[{id:'t1',ticket_id:'T1',risk_level:3,objective:'Implement proof',scope:['proof.txt'],acceptance:['AC-1'],checks:['test/unit']}],
+  review_context:{ticket_id:'R',objective:'Correct material defects',scope:['proof.txt'],acceptance:['AC-1 reviewed'],instructions:'Compare com o SHA base registrado; executar os checks do catálogo.'},
+  final_checks:['test/final'],manual_screen_tests:['Abrir tela e conferir resultado esperado'],
+  bindings:{schema_version:1,skills:{'software/implementador-de-ticket@v1':path.join(root,'impl.md'),'software/revisor-de-codigo@v1':path.join(root,'review.md')},executors:{'claude/subscription':{provider:'claude'}},commands:{
+   'test/unit':[process.execPath,'-e',"if(!require('fs').readFileSync('proof.txt','utf8').startsWith('implemented'))process.exit(1)"],
+   'test/final':[process.execPath,'-e',"if(require('fs').readFileSync('proof.txt','utf8')!=='implemented reviewed')process.exit(1)"],
+  },values:{}}
+ };
+ fs.writeFileSync(path.join(root,'impl.md'),'# Implement proof');
+ fs.writeFileSync(path.join(root,'review.md'),'# Review proof');
+ return {root,project,draft};
+}
+test('DAG enxuto tem uma revisão e nenhum gate humano/QA/auditor',t=>{
+ const {draft}=fixture(t); const b=structuredClone(draft.bindings);const flow=buildLeanFlow(draft,b);
+ assert.deepEqual(flow.steps.map(x=>x.id),['t1_implement','t1_check_1','review_fix','integrated_check_1','local_delivery']);
+ assert.ok(flow.steps.every((s,i)=>i===0||s.depends_on[0]===flow.steps[i-1].id));
+ assert.equal(b.max_concurrency,1);assert.equal(b.values['flow.profile'],'enxuto-v1');
+ assert.match(b.step_contexts.review_fix.instructions,/MODO=REVISAO_CORRETIVA_ENXUTA/);
+ assert.equal(flow.steps.filter(s=>s.type==='skill').length,2);
+});
+test('autorização local, roteiro manual e limites de revisão são exigidos',t=>{
+ const {draft}=fixture(t);
+ const invalid=[
+  [d=>delete d.local_git_authorized,/local_git_authorized/],
+  [d=>d.manual_screen_tests=[],/cenários/],
+  [d=>{d.review='skip-low-risk';d.review_skip_reason='ignore';},/R0/],
+  [d=>d.units[0].worktree='other',/worktree/],
+  [d=>d.units[0].depends_on=['future'],/posterior/],
+  [d=>d.bindings.commands['test/unit']=['pnpm','exec','playwright','test'],/tela/],
+ ];
+ for(const [mutate,pattern] of invalid){const d=structuredClone(draft);mutate(d);assert.throws(()=>buildLeanFlow(d,d.bindings),pattern);}
+ const d=structuredClone(draft);d.units[0].risk_level=0;d.review='skip-low-risk';d.review_skip_reason='Only documentation';d.manual_screen_tests=[];d.manual_screen_tests_na='Sem alteração de tela';
+ const flow=buildLeanFlow(d,d.bindings);assert.ok(!flow.steps.some(s=>s.id==='review_fix'));
+});
+test('entrega recusa checkout principal e preserva branch/dados',t=>{
+ const {project}=fixture(t);const before=git(project,'rev-parse','HEAD');
+ assert.throws(()=>deliver({cwd:project,branch:'revisao/fixture',manualTests:{scenarios:['manual']}}),/isolada/);
+ assert.equal(git(project,'rev-parse','HEAD'),before);
+ assert.throws(()=>deliver({cwd:project,branch:'main',manualTests:{scenarios:['manual']}}),/revisao/);
+});
+test('entrega local é repetível e não sobrescreve branch existente',t=>{
+ const {root,project}=fixture(t); const wt=path.join(root,'worktree');
+ git(project,'worktree','add','-q','-b','contexto/test',wt,'HEAD');
+ git(project,'branch','revisao/existing');
+ fs.writeFileSync(path.join(wt,'proof.txt'),'new');
+ assert.throws(()=>deliver({cwd:wt,branch:'revisao/existing',manualTests:{scenarios:['manual']}}),/já existe/);
+ const first=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:['manual']}});
+ const again=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:['manual']}});
+ assert.equal(first.head,again.head);assert.equal(first.manual_screen_tests,'PENDING');
+ assert.equal(git(project,'branch','--show-current'),'main');assert.equal(fs.existsSync(path.join(project,'proof.txt')),false);
+ assert.match(fs.readFileSync(path.join(wt,first.checklist),'utf8'),/PENDENTE_DE_TESTES_MANUAIS/);
+ const na=deliver({cwd:wt,branch:'revisao/new',manualTests:{scenarios:[],na:'Somente API'}});
+ assert.equal(na.manual_screen_tests,'NOT_APPLICABLE');
+ assert.match(fs.readFileSync(path.join(wt,na.checklist),'utf8'),/TESTES_DE_TELA_NAO_APLICAVEIS/);
+});
+test('pipeline real com executora falsa chega à branch local e não toca a raiz',{skip:!compiler},t=>{
+ const {root,project,draft}=fixture(t);
+ const fake=path.join(root,'fake.mjs');
+ fs.writeFileSync(fake,`import fs from 'node:fs';
+const prompt=fs.readFileSync(0,'utf8');const review=prompt.includes('Step: review_fix\\n');
+fs.writeFileSync('proof.txt',review?'implemented reviewed':'implemented');
+fs.writeFileSync(review?'review.md':'implementation.md',review?'reviewed':'implemented');
+const result={status:'PASS',summary:'fixture',artifacts:[{path:review?'review.md':'implementation.md'}]};
+console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:'fixture-session',structured_output:result,result:JSON.stringify(result),usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}}));
+`);
+ draft.bindings.executors['claude/subscription'].command=[process.execPath,fake];
+ fs.writeFileSync(path.join(project,'unrelated.txt'),'preserved original');
+ const input=path.join(root,'packet.json');fs.writeFileSync(input,JSON.stringify(draft));
+ const generated=generateBundle({input,manifest:path.join(root,'plans','batch.md'),compiler});
+ const env={...process.env,CONTEXTO_DATA_DIR:path.join(root,'state'),CONTEXTO_LOG_DIR:path.join(root,'logs')};
+ const run=JSON.parse(execFileSync(compiler,['run',generated.manifest,'--yes','--quiet'],{encoding:'utf8',env,windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe']}));
+ assert.equal(run.status,'DONE');assert.equal(run.steps.review_fix.status,'PASS');assert.equal(run.steps.local_delivery.status,'PASS');
+ assert.equal(git(project,'branch','--show-current'),'main');assert.equal(fs.readFileSync(path.join(project,'unrelated.txt'),'utf8'),'preserved original');
+ assert.equal(fs.existsSync(path.join(project,'proof.txt')),false);
+ assert.equal(git(project,'show','revisao/fixture:proof.txt'),'implemented reviewed');
+ const manual=git(project,'show','revisao/fixture:documentacoes/entregas-ia/testes-manuais.md');
+ assert.match(manual,/PENDENTE_DE_TESTES_MANUAIS_DE_TELA/);
+});
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"
index a6dd3f7..9f753df 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"	
@@ -1,6 +1,7 @@
 #!/usr/bin/env node
 // Empacota o planejamento e usa o compilador real como validador. Nunca executa o plano.
 import fs from 'node:fs';
+import { buildLeanFlow } from './fluxo-enxuto.mjs';
 import path from 'node:path';
 import { execFileSync } from 'node:child_process';
 import { fileURLToPath } from 'node:url';
@@ -63,9 +64,11 @@ export function generateBundle({ input, manifest, compiler = process.env.CONTEXT
       execFileSync('git', ['-C', project, 'rev-parse', '--verify', 'HEAD'], { stdio: 'ignore', windowsHide: true });
     } catch (error) { throw new Error(`Worktree exige projeto Git com commit base verificado: ${error.message}`); }
   }
-  requireValue(object(draft.workflow) && Array.isArray(draft.workflow.steps), 'Workflow completo ausente');
+  requireValue(draft.flow_profile === undefined || ['enxuto-v1', 'custom'].includes(draft.flow_profile), 'flow_profile inválido');
   requireValue(object(draft.bindings), 'Catálogo bindings completo ausente');
   const bindings = structuredClone(draft.bindings);
+  if ((draft.flow_profile ?? 'enxuto-v1') === 'enxuto-v1') draft.workflow = buildLeanFlow(draft, bindings);
+  requireValue(object(draft.workflow) && Array.isArray(draft.workflow.steps), 'Workflow completo ausente');
   bindings.max_concurrency ??= 1;
   if (Object.hasOwn(bindings.values ?? {}, 'task.final_risk_level')) {
     const risk = bindings.values['task.final_risk_level'];
@@ -134,7 +137,7 @@ export function generateBundle({ input, manifest, compiler = process.env.CONTEXT
   const outputDir = path.dirname(target);
   const targets = names.map(name => path.join(outputDir, name));
   for (const destination of targets) requireValue(!fs.existsSync(destination), `Arquivo existente preservado: ${destination}`);
-  const header = ['---', 'contexto:', '  schema_version: 1', `  project_root: ${JSON.stringify(project)}`, `  workflow: ${JSON.stringify(names[1])}`, `  bindings: ${JSON.stringify(names[2])}`, '  status: ready', `  isolation: ${isolation}`, '---', '', `# ${draft.title.trim()}`, '', body.trim(), ''].join('\n');
+  const header = ['---', 'contexto:', '  schema_version: 1', `  project_root: ${JSON.stringify(project)}`, `  workflow: ${JSON.stringify(names[1])}`, `  bindings: ${JSON.stringify(names[2])}`, '  status: ready', `  isolation: ${isolation}`, '---', '', `# ${draft.title.trim()}`, '', (draft.flow_profile === 'custom' ? '' : 'Fluxo enxuto: ao executar run, você autoriza implementação, checks, revisão corretiva e commits/branch locais previstos. Sem checkpoints humanos intermediários; testes de tela serão manuais ao final. Não autoriza push, PR nem merge em main/master.'), '', body.trim(), ''].join('\n');
   const contents = [header, `${yaml(draft.workflow)}\n`, `${yaml(bindings)}\n`];
   fs.mkdirSync(outputDir, { recursive: true });
   const staging = fs.mkdtempSync(path.join(outputDir, '.contexto-packet-'));
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"
index 39e15ee..ac58326 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"	
@@ -19,7 +19,7 @@ function fixture(t) {
   fs.writeFileSync(path.join(root, 'worker.md'), '# Executor de teste\n');
   fs.writeFileSync(path.join(root, 'spec.md'), 'Objetivo: alterar README.\nAC-1: preservar as seções existentes.\nEtapa implementar atende AC-1.\n');
   const draft = {
-    schema_version: 1, status: 'ready', title: 'Lote de teste', project_root: 'projeto com espaços',
+    schema_version: 1, flow_profile: 'custom', status: 'ready', title: 'Lote de teste', project_root: 'projeto com espaços',
     isolation: 'none', body_file: 'spec.md',
     workflow: { schema_version: 1, workflow: { id: 'test/planning', version: 1, trigger: 'manual' }, steps: [
       { id: 'implementar', type: 'skill', skill_ref: 'test/worker@v1', executor_ref: 'codex/subscription' },
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\review-loop-driver\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\review-loop-driver\\SKILL.md"
index 16c4af7..a6b894c 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\review-loop-driver\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\review-loop-driver\\SKILL.md"	
@@ -3,6 +3,9 @@ name: review-loop-driver
 description: Consolida a fila de review e coordena correções por decisão do auditor no lote ou por indicação do usuário fora dele. Use para aplicar achados autorizados e registrar commits; não refaz review nem aprova QA.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Condutor das correções
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Execute somente as correções autorizadas recebidas; novas revisões e rodadas pertencem ao runtime.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\revisor-de-codigo\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\revisor-de-codigo\\SKILL.md"
index 5d8428e..1a61a9f 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\revisor-de-codigo\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\revisor-de-codigo\\SKILL.md"	
@@ -1,82 +1,54 @@
 ---
 name: revisor-de-codigo
-description: Revisa alterações sem editar código e produz achados e plano de correção. Consolida os critérios de code-reviewer (bugs e performance), clean-code-reviewer (qualidade) e security-reviewer (AppSec). Use para revisar ticket, diff, commit ou branch; não para executar correções, validar a experiência funcional de QA ou auditar todo o sistema.
+description: Revisa um diff com foco em problemas de impacto médio, alto ou crítico. No fluxo enxuto autorizado, aplica correções e testes em um ciclo; na chamada direta de revisão, produz achados sem editar.
 ---
 
 # Revisor de código
 
-Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Faça a revisão independente e devolva o relatório; o runtime decide auditoria, correção e revalidação.
+Siga o [contrato Go](../_shared/context-compiler.md) nos despachos do runtime.
+Leia o [fluxo enxuto](../_shared/fluxo-enxuto.md) quando o brief indicar esse perfil.
 
-## Registro de execução e contexto compacto
+## Escopo e evidência
 
-Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).
+Confirme base SHA, HEAD, worktree e mudanças staged/unstaged/untracked que pertencem ao
+lote. Não compare silenciosamente com outra base. Use o brief consolidado, aceites,
+regras e contratos; leia segmentos pertinentes do diff e rastreie dependências concretas.
+Não releia catálogos, lockfiles ou todo o histórico. Registre lacunas essenciais como BLOCKED.
 
-## Política V2 de escopo e composição
+Procure somente problemas fundamentados de impacto MÉDIO, ALTO ou CRÍTICO: segurança,
+autorização, perda/corrupção de dados, quebra de requisitos/contratos, regressões,
+transações/migrations e performance com impacto concreto. Não procure nem corrija
+estilo, nomes, comentários, preferências arquiteturais ou refatorações opcionais.
+Suspeita sem caminho demonstrado é limitação, não bug confirmado nem autorização para editar.
 
-No padrão, um revisor independente aplica os três checklists; não delegue automaticamente o mesmo diff a três especialistas. No crítico, delegue somente superfícies relevantes a especialistas independentes quando houver risco demonstrado, sem repetir especialidade já coberta.
+Consulte somente o checklist pertinente:
+[correção/performance](references/correcao-performance.md) ou
+[segurança](references/seguranca.md). Não abra especialistas/subagentes automaticamente.
 
-Inicial: examine o diff fixado e os arquivos alterados por segmentos, rastreando chamadores/contratos/testes no raio de impacto. Focal: receba IDs, auditoria e commits de correção, verificando-os e as regressões relacionadas; reaproveite a cobertura inicial válida por referência. Integrado: examine apenas interações, contratos, resoluções de merge e regressões do conjunto, preservando evidências individuais inalteradas. Não converta limite de contexto em omissão de código ou aceite essencial; declare lacunas e expanda referências.
+## MODO=REVISAO_CORRETIVA_ENXUTA
 
-Devolva achados com IDs estáveis, evidência e cobertura de critérios no [protocolo V2](../_shared/protocolo-v2.md). Revalidação não apaga o relatório inicial; use evento revalidate para o plano APLICAR, em vez de auditor verificar a própria correção.
+Este modo exige autorização explícita no brief do step ou no pedido do usuário. Faça
+uma revisão independente consolidada do lote. Para cada achado, registre ID, severidade,
+cenário, causa, arquivo/linha e evidência. Corrija somente problemas demonstrados dentro
+do escopo e arquitetura aprovados, sem aguardar auditor ou chamar outra skill.
 
-Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.
+Há UM ciclo: identificar achados, aplicar correções pertinentes, executar testes afetados
+e conferir o próprio diff de correção. Não reinicie a revisão completa nem abra outra
+sessão de revalidação. Essa conferência não é uma segunda revisão independente.
+Não faça commits/merges; a etapa determinística de entrega cuida do Git.
 
-Entrada única e gate técnico oficial do fluxo. Os agentes existentes continuam válidos como executores especializados internos; esta skill permite aplicar os mesmos critérios quando não estiverem disponíveis. Não crie outra skill `code-reviewer` concorrente e não rode os agentes novamente sobre o mesmo diff depois deste gate.
+Se a correção exigir decisão nova de produto/arquitetura, acesso não autorizado ou não
+puder ser comprovada dentro do ciclo/orçamento, preserve o trabalho e devolva BLOCKED
+com a pendência. Não faça loop infinito nem declare PASS para escapar do limite.
 
-## Seleção do modo
+Grave relatório com cobertura, achados/correções, testes realmente executados e riscos
+residuais. PASS exige nenhum problema médio/alto/crítico conhecido pendente no escopo
+e verificações essenciais comprovadas. Retorne o JSON do runtime com o caminho do relatório.
+Não realize testes de tela nem declare QA visual aprovado; haverá teste manual no final.
 
-- Pedido genérico de revisão de implementação: revisão completa, com correção/performance, qualidade/arquitetura e segurança das mudanças.
-- “Tem bug?”, “vai quebrar?”, “N+1?”: correção e performance, conforme [critérios do code-reviewer](references/correcao-performance.md).
-- “Boas práticas”, “clean”, “padrões”: [qualidade](references/qualidade.md), sem aplicar refatoração.
-- “Brecha”, “security review deste diff”: [segurança](references/seguranca.md).
-- Auditoria abrangente, modelo de ameaça ou cadeia de suprimentos: `security-audit`, se disponível. Não executar ambos sobre a mesma superfície sem motivo.
-- Revalidação depois de correções: revise somente os IDs informados, os commits de correção e o raio de impacto demonstrável. Preserve os IDs originais e classifique cada um como `VERIFICADO`, `AINDA PRESENTE`, `REGRESSÃO` ou `BLOQUEADO`.
+## Revisão direta sem autorização de correção
 
-Leia somente as referências dos modos selecionados. Achados de outra especialidade viram encaminhamentos; na revisão completa, consolide pela causa raiz. Não omita risco grave por causa da divisão de papéis.
-
-## Protocolo de escopo
-
-1. Leia AGENTS.md, convenções locais, ticket/aceite e ADRs relevantes quando disponíveis. A ausência de ticket não impede revisar um diff explícito; registre a limitação.
-2. Use primeiro arquivos, commit, intervalo ou base informados pelo usuário. Sem escopo explícito, examine `git status --short`: inclua `git diff`, `git diff --cached` e arquivos não rastreados relevantes, lidos integralmente. Não perca alterações já staged.
-3. Com árvore limpa, use a base configurada para a tarefa; só depois descubra `refs/remotes/origin/HEAD` ou uma branch principal existente. Registre os hashes de base e HEAD e use `git diff <base>...HEAD`. Não escolha outra base silenciosamente se a informada não existir. Sem base ou mudanças identificáveis, peça apenas o escopo ausente.
-4. Em múltiplos repositórios, registre escopo e hashes separadamente. Nunca troque uma worktree pelo checkout principal.
-5. Leia inteiros os arquivos de código alterados e rastreie chamadores, contratos, testes e migrations relevantes. Em arquivos grandes, use leitura segmentada e declare lacunas. Separe problemas introduzidos das dívidas preexistentes.
-6. Durante a revisão, use somente Git de leitura. Não edite código, não faça commit/push e não execute correções por iniciativa própria. Relatórios são a única escrita desta revisão; aplicação posterior cabe ao implementador, por decisão do auditor no lote ou por indicação do usuário fora dele (ver Saída). Execute verificações locais pertinentes apenas se seu caminho de execução for conhecido e compatível com o ambiente.
-
-Se `.claude/agents/_shared/escopo-revisao.md` existir, leia-o como protocolo local, respeitando o escopo explícito do usuário. Esta skill é autossuficiente quando ele não existir; não invente seu conteúdo.
-
-## Independência e composição
-
-Se houver revisores independentes disponíveis e delegação autorizada, repasse o mesmo escopo imutável e apenas a especialidade necessária. Não execute a mesma especialidade duas vezes por existir como agente e skill. Reaproveite relatórios somente quando seus hashes, diff local e limites coincidirem com o estado revisado.
-
-Uma autorrevisão deve ser identificada como tal; não satisfaz sozinha um gate de revisão independente. A skill não concede aprovação funcional nem declara a tarefa DONE.
-
-## Evidência e severidade
-
-Cada achado precisa de cenário concreto, localização atual, causa, impacto e recomendação verificável. Confirme validações upstream e mitigações antes de reportar. Suspeita sem caminho demonstrado fica em “Precisa de validação”, sem severidade ou afirmação de bug confirmado. Não invente plano SQL, índice existente, execução de teste ou versão vulnerável.
-
-- CRÍTICO: bloqueio grave, perda/corrupção de dados, comprometimento ou indisponibilidade ampla demonstrável.
-- ALTO: falha significativa de fluxo, contrato ou proteção.
-- MÉDIO: impacto limitado que exige correção planejada.
-- BAIXO: manutenção ou melhoria com custo concreto; gosto pessoal não é achado.
-
-`BLOCKER` de relatórios antigos equivale a bloqueio crítico; `NIT` é observação opcional. Segurança não é automaticamente crítica. Exceções documentadas da Intranet continuam aplicáveis somente nesse perfil.
-
-Inclua compatibilidade de migrations, dados legados, locks e ordem de deploy. Conflito com ADR aceito exige avaliação arquitetural; não proponha substituir a arquitetura silenciosamente.
-
-## Saída
-
-No chat: escopo e modos, achados por severidade, lacunas e veredito. Máximo de dez itens médios/baixos no resumo; o relatório conserva todos os achados fundamentados, agrupando repetições.
-
-Grave `docs/historico/reviews/<prefixo>-<escopo>-<AAAA-MM-DD-HHmm>.md`, ou o caminho solicitado. Prefixos: `code-review` (completa ou correção), `clean-code` (qualidade), `security-review` (segurança). Evite sobrescrever outro relatório do mesmo minuto.
-
-Cabeçalho: tarefa, modo, repositório/worktree, base e HEAD, estado local, arquivos cobertos, verificações realmente executadas e seus resultados. Para cada `REVIEW-001` etc.:
-
-- Severidade, especialidade e `arquivo:linha` com trecho mínimo.
-- Problema, cenário, risco e evidência; regra/ADR ou custo concreto para qualidade.
-- Plano ordenado de alteração: arquivos, abordagem e teste que comprova a correção.
-- Dependências, causa compartilhada e risco da mudança.
-
-Finalize com mitigados/verificado e OK, precisa de validação, encaminhamentos e riscos residuais. Sem achados, escreva “Nenhum problema fundamentado no escopo revisado”, preservando as limitações.
-
-Veredito: `APPROVED`, `APPROVED WITH NOTES`, `CHANGES REQUESTED` ou `ARCHITECTURE REVIEW REQUIRED`. Escopo essencial não examinado fica `REVIEW BLOCKED`, sem aprovação por ausência de evidência. Recomendações, sozinhas, não autorizam o revisor a corrigir. No lote, devolva o relatório ao orquestrador, que aciona auditor-de-review e review-loop-driver sem pausa humana; as correções voltam para revalidação focal nesta skill, em sessão independente. Fora do lote, entregue os achados e encerre a revisão; aplicação solicitada pelo usuário usa review-loop-driver para os IDs autorizados. Nunca altere o veredito original para esconder achados rejeitados pelo auditor: registre a decisão em relatório próprio.
+Pedido de revisão por si só continua somente leitura de código/Git. Produza relatório
+com achados fundamentados e limitações; não aplique correções, commit ou push.
+Uma revisão da própria implementação é identificada como autorrevisão.
+Auditoria ampla, entrevista e QA de tela não fazem parte deste papel.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\revisor-de-qa\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\revisor-de-qa\\SKILL.md"
index 577616c..4bf279b 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\revisor-de-qa\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\revisor-de-qa\\SKILL.md"	
@@ -7,6 +7,9 @@ description: >
   tarefa pronta.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Revisor de QA
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Valide os critérios e devolva evidências, sem iniciar correções nem aprovar o próprio trabalho de implementação.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\tech-lead\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\tech-lead\\SKILL.md"
index ac30d8d..b0405b4 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\tech-lead\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\tech-lead\\SKILL.md"	
@@ -3,6 +3,9 @@ name: tech-lead
 description: Transforma requisitos e arquitetura existente em roadmap, épicos, tickets e dependências executáveis. Use para planejar, priorizar ou replanejar trabalho técnico; não para definir arquitetura estrutural, implementar tickets ou aprovar entregas.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Tech Lead
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Produza os tickets e dependências solicitados e devolva o controle ao runtime.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\worktree-planner\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\worktree-planner\\SKILL.md"
index 5f73026..d637ad0 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\worktree-planner\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\worktree-planner\\SKILL.md"	
@@ -3,6 +3,9 @@ name: worktree-planner
 description: Planeja isolamento de tickets em worktrees, contratos entre frentes, sequência de integração e prompts de execução. Use quando solicitado planejamento com worktrees ou no fluxo Intranet/Orca; não substitui o backlog do Tech Lead nem intercepta toda solicitação de implementação.
 ---
 
+Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).
+
+
 # Planejador de worktrees
 
 Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Planeje o isolamento e entregue os contratos; a criação e o despacho das worktrees pertencem ao runtime.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\context-compiler.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\context-compiler.md"
index 2316d72..017d145 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\context-compiler.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\context-compiler.md"	
@@ -39,5 +39,7 @@ trabalho existente e implemente somente o que falta. Arquivo alterado não signi
 concluído. Não apague nem recomece automaticamente. O runtime fornece contexto compacto
 e registra o ID nativo, sem reenviar a conversa inteira.
 Falha exclusivamente na finalização dos artefatos é tratada por recover, sem chamar IA
-ou repetir implementação. Isso não dispensa checks, review, auditoria e QA posteriores.
-Não contorne bloqueios nem altere o snapshot. Recomendar próxima ação não autoriza executá-la.
\ No newline at end of file
+ou repetir implementação. Isso não dispensa os checks e a revisão previstos no snapshot. No fluxo enxuto, testes de tela são manuais e ficam pendentes.
+Não contorne bloqueios nem altere o snapshot. Recomendar próxima ação não autoriza executá-la.
+
+Em flow.profile=enxuto-v1, aplica-se o [fluxo enxuto](fluxo-enxuto.md). A revisão corretiva autorizada pode editar e testar dentro do próprio step, sem auditor intermediário. Não importar gates do Node legado. Não faça commits/merges pela IA: o comando determinístico de entrega faz as ações locais autorizadas no manifesto. DONE técnico não aprova testes manuais de tela.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\contexto-e-automacao.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\contexto-e-automacao.md"
index a669066..d85c21f 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\contexto-e-automacao.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\contexto-e-automacao.md"	
@@ -1,5 +1,7 @@
 # Contexto e coordenação econômica
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 A implementação é distribuída em `_shared/contexto/`, sem instalação de MCP/npm. Leia o [protocolo V2](protocolo-v2.md) somente na seção da próxima ação. Risco/gates permanecem em [perfis](perfis-de-risco.md).
 
 ## Leituras e handoffs
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\execucao-portavel.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\execucao-portavel.md"
index 95cefc8..fb84cdf 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\execucao-portavel.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\execucao-portavel.md"	
@@ -1,5 +1,7 @@
 # Execução portátil — Claude, Antigravity e Codex
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 Leia perfil-projeto.md. As convenções de fonte/espelhos abaixo são do preset Intranet; em outro projeto use a instalação real das skills e regras locais.
 
 - Fonte de manutenção local: {FONTE_CLAUDE}/skills (diretório real das regras centrais). Não há cópias nos repositórios: ~/.claude/skills (Claude) e ~/.agents/skills (Codex e Antigravity) contêm links para a fonte, conferidos por planejador-de-lote/scripts/sincronizar-fluxo.mjs. Edite só a fonte. Se encontrar cópia antiga de uma skill do fluxo num repositório, ela é resíduo: use a fonte pelo caminho absoluto.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\fluxo-enxuto.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\fluxo-enxuto.md"
new file mode 100644
index 0000000..adb0464
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\fluxo-enxuto.md"	
@@ -0,0 +1,48 @@
+# Fluxo enxuto v1
+
+Política padrão para novos lotes do Context Compiler. Substitui a cadeia automática de
+planejamento/revisão/auditoria/QA do fluxo legado; não modifica snapshots em andamento.
+
+## Participação humana
+
+O usuário chama planejador-de-lote e responde ao grill-me durante o planejamento.
+Depois inicia context run com o manifesto proposto. O run autoriza as ações locais
+explicitamente listadas, incluindo commits e branch de revisão. Não há approval,
+wait_event, confirmação entre tickets nem pedido humano de aprovação de cada correção.
+Falta de informação essencial, limite excedido ou execução insegura continua bloqueando.
+No final, os testes de tela e o aceite visual são manuais.
+
+## Sequência
+
+Planejador + grill-me na mesma sessão → implementação por unidade + checks pertinentes
+→ uma revisão corretiva consolidada → checks integrados → entrega Git local determinística
+→ roteiro de testes manuais pendente. O fluxo não cria QA de tela por IA.
+
+Uma worktree por lote e max_concurrency:1 são o padrão atual. Tarefas dependentes
+compartilham essa worktree; dividir sessões serve para limitar escopo/contexto, não para
+criar branches desnecessárias. Como há uma única frente, não existe merge entre tarefas:
+a própria branch acumula o conjunto na ordem do DAG e termina em revisao/.
+Worktrees paralelas não são uma capacidade implícita deste perfil. Um workflow custom
+com múltiplas frentes precisa especificar workdirs, bases, commits, sequência de merges,
+validação integrada e resolução de conflito realmente suportados. Não invente comandos
+nem delegue merges rotineiros à IA. Git sem conflito não comprova compatibilidade funcional.
+
+## Revisão
+
+Uma sessão independente pode identificar e corrigir impactos médios/altos/críticos dentro
+da especificação. Não há auditor intermediário, revisão cosmética, três especialistas ou
+rodadas repetidas. Um ciclo de correção/testes; pendência não resolvida fica BLOCKED.
+Dispensa somente R0 explícito em todas as unidades e justificativa. Risco alto aumenta
+profundidade dos checks/cobertura, sem adicionar agentes automaticamente.
+
+## Preservar
+
+Continuam obrigatórios: regras de negócio, proteção de dados, documentação aplicável,
+testes automatizados de código/API/contratos, limites, telemetria, logs, checkpoints,
+recuperação auditada e retomada sem repetir PASS. Não elevar consumo para manter um
+fluxo aparentemente autônomo. Nunca fabricar teste, QA ou autorização.
+
+Commit local só no escopo proposto, dentro da worktree do runtime; nunca push, PR,
+publicação ou merge automático em main/master. O helper de entrega recusa checkout
+principal, conflitos e branch alheia. DONE do run significa fluxo técnico concluído;
+a documentação conserva testes manuais pendentes.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\observabilidade.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\observabilidade.md"
index 1225843..9743b96 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\observabilidade.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\observabilidade.md"	
@@ -1,5 +1,7 @@
 # Observabilidade e handoff entre skills
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 Em CONTEXTO_EXECUTION=step, siga [Context Compiler Go](context-compiler.md): o runtime já registra sessão, métricas, logs e checkpoint. Não execute Node process/handoff/checkpoint nem importe os mesmos tokens novamente. As instruções Node abaixo pertencem ao modo direto/legado.
 
 `quality-report` inclui achados novos/resolvidos, critérios comprovados, pares de SHA e série de requests. A correlação usa projeto, provedor, sessão, skill e agente; sem agente nativo explícito e coincidente, as razões de tokens por achado/critério ficam null. Não some relatórios derivados aos totais nativos. Leituras repetidas são observadas apenas nas chamadas read do Contexto e usam hashes da referência, sem guardar conteúdo.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\perfil-projeto.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfil-projeto.md"
index aab27bc..56d85a1 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\perfil-projeto.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfil-projeto.md"	
@@ -1,5 +1,7 @@
 # Configuração por projeto
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 As skills mantêm papéis, risco, independência, evidências, limites de correção e autorização. Convenções de infraestrutura/documentação vêm do projeto, não de um caminho fixo no SKILL.md.
 
 ## Descoberta
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfis-de-risco-legado.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfis-de-risco-legado.md"
new file mode 100644
index 0000000..cb49fd3
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfis-de-risco-legado.md"	
@@ -0,0 +1,27 @@
+# Perfis de execução
+
+Classifique cada tarefa no planejamento pelo comportamento e impacto, com justificativa e origem das decisões. O padrão é **padrao**. Ausência de informação não justifica **simples**. Escopo descoberto durante execução pode elevar o perfil; nunca reduza um gate para liberar falha.
+
+| Perfil | Quando usar | Gates |
+| --- | --- | --- |
+| simples | Mudança localizada e reversível, sem alteração de contrato/API, regra de negócio, autenticação/autorização, dados, dependências ou infraestrutura compartilhada | Implementação + validação dos critérios; review completo independente. Auditoria se houver achados. O revisor verifica os critérios observáveis; QA separado somente se a experiência funcional exigir ambiente/cenários que o review não cobriu. |
+| padrao | Feature/bug funcional com escopo e contratos conhecidos, sem gatilho crítico | Implementação; testes aplicáveis; aceite e review independente; auditoria se houver achados. Com risco explícito R0–R2, QA separado é condicional a lacunas/riscos sem cobertura. |
+| critico | Permissões, autenticação, dados/migrations, operação destrutiva, exposição de segredo, contrato entre camadas, concorrência sensível ou infraestrutura de impacto amplo | Fluxo completo: implementação, review, auditoria independente mesmo sem achados, QA independente e validação integrada afetada. |
+
+Uma mudança pequena pode ser crítica. Tarefa que altera contrato entre backend e frontend é crítica; ajustes independentes nas duas camadas não são automaticamente um contrato novo. O perfil do grupo integrado é o maior de seus membros; não reexecute gates individuais válidos.
+
+## Fases condicionais
+
+- Sem achados e com cobertura completa: auditoria em simples/padrao recebe **NA_SEM_ACHADOS**, vinculada ao relatório/SHA. Não abre sessão de auditor só para repetir “sem achados”. Limitação essencial bloqueia; não vira NA.
+- R0–R2 explícitos: dispense sessão separada de QA apenas com todos os critérios essenciais demonstrados pelo revisor independente, testes determinísticos aplicáveis e evidência íntegra. Registre **COBERTO_NO_REVIEW**, checks e referências; isso significa QA_IA_DISPENSADO_POR_POLITICA, sem fabricar QA PASS. Se houver risco sem cobertura, registre require_qa e abra QA independente. O implementador nunca aprova sozinho. R3/R4 exigem revisor-de-qa independente.
+- Achado, inclusive “precisa de validação” essencial: auditor independente antes de decidir correção. Correção e revalidação mantêm IDs, hashes e independência.
+- Integração: revise interações/resoluções e execute cenários combinados afetados. Uma tarefa única sem novo comportamento de merge pode reaproveitar evidência idêntica, com comparação do conteúdo e justificativa; não basta SHA de merge diferente/igual. Crítico mantém validação integrada independente.
+- Mantêm-se limites de três rodadas técnicas e três de QA por tarefa, isolamento, proteção de banco e proibição de push/PR/main.
+
+## Planejamento proporcional
+
+Simples: ticket curto (objetivo, critérios, arquivos, validação, fora do escopo), um estado e ponteiro do manifesto. Prompts operacionais por referência; não gere 00/99 repetindo o ticket. Padrao/critico: especificação única, prompts por camada e plano de integração somente com decisões específicas. Manifesto guarda referências, dependências e bases; não copia a especificação.
+
+Planos legados mantêm perfil **critico** até classificação explícita com justificativa registrada. Não reescreva evidências históricas.
+
+Declare `risk_level:R0|R1|R2|R3|R4` separado de `risk_factors`. Tarefas já persistidas sem risk_level conservam seus gates até migração/replanejamento explícito. Fatores críticos nunca podem ser classificados abaixo de R3 para dispensar QA. Consulte o protocolo V2 para o contrato e observabilidade para diagnóstico.
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\perfis-de-risco.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfis-de-risco.md"
index cb49fd3..3a0bf9c 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\perfis-de-risco.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\perfis-de-risco.md"	
@@ -1,27 +1,23 @@
-# Perfis de execução
+# Risco e verificações no fluxo enxuto
 
-Classifique cada tarefa no planejamento pelo comportamento e impacto, com justificativa e origem das decisões. O padrão é **padrao**. Ausência de informação não justifica **simples**. Escopo descoberto durante execução pode elevar o perfil; nunca reduza um gate para liberar falha.
+Para novos lotes vale o [fluxo enxuto](fluxo-enxuto.md). Risco continua numérico 0..4
+com justificativa por unidade; ausência de informação não permite classificar R0.
 
-| Perfil | Quando usar | Gates |
-| --- | --- | --- |
-| simples | Mudança localizada e reversível, sem alteração de contrato/API, regra de negócio, autenticação/autorização, dados, dependências ou infraestrutura compartilhada | Implementação + validação dos critérios; review completo independente. Auditoria se houver achados. O revisor verifica os critérios observáveis; QA separado somente se a experiência funcional exigir ambiente/cenários que o review não cobriu. |
-| padrao | Feature/bug funcional com escopo e contratos conhecidos, sem gatilho crítico | Implementação; testes aplicáveis; aceite e review independente; auditoria se houver achados. Com risco explícito R0–R2, QA separado é condicional a lacunas/riscos sem cobertura. |
-| critico | Permissões, autenticação, dados/migrations, operação destrutiva, exposição de segredo, contrato entre camadas, concorrência sensível ou infraestrutura de impacto amplo | Fluxo completo: implementação, review, auditoria independente mesmo sem achados, QA independente e validação integrada afetada. |
+- R0: alteração localizada/reversível sem mudança de negócio, contratos, dados ou segurança.
+  Checks aplicáveis sempre. Revisão pode ser dispensada explicitamente com justificativa.
+- R1/R2: comportamento funcional conhecido. Uma revisão corretiva consolidada e checks.
+- R3/R4: autenticação/autorização, dados/migrations, contratos críticos, concorrência ou
+  infraestrutura sensível. Mesma quantidade de sessões; checks e revisão aprofundam
+  essas superfícies e exigem evidências. Não dispense proteção de dados por simplificação.
 
-Uma mudança pequena pode ser crítica. Tarefa que altera contrato entre backend e frontend é crítica; ajustes independentes nas duas camadas não são automaticamente um contrato novo. O perfil do grupo integrado é o maior de seus membros; não reexecute gates individuais válidos.
+Não procure achados baixos/cosméticos durante a revisão padrão. Crítico também é
+corrigível no escopo autorizado quando houver solução comprovável; decisão nova de
+produto/arquitetura ou falta de evidência bloqueia. Um ciclo de correções/testes.
 
-## Fases condicionais
+Testes de tela ficam manuais ao final em todos os riscos, com cenários e pré-condições.
+Isso não dispensa testes de código/API/contratos nem significa QA visual PASS.
+Não adicione auditor, review-loop-driver ou revisor-de-qa automaticamente.
 
-- Sem achados e com cobertura completa: auditoria em simples/padrao recebe **NA_SEM_ACHADOS**, vinculada ao relatório/SHA. Não abre sessão de auditor só para repetir “sem achados”. Limitação essencial bloqueia; não vira NA.
-- R0–R2 explícitos: dispense sessão separada de QA apenas com todos os critérios essenciais demonstrados pelo revisor independente, testes determinísticos aplicáveis e evidência íntegra. Registre **COBERTO_NO_REVIEW**, checks e referências; isso significa QA_IA_DISPENSADO_POR_POLITICA, sem fabricar QA PASS. Se houver risco sem cobertura, registre require_qa e abra QA independente. O implementador nunca aprova sozinho. R3/R4 exigem revisor-de-qa independente.
-- Achado, inclusive “precisa de validação” essencial: auditor independente antes de decidir correção. Correção e revalidação mantêm IDs, hashes e independência.
-- Integração: revise interações/resoluções e execute cenários combinados afetados. Uma tarefa única sem novo comportamento de merge pode reaproveitar evidência idêntica, com comparação do conteúdo e justificativa; não basta SHA de merge diferente/igual. Crítico mantém validação integrada independente.
-- Mantêm-se limites de três rodadas técnicas e três de QA por tarefa, isolamento, proteção de banco e proibição de push/PR/main.
-
-## Planejamento proporcional
-
-Simples: ticket curto (objetivo, critérios, arquivos, validação, fora do escopo), um estado e ponteiro do manifesto. Prompts operacionais por referência; não gere 00/99 repetindo o ticket. Padrao/critico: especificação única, prompts por camada e plano de integração somente com decisões específicas. Manifesto guarda referências, dependências e bases; não copia a especificação.
-
-Planos legados mantêm perfil **critico** até classificação explícita com justificativa registrada. Não reescreva evidências históricas.
-
-Declare `risk_level:R0|R1|R2|R3|R4` separado de `risk_factors`. Tarefas já persistidas sem risk_level conservam seus gates até migração/replanejamento explícito. Fatores críticos nunca podem ser classificados abaixo de R3 para dispensar QA. Consulte o protocolo V2 para o contrato e observabilidade para diagnóstico.
+Runs antigos conservam gates/snapshots. Só no modo legado explícito consulte
+[política histórica](perfis-de-risco-legado.md); não use essa política para alterar
+silenciosamente o perfil enxuto nem para reclassificar uma falha.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\protocolo-v2.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\protocolo-v2.md"
index 3ceee05..af752de 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\protocolo-v2.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\protocolo-v2.md"	
@@ -1,5 +1,7 @@
 # Protocolo V2 — execução e contexto integrados
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 Consulte apenas a seção da próxima ação. `contexto/contexto.mjs --help` lista comandos; os testes em `contexto/tests/` fornecem exemplos executáveis completos. Este protocolo complementa risco, regras locais e proteções de banco; não concede publicação externa.
 
 ## Inicialização automática
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\worktrees-automaticas.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\worktrees-automaticas.md"
index 90d9da7..3f2a42f 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-base\\skills\\skills\\_shared\\worktrees-automaticas.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\worktrees-automaticas.md"	
@@ -1,5 +1,7 @@
 # Contexto automático por worktree
 
+O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.
+
 O código Contexto está em `_shared/contexto/`. Não depende de instalação externa ou cadastro de MCP. O usuário não executa init por worktree. Siga o [protocolo V2](protocolo-v2.md) e preserve autorização, Git e proteção de banco.
 
 ## Criar, reutilizar e retomar
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\scripts\\entregar-lote-go.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\scripts\\entregar-lote-go.mjs"
new file mode 100644
index 0000000..48ad0ae
--- /dev/null
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\enxuto-nucleos-work\\skills\\skills\\_shared\\scripts\\entregar-lote-go.mjs"	
@@ -0,0 +1,51 @@
+#!/usr/bin/env node
+// Finaliza somente a worktree isolada do runtime; nunca faz push ou merge em main.
+import fs from 'node:fs';
+import path from 'node:path';
+import { execFileSync } from 'node:child_process';
+import { fileURLToPath } from 'node:url';
+function git(cwd,args) {
+  return execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
+}
+export function deliver({cwd=process.cwd(),branch,manualTests}) {
+  if (!/^revisao\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch ?? '')) throw Error('Branch de entrega deve usar revisao/');
+  git(cwd,['check-ref-format','--branch',branch]);
+  const root=git(cwd,['rev-parse','--show-toplevel']);
+  if(fs.realpathSync.native(root)!==fs.realpathSync.native(cwd)) throw Error('Execute na raiz da worktree');
+  const current=git(cwd,['branch','--show-current']);
+  if(!current.startsWith('contexto/') && current!==branch) throw Error('Entrega exige branch isolada contexto/ ou a mesma revisao/');
+  const gitdir=git(cwd,['rev-parse','--absolute-git-dir']);
+  if(!path.basename(path.dirname(gitdir)).includes('worktrees')) throw Error('Checkout principal não pode ser finalizado por este helper');
+  if(git(cwd,['diff','--name-only','--diff-filter=U'])) throw Error('Conflitos pendentes; não é permitido registrar entrega');
+  for(const name of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD']) if(fs.existsSync(path.join(gitdir,name))) throw Error('Operação Git incompleta: '+name);
+  if(!Array.isArray(manualTests?.scenarios) || !manualTests.scenarios.every(x=>typeof x==='string'&&x.trim()) ||
+     !manualTests.scenarios.length && !manualTests.na?.trim()) throw Error('Roteiro manual ou justificativa NA obrigatório');
+  if(current!==branch) {
+    try {git(cwd,['show-ref','--verify','--quiet','refs/heads/'+branch]);throw Error('Branch de entrega já existe; não sobrescrever');}
+    catch(error) {if(error.status!==1)throw error;}
+  }
+  const pending=git(cwd,['diff','--cached','--name-only','-z'])+'\0'+git(cwd,['ls-files','--others','--exclude-standard','-z'])+'\0'+git(cwd,['diff','--name-only','-z']);
+  if(pending.split('\0').some(p=>/(^|\/)(\.env(?!\.example$)|[^/]+\.(pem|key)$)/i.test(p))) throw Error('Arquivo potencialmente secreto na entrega; não criar commit');
+  const output=path.join(cwd,'documentacoes','entregas-ia','testes-manuais.md');
+  fs.mkdirSync(path.dirname(output),{recursive:true});
+  const text=['# Entrega técnica e testes manuais','',manualTests.scenarios.length ? 'Estado: PENDENTE_DE_TESTES_MANUAIS_DE_TELA.' : 'Estado: TESTES_DE_TELA_NAO_APLICAVEIS.',
+    'A execução automática não declara validação visual nem aceite humano.','',
+    'Branch local: '+branch,'','## Roteiro',...manualTests.scenarios.map((s,i)=>(i+1)+'. [ ] '+s),
+    ...(manualTests.scenarios.length?[]:['Não aplicável: '+manualTests.na]),''].join('\n');
+  fs.writeFileSync(output,text);
+  git(cwd,['add','--all']);
+  if(git(cwd,['diff','--cached','--name-only'])) git(cwd,['commit','-m','Entrega técnica do lote; testes manuais pendentes']);
+  if(current!==branch)git(cwd,['branch','-m',branch]);
+  return {status:'TECHNICAL_DELIVERY',branch,head:git(cwd,['rev-parse','HEAD']),manual_screen_tests:manualTests.scenarios.length?'PENDING':'NOT_APPLICABLE',checklist:path.relative(cwd,output).split(path.sep).join('/'),push:false};
+}
+if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
+ try {
+  const options={};
+  for(let i=2;i<process.argv.length;i+=2) {
+   const key={'--branch':'branch','--manual-tests-json':'manualTests'}[process.argv[i]];
+   if(!key || !process.argv[i+1] || Object.hasOwn(options,key))throw Error('Uso: entregar-lote-go.mjs --branch revisao/LOTE --manual-tests-json JSON');
+   options[key]=key==='manualTests'?JSON.parse(process.argv[i+1]):process.argv[i+1];
+  }
+  console.log(JSON.stringify(deliver(options)));
+ }catch(error){console.error(error.stderr?.toString().trim()||error.message);process.exitCode=1;}
+}
\ No newline at end of file

```