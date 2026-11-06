# Banco único do Nucleos (PostgreSQL no Docker)

> **Regra permanente (decisão do usuário, 2026-11-01):** o Nucleos tem **um único banco de dados
> PostgreSQL**, rodando no Docker. Cada assunto/tarefa é resolvido com **schemas e tabelas dentro
> desse banco**. Não se cria banco, container ou instância nova por tarefa ou por funcionalidade.

Este é o documento de referência. Se uma entrega precisar guardar dados, ela segue o que está aqui
e atualiza o mapa de schemas abaixo na mesma entrega.

## Onde está

| Item | Valor (desenvolvimento) |
| --- | --- |
| Servidor | serviço `postgres` do `infrastructure/docker/compose.dev.yml` (perfil `core`), container `nucleos-dev-postgres-1` |
| Endereço | `127.0.0.1:15432` (nunca `0.0.0.0`; porta configurável por `PG_HOST_PORT`) |
| Banco | `nucleos_dev` |
| Usuário | `nucleos_dev` |
| Senha | descartável, em `infrastructure/docker/.env.local` (gerada por `scripts/gerar-segredos.sh`, não versionada). Nunca em código, log ou documentação |
| Subir | `infrastructure/docker/scripts/dev.sh up core` |

Em staging/produção o mesmo princípio vale: um banco do Nucleos; `DATABASE_URL` (sem senha) +
`DATABASE_PASSWORD_FILE` (senha em arquivo), conforme ADR-020 e `@nucleos/config`.

## Mapa de schemas e tabelas

| Schema | Tabela | Para que serve | Entrega |
| --- | --- | --- | --- |
| `organizacao` | `setores` | Setores ordenados para catálogo, funcionários e menu dinâmico | [Funcionários virtuais](../funcionarios/2026-11-02-modulo-funcionarios-virtuais.md) |
| `funcionarios` | `funcionarios` | Papéis virtuais com estado explícito e setor | idem |
| `funcionarios` | `definicoes_tarefa` | Catálogo de tarefas, schemas, permissões e vínculo a handlers do backend | idem |
| `funcionarios` | `atribuicoes` | Configuração e habilitação da tarefa por funcionário; integridade de setor por FK composta | idem |
| `funcionarios` | `agendamentos` | Intervalo, cron, evento e disparo único, com versão e próxima ocorrência persistida | idem |
| `funcionarios` | `execucoes` | Histórico de execução, snapshot seguro e correlação | idem |
| `funcionarios` | `fila` | Fila durável com reivindicação, lease, tentativa e fencing | idem |
| `funcionarios` | `eventos` | Eventos internos deduplicados e despacho transacional | idem |
| `funcionarios` | `auditoria` | Alterações administrativas do módulo sem segredos | idem |
| `financeiro` | `vendas` | Vendas baixadas da Hotmart (uma linha por transação; sem e-mail/nome do comprador) | [Painel de vendas](../financeiro/2026-11-01-painel-de-vendas-hotmart.md) |
| `financeiro` | `sincronizacao_estado` | Linha única com o estado da última verificação (sucesso, falha, quando) | idem |
| `financeiro` | `contas_recorrentes` | Contas a pagar mensais (valor previsto, dia de vencimento, vigência) | [Fluxo de caixa](../financeiro/2026-11-02-fluxo-de-caixa.md) |
| `financeiro` | `lancamentos` | Entradas e saídas do caixa; pagamento de conta recorrente é uma saída com competência (única por conta e mês) | idem |
| `financeiro` | `categorias` | Categorias de entrada e de saída (nome único por tipo, sem diferenciar maiúsculas) usadas nos formulários do fluxo de caixa | idem |
| `financeiro` | `alertas` | Alertas com deduplicação enquanto abertos | [Base financeira B](../financeiro/2026-11-03-base-financeira-b.md) |
| `financeiro` | `vendas_eventos`, `vendas_comissoes` | Histórico de status e valores por papel/moeda, sem identidade dos participantes | idem |
| `financeiro` | `webhooks_hotmart` | Identificação mínima, hash e estado do processamento do webhook, sem PII | idem |
| `financeiro` | `fornecedores`, `centros_custo` | Cadastros financeiros; documento do fornecedor mascarado na leitura | idem |
| `financeiro` | `contas_pagar` | Parcelas e competências materializadas das recorrências, com vínculo ao pagamento | idem |
| `financeiro` | `anexos` | Metadados de arquivos privados no MinIO; download pelo servidor | idem |
| `financeiro` | `contas_financeiras`, `saques_hotmart` | Contas do caixa e movimentos de saque; transferências vinculadas em lançamentos | idem |
| `financeiro` | `saldos_informados`, `regras_liberacao`, `contas_receber` | Saldo com origem/data e previsões explicitamente estimadas em BRL | idem |
| `financeiro` | `extratos_importados`, `extrato_itens` | Importações OFX/CSV idempotentes por conta e identificador/hash | idem |
| `financeiro` | `conciliacoes`, `conciliacao_itens` | Sugestões, confirmação manual, ambiguidade e reversão auditável | idem |
| `public` | `api_schema_migrations` | Controle das migrations da API (versão, checksum, quando) | idem |
| `dev_seed` | `organizacoes` | Dado fictício de desenvolvimento (FND-004); só existe em dev | FND-004 |

> Ao criar tabelas novas, **acrescente a linha aqui**. Um assunto novo ganha um schema novo
> (por exemplo `iam`, `tenancy`, `funcionarios`), nunca um banco novo.

## Como criar ou alterar tabelas

1. Escreva uma migration SQL **forward-only** em `apps/api/migrations/NNNN_descricao.up.sql`
   (4 dígitos, minúsculas, `_`). Não use `BEGIN`/`COMMIT`/`CONCURRENTLY`: o runner já abre uma
   transação por arquivo (ADR-017). Mudou algo já aplicado? Crie uma nova migration; nunca edite uma
   aplicada (o checksum detecta).
2. Aplique no banco do Docker: `bash infrastructure/docker/scripts/migrar-banco.sh`
   (exige `make build`). É idempotente: rodar de novo informa "nada a aplicar".
3. Registre a tabela no mapa acima e na documentação da entrega.

O script lê a senha do container em execução (ou do `.env.local`) e a entrega ao migrador por
**entrada padrão** (`--senha-stdin`), sem env, argumento de processo ou arquivo temporário.

## Testes

- Testes unitários não tocam em banco.
- `apps/api/src/integracao-pg.test.ts` só roda com `TEST_DATABASE_URL` apontando para servidor
  **local**. Ele cria um banco **temporário apenas para o teste**, aplica as migrations, verifica e o
  remove no fim; não é um banco de funcionalidade e não toca em `nucleos_dev`.
  Exemplo (a senha vem do ambiente local, nunca do repositório):
  `TEST_DATABASE_URL="postgres://nucleos_dev:<senha>@127.0.0.1:15432/postgres" node --test apps/api/dist/integracao-pg.test.js`

## Relação com os ADRs

O [ADR-003](../arquitetura/adr/0003-database-postgresql-exclusivo-por-tenant-dentro-de.md) previa
database exclusivo por tenant e o [ADR-017](../arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md)
um banco de controle separado (`nucleos_control`). Por decisão do usuário, **neste momento** tudo
fica em um banco único com schemas por assunto. O isolamento por tenant (coluna/RLS ou migração
futura para um banco por tenant) é uma decisão pendente e deve ser tratada em um ADR próprio antes
de haver mais de uma organização com dados reais.

## Atenção: banco `nucleos_control` encontrado

Em 2026-11-01 o container de dev também continha um banco `nucleos_control` (schemas `iam` e
`tenancy`, tabela `public.schema_migrations`), criado por outro checkout/worktree do trabalho de
login real. **Ele foi deixado intacto.** Para respeitar a regra do banco único, esse conteúdo deve
ser consolidado em `nucleos_dev` (ou o banco único deve ser definido como `nucleos_control`) quando
o login real for integrado. Pendência registrada: decidir o nome definitivo do banco único.

## Limitações conhecidas

- O CLI de migração e a leitura de segredos por arquivo (`O_NOFOLLOW`, permissões 0600) assumem
  Linux/WSL; no Windows use o script `migrar-banco.sh` (senha por entrada padrão).
- Containers criados por checkouts diferentes compartilham o mesmo volume/porta; a senha válida é a
  do container em execução, não necessariamente a do `.env.local` do checkout atual.
