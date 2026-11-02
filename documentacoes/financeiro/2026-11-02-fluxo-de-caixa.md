# Fluxo de caixa com contas recorrentes e lançamentos manuais

Data: 2026-11-02, America/Sao_Paulo. Domínio: financeiro. Autor: Claude Code (pedido do usuário).
Solicitação: "adicione mais uma página em financeiro: /setores/financeiro. Precisamos construir uma
espécie de fluxo de caixa e dentro deste fluxo de caixa precisa ser possível registrar contas a pagar
que são frequentes. Precisa também adicionar entradas e saídas manuais."
Branch: `developer`. HEAD inicial: `c5427047db13c8bb84e3a635298e94e89105caea`.
Base remota (merge-base com `origin/main`): `54a9aa78812e7772493b9fa5721a2e0a268bfb33`.
Estado inicial da árvore: já havia alterações de terceiros não commitadas
(`documentacoes/backlog/00-BACKLOG MANUAL/*` e `documentacoes/planejamento-ia/lote-2026-11-01-login-multi-org.*`);
foram preservadas e não fazem parte desta entrega.
Estado: implementado e validado por testes automatizados (unitários, HTTP e integração com PostgreSQL
descartável). Teste de tela manual pendente (roteiro abaixo).

Diffs completos: [2026-11-02-fluxo-de-caixa-diffs.md](2026-11-02-fluxo-de-caixa-diffs.md).

## Atualização (2026-11-02): painéis laterais e categorias

Pedidos do usuário na mesma sessão: "separe a tela de cadastrar conta recorrente para abrir em um modal
off canvas do lado direito" e "precisamos também cadastrar categorias de entradas e saídas... também em
um offcanvas lateral".

- **Off-canvas** (`_components/PainelLateral.tsx`): `<dialog>` nativo aberto com `showModal()`,
  ancorado à direita (`fluxo-de-caixa.module.css`, `.painelLateral`). Foco preso, Esc fecha, clique no
  fundo fecha, animação desligada com `prefers-reduced-motion`, margens de safe-area. O conteúdo é
  remontado a cada abertura (formulário limpo). `FormularioAcao` dispara o evento DOM
  `fluxo:acao-concluida` no sucesso; o painel da conta recorrente fecha com ele, o de categorias fica
  aberto (`fecharAoConcluir={false}`) para cadastros seguidos.
- **Nova conta recorrente** saiu do rodapé da seção e abre pelo botão no cabeçalho de "Contas recorrentes".
- **Categorias**: botão "Categorias" no cabeçalho de "Novo lançamento" abre o painel com cadastro (tipo +
  nome) e listas de entrada e saída com exclusão.
  - Banco: migration `0003_categorias_fluxo.up.sql`, tabela `financeiro.categorias`, índice único
    `(tipo, lower(nome))`. Carga inicial: categorias já usadas em lançamentos/contas e um conjunto
    editável (Vendas, Aporte de sócios, Outras entradas; Aluguel, Salários, Impostos, Fornecedores,
    Serviços, Outras saídas).
  - API: `POST /v1/fluxo-caixa/categorias` (409 se duplicada), `DELETE /v1/fluxo-caixa/categorias/:id`;
    `GET /v1/fluxo-caixa` devolve `categorias`. **Regra nova**: lançamento só aceita categoria
    cadastrada do mesmo tipo e conta recorrente só aceita categoria de saída (400 caso contrário); o
    nome é gravado com a grafia do cadastro.
  - Lançamentos e contas continuam guardando o **nome** (texto), sem FK: excluir uma categoria não muda o
    histórico, só a tira das opções. Alternativa descartada: FK por id, que impediria excluir categoria
    usada ou exigiria exclusão lógica — decisão mais simples para o MVP, reversível com nova migration.
  - Web: o campo categoria virou lista (`SeletorCategoria.tsx`); no lançamento a lista acompanha o tipo
    escolhido (componente cliente), na conta recorrente mostra só saídas.
- Arquivos novos: `PainelLateral.tsx`, `Categorias.tsx`, `SeletorCategoria.tsx`,
  `0003_categorias_fluxo.up.sql`. Alterados: `FormularioAcao.tsx`, `NovoLancamento.tsx`,
  `ContasRecorrentes.tsx`, `actions.ts`, `fluxo-de-caixa.module.css`, `fluxo-caixa-{formato,acoes,api}.ts`,
  contrato `fluxo-caixa.ts`, `dominio.ts`, `repositorio(.pg).ts`, `validacao.ts`, `fluxo-caixa.service.ts`,
  `fluxo-caixa.controller.ts` e os três arquivos de teste.

Validações desta atualização:

| Comando | Resultado |
| --- | --- |
| `node --test apps/api/dist/fluxo-caixa/*.test.js` | 19 ok (novo teste HTTP de categorias e ordenação no domínio) |
| Integração PostgreSQL (`TEST_DATABASE_URL=...[REDACTED]... node --test apps/api/dist/integracao-pg.test.js`) | 6 ok (novo caso de categorias; banco temporário criado e removido) |
| `node --test app/fluxo-caixa.test.ts` (web) | 6 ok |
| `pnpm --filter @nucleos/web lint`, ESLint e Prettier nos arquivos da entrega | OK |
| `pnpm run build` | OK |
| `bash infrastructure/docker/scripts/migrar-banco.sh` | aplicou `0002` (antes, a pedido do diagnóstico) e `0003` no `nucleos_dev` |

Teste de tela (manual) adicional: abrir "Nova conta recorrente" (painel entra pela direita, Esc e ✕
fecham, cadastro fecha o painel e a conta aparece na tabela); abrir "Categorias", cadastrar "Marketing"
(saída), tentar "marketing" de novo (mensagem de duplicada), excluir; no Novo lançamento trocar o tipo e
ver a lista de categorias mudar; testar em ~400 px (painel ocupa a largura toda). **A API em execução
precisa ser reiniciada** para carregar as rotas novas.

## Objetivo, contexto e escopo

O setor Financeiro tinha só o [painel de vendas Hotmart](2026-11-01-painel-de-vendas-hotmart.md).
Esta entrega cria a página **Fluxo de caixa** em `/setores/financeiro/fluxo-de-caixa`, ligada a partir
de `/setores/financeiro`, com:

- **Lançamentos manuais**: entradas e saídas avulsas (descrição, categoria, valor, data), com exclusão.
- **Contas a pagar recorrentes (mensais)**: descrição, categoria, valor previsto, dia de vencimento,
  primeiro mês e último mês opcional. Em cada mês a conta aparece como *A vencer*, *Atrasada* ou *Paga*.
- **Registro do pagamento**: vira uma saída vinculada à conta e ao mês de competência, com valor e data
  reais (o valor pode diferir do previsto, como em contas de consumo). Pode ser desfeito.
- **Visão mensal**: saldo inicial (acumulado até o mês anterior), entradas, saídas, saldo do mês,
  contas a pagar em aberto e saldo projetado; extrato com saldo corrido; navegação entre meses.
- Encerrar (com último vencimento), reativar e excluir conta (exclusão só sem pagamento registrado).

Fora do escopo (decisões tomadas sem entrevista, por serem padrões seguros; ver pendências):

- Integrar as vendas da Hotmart como entradas automáticas.
- Periodicidades além de mensal (semanal, anual) e edição de uma conta já cadastrada.
- Múltiplas moedas e múltiplas contas bancárias/caixas: tudo em BRL, um caixa só.
- Autorização por papel/usuário (continua a chave de serviço provisória, como no painel de vendas).
- Contas atrasadas de meses anteriores somadas no mês atual (a projeção é por mês).

## Resumo da implementação

```mermaid
flowchart LR
  U[Navegador] -- form + Server Action --> W[Next.js server<br/>actions.ts]
  W -- valida FormData<br/>fluxo-caixa-formato.ts --> W
  W -- Bearer VENDAS_API_KEY --> A[API NestJS<br/>/v1/fluxo-caixa]
  A -- valida corpo<br/>validacao.ts --> S[ServicoFluxoCaixa]
  S --> R[(financeiro.lancamentos<br/>financeiro.contas_recorrentes)]
  S -- montarFluxo puro --> A
```

- **Banco** (`0002_fluxo_caixa.up.sql`, schema `financeiro` do banco único): `contas_recorrentes` e
  `lancamentos`. Meses guardados como dia 1 (`date`), valores em centavos `bigint > 0`. O banco garante as
  regras críticas mesmo sem a API: pagamento de conta é sempre `saida` com competência; **índice único
  parcial** `(conta_recorrente_id, competencia)` impede pagar duas vezes o mesmo mês; FK `ON DELETE
  RESTRICT` impede apagar conta com pagamento; `fim >= inicio`.
- **Ocorrências derivadas, não materializadas**: as contas do mês são calculadas a partir da vigência
  (`inicio..fim`) e do dia de vencimento (31 vira 30/28/29 em meses curtos). Só o pagamento é gravado.
- **API** (`apps/api/src/fluxo-caixa/`): `GET /v1/fluxo-caixa?mes=AAAA-MM` (padrão: mês corrente em São
  Paulo), `POST /lancamentos`, `DELETE /lancamentos/:id`, `POST /contas`, `POST /contas/:id/pagamentos`,
  `POST /contas/:id/encerrar`, `POST /contas/:id/reativar`, `DELETE /contas/:id`. Mesmo
  `ChaveServicoGuard` e mesma chave (`VENDAS_API_KEY`) do painel de vendas. Respostas de erro com
  mensagens fixas, sem eco do que foi enviado: 400 (validação), 404, 409 (pagamento duplicado, conta com
  pagamento, encerramento antes de mês pago), 401/503.
- **Web** (`apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/`): Server Component busca o mês no
  servidor; formulários usam Server Actions com `useActionState` (botão desabilitado durante o envio,
  mensagem de retorno, revalidação da página no sucesso). O formulário é validado no servidor web antes
  de chamar a API (valor em reais → centavos sem float, ids só dígitos). A chave nunca chega ao navegador.

## Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `packages/contracts/src/fluxo-caixa.ts` | Novo contrato TS: `Lancamento`, `ContaRecorrente`, `ContaDoMes`, `ResumoFluxoCaixa`, `FluxoCaixaMes`, payloads de criação |
| `packages/contracts/src/index.ts` | Exporta o novo contrato |
| `apps/api/migrations/0002_fluxo_caixa.up.sql` | Tabelas, CHECKs, índice de data e índice único parcial |
| `apps/api/src/fluxo-caixa/calendario.ts` | Meses `AAAA-MM`, último dia, vencimento ajustado, soma de meses, faixa de anos 2000–2100 |
| `apps/api/src/fluxo-caixa/dominio.ts` | `montarFluxo` puro: saldo corrido, totais, status das contas do mês, projeção, vigência |
| `apps/api/src/fluxo-caixa/validacao.ts` | Validação estrita dos corpos (campos desconhecidos recusados, sem caracteres de controle, teto de R$ 1 bi) |
| `apps/api/src/fluxo-caixa/repositorio.ts` / `repositorio-pg.ts` | Interface e implementação SQL parametrizada; traduz `23505` e `23001/23503` em erros de domínio |
| `apps/api/src/fluxo-caixa/fluxo-caixa.service.ts` | Regras: pagamento só dentro da vigência, encerramento não deixa mês pago de fora |
| `apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts` / `.module.ts` | Rotas HTTP, mapeamento de erros, módulo dinâmico com repositório injetável |
| `apps/api/src/main.ts` | Registra o módulo quando há `DATABASE_URL` |
| `apps/api/src/fluxo-caixa/dominio.test.ts` | Unitários de calendário, domínio e validação |
| `apps/api/src/fluxo-caixa/fluxo-caixa.http.test.ts` | HTTP com repositório em memória que imita índice único e FK |
| `apps/api/src/integracao-pg.test.ts` | Novo caso no PostgreSQL real descartável |
| `apps/web/lib/vendas-api.ts` | `configuracao()` exportada para reuso (sem mudança de comportamento) |
| `apps/web/lib/fluxo-caixa-api.ts` | Cliente servidor da API (GET/POST/DELETE, timeout, falhas tipadas) |
| `apps/web/lib/fluxo-caixa-formato.ts` | Funções puras: reais↔centavos, meses, leitura dos formulários |
| `apps/web/lib/fluxo-caixa-acoes.ts` | Regras das Server Actions (validam e chamam a API; mensagens fixas) |
| `apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/page.tsx`, `actions.ts`, `_components/*.tsx`, `fluxo-de-caixa.module.css` | Página, ações e componentes (Resumo, Novo lançamento, Contas do mês, Movimentações, Contas recorrentes, FormularioAcao) |
| `apps/web/app/(app)/setores/financeiro/page.tsx` | Cartão "Fluxo de caixa" |
| `apps/web/app/fluxo-caixa.test.ts` | Testes de formato, formulários, ações (fetch simulado) e estados de carga |
| `documentacoes/dados/banco-unico-nucleos.md` | Mapa de schemas com as duas tabelas novas |

## Decisões técnicas

- **Ocorrência derivada vs. tabela de parcelas**: gerar linhas por mês exigiria job ou geração
  antecipada e reconciliação ao editar a conta. Derivar da vigência é simples e sempre consistente; o
  custo é recalcular por mês (barato: poucas contas).
- **Pagamento como lançamento**: o extrato e o saldo têm uma única fonte (`lancamentos`). Desfazer
  pagamento = excluir o lançamento. O índice único parcial dá idempotência no banco, inclusive contra
  dois cliques simultâneos.
- **Competência ≠ data**: a conta de outubro pode ser paga em novembro; ela aparece *Paga* em outubro e a
  saída entra no saldo de novembro. Consequência: o "saldo projetado" de outubro não desconta esse valor
  (ele já não está "a pagar" e a saída pertence a novembro).
- **Encerrar em vez de excluir**: preserva histórico; o padrão é o mês corrente como último vencimento e
  a API recusa um último mês anterior a uma competência já paga.
- **Mesma chave de serviço do painel de vendas**: evita nova variável de ambiente; ambas as rotas ficam
  no mesmo limite provisório até o IAM.
- **Server Actions** em vez de expor a API ao navegador: a chave fica no servidor e não há CORS. Elas
  são endpoints POST públicos do servidor web, como a ação do painel de vendas (ver riscos).

## Validações executadas

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @nucleos/contracts build` e `pnpm --filter @nucleos/api build` | OK |
| `node --test apps/api/dist/fluxo-caixa/*.test.js` | 18 testes, 18 ok |
| `TEST_DATABASE_URL=postgres://nucleos_dev:[REDACTED]@127.0.0.1:15432/postgres node --test apps/api/dist/integracao-pg.test.js` | 5 ok (inclui o novo caso). Banco temporário próprio criado e removido; `nucleos_dev` não foi tocado. A primeira execução falhou e revelou que `ON DELETE RESTRICT` gera `23001`; corrigido |
| `node --test app/fluxo-caixa.test.ts` (em `apps/web`) | 5 ok |
| `pnpm run lint` (tsc de todos os pacotes) | OK |
| `npx eslint` nos arquivos da entrega | 0 erros (avisos `security/*` do mesmo tipo dos já existentes no painel de vendas) |
| `pnpm run lint:arch` (dependency-cruiser) | sem violações |
| `npx prettier --check` nos arquivos da entrega | OK |
| `pnpm run build` | OK; rota `ƒ /setores/financeiro/fluxo-de-caixa` gerada |
| `pnpm --filter @nucleos/web test` | 30 ok |
| `pnpm --filter @nucleos/api test` | 52 ok, 2 falhas **pré-existentes**: `dist/funcionarios/*.test.js` compilados de outro trabalho, sem fonte em `src/` |
| `pnpm --filter @nucleos/contracts test` | 198 ok, 3 falhas **pré-existentes** de drift em `src/generated` causadas por `core.autocrlf=true` (arquivos gerados não alterados) |
| `pnpm run test` (turbo) | parou em `@nucleos/config` (6 falhas **pré-existentes** de dono/symlink de arquivo no Windows; pacote não alterado) |
| `make lint` / `make test` | **não executáveis** neste checkout: o caminho com espaço (`Projetos Dev`) quebra `check-env` no Makefile. Os alvos internos foram rodados diretamente, como acima; o `eslint .` completo falha com `EPERM` em `.pytest_cache`, por isso rodou nos caminhos da entrega |

Exemplos da lesson 18: o exemplo TypeScript rodou com `node ex18.ts` (saída `ok`); o SQL rodou num banco
temporário `licao18_tmp` (criado e removido com `DROP DATABASE ... WITH (FORCE)`) e produziu exatamente
os SQLSTATE documentados (23505, 23514, 23001).

Não executado: migração no banco de desenvolvimento `nucleos_dev` (mudança de estado compartilhado,
deixada para o usuário), `make test-ambientes`, testes de tela.

## Roteiro de teste manual (tela)

Pré-requisito: `bash infrastructure/docker/scripts/migrar-banco.sh` (exige `make build`), API e web no ar.

1. `/setores/financeiro` mostra o cartão **Fluxo de caixa**; abrir.
2. Sem dados: seis cartões em R$ 0,00, mensagens de vazio nas tabelas.
3. Novo lançamento: entrada de R$ 1.000,00 hoje → aparece no extrato, Entradas e Saldo do mês sobem.
4. Saída de R$ 19,90 → saldo corrido cai; **Excluir** a remove.
5. Nova conta recorrente "Aluguel", R$ 2.000,00, dia 31, primeiro mês = mês atual → aparece em *Contas a
   pagar do mês* com vencimento no último dia do mês; Contas a pagar = R$ 2.000,00; saldo projetado desconta.
6. **Registrar pagamento** com valor R$ 2.050,00 → status *Paga*, "previsto R$ 2.000,00", saída no
   extrato com origem "Conta recorrente · MM/AAAA". Repetir não é possível (o botão some); **Desfazer**
   volta a *A vencer/Atrasada*.
7. Navegar **Próximo mês**: saldo inicial = saldo final do mês anterior; a conta aparece de novo.
8. Encerrar a conta com último vencimento = mês atual → *Encerrada* a partir do mês seguinte; **Reativar**
   desfaz. **Excluir** com pagamento mostra a mensagem de conflito; sem pagamento, exclui.
9. Tema claro e escuro, largura de celular (~400 px: tabelas rolam na horizontal), navegação por teclado.
10. Desligar a API → mensagem de indisponibilidade, sem detalhes técnicos.

## Impactos, riscos e rollback

- **Compatibilidade**: aditivo. Nenhuma rota, tabela ou variável existente mudou; `configuracao()` só
  passou a ser exportada.
- **Segurança**: SQL parametrizado; ids validados por regex nos dois lados; corpos estritos; erros sem
  eco. **Risco conhecido**: assim como o botão do painel de vendas, as Server Actions podem ser chamadas
  por qualquer pessoa que alcance o servidor web, porque ainda não há login real; quem acessa a página
  pode criar e excluir lançamentos. Mitigação atual: servidor só em `127.0.0.1`. Bloqueante antes de
  qualquer exposição: IAM/autorização por papel.
- **Dados**: sem dados pessoais. Exclusões são físicas (sem trilha de auditoria) — ver pendências.
- **Observabilidade**: as requisições passam pelo middleware de observabilidade existente da API.
- **Rollback**: reverter o código remove a página e as rotas. A migration é forward-only (ADR-017): as
  tabelas ficam no banco sem uso; para removê-las, nova migration com `DROP TABLE`.
- `<input type="month">` não tem seletor nativo em alguns navegadores desktop (vira texto); o servidor
  exige `AAAA-MM` e responde com mensagem clara.

## Commits e diffs

Nenhum commit criado nesta tarefa (não houve pedido explícito). Diffs da árvore de trabalho (unstaged e
arquivos novos), restritos a esta entrega, em
[2026-11-02-fluxo-de-caixa-diffs.md](2026-11-02-fluxo-de-caixa-diffs.md). `apps/web/next-env.d.ts`, alterado
automaticamente pelo `next build`, foi restaurado. Arquivos de documentação desta entrega (fora do patch):
este documento, o de diffs, `documentacoes/dados/banco-unico-nucleos.md`, a lesson 18 e
`lessons/README.md`.

## Lessons

- Criada: [18 - Mutacoes com Server Actions e integridade no PostgreSQL](../../lessons/18%20-%20Mutacoes%20com%20Server%20Actions%20e%20integridade%20no%20PostgreSQL.md).
- Relacionadas (sem alteração): [00 - Migracoes SQL forward-only](../../lessons/00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md)
  e [17 - Painel de dados com Server Components](../../lessons/17%20-%20Painel%20de%20dados%20com%20Server%20Components%20no%20Next.js.md).

## Pendências

- Migrations `0002` e `0003` já aplicadas no `nucleos_dev`; falta reiniciar a API em execução e
  executar o roteiro manual de tela.
- Decidir com o usuário: entradas automáticas a partir das vendas Hotmart; periodicidade anual/semanal;
  edição de conta (reajuste de valor); contas atrasadas de meses anteriores no mês atual; múltiplos
  caixas; trilha de auditoria/exclusão lógica.
- Autorização real (IAM) antes de expor a página fora de `127.0.0.1`.
- Ambiente: `make` não funciona com espaço no caminho do checkout; `dist/funcionarios` obsoleto em
  `apps/api`; drift CRLF em `packages/contracts/src/generated` — todos anteriores a esta entrega.

## Verificação de P0 para o lote financeiro/funcionários (2026-11-02)

Autorização explícita do usuário para concluir P0 e criar commits locais recebida em 2026-11-02.
Escopo do commit: somente o fluxo de caixa, migrations 0002/0003, testes, contratos,
mapa do banco, esta documentação e lesson 18. Regras, skills e backlogs preexistentes
não pertencem ao commit. Base antes de P0: `c5427047db13c8bb84e3a635298e94e89105caea`.

Verificações repetidas nesta sessão (logs locais em `.run/lote-1102-p0-*.log`):

- `pnpm run build`: PASS, 7 tarefas.
- `pnpm run lint`: PASS, 10 tarefas (tipos; não equivale ao lint completo).
- `node --test apps/api/dist/fluxo-caixa/*.test.js`: PASS, 19 testes.
- Em `apps/web`, `node --test app/fluxo-caixa.test.ts`: PASS, 6 testes.
- `make lint`: falha antes dos checks por invocação de shell/caminho com espaços no Windows.
- `pnpm run lint:quality`: bloqueado por EPERM ao percorrer `.pytest_cache` preexistente.
- `pnpm run test`: falha em testes preexistentes de `packages/config`, que exigem
  caminhos absolutos e permissões Unix. Não foi declarado PASS da suíte geral.
- Integração PG, testes Python e build Python não foram repetidos nesta etapa.

As verificações gerais pendentes precisam ser resolvidas em ambiente compatível antes
  da aprovação técnica do lote. Este registro não substitui revisão independente nem teste manual.
O commit desta preparação pode ser localizado por `git log --grep='concluir base de fluxo de caixa'`;
a lista final de commits do lote será registrada no relatório da execução.