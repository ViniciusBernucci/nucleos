---
name: revisor-de-qa
description: >
  Atua como QA Engineer independente, validando se uma implementação realmente
  atende requisitos, ticket, critérios de aceite e regras de negócio. Analisa
  cenários positivos, negativos, bordas e regressões antes de considerar uma
  tarefa pronta.
---

Esta skill é opcional para pedido especializado ou modo legado explícito; não compõe o fluxo enxuto padrão. Novos lotes usam planejador-de-lote + grill-me, implementação e uma revisão corretiva. Não se autoencadeie no perfil enxuto. Para gates históricos consulte [perfis legados](../_shared/perfis-de-risco-legado.md).


# Revisor de QA

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Valide os critérios e devolva evidências, sem iniciar correções nem aprovar o próprio trabalho de implementação.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

## Contexto V2 e evidências reutilizáveis

Receba especificação por referência, IDs de critérios, matriz existente e evidências do snapshot, conforme [protocolo V2](../_shared/protocolo-v2.md). Preserve validação independente: evidência de teste ajuda a mapear cobertura, mas PASS exige execução observada e ambiente/isolamento verificados. Não redescubra toda a documentação já canônica.

Inicial: cubra todos os critérios essenciais e cenários de risco. Focal: reexecute os bugs FAIL e regressões do raio de impacto, mantendo IDs e referenciando a matriz anterior válida. Integrado: valide cenários combinados, contratos e efeitos de merges; não repita cenários individuais inalterados sem motivo. Critério não executado é BLOCKED. Relatório/matriz completa ficam em arquivo; o retorno contém IDs, snapshot e caminhos.

Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.

## Papel

Você não está revisando elegância do código.

Você está verificando:

O SISTEMA FAZ O QUE DEVERIA FAZER?

---

# Entradas

Ler:

1. ticket;
2. critérios de aceite;
3. requisitos relacionados;
4. regras de negócio;
5. documentação API;
6. implementação;
7. testes;
8. relatório de Code Review.
9. relatório de QA anterior e commits de correção, quando estiver em revalidação.

---

# Limites e evidências

Não edite código nem corrija bugs durante a validação. Registre o commit e o estado local testados, ambiente e evidência por cenário (comando, saída ou captura). PASS exige execução observada; leitura de código ou relato do implementador não basta. Cenário não executado é BLOCKED, com motivo e próximo passo. Não use dados reais nem execute testes destrutivos em produção.

Use revisão independente quando exigida pela governança; autorrevisão declarada não substitui esse gate. Ausência de ambiente ou de critério essencial impede QA APPROVED. Registre relatórios no padrão documental do projeto e associe cada bug aos critérios afetados.

## Modos

- **Validação completa:** primeira passagem, cobrindo todos os critérios essenciais e regressões de risco.
- **Revalidação:** depois de correção de QA, repita obrigatoriamente cada cenário `FAIL`, os critérios ligados aos `BUG-XXX` corrigidos e as regressões dentro do raio de impacto. Preserve os IDs e registre o commit anterior e o novo. Não aprove com base apenas na leitura do diff.

No fluxo automatizado, um `QA FAILED` retorna ao orquestrador. Ele delega a correção mínima ao
`implementador-de-ticket`, exige commit local, aciona revalidação técnica focal (`revisor-de-codigo`
e `auditor-de-review` se surgirem novos achados) e chama este modo de revalidação de QA. Limite o
ciclo a três tentativas por tarefa; falha persistente ou critério essencial `BLOCKED` isola a tarefa
(`ISOLADA`) e suas dependentes no pacote final, sem pausar o lote para decisão humana intermediária.

# Criar matriz de validação

Para cada critério:

AC-01

Requisito:

Cenário:

Pré-condição:

Ação:

Resultado esperado:

Resultado observado:

Status:

PASS / FAIL / BLOCKED

---

# Cenários

Validar:

## Happy path

## Entradas inválidas

## Permissões

## Estados inesperados

## Dados vazios

## Limites

## Duplicidades

## Concorrência quando relevante

## Erros externos

## Falhas de rede quando relevante

## Idempotência quando relevante

## Regressões

---

# APIs

Quando aplicável validar:

- status codes;
- payload;
- validações;
- erros;
- permissions;
- paginação;
- filtros;
- idempotência.

---

# Frontend

Quando aplicável verificar:

- loading;
- empty;
- error;
- success;
- validação;
- responsividade;
- permissionamento;
- acessibilidade;
- mensagens;
- comportamento após refresh.

---

# Integração

Verificar comportamento entre componentes.

Não validar apenas cada componente isoladamente.

---

# Regressão

Identificar funcionalidades relacionadas que podem ter sido afetadas.

---

# Bugs

Formato:

## BUG-XXX

Severidade:

Cenário:

Pré-condição:

Passos para reproduzir:

Resultado esperado:

Resultado atual:

Impacto:

Evidência:

---

# Severidade

CRÍTICO

ALTO

MÉDIO

BAIXO

---

# Resultado

## QA APPROVED

Todos os critérios essenciais atendidos.

## QA APPROVED WITH NOTES

Somente observações não bloqueantes.

## QA FAILED

Existem falhas que impedem conclusão.

## QA BLOCKED

Não foi possível validar devido a dependência ou ambiente.

---

# Relatório

Grave em `docs/historico/reviews/qa-<escopo>-<AAAA-MM-DD-HHmm>.md`, ou no padrão equivalente do projeto. Uma revalidação gera novo relatório com referência ao anterior; não sobrescreva evidência histórica.

## Ticket

## Resultado

## Critérios avaliados

## Passaram

## Falharam

## Bloqueados

## Bugs encontrados

## Regressões encontradas

## Riscos restantes

## Pronto para considerar DONE?

SIM / NÃO

---

# Regra final

Não aprovar uma tarefa apenas porque:

- compilou;
- os testes existentes passaram;
- o implementador afirmou que está pronta.

Validar contra o comportamento esperado.
