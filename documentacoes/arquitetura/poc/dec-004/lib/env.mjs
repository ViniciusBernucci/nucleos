import { ControlPlane } from './control-plane.mjs';
import { Validator } from './validator.mjs';
import { FakeRuntime } from './fake-runtime.mjs';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export function makeClock(start = 1_800_000_000) {
  let t = start;
  const clock = () => t;
  clock.advance = (s) => { t += s; };
  return clock;
}

export function makeEnv() {
  const now = makeClock();
  const cp = new ControlPlane({ now });
  const mk = (audience, extra = {}) => new Validator({
    audience, now, fetchJwks: () => cp.jwks(), fetchRevocation: () => cp.revocationState(), ...extra,
  });
  const validators = {
    dispatcher: mk('dispatcher', { singleUse: true }),
    'tool-gateway': mk('tool-gateway'),
    'ai-gateway': mk('ai-gateway'),
  };
  const enrollRuntime = (tenantId) => {
    const rt = new FakeRuntime(tenantId, now);
    const secret = cp.provisionEnrollmentSecret(tenantId);
    cp.enroll(rt.enrollmentRequest(secret));
    return rt;
  };
  const refreshAll = () => Object.values(validators).forEach((v) => v.refresh());
  return { now, cp, validators, enrollRuntime, refreshAll };
}
