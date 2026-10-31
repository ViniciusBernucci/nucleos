# Fix do job security (minimatch)

Data da implementacao: 2026-10-31

## 1) Metadados

- Dominio: engenharia
- Tarefa: corrigir falha do job GitHub Actions `security` (run `41226003067`, job `124610173277`)
- Branch: `copilot/fix-security-job-failure`
- Commit inicial/base: `f4753e7cadb11655bd0655265bae23e2b0b8435d`
- Base de comparacao: `origin/main` indisponivel no clone raso durante a sessao; comparacao registrada contra o estado inicial da propria branch
- Estado da entrega: concluida localmente (alteracoes prontas e validadas de forma direcionada)
- Autor: Copilot Coding Agent

## 2) Objetivo, contexto, escopo e fora de escopo

- Objetivo: remover a causa da falha no gate `security` sem alterar comportamento funcional do produto.
- Contexto: o log do job mostrou falha em `scripts/ci/auditar-dependencias.sh`, com achados do `osv-scanner` para `GHSA-g3hv-75wg-m249` em `minimatch` (`10.2.6` e `5.1.9`) no `pnpm-lock.yaml`.
- Escopo incluido:
  - override de dependencia transitiva vulneravel no workspace;
  - regeneracao do lockfile;
  - atualizacao da documentacao da entrega e do material didatico relacionado a CI/supply chain.
- Fora de escopo:
  - refatoracoes em codigo de aplicacao;
  - mudancas na politica de severidade dos scanners;
  - adicao de novas dependencias.

## 3) Resumo do que foi implementado

1. Adicionado `minimatch: 11.0.1` em `overrides` de `pnpm-workspace.yaml`.
2. Regenerado `pnpm-lock.yaml` com resolucao transitiva para `minimatch@11.0.1`.
3. Atualizada a lesson de CI/supply chain com o caso real de manutencao do gate.

## 4) Alteracoes por arquivo

- `/home/runner/work/nucleos/nucleos/pnpm-workspace.yaml`
  - adiciona override global de `minimatch` para versao corrigida.
- `/home/runner/work/nucleos/nucleos/pnpm-lock.yaml`
  - remove snapshots vulneraveis (`minimatch@10.2.6`, `minimatch@5.1.9`) e passa a resolver `minimatch@11.0.1`.
- `/home/runner/work/nucleos/nucleos/lessons/04 - CI bloqueante e cadeia de suprimentos.md`
  - inclui follow-up didatico da correcao.
- `/home/runner/work/nucleos/nucleos/lessons/README.md`
  - atualiza a data/descricao da ultima atualizacao da trilha.

## 5) Decisoes tecnicas, alternativas e consequencias

- Decisao: corrigir via `overrides` no workspace, mantendo mudanca minima e rastreavel em versionamento.
- Alternativas consideradas:
  - excecao em `osv-scanner.toml` (rejeitada para nao conviver com vulnerabilidade corrigivel);
  - troca de bibliotecas raiz (desnecessaria e mais invasiva).
- Consequencia: lockfile passa a forcar versao corrigida de dependencia transitiva para todas as arvores que usam `minimatch`.

## 6) Validacao executada (comandos e resultados reais)

Comandos executados:

```bash
corepack pnpm install --lockfile-only
```

Resultado: sucesso; lockfile regenerado.

```bash
mkdir -p .run/bin && corepack enable --install-directory .run/bin
scripts/ci/instalar-ferramenta.sh osv-scanner
pnpm audit --audit-level high
```

Resultado: `pnpm audit` sem vulnerabilidades conhecidas.

```bash
osv-scanner scan source --config osv-scanner.toml -L pnpm-lock.yaml -L uv.lock
```

Resultado: sem achados de vulnerabilidade antes da chamada remota; execucao local interrompida por erro de DNS para `api.osv.dev` no sandbox (`lookup api.osv.dev ... server misbehaving`).

```bash
pnpm --filter @nucleos/contracts run verificar-gerados
```

Resultado: falha por ambiente Python incompleto na sessao (`datamodel-codegen falhou`), sem relacao com a mudanca de lockfile.

## 7) Impactos, riscos, compatibilidade, observabilidade e rollback

- Impacto funcional esperado: nenhum (mudanca de dependencia transitiva de tooling).
- Risco principal: incompatibilidade de runtime de ferramentas que consumem `minimatch`.
- Mitigacao: validacao do lockfile, `pnpm audit` limpo e manutencao de mudanca minima/reversivel.
- Rollback: remover `minimatch: 11.0.1` de `overrides` e regenerar lockfile.

## 8) Commits e diffs da tarefa

Nenhum commit criado nesta tarefa.

Diffs de codigo/configuracao (sem incluir recursao de `documentacoes/` e `lessons/`):

```diff
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
@@
 overrides:
   multer: 2.5.0
+  minimatch: 11.0.1

diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
@@
 overrides:
   multer: 2.5.0
+  minimatch: 11.0.1
@@
-  minimatch@10.2.6:
-  minimatch@5.1.9:
+  minimatch@11.0.1:
```

## 9) Lessons relacionadas

- [../../lessons/04 - CI bloqueante e cadeia de suprimentos.md](../../lessons/04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md)
- [../../lessons/README.md](../../lessons/README.md)

## 10) Pendencias

- Nao ha pendencias tecnicas conhecidas no diff.
- Pendencia operacional do ambiente de execucao local: validar novamente `osv-scanner` em ambiente com acesso DNS normal ao `api.osv.dev` para reproduzir 100% da chamada remota localmente (o gate de CI ja executa essa etapa no GitHub Actions).
