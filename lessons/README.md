# Trilha de lessons do Nucleos

Criada em 2026-10-25. Ultima atualizacao: 2026-11-02 (lesson 18 do fluxo de caixa: Server Actions de escrita e integridade no PostgreSQL; antes, em 2026-11-01, lesson 12 com diagnostico de conexao e ciclo de vida do ambiente; lessons 16 e 17 com token Basic e atualizacao por Server Action; lessons 12 e 13 revisadas para .env no MVP; lessons 16 e 17 do painel de vendas; lesson 00 atualizada com o banco unico; antes, lesson 14 marcada como conceitual apos a remocao dos mocks do front end).

`lessons/` e uma trilha progressiva e didatica da stack do projeto, nao um changelog.
A atualização de 2026-11-02 inclui a aplicação real da fila na lesson 11 e a lesson 19
de agendamento persistente, que combina as bases de fila, configuração e Server Actions.
A revisão corretiva da frente A acrescenta à lesson 11 a ordem de locks entre tabelas
e a tradução de falhas de negócio para retentativas, mantendo a mesma ordem da trilha.
A stack segue o [ADR de arquitetura do MVP](../documentacoes/transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md):
TypeScript (NestJS e Next.js), Python, Docker/Compose, PostgreSQL e seguranca.

## Pre-requisitos

- Logica de programacao basica e uso de terminal e Git.
- Node.js e `pnpm` (TypeScript) e Python com `uv`, nas versoes declaradas pelo repositorio
  apos ENT-FND-001.
- Docker e Docker Compose, usados apenas em ambiente local descartavel (`127.0.0.1`).

## Como esta trilha funciona

- As lessons nascem junto com as entregas que introduzem ou exercitam o conceito. Nao ha
  lessons de enchimento: se uma entrega nao toca um conceito relevante, nenhuma lesson e criada
  e a justificativa fica no documento da entrega.
- Nome de arquivo: `NN - Nome do conceito.md`, numeracao a partir de `00`, com zeros a esquerda.
- A ordem segue dependencia de aprendizagem, nunca a data de criacao. Ao inserir um conceito
  entre outros, renomeie os arquivos afetados e atualize este indice e todos os links.
- Cada lesson traz objetivo, pre-requisitos, modelo mental, ligacao com a entrega real,
  exemplos executaveis, erros comuns, verificacao, exercicios, datas e versoes de
  Node, TypeScript e Python usadas.

## Ordem pedagogica prevista

Blocos planejados (as lessons ja publicadas estao no indice abaixo; cada item vira um arquivo
numerado quando uma entrega o exercitar):

1. TypeScript: tipos, modulos e `strict`.
2. Monorepo com `pnpm` workspaces.
3. Python: tipagem, `pyproject.toml` e `uv`.
4. Docker e Docker Compose.
5. PostgreSQL: modelagem, migracoes e consultas.
6. NestJS e Next.js.
7. Seguranca: segredos, autenticacao, autorizacao e isolamento de dados.
8. Testes e CI.

## Indice de lessons

A numeracao segue dependencia de aprendizagem: qualidade estatica (02) e Compose (03) antes do CI (04), que repete esses alvos; logs/redacao (05) antes do isolamento de telemetria (06), que assume dado ja redigido. Em 2026-10-26 as lessons de CI (era 02) e telemetria (era 03) foram renumeradas para 04 e 06.

- [00 - Migracoes SQL forward-only no PostgreSQL](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md) (bloco 5; entrega DEC-003; atualizada em 2026-11-01 com o banco unico e schemas por assunto).
- [01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md) (bloco 7, seguranca; entrega DEC-002, ADR-016 Proposto).
- [02 - Qualidade estatica em TypeScript e Python](02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md) (blocos 1, 3 e 7; entrega FND-002). Pre-requisitos: TypeScript e Python basicos.
- [03 - Docker Compose para ambiente local](03%20-%20Docker%20Compose%20para%20ambiente%20local.md) (bloco 4; entrega FND-004). Pre-requisitos: Docker basico e a lesson 02.
- [04 - CI bloqueante e cadeia de suprimentos](04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md) (blocos 7 e 8, seguranca e CI; entrega FND-005). Pre-requisitos: lessons 02 e 03.
- [05 - Logs estruturados, correlation ID e redacao por allowlist](05%20-%20Logs%20estruturados%2C%20correlation%20ID%20e%20redacao%20por%20allowlist.md) (bloco 7, seguranca e observabilidade; entrega FND-009). Pre-requisitos: HTTP, lesson 01.
- [06 - Isolamento de telemetria por tenant](06%20-%20Isolamento%20de%20telemetria%20por%20tenant.md) (bloco 7, seguranca; entrega DEC-010, ADR-024 Proposto). Pre-requisitos: lessons 01, 03 e 05.
- [07 - Papeis e privilegios minimos no PostgreSQL](07%20-%20Papeis%20e%20privilegios%20minimos%20no%20PostgreSQL.md) (blocos 5 e 7, PostgreSQL e seguranca; entrega DEC-013, ADR-025 Proposto).
- [08 - Autorizacao de object storage e URLs assinadas](08%20-%20Autorizacao%20de%20object%20storage%20e%20URLs%20assinadas.md) (bloco 7, seguranca; entrega DEC-009, ADR-023 Proposto; numeracao provisoria, o coordenador reconcilia).
- [09 - Contratos JSON Schema entre TypeScript e Python](09%20-%20Contratos%20JSON%20Schema%20entre%20TypeScript%20e%20Python.md) (blocos 1, 3 e 7; entrega FND-003; numeracao provisoria).
- [10 - Drift e compatibilidade de contratos](10%20-%20Drift%20e%20compatibilidade%20de%20contratos.md) (bloco 8; entrega FND-003; numeracao provisoria).
- [11 - Fila duravel em PostgreSQL com lease](11%20-%20Fila%20duravel%20em%20PostgreSQL%20com%20lease.md) (bloco 5, PostgreSQL; entrega DEC-007, ADR-021 Proposto; numeracao provisoria).
- [12 - Configuracao tipada com falha rapida](12%20-%20Configuracao%20tipada%20com%20falha%20rapida.md) (bloco 7, seguranca; entrega FND-006; numeracao provisoria).
- [13 - Segredos por arquivo e verificacao de vazamento](13%20-%20Segredos%20por%20arquivo%20e%20verificacao%20de%20vazamento.md) (blocos 4 e 7, Docker e seguranca; entrega FND-006; numeracao provisoria).
- [14 - Estado deterministico de UI e fronteira de mocks no Next.js](14%20-%20Estado%20deterministico%20de%20UI%20e%20fronteira%20de%20mocks%20no%20Next.js.md) (blocos 6 e 8, Next.js e testes; entrega LOC-WEB-001; codigo mockado removido em 2026-11-01 e mantido so em /login e /orgs como excecao legada; numeracao provisoria).
- [15 - Temas claro e escuro com variaveis CSS no Next.js](15%20-%20Temas%20claro%20e%20escuro%20com%20variaveis%20CSS%20no%20Next.js.md) (blocos 6 e 8, Next.js e testes; entrega interface-web 2026-11-01; numeracao provisoria). Pre-requisitos: lessons 02 e 14.
- [16 - Sincronizacao idempotente com API externa](16%20-%20Sincronizacao%20idempotente%20com%20API%20externa.md) (blocos 5 e 7, PostgreSQL e seguranca; entregas [Painel de vendas Hotmart](../documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md) e [Meta Ads](../documentacoes/financeiro/2026-11-03-importacao-meta-ads.md); atualizada em 2026-11-03 com janela, cursor seguro, lease e limpeza após preparação incompleta dos testes). Pre-requisitos: lessons 00, 12 e 13.
- [17 - Painel de dados com Server Components no Next.js](17%20-%20Painel%20de%20dados%20com%20Server%20Components%20no%20Next.js.md) (bloco 6, Next.js; entrega [Painel de vendas Hotmart](../documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md), 2026-11-01). Pre-requisitos: lessons 14 e 15.
- [18 - Mutacoes com Server Actions e integridade no PostgreSQL](18%20-%20Mutacoes%20com%20Server%20Actions%20e%20integridade%20no%20PostgreSQL.md) (blocos 5 e 6, PostgreSQL e Next.js; inclui off-canvas com `<dialog>`; entrega [Fluxo de caixa](../documentacoes/financeiro/2026-11-02-fluxo-de-caixa.md), 2026-11-02). Pre-requisitos: lessons 00 e 17.
- [19 - Agendamento persistente por intervalo cron e eventos](19%20-%20Agendamento%20persistente%20por%20intervalo%20cron%20e%20eventos.md) (blocos 5, 6 e 7; entrega Funcionários Virtuais, 2026-11-02). Pré-requisitos: lessons 11, 12 e 18.
