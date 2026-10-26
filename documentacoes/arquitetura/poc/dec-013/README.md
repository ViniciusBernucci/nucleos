# PoC DEC-013 — papéis PostgreSQL por tenant (descartável)

Verifica os privilégios do ADR-025 (`owner`, `migrator`, `app`, `tools`) em um PostgreSQL 16 efêmero. Dois tenants sintéticos (`ta`, `tb`), um banco de controle sintético, sem dados reais, **sem porta publicada** (acesso só por `docker exec`), senhas aleatórias geradas na execução e nunca impressas. O container é destruído ao final (`trap`).

```bash
export PATH="$HOME/.local/bin:$PATH"
cd documentacoes/arquitetura/poc/dec-013
./run.sh | tee evidencia/saida.txt     # exit 0 = todas as verificações passaram
```

Requer Docker e a imagem `postgres:16-alpine` (variável `PG_IMAGE` para trocar). Os papéis de tenant conectam pelo IP do container porque o `pg_hba.conf` da imagem usa `trust` no loopback; um controle de senha errada prova que a autenticação é de fato verificada.

Cobertura (56 verificações): escopo de `app` e `tools` por esquema, append-only na auditoria, `migrator` só via `SET ROLE owner`, negação de conexão cruzada (SEC-02), ao banco de controle (SEC-03), a `postgres` e `template1`, atributos dos papéis, `statement_timeout`, `CONNECTION LIMIT` (3ª conexão do `migrator` falha), `REVOKE ALL ON SCHEMA public` (PUBLIC sem `USAGE`, diferente do padrão do PG 16), `ALTER DEFAULT PRIVILEGES` (função nova do owner não executável por `app`), e uma fase com provisioner **sem superuser** (`SET` no owner, bootstrap de `datacl`). `expect_deny` exige a mensagem esperada (`permission denied`, `password authentication failed` ou a específica do caso), então erro de sintaxe não conta como negação. Limites: não testa `pg_hba`, pgvector, RLS, carga nem a Tenant API.

Achados: (1) `postgres` e `template1` aceitam `CONNECT` de `PUBLIC` por padrão; a revogação exige superuser (bootstrap) e o ADR-025 passa a exigir a verificação de `datacl` em DAT-001. (2) A revogação deixa o provisioner sem acesso ao banco `postgres`; o bootstrap lhe concede `CONNECT`. (3) `CREATE DATABASE ... OWNER` pelo provisioner exige `SET` no owner.
