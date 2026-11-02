# Revisão corretiva independente — frente A

Data: 2026-11-02 (America/Sao_Paulo). Domínio: funcionários.
Revisor: Codex `/root/review_a`, sessão distinta do executor.
Modo: REVISAO_CORRETIVA_ENXUTA, um ciclo autorizado pelo manifesto §6.
Branch: `feat/lote-1102-a-funcionarios`.
Base: `a2aa0ccc56938dd1e27ffaf52cd24646d68848dd`.
Candidata recebida: `62bc66292fc9f7cfb84caf415d9eec24f5af8453`; árvore inicialmente limpa.
Estado: PASS no escopo A; achados RA-01 e RA-02 corrigidos e verificados. Não representa integração nem aceite visual.

Escopo: FUN-001…FUN-006, comparados à especificação canônica e ao
[registro de entrega](../funcionarios/2026-11-02-modulo-funcionarios-virtuais.md).
Fora: frentes financeiras B/M/C/D, banco de desenvolvimento, deploy e testes de tela.
Não houve segunda revisão completa, auditor ou QA por IA.

## Achados e correções

| ID | Impacto | Cenário e causa comprovados | Correção |
| --- | --- | --- | --- |
| RA-01 | MÉDIO | Na candidata, `planejar`/`publicar` travavam agendamento antes da atribuição; `configurarAtribuicao`/`salvarAgenda` faziam o inverso. O editor segurava a atribuição, o planner segurava sua agenda e esperava o editor; a atualização da agenda pelo editor falhou por `lock_timeout`. A reivindicação começava pela fila, acrescentando outra ordem inversa. | Atribuição primeiro em planner, publicação e reivindicação; releitura bloqueada do filho depois do lock do pai. Publicadores com vários pais usam ordem de ID da atribuição. Dedupe apenas consulta o histórico existente, sem um UPDATE desnecessário que poderia disputar sua conclusão. |
| RA-02 | ALTO | `SincronizacaoVendas.executar` retorna um objeto de falha sem lançar. O adaptador do handler o devolvia normalmente; uma resposta Hotmart 401 simulada resultou em execução `SUCESSO`, sem backoff nem falha no histórico. | O adaptador traduz `resultado= falha` em erro de mensagem fixa para o protocolo do motor. No teste, o motor aplica o padrão de três tentativas e termina em `FALHA`; o botão mantém seu formato de resposta e recebe o resultado da primeira tentativa, enquanto os retries seguem na fila. |

Localização das correções: `apps/api/src/funcionarios/motor.ts` (enfileiramento,
planner, publicação, reivindicação e aguardar); `apps/api/src/vendas/vendas.module.ts`
(handler e retorno manual); regressões em `apps/api/src/funcionarios/funcionarios.http.test.ts`.

Referências no estado corrigido: `motor.ts:118` (planner), `motor.ts:180` (publicação), `motor.ts:221` (reivindicação), `vendas.module.ts:53` (falha do handler) e `vendas.module.ts:76` (resposta manual).

A releitura após o lock evita usar versão/ocorrência obtida antes de uma edição.
O `SKIP LOCKED` continua na aquisição do pai e da fila; a versão e o fencing permanecem
verificados. Heartbeat e conclusão não tentam adquirir locks de pai depois da fila.
A conclusão continua protegida por tentativa, dono, estado e validade da lease.
Nenhuma migration foi alterada nesta revisão.

## Evidências e verificações

| Verificação | Resultado real |
| --- | --- |
| Regressões acrescentadas antes de corrigir a candidata, `.run/revisao-a-pg.mjs` | FAIL esperado: ciclo de espera (`lock_timeout`) e `SUCESSO` indevido da falha Hotmart; log `.run/revisao-a-pg-antes.log` |
| `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json` após correções | PASS |
| `node .run/funcionarios-pg.mjs` após a versão final do código | PASS, 22 testes PG/HTTP, 0 falhas/skip; `.run/funcionarios-pg.log` |
| `node --test apps/api/dist/vendas/atualizacao.test.js` | PASS, 1 teste; `.run/revisao-a-atualizacao.log` |
| ESLint nos três arquivos de código/teste alterados | PASS, 0 erros, 1 aviso preexistente de leitura de fixture; `.run/revisao-a-eslint.log` |
| Prettier focal e `git diff --check` do código/testes | PASS |
| Links relativos dos 6 documentos alterados/criados | PASS, 44 links verificados, 0 ausentes; `.run/revisao-a-links.mjs` |

O harness verifica o bind `127.0.0.1:15432` do PostgreSQL core, captura a credencial
sem imprimi-la e usa somente banco temporário criado e removido pelo teste. Hotmart
foi simulada; nenhuma conta/API externa foi consultada com credenciais.

Os checks anteriores de build TS/Python, contratos, unitários de agenda e web foram
consultados como evidência da candidata. Não foram repetidos sem mudança pertinente.
Lint/suíte gerais não são declarados PASS: permanecem as limitações de Windows e
11 arquivos preexistentes fora do Prettier já documentados pelo executor.

## Cobertura e limites

- Modelo/seed/FKs: leitura das migrations e regressão PG de integridade e seed.
- Concorrência: dois planners/consumidores, idempotência, overlap, retry, heartbeat,
  recuperação de lease e fencing cobertos na suíte PG; três regressões novas exercitam
  editor concorrente com planner, publicador e consumidor.
- API/configuração: guard de chave de serviço, autorizador local, consultas parametrizadas,
  campos permitidos, schema JSON, nomes de segredo e estados não executáveis rastreados.
- Hotmart: somente o caminho de fila no bootstrap real; botão testado com sucesso e 401
  simulados. Estado de execução/falhas não depende de a integração legada lançar exceções.
- Telas: inspeção de chamadas Server Actions, formulários, escaping React e chave somente
  no servidor. Não houve navegação de tela nem aprovação visual.

A independência desta sessão é de revisão; o teste manual do manifesto §8 segue pendente.
A aprovação é restrita ao escopo A e não valida frentes ainda não implementadas.

## Arquivos, documentação e diffs

Código/testes: `motor.ts`, `funcionarios.http.test.ts`, `vendas.module.ts` nos caminhos acima.
Documentação: este relatório, seu [patch](2026-11-02-frente-a-revisao-corretiva-diffs.md),
o registro da frente A e lessons 11/19 com índice atualizado. As lessons explicam a ordem
de locks e a distinção entre falha de negócio e protocolo de retentativa.

Nenhum commit criado nesta tarefa de revisão. Não há alterações staged da revisão.
O patch completo unstaged de código/testes está no documento de diffs; documentação e
lessons foram excluídas do patch para evitar recursão. O coordenador poderá criar o
commit local autorizado depois de conferir este parecer.

Rollback das correções: retornar à candidata preservaria os dois problemas; preferir
correção forward-only antes da integração. Sem mudança de schema, dados existentes ou
novas dependências. Observabilidade melhora: falha Hotmart passa a aparecer como erro
fixo/retentativa e depois FALHA, sem vazamento da resposta externa.

Nenhum achado médio/alto/crítico conhecido pendente no escopo revisto. Lint, formatação e diff conferidos.
Integração/checks globais e testes manuais pertencem às etapas seguintes do lote.

## Registro Git posterior pelo coordenador

Correções aprovadas da revisão registradas no commit `bc89f2ca7a87738e9de690b51303deb3c5606a72` —
`fix(funcionarios): corrigir locks e falhas Hotmart no motor`.
O patch do relatório corresponde exatamente aos três arquivos desse commit; documentação
e lessons ficam em commit separado, sem diff recursivo. Não houve nova alteração de código
depois dos checks finais do revisor. Integração e aceite visual continuam separados.
