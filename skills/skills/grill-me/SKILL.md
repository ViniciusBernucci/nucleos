---
name: grill-me
description: Entrevista requisitos de uma demanda ou lote até esclarecer decisões de produto e critérios de aceite. Use para questionar um plano antes da especificação técnica.
---

# Grill me

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Questões que dependam do usuário deixam a etapa `BLOCKED`, com as perguntas no relatório; não presuma respostas numa execução headless.

No planejamento enxuto, participe na mesma sessão do planejador. Não execute preparação/indexação/process do Node legado nem abra outro agente. Telemetria de planejamento não exposta permanece desconhecida; o runtime registra a execução posterior.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

## Memória do planejamento

No lote, consulte o `planning-context.json` existente antes de perguntar. Persista ID, origem e referência de cada decisão/hipótese e questão essencial aberta; atualize o mesmo contexto, sem transcrever documentos já canônicos. Não trate resposta antiga como vigente quando evidência atual a contradiz. Devolva referências ao planejador.

Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.

Questione o plano até que as decisões importantes estejam claras. Leia a demanda e o código/documentos disponíveis antes de entrevistar. Não invoque skills ausentes como “grilling”.

Pergunte em português, uma decisão relevante por vez, sobre resultado esperado, quem usa, situação atual, restrições, regra de negócio, erros, permissões, dados legados, limites e critérios de sucesso. Confronte premissas com evidência e explique consequências de alternativas. Evite perguntar fatos verificáveis no repositório ou repetir respostas.

Registre decisões, hipóteses, questões abertas, exemplos Dado/Quando/Então e fora do escopo. Não implemente nem crie arquitetura durante a entrevista. Sem resposta essencial, preserve a questão e não declare o requisito resolvido.

No fluxo do planejador-de-lote, devolva a entrevista ao próprio planejador, na mesma sessão. Ele consolida especificação, unidades, checks e pacote executável. Não chame tech-lead/worktree-planner automaticamente. Perguntas essenciais pertencem ao planejamento; o run posterior não deve depender de nova entrevista. Na chamada direta, entregue decisões e perguntas restantes sem iniciar implementação.
