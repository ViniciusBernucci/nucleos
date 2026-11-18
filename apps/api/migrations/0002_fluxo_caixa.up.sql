-- Fluxo de caixa (setor Financeiro): contas a pagar recorrentes e lancamentos de entrada/saida.
-- Forward-only (ADR-017). Valores em centavos, sempre BRL. Meses guardados como o dia 1 do mes.

CREATE TABLE financeiro.contas_recorrentes (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  descricao       text        NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
  categoria       text        NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 60),
  valor_centavos  bigint      NOT NULL CHECK (valor_centavos > 0),
  dia_vencimento  smallint    NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  inicio          date        NOT NULL CHECK (extract(day FROM inicio) = 1),
  fim             date        CHECK (fim IS NULL OR (extract(day FROM fim) = 1 AND fim >= inicio)),
  criada_em       timestamptz NOT NULL DEFAULT now(),
  atualizada_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE financeiro.lancamentos (
  id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo                text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao           text        NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
  categoria           text        NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 60),
  valor_centavos      bigint      NOT NULL CHECK (valor_centavos > 0),
  data                date        NOT NULL,
  conta_recorrente_id bigint      REFERENCES financeiro.contas_recorrentes (id) ON DELETE RESTRICT,
  competencia         date,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  -- Pagamento de conta recorrente: sempre saida e sempre com o mes de competencia.
  CHECK ((conta_recorrente_id IS NULL) = (competencia IS NULL)),
  CHECK (conta_recorrente_id IS NULL OR tipo = 'saida'),
  CHECK (competencia IS NULL OR extract(day FROM competencia) = 1)
);

CREATE INDEX lancamentos_data_idx ON financeiro.lancamentos (data, id);

-- Cada conta recorrente e paga no maximo uma vez por mes de competencia.
CREATE UNIQUE INDEX lancamentos_conta_competencia_uq
  ON financeiro.lancamentos (conta_recorrente_id, competencia)
  WHERE conta_recorrente_id IS NOT NULL;
