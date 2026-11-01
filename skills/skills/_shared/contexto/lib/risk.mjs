// Risk and execution profile are distinct. Legacy tasks retain their gates.
export const RISK_LEVELS = ['R0', 'R1', 'R2', 'R3', 'R4'];
export const CRITICAL_FACTORS = ['auth', 'authorization', 'data', 'migration', 'secrets', 'cross-layer-contract', 'concurrency', 'shared-infra'];
export const STANDARD_FACTORS = ['business', 'api', 'dependency', 'functional'];
export function riskPolicy(input) {
  if (!['simples', 'padrao', 'critico'].includes(input.profile)) throw Error('Perfil inválido; use simples, padrao ou critico');
  const factors = input.risk_factors || [];
  if (input.risk_level !== undefined && !RISK_LEVELS.includes(input.risk_level)) throw Error('risk_level inválido; use R0, R1, R2, R3 ou R4');
  if (!Array.isArray(factors) || factors.some(factor => typeof factor !== 'string')) throw Error('risk_factors deve ser array de nomes documentados');
  const unknown = factors.filter(f => ![...CRITICAL_FACTORS, ...STANDARD_FACTORS].includes(f));
  if (unknown.length) throw Error(`Fator de risco desconhecido: ${unknown.join(', ')}. Use risk_level R0–R4 separado de risk_factors; fatores aceitos: ${[...CRITICAL_FACTORS, ...STANDARD_FACTORS].join(', ')}`);
  const level = input.risk_level ?? (input.profile === 'critico' ? 'R3' : input.profile === 'simples' ? 'R1' : 'R2');
  if (!RISK_LEVELS.includes(level)) throw Error('risk_level inválido; use R0, R1, R2, R3 ou R4');
  if (factors.some(f => CRITICAL_FACTORS.includes(f)) && RISK_LEVELS.indexOf(level) < 3) throw Error('Risco crítico exige R3 ou R4 e perfil critico');
  if (RISK_LEVELS.indexOf(level) >= 3 && input.profile !== 'critico') throw Error('Risco exige perfil critico para R3/R4');
  if (input.qa_required !== undefined && typeof input.qa_required !== 'boolean') throw Error('qa_required deve ser booleano');
  return { risk_level: level, qa_required: RISK_LEVELS.indexOf(level) >= 3 || input.qa_required === true, policy_version: input.risk_level === undefined ? 1 : 2 };
}
export function requiresQA(task) {
  // Never silently waive QA for historical standard/critical tasks.
  return task.policy_version === 2 ? task.qa_required === true || ['R3', 'R4'].includes(task.risk_level) : task.profile !== 'simples';
}
