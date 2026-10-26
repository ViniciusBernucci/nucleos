import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { isRfc3339DateTime } from "./datetime.js";
import { SCHEMA_NAMES, schemas, type SchemaName } from "./generated/index.js";

export interface ValidationIssue {
  /** JSON Pointer da instancia (vazio = raiz). */
  path: string;
  keyword: string;
  message: string;
}

export type ValidationResult = { valid: true } | { valid: false; issues: ValidationIssue[] };

// strictRequired desligado: `then: {required: [...]}` em allOf/if referencia propriedades do objeto pai,
// padrao legitimo dos contratos condicionais. Todo o restante do modo estrito do ajv fica ligado.
function criarAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  ajv.addKeyword({ keyword: "x-schema-version", schemaType: "string" });
  ajv.addFormat("date-time", { type: "string", validate: isRfc3339DateTime });
  for (const nome of SCHEMA_NAMES) ajv.addSchema(schemas[nome], nome);
  return ajv;
}

const ajv = criarAjv();
const cache = new Map<string, ValidateFunction>();

function validador(nome: SchemaName, def?: string): ValidateFunction {
  const chave = def === undefined ? nome : `${nome}#${def}`;
  let v = cache.get(chave);
  if (v === undefined) {
    const ref = def === undefined ? nome : `${nome}#/$defs/${def}`;
    const encontrado = ajv.getSchema(ref);
    if (encontrado === undefined) throw new Error(`schema ou definicao inexistente: ${ref}`);
    v = encontrado;
    cache.set(chave, v);
  }
  return v;
}

/**
 * Valida `dado` contra o schema `nome` (ou contra `$defs/<def>` dele). Rejeita campos extras,
 * tipos errados e formatos invalidos conforme o JSON Schema 2020-12 do pacote.
 */
export function validate(nome: SchemaName, dado: unknown, def?: string): ValidationResult {
  const v = validador(nome, def);
  if (v(dado)) return { valid: true };
  return {
    valid: false,
    issues: (v.errors ?? []).map((e) => ({
      path: e.instancePath,
      keyword: e.keyword,
      message: e.message ?? "",
    })),
  };
}

export class ContractViolationError extends Error {
  constructor(
    readonly schema: SchemaName,
    readonly issues: ValidationIssue[],
  ) {
    super(
      `violacao do contrato ${schema}: ${issues.map((i) => `${i.path || "/"} ${i.message}`).join("; ")}`,
    );
    this.name = "ContractViolationError";
  }
}

/** Valida e lanca ContractViolationError se invalido; o chamador tipa o dado com os tipos gerados. */
export function assertValid(nome: SchemaName, dado: unknown, def?: string): void {
  const r = validate(nome, dado, def);
  if (!r.valid) throw new ContractViolationError(nome, r.issues);
}
