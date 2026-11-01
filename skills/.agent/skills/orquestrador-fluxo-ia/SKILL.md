---
name: orquestrador-fluxo-ia
description: Entrada de compatibilidade para executar um plano pelo Context Compiler Go. A coordenação pertence ao runtime; o fluxo Node V2 só se aplica quando o usuário pedir explicitamente modo legado.
---

# Orquestrador do fluxo de IA

## Entrada de compatibilidade do Context Compiler Go

No fluxo Go, o runtime controla a execução. Se esta skill for chamada diretamente com um plano, valide com `contexto plan validate MANIFESTO.md` e execute `contexto run MANIFESTO.md --yes`, respeitando o provider solicitado. Depois apresente o estado retornado e encerre: não mantenha uma LLM coordenadora, não faça polling de agentes e não execute `flow next/claim/event`. Se `contexto` não estiver disponível ou o plano não declarar workflow e bindings, informe o bloqueio; não faça fallback automático para o runtime Node.

Esta skill não deve ser cadastrada como etapa coordenadora no YAML. Se receber `CONTEXTO_EXECUTION=step`, devolva `BLOCKED` conforme o [contrato do Context Compiler](../_shared/context-compiler.md), explicando que o workflow precisa referenciar as skills executoras diretamente.

As instruções V2 abaixo permanecem para compatibilidade e só se aplicam quando o usuário pedir explicitamente **modo legado V2**. A chamada comum usa a entrada Go acima.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

A chamada autoriza worktrees, delegação, implementação, correções auditadas, commits, integração local e limpeza segura do lote. Planejamento vem pronto; não repita entrevista, tech-lead ou worktree-planner. Não peça seleção manual de IDs nem init de contexto.

Leia regras locais, [perfil do projeto](../_shared/perfil-projeto.md), [risco](../_shared/perfis-de-risco.md), manifesto e [protocolo V2](../_shared/protocolo-v2.md) na seção da próxima ação. Referências [estado/gates](references/estado-e-gates.md), [integração/limpeza](references/integracao-e-limpeza.md) e perfil Intranet só quando aplicáveis. Não carregue todas as skills executoras no coordenador.

## Preparação e retomada

1. Resolva o helper real `../_shared/scripts/preparar-contexto.mjs` e execute com `--project RAIZ_COORDENADORA`. O Contexto está incluído na distribuição: Node >=22.13 e Git bastam; nenhum MCP/npm é instalado. Exija `prepared:true`. Falha real bloqueia, sem aprovações fictícias.
2. Localize o JSON executável que acompanha o manifesto Markdown. Se o plano for legado, converta uma vez usando somente fatos verificados, preserve IDs e classifique como crítico até migração explícita. Lacunas essenciais isolam a tarefa; não invente contratos, SHAs ou caminhos.
3. Use a CLI `../_shared/contexto/contexto.mjs` com raiz explícita: `flow load`, `flow claim` e `flow next`. SQLite é a fonte operacional; manifesto/estado Markdown são projeções/referências. Renove o lease; nunca tome outra sessão sem verificar que parou. Retomada compara eventos, Git, hashes e recibos, sem repetir commits/merges/índice/remoções comprovados.

## Executar somente a próxima ação

- PREPARE_WORKTREE: `flow prepare` cria ou retoma apenas worktree do lote e prepara contexto automaticamente, inclusive dependências aprovadas. Preserve a branch/base final; não troque checkout principal durante o lote.
- IMPLEMENT/CORRECT/CORRECT_QA: delegue ao implementador-de-ticket. Gere `pack` por papel/modo, passando especificação, worktree, base/HEAD, critérios por ID, arquivos/contratos pertinentes, evidências e saída JSON. Correção recebe somente IDs autorizados e seu impacto. Use fechar-entrega **na mesma sessão executora**, sem outro agente para copiar metadados.
- REVIEW/REVALIDATE: revisor-de-codigo independente. Uma revisão completa por escopo inicial; depois IDs corrigidos e raio de impacto. Padrão usa um revisor com os três checklists; especialistas adicionais só por risco crítico concreto.
- AUDIT: auditor-de-review independente do implementador/revisor. Grave decisões APLICAR/ADIAR/REJEITAR fundamentadas antes da correção, com `audit_decision`. Auditor não implementa nem verifica a própria correção.
- AUDIT_NA: registre NA_SEM_ACHADOS deterministicamente, referenciando review completo/SHA, somente sem achados em simples/padrão. Não abra agente para repetir ausência de achados.
- QA: obrigatório em R3/R4 ou QA condicional por risco sem cobertura. revisor-de-qa independente mantém matriz critério → cenário → execução → evidência; PASS exige observação. QA_COVERAGE em R0–R2 registra COBERTO_NO_REVIEW com todos os critérios, checks determinísticos e evidências do revisor independente; nunca QA PASS não executado nem dispensa por orçamento. INTEGRATED_QA_COVERAGE aplica a mesma política às interações integradas. Legados preservam seus gates até classificação explícita.
- AUDIT_INTEGRATED_FINDINGS/ROUTE_INTEGRATED_CORRECTIONS/CORRECT_INTEGRATED_QA: audite novos achados e identifique as tarefas responsáveis por evidência; devolva correção às branches delas, revalide e crie candidata nova. Não repita o gate falho sem alteração material nem corrija na candidata. BLOCKED integrado isola as tarefas afetadas, preservando o trabalho.
- INTEGRATE: `flow integrate` somente nos grupos prontos; depois checks automáticos permitidos e review/auditoria/QA integrados focais. Registre `flow receipt`; não repita análises individuais válidas. Perfil crítico atual mantém auditoria integrada independente.

O runtime devolve transições; o cliente de IA chama seus executores nativos. Prefira contextos novos com handoffs compactos, sem herdar a conversa completa. Devolva evento, IDs, status, SHA, referências e limitações; relatório completo fica em arquivo. A CLI não invoca APIs/modelos nem opera assinaturas com o cliente fechado. Indisponibilidade de sessão independente exigida bloqueia o gate.

Registre resultados com `flow event`, usando revisão esperada, snapshot e ID estável. Conflito exige releitura. Agrupe correções APLICAR compatíveis em uma rodada; registre round_id novo por decisão e preserve contadores compartilhados por ticket entre camadas. Máximo três rodadas técnicas e três de QA. Nova implementação invalida evidências afetadas; documentos históricos não executáveis preservam o snapshot de código. Sem mudança material, não reaudite ADIAR/REJEITAR.

## Bloqueios e entrega

Isole falhas reais com `flow isolate`; dependentes também são isoladas e independentes seguem. Não pause para decisões de negócio no meio do lote: registre a lacuna. Conflito, ausência de credencial, critério essencial não executado ou falta de isolamento de banco não autorizam contorno. Candidata reprovada permanece preservada; `flow candidate` cria outra, excluindo bloqueadas/dependentes, sem reset ou alteração de histórico.

Gere pacote preliminar com `flow package`. Encerre executores, execute `flow cleanup-check` e só remova com recibo seguro; `flow cleanup` usa Git sem force, preservando branches e arquivando contexto. Links/junctions, ignorados únicos, estado sujo ou arquivos operacionais desconhecidos bloqueiam limpeza. Nunca remova worktree externa ao lote nem siga link para apagar destino. Entregue branch aprovada no checkout principal limpo com `flow deliver`; se estiver sujo, preserve-o e informe comandos. Testes manuais de telas seguem convenção local, no checkout principal.

Gere o pacote final após limpeza/entrega e complemente apenas explicações funcionais, decisões e roteiro humano que scripts não podem escrever. Informe resultado honesto, branches/SHAs, checkouts trocados ou impedimentos, evidências, dívidas, isoladas e inventário removidas/mantidas. PRONTO_PARA_REVISAO_HUMANA exige gates e limpeza necessários; PARCIAL_COM_BLOQUEIOS preserva o que foi aprovado; BLOQUEADO quando nada foi entregue. Registre métricas reais quando disponíveis, indisponíveis como desconhecidas; não prometa percentual de economia sem comparação.

Invariantes: sem código em main/master, push/PR, force/reset/rebase destrutivo, exclusão de branches, dados/.env de produção, dependência nova silenciosa ou apropriação de alterações alheias. Banco exige prova de isolamento pelas regras locais. ClickUp e qualquer publicação externa exigem autorização própria; preparar resumo não publica.
