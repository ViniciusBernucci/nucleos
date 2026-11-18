import assert from "node:assert/strict";
import type { ExecutionContext } from "@nestjs/common";
import { test } from "node:test";
import { Secret } from "@nucleos/config";
import { Agendador } from "./agendador.js";
import { ChaveServicoGuard } from "./chave-servico.guard.js";
import { grupoDoStatus, paraCentavos } from "./dominio.js";
import {
  hojeNoFuso,
  lerDia,
  periodoAnterior,
  preencherSerie,
  resolverPeriodo,
  somarDias,
} from "./periodo.js";

test("grupos de status: desconhecido nunca vira receita", () => {
  assert.equal(grupoDoStatus("approved"), "receita");
  assert.equal(grupoDoStatus("COMPLETE"), "receita");
  assert.equal(grupoDoStatus("PARTIALLY_REFUNDED"), "receita");
  assert.equal(grupoDoStatus("REFUNDED"), "reembolso");
  assert.equal(grupoDoStatus("CHARGEBACK"), "contestada");
  assert.equal(grupoDoStatus("DISPUTE"), "contestada");
  assert.equal(grupoDoStatus("CANCELLED"), "cancelada");
  assert.equal(grupoDoStatus("WAITING_PAYMENT"), "pendente");
  assert.equal(grupoDoStatus("NOVO_STATUS_DA_HOTMART"), "pendente");
});

test("centavos: arredonda float e ignora valor invalido", () => {
  assert.equal(paraCentavos(197.9), 19790);
  assert.equal(paraCentavos(0.1 + 0.2), 30);
  assert.equal(paraCentavos("12.34"), 1234);
  assert.equal(paraCentavos(undefined), 0);
  assert.equal(paraCentavos(Number.NaN), 0);
});

test("periodo: valida dias reais, ordem e tamanho maximo", () => {
  assert.equal(lerDia("2026-02-30"), null);
  assert.equal(lerDia("2026-2-3"), null);
  const agora = new Date("2026-11-01T02:00:00Z"); // 31/10 23:00 em Sao Paulo
  assert.equal(hojeNoFuso(agora), "2026-10-31");
  assert.deepEqual(resolverPeriodo(undefined, undefined, agora), {
    ok: true,
    periodo: { de: "2026-10-02", ate: "2026-10-31" },
  });
  assert.deepEqual(resolverPeriodo("2026-11-02", "2026-11-01", agora), {
    ok: false,
    erro: "ordem",
  });
  assert.deepEqual(resolverPeriodo("2024-01-01", "2026-01-01", agora), {
    ok: false,
    erro: "tamanho",
  });
  assert.deepEqual(resolverPeriodo("lixo", "2026-01-01", agora), { ok: false, erro: "de" });
});

test("periodo anterior tem a mesma duracao e a serie completa os dias sem venda", () => {
  assert.deepEqual(periodoAnterior({ de: "2026-10-01", ate: "2026-10-10" }), {
    de: "2026-09-21",
    ate: "2026-09-30",
  });
  assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
  const serie = preencherSerie({ de: "2026-10-01", ate: "2026-10-03" }, [
    { dia: "2026-10-02", receitaCentavos: 500, vendas: 2 },
  ]);
  assert.deepEqual(
    serie.map((p) => [p.dia, p.receitaCentavos]),
    [
      ["2026-10-01", 0],
      ["2026-10-02", 500],
      ["2026-10-03", 0],
    ],
  );
});

function contexto(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

test("guard: sem chave configurada responde 503 (fecha), com chave exige bearer exato", () => {
  assert.throws(() => new ChaveServicoGuard(undefined).canActivate(contexto("Bearer x")), {
    name: "ServiceUnavailableException",
  });
  const guard = new ChaveServicoGuard(new Secret("chave-correta"));
  assert.equal(guard.canActivate(contexto("Bearer chave-correta")), true);
  for (const ruim of [
    undefined,
    "",
    "Bearer ",
    "Bearer errada",
    "chave-correta",
    "Basic chave-correta",
  ]) {
    assert.throws(
      () => guard.canActivate(contexto(ruim)),
      { name: "UnauthorizedException" },
      String(ruim),
    );
  }
});

test("agendador: nao sobrepoe execucoes, sobrevive a erro e para", async () => {
  let ativas = 0;
  let maxAtivas = 0;
  let chamadas = 0;
  let liberar: () => void = () => undefined;
  const travada = new Promise<void>((r) => {
    liberar = r;
  });
  const logs: string[] = [];
  const ag = new Agendador(
    async () => {
      chamadas += 1;
      ativas += 1;
      maxAtivas = Math.max(maxAtivas, ativas);
      await travada;
      ativas -= 1;
      throw new Error("detalhe-interno");
    },
    60_000,
    (m) => logs.push(m),
  );

  const primeira = ag.rodar();
  assert.equal(await ag.rodar(), false); // segunda chamada enquanto a primeira roda
  liberar();
  assert.equal(await primeira, true);
  assert.equal(maxAtivas, 1);
  assert.equal(chamadas, 1);
  assert.deepEqual(logs, ["vendas: a rodada agendada falhou"]);
  assert.equal(await ag.rodar(), true); // volta a rodar depois do erro
  ag.iniciar();
  ag.parar();
});
