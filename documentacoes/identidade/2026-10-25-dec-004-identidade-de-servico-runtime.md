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

Recomendação proposta: opção A, JWT EdDSA com TTL de 5 min emitido pelo CP após enrollment com segredo de uso único e prova de posse (`client_assertion`), validação 100% local com JWKS/estado de revogação em cache, duas chaves ativas para rotação e três níveis de revogação (por tenant via `ver`, por chave de assinatura, por `jti`). O PoC executa o fluxo ponta a ponta com 17 testes automatizados e uma demo narrada.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0018-identidade-de-servico-runtime-control-plane-gateways.md` | doc | ADR-018, status Proposto |
| `documentacoes/arquitetura/contratos-propostos/runtime-token.schema.json` | contrato proposto | Header e claims do token (JSON Schema 2020-12) |
| `documentacoes/arquitetura/contratos-propostos/handshake.schema.json` | contrato proposto | Enrollment, pedido/resposta de token, JWKS, estado de revogação |
| `documentacoes/arquitetura/poc/dec-004/lib/{jwt,schemas,control-plane,validator,fake-runtime,env}.mjs` | código (PoC) | Ed25519/JWT, CP falso, validador local, runtime falso, cenário |
| `documentacoes/arquitetura/poc/dec-004/test/poc.test.mjs` | teste | 17 testes |
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
| `npm test` | 17 testes, 17 aprovados, 0 falhas ([saida/test.txt](../arquitetura/poc/dec-004/saida/test.txt)) |
| `npm run demo` | casos negativos todos REJEITADOS com o código esperado; rotação e revogação de emergência demonstradas ([saida/demo.txt](../arquitetura/poc/dec-004/saida/demo.txt)) |
| `npm run bench` | ver abaixo ([saida/bench.txt](../arquitetura/poc/dec-004/saida/bench.txt)) |

Mapa para os critérios de aceite:

- **AC-1 (casos negativos rejeitados):** expirado (`expired`), audiência errada (`bad_audience`), tenant adulterado (`bad_signature`), tenant de A em contexto de B (`tenant_mismatch`), versão revogada (`version_revoked`), replay de `jti` (`replay`), `alg` none/HS256 (`malformed`/`bad_header`), chave do atacante (`bad_signature`), `kid` desconhecido, escopo ausente, TTL excessivo, `iat` futuro. **Status do ADR: Proposto; o "aceito" do AC-1 depende do usuário e não foi declarado.**
- **AC-2 (rotação e revogação de emergência documentadas e demonstradas):** ADR itens 6 e 7; testes "ROTACAO..." e "REVOGACAO DE EMERGENCIA..." e seções 3 e 4 da demo.
- **AC-3 (latência sem rede por requisição):** teste "VALIDACAO LOCAL" (1000 validações, 0 chamadas de rede) e contador `networkCalls` no benchmark.

Latência medida (VM de 4 vCPU AMD EPYC compartilhada, N = 20000 após aquecimento, ruído alto no p99):

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

## 9. Lessons

Nenhuma lesson criada. Justificativa: o conceito relevante (JWT assinado, JWKS, rotação) pertence ao bloco "Segurança" da trilha, que depende de lessons de TypeScript e de monorepo ainda inexistentes (ver [lessons/README.md](../../lessons/README.md)); o código desta entrega é PoC descartável e não fica na base do produto. A lesson deve nascer na entrega que implementar a identidade no Control Plane (MSG-002/EP-02), com link para o ADR-018. `lessons/README.md` não foi alterado (sem lesson nova).

## 10. Pendências

- Decisão humana sobre o ADR-018 (ver "Pendências de decisão humana" no ADR).
- Incluir ADR-018 no [índice de ADR](../arquitetura/adr/README.md) na integração do lote.
- Repetir o benchmark no host alvo; revisar o esquema com FND-003 antes de migrar para `packages/contracts`.
- Review, auditoria e QA independentes (fora desta sessão).
