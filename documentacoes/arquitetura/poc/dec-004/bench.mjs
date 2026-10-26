// Mede latencia de validacao LOCAL (sem rede). Uso: node bench.mjs
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { makeEnv, TENANT_A } from './lib/env.mjs';

const env = makeEnv();
const rt = env.enrollRuntime(TENANT_A);
const ctx = { expectedTenantId: TENANT_A, requiredScope: 'tools:invoke' };
const N = 20000;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const us = (ns) => (ns / 1000).toFixed(1);

function measure(label, fn) {
  for (let i = 0; i < 2000; i++) fn(i); // aquecimento
  const samples = new Float64Array(N);
  for (let i = 0; i < N; i++) { const t0 = performance.now(); fn(i); samples[i] = (performance.now() - t0) * 1e6; }
  const s = Array.from(samples).sort((a, b) => a - b);
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  console.log(`${label.padEnd(46)} p50=${us(pct(s, 0.5))}us p95=${us(pct(s, 0.95))}us p99=${us(pct(s, 0.99))}us media=${us(mean)}us`);
}

console.log(`node ${process.version} | ${os.cpus()[0].model} | ${os.cpus().length} vCPU | N=${N}`);
const v = env.validators['tool-gateway'];
const tok = env.cp.issueToken(rt.tokenRequest('tool-gateway', ['tools:invoke'])).access_token;
const calls0 = v.networkCalls;
measure('validate (tool-gateway, reutilizavel)', () => v.validate(tok, ctx));
console.log(`chamadas de rede durante a medicao: ${v.networkCalls - calls0}`);

const d = env.validators.dispatcher;
const toks = Array.from({ length: N + 2000 }, () => env.cp.issueToken(rt.tokenRequest('dispatcher', ['jobs:pull'])).access_token);
let k = 0;
measure('validate (dispatcher, uso unico + cache jti)', () => d.validate(toks[k++], { expectedTenantId: TENANT_A, requiredScope: 'jobs:pull' }));
measure('emissao no CP (assinar token + verificar assertion)', () => env.cp.issueToken(rt.tokenRequest('tool-gateway', ['tools:invoke'])));
