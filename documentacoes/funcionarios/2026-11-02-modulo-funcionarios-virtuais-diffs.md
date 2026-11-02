# Patch da frente A — Funcionários virtuais

Data: 2026-11-02. Base: `a2aa0ccc56938dd1e27ffaf52cd24646d68848dd`.

[Registro da entrega](2026-11-02-modulo-funcionarios-virtuais.md).

Nenhum commit criado nesta etapa de preparação; diff staged real abaixo.
Documentação/lessons são listadas no registro e não repetidas no próprio patch.

## Arquivos de código, testes e configuração

- `.gitattributes`
- `apps/api/migrations/0004_funcionarios_modelo.up.sql`
- `apps/api/migrations/0005_funcionarios_catalogo.up.sql`
- `apps/api/migrations/0006_funcionarios_hotmart.up.sql`
- `apps/api/package.json`
- `apps/api/src/funcionarios/agenda.test.ts`
- `apps/api/src/funcionarios/agenda.ts`
- `apps/api/src/funcionarios/funcionarios.controller.ts`
- `apps/api/src/funcionarios/funcionarios.http.test.ts`
- `apps/api/src/funcionarios/funcionarios.module.ts`
- `apps/api/src/funcionarios/handlers.ts`
- `apps/api/src/funcionarios/motor.ts`
- `apps/api/src/funcionarios/repositorio.ts`
- `apps/api/src/funcionarios/servico.ts`
- `apps/api/src/main.ts`
- `apps/api/src/vendas/atualizacao.test.ts`
- `apps/api/src/vendas/vendas.controller.ts`
- `apps/api/src/vendas/vendas.module.ts`
- `apps/web/app/(app)/funcionarios/[id]/page.tsx`
- `apps/web/app/(app)/funcionarios/_components/Agendamento.tsx`
- `apps/web/app/(app)/funcionarios/_components/Comum.tsx`
- `apps/web/app/(app)/funcionarios/_components/ConfigCampos.tsx`
- `apps/web/app/(app)/funcionarios/actions.ts`
- `apps/web/app/(app)/funcionarios/catalogo/page.tsx`
- `apps/web/app/(app)/funcionarios/execucoes/[id]/page.tsx`
- `apps/web/app/(app)/funcionarios/execucoes/page.tsx`
- `apps/web/app/(app)/funcionarios/funcionarios.module.css`
- `apps/web/app/(app)/funcionarios/page.tsx`
- `apps/web/app/(app)/funcionarios/setores/[id]/page.tsx`
- `apps/web/app/components/AppShell.tsx`
- `apps/web/app/funcionarios.test.ts`
- `apps/web/lib/funcionarios-api.ts`
- `packages/contracts/src/config-tarefa.ts`
- `packages/contracts/src/funcionarios.ts`
- `packages/contracts/src/index.ts`
- `pnpm-lock.yaml`

## Diff unificado

```diff
diff --git a/.gitattributes b/.gitattributes
new file mode 100644
index 0000000..93f3e9c
--- /dev/null
+++ b/.gitattributes
@@ -0,0 +1,11 @@
+# Checksums das migrations dependem dos bytes; o checkout deve ser idêntico em Windows e Linux.
+apps/api/migrations/*.sql text eol=lf
+# O controle de drift também compara os bytes dos contratos gerados.
+packages/contracts/src/generated/*.ts text eol=lf
+packages/sdk/src/generated/*.ts text eol=lf
+# O formatter do projeto exige LF também nas fontes e configurações de qualidade.
+*.ts text eol=lf
+*.tsx text eol=lf
+*.mjs text eol=lf
+*.cjs text eol=lf
+lefthook.yml text eol=lf
diff --git a/apps/api/migrations/0004_funcionarios_modelo.up.sql b/apps/api/migrations/0004_funcionarios_modelo.up.sql
new file mode 100644
index 0000000..41e3b3a
--- /dev/null
+++ b/apps/api/migrations/0004_funcionarios_modelo.up.sql
@@ -0,0 +1,93 @@
+CREATE SCHEMA IF NOT EXISTS organizacao;
+CREATE SCHEMA IF NOT EXISTS funcionarios;
+CREATE TABLE organizacao.setores (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, codigo text NOT NULL UNIQUE,
+ nome text NOT NULL, descricao text NOT NULL DEFAULT '', ativo boolean NOT NULL DEFAULT true,
+ ordem integer NOT NULL DEFAULT 0, criado_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE TABLE funcionarios.funcionarios (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ setor_id bigint NOT NULL REFERENCES organizacao.setores(id), nome text NOT NULL,
+ slug text NOT NULL UNIQUE, descricao text NOT NULL DEFAULT '',
+ tipo text NOT NULL CHECK(tipo IN ('DETERMINISTICO','AGENTE_IA','HIBRIDO')),
+ status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN ('RASCUNHO','ATIVO','PAUSADO','DESATIVADO')),
+ perfil_ia text, avatar text, criado_por text NOT NULL DEFAULT 'admin-local',
+ criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
+ UNIQUE(setor_id,nome), UNIQUE(id,setor_id)
+);
+CREATE TABLE funcionarios.definicoes_tarefa (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ setor_id bigint NOT NULL REFERENCES organizacao.setores(id), codigo text NOT NULL UNIQUE,
+ nome text NOT NULL, descricao text NOT NULL DEFAULT '',
+ tipo text NOT NULL DEFAULT 'DETERMINISTICO' CHECK(tipo IN ('DETERMINISTICO','TAREFA_IA','AGENTE_IA','HIBRIDO')),
+ handler_key text, config_schema jsonb NOT NULL DEFAULT '{"type":"object","additionalProperties":false}',
+ config_padrao jsonb NOT NULL DEFAULT '{}', gatilhos_suportados text[] NOT NULL DEFAULT '{MANUAL,UNICO,INTERVALO,CRON,EVENTO}',
+ permissoes_requeridas text[] NOT NULL DEFAULT '{funcionarios.executar}', nivel_risco text NOT NULL DEFAULT 'medio',
+ status_implementacao text NOT NULL DEFAULT 'PLANEJADA' CHECK(status_implementacao IN ('DISPONIVEL','PLANEJADA','INDISPONIVEL')),
+ ativo boolean NOT NULL DEFAULT true, UNIQUE(id,setor_id),
+ CHECK(status_implementacao <> 'DISPONIVEL' OR handler_key IS NOT NULL)
+);
+CREATE TABLE funcionarios.atribuicoes (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ funcionario_id bigint NOT NULL, definicao_id bigint NOT NULL, setor_id bigint NOT NULL,
+ config jsonb NOT NULL DEFAULT '{}', habilitada boolean NOT NULL DEFAULT true,
+ prioridade integer NOT NULL DEFAULT 0 CHECK(prioridade BETWEEN 0 AND 100),
+ nome_override text, criado_em timestamptz NOT NULL DEFAULT now(),
+ FOREIGN KEY(funcionario_id,setor_id) REFERENCES funcionarios.funcionarios(id,setor_id),
+ FOREIGN KEY(definicao_id,setor_id) REFERENCES funcionarios.definicoes_tarefa(id,setor_id),
+ UNIQUE(funcionario_id,definicao_id)
+);
+CREATE TABLE funcionarios.agendamentos (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ atribuicao_id bigint NOT NULL REFERENCES funcionarios.atribuicoes(id),
+ gatilho text NOT NULL CHECK(gatilho IN ('MANUAL','UNICO','INTERVALO','CRON','EVENTO')),
+ intervalo_min integer CHECK(intervalo_min BETWEEN 1 AND 525600), cron text,
+ tipo_evento text, filtro_evento jsonb NOT NULL DEFAULT '{}', fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
+ inicio_em timestamptz NOT NULL DEFAULT now(), fim_em timestamptz,
+ proxima_em timestamptz, ultima_em timestamptz, habilitado boolean NOT NULL DEFAULT true,
+ politica_sobreposicao text NOT NULL DEFAULT 'PULAR' CHECK(politica_sobreposicao IN ('PULAR','ENFILEIRAR','CANCELAR_ANTERIOR')),
+ politica_retentativa jsonb NOT NULL DEFAULT '{"maxTentativas":3,"backoffSegundos":30}',
+ versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
+ CHECK(gatilho<>'INTERVALO' OR intervalo_min IS NOT NULL),
+ CHECK(gatilho<>'CRON' OR cron IS NOT NULL), CHECK(gatilho<>'EVENTO' OR tipo_evento IS NOT NULL),
+ CHECK(fim_em IS NULL OR fim_em>=inicio_em)
+);
+CREATE INDEX agendamentos_pendentes ON funcionarios.agendamentos(proxima_em) WHERE habilitado;
+CREATE TABLE funcionarios.execucoes (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ atribuicao_id bigint NOT NULL REFERENCES funcionarios.atribuicoes(id),
+ agendamento_id bigint REFERENCES funcionarios.agendamentos(id), agendamento_versao integer,
+ origem text NOT NULL CHECK(origem IN ('manual','agendamento','evento')),
+ status text NOT NULL DEFAULT 'AGUARDANDO' CHECK(status IN ('AGUARDANDO','EXECUTANDO','SUCESSO','FALHA','CANCELADA','IGNORADA')),
+ programada_em timestamptz NOT NULL DEFAULT now(), iniciada_em timestamptz, finalizada_em timestamptz,
+ tentativa integer NOT NULL DEFAULT 0, chave_idempotencia text NOT NULL UNIQUE,
+ correlacao uuid NOT NULL, disparada_por text NOT NULL DEFAULT 'admin-local',
+ config_snapshot jsonb NOT NULL, resumo jsonb, erro_codigo text,
+ criado_em timestamptz NOT NULL DEFAULT now()
+);
+CREATE INDEX execucoes_historico ON funcionarios.execucoes(atribuicao_id,criado_em DESC);
+CREATE TABLE funcionarios.fila (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ execucao_id bigint NOT NULL UNIQUE REFERENCES funcionarios.execucoes(id),
+ estado text NOT NULL DEFAULT 'AGUARDANDO' CHECK(estado IN ('AGUARDANDO','EXECUTANDO','SUCESSO','FALHA','CANCELADA','IGNORADA')),
+ executar_em timestamptz NOT NULL DEFAULT now(), tentativa integer NOT NULL DEFAULT 0,
+ lease_ate timestamptz, lease_dono text, payload jsonb NOT NULL DEFAULT '{}',
+ CHECK(estado<>'EXECUTANDO' OR (lease_ate IS NOT NULL AND lease_dono IS NOT NULL))
+);
+CREATE INDEX fila_disponivel ON funcionarios.fila(executar_em) WHERE estado IN ('AGUARDANDO','EXECUTANDO');
+CREATE TABLE funcionarios.eventos (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tipo text NOT NULL,
+ chave text NOT NULL UNIQUE, payload jsonb NOT NULL, recebido_em timestamptz NOT NULL DEFAULT now(),
+ processado_em timestamptz
+);
+CREATE TABLE funcionarios.auditoria (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, quem text NOT NULL DEFAULT 'admin-local',
+ quando timestamptz NOT NULL DEFAULT now(), entidade text NOT NULL, entidade_id text NOT NULL,
+ acao text NOT NULL, antes jsonb, depois jsonb
+);
+
+-- IDs bigint continuam exatos no transporte JSON; não converte dados internos de config.
+CREATE FUNCTION funcionarios.json_ids(registro jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
+ SELECT jsonb_object_agg(chave, CASE WHEN (chave='id' OR chave LIKE '%\_id' ESCAPE '\') AND jsonb_typeof(valor)='number'
+ THEN to_jsonb(valor #>> '{}') ELSE valor END) FROM jsonb_each(registro) AS campos(chave,valor)
+$$;
\ No newline at end of file
diff --git a/apps/api/migrations/0005_funcionarios_catalogo.up.sql b/apps/api/migrations/0005_funcionarios_catalogo.up.sql
new file mode 100644
index 0000000..fa08f7c
--- /dev/null
+++ b/apps/api/migrations/0005_funcionarios_catalogo.up.sql
@@ -0,0 +1,76 @@
+-- Seeds reexecutáveis; só o handler real da frente A é disponível.
+INSERT INTO organizacao.setores(codigo,nome,ordem) VALUES
+('diretoria','Diretoria',0),
+('financeiro','Financeiro e Fiscal',1),
+('comercial','Comercial e CRM',2),
+('marketing','Marketing',3),
+('operacoes','Operações e Atendimento',4),
+('tecnologia','Tecnologia e Inteligência',5)
+ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.monitorar_metas','Monitorar metas empresariais','DETERMINISTICO','diretoria.monitorar_metas','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.resumo_executivo','Gerar resumo executivo da empresa','TAREFA_IA','diretoria.resumo_executivo','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.analisar_desempenho','Investigar desempenho empresarial','AGENTE_IA','diretoria.analisar_desempenho','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.planejar_acoes','Elaborar planos de ação estratégicos','AGENTE_IA','diretoria.planejar_acoes','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.coordenar_agentes','Coordenar tarefas entre departamentos','AGENTE_IA','diretoria.coordenar_agentes','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'diretoria.analisar_financas','Realizar análise consultiva do CFO','AGENTE_IA','diretoria.analisar_financas','PLANEJADA' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.atualizar_dados','Atualizar dados financeiros','DETERMINISTICO','financeiro.atualizar_dados','DISPONIVEL' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.conciliar_vendas','Conciliar registros de vendas e eventos financeiros','DETERMINISTICO','financeiro.conciliar_vendas','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.atualizar_indicadores','Atualizar indicadores financeiros','DETERMINISTICO','financeiro.atualizar_indicadores','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.calcular_dre','Calcular DRE gerencial','DETERMINISTICO','financeiro.calcular_dre','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.monitorar_caixa','Monitorar saldos e projeções de caixa','DETERMINISTICO','financeiro.monitorar_caixa','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.detectar_anomalias','Identificar desvios por regras financeiras','DETERMINISTICO','financeiro.detectar_anomalias','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'fiscal.validar_emissao','Verificar condições de emissão fiscal','DETERMINISTICO','fiscal.validar_emissao','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'fiscal.emitir_nota','Emitir notas fiscais autorizadas','DETERMINISTICO','fiscal.emitir_nota','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.sincronizar_vendas','Sincronizar vendas da Hotmart','DETERMINISTICO','comercial.sincronizar_vendas','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.atualizar_clientes','Atualizar cadastro e histórico de clientes','DETERMINISTICO','comercial.atualizar_clientes','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.atualizar_leads','Registrar e atualizar leads','DETERMINISTICO','comercial.atualizar_leads','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.sincronizar_produtos','Sincronizar produtos e ofertas','DETERMINISTICO','comercial.sincronizar_produtos','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.calcular_conversao','Atualizar indicadores de conversão','DETERMINISTICO','comercial.calcular_conversao','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.planejar_experimento','Planejar experimento A/B','AGENTE_IA','comercial.planejar_experimento','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'comercial.avaliar_experimento','Avaliar resultados de experimentos','DETERMINISTICO','comercial.avaliar_experimento','PLANEJADA' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.importar_meta_ads','Importar métricas do Meta Ads','DETERMINISTICO','marketing.importar_meta_ads','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.importar_google_ads','Importar métricas do Google Ads','DETERMINISTICO','marketing.importar_google_ads','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.analisar_campanhas','Analisar desempenho de campanhas','AGENTE_IA','marketing.analisar_campanhas','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.planejar_conteudo','Planejar calendário de conteúdo','AGENTE_IA','marketing.planejar_conteudo','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.gerar_post','Gerar post estático','TAREFA_IA','marketing.gerar_post','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.analisar_video','Identificar trechos relevantes de vídeos','TAREFA_IA','marketing.analisar_video','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.processar_cortes','Processar e exportar cortes de vídeos','DETERMINISTICO','marketing.processar_cortes','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.agendar_publicacao','Agendar publicações','DETERMINISTICO','marketing.agendar_publicacao','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.publicar_conteudo','Publicar conteúdo autorizado','DETERMINISTICO','marketing.publicar_conteudo','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.propor_otimizacao','Propor otimizações de campanhas','AGENTE_IA','marketing.propor_otimizacao','PLANEJADA' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'marketing.aplicar_otimizacao','Aplicar mudança publicitária autorizada','DETERMINISTICO','marketing.aplicar_otimizacao','INDISPONIVEL' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'operacoes.verificar_pos_venda','Verificar consistência das operações de pós-venda','DETERMINISTICO','operacoes.verificar_pos_venda','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'operacoes.verificar_acessos','Verificar situações de acesso de alunos','DETERMINISTICO','operacoes.verificar_acessos','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'operacoes.enviar_notificacoes','Enviar notificações operacionais','DETERMINISTICO','operacoes.enviar_notificacoes','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'atendimento.registrar_ticket','Registrar chamados de atendimento','DETERMINISTICO','atendimento.registrar_ticket','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'atendimento.distribuir_tickets','Distribuir chamados conforme regras','DETERMINISTICO','atendimento.distribuir_tickets','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'atendimento.monitorar_sla','Monitorar prazos de atendimento','DETERMINISTICO','atendimento.monitorar_sla','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'atendimento.atualizar_status','Atualizar status dos chamados','DETERMINISTICO','atendimento.atualizar_status','PLANEJADA' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'tecnologia.monitorar_integracoes','Monitorar saúde das integrações','DETERMINISTICO','tecnologia.monitorar_integracoes','PLANEJADA' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'tecnologia.verificar_jobs','Verificar execuções de tarefas','DETERMINISTICO','tecnologia.verificar_jobs','PLANEJADA' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'tecnologia.reprocessar_eventos','Reprocessar eventos elegíveis após falhas','DETERMINISTICO','tecnologia.reprocessar_eventos','PLANEJADA' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'tecnologia.monitorar_ia','Monitorar custos e falhas de IA','DETERMINISTICO','tecnologia.monitorar_ia','PLANEJADA' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'tecnologia.registrar_atividades','Consolidar estados operacionais para o painel','DETERMINISTICO','tecnologia.registrar_atividades','PLANEJADA' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.reconciliar_hotmart','Reconsultar janela longa na Hotmart','DETERMINISTICO','financeiro.reconciliar_hotmart','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.processar_evento_hotmart','Aplicar evento de webhook','DETERMINISTICO','financeiro.processar_evento_hotmart','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.gerar_recorrencias','Gerar contas a pagar recorrentes','DETERMINISTICO','financeiro.gerar_recorrencias','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.verificar_vencimentos','Verificar vencimentos','DETERMINISTICO','financeiro.verificar_vencimentos','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.atualizar_previsoes','Atualizar previsões de recebimentos','DETERMINISTICO','financeiro.atualizar_previsoes','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,tipo,handler_key,status_implementacao) SELECT id,'financeiro.alertar_recebimentos','Alertar recebimentos atrasados','DETERMINISTICO','financeiro.alertar_recebimentos','PLANEJADA' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(codigo) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Assistente Executivo','assistente-executivo','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'CFO Virtual','cfo-virtual','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'COO','coo','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'CMO','cmo','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Diretor Comercial','diretor-comercial','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Diretor de Tecnologia','diretor-tecnologia','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='diretoria' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Analista de Atualizações Financeiras','analista-atualizacoes-financeiras','DETERMINISTICO','ATIVO' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Gestor de Contas','gestor-contas','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Conciliador Financeiro','conciliador-financeiro','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Analista de Indicadores','analista-indicadores','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Assistente Fiscal','assistente-fiscal','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='financeiro' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Analista Comercial','analista-comercial','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='comercial' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Planejador de Marketing','planejador-marketing','AGENTE_IA','RASCUNHO' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Criador de Conteúdo','criador-conteudo','HIBRIDO','RASCUNHO' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Gestor de Tráfego','gestor-trafego','HIBRIDO','RASCUNHO' FROM organizacao.setores WHERE codigo='marketing' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Assistente de Operações','assistente-operacoes','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='operacoes' ON CONFLICT(slug) DO NOTHING;
+INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,tipo,status) SELECT id,'Monitor de Integrações','monitor-integracoes','DETERMINISTICO','RASCUNHO' FROM organizacao.setores WHERE codigo='tecnologia' ON CONFLICT(slug) DO NOTHING;
diff --git a/apps/api/migrations/0006_funcionarios_hotmart.up.sql b/apps/api/migrations/0006_funcionarios_hotmart.up.sql
new file mode 100644
index 0000000..acc1f57
--- /dev/null
+++ b/apps/api/migrations/0006_funcionarios_hotmart.up.sql
@@ -0,0 +1,3 @@
+-- A rotina existente passa ao motor persistente. O intervalo do ambiente só inicializa o seed em runtime.
+INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id) SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d ON d.codigo='financeiro.atualizar_dados' WHERE f.slug='analista-atualizacoes-financeiras' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
+INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,intervalo_min,proxima_em) SELECT a.id,'INTERVALO',30,now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE d.codigo='financeiro.atualizar_dados' AND NOT EXISTS(SELECT 1 FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id);
diff --git a/apps/api/package.json b/apps/api/package.json
index 14010d1..aec260a 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -17,6 +17,7 @@
     "@nucleos/config": "workspace:*",
     "@nucleos/contracts": "workspace:*",
     "@nucleos/observability": "workspace:*",
+    "cron-parser": "5.10.3",
     "pg": "8.23.1",
     "reflect-metadata": "0.2.2",
     "rxjs": "7.8.2"
diff --git a/apps/api/src/funcionarios/agenda.test.ts b/apps/api/src/funcionarios/agenda.test.ts
new file mode 100644
index 0000000..318964b
--- /dev/null
+++ b/apps/api/src/funcionarios/agenda.test.ts
@@ -0,0 +1,66 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { dadosSeguros, proximaOcorrencia, proximasOcorrencias, validarAgenda } from "./agenda.js";
+import { RegistroHandlers, validarConfiguracao } from "./handlers.js";
+const agora = new Date("2026-11-02T12:00:00Z");
+test("intervalo 30 minutos, alteração para 60 e reinício preservam a âncora", () => {
+  const a = validarAgenda({ gatilho: "INTERVALO", intervalo_min: 30 }, agora);
+  assert.equal(proximaOcorrencia(a, agora)?.toISOString(), "2026-11-02T12:30:00.000Z");
+  assert.equal(
+    proximaOcorrencia({ ...a, intervalo_min: 60 }, agora)?.toISOString(),
+    "2026-11-02T13:00:00.000Z",
+  );
+  assert.equal(
+    proximaOcorrencia(a, new Date("2026-11-02T12:42:00Z"))?.toISOString(),
+    "2026-11-02T13:00:00.000Z",
+  );
+});
+test("cron usa o fuso e gera 5 próximas; limite final e execução única", () => {
+  const a = validarAgenda({ gatilho: "CRON", cron: "0 3 * * *", fuso: "America/Sao_Paulo" }, agora);
+  assert.equal(proximasOcorrencias(a, agora).length, 5);
+  assert.equal(proximasOcorrencias(a, agora)[0], "2026-11-03T06:00:00.000Z");
+  assert.equal(proximaOcorrencia({ ...a, fim_em: "2026-11-02T23:59:00Z" }, agora), null);
+  const unica = validarAgenda({ gatilho: "UNICO", inicio_em: "2026-11-02T13:00:00Z" }, agora);
+  assert.equal(proximasOcorrencias(unica, agora).length, 1);
+  assert.equal(proximaOcorrencia(unica, new Date(unica.inicio_em)), null);
+});
+test("agenda recusa cron inválido, campos extras, evento desconhecido, intervalo e retentativa inválidos", () => {
+  for (const x of [
+    { gatilho: "CRON", cron: "* * * * * *" },
+    { gatilho: "CRON", cron: "65 0 * * *" },
+    { gatilho: "INTERVALO", intervalo_min: 0 },
+    { gatilho: "INTERVALO", intervalo_min: 30, script: "exec" },
+    { gatilho: "EVENTO", tipo_evento: "externo.livre" },
+    { gatilho: "MANUAL", fuso: "Lua" },
+    { gatilho: "MANUAL", politica_retentativa: { maxTentativas: 0, backoffSegundos: 3 } },
+    { gatilho: "MANUAL", fim_em: "2026-01-01T00:00:00Z" },
+  ])
+    assert.throws(() => validarAgenda(x, agora));
+});
+test("configuração recusa segredos aninhados/arrays e valida JSON Schema sem coerção", () => {
+  assert.equal(dadosSeguros({ opcoes: [{ senha: "sentinela" }] }), false);
+  assert.equal(dadosSeguros({ opcoes: { apiKey: "sentinela" } }), false);
+  assert.equal(dadosSeguros({ credencialRef: "cofre/financeiro" }), true);
+  const schema = {
+    type: "object",
+    properties: { limite: { type: "integer", minimum: 1 } },
+    required: ["limite"],
+    additionalProperties: false,
+  };
+  const h = { chave: "teste", validarConfig: () => true, executar: async () => ({ ok: true }) };
+  assert.doesNotThrow(() => {
+    validarConfiguracao(schema, { limite: 3 }, h);
+  });
+  assert.throws(() => {
+    validarConfiguracao(schema, { limite: "3" }, h);
+  });
+  assert.throws(() => {
+    validarConfiguracao(schema, { limite: 3, extra: 1 }, h);
+  });
+  const registro = new RegistroHandlers();
+  registro.registrar(h);
+  assert.throws(() => {
+    registro.registrar(h);
+  });
+  assert.throws(() => registro.obter("planejada"));
+});
diff --git a/apps/api/src/funcionarios/agenda.ts b/apps/api/src/funcionarios/agenda.ts
new file mode 100644
index 0000000..f9dbe85
--- /dev/null
+++ b/apps/api/src/funcionarios/agenda.ts
@@ -0,0 +1,185 @@
+import { BadRequestException } from "@nestjs/common";
+import type { Agendamento, Gatilho, ObjetoConfig } from "@nucleos/contracts";
+import { CronExpressionParser } from "cron-parser";
+
+export const EVENTOS_FUNCIONARIOS = [
+  "hotmart.webhook.recebido",
+  "financeiro.venda.alterada",
+  "financeiro.extrato.importado",
+  "financeiro.dados.alterados",
+  "financeiro.alerta.criado",
+  "financeiro.anomalia.detectada",
+] as const;
+export type AgendaEntrada = Pick<
+  Agendamento,
+  | "gatilho"
+  | "intervalo_min"
+  | "cron"
+  | "tipo_evento"
+  | "filtro_evento"
+  | "fuso"
+  | "inicio_em"
+  | "fim_em"
+  | "habilitado"
+  | "politica_sobreposicao"
+  | "politica_retentativa"
+>;
+export const objeto = (x: unknown): x is ObjetoConfig =>
+  typeof x === "object" && x !== null && !Array.isArray(x);
+export function dadosSeguros(x: unknown, profundidade = 0): boolean {
+  if (profundidade > 16) return false;
+  if (Array.isArray(x)) return x.length <= 100 && x.every((v) => dadosSeguros(v, profundidade + 1));
+  if (objeto(x))
+    return Object.entries(x).every(
+      ([k, v]) =>
+        !/(token|secret|senha|password|api.?key|^key$|__proto__|constructor|prototype)/i.test(k) &&
+        dadosSeguros(v, profundidade + 1),
+    );
+  return (
+    x === null ||
+    typeof x === "boolean" ||
+    (typeof x === "number" && Number.isFinite(x)) ||
+    (typeof x === "string" && x.length <= 8000)
+  );
+}
+export function exigirObjeto(x: unknown): ObjetoConfig {
+  if (!objeto(x) || !dadosSeguros(x) || JSON.stringify(x).length > 32000)
+    throw new BadRequestException("dados invalidos");
+  return x;
+}
+export function campos(x: ObjetoConfig, permitidos: readonly string[]): void {
+  if (Object.keys(x).some((k) => !permitidos.includes(k)))
+    throw new BadRequestException("campo nao permitido");
+}
+export function texto(x: unknown, max = 160): string {
+  if (typeof x !== "string" || !x.trim() || x.length > max)
+    throw new BadRequestException("texto invalido");
+  for (let i = 0; i < x.length; i++)
+    if (x.charCodeAt(i) < 32) throw new BadRequestException("texto invalido");
+  return x.trim();
+}
+export function identificador(x: unknown): string {
+  const s = texto(x, 19);
+  if (!/^[1-9]\d{0,18}$/.test(s) || BigInt(s) > 9223372036854775807n)
+    throw new BadRequestException("identificador invalido");
+  return s;
+}
+export function inteiro(x: unknown, min: number, max: number): number {
+  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x > max)
+    throw new BadRequestException("numero invalido");
+  return x;
+}
+export function booleano(x: unknown): boolean {
+  if (typeof x !== "boolean") throw new BadRequestException("booleano invalido");
+  return x;
+}
+export function opcao<T extends string>(x: unknown, opcoes: readonly T[]): T {
+  if (typeof x !== "string" || !opcoes.includes(x as T))
+    throw new BadRequestException("opcao invalida");
+  return x as T;
+}
+function data(x: unknown): string {
+  const s = texto(x, 40);
+  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s)))
+    throw new BadRequestException("data invalida");
+  return new Date(s).toISOString();
+}
+export function validarAgenda(entrada: unknown, agora: Date): AgendaEntrada {
+  const x = exigirObjeto(entrada);
+  campos(x, [
+    "gatilho",
+    "intervalo_min",
+    "cron",
+    "tipo_evento",
+    "filtro_evento",
+    "fuso",
+    "inicio_em",
+    "fim_em",
+    "habilitado",
+    "politica_sobreposicao",
+    "politica_retentativa",
+  ]);
+  const gatilho = opcao<Gatilho>(x["gatilho"], ["MANUAL", "UNICO", "INTERVALO", "CRON", "EVENTO"]);
+  const fuso = x["fuso"] === undefined ? "America/Sao_Paulo" : texto(x["fuso"], 80);
+  try {
+    new Intl.DateTimeFormat("pt-BR", { timeZone: fuso });
+  } catch {
+    throw new BadRequestException("fuso invalido");
+  }
+  const inicio_em = x["inicio_em"] === undefined ? agora.toISOString() : data(x["inicio_em"]);
+  const fim_em =
+    x["fim_em"] === undefined || x["fim_em"] === null || x["fim_em"] === ""
+      ? null
+      : data(x["fim_em"]);
+  if (fim_em !== null && fim_em < inicio_em)
+    throw new BadRequestException("fim anterior ao inicio");
+  const ret = exigirObjeto(x["politica_retentativa"] ?? { maxTentativas: 3, backoffSegundos: 30 });
+  campos(ret, ["maxTentativas", "backoffSegundos"]);
+  const agenda: AgendaEntrada = {
+    gatilho,
+    intervalo_min: gatilho === "INTERVALO" ? inteiro(x["intervalo_min"], 1, 525600) : null,
+    cron: gatilho === "CRON" ? texto(x["cron"], 100) : null,
+    tipo_evento: gatilho === "EVENTO" ? opcao(x["tipo_evento"], EVENTOS_FUNCIONARIOS) : null,
+    filtro_evento: exigirObjeto(x["filtro_evento"] ?? {}),
+    fuso,
+    inicio_em,
+    fim_em,
+    habilitado: x["habilitado"] === undefined ? true : booleano(x["habilitado"]),
+    politica_sobreposicao: opcao(x["politica_sobreposicao"] ?? "PULAR", [
+      "PULAR",
+      "ENFILEIRAR",
+      "CANCELAR_ANTERIOR",
+    ]),
+    politica_retentativa: {
+      maxTentativas: inteiro(ret["maxTentativas"], 1, 10),
+      backoffSegundos: inteiro(ret["backoffSegundos"], 1, 3600),
+    },
+  };
+  if (agenda.cron !== null) proximasOcorrencias(agenda, agora, 1);
+  return agenda;
+}
+export function proximaOcorrencia(
+  a: Pick<AgendaEntrada, "gatilho" | "intervalo_min" | "cron" | "fuso" | "inicio_em" | "fim_em">,
+  apos: Date,
+  primeira = false,
+): Date | null {
+  const inicio = new Date(a.inicio_em);
+  let proxima: Date | null = null;
+  if (a.gatilho === "UNICO") proxima = primeira && inicio >= apos ? inicio : null;
+  else if (a.gatilho === "INTERVALO" && a.intervalo_min !== null) {
+    const intervalo = a.intervalo_min * 60000;
+    proxima = new Date(
+      primeira && inicio > apos
+        ? inicio
+        : inicio.getTime() +
+            (Math.floor(Math.max(0, apos.getTime() - inicio.getTime()) / intervalo) + 1) *
+              intervalo,
+    );
+  } else if (a.gatilho === "CRON" && a.cron !== null) {
+    if (/\bH\b/.test(a.cron)) throw new BadRequestException("cron aleatorio nao suportado");
+    if (a.cron.trim().split(/\s+/).length !== 5)
+      throw new BadRequestException("cron exige 5 campos");
+    try {
+      proxima = CronExpressionParser.parse(a.cron, {
+        currentDate: new Date(Math.max(apos.getTime(), inicio.getTime() - 1)),
+        tz: a.fuso,
+      })
+        .next()
+        .toDate();
+    } catch {
+      throw new BadRequestException("cron invalido");
+    }
+  }
+  return proxima !== null && a.fim_em !== null && proxima > new Date(a.fim_em) ? null : proxima;
+}
+export function proximasOcorrencias(a: AgendaEntrada, agora: Date, n = 5): string[] {
+  const datas: string[] = [];
+  let cursor = agora;
+  for (let i = 0; i < n; i++) {
+    const d = proximaOcorrencia(a, cursor, i === 0);
+    if (d === null) break;
+    datas.push(d.toISOString());
+    cursor = d;
+  }
+  return datas;
+}
diff --git a/apps/api/src/funcionarios/funcionarios.controller.ts b/apps/api/src/funcionarios/funcionarios.controller.ts
new file mode 100644
index 0000000..6a27dee
--- /dev/null
+++ b/apps/api/src/funcionarios/funcionarios.controller.ts
@@ -0,0 +1,96 @@
+import {
+  Body,
+  Controller,
+  Delete,
+  Get,
+  Inject,
+  Param,
+  Patch,
+  Post,
+  Query,
+  UseGuards,
+} from "@nestjs/common";
+import { ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { SERVICO_FUNCIONARIOS, ServicoFuncionarios } from "./servico.js";
+
+@Controller("v1/funcionarios")
+@UseGuards(ChaveServicoGuard)
+export class FuncionariosController {
+  constructor(@Inject(SERVICO_FUNCIONARIOS) private readonly servico: ServicoFuncionarios) {}
+  @Get("setores") setores() {
+    return this.servico.setores();
+  }
+  @Get("setores/:id") setor(@Param("id") id: string) {
+    return this.servico.setor(id);
+  }
+  @Get("estado") estado() {
+    return this.servico.estado();
+  }
+  @Get("eventos") eventos() {
+    return this.servico.eventos();
+  }
+  @Get("catalogo") catalogo(@Query() q: Record<string, unknown>) {
+    return this.servico.catalogo(q);
+  }
+  @Get("catalogo/:id") tarefa(@Param("id") id: string) {
+    return this.servico.tarefa(id);
+  }
+  @Post("catalogo") criarTarefa(@Body() x: unknown) {
+    return this.servico.salvarTarefa(x).then((id) => ({ id }));
+  }
+  @Patch("catalogo/:id") editarTarefa(@Param("id") id: string, @Body() x: unknown) {
+    return this.servico.salvarTarefa(x, id).then((id) => ({ id }));
+  }
+  @Get("execucoes") execucoes(@Query() q: Record<string, unknown>) {
+    return this.servico.execucoes(q);
+  }
+  @Get("execucoes/:id") execucao(@Param("id") id: string) {
+    return this.servico.execucao(id);
+  }
+  @Post("cron/previsualizar") previsualizar(@Body() x: unknown) {
+    return this.servico.previsualizar(x);
+  }
+  @Post("atribuicoes/:id/executar") executar(@Param("id") id: string) {
+    return this.servico.executar(id);
+  }
+  @Patch("atribuicoes/:id") configurar(@Param("id") id: string, @Body() x: unknown) {
+    return this.servico.configurarAtribuicao(id, x).then(() => ({ ok: true }));
+  }
+  @Delete("atribuicoes/:id") remover(@Param("id") id: string) {
+    return this.servico.removerAtribuicao(id).then(() => ({ ok: true }));
+  }
+  @Post("atribuicoes/:id/agendamentos") agendar(@Param("id") id: string, @Body() x: unknown) {
+    return this.servico.salvarAgenda(id, x).then((id) => ({ id }));
+  }
+  @Patch("atribuicoes/:atribuicao/agendamentos/:id") editarAgenda(
+    @Param("atribuicao") atribuicao: string,
+    @Param("id") id: string,
+    @Body() x: unknown,
+  ) {
+    return this.servico.salvarAgenda(atribuicao, x, id).then((id) => ({ id }));
+  }
+  @Post("agendamentos/:id/suspender") suspender(@Param("id") id: string) {
+    return this.servico.suspenderAgenda(id).then(() => ({ ok: true }));
+  }
+  @Get("agendamentos/:id/proximas") proximas(@Param("id") id: string, @Query("n") n: unknown) {
+    return this.servico.proximas(id, n);
+  }
+  @Get() listar(@Query() q: Record<string, unknown>) {
+    return this.servico.funcionarios(q);
+  }
+  @Post() criar(@Body() x: unknown) {
+    return this.servico.salvarFuncionario(x).then((id) => ({ id }));
+  }
+  @Get(":id") detalhe(@Param("id") id: string) {
+    return this.servico.detalhe(id);
+  }
+  @Patch(":id") editar(@Param("id") id: string, @Body() x: unknown) {
+    return this.servico.salvarFuncionario(x, id).then((id) => ({ id }));
+  }
+  @Post(":id/status") status(@Param("id") id: string, @Body("status") status: unknown) {
+    return this.servico.statusFuncionario(id, status).then(() => ({ ok: true }));
+  }
+  @Post(":id/atribuicoes") atribuir(@Param("id") id: string, @Body() x: unknown) {
+    return this.servico.atribuir(id, x).then((id) => ({ id }));
+  }
+}
diff --git a/apps/api/src/funcionarios/funcionarios.http.test.ts b/apps/api/src/funcionarios/funcionarios.http.test.ts
new file mode 100644
index 0000000..c960587
--- /dev/null
+++ b/apps/api/src/funcionarios/funcionarios.http.test.ts
@@ -0,0 +1,659 @@
+import "reflect-metadata";
+import assert from "node:assert/strict";
+import { randomUUID } from "node:crypto";
+import { readFile } from "node:fs/promises";
+import { after, before, describe, test, mock } from "node:test";
+import type { INestApplication } from "@nestjs/common";
+import { NestFactory } from "@nestjs/core";
+import { Secret } from "@nucleos/config";
+import type {
+  Agendamento,
+  DetalheFuncionario,
+  EstadoFuncionarios,
+  ListaExecucoes,
+} from "@nucleos/contracts";
+import { Pool } from "pg";
+import { AppModule } from "../app.module.js";
+import { lerMigracoes, migrar } from "../migrar.js";
+import { FuncionariosModule } from "./funcionarios.module.js";
+import { RegistroHandlers, type ContextoHandler } from "./handlers.js";
+import { MotorFuncionarios } from "./motor.js";
+import { objetos } from "./repositorio.js";
+import { ServicoFuncionarios } from "./servico.js";
+import { VendasModule } from "../vendas/vendas.module.js";
+import { SINCRONIZACAO_VENDAS, type SincronizacaoVendas } from "../vendas/sincronizacao.js";
+
+const urlAdmin = process.env["TEST_DATABASE_URL"];
+const CHAVE = "chave-sentinela-de-teste";
+describe(
+  "Funcionários: PostgreSQL isolado, motor e API HTTP",
+  { skip: urlAdmin === undefined ? "requer TEST_DATABASE_URL local (banco temporário)" : false },
+  () => {
+    const banco = `nucleos_teste_fun_${randomUUID().replaceAll("-", "")}`;
+    let admin: Pool;
+    let pool: Pool;
+    let app: INestApplication;
+    let base: string;
+    let registro: RegistroHandlers;
+    let motor: MotorFuncionarios;
+    let servico: ServicoFuncionarios;
+    const recursos: {
+      motor?: MotorFuncionarios;
+      app?: INestApplication;
+      pool?: Pool;
+      admin?: Pool;
+    } = {};
+    before(async () => {
+      const url = new URL(urlAdmin as string);
+      assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname));
+      admin = new Pool({ connectionString: url.toString(), max: 1 });
+      recursos.admin = admin;
+      await admin.query(`CREATE DATABASE ${banco}`);
+      url.pathname = `/${banco}`;
+      pool = new Pool({ connectionString: url.toString(), max: 12 });
+      recursos.pool = pool;
+      pool.on("error", () => undefined);
+      await migrar(pool, await lerMigracoes(new URL("../../migrations/", import.meta.url)));
+      registro = new RegistroHandlers();
+      registro.registrar({
+        chave: "financeiro.atualizar_dados",
+        validarConfig: (c) => Object.keys(c).length === 0,
+        executar: async () => ({ resultado: "sucesso", processadas: 0, mensagem: null }),
+      });
+      motor = new MotorFuncionarios(pool, registro);
+      recursos.motor = motor;
+      servico = new ServicoFuncionarios(pool, motor);
+      app = await NestFactory.create(
+        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), false)]),
+        { logger: false },
+      );
+      recursos.app = app;
+      await app.listen(0, "127.0.0.1");
+      base = await app.getUrl();
+    });
+    after(async () => {
+      recursos.motor?.parar();
+      await recursos.app?.close();
+      await recursos.pool?.end();
+      if (recursos.admin !== undefined) {
+        await recursos.admin.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
+        await recursos.admin.end();
+      }
+    });
+    async function chamar(caminho: string, method = "GET", body?: unknown, autenticado = true) {
+      return fetch(`${base}/v1/funcionarios${caminho}`, {
+        method,
+        headers: {
+          ...(autenticado ? { authorization: `Bearer ${CHAVE}` } : {}),
+          "content-type": "application/json",
+        },
+        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
+      });
+    }
+    async function fixture(
+      executar: (c: ContextoHandler) => Promise<unknown> = async () => ({ ok: true }),
+      politica = "ENFILEIRAR",
+    ) {
+      const codigo = `teste.${randomUUID().replaceAll("-", "")}`;
+      registro.registrar({ chave: codigo, validarConfig: () => true, executar });
+      const setor = (await servico.setores()).find((s) => s.codigo === "financeiro");
+      assert.ok(setor);
+      const d = (
+        await pool.query<{ id: string }>(
+          `INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,handler_key,status_implementacao) VALUES($1,$2,$2,$2,'DISPONIVEL') RETURNING id`,
+          [setor.id, codigo],
+        )
+      ).rows[0];
+      assert.ok(d);
+      const f = await servico.salvarFuncionario({
+        setor_id: setor.id,
+        nome: codigo,
+        descricao: "Funcionário de teste",
+        tipo: "DETERMINISTICO",
+      });
+      const a = await servico.atribuir(f, { definicao_id: d.id, config: {} });
+      await servico.statusFuncionario(f, "ATIVO");
+      const s = await servico.salvarAgenda(a, {
+        gatilho: "INTERVALO",
+        intervalo_min: 30,
+        politica_sobreposicao: politica,
+      });
+      return { f, a, s, d: d.id };
+    }
+    async function agendarAgora(s: string, atraso = 1000) {
+      await pool.query(
+        "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp()-($2::integer*interval '1 millisecond') WHERE id=$1",
+        [s, atraso],
+      );
+      await motor.planejar();
+    }
+    test("migrations e seeds idempotentes: 6 setores, 50 tarefas; integridade de cron/intervalo/setor", async () => {
+      const contagem = async () =>
+        (await pool.query<{ n: string }>("SELECT count(*) n FROM funcionarios.definicoes_tarefa"))
+          .rows[0]?.n;
+      assert.equal(await contagem(), "50");
+      assert.equal((await servico.setores()).length, 6);
+      for (const nome of ["0005_funcionarios_catalogo.up.sql", "0006_funcionarios_hotmart.up.sql"])
+        await pool.query(
+          await readFile(new URL(`../../migrations/${nome}`, import.meta.url), "utf8"),
+        );
+      assert.equal(await contagem(), "50");
+      const analista = (await servico.funcionarios()).find(
+        (f) => f.slug === "analista-atualizacoes-financeiras",
+      );
+      assert.ok(analista);
+      assert.equal(typeof analista.id, "string");
+      const detalhe = await servico.detalhe(analista.id);
+      assert.equal(detalhe.atribuicoes[0]?.agendamentos[0]?.intervalo_min, 30);
+      const a = detalhe.atribuicoes[0];
+      assert.ok(a);
+      assert.equal(typeof a.id, "string");
+      await assert.rejects(
+        pool.query(
+          "INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho) VALUES($1,'CRON')",
+          [a.id],
+        ),
+      );
+      await assert.rejects(
+        pool.query(
+          "INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,intervalo_min) VALUES($1,'INTERVALO',0)",
+          [a.id],
+        ),
+      );
+      await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false");
+    });
+    test("HTTP chave obrigatória em cada família; setores, catálogo, listagem e detalhe consultáveis", async () => {
+      for (const caminho of ["", "/setores", "/catalogo", "/execucoes", "/estado", "/eventos"])
+        assert.equal((await chamar(caminho, "GET", undefined, false)).status, 401);
+      for (const caminho of ["", "/setores", "/catalogo", "/execucoes", "/estado", "/eventos"])
+        assert.equal((await chamar(caminho)).status, 200);
+      const { f } = await fixture();
+      const r = await chamar(`/${f}`);
+      assert.equal(r.status, 200);
+      const d = (await r.json()) as DetalheFuncionario;
+      assert.equal(d.funcionario.id, f);
+    });
+    test("HTTP cadastro/edição/status: sem tarefas não ativa; mutações registram auditoria", async () => {
+      const setor = (await servico.setores())[0];
+      assert.ok(setor);
+      const criado = await chamar("", "POST", {
+        nome: "Rascunho HTTP",
+        setor_id: setor.id,
+        tipo: "DETERMINISTICO",
+        descricao: "Teste",
+      });
+      assert.equal(criado.status, 201);
+      const { id } = (await criado.json()) as { id: string };
+      assert.equal((await chamar(`/${id}/status`, "POST", { status: "ATIVO" })).status, 409);
+      assert.equal(
+        (
+          await chamar(`/${id}`, "PATCH", {
+            nome: "Editado HTTP",
+            setor_id: setor.id,
+            tipo: "HIBRIDO",
+            descricao: "Teste editado",
+          })
+        ).status,
+        200,
+      );
+      assert.equal((await chamar(`/${id}/status`, "POST", { status: "PAUSADO" })).status, 201);
+      assert.equal(
+        (
+          await pool.query<{ n: string }>(
+            "SELECT count(*) n FROM funcionarios.auditoria WHERE entidade='funcionario' AND entidade_id=$1",
+            [id],
+          )
+        ).rows[0]?.n,
+        "3",
+      );
+    });
+    test("HTTP catálogo personalizado é PLANEJADA sem handler e não pode ser atribuído/agendado; handler imutável", async () => {
+      const fx = await fixture();
+      const setor = (await servico.detalhe(fx.f)).funcionario.setor_id;
+      const r = await chamar("/catalogo", "POST", {
+        setor_id: setor,
+        codigo: "financeiro.personalizada",
+        nome: "Planejada",
+        tipo: "DETERMINISTICO",
+      });
+      assert.equal(r.status, 201);
+      const { id } = (await r.json()) as { id: string };
+      const tarefa = await servico.tarefa(id);
+      assert.equal(tarefa.handler_key, null);
+      assert.equal(tarefa.status_implementacao, "PLANEJADA");
+      assert.equal(
+        (await chamar(`/catalogo/${id}`, "PATCH", { handler_key: "financeiro.atualizar_dados" }))
+          .status,
+        400,
+      );
+      assert.equal(
+        (await chamar(`/${fx.f}/atribuicoes`, "POST", { definicao_id: id })).status,
+        409,
+      );
+      await pool.query(
+        "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='PLANEJADA' WHERE id=$1",
+        [fx.d],
+      );
+      assert.equal(
+        (await chamar(`/atribuicoes/${fx.a}/agendamentos`, "POST", { gatilho: "MANUAL" })).status,
+        409,
+      );
+      assert.equal((await chamar(`/atribuicoes/${fx.a}/executar`, "POST")).status, 409);
+    });
+    test("HTTP atribuição de outro setor e segredo aninhado recusados sem persistir; config inválida recusada", async () => {
+      const fx = await fixture();
+      const setor = (await servico.setores()).find((s) => s.codigo === "marketing");
+      assert.ok(setor);
+      const f = await servico.salvarFuncionario({
+        setor_id: setor.id,
+        nome: "Outro setor",
+        tipo: "DETERMINISTICO",
+      });
+      assert.equal((await chamar(`/${f}/atribuicoes`, "POST", { definicao_id: fx.d })).status, 400);
+      assert.equal(
+        (
+          await chamar(`/atribuicoes/${fx.a}`, "PATCH", {
+            config: { interno: [{ token: "SEGREDO_SENTINELA" }] },
+          })
+        ).status,
+        400,
+      );
+      assert.equal(
+        (await chamar(`/atribuicoes/${fx.a}`, "PATCH", { config: { extra: true } })).status,
+        400,
+      );
+      assert.equal(
+        JSON.stringify((await servico.detalhe(fx.f)).atribuicoes).includes("SEGREDO_SENTINELA"),
+        false,
+      );
+    });
+    test("HTTP agendamento altera 30→60, prevê próximas, suspende e rejeita cron/evento inválidos", async () => {
+      const fx = await fixture();
+      assert.equal(
+        (
+          await chamar(`/atribuicoes/${fx.a}/agendamentos/${fx.s}`, "PATCH", {
+            gatilho: "INTERVALO",
+            intervalo_min: 60,
+          })
+        ).status,
+        200,
+      );
+      const detalhe = await servico.detalhe(fx.f);
+      const agenda = detalhe.atribuicoes[0]?.agendamentos[0];
+      assert.ok(agenda);
+      assert.equal(agenda.intervalo_min, 60);
+      assert.equal(agenda.versao, 2);
+      assert.equal((await chamar(`/agendamentos/${fx.s}/proximas?n=5`)).status, 200);
+      const previa = await chamar("/cron/previsualizar", "POST", {
+        gatilho: "CRON",
+        cron: "0 3 * * *",
+        fuso: "America/Sao_Paulo",
+      });
+      assert.equal(previa.status, 201);
+      assert.equal(((await previa.json()) as string[]).length, 5);
+      assert.equal(
+        (await chamar("/cron/previsualizar", "POST", { gatilho: "CRON", cron: "61 * * * *" }))
+          .status,
+        400,
+      );
+      assert.equal((await chamar(`/agendamentos/${fx.s}/suspender`, "POST")).status, 201);
+      assert.equal((await servico.proximas(fx.s, 5)).length, 0);
+    });
+    test("duas instâncias do planejador/consumidor não duplicam a mesma ocorrência", async () => {
+      let vezes = 0;
+      const fx = await fixture(async () => {
+        vezes++;
+        return { ok: true };
+      });
+      await pool.query("UPDATE funcionarios.agendamentos SET habilitado=false WHERE id<>$1", [
+        fx.s,
+      ]);
+      await pool.query(
+        "UPDATE funcionarios.agendamentos SET proxima_em=clock_timestamp()-interval '1 second' WHERE id=$1",
+        [fx.s],
+      );
+      const outro = new MotorFuncionarios(pool, registro);
+      await Promise.all([motor.planejar(), outro.planejar()]);
+      await Promise.all([motor.consumirUma(), outro.consumirUma()]);
+      assert.equal(vezes, 1);
+      const h = await servico.execucoes({ funcionario: fx.f });
+      assert.equal(h.total, 1);
+      assert.equal(h.itens[0]?.status, "SUCESSO");
+    });
+    test("versão antiga e atribuição desabilitada cancelam fila sem matar execução já iniciada", async () => {
+      let vezes = 0;
+      const fx = await fixture(async () => {
+        vezes++;
+        return { ok: true };
+      });
+      await agendarAgora(fx.s);
+      await servico.salvarAgenda(fx.a, { gatilho: "INTERVALO", intervalo_min: 60 }, fx.s);
+      await motor.consumirUma();
+      assert.equal(vezes, 0);
+      assert.equal((await servico.execucoes({ funcionario: fx.f })).itens[0]?.status, "CANCELADA");
+      const id = await motor.executarAgora(fx.a);
+      await servico.configurarAtribuicao(fx.a, { habilitada: false });
+      await motor.consumirUma();
+      assert.equal((await servico.execucao(id)).status, "CANCELADA");
+    });
+    test("evento repetido é idempotente; filtro e habilitação são respeitados", async () => {
+      const fx = await fixture();
+      await servico.salvarAgenda(
+        fx.a,
+        {
+          gatilho: "EVENTO",
+          tipo_evento: "financeiro.venda.alterada",
+          filtro_evento: { origem: "teste" },
+        },
+        fx.s,
+      );
+      const chave = randomUUID();
+      assert.equal(
+        await motor.publicar("financeiro.venda.alterada", chave, { origem: "teste" }),
+        true,
+      );
+      assert.equal(
+        await motor.publicar("financeiro.venda.alterada", chave, { origem: "teste" }),
+        false,
+      );
+      assert.equal((await servico.execucoes({ funcionario: fx.f })).total, 1);
+      await motor.consumirUma();
+      await motor.publicar("financeiro.venda.alterada", randomUUID(), { origem: "outra" });
+      assert.equal((await servico.execucoes({ funcionario: fx.f })).total, 1);
+    });
+    test("retentativa aplica backoff e nunca grava a mensagem sensível da exceção", async () => {
+      let tentativa = 0;
+      const fx = await fixture(async () => {
+        if (++tentativa === 1) throw new Error("SEGREDO_SENTINELA");
+        return { ok: true };
+      });
+      const id = await motor.executarAgora(fx.a);
+      await motor.consumirUma();
+      const primeira = await servico.execucao(id);
+      assert.equal(primeira.status, "AGUARDANDO");
+      assert.equal(primeira.erro_codigo, "HANDLER_FALHOU");
+      await pool.query(
+        "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE execucao_id=$1",
+        [id],
+      );
+      await motor.consumirUma();
+      const fim = await servico.execucao(id);
+      assert.equal(fim.status, "SUCESSO");
+      assert.equal(fim.tentativa, 2);
+      assert.equal(JSON.stringify(fim).includes("SEGREDO_SENTINELA"), false);
+    });
+    test("lease expirada é recuperada e fencing impede conclusão atrasada do primeiro consumidor", async () => {
+      let liberar: () => void = () => undefined;
+      let iniciar: () => void = () => undefined;
+      let chamadas = 0;
+      const iniciou = new Promise<void>((r) => {
+        iniciar = r;
+      });
+      const bloqueio = new Promise<void>((r) => {
+        liberar = r;
+      });
+      const fx = await fixture(async () => {
+        if (++chamadas === 1) {
+          iniciar();
+          await bloqueio;
+          return { origem: "antiga" };
+        }
+        return { origem: "nova" };
+      });
+      const id = await motor.executarAgora(fx.a);
+      const primeira = motor.consumirUma();
+      await iniciou;
+      await pool.query(
+        "UPDATE funcionarios.fila SET lease_ate=clock_timestamp()-interval '1 second' WHERE execucao_id=$1",
+        [id],
+      );
+      const outro = new MotorFuncionarios(pool, registro);
+      await outro.consumirUma();
+      liberar();
+      await primeira;
+      const fim = await servico.execucao(id);
+      assert.equal(fim.tentativa, 2);
+      assert.deepEqual(fim.resumo, { origem: "nova" });
+    });
+    test("heartbeat renova lease; política PULAR impede sobreposição", async () => {
+      let liberar: () => void = () => undefined;
+      let iniciar: () => void = () => undefined;
+      const iniciou = new Promise<void>((r) => {
+        iniciar = r;
+      });
+      const bloqueio = new Promise<void>((r) => {
+        liberar = r;
+      });
+      const fx = await fixture(async () => {
+        iniciar();
+        await bloqueio;
+        return { ok: true };
+      }, "PULAR");
+      await agendarAgora(fx.s);
+      const worker = new MotorFuncionarios(pool, registro, undefined, {
+        leaseSegundos: 3,
+        heartbeatMs: 40,
+      });
+      const primeira = worker.consumirUma();
+      await iniciou;
+      const antes = (
+        await pool.query<{ lease_ate: Date }>(
+          "SELECT q.lease_ate FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id WHERE e.atribuicao_id=$1 AND q.estado='EXECUTANDO'",
+          [fx.a],
+        )
+      ).rows[0]?.lease_ate;
+      assert.ok(antes);
+      await new Promise((r) => setTimeout(r, 120));
+      const depois = (
+        await pool.query<{ lease_ate: Date }>(
+          "SELECT q.lease_ate FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id WHERE e.atribuicao_id=$1 AND q.estado='EXECUTANDO'",
+          [fx.a],
+        )
+      ).rows[0]?.lease_ate;
+      assert.ok(depois && depois > antes);
+      await agendarAgora(fx.s, 2000);
+      await motor.consumirUma();
+      liberar();
+      await primeira;
+      assert.ok(
+        (await servico.execucoes({ funcionario: fx.f })).itens.some((e) => e.status === "IGNORADA"),
+      );
+    });
+    test("CANCELAR_ANTERIOR invalida tentativa antiga; ENFILEIRAR espera a anterior", async () => {
+      for (const politica of ["CANCELAR_ANTERIOR", "ENFILEIRAR"]) {
+        let liberar: () => void = () => undefined;
+        let iniciar: () => void = () => undefined;
+        let vezes = 0;
+        const iniciou = new Promise<void>((r) => {
+          iniciar = r;
+        });
+        const bloqueio = new Promise<void>((r) => {
+          liberar = r;
+        });
+        const fx = await fixture(async () => {
+          if (++vezes === 1) {
+            iniciar();
+            await bloqueio;
+          }
+          return { vezes };
+        }, politica);
+        await agendarAgora(fx.s);
+        const primeira = motor.consumirUma();
+        await iniciou;
+        await agendarAgora(fx.s, 3000);
+        const outro = new MotorFuncionarios(pool, registro);
+        await outro.consumirUma();
+        if (politica === "CANCELAR_ANTERIOR") assert.equal(vezes, 2);
+        else assert.equal(vezes, 1);
+        liberar();
+        await primeira;
+        if (politica === "ENFILEIRAR") {
+          await pool.query(
+            "UPDATE funcionarios.fila SET executar_em=clock_timestamp() WHERE estado='AGUARDANDO'",
+          );
+          await outro.consumirUma();
+          assert.equal(vezes, 2);
+        }
+        const h = await servico.execucoes({ funcionario: fx.f });
+        assert.equal(h.total, 2);
+        assert.equal(
+          h.itens.filter((e) => e.status === "SUCESSO").length,
+          politica === "CANCELAR_ANTERIOR" ? 1 : 2,
+        );
+      }
+    });
+    test("HTTP execução manual, paginação/detalhe e snapshot 3D refletem o histórico real", async () => {
+      const fx = await fixture();
+      const r = await chamar(`/atribuicoes/${fx.a}/executar`, "POST");
+      assert.equal(r.status, 201);
+      const { id } = (await r.json()) as { id: string };
+      await motor.consumirUma();
+      assert.equal((await chamar(`/execucoes/${id}`)).status, 200);
+      const lista = (await (
+        await chamar(`/execucoes?funcionario=${fx.f}&limite=1&deslocamento=0`)
+      ).json()) as ListaExecucoes;
+      assert.equal(lista.total, 1);
+      assert.equal(lista.itens[0]?.id, id);
+      const snapshot = (await (await chamar("/estado")).json()) as EstadoFuncionarios;
+      assert.ok(
+        snapshot.setores
+          .flatMap((s) => s.funcionarios)
+          .some((f) => f.id === fx.f && f.atividade?.id === id),
+      );
+      assert.equal((await chamar(`/atribuicoes/${fx.a}`, "DELETE")).status, 200);
+      assert.equal((await servico.detalhe(fx.f)).atribuicoes[0]?.habilitada, false);
+    });
+    test("pausar funcionário não interrompe execução em curso, mas impede novos disparos", async () => {
+      let liberar: () => void = () => undefined;
+      let iniciar: () => void = () => undefined;
+      const iniciou = new Promise<void>((r) => {
+        iniciar = r;
+      });
+      const espera = new Promise<void>((r) => {
+        liberar = r;
+      });
+      const fx = await fixture(async () => {
+        iniciar();
+        await espera;
+        return { ok: true };
+      });
+      const id = await motor.executarAgora(fx.a);
+      const consumindo = motor.consumirUma();
+      await iniciou;
+      await servico.statusFuncionario(fx.f, "PAUSADO");
+      await assert.rejects(motor.executarAgora(fx.a));
+      liberar();
+      await consumindo;
+      assert.equal((await servico.execucao(id)).status, "SUCESSO");
+    });
+    test("botão Hotmart usa a mesma fila e preserva resposta real sem rede externa", async () => {
+      const f = mock.method(globalThis, "fetch", async (entrada: Parameters<typeof fetch>[0]) => {
+        const url =
+          typeof entrada === "string"
+            ? entrada
+            : entrada instanceof URL
+              ? entrada.toString()
+              : entrada.url;
+        return new Response(
+          JSON.stringify(
+            url.includes("/oauth/token")
+              ? { access_token: "TOKEN_SIMULADO", expires_in: 3600 }
+              : { items: [] },
+          ),
+          { status: 200, headers: { "content-type": "application/json" } },
+        );
+      });
+      let aplicacao: INestApplication | undefined;
+      try {
+        const compartilhado = new MotorFuncionarios(pool, new RegistroHandlers());
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
+        const resultado = await sincronizacao.executar();
+        assert.equal(resultado.resultado, "sucesso");
+        const seed = (await servico.funcionarios()).find(
+          (x) => x.slug === "analista-atualizacoes-financeiras",
+        );
+        assert.ok(seed);
+        const historico = await servico.execucoes({ funcionario: seed.id });
+        assert.equal(historico.total, 1);
+        assert.equal(historico.itens[0]?.origem, "manual");
+        assert.equal(JSON.stringify(historico).includes("TOKEN_SIMULADO"), false);
+      } finally {
+        f.mock.restore();
+        await aplicacao?.close();
+      }
+    });
+    test("bootstrap inicializa intervalo uma vez e preserva edição do painel no reinício", async () => {
+      const seed = (await servico.funcionarios()).find(
+        (x) => x.slug === "analista-atualizacoes-financeiras",
+      );
+      assert.ok(seed);
+      const agenda = (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0];
+      assert.ok(agenda);
+      const primeira = await NestFactory.create(
+        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), true, 60)]),
+        { logger: false },
+      );
+      try {
+        await primeira.init();
+        motor.parar();
+      } finally {
+        await primeira.close();
+      }
+      assert.equal(
+        (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0]?.intervalo_min,
+        60,
+      );
+      await servico.salvarAgenda(
+        agenda.atribuicao_id,
+        { gatilho: "INTERVALO", intervalo_min: 90, habilitado: false },
+        agenda.id,
+      );
+      const segunda = await NestFactory.create(
+        AppModule.comModulos([FuncionariosModule.registrar(motor, new Secret(CHAVE), true, 120)]),
+        { logger: false },
+      );
+      try {
+        await segunda.init();
+        motor.parar();
+      } finally {
+        await segunda.close();
+      }
+      assert.equal(
+        (await servico.detalhe(seed.id)).atribuicoes[0]?.agendamentos[0]?.intervalo_min,
+        90,
+      );
+    });
+    test("IDs bigint acima do limite seguro de JS continuam exatos no contrato JSON", async () => {
+      const registro = (
+        await objetos<{ id: string }>(pool, "SELECT 9007199254740993::bigint id")
+      )[0];
+      assert.equal(registro?.id, "9007199254740993");
+      const agendas = await objetos<Agendamento>(
+        pool,
+        "SELECT * FROM funcionarios.agendamentos LIMIT 1",
+      );
+      assert.equal(typeof agendas[0]?.id, "string");
+    });
+  },
+);
diff --git a/apps/api/src/funcionarios/funcionarios.module.ts b/apps/api/src/funcionarios/funcionarios.module.ts
new file mode 100644
index 0000000..d06242c
--- /dev/null
+++ b/apps/api/src/funcionarios/funcionarios.module.ts
@@ -0,0 +1,74 @@
+import {
+  Inject,
+  Injectable,
+  Module,
+  type DynamicModule,
+  type OnApplicationBootstrap,
+  type OnApplicationShutdown,
+} from "@nestjs/common";
+import type { Secret } from "@nucleos/config";
+import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
+import { FuncionariosController } from "./funcionarios.controller.js";
+import { MotorFuncionarios } from "./motor.js";
+import { SERVICO_FUNCIONARIOS, ServicoFuncionarios } from "./servico.js";
+
+export const MOTOR_FUNCIONARIOS = Symbol("MOTOR_FUNCIONARIOS");
+const INTERVALO_INICIAL = Symbol("INTERVALO_INICIAL");
+@Injectable()
+class CicloMotor implements OnApplicationBootstrap, OnApplicationShutdown {
+  constructor(
+    @Inject(MOTOR_FUNCIONARIOS) private readonly motor: MotorFuncionarios,
+    @Inject(INTERVALO_INICIAL) private readonly intervaloInicial: number,
+  ) {}
+  async onApplicationBootstrap(): Promise<void> {
+    const chaves = this.motor.registro.chaves();
+    // O catálogo jamais anuncia um handler ausente. Não altera tarefas PLANEJADAS de código futuro.
+    await this.motor.pool.query(
+      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='INDISPONIVEL' WHERE status_implementacao='DISPONIVEL' AND NOT(handler_key=ANY($1::text[]))",
+      [chaves],
+    );
+    // O ambiente inicializa somente o seed intocado; edições do painel sempre prevalecem.
+    await this.motor.pool.query(
+      `UPDATE funcionarios.agendamentos s SET intervalo_min=$1,versao=versao+1
+      FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+      WHERE s.atribuicao_id=a.id AND d.codigo='financeiro.atualizar_dados'
+      AND s.versao=1 AND s.ultima_em IS NULL AND s.gatilho='INTERVALO'`,
+      [this.intervaloInicial],
+    );
+    await this.motor.pool.query(
+      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL' WHERE handler_key=ANY($1::text[]) AND status_implementacao='INDISPONIVEL'",
+      [chaves],
+    );
+    await this.motor.pool
+      .query(`UPDATE funcionarios.funcionarios f SET status='RASCUNHO',atualizado_em=now()
+      WHERE f.slug='analista-atualizacoes-financeiras' AND f.status='ATIVO'
+      AND NOT EXISTS(SELECT 1 FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+        WHERE a.funcionario_id=f.id AND a.habilitada AND d.ativo AND d.status_implementacao='DISPONIVEL')`);
+    this.motor.iniciar();
+  }
+  onApplicationShutdown(): void {
+    this.motor.parar();
+  }
+}
+@Module({})
+export class FuncionariosModule {
+  static registrar(
+    motor: MotorFuncionarios,
+    apiKey: Secret | undefined,
+    rodar = true,
+    intervaloInicial = 30,
+  ): DynamicModule {
+    return {
+      module: FuncionariosModule,
+      controllers: [FuncionariosController],
+      providers: [
+        ChaveServicoGuard,
+        { provide: CHAVE_SERVICO, useValue: apiKey },
+        { provide: MOTOR_FUNCIONARIOS, useValue: motor },
+        { provide: INTERVALO_INICIAL, useValue: intervaloInicial },
+        { provide: SERVICO_FUNCIONARIOS, useValue: new ServicoFuncionarios(motor.pool, motor) },
+        ...(rodar ? [CicloMotor] : []),
+      ],
+    };
+  }
+}
diff --git a/apps/api/src/funcionarios/handlers.ts b/apps/api/src/funcionarios/handlers.ts
new file mode 100644
index 0000000..633f905
--- /dev/null
+++ b/apps/api/src/funcionarios/handlers.ts
@@ -0,0 +1,59 @@
+import {
+  BadRequestException,
+  ForbiddenException,
+  ServiceUnavailableException,
+} from "@nestjs/common";
+import { validarConfigTarefa, type ObjetoConfig } from "@nucleos/contracts";
+import { dadosSeguros } from "./agenda.js";
+
+export interface ContextoHandler {
+  execucaoId: string;
+  chaveIdempotencia: string;
+  tentativa: number;
+  config: ObjetoConfig;
+  signal: AbortSignal; /** Verificar imediatamente antes de efeitos não idempotentes. */
+  verificarLease: () => Promise<boolean>;
+}
+export interface HandlerFuncionario {
+  chave: string;
+  validarConfig: (config: ObjetoConfig) => boolean;
+  executar: (ctx: ContextoHandler) => Promise<unknown>;
+}
+export class RegistroHandlers {
+  readonly #handlers = new Map<string, HandlerFuncionario>();
+  registrar(h: HandlerFuncionario): void {
+    if (this.#handlers.has(h.chave)) throw new Error("handler duplicado");
+    this.#handlers.set(h.chave, h);
+  }
+  obter(chave: string | null): HandlerFuncionario {
+    const h = chave === null ? undefined : this.#handlers.get(chave);
+    if (h === undefined) throw new ServiceUnavailableException("executor indisponivel");
+    return h;
+  }
+  possui(chave: string | null): boolean {
+    return chave !== null && this.#handlers.has(chave);
+  }
+  chaves(): string[] {
+    return [...this.#handlers.keys()];
+  }
+}
+/** Admin único local. A identidade é fornecida pelo guard, nunca pelo corpo da requisição. */
+export class AutorizadorFuncionarios {
+  permitir(permissoes: readonly string[], identidade = "admin-local"): void {
+    if (identidade !== "admin-local" || permissoes.some((p) => !/^\w+[.\w]*$/.test(p)))
+      throw new ForbiddenException();
+  }
+}
+export function validarConfiguracao(
+  schema: ObjetoConfig,
+  config: ObjetoConfig,
+  handler: HandlerFuncionario,
+): void {
+  if (
+    !dadosSeguros(config) ||
+    JSON.stringify(config).length > 32000 ||
+    !validarConfigTarefa(schema, config) ||
+    !handler.validarConfig(config)
+  )
+    throw new BadRequestException("configuracao invalida");
+}
diff --git a/apps/api/src/funcionarios/motor.ts b/apps/api/src/funcionarios/motor.ts
new file mode 100644
index 0000000..b0af497
--- /dev/null
+++ b/apps/api/src/funcionarios/motor.ts
@@ -0,0 +1,417 @@
+import { randomUUID } from "node:crypto";
+import { ConflictException, NotFoundException } from "@nestjs/common";
+import type { Agendamento, ExecucaoFuncionario, ObjetoConfig } from "@nucleos/contracts";
+import type { Pool, PoolClient, QueryResultRow } from "pg";
+import { dadosSeguros, EVENTOS_FUNCIONARIOS, proximaOcorrencia } from "./agenda.js";
+import type { RegistroHandlers } from "./handlers.js";
+import { AutorizadorFuncionarios, validarConfiguracao } from "./handlers.js";
+import { atribuicaoMotor, auditar, exigirExecutavel, objetos, transacao } from "./repositorio.js";
+
+interface ItemFila extends QueryResultRow {
+  id: string;
+  execucao_id: string;
+  tentativa: number;
+  atribuicao_id: string;
+  agendamento_id: string | null;
+  agendamento_versao: number | null;
+  chave_idempotencia: string;
+  config_snapshot: ObjetoConfig;
+  politica_sobreposicao: string;
+  politica_retentativa: { maxTentativas: number; backoffSegundos: number };
+  versao: number | null;
+  habilitado: boolean | null;
+  estado: string;
+}
+export interface OpcoesMotor {
+  dono?: string;
+  agora?: (c: PoolClient) => Promise<Date>;
+  leaseSegundos?: number;
+  heartbeatMs?: number;
+  log?: (mensagem: string) => void;
+}
+
+/** Fonte de verdade PostgreSQL; fila e histórico são gravados na mesma transação. */
+export class MotorFuncionarios {
+  readonly #dono: string;
+  readonly #agora: (c: PoolClient) => Promise<Date>;
+  readonly #leaseSegundos: number;
+  readonly #heartbeat: number;
+  readonly #ativos = new Set<AbortController>();
+  #timer: NodeJS.Timeout | undefined;
+  #rodando = false;
+  #consumindo = false;
+  constructor(
+    readonly pool: Pool,
+    readonly registro: RegistroHandlers,
+    readonly autorizador = new AutorizadorFuncionarios(),
+    private readonly opcoes: OpcoesMotor = {},
+  ) {
+    this.#dono = opcoes.dono ?? randomUUID();
+    this.#leaseSegundos = opcoes.leaseSegundos ?? 300;
+    this.#heartbeat = opcoes.heartbeatMs ?? 60000;
+    this.#agora =
+      opcoes.agora ??
+      (async (c) =>
+        (await c.query<{ agora: Date }>("SELECT clock_timestamp() agora")).rows[0]?.agora ??
+        new Date());
+  }
+  async #enfileirar(
+    c: PoolClient,
+    id: string,
+    chave: string,
+    origem: string,
+    quando: Date,
+    agendamento?: Agendamento,
+  ): Promise<string> {
+    const a = await atribuicaoMotor(c, id);
+    exigirExecutavel(a);
+    this.autorizador.permitir(a.permissoes_requeridas);
+    validarConfiguracao(a.config_schema, a.config, this.registro.obter(a.handler_key));
+    const r = await c.query<{ id: string }>(
+      `INSERT INTO funcionarios.execucoes(atribuicao_id,agendamento_id,agendamento_versao,origem,
+   programada_em,chave_idempotencia,correlacao,config_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
+   ON CONFLICT(chave_idempotencia) DO UPDATE SET chave_idempotencia=EXCLUDED.chave_idempotencia RETURNING id`,
+      [
+        id,
+        agendamento?.id ?? null,
+        agendamento?.versao ?? null,
+        origem,
+        quando,
+        chave,
+        randomUUID(),
+        a.config,
+      ],
+    );
+    const execucao = r.rows[0]?.id;
+    if (execucao === undefined) throw new Error("enfileiramento sem identificador");
+    await c.query(
+      "INSERT INTO funcionarios.fila(execucao_id,executar_em) VALUES($1,$2) ON CONFLICT(execucao_id) DO NOTHING",
+      [execucao, quando],
+    );
+    if (origem === "manual")
+      await auditar(c, "execucao", execucao, "executar", null, { atribuicao_id: id });
+    return execucao;
+  }
+  executarAgora(atribuicaoId: string): Promise<string> {
+    return transacao(this.pool, async (c) =>
+      this.#enfileirar(c, atribuicaoId, `manual:${randomUUID()}`, "manual", await this.#agora(c)),
+    );
+  }
+  async planejar(): Promise<number> {
+    return transacao(this.pool, async (c) => {
+      const agora = await this.#agora(c);
+      const { rows } = await c.query<{ agenda: Agendamento }>(
+        `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s
+   JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id
+   JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id JOIN organizacao.setores setor ON setor.id=f.setor_id
+   WHERE s.habilitado AND a.habilitada AND f.status='ATIVO' AND d.ativo AND setor.ativo
+    AND d.status_implementacao='DISPONIVEL' AND s.proxima_em<=$1
+   ORDER BY s.proxima_em,s.id LIMIT 100 FOR UPDATE OF s SKIP LOCKED`,
+        [agora],
+      );
+      let total = 0;
+      for (const { agenda: s } of rows) {
+        const ocorrencia = new Date(s.proxima_em as string);
+        if (s.fim_em === null || ocorrencia <= new Date(s.fim_em)) {
+          await this.#enfileirar(
+            c,
+            s.atribuicao_id,
+            `agendamento:${s.id}:v${s.versao}:${ocorrencia.toISOString()}`,
+            "agendamento",
+            ocorrencia,
+            s,
+          );
+          total++;
+        }
+        const proxima = proximaOcorrencia(s, agora);
+        await c.query(
+          "UPDATE funcionarios.agendamentos SET ultima_em=$2,proxima_em=$3 WHERE id=$1",
+          [s.id, ocorrencia, proxima],
+        );
+      }
+      return total;
+    });
+  }
+  /** Pode usar o client da transação de negócio para publicar atomicamente (outbox local). */
+  async publicar(
+    tipo: string,
+    chave: string,
+    payload: ObjetoConfig,
+    cliente?: PoolClient,
+  ): Promise<boolean> {
+    if (
+      !EVENTOS_FUNCIONARIOS.some((t) => t === tipo) ||
+      chave.length > 200 ||
+      !dadosSeguros(payload) ||
+      JSON.stringify(payload).length > 32000
+    )
+      throw new ConflictException("evento invalido");
+    const publicar = async (c: PoolClient): Promise<boolean> => {
+      const { rows } = await c.query<{ id: string }>(
+        "INSERT INTO funcionarios.eventos(tipo,chave,payload) VALUES($1,$2,$3) ON CONFLICT(chave) DO NOTHING RETURNING id",
+        [tipo, `${tipo}:${chave}`, payload],
+      );
+      const evento = rows[0];
+      if (evento === undefined) return false;
+      const agora = await this.#agora(c);
+      const agendas = await c.query<{ agenda: Agendamento }>(
+        `SELECT funcionarios.json_ids(to_jsonb(s)) agenda FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id
+    JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+    WHERE s.gatilho='EVENTO' AND s.tipo_evento=$1 AND $2::jsonb @> s.filtro_evento AND s.habilitado
+    AND s.inicio_em<=$3 AND(s.fim_em IS NULL OR s.fim_em>=$3) AND a.habilitada AND f.status='ATIVO' AND d.ativo
+    AND d.status_implementacao='DISPONIVEL' ORDER BY s.id FOR UPDATE OF s`,
+        [tipo, payload, agora],
+      );
+      for (const { agenda: s } of agendas.rows)
+        await this.#enfileirar(
+          c,
+          s.atribuicao_id,
+          `evento:${evento.id}:agendamento:${s.id}:v${s.versao}`,
+          "evento",
+          agora,
+          s,
+        );
+      await c.query("UPDATE funcionarios.eventos SET processado_em=$2 WHERE id=$1", [
+        evento.id,
+        agora,
+      ]);
+      return true;
+    };
+    return cliente === undefined ? transacao(this.pool, publicar) : publicar(cliente);
+  }
+  async #reivindicar(): Promise<ItemFila | null> {
+    return transacao(this.pool, async (c) => {
+      const agora = await this.#agora(c);
+      const r = await c.query<ItemFila>(
+        `SELECT q.id,q.execucao_id,q.tentativa,q.estado,e.atribuicao_id,e.agendamento_id,e.agendamento_versao,e.chave_idempotencia,e.config_snapshot,
+   s.versao,s.habilitado,coalesce(s.politica_sobreposicao,'ENFILEIRAR') politica_sobreposicao,
+   coalesce(s.politica_retentativa,'{"maxTentativas":3,"backoffSegundos":30}'::jsonb) politica_retentativa
+   FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id LEFT JOIN funcionarios.agendamentos s ON s.id=e.agendamento_id
+   JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id
+   WHERE(q.estado='AGUARDANDO' AND q.executar_em<=$1 OR q.estado='EXECUTANDO' AND q.lease_ate<=$1)
+   ORDER BY a.prioridade DESC,q.executar_em,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED`,
+        [agora],
+      );
+      const item = r.rows[0];
+      if (item === undefined) return null;
+      const a = await atribuicaoMotor(c, item.atribuicao_id);
+      const velho =
+        item.agendamento_id !== null &&
+        (item.versao !== item.agendamento_versao || item.habilitado !== true);
+      if (
+        velho ||
+        !a.habilitada ||
+        a.funcionario_status !== "ATIVO" ||
+        !a.ativo ||
+        a.status_implementacao !== "DISPONIVEL" ||
+        !this.registro.possui(a.handler_key)
+      ) {
+        await this.#encerrarSemExecutor(c, item, "CANCELADA", agora);
+        return null;
+      }
+      this.autorizador.permitir(a.permissoes_requeridas);
+      try {
+        validarConfiguracao(
+          a.config_schema,
+          item.config_snapshot,
+          this.registro.obter(a.handler_key),
+        );
+      } catch {
+        await this.#encerrarSemExecutor(c, item, "FALHA", agora);
+        return null;
+      }
+      const ativos = await c.query<{ id: string; execucao_id: string }>(
+        `SELECT q.id,q.execucao_id FROM funcionarios.fila q JOIN funcionarios.execucoes e ON e.id=q.execucao_id
+    WHERE e.atribuicao_id=$1 AND q.id<>$2 AND q.estado='EXECUTANDO' AND q.lease_ate>$3`,
+        [a.id, item.id, agora],
+      );
+      if (ativos.rowCount !== 0) {
+        if (item.politica_sobreposicao === "PULAR") {
+          await this.#encerrarSemExecutor(c, item, "IGNORADA", agora);
+          return null;
+        }
+        if (item.politica_sobreposicao === "ENFILEIRAR") {
+          await c.query("UPDATE funcionarios.fila SET executar_em=$2 WHERE id=$1", [
+            item.id,
+            new Date(agora.getTime() + 15000),
+          ]);
+          return null;
+        }
+        for (const outro of ativos.rows) {
+          await c.query(
+            "UPDATE funcionarios.fila SET estado='CANCELADA',tentativa=tentativa+1 WHERE id=$1",
+            [outro.id],
+          );
+          await c.query(
+            "UPDATE funcionarios.execucoes SET status='CANCELADA',finalizada_em=$2 WHERE id=$1",
+            [outro.execucao_id, agora],
+          );
+        }
+      }
+      const max = item.politica_retentativa.maxTentativas;
+      if (item.tentativa >= max) {
+        await this.#encerrarSemExecutor(c, item, "FALHA", agora);
+        return null;
+      }
+      item.tentativa++;
+      await c.query(
+        "UPDATE funcionarios.fila SET estado='EXECUTANDO',tentativa=$2,lease_dono=$3,lease_ate=$4 WHERE id=$1",
+        [
+          item.id,
+          item.tentativa,
+          this.#dono,
+          new Date(agora.getTime() + this.#leaseSegundos * 1000),
+        ],
+      );
+      await c.query(
+        "UPDATE funcionarios.execucoes SET status='EXECUTANDO',tentativa=$2,iniciada_em=$3,finalizada_em=NULL,erro_codigo=NULL WHERE id=$1",
+        [item.execucao_id, item.tentativa, agora],
+      );
+      return item;
+    });
+  }
+  async #encerrarSemExecutor(
+    c: PoolClient,
+    item: ItemFila,
+    status: string,
+    agora: Date,
+  ): Promise<void> {
+    await c.query("UPDATE funcionarios.fila SET estado=$2 WHERE id=$1", [item.id, status]);
+    await c.query("UPDATE funcionarios.execucoes SET status=$2,finalizada_em=$3 WHERE id=$1", [
+      item.execucao_id,
+      status,
+      agora,
+    ]);
+  }
+  async #lease(item: ItemFila, renovar: boolean): Promise<boolean> {
+    const { rowCount } = await this.pool.query(
+      `UPDATE funcionarios.fila SET lease_ate=CASE WHEN $5 THEN clock_timestamp()+($4::integer*interval '1 second') ELSE lease_ate END
+   WHERE id=$1 AND tentativa=$2 AND lease_dono=$3 AND estado='EXECUTANDO' AND lease_ate>clock_timestamp()`,
+      [item.id, item.tentativa, this.#dono, this.#leaseSegundos, renovar],
+    );
+    return rowCount === 1;
+  }
+  async consumirUma(): Promise<boolean> {
+    const item = await this.#reivindicar();
+    if (item === null) return false;
+    const controller = new AbortController();
+    this.#ativos.add(controller);
+    const heartbeat = setInterval(() => {
+      void this.#lease(item, true)
+        .then((ok) => {
+          if (!ok) controller.abort();
+        })
+        .catch(() => {
+          controller.abort();
+        });
+    }, this.#heartbeat);
+    heartbeat.unref();
+    let resumo: unknown = null;
+    let falha = false;
+    try {
+      const a = await transacao(this.pool, (c) => atribuicaoMotor(c, item.atribuicao_id));
+      resumo = await this.registro.obter(a.handler_key).executar({
+        execucaoId: item.execucao_id,
+        chaveIdempotencia: item.chave_idempotencia,
+        tentativa: item.tentativa,
+        config: item.config_snapshot,
+        signal: controller.signal,
+        verificarLease: () => this.#lease(item, false),
+      });
+      resumo ??= null;
+      if (!dadosSeguros(resumo) || JSON.stringify(resumo).length > 32000)
+        resumo = { mensagem: "execucao concluida" };
+    } catch {
+      falha = true;
+      resumo = null;
+    } finally {
+      clearInterval(heartbeat);
+      this.#ativos.delete(controller);
+    }
+    await transacao(this.pool, async (c) => {
+      const agora = await this.#agora(c);
+      const retry = falha && item.tentativa < item.politica_retentativa.maxTentativas;
+      const status = retry ? "AGUARDANDO" : falha ? "FALHA" : "SUCESSO";
+      const { rowCount } = await c.query(
+        `UPDATE funcionarios.fila SET estado=$4,lease_ate=NULL,lease_dono=NULL,executar_em=$5
+    WHERE id=$1 AND tentativa=$2 AND lease_dono=$3 AND estado='EXECUTANDO' AND lease_ate>clock_timestamp()`,
+        [
+          item.id,
+          item.tentativa,
+          this.#dono,
+          status,
+          new Date(
+            agora.getTime() +
+              item.politica_retentativa.backoffSegundos * 1000 * 2 ** (item.tentativa - 1),
+          ),
+        ],
+      );
+      if (rowCount === 1)
+        await c.query(
+          "UPDATE funcionarios.execucoes SET status=$2,finalizada_em=$3,resumo=$4,erro_codigo=$5 WHERE id=$1",
+          [
+            item.execucao_id,
+            status,
+            retry ? null : agora,
+            JSON.stringify(resumo),
+            falha ? "HANDLER_FALHOU" : null,
+          ],
+        );
+    });
+    return true;
+  }
+  async aguardar(execucaoId: string, timeoutMs = 120000): Promise<ExecucaoFuncionario> {
+    const fim = Date.now() + timeoutMs;
+    while (Date.now() < fim) {
+      const e = (
+        await objetos<ExecucaoFuncionario>(
+          this.pool,
+          "SELECT * FROM funcionarios.execucoes WHERE id=$1",
+          [execucaoId],
+        )
+      )[0];
+      if (e === undefined) throw new NotFoundException();
+      if (!["AGUARDANDO", "EXECUTANDO"].includes(e.status)) return e;
+      await new Promise((resolve) => setTimeout(resolve, 100));
+    }
+    throw new ConflictException("execucao ainda em andamento");
+  }
+  iniciar(): void {
+    if (this.#timer !== undefined) return;
+    const tick = async (): Promise<void> => {
+      if (this.#rodando) return;
+      this.#rodando = true;
+      try {
+        await this.planejar();
+      } catch {
+        this.opcoes.log?.("funcionarios: rodada falhou");
+      } finally {
+        this.#rodando = false;
+      }
+    };
+    const consumir = async (): Promise<void> => {
+      if (this.#consumindo) return;
+      this.#consumindo = true;
+      try {
+        await this.consumirUma();
+      } catch {
+        this.opcoes.log?.("funcionarios: consumidor falhou");
+      } finally {
+        this.#consumindo = false;
+      }
+    };
+    // O planejador continua avançando mesmo quando o handler demora mais de um tick.
+    const rodada = (): void => {
+      void tick();
+      void consumir();
+    };
+    rodada();
+    this.#timer = setInterval(rodada, 15000);
+    this.#timer.unref();
+  }
+  parar(): void {
+    if (this.#timer !== undefined) clearInterval(this.#timer);
+    this.#timer = undefined;
+    for (const ativo of this.#ativos) ativo.abort();
+  }
+}
diff --git a/apps/api/src/funcionarios/repositorio.ts b/apps/api/src/funcionarios/repositorio.ts
new file mode 100644
index 0000000..07c0b49
--- /dev/null
+++ b/apps/api/src/funcionarios/repositorio.ts
@@ -0,0 +1,75 @@
+import { ConflictException, NotFoundException } from "@nestjs/common";
+import type { ObjetoConfig } from "@nucleos/contracts";
+import type { Pool, PoolClient, QueryResultRow } from "pg";
+
+export interface AtribuicaoMotor extends QueryResultRow {
+  id: string;
+  config: ObjetoConfig;
+  habilitada: boolean;
+  funcionario_status: string;
+  definicao_id: string;
+  handler_key: string | null;
+  config_schema: ObjetoConfig;
+  permissoes_requeridas: string[];
+  status_implementacao: string;
+  ativo: boolean;
+  gatilhos_suportados: string[];
+}
+export async function atribuicaoMotor(c: PoolClient, id: string): Promise<AtribuicaoMotor> {
+  const { rows } = await c.query<AtribuicaoMotor>(
+    `SELECT a.id,a.config,a.habilitada,f.status funcionario_status,d.id definicao_id,
+ d.handler_key,d.config_schema,d.permissoes_requeridas,d.status_implementacao,d.ativo,d.gatilhos_suportados
+ FROM funcionarios.atribuicoes a JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id
+ JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id JOIN organizacao.setores s ON s.id=f.setor_id
+ WHERE a.id=$1 AND s.ativo FOR UPDATE OF a`,
+    [id],
+  );
+  const a = rows[0];
+  if (a === undefined) throw new NotFoundException("atribuicao nao encontrada");
+  return a;
+}
+export function exigirExecutavel(a: AtribuicaoMotor): void {
+  if (
+    !a.habilitada ||
+    a.funcionario_status !== "ATIVO" ||
+    !a.ativo ||
+    a.status_implementacao !== "DISPONIVEL"
+  )
+    throw new ConflictException("tarefa nao executavel");
+}
+export async function transacao<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
+  const c = await pool.connect();
+  try {
+    await c.query("BEGIN");
+    try {
+      const r = await fn(c);
+      await c.query("COMMIT");
+      return r;
+    } catch (e) {
+      await c.query("ROLLBACK");
+      throw e;
+    }
+  } finally {
+    c.release();
+  }
+}
+export async function auditar(
+  c: PoolClient,
+  entidade: string,
+  id: string,
+  acao: string,
+  antes: unknown,
+  depois: unknown,
+): Promise<void> {
+  await c.query(
+    "INSERT INTO funcionarios.auditoria(entidade,entidade_id,acao,antes,depois) VALUES($1,$2,$3,$4,$5)",
+    [entidade, id, acao, JSON.stringify(antes), JSON.stringify(depois)],
+  );
+}
+export async function objetos<T>(pool: Pool, sql: string, valores: unknown[] = []): Promise<T[]> {
+  const { rows } = await pool.query<{ dado: T }>(
+    `SELECT funcionarios.json_ids(to_jsonb(x)) dado FROM (${sql}) x`,
+    valores,
+  );
+  return rows.map((r) => r.dado);
+}
diff --git a/apps/api/src/funcionarios/servico.ts b/apps/api/src/funcionarios/servico.ts
new file mode 100644
index 0000000..8ec9ad5
--- /dev/null
+++ b/apps/api/src/funcionarios/servico.ts
@@ -0,0 +1,501 @@
+import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
+import type {
+  Agendamento,
+  Atribuicao,
+  DefinicaoTarefa,
+  DetalheFuncionario,
+  EstadoFuncionarios,
+  ExecucaoFuncionario,
+  Funcionario,
+  ListaExecucoes,
+  ObjetoConfig,
+  Setor,
+} from "@nucleos/contracts";
+import type { Pool, PoolClient } from "pg";
+import {
+  booleano,
+  campos,
+  EVENTOS_FUNCIONARIOS,
+  exigirObjeto,
+  identificador,
+  inteiro,
+  objeto,
+  opcao,
+  proximasOcorrencias,
+  proximaOcorrencia,
+  texto,
+  validarAgenda,
+} from "./agenda.js";
+import { validarConfiguracao } from "./handlers.js";
+import type { MotorFuncionarios } from "./motor.js";
+import { atribuicaoMotor, auditar, objetos, transacao } from "./repositorio.js";
+
+const CONSULTA_FUNCIONARIOS = `SELECT f.*,
+ (SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.funcionario_id=f.id) tarefas,
+ (SELECT max(e.iniciada_em) FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id WHERE a.funcionario_id=f.id) ultima_em,
+ (SELECT min(s.proxima_em) FROM funcionarios.agendamentos s JOIN funcionarios.atribuicoes a ON a.id=s.atribuicao_id WHERE a.funcionario_id=f.id AND s.habilitado AND a.habilitada) proxima_em,
+ (SELECT count(*)::integer FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id WHERE a.funcionario_id=f.id AND e.status='FALHA' AND e.criado_em>now()-interval '7 days') falhas
+ FROM funcionarios.funcionarios f`;
+export const SERVICO_FUNCIONARIOS = Symbol("SERVICO_FUNCIONARIOS");
+export class ServicoFuncionarios {
+  constructor(
+    readonly pool: Pool,
+    readonly motor: MotorFuncionarios,
+  ) {}
+  setores(): Promise<Setor[]> {
+    return objetos(this.pool, "SELECT * FROM organizacao.setores WHERE ativo ORDER BY ordem,nome");
+  }
+  async setor(id: string): Promise<Setor> {
+    return this.#um(
+      await objetos<Setor>(this.pool, "SELECT * FROM organizacao.setores WHERE id=$1", [
+        identificador(id),
+      ]),
+    );
+  }
+  funcionarios(q: ObjetoConfig = {}): Promise<Funcionario[]> {
+    const setor = q["setor"] === undefined ? null : identificador(q["setor"]);
+    const busca = q["busca"] === undefined || q["busca"] === "" ? "" : texto(q["busca"], 100);
+    const status =
+      q["status"] === undefined || q["status"] === ""
+        ? null
+        : opcao(q["status"], ["RASCUNHO", "ATIVO", "PAUSADO", "DESATIVADO"]);
+    return objetos(
+      this.pool,
+      `${CONSULTA_FUNCIONARIOS} WHERE($1::bigint IS NULL OR f.setor_id=$1) AND f.nome ILIKE '%'||$2||'%' AND($3::text IS NULL OR f.status=$3) ORDER BY f.nome LIMIT 200`,
+      [setor, busca, status],
+    );
+  }
+  async detalhe(id: string): Promise<DetalheFuncionario> {
+    const funcionario = this.#um(
+      await objetos<Funcionario>(this.pool, `${CONSULTA_FUNCIONARIOS} WHERE f.id=$1`, [
+        identificador(id),
+      ]),
+    );
+    const atribuicoes = await objetos<Atribuicao>(
+      this.pool,
+      `SELECT a.*,funcionarios.json_ids(to_jsonb(d)) definicao,coalesce((SELECT jsonb_agg(funcionarios.json_ids(to_jsonb(s)) ORDER BY s.id) FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id),'[]') agendamentos FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE a.funcionario_id=$1 ORDER BY d.nome`,
+      [id],
+    );
+    return { funcionario, atribuicoes };
+  }
+  catalogo(q: ObjetoConfig = {}): Promise<DefinicaoTarefa[]> {
+    const setor = q["setor"] === undefined ? null : identificador(q["setor"]);
+    const status =
+      q["status"] === undefined || q["status"] === ""
+        ? null
+        : opcao(q["status"], ["DISPONIVEL", "PLANEJADA", "INDISPONIVEL"]);
+    return objetos(
+      this.pool,
+      `SELECT d.*,(SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.definicao_id=d.id) atribuicoes,
+   (SELECT count(*)::integer FROM funcionarios.atribuicoes a WHERE a.definicao_id=d.id AND a.habilitada) habilitadas FROM funcionarios.definicoes_tarefa d
+   WHERE($1::bigint IS NULL OR d.setor_id=$1)AND($2::text IS NULL OR d.status_implementacao=$2) ORDER BY d.nome`,
+      [setor, status],
+    );
+  }
+  async tarefa(id: string): Promise<DefinicaoTarefa> {
+    return this.#um(
+      await objetos<DefinicaoTarefa>(
+        this.pool,
+        "SELECT * FROM funcionarios.definicoes_tarefa WHERE id=$1",
+        [identificador(id)],
+      ),
+    );
+  }
+  async salvarFuncionario(entrada: unknown, id?: string): Promise<string> {
+    const x = exigirObjeto(entrada);
+    campos(x, ["nome", "setor_id", "descricao", "tipo", "perfil_ia", "avatar"]);
+    const nome = texto(x["nome"]);
+    const setor = identificador(x["setor_id"]);
+    const tipo = opcao(x["tipo"], ["DETERMINISTICO", "AGENTE_IA", "HIBRIDO"]);
+    const descricao = x["descricao"] === undefined ? "" : texto(x["descricao"], 2000);
+    const perfil =
+      x["perfil_ia"] === undefined || x["perfil_ia"] === null || x["perfil_ia"] === ""
+        ? null
+        : texto(x["perfil_ia"], 100);
+    const avatar =
+      x["avatar"] === undefined || x["avatar"] === null || x["avatar"] === ""
+        ? null
+        : texto(x["avatar"], 100);
+    if (avatar !== null && !/^[a-z0-9_-]+$/.test(avatar))
+      throw new BadRequestException("avatar invalido");
+    return this.#mutacao(async (c) => {
+      const antes =
+        id === undefined
+          ? null
+          : (
+              await c.query<{ dado: Funcionario }>(
+                "SELECT funcionarios.json_ids(to_jsonb(f)) dado FROM funcionarios.funcionarios f WHERE id=$1 FOR UPDATE",
+                [identificador(id)],
+              )
+            ).rows[0]?.dado;
+      if (id !== undefined && antes === undefined) throw new NotFoundException();
+      if (antes !== null && antes !== undefined && antes.setor_id !== setor) {
+        const r = await c.query(
+          "SELECT 1 FROM funcionarios.atribuicoes WHERE funcionario_id=$1 LIMIT 1",
+          [id],
+        );
+        if (r.rowCount !== 0)
+          throw new ConflictException("funcionario com atribuicoes nao muda de setor");
+      }
+      const r =
+        id === undefined
+          ? await c.query<{ id: string }>(
+              "INSERT INTO funcionarios.funcionarios(setor_id,nome,slug,descricao,tipo,perfil_ia,avatar) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
+              [setor, nome, `funcionario-${crypto.randomUUID()}`, descricao, tipo, perfil, avatar],
+            )
+          : await c.query<{ id: string }>(
+              "UPDATE funcionarios.funcionarios SET setor_id=$2,nome=$3,descricao=$4,tipo=$5,perfil_ia=$6,avatar=$7,atualizado_em=now() WHERE id=$1 RETURNING id",
+              [id, setor, nome, descricao, tipo, perfil, avatar],
+            );
+      const salvo = this.#um(r.rows).id;
+      await auditar(c, "funcionario", salvo, id === undefined ? "criar" : "editar", antes, x);
+      return salvo;
+    });
+  }
+  async statusFuncionario(id: string, status: unknown): Promise<void> {
+    const novo = opcao(status, ["ATIVO", "PAUSADO", "DESATIVADO", "RASCUNHO"]);
+    await this.#mutacao(async (c) => {
+      const f = this.#um(
+        (
+          await c.query<{ status: string }>(
+            "SELECT status FROM funcionarios.funcionarios WHERE id=$1 FOR UPDATE",
+            [identificador(id)],
+          )
+        ).rows,
+      );
+      if (novo === "ATIVO") {
+        const tarefas = await c.query<{ handler_key: string | null }>(
+          `SELECT d.handler_key FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE a.funcionario_id=$1 AND a.habilitada AND d.ativo AND d.status_implementacao='DISPONIVEL'`,
+          [id],
+        );
+        if (!tarefas.rows.some((t) => this.motor.registro.possui(t.handler_key)))
+          throw new ConflictException("nenhum executor disponivel");
+      }
+      await c.query(
+        "UPDATE funcionarios.funcionarios SET status=$2,atualizado_em=now() WHERE id=$1",
+        [id, novo],
+      );
+      if (novo !== "ATIVO") await this.#invalidarAgendas(c, id);
+      await auditar(c, "funcionario", id, "status", f, { status: novo });
+    });
+  }
+  async salvarTarefa(entrada: unknown, id?: string): Promise<string> {
+    const x = exigirObjeto(entrada);
+    campos(
+      x,
+      id === undefined
+        ? ["setor_id", "codigo", "nome", "descricao", "tipo"]
+        : ["nome", "descricao", "ativo"],
+    );
+    return this.#mutacao(async (c) => {
+      if (id === undefined) {
+        const codigo = texto(x["codigo"], 100);
+        if (!/^[a-z]+\.[a-z_]+$/.test(codigo)) throw new BadRequestException("codigo invalido");
+        const r = await c.query<{ id: string }>(
+          "INSERT INTO funcionarios.definicoes_tarefa(setor_id,codigo,nome,descricao,tipo) VALUES($1,$2,$3,$4,$5) RETURNING id",
+          [
+            identificador(x["setor_id"]),
+            codigo,
+            texto(x["nome"]),
+            x["descricao"] === undefined ? "" : texto(x["descricao"], 2000),
+            opcao(x["tipo"] ?? "DETERMINISTICO", [
+              "DETERMINISTICO",
+              "TAREFA_IA",
+              "AGENTE_IA",
+              "HIBRIDO",
+            ]),
+          ],
+        );
+        const salvo = this.#um(r.rows).id;
+        await auditar(c, "tarefa", salvo, "criar", null, x);
+        return salvo;
+      }
+      const antes = this.#um(
+        (
+          await c.query<{ dado: DefinicaoTarefa }>(
+            "SELECT funcionarios.json_ids(to_jsonb(d)) dado FROM funcionarios.definicoes_tarefa d WHERE id=$1 FOR UPDATE",
+            [identificador(id)],
+          )
+        ).rows,
+      ).dado;
+      await c.query(
+        "UPDATE funcionarios.definicoes_tarefa SET nome=$2,descricao=$3,ativo=$4 WHERE id=$1",
+        [
+          id,
+          x["nome"] === undefined ? antes.nome : texto(x["nome"]),
+          x["descricao"] === undefined ? antes.descricao : texto(x["descricao"], 2000),
+          x["ativo"] === undefined ? antes.ativo : booleano(x["ativo"]),
+        ],
+      );
+      await auditar(c, "tarefa", id, "editar", antes, x);
+      return id;
+    });
+  }
+  async atribuir(funcionarioId: string, entrada: unknown): Promise<string> {
+    const x = exigirObjeto(entrada);
+    campos(x, ["definicao_id", "config", "habilitada", "prioridade"]);
+    const config = exigirObjeto(x["config"] ?? {});
+    const tarefa = await this.tarefa(identificador(x["definicao_id"]));
+    if (tarefa.status_implementacao !== "DISPONIVEL")
+      throw new ConflictException("tarefa planejada ou indisponivel");
+    validarConfiguracao(
+      tarefa.config_schema,
+      config,
+      this.motor.registro.obter(tarefa.handler_key),
+    );
+    return this.#mutacao(async (c) => {
+      const f = this.#um(
+        (
+          await c.query<{ setor_id: string }>(
+            "SELECT setor_id FROM funcionarios.funcionarios WHERE id=$1 FOR UPDATE",
+            [identificador(funcionarioId)],
+          )
+        ).rows,
+      );
+      if (f.setor_id !== tarefa.setor_id)
+        throw new BadRequestException("atribuicao deve ser do mesmo setor");
+      const r = await c.query<{ id: string }>(
+        "INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id,config,habilitada,prioridade) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
+        [
+          funcionarioId,
+          tarefa.id,
+          f.setor_id,
+          config,
+          x["habilitada"] === undefined ? true : booleano(x["habilitada"]),
+          x["prioridade"] === undefined ? 0 : inteiro(x["prioridade"], 0, 100),
+        ],
+      );
+      const id = this.#um(r.rows).id;
+      await auditar(c, "atribuicao", id, "criar", null, x);
+      return id;
+    });
+  }
+  async configurarAtribuicao(id: string, entrada: unknown): Promise<void> {
+    const x = exigirObjeto(entrada);
+    campos(x, ["config", "habilitada", "prioridade", "nome_override"]);
+    await this.#mutacao(async (c) => {
+      const a = await atribuicaoMotor(c, identificador(id));
+      const config = x["config"] === undefined ? a.config : exigirObjeto(x["config"]);
+      if (a.status_implementacao !== "DISPONIVEL")
+        throw new ConflictException("tarefa indisponivel");
+      validarConfiguracao(a.config_schema, config, this.motor.registro.obter(a.handler_key));
+      await c.query(
+        "UPDATE funcionarios.atribuicoes SET config=$2,habilitada=coalesce($3,habilitada),prioridade=coalesce($4,prioridade),nome_override=coalesce($5,nome_override) WHERE id=$1",
+        [
+          id,
+          config,
+          x["habilitada"] === undefined ? null : booleano(x["habilitada"]),
+          x["prioridade"] === undefined ? null : inteiro(x["prioridade"], 0, 100),
+          x["nome_override"] === undefined ? null : texto(x["nome_override"]),
+        ],
+      );
+      await c.query("UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE atribuicao_id=$1", [
+        id,
+      ]);
+      await auditar(
+        c,
+        "atribuicao",
+        id,
+        "configurar",
+        { config: a.config, habilitada: a.habilitada },
+        x,
+      );
+    });
+  }
+  async removerAtribuicao(id: string): Promise<void> {
+    await this.#mutacao(async (c) => {
+      await atribuicaoMotor(c, identificador(id));
+      await c.query("UPDATE funcionarios.atribuicoes SET habilitada=false WHERE id=$1", [id]);
+      await c.query(
+        "UPDATE funcionarios.agendamentos SET habilitado=false,versao=versao+1 WHERE atribuicao_id=$1",
+        [id],
+      );
+      await auditar(c, "atribuicao", id, "remover", null, { habilitada: false });
+    });
+  }
+  async salvarAgenda(atribuicaoId: string, entrada: unknown, id?: string): Promise<string> {
+    return this.#mutacao(async (c) => {
+      const agora = this.#um(
+        (await c.query<{ agora: Date }>("SELECT clock_timestamp() agora")).rows,
+      ).agora;
+      const a = await atribuicaoMotor(c, identificador(atribuicaoId));
+      if (
+        a.status_implementacao !== "DISPONIVEL" ||
+        !a.ativo ||
+        !this.motor.registro.possui(a.handler_key)
+      )
+        throw new ConflictException("tarefa planejada ou indisponivel");
+      const agenda = validarAgenda(entrada, agora);
+      if (!a.gatilhos_suportados.includes(agenda.gatilho))
+        throw new BadRequestException("gatilho nao suportado");
+      const anterior =
+        id === undefined
+          ? null
+          : this.#um(
+              (
+                await c.query<{ dado: Agendamento }>(
+                  "SELECT funcionarios.json_ids(to_jsonb(s)) dado FROM funcionarios.agendamentos s WHERE id=$1 AND atribuicao_id=$2 FOR UPDATE",
+                  [identificador(id), atribuicaoId],
+                )
+              ).rows,
+            ).dado;
+      const args = [
+        atribuicaoId,
+        agenda.gatilho,
+        agenda.intervalo_min,
+        agenda.cron,
+        agenda.tipo_evento,
+        agenda.filtro_evento,
+        agenda.fuso,
+        agenda.inicio_em,
+        agenda.fim_em,
+        proximaOcorrencia(agenda, agora, true),
+        agenda.habilitado,
+        agenda.politica_sobreposicao,
+        agenda.politica_retentativa,
+      ];
+      const r =
+        id === undefined
+          ? await c.query<{ id: string }>(
+              `INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,intervalo_min,cron,tipo_evento,filtro_evento,fuso,inicio_em,fim_em,proxima_em,habilitado,politica_sobreposicao,politica_retentativa) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
+              args,
+            )
+          : await c.query<{ id: string }>(
+              `UPDATE funcionarios.agendamentos SET gatilho=$2,intervalo_min=$3,cron=$4,tipo_evento=$5,filtro_evento=$6,fuso=$7,inicio_em=$8,fim_em=$9,proxima_em=$10,habilitado=$11,politica_sobreposicao=$12,politica_retentativa=$13,versao=versao+1 WHERE id=$14 AND atribuicao_id=$1 RETURNING id`,
+              [...args, id],
+            );
+      const salvo = this.#um(r.rows).id;
+      await auditar(
+        c,
+        "agendamento",
+        salvo,
+        id === undefined ? "criar" : "editar",
+        anterior,
+        agenda,
+      );
+      return salvo;
+    });
+  }
+  async suspenderAgenda(id: string): Promise<void> {
+    await this.#mutacao(async (c) => {
+      const r = await c.query(
+        "UPDATE funcionarios.agendamentos SET habilitado=false,versao=versao+1 WHERE id=$1 RETURNING id",
+        [identificador(id)],
+      );
+      if (r.rowCount === 0) throw new NotFoundException();
+      await auditar(c, "agendamento", id, "suspender", null, { habilitado: false });
+    });
+  }
+  async proximas(id: string, n: unknown): Promise<string[]> {
+    const a = this.#um(
+      await objetos<Agendamento>(this.pool, "SELECT * FROM funcionarios.agendamentos WHERE id=$1", [
+        identificador(id),
+      ]),
+    );
+    const quantidade = n === undefined ? 5 : inteiro(Number(n), 1, 20);
+    return a.habilitado ? proximasOcorrencias(a, new Date(), quantidade) : [];
+  }
+  previsualizar(entrada: unknown): string[] {
+    return proximasOcorrencias(validarAgenda(entrada, new Date()), new Date());
+  }
+  eventos(): readonly string[] {
+    return EVENTOS_FUNCIONARIOS;
+  }
+  async executar(id: string): Promise<{ id: string }> {
+    const execucao = await this.motor.executarAgora(identificador(id));
+    return { id: execucao };
+  }
+  async execucoes(q: ObjetoConfig = {}): Promise<ListaExecucoes> {
+    const limite = q["limite"] === undefined ? 25 : inteiro(Number(q["limite"]), 1, 100);
+    const deslocamento =
+      q["deslocamento"] === undefined ? 0 : inteiro(Number(q["deslocamento"]), 0, 1000000);
+    const filtro = `FROM funcionarios.execucoes e JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id JOIN funcionarios.funcionarios f ON f.id=a.funcionario_id JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id WHERE ($1::bigint IS NULL OR f.id=$1) AND($2::bigint IS NULL OR f.setor_id=$2) AND($3::bigint IS NULL OR d.id=$3) AND($4::text IS NULL OR e.status=$4) AND($5::timestamptz IS NULL OR e.criado_em>=$5) AND($6::timestamptz IS NULL OR e.criado_em<=$6)`;
+    const data = (x: unknown): string | null => {
+      if (x === undefined || x === "") return null;
+      const s = texto(x, 40);
+      if (!Number.isFinite(Date.parse(s))) throw new BadRequestException("data invalida");
+      return new Date(s).toISOString();
+    };
+    const args = [
+      q["funcionario"] === undefined ? null : identificador(q["funcionario"]),
+      q["setor"] === undefined ? null : identificador(q["setor"]),
+      q["tarefa"] === undefined ? null : identificador(q["tarefa"]),
+      q["status"] === undefined || q["status"] === ""
+        ? null
+        : opcao(q["status"], [
+            "AGUARDANDO",
+            "EXECUTANDO",
+            "SUCESSO",
+            "FALHA",
+            "CANCELADA",
+            "IGNORADA",
+          ]),
+      data(q["de"]),
+      data(q["ate"]),
+    ];
+    const itens = await objetos<ExecucaoFuncionario>(
+      this.pool,
+      `SELECT e.*,f.nome funcionario_nome,d.nome tarefa_nome ${filtro} ORDER BY e.criado_em DESC,e.id DESC LIMIT $7 OFFSET $8`,
+      [...args, limite, deslocamento],
+    );
+    const { rows } = await this.pool.query<{ total: number }>(
+      `SELECT count(*)::integer total ${filtro}`,
+      args,
+    );
+    return { itens, total: rows[0]?.total ?? 0, limite, deslocamento };
+  }
+  async execucao(id: string): Promise<ExecucaoFuncionario> {
+    return this.#um(
+      await objetos<ExecucaoFuncionario>(
+        this.pool,
+        "SELECT * FROM funcionarios.execucoes WHERE id=$1",
+        [identificador(id)],
+      ),
+    );
+  }
+  async estado(): Promise<EstadoFuncionarios> {
+    const setores = await this.setores();
+    const funcionarios = await objetos<Funcionario>(
+      this.pool,
+      `${CONSULTA_FUNCIONARIOS} ORDER BY f.nome`,
+    );
+    const historico = await objetos<ExecucaoFuncionario & { funcionario_id: string }>(
+      this.pool,
+      `SELECT DISTINCT ON(a.funcionario_id) e.*,a.funcionario_id FROM funcionarios.execucoes e
+       JOIN funcionarios.atribuicoes a ON a.id=e.atribuicao_id
+       ORDER BY a.funcionario_id,(e.status='EXECUTANDO') DESC,e.criado_em DESC,e.id DESC`,
+    );
+    return {
+      setores: setores.map((s) => ({
+        ...s,
+        funcionarios: funcionarios
+          .filter((f) => f.setor_id === s.id)
+          .map((f) => ({
+            ...f,
+            atividade: historico.find((e) => e.funcionario_id === f.id) ?? null,
+          })),
+      })),
+    };
+  }
+  async #invalidarAgendas(c: PoolClient, funcionarioId: string): Promise<void> {
+    await c.query(
+      "UPDATE funcionarios.agendamentos SET versao=versao+1 WHERE atribuicao_id IN(SELECT id FROM funcionarios.atribuicoes WHERE funcionario_id=$1)",
+      [funcionarioId],
+    );
+  }
+  #um<T>(r: T[]): T {
+    const x = r[0];
+    if (x === undefined) throw new NotFoundException();
+    return x;
+  }
+  async #mutacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
+    this.motor.autorizador.permitir(["funcionarios.administrar"]);
+    try {
+      return await transacao(this.pool, fn);
+    } catch (e) {
+      if (objeto(e) && ["23505", "23503", "23514"].includes(String(e["code"])))
+        throw new ConflictException("operacao conflita com registros existentes");
+      throw e;
+    }
+  }
+}
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 71a5b26..afed1c0 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -8,6 +8,9 @@ import { createApiObservability, observabilityMiddleware } from "./observability
 import { FluxoCaixaModule } from "./fluxo-caixa/fluxo-caixa.module.js";
 import { RepositorioFluxoCaixaPg } from "./fluxo-caixa/repositorio-pg.js";
 import { VendasModule } from "./vendas/vendas.module.js";
+import { RegistroHandlers } from "./funcionarios/handlers.js";
+import { MotorFuncionarios } from "./funcionarios/motor.js";
+import { FuncionariosModule } from "./funcionarios/funcionarios.module.js";
 
 // Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
 // nomes de variaveis e motivos, nunca valores.
@@ -39,12 +42,27 @@ pool?.on("error", () => {
 if (pool === undefined)
   log("api: DATABASE_URL ausente; painel de vendas e fluxo de caixa desativados");
 
+const motor =
+  pool === undefined
+    ? undefined
+    : new MotorFuncionarios(pool, new RegistroHandlers(), undefined, { log });
 const app = await NestFactory.create(
   AppModule.comModulos(
-    pool === undefined
+    pool === undefined || motor === undefined
       ? []
       : [
-          VendasModule.registrar({ config: vendasConfig, pool, log }),
+          VendasModule.registrar({
+            config: vendasConfig,
+            pool,
+            log,
+            motor,
+          }),
+          FuncionariosModule.registrar(
+            motor,
+            vendasConfig.apiKey,
+            true,
+            Math.round(vendasConfig.syncIntervalMs / 60000),
+          ),
           FluxoCaixaModule.registrar({
             apiKey: vendasConfig.apiKey,
             repositorio: new RepositorioFluxoCaixaPg(pool),
diff --git a/apps/api/src/vendas/atualizacao.test.ts b/apps/api/src/vendas/atualizacao.test.ts
index 7a995a1..1e75df1 100644
--- a/apps/api/src/vendas/atualizacao.test.ts
+++ b/apps/api/src/vendas/atualizacao.test.ts
@@ -3,18 +3,16 @@ import { test } from "node:test";
 import { VendasController } from "./vendas.controller.js";
 import type { ServicoPainelVendas } from "./painel.service.js";
 import type { RepositorioVendas } from "./repositorio.js";
-import type { ResultadoSincronizacao, SincronizacaoVendas } from "./sincronizacao.js";
+import type { ResultadoSincronizacao } from "./sincronizacao.js";
 
 test("atualizar painel aguarda a gravacao e devolve o resultado, inclusive lock ocupado", async () => {
   let concluir!: (r: ResultadoSincronizacao) => void;
   const execucao = new Promise<ResultadoSincronizacao>((r) => {
     concluir = r;
   });
-  const controller = new VendasController(
-    {} as ServicoPainelVendas,
-    {} as RepositorioVendas,
-    { executar: () => execucao } as unknown as SincronizacaoVendas,
-  );
+  const controller = new VendasController({} as ServicoPainelVendas, {} as RepositorioVendas, {
+    executar: () => execucao,
+  });
   let terminou = false;
   const resposta = controller.atualizarPainel().then((r) => {
     terminou = true;
@@ -24,10 +22,8 @@ test("atualizar painel aguarda a gravacao e devolve o resultado, inclusive lock
   assert.equal(terminou, false);
   concluir({ resultado: "sucesso", processadas: 2, mensagem: null });
   assert.deepEqual(await resposta, { resultado: "sucesso", processadas: 2, mensagem: null });
-  const ocupada = new VendasController(
-    {} as ServicoPainelVendas,
-    {} as RepositorioVendas,
-    { executar: async () => ({ resultado: "ocupada" }) } as unknown as SincronizacaoVendas,
-  );
+  const ocupada = new VendasController({} as ServicoPainelVendas, {} as RepositorioVendas, {
+    executar: async () => ({ resultado: "ocupada" }),
+  });
   assert.deepEqual(await ocupada.atualizarPainel(), { resultado: "ocupada" });
 });
diff --git a/apps/api/src/vendas/vendas.controller.ts b/apps/api/src/vendas/vendas.controller.ts
index 26604fd..e249110 100644
--- a/apps/api/src/vendas/vendas.controller.ts
+++ b/apps/api/src/vendas/vendas.controller.ts
@@ -51,7 +51,8 @@ export class VendasController {
   constructor(
     @Inject(ServicoPainelVendas) private readonly painel: ServicoPainelVendas,
     @Inject(REPOSITORIO_VENDAS) private readonly repo: RepositorioVendas,
-    @Inject(SINCRONIZACAO_VENDAS) private readonly sincronizacao: SincronizacaoVendas,
+    @Inject(SINCRONIZACAO_VENDAS)
+    private readonly sincronizacao: Pick<SincronizacaoVendas, "executar">,
   ) {}
 
   #filtro(q: Consulta) {
diff --git a/apps/api/src/vendas/vendas.module.ts b/apps/api/src/vendas/vendas.module.ts
index ce67cdf..ed0da02 100644
--- a/apps/api/src/vendas/vendas.module.ts
+++ b/apps/api/src/vendas/vendas.module.ts
@@ -1,47 +1,34 @@
-import {
-  type DynamicModule,
-  Inject,
-  Injectable,
-  Module,
-  type OnApplicationBootstrap,
-  type OnApplicationShutdown,
-} from "@nestjs/common";
+import { type DynamicModule, Module } from "@nestjs/common";
 import type { VendasConfig } from "@nucleos/config";
 import type { Pool } from "pg";
-import { Agendador } from "./agendador.js";
+import type { MotorFuncionarios } from "../funcionarios/motor.js";
 import { CHAVE_SERVICO, ChaveServicoGuard } from "./chave-servico.guard.js";
 import { HotmartClient } from "./hotmart-client.js";
 import { ServicoPainelVendas } from "./painel.service.js";
 import { REPOSITORIO_VENDAS } from "./repositorio.js";
 import { RepositorioVendasPg } from "./repositorio-pg.js";
-import { SINCRONIZACAO_VENDAS, SincronizacaoVendas } from "./sincronizacao.js";
+import {
+  SINCRONIZACAO_VENDAS,
+  SincronizacaoVendas,
+  type ResultadoSincronizacao,
+} from "./sincronizacao.js";
 import { VendasController } from "./vendas.controller.js";
 
-const AGENDADOR_VENDAS = Symbol("AGENDADOR_VENDAS");
-
-/** Liga o agendador na subida da API e o desliga no encerramento. */
-@Injectable()
-class CicloDeVidaAgendador implements OnApplicationBootstrap, OnApplicationShutdown {
-  constructor(@Inject(AGENDADOR_VENDAS) private readonly agendador: Agendador | undefined) {}
-
-  onApplicationBootstrap(): void {
-    this.agendador?.iniciar();
-  }
-
-  onApplicationShutdown(): void {
-    this.agendador?.parar();
-  }
-}
-
 export interface OpcoesModuloVendas {
   config: VendasConfig;
   pool: Pool;
   log?: (mensagem: string) => void;
+  motor?: MotorFuncionarios;
 }
 
 @Module({})
 export class VendasModule {
-  static registrar({ config, pool, log = () => undefined }: OpcoesModuloVendas): DynamicModule {
+  static registrar({
+    config,
+    pool,
+    log = () => undefined,
+    motor,
+  }: OpcoesModuloVendas): DynamicModule {
     const repo = new RepositorioVendasPg(pool);
     const cliente =
       config.hotmart === undefined
@@ -53,10 +40,39 @@ export class VendasModule {
       chavePseudonimo: config.hotmart?.clientSecret.reveal() ?? "sem-hotmart",
       log,
     });
-    const agendador =
-      cliente === undefined
-        ? undefined
-        : new Agendador(() => sincronizacao.executar(), config.syncIntervalMs, log);
+    if (motor !== undefined && cliente !== undefined) {
+      motor.registro.registrar({
+        chave: "financeiro.atualizar_dados",
+        validarConfig: (c) => Object.keys(c).length === 0,
+        executar: async (ctx) => {
+          ctx.signal.throwIfAborted();
+          if (!(await ctx.verificarLease())) throw new Error("lease perdida");
+          return sincronizacao.executar();
+        },
+      });
+    }
+    const disparo =
+      motor === undefined
+        ? sincronizacao
+        : {
+            executar: async () => {
+              if (cliente === undefined) return { resultado: "desabilitada" as const };
+              const { rows } = await pool.query<{
+                id: string;
+              }>(`SELECT a.id FROM funcionarios.atribuicoes a
+          JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
+          WHERE d.codigo='financeiro.atualizar_dados' AND a.habilitada ORDER BY a.id LIMIT 1`);
+              const atribuicao = rows[0];
+              if (atribuicao === undefined) return { resultado: "desabilitada" as const };
+              const id = await motor.executarAgora(atribuicao.id);
+              // Mesmo consumidor/lease do disparo automático; preserva o contrato síncrono do botão.
+              void motor.consumirUma().catch(() => undefined);
+              const execucao = await motor.aguardar(id);
+              return execucao.resumo === null
+                ? { resultado: "falha" as const, processadas: 0, mensagem: "A execucao falhou." }
+                : (execucao.resumo as ResultadoSincronizacao);
+            },
+          };
     if (cliente === undefined) log("vendas: Hotmart sem credenciais; sincronizacao desativada");
 
     return {
@@ -64,11 +80,9 @@ export class VendasModule {
       controllers: [VendasController],
       providers: [
         ChaveServicoGuard,
-        CicloDeVidaAgendador,
         { provide: CHAVE_SERVICO, useValue: config.apiKey },
         { provide: REPOSITORIO_VENDAS, useValue: repo },
-        { provide: SINCRONIZACAO_VENDAS, useValue: sincronizacao },
-        { provide: AGENDADOR_VENDAS, useValue: agendador },
+        { provide: SINCRONIZACAO_VENDAS, useValue: disparo },
         {
           provide: ServicoPainelVendas,
           useValue: new ServicoPainelVendas(
diff --git a/apps/web/app/(app)/funcionarios/[id]/page.tsx b/apps/web/app/(app)/funcionarios/[id]/page.tsx
new file mode 100644
index 0000000..6c39698
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/[id]/page.tsx
@@ -0,0 +1,242 @@
+import Link from "next/link";
+import type {
+  DefinicaoTarefa,
+  DetalheFuncionario,
+  ListaExecucoes,
+  Setor,
+} from "@nucleos/contracts";
+import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
+import {
+  CadastroFuncionario,
+  alterarFuncionario,
+  dataLocal,
+  FormularioAcao,
+  Oculto,
+  Operacao,
+  PaginaFuncionarios,
+  PainelLateral,
+  styles,
+} from "../_components/Comum.tsx";
+import { ConfigurarAgenda } from "../_components/Agendamento.tsx";
+import { ConfigCampos } from "../_components/ConfigCampos.tsx";
+export default async function Detalhe({
+  params,
+  searchParams,
+}: {
+  params: Promise<{ id: string }>;
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const { id } = await params;
+  const q = await searchParams;
+  const r = await funcionariosApi<DetalheFuncionario>(`/${encodeURIComponent(id)}`);
+  if (!r.ok)
+    return (
+      <PaginaFuncionarios titulo="Funcionário">
+        <p role="alert">{r.mensagem}</p>
+      </PaginaFuncionarios>
+    );
+  const { funcionario: f, atribuicoes } = r.dados;
+  const [setores, catalogo, eventos, historico] = await Promise.all([
+    funcionariosApi<Setor[]>("/setores"),
+    funcionariosApi<DefinicaoTarefa[]>(`/catalogo?setor=${f.setor_id}`),
+    funcionariosApi<string[]>("/eventos"),
+    funcionariosApi<ListaExecucoes>(`/execucoes?funcionario=${id}`),
+  ]);
+  const aba = q["aba"] ?? "visao-geral";
+  const abas = [
+    ["visao-geral", "Visão geral"],
+    ["tarefas", "Tarefas"],
+    ["agendamentos", "Agendamentos"],
+    ["execucoes", "Execuções"],
+    ["configuracoes", "Configurações"],
+  ];
+  return (
+    <PaginaFuncionarios titulo={f.nome}>
+      <p>
+        {f.tipo} · {f.status} · {f.descricao}
+      </p>
+      <nav aria-label="Detalhes do funcionário">
+        {abas.map(([codigo, nome]) => (
+          <Link
+            key={codigo}
+            href={`/funcionarios/${id}?aba=${codigo}`}
+            aria-current={aba === codigo ? "page" : undefined}
+          >
+            {nome}
+          </Link>
+        ))}
+      </nav>
+      {aba === "visao-geral" ? (
+        <section className={styles["painel"]}>
+          <h2>Atividade</h2>
+          <p>
+            {f.tarefas} tarefas atribuídas. {f.falhas} falhas nos últimos 7 dias.
+          </p>
+          <p>
+            Última: {dataLocal(f.ultima_em)}. Próxima: {dataLocal(f.proxima_em)}.
+          </p>
+          <Link href={`/funcionarios/${id}?aba=tarefas`}>
+            Ver tarefas e configurar agendamentos
+          </Link>
+        </section>
+      ) : null}
+      {aba === "configuracoes" ? (
+        <section className={styles["aba"]}>
+          <h2>Configurações do funcionário</h2>
+          {setores.ok ? <CadastroFuncionario setores={setores.dados} funcionario={f} /> : null}
+          <div className={styles["acoes"]}>
+            <Operacao
+              op="status"
+              id={id}
+              status={f.status === "ATIVO" ? "PAUSADO" : "ATIVO"}
+              rotulo={f.status === "ATIVO" ? "Pausar" : "Ativar"}
+            />
+            <Operacao op="status" id={id} status="DESATIVADO" rotulo="Desativar" />
+          </div>
+          <p>A pausa impede novos disparos e preserva as execuções já iniciadas.</p>
+        </section>
+      ) : null}
+      {aba === "tarefas" || aba === "agendamentos" ? (
+        <section className={styles["aba"]}>
+          <h2>{aba === "tarefas" ? "Tarefas atribuídas" : "Agendamentos"}</h2>
+          {catalogo.ok ? (
+            <PainelLateral titulo="Atribuir tarefa do setor" rotuloBotao="Atribuir tarefa">
+              <FormularioAcao
+                acao={alterarFuncionario}
+                rotulo="Atribuir"
+                rotuloPendente="Salvando…"
+                className={styles["formulario"]}
+              >
+                <Oculto nome="operacao" valor="atribuir" />
+                <Oculto nome="id" valor={id} />
+                <label>
+                  Tarefa disponível
+                  <select name="definicao_id" required>
+                    {catalogo.dados
+                      .filter(
+                        (t) =>
+                          t.ativo &&
+                          t.status_implementacao === "DISPONIVEL" &&
+                          !atribuicoes.some((a) => a.definicao_id === t.id),
+                      )
+                      .map((t) => (
+                        <option key={t.id} value={t.id}>
+                          {t.nome}
+                        </option>
+                      ))}
+                  </select>
+                </label>
+                <label>
+                  Configuração inicial (JSON)
+                  <textarea name="config" defaultValue="{}" />
+                </label>
+                <p>
+                  Tarefas planejadas só aparecem no catálogo e não podem ser atribuídas para
+                  execução.
+                </p>
+              </FormularioAcao>
+            </PainelLateral>
+          ) : null}
+          {atribuicoes.map((a) => (
+            <article key={a.id} className={styles["painel"]}>
+              <h3>{a.nome_override ?? a.definicao.nome}</h3>
+              <p>
+                {a.definicao.status_implementacao} · {a.habilitada ? "Habilitada" : "Desabilitada"}
+              </p>
+              {a.definicao.status_implementacao === "DISPONIVEL" ? (
+                <>
+                  <div className={styles["acoes"]}>
+                    <Operacao op="executar" atribuicao={a.id} rotulo="Executar agora" />
+                    <Link
+                      href={`/funcionarios/execucoes?funcionario=${id}&tarefa=${a.definicao_id}`}
+                    >
+                      Histórico
+                    </Link>
+                    <PainelLateral
+                      titulo={`Configurar ${a.definicao.nome}`}
+                      rotuloBotao="Configurar tarefa"
+                    >
+                      <FormularioAcao
+                        acao={alterarFuncionario}
+                        rotulo="Salvar configuração"
+                        rotuloPendente="Salvando…"
+                        className={styles["formulario"]}
+                      >
+                        <Oculto nome="operacao" valor="configurar" />
+                        <Oculto nome="atribuicao_id" valor={a.id} />
+                        <ConfigCampos schema={a.definicao.config_schema} config={a.config} />
+                        <label>
+                          Habilitada
+                          <select name="habilitada" defaultValue={String(a.habilitada)}>
+                            <option value="true">Sim</option>
+                            <option value="false">Não</option>
+                          </select>
+                        </label>
+                        <label>
+                          Prioridade
+                          <input
+                            type="number"
+                            min="0"
+                            max="100"
+                            name="prioridade"
+                            defaultValue={a.prioridade}
+                          />
+                        </label>
+                      </FormularioAcao>
+                    </PainelLateral>
+                    <Operacao op="remover" atribuicao={a.id} rotulo="Remover atribuição" />
+                  </div>
+                  {a.agendamentos.map((s) => (
+                    <div key={s.id}>
+                      <p>
+                        {s.gatilho}
+                        {s.intervalo_min !== null ? ` · ${s.intervalo_min} min` : ""} ·{" "}
+                        {s.habilitado ? "Habilitado" : "Suspenso"} · Próxima:{" "}
+                        {dataLocal(s.proxima_em)}
+                      </p>
+                      <ConfigurarAgenda
+                        atribuicaoId={a.id}
+                        agenda={s}
+                        eventos={eventos.ok ? eventos.dados : []}
+                      />
+                      <FormularioAcao
+                        acao={alterarFuncionario}
+                        rotulo="Suspender"
+                        rotuloPendente="Suspendendo…"
+                      >
+                        <Oculto nome="operacao" valor="suspender" />
+                        <Oculto nome="agendamento_id" valor={s.id} />
+                      </FormularioAcao>
+                    </div>
+                  ))}
+                  <ConfigurarAgenda atribuicaoId={a.id} eventos={eventos.ok ? eventos.dados : []} />
+                </>
+              ) : (
+                <p>Executor ainda não disponível. Não há ação de agendamento ou execução.</p>
+              )}
+            </article>
+          ))}
+          {atribuicoes.length === 0 ? <p>Nenhuma tarefa atribuída.</p> : null}
+        </section>
+      ) : null}
+      {aba === "execucoes" ? (
+        <section className={styles["painel"]}>
+          <h2>Execuções recentes</h2>
+          {historico.ok ? (
+            <ul>
+              {historico.dados.itens.map((e) => (
+                <li key={e.id}>
+                  <Link href={`/funcionarios/execucoes/${e.id}`}>
+                    {e.tarefa_nome} · {e.status} · {dataLocal(e.criado_em)}
+                  </Link>
+                </li>
+              ))}
+            </ul>
+          ) : (
+            <p role="alert">{historico.mensagem}</p>
+          )}
+        </section>
+      ) : null}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/_components/Agendamento.tsx b/apps/web/app/(app)/funcionarios/_components/Agendamento.tsx
new file mode 100644
index 0000000..0cc2597
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/_components/Agendamento.tsx
@@ -0,0 +1,164 @@
+import type { Agendamento as TipoAgendamento } from "@nucleos/contracts";
+import {
+  alterarFuncionario,
+  FormularioAcao,
+  Oculto,
+  PainelLateral,
+  styles,
+  dataLocal,
+} from "./Comum.tsx";
+function CamposAgenda({
+  agenda,
+  eventos,
+}: {
+  agenda?: TipoAgendamento;
+  eventos: readonly string[];
+}) {
+  return (
+    <>
+      <label>
+        Gatilho
+        <select name="gatilho" defaultValue={agenda?.gatilho ?? "INTERVALO"}>
+          <option>MANUAL</option>
+          <option>UNICO</option>
+          <option>INTERVALO</option>
+          <option>CRON</option>
+          <option>EVENTO</option>
+        </select>
+      </label>
+      <label>
+        Intervalo
+        <input
+          name="intervalo"
+          type="number"
+          min="1"
+          max="525600"
+          defaultValue={agenda?.intervalo_min ?? 30}
+        />
+      </label>
+      <label>
+        Unidade
+        <select name="unidade" defaultValue="1">
+          <option value="1">Minutos</option>
+          <option value="60">Horas</option>
+          <option value="1440">Dias</option>
+        </select>
+      </label>
+      <label>
+        Cron (5 campos)
+        <input name="cron" defaultValue={agenda?.cron ?? "0 3 * * *"} placeholder="0 3 * * *" />
+      </label>
+      <label>
+        Evento
+        <select name="tipo_evento" defaultValue={agenda?.tipo_evento ?? eventos[0]}>
+          {eventos.map((e) => (
+            <option key={e}>{e}</option>
+          ))}
+        </select>
+      </label>
+      <label>
+        Filtro do evento (JSON)
+        <textarea name="filtro_evento" defaultValue={JSON.stringify(agenda?.filtro_evento ?? {})} />
+      </label>
+      <label>
+        Fuso horário
+        <input name="fuso" required defaultValue={agenda?.fuso ?? "America/Sao_Paulo"} />
+      </label>
+      <label>
+        Início (data ISO com fuso ou Z)
+        <input
+          name="inicio_em"
+          placeholder="2026-11-02T09:00:00-03:00"
+          defaultValue={agenda?.inicio_em ?? ""}
+        />
+      </label>
+      <label>
+        Fim opcional (data ISO com fuso ou Z)
+        <input name="fim_em" defaultValue={agenda?.fim_em ?? ""} />
+      </label>
+      <label>
+        Habilitado
+        <select name="habilitado" defaultValue={String(agenda?.habilitado ?? true)}>
+          <option value="true">Sim</option>
+          <option value="false">Não</option>
+        </select>
+      </label>
+      <label>
+        Sobreposição
+        <select
+          name="politica_sobreposicao"
+          defaultValue={agenda?.politica_sobreposicao ?? "PULAR"}
+        >
+          <option>PULAR</option>
+          <option>ENFILEIRAR</option>
+          <option>CANCELAR_ANTERIOR</option>
+        </select>
+      </label>
+      <label>
+        Máximo de tentativas
+        <input
+          name="maxTentativas"
+          type="number"
+          min="1"
+          max="10"
+          defaultValue={agenda?.politica_retentativa.maxTentativas ?? 3}
+        />
+      </label>
+      <label>
+        Backoff inicial (segundos)
+        <input
+          name="backoffSegundos"
+          type="number"
+          min="1"
+          max="3600"
+          defaultValue={agenda?.politica_retentativa.backoffSegundos ?? 30}
+        />
+      </label>
+    </>
+  );
+}
+export function ConfigurarAgenda({
+  atribuicaoId,
+  agenda,
+  eventos,
+}: {
+  atribuicaoId: string;
+  agenda?: TipoAgendamento;
+  eventos: readonly string[];
+}) {
+  return (
+    <PainelLateral
+      titulo="Configurar agendamento"
+      rotuloBotao={agenda ? "Configurar agendamento" : "Criar agendamento"}
+      fecharAoConcluir={false}
+    >
+      <FormularioAcao
+        acao={alterarFuncionario}
+        rotulo="Salvar agendamento"
+        rotuloPendente="Salvando…"
+        className={styles["formulario"]}
+      >
+        <Oculto nome="operacao" valor="agenda" />
+        <Oculto nome="atribuicao_id" valor={atribuicaoId} />
+        {agenda ? <Oculto nome="agendamento_id" valor={agenda.id} /> : null}
+        <CamposAgenda {...(agenda === undefined ? {} : { agenda })} eventos={eventos} />
+      </FormularioAcao>
+      <details>
+        <summary>Validar cron e ver as próximas 5 ocorrências</summary>
+        <FormularioAcao
+          acao={alterarFuncionario}
+          rotulo="Previsualizar"
+          rotuloPendente="Calculando…"
+          className={styles["formulario"]}
+        >
+          <Oculto nome="operacao" valor="previsualizar" />
+          <CamposAgenda {...(agenda === undefined ? {} : { agenda })} eventos={eventos} />
+        </FormularioAcao>
+      </details>
+      <p>
+        Próxima execução salva: {dataLocal(agenda?.proxima_em ?? null)}. Horários exibidos em São
+        Paulo.
+      </p>
+    </PainelLateral>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/_components/Comum.tsx b/apps/web/app/(app)/funcionarios/_components/Comum.tsx
new file mode 100644
index 0000000..7a3f1d9
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/_components/Comum.tsx
@@ -0,0 +1,152 @@
+import Link from "next/link";
+import type { ReactNode } from "react";
+import type { Funcionario, Setor } from "@nucleos/contracts";
+import { FormularioAcao } from "../../setores/financeiro/fluxo-de-caixa/_components/FormularioAcao.tsx";
+import { PainelLateral } from "../../setores/financeiro/fluxo-de-caixa/_components/PainelLateral.tsx";
+import { alterarFuncionario } from "../actions.ts";
+import styles from "../funcionarios.module.css";
+export { styles, FormularioAcao, PainelLateral, alterarFuncionario };
+export function PaginaFuncionarios({ titulo, children }: { titulo: string; children: ReactNode }) {
+  return (
+    <main id="conteudo" className={styles["pagina"]}>
+      <header>
+        <h1>{titulo}</h1>
+        <nav aria-label="Funcionários">
+          <Link href="/funcionarios">Visão geral</Link> ·{" "}
+          <Link href="/funcionarios/catalogo">Catálogo de tarefas</Link> ·{" "}
+          <Link href="/funcionarios/execucoes">Histórico de execuções</Link>
+        </nav>
+      </header>
+      {children}
+    </main>
+  );
+}
+export function Oculto({ nome, valor }: { nome: string; valor: string }) {
+  return <input type="hidden" name={nome} value={valor} />;
+}
+export function Operacao({
+  op,
+  id,
+  atribuicao,
+  status,
+  rotulo,
+}: {
+  op: string;
+  id?: string;
+  atribuicao?: string;
+  status?: string;
+  rotulo: string;
+}) {
+  return (
+    <FormularioAcao acao={alterarFuncionario} rotulo={rotulo} rotuloPendente="Salvando…">
+      <Oculto nome="operacao" valor={op} />
+      {id ? <Oculto nome="id" valor={id} /> : null}
+      {atribuicao ? <Oculto nome="atribuicao_id" valor={atribuicao} /> : null}
+      {status ? <Oculto nome="status" valor={status} /> : null}
+    </FormularioAcao>
+  );
+}
+export function CadastroFuncionario({
+  setores,
+  funcionario,
+}: {
+  setores: Setor[];
+  funcionario?: Funcionario;
+}) {
+  return (
+    <PainelLateral
+      titulo={funcionario ? "Editar funcionário" : "Novo funcionário"}
+      rotuloBotao={funcionario ? "Editar" : "Novo funcionário"}
+    >
+      <FormularioAcao
+        acao={alterarFuncionario}
+        rotulo="Salvar funcionário"
+        rotuloPendente="Salvando…"
+        className={styles["formulario"]}
+      >
+        <Oculto nome="operacao" valor={funcionario ? "editar" : "criar"} />
+        {funcionario ? <Oculto nome="id" valor={funcionario.id} /> : null}
+        <label>
+          Nome
+          <input name="nome" maxLength={160} required defaultValue={funcionario?.nome} />
+        </label>
+        <label>
+          Setor
+          <select name="setor_id" defaultValue={funcionario?.setor_id}>
+            {setores.map((s) => (
+              <option key={s.id} value={s.id}>
+                {s.nome}
+              </option>
+            ))}
+          </select>
+        </label>
+        <label>
+          Descrição e função
+          <textarea
+            name="descricao"
+            required
+            maxLength={2000}
+            defaultValue={funcionario?.descricao}
+          />
+        </label>
+        <label>
+          Tipo
+          <select name="tipo" defaultValue={funcionario?.tipo ?? "DETERMINISTICO"}>
+            <option>DETERMINISTICO</option>
+            <option>AGENTE_IA</option>
+            <option>HIBRIDO</option>
+          </select>
+        </label>
+        <label>
+          Referência do perfil de IA
+          <input name="perfil_ia" defaultValue={funcionario?.perfil_ia ?? ""} />
+        </label>
+        <label>
+          Identificador do avatar
+          <input name="avatar" pattern="[a-z0-9_-]+" defaultValue={funcionario?.avatar ?? ""} />
+        </label>
+        <p>
+          Novos funcionários começam em rascunho e só podem ser ativados com um executor disponível.
+        </p>
+      </FormularioAcao>
+    </PainelLateral>
+  );
+}
+export const dataLocal = (x: string | null) =>
+  x === null ? "—" : new Date(x).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
+export function ListaFuncionarios({ itens }: { itens: Funcionario[] }) {
+  return (
+    <div className={styles["tabela"]}>
+      <table>
+        <caption>Funcionários cadastrados</caption>
+        <thead>
+          <tr>
+            <th>Nome</th>
+            <th>Tipo</th>
+            <th>Status</th>
+            <th>Tarefas</th>
+            <th>Última execução</th>
+            <th>Próxima execução</th>
+            <th>Falhas (7 dias)</th>
+          </tr>
+        </thead>
+        <tbody>
+          {itens.map((f) => (
+            <tr key={f.id}>
+              <td>
+                <Link href={`/funcionarios/${f.id}`}>{f.nome}</Link>
+              </td>
+              <td>{f.tipo}</td>
+              <td>{f.status}</td>
+              <td>{f.tarefas}</td>
+              <td>{dataLocal(f.ultima_em)}</td>
+              <td>{dataLocal(f.proxima_em)}</td>
+              <td>{f.falhas}</td>
+            </tr>
+          ))}
+        </tbody>
+      </table>
+      {itens.length === 0 ? <p>Nenhum funcionário encontrado.</p> : null}
+    </div>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/_components/ConfigCampos.tsx b/apps/web/app/(app)/funcionarios/_components/ConfigCampos.tsx
new file mode 100644
index 0000000..e9c6dbb
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/_components/ConfigCampos.tsx
@@ -0,0 +1,83 @@
+import type { ObjetoConfig } from "@nucleos/contracts";
+const objeto = (x: unknown): x is Record<string, unknown> =>
+  typeof x === "object" && x !== null && !Array.isArray(x);
+export function ConfigCampos({ schema, config }: { schema: ObjetoConfig; config: ObjetoConfig }) {
+  const props = schema["properties"];
+  if (!objeto(props) || Object.keys(props).length === 0)
+    return (
+      <label>
+        Configuração (JSON)
+        <textarea name="config" defaultValue={JSON.stringify(config, null, 2)} />
+      </label>
+    );
+  return (
+    <>
+      {Object.entries(props).map(([nome, s]) => {
+        if (!objeto(s)) return null;
+        const tipo = s["type"];
+        const valor = config[nome] ?? s["default"];
+        const titulo = typeof s["title"] === "string" ? s["title"] : nome;
+        if (Array.isArray(s["enum"]))
+          return (
+            <label key={nome}>
+              {titulo}
+              <select
+                name={`cfg:${nome}:${tipo === "number" || tipo === "integer" ? tipo : "string"}`}
+                defaultValue={
+                  typeof valor === "string" || typeof valor === "number" ? String(valor) : ""
+                }
+              >
+                {s["enum"].map((v: unknown) => (
+                  <option key={String(v)} value={String(v)}>
+                    {String(v)}
+                  </option>
+                ))}
+              </select>
+            </label>
+          );
+        if (tipo === "boolean")
+          return (
+            <label key={nome}>
+              {titulo}
+              <select name={`cfg:${nome}:boolean`} defaultValue={valor === true ? "true" : "false"}>
+                <option value="true">Sim</option>
+                <option value="false">Não</option>
+              </select>
+            </label>
+          );
+        if (tipo === "number" || tipo === "integer")
+          return (
+            <label key={nome}>
+              {titulo}
+              <input
+                name={`cfg:${nome}:${tipo}`}
+                type="number"
+                step={tipo === "integer" ? "1" : "any"}
+                defaultValue={typeof valor === "number" ? valor : undefined}
+                required
+              />
+            </label>
+          );
+        if (tipo === "string")
+          return (
+            <label key={nome}>
+              {titulo}
+              <input
+                name={`cfg:${nome}:string`}
+                defaultValue={typeof valor === "string" ? valor : ""}
+              />
+            </label>
+          );
+        return (
+          <label key={nome}>
+            {titulo} (JSON)
+            <textarea
+              name={`cfg:${nome}:json`}
+              defaultValue={JSON.stringify(valor ?? null, null, 2)}
+            />
+          </label>
+        );
+      })}
+    </>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/actions.ts b/apps/web/app/(app)/funcionarios/actions.ts
new file mode 100644
index 0000000..cd5f195
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/actions.ts
@@ -0,0 +1,138 @@
+"use server";
+import { revalidatePath } from "next/cache";
+import { funcionariosApi } from "../../../lib/funcionarios-api.ts";
+import type { EstadoAcao } from "../../../lib/fluxo-caixa-formato.ts";
+const id = (f: FormData, nome: string): string => {
+  const v = f.get(nome);
+  if (typeof v !== "string" || !/^\d{1,19}$/.test(v)) throw new Error("id invalido");
+  return v;
+};
+const texto = (f: FormData, nome: string, padrao = ""): string => {
+  const v = f.get(nome);
+  return typeof v === "string" ? v : padrao;
+};
+const json = (s: string): unknown => JSON.parse(s) as unknown;
+export async function alterarFuncionario(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
+  try {
+    const op = texto(f, "operacao");
+    let caminho = "";
+    let method: "POST" | "PATCH" | "DELETE" = "POST";
+    let corpo: unknown;
+    if (op === "criar" || op === "editar") {
+      if (op === "editar") {
+        caminho = `/${id(f, "id")}`;
+        method = "PATCH";
+      }
+      corpo = {
+        nome: texto(f, "nome"),
+        setor_id: id(f, "setor_id"),
+        descricao: texto(f, "descricao", "Função administrativa"),
+        tipo: texto(f, "tipo"),
+        perfil_ia: texto(f, "perfil_ia") || null,
+        avatar: texto(f, "avatar") || null,
+      };
+    } else if (op === "status") {
+      caminho = `/${id(f, "id")}/status`;
+      corpo = { status: texto(f, "status") };
+    } else if (op === "atribuir") {
+      caminho = `/${id(f, "id")}/atribuicoes`;
+      corpo = { definicao_id: id(f, "definicao_id"), config: json(texto(f, "config", "{}")) };
+    } else if (op === "executar") {
+      caminho = `/atribuicoes/${id(f, "atribuicao_id")}/executar`;
+    } else if (op === "remover") {
+      caminho = `/atribuicoes/${id(f, "atribuicao_id")}`;
+      method = "DELETE";
+    } else if (op === "configurar") {
+      caminho = `/atribuicoes/${id(f, "atribuicao_id")}`;
+      method = "PATCH";
+      const config: Record<string, unknown> = {};
+      for (const [nome, valor] of f.entries()) {
+        if (!nome.startsWith("cfg:") || typeof valor !== "string") continue;
+        const [, chave, tipo] = nome.split(":");
+        if (chave === undefined || chave === "__proto__" || chave === "constructor")
+          throw new Error("campo invalido");
+        config[chave] =
+          tipo === "number" || tipo === "integer"
+            ? Number(valor)
+            : tipo === "boolean"
+              ? valor === "true"
+              : tipo === "json"
+                ? json(valor)
+                : valor;
+      }
+      corpo = {
+        config: f.has("config") ? json(texto(f, "config", "{}")) : config,
+        habilitada: texto(f, "habilitada") === "true",
+        prioridade: Number(texto(f, "prioridade", "0")),
+      };
+    } else if (op === "agenda" || op === "previsualizar") {
+      const agendaId = texto(f, "agendamento_id");
+      caminho =
+        op === "previsualizar"
+          ? "/cron/previsualizar"
+          : agendaId
+            ? `/atribuicoes/${id(f, "atribuicao_id")}/agendamentos/${id(f, "agendamento_id")}`
+            : `/atribuicoes/${id(f, "atribuicao_id")}/agendamentos`;
+      method = agendaId && op !== "previsualizar" ? "PATCH" : "POST";
+      corpo = {
+        gatilho: texto(f, "gatilho"),
+        intervalo_min: Number(texto(f, "intervalo", "30")) * Number(texto(f, "unidade", "1")),
+        cron: texto(f, "cron"),
+        tipo_evento: texto(f, "tipo_evento"),
+        filtro_evento: json(texto(f, "filtro_evento", "{}")),
+        fuso: texto(f, "fuso", "America/Sao_Paulo"),
+        ...(texto(f, "inicio_em")
+          ? { inicio_em: new Date(texto(f, "inicio_em")).toISOString() }
+          : {}),
+        fim_em: texto(f, "fim_em") ? new Date(texto(f, "fim_em")).toISOString() : null,
+        habilitado: texto(f, "habilitado", "true") === "true",
+        politica_sobreposicao: texto(f, "politica_sobreposicao", "PULAR"),
+        politica_retentativa: {
+          maxTentativas: Number(texto(f, "maxTentativas", "3")),
+          backoffSegundos: Number(texto(f, "backoffSegundos", "30")),
+        },
+      };
+      if (op === "previsualizar") {
+        const r = await funcionariosApi<string[]>(caminho, method, corpo);
+        return r.ok
+          ? {
+              erro: false,
+              mensagem: r.dados.length
+                ? `Próximas execuções: ${r.dados.map((d) => new Date(d).toLocaleString("pt-BR", { timeZone: texto(f, "fuso", "America/Sao_Paulo") })).join("; ")}`
+                : "Este gatilho não possui próximas ocorrências.",
+            }
+          : { erro: true, mensagem: r.mensagem };
+      }
+    } else if (op === "suspender") {
+      caminho = `/agendamentos/${id(f, "agendamento_id")}/suspender`;
+    } else if (op === "tarefa") {
+      caminho = "/catalogo";
+      corpo = {
+        setor_id: id(f, "setor_id"),
+        codigo: texto(f, "codigo"),
+        nome: texto(f, "nome"),
+        descricao: texto(f, "descricao", "Tarefa planejada"),
+        tipo: texto(f, "tipo", "DETERMINISTICO"),
+      };
+    } else if (op === "editar-tarefa") {
+      caminho = `/catalogo/${id(f, "id")}`;
+      method = "PATCH";
+      corpo = {
+        nome: texto(f, "nome"),
+        descricao: texto(f, "descricao"),
+        ativo: texto(f, "ativo") === "true",
+      };
+    } else return { erro: true, mensagem: "Operação inválida." };
+    const r = await funcionariosApi<unknown>(caminho, method, corpo);
+    if (!r.ok) return { erro: true, mensagem: r.mensagem };
+    revalidatePath("/funcionarios", "layout");
+    revalidatePath("/funcionarios");
+    return {
+      erro: false,
+      mensagem:
+        op === "executar" ? "Execução enfileirada. Consulte o histórico." : "Alteração salva.",
+    };
+  } catch {
+    return { erro: true, mensagem: "Confira os campos, datas e o JSON da configuração." };
+  }
+}
diff --git a/apps/web/app/(app)/funcionarios/catalogo/page.tsx b/apps/web/app/(app)/funcionarios/catalogo/page.tsx
new file mode 100644
index 0000000..db385f8
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/catalogo/page.tsx
@@ -0,0 +1,169 @@
+import type { DefinicaoTarefa, Setor } from "@nucleos/contracts";
+import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
+import {
+  alterarFuncionario,
+  FormularioAcao,
+  Oculto,
+  PaginaFuncionarios,
+  PainelLateral,
+  styles,
+} from "../_components/Comum.tsx";
+export default async function Catalogo({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const q = await searchParams;
+  const filtros = new URLSearchParams();
+  for (const nome of ["setor", "status"]) if (q[nome]) filtros.set(nome, q[nome]);
+  const [r, s] = await Promise.all([
+    funcionariosApi<DefinicaoTarefa[]>(`/catalogo?${filtros}`),
+    funcionariosApi<Setor[]>("/setores"),
+  ]);
+  return (
+    <PaginaFuncionarios titulo="Catálogo de tarefas">
+      <p>
+        Uma tarefa cadastrada só pode executar quando houver um handler implementado, atribuição
+        habilitada e funcionário ativo.
+      </p>
+      {s.ok ? (
+        <>
+          <form className={styles["filtros"]}>
+            <label>
+              Setor
+              <select name="setor" defaultValue={q["setor"] ?? ""}>
+                <option value="">Todos</option>
+                {s.dados.map((v) => (
+                  <option key={v.id} value={v.id}>
+                    {v.nome}
+                  </option>
+                ))}
+              </select>
+            </label>
+            <label>
+              Implementação
+              <select name="status" defaultValue={q["status"] ?? ""}>
+                <option value="">Todas</option>
+                <option>DISPONIVEL</option>
+                <option>PLANEJADA</option>
+                <option>INDISPONIVEL</option>
+              </select>
+            </label>
+            <button className="btn btn--secondary">Filtrar</button>
+          </form>
+          <PainelLateral titulo="Cadastrar tarefa planejada" rotuloBotao="Nova tarefa planejada">
+            <FormularioAcao
+              acao={alterarFuncionario}
+              rotulo="Cadastrar rascunho"
+              rotuloPendente="Salvando…"
+              className={styles["formulario"]}
+            >
+              <Oculto nome="operacao" valor="tarefa" />
+              <label>
+                Nome
+                <input name="nome" required />
+              </label>
+              <label>
+                Código
+                <input
+                  name="codigo"
+                  pattern="[a-z]+\.[a-z_]+"
+                  required
+                  placeholder="financeiro.nova_rotina"
+                />
+              </label>
+              <label>
+                Setor
+                <select name="setor_id">
+                  {s.dados.map((v) => (
+                    <option key={v.id} value={v.id}>
+                      {v.nome}
+                    </option>
+                  ))}
+                </select>
+              </label>
+              <label>
+                Tipo
+                <select name="tipo">
+                  <option>DETERMINISTICO</option>
+                  <option>TAREFA_IA</option>
+                  <option>AGENTE_IA</option>
+                  <option>HIBRIDO</option>
+                </select>
+              </label>
+              <label>
+                Descrição
+                <textarea name="descricao" required />
+              </label>
+              <p>O cadastro não aceita código nem handler. A tarefa permanece planejada.</p>
+            </FormularioAcao>
+          </PainelLateral>
+        </>
+      ) : null}
+      {r.ok ? (
+        <div className={styles["tabela"]}>
+          <table>
+            <caption>Tarefas registradas</caption>
+            <thead>
+              <tr>
+                <th>Tarefa</th>
+                <th>Implementação</th>
+                <th>Atribuições</th>
+                <th>Habilitadas</th>
+                <th>Editar metadados</th>
+              </tr>
+            </thead>
+            <tbody>
+              {r.dados.map((t) => (
+                <tr key={t.id}>
+                  <td>
+                    <strong>{t.nome}</strong>
+                    <br />
+                    <code>{t.codigo}</code>
+                    <p>{t.descricao}</p>
+                  </td>
+                  <td>
+                    {t.status_implementacao}
+                    {!t.ativo ? " · inativa" : ""}
+                  </td>
+                  <td>{t.atribuicoes ?? 0}</td>
+                  <td>{t.habilitadas ?? 0}</td>
+                  <td>
+                    <PainelLateral titulo={`Editar ${t.nome}`} rotuloBotao="Editar">
+                      <FormularioAcao
+                        acao={alterarFuncionario}
+                        rotulo="Salvar"
+                        rotuloPendente="Salvando…"
+                        className={styles["formulario"]}
+                      >
+                        <Oculto nome="operacao" valor="editar-tarefa" />
+                        <Oculto nome="id" valor={t.id} />
+                        <label>
+                          Nome
+                          <input name="nome" defaultValue={t.nome} required />
+                        </label>
+                        <label>
+                          Descrição
+                          <textarea name="descricao" defaultValue={t.descricao} required />
+                        </label>
+                        <label>
+                          Ativa
+                          <select name="ativo" defaultValue={String(t.ativo)}>
+                            <option value="true">Sim</option>
+                            <option value="false">Não</option>
+                          </select>
+                        </label>
+                      </FormularioAcao>
+                    </PainelLateral>
+                  </td>
+                </tr>
+              ))}
+            </tbody>
+          </table>
+        </div>
+      ) : (
+        <p role="alert">{r.mensagem}</p>
+      )}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/execucoes/[id]/page.tsx b/apps/web/app/(app)/funcionarios/execucoes/[id]/page.tsx
new file mode 100644
index 0000000..5d2e753
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/execucoes/[id]/page.tsx
@@ -0,0 +1,39 @@
+import type { ExecucaoFuncionario } from "@nucleos/contracts";
+import { funcionariosApi } from "../../../../../lib/funcionarios-api.ts";
+import { dataLocal, PaginaFuncionarios, styles } from "../../_components/Comum.tsx";
+export default async function Execucao({ params }: { params: Promise<{ id: string }> }) {
+  const { id } = await params;
+  const r = await funcionariosApi<ExecucaoFuncionario>(`/execucoes/${encodeURIComponent(id)}`);
+  return (
+    <PaginaFuncionarios titulo={`Execução ${id}`}>
+      {r.ok ? (
+        <section className={styles["painel"]}>
+          <dl>
+            <dt>Status</dt>
+            <dd>{r.dados.status}</dd>
+            <dt>Origem</dt>
+            <dd>{r.dados.origem}</dd>
+            <dt>Programada</dt>
+            <dd>{dataLocal(r.dados.programada_em)}</dd>
+            <dt>Iniciada</dt>
+            <dd>{dataLocal(r.dados.iniciada_em)}</dd>
+            <dt>Finalizada</dt>
+            <dd>{dataLocal(r.dados.finalizada_em)}</dd>
+            <dt>Tentativa</dt>
+            <dd>{r.dados.tentativa}</dd>
+            <dt>Correlação</dt>
+            <dd>{r.dados.correlacao}</dd>
+            <dt>Erro</dt>
+            <dd>{r.dados.erro_codigo ?? "—"}</dd>
+          </dl>
+          <h2>Configuração usada</h2>
+          <pre>{JSON.stringify(r.dados.config_snapshot, null, 2)}</pre>
+          <h2>Resumo</h2>
+          <pre>{JSON.stringify(r.dados.resumo, null, 2)}</pre>
+        </section>
+      ) : (
+        <p role="alert">{r.mensagem}</p>
+      )}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/execucoes/page.tsx b/apps/web/app/(app)/funcionarios/execucoes/page.tsx
new file mode 100644
index 0000000..07a8f0a
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/execucoes/page.tsx
@@ -0,0 +1,141 @@
+import Link from "next/link";
+import type { ListaExecucoes, Setor, Funcionario, DefinicaoTarefa } from "@nucleos/contracts";
+import { funcionariosApi } from "../../../../lib/funcionarios-api.ts";
+import { dataLocal, PaginaFuncionarios, styles } from "../_components/Comum.tsx";
+export default async function Execucoes({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const q = await searchParams;
+  const filtros = new URLSearchParams();
+  for (const nome of ["funcionario", "setor", "tarefa", "status", "de", "ate", "deslocamento"])
+    if (q[nome]) filtros.set(nome, q[nome]);
+  const [r, s, f, t] = await Promise.all([
+    funcionariosApi<ListaExecucoes>(`/execucoes?${filtros}`),
+    funcionariosApi<Setor[]>("/setores"),
+    funcionariosApi<Funcionario[]>(),
+    funcionariosApi<DefinicaoTarefa[]>("/catalogo"),
+  ]);
+  return (
+    <PaginaFuncionarios titulo="Histórico de execuções">
+      <form className={styles["filtros"]}>
+        <label>
+          Setor
+          <select name="setor" defaultValue={q["setor"] ?? ""}>
+            <option value="">Todos</option>
+            {s.ok
+              ? s.dados.map((v) => (
+                  <option key={v.id} value={v.id}>
+                    {v.nome}
+                  </option>
+                ))
+              : null}
+          </select>
+        </label>
+        <label>
+          Funcionário
+          <select name="funcionario" defaultValue={q["funcionario"] ?? ""}>
+            <option value="">Todos</option>
+            {f.ok
+              ? f.dados.map((v) => (
+                  <option key={v.id} value={v.id}>
+                    {v.nome}
+                  </option>
+                ))
+              : null}
+          </select>
+        </label>
+        <label>
+          Tarefa
+          <select name="tarefa" defaultValue={q["tarefa"] ?? ""}>
+            <option value="">Todas</option>
+            {t.ok
+              ? t.dados.map((v) => (
+                  <option key={v.id} value={v.id}>
+                    {v.nome}
+                  </option>
+                ))
+              : null}
+          </select>
+        </label>
+        <label>
+          Status
+          <select name="status" defaultValue={q["status"] ?? ""}>
+            <option value="">Todos</option>
+            {["AGUARDANDO", "EXECUTANDO", "SUCESSO", "FALHA", "CANCELADA", "IGNORADA"].map((v) => (
+              <option key={v}>{v}</option>
+            ))}
+          </select>
+        </label>
+        <label>
+          De (ISO)
+          <input name="de" defaultValue={q["de"]} placeholder="2026-11-01T00:00:00-03:00" />
+        </label>
+        <label>
+          Até (ISO)
+          <input name="ate" defaultValue={q["ate"]} />
+        </label>
+        <button className="btn btn--secondary">Filtrar</button>
+      </form>
+      {r.ok ? (
+        <>
+          <p>{r.dados.total} execuções encontradas.</p>
+          <div className={styles["tabela"]}>
+            <table>
+              <caption>Execuções e tentativas</caption>
+              <thead>
+                <tr>
+                  <th>Funcionário / tarefa</th>
+                  <th>Origem</th>
+                  <th>Status</th>
+                  <th>Tentativa</th>
+                  <th>Início</th>
+                  <th>Fim</th>
+                  <th>Detalhe</th>
+                </tr>
+              </thead>
+              <tbody>
+                {r.dados.itens.map((e) => (
+                  <tr key={e.id}>
+                    <td>
+                      {e.funcionario_nome}
+                      <br />
+                      {e.tarefa_nome}
+                    </td>
+                    <td>{e.origem}</td>
+                    <td>{e.status}</td>
+                    <td>{e.tentativa}</td>
+                    <td>{dataLocal(e.iniciada_em)}</td>
+                    <td>{dataLocal(e.finalizada_em)}</td>
+                    <td>
+                      <Link href={`/funcionarios/execucoes/${e.id}`}>Abrir execução {e.id}</Link>
+                    </td>
+                  </tr>
+                ))}
+              </tbody>
+            </table>
+          </div>
+          <nav aria-label="Paginação">
+            {r.dados.deslocamento > 0 ? (
+              <Link
+                href={`?${new URLSearchParams({ ...Object.fromEntries(filtros), deslocamento: String(Math.max(0, r.dados.deslocamento - 25)) })}`}
+              >
+                Anteriores
+              </Link>
+            ) : null}
+            {r.dados.deslocamento + 25 < r.dados.total ? (
+              <Link
+                href={`?${new URLSearchParams({ ...Object.fromEntries(filtros), deslocamento: String(r.dados.deslocamento + 25) })}`}
+              >
+                Próximas
+              </Link>
+            ) : null}
+          </nav>
+        </>
+      ) : (
+        <p role="alert">{r.mensagem}</p>
+      )}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/funcionarios.module.css b/apps/web/app/(app)/funcionarios/funcionarios.module.css
new file mode 100644
index 0000000..1744ecf
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/funcionarios.module.css
@@ -0,0 +1,109 @@
+.pagina {
+  padding: clamp(1rem, 3vw, 2.5rem);
+  max-width: 1400px;
+  margin: auto;
+  display: grid;
+  gap: 1.5rem;
+}
+.pagina header,
+.painel {
+  padding: 1.25rem;
+  border: 1px solid var(--border-subtle);
+  background: var(--bg-surface);
+  border-radius: 12px;
+}
+.pagina h1,
+.pagina h2,
+.pagina h3 {
+  margin-top: 0;
+}
+.pagina a {
+  color: var(--accent-primary);
+}
+.pagina nav {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 0.75rem;
+}
+.cards {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
+  gap: 1rem;
+}
+.tabela {
+  overflow: auto;
+  max-width: 100%;
+}
+.tabela table {
+  width: 100%;
+  border-collapse: collapse;
+}
+.tabela th,
+.tabela td {
+  text-align: left;
+  padding: 0.75rem;
+  border-bottom: 1px solid var(--border-subtle);
+  vertical-align: top;
+}
+.formulario {
+  display: grid;
+  gap: 1rem;
+}
+.formulario label {
+  display: grid;
+  gap: 0.35rem;
+}
+.formulario input,
+.formulario textarea,
+.formulario select,
+.filtros input,
+.filtros select {
+  background: var(--bg-canvas);
+  color: var(--text-primary);
+  border: 1px solid var(--border-strong);
+  padding: 0.6rem;
+  border-radius: 6px;
+  min-width: 0;
+  width: 100%;
+}
+.formulario textarea {
+  min-height: 6rem;
+}
+.filtros,
+.acoes {
+  display: flex;
+  align-items: flex-end;
+  gap: 0.75rem;
+  flex-wrap: wrap;
+}
+.filtros label {
+  display: grid;
+  gap: 0.3rem;
+}
+.pagina pre {
+  white-space: pre-wrap;
+  overflow-wrap: anywhere;
+}
+.pagina summary {
+  cursor: pointer;
+}
+.aba {
+  display: grid;
+  gap: 1rem;
+}
+.pagina :focus-visible {
+  outline: 2px solid var(--accent-focus);
+  outline-offset: 3px;
+}
+@media (max-width: 500px) {
+  .filtros label {
+    width: 100%;
+  }
+  .pagina {
+    padding: 0.75rem;
+  }
+  .pagina header,
+  .painel {
+    padding: 1rem;
+  }
+}
diff --git a/apps/web/app/(app)/funcionarios/page.tsx b/apps/web/app/(app)/funcionarios/page.tsx
new file mode 100644
index 0000000..9a26857
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/page.tsx
@@ -0,0 +1,76 @@
+import Link from "next/link";
+import type { Funcionario, Setor } from "@nucleos/contracts";
+import { funcionariosApi } from "../../../lib/funcionarios-api.ts";
+import {
+  CadastroFuncionario,
+  ListaFuncionarios,
+  PaginaFuncionarios,
+  styles,
+} from "./_components/Comum.tsx";
+export default async function Funcionarios({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const q = await searchParams;
+  const parametros = new URLSearchParams();
+  for (const nome of ["busca", "status", "setor"]) if (q[nome]) parametros.set(nome, q[nome]);
+  const [r, s] = await Promise.all([
+    funcionariosApi<Funcionario[]>(`?${parametros}`),
+    funcionariosApi<Setor[]>("/setores"),
+  ]);
+  return (
+    <PaginaFuncionarios titulo="Funcionários">
+      <p>Rotinas reais, agendamentos e histórico dos funcionários virtuais.</p>
+      {!r.ok ? (
+        <p role="alert">{r.mensagem}</p>
+      ) : (
+        <>
+          <div className={styles["cards"]}>
+            <section className={styles["painel"]}>
+              <h2>Ativos</h2>
+              <strong>{r.dados.filter((f) => f.status === "ATIVO").length}</strong>
+            </section>
+            <section className={styles["painel"]}>
+              <h2>Em rascunho</h2>
+              <strong>{r.dados.filter((f) => f.status === "RASCUNHO").length}</strong>
+            </section>
+            <section className={styles["painel"]}>
+              <h2>Falhas nos últimos 7 dias</h2>
+              <strong>{r.dados.reduce((n, f) => n + f.falhas, 0)}</strong>
+            </section>
+          </div>
+          {s.ok ? (
+            <>
+              <nav aria-label="Setores de Funcionários">
+                {s.dados.map((setor) => (
+                  <Link key={setor.id} href={`/funcionarios/setores/${setor.id}`}>
+                    {setor.nome}
+                  </Link>
+                ))}
+              </nav>
+              <CadastroFuncionario setores={s.dados} />
+            </>
+          ) : null}
+          <form className={styles["filtros"]}>
+            <label>
+              Buscar por nome
+              <input name="busca" defaultValue={q["busca"]} />
+            </label>
+            <label>
+              Status
+              <select name="status" defaultValue={q["status"] ?? ""}>
+                <option value="">Todos</option>
+                {["ATIVO", "RASCUNHO", "PAUSADO", "DESATIVADO"].map((v) => (
+                  <option key={v}>{v}</option>
+                ))}
+              </select>
+            </label>
+            <button className="btn btn--secondary">Filtrar</button>
+          </form>
+          <ListaFuncionarios itens={r.dados} />
+        </>
+      )}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/(app)/funcionarios/setores/[id]/page.tsx b/apps/web/app/(app)/funcionarios/setores/[id]/page.tsx
new file mode 100644
index 0000000..963f501
--- /dev/null
+++ b/apps/web/app/(app)/funcionarios/setores/[id]/page.tsx
@@ -0,0 +1,52 @@
+import type { Funcionario, Setor } from "@nucleos/contracts";
+import { funcionariosApi } from "../../../../../lib/funcionarios-api.ts";
+import {
+  CadastroFuncionario,
+  ListaFuncionarios,
+  PaginaFuncionarios,
+  styles,
+} from "../../_components/Comum.tsx";
+export default async function SetorFuncionarios({
+  params,
+  searchParams,
+}: {
+  params: Promise<{ id: string }>;
+  searchParams: Promise<Record<string, string | undefined>>;
+}) {
+  const { id } = await params;
+  const q = await searchParams;
+  const [s, r] = await Promise.all([
+    funcionariosApi<Setor>(`/setores/${encodeURIComponent(id)}`),
+    funcionariosApi<Funcionario[]>(
+      `?setor=${encodeURIComponent(id)}&busca=${encodeURIComponent(q["busca"] ?? "")}${q["status"] ? `&status=${encodeURIComponent(q["status"])}` : ""}`,
+    ),
+  ]);
+  return (
+    <PaginaFuncionarios titulo={s.ok ? s.dados.nome : "Setor"}>
+      {!s.ok ? (
+        <p role="alert">{s.mensagem}</p>
+      ) : (
+        <>
+          <CadastroFuncionario setores={[s.dados]} />
+          <form className={styles["filtros"]}>
+            <label>
+              Buscar
+              <input name="busca" defaultValue={q["busca"]} />
+            </label>
+            <label>
+              Status
+              <select name="status" defaultValue={q["status"] ?? ""}>
+                <option value="">Todos</option>
+                {["ATIVO", "RASCUNHO", "PAUSADO", "DESATIVADO"].map((v) => (
+                  <option key={v}>{v}</option>
+                ))}
+              </select>
+            </label>
+            <button className="btn btn--secondary">Filtrar</button>
+          </form>
+        </>
+      )}
+      {r.ok ? <ListaFuncionarios itens={r.dados} /> : <p role="alert">{r.mensagem}</p>}
+    </PaginaFuncionarios>
+  );
+}
diff --git a/apps/web/app/components/AppShell.tsx b/apps/web/app/components/AppShell.tsx
index f02aa55..127c9ff 100644
--- a/apps/web/app/components/AppShell.tsx
+++ b/apps/web/app/components/AppShell.tsx
@@ -1,13 +1,15 @@
 import type { ReactNode } from "react";
 import { NavLink } from "./NavLink.tsx";
 import { ThemeToggle } from "./ThemeToggle.tsx";
+import { setoresMenu } from "../../lib/funcionarios-api.ts";
 
 /**
  * Estrutura comum das paginas do app: menu lateral + barra superior com o
  * seletor de tema. Cada pagina fornece o proprio `<main id="conteudo">`.
  * Novos itens de menu entram aqui (ver manual de front end, secao 4).
  */
-export function AppShell({ children }: { children: ReactNode }) {
+export async function AppShell({ children }: { children: ReactNode }) {
+  const setores = await setoresMenu();
   return (
     <div className="app-shell">
       <a href="#conteudo" className="skip-link">
@@ -36,6 +38,18 @@ export function AppShell({ children }: { children: ReactNode }) {
           <NavLink href="/setores" code="ST">
             Setores
           </NavLink>
+          <NavLink href="/funcionarios" code="FU">
+            Funcionários
+          </NavLink>
+          {setores.map((setor) => (
+            <NavLink
+              key={setor.id}
+              href={`/funcionarios/setores/${setor.id}`}
+              code={setor.codigo.slice(0, 2).toUpperCase()}
+            >
+              {setor.nome}
+            </NavLink>
+          ))}
         </div>
       </nav>
 
diff --git a/apps/web/app/funcionarios.test.ts b/apps/web/app/funcionarios.test.ts
new file mode 100644
index 0000000..99ed796
--- /dev/null
+++ b/apps/web/app/funcionarios.test.ts
@@ -0,0 +1,57 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+import { funcionariosApi, setoresMenu } from "../lib/funcionarios-api.ts";
+async function comAmbiente(fn: () => Promise<void>) {
+  const nomes = ["VENDAS_API_KEY", "VENDAS_API_KEY_FILE", "VENDAS_API_URL"];
+  const salvo = new Map(nomes.map((n) => [n, process.env[n]]));
+  const fetchAntes = globalThis.fetch;
+  try {
+    delete process.env["VENDAS_API_KEY_FILE"];
+    process.env["VENDAS_API_URL"] = "http://127.0.0.1:3001";
+    await fn();
+  } finally {
+    for (const [n, v] of salvo) {
+      if (v === undefined) Reflect.deleteProperty(process.env, n);
+      else process.env[n] = v;
+    }
+    globalThis.fetch = fetchAntes;
+  }
+}
+test("cliente de Funcionários sem chave não chama API nem inventa setores", async () =>
+  comAmbiente(async () => {
+    delete process.env["VENDAS_API_KEY"];
+    let chamadas = 0;
+    globalThis.fetch = async () => {
+      chamadas++;
+      throw new Error("não deve chamar");
+    };
+    const r = await funcionariosApi("/setores");
+    assert.equal(r.ok, false);
+    assert.deepEqual(await setoresMenu(), []);
+    assert.equal(chamadas, 0);
+  }));
+test("cliente envia chave só ao servidor e devolve mensagens fixas em erros de HTTP/rede", async () =>
+  comAmbiente(async () => {
+    process.env["VENDAS_API_KEY"] = "CHAVE_SENTINELA";
+    let recebido = "";
+    globalThis.fetch = async (_, init) => {
+      recebido = new Headers(init?.headers).get("authorization") ?? "";
+      return new Response(JSON.stringify({ segredo: "CHAVE_SENTINELA" }), { status: 401 });
+    };
+    const r = await funcionariosApi("/setores");
+    assert.equal(recebido, "Bearer CHAVE_SENTINELA");
+    assert.equal(r.ok, false);
+    assert.equal(JSON.stringify(r).includes("CHAVE_SENTINELA"), false);
+    globalThis.fetch = async () => {
+      throw new Error("CHAVE_SENTINELA");
+    };
+    assert.equal(JSON.stringify(await funcionariosApi()).includes("CHAVE_SENTINELA"), false);
+    globalThis.fetch = async () =>
+      new Response(
+        JSON.stringify([
+          { id: "9", codigo: "financeiro", nome: "Financeiro", ativo: true, ordem: 0 },
+        ]),
+        { status: 200 },
+      );
+    assert.equal((await setoresMenu())[0]?.id, "9");
+  }));
diff --git a/apps/web/lib/funcionarios-api.ts b/apps/web/lib/funcionarios-api.ts
new file mode 100644
index 0000000..11ed83b
--- /dev/null
+++ b/apps/web/lib/funcionarios-api.ts
@@ -0,0 +1,46 @@
+/** Apenas servidor: a chave permanece no Next e não é incluída nos props de componentes client. */
+import type { Setor } from "@nucleos/contracts";
+import { configuracao } from "./vendas-api.ts";
+export type ResultadoFuncionarios<T> = { ok: true; dados: T } | { ok: false; mensagem: string };
+export async function funcionariosApi<T>(
+  caminho = "",
+  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
+  corpo?: unknown,
+): Promise<ResultadoFuncionarios<T>> {
+  const cfg = configuracao();
+  if (cfg === undefined)
+    return {
+      ok: false,
+      mensagem: "Configure a chave de serviço no servidor web para acessar Funcionários.",
+    };
+  try {
+    const resposta = await fetch(`${cfg.base}/v1/funcionarios${caminho}`, {
+      method,
+      headers: { authorization: `Bearer ${cfg.chave}`, "content-type": "application/json" },
+      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
+      cache: "no-store",
+      signal: AbortSignal.timeout(15000),
+    });
+    if (!resposta.ok)
+      return {
+        ok: false,
+        mensagem:
+          resposta.status === 400
+            ? "Confira os campos e a configuração da tarefa."
+            : resposta.status === 409
+              ? "A operação conflita com o estado atual. Tarefas planejadas não podem executar."
+              : resposta.status === 404
+                ? "Registro ou módulo não encontrado. Verifique as migrations da API."
+                : resposta.status === 401 || resposta.status === 503
+                  ? "A chave de serviço não foi configurada ou foi recusada."
+                  : "A API de Funcionários está indisponível.",
+      };
+    return { ok: true, dados: (await resposta.json()) as T };
+  } catch {
+    return { ok: false, mensagem: "Não foi possível acessar a API de Funcionários agora." };
+  }
+}
+export async function setoresMenu(): Promise<Setor[]> {
+  const r = await funcionariosApi<Setor[]>("/setores");
+  return r.ok && Array.isArray(r.dados) ? r.dados : [];
+}
diff --git a/packages/contracts/src/config-tarefa.ts b/packages/contracts/src/config-tarefa.ts
new file mode 100644
index 0000000..ae5533a
--- /dev/null
+++ b/packages/contracts/src/config-tarefa.ts
@@ -0,0 +1,9 @@
+import { Ajv2020 } from "ajv/dist/2020.js";
+/** Schemas são registros do backend, não código fornecido pelo painel. Sem coerção ou defaults ocultos. */
+export function validarConfigTarefa(schema: Record<string, unknown>, valor: unknown): boolean {
+  try {
+    return new Ajv2020({ strict: true, allErrors: false }).compile(schema)(valor);
+  } catch {
+    return false;
+  }
+}
diff --git a/packages/contracts/src/funcionarios.ts b/packages/contracts/src/funcionarios.ts
new file mode 100644
index 0000000..f4ef2aa
--- /dev/null
+++ b/packages/contracts/src/funcionarios.ts
@@ -0,0 +1,111 @@
+/** Contratos administrativos locais. IDs bigint são strings no transporte. */
+export type ObjetoConfig = Record<string, unknown>;
+export type TipoFuncionario = "DETERMINISTICO" | "AGENTE_IA" | "HIBRIDO";
+export type StatusFuncionario = "RASCUNHO" | "ATIVO" | "PAUSADO" | "DESATIVADO";
+export type Gatilho = "MANUAL" | "UNICO" | "INTERVALO" | "CRON" | "EVENTO";
+export type EstadoExecucao =
+  "AGUARDANDO" | "EXECUTANDO" | "SUCESSO" | "FALHA" | "CANCELADA" | "IGNORADA";
+export interface Setor {
+  id: string;
+  codigo: string;
+  nome: string;
+  descricao: string;
+  ativo: boolean;
+  ordem: number;
+}
+export interface Funcionario {
+  id: string;
+  setor_id: string;
+  nome: string;
+  slug: string;
+  descricao: string;
+  tipo: TipoFuncionario;
+  status: StatusFuncionario;
+  perfil_ia: string | null;
+  avatar: string | null;
+  tarefas: number;
+  ultima_em: string | null;
+  proxima_em: string | null;
+  falhas: number;
+}
+export interface DefinicaoTarefa {
+  id: string;
+  setor_id: string;
+  codigo: string;
+  nome: string;
+  descricao: string;
+  tipo: string;
+  handler_key: string | null;
+  config_schema: ObjetoConfig;
+  config_padrao: ObjetoConfig;
+  gatilhos_suportados: Gatilho[];
+  permissoes_requeridas: string[];
+  nivel_risco: string;
+  status_implementacao: "DISPONIVEL" | "PLANEJADA" | "INDISPONIVEL";
+  ativo: boolean;
+  atribuicoes?: number;
+  habilitadas?: number;
+}
+export interface Atribuicao {
+  id: string;
+  funcionario_id: string;
+  definicao_id: string;
+  setor_id: string;
+  config: ObjetoConfig;
+  habilitada: boolean;
+  prioridade: number;
+  nome_override: string | null;
+  definicao: DefinicaoTarefa;
+  agendamentos: Agendamento[];
+}
+export interface Agendamento {
+  id: string;
+  atribuicao_id: string;
+  gatilho: Gatilho;
+  intervalo_min: number | null;
+  cron: string | null;
+  tipo_evento: string | null;
+  filtro_evento: ObjetoConfig;
+  fuso: string;
+  inicio_em: string;
+  fim_em: string | null;
+  proxima_em: string | null;
+  ultima_em: string | null;
+  habilitado: boolean;
+  politica_sobreposicao: "PULAR" | "ENFILEIRAR" | "CANCELAR_ANTERIOR";
+  politica_retentativa: { maxTentativas: number; backoffSegundos: number };
+  versao: number;
+}
+export interface ExecucaoFuncionario {
+  id: string;
+  atribuicao_id: string;
+  agendamento_id: string | null;
+  origem: string;
+  status: EstadoExecucao;
+  programada_em: string;
+  iniciada_em: string | null;
+  finalizada_em: string | null;
+  tentativa: number;
+  correlacao: string;
+  config_snapshot: ObjetoConfig;
+  resumo: unknown;
+  erro_codigo: string | null;
+  criado_em: string;
+  funcionario_nome?: string;
+  tarefa_nome?: string;
+}
+export interface ListaExecucoes {
+  itens: ExecucaoFuncionario[];
+  total: number;
+  limite: number;
+  deslocamento: number;
+}
+export interface DetalheFuncionario {
+  funcionario: Funcionario;
+  atribuicoes: Atribuicao[];
+}
+export interface EstadoFuncionarios {
+  setores: (Setor & {
+    funcionarios: (Funcionario & { atividade: ExecucaoFuncionario | null })[];
+  })[];
+}
diff --git a/packages/contracts/src/index.ts b/packages/contracts/src/index.ts
index 18680b8..d5333ba 100644
--- a/packages/contracts/src/index.ts
+++ b/packages/contracts/src/index.ts
@@ -13,6 +13,8 @@ export function healthResponse(service: string): HealthResponse {
 export * from "./generated/index.js";
 export * from "./vendas.js";
 export * from "./fluxo-caixa.js";
+export * from "./funcionarios.js";
+export { validarConfigTarefa } from "./config-tarefa.js";
 export { isRfc3339DateTime } from "./datetime.js";
 export {
   RUNTIME_TOKEN_MAX_TTL_S,
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index b7216a2..685c79b 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -221,6 +221,9 @@ importers:
       '@nucleos/observability':
         specifier: workspace:*
         version: link:../../packages/observability
+      cron-parser:
+        specifier: 5.10.3
+        version: 5.10.3
       pg:
         specifier: 8.23.1
         version: 8.23.1
@@ -1015,6 +1018,10 @@ packages:
     resolution: {integrity: sha512-tJtZBBHA6vjIAaF6EnIaq6laBBP9aq/Y3ouVJjEfoHbRBcHBAHYcMh/w8LDrk2PvIMMq8gmopa5D4V8RmbrxGw==}
     engines: {node: '>= 0.10'}
 
+  cron-parser@5.10.3:
+    resolution: {integrity: sha512-Fwlmlgiyoj5e7XDCy5T3ueFd3imgt714k7xjAzhkOBUrUgQxWtsjS7kWSEN3efDX34bebxBJAmPoCSisHvjlpw==}
+    engines: {node: '>=18'}
+
   cross-spawn@7.0.6:
     resolution: {integrity: sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==}
     engines: {node: '>= 8'}
@@ -1431,6 +1438,10 @@ packages:
   lodash@4.18.1:
     resolution: {integrity: sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==}
 
+  luxon@3.7.2:
+    resolution: {integrity: sha512-vtEhXh/gNjI9Yg1u4jX/0YVPMvxzHuGgCm6tC5kZyb08yjGWGnqAjGJvcXbqQR2P3MyMEFnRbpcdFS6PBcLqew==}
+    engines: {node: '>=12'}
+
   math-intrinsics@1.1.0:
     resolution: {integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==}
     engines: {node: '>= 0.4'}
@@ -2613,6 +2624,10 @@ snapshots:
       object-assign: 4.1.1
       vary: 1.1.2
 
+  cron-parser@5.10.3:
+    dependencies:
+      luxon: 3.7.2
+
   cross-spawn@7.0.6:
     dependencies:
       path-key: 3.1.1
@@ -3053,6 +3068,8 @@ snapshots:
 
   lodash@4.18.1: {}
 
+  luxon@3.7.2: {}
+
   math-intrinsics@1.1.0: {}
 
   media-typer@0.3.0: {}
```
