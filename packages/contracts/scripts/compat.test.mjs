import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { incompatibilidades, verificarDiretorios, verificarPar } from "./compat.mjs";

const base = () => ({
  "x-schema-version": "1.0",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "a"],
  properties: {
    schema_version: { const: "1.0" },
    a: { type: "string", maxLength: 10, pattern: "^[a-z]+$" },
    modo: { enum: ["x", "y"] },
    n: { type: "integer", minimum: 0, maximum: 5 },
    lista: { type: "array", items: { type: "string" } },
    obj: { type: "object" },
  },
});
const mudar = (f, versao) => {
  const s = base();
  f(s);
  if (versao !== undefined) s["x-schema-version"] = versao;
  return s;
};

test("identico e compativel", () => {
  assert.deepEqual(verificarPar("c", base(), base()), []);
});

test("campo opcional novo: compativel, mas exige minor", () => {
  const novo = mudar((s) => (s.properties.b = { type: "string" }));
  assert.deepEqual(incompatibilidades(base(), novo), []);
  assert.match(verificarPar("c", base(), novo)[0], /sem subir x-schema-version/);
  const comMinor = mudar((s) => (s.properties.b = { type: "string" }), "1.1");
  assert.deepEqual(verificarPar("c", base(), comMinor), []);
});

test("relaxar restricao e compativel", () => {
  const novo = mudar((s) => {
    s.properties.a.maxLength = 20;
    s.properties.modo.enum.push("z");
    s.properties.n.maximum = 9;
  }, "1.1");
  assert.deepEqual(incompatibilidades(base(), novo), []);
  assert.deepEqual(verificarPar("c", base(), novo), []);
});

const incompativeis = {
  "campo obrigatorio novo": (s) => {
    s.properties.b = { type: "string" };
    s.required.push("b");
  },
  "campo removido": (s) => delete s.properties.lista,
  "tipo alterado": (s) => (s.properties.a.type = "integer"),
  "valor de enum removido": (s) => (s.properties.modo.enum = ["x"]),
  "maxLength reduzido": (s) => (s.properties.a.maxLength = 5),
  "minimum elevado": (s) => (s.properties.n.minimum = 1),
  "pattern alterado": (s) => (s.properties.a.pattern = "^[a-z0-9]+$"),
  "additionalProperties true -> false": (s) => (s.properties.obj.additionalProperties = false),
  "const alterado": (s) => (s.properties.schema_version.const = "2.0"),
  "condicional novo": (s) => (s.allOf = [{ if: { required: ["a"] }, then: { required: ["n"] } }]),
  "items alterado": (s) => (s.properties.lista.items = { type: "integer" }),
};
for (const [nome, f] of Object.entries(incompativeis)) {
  test(`incompativel detectado: ${nome}`, () => {
    const novo = mudar(f);
    assert.ok(incompatibilidades(base(), novo).length > 0, nome);
    // sem major: falha; com minor apenas: falha; com major: passa
    assert.match(verificarPar("c", base(), novo).join("\n"), /INCOMPATIVEL/);
    assert.match(verificarPar("c", base(), mudar(f, "1.1")).join("\n"), /INCOMPATIVEL/);
    assert.deepEqual(verificarPar("c", base(), mudar(f, "2.0")), []);
  });
}

test("versao nao pode regredir", () => {
  assert.match(
    verificarPar(
      "c",
      mudar(() => {}, "1.2"),
      mudar((s) => (s.properties.b = { type: "string" }), "1.1"),
    )[0],
    /regrediu/,
  );
});

test("verificarDiretorios: contrato removido e mudanca incompativel falham; ok passa", () => {
  const raiz = mkdtempSync(join(tmpdir(), "nucleos-compat-"));
  try {
    const grava = (dir, nome, obj) => {
      mkdirSync(join(raiz, dir), { recursive: true });
      writeFileSync(join(raiz, dir, `${nome}.schema.json`), JSON.stringify(obj));
    };
    grava("b", "um", base());
    grava("b", "dois", base());
    grava("a", "um", base());
    assert.match(
      verificarDiretorios(join(raiz, "b"), join(raiz, "a")).join("\n"),
      /dois: contrato removido/,
    );
    grava(
      "a",
      "dois",
      mudar((s) => delete s.properties.a),
    );
    assert.match(
      verificarDiretorios(join(raiz, "b"), join(raiz, "a")).join("\n"),
      /dois: mudanca INCOMPATIVEL/,
    );
    grava("a", "dois", base());
    assert.deepEqual(verificarDiretorios(join(raiz, "b"), join(raiz, "a")), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("schemas reais estao compativeis com o baseline", () => {
  const pacote = join(import.meta.dirname, "..");
  assert.deepEqual(verificarDiretorios(join(pacote, "baseline"), join(pacote, "schemas")), []);
});
