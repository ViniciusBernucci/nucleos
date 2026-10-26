# 02 - CI bloqueante e cadeia de suprimentos

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26. Exemplos testados com Node 24.22.1 (TypeScript executado por remocao de tipos nativa), TypeScript 5.9.3 (tipos conferidos pelo `tsc` do repositorio) e Python 3.13 (somente comandos `uv`); YAML do GitHub Actions validado com `actionlint` 1.7.12.

## Objetivo, pre-requisitos e posicao

Entender como um pipeline de CI deixa de ser "um aviso" e vira um **controle**: checks obrigatorios, permissoes minimas, acoes fixadas por hash e scanners que falham a build. Pre-requisitos: Git e `make`; nocoes de `pnpm`/`uv`. Posicao: bloco 8 (Testes e CI) e bloco 7 (seguranca) do [indice](README.md); vem depois das lessons de seguranca de sessao porque reaproveita a ideia "nao confie em quem apresenta, verifique".

## Modelo mental

- Hook local e conveniencia; **CI e o controle** (o hook pode ser ignorado com `LEFTHOOK=0`). Por isso os mesmos alvos `make` rodam nos dois lugares.
- Um check so protege se a **branch protection** o exigir: sem isso o job vermelho e apenas informativo.
- O workflow e codigo executado com a identidade do repositorio. Superficie de ataque: acoes de terceiros (tag mutavel), `pull_request_target` (segredos para codigo de fork), expressoes `${{ github.event... }}` em `run:` (injecao de script), `GITHUB_TOKEN` com escrita e `curl | sh`.
- Defesa: `permissions: contents: read`, acoes por SHA de 40 hex, nenhum segredo, binarios baixados com versao e SHA-256 conferidos.

## Do minimo ao padrao do projeto

Minimo (funciona, mas inseguro):

```yaml
on: pull_request_target        # roda codigo de fork COM segredos
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4   # tag mutavel
      - run: make lint
```

Padrao do projeto (resumo de `.github/workflows/ci.yml`):

```yaml
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  lint-ts:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: make lint-ts
```

## Exemplo executavel: verificando a politica

`politica.ts` (salve e rode com `node politica.ts`; usa apenas a biblioteca padrao):

```ts
import assert from "node:assert/strict";

/** Uma acao de terceiros so e aceita se fixada por SHA completo de commit. */
export function acaoFixadaPorSha(uses: string): boolean {
  if (uses.startsWith("./")) return true; // acao local do proprio repositorio
  return /@[0-9a-f]{40}$/.test(uses);
}

assert.equal(acaoFixadaPorSha("actions/checkout@v4"), false);
assert.equal(acaoFixadaPorSha("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"), true);
assert.equal(acaoFixadaPorSha("./.github/actions/preparar"), true);
console.log("politica OK");
```

A versao completa (permissoes, `pull_request_target`, segredos, injecao, `curl | sh`, timeouts e jobs obrigatorios) esta em `scripts/ci/verificar-workflows.mjs`, com fixtures que DEVEM falhar em `tools/qualidade/regressao-ci/` (`make ci-regressao`).

## Erros comuns e trade-offs

- Fixar por SHA exige atualizar manualmente (ou com bot) e registrar a versao/data da consulta no comentario; o ganho e que uma tag movida nao injeta codigo.
- `pull_request` de fork nao recebe segredos: testes que precisam de segredo real nao rodam la; use servicos efemeros com senhas geradas na hora (`scripts/ci/servicos-auxiliares.sh`).
- Scanner que nunca falha nao e controle. Teste o gate com uma violacao sintetica (segredo, dependencia vulneravel, Dockerfile ruim).
- Excecao de vulnerabilidade sem prazo vira divida permanente: exija id, motivo e `ignoreUntil` (`osv-scanner.toml`).
- Nao se aplica: pipelines de deploy com credenciais — la prefira OIDC de curta duracao em vez de segredo de longa duracao.

## Verificacao e exercicios

Verificacao (na raiz do repositorio, com `actionlint` instalado): `make lint-workflows && make ci-regressao`.

1. Remova `persist-credentials: false` de um job: o que o `GITHUB_TOKEN` passa a permitir em passos posteriores?
2. Por que `echo "${{ github.event.pull_request.title }}"` em `run:` e perigoso? Reescreva usando uma variavel de ambiente.
3. Qual a diferenca entre falhar em "qualquer severidade" (osv-scanner) e em "high ou acima" (`pnpm audit`)? Quando cada uma faz sentido?

## Ligacao com a entrega real

Documento da entrega: [FND-005 — CI bloqueante](../documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md).
