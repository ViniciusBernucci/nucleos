# Auditoria independente da review DEC-004 - 2026-10-25

- Relatorio de origem: `documentacoes/reviews/2026-10-25-review-dec-004.md` (REV-001..007; veredito do revisor preservado: APPROVED WITH NOTES).
- Tarefa: DEC-004 (ENT-DEC-004, perfil critico, auditoria obrigatoria). Spec: `documentacoes/backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-004` (AC-1..3).
- Worktree (somente leitura): /home/vinicius/nucleos-worktrees/tarefa/dec-004; branch `tarefa/dec-004`; base 4be3ce391a51b9e24cd85f7c894d841636dcd50f; HEAD 4c6bd4a8030a503e10032e2f55cde63cce933526 (confirmado com `git rev-parse`); arvore sem alteracoes de rastreados; nenhuma mudanca desde a review.
- Auditor: sessao independente (nao implementou nem revisou). Nao editou codigo do PoC/ADR e nao commitou. Escopo lido: ADR-018, `lib/validator.mjs`, `lib/control-plane.mjs`, `lib/env.mjs`, `bench.mjs`, `saida/bench.txt`, README do PoC, documento da entrega. Node 24.22.1.

## Reproducoes proprias (scripts no scratchpad, fora do repo)

**REV-001 - reproduzido.** Cenario: enroll A, validador `tool-gateway` com refresh, token ver=1 emitido; `cp.revokeTenantCredentials(A)` sem `refresh()`. Resultado: `revogado, sem refresh, aceito ver= 1`. Com 250 s de relogio simulado sem refresh (CP "fora", ainda dentro do TTL) o token revogado continua aceito. `grep generated_at lib/validator.mjs` = nenhuma ocorrencia: o campo e emitido pelo CP (`control-plane.mjs:61`) e nunca consumido; nao ha idade maxima. O ADR (decisoes 4 e 7, Trade-offs) so afirma que "tokens vivos seguem validando ate o exp" quando o CP cai, e que o tempo de efeito da revogacao e "o intervalo de poll no pior caso" - isso so vale se o poll tiver sucesso. Falha de poll/particao nao esta definida (fail-open implicito). O proprio token nao tem como compensar (so `exp` <= 600 s).

**REV-003 - reproduzido.** `saida/bench.txt` (entrega): p99 tool-gateway 5391 us, dispatcher 8701 us. Minhas 3 execucoes de `node bench.mjs` (tool-gateway, mesma VM): p50 = 224,2 / 229,8 / 220,8 us; p99 = **8296,8 / 4071,0 / 1735,2 us**. Ou seja, o p99 varia ~5x entre execucoes: 2 das 4 medicoes disponiveis (entrega + minhas 3) excedem 5 ms (entrega 5391 us, minha 1a 8297 us; dispatcher na entrega 8701 us) e 2 ficam abaixo (4071 e 1735 us). A mediana e estavel (~225 us). Conclusao: p99 **inconclusivo** frente ao gatilho de 5 ms do ADR (secao "Quando revisar"), nao "acima do gatilho" de forma consistente; o ADR (Beneficios) cita apenas a mediana 231 us e nao diz que o p99 oscilou em torno do gatilho. O documento da entrega ja declara p99 instavel. AC-3 (validacao local sem rede) esta atendido (`networkCalls`=0). O ajuste e de honestidade textual no ADR. Observacao: o p99 em microbenchmark de ~220 us de mediana com picos de ms e tipico de GC/escalonamento de VM; nao ha evidencia de que seja custo da validacao - por isso "inconclusivo", nao "reprovado".

**REV-004 - confirmado.** `npm audit` no PoC: ajv 8.17.1, GHSA-2g4f-4pwh-qvx6 (ReDoS, apenas com opcao `$data`), moderado; correcao 8.20.0 fora do range travado. Entrega diz dependencias "minimas, travadas" sem mencionar o advisory.

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REV-001 | MEDIO | MEDIO (mantido; critico por tocar SEC-15 e a decisao de revogacao do ADR) | **APLICAR** |
| REV-002 | BAIXO | BAIXO | **APLICAR** (acoplado a REV-001) |
| REV-003 | BAIXO | BAIXO | **APLICAR** (texto) |
| REV-004 | BAIXO | BAIXO | **APLICAR** (apenas registro); upgrade **ADIAR** para FND-003 |
| REV-005 | BAIXO | BAIXO | **ADIAR** |
| REV-006 | BAIXO | BAIXO | **APLICAR** (nota no ADR) |
| REV-007 | BAIXO | BAIXO | **APLICAR** parcial (texto); API de revogacao de `jti` **ADIAR** |

### REV-001 - APLICAR
- Criterio/regra: ENT-DEC-004 "Revogacao: lista de ver minimo consultavel pelos servicos" + AC-2 (revogacao de emergencia demonstrada) + SEC-15; ADR 5.1. Uma revogacao sem limite de obsolescencia nao garante o efeito prometido e o ADR nao a qualifica. Codigo: `validator.mjs` `refresh()`/`validate()`, `control-plane.mjs:61` (`generated_at`).
- Plano minimo:
  1. ADR-018: nova subsecao na decisao 7 definindo `max_staleness` (proposta: 90 s = 3x o poll de 30 s; valor listado em "Pendencias de decisao humana" junto com TTL/poll) e politica **fail-closed**: se a ultima atualizacao bem sucedida do estado de revogacao for mais antiga que `max_staleness`, o validador rejeita com codigo proprio (`revocation_state_stale`) e alarma; alternativa explicita de degradacao apenas para acoes de baixo risco fica como decisao humana, nao implicita. Corrigir o Trade-off "queda do CP... tokens vivos seguem validando ate o exp" para refletir que isso so vale ate `max_staleness`; registrar a consequencia de disponibilidade (queda do CP > `max_staleness` derruba validacao) e a relacao com "Quando revisar".
  2. PoC `validator.mjs`: registrar `lastRefreshOk` (relogio local injetavel `now`, nao so `generated_at`, para nao confiar no relogio do CP) e, em `validate()`, rejeitar quando `now - lastRefreshOk > maxStaleness` (opcao `maxStalenessS`, default definido pelo ADR). Opcionalmente sanity check de `generated_at` futuro alem do skew.
  3. Testes: (a) CP indisponivel (fetchRevocation lanca) -> dentro do limite aceita, apos o limite rejeita `revocation_state_stale`; (b) revogacao + sem refresh + avancar relogio alem do limite -> token revogado rejeitado; (c) refresh bem sucedido restaura; atualizar saida de demo/test e diffs.
- Risco da alteracao: baixo no PoC (isolado, descartavel); no ADR altera trade-off de disponibilidade - e decisao humana (ADR continua Proposto).

### REV-002 - APLICAR
- Evidencia: `validator.mjs` `refresh()` atribui `this.keys` antes de `fetchRevocation()`; falha deixa estado misto e no construtor aborta. Real, e pre-requisito de uma politica de staleness correta (falha de refresh nao pode avancar `lastRefreshOk` nem trocar so metade do estado).
- Plano: buscar JWKS e revogacao em variaveis locais, atribuir ambos e `lastRefreshOk` ao final; em erro, manter estado anterior (nao zerar), contabilizar e propagar/registrar. Teste: `fetchRevocation` lancando mantem `keys` anteriores e nao atualiza o carimbo. Implementar junto com REV-001.

### REV-003 - APLICAR (documentacao)
- Evidencia: reproducao acima (p99 entre 1,7 e 8,7 ms conforme a execucao, vs. gatilho 5 ms). Nao e defeito de codigo.
- Plano minimo: no ADR (Beneficios ou Pendencias) acrescentar que, na VM compartilhada do PoC, p50 foi ~230 us estavel, mas o p99 oscilou entre ~1,7 e ~8,7 ms entre execucoes (cruzando o gatilho de 5 ms; entrega: 5,4 ms tool-gateway e 8,7 ms dispatcher), resultado **inconclusivo** por ruido de VM/GC, e que o gatilho deve ser reavaliado com benchmark no host alvo e sob carga; ajustar a frase "mediana de 231 us" para citar p99. Sem mudanca no documento da entrega alem de eventual remissao cruzada. Nao reclassificar como falha de AC-3.

### REV-004 - APLICAR (registro) / ADIAR (upgrade)
- Evidencia: `npm audit` reproduzido. Exposicao: `schemas.mjs` nao usa `$data`; PoC e devDependency descartavel; sem impacto pratico. Nao ha motivo para mexer no lock agora (fora do range, alteraria evidencias ja registradas).
- Plano: registrar GHSA-2g4f-4pwh-qvx6, versao afetada/corrigida (8.20.0), nao exploracao e a regra "FND-003 escolhe versao corrigida ao adotar ajv" no documento da entrega (secao de validacoes/riscos) e no README do PoC. Retomada do upgrade: FND-003.

### REV-005 - ADIAR
- Evidencia: (a) so quem ja tem o segredo de uso unico pode queimar o proprio segredo com chave invalida (autoconsumo, nao escalacao); erro cru em vez de `Reject`; (b) prefixo `runtime:` frouxo no `sub` da assertion nao e explorado (a posse da chave continua exigida, tenant vem do registro); (c) `exp<iat` ja cai por `expired`/TTL. Nenhuma quebra de aceite ou vulnerabilidade confirmada; PoC descartavel que nao vira producao (ADR manda reimplementar com biblioteca revisada).
- Impacto residual: baixo. Motivo de nao fazer agora: PoC descartavel; risco de ampliar escopo. Condicao de retomada: implementacao do enrollment/emissao em PRV-004/MSG-002 (exigir validacao de chave antes de consumir segredo, prefixo `runtime:` estrito e `exp > iat` nos criterios dessas tarefas). Sugestao de uma linha na lista de requisitos do ADR e opcional.

### REV-006 - APLICAR (nota no ADR)
- Evidencia: decisao 5 e `validator.seen` em memoria por instancia; reinicio ou 2 instancias do dispatcher permitem reaproveitar token de uso unico dentro do TTL. O ADR deve declarar a premissa (1 instancia, sem perda de estado) e que cache compartilhado/afinidade e pre-requisito se isso mudar; tambem relacionar a "Quando revisar" (mais de um host). Sem mudanca de codigo.

### REV-007 - APLICAR parcial
- Aplicar (texto): rotular no ADR a revogacao push de emergencia (alvo <= 5 s) como **nao demonstrada** (PoC faz refresh manual); explicitar que `nbf` nao existe e a validade inicial e coberta por `iat` + tolerancia; registrar limite `maxItems: 3` do JWKS no procedimento de rotacao (aposentar antes de publicar a 4a chave; erro cru e aceitavel no PoC).
- Adiar: API de revogacao de `jti` no CP (teste manipula o array diretamente) - o mecanismo de validacao esta coberto; retomada em MSG-002/TGW-001 quando houver superficie administrativa.

## Aderencia aos criterios de aceite apos as decisoes
- AC-1 (ADR aceito + negativos rejeitados): negativos OK; aceite do ADR e decisao humana, nao declarado. Depende de REV-001 para o ADR ser coerente com a revogacao.
- AC-2 (rotacao e revogacao de emergencia): demonstradas, mas a garantia temporal da revogacao so fica correta com REV-001/002.
- AC-3 (latencia sem rede): atendido; ressalva textual REV-003.

## Veredito: CORRECOES_NECESSARIAS
IDs APLICAR para o review-loop-driver: **REV-001, REV-002, REV-003, REV-004 (registro), REV-006, REV-007 (parte textual)**. ADIAR: REV-005, upgrade do ajv (REV-004) e API de `jti` (REV-007). Nenhum REJEITAR. Nao ha bloqueio por falta de informacao; o valor de `max_staleness` e a politica de degradacao sao parametros de decisao humana do ADR (propostos acima), sem impedir a correcao.
Revalidacao esperada apos a correcao: `npm ci`, `npm test`, `npm run demo` no PoC, releitura do ADR e dos diffs/saidas atualizados em `documentacoes/identidade/` e revalidacao do hash do HEAD pelo revisor independente.

## Nao executado
benchmark em host alvo; implementacao da correcao; revisao de `package-lock.json` e `diffs.md` linha a linha.
