UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
 WHERE codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos');
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos') WHERE f.slug='gestor-contas'
 ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','0 6 * * *',now() FROM funcionarios.atribuicoes a
 JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo IN ('financeiro.gerar_recorrencias','financeiro.verificar_vencimentos');
UPDATE funcionarios.funcionarios SET status='ATIVO' WHERE slug='gestor-contas' AND status='RASCUNHO';
