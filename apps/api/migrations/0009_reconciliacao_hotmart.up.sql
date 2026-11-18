UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL',config_schema='{"type":"object","properties":{"inicio":{"type":"string","format":"date"},"fim":{"type":"string","format":"date"}},"additionalProperties":false}'
 WHERE codigo='financeiro.reconciliar_hotmart';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d ON d.codigo='financeiro.reconciliar_hotmart'
 WHERE f.slug='analista-atualizacoes-financeiras' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em,habilitado)
 SELECT a.id,'CRON','0 3 * * *',date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'+interval '1 day 3 hours',true
 FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='financeiro.reconciliar_hotmart' AND NOT EXISTS(SELECT 1 FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id);
