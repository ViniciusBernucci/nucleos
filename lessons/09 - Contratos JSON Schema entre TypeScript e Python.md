# 09 - Contratos JSON Schema entre TypeScript e Python

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26. Exemplos testados com Node 24.22.1, TypeScript 5.9.3 (ajv 8.20.0) e Python 3.13 (jsonschema 4.26.0, pydantic 2.13.5). Numeracao PROVISORIA (o coordenador reconcilia com a trilha).

## Objetivo, pre-requisitos e posicao

Entender por que o Nucleos tem **uma fonte unica** de contratos (JSON Schema 2020-12 em `packages/contracts/schemas`) e como TypeScript (NestJS/Next.js) e Python (servicos de IA) a consomem sem divergir. Pre-requisitos: tipos em TypeScript e Python; JSON. Posicao: bloco 1/3 (TypeScript e Python) aplicado a seguranca de fronteiras (bloco 7).

## Modelo mental

- O schema e a lei; tipos TS, modelos Pydantic e cliente do SDK sao **derivados** (gerados, commitados, marcados "GERADO - NAO EDITAR").
- Tipo gerado e documentacao em tempo de compilacao; **validacao em runtime** na fronteira e o controle. Por isso `additionalProperties: false` rejeita campos inesperados (ex.: `tenant_id` em `ToolCallRequest`).
- Dois motores (ajv e jsonschema) so dao o mesmo resultado se as diferencas conhecidas forem fechadas. Exemplos compartilhados em `packages/contracts/exemplos/<schema>/(validos|invalidos)` rodam nas duas linguagens.

## Do exemplo minimo ao padrao do projeto

Python (`uv run python x.py`):

```python
import re
from jsonschema import Draft202012Validator

schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object", "additionalProperties": False, "required": ["tenant_id"],
    "properties": {"tenant_id": {"type": "string", "pattern": "^[a-z0-9-]+$"}},
}
print(Draft202012Validator(schema).is_valid({"tenant_id": "acme\n"}))  # True (!)
print(bool(re.search(r"^[a-z0-9-]+\Z", "acme\n")))                    # False
```

TypeScript (ESM, `pnpm add ajv@8.20.0`):

```ts
import { Ajv2020 } from "ajv/dist/2020.js";
const validate = new Ajv2020({ strict: true }).compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object", additionalProperties: false, required: ["tenant_id"],
  properties: { tenant_id: { type: "string", pattern: "^[a-z0-9-]+$" } },
});
console.log(validate({ tenant_id: "acme\n" })); // false
```

A mesma entrada `"acme\n"` e aceita em Python e rejeitada em ECMA-262: `$` do Python casa antes da quebra de linha final. O pacote corrige isso em `nucleos_contracts.validation` (busca como ECMA, `$` -> `\Z`). `\s` tambem difere entre os motores (`U+0085`, `U+001C`, `U+FEFF`); por isso os patterns usam classes ASCII explicitas e um teste varre todos os codepoints BMP de todo `pattern` comparando `node` e Python. Outra divergencia fechada: `format: date-time` e definido por nos (RFC 3339 estrito) nas duas linguagens, com a mesma tabela de casos (`exemplos/date-time.json`).

Padrao do projeto: `make contracts-gen` gera tipos TS, modelos Pydantic (`datamodel-code-generator`) e o cliente do SDK; `validate(nome, dado)` (TS) e `validate(nome, dado)` (Python) aplicam o schema; regras entre campos que o schema nao expressa (ex.: `sub == "runtime:" + tenant_id`, TTL <= 600 s) ficam em `runtimeTokenSemanticErrors` / `runtime_token_semantic_errors`. Entrega: [documentacao FND-003](../documentacoes/contratos/2026-10-26-fnd-003-contratos-ts-python.md).

## Erros comuns e limites

- Confiar no modelo Pydantic gerado como validador: ele nao traduz `if/then`, `uniqueItems`, `not`, `propertyNames` nem o formato estrito de data (lista fechada em `tests/test_contratos.py`). Validacao autoritativa = JSON Schema.
- Editar arquivo gerado a mao (o drift check falha).
- Schema sem exemplos invalidos: nada prova que o contrato rejeita o que deve.
- Nao se aplica a contratos internos de um unico processo (use so tipos).

## Verificacao e exercicios

`make test`  e `make contracts-check`. Exercicios: (1) adicione o exemplo invalido `"tenant_id": "ACME"` a um schema e veja os dois lados rejeitarem; (2) por que `additionalProperties: false` e um controle de seguranca e nao so estilo? (3) qual a consequencia de aceitar `2026-12-31T23:59:60Z` num lado e rejeitar no outro?
