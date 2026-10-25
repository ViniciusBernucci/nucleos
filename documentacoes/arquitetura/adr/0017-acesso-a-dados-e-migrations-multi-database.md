# ADR-017 — Acesso a dados e migrations (control, tenant, Python)

- **Status:** Proposto (somente decisão humana o torna Aceito; o critério AC-1 do ticket exige essa aceitação)
- **Data:** 2026-10-25
- **Decisores:** a definir pelo usuário (proposta do executor DEC-003, Claude Sonnet 5.5)
- **Origem:** [ENT-DEC-003](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-003); ADR-003 (database por tenant) e ADR-008 (PostgreSQL + pgvector); seção 6 do [ADR consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)

## Contexto

Há três contextos de acesso a dados: (a) banco de controle (`nucleos_control`), usado pelo NestJS; (b) N bancos de tenant com esquema idêntico, cada um migrado individualmente por uma identidade separada do runtime (seção 6.1, regra 7); (c) runtime Python acessando só o banco do próprio tenant. O isolamento é o database e a credencial, não uma coluna `tenant_id`. Um cliente/pool gerado por schema, mantido por tenant, não escala para centenas de bancos.

## Problema

Qual ferramenta e quais convenções garantem migração idempotente e segura de muitos bancos, conexão dinâmica sem pool por tenant, compatibilidade com `pgvector`/`tsvector` e uma única fonte de verdade do esquema para TypeScript e Python?

## Decisão

1. **Esquema do tenant = SQL puro versionado**, arquivos `NNNN_descricao.up.sql` (4 dígitos, minúsculas, `_`), **somente forward** (sem `.down.sql`). Reversão é por *roll-forward*: nova migration que corrige. Mudanças destrutivas seguem expand/contract em migrations distintas e em implantações distintas.
2. **Runner próprio em TypeScript**, usado pelo provisioner (e pelo comando de migração em lote), com o contrato validado na PoC:
   - uma conexão curta por tenant (abrir, migrar, fechar); nunca pool nem cliente retido por tenant;
   - `pg_try_advisory_lock(hashtext('nucleos:schema_migrations'))` por database (advisory lock é local ao database, portanto tenants não disputam entre si; dois runners no mesmo tenant serializam);
   - tabela `schema_migrations(version, name, checksum char(64) SHA-256 do arquivo, applied_at, execution_ms)` em cada tenant;
   - cada migration = uma transação que contém o SQL **e** o registro em `schema_migrations`; falha faz `ROLLBACK` completo, desde que a migration não controle a transação: o runner rejeita estaticamente, antes de executar, `BEGIN`/`START`/`COMMIT`/`END`/`ROLLBACK`/`ABORT`/`SAVEPOINT`/`RELEASE`/`PREPARE TRANSACTION`, `CONCURRENTLY` e `VACUUM` (lint por tokenizador de uma passada que reconhece, na ordem de aparição, comentários `--` (terminam em `\n` **ou** `\r` isolado, como no PostgreSQL) e `/* */` aninhados, literais `'...'` e `E'...'`, identificadores `"..."` e dollar-quote `$tag$...$tag$` (tag de qualquer tamanho: identificador sem `$`, sem limite de comprimento); literal, comentário ou dollar-quote não terminado rejeita a migration; sem escape; rejeita também `SET standard_conforming_strings`). **Limites declarados:** o lint assume `standard_conforming_strings=on` (padrão) e não enxerga SQL dinâmico (`DO`/`EXECUTE`, `set_config`, `ALTER ROLE`/`ALTER DATABASE ... SET`), portanto a **prevenção** é o lint mais a revisão da migration (gate humano); falso positivo conhecido e aceito: coluna chamada `concurrently` ou `vacuum` também é rejeitada. **Defesa em profundidade (só detecta):** o runner lê `xact_start` de `pg_stat_activity` logo após o `BEGIN` e de novo após executar o SQL da migration; se mudou, lança erro e **não registra a versão**, mas o `COMMIT` interno já ocorreu, então o estado parcial pode persistir e exige investigação manual. O lint é requisito do runner de produção em DAT-*);
   - arquivo já aplicado com checksum diferente, ou versão aplicada sem arquivo, **aborta**; migration aplicada nunca é editada;
   - lote: concorrência limitada e configurável (padrão 1 em produção até haver medição própria); ao primeiro erro **não inicia novos bancos** (fail-fast) e relata falhas e bancos não iniciados; retomar = reexecutar o mesmo comando;
   - nomes de database/role vêm de allowlist (`^[a-z][a-z0-9_]{0,62}$`) e são escapados com `escapeIdentifier`; nenhuma entrada externa vira identificador por interpolação.
3. **Extensões (`vector`) são criadas pelo provisioner administrativo**, não pela identidade de migração do tenant; migrations apenas usam o tipo. A conferência de privilégios mínimos da identidade de migração é trabalho de DAT-002/DAT-003.
4. **Banco de controle (NestJS):** query builder tipado (**Kysely** como primeira opção; Drizzle como alternativa) com migrations SQL pelo mesmo runner/convenção. A escolha final entre Kysely e Drizzle não foi exercitada nesta PoC (ver Pendências).
5. **Runtime Python:** `psycopg` 3 (async) + SQL explícito e parametrizado, identificadores só via `psycopg.sql.Identifier`, sem ORM no caminho de segurança.
6. **Fonte única do esquema = os arquivos SQL.** TS e Python não redefinem tabelas; testes de conformidade comparam o esquema real (`information_schema`) ao snapshot gerado a partir do SQL (PoC: `schema-snapshot.json` conferido pelo Python). Geração de tipos TS a partir do banco migrado fica para DAT-002.
7. **Convenções:**
   - PK `uuid` (v7 preferido, gerado na aplicação; PostgreSQL 16 não tem `uuidv7()` nativo, o PostgreSQL 18 tem), sem depender de default do banco;
   - tempo em `timestamptz` (UTC); valores monetários e custo de tokens em `numeric` (ex.: `numeric(18,8)`);
   - nomes em `snake_case`; enum como `text` + `CHECK` (facilita expand/contract);
   - soft delete só onde houver exigência de retenção;
   - tabelas de tenant **sem** `tenant_id` redundante (o isolamento é o database), exceto onde exportação futura exigir;
   - índices vetoriais e de texto ficam no banco do tenant (ADR-008, seção 6.1 regra 8).

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| Prisma (cliente gerado por schema) | Ergonomia e tipos | Um schema/cliente gerado orientado a um database; multi-database dinâmico exige instanciar clientes por tenant; migrations próprias com shadow database são pouco adequadas a N bancos; pgvector é tipo "unsupported". Não foi exercitado na PoC. |
| Drizzle para o tenant | Tipos TS e SQL próximo | Migration por tenant exigiria orquestração própria de qualquer forma; mantém-se como alternativa para o controle. |
| Flyway/Atlas/dbmate/node-pg-migrate | Ferramentas maduras | Não avaliadas na PoC; o runner próprio tem ~130 linhas e cobre o contrato; reavaliar se o custo de manutenção crescer. |
| Migrations com `down` | Reversão aparentemente simples | Reversão destrutiva em dados de cliente é arriscada e raramente testada; roll-forward exige uma única direção testável. |
| Esquema único com `tenant_id` + RLS | Menos bancos | Contraria ADR-003. |

## Benefícios

- Falha no meio do lote é segura e retomável (comprovado: banco 12).
- Idempotência, proteção contra edição de migration aplicada e contra execução concorrente.
- SQL revisável por humanos e por analisadores de segurança; mesma fonte para TS e Python.
- Sem pool por tenant; consumo de conexões previsível.

## Trade-offs

- Runner próprio é código a manter e testar (precisa de lint, testes e revisão de segurança em produção).
- Sem *down*: erro exige migration corretiva e, para dados, backup/restauração (ADR em DEC-009/backups).
- Lote fail-fast atrasa os bancos posteriores quando um tenant falha; um tenant "quebrado" bloqueia a onda até ser tratado ou excluído explicitamente (política de exclusão por tenant fica para DAT-004).
- `ADD COLUMN ... GENERATED ... STORED` e criação de índice reescrevem/bloqueiam a tabela; em tabelas grandes usar `CREATE INDEX CONCURRENTLY` (não pode rodar em transação; o runner da PoC o rejeita; exigirá fluxo/marcador de migration sem transação, ainda não implementado).

## Consequências

- Tickets IAM-002, DAT-002, DAT-003 e DAT-004 partem deste contrato; o código de produção do runner nascerá em `packages/`/`services/` por DAT-*, não nesta PoC.
- O provisioner precisa de privilégio para `CREATE DATABASE` e `CREATE EXTENSION` em processo segregado.
- Migrations passam a ter checksum registrado: pipelines devem impedir alteração de arquivos já mesclados.
- Medidas da PoC (máquina local, tmpfs, `fsync=off`, bancos vazios): 20 bancos x 3 migrations, em execuções locais distintas: 1,6 a 3,8 s sequencial e 0,4 a 1,2 s com concorrência 4; reexecução sem pendências 0,7 a 1,3 s (custo de conexão e verificação). Os valores variam por execução; não extrapolar para produção.

## Requisitos adiados para o runner de produção (DAT-002)

Achados da auditoria DEC-003 classificados como ADIAR; a PoC não os corrige e o código dela não deve ser copiado sem eles:

- **Ganchos de teste:** `failAfter`/`holdMs` em `migrateTenant` são só da PoC; o runner de produção deve injetá-los apenas em teste (falha induzível por configuração).
- **Erro de conexão no `ROLLBACK`:** se a conexão cair, `ROLLBACK` lança e mascara a causa; usar `ROLLBACK ... .catch(() => {})` preservando o erro original e testar com `pg_terminate_backend` (o servidor desfaz a transação ao perder a sessão, sem impacto em dados).
- **Checksum sobre bytes:** o hash da PoC cobre a string decodificada (CRLF/BOM mudam o digest; mecanismo evidente, não reproduzido); o runner de produção calcula o hash sobre os bytes e o repositório fixa `*.up.sql text eol=lf` em `.gitattributes`, com teste de CRLF.
- **Imagem:** fixar o digest da imagem do PostgreSQL quando o banco entrar em CI (FND-*/DAT-*); hoje a PoC usa a tag `pg16` em container local descartável.

## Quando revisar

- Mais de ~200 tenants ou lote de migração acima do orçamento operacional definido (medir em staging).
- Necessidade de `CREATE INDEX CONCURRENTLY`, migrations de dados longas ou reversão automática.
- Decisão de separar bancos por host (seção 6.1, risco residual) ou adotar PgBouncer/pool com modo de transação (advisory locks de sessão não funcionam em pool transacional).
- Mudança de versão major do PostgreSQL ou do pgvector.

## Referências

- PoC: [`../poc/dec-003/`](../poc/dec-003/run.sh) (`run.sh`, `runner.mjs`, `poc.mjs`, `migrations/`, `py/`); saída reproduzível em [`../poc/dec-003/evidencia/saida-poc.txt`](../poc/dec-003/evidencia/saida-poc.txt)
- Procedimento: [como adicionar migration e reverter por roll-forward](../../dados/2026-10-25-dec-003-como-adicionar-migration-e-roll-forward.md)
- Entrega: [DEC-003](../../dados/2026-10-25-dec-003-acesso-a-dados-e-migrations.md)
- [ADR-003](0003-database-postgresql-exclusivo-por-tenant-dentro-de.md), [ADR-008](0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md)

## Pendências que dependem de decisão humana

1. Aceitar, alterar ou rejeitar este ADR (status continua Proposto).
2. Kysely versus Drizzle para o banco de controle (não exercitado).
3. Manter runner próprio ou adotar ferramenta pronta (avaliação não feita).
4. Concorrência padrão do lote e política para tenant que falha (exclusão temporária?).
