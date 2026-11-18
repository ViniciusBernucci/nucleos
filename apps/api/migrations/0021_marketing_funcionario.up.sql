UPDATE funcionarios.definicoes_tarefa SET status_implementacao='INDISPONIVEL',
 descricao='Importacao somente leitura. Exige META_ADS_ACCESS_TOKEN (ou arquivo) e META_ADS_ACCOUNT_ID no servidor.'
 WHERE codigo='marketing.importar_meta_ads';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f
 JOIN funcionarios.definicoes_tarefa d ON d.codigo='marketing.importar_meta_ads'
 WHERE f.slug='gestor-trafego' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,cron,proxima_em)
 SELECT a.id,'CRON','0 */6 * * *',now() FROM funcionarios.atribuicoes a
 JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='marketing.importar_meta_ads'
 AND NOT EXISTS(SELECT 1 FROM funcionarios.agendamentos s WHERE s.atribuicao_id=a.id);
