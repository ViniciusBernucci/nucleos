-- 0003: busca textual (expand): coluna gerada tsvector + GIN. Aditiva, compativel com codigo anterior.
ALTER TABLE documento
    ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('portuguese', coalesce(titulo, '') || ' ' || coalesce(conteudo, ''))
    ) STORED;
CREATE INDEX documento_tsv_gin_idx ON documento USING gin (tsv);
