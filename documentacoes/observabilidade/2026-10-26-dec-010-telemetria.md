# DEC-010 - Stack de telemetria e politica de redacao/retencao (2026-10-26)

## Metadados

- **Dominio:** observabilidade
- **Tarefa:** ENT-DEC-010, lote 2026-10-25-ep00-ep01-fundacao, perfil PADRAO, spike docs+PoC ([ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-010))
- **Branch:** `tarefa/dec-010`; **base/HEAD inicial:** `02b16a6` (arvore limpa); merge-base com `main` nao recalculado (a base foi informada pelo coordenador)
- **Estado:** implementado; ADR-024 **Proposto** (aceite depende do usuario); nao revisado nem aprovado pelo executor
- **Autores:** executor IA (Claude Sonnet 5.5) a pedido do coordenador
- **Diffs completos:** [2026-10-26-dec-010-telemetria-diffs.md](2026-10-26-dec-010-telemetria-diffs.md); saida real do PoC: [2026-10-26-dec-010-telemetria-saida-poc.txt](2026-10-26-dec-010-telemetria-saida-poc.txt)

## Objetivo, contexto e escopo

Decidir (como proposta) onde logs, metricas e traces vivem, com segregacao por tenant, allowlist de campos, retencao por classe e RAM compativel com a VPS de referencia (8 vCPU, 24 GB). Contexto: FND-009 ([registro](2026-10-25-fnd-009-baseline-observabilidade.md)) entrega a biblioteca; threat model F14/RISK-005.

Fora do escopo: implementar OBS-001 (gateway de producao, auditoria duravel, dashboards); coletor OpenTelemetry; servico gerenciado (nao avaliado); expiracao efetiva da retencao; metricas por tenant; dimensionamento de producao.

## Resumo da implementacao

- [ADR-024](../arquitetura/adr/0024-stack-de-telemetria-e-politica-de-reducao-retencao.md), **Proposto**, no template `0000-template.md`, com decisao, allowlist de campos, tabela de retencao por classe, quem consulta, alternativas, fatos com fonte/data e gatilhos de revisao. Indice [adr/README.md](../arquitetura/adr/README.md) atualizado.
- PoC efemero `infrastructure/docker/poc-telemetria/`: Loki 3.7.9, Tempo 2.10.10, Prometheus v3.15.1, Grafana 13.2.4 e gateway nginx 1.28-alpine em containers descartaveis; portas publicadas apenas em `127.0.0.1` (gateway e Grafana); tokens aleatorios por execucao em diretorio temporario `0700` apagado ao final; `trap` destroi containers, volumes e rede. O driver usa a biblioteca real `nucleos_observability` (FND-009).
- Ambiente isolado de PoC: ja declarado em `CLAUDE.md` (secao Dados); nao foi preciso alterar o arquivo.

### Resultados (saida real em `-saida-poc.txt`, `rc=0`)

- 33/33 verificacoes OK, 0 FALHA. Isolamento de logs e traces entre 5 tenants, tentativas de forjar `X-Scope-OrgID`, 401 sem token, rotas administrativas fora do gateway, redacao ponta a ponta com sentinelas e controles negativo/positivo (detalhes no ADR). **Ressalvas de escopo (ver "Validacoes" e "Correcao rodada 1"):** o isolamento foi medido *via gateway* (bypass direto ao Loki com header forjado nao medido); a redacao foi exercitada so para chaves sensiveis por nome e chave fora da allowlist, nao para valor sensivel em campo permitido, dict aninhado, excecao, headers/query nem atributos de span.
- RAM apos carga (~115 mil linhas, 250 spans): Loki 147 MiB, Grafana 257,4 MiB, Tempo 33,1 MiB, Prometheus 41 MiB, gateway 2,3 MiB (soma ~481 MiB; ocioso ~241 MiB). Disco: Loki 64.064 KiB, Tempo 236 KiB, Prometheus 168 KiB.
- Criterios do ticket: **AC-1** ADR com allowlist e retencao escrito, mas **nao aceito** (so o usuario aceita) - parcial; **AC-2** medicao feita e abaixo do teto *proposto* de 2 GiB, porem o orcamento nao esta declarado nas fontes e a carga e pequena - parcial, depende de decisao humana; **AC-3** provado (A nao le B em logs nem traces).

## Mudancas por arquivo

- Novos (commit `690e1e0`): `infrastructure/docker/poc-telemetria/{compose.yml,loki.yaml,tempo.yaml,prometheus.yml,nginx.conf.tpl,poc_telemetria.py,run-poc.sh}`. Sem migracao, sem alteracao de `Makefile`, sem dependencia nova (o driver usa stdlib mais o pacote de workspace ja existente; imagens fixadas por tag).
- Documentacao/lessons (commit seguinte, fora do patch): `documentacoes/arquitetura/adr/0024-stack-de-telemetria-e-politica-de-reducao-retencao.md`, `documentacoes/arquitetura/adr/README.md`, este registro, `-diffs.md`, `-saida-poc.txt`, `lessons/03 - Isolamento de telemetria por tenant.md`, `lessons/README.md`.

## Decisoes tecnicas

1. Gateway deriva o tenant do token e sobrescreve `X-Scope-OrgID`; backends sem porta publicada (alternativa descartada: confiar no header do cliente).
2. `tenant_id` fica no org id e no corpo do log, nunca como rotulo do Loki (cardinalidade).
3. Prometheus sem rotulo de tenant, coerente com FND-009; consumo por tenant fica no banco (ADR-015).
4. Verificacao de redacao por filtro no servidor (sem o teto de 5000 linhas por consulta), com controle negativo.
5. Papel `admin` so para logs (consulta multi-tenant do Loki), auditado em stdout do gateway; recusado para traces.

## Validacoes (reais)

Ambiente: Docker 29.8.1, Compose v5.5.1, Python 3.13.17 (via `uv`), Node 24.22.1, `PATH` com `~/.local/opt/node-v24.22.1-linux-x64/bin` e `~/.local/bin`.

| Comando | Resultado |
| --- | --- |
| `infrastructure/docker/poc-telemetria/run-poc.sh` (3 execucoes; a ultima salva) | rc 0; 33/33 OK; limpeza: nenhum container/volume `poc-telemetria` restante (`docker ps -a`, `docker volume ls`); portas publicadas so `127.0.0.1` |
| `uv run --frozen ruff check` e `ruff format --check`, `mypy` no driver | OK |
| `make setup && make lint` | rc 0 (inclui gitleaks "no leaks found" e regressao dos linters) |

Ressalvas de escopo (rodada 1): a saida mostra apenas `retention_enabled`/`retention_period: 2w` (as regras por classe estao em `loki.yaml` e foram aceitas pelo boot, sem listagem na saida); a redacao foi exercitada para chaves sensiveis por nome e chave fora da allowlist (nao: valor sensivel em campo permitido, dict aninhado, excecao, headers/query, atributos de span); o bypass direto ao Loki com header forjado nao foi medido (premissa vem da documentacao).

Nao executado: `make test`/`make build` (nenhum codigo de aplicacao alterado), CI (FND-005 inexistente neste ramo), coletor OTel, expiracao de retencao, carga em VPS real. Falhas intermediarias do desenvolvimento do PoC (1 verificacao de admin com teto de 5000 linhas; `du` ausente nas imagens) foram corrigidas no proprio PoC antes da execucao final.

## Impactos, riscos, compatibilidade e rollback

- Impacto: nenhum codigo de producao alterado; PoC isolado. Rollback: reverter o commit de codigo e os documentos.
- Riscos: isolamento depende de o gateway nao ser contornado (rede/politica de rede obrigatorias); auditoria do PoC e so stdout; redacao e a unica defesa de conteudo; pacote Python usa `--all-packages` e cria `.venv` na worktree (ignorado pelo Git).
- Observabilidade: metricas de plataforma sem tenant; correlacao log/trace ja existente em FND-009.

## Fatos de ferramentas (fonte e data de consulta: 2026-10-26)

Ver a secao homonima do ADR (docs do Loki e Tempo; versoes pela API do Docker Hub). Prometheus: a FAQ consultada nao trata multi-tenancy; a afirmacao "sem multi-tenancy nativa" **nao foi verificada em fonte**.

## O que depende de decisao humana

1. Aceitar, alterar ou rejeitar o ADR-024 (stack LGTM no mesmo host vs. host separado vs. gerenciado - este ultimo nao avaliado).
2. Teto de RAM/disco da telemetria (proposto 2 GiB; sem orcamento declarado nas fontes).
3. Retencao por classe (3d/14d/365d logs, 7d traces, 15d metricas) e base legal/LGPD (ENT-DEC-011); janela maxima apos offboarding (RISK-014).
4. Lista de campos extras da allowlist (`tokens_in/out`, `cost_micros`, `queue_wait_ms`, `retries`, `error_code`, `model`).
5. Se tenants poderao consultar telemetria diretamente; se ha necessidade de metrica por tenant.
6. Destino duravel e a prova de adulteracao para a auditoria de consultas administrativas; procedimento de purga de log com segredo.
7. Confirmar a afirmacao sobre Prometheus e avaliar Tempo 3.x e alternativas nao avaliadas.

## Lessons

[03 - Isolamento de telemetria por tenant](../../lessons/03%20-%20Isolamento%20de%20telemetria%20por%20tenant.md) (nova; seguranca/isolamento por gateway) e [indice](../../lessons/README.md). A lesson de redacao/logging de FND-009 continua pendente e **nao foi duplicada** aqui; so e referenciada. A numeracao `03` evita o `02` usado por FND-005 em outra branch; o coordenador deve reconciliar numeracao/indice na integracao. Docker/Compose: o PoC exercita Compose, mas ja ha lesson planejada no bloco 4 (FND-004 pendente); sem lesson duplicada.

## Commits e diffs

- `690e1e029c10d17d113dee4c0e49dec8032272ba` - `feat(infra): PoC efemero de telemetria LGTM com isolamento por tenant (DEC-010)`: diff completo em [-diffs.md](2026-10-26-dec-010-telemetria-diffs.md) (7 arquivos, 597 insercoes).
- Commit de documentacao e lessons: o proprio commit que contem este registro (SHA informado ao coordenador no retorno; um documento nao pode conter o proprio SHA). Seus arquivos sao os listados acima em "Documentacao/lessons" e nao entram em patch.

## Correcao rodada 1 (review `939eaac`, auditoria `68e8e91` em `documentacoes/reviews/`)

Aplicados REVIEW-001, 002, 003, 004, 006 e 007, somente em Markdown (ADR-024, este registro, lesson 03); PoC, `-diffs.md` e `-saida-poc.txt` inalterados.
- 001: ADR, lesson e registro dizem que o bypass direto ao Loki nao foi medido; so o gateway sobrescrever o header foi medido.
- 002: ADR registra que o PoC nao restringe escrita (classe `audit` e `tenant_id` do corpo controlados pelo tenant) e exige no gateway de producao: `class` por credencial, `tenant_id` validado, push negado ao admin, `audit` nao gravavel pelo tenant, controle negativo direto.
- 003/004: frases de cobertura de redacao e de retencao limitadas ao que a saida mostra.
- 006: ADR coerente (digest em producao/tags no PoC; porta do Grafana; Prometheus **[NAO VERIFICADO]** na decisao).
- 007: lesson com Python 3.10+ (verificado em 3.10.12) e typo corrigido.
- **Adiados (pendencias):** REVIEW-005 (contagem `accepted == 250` e mais traces amostrados no driver), REVIEW-008 (`|| true` na subida e limpeza de volumes no `run-poc.sh`), ajuste do `grep` de retencao e casos extras de redacao no driver; condicao: proxima alteracao do PoC ou OBS-001. Renumeracao da lesson 03 cabe ao coordenador na integracao.
- Validacao (executada na rodada 1, com as edicoes ja aplicadas na arvore, antes do commit `e8321f3`): `make lint` com `PATH` de usuario, **rc 0**; exemplo da lesson reexecutado com `python3 -I` (imprimiu `ok`); `git diff 02b16a6 690e1e0 -- infrastructure` identico ao patch do `-diffs.md`.

## Correcao rodada 2 (revalidacao `documentacoes/reviews/2026-10-26-revalidacao-dec-010-r1.md`, `1e41f75`)

Somente este registro foi alterado (PoC, ADR, lesson, `-diffs.md` e `-saida-poc.txt` intactos).
- REV-001: o resumo de resultados (33/33) agora traz as ressalvas de escopo de isolamento e redacao.
- REV-002: a validacao da rodada 1 informa comando e resultado reais (`make lint`, rc 0). Nesta rodada 2 **nao** se reexecutou `make lint` nem o PoC, pois so este Markdown mudou.
- Commit da rodada 2: o que contem esta secao (SHA informado ao coordenador; um documento nao contem o proprio SHA). Commits anteriores: `690e1e0` (PoC), `889b7f8` (docs), `e8321f3` (rodada 1).

## Pendencias

Alem das decisoes humanas e das lacunas acima (expiracao de retencao nao provada, coletor OTel nao exercitado, medicao em carga real, bypass direto ao Loki nao medido): REVIEW-005 e REVIEW-008 e os ajustes do PoC listados na rodada 1, adiados.
