CREATE TABLE financeiro.conciliacoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 estado text NOT NULL CHECK(estado IN ('conciliada','parcial','pendente_analise')),
 diferenca_centavos bigint NOT NULL DEFAULT 0, observacao text NOT NULL DEFAULT '',
 chave text NOT NULL, aceita boolean NOT NULL DEFAULT false, recusada boolean NOT NULL DEFAULT false,
 desfeita boolean NOT NULL DEFAULT false, quem text NOT NULL DEFAULT 'admin-local',
 criada_em timestamptz NOT NULL DEFAULT now(), atualizada_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conciliacao_ativa_chave_uq ON financeiro.conciliacoes(chave) WHERE NOT desfeita AND NOT recusada;
CREATE TABLE financeiro.conciliacao_itens (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conciliacao_id bigint NOT NULL REFERENCES financeiro.conciliacoes,
 tipo text NOT NULL CHECK(tipo IN ('venda','saque','extrato_item','lancamento','conta_pagar')),
 referencia_id text NOT NULL, valor_centavos bigint NOT NULL,
 UNIQUE(conciliacao_id,tipo,referencia_id)
);
UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL' WHERE codigo='financeiro.conciliar_vendas';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo='financeiro.conciliar_vendas' WHERE f.slug='conciliador-financeiro'
 ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','0 8 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='financeiro.conciliar_vendas';
UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='conciliador-financeiro' AND status='RASCUNHO';
