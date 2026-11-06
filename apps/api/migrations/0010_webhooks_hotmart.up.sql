CREATE TABLE financeiro.webhooks_hotmart (
 id text PRIMARY KEY, tipo text NOT NULL, transacao text NOT NULL,
 recebido_em timestamptz NOT NULL DEFAULT now(), corpo_hash char(64) NOT NULL,
 processado_em timestamptz
);
UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL'
 WHERE codigo='financeiro.processar_evento_hotmart';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d
 ON d.codigo='financeiro.processar_evento_hotmart' WHERE f.slug='analista-atualizacoes-financeiras'
 ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
INSERT INTO funcionarios.agendamentos(atribuicao_id,gatilho,tipo_evento)
 SELECT a.id,'EVENTO','hotmart.webhook.recebido' FROM funcionarios.atribuicoes a
 JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
 WHERE d.codigo='financeiro.processar_evento_hotmart';
