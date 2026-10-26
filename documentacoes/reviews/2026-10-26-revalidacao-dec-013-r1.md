# Revalidacao focal DEC-013 (ADR-025), rodada de correcao 1 - 2026-10-26

- **Tarefa:** ENT-DEC-013 (perfil CRITICO, documental + PoC). Worktree/branch: `/home/vinicius/nucleos-worktrees/tarefa/dec-013`, `tarefa/dec-013`.
- **Revisor:** sessao independente (Claude Sonnet 5.5), nao implementou nem fez o review/auditoria originais.
- **Escopo:** `git diff 97afa43..086851a` (correcao `616ebb6`, `67a7ae3`, `086851a`) sobre review `1329c4d` e auditoria `46664af`. Arvore limpa. IDs APLICADOS: REVIEW-001, 002, 003, 004, 005, 006, 007 (parte), 009. REVIEW-008 e a higiene do PoC de 007 foram ADIADOS pelo auditor e nao reabertos.
- **Lido:** ADR-025 integral (releitura completa), `run.sh`, README do PoC, registro e arquivo de diffs, lesson 09 (diff), ADR-018 (decisoes 4, 5, 7.1, consequencias) e ADR-020 por busca dirigida.
- **Verificacoes executadas:**
  - `run.sh` reexecutado (container efemero, sem `-p`): `PASS=56 FAIL=0`, exit 0; saida identica a `evidencia/saida.txt` (exceto IP); `docker ps -a | grep dec013` vazio antes e depois.
  - 7 mutantes em `git clone --no-hardlinks` no scratchpad (checkout `086851a`, produto intocado), todos mortos: sem `REVOKE ALL ON SCHEMA public` (`PASS=55 FAIL=1`, `has_schema_privilege` obteve `t`), sem `CONNECTION LIMIT 2` (`55/1`, 3a conexao nao negada), sem `ALTER DEFAULT PRIVILEGES` (`55/1`), sem `statement_timeout` do `app` (`55/1`, obtido `0`), sem o do `tools` (`55/1`), sem `REVOKE CONNECT` em `template1` (`51/5`), `migrator` com `INHERIT TRUE` (`55/1`).
  - Sonda separada em PostgreSQL 16 efemero (`prov` `NOSUPERUSER CREATEDB CREATEROLE`), reproduzida: `REVOKE CONNECT ... template1/postgres FROM PUBLIC` devolve `WARNING: no privileges could be revoked` e `datacl` continua `{=c/postgres,...}` e `{=Tc/postgres,...}`; `CREATE DATABASE d OWNER o2` falha com `must be able to SET ROLE "o2"`.
  - Patch do commit `616ebb6` no arquivo de diffs comparado byte a byte com `git diff 97afa43..616ebb6 -- run.sh`: identico.
  - Nao executado: lint/test/build (entrega documental), QA, reexecucao dos demais mutantes do review.

## Classificacao por ID

| ID | Resultado | Evidencia |
| --- | --- | --- |
| REVIEW-001 | CORRIGIDO (com uma ressalva nova, REV-001) | Decisao 5: 2a asserção leva `res={type:"document",id}` e `req`, emitida pelo CP so para o recurso da rota; decisao 8 e P7': sidecar compara `res` com o argumento e consome `jti` de uso unico; P8' reescrito: o sidecar garante "usuario autenticado + recurso + scope", ACL por documento declarada como nao existente no bundle, com origens (i)/(ii) e risco residual R-1; H-11; teste (d) na lista de aceite. Beneficios e trade-off qualificados ("via sidecar limitado por `res` + TTL + `jti`"). Premissa do `jti` em memoria e reinicio declaradas. |
| REVIEW-002 | CORRIGIDO | Paragrafo "Bootstrap x operacao do provisioner" separa superuser (revogacoes, `vector`, criacao do papel) da operacao (`SET TRUE` no owner via `ADMIN` do criador). Fase do PoC com `prov` nao superuser: 13 verificacoes, inclui leitura de `datacl` e a negacao com mensagem `must be able to SET ROLE`; premissas reproduzidas pela sonda. Frase "verificados" restrita a papeis de tenant e a fase do provisioner. Mutante sem REVOKE em `template1` e morto. |
| REVIEW-003 | CORRIGIDO | Beneficios reescrito (nao entrega credencial de banco/armazenamento; OAuth transita no callback, H-9). Trade-off acrescenta: com a chave o CP cunha `sub=runtime:<t>` para qualquer tenant, invoca ferramentas (integracoes e escrita) e le `content` via sidecar; chaves distintas por finalidade viram requisito de implementacao (H-3 so decide o adendo); sidecar registra `iss`/`kid` (decisao 10). Coerente com ADR-018 (nao editado). |
| REVIEW-004 | CORRIGIDO | Item 9: chave publica do bundle (com `kid`) entregue pelo provisioner em arquivo, rotacao/revogacao fora do canal do bundle (justificativa da circularidade com o JWKS); verifica `valid_until` (relogio de parede, 30 s), `tenant_id`, versao maior, **persiste** `bundle_version`; `max_staleness` monotonico; liga a opcao (a)/(b) do ADR-018 7.1; H-4 e teste (c) "inclusive apos reinicio". Ressalva baixa REV-003. |
| REVIEW-005 | CORRIGIDO | Matriz ganha linhas para papel administrativo e superuser de bootstrap; tabela de componentes nao resolvidos (runner, backup, offboarding, exporter) com dono e sem inventar decisao; `app`/`tools` em E-1; frase final restrita ao "escopo decidido aqui" e remete aos quatro componentes; H-12. |
| REVIEW-006 | CORRIGIDO | Os quatro controles agora tem teste e os 4 mutantes (mais `tools` timeout) falham. `expect_deny` exige mensagem: padrao `permission denied\|password authentication failed`, e regex especifica nos casos de limite, funcao e `SET ROLE`; erro de sintaxe passa a falhar (a 1a execucao com `FAIL=10` registrada mostra que pegou erros antes mascarados). Robustez: adequada; ver REV-004 (baixo) sobre o padrao amplo. Nao ha mais afirmacao de cobertura sem teste. |
| REVIEW-007 (parte) | CORRIGIDO | "3 GiB"/308 conexoes marcado como estimativa sem fonte, com possivel sobreposicao com os 3 GiB do consolidado e medicao em DAT-001. Digest/env-file adiados conforme auditoria. |
| REVIEW-009 | CORRIGIDO | Rede: `internal` vale so para o par runtime-sidecar, egress por outra rede; decisao 5 com `res` e `jti`. Status segue **Proposto**; indice `adr/README.md` coerente ("Proposto, aceite pendente, Q-08"). |

## REVIEW-001: fecha ou declara honestamente?

Declara honestamente e fecha o que e de desenho. A classe do ataque passa de "qualquer documento do ator por 60 s" para "o documento pedido, uma vez" (res + jti + TTL), e o que nao se fecha (ACL por documento, origem (i)/(ii)) esta nomeado como R-1, com decisao humana (H-11) e H-8/RISK-013 mantidos abertos. Sem contradicao com ADR-018: a asserção `nucleos-ui-read+jwt` e outro tipo (a reutilizacao no TTL do ADR-018 5 vale para `nucleos-runtime+jwt`), a premissa do `jti` em memoria e herdada e declarada, e o adendo continua em H-3 sem editar o ADR-018. Sem contradicao com ADR-020: o provisioner so aparece como detentor transitorio (E-1) e entrega por arquivo. Ver REV-001 para a unica sobra de redacao.

## Novos achados (REV-nnn)

### REV-001 - MEDIO - "ele nao consegue pedir outro" (P8' / R-1) excede o que o desenho garante

- `adr/0025-...md:143` (P8') e `:26` (decisao 5, "reduz o alcance... para o documento que a UI pediu").
- Problema: o vinculo `res` so protege o caminho de leitura **pedida pela UI**. O runtime tambem chama o sidecar com o token do ADR-018 em execucoes de agente (decisao 8), com o contexto `ator` declarado pelo proprio runtime; se `allowed_tools` incluir ferramenta que le `content` (busca/leitura de documento), um runtime comprometido a invoca sem asserção de UI e le qualquer documento que a ferramenta alcance. O ADR nao diz que a operacao "leitura de conteudo para a UI" e um endpoint distinto, que so aceita a asserção, nem que ferramentas de agente sao outro caminho (esse e o RISK-013/H-8, mas P8' afirma como absoluto).
- Correcao (texto): qualificar R-1: o limite "um documento, uma vez" vale para o endpoint de leitura da UI; o caminho de ferramentas de agente fica limitado por `allowed_tools`, `ator` e pelo RISK-013 (H-8). Acrescentar requisito: o endpoint de leitura da UI no sidecar nao e invocavel com o token de runtime sozinho (e vice-versa). Nao bloqueia a submissao ao aceite se declarado em H-11.

### REV-002 - BAIXO - Contagem "40" nao rotulada no resumo e na tabela do registro

- `documentacoes/arquitetura/2026-10-26-dec-013-acesso-ui-e-tool-gateway.md:22` ("40 verificacoes, `PASS=40 FAIL=0`"), `:54` (tabela de validacoes) e `:80`.
- A secao 10.1 explica que "40" descreve a entrega original e que o vigente e 56, mas a linha 22 (resumo) e a 54 nao dizem "original". Rotular no ponto de uso ou trocar a linha 22 para 56. A mesma secao diz "um segundo commit"; sao dois (`67a7ae3`, `086851a`). A lesson 09, README do PoC e ADR usam 56 de forma consistente; busca por "40 verif|PASS=40" fora de reviews so retorna o registro.

### REV-003 - BAIXO - Persistencia da `bundle_version` precisa de volume fora do alcance do runtime

- `adr/0025-...md:33`. "persiste em disco do proprio tenant" nao diz que o volume do sidecar e distinto e nao gravavel pelo runtime; se o runtime comprometido puder apagar/regredir o arquivo, o rollback de bundle volta a ser possivel. Acrescentar o requisito ao item 9 ou a PRV-004 (volume proprio do sidecar, somente o sidecar escreve).

### REV-004 - BAIXO - Padrao de `expect_deny` aceita duas mensagens

- `run.sh:92-96`. O padrao `permission denied|password authentication failed` e adequado (os mutantes das negacoes cruzadas sao mortos, inclusive M17), mas uma negacao por falha de autenticacao poderia mascarar uma ausencia de REVOKE se a senha do caso estivesse errada. Risco teorico, coberto pelo controle positivo do harness. Sem acao obrigatoria; opcionalmente passar regex explicita (`permission denied for database`) nas negacoes de CONNECT.

## Coerencia geral

- ADR-025 segue **Proposto** em todos os pontos (cabecalho, indice, registro); AC-1 continua nao cumprido por processo.
- H-1..H-12 coerentes entre si e com o registro (H-11 R-1, H-12 backup/offboarding/exporter; H-3 e H-4 ajustados). Teste proposto (d) listado e ligado a H-10.
- Contagens: ADR, README do PoC, lesson 09 e saida em 56; sobra apenas REV-002.
- Lesson 09: diff limitado a contagem e a nota sobre superuser; SQL do exemplo nao mudou (executado no review original). REVIEW-008 segue adiado (renumeracao na integracao).
- Registro e diffs: SHA, comandos e resultados batem com o que reexecutei (56/0, mutantes mortos); patch literal identico ao `git diff`. A `086851a` apenas corrige SHA citado.
- Segredos: nenhum; senhas geradas em runtime, `prov` e `tc_app` descartaveis; saida nao imprime senhas.

## Veredito

**APPROVED WITH NOTES.** Os oito IDs aplicados estao CORRIGIDOS; nenhuma REGRESSAO; nenhum item AINDA PRESENTE. REV-001 (medio, so redacao) deve ser absorvido antes da submissao ao aceite humano ou declarado em H-11; REV-002 a REV-004 sao baixos e opcionais. Aceite do ADR, R-1, E-1/E-2 e H-1..H-12 continuam decisao humana. Sem nova rodada de correcao obrigatoria alem da absorcao textual de REV-001.
