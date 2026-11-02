import { Ajv2020 } from "ajv/dist/2020.js";
/** Schemas são registros do backend, não código fornecido pelo painel. Sem coerção ou defaults ocultos. */
export function validarConfigTarefa(schema: Record<string, unknown>, valor: unknown): boolean {
  try {
    return new Ajv2020({ strict: true, allErrors: false }).compile(schema)(valor);
  } catch {
    return false;
  }
}
