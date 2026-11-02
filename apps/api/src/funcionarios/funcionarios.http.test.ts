import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, describe, test, mock } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Secret } from "@nucleos/config";
import type {
  Agendamento,
  DetalheFuncionario,
  EstadoFuncionarios,
  ListaExecucoes,
} from "@nucleos/contracts";
import { Pool } from "pg";
import { AppModule } from "../app.module.js";
import { lerMigracoes, migrar } from "../migrar.js";
import { FuncionariosModule } from "./funcionarios.module.js";
import { RegistroHandlers, type ContextoHandler } from "./handlers.js";
import { MotorFuncionarios } from "./motor.js";
import { objetos } from "./repositorio.js";
import { ServicoFuncionarios } from "./servico.js";
import { VendasModule } from "../vendas/vendas.module.js";
import { SINCRONIZACAO_VENDAS, type SincronizacaoVendas } from "../vendas/sincronizacao.js";

const urlAdmin = process.env["TEST_DATABASE_URL"];
const CHAVE = "chave-sentinela-de-teste";
describe(
  "Funcionários: PostgreSQL isolado, motor e API HTTP",
  { skip: urlAdmin === undefined ? "requer TEST_DATABASE_URL local (banco temporário)" : false },
  () => {
    const banco = `nucleos_teste_fun_${randomUUID().replaceAll("-", "")}`;
    let admin: Pool;
    let pool: Pool;
    let app: INestApplication;
    let base: string;
    let registro: RegistroHandlers;
    let motor: MotorFuncionarios;
    let servico: ServicoFuncionarios;
    const recursos: {
      motor?: MotorFuncionarios;
      app?: INestApplication;
      pool?: Pool;
      admin?: Pool;
    } = {};
    before(async () => {
      const url = new URL(urlAdmin as string);
      assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname));
      admin = new Pool({ connectionString: url.toString(), max: 1 });
      recursos.admin = admin;
      await admin.query(`CREATE DATABASE ${banco}`);
      url.pathname = `/${banco}`;
      pool = new Pool({ connectionString: url.toString(), max: 12 });
      recursos.pool = pool;
      pool.on("error", () => undefined);
      await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
      registro = new RegistroHandlers();
      registro.registrar({
        chave: "financeiro.atualizar_dados",
        validarConfig: (c) => Object.keys(c).length === 0,
        executar: async () => ({ resultado: "sucesso", processadas: 0, mensagem: null }),
      });
      motor = new MotorFuncionarios(pool, registro);
      recursos.motor = motor;
      servico = new ServicoFuncionarios(pool, motor);
      app = await NestFactory.create(
        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), false)]),
        { logger: false },
      );
      recursos.app = app;
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
    });
    after(async () => {
      recursos.motor?.parar();
      await recursos.app?.close();
      await recursos.pool?.end();
      if (recursos.admin !== undefined) {
        await recursos.admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
        await recursos.admin.end();
      }
    });
    async function chamar(caminho: string, method = "GET", body?: unknown, autenticado = true) {
      return fetch(`${base}/v1/funcionarios${caminho}`, {
        method,
        headers: {
          ...(autenticado ? { authorization: `Bearer ${CHAVE}` } : {}),
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    async function fixture(
      executar: (c: ContextoHandler) => Promise<unknown> = async () => ({ ok: true }),
      politica = "ENFILEIRAR",
    ) {
      const codigo = `teste.${randomUUID().replaceAll("-", "")}`;
      registro.registrar({ chave: codigo, validarConfig: () => true, executar });
      const setor = (await servico.setores()).find((s) => s.codigo === "financeiro");
      assert.ok(setor);
      const d = (
        await pool.query<{ id: string }>(
          `INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,handler_key,status_implementacao) VALUES($1,$2,$2,$2,'DISPONIVEL') RETURNING id`,
          [setor.id, codigo],
        )
      ).rows[0];
      assert.ok(d);
      const f = await servico.salvarFuncionario({
        setor_id: setor.id,
        nome: codigo,
        descricao: "Funcionário de teste",
        tipo: "DETERMINISTICO",
      });
      const a = await servico.atribuir(f, { definicao_id: d.id, config: {} });
      await servico.statusFuncionario(f, "ATIVO");
      const s = await servico.salvarAgenda(a, {
        gatilho: "INTERVALO",
        intervalo_min: 30,
        politica_sobreposicao: politica,
      });
      return { f, a, s, d: d.id };
    }
    async function agendarAgora(s: string, atraso = 1000) {
      await pool.query(
        "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp()-($2::integer*interval '1 millisecond') WHERE id=$1",
        [s, atraso],
      );
      await motor.planejar();
    }
    test("migrations e seeds idempotentes: 6 setores, 50 tarefas; integridade de cron/intervalo/setor", async () => {
      const contagem = async () =>
        (await pool.query<{ n: string }>("SELECT count(*) n FROM funcionarios.definicoes_tarefa"))
          .rows[0]?.n;
      assert.equal(await contagem(), "50");
      assert.equal((await servico.setores()).length, 6);
      for (const nome of ["0005_funcionarios_catalogo.up.sql", "0006_funcionarios_hotmart.up.sql"])
        await pool.query(
          await readFile(new URL(`../../migrations/${nome}`, import.meta.url), "utf8"),
        );
      assert.equal(await contagem(), "50");
      const analista = (await servico.funcionarios()).find(
        (f) => f.slug === "analista-atualizacoes-financeiras",
      );
      assert.ok(analista);
      assert.equal(typeof analista.id, "string");
      const detalhe = await servico.detalhe(analista.id);
      assert.equal(detalhe.atribuicoes[0]?.agendamentos[0]?.intervalo_min, 30);
      const a = detalhe.atribuicoes[0];
      assert.ok(a);
      assert.equal(typeof a.id, "string");
      await assert.rejects(
        pool.query(
          "INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho) VALUES($1,'CRON')",
          [a.id],
        ),
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,intervalo_min) VALUES($1,'INTERVALO',0)",
          [a.id],
        ),
      );
      await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false");
    });
    test("HTTP chave obrigatória em cada família; setores, catálogo, listagem e detalhe consultáveis", async () => {
      for (const caminho of ["", "/setores", "/catalogo", "/execucoes", "/estado", "/eventos"])
        assert.equal((await chamar(caminho, "GET", undefined, false)).status, 401);
      for (const caminho of ["", "/setores", "/catalogo", "/execucoes", "/estado", "/eventos"])
        assert.equal((await chamar(caminho)).status, 200);
      const { f } = await fixture();
      const r = await chamar(`/${f}`);
      assert.equal(r.status, 200);
      const d = (await r.json()) as DetalheFuncionario;
      assert.equal(d.funcionario.id, f);
    });
    test("HTTP cadastro/edição/status: sem tarefas não ativa; mutações registram auditoria", async () => {
      const setor = (await servico.setores())[0];
      assert.ok(setor);
      const criado = await chamar("", "POST", {
        nome: "Rascunho HTTP",
        setor_id: setor.id,
        tipo: "DETERMINISTICO",
        descricao: "Teste",
      });
      assert.equal(criado.status, 201);
      const { id } = (await criado.json()) as { id: string };
      assert.equal((await chamar(`/${id}/status`, "POST", { status: "ATIVO" })).status, 409);
      assert.equal(
        (
          await chamar(`/${id}`, "PATCH", {
            nome: "Editado HTTP",
            setor_id: setor.id,
            tipo: "HIBRIDO",
            descricao: "Teste editado",
          })
        ).status,
        200,
      );
      assert.equal((await chamar(`/${id}/status`, "POST", { status: "PAUSADO" })).status, 201);
      assert.equal(
        (
          await pool.query<{ n: string }>(
            "SELECT count(*) n FROM funcionarios.auditoria WHERE entidade='funcionario' AND entidade_id=$1",
            [id],
          )
        ).rows[0]?.n,
        "3",
      );
    });
    test("HTTP catálogo personalizado é PLANEJADA sem handler e não pode ser atribuído/agendado; handler imutável", async () => {
      const fx = await fixture();
      const setor = (await servico.detalhe(fx.f)).funcionario.setor_id;
      const r = await chamar("/catalogo", "POST", {
        setor_id: setor,
        codigo: "financeiro.personalizada",
        nome: "Planejada",
        tipo: "DETERMINISTICO",
      });
      assert.equal(r.status, 201);
      const { id } = (await r.json()) as { id: string };
      const tarefa = await servico.tarefa(id);
      assert.equal(tarefa.handler_key, null);
      assert.equal(tarefa.status_implementacao, "PLANEJADA");
      assert.equal(
        (await chamar(`/catalogo/${id}`, "PATCH", { handler_key: "financeiro.atualizar_dados" }))
          .status,
        400,
      );
      assert.equal(
        (await chamar(`/${fx.f}/atribuicoes`, "POST", { definicao_id: id })).status,
        409,
      );
      await pool.query(
        "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='PLANEJADA' WHERE id=$1",
        [fx.d],
      );
      assert.equal(
        (await chamar(`/atribuicoes/${fx.a}/agendamentos`, "POST", { gatilho: "MANUAL" })).status,
        409,
      );
      assert.equal((await chamar(`/atribuicoes/${fx.a}/executar`, "POST")).status, 409);
    });
    test("HTTP atribuição de outro setor e segredo aninhado recusados sem persistir; config inválida recusada", async () => {
      const fx = await fixture();
      const setor = (await servico.setores()).find((s) => s.codigo === "marketing");
      assert.ok(setor);
      const f = await servico.salvarFuncionario({
        setor_id: setor.id,
        nome: "Outro setor",
        tipo: "DETERMINISTICO",
      });
      assert.equal((await chamar(`/${f}/atribuicoes`, "POST", { definicao_id: fx.d })).status, 400);
      assert.equal(
        (
          await chamar(`/atribuicoes/${fx.a}`, "PATCH", {
            config: { interno: [{ token: "SEGREDO_SENTINELA" }] },
          })
        ).status,
        400,
      );
      assert.equal(
        (await chamar(`/atribuicoes/${fx.a}`, "PATCH", { config: { extra: true } })).status,
        400,
      );
      assert.equal(
        JSON.stringify((await servico.detalhe(fx.f)).atribuicoes).includes("SEGREDO_SENTINELA"),
        false,
      );
    });
    test("HTTP agendamento altera 30→60, prevê próximas, suspende e rejeita cron/evento inválidos", async () => {
      const fx = await fixture();
      assert.equal(
        (
          await chamar(`/atribuicoes/${fx.a}/agendamentos/${fx.s}`, "PATCH", {
            gatilho: "INTERVALO",
            intervalo_min: 60,
          })
        ).status,
        200,
      );
      const detalhe = await servico.detalhe(fx.f);
      const agenda = detalhe.atribuicoes[0]?.agendamentos[0];
      assert.ok(agenda);
      assert.equal(agenda.intervalo_min, 60);
      assert.equal(agenda.versao, 2);
      assert.equal((await chamar(`/agendamentos/${fx.s}/proximas?n=5`)).status, 200);
      const previa = await chamar("/cron/previsualizar", "POST", {
        gatilho: "CRON",
        cron: "0 3 * * *",
        fuso: "America/Sao_Paulo",
      });
      assert.equal(previa.status, 201);
      assert.equal(((await previa.json()) as string[]).length, 5);
      assert.equal(
        (await chamar("/cron/previsualizar", "POST", { gatilho: "CRON", cron: "61 * * * *" }))
          .status,
        400,
      );
      assert.equal((await chamar(`/agendamentos/${fx.s}/suspender`, "POST")).status, 201);
      assert.equal((await servico.proximas(fx.s, 5)).length, 0);
    });
    test("duas instâncias do planejador/consumidor não duplicam a mesma ocorrência", async () => {
      let vezes = 0;
      const fx = await fixture(async () => {
        vezes++;
        return { ok: true };
      });
      await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false WHERE id<>$1", [
        fx.s,
      ]);
      await pool.query(
        "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp()-interval '1 second' WHERE id=$1",
        [fx.s],
      );
      const outro = new MotorFuncionarios(pool, registro);
      await Promise.all([motor.planejar(), outro.planejar()]);
      await Promise.all([motor.consumirUma(), outro.consumirUma()]);
      assert.equal(vezes, 1);
      const h = await servico.execucoes({ funcionario: fx.f });
      assert.equal(h.total, 1);
      assert.equal(h.itens[0]?.status, "SUCESSO");
    });
    test("versão antiga e atribuição desabilitada cancelam fila sem matar execução já iniciada", async () => {
      let vezes = 0;
      const fx = await fixture(async () => {
        vezes++;
        return { ok: true };
      });
      await agendarAgora(fx.s);
      await servico.salvarAgenda(fx.a, { gatilho: "INTERVALO", intervalo_min: 60 }, fx.s);
      await motor.consumirUma();
      assert.equal(vezes, 0);
      assert.equal((await servico.execucoes({ funcionario: fx.f })).itens[0]?.status, "CANCELADA");
      const id = await motor.executarAgora(fx.a);
      await servico.configurarAtribuicao(fx.a, { habilitada: false });
      await motor.consumirUma();
      assert.equal((await servico.execucao(id)).status, "CANCELADA");
    });
    test("evento repetido é idempotente; filtro e habilitação são respeitados", async () => {
      const fx = await fixture();
      await servico.salvarAgenda(
        fx.a,
        {
          gatilho: "EVENTO",
          tipo_evento: "financeiro.venda.alterada",
          filtro_evento: { origem: "teste" },
        },
        fx.s,
      );
      const chave = randomUUID();
      assert.equal(
        await motor.publicar("financeiro.venda.alterada", chave, { origem: "teste" }),
        true,
      );
      assert.equal(
        await motor.publicar("financeiro.venda.alterada", chave, { origem: "teste" }),
        false,
      );
      assert.equal((await servico.execucoes({ funcionario: fx.f })).total, 1);
      await motor.consumirUma();
      await motor.publicar("financeiro.venda.alterada", randomUUID(), { origem: "outra" });
      assert.equal((await servico.execucoes({ funcionario: fx.f })).total, 1);
    });
    test("retentativa aplica backoff e nunca grava a mensagem sensível da exceção", async () => {
      let tentativa = 0;
      const fx = await fixture(async () => {
        if (++tentativa === 1) throw new Error("SEGREDO_SENTINELA");
        return { ok: true };
      });
      const id = await motor.executarAgora(fx.a);
      await motor.consumirUma();
      const primeira = await servico.execucao(id);
      assert.equal(primeira.status, "AGUARDANDO");
      assert.equal(primeira.erro_codigo, "HANDLER_FALHOU");
      await pool.query(
        "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE execucao_id=$1",
        [id],
      );
      await motor.consumirUma();
      const fim = await servico.execucao(id);
      assert.equal(fim.status, "SUCESSO");
      assert.equal(fim.tentativa, 2);
      assert.equal(JSON.stringify(fim).includes("SEGREDO_SENTINELA"), false);
    });
    test("lease expirada é recuperada e fencing impede conclusão atrasada do primeiro consumidor", async () => {
      let liberar: () => void = () => undefined;
      let iniciar: () => void = () => undefined;
      let chamadas = 0;
      const iniciou = new Promise<void>((r) => {
        iniciar = r;
      });
      const bloqueio = new Promise<void>((r) => {
        liberar = r;
      });
      const fx = await fixture(async () => {
        if (++chamadas === 1) {
          iniciar();
          await bloqueio;
          return { origem: "antiga" };
        }
        return { origem: "nova" };
      });
      const id = await motor.executarAgora(fx.a);
      const primeira = motor.consumirUma();
      await iniciou;
      await pool.query(
        "UPDATE funcionarios.fila SET lease_ate=clock_timestamp()-interval '1 second' WHERE execucao_id=$1",
        [id],
      );
      const outro = new MotorFuncionarios(pool, registro);
      await outro.consumirUma();
      liberar();
      await primeira;
      const fim = await servico.execucao(id);
      assert.equal(fim.tentativa, 2);
      assert.deepEqual(fim.resumo, { origem: "nova" });
    });
    test("heartbeat renova lease; política PULAR impede sobreposição", async () => {
      let liberar: () => void = () => undefined;
      let iniciar: () => void = () => undefined;
      const iniciou = new Promise<void>((r) => {
        iniciar = r;
      });
      const bloqueio = new Promise<void>((r) => {
        liberar = r;
      });
      const fx = await fixture(async () => {
        iniciar();
        await bloqueio;
        return { ok: true };
      }, "PULAR");
      await agendarAgora(fx.s);
      const worker = new MotorFuncionarios(pool, registro, undefined, {
        leaseSegundos: 3,
        heartbeatMs: 40,
      });
      const primeira = worker.consumirUma();
      await iniciou;
      const antes = (
        await pool.query<{ lease_ate: Date }>(
          "SELECT q.lease_ate FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id WHERE e.atribuicao_id=$1 AND q.estado='EXECUTANDO'",
          [fx.a],
        )
      ).rows[0]?.lease_ate;
      assert.ok(antes);
      await new Promise((r) => setTimeout(r, 120));
      const depois = (
        await pool.query<{ lease_ate: Date }>(
          "SELECT q.lease_ate FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id WHERE e.atribuicao_id=$1 AND q.estado='EXECUTANDO'",
          [fx.a],
        )
      ).rows[0]?.lease_ate;
      assert.ok(depois && depois > antes);
      await agendarAgora(fx.s, 2000);
      await motor.consumirUma();
      liberar();
      await primeira;
      assert.ok(
        (await servico.execucoes({ funcionario: fx.f })).itens.some((e) => e.status === "IGNORADA"),
      );
    });
    test("CANCELAR_ANTERIOR invalida tentativa antiga; ENFILEIRAR espera a anterior", async () => {
      for (const politica of ["CANCELAR_ANTERIOR", "ENFILEIRAR"]) {
        let liberar: () => void = () => undefined;
        let iniciar: () => void = () => undefined;
        let vezes = 0;
        const iniciou = new Promise<void>((r) => {
          iniciar = r;
        });
        const bloqueio = new Promise<void>((r) => {
          liberar = r;
        });
        const fx = await fixture(async () => {
          if (++vezes === 1) {
            iniciar();
            await bloqueio;
          }
          return { vezes };
        }, politica);
        await agendarAgora(fx.s);
        const primeira = motor.consumirUma();
        await iniciou;
        await agendarAgora(fx.s, 3000);
        const outro = new MotorFuncionarios(pool, registro);
        await outro.consumirUma();
        if (politica === "CANCELAR_ANTERIOR") assert.equal(vezes, 2);
        else assert.equal(vezes, 1);
        liberar();
        await primeira;
        if (politica === "ENFILEIRAR") {
          await pool.query(
            "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE estado='AGUARDANDO'",
          );
          await outro.consumirUma();
          assert.equal(vezes, 2);
        }
        const h = await servico.execucoes({ funcionario: fx.f });
        assert.equal(h.total, 2);
        assert.equal(
          h.itens.filter((e) => e.status === "SUCESSO").length,
          politica === "CANCELAR_ANTERIOR" ? 1 : 2,
        );
      }
    });
    test("HTTP execução manual, paginação/detalhe e snapshot 3D refletem o histórico real", async () => {
      const fx = await fixture();
      const r = await chamar(`/atribuicoes/${fx.a}/executar`, "POST");
      assert.equal(r.status, 201);
      const { id } = (await r.json()) as { id: string };
      await motor.consumirUma();
      assert.equal((await chamar(`/execucoes/${id}`)).status, 200);
      const lista = (await (
        await chamar(`/execucoes?funcionario=${fx.f}&limite=1&deslocamento=0`)
      ).json()) as ListaExecucoes;
      assert.equal(lista.total, 1);
      assert.equal(lista.itens[0]?.id, id);
      const snapshot = (await (await chamar("/estado")).json()) as EstadoFuncionarios;
      assert.ok(
        snapshot.setores
          .flatMap((s) => s.funcionarios)
          .some((f) => f.id === fx.f && f.atividade?.id === id),
      );
      assert.equal((await chamar(`/atribuicoes/${fx.a}`, "DELETE")).status, 200);
      assert.equal((await servico.detalhe(fx.f)).atribuicoes[0]?.habilitada, false);
    });
    test("pausar funcionário não interrompe execução em curso, mas impede novos disparos", async () => {
      let liberar: () => void = () => undefined;
      let iniciar: () => void = () => undefined;
      const iniciou = new Promise<void>((r) => {
        iniciar = r;
      });
      const espera = new Promise<void>((r) => {
        liberar = r;
      });
      const fx = await fixture(async () => {
        iniciar();
        await espera;
        return { ok: true };
      });
      const id = await motor.executarAgora(fx.a);
      const consumindo = motor.consumirUma();
      await iniciou;
      await servico.statusFuncionario(fx.f, "PAUSADO");
      await assert.rejects(motor.executarAgora(fx.a));
      liberar();
      await consumindo;
      assert.equal((await servico.execucao(id)).status, "SUCESSO");
    });
    test("botão Hotmart usa a mesma fila e preserva resposta real sem rede externa", async () => {
      const f = mock.method(globalThis, "fetch", async (entrada: Parameters<typeof fetch>[0]) => {
        const url =
          typeof entrada === "string"
            ? entrada
            : entrada instanceof URL
              ? entrada.toString()
              : entrada.url;
        return new Response(
          JSON.stringify(
            url.includes("/oauth/token")
              ? { access_token: "TOKEN_SIMULADO", expires_in: 3600 }
              : { items: [] },
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
      let aplicacao: INestApplication | undefined;
      try {
        const compartilhado = new MotorFuncionarios(pool, new RegistroHandlers());
        aplicacao = await NestFactory.create(
          AppModule.comModulos([
            VendasModule.registrar({
              pool,
              motor: compartilhado,
              config: {
                hotmartEnv: "sandbox",
                hotmart: {
                  clientId: new Secret("id-simulado"),
                  clientSecret: new Secret("segredo-simulado"),
                },
                syncIntervalMs: 1800000,
                backfillDays: 30,
                apiKey: new Secret(CHAVE),
              },
            }),
          ]),
          { logger: false },
        );
        await aplicacao.init();
        const sincronizacao =
          aplicacao.get<Pick<SincronizacaoVendas, "executar">>(SINCRONIZACAO_VENDAS);
        const resultado = await sincronizacao.executar();
        assert.equal(resultado.resultado, "sucesso");
        const seed = (await servico.funcionarios()).find(
          (x) => x.slug === "analista-atualizacoes-financeiras",
        );
        assert.ok(seed);
        const historico = await servico.execucoes({ funcionario: seed.id });
        assert.equal(historico.total, 1);
        assert.equal(historico.itens[0]?.origem, "manual");
        assert.equal(JSON.stringify(historico).includes("TOKEN_SIMULADO"), false);
      } finally {
        f.mock.restore();
        await aplicacao?.close();
      }
    });
    test("bootstrap inicializa intervalo uma vez e preserva edição do painel no reinício", async () => {
      const seed = (await servico.funcionarios()).find(
        (x) => x.slug === "analista-atualizacoes-financeiras",
      );
      assert.ok(seed);
      const agenda = (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0];
      assert.ok(agenda);
      const primeira = await NestFactory.create(
        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), true, 60)]),
        { logger: false },
      );
      try {
        await primeira.init();
        motor.parar();
      } finally {
        await primeira.close();
      }
      assert.equal(
        (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0]?.intervalo_min,
        60,
      );
      await servico.salvarAgenda(
        agenda.atribuicao_id,
        { gatilho: "INTERVALO", intervalo_min: 90, habilitado: false },
        agenda.id,
      );
      const segunda = await NestFactory.create(
        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), true, 120)]),
        { logger: false },
      );
      try {
        await segunda.init();
        motor.parar();
      } finally {
        await segunda.close();
      }
      assert.equal(
        (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0]?.intervalo_min,
        90,
      );
    });
    test("IDs bigint acima do limite seguro de JS continuam exatos no contrato JSON", async () => {
      const registro = (
        await objetos<{ id: string }>(pool, "SELECT 9007199254740993::bigint id")
      )[0];
      assert.equal(registro?.id, "9007199254740993");
      const agendas = await objetos<Agendamento>(
        pool,
        "SELECT * FROM funcionarios.agendamentos LIMIT 1",
      );
      assert.equal(typeof agendas[0]?.id, "string");
    });
    for (const operacao of ["planejador", "evento", "consumidor"] as const)
      test(`revisao: editar atribuicao durante ${operacao} nao inverte locks`, async () => {
        const fx = await fixture();
        await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false WHERE id<>$1", [
          fx.s,
        ]);
        await pool.query(
          "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp() WHERE id=$1",
          [fx.s],
        );
        if (operacao === "evento")
          await servico.salvarAgenda(
            fx.a,
            { gatilho: "EVENTO", tipo_evento: "financeiro.venda.alterada" },
            fx.s,
          );
        const execucao = operacao === "consumidor" ? await motor.executarAgora(fx.a) : null;
        const editor = await pool.connect();
        const estado = { terminou: false };
        let pid = 0;
        const planejador = new MotorFuncionarios(pool, registro, undefined, {
          agora: async (c) => {
            const r = await c.query<{ pid: number; agora: Date }>(
              "SELECT pg_backend_pid() pid, clock_timestamp() agora",
            );
            assert.ok(r.rows[0]);
            pid = r.rows[0].pid;
            return r.rows[0].agora;
          },
        });
        await editor.query("BEGIN");
        await editor.query("SELECT id FROM funcionarios.atribuicoes WHERE id=$1 FOR UPDATE", [
          fx.a,
        ]);
        const rodada = (
          operacao === "planejador"
            ? planejador.planejar()
            : operacao === "evento"
              ? planejador.publicar("financeiro.venda.alterada", randomUUID(), {})
              : planejador.consumirUma()
        ).finally(() => {
          estado.terminou = true;
        });
        try {
          for (let i = 0; i < 200 && !estado.terminou; i++) {
            const espera = (
              await pool.query<{ espera: string | null }>(
                "SELECT wait_event_type espera FROM pg_stat_activity WHERE pid=$1",
                [pid],
              )
            ).rows[0]?.espera;
            if (espera === "Lock") break;
            await new Promise((r) => setTimeout(r, 5));
          }
          await editor.query("SET LOCAL lock_timeout='200ms'");
          // Mesma segunda escrita de configurarAtribuicao: não pode aguardar um planner que espera este editor.
          await assert.doesNotReject(
            operacao === "consumidor"
              ? editor.query(
                  "SELECT id FROM funcionarios.fila WHERE execucao_id=$1 FOR UPDATE NOWAIT",
                  [execucao],
                )
              : editor.query("UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE id=$1", [
                  fx.s,
                ]),
          );
        } finally {
          await editor.query("ROLLBACK");
          editor.release();
          await rodada;
          await motor.consumirUma();
        }
      });
    test("revisao: falha Hotmart gera retentativas e FALHA, preservando resposta manual", async () => {
      const fetchFalho = mock.method(
        globalThis,
        "fetch",
        async () => new Response("{}", { status: 401 }),
      );
      const compartilhado = new MotorFuncionarios(pool, new RegistroHandlers());
      const aguardar = compartilhado.aguardar.bind(compartilhado);
      const esperaCurta = mock.method(
        compartilhado,
        "aguardar",
        (id: string, timeoutMs = 5000, primeiraTentativa = false) =>
          aguardar(id, Math.min(timeoutMs, 5000), primeiraTentativa),
      );
      let aplicacao: INestApplication | undefined;
      try {
        const anterior =
          (
            await pool.query<{ id: string }>(
              "SELECT coalesce(max(id),0)::text id FROM funcionarios.execucoes",
            )
          ).rows[0]?.id ?? "0";
        aplicacao = await NestFactory.create(
          AppModule.comModulos([
            VendasModule.registrar({
              pool,
              motor: compartilhado,
              config: {
                hotmartEnv: "sandbox",
                hotmart: {
                  clientId: new Secret("id-simulado"),
                  clientSecret: new Secret("segredo-simulado"),
                },
                syncIntervalMs: 1800000,
                backfillDays: 30,
                apiKey: new Secret(CHAVE),
              },
            }),
          ]),
          { logger: false },
        );
        await aplicacao.init();
        const sincronizacao =
          aplicacao.get<Pick<SincronizacaoVendas, "executar">>(SINCRONIZACAO_VENDAS);
        const resultadoPendente = sincronizacao.executar();
        const resultadoSeguro = resultadoPendente.catch(() => undefined);
        let execucao: { id: string; status: string; tentativa: number } | undefined;
        for (let i = 0; i < 200; i++) {
          execucao = (
            await pool.query<{ id: string; status: string; tentativa: number }>(
              "SELECT id,status,tentativa FROM funcionarios.execucoes WHERE id>$1 ORDER BY id DESC LIMIT 1",
              [anterior],
            )
          ).rows[0];
          if (execucao && !["AGUARDANDO", "EXECUTANDO"].includes(execucao.status)) break;
          if (execucao?.tentativa === 1 && execucao.status === "AGUARDANDO") break;
          await new Promise((r) => setTimeout(r, 5));
        }
        assert.ok(execucao);
        assert.equal(execucao.status, "AGUARDANDO");
        assert.deepEqual(await resultadoSeguro, {
          resultado: "falha",
          processadas: 0,
          mensagem: "A execucao falhou.",
        });
        for (let i = 0; i < 2; i++) {
          await pool.query(
            "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE execucao_id=$1",
            [execucao.id],
          );
          await compartilhado.consumirUma();
        }
        const fim = await servico.execucao(execucao.id);
        assert.equal(fim.status, "FALHA");
        assert.equal(fim.tentativa, 3);
        assert.equal(fim.erro_codigo, "HANDLER_FALHOU");
      } finally {
        esperaCurta.mock.restore();
        fetchFalho.mock.restore();
        await aplicacao?.close();
      }
    });
  },
);
