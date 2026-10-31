# Auditoria independente da review DEC-002 (perfil critico) - 2026-10-25

- Relatorio de origem: `documentacoes/reviews/2026-10-25-review-dec-002.md` (REVIEW-001..005; namespace DEC-002, nao se mistura com REVIEW-nnn de outras tarefas).
- Tarefa: ENT-DEC-002 (AC-1..3). Worktree: `/home/vinicius/nucleos-worktrees/tarefa/dec-002` (somente leitura), branch `tarefa/dec-002`.
- Base: `4be3ce391a51b9e24cd85f7c894d841636dcd50f`; HEAD: `7d45e877f428841fdcc590ed30c82e624b47e671` (confirmado igual ao revisado; arvore do worktree limpa; nenhuma mudanca desde a review).
- Auditor: sessao independente do implementador e do revisor (Claude, papel `auditor-de-review`); nao editou codigo nem commitou.
- Lido: SKILL do auditor, review completa, ADR-016 integral, `server.mjs`, `schema.sql`, `run.sh`, trechos de `poc.mjs`, documento de entrega, `lessons/README.md`, spec ENT-DEC-002, arvore `lessons/` de `tarefa/dec-003`.

## Reproducao (Node 24.22.1; Docker `postgres:16-alpine` proprio em 127.0.0.1:55488, descartado; `docker ps -a --filter name=dec002aud` = 0; script em scratchpad, fora do repositorio)

| Caso | Resultado do auditor | Confirma review? |
| --- | --- | --- |
| Mesmo codigo TOTP 2x em /login | 200 e 200 | Sim (REVIEW-001) |
| 30 TOTP errados seguidos | 30x 401, sem bloqueio; codigo correto logo depois -> 200 | Sim (REVIEW-001) |
| JSON invalido em /login | 500 | Sim (REVIEW-002) |
| `X-Tenant-Id: abc` em /me | 500 | Sim (REVIEW-002) |
| Corpo de 50 MB em /login | corpo lido por inteiro (~2,2 s) e ao fim 500 (JSON.parse de brancos); sem 413 | Sim, com nuance: nao foi "aceito" como login, foi consumido e falhou em 500 |

Nao executado pelo auditor: `run.sh` completo (13/13), `medir-ram-idp.sh` (Keycloak/Kratos), checagem das fontes externas (sem rede). Confio no 13/13 reportado pelo revisor e na saida versionada; nenhuma decisao abaixo depende deles.

## Criterio de auditoria

Entrega e um PoC de decisao descartavel; o ADR-016 e quem guia IAM-003/IAM-004/WEB-001 e esta marcado Proposto (aceite humano). Por isso um defeito do PoC so e bloqueante se o ADR deixar de exigir o controle, ou se a evidencia apresentada for enganosa. Nenhuma correcao de codigo do PoC e exigida.

## Decisoes

### REVIEW-001 - TOTP sem uso unico e sem rate limit
- Severidade original: MEDIO; avaliada: MEDIO (mantida; ASVS V2 exige impedir reuso de OTP e limitar tentativas, e o ADR e a fonte de IAM-003).
- Decisao: **APLICAR (somente texto do ADR-016, secao Consequencias)**.
- Evidencia: reproduzido. O ADR atual so diz "limitacao de tentativas", sem uso unico do passo TOTP (RFC 6238 5.2) e sem escopo; a lesson/ADR apresentam o modelo como guia de IAM-003.
- Risco da alteracao: nulo (documental). Nao altera a decisao (opcao 1).
- Plano minimo: em Consequencias, exigir (i) guardar o ultimo time-step aceito por usuario e rejeitar passo <= ultimo; (ii) limite de tentativas e bloqueio progressivo por conta e por IP para senha e para TOTP, com resposta uniforme; (iii) IAM-003 com teste de replay e de excesso de tentativas. Acrescentar uma frase dizendo que o PoC nao implementa nenhum dos dois.
- Teste esperado: revisao do texto do ADR; os testes reais ficam no IAM-003.

### REVIEW-002 - Entradas malformadas viram 500; corpo sem limite
- Severidade original: MEDIO; avaliada: **BAIXO para o PoC, MEDIO como requisito do ADR** (impacto no PoC e baixo; o requisito faltante no ADR e o que importa).
- Decisao: **APLICAR (somente texto do ADR-016)**. Corrigir o codigo do PoC fica REJEITADO como desnecessario (descartavel, "nao reutilizavel como esta" ja declarado).
- Evidencia: reproduzido (500/500; corpo lido integralmente).
- Plano minimo: em Consequencias, exigir que a implementacao real valide formato (UUID de tenant, schema de corpo), imponha limite de corpo e responda 400/413, nunca 500, para entrada de cliente; teste em IAM-003.
- Risco: nulo.

### REVIEW-003 - Celulas sem marcador e fonte duvidosa
- Severidade original: BAIXO; avaliada: **MEDIO-BAIXO** (afeta a honestidade da evidencia de AC-1 e uma afirmacao de migracao sem marcador pode induzir decisao; sem bloquear).
- Decisao: **APLICAR (somente texto do ADR-016)**.
- Evidencia: lido o ADR. Confirmo as celulas sem marcador (SSO opcao 1, LGPD opcoes 1-4, lock-in "baixo" da opcao 1) e a afirmacao "hashes argon2id (PHC) sao importaveis no Keycloak" sem "nao verificado", ao lado da do Kratos que o tem. Fonte 1 (Ory "Session management overview") e citada para "TOTP citado" do Kratos; nao pude conferir a pagina (sem rede) e a atribuicao e duvidosa. Registro como nao verificado, nao como falsa.
- Plano minimo: marcar cada celula com [inferencia] ou [PoC]/[fonte]; marcar a afirmacao do Keycloak como "nao verificada"; trocar a fonte do TOTP do Kratos por pagina de MFA/TOTP do Ory ou rebaixar a celula para [inferencia]; manter a ressalva de que AC-1 so e atendido parcialmente (celulas 2-5 majoritariamente [inferencia]) e depende de aceite humano.
- Risco: nulo.

### REVIEW-004 - Numeros de desempenho nao reproduzem
- Severidade original: BAIXO; avaliada: BAIXO.
- Decisao: **APLICAR (texto; custo trivial, junto com 001-003)**. Apresentar 258 ms como valor da maquina sem faixa e evidencia levemente enganosa; nenhuma conclusao depende dele.
- Plano minimo: no ADR e na entrega, trocar por "faixa observada 58-258 ms por hash; varia por maquina/aquecimento" e idem para rejeicao (5,4-16 ms) e Postgres (34-40 MiB).
- Risco: nulo.

### REVIEW-005 - Ressalvas de projeto
- Severidade original: BAIXO; avaliada: BAIXO. Decisao por subitem:
  - (a) AES-GCM sem AAD: **APLICAR (texto ADR)**: exigir `user_id` como AAD na implementacao real.
  - (b) Bearer vs cookie: **REJEITAR como defeito** (ja declarado no ADR/entrega); **APLICAR** apenas a frase explicita em Consequencias de que cookie/CSRF/fixacao por cookie nao foram exercitados no PoC e devem ter teste em WEB-001/IAM-003.
  - (c) Sem timeout ocioso, rotacao em troca de senha/MFA, limpeza de sessoes expiradas: **APLICAR (texto ADR)** como requisitos da implementacao real.
  - (d) Variaveis mortas em `poc.mjs` e comentario "200 requisicoes em voo": a evidencia e enganosa porque o texto da entrega diz "revogacao sob carga" quando ha um worker sequencial (52-62 req). **APLICAR (texto)**: reescrever o rotulo do `check` e do documento de entrega como "revogacao durante sequencia de requisicoes (um worker)"; ajustar o comentario de `poc.mjs` (alteracao de uma linha em comentario/rotulo, sem mudar logica). Remover variaveis mortas: **ADIAR** (PoC descartavel; retomar so se o PoC for reaproveitado).
  - (e) Verificacao "token em claro nao gravado" fraca: **REJEITAR** (comparacao valida; o ADR nao se apoia nela; custo/beneficio nulo).
- Risco: nulo/baixo (apenas um rotulo no PoC). Rodar `./run.sh` de novo apos mexer no rotulo e conferir 13/13.

## Preservado da review
Veredito original `APPROVED WITH NOTES` preservado. Nenhum item reclassificado para REJEITAR total; nenhum achado e bloqueante de aceite. Verificacoes "OK" da review (argon2id/OWASP, token 256 bits/sha256, revogacao efetiva, tenant por membership, ADR Proposto, sem segredos) nao foram contestadas.

## Nota de integracao (acao do COORDENADOR, nao do executor de DEC-002)
`tarefa/dec-002` cria `lessons/00 - Sessao opaca e revogacao.md` e `tarefa/dec-003` cria `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md` (confirmado em `git ls-tree tarefa/dec-003`); ambas editam a mesma linha de `lessons/README.md` (conflito de merge esperado). O executor de DEC-002 NAO deve renumerar a lesson nesta rodada de correcao. Na integracao em `revisao/<lote>`, o coordenador deve: (1) decidir a ordem pedagogica (SQL/migracoes antes de sessao opaca e revogacao, pois a segunda usa PostgreSQL; sugestao: Migracoes = 00, Sessao opaca = 01, a validar contra a lesson que avisa que TypeScript/PostgreSQL basicos virao antes); (2) renomear, atualizar `lessons/README.md` e todos os links relativos (ADR-016 em "Referencias", documento de entrega e seu `-diffs.md`, e os da DEC-003); (3) rodar `grep` por nomes antigos e confirmar zero ocorrencias; (4) resolver o conflito do indice preservando as duas entradas. Se a lesson for renomeada depois das correcoes de REVIEW-001..005, os links devem ser atualizados so uma vez, na integracao.

## Plano consolidado para o executor (ordem)
1. ADR-016: Consequencias (001, 002, 005a/b/c), tabela (003), numeros (004). 2. Entrega: rotulo "sob carga" (005d) e faixas (004), e registrar o diff real da correcao. 3. `poc.mjs`: so comentario/rotulo (005d); reexecutar `./run.sh` e anexar 13/13. 4. Reler documentos e links; sem renomear lesson.

## Veredito
**CORRECOES_NECESSARIAS** - todas documentais e de baixo risco (APLICAR: 001, 002, 003, 004, 005a/b-texto/c/d-rotulo; ADIAR: 005d-variaveis mortas; REJEITAR: 005e e correcao de codigo do PoC para 002). Nenhum defeito de codigo bloqueante. Razao do veredito: o ADR e a fonte de IAM-003 e hoje omite controles criticos (uso unico de TOTP, rate limit, limite de corpo/validacao) e apresenta evidencia com alcance maior que o medido; ate corrigir, nao deve ir ao aceite humano. Sem push/commit por esta auditoria; ela sozinha nao autoriza implementar.
