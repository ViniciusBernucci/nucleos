/**
 * Formato `date-time` dos contratos: RFC 3339 estrito, identico em TypeScript e Python
 * (packages/contracts-py/src/nucleos_contracts/validation.py). Exige `T` maiusculo, fuso `Z` ou `+hh:mm`,
 * calendario valido e sem segundo bissexto (`:60`). Definido aqui, e nao via ajv-formats, para que os dois
 * motores aceitem e rejeitem exatamente as mesmas entradas.
 */
const RFC3339 =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?(?:Z|[+-]([0-9]{2}):([0-9]{2}))$/;

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

export function isRfc3339DateTime(valor: string): boolean {
  const m = RFC3339.exec(valor);
  if (m === null) return false;
  const [ano, mes, dia, hora, min, seg] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return false;
  if (hora > 23 || min > 59 || seg > 59) return false;
  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false;
  return true;
}
