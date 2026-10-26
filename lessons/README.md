# Trilha de lessons do Nucleos

Criada em 2026-10-25. Ultima atualizacao: 2026-10-26.

`lessons/` e uma trilha progressiva e didatica da stack do projeto, nao um changelog.
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

- [00 - Migracoes SQL forward-only no PostgreSQL](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md) (bloco 5; entrega DEC-003).
- [01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md) (bloco 7, seguranca; entrega DEC-002, ADR-016 Proposto).
- [02 - CI bloqueante e cadeia de suprimentos](02%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md) (blocos 7 e 8, seguranca e CI; entrega FND-005).
