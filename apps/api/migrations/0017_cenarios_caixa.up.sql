CREATE TABLE financeiro.cenarios_caixa (
 codigo text PRIMARY KEY CHECK(codigo IN ('conservador','base','otimista')),
 realizacao_pct integer NOT NULL CHECK(realizacao_pct BETWEEN 0 AND 100),
 reembolso_pct integer NOT NULL CHECK(reembolso_pct BETWEEN 0 AND 100),
 variacao_despesas_pct integer NOT NULL CHECK(variacao_despesas_pct BETWEEN -100 AND 300)
);
INSERT INTO financeiro.cenarios_caixa VALUES('conservador',70,10,10),('base',90,5,0),('otimista',100,0,-5);
