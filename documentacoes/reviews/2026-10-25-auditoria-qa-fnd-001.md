# Auditoria do QA - FND-001 (BUG-001 e NOTA-2)

- **Relatorio de origem:** `documentacoes/reviews/2026-10-25-qa-fnd-001.md` (veredito original preservado: QA APPROVED WITH NOTES)
- **Tarefa:** ENT-FND-001 (`documentacoes/backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-001`)
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/fnd-001`, `tarefa/fnd-001`
- **HEAD auditado:** `54448cb76455d861ae823fbbb447e577f3f6fbea` (QA rodou em a995596; `scripts/check-no-env.sh` e `Makefile` nao mudaram desde a995596 por `git log`). Worktree sem alteracoes pendentes.
- **Auditor:** sessao independente; somente leitura; nenhum codigo editado, nenhum commit. Auditoria anterior (`2026-10-25-auditoria-fnd-001.md`) nao revisada aqui.
- **Reproducao:** `git archive HEAD scripts/check-no-env.sh .gitignore` em dir temporario do scratchpad (sem `.git`) e execucao do script: duas linhas `fatal: not a git repository` e `ERRO: .env nao esta ignorado pelo .gitignore`, rc=1 (o QA observou rc=2 via make). Confirmado. Nao executado: `make setup/test` completos, `uv lock --check`.

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| BUG-001 | BAIXO | BAIXO | APLICAR (correcao minima) |
| NOTA-2 | nota | BAIXO (lacuna de deteccao) | ADIAR para FND-005 |

## BUG-001 - APLICAR

- **Evidencia:** `scripts/check-no-env.sh` executa `git ls-files` (a saida e engolida pelo `|| true`, entao o primeiro passo "passa" em silencio sem `.git`) e depois `git check-ignore -q .env`, que falha com "not a git repository" e e reportado como `.env nao esta ignorado`. A mensagem e factualmente errada e esconde que o primeiro controle nem rodou.
- **Especificacao:** o ticket exige "clone limpo" e teste de que `git ls-files` nao contem `.env`. O aceite e satisfeito por clone real (QA AC-1/AC-3 PASS), logo nao e quebra de aceite bloqueante. Porem o teste foi definido sobre `git ls-files`: sem git ele nao pode ser verificado, e o guard deve dizer isso.
- **Decisao sobre skip x erro:** NAO pular silenciosamente. O guard e controle de seguranca (segredos); pular em silencio criaria falso verde. O comportamento correto e falhar fechado com mensagem verdadeira. Skip so seria aceitavel se explicito e opt-in (variavel de ambiente), o que nao e necessario agora: CI usara checkout git (FND-005) e o gitleaks cobre a arvore.
- **Risco da alteracao:** muito baixo (script de 15 linhas; muda apenas o caminho de erro).
- **Plano minimo:** em `scripts/check-no-env.sh`, logo apos o `cd`, adicionar
  `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERRO: check-env requer um repositorio git (git ls-files); arvore sem .git nao e verificavel" >&2; exit 2; }`.
  Opcional (nao obrigatorio): linha no README/doc de entrega registrando que `make test|lint` exigem repositorio git.
- **Teste esperado:** (1) `git archive HEAD | tar -x` em dir vazio -> `bash scripts/check-no-env.sh` rc=2 com a mensagem nova, sem as linhas `fatal:`; (2) no clone/worktree real continua `OK ...` rc=0; (3) com `.env` forcado via `git add -f` continua rc=1 (caso AC-3 negativo). Atualizar a documentacao da entrega em `documentacoes/` com o comportamento sem `.git` (regra de pronto do projeto).

## NOTA-2 - ADIAR (destino: FND-005)

- **Evidencia:** o QA mostrou que `uv sync --frozen` (usado em `make setup`) nao falha com `pyproject.toml` fora de sincronia com `uv.lock`, enquanto `uv lock --check` falha. O criterio AC-4 de FND-001 ("nenhuma dependencia sem lock file") esta atendido: `uv.lock` e `pnpm-lock.yaml` versionados e o caminho TS tem negativo comprovado. A deteccao de drift do lock Python e responsabilidade de gate de CI.
- **Por que adiar:** nao e quebra de aceite de FND-001; FND-005 (jobs `lint-py`/`test-py`, PRs sinteticos por gate) e o dono natural. Impacto residual: ate FND-005, dependencia Python adicionada sem relock passa localmente em `make lint/test`; nao ha pipeline nem merge protegido ainda.
- **Condicao de retomada:** ao implementar FND-005, incluir `uv lock --check` (e `pnpm install --frozen-lockfile`) no job `lint-py` e como PR sintetico de gate. Se FND-002 for implementado antes, pode-se adicionar `uv lock --check` ao alvo `lint` ali. Nao abrir tarefa externa automaticamente; registrar a pendencia na entrega de FND-001.

## Veredito: CORRECOES_NECESSARIAS

Uma correcao pequena e nao bloqueante do aceite (BUG-001), a ser aplicada pelo implementador e revalidada por revisor independente; NOTA-2 adiada com condicao de retomada. O veredito original do QA (APPROVED WITH NOTES) e preservado; o gate consolidado fica condicionado a BUG-001 corrigido e revalidado.
