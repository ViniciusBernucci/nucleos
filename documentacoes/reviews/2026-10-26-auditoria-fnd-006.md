# Auditoria independente do review: FND-006 (perfil CRITICO)

Data: 2026-10-26. Auditor: sessao independente (Claude Sonnet 5.5), distinta do implementador e do revisor. Nao implementa nem altera codigo.

- **Relatorio de origem:** `documentacoes/reviews/2026-10-26-review-fnd-006.md` (commit `866f07b`, veredito do revisor CHANGES_REQUESTED, preservado).
- **Tarefa:** ENT-FND-006, lote 2026-10-25-ep00-ep01-fundacao. **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/fnd-006`, `tarefa/fnd-006`.
- **Base:** `d00e8df`. **HEAD revisado:** `866f07b` (codigo em `8e5194d`, documentacao em `93c7049`). Nenhuma mudanca de codigo desde o review.
- **Referencias:** ENT-FND-006 (AC-1..3), ADR-020 (Aceito em 2026-10-26; decisoes humanas nao reabertas), DEC-006, `CLAUDE.md`.
- **Metodo:** leitura do relatorio, de `deploy.sh` e `deploy-lib.mjs` e do ADR-020 neste HEAD. Os achados sobre `secret.ts`, `secret.py`, `settings.py`, `primitives.ts` e `main.ts` foram confrontados com as sondas e mutacoes do relatorio (reproduziveis por leitura; nao reexecutadas). Nao foi executado nenhum teste nem Docker nesta auditoria.

## Veredito: CORRECOES_NECESSARIAS

Os tres AC estao atendidos no que e verificavel localmente (AC-2 real BLOCKED por falta de staging, ja declarado). Mas ha defeitos reais de rollback (AC-2 promete "rollback pelo digest anterior"), um bypass de politica em producao e lacunas de bloqueio de segredo (AC-1/AC-3, ADR-020 item 1) que devem ser corrigidos antes do QA.

## Decisoes por ID

| ID | Sev. original | Sev. avaliada | Decisao | Destino/escopo |
| --- | --- | --- | --- | --- |
| REVIEW-001 | MEDIO | MEDIO | **APLICAR** | correcao pequena |
| REVIEW-002 | MEDIO | MEDIO | **APLICAR** | correcao pequena |
| REVIEW-003 | MEDIO | MEDIO | **APLICAR** (parcial: esquema, PORT, UTF-8 e tabela de paridade); ADIAR o restante | pequena |
| REVIEW-004 | MEDIO | MEDIO | **APLICAR** (regex por token); ADIAR allowlist por servico e arquivo unico da lista | pequena |
| REVIEW-005 | MEDIO | MEDIO | **APLICAR** (subconjunto barato); ADIAR o restante | pequena/media |
| REVIEW-006 | MEDIO | MEDIO | **APLICAR** | testes |
| REVIEW-007 | BAIXO | BAIXO | **APLICAR** (fstat no fd e leitura limitada); ADIAR verificacao do diretorio pai | pequena |
| REVIEW-008 | BAIXO | BAIXO | **ADIAR** (registrar pendencia no documento) | tickets consumidores |
| REVIEW-009 | BAIXO | BAIXO | **APLICAR** | pequena |
| REVIEW-010 | BAIXO | MEDIO (sobe) | **APLICAR** | pequena |
| REVIEW-011 | BAIXO | BAIXO | **APLICAR** (diff e pendencias); ADIAR numeracao de lessons | documentacao |
| REVIEW-012 | BAIXO | BAIXO | **APLICAR** | trivial |

## Justificativa e instrucao por achado

### REVIEW-001 e REVIEW-010 (rollback e `deploy.sh`): APLICAR (010 sobe para MEDIO)

Evidencia: `deploy.sh:53` copia `atual` para `anterior` incondicionalmente. Um redeploy do mesmo digest, ou uma tentativa falha (a copia ocorre antes de `subir`), faz `anterior == atual`, entao `rollback` vira no-op. O AC-2 e a especificacao ("rollback pelo digest anterior") sao quebrados em cenarios operacionais comuns (retentativa de pipeline). Em `deploy.sh:54`, `subir "$ref"` sob `set -e` termina o script antes de `aguardar_pronto`, sem rollback e sem estado, o que e justamente a falha que o rollback automatico deve cobrir. Isso nao depende de staging: e reproduzivel no ensaio local. Sobe para MEDIO porque o rollback e o controle de recuperacao do ticket.

Instrucao:
1. Registrar `anterior` somente se `atual` existir e `atual != ref`. Guardar o `anterior` previo e restaura-lo se o deploy falhar e o rollback automatico for executado (nao sobrescrever com o digest que acabou de falhar ou de ser revertido).
2. `subir "$ref"` deve ser avaliado como `if ! subir "$ref"; then <mesmo ramo de falha do readyz>; fi`, com rollback automatico, `exit 1` e sem gravar `atual`.
3. `flock -n` em `$STATE/.lock` (descritor aberto no inicio de `deploy` e `rollback`); se ocupado, sair com erro claro. Sem lock global alem do estado do ambiente.
4. Testes em `ambientes.test.mjs`: (a) `deploy A`, `deploy B`, `deploy B`, `rollback` volta a A; (b) deploy cujo `up` falha (ref de imagem inexistente via overlay de ensaio) aciona rollback e mantem `atual`/`anterior` corretos; (c) segunda execucao concorrente e recusada.
Risco de regressao: baixo, restrito a `deploy.sh`; manter a ordem pull, migrar, subir, readyz e a saida de `status`.

### REVIEW-002 (EXTRA_COMPOSE): APLICAR, remover o caminho de producao

Evidencia: `deploy.sh:17,26,49`. Com a variavel definida, o dono do segredo nao e exigido, o `docker pull` e pulado e o overlay entra sem passar por `verificar-deploy.mjs`. Uma variavel herdada do shell do operador contorna, em silencio, os controles que o AC-3 e o ticket (digest verificado) prometem. Um overlay de ensaio nao tem razao de existir em `prod`.

Instrucao: em `deploy.sh`, se `env_name=prod` e `EXTRA_COMPOSE` nao vazio, sair com erro antes de qualquer acao. Em staging, exigir tambem `FND006_ENSAIO=1` (erro caso contrario) e imprimir um aviso em stderr. Ajustar o ensaio (`ambientes.test.mjs`) e o runbook para exportar `FND006_ENSAIO=1`. Teste: `EXTRA_COMPOSE=x deploy.sh prod deploy <digest valido>` sai com codigo diferente de zero sem chamar docker; staging sem `FND006_ENSAIO` idem. Nao e necessario validar o overlay extra, pois o caminho deixa de existir fora do ensaio. Risco: o ensaio precisa do novo flag em todas as chamadas (falha ruidosa se esquecer).

### REVIEW-003 (paridade TS/Python): APLICAR parcial

Regra: o ticket pede "zod no TS, Pydantic Settings em Python" com tipos para URLs e limites, e o registro da entrega afirma "mesmo contrato". Paridade total byte a byte nao e requisito do ticket, mas a divergencia de entradas aceitas em `DATABASE_URL` (esquema) e `PORT` e relevante para o hardening: um servico Python aceitaria um esquema inesperado de banco e portas nao canonicas, e os dois leitores discordariam sobre o mesmo arquivo de segredo. A correcao e pequena e fica na camada de validacao.

Instrucao: (1) Python: esquema de `DATABASE_URL` restrito a `postgres`/`postgresql`; `PORT` e demais inteiros por `field_validator(mode="before")` com `^\d{1,5}$` (ou `strict=True` sobre texto limpo). (2) TS: `new TextDecoder("utf-8", { fatal: true })` em `secret.ts`, tratando como `ilegivel`. (3) Tabela unica de casos (entrada, aceita/recusa) em um arquivo JSON compartilhado, consumida por um teste em cada pacote. ADIAR: paridade ampla de mensagens e fuzz do esquema (retomada: ao existir o primeiro servico Python real que consuma o pacote, tickets de servicos de IA/dados).
Risco: baixo; verificar que o ensaio e os testes existentes continuam verdes.

### REVIEW-004 (nomes de segredo): APLICAR com escopo reduzido

Evidencia: `SECRET_NAME` em `deploy-lib.mjs:5` ancora o termo no fim do nome; `SECRET_KEY`, `JWT_SECRET_KEY`, `AWS_SECRET_ACCESS_KEY`, `DB_PASS`, `ACCESS_KEY` passam, e `DB_PASS: hunter2` passa em `lint-deploy`. ADR-020 item 1 e o AC-3 ("nenhum overlay contem segredo literal") sao enfraquecidos, e o item 7 so e confiavel se a politica de nomes cobre as variaveis reais. Esta e a correcao que mais fecha vazamento por pouco custo.

Instrucao: trocar nos tres locais (`load.ts`, `settings.py`, `deploy-lib.mjs`, mais o regex de texto de `secretFindingsInText`) por correspondencia por token (separar o nome por `_`): recusar quando algum token estiver em `{PASS, PASSWORD, PASSWD, SECRET, TOKEN, KEY, APIKEY, CREDENTIAL(S), DSN, PWD}`, exceto quando o nome terminar em `_FILE` ou `_PATH`. Validar contra falsos positivos nas variaveis legitimas ja usadas (`DATABASE_PASSWORD_FILE`, `OTEL_*`, `REQUEST_TIMEOUT`, etc.; `KEY` como token isolado so recusa nomes como `API_KEY`/`SECRET_KEY`). Testes: casos do relatorio nos tres pacotes e uma mutacao `DB_PASS: hunter2` em Compose. ADIAR: allowlist por servico (variavel fora do esquema e erro) e arquivo unico compartilhado da lista (destino: FND-007 ou o primeiro ticket que adicionar variaveis ao esquema da API; condicao: nova variavel de ambiente). Risco: falso positivo em variaveis de infraestrutura de terceiros; a lista de excecao deve ser curta e explicita.

### REVIEW-005 (`verificar-deploy`): APLICAR subconjunto

Evidencia: `deploy-lib.mjs:59-91`. O ticket exige "perfil de hardening de ISO-002", e a documentacao fala em allowlist minima de `cap_add`, o que o codigo nao implementa. As regras abaixo sao baratas e mexem apenas em `verifyRendered` com um teste por regra, no padrao `bad({...})`.

Instrucao (APLICAR): `cap_add` somente por allowlist por servico (Postgres: apenas as capacidades documentadas; API: nenhuma); `networks.interna.internal === true`; Postgres presente somente na rede `interna`; `tmpfs` com `noexec,nosuid`; recusar `seccomp=unconfined` e `apparmor=unconfined` em `security_opt`; recusar bind mounts de qualquer caminho do host (a regex `^\/(proc|sys|run\/containerd)?$` so casa a raiz do diretorio) e manter `docker.sock` como proibido. Em `lint-deploy`, o bind de `SECRETS_DIR` entra pelo bloco `secrets` e nao por `volumes`, portanto a regra nao quebra o caso legitimo (conferir no ensaio).
ADIAR: `ulimits`/`init`, conferir que `secrets.file` aponta so para dentro de `SECRETS_DIR` (depende do valor de ambiente em tempo de deploy) e seccomp/apparmor completos (destino: ISO-002; condicao: perfil de runtime do ticket).
Risco: baixo a medio; uma regra estrita demais quebra `make lint`. Rodar `make lint-deploy` e `make test-ambientes` apos cada regra.

### REVIEW-006 (mutantes sobreviventes): APLICAR, testes obrigatorios

Regra: o ticket exige testes unitarios do esquema e perfil CRITICO; a checagem de dono do arquivo e o unico controle que barra um segredo 0400 pertencente a terceiro, e hoje pode ser removida sem qualquer teste falhar. Instrucao: (a) TS: teste de `dono-diferente` com `mock.method(process, "getuid", ...)`; Python: `monkeypatch.setattr(os, "getuid", ...)`; (b) nomes `*_TOKEN`, `*_SECRET`, `*_PASS` (cobre a mutacao `TOKEN` e a regex nova do 004); (c) Python: teste que provoca um erro de validacao de pydantic com valor sentinela e confere ausencia da sentinela na mensagem e no `repr` (cobre `hide_input_in_errors`/`include_input`); (d) reexecutar as mutacoes sobreviventes do relatorio e registrar que agora falham. Risco: nulo para producao.

### REVIEW-007 (leitor de segredo): APLICAR parcial

Evidencia: `secret.ts:60-75`, `secret.py:43-61`. `lstat` e `open` sao chamadas separadas e a leitura nao tem limite. O AC pede "checagem de permissoes do arquivo"; fazer `fstat` no descritor aberto com `O_NOFOLLOW` e ler no maximo `MAX_SECRET_BYTES + 1` e padrao simples e fecha a janela. Exploracao exige acesso de escrita ao diretorio de segredos (ja 0700 pelo runbook), por isso BAIXO.
Instrucao: abrir com `O_RDONLY|O_NOFOLLOW|O_CLOEXEC`, checar tipo, modo, dono e tamanho via `fstat(fd)`, ler no maximo `MAX_SECRET_BYTES + 1` bytes e recusar se exceder. Testes: arquivo maior que o limite lido por um descritor (sem depender de corrida) e regressao dos testes existentes (link simbolico, mascara, dono). ADIAR: verificar o diretorio pai (depende de contrato de deploy; destino: runbook de deploy e ISO-001; condicao: host de staging definido). Risco: baixo; manter os codigos de erro existentes (sem caminho nas mensagens).

### REVIEW-008 (limites nao aplicados; `process.env` direto): ADIAR

Evidencia: `main.ts:19-22`, `observability.ts:15`. FND-006 entrega o esquema e o carregamento; consumir `REQUEST_TIMEOUT`, `MAX_BODY_SIZE` e `SHUTDOWN_TIMEOUT` e escopo dos tickets que implementam o servidor HTTP e a borda (FND-007 impoe limites de corpo e timeouts na borda). Nao ha vazamento hoje: `OTEL_EXPORTER_OTLP_HEADERS` ja e lido sem passar pelo esquema desde FND-009. Impacto residual: falsa sensacao de limite e credencial OTEL potencial por ambiente. Instrucao dentro desta entrega: registrar as duas pendencias no documento da entrega. Destino: FND-007 (limites) e ticket de observabilidade que configure exportador autenticado (tratar `*_HEADERS` como `*_FILE`). Condicao de retomada: primeira configuracao de exportador OTLP autenticado ou consumo dos limites.

### REVIEW-009 (credencial na query string): APLICAR

Evidencia: `primitives.ts:50`, `settings.py:44`; a regra olha so `userinfo`. A correcao e pequena e fecha um vetor de segredo literal no `DATABASE_URL` (AC-1/AC-3). Instrucao: recusar parametros de query `password`, `sslpassword`, `passfile` fora de `*_file`, `token`, `apikey` (comparacao case-insensitive), com mensagem so com o nome da variavel; teste com sentinela nos dois pacotes, que passa a fazer parte da tabela compartilhada do REVIEW-003.

### REVIEW-011 (documentacao e aderencia ao ADR-020): APLICAR parcial

Regra: `CLAUDE.md` exige diff das mudancas do commit que nao sejam `documentacoes/` e `lessons/`; ADR-020 pede explicitar o que foi ou nao feito.
Instrucao: (1) incluir em `...-diffs.md` os diffs dos blocos de `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` de `93c7049` (ou declarar objetivamente a excecao com justificativa); (2) registrar em "Pendencias" do documento da entrega, com destino: SOPS+age para segredos da plataforma (ADIAR, destino ISO-001/deploy real de staging, condicao: primeiro segredo versionado de plataforma); varredura do conteudo de volumes no ensaio e segredo em `tmpfs` (ADIAR, destino ISO-002/ISO-001; condicao: host real, pois o ensaio local nao tem `tmpfs` de segredo); `audit.log` com hash encadeado e persistencia atomica do broker (ADIAR, destino PRV-004, que consome o broker; FND-006 so entrega a leitura de configuracao e nao o broker); (3) ADIAR a numeracao das lessons 11/12, ja declarada provisoria, ao orquestrador na integracao em `revisao/` (a reordenacao precisa considerar as demais tarefas do lote).

### REVIEW-012 (lesson 11 sem tipos): APLICAR

Evidencia: o exemplo `settings_customise_sources` falha em `mypy --strict` enquanto o `CLAUDE.md` exige exemplos com tipos. Instrucao: anotar a assinatura como em `packages/config-py/src/nucleos_config/settings.py`; reverificar o exemplo com `uv run mypy --strict` e atualizar a data de ultima atualizacao da lesson.

## Correcoes pequenas e seguras (aplicar nesta tarefa) e o que vira pendencia

- **Aplicar agora, risco baixo:** 001, 010, 002, 009, 012, 006 e as partes de 003, 004, 007 e 011 descritas acima.
- **Aplicar com cuidado, risco baixo a medio:** 005 (uma regra por vez, com teste) e 004 (conferir falsos positivos).
- **Ficam como ADIAR com destino:** allowlist de variaveis por servico e arquivo unico da lista (004, FND-007 ou primeiro ticket que acrescente variavel); `ulimits`/`init`, seccomp/apparmor e `secrets.file` dentro de `SECRETS_DIR` (005, ISO-002); diretorio pai do segredo (007, ISO-001); limites nao consumidos e OTEL (008, FND-007/observabilidade); SOPS+age, volumes e `audit.log` (011, ISO-001/ISO-002/PRV-004); numeracao das lessons (011, orquestrador).

## Riscos de regressao (a conferir na revalidacao)

1. Mudanca de estado em `deploy.sh` (001/010): conferir `status` e o ciclo A, B, rollback do ensaio existente.
2. `FND006_ENSAIO` (002): todos os testes e o runbook devem usar o flag; `make test-ambientes` roda 75 s com Docker e deve voltar a 15 de 15.
3. Regex por token (004): nenhum nome legitimo do esquema atual pode ser recusado; rodar `make test` e `make lint`.
4. Novas regras do verificador (005): `make lint-deploy` precisa continuar verde nos tres arquivos versionados e as mutacoes do relatorio devem falhar.
5. Leitura por `fstat` (007): comportamento de erros identico (codigos e mensagens sem caminho) nos dois pacotes.
6. O gate de revisao deve repetir as mutacoes de 004, 005 e 006 e a sonda de paridade de 003 em sessao independente.

## Lacunas do review

1. O review nao confrontou os pontos que o ADR-020 diz ficarem para FND-006 (item 7: varredura do conteudo de volumes; SOPS+age; hash encadeado do `audit.log`; persistencia atomica e ID/versao da KEK). Tratados em REVIEW-011 como ADIAR com destino: o ticket FND-006 nao inclui o broker. Isso nao e bloqueante, mas precisa constar no registro.
2. O review nao avaliou o comportamento do bind mount de `secrets.file` com UID 10001 nem o dono real do segredo (declarado em Limitacoes); sem staging, fica como risco residual do AC-2 real (BLOCKED, Q-03).
3. Nao ha cobertura do caminho `docker pull` com falha (rede) no `deploy.sh`; deve ser acrescentada no teste de falha do REVIEW-010.

## Limitacoes desta auditoria

- Nao executei `make lint`, `make test`, `make test-ambientes`, scanners de dependencias nem CI; as evidencias de comportamento (sondas e mutacoes) vem do relatorio e foram aceitas apos conferencia do codigo lido (`deploy.sh`, `deploy-lib.mjs`) e coerencia com o ADR e o ticket.
- Nao li integralmente `secret.ts`, `secret.py`, `settings.py`, `primitives.ts` e `main.ts`; para esses arquivos a decisao se apoia nas linhas e sondas citadas pelo relatorio.
- Nenhuma decisao humana foi reaberta (ADR-020 aceito; BLOCKED de staging mantido).
- Primeiro ciclo de auditoria: nao ha decisoes anteriores a preservar.
