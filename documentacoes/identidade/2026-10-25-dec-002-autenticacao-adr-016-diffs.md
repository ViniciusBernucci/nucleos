# Diffs da entrega DEC-002 (codigo e configuracao do PoC)

Voltar: [entrega](2026-10-25-dec-002-autenticacao-adr-016.md). Base 4be3ce3. Nenhum commit anterior da tarefa; o commit unico desta entrega inclui estes arquivos. Excluidos por regra: diffs de `documentacoes/` (ADR, entrega) e `lessons/`, e `package-lock.json` (sha256 `fa5b9fbfa04c64acc8613c25a00b45c87404e48362494d1cd5e8cbe6e0dc31a5`, lock npm com 2 dependencias diretas).

```diff
diff --git a/documentacoes/arquitetura/poc/dec-002/kratos-identity.schema.json b/documentacoes/arquitetura/poc/dec-002/kratos-identity.schema.json
new file mode 100644
index 0000000..b817b49
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/kratos-identity.schema.json
@@ -0,0 +1 @@
+{"$id":"https://schemas.example.test/identity.json","$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"traits":{"type":"object","properties":{"email":{"type":"string","format":"email","ory.sh/kratos":{"credentials":{"password":{"identifier":true}}}}}}}}
diff --git a/documentacoes/arquitetura/poc/dec-002/kratos.yml b/documentacoes/arquitetura/poc/dec-002/kratos.yml
new file mode 100644
index 0000000..c571d8f
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/kratos.yml
@@ -0,0 +1,21 @@
+# Config minima descartavel apenas para medir RAM em repouso (sem fluxos reais).
+version: v1.3.1
+dsn: memory
+serve:
+  public: { base_url: http://127.0.0.1:4433/, host: 0.0.0.0 }
+  admin: { base_url: http://127.0.0.1:4434/, host: 0.0.0.0 }
+selfservice:
+  default_browser_return_url: http://127.0.0.1:3000/
+  flows:
+    login: { ui_url: http://127.0.0.1:3000/login }
+    registration: { ui_url: http://127.0.0.1:3000/registration }
+  methods:
+    password: { enabled: true }
+identity:
+  default_schema_id: default
+  schemas:
+    - id: default
+      url: file:///etc/config/identity.schema.json
+secrets:
+  cookie: [PoC-descartavel-sem-valor-real-0123456789]
+  cipher: [32-LONG-SECRET-NOT-SECURE-AT-ALL]
diff --git a/documentacoes/arquitetura/poc/dec-002/medir-ram-idp.sh b/documentacoes/arquitetura/poc/dec-002/medir-ram-idp.sh
new file mode 100755
index 0000000..a500766
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/medir-ram-idp.sh
@@ -0,0 +1,26 @@
+#!/usr/bin/env bash
+# Mede RAM em repouso de Keycloak (start-dev, H2) em container descartavel 127.0.0.1. Sem dados reais.
+set -euo pipefail
+NAME=poc-dec002-kc; PORT=${POC_KC_PORT:-58080}
+trap 'docker rm -f $NAME >/dev/null 2>&1 || true' EXIT
+docker rm -f $NAME >/dev/null 2>&1 || true
+docker run -d --name $NAME -p 127.0.0.1:$PORT:8080 \
+  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')" \
+  quay.io/keycloak/keycloak:26.0 start-dev >/dev/null
+for i in $(seq 1 120); do
+  curl -fs -o /dev/null "http://127.0.0.1:$PORT/realms/master" && break; sleep 2
+done
+echo "keycloak pronto apos ~$((i*2)) s"
+sleep 20
+for n in 1 2 3; do echo "MEDIDA_RAM keycloak_idle: $(docker stats --no-stream --format '{{.MemUsage}}' $NAME)"; sleep 5; done
+
+# --- Ory Kratos (dsn=memory), mesma abordagem ---
+KN=poc-dec002-kratos
+trap 'docker rm -f $NAME $KN >/dev/null 2>&1 || true' EXIT
+D=$(cd "$(dirname "$0")" && pwd)
+docker run -d --name $KN -p 127.0.0.1:54433:4433 -v "$D/kratos.yml:/etc/config/kratos.yml:ro" \
+  -v "$D/kratos-identity.schema.json:/etc/config/identity.schema.json:ro" \
+  oryd/kratos:v1.3.1 serve --config /etc/config/kratos.yml --dev >/dev/null
+for i in $(seq 1 60); do curl -fs -o /dev/null "http://127.0.0.1:54433/health/ready" && break; sleep 1; done
+sleep 10
+for n in 1 2 3; do echo "MEDIDA_RAM kratos_idle: $(docker stats --no-stream --format '{{.MemUsage}}' $KN)"; sleep 3; done
diff --git a/documentacoes/arquitetura/poc/dec-002/package.json b/documentacoes/arquitetura/poc/dec-002/package.json
new file mode 100644
index 0000000..9f880a8
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/package.json
@@ -0,0 +1,12 @@
+{
+  "name": "poc-dec-002-auth",
+  "private": true,
+  "version": "0.0.0",
+  "description": "PoC DESCARTAVEL (DEC-002): login + sessao opaca + revogacao. Nao e codigo de producao.",
+  "type": "module",
+  "engines": { "node": ">=24" },
+  "dependencies": {
+    "@node-rs/argon2": "2.2.2",
+    "pg": "8.23.1"
+  }
+}
diff --git a/documentacoes/arquitetura/poc/dec-002/poc.mjs b/documentacoes/arquitetura/poc/dec-002/poc.mjs
new file mode 100644
index 0000000..2f60c4f
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/poc.mjs
@@ -0,0 +1,98 @@
+// Roteiro medido do PoC DEC-002. Uso: DATABASE_URL=postgres://...127.0.0.1... node poc.mjs
+import fs from 'node:fs';
+import crypto from 'node:crypto';
+import pg from 'pg';
+import { createServer, hashPassword, seal, totp, b32encode } from './server.mjs';
+
+const url = process.env.DATABASE_URL;
+if (!url || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('DATABASE_URL deve apontar para 127.0.0.1 (container descartavel)');
+const pool = new pg.Pool({ connectionString: url, max: 5 });
+await pool.query('DROP TABLE IF EXISTS sessions, memberships, users, organizations CASCADE');
+await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
+
+const seedKey = crypto.randomBytes(32);              // chave KEK so desta execucao
+const totpSecret = crypto.randomBytes(20);
+const pw = crypto.randomBytes(12).toString('base64url'); // senha sintetica, nunca impressa
+const uid = crypto.randomUUID(), orgA = crypto.randomUUID(), orgB = crypto.randomUUID();
+await pool.query('INSERT INTO organizations VALUES ($1,$2),($3,$4)', [orgA, 'Org A', orgB, 'Org B']);
+const t0 = performance.now();
+const ph = await hashPassword(pw);
+const hashMs = performance.now() - t0;
+await pool.query('INSERT INTO users VALUES ($1,$2,$3,$4)', [uid, 'poc@example.test', ph, seal(seedKey, totpSecret)]);
+await pool.query('INSERT INTO memberships VALUES ($1,$2,$3)', [uid, orgA, 'admin']);
+
+const srv = createServer({ pool, seedKey });
+await new Promise((r) => srv.listen(0, '127.0.0.1', r));
+const base = `http://127.0.0.1:${srv.address().port}`;
+const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
+  const s = performance.now();
+  const r = await fetch(base + path, {
+    method, body: body && JSON.stringify(body),
+    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
+  });
+  return { status: r.status, body: await r.json(), ms: performance.now() - s };
+};
+const results = [];
+const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
+
+console.log(`argon2id (m=19456 KiB,t=2,p=1): hash em ${hashMs.toFixed(1)} ms`);
+const email = 'poc@example.test';
+check('login com senha errada -> 401', (await call('/login', { method: 'POST', body: { email, password: 'x' } })).status === 401);
+check('login sem TOTP -> 401 mfa_invalido', (await call('/login', { method: 'POST', body: { email, password: pw } })).body.error === 'mfa_invalido');
+const l = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
+check('login com senha + TOTP -> 200 e token opaco', l.status === 200 && !!l.body.token, `(${l.ms.toFixed(1)} ms)`);
+const tokenA = l.body.token;
+const l2 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
+const tokenB = l2.body.token;
+const stored = await pool.query('SELECT count(*)::int n FROM sessions WHERE token_hash = $1', [Buffer.from(tokenA)]);
+check('token em claro nao esta gravado (so sha256)', stored.rows[0].n === 0);
+const me = await call('/me', { token: tokenA });
+check('GET /me com sessao valida -> 200 e org por membership', me.status === 200 && me.body.orgs[0].org_id === orgA, `(${me.ms.toFixed(1)} ms)`);
+check('X-Tenant-Id de outra org (sem membership) -> 403', (await call('/me', { token: tokenA, headers: { 'x-tenant-id': orgB } })).status === 403);
+
+// --- REVOGACAO (AC-2): requisicao imediatamente seguinte ---
+const rv = await call('/logout', { method: 'POST', token: tokenA });
+const after = await call('/me', { token: tokenA });
+check('logout: requisicao seguinte com o token revogado -> 401', rv.status === 200 && after.status === 401,
+  `(revogacao ${rv.ms.toFixed(1)} ms; rejeicao ${after.ms.toFixed(1)} ms)`);
+check('outra sessao do mesmo usuario segue valida apos logout de A', (await call('/me', { token: tokenB })).status === 200);
+const ra = await call('/revoke-all', { method: 'POST', token: tokenB });
+const afterAll = await call('/me', { token: tokenB });
+check('revoke-all: sessao B rejeitada na requisicao seguinte -> 401', ra.status === 200 && afterAll.status === 401, `(${ra.body.revoked} sessao(oes) revogada(s))`);
+
+// Revogacao sob concorrencia: 200 requisicoes em voo; mede o instante da ultima aceita vs revogacao.
+const l3 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
+let revokedAt = null, acceptedAfter = 0, rejected = 0, total = 0, run = true;
+const worker = (async () => { while (run) {
+  const r = await call('/me', { token: l3.body.token }); total++;
+  const doneAt = performance.now();
+  if (r.status === 200 && revokedAt !== null && doneAt - r.ms > revokedAt) acceptedAfter++;
+  if (r.status === 401) rejected++;
+}})();
+await new Promise((r) => setTimeout(r, 100));
+const other = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
+await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [crypto.createHash('sha256').update(l3.body.token).digest()]);
+revokedAt = performance.now();
+await new Promise((r) => setTimeout(r, 150)); run = false; await worker;
+check('revogacao sob carga: nenhuma requisicao INICIADA apos o UPDATE foi aceita', acceptedAfter === 0 && rejected > 0,
+  `(${total} req, ${rejected} rejeitadas, ${acceptedAfter} aceitas apos revogar)`);
+void other;
+
+// Sessao expirada
+const l4 = await call('/login', { method: 'POST', body: { email, password: pw, totp: totp(totpSecret) } });
+await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`);
+check('sessao expirada -> 401', (await call('/me', { token: l4.body.token })).status === 401);
+
+// Seed cifrada: o banco nao contem a seed em claro
+const row = (await pool.query('SELECT password_hash, totp_secret_enc FROM users')).rows[0];
+check('hash de senha e PHC argon2id', row.password_hash.startsWith('$argon2id$'));
+check('seed TOTP nao aparece em claro no banco', !row.totp_secret_enc.includes(totpSecret));
+console.log(`b32 da seed nao e impressa; tamanho seed cifrada = ${row.totp_secret_enc.length} bytes (12 iv + 16 tag + ${totpSecret.length})`);
+void b32encode;
+
+const mu = process.memoryUsage();
+console.log(`MEDIDA_RAM node_rss_mib=${(mu.rss / 1048576).toFixed(1)} heap_used_mib=${(mu.heapUsed / 1048576).toFixed(1)}`);
+srv.close(); await pool.end();
+const bad = results.filter((x) => !x).length;
+console.log(`RESULTADO ${results.length - bad}/${results.length} PASS`);
+process.exit(bad ? 1 : 0);
diff --git a/documentacoes/arquitetura/poc/dec-002/run.sh b/documentacoes/arquitetura/poc/dec-002/run.sh
new file mode 100755
index 0000000..b6a1850
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/run.sh
@@ -0,0 +1,16 @@
+#!/usr/bin/env bash
+# PoC DEC-002 reproduzivel. Requer Node 24 e Docker. Container descartavel em 127.0.0.1, sem dados reais.
+set -euo pipefail
+cd "$(dirname "$0")"
+NAME=poc-dec002-pg; PORT=${POC_PG_PORT:-55432}
+PGPASS=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')   # senha efemera, nao versionada
+cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
+trap cleanup EXIT
+cleanup
+docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=poc \
+  -p 127.0.0.1:$PORT:5432 postgres:16-alpine >/dev/null
+for _ in $(seq 1 40); do docker exec "$NAME" pg_isready -U postgres -q && break; sleep 0.5; done
+sleep 1
+npm ci --no-audit --no-fund --silent
+DATABASE_URL="postgres://postgres:$PGPASS@127.0.0.1:$PORT/poc" node poc.mjs
+echo "MEDIDA_RAM postgres_container: $(docker stats --no-stream --format '{{.MemUsage}}' "$NAME")"
diff --git a/documentacoes/arquitetura/poc/dec-002/schema.sql b/documentacoes/arquitetura/poc/dec-002/schema.sql
new file mode 100644
index 0000000..4cd8c07
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/schema.sql
@@ -0,0 +1,22 @@
+-- PoC DEC-002: modelo minimo de identidade no banco CENTRAL (nunca no banco do tenant).
+CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
+CREATE TABLE users (
+  id uuid PRIMARY KEY,
+  email text NOT NULL UNIQUE,
+  password_hash text NOT NULL,          -- argon2id (PHC string, salt embutido)
+  totp_secret_enc bytea                 -- seed TOTP cifrada (AES-256-GCM, chave fora do banco)
+);
+CREATE TABLE memberships (
+  user_id uuid NOT NULL REFERENCES users(id),
+  org_id  uuid NOT NULL REFERENCES organizations(id),
+  role text NOT NULL,
+  PRIMARY KEY (user_id, org_id)
+);
+CREATE TABLE sessions (
+  token_hash bytea PRIMARY KEY,         -- sha256 do token opaco; o token em claro nunca e gravado
+  user_id uuid NOT NULL REFERENCES users(id),
+  created_at timestamptz NOT NULL DEFAULT now(),
+  expires_at timestamptz NOT NULL,
+  revoked_at timestamptz
+);
+CREATE INDEX sessions_user_idx ON sessions(user_id);
diff --git a/documentacoes/arquitetura/poc/dec-002/server.mjs b/documentacoes/arquitetura/poc/dec-002/server.mjs
new file mode 100644
index 0000000..e76bb47
--- /dev/null
+++ b/documentacoes/arquitetura/poc/dec-002/server.mjs
@@ -0,0 +1,115 @@
+// PoC DESCARTAVEL (DEC-002). Autenticacao propria: argon2id + TOTP + sessao opaca em PostgreSQL.
+import http from 'node:http';
+import crypto from 'node:crypto';
+import pg from 'pg';
+import { hash, verify, Algorithm } from '@node-rs/argon2';
+
+// OWASP Password Storage Cheat Sheet: argon2id m=19 MiB, t=2, p=1 (minimo recomendado).
+export const ARGON2 = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
+export const hashPassword = (pw) => hash(pw, ARGON2);
+
+// --- TOTP (RFC 6238, SHA-1, 6 digitos, 30 s) com node:crypto, sem dependencia extra ---
+const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
+export function b32encode(buf) {
+  let bits = '', out = '';
+  for (const b of buf) bits += b.toString(2).padStart(8, '0');
+  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
+  return out;
+}
+export function totp(secret, t = Date.now()) {
+  const ctr = Buffer.alloc(8);
+  ctr.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
+  const h = crypto.createHmac('sha1', secret).update(ctr).digest();
+  const o = h[19] & 15;
+  const code = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
+  return String(code).padStart(6, '0');
+}
+const totpOk = (secret, code) =>
+  [-1, 0, 1].some((d) => {
+    const a = Buffer.from(totp(secret, Date.now() + d * 30000));
+    const b = Buffer.from(String(code ?? ''));
+    return a.length === b.length && crypto.timingSafeEqual(a, b);
+  });
+
+// --- cifra da seed (chave vem de env/segredo, nunca do banco) ---
+export function seal(key, plain) {
+  const iv = crypto.randomBytes(12);
+  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
+  const ct = Buffer.concat([c.update(plain), c.final()]);
+  return Buffer.concat([iv, c.getAuthTag(), ct]);
+}
+const open = (key, blob) => {
+  const d = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
+  d.setAuthTag(blob.subarray(12, 28));
+  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
+};
+
+const sha = (t) => crypto.createHash('sha256').update(t).digest();
+const DUMMY = await hashPassword('dummy-para-tempo-constante');
+
+export function createServer({ pool, seedKey, sessionTtlMs = 3600_000 }) {
+  const json = (res, code, body) => {
+    res.writeHead(code, { 'content-type': 'application/json' });
+    res.end(JSON.stringify(body));
+  };
+  const readBody = async (req) => {
+    let s = '';
+    for await (const c of req) s += c;
+    return s ? JSON.parse(s) : {};
+  };
+  // Valida a sessao A CADA requisicao, no banco: revogacao = UPDATE; efeito imediato.
+  async function authenticate(req) {
+    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
+    if (!m) return null;
+    const { rows } = await pool.query(
+      `SELECT user_id FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
+      [sha(m[1])],
+    );
+    return rows[0]?.user_id ?? null;
+  }
+  return http.createServer(async (req, res) => {
+    try {
+      if (req.method === 'POST' && req.url === '/login') {
+        const { email, password, totp: code } = await readBody(req);
+        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
+        const u = rows[0];
+        const pwOk = await verify(u?.password_hash ?? DUMMY, String(password ?? ''));
+        if (!u || !pwOk) return json(res, 401, { error: 'credenciais_invalidas' });
+        if (u.totp_secret_enc && !totpOk(open(seedKey, u.totp_secret_enc), code))
+          return json(res, 401, { error: 'mfa_invalido' });
+        const token = crypto.randomBytes(32).toString('base64url');
+        await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [
+          sha(token), u.id, new Date(Date.now() + sessionTtlMs),
+        ]);
+        return json(res, 200, { token });
+      }
+      const uid = await authenticate(req);
+      if (!uid) return json(res, 401, { error: 'sessao_invalida' });
+      if (req.method === 'GET' && req.url === '/me') {
+        // Tenant resolvido NO SERVIDOR por membership; X-Tenant-Id e so contexto solicitado.
+        const asked = req.headers['x-tenant-id'];
+        const { rows } = await pool.query(
+          `SELECT m.org_id, m.role FROM memberships m WHERE m.user_id = $1 AND ($2::uuid IS NULL OR m.org_id = $2::uuid)`,
+          [uid, asked ?? null],
+        );
+        if (asked && rows.length === 0) return json(res, 403, { error: 'sem_membership' });
+        return json(res, 200, { userId: uid, orgs: rows });
+      }
+      if (req.method === 'POST' && req.url === '/logout') {
+        const tok = req.headers.authorization.slice(7);
+        await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha(tok)]);
+        return json(res, 200, { ok: true });
+      }
+      if (req.method === 'POST' && req.url === '/revoke-all') {
+        // "Sair de todos os dispositivos" / admin: revoga todas as sessoes do usuario.
+        const r = await pool.query(
+          'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [uid]);
+        return json(res, 200, { revoked: r.rowCount });
+      }
+      return json(res, 404, { error: 'nao_encontrado' });
+    } catch (e) {
+      console.error('erro interno:', e.message);
+      return json(res, 500, { error: 'interno' });
+    }
+  });
+}
```
