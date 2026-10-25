# ADR-016 — Autenticação de usuários: sessão opaca própria vs. IdP

- **Status:** Proposto (aguarda decisão humana; nenhum agente pode aceitá-lo)
- **Data:** 2026-10-25
- **Decisores:** usuário (aceite pendente)
- **Origem:** [ENT-DEC-002](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-002); [ADR consolidado, seção 5.1](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)

## Contexto

O tenant é resolvido **no servidor**, por sessão + membership no banco **central** (seção 5.1), nunca por campo de corpo. O cenário A roda em 1 VPS com Docker Compose, então RAM é orçamento escasso. Há exigência futura provável de SSO corporativo (OIDC/SAML) e MFA. A stack é NestJS/TypeScript (ADR-004).

## Problema

Como usuários se autenticam: construir autenticação própria ou adotar um IdP (Kratos, Keycloak, biblioteca Next.js, IdP gerenciado)?

## Decisão (proposta)

Adotar a **opção 1: autenticação própria no NestJS**, com:

- senha com `argon2id` (m=19 MiB, t=2, p=1, mínimo OWASP), hash em PHC string na tabela `users` do **banco central**;
- sessão **opaca** (32 bytes aleatórios); no banco central grava-se apenas `sha256(token)` em `sessions`; a sessão é validada no banco **a cada requisição**, logo revogar é um `UPDATE ... revoked_at` com efeito na requisição seguinte;
- TOTP (RFC 6238) no MVP; a **seed TOTP** fica em `users.totp_secret_enc`, cifrada com AES-256-GCM, chave (KEK) fora do banco (segredo de runtime, ver DEC-006); WebAuthn como evolução;
- `tenant_id` nunca vem da sessão nem do cliente como prova: resolvido por `memberships`; `X-Tenant-Id` é só contexto solicitado e exige membership;
- e-mail transacional por adaptador (fora deste PoC);
- **gatilho para trocar** por IdP: ver "Quando revisar".

### Onde ficam os dados sensíveis

| Dado | Local | Proteção |
| --- | --- | --- |
| Hash de senha | `users.password_hash`, banco central | argon2id com salt embutido; nunca no banco do tenant, nunca em log |
| Seed MFA (TOTP) | `users.totp_secret_enc`, banco central | AES-256-GCM; chave fora do banco; rotação de chave por re-cifragem |
| Token de sessão | só no cliente (cookie `HttpOnly`/`Secure`/`SameSite` na implementação real) | no banco só `sha256` |
| Membership/papéis | `memberships`, banco central | consulta por requisição |

### Como migrar de opção

- **Para IdP (Kratos/Keycloak/Clerk/Auth0)**: manter `users.id` como identificador estável e criar `identity_links(user_id, issuer, subject)`. O `iss`/`sub` do IdP é mapeado para `users.id`; `memberships` continua sendo a fonte do tenant. Hashes argon2id (PHC) são importáveis no Keycloak (via provedor de credencial/import) e no Kratos (importação de identidades com hash argon2 é suportada em formato PHC — **não verificado neste PoC**); caso o destino não aceite, usar migração "preguiçosa": no primeiro login válido, reenviar a senha ao novo IdP. Seeds TOTP exigem decifrar e reimportar (ou reenrolar o MFA).
- **Do IdP de volta**: exportar `iss/sub` e exigir redefinição de senha; o contrato da aplicação (sessão → `user_id` → membership) não muda, só o verificador de credencial.
- Sobrepor sessões durante a transição: ambos os verificadores aceitos por uma janela, sessões antigas expiram pelo TTL.

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| 2. Ory Kratos | Self-hosted, leve (34 MiB medidos) | Segundo serviço e modelo de identidade próprio a integrar com membership; SSO SAML corporativo não confirmado (ver tabela) |
| 3. Keycloak | SSO OIDC/SAML maduro, MFA pronto | ~521 MiB em repouso medidos (dev mode); 1250 MB de base recomendada pela documentação para produção; operação pesada para 1 VPS |
| 4. Auth.js / Better Auth | Integração rápida com Next.js | Acopla a autenticação ao front; autoridade deve ficar no Control Plane NestJS; não avaliado em PoC |
| 5. IdP gerenciado (Clerk/Auth0/WorkOS) | Zero operação, SSO pronto | Identidades fora da nossa propriedade (LGPD, lock-in), custo por usuário; não avaliado em PoC |

## Critérios e evidência

Pesos registrados (1 = baixo, 3 = alto) refletem a prioridade deste projeto, decisão humana revisável. Nota: A = atende, P = parcial, N = não / não demonstrado. Células marcadas "[PoC]" têm evidência medida neste repositório; "[fonte]" têm fonte e data de consulta; "[inferência]" é julgamento do autor, **sem** medição.

| Critério (peso) | 1. Próprio | 2. Kratos | 3. Keycloak | 4. Auth.js/Better Auth | 5. Gerenciado (Clerk) |
| --- | --- | --- | --- | --- | --- |
| Revogação imediata (3) | A [PoC]: requisição seguinte rejeitada (13/13 PASS) | A [inferência]: campo `active` da sessão existe [fonte 1]; endpoint de revogação não confirmado na página consultada | A [inferência] não medido | P [inferência]: depende de sessão em banco vs. JWT | P [inferência]: não medido |
| MFA TOTP/WebAuthn (2) | TOTP A [PoC]; WebAuthn N (evolução) | TOTP citado [fonte 1] | A [inferência] | P [inferência] | MFA só em Pro/Business [fonte 3] |
| Caminho SSO OIDC/SAML (2) | P: trabalho próprio ou migrar de opção | não confirmado | A [inferência] | P [inferência] | 1 conexão SSO incluída; extras US$ 75/mês [fonte 3] |
| RAM no cenário A (3) | Node 92 MiB RSS + Postgres 40 MiB [PoC] (o Node já existe; custo marginal ~ código) | 34 MiB [PoC, `dsn=memory`, v1.3.1] + Postgres | 521 MiB [PoC, dev, H2, v26.0]; 1250 MB base [fonte 2] | 0 serviços extras [inferência] | 0 [inferência] |
| Propriedade de dados/LGPD (3) | A: tudo no nosso banco | A (self-hosted) | A (self-hosted) | A | N [inferência]: dados em terceiro |
| Lock-in (2) | baixo | médio [inferência] | médio [inferência] | médio [inferência] | alto [inferência] |
| Integração com organização/membership (3) | A [PoC]: sessão -> membership no central | P [inferência]: mapear identidade -> membership | P [inferência]: mapear `sub` -> membership | P [inferência] | P [inferência] |
| Custo por MAU (1) | 0 licença; custo de engenharia | 0 licença | 0 licença | 0 | grátis até 50.000 usuários retidos, depois US$ 0,02 cada [fonte 3] |

Medições (reprodutíveis): [`saida-poc.txt`](../poc/dec-002/saida-poc.txt), [`saida-ram-idp.txt`](../poc/dec-002/saida-ram-idp.txt). Argon2id: ~258 ms por hash nesta máquina. Latência do `UPDATE` de revogação ~14 ms, rejeição seguinte ~16 ms (local, 127.0.0.1).

Fontes consultadas em 2026-10-25:

1. Ory, "Session management overview": https://www.ory.com/docs/kratos/session-management/overview
2. Keycloak, "Concepts for sizing CPU and memory resources": https://www.keycloak.org/high-availability/single-cluster/concepts-memory-and-cpu-sizing (1250 MB base com 10.000 sessões em cache, ~300 MB fora do heap)
3. Clerk, "Pricing": https://clerk.com/pricing (cobra por usuários retidos mensais, não MAU)

Imagens medidas: `quay.io/keycloak/keycloak:26.0` (`sha256:09a381c7...`), `oryd/kratos:v1.3.1` (`sha256:fe2428f1...`), `postgres:16-alpine`.

## Benefícios

Menor consumo de RAM e superfície operacional; revogação imediata trivial; identidade e membership no mesmo banco central; dados sob nossa propriedade; sem custo por usuário.

## Trade-offs

Segurança de autenticação passa a ser nossa responsabilidade (rate limit, bloqueio de conta, recuperação de senha, e-mail, auditoria, WebAuthn); SSO SAML exige trabalho ou migração; uma consulta ao banco por requisição (cache curto reintroduz atraso de revogação).

## Consequências

Tickets IAM-003, IAM-004 e WEB-001 devem implementar o modelo de `schema.sql` do PoC (código do PoC **não** é reutilizável como está). Requer controles do threat model (DEC-001): limitação de tentativas, cookies seguros, CSRF. Segredo da KEK segue DEC-006.

## Quando revisar

Primeiro cliente que exigir SSO SAML/OIDC corporativo; necessidade de WebAuthn/passkeys antes do previsto; mais de ~50.000 usuários ou incidente de segurança de autenticação; se Kratos passar a ser exigido por conformidade.

## Pendências de decisão humana

Aceite do ADR; pesos dos critérios; escolha de WebAuthn no MVP ou não; confirmação das células "[inferência]" se alguma opção virar candidata (não foram medidas).

## Referências

[PoC](../poc/dec-002/run.sh) · [entrega](../../identidade/2026-10-25-dec-002-autenticacao-adr-016.md) · [lesson](../../../lessons/00%20-%20Sessao%20opaca%20e%20revogacao.md)
