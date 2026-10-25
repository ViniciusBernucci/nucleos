# ADR-018 — Identidade de serviço runtime ↔ Control Plane ↔ gateways

- **Status:** Proposto (somente decisão humana o torna Aceito)
- **Data:** 2026-10-25
- **Decisores:** a definir pelo usuário (responsável pelo produto/segurança)
- **Origem:** [ENT-DEC-004](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-004); [ADR consolidado, seção 5.1, seção 9, SEC-07 e SEC-15](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md); [ADR-012](0012-deny-by-default-e-autorizacao-externa-ao.md), [ADR-014](0014-nenhum-acesso-de-rede-entre-tenants-por.md)

## Contexto

Cada empresa tem um runtime dedicado (ADR-002). Esse runtime chama o dispatcher (jobs), o Tool Gateway e o AI Gateway, que ficam no plano central. O consolidado exige "credencial independente (preferencialmente curta/rotacionável, mTLS ou token assinado com audiência e escopo), sem reaproveitar tokens de usuário" e afirma que `tenant_id` em job "não é prova de autorização". SEC-07 (tenant A altera `tenant_id` em job, token ou URL) e SEC-15 (rotação/revogação de A não afeta B) são testes de aceite do MVP. O runtime executa código influenciado por LLM, portanto é tratado como parcialmente não confiável: o que ele afirma sobre si precisa ser provado criptograficamente, e o que ele consegue fazer com a credencial precisa ser mínimo.

## Problema

Como cada runtime prova quem é, para quem a prova vale (audiência e escopo) e como a prova é revogada e rotacionada, sem chamada de rede por requisição e sem reaproveitar credencial de usuário?

## Decisão

Adotar, no MVP, a **opção A: JWT assinado com EdDSA (Ed25519), vida curta, emitido pelo Control Plane após enrollment**, com prova de posse do runtime. A opção C (mTLS no transporte somado ao JWT) fica como evolução condicionada aos gatilhos de revisão.

1. **Enrollment.** O provisioner gera um segredo de uso único (32 bytes aleatórios, validade de 10 min, só o hash fica no CP). O runtime gera seu par Ed25519 **localmente**; a chave privada nunca sai do runtime/volume do tenant. Ele envia tenant_id, segredo e chave pública; o CP consome o segredo antes de qualquer outra ação e registra a chave pública, com `ver` inicial 1.
2. **Emissão.** O runtime pede token ao CP com um `client_assertion` (JWT assinado com a chave privada dele, `aud` = CP, TTL ≤ 60 s, `jti` único, rejeitado se repetido). O CP emite token de acesso para **uma única audiência** (`dispatcher`, `tool-gateway` ou `ai-gateway`) e escopos permitidos por política (deny by default). Token de usuário nunca é aceito nesse fluxo.
3. **Token.** Header `alg=EdDSA`, `typ=nucleos-runtime+jwt`, `kid`. Claims: `iss`, `sub=runtime:<tenant_id>`, `aud`, `scope[]`, `tenant_id`, `jti`, `iat`, `exp`, `ver`. TTL padrão 300 s, máximo 600 s. Esquemas propostos: [runtime-token.schema.json](../contratos-propostos/runtime-token.schema.json) e [handshake.schema.json](../contratos-propostos/handshake.schema.json).
4. **Validação (dispatcher e gateways).** Totalmente local: algoritmo fixo EdDSA (qualquer outro é rejeitado), `kid` no JWKS em cache, assinatura, esquema dos claims, `iss`, `aud` igual ao serviço, `sub == "runtime:" + tenant_id`, **`tenant_id` igual ao tenant do contexto autenticado da chamada (job, canal ou rota), nunca ao do próprio token**, janela temporal com tolerância de 30 s, `ver ≥ ver_minima[tenant]`, `jti` não revogado e escopo exigido. JWKS e estado de revogação são atualizados por poll curto (sugestão: 30 s) e por push de emergência; nunca por requisição. `kid` desconhecido provoca no máximo um refresh por janela de 10 s.
5. **Replay.** `jti` de uso único no dispatcher (atribuição de job) e nas `client_assertion` do CP, com cache até `exp` + tolerância. Nos gateways o token é reutilizável durante o TTL (um runtime faz muitas chamadas por token); o risco residual de roubo de bearer é limitado por TTL curto, TLS e egress restrito (ADR-014). O `jti` só entra no cache depois que todas as demais checagens passam.
6. **Rotação sem downtime.** Duas chaves de assinatura simultâneas no JWKS: publicar a nova (propagar), ativar (passa a assinar), aposentar a antiga após TTL máximo + tolerância (≥ 630 s). A chave do runtime é rotacionada pelo mesmo enrollment, com novo segredo de uso único.
7. **Revogação.** (a) Por tenant: incrementar `ver_minima[tenant]`, apagar a chave pública registrada e exigir novo enrollment; afeta somente aquele tenant (SEC-15). (b) De chave de assinatura do CP, em emergência: criar chave nova ativa, remover a comprometida do JWKS e forçar refresh dos validadores; todo token da chave comprometida cai de imediato, mesmo dentro do TTL. (c) Pontual: lista de `jti` revogados. Tempo de efeito = tempo de propagação do push ou, no pior caso, o intervalo de poll, **somente enquanto o validador consegue atualizar o estado** (ver 7.1). O alvo de ≤ 5 s do push de emergência é **não demonstrado**: o PoC faz refresh manual e não mede propagação por push.

   **7.1 Obsolescência máxima do estado de revogação (`max_staleness`, fail-closed).** Cada validador registra, com o **relógio local**, o instante do último refresh bem-sucedido de JWKS e estado de revogação (não confia no `generated_at` do CP). O refresh é atômico: JWKS e revogação são buscados juntos e só então substituem o estado; em falha, o estado anterior é mantido, a falha é contabilizada e o carimbo não avança. Se `agora − último refresh bem-sucedido > max_staleness`, o validador **rejeita** com o código próprio `revocation_state_stale` e deve alarmar. **Proposta: `max_staleness` = 90 s (3× o poll de 30 s)**; valor e política são decisão humana. Degradação para ações de baixo risco (aceitar com estado obsoleto) **não** é implícita: se desejada, deve ser decidida explicitamente por classe de ação. Com isso, o atraso máximo de efeito de uma revogação por tenant/`jti` passa a ser limitado por `max_staleness` mesmo com o CP ou a rede indisponíveis.
8. **Relógio.** NTP obrigatório nos hosts; tolerância de 30 s; alarme se o desvio medido exceder 5 s.

Esta decisão cobre identidade serviço-a-serviço do runtime. Autorização por ferramenta continua no Tool Gateway (ADR-012) e não é derivada apenas do escopo do token.

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| A. JWT EdDSA de vida curta emitido pelo CP (escolhida) | Validação local sem rede, `aud`/`scope`/`ver` expressivos, sem infraestrutura nova de PKI, fácil de testar | Token é bearer durante o TTL; exige disciplina de rotação e propagação de revogação |
| B. mTLS com CA interna (ex.: step-ca) e certificados de vida curta | Prova de posse no transporte, bearer inútil sem a chave | Operar CA, emissão e renovação, revogação (CRL/OCSP ou vida muito curta), exposição de SAN por tenant; custo operacional alto para o MVP; não carrega `aud`/`scope` |
| C. mTLS + JWT de escopo | Defesa em profundidade: token roubado não funciona fora do canal | Soma complexidade de A e B; adiada para quando houver gatilho |
| D. Token opaco com introspecção a cada chamada | Revogação instantânea | Dependência de rede por requisição (viola o critério de latência) e acoplamento de disponibilidade ao CP |
| E. Reutilizar token de usuário | Nada novo para operar | Proibido pelo consolidado 5.1; mistura de identidades e de escopos |

## Benefícios

- Validação local: no PoC, mediana estável de ~225 µs por validação (incluindo esquema, Ed25519 e checagens) e zero chamadas de rede por requisição (ver [documento da entrega](../../identidade/2026-10-25-dec-004-identidade-de-servico-runtime.md)). **O p99 é instável:** na VM compartilhada do PoC variou de ~1,7 a 8,7 ms entre execuções (tool-gateway: 8297, 5391, 4071, 1735 e 1641 µs; dispatcher: 8701 e 6536 µs), cruzando o gatilho de 5 ms da seção "Quando revisar". O resultado é **inconclusivo** (ruído de VM/GC, sem evidência de custo da validação) e **não** reprova o critério de validação local sem rede; o gatilho deve ser reavaliado com benchmark no host alvo e sob carga.
- Isolamento por tenant: sub, `tenant_id`, `ver` e contexto autenticado impedem que A se passe por B; revogar A não toca B.
- Rotação e revogação de emergência sem janela de indisponibilidade.
- Chave privada do runtime nunca trafega.

## Trade-offs

- Latência de revogação por tenant limitada pelo poll/push, não instantânea; compensada por TTL de 5 min e push. O limite só é garantido pelo `max_staleness` (decisão 7.1); sem ele, uma falha de poll deixaria tokens revogados válidos até o `exp`.
- Token bearer roubado vale até o `exp` nos gateways (sem uso único); mitigação por egress restrito e TTL curto. Uso único só no dispatcher.
- O CP vira ponto crítico de emissão: queda do CP impede novas emissões (tokens vivos seguem validando **somente até `max_staleness`** sem refresh; depois disso o validador rejeita com `revocation_state_stale`, não até o `exp`). **Consequência de disponibilidade:** uma queda do CP (ou partição) maior que `max_staleness` (proposto 90 s) derruba a validação em dispatcher e gateways, ou seja, a disponibilidade dos serviços passa a depender da do CP em janelas longas. Escolha deliberada de segurança (fail-closed) sobre disponibilidade; exige CP altamente disponível e alarme de idade do estado. Se isso for inaceitável, o ajuste é aumentar `max_staleness` (pior caso de revogação maior) ou aceitar degradação por classe de ação, ambos por decisão humana.
- JWKS e estado de revogação são mais um dado distribuído a manter consistente.
- Implementar JWT manualmente é arriscado; produção deve usar biblioteca revisada (por exemplo `jose`), com algoritmo fixo e `typ` verificado.

## Consequências

- `packages/contracts` (FND-003) adota os esquemas propostos somente após o aceite deste ADR; até lá, ficam em `documentacoes/arquitetura/contratos-propostos/`.
- MSG-002, MSG-003, TGW-001, AIG-001 e PRV-004 passam a depender das decisões 1 a 8. O provisioner (PRV-004) precisa produzir o segredo de enrollment de uso único.
- **Premissa do uso único de `jti` (decisão 5):** o cache `seen` do dispatcher é em memória, por instância. Vale com **uma única instância** do dispatcher e sem perda de estado; reinício ou segunda instância permitem reaproveitar um token de uso único dentro do TTL. Se isso mudar, cache compartilhado ou afinidade de roteamento é pré-requisito.
- **Detalhes do PoC que o ADR registra:** o token não tem `nbf`; a validade inicial é coberta por `iat` + tolerância de 30 s. O esquema do JWKS limita `maxItems: 3` chaves: no procedimento de rotação, aposentar a chave antiga antes de publicar uma 4ª (no PoC, exceder o limite gera erro cru, aceitável para um PoC).
- Chaves de assinatura do CP exigem armazenamento protegido (cofre/KMS) e procedimento de rotação em runbook; a chave privada do runtime fica em volume exclusivo do tenant.
- Testes de aceite SEC-07 e SEC-15 podem reutilizar os casos negativos do PoC como base.
- Logs não podem registrar token, segredo de enrollment nem `client_assertion`; registrar apenas `jti`, `kid`, `tenant_id` e código de rejeição.

## Quando revisar

- Requisito de revogação instantânea (< 5 s garantidos) ou de resistência a roubo de bearer em canal já comprometido: avaliar opção C.
- Mais de um host/região de gateways, ou gateways operados por terceiros; mais de uma instância do dispatcher (ver premissa do cache de `jti` em Consequências).
- Queda do CP com duração próxima de `max_staleness` ou alarmes frequentes de `revocation_state_stale`.
- Medição em produção com p99 de validação acima de 5 ms ou propagação de revogação acima de 30 s.
- Incidente de vazamento de chave de assinatura ou de runtime.
- Migração para Kubernetes/service mesh (ADR-010), que pode oferecer mTLS nativo.

## Referências

- [Esquema do token](../contratos-propostos/runtime-token.schema.json) · [esquema do handshake](../contratos-propostos/handshake.schema.json)
- [PoC descartável e saídas](../poc/dec-004/README.md)
- [Documento da entrega](../../identidade/2026-10-25-dec-004-identidade-de-servico-runtime.md)
- RFC 8032 (EdDSA), RFC 7519 (JWT), RFC 7517 (JWK), RFC 7523 (JWT para autenticação de cliente), RFC 8725 (boas práticas JWT)

## Pendências de decisão humana

1. Aceitar, rejeitar ou alterar a opção A para o MVP (e quando adotar a opção C).
2. Valores de TTL (300/600 s), tolerância (30 s), intervalo de poll (30 s) e **`max_staleness` (proposto 90 s) com a política de degradação (fail-closed proposto; degradação por classe de ação só se decidida)**.
3. Cofre/KMS para a chave de assinatura do CP.
4. Se os gateways devem ter uso único de `jti` para ações de maior risco.
5. Reavaliar o gatilho de p99 (5 ms) com benchmark no host alvo e sob carga.

## Itens adiados (registrados na revisão da DEC-004)

- Endurecimento do enrollment/emissão (autoconsumo do segredo com chave inválida, prefixo `runtime:` estrito no `sub` da assertion, `exp > iat`): PRV-004/MSG-002.
- API administrativa de revogação de `jti` no CP (o PoC manipula a lista diretamente nos testes): MSG-002/TGW-001.
- Atualização do `ajv` (advisory GHSA-2g4f-4pwh-qvx6): FND-003, ao adotar o `ajv` em `packages/contracts`.
