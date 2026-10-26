# 02 - Qualidade estatica em TypeScript e Python

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26.
Versoes dos exemplos: Node 24.22.1, TypeScript 5.9.3, Python 3.13.17 (ESLint 10.13.0, typescript-eslint 8.72.0, dependency-cruiser 18.7.0, ruff 0.17.2, mypy 2.4.0, import-linter 2.15, gitleaks 8.30.1, lefthook 2.2.2). Todos os comandos abaixo foram executados na raiz do repositorio em 2026-10-26.

## Objetivo, pre-requisitos e posicao na trilha

Entender como o repositorio **faz o computador recusar** codigo ruim antes de qualquer pessoa revisar: tipos que nao deixam `any` escapar, regras de seguranca (`eval`, `shell=True`), fronteiras de arquitetura entre modulos, segredos e convencao de commits. Pre-requisitos: TypeScript basico (tipos, `unknown` vs `any`), Python com anotacoes de tipo, `make`, `pnpm` e `uv` ja instalados (`make setup`). Posicao: blocos 1 e 3 (TypeScript e Python) aplicados a seguranca (bloco 7); vem **antes** de [04 - CI bloqueante e cadeia de suprimentos](04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md), porque o CI apenas repete estes mesmos alvos `make`.

## Modelo mental

Pense em **camadas de funil**, da mais barata para a mais cara:

1. **Editor/formatador** (Prettier, `ruff format`): estilo, sem discussao.
2. **Linter com tipos** (ESLint type-aware, ruff, mypy): acha bugs e padroes inseguros sem executar o programa.
3. **Regras de arquitetura** (dependency-cruiser, import-linter): "quem pode importar quem". Sao testes de design.
4. **Segredos** (gitleaks): impede que credencial entre no historico.
5. **Hook local** (lefthook): roda o essencial antes do commit; e **conveniencia**, nao controle (`LEFTHOOK=0` o ignora). O controle e o CI.

Ideia-chave: um linter que nunca falha nao prova nada. Por isso o repositorio tem um **runner de regressao** (`tools/qualidade/regressao.mjs`) com violacoes propositais que DEVEM ser barradas; se um controle for desligado sem querer, o runner quebra.

## Conexao com a implementacao real

Entrega ENT-FND-002: [registro](../documentacoes/engenharia/2026-10-25-fnd-002-padroes-qualidade-linters-hooks.md). Arquivos:

| Ferramenta | Configuracao | Alvo |
| --- | --- | --- |
| ESLint `strictTypeChecked` + `eslint-plugin-security` | `eslint.config.mjs` | `pnpm run lint:eslint` |
| Prettier | `.prettierrc.json` | `pnpm run format:check` |
| dependency-cruiser | `.dependency-cruiser.cjs` | `pnpm run lint:arch` |
| ruff (inclui bandit `S`) e `mypy --strict` | `pyproject.toml` (`[tool.ruff]`, `[tool.mypy]`) | `make lint-py` |
| import-linter | `.importlinter` | `uv run --frozen lint-imports` |
| gitleaks | `.gitleaks.toml`, `scripts/check-secrets.sh` | `make lint` |
| lefthook | `lefthook.yml` | `make hooks` |
| Regressao dos controles | `tools/qualidade/regressao.mjs` | `make lint-regressao` |

`make lint` encadeia tudo (e `lint-regressao`). Nota real: `ruff` mira `py312` e `mypy` `python_version = "3.12"` (piso suportado), enquanto o ambiente roda Python 3.13.

## Exemplo 1 - TypeScript: do `any` escondido ao `unknown` estreitado

`JSON.parse` devolve `any`. O ESLint type-aware (regras `no-unsafe-*`) enxerga isso porque usa o compilador. Crie `packages/sdk/src/exemplo-lesson.ts` (dentro de um pacote coberto pelo `tsconfig`) e rode `pnpm exec eslint packages/sdk/src/exemplo-lesson.ts`:

```ts
export function lerId(entrada: unknown): string {
  const dado = JSON.parse(String(entrada));
  return dado.id;
}
```

Saida real (exit 1):

```text
  2:9   error  Unsafe assignment of an `any` value         @typescript-eslint/no-unsafe-assignment
  3:3   error  Unsafe return of a value of type `any`      @typescript-eslint/no-unsafe-return
  3:15  error  Unsafe member access .id on an `any` value  @typescript-eslint/no-unsafe-member-access
```

Padrao do projeto: aceitar `unknown` e **estreitar** com verificacoes de tipo. Substitua o arquivo por:

```ts
export function lerId(entrada: string): string {
  const dado: unknown = JSON.parse(entrada);
  if (typeof dado === "object" && dado !== null && "id" in dado && typeof dado.id === "string") {
    return dado.id;
  }
  throw new Error("id ausente");
}
```

`pnpm exec eslint packages/sdk/src/exemplo-lesson.ts` agora sai com 0. Apague o arquivo ao terminar (`rm packages/sdk/src/exemplo-lesson.ts`). Observacao: o `any` **implicito** (parametro sem tipo) e pego pelo `tsc` em modo `strict` (`noImplicitAny`, erro TS7006), nao pelo ESLint; por isso o runner de regressao tem um caso `tsc`.

## Exemplo 2 - Python: ruff (seguranca) e mypy (tipos)

Crie `services/tool-gateway/src/tool_gateway/exemplo_lesson.py`:

```python
import subprocess


def calcula(expr: str):
    return eval(expr)


def roda(cmd: str) -> int:
    return subprocess.call(cmd, shell=True)
```

`uv run --frozen ruff check services/tool-gateway/src/tool_gateway/exemplo_lesson.py` acusa `S307` (uso de `eval`) e `S602` (`shell=True`); `uv run --frozen mypy services/tool-gateway/src/tool_gateway/exemplo_lesson.py` acusa `Function is missing a return type annotation [no-untyped-def]`. Versao aceita:

```python
import ast
import subprocess


def calcula(expr: str) -> object:
    return ast.literal_eval(expr)


def roda(argumentos: list[str]) -> int:
    return subprocess.call(argumentos)  # noqa: S603 - argv fixo, sem shell
```

Resultado verificado: `ruff check` "All checks passed!", `ruff format --check` "1 file already formatted", `mypy` "Success: no issues found in 1 source file". O `# noqa` carrega uma **justificativa**: excecao sem motivo escrito e divida. Remova o arquivo depois. Nota: `mypy --strict` so cobre os pacotes listados em `[tool.mypy] files` (hoje `tool-gateway`, `event-dispatcher` e `tenant-runtime/policy`); servicos entram quando ganham logica.

## Exemplo 3 - Arquitetura de imports

TypeScript (`.dependency-cruiser.cjs`) tem regras como `web-nao-importa-api` e `no-circular`. Prova: crie `apps/web/exemplo-lesson.ts` com `import { x } from "../api/src/exemplo-api.js";` e `apps/api/src/exemplo-api.ts` com `export const x = 1;`, depois `pnpm run lint:arch`. Saida real, exit 2:

```text
  error web-nao-importa-api: apps/web/exemplo-lesson.ts → apps/api/src/exemplo-api.ts
  error apps-nao-importam-outros-apps: apps/web/exemplo-lesson.ts → apps/api/src/exemplo-api.ts
x 2 dependency violations (2 errors, 0 warnings).
```

Python (`.importlinter`) usa contratos. O de independencia diz que os servicos nao se importam. Prova: um arquivo `services/tool-gateway/src/tool_gateway/exemplo_lesson.py` com a linha `import ai_gateway` e `uv run --frozen lint-imports` termina com `Contracts: 1 kept, 1 broken` e `tool_gateway is not allowed to import ai_gateway`. Remova os arquivos criados.

## Exemplo 4 - Segredos e commits

Gere um segredo sintetico **em tempo de execucao** (nunca o escreva no repositorio) e escaneie um diretorio temporario:

```bash
mkdir -p /tmp/gl
printf 'x=ghp_%s\n' "$(head -c 40 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 36)" > /tmp/gl/a.env
gitleaks dir /tmp/gl --config .gitleaks.toml --redact --no-banner; echo "rc=$?"   # leaks found: 1, rc=1
rm -rf /tmp/gl
```

Mensagem de commit (usada pelo hook `commit-msg` e pelo CI): `echo ajustes > /tmp/m; node scripts/check-commit-msg.mjs /tmp/m` falha (rc 1, "mensagem de commit invalida"); `feat(api): x` passa (rc 0).

## Do minimo ao padrao do projeto

1. Minimo: `tsc --strict` e `ruff check`.
2. Camada de tipos nos linters: ESLint `strictTypeChecked` com `projectService`, que le o `tsconfig` real (por isso `lint:eslint` faz `turbo build` dos `packages/*` antes: precisa dos tipos de `@nucleos/contracts`).
3. Fronteiras: dependency-cruiser e import-linter transformam o desenho em regra executavel.
4. Prova dos controles: `make lint-regressao` (18 casos que devem falhar; segredo gerado na hora). Saida real da ultima linha: `Todos os casos de regressao falharam como esperado (controles ativos).`
5. Hook (`make hooks`, explicito porque o diretorio de hooks do Git e compartilhado entre worktrees) e CI como controle.

## Erros comuns e trade-offs

- Silenciar com `eslint-disable`/`# noqa` sem motivo: o numero de excecoes cresce e a regra morre. Exija comentario.
- Linter type-aware e mais lento (carrega o compilador); o hook lint apenas arquivos staged.
- Confundir hook com controle: `LEFTHOOK=0`, `--no-verify` ou worktree sem `make hooks` pulam o hook. Quem barra de verdade e o CI com branch protection.
- Regra de seguranca estatica gera falso positivo (`security/detect-object-injection` esta desligada em testes). Calibre, nao desligue por padrao.
- Dependencias de ferramenta tambem sao cadeia de suprimentos: versoes exatas, `minimumReleaseAge` e scripts de instalacao negados (`allowBuilds`) em `pnpm-workspace.yaml`.
- Nao se aplica: prototipo descartavel de um arquivo so; o custo de configurar supera o beneficio.

## Verificacao e exercicios

- Verificacao: `make lint` (exit 0 na arvore limpa) e `make lint-regressao`.
- Exercicio 1: por que `JSON.parse(...) as { id: string }` passa no ESLint mas e pior que `unknown` estreitado?
- Exercicio 2: acrescente uma regra ao `.dependency-cruiser.cjs` que proiba `packages/sdk` de importar `packages/observability` e escreva a fixture que deve falhar.
- Exercicio 3: no `.importlinter`, qual a diferenca entre os contratos `independence` e `forbidden`? Quando usar cada um?
- Exercicio 4: gere um segredo sintetico diferente e confirme que o gitleaks reporta, sem imprimir o valor (`--redact`).
