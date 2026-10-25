// Demonstracao narrada: casos negativos, rotacao e revogacao de emergencia. Uso: node demo.mjs
import { makeEnv, TENANT_A, TENANT_B } from './lib/env.mjs';
import { b64u, newKeyPair, signJwt } from './lib/jwt.mjs';
import { ISS } from './lib/control-plane.mjs';

const env = makeEnv();
const rtA = env.enrollRuntime(TENANT_A);
const rtB = env.enrollRuntime(TENANT_B);
const gw = env.validators['tool-gateway'];
const ctx = (t, s = 'tools:invoke') => ({ expectedTenantId: t, requiredScope: s });
const issue = (rt, aud = 'tool-gateway', sc = ['tools:invoke']) => env.cp.issueToken(rt.tokenRequest(aud, sc)).access_token;
const kidOf = (t) => JSON.parse(Buffer.from(t.split('.')[0], 'base64url')).kid;
const log = (m) => console.log(m);
const attempt = (label, fn) => {
  try { fn(); log(`  ACEITO    ${label}`); } catch (e) { log(`  REJEITADO ${label} -> ${e.code ?? e.message}`); }
};

log('== 1. Caminho feliz');
const tA = issue(rtA);
attempt('token valido de A no tool-gateway', () => gw.validate(tA, ctx(TENANT_A)));

log('== 2. Casos negativos');
const [h, p, s] = tA.split('.');
const adulterado = JSON.parse(Buffer.from(p, 'base64url')); adulterado.tenant_id = TENANT_B; adulterado.sub = `runtime:${TENANT_B}`;
attempt('tenant adulterado no payload', () => gw.validate(`${h}.${b64u(JSON.stringify(adulterado))}.${s}`, ctx(TENANT_B)));
attempt('token de A em contexto de B', () => gw.validate(tA, ctx(TENANT_B)));
attempt('audiencia errada (ai-gateway no tool-gateway)', () => gw.validate(issue(rtA, 'ai-gateway', ['llm:complete']), ctx(TENANT_A, 'llm:complete')));
const tExp = issue(rtA); env.now.advance(331);
attempt('expirado (331 s apos emissao)', () => gw.validate(tExp, ctx(TENANT_A)));
env.now.advance(-331);
const tV = issue(rtA); env.cp.revokeTenantCredentials(TENANT_A); env.refreshAll();
attempt('versao revogada (ver 1 < min 2)', () => gw.validate(tV, ctx(TENANT_A)));
attempt('B continua valido apos revogar A (SEC-15)', () => gw.validate(issue(rtB), ctx(TENANT_B)));
const tD = issue(rtB, 'dispatcher', ['jobs:pull']);
attempt('dispatcher: 1o uso do token', () => env.validators.dispatcher.validate(tD, ctx(TENANT_B, 'jobs:pull')));
attempt('dispatcher: replay do mesmo jti', () => env.validators.dispatcher.validate(tD, ctx(TENANT_B, 'jobs:pull')));
attempt('assinado por chave do atacante', () => gw.validate(signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: env.cp.activeKey.kid }, { iss: ISS }, newKeyPair().privateKey), ctx(TENANT_B)));

log('== 3. Rotacao sem downtime (duas chaves ativas no JWKS)');
const k1 = env.cp.activeKey.kid;
const tOld = issue(rtB);
log(`  chave ativa: ${k1}`);
const k2 = env.cp.publishNextKey(); env.refreshAll();
log(`  publicada ${k2}; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
env.cp.activateKey(k2);
const tNew = issue(rtB);
log(`  ativada ${k2}; novo token kid=${kidOf(tNew)}`);
attempt('token antigo (k1) durante a sobreposicao', () => gw.validate(tOld, ctx(TENANT_B)));
attempt('token novo (k2)', () => gw.validate(tNew, ctx(TENANT_B)));
env.now.advance(331); env.cp.retireKey(k1); env.refreshAll();
log(`  k1 aposentada apos TTL+skew; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
attempt('token antigo (k1) apos aposentadoria', () => gw.validate(tOld, ctx(TENANT_B)));
attempt('token novo emitido apos aposentadoria', () => gw.validate(issue(rtB), ctx(TENANT_B)));

log('== 4. Revogacao de emergencia da chave de assinatura');
const comp = env.cp.activeKey;
const vivo = issue(rtB);
attempt('token vivo antes da revogacao', () => gw.validate(vivo, ctx(TENANT_B)));
const k3 = env.cp.emergencyRevokeKey(comp.kid); env.refreshAll();
log(`  chave ${comp.kid} revogada; nova ativa ${k3}; JWKS = [${env.cp.jwks().keys.map((k) => k.kid)}]`);
attempt('mesmo token vivo apos revogacao', () => gw.validate(vivo, ctx(TENANT_B)));
attempt('runtime B reemite e volta a operar (sem novo enrollment)', () => gw.validate(issue(rtB), ctx(TENANT_B)));
log(`\nchamadas de rede do tool-gateway ao CP (refresh/poll) em toda a demo: ${gw.networkCalls}`);
