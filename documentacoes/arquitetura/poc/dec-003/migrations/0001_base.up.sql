-- 0001: tabelas base do tenant (convencoes ADR-017: uuid PK, timestamptz, numeric, text+CHECK).
CREATE TABLE agente (
    id         uuid PRIMARY KEY,
    nome       text NOT NULL,
    status     text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'pausado')),
    criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uso_tokens (
    id          uuid PRIMARY KEY,
    agente_id   uuid NOT NULL REFERENCES agente (id),
    tokens      integer NOT NULL CHECK (tokens >= 0),
    custo_usd   numeric(18, 8) NOT NULL CHECK (custo_usd >= 0),
    criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uso_tokens_agente_criado_idx ON uso_tokens (agente_id, criado_em);
