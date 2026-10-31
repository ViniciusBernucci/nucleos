# FND-005-FIX — correcao da vulnerabilidade multer (2026-10-26)

- Dominio: engenharia. Tarefa: FND-005-FIX (perfil padrao), pedida pelo usuario (opcao recomendada: override para `multer >= 2.5.0`).
- Branch: `tarefa/fix-multer`; base/HEAD inicial: `c896612`; arvore limpa no inicio. Estado: concluida, commit local. Autor: Claude Sonnet 5.5 com o usuario.

## Objetivo, contexto e escopo

O job `security` do CI ficava vermelho por `multer` 2.4.0 (GHSA-q7qp-rjg7-q26m, HIGH 7.5, corrigido em 2.5.0), dependencia transitiva de `@nestjs/platform-express` (`apps/api`).
Escopo: override e lockfile. Fora do escopo: atualizar o NestJS, `osv-scanner.toml` (nenhum ignore; gate nao enfraquecido), `ci.yml`, codigo de `apps/api`.

## Implementacao e mudancas por arquivo

- `pnpm-workspace.yaml`: bloco `overrides: multer: 2.5.0` (mecanismo do pnpm 12.15.0 neste repo, onde ja vivem `allowBuilds` e `minimumReleaseAge`; o `package.json` raiz nao tem chave `pnpm`).
- `pnpm-lock.yaml`: regenerado com `pnpm install --lockfile-only`; so `multer` 2.4.0 -> 2.5.0 (integrity sha512-BsqOzY...LYRw==) e a secao `overrides`.
- `documentacoes/engenharia/2026-10-26-fnd-005-ci-bloqueante.md`: secao "Atualizacao no fechamento" e pendencia do multer removida. `documentacoes/engenharia/README.md`: link.
- Sem testes novos (o gate e o proprio teste: `auditar-dependencias.sh` e `make ci-regressao`). Sem migracoes.

## Decisoes

- Versao exata `2.5.0` (registry npm, `npm view multer`, consulta 2026-10-26; publicada em 2026-10-22, satisfaz `minimumReleaseAge` de 1440 min). Alternativa: faixa `>=2.5.0` (rejeitada: nao reprodutivel). Alternativa: ignore no osv-scanner (rejeitada pelo usuario/gate).
- Consequencia: o override fica fixo ate o NestJS atualizar; comentario no arquivo pede remocao nesse momento. Salto 2.4.0 -> 2.5.0 e minor; `apps/api` nao importa `multer` diretamente (grep em `apps/api/src` vazio) nem usa upload; testes da API passaram. Notas de release do multer nao foram lidas alem da versao/data (lacuna).

## Validacoes (PATH com Node 24.22.1, ~/.local/bin e .run/bin; `make setup` ok)

| Comando | Resultado |
|---|---|
| `bash scripts/ci/auditar-dependencias.sh` | pnpm audit: sem vulnerabilidades; osv-scanner: "No issues found" (380 pacotes pnpm, 68 uv); pip-audit: sem vulnerabilidades |
| `pnpm install --frozen-lockfile` | ok |
| `make lint`, `make test`, `make build`, `make ci-regressao`, `make lint-workflows` | todos rc=0 |

Nao executado: CI real no GitHub, `make up/health` (a suite de testes da API passou em `make test`), `trivy fs` (nao instalado localmente; mesmo pacote coberto por osv-scanner e pnpm audit).

## Impactos, riscos e rollback

Risco baixo (minor, sem uso direto). Rollback: remover o bloco `overrides` e rodar `pnpm install --lockfile-only` (reintroduz a vulnerabilidade e o gate falha). Sem impacto de observabilidade.

## Lessons

Nenhuma lesson criada ou alterada: nao ha conceito novo alem de `overrides` do pnpm e nenhuma lesson existente o trata (busca por "override" em `lessons/`). `lessons/README.md` inalterado.

## Commits e diffs

Commit desta tarefa: `tarefa/fix-multer`, mensagem `fix(deps): override multer 2.5.0 (GHSA-q7qp-rjg7-q26m) (FND-005-FIX)`; o SHA e o do HEAD da branch (`git log -1 tarefa/fix-multer`; nao citado aqui para nao exigir amend). Diff de codigo/configuracao (docs omitidos para evitar recursao):

```diff
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index e74df03..c0365dc 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -164,2 +164,5 @@ settings:
 
+overrides:
+  multer: 2.5.0
+
 importers:
@@ -1465,4 +1468,4 @@ packages:
 
-  multer@2.4.0:
-    resolution: {integrity: sha512-7dqa0ZcFfzbefdTuIkzOSMvZWC0J7FLqBOjJUZvDCXShIURWKxAyTT1wHhnE5q19c7jOJf43IYYKjBmZVZmvhg==}
+  multer@2.5.0:
+    resolution: {integrity: sha512-BsqOzYGVq49JcW2IzoSAxeKYRevb+dGGPPWleOR8Lrlk4igwxu1/9pwSXlByhCb7MVZDrNJFC0IBP5/O5nLYRw==}
     engines: {node: '>= 10.16.0'}
@@ -2146,3 +2149,3 @@ snapshots:
       express: 5.3.0(supports-color@7.2.0)
-      multer: 2.4.0
+      multer: 2.5.0
       path-to-regexp: 8.4.2
@@ -3021,3 +3024,3 @@ snapshots:
 
-  multer@2.4.0:
+  multer@2.5.0:
     dependencies:
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
index e9bb34e..b51f4d3 100644
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@ -13 +13,7 @@ allowBuilds:
 minimumReleaseAge: 1440
+
+# Correcao de vulnerabilidade transitiva (FND-005-FIX): multer 2.4.0 (via @nestjs/platform-express)
+# tem GHSA-q7qp-rjg7-q26m (HIGH), corrigida em 2.5.0. Versao exata (npm, publicada em 2026-10-22).
+# Remover quando @nestjs/platform-express passar a depender de multer >= 2.5.0.
+overrides:
+  multer: 2.5.0
```

## Pendencias

Nenhuma conhecida. Ao subir o NestJS, avaliar a remocao do override.
