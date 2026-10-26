# 07 - Papeis e privilegios minimos no PostgreSQL

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26 (rodada de correcao 1). Numeracao provisoria (a partir de 09); o coordenador pode renumerar na integracao.
Versoes dos exemplos: PostgreSQL 16.15 (container `postgres:16-alpine`). Node, TypeScript e Python nao sao usados nesta lesson.

## Objetivo, pre-requisitos e posicao na trilha

Entender como separar quem migra, quem opera e quem executa ferramentas usando papeis (roles) e `GRANT`, de modo que cada componente enxergue so o que precisa. Pre-requisito: [00 - Migracoes SQL forward-only no PostgreSQL](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md). Bloco 5 (PostgreSQL) com ponte para o bloco 7 (seguranca).

## Modelo mental

Um papel e uma identidade com uma lista de permissoes. Camadas decidem se uma consulta passa: pode conectar ao database? tem `USAGE` no esquema? tem o privilegio na tabela? o atributo do papel (`SUPERUSER`, `BYPASSRLS`) pula as regras? O padrao e negar, mas `PUBLIC` (o "papel de todo mundo") vem com permissoes que precisam ser revogadas.

## Conexao com a entrega

O [ADR-025](../documentacoes/arquitetura/adr/0025-acesso-da-ui-aos-dados-do-tenant-e-posicao-do-tool-gateway.md) usa quatro papeis por tenant: `owner` (dono, sem login), `migrator` (DDL via `SET ROLE owner`), `app` (runtime e API de leitura) e `tools` (Tool Gateway). Documento da entrega: [DEC-013](../documentacoes/arquitetura/2026-10-26-dec-013-acesso-ui-e-tool-gateway.md). PoC completo: `documentacoes/arquitetura/poc/dec-013/run.sh`.

## Exemplo minimo (executavel)

Salve como `lesson09.sql` e rode em um PostgreSQL descartavel, sem publicar portas:
`docker run --rm -d --name l09 -e POSTGRES_PASSWORD=x postgres:16-alpine` e depois
`docker exec -i l09 psql -U postgres < lesson09.sql` (remova com `docker rm -f l09`).

```sql
CREATE ROLE demo_owner NOLOGIN;
CREATE ROLE demo_app   LOGIN PASSWORD 'troque' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE DATABASE demo OWNER demo_owner;
REVOKE ALL ON DATABASE demo FROM PUBLIC;
GRANT CONNECT ON DATABASE demo TO demo_app;
\c demo
SET ROLE demo_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA runtime;
CREATE SCHEMA content;
CREATE TABLE runtime.messages (id int PRIMARY KEY, body text);
CREATE TABLE content.chunks   (id int PRIMARY KEY, chunk_text text);
GRANT USAGE ON SCHEMA runtime TO demo_app;
GRANT SELECT, INSERT ON runtime.messages TO demo_app;   -- sem DELETE, sem acesso a content
RESET ROLE;
-- verificacao: o que demo_app consegue?
GRANT demo_app TO postgres;                              -- permite ao superuser assumir o papel no teste
SET ROLE demo_app;
SELECT count(*) FROM runtime.messages;                   -- ok
DELETE FROM runtime.messages;                            -- ERROR: permission denied for table messages
SELECT * FROM content.chunks;                            -- ERROR: permission denied for schema content
```

Os dois `ERROR` sao o resultado esperado; o `psql` sem `ON_ERROR_STOP` continua e os mostra.

## Do minimo ao padrao do projeto

1. Separar o dono (`NOLOGIN`) de quem usa. 2. Separar DDL de uso: o `migrator` assume o dono com `GRANT dono TO migrator WITH INHERIT FALSE, SET TRUE`. 3. Um papel por funcao (`app`, `tools`) em esquemas diferentes, em vez de uma credencial unica. 4. Auditoria append-only: `GRANT INSERT` sem `SELECT/UPDATE/DELETE` ao escritor. 5. Revogar `CONNECT` de `PUBLIC` em `postgres` e `template1` (so superuser consegue; um papel `CREATEDB CREATEROLE` nao). 6. Provar por testes de negacao (o PoC tem 56 verificacoes).

## Erros comuns e quando nao se aplica

- Esquecer o `REVOKE` de `PUBLIC` (database, esquema `public`, funcoes): o papel "sem permissao" ainda faz coisas.
- Conceder `INHERIT` ao `migrator`: ele passa a ter os privilegios do dono em toda sessao.
- Testar so o caminho feliz: sem teste de negacao nao ha prova de isolamento.
- Testar pelo loopback de uma imagem Docker com `trust`: a senha nem e verificada; teste pelo IP do container.
- Nao substitui o isolamento por database entre tenants (ADR-003) nem RLS quando varios tenants dividem tabelas.
- Trade-off: mais papeis, mais conexoes (cada papel abre as suas) e migrations com `GRANT` explicito.

## Verificacao e exercicios

- Rode `documentacoes/arquitetura/poc/dec-013/run.sh` e confirme `PASS=56 FAIL=0`.
- Exercicio 1: crie `demo_tools` com `SELECT` em `content.chunks` e prove que ele nao le `runtime.messages`.
- Exercicio 2: faca `demo_tools` inserir mas nao atualizar uma tabela de auditoria.
- Pergunta: o que muda se a membership do `migrator` no dono for `INHERIT TRUE`?
