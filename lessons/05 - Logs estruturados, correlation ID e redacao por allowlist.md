# 05 - Logs estruturados, correlation ID e redacao por allowlist

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26.
Versoes dos exemplos: Node 24.22.1 (TypeScript executado por remocao de tipos nativa), TypeScript 5.9.3 (tipos conferidos com `tsc --strict`), Python 3.13.17; pino 10.4.0 e structlog 26.1.0. Exemplos executados em 2026-10-26 na raiz do repositorio apos `make setup && make build`.

## Objetivo, pre-requisitos e posicao na trilha

Entender como um servico emite logs que ajudam a investigar um incidente **sem virar vazamento de dado**: JSON com campos fixos, um identificador que acompanha a requisicao (correlation ID), redacao por lista de permissao (allowlist) e a regra de confianca da borda (`trustEdge`). Pre-requisitos: HTTP e headers, `unknown`/tipos em TypeScript, tipagem em Python, e a nocao de "nao confie em quem apresenta" da lesson [01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md). Posicao: bloco 7 (seguranca) aplicado a observabilidade. Vem **antes** de [06 - Isolamento de telemetria por tenant](06%20-%20Isolamento%20de%20telemetria%20por%20tenant.md): la se supoe que o dado ja chega **redigido na origem**; esta lesson ensina como.

## Modelo mental

- **Log estruturado** = um objeto JSON por evento, com chaves previsiveis (`event`, `service`, `correlation_id`...). Maquina filtra; humano nao precisa de regex.
- **Correlation ID** = um numero de protocolo da requisicao. Todo log, span e job dela leva o mesmo valor; assim se reconstroi o caminho HTTP -> fila -> worker.
- **Redacao por allowlist** = o oposto de "esconder o que sei que e sensivel" (denylist, que falha para o campo novo). Aqui so passa o que foi **explicitamente permitido**; o resto e descartado. Um nome de campo tambem pode carregar dado (`cpf_123...`), por isso o campo desconhecido some inteiro (nome e valor) e apenas e contado em `_dropped`.
- **trustEdge** = "posso acreditar no `X-Request-Id` que chegou?" So se a borda (proxy) que o define for confiavel. Padrao: **nao**; sem isso o cliente escolhe o ID que aparece no seu log (injecao de linha, falsificacao de trilha).
- **Fail-open sem dados**: se a redacao falhar, o log sai com `"[REDACTION_ERROR]"`, nunca com o dado cru nem derrubando o servico.

## Conexao com a implementacao real

Entrega ENT-FND-009: [registro](../documentacoes/observabilidade/2026-10-25-fnd-009-baseline-observabilidade.md). Duas bibliotecas com a mesma semantica:

- `packages/observability` (`@nucleos/observability`, TypeScript, pino): `createLogger`, `redact`, `resolveCorrelationId`, `runWithContext` (via `AsyncLocalStorage`), `observeHttp`, `handleProbe`.
- `packages/observability-py` (`nucleos-observability`, Python, structlog): `Logger`, `redact`, `resolve_correlation_id`, `use_context` (via `contextvars`), `make_handler`.

Campos fixos em todo log: `ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event` (ausentes viram `null`) mais `data` redigido. `tenant_id` so entra por `setTrustedTenant`/`set_trusted_tenant` (fonte confiavel, ex.: token validado); nunca de header. O log HTTP contem so metodo, template de rota, status e duracao: nunca header, query nem corpo. `X-Request-Id` so e aceito com `trustEdge` ligado (padrao `false`, ate FND-007 definir a borda) **e** se casar `^[A-Za-z0-9._-]{8,128}$` por inteiro (em Python, `fullmatch`; evita `"abcdefgh\n"` e CRLF); senao e gerado um UUID v4.

Regras de `redact` (resumo; fonte: `packages/observability/src/redact.ts` e `redact.py`): dado de topo so objeto simples; chave sensivel (`authorization`, `cookie`, `password`, `token`, `secret`, `prompt`, `content`, `api_key`, e padrao mais amplo) vira `[REDACTED]`; chave fora da allowlist e descartada e contada em `_dropped`; **string so passa se a chave tiver regra declarada** (RegExp que casa o valor inteiro, ou `FREE`/`"free"` como opt-in explicito); numero, booleano e `null` passam; strings ainda sao limpas de `Bearer ...`, JWT e `password=...` **antes** de truncar em 256 caracteres; profundidade 4, ate 20 itens; `Error` vira apenas o nome.

## Exemplo executavel 1 - TypeScript

Salve como `packages/observability/exemplo-lesson.ts` (depois de `make build`) e rode `node packages/observability/exemplo-lesson.ts` a partir da raiz (com Node 24.22.1 no `PATH`):

```ts
import assert from "node:assert/strict";
import { createLogger, redact, resolveCorrelationId, runWithContext } from "./dist/index.js";

const linhas: string[] = [];
const logger = createLogger({
  service: "demo",
  version: "0.0.0",
  env: "dev",
  allowlist: ["tentativas"], // lista de nomes: so numero/booleano passam
  destination: { write: (linha) => linhas.push(linha) },
});

// 1) Allowlist: chave desconhecida some; sensivel vira [REDACTED]; string exige regra.
const saida = redact(
  {
    tentativas: 3,
    cpf: "123.456.789-09", // fora da allowlist: descartado (nome e valor)
    authorization: "Bearer abc.def.ghi",
    route: "/pedidos/{id}",
  },
  { tentativas: undefined, route: /^\/[A-Za-z0-9_\-./:{}]*$/ },
);
assert.deepEqual(saida, {
  tentativas: 3,
  authorization: "[REDACTED]",
  route: "/pedidos/{id}",
  _dropped: 1,
});

// 2) Correlation ID: header do cliente so vale com trustEdge=true e formato seguro.
assert.notEqual(resolveCorrelationId("meu-id-12345"), "meu-id-12345");
assert.equal(resolveCorrelationId("meu-id-12345", true), "meu-id-12345");
assert.notEqual(resolveCorrelationId("ruim\r\nX: 1", true), "ruim\r\nX: 1");

// 3) Log JSON com o contexto da requisicao.
runWithContext({ correlationId: "req-0000001", actorType: "anonymous" }, () => {
  logger.log("info", "pedido.criado", { tentativas: 1, senha: "x" });
});
const registro = JSON.parse(linhas[0] ?? "{}") as Record<string, unknown>;
assert.equal(registro["correlation_id"], "req-0000001");
assert.equal(registro["tenant_id"], null);
assert.deepEqual(registro["data"], { tentativas: 1, _dropped: 1 });
console.log("ok", linhas[0]);
```

Saida real (uma linha, quebrada aqui so para leitura): `ok {"level":"info","ts":"...","service":"demo","version":"0.0.0","env":"dev","trace_id":null,"span_id":null,"correlation_id":"req-0000001","tenant_id":null,"actor_type":"anonymous","data":{"tentativas":1,"_dropped":1},"event":"pedido.criado"}`. `tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2023 --skipLibCheck --types node` sobre o arquivo sai com 0. Apague o arquivo ao terminar.

## Exemplo executavel 2 - Python

Salve como `packages/observability-py/exemplo_lesson.py` e rode `uv run --frozen python packages/observability-py/exemplo_lesson.py` na raiz:

```python
import io
import json
import re

from nucleos_observability import (
    FREE,
    Logger,
    RequestContext,
    redact,
    resolve_correlation_id,
    use_context,
)

# 1) Allowlist: desconhecida some; sensivel vira [REDACTED]; Bearer removido de string livre.
saida = redact(
    {
        "tentativas": 3,
        "cpf": "123.456.789-09",
        "authorization": "Bearer abc.def.ghi",
        "mensagem": "falhou com Bearer abc.def.ghi",
        "route": "/pedidos/{id}",
    },
    {
        "tentativas": None,
        "mensagem": FREE,
        "authorization": None,
        "route": re.compile(r"/[A-Za-z0-9_\-./:{}]*"),
    },
)
assert saida == {
    "tentativas": 3,
    "authorization": "[REDACTED]",
    "mensagem": "falhou com [REDACTED]",
    "route": "/pedidos/{id}",
    "_dropped": 1,
}, saida

# 2) Correlation ID: header do cliente so vale com trust_edge=True e formato seguro.
assert resolve_correlation_id("meu-id-12345") != "meu-id-12345"
assert resolve_correlation_id("meu-id-12345", trust_edge=True) == "meu-id-12345"
assert resolve_correlation_id("ruim\r\nX: 1", trust_edge=True) != "ruim\r\nX: 1"

# 3) Log JSON com contexto.
stream = io.StringIO()
logger = Logger("demo", "0.0.0", "dev", allowlist=("tentativas",), stream=stream)
with use_context(RequestContext(correlation_id="req-0000001")):
    logger.log("info", "pedido.criado", {"tentativas": 1, "senha": "x"})
registro = json.loads(stream.getvalue())
assert registro["correlation_id"] == "req-0000001"
assert registro["tenant_id"] is None
assert registro["data"] == {"tentativas": 1, "_dropped": 1}
print("ok", stream.getvalue().strip())
```

Imprime `ok {"ts": "...", "level": "info", "service": "demo", ..., "correlation_id": "req-0000001", "tenant_id": null, "actor_type": "anonymous", "event": "pedido.criado", "data": {"tentativas": 1, "_dropped": 1}}`. `mypy --strict` sobre o arquivo: "Success: no issues found". (Os exemplos usam `assert` para serem autoverificaveis; por isso nao entram no `ruff` do projeto, que proibe `assert` fora de `tests/` — regra `S101`.) Apague o arquivo ao terminar.

## Do minimo ao padrao do projeto

1. Minimo: `console.log(JSON.stringify({ event, ...dados }))` — estruturado, mas vaza tudo que o chamador passar.
2. Logger com campos fixos (pino/structlog), nivel e `service/version/env`.
3. Contexto de requisicao (`AsyncLocalStorage`/`contextvars`) para `correlation_id`, `trace_id`, `tenant_id` sem passar parametros.
4. Redacao por allowlist com regra por chave; limites de profundidade/tamanho; scrub antes de truncar.
5. Propagacao: `correlationHeaders()` para chamadas de saida e `JobEnvelope.correlation_id` com `runJob`, que restaura o ID no worker.
6. Metricas RED com labels enumerados (`method`, `route` como **template**, `status_class`): `correlation_id` e `tenant_id` nao entram em metrica (cardinalidade explosiva). `createBusinessCounter` rejeita esses labels.
7. Sondas `/healthz` e `/readyz` com corpo minimo (`{status, service}`), sem versao nem nome de dependencia.

## Erros comuns e trade-offs

- Denylist ("remova senha e token"): o campo novo `cpf` passaria. Prefira allowlist; o custo e declarar campos novos.
- Aceitar `X-Request-Id` do cliente por padrao: permite falsificar a trilha e injetar quebras de linha. Valide formato e confie so na borda conhecida.
- Logar `req.headers`, query ou corpo "so para debug": e exatamente o vazamento que a regra evita.
- Rota crua (`/clientes/123`) como label ou campo: usar o **template** (`/clientes/{id}`).
- `time.sleep` em teste para "esperar o log": a correcao real foi registrar o log **antes** de enviar a resposta (corrida encontrada pelo QA, registro rodada 2).
- Strings livres (`FREE`) devolvem a responsabilidade ao chamador; use com parcimonia.
- Redacao nao e isolamento entre tenants: o dado redigido ainda precisa de separacao no backend (lesson 06).
- Nao se aplica: logs de depuracao locais descartaveis que nunca saem da maquina; ainda assim nao os versione.

## Verificacao e exercicios

- Verificacao no repositorio: `pytest packages/observability-py` via `uv run --frozen pytest packages/observability-py -q` (14 passed em 2026-10-26) e `pnpm --filter @nucleos/observability test`; ambos incluem testes de propriedade com semente fixa (500 casos por linguagem).
- Exercicio 1: acrescente `"cliente_id"` com regra `^[0-9a-f-]{36}$` na allowlist e mostre que um valor fora do formato vira `[REDACTED]`.
- Exercicio 2: por que o `Error` vira apenas o nome (`{"name": "TypeError"}`) e nunca a `message`?
- Exercicio 3: monte um `JobEnvelope` com `createJobEnvelope` dentro de um `runWithContext` e confirme que `runJob` restaura o mesmo `correlation_id`.
- Exercicio 4: qual atributo seria inaceitavel como label de metrica e por que?
