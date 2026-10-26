# Convencoes de qualidade, commits e branches

Dominio: engenharia. Origem: ENT-FND-002. Atualizado em 2026-10-25.

## Commits

Formato (Conventional Commits, resumo em portugues, ate 100 colunas):

```
<tipo>(escopo-opcional): resumo no imperativo ou descritivo
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`, `merge`. Mensagens geradas pelo Git (`Merge ...`, `Revert "..."`, `fixup!`,
`squash!`) sao aceitas. Escopo em kebab-case (ex.: `docs(regras)`, `feat(api)`). Commits de
agentes terminam com a linha `Co-Authored-By` definida no fluxo. Validacao:
`scripts/check-commit-msg.mjs` (hook `commit-msg` e CI).

## Branches

| Padrao | Uso |
| --- | --- |
| `main` | integracao estavel; sem commits diretos |
| `developer` | trabalho de integracao do dono |
| `tarefa/<id-kebab>` | uma tarefa do backlog (ex.: `tarefa/fnd-002`) |
| `revisao/<lote>` | integracao local de um lote |
| `hotfix/<slug>` | correcao urgente |

Validacao: `scripts/check-branch-name.sh` (hook `pre-commit`; repetir no CI).

## Controles de qualidade (`make lint`)

| Controle | Ferramenta | Configuracao |
| --- | --- | --- |
| TS type-aware + seguranca; proibe `any`, `eval`, `new Function` | ESLint 10 + typescript-eslint `strictTypeChecked` + `eslint-plugin-security` | `eslint.config.mjs` |
| `any` implicito | `tsc` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | `tsconfig.base.json` |
| Formato TS/JS | Prettier | `.prettierrc.json`, `.prettierignore` |
| Imports TS (web x api, contracts folha, apps isolados) | dependency-cruiser | `.dependency-cruiser.cjs` |
| Python lint/format (inclui regras bandit `S`) | ruff | `pyproject.toml` `[tool.ruff]` |
| Tipagem estrita nos pacotes de politica (`tool-gateway`, `event-dispatcher`, `tenant-runtime/policy`) | `mypy --strict` | `pyproject.toml` `[tool.mypy]` |
| Imports Python (servicos independentes; tenant-runtime sem SDK do provisioner) | import-linter | `.importlinter` |
| Lockfile Python em dia | `uv lock --check` | `Makefile` |
| Segredos | gitleaks 8.30.1 | `.gitleaks.toml`, `scripts/check-secrets.sh` |
| Regressao dos controles | casos que DEVEM falhar | `tools/qualidade/regressao.mjs` (`make lint-regressao`) |

Hooks locais (lefthook): `make hooks` instala. `pre-commit`: nome da branch, gitleaks nos
staged, Prettier, ESLint e ruff nos staged; `commit-msg`: formato da mensagem. Hook nao e
controle de seguranca: `make lint` deve rodar tambem no CI (FND-005).

gitleaks nao e dependencia npm/pip: instalar o binario v8.30.1 em escopo de usuario
(`~/.local/bin`) a partir da release oficial, conferindo o checksum publicado.
