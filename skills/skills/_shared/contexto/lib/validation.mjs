export function validateChecks(checks) {
  if (!Array.isArray(checks) || !checks.length || checks.length > 100) throw Error('Testes determinísticos aplicáveis obrigatórios em checks');
  for (const check of checks) {
    if (!check || typeof check.name !== 'string' || !check.name.trim() || !['PASS', 'NA'].includes(check.status)) throw Error('Check exige name e status PASS/NA; falha ou não executado bloqueia');
    if (typeof check.detail !== 'string' || check.detail.trim().length < 10) throw Error('Check exige evidência de execução ou justificativa NA concreta em detail');
  }
}
export function validateFindings(input) {
  if (input.finding_details === undefined) return; // Compatible with historical ID-only reports.
  const entries = input.finding_details;
  if (!Array.isArray(entries) || entries.length !== input.findings || new Set(entries.map(f => f.id)).size !== entries.length) throw Error('finding_details exige exatamente um objeto por achado');
  for (const f of entries) {
    if (!input.finding_ids?.includes(f.id) || !['P0', 'P1', 'P2', 'P3'].includes(f.severity) || typeof f.file !== 'string' || !f.file.trim() || !Number.isSafeInteger(f.line) || f.line < 1 || ['evidence', 'impact', 'expected_test'].some(k => typeof f[k] !== 'string' || !f[k].trim())) throw Error('Achado estruturado exige id, severity, file, line, evidence, impact e expected_test');
  }
}
