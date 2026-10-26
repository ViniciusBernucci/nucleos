# 03 - Isolamento de telemetria por tenant

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26.
Versoes dos exemplos: Node 24.22.1, TypeScript 5.9.3, Python 3.13.17 (o exemplo tambem roda em 3.9+).

## Objetivo, pre-requisitos e posicao na trilha

Entender como logs e traces de varios clientes (tenants) ficam no mesmo armazenamento sem que um
cliente consulte o dado de outro. Bloco 7 (seguranca). Pre-requisitos: HTTP e headers, a lesson
[01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md) (identidade vem de uma
credencial verificada) e nocoes de Docker/Compose. A redacao de campos em logs (FND-009) e conceito
vizinho, ainda sem lesson publicada: nao e repetida aqui.

## Modelo mental

Loki e Tempo separam dados pelo header `X-Scope-OrgID` (o "org id" e o tenant). O backend **confia**
no header: quem o escreve decide de quem e o dado. Se o navegador ou um servico de tenant puder
escrever esse header, o isolamento acabou. Regra: um **gateway** confiavel deriva o tenant da
credencial, **descarta** o header do cliente e escreve o valor verdadeiro. O backend nunca e
publicado diretamente.

## Conexao com a entrega real

PoC do ENT-DEC-010 (ADR-024, **Proposto**): ver
[o registro](../documentacoes/observabilidade/2026-10-26-dec-010-telemetria.md) e o
[ADR-024](../documentacoes/arquitetura/adr/0024-stack-de-telemetria-e-politica-de-reducao-retencao.md).
O gateway nginx do PoC mapeia token -> tenant e a prova mede que o tenant A, mesmo forjando
`X-Scope-OrgID: tenant-b`, so enxerga o proprio dado.

## Exemplo minimo executavel (Python)

```python
"""Gateway minimo: o tenant vem do token, nunca de header do cliente."""

import hmac

TOKENS = {"token-do-a": "tenant-a", "token-do-b": "tenant-b"}  # exemplo; em producao vem do cofre


def tenant_do_pedido(headers: dict[str, str]) -> str | None:
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    candidato = auth.removeprefix("Bearer ")
    for token, tenant in TOKENS.items():
        if hmac.compare_digest(candidato, token):
            return tenant
    return None


def headers_para_o_backend(headers: dict[str, str]) -> dict[str, str] | None:
    tenant = tenant_do_pedido(headers)
    if tenant is None:
        return None  # 401
    # Descarta qualquer X-Scope-OrgID do cliente e o credencial; escreve o valor confiavel.
    return {"X-Scope-OrgID": tenant}


assert headers_para_o_backend({"Authorization": "Bearer token-do-a"}) == {"X-Scope-OrgID": "tenant-a"}
forjado = {"Authorization": "Bearer token-do-a", "X-Scope-OrgID": "tenant-b"}
assert headers_para_o_backend(forjado) == {"X-Scope-OrgID": "tenant-a"}
assert headers_para_o_backend({"X-Scope-OrgID": "tenant-b"}) is None
print("ok")
```

Salve como `gateway.py` e rode `python3 gateway.py`; deve imprimir `ok`.

## Do minimo ao padrao do projeto

1. Minimo: funcao pura token -> tenant (acima), com teste de header forjado.
2. Padrao do projeto: o mesmo comportamento no proxy (nginx `map` + `proxy_set_header`), rotas
   permitidas por allowlist (so `push`, `query_range`, `labels`...; nada de `/config` ou delecao),
   backend sem porta publicada, consulta de admin multi-tenant em papel separado e auditada.
3. Dado ja redigido na origem (allowlist de campos): isolamento nao substitui redacao.

## Erros comuns e trade-offs

- Confiar em header vindo do cliente, ou publicar a porta do backend (o header passa a valer sem gateway).
- Comparar token com `==` (use comparacao em tempo constante) e registrar o token em log.
- Assumir que todo componente isola: Prometheus nao tem tenant nativo neste desenho; metricas ficam
  sem rotulo de tenant (cardinalidade) e dado por tenant vai para logs/traces/banco.
- Nao se aplica quando ha um unico tenant ou quando cada tenant tem seu proprio backend (mais
  isolamento, mais RAM).

## Verificacao e exercicios

- Verificacao: `infrastructure/docker/poc-telemetria/run-poc.sh` (containers descartaveis em
  127.0.0.1; exige Docker, `uv`, `openssl`) e a saida registrada no documento da entrega.
- Exercicio 1: acrescente ao exemplo um token de admin que devolve varios tenants e escreva o teste.
- Exercicio 2: por que o gateway tambem remove `Authorization` antes de falar com o backend?
- Exercicio 3: o que mudaria se o gateway fosse contornado por um container na mesma rede?
