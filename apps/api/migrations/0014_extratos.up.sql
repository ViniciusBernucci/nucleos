CREATE TABLE financeiro.extratos_importados (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
 hash char(64) NOT NULL, importado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(conta_financeira_id,hash)
);
CREATE TABLE financeiro.extrato_itens (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, extrato_id bigint NOT NULL REFERENCES financeiro.extratos_importados,
 conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
 fitid text NOT NULL, data date NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos<>0),
 memo text NOT NULL, conciliado boolean NOT NULL DEFAULT false, UNIQUE(conta_financeira_id,fitid)
);
UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
 WHERE codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos');
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos') WHERE f.slug='gestor-contas'
 ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','0 7 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo IN ('financeiro.atualizar_previsoes','financeiro.alertar_recebimentos');
