# Revalidacao focal FND-006, rodada de correcao 1/3 (perfil CRITICO)

Data: 2026-10-26. Revisor independente (sessao nova; nao implementou). Worktree `../nucleos-worktrees/tarefa/fnd-006`, branch `tarefa/fnd-006`, HEAD `590e038`. Correcao em `6269603` e `590e038`; review `866f07b`; auditoria `1951067`. Escopo: IDs APLICADOS e `git diff 93c7049..HEAD` (codigo: 13 arquivos). Arvore limpa antes e depois.

## Veredito: VERIFICADO (com 1 achado novo MEDIO e 3 BAIXOS, nenhum bloqueante)

## Verificacoes reexecutadas (PATH com Node 24.22.1 e `uv`)

| Comando | Resultado |
| --- | --- |
| `make lint` | exit 0 (casos de regressao do verificador falham como esperado; `verificar-deploy: OK`) |
| `make test` | exit 0 (TS config 14 testes; `pytest` 49 passed) |
| `make build` | exit 0 |
| `make test-ambientes` | exit 0, 21/21 (~113 s); sem container, rede ou volume remanescente do ensaio (`docker ps -a/network/volume` filtrados; volumes `nucleos-dev_*` sao preexistentes do ambiente dev) |

## Classificacao por ID

| ID | Classe | Evidencia |
| --- | --- | --- |
| 001 | CORRIGIDO | `deploy.sh`: `anterior` so muda se digest difere; ensaio A, B, B, rollback volta a A. Mutante "anterior=atual incondicional" falha 4 testes |
| 002 | CORRIGIDO | `EXTRA_COMPOSE` recusado em prod (mesmo com `FND006_ENSAIO=1`) e em staging sem o flag, antes de qualquer docker. Mutante (guarda de prod removida) falha o teste |
| 003 parcial | CORRIGIDO | esquema `postgres/postgresql`, `PORT` `^\d{1,5}$`, `TextDecoder` fatal, tabela `paridade-casos.json` consumida pelos dois pacotes (testes verdes) |
| 004 | CORRIGIDO | nome por token + sufixo colado, `_FILE`/`_PATH` isentos, nos 3 locais; `DB_PASS`, `SECRET_KEY`, `KEY_ID` recusados. Mutantes (remover a regra por token em TS, Python e deploy-lib) falham (TS 3, Python 6, ensaio 11) |
| 005 subconjunto | CORRIGIDO | allowlist `cap_add`, rede interna `internal`, Postgres so em `interna`, `tmpfs` noexec/nosuid, `unconfined`, qualquer bind; `make lint` verde nos 3 compose |
| 006 | CORRIGIDO (ressalva REV-001) | dono TS removido falha 1 teste; dono Python removido falha 1; permissao TS falha 1; query TS falha 1. O dono em `deploy.sh` nao e coberto (REV-001) |
| 007 parcial | CORRIGIDO | `open(O_NOFOLLOW|O_NONBLOCK)` + `fstat(fd)` + leitura limitada a `MAX+1`, codigos de erro inalterados, nos dois pacotes |
| 009 | CORRIGIDO | query `password/sslpassword/passfile/token/apikey/...` recusada, case-insensitive, nos dois; mutante TS falha |
| 010 | CORRIGIDO | `if subir && aguardar_pronto` com rollback automatico; `flock -n` em `$STATE/.lock`. Mutantes "sem rollback quando up falha" (falha o teste REVIEW-010) e "sem flock" (falha o teste de concorrencia) |
| 011 parcial | CORRIGIDO | diffs de `CLAUDE.md`, `AGENTS.md`, `.agents/rules` na secao "Rodada 1" do arquivo de diffs; todos os 13 arquivos de `6269603` constam; patch de `deploy.sh` identico ao `git show`; pendencias com destino/condicao |
| 012 | CORRIGIDO | exemplo da lesson 11 anotado (registro declara `mypy --strict`; nao reexecutado) |

Mutantes refeitos em `git clone --no-hardlinks` (scratchpad), cada um revertido com `git checkout -- <arq>`: dono TS (falhou), dono Python (falhou), nome por token TS/Python/deploy-lib (falhou), EXTRA_COMPOSE em prod (falhou), anterior=atual (falhou), rollback quando `up` falha (falhou), sem flock (falhou), permissao TS (falhou), query TS (falhou). **Sobrevivente: dono do segredo em `deploy.sh` (REV-001).** Linha de base do clone: 21/21.

## Desvio do executor: PWD/OLDPWD liberados

- `load.ts` (processo): seguro e necessario. `forbiddenSecretEnv` varre `process.env` inteiro e o shell sempre exporta `PWD`; liberar so os nomes exatos `PWD`/`OLDPWD` mantem `DB_PWD`/`X_PWD` bloqueados (teste cobre).
- `deploy-lib.mjs` (Compose): a excecao e desnecessaria e e burla trivial: `PWD: hunter2` em `environment:` passa em `secretFindingsInEnv` e `secretFindingsInText` (verificado). Nada no esquema le `PWD`, entao o impacto e baixo, mas o AC-3 vale para qualquer overlay (REV-002).
- Decisao humana levantada (regra vale tambem em `local`, bloqueando `GITHUB_TOKEN`, `*_API_KEY` etc. exportados no shell do desenvolvedor): risco real de atrito, fail-closed (nao vaza). CI nao e afetado (`ci.yml` nao exporta token ao processo da API). Recomendacao: manter fail-closed e decidir se `local` fica com regra so sobre as variaveis do esquema; nao e bloqueante. Permanece como decisao humana.

## Novos achados

| ID | Sev. | Achado | Correcao sugerida |
| --- | --- | --- | --- |
| REV-001 | MEDIO | Checagem de dono do segredo em `deploy.sh` (`API_UID`) sem teste: mutante `true \|\|` sobrevive 21/21. O ensaio usa `EXTRA_COMPOSE`, que ja dispensa a checagem, e o teste "segredo 0400" nao cobre dono errado. E o unico controle de dono no caminho de deploy (REVIEW-006 pedia dono no leitor; aqui e o analogo) | Teste sem `EXTRA_COMPOSE`: arquivo 0400 do usuario atual com `API_UID` diferente deve sair com codigo 1 e "pertencer ao UID", sem docker (stub no `PATH`) |
| REV-002 | BAIXO | `PWD`/`OLDPWD` isentos tambem na varredura de Compose (burla de nome) | Aplicar `NOT_SECRET` apenas em `forbiddenSecretEnv` do processo (TS/Python), nao em `deploy-lib` |
| REV-003 | BAIXO | `verificar_segredos` e `verificar-deploy.mjs` rodam antes/depois de `travar` sem ordem uniforme e o `EXTRA_COMPOSE` ainda dispensa o dono em staging (apenas ensaio, com aviso); aceitavel, registrar | informativo |
| REV-004 | INFO | Falsos positivos de nome: `*_KEY_ID` (ex.: `AWS_ACCESS_KEY_ID`) e `PASSWORD_FILE_X` sao recusados; fail-closed, coerente com a politica, mas pode exigir allowlist (ja ADIADO em 004) | acompanhar no primeiro ticket que acrescentar variavel |

Sem achado em: `flock` (descritor 9 preso ao processo, liberado na saida; `status` sem trava), `set -e` (todas as falhas de `subir` estao dentro de `if`/`||`), `multer`, `osv-scanner.toml`, `ci.yml` e dependencias/lockfiles (nenhum alterado em `93c7049..HEAD`), verificador estrito demais (`make lint-deploy` verde; unico efeito: qualquer bind mount e proibido, intencional). Registro/diffs honestos: lacuna de `docker pull` e risco de `local` declarados.

## Limitacoes

AC-2 real em staging segue BLOCKED (sem host). `mypy --strict` da lesson 11 nao reexecutado. M8 (deploy-lib) foi medido com filtro que executou a suite inteira (falhou 11 de 21 contra linha de base 21/21 verde).
