CREATE TABLE financeiro.analises_cfo (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 execucao_id bigint NOT NULL UNIQUE REFERENCES funcionarios.execucoes,
 competencia text NOT NULL CHECK(competencia IN ('diagnostico','planejamento','despesas','rentabilidade','recomendacoes')),
 pergunta text NOT NULL, de date NOT NULL, ate date NOT NULL CHECK(ate>=de),
 resposta text NOT NULL, estado text NOT NULL, ferramentas jsonb NOT NULL, uso jsonb NOT NULL,
 criada_em timestamptz NOT NULL DEFAULT now()
);
UPDATE funcionarios.definicoes_tarefa SET status_implementacao='INDISPONIVEL',
 descricao='Analise consultiva. Configure ANTHROPIC_API_KEY no ai-gateway e as chaves internas distintas.',
 config_schema='{"type":"object","properties":{"competencia":{"type":"string","enum":["diagnostico","planejamento","despesas","rentabilidade","recomendacoes"]},"de":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"ate":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"}},"additionalProperties":false}'
 WHERE codigo='diretoria.analisar_financas';
INSERT INTO funcionarios.atribuicoes(funcionario_id,definicao_id,setor_id)
 SELECT f.id,d.id,f.setor_id FROM funcionarios.funcionarios f JOIN funcionarios.definicoes_tarefa d ON d.codigo='diretoria.analisar_financas'
 WHERE f.slug='cfo-virtual' ON CONFLICT(funcionario_id,definicao_id) DO NOTHING;
