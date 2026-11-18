import assert from "node:assert/strict";
import { describe, test } from "node:test";
import vm from "node:vm";
import {
  buildThemeInitScript,
  parseStoredTheme,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
} from "../lib/theme.ts";

describe("Tema claro/escuro da interface web", () => {
  test("THEME-01: aceita somente 'light' e 'dark' como preferencia salva", () => {
    assert.equal(parseStoredTheme("light"), "light");
    assert.equal(parseStoredTheme("dark"), "dark");
    assert.equal(parseStoredTheme("system"), null);
    assert.equal(parseStoredTheme("<script>"), null);
    assert.equal(parseStoredTheme(""), null);
    assert.equal(parseStoredTheme(null), null);
    assert.equal(parseStoredTheme(undefined), null);
  });

  test("THEME-02: preferencia salva vence o sistema; sem ela, segue o sistema", () => {
    assert.equal(resolveEffectiveTheme("light", true), "light");
    assert.equal(resolveEffectiveTheme("dark", false), "dark");
    assert.equal(resolveEffectiveTheme(null, true), "dark");
    assert.equal(resolveEffectiveTheme(null, false), "light");
  });

  test("THEME-03: script de inicializacao usa a chave de armazenamento e tolera falhas", () => {
    const script = buildThemeInitScript();
    assert.ok(script.includes(JSON.stringify(THEME_STORAGE_KEY)));
    assert.ok(script.startsWith("try{"));
    assert.ok(script.endsWith("catch(e){}"));
    // Compila sem executar: garante que o script inline e JavaScript valido.
    assert.doesNotThrow(() => new vm.Script(script));
  });
});
