CREATE SCHEMA IF NOT EXISTS marketing;
CREATE TABLE marketing.contas_anuncio (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_externo text NOT NULL UNIQUE, moeda text NOT NULL CHECK(moeda ~ '^[A-Z]{3}$'),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE marketing.campanhas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_anuncio_id bigint NOT NULL REFERENCES marketing.contas_anuncio(id),
 id_externo text NOT NULL, nome text NOT NULL, status text, objetivo text,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_anuncio_id,id_externo)
);
CREATE TABLE marketing.gastos_diarios (
 campanha_id bigint NOT NULL REFERENCES marketing.campanhas(id), dia date NOT NULL,
 gasto_centavos bigint NOT NULL CHECK(gasto_centavos >= 0),
 moeda text NOT NULL CHECK(moeda ~ '^[A-Z]{3}$'),
 impressoes bigint NOT NULL CHECK(impressoes >= 0), cliques bigint NOT NULL CHECK(cliques >= 0),
 compras_meta numeric NOT NULL CHECK(compras_meta >= 0), valor_compras_meta_centavos bigint NOT NULL CHECK(valor_compras_meta_centavos >= 0),
 tipo_compra_meta text, atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campanha_id,dia)
);
CREATE INDEX gastos_diarios_periodo ON marketing.gastos_diarios(dia);
