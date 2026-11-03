CREATE TABLE financeiro.contas_financeiras (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nome text NOT NULL UNIQUE,
 tipo text NOT NULL CHECK(tipo IN ('banco','caixa','plataforma')), ativa boolean NOT NULL DEFAULT true
);
INSERT INTO financeiro.contas_financeiras(nome,tipo) VALUES('Caixa principal','caixa'),('Hotmart','plataforma');
ALTER TABLE financeiro.lancamentos ADD COLUMN conta_financeira_id bigint REFERENCES financeiro.contas_financeiras,
 ADD COLUMN centro_custo_id bigint REFERENCES financeiro.centros_custo,
 ADD COLUMN transferencia_id uuid;
UPDATE financeiro.lancamentos SET conta_financeira_id=(SELECT id FROM financeiro.contas_financeiras WHERE nome='Caixa principal');
ALTER TABLE financeiro.lancamentos ALTER COLUMN conta_financeira_id SET NOT NULL,
 ALTER COLUMN conta_financeira_id SET DEFAULT 1;
CREATE TABLE financeiro.saques_hotmart (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, data date NOT NULL,
 bruto_centavos bigint NOT NULL CHECK(bruto_centavos>0), taxa_centavos bigint NOT NULL CHECK(taxa_centavos>=0),
 liquido_centavos bigint NOT NULL CHECK(liquido_centavos>0), conta_destino_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
 comprovante text, transferencia_id uuid NOT NULL UNIQUE,
 CHECK(bruto_centavos-taxa_centavos=liquido_centavos)
);
CREATE TABLE financeiro.saldos_informados (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras,
 data date NOT NULL, valor_centavos bigint NOT NULL CHECK(valor_centavos>=0), origem text NOT NULL DEFAULT 'usuario' CHECK(origem='usuario')
);
CREATE TABLE financeiro.regras_liberacao (
 pagamento text PRIMARY KEY, dias integer NOT NULL CHECK(dias BETWEEN 0 AND 365)
);
CREATE TABLE financeiro.contas_receber (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, origem text NOT NULL CHECK(origem IN ('hotmart','manual')),
 transacao text UNIQUE REFERENCES financeiro.vendas, descricao text NOT NULL,
 valor_centavos bigint NOT NULL CHECK(valor_centavos>0), previsto_em date,
 status text NOT NULL DEFAULT 'estimado' CHECK(status IN ('estimado','recebido','cancelado')),
 conta_financeira_id bigint NOT NULL REFERENCES financeiro.contas_financeiras
);
CREATE INDEX lancamentos_conta_data_idx ON financeiro.lancamentos(conta_financeira_id,data);
