# Fluxo enxuto v1

Política padrão para novos lotes do Context Compiler. Substitui a cadeia automática de
planejamento/revisão/auditoria/QA do fluxo legado; não modifica snapshots em andamento.

## Participação humana

O usuário chama planejador-de-lote e responde ao grill-me durante o planejamento.
Depois inicia context run com o manifesto proposto. O run autoriza as ações locais
explicitamente listadas, incluindo commits e branch de revisão. Não há approval,
wait_event, confirmação entre tickets nem pedido humano de aprovação de cada correção.
Falta de informação essencial, limite excedido ou execução insegura continua bloqueando.
No final, os testes de tela e o aceite visual são manuais.

## Sequência

Planejador + grill-me na mesma sessão → implementação por unidade + checks pertinentes
→ uma revisão corretiva consolidada → checks integrados → entrega Git local determinística
→ roteiro de testes manuais pendente. O fluxo não cria QA de tela por IA.

Uma worktree por lote e max_concurrency:1 são o padrão atual. Tarefas dependentes
compartilham essa worktree; dividir sessões serve para limitar escopo/contexto, não para
criar branches desnecessárias. Como há uma única frente, não existe merge entre tarefas:
a própria branch acumula o conjunto na ordem do DAG e termina em revisao/.
Worktrees paralelas não são uma capacidade implícita deste perfil. Um workflow custom
com múltiplas frentes precisa especificar workdirs, bases, commits, sequência de merges,
validação integrada e resolução de conflito realmente suportados. Não invente comandos
nem delegue merges rotineiros à IA. Git sem conflito não comprova compatibilidade funcional.

## Revisão

Uma sessão independente pode identificar e corrigir impactos médios/altos/críticos dentro
da especificação. Não há auditor intermediário, revisão cosmética, três especialistas ou
rodadas repetidas. Um ciclo de correção/testes; pendência não resolvida fica BLOCKED.
Dispensa somente R0 explícito em todas as unidades e justificativa. Risco alto aumenta
profundidade dos checks/cobertura, sem adicionar agentes automaticamente.

## Preservar

Continuam obrigatórios: regras de negócio, proteção de dados, documentação aplicável,
testes automatizados de código/API/contratos, limites, telemetria, logs, checkpoints,
recuperação auditada e retomada sem repetir PASS. Não elevar consumo para manter um
fluxo aparentemente autônomo. Nunca fabricar teste, QA ou autorização.

Commit local só no escopo proposto, dentro da worktree do runtime; nunca push, PR,
publicação ou merge automático em main/master. O helper de entrega recusa checkout
principal, conflitos e branch alheia. DONE do run significa fluxo técnico concluído;
a documentação conserva testes manuais pendentes.