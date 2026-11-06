CREATE TABLE financeiro.fornecedores (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 120),
 documento text, contato text
);
CREATE TABLE financeiro.centros_custo (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 80),
 ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE financeiro.categorias ADD COLUMN linha_dre text, ADD COLUMN excluir_da_dre boolean NOT NULL DEFAULT false;
ALTER TABLE financeiro.contas_recorrentes ADD COLUMN fornecedor_id bigint REFERENCES financeiro.fornecedores,
 ADD COLUMN centro_custo_id bigint REFERENCES financeiro.centros_custo,
 ADD COLUMN periodicidade text NOT NULL DEFAULT 'mensal' CHECK(periodicidade IN ('mensal','anual'));
CREATE TABLE financeiro.contas_pagar (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 descricao text NOT NULL CHECK(length(descricao) BETWEEN 1 AND 120),
 fornecedor_id bigint REFERENCES financeiro.fornecedores, categoria text NOT NULL,
 centro_custo_id bigint REFERENCES financeiro.centros_custo,
 valor_centavos bigint NOT NULL CHECK(valor_centavos>0), vencimento date NOT NULL, competencia date NOT NULL,
 status text NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','paga','cancelada')),
 parcela integer NOT NULL DEFAULT 1, parcelas integer NOT NULL DEFAULT 1, grupo_parcelamento uuid,
 origem text NOT NULL CHECK(origem IN ('manual','recorrente','importacao')),
 conta_recorrente_id bigint REFERENCES financeiro.contas_recorrentes,
 importacao_hash text UNIQUE, criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_recorrente_id,competencia), CHECK(parcela BETWEEN 1 AND parcelas)
);
ALTER TABLE financeiro.lancamentos ADD COLUMN conta_pagar_id bigint REFERENCES financeiro.contas_pagar;
CREATE UNIQUE INDEX lancamentos_conta_pagar_uq ON financeiro.lancamentos(conta_pagar_id) WHERE conta_pagar_id IS NOT NULL;
WITH migradas AS (
 INSERT INTO financeiro.contas_pagar(descricao,categoria,valor_centavos,vencimento,competencia,status,origem,conta_recorrente_id)
 SELECT descricao,categoria,valor_centavos,data,competencia,'paga','recorrente',conta_recorrente_id
 FROM financeiro.lancamentos WHERE conta_recorrente_id IS NOT NULL
 RETURNING id,conta_recorrente_id,competencia
)
UPDATE financeiro.lancamentos l SET conta_pagar_id=m.id FROM migradas m
 WHERE l.conta_recorrente_id=m.conta_recorrente_id AND l.competencia=m.competencia;
CREATE INDEX contas_pagar_vencimento_idx ON financeiro.contas_pagar(status,vencimento);
-- Keep the existing recurring-payment API compatible with materialized payables.
CREATE FUNCTION financeiro.vincular_pagamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.conta_recorrente_id IS NOT NULL AND NEW.conta_pagar_id IS NULL THEN
  INSERT INTO financeiro.contas_pagar(descricao,categoria,valor_centavos,vencimento,competencia,status,origem,conta_recorrente_id)
  VALUES(NEW.descricao,NEW.categoria,NEW.valor_centavos,NEW.data,NEW.competencia,'paga','recorrente',NEW.conta_recorrente_id)
  ON CONFLICT(conta_recorrente_id,competencia) DO UPDATE SET status='paga'
  RETURNING id INTO NEW.conta_pagar_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vincular_pagamento BEFORE INSERT ON financeiro.lancamentos
 FOR EACH ROW EXECUTE FUNCTION financeiro.vincular_pagamento();
CREATE FUNCTION financeiro.reabrir_pagamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.conta_pagar_id IS NOT NULL THEN
  UPDATE financeiro.contas_pagar SET status='aberta' WHERE id=OLD.conta_pagar_id AND status='paga';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER reabrir_pagamento AFTER DELETE ON financeiro.lancamentos
 FOR EACH ROW EXECUTE FUNCTION financeiro.reabrir_pagamento();
CREATE TABLE financeiro.anexos (
 id uuid PRIMARY KEY, conta_pagar_id bigint NOT NULL REFERENCES financeiro.contas_pagar,
 nome text NOT NULL, tipo text NOT NULL CHECK(tipo IN ('application/pdf','image/jpeg','image/png')),
 tamanho integer NOT NULL CHECK(tamanho BETWEEN 1 AND 10485760), hash char(64) NOT NULL, objeto_chave text NOT NULL UNIQUE,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX anexos_conta_pagar_idx ON financeiro.anexos(conta_pagar_id);
