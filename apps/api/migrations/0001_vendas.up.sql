-- Painel de vendas (setor Financeiro): vendas da Hotmart e estado da sincronizacao.
-- Forward-only (ADR-017). Nao guarda e-mail nem nome do comprador: so um pseudonimo HMAC.
CREATE SCHEMA IF NOT EXISTS financeiro;

CREATE TABLE financeiro.vendas (
  transacao       text PRIMARY KEY,
  produto_id      text        NOT NULL,
  produto_nome    text        NOT NULL,
  comprador_id    text        NOT NULL,
  status          text        NOT NULL,
  grupo           text        NOT NULL CHECK (grupo IN ('receita', 'reembolso', 'cancelada', 'pendente')),
  pedido_em       timestamptz NOT NULL,
  aprovado_em     timestamptz,
  valor_centavos  bigint      NOT NULL CHECK (valor_centavos >= 0),
  taxa_centavos   bigint      NOT NULL DEFAULT 0 CHECK (taxa_centavos >= 0),
  moeda           char(3)     NOT NULL,
  pagamento       text        NOT NULL,
  parcelas        integer     NOT NULL DEFAULT 1 CHECK (parcelas >= 1),
  assinatura      boolean     NOT NULL DEFAULT false,
  recorrencia     integer     NOT NULL DEFAULT 0 CHECK (recorrencia >= 0),
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendas_pedido_em_idx ON financeiro.vendas (pedido_em);
CREATE INDEX vendas_produto_pedido_idx ON financeiro.vendas (produto_id, pedido_em);

-- Linha unica (id = 1) com o estado da ultima sincronizacao.
CREATE TABLE financeiro.sincronizacao_estado (
  id                      smallint    PRIMARY KEY CHECK (id = 1),
  status                  text        NOT NULL
    CHECK (status IN ('nunca', 'em_andamento', 'sucesso', 'parcial', 'falha')),
  ultima_tentativa_em     timestamptz,
  ultimo_sucesso_em       timestamptz,
  ultima_reconciliacao_em timestamptz,
  vendas_processadas      integer     NOT NULL DEFAULT 0,
  mensagem                text
);

INSERT INTO financeiro.sincronizacao_estado (id, status) VALUES (1, 'nunca');
