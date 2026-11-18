CREATE TABLE financeiro.alertas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tipo text NOT NULL CHECK(tipo IN ('conta_vencendo','conta_vencida','divergencia_conciliacao','divergencia_hotmart','recebimento_atrasado','caixa_insuficiente','anomalia','campanha_ruim')),
 severidade text NOT NULL CHECK(severidade IN ('info','aviso','critico')),
 referencia_tabela text NOT NULL, referencia_id text NOT NULL,
 mensagem text NOT NULL CHECK(length(mensagem) BETWEEN 1 AND 240),
 estado text NOT NULL DEFAULT 'aberto' CHECK(estado IN ('aberto','resolvido','ignorado')),
 chave text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), encerrado_em timestamptz
);
CREATE UNIQUE INDEX alertas_abertos_uq ON financeiro.alertas(chave) WHERE estado='aberto';
CREATE INDEX alertas_estado_data_idx ON financeiro.alertas(estado,criado_em DESC);
