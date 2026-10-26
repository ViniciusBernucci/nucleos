# 11 - Drift e compatibilidade de contratos

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26. Exemplos testados com Node 24.22.1, TypeScript 5.9.3 e Python 3.13. Numeracao PROVISORIA.

## Objetivo, pre-requisitos e posicao

Garantir que (a) o codigo gerado nunca fique defasado do schema (**drift**) e (b) uma mudanca de schema nao quebre consumidores existentes (**compatibilidade**). Pre-requisitos: lesson [10](10%20-%20Contratos%20JSON%20Schema%20entre%20TypeScript%20e%20Python.md) e [02](02%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md). Posicao: bloco 8 (Testes e CI).

## Modelo mental

- Drift: `make contracts-check` gera tudo em diretorio temporario e compara byte a byte com o versionado; arquivo alterado, **novo** ou **obsoleto** falha. O job `contracts-drift` ainda confere `git status` de `packages/`.
- Compatibilidade: o schema novo deve aceitar todo documento do **baseline** (`packages/contracts/baseline`, ultima versao liberada). Campo opcional novo = minor; remocao, campo obrigatorio novo, enum reduzido, limite mais estrito = major. Na duvida (if/then novo) a analise e conservadora.

## Exemplo executavel

```js
// node exemplo.mjs (a partir de packages/contracts)
import { incompatibilidades } from "./scripts/compat.mjs";
const v1 = { type: "object", required: ["a"], properties: { a: { type: "string", maxLength: 10 } } };
const v2 = { ...v1, required: ["a", "b"], properties: { ...v1.properties, b: { type: "string" } } };
console.log(incompatibilidades(v1, v2)); // [ '#: campo passou a ser obrigatorio (b)' ]
```

Fluxo: edite o schema, suba `x-schema-version` (e `schema_version` const), rode `make contracts-gen && make contracts-check`; apos liberar a versao, `make contracts-baseline`. Entrega: [documentacao FND-003](../documentacoes/contratos/2026-10-26-fnd-003-contratos-ts-python.md).

## Erros comuns e limites

- Subir so o patch/minor numa mudanca incompativel: o check exige major.
- Esquecer de commitar os gerados: o CI falha com a lista de arquivos.
- O baseline so cobre compatibilidade de **leitura** (documento antigo aceito pelo novo); coexistencia de duas versoes em producao e decisao do ticket do contrato.

## Verificacao e exercicios

`packages/contracts/scripts/compat.test.mjs` e `gerar.test.mjs`. Exercicios: (1) torne `maxLength` menor e observe a mensagem; (2) por que remover um valor de `enum` e incompativel para quem le, mas relaxar e seguro?
