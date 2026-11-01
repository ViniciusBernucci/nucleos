# Instruções essenciais para o fluxo de IA

Preserve regras específicas do projeto, arquitetura, dados, documentação e autorização.
Confirme raiz Git, base/branch e escopo; use a instalação real das skills, sem caminhos
de outra máquina ou convenções de outro projeto.

O padrão é planejador-de-lote + grill-me na mesma sessão. O planejador consolida
especificação, unidades e pacote executável e termina no plano. O usuário inicia
context run; não inicie implementação durante o planejamento.

O runtime Go controla unidades sequenciais, checks, uma revisão corretiva de impactos
médios/altos/críticos, validação final e entrega local em revisao/. Uma worktree por lote.
Não chame orquestrador, auditor, review-loop ou QA de tela por IA. Testes de tela e
aceite visual são manuais ao final; DONE técnico não significa aprovação visual.

No despacho CONTEXTO_EXECUTION=step, execute somente o brief e referências pertinentes.
Não faça preparação/indexação/process do Node legado. Não leia catálogos/lockfiles/logs
inteiros. O Go calcula hashes e registra limites, logs, métricas e checkpoints.
Na retomada, preserve trabalho existente e não repita o que já passou.

O run autoriza somente ações locais previstas explicitamente no manifesto, incluindo
commits e branch de revisão. Sem push, PR, publicação ou merge automático em main/master.
Não exponha segredos nem acesse dados reais sem isolamento comprovado.

Um ciclo de correções/testes; lacuna essencial ou risco sem solução autorizada bloqueia
com diagnóstico preciso. Skills não ampliam permissões do host. Configuração externa,
fontes, caminhos de documentos/checks e restrições pertencem às regras deste projeto.

Modo custom/legado só por pedido explícito; não migre snapshots/runs antigos silenciosamente.
Ao editar skills, altere a fonte e sincronize as cópias pelo instalador da distribuição.