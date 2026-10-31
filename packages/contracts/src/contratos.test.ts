import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { isRfc3339DateTime } from "./datetime.js";
import { carregarExemplos } from "./exemplos.js";
import {
  SCHEMA_NAMES,
  assertValid,
  ContractViolationError,
  runtimeTokenSemanticErrors,
  schemas,
  validate,
  type RuntimeTokenClaims,
  type SchemaName,
} from "./index.js";

const raizPacote = join(import.meta.dirname, "..");
const exemplos = carregarExemplos(join(raizPacote, "exemplos"));

test("todo schema tem exemplos validos e ao menos 3 invalidos", () => {
  for (const nome of SCHEMA_NAMES) {
    const doSchema = exemplos.filter((e) => e.schema === nome);
    assert.ok(
      doSchema.some((e) => e.valido),
      `${nome}: sem exemplo valido`,
    );
    assert.ok(doSchema.filter((e) => !e.valido).length >= 3, `${nome}: poucos invalidos`);
  }
  for (const e of exemplos) assert.ok(SCHEMA_NAMES.includes(e.schema as SchemaName), e.schema);
});

for (const e of exemplos) {
  const rotulo = `${e.schema}${e.def === undefined ? "" : `#${e.def}`} ${e.valido ? "aceita" : "rejeita"} ${e.nome}`;
  test(rotulo, () => {
    const r = validate(e.schema as SchemaName, e.dado, e.def);
    assert.equal(r.valid, e.valido, JSON.stringify(r));
    if (e.valido) {
      // round-trip: serializar e reler nao altera a validade nem o conteudo
      const volta = JSON.parse(JSON.stringify(e.dado)) as unknown;
      assert.deepEqual(volta, e.dado);
      assert.equal(validate(e.schema as SchemaName, volta, e.def).valid, true);
    }
  });
}

test("x-schema-version existe em todo schema e coincide com schema_version quando ha", () => {
  for (const nome of SCHEMA_NAMES) {
    const s = schemas[nome] as {
      "x-schema-version"?: string;
      properties?: { schema_version?: { const?: string } };
    };
    assert.match(s["x-schema-version"] ?? "", /^[0-9]+\.[0-9]+$/, nome);
    const c = s.properties?.schema_version?.const;
    if (c !== undefined) assert.equal(c, s["x-schema-version"], nome);
  }
});

test("assertValid lanca ContractViolationError com os problemas", () => {
  assert.throws(
    () => {
      assertValid("problem-details", { type: "about:blank", title: "x", status: 200 });
    },
    (err: unknown) =>
      err instanceof ContractViolationError &&
      err.issues.some((i) => i.path === "/status" && i.keyword === "minimum"),
  );
  assert.doesNotThrow(() => {
    assertValid("problem-details", { type: "about:blank", title: "x", status: 404 });
  });
  assert.throws(() => validate("problem-details", {}, "nao-existe"), /inexistente/);
});

interface CasoSemantico {
  nome: string;
  claims: RuntimeTokenClaims;
  erros: string[];
}
const semanticos = JSON.parse(
  readFileSync(join(raizPacote, "exemplos", "runtime-token", "semantica.json"), "utf8"),
) as CasoSemantico[];
for (const c of semanticos) {
  test(`runtime-token semantica: ${c.nome}`, () => {
    assert.equal(
      validate("runtime-token", {
        header: { alg: "EdDSA", typ: "nucleos-runtime+jwt", kid: "k" },
        claims: c.claims,
      }).valid,
      true,
    );
    assert.deepEqual(runtimeTokenSemanticErrors(c.claims), c.erros);
  });
}

test("date-time estrito (mesma tabela do teste Python)", () => {
  const tabela = JSON.parse(
    readFileSync(join(raizPacote, "exemplos", "date-time.json"), "utf8"),
  ) as { valor: string; valido: boolean }[];
  for (const { valor, valido } of tabela) assert.equal(isRfc3339DateTime(valor), valido, valor);
});
