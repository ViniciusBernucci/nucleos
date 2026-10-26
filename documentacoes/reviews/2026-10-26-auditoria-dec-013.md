# Auditoria independente do review DEC-013 (ADR-025) - 2026-10-26

- **Relatorio de origem:** [2026-10-26-review-dec-013.md](2026-10-26-review-dec-013.md) (veredito do revisor preservado: CHANGES_REQUESTED)
- **Tarefa:** ENT-DEC-013 (perfil CRITICO, documental + PoC), lote 2026-10-25-ep00-ep01-fundacao
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/dec-013`, `tarefa/dec-013`
- **Base:** `d00e8dff92f468044558d85d80bd464eef09d32a`; **HEAD auditado:** `1329c4d8b86cc2a084e75f867c5382b401305a19` (commits da tarefa `aa09765`, `97afa43`; review `1329c4d`). Arvore limpa; sem mudancas desde a revisao.
- **Auditor:** sessao independente (Claude Sonnet 5.5), sem participacao na implementacao nem no review. Nao editou o produto.
- **Lido:** ADR-025 integral, `poc/dec-013/run.sh`, ENT-DEC-013, ADR-018 (decisao 7/7.1, trade-offs, consequencias), threat model (T-F4-E, AB-03, RISK-013), relatorio do review. ADR-016 e ADR-020 consultados apenas pelas referencias do ADR-025 e do review; ADR-020 nao relido integralmente.
- **Nao executado:** nenhum comando de PoC/Docker nesta auditoria. As evidencias de execucao (40 PASS, mutantes M1..M15, sonda do provisioner sem superuser) sao do revisor e aceitas como reproduziveis; a leitura do `run.sh` confirma que as linhas citadas (`statement_timeout`, `CONNECTION LIMIT`, `REVOKE ALL ON SCHEMA public`, `ALTER DEFAULT PRIVILEGES`, `adm()` com `-U postgres`) existem e nao tem teste associado.

## Principio aplicado

O ADR-025 e Proposto e o aceite e humano. Correcoes sao de documento (risco residual, requisito para a implementacao, alternativa nas H-x), de PoC barato ou de redacao. Fluxos CP -> Tenant API/bundle sem codigo viram requisito/ticket sugerido (ADIAR com destino), nao PoC novo.

## Tabela de decisoes

| ID | Sev. revisor | Sev. avaliada | Decisao | Resumo |
| --- | --- | --- | --- | --- |
| REVIEW-001 | ALTO | ALTO | APLICAR (documento) | Fechar o confused deputy dentro do tenant no desenho minimo (`res` + `jti` no sidecar) e declarar a ACL por documento como requisito de aceite + H-11 |
| REVIEW-002 | MEDIO | MEDIO | APLICAR (documento + PoC) | Separar bootstrap (superuser) da operacao do provisioner; fase de PoC sem superuser |
| REVIEW-003 | MEDIO | MEDIO | APLICAR (documento) | Corrigir afirmacao contraditoria e dimensionar o poder da chave do CP |
| REVIEW-004 | MEDIO | MEDIO | APLICAR (documento) | Raiz de confianca, rotacao, `valid_until`, versao persistida e ligacao com ADR-018 7.1 |
| REVIEW-005 | MEDIO | MEDIO | APLICAR (documento) | Completar matriz com backup, offboarding, exporter, runner; incluir `app`/`tools` em E-1 |
| REVIEW-006 | MEDIO | MEDIO | APLICAR (PoC + redacao) | Cobrir os 4 controles ou retirar a afirmacao; endurecer `expect_deny` |
| REVIEW-007 | BAIXO | BAIXO | APLICAR parcial / ADIAR parcial | Marcar 3 GiB como estimativa (aplicar); digest e env-file (adiar) |
| REVIEW-008 | BAIXO | BAIXO | ADIAR | Renumeracao da lesson 09 na integracao |
| REVIEW-009 | BAIXO | BAIXO | APLICAR (redacao) | Esclarecer `internal` e alinhar decisao 5 com `jti` |

## Justificativa e instrucao por achado

### REVIEW-001 - APLICAR (documento), severidade mantida ALTO

- **Evidencia:** ADR-025 parte 1 item 5 (a Tenant API repassa ao sidecar a 2a asserção, `aud=tool-gateway:<t>`, `scope` por rota, sem claim de recurso); item 9 (o bundle traz politicas de ferramenta/agente/conector, JWKS e revogacao, nao ACL por documento); P8' diz que o sidecar "reavalia a permissao do ator no bundle", o que o conteudo do bundle nao permite; trade-off "reutilizavel pelo runtime dentro do TTL" cita `jti` de uso unico so la. A afirmacao dos Beneficios ("runtime nao alcanca `content`") vale para o papel `app`, nao para o caminho via sidecar. Confirmado por leitura; nao e preexistente, nasce desta decisao.
- **Regra de negocio/criterio:** AC do ticket exige "fluxo de leitura ponta a ponta com pontos de autorizacao enumerados"; ADR-018 trata o runtime como parcialmente nao confiavel; threat model T-F4-E/RISK-013 (confused deputy). Um runtime comprometido por prompt injection com uma asserção valida le qualquer documento que o ator possa ver, nao so o pedido. Isolamento entre tenants nao e afetado (revisor correto).
- **Decisao do ADR vs. decisao humana:** o ADR deve fechar o que e barato e de desenho (nao depende de produto) e declarar como requisito explicito de aceite o que depende de modelo de dados (ACL). Nao declarar apenas o risco: a vinculacao ao recurso e uma linha de claim e muda a classe do ataque de "qualquer documento do ator" para "o documento que a UI pediu".
- **Instrucao objetiva (editar so o ADR-025 e o registro da entrega):**
  1. Item 5: a 2a asserção leva `res` = `{type:"document", id}` (e `req`), emitida pelo CP somente para o recurso da rota solicitada pelo usuario; `scope` por rota continua.
  2. Item 8 e P7': o sidecar rejeita se `res` diferir do argumento da chamada (teste proposto: asserção do doc X rejeitada para o doc Y) e consome `jti` de uso unico (premissa do ADR-018, Consequencias: cache em memoria por instancia, uma instancia; reinicio reabre a janela de TTL <= 60 s; registrar).
  3. P8': reescrever. O sidecar garante "usuario autenticado pelo CP + recurso pedido + scope". A ACL por documento ("o ator pode ver o doc X") tem duas origens possiveis, a decidir em DAT-002/TGW-003: (i) tabela de ACL/membership no esquema `content` lida pelo sidecar com o papel `tools` (nao pela Tenant API); (ii) ACL materializada no bundle (so se couber nos "metadados minimos" do CP, o que o ADR-025 hoje nao assume). Ate la, declarar como **risco residual R-1**: a autorizacao por recurso de conteudo ainda depende da Tenant API; H-8/RISK-013 permanece aberto.
  4. Beneficios/Contexto: qualificar "content fora do alcance do runtime" como valido para o papel `app`; via sidecar o alcance e limitado por `res` + TTL + `jti`.
  5. Nova pendencia **H-11**: aceitar R-1 para o MVP, ou exigir a opcao (i) antes de TGW-003/WEB-004; incluir o teste proposto como item (d) na lista de testes de aceite e em H-10.
- **Risco de regressao:** baixo (texto). Acrescenta claim ao contrato proposto, ainda nao implementado; contratos so entram em `packages/contracts` apos aceite. Verificar que o diagrama e a tabela P1..P11 ficam consistentes com `res`.
- **Teste esperado:** revalidacao focal por leitura (decisao 5, 8, P7'/P8', H-11) e presenca do teste (d). Verificacao comportamental fica para TGW-001/003.

### REVIEW-002 - APLICAR (documento + PoC), MEDIO mantido

- **Evidencia:** `run.sh` `adm()` usa `-U postgres` (superuser); a matriz e E-1 afirmam provisioner "sem superuser". A sonda do revisor (PG 16.15, `prov` com `CREATEDB CREATEROLE`) mostrou `must be able to SET ROLE` ao criar database com `OWNER` e `REVOKE CONNECT ... postgres/template1` sem efeito (WARNING, `datacl` inalterado). Consistente com o comportamento documentado do PostgreSQL 16 (privilegio sobre database alheio exige ser dono ou superuser).
- **Regra:** SEC-02 (ninguem de tenant conecta a `postgres`/`template1`) e AC-1 dependem de a revogacao realmente ocorrer; ADR-020/E-1 declara o papel como limitado.
- **Instrucao:** (a) ADR, secao E-1 e DAT-001: separar **bootstrap da instancia** (superuser, uma vez, manual ou imagem: revogar `CONNECT` de `PUBLIC` em `postgres`/`template1`, extensoes) da **operacao do provisioner** (`CREATEDB CREATEROLE`; precisa de `SET TRUE` no owner de cada tenant, concedido na criacao, e `ADMIN` nos papeis que cria); (b) frase "privilegios verificados" restringida aos papeis de tenant; (c) PoC: adicionar fase com `prov` nao superuser que cria o tenant `tc`, e teste que le `datacl` de `postgres`/`template1` apos o bootstrap e exige ausencia de `=c`/`=Tc` para PUBLIC; reexecutar `run.sh` e atualizar `evidencia/saida.txt` e o patch do arquivo de diffs. Se o custo da fase passar de ~30 linhas, aceitar fazer so (a)(b) e registrar (c) como requisito de DAT-001.
- **Risco de regressao:** baixo; a fase nova roda depois das existentes e nao altera os 40 checks. Contagem PASS muda: atualizar README, ADR, registro e lesson que citam "40".
- **Teste esperado:** `run.sh` com PASS=N, FAIL=0; mutante "remove bootstrap" deve falhar o teste de `datacl`.

### REVIEW-003 - APLICAR (documento), MEDIO mantido

- **Evidencia:** Beneficios do ADR ("Comprometer o CP nao entrega nenhuma credencial de banco, integracao ou armazenamento") contradiz a matriz (CP `E` em credenciais de integracao no callback OAuth, H-9). O trade-off cita apenas leitura via Tenant API; o CP e emissor dos tokens `nucleos-runtime+jwt` (ADR-018): com a chave de assinatura cunha `sub=runtime:<t>` para qualquer tenant e o sidecar confia no JWKS do bundle.
- **Instrucao:** reescrever o beneficio para "nao detem credencial de banco de tenant de forma permanente"; acrescentar ao trade-off: CP comprometido com a chave pode invocar ferramentas (inclusive integracoes e escrita) em qualquer tenant e ler `content` via sidecar, ou seja, o CP continua o ponto de maior impacto, e a mitigacao e chave em cofre/KMS, TTL curto e auditoria; mover a recomendacao de H-3 (chaves distintas por finalidade: asserção de UI, token de runtime, bundle) para a decisao como requisito de implementacao, mantendo a escolha final em H-3; exigir que o sidecar registre `iss`/`kid` na trilha `audit.tool_invocations`.
- **Risco:** nenhum funcional; cuidado para nao contradizer o ADR-018 (nao editar o ADR-018, o adendo e H-3).

### REVIEW-004 - APLICAR (documento), MEDIO mantido

- **Evidencia:** item 9 diz "o sidecar verifica a assinatura" sem dizer a chave nem a rotacao; o JWKS dos tokens vem do proprio bundle, entao a chave do bundle e a raiz de confianca e um vazamento dela nao e removivel pelo canal do bundle. `valid_until` existe no bundle mas nao esta nas verificacoes. ADR-018 7.1 deixa pendente a decisao (a)/(b) sobre snapshot velho do CP, nao referenciada aqui.
- **Instrucao:** item 9: a chave publica de verificacao do bundle (com `kid`) e entregue pelo provisioner por arquivo (ADR-020), fora do canal do bundle; rotacao e revogacao dessa chave por procedimento do provisioner, nao por bundle; verificacoes do sidecar incluem `valid_until` (relogio de parede, tolerancia 30 s) alem de `max_staleness` monotonico; `bundle_version` mais alta aceita e **persistida** localmente, para que reinicio do sidecar nao aceite bundle antigo reenviado (lacuna adicional do auditor, ver abaixo); remeter explicitamente a opcao (a)/(b) do ADR-018 7.1 e declarar que, sem (a), um snapshot velho do CP continua nao coberto. Acrescentar a H-4.
- **Risco:** baixo; apenas texto. Teste proposto (c) ja cobre bundle antigo/expirado: acrescentar "apos reinicio".

### REVIEW-005 - APLICAR (documento), MEDIO mantido

- **Evidencia:** a matriz cobre runtime, sidecar, CP, provisioner, AI Gateway, dispatcher, mas nao backup/restore (DAT-007), offboarding/purge (PRV-010), exporter/observabilidade de PostgreSQL nem o runner de migracao como componente. A linha do provisioner marca `app`/`tools` como `E (gera, entrega)` mas E-1 so reconhece papel administrativo e `migrator`. A frase final "nenhum componente compartilhado detem credencial de multiplos tenants" fica incompleta.
- **Regra:** AC-1 do ticket e o entregavel "matriz quem detem qual credencial".
- **Instrucao:** adicionar linhas/colunas Backup/restore, Offboarding/purge, Exporter/observabilidade, Runner de migracao; para cada uma, dizer se usa papel administrativo, credencial por tenant ou superuser, ou "a definir em DAT-007/PRV-010" quando a decisao ainda nao existe (nao inventar); incluir `app`/`tools` (geracao e entrega para todos os tenants) em E-1; reescrever a frase final restringindo-a aos componentes listados e remetendo as lacunas ao dono. Se algum desses componentes exigir superuser, criar H-12 para decisao humana.
- **Risco:** pode revelar que o numero de excecoes ao AC-1 e maior que duas; isso e o objetivo e deve ir ao H-2.

### REVIEW-006 - APLICAR (PoC + redacao), MEDIO mantido

- **Evidencia:** leitura do `run.sh`: nenhum teste exercita `statement_timeout`, `CONNECTION LIMIT 2/10/10`, `REVOKE ALL ON SCHEMA public` (o teste "CREATE TABLE em public" ja negaria sem o REVOKE no PG >= 15) nem `ALTER DEFAULT PRIVILEGES`. Mutantes M8/M9/M12/M13 sobreviveram segundo o revisor. `expect_deny` aceita qualquer falha.
- **Regra:** o ADR cita "privilegios verificados... 40 verificacoes" e usa os limites no calculo de 308 conexoes; afirmacao de cobertura deve corresponder ao exercitado.
- **Instrucao (ordem de custo):** (1) `expect_deny` passa a exigir `permission denied|password authentication failed|too many connections|no pg_hba` no texto e a reportar o motivo; (2) testes: abrir 3 conexoes simultaneas como `ta_migrator` (`pg_sleep` em background) e esperar falha na 3a; `SHOW statement_timeout` como `app` e `tools` == `30s`; como owner criar funcao em `runtime` e provar que `app` nao executa sem GRANT; `CREATE` em `public` testado a partir de um papel sem o default do PG 15 (por exemplo, `public` com `GRANT CREATE ... TO PUBLIC` na copia de controle, e o REVOKE o neutraliza); (3) rodar M8, M9, M12, M13 novamente e confirmar que agora falham; (4) se algum item nao couber, retirar a afirmacao do ADR/README e reduzir a frase de cobertura. Atualizar saida, patch de diffs e contagens citadas.
- **Risco de regressao:** o teste de conexoes pode ser flaky (temporizacao); usar `pg_sleep` com espera ate `pg_stat_activity` mostrar 2 sessoes. Manter o container sem porta publicada e sem residuo.
- **Teste esperado:** FAIL=0 no produto e mutantes mortos.

### REVIEW-007 - APLICAR parcial, ADIAR parcial, BAIXO mantido

- **Aplicar:** `adr/0025` (orcamento de RAM): marcar "custo de RAM no PostgreSQL de 3 GiB" para 308 conexoes como estimativa sem fonte (e nota de possivel sobreposicao com os 3 GiB de PostgreSQL do consolidado 4.2), com medicao em DAT-001. Evidencia: o numero nao tem fonte nem metodo no ADR.
- **Adiar:** fixar digest da imagem e passar senhas por `--env-file`/stdin. Impacto residual: PoC descartavel com senhas sinteticas, efemeras e sem porta publicada, versao efetiva 16.15 registrada; exposicao em `ps` limitada ao host de PoC. Condicao de retomada: se o `run.sh` virar teste de CI (DAT-005/CI), ou migrar para ambiente compartilhado.

### REVIEW-008 - ADIAR, BAIXO mantido

- **Evidencia:** a numeracao `09 - ...` da lesson e provisoria e declarada no proprio texto; a trilha na branch diverge da trilha no checkout principal (revisor). Renumerar agora seria retrabalho e conflitaria com a integracao.
- **Impacto residual:** links para `09 - Papeis...` (ADR-025, README do PoC, registro, `lessons/README.md`) quebram ou ficam fora de ordem se a integracao nao os atualizar. **Condicao de retomada:** na integracao em `revisao/<lote>`, recalcular numeracao (provavel 07), atualizar o indice e todos os links e verificar com busca que nao restam referencias ao nome antigo (regra do CLAUDE.md). O ponto "sem exemplo executavel de `WITH INHERIT FALSE, SET TRUE` e sem exercicio com resposta" e melhoria didatica nao bloqueante: ADIAR para a mesma integracao, sem ticket automatico.

### REVIEW-009 - APLICAR (redacao), BAIXO mantido

- **Evidencia:** secao "Rede" chama a rede `internal` de "sem egress direto" e na mesma frase o sidecar tem egress para PostgreSQL, storage e integracoes; a decisao 5 nao cita `jti` de uso unico no sidecar (so o trade-off).
- **Instrucao:** esclarecer que `internal` vale so para o par runtime-sidecar e que o egress do sidecar sai por outra interface/rede; copiar `jti` de uso unico e `res` para a decisao 5 (feito junto com REVIEW-001).
- **Risco:** nenhum.

## Lacunas essenciais do review (registradas, sem bloquear)

1. **Reinicio do sidecar e rollback de bundle** (nao citado): `bundle_version` mantida so em memoria permite aceitar bundle antigo apos restart. Absorvido em REVIEW-004 (versao persistida). Classificada como parte de REVIEW-004, nao novo ID.
2. **Visibilidade de catalogo** (`pg_database`, `pg_roles` listam nomes de outros tenants a qualquer papel de tenant): o revisor a registrou como nao testada. Auditoria: vazamento de metadados de nomes; nao quebra o isolamento de dados. ADIAR para DAT-005 com nota no ADR como risco residual (nomes de tenant opacos/aleatorios por allowlist mitigam). Condicao: antes de DAT-005 ou se o nome do banco contiver dado identificavel.
3. **Unicidade de `jti` na Tenant API e no sidecar** depende de cache em memoria por instancia (premissa do ADR-018): o review nao verificou se o ADR-025 herda essa premissa. Incluido na instrucao de REVIEW-001.
4. O review nao exerceu comportamento do fluxo CP -> Tenant API/bundle (sem codigo), declarado pelo revisor; nao e lacuna do review, e limitacao da entrega. Destino sugerido: testes (a)..(d) em RUN-001, TGW-001/003 e MSG-002, nao PoC novo agora.

Nenhuma lacuna impede a auditoria.

## Riscos de regressao agregados

- Documento: inconsistencia interna entre decisao 5/8, P7'/P8', trade-offs, H-x e lista de testes ao inserir `res`, H-11 e nova matriz; reler o ADR inteiro e o registro da entrega apos a edicao.
- PoC: numero de verificacoes (40) citado em ADR, README, registro, lesson e arquivo de diffs; todas as citacoes e o patch devem ser regenerados do `run.sh` final.
- Nao editar o ADR-018 (o adendo e H-3). Status do ADR-025 permanece "Proposto"; nao marcar AC-1 como cumprido.

## Limitacoes desta auditoria

- Nenhum PoC reexecutado; mutantes e sonda aceitos do revisor e cruzados por leitura do script.
- Sem PoC do fluxo CP -> Tenant API/sidecar; decisoes sobre `res`/ACL sao de desenho.
- ADR-016 e ADR-020 nao foram relidos integralmente; conclusoes sobre eles dependem do que o ADR-025 e o review citam.
- A aceitacao de R-1, das excecoes E-1/E-2 e das demais H-x continua sendo decisao humana.

## Veredito

**CORRECOES_NECESSARIAS.** APLICAR: REVIEW-001, 002, 003, 004, 005, 006, 009 e a parte documental de 007. ADIAR: REVIEW-008 e as partes de higiene do PoC de 007. Nenhum REJEITAR. Encaminhar os IDs APLICAR ao review-loop-driver; revalidacao focal em sessao independente nos IDs aplicados. Sem fato novo, nao reabrir os ADIAR.
