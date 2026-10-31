# Revalidacao focal - DEC-010, rodada de correcao 1/3

Data: 2026-10-26. Revisor independente (sessao nova; nao implementou). Modo: revalidacao (somente IDs APLICAR, commit de correcao e raio de impacto).

## Cabecalho

- Worktree/branch: `/home/vinicius/nucleos-worktrees/tarefa/dec-010`, `tarefa/dec-010`. Arvore limpa ao iniciar.
- Revisado: `git diff 889b7f8..HEAD` (HEAD = `e8321f3`; inclui review `939eaac` e auditoria `68e8e91`). Correcao em `e8321f3`: ADR-024, registro, lesson 03.
- Verificacoes executadas: `git diff 889b7f8..HEAD --stat` (nenhum arquivo em `infrastructure/`, nem `-diffs.md`, nem `-saida-poc.txt`; PoC nao reexecutado porque nenhum codigo mudou); exemplo da lesson extraido e rodado com `python3 -I` (3.10.12): imprime `ok`; links relativos de ADR, registro e lesson conferidos (os alvos existem, inclusive o `tickets.md`; as ancoras `#ent-dec-010` nao foram checadas); ADR continua **Proposto** (linha 3 e `adr/README.md:28`); indice de lessons inalterado e coerente.

## Classificacao dos IDs APLICAR

| ID | Classificacao | Evidencia |
| --- | --- | --- |
| REVIEW-001 | CORRIGIDO | ADR (Evidencia): "Bypass direto do gateway nao medido ... PoC nao fez requisicao direta a `loki:3100`"; lesson (Modelo mental e Conexao): "premissa da documentacao ... **nao medida**" e "no pedido ao gateway"; registro (Ressalvas de escopo) e controle negativo direto exigido em OBS-001 (item e). Afirmacao agora no limite do medido. |
| REVIEW-002 | CORRIGIDO | ADR Trade-offs: "O PoC nao restringe escrita" (class `audit` gravavel pelo tenant, `tenant_id` do corpo, `A\|B` em push nao testado); Consequencias: requisitos (a)-(e) para o gateway de producao (class por credencial, tenant_id validado, push negado a admin, audit nao gravavel, controle negativo). Cobre toda a correcao sugerida; `nginx.conf.tpl` intocado, como planejado. |
| REVIEW-003 | CORRIGIDO | ADR: "Redacao ponta a ponta (escopo limitado)" com lista de nao exercitados (campo permitido, aninhado, excecao, headers/query, spans, extensoes da allowlist); registro replica. Casos extras no driver adiados e declarados. |
| REVIEW-004 | CORRIGIDO | ADR Decisao 6 e registro: so `retention_enabled`/`retention_period: 2w` na saida, `0s` extra "nao explicado", regras `debug`/`audit` apenas inferidas do boot. Confere com a saida real. `grep` adiado e declarado. |
| REVIEW-006 | CORRIGIDO | (a) "digest em producao; o PoC usou apenas tags"; (b) "Loki, Tempo e Prometheus nao publicam porta; Grafana so em 127.0.0.1/VPN (o PoC o publica)"; (c) Decisao 3 marcada **[NAO VERIFICADO]** apontando para "Fatos de ferramentas" (secao existe, linha 81). |
| REVIEW-007 | CORRIGIDO | Lesson: "exige Python 3.10+ ... executado em 3.10.12"; typo "a credencial"; instrucao "(Python 3.10+)". Exemplo roda e imprime `ok` com `python3 -I`. Numeracao 01 para 03 segue adiada ao coordenador (decisao do auditor, explicita no registro e no indice). |

Nenhuma REGRESSAO nem AINDA PRESENTE. REVIEW-005 e REVIEW-008 (ADIAR) permanecem fora desta revalidacao e estao listados como pendencias reais.

## Novos achados

### REV-001 - BAIXO (honestidade do registro) - Resumo de validacao sem a ressalva

- `documentacoes/observabilidade/2026-10-26-dec-010-telemetria.md:26` ainda resume "tentativas de forjar `X-Scope-OrgID` ... redacao ponta a ponta com sentinelas" sem qualificar; as ressalvas estao so no paragrafo da linha 53. O ADR ja qualifica no ponto de uso. Leitor que le apenas o resumo supoe cobertura maior.
- Correcao sugerida: acrescentar "(via gateway; escopo de redacao limitado, ver Ressalvas)" na linha 26. Nao bloqueante.

### REV-002 - BAIXO (evidencia do registro) - Validacao da rodada vaga

- Registro, secao "Correcao rodada 1": "Validacao: `make lint` (ver commit abaixo)". O commit `e8321f3` nao traz resultado de `make lint`, e a mudanca e somente Markdown (lint de codigo nao e exercitado). O unico resultado verificavel citado e o exemplo da lesson. Pelo CLAUDE.md, validacoes devem ter comando e resultado reais.
- Correcao sugerida: registrar o rc real de `make lint` se executado, ou declarar "nao executado: sem codigo alterado"; listar `e8321f3` como commit da rodada. Nao bloqueante.

Sem outros achados: sem afirmacoes novas sem evidencia, ADR segue Proposto, indice e links integros, PoC/diffs/saida intocados.

## Veredito

Todos os seis IDs APLICAR: CORRIGIDO. Dois achados BAIXOS de documentacao (REV-001, REV-002), nao bloqueantes. Revalidacao APROVADA; DEC-010 deve continuar "aguardando decisao humana" (ADR Proposto).
