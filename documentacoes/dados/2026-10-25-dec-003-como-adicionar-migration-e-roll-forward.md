# Como adicionar migration e reverter por roll-forward — 2026-10-25

Complemento do [ADR-017](../arquitetura/adr/0017-acesso-a-dados-e-migrations-multi-database.md) (status Proposto) e da [entrega DEC-003](2026-10-25-dec-003-acesso-a-dados-e-migrations.md). Valores validados na PoC em `documentacoes/arquitetura/poc/dec-003/`. Vale para bancos de tenant; nunca rode contra bancos reais fora do procedimento aprovado.

## Adicionar uma migration

1. Crie `migrations/NNNN_descricao_curta.up.sql` com o próximo número livre (4 dígitos, minúsculas, `_`). Nunca reutilize número nem renomeie um arquivo já mesclado.
2. Escreva SQL compatível com o código **anterior** (expand): colunas novas nulas ou com default, tabelas novas, índices. Remoções e mudanças incompatíveis só em migration posterior (contract), após a versão nova do código estar em todos os runtimes.
3. Siga as convenções: `uuid` PK, `timestamptz`, `numeric` para dinheiro/custo, `text` + `CHECK` para enums, `snake_case`, sem `tenant_id` redundante.
4. Não use `BEGIN/COMMIT` no arquivo (o runner envolve cada migration em transação) e não coloque segredos, nomes de tenant ou dados reais.
5. Teste em banco descartável: `documentacoes/arquitetura/poc/dec-003/run.sh` aplica o conjunto a 20 bancos. A migration deve passar duas vezes seguidas (a segunda não aplica nada).
6. Nunca edite uma migration já aplicada: o checksum SHA-256 diverge e o runner aborta (`checksum divergente`).

## O que acontece numa falha

Cada migration roda em uma transação junto com seu registro em `schema_migrations`. Falhou, reverte inteira: o banco fica na última versão registrada. O lote para no primeiro erro, não toca os bancos seguintes e lista falhas e não iniciados. Após corrigir a causa, rode o **mesmo comando**: bancos concluídos são pulados, o banco falho continua da migration pendente (PoC: banco 12 reaplicou 0002 e 0003; os demais bancos terminaram).

## Reverter por roll-forward

Não há `down`. Para desfazer o efeito de uma migration já aplicada em algum tenant:

1. Não edite nem apague o arquivo antigo.
2. Crie uma nova migration `NNNN+1_reverte_descricao.up.sql` que corrige o estado (ex.: `ALTER TABLE ... DROP COLUMN` somente depois de o código parar de usar a coluna; recriar índice; corrigir default).
3. Se a migration problemática ainda não foi aplicada em lugar nenhum além de ambientes descartáveis, pode-se removê-la antes do merge (não há checksum a preservar fora de bancos de teste).
4. Perda de dados (drop de tabela/coluna usada) só se recupera por backup/restauração do banco do tenant; por isso contract é separado e precedido de verificação.
5. Aplique pelo runner; tenants que ainda não receberam a migration original receberão ambas em sequência, o resultado final é o mesmo.

## Reproduzir a PoC

`documentacoes/arquitetura/poc/dec-003/run.sh` (requer Docker, Node 24.22.1 e `uv` em `~/.local`): sobe `pgvector/pgvector:pg16` em `127.0.0.1:55432`, roda os cenários e destrói o container ao sair.
