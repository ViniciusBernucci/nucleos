UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL',
 config_schema='{"type":"object","properties":{"minimoCentavos":{"type":"string","pattern":"^[0-9]{1,14}$"},"aumentoDespesaPct":{"type":"integer","minimum":0,"maximum":300},"quedaMargemPp":{"type":"integer","minimum":0,"maximum":100},"reembolsoPct":{"type":"integer","minimum":0,"maximum":100}},"additionalProperties":false}'
 WHERE codigo IN ('financeiro.monitorar_caixa','financeiro.calcular_dre','financeiro.detectar_anomalias');
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo IN ('financeiro.monitorar_caixa','financeiro.calcular_dre','financeiro.detectar_anomalias')
 WHERE f.slug='analista-indicadores' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','15 7 * * *',now() FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo IN ('financeiro.monitorar_caixa','financeiro.calcular_dre','financeiro.detectar_anomalias');
