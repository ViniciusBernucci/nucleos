# EP-10 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-web-001"></a>
## ENT-WEB-001 — Shell Next.js, autenticação e experiência multi-organização

**Sprint** S04 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** IAM-003, IAM-004, FND-003 · **Bloqueia:** WEB-002..009

**Especificação técnica** — `apps/web` (Next.js App Router, React, TypeScript `strict`).
- Rotas: `/login`, `/mfa`, `/verify-email`, `/forgot-password`, `/orgs` (seletor), `/orgs/[orgSlug]/...`. O slug é **contexto solicitado**; o servidor valida membership a cada chamada (404 se não pertencer).
- Sessão por cookie `HttpOnly; Secure; SameSite=Lax` emitido pelo Control Plane; Next.js usa *Server Components* para chamadas autenticadas (cookie repassado ao servidor), sem armazenar token em `localStorage`.
- Guardas de rota em *middleware* apenas para UX; segurança real no backend.
- Layout base com navegação por organização/módulos (de entitlements), indicador persistente da **organização ativa** (reduz erro operacional e confusão de tenant), tema, i18n pt-BR preparado.
- Biblioteca de UI e estado: escolher e registrar justificativa (ex.: componentes acessíveis + TanStack Query); sem dependências desnecessárias.
- Estados padronizados: carregando, vazio, erro, proibido (403), não encontrado (404), offline.

**Critérios de aceite**
- [ ] Fluxo completo de login (com MFA) e logout funciona; sessão revogada redireciona ao login.
- [ ] Acessar `/orgs/<slug-de-B>` com sessão de A mostra 404 sem dados de B.
- [ ] Nenhum token em `localStorage/sessionStorage` (teste E2E).

**Testes.** Componentes (Testing Library), E2E (Playwright) com A/B, A11Y (axe).

---

<a id="ent-web-002"></a>
## ENT-WEB-002 — Cliente de API tipado e estados de erro

**Sprint** S05 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Plataforma
**Depende de:** WEB-001

**Especificação técnica**
- Cliente gerado do OpenAPI (`packages/sdk`), com tratamento uniforme de Problem Details, correlação (`correlation_id` exibido em erros para suporte), retry apenas em GET idempotentes, cancelamento e *timeouts*.
- Interceptor trata 401 (renovar login), 403/404 (estados UX), 429 (aviso e *backoff*).
- Nunca exibe mensagens internas; mapeia `code` de erro a mensagens localizadas.
- Paginação por cursor (hook reutilizável); idempotency key em mutações críticas.

**Critérios de aceite**
- [ ] Erro 500 mostra mensagem genérica com `correlation_id`.
- [ ] Mutação repetida (duplo clique) não duplica efeito (idempotency key).

---

<a id="ent-web-008"></a>
## ENT-WEB-008 — Segurança do frontend

**Sprint** S05 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** WEB-001, FND-007

**Especificação técnica**
- **CSP** estrita com *nonces* (sem `unsafe-inline`/`unsafe-eval`; exceções documentadas se o runtime WebGL exigir `worker-src`/`blob:`), `connect-src` limitado à API; `frame-ancestors 'none'`; relatório `report-uri`.
- **XSS**: conteúdo de agentes (texto gerado, markdown, HTML) renderizado com sanitização (allowlist), **nunca** `dangerouslySetInnerHTML` sem sanitizador; links externos com `rel="noopener noreferrer"`; **imagens/URLs remotas em respostas de agentes não são carregadas automaticamente** (evita exfiltração por *query string*) — exibir como link/placeholder com confirmação.
- **CSRF**: `SameSite` + token CSRF em mutações com cookie; verificação de `Origin/Host`.
- Cabeçalhos coerentes com a borda (FND-007); cookies sem escopo excessivo de domínio.
- Dependências do frontend auditadas (SCA no CI); *subresource integrity* para assets externos (preferir nenhum CDN de terceiros).
- Política de armazenamento: nada sensível no cliente; limpar estado ao trocar de organização.

**Critérios de aceite**
- [ ] Payload XSS clássico e markdown malicioso emitido por "agente" não executa script (testes).
- [ ] Imagem remota em resposta de agente não gera requisição automática.
- [ ] Scanner de CSP/cabeçalhos sem achados altos.

---

<a id="ent-web-005"></a>
## ENT-WEB-005 — Cena 3D base: edifício, andares e navegação

**Sprint** S06 · **Prioridade** Média · **Tam.** L · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** WEB-001

**Especificação técnica**
- React Three Fiber + `drei`; cena modular: fachada/entrada, **andares = departamentos contratados** (dos entitlements), salas, mobiliário simples; navegação por câmera orbital/primeira pessoa limitada, transição entrada → andar (elevador/escada), *minimap* opcional.
- Assets GLB/glTF versionados em repositório de assets (Draco/Meshopt, texturas KTX2), com orçamento (triângulos, texturas, draw calls) definido em WEB-007; carregamento progressivo e *suspense*.
- Dados vêm de uma **API de leitura de layout** (módulos ativos, agentes por departamento), não hardcoded; edifício reflete `tenant.state_changed` (ex.: "em construção" durante `PROVISIONING`).
- Acessibilidade: navegação por teclado, foco visível, alternativa textual/lista dos departamentos.
- Cena **sem dependência de dados sensíveis**: apenas nomes/estados.

**Critérios de aceite**
- [ ] Cena renderiza com dados mockados e com dados reais do tenant de teste.
- [ ] Andares exibidos correspondem exatamente aos módulos autorizados.
- [ ] 60 fps em dispositivo de referência com cena vazia de agentes (meta registrada).

---

<a id="ent-web-003"></a>
## ENT-WEB-003 — Dashboard da organização

**Sprint** S08 · **Prioridade** Média · **Tam.** L · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** IAM-007, AIG-003, RUN-003

**Especificação técnica**
- Cartões: agentes e status, tarefas em execução/fila, aprovações pendentes, consumo de IA vs. orçamento (por departamento/agente), alertas (limiar 80/100%), último incidente de segurança relevante (apenas do próprio tenant).
- Dados por Control Plane (agregados) e Tenant API (detalhes) conforme ADR-025; atualização em tempo real via SSE; fallback por *polling* leve.
- Gestão: membros/papéis, módulos contratados (somente leitura no MVP), integrações (metadados), documentos (upload/lista com status de indexação), auditoria do tenant.
- Permissões refletidas em UI **e** reforçadas no backend; telas ausentes de permissão mostram 403 amigável.
- Exportação CSV de uso (AIG-003).

**Critérios de aceite**
- [ ] Usuário `viewer` não vê ações de mutação e o backend as nega se forçadas.
- [ ] Valores de orçamento conferem com `token_usage` (teste de consistência).

---

<a id="ent-web-004"></a>
## ENT-WEB-004 — Conversas com agentes e painel de aprovações

**Sprint** S08 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** RUN-005, RUN-006, MSG-006

**Especificação técnica**
- Chat por agente: envio cria job; *streaming* de resposta (SSE); histórico paginado; indicação de ferramentas usadas e citações de documentos (links autorizados).
- Painel de aprovações: lista pendente com **resumo gerado pelo servidor**, argumentos relevantes, risco, expiração; ações Aprovar/Rejeitar com confirmação; mostra *hash*/identificador da ação aprovada.
- Visualização de execução (passos, ferramentas, custo) sem expor conteúdo além do necessário e sem segredos.
- Renderização segura de conteúdo (WEB-008).
- Estados de erro de cota/orçamento com mensagem clara.

**Critérios de aceite**
- [ ] Aprovação só aparece/funciona para quem tem `approvals:decide`.
- [ ] Resposta com markdown/HTML malicioso é exibida inerte.
- [ ] Reconexão do stream recupera mensagens perdidas.

---

<a id="ent-web-006"></a>
## ENT-WEB-006 — Agentes 3D com estado em tempo real

**Sprint** S09 · **Prioridade** Média · **Tam.** L · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** WEB-005, MSG-006

**Especificação técnica**
- Avatares/estações dos agentes por departamento; estados visuais derivados de eventos (`idle`, `thinking`, `using_tool`, `waiting_approval`, `error`), com balão curto (sem conteúdo privado); clique abre o chat do agente.
- Máquina de estados de animação no cliente; reconciliação com estado do servidor ao reconectar; *debounce* para rajadas de eventos.
- Instancing para múltiplos avatares iguais; limite de agentes animados simultâneos (LOD).
- Eventos de plataforma (ex.: nova contratação) acionam animação de construção.
- Eventos recebidos são tratados como **dados não confiáveis** (validação de esquema antes de animar).

**Critérios de aceite**
- [ ] Mudança de estado do agente reflete na cena em ≤ 2 s (alvo).
- [ ] Evento malformado não quebra a cena (teste).
- [ ] Nenhum conteúdo de mensagem aparece nos balões.

---

<a id="ent-web-007"></a>
## ENT-WEB-007 — Desempenho 3D, pipeline de assets e modo 2D

**Sprint** S09 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Qualidade

**Especificação técnica**
- Orçamentos: triângulos, draw calls, memória de textura, tempo até interativo, tamanho inicial (ex.: ≤ N MB comprimidos), definidos e verificados em CI de assets (script que reprova GLB acima do orçamento).
- Otimização: LOD, instancing, compressão (Draco/Meshopt/KTX2), *lazy loading* por andar, cache HTTP/CDN com *hash* de conteúdo, renderização sob demanda (`frameloop="demand"` quando ocioso).
- **Modo 2D/lista** equivalente e **detecção** de WebGL indisponível/baixo desempenho com *fallback* automático e opção manual; `prefers-reduced-motion` respeitado.
- Telemetria de desempenho do cliente (FPS médio, tempo de carga) agregada e anônima.

**Critérios de aceite**
- [ ] Meta de FPS/tempo de carga cumprida no dispositivo de referência (registrar números).
- [ ] Sem WebGL, o usuário completa as mesmas tarefas pelo modo 2D.

---

<a id="ent-web-009"></a>
## ENT-WEB-009 — Backoffice de plataforma

**Sprint** S10 · **Prioridade** Média · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** IAM-009, PRV-006, MSG-004, AIG-003

**Especificação técnica**
- Área separada (`/platform`) acessível apenas a `platform_admin` com MFA obrigatório e, preferencialmente, apenas por túnel/VPN (FND-007).
- Funções: lista de tenants e estados, execuções de provisionamento (passos, erros), DLQ e *requeue* com justificativa, custos por tenant, deriva do reconciliador, estado de capacidade do host, concessões *break-glass* (solicitar/aprovar), kill switch de orçamento por tenant.
- **Sem acesso a conteúdo** de tenant; apenas metadados/diagnósticos (IAM-009).
- Toda ação auditada; confirmações para ações destrutivas.

**Critérios de aceite**
- [ ] Usuário comum de tenant não acessa `/platform` (teste A/B + papel).
- [ ] Nenhuma tela do backoffice exibe conteúdo privado de tenant.
