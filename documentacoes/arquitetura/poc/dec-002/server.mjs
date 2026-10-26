// PoC DESCARTAVEL (DEC-002). Autenticacao propria: argon2id + TOTP + sessao opaca em PostgreSQL.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';
import { hash, verify, Algorithm } from '@node-rs/argon2';

// OWASP Password Storage Cheat Sheet: argon2id m=19 MiB, t=2, p=1 (minimo recomendado).
export const ARGON2 = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = (pw) => hash(pw, ARGON2);

// --- TOTP (RFC 6238, SHA-1, 6 digitos, 30 s) com node:crypto, sem dependencia extra ---
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32encode(buf) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
export function totp(secret, t = Date.now()) {
  const ctr = Buffer.alloc(8);
  ctr.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = crypto.createHmac('sha1', secret).update(ctr).digest();
  const o = h[19] & 15;
  const code = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}
const totpOk = (secret, code) =>
  [-1, 0, 1].some((d) => {
    const a = Buffer.from(totp(secret, Date.now() + d * 30000));
    const b = Buffer.from(String(code ?? ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });

// --- cifra da seed (chave vem de env/segredo, nunca do banco) ---
export function seal(key, plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
const open = (key, blob) => {
  const d = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
};

const sha = (t) => crypto.createHash('sha256').update(t).digest();
const DUMMY = await hashPassword('dummy-para-tempo-constante');

export function createServer({ pool, seedKey, sessionTtlMs = 3600_000 }) {
  const json = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const readBody = async (req) => {
    let s = '';
    for await (const c of req) s += c;
    return s ? JSON.parse(s) : {};
  };
  // Valida a sessao A CADA requisicao, no banco: revogacao = UPDATE; efeito imediato.
  async function authenticate(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!m) return null;
    const { rows } = await pool.query(
      `SELECT user_id FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [sha(m[1])],
    );
    return rows[0]?.user_id ?? null;
  }
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/login') {
        const { email, password, totp: code } = await readBody(req);
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const u = rows[0];
        const pwOk = await verify(u?.password_hash ?? DUMMY, String(password ?? ''));
        if (!u || !pwOk) return json(res, 401, { error: 'credenciais_invalidas' });
        if (u.totp_secret_enc && !totpOk(open(seedKey, u.totp_secret_enc), code))
          return json(res, 401, { error: 'mfa_invalido' });
        const token = crypto.randomBytes(32).toString('base64url');
        await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [
          sha(token), u.id, new Date(Date.now() + sessionTtlMs),
        ]);
        return json(res, 200, { token });
      }
      const uid = await authenticate(req);
      if (!uid) return json(res, 401, { error: 'sessao_invalida' });
      if (req.method === 'GET' && req.url === '/me') {
        // Tenant resolvido NO SERVIDOR por membership; X-Tenant-Id e so contexto solicitado.
        const asked = req.headers['x-tenant-id'];
        const { rows } = await pool.query(
          `SELECT m.org_id, m.role FROM memberships m WHERE m.user_id = $1 AND ($2::uuid IS NULL OR m.org_id = $2::uuid)`,
          [uid, asked ?? null],
        );
        if (asked && rows.length === 0) return json(res, 403, { error: 'sem_membership' });
        return json(res, 200, { userId: uid, orgs: rows });
      }
      if (req.method === 'POST' && req.url === '/logout') {
        const tok = req.headers.authorization.slice(7);
        await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha(tok)]);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && req.url === '/revoke-all') {
        // "Sair de todos os dispositivos" / admin: revoga todas as sessoes do usuario.
        const r = await pool.query(
          'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [uid]);
        return json(res, 200, { revoked: r.rowCount });
      }
      return json(res, 404, { error: 'nao_encontrado' });
    } catch (e) {
      console.error('erro interno:', e.message);
      return json(res, 500, { error: 'interno' });
    }
  });
}
