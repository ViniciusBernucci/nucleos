import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Secret } from "@nucleos/config";
import { Pool } from "pg";
import { AppModule } from "../app.module.js";
import { MotorFuncionarios } from "../funcionarios/motor.js";
import { RegistroHandlers } from "../funcionarios/handlers.js";
import { lerMigracoes, migrar } from "../migrar.js";
import { MarketingModule } from "./marketing.module.js";
import { RepositorioMarketingPg } from "./repositorio-pg.js";

const adminUrl = process.env["TEST_DATABASE_URL"];
describe(
  "Meta Ads PostgreSQL + HTTP",
  { skip: adminUrl === undefined ? "requer PG local temporario" : false },
  () => {
    let admin: Pool, pool: Pool, app: INestApplication;
    const recursos: { admin?: Pool; pool?: Pool; app?: INestApplication; bancoCriado?: boolean } =
      {};
    const nome = `nucleos_teste_meta_${randomBytes(4).toString("hex")}`;
    const agora = () => new Date("2026-11-02T12:00:00Z");
    let gasto = "19.99",
      moeda = "BRL",
      status = 200;
    const pedidos: string[] = [];
    const requisitar: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      pedidos.push(url.pathname);
      if (status !== 200) return new Response("sentinela-meta", { status });
      return new Response(
        JSON.stringify({
          data: url.pathname.endsWith("campaigns")
            ? [{ id: "321", name: "Campanha teste", status: "PAUSED", objective: "OUTCOME_SALES" }]
            : [
                {
                  campaign_id: "321",
                  campaign_name: "Campanha teste",
                  date_start: "2026-11-01",
                  date_stop: "2026-11-01",
                  account_currency: moeda,
                  spend: gasto,
                  impressions: "50",
                  clicks: "4",
                },
              ],
        }),
      );
    };
    const config = { meta: { token: new Secret("sentinela-meta"), contaId: "123" } };
    let motor: MotorFuncionarios;
    async function subir(credencial: boolean, key: Secret | null = new Secret("chave-local")) {
      // Leases usam o relogio real do PostgreSQL; a janela Meta tem seu proprio relogio.
      motor = new MotorFuncionarios(pool, new RegistroHandlers());
      app = await NestFactory.create(
        AppModule.comModulos([
          MarketingModule.registrar({
            config: credencial ? config : { meta: undefined },
            motor,
            apiKey: key ?? undefined,
            requisitar,
            agora,
          }),
        ]),
        { logger: false },
      );
      recursos.app = app;
      await app.listen(0, "127.0.0.1");
    }
    before(async () => {
      const url = new URL(adminUrl as string);
      assert.equal(url.hostname, "127.0.0.1");
      assert.equal(url.port, "15432");
      assert.equal(url.pathname, "/postgres");
      admin = new Pool({ connectionString: url.toString(), max: 1 });
      recursos.admin = admin;
      await admin.query(`CREATE DATABASE ${nome}`);
      recursos.bancoCriado = true;
      url.pathname = `/${nome}`;
      pool = new Pool({ connectionString: url.toString(), max: 5 });
      pool.on("error", () => undefined); // DROP FORCE pode notificar uma conexao ociosa em fechamento.
      recursos.pool = pool;
      await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
      assert.deepEqual(
        await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url))),
        [],
      );
    });
    after(async () => {
      // Uma falha em migrations/listen pode ocorrer antes de app existir. Mesmo se
      // close/end falhar, os recursos seguintes ainda precisam ser encerrados.
      try {
        await recursos.app?.close();
      } finally {
        try {
          await recursos.pool?.end();
        } finally {
          if (recursos.admin !== undefined) {
            try {
              if (recursos.bancoCriado === true)
                await recursos.admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
            } finally {
              await recursos.admin.end();
            }
          }
        }
      }
    });
    test("sem credencial: indisponível, nenhuma execução nem pedido, sem reset de PAUSADO", async () => {
      await subir(false);
      assert.equal(motor.registro.possui("marketing.importar_meta_ads"), false);
      const d = (
        await pool.query(
          "SELECT status_implementacao,descricao FROM funcionarios.definicoes_tarefa WHERE codigo='marketing.importar_meta_ads'",
        )
      ).rows[0] as { status_implementacao: string; descricao: string };
      assert.equal(d.status_implementacao, "INDISPONIVEL");
      assert.match(d.descricao, /META_ADS/);
      const a = (
        await pool.query<{ id: string }>(
          "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
        )
      ).rows[0];
      assert.ok(a);
      await assert.rejects(motor.executarAgora(a.id));
      assert.equal(pedidos.length, 0);
      assert.equal(
        (await pool.query<{ count: string }>("SELECT count(*) FROM funcionarios.execucoes")).rows[0]
          ?.count,
        "0",
      );
      await pool.query(
        "UPDATE funcionarios.funcionarios SET status='PAUSADO' WHERE slug='gestor-trafego'",
      );
      await app.close();
      await subir(true);
      assert.equal(
        (
          await pool.query<{ status: string }>(
            "SELECT status FROM funcionarios.funcionarios WHERE slug='gestor-trafego'",
          )
        ).rows[0]?.status,
        "PAUSADO",
      );
      assert.equal(
        (
          await pool.query<{ cron: string }>(
            "SELECT cron FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
          )
        ).rows[0]?.cron,
        "0 */6 * * *",
      );
      assert.equal(
        (
          await pool.query<{ status_implementacao: string }>(
            "SELECT status_implementacao FROM funcionarios.definicoes_tarefa WHERE codigo='marketing.aplicar_otimizacao'",
          )
        ).rows[0]?.status_implementacao,
        "INDISPONIVEL",
      );
      assert.equal(
        (
          await pool.query<{ count: string }>(
            "SELECT count(*) FROM funcionarios.atribuicoes a JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id WHERE f.slug='gestor-trafego'",
          )
        ).rows[0]?.count,
        "1",
      );
    });
    test("handler atualiza campanha+dia idempotente; falhas não deixam persistência parcial", async () => {
      const handler = motor.registro.obter("marketing.importar_meta_ads");
      const ctx = {
        execucaoId: "1",
        chaveIdempotencia: "meta-teste",
        tentativa: 1,
        config: {},
        signal: new AbortController().signal,
        verificarLease: async () => true,
      };
      assert.equal(handler.validarConfig({ token: "injetado" }), false);
      await handler.executar(ctx);
      gasto = "20.01";
      await handler.executar(ctx);
      const repo = new RepositorioMarketingPg(pool);
      assert.equal((await repo.campanhas()).length, 1);
      const gastos = await repo.gastos("2026-10-27", "2026-11-02");
      assert.equal(gastos.length, 1);
      assert.equal(gastos[0]?.gasto_centavos, "2001");
      assert.equal(gastos[0].moeda, "BRL");
      for (const code of [429, 401]) {
        status = code;
        await assert.rejects(handler.executar(ctx));
      }
      status = 200;
      moeda = "USD";
      await assert.rejects(handler.executar(ctx), /moeda/);
      moeda = "BRL";
      let checks = 0;
      await assert.rejects(
        repo.salvar(
          "123",
          [{ id: "321", nome: "Rollback", status: "ACTIVE", objetivo: "OUTCOME_SALES" }],
          [],
          async () => ++checks === 1,
        ),
      );
      assert.equal((await repo.campanhas())[0]?.nome, "Campanha teste");
      assert.equal((await repo.gastos("2026-10-27", "2026-11-02"))[0]?.gasto_centavos, "2001");
    });
    test("motor executa a tarefa real e registra resumo sem credencial", async () => {
      await pool.query(
        "UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='gestor-trafego'",
      );
      const atribuicao = (
        await pool.query<{ id: string }>(
          "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='marketing.importar_meta_ads'",
        )
      ).rows[0];
      assert.ok(atribuicao);
      const id = await motor.executarAgora(atribuicao.id);
      assert.equal(await motor.consumirUma(), true);
      const execucao = await motor.aguardar(id, 5000);
      assert.equal(execucao.status, "SUCESSO");
      assert.doesNotMatch(JSON.stringify(execucao), /sentinela-meta/);
      assert.equal(
        (await new RepositorioMarketingPg(pool).gastos("2026-10-27", "2026-11-02")).length,
        1,
      );
    });
    test("HTTP somente leitura autenticada, valida período e responde strings precisas", async () => {
      const base = await app.getUrl();
      const headers = { authorization: "Bearer chave-local" };
      assert.equal((await fetch(`${base}/v1/marketing/campanhas`)).status, 401);
      assert.equal((await fetch(`${base}/v1/marketing/campanhas`, { headers })).status, 200);
      const r = await fetch(`${base}/v1/marketing/gastos?de=2026-10-27&ate=2026-11-02`, {
        headers,
      });
      assert.equal(r.status, 200);
      const body = await r.text();
      assert.match(body, /2001/);
      assert.doesNotMatch(body, /sentinela-meta/);
      for (const query of ["", "?de=2026-11-31&ate=2026-12-01", "?de=2026-11-02&ate=2026-10-01"])
        assert.equal((await fetch(`${base}/v1/marketing/gastos${query}`, { headers })).status, 400);
      assert.equal(
        (await fetch(`${base}/v1/marketing/campanhas`, { method: "POST", headers })).status,
        404,
      );
      await app.close();
      await subir(false, null);
      assert.equal(
        (await fetch(`${await app.getUrl()}/v1/marketing/campanhas`, { headers })).status,
        503,
      );
    });
  },
);
