CREATE SCHEMA IF NOT EXISTS organizacao;
CREATE SCHEMA IF NOT EXISTS funcionarios;
CREATE TABLE organizacao.setores (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, codigo text NOT NULL UNIQUE,
 nome text NOT NULL, descricao text NOT NULL DEFAULT '', ativo boolean NOT NULL DEFAULT true,
 ordem integer NOT NULL DEFAULT 0, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE funcionarios.funcionarios (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 setor_id bigint NOT NULL REFERENCES organizacao.setores(id), nome text NOT NULL,
 slug text NOT NULL UNIQUE, descricao text NOT NULL DEFAULT '',
 tipo text NOT NULL CHECK(tipo IN ('DETERMINISTICO','AGENTE_IA','HIBRIDO')),
 status text NOT NULL DEFAULT 'RASCUNHO' CHECK(status IN ('RASCUNHO','ATIVO','PAUSADO','DESATIVADO')),
 perfil_ia text, avatar text, criado_por text NOT NULL DEFAULT 'admin-local',
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(setor_id,nome), UNIQUE(id,setor_id)
);
CREATE TABLE funcionarios.definicoes_tarefa (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 setor_id bigint NOT NULL REFERENCES organizacao.setores(id), codigo text NOT NULL UNIQUE,
 nome text NOT NULL, descricao text NOT NULL DEFAULT '',
 tipo text NOT NULL DEFAULT 'DETERMINISTICO' CHECK(tipo IN ('DETERMINISTICO','TAREFA_IA','AGENTE_IA','HIBRIDO')),
 handler_key text, config_schema jsonb NOT NULL DEFAULT '{"type":"object","additionalProperties":false}',
 config_padrao jsonb NOT NULL DEFAULT '{}', gatilhos_suportados text[] NOT NULL DEFAULT '{MANUAL,UNICO,INTERVALO,CRON,EVENTO}',
 permissoes_requeridas text[] NOT NULL DEFAULT '{funcionarios.executar}', nivel_risco text NOT NULL DEFAULT 'medio',
 status_implementacao text NOT NULL DEFAULT 'PLANEJADA' CHECK(status_implementacao IN ('DISPONIVEL','PLANEJADA','INDISPONIVEL')),
 ativo boolean NOT NULL DEFAULT true, UNIQUE(id,setor_id),
 CHECK(status_implementacao <> 'DISPONIVEL' OR handler_key IS NOT NULL)
);
CREATE TABLE funcionarios.atribuicoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 funcionario_id bigint NOT NULL, definicao_id bigint NOT NULL, setor_id bigint NOT NULL,
 config jsonb NOT NULL DEFAULT '{}', habilitada boolean NOT NULL DEFAULT true,
 prioridade integer NOT NULL DEFAULT 0 CHECK(prioridade BETWEEN 0 AND 100),
 nome_override text, criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(funcionario_id,setor_id) REFERENCES funcionarios.funcionarios(id,setor_id),
 FOREIGN KEY(definicao_id,setor_id) REFERENCES funcionarios.definicoes_tarefa(id,setor_id),
 UNIQUE(funcionario_id,definicao_id)
);
CREATE TABLE funcionarios.agendamentos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 atribuicao_id bigint NOT NULL REFERENCES funcionarios.atribuicoes(id),
 gatilho text NOT NULL CHECK(gatilho IN ('MANUAL','UNICO','INTERVALO','CRON','EVENTO')),
 intervalo_min integer CHECK(intervalo_min BETWEEN 1 AND 525600), cron text,
 tipo_evento text, filtro_evento jsonb NOT NULL DEFAULT '{}', fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
 inicio_em timestamptz NOT NULL DEFAULT now(), fim_em timestamptz,
 proxima_em timestamptz, ultima_em timestamptz, habilitado boolean NOT NULL DEFAULT true,
 politica_sobreposicao text NOT NULL DEFAULT 'PULAR' CHECK(politica_sobreposicao IN ('PULAR','ENFILEIRAR','CANCELAR_ANTERIOR')),
 politica_retentativa jsonb NOT NULL DEFAULT '{"maxTentativas":3,"backoffSegundos":30}',
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
 CHECK(gatilho<>'INTERVALO' OR intervalo_min IS NOT NULL),
 CHECK(gatilho<>'CRON' OR cron IS NOT NULL), CHECK(gatilho<>'EVENTO' OR tipo_evento IS NOT NULL),
 CHECK(fim_em IS NULL OR fim_em>=inicio_em)
);
CREATE INDEX agendamentos_pendentes ON funcionarios.agendamentos(proxima_em) WHERE habilitado;
CREATE TABLE funcionarios.execucoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 atribuicao_id bigint NOT NULL REFERENCES funcionarios.atribuicoes(id),
 agendamento_id bigint REFERENCES funcionarios.agendamentos(id), agendamento_versao integer,
 origem text NOT NULL CHECK(origem IN ('manual','agendamento','evento')),
 status text NOT NULL DEFAULT 'AGUARDANDO' CHECK(status IN ('AGUARDANDO','EXECUTANDO','SUCESSO','FALHA','CANCELADA','IGNORADA')),
 programada_em timestamptz NOT NULL DEFAULT now(), iniciada_em timestamptz, finalizada_em timestamptz,
 tentativa integer NOT NULL DEFAULT 0, chave_idempotencia text NOT NULL UNIQUE,
 correlacao uuid NOT NULL, disparada_por text NOT NULL DEFAULT 'admin-local',
 config_snapshot jsonb NOT NULL, resumo jsonb, erro_codigo text,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX execucoes_historico ON funcionarios.execucoes(atribuicao_id,criado_em DESC);
CREATE TABLE funcionarios.fila (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 execucao_id bigint NOT NULL UNIQUE REFERENCES funcionarios.execucoes(id),
 estado text NOT NULL DEFAULT 'AGUARDANDO' CHECK(estado IN ('AGUARDANDO','EXECUTANDO','SUCESSO','FALHA','CANCELADA','IGNORADA')),
 executar_em timestamptz NOT NULL DEFAULT now(), tentativa integer NOT NULL DEFAULT 0,
 lease_ate timestamptz, lease_dono text, payload jsonb NOT NULL DEFAULT '{}',
 CHECK(estado<>'EXECUTANDO' OR (lease_ate IS NOT NULL AND lease_dono IS NOT NULL))
);
CREATE INDEX fila_disponivel ON funcionarios.fila(executar_em) WHERE estado IN ('AGUARDANDO','EXECUTANDO');
CREATE TABLE funcionarios.eventos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tipo text NOT NULL,
 chave text NOT NULL UNIQUE, payload jsonb NOT NULL, recebido_em timestamptz NOT NULL DEFAULT now(),
 processado_em timestamptz
);
CREATE TABLE funcionarios.auditoria (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, quem text NOT NULL DEFAULT 'admin-local',
 quando timestamptz NOT NULL DEFAULT now(), entidade text NOT NULL, entidade_id text NOT NULL,
 acao text NOT NULL, antes jsonb, depois jsonb
);

-- IDs bigint continuam exatos no transporte JSON; não converte dados internos de config.
CREATE FUNCTION funcionarios.json_ids(registro jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_object_agg(chave, CASE WHEN (chave='id' OR chave LIKE '%\_id' ESCAPE '\') AND jsonb_typeof(valor)='number'
 THEN to_jsonb(valor #>> '{}') ELSE valor END) FROM jsonb_each(registro) AS campos(chave,valor)
$$;