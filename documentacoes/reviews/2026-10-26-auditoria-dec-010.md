# Auditoria independente do review - DEC-010

Data: 2026-10-26. Auditor independente do implementador e do revisor; nao implementa e nao altera codigo.

## Cabecalho

- Relatorio de origem: `documentacoes/reviews/2026-10-26-review-dec-010.md` (veredito original APPROVED com ressalvas, preservado; commit `939eaac4cb6998477128b100f4f2dfaff1a1f045`).
- Tarefa: ENT-DEC-010 (spike docs+PoC, perfil PADRAO), lote 2026-10-25-ep00-ep01-fundacao.
- Worktree/branch: `/home/vinicius/nucleos-worktrees/tarefa/dec-010`, `tarefa/dec-010`. Base `02b16a6`; HEAD auditado `939eaac4cb6998477128b100f4f2dfaff1a1f045`; commits da tarefa `690e1e0` (PoC) e `889b7f8` (docs). Arvore limpa ao iniciar; nenhuma mudanca desde a revisao.
- Sessao: auditor-de-review (Claude Sonnet 5.5), distinta do executor e do revisor.
- Base normativa: AC do ENT-DEC-010 (ADR-024 aceito com allowlist/retencao; RAM/disco; prova de que A nao le B), ADR-024 (Proposto: so o usuario aceita), CLAUDE.md (pronto = docs coerentes com a entrega; diffs documentados devem ser reais).

## Resumo das decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | MEDIO | BAIXO | APLICAR (plano corrigido: so texto) |
| REVIEW-002 | MEDIO | MEDIO | APLICAR (so ADR) |
| REVIEW-003 | BAIXO | BAIXO | APLICAR (so texto); casos extras ADIADOS |
| REVIEW-004 | BAIXO | BAIXO | APLICAR (so texto); ajuste do `grep` ADIADO |
| REVIEW-005 | BAIXO | BAIXO | ADIAR |
| REVIEW-006 | BAIXO | BAIXO | APLICAR |
| REVIEW-007 | BAIXO | BAIXO | APLICAR (versao e typo); numeracao ADIADA ao coordenador |
| REVIEW-008 | BAIXO | BAIXO | ADIAR |

Veredito da auditoria: **CORRECOES_NECESSARIAS** (somente edicoes de documentacao/lesson; nenhuma altera o PoC). Nenhum achado e bloqueante; nenhum e AUDITORIA_BLOQUEADA.

Principio de plano: o `-diffs.md` e a `-saida-poc.txt` sao evidencias reais do commit `690e1e0` (o revisor confirmou que o diff documentado e identico ao do git). Alterar `infrastructure/docker/poc-telemetria/` exigiria reexecutar o PoC e regenerar saida e diffs, custo desproporcional para um spike com ADR Proposto. Por isso as correcoes APLICAR ficam em texto, ajustando afirmacoes ao que foi realmente medido.

## Analise por achado

### REVIEW-001 - APLICAR (plano corrigido), severidade avaliada BAIXO

- Verificado: `nginx.conf.tpl` usa `proxy_set_header X-Scope-OrgID $tenant` e `poc_telemetria.py` testa forjamento apenas via gateway. Ausencia de controle negativo direto no Loki e real.
- O AC-3 (A nao le B pela identidade de A) e atendido e medido; o forjamento e uma defesa adicional. O ADR ja diz em Trade-offs "se contornado, o header vale" e a secao de fatos cita a doc do Loki. O defeito real e de redacao: a lesson ("a prova mede") sugere que o bypass foi medido. Rebaixado: nao ha falha de seguranca, so afirmacao que excede a evidencia.
- Plano minimo: na lesson 03 (Conexao com a entrega real e Modelo mental), no ADR-024 (Evidencia do PoC) e no registro, dizer que a premissa "o backend confia no header" vem da documentacao do Loki/Tempo e **nao foi medida** no PoC; o que foi medido e que o gateway sobrescreve o header. Registrar como pendencia/para OBS-001 o controle negativo (requisicao direta a `loki:3100` com header forjado, de container efemero na rede).
- Risco: nenhum. Teste esperado: leitura; `grep` por "nao foi medida" nos tres documentos.

### REVIEW-002 - APLICAR (so ADR), severidade MEDIO mantida

- Verificado: `nginx.conf.tpl` libera `push` para qualquer papel; `poc_telemetria.py` escolhe o rotulo `class`; ADR-024 (Decisao 4/6 e Trade-offs) nao registra que o cliente controla `class`/`tenant_id` do corpo nem que `audit` e gravavel pelo proprio tenant. Isso e lacuna de decisao de seguranca relevante a T-F14-T/R e ao proposito da classe `audit` (365 d); um ADR honesto deve declarar a premissa que OBS-001 precisa cumprir.
- Plano minimo: acrescentar em Trade-offs e Consequencias do ADR-024 (e uma linha na tabela de pendencias do registro): o PoC nao restringe escrita; o gateway de producao deve (a) fixar/derivar `class` por credencial/servico, (b) validar ou reescrever `tenant_id` do corpo, (c) negar push ao papel `admin`, (d) impedir que a trilha `audit` seja gravavel pelo proprio tenant; comportamento do Loki com `A|B` em push (400 segundo a doc) **nao testado**. Nao alterar o `nginx.conf.tpl`.
- Risco: nenhum. Teste esperado: leitura do ADR; o criterio vira requisito de aceite de OBS-001 (mencionar).

### REVIEW-003 - APLICAR (texto), casos extras ADIADOS

- Verificado: sentinelas cobrem `prompt, content, token, authorization, api_key` e `email`; o ADR (Evidencia, "Redacao ponta a ponta") e o "Proibidos sempre" listam mais itens. A redacao em si e propriedade da biblioteca FND-009 (ja com testes proprios), nao do AC-3.
- Plano minimo: no ADR e no registro, limitar a frase a "chaves sensiveis por nome e chave fora da allowlist" e listar como **nao exercitados no PoC**: valor sensivel em campo permitido, dict aninhado, mensagem de excecao, headers/query, atributos de span. Adicionar casos ao driver fica ADIADO (condicao: proxima alteracao do PoC ou OBS-001).
- Risco: nenhum.

### REVIEW-004 - APLICAR (texto), ajuste do grep ADIADO

- Verificado: `run-poc.sh:82` filtra `- selector` e `period: (72h|8760h)`, mas a saida registrada traz so `retention_enabled`, `retention_period: 2w` e `0s`; `loki.yaml` define `retention_stream` com 72h e 8760h. As classes `debug`/`audit` so sao inferidas do boot bem-sucedido. ADR ja admite que a expiracao nao foi provada, mas "sobe com a configuracao de retencao" e mais forte que a saida.
- Plano minimo: no ADR (Decisao 6) e registro (Validacoes), declarar que a saida mostra apenas `retention_enabled`/`retention_period` (o `0s` extra e outro campo de limites, nao explicado) e que as regras por classe constam em `loki.yaml` e foram aceitas pelo boot, sem listagem na saida; extensoes `tokens_out, cost_micros, queue_wait_ms, retries, model` nao exercitadas. Corrigir o `grep` exigiria reexecutar o PoC: ADIADO.
- Risco: nenhum.

### REVIEW-005 - ADIAR

- Verificado: `len(traces) == 5` e o rotulo "5 x 50 spans aceitos" sao imprecisos, mas qualquer resposta diferente de 200 gera `check(..., False)`; com 33/33 aprovado, todos os 250 envios foram aceitos (a conclusao do registro e dedutivel, nao falsa). Isolamento de traces com um trace por tenant e suficiente para AC-3 num spike.
- Impacto residual: rotulo impreciso e amostragem pequena. Motivo: corrigir exige alterar o driver e reexecutar PoC/regenerar evidencias. Retomada: qualquer reexecucao do PoC ou OBS-001 (contar `accepted == 250`, amostrar varios traces).

### REVIEW-006 - APLICAR

- Verificado no ADR-024: (a) Decisao 1 diz "versoes fixadas por tag/digest" e o PoC usa so tags (`compose.yml`), inclusive `nginx:1.28-alpine`; (b) Decisao 2 diz que Grafana nao publica porta, mas o PoC publica `127.0.0.1:13000` (a frase seguinte admite); (c) Decisao 3 afirma "sem multi-tenancy nativa" como fato, embora a secao de fatos a marque nao verificada. Os tres sao incoerencias reais do documento que sera lido para aceitacao.
- Plano minimo: (a) "digest em producao; tags no PoC"; (b) "Loki, Tempo e Prometheus nao publicam porta; Grafana apenas em 127.0.0.1/VPN; so o gateway e alcancavel pelos clientes"; (c) marcar **[NAO VERIFICADO]** no ponto da decisao. Risco: nenhum.

### REVIEW-007 - APLICAR (versao e typo); numeracao ADIADA

- Verificado: a lesson (linha 4) afirma Python 3.9+ e o exemplo usa `str | None` / `dict[str, str] | None` em assinaturas sem `from __future__ import annotations` (grep confirmou ausencia); isso falha no 3.9. CLAUDE.md exige versoes corretas dos exemplos. Typo "e o credencial" confirmado.
- Plano minimo: trocar para "Python 3.10+ (testado em 3.10.12 e 3.13)" - o revisor executou 3.10.12; nao afirmar 3.13 sem execucao, usar "versao declarada 3.13.17 conforme repositorio; verificado em 3.10.12" - e corrigir "e o credencial" para "e a credencial". Teste: `python3 -I` do exemplo imprime `ok`.
- Numeracao `01 -> 03`: justificada no indice (02 reservado a FND-005, outra branch); decisao de reconciliar e do coordenador na integracao do lote (ADIAR; condicao: ao integrar, renumerar apenas se 02 nao for criada, atualizando indice e links).

### REVIEW-008 - ADIAR

- Verificado: `run-poc.sh:51` tem `| tail -n 12 || true` com `sleep 20`; a limpeza (linha 20) lista so containers. O revisor comprovou que nada restou em duas execucoes; o `trap EXIT` com `down -v --remove-orphans` limpa volumes/rede. A falha de subida seria detectada adiante (as verificacoes falhariam, rc != 0), portanto o mascaramento nao produz falso OK.
- Impacto residual: diagnostico menos claro; sem risco de dados ou seguranca. Mudar o script exige reexecutar o PoC e regenerar diffs/saida. Retomada: proxima edicao do PoC ou migracao para OBS-001.

## Lacunas do review

- O review nao conferiu o AC-1 literal: o ticket pede "ADR-024 aceito"; a entrega deixa **Proposto** e o ADR/registro declaram AC-1/AC-2 parciais por serem decisao humana. Correto, mas o coordenador deve manter DEC-010 como "aguardando decisao humana" no pacote final.
- Nao ha lacuna essencial adicional de seguranca: portas em 127.0.0.1, segredos efemeros, limpeza e gitleaks foram verificados pelo revisor; auditoria nao encontrou item contrario na leitura de `nginx.conf.tpl`, `loki.yaml` e `run-poc.sh`.

## Instrucao objetiva ao review-loop-driver (somente APLICAR: 001, 002, 003, 004, 006, 007)

Editar apenas estes arquivos, sem tocar em `infrastructure/docker/poc-telemetria/`, `-diffs.md` ou `-saida-poc.txt`:
1. `documentacoes/arquitetura/adr/0024-stack-de-telemetria-e-politica-de-reducao-retencao.md`: itens 001 (evidencia/trade-offs), 002 (trade-offs/consequencias), 003, 004, 006 conforme planos acima.
2. `documentacoes/observabilidade/2026-10-26-dec-010-telemetria.md`: espelhar 001, 002, 003, 004 em Validacoes/Decisoes/Pendencias e registrar o novo commit de correcao.
3. `lessons/06 - Isolamento de telemetria por tenant.md`: 001 (texto), 007 (versao Python, typo); atualizar "ultima atualizacao".
4. Reler tudo (CLAUDE.md), rodar `make lint`, conferir que links e o resumo permanecem coerentes; registrar o commit da correcao no registro sem alterar o patch do PoC.

## Riscos de regressao

Baixo: so Markdown. Riscos: quebrar links relativos ou deixar o registro desatualizado em relacao ao novo commit; o patch documentado em `-diffs.md` deve continuar igual a `git diff 02b16a6 690e1e0 -- infrastructure`.

## Limitacoes desta auditoria

Nao reexecutei o PoC nem Docker (confiei na reexecucao do revisor, 33/33); nao testei Python 3.9 (conclusao por semantica da linguagem); nao revalidei datas das tags no Docker Hub; Loki com `A|B` em push e expiracao de retencao seguem sem teste. Decisoes sobre aceitar o ADR, orcamento de 2 GiB e valores de retencao permanecem humanas.
