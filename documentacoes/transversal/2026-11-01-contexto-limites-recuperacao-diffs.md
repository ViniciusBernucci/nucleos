# Diffs da correção do fluxo Context Compiler — 2026-11-01

Comparação com os bytes iniciais da árvore de trabalho, incluindo CLAUDE.md já alterado anteriormente. Somente mudanças desta tarefa. [Entrega](2026-11-01-contexto-limites-recuperacao.md). Espelhos recebem os mesmos bytes da fonte; a alteração canônica não é repetida três vezes. Quebras de linha CRLF das instruções locais foram preservadas.

```diff
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\AGENTS.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\AGENTS.md"
index 44dc922..b6fce05 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\AGENTS.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\AGENTS.md"	
@@ -4,11 +4,39 @@ Estas instrucoes se aplicam a todo o repositorio. Regras mais especificas em um
 `AGENTS.md` de subdiretorio podem complementar estas regras, mas nao podem
 dispensar a documentacao obrigatoria de entrega nem a manutencao de `lessons/`.
 
+
+## Despacho pelo Context Compiler Go
+
+Quando o prompt contiver CONTEXTO_EXECUTION=step, esta secao rege a coordenacao da
+etapa. Preserve todas as demais regras de negocio, banco, seguranca, autorizacao,
+documentacao e lessons deste arquivo. O runtime Go executa o YAML; nao chame
+orquestrador-fluxo-ia nem encadeie skills. Execute somente o brief do step.
+O planejamento externo continua com planejador-de-lote. Fora do despacho Go,
+o fluxo direto/legado abaixo continua disponivel quando solicitado.
+
+Nao rode index/ensure/preparar-contexto, flow ou process/handoff/checkpoint do
+Contexto Node legado durante o despacho Go. A worktree e o estado pertencem ao
+runtime Go. O SQLite local de telemetria nao substitui o PostgreSQL da aplicacao.
+CONTEXTO_CLI de uma instalacao Node nao deve ser reutilizado como binario Go.
+
+Use as regras obrigatorias e fontes incluidas no pacote. Referencias available sao
+para consulta sob demanda; leia apenas trechos pertinentes. Nao carregue catalogos
+de skills, lockfiles, logs ou diffs inteiros. Se faltar requisito essencial ou
+houver conflito entre plano congelado e regra vigente, devolva BLOCKED com a
+divergencia. Nao escolha outra arquitetura/banco silenciosamente.
+
+Nao execute outras IAs/subagentes sem autorizacao explicita do despacho. Registre
+progresso e pendencias em arquivo local. Em retomada, preserve a worktree e confira
+o trabalho existente antes de continuar; nao recomece nem apague o que ja foi feito.
+Pausa/orcamento nao equivalem a QA aprovado.
+
+Retorne status, summary e artifacts com caminhos relativos. O Go calcula SHA-256:
+nao transcreva hashes. Falha de finalizacao pode ser revalidada com recover sem IA,
+sem dispensar os checks/reviews/QA posteriores. Nao altere snapshot/estado manualmente.
+
 ## Forma de trabalho
 
-- Antes de alterar codigo, leia a estrutura do repositorio, os arquivos
-  `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, o README e os testes
-  relacionados.
+- Antes de alterar codigo, identifique a estrutura e leia README, configuracoes e testes pertinentes a camada/ticket. Consulte package.json, pnpm-workspace.yaml, tsconfig e pyproject.toml quando relevantes. Em uv.lock/pnpm-lock.yaml, procure apenas dependencias/versoes relacionadas; nao carregue lockfiles inteiros na conversa.
 - Preserve a arquitetura, os limites de dominio, as convencoes e o estilo ja
   existentes. Nao faca refatoracoes alheias a tarefa.
 - Para TypeScript/Python, respeite a stack do ADR de 2026-10-25 (TypeScript com NestJS e Next.js; Python
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\CLAUDE.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\CLAUDE.md"
index 5677558..f3ff9bb 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\CLAUDE.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\CLAUDE.md"	
@@ -5,11 +5,39 @@ todas as sessoes e em todos os subagentes. Instrucoes mais especificas podem
 complementa-las, mas nao podem dispensar a documentacao obrigatoria nem a base
 didatica descritas aqui.
 
+
+## Despacho pelo Context Compiler Go
+
+Quando o prompt contiver CONTEXTO_EXECUTION=step, esta secao rege a coordenacao da
+etapa. Preserve todas as demais regras de negocio, banco, seguranca, autorizacao,
+documentacao e lessons deste arquivo. O runtime Go executa o YAML; nao chame
+orquestrador-fluxo-ia nem encadeie skills. Execute somente o brief do step.
+O planejamento externo continua com planejador-de-lote. Fora do despacho Go,
+o fluxo direto/legado abaixo continua disponivel quando solicitado.
+
+Nao rode index/ensure/preparar-contexto, flow ou process/handoff/checkpoint do
+Contexto Node legado durante o despacho Go. A worktree e o estado pertencem ao
+runtime Go. O SQLite local de telemetria nao substitui o PostgreSQL da aplicacao.
+CONTEXTO_CLI de uma instalacao Node nao deve ser reutilizado como binario Go.
+
+Use as regras obrigatorias e fontes incluidas no pacote. Referencias available sao
+para consulta sob demanda; leia apenas trechos pertinentes. Nao carregue catalogos
+de skills, lockfiles, logs ou diffs inteiros. Se faltar requisito essencial ou
+houver conflito entre plano congelado e regra vigente, devolva BLOCKED com a
+divergencia. Nao escolha outra arquitetura/banco silenciosamente.
+
+Nao execute outras IAs/subagentes sem autorizacao explicita do despacho. Registre
+progresso e pendencias em arquivo local. Em retomada, preserve a worktree e confira
+o trabalho existente antes de continuar; nao recomece nem apague o que ja foi feito.
+Pausa/orcamento nao equivalem a QA aprovado.
+
+Retorne status, summary e artifacts com caminhos relativos. O Go calcula SHA-256:
+nao transcreva hashes. Falha de finalizacao pode ser revalidada com recover sem IA,
+sem dispensar os checks/reviews/QA posteriores. Nao altere snapshot/estado manualmente.
+
 ## Forma de trabalho
 
-- Antes de alterar codigo, leia a estrutura do repositorio, os arquivos
-  `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, o README e os testes
-  relacionados.
+- Antes de alterar codigo, identifique a estrutura e leia README, configuracoes e testes pertinentes a camada/ticket. Consulte package.json, pnpm-workspace.yaml, tsconfig e pyproject.toml quando relevantes. Em uv.lock/pnpm-lock.yaml, procure apenas dependencias/versoes relacionadas; nao carregue lockfiles inteiros na conversa.
 - Preserve arquitetura, limites de dominio, convencoes e estilo existentes.
   Evite refatoracoes sem relacao com a tarefa.
 - Em TypeScript/Python, respeite a stack do ADR de 2026-10-25 (TypeScript com NestJS e Next.js; Python
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\modelos\\AGENTS.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\modelos\\AGENTS.md"
index a482ef3..75114be 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\modelos\\AGENTS.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\modelos\\AGENTS.md"	
@@ -10,3 +10,15 @@ Estas instruções complementam as regras específicas deste projeto; não conce
 - Preserve trabalho alheio e segredos. Não implemente em `main`/`master`, não faça push, PR ou publicação externa automaticamente e não adicione dependências silenciosamente. Antes de testes/scripts que toquem banco ou serviços reais, siga a proteção local e comprove isolamento; sem prova, não execute.
 - O Contexto é incluído em `_shared/contexto/`: prepare automaticamente cada raiz/worktree pelo helper `_shared/scripts/preparar-contexto.mjs`, sem instalação de MCP/npm ou init manual. Exija prepared:true; SQLite é local e isolado por raiz, dentro da pasta skills. Não copie bancos/aprovações entre projetos. O runtime controla estados e o cliente chama agentes independentes; leia `_shared/protocolo-v2.md` conforme a fase.
 - Mantenha uma especificação canônica e retornos por referência. Só o coordenador atualiza manifesto/estado durante o lote; Markdown derivado não é uma segunda fonte independente. Feche com registro, validações reais e commits quando autorizados; antes de limpar worktrees, preserve histórico e comprove ownership, Git seguro e ausência de executores.
+
+## Quando a execução é controlada pelo Context Compiler Go
+
+Em CONTEXTO_EXECUTION=step, o runtime Go executa o workflow YAML e registra estado,
+limites, resultados, logs e checkpoints. Execute somente o brief do step e não chame
+orquestrador-fluxo-ia, outras skills nem preparação/indexação/process/handoff do Node
+legado. Preserve regras do projeto, segurança, autorização, documentação e gates.
+O planejador-de-lote continua externo. Esta exceção rege apenas coordenação; não
+concede permissão para alterar negócio/arquitetura ou dispensar QA.
+Use fontes incluídas e consulte referências adicionais sob demanda. Não carregue
+catálogos, lockfiles, logs ou diffs inteiros. Retorne artefatos por caminho: o Go
+calcula SHA-256. Em retomada preserve a worktree e execute apenas o que falta.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\modelos\\CLAUDE.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\modelos\\CLAUDE.md"
index a482ef3..75114be 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\modelos\\CLAUDE.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\modelos\\CLAUDE.md"	
@@ -10,3 +10,15 @@ Estas instruções complementam as regras específicas deste projeto; não conce
 - Preserve trabalho alheio e segredos. Não implemente em `main`/`master`, não faça push, PR ou publicação externa automaticamente e não adicione dependências silenciosamente. Antes de testes/scripts que toquem banco ou serviços reais, siga a proteção local e comprove isolamento; sem prova, não execute.
 - O Contexto é incluído em `_shared/contexto/`: prepare automaticamente cada raiz/worktree pelo helper `_shared/scripts/preparar-contexto.mjs`, sem instalação de MCP/npm ou init manual. Exija prepared:true; SQLite é local e isolado por raiz, dentro da pasta skills. Não copie bancos/aprovações entre projetos. O runtime controla estados e o cliente chama agentes independentes; leia `_shared/protocolo-v2.md` conforme a fase.
 - Mantenha uma especificação canônica e retornos por referência. Só o coordenador atualiza manifesto/estado durante o lote; Markdown derivado não é uma segunda fonte independente. Feche com registro, validações reais e commits quando autorizados; antes de limpar worktrees, preserve histórico e comprove ownership, Git seguro e ausência de executores.
+
+## Quando a execução é controlada pelo Context Compiler Go
+
+Em CONTEXTO_EXECUTION=step, o runtime Go executa o workflow YAML e registra estado,
+limites, resultados, logs e checkpoints. Execute somente o brief do step e não chame
+orquestrador-fluxo-ia, outras skills nem preparação/indexação/process/handoff do Node
+legado. Preserve regras do projeto, segurança, autorização, documentação e gates.
+O planejador-de-lote continua externo. Esta exceção rege apenas coordenação; não
+concede permissão para alterar negócio/arquitetura ou dispensar QA.
+Use fontes incluídas e consulte referências adicionais sob demanda. Não carregue
+catálogos, lockfiles, logs ou diffs inteiros. Retorne artefatos por caminho: o Go
+calcula SHA-256. Em retomada preserve a worktree e execute apenas o que falta.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\implementador-de-ticket\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\implementador-de-ticket\\SKILL.md"
index 40d720d..9a7ea92 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\implementador-de-ticket\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\implementador-de-ticket\\SKILL.md"	
@@ -17,9 +17,9 @@ Registre início/fim desta skill com identidade de sessão, agente e etapa confo
 
 ## Contexto proporcional e modos
 
-Use o [protocolo V2](../_shared/protocolo-v2.md) e o pacote do papel implementer. Na implementação inicial, leia regras aplicáveis, especificação canônica, critérios, contratos/ADRs citados e arquivos/testes relacionados; amplie a investigação quando encontrar uma dependência concreta. A lista abaixo é checklist de pertinência, não ordem para ler todo domínio/API/banco de todo projeto.
+No despacho Go, use o brief compilado e o contrato compartilhado; referências adicionais são sob demanda. Fora desse modo, use o [protocolo V2](../_shared/protocolo-v2.md) e o pacote do papel implementer. Na implementação inicial, leia regras aplicáveis, especificação canônica, critérios, contratos/ADRs citados e arquivos/testes relacionados; amplie a investigação quando encontrar uma dependência concreta. A lista abaixo é checklist de pertinência, não ordem para ler todo domínio/API/banco de todo projeto.
 
-Em correção focal, receba IDs APLICAR ou bugs de QA autorizados, evidências, commits e raio de impacto. Não refaça entrevista/planejamento nem amplie escopo silenciosamente. Preserve IDs e execute regressões afetadas. Use fechar-entrega na mesma sessão, em ENTREGA_INICIAL ou CORRECAO conforme o caso; simplificação ampla permanece opcional. Devolva evento estruturado e caminhos, não o histórico da conversa.
+Em correção focal, receba IDs APLICAR ou bugs de QA autorizados, evidências, commits e raio de impacto. Não refaça entrevista/planejamento nem amplie escopo silenciosamente. Preserve IDs e execute regressões afetadas. Fora do despacho Go, use fechar-entrega na mesma sessão, em ENTREGA_INICIAL ou CORRECAO conforme o caso; simplificação ampla permanece opcional. Devolva evento estruturado e caminhos, não o histórico da conversa.
 
 Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.
 
@@ -29,7 +29,7 @@ Atue como Senior Software Engineer.
 
 Sua responsabilidade é implementar UM ticket.
 
-Em worktree com estas skills, confira o recibo de preparação e execute o helper de [worktrees automáticas](../_shared/worktrees-automaticas.md) se o criador ainda não o fez. Use a raiz desta worktree; não peça init ao usuário nem use banco de outro checkout.
+Fora do despacho Go, em worktree com estas skills, confira o recibo de preparação e execute o helper de [worktrees automáticas](../_shared/worktrees-automaticas.md) se o criador ainda não o fez. Use a raiz desta worktree; não peça init ao usuário nem use banco de outro checkout.
 
 Não planeje o projeto inteiro.
 
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\SKILL.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\SKILL.md"
index 0ffc4b1..22b0ca4 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\SKILL.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\SKILL.md"	
@@ -13,7 +13,7 @@ A chamada normal já exige o pacote completo para o compilador: manifesto Markdo
 
 Leia o [contrato de saída e geração automática](references/pacote-context-compiler.md) e use [gerar-pacote-go.mjs](scripts/gerar-pacote-go.mjs) para publicar os três arquivos. O helper verifica projeto/caminhos, gera o cabeçalho e só publica após `plan validate` e `run --dry-run` aprovados pelo compilador real. Você prepara e executa essa geração como parte do planejamento; o usuário recebe o manifesto pronto e o comando de execução.
 
-Resolva o projeto, executoras, providers, comandos, condições, critérios e dependências com os fatos coletados no planejamento. Preserve a configuração explícita do projeto. Sem catálogo existente, cadastre as executoras verificadas no mesmo acervo desta skill. Não copie caminhos de outro computador, invente comandos ou peça ao usuário que monte o pacote manualmente.
+Resolva o projeto, executoras, providers, comandos, condições, critérios e dependências com os fatos coletados no planejamento. Para cada etapa skill, gere bindings.step_contexts com ticket_id, objective, scope, acceptance e referências required/initial/available relativas à raiz do projeto. Inclua a especificação essencial daquele papel em instructions. Configure execution.profile=compiled e limites finitos. USD nativo só é suportado no Claude; não configure esse limite global em lote com outros providers. Divida tarefas que não cabem no orçamento, preservando gates. Preserve a configuração explícita do projeto. Sem catálogo existente, cadastre as executoras verificadas no mesmo acervo desta skill. Não copie caminhos de outro computador, invente comandos ou peça ao usuário que monte o pacote manualmente.
 
 O workflow começa nas etapas executoras e não repete entrevista/planejamento nem usa `orquestrador-fluxo-ia` como coordenador. Dados essenciais ausentes, ferramenta indisponível ou capacidade não suportada deixam a entrega bloqueada, com motivo explícito; nunca declare `ready` por ter apenas escrito os arquivos. Não altere gates para esconder um bloqueio. Planejar não inicia a execução do workflow.
 
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"
index 3d94b57..9fa4300 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\references\\pacote-context-compiler.md"	
@@ -21,8 +21,7 @@ objetivo, escopo/exclusões, decisões e origem da aprovação; por ticket, IDs,
 critérios observáveis, arquivos/contratos, dependências, validações e risco justificado;
 raiz/base ref/SHA verificados, ordem e mapeamento **step ID → ticket/critério**; recursos,
 preparação do ambiente na worktree, autorizações e bloqueios. Inclua o conteúdo essencial
-da especificação. Links auxiliares devem ser verificáveis; o runtime envia o corpo do
-manifesto, não a conversa de planejamento ou arquivos externos automaticamente.
+da especificação. Links auxiliares devem ser verificáveis; o runtime envia o brief do step em step_contexts, não a conversa inteira nem todos os tickets.
 
 O workflow começa depois do planejamento. Não inclua `planejador-de-lote`, entrevista ou
 uma LLM orquestradora novamente. Cadastre cada executora por referência qualificada e
@@ -64,6 +63,8 @@ não toma decisões de produto. Exemplo mínimo de formato, a substituir pelos f
   "bindings": {
     "schema_version": 1,
     "max_concurrency": 1,
+    "execution": {"profile": "compiled", "effort": "medium", "limits": {"timeout_seconds": 1200, "max_turns": 40, "max_tool_calls": 80, "max_total_tokens": 2000000, "max_context_tokens": 64000, "max_prompt_tokens": 12000}},
+    "step_contexts": {"implementar": {"ticket_id": "T1", "objective": "Objetivo aprovado", "scope": ["Escopo deste papel"], "acceptance": ["AC-1: resultado observável"], "instructions": "Requisitos e decisões essenciais desta etapa", "required": [], "initial": [], "available": []}},
     "skills": {"software/implementador-de-ticket@v1": "CAMINHO_REAL_DO_SKILL_MD"},
     "executors": {"codex/subscription": {"provider": "codex"}},
     "commands": {"project/checks": ["COMANDO_REAL", "ARGUMENTOS_REAIS"]},
@@ -100,3 +101,17 @@ Ao retornar `ready: true`, confira os caminhos publicados e entregue ao usuário
 PATH). Não imponha `--with claude`: sem override, cada etapa usa seu executor configurado.
 Informe os três arquivos, validações realizadas e qualquer limitação material. Somente
 execute `run` quando o usuário já tiver autorizado a implementação.
+
+## Contexto e orçamentos por etapa
+
+Todo step skill precisa de brief próprio, incluindo revisão, auditoria e QA. Em instructions,
+inclua decisões, contratos, bordas e verificações necessários sem o chat. required são fontes
+essenciais; initial podem ser omitidas pelo orçamento; available é índice para consulta sob
+demanda. Use path relativo à raiz Git e start_line/end_line para trechos pertinentes.
+Não inclua segredos. Arquivos required precisam existir na base de execução.
+
+Regras locais não podem ser descartadas para economizar. Required acima do orçamento
+bloqueia antes de abrir IA. Refine limites por step no campo limits. USD nativo só no Claude;
+não é valor faturado. Não configure esse campo global em lote com Codex/Agy. Os defaults
+são finitos: divida tickets grandes, preservando gates. Documente exceção inherited.
+Não acrescente outra LLM para resumir o lote.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"
index ab9a775..a6dd3f7 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.mjs"	
@@ -81,6 +81,39 @@ export function generateBundle({ input, manifest, compiler = process.env.CONTEXT
     requireValue(object(executor), `Executor inválido: ${ref}`);
     if (executor.command !== undefined) argv(executor.command, `Executor ${ref}`);
   }
+  bindings.execution ??= {};
+  bindings.execution.profile ??= 'compiled';
+  requireValue(object(bindings.step_contexts), 'bindings.step_contexts obrigatório para cada etapa skill');
+  const skillIDs = new Set(draft.workflow.steps.filter(s => s.type === 'skill').map(s => s.id));
+  for (const id of Object.keys(bindings.step_contexts)) requireValue(skillIDs.has(id), 'step_contexts desconhecido: ' + id);
+  for (const id of skillIDs) {
+    const brief = bindings.step_contexts[id];
+    requireValue(object(brief) && typeof brief.ticket_id === 'string' && brief.ticket_id.trim() &&
+      typeof brief.objective === 'string' && brief.objective.trim(), id + ': ticket_id e objective obrigatórios');
+    for (const name of ['scope', 'acceptance']) requireValue(Array.isArray(brief[name]) && brief[name].length &&
+      brief[name].every(x => typeof x === 'string' && x.trim()), id + ': ' + name + ' obrigatório');
+    for (const tier of ['required', 'initial', 'available']) {
+      requireValue(brief[tier] === undefined || Array.isArray(brief[tier]), id + ': ' + tier + ' deve ser lista');
+      for (const ref of brief[tier] ?? []) {
+        requireValue(object(ref) && typeof ref.path === 'string' && ref.path.trim() &&
+          !path.isAbsolute(ref.path), id + ': referência deve ser relativa ao projeto');
+        const resolved = path.resolve(project, ref.path);
+        const relative = path.relative(project, resolved);
+        requireValue(relative && !relative.startsWith('..') && !path.isAbsolute(relative), id + ': referência fora do projeto');
+        requireValue(!ref.path.replaceAll('\\', '/').split('/').some(x => x === '.git' || x === '.env' ||
+          x.startsWith('.env.') || x.endsWith('.pem') || x.endsWith('.key')), id + ': referência de segredo proibida');
+        if (fs.existsSync(resolved)) {
+          const realRelative = path.relative(project, fs.realpathSync.native(resolved));
+          requireValue(realRelative && !realRelative.startsWith('..') && !path.isAbsolute(realRelative), id + ': link fora do projeto');
+          requireValue(fs.statSync(resolved).isFile(), id + ': referência não é arquivo');
+        } else requireValue(tier !== 'required', id + ': referência required não existe');
+        ref.path = relative.split(path.sep).join('/');
+        requireValue((ref.start_line === undefined || Number.isInteger(ref.start_line) && ref.start_line >= 1) &&
+          (ref.end_line === undefined || Number.isInteger(ref.end_line) && ref.end_line >= (ref.start_line ?? 1)),
+          id + ': faixa de linhas inválida');
+      }
+    }
+  }
   const ids = new Set(draft.workflow.steps.map(step => step.id));
   for (const step of draft.workflow.steps) {
     requireValue(!/^.+\/(orquestrador-fluxo-ia|planejador-de-lote)@v\d+$/.test(step.skill_ref ?? ''), 'O planejamento externo já terminou; não cadastre planejador/orquestrador no workflow de execução');
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"
index 2dcb0ff..39e15ee 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\planejador-de-lote\\scripts\\gerar-pacote-go.test.mjs"	
@@ -25,7 +25,7 @@ function fixture(t) {
       { id: 'implementar', type: 'skill', skill_ref: 'test/worker@v1', executor_ref: 'codex/subscription' },
       { id: 'checks', type: 'command', depends_on: ['implementar'], command_ref: 'project/checks' },
     ] },
-    bindings: { schema_version: 1, skills: { 'test/worker@v1': 'worker.md' }, executors: { 'codex/subscription': { provider: 'codex' } }, commands: { 'project/checks': ['git', 'diff', '--check'] }, values: {} },
+    bindings: { schema_version: 1, step_contexts: { implementar: { ticket_id: 'T1', objective: 'Alterar README', scope: ['README'], acceptance: ['AC-1 preservar seções'] } }, skills: { 'test/worker@v1': 'worker.md' }, executors: { 'codex/subscription': { provider: 'codex' } }, commands: { 'project/checks': ['git', 'diff', '--check'] }, values: {} },
   };
   const input = path.join(root, 'packet.json');
   const manifest = path.join(root, 'planos', 'lote.md');
@@ -102,3 +102,17 @@ test('worktree verifica Git e um commit base antes de declarar prontidão', { sk
   execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base'], { cwd: f.project });
   assert.equal(generateBundle({ input: f.input, manifest: f.manifest, compiler }).ready, true);
 });
+
+test('brief ausente não vira pacote executável', t => {
+  const f = fixture(t); delete f.draft.bindings.step_contexts; f.write();
+  assert.throws(() => generateBundle({ input: f.input, manifest: f.manifest }), /step_contexts obrigatório/);
+  assert.equal(fs.existsSync(f.manifest), false);
+});
+test('referência fora do projeto e segredo são recusados', t => {
+  const f = fixture(t);
+  const brief = f.draft.bindings.step_contexts.implementar;
+  brief.required = [{path:'../worker.md'}]; f.write();
+  assert.throws(() => generateBundle({ input:f.input, manifest:f.manifest }), /fora do projeto/);
+  brief.required = [{path:'.env'}]; f.write();
+  assert.throws(() => generateBundle({ input:f.input, manifest:f.manifest }), /segredo/);
+});
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\_shared\\context-compiler.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\_shared\\context-compiler.md"
index 3e81baa..2316d72 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\_shared\\context-compiler.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\_shared\\context-compiler.md"	
@@ -1,41 +1,43 @@
 # Execução de uma etapa pelo Context Compiler Go
 
-Este contrato se aplica quando o despacho contém `CONTEXTO_EXECUTION=step`, com run, step,
-skill congelada, workdir, plano aprovado e handoff das dependências. Nas chamadas diretas,
-preserve o papel da skill e as regras locais. Não mantenha uma segunda cópia da skill.
-
-O runtime controla sequência, dependências, concorrência, claims, esperas, retries, gates e
-persistência. Execute somente a etapa recebida. Não chame outras skills para avançar o
-workflow; não invoque `orquestrador-fluxo-ia`, `flow claim/next/event`, nem os registros do
-runtime Node legado. As orientações de encadeamento existentes nesta skill pertencem ao
-uso direto/legado e não transferem a coordenação de volta ao agente durante um despacho Go.
-
-Use a worktree fornecida. Consulte as regras do projeto e as referências especializadas
-necessárias, sem refazer entrevista ou planejamento aprovados. Retorne bloqueio se faltar
-informação essencial, autorização, ferramenta ou evidência. Não inicie review, auditoria,
-QA, correção ou fechamento que pertençam a outra etapa. Revisão continua independente da
-implementação; o workflow configura review por risco e QA obrigatório em R3/R4.
-
-Produza os artefatos da etapa e retorne somente este JSON, sem cercas Markdown:
-
-```json
-{
-  "status": "PASS",
-  "summary": "O que foi executado e quais evidências comprovam o resultado.",
-  "artifacts": [
-    {"path": "docs/relatorio-da-etapa.md", "sha256": "SHA256_REAL_DO_ARQUIVO"}
-  ]
-}
-```
-
-`status` aceita `PASS`, `FAIL` e `BLOCKED`. `PASS` exige pelo menos um arquivo existente na
-worktree e seu hash SHA-256 real. Use caminhos relativos à worktree. Artefatos externos
-devem ser referenciados no relatório local, sem copiar segredos. O processo terminar com
-exit code zero não comprova a execução. Testes exigidos não executados, permissões negadas
-ou resultados inconclusivos não são `PASS`. O runtime valida o contrato e os hashes, grava
-o resultado e decide o próximo passo. Não invente métricas de consumo.
-
-Uma skill executora pode recomendar uma próxima ação no relatório; essa recomendação não
-autoriza executá-la. Se o YAML precisar de outra etapa ou de um ciclo de correção, informe
-a lacuna para alteração explícita da configuração. A execução em andamento usa o snapshot
-com o qual começou.
+Aplica-se somente a despachos com CONTEXTO_EXECUTION=step. O runtime Go controla
+sequência, dependências, gates, concorrência, estado, limites, logs e retomada.
+Na chamada direta da skill, preserve seu papel e as regras locais.
+
+Execute somente o step/ticket recebido na worktree indicada. Não encadeie skills,
+orquestrador-fluxo-ia, outros CLIs de IA nem flow claim/next/event. Não rode preparação,
+indexação, process/handoff/checkpoint do Contexto Node legado nesse modo. Instruções
+legadas de encadeamento não transferem a coordenação ao agente. Não faça commits
+sem autorização explícita do projeto/usuário.
+
+## Contexto proporcional
+
+Comece pelo brief aprovado, regras obrigatórias e fontes incluídas. Preserve regras de
+negócio, segurança, dados, documentação e independência de revisão/QA. Não releia regras
+já incluídas sem motivo. Referências available são índice para consulta sob demanda,
+não uma lista de leitura. Abra arquivos/faixas pertinentes a uma dependência concreta.
+Não despeje lockfiles, catálogos, logs, histórico, diffs ou documentação inteira no contexto.
+Não refaça planejamento, outros tickets ou etapas. Lacuna essencial, conflito ou gate
+sem evidência exige BLOCKED com causa precisa. Não investigue indefinidamente.
+Registre progresso e pendências no artefato local. Subagentes exigem autorização explícita
+no despacho e capacidade do executor.
+
+## Resultado
+
+Retorne somente JSON, sem cercas Markdown:
+{"status":"PASS","summary":"Trabalho e verificações reais, limitações.","artifacts":[{"path":"docs/relatorio-da-etapa.md"}]}
+
+Status: PASS, FAIL ou BLOCKED. Caminhos relativos à worktree; PASS exige arquivo existente
+e evidência real. Informe caminhos: o runtime calcula SHA-256 a partir dos bytes. Não
+calcule/transcreva hashes na resposta. Hash legado fornecido continua sujeito a validação.
+Exit code zero não comprova critérios, testes ou QA. Não copie segredos nem invente métricas.
+
+## Interrupção
+
+Pausa, timeout ou orçamento preservam worktree e checkpoint. Na retomada, inspecione o
+trabalho existente e implemente somente o que falta. Arquivo alterado não significa critério
+concluído. Não apague nem recomece automaticamente. O runtime fornece contexto compacto
+e registra o ID nativo, sem reenviar a conversa inteira.
+Falha exclusivamente na finalização dos artefatos é tratada por recover, sem chamar IA
+ou repetir implementação. Isso não dispensa checks, review, auditoria e QA posteriores.
+Não contorne bloqueios nem altere o snapshot. Recomendar próxima ação não autoriza executá-la.
\ No newline at end of file
diff --git "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\_shared\\observabilidade.md" "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\_shared\\observabilidade.md"
index dc7c09b..1225843 100644
--- "a/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-baseline\\skills\\skills\\_shared\\observabilidade.md"	
+++ "b/C:\\Users\\vinicius.silva\\Documents\\ChatGPT\\Construcao de Skills\\recovery-nucleos-work\\skills\\skills\\_shared\\observabilidade.md"	
@@ -1,5 +1,7 @@
 # Observabilidade e handoff entre skills
 
+Em CONTEXTO_EXECUTION=step, siga [Context Compiler Go](context-compiler.md): o runtime já registra sessão, métricas, logs e checkpoint. Não execute Node process/handoff/checkpoint nem importe os mesmos tokens novamente. As instruções Node abaixo pertencem ao modo direto/legado.
+
 `quality-report` inclui achados novos/resolvidos, critérios comprovados, pares de SHA e série de requests. A correlação usa projeto, provedor, sessão, skill e agente; sem agente nativo explícito e coincidente, as razões de tokens por achado/critério ficam null. Não some relatórios derivados aos totais nativos. Leituras repetidas são observadas apenas nas chamadas read do Contexto e usam hashes da referência, sem guardar conteúdo.
 
 Todas as skills registram início e fim da execução com `contexto.mjs process --project RAIZ --file EVENTO.json` quando o Contexto estiver preparado. A falta de instrumentação deve ser declarada; não invente duração, tokens ou execução. O evento usa ID estável por transição e os campos `status` (STARTED/PASS/FAIL/BLOCKED/OBSERVED), `at` ISO UTC, `session`, `parent`, `provider` (claude/codex/unknown), `skill`, `role`, `agent`, `batch`, `ticket`, `task`, `stage` e `duration_ms` quando medido. Não grave prompts, comandos completos, credenciais ou respostas no evento.

```