# Auditoria do review DEC-006 (REVIEW-001..009)

- Relatorio de origem: `documentacoes/reviews/2026-10-25-review-dec-006.md` (namespace DEC-006; IDs REVIEW-001..009 pertencem a este relatorio).
- Tarefa: ENT-DEC-006 (ADR-020 + PoC). Especificacao: `documentacoes/backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-006` (AC-1: ciclo de vida sem reiniciar outros tenants; AC-2: ausencia em env/inspect/logs; AC-3: limitacoes vs. vault sem prometer equivalencia).
- Worktree: `/home/vinicius/nucleos-worktrees/tarefa/dec-006` (somente leitura), branch `tarefa/dec-006`.
- Base `4be3ce391a51b9e24cd85f7c894d841636dcd50f`; HEAD `8105de1285b90b46b55d78de139506fbb0f55045` (confirmado por `git rev-parse`; arvore limpa; nenhuma mudanca desde a revisao).
- Auditor: sessao independente (nao implementou nem revisou). Data 2026-10-25. Sem edicao de codigo e sem commit.
- Caminhos reais (o relatorio abrevia): ADR em `documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md`; PoC em `documentacoes/arquitetura/poc/dec-006/{broker.mjs,tenant-app.mjs,poc.test.mjs,README.md,saida-execucao.txt}`.
- Verificacoes executadas: Node 24.22.1, Docker 29.8.1; container descartavel `aud006` (`node:22-alpine`, `--network none`, PoC montado `:ro`), removido ao final (0 containers e 0 volumes dec006 restantes). Nao executado: `node --test poc.test.mjs` completo (o revisor ja reportou 4/4; nao era necessario para as reproducoes) e consulta as fontes web (docs.docker.com, openbao.org; sem fonte reverificada, ver "Precisa de validacao").

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | ALTO | ALTO | APLICAR |
| REVIEW-002 | MEDIO | MEDIO | APLICAR |
| REVIEW-003 | ALTO | MEDIO (ver abaixo) | APLICAR (corrigir ADR + teste; desenho mantido) |
| REVIEW-004 | ALTO | ALTO | APLICAR |
| REVIEW-005 | MEDIO | MEDIO | ADIAR (com registro obrigatorio no ADR) |
| REVIEW-006 | MEDIO | MEDIO | APLICAR |
| REVIEW-007 | MEDIO | MEDIO | APLICAR |
| REVIEW-008 | BAIXO | BAIXO | APLICAR so `authTagLength`; resto ADIAR |
| REVIEW-009 | BAIXO | BAIXO | ADIAR (com linha no ADR) |

### REVIEW-001 - APLICAR (ALTO, reproduzido)
- Evidencia propria: `broker.mjs:69-70` calcula `uid = UID_BASE + n + 1` com `n = Object.keys(store.tenants).length`; revoke mantem a chave no store (`:99`), mas `create` de tenant revogado sobrescreve a mesma chave sem aumentar `n`. Reproducao no container: create a, b, revoke a, create a, create c => a=10003, b=10002, c=10003. `a` e `c` com o mesmo UID. Isolamento por montagem (`volume-subpath`) e por UID/0400 (ADR itens 1 e Beneficios) cai se dois tenants compartilham UID (qualquer processo/arquivo do UID compartilhado), e re-create tambem muda o UID do tenant recriado.
- Criterio: premissa de isolamento do ADR e AC-1 (revogacao nao afeta outros tenants).
- Plano minimo: `nextUid` persistido no store, incrementado a cada create e nunca reutilizado; (decidir) reutilizar o UID original ao recriar o mesmo nome revogado ou emitir novo, mas nunca duplicar. Teste: create a, b, revoke a, recreate a, create c; afirmar UIDs todos distintos.
- Risco da alteracao: baixo (formato do store ganha campo; PoC sem dados legados). Compatibilidade: store existente sem `nextUid` deve inicializar com max(uid)+1.

### REVIEW-002 - APLICAR (MEDIO, reproduzido)
- Evidencia propria: `create ../../victim/x` criou `/victim/x` (dono UID 10004, `current` e `meta.json`) fora de `/tenants`; a chave `../../victim/x` entrou no store. Causa: `tdir = path.join(TENANTS, t)` (`:38`) sem validacao, com `mkdirSync recursive` e `rmSync` rodando com `DAC_OVERRIDE`/`CHOWN`/`FOWNER`. `revoke` com traversal removeria arquivos fora da raiz. Nao ha mitigacao anterior (argumento vem direto de argv).
- Em contexto de PoC o operador e confiavel, mas o broker e o componente que o ADR chama de critico e o provisioner (PRV-004) vai passar nomes derivados de entrada; correcao e de uma linha de custo.
- Plano minimo: allowlist `^[a-z0-9][a-z0-9-]{0,62}$` validada em `main` antes de qualquer E/S, mais confirmacao de `path.resolve(tdir)` dentro de `TENANTS`. Testes negativos: `..`, `.`, `../x`, `a/b`, vazio, maiusculas; afirmar que nada e criado fora da raiz e que o store nao muda.
- Risco: baixo.

### REVIEW-003 - APLICAR, corrigindo o ADR e nao o desenho (severidade avaliada MEDIO)
- Evidencia propria: apos `create s1`, copia de `store.json`, `revoke s1`: `old.json` + KEK atual => `recovered: zzzSECRETzzz`. Confirmado que o `wrappedDek` some do store vivo e que o ADR nao diz "irrecuperavel" para revogacao (so para KEK perdida, item 6), porem o termo "crypto-shredding" (ADR item 4, README, documento da entrega) sugere irrecuperabilidade que o desenho nao entrega com copias do store e KEK unica e permanente.
- Rebaixa de severidade (ALTO para MEDIO): nao e defeito de codigo nem quebra de AC; e lacuna de honestidade da documentacao. Mantem-se APLICAR e bloqueante para aceitar o ADR/AC-3 (limitacoes sem prometer equivalencia).
- Decisao sobre o desenho: NAO mudar. Shredding verdadeiro exige KEK por epoca com descarte, o que o ADR ja lista como trabalho derivado (rotacao da KEK) e custa complexidade fora do orcamento do MVP. O que precisa ser corrigido e o texto.
- Plano minimo: (a) ADR item 4: renomear para "revogacao por descarte da DEK embrulhada"; declarar que ela so impede reentrega/descriptografia futura a partir do store vivo, que so e irrecuperavel se NAO existirem copias anteriores do store (backup, snapshot, blocos de disco/journal) enquanto a KEK existir, que backups do store devem ter retencao/tratamento definidos, e que a revogacao nao revoga a credencial no sistema de destino nem para container que ja a carregou em memoria (etapa separada e manual/PRV). (b) Ajustar README e documento da entrega ao mesmo termo. (c) Teste: apos `revoke`, afirmar que `wrappedDek` e `secrets` nao existem para o tenant no store (hoje nao verificado, `poc.test.mjs:92-94`); nao testar irrecuperabilidade.
- Risco: nenhum no codigo.

### REVIEW-004 - APLICAR (ALTO, reproduzido)
- Evidencia propria: `docker logs aud006` = 0 bytes mesmo apos `broker bogus` imprimir fonte/stack no stderr do `exec` (o container e `sleep`; PID 1 `sleep 600`). Logo `docker logs <broker>` (`poc.test.mjs:107`) e `/proc/1/environ` do broker (`:109`) nao cobrem o processo do broker. `volumes` so via `docker volume inspect` (`:111`, metadados; confirmado que um arquivo gravado no volume nao aparece em inspect), contra ADR item 7 ("varredura de volumes"). Controle negativo (`:117-123`) usa `includes` direto em inspect/env, nao a funcao `hits()`, e nao cobre logs, volumes nem environ. Assercao de isolamento `ls /run/secrets/../` (`:71-72`): `..` de `/run/secrets` e `/run`, que por construcao nao contem "tenant-b" (assercao vacua). AC-2 exige prova de ausencia em env, inspect e logs: o escopo "logs" da prova esta vazio para o broker, que e o unico que manipula o segredo.
- Plano minimo (nesta ordem de valor): (1) capturar stdout/stderr das chamadas ao broker e inclui-los no corpus de `hits()`; (2) controle negativo usando a mesma `hits()` por canal: vazar sentinela em log de container (`echo` no PID 1), em arquivo de volume, em argv (`/proc/*/cmdline`) e em environ, e exigir deteccao; (3) varrer conteudo dos volumes via container auxiliar, com allowlist explicita dos arquivos entregues legitimos (`current`/`previous` do tenant ativo); (4) isolamento: tentar ler `/run/secrets/<outro-tenant>` e `/run/secrets/../tenant-b/current` e exigir falha; (5) adicionar `/proc/*/cmdline`. Alternativa para o que nao for implementado: reduzir o texto do ADR item 7 ao que o teste realmente varre.
- Fora do plano obrigatorio (ADIAR dentro deste ID): varredura de historico de imagem e de outras codificacoes das sentinelas; registrar como limitacao do scanner no ADR.
- Risco: baixo (so teste).

### REVIEW-005 - ADIAR (MEDIO)
- Evidencia: `saveStore` usa `writeFileSync` in place (`:33`), `writeFile0400` faz rm+write (`:40-44`), `loadStore` sem lock; leitura do codigo confirma. Nao reproduzido perda de update com creates paralelos (o proprio revisor tambem nao); risco por temporizacao nao demonstrado.
- Motivo de nao fazer agora: o PoC e descartavel, tem operador unico, e o ADR ja declara o broker como "componente critico caseiro" que exige revisao independente. Reescrever a persistencia aqui nao altera a decisao do ADR.
- Condicao obrigatoria: registrar no ADR (Trade-offs/Consequencias) que o PoC nao tem lock, escrita atomica (temp+fsync+rename), entrega atomica nem auditoria write-ahead, e que o formato de producao em FND-006/PRV-004 deve te-los. Retomada: antes de FND-006 consumir o desenho, ou em qualquer teste de concorrencia.
- Impacto residual: corrupcao do store (perda de DEKs) em queda no meio da escrita; janela em que o tenant le arquivo ausente durante rotacao.

### REVIEW-006 - APLICAR (MEDIO)
- Evidencia: `scryptSync(frase, salt, 32)` (`:110`, `:117`) com defaults do Node (N=2^14, r=8, p=1), parametros nao gravados (`kdf:"scrypt"` apenas), frase vazia aceita. Protege a KEK offline contra adversario que obtenha o blob, que e o objeto de maior valor do desenho.
- Plano minimo: gravar `{N,r,p}` no blob; N>=2^17 (com `maxmem` ajustado, pois 128*N*r excede o default de 32 MiB) ou argon2id se aprovado; rejeitar frase abaixo de comprimento minimo; incluir versao/params na AAD (`mk-backup:v1:...`). Teste: round-trip com params gravados, frase vazia/curta rejeitada, params alterados falham.
- Risco: baixo; backups ja feitos pelo PoC nao sao legados reais.

### REVIEW-007 - APLICAR (MEDIO)
- Evidencia: ADR item 6(iv) promete "reentregar os arquivos dos tenants a partir do store"; `broker.mjs` nao tem comando de reentrega (`:65-130`). `verify-store` ignora o argumento de tenant e lanca em vez de `{ok:false}` (`:122-127`); `assert.throws` (`poc.test.mjs:130`) nao distingue KEK ausente de outro erro. Volume `mk` e tmpfs (`:44`) e perde a KEK em reinicio do host, exigindo frase humana; o ADR nao declara isso, e contradiz "criacao sem humano" apos reboot. Backup e store no mesmo volume no PoC (`:126`), enquanto o ADR manda guardar fora da VPS.
- Plano minimo: comando `redeliver-all` (reentrega a partir do store), teste de desastre completo (apagar KEK e arquivos entregues, restaurar, reentregar, `tenantCheck` correto); `verify-store` retornar `{ok:false}` e checar a mensagem de erro esperada; ADR: declarar dependencia humana no reinicio e que o backup do PoC fica no mesmo volume apenas por conveniencia (producao: fora da VPS).
- Risco: baixo.

### REVIEW-008 - APLICAR parcialmente (BAIXO)
- Aplicar: `setAuthTag` sem `authTagLength` (`:29`, `createDecipheriv` sem opcao) aceita tag curta: fixar `authTagLength: 16` em cifrar/decifrar. Custo de uma linha, de seguranca.
- ADIAR: ID/versao de KEK no formato, autenticar `version` do store, tratamento de segredos binarios/newline final, zerar chaves, HMAC fixo do tenant-app (apenas PoC). Motivo: dependem da rotacao da KEK, ja listada no ADR como trabalho derivado; custo fora do aceite. Retomada: definicao do formato final em FND-006. Registrar a lista no ADR como pontos do formato de producao.

### REVIEW-009 - ADIAR (BAIXO)
- Evidencia: `audit.log` criado pelo `appendFileSync` com umask (0644) no volume gravavel pelo broker; auditoria mutavel; stack no stderr. `store.json` 0600 e MK 0400 conferidos no codigo (`:33`, `:118`). O ADR ja declara que nao ha auditoria de leitura, mas nao que a auditoria de escrita e adulteravel.
- Motivo: sem impacto no aceite do PoC. Condicao: acrescentar uma linha em Consequencias ("audit.log nao tem integridade/append-only") e tratar em FND-006 (ex.: hash encadeado, destino externo).

## Verificado e mantido
- ADR com status Proposto conforme exigido; limitacoes vs. vault real amplas e sem promessa de equivalencia (AC-3 atendido em substancia, condicionado a REVIEW-003 e 007).
- AC-1 (rotacao sem reiniciar outros tenants) sustentado pelo teste; REVIEW-001 afeta, porem, a premissa de isolamento por UID.

## Precisa de validacao (nao decidido; nao executado)
- Citacoes docs.docker.com e openbao.org nao reverificadas por esta auditoria (sem acesso web).
- Versao minima do Docker para `volume-subpath`: registrar no ADR (a execucao usou Docker 29.8.1).
- Corrida de creates concorrentes: nao reproduzida; coberta pelo ADIAR de REVIEW-005.

## Veredito: CORRECOES_NECESSARIAS
IDs APLICAR para o review-loop-driver: REVIEW-001, 002, 003, 004, 006, 007 e a parte `authTagLength` de 008.
IDs ADIAR com registro obrigatorio no ADR: REVIEW-005, 009 e o restante de 008.
Bloqueantes para aceitar o PoC como evidencia: 001, 003 (texto) e 004. Nao ha REJEITAR. O veredito original do revisor (CHANGES REQUESTED) e preservado. Apos as correcoes: revisor em sessao independente; o ADR segue Proposto.
