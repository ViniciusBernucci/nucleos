# DEC-007 — Orquestração durável de tarefas (ADR-021 e PoC) — 2026-10-26

## 1. Metadados

- **Domínio:** mensageria
- **Tarefa:** DEC-007 do lote 2026-10-25-ep00-ep01-fundacao — [ENT-DEC-007](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-007)
- **Branch:** `tarefa/dec-007`
- **Base / commit inicial:** `d00e8dff92f468044558d85d80bd464eef09d32a` (base informada); `HEAD` inicial igual à base; árvore da worktree limpa. A sessão foi interrompida por limite de uso e retomada: `git status` mostrava somente `documentacoes/arquitetura/poc/dec-007/` não rastreado, nenhum commit prévio, nenhum container `dec007` residual.
- **Estado da entrega:** pronta para revisão independente. ADR-021 em status **Proposto**.
- **Autores conhecidos:** Claude Sonnet 5.5 (executor); solicitante: Vinícius

## 2. Objetivo, contexto e escopo

- **Objetivo:** decidir (como proposta) a fonte de verdade das tarefas e o mecanismo de entrega: tabela PostgreSQL com lease, BullMQ+Redis ou Temporal, com tabela de resultados por cenário (AC-1), prova de que a opção escolhida não perde nem duplica efeito (AC-2) e gatilhos de reconsideração (AC-3).
- **Contexto:** ADR-009 (execuções duráveis), ADR-008, ADR-017 (aceito), ADR-018 (aceito); depende de DEC-003 e DEC-004.
- **Escopo:** ADR-021, PoC descartável reproduzível, esta entrega, lesson 11 (renumerada na integração; era 07, provisória) e índices.
- **Fora do escopo:** código de produção em `packages/`/`services/` (MSG-001/MSG-003); Temporal de produção (servidor, banco dedicado, vários serviços); BullMQ com backend PostgreSQL; BullMQ Pro; espera real de dias na aprovação humana; AC "ADR aceito" (decisão humana).

## 3. Resumo da implementação

PoC em `documentacoes/arquitetura/poc/dec-007/` compara as três opções com o mesmo handler idempotente (efeito por `task_id`, `ON CONFLICT DO NOTHING`), lease/heartbeat/lock de 5 s e limite de 2 tarefas por tenant. `run.sh` sobe PostgreSQL 16, Redis 8.8.3 e Temporal (`start-dev`) em containers efêmeros publicados só em `127.0.0.1`, sem dados reais, executa 10 cenários por opção (S1..S10, com variantes) e métricas, e destrói os containers (inclusive volumes anônimos, `docker rm -fv`). Workers e produtor ("Dispatcher") são processos filhos mortos com `SIGKILL` nos cenários de falha.

Resultado (ADR-021 tem a tabela completa; [saída](../arquitetura/poc/dec-007/evidencia/saida-poc.txt)): a opção A (PostgreSQL com lease) passou em todos os cenários; B (BullMQ) falhou sem AOF (50/50 tarefas perdidas), em relógio dessincronizado e na atomicidade com o banco, e com fila única em limite e justiça; C (Temporal dev server) falhou no limite global por tenant, na justiça sob rajada (servidor sqlite saturado) e na atomicidade. Em todas as opções, a idempotência do consumidor absorveu as reentregas sem perda de efeito. Ressalva: como `effects` tem chave primária por `task_id`, a ausência de efeito duplicado não é medida de forma independente (ver seção 11).

Achado fora do roteiro: a documentação do BullMQ 6 descreve um backend PostgreSQL opcional (consulta em 2026-10-26); registrado no ADR como alternativa B' não avaliada.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0021-orquestracao-duravel-de-tarefas.md` | doc | ADR-021 (Proposto) |
| `documentacoes/arquitetura/adr/README.md` | doc | linha ADR-021 no índice |
| `documentacoes/arquitetura/poc/dec-007/run.sh` | código | sobe/destrói containers e executa a PoC |
| `.../poc/dec-007/poc.mjs` | código | orquestrador, cenários S1..S10 e métricas |
| `.../poc/dec-007/lib.mjs` | código | configuração, banco de efeitos, handler comum, utilitários docker/estatística |
| `.../poc/dec-007/impl-pg.mjs`, `impl-bullmq.mjs`, `impl-temporal.mjs`, `temporal-workflows.mjs` | código | as três opções |
| `.../poc/dec-007/worker.mjs`, `producer.mjs` | código | processos filhos (worker e Dispatcher) |
| `.../poc/dec-007/package.json`, `package-lock.json`, `.gitignore` | config | dependências fixadas (exatas) e cache ignorado |
| `.../poc/dec-007/evidencia/saida-poc.txt` | evidência | saída real da execução |
| `lessons/11 - Fila duravel em PostgreSQL com lease.md`, `lessons/README.md` | doc | lesson (numeração provisória) e índice |
| esta entrega e `-diffs.md` | doc | registro |

Dependências novas (apenas na pasta da PoC, com lock file): `pg` 8.23.1, `bullmq` 6.4.2, `ioredis` 6.0.0, `@temporalio/{client,worker,workflow,activity}` 1.24.0. Não foram adicionadas aos workspaces.

## 5. Decisões técnicas, alternativas e consequências

No [ADR-021](../arquitetura/adr/0021-orquestracao-duravel-de-tarefas.md). Escolhas da PoC: relógio sempre do banco (`now()`) na opção A; BullMQ medido em dois layouts (fila por tenant com `setGlobalConcurrency(2)` e fila única) porque o limite por tenant só é viável com fila por tenant; Temporal com uma task queue por tenant e `maxConcurrentActivityTaskExecutions` 2 por worker (não existe cap global equivalente medido); `heartbeatTimeout` de 5 s equivale à lease; o claim da opção A é SQL direto no worker apenas na PoC (no produto, via Control Plane, ADR-018).

## 6. Validações (comandos e resultados reais)

| Comando | Resultado |
| --- | --- |
| `documentacoes/arquitetura/poc/dec-007/run.sh` (Node v24.22.1, Docker 29.8.1, Compose 5.5.1), execução completa de 1267 s | Opção A: todos os cenários PASS ("Opcao A (PostgreSQL lease): todos os cenarios PASS"); B e C com FAIL esperados e documentados; containers destruídos (`docker ps -a` sem `dec007*` depois). Detalhe abaixo |
| `ONLY=temporal SKIP_PERF=1 ./run.sh` (diagnóstico) | revelou que `--db-filename /data/...` falhava (diretório inexistente); corrigido para `/tmp/temporal.db` antes da execução final |
| Execução de exemplo da lesson 11 em container novo (`postgres:16`, `127.0.0.1:55440`) | saída conforme a lesson; container removido (`docker rm -fv`) |
| `./scripts/check-secrets.sh` (gitleaks) | `no leaks found` |
| `npm view` (bullmq, pg, ioredis, @temporalio/client) | versões e datas registradas no ADR |

Observações sobre a evidência: (a) `saida-poc.txt` termina com `exit 143`: o processo `node poc.mjs` não encerrava após o resumo (conexões do cliente Temporal/Redis abertas) e foi terminado manualmente depois de imprimir "containers destruidos"; em seguida foi acrescentado `process.exit(...)` ao fim de `poc.mjs`, uma linha que não altera cenários nem métricas e não foi reexecutada isoladamente. (b) Nesta execução, o resumo da opção A em S7 mostra 0 reentregas. (c) Resultados de uma única execução em máquina compartilhada com outros containers; tempos e throughput variam entre execuções (uma execução anterior parcial da opção A deu 47 tarefas/s na rajada, esta 49).

Não executado: `make lint`, `make test`, `make build` (a PoC não pertence aos workspaces e a worktree não tem `make setup`; mesma justificativa de DEC-003); validação de links por ferramenta (conferidos por leitura); CI não aplicável a esta entrega (FND-005 existe, mas esta worktree não abre PR); espera real de dias na aprovação humana (S9 em tempo comprimido); Temporal de produção; BullMQ com backend PostgreSQL.

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- Sem impacto em produção ou nos workspaces. Containers publicados só em `127.0.0.1`; PostgreSQL com senha aleatória descartável (nunca impressa); Redis e Temporal dev sem autenticação, aceitável apenas por serem efêmeros em loopback. Outros containers da máquina (de outros projetos) não foram tocados: os nomes usados são `dec007-*`.
- Riscos: medidas em uma máquina, uma execução, tmpfs não usado (PostgreSQL com fsync padrão); Temporal em modo `start-dev` não representa produção; S9 em tempo comprimido; polling a 100 ms por worker na opção A.
- Rollback: reverter o commit; não há containers nem volumes remanescentes.

## 8. Commits e diffs

- Início: branch `tarefa/dec-007`, `HEAD` `d00e8dff92f468044558d85d80bd464eef09d32a`, árvore limpa, base idem (`origin/main` merge-base `eff2d62...`, não usada como base por ter sido informada outra).
- Um commit local desta tarefa (sem amend), mensagem `docs(mensageria): ADR-021 e PoC de orquestracao duravel de tarefas (DEC-007)`. O SHA não pode constar dentro do próprio commit; é informado no relatório de integração (`git log -1`).
- Diffs de código e configuração: [arquivo de diffs](2026-10-26-dec-007-orquestracao-duravel-diffs.md) (diff da árvore de trabalho antes do commit). Sem diff textual por regra: `evidencia/saida-poc.txt`; `package-lock.json` (sha256 `fa9122bbd403feb9802d15cb4ba3b2cff0878cb4e871a266ed3171149cfb0556`); documentos de registro, ADR e lessons.

## 9. Lessons

- [11 - Fila duravel em PostgreSQL com lease](../../lessons/11%20-%20Fila%20duravel%20em%20PostgreSQL%20com%20lease.md) e [índice](../../lessons/README.md). Numeração provisória: o coordenador reconcilia com as lessons 04–06 existentes em outras branches.
- Sem lessons para BullMQ/Temporal: ferramentas não adotadas; os fatos ficam no ADR.

## 10. Pendências

Nenhuma pendência técnica conhecida da tarefa. Dependem de decisão humana: aceitar/alterar/rejeitar o ADR-021; confirmar gatilhos numéricos; aceitar o trade-off de throughput e latência da opção A; autorizar avaliação de BullMQ sobre PostgreSQL e de Temporal de produção; política de classificação/retenção do payload das tarefas; política de retry, dead-letter e cancelamento (lista completa no ADR-021).

## 11. Correção rodada 1 (review [2026-10-26-review-dec-007](../reviews/2026-10-26-review-dec-007.md), somente texto; PoC não alterada)

- **REVIEW-001:** o ADR (seção Resultados) declara que a PK por `task_id` em `effects` impede medir "nenhum efeito duplicado" de forma independente; a PoC prova ausência de perda e absorção das reentregas, e o limite do AC-2 fica explícito.
- **REVIEW-002:** o ADR declara que a saída é anterior ao `process.exit` em `poc.mjs` e termina com `exit 143`.
- **REVIEW-003:** o ADR anota imagens por tag mutável, digests só na saída, e que produção deve fixar o digest.
- **REVIEW-004:** nota de que S3 difere entre opções (1 vs 2 execuções de `s3-1`) pelo momento do crash, sem mudar a conclusão.
- **REVIEW-005:** o ADR registra a limitação do `finally`/`fx.end()`; o `trap` de `run.sh` cobre o uso documentado.
- **Arquivos tocados:** ADR-021 e esta entrega. A lesson só ganhou a ressalva de idempotência (abaixo). Commit: um novo (sem amend) sobre `c6c1e81`; SHA no relatório. Validação: releitura; nenhum comando de PoC reexecutado.
