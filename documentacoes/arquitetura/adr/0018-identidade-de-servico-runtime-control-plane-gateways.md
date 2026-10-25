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
7. **Revogação.** (a) Por tenant: incrementar `ver_minima[tenant]`, apagar a chave pública registrada e exigir novo enrollment; afeta somente aquele tenant (SEC-15). (b) De chave de assinatura do CP, em emergência: criar chave nova ativa, remover a comprometida do JWKS e forçar refresh dos validadores; todo token da chave comprometida cai de imediato, mesmo dentro do TTL. (c) Pontual: lista de `jti` revogados. Tempo de efeito = tempo de propagação do push (alvo ≤ 5 s) ou, no pior caso, o intervalo de poll.
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

- Validação local: no PoC, mediana de 231 µs por validação (incluindo esquema, Ed25519 e checagens) e zero chamadas de rede por requisição (ver [documento da entrega](../../identidade/2026-10-25-dec-004-identidade-de-servico-runtime.md)).
- Isolamento por tenant: sub, `tenant_id`, `ver` e contexto autenticado impedem que A se passe por B; revogar A não toca B.
- Rotação e revogação de emergência sem janela de indisponibilidade.
- Chave privada do runtime nunca trafega.

## Trade-offs

- Latência de revogação por tenant limitada pelo poll/push, não instantânea; compensada por TTL de 5 min e push.
- Token bearer roubado vale até o `exp` nos gateways (sem uso único); mitigação por egress restrito e TTL curto. Uso único só no dispatcher.
- O CP vira ponto crítico de emissão: queda do CP impede novas emissões (tokens vivos seguem validando até o `exp`). Exige disponibilidade e margem de TTL.
- JWKS e estado de revogação são mais um dado distribuído a manter consistente.
- Implementar JWT manualmente é arriscado; produção deve usar biblioteca revisada (por exemplo `jose`), com algoritmo fixo e `typ` verificado.

## Consequências

- `packages/contracts` (FND-003) adota os esquemas propostos somente após o aceite deste ADR; até lá, ficam em `documentacoes/arquitetura/contratos-propostos/`.
- MSG-002, MSG-003, TGW-001, AIG-001 e PRV-004 passam a depender das decisões 1 a 8. O provisioner (PRV-004) precisa produzir o segredo de enrollment de uso único.
- Chaves de assinatura do CP exigem armazenamento protegido (cofre/KMS) e procedimento de rotação em runbook; a chave privada do runtime fica em volume exclusivo do tenant.
- Testes de aceite SEC-07 e SEC-15 podem reutilizar os casos negativos do PoC como base.
- Logs não podem registrar token, segredo de enrollment nem `client_assertion`; registrar apenas `jti`, `kid`, `tenant_id` e código de rejeição.

## Quando revisar

- Requisito de revogação instantânea (< 5 s garantidos) ou de resistência a roubo de bearer em canal já comprometido: avaliar opção C.
- Mais de um host/região de gateways, ou gateways operados por terceiros.
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
2. Valores de TTL (300/600 s), tolerância (30 s) e intervalo de poll (30 s).
3. Cofre/KMS para a chave de assinatura do CP.
4. Se os gateways devem ter uso único de `jti` para ações de maior risco.
