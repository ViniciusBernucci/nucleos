-- Seed FICTICIO e DETERMINISTICO do ambiente de desenvolvimento (FND-004).
-- Executado pelo entrypoint da imagem apenas em volume vazio (veja scripts/reset.sh).
-- Nunca colocar dados reais aqui. Esquema definitivo/migracoes: DAT-001.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS dev_seed;

CREATE TABLE dev_seed.organizacoes (
  id        uuid PRIMARY KEY,
  slug      text NOT NULL UNIQUE,
  nome      text NOT NULL,
  embedding vector(3) NOT NULL
);

INSERT INTO dev_seed.organizacoes (id, slug, nome, embedding) VALUES
  ('00000000-0000-4000-8000-000000000001', 'org-exemplo-a', 'Organizacao Ficticia A', '[0.1,0.2,0.3]'),
  ('00000000-0000-4000-8000-000000000002', 'org-exemplo-b', 'Organizacao Ficticia B', '[0.3,0.2,0.1]'),
  ('00000000-0000-4000-8000-000000000003', 'org-exemplo-c', 'Organizacao Ficticia C', '[0.9,0.0,0.1]');
