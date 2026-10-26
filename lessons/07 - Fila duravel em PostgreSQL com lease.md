# Fila duravel em PostgreSQL com lease (SKIP LOCKED)

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26. Exemplos: Node 24.22.1, `pg` 8.23.1, PostgreSQL 16.15. TypeScript e Python nao sao usados neste exemplo (JavaScript ESM e SQL); a tecnica vale igual em ambos. Numeracao provisoria (o coordenador reconcilia).

## Objetivo, pre-requisitos e posicao na trilha

Entender como uma tabela PostgreSQL vira uma fila duravel: enfileirar sem duplicar, reivindicar sem disputa, recuperar tarefa de worker morto e concluir sem corrida. Bloco 5 (PostgreSQL) com ligacao ao bloco 7 (seguranca: idempotencia e relogio confiavel). Pre-requisitos: [00 - Migracoes SQL forward-only no PostgreSQL](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md) (transacoes, `docker run` descartavel) e SQL basico.

## Modelo mental

A tarefa e uma linha com um estado. Um worker "aluga" a linha por alguns segundos (lease). Se ele morre, o aluguel vence e outro worker assume. Por isso a entrega e **pelo menos uma vez**: a mesma tarefa pode rodar duas vezes, e o efeito precisa ser idempotente. O relogio que vale e o do banco (`now()`), nunca o do cliente.

## Conexao com a implementacao real

Decisao e medicoes no [ADR-021](../documentacoes/arquitetura/adr/0021-orquestracao-duravel-de-tarefas.md) (Proposto) e na [entrega DEC-007](../documentacoes/mensageria/2026-10-26-dec-007-orquestracao-duravel.md). A PoC completa (limite e justica por tenant, heartbeat, fencing) esta em `documentacoes/arquitetura/poc/dec-007/impl-pg.mjs`.

## Exemplo minimo (executado)

```bash
export PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"   # senha aleatoria, so desta sessao
export PGPORT=55440
docker run -d --name exemplo-fila -p 127.0.0.1:$PGPORT:5432 -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:16
until docker exec exemplo-fila pg_isready -U postgres -h 127.0.0.1; do sleep 1; done; sleep 2
npm install pg@8.23.1 && node exemplo.mjs      # com "type": "module" no package.json
docker rm -fv exemplo-fila                      # ao terminar
```

```js
// exemplo.mjs
import pg from 'pg';

const db = new pg.Client({ host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'postgres', password: process.env.PGPASSWORD, database: 'postgres' });
await db.connect();
await db.query(`
  DROP TABLE IF EXISTS tarefas;
  CREATE TABLE tarefas (
    id text PRIMARY KEY,                       -- chave de idempotencia do produtor
    estado text NOT NULL DEFAULT 'queued' CHECK (estado IN ('queued','running','done')),
    tentativa int NOT NULL DEFAULT 0,
    lease_ate timestamptz
  )`);

const enfileirar = (id) => db.query('INSERT INTO tarefas (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
await enfileirar('t1'); await enfileirar('t1');
console.log('linhas apos enfileirar t1 duas vezes:', (await db.query('SELECT count(*)::int n FROM tarefas')).rows[0].n);

const reivindicar = () => db.query(`
  UPDATE tarefas SET estado='running', tentativa=tentativa+1, lease_ate=now()+interval '1 second'
   WHERE id = (SELECT id FROM tarefas
                WHERE estado='queued' OR (estado='running' AND lease_ate<=now())
                ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
   RETURNING id, tentativa`);
const a = await reivindicar();
console.log('worker A pegou:', a.rows[0]);
console.log('worker B logo depois:', (await reivindicar()).rows.length, 'linhas (lease ativa)');

await new Promise((r) => setTimeout(r, 1200));          // worker A "morre": a lease expira
const b = await reivindicar();
console.log('apos expirar a lease:', b.rows[0]);

const concluir = (t) => db.query("UPDATE tarefas SET estado='done' WHERE id='t1' AND tentativa=$1 AND estado='running'", [t]);
console.log('conclusao da tentativa 1 (obsoleta):', (await concluir(a.rows[0].tentativa)).rowCount, '| da tentativa 2:', (await concluir(b.rows[0].tentativa)).rowCount);
await db.end();
```

Saida real da execucao (2026-10-26): `linhas apos enfileirar t1 duas vezes: 1`; `worker A pegou: { id: 't1', tentativa: 1 }`; `worker B logo depois: 0 linhas (lease ativa)`; `apos expirar a lease: { id: 't1', tentativa: 2 }`; `conclusao da tentativa 1 (obsoleta): 0 | da tentativa 2: 1`.

## Do minimo ao padrao do projeto

1. **Idempotencia do produtor:** a PK `id` com `ON CONFLICT DO NOTHING` ignora o reenvio.
2. **Lease e `SKIP LOCKED`:** quem encontra a linha travada por outro pula para a proxima, sem esperar.
3. **Heartbeat:** tarefa longa renova `lease_ate` periodicamente, so se ainda for a tentativa corrente.
4. **Fencing:** concluir exige `tentativa` igual; o worker "fantasma" que voltou depois da lease nao sobrescreve.
5. **Limite e justica por tenant:** linha `tenant_state` travada serializa reivindicacoes do tenant, conta `running` com lease valida e ordena por `last_served_at` (ver `impl-pg.mjs`).
6. **Atomicidade com o negocio:** `INSERT` da tarefa na mesma transacao do fato de negocio; rollback leva as duas (cenario S10 da PoC).

## Erros comuns e trade-offs

- Contar o limite por tenant sem travar uma linha do tenant: duas reivindicacoes simultaneas passam do limite.
- Usar `Date.now()` do cliente para `run_at` ou lease: relogio errado antecipa ou atrasa a tarefa (na PoC, o BullMQ falhou nesse teste; esta tecnica passou).
- Esquecer a idempotencia do efeito: a tarefa pode rodar mais de uma vez.
- Fila de alta rotatividade exige indice adequado e vacuum; polling consome conexoes.
- Nao se aplica quando o fluxo tem muitos passos com compensacao ou throughput acima do gatilho do ADR (Temporal ou fila dedicada merecem reavaliacao).

## Verificacao e exercicios

- Rode o exemplo duas vezes: a saida deve ser identica (ele recria a tabela).
- Exercicio 1: altere o lease para 3 s e acrescente o heartbeat do passo 3; mostre que o worker B nao assume enquanto A renova.
- Exercicio 2: abra duas conexoes e reivindique em paralelo 20 tarefas; confirme que nenhuma e entregue a dois workers simultaneamente.
- Pergunta: por que `attempt` serve de fencing e o `lease_owner` sozinho nao basta?
