# Funcionários virtuais: catálogo, motor durável e administração

Data: 2026-11-02, America/Sao_Paulo. Domínio: funcionários.
Tarefa: frente A, FUN-001 a FUN-006 do lote financeiro/funcionários.
Branch: `feat/lote-1102-a-funcionarios`. Base: `a2aa0ccc56938dd1e27ffaf52cd24646d68848dd`.
Autor: agente executor Codex, por autorização do usuário. Estado: revisão independente corretiva concluída no escopo A; integração pendente;
teste de tela manual pendente. O checkout começou sem alterações de implementação;
os cinco documentos de planejamento/backlog foram copiados pelo coordenador como insumo autorizado.

## Objetivo e escopo

Persistir Setor → Funcionário → Tarefa → Atribuição → Agendamento → Execução e tornar a
rotina Hotmart existente uma tarefa configurável desse motor. Inclui API administrativa,
menu dinâmico, catálogo, formulários, detalhes, agendamentos e histórico.
Não inclui as rotinas financeiras das frentes B–D/M, fiscal, login real, multi-tenant,
deploy, ativação de integrações externas nem o prédio 3D.

Referências: [plano](../planejamento-ia/lote-2026-11-02-financeiro-funcionarios.md),
[especificação](../planejamento-ia/lote-2026-11-02-financeiro-funcionarios-especificacao.md).

## Implementação e decisões

- Migrations 0004–0006 criam os schemas e tabelas, 6 setores, 50 tarefas, 17 funcionários
  e a atribuição/agendamento inicial de 30 minutos. Seeds reexecutáveis sem duplicação;
  integridade do setor da atribuição também garantida por FK composta.
- Apenas `financeiro.atualizar_dados` possui executor nessa frente. Tarefas planejadas
  não são agendáveis/executáveis. Na inicialização, ausência do handler torna a tarefa
  indisponível; o analista sem tarefas executáveis fica em rascunho. Depois de configurar
  credenciais e reiniciar, o administrador pode ativá-lo no painel.
- O registro aceita funções do backend, nunca código do navegador. AJV é reutilizado
  pelo pacote de contratos, sem dependência duplicada na API. Schemas validam sem coerção;
  nomes de segredo são recusados inclusive dentro de objetos e arrays.
- O planejador usa relógio PostgreSQL, bloqueio `SKIP LOCKED`, próxima ocorrência
  persistida e versão. A fila e o histórico são gravados na mesma transação. Intervalos
  perdidos não criam rajada: a ocorrência persistida é emitida e a agenda avança ao futuro.
- O consumidor usa lease de 5 minutos, heartbeat e fencing por tentativa/dono/estado/lease.
  Retentativas têm backoff exponencial e máximo configurável. As três políticas de
  sobreposição são explícitas. Cancelar uma tentativa não desfaz efeitos externos;
  handlers devem respeitar o sinal e garantir idempotência dos próprios efeitos.
- Eventos têm chave única e filtro JSON; podem ser publicados com o client da transação
  de negócio. Execuções manuais também registram auditoria transacional.
- O `Agendador` antigo não é registrado. Os dois endpoints manuais de vendas usam o
  mesmo motor e o botão síncrono preserva `ResultadoSincronizacao`. O advisory lock de
  vendas permanece. A extração da reconciliação diária fica explicitamente para FIN-101,
  conforme a alternativa autorizada na especificação FUN-003.
- `HOTMART_SYNC_INTERVAL` só inicializa a agenda ainda intocada. Edições no painel
  incrementam a versão e prevalecem nos reinícios. Cron tem 5 campos e fuso IANA;
  a extensão aleatória `H` não é aceita. `cron-parser` está fixado em **5.10.3**.
  API consultada na [documentação oficial](https://github.com/harrisiirak/cron-parser)
  e nos tipos da versão instalada em 2026-11-02.
- A API exige chave de serviço e usa o autorizador de admin local. Toda mudança
  administrativa tem auditoria. O endpoint `/v1/funcionarios/estado` reutiliza os dados
  reais do motor e seleciona a atividade de cada funcionário, sem truncar o histórico global.
- IDs `bigint` são strings no JSON, inclusive acima de `Number.MAX_SAFE_INTEGER`;
  a função SQL `json_ids` converte somente os campos identificadores do registro.
- `.gitattributes` mantém SQL de migrations, fontes TS/TSX/MJS/CJS e `lefthook.yml` em LF. Foi demonstrada diferença
  CRLF/LF na nova worktree com `core.autocrlf=true`: isso alteraria checksums e produzia
  drift falso. Os bytes de 0001–0003 foram comparados com o checkout principal e são
  idênticos após normalizar a cópia; o conteúdo de migrations já aplicadas não mudou.

## Arquivos

O [patch completo](2026-11-02-modulo-funcionarios-virtuais-diffs.md) lista as alterações
de código, testes e configuração por arquivo. Diretórios de implementação:

- `apps/api/src/funcionarios/`: agenda/validação, handlers/autorizador, repositório,
  motor, serviço, controller, módulo e testes unitários/HTTP/PG.
- `apps/api/migrations/0004_funcionarios_modelo.up.sql`, `0005_funcionarios_catalogo.up.sql`,
  `0006_funcionarios_hotmart.up.sql`: estrutura, catálogo e agenda inicial.
- `apps/api/src/main.ts`, `vendas/vendas.module.ts`, `vendas/vendas.controller.ts`,
  `vendas/atualizacao.test.ts`: composição do motor e migração do disparo de vendas.
- `packages/contracts/src/funcionarios.ts`, `config-tarefa.ts`, `index.ts`: contratos e AJV.
- `apps/web/app/(app)/funcionarios/`: páginas, ações, CSS e componentes de formulário.
  `apps/web/lib/funcionarios-api.ts`, `app/funcionarios.test.ts`, `app/components/AppShell.tsx`:
  cliente de servidor, testes e menu por setores da API.
- `.gitattributes`, `apps/api/package.json`, `pnpm-lock.yaml`: portabilidade e parser fixado.
- Este registro/patch, mapa do banco, lesson 11, lesson 19 e índice: documentação final.
  Os planos e backlogs autorizados também acompanham a branch.

## Validação executada

Node 24.22.2, TypeScript 5.9.3, pnpm 12.15.0; make invocado por alias 8.3 do Windows
para preservar caminhos com espaços. O log resumido final será registrado abaixo.

Resultados já comprovados:

- Tipos de contratos, API e web: PASS.
- Unitários de agenda/schema: 4 PASS.
- PostgreSQL/HTTP do módulo: 18 PASS; banco de teste temporário criado e removido.
  Sem migrations novas aplicadas ao `nucleos_dev`.
- `make build`: PASS, build TS/Next e pacotes Python.
- `make contracts-check`: PASS, sem drift e 11 contratos compatíveis.
- `make test` no Windows: FAIL em testes preexistentes de caminhos/permissões Unix
  de `packages/config`; não declarado PASS da suíte geral. O coordenador possui a
  execução complementar Linux dessa baseline, registrada no lote.
- `make lint`: tipos, ESLint e regras de arquitetura passaram na última tentativa;
  ela parou no Prettier por CRLF de 99 arquivos preexistentes. A cópia foi normalizada
  somente CRLF→LF, sem diff de conteúdo alheio, e a checagem de formatação foi repetida.
  O lint geral não recebeu PASS: etapas Python, segredos e regressões do próprio lint
  posteriores à falha não foram executadas nesta frente.
- ESLint explícito sobre todos os arquivos desta implementação: PASS, zero erros e
  10 avisos de análise conservadora de indexação; nenhum gate desativado.
- `node --test apps/api/dist/vendas/*.test.js apps/api/dist/fluxo-caixa/*.test.js apps/api/dist/funcionarios/agenda.test.js`:
  PASS, 53 testes, incluindo a regressão das vendas/fluxo de caixa e os 4 novos unitários.
- Em `apps/web`, `node --test app/funcionarios.test.ts`: PASS, 2 testes de cliente,
  indisponibilidade e mensagens sem chave/segredo na resposta.

Logs locais ignorados pelo Git: `.run/agenda-test.log`, `.run/funcionarios-pg.log`,
`.run/web-test.log`, `.run/make-lint-ultimo.log`, `.run/make-test.log`,
`.run/make-build.log`, `.run/contracts-check-final.log`. Não contêm credenciais reais.

## Aceites, impactos e pendências

FUN-001–004: implementados e cobertos por tipos/testes de modelo, concorrência,
segurança, API e integração simulada da Hotmart. FUN-005–006: implementados, tipados
e compilados; interação visual ainda NÃO VALIDADA. As APIs externas não foram acionadas.
A revisão independente está registrada abaixo. Checks integrados e aceite humano pertencem às etapas seguintes.

Uso autorizado somente local com admin único. Observabilidade: correlação, tempos,
status, tentativas e erro fixo por execução; auditoria administrativa. Não há logs de
payload/credencial. Rollback de aplicação: parar o motor e retornar à versão anterior
somente com plano de preservação do histórico; migrations são forward-only, sem apagar
dados. Nunca editar uma migration aplicada. Dependências futuras não foram implementadas
como tarefas fictícias disponíveis.

Roteiro manual A: abrir Funcionários → Financeiro e Fiscal → Analista → Tarefas;
conferir 30 min, alterar para 60, salvar, conferir próxima execução; executar agora e
ver histórico; pausar e reativar; criar rascunho; verificar planejadas sem botão de
agendamento; testar cadastro/edição e off-canvas em ~400 px e nos dois temas.

Lessons: [fila durável](../../lessons/11%20-%20Fila%20duravel%20em%20PostgreSQL%20com%20lease.md)
e [agendamento persistente](../../lessons/19%20-%20Agendamento%20persistente%20por%20intervalo%20cron%20e%20eventos.md).

## Commits e diffs

Commit de implementação: `03b571b588a8d49f923f086691678f61ef0e66f8` — `feat(funcionarios): implementar catalogo motor duravel e painel administrativo`.
O patch unificado desse commit, limitado a código/testes/configuração, está no documento de diffs.
O commit seguinte apenas fecha estes metadados; a lista completa de commits é obtida por
`git log a2aa0ccc56938dd1e27ffaf52cd24646d68848dd..HEAD`. Nenhum commit anterior à base pertence a esta frente.

Fechamento: Prettier focal PASS em todos os arquivos alterados; `git diff --check` de código/testes/configuração PASS;
links da documentação e do índice de lessons verificados (zero ausentes). A normalização de fontes reduziu o
formatter global a 11 problemas preexistentes de conteúdo em NavLink/layout, config e observability,
que não foram alterados por esta tarefa. O lint global continua sem PASS, pelos limites registrados acima.

Logs finais adicionais: `.run/prettier-diff.log`, `.run/eslint-final.log`, `.run/regressao-final.log`.
As 18 verificações PG foram repetidas depois da correção LF e do ajuste transacional da auditoria: PASS.
A ausência de aceite visual permanece explícita independentemente do commit técnico.

## Revisão corretiva independente (2026-11-02)

A sessão independente `/root/review_a` identificou e corrigiu RA-01 (ordem inversa
entre locks de atribuição/agendamento/fila) e RA-02 (falha Hotmart registrada como
SUCESSO). [Parecer e cobertura](../reviews/2026-11-02-frente-a-revisao-corretiva.md);
[patch completo das correções](../reviews/2026-11-02-frente-a-revisao-corretiva-diffs.md).

Mudanças: `motor.ts` usa atribuição antes dos filhos, relê o filho elegível e não
atualiza o histórico ao deduplicar. Publicadores bloqueiam vários pais em ordem de ID.
`vendas.module.ts` converte o retorno de falha em erro fixo para o motor aplicar
backoff. O botão recebe o resultado da primeira tentativa; retries seguem na fila
sem prolongar a requisição pelos intervalos de espera. A forma da resposta é preservada.

`funcionarios.http.test.ts` ganhou regressões para edição concorrente com planner,
evento e consumidor, além de 401 Hotmart simulado, retentativas e FALHA final.
Nenhuma migration, credencial, dependência nova ou dado de desenvolvimento foi alterado.
As lessons 11/19 e o índice foram alinhados ao mecanismo final e às decisões acima.

Verificações do revisor: build/tipos da API PASS; 22 testes PG/HTTP PASS (0 skip),
1 regressão do endpoint de atualização de vendas PASS; ESLint dos três arquivos PASS
(0 erros, 1 aviso preexistente de leitura de fixture); Prettier focal PASS e
`git diff --check` de código/testes PASS. O PostgreSQL usou somente banco temporário,
criado/removido no harness; Hotmart foi simulada. A suíte geral não foi declarada PASS.

Nenhum commit criado nesta tarefa de revisão; as correções permanecem unstaged para
o coordenador. A candidata original continua registrada pelos commits acima.
Não há achado médio/alto/crítico conhecido pendente no escopo revisto. Permanecem
pendentes os checks integrados e o teste/aceite visual manual; esta revisão não aprova telas.

## Registro Git posterior pelo coordenador

Correções aprovadas da revisão registradas no commit `bc89f2ca7a87738e9de690b51303deb3c5606a72` —
`fix(funcionarios): corrigir locks e falhas Hotmart no motor`.
O patch do relatório corresponde exatamente aos três arquivos desse commit; documentação
e lessons ficam em commit separado, sem diff recursivo. Não houve nova alteração de código
depois dos checks finais do revisor. Integração e aceite visual continuam separados.
