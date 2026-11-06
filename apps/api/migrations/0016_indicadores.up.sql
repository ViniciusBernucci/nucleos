CREATE TABLE financeiro.indicadores_mensais (
 mes date PRIMARY KEY CHECK(extract(day FROM mes)=1), dados jsonb NOT NULL,
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
 WHERE codigo='financeiro.atualizar_indicadores';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo='financeiro.atualizar_indicadores' WHERE f.slug='analista-indicadores'
 ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','0 7 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='financeiro.atualizar_indicadores';
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,tipo_evento)
 SELECT a.id,'EVENTO','financeiro.dados.alterados' FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='financeiro.atualizar_indicadores';
UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='analista-indicadores' AND status='RASCUNHO';
