# 22 - Monorepo e monólito modular no MVP

Criada/atualizada em 2026-11-06. Stack: Node 24.22.x, TypeScript 5.9.3,
pnpm 12.15.0 e Python 3.13 (mínimo 3.12). Pré-requisitos: lessons 02, 03 e 21.

## Objetivo e modelo mental

Entender por que um repositório pode conter vários executáveis sem transformar cada
domínio em um serviço. A [limpeza do MVP](../documentacoes/transversal/2026-11-06-limpeza-monorepo-mvp.md)
aplica isso ao código existente.

Monorepo organiza código/ferramentas. Monólito modular organiza uma aplicação em
módulos no mesmo processo. Serviços separados têm execução/operação próprias.
São escolhas independentes.

## Do módulo ao processo

Um módulo pode exportar comportamento sem abrir um servidor. Este exemplo TypeScript
autocontido executa com `node exemplo.ts` no Node 24:

```ts
export function saldo(entradas: number, saidas: number): number {
  return entradas - saidas;
}

console.log(saldo(15000, 4000)); // 11000 centavos
```

No projeto, os módulos NestJS concentram regras e a fila durável na API. O CFO tem
código Python, dependências e limites próprios, por isso permanece como serviço.
Quatro servidores que só respondiam probes foram retirados.

## Workspace e limites

`pnpm-workspace.yaml` descobre aplicações/pacotes TS em `apps/*` e `packages/*`.
`pyproject.toml` descobre serviço/pacotes Python; `uv.lock` registra os membros.
Excluir um componente exige atualizar também lockfile, launcher, Compose e checks.

Pacotes compartilhados não importam seus consumidores. Assim, contratos podem ser
usados por várias aplicações sem depender delas. A lesson 02 e suas fixtures
negativas mostram como os gates fiscalizam isso.

## Verificar e decidir

Após preparar o ambiente, na raiz:

```sh
make build
make test
make lint
make contracts-check
```

Integrações só podem acessar os ambientes isolados autorizados em `AGENTS.md`.
Build não comprova isolamento entre clientes nem substitui aceite visual.
Menos processos simplificam desenvolvimento, mas compartilham recursos e
disponibilidade. Uma fronteira de segurança ou escala medida pode justificar
separação. Não mova código que exige isolamento apenas para reduzir pastas.

Exercícios: qual comportamento um novo serviço executa? Por que precisa de processo
próprio? Quais consumidores, permissões e checks mudam ao removê-lo?
