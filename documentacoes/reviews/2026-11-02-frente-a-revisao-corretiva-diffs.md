# Diffs da revisão corretiva da frente A

Data: 2026-11-02. [Relatório e evidências](2026-11-02-frente-a-revisao-corretiva.md).
[Entrega da frente A](../funcionarios/2026-11-02-modulo-funcionarios-virtuais.md).

Base das correções: 62bc66292fc9f7cfb84caf415d9eec24f5af8453. Nenhum commit criado nesta tarefa de revisão. Staged: vazio. Patch unstaged real de código/testes; documentos e lessons excluídos para evitar recursão.

```diff
diff --git a/apps/api/src/funcionarios/funcionarios.http.test.ts b/apps/api/src/funcionarios/funcionarios.http.test.ts
index c960587..07252b3 100644
--- a/apps/api/src/funcionarios/funcionarios.http.test.ts
+++ b/apps/api/src/funcionarios/funcionarios.http.test.ts
@@ -655,5 +655,160 @@ describe(
       );
       assert.equal(typeof agendas[0]?.id, "string");
     });
+    for (const operacao of ["planejador", "evento", "consumidor"] as const)
+      test(`revisao: editar atribuicao durante ${operacao} nao inverte locks`, async () => {
+        const fx = await fixture();
+        await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false WHERE id<>$1", [
+          fx.s,
+        ]);
+        await pool.query(
+          "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp() WHERE id=$1",
+          [fx.s],
+        );
+        if (operacao === "evento")
+          await servico.salvarAgenda(
+            fx.a,
+            { gatilho: "EVENTO", tipo_evento: "financeiro.venda.alterada" },
+            fx.s,
+          );
+        const execucao = operacao === "consumidor" ? await motor.executarAgora(fx.a) : null;
+        const editor = await pool.connect();
+        const estado = { terminou: false };
+        let pid = 0;
+        const planejador = new MotorFuncionarios(pool, registro, undefined, {
+          agora: async (c) => {
+            const r = await c.query<{ pid: number; agora: Date }>(
+              "SELECT pg_backend_pid() pid, clock_timestamp() agora",
+            );
+            assert.ok(r.rows[0]);
+            pid = r.rows[0].pid;
+            return r.rows[0].agora;
+          },
+        });
+        await editor.query("BEGIN");
+        await editor.query("SELECT id FROM funcionarios.atribuicoes WHERE id=$1 FOR UPDATE", [
+          fx.a,
+        ]);
+        const rodada = (
+          operacao === "planejador"
+            ? planejador.planejar()
+            : operacao === "evento"
+              ? planejador.publicar("financeiro.venda.alterada", randomUUID(), {})
+              : planejador.consumirUma()
+        ).finally(() => {
+          estado.terminou = true;
+        });
+        try {
+          for (let i = 0; i < 200 && !estado.terminou; i++) {
+            const espera = (
+              await pool.query<{ espera: string | null }>(
+                "SELECT wait_event_type espera FROM pg_stat_activity WHERE pid=$1",
+                [pid],
+              )
+            ).rows[0]?.espera;
+            if (espera === "Lock") break;
+            await new Promise((r) => setTimeout(r, 5));
+          }
+          await editor.query("SET LOCAL lock_timeout='200ms'");
+          // Mesma segunda escrita de configurarAtribuicao: não pode aguardar um planner que espera este editor.
+          await assert.doesNotReject(
+            operacao === "consumidor"
+              ? editor.query(
+                  "SELECT id FROM funcionarios.fila WHERE execucao_id=$1 FOR UPDATE NOWAIT",
+                  [execucao],
+                )
+              : editor.query("UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE id=$1", [
+                  fx.s,
+                ]),
+          );
+        } finally {
+          await editor.query("ROLLBACK");
+          editor.release();
+          await rodada;
+          await motor.consumirUma();
+        }
+      });
+    test("revisao: falha Hotmart gera retentativas e FALHA, preservando resposta manual", async () => {
+      const fetchFalho = mock.method(
+        globalThis,
+        "fetch",
+        async () => new Response("{}", { status: 401 }),
+      );
+      const compartilhado = new MotorFuncionarios(pool, new RegistroHandlers());
+      const aguardar = compartilhado.aguardar.bind(compartilhado);
+      const esperaCurta = mock.method(
+        compartilhado,
+        "aguardar",
+        (id: string, timeoutMs = 5000, primeiraTentativa = false) =>
+          aguardar(id, Math.min(timeoutMs, 5000), primeiraTentativa),
+      );
+      let aplicacao: INestApplication | undefined;
+      try {
+        const anterior =
+          (
+            await pool.query<{ id: string }>(
+              "SELECT coalesce(max(id),0)::text id FROM funcionarios.execucoes",
+            )
+          ).rows[0]?.id ?? "0";
+        aplicacao = await NestFactory.create(
+          AppModule.comModulos([
+            VendasModule.registrar({
+              pool,
+              motor: compartilhado,
+              config: {
+                hotmartEnv: "sandbox",
+                hotmart: {
+                  clientId: new Secret("id-simulado"),
+                  clientSecret: new Secret("segredo-simulado"),
+                },
+                syncIntervalMs: 1800000,
+                backfillDays: 30,
+                apiKey: new Secret(CHAVE),
+              },
+            }),
+          ]),
+          { logger: false },
+        );
+        await aplicacao.init();
+        const sincronizacao =
+          aplicacao.get<Pick<SincronizacaoVendas, "executar">>(SINCRONIZACAO_VENDAS);
+        const resultadoPendente = sincronizacao.executar();
+        const resultadoSeguro = resultadoPendente.catch(() => undefined);
+        let execucao: { id: string; status: string; tentativa: number } | undefined;
+        for (let i = 0; i < 200; i++) {
+          execucao = (
+            await pool.query<{ id: string; status: string; tentativa: number }>(
+              "SELECT id,status,tentativa FROM funcionarios.execucoes WHERE id>$1 ORDER BY id DESC LIMIT 1",
+              [anterior],
+            )
+          ).rows[0];
+          if (execucao && !["AGUARDANDO", "EXECUTANDO"].includes(execucao.status)) break;
+          if (execucao?.tentativa === 1 && execucao.status === "AGUARDANDO") break;
+          await new Promise((r) => setTimeout(r, 5));
+        }
+        assert.ok(execucao);
+        assert.equal(execucao.status, "AGUARDANDO");
+        assert.deepEqual(await resultadoSeguro, {
+          resultado: "falha",
+          processadas: 0,
+          mensagem: "A execucao falhou.",
+        });
+        for (let i = 0; i < 2; i++) {
+          await pool.query(
+            "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE execucao_id=$1",
+            [execucao.id],
+          );
+          await compartilhado.consumirUma();
+        }
+        const fim = await servico.execucao(execucao.id);
+        assert.equal(fim.status, "FALHA");
+        assert.equal(fim.tentativa, 3);
+        assert.equal(fim.erro_codigo, "HANDLER_FALHOU");
+      } finally {
+        esperaCurta.mock.restore();
+        fetchFalho.mock.restore();
+        await aplicacao?.close();
+      }
+    });
   },
 );
diff --git a/apps/api/src/funcionarios/motor.ts b/apps/api/src/funcionarios/motor.ts
index b0af497..86f05c3 100644
--- a/apps/api/src/funcionarios/motor.ts
+++ b/apps/api/src/funcionarios/motor.ts
@@ -70,7 +70,7 @@ export class MotorFuncionarios {
     const r = await c.query<{ id: string }>(
       `INSERT INTO funcionarios.execucoes(atribuicao_id,agendamento_id,agendamento_versao,origem,
    programada_em,chave_idempotencia,correlacao,config_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
-   ON CONFLICT(chave_idempotencia) DO UPDATE SET chave_idempotencia=EXCLUDED.chave_idempotencia RETURNING id`,
+   ON CONFLICT(chave_idempotencia) DO NOTHING RETURNING id`,
       [
         id,
         agendamento?.id ?? null,
@@ -83,7 +83,16 @@ export class MotorFuncionarios {
       ],
     );
     const execucao = r.rows[0]?.id;
-    if (execucao === undefined) throw new Error("enfileiramento sem identificador");
+    if (execucao === undefined) {
+      const existente = await c.query<{ id: string }>(
+        "SELECT id FROM funcionarios.execucoes WHERE chave_idempotencia=$1",
+        [chave],
+      );
+      const idExistente = existente.rows[0]?.id;
+      if (idExistente === undefined) throw new Error("enfileiramento sem identificador");
+      // Fila e execução foram inseridas atomicamente. Não bloqueia um histórico já em conclusão.
+      return idExistente;
+    }
     await c.query(
       "INSERT INTO funcionarios.fila(execucao_id,executar_em) VALUES($1,$2) ON CONFLICT(execucao_id) DO NOTHING",
       [execucao, quando],
@@ -106,11 +115,20 @@ export class MotorFuncionarios {
    JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id JOIN organizacao.setores setor ON setor.id=f.setor_id
    WHERE s.habilitado AND a.habilitada AND f.status='ATIVO' AND d.ativo AND setor.ativo
     AND d.status_implementacao='DISPONIVEL' AND s.proxima_em<=$1
-   ORDER BY s.proxima_em,s.id LIMIT 100 FOR UPDATE OF s SKIP LOCKED`,
+   ORDER BY s.proxima_em,s.id LIMIT 100 FOR UPDATE OF a SKIP LOCKED`,
         [agora],
       );
       let total = 0;
-      for (const { agenda: s } of rows) {
+      for (const { agenda: candidata } of rows) {
+        // Mesma ordem das edições: atribuição antes do agendamento. Releitura evita
+        // usar a versão/próxima ocorrência do snapshot anterior à aquisição do lock.
+        const atual = await c.query<{ agenda: Agendamento }>(
+          `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
+           WHERE s.id=$1 AND s.habilitado AND s.proxima_em<=$2 FOR UPDATE OF s`,
+          [candidata.id, agora],
+        );
+        const s = atual.rows[0]?.agenda;
+        if (s === undefined) continue;
         const ocorrencia = new Date(s.proxima_em as string);
         if (s.fim_em === null || ocorrencia <= new Date(s.fim_em)) {
           await this.#enfileirar(
@@ -159,10 +177,18 @@ export class MotorFuncionarios {
     JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
     WHERE s.gatilho='EVENTO' AND s.tipo_evento=$1 AND $2::jsonb @> s.filtro_evento AND s.habilitado
     AND s.inicio_em<=$3 AND(s.fim_em IS NULL OR s.fim_em>=$3) AND a.habilitada AND f.status='ATIVO' AND d.ativo
-    AND d.status_implementacao='DISPONIVEL' ORDER BY s.id FOR UPDATE OF s`,
+    AND d.status_implementacao='DISPONIVEL' ORDER BY a.id,s.id FOR UPDATE OF a`,
         [tipo, payload, agora],
       );
-      for (const { agenda: s } of agendas.rows)
+      for (const { agenda: candidata } of agendas.rows) {
+        const atual = await c.query<{ agenda: Agendamento }>(
+          `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
+           WHERE s.id=$1 AND s.gatilho='EVENTO' AND s.tipo_evento=$2 AND $3::jsonb @> s.filtro_evento
+           AND s.habilitado AND s.inicio_em<=$4 AND(s.fim_em IS NULL OR s.fim_em>=$4) FOR UPDATE OF s`,
+          [candidata.id, tipo, payload, agora],
+        );
+        const s = atual.rows[0]?.agenda;
+        if (s === undefined) continue;
         await this.#enfileirar(
           c,
           s.atribuicao_id,
@@ -171,6 +197,7 @@ export class MotorFuncionarios {
           agora,
           s,
         );
+      }
       await c.query("UPDATE funcionarios.eventos SET processado_em=$2 WHERE id=$1", [
         evento.id,
         agora,
@@ -182,16 +209,24 @@ export class MotorFuncionarios {
   async #reivindicar(): Promise<ItemFila | null> {
     return transacao(this.pool, async (c) => {
       const agora = await this.#agora(c);
-      const r = await c.query<ItemFila>(
-        `SELECT q.id,q.execucao_id,q.tentativa,q.estado,e.atribuicao_id,e.agendamento_id,e.agendamento_versao,e.chave_idempotencia,e.config_snapshot,
+      const consulta = `SELECT q.id,q.execucao_id,q.tentativa,q.estado,e.atribuicao_id,e.agendamento_id,e.agendamento_versao,e.chave_idempotencia,e.config_snapshot,
    s.versao,s.habilitado,coalesce(s.politica_sobreposicao,'ENFILEIRAR') politica_sobreposicao,
    coalesce(s.politica_retentativa,'{"maxTentativas":3,"backoffSegundos":30}'::jsonb) politica_retentativa
    FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id LEFT JOIN funcionarios.agendamentos s ON s.id=e.agendamento_id
-   JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id
-   WHERE(q.estado='AGUARDANDO' AND q.executar_em<=$1 OR q.estado='EXECUTANDO' AND q.lease_ate<=$1)
-   ORDER BY a.prioridade DESC,q.executar_em,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED`,
+   JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id`;
+      const disponivel = `(q.estado='AGUARDANDO' AND q.executar_em<=$1 OR q.estado='EXECUTANDO' AND q.lease_ate<=$1)`;
+      // O lock da atribuição precede também a fila; cancelamento e enfileiramento
+      // não podem esperar um item cujo consumidor esteja esperando esta atribuição.
+      const candidata = await c.query<ItemFila>(
+        `${consulta} WHERE ${disponivel} ORDER BY a.prioridade DESC,q.executar_em,q.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,
         [agora],
       );
+      const id = candidata.rows[0]?.id;
+      if (id === undefined) return null;
+      const r = await c.query<ItemFila>(
+        `${consulta} WHERE q.id=$2 AND ${disponivel} FOR UPDATE OF q SKIP LOCKED`,
+        [agora, id],
+      );
       const item = r.rows[0];
       if (item === undefined) return null;
       const a = await atribuicaoMotor(c, item.atribuicao_id);
@@ -360,7 +395,11 @@ export class MotorFuncionarios {
     });
     return true;
   }
-  async aguardar(execucaoId: string, timeoutMs = 120000): Promise<ExecucaoFuncionario> {
+  async aguardar(
+    execucaoId: string,
+    timeoutMs = 120000,
+    primeiraTentativa = false,
+  ): Promise<ExecucaoFuncionario> {
     const fim = Date.now() + timeoutMs;
     while (Date.now() < fim) {
       const e = (
@@ -371,7 +410,11 @@ export class MotorFuncionarios {
         )
       )[0];
       if (e === undefined) throw new NotFoundException();
-      if (!["AGUARDANDO", "EXECUTANDO"].includes(e.status)) return e;
+      if (
+        !["AGUARDANDO", "EXECUTANDO"].includes(e.status) ||
+        (primeiraTentativa && e.status === "AGUARDANDO" && e.tentativa > 0)
+      )
+        return e;
       await new Promise((resolve) => setTimeout(resolve, 100));
     }
     throw new ConflictException("execucao ainda em andamento");
diff --git a/apps/api/src/vendas/vendas.module.ts b/apps/api/src/vendas/vendas.module.ts
index ed0da02..730091e 100644
--- a/apps/api/src/vendas/vendas.module.ts
+++ b/apps/api/src/vendas/vendas.module.ts
@@ -47,7 +47,11 @@ export class VendasModule {
         executar: async (ctx) => {
           ctx.signal.throwIfAborted();
           if (!(await ctx.verificarLease())) throw new Error("lease perdida");
-          return sincronizacao.executar();
+          const resultado = await sincronizacao.executar();
+          // A sincronização preserva seu contrato sem lançar; o motor precisa da
+          // falha explícita para aplicar backoff e não registrar SUCESSO fictício.
+          if (resultado.resultado === "falha") throw new Error("sincronizacao Hotmart falhou");
+          return resultado;
         },
       });
     }
@@ -67,7 +71,9 @@ export class VendasModule {
               const id = await motor.executarAgora(atribuicao.id);
               // Mesmo consumidor/lease do disparo automático; preserva o contrato síncrono do botão.
               void motor.consumirUma().catch(() => undefined);
-              const execucao = await motor.aguardar(id);
+              // Mantém a resposta do botão na primeira rodada; retentativas após
+              // falha continuam na fila sem prender a requisição durante o backoff.
+              const execucao = await motor.aguardar(id, 120000, true);
               return execucao.resumo === null
                 ? { resultado: "falha" as const, processadas: 0, mensagem: "A execucao falhou." }
                 : (execucao.resumo as ResultadoSincronizacao);
```


## Registro Git posterior pelo coordenador

Correções aprovadas da revisão registradas no commit `bc89f2ca7a87738e9de690b51303deb3c5606a72` —
`fix(funcionarios): corrigir locks e falhas Hotmart no motor`.
O patch do relatório corresponde exatamente aos três arquivos desse commit; documentação
e lessons ficam em commit separado, sem diff recursivo. Não houve nova alteração de código
depois dos checks finais do revisor. Integração e aceite visual continuam separados.
