# EP-07 — Tickets

Regras globais: [../README.md](../README.md). Topologia assumida: [README.md](README.md#topologia-assumida-confirmar-no-adr-025).

<a id="ent-tgw-001"></a>
## ENT-TGW-001 — Tool Gateway: núcleo, identidade e ponto de decisão

**Sprint** S05 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** DEC-013, MSG-002, RUN-001 · **Bloqueia:** RUN-004, TGW-002..006
**Referências:** ADR-012, seção 8.

**Especificação técnica** — `services/tool-gateway` (Python; `mypy --strict` no módulo de política).
- **API interna** `POST /v1/tools/{tool_name}/invoke` (contrato `ToolCallRequest/Response`): corpo = `run_id`, `agent_id`, `step_seq`, `idempotency_key`, `arguments` (JSON). **Não existe campo de tenant**; o tenant vem da identidade do sidecar (configuração fixada no provisionamento + token).
- **Pipeline obrigatório por chamada (ordem fixa):**
  1. Autenticar chamador (runtime do mesmo tenant; token de serviço, `aud=tool-gateway`).
  2. Resolver contexto: `run_id`/`agent_id` pertencem a este tenant e o run está `RUNNING` (consulta ao banco do tenant).
  3. Carregar a definição do agente (versão fixada no run) e política vigente (TGW-002).
  4. **Validar `arguments`** contra o JSON Schema da ferramenta (tipos, limites, formatos; `additionalProperties:false`); rejeitar qualquer argumento que tente definir tenant/caminho/URL/SQL fora do esquema.
  5. **Decisão de política** (`allow | deny | require_approval`) com `reason_code`; negação por padrão.
  6. Se `require_approval`: criar pedido (RUN-005) e retornar `pending_approval`.
  7. Executar a ferramenta (implementação interna ou conector) com *timeout*, limite de resposta e idempotência.
  8. Sanitizar saída (limite de tamanho, remoção de campos secretos, marcação "conteúdo não confiável").
  9. Registrar em `tool_calls` e auditoria: ferramenta, `args_hash`, decisão, `reason_code`, latência — **sem argumentos/resultados em claro** por padrão.
- **Reavaliação a cada invocação**, nunca por sessão ou prompt.
- Registro de ferramentas: manifesto declarativo (`name`, `version`, `input_schema`, `output_schema`, `risk_level`, `requires_approval`, `resource_selectors`, `timeout`); ferramenta fora do registro não existe.
- **Sem caminhos de bypass**: nenhum endpoint de SQL livre, shell, fetch de URL arbitrária ou execução de código; teste de arquitetura impede importar `subprocess`, `os.system`, `eval/exec`, clientes HTTP fora do módulo `egress`.
- Falha fechada: se política/Control Plane indisponível → negar (com cache de política assinado por TTL curto para disponibilidade controlada).
- Erros padronizados sem vazar existência de recursos de outros tenants.

**Critérios de aceite**
- [ ] Chamada com `arguments.tenant_id`/`workspace` extra é rejeitada pelo esquema (negativo) e registrada como evento de segurança.
- [ ] Chamada sem decisão de política registrada **não executa** (teste de propriedade: nenhuma ferramenta roda sem `policy_decision_id`).
- [ ] Política indisponível → `deny` (teste).
- [ ] Import proibido (`subprocess`, etc.) falha o lint arquitetural.

**Testes.** Unitários por etapa do pipeline; integração com runtime falso; SEC (campos extras, IDs de outro tenant, replay de `idempotency_key`).

---

<a id="ent-tgw-002"></a>
## ENT-TGW-002 — Modelo de políticas e testes de política

**Sprint** S05 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** TGW-001, RUN-003 · **Bloqueia:** TGW-003..006
**Referências:** ADR 5.2 (RBAC/ABAC por papel, departamento, ferramenta, recurso e ação).

**Especificação técnica**
- Modelo de regra: `effect (allow|deny|require_approval)`, `agent_role|agent_id`, `department`, `tool`, `action`, `resource_selector` (padrões estruturados, **não** expressões livres), `conditions` (limites de valor/horário/quantidade), `version`, `valid_from/valid_until`.
- Resolução: **deny explícito vence allow**; ausência de regra = deny; escopo sempre restrito ao tenant da identidade.
- Armazenamento: Control Plane (`catalog.tool_policy_templates` + `tenancy.tool_policies`), publicado ao gateway como **bundle versionado e assinado**; gateway verifica assinatura e versão mínima, mantém cache com TTL curto; papel `control_readonly_policy` só lê tabelas de política (IAM-002).
- Avaliador puro e determinístico (`decide(identity, agent, tool, args, ctx) → Decision`), sem I/O; **testes por tabela com cobertura de ramos** (≥ 100 casos: papéis, departamentos, ferramentas, conflitos allow/deny, expirados).
- Ferramentas de alto risco entram `require_approval` por padrão; mudança de política auditada (quem, versão, diff) e exige `agents:configure`.
- Dry-run de política: endpoint administrativo para simular decisão (sem executar), usado por testes e UI.

**Critérios de aceite**
- [ ] Bundle adulterado é rejeitado; versão antiga (rollback malicioso) é rejeitada.
- [ ] Ausência de regra → deny; deny explícito sobrepõe allow (testes).
- [ ] Alterar política em A não altera decisões em B.

**Testes.** Tabela de decisões; propriedade (fuzzing de argumentos não consegue obter `allow` sem regra); integração do bundle.

---

<a id="ent-aig-001"></a>
## ENT-AIG-001 — AI Gateway: núcleo e adaptador OpenRouter

**Sprint** S05 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** DEC-004, DEC-011, MSG-002 · **Bloqueia:** RUN-004, AIG-002, AIG-003, RAG-001
**Referências:** ADR-007, ADR-015, seção 3 (IA).

**Especificação técnica** — `services/ai-gateway`.
- API interna: `POST /v1/completions` (chat/tools, com *streaming* SSE), `POST /v1/embeddings`. Identidade = token de serviço do runtime; o tenant **não** vem do corpo. Requisição inclui `run_id`, `agent_id`, `purpose`, `model` (alias lógico, não nome livre).
- **Alias de modelo** → roteamento: tabela `ai.model_aliases` (alias, provedor, modelo, custo/1k tokens, limites, política de dados) e **allowlist por plano/agente**; modelo fora da allowlist → 403.
- Adaptador OpenRouter (interface `LlmProvider` para futuros provedores/BYOK): *timeouts*, *retries* com *jitter* apenas para erros transitórios idempotentes, *circuit breaker* e fallback entre modelos conforme política; normalização de erros; limite de tamanho de prompt/resposta.
- **Privacidade (ligada a DEC-011)**: enviar o mínimo; aplicar parâmetros de roteamento que restrinjam provedores a políticas aceitas (retenção/treinamento) — *verificar na documentação vigente do OpenRouter e dos provedores na data*; bloqueio de provedores fora da allowlist.
- Chaves do provedor em segredo do AI Gateway (DEC-006), **nunca** repassadas ao runtime; avaliar chaves por tenant com limite de crédito se o provedor permitir (hipótese a validar).
- **Sem log de prompts/respostas por padrão**; log apenas de metadados (modelo, tokens, custo, latência, `run_id`); modo de depuração por tenant exige habilitação auditada e tem retenção curta.
- Cache de respostas **desativado** por padrão (risco de vazamento entre tenants); se habilitado, chave inclui tenant, modelo e hash do prompt.

**Critérios de aceite**
- [ ] Chamada com modelo fora da allowlist ou alias inexistente é negada.
- [ ] Token de A não gera consumo atribuído a B (teste de atribuição).
- [ ] Falha do provedor aciona breaker/fallback sem estourar o orçamento de tentativas.
- [ ] Nenhum prompt/resposta/chave em logs (varredura de teste).

**Testes.** Contra provedor simulado e (opcional, marcado) contra o real em conta de teste; SEC (token de outro tenant, modelo proibido); caos (timeout/5xx).

---

<a id="ent-tgw-003"></a>
## ENT-TGW-003 — Ferramentas internas (documentos, arquivos, consultas nomeadas)

**Sprint** S06 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** TGW-001, DAT-004, DAT-006 · **Bloqueia:** RAG-002, GATE-001
**Referências:** ADR 8.1 (`buscar_documento`), seção 8.2.

**Especificação técnica**
- Ferramentas do catálogo inicial (todas com manifesto, esquema, `risk_level` e política padrão):
  - `search_documents(query, department?, top_k)` — recupera chunks via função `app.search_chunks` (papel `…_tools`); `top_k` máx. 20; filtros de departamento derivados da **autorização do agente**, não do argumento.
  - `get_document(document_id)` — verifica que o documento pertence ao tenant e ao departamento permitido; retorna trecho limitado ou URL assinada curta (DAT-006).
  - `list_documents(department?, cursor)` — paginação limitada.
  - `named_query(name, params)` — **catálogo fechado** de consultas parametrizadas do tenant (ex.: `run_summary`, `usage_by_agent`); `name` em enum; parâmetros tipados; **sem SQL livre**.
  - `write_note(title, body)` — escrita local com `requires_approval` configurável.
- Implementação usa **papel `…_tools`** com privilégios em views/funções nomeadas; nenhum acesso às tabelas de mensagens, credenciais ou auditoria.
- Resultados limitados em tamanho e número; metadados de origem (`document_id`, trecho) para citação.
- ID desconhecido e ID de outro tenant retornam a mesma resposta ("não encontrado") para não permitir enumeração.

**Critérios de aceite**
- [ ] `get_document` com ID existente em outro tenant → "não encontrado", sem diferença mensurável de resposta (corpo/tempo aproximado).
- [ ] Tentativa de SQL livre/identificador no argumento é rejeitada pelo esquema.
- [ ] Papel `…_tools` não lê `messages`/`integration_credentials` (verificado por DAT-005).

**Testes.** Integração com banco real; SEC-05 parcial; enumeração de IDs.

---

<a id="ent-tgw-004"></a>
## ENT-TGW-004 — Cofre de credenciais de integração por tenant

**Sprint** S06 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature de segurança
**Depende de:** TGW-001, DEC-006, DAT-004 · **Bloqueia:** TGW-005
**Referências:** ADR seção 10 ("Integrações", "Segredos"), SEC-09, SEC-15.

**Especificação técnica**
- Credenciais fornecidas pelo cliente (tokens OAuth, chaves de API, SMTP) armazenadas em `integration_credentials` no **banco do tenant** como `ciphertext` (AES-256-GCM ou equivalente) com **chave de dados por tenant** protegida por chave mestra fora do banco (hierarquia do DEC-006), `key_version` para rotação.
- Acesso **exclusivo** do Tool Gateway do tenant (papel `…_tools` com `SELECT` apenas na função de leitura que devolve plaintext só dentro do processo do gateway); runtime e LLM jamais veem o valor.
- API de gestão (Control Plane → Tenant API): cadastrar, rotacionar, revogar, listar **metadados** (rótulo, provedor, escopos, datas); valores nunca retornam após cadastro; entrada via TLS e protegida de log.
- OAuth: *state* e PKCE; *refresh* tratado pelo gateway; escopos mínimos; revogação remota quando o provedor suportar.
- Autorização: cada credencial vincula-se a **integração, departamento e agentes permitidos**; uso por agente fora do vínculo é negado (SEC-09).
- Redação: segredo substituído por `[REDACTED]` em logs, erros e saídas de ferramenta; teste com valor sentinela.
- Rotação/revogação independente por tenant, auditada.

**Critérios de aceite**
- [ ] Runtime com acesso total ao próprio banco **não** consegue ler plaintext (apenas ciphertext inútil sem chave do gateway) — verificado.
- [ ] Agente A tentando usar credencial vinculada a outro agente/integração → negado (SEC-09).
- [ ] Revogar credencial interrompe usos subsequentes imediatamente.
- [ ] Sentinela de segredo ausente de logs, traces e respostas de erro.

**Testes.** Integração; SEC (extração por prompt injection, leitura direta); teste de rotação de `key_version`.

---

<a id="ent-aig-002"></a>
## ENT-AIG-002 — Quotas, rate limits e orçamento

**Sprint** S06 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** AIG-001 · **Bloqueia:** GATE-002
**Referências:** ADR-015, seção 12 ("Variável dominante — IA").

**Especificação técnica**
- **Orçamento mensal** (USD) por tenant e sublimites por departamento/agente; **estimativa pré-voo** (tokens de entrada + máximo de saída × preço do alias) reserva saldo; liquidação pós-chamada com uso real; chamada que excede o saldo é **recusada antes** de chegar ao provedor.
- **Rate limits** (RPM/TPM) por tenant e por agente via *token bucket* em Redis (chaves com *namespace* por tenant, TTL); limite global do gateway por provedor para respeitar quotas do OpenRouter.
- Limite de **concorrência** por tenant (alinhado ao limite de jobs) e tamanho máximo de contexto/saída.
- Limiares de alerta 50/80/100% geram `budget.threshold_reached` (evento e notificação); a 100% corte conforme política do plano (bloqueio total ou modo degradado só com modelos baratos).
- Proteção a *denial of wallet*: detecção de loops de ferramenta/chamada repetida, limite de passos (RUN-004) e *kill switch* manual por tenant.
- Consistência: contadores em PostgreSQL (fonte de verdade; Redis só aceleração) com reconciliação periódica; falha do Redis degrada para limites conservadores, nunca para "sem limite".

**Critérios de aceite**
- [ ] Tenant no limite é recusado sem gerar chamada ao provedor (verificado por contador do provedor simulado).
- [ ] Rajada de A não excede quotas globais nem degrada B além do tolerável (reaproveitado em GATE-002).
- [ ] Queda do Redis → limites conservadores aplicados (teste).

**Testes.** Unitários (contabilidade, arredondamento com `numeric`); integração; carga; SEC (contornar limite alterando cabeçalhos/tenant).

---

<a id="ent-aig-003"></a>
## ENT-AIG-003 — Metering e relatórios de custo

**Sprint** S06 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** AIG-001, DAT-004 · **Bloqueia:** WEB-003, OBS-005

**Especificação técnica**
- Cada chamada gera `token_usage` no **banco do tenant** (detalhe por `run_id`, modelo, tokens, custo) e um **agregado** (tenant, dia, departamento, agente, modelo) no banco de controle (sem conteúdo).
- Tabela de preços versionada (`ai.model_prices` com vigência); custo calculado com `numeric`; tolerância e reconciliação com a fatura do provedor (importação manual/CSV no MVP).
- API: `GET /v1/organizations/:orgId/usage?from&to&group_by=department|agent|model` com autorização `billing:read`; exportação CSV.
- Visão de plataforma: custo por tenant e margem aproximada (apenas `platform_admin`, auditado).
- Retenção do detalhe conforme política; agregados preservados.

**Critérios de aceite**
- [ ] Soma do detalhe = agregado (teste de consistência).
- [ ] Usuário de A não consulta uso de B.
- [ ] Mudança de preço não altera custo histórico.

---

<a id="ent-tgw-005"></a>
## ENT-TGW-005 — Framework de conectores e conector HTTP seguro

**Sprint** S07 · **Prioridade** Média · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** TGW-004, ISO-004 · **Bloqueia:** GATE-001 (SEC-12 aplicada em ferramenta)

**Especificação técnica**
- Interface `Connector` (`name`, `scopes`, `actions[]` com esquemas, `auth`, `egress_policy`) e SDK para novos conectores; ciclo de vida de credencial integrado ao TGW-004.
- Conector de referência **HTTP genérico** restrito a *hosts* allowlist cadastrados pelo administrador do tenant, método/rota/headers permitidos, tamanho e tempo limitados; usa `ssrf-guard` (ISO-004) e o proxy de egress; **sem seguir redirecionamento para host fora da allowlist**.
- Conector de teste ("mock-crm") para validar autorização por ação/recurso sem depender de terceiros; conectores reais (CRM, e-mail etc.) são backlog da segunda parte.
- Ações de escrita externas: `requires_approval` por padrão.
- Idempotência por `idempotency_key` repassada ao serviço externo quando suportado.

**Critérios de aceite**
- [ ] Conector HTTP não alcança IP privado/metadados nem host fora da allowlist (SEC-12 via ferramenta).
- [ ] Ação de escrita sem aprovação não executa.
- [ ] Credencial usada só pelo agente/integração vinculados.

---

<a id="ent-tgw-006"></a>
## ENT-TGW-006 — Defesas de fronteira contra prompt injection

**Sprint** S07 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** TGW-003 · **Bloqueia:** RAG-003, GATE-001
**Referências:** ADR 8.2 ("Inputs de fontes externas são conteúdo não confiável"), SEC-05, SEC-10.

**Especificação técnica**
- **Premissa**: não existe filtro que impeça prompt injection; a defesa é **limitar o dano** pela arquitetura. Este ticket implementa controles no gateway e documenta o que *não* garantem.
- Marcação de proveniência: toda saída de ferramenta carrega `trust: untrusted` + `source`; o engine monta o contexto com delimitação estruturada (campo dedicado, nunca concatenado como instrução do sistema).
- Limites de dano: *allowlist* de ferramentas por agente; ferramentas de escrita externa com aprovação; limites de volume (ex.: envio em massa) por política; **exfiltração**: saída para rede só pelo conector com allowlist (sem links/imagens remotas renderizados automaticamente na UI — alinhado a WEB-008).
- Detecção heurística **informativa** (padrões de "ignore as instruções", pedidos de segredos/outros tenants) que gera evento de segurança e aumenta a exigência de aprovação — nunca é o controle principal.
- Corpus de ataques versionado (`services/tool-gateway/tests/adversarial/`): injeções diretas/indiretas em e-mail, documento, página; tentativas de acessar tenant B, enumerar IDs, extrair prompt do sistema, chamar ferramenta não permitida, encadear ferramentas para exfiltrar.
- Métrica: taxa de tentativas bloqueadas por política (esperado 100% das que violam política); relatório reproduzível.

**Critérios de aceite**
- [ ] 100% do corpus que viola política é negado **independentemente do texto do prompt** (executado com modelo falso que "obedece" qualquer instrução).
- [ ] Nenhum segredo/dado de B presente nas respostas do corpus (sentinelas).
- [ ] Documento "Limites das defesas" publicado (o que não é garantido).
