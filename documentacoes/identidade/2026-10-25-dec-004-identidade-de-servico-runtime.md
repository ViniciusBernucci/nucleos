# Identidade de serviço runtime ↔ Control Plane ↔ gateways (DEC-004) — 2026-10-25

## 1. Metadados

- **Domínio:** identidade
- **Tarefa/solicitação:** [ENT-DEC-004](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-004) (lote 2026-10-25-ep00-ep01-fundacao)
- **Branch:** `tarefa/dec-004`
- **Base / commit inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f` (informada pelo coordenador; `HEAD` inicial idêntico)
- **Estado da árvore no início:** limpa (worktree nova)
- **Estado da entrega:** pronta para revisão independente; ADR-018 permanece **Proposto** (só o usuário aceita)
- **Autores conhecidos:** Claude Sonnet 5.5 (executor)

## 2. Objetivo, contexto e escopo

- **Objetivo:** especificar como cada runtime prova quem é, para quem o token vale e como é revogado, sem reaproveitar token de usuário.
- **Contexto:** consolidado 5.1, 9, SEC-07 e SEC-15; opções A (JWT), B (mTLS), C (combinação) do ticket.
- **Escopo:** ADR-018 (Proposto); esquemas JSON do token e do handshake como **proposta**; PoC descartável com runtime falso (emitir, validar, rejeitar, rotacionar, revogar, medir latência).
- **Fora do escopo:** `packages/contracts` (FND-003); implementação real no Control Plane, dispatcher ou gateways; mTLS/step-ca; armazenamento de chaves em KMS; teste com rede, banco ou containers; alteração do índice `adr/README.md` (evitar conflito com ADR-016/017 de outras tarefas; o índice deve listar ADR-018 na integração).

## 3. Resumo da implementação

Recomendação proposta: opção A, JWT EdDSA com TTL de 5 min emitido pelo CP após enrollment com segredo de uso único e prova de posse (`client_assertion`), validação 100% local com JWKS/estado de revogação em cache, duas chaves ativas para rotação e três níveis de revogação (por tenant via `ver`, por chave de assinatura, por `jti`). O PoC executa o fluxo ponta a ponta com 23 testes automatizados (17 originais + 4 da rodada 1 + 1 da rodada 2 + 1 da rodada 3) e uma demo narrada.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0018-identidade-de-servico-runtime-control-plane-gateways.md` | doc | ADR-018, status Proposto |
| `documentacoes/arquitetura/contratos-propostos/runtime-token.schema.json` | contrato proposto | Header e claims do token (JSON Schema 2020-12) |
| `documentacoes/arquitetura/contratos-propostos/handshake.schema.json` | contrato proposto | Enrollment, pedido/resposta de token, JWKS, estado de revogação |
| `documentacoes/arquitetura/poc/dec-004/lib/{jwt,schemas,control-plane,validator,fake-runtime,env}.mjs` | código (PoC) | Ed25519/JWT, CP falso, validador local, runtime falso, cenário |
| `documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs` | teste | 23 testes (ver Correções rodadas 1, 2 e 3) |
| `documentacoes/arquitetura/poc/dec-004/{demo,bench}.mjs` | código (PoC) | Demo narrada e benchmark |
| `documentacoes/arquitetura/poc/dec-004/package.json`, `package-lock.json` | config | Dependências de desenvolvimento mínimas, travadas |
| `documentacoes/arquitetura/poc/dec-004/README.md`, `saida/{test,demo,bench}.txt` | doc/evidência | Como reproduzir; saídas reais |
| `documentacoes/identidade/2026-10-25-dec-004-identidade-de-servico-runtime.md` e `...-diffs.md` | doc | Este documento e seus diffs |

Nenhuma migração.

## 5. Decisões técnicas, alternativas e consequências

Detalhadas no [ADR-018](../arquitetura/adr/0018-identidade-de-servico-runtime-control-plane-gateways.md). Pontos de implementação do PoC:

- Somente `node:crypto` para Ed25519; `ajv` apenas para validar contra os esquemas propostos (garante que os esquemas são executáveis, e não só texto). Alternativa descartada: `jose`, para não esconder o formato.
- O tenant esperado vem do **contexto** da chamada; o `tenant_id` do token só é comparado, nunca confiado (SEC-07).
- Replay: `jti` de uso único no dispatcher e nas `client_assertion`; nos gateways o token é reutilizável durante o TTL. Isso é uma decisão a confirmar pelo usuário (ADR, pendência 4).
- O `jti` só é gravado após todas as checagens passarem (token inválido não "queima" o jti).
- `kid` desconhecido: um refresh por janela de 10 s (evita amplificação contra o CP).

## 6. Validações (comandos e resultados reais)

Node 24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64`); o `node` padrão do sistema é 22.23.3 e não foi usado.

| Comando (em `documentacoes/arquitetura/poc/dec-004`) | Resultado |
| --- | --- |
| `npm install` (autoria) e `npm ci` (reprodução do lock) | 6 pacotes (ajv 8.17.1, ajv-formats 3.0.1 e transitivas); sucesso |
| `npm test` | 23 testes, 23 aprovados, 0 falhas (rodada 3; 22 na rodada 2, 21 na rodada 1, 17 originais) ([saida/test.txt](../arquitetura/poc/dec-004/saida/test.txt)) |
| `npm run demo` | casos negativos todos REJEITADOS com o código esperado; rotação e revogação de emergência demonstradas ([saida/demo.txt](../arquitetura/poc/dec-004/saida/demo.txt)) |
| `npm run bench` | ver abaixo ([saida/bench.txt](../arquitetura/poc/dec-004/saida/bench.txt)) |

Mapa para os critérios de aceite:

- **AC-1 (casos negativos rejeitados):** expirado (`expired`), audiência errada (`bad_audience`), tenant adulterado (`bad_signature`), tenant de A em contexto de B (`tenant_mismatch`), versão revogada (`version_revoked`), replay de `jti` (`replay`), `alg` none/HS256 (`malformed`/`bad_header`), chave do atacante (`bad_signature`), `kid` desconhecido, escopo ausente, TTL excessivo, `iat` futuro. **Status do ADR: Proposto; o "aceito" do AC-1 depende do usuário e não foi declarado.**
- **AC-2 (rotação e revogação de emergência documentadas e demonstradas):** ADR itens 6 e 7; testes "ROTACAO..." e "REVOGACAO DE EMERGENCIA..." e seções 3 e 4 da demo.
- **AC-3 (latência sem rede por requisição):** teste "VALIDACAO LOCAL" (1000 validações, 0 chamadas de rede) e contador `networkCalls` no benchmark.

Latência medida na execução original (VM de 4 vCPU AMD EPYC compartilhada, N = 20000 após aquecimento, ruído alto no p99; `saida/bench.txt` foi regerado na rodada 1 e mostra outra execução, com p99 de 1641 µs e 6536 µs: o p99 varia de ~1,7 a 8,7 ms entre execuções e é inconclusivo frente ao gatilho de 5 ms):

| Operação | p50 | p95 | p99 |
| --- | --- | --- | --- |
| validate, token reutilizável (gateways) | 231 µs | 631 µs | 5391 µs |
| validate, uso único com cache de jti (dispatcher) | 421 µs | 1681 µs | 8701 µs |
| emissão no CP (verificar assertion e assinar) | 1086 µs | 11550 µs | 31582 µs |

Não executado e por quê: nenhum teste com rede, containers ou banco (fora de escopo e sem ambiente isolado declarado); benchmark em hardware alvo (VPS) e sob carga concorrente; lint/formatação (o repositório ainda não define lint para `documentacoes/`); JSON Schemas apenas exercitados pelo ajv no PoC, sem validação por outra implementação. A medição do p99 é instável nesta VM e deve ser repetida no host alvo.

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- Nenhum impacto em código de produto: somente documentação e PoC isolado. Rollback: `git revert` do commit ou remover as pastas.
- Riscos do desenho: latência de revogação limitada por poll/push; CP como ponto de emissão; bearer reutilizável nos gateways; JWT manual do PoC não serve para produção.
- Observabilidade proposta: registrar `jti`, `kid`, `tenant_id`, código de rejeição e idade do JWKS em cache; nunca token, segredo de enrollment ou assertion.
- Segurança do PoC: chaves geradas em memória a cada execução; nenhum segredo persistido ou versionado.

## 8. Commits e diffs

- Início: branch `tarefa/dec-004`, `HEAD` `4be3ce391a51b9e24cd85f7c894d841636dcd50f`, árvore limpa, base `4be3ce3`.
- Será criado **um commit local** nesta branch, com a mensagem `feat(identidade): propoe ADR-018 e PoC da identidade de servico do runtime (DEC-004)`; o SHA consta no `git log` da branch e no retorno ao coordenador (um documento não pode conter o hash do commit que o inclui).
- Diffs de código, testes e configuração (PoC e esquemas): [diffs](2026-10-25-dec-004-identidade-de-servico-runtime-diffs.md). `package-lock.json` (sha256 parcial e tamanho no arquivo de diffs) e `saida/*.txt` são listados sem diff completo por serem gerados.
- Arquivos somente de documentação, sem diff: o ADR-018, este documento e `poc/dec-004/README.md`.

## 8.1 Correção rodada 1 (2026-10-25)

Origem: [review](../reviews/2026-10-25-review-dec-004.md) e [auditoria](../reviews/2026-10-25-auditoria-dec-004.md) (HEAD auditado `4c6bd4a8030a503e10032e2f55cde63cce933526`). Novo commit na branch, sem amend (SHA no retorno ao coordenador). Diff do PoC: [diffs, seção "Correção rodada 1"](2026-10-25-dec-004-identidade-de-servico-runtime-diffs.md#correcao-rodada-1).

| ID | Decisão | O que foi feito |
| --- | --- | --- |
| REV-001 | APLICADO | ADR-018 decisão 7.1: `max_staleness` (proposto 90 s, decisão humana), fail-closed `revocation_state_stale`, trade-off de disponibilidade corrigido. PoC: `lastRefreshOk` pelo relógio local, `maxStalenessS` (padrão 90). Testes: CP indisponível dentro/fora do limite; token revogado sem refresh após o limite; recuperação por refresh. Demo seção 5. |
| REV-002 | APLICADO | `refresh()` atômico (JWKS e revogação em variáveis locais, troca ao final); falha mantém estado e carimbo, conta `refreshFailures` e propaga. Teste dedicado. O refresh por `kid` desconhecido tolera falha do CP (a idade é checada em seguida). |
| REV-003 | APLICADO (texto) | ADR: p99 oscila de ~1,7 a 8,7 ms entre execuções (inconclusivo, não falha de AC-3); gatilho a reavaliar no host alvo (nova pendência 5). Medição desta rodada: tool-gateway p50 221 µs, p99 1641 µs; dispatcher p99 6536 µs (`saida/bench.txt` atualizado). |
| REV-004 | APLICADO (registro) | Advisory GHSA-2g4f-4pwh-qvx6 (ajv 8.17.1, ReDoS só com `$data`, não usado; correção 8.20.0) registrado no README do PoC e aqui. Lock não alterado. **ADIADO** o upgrade: FND-003 escolhe versão corrigida ao adotar o `ajv`. `npm audit` continua reportando 1 moderada. |
| REV-006 | APLICADO (ADR) | Premissa de instância única do dispatcher para o `jti` de uso único; gatilho em "Quando revisar". |
| REV-007 | APLICADO parcial (ADR) | Push de emergência ≤ 5 s marcado como não demonstrado; ausência de `nbf` explicitada; limite `maxItems: 3` do JWKS no procedimento de rotação. **ADIADO** a API de revogação de `jti`: MSG-002/TGW-001. |
| REV-005 | ADIADO | Endurecimento de enrollment/emissão: PRV-004/MSG-002 (registrado no ADR). |

Ajustes colaterais: testes de expiração e a demo passaram a chamar `refreshAll()` após avançar o relógio (sem isso, o novo limite os rejeitaria com `revocation_state_stale`). Valores de `max_staleness` e política de degradação continuam decisão humana; ADR segue **Proposto**.

Validações da rodada 1 (Node 24.22.1, `documentacoes/arquitetura/poc/dec-004`): `npm ci` ok; `npm test` 21/21; `npm run demo` ok (seção 5 mostra aceito aos 60 s, `revocation_state_stale` aos 91 s, `version_revoked` após refresh); `npm run bench` (zero chamadas de rede); `npm audit` 1 moderada (ajv, adiada). Não executado: benchmark no host alvo, rede/containers/banco.

## 8.2 Correção rodada 2 (2026-10-25)

Origem: [auditoria r2](../reviews/2026-10-25-auditoria-r2-dec-003-dec-004.md) (HEAD auditado `066504ac5559490f453d2a4f642bf970e1308616`, notas A/B/C, todas BAIXO). Novo commit sem amend (SHA no retorno ao coordenador). Diff: [diffs, seção "Correção rodada 2"](2026-10-25-dec-004-identidade-de-servico-runtime-diffs.md#correcao-rodada-2).

| ID | Decisão | O que foi feito |
| --- | --- | --- |
| NOVO-004-A | APLICADO (ADR + comentário) | ADR-018 7.1 exige relógio monotônico (`process.hrtime`/`performance.now`) para a idade do estado de revogação, separado do relógio de parede de `exp`/`iat`. O PoC **não** o implementa: segue com `now()` injetável (relógio de parede) e a garantia depende deste requisito do validador de produção (comentário em `validator.mjs`). Sem teste novo. |
| NOVO-004-B | APLICADO (texto); decisão humana pendente | ADR-018 7.1: a frase "mesmo com o CP ou a rede indisponíveis" foi qualificada para indisponibilidade; CP no ar com dado velho (réplica atrasada) renova o carimbo e **não** é coberto. Registrada como decisão humana: validar `generated_at` (relógios sincronizados e tolerância) ou declarar o CP fonte única e consistente. Sem código; não reabre a escolha de não usar `generated_at` para o carimbo. |
| NOVO-004-C | APLICADO (código + teste) | `refresh()` monta `keys`, `minVer` e `revokedJti` em locais dentro do `try`, valida a resposta com o schema `revocation_state` já existente e só ao final atribui e avança o carimbo; resposta malformada conta em `refreshFailures` e propaga um erro (não `TypeError`). Teste novo com `null`, `{}` e `{min_ver:null}`: `keys`/`minVer`/`revokedJti` mantêm a mesma referência, carimbo inalterado, `refreshFailures` incrementa, e `validate()` rejeita com `revocation_state_stale` após o limite. Validação de formato do JWKS não foi acrescentada nesta rodada (feita na rodada 3). |

Validações da rodada 2 (Node 24.22.1, `documentacoes/arquitetura/poc/dec-004`): `npm ci` ok; `npm test` 22/22; `npm run demo` rc 0 (`saida/test.txt` e `saida/demo.txt` regerados). Não executado: `npm run bench` (sem mudança no caminho de validação), benchmark no host alvo, rede/containers/banco. ADR-018 segue **Proposto**.

## 8.3 Correção rodada 3 (2026-10-25, última)

Origem: [auditoria de notas](../reviews/2026-10-25-auditoria-notas-fnd-002-fnd-009-dec-004.md) (HEAD auditado `d65b84292b5f68cb4d3128bacda465c9c24a4847`). Novo commit sem amend (SHA no retorno ao coordenador). Diff: [diffs, seção "Correção rodada 3"](2026-10-25-dec-004-identidade-de-servico-runtime-diffs.md#correcao-rodada-3).

| ID | Decisão | O que foi feito |
| --- | --- | --- |
| DEC-004/BUG-001 | APLICADO (código + teste + ADR) | `refresh()` valida o JWKS com o schema `jwks` (1 a 3 chaves) dentro do mesmo `try`, antes de montar o `Map`; JWKS inválido lança `Error('resposta de jwks malformada')`, conta em `refreshFailures` e mantém `keys` e carimbo. Teste novo com `null`, `{}`, `{keys:[]}`, `{keys:null}` e 4 chaves. ADR-018 (frase "Refresh atômico inclui formato") agora cobre JWKS e revogação. Efeito colateral: o limite `maxItems: 3` também é imposto no validador. |
| DEC-004/QA-bad_issuer | REJEITADO | Não tocado (ramo é defesa em profundidade; hoje coberto pelo schema). |

Validações da rodada 3 (Node 24.22.1, `documentacoes/arquitetura/poc/dec-004`): `npm ci` ok; `npm test` 23/23; `npm run demo` rc 0 (`saida/test.txt` e `saida/demo.txt` regerados; no demo mudam apenas os kids aleatórios). Não executado: `npm run bench` (sem mudança no caminho de validação), benchmark no host alvo, rede/containers/banco. Não houve re-QA independente nesta sessão (pendente). ADR-018 segue **Proposto**; AC-1 (aceite humano) segue pendente.

## 9. Lessons

Nenhuma lesson criada. Justificativa: o conceito relevante (JWT assinado, JWKS, rotação) pertence ao bloco "Segurança" da trilha, que depende de lessons de TypeScript e de monorepo ainda inexistentes (ver [lessons/README.md](../../lessons/README.md)); o código desta entrega é PoC descartável e não fica na base do produto. A lesson deve nascer na entrega que implementar a identidade no Control Plane (MSG-002/EP-02), com link para o ADR-018. `lessons/README.md` não foi alterado (sem lesson nova).

## 10. Pendências

- Decisão humana sobre o ADR-018 (ver "Pendências de decisão humana" no ADR).
- Incluir ADR-018 no [índice de ADR](../arquitetura/adr/README.md) na integração do lote.
- Repetir o benchmark no host alvo; revisar o esquema com FND-003 antes de migrar para `packages/contracts`.
- Adiados com destino: upgrade do `ajv` (FND-003); API de revogação de `jti` (MSG-002/TGW-001); endurecimento de enrollment (PRV-004/MSG-002); benchmark no host alvo.
- Decisão humana (NOVO-004-B): validar `generated_at` do CP ou declarar o CP fonte única e consistente; requisito de relógio monotônico (NOVO-004-A) a cumprir no validador de produção.
- Revalidação independente das rodadas 1, 2 e 3, e QA (fora desta sessão).
