# PoC DEC-013 — papéis PostgreSQL por tenant (descartável)

Verifica os privilégios do ADR-025 (`owner`, `migrator`, `app`, `tools`) em um PostgreSQL 16 efêmero. Dois tenants sintéticos (`ta`, `tb`), um banco de controle sintético, sem dados reais, **sem porta publicada** (acesso só por `docker exec`), senhas aleatórias geradas na execução e nunca impressas. O container é destruído ao final (`trap`).

```bash
export PATH="$HOME/.local/bin:$PATH"
cd documentacoes/arquitetura/poc/dec-013
./run.sh | tee evidencia/saida.txt     # exit 0 = todas as verificações passaram
```

Requer Docker e a imagem `postgres:16-alpine` (variável `PG_IMAGE` para trocar). Os papéis de tenant conectam pelo IP do container porque o `pg_hba.conf` da imagem usa `trust` no loopback; um controle de senha errada prova que a autenticação é de fato verificada.

Cobertura: escopo de `app` e `tools` por esquema, append-only na auditoria, `migrator` só via `SET ROLE owner`, negação de conexão cruzada (SEC-02), ao banco de controle (SEC-03), a `postgres` e `template1`, e atributos dos papéis. Limites: não testa `pg_hba`, pgvector, RLS, carga nem a Tenant API.

Achado: `postgres` e `template1` aceitam `CONNECT` de `PUBLIC` por padrão; o PoC revoga e o ADR-025 passa a exigir isso em DAT-001.
