CREATE TABLE financeiro.linhas_dre (
 codigo text PRIMARY KEY, nome text NOT NULL, ordem integer NOT NULL UNIQUE
);
INSERT INTO financeiro.linhas_dre VALUES('impostos','Impostos sobre vendas',1),('variaveis','Outros custos variaveis',2),
 ('fixas','Despesas fixas',3),('nao_classificado','Nao classificado',4);
ALTER TABLE financeiro.categorias ADD CONSTRAINT categorias_linha_dre_fk FOREIGN KEY(linha_dre) REFERENCES financeiro.linhas_dre(codigo);
UPDATE financeiro.categorias SET linha_dre='impostos' WHERE tipo='saida' AND lower(nome)='impostos';
UPDATE financeiro.categorias SET linha_dre='fixas' WHERE tipo='saida' AND lower(nome) IN ('aluguel','salários');
CREATE TABLE financeiro.dre_mensal (mes date PRIMARY KEY, dados jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now());
