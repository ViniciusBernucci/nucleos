import assert from "node:assert/strict";
import { test } from "node:test";
import { dadosSeguros, proximaOcorrencia, proximasOcorrencias, validarAgenda } from "./agenda.js";
import { RegistroHandlers, validarConfiguracao } from "./handlers.js";
const agora = new Date("2026-11-02T12:00:00Z");
test("intervalo 30 minutos, alteração para 60 e reinício preservam a âncora", () => {
  const a = validarAgenda({ gatilho: "INTERVALO", intervalo_min: 30 }, agora);
  assert.equal(proximaOcorrencia(a, agora)?.toISOString(), "2026-11-02T12:30:00.000Z");
  assert.equal(
    proximaOcorrencia({ ...a, intervalo_min: 60 }, agora)?.toISOString(),
    "2026-11-02T13:00:00.000Z",
  );
  assert.equal(
    proximaOcorrencia(a, new Date("2026-11-02T12:42:00Z"))?.toISOString(),
    "2026-11-02T13:00:00.000Z",
  );
});
test("cron usa o fuso e gera 5 próximas; limite final e execução única", () => {
  const a = validarAgenda({ gatilho: "CRON", cron: "0 3 * * *", fuso: "America/Sao_Paulo" }, agora);
  assert.equal(proximasOcorrencias(a, agora).length, 5);
  assert.equal(proximasOcorrencias(a, agora)[0], "2026-11-03T06:00:00.000Z");
  assert.equal(proximaOcorrencia({ ...a, fim_em: "2026-11-02T23:59:00Z" }, agora), null);
  const unica = validarAgenda({ gatilho: "UNICO", inicio_em: "2026-11-02T13:00:00Z" }, agora);
  assert.equal(proximasOcorrencias(unica, agora).length, 1);
  assert.equal(proximaOcorrencia(unica, new Date(unica.inicio_em)), null);
});
test("agenda recusa cron inválido, campos extras, evento desconhecido, intervalo e retentativa inválidos", () => {
  for (const x of [
    { gatilho: "CRON", cron: "* * * * * *" },
    { gatilho: "CRON", cron: "65 0 * * *" },
    { gatilho: "INTERVALO", intervalo_min: 0 },
    { gatilho: "INTERVALO", intervalo_min: 30, script: "exec" },
    { gatilho: "EVENTO", tipo_evento: "externo.livre" },
    { gatilho: "MANUAL", fuso: "Lua" },
    { gatilho: "MANUAL", politica_retentativa: { maxTentativas: 0, backoffSegundos: 3 } },
    { gatilho: "MANUAL", fim_em: "2026-01-01T00:00:00Z" },
  ])
    assert.throws(() => validarAgenda(x, agora));
});
test("configuração recusa segredos aninhados/arrays e valida JSON Schema sem coerção", () => {
  assert.equal(dadosSeguros({ opcoes: [{ senha: "sentinela" }] }), false);
  assert.equal(dadosSeguros({ opcoes: { apiKey: "sentinela" } }), false);
  assert.equal(dadosSeguros({ credencialRef: "cofre/financeiro" }), true);
  const schema = {
    type: "object",
    properties: { limite: { type: "integer", minimum: 1 } },
    required: ["limite"],
    additionalProperties: false,
  };
  const h = { chave: "teste", validarConfig: () => true, executar: async () => ({ ok: true }) };
  assert.doesNotThrow(() => {
    validarConfiguracao(schema, { limite: 3 }, h);
  });
  assert.throws(() => {
    validarConfiguracao(schema, { limite: "3" }, h);
  });
  assert.throws(() => {
    validarConfiguracao(schema, { limite: 3, extra: 1 }, h);
  });
  const registro = new RegistroHandlers();
  registro.registrar(h);
  assert.throws(() => {
    registro.registrar(h);
  });
  assert.throws(() => registro.obter("planejada"));
});
