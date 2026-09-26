---
name: review-loop-driver
description: Consolida relatórios dos agentes revisores ou de revisor-de-codigo/security-audit em uma fila de correções e prepara um prompt por item. Use para processar reviews e acompanhar correções; não revisa novamente, não altera código e não aprova QA.
---

# Condutor do loop de correções

Leia os relatórios indicados, ticket, escopo da worktree e decisões do usuário. Aceite `code-review-*`, `security-review-*`, `clean-code-*`, o legado `clean-code-review-*` e relatórios de auditoria. Não misture revisões históricas ou de outras branches só porque estão na mesma pasta.

## Fila

Grave `docs/historico/reviews/fila-<assunto>-<data>.md` no repositório revisado. Registre base/HEAD ou estado local de origem e tabela: ID, severidade, origem+ID original, local, problema, bloqueia, status e evidência. Preserve IDs ao atualizar; una apenas achados com a mesma causa raiz e correção, conservando todas as origens.

Ordene CRÍTICO → ALTO → MÉDIO → BAIXO; empate por dependências, segurança, correção e manutenção. `BLOCKER` é bloqueante; `NIT` é opcional; `Critical/High/Medium/Low` correspondem aos nomes em português. `needs-validation` fica em investigação, sem promover a achado confirmado.

CRÍTICO e ALTO bloqueiam por padrão; demais itens seguem aceite e política local. Não promova toda segurança a CRÍTICO. Preserve a regra documentada de N requisições batch da Intranet apenas quando esse perfil se aplicar. Separe severidade de decisão de bloqueio.

Fora do escopo vira sugestão de nova tarefa, sem autorizar expansão. Um risco bloqueante não deixa de bloquear só por estar fora do escopo: registre a decisão necessária. Não publique tarefas externas automaticamente.

## Prompt por item

Use caminhos reais da worktree e branch confirmados, nunca caminhos Windows herdados do exemplo. O prompt contém:

- Âncora: repositório, worktree, branch, base/HEAD e leituras externas necessárias.
- ID da correção e origem; cenário, evidência e plano do relatório.
- Escopo autorizado e arquivos relacionados; verificar se o código ainda corresponde ao achado.
- Correção mínima e teste de regressão apropriado; sem refatorações extras.
- Git de leitura permitido; sem commit, push ou merge nesta etapa, salvo instrução explícita do usuário.
- Evidência de conclusão: diff, verificações executadas/resultados, riscos e limitações.

Gere um item por vez, agrupando somente a mesma causa raiz já consolidada. O pedido de montar fila não autoriza implementar. Se a sessão já autoriza corrigir determinados itens, preserve essa autorização no handoff sem pedir novamente.

## Acompanhamento

Estados: pendente, em andamento, aplicado/aguarda verificação, verificado, adiado ou nova tarefa. Relato de aplicação não equivale a verificação. Atualize com a resposta ou evidência disponível; não invente execução nem marque testes não executados como passando.

Quando não houver correção obrigatória pendente, informe “fila concluída; pronta para revalidação” e liste gates pendentes. Não declare entrega aprovada ou liberada para merge. Correções invalidam evidências afetadas: peça revalidação focal, sem repetir toda revisão se o escopo não justificar. Atualize checklist semanal apenas se ele existir e pertencer ao pedido.

Não altere código, não execute Git de escrita, não publique mensagens externas e não inicie um ciclo infinito de melhorias. Novos problemas fora da entrega seguem para backlog.
