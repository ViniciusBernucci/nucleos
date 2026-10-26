-- 0002: memoria semantica. Requer a extensao "vector" criada pelo provisioner (admin).
CREATE TABLE documento (
    id         uuid PRIMARY KEY,
    titulo     text NOT NULL,
    conteudo   text NOT NULL,
    embedding  vector(3),
    criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documento_embedding_hnsw_idx ON documento USING hnsw (embedding vector_cosine_ops);
