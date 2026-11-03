ALTER TABLE financeiro.vendas DROP CONSTRAINT vendas_grupo_check;
ALTER TABLE financeiro.vendas ADD CONSTRAINT vendas_grupo_check CHECK(grupo IN ('receita','reembolso','cancelada','pendente','contestada'));
ALTER TABLE financeiro.vendas ADD COLUMN oferta_codigo text,
 ADD COLUMN desconto_centavos bigint CHECK(desconto_centavos>=0),
 ADD COLUMN comissoes_centavos bigint NOT NULL DEFAULT 0 CHECK(comissoes_centavos>=0),
 ADD COLUMN liquido_centavos bigint,
 ADD COLUMN rastreio_origem text, ADD COLUMN rastreio_sck text;
UPDATE financeiro.vendas SET liquido_centavos=valor_centavos-taxa_centavos;
ALTER TABLE financeiro.vendas ALTER COLUMN liquido_centavos SET NOT NULL;
-- Existing internal writers that omit the new column retain the effective-price semantics.
CREATE FUNCTION financeiro.completar_liquido_venda() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.liquido_centavos IS NULL THEN
  NEW.liquido_centavos=NEW.valor_centavos-NEW.taxa_centavos-NEW.comissoes_centavos;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER completar_liquido_venda BEFORE INSERT ON financeiro.vendas
 FOR EACH ROW EXECUTE FUNCTION financeiro.completar_liquido_venda();
UPDATE financeiro.vendas SET grupo='contestada' WHERE status IN ('CHARGEBACK','DISPUTE');
CREATE TABLE financeiro.vendas_eventos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 transacao text NOT NULL REFERENCES financeiro.vendas(transacao),
 status_anterior text, status_novo text NOT NULL,
 origem text NOT NULL CHECK(origem IN ('polling','webhook','reconciliacao')),
 ocorrido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendas_eventos_transacao_idx ON financeiro.vendas_eventos(transacao,id);
CREATE TABLE financeiro.vendas_comissoes (
 transacao text NOT NULL REFERENCES financeiro.vendas(transacao),
 tipo text NOT NULL, moeda char(3) NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos>=0),
 PRIMARY KEY(transacao,tipo,moeda)
);
