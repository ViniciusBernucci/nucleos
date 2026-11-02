-- Categorias de entrada e saida do fluxo de caixa. Forward-only (ADR-017).
-- Lancamentos e contas continuam guardando o nome da categoria (texto): excluir uma categoria nao
-- altera o historico; a API so aceita categorias cadastradas em registros novos.

CREATE TABLE financeiro.categorias (
  id        bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo      text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  nome      text        NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
  criada_em timestamptz NOT NULL DEFAULT now()
);

-- Um nome por tipo, sem diferenciar maiusculas ("Aluguel" = "aluguel").
CREATE UNIQUE INDEX categorias_tipo_nome_uq ON financeiro.categorias (tipo, lower(nome));

-- Categorias ja usadas antes desta migration continuam validas.
INSERT INTO financeiro.categorias (tipo, nome)
SELECT DISTINCT tipo, categoria FROM financeiro.lancamentos
ON CONFLICT (tipo, lower(nome)) DO NOTHING;

INSERT INTO financeiro.categorias (tipo, nome)
SELECT DISTINCT 'saida', categoria FROM financeiro.contas_recorrentes
ON CONFLICT (tipo, lower(nome)) DO NOTHING;

-- Ponto de partida editavel (podem ser excluidas na tela).
INSERT INTO financeiro.categorias (tipo, nome) VALUES
  ('entrada', 'Vendas'),
  ('entrada', 'Aporte de sócios'),
  ('entrada', 'Outras entradas'),
  ('saida', 'Aluguel'),
  ('saida', 'Salários'),
  ('saida', 'Impostos'),
  ('saida', 'Fornecedores'),
  ('saida', 'Serviços'),
  ('saida', 'Outras saídas')
ON CONFLICT (tipo, lower(nome)) DO NOTHING;
