# Auditoria de achados BAIXOS - FND-002, FND-009, DEC-004 - 2026-10-25

- Papel: AUDITOR independente (nao implementou, nao revisou). Nao editei codigo e nao commitei. Unica escrita: este arquivo (mais copia de trabalho no scratchpad para reproduzir).
- IDs com namespace por tarefa: `FND-002/NOTA-n`, `FND-009/REVIEW-n`, `DEC-004/BUG-001` e `DEC-004/QA-bad_issuer`.
- Rodadas de correcao ja usadas: FND-002 = 1, FND-009 = 1, DEC-004 = 2 (limite 3).

## Origem e versoes

| Tarefa | Relatorio | Branch @ HEAD | Worktree |
|---|---|---|---|
| FND-002 | `2026-10-25-review-fnd-002.md` | `tarefa/fnd-002` @ `9e94242d6f1b456973d4347b484624365fc709f0` (conferido) | `/home/vinicius/nucleos-worktrees/tarefa/fnd-002` |
| FND-009 | `2026-10-25-revalidacao-fnd-009-r1.md` | `tarefa/fnd-009` @ `6217fd453ee718797cbb6694b4e1451b363f56d1` (conferido por `git log`) | `/home/vinicius/nucleos-worktrees/tarefa/fnd-009` |
| DEC-004 | `2026-10-25-qa-dec-004.md` | `tarefa/dec-004` @ `d65b84292b5f68cb4d3128bacda465c9c24a4847` (conferido; arvore limpa) | `/home/vinicius/nucleos-worktrees/tarefa/dec-004` |

Sem mudanca de codigo desde as revisoes. Verificacao propria: leitura de `eslint.config.mjs`, `package.json`, ticket FND-002/FND-009/FND-007, doc da entrega FND-009, `redact.ts`, `http.py`, ADR-018, `validator.mjs`, `control-plane.mjs`, schema `handshake`/`runtime-token`; reproducao do BUG-001 com Node 24.22.1 (ver abaixo). Nao executei `make lint/test` das duas outras tarefas (nao necessario: decisoes por leitura).

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
|---|---|---|---|
| FND-002/NOTA-1 | BAIXO | INFO | REJEITAR |
| FND-002/NOTA-2 | INFO | INFO | REJEITAR |
| FND-009/REVIEW-007 | BAIXO | BAIXO | ADIAR |
| FND-009/REVIEW-008 | BAIXO | BAIXO | REJEITAR (duplicata de REVIEW-007) |
| FND-009/REVIEW-009 | BAIXO | BAIXO | ADIAR |
| FND-009/REVIEW-010 | BAIXO | BAIXO | ADIAR |
| DEC-004/BUG-001 | BAIXO | BAIXO | APLICAR |
| DEC-004/QA-bad_issuer (codigo morto) | informativo | informativo | REJEITAR |

### FND-002/NOTA-1 - `security/detect-object-injection` "desligada" - REJEITAR
- Evidencia: `eslint.config.mjs` linha 35 aplica `security.configs.recommended` globalmente; a regra so e posta em `off` (linha 75) no bloco `files: ["**/*.test.ts"]`, com comentario inline de justificativa ("Testes indexam objetos de fixtures conhecidos..."). Em codigo de producao a regra segue ativa (no preset recommended e `warn`, nao quebra o lint; comportamento do plugin, nao regressao).
- O relato do revisor ("desligada em eslint.config.mjs") nao distinguiu o escopo; a premissa de risco nao se sustenta. O ticket FND-002 nao exige essa regra especifica; exige plugin de seguranca (presente) e proibicao de `any`/`eval`/`new Function`.
- Justificativa existe no proprio arquivo de configuracao; a regra do plugin e conhecidamente ruidosa. Sem risco demonstrado. Nada a fazer; nao gastar rodada de correcao.
- Condicao de reabertura: se `detect-object-injection` passar a `error` ou se `make lint` ganhar `--max-warnings 0` (FND-005), reavaliar os avisos em codigo nao-teste.

### FND-002/NOTA-2 - import de valor web->api barrado antes pelo tsc - REJEITAR
- Evidencia: o proprio review prova que `lint:arch` (exit 2, duas regras) e o caso de regressao (18/18, 3 regras de depcruise) cobrem a regra; o `make lint` falha de qualquer forma. Defesa em profundidade, nao lacuna. O criterio "import proibido falha `make lint`" esta atendido. Sem acao.

### FND-009/REVIEW-007 - validadores de charset provam formato, nao ausencia de segredo - ADIAR
- Evidencia: `DEFAULT_RULES` de `route`, `check`, `job_type`, `method` (TS e Python) por charset; `route` vem de template (`routeOf` em `http.ts` linhas 20/47-59), `check`/`job_type` de nomes no codigo. Nao ha caminho de producao com dado de entrada nesses campos hoje. AC-2 do ticket ("sentinela nao aparece na saida de log de nenhum servico") esta atendido para os servicos existentes e a doc da entrega e honesta quanto as classes provadas.
- Risco residual: uso indevido futuro (`route` com `/reset/<token>`). Nao e vulnerabilidade presente, logo nao ha bloqueio.
- Motivo de nao fazer agora: a correcao de fundo (validar `route` contra o conjunto de templates declarados) depende de FND-007/EP-11 e nao cabe numa correcao minima; gastaria a segunda e ultima rodada da tarefa.
- Condicao de retomada: quando FND-007 definir a borda/rotas ou algum servico passar a alimentar `route`/`check`/`job_type` com dado de entrada. Teste esperado: `route` fora do conjunto declarado vira `[REDACTED]`.
- Acao documental sem rodada de codigo: ao fechar a tarefa (ja ha residual de REVIEW-006 pedindo o SHA `6217fd4` no documento), acrescentar em `documentacoes/observabilidade/2026-10-25-fnd-009-baseline-observabilidade.md` uma frase: "os campos padrao (`method`, `route`, `check`, `job_type`) so devem receber valores gerados pelo codigo; o validador prova formato, nao ausencia de segredo". Hoje o documento nao registra essa limitacao (verificado por grep).

### FND-009/REVIEW-008 - `Error.name` sem hifen passa em `NAME_PATTERN` - REJEITAR (duplicata de REVIEW-007)
- Evidencia: `redact.ts` linhas 44 e 97; em Python o valor vem do nome da classe (codigo). So `error.name` atribuido dinamicamente em TS expoe o caso, e e a mesma classe de limite de REVIEW-007 (charset-valido nao e segredo-livre). Recomendacao de `constructor.name` e preferencia sem custo demonstrado. Tratar junto da nota documental de REVIEW-007.

### FND-009/REVIEW-009 - `X-Powered-By: Express` e `HEAD` 405 - ADIAR
- Evidencia: nao ha `disable("x-powered-by")`/helmet em `apps/api/src` (grep). O ticket ENT-FND-007 lista cabecalhos de seguranca e "remocao de `Server`" na borda, e o ticket de EP-02 prescreve `helmet` no pipeline global da API; o header nao expoe versao. O ticket FND-009 exige `/healthz`/`/readyz` por GET; `do_HEAD` devolver 405 com `Allow: GET` e comportamento documentado (doc, REVIEW-004). O ramo `self.command != "HEAD"` em `http.py` linha 155 e codigo inalcancavel inofensivo.
- Motivo: dono natural e FND-007/EP-02; nao e quebra de aceite. Condicao de retomada: FND-007 (borda) ou criacao do pipeline global da API; se o prober adotado usar HEAD, tratar HEAD como GET sem corpo e remover o ramo morto. Teste: `x-powered-by` ausente e `HEAD /healthz` coerente com a decisao.

### FND-009/REVIEW-010 - thread de check pendurado fica viva - ADIAR
- Evidencia: `http.py` linhas 40-52 (`ThreadPoolExecutor`, `shutdown(wait=False, cancel_futures=True)`). Limite ja documentado no doc da entrega (REVIEW-005, "threads de checks pendurados continuam ate o check retornar"). Hoje os checks de `/readyz` sao locais/triviais; nao ha check infinito. Relevante so com dependencias reais (FND-006/EP de dados).
- Retomada: quando o primeiro check real de dependencia for adicionado, exigir timeout proprio no check ou executor limitado reutilizado por handler; teste: check infinito repetido nao aumenta a contagem de threads alem do limite.

### DEC-004/BUG-001 - JWKS nao validado no refresh - APLICAR
- Reproduzi: copia do PoC no scratchpad, Node 24.22.1, `fetchJwks = () => ({keys: []})` e `refresh()`: resultado `ACEITO keys= 0` (o conjunto de chaves e esvaziado; o carimbo `lastRefreshOk` e reatribuido; todos os tokens passam a `unknown_kid`).
- Criterio: o schema `jwks` exige `minItems: 1`, `maxItems: 3` (`handshake.schema.json`), e o CP ja valida o que emite com `validate.jwks` (`control-plane.mjs` linha 56). O ADR-018 7.1 descreve o refresh como atomico e diz que o carimbo de frescor so avanca em refresh bem-sucedido, com alarme por `max_staleness`; um JWKS vazio renova o carimbo e silencia exatamente esse alarme. A frase "Refresh atomico inclui formato" (ADR linha 32) cita apenas a revogacao, entao o ADR nao mente, mas o PoC que o sustenta tem a assimetria; ADR e codigo devem ficar coerentes antes do aceite humano.
- Severidade mantida BAIXO (fail-closed, sem bypass; PoC). Aplicar porque a correcao e de uma linha, dentro do escopo, e evita registrar como "requisito do validador de producao" algo ja testavel.
- Plano minimo (terceira e ultima rodada de DEC-004; nao deve crescer):
  1. `poc/dec-004/lib/validator.mjs`, em `refresh()`, antes de montar o `Map`: `const j = this.fetchJwks(); if (!validate.jwks(j)) throw new Error('resposta de jwks malformada');` e depois `keys = new Map(j.keys.map(...))`, dentro do mesmo `try`, de modo que a falha incremente `refreshFailures`, nao altere estado e nao avance o carimbo.
  2. Um teste em `test/poc.test.mjs`, espelhando o teste existente de revogacao malformada (linha ~323): respostas `null`, `{}`, `{keys: []}`, `{keys: null}`, 4 chaves; esperado: lanca, `keys`/`lastRefreshOk` inalterados, `refreshFailures` incrementa, validacao de token valido continua aceita.
  3. ADR-018 linha 32: ampliar para "JWKS e resposta de revogacao sao validados pelos schemas `jwks` e `revocation_state`..." e atualizar a contagem de testes citada no doc da entrega e nas `saida/*.txt` se mudarem (22 -> 23).
- Risco da alteracao: baixo; o validador ja carrega ajv e schema. Efeito colateral a observar: o limite `maxItems: 3` passa a ser imposto tambem no validador (rotacao com 4 chaves publicadas e rejeitada tambem la; ja impossivel no CP). Gate: `npm test` no PoC, depois re-QA focal independente (nao vale autorrevisao).
- Observacao: se a 3a rodada falhar, isolar a tarefa conforme a skill; nao ha motivo tecnico para isso neste plano.

### DEC-004/QA-bad_issuer - ramo `bad_issuer` inalcancavel - REJEITAR
- Evidencia: `validator.mjs` linha 83; o schema de claims tem `iss: {const: "nucleos-control-plane"}` (`runtime-token.schema.json` linha 24), logo `iss` errado cai antes em `bad_claims` (confirmado pelo QA). O ADR-018 decisao 4 lista `iss` como checagem do validador; manter a verificacao explicita preserva o controle caso o schema seja relaxado (ex.: multiplos emissores) e custa uma linha. Remover nao tem ganho demonstrado e arrisca regressao na rodada final; nao e falha de seguranca (o QA concorda).
- Opcional dentro da mesma edicao do BUG-001: comentario de uma linha ("defesa em profundidade; hoje coberto pelo schema"). Nao exigir.

## Veredito

- Por tarefa: FND-002 = LIBERADO_SEM_CORRECOES (as duas notas rejeitadas; nenhuma correcao). FND-009 = LIBERADO_SEM_CORRECOES de codigo (007/009/010 adiados com condicao de retomada; 008 rejeitado; ressalva documental a incorporar no fechamento, sem nova rodada de correcao). DEC-004 = CORRECOES_NECESSARIAS (somente BUG-001, rodada 3/3).
- Veredito consolidado: **CORRECOES_NECESSARIAS** (1 ID APLICAR: DEC-004/BUG-001). Isso e independente do BLOCKED de AC-1 de DEC-004 (aceite humano do ADR-018), que a auditoria nao altera e que continua pendente. O veredito original do revisor/QA e preservado; este documento nao substitui re-QA.
- IDs APLICAR para o review-loop-driver: `DEC-004/BUG-001`.

## Nao verificado

- `make lint/test` de FND-002 e FND-009 nao reexecutados por mim (decisoes por leitura de configuracao/codigo e dos relatorios). `X-Powered-By` e comportamento de `HEAD` aceitos pela reproducao do revisor (nao reproduzi). Sem acesso a banco ou servico real.
