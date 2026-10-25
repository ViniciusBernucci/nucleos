import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { makeEnv, TENANT_A, TENANT_B } from '../lib/env.mjs';
import { b64u, newKeyPair, signJwt } from '../lib/jwt.mjs';
import { ISS } from '../lib/control-plane.mjs';

const ctx = (tenant, scope = 'tools:invoke') => ({ expectedTenantId: tenant, requiredScope: scope });
const rejects = (fn, code) => assert.throws(fn, (e) => e.code === code, `esperado ${code}`);
const tokenFor = (env, rt, aud = 'tool-gateway', scope = ['tools:invoke']) =>
  env.cp.issueToken(rt.tokenRequest(aud, scope)).access_token;

test('caminho feliz: enrollment, emissao e validacao local', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const c = env.validators['tool-gateway'].validate(tokenFor(env, rt), ctx(TENANT_A));
  assert.equal(c.tenant_id, TENANT_A);
  assert.equal(c.sub, `runtime:${TENANT_A}`);
  assert.equal(c.aud, 'tool-gateway');
  assert.equal(c.exp - c.iat, 300);
});

test('enrollment: segredo de uso unico, expiravel e sem chave privada na mensagem', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  assert.ok(!JSON.stringify(rt.enrollmentRequest('x'.repeat(32))).includes('"d"'));
  // reuso do mesmo segredo
  const secret = env.cp.provisionEnrollmentSecret(TENANT_B);
  const rtB = new (rt.constructor)(TENANT_B, env.now);
  env.cp.enroll(rtB.enrollmentRequest(secret));
  rejects(() => env.cp.enroll(rtB.enrollmentRequest(secret)), 'enrollment_invalid');
  // expirado
  const s2 = env.cp.provisionEnrollmentSecret(TENANT_A);
  env.now.advance(601);
  rejects(() => env.cp.enroll(rt.enrollmentRequest(s2)), 'enrollment_expired');
  // segredo errado (mesmo tamanho minimo do esquema)
  env.cp.provisionEnrollmentSecret(TENANT_A);
  rejects(() => env.cp.enroll(rt.enrollmentRequest('z'.repeat(43))), 'enrollment_invalid');
});

test('NEGATIVO: token expirado (alem da tolerancia de 30 s)', () => {
  const env = makeEnv();
  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
  const v = env.validators['tool-gateway'];
  env.now.advance(300 + 30); // exatamente no limite da tolerancia: ainda aceito
  assert.doesNotThrow(() => v.validate(t, ctx(TENANT_A)));
  env.now.advance(1);
  rejects(() => v.validate(t, ctx(TENANT_A)), 'expired');
});

test('NEGATIVO: audiencia errada (token do gateway de IA nao vale no tool-gateway)', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const t = tokenFor(env, rt, 'ai-gateway', ['llm:complete']);
  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A, 'llm:complete')), 'bad_audience');
  assert.doesNotThrow(() => env.validators['ai-gateway'].validate(t, ctx(TENANT_A, 'llm:complete')));
});

test('NEGATIVO: tenant adulterado no payload (assinatura nao confere)', () => {
  const env = makeEnv();
  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
  const [h, p, s] = t.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  claims.tenant_id = TENANT_B;
  claims.sub = `runtime:${TENANT_B}`;
  const forged = `${h}.${b64u(JSON.stringify(claims))}.${s}`;
  rejects(() => env.validators['tool-gateway'].validate(forged, ctx(TENANT_B)), 'bad_signature');
});

test('NEGATIVO: token valido de A apresentado em contexto de B (SEC-07)', () => {
  const env = makeEnv();
  const t = tokenFor(env, env.enrollRuntime(TENANT_A));
  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_B)), 'tenant_mismatch');
});

test('NEGATIVO: claims sub e tenant_id divergentes, assinados pela chave real', () => {
  const env = makeEnv();
  const key = env.cp.activeKey;
  const now = env.now();
  const claims = { iss: ISS, sub: `runtime:${TENANT_B}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A,
    jti: b64u(Buffer.alloc(16, 1)), iat: now, exp: now + 300, ver: 1 };
  const t = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid }, claims, key.privateKey);
  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A)), 'sub_tenant_mismatch');
});

test('NEGATIVO: versao de credencial revogada; B nao e afetado (SEC-15)', () => {
  const env = makeEnv();
  const rtA = env.enrollRuntime(TENANT_A);
  const rtB = env.enrollRuntime(TENANT_B);
  const tA = tokenFor(env, rtA);
  const tB = tokenFor(env, rtB);
  const v = env.validators['tool-gateway'];
  assert.doesNotThrow(() => v.validate(tA, ctx(TENANT_A)));
  env.cp.revokeTenantCredentials(TENANT_A);
  env.refreshAll(); // propagacao por poll/push
  rejects(() => v.validate(tA, ctx(TENANT_A)), 'version_revoked');
  assert.doesNotThrow(() => v.validate(tB, ctx(TENANT_B)));
  // runtime A antigo nao consegue novo token; precisa de novo enrollment
  rejects(() => env.cp.issueToken(rtA.tokenRequest('tool-gateway', ['tools:invoke'])), 'unknown_runtime');
  const secret = env.cp.provisionEnrollmentSecret(TENANT_A);
  env.cp.enroll(rtA.enrollmentRequest(secret));
  const novo = tokenFor(env, rtA);
  assert.equal(v.validate(novo, ctx(TENANT_A)).ver, 2);
});

test('NEGATIVO: replay de jti (dispatcher e uso unico; CP rejeita client_assertion repetida)', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const t = tokenFor(env, rt, 'dispatcher', ['jobs:pull']);
  const d = env.validators.dispatcher;
  assert.doesNotThrow(() => d.validate(t, ctx(TENANT_A, 'jobs:pull')));
  rejects(() => d.validate(t, ctx(TENANT_A, 'jobs:pull')), 'replay');
  // assertion repetida no CP
  const req = rt.tokenRequest('tool-gateway', ['tools:invoke'], { jti: 'fixed-jti-0123456789' });
  env.cp.issueToken(req);
  rejects(() => env.cp.issueToken(req), 'replay');
  // token invalido (escopo ausente) nao "queima" o jti
  const t2 = tokenFor(env, rt, 'dispatcher', ['jobs:pull']);
  rejects(() => d.validate(t2, ctx(TENANT_A, 'jobs:ack')), 'scope_missing');
  assert.doesNotThrow(() => d.validate(t2, ctx(TENANT_A, 'jobs:pull')));
});

test('NEGATIVO: escopo nao permitido na emissao e ausente na validacao', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  rejects(() => env.cp.issueToken(rt.tokenRequest('tool-gateway', ['llm:complete'])), 'scope_not_allowed');
  const t = tokenFor(env, rt);
  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A, 'tools:admin')), 'scope_missing');
});

test('NEGATIVO: forjados (alg none, HS256, chave propria, kid desconhecido, lixo)', () => {
  const env = makeEnv();
  const v = env.validators['tool-gateway'];
  const now = env.now();
  const claims = { iss: ISS, sub: `runtime:${TENANT_A}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A,
    jti: b64u(Buffer.alloc(16, 2)), iat: now, exp: now + 300, ver: 1 };
  const kid = env.cp.activeKey.kid;
  const enc = (o) => b64u(JSON.stringify(o));
  const none = `${enc({ alg: 'none', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}.`;
  rejects(() => v.validate(none, ctx(TENANT_A)), 'malformed');
  const none2 = `${enc({ alg: 'none', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}.AAAA`;
  rejects(() => v.validate(none2, ctx(TENANT_A)), 'bad_header');
  const hs = `${enc({ alg: 'HS256', typ: 'nucleos-runtime+jwt', kid })}.${enc(claims)}`;
  const hsTok = `${hs}.${createHmac('sha256', 'qualquer').update(hs).digest('base64url')}`;
  rejects(() => v.validate(hsTok, ctx(TENANT_A)), 'bad_header');
  const atacante = newKeyPair();
  const own = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid }, claims, atacante.privateKey);
  rejects(() => v.validate(own, ctx(TENANT_A)), 'bad_signature');
  const unk = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: 'outro' }, claims, atacante.privateKey);
  rejects(() => v.validate(unk, ctx(TENANT_A)), 'unknown_kid');
  rejects(() => v.validate('lixo', ctx(TENANT_A)), 'malformed');
  rejects(() => v.validate('a'.repeat(5000), ctx(TENANT_A)), 'malformed');
});

test('NEGATIVO: TTL acima do maximo e iat no futuro', () => {
  const env = makeEnv();
  const key = env.cp.activeKey;
  const now = env.now();
  const base = { iss: ISS, sub: `runtime:${TENANT_A}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_A, ver: 1 };
  const sign = (extra) => signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: key.kid },
    { ...base, jti: b64u(Buffer.alloc(16, 3)), ...extra }, key.privateKey);
  const v = env.validators['tool-gateway'];
  rejects(() => v.validate(sign({ iat: now, exp: now + 601 }), ctx(TENANT_A)), 'ttl_too_long');
  rejects(() => v.validate(sign({ iat: now + 31, exp: now + 200 }), ctx(TENANT_A)), 'not_yet_valid');
});

test('ROTACAO sem downtime com duas chaves (JWKS com kid)', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const v = env.validators['tool-gateway'];
  const k1 = env.cp.activeKey.kid;
  const tOld = tokenFor(env, rt); // assinado por k1
  // 1) publicar k2 (ainda nao assina) e propagar
  const k2 = env.cp.publishNextKey();
  assert.equal(env.cp.jwks().keys.length, 2);
  env.refreshAll();
  // 2) ativar k2: novos tokens usam k2; antigos (k1) continuam validos
  env.cp.activateKey(k2);
  const tNew = tokenFor(env, rt);
  assert.equal(JSON.parse(Buffer.from(tNew.split('.')[0], 'base64url')).kid, k2);
  assert.doesNotThrow(() => v.validate(tOld, ctx(TENANT_A)));
  assert.doesNotThrow(() => v.validate(tNew, ctx(TENANT_A)));
  // 3) aposentar k1 apos TTL maximo + tolerancia
  env.now.advance(300 + 30 + 1);
  env.cp.retireKey(k1);
  env.refreshAll();
  assert.deepEqual(env.cp.jwks().keys.map((k) => k.kid), [k2]);
  rejects(() => v.validate(tOld, ctx(TENANT_A)), 'unknown_kid');
  const tFresh = tokenFor(env, rt);
  assert.doesNotThrow(() => v.validate(tFresh, ctx(TENANT_A)));
  // chave ativa nao pode ser aposentada
  assert.throws(() => env.cp.retireKey(k2));
});

test('ROTACAO: validador que ainda nao atualizou o JWKS faz refresh limitado por kid desconhecido', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const v = env.validators['tool-gateway'];
  const k2 = env.cp.publishNextKey();
  env.cp.activateKey(k2); // sem propagar antes (caso ruim)
  const calls = v.networkCalls;
  const t = tokenFor(env, rt);
  assert.doesNotThrow(() => v.validate(t, ctx(TENANT_A))); // refresh sob demanda
  assert.equal(v.networkCalls, calls + 1);
  // kid inexistente em rajada: no maximo 1 refresh por janela de 10 s
  const bad = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: 'zzz' }, {}, newKeyPair().privateKey);
  for (let i = 0; i < 50; i++) rejects(() => v.validate(bad, ctx(TENANT_A)), 'unknown_kid');
  assert.ok(v.networkCalls <= calls + 2);
});

test('REVOGACAO DE EMERGENCIA da chave de assinatura: tokens da chave comprometida caem na hora', () => {
  const env = makeEnv();
  const rtA = env.enrollRuntime(TENANT_A);
  const v = env.validators['tool-gateway'];
  const comprometida = env.cp.activeKey;
  const tVivo = tokenFor(env, rtA); // ainda dentro do TTL
  const forjado = signJwt({ alg: 'EdDSA', typ: 'nucleos-runtime+jwt', kid: comprometida.kid },
    { iss: ISS, sub: `runtime:${TENANT_B}`, aud: 'tool-gateway', scope: ['tools:invoke'], tenant_id: TENANT_B,
      jti: b64u(Buffer.alloc(16, 4)), iat: env.now(), exp: env.now() + 300, ver: 1 }, comprometida.privateKey);
  assert.doesNotThrow(() => v.validate(forjado, ctx(TENANT_B))); // atacante com a chave vazada teria acesso
  env.cp.emergencyRevokeKey(comprometida.kid);
  env.refreshAll(); // push de emergencia, sem esperar o poll
  rejects(() => v.validate(tVivo, ctx(TENANT_A)), 'unknown_kid');
  rejects(() => v.validate(forjado, ctx(TENANT_B)), 'unknown_kid');
  // runtime legitimo re-emite com a nova chave: recuperacao sem novo enrollment
  assert.doesNotThrow(() => v.validate(tokenFor(env, rtA), ctx(TENANT_A)));
});

test('REVOGACAO pontual de jti', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const t = tokenFor(env, rt);
  const jti = JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).jti;
  env.cp.revokedJti.push(jti);
  env.refreshAll();
  rejects(() => env.validators['tool-gateway'].validate(t, ctx(TENANT_A)), 'jti_revoked');
});

test('VALIDACAO LOCAL: nenhuma chamada de rede por requisicao', () => {
  const env = makeEnv();
  const rt = env.enrollRuntime(TENANT_A);
  const v = env.validators['tool-gateway'];
  const t = tokenFor(env, rt);
  const antes = v.networkCalls;
  for (let i = 0; i < 1000; i++) v.validate(t, ctx(TENANT_A));
  assert.equal(v.networkCalls, antes);
});
