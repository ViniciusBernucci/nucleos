// Roteiro medido do PoC DEC-002. Uso: DATABASE_URL=postgres://...127.0.0.1... node poc.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { createServer, hashPassword, seal, totp, b32encode } from './server.mjs';

const url = process.env.DATABASE_URL;
if (!url || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('DATABASE_URL deve apontar para 127.0.0.1 (container descartavel)');
const pool = new pg.Pool({ connectionString: url, max: 5 });
await pool.query('DROP TABLE IF EXISTS sessions, memberships, users, organizations CASCADE');
await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

const seedKey = crypto.randomBytes(32);              // chave KEK so desta execucao
const totpSecret = crypto.randomBytes(20);
const pw = crypto.randomBytes(12).toString('base64url'); // senha sintetica, nunca impressa
const uid = crypto.randomUUID(), orgA = crypto.randomUUID(), orgB = crypto.randomUUID();
await pool.query('INSERT INTO organizations VALUES ($1,$2),($3,$4)', [orgA, 'Org A', orgB, 'Org B']);
const t0 = performance.now();
const ph = await hashPassword(pw);
const hashMs = performance.now() - t0;
await pool.query('INSERT INTO users VALUES ($1,$2,$3,$4)', [uid, 'poc@example.test', ph, seal(seedKey, totpSecret)]);
await pool.query('INSERT INTO memberships VALUES ($1,$2,$3)', [uid, orgA, 'admin']);

const srv = createServer({ pool, seedKey });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
  const s = performance.now();
  const r = await fetch(base + path, {
    method, body: body && JSON.stringify(body),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  });
  return { status: r.status, body: await r.json(), ms: performance.now() - s };
};
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

console.log(`argon2id (m=19456 KiB,t=2,p=1): hash em ${hashMs.toFixed(1)} ms`);
const email = 'poc@example.test';
check('login com senha errada -> 401', (await call('/login', { method: 'POST', body: { email, password: 'x' } })).status === 401);
check('login sem TOTP -> 401 mfa_invalido', (await call('/login', { method: 'POST', body: { email, password: pw } })).body.error === 'mfa_invalido');
const l = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
check('login com senha + TOTP -> 200 e token opaco', l.status === 200 && !!l.body.token, `(${l.ms.toFixed(1)} ms)`);
const tokenA = l.body.token;
const l2 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
const tokenB = l2.body.token;
const stored = await pool.query('SELECT count(*)::int n FROM sessions WHERE token_hash = $1', [Buffer.from(tokenA)]);
check('token em claro nao esta gravado (so sha256)', stored.rows[0].n === 0);
const me = await call('/me', { token: tokenA });
check('GET /me com sessao valida -> 200 e org por membership', me.status === 200 && me.body.orgs[0].org_id === orgA, `(${me.ms.toFixed(1)} ms)`);
check('X-Tenant-Id de outra org (sem membership) -> 403', (await call('/me', { token: tokenA, headers: { 'x-tenant-id': orgB } })).status === 403);

// --- REVOGACAO (AC-2): requisicao imediatamente seguinte ---
const rv = await call('/logout', { method: 'POST', token: tokenA });
const after = await call('/me', { token: tokenA });
check('logout: requisicao seguinte com o token revogado -> 401', rv.status === 200 && after.status === 401,
  `(revogacao ${rv.ms.toFixed(1)} ms; rejeicao ${after.ms.toFixed(1)} ms)`);
check('outra sessao do mesmo usuario segue valida apos logout de A', (await call('/me', { token: tokenB })).status === 200);
const ra = await call('/revoke-all', { method: 'POST', token: tokenB });
const afterAll = await call('/me', { token: tokenB });
check('revoke-all: sessao B rejeitada na requisicao seguinte -> 401', ra.status === 200 && afterAll.status === 401, `(${ra.body.revoked} sessao(oes) revogada(s))`);

// Revogacao durante sequencia de requisicoes: UM worker sequencial (nao ha concorrencia); mede o instante da ultima aceita vs revogacao.
const l3 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
let revokedAt = null, acceptedAfter = 0, rejected = 0, total = 0, run = true;
const worker = (async () => { while (run) {
  const r = await call('/me', { token: l3.body.token }); total++;
  const doneAt = performance.now();
  if (r.status === 200 && revokedAt !== null && doneAt - r.ms > revokedAt) acceptedAfter++;
  if (r.status === 401) rejected++;
}})();
await new Promise((r) => setTimeout(r, 100));
const other = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [crypto.createHash('sha256').update(l3.body.token).digest()]);
revokedAt = performance.now();
await new Promise((r) => setTimeout(r, 150)); run = false; await worker;
check('revogacao durante sequencia de requisicoes (um worker): nenhuma requisicao INICIADA apos o UPDATE foi aceita', acceptedAfter === 0 && rejected > 0,
  `(${total} req, ${rejected} rejeitadas, ${acceptedAfter} aceitas apos revogar)`);
void other;

// Sessao expirada
const l4 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`);
check('sessao expirada -> 401', (await call('/me', { token: l4.body.token })).status === 401);

// Seed cifrada: o banco nao contem a seed em claro
const row = (await pool.query('SELECT password_hash, totp_secret_enc FROM users')).rows[0];
check('hash de senha e PHC argon2id', row.password_hash.startsWith('$argon2id$'));
check('seed TOTP nao aparece em claro no banco', !row.totp_secret_enc.includes(totpSecret));
console.log(`b32 da seed nao e impressa; tamanho seed cifrada = ${row.totp_secret_enc.length} bytes (12 iv + 16 tag + ${totpSecret.length})`);
void b32encode;

const mu = process.memoryUsage();
console.log(`MEDIDA_RAM node_rss_mib=${(mu.rss / 1048576).toFixed(1)} heap_used_mib=${(mu.heapUsed / 1048576).toFixed(1)}`);
srv.close(); await pool.end();
const bad = results.filter((x) => !x).length;
console.log(`RESULTADO ${results.length - bad}/${results.length} PASS`);
process.exit(bad ? 1 : 0);
