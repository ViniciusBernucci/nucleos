# Patch — base financeira B

Data: 2026-11-03. [Registro da entrega](2026-11-03-base-financeira-b.md).
Base: `a1a0b0e`; commit de código: `c5da47f640eb2204cc8bab9d5566fff6ae73ddbd`.
Commit: `feat(financeiro): implementar base operacional da frente B`.
Patch real dos 61 arquivos de código/testes/configuração, gerado com `git diff --unified=0`.
Contexto zero preserva todas as mudanças sem espaços em linhas vazias de contexto.
Para aplicar como patch, extraia o bloco e use `git apply --unidiff-zero`.
Documentação/lessons não entram no próprio patch.

```diff
diff --git a/.env.example b/.env.example
index 380c5d1..368084e 100644
--- a/.env.example
+++ b/.env.example
@@ -12,0 +13,7 @@ MINIO_CONSOLE_HOST_PORT=19001
+
+# Financeiro: valores secretos apenas no ambiente local ou *_FILE, nunca em NEXT_PUBLIC_*.
+# HOTMART_WEBHOOK_HOTTOK_FILE=
+# MINIO_ENDPOINT=http://127.0.0.1:19000
+# MINIO_FINANCEIRO_BUCKET=nucleos-financeiro
+# MINIO_ACCESS_KEY_FILE=
+# MINIO_SECRET_KEY_FILE=
diff --git a/apps/api/migrations/0007_alertas.up.sql b/apps/api/migrations/0007_alertas.up.sql
new file mode 100644
index 0000000..97f1909
--- /dev/null
+++ b/apps/api/migrations/0007_alertas.up.sql
@@ -0,0 +1,11 @@
+CREATE TABLE financeiro.alertas (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ tipo text NOT NULL CHECK(tipo IN ('conta_vencendo','conta_vencida','divergencia_conciliacao','divergencia_hotmart','recebimento_atrasado','caixa_insuficiente','anomalia','campanha_ruim')),
+ severidade text NOT NULL CHECK(severidade IN ('info','aviso','critico')),
+ referencia_tabela text NOT NULL, referencia_id text NOT NULL,
+ mensagem text NOT NULL CHECK(length(mensagem) BETWEEN 1 AND 240),
+ estado text NOT NULL DEFAULT 'aberto' CHECK(estado IN ('aberto','resolvido','ignorado')),
+ chave text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), encerrado_em timestamptz
+);
+CREATE UNIQUE INDEX alertas_abertos_uq ON financeiro.alertas(chave) WHERE estado='aberto';
+CREATE INDEX alertas_estado_data_idx ON financeiro.alertas(estado,criado_em DESC);
diff --git a/apps/api/migrations/0008_vendas_financeiras.up.sql b/apps/api/migrations/0008_vendas_financeiras.up.sql
new file mode 100644
index 0000000..7db970b
--- /dev/null
+++ b/apps/api/migrations/0008_vendas_financeiras.up.sql
@@ -0,0 +1,33 @@
+ALTER TABLE financeiro.vendas DROP CONSTRAINT vendas_grupo_check;
+ALTER TABLE financeiro.vendas ADD CONSTRAINT vendas_grupo_check CHECK(grupo IN ('receita','reembolso','cancelada','pendente','contestada'));
+ALTER TABLE financeiro.vendas ADD COLUMN oferta_codigo text,
+ ADD COLUMN desconto_centavos bigint CHECK(desconto_centavos>=0),
+ ADD COLUMN comissoes_centavos bigint NOT NULL DEFAULT 0 CHECK(comissoes_centavos>=0),
+ ADD COLUMN liquido_centavos bigint,
+ ADD COLUMN rastreio_origem text, ADD COLUMN rastreio_sck text;
+UPDATE financeiro.vendas SET liquido_centavos=valor_centavos-taxa_centavos;
+ALTER TABLE financeiro.vendas ALTER COLUMN liquido_centavos SET NOT NULL;
+-- Existing internal writers that omit the new column retain the effective-price semantics.
+CREATE FUNCTION financeiro.completar_liquido_venda() RETURNS trigger LANGUAGE plpgsql AS $$
+BEGIN
+ IF NEW.liquido_centavos IS NULL THEN
+  NEW.liquido_centavos=NEW.valor_centavos-NEW.taxa_centavos-NEW.comissoes_centavos;
+ END IF;
+ RETURN NEW;
+END $$;
+CREATE TRIGGER completar_liquido_venda BEFORE INSERT ON financeiro.vendas
+ FOR EACH ROW EXECUTE FUNCTION financeiro.completar_liquido_venda();
+UPDATE financeiro.vendas SET grupo='contestada' WHERE status IN ('CHARGEBACK','DISPUTE');
+CREATE TABLE financeiro.vendas_eventos (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ transacao text NOT NULL REFERENCES financeiro.vendas(transacao),
+ status_anterior text, status_novo text NOT NULL,
+ origem text NOT NULL CHECK(origem IN ('polling','webhook','reconciliacao')),
+ ocorrido_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE INDEX vendas_eventos_transacao_idx ON financeiro.vendas_eventos(transacao,id);
+CREATE TABLE financeiro.vendas_comissoes (
+ transacao text NOT NULL REFERENCES financeiro.vendas(transacao),
+ tipo text NOT NULL, moeda char(3) NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos>=0),
+ PRIMARY KEY(transacao,tipo,moeda)
+);
diff --git a/apps/api/migrations/0009_reconciliacao_hotmart.up.sql b/apps/api/migrations/0009_reconciliacao_hotmart.up.sql
new file mode 100644
index 0000000..b900872
--- /dev/null
+++ b/apps/api/migrations/0009_reconciliacao_hotmart.up.sql
@@ -0,0 +1,9 @@
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL',config_schema='{"type":"object","properties":{"inicio":{"type":"string","format":"date"},"fim":{"type":"string","format":"date"}},"additionalProperties":false}'
+ WHERE codigo='financeiro.reconciliar_hotmart';
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d ON d.codigo='financeiro.reconciliar_hotmart'
+ WHERE f.slug='analista-atualizacoes-financeiras' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em,habilitado)
+ SELECT a.id,'CRON','0 3 * * *',date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'+interval '1 day 3 hours',true
+ FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo='financeiro.reconciliar_hotmart' AND NOT EXISTS(SELECT 1 FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id);
diff --git a/apps/api/migrations/0010_webhooks_hotmart.up.sql b/apps/api/migrations/0010_webhooks_hotmart.up.sql
new file mode 100644
index 0000000..99d360c
--- /dev/null
+++ b/apps/api/migrations/0010_webhooks_hotmart.up.sql
@@ -0,0 +1,15 @@
+CREATE TABLE financeiro.webhooks_hotmart (
+ id text PRIMARY KEY, tipo text NOT NULL, transacao text NOT NULL,
+ recebido_em timestamptz NOT NULL DEFAULT now(), corpo_hash char(64) NOT NULL,
+ processado_em timestamptz
+);
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
+ WHERE codigo='financeiro.processar_evento_hotmart';
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
+ ON d.codigo='financeiro.processar_evento_hotmart' WHERE f.slug='analista-atualizacoes-financeiras'
+ ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,tipo_evento)
+ SELECT a.id,'EVENTO','hotmart.webhook.recebido' FROM funcionarios.atribuicoes a
+ JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo='financeiro.processar_evento_hotmart';
diff --git a/apps/api/migrations/0011_contas_pagar.up.sql b/apps/api/migrations/0011_contas_pagar.up.sql
new file mode 100644
index 0000000..4c9e714
--- /dev/null
+++ b/apps/api/migrations/0011_contas_pagar.up.sql
@@ -0,0 +1,65 @@
+CREATE TABLE financeiro.fornecedores (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 120),
+ documento text, contato text
+);
+CREATE TABLE financeiro.centros_custo (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 80),
+ ativo boolean NOT NULL DEFAULT true
+);
+ALTER TABLE financeiro.categorias ADD COLUMN linha_dre text, ADD COLUMN excluir_da_dre boolean NOT NULL DEFAULT false;
+ALTER TABLE financeiro.contas_recorrentes ADD COLUMN fornecedor_id bigint REFERENCES financeiro.fornecedores,
+ ADD COLUMN centro_custo_id bigint REFERENCES financeiro.centros_custo,
+ ADD COLUMN periodicidade text NOT NULL DEFAULT 'mensal' CHECK(periodicidade IN ('mensal','anual'));
+CREATE TABLE financeiro.contas_pagar (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ descricao text NOT NULL CHECK(length(descricao) BETWEEN 1 AND 120),
+ fornecedor_id bigint REFERENCES financeiro.fornecedores, categoria text NOT NULL,
+ centro_custo_id bigint REFERENCES financeiro.centros_custo,
+ valor_centavos bigint NOT NULL CHECK(valor_centavos>0), vencimento date NOT NULL, competencia date NOT NULL,
+ status text NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','paga','cancelada')),
+ parcela integer NOT NULL DEFAULT 1, parcelas integer NOT NULL DEFAULT 1, grupo_parcelamento uuid,
+ origem text NOT NULL CHECK(origem IN ('manual','recorrente','importacao')),
+ conta_recorrente_id bigint REFERENCES financeiro.contas_recorrentes,
+ importacao_hash text UNIQUE, criada_em timestamptz NOT NULL DEFAULT now(),
+ UNIQUE(conta_recorrente_id,competencia), CHECK(parcela BETWEEN 1 AND parcelas)
+);
+ALTER TABLE financeiro.lancamentos ADD COLUMN conta_pagar_id bigint REFERENCES financeiro.contas_pagar;
+CREATE UNIQUE INDEX lancamentos_conta_pagar_uq ON financeiro.lancamentos(conta_pagar_id) WHERE conta_pagar_id IS NOT NULL;
+WITH migradas AS (
+ INSERT INTO financeiro.contas_pagar(descricao,categoria,valor_centavos,vencimento,competencia,status,origem,conta_recorrente_id)
+ SELECT descricao,categoria,valor_centavos,data,competencia,'paga','recorrente',conta_recorrente_id
+ FROM financeiro.lancamentos WHERE conta_recorrente_id IS NOT NULL
+ RETURNING id,conta_recorrente_id,competencia
+)
+UPDATE financeiro.lancamentos l SET conta_pagar_id=m.id FROM migradas m
+ WHERE l.conta_recorrente_id=m.conta_recorrente_id AND l.competencia=m.competencia;
+CREATE INDEX contas_pagar_vencimento_idx ON financeiro.contas_pagar(status,vencimento);
+-- Keep the existing recurring-payment API compatible with materialized payables.
+CREATE FUNCTION financeiro.vincular_pagamento() RETURNS trigger LANGUAGE plpgsql AS $$
+BEGIN
+ IF NEW.conta_recorrente_id IS NOT NULL AND NEW.conta_pagar_id IS NULL THEN
+  INSERT INTO financeiro.contas_pagar(descricao,categoria,valor_centavos,vencimento,competencia,status,origem,conta_recorrente_id)
+  VALUES(NEW.descricao,NEW.categoria,NEW.valor_centavos,NEW.data,NEW.competencia,'paga','recorrente',NEW.conta_recorrente_id)
+  ON CONFLICT(conta_recorrente_id,competencia) DO UPDATE SET status='paga'
+  RETURNING id INTO NEW.conta_pagar_id;
+ END IF;
+ RETURN NEW;
+END $$;
+CREATE TRIGGER vincular_pagamento BEFORE INSERT ON financeiro.lancamentos
+ FOR EACH ROW EXECUTE FUNCTION financeiro.vincular_pagamento();
+CREATE FUNCTION financeiro.reabrir_pagamento() RETURNS trigger LANGUAGE plpgsql AS $$
+BEGIN
+ IF OLD.conta_pagar_id IS NOT NULL THEN
+  UPDATE financeiro.contas_pagar SET status='aberta' WHERE id=OLD.conta_pagar_id AND status='paga';
+ END IF;
+ RETURN OLD;
+END $$;
+CREATE TRIGGER reabrir_pagamento AFTER DELETE ON financeiro.lancamentos
+ FOR EACH ROW EXECUTE FUNCTION financeiro.reabrir_pagamento();
+CREATE TABLE financeiro.anexos (
+ id uuid PRIMARY KEY, conta_pagar_id bigint NOT NULL REFERENCES financeiro.contas_pagar,
+ nome text NOT NULL, tipo text NOT NULL CHECK(tipo IN ('application/pdf','image/jpeg','image/png')),
+ tamanho integer NOT NULL CHECK(tamanho BETWEEN 1 AND 10485760), hash char(64) NOT NULL, objeto_chave text NOT NULL UNIQUE,
+ criado_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE INDEX anexos_conta_pagar_idx ON financeiro.anexos(conta_pagar_id);
diff --git a/apps/api/migrations/0012_rotinas_contas.up.sql b/apps/api/migrations/0012_rotinas_contas.up.sql
new file mode 100644
index 0000000..acbf52c
--- /dev/null
+++ b/apps/api/migrations/0012_rotinas_contas.up.sql
@@ -0,0 +1,11 @@
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
+ WHERE codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos');
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
+ ON d.codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos') WHERE f.slug='gestor-contas'
+ ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
+ SELECT a.id,'CRON','0 6 * * *',now() FROM funcionarios.atribuicoes a
+ JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos');
+UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='gestor-contas' AND status='RASCUNHO';
diff --git a/apps/api/migrations/0013_contas_financeiras.up.sql b/apps/api/migrations/0013_contas_financeiras.up.sql
new file mode 100644
index 0000000..fc9a1ef
--- /dev/null
+++ b/apps/api/migrations/0013_contas_financeiras.up.sql
@@ -0,0 +1,33 @@
+CREATE TABLE financeiro.contas_financeiras (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL UNIQUE,
+ tipo text NOT NULL CHECK(tipo IN ('banco','caixa','plataforma')), ativa boolean NOT NULL DEFAULT true
+);
+INSERT INTO financeiro.contas_financeiras(nome,tipo) VALUES('Caixa principal','caixa'),('Hotmart','plataforma');
+ALTER TABLE financeiro.lancamentos ADD COLUMN conta_financeira_id bigint REFERENCES financeiro.contas_financeiras,
+ ADD COLUMN centro_custo_id bigint REFERENCES financeiro.centros_custo,
+ ADD COLUMN transferencia_id uuid;
+UPDATE financeiro.lancamentos SET conta_financeira_id=(SELECT id FROM financeiro.contas_financeiras WHERE nome='Caixa principal');
+ALTER TABLE financeiro.lancamentos ALTER COLUMN conta_financeira_id SET NOT NULL,
+ ALTER COLUMN conta_financeira_id SET DEFAULT 1;
+CREATE TABLE financeiro.saques_hotmart (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, data date NOT NULL,
+ bruto_centavos bigint NOT NULL CHECK(bruto_centavos>0), taxa_centavos bigint NOT NULL CHECK(taxa_centavos>=0),
+ liquido_centavos bigint NOT NULL CHECK(liquido_centavos>0), conta_destino_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
+ comprovante text, transferencia_id uuid NOT NULL UNIQUE,
+ CHECK(bruto_centavos-taxa_centavos=liquido_centavos)
+);
+CREATE TABLE financeiro.saldos_informados (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
+ data date NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos>=0), origem text NOT NULL DEFAULT 'usuario' CHECK(origem='usuario')
+);
+CREATE TABLE financeiro.regras_liberacao (
+ pagamento text PRIMARY KEY, dias integer NOT NULL CHECK(dias BETWEEN 0 AND 365)
+);
+CREATE TABLE financeiro.contas_receber (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, origem text NOT NULL CHECK(origem IN ('hotmart','manual')),
+ transacao text UNIQUE REFERENCES financeiro.vendas, descricao text NOT NULL,
+ valor_centavos bigint NOT NULL CHECK(valor_centavos>0), previsto_em date,
+ status text NOT NULL DEFAULT 'estimado' CHECK(status IN ('estimado','recebido','cancelado')),
+ conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras
+);
+CREATE INDEX lancamentos_conta_data_idx ON financeiro.lancamentos(conta_financeira_id,data);
diff --git a/apps/api/migrations/0014_extratos.up.sql b/apps/api/migrations/0014_extratos.up.sql
new file mode 100644
index 0000000..e981f2a
--- /dev/null
+++ b/apps/api/migrations/0014_extratos.up.sql
@@ -0,0 +1,19 @@
+CREATE TABLE financeiro.extratos_importados (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
+ hash char(64) NOT NULL, importado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(conta_financeira_id,hash)
+);
+CREATE TABLE financeiro.extrato_itens (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, extrato_id bigint NOT NULL REFERENCES financeiro.extratos_importados,
+ conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
+ fitid text NOT NULL, data date NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos<>0),
+ memo text NOT NULL, conciliado boolean NOT NULL DEFAULT false, UNIQUE(conta_financeira_id,fitid)
+);
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
+ WHERE codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos');
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
+ ON d.codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos') WHERE f.slug='gestor-contas'
+ ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
+ SELECT a.id,'CRON','0 7 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos');
diff --git a/apps/api/migrations/0015_conciliacao.up.sql b/apps/api/migrations/0015_conciliacao.up.sql
new file mode 100644
index 0000000..279bfff
--- /dev/null
+++ b/apps/api/migrations/0015_conciliacao.up.sql
@@ -0,0 +1,24 @@
+CREATE TABLE financeiro.conciliacoes (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ estado text NOT NULL CHECK(estado IN ('conciliada','parcial','pendente_analise')),
+ diferenca_centavos bigint NOT NULL DEFAULT 0, observacao text NOT NULL DEFAULT '',
+ chave text NOT NULL, aceita boolean NOT NULL DEFAULT false, recusada boolean NOT NULL DEFAULT false,
+ desfeita boolean NOT NULL DEFAULT false, quem text NOT NULL DEFAULT 'admin-local',
+ criada_em timestamptz NOT NULL DEFAULT now(), atualizada_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE UNIQUE INDEX conciliacao_ativa_chave_uq ON financeiro.conciliacoes(chave) WHERE NOT desfeita AND NOT recusada;
+CREATE TABLE financeiro.conciliacao_itens (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conciliacao_id bigint NOT NULL REFERENCES financeiro.conciliacoes,
+ tipo text NOT NULL CHECK(tipo IN ('venda','saque','extrato_item','lancamento','conta_pagar')),
+ referencia_id text NOT NULL, valor_centavos bigint NOT NULL,
+ UNIQUE(conciliacao_id,tipo,referencia_id)
+);
+UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL' WHERE codigo='financeiro.conciliar_vendas';
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
+ SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
+ ON d.codigo='financeiro.conciliar_vendas' WHERE f.slug='conciliador-financeiro'
+ ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
+ SELECT a.id,'CRON','0 8 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+ WHERE d.codigo='financeiro.conciliar_vendas';
+UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='conciliador-financeiro' AND status='RASCUNHO';
diff --git a/apps/api/package.json b/apps/api/package.json
index aec260a..bf7d676 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -13,0 +14 @@
+    "@aws-sdk/client-s3": "3.1161.0",
diff --git a/apps/api/src/financeiro/alertas.ts b/apps/api/src/financeiro/alertas.ts
new file mode 100644
index 0000000..51c1aca
--- /dev/null
+++ b/apps/api/src/financeiro/alertas.ts
@@ -0,0 +1,89 @@
+import { BadRequestException, NotFoundException } from "@nestjs/common";
+import type { Pool, PoolClient } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+
+export const MENSAGENS_ALERTA = {
+  conta_vencendo: "Conta a pagar vence nos proximos tres dias.",
+  conta_vencida: "Conta a pagar vencida.",
+  divergencia_conciliacao: "Divergencia encontrada na conciliacao financeira.",
+  divergencia_hotmart: "Divergencia na reconciliacao com a Hotmart.",
+  recebimento_atrasado: "Recebimento estimado vencido sem conciliacao.",
+  caixa_insuficiente: "Saldo projetado abaixo do limite configurado.",
+  anomalia: "Desvio detectado nos indicadores financeiros.",
+  campanha_ruim: "Campanha abaixo do limite de rentabilidade.",
+} as const;
+export type TipoAlerta = keyof typeof MENSAGENS_ALERTA;
+export interface NovoAlerta {
+  tipo: TipoAlerta;
+  chave: string;
+  referenciaTabela: string;
+  referenciaId: string;
+  severidade?: "info" | "aviso" | "critico";
+}
+export class AlertasFinanceiros {
+  constructor(
+    readonly pool: Pool,
+    readonly motor: MotorFuncionarios,
+  ) {}
+  /** A insercao e o evento pertencem a mesma transacao. O chamador pode fornecer a sua. */
+  async criar(dados: NovoAlerta, cliente?: PoolClient): Promise<string | null> {
+    if (
+      !(dados.tipo in MENSAGENS_ALERTA) ||
+      !/^[a-z_]+$/.test(dados.referenciaTabela) ||
+      dados.chave.length > 240
+    )
+      throw new BadRequestException("alerta invalido");
+    const c = cliente ?? (await this.pool.connect());
+    try {
+      if (!cliente) await c.query("BEGIN");
+      const { rows } = await c.query<{ id: string }>(
+        `INSERT INTO financeiro.alertas(tipo,severidade,referencia_tabela,referencia_id,mensagem,chave)
+    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chave) WHERE estado='aberto' DO NOTHING RETURNING id`,
+        [
+          dados.tipo,
+          dados.severidade ?? "aviso",
+          dados.referenciaTabela,
+          dados.referenciaId,
+          MENSAGENS_ALERTA[dados.tipo],
+          dados.chave,
+        ],
+      );
+      const id = rows[0]?.id ?? null;
+      if (id)
+        await this.motor.publicar(
+          "financeiro.alerta.criado",
+          `alerta:${id}`,
+          { alerta_id: id, tipo: dados.tipo },
+          c,
+        );
+      if (!cliente) await c.query("COMMIT");
+      return id;
+    } catch (erro) {
+      if (!cliente) await c.query("ROLLBACK");
+      throw erro;
+    } finally {
+      if (!cliente) c.release();
+    }
+  }
+  async listar(estado = "aberto", tipo?: string): Promise<Record<string, unknown>[]> {
+    if (
+      !["aberto", "resolvido", "ignorado"].includes(estado) ||
+      (tipo !== undefined && !(tipo in MENSAGENS_ALERTA))
+    )
+      throw new BadRequestException("filtro invalido");
+    return (
+      await this.pool.query(
+        `SELECT * FROM financeiro.alertas WHERE estado=$1 AND ($2::text IS NULL OR tipo=$2) ORDER BY criado_em DESC,id DESC LIMIT 500`,
+        [estado, tipo ?? null],
+      )
+    ).rows as Record<string, unknown>[];
+  }
+  async encerrar(id: string, estado: "resolvido" | "ignorado"): Promise<void> {
+    if (!/^\d{1,19}$/.test(id)) throw new NotFoundException();
+    const r = await this.pool.query(
+      "UPDATE financeiro.alertas SET estado=$2,encerrado_em=now() WHERE id=$1 AND estado='aberto' RETURNING id",
+      [id, estado],
+    );
+    if (r.rowCount === 0) throw new NotFoundException("alerta aberto nao encontrado");
+  }
+}
diff --git a/apps/api/src/financeiro/anexos.test.ts b/apps/api/src/financeiro/anexos.test.ts
new file mode 100644
index 0000000..e5dc834
--- /dev/null
+++ b/apps/api/src/financeiro/anexos.test.ts
@@ -0,0 +1,52 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import type { Pool } from "pg";
+import type { S3Client } from "@aws-sdk/client-s3";
+import { AnexosFinanceiros } from "./anexos.js";
+test("anexos privados validam arquivo e compensam upload quando metadados falham", async () => {
+  const comandos: string[] = [];
+  const pool = {
+    query: async (sql: string) => {
+      if (sql.startsWith("SELECT")) return { rowCount: 1, rows: [{ id: "1" }] };
+      throw new Error("falha SQL simulada");
+    },
+  } as unknown as Pool;
+  const s3 = {
+    send: async (command: unknown) => {
+      comandos.push((command as object).constructor.name);
+      return {};
+    },
+  } as unknown as S3Client;
+  const servico = new AnexosFinanceiros(
+    pool,
+    {
+      endpoint: "http://127.0.0.1:19000",
+      bucket: "teste-ficticio",
+      accessKey: new Secret("teste-key"),
+      secretKey: new Secret("teste-secret"),
+    },
+    s3,
+  );
+  await assert.rejects(servico.enviar("1", undefined), { status: 400 });
+  await assert.rejects(
+    servico.enviar("1", {
+      originalname: "x.pdf",
+      mimetype: "application/pdf",
+      size: 2,
+      buffer: Buffer.from("xx"),
+    }),
+    { status: 400 },
+  );
+  assert.equal(comandos.length, 0);
+  await assert.rejects(
+    servico.enviar("1", {
+      originalname: "x.pdf",
+      mimetype: "application/pdf",
+      size: 8,
+      buffer: Buffer.from("%PDF-1.7"),
+    }),
+    /falha SQL simulada/,
+  );
+  assert.deepEqual(comandos, ["PutObjectCommand", "DeleteObjectCommand"]);
+});
diff --git a/apps/api/src/financeiro/anexos.ts b/apps/api/src/financeiro/anexos.ts
new file mode 100644
index 0000000..de7da0f
--- /dev/null
+++ b/apps/api/src/financeiro/anexos.ts
@@ -0,0 +1,110 @@
+import { randomUUID, createHash } from "node:crypto";
+import {
+  BadRequestException,
+  NotFoundException,
+  ServiceUnavailableException,
+} from "@nestjs/common";
+import {
+  S3Client,
+  PutObjectCommand,
+  GetObjectCommand,
+  DeleteObjectCommand,
+} from "@aws-sdk/client-s3";
+import type { FinanceiroConfig } from "@nucleos/config";
+import type { Pool } from "pg";
+import { id } from "./importacao.js";
+export interface ArquivoAnexo {
+  originalname: string;
+  mimetype: string;
+  buffer: Buffer;
+  size: number;
+}
+export class AnexosFinanceiros {
+  readonly cliente: S3Client | undefined;
+  constructor(
+    readonly pool: Pool,
+    readonly config: FinanceiroConfig["anexos"],
+    cliente?: S3Client,
+  ) {
+    this.cliente =
+      cliente ??
+      (config
+        ? new S3Client({
+            endpoint: config.endpoint,
+            region: "us-east-1",
+            forcePathStyle: true,
+            credentials: {
+              accessKeyId: config.accessKey.reveal(),
+              secretAccessKey: config.secretKey.reveal(),
+            },
+          })
+        : undefined);
+  }
+  async enviar(conta: string, arquivo: ArquivoAnexo | undefined): Promise<unknown> {
+    id(conta);
+    if (!this.cliente || !this.config)
+      throw new ServiceUnavailableException("anexos MinIO nao configurados");
+    if (
+      !arquivo ||
+      !Buffer.isBuffer(arquivo.buffer) ||
+      arquivo.size < 1 ||
+      arquivo.size > 10 * 1024 * 1024
+    )
+      throw new BadRequestException("anexo exige 1 byte a 10 MB");
+    const b = arquivo.buffer,
+      tipo = arquivo.mimetype;
+    const magic =
+      tipo === "application/pdf"
+        ? b.subarray(0, 5).toString() === "%PDF-"
+        : tipo === "image/png"
+          ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
+          : tipo === "image/jpeg"
+            ? b[0] === 255 && b[1] === 216 && b[2] === 255
+            : false;
+    if (!magic) throw new BadRequestException("arquivo PDF, JPG ou PNG invalido");
+    if (
+      !(await this.pool.query("SELECT id FROM financeiro.contas_pagar WHERE id=$1", [conta]))
+        .rowCount
+    )
+      throw new NotFoundException();
+    const anexo = randomUUID(),
+      chave = "contas-pagar/" + conta + "/" + anexo;
+    await this.cliente.send(
+      new PutObjectCommand({ Bucket: this.config.bucket, Key: chave, Body: b, ContentType: tipo }),
+    );
+    try {
+      await this.pool.query(
+        "INSERT INTO financeiro.anexos(id,conta_pagar_id,nome,tipo,tamanho,hash,objeto_chave) VALUES($1,$2,$3,$4,$5,$6,$7)",
+        [
+          anexo,
+          conta,
+          arquivo.originalname.replace(/[\r\n/\\]/g, "_").slice(0, 120),
+          tipo,
+          b.length,
+          createHash("sha256").update(b).digest("hex"),
+          chave,
+        ],
+      );
+    } catch (e) {
+      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: chave }));
+      throw e;
+    }
+    return { id: anexo };
+  }
+  async baixar(anexo: string): Promise<{ corpo: Uint8Array; tipo: string; nome: string }> {
+    if (!/^[a-f0-9-]{36}$/i.test(anexo)) throw new NotFoundException();
+    if (!this.cliente || !this.config)
+      throw new ServiceUnavailableException("anexos nao configurados");
+    const r = await this.pool.query<{ objeto_chave: string; tipo: string; nome: string }>(
+      "SELECT objeto_chave,tipo,nome FROM financeiro.anexos WHERE id=$1",
+      [anexo],
+    );
+    const v = r.rows[0];
+    if (!v) throw new NotFoundException();
+    const objeto = await this.cliente.send(
+      new GetObjectCommand({ Bucket: this.config.bucket, Key: v.objeto_chave }),
+    );
+    if (!objeto.Body) throw new NotFoundException();
+    return { corpo: await objeto.Body.transformToByteArray(), tipo: v.tipo, nome: v.nome };
+  }
+}
diff --git a/apps/api/src/financeiro/conciliacao.ts b/apps/api/src/financeiro/conciliacao.ts
new file mode 100644
index 0000000..5c95049
--- /dev/null
+++ b/apps/api/src/financeiro/conciliacao.ts
@@ -0,0 +1,248 @@
+import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
+import { randomUUID } from "node:crypto";
+import type { PoolClient } from "pg";
+import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+import { centavos, id, texto } from "./importacao.js";
+type Item = {
+  tipo: "saque" | "conta_pagar" | "extrato_item" | "venda" | "lancamento";
+  referenciaId: string;
+  valorCentavos: string;
+};
+export class ConciliacaoFinanceira {
+  constructor(readonly repo: RepositorioFinanceiroPg) {}
+  async sugerir(c: PoolClient): Promise<number> {
+    const origens = await c.query<{
+      tipo: "saque" | "conta_pagar";
+      id: string;
+      valor: string;
+      data: string;
+      conta: string;
+    }>(`
+      SELECT 'saque' tipo,id,liquido_centavos::text valor,data::text data,conta_destino_id::text conta FROM financeiro.saques_hotmart
+      UNION ALL SELECT 'conta_pagar',p.id,(-p.valor_centavos)::text,l.data::text,l.conta_financeira_id::text
+      FROM financeiro.contas_pagar p JOIN financeiro.lancamentos l ON l.conta_pagar_id=p.id WHERE p.status='paga'`);
+    let novas = 0;
+    for (const origem of origens.rows) {
+      const candidatos = await c.query<{ id: string; valor_centavos: string }>(
+        `SELECT id,valor_centavos FROM financeiro.extrato_itens
+        WHERE NOT conciliado AND conta_financeira_id=$1 AND valor_centavos=$2 AND data BETWEEN $3::date-3 AND $3::date+3 ORDER BY id`,
+        [origem.conta, origem.valor, origem.data],
+      );
+      const estado = candidatos.rowCount === 1 ? "conciliada" : "pendente_analise";
+      const r = await c.query<{ id: string }>(
+        `INSERT INTO financeiro.conciliacoes(estado,chave) VALUES($1,$2)
+        ON CONFLICT(chave) WHERE NOT desfeita AND NOT recusada DO NOTHING RETURNING id`,
+        [estado, origem.tipo + ":" + origem.id],
+      );
+      const cid = r.rows[0]?.id;
+      if (!cid) continue;
+      novas++;
+      await c.query(
+        "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,$2,$3,$4)",
+        [cid, origem.tipo, origem.id, origem.valor],
+      );
+      // A unique exact match is only a suggestion; accepting still rechecks ownership.
+      if (candidatos.rowCount === 1)
+        await c.query(
+          "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,'extrato_item',$2,$3)",
+          [cid, candidatos.rows[0]?.id, candidatos.rows[0]?.valor_centavos],
+        );
+      else
+        await this.repo.alertas.criar(
+          {
+            tipo: "divergencia_conciliacao",
+            chave: "conciliacao:" + cid,
+            referenciaTabela: "conciliacoes",
+            referenciaId: cid,
+          },
+          c,
+        );
+    }
+    const divergentes = await c.query<{ transacao: string; diferenca: string }>(
+      "SELECT transacao,(liquido_centavos-(valor_centavos-taxa_centavos-comissoes_centavos))::text diferenca FROM financeiro.vendas WHERE liquido_centavos<>valor_centavos-taxa_centavos-comissoes_centavos",
+    );
+    for (const v of divergentes.rows)
+      await this.repo.alertas.criar(
+        {
+          tipo: "divergencia_conciliacao",
+          chave: "venda-inconsistente:" + v.transacao,
+          referenciaTabela: "vendas",
+          referenciaId: v.transacao,
+        },
+        c,
+      );
+    // Compare like periods in BRL; this is not the platform's available balance.
+    const periodos = await c.query<{ periodo: string; vendido: string; sacado: string }>(`
+      WITH vendas AS (
+        SELECT date_trunc('month',coalesce(aprovado_em,pedido_em) AT TIME ZONE 'America/Sao_Paulo')::date mes,
+        sum(liquido_centavos) valor FROM financeiro.vendas WHERE grupo='receita' AND moeda='BRL' GROUP BY 1
+      ), saques AS (
+        SELECT date_trunc('month',data)::date mes,sum(bruto_centavos) valor FROM financeiro.saques_hotmart GROUP BY 1
+      )
+      SELECT to_char(coalesce(v.mes,s.mes),'YYYY-MM') periodo,coalesce(v.valor,0)::text vendido,
+        coalesce(s.valor,0)::text sacado FROM vendas v FULL JOIN saques s ON s.mes=v.mes`);
+    for (const saldo of periodos.rows) {
+      const diferenca = BigInt(saldo.vendido) - BigInt(saldo.sacado);
+      if (diferenca === 0n) continue;
+      const chave = "hotmart-periodo:" + saldo.periodo;
+      const resumo = await c.query<{ id: string }>(
+        `INSERT INTO financeiro.conciliacoes(estado,chave,diferenca_centavos,observacao)
+        VALUES('parcial',$1,$2,'Receitas liquidas BRL e saques do mesmo mes; saldo nao representa disponibilidade.')
+        ON CONFLICT(chave) WHERE NOT desfeita AND NOT recusada DO UPDATE SET diferenca_centavos=excluded.diferenca_centavos
+        RETURNING id`,
+        [chave, diferenca.toString()],
+      );
+      const cid = resumo.rows[0]?.id;
+      if (cid)
+        await this.repo.alertas.criar(
+          {
+            tipo: "divergencia_conciliacao",
+            chave: "resumo:" + cid,
+            referenciaTabela: "conciliacoes",
+            referenciaId: cid,
+          },
+          c,
+        );
+    }
+    return novas;
+  }
+  async listar(): Promise<unknown> {
+    return (
+      await this.repo.pool
+        .query(`SELECT c.*,coalesce(jsonb_agg(jsonb_build_object('tipo',i.tipo,'referenciaId',i.referencia_id,'valorCentavos',i.valor_centavos::text)) FILTER(WHERE i.id IS NOT NULL),'[]') itens
+      FROM financeiro.conciliacoes c LEFT JOIN financeiro.conciliacao_itens i ON i.conciliacao_id=c.id
+      GROUP BY c.id ORDER BY c.id DESC LIMIT 500`)
+    ).rows;
+  }
+  async manual(p: Record<string, unknown>): Promise<unknown> {
+    if (!Array.isArray(p["itens"]) || p["itens"].length < 2 || p["itens"].length > 100)
+      throw new BadRequestException("itens invalidos");
+    const itens: Item[] = p["itens"].map((v: unknown) => {
+      if (typeof v !== "object" || v === null) throw new BadRequestException();
+      const i = v as Record<string, unknown>,
+        tipo = String(i["tipo"]) as Item["tipo"];
+      if (!["saque", "conta_pagar", "extrato_item", "venda", "lancamento"].includes(tipo))
+        throw new BadRequestException();
+      return {
+        tipo,
+        referenciaId: tipo === "venda" ? texto(i["referenciaId"], 100) : id(i["referenciaId"]),
+        valorCentavos: centavos(i["valorCentavos"], true),
+      };
+    });
+    return this.repo.transacao(async (c) => {
+      for (const i of itens) await this.validarItem(c, i);
+      const origens = itens
+        .filter((i) => i.tipo !== "extrato_item")
+        .reduce((n, i) => n + BigInt(i.valorCentavos), 0n);
+      const extratos = itens
+        .filter((i) => i.tipo === "extrato_item")
+        .reduce((n, i) => n + BigInt(i.valorCentavos), 0n);
+      const diferenca = origens - extratos;
+      const r = await c.query<{ id: string }>(
+        "INSERT INTO financeiro.conciliacoes(estado,chave,diferenca_centavos,observacao) VALUES($1,$2,$3,$4) RETURNING id",
+        [
+          diferenca === 0n ? "conciliada" : "parcial",
+          "manual:" + randomUUID(),
+          diferenca.toString(),
+          p["observacao"] ? texto(p["observacao"], 500) : "",
+        ],
+      );
+      const cid = r.rows[0]?.id;
+      for (const i of itens)
+        await c.query(
+          "INSERT INTO financeiro.conciliacao_itens(conciliacao_id,tipo,referencia_id,valor_centavos) VALUES($1,$2,$3,$4)",
+          [cid, i.tipo, i.referenciaId, i.valorCentavos],
+        );
+      return { id: cid };
+    });
+  }
+  private async validarItem(c: PoolClient, i: Item): Promise<void> {
+    // Query table/columns come only from the closed discriminator above.
+    const queries: Record<Item["tipo"], string> = {
+      saque: "SELECT liquido_centavos::text valor FROM financeiro.saques_hotmart WHERE id=$1",
+      conta_pagar:
+        "SELECT (-valor_centavos)::text valor FROM financeiro.contas_pagar WHERE id=$1 AND status='paga'",
+      extrato_item:
+        "SELECT valor_centavos::text valor FROM financeiro.extrato_itens WHERE id=$1 FOR UPDATE",
+      venda:
+        "SELECT liquido_centavos::text valor FROM financeiro.vendas WHERE transacao=$1 AND moeda='BRL'",
+      lancamento:
+        "SELECT (CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text valor FROM financeiro.lancamentos WHERE id=$1",
+    };
+    const r = await c.query<{ valor: string }>(queries[i.tipo], [i.referenciaId]);
+    if (!r.rows[0] || BigInt(r.rows[0].valor) !== BigInt(i.valorCentavos))
+      throw new BadRequestException("item ou valor divergente");
+  }
+  async agir(cid: string, acao: string): Promise<void> {
+    id(cid);
+    if (!["aceitar", "recusar", "desfazer"].includes(acao))
+      throw new BadRequestException("acao invalida");
+    await this.repo.transacao(async (c) => {
+      // Global reconciliation lock gives deterministic exclusion across overlapping suggestions.
+      await c.query("SELECT pg_advisory_xact_lock(7315090)");
+      const r = await c.query<{
+        aceita: boolean;
+        desfeita: boolean;
+        recusada: boolean;
+        estado: string;
+      }>("SELECT * FROM financeiro.conciliacoes WHERE id=$1 FOR UPDATE", [cid]);
+      const v = r.rows[0];
+      if (!v) throw new NotFoundException();
+      if (v.desfeita || v.recusada) throw new ConflictException("conciliacao encerrada");
+      const itens = await c.query<{
+        tipo: Item["tipo"];
+        referencia_id: string;
+        valor_centavos: string;
+      }>(
+        "SELECT tipo,referencia_id,valor_centavos FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 ORDER BY tipo,referencia_id",
+        [cid],
+      );
+      if (acao === "aceitar") {
+        if (v.aceita || v.estado === "pendente_analise" || itens.rows.length < 2)
+          throw new ConflictException("revise os itens manualmente");
+        for (const i of itens.rows) {
+          await this.validarItem(c, {
+            tipo: i.tipo,
+            referenciaId: i.referencia_id,
+            valorCentavos: i.valor_centavos,
+          });
+          if (
+            (
+              await c.query(
+                `SELECT i.id FROM financeiro.conciliacao_itens i JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id
+            WHERE i.tipo=$1 AND i.referencia_id=$2 AND c.aceita AND NOT c.desfeita`,
+                [i.tipo, i.referencia_id],
+              )
+            ).rowCount
+          )
+            throw new ConflictException("item ja conciliado");
+        }
+        await c.query(
+          "UPDATE financeiro.extrato_itens SET conciliado=true WHERE id::text IN (SELECT referencia_id FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 AND tipo='extrato_item')",
+          [cid],
+        );
+        await c.query(
+          "UPDATE financeiro.conciliacoes SET aceita=true,atualizada_em=now() WHERE id=$1",
+          [cid],
+        );
+      } else if (acao === "recusar") {
+        if (v.aceita) throw new ConflictException("desfaca antes de recusar");
+        await c.query(
+          "UPDATE financeiro.conciliacoes SET recusada=true,atualizada_em=now() WHERE id=$1",
+          [cid],
+        );
+      } else {
+        if (!v.aceita) throw new ConflictException("conciliacao nao aceita");
+        await c.query(
+          "UPDATE financeiro.extrato_itens SET conciliado=false WHERE id::text IN (SELECT referencia_id FROM financeiro.conciliacao_itens WHERE conciliacao_id=$1 AND tipo='extrato_item')",
+          [cid],
+        );
+        await c.query(
+          "UPDATE financeiro.conciliacoes SET desfeita=true,atualizada_em=now() WHERE id=$1",
+          [cid],
+        );
+      }
+      await this.repo.mudou(c);
+    });
+  }
+}
diff --git a/apps/api/src/financeiro/corpo.pipe.ts b/apps/api/src/financeiro/corpo.pipe.ts
new file mode 100644
index 0000000..6e4cdc2
--- /dev/null
+++ b/apps/api/src/financeiro/corpo.pipe.ts
@@ -0,0 +1,8 @@
+import { BadRequestException, type PipeTransform } from "@nestjs/common";
+export class CorpoFinanceiroPipe implements PipeTransform<unknown, Record<string, unknown>> {
+  transform(valor: unknown): Record<string, unknown> {
+    if (typeof valor !== "object" || valor === null || Array.isArray(valor))
+      throw new BadRequestException("objeto esperado");
+    return valor as Record<string, unknown>;
+  }
+}
diff --git a/apps/api/src/financeiro/financeiro.controller.ts b/apps/api/src/financeiro/financeiro.controller.ts
new file mode 100644
index 0000000..2bacc9d
--- /dev/null
+++ b/apps/api/src/financeiro/financeiro.controller.ts
@@ -0,0 +1,175 @@
+import {
+  Controller,
+  Get,
+  Post,
+  Param,
+  Query,
+  Inject,
+  UseGuards,
+  Body,
+  BadRequestException,
+  UseInterceptors,
+  UploadedFile,
+  StreamableFile,
+} from "@nestjs/common";
+import { FileInterceptor } from "@nestjs/platform-express";
+import { AnexosFinanceiros, type ArquivoAnexo } from "./anexos.js";
+import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { AlertasFinanceiros } from "./alertas.js";
+import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+import { ConciliacaoFinanceira } from "./conciliacao.js";
+import { RotinasFinanceiras } from "./rotinas.js";
+import { dia, texto } from "./importacao.js";
+import { CorpoFinanceiroPipe } from "./corpo.pipe.js";
+@Controller("v1/financeiro")
+@UseGuards(ChaveServicoGuard)
+export class FinanceiroController {
+  constructor(
+    @Inject(AlertasFinanceiros) private readonly alertas: AlertasFinanceiros,
+    @Inject(RepositorioFinanceiroPg) private readonly repo: RepositorioFinanceiroPg,
+    @Inject(RotinasFinanceiras) private readonly rotinas: RotinasFinanceiras,
+    @Inject(AnexosFinanceiros) private readonly anexos: AnexosFinanceiros,
+  ) {}
+  @Get("alertas") listar(@Query("estado") estado?: string, @Query("tipo") tipo?: string) {
+    return this.alertas.listar(estado, tipo);
+  }
+  @Post("alertas/:id/resolver") resolver(@Param("id") id: string) {
+    return this.alertas.encerrar(id, "resolvido");
+  }
+  @Post("alertas/:id/ignorar") ignorar(@Param("id") id: string) {
+    return this.alertas.encerrar(id, "ignorado");
+  }
+  @Get("cadastros") cadastros() {
+    return this.repo.cadastros();
+  }
+  @Post("cadastros/:tipo") cadastro(
+    @Param("tipo") tipo: string,
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.cadastro(tipo, p);
+  }
+  @Get("contas-pagar") contasPagar(@Query() f: Record<string, unknown>) {
+    return this.repo.pagarContas(f);
+  }
+  @Post("contas-recorrentes")
+  recorrente(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
+    return this.repo.criarRecorrente(p);
+  }
+  @Post("contas-pagar") despesa(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
+    return this.repo.criarDespesa(p);
+  }
+  @Post("contas-pagar/:id/pagar") pagar(
+    @Param("id") id: string,
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.pagar(id, p);
+  }
+  @Post("contas-pagar/:id/cancelar") cancelar(@Param("id") id: string) {
+    return this.repo.cancelar(id);
+  }
+  @Post("contas-pagar/:id/anexos")
+  @UseInterceptors(
+    FileInterceptor("arquivo", { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }),
+  )
+  anexo(@Param("id") id: string, @UploadedFile() arquivo: ArquivoAnexo) {
+    return this.anexos.enviar(id, arquivo);
+  }
+  @Get("anexos/:id") async baixarAnexo(@Param("id") id: string) {
+    const a = await this.anexos.baixar(id);
+    return new StreamableFile(a.corpo, {
+      type: a.tipo,
+      disposition: "attachment; filename*=UTF-8''" + encodeURIComponent(a.nome),
+    });
+  }
+  @Post("despesas/importar") importarDespesas(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.importarDespesas(texto(p["conteudo"], 1024 * 1024), p["confirmar"] === true);
+  }
+  @Get("movimentacoes") movimentacoes(
+    @Query("de") de = "2000-01-01",
+    @Query("ate") ate = "2100-12-31",
+    @Query("conta") conta?: string,
+  ) {
+    return this.repo.movimentacoes(de, ate, conta);
+  }
+  @Post("transferencias") transferencia(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.transferencia(p);
+  }
+  @Post("saques-hotmart") saque(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
+    return this.repo.transferencia(p, true);
+  }
+  @Post("saldos-informados") saldo(@Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>) {
+    return this.repo.saldoInformado(p);
+  }
+  @Get("contas-receber") receber() {
+    return this.repo.receber();
+  }
+  @Post("contas-receber") receberManual(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.receberManual(p);
+  }
+  @Post("extratos/importar") importarExtrato(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.repo.importarExtrato(p);
+  }
+  @Get("extratos/itens") itensExtrato() {
+    return this.repo.itensExtrato();
+  }
+  @Get("conciliacoes") conciliacoes() {
+    return new ConciliacaoFinanceira(this.repo).listar();
+  }
+  @Post("conciliacoes") conciliacaoManual(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return new ConciliacaoFinanceira(this.repo).manual(p);
+  }
+  @Post("conciliacoes/:id/:acao") conciliar(@Param("id") id: string, @Param("acao") acao: string) {
+    return new ConciliacaoFinanceira(this.repo).agir(id, acao);
+  }
+  @Post("vendas/importar-historico") historico(
+    @Body(new CorpoFinanceiroPipe()) p: Record<string, unknown>,
+  ) {
+    return this.rotinas.importarHistorico(p);
+  }
+  @Get("vendas") async vendas(@Query() f: Record<string, unknown>) {
+    const de = dia(f["de"] ?? "2000-01-01"),
+      ate = dia(f["ate"] ?? "2100-12-31"),
+      moeda = f["moeda"] ?? "BRL";
+    if (typeof moeda !== "string" || !/^[A-Z]{3}$/.test(moeda))
+      throw new BadRequestException("moeda invalida");
+    return (
+      await this.repo.pool.query<Record<string, unknown>>(
+        `SELECT transacao,produto_id,produto_nome,comprador_id,status,grupo,oferta_codigo,
+      pedido_em,valor_centavos,desconto_centavos,taxa_centavos,comissoes_centavos,liquido_centavos,parcelas,moeda
+      FROM financeiro.vendas WHERE pedido_em>=($1::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
+      AND pedido_em<(($2::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AND moeda=$3
+      AND ($4::text IS NULL OR produto_id=$4) AND ($5::text IS NULL OR status=$5 OR grupo=$5)
+      AND ($6::text IS NULL OR comprador_id LIKE $6||'%') ORDER BY pedido_em DESC,transacao LIMIT 500`,
+        [de, ate, moeda, f["produto"] ?? null, f["status"] ?? null, f["comprador"] ?? null],
+      )
+    ).rows;
+  }
+  @Get("vendas/:transacao") async venda(@Param("transacao") transacao: string) {
+    texto(transacao, 100);
+    const [vendas, eventos, comissoes] = await Promise.all([
+      this.repo.pool.query<Record<string, unknown>>(
+        "SELECT * FROM financeiro.vendas WHERE transacao=$1",
+        [transacao],
+      ),
+      this.repo.pool.query<Record<string, unknown>>(
+        "SELECT * FROM financeiro.vendas_eventos WHERE transacao=$1 ORDER BY id",
+        [transacao],
+      ),
+      this.repo.pool.query<Record<string, unknown>>(
+        "SELECT tipo,moeda,valor_centavos FROM financeiro.vendas_comissoes WHERE transacao=$1",
+        [transacao],
+      ),
+    ]);
+    return { venda: vendas.rows[0] ?? null, eventos: eventos.rows, comissoes: comissoes.rows };
+  }
+}
diff --git a/apps/api/src/financeiro/financeiro.http.test.ts b/apps/api/src/financeiro/financeiro.http.test.ts
new file mode 100644
index 0000000..c5fa3e6
--- /dev/null
+++ b/apps/api/src/financeiro/financeiro.http.test.ts
@@ -0,0 +1,63 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { NestFactory } from "@nestjs/core";
+import { Secret, loadVendasConfig } from "@nucleos/config";
+import type { Pool } from "pg";
+import { AppModule } from "../app.module.js";
+import { MotorFuncionarios } from "../funcionarios/motor.js";
+import { RegistroHandlers } from "../funcionarios/handlers.js";
+import { FinanceiroModule } from "./financeiro.module.js";
+test("rotas financeiras exigem chave e validam corpo sem consultar PostgreSQL", async () => {
+  let consultas = 0;
+  const pool = {
+    query: () => {
+      consultas++;
+      throw new Error("consulta inesperada");
+    },
+  } as unknown as Pool;
+  const motor = new MotorFuncionarios(pool, new RegistroHandlers());
+  const app = await NestFactory.create(
+    AppModule.comModulos([
+      FinanceiroModule.registrar(
+        motor,
+        new Secret("chave-ficticia"),
+        { webhookHottok: undefined, anexos: undefined },
+        loadVendasConfig({}),
+      ),
+    ]),
+    { logger: false },
+  );
+  await app.listen(0, "127.0.0.1");
+  try {
+    const base = await app.getUrl();
+    assert.equal((await fetch(base + "/v1/financeiro/contas-pagar")).status, 401);
+    const r = await fetch(base + "/v1/financeiro/contas-pagar", {
+      method: "POST",
+      headers: { authorization: "Bearer chave-ficticia", "content-type": "application/json" },
+      body: "[]",
+    });
+    assert.equal(r.status, 400);
+    assert.equal(
+      (
+        await fetch(base + "/v1/financeiro/contas-pagar?de=2026-99-99", {
+          headers: { authorization: "Bearer chave-ficticia" },
+        })
+      ).status,
+      400,
+    );
+    assert.equal(
+      (
+        await fetch(base + "/v1/webhooks/hotmart", {
+          method: "POST",
+          headers: { "content-type": "application/json" },
+          body: "{}",
+        })
+      ).status,
+      503,
+    );
+    assert.equal(consultas, 0);
+  } finally {
+    await app.close();
+  }
+});
diff --git a/apps/api/src/financeiro/financeiro.module.ts b/apps/api/src/financeiro/financeiro.module.ts
new file mode 100644
index 0000000..fb22a94
--- /dev/null
+++ b/apps/api/src/financeiro/financeiro.module.ts
@@ -0,0 +1,45 @@
+import { Module, type DynamicModule } from "@nestjs/common";
+import {
+  loadFinanceiroConfig,
+  loadVendasConfig,
+  type FinanceiroConfig,
+  type VendasConfig,
+  type Secret,
+} from "@nucleos/config";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { AlertasFinanceiros } from "./alertas.js";
+import { FinanceiroController } from "./financeiro.controller.js";
+import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+import { RotinasFinanceiras } from "./rotinas.js";
+import { ReceptorHotmart, RECEPTOR_HOTMART, WebhookHotmartController } from "./webhook.js";
+import { AnexosFinanceiros } from "./anexos.js";
+@Module({})
+export class FinanceiroModule {
+  static registrar(
+    motor: MotorFuncionarios,
+    apiKey: Secret | undefined,
+    config: FinanceiroConfig = loadFinanceiroConfig(),
+    vendas: VendasConfig = loadVendasConfig(),
+  ): DynamicModule {
+    const alertas = new AlertasFinanceiros(motor.pool, motor);
+    const repo = new RepositorioFinanceiroPg(motor.pool, motor, alertas);
+    const rotinas = new RotinasFinanceiras(repo, vendas);
+    return {
+      module: FinanceiroModule,
+      controllers: [FinanceiroController, WebhookHotmartController],
+      providers: [
+        ChaveServicoGuard,
+        { provide: CHAVE_SERVICO, useValue: apiKey },
+        { provide: AlertasFinanceiros, useValue: alertas },
+        { provide: RepositorioFinanceiroPg, useValue: repo },
+        { provide: RotinasFinanceiras, useValue: rotinas },
+        {
+          provide: RECEPTOR_HOTMART,
+          useValue: new ReceptorHotmart(motor.pool, motor, config.webhookHottok),
+        },
+        { provide: AnexosFinanceiros, useValue: new AnexosFinanceiros(motor.pool, config.anexos) },
+      ],
+    };
+  }
+}
diff --git a/apps/api/src/financeiro/financeiro.pg.test.ts b/apps/api/src/financeiro/financeiro.pg.test.ts
new file mode 100644
index 0000000..a7b1488
--- /dev/null
+++ b/apps/api/src/financeiro/financeiro.pg.test.ts
@@ -0,0 +1,208 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import { randomBytes } from "node:crypto";
+import { before, after, describe, test } from "node:test";
+import { Pool } from "pg";
+import { migrar, lerMigracoes } from "../migrar.js";
+import { RegistroHandlers } from "../funcionarios/handlers.js";
+import { MotorFuncionarios } from "../funcionarios/motor.js";
+import { AlertasFinanceiros } from "./alertas.js";
+import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+import { ConciliacaoFinanceira } from "./conciliacao.js";
+const url = process.env["TEST_DATABASE_URL"];
+describe("Base financeira PostgreSQL", { skip: url === undefined }, () => {
+  let pool: Pool, admin: Pool, alertas: AlertasFinanceiros;
+  const banco = `nucleos_fin_teste_${randomBytes(5).toString("hex")}`;
+  before(async () => {
+    const u = new URL(url as string);
+    assert.equal(u.hostname, "127.0.0.1");
+    assert.equal(u.port, "15432");
+    admin = new Pool({ connectionString: u.toString() });
+    await admin.query(`CREATE DATABASE ${banco}`);
+    u.pathname = `/${banco}`;
+    pool = new Pool({ connectionString: u.toString() });
+    pool.on("error", () => undefined);
+    await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
+    alertas = new AlertasFinanceiros(pool, new MotorFuncionarios(pool, new RegistroHandlers()));
+  });
+  after(async () => {
+    await pool.end();
+    await admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
+    await admin.end();
+  });
+  test("alerta concorrente deduplica e publica um evento; encerrado permite nova ocorrencia", async () => {
+    const dados = {
+      tipo: "conta_vencida" as const,
+      chave: "conta:1",
+      referenciaTabela: "contas_pagar",
+      referenciaId: "1",
+    };
+    const ids = await Promise.all([alertas.criar(dados), alertas.criar(dados)]);
+    assert.equal(ids.filter(Boolean).length, 1);
+    assert.equal(
+      (
+        await pool.query<{ n: number }>(
+          "SELECT count(*)::int n FROM funcionarios.eventos WHERE tipo='financeiro.alerta.criado'",
+        )
+      ).rows[0]?.n,
+      1,
+    );
+    await alertas.encerrar(ids.find((id): id is string => id !== null) as string, "resolvido");
+    assert.ok(await alertas.criar(dados));
+    assert.equal((await alertas.listar()).length, 1);
+  });
+  test("rollback do chamador remove alerta e evento", async () => {
+    const c = await pool.connect();
+    try {
+      await c.query("BEGIN");
+      const id = await alertas.criar(
+        { tipo: "anomalia", chave: "rollback", referenciaTabela: "vendas", referenciaId: "1" },
+        c,
+      );
+      await c.query("ROLLBACK");
+      assert.equal(
+        (await pool.query("SELECT id FROM financeiro.alertas WHERE id=$1", [id])).rowCount,
+        0,
+      );
+    } finally {
+      c.release();
+    }
+  });
+  test("parcelas preservam total e pagamento concorrente produz uma unica saida", async () => {
+    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
+    const resultado = (await repo.criarDespesa({
+      descricao: "Parcelada PG",
+      categoria: "Serviços",
+      valorCentavos: "10001",
+      vencimento: "2026-11-30",
+      parcelas: 3,
+    })) as { ids: string[] };
+    const linhas = await pool.query<{ valor_centavos: string }>(
+      "SELECT valor_centavos FROM financeiro.contas_pagar WHERE id=ANY($1::bigint[]) ORDER BY parcela",
+      [resultado.ids],
+    );
+    assert.deepEqual(
+      linhas.rows.map((v) => v.valor_centavos),
+      ["3334", "3334", "3333"],
+    );
+    const cid = resultado.ids[0];
+    assert.ok(cid);
+    const pagos = await Promise.allSettled([
+      repo.pagar(cid, { data: "2026-11-30", contaFinanceiraId: "1" }),
+      repo.pagar(cid, { data: "2026-11-30", contaFinanceiraId: "1" }),
+    ]);
+    assert.equal(pagos.filter((p) => p.status === "fulfilled").length, 1);
+    assert.equal(
+      (await pool.query("SELECT id FROM financeiro.lancamentos WHERE conta_pagar_id=$1", [cid]))
+        .rowCount,
+      1,
+    );
+  });
+  test("transferencia e extrato mantem atomicidade e idempotencia", async () => {
+    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
+    const t = (await repo.transferencia({
+      origemId: "1",
+      destinoId: "2",
+      data: "2026-11-03",
+      valorCentavos: "10000",
+    })) as { id: string };
+    const r = await pool.query<{ n: number; saldo: string }>(
+      "SELECT count(*)::int n,sum(CASE WHEN tipo='entrada' THEN valor_centavos ELSE -valor_centavos END)::text saldo FROM financeiro.lancamentos WHERE transferencia_id=$1",
+      [t.id],
+    );
+    assert.deepEqual(r.rows[0], { n: 2, saldo: "0" });
+    const p = {
+      contaFinanceiraId: "1",
+      formato: "csv",
+      conteudo: "data;valor;fitid;memo\n2026-11-03;100,00;FIT-PG;Entrada",
+    };
+    await repo.importarExtrato(p);
+    await repo.importarExtrato(p);
+    assert.equal(
+      (await pool.query("SELECT id FROM financeiro.extrato_itens WHERE fitid='FIT-PG'")).rowCount,
+      1,
+    );
+  });
+  test("recorrencia idempotente respeita periodicidade anual e pagamento legado vincula conta", async () => {
+    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas);
+    const atual = await pool.query<{ mes: string }>(
+      "SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM') mes",
+    );
+    const mes = atual.rows[0]?.mes;
+    assert.ok(mes);
+    const recorrente = (await repo.criarRecorrente({
+      descricao: "Recorrente PG",
+      categoria: "Serviços",
+      valorCentavos: "9900",
+      diaVencimento: 31,
+      inicio: mes + "-01",
+      periodicidade: "anual",
+    })) as { id: string };
+    await repo.transacao((c) => repo.gerarRecorrencias(c));
+    assert.equal(
+      (
+        await pool.query("SELECT id FROM financeiro.contas_pagar WHERE conta_recorrente_id=$1", [
+          recorrente.id,
+        ])
+      ).rowCount,
+      1,
+    );
+    const l = await pool.query<{ conta_pagar_id: string }>(
+      "INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_recorrente_id,competencia) VALUES('saida','Legado PG','Serviços',9900,$1,$2,$1) RETURNING conta_pagar_id",
+      [mes + "-01", recorrente.id],
+    );
+    const pagamento = l.rows[0];
+    assert.ok(pagamento);
+    assert.ok(pagamento.conta_pagar_id);
+    assert.equal(
+      (
+        await pool.query<{ status: string }>(
+          "SELECT status FROM financeiro.contas_pagar WHERE id=$1",
+          [pagamento.conta_pagar_id],
+        )
+      ).rows[0]?.status,
+      "paga",
+    );
+  });
+  test("conciliacao ambigua exige escolha e aceita um extrato uma unica vez", async () => {
+    const repo = new RepositorioFinanceiroPg(pool, alertas.motor, alertas),
+      conciliacao = new ConciliacaoFinanceira(repo);
+    const saque = (await repo.transferencia(
+      { destinoId: "1", data: "2026-11-03", valorCentavos: "20200", taxaCentavos: "200" },
+      true,
+    )) as { id: string };
+    assert.ok(saque.id);
+    await repo.importarExtrato({
+      contaFinanceiraId: "1",
+      formato: "csv",
+      conteudo:
+        "data;valor;fitid;memo\n2026-11-03;200,00;AMB1;Entrada\n2026-11-03;200,00;AMB2;Entrada",
+    });
+    await repo.transacao((c) => conciliacao.sugerir(c));
+    const origem = await pool.query<{ id: string }>(
+      "SELECT id FROM financeiro.saques_hotmart WHERE transferencia_id=$1",
+      [saque.id],
+    );
+    const sid = origem.rows[0]?.id;
+    assert.ok(sid);
+    const sugestao = await pool.query<{ id: string; estado: string }>(
+      "SELECT id,estado FROM financeiro.conciliacoes WHERE chave=$1",
+      ["saque:" + sid],
+    );
+    assert.equal(sugestao.rows[0]?.estado, "pendente_analise");
+    const eid = (
+      await pool.query<{ id: string }>("SELECT id FROM financeiro.extrato_itens WHERE fitid='AMB1'")
+    ).rows[0]?.id;
+    assert.ok(eid);
+    const itens = [
+      { tipo: "saque", referenciaId: sid, valorCentavos: "20000" },
+      { tipo: "extrato_item", referenciaId: eid, valorCentavos: "20000" },
+    ];
+    const manual = (await conciliacao.manual({ itens })) as { id: string };
+    await conciliacao.agir(manual.id, "aceitar");
+    const outra = (await conciliacao.manual({ itens })) as { id: string };
+    await assert.rejects(conciliacao.agir(outra.id, "aceitar"));
+    await conciliacao.agir(manual.id, "desfazer");
+    await conciliacao.agir(outra.id, "aceitar");
+  });
+});
diff --git a/apps/api/src/financeiro/hotmart-financeiro.test.ts b/apps/api/src/financeiro/hotmart-financeiro.test.ts
new file mode 100644
index 0000000..4ce56ad
--- /dev/null
+++ b/apps/api/src/financeiro/hotmart-financeiro.test.ts
@@ -0,0 +1,69 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import { HotmartClient, normalizarVenda } from "../vendas/hotmart-client.js";
+const item = {
+  purchase: {
+    transaction: "T1",
+    order_date: 1793650000000,
+    status: "APPROVED",
+    price: { value: "100.00", currency_code: "BRL" },
+    hotmart_fee: { total: "10.00" },
+    tracking: { source_sck: "campanha-1" },
+  },
+};
+test("enriquecimento consulta fontes oficiais, conserva preco efetivo e remove identidade", async () => {
+  const urls: string[] = [];
+  const cliente = new HotmartClient({
+    env: "sandbox",
+    credenciais: { clientId: new Secret("id-teste"), clientSecret: new Secret("secret-teste") },
+    fetch: async (input, init) => {
+      const url = input instanceof Request ? input.url : input.toString();
+      urls.push(url);
+      if (url.includes("/oauth/token"))
+        return Response.json({ access_token: "token-ficticio", expires_in: 3600 });
+      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token-ficticio");
+      if (url.includes("/commissions"))
+        return Response.json({
+          items: [
+            {
+              source: "PRODUCER",
+              commission: { value: "70.00", currency_value: "BRL" },
+              user: { name: "Descartar" },
+            },
+            {
+              source: "AFFILIATE",
+              commission: { value: "20.00", currency_value: "BRL" },
+              user: { email: "descartar@example.invalid" },
+            },
+          ],
+        });
+      return Response.json({ items: [{ coupon: { value: 22.9 } }] });
+    },
+  });
+  const v = normalizarVenda(item, "pseudo");
+  assert.ok(v);
+  const enriquecida = await cliente.enriquecer(v);
+  assert.equal(enriquecida.valorCentavos, 10000);
+  assert.equal(enriquecida.descontoCentavos, null);
+  assert.equal(enriquecida.comissoesCentavos, 2000);
+  assert.equal(enriquecida.rastreioSck, "campanha-1");
+  assert.equal(JSON.stringify(enriquecida).includes("descartar"), false);
+  assert.equal(urls.filter((u) => u.includes("/commissions")).length, 1);
+  assert.equal(urls.filter((u) => u.includes("/price/details")).length, 1);
+});
+test("comissao em moeda divergente falha sem misturar valores", async () => {
+  const cliente = new HotmartClient({
+    env: "sandbox",
+    credenciais: { clientId: new Secret("id-teste"), clientSecret: new Secret("secret-teste") },
+    fetch: async (input) =>
+      (input instanceof Request ? input.url : input.toString()).includes("/oauth/token")
+        ? Response.json({ access_token: "token-ficticio", expires_in: 3600 })
+        : Response.json({
+            items: [{ source: "AFFILIATE", commission: { value: 1, currency_value: "USD" } }],
+          }),
+  });
+  const v = normalizarVenda(item, "pseudo");
+  assert.ok(v);
+  await assert.rejects(cliente.enriquecer(v), /hotmart: resposta/);
+});
diff --git a/apps/api/src/financeiro/importacao.test.ts b/apps/api/src/financeiro/importacao.test.ts
new file mode 100644
index 0000000..bdaeb85
--- /dev/null
+++ b/apps/api/src/financeiro/importacao.test.ts
@@ -0,0 +1,39 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { BadRequestException } from "@nestjs/common";
+import { csv, decimal, dia, extrato, centavos } from "./importacao.js";
+test("dinheiro decimal nao perde centavos e nao aceita fracao oculta", () => {
+  assert.equal(decimal("999999999999.99"), "99999999999999");
+  assert.equal(decimal("-0,01"), "-1");
+  assert.throws(() => decimal("1.005"), BadRequestException);
+  assert.throws(() => centavos("0"), BadRequestException);
+  assert.throws(() => centavos("10.1"), BadRequestException);
+});
+test("datas invalidas sao recusadas com erro de entrada", () => {
+  for (const d of ["2026-02-29", "2026-99-01", "abc"])
+    assert.throws(() => dia(d), BadRequestException);
+  assert.equal(dia("2028-02-29"), "2028-02-29");
+});
+test("CSV preserva aspas, ponto e virgula e quebra de linha dentro do campo", () => {
+  assert.deepEqual(
+    csv('data;descricao\n2026-11-03;"Serviço; "online"\nmensal"'.replace('"online"', '""online""')),
+    [
+      ["data", "descricao"],
+      ["2026-11-03", 'Serviço; "online"\nmensal'],
+    ],
+  );
+  assert.throws(() => csv('a;"aberto'), BadRequestException);
+});
+test("OFX e CSV normalizam sinais e identificadores sem arredondamento", () => {
+  const a = extrato(
+    "<OFX><STMTTRN><DTPOSTED>20261103120000[-3:BRT]<TRNAMT>-123.45<FITID>abc<MEMO>Pagamento</STMTTRN></OFX>",
+    "ofx",
+  );
+  assert.deepEqual(a, [
+    { data: "2026-11-03", valorCentavos: "-12345", fitid: "abc", memo: "Pagamento" },
+  ]);
+  assert.deepEqual(extrato("data;valor;fitid;memo\n2026-11-03;123,45;abc;Entrada", "csv"), [
+    { data: "2026-11-03", valorCentavos: "12345", fitid: "abc", memo: "Entrada" },
+  ]);
+  assert.throws(() => extrato("data;valor;fitid;memo\n2026-11-03;NaN;abc;Entrada", "csv"));
+});
diff --git a/apps/api/src/financeiro/importacao.ts b/apps/api/src/financeiro/importacao.ts
new file mode 100644
index 0000000..b12ac9f
--- /dev/null
+++ b/apps/api/src/financeiro/importacao.ts
@@ -0,0 +1,108 @@
+import { createHash } from "node:crypto";
+import { BadRequestException } from "@nestjs/common";
+
+export const hash = (texto: string): string => createHash("sha256").update(texto).digest("hex");
+export function dia(valor: unknown): string {
+  if (
+    typeof valor !== "string" ||
+    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
+    !Number.isFinite(new Date(valor + "T12:00:00Z").getTime()) ||
+    new Date(valor + "T12:00:00Z").toISOString().slice(0, 10) !== valor
+  )
+    throw new BadRequestException("data invalida");
+  return valor;
+}
+export function texto(valor: unknown, max = 120): string {
+  if (typeof valor !== "string" || !valor.trim() || valor.length > max)
+    throw new BadRequestException("texto invalido");
+  return valor.trim();
+}
+export function id(valor: unknown): string {
+  if (typeof valor !== "string" || !/^[1-9]\d{0,17}$/.test(valor))
+    throw new BadRequestException("id invalido");
+  return valor;
+}
+export function centavos(valor: unknown, permitirNegativo = false): string {
+  if (
+    typeof valor !== "string" ||
+    !(permitirNegativo ? /^-?\d{1,14}$/ : /^\d{1,14}$/).test(valor) ||
+    BigInt(valor) === 0n
+  )
+    throw new BadRequestException("valor em centavos invalido");
+  return BigInt(valor).toString();
+}
+export function decimal(valor: string): string {
+  if (!/^-?\d{1,12}[.,]\d{2}$/.test(valor.trim()))
+    throw new BadRequestException("decimal invalido");
+  return BigInt(valor.trim().replace(/[.,]/, "")).toString();
+}
+/** RFC-style quoting with semicolon separator. No silent truncation of malformed input. */
+export function csv(conteudo: string): string[][] {
+  if (Buffer.byteLength(conteudo) > 1024 * 1024)
+    throw new BadRequestException("arquivo excede 1 MB");
+  const linhas: string[][] = [],
+    atual: string[] = [];
+  let campo = "",
+    aspas = false;
+  for (let i = 0; i < conteudo.length; i++) {
+    const c = conteudo[i];
+    if (c === '"') {
+      if (aspas && conteudo[i + 1] === '"') {
+        campo += '"';
+        i++;
+      } else aspas = !aspas;
+    } else if (!aspas && (c === ";" || c === "\n")) {
+      atual.push(campo.replace(/\r$/, ""));
+      campo = "";
+      if (c === "\n") {
+        if (atual.some(Boolean)) linhas.push([...atual]);
+        atual.length = 0;
+      }
+    } else campo += c ?? "";
+  }
+  if (aspas) throw new BadRequestException("aspas CSV invalidas");
+  atual.push(campo.replace(/\r$/, ""));
+  if (atual.some(Boolean)) linhas.push(atual);
+  if (linhas.length > 2001) throw new BadRequestException("limite de 2000 linhas");
+  return linhas;
+}
+export interface ItemExtrato {
+  fitid: string;
+  data: string;
+  valorCentavos: string;
+  memo: string;
+}
+export function extrato(conteudo: string, formato: "ofx" | "csv"): ItemExtrato[] {
+  if (Buffer.byteLength(conteudo) > 1024 * 1024)
+    throw new BadRequestException("arquivo excede 1 MB");
+  if (formato === "csv") {
+    const linhas = csv(conteudo);
+    if (
+      linhas
+        .shift()
+        ?.join(";")
+        .replace(/^\uFEFF/, "") !== "data;valor;fitid;memo"
+    )
+      throw new BadRequestException("cabecalho CSV invalido");
+    return linhas.map((l) => ({
+      data: dia(l[0]),
+      valorCentavos: decimal(l[1] ?? ""),
+      fitid: l[2] ? texto(l[2], 200) : hash(l.join(";")),
+      memo: (l[3] ?? "").slice(0, 240),
+    }));
+  }
+  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
+  if (!blocos.length || blocos.length > 2000)
+    throw new BadRequestException("OFX sem transacoes ou excedido");
+  return blocos.map((b) => {
+    const campo = (tag: string): string =>
+      new RegExp("<" + tag + ">([^<\r\n]*)", "i").exec(b)?.[1]?.trim() ?? "";
+    const d = campo("DTPOSTED").slice(0, 8);
+    return {
+      fitid: texto(campo("FITID"), 200),
+      data: dia(d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)),
+      valorCentavos: decimal(campo("TRNAMT")),
+      memo: campo("MEMO").slice(0, 240),
+    };
+  });
+}
diff --git a/apps/api/src/financeiro/repositorio-pg.ts b/apps/api/src/financeiro/repositorio-pg.ts
new file mode 100644
index 0000000..06a42e4
--- /dev/null
+++ b/apps/api/src/financeiro/repositorio-pg.ts
@@ -0,0 +1,516 @@
+import { randomUUID } from "node:crypto";
+import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
+import type { Pool, PoolClient } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+import type { AlertasFinanceiros } from "./alertas.js";
+import { centavos, csv, dia, decimal, extrato, hash, id, texto } from "./importacao.js";
+type Objeto = Record<string, unknown>;
+const opcionalId = (v: unknown): string | null =>
+  v === undefined || v === null || v === "" ? null : id(v);
+export class RepositorioFinanceiroPg {
+  constructor(
+    readonly pool: Pool,
+    readonly motor: MotorFuncionarios,
+    readonly alertas: AlertasFinanceiros,
+  ) {}
+  async transacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      const r = await fn(c);
+      await c.query("COMMIT");
+      return r;
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    } finally {
+      c.release();
+    }
+  }
+  async mudou(c: PoolClient): Promise<void> {
+    await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
+  }
+  async cadastros(): Promise<Objeto> {
+    const [fornecedores, centros, categorias, contas, regras] = await Promise.all([
+      this.pool.query(
+        "SELECT id,nome, CASE WHEN documento IS NULL THEN NULL ELSE '***' || right(documento,4) END documento,contato FROM financeiro.fornecedores ORDER BY nome",
+      ),
+      this.pool.query("SELECT * FROM financeiro.centros_custo ORDER BY nome"),
+      this.pool.query("SELECT * FROM financeiro.categorias ORDER BY tipo,nome"),
+      this.pool.query("SELECT * FROM financeiro.contas_financeiras ORDER BY nome"),
+      this.pool.query("SELECT * FROM financeiro.regras_liberacao ORDER BY pagamento"),
+    ]);
+    return {
+      fornecedores: fornecedores.rows,
+      centros: centros.rows,
+      categorias: categorias.rows,
+      contas: contas.rows,
+      regras: regras.rows,
+    };
+  }
+  async cadastro(tipo: string, p: Objeto): Promise<unknown> {
+    if (tipo === "fornecedores") {
+      const documento = p["documento"] ? texto(p["documento"], 18).replace(/\D/g, "") : null;
+      if (documento && ![11, 14].includes(documento.length))
+        throw new BadRequestException("documento invalido");
+      return (
+        await this.pool.query(
+          "INSERT INTO financeiro.fornecedores(nome,documento,contato) VALUES($1,$2,$3) RETURNING id",
+          [texto(p["nome"]), documento, p["contato"] ? texto(p["contato"], 120) : null],
+        )
+      ).rows[0];
+    }
+    if (tipo === "centros")
+      return (
+        await this.pool.query(
+          "INSERT INTO financeiro.centros_custo(nome) VALUES($1) RETURNING id",
+          [texto(p["nome"], 80)],
+        )
+      ).rows[0];
+    if (tipo === "contas") {
+      if (!["banco", "caixa", "plataforma"].includes(String(p["tipo"])))
+        throw new BadRequestException("tipo invalido");
+      return (
+        await this.pool.query(
+          "INSERT INTO financeiro.contas_financeiras(nome,tipo) VALUES($1,$2) RETURNING id",
+          [texto(p["nome"]), p["tipo"]],
+        )
+      ).rows[0];
+    }
+    if (tipo === "regras") {
+      const dias = Number(p["dias"]);
+      if (!Number.isInteger(dias) || dias < 0 || dias > 365)
+        throw new BadRequestException("prazo invalido");
+      await this.pool.query(
+        "INSERT INTO financeiro.regras_liberacao VALUES($1,$2) ON CONFLICT(pagamento) DO UPDATE SET dias=excluded.dias",
+        [texto(p["pagamento"], 40), dias],
+      );
+      return {};
+    }
+    throw new NotFoundException();
+  }
+  async pagarContas(f: Objeto = {}): Promise<Objeto> {
+    const de = dia(f["de"] ?? "2000-01-01"),
+      ate = dia(f["ate"] ?? "2100-12-31");
+    const status = f["status"] ?? null;
+    if (
+      status !== null &&
+      (typeof status !== "string" || !["aberta", "paga", "cancelada"].includes(status))
+    )
+      throw new BadRequestException("status invalido");
+    const p = [
+      de,
+      ate,
+      status,
+      f["categoria"] ?? null,
+      opcionalId(f["fornecedor"]),
+      opcionalId(f["centro"]),
+    ];
+    const onde =
+      "vencimento BETWEEN $1 AND $2 AND ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR categoria=$4) AND ($5::bigint IS NULL OR fornecedor_id=$5) AND ($6::bigint IS NULL OR centro_custo_id=$6)";
+    const [lista, totais] = await Promise.all([
+      this.pool.query(
+        "SELECT p.*,to_char(vencimento,'YYYY-MM-DD') vencimento,to_char(competencia,'YYYY-MM-DD') competencia,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nome',a.nome)),'[]') FROM financeiro.anexos a WHERE a.conta_pagar_id=p.id) anexos FROM financeiro.contas_pagar p WHERE " +
+          onde +
+          " ORDER BY vencimento,id LIMIT 500",
+        p,
+      ),
+      this.pool.query(
+        "SELECT categoria,status,sum(valor_centavos)::text total_centavos FROM financeiro.contas_pagar WHERE " +
+          onde +
+          " GROUP BY categoria,status ORDER BY categoria",
+        p,
+      ),
+    ]);
+    return { contas: lista.rows, totais: totais.rows };
+  }
+  async criarDespesa(p: Objeto, cliente?: PoolClient): Promise<unknown> {
+    const descricao = texto(p["descricao"]),
+      categoria = texto(p["categoria"], 60),
+      valor = centavos(p["valorCentavos"]);
+    const vencimento = dia(p["vencimento"]),
+      competencia = dia(p["competencia"] ?? vencimento);
+    const n = Number(p["parcelas"] ?? 1);
+    if (!Number.isInteger(n) || n < 1 || n > 120 || BigInt(valor) < BigInt(n))
+      throw new BadRequestException("parcelas invalidas");
+    const executar = async (c: PoolClient): Promise<unknown> => {
+      if (
+        !(
+          await c.query(
+            "SELECT id FROM financeiro.categorias WHERE tipo='saida' AND lower(nome)=lower($1)",
+            [categoria],
+          )
+        ).rowCount
+      )
+        throw new BadRequestException("categoria nao cadastrada");
+      const grupo = randomUUID(),
+        ids: string[] = [];
+      const base = BigInt(valor) / BigInt(n),
+        resto = BigInt(valor) % BigInt(n);
+      for (let parcela = 1; parcela <= n; parcela++) {
+        const r = await c.query<{ id: string }>(
+          `INSERT INTO financeiro.contas_pagar(descricao,categoria,fornecedor_id,centro_custo_id,valor_centavos,vencimento,competencia,parcela,parcelas,grupo_parcelamento,origem,importacao_hash)
+          VALUES($1,$2,$3,$4,$5,($6::date+make_interval(months=>$7))::date,($8::date+make_interval(months=>$7))::date,$9,$10,$11,$12,$13)
+          ON CONFLICT(importacao_hash) DO NOTHING RETURNING id`,
+          [
+            descricao,
+            categoria,
+            opcionalId(p["fornecedorId"]),
+            opcionalId(p["centroCustoId"]),
+            (base + (BigInt(parcela) <= resto ? 1n : 0n)).toString(),
+            vencimento,
+            parcela - 1,
+            competencia,
+            parcela,
+            n,
+            grupo,
+            p["importacaoHash"] ? "importacao" : "manual",
+            p["importacaoHash"] ?? null,
+          ],
+        );
+        if (r.rows[0]) ids.push(r.rows[0].id);
+      }
+      await this.mudou(c);
+      return { ids };
+    };
+    return cliente ? executar(cliente) : this.transacao(executar);
+  }
+  async pagar(contaId: string, p: Objeto): Promise<unknown> {
+    const conta = id(contaId),
+      data = dia(p["data"]),
+      financeira = id(p["contaFinanceiraId"]);
+    return this.transacao(async (c) => {
+      const r = await c.query<Objeto>(
+        "SELECT * FROM financeiro.contas_pagar WHERE id=$1 FOR UPDATE",
+        [conta],
+      );
+      const v = r.rows[0];
+      if (!v) throw new NotFoundException();
+      if (v["status"] !== "aberta") throw new ConflictException("conta nao esta aberta");
+      if (
+        !(
+          await c.query(
+            "SELECT id FROM financeiro.contas_financeiras WHERE id=$1 AND ativa FOR SHARE",
+            [financeira],
+          )
+        ).rowCount
+      )
+        throw new BadRequestException("conta financeira indisponivel");
+      await c.query(
+        `INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_pagar_id,conta_financeira_id,centro_custo_id,conta_recorrente_id,competencia)
+        VALUES('saida',$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
+        [
+          v["descricao"],
+          v["categoria"],
+          v["valor_centavos"],
+          data,
+          conta,
+          financeira,
+          v["centro_custo_id"],
+          v["conta_recorrente_id"],
+          v["conta_recorrente_id"] ? v["competencia"] : null,
+        ],
+      );
+      await c.query("UPDATE financeiro.contas_pagar SET status='paga' WHERE id=$1", [conta]);
+      await this.mudou(c);
+      return {};
+    });
+  }
+  async cancelar(contaId: string): Promise<void> {
+    const r = await this.pool.query(
+      "UPDATE financeiro.contas_pagar SET status='cancelada' WHERE id=$1 AND status='aberta' RETURNING id",
+      [id(contaId)],
+    );
+    if (!r.rowCount) throw new ConflictException("conta nao esta aberta");
+  }
+  async gerarRecorrencias(c: PoolClient): Promise<number> {
+    const r =
+      await c.query(`INSERT INTO financeiro.contas_pagar(descricao,categoria,fornecedor_id,centro_custo_id,valor_centavos,vencimento,competencia,origem,conta_recorrente_id)
+      SELECT r.descricao,r.categoria,r.fornecedor_id,r.centro_custo_id,r.valor_centavos,
+      (m.mes + (least(r.dia_vencimento,extract(day FROM m.mes+interval '1 month -1 day')::int)-1)*interval '1 day')::date,
+      m.mes,'recorrente',r.id FROM financeiro.contas_recorrentes r
+      CROSS JOIN LATERAL (SELECT s::date mes FROM generate_series(date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo'),date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')+interval '2 months',interval '1 month') s) m
+      WHERE m.mes>=r.inicio AND (r.fim IS NULL OR m.mes<=r.fim)
+      AND (r.periodicidade='mensal' OR extract(month FROM m.mes)=extract(month FROM r.inicio))
+      ON CONFLICT(conta_recorrente_id,competencia) DO NOTHING`);
+    await this.mudou(c);
+    return r.rowCount ?? 0;
+  }
+  async criarRecorrente(p: Objeto): Promise<unknown> {
+    const periodicidade = p["periodicidade"] ?? "mensal",
+      vencimento = Number(p["diaVencimento"]);
+    if (
+      typeof periodicidade !== "string" ||
+      !["mensal", "anual"].includes(periodicidade) ||
+      !Number.isInteger(vencimento) ||
+      vencimento < 1 ||
+      vencimento > 31
+    )
+      throw new BadRequestException("recorrencia invalida");
+    const inicio = dia(p["inicio"]),
+      fim = p["fim"] ? dia(p["fim"]) : null;
+    if (!inicio.endsWith("-01") || (fim && (!fim.endsWith("-01") || fim < inicio)))
+      throw new BadRequestException("use primeiro dia do mes na vigencia");
+    return this.transacao(async (c) => {
+      const categoria = texto(p["categoria"], 60);
+      if (
+        !(
+          await c.query(
+            "SELECT id FROM financeiro.categorias WHERE tipo='saida' AND lower(nome)=lower($1)",
+            [categoria],
+          )
+        ).rowCount
+      )
+        throw new BadRequestException("categoria nao cadastrada");
+      const r = await c.query<{ id: string }>(
+        `INSERT INTO financeiro.contas_recorrentes(descricao,categoria,valor_centavos,dia_vencimento,inicio,fim,fornecedor_id,centro_custo_id,periodicidade) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
+        [
+          texto(p["descricao"]),
+          categoria,
+          centavos(p["valorCentavos"]),
+          vencimento,
+          inicio,
+          fim,
+          opcionalId(p["fornecedorId"]),
+          opcionalId(p["centroCustoId"]),
+          periodicidade,
+        ],
+      );
+      await this.gerarRecorrencias(c);
+      return r.rows[0];
+    });
+  }
+  async vencimentos(c: PoolClient): Promise<void> {
+    const r = await c.query<{
+      id: string;
+      vencida: boolean;
+    }>(`SELECT id,vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date vencida FROM financeiro.contas_pagar
+      WHERE status='aberta' AND vencimento<=(now() AT TIME ZONE 'America/Sao_Paulo')::date+3`);
+    for (const v of r.rows)
+      await this.alertas.criar(
+        {
+          tipo: v.vencida ? "conta_vencida" : "conta_vencendo",
+          chave: (v.vencida ? "vencida:" : "vencendo:") + v.id,
+          referenciaTabela: "contas_pagar",
+          referenciaId: v.id,
+        },
+        c,
+      );
+  }
+  previaDespesas(conteudo: string): {
+    linhas: Objeto[];
+    erros: { linha: number; mensagem: string }[];
+  } {
+    const linhas = csv(conteudo),
+      cabecalho = linhas
+        .shift()
+        ?.join(";")
+        .replace(/^\uFEFF/, "");
+    if (cabecalho !== "data;descricao;valor;categoria;fornecedor;centro_custo;vencimento")
+      throw new BadRequestException("cabecalho CSV invalido");
+    const validas: Objeto[] = [],
+      erros: { linha: number; mensagem: string }[] = [];
+    linhas.forEach((l, i) => {
+      try {
+        if (l.length !== 7) throw new Error();
+        validas.push({
+          competencia: dia(l[0]),
+          descricao: texto(l[1]),
+          valorCentavos: centavos(decimal(l[2] ?? "")),
+          categoria: texto(l[3], 60),
+          fornecedorId: opcionalId(l[4]),
+          centroCustoId: opcionalId(l[5]),
+          vencimento: dia(l[6]),
+          importacaoHash: hash(l.join(";")),
+        });
+      } catch {
+        erros.push({
+          linha: i + 2,
+          mensagem: "Linha invalida: confira datas, valor, categoria e ids.",
+        });
+      }
+    });
+    return { linhas: validas, erros };
+  }
+  async importarDespesas(conteudo: string, confirmar: boolean): Promise<unknown> {
+    const previa = this.previaDespesas(conteudo);
+    if (!confirmar) return previa;
+    if (previa.erros.length)
+      throw new BadRequestException("corrija as linhas invalidas antes de confirmar");
+    return this.transacao(async (c) => {
+      for (const p of previa.linhas) await this.criarDespesa(p, c);
+      return { processadas: previa.linhas.length };
+    });
+  }
+  async movimentacoes(de: string, ate: string, conta?: string): Promise<unknown> {
+    return (
+      await this.pool.query(
+        `SELECT *,to_char(data,'YYYY-MM-DD') data FROM financeiro.lancamentos
+      WHERE data BETWEEN $1 AND $2 AND ($3::bigint IS NULL OR conta_financeira_id=$3) ORDER BY data,id LIMIT 1000`,
+        [dia(de), dia(ate), opcionalId(conta)],
+      )
+    ).rows;
+  }
+  async transferencia(p: Objeto, saque = false): Promise<unknown> {
+    const origem = saque
+      ? (
+          await this.pool.query<{ id: string }>(
+            "SELECT id FROM financeiro.contas_financeiras WHERE nome='Hotmart'",
+          )
+        ).rows[0]?.id
+      : id(p["origemId"]);
+    const destino = id(p["destinoId"]),
+      data = dia(p["data"]),
+      valor = centavos(p["valorCentavos"]),
+      taxa = saque ? (typeof p["taxaCentavos"] === "string" ? p["taxaCentavos"] : "0") : "0";
+    if (!/^\d{1,14}$/.test(taxa) || BigInt(taxa) >= BigInt(valor) || origem === destino || !origem)
+      throw new BadRequestException("transferencia invalida");
+    return this.transacao(async (c) => {
+      const ativas = await c.query(
+        "SELECT id FROM financeiro.contas_financeiras WHERE id=ANY($1::bigint[]) AND ativa ORDER BY id FOR SHARE",
+        [[origem, destino]],
+      );
+      if (ativas.rowCount !== 2) throw new BadRequestException("conta indisponivel");
+      const transferencia = randomUUID(),
+        liquido = (BigInt(valor) - BigInt(taxa)).toString();
+      await c.query(
+        `INSERT INTO financeiro.lancamentos(tipo,descricao,categoria,valor_centavos,data,conta_financeira_id,transferencia_id)
+        VALUES('saida',$1,'Transferencia',$2,$3,$4,$6),('entrada',$1,'Transferencia',$5,$3,$7,$6)`,
+        [
+          saque ? "Saque Hotmart" : "Transferencia entre contas",
+          valor,
+          data,
+          origem,
+          liquido,
+          transferencia,
+          destino,
+        ],
+      );
+      if (saque)
+        await c.query(
+          "INSERT INTO financeiro.saques_hotmart(data,bruto_centavos,taxa_centavos,liquido_centavos,conta_destino_id,comprovante,transferencia_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
+          [
+            data,
+            valor,
+            taxa,
+            liquido,
+            destino,
+            p["comprovante"] ? texto(p["comprovante"], 200) : null,
+            transferencia,
+          ],
+        );
+      await this.mudou(c);
+      return { id: transferencia };
+    });
+  }
+  async saldoInformado(p: Objeto): Promise<unknown> {
+    const valor = String(p["valorCentavos"]);
+    if (!/^\d{1,14}$/.test(valor)) throw new BadRequestException("saldo invalido");
+    return (
+      await this.pool.query(
+        "INSERT INTO financeiro.saldos_informados(conta_financeira_id,data,valor_centavos) VALUES($1,$2,$3) RETURNING id",
+        [id(p["contaFinanceiraId"]), dia(p["data"]), valor],
+      )
+    ).rows[0];
+  }
+  async previsoes(c: PoolClient): Promise<void> {
+    await c.query(`INSERT INTO financeiro.contas_receber(origem,transacao,descricao,valor_centavos,previsto_em,conta_financeira_id)
+      SELECT 'hotmart',v.transacao,'Recebimento Hotmart',v.liquido_centavos,
+      (v.aprovado_em AT TIME ZONE 'America/Sao_Paulo')::date+r.dias,f.id
+      FROM financeiro.vendas v JOIN financeiro.contas_financeiras f ON f.nome='Hotmart'
+      LEFT JOIN financeiro.regras_liberacao r ON r.pagamento=v.pagamento
+      WHERE v.grupo='receita' AND v.moeda='BRL' AND v.liquido_centavos>0
+      ON CONFLICT(transacao) DO UPDATE SET valor_centavos=excluded.valor_centavos,
+      previsto_em=excluded.previsto_em WHERE financeiro.contas_receber.status='estimado'`);
+    await c.query(
+      "UPDATE financeiro.contas_receber r SET status='cancelado' FROM financeiro.vendas v WHERE v.transacao=r.transacao AND v.grupo<>'receita' AND r.status='estimado'",
+    );
+  }
+  async atrasados(c: PoolClient): Promise<void> {
+    const r = await c.query<{ id: string }>(
+      "SELECT id FROM financeiro.contas_receber WHERE status='estimado' AND previsto_em<(now() AT TIME ZONE 'America/Sao_Paulo')::date",
+    );
+    for (const v of r.rows)
+      await this.alertas.criar(
+        {
+          tipo: "recebimento_atrasado",
+          chave: "receber:" + v.id,
+          referenciaTabela: "contas_receber",
+          referenciaId: v.id,
+        },
+        c,
+      );
+  }
+  async receber(): Promise<Objeto> {
+    const [vendido, receber, disponivel, recebido] = await Promise.all([
+      this.pool.query(
+        "SELECT moeda,sum(valor_centavos)::text valor_centavos FROM financeiro.vendas WHERE grupo='receita' GROUP BY moeda",
+      ),
+      this.pool.query(
+        "SELECT *,to_char(previsto_em,'YYYY-MM-DD') previsto_em FROM financeiro.contas_receber WHERE status='estimado' ORDER BY previsto_em NULLS LAST LIMIT 500",
+      ),
+      this.pool.query(
+        "SELECT DISTINCT ON(conta_financeira_id) *,to_char(data,'YYYY-MM-DD') data FROM financeiro.saldos_informados ORDER BY conta_financeira_id,data DESC,id DESC",
+      ),
+      this.pool.query(
+        "SELECT s.id,s.data,s.liquido_centavos FROM financeiro.saques_hotmart s JOIN financeiro.conciliacao_itens i ON i.tipo='saque' AND i.referencia_id=s.id::text JOIN financeiro.conciliacoes c ON c.id=i.conciliacao_id AND c.aceita AND NOT c.desfeita",
+      ),
+    ]);
+    return {
+      vendido: vendido.rows,
+      aReceberEstimado: receber.rows,
+      disponivelInformado: disponivel.rows,
+      recebidoConciliado: recebido.rows,
+    };
+  }
+  async receberManual(p: Objeto): Promise<unknown> {
+    return (
+      await this.pool.query(
+        "INSERT INTO financeiro.contas_receber(origem,descricao,valor_centavos,previsto_em,conta_financeira_id) VALUES('manual',$1,$2,$3,$4) RETURNING id",
+        [
+          texto(p["descricao"]),
+          centavos(p["valorCentavos"]),
+          dia(p["previstoEm"]),
+          id(p["contaFinanceiraId"]),
+        ],
+      )
+    ).rows[0];
+  }
+  async importarExtrato(p: Objeto): Promise<unknown> {
+    const conta = id(p["contaFinanceiraId"]),
+      conteudo = texto(p["conteudo"], 1024 * 1024);
+    if (!["csv", "ofx"].includes(String(p["formato"])))
+      throw new BadRequestException("formato invalido");
+    const itens = extrato(conteudo, p["formato"] as "csv" | "ofx");
+    return this.transacao(async (c) => {
+      const r = await c.query<{ id: string }>(
+        "INSERT INTO financeiro.extratos_importados(conta_financeira_id,hash) VALUES($1,$2) ON CONFLICT(conta_financeira_id,hash) DO UPDATE SET hash=excluded.hash RETURNING id",
+        [conta, hash(conteudo)],
+      );
+      const importacao = r.rows[0]?.id;
+      let novos = 0;
+      for (const i of itens)
+        novos +=
+          (
+            await c.query(
+              "INSERT INTO financeiro.extrato_itens(extrato_id,conta_financeira_id,fitid,data,valor_centavos,memo) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(conta_financeira_id,fitid) DO NOTHING",
+              [importacao, conta, i.fitid, i.data, centavos(i.valorCentavos, true), i.memo],
+            )
+          ).rowCount ?? 0;
+      await this.motor.publicar(
+        "financeiro.extrato.importado",
+        "extrato:" + (importacao ?? ""),
+        { extrato_id: importacao ?? "" },
+        c,
+      );
+      return { id: importacao, novos };
+    });
+  }
+  async itensExtrato(): Promise<unknown> {
+    return (
+      await this.pool.query(
+        "SELECT *,to_char(data,'YYYY-MM-DD') data FROM financeiro.extrato_itens WHERE NOT conciliado ORDER BY data,id LIMIT 1000",
+      )
+    ).rows;
+  }
+}
diff --git a/apps/api/src/financeiro/repositorio.test.ts b/apps/api/src/financeiro/repositorio.test.ts
new file mode 100644
index 0000000..03d8051
--- /dev/null
+++ b/apps/api/src/financeiro/repositorio.test.ts
@@ -0,0 +1,78 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import type { Pool } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+import { AlertasFinanceiros } from "./alertas.js";
+import { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+function ambiente(falhar = false) {
+  const sqls: { sql: string; p: unknown[] }[] = [];
+  let conta = 0;
+  const c = {
+    query: async (sql: string, p: unknown[] = []) => {
+      sqls.push({ sql, p });
+      if (sql.startsWith("SELECT id FROM financeiro.categorias"))
+        return { rowCount: 1, rows: [{ id: "1" }] };
+      if (sql.includes("INSERT INTO financeiro.contas_pagar")) {
+        conta++;
+        if (falhar && conta === 2) throw new Error("falha simulada");
+        return { rowCount: 1, rows: [{ id: String(conta) }] };
+      }
+      return { rowCount: 0, rows: [] };
+    },
+    release: () => {},
+  };
+  const pool = { connect: async () => c } as unknown as Pool;
+  const motor = { publicar: async () => true } as unknown as MotorFuncionarios;
+  return {
+    repo: new RepositorioFinanceiroPg(pool, motor, new AlertasFinanceiros(pool, motor)),
+    sqls,
+  };
+}
+test("parcelamento distribui resto sem perda e confirma uma transacao", async () => {
+  const a = ambiente();
+  await a.repo.criarDespesa({
+    descricao: "Serviço",
+    categoria: "Serviços",
+    valorCentavos: "10001",
+    vencimento: "2026-11-30",
+    parcelas: 3,
+  });
+  const inserts = a.sqls.filter((c) => c.sql.includes("INSERT INTO financeiro.contas_pagar"));
+  assert.deepEqual(
+    inserts.map((i) => i.p[4]),
+    ["3334", "3334", "3333"],
+  );
+  assert.equal(
+    inserts.reduce((s, i) => s + BigInt(String(i.p[4])), 0n),
+    10001n,
+  );
+  assert.equal(a.sqls.at(-1)?.sql, "COMMIT");
+});
+test("falha durante parcelamento provoca rollback sem commit", async () => {
+  const a = ambiente(true);
+  await assert.rejects(
+    a.repo.criarDespesa({
+      descricao: "Serviço",
+      categoria: "Serviços",
+      valorCentavos: "10001",
+      vencimento: "2026-11-30",
+      parcelas: 3,
+    }),
+    /falha simulada/,
+  );
+  assert.equal(a.sqls.at(-1)?.sql, "ROLLBACK");
+  assert.equal(
+    a.sqls.some((c) => c.sql === "COMMIT"),
+    false,
+  );
+});
+test("previa CSV denuncia linha invalida e confirmacao nao inicia transacao", async () => {
+  const a = ambiente(),
+    csv =
+      "data;descricao;valor;categoria;fornecedor;centro_custo;vencimento\n2026-11-03;Aluguel;100,00;Aluguel;;;2026-11-10\n2026-11-03;Inválida;1,005;Aluguel;;;2026-11-10";
+  const previa = a.repo.previaDespesas(csv);
+  assert.equal(previa.linhas.length, 1);
+  assert.equal(previa.erros[0]?.linha, 3);
+  await assert.rejects(a.repo.importarDespesas(csv, true));
+  assert.equal(a.sqls.length, 0);
+});
diff --git a/apps/api/src/financeiro/rotinas.ts b/apps/api/src/financeiro/rotinas.ts
new file mode 100644
index 0000000..b8f520c
--- /dev/null
+++ b/apps/api/src/financeiro/rotinas.ts
@@ -0,0 +1,184 @@
+import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
+import type { VendasConfig } from "@nucleos/config";
+import type { ContextoHandler } from "../funcionarios/handlers.js";
+import { HotmartClient } from "../vendas/hotmart-client.js";
+import { STATUS_HOTMART, type Venda } from "../vendas/dominio.js";
+import { RepositorioVendasPg } from "../vendas/repositorio-pg.js";
+import type { RepositorioFinanceiroPg } from "./repositorio-pg.js";
+import { ConciliacaoFinanceira } from "./conciliacao.js";
+import { dia } from "./importacao.js";
+const DIA = 86400000;
+export class RotinasFinanceiras {
+  readonly cliente: HotmartClient | undefined;
+  constructor(
+    readonly repo: RepositorioFinanceiroPg,
+    readonly config: VendasConfig,
+  ) {
+    this.cliente = config.hotmart
+      ? new HotmartClient({ env: config.hotmartEnv, credenciais: config.hotmart })
+      : undefined;
+    const jobs = {
+      "financeiro.gerar_recorrencias": async (
+        c: Parameters<RepositorioFinanceiroPg["gerarRecorrencias"]>[0],
+      ) => ({ geradas: await repo.gerarRecorrencias(c) }),
+      "financeiro.verificar_vencimentos": async (
+        c: Parameters<RepositorioFinanceiroPg["vencimentos"]>[0],
+      ) => {
+        await repo.vencimentos(c);
+        return {};
+      },
+      "financeiro.atualizar_previsoes": async (
+        c: Parameters<RepositorioFinanceiroPg["previsoes"]>[0],
+      ) => {
+        await repo.previsoes(c);
+        return {};
+      },
+      "financeiro.alertar_recebimentos": async (
+        c: Parameters<RepositorioFinanceiroPg["atrasados"]>[0],
+      ) => {
+        await repo.atrasados(c);
+        return {};
+      },
+      "financeiro.conciliar_vendas": async (
+        c: Parameters<ConciliacaoFinanceira["sugerir"]>[0],
+      ) => ({ sugestoes: await new ConciliacaoFinanceira(repo).sugerir(c) }),
+    };
+    for (const [chave, executar] of Object.entries(jobs))
+      repo.motor.registro.registrar({
+        chave,
+        validarConfig: (c) => Object.keys(c).length === 0,
+        executar: async (ctx) => {
+          this.exigirLease(ctx);
+          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
+          return repo.transacao(async (c) => {
+            const resultado = await executar(c);
+            this.exigirLease(ctx);
+            return resultado;
+          });
+        },
+      });
+    if (this.cliente) {
+      repo.motor.registro.registrar({
+        chave: "financeiro.reconciliar_hotmart",
+        validarConfig: (c) => {
+          try {
+            this.janela(c);
+            return Object.keys(c).every((k) => ["inicio", "fim"].includes(k));
+          } catch {
+            return false;
+          }
+        },
+        executar: (ctx) => this.reconciliar(ctx),
+      });
+      repo.motor.registro.registrar({
+        chave: "financeiro.processar_evento_hotmart",
+        validarConfig: (c) => Object.keys(c).length === 0,
+        executar: (ctx) => this.processarWebhook(ctx),
+      });
+    }
+  }
+  exigirLease(ctx: ContextoHandler): void {
+    ctx.signal.throwIfAborted();
+  }
+  janela(config: Record<string, unknown>): { de: Date; ate: Date } {
+    const hoje = new Date(),
+      de = config["inicio"]
+        ? new Date(dia(config["inicio"]) + "T00:00:00-03:00")
+        : new Date(hoje.getTime() - 30 * DIA),
+      ate = config["fim"] ? new Date(dia(config["fim"]) + "T23:59:59.999-03:00") : hoje;
+    if (ate < de || ate.getTime() - de.getTime() > 366 * DIA || ate > hoje)
+      throw new BadRequestException("periodo invalido (maximo 366 dias, ate hoje)");
+    return { de, ate };
+  }
+  async reconciliar(ctx: ContextoHandler): Promise<unknown> {
+    const cliente = this.cliente;
+    if (!cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
+    const janela = this.janela(ctx.config);
+    const local = await this.repo.pool.query<{
+      status: string;
+      moeda: string;
+      q: string;
+      s: string;
+    }>(
+      "SELECT status,moeda,count(*)::text q,sum(valor_centavos)::text s FROM financeiro.vendas WHERE pedido_em BETWEEN $1 AND $2 GROUP BY status,moeda",
+      [janela.de, janela.ate],
+    );
+    const esperado = new Map(
+      local.rows.map((v) => [v.status + ":" + v.moeda, { q: Number(v.q), s: BigInt(v.s) }]),
+    );
+    const remoto = new Map<string, { q: number; s: bigint }>();
+    const repoVendas = new RepositorioVendasPg(this.repo.pool, this.repo.motor);
+    let processadas = 0;
+    for (const status of STATUS_HOTMART) {
+      this.exigirLease(ctx);
+      await cliente.listarVendas(
+        janela,
+        status,
+        this.config.hotmart?.clientSecret.reveal() ?? "",
+        async (pagina) => {
+          const enriquecidas: Venda[] = [];
+          for (const venda of pagina) {
+            this.exigirLease(ctx);
+            const v = await cliente.enriquecer(venda),
+              k = v.status + ":" + v.moeda,
+              atual = remoto.get(k) ?? { q: 0, s: 0n };
+            atual.q++;
+            atual.s += BigInt(v.valorCentavos);
+            remoto.set(k, atual);
+            enriquecidas.push(v);
+          }
+          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
+          processadas += await repoVendas.gravarVendas(enriquecidas, "reconciliacao");
+        },
+      );
+    }
+    const serializar = (m: Map<string, { q: number; s: bigint }>) =>
+      [...m]
+        .sort(([x], [y]) => x.localeCompare(y))
+        .map(([k, v]) => k + ":" + String(v.q) + ":" + v.s.toString())
+        .join("|");
+    const divergente = serializar(esperado) !== serializar(remoto);
+    if (divergente)
+      await this.repo.alertas.criar({
+        tipo: "divergencia_hotmart",
+        chave:
+          "reconciliacao:" +
+          janela.de.toISOString().slice(0, 10) +
+          ":" +
+          janela.ate.toISOString().slice(0, 10),
+        referenciaTabela: "vendas",
+        referenciaId: "periodo",
+      });
+    return { processadas, divergente };
+  }
+  async processarWebhook(ctx: ContextoHandler): Promise<unknown> {
+    if (!this.cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
+    const pendentes = await this.repo.pool.query<{ id: string; transacao: string }>(
+      "SELECT id,transacao FROM financeiro.webhooks_hotmart WHERE processado_em IS NULL ORDER BY recebido_em,id LIMIT 100",
+    );
+    for (const ev of pendentes.rows) {
+      this.exigirLease(ctx);
+      const v = await this.cliente.transacao(
+        ev.transacao,
+        this.config.hotmart?.clientSecret.reveal() ?? "",
+      );
+      if (!(await ctx.verificarLease())) throw new Error("lease perdida");
+      await new RepositorioVendasPg(this.repo.pool, this.repo.motor).gravarVendas([v], "webhook");
+      await this.repo.pool.query(
+        "UPDATE financeiro.webhooks_hotmart SET processado_em=now() WHERE id=$1",
+        [ev.id],
+      );
+    }
+    return { processados: pendentes.rowCount ?? 0 };
+  }
+  async importarHistorico(config: Record<string, unknown>): Promise<{ execucaoId: string }> {
+    this.janela(config);
+    if (!config["inicio"] || !config["fim"]) throw new BadRequestException("informe inicio e fim");
+    if (!this.cliente) throw new ServiceUnavailableException("Hotmart nao configurada");
+    const r = await this.repo.pool.query<{ id: string }>(
+      "SELECT a.id FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='financeiro.reconciliar_hotmart' AND a.habilitada ORDER BY a.id LIMIT 1",
+    );
+    if (!r.rows[0]) throw new ServiceUnavailableException("tarefa indisponivel");
+    return { execucaoId: await this.repo.motor.executarAgora(r.rows[0].id, config) };
+  }
+}
diff --git a/apps/api/src/financeiro/webhook.test.ts b/apps/api/src/financeiro/webhook.test.ts
new file mode 100644
index 0000000..4675b69
--- /dev/null
+++ b/apps/api/src/financeiro/webhook.test.ts
@@ -0,0 +1,80 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { Secret } from "@nucleos/config";
+import type { Pool } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+import { ReceptorHotmart } from "./webhook.js";
+function ambiente() {
+  const chamadas: { sql: string; p: unknown[] }[] = [],
+    eventos: unknown[] = [],
+    ids = new Set<string>();
+  const cliente = {
+    query: async (sql: string, p: unknown[] = []) => {
+      chamadas.push({ sql, p });
+      if (sql.startsWith("INSERT")) {
+        const id = String(p[0]),
+          existe = ids.has(id);
+        ids.add(id);
+        return { rowCount: existe ? 0 : 1, rows: existe ? [] : [{ id }] };
+      }
+      return { rowCount: 0, rows: [] };
+    },
+    release: () => {},
+  };
+  const pool = { connect: async () => cliente } as unknown as Pool;
+  const motor = {
+    publicar: async (...args: unknown[]) => {
+      eventos.push(args);
+      return true;
+    },
+  } as unknown as MotorFuncionarios;
+  return { pool, motor, chamadas, eventos };
+}
+test("webhook sem segredo ou HOTTOK errado nao consulta banco", async () => {
+  const a = ambiente();
+  await assert.rejects(new ReceptorHotmart(a.pool, a.motor, undefined).receber("x", {}), {
+    status: 503,
+  });
+  await assert.rejects(
+    new ReceptorHotmart(a.pool, a.motor, new Secret("segredo-ficticio-teste")).receber(
+      "errado",
+      {},
+    ),
+    { status: 401 },
+  );
+  assert.equal(a.chamadas.length, 0);
+});
+test("webhook valida limite e evento antes do banco", async () => {
+  const a = ambiente(),
+    r = new ReceptorHotmart(a.pool, a.motor, new Secret("teste-ficticio"));
+  await assert.rejects(r.receber("teste-ficticio", { texto: "x".repeat(65536) }), { status: 400 });
+  await assert.rejects(
+    r.receber("teste-ficticio", {
+      id: "a",
+      event: "DESCONHECIDO",
+      data: { purchase: { transaction: "t" } },
+    }),
+    { status: 400 },
+  );
+  assert.equal(a.chamadas.length, 0);
+});
+test("recebimento descarta PII, deduplica id e publica na mesma transacao", async () => {
+  const a = ambiente(),
+    r = new ReceptorHotmart(a.pool, a.motor, new Secret("teste-ficticio"));
+  const p = {
+    id: "evento-1",
+    event: "PURCHASE_APPROVED",
+    data: {
+      purchase: { transaction: "T1" },
+      buyer: { email: "pessoa@example.invalid", name: "Pessoa Ficticia" },
+    },
+  };
+  await r.receber("teste-ficticio", p);
+  await r.receber("teste-ficticio", p);
+  assert.equal(a.eventos.length, 1);
+  assert.equal(a.chamadas.filter((c) => c.sql === "COMMIT").length, 2);
+  const persistido = JSON.stringify(a.chamadas.map((c) => c.p));
+  assert.equal(persistido.includes("Pessoa Ficticia"), false);
+  assert.equal(persistido.includes("pessoa@example.invalid"), false);
+  assert.match(String(a.chamadas.find((c) => c.sql.startsWith("INSERT"))?.p[3]), /^[a-f0-9]{64}$/);
+});
diff --git a/apps/api/src/financeiro/webhook.ts b/apps/api/src/financeiro/webhook.ts
new file mode 100644
index 0000000..6944402
--- /dev/null
+++ b/apps/api/src/financeiro/webhook.ts
@@ -0,0 +1,94 @@
+import { createHash, timingSafeEqual } from "node:crypto";
+import {
+  Body,
+  Controller,
+  Headers,
+  HttpCode,
+  Inject,
+  Post,
+  ServiceUnavailableException,
+  UnauthorizedException,
+  BadRequestException,
+} from "@nestjs/common";
+import type { Secret } from "@nucleos/config";
+import type { Pool } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+export const RECEPTOR_HOTMART = Symbol("RECEPTOR_HOTMART");
+const EVENTOS = new Set([
+  "PURCHASE_APPROVED",
+  "PURCHASE_COMPLETE",
+  "PURCHASE_CANCELED",
+  "PURCHASE_REFUNDED",
+  "PURCHASE_CHARGEBACK",
+  "PURCHASE_PROTEST",
+  "PURCHASE_EXPIRED",
+  "PURCHASE_DELAYED",
+  "PURCHASE_DISPUTE",
+]);
+export class ReceptorHotmart {
+  constructor(
+    readonly pool: Pool,
+    readonly motor: MotorFuncionarios,
+    readonly segredo: Secret | undefined,
+  ) {}
+  async receber(cabecalho: unknown, corpo: unknown): Promise<{ recebido: true }> {
+    if (!this.segredo) throw new ServiceUnavailableException("webhook nao configurado");
+    // Hash both inputs to fixed size before timingSafeEqual, including invalid lengths.
+    const a = createHash("sha256")
+      .update(typeof cabecalho === "string" ? cabecalho : "")
+      .digest();
+    const b = createHash("sha256").update(this.segredo.reveal()).digest();
+    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
+    if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo))
+      throw new BadRequestException("evento invalido");
+    const bruto = JSON.stringify(corpo);
+    if (Buffer.byteLength(bruto) > 65536) throw new BadRequestException("corpo excede 64 KB");
+    const r = corpo as Record<string, unknown>;
+    const dados =
+      typeof r["data"] === "object" && r["data"] !== null
+        ? (r["data"] as Record<string, unknown>)
+        : {};
+    const compra =
+      typeof dados["purchase"] === "object" && dados["purchase"] !== null
+        ? (dados["purchase"] as Record<string, unknown>)
+        : {};
+    const evento = r["event"],
+      eventoId = r["id"],
+      transacao = compra["transaction"];
+    if (
+      typeof evento !== "string" ||
+      !EVENTOS.has(evento) ||
+      typeof eventoId !== "string" ||
+      !/^[-\w]{1,100}$/.test(eventoId) ||
+      typeof transacao !== "string" ||
+      !/^[-\w]{1,100}$/.test(transacao)
+    )
+      throw new BadRequestException("evento invalido");
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      const insercao = await c.query(
+        "INSERT INTO financeiro.webhooks_hotmart(id,tipo,transacao,corpo_hash) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id",
+        [eventoId, evento, transacao, createHash("sha256").update(bruto).digest("hex")],
+      );
+      if (insercao.rowCount)
+        await this.motor.publicar("hotmart.webhook.recebido", eventoId, { evento_id: eventoId }, c);
+      await c.query("COMMIT");
+      return { recebido: true };
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    } finally {
+      c.release();
+    }
+  }
+}
+@Controller("v1/webhooks")
+export class WebhookHotmartController {
+  constructor(@Inject(RECEPTOR_HOTMART) readonly receptor: ReceptorHotmart) {}
+  @Post("hotmart")
+  @HttpCode(200)
+  receber(@Headers("x-hotmart-hottok") hottok: unknown, @Body() corpo: unknown) {
+    return this.receptor.receber(hottok, corpo);
+  }
+}
diff --git a/apps/api/src/fluxo-caixa/dominio.test.ts b/apps/api/src/fluxo-caixa/dominio.test.ts
index 00d0125..be4c5dd 100644
--- a/apps/api/src/fluxo-caixa/dominio.test.ts
+++ b/apps/api/src/fluxo-caixa/dominio.test.ts
@@ -20,0 +21,16 @@ import {
+test("recorrencia anual vence apenas no mes de aniversario e dentro da vigencia", () => {
+  const anual = {
+    id: "1",
+    descricao: "Licença",
+    categoria: "Serviços",
+    valorCentavos: 12000,
+    diaVencimento: 31,
+    inicio: "2026-11",
+    fim: null,
+    periodicidade: "anual" as const,
+  };
+  assert.equal(venceNoMes(anual, "2026-11"), true);
+  assert.equal(venceNoMes(anual, "2026-12"), false);
+  assert.equal(venceNoMes(anual, "2027-11"), true);
+  assert.equal(venceNoMes({ ...anual, fim: "2027-10" }, "2027-11"), false);
+});
diff --git a/apps/api/src/fluxo-caixa/dominio.ts b/apps/api/src/fluxo-caixa/dominio.ts
index c5b16f9..d7a3255 100644
--- a/apps/api/src/fluxo-caixa/dominio.ts
+++ b/apps/api/src/fluxo-caixa/dominio.ts
@@ -16 +16,5 @@ export function venceNoMes(conta: ContaRecorrenteBanco, mes: string): boolean {
-  return conta.inicio <= mes && (conta.fim === null || mes <= conta.fim);
+  return (
+    conta.inicio <= mes &&
+    (conta.fim === null || mes <= conta.fim) &&
+    (conta.periodicidade !== "anual" || conta.inicio.slice(5, 7) === mes.slice(5, 7))
+  );
diff --git a/apps/api/src/fluxo-caixa/eventos.test.ts b/apps/api/src/fluxo-caixa/eventos.test.ts
new file mode 100644
index 0000000..ed59547
--- /dev/null
+++ b/apps/api/src/fluxo-caixa/eventos.test.ts
@@ -0,0 +1,42 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import type { Pool } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
+import { RepositorioFluxoCaixaPg } from "./repositorio-pg.js";
+test("mutacao legada e evento financeiro compartilham commit e rollback", async () => {
+  for (const falhar of [false, true]) {
+    const passos: string[] = [];
+    const c = {
+      query: async (sql: string) => {
+        passos.push(sql);
+        return { rowCount: 1, rows: [{ id: "1", tipo: "saida", nome: "Serviços" }] };
+      },
+      release: () => {},
+    };
+    const pool = {
+      connect: async () => c,
+      query: () => {
+        throw new Error("escrita fora da transacao");
+      },
+    } as unknown as Pool;
+    const motor = {
+      publicar: async (tipo: string, _chave: string, _p: unknown, cliente: unknown) => {
+        assert.equal(cliente, c);
+        assert.equal(tipo, "financeiro.dados.alterados");
+        if (falhar) throw new Error("evento falhou");
+        return true;
+      },
+    } as unknown as MotorFuncionarios;
+    const r = new RepositorioFluxoCaixaPg(pool, motor);
+    if (falhar) {
+      await assert.rejects(
+        r.inserirCategoria({ tipo: "saida", nome: "Serviços" }),
+        /evento falhou/,
+      );
+      assert.equal(passos.at(-1), "ROLLBACK");
+    } else {
+      await r.inserirCategoria({ tipo: "saida", nome: "Serviços" });
+      assert.equal(passos.at(-1), "COMMIT");
+    }
+  }
+});
diff --git a/apps/api/src/fluxo-caixa/repositorio-pg.ts b/apps/api/src/fluxo-caixa/repositorio-pg.ts
index 11a647f..1b7098f 100644
--- a/apps/api/src/fluxo-caixa/repositorio-pg.ts
+++ b/apps/api/src/fluxo-caixa/repositorio-pg.ts
@@ -8 +8,3 @@ import type {
-import type { Pool } from "pg";
+import type { Pool, QueryResult, QueryResultRow } from "pg";
+import { randomUUID } from "node:crypto";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
@@ -22 +24 @@ const COLUNAS_LANCAMENTO = `id::text AS id, tipo, descricao, categoria, valor_ce
-const COLUNAS_CONTA = `id::text AS id, descricao, categoria, valor_centavos, dia_vencimento,
+const COLUNAS_CONTA = `id::text AS id, descricao, categoria, valor_centavos, dia_vencimento,periodicidade,
@@ -51,0 +54 @@ function conta(r: Record<string, unknown>): ContaRecorrenteBanco {
+    periodicidade: r["periodicidade"] === "anual" ? "anual" : "mensal",
@@ -61 +64,26 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-  constructor(private readonly pool: Pool) {}
+  constructor(
+    private readonly pool: Pool,
+    private readonly motor?: MotorFuncionarios,
+  ) {}
+
+  private async consultar<T extends QueryResultRow = QueryResultRow>(
+    sql: string,
+    p?: unknown[],
+  ): Promise<QueryResult<T>> {
+    if (!this.motor || !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql))
+      return this.pool.query<T>(sql, p);
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      const resultado = await c.query<T>(sql, p);
+      if (resultado.rowCount)
+        await this.motor.publicar("financeiro.dados.alterados", randomUUID(), {}, c);
+      await c.query("COMMIT");
+      return resultado;
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    } finally {
+      c.release();
+    }
+  }
@@ -64 +92 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -74 +102 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -83 +111 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -92 +120 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -99 +127 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -108 +136 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -118 +146 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-      const { rows } = await this.pool.query(
+      const { rows } = await this.consultar(
@@ -142 +170 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const r = await this.pool.query("DELETE FROM financeiro.lancamentos WHERE id = $1::bigint", [
+    const r = await this.consultar("DELETE FROM financeiro.lancamentos WHERE id = $1::bigint", [
@@ -149 +177 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -167 +195 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const r = await this.pool.query(
+    const r = await this.consultar(
@@ -177 +205 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-      const r = await this.pool.query(
+      const r = await this.consultar(
@@ -191 +219 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -198 +226 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const { rows } = await this.pool.query(
+    const { rows } = await this.consultar(
@@ -207 +235 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-      const { rows } = await this.pool.query(
+      const { rows } = await this.consultar(
@@ -221,3 +249 @@ export class RepositorioFluxoCaixaPg implements RepositorioFluxoCaixa {
-    const r = await this.pool.query("DELETE FROM financeiro.categorias WHERE id = $1::bigint", [
-      id,
-    ]);
+    const r = await this.consultar("DELETE FROM financeiro.categorias WHERE id = $1::bigint", [id]);
diff --git a/apps/api/src/funcionarios/motor.ts b/apps/api/src/funcionarios/motor.ts
index 86f05c3..beb4668 100644
--- a/apps/api/src/funcionarios/motor.ts
+++ b/apps/api/src/funcionarios/motor.ts
@@ -64,0 +65 @@ export class MotorFuncionarios {
+    configManual?: ObjetoConfig,
@@ -69 +70,2 @@ export class MotorFuncionarios {
-    validarConfiguracao(a.config_schema, a.config, this.registro.obter(a.handler_key));
+    const config = configManual ?? a.config;
+    validarConfiguracao(a.config_schema, config, this.registro.obter(a.handler_key));
@@ -82 +84 @@ export class MotorFuncionarios {
-        a.config,
+        config,
@@ -104 +106 @@ export class MotorFuncionarios {
-  executarAgora(atribuicaoId: string): Promise<string> {
+  executarAgora(atribuicaoId: string, config?: ObjetoConfig): Promise<string> {
@@ -106 +108,9 @@ export class MotorFuncionarios {
-      this.#enfileirar(c, atribuicaoId, `manual:${randomUUID()}`, "manual", await this.#agora(c)),
+      this.#enfileirar(
+        c,
+        atribuicaoId,
+        `manual:${randomUUID()}`,
+        "manual",
+        await this.#agora(c),
+        undefined,
+        config,
+      ),
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index afed1c0..9513529 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -2 +2,6 @@ import "reflect-metadata";
-import { ConfigError, loadApiConfig, loadVendasConfig } from "@nucleos/config";
+import {
+  ConfigError,
+  loadApiConfig,
+  loadFinanceiroConfig,
+  loadVendasConfig,
+} from "@nucleos/config";
@@ -3,0 +9,2 @@ import { NestFactory } from "@nestjs/core";
+import { PayloadTooLargeException } from "@nestjs/common";
+import type { NestExpressApplication } from "@nestjs/platform-express";
@@ -4,0 +12 @@ import { Pool } from "pg";
+import type { IncomingMessage, ServerResponse } from "node:http";
@@ -13,0 +22 @@ import { FuncionariosModule } from "./funcionarios/funcionarios.module.js";
+import { FinanceiroModule } from "./financeiro/financeiro.module.js";
@@ -18,0 +28 @@ let vendasConfig;
+let financeiroConfig;
@@ -21,0 +32 @@ try {
+  financeiroConfig = loadFinanceiroConfig();
@@ -49 +60 @@ const motor =
-const app = await NestFactory.create(
+const app = await NestFactory.create<NestExpressApplication>(
@@ -53,0 +65 @@ const app = await NestFactory.create(
+          FinanceiroModule.registrar(motor, vendasConfig.apiKey, financeiroConfig, vendasConfig),
@@ -68 +80 @@ const app = await NestFactory.create(
-            repositorio: new RepositorioFluxoCaixaPg(pool),
+            repositorio: new RepositorioFluxoCaixaPg(pool, motor),
@@ -71,0 +84 @@ const app = await NestFactory.create(
+  { bodyParser: false },
@@ -72,0 +86,7 @@ const app = await NestFactory.create(
+app.useBodyParser("json", {
+  limit: "2mb",
+  verify: (req: IncomingMessage, _res: ServerResponse, buf: Buffer) => {
+    if (req.url?.split("?")[0] === "/v1/webhooks/hotmart" && buf.byteLength > 65536)
+      throw new PayloadTooLargeException("corpo excede 64 KB");
+  },
+});
diff --git a/apps/api/src/vendas/apoio.test.ts b/apps/api/src/vendas/apoio.test.ts
index 73d4f0e..e265da9 100644
--- a/apps/api/src/vendas/apoio.test.ts
+++ b/apps/api/src/vendas/apoio.test.ts
@@ -22 +22,2 @@ test("grupos de status: desconhecido nunca vira receita", () => {
-  assert.equal(grupoDoStatus("CHARGEBACK"), "reembolso");
+  assert.equal(grupoDoStatus("CHARGEBACK"), "contestada");
+  assert.equal(grupoDoStatus("DISPUTE"), "contestada");
diff --git a/apps/api/src/vendas/dominio.ts b/apps/api/src/vendas/dominio.ts
index 5ae85ab..fca9ce2 100644
--- a/apps/api/src/vendas/dominio.ts
+++ b/apps/api/src/vendas/dominio.ts
@@ -20,0 +21,6 @@ export interface Venda {
+  ofertaCodigo?: string | null;
+  descontoCentavos?: number | null;
+  comissoesCentavos?: number;
+  rastreioOrigem?: string | null;
+  rastreioSck?: string | null;
+  comissoes?: { tipo: string; moeda: string; valorCentavos: number }[];
@@ -44 +50 @@ export const STATUS_HOTMART = [
-const REEMBOLSO = new Set(["REFUNDED", "CHARGEBACK"]);
+const REEMBOLSO = new Set(["REFUNDED"]);
@@ -51,0 +58 @@ export function grupoDoStatus(status: string): GrupoStatusVenda {
+  if (s === "CHARGEBACK" || s === "DISPUTE") return "contestada";
diff --git a/apps/api/src/vendas/hotmart-client.ts b/apps/api/src/vendas/hotmart-client.ts
index 993d63d..51db749 100644
--- a/apps/api/src/vendas/hotmart-client.ts
+++ b/apps/api/src/vendas/hotmart-client.ts
@@ -109,0 +110,5 @@ export function normalizarVenda(item: unknown, chavePseudonimo: string): Venda |
+    ofertaCodigo: texto(obj(compra["offer"])["code"]) || null,
+    // History already contains the effective price; do not subtract a coupon twice.
+    descontoCentavos: null,
+    rastreioOrigem: texto(obj(compra["tracking"])["source"]) || null,
+    rastreioSck: texto(obj(compra["tracking"])["source_sck"]) || null,
@@ -129,0 +135,51 @@ export class HotmartClient {
+  /** Only normalized role/currency/value leave this method, never participant identity. */
+  async enriquecer(venda: Venda): Promise<Venda> {
+    const base = URL_HISTORICO[this.#env].replace(/history$/, "");
+    const comissoes: NonNullable<Venda["comissoes"]> = [];
+    let cursor = "";
+    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
+      const params = new URLSearchParams({ transaction: venda.transacao, max_results: "500" });
+      if (cursor) params.set("page_token", cursor);
+      const resposta = await this.#get(`${base}commissions?${params.toString()}`);
+      if (!resposta.ok) throw new HotmartError("http", resposta.status);
+      const corpo = obj(await this.#json(resposta));
+      for (const item of Array.isArray(corpo["items"]) ? corpo["items"] : []) {
+        const r = obj(item),
+          c = obj(r["commission"]);
+        const tipo = texto(r["source"]).toUpperCase();
+        const moeda = texto(c["currency_code"] || c["currency_value"]).toUpperCase();
+        if (!["AFFILIATE", "COPRODUCER", "CO_PRODUCER"].includes(tipo)) continue;
+        if (moeda !== venda.moeda) throw new HotmartError("resposta");
+        comissoes.push({ tipo, moeda, valorCentavos: paraCentavos(c["value"]) });
+      }
+      cursor = texto(obj(corpo["page_info"])["next_page_token"]);
+      if (!cursor) break;
+      if (pagina === MAX_PAGINAS - 1) throw new HotmartError("resposta");
+    }
+    const preco = await this.#get(
+      `${base}price/details?transaction=${encodeURIComponent(venda.transacao)}`,
+    );
+    if (!preco.ok) throw new HotmartError("http", preco.status);
+    // Coupon semantics are inconsistent in the published example. Keep the effective
+    // sale price and explicit unknown discount instead of manufacturing a deduction.
+    await this.#json(preco);
+    return {
+      ...venda,
+      comissoes,
+      comissoesCentavos: comissoes.reduce((total, c) => total + c.valorCentavos, 0),
+    };
+  }
+
+  async transacao(transacao: string, chave: string): Promise<Venda> {
+    const params = new URLSearchParams({ transaction: transacao });
+    const resposta = await this.#get(`${URL_HISTORICO[this.#env]}?${params.toString()}`);
+    if (!resposta.ok) throw new HotmartError("http", resposta.status);
+    const corpo = obj(await this.#json(resposta));
+    const vendas = (Array.isArray(corpo["items"]) ? corpo["items"] : [])
+      .map((i: unknown) => normalizarVenda(i, chave))
+      .filter((v: Venda | null): v is Venda => v !== null);
+    const venda = vendas.find((v: Venda) => v.transacao === transacao);
+    if (!venda) throw new HotmartError("resposta");
+    return this.enriquecer(venda);
+  }
+
diff --git a/apps/api/src/vendas/repositorio-pg.ts b/apps/api/src/vendas/repositorio-pg.ts
index a4c04d7..0b053b6 100644
--- a/apps/api/src/vendas/repositorio-pg.ts
+++ b/apps/api/src/vendas/repositorio-pg.ts
@@ -7,0 +8 @@ import type { Pool } from "pg";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
@@ -42 +43,2 @@ function indicadoresDe(linha: Record<string, unknown>): IndicadoresVendas {
-    receitaLiquidaCentavos: receita - taxas,
+    receitaLiquidaCentavos:
+      linha["liquido"] === undefined ? receita - taxas : num(linha["liquido"]),
@@ -56,0 +59 @@ const SQL_INDICADORES = `
+    COALESCE(SUM(liquido_centavos) FILTER (WHERE grupo = 'receita'),0) AS liquido,
@@ -65 +68,4 @@ export class RepositorioVendasPg implements RepositorioVendas {
-  constructor(private readonly pool: Pool) {}
+  constructor(
+    private readonly pool: Pool,
+    private readonly motor?: MotorFuncionarios,
+  ) {}
@@ -67,38 +73,95 @@ export class RepositorioVendasPg implements RepositorioVendas {
-  async gravarVendas(vendas: readonly Venda[]): Promise<number> {
-    const unicas = [...new Map(vendas.map((v) => [v.transacao, v])).values()];
-    if (unicas.length === 0) return 0;
-    await this.pool.query(
-      `INSERT INTO financeiro.vendas
-         (transacao, produto_id, produto_nome, comprador_id, status, grupo, pedido_em, aprovado_em,
-          valor_centavos, taxa_centavos, moeda, pagamento, parcelas, assinatura, recorrencia)
-       SELECT * FROM unnest(
-         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
-         $7::timestamptz[], $8::timestamptz[], $9::bigint[], $10::bigint[], $11::char(3)[],
-         $12::text[], $13::integer[], $14::boolean[], $15::integer[])
-       ON CONFLICT (transacao) DO UPDATE SET
-         produto_id = EXCLUDED.produto_id, produto_nome = EXCLUDED.produto_nome,
-         comprador_id = EXCLUDED.comprador_id, status = EXCLUDED.status, grupo = EXCLUDED.grupo,
-         pedido_em = EXCLUDED.pedido_em, aprovado_em = EXCLUDED.aprovado_em,
-         valor_centavos = EXCLUDED.valor_centavos, taxa_centavos = EXCLUDED.taxa_centavos,
-         moeda = EXCLUDED.moeda, pagamento = EXCLUDED.pagamento, parcelas = EXCLUDED.parcelas,
-         assinatura = EXCLUDED.assinatura, recorrencia = EXCLUDED.recorrencia,
-         sincronizado_em = now()`,
-      [
-        unicas.map((v) => v.transacao),
-        unicas.map((v) => v.produtoId),
-        unicas.map((v) => v.produtoNome),
-        unicas.map((v) => v.compradorId),
-        unicas.map((v) => v.status),
-        unicas.map((v) => v.grupo),
-        unicas.map((v) => v.pedidoEm),
-        unicas.map((v) => v.aprovadoEm),
-        unicas.map((v) => v.valorCentavos),
-        unicas.map((v) => v.taxaCentavos),
-        unicas.map((v) => v.moeda),
-        unicas.map((v) => v.pagamento),
-        unicas.map((v) => v.parcelas),
-        unicas.map((v) => v.assinatura),
-        unicas.map((v) => v.recorrencia),
-      ],
-    );
-    return unicas.length;
+  async gravarVendas(
+    vendas: readonly Venda[],
+    origem: "polling" | "webhook" | "reconciliacao" = "polling",
+  ): Promise<number> {
+    const c = await this.pool.connect();
+    try {
+      await c.query("BEGIN");
+      for (const v of [...new Map(vendas.map((v) => [v.transacao, v])).values()]) {
+        // Serialize insert and status history even when no sale row exists yet.
+        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [v.transacao]);
+        const anterior = await c.query<{ status: string }>(
+          "SELECT status FROM financeiro.vendas WHERE transacao=$1",
+          [v.transacao],
+        );
+        const comissao = v.comissoesCentavos ?? 0;
+        await c.query(
+          `INSERT INTO financeiro.vendas
+          (transacao,produto_id,produto_nome,comprador_id,status,grupo,pedido_em,aprovado_em,valor_centavos,taxa_centavos,moeda,pagamento,parcelas,assinatura,recorrencia,oferta_codigo,desconto_centavos,comissoes_centavos,liquido_centavos,rastreio_origem,rastreio_sck)
+          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
+          ON CONFLICT(transacao) DO UPDATE SET status=excluded.status,grupo=excluded.grupo,
+          aprovado_em=excluded.aprovado_em,valor_centavos=excluded.valor_centavos,taxa_centavos=excluded.taxa_centavos,
+          comissoes_centavos=excluded.comissoes_centavos,liquido_centavos=excluded.liquido_centavos,
+          oferta_codigo=excluded.oferta_codigo,desconto_centavos=excluded.desconto_centavos,
+          rastreio_origem=excluded.rastreio_origem,rastreio_sck=excluded.rastreio_sck,sincronizado_em=now()`,
+          [
+            v.transacao,
+            v.produtoId,
+            v.produtoNome,
+            v.compradorId,
+            v.status,
+            v.grupo,
+            v.pedidoEm,
+            v.aprovadoEm,
+            v.valorCentavos,
+            v.taxaCentavos,
+            v.moeda,
+            v.pagamento,
+            v.parcelas,
+            v.assinatura,
+            v.recorrencia,
+            v.ofertaCodigo ?? null,
+            v.descontoCentavos ?? null,
+            comissao,
+            v.valorCentavos - v.taxaCentavos - comissao,
+            v.rastreioOrigem ?? null,
+            v.rastreioSck ?? null,
+          ],
+        );
+        await c.query("DELETE FROM financeiro.vendas_comissoes WHERE transacao=$1", [v.transacao]);
+        const agrupadas = new Map<string, { tipo: string; moeda: string; valorCentavos: number }>();
+        for (const com of v.comissoes ?? []) {
+          if (com.moeda !== v.moeda) throw new Error("moedas de comissao incompativeis");
+          const chave = com.tipo + ":" + com.moeda,
+            atual = agrupadas.get(chave);
+          agrupadas.set(chave, {
+            ...com,
+            valorCentavos: (atual?.valorCentavos ?? 0) + com.valorCentavos,
+          });
+        }
+        for (const com of agrupadas.values())
+          await c.query("INSERT INTO financeiro.vendas_comissoes VALUES($1,$2,$3,$4)", [
+            v.transacao,
+            com.tipo,
+            com.moeda,
+            com.valorCentavos,
+          ]);
+        if (anterior.rows[0]?.status !== v.status) {
+          const ev = await c.query<{ id: string }>(
+            "INSERT INTO financeiro.vendas_eventos(transacao,status_anterior,status_novo,origem) VALUES($1,$2,$3,$4) RETURNING id",
+            [v.transacao, anterior.rows[0]?.status ?? null, v.status, origem],
+          );
+          if (this.motor) {
+            await this.motor.publicar(
+              "financeiro.venda.alterada",
+              `venda:${ev.rows[0]?.id}`,
+              { transacao: v.transacao },
+              c,
+            );
+            await this.motor.publicar(
+              "financeiro.dados.alterados",
+              `venda-dados:${ev.rows[0]?.id}`,
+              {},
+              c,
+            );
+          }
+        }
+      }
+      await c.query("COMMIT");
+      return new Set(vendas.map((v) => v.transacao)).size;
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    } finally {
+      c.release();
+    }
diff --git a/apps/api/src/vendas/sincronizacao.ts b/apps/api/src/vendas/sincronizacao.ts
index be692cf..a0bb0a0 100644
--- a/apps/api/src/vendas/sincronizacao.ts
+++ b/apps/api/src/vendas/sincronizacao.ts
@@ -24,0 +25,2 @@ export interface OpcoesSincronizacao {
+  enriquecer?: boolean;
+  reconciliacaoSeparada?: boolean;
@@ -55,2 +57,3 @@ export class SincronizacaoVendas {
-      estado.ultimaReconciliacaoEm === null ||
-      inicio.getTime() - estado.ultimaReconciliacaoEm.getTime() >= INTERVALO_RECONCILIACAO_MS;
+      !this.opcoes.reconciliacaoSeparada &&
+      (estado.ultimaReconciliacaoEm === null ||
+        inicio.getTime() - estado.ultimaReconciliacaoEm.getTime() >= INTERVALO_RECONCILIACAO_MS);
@@ -78 +81,4 @@ export class SincronizacaoVendas {
-            processadas += await this.repo.gravarVendas(vendas);
+            const enriquecidas = this.opcoes.enriquecer
+              ? await Promise.all(vendas.map((v) => cliente.enriquecer(v)))
+              : vendas;
+            processadas += await this.repo.gravarVendas(enriquecidas);
diff --git a/apps/api/src/vendas/vendas.module.ts b/apps/api/src/vendas/vendas.module.ts
index 730091e..724041f 100644
--- a/apps/api/src/vendas/vendas.module.ts
+++ b/apps/api/src/vendas/vendas.module.ts
@@ -32 +32 @@ export class VendasModule {
-    const repo = new RepositorioVendasPg(pool);
+    const repo = new RepositorioVendasPg(pool, motor);
@@ -41,0 +42,2 @@ export class VendasModule {
+      enriquecer: true,
+      reconciliacaoSeparada: true,
diff --git a/apps/web/app/(app)/setores/financeiro/_components/Alertas.tsx b/apps/web/app/(app)/setores/financeiro/_components/Alertas.tsx
new file mode 100644
index 0000000..69daf38
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/_components/Alertas.tsx
@@ -0,0 +1,51 @@
+import { revalidatePath } from "next/cache";
+import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
+async function encerrar(f: FormData) {
+  "use server";
+  const id = f.get("id"),
+    acao = f.get("acao");
+  if (
+    typeof id !== "string" ||
+    !/^\d{1,19}$/.test(id) ||
+    typeof acao !== "string" ||
+    !["resolver", "ignorar"].includes(acao)
+  )
+    throw new Error("Acao invalida");
+  await financeiroApi(`/alertas/${id}/${acao}`, {});
+  revalidatePath("/setores/financeiro");
+}
+export async function Alertas({ tipo }: { tipo?: string }) {
+  let alertas: Record<string, unknown>[];
+  try {
+    alertas = (await financeiroApi(
+      `/alertas${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ""}`,
+    )) as Record<string, unknown>[];
+  } catch {
+    return <p role="status">Alertas indisponÃ­veis. Confira a conexÃ£o com a API.</p>;
+  }
+  return (
+    <section aria-label="Alertas financeiros">
+      <h2>Alertas financeiros</h2>
+      {alertas.length === 0 ? (
+        <p>Nenhum alerta aberto.</p>
+      ) : (
+        <ul>
+          {alertas.map((a) => (
+            <li key={String(a["id"])}>
+              <strong>{String(a["severidade"])}</strong> â€” {String(a["mensagem"])}
+              <form action={encerrar}>
+                <input type="hidden" name="id" value={String(a["id"])} />
+                <button name="acao" value="resolver">
+                  Resolver
+                </button>
+                <button name="acao" value="ignorar">
+                  Ignorar
+                </button>
+              </form>
+            </li>
+          ))}
+        </ul>
+      )}
+    </section>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/_components/Base.tsx b/apps/web/app/(app)/setores/financeiro/_components/Base.tsx
new file mode 100644
index 0000000..a92ba7c
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/_components/Base.tsx
@@ -0,0 +1,138 @@
+import Link from "next/link";
+import type { ReactNode } from "react";
+import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
+import { FormularioAcao } from "../fluxo-de-caixa/_components/FormularioAcao.tsx";
+import { PainelLateral } from "../fluxo-de-caixa/_components/PainelLateral.tsx";
+import { executarFinanceiro } from "./acoes.ts";
+export function exibir(v: unknown): string {
+  return typeof v === "string" ||
+    typeof v === "number" ||
+    typeof v === "bigint" ||
+    typeof v === "boolean"
+    ? String(v)
+    : "—";
+}
+export function NavegacaoFinanceira() {
+  return (
+    <nav aria-label="Financeiro">
+      <Link href="/setores/financeiro/vendas/receitas">Receitas e vendas</Link>
+      {" · "}
+      <Link href="/setores/financeiro/contas">Contas a pagar e receber</Link>
+      {" · "}
+      <Link href="/setores/financeiro/movimentacoes">Movimentações</Link>
+      {" · "}
+      <Link href="/setores/financeiro/conciliacao">Conciliação</Link>
+      {" · "}
+      <Link href="/setores/financeiro/alertas">Alertas</Link>
+    </nav>
+  );
+}
+export function Campo({
+  nome,
+  rotulo,
+  tipo = "text",
+  obrigatorio = true,
+}: {
+  nome: string;
+  rotulo: string;
+  tipo?: string;
+  obrigatorio?: boolean;
+}) {
+  return (
+    <label style={{ display: "block", marginBlock: 12 }}>
+      {rotulo}
+      <input name={nome} type={tipo} required={obrigatorio} maxLength={200} />
+    </label>
+  );
+}
+export function Escolha({
+  nome,
+  rotulo,
+  opcoes,
+}: {
+  nome: string;
+  rotulo: string;
+  opcoes: Record<string, unknown>[];
+}) {
+  return (
+    <label style={{ display: "block", marginBlock: 12 }}>
+      {rotulo}
+      <select name={nome} required>
+        <option value="">Selecione</option>
+        {opcoes.map((o) => (
+          <option value={String(o["id"])} key={String(o["id"])}>
+            {String(o["nome"] ?? o["descricao"] ?? o["id"])}
+          </option>
+        ))}
+      </select>
+    </label>
+  );
+}
+export function Formulario({
+  operacao,
+  rotulo,
+  children,
+  id,
+}: {
+  operacao: string;
+  rotulo: string;
+  children?: ReactNode;
+  id?: string;
+}) {
+  return (
+    <FormularioAcao acao={executarFinanceiro} rotulo={rotulo} rotuloPendente="Aguarde…">
+      <input type="hidden" name="operacao" value={operacao} />
+      {id && <input type="hidden" name="id" value={id} />} {children}
+    </FormularioAcao>
+  );
+}
+export function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
+  return (
+    <PainelLateral rotuloBotao={titulo} titulo={titulo} fecharAoConcluir={false}>
+      {children}
+    </PainelLateral>
+  );
+}
+export function Tabela({
+  dados,
+  colunas,
+}: {
+  dados: Record<string, unknown>[];
+  colunas: [string, string][];
+}) {
+  return (
+    <div style={{ overflowX: "auto" }}>
+      <table>
+        <thead>
+          <tr>
+            {colunas.map(([k, n]) => (
+              <th key={k}>{n}</th>
+            ))}
+          </tr>
+        </thead>
+        <tbody>
+          {dados.map((d, i) => (
+            <tr key={exibir(d["id"] ?? d["transacao"] ?? i)}>
+              {colunas.map(([k]) => (
+                <td key={k}>{d[k] === null || d[k] === undefined ? "—" : exibir(d[k])}</td>
+              ))}
+            </tr>
+          ))}
+        </tbody>
+      </table>
+      {!dados.length && <p>Nenhum registro para os filtros.</p>}
+    </div>
+  );
+}
+export async function consultar<T>(path: string): Promise<T | null> {
+  try {
+    return (await financeiroApi(path)) as T;
+  } catch {
+    return null;
+  }
+}
+export function Indisponivel() {
+  return (
+    <p role="status">Dados financeiros indisponíveis. Confira a conexão e a configuração da API.</p>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/_components/ImportarDespesas.tsx b/apps/web/app/(app)/setores/financeiro/_components/ImportarDespesas.tsx
new file mode 100644
index 0000000..227b3ab
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/_components/ImportarDespesas.tsx
@@ -0,0 +1,69 @@
+"use client";
+import { useActionState } from "react";
+import { importarCsv } from "./acoes.ts";
+export function ImportarDespesas() {
+  const [estado, acao, pendente] = useActionState(importarCsv, {
+    erro: false,
+    mensagem: "",
+    previa: null,
+  });
+  const previa = estado.previa
+    ? (JSON.parse(estado.previa) as {
+        linhas: Record<string, unknown>[];
+        erros: { linha: number; mensagem: string }[];
+      })
+    : null;
+  return (
+    <form action={acao} aria-busy={pendente}>
+      <p>
+        Layout separado por ponto e vírgula:
+        data;descricao;valor;categoria;fornecedor;centro_custo;vencimento. Datas AAAA-MM-DD; valor
+        decimal; fornecedor e centro opcionais usam os códigos dos cadastros.
+      </p>
+      <label>
+        Conteúdo CSV
+        <textarea name="conteudo" rows={7} required maxLength={1048576} />
+      </label>
+      <button disabled={pendente} name="confirmar" value="nao">
+        Pré-visualizar
+      </button>
+      <button disabled={pendente || estado.erro || !estado.previa} name="confirmar" value="sim">
+        Confirmar importação
+      </button>
+      {estado.mensagem && <p role={estado.erro ? "alert" : "status"}>{estado.mensagem}</p>}
+      {previa && (
+        <div style={{ maxHeight: 300, overflow: "auto" }}>
+          <ul>
+            {previa.erros.map((e) => (
+              <li key={e.linha}>
+                Linha {e.linha}: {e.mensagem}
+              </li>
+            ))}
+          </ul>
+          <table>
+            <thead>
+              <tr>
+                <th>Descrição</th>
+                <th>Competência</th>
+                <th>Categoria</th>
+                <th>Valor (centavos)</th>
+                <th>Vencimento</th>
+              </tr>
+            </thead>
+            <tbody>
+              {previa.linhas.map((l, i) => (
+                <tr key={i}>
+                  {["descricao", "competencia", "categoria", "valorCentavos", "vencimento"].map(
+                    (k) => (
+                      <td key={k}>{String(l[k])}</td>
+                    ),
+                  )}
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      )}
+    </form>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/_components/acoes.ts b/apps/web/app/(app)/setores/financeiro/_components/acoes.ts
new file mode 100644
index 0000000..bb8ac00
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/_components/acoes.ts
@@ -0,0 +1,124 @@
+"use server";
+import { revalidatePath } from "next/cache";
+import { financeiroApi } from "../../../../../lib/financeiro-api.ts";
+import { configuracao } from "../../../../../lib/vendas-api.ts";
+import type { EstadoAcao } from "../../../../../lib/fluxo-caixa-formato.ts";
+const campoString = (v: unknown): string => (typeof v === "string" ? v : "");
+function valor(raw: FormDataEntryValue | null): string {
+  if (typeof raw !== "string" || !/^\d{1,12}([.,]\d{1,2})?$/.test(raw))
+    throw new Error("Valor invalido");
+  const [i, d = ""] = raw.replace(",", ".").split(".");
+  return (BigInt(i ?? "0") * 100n + BigInt(d.padEnd(2, "0"))).toString();
+}
+export async function executarFinanceiro(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  try {
+    const op = campoString(f.get("operacao")),
+      p: Record<string, unknown> = {};
+    for (const [k, v] of f.entries())
+      if (typeof v === "string" && k !== "operacao" && v !== "") p[k] = v;
+    if (f.has("valor")) {
+      p["valorCentavos"] = valor(f.get("valor"));
+      delete p["valor"];
+    }
+    if (f.has("taxa")) {
+      p["taxaCentavos"] = valor(f.get("taxa"));
+      delete p["taxa"];
+    }
+    const cid = campoString(f.get("id") ?? "");
+    if (cid && !/^[1-9]\d{0,17}$/.test(cid)) throw new Error("Identificador invalido");
+    const simples: Record<string, string> = {
+      despesa: "/contas-pagar",
+      recorrente: "/contas-recorrentes",
+      transferencia: "/transferencias",
+      saque: "/saques-hotmart",
+      saldo: "/saldos-informados",
+      receber: "/contas-receber",
+      extrato: "/extratos/importar",
+      historico: "/vendas/importar-historico",
+      fornecedor: "/cadastros/fornecedores",
+      centro: "/cadastros/centros",
+      conta: "/cadastros/contas",
+      regra: "/cadastros/regras",
+    };
+    let caminho = simples[op];
+    if (op === "pagar" || op === "cancelar") caminho = "/contas-pagar/" + cid + "/" + op;
+    if (["aceitar", "recusar", "desfazer"].includes(op))
+      caminho = "/conciliacoes/" + cid + "/" + op;
+    if (op === "manual") {
+      caminho = "/conciliacoes";
+      p["itens"] = [
+        { tipo: p["tipo"], referenciaId: p["referenciaId"], valorCentavos: p["valorCentavos"] },
+        { tipo: "extrato_item", referenciaId: p["extratoId"], valorCentavos: p["valorCentavos"] },
+      ];
+    }
+    if (!caminho) throw new Error("Operacao invalida");
+    const resultado = await financeiroApi(caminho, p);
+    revalidatePath("/setores/financeiro", "layout");
+    const execucao = op === "historico" ? (resultado as { execucaoId: string }).execucaoId : null;
+    return {
+      erro: false,
+      mensagem: execucao
+        ? "Importação enfileirada. Acompanhe em Funcionários → Execuções."
+        : "Operação concluída.",
+    };
+  } catch {
+    return {
+      erro: true,
+      mensagem: "Operação recusada. Confira os campos, a configuração e a disponibilidade da API.",
+    };
+  }
+}
+export async function anexar(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  try {
+    const cfg = configuracao(),
+      id = campoString(f.get("id"));
+    if (!cfg || !/^\d{1,18}$/.test(id)) throw new Error();
+    const arquivo = f.get("arquivo");
+    if (!(arquivo instanceof File) || arquivo.size > 10 * 1024 * 1024) throw new Error();
+    const corpo = new FormData();
+    corpo.set("arquivo", arquivo);
+    const r = await fetch(cfg.base + "/v1/financeiro/contas-pagar/" + id + "/anexos", {
+      method: "POST",
+      headers: { authorization: "Bearer " + cfg.chave },
+      body: corpo,
+      signal: AbortSignal.timeout(30000),
+    });
+    if (!r.ok) throw new Error();
+    revalidatePath("/setores/financeiro/contas");
+    return { erro: false, mensagem: "Anexo enviado." };
+  } catch {
+    return {
+      erro: true,
+      mensagem: "Não foi possível enviar. Use PDF/JPG/PNG até 10 MB e confira o MinIO.",
+    };
+  }
+}
+export async function importarCsv(
+  _: { erro: boolean; mensagem: string; previa: string | null },
+  f: FormData,
+): Promise<{ erro: boolean; mensagem: string; previa: string | null }> {
+  try {
+    const conteudo = campoString(f.get("conteudo") ?? ""),
+      confirmar = f.get("confirmar") === "sim";
+    if (conteudo.length > 1024 * 1024) throw new Error();
+    const r = (await financeiroApi("/despesas/importar", { conteudo, confirmar })) as {
+      erros?: { linha: number; mensagem: string }[];
+      linhas?: unknown[];
+    };
+    if (confirmar) {
+      revalidatePath("/setores/financeiro/contas");
+      return { erro: false, mensagem: "Importação concluída.", previa: null };
+    }
+    return {
+      erro: Boolean(r.erros?.length),
+      mensagem: String(r.linhas?.length ?? 0) + " linhas válidas.",
+      previa: JSON.stringify(r, null, 2),
+    };
+  } catch {
+    return {
+      erro: true,
+      mensagem: "Importação recusada. Confira o layout e os dados.",
+      previa: null,
+    };
+  }
+}
diff --git a/apps/web/app/(app)/setores/financeiro/alertas/page.tsx b/apps/web/app/(app)/setores/financeiro/alertas/page.tsx
new file mode 100644
index 0000000..1ba4c96
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/alertas/page.tsx
@@ -0,0 +1,9 @@
+import { Alertas } from "../_components/Alertas.tsx";
+export default function PaginaAlertas() {
+  return (
+    <main>
+      <h1>Alertas</h1>
+      <Alertas />
+    </main>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/conciliacao/page.tsx b/apps/web/app/(app)/setores/financeiro/conciliacao/page.tsx
new file mode 100644
index 0000000..1610dd6
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/conciliacao/page.tsx
@@ -0,0 +1,77 @@
+import {
+  NavegacaoFinanceira,
+  exibir,
+  Campo,
+  Formulario,
+  Painel,
+  consultar,
+  Tabela,
+  Indisponivel,
+} from "../_components/Base.tsx";
+type Row = Record<string, unknown>;
+export default async function Conciliacao() {
+  const rows = await consultar<Row[]>("/conciliacoes");
+  return (
+    <main>
+      <h1>Conciliação financeira</h1>
+      <NavegacaoFinanceira />
+      <p>
+        Sugestões usam valor exato e uma janela de três dias. Candidatos ambíguos exigem análise
+        manual; nenhum item é aceito automaticamente.
+      </p>
+      <Painel titulo="Conciliação manual">
+        <Formulario operacao="manual" rotulo="Criar sugestão manual">
+          <label>
+            Origem
+            <select name="tipo">
+              <option value="saque">Saque</option>
+              <option value="conta_pagar">Conta paga</option>
+              <option value="lancamento">Lançamento</option>
+              <option value="venda">Venda BRL</option>
+            </select>
+          </label>
+          <Campo nome="referenciaId" rotulo="Código da origem" />
+          <Campo nome="extratoId" rotulo="Código do item de extrato" />
+          <label>
+            Valor em centavos com sinal (saída negativa)
+            <input name="valorCentavos" pattern="-?[0-9]+" required />
+          </label>
+          <Campo nome="observacao" rotulo="Observação" obrigatorio={false} />
+        </Formulario>
+      </Painel>
+      {!rows ? (
+        <Indisponivel />
+      ) : (
+        rows.map((r) => (
+          <section className="panel-card" key={String(r["id"])}>
+            <h2>
+              Conciliação #{String(r["id"])} — {String(r["estado"])}
+            </h2>
+            <p>{exibir(r["observacao"] ?? "")}</p>
+            <p>Diferença: {String(r["diferenca_centavos"])} centavos</p>
+            <Tabela
+              dados={r["itens"] as Row[]}
+              colunas={[
+                ["tipo", "Origem"],
+                ["referenciaId", "Referência"],
+                ["valorCentavos", "Valor (centavos)"],
+              ]}
+            />
+            {r["desfeita"] ? (
+              <p>Desfeita</p>
+            ) : r["recusada"] ? (
+              <p>Recusada</p>
+            ) : r["aceita"] ? (
+              <Formulario operacao="desfazer" rotulo="Desfazer" id={String(r["id"])} />
+            ) : (
+              <>
+                <Formulario operacao="aceitar" rotulo="Aceitar sugestão" id={String(r["id"])} />
+                <Formulario operacao="recusar" rotulo="Recusar sugestão" id={String(r["id"])} />
+              </>
+            )}
+          </section>
+        ))
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/contas/page.tsx b/apps/web/app/(app)/setores/financeiro/contas/page.tsx
new file mode 100644
index 0000000..ce5cefb
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/contas/page.tsx
@@ -0,0 +1,270 @@
+import Link from "next/link";
+import {
+  NavegacaoFinanceira,
+  Campo,
+  Escolha,
+  Formulario,
+  Painel,
+  consultar,
+  Tabela,
+  Indisponivel,
+} from "../_components/Base.tsx";
+import { FormularioAcao } from "../fluxo-de-caixa/_components/FormularioAcao.tsx";
+import { anexar } from "../_components/acoes.ts";
+import { ImportarDespesas } from "../_components/ImportarDespesas.tsx";
+type Row = Record<string, unknown>;
+export default async function Contas({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const f = await searchParams,
+    qs = new URLSearchParams();
+  for (const k of ["de", "ate", "status", "categoria", "fornecedor", "centro"])
+    if (f[k]) qs.set(k, f[k]);
+  const [cad, pagar, receber] = await Promise.all([
+    consultar<Record<string, Row[]>>("/cadastros"),
+    consultar<{ contas: Row[]; totais: Row[] }>("/contas-pagar?" + qs.toString()),
+    consultar<Record<string, Row[]>>("/contas-receber"),
+  ]);
+  return (
+    <main>
+      <h1>Contas a pagar e receber</h1>
+      <NavegacaoFinanceira />
+      <nav aria-label="Abas">
+        <Link href="?aba=pagar">Pagar</Link>
+        {" · "}
+        <Link href="?aba=receber">Receber</Link>
+      </nav>
+      {!cad || !pagar || !receber ? (
+        <Indisponivel />
+      ) : f["aba"] === "receber" ? (
+        <>
+          <h2>Recebimentos</h2>
+          <p>
+            Valores a receber são estimativas. Disponibilidade para saque exige saldo informado com
+            data e origem; os saques recebidos aparecem após conciliação.
+          </p>
+          <h3>Vendido</h3>
+          <Tabela
+            dados={receber["vendido"] ?? []}
+            colunas={[
+              ["moeda", "Moeda"],
+              ["valor_centavos", "Vendido (centavos)"],
+            ]}
+          />
+          <h3>A receber — estimado</h3>
+          <Tabela
+            dados={receber["aReceberEstimado"] ?? []}
+            colunas={[
+              ["id", "Código"],
+              ["descricao", "Descrição"],
+              ["valor_centavos", "Valor (centavos)"],
+              ["previsto_em", "Previsão"],
+            ]}
+          />
+          <h3>Disponível para saque — informado</h3>
+          <Tabela
+            dados={receber["disponivelInformado"] ?? []}
+            colunas={[
+              ["conta_financeira_id", "Conta"],
+              ["valor_centavos", "Valor (centavos)"],
+              ["data", "Data"],
+              ["origem", "Origem"],
+            ]}
+          />
+          <h3>Recebido — conciliado</h3>
+          <Tabela
+            dados={receber["recebidoConciliado"] ?? []}
+            colunas={[
+              ["id", "Saque"],
+              ["liquido_centavos", "Líquido (centavos)"],
+              ["data", "Data"],
+            ]}
+          />
+          <Painel titulo="Novo recebimento">
+            <Formulario operacao="receber" rotulo="Cadastrar">
+              <Campo nome="descricao" rotulo="Descrição" />
+              <Campo nome="valor" rotulo="Valor (R$)" />
+              <Campo nome="previstoEm" rotulo="Data prevista" tipo="date" />
+              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Regra de liberação">
+            <Formulario operacao="regra" rotulo="Salvar">
+              <Campo nome="pagamento" rotulo="Forma de pagamento (ex.: CREDIT_CARD)" />
+              <Campo nome="dias" rotulo="Dias para liberação" tipo="number" />
+            </Formulario>
+            <Tabela
+              dados={cad["regras"] ?? []}
+              colunas={[
+                ["pagamento", "Forma"],
+                ["dias", "Dias"],
+              ]}
+            />
+          </Painel>
+        </>
+      ) : (
+        <>
+          <form>
+            <label>
+              De
+              <input name="de" type="date" defaultValue={f["de"]} />
+            </label>
+            <label>
+              Até
+              <input name="ate" type="date" defaultValue={f["ate"]} />
+            </label>
+            <label>
+              Status
+              <select name="status" defaultValue={f["status"] ?? ""}>
+                <option value="">Todos</option>
+                <option value="aberta">Aberta</option>
+                <option value="paga">Paga</option>
+                <option value="cancelada">Cancelada</option>
+              </select>
+            </label>
+            <Campo nome="categoria" rotulo="Categoria" obrigatorio={false} />
+            <Campo nome="fornecedor" rotulo="Código do fornecedor" obrigatorio={false} />
+            <Campo nome="centro" rotulo="Código do centro de custo" obrigatorio={false} />
+            <button>Filtrar</button>
+          </form>
+          <Painel titulo="Nova despesa">
+            <Formulario operacao="despesa" rotulo="Cadastrar">
+              <Campo nome="descricao" rotulo="Descrição" />
+              <Campo nome="valor" rotulo="Valor total (R$)" />
+              <Campo nome="vencimento" rotulo="Primeiro vencimento" tipo="date" />
+              <Campo nome="competencia" rotulo="Competência" tipo="date" obrigatorio={false} />
+              <Campo nome="categoria" rotulo="Categoria cadastrada" />
+              <Campo nome="fornecedorId" rotulo="Código do fornecedor" obrigatorio={false} />
+              <Campo nome="centroCustoId" rotulo="Código do centro de custo" obrigatorio={false} />
+              <Campo
+                nome="parcelas"
+                rotulo="Parcelas (1 a 120)"
+                tipo="number"
+                obrigatorio={false}
+              />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Nova conta recorrente">
+            <Formulario operacao="recorrente" rotulo="Cadastrar recorrência">
+              <Campo nome="descricao" rotulo="Descrição" />
+              <Campo nome="categoria" rotulo="Categoria cadastrada" />
+              <Campo nome="valor" rotulo="Valor (R$)" />
+              <Campo nome="diaVencimento" rotulo="Dia do vencimento (1 a 31)" tipo="number" />
+              <Campo nome="inicio" rotulo="Início — primeiro dia do mês" tipo="date" />
+              <Campo
+                nome="fim"
+                rotulo="Fim — primeiro dia do mês"
+                tipo="date"
+                obrigatorio={false}
+              />
+              <label>
+                Periodicidade
+                <select name="periodicidade">
+                  <option value="mensal">Mensal</option>
+                  <option value="anual">Anual</option>
+                </select>
+              </label>
+              <Campo nome="fornecedorId" rotulo="Código do fornecedor" obrigatorio={false} />
+              <Campo nome="centroCustoId" rotulo="Código do centro de custo" obrigatorio={false} />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Importar despesas">
+            <ImportarDespesas />
+          </Painel>
+          <Painel titulo="Cadastros">
+            <h3>Fornecedor</h3>
+            <Formulario operacao="fornecedor" rotulo="Cadastrar fornecedor">
+              <Campo nome="nome" rotulo="Nome" />
+              <Campo nome="documento" rotulo="CPF/CNPJ" obrigatorio={false} />
+              <Campo nome="contato" rotulo="Contato" obrigatorio={false} />
+            </Formulario>
+            <Tabela
+              dados={cad["fornecedores"] ?? []}
+              colunas={[
+                ["id", "Código"],
+                ["nome", "Fornecedor"],
+                ["documento", "Documento"],
+              ]}
+            />
+            <h3>Centro de custo</h3>
+            <Formulario operacao="centro" rotulo="Cadastrar centro">
+              <Campo nome="nome" rotulo="Nome" />
+            </Formulario>
+            <Tabela
+              dados={cad["centros"] ?? []}
+              colunas={[
+                ["id", "Código"],
+                ["nome", "Centro"],
+              ]}
+            />
+          </Painel>
+          <h2>Contas</h2>
+          <Tabela
+            dados={pagar.contas}
+            colunas={[
+              ["id", "Código"],
+              ["descricao", "Descrição"],
+              ["valor_centavos", "Valor (centavos)"],
+              ["vencimento", "Vencimento"],
+              ["status", "Status"],
+              ["parcela", "Parcela"],
+              ["parcelas", "Total de parcelas"],
+            ]}
+          />
+          {pagar.contas.map((c) => (
+            <details key={String(c["id"])}>
+              <summary>
+                Ações — {String(c["descricao"])} (#{String(c["id"])})
+              </summary>
+              {c["status"] === "aberta" && (
+                <>
+                  <Formulario operacao="pagar" rotulo="Registrar pagamento" id={String(c["id"])}>
+                    <Campo nome="data" rotulo="Data do pagamento" tipo="date" />
+                    <Escolha
+                      nome="contaFinanceiraId"
+                      rotulo="Conta de saída"
+                      opcoes={cad["contas"] ?? []}
+                    />
+                  </Formulario>
+                  <Formulario operacao="cancelar" rotulo="Cancelar conta" id={String(c["id"])} />
+                </>
+              )}
+              <FormularioAcao acao={anexar} rotulo="Enviar anexo" rotuloPendente="Enviando…">
+                <input type="hidden" name="id" value={String(c["id"])} />
+                <label>
+                  PDF/JPG/PNG até 10 MB
+                  <input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
+                </label>
+              </FormularioAcao>
+              <ul>
+                {(Array.isArray(c["anexos"]) ? (c["anexos"] as Row[]) : []).map((a) => (
+                  <li key={String(a["id"])}>
+                    <a href={"/api/financeiro/anexos/" + encodeURIComponent(String(a["id"]))}>
+                      Baixar {String(a["nome"])}
+                    </a>
+                  </li>
+                ))}
+              </ul>
+            </details>
+          ))}
+          <h2>Totais por categoria</h2>
+          <Tabela
+            dados={pagar.totais}
+            colunas={[
+              ["categoria", "Categoria"],
+              ["status", "Status"],
+              ["total_centavos", "Total (centavos)"],
+            ]}
+          />
+          <p>
+            <Link href="/setores/financeiro/fluxo-de-caixa">
+              Configurar contas recorrentes no fluxo de caixa
+            </Link>
+          </p>
+        </>
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/movimentacoes/page.tsx b/apps/web/app/(app)/setores/financeiro/movimentacoes/page.tsx
new file mode 100644
index 0000000..e8d0dbc
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/movimentacoes/page.tsx
@@ -0,0 +1,124 @@
+import {
+  NavegacaoFinanceira,
+  Campo,
+  Escolha,
+  Formulario,
+  Painel,
+  consultar,
+  Tabela,
+  Indisponivel,
+} from "../_components/Base.tsx";
+type Row = Record<string, unknown>;
+export default async function Movimentacoes({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const f = await searchParams,
+    qs = new URLSearchParams();
+  for (const k of ["de", "ate", "conta"]) if (f[k]) qs.set(k, f[k]);
+  const [cad, mov, itens] = await Promise.all([
+    consultar<Record<string, Row[]>>("/cadastros"),
+    consultar<Row[]>("/movimentacoes?" + qs.toString()),
+    consultar<Row[]>("/extratos/itens"),
+  ]);
+  return (
+    <main>
+      <h1>Movimentações</h1>
+      <NavegacaoFinanceira />
+      {!cad || !mov || !itens ? (
+        <Indisponivel />
+      ) : (
+        <>
+          <form>
+            <Campo nome="de" rotulo="De" tipo="date" obrigatorio={false} />
+            <Campo nome="ate" rotulo="Até" tipo="date" obrigatorio={false} />
+            <Escolha nome="conta" rotulo="Conta" opcoes={cad["contas"] ?? []} />
+            <button>Filtrar</button>
+          </form>
+          <Painel titulo="Nova conta financeira">
+            <Formulario operacao="conta" rotulo="Cadastrar">
+              <Campo nome="nome" rotulo="Nome" />
+              <label>
+                Tipo
+                <select name="tipo">
+                  <option value="banco">Banco</option>
+                  <option value="caixa">Caixa</option>
+                  <option value="plataforma">Plataforma</option>
+                </select>
+              </label>
+            </Formulario>
+          </Painel>
+          <Painel titulo="Transferir">
+            <Formulario operacao="transferencia" rotulo="Registrar transferência">
+              <Escolha nome="origemId" rotulo="Conta de origem" opcoes={cad["contas"] ?? []} />
+              <Escolha nome="destinoId" rotulo="Conta de destino" opcoes={cad["contas"] ?? []} />
+              <Campo nome="data" rotulo="Data" tipo="date" />
+              <Campo nome="valor" rotulo="Valor (R$)" />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Registrar saque Hotmart">
+            <Formulario operacao="saque" rotulo="Registrar saque">
+              <Escolha nome="destinoId" rotulo="Conta de destino" opcoes={cad["contas"] ?? []} />
+              <Campo nome="data" rotulo="Data" tipo="date" />
+              <Campo nome="valor" rotulo="Valor bruto (R$)" />
+              <Campo nome="taxa" rotulo="Taxa (R$)" obrigatorio={false} />
+              <Campo nome="comprovante" rotulo="Referência do comprovante" obrigatorio={false} />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Informar saldo disponível">
+            <Formulario operacao="saldo" rotulo="Salvar saldo informado">
+              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
+              <Campo nome="data" rotulo="Data de referência" tipo="date" />
+              <Campo nome="valor" rotulo="Saldo disponível informado (R$)" />
+            </Formulario>
+          </Painel>
+          <Painel titulo="Importar extrato">
+            <p>
+              CSV: data;valor;fitid;memo. Valor decimal com sinal, datas AAAA-MM-DD. OFX: STMTTRN
+              com DTPOSTED, TRNAMT e FITID.
+            </p>
+            <Formulario operacao="extrato" rotulo="Importar">
+              <Escolha nome="contaFinanceiraId" rotulo="Conta" opcoes={cad["contas"] ?? []} />
+              <label>
+                Formato
+                <select name="formato">
+                  <option value="ofx">OFX</option>
+                  <option value="csv">CSV</option>
+                </select>
+              </label>
+              <label>
+                Conteúdo
+                <textarea name="conteudo" rows={8} maxLength={1048576} required />
+              </label>
+            </Formulario>
+          </Painel>
+          <h2>Lançamentos</h2>
+          <Tabela
+            dados={mov}
+            colunas={[
+              ["id", "Código"],
+              ["data", "Data"],
+              ["tipo", "Tipo"],
+              ["descricao", "Descrição"],
+              ["valor_centavos", "Valor (centavos)"],
+              ["conta_financeira_id", "Conta"],
+              ["transferencia_id", "Transferência"],
+            ]}
+          />
+          <h2>Extrato não conciliado</h2>
+          <Tabela
+            dados={itens}
+            colunas={[
+              ["id", "Código"],
+              ["data", "Data"],
+              ["memo", "Descrição"],
+              ["valor_centavos", "Valor (centavos)"],
+              ["conta_financeira_id", "Conta"],
+            ]}
+          />
+        </>
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx b/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx
index fc8a848..486daeb 100644
--- a/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx
+++ b/apps/web/app/(app)/setores/financeiro/vendas/_components/UltimasVendas.tsx
@@ -14,0 +15 @@ const GRUPO_BADGE = {
+  contestada: "badge badge--danger",
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/page.tsx b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
index 7d3f58c..7450348 100644
--- a/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
+++ b/apps/web/app/(app)/setores/financeiro/vendas/page.tsx
@@ -78,0 +79,3 @@ async function PainelCompleto({
+      <a href="/setores/financeiro/vendas/receitas">
+        Receitas detalhadas, comissões e histórico de status
+      </a>
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/receitas/[transacao]/page.tsx b/apps/web/app/(app)/setores/financeiro/vendas/receitas/[transacao]/page.tsx
new file mode 100644
index 0000000..77da468
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/receitas/[transacao]/page.tsx
@@ -0,0 +1,58 @@
+import {
+  NavegacaoFinanceira,
+  consultar,
+  Tabela,
+  Indisponivel,
+} from "../../../_components/Base.tsx";
+type Row = Record<string, unknown>;
+export default async function Detalhe({ params }: { params: Promise<{ transacao: string }> }) {
+  const { transacao } = await params,
+    r = await consultar<{ venda: Row | null; eventos: Row[]; comissoes: Row[] }>(
+      "/vendas/" + encodeURIComponent(transacao),
+    );
+  return (
+    <main>
+      <h1>Detalhe da transação</h1>
+      <NavegacaoFinanceira />
+      {!r ? (
+        <Indisponivel />
+      ) : !r.venda ? (
+        <p>Transação não encontrada.</p>
+      ) : (
+        <>
+          <h2>{transacao}</h2>
+          <Tabela
+            dados={[r.venda]}
+            colunas={[
+              ["produto_nome", "Produto"],
+              ["oferta_codigo", "Oferta"],
+              ["comprador_id", "Comprador"],
+              ["status", "Status"],
+              ["moeda", "Moeda"],
+              ["liquido_centavos", "Líquido (centavos)"],
+            ]}
+          />
+          <h2>Histórico de status</h2>
+          <Tabela
+            dados={r.eventos}
+            colunas={[
+              ["ocorrido_em", "Quando"],
+              ["status_anterior", "Anterior"],
+              ["status_novo", "Novo"],
+              ["origem", "Origem"],
+            ]}
+          />
+          <h2>Comissões</h2>
+          <Tabela
+            dados={r.comissoes}
+            colunas={[
+              ["tipo", "Papel"],
+              ["moeda", "Moeda"],
+              ["valor_centavos", "Valor (centavos)"],
+            ]}
+          />
+        </>
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/(app)/setores/financeiro/vendas/receitas/page.tsx b/apps/web/app/(app)/setores/financeiro/vendas/receitas/page.tsx
new file mode 100644
index 0000000..e191e5f
--- /dev/null
+++ b/apps/web/app/(app)/setores/financeiro/vendas/receitas/page.tsx
@@ -0,0 +1,94 @@
+import Link from "next/link";
+import {
+  NavegacaoFinanceira,
+  Campo,
+  Formulario,
+  Painel,
+  consultar,
+  Tabela,
+  Indisponivel,
+} from "../../_components/Base.tsx";
+type Row = Record<string, unknown>;
+export default async function Receitas({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const f = await searchParams,
+    qs = new URLSearchParams();
+  for (const k of ["de", "ate", "moeda", "produto", "status", "comprador"])
+    if (f[k]) qs.set(k, f[k]);
+  const rows = await consultar<Row[]>("/vendas?" + qs.toString());
+  return (
+    <main>
+      <h1>Receitas e vendas</h1>
+      <NavegacaoFinanceira />
+      <form>
+        <Campo nome="de" rotulo="De" tipo="date" obrigatorio={false} />
+        <Campo nome="ate" rotulo="Até" tipo="date" obrigatorio={false} />
+        <Campo nome="moeda" rotulo="Moeda (padrão BRL)" obrigatorio={false} />
+        <Campo nome="produto" rotulo="Código do produto" obrigatorio={false} />
+        <Campo nome="comprador" rotulo="Pseudônimo do comprador" obrigatorio={false} />
+        <label>
+          Status
+          <select name="status">
+            <option value="">Todos</option>
+            <option value="receita">Aprovadas</option>
+            <option value="pendente">Pendentes</option>
+            <option value="cancelada">Canceladas</option>
+            <option value="reembolso">Reembolsadas</option>
+            <option value="contestada">Contestadas</option>
+          </select>
+        </label>
+        <button>Filtrar</button>
+      </form>
+      <p>
+        Preço efetivo da venda; desconto desconhecido é exibido como “—” e não é deduzido novamente.
+        Valores monetários da tabela em centavos, com moeda explícita.
+      </p>
+      <Painel titulo="Importar histórico">
+        <Formulario operacao="historico" rotulo="Enfileirar importação">
+          <Campo nome="inicio" rotulo="Início" tipo="date" />
+          <Campo nome="fim" rotulo="Fim" tipo="date" />
+          <p>Até 366 dias. Acompanhe o progresso no histórico de execuções.</p>
+        </Formulario>
+      </Painel>
+      {!rows ? (
+        <Indisponivel />
+      ) : (
+        <>
+          <Tabela
+            dados={rows}
+            colunas={[
+              ["transacao", "Transação"],
+              ["produto_nome", "Produto"],
+              ["comprador_id", "Comprador"],
+              ["status", "Status"],
+              ["valor_centavos", "Bruto"],
+              ["desconto_centavos", "Desconto"],
+              ["taxa_centavos", "Taxa"],
+              ["comissoes_centavos", "Comissões"],
+              ["liquido_centavos", "Líquido"],
+              ["parcelas", "Parcelas"],
+              ["moeda", "Moeda"],
+            ]}
+          />
+          <ul>
+            {rows.map((r) => (
+              <li key={String(r["transacao"])}>
+                <Link
+                  href={
+                    "/setores/financeiro/vendas/receitas/" +
+                    encodeURIComponent(String(r["transacao"]))
+                  }
+                >
+                  Detalhe {String(r["transacao"])}
+                </Link>
+              </li>
+            ))}
+          </ul>
+        </>
+      )}
+    </main>
+  );
+}
diff --git a/apps/web/app/api/financeiro/anexos/[id]/route.ts b/apps/web/app/api/financeiro/anexos/[id]/route.ts
new file mode 100644
index 0000000..dbd14a6
--- /dev/null
+++ b/apps/web/app/api/financeiro/anexos/[id]/route.ts
@@ -0,0 +1,28 @@
+import { configuracao } from "../../../../../lib/vendas-api.ts";
+export async function GET(
+  _req: Request,
+  { params }: { params: Promise<{ id: string }> },
+): Promise<Response> {
+  const { id } = await params,
+    cfg = configuracao();
+  if (!cfg) return new Response("Anexos indisponíveis", { status: 503 });
+  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
+  try {
+    const r = await fetch(cfg.base + "/v1/financeiro/anexos/" + id, {
+      headers: { authorization: "Bearer " + cfg.chave },
+      cache: "no-store",
+      signal: AbortSignal.timeout(30000),
+    });
+    if (!r.ok) return new Response("Anexo indisponível", { status: r.status === 404 ? 404 : 503 });
+    return new Response(r.body, {
+      headers: {
+        "content-type": r.headers.get("content-type") ?? "application/octet-stream",
+        "content-disposition": r.headers.get("content-disposition") ?? "attachment",
+        "cache-control": "private, no-store",
+        "x-content-type-options": "nosniff",
+      },
+    });
+  } catch {
+    return new Response("Anexos indisponíveis", { status: 503 });
+  }
+}
diff --git a/apps/web/lib/financeiro-api.ts b/apps/web/lib/financeiro-api.ts
new file mode 100644
index 0000000..54443ca
--- /dev/null
+++ b/apps/web/lib/financeiro-api.ts
@@ -0,0 +1,16 @@
+import { configuracao } from "./vendas-api.ts";
+/** Exclusivamente servidor: a credencial nunca integra propriedades de componentes cliente. */
+export async function financeiroApi(caminho: string, corpo?: unknown): Promise<unknown> {
+  const cfg = configuracao();
+  if (!cfg) throw new Error("API financeira nao configurada");
+  const r = await fetch(`${cfg.base}/v1/financeiro${caminho}`, {
+    method: corpo === undefined ? "GET" : "POST",
+    headers: { authorization: `Bearer ${cfg.chave}`, "content-type": "application/json" },
+    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
+    cache: "no-store",
+    signal: AbortSignal.timeout(10000),
+  });
+  if (!r.ok) throw new Error(`Operacao financeira recusada (${r.status})`);
+  const t = await r.text();
+  return t ? (JSON.parse(t) as unknown) : null;
+}
diff --git a/apps/web/next.config.mjs b/apps/web/next.config.mjs
index b052a3f..34afd7d 100644
--- a/apps/web/next.config.mjs
+++ b/apps/web/next.config.mjs
@@ -12 +12,4 @@ try {
-const nextConfig = { reactStrictMode: true };
+const nextConfig = {
+  reactStrictMode: true,
+  experimental: { serverActions: { bodySizeLimit: "11mb" } },
+};
diff --git a/packages/config/src/financeiro.test.ts b/packages/config/src/financeiro.test.ts
new file mode 100644
index 0000000..ea8c0e7
--- /dev/null
+++ b/packages/config/src/financeiro.test.ts
@@ -0,0 +1,23 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { loadFinanceiroConfig } from "./financeiro.js";
+import { ConfigError } from "./load.js";
+test("financeiro permanece desativado sem credenciais e nao ecoa segredo", () => {
+  assert.equal(loadFinanceiroConfig({}).anexos, undefined);
+  assert.equal(loadFinanceiroConfig({}).webhookHottok, undefined);
+  const cfg = loadFinanceiroConfig({ HOTMART_WEBHOOK_HOTTOK: "somente-teste-ficticio" });
+  assert.equal(JSON.stringify(cfg).includes("somente-teste-ficticio"), false);
+});
+test("MinIO exige conjunto completo e segredo usa Secret", () => {
+  assert.throws(
+    () => loadFinanceiroConfig({ MINIO_ENDPOINT: "http://127.0.0.1:19000" }),
+    ConfigError,
+  );
+  const cfg = loadFinanceiroConfig({
+    MINIO_ENDPOINT: "http://127.0.0.1:19000",
+    MINIO_ACCESS_KEY: "teste-access-ficticio",
+    MINIO_SECRET_KEY: "teste-secret-ficticio",
+  });
+  assert.equal(cfg.anexos?.bucket, "nucleos-financeiro");
+  assert.equal(JSON.stringify(cfg).includes("teste-secret-ficticio"), false);
+});
diff --git a/packages/config/src/financeiro.ts b/packages/config/src/financeiro.ts
new file mode 100644
index 0000000..6227e9d
--- /dev/null
+++ b/packages/config/src/financeiro.ts
@@ -0,0 +1,56 @@
+import { z } from "zod";
+import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
+import { absolutePathSchema } from "./primitives.js";
+import type { Secret } from "./secret.js";
+export interface FinanceiroConfig {
+  webhookHottok: Secret | undefined;
+  anexos: { endpoint: string; bucket: string; accessKey: Secret; secretKey: Secret } | undefined;
+}
+export function loadFinanceiroConfig(
+  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
+): FinanceiroConfig {
+  const e = parseConfig(
+    z.object({
+      HOTMART_WEBHOOK_HOTTOK: z.string().optional(),
+      HOTMART_WEBHOOK_HOTTOK_FILE: absolutePathSchema.optional(),
+      MINIO_ENDPOINT: z.url().optional(),
+      MINIO_FINANCEIRO_BUCKET: z
+        .string()
+        .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
+        .default("nucleos-financeiro"),
+      MINIO_ACCESS_KEY: z.string().optional(),
+      MINIO_ACCESS_KEY_FILE: absolutePathSchema.optional(),
+      MINIO_SECRET_KEY: z.string().optional(),
+      MINIO_SECRET_KEY_FILE: absolutePathSchema.optional(),
+    }),
+    env,
+  );
+  const accessKey = loadOptionalSecret(
+    "MINIO_ACCESS_KEY",
+    e.MINIO_ACCESS_KEY,
+    e.MINIO_ACCESS_KEY_FILE,
+  );
+  const secretKey = loadOptionalSecret(
+    "MINIO_SECRET_KEY",
+    e.MINIO_SECRET_KEY,
+    e.MINIO_SECRET_KEY_FILE,
+  );
+  if (
+    [e.MINIO_ENDPOINT, accessKey, secretKey].some((v) => v !== undefined) &&
+    [e.MINIO_ENDPOINT, accessKey, secretKey].some((v) => v === undefined)
+  )
+    throw new ConfigError([
+      { key: "MINIO_ENDPOINT", message: "configure endpoint e duas credenciais juntos" },
+    ]);
+  return {
+    webhookHottok: loadOptionalSecret(
+      "HOTMART_WEBHOOK_HOTTOK",
+      e.HOTMART_WEBHOOK_HOTTOK,
+      e.HOTMART_WEBHOOK_HOTTOK_FILE,
+    ),
+    anexos:
+      e.MINIO_ENDPOINT && accessKey && secretKey
+        ? { endpoint: e.MINIO_ENDPOINT, bucket: e.MINIO_FINANCEIRO_BUCKET, accessKey, secretKey }
+        : undefined,
+  };
+}
diff --git a/packages/config/src/index.ts b/packages/config/src/index.ts
index 911b862..0229d2e 100644
--- a/packages/config/src/index.ts
+++ b/packages/config/src/index.ts
@@ -18,0 +19 @@ export { MAX_SECRET_BYTES, Secret, SecretFileError, readSecretFile } from "./sec
+export { loadFinanceiroConfig, type FinanceiroConfig } from "./financeiro.js";
diff --git a/packages/contracts/src/fluxo-caixa.ts b/packages/contracts/src/fluxo-caixa.ts
index e77d938..b02b65c 100644
--- a/packages/contracts/src/fluxo-caixa.ts
+++ b/packages/contracts/src/fluxo-caixa.ts
@@ -32,0 +33 @@ export interface ContaRecorrente {
+  periodicidade?: "mensal" | "anual";
diff --git a/packages/contracts/src/vendas.ts b/packages/contracts/src/vendas.ts
index c3216fc..f88407d 100644
--- a/packages/contracts/src/vendas.ts
+++ b/packages/contracts/src/vendas.ts
@@ -8 +8 @@
-export type GrupoStatusVenda = "receita" | "reembolso" | "cancelada" | "pendente";
+export type GrupoStatusVenda = "receita" | "reembolso" | "cancelada" | "pendente" | "contestada";
@@ -14,0 +15 @@ export const GRUPOS_STATUS_VENDA: readonly GrupoStatusVenda[] = [
+  "contestada",
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 685c79b..39c38da 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -205,0 +206,3 @@ importers:
+      '@aws-sdk/client-s3':
+        specifier: 3.1161.0
+        version: 3.1161.0
@@ -326,0 +330,72 @@ packages:
+  '@aws-sdk/checksums@3.1002.1':
+    resolution: {integrity: sha512-CXNESwkQC9jdrUG6cKXBfudVt1frGcYQykcCYbNclVrsewuGMbo3PlFjRteMe4OftNAqhyc3xC2jTz7SUqLasQ==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/client-s3@3.1161.0':
+    resolution: {integrity: sha512-iRZGMsJnYRrI98O+U6o5fHeLPQTP+Dc/w0mWLcBLQcEQ10DA06+XQj0WmdRiCM7vIso7QEtN1fsj9Vzo5/R3LQ==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/core@3.979.1':
+    resolution: {integrity: sha512-ayOlV1VhLNMiq8PW9ZkVobG4gkldnUoHjG69yy2b8j+VYFlhz/uAL7ZdYQAoQ+eShtGUdNDnnG5rxDg6yUJrOg==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-env@3.972.80':
+    resolution: {integrity: sha512-uO5TiSvb6j1w9RTe5z28OaOmsrOxVQUPaC5+wZl50RfOXcrYD/KgnS8I9lfyGXc7sGbkCopK6VnhNIAoLqfewQ==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-http@3.972.82':
+    resolution: {integrity: sha512-vQzlDHlC24Yz42p+rT4NBoP/5VdetkBoujbOLq9h6QYWC8THuZSPYnXIR9OP3XcOrdMgPBBipOrdssfxnIiWUg==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-ini@3.973.25':
+    resolution: {integrity: sha512-b5xl71uCRdWsu7P1VeGpiGuCf6zfYETsSNOv8AmYVTrsgbvTJRXdmmOPVfxkvGGVNsiKkGctClQW3jAn0SZLug==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-login@3.972.87':
+    resolution: {integrity: sha512-C4ZFmcwM+Zj14Z8huVUk54Gv4uzT1ZdzG9cY3Gdh8FePakq7Bss1OFsgZjAhWFOkFOGpBvFBeu0OWjWf8HNKRQ==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-node@3.972.92':
+    resolution: {integrity: sha512-jC3zmOo7Qxlk+oBivvSsS1Ph7sFGm0QfuhqDGbqgRXi4cxUYMG+dWtBwS2XYYXgc8TIVXJiwgQ65sbNpbYupTA==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-process@3.972.80':
+    resolution: {integrity: sha512-xqfixO5aclje7tbQJDias+iNND5wp/3QZixCdZcVQpgWPTZ0V5DfTW9A804A5Z7ezu7sH3WRO+vzUjtiJBA8yg==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-sso@3.973.24':
+    resolution: {integrity: sha512-nlg3BKG03Cgzvv/dMnhxvDJPhAhQSpaN0RUdwgU7ziwkasoev7iI8el8Xy4Rd5sqzgaDUbV269fOXck5SargqA==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/credential-provider-web-identity@3.972.86':
+    resolution: {integrity: sha512-zKTyLJBEyfQBVlYqT6Jt+mYV4r8kGbWM7dn6v4Y4MRARizhYafjDXP/iMu76UMRhToSPNmIKX1XAb24gtpBFIA==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/middleware-sdk-s3@3.972.85':
+    resolution: {integrity: sha512-Kyl2G6zhIS9qFoeLdlxvXFrWyc6g9D9ZCIRJnGkkfX6JZhxCZB5ebXBc7GKEeetrnhXcail6ALZT0lKbojcaNA==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/nested-clients@3.997.54':
+    resolution: {integrity: sha512-/OczlavsS7U5sOodRO10Ug4R/AKFVZiXTstKipWe68EfjPkmdDFNXNl9FCJyXWkg1DG6RBm3qAuVB8FNW9O8KQ==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/signature-v4-multi-region@3.996.51':
+    resolution: {integrity: sha512-+aHvUugVBuMPXxgkPfWnTMyGdE/yWS8GHi5+qQ37HowS0YqzrbuaDLznj+Dtmtu5jgCdqz36gXmujOToUhNNWw==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/token-providers@3.1161.0':
+    resolution: {integrity: sha512-ypbXSofNcSHwf/KA40bFCXJb0MLaAKrfT7sot4dFaA+2lsuXNah4zLRJIAU7Qmvs9PFJ6rnY0bZFEC+mE7attA==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/types@3.975.0':
+    resolution: {integrity: sha512-WQlhs6juByzWOzj5fwxOx0mPJaEqMcG/sDpl3Id61B3XhKE63xY+0QWcnG+sWR/sCfprmreyUo1lM7IKZmHMzw==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws-sdk/xml-builder@3.972.42':
+    resolution: {integrity: sha512-smX8/gNP8Kjq+CWTBMZQLQ912vOQjiWExzwzvMO+eujPB5RY8IbtF0AGdUUXHKN7KoDWK9dIcuW0WG269kiP6w==}
+    engines: {node: '>=20.0.0'}
+
+  '@aws/lambda-invoke-store@0.3.0':
+    resolution: {integrity: sha512-sl4Bm6yiMNYrZKkqqDFWN0UfnWhlS8ivKxrYl+6t0gCLrqr8y3B2IqZZbFRkfaVVp7C/baApyh71P+LeE1A2sQ==}
+    engines: {node: '>=18.0.0'}
+
@@ -753,0 +829,24 @@ packages:
+  '@smithy/core@3.38.1':
+    resolution: {integrity: sha512-U/mB2XiwTLaf+NSgLSWwJfptsMT/H8aBi0aTAA/E5e2/TagFeGCqAyhKGG0w0A9IWTkm4qYEmLoD/HB6aYfnRA==}
+    engines: {node: '>=18.0.0'}
+
+  '@smithy/credential-provider-imds@4.5.2':
+    resolution: {integrity: sha512-A9uSdn72ozbRUSit0eib0TW7nXuNPlaeM0zcGkJ+nE6tFcSDbnmtwoxbTCFBukVQcszDAyvsd7+rTduPTXpygg==}
+    engines: {node: '>=18.0.0'}
+
+  '@smithy/fetch-http-handler@5.8.0':
+    resolution: {integrity: sha512-ycSJu3tFAQ4v04CBB0agqFMVsSQ1iG3yw+SpgxRqKfaURpQD4CZ8Wn0zPMmSnOuTpTh65Vz+EA0rMrw089wvkA==}
+    engines: {node: '>=18.0.0'}
+
+  '@smithy/node-http-handler@4.14.1':
+    resolution: {integrity: sha512-/T6E1jzCL0fErS9uq8JqES/5yYQQ4ppVmmYHwXw2nlov8KFzLb+3QqHR5iAun1BsuAB50IPxZliV8YMgghLwhA==}
+    engines: {node: '>=18.0.0'}
+
+  '@smithy/signature-v4@5.7.5':
+    resolution: {integrity: sha512-WPjdr5oWOk1LArpI4pavu+fSo+/evi0Re1olxGvqwuZopd4gYR1UGCi+Soyn/IjmafqbWs+ZC+3AKxJS3ZpwUg==}
+    engines: {node: '>=18.0.0'}
+
+  '@smithy/types@4.19.0':
+    resolution: {integrity: sha512-r7jh49VJxGerfAcTQA6gXcKc+98zOp/tqRwzYjgOE+iSQsP6cEU1hq2QzbuipmP68QtYdY9wKEhiCQZIzHgZ4Q==}
+    engines: {node: '>=18.0.0'}
+
@@ -950,0 +1050,3 @@ packages:
+  bowser@2.15.0:
+    resolution: {integrity: sha512-xic6KSZglg/I4ymp45fdM4GWfYpBK79Fxd/TOvJktlaPgQqqDxvmGwOPZl2V0dyeS3Lj5c180bLhXF43iyAjZQ==}
+
@@ -1993,0 +2096,165 @@ snapshots:
+  '@aws-sdk/checksums@3.1002.1':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/client-s3@3.1161.0':
+    dependencies:
+      '@aws-sdk/checksums': 3.1002.1
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/credential-provider-node': 3.972.92
+      '@aws-sdk/middleware-sdk-s3': 3.972.85
+      '@aws-sdk/signature-v4-multi-region': 3.996.51
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/fetch-http-handler': 5.8.0
+      '@smithy/node-http-handler': 4.14.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/core@3.979.1':
+    dependencies:
+      '@aws-sdk/types': 3.975.0
+      '@aws-sdk/xml-builder': 3.972.42
+      '@aws/lambda-invoke-store': 0.3.0
+      '@smithy/core': 3.38.1
+      '@smithy/signature-v4': 5.7.5
+      '@smithy/types': 4.19.0
+      bowser: 2.15.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-env@3.972.80':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-http@3.972.82':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/fetch-http-handler': 5.8.0
+      '@smithy/node-http-handler': 4.14.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-ini@3.973.25':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/credential-provider-env': 3.972.80
+      '@aws-sdk/credential-provider-http': 3.972.82
+      '@aws-sdk/credential-provider-login': 3.972.87
+      '@aws-sdk/credential-provider-process': 3.972.80
+      '@aws-sdk/credential-provider-sso': 3.973.24
+      '@aws-sdk/credential-provider-web-identity': 3.972.86
+      '@aws-sdk/nested-clients': 3.997.54
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/credential-provider-imds': 4.5.2
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-login@3.972.87':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/nested-clients': 3.997.54
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-node@3.972.92':
+    dependencies:
+      '@aws-sdk/credential-provider-env': 3.972.80
+      '@aws-sdk/credential-provider-http': 3.972.82
+      '@aws-sdk/credential-provider-ini': 3.973.25
+      '@aws-sdk/credential-provider-process': 3.972.80
+      '@aws-sdk/credential-provider-sso': 3.973.24
+      '@aws-sdk/credential-provider-web-identity': 3.972.86
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/credential-provider-imds': 4.5.2
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-process@3.972.80':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-sso@3.973.24':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/nested-clients': 3.997.54
+      '@aws-sdk/token-providers': 3.1161.0
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/credential-provider-web-identity@3.972.86':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/nested-clients': 3.997.54
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/middleware-sdk-s3@3.972.85':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/signature-v4-multi-region': 3.996.51
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/nested-clients@3.997.54':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/signature-v4-multi-region': 3.996.51
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/fetch-http-handler': 5.8.0
+      '@smithy/node-http-handler': 4.14.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/signature-v4-multi-region@3.996.51':
+    dependencies:
+      '@aws-sdk/types': 3.975.0
+      '@smithy/signature-v4': 5.7.5
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/token-providers@3.1161.0':
+    dependencies:
+      '@aws-sdk/core': 3.979.1
+      '@aws-sdk/nested-clients': 3.997.54
+      '@aws-sdk/types': 3.975.0
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/types@3.975.0':
+    dependencies:
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws-sdk/xml-builder@3.972.42':
+    dependencies:
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@aws/lambda-invoke-store@0.3.0': {}
+
@@ -2345,0 +2613,33 @@ snapshots:
+  '@smithy/core@3.38.1':
+    dependencies:
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@smithy/credential-provider-imds@4.5.2':
+    dependencies:
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@smithy/fetch-http-handler@5.8.0':
+    dependencies:
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@smithy/node-http-handler@4.14.1':
+    dependencies:
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@smithy/signature-v4@5.7.5':
+    dependencies:
+      '@smithy/core': 3.38.1
+      '@smithy/types': 4.19.0
+      tslib: 2.8.1
+
+  '@smithy/types@4.19.0':
+    dependencies:
+      tslib: 2.8.1
+
@@ -2564,0 +2865,2 @@ snapshots:
+  bowser@2.15.0: {}
+
```
