// Cenarios da PoC DEC-003. Requer PGHOST=127.0.0.1, PGPORT, PGUSER, PGPASSWORD (container descartavel).
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { appliedVersions, assertDbName, assertTransactional, connect, loadMigrations, migrateBatch, migrateTenant } from './runner.mjs';

const base = { host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD };
assert.equal(base.host, '127.0.0.1', 'PoC so roda contra 127.0.0.1');
const N = 20;
const dbs = Array.from({ length: N }, (_, i) => `poc_tenant_${String(i + 1).padStart(2, '0')}`);
const migrations = loadMigrations(new URL('./migrations', import.meta.url).pathname);
const ms = (x) => `${x.toFixed(0)}ms`;
const log = (...a) => console.log(...a);

async function admin(fn) {
  const c = new pg.Client({ ...base, database: 'postgres' });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}
// Provisioner (admin): cria database e extensao. Identificadores via allowlist + escapeIdentifier.
async function provision(names) {
  await admin(async (c) => {
    for (const n of names) {
      const id = c.escapeIdentifier(assertDbName(n));
      await c.query(`DROP DATABASE IF EXISTS ${id} WITH (FORCE)`);
      await c.query(`CREATE DATABASE ${id}`);
    }
  });
  for (const n of names) {
    const c = connect(base, n);
    await c.connect();
    await c.query('CREATE EXTENSION IF NOT EXISTS vector');
    await c.end();
  }
}
const versionsOf = async () => Object.fromEntries(await Promise.all(dbs.map(async (d) => [d, (await appliedVersions(base, d)).join(',') || '-'])));
const summarize = (v) => {
  const g = {};
  for (const [d, s] of Object.entries(v)) (g[s] ??= []).push(d.slice(-2));
  return Object.entries(g).map(([s, l]) => `  versoes[${s}] -> bancos ${l.join(' ')}`).join('\n');
};

log(`migrations: ${migrations.map((m) => `${m.file} sha256=${m.checksum.slice(0, 12)}`).join(' | ')}`);

// ---- Cenario A: falha induzida no banco 12 + retomada ----
await provision(dbs);
log('\n[A1] lote sequencial com falha induzida no banco 12 (apos 0002, antes do COMMIT)');
const a1 = await migrateBatch(base, dbs, migrations, { concurrency: 1, failAt: { poc_tenant_12: '0002' } });
log(`  tempo=${ms(a1.ms)} ok=${a1.results.length} falhas=${JSON.stringify(a1.failed)} nao_iniciados=${a1.notStarted.length}`);
const afterFail = await versionsOf();
log(summarize(afterFail));
assert.equal(a1.failed.length, 1);
assert.equal(a1.failed[0].database, 'poc_tenant_12');
assert.equal(afterFail.poc_tenant_12, '0001', 'banco 12 manteve 0001 e reverteu 0002 inteira');
assert.equal(afterFail.poc_tenant_11, '0001,0002,0003');
assert.equal(afterFail.poc_tenant_13, '-', 'bancos posteriores nao tocados (fail-fast)');
{ // 0002 realmente revertida no banco 12 (nenhuma tabela documento)
  const c = connect(base, 'poc_tenant_12'); await c.connect();
  const r = await c.query("SELECT to_regclass('documento') AS t"); await c.end();
  assert.equal(r.rows[0].t, null);
}
log('[A2] retomada: mesmo comando, sem falha');
const a2 = await migrateBatch(base, dbs, migrations, { concurrency: 1 });
log(`  tempo=${ms(a2.ms)} ok=${a2.results.length} falhas=${a2.failed.length}`);
const r12 = a2.results.find((r) => r.database === 'poc_tenant_12');
const r11 = a2.results.find((r) => r.database === 'poc_tenant_11');
log(`  banco 12 aplicou=[${r12.applied}] pulou=${r12.skipped}; banco 11 aplicou=[${r11.applied}] pulou=${r11.skipped}`);
const afterResume = await versionsOf();
log(summarize(afterResume));
assert.deepEqual(r12.applied, ['0002', '0003']);
assert.deepEqual(r11.applied, []);
assert.ok(Object.values(afterResume).every((v) => v === '0001,0002,0003'));

// ---- Cenario H: garantia de atomicidade (REVIEW-001/003a da auditoria DEC-003) ----
{
  await provision(['poc_tenant_neg']);
  const mk = (version, name, sql) => ({ version, name, file: `${version}_${name}.up.sql`, sql, checksum: String(version).padEnd(64, '0') });
  const tableExists = async (t) => {
    const c = connect(base, 'poc_tenant_neg'); await c.connect();
    const r = await c.query('SELECT to_regclass($1) AS t', [t]); await c.end();
    return r.rows[0].t !== null;
  };
  // H1: COMMIT interno rejeitado antes de executar: nada criado, nenhuma versao registrada
  await assert.rejects(
    () => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'commit_interno', 'CREATE TABLE b1(x int); COMMIT; CREATE TABLE b2(x int);')]),
    /controle de transacao proibido.*COMMIT/,
  );
  assert.equal(await tableExists('b1'), false);
  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), []);
  for (const bad of ['BEGIN; SELECT 1', 'ROLLBACK', 'SAVEPOINT s1', 'END', 'CREATE INDEX CONCURRENTLY i ON t(x)', 'VACUUM']) {
    await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'ruim', bad)]), /proibido|nao roda dentro|nao e suportado/, bad);
  }
  // sem falso positivo: palavras em comentario, literal, corpo de funcao e CASE ... END
  assertTransactional(mk('0001', 'ok', "-- COMMIT aqui e so comentario\nSELECT 'COMMIT; VACUUM', CASE WHEN true THEN 1 END; CREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN 1; END $$"));
  // NOVO-003-A (rodada 2): lint por tokenizador; as cinco variantes que escondiam COMMIT atras de literal/identificador/dollar-quote
  const tail = ' COMMIT; CREATE TABLE b2(x int); SELECT 1/0;';
  const evasoes = {
    "literal com --": "CREATE TABLE b1(x int); SELECT '-- x';" + tail,
    "literal com /* e */": "CREATE TABLE b1(x int); SELECT '/*';" + tail + " SELECT '*/'",
    'identificador "--"': 'CREATE TABLE b1(x int); SELECT 1 AS "--";' + tail,
    'dollar-quote com --': 'CREATE TABLE b1(x int); SELECT $$--$$;' + tail,
    "E'\\'' (escape de aspa)": "CREATE TABLE b1(x int); SELECT E'\\'';" + tail,
    'comentario aninhado fechado': 'CREATE TABLE b1(x int); /* /* */ */ ;' + tail,
    'SET standard_conforming_strings': 'SET standard_conforming_strings = off',
  };
  for (const [nome, sql] of Object.entries(evasoes)) {
    assert.throws(() => assertTransactional(mk('0001', 'evasao', sql)), /proibido|nao e suportado/, nome);
  }
  // fim a fim no Postgres: rejeitado ANTES de executar, b1 nunca criada, nenhuma versao registrada
  await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'evasao', evasoes['literal com --'])]), /controle de transacao proibido.*COMMIT/);
  assert.equal(await tableExists('b1'), false);
  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), []);
  // rodada 3: (a) \r isolado encerra comentario -- no PG; (b) tag de dollar-quote sem limite de tamanho. Fim a fim, rejeitados ANTES de executar.
  const tag = (len) => '$' + 'L'.repeat(len) + '$';
  const longas = { "'-- x' + \\r isolado + COMMIT + erro final": "CREATE TABLE b1(x int); -- x\rCOMMIT; CREATE TABLE b2(x int); SELECT 1/0;" };
  for (const len of [78, 79, 80, 200]) {
    const T = tag(len);
    longas[`tag de ${len} caracteres com aspa interna`] = `CREATE TABLE b1(x int); SELECT ${T} ' ${T}; COMMIT; CREATE TABLE b2(x int); SELECT ${T} ' ${T}; SELECT 1/0;`;
  }
  for (const [nome, sql] of Object.entries(longas)) {
    assert.throws(() => assertTransactional(mk('0001', 'evasao', sql)), /controle de transacao proibido.*COMMIT/, nome);
    await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'evasao', sql)]), /controle de transacao proibido.*COMMIT/, nome);
    assert.equal(await tableExists('b1'), false, `${nome}: b1 ausente`);
    assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), [], `${nome}: nenhuma versao registrada`);
  }
  // legitimos sem falso positivo: \r como fim de linha (CRLF e CR isolado), COMMIT so em comentario/dollar-quote longo, tag longa fechada corretamente
  for (const ok of ['SELECT 1; -- COMMIT\r\nSELECT 2', 'SELECT 1; -- COMMIT\rSELECT 2', `SELECT ${tag(200)} ' COMMIT; ${tag(200)}`, `SELECT ${tag(79)} ' ${tag(79)}, ${tag(80)} COMMIT; ${tag(80)}`]) {
    assertTransactional(mk('0001', 'ok', ok));
  }
  for (const bad of [`SELECT ${tag(200)} abc`, `SELECT ${tag(79)} ${tag(80)}`]) {
    assert.throws(() => assertTransactional(mk('0001', 'aberto', bad)), /nao terminado/, bad);
  }
  // comentarios (inclusive aninhados) e literais legitimos nao sao falso positivo; nao terminados sao rejeitados (fail-closed)
  for (const ok of ['/* /* */ COMMIT; */ SELECT 1', "SELECT E'a\\'b; COMMIT'", "SELECT 'it''s; COMMIT'", 'SELECT $a$ COMMIT; $a$, $1', 'SELECT 1 AS "x"" COMMIT;"', 'SELECT 1 AS foo$$bar']) {
    assertTransactional(mk('0001', 'ok', ok));
  }
  for (const bad of ["SELECT 'abc; COMMIT", 'SELECT "abc', 'SELECT 1 /* x /* y */', 'SELECT $$ abc', "SELECT E'abc\\'"]) {
    assert.throws(() => assertTransactional(mk('0001', 'aberto', bad)), /nao terminado/, bad);
  }
  // defesa em profundidade (so detecta): com o lint contornado de proposito, COMMIT interno e detectado e a versao NAO e registrada
  await assert.rejects(
    () => migrateTenant(base, 'poc_tenant_neg', [mk('0001', 'escapou', 'CREATE TABLE b1(x int); COMMIT; CREATE TABLE b2(x int);')], { lint: () => {} }),
    /encerrou ou reiniciou a transacao/,
  );
  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), [], 'versao nao registrada');
  assert.equal(await tableExists('b1'), true, 'limite honesto: deteccao nao desfaz o COMMIT interno');
  {
    const c = connect(base, 'poc_tenant_neg'); await c.connect(); await c.query('DROP TABLE b1, b2'); await c.end(); // limpeza do estado parcial que a deteccao nao desfaz
  }
  log('[H1b] tokenizador (rodada 3: \\r isolado em -- e tag de dollar-quote de 78/79/80/200 caracteres, fim a fim sem b1 e sem versao): 5 evasoes + aninhado + SET standard_conforming_strings rejeitados (unit e fim a fim, b1 ausente); construtos nao terminados rejeitados; defesa xact_start detecta COMMIT interno e nao registra versao');
  log('[H1] COMMIT/BEGIN/ROLLBACK/SAVEPOINT/END/CONCURRENTLY/VACUUM rejeitados antes de executar; comentarios, literais e corpos $$ nao geram falso positivo');
  // H2: erro SQL real (divisao por zero) no 2o statement: rollback total, nada registrado, retomada com migration corrigida
  const bad2 = mk('0001', 'erro_real', 'CREATE TABLE b1(x int); CREATE TABLE b2(x int); SELECT 1/0;');
  await assert.rejects(() => migrateTenant(base, 'poc_tenant_neg', [bad2]), /division by zero/);
  assert.equal(await tableExists('b1'), false);
  assert.equal(await tableExists('b2'), false);
  assert.deepEqual(await appliedVersions(base, 'poc_tenant_neg'), []);
  const fixed = mk('0001', 'erro_real', 'CREATE TABLE b1(x int); CREATE TABLE b2(x int);');
  assert.deepEqual((await migrateTenant(base, 'poc_tenant_neg', [fixed])).applied, ['0001']);
  assert.equal(await tableExists('b2'), true);
  log('[H2] erro SQL real no 2o statement: rollback total (b1 e b2 ausentes, nenhuma versao registrada); retomada com a migration corrigida aplicou 0001');
  // H3: provisioner recusa nome fora da allowlist antes de qualquer SQL
  await assert.rejects(() => provision(['x"; DROP DATABASE postgres; --']), /nome de database invalido/);
  log('[H3] provision() rejeita nome fora da allowlist antes de qualquer SQL');
}

// ---- Cenario B: idempotencia ----
const b = await migrateBatch(base, dbs, migrations, { concurrency: 1 });
log(`\n[B] reexecucao idempotente: tempo=${ms(b.ms)} aplicadas=${b.results.reduce((s, r) => s + r.applied.length, 0)}`);
assert.equal(b.results.reduce((s, r) => s + r.applied.length, 0), 0);

// ---- Cenario C: checksum alterado ----
{
  const tampered = migrations.map((m) => (m.version === '0002' ? { ...m, checksum: 'f'.repeat(64) } : m));
  await assert.rejects(() => migrateTenant(base, dbs[0], tampered), /checksum divergente/);
  log('[C] checksum divergente rejeitado (migration aplicada nao pode ser editada)');
}

// ---- Cenario D: advisory lock entre dois runners no mesmo banco ----
{
  await provision(['poc_tenant_lock']);
  const t0 = performance.now();
  const [x, y] = await Promise.all([
    migrateTenant(base, 'poc_tenant_lock', migrations, { holdMs: 150 }),
    migrateTenant(base, 'poc_tenant_lock', migrations, { holdMs: 150 }),
  ]);
  const total = x.applied.length + y.applied.length;
  const c = connect(base, 'poc_tenant_lock'); await c.connect();
  const rows = (await c.query('SELECT version FROM schema_migrations ORDER BY 1')).rows.length; await c.end();
  log(`[D] 2 runners concorrentes no mesmo banco: aplicadas runner1=[${x.applied}] runner2=[${y.applied}] total=${total} linhas_schema_migrations=${rows} (${ms(performance.now() - t0)})`);
  assert.equal(total, 3);
  assert.equal(rows, 3);
}

// ---- Cenario E: compatibilidade pgvector / tsvector ----
{
  const c = connect(base, dbs[0]); await c.connect();
  const ver = (await c.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0].extversion;
  const srv = (await c.query('SHOW server_version')).rows[0].server_version;
  const docs = [
    ['Contrato de locacao', 'contrato de aluguel de imovel comercial', '[1,0,0]'],
    ['Receita de bolo', 'bolo de cenoura com cobertura de chocolate', '[0,1,0]'],
    ['Manual do agente', 'configuracao de agentes de atendimento', '[0,0,1]'],
    ['Locacao residencial', 'alugueis residenciais e garantias', '[0.9,0.1,0]'],
  ];
  for (const [t, ct, e] of docs) await c.query('INSERT INTO documento (id, titulo, conteudo, embedding) VALUES ($1,$2,$3,$4)', [randomUUID(), t, ct, e]);
  await c.query('SET enable_seqscan = off');
  const hnswPlan = (await c.query("EXPLAIN SELECT titulo FROM documento ORDER BY embedding <=> '[1,0,0]' LIMIT 2")).rows.map((r) => r['QUERY PLAN']).join(' | ');
  const top = (await c.query("SELECT titulo FROM documento ORDER BY embedding <=> $1 LIMIT 2", ['[1,0,0]'])).rows.map((r) => r.titulo);
  await c.query('CREATE INDEX tmp_ivf ON documento USING ivfflat (embedding vector_l2_ops) WITH (lists = 1)');
  await c.query('DROP INDEX documento_embedding_hnsw_idx');
  const ivfPlan = (await c.query("EXPLAIN SELECT titulo FROM documento ORDER BY embedding <-> '[1,0,0]' LIMIT 2")).rows.map((r) => r['QUERY PLAN']).join(' | ');
  const ftsPlan = (await c.query("EXPLAIN SELECT titulo FROM documento WHERE tsv @@ websearch_to_tsquery('portuguese','aluguel')")).rows.map((r) => r['QUERY PLAN']).join(' | ');
  const fts = (await c.query("SELECT titulo FROM documento WHERE tsv @@ websearch_to_tsquery('portuguese','aluguel') ORDER BY titulo")).rows.map((r) => r.titulo);
  await c.end();
  log(`[E] postgres=${srv} pgvector=${ver}`);
  log(`  HNSW  plano: ${hnswPlan}`);
  log(`  IVFFlat plano: ${ivfPlan}`);
  log(`  GIN/tsvector plano: ${ftsPlan}`);
  log(`  vizinhos(cosseno)=${JSON.stringify(top)} busca_texto('aluguel')=${JSON.stringify(fts)}`);
  assert.match(hnswPlan, /documento_embedding_hnsw_idx/);
  assert.match(ivfPlan, /tmp_ivf/);
  assert.match(ftsPlan, /documento_tsv_gin_idx/);
  assert.deepEqual(top, ['Contrato de locacao', 'Locacao residencial']);
  assert.deepEqual(fts, ['Contrato de locacao']); // "alugueis" nao e mesmo lexema de "aluguel" no stemmer: documenta o limite
}

// ---- Snapshot de esquema (fonte unica: SQL) para conformidade Python ----
{
  const c = connect(base, dbs[1]); await c.connect();
  const r = await c.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable FROM information_schema.columns
    WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
  await c.end();
  writeFileSync(new URL('./evidencia/schema-snapshot.json', import.meta.url), JSON.stringify(r.rows, null, 1) + '\n');
  log(`[F] snapshot de esquema gerado a partir do SQL: ${r.rows.length} colunas`);
}

// ---- Cenario G: tempos limpos, sequencial vs concorrencia 4 ----
log('\n[G] medicao de tempo (20 bancos novos, 3 migrations cada)');
for (const conc of [1, 4]) {
  await provision(dbs);
  const g = await migrateBatch(base, dbs, migrations, { concurrency: conc });
  const per = g.results.map((r) => r.ms);
  log(`  concorrencia=${conc}: total=${ms(g.ms)} por_banco_medio=${ms(per.reduce((a, b) => a + b, 0) / per.length)} max=${ms(Math.max(...per))} falhas=${g.failed.length}`);
  assert.equal(g.failed.length, 0);
}
// deixa 20 bancos migrados para a verificacao Python
log('\nPoC concluida: todas as asserções passaram.');
